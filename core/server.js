'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const auth = require('./auth'), perms = require('./permissions');
const store = require('./store'), bus = require('./events');
const audit = require('./audit'), neural = require('./neural');
const zlib = require('zlib'), crypto = require('crypto');
const sec = require('./security'), guard = require('./patient-guard'), kernel = require('./kernel'), resolver = require('./ward-resolver');

let _crashes = [];
process.on('unhandledRejection', (r) => { console.error('[unhandledRejection]', (r && r.stack) || r); });
process.on('uncaughtException', (e) => {
  console.error('[uncaughtException]', (e && e.stack) || e);
  const now = Date.now(); _crashes = _crashes.filter(t => now - t < 60000); _crashes.push(now);
  if (_crashes.length > 10) { try { store.flushAll(); } catch (_) {} console.error('[fatal] crash loop — exiting'); process.exit(1); }
});

const PORT = process.env.PORT || 4000;
const PUB = path.join(__dirname, '..', 'public');
const MODS = {};

try { require('./seed').seed(); } catch (e) { console.error('seed:', e.message); }
auth.seedAdmin();

Object.assign(perms.P, {
  'consult.view':'admin,nurse,head_nurse,physician,resident,intern,attending,specialist,supervisor_clinical',
  'consult.request':'admin,physician,resident,intern,attending,specialist',
  'consult.respond':'admin,resident,attending,specialist',
  'consult.approve':'admin,attending,specialist',
  'transfer.view':'admin,head_nurse,nurse,physician,resident,attending,bed_manager,supervisor_clinical',
  'transfer.request':'admin,physician,resident,attending,head_nurse,nurse',
  'transfer.approve':'admin,head_nurse,supervisor_clinical',
  'transfer.assign_bed':'admin,bed_manager,head_nurse',
  'transfer.handover':'admin,nurse,head_nurse',
  'transfer.complete':'admin,nurse,head_nurse,bed_manager',
  'discharge.view':'admin,nurse,head_nurse,physician,resident,attending,specialist',
  'discharge.plan':'admin,physician,resident,attending,nurse,head_nurse',
  'handover.view':'admin,nurse,head_nurse,supervisor_clinical,nursing_director',
  'handover.create':'admin,nurse,head_nurse',
  'handover.sign':'admin,nurse,head_nurse',
  'handover.receive':'admin,nurse,head_nurse',
  'lab.view':'admin,nurse,head_nurse,physician,resident,intern,attending,specialist,lab_tech',
  'lab.order':'admin,physician,resident,intern,attending,specialist,nurse',
  'lab.collect':'admin,nurse,nurse_aide,lab_tech',
  'lab.result':'admin,lab_tech',
  'lab.verify':'admin,lab_tech,supervisor_clinical',
  'radiology.view':'admin,nurse,head_nurse,physician,resident,intern,attending,specialist,radiology_tech',
  'radiology.order':'admin,physician,resident,intern,attending,specialist,nurse',
  'radiology.report':'admin,radiology_tech,attending',
  'radiology.verify':'admin,attending,supervisor_clinical',
  'bloodbank.view':'admin,nurse,head_nurse,physician,resident,attending,lab_tech',
  'bloodbank.request':'admin,physician,resident,attending,nurse',
  'bloodbank.crossmatch':'admin,lab_tech',
  'bloodbank.issue':'admin,lab_tech',
  'bloodbank.transfuse':'admin,nurse',
  'pharmacy.view':'admin,pharmacist,nurse,head_nurse,physician,attending',
  'pharmacy.verify':'admin,pharmacist',
  'pharmacy.dispense':'admin,pharmacist',
  'sepsis.view':'admin,nurse,head_nurse,physician,resident,intern,attending,specialist',
  'sepsis.screen':'admin,nurse,head_nurse,resident,intern',
  'sepsis.diagnose':'admin,physician,attending,specialist,resident',
  'infection.view':'admin,nurse,head_nurse,physician,resident,attending,supervisor_infection',
  'infection.report':'admin,nurse,physician,resident,attending,lab_tech',
  'infection.isolation':'admin,supervisor_infection,head_nurse',
  'quality.view':'admin,hospital_director,medical_director,nursing_director,supervisor_senior,quality_officer,head_nurse,supervisor_clinical',
  'quality.incident.report':'admin,nurse,head_nurse,physician,resident,intern,attending,specialist,pharmacist,lab_tech,radiology_tech,supervisor_clinical,quality_officer',
  'risk.view':'admin,hospital_director,medical_director,nursing_director,supervisor_senior,quality_officer,head_nurse,supervisor_clinical',
  'risk.register':'admin,quality_officer,head_nurse,supervisor_clinical,attending',
  'shift.view':'admin,nursing_director,supervisor_senior,supervisor_clinical,head_nurse,nurse,nurse_aide',
  'shift.manage':'admin,head_nurse,supervisor_senior,nursing_director',
  'workforce.view':'admin,nurse,nurse_aide,head_nurse,physician,resident,intern,attending,specialist,supervisor_clinical',
  'workforce.checkin':'admin,nurse,nurse_aide,head_nurse,physician,resident,intern,attending',
  'karanneh.view':'admin,nursing_director,medical_director,supervisor_clinical,supervisor_senior',
  'karanneh.manage':'admin,nursing_director,medical_director'
});

