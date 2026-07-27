const TYPES = Object.freeze({
  pdf: ['PDF', 'PDF'],
  word: ['Documento Word', 'DOC'],
  image: ['Imagen', 'IMG'],
  website: ['Enlace web', 'WEB'],
  book: ['Libro', 'LIB'],
  article: ['Artículo', 'ART'],
  note: ['Apunte propio', 'NOT'],
  video: ['Video', 'VID']
});

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function dateLabel(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(`${value}T00:00:00Z`));
}

function safeUrl(value) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function sourceData(source) {
  if (source.schemaVersion === 2) return source.data;
  return {
    sourceType: ['book', 'article', 'website'].includes(source.data.sourceType)
      ? source.data.sourceType
      : 'note',
    description: source.data.publicationTitle,
    author: source.data.authors.join(', '),
    date: null,
    url: source.data.url,
    notes: source.data.notes
  };
}

function action(source, name, label, extra = '') {
  const button = node('button', `source-action ${extra}`.trim(), label);
  button.type = 'button';
  button.dataset.sourceAction = name;
  button.dataset.sourceId = source.id;
  button.setAttribute('aria-label', `${label}: ${source.title}`);
  return button;
}

function sourceCard(source) {
  const data = sourceData(source);
  const type = TYPES[data.sourceType] || TYPES.note;
  const card = node('article', 'source-card');
  card.dataset.sourceId = source.id;

  const head = node('div', 'source-card-head');
  head.append(node('span', 'source-type-icon', type[1]), node('span', 'source-type', type[0]));
  const title = node('h2', '', source.title);
  const description = node(
    'p',
    'source-description',
    data.description || 'Sin descripción todavía.'
  );
  const meta = node('div', 'source-meta');
  if (data.author) meta.append(node('span', '', data.author));
  if (data.date) meta.append(node('span', '', dateLabel(data.date)));
  const href = safeUrl(data.url);
  if (href) {
    const link = node('a', 'source-link', 'Abrir enlace ↗');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    meta.append(link);
  }
  const actions = node('div', 'source-card-actions');
  actions.append(action(source, 'edit', 'Editar'));
  actions.append(action(source, 'delete', 'Eliminar', 'danger'));
  card.append(head, title, description, meta, actions);
  return card;
}

export function renderSources(target, sources, { append = false } = {}) {
  if (!append) target.replaceChildren();
  if (!sources.length && !append) {
    const empty = node('div', 'empty-state');
    empty.append(
      node('span', '', '⌁'),
      node('h3', '', 'Este proyecto aún no tiene fuentes'),
      node('p', '', 'Añade un documento, libro, enlace, artículo, apunte o video.')
    );
    target.append(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  sources.forEach(source => fragment.append(sourceCard(source)));
  target.append(fragment);
}

export function renderSourceSummary(count, hasMore) {
  document.querySelector('#sourceSummary').textContent = count
    ? `${count} fuente${count === 1 ? '' : 's'} visible${count === 1 ? '' : 's'}${hasMore ? ' · hay más resultados' : ''}`
    : 'Sin fuentes para este filtro';
}

