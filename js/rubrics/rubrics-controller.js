import { AcademicRepository } from '../academic/academic-repository.js';
import { toast } from '../ui.js';
import {
  criterionRecord,
  fillCriterionForm,
  fillRubricForm,
  rebuildRubric,
  rubricBundle
} from './rubric-form.js';
import { renderRubric } from './rubrics-view.js';

const $ = selector => document.querySelector(selector);
const repository = new AcademicRepository();
const state = {
  project: null,
  details: null,
  editingCriterion: null,
  returnFocus: null,
  dialogFocus: null,
  busy: false
};

function setBusy(value) {
  state.busy = value;
  $('#rubricContent').setAttribute('aria-busy', String(value));
  $('#newRubricBtn').disabled = value;
}

async function loadRubric() {
  if (!state.project || state.busy) return;
  setBusy(true);
  try {
    state.details = await repository.getProjectRubric(state.project.id);
    renderRubric($('#rubricContent'), state.details);
  } catch (error) {
    console.error(error);
    toast('No pude cargar la rúbrica.', 'error');
  } finally {
    setBusy(false);
  }
}

async function openWorkspace(projectId, trigger) {
  try {
    state.project = await repository.getProject(projectId);
    state.returnFocus = trigger;
    $('#rubricProjectContext').textContent = state.project.title;
    $('#projectsOverview').hidden = true;
    $('#rubricWorkspace').hidden = false;
    $('#viewTitle').textContent = 'Rúbrica académica';
    await loadRubric();
    $('#closeRubricBtn').focus({ preventScroll: true });
  } catch (error) {
    console.error(error);
    toast('No pude abrir la rúbrica de ese proyecto.', 'error');
  }
}

function closeWorkspace({ restoreFocus = true } = {}) {
  if (!state.project) return;
  $('#rubricWorkspace').hidden = true;
  $('#projectsOverview').hidden = false;
  $('#viewTitle').textContent = 'Proyectos académicos';
  state.project = null;
  state.details = null;
  if (restoreFocus) state.returnFocus?.focus({ preventScroll: true });
  state.returnFocus = null;
}

function openRubricDialog(trigger) {
  state.dialogFocus = trigger;
  fillRubricForm(state.details?.rubric);
  $('#rubricDialogTitle').textContent = state.details ? 'Editar rúbrica' : 'Crear rúbrica';
  $('#saveRubricBtn').textContent = state.details ? 'Guardar cambios' : 'Crear rúbrica';
  $('#rubricDialog').showModal();
  $('#rubricTitle').focus();
}

function openCriterionDialog(criterion, trigger) {
  state.editingCriterion = criterion;
  state.dialogFocus = trigger;
  fillCriterionForm(criterion);
  $('#criterionDialogTitle').textContent = criterion ? 'Editar criterio' : 'Añadir criterio';
  $('#saveCriterionBtn').textContent = criterion ? 'Guardar cambios' : 'Añadir criterio';
  $('#criterionDialog').showModal();
  $('#criterionTitle').focus();
}

function restoreFocus() {
  state.dialogFocus?.focus({ preventScroll: true });
  state.dialogFocus = null;
}

async function saveRubric(event) {
  event.preventDefault();
  if (!$('#rubricForm').reportValidity()) return;
  $('#saveRubricBtn').disabled = true;
  try {
    const bundle = rubricBundle(
      state.project.id,
      state.details?.rubric,
      state.details?.criteria || []
    );
    if (state.details) await repository.updateRubricBundle(bundle);
    else await repository.createRubricBundle(bundle);
    $('#rubricDialog').close('save');
    toast(state.details ? 'Rúbrica actualizada.' : 'Rúbrica creada.');
    await loadRubric();
  } catch (error) {
    $('#rubricFormError').textContent = error.message;
    $('#rubricFormError').hidden = false;
  } finally {
    $('#saveRubricBtn').disabled = false;
  }
}

