const crypto = require('crypto');
const { SECRET } = require('./config');

const SESSION_DAYS = 7;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

const DUMMY = hashPassword('dummy-password-for-timing');

function verifyPassword(password, stored) {
  try {
    const [alg, saltHex, hashHex] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    return crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}

const b64 = (b) => Buffer.from(b).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
const pwVersion = (hash) => crypto.createHash('sha256').update(hash).digest('hex').slice(0, 12);

function createToken(user) {
  const payload = b64(JSON.stringify({
    u: user.id,
    v: pwVersion(user.hash), // si cambia la contraseña, las sesiones viejas dejan de servir
    exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400,
  }));
  return `${payload}.${sign(payload)}`;
}

function readToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.exp || data.exp < Date.now() / 1000) return null;
    return data;
  } catch { return null; }
}

module.exports = { hashPassword, verifyPassword, createToken, readToken, pwVersion, DUMMY, SESSION_DAYS };
