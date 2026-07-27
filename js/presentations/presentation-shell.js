export function ensurePresentationDialogs() {
  if (document.querySelector('#presentationDialog')) return;
  const template = document.createElement('template');
  template.innerHTML = `
    <dialog id="presentationDialog"><form id="presentationForm" class="modal-card presentation-form">
      <button class="modal-close" type="button" data-presentation-cancel aria-label="Cerrar">×</button>
      <span class="eyebrow">PRESENTACIÓN ACADÉMICA</span><h2 id="presentationDialogTitle">Crear presentación</h2>
      <label>Título<input id="presentationTitle" maxlength="500" required></label>
      <label>Objetivo<textarea id="presentationObjective" maxlength="20000" rows="4"></textarea></label>
      <div class="presentation-form-grid"><label>Público<input id="presentationAudience" maxlength="500" placeholder="Ej.: comisión evaluadora"></label><label>Estado<select id="presentationState"><option value="draft">Borrador</option><option value="ready">Lista</option><option value="final">Final</option></select></label></div>
      <p class="form-error" id="presentationFormError" role="alert" hidden></p>
      <div class="modal-actions"><button class="secondary-btn" type="button" data-presentation-cancel>Cancelar</button><button class="primary-btn">Guardar presentación</button></div>
    </form></dialog>
    <dialog id="slideDialog"><form id="slideForm" class="modal-card presentation-form">
      <button class="modal-close" type="button" data-slide-cancel aria-label="Cerrar">×</button>
      <span class="eyebrow">DIAPOSITIVA</span><h2 id="slideDialogTitle">Añadir diapositiva</h2>
      <label>Título<input id="slideTitle" maxlength="500" required></label>
      <label>Contenido<textarea id="slideContent" maxlength="100000" rows="6"></textarea></label>
      <label>Notas del expositor<textarea id="slideNotes" maxlength="100000" rows="5"></textarea></label>
      <label>Estado<select id="slideState"><option value="draft">Borrador</option><option value="ready">Lista</option><option value="final">Final</option></select></label>
      <fieldset class="presentation-choices"><legend>Secciones del informe</legend><div id="slideSectionChoices"></div></fieldset>
      <fieldset class="presentation-choices"><legend>Evidencias</legend><div id="slideEvidenceChoices"></div></fieldset>
      <fieldset class="presentation-choices"><legend>Fuentes</legend><div id="slideSourceChoices"></div></fieldset>
      <p class="form-error" id="slideFormError" role="alert" hidden></p>
      <div class="modal-actions"><button class="secondary-btn" type="button" data-slide-cancel>Cancelar</button><button class="primary-btn">Guardar diapositiva</button></div>
    </form></dialog>`;
  document.body.append(template.content);
}
