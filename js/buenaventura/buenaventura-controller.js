import { buildBuenaventuraRequest } from './buenaventura-context.js';
import { BuenaventuraOrchestrator } from './buenaventura-orchestrator.js';
import { BuenaventuraReadPorts } from './buenaventura-read-ports.js';
import { ensureBuenaventuraShell } from './buenaventura-shell.js';
import { renderContextOptions, renderPreview, renderResponse } from './buenaventura-view.js';

const $ = selector => document.querySelector(selector);
const readPorts = new BuenaventuraReadPorts();
const orchestrator = new BuenaventuraOrchestrator();
const state = {
  projectId: null, options: [], fragments: [],
  returnFocus: null, abortController: null
};

ensureBuenaventuraShell();

function selections() {
  return [...$('#buenaventuraOptions').querySelectorAll('input:checked')]
    .map(input => ({ module: input.dataset.module, id: input.value }));
}

function setError(message = '') {
  $('#buenaventuraFormError').textContent = message;
  $('#buenaventuraFormError').hidden = !message;
}

function setBusy(busy) {
  $('#askBuenaventuraBtn').disabled = busy;
  $('#buenaventuraForm').setAttribute('aria-busy', String(busy));
}

async function updatePreview() {
  const values = selections();
  $('#buenaventuraOptions').querySelectorAll('input:not(:checked)').forEach(input => {
    input.disabled = values.length >= 4;
  });
  try {
    state.fragments = values.length ? await readPorts.fragments(state.projectId, values) : [];
    renderPreview($('#buenaventuraPreview'), state.fragments);
    const chars = state.fragments.reduce((sum, item) => sum + item.excerpt.length, 0);
    $('#buenaventuraBudget').textContent =
      `${new Intl.NumberFormat('es-CL').format(chars)} / 8.000`;
    setError();
  } catch (error) {
    state.fragments = [];
    renderPreview($('#buenaventuraPreview'), []);
    setError(error.message);
  }
}

async function open(projectId, trigger) {
  setBusy(true);
  try {
    state.projectId = projectId;
    state.returnFocus = trigger;
    state.options = await readPorts.list(projectId);
    state.fragments = [];
    renderContextOptions($('#buenaventuraOptions'), state.options);
    const title = trigger.closest('.project-card')?.querySelector('h2')?.textContent || 'Proyecto';
    $('#buenaventuraProjectContext').textContent =
      `${title}. El contexto no se conserva al cerrar esta vista.`;
    $('#projectsOverview').hidden = true;
    $('#buenaventuraWorkspace').hidden = false;
    $('#viewTitle').textContent = 'Profesor Buenaventura';
    $('#buenaventuraConsentRow').hidden = !orchestrator.provider.external;
    $('#buenaventuraTask').focus({ preventScroll: true });
    await updatePreview();
  } catch (error) {
    setError(error.message);
  } finally {
    setBusy(false);
  }
}

function close({ restoreFocus = true } = {}) {
  if (!state.projectId) return;
  state.abortController?.abort();
  $('#buenaventuraWorkspace').hidden = true;
  $('#projectsOverview').hidden = false;
  $('#viewTitle').textContent = 'Proyectos académicos';
  $('#buenaventuraForm').reset();
  $('#buenaventuraResponse').replaceChildren();
  $('#buenaventuraStatus').textContent = 'Aún no se ha enviado ninguna consulta.';
  state.projectId = null;
  state.options = [];
  state.fragments = [];
  if (restoreFocus) state.returnFocus?.focus({ preventScroll: true });
  state.returnFocus = null;
}

async function submit(event) {
  event.preventDefault();
  setError();
  const values = selections();
  if (!values.length) return setError('Seleccione al menos un fragmento.');
  setBusy(true);
  state.abortController?.abort();
  state.abortController = new AbortController();
  try {
    const request = await buildBuenaventuraRequest({
      readPorts,
      projectId: state.projectId,
      task: $('#buenaventuraTask').value,
      selections: values,
      activeEvaluation: $('#buenaventuraEvaluation').checked,
      offline: !navigator.onLine,
      externalConsent: $('#buenaventuraConsent').checked
    });
    $('#buenaventuraStatus').textContent = 'Consulta procesada sin modificar sus datos.';
    const response = await orchestrator.recommend(request, { signal: state.abortController.signal });
    renderResponse($('#buenaventuraResponse'), response);
  } catch (error) {
    if (error.name !== 'AbortError') setError(error.message);
  } finally {
    setBusy(false);
  }
}

$('#projectGrid').addEventListener('click', event => {
  const button = event.target.closest('[data-project-action="buenaventura"]');
  if (button) open(button.dataset.projectId, button);
});
$('#closeBuenaventuraBtn').addEventListener('click', () => close());
$('#buenaventuraOptions').addEventListener('change', updatePreview);
$('#buenaventuraForm').addEventListener('submit', submit);
window.addEventListener('forja:viewchange', event => {
  if (event.detail.view !== 'proyectos') close({ restoreFocus: false });
});
