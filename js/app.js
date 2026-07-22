import * as db from './db.js?v=20260722-2';
import { generateCards } from './generator.js?v=20260722-2';
import { parseFile } from './parsers.js?v=20260722-2';
import { downloadCalendar, examCountdown } from './planner.js?v=20260722-2';
import { paintProfile, prepareAvatar } from './profile.js?v=20260722-2';
import { buildSession, schedule } from './scheduler.js?v=20260722-2';
import { ExamSession, StudySession } from './sessions.js?v=20260722-2';
import { clearBusy, renderDashboard, renderDocuments, renderProgress, renderSubjects, setBusy, setupNavigation, showView, toast, updateBusy } from './ui.js?v=20260722-2';

const $ = selector => document.querySelector(selector);
let state = { subjects: [], documents: [], cards: [], attempts: [], settings: {}, streak: 0, activeSubject: 'all' };
let focus = { seconds: 25 * 60, running: false, timer: null };

async function loadState() {
  let subjects = await db.all('subjects');
  if (!subjects.length) {
    const general = { id: db.uid('subject'), name: 'General', createdAt: new Date().toISOString() };
    await db.put('subjects', general); subjects = [general];
  }
  const [documents, cards, attempts, settings] = await Promise.all([
    db.all('documents'), db.all('cards'), db.all('attempts'), db.getSettings()
  ]);
  state = { ...state, subjects, documents, cards, attempts, settings, streak: calculateStreak(attempts) };
  refresh();
}

function refresh() {
  renderDocuments(state.documents, state.cards, $('#librarySearch')?.value || '', state.activeSubject);
  renderSubjects(state.subjects, state.documents, state.activeSubject);
  renderDashboard(state.documents, state.cards, state.attempts, state.streak);
  renderProgress(state.documents, state.cards, state.attempts);
  paintProfile(state.settings);
  $('#studySubject').innerHTML = '<option value="all">Mezclar todas las materias</option>' + state.subjects.map(subject => `<option value="${subject.id}">${subject.name.replace(/[<>&"]/g, '')}</option>`).join('');
  const days = examCountdown(state.settings.examDate);
  if (days !== null && days >= 0) $('#timeDelta').textContent = days ? `Tu examen es en ${days} día${days === 1 ? '' : 's'}` : 'Tu examen es hoy';
  const count = state.cards.filter(card => !card.dueAt || new Date(card.dueAt) <= new Date()).length;
  $('#startTodayBtn').disabled = !state.cards.length;
  $('#startStudyBtn').disabled = !state.cards.length;
  $('#startTodayBtn').firstChild.textContent = count ? `Repasar ${Math.min(count, 18)} ahora ` : 'Practicar por adelantado ';
}

function calculateStreak(attempts) {
  const days = new Set(attempts.map(item => item.createdAt.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  const today = cursor.toISOString().slice(0, 10);
  if (!days.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toISOString().slice(0, 10))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
  return streak;
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
      const document = {
        id: db.uid('doc'), name: file.name, type: parsed.type, size: parsed.size,
        subjectId: state.activeSubject === 'all' ? state.subjects[0].id : state.activeSubject,
        text: parsed.text, preview: parsed.text.replace(/\s+/g, ' ').slice(0, 130),
        createdAt: new Date().toISOString(), meta: { pageCount: parsed.pageCount, confidence: parsed.confidence }
      };
      const cards = generateCards(document);
      if (cards.length < 3) throw new Error('Hay muy poco texto útil para crear preguntas fiables.');
      await Promise.all([db.put('documents', document), db.putMany('cards', cards)]);
      state.documents.push(document); state.cards.push(...cards); imported += 1;
    } catch (error) {
      toast(`${file.name}: ${error.message}`, 'error');
    }
  }
  clearBusy(); bindUploadHandlers(); refresh();
  navigator.storage?.persist?.().catch(() => {});
  if (imported) toast(`${imported} material${imported === 1 ? '' : 'es'} listo${imported === 1 ? '' : 's'} para practicar.`);
}

