import { buildBuenaventuraRequest } from './buenaventura-context.js';
import { BuenaventuraOrchestrator } from './buenaventura-orchestrator.js';
import { BuenaventuraReadPorts } from './buenaventura-read-ports.js';
import { ensureBuenaventuraShell } from './buenaventura-shell.js';
import { renderContextOptions, renderPreview, renderResponse } from './buenaventura-view.js';
import { createBuenaventuraProvider } from './providers/provider-factory.js';
import { defaultRelationship } from './relationship/relationship-contracts.js';
import { identityProfile } from './relationship/identity-profile.js';
import {
  observeAutonomy,
  setEvolutionEnabled
} from './relationship/relationship-policy.js';
import { RelationshipStore } from './relationship/relationship-store.js';

const $ = selector => document.querySelector(selector);
const readPorts = new BuenaventuraReadPorts();
const orchestrator = new BuenaventuraOrchestrator({
  provider: createBuenaventuraProvider()
});
const relationshipStore = new RelationshipStore();
const state = {
  projectId: null, options: [], fragments: [],
  returnFocus: null, abortController: null,
  relationship: defaultRelationship()
};

ensureBuenaventuraShell();
let relationshipReady;

function localDay() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function paintRelationship() {
  const profile = identityProfile(state.relationship.stage);
  $('#buenaventuraTitle').textContent = profile.name;
  if (state.projectId) $('#viewTitle').textContent = profile.name;
  $('#buenaventuraIdentitySummary').textContent =
    `${profile.name} mantiene un trato de usted y una voz ${profile.voice}.`;
  $('#buenaventuraEvolutionEnabled').checked = state.relationship.evolutionEnabled;
  $('#buenaventuraAutonomyRow').hidden = !state.relationship.evolutionEnabled;
  $('#askBuenaventuraBtn').textContent = `Consultar con ${profile.name}`;
}

async function loadRelationship() {
  if (!relationshipReady) {
    relationshipReady = relationshipStore.load()
      .catch(() => defaultRelationship())
      .then(value => {
        state.relationship = value;
        paintRelationship();
        return value;
      });
  }
  return relationshipReady;
}

function clearTransitionNotice() {
  $('#buenaventuraTransitionNotice').hidden = true;
  $('#buenaventuraTransitionNotice').textContent = '';
}

async function recordAutonomy({ response, request, family }) {
  const result = observeAutonomy(state.relationship, {
    family,
    task: request.task,
    day: localDay(),
    actionComplete: response.status === 'ok',
    activeEvaluation: request.constraints.activeEvaluation,
    technicalError: response.status !== 'ok'
  });
  if (JSON.stringify(result.relationship) !== JSON.stringify(state.relationship)) {
    state.relationship = await relationshipStore.save(result.relationship);
    paintRelationship();
  }
  if (result.transition) {
    $('#buenaventuraTransitionNotice').textContent = result.transition.message;
    $('#buenaventuraTransitionNotice').hidden = false;
  }
}

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

function resetExternalConsent() {
  $('#buenaventuraConsent').checked = false;
  $('#buenaventuraDeidentified').checked = false;
  $('#buenaventuraAdult').checked = false;
}

async function updatePreview() {
  resetExternalConsent();
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
    await loadRelationship();
    clearTransitionNotice();
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
    paintRelationship();
    $('#buenaventuraConsentRow').hidden = !orchestrator.provider.external;
    $('#buenaventuraDeidentifiedRow').hidden = !orchestrator.provider.external;
    $('#buenaventuraAdultRow').hidden = !orchestrator.provider.external;
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
    await loadRelationship();
    const autonomyFamily = $('#buenaventuraAutonomyFamily').value;
    const request = await buildBuenaventuraRequest({
      readPorts,
      projectId: state.projectId,
      task: $('#buenaventuraTask').value,
      identityStage: state.relationship.stage,
      selections: values,
      activeEvaluation: $('#buenaventuraEvaluation').checked,
      offline: !navigator.onLine,
      externalConsent: $('#buenaventuraConsent').checked,
      deidentified: $('#buenaventuraDeidentified').checked,
      adultUse: $('#buenaventuraAdult').checked
    });
    const response = await orchestrator.recommend(request, { signal: state.abortController.signal });
    $('#buenaventuraStatus').textContent = response.status === 'ok'
      ? 'Consulta procesada sin modificar sus datos.'
      : 'El proveedor no está disponible. FORJA continúa funcionando localmente.';
    renderResponse($('#buenaventuraResponse'), response);
    await recordAutonomy({ response, request, family: autonomyFamily });
  } catch (error) {
    if (error.name !== 'AbortError') setError(error.message);
  } finally {
    $('#buenaventuraAutonomyFamily').value = '';
    resetExternalConsent();
    setBusy(false);
  }
}

$('#projectGrid').addEventListener('click', event => {
  const button = event.target.closest('[data-project-action="buenaventura"]');
  if (button) open(button.dataset.projectId, button);
});
$('#closeBuenaventuraBtn').addEventListener('click', () => close());
$('#buenaventuraOptions').addEventListener('change', updatePreview);
$('#buenaventuraTask').addEventListener('change', resetExternalConsent);
$('#buenaventuraEvaluation').addEventListener('change', resetExternalConsent);
$('#buenaventuraEvolutionEnabled').addEventListener('change', async event => {
  await loadRelationship();
  state.relationship = await relationshipStore.save(
    setEvolutionEnabled(state.relationship, event.target.checked)
  );
  clearTransitionNotice();
  paintRelationship();
});
$('#clearBuenaventuraEvolution').addEventListener('click', async () => {
  const confirmed = window.confirm(
    '¿Eliminar el estado de evolución y volver a Profesor Buenaventura?'
  );
  if (!confirmed) return;
  state.relationship = await relationshipStore.clear();
  clearTransitionNotice();
  paintRelationship();
});
$('#buenaventuraForm').addEventListener('submit', submit);
window.addEventListener('forja:viewchange', event => {
  if (event.detail.view !== 'proyectos') close({ restoreFocus: false });
});

loadRelationship();
