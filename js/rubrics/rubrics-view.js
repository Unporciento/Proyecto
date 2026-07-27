const STATES = Object.freeze({
  pending: 'Pendiente',
  in_progress: 'En desarrollo',
  completed: 'Cumplido',
  not_applicable: 'No aplica'
});

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function action(name, label, id = '', extra = '') {
  const button = node('button', `rubric-action ${extra}`.trim(), label);
  button.type = 'button';
  button.dataset.rubricAction = name;
  if (id) button.dataset.criterionId = id;
  return button;
}

function criterionAction(criterion, name, label, disabled = false, extra = '') {
  const button = node('button', extra, label);
  button.type = 'button';
  button.dataset.rubricAction = name;
  button.dataset.criterionId = criterion.id;
  button.disabled = disabled;
  button.setAttribute('aria-label', `${label}: ${criterion.title}`);
  return button;
}

function criterionState(criterion) {
  if (criterion.schemaVersion === 2) return STATES[criterion.data.state];
  return 'Pendiente';
}

function criterionCard(criterion, index, count) {
  const card = node('article', 'criterion-card');
  card.dataset.criterionId = criterion.id;
  const content = node('div');
  content.append(
    node('h3', '', `${index + 1}. ${criterion.title}`),
    node('p', 'criterion-description', criterion.data.description || 'Sin descripción.')
  );
  const meta = node('div', 'criterion-meta');
  meta.append(
    node('span', '', `${criterion.data.maxPoints ?? 0} puntos`),
    node('span', '', criterionState(criterion))
  );
  if (criterion.data.required) meta.append(node('span', '', 'Obligatorio'));
  content.append(meta);

  const controls = node('div', 'criterion-controls');
  const up = criterionAction(criterion, 'up', 'Subir', index === 0);
  const down = criterionAction(criterion, 'down', 'Bajar', index === count - 1);
  up.textContent = '↑';
  down.textContent = '↓';
  controls.append(
    up,
    down,
    criterionAction(criterion, 'edit-criterion', 'Editar'),
    criterionAction(criterion, 'delete-criterion', 'Eliminar', false, 'danger')
  );
  card.append(content, controls);
  return card;
}

export function renderRubric(target, details) {
  target.replaceChildren();
  if (!details) {
    const empty = node('div', 'empty-state');
    empty.append(
      node('span', '', '▥'),
      node('h3', '', 'Este proyecto aún no tiene rúbrica'),
      node('p', '', 'Crea criterios verificables y define cuánto vale cada uno.')
    );
    target.append(empty);
    document.querySelector('#newRubricBtn').hidden = false;
    return;
  }
  document.querySelector('#newRubricBtn').hidden = true;
  const { rubric, criteria } = details;
  const panel = node('article', 'rubric-panel');
  const head = node('div', 'rubric-head');
  const copy = node('div');
  copy.append(
    node('h2', '', rubric.title),
    node(
      'p',
      'rubric-copy',
      rubric.schemaVersion === 2
        ? rubric.data.instructions || 'Sin instrucciones.'
        : rubric.data.description || 'Sin instrucciones.'
    )
  );
  if (rubric.schemaVersion === 2 && rubric.data.observations) {
    copy.append(node('p', 'rubric-notes', rubric.data.observations));
  }
  head.append(copy, node('strong', 'rubric-total', `${rubric.data.totalPoints ?? 0} puntos`));
  const actions = node('div', 'rubric-actions');
  actions.append(
    action('add-criterion', '+ Añadir criterio'),
    action('edit-rubric', 'Editar rúbrica'),
    action('delete-rubric', 'Eliminar rúbrica', '', 'danger')
  );
  const heading = node('h3', '', `Criterios (${criteria.length})`);
  const list = node('div', 'criterion-list');
  if (!criteria.length) {
    const empty = node('div', 'empty-state compact');
    empty.append(node('p', '', 'Añade el primer criterio para estructurar la evaluación.'));
    list.append(empty);
  } else {
    criteria.forEach((criterion, index) =>
      list.append(criterionCard(criterion, index, criteria.length))
    );
  }
  panel.append(head, actions, heading, list);
  target.append(panel);
}
