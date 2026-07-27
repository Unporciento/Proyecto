export const FORJA_VERSION = '2.0.0';

const $ = selector => document.querySelector(selector);
let errorShown = false;

function setConnectionState() {
  const offline = !navigator.onLine;
  const banner = $('#connectionBanner');
  banner.hidden = !offline;
  document.documentElement.toggleAttribute('data-offline', offline);
}

function showSafeError() {
  if (errorShown) return;
  errorShown = true;
  const message = document.createElement('div');
  message.className = 'toast error';
  message.textContent = 'Algo no terminó correctamente. Tus datos locales no fueron borrados.';
  $('#toastRegion')?.append(message);
  setTimeout(() => {
    message.remove();
    errorShown = false;
  }, 6000);
}

function finishLoading() {
  const splash = $('#appSplash');
  if (!splash) return;
  splash.classList.add('leaving');
  setTimeout(() => splash.remove(), 360);
}

function setupIdentity() {
  const year = String(new Date().getFullYear());
  $('#copyrightYear').textContent = year;
  $('#productVersion').textContent = `v${FORJA_VERSION}`;
  document.documentElement.dataset.forjaVersion = FORJA_VERSION;
}

function setup() {
  setupIdentity();
  setConnectionState();
  window.addEventListener('online', setConnectionState);
  window.addEventListener('offline', setConnectionState);
  window.addEventListener('error', showSafeError);
  window.addEventListener('unhandledrejection', showSafeError);
  if (document.readyState === 'complete') finishLoading();
  else window.addEventListener('load', finishLoading, { once: true });
  window.dispatchEvent(new CustomEvent('forja:module-ready', {
    detail: { module: 'ux', version: FORJA_VERSION }
  }));
}

setup();
