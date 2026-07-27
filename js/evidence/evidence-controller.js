import { AcademicRepository } from '../academic/academic-repository.js';
import { toast } from '../ui.js';
import {
  evidenceBundle,
  fillEvidenceForm,
  fillEvidenceOptions,
  syncEvidenceRequirements
} from './evidence-form.js';
import { renderEvidence, renderEvidenceSummary } from './evidence-view.js';

const $ = selector => document.querySelector(selector);
const PAGE_SIZE = 60;
const repository = new AcademicRepository();
const state = {
  project: null,
  options: { sources: [], criteria: [], documents: [] },
  editing: null,
  shown: 0,
  busy: false,
  returnFocus: null,
  dialogFocus: null
};

function setBusy(value) {
  state.busy = value;
  $('#evidenceGrid').setAttribute('aria-busy', String(value));
  $('#newEvidenceBtn').disabled = value
    || !state.options.sources.length
    || !state.options.criteria.length;
  $('#moreEvidenceBtn').disabled = value;
  $('#evidenceTypeFilter').disabled = value;
  $('#evidenceStateFilter').disabled = value;
}

async function loadEvidence({ append = false } = {}) {
  if (!state.project || state.busy) return;
  setBusy(true);
  try {
    if (!append) state.shown = 0;
    const rows = await repository.listEvidenceSummaries(state.project.id, {
      evidenceType: $('#evidenceTypeFilter').value || null,
      state: $('#evidenceStateFilter').value || null,
      limit: PAGE_SIZE + 1,
      offset: state.shown
    });
    const visible = rows.slice(0, PAGE_SIZE);
    renderEvidence($('#evidenceGrid'), visible, state.options, { append });
    state.shown += visible.length;
    const hasMore = rows.length > PAGE_SIZE;
    $('#moreEvidenceBtn').hidden = !hasMore;
    renderEvidenceSummary(state.shown, hasMore);
  } catch (error) {
    console.error(error);
    toast('No pude cargar las evidencias.', 'error');
  } finally {
    setBusy(false);
  }
}

async function openWorkspace(projectId, trigger) {
  try {
    const [project, options] = await Promise.all([
      repository.getProject(projectId),
      repository.getEvidenceOptions(projectId)
    ]);
    state.project = project;
    state.options = options;
    state.returnFocus = trigger;
    fillEvidenceOptions(options);
    $('#evidenceProjectContext').textContent = project.title;
    $('#projectsOverview').hidden = true;
    $('#evidenceWorkspace').hidden = false;
    $('#viewTitle').textContent = 'Evidencias académicas';
    await loadEvidence();
    if (!options.sources.length || !options.criteria.length) {
      toast('Necesitas al menos una fuente y un criterio de rúbrica.', 'error');
    }
    $('#closeEvidenceBtn').focus({ preventScroll: true });
  } catch (error) {
    console.error(error);
    toast('No pude abrir las evidencias de ese proyecto.', 'error');
  }
}

function closeWorkspace({ restoreFocus = true } = {}) {
  if (!state.project) return;
  $('#evidenceWorkspace').hidden = true;
  $('#projectsOverview').hidden = false;
  $('#viewTitle').textContent = 'Proyectos académicos';
  state.project = null;
  state.editing = null;
  if (restoreFocus) state.returnFocus?.focus({ preventScroll: true });
  state.returnFocus = null;
}

function openCreate(trigger) {
  state.editing = null;
  state.dialogFocus = trigger;
  fillEvidenceForm(state.options);
  $('#evidenceDialogTitle').textContent = 'Añadir evidencia';
  $('#saveEvidenceBtn').textContent = 'Guardar evidencia';
  $('#evidenceDialog').showModal();
  $('#evidenceTitle').focus();
}

async function openEdit(id, trigger) {
  try {
    state.editing = await repository.getEvidenceDetails(id);
    state.dialogFocus = trigger;
    fillEvidenceForm(state.options, state.editing);
    $('#evidenceDialogTitle').textContent = 'Editar evidencia';
    $('#saveEvidenceBtn').textContent = 'Guardar cambios';
    $('#evidenceDialog').showModal();
    $('#evidenceTitle').focus();
  } catch (error) {
    console.error(error);
    toast('Esa evidencia ya no está disponible.', 'error');
  }
}

function restoreDialogFocus() {
  state.dialogFocus?.focus({ preventScroll: true });
  state.dialogFocus = null;
}

async function saveEvidence(event) {
  event.preventDefault();
  if (!$('#evidenceForm').reportValidity()) return;
  $('#saveEvidenceBtn').disabled = true;
  try {
    const bundle = evidenceBundle(state.project.id, state.editing);
    if (state.editing) await repository.updateEvidenceBundle(bundle);
    else await repository.createEvidenceBundle(bundle);
    $('#evidenceDialog').close('save');
    toast(state.editing ? 'Evidencia actualizada.' : 'Evidencia añadida.');
    state.editing = null;
    await loadEvidence();
  } catch (error) {
    $('#evidenceFormError').textContent = error.message;
    $('#evidenceFormError').hidden = false;
  } finally {
    $('#saveEvidenceBtn').disabled = false;
  }
}

async function removeEvidence(id) {
  const details = await repository.getEvidenceDetails(id).catch(() => null);
  if (!details || !confirm(`¿Eliminar la evidencia “${details.evidence.title}”?`)) return;
  try {
    await repository.deleteEvidence(id);
    toast('Evidencia eliminada sin borrar documentos, fuentes ni criterios.');
    await loadEvidence();
  } catch (error) {
    console.error(error);
    toast('No pude eliminar la evidencia.', 'error');
  }
}

async function handleAction(event) {
  const button = event.target.closest('[data-evidence-action]');
  if (!button) return;
  if (button.dataset.evidenceAction === 'edit') {
    await openEdit(button.dataset.evidenceId, button);
  }
  if (button.dataset.evidenceAction === 'delete') {
    await removeEvidence(button.dataset.evidenceId);
  }
}

function setup() {
  $('#projectGrid').addEventListener('click', event => {
    const button = event.target.closest('[data-project-action="evidence"]');
    if (button) openWorkspace(button.dataset.projectId, button);
  });
  $('#closeEvidenceBtn').addEventListener('click', () => closeWorkspace());
  $('#newEvidenceBtn').addEventListener('click', event => openCreate(event.currentTarget));
  $('#evidenceGrid').addEventListener('click', handleAction);
  $('#evidenceTypeFilter').addEventListener('change', () => loadEvidence());
  $('#evidenceStateFilter').addEventListener('change', () => loadEvidence());
  $('#moreEvidenceBtn').addEventListener('click', () => loadEvidence({ append: true }));
  $('#evidenceType').addEventListener('change', syncEvidenceRequirements);
  $('#evidenceForm').addEventListener('submit', saveEvidence);
  $('#evidenceDialog').addEventListener('close', restoreDialogFocus);
  document.querySelectorAll('[data-evidence-cancel]').forEach(button =>
    button.addEventListener('click', () => $('#evidenceDialog').close('cancel'))
  );
  window.addEventListener('forja:viewchange', event => {
    if (event.detail.view !== 'proyectos') closeWorkspace({ restoreFocus: false });
  });
}

setup();
