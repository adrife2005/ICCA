const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const cfg = require('./config');
const store = require('./db');
const auth = require('./auth');
const { SECTIONS, ARTWORK_FIELDS } = require('./schema');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = /^(text\/|application\/json|image\/svg)/;

// ---------- cabeceras de seguridad ----------
const CSP_PUBLIC = [
  "default-src 'self'",
  // 'unsafe-eval' lo requiere el CDN de Tailwind que usa galeria.html. Si migras a Tailwind compilado, quítalo.
  "script-src 'self' https://cdnjs.cloudflare.com https://cdn.tailwindcss.com 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
  "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "form-action 'self' https://formsubmit.co",
  "frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'",
].join('; ');
const CSP_ADMIN = [
  "default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data: blob:",
  "connect-src 'self'", "form-action 'self'", "frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'",
].join('; ');

function secHeaders(res, admin) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', admin ? CSP_ADMIN : CSP_PUBLIC);
  if (cfg.PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

// ---------- utilidades ----------
function send(req, res, status, body, headers = {}) {
  const type = headers['Content-Type'] || '';
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  if (COMPRESSIBLE.test(type) && buf.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    headers['Content-Encoding'] = 'gzip';
    headers['Vary'] = 'Accept-Encoding';
    const z = zlib.gzipSync(buf);
    res.writeHead(status, { ...headers, 'Content-Length': z.length });
    return res.end(z);
  }
  res.writeHead(status, { ...headers, 'Content-Length': buf.length });
  res.end(req.method === 'HEAD' ? undefined : buf);
}
const json = (req, res, status, obj, extra = {}) =>
  send(req, res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
const fail = (req, res, status, msg) => json(req, res, status, { error: msg });

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Archivo demasiado grande'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req, limit = 512 * 1024) {
  const b = await readBody(req, limit);
  try { return JSON.parse(b.toString() || '{}'); } catch { throw Object.assign(new Error('JSON inválido'), { status: 400 }); }
}
function cookies(req) {
  const out = {};
  for (const p of (req.headers.cookie || '').split(';')) {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  }
  return out;
}
function clientIp(req) {
  if (cfg.TRUST_PROXY) return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  return req.socket.remoteAddress;
}
function isSecure(req) { return cfg.PROD || req.headers['x-forwarded-proto'] === 'https'; }
function sessionCookie(req, value, maxAge) {
  return `icca_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${isSecure(req) ? '; Secure' : ''}`;
}

// ---------- límite de intentos de login ----------
const attempts = new Map(); // ip -> {n, reset}
const MAX_FAILS = 8, WINDOW = 15 * 60 * 1000;
function loginBlocked(ip) {
  const a = attempts.get(ip);
  if (!a) return 0;
  if (Date.now() > a.reset) { attempts.delete(ip); return 0; }
  return a.n >= MAX_FAILS ? Math.ceil((a.reset - Date.now()) / 60000) : 0;
}
function loginFailed(ip) {
  const a = attempts.get(ip);
  if (!a || Date.now() > a.reset) attempts.set(ip, { n: 1, reset: Date.now() + WINDOW });
  else a.n++;
}
setInterval(() => { for (const [k, v] of attempts) if (Date.now() > v.reset) attempts.delete(k); }, 600000).unref();

// ---------- sesión ----------
function currentUser(req) {
  const data = auth.readToken(cookies(req).icca_session);
  if (!data) return null;
  const u = store.getUserById(data.u);
  if (!u || auth.pwVersion(u.hash) !== data.v) return null;
  return u;
}
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}

// ---------- datos públicos ----------
function publicPayload() {
  const content = store.resolvedContent();
  const artworks = store.listArtworks(true).map((a) => ({
    id: a.id, title: a.title, year: a.year, category: a.category, location: a.location,
    context: a.context, technique: a.technique, symbolism: a.symbolism, secrets: a.secrets,
    audioText: a.audio_text, image: a.image,
  }));
  return { content, artworks };
}

