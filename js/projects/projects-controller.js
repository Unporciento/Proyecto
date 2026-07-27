import { AcademicRepository } from '../academic/academic-repository.js';
import { toast } from '../ui.js';
import {
  fillProjectForm,
  projectRecord,
  resetProjectForm
} from './project-form.js';
import {
  fillSubjectSelects,
  renderProjects,
  renderProjectSummary
} from './projects-view.js';

const $ = selector => document.querySelector(selector);
const PAGE_SIZE = 60;
const repository = new AcademicRepository();
const state = {
  subjects: [],
  shown: 0,
  busy: false,
  editing: null,
  returnFocus: null
};

function filters() {
  return {
    subjectId: $('#projectSubjectFilter').value || null,
    status: $('#projectStatusFilter').value || null
  };
}

function setBusy(value) {
  state.busy = value;
  $('#projectGrid').setAttribute('aria-busy', String(value));
  $('#newProjectBtn').disabled = value;
  $('#moreProjectsBtn').disabled = value;
  $('#projectSubjectFilter').disabled = value;
  $('#projectStatusFilter').disabled = value;
}

async function loadSubjects() {
  state.subjects = await repository.listSubjects();
  fillSubjectSelects(state.subjects);
}

async function loadProjects({ append = false } = {}) {
  if (state.busy) return;
  setBusy(true);
  try {
    if (!append) state.shown = 0;
    const rows = await repository.listProjects({
      ...filters(),
      limit: PAGE_SIZE + 1,
      offset: state.shown
    });
    const visible = rows.slice(0, PAGE_SIZE);
    const subjectNames = new Map(state.subjects.map(item => [item.id, item.name]));
    renderProjects($('#projectGrid'), visible, subjectNames, { append });
    state.shown += visible.length;
    const hasMore = rows.length > PAGE_SIZE;
    $('#moreProjectsBtn').hidden = !hasMore;
    renderProjectSummary(state.shown, hasMore);
  } catch (error) {
    console.error(error);
    toast('No pude cargar los proyectos académicos.', 'error');
  } finally {
    setBusy(false);
  }
}

function closeDialog() {
  $('#projectDialog').close('cancel');
}

function restoreDialogFocus() {
  state.returnFocus?.focus({ preventScroll: true });
  state.returnFocus = null;
}

function openCreate(trigger) {
  if (!state.subjects.length) {
    toast('Primero necesitas una asignatura.', 'error');
    return;
  }
  state.editing = null;
  state.returnFocus = trigger;
  resetProjectForm();
  $('#projectDialogTitle').textContent = 'Crear proyecto';
  $('#saveProjectBtn').textContent = 'Crear proyecto';
  $('#projectFormError').hidden = true;
  $('#projectDialog').showModal();
  $('#projectName').focus();
}

async function openEdit(projectId, trigger) {
  try {
    state.editing = await repository.getProject(projectId);
    state.returnFocus = trigger;
    fillProjectForm(state.editing);
    $('#projectDialogTitle').textContent = 'Editar proyecto';
    $('#saveProjectBtn').textContent = 'Guardar cambios';
    $('#projectFormError').hidden = true;
    $('#projectDialog').showModal();
    $('#projectName').focus();
  } catch (error) {
    console.error(error);
    toast('Ese proyecto ya no está disponible.', 'error');
  }
}

async function saveProject(event) {
  event.preventDefault();
  const form = $('#projectForm');
  if (!form.reportValidity()) return;
  const errorNode = $('#projectFormError');
  errorNode.hidden = true;
  $('#saveProjectBtn').disabled = true;
  try {
    const record = projectRecord(state.editing);
    if (state.editing) await repository.updateProject(record);
    else await repository.createProject(record);
    $('#projectDialog').close('save');
    toast(state.editing ? 'Proyecto actualizado.' : 'Proyecto creado.');
    state.editing = null;
    await loadProjects();
  } catch (error) {
    errorNode.textContent = error.message;
    errorNode.hidden = false;
  } finally {
    $('#saveProjectBtn').disabled = false;
  }
}

async function archiveProject(projectId) {
  try {
    await repository.archiveProject(projectId);
    toast('Proyecto archivado sin eliminar información.');
    await loadProjects();
  } catch (error) {
    console.error(error);
    toast('No pude archivar el proyecto.', 'error');
  }
}

async function deleteProject(projectId) {
  const project = await repository.getProject(projectId).catch(() => null);
  if (!project) return toast('Ese proyecto ya no existe.', 'error');
  const confirmed = window.confirm(
    `¿Eliminar “${project.title}”? Esta acción también elimina su contenido académico futuro y no se puede deshacer.`
  );
  if (!confirmed) return;
  try {
    await repository.deleteProject(projectId);
    toast('Proyecto eliminado.');
    await loadProjects();
  } catch (error) {
    console.error(error);
    toast('No pude eliminar el proyecto.', 'error');
  }
}

async function handleGridAction(event) {
  const button = event.target.closest('[data-project-action]');
  if (!button) return;
  const { projectAction, projectId } = button.dataset;
  if (projectAction === 'edit') await openEdit(projectId, button);
  if (projectAction === 'archive') await archiveProject(projectId);
  if (projectAction === 'delete') await deleteProject(projectId);
}

async function activate() {
  if (!state.subjects.length) await loadSubjects();
  await loadProjects();
}

function setup() {
  $('#newProjectBtn').addEventListener('click', event => openCreate(event.currentTarget));
  $('#projectForm').addEventListener('submit', saveProject);
  $('#projectDialog').addEventListener('close', restoreDialogFocus);
  document.querySelectorAll('[data-project-cancel]').forEach(button =>
    button.addEventListener('click', closeDialog)
  );
  $('#projectGrid').addEventListener('click', handleGridAction);
  $('#moreProjectsBtn').addEventListener('click', () => loadProjects({ append: true }));
  $('#projectSubjectFilter').addEventListener('change', () => loadProjects());
  $('#projectStatusFilter').addEventListener('change', () => loadProjects());
  window.addEventListener('forja:viewchange', event => {
    if (event.detail.view === 'proyectos') activate();
  });
  if (location.hash === '#proyectos') activate();
}

setup();
