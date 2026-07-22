const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function initials(name = 'Yo') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase() || 'YO';
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

export async function prepareAvatar(file) {
  if (!ACCEPTED.has(file.type)) throw new Error('Usa una imagen JPG, PNG o WebP.');
  if (file.size > 3 * 1024 * 1024) throw new Error('La foto de perfil no puede superar 3 MB.');
  const bitmap = await createImageBitmap(file);
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

export function paintProfile(settings) {
  const button = document.querySelector('#profileBtn');
  const preview = document.querySelector('#avatarPreview');
  const name = settings.profileName || 'Yo';
  if (settings.avatar) {
    button.innerHTML = `<img src="${settings.avatar}" alt="">`;
    preview.innerHTML = `<img src="${settings.avatar}" alt="Vista previa de la foto de perfil">`;
  } else {
    button.textContent = initials(name); preview.textContent = initials(name);
  }
  button.title = `Perfil local de ${name}`;
}
