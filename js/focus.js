const $ = selector => document.querySelector(selector);

export function setupFocusTimer() {
  const dialog = $('#focusDialog');
  let remaining = 25 * 60;
  let running = false;
  let deadline = 0;
  let timer = null;

  const paint = () => {
    const value = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    $('#focusBig').textContent = value; $('#focusTime').textContent = value;
    $('#focusToggle').textContent = running ? 'Pausar' : 'Comenzar';
  };
  const stopWakeups = () => { clearTimeout(timer); timer = null; };
  const tick = () => {
    stopWakeups();
    if (!running) return paint();
    remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); paint();
    if (!remaining) {
      running = false; remaining = 5 * 60;
      $('#focusState').textContent = 'Descanso breve. Levántate y respira.'; paint(); return;
    }
    if (!document.hidden) timer = setTimeout(tick, Math.min(1000, deadline - Date.now()));
  };
  const toggle = () => {
    if (running) { remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); running = false; stopWakeups(); }
    else { running = true; deadline = Date.now() + remaining * 1000; tick(); }
    paint();
  };
  const reset = () => { running = false; remaining = 25 * 60; stopWakeups(); $('#focusState').textContent = 'Una tarea. Sin cambiar de pestaña.'; paint(); };

  $('#focusBtn').addEventListener('click', () => dialog.showModal());
  $('#focusToggle').addEventListener('click', toggle);
  $('#focusReset').addEventListener('click', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopWakeups(); else if (running) tick(); });
  paint();
}
