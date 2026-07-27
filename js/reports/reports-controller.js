import { AcademicRepository } from '../academic/academic-repository.js';
import { makeReportBundle } from '../academic/report-model.js';
import { toast } from '../ui.js';
import { ensureReportDialogs } from './report-shell.js';
import { fillChoices, renderReport } from './report-view.js';

const $ = selector => document.querySelector(selector);
const repository = new AcademicRepository();
const reports = repository.reports();
const state = {
  project: null, details: null, options: null, editing: null,
  returnFocus: null, dialogFocus: null, timer: null, saving: Promise.resolve()
};

function ids(key) {
  return `${key.split(':')[0]}_${crypto.randomUUID()}`;
}

function linked(sectionId, type) {
  return state.details?.relations.filter(item =>
    item.fromId === sectionId && item.type === type
  ).map(item => item.toId) || [];
}

function reportInput(overrides = {}) {
  const report = state.details?.report;
  return {
    projectId: state.project.id,
    title: report?.title || '',
    abstract: report?.data.abstract || '',
    language: report?.data.language || 'es',
    state: report?.status || 'draft',
    sections: state.details?.sections.map(section => ({
      id: section.id,
      title: section.title,
      body: section.data.body,
      evidenceIds: linked(section.id, 'derived_from'),
      sourceIds: linked(section.id, 'cites')
    })) || [],
    ...overrides
  };
}

async function persist(input) {
  const bundle = makeReportBundle(input, {
    existing: state.details,
    ids
  });
  state.details = state.details
    ? await reports.save(bundle, { existing: true })
    : await reports.save(bundle);
  renderReport($('#reportContent'), state.details, state.options);
}

async function load() {
  [state.details, state.options] = await Promise.all([
    reports.get(state.project.id),
    reports.options(state.project.id)
  ]);
  renderReport($('#reportContent'), state.details, state.options);
  $('#newReportBtn').hidden = Boolean(state.details);
}

async function openWorkspace(projectId, trigger) {
  try {
    state.project = await repository.getProject(projectId);
    state.returnFocus = trigger;
    $('#reportProjectContext').textContent = state.project.title;
    $('#projectsOverview').hidden = true;
    $('#reportWorkspace').hidden = false;
    $('#viewTitle').textContent = 'Informe académico';
    await load();
    $('#closeReportBtn').focus({ preventScroll: true });
  } catch (error) {
    console.error(error);
    toast('No pude abrir el informe.', 'error');
  }
}

function closeWorkspace() {
  if (!state.project) return;
  clearTimeout(state.timer);
  $('#reportWorkspace').hidden = true;
  $('#projectsOverview').hidden = false;
  $('#viewTitle').textContent = 'Proyectos académicos';
  state.project = null;
  state.returnFocus?.focus({ preventScroll: true });
  state.returnFocus = null;
}

function openReportDialog(trigger) {
  state.dialogFocus = trigger;
  const report = state.details?.report;
  $('#reportTitle').value = report?.title || '';
  $('#reportAbstract').value = report?.data.abstract || '';
  $('#reportLanguage').value = report?.data.language || 'es';
  $('#reportState').value = report?.status || 'draft';
  $('#reportFormError').hidden = true;
  $('#reportDialogTitle').textContent = report ? 'Editar informe' : 'Crear informe';
  $('#reportDialog').showModal();
  $('#reportTitle').focus();
}

function openSectionDialog(section, trigger) {
  state.editing = section;
  state.dialogFocus = trigger;
  $('#sectionTitle').value = section?.title || '';
  $('#sectionBody').value = section?.data.body || '';
  fillChoices(
    $('#sectionEvidenceChoices'), state.options.evidence,
    section ? linked(section.id, 'derived_from') : []
  );
  fillChoices(
    $('#sectionSourceChoices'), state.options.sources,
    section ? linked(section.id, 'cites') : []
  );
  $('#sectionFormError').hidden = true;
  $('#sectionDialogTitle').textContent = section ? 'Editar sección' : 'Añadir sección';
  $('#sectionDialog').showModal();
  $('#sectionTitle').focus();
}

function checked(selector) {
  return [...document.querySelectorAll(`${selector} input:checked`)].map(input => input.value);
}

async function saveReport(event) {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  try {
    await persist(reportInput({
      title: $('#reportTitle').value,
      abstract: $('#reportAbstract').value,
      language: $('#reportLanguage').value,
      state: $('#reportState').value
    }));
    $('#reportDialog').close('save');
    $('#newReportBtn').hidden = true;
    toast('Informe guardado.');
  } catch (error) {
    $('#reportFormError').textContent = error.message;
    $('#reportFormError').hidden = false;
  }
}

