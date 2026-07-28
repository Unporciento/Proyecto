const MODULE_LABELS = Object.freeze({
  library: 'Biblioteca',
  rubric: 'Rúbrica',
  evidence: 'Evidencias',
  report: 'Informe'
});

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function renderContextOptions(target, options, selectedKeys = new Set()) {
  target.replaceChildren();
  for (const module of Object.keys(MODULE_LABELS)) {
    const group = node('section', 'buenaventura-option-group');
    group.append(node('h3', '', MODULE_LABELS[module]));
    const rows = options.filter(item => item.module === module);
    if (!rows.length) group.append(node('p', 'buenaventura-empty', 'Sin fragmentos disponibles.'));
    rows.forEach(item => {
      const label = node('label', 'buenaventura-option');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = item.id;
      input.dataset.module = item.module;
      input.checked = selectedKeys.has(`${item.module}:${item.id}`);
      const copy = node('span');
      copy.append(node('strong', '', item.title), node('small', '', item.preview || 'Sin vista previa.'));
      label.append(input, copy);
      group.append(label);
    });
    target.append(group);
  }
}

export function renderPreview(target, fragments) {
  target.replaceChildren();
  if (!fragments.length) {
    target.append(node('p', '', 'Seleccione contexto para revisar qué se utilizará.'));
    return;
  }
  fragments.forEach(fragment => {
    const article = node('article', 'buenaventura-fragment');
    const heading = node('div', 'buenaventura-fragment-head');
    heading.append(node('strong', '', fragment.title), node('small', '', MODULE_LABELS[fragment.module]));
    article.append(
      heading,
      node('p', '', fragment.excerpt),
      node('small', 'buenaventura-provenance', `Procedencia: ${fragment.provenance.label}`)
    );
    target.append(article);
  });
}

export function renderResponse(target, response) {
  target.replaceChildren();
  target.append(node('p', 'buenaventura-response-text', response.text));
  if (response.references.length) {
    const list = document.createElement('ul');
    response.references.forEach(reference => {
      list.append(node('li', '', `${MODULE_LABELS[reference.module]} · ${reference.id}`));
    });
    target.append(list);
  }
}
