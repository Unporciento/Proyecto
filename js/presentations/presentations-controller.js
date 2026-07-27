import { AcademicRepository } from '../academic/academic-repository.js';
import {
  buildNexusPackage,
  makePresentationBundle
} from '../academic/presentation-model.js';
import { toast } from '../ui.js';
import { ensurePresentationDialogs } from './presentation-shell.js';
import { fillPresentationChoices, renderPresentation } from './presentation-view.js';

const $ = selector => document.querySelector(selector);
const repository = new AcademicRepository();
const presentations = repository.presentations();
const state = {
  project: null, details: null, options: null, editing: null,
  returnFocus: null, dialogFocus: null
};

function ids(key) {
  return `${key.split(':')[0]}_${crypto.randomUUID()}`;
}

function linked(slideId, type, kind) {
  const relations = state.details?.relations.filter(item =>
    item.fromId === slideId && item.type === type
  ) || [];
  const allowed = new Set(state.options[kind].map(item => item.id));
  return relations.map(item => item.toId).filter(id => allowed.has(id));
}

function input(overrides = {}) {
  const value = state.details?.presentation;
  return {
    projectId: state.project.id,
    title: value?.title || '',
    objective: value?.data.objective || '',
    audience: value?.data.audience || '',
    state: value?.status || 'draft',
    slides: state.details?.slides.map(slide => ({
      id: slide.id,
      title: slide.title,
      content: slide.data.content,
      speakerNotes: slide.data.speakerNotes,
      state: slide.status,
      sectionIds: linked(slide.id, 'derived_from', 'sections'),
      evidenceIds: linked(slide.id, 'derived_from', 'evidence'),
      sourceIds: linked(slide.id, 'cites', 'sources')
    })) || [],
    ...overrides
  };
}

async function persist(value) {
  const bundle = makePresentationBundle(value, {
    existing: state.details,
    ids
  });
  state.details = state.details
    ? await presentations.save(bundle, { existing: true })
    : await presentations.save(bundle);
  renderPresentation($('#presentationContent'), state.details);
}

async function load() {
  [state.details, state.options] = await Promise.all([
    presentations.get(state.project.id),
    presentations.options(state.project.id)
  ]);
  renderPresentation($('#presentationContent'), state.details);
  $('#newPresentationBtn').hidden = Boolean(state.details);
}

async function openWorkspace(projectId, trigger) {
  try {
    state.project = await repository.getProject(projectId);
    state.returnFocus = trigger;
    $('#presentationProjectContext').textContent = state.project.title;
    $('#projectsOverview').hidden = true;
    $('#presentationWorkspace').hidden = false;
    $('#viewTitle').textContent = 'Presentación académica';
    await load();
    $('#closePresentationBtn').focus({ preventScroll: true });
  } catch (error) {
    console.error(error);
    toast('No pude abrir la presentación.', 'error');
  }
}

function closeWorkspace() {
  if (!state.project) return;
  $('#presentationWorkspace').hidden = true;
  $('#projectsOverview').hidden = false;
  $('#viewTitle').textContent = 'Proyectos académicos';
  state.project = null;
  state.returnFocus?.focus({ preventScroll: true });
  state.returnFocus = null;
}

function openPresentationDialog(trigger) {
  state.dialogFocus = trigger;
  const value = state.details?.presentation;
  $('#presentationTitle').value = value?.title || '';
  $('#presentationObjective').value = value?.data.objective || '';
  $('#presentationAudience').value = value?.data.audience || '';
  $('#presentationState').value = value?.status || 'draft';
  $('#presentationFormError').hidden = true;
  $('#presentationDialogTitle').textContent = value ? 'Editar presentación' : 'Crear presentación';
  $('#presentationDialog').showModal();
  $('#presentationTitle').focus();
}

function openSlideDialog(slide, trigger) {
  state.editing = slide;
  state.dialogFocus = trigger;
  $('#slideTitle').value = slide?.title || '';
  $('#slideContent').value = slide?.data.content || '';
  $('#slideNotes').value = slide?.data.speakerNotes || '';
  $('#slideState').value = slide?.status || 'draft';
  fillPresentationChoices(
    $('#slideSectionChoices'), state.options.sections,
    slide ? linked(slide.id, 'derived_from', 'sections') : []
  );
  fillPresentationChoices(
    $('#slideEvidenceChoices'), state.options.evidence,
    slide ? linked(slide.id, 'derived_from', 'evidence') : []
  );
  fillPresentationChoices(
    $('#slideSourceChoices'), state.options.sources,
    slide ? linked(slide.id, 'cites', 'sources') : []
  );
  $('#slideFormError').hidden = true;
  $('#slideDialogTitle').textContent = slide ? 'Editar diapositiva' : 'Añadir diapositiva';
  $('#slideDialog').showModal();
  $('#slideTitle').focus();
}

