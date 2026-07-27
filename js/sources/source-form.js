import {
  FILE_SOURCE_TYPES,
  makeSourceBundle
} from '../academic/source-model.js';

const $ = selector => document.querySelector(selector);

function mappedLegacyType(value) {
  if (['book', 'article', 'website'].includes(value)) return value;
  return 'note';
}

export function fillSourceDocuments(documents) {
  const select = $('#sourceDocument');
  select.replaceChildren(new Option('Sin documento asociado', ''));
  documents.forEach(document => select.add(new Option(document.name, document.id)));
}

export function resetSourceForm() {
  $('#sourceForm').reset();
  $('#sourceType').value = 'article';
  $('#sourceFormError').hidden = true;
  syncSourceRequirements();
}

export function fillSourceForm(details) {
  const { source, document } = details;
  const data = source.data;
  $('#sourceTitle').value = source.title;
  $('#sourceType').value = source.schemaVersion === 2
    ? data.sourceType
    : mappedLegacyType(data.sourceType);
  $('#sourceAuthor').value = source.schemaVersion === 2
    ? data.author
    : data.authors.join(', ');
  $('#sourceDate').value = source.schemaVersion === 2 ? data.date || '' : '';
  $('#sourceDocument').value = document?.id || '';
  $('#sourceUrl').value = data.url || '';
  $('#sourceDescription').value = source.schemaVersion === 2
    ? data.description
    : data.publicationTitle;
  $('#sourceNotes').value = data.notes || '';
  $('#sourceFormError').hidden = true;
  syncSourceRequirements();
}

export function syncSourceRequirements() {
  const type = $('#sourceType').value;
  const documentRequired = FILE_SOURCE_TYPES.includes(type);
  const urlRequired = ['website', 'video'].includes(type);
  $('#sourceDocument').required = documentRequired;
  $('#sourceUrl').required = urlRequired;
  $('#sourceFormHint').textContent = documentRequired
    ? 'Este tipo requiere seleccionar un documento existente en la Biblioteca.'
    : urlRequired
      ? 'Este tipo requiere un enlace web válido.'
      : 'Puedes asociar un documento o enlace si corresponde.';
}

function input(projectId) {
  return {
    projectId,
    title: $('#sourceTitle').value,
    sourceType: $('#sourceType').value,
    author: $('#sourceAuthor').value,
    date: $('#sourceDate').value,
    documentId: $('#sourceDocument').value,
    url: $('#sourceUrl').value,
    description: $('#sourceDescription').value,
    notes: $('#sourceNotes').value
  };
}

export function sourceBundle(projectId, existing = null) {
  const uid = prefix => `${prefix}_${crypto.randomUUID()}`;
  return makeSourceBundle(input(projectId), {
    existing,
    ids: {
      sourceId: uid('source'),
      referenceId: uid('document_ref'),
      relationId: uid('relation')
    }
  });
}

