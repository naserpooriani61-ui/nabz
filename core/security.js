'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const store = require('./store');
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const f = path.join(store.DATA, '_jwt_secret');
  try { const s = fs.readFileSync(f, 'utf8').trim(); if (s.length >= 32) return s; } catch (_) {}
  const s = crypto.randomBytes(48).toString('hex');
  try { fs.writeFileSync(f, s, { mode: 0o600 }); } catch (e) { console.error('[security] cannot persist JWT secret:', e.message); }
  return s;
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  if (x.length !== y.length) { crypto.timingSafeEqual(x, x); return false; }
  return crypto.timingSafeEqual(x, y);
}
const USER_MAX = Number(process.env.NABZ_LOGIN_MAX_FAILS || 5);
const USER_LOCK_MS = 5 * 60 * 1000, USER_LOCK_MAX_MS = 30 * 60 * 1000;
const IP_MAX = Number(process.env.NABZ_LOGIN_IP_MAX_FAILS || 40), IP_WINDOW = 10 * 60 * 1000;
const _u = new Map(), _ip = new Map();
const keyU = u => String(u || '').toLowerCase().slice(0, 80);
function check(username, ip) {
  const now = Date.now();
  const u = _u.get(keyU(username)); if (u && u.until > now) return { allowed: false, retryAfter: Math.ceil((u.until - now) / 1000), scope: 'user' };
  const i = _ip.get(ip); if (i && i.until > now) return { allowed: false, retryAfter: Math.ceil((i.until - now) / 1000), scope: 'ip' };
  return { allowed: true };
}
function fail(username, ip) {
  const now = Date.now(), k = keyU(username);
  const u = _u.get(k) || { n: 0, locks: 0, until: 0, last: 0 };
  if (now - u.last > 30 * 60 * 1000) { u.n = 0; }
  u.n++; u.last = now;
  if (u.n >= USER_MAX) { u.locks++; u.n = 0; u.until = now + Math.min(USER_LOCK_MS * Math.pow(2, u.locks - 1), USER_LOCK_MAX_MS); }
  _u.set(k, u);
  const i = _ip.get(ip) || { n: 0, first: now, until: 0 };
  if (now - i.first > IP_WINDOW) { i.n = 0; i.first = now; }
  i.n++; if (i.n >= IP_MAX) { i.until = now + IP_WINDOW; i.n = 0; i.first = now; }
  _ip.set(ip, i);
  if (_u.size > 5000) for (const [kk, v] of _u) if (v.until < now && now - v.last > 3600000) _u.delete(kk);
  if (_ip.size > 5000) for (const [kk, v] of _ip) if (v.until < now && now - v.first > IP_WINDOW) _ip.delete(kk);
}
function success(username) { _u.delete(keyU(username)); }
function lockState() {
  const now = Date.now(); let users = 0, ips = 0;
  for (const v of _u.values()) if (v.until > now) users++;
  for (const v of _ip.values()) if (v.until > now) ips++;
  return { lockedUsers: users, blockedIps: ips };
}
function unlock(username) { _u.delete(keyU(username)); }
function policyError(pw, user) {
  pw = String(pw || '');
  if (pw.length < 8) return 'password_min_8_chars';
  if (pw.length > 128) return 'password_too_long';
  if (!/[A-Za-z\u0600-\u06FF]/.test(pw) || !/[0-9\u06F0-\u06F9]/.test(pw)) return 'password_needs_letter_and_digit';
  if (/^Sin@/i.test(pw) || /^nabz@2026$/i.test(pw) || /^Nurse@2026$/i.test(pw)) return 'password_is_default_pattern';
  if (user && user.username && pw.toLowerCase().includes(String(user.username).toLowerCase())) return 'password_contains_username';
  if (/^(.)\1+$/.test(pw) || /^(12345678|password|qwerty|11111111)/i.test(pw)) return 'password_too_weak';
  return null;
}
function tempPassword() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', D = '23456789', S = '@#%+=';
  const pick = (set, n) => Array.from(crypto.randomBytes(n), b => set[b % set.length]).join('');
  const raw = (pick(A, 6) + pick(D, 3) + pick(S, 1)).split('');
  for (let i = raw.length - 1; i > 0; i--) { const j = crypto.randomBytes(1)[0] % (i + 1); [raw[i], raw[j]] = [raw[j], raw[i]]; }
  return raw.join('');
}
module.exports = { loadSecret, safeEqual, check, fail, success, unlock, lockState, policyError, tempPassword };