function checked(selector) {
  return [...document.querySelectorAll(`${selector} input:checked`)].map(item => item.value);
}

async function savePresentation(event) {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  try {
    await persist(input({
      title: $('#presentationTitle').value,
      objective: $('#presentationObjective').value,
      audience: $('#presentationAudience').value,
      state: $('#presentationState').value
    }));
    $('#presentationDialog').close('save');
    toast('Presentación guardada.');
  } catch (error) {
    $('#presentationFormError').textContent = error.message;
    $('#presentationFormError').hidden = false;
  }
}

async function saveSlide(event) {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const slides = input().slides;
  const value = {
    id: state.editing?.id,
    title: $('#slideTitle').value,
    content: $('#slideContent').value,
    speakerNotes: $('#slideNotes').value,
    state: $('#slideState').value,
    sectionIds: checked('#slideSectionChoices'),
    evidenceIds: checked('#slideEvidenceChoices'),
    sourceIds: checked('#slideSourceChoices')
  };
  const index = state.editing
    ? slides.findIndex(item => item.id === state.editing.id)
    : slides.length;
  if (state.editing) slides[index] = value;
  else slides.push(value);
  try {
    await persist(input({ slides }));
    $('#slideDialog').close('save');
    state.editing = null;
    toast('Diapositiva guardada.');
  } catch (error) {
    $('#slideFormError').textContent = error.message;
    $('#slideFormError').hidden = false;
  }
}

function downloadPackage() {
  const payload = buildNexusPackage(state.project, state.details);
  const url = URL.createObjectURL(new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: 'application/json' }
  ));
  const link = document.createElement('a');
  link.href = url;
  link.download = `forja-nexus-${state.project.id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function action(event) {
  const button = event.target.closest('[data-presentation-action]');
  if (!button || !state.details) return;
  const slides = input().slides;
  const index = slides.findIndex(item => item.id === button.dataset.slideId);
  const name = button.dataset.presentationAction;
  if (name === 'add-slide') openSlideDialog(null, button);
  if (name === 'edit-presentation') openPresentationDialog(button);
  if (name === 'edit-slide') openSlideDialog(state.details.slides[index], button);
  if (['up', 'down'].includes(name)) {
    const to = index + (name === 'up' ? -1 : 1);
    if (index >= 0 && to >= 0 && to < slides.length) {
      [slides[index], slides[to]] = [slides[to], slides[index]];
      await persist(input({ slides }));
    }
  }
  if (name === 'delete-slide' && confirm(`¿Eliminar “${slides[index].title}”?`)) {
    slides.splice(index, 1);
    await persist(input({ slides }));
  }
  if (name === 'export-package') downloadPackage();
  if (name === 'delete-presentation'
    && confirm(`¿Eliminar la presentación “${state.details.presentation.title}”?`)) {
    await presentations.delete(state.details.presentation.id);
    state.details = null;
    await load();
    toast('Presentación eliminada.');
  }
}

function setup() {
  ensurePresentationDialogs();
  $('#projectGrid').addEventListener('click', event => {
    const button = event.target.closest('[data-project-action="presentation"]');
    if (button) openWorkspace(button.dataset.projectId, button);
  });
  $('#closePresentationBtn').addEventListener('click', closeWorkspace);
  $('#newPresentationBtn').addEventListener('click', event =>
    openPresentationDialog(event.currentTarget)
  );
  $('#presentationContent').addEventListener('click', action);
  $('#presentationForm').addEventListener('submit', savePresentation);
  $('#slideForm').addEventListener('submit', saveSlide);
  document.querySelectorAll('[data-presentation-cancel]').forEach(button =>
    button.addEventListener('click', () => $('#presentationDialog').close('cancel'))
  );
  document.querySelectorAll('[data-slide-cancel]').forEach(button =>
    button.addEventListener('click', () => $('#slideDialog').close('cancel'))
  );
  window.addEventListener('forja:viewchange', event => {
    if (event.detail.view !== 'proyectos') closeWorkspace();
  });
}

setup();
