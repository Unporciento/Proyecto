export const PALETTES = Object.freeze({
  forja: '#b9ef73', ocean: '#65b9f4', amethyst: '#b69cff',
  coral: '#ff8b78', solar: '#f3c65f', rose: '#f28fb4'
});

export function normalizeHex(value, fallback = PALETTES.forja) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value.toLowerCase() : fallback;
}

export function resolveAccent(settings = {}) {
  if (settings.palette === 'custom') return normalizeHex(settings.customAccent);
  return PALETTES[settings.palette] || PALETTES.forja;
}

function channels(hex) {
  const safe = normalizeHex(hex).slice(1);
  return [0, 2, 4].map(index => Number.parseInt(safe.slice(index, index + 2), 16));
}

export function contrastText(hex) {
  const [r, g, b] = channels(hex).map(value => {
    const channel = value / 255;
    return channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return .2126 * r + .7152 * g + .0722 * b > .22 ? '#102016' : '#ffffff';
}

function mixWithWhite(hex, amount = .24) {
  const mixed = channels(hex).map(value => Math.round(value + (255 - value) * amount));
  return `#${mixed.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

export function applyTheme(settings = {}, root = document.documentElement) {
  const allowedModes = new Set(['dark', 'light']);
  if (allowedModes.has(settings.themeMode)) root.dataset.theme = settings.themeMode;
  else delete root.dataset.theme;
  const accent = resolveAccent(settings);
  const [r, g, b] = channels(accent);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-2', mixWithWhite(accent));
  root.style.setProperty('--accent-rgb', `${r} ${g} ${b}`);
  root.style.setProperty('--accent-contrast', contrastText(accent));
  root.style.colorScheme = settings.themeMode === 'light' ? 'light' : settings.themeMode === 'dark' ? 'dark' : 'light dark';
  const meta = root.ownerDocument?.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = settings.themeMode === 'light' ? '#f4f7f5' : '#0b100e';
}