Object.assign(perms.P, {
  'crisis.view':'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,supervisor_er,head_nurse,quality_officer',
  'crisis.activate':'admin,hospital_director,medical_director,nursing_director',
  'crisis.assign':'admin,hospital_director,medical_director,nursing_director,supervisor_senior',
  'crisis.confirm':'admin,nurse,nurse_aide,head_nurse,physician,resident,intern,attending,specialist,supervisor_senior,supervisor_clinical',
  'crisis.alert':'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical',
  'crisis.evacuate':'admin,nursing_director,supervisor_senior,head_nurse',
  'or.view':'admin,head_nurse,supervisor_senior,supervisor_clinical,nursing_director,medical_director,anesthesiologist,surgeon,resident,attending,or_manager',
  'or.schedule':'admin,or_manager,head_nurse,supervisor_senior,attending',
  'or.checklist':'admin,nurse,surgeon,anesthesiologist,or_manager,head_nurse',
  'or.pacu':'admin,nurse,head_nurse,anesthesiologist',
  'cssd.view':'admin,cssd_supervisor,head_nurse,or_manager,supervisor_infection,quality_officer,nursing_director',
  'cssd.manage':'admin,cssd_supervisor,or_manager,supervisor_infection'
});

const modDir = path.join(__dirname, '..', 'modules');
// ─── Sub-modules merged into emergency.js ───
// Skipped here so kernel does not register duplicate routes.
// Their handlers/routes/panels are loaded via modules/emergency.js.
const MERGED_SUBMODULES = new Set(['ed_extras', 'ed_nursing_report', 'ed_orders', 'ed_tasks', 'ed_physician']);
if (fs.existsSync(modDir)) {
  for (const f of fs.readdirSync(modDir)) {
    if (!f.endsWith('.js')) continue;
    if (MERGED_SUBMODULES.has(f.replace('.js', ''))) { continue; }   // loaded via emergency.js
    const name = f.replace('.js', '');
    try {
      MODS[name] = require('../modules/' + name);
      const count = Object.keys(MODS[name].handlers || {}).length;
      console.log('📦 ' + name + ' (' + count + ')');
    } catch (e) {
      console.error('❌ ' + name + ': ' + e.message);
    }
  }
} else {
  console.error('❌ modules/ directory not found');
}

try { require('./permissions-extra'); } catch(e) { console.error('perm-extra:', e.message); }

const RAW = [];
for (const [name, mod] of Object.entries(MODS)) {
  for (const r of (mod.routes || [])) RAW.push({ method: r.method, path: r.path, perm: r.perm, handler: (mod.handlers || {})[r.handler], modName: name });
}
function sys(method, pattern, perm, handler, opts) { RAW.push(Object.assign({ method, path: pattern, perm, handler, modName: 'sys' }, opts || {})) }
Object.assign(perms.P, {
  'break_glass.use': 'admin,physician,resident,intern,attending,specialist,nurse,head_nurse,supervisor_senior,supervisor_clinical,supervisor_er,nursing_director,medical_director'
});
const STATS = { started: Date.now(), total: 0, c2: 0, c3: 0, c4: 0, c5: 0, slow: 0, recentErrors: [] };
const EXPOSE_ERRORS = process.env.NABZ_EXPOSE_ERRORS === '1';

