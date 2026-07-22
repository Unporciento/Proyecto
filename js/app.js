import { validateBackup } from './backup.js?v=20260722-4';
import * as db from './db.js?v=20260722-4';
import { closeDrawer } from './drawer.js?v=20260722-4';
import { applyEnergyMode, monitorEnergy } from './energy.js?v=20260722-4';
import { setupFocusTimer } from './focus.js?v=20260722-4';
import { generateCards } from './generator.js?v=20260722-4';
import { parseFile } from './parsers.js?v=20260722-4';
import { downloadCalendar, examCountdown } from './planner.js?v=20260722-4';
import { paintAvatarPreview, paintProfile, prepareAvatar } from './profile.js?v=20260722-4';
import { buildSession, schedule } from './scheduler.js?v=20260722-4';
import { ExamSession, StudySession } from './sessions.js?v=20260722-4';
import { newlyUnlocked, streakStats } from './streak.js?v=20260722-4';
import { applyTheme, normalizeHex } from './theme.js?v=20260722-4';
import { clearBusy, renderDashboard, renderDocuments, renderProgress, renderSubjects, setBusy, setupNavigation, showView, toast, updateBusy } from './ui.js?v=20260722-4';

const $ = selector => document.querySelector(selector);
let state = { subjects: [], documents: [], cards: [], attempts: [], settings: {}, streak: streakStats([]), activeSubject: 'all', libraryFilter: 'all' };

function paintEnergyStatus(mode) {
  $('#energyStatus').textContent = mode === 'saver' ? 'Modo activo: ahorro de energía.' : 'Modo activo: visual completo.';
}

async function loadState() {
  let subjects = await db.all('subjects');
  if (!subjects.length) {
    const general = { id: db.uid('subject'), name: 'General', createdAt: new Date().toISOString() };
    await db.put('subjects', general); subjects = [general];
  }
  const [documents, cards, attempts, settings] = await Promise.all([
    db.all('documents'), db.all('cards'), db.all('attempts'), db.getSettings()
  ]);
  state = { ...state, subjects, documents, cards, attempts, settings, streak: streakStats(attempts, new Date(), settings.bestStreak) };
  if (state.streak.best > (Number(settings.bestStreak) || 0)) {
    state.settings = { ...settings, bestStreak: state.streak.best };
    await db.saveSettings(state.settings);
  }
  applyTheme(settings); paintEnergyStatus(applyEnergyMode(settings.energyMode || 'auto'));
  refresh();
}

function refresh() {
  renderDocuments(state.documents, state.cards, $('#librarySearch')?.value || '', state.activeSubject, state.libraryFilter);
  renderSubjects(state.subjects, state.documents, state.activeSubject);
  renderDashboard(state.documents, state.cards, state.attempts, state.streak);
  renderProgress(state.documents, state.cards, state.attempts, state.streak);
  paintProfile(state.settings);
  const selector = $('#studySubject');
  const previous = selector.value;
  selector.replaceChildren(new Option('Mezclar todas las materias', 'all'));
  state.subjects.forEach(subject => selector.add(new Option(subject.name, subject.id)));
  selector.value = [...selector.options].some(option => option.value === previous) ? previous : 'all';
  const days = examCountdown(state.settings.examDate);
  if (days !== null && days >= 0) $('#timeDelta').textContent = days ? `Tu examen es en ${days} día${days === 1 ? '' : 's'}` : 'Tu examen es hoy';
  const count = state.cards.filter(card => !card.dueAt || new Date(card.dueAt) <= new Date()).length;
  $('#startTodayBtn').disabled = !state.cards.length;
  $('#startStudyBtn').disabled = !state.cards.length;
  $('#startTodayBtn').firstChild.textContent = count ? `Repasar ${Math.min(count, 18)} ahora ` : 'Practicar por adelantado ';
}

function updateStreak() {
  const previous = state.streak;
  state.streak = streakStats(state.attempts, new Date(), Math.max(previous.best, Number(state.settings.bestStreak) || 0));
  if (state.streak.best > (Number(state.settings.bestStreak) || 0)) {
    state.settings = { ...state.settings, bestStreak: state.streak.best };
    db.saveSettings(state.settings).catch(() => toast('No pude guardar el récord de racha.', 'error'));
  }
  const rewards = newlyUnlocked(previous, state.streak);
  if (rewards.length) toast(`${rewards.at(-1).icon} Premio desbloqueado: ${rewards.at(-1).name}.`);
}