async function saveCriterion(event) {
  event.preventDefault();
  if (!$('#criterionForm').reportValidity()) return;
  $('#saveCriterionBtn').disabled = true;
  try {
    const criteria = [...state.details.criteria];
    const index = state.editingCriterion
      ? criteria.findIndex(item => item.id === state.editingCriterion.id)
      : criteria.length;
    const criterion = criterionRecord(
      state.project.id,
      state.details.rubric.id,
      state.editingCriterion,
      index
    );
    if (state.editingCriterion) criteria[index] = criterion;
    else criteria.push(criterion);
    await repository.updateRubricBundle(
      rebuildRubric(state.project.id, state.details.rubric, criteria)
    );
    $('#criterionDialog').close('save');
    state.editingCriterion = null;
    toast('Criterio guardado.');
    await loadRubric();
  } catch (error) {
    $('#criterionFormError').textContent = error.message;
    $('#criterionFormError').hidden = false;
  } finally {
    $('#saveCriterionBtn').disabled = false;
  }
}

async function moveCriterion(id, delta) {
  const criteria = [...state.details.criteria];
  const from = criteria.findIndex(item => item.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= criteria.length) return;
  [criteria[from], criteria[to]] = [criteria[to], criteria[from]];
  await repository.updateRubricBundle(
    rebuildRubric(state.project.id, state.details.rubric, criteria)
  );
  await loadRubric();
  document.querySelector(
    `[data-rubric-action="edit-criterion"][data-criterion-id="${id}"]`
  )?.focus({ preventScroll: true });
}

async function removeCriterion(id) {
  const criterion = state.details.criteria.find(item => item.id === id);
  if (!criterion || !confirm(`¿Eliminar el criterio “${criterion.title}”?`)) return;
  const criteria = state.details.criteria.filter(item => item.id !== id);
  await repository.updateRubricBundle(
    rebuildRubric(state.project.id, state.details.rubric, criteria)
  );
  toast('Criterio eliminado.');
  await loadRubric();
}

async function removeRubric() {
  if (!confirm(`¿Eliminar la rúbrica “${state.details.rubric.title}” y sus criterios?`)) return;
  await repository.deleteRubric(state.details.rubric.id);
  toast('Rúbrica eliminada.');
  await loadRubric();
}

async function handleAction(event) {
  const button = event.target.closest('[data-rubric-action]');
  if (!button || state.busy) return;
  const criterion = state.details?.criteria.find(item => item.id === button.dataset.criterionId);
  const actions = {
    'add-criterion': () => openCriterionDialog(null, button),
    'edit-rubric': () => openRubricDialog(button),
    'delete-rubric': removeRubric,
    'edit-criterion': () => openCriterionDialog(criterion, button),
    'delete-criterion': () => removeCriterion(criterion?.id),
    up: () => moveCriterion(criterion?.id, -1),
    down: () => moveCriterion(criterion?.id, 1)
  };
  try { await actions[button.dataset.rubricAction]?.(); }
  catch (error) {
    console.error(error);
    toast('No pude completar esa acción.', 'error');
  }
}

function setup() {
  $('#projectGrid').addEventListener('click', event => {
    const button = event.target.closest('[data-project-action="rubric"]');
    if (button) openWorkspace(button.dataset.projectId, button);
  });
  $('#closeRubricBtn').addEventListener('click', () => closeWorkspace());
  $('#newRubricBtn').addEventListener('click', event => openRubricDialog(event.currentTarget));
  $('#rubricContent').addEventListener('click', handleAction);
  $('#rubricForm').addEventListener('submit', saveRubric);
  $('#criterionForm').addEventListener('submit', saveCriterion);
  $('#rubricDialog').addEventListener('close', restoreFocus);
  $('#criterionDialog').addEventListener('close', restoreFocus);
  document.querySelectorAll('[data-rubric-cancel]').forEach(button =>
    button.addEventListener('click', () => $('#rubricDialog').close('cancel'))
  );
  document.querySelectorAll('[data-criterion-cancel]').forEach(button =>
    button.addEventListener('click', () => $('#criterionDialog').close('cancel'))
  );
  window.addEventListener('forja:viewchange', event => {
    if (event.detail.view !== 'proyectos') closeWorkspace({ restoreFocus: false });
  });
}

setup();