async function deleteDocument(id) {
  const document = state.documents.find(item => item.id === id);
  if (!document || !confirm(`¿Eliminar “${document.name}” y todas sus preguntas?`)) return;
  await Promise.all([db.remove('documents', id), db.removeByIndex('cards', 'docId', id)]);
  const removedCards = new Set(state.cards.filter(card => card.docId === id).map(card => card.id));
  state.documents = state.documents.filter(item => item.id !== id);
  state.cards = state.cards.filter(card => card.docId !== id);
  for (const attempt of state.attempts.filter(item => removedCards.has(item.cardId))) await db.remove('attempts', attempt.id);
  state.attempts = state.attempts.filter(item => !removedCards.has(item.cardId));
  refresh(); toast('Material eliminado del dispositivo.');
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
      await Promise.all([db.put('cards', updated), db.put('attempts', attempt)]);
      state.cards = state.cards.map(item => item.id === updated.id ? updated : item);
      state.attempts.push(attempt);
    },
    onFinish: () => { state.streak = calculateStreak(state.attempts); refresh(); showView('inicio'); }
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
      await Promise.all([db.putMany('attempts', attempts), db.putMany('cards', updates)]);
      state.attempts.push(...attempts);
      const updateMap = new Map(updates.map(card => [card.id, card]));
      state.cards = state.cards.map(card => updateMap.get(card.id) || card);
      $('#examSetup').hidden = false; $('#examSession').hidden = true;
      refresh(); showView('progreso');
    }
  }).start();
}

function setupSettings() {
  const dialog = $('#settingsDialog');
  $('#settingsBtn').addEventListener('click', () => {
    dialog.returnValue = 'cancel';
    $('#examDateSetting').value = state.settings.examDate || '';
    $('#dailyGoalSetting').value = state.settings.dailyGoal || 25;
    $('#studyTimeSetting').value = state.settings.studyTime || '19:00';
    $('#soundSetting').checked = state.settings.sound !== false;
    dialog.showModal();
  });
  dialog.addEventListener('close', async () => {
    if (dialog.returnValue !== 'save') return;
    state.settings = { ...state.settings, examDate: $('#examDateSetting').value, dailyGoal: Number($('#dailyGoalSetting').value), studyTime: $('#studyTimeSetting').value, sound: $('#soundSetting').checked };
    await db.saveSettings(state.settings); toast('Plan de estudio guardado.'); refresh();
  });
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
    try { pendingAvatar = await prepareAvatar(event.target.files[0]); $('#avatarPreview').innerHTML = `<img src="${pendingAvatar}" alt="Vista previa">`; }
    catch (error) { toast(error.message, 'error'); }
  });
  $('#removeAvatarBtn').addEventListener('click', () => { pendingAvatar = null; $('#avatarPreview').textContent = 'YO'; });
  dialog.addEventListener('close', async () => {
    if (dialog.returnValue !== 'save') return;
    state.settings = { ...state.settings, profileName: $('#profileName').value.trim().slice(0, 60) || 'Yo', avatar: pendingAvatar };
    await db.saveSettings(state.settings); paintProfile(state.settings); toast('Perfil local guardado.');
  });
}

function setupFocus() {
  const dialog = $('#focusDialog');
  const paint = () => {
    const value = `${String(Math.floor(focus.seconds / 60)).padStart(2, '0')}:${String(focus.seconds % 60).padStart(2, '0')}`;
    $('#focusBig').textContent = value; $('#focusTime').textContent = value;
    $('#focusToggle').textContent = focus.running ? 'Pausar' : 'Comenzar';
  };
  $('#focusBtn').addEventListener('click', () => dialog.showModal());
  $('#focusToggle').addEventListener('click', () => {
    focus.running = !focus.running;
    clearInterval(focus.timer);
    if (focus.running) focus.timer = setInterval(() => {
      focus.seconds -= 1; paint();
      if (focus.seconds <= 0) { clearInterval(focus.timer); focus.running = false; focus.seconds = 5 * 60; $('#focusState').textContent = 'Descanso breve. Levántate y respira.'; paint(); }
    }, 1000);
    paint();
  });
  $('#focusReset').addEventListener('click', () => { clearInterval(focus.timer); focus = { seconds: 25 * 60, running: false, timer: null }; paint(); });
  paint();
}

async function exportBackup() {
  const payload = await db.exportData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
  link.download = `forja-respaldo-${new Date().toISOString().slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function setupEvents() {
  setupNavigation(); bindUploadHandlers(); setupSettings(); setupSubjects(); setupProfile(); setupFocus();
  $('#addMaterialBtn').addEventListener('click', () => $('#fileInput').click());
  $('#startTodayBtn').addEventListener('click', startStudy);
  $('#startStudyBtn').addEventListener('click', startStudy);
  $('#startExamBtn').addEventListener('click', startExam);
  $('#exportBackupBtn').addEventListener('click', exportBackup);
  $('#librarySearch').addEventListener('input', event => renderDocuments(state.documents, state.cards, event.target.value, state.activeSubject));
  $('#documentGrid').addEventListener('click', event => { const id = event.target.dataset.deleteDoc; if (id) deleteDocument(id); });
}

async function boot() {
  $('#todayLabel').textContent = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  setupEvents(); await loadState();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js?v=20260722-2').catch(() => {});
}

boot().catch(error => { console.error(error); toast('No pude iniciar el almacenamiento local. Revisa el modo privado del navegador.', 'error'); });