sys('POST', '/api/auth/login', null, (ctx) => {
  const u = ctx.body.username, p = ctx.body.password;
  if (!u || !p || typeof u !== 'string' || typeof p !== 'string') throw { code: 400, message: 'credentials_required' };
  const chk = sec.check(u, ctx.ip);
  if (!chk.allowed) { ctx.res.setHeader('Retry-After', String(chk.retryAfter)); throw { code: 429, message: 'too_many_attempts', extra: { retryAfter: chk.retryAfter } }; }
  try { const r = auth.login(u, p); sec.success(u); return r; }
  catch (e) {
    if (e && e.code === 401) {
      sec.fail(u, ctx.ip);
      const after = sec.check(u, ctx.ip);
      if (!after.allowed) { try { audit.write('security', 'account_locked', u, { id: '-', role: '-', username: u }, { ip: ctx.ip, retryAfter: after.retryAfter }); } catch (_) {} }
    }
    throw e;
  }
}, { public: true });
sys('GET', '/api/auth/me', null, (ctx) => ({ user: ctx.actor }));
sys('POST', '/api/auth/change-password', null, (ctx) => {
  const b = ctx.body || {};
  return auth.changePassword(ctx.actor.id, b.oldPassword, b.newPassword);
});
sys('POST', '/api/auth/admin-reset-password/:userId', 'admin.users.manage', (ctx) => {
  const b = ctx.body || {};
  return auth.adminResetPassword(ctx.actor, ctx.params.userId, b.newPassword);
});
sys('POST', '/api/auth/unlock/:username', 'admin.users.manage', (ctx) => { sec.unlock(ctx.params.username); return { unlocked: true }; });
sys('GET', '/api/_modules', null, (ctx) => {
  const panels = [];
  for (const [name, mod] of Object.entries(MODS)) {
    for (const p of (mod.panels || [])) {
      if (perms.can(ctx.actor.role, p.perm || 'patients.view')) panels.push(Object.assign({}, p, { id: name + '.' + p.id, module: name }));
    }
  }
  return { modules: Object.keys(MODS), panels, user: ctx.actor };
});
sys('GET', '/api/neural/stats', 'neural.view', () => neural.stats());
sys('GET', '/api/neural/alerts', null, () => neural.alerts());
sys('GET', '/api/neural/cohort', 'neural.view', () => neural.cohort());
sys('GET', '/api/events/recent', null, () => ({ items: bus.recent(100) }));
sys('GET', '/api/audit/verify', 'admin.audit.view', () => audit.verify());
sys('POST', '/api/core/break-glass', 'break_glass.use', (ctx) => {
  const b = ctx.body || {};
  if (!b.patientId) throw { code: 400, message: 'patientId_required' };
  return guard.grant(ctx.actor, String(b.patientId), b.reason);
}, { noGuard: true });
sys('GET', '/api/core/break-glass', 'admin.audit.view', (ctx) => ({ items: guard.listGrants(Number(ctx.query.limit) || 100), minutes: guard.GRANT_MINUTES }));
sys('GET', '/api/core/health', 'admin.audit.view', () => {
  const mu = process.memoryUsage();
  const users = store.readAll('users');
  return {
    status: K.warnings.some(w => w.level === 'error') ? 'degraded' : 'ok',
    uptimeSec: Math.round(process.uptime()), node: process.version, pid: process.pid,
    memoryMB: { rss: Math.round(mu.rss / 1048576), heapUsed: Math.round(mu.heapUsed / 1048576) },
    routes: K.routes.length, modules: Object.keys(MODS).length,
    contractWarnings: K.warnings, routesWithoutPermission: K.noPerm,
    requests: { total: STATS.total, '2xx': STATS.c2, '3xx': STATS.c3, '4xx': STATS.c4, '5xx': STATS.c5, slow: STATS.slow, recentErrors: STATS.recentErrors },
    store: { writes: store.stats.writes, appends: store.stats.appends || 0, writeErrors: store.stats.writeErrors, quarantined: store.stats.quarantined, recoveredFromTmp: store.stats.recoveredFromTmp },
    login: sec.lockState(),
    users: { total: users.length, mustChangePassword: users.filter(u => u.mustChangePassword).length, withPlainHint: users.filter(u => u.plainHint).length },
    breakGlassLast24h: store.readAll('break_glass').filter(g => Date.parse(g.grantedAt) > Date.now() - 86400000).length
  };
});

