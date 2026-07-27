import { AcademicRepository } from '../academic/academic-repository.js';
import { toast } from '../ui.js';
import {
  fillSourceDocuments,
  fillSourceForm,
  resetSourceForm,
  sourceBundle,
  syncSourceRequirements
} from './source-form.js';
import { renderSources, renderSourceSummary } from './sources-view.js';

const $ = selector => document.querySelector(selector);
const PAGE_SIZE = 60;
const repository = new AcademicRepository();
const state = {
  project: null,
  documents: [],
  editing: null,
  shown: 0,
  busy: false,
  returnFocus: null,
  dialogFocus: null
};

function setBusy(value) {
  state.busy = value;
  $('#sourceGrid').setAttribute('aria-busy', String(value));
  $('#newSourceBtn').disabled = value;
  $('#moreSourcesBtn').disabled = value;
  $('#sourceTypeFilter').disabled = value;
}

async function loadSources({ append = false } = {}) {
  if (!state.project || state.busy) return;
  setBusy(true);
  try {
    if (!append) state.shown = 0;
    const rows = await repository.listSources(state.project.id, {
      sourceType: $('#sourceTypeFilter').value || null,
      limit: PAGE_SIZE + 1,
      offset: state.shown
    });
    const visible = rows.slice(0, PAGE_SIZE);
    renderSources($('#sourceGrid'), visible, { append });
    state.shown += visible.length;
    const hasMore = rows.length > PAGE_SIZE;
    $('#moreSourcesBtn').hidden = !hasMore;
    renderSourceSummary(state.shown, hasMore);
  } catch (error) {
    console.error(error);
    toast('No pude cargar las fuentes del proyecto.', 'error');
  } finally {
    setBusy(false);
  }
}

async function openWorkspace(projectId, trigger) {
  try {
    const [project, documents] = await Promise.all([
      repository.getProject(projectId),
      repository.listSourceDocuments(projectId)
    ]);
    state.project = project;
    state.documents = documents;
    state.returnFocus = trigger;
    fillSourceDocuments(documents);
    $('#sourceProjectContext').textContent = project.title;
    $('#projectsOverview').hidden = true;
    $('#sourceWorkspace').hidden = false;
    $('#viewTitle').textContent = 'Fuentes académicas';
    await loadSources();
    $('#closeSourcesBtn').focus({ preventScroll: true });
  } catch (error) {
    console.error(error);
    toast('No pude abrir las fuentes de ese proyecto.', 'error');
  }
}

function closeWorkspace({ restoreFocus = true } = {}) {
  if (!state.project) return;
  $('#sourceWorkspace').hidden = true;
  $('#projectsOverview').hidden = false;
  $('#viewTitle').textContent = 'Proyectos académicos';
  state.project = null;
  state.documents = [];
  state.editing = null;
  if (restoreFocus) state.returnFocus?.focus({ preventScroll: true });
  state.returnFocus = null;
}

function openCreate(trigger) {
  state.editing = null;
  state.dialogFocus = trigger;
  resetSourceForm();
  $('#sourceDialogTitle').textContent = 'Añadir fuente';
  $('#saveSourceBtn').textContent = 'Guardar fuente';
  $('#sourceDialog').showModal();
  $('#sourceTitle').focus();
}

async function openEdit(sourceId, trigger) {
  try {
    state.editing = await repository.getSourceDetails(sourceId);
    state.dialogFocus = trigger;
    fillSourceForm(state.editing);
    $('#sourceDialogTitle').textContent = 'Editar fuente';
    $('#saveSourceBtn').textContent = 'Guardar cambios';
    $('#sourceDialog').showModal();
    $('#sourceTitle').focus();
  } catch (error) {
    console.error(error);
    toast('Esa fuente ya no está disponible.', 'error');
  }
}

function closeDialog() {
  $('#sourceDialog').close('cancel');
}

function restoreDialogFocus() {
  state.dialogFocus?.focus({ preventScroll: true });
  state.dialogFocus = null;
}

async function saveSource(event) {
  event.preventDefault();
  if (!$('#sourceForm').reportValidity()) return;
  const errorNode = $('#sourceFormError');
  errorNode.hidden = true;
  $('#saveSourceBtn').disabled = true;
  try {
    const bundle = sourceBundle(state.project.id, state.editing);
    if (state.editing) await repository.updateSourceBundle(bundle);
    else await repository.createSourceBundle(bundle);
    $('#sourceDialog').close('save');
    toast(state.editing ? 'Fuente actualizada.' : 'Fuente añadida.');
    state.editing = null;
    await loadSources();
  } catch (error) {
    errorNode.textContent = error.message;
    errorNode.hidden = false;
  } finally {
    $('#saveSourceBtn').disabled = false;
  }
}

async function removeSource(sourceId) {
  const details = await repository.getSourceDetails(sourceId).catch(() => null);
  if (!details) return toast('Esa fuente ya no existe.', 'error');
  if (!window.confirm(`¿Eliminar la fuente “${details.source.title}”?`)) return;
  try {
    await repository.deleteSource(sourceId);
    toast('Fuente eliminada sin borrar el documento de la Biblioteca.');
    await loadSources();
  } catch (error) {
    console.error(error);
    toast('No pude eliminar la fuente.', 'error');
  }
}

async function handleProjectAction(event) {
  const button = event.target.closest('[data-project-action="sources"]');
  if (button) await openWorkspace(button.dataset.projectId, button);
}

async function handleSourceAction(event) {
  const button = event.target.closest('[data-source-action]');
  if (!button) return;
  if (button.dataset.sourceAction === 'edit') {
    await openEdit(button.dataset.sourceId, button);
  }
  if (button.dataset.sourceAction === 'delete') {
    await removeSource(button.dataset.sourceId);
  }
}

function setup() {
  $('#projectGrid').addEventListener('click', handleProjectAction);
  $('#closeSourcesBtn').addEventListener('click', () => closeWorkspace());
  $('#newSourceBtn').addEventListener('click', event => openCreate(event.currentTarget));
  $('#sourceGrid').addEventListener('click', handleSourceAction);
  $('#sourceTypeFilter').addEventListener('change', () => loadSources());
  $('#moreSourcesBtn').addEventListener('click', () => loadSources({ append: true }));
  $('#sourceType').addEventListener('change', syncSourceRequirements);
  $('#sourceForm').addEventListener('submit', saveSource);
  $('#sourceDialog').addEventListener('close', restoreDialogFocus);
  document.querySelectorAll('[data-source-cancel]').forEach(button =>
    button.addEventListener('click', closeDialog)
  );
  window.addEventListener('forja:viewchange', event => {
    if (event.detail.view !== 'proyectos') closeWorkspace({ restoreFocus: false });
  });
}

setup();

