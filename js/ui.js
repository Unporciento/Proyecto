import { closeDrawer, resolveView, setupDrawer } from './drawer.js?v=20260722-3';
import { isDue, nextLabel, summarize } from './scheduler.js?v=20260722-3';

const $ = selector => document.querySelector(selector);

export function toast(message, tone = 'default') {
  const node = document.createElement('div');
  node.className = `toast ${tone}`;
  node.textContent = message;
  $('#toastRegion').appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

export function showView(name) {
  const safeName = resolveView(name);
  if (!safeName) return false;
  document.querySelectorAll('.view').forEach(panel => panel.classList.toggle('active', panel.dataset.viewPanel === safeName));
  document.querySelectorAll('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === safeName));
  const titles = { inicio: 'Tu centro de estudio', biblioteca: 'Biblioteca', estudiar: 'Sesión inteligente', examen: 'Simulacro', progreso: 'Progreso verificable' };
  $('#viewTitle').textContent = titles[safeName];
  closeDrawer({ restoreFocus: false, focusMain: true });
  history.replaceState(null, '', `#${safeName}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  return true;
}

export function setupNavigation() {
  setupDrawer();
  document.querySelectorAll('[data-view], [data-go]').forEach(button => {
    button.addEventListener('click', () => showView(button.dataset.view || button.dataset.go));
  });
  const initial = resolveView(location.hash.slice(1));
  if (initial) showView(initial);
  window.addEventListener('hashchange', () => {
    const view = resolveView(location.hash.slice(1));
    if (view) showView(view);
  });
}

function dateLabel(value) {
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(new Date(value));
}

function escapeHtml(value = '') {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

export function renderDocuments(documents, cards, query = '', subjectId = 'all', filter = 'all') {
  const grid = $('#documentGrid');
  const filtered = documents.filter(doc => {
    const group = cards.filter(card => card.docId === doc.id);
    const reviewed = group.filter(card => card.repetitions);
    const mastery = reviewed.length ? reviewed.reduce((sum, card) => sum + (card.mastery || 0), 0) / reviewed.length : 0;
    const matchesFilter = filter === 'ready' ? group.length >= 3 : filter === 'weak' ? group.length > 0 && (!reviewed.length || mastery < 70) : true;
    return matchesFilter && (subjectId === 'all' || doc.subjectId === subjectId) && `${doc.name} ${doc.preview}`.toLowerCase().includes(query.toLowerCase());
  });
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state"><span>▧</span><h3>${documents.length ? 'No hay coincidencias' : 'Tu biblioteca está vacía'}</h3><p>${documents.length ? 'Prueba otra búsqueda.' : 'Empieza con una guía, un PDF o incluso una foto de tus apuntes.'}</p></div>`;
    return;
  }
  grid.innerHTML = filtered.map(doc => {
    const docCards = cards.filter(card => card.docId === doc.id);
    const reviewed = docCards.filter(card => card.repetitions);
    const mastery = reviewed.length ? Math.round(reviewed.reduce((sum, card) => sum + (card.mastery || 0), 0) / reviewed.length) : 0;
    return `<article class="doc-card" data-doc-id="${doc.id}">
      <div class="doc-card-top"><span class="file-type">${escapeHtml(doc.type.toUpperCase())}</span><button class="doc-menu" data-delete-doc="${doc.id}" aria-label="Eliminar ${escapeHtml(doc.name)}">Eliminar</button></div>
      <h3 title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</h3><p>${escapeHtml(doc.preview)}</p>
      <div class="bar"><i style="width:${mastery}%"></i></div>
      <div class="doc-meta"><span>${docCards.length} preguntas</span><span>${mastery}% dominio</span><span>${dateLabel(doc.createdAt)}</span></div>
    </article>`;
  }).join('');
}

export function renderSubjects(subjects, documents, activeId = 'all') {
  const rail = $('#subjectRail');
  const chips = [{ id: 'all', name: 'Todas' }, ...subjects];
  rail.innerHTML = chips.map(subject => {
    const count = subject.id === 'all' ? documents.length : documents.filter(doc => doc.subjectId === subject.id).length;
    return `<button class="subject-chip ${subject.id === activeId ? 'active' : ''}" data-subject="${subject.id}"><span>${escapeHtml(subject.name)}</span><b>${count}</b></button>`;
  }).join('') + '<button class="subject-chip add" id="newSubjectBtn">+ Nueva materia</button>';
}

export function renderDashboard(documents, cards, attempts, streak = 0) {
  const stats = summarize(cards, attempts);
  $('#dueCount').textContent = stats.due;
  $('#dueRing').style.setProperty('--progress', Math.min(100, stats.due * 6));
  $('#dueHeading').textContent = stats.due ? `${stats.due} recuerdos necesitan trabajo` : 'Todo al día';
  $('#dueText').textContent = stats.due ? 'Haz una sesión corta ahora: lo difícil recibe prioridad.' : 'Tus repasos aparecerán justo antes de que empieces a olvidar.';
  $('#masteryMetric').textContent = `${stats.mastery}%`;
  $('#timeMetric').textContent = `${stats.minutes} min`;
  $('#answerMetric').textContent = stats.answers;
  $('#accuracyMetric').textContent = stats.answers ? `${stats.accuracy}% recordadas correctamente` : 'Sin respuestas todavía';
  $('#streakSide').textContent = `${streak} día${streak === 1 ? '' : 's'}`;
  $('#heroCopy').textContent = documents.length
    ? `Tienes ${stats.due || Math.min(12, stats.total)} preguntas listas. Una sesión breve vale más que otra relectura completa.`
    : 'Carga tu primer material y Forja preparará una ruta breve para comenzar.';
  renderQueue(documents, cards);
}

function renderQueue(documents, cards) {
  const target = $('#studyQueue');
  const dueByDoc = documents.map(doc => ({ doc, cards: cards.filter(card => card.docId === doc.id && isDue(card)) }))
    .filter(item => item.cards.length).sort((a, b) => b.cards.length - a.cards.length).slice(0, 4);
  if (!dueByDoc.length) {
    target.className = 'empty-state compact';
    target.innerHTML = '<span>◌</span><p>No hay repasos vencidos. Puedes adelantar una sesión desde Estudiar.</p>';
    return;
  }
  target.className = 'topic-progress';
  target.innerHTML = dueByDoc.map(({ doc, cards: list }) => `<div class="topic-row"><span><strong>${escapeHtml(doc.name)}</strong><small>${escapeHtml(list[0]?.type || 'repaso activo')}</small></span><div class="bar"><i style="width:${Math.min(100, list.length * 12)}%"></i></div><b>${list.length}</b></div>`).join('');
}

export function renderProgress(documents, cards, attempts) {
  const stats = summarize(cards, attempts);
  $('#globalMastery').textContent = `${stats.mastery}%`;
  $('#globalBar').style.width = `${stats.mastery}%`;
  const confident = attempts.filter(attempt => attempt.confidence >= 4);
  const blind = confident.filter(attempt => attempt.rating < 3);
  if (confident.length) {
    const rate = Math.round(blind.length / confident.length * 100);
    $('#calibrationTitle').textContent = rate < 20 ? 'Confianza bien calibrada' : `${rate}% de puntos ciegos`;
    $('#calibrationCopy').textContent = rate < 20 ? 'Cuando dices “lo sé”, normalmente puedes demostrarlo.' : 'En estas respuestas sentías seguridad, pero el recuerdo falló. Priorízalas.';
  }
  const target = $('#topicProgress');
  if (!documents.length) return;
  target.className = 'topic-progress';
  target.innerHTML = documents.map(doc => {
    const group = cards.filter(card => card.docId === doc.id);
    const reviewed = group.filter(card => card.repetitions);
    const score = reviewed.length ? Math.round(reviewed.reduce((sum, card) => sum + card.mastery, 0) / reviewed.length) : 0;
    return `<div class="topic-row"><span><strong>${escapeHtml(doc.name)}</strong><small>${reviewed.length}/${group.length} practicadas</small></span><div class="bar"><i style="width:${score}%"></i></div><b>${score}%</b></div>`;
  }).join('');
}

export function setBusy(message) {
  const zone = $('#dropZone');
  zone.dataset.previous = zone.innerHTML;
  zone.innerHTML = `<div class="drop-icon">◌</div><h2>${escapeHtml(message)}</h2><p>No cierres esta pestaña durante el procesamiento local.</p>`;
  zone.setAttribute('aria-busy', 'true');
}

export function updateBusy(message) {
  const heading = $('#dropZone h2');
  if (heading) heading.textContent = message;
}

export function clearBusy() {
  const zone = $('#dropZone');
  if (zone.dataset.previous) { zone.innerHTML = zone.dataset.previous; delete zone.dataset.previous; }
  zone.removeAttribute('aria-busy');
}
