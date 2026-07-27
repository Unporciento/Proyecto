import { validateArtifact, validateArtifactParent } from './artifact-schemas.js';
import { validateRelation } from './relation-model.js';
import { requestResult, rowsByIndex, transactionDone } from './repository-helpers.js';

const STORES = [
  'academicProjects', 'projectArtifacts', 'artifactRelations', 'artifactRevisions'
];

function fail(message) {
  throw new TypeError(`Integridad académica: ${message}`);
}

function ordered(rows) {
  return rows.sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

export class ReportRepository {
  constructor(provider) {
    this.provider = provider;
  }

  async get(projectId) {
    const db = await this.provider();
    const tx = db.transaction(STORES);
    const artifacts = tx.objectStore('projectArtifacts');
    const [project, reports, allRelations, revisions] = await Promise.all([
      requestResult(tx.objectStore('academicProjects').get(projectId)),
      requestResult(artifacts.index('projectKind').getAll([projectId, 'report'])),
      requestResult(tx.objectStore('artifactRelations').index('projectId').getAll(projectId)),
      requestResult(tx.objectStore('artifactRevisions').index('projectId').getAll(projectId))
    ]);
    if (!project) fail('el proyecto no existe.');
    if (!reports.length) return null;
    if (reports.length > 1) fail('el proyecto contiene más de un informe.');
    const report = reports[0];
    const sections = ordered(
      (await rowsByIndex(artifacts, 'parentId', report.id))
        .filter(item => item.kind === 'report_section')
    );
    const sectionIds = new Set(sections.map(item => item.id));
    return {
      report,
      sections,
      relations: allRelations.filter(item =>
        sectionIds.has(item.fromId) && ['derived_from', 'cites'].includes(item.type)
      ),
      revisions: revisions.filter(item =>
        item.artifactId === report.id || sectionIds.has(item.artifactId)
      )
    };
  }

  async options(projectId) {
    const db = await this.provider();
    const tx = db.transaction(['academicProjects', 'projectArtifacts', 'artifactRelations']);
    const artifacts = tx.objectStore('projectArtifacts');
    const [project, sources, evidence, criteria, relations] = await Promise.all([
      requestResult(tx.objectStore('academicProjects').get(projectId)),
      requestResult(artifacts.index('projectKind').getAll([projectId, 'source'])),
      requestResult(artifacts.index('projectKind').getAll([projectId, 'evidence'])),
      requestResult(artifacts.index('projectKind').getAll([projectId, 'rubric_criterion'])),
      requestResult(tx.objectStore('artifactRelations').index('projectId').getAll(projectId))
    ]);
    if (!project) fail('el proyecto no existe.');
    const satisfiedByEvidence = new Map();
    relations.filter(item => item.type === 'satisfies').forEach(item => {
      const ids = satisfiedByEvidence.get(item.fromId) || [];
      ids.push(item.toId);
      satisfiedByEvidence.set(item.fromId, ids);
    });
    return { sources, evidence, criteria, satisfiedByEvidence };
  }

  async save(bundle, { existing = false } = {}) {
    validateArtifact(bundle.report);
    bundle.sections.forEach(section => {
      validateArtifact(section);
      validateArtifactParent(section, bundle.report);
    });
    const db = await this.provider();
    const tx = db.transaction(STORES, 'readwrite');
    const done = transactionDone(tx);
    try {
      const artifacts = tx.objectStore('projectArtifacts');
      const relations = tx.objectStore('artifactRelations');
      const [project, stored, reports, oldSections, projectRelations] = await Promise.all([
        requestResult(tx.objectStore('academicProjects').get(bundle.report.projectId)),
        requestResult(artifacts.get(bundle.report.id)),
        requestResult(artifacts.index('projectKind').getAll([bundle.report.projectId, 'report'])),
        requestResult(artifacts.index('parentId').getAll(bundle.report.id)),
        requestResult(relations.index('projectId').getAll(bundle.report.projectId))
      ]);
      if (!project) fail('el proyecto no existe.');
      if (existing && (!stored || stored.kind !== 'report')) fail('el informe no existe.');
      if (!existing && (stored || reports.length)) fail('el proyecto ya tiene un informe.');
      if (stored && stored.projectId !== bundle.report.projectId) {
        fail('el informe no puede cambiar de proyecto.');
      }
      const sectionIds = new Set(bundle.sections.map(item => item.id));
      const oldIds = new Set(oldSections.map(item => item.id));
      const collisions = await Promise.all(
        bundle.sections.filter(item => !oldIds.has(item.id))
          .map(item => requestResult(artifacts.get(item.id)))
      );
      if (collisions.some(Boolean)) fail('alguna sección ya existe en otro lugar.');
      const endpointIds = [...new Set(bundle.relations.map(item => item.toId))];
      const endpoints = await Promise.all(endpointIds.map(id => requestResult(artifacts.get(id))));
      const endpointMap = new Map(endpointIds.map((id, index) => [id, endpoints[index]]));
      const sectionMap = new Map(bundle.sections.map(item => [item.id, item]));
      bundle.relations.forEach(relation =>
        validateRelation(relation, sectionMap.get(relation.fromId), endpointMap.get(relation.toId))
      );
      const ownedOld = projectRelations.filter(item =>
        oldIds.has(item.fromId) && ['derived_from', 'cites'].includes(item.type)
      );
      ownedOld.forEach(item => relations.delete(item.id));
      oldSections.filter(item => !sectionIds.has(item.id)).forEach(item => {
        projectRelations.filter(relation =>
          relation.fromId === item.id || relation.toId === item.id
        ).forEach(relation => relations.delete(relation.id));
        artifacts.delete(item.id);
      });
      artifacts.put(bundle.report);
      bundle.sections.forEach(item => artifacts.put(item));
      bundle.relations.forEach(item => relations.put(item));
      if (bundle.report.status === 'final' && stored?.status !== 'final') {
        await this.#checkpoint(tx.objectStore('artifactRevisions'), [
          bundle.report, ...bundle.sections
        ]);
      }
    } catch (error) {
      tx.abort();
      await done.catch(() => {});
      throw error;
    }
    await done;
    return this.get(bundle.report.projectId);
  }

  async #checkpoint(store, artifacts) {
    for (const artifact of artifacts) {
      const previous = await requestResult(store.index('artifactId').getAll(artifact.id));
      const revision = previous.length + 1;
      store.add({
        id: `revision_${crypto.randomUUID()}`,
        artifactId: artifact.id,
        projectId: artifact.projectId,
        revision,
        snapshot: structuredClone(artifact),
        reason: 'submitted',
        schemaVersion: 1,
        createdAt: artifact.updatedAt
      });
    }
  }

  async delete(reportId) {
    const db = await this.provider();
    const tx = db.transaction(
      ['projectArtifacts', 'artifactRelations', 'artifactRevisions'],
      'readwrite'
    );
    const done = transactionDone(tx);
    try {
      const artifacts = tx.objectStore('projectArtifacts');
      const report = await requestResult(artifacts.get(reportId));
      if (!report || report.kind !== 'report') fail('el informe no existe.');
      const sections = await requestResult(artifacts.index('parentId').getAll(reportId));
      const ids = new Set([reportId, ...sections.map(item => item.id)]);
      const relations = tx.objectStore('artifactRelations');
      (await requestResult(relations.index('projectId').getAll(report.projectId)))
        .filter(item => ids.has(item.fromId) || ids.has(item.toId))
        .forEach(item => relations.delete(item.id));
      const revisions = tx.objectStore('artifactRevisions');
      for (const id of ids) {
        (await requestResult(revisions.index('artifactId').getAllKeys(id)))
          .forEach(key => revisions.delete(key));
      }
      sections.forEach(item => artifacts.delete(item.id));
      artifacts.delete(reportId);
    } catch (error) {
      tx.abort();
      await done.catch(() => {});
      throw error;
    }
    await done;
  }
}
