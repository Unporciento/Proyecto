const TYPES = Object.freeze({
  text: 'Texto u observación',
  document: 'Documento',
  photo: 'Fotografía',
  technical_result: 'Resultado técnico',
  procedure: 'Procedimiento',
  finding: 'Hallazgo',
  calculation: 'Cálculo',
  table_record: 'Tabla o registro'
});
const STATES = Object.freeze({
  collected: 'Recopilada',
  review: 'Por revisar',
  approved: 'Aprobada',
  discarded: 'Descartada'
});

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function legacyData(evidence) {
  return {
    evidenceType: 'text',
    description: evidence.data.summary,
    state: evidence.data.confidence === 'confirmed' ? 'approved' : 'review'
  };
}

function names(ids, lookup, fallback) {
  const values = ids.map(id => lookup.get(id)).filter(Boolean);
  return values.length ? values.join(' · ') : fallback;
}

function action(evidence, name, label, extra = '') {
  const button = node('button', `evidence-action ${extra}`.trim(), label);
  button.type = 'button';
  button.dataset.evidenceAction = name;
  button.dataset.evidenceId = evidence.id;
  button.setAttribute('aria-label', `${label}: ${evidence.title}`);
  return button;
}

function evidenceCard(summary, lookups) {
  const { evidence, sourceIds, criterionIds } = summary;
  const data = evidence.schemaVersion === 2 ? evidence.data : legacyData(evidence);
  const card = node('article', 'evidence-card');
  const head = node('div', 'evidence-card-head');
  head.append(
    node('span', 'evidence-kind', TYPES[data.evidenceType] || TYPES.text),
    node('span', `evidence-state ${data.state}`, STATES[data.state] || 'Por revisar')
  );
  const trace = node('div', 'evidence-trace');
  const source = node('div');
  source.append(
    node('span', '', 'Fuente → '),
    node('strong', '', names(sourceIds, lookups.sources, 'Sin fuente'))
  );
  const criterion = node('div');
  criterion.append(
    node('span', '', 'Satisface → '),
    node('strong', '', names(criterionIds, lookups.criteria, 'Sin criterio'))
  );
  trace.append(source, criterion);
  const actions = node('div', 'evidence-card-actions');
  actions.append(
    action(evidence, 'edit', 'Editar'),
    action(evidence, 'delete', 'Eliminar', 'danger')
  );
  card.append(
    head,
    node('h2', '', evidence.title),
    node('p', 'evidence-description', data.description),
    trace,
    actions
  );
  return card;
}

export function renderEvidence(target, summaries, options, { append = false } = {}) {
  if (!append) target.replaceChildren();
  if (!summaries.length && !append) {
    const empty = node('div', 'empty-state');
    empty.append(
      node('span', '', '◇'),
      node('h3', '', 'Este proyecto aún no tiene evidencias'),
      node('p', '', 'Registra qué demuestra cada resultado y con qué criterio se relaciona.')
    );
    target.append(empty);
    return;
  }
  const lookups = {
    sources: new Map(options.sources.map(item => [item.id, item.title])),
    criteria: new Map(options.criteria.map(item => [item.id, item.title]))
  };
  const fragment = document.createDocumentFragment();
  summaries.forEach(item => fragment.append(evidenceCard(item, lookups)));
  target.append(fragment);
}

export function renderEvidenceSummary(count, hasMore) {
  document.querySelector('#evidenceSummary').textContent = count
    ? `${count} evidencia${count === 1 ? '' : 's'} visible${count === 1 ? '' : 's'}${hasMore ? ' · hay más resultados' : ''}`
    : 'Sin evidencias para estos filtros';
}
