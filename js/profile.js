const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AVATAR_PATTERN = /^data:image\/jpeg;base64,[a-z0-9+/=]+$/i;

export function initials(name = 'Yo') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase() || 'YO';
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

export async function prepareAvatar(file) {
  if (!file) throw new Error('Elige una imagen primero.');
  if (!ACCEPTED.has(file.type)) throw new Error('Usa una imagen JPG, PNG o WebP.');
  if (file.size > 3 * 1024 * 1024) throw new Error('La foto de perfil no puede superar 3 MB.');
  const bitmap = await loadImage(file);
  const size = 256;
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  const context = canvas.getContext('2d', { alpha: false });
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const width = bitmap.width * scale; const height = bitmap.height * scale;
  context.fillStyle = '#111815'; context.fillRect(0, 0, size, size);
  context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', .82);
}

async function loadImage(file) {
  if ('createImageBitmap' in globalThis) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally { URL.revokeObjectURL(url); }
}

export function isSafeAvatar(value) {
  return typeof value === 'string' && value.length <= 400_000 && AVATAR_PATTERN.test(value);
}

export function paintAvatarPreview(target, avatar, fallback = 'YO', alt = '') {
  target.replaceChildren();
  if (!isSafeAvatar(avatar)) { target.textContent = fallback; return; }
  const image = document.createElement('img');
  image.src = avatar; image.alt = alt;
  target.appendChild(image);
}

export function paintProfile(settings) {
  const button = document.querySelector('#profileBtn');
  const preview = document.querySelector('#avatarPreview');
  const name = settings.profileName || 'Yo';
  const fallback = initials(name);
  paintAvatarPreview(button, settings.avatar, fallback);
  paintAvatarPreview(preview, settings.avatar, fallback, 'Vista previa de la foto de perfil');
  button.title = `Perfil local de ${name}`;
}
