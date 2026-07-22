const MOBILE_QUERY = '(max-width: 760px)';
const VIEWS = new Set(['inicio', 'biblioteca', 'estudiar', 'examen', 'progreso']);
let api;

export function resolveView(value) {
  return VIEWS.has(value) ? value : null;
}

export function isDismissSwipe({ startX, startY, endX, endY, durationMs, viewportWidth = 390 }) {
  const horizontal = endX - startX;
  const vertical = Math.abs(endY - startY);
  const threshold = Math.min(82, viewportWidth * .18);
  return durationMs <= 700 && horizontal <= -threshold && Math.abs(horizontal) > vertical * 1.25;
}

export function closeDrawer(options = {}) {
  api?.close(options);
}

export function setupDrawer() {
  if (api) return api;
  const sidebar = document.querySelector('#sidebar');
  const toggle = document.querySelector('#menuBtn');
  const closeButton = document.querySelector('#sidebarClose');
  const backdrop = document.querySelector('#navBackdrop');
  const main = document.querySelector('#main');
  const media = window.matchMedia(MOBILE_QUERY);
  let gesture = null;

  const isOpen = () => sidebar.classList.contains('open');
  const sync = () => {
    const mobile = media.matches;
    const open = mobile && isOpen();
    toggle.setAttribute('aria-expanded', String(open));
    sidebar.toggleAttribute('aria-hidden', mobile && !open);
    sidebar.inert = mobile && !open;
    main.inert = open;
    backdrop.hidden = !open;
    document.body.classList.toggle('nav-open', open);
  };
  const close = ({ restoreFocus = true, focusMain = false } = {}) => {
    const wasOpen = isOpen();
    sidebar.classList.remove('open'); sync();
    if (!wasOpen) return;
    if (focusMain) requestAnimationFrame(() => main.focus({ preventScroll: true }));
    else if (restoreFocus) requestAnimationFrame(() => toggle.focus({ preventScroll: true }));
  };
  const open = () => { if (media.matches) { sidebar.classList.add('open'); sync(); closeButton.focus({ preventScroll: true }); } };

  toggle.addEventListener('click', () => isOpen() ? close() : open());
  closeButton.addEventListener('click', () => close());
  backdrop.addEventListener('click', () => close());
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && isOpen()) { event.preventDefault(); close(); } });
  document.addEventListener('pointerdown', event => {
    if (isOpen() && !sidebar.contains(event.target) && !toggle.contains(event.target)) close();
  }, { capture: true });
  sidebar.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') gesture = { startX: event.clientX, startY: event.clientY, startedAt: performance.now() };
  });
  sidebar.addEventListener('pointerup', event => {
    if (gesture && isDismissSwipe({ ...gesture, endX: event.clientX, endY: event.clientY, durationMs: performance.now() - gesture.startedAt, viewportWidth: innerWidth })) close();
    gesture = null;
  });
  sidebar.addEventListener('pointercancel', () => { gesture = null; });
  const onMediaChange = () => { sidebar.classList.remove('open'); sync(); };
  if (media.addEventListener) media.addEventListener('change', onMediaChange);
  else media.addListener(onMediaChange);
  window.addEventListener('orientationchange', () => close({ restoreFocus: false }));
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close('cancel'); }));
  api = { open, close, isOpen, sync }; sync(); return api;
}