const K = kernel.build(RAW, perms, MODS);
const ROUTES = K.routes;
for (const w of K.warnings) console.warn('[kernel] ' + w.level.toUpperCase() + ' ' + w.type + ' ' + (w.route || w.panel || '') + (w.by ? ' (by ' + w.by + ')' : '') + (w.perm ? ' perm=' + w.perm : ''));
if (K.noPerm.length) console.warn('[kernel] ' + K.noPerm.length + ' authenticated-only routes without permission (see /api/core/health)');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain', '.map': 'application/json' };
const TEXTUAL = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt', '.map']);
const LONG_CACHE = new Set(['.woff', '.woff2', '.ttf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico']);
const BLOCKED_STATIC = /(^|\/)\.|\.(bak|orig|old|tmp|swp|log|corrupt)([-.].*)?$|~$/i;
const _gz = new Map(); let _gzBytes = 0;
const DEFAULT_ORIGINS = ['capacitor://localhost', 'ionic://localhost', 'http://localhost', 'https://localhost'];
const ALLOWED_ORIGINS = new Set(DEFAULT_ORIGINS.concat((process.env.NABZ_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)));
const CORS_ANY = process.env.NABZ_CORS_ANY === '1';
const MUST_CHANGE_OK = new Set(['POST /api/auth/change-password', 'GET /api/auth/me', 'POST /api/auth/login']);
const BODY_LIMITS = [[/^\/api\/ops2\/backup\/import$/, 64 << 20], [/^\/api\/voice\/upload$/, 4 << 20], [/^\/api\/cm\/file$/, 4 << 20], [/^\/api\/auth\/login$/, 4096]];
const DEFAULT_BODY_LIMIT = Number(process.env.NABZ_BODY_LIMIT || 1 << 20);
const limitFor = pn => { for (const [re, n] of BODY_LIMITS) if (re.test(pn)) return n; return DEFAULT_BODY_LIMIT; };
const _ac = new Map();

