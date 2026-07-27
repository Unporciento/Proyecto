import {
  DOCUMENT_EVIDENCE_TYPES,
  makeEvidenceBundle
} from '../academic/evidence-model.js';

const $ = selector => document.querySelector(selector);

function option(label, value, selected, group) {
  const row = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = group;
  input.value = value;
  input.checked = selected.has(value);
  const text = document.createElement('span');
  text.textContent = label;
  row.append(input, text);
  return row;
}

function selectedIds(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)]
    .map(input => input.value);
}

function fillChoices(target, rows, selected, group, emptyText) {
  if (!rows.length) {
    const message = document.createElement('p');
    message.textContent = emptyText;
    target.replaceChildren(message);
    return;
  }
  target.replaceChildren(
    ...rows.map(item => option(item.title, item.id, selected, group))
  );
}

export function fillEvidenceOptions(options) {
  const documentSelect = $('#evidenceDocument');
  documentSelect.replaceChildren(new Option('Sin documento asociado', ''));
  options.documents.forEach(item => documentSelect.add(new Option(item.name, item.id)));
}

export function syncEvidenceRequirements() {
  const required = DOCUMENT_EVIDENCE_TYPES.includes($('#evidenceType').value);
  $('#evidenceDocument').required = required;
  $('#evidenceFormHint').textContent = required
    ? 'Este tipo requiere un documento, además de al menos una fuente y un criterio.'
    : 'Selecciona al menos una fuente y un criterio.';
}

function legacyData(evidence) {
  return {
    evidenceType: 'text',
    description: evidence.data.summary,
    observation: evidence.data.excerpt,
    date: null,
    state: evidence.data.confidence === 'confirmed' ? 'approved' : 'review'
  };
}

export function fillEvidenceForm(options, details = null) {
  const data = details
    ? details.evidence.schemaVersion === 2
      ? details.evidence.data
      : legacyData(details.evidence)
    : null;
  const sourceIds = new Set(details?.relations
    .filter(item => item.type === 'derived_from').map(item => item.toId) || []);
  const criterionIds = new Set(details?.relations
    .filter(item => item.type === 'satisfies').map(item => item.toId) || []);
  $('#evidenceTitle').value = details?.evidence.title || '';
  $('#evidenceType').value = data?.evidenceType || 'text';
  $('#evidenceState').value = data?.state || 'collected';
  $('#evidenceDate').value = data?.date || '';
  $('#evidenceDocument').value = details?.document?.id || '';
  $('#evidenceDescription').value = data?.description || '';
  $('#evidenceObservation').value = data?.observation || '';
  fillChoices(
    $('#evidenceSourceChoices'),
    options.sources,
    sourceIds,
    'evidenceSource',
    'Primero añade una fuente al proyecto.'
  );
  fillChoices(
    $('#evidenceCriterionChoices'),
    options.criteria,
    criterionIds,
    'evidenceCriterion',
    'Primero añade un criterio a la rúbrica.'
  );
  $('#evidenceFormError').hidden = true;
  syncEvidenceRequirements();
}

export function evidenceBundle(projectId, details = null) {
  const ids = key => `${key.split(':')[0]}_${crypto.randomUUID()}`;
  return makeEvidenceBundle({
    projectId,
    title: $('#evidenceTitle').value,
    evidenceType: $('#evidenceType').value,
    state: $('#evidenceState').value,
    date: $('#evidenceDate').value,
    documentId: $('#evidenceDocument').value,
    description: $('#evidenceDescription').value,
    observation: $('#evidenceObservation').value,
    sourceIds: selectedIds('evidenceSource'),
    criterionIds: selectedIds('evidenceCriterion')
  }, { existing: details, ids });
}
