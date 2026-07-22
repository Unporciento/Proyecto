const PDF_VERSION = '4.10.38';
const MAMMOTH_VERSION = '1.9.0';
const TESSERACT_VERSION = '6.0.1';

function extension(name) {
  return name.toLowerCase().split('.').pop();
}

async function verifySignature(file, ext) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = String.fromCharCode(...bytes);
  const starts = (...values) => values.every((value, index) => bytes[index] === value);
  const valid = {
    pdf: ascii.startsWith('%PDF'),
    docx: starts(0x50, 0x4b),
    png: starts(0x89, 0x50, 0x4e, 0x47),
    jpg: starts(0xff, 0xd8, 0xff),
    jpeg: starts(0xff, 0xd8, 0xff),
    webp: ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP'
  };
  if (ext in valid && !valid[ext]) throw new Error('El contenido real no coincide con la extensión del archivo.');
  if (['txt', 'md', 'markdown'].includes(ext) && bytes.includes(0)) throw new Error('El archivo de texto contiene datos binarios no permitidos.');
}

function loadScript(src, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(window[globalName]);
    script.onerror = () => reject(new Error(`No se pudo cargar ${globalName}. Revisa tu conexión.`));
    document.head.appendChild(script);
  });
}

async function waitUntilVisible() {
  if (!document.hidden) return;
  await new Promise(resolve => document.addEventListener('visibilitychange', resolve, { once: true }));
}

async function optimizeImage(file) {
  if (!('createImageBitmap' in window)) return file;
  const bitmap = await createImageBitmap(file);
  const maxEdge = document.documentElement.dataset.energy === 'saver' ? 2200 : 2800;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1) { bitmap.close?.(); return file; }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No pude preparar la imagen.')), 'image/jpeg', .9));
}

async function parsePdf(file, onProgress) {
  onProgress?.('Abriendo PDF…');
  const pdfjs = await import(`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDF_VERSION}/build/pdf.min.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDF_VERSION}/build/pdf.worker.min.mjs`;
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    await waitUntilVisible();
    onProgress?.(`Leyendo página ${number} de ${pdf.numPages}…`);
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(' '));
  }
  const text = pages.join('\n\n');
  if (text.trim().length < 80) throw new Error('Este PDF parece escaneado. Súbelo como imágenes para usar OCR.');
  return { text, pageCount: pdf.numPages };
}

async function parseDocx(file, onProgress) {
  onProgress?.('Extrayendo texto de Word…');
  const mammoth = await loadScript(`https://cdn.jsdelivr.net/npm/mammoth@${MAMMOTH_VERSION}/mammoth.browser.min.js`, 'mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  if (!result.value.trim()) throw new Error('No se encontró texto legible en el documento Word.');
  return { text: result.value, warnings: result.messages.length };
}

async function parseImage(file, onProgress) {
  onProgress?.('Preparando reconocimiento de imagen…');
  const Tesseract = await loadScript(`https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`, 'Tesseract');
  await waitUntilVisible();
  const source = await optimizeImage(file);
  const result = await Tesseract.recognize(source, 'spa', {
    logger: message => {
      if (message.status === 'recognizing text') onProgress?.(`Reconociendo texto · ${Math.round((message.progress || 0) * 100)}%`);
    }
  });
  if (result.data.text.trim().length < 20) throw new Error('No pude reconocer suficiente texto en esta imagen. Prueba una foto más nítida.');
  return { text: result.data.text, confidence: result.data.confidence };
}

export async function parseFile(file, onProgress) {
  await waitUntilVisible();
  const ext = extension(file.name);
  const max = 35 * 1024 * 1024;
  if (file.size > max) throw new Error('El archivo supera 35 MB. Divídelo en partes para procesarlo mejor.');
  if (!file.size) throw new Error('El archivo está vacío.');
  await verifySignature(file, ext);
  let result;
  if (ext === 'pdf') result = await parsePdf(file, onProgress);
  else if (ext === 'docx') result = await parseDocx(file, onProgress);
  else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) result = await parseImage(file, onProgress);
  else if (['txt', 'md', 'markdown'].includes(ext)) result = { text: await file.text() };
  else throw new Error(`El formato .${ext} todavía no es compatible.`);
  return { ...result, type: ext, size: file.size };
}