function buildActor(user) {
  const now = Date.now(), sig = user.ward + '|' + user.staffId + '|' + user.role;
  let c = _ac.get(user.id);
  if (!c || now - c.ts > 20000 || c.sig !== sig) {
    let w = null, s = [];
    try { w = resolver.resolveUserWard(user); s = resolver.resolveUserServices(user, w); } catch (_) {}
    c = { ts: now, w, s, sig }; _ac.set(user.id, c);
    if (_ac.size > 3000) _ac.clear();
  }
  return { id: user.id, username: user.username, role: user.role, fullName: user.fullName || user.username,
    ward: user.ward || c.w || null, services: c.s, staffId: user.staffId || null, mustChangePassword: !!user.mustChangePassword };
}
function setCommonHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const origin = req.headers.origin;
  if (origin) {
    const same = req.headers.host && (origin === 'http://' + req.headers.host || origin === 'https://' + req.headers.host);
    if (CORS_ANY) res.setHeader('Access-Control-Allow-Origin', '*');
    else if (same || ALLOWED_ORIGINS.has(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  }
}
function json(res, code, obj) {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function mapError(e) {
  let code = e && e.code;
  const msg = (e && e.message) || String(e);
  if (!(Number.isInteger(code) && code >= 400 && code < 600)) {
    if (code === 'ENOSPC' || code === 'EDQUOT') return { status: 507, error: 'storage_full' };
    code = 500;
  }
  const extra = e && e.extra && typeof e.extra === 'object' ? e.extra : {};
  if (code >= 500 && !EXPOSE_ERRORS) return { status: code, error: 'internal_error' };
  return { status: code, error: msg, ...extra };
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const cl = Number(req.headers['content-length'] || 0);
    if (cl > limit) { req.resume(); return reject({ code: 413, message: 'payload_too_large' }); }
    const chunks = []; let size = 0, over = false;
    req.on('data', c => { size += c.length; if (size > limit) { over = true; chunks.length = 0; } else if (!over) chunks.push(c); });
    req.on('error', () => reject({ code: 400, message: 'request_aborted' }));
    req.on('end', () => {
      if (over) return reject({ code: 413, message: 'payload_too_large' });
      if (!size) return resolve({});
      let o; try { o = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) { return reject({ code: 400, message: 'invalid_json' }); }
      resolve(o && typeof o === 'object' ? o : {});
    });
  });
}
async function serveStatic(req, res, pn) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  let rel; try { rel = decodeURIComponent(pn); } catch (_) { res.writeHead(400); return res.end('bad request'); }
  if (rel.includes('\0')) { res.writeHead(400); return res.end('bad request'); }
  if (rel === '/') rel = '/index.html';
  let full = path.normalize(path.join(PUB, rel));
  if (full !== PUB && !full.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
  if (BLOCKED_STATIC.test(rel)) { res.writeHead(404); return res.end('not found'); }
  let st = null; try { st = fs.statSync(full); } catch (_) {}
  if (!st || st.isDirectory()) {
    if (path.extname(rel)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('not found'); }
    full = path.join(PUB, 'index.html');
    try { st = fs.statSync(full); } catch (_) { res.writeHead(404); return res.end('not found'); }
  }
  const ext = path.extname(full).toLowerCase();
  const type = (MIME[ext] || 'application/octet-stream') + (TEXTUAL.has(ext) || ext === '' ? '; charset=utf-8' : '');
  const etag = 'W/"' + st.size.toString(36) + '-' + Math.round(st.mtimeMs).toString(36) + '"';
  const headers = { 'Content-Type': type, ETag: etag, 'Cache-Control': LONG_CACHE.has(ext) ? 'public, max-age=86400' : 'no-cache', Vary: 'Accept-Encoding' };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
  let body;
  try { body = await fs.promises.readFile(full); } catch (_) { res.writeHead(404); return res.end('not found'); }
  if (TEXTUAL.has(ext) && body.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    let g = _gz.get(full);
    if (!g || g.etag !== etag) {
      const buf = zlib.gzipSync(body, { level: 6 });
      if (g) _gzBytes -= g.buf.length;
      if (_gzBytes + buf.length > 24 << 20) { _gz.clear(); _gzBytes = 0; }
      g = { etag, buf }; _gz.set(full, g); _gzBytes += buf.length;
    }
    body = g.buf; headers['Content-Encoding'] = 'gzip';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}
async function handle(req, res) {
  const t0 = Date.now(), rid = crypto.randomBytes(5).toString('hex');
  res.setHeader('X-Request-Id', rid);
  setCommonHeaders(req, res);
  let parsed;
  try { parsed = new URL(req.url, 'http://x'); } catch (_) { return json(res, 400, { ok: false, error: 'bad_url' }); }
  const pn = parsed.pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (!pn.startsWith('/api/')) return serveStatic(req, res, pn);

  STATS.total++;
  res.on('finish', () => {
    const c = Math.floor(res.statusCode / 100); if (STATS['c' + c] !== undefined) STATS['c' + c]++;
    const ms = Date.now() - t0;
    if (ms > 1500) { STATS.slow++; console.warn('[slow] ' + ms + 'ms ' + req.method + ' ' + pn + ' rid=' + rid); }
  });
  try {
    const found = K.match(req.method, pn);
    if (!found) return json(res, 404, { ok: false, error: 'route_not_found' });
    const { route, params } = found;

    let actor = null;
    if (!route.public) {
      let tk = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!tk && pn === '/api/stream') tk = parsed.searchParams.get('token') || '';
      const payload = tk ? auth.verify(tk) : null;
      if (!payload) return json(res, 401, { ok: false, error: 'unauthorized' });
      const user = store.get('users', payload.id);
      if (!user || user.active === false) return json(res, 401, { ok: false, error: 'account_disabled' });
      if ((user.tokenVersion || 0) !== (payload.tv || 0)) return json(res, 401, { ok: false, error: 'session_revoked' });
      actor = buildActor(user);
      if (require('./security-config').isForcePasswordChangeActive() && actor.mustChangePassword && !MUST_CHANGE_OK.has(route.key)) return json(res, 403, { ok: false, error: 'password_change_required', mustChangePassword: true });
      if (!route.perm && !kernel.roleDashboardAllowed(actor.role, pn)) return json(res, 403, { ok: false, error: 'forbidden', reason: 'role_dashboard' });
    }
    if (route.modName === 'code_manager') {
      if (process.env.NABZ_DISABLE_CODE_EDITOR === '1') return json(res, 404, { ok: false, error: 'route_not_found' });
      if (req.method !== 'GET' && actor) { try { audit.write('code_manager', req.method + ' ' + pn, null, actor, { ip: req.socket.remoteAddress || '-' }); } catch (_) {} }
    }
    if (route.perm && !perms.can(actor ? actor.role : null, route.perm)) return json(res, 403, { ok: false, error: 'forbidden', required: route.perm });

    const hasBody = req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE';
    const body = hasBody ? await readBody(req, limitFor(pn)) : {};
    const query = {};
    for (const [k, v] of parsed.searchParams.entries()) query[k] = v;

    const ctx = {
      actor, params, query, body, store, audit, bus, requestId: rid, ip: req.socket.remoteAddress || '-', req,
      E: {
        badRequest: (m) => ({ code: 400, message: m }), notFound: (m) => ({ code: 404, message: m }),
        forbidden: (m) => ({ code: 403, message: m }), conflict: (m) => ({ code: 409, message: m })
      },
      uid: (p) => store.uid(p), now: () => new Date().toISOString(), module: { id: route.modName }, res
    };

    if (actor && !route.noGuard) {
      const ids = guard.patientIdsFor(route.path, route.fn, ctx);
      if (ids.length) {
        const denied = guard.authorize(actor, ids, { method: req.method, path: pn });
        if (denied.length) return json(res, 403, { ok: false, error: 'patient_access_denied', reason: denied[0].reason, patientId: denied[0].patientId, breakGlass: perms.can(actor.role, 'break_glass.use') });
      }
    }

    const result = await route.fn(ctx);
    if (res.headersSent) return;
    return json(res, 200, { ok: true, data: result });
  } catch (e) {
    const m = mapError(e);
    if (m.status >= 500) {
      console.error('[' + m.status + '] rid=' + rid + ' ' + req.method + ' ' + pn + ' ' + ((e && e.stack) ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e)));
      STATS.recentErrors.push({ at: new Date().toISOString(), rid, method: req.method, path: pn, status: m.status, msg: String((e && e.message) || e).slice(0, 160) });
      if (STATS.recentErrors.length > 20) STATS.recentErrors.shift();
      m.ref = rid;
    }
    const { status, error, ...rest } = m;
    return json(res, status, { ok: false, error, ...rest });
  }
}

