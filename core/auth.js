'use strict';
const crypto = require('crypto'), bcrypt = require('bcryptjs');
const store = require('./store'), sec = require('./security'), audit = require('./audit');
const SECRET = sec.loadSecret();
const TTL_SEC = Number(process.env.NABZ_TOKEN_TTL_SEC || 8 * 3600);
const COST = 10;
const DUMMY_HASH = bcrypt.hashSync('nabz-dummy-' + crypto.randomBytes(4).toString('hex'), 8);
const b64url = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const E = (code, msg, extra) => Object.assign(new Error(msg), { code, ...(extra || {}) });
function sign(payload) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + TTL_SEC }));
  const s = b64url(crypto.createHmac('sha256', SECRET).update(head + '.' + body).digest());
  return head + '.' + body + '.' + s;
}
function verify(token) {
  try {
    const [h, b, s] = String(token || '').split('.');
    if (!h || !b || !s) return null;
    const hd = JSON.parse(Buffer.from(h, 'base64').toString('utf8'));
    if (hd.alg !== 'HS256') return null;
    const expected = b64url(crypto.createHmac('sha256', SECRET).update(h + '.' + b).digest());
    if (!sec.safeEqual(s, expected)) return null;
    const p = JSON.parse(Buffer.from(b, 'base64').toString('utf8'));
    if (!p.exp || p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch (_) { return null; }
}
function tokenFor(user) { return sign({ id: user.id, username: user.username, role: user.role, ward: user.ward || null, tv: user.tokenVersion || 0 }); }
function publicUser(u) {
  return { id: u.id, username: u.username, fullName: u.fullName, role: u.role, ward: u.ward || null, services: u.services || [],
    staffId: u.staffId || null, mustChangePassword: !!u.mustChangePassword };
}
function login(username, password) {
  const user = store.readAll('users').find(u => u.username === username);
  let ok = false;
  if (user && user.active !== false) {
    if (user.passwordHash) ok = bcrypt.compareSync(String(password), user.passwordHash);
    else if (typeof user.password === 'string') {
      ok = sec.safeEqual(password, user.password);
      if (ok) { user.passwordHash = bcrypt.hashSync(String(password), COST); delete user.password; store.put('users', user); }
    }
  } else bcrypt.compareSync(String(password), DUMMY_HASH);
  if (!ok) throw E(401, 'invalid_credentials');
  user.lastLoginAt = new Date().toISOString(); store.put('users', user);
  const _cfg = require('./security-config');
  return { token: tokenFor(user), user: publicUser(user), mustChangePassword: !!user.mustChangePassword, forcePasswordChangeActive: _cfg.isForcePasswordChangeActive() };
}
function changePassword(userId, oldPw, newPw) {
  const user = store.get('users', userId);
  if (!user) throw E(404, 'user_not_found');
  if (!user.passwordHash || !bcrypt.compareSync(String(oldPw || ''), user.passwordHash)) throw E(400, 'invalid_old_password');
  const pe = sec.policyError(newPw, user); if (pe) throw E(400, pe);
  if (bcrypt.compareSync(String(newPw), user.passwordHash)) throw E(400, 'password_must_differ');
  user.passwordHash = bcrypt.hashSync(String(newPw), COST);
  user.mustChangePassword = false; user.passwordChangedAt = new Date().toISOString(); delete user.plainHint;
  store.put('users', user);
  try { audit.write('auth', 'password_changed', user.id, user, {}); } catch (_) {}
  return { changed: true, mustChangePassword: false, token: tokenFor(user), user: publicUser(user) };
}
function adminResetPassword(actor, userId, newPw) {
  const user = store.get('users', userId);
  if (!user) throw E(404, 'user_not_found');
  const generated = !newPw; const pw = newPw || sec.tempPassword();
  if (!generated) { const pe = sec.policyError(pw, user); if (pe) throw E(400, pe); }
  user.passwordHash = bcrypt.hashSync(String(pw), COST);
  user.mustChangePassword = true; user.tokenVersion = (user.tokenVersion || 0) + 1; delete user.plainHint; delete user.password;
  user.passwordResetAt = new Date().toISOString();
  store.put('users', user); sec.unlock(user.username);
  try { audit.write('auth', 'password_reset_by_admin', user.id, actor, { target: user.username }); } catch (_) {}
  return { userId: user.id, username: user.username, mustChangePassword: true, ...(generated ? { tempPassword: pw } : {}) };
}
function seedAdmin() {
  const users = store.readAll('users');
  if (users.length) return;
  store.put('users', { id: 'usr_admin', username: 'admin', fullName: 'مدیر سیستم', role: 'admin', active: true,
    passwordHash: bcrypt.hashSync('nabz@2026', COST), mustChangePassword: true, createdAt: new Date().toISOString() });
  console.log('[auth] admin seeded (admin / nabz@2026 — password change required at first login)');
}
module.exports = { login, verify, sign, tokenFor, publicUser, changePassword, adminResetPassword, seedAdmin, TTL_SEC };
