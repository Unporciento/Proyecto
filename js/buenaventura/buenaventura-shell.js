export function ensureBuenaventuraShell() {
  let shell = document.querySelector('#buenaventuraWorkspace');
  if (shell) return shell;
  shell = document.createElement('div');
  shell.id = 'buenaventuraWorkspace';
  shell.className = 'buenaventura-workspace';
  shell.hidden = true;
  shell.setAttribute('aria-labelledby', 'buenaventuraTitle');
  shell.innerHTML = `
    <button class="text-btn buenaventura-back" id="closeBuenaventuraBtn" type="button">← Volver a proyectos</button>
    <div class="page-intro buenaventura-intro">
      <div>
        <span class="eyebrow">OBSERVE · RECOMMEND</span>
        <h1 id="buenaventuraTitle">Profesor Buenaventura</h1>
        <p id="buenaventuraProjectContext"></p>
      </div>
    </div>
    <div class="buenaventura-layout">
      <form id="buenaventuraForm" class="panel buenaventura-form">
        <label>Tarea
          <select id="buenaventuraTask">
            <option value="explain">Explicar</option>
            <option value="review">Revisar</option>
            <option value="compare">Comparar contexto</option>
            <option value="suggest">Sugerir siguiente paso</option>
            <option value="question">Formular una pregunta</option>
          </select>
        </label>
        <fieldset>
          <legend>Contexto seleccionado explícitamente</legend>
          <p>Puede elegir hasta cuatro fragmentos del mismo proyecto. Comparar admite módulos distintos.</p>
          <div id="buenaventuraOptions" class="buenaventura-options"></div>
        </fieldset>
        <label class="check-row">
          <input id="buenaventuraEvaluation" type="checkbox">
          <span>FORJA confirma que existe una evaluación activa</span>
        </label>
        <label class="check-row" id="buenaventuraConsentRow" hidden>
          <input id="buenaventuraConsent" type="checkbox">
          <span>Autorizo enviar esta vista previa a Google Gemini Free Tier. Google puede usarla y su respuesta para mejorar sus productos.</span>
        </label>
        <label class="check-row" id="buenaventuraDeidentifiedRow" hidden>
          <input id="buenaventuraDeidentified" type="checkbox">
          <span>Confirmo que retiré nombres y cualquier dato personal, sensible o confidencial.</span>
        </label>
        <label class="check-row" id="buenaventuraAdultRow" hidden>
          <input id="buenaventuraAdult" type="checkbox">
          <span>Confirmo que soy mayor de 18 años y uso esta función con fines profesionales.</span>
        </label>
        <p id="buenaventuraFormError" class="form-error" role="alert" hidden></p>
        <button class="primary-btn" id="askBuenaventuraBtn" type="submit">Consultar con este contexto</button>
      </form>
      <div class="buenaventura-review">
        <section class="panel" aria-labelledby="buenaventuraPreviewTitle">
          <div class="buenaventura-panel-head">
            <h2 id="buenaventuraPreviewTitle">Vista previa exacta</h2>
            <strong id="buenaventuraBudget">0 / 8.000</strong>
          </div>
          <div id="buenaventuraPreview" class="buenaventura-preview">
            <p>Seleccione contexto para revisar qué se utilizará.</p>
          </div>
        </section>
        <section class="panel buenaventura-answer" aria-labelledby="buenaventuraAnswerTitle">
          <h2 id="buenaventuraAnswerTitle">Respuesta</h2>
          <p id="buenaventuraStatus">Aún no se ha enviado ninguna consulta.</p>
          <div id="buenaventuraResponse" aria-live="polite"></div>
        </section>
      </div>
    </div>`;
  document.querySelector('#projectsOverview').after(shell);
  return shell;
}
