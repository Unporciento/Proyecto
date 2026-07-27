const STATES = Object.freeze({ draft: 'Borrador', ready: 'Lista', final: 'Final' });

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function action(name, label, id = '', className = '') {
  const button = node('button', `presentation-action ${className}`, label);
  button.type = 'button';
  button.dataset.presentationAction = name;
  if (id) button.dataset.slideId = id;
  return button;
}

function slideCard(slide, index, total, relations) {
  const card = node('article', 'slide-card');
  const head = node('div', 'slide-head');
  const number = node('span', 'slide-number', String(index + 1).padStart(2, '0'));
  const title = node('h3', '', slide.title);
  const state = node('span', `slide-state ${slide.status}`, STATES[slide.status]);
  head.append(number, title, state);
  const content = node('p', 'slide-content', slide.data.content || 'Sin contenido.');
  const notes = node('p', 'slide-notes', slide.data.speakerNotes
    ? `Notas: ${slide.data.speakerNotes}`
    : 'Sin notas del expositor.');
  const linked = relations.filter(item => item.fromId === slide.id);
  const meta = node(
    'p', 'slide-meta',
    `${linked.filter(item => item.type === 'derived_from').length} apoyos · ${linked.filter(item => item.type === 'cites').length} fuentes`
  );
  const controls = node('div', 'slide-controls');
  controls.append(
    action('up', '↑', slide.id),
    action('down', '↓', slide.id),
    action('edit-slide', 'Editar', slide.id),
    action('delete-slide', 'Eliminar', slide.id, 'danger')
  );
  controls.children[0].disabled = index === 0;
  controls.children[1].disabled = index === total - 1;
  card.append(head, content, notes, meta, controls);
  return card;
}

export function renderPresentation(target, details) {
  target.replaceChildren();
  if (!details) {
    const empty = node('div', 'empty-state');
    empty.append(
      node('span', '', '▱'),
      node('h3', '', 'Todavía no hay una presentación'),
      node('p', '', 'Prepara la estructura académica que luego podrá usar NEXUS Present.')
    );
    target.append(empty);
    return;
  }
  const panel = node('article', 'presentation-panel');
  const head = node('div', 'presentation-head');
  const copy = node('div');
  copy.append(
    node('h2', '', details.presentation.title),
    node('p', 'presentation-copy', details.presentation.data.objective || 'Sin objetivo.')
  );
  head.append(copy, node(
    'span', `slide-state ${details.presentation.status}`,
    STATES[details.presentation.status]
  ));
  const meta = node(
    'p', 'presentation-meta',
    `${details.slides.length} diapositivas · Público: ${details.presentation.data.audience || 'sin definir'}`
  );
  const actions = node('div', 'presentation-actions');
  actions.append(
    action('add-slide', '+ Añadir diapositiva'),
    action('edit-presentation', 'Editar presentación'),
    action('export-package', 'Paquete para NEXUS'),
    action('delete-presentation', 'Eliminar', '', 'danger')
  );
  const list = node('div', 'slide-list');
  details.slides.forEach((slide, index) =>
    list.append(slideCard(slide, index, details.slides.length, details.relations))
  );
  if (!details.slides.length) {
    list.append(node('p', 'empty-state compact', 'Añade la primera diapositiva.'));
  }
  panel.append(head, meta, actions, list);
  target.append(panel);
}

export function fillPresentationChoices(target, items, selected) {
  target.replaceChildren();
  if (!items.length) {
    target.append(node('p', 'presentation-choice-empty', 'No hay opciones.'));
    return;
  }
  items.forEach(item => {
    const label = node('label', 'presentation-choice');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = item.id;
    input.checked = selected.includes(item.id);
    label.append(input, node('span', '', item.title));
    target.append(label);
  });
}