// ---------- API ----------
async function api(req, res, url) {
  const p = url.pathname;
  const m = req.method;

  if (m !== 'GET' && m !== 'HEAD') {
    if (!sameOrigin(req) || req.headers['x-csrf'] !== '1') return fail(req, res, 403, 'Petición no permitida');
  }

  if (p === '/api/login' && m === 'POST') {
    const ip = clientIp(req);
    const wait = loginBlocked(ip);
    if (wait) return fail(req, res, 429, `Demasiados intentos. Intenta de nuevo en ${wait} min.`);
    const { username, password } = await readJson(req, 4096);
    const user = store.getUserByName(String(username || ''));
    const ok = auth.verifyPassword(String(password || ''), user ? user.hash : auth.DUMMY) && !!user;
    if (!ok) { loginFailed(ip); return fail(req, res, 401, 'Usuario o contraseña incorrectos'); }
    attempts.delete(ip);
    return json(req, res, 200, { ok: true, user: user.username },
      { 'Set-Cookie': sessionCookie(req, auth.createToken(user), auth.SESSION_DAYS * 86400) });
  }
  if (p === '/api/logout' && m === 'POST') {
    return json(req, res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
  }

  if (!p.startsWith('/api/admin/')) return fail(req, res, 404, 'No encontrado');
  const user = currentUser(req);
  if (!user) return fail(req, res, 401, 'Sesión expirada');

  if (p === '/api/admin/bootstrap' && m === 'GET') {
    return json(req, res, 200, {
      user: user.username,
      sections: SECTIONS,
      artworkFields: ARTWORK_FIELDS,
      values: store.resolvedContent(),
      artworks: store.listArtworks(false),
    });
  }

  if (p === '/api/admin/content' && m === 'PUT') {
    const { values } = await readJson(req);
    store.saveContent(values);
    return json(req, res, 200, { ok: true, values: store.resolvedContent() });
  }

  if (p === '/api/admin/images' && m === 'POST') {
    const ct = String(req.headers['content-type'] || '');
    if (!ct.startsWith('image/')) return fail(req, res, 415, 'El archivo debe ser una imagen');
    const buf = await readBody(req, cfg.MAX_UPLOAD);
    if (!buf.length) return fail(req, res, 400, 'Archivo vacío');
    try {
      const img = await store.addImage(buf);
      return json(req, res, 201, { image: img });
    } catch (e) {
      console.error('Error procesando imagen:', e.message);
      return fail(req, res, 422, 'No se pudo leer la imagen. Usa JPG, PNG, WebP o similar.');
    }
  }

  if (p === '/api/admin/artworks' && m === 'POST') {
    return json(req, res, 201, { artwork: store.createArtwork(await readJson(req)) });
  }
  if (p === '/api/admin/artworks/reorder' && m === 'POST') {
    const { ids } = await readJson(req);
    if (!Array.isArray(ids)) return fail(req, res, 400, 'ids inválido');
    store.reorderArtworks(ids);
    return json(req, res, 200, { ok: true });
  }
  const am = p.match(/^\/api\/admin\/artworks\/(\d+)$/);
  if (am) {
    const id = Number(am[1]);
    if (m === 'PUT') {
      const a = store.updateArtwork(id, await readJson(req));
      return a ? json(req, res, 200, { artwork: a }) : fail(req, res, 404, 'Obra no encontrada');
    }
    if (m === 'DELETE') return store.deleteArtwork(id) ? json(req, res, 200, { ok: true }) : fail(req, res, 404, 'Obra no encontrada');
  }

  if (p === '/api/admin/password' && m === 'POST') {
    const { current, next } = await readJson(req, 4096);
    if (!auth.verifyPassword(String(current || ''), user.hash)) return fail(req, res, 400, 'La contraseña actual no coincide');
    if (String(next || '').length < 8) return fail(req, res, 400, 'La nueva contraseña debe tener mínimo 8 caracteres');
    store.setPassword(user.id, String(next));
    const fresh = store.getUserById(user.id);
    return json(req, res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, auth.createToken(fresh), auth.SESSION_DAYS * 86400) });
  }

  return fail(req, res, 404, 'No encontrado');
}

// ---------- archivos estáticos ----------
const fileCache = new Map(); // ruta -> {mtime, etag}
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);

  // /uploads/<id>-<ancho>.webp  (inmutables: cache de 1 año)
  if (rel.startsWith('/uploads/')) {
    const name = rel.slice(9);
    if (!/^[a-f0-9]{16}-\d{2,4}\.webp$/.test(name)) return fail(req, res, 404, 'No encontrado');
    return streamFile(req, res, path.join(cfg.UPLOADS_DIR, name), 'public, max-age=31536000, immutable', false);
  }

  const admin = rel === '/admin' || rel.startsWith('/admin/');
  if (rel === '/admin') rel = '/admin/index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(cfg.PUBLIC_DIR, rel));
  if (!file.startsWith(cfg.PUBLIC_DIR + path.sep)) return fail(req, res, 400, 'Ruta inválida');
  const ext = path.extname(file);
  const cache = ext === '.html' ? 'no-cache' : 'public, max-age=300';
  streamFile(req, res, file, cache, admin);
}

function streamFile(req, res, file, cacheControl, admin) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      // Páginas sin extensión (/galeria -> galeria.html)
      if (!path.extname(file) && fs.existsSync(file + '.html')) return streamFile(req, res, file + '.html', cacheControl, admin);
      secHeaders(res, admin);
      return fail(req, res, 404, 'No encontrado');
    }
    const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    secHeaders(res, admin);
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag, 'Cache-Control': cacheControl }); return res.end(); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Cache-Control': cacheControl, ETag: etag };
    fs.readFile(file, (e, buf) => {
      if (e) return fail(req, res, 500, 'Error leyendo archivo');
      send(req, res, 200, buf, headers);
    });
  });
}

// ---------- servidor ----------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      secHeaders(res, true);
      return await api(req, res, url);
    }
    if (url.pathname === '/cms-data.js') {
      secHeaders(res, false);
      const body = 'window.__CMS__=' + JSON.stringify(publicPayload()).replace(/</g, '\\u003c') + ';';
      const etag = '"' + crypto.createHash('md5').update(body).digest('hex') + '"';
      if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); return res.end(); }
      return send(req, res, 200, body, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-cache', ETag: etag });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(req, res, 405, 'Método no permitido');
    serveStatic(req, res, url);
  } catch (e) {
    if (!res.headersSent) fail(req, res, e.status || 500, e.status ? e.message : 'Error interno');
    if (!e.status) console.error(e);
  }
});

(async () => {
  await store.seed();
  if (store.userCount() === 0) {
    const user = process.env.ADMIN_USER || 'icca';
    let pass = process.env.ADMIN_PASSWORD;
    let generated = false;
    if (!pass) { pass = crypto.randomBytes(9).toString('base64url'); generated = true; }
    store.upsertUser(user, pass);
    console.log('\n──────── Usuario inicial del dashboard ────────');
    console.log(`  usuario:    ${user}`);
    console.log(`  contraseña: ${generated ? pass : '(la de ADMIN_PASSWORD)'}`);
    console.log('  Cámbiala desde el dashboard → Cuenta.');
    console.log('────────────────────────────────────────────────\n');
  }
  server.listen(cfg.PORT, () => {
    console.log(`Sitio:      http://localhost:${cfg.PORT}`);
    console.log(`Dashboard:  http://localhost:${cfg.PORT}/admin`);
  });
})();