const server = http.createServer({ requestTimeout: 120000, headersTimeout: 20000, keepAliveTimeout: 20000 }, (req, res) => {
  handle(req, res).catch(e => { console.error('[handle] fatal', e && e.stack || e); try { json(res, 500, { ok: false, error: 'internal_error' }); } catch (_) {} });
});
server.maxHeadersCount = 100;
server.on('clientError', (err, socket) => { try { if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); else socket.destroy(); } catch (_) {} });
server.on('error', (e) => { console.error('[server] ' + (e.code === 'EADDRINUSE' ? 'port ' + PORT + ' already in use' : e.message)); process.exit(1); });
server.listen(PORT, () => {
  console.log('');
  console.log('🫀 NABZ running → http://localhost:' + PORT);
  console.log('🧠 Neural: ' + neural.stats().eventsIngested + ' events');
  console.log('📡 ' + ROUTES.length + ' routes · ' + Object.keys(MODS).length + ' modules · kernel warnings: ' + K.warnings.length);
  console.log('');
});
// Attach alert-persister on startup (must be before requests)
require('./domain/alert-persister');

function shutdown(sig) {
  console.log('[server] ' + sig + ' — flushing and closing');
  try { store.flushAll(); } catch (_) {}
  try { server.close(); } catch (_) {}
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