async function saveSection(event) {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const sections = reportInput().sections;
  const value = {
    id: state.editing?.id,
    title: $('#sectionTitle').value,
    body: $('#sectionBody').value,
    evidenceIds: checked('#sectionEvidenceChoices'),
    sourceIds: checked('#sectionSourceChoices')
  };
  const index = state.editing
    ? sections.findIndex(item => item.id === state.editing.id)
    : sections.length;
  if (state.editing) sections[index] = value;
  else sections.push(value);
  try {
    await persist(reportInput({ sections }));
    $('#sectionDialog').close('save');
    state.editing = null;
    toast('Sección guardada.');
  } catch (error) {
    $('#sectionFormError').textContent = error.message;
    $('#sectionFormError').hidden = false;
  }
}

function autosave(sectionId, body) {
  const section = state.details.sections.find(item => item.id === sectionId);
  section.data.body = body;
  $('#reportSaveState').textContent = 'Cambios pendientes…';
  clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    state.saving = state.saving.then(async () => {
      $('#reportSaveState').textContent = 'Guardando…';
      await persist(reportInput());
    }).catch(error => {
      console.error(error);
      $('#reportSaveState').textContent = 'No se pudo guardar. Revisa el contenido.';
    });
  }, 650);
}

async function action(event) {
  const button = event.target.closest('[data-report-action]');
  if (!button || !state.details) return;
  const sections = reportInput().sections;
  const index = sections.findIndex(item => item.id === button.dataset.sectionId);
  if (button.dataset.reportAction === 'add-section') openSectionDialog(null, button);
  if (button.dataset.reportAction === 'edit-report') openReportDialog(button);
  if (button.dataset.reportAction === 'edit-section') {
    openSectionDialog(state.details.sections[index], button);
  }
  if (['up', 'down'].includes(button.dataset.reportAction)) {
    const to = index + (button.dataset.reportAction === 'up' ? -1 : 1);
    if (index >= 0 && to >= 0 && to < sections.length) {
      [sections[index], sections[to]] = [sections[to], sections[index]];
      await persist(reportInput({ sections }));
    }
  }
  if (button.dataset.reportAction === 'delete-section'
    && confirm(`¿Eliminar la sección “${sections[index].title}”?`)) {
    sections.splice(index, 1);
    await persist(reportInput({ sections }));
  }
  if (button.dataset.reportAction === 'toggle-final') {
    await persist(reportInput({
      state: state.details.report.status === 'final' ? 'draft' : 'final'
    }));
    toast(state.details.report.status === 'final' ? 'Informe marcado como final.' : 'Informe en borrador.');
  }
  if (button.dataset.reportAction === 'delete-report'
    && confirm(`¿Eliminar el informe “${state.details.report.title}”?`)) {
    await reports.delete(state.details.report.id);
    state.details = null;
    await load();
    toast('Informe eliminado.');
  }
}

function setup() {
  ensureReportDialogs();
  $('#projectGrid').addEventListener('click', event => {
    const button = event.target.closest('[data-project-action="report"]');
    if (button) openWorkspace(button.dataset.projectId, button);
  });
  $('#closeReportBtn').addEventListener('click', closeWorkspace);
  $('#newReportBtn').addEventListener('click', event => openReportDialog(event.currentTarget));
  $('#reportContent').addEventListener('click', action);
  $('#reportContent').addEventListener('input', event => {
    if (event.target.matches('[data-section-body]')) {
      autosave(event.target.dataset.sectionBody, event.target.value);
    }
  });
  $('#reportForm').addEventListener('submit', saveReport);
  $('#sectionForm').addEventListener('submit', saveSection);
  document.querySelectorAll('[data-report-cancel]').forEach(button =>
    button.addEventListener('click', () => $('#reportDialog').close('cancel'))
  );
  document.querySelectorAll('[data-section-cancel]').forEach(button =>
    button.addEventListener('click', () => $('#sectionDialog').close('cancel'))
  );
  ['#reportDialog', '#sectionDialog'].forEach(selector =>
    $(selector).addEventListener('close', () => state.dialogFocus?.focus())
  );
  window.addEventListener('forja:viewchange', event => {
    if (event.detail.view !== 'proyectos') closeWorkspace();
  });
}

setup();
