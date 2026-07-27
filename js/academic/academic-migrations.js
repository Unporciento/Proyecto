export const TARGET_DB_VERSION = 3;
export const ACADEMIC_DB_VERSION = 3;
export const ACADEMIC_STORES = Object.freeze([
  'academicProjects',
  'projectArtifacts',
  'artifactRelations',
  'artifactRevisions'
]);

const LEGACY_STORES = ['subjects', 'documents', 'cards', 'attempts', 'settings'];

function addIndex(store, name, keyPath, options) {
  if (!store.indexNames.contains(name)) store.createIndex(name, keyPath, options);
}

function ensureLegacyStores(db, transaction) {
  for (const name of LEGACY_STORES) {
    const store = db.objectStoreNames.contains(name)
      ? transaction.objectStore(name)
      : db.createObjectStore(name, { keyPath: name === 'settings' ? 'key' : 'id' });
    if (name === 'documents') addIndex(store, 'createdAt', 'createdAt');
    if (name === 'cards') {
      addIndex(store, 'docId', 'docId');
      addIndex(store, 'dueAt', 'dueAt');
    }
    if (name === 'attempts') {
      addIndex(store, 'cardId', 'cardId');
      addIndex(store, 'createdAt', 'createdAt');
    }
  }
}

function createAcademicStores(db) {
  const projects = db.createObjectStore('academicProjects', { keyPath: 'id' });
  addIndex(projects, 'subjectId', 'subjectId');
  addIndex(projects, 'status', 'status');
  addIndex(projects, 'updatedAt', 'updatedAt');
  addIndex(projects, 'subjectStatus', ['subjectId', 'status']);

  const artifacts = db.createObjectStore('projectArtifacts', { keyPath: 'id' });
  addIndex(artifacts, 'projectId', 'projectId');
  addIndex(artifacts, 'parentId', 'parentId');
  addIndex(artifacts, 'kind', 'kind');
  addIndex(artifacts, 'updatedAt', 'updatedAt');
  addIndex(artifacts, 'projectKind', ['projectId', 'kind']);
  addIndex(artifacts, 'projectParent', ['projectId', 'parentId']);

  const relations = db.createObjectStore('artifactRelations', { keyPath: 'id' });
  addIndex(relations, 'projectId', 'projectId');
  addIndex(relations, 'fromId', 'fromId');
  addIndex(relations, 'toId', 'toId');
  addIndex(relations, 'projectType', ['projectId', 'type']);
  addIndex(relations, 'identity', ['projectId', 'fromId', 'toId', 'type'], { unique: true });

  const revisions = db.createObjectStore('artifactRevisions', { keyPath: 'id' });
  addIndex(revisions, 'artifactId', 'artifactId');
  addIndex(revisions, 'projectId', 'projectId');
  addIndex(revisions, 'artifactRevision', ['artifactId', 'revision'], { unique: true });
}

export function applyMigrations(db, transaction, oldVersion, newVersion) {
  if (oldVersion < 2 && newVersion >= 2) ensureLegacyStores(db, transaction);
  if (oldVersion < 3 && newVersion >= 3) {
    ensureLegacyStores(db, transaction);
    if (!db.objectStoreNames.contains('academicProjects')) createAcademicStores(db);
  }
}

function openRequest(factory, name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const request = version === undefined ? factory.open(name) : factory.open(name, version);
    request.onupgradeneeded = event => upgrade?.(
      request.result,
      request.transaction,
      event.oldVersion,
      event.newVersion
    );
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Otra pestaña impide actualizar la base de FORJA.'));
  });
}

export async function openCompatibleDatabase({
  name,
  targetVersion = TARGET_DB_VERSION,
  factory = globalThis.indexedDB,
  migrate = applyMigrations
}) {
  if (!factory) throw new Error('IndexedDB no está disponible.');
  const installed = await openRequest(factory, name);
  if (installed.version >= targetVersion) return installed;
  installed.close();
  try {
    return await openRequest(factory, name, targetVersion, migrate);
  } catch (error) {
    if (error?.name !== 'VersionError') throw error;
    return openRequest(factory, name);
  }
}
