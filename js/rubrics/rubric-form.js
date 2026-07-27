import {
  makeCriterion,
  makeRubricBundle
} from '../academic/rubric-model.js';

const $ = selector => document.querySelector(selector);

export function rubricValues(rubric = null) {
  if (!rubric) return { title: '', instructions: '', observations: '' };
  return rubric.schemaVersion === 2
    ? {
      title: rubric.title,
      instructions: rubric.data.instructions,
      observations: rubric.data.observations
    }
    : {
      title: rubric.title,
      instructions: rubric.data.description,
      observations: ''
    };
}

export function fillRubricForm(rubric = null) {
  const values = rubricValues(rubric);
  $('#rubricTitle').value = values.title;
  $('#rubricInstructions').value = values.instructions;
  $('#rubricObservations').value = values.observations;
  $('#rubricFormError').hidden = true;
}

export function rubricBundle(projectId, existing, criteria) {
  return makeRubricBundle({
    title: $('#rubricTitle').value,
    instructions: $('#rubricInstructions').value,
    observations: $('#rubricObservations').value
  }, criteria, {
    projectId,
    existing,
    id: existing?.id || `rubric_${crypto.randomUUID()}`
  });
}

export function rebuildRubric(projectId, rubric, criteria) {
  return makeRubricBundle(rubricValues(rubric), criteria, {
    projectId,
    existing: rubric
  });
}

export function fillCriterionForm(criterion = null) {
  $('#criterionTitle').value = criterion?.title || '';
  $('#criterionDescription').value = criterion?.data.description || '';
  $('#criterionPoints').value = criterion?.data.maxPoints ?? '';
  $('#criterionRequired').checked = criterion?.data.required || false;
  $('#criterionState').value = criterion?.schemaVersion === 2
    ? criterion.data.state
    : 'pending';
  $('#criterionFormError').hidden = true;
}

export function criterionRecord(projectId, rubricId, existing, position) {
  return makeCriterion({
    title: $('#criterionTitle').value,
    description: $('#criterionDescription').value,
    maxPoints: $('#criterionPoints').value,
    required: $('#criterionRequired').checked,
    state: $('#criterionState').value
  }, {
    projectId,
    rubricId,
    existing,
    position,
    id: existing?.id || `criterion_${crypto.randomUUID()}`
  });
}
