export function ensureReportDialogs() {
  if (document.querySelector('#reportDialog')) return;
  const template = document.createElement('template');
  template.innerHTML = `
    <dialog id="reportDialog">
      <form id="reportForm" class="modal-card report-form">
        <button class="modal-close" type="button" data-report-cancel aria-label="Cerrar">×</button>
        <span class="eyebrow">INFORME ACADÉMICO</span>
        <h2 id="reportDialogTitle">Crear informe</h2>
        <label>Título<input id="reportTitle" maxlength="500" required></label>
        <label>Resumen<textarea id="reportAbstract" maxlength="50000" rows="4"></textarea></label>
        <div class="report-form-grid">
          <label>Idioma<input id="reportLanguage" maxlength="20" value="es" required></label>
          <label>Estado<select id="reportState"><option value="draft">Borrador</option><option value="final">Final</option></select></label>
        </div>
        <p class="form-error" id="reportFormError" role="alert" hidden></p>
        <div class="modal-actions"><button class="secondary-btn" type="button" data-report-cancel>Cancelar</button><button class="primary-btn" id="saveReportBtn">Guardar informe</button></div>
      </form>
    </dialog>
    <dialog id="sectionDialog">
      <form id="sectionForm" class="modal-card report-form">
        <button class="modal-close" type="button" data-section-cancel aria-label="Cerrar">×</button>
        <span class="eyebrow">SECCIÓN DEL INFORME</span>
        <h2 id="sectionDialogTitle">Añadir sección</h2>
        <label>Título<input id="sectionTitle" maxlength="500" required></label>
        <label>Contenido<textarea id="sectionBody" maxlength="500000" rows="10"></textarea></label>
        <fieldset class="report-choices"><legend>Evidencias relacionadas</legend><div id="sectionEvidenceChoices"></div></fieldset>
        <fieldset class="report-choices"><legend>Fuentes citadas</legend><div id="sectionSourceChoices"></div></fieldset>
        <p class="form-error" id="sectionFormError" role="alert" hidden></p>
        <div class="modal-actions"><button class="secondary-btn" type="button" data-section-cancel>Cancelar</button><button class="primary-btn" id="saveSectionBtn">Guardar sección</button></div>
      </form>
    </dialog>`;
  document.body.append(template.content);
}