function bindUploadHandlers() {
  const zone = $('#dropZone');
  const input = $('#fileInput');
  if (!zone || !input) return;
  const choose = event => { if (!event.target.closest('small')) input.click(); };
  zone.addEventListener('click', choose);
  zone.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); } });
  input.addEventListener('change', () => processFiles([...input.files]));
  ['dragenter', 'dragover'].forEach(name => zone.addEventListener(name, event => { event.preventDefault(); zone.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(name => zone.addEventListener(name, event => { event.preventDefault(); zone.classList.remove('dragging'); }));
  zone.addEventListener('drop', event => processFiles([...event.dataTransfer.files]));
}

async function processFiles(files) {
  if (!files.length) return;
  setBusy(`Preparando ${files.length} archivo${files.length === 1 ? '' : 's'}…`);
  let imported = 0;
  for (const file of files) {
    try {
      const parsed = await parseFile(file, updateBusy);
      await persistDocument({ name: file.name, type: parsed.type, size: parsed.size, text: parsed.text, meta: { pageCount: parsed.pageCount, confidence: parsed.confidence } });
      imported += 1;
    } catch (error) {
      toast(`${file.name}: ${error.message}`, 'error');
    }
  }
  clearBusy(); bindUploadHandlers(); refresh();
  navigator.storage?.persist?.().catch(() => {});
  if (imported) toast(`${imported} material${imported === 1 ? '' : 'es'} listo${imported === 1 ? '' : 's'} para practicar.`);
}

async function persistDocument({ name, type = 'txt', size = 0, text, meta = {} }) {
  const document = {
    id: db.uid('doc'), name: name.slice(0, 255), type, size,
    subjectId: state.activeSubject === 'all' ? state.subjects[0].id : state.activeSubject,
    text, preview: text.replace(/\s+/g, ' ').slice(0, 130),
    createdAt: new Date().toISOString(), meta
  };
  const cards = generateCards(document);
  if (cards.length < 3) throw new Error('Hay muy poco texto útil para crear preguntas fiables.');
  await db.putMaterial(document, cards);
  state.documents.push(document); state.cards.push(...cards);
  return cards.length;
}

function setupPasteMaterial() {
  const dialog = $('#pasteDialog');
  $('#pasteMaterialBtn').addEventListener('click', () => {
    $('#pasteTitle').value = ''; $('#pasteText').value = '';
    dialog.returnValue = 'cancel'; dialog.showModal();
  });
  dialog.querySelector('form').addEventListener('submit', event => {
    if ($('#pasteText').value.replaceAll('\0', '').trim().length >= 80) return;
    event.preventDefault(); toast('Añade al menos 80 caracteres útiles.', 'error');
  });
  dialog.addEventListener('close', async () => {
    if (dialog.returnValue !== 'save') return;
    const name = $('#pasteTitle').value.trim();
    const text = $('#pasteText').value.replaceAll('\0', '').trim();
    if (!name || text.length < 80) return;
    try {
      const count = await persistDocument({ name: `${name}.txt`, text, size: new Blob([text]).size, meta: { origin: 'pasted' } });
      refresh(); toast(`Apuntes guardados: ${count} preguntas creadas.`);
    } catch (error) { toast(error.message, 'error'); }
  });
}

async function deleteDocument(id) {
  const document = state.documents.find(item => item.id === id);
  if (!document || !confirm(`¿Eliminar “${document.name}” y todas sus preguntas?`)) return;
  const removedCards = new Set(state.cards.filter(card => card.docId === id).map(card => card.id));
  const removedAttempts = state.attempts.filter(item => removedCards.has(item.cardId)).map(item => item.id);
  await db.removeMaterial(id, [...removedCards], removedAttempts);
  state.documents = state.documents.filter(item => item.id !== id);
  state.cards = state.cards.filter(card => card.docId !== id);
  state.attempts = state.attempts.filter(item => !removedCards.has(item.cardId));
  updateStreak(); refresh(); toast('Material eliminado del dispositivo.');
}

function startStudy() {
  if (!state.cards.length) { toast('Primero añade un material.'); return showView('biblioteca'); }
  const subjectId = $('#studySubject').value;
  const pool = subjectId === 'all' ? state.cards : state.cards.filter(card => state.documents.find(doc => doc.id === card.docId)?.subjectId === subjectId);
  if (!pool.length) { toast('Esa materia todavía no tiene preguntas.'); return; }
  const cards = buildSession(pool, 18);
  showView('estudiar');
  $('#studyEmpty').hidden = true; $('#studySession').hidden = false;
  new StudySession($('#studySession'), cards, {
    sound: state.settings.sound !== false,
    onRate: async (card, result) => {
      const updated = schedule(card, result.rating);
      const attempt = { id: db.uid('attempt'), cardId: card.id, docId: card.docId, createdAt: new Date().toISOString(), ...result };
      await db.putProgress([updated], [attempt]);
      state.cards = state.cards.map(item => item.id === updated.id ? updated : item);
      state.attempts.push(attempt);
    },
    onFinish: () => { updateStreak(); refresh(); showView('inicio'); }
  }).start();
}

function startExam() {
  if (state.cards.length < 4) { toast('Necesitas al menos cuatro preguntas. Añade más material.'); return; }
  const count = Math.min(Number($('#examCount').value), state.cards.length);
  const cards = buildSession(state.cards, count).sort(() => Math.random() - .5);
  $('#examSetup').hidden = true; $('#examSession').hidden = false;
  new ExamSession($('#examSession'), cards, Number($('#examMinutes').value), {
    onFinish: async answers => {
      const attempts = answers.map(item => ({
        id: db.uid('attempt'), cardId: item.card.id, docId: item.card.docId,
        createdAt: new Date().toISOString(), rating: item.correct ? 3 : 1,
        confidence: 0, durationMs: 0, mode: 'exam'
      }));
      const updates = answers.map(item => schedule(item.card, item.correct ? 3 : 1));
      await db.putProgress(updates, attempts);
      state.attempts.push(...attempts);
      const updateMap = new Map(updates.map(card => [card.id, card]));
      state.cards = state.cards.map(card => updateMap.get(card.id) || card);
      updateStreak();
      $('#examSetup').hidden = false; $('#examSession').hidden = true;
      refresh(); showView('progreso');
    }
  }).start();
}

function setupSettings() {
  const dialog = $('#settingsDialog');
  const themeValues = () => ({
    themeMode: $('#themeModeSetting').value,
    palette: $('#paletteSetting').value,
    customAccent: normalizeHex($('#customAccentSetting').value)
  });
  const previewTheme = () => {
    $('#customAccentRow').hidden = $('#paletteSetting').value !== 'custom';
    applyTheme({ ...state.settings, ...themeValues() });
  };
  $('#settingsBtn').addEventListener('click', () => {
    closeDrawer({ restoreFocus: false });
    dialog.returnValue = 'cancel';
    $('#examDateSetting').value = state.settings.examDate || '';
    $('#dailyGoalSetting').value = state.settings.dailyGoal || 25;
    $('#studyTimeSetting').value = state.settings.studyTime || '19:00';
    $('#soundSetting').checked = state.settings.sound !== false;
    $('#themeModeSetting').value = state.settings.themeMode || 'system';
    $('#paletteSetting').value = state.settings.palette || 'forja';
    $('#customAccentSetting').value = normalizeHex(state.settings.customAccent);
    $('#energyModeSetting').value = state.settings.energyMode || 'auto';
    previewTheme(); dialog.showModal();
  });
  dialog.addEventListener('close', async () => {
    if (dialog.returnValue !== 'save') { applyTheme(state.settings); return; }
    state.settings = { ...state.settings, ...themeValues(), energyMode: $('#energyModeSetting').value, examDate: $('#examDateSetting').value, dailyGoal: Number($('#dailyGoalSetting').value), studyTime: $('#studyTimeSetting').value, sound: $('#soundSetting').checked };
    paintEnergyStatus(applyEnergyMode(state.settings.energyMode));
    await db.saveSettings(state.settings); toast('Plan de estudio guardado.'); refresh();
  });
  $('#themeModeSetting').addEventListener('change', previewTheme);
  $('#paletteSetting').addEventListener('change', previewTheme);
  $('#customAccentSetting').addEventListener('input', previewTheme);
  $('#clearDataBtn').addEventListener('click', async () => {
    if (!confirm('Esto borrará materiales, preguntas y progreso solo de este dispositivo. ¿Continuar?')) return;
    await db.clearAll(); dialog.close('cancel'); await loadState(); toast('Datos locales eliminados.');
  });
  $('#calendarBtn').addEventListener('click', () => {
    const plan = { examDate: $('#examDateSetting').value, dailyGoal: $('#dailyGoalSetting').value, studyTime: $('#studyTimeSetting').value };
    downloadCalendar(plan); toast('Plan de calendario generado. Ábrelo para añadir las sesiones.');
  });
}

function setupSubjects() {
  const dialog = $('#subjectDialog');
  $('#subjectRail').addEventListener('click', event => {
    const subject = event.target.closest('[data-subject]');
    if (subject) { state.activeSubject = subject.dataset.subject; refresh(); }
    if (event.target.closest('#newSubjectBtn')) { dialog.returnValue = 'cancel'; $('#subjectName').value = ''; dialog.showModal(); }
  });
  dialog.addEventListener('close', async () => {
    if (dialog.returnValue !== 'save') return;
    const name = $('#subjectName').value.trim();
    if (!name) return;
    const subject = { id: db.uid('subject'), name: name.slice(0, 60), createdAt: new Date().toISOString() };
    await db.put('subjects', subject); state.subjects.push(subject); state.activeSubject = subject.id; refresh();
  });
}

function setupProfile() {
  const dialog = $('#profileDialog');
  let pendingAvatar = null;
  $('#profileBtn').addEventListener('click', () => {
    dialog.returnValue = 'cancel'; pendingAvatar = state.settings.avatar || null;
    $('#profileName').value = state.settings.profileName || ''; paintProfile(state.settings); dialog.showModal();
  });
  $('#avatarInput').addEventListener('change', async event => {
    try { pendingAvatar = await prepareAvatar(event.target.files[0]); paintAvatarPreview($('#avatarPreview'), pendingAvatar, 'YO', 'Vista previa'); }
    catch (error) { toast(error.message, 'error'); }
  });
  $('#removeAvatarBtn').addEventListener('click', () => { pendingAvatar = null; paintAvatarPreview($('#avatarPreview'), null, 'YO'); });
  dialog.addEventListener('close', async () => {
    if (dialog.returnValue !== 'save') return;
    state.settings = { ...state.settings, profileName: $('#profileName').value.trim().slice(0, 60) || 'Yo', avatar: pendingAvatar };
    await db.saveSettings(state.settings); paintProfile(state.settings); toast('Perfil local guardado.');
  });
}

async function exportBackup() {
  const payload = await db.exportData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
  link.download = `forja-respaldo-${new Date().toISOString().slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function importBackup(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) throw new Error('El respaldo supera el límite de 10 MB.');
  const data = validateBackup(JSON.parse(await file.text()));
  if (!confirm(`Se reemplazarán los datos locales por ${data.documents.length} materiales y ${data.cards.length} preguntas. ¿Continuar?`)) return;
  await db.replaceAll(data);
  state.activeSubject = 'all'; state.libraryFilter = 'all';
  await loadState(); toast('Respaldo restaurado de forma completa.');
}

function setupBackupRestore() {
  const input = $('#backupInput');
  $('#importBackupBtn').addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    try { await importBackup(input.files[0]); }
    catch (error) { toast(error instanceof SyntaxError ? 'Ese archivo no contiene JSON válido.' : error.message, 'error'); }
    finally { input.value = ''; }
  });
}

function setupLibraryFilters() {
  document.querySelector('.segmented').addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.libraryFilter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('active', item === button));
    renderDocuments(state.documents, state.cards, $('#librarySearch').value, state.activeSubject, state.libraryFilter);
  });
}

function setupEvents() {
  setupNavigation(); bindUploadHandlers(); setupSettings(); setupSubjects(); setupProfile(); setupFocusTimer(); setupPasteMaterial(); setupBackupRestore(); setupLibraryFilters();
  $('#addMaterialBtn').addEventListener('click', () => $('#fileInput').click());
  $('#startTodayBtn').addEventListener('click', startStudy);
  $('#startStudyBtn').addEventListener('click', startStudy);
  $('#startExamBtn').addEventListener('click', startExam);
  $('#exportBackupBtn').addEventListener('click', exportBackup);
  $('#librarySearch').addEventListener('input', event => renderDocuments(state.documents, state.cards, event.target.value, state.activeSubject, state.libraryFilter));
  $('#documentGrid').addEventListener('click', event => { const id = event.target.dataset.deleteDoc; if (id) deleteDocument(id); });
}

async function boot() {
  $('#todayLabel').textContent = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  setupEvents(); await loadState();
  monitorEnergy(() => state.settings.energyMode || 'auto', paintEnergyStatus);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js?v=20260722-4').catch(() => {});
}

boot().catch(error => { console.error(error); toast('No pude iniciar el almacenamiento local. Revisa el modo privado del navegador.', 'error'); });
