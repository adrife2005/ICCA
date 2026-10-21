const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { DATA_DIR, ROOT } = require('./config');
const { SECTIONS, ARTWORK_FIELDS, FIELD_INDEX } = require('./schema');
const { processImage, removeFiles, imageView } = require('./images');
const { hashPassword } = require('./auth');

const db = new DatabaseSync(path.join(DATA_DIR, 'icca.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS content (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY, w INTEGER, h INTEGER, color TEXT,
    widths TEXT NOT NULL, sizes TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS artworks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL, year TEXT DEFAULT '', category TEXT DEFAULT '', location TEXT DEFAULT '',
    context TEXT DEFAULT '', technique TEXT DEFAULT '', symbolism TEXT DEFAULT '', secrets TEXT DEFAULT '',
    audio_text TEXT DEFAULT '',
    image_id TEXT,
    published INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`);

const tx = (fn) => {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
};

// ---------- imágenes ----------
async function addImage(buffer) {
  const r = await processImage(buffer);
  db.prepare('INSERT INTO images (id,w,h,color,widths,sizes) VALUES (?,?,?,?,?,?)')
    .run(r.id, r.w, r.h, r.color, JSON.stringify(r.widths), JSON.stringify(r.sizes));
  return { ...imageView({ ...r }), srcBytes: r.srcBytes };
}
const getImage = (id) => (id ? imageView(db.prepare('SELECT * FROM images WHERE id=?').get(id)) : null);
const imageExists = (id) => !!db.prepare('SELECT 1 FROM images WHERE id=?').get(id);

// Borra imágenes que ya nadie usa (con 30 min de gracia por si se acaban de subir)
function gcImages() {
  const used = new Set();
  for (const row of db.prepare('SELECT key,value FROM content').all()) {
    if (FIELD_INDEX[row.key]?.type === 'image') { try { used.add(JSON.parse(row.value)); } catch {} }
  }
  for (const a of db.prepare('SELECT image_id FROM artworks').all()) used.add(a.image_id);
  const old = db.prepare("SELECT * FROM images WHERE created_at < datetime('now','-30 minutes')").all();
  for (const img of old) {
    if (used.has(img.id) || img.id === getMeta('seed_image')) continue;
    removeFiles(img.id, JSON.parse(img.widths));
    db.prepare('DELETE FROM images WHERE id=?').run(img.id);
  }
}

// ---------- meta ----------
const getMeta = (k) => db.prepare('SELECT value FROM meta WHERE key=?').get(k)?.value;
const setMeta = (k, v) => db.prepare('INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)').run(k, String(v));

// ---------- contenido ----------
function rawContent() {
  const stored = {};
  for (const r of db.prepare('SELECT key,value FROM content').all()) {
    try { stored[r.key] = JSON.parse(r.value); } catch {}
  }
  const seed = getMeta('seed_image');
  const out = {};
  for (const f of Object.values(FIELD_INDEX)) {
    if (f.key in stored) out[f.key] = stored[f.key];
    else if (f.type === 'image') out[f.key] = seed || '';
    else out[f.key] = f.def ?? (f.type === 'list' ? [] : '');
  }
  return out;
}

function resolvedContent() {
  const raw = rawContent();
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = FIELD_INDEX[k].type === 'image' ? getImage(v) : v;
  }
  return out;
}

const cleanStr = (v, max) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max || 500);

function cleanValue(f, v) {
  if (f.type === 'image') {
    if (v === '' || v == null) return '';
    if (!imageExists(v)) throw new Error(`Imagen no encontrada para "${f.label}"`);
    return String(v);
  }
  if (f.type === 'list') {
    if (!Array.isArray(v)) throw new Error(`"${f.label}" debe ser una lista`);
    return v.slice(0, f.max || 20).map((it) => {
      const o = {};
      for (const sf of f.itemFields) o[sf.key] = cleanStr(it?.[sf.key], sf.max);
      return o;
    });
  }
  let s = cleanStr(v, f.max);
  if (f.type === 'url' && s && !/^https?:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  if (f.key === 'whatsapp_number') s = s.replace(/\D/g, '');
  return s;
}

function saveContent(values) {
  tx(() => {
    const st = db.prepare('INSERT OR REPLACE INTO content (key,value) VALUES (?,?)');
    for (const [k, v] of Object.entries(values || {})) {
      const f = FIELD_INDEX[k];
      if (!f) throw new Error(`Campo desconocido: ${k}`);
      st.run(k, JSON.stringify(cleanValue(f, v)));
    }
  });
  gcImages();
}

// ---------- obras ----------
function artworkRow(a) {
  return {
    id: a.id, title: a.title, year: a.year, category: a.category, location: a.location,
    context: a.context, technique: a.technique, symbolism: a.symbolism, secrets: a.secrets,
    audio_text: a.audio_text, published: !!a.published, image: getImage(a.image_id),
  };
}
const listArtworks = (onlyPublished) =>
  db.prepare(`SELECT * FROM artworks ${onlyPublished ? 'WHERE published=1' : ''} ORDER BY sort_order, id`).all().map(artworkRow);

function cleanArtwork(body, partial) {
  const o = {};
  for (const f of ARTWORK_FIELDS) {
    if (partial && !(f.key in body)) continue;
    if (f.type === 'image') {
      if (!imageExists(body.image)) throw new Error('Falta la imagen de la obra');
      o.image_id = body.image;
    } else {
      o[f.key] = cleanStr(body[f.key], f.max);
      if (f.required && !o[f.key]) throw new Error(`Falta: ${f.label}`);
    }
  }
  if ('published' in body) o.published = body.published ? 1 : 0;
  return o;
}

function createArtwork(body) {
  const o = cleanArtwork(body, false);
  const next = (db.prepare('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM artworks').get().n);
  const cols = Object.keys(o).concat('sort_order');
  const r = db.prepare(`INSERT INTO artworks (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
    .run(...Object.values(o), next);
  return artworkRow(db.prepare('SELECT * FROM artworks WHERE id=?').get(r.lastInsertRowid));
}

function updateArtwork(id, body) {
  const cur = db.prepare('SELECT * FROM artworks WHERE id=?').get(id);
  if (!cur) return null;
  const o = cleanArtwork(body, true);
  const cols = Object.keys(o);
  if (cols.length) db.prepare(`UPDATE artworks SET ${cols.map((c) => c + '=?').join(',')} WHERE id=?`).run(...Object.values(o), id);
  gcImages();
  return artworkRow(db.prepare('SELECT * FROM artworks WHERE id=?').get(id));
}

function deleteArtwork(id) {
  const r = db.prepare('DELETE FROM artworks WHERE id=?').run(id);
  gcImages();
  return r.changes > 0;
}

function reorderArtworks(ids) {
  tx(() => {
    const st = db.prepare('UPDATE artworks SET sort_order=? WHERE id=?');
    ids.forEach((id, i) => st.run(i + 1, Number(id)));
  });
}

// ---------- usuarios ----------
const getUserByName = (u) => db.prepare('SELECT * FROM users WHERE username=?').get(String(u).toLowerCase());
const getUserById = (id) => db.prepare('SELECT * FROM users WHERE id=?').get(id);
function upsertUser(username, password) {
  const hash = hashPassword(password);
  const u = String(username).toLowerCase();
  const ex = getUserByName(u);
  if (ex) db.prepare('UPDATE users SET hash=? WHERE id=?').run(hash, ex.id);
  else db.prepare('INSERT INTO users (username,hash) VALUES (?,?)').run(u, hash);
}
const setPassword = (id, password) => db.prepare('UPDATE users SET hash=? WHERE id=?').run(hashPassword(password), id);
const userCount = () => db.prepare('SELECT COUNT(*) AS n FROM users').get().n;

// ---------- primer arranque ----------
async function seed() {
  if (!getMeta('seed_image')) {
    const f = path.join(ROOT, 'public', 'img', 'img_proyecto.jpg');
    if (fs.existsSync(f)) {
      const img = await addImage(fs.readFileSync(f));
      setMeta('seed_image', img.id);
    }
  }
  if (!getMeta('seed_artworks')) {
    const seedImg = getMeta('seed_image');
    if (seedImg && db.prepare('SELECT COUNT(*) AS n FROM artworks').get().n === 0) {
      const demo = [
        ['El Vuelo de la Noche', '2024', 'Tinta & óleo sobre lienzo'],
        ['El Aquelarre Rojo', '2024', 'Edición limitada'],
        ['La Atalaya Silenciosa', '2023', 'Técnica mixta'],
      ];
      for (const [title, year, category] of demo) {
        createArtwork({
          title, year, category, location: 'Colección privada', image: seedImg, published: true,
          context: 'Escribe aquí el contexto de la obra desde el dashboard.',
          technique: 'Describe la técnica utilizada.',
          symbolism: 'Explica el simbolismo de la pieza.',
          secrets: 'Cuenta una curiosidad que pocos conocen.',
          audio_text: `Bienvenido a ${title}. Edita este texto desde el dashboard para personalizar la audioguía.`,
        });
      }
    }
    setMeta('seed_artworks', '1');
  }
}

module.exports = {
  db, seed, addImage, getImage, gcImages, rawContent, resolvedContent, saveContent,
  listArtworks, createArtwork, updateArtwork, deleteArtwork, reorderArtworks,
  getUserByName, getUserById, upsertUser, setPassword, userCount, SECTIONS, ARTWORK_FIELDS,
};
