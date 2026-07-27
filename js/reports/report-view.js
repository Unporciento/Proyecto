const STATE_LABELS = Object.freeze({ draft: 'Borrador', final: 'Final' });

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function action(name, label, id = '', className = '') {
  const button = node('button', `report-action ${className}`, label);
  button.type = 'button';
  button.dataset.reportAction = name;
  if (id) button.dataset.sectionId = id;
  return button;
}

function relationIds(details, sectionId, type) {
  return details.relations.filter(item =>
    item.fromId === sectionId && item.type === type
  ).map(item => item.toId);
}

function sectionCard(section, index, details, options) {
  const card = node('article', 'report-section-card');
  card.dataset.sectionId = section.id;
  const head = node('div', 'report-section-head');
  head.append(
    node('div', 'report-section-number', String(index + 1).padStart(2, '0')),
    node('h3', '', section.title)
  );
  const body = node('textarea', 'report-section-body');
  body.value = section.data.body;
  body.maxLength = 500000;
  body.dataset.sectionBody = section.id;
  body.setAttribute('aria-label', `Contenido de ${section.title}`);
  const evidenceIds = relationIds(details, section.id, 'derived_from');
  const sourceIds = relationIds(details, section.id, 'cites');
  const meta = node('p', 'report-section-meta');
  meta.textContent = `${evidenceIds.length} evidencia${evidenceIds.length === 1 ? '' : 's'} · ${sourceIds.length} fuente${sourceIds.length === 1 ? '' : 's'}`;
  const controls = node('div', 'report-section-controls');
  controls.append(
    action('up', '↑', section.id),
    action('down', '↓', section.id),
    action('edit-section', 'Relaciones', section.id),
    action('delete-section', 'Eliminar', section.id, 'danger')
  );
  controls.children[0].disabled = index === 0;
  controls.children[1].disabled = index === details.sections.length - 1;
  card.append(head, body, meta, controls);
  return card;
}

function coverage(details, options) {
  const evidenceIds = new Set(
    details.relations.filter(item => item.type === 'derived_from').map(item => item.toId)
  );
  const covered = new Set();
  evidenceIds.forEach(id =>
    (options.satisfiedByEvidence.get(id) || []).forEach(criterionId => covered.add(criterionId))
  );
  return {
    covered: options.criteria.filter(item => covered.has(item.id)).length,
    total: options.criteria.length
  };
}

export function renderReport(target, details, options) {
  target.replaceChildren();
  if (!details) {
    const empty = node('div', 'empty-state');
    empty.append(
      node('span', '', '▧'),
      node('h3', '', 'Este proyecto todavía no tiene informe'),
      node('p', '', 'Crea un borrador y construye sus secciones con trazabilidad.')
    );
    target.append(empty);
    return;
  }
  const { report, sections } = details;
  const panel = node('article', 'report-panel');
  const head = node('div', 'report-head');
  const copy = node('div');
  copy.append(node('h2', '', report.title));
  copy.append(node('p', 'report-copy', report.data.abstract || 'Sin resumen.'));
  const badge = node('span', `report-state ${report.status}`, STATE_LABELS[report.status]);
  head.append(copy, badge);
  const stats = node('div', 'report-stats');
  const result = coverage(details, options);
  stats.append(
    node('span', '', `${sections.length} secciones`),
    node('span', '', `${result.covered}/${result.total} criterios cubiertos`),
    node('span', '', `${details.revisions.length} hitos guardados`)
  );
  const actions = node('div', 'report-actions');
  actions.append(
    action('add-section', '+ Añadir sección'),
    action('edit-report', 'Editar informe'),
    action('toggle-final', report.status === 'final' ? 'Volver a borrador' : 'Marcar final'),
    action('delete-report', 'Eliminar informe', '', 'danger')
  );
  const saveState = node('p', 'report-save-state', 'Todos los cambios están guardados.');
  saveState.id = 'reportSaveState';
  saveState.setAttribute('aria-live', 'polite');
  const list = node('div', 'report-section-list');
  sections.forEach((section, index) =>
    list.append(sectionCard(section, index, details, options))
  );
  if (!sections.length) {
    list.append(node('p', 'empty-state compact', 'Añade la primera sección del informe.'));
  }
  panel.append(head, stats, actions, saveState, list);
  target.append(panel);
}

export function fillChoices(target, items, selected) {
  target.replaceChildren();
  if (!items.length) {
    target.append(node('p', 'report-choice-empty', 'No hay opciones disponibles.'));
    return;
  }
  items.forEach(item => {
    const label = node('label', 'report-choice');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = item.id;
    input.checked = selected.includes(item.id);
    label.append(input, node('span', '', item.title));
    target.append(label);
  });
}
