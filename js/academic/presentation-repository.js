import { validateArtifact, validateArtifactParent } from './artifact-schemas.js';
import { validateRelation } from './relation-model.js';
import { requestResult, rowsByIndex, transactionDone } from './repository-helpers.js';

function fail(message) {
  throw new TypeError(`Integridad académica: ${message}`);
}

function ordered(rows) {
  return rows.sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

export class PresentationRepository {
  constructor(provider) {
    this.provider = provider;
  }

  async get(projectId) {
    const db = await this.provider();
    const tx = db.transaction(['academicProjects', 'projectArtifacts', 'artifactRelations']);
    const artifacts = tx.objectStore('projectArtifacts');
    const [project, presentations, relations] = await Promise.all([
      requestResult(tx.objectStore('academicProjects').get(projectId)),
      requestResult(artifacts.index('projectKind').getAll([projectId, 'presentation'])),
      requestResult(tx.objectStore('artifactRelations').index('projectId').getAll(projectId))
    ]);
    if (!project) fail('el proyecto no existe.');
    if (!presentations.length) return null;
    if (presentations.length > 1) fail('el proyecto contiene más de una presentación.');
    const presentation = presentations[0];
    const slides = ordered(
      (await rowsByIndex(artifacts, 'parentId', presentation.id))
        .filter(item => item.kind === 'presentation_slide')
    );
    const ids = new Set(slides.map(item => item.id));
    return {
      presentation,
      slides,
      relations: relations.filter(item =>
        ids.has(item.fromId) && ['derived_from', 'cites'].includes(item.type)
      )
    };
  }

  async options(projectId) {
    const db = await this.provider();
    const tx = db.transaction(['academicProjects', 'projectArtifacts']);
    const artifacts = tx.objectStore('projectArtifacts');
    const [project, sections, evidence, sources] = await Promise.all([
      requestResult(tx.objectStore('academicProjects').get(projectId)),
      requestResult(artifacts.index('projectKind').getAll([projectId, 'report_section'])),
      requestResult(artifacts.index('projectKind').getAll([projectId, 'evidence'])),
      requestResult(artifacts.index('projectKind').getAll([projectId, 'source']))
    ]);
    if (!project) fail('el proyecto no existe.');
    return { sections: ordered(sections), evidence, sources };
  }

  async save(bundle, { existing = false } = {}) {
    validateArtifact(bundle.presentation);
    bundle.slides.forEach(slide => {
      validateArtifact(slide);
      validateArtifactParent(slide, bundle.presentation);
    });
    const db = await this.provider();
    const tx = db.transaction(
      ['academicProjects', 'projectArtifacts', 'artifactRelations'],
      'readwrite'
    );
    const done = transactionDone(tx);
    try {
      const artifacts = tx.objectStore('projectArtifacts');
      const relations = tx.objectStore('artifactRelations');
      const [project, stored, presentations, oldSlides, projectRelations] = await Promise.all([
        requestResult(tx.objectStore('academicProjects').get(bundle.presentation.projectId)),
        requestResult(artifacts.get(bundle.presentation.id)),
        requestResult(artifacts.index('projectKind').getAll([
          bundle.presentation.projectId, 'presentation'
        ])),
        requestResult(artifacts.index('parentId').getAll(bundle.presentation.id)),
        requestResult(relations.index('projectId').getAll(bundle.presentation.projectId))
      ]);
      if (!project) fail('el proyecto no existe.');
      if (existing && (!stored || stored.kind !== 'presentation')) {
        fail('la presentación no existe.');
      }
      if (!existing && (stored || presentations.length)) {
        fail('el proyecto ya tiene una presentación.');
      }
      if (stored && stored.projectId !== bundle.presentation.projectId) {
        fail('la presentación no puede cambiar de proyecto.');
      }
      const oldIds = new Set(oldSlides.map(item => item.id));
      const incomingIds = new Set(bundle.slides.map(item => item.id));
      const collisions = await Promise.all(
        bundle.slides.filter(item => !oldIds.has(item.id))
          .map(item => requestResult(artifacts.get(item.id)))
      );
      if (collisions.some(Boolean)) fail('alguna diapositiva ya existe.');
      const endpointIds = [...new Set(bundle.relations.map(item => item.toId))];
      const endpoints = await Promise.all(endpointIds.map(id => requestResult(artifacts.get(id))));
      const endpointMap = new Map(endpointIds.map((id, index) => [id, endpoints[index]]));
      const slideMap = new Map(bundle.slides.map(item => [item.id, item]));
      bundle.relations.forEach(item =>
        validateRelation(item, slideMap.get(item.fromId), endpointMap.get(item.toId))
      );
      projectRelations.filter(item =>
        oldIds.has(item.fromId) && ['derived_from', 'cites'].includes(item.type)
      ).forEach(item => relations.delete(item.id));
      oldSlides.filter(item => !incomingIds.has(item.id)).forEach(item => {
        projectRelations.filter(relation =>
          relation.fromId === item.id || relation.toId === item.id
        ).forEach(relation => relations.delete(relation.id));
        artifacts.delete(item.id);
      });
      artifacts.put(bundle.presentation);
      bundle.slides.forEach(item => artifacts.put(item));
      bundle.relations.forEach(item => relations.put(item));
    } catch (error) {
      tx.abort();
      await done.catch(() => {});
      throw error;
    }
    await done;
    return this.get(bundle.presentation.projectId);
  }

  async delete(presentationId) {
    const db = await this.provider();
    const tx = db.transaction(['projectArtifacts', 'artifactRelations'], 'readwrite');
    const done = transactionDone(tx);
    try {
      const artifacts = tx.objectStore('projectArtifacts');
      const presentation = await requestResult(artifacts.get(presentationId));
      if (!presentation || presentation.kind !== 'presentation') {
        fail('la presentación no existe.');
      }
      const slides = await requestResult(artifacts.index('parentId').getAll(presentationId));
      const ids = new Set([presentationId, ...slides.map(item => item.id)]);
      const relations = tx.objectStore('artifactRelations');
      (await requestResult(relations.index('projectId').getAll(presentation.projectId)))
        .filter(item => ids.has(item.fromId) || ids.has(item.toId))
        .forEach(item => relations.delete(item.id));
      slides.forEach(item => artifacts.delete(item.id));
      artifacts.delete(presentationId);
    } catch (error) {
      tx.abort();
      await done.catch(() => {});
      throw error;
    }
    await done;
  }
}
