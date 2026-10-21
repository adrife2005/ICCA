const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { UPLOADS_DIR } = require('./config');

sharp.cache(false);

const WIDTHS = [480, 960, 1600, 2400];
const QUALITY = 80;

// Recibe el archivo tal cual lo subió la artista (jpg/png/webp/heic*/etc.) y genera
// versiones WebP livianas en varios tamaños. Se descarta el EXIF (ubicación, cámara...).
async function processImage(buffer) {
  const img = sharp(buffer, { limitInputPixels: 120e6, failOn: 'error' });
  const meta = await img.metadata(); // lanza error si no es una imagen válida
  if (!meta.width || !meta.height) throw new Error('Imagen inválida');

  // Respeta la rotación EXIF antes de medir
  const rotated = (meta.orientation || 1) >= 5;
  const origW = rotated ? meta.height : meta.width;
  const origH = rotated ? meta.width : meta.height;

  let widths = WIDTHS.filter((w) => w < origW);
  widths.push(Math.min(origW, 2400)); // la mayor variante nunca sube de tamaño original
  widths = [...new Set(widths)].sort((a, b) => a - b);

  const id = crypto.randomBytes(8).toString('hex');
  const stats = await sharp(buffer).rotate().resize(32).stats();
  const [r, g, b] = stats.dominant ? [stats.dominant.r, stats.dominant.g, stats.dominant.b] : [20, 20, 20];
  const color = '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');

  const sizes = {};
  for (const w of widths) {
    const out = path.join(UPLOADS_DIR, `${id}-${w}.webp`);
    const info = await sharp(buffer, { limitInputPixels: 120e6 })
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 4 })
      .toFile(out);
    sizes[w] = info.size;
  }

  const h = Math.round((origH / origW) * widths[widths.length - 1]);
  return { id, w: widths[widths.length - 1], h, color, widths, sizes, srcBytes: buffer.length };
}

function removeFiles(id, widths) {
  for (const w of widths) {
    try { fs.unlinkSync(path.join(UPLOADS_DIR, `${id}-${w}.webp`)); } catch {}
  }
}

// Convierte el registro de DB en lo que consume el front
function imageView(rec) {
  if (!rec) return null;
  const widths = typeof rec.widths === 'string' ? JSON.parse(rec.widths) : rec.widths;
  const sizes = typeof rec.sizes === 'string' ? JSON.parse(rec.sizes) : rec.sizes;
  const url = (w) => `/uploads/${rec.id}-${w}.webp`;
  const upTo1600 = widths.filter((w) => w <= 1600);
  const srcW = upTo1600.length ? upTo1600[upTo1600.length - 1] : widths[0];
  const upTo960 = widths.filter((w) => w <= 960);
  const thumbW = upTo960.length ? upTo960[upTo960.length - 1] : widths[0];
  return {
    id: rec.id,
    thumb: url(thumbW),
    src: url(srcW),
    full: url(widths[widths.length - 1]),
    srcset: upTo1600.map((w) => `${url(w)} ${w}w`).join(', '),
    w: rec.w, h: rec.h, color: rec.color,
    kb: Math.round((sizes[srcW] || 0) / 1024),
  };
}

module.exports = { processImage, removeFiles, imageView };
