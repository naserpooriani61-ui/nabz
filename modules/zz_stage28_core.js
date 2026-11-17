'use strict';
const store = require('../core/store'), bcrypt = require('bcryptjs');
const perms = require('../core/permissions'), guard = require('../core/patient-guard');
const { h } = require('../core/mod-helpers');
(function migrateCredentials() {
  const users = store.readAll('users'); let stripped = 0, forced = 0, hashed = 0, dirty = false;
  for (const u of users) {
    if (u.plainHint) {
      if (!u.passwordChangedAt && !u.mustChangePassword) { u.mustChangePassword = true; forced++; }
      delete u.plainHint; stripped++; dirty = true;
    }
    if (!u.passwordHash && typeof u.password === 'string' && u.password) {
      u.passwordHash = bcrypt.hashSync(u.password, 10); delete u.password; hashed++; dirty = true;
    } else if (u.password !== undefined && u.passwordHash) { delete u.password; dirty = true; }
  }
  const admin = users.find(u => u.username === 'admin' && u.passwordHash);
  if (admin && !admin.mustChangePassword && !admin.passwordChangedAt) {
    try { if (bcrypt.compareSync('nabz@2026', admin.passwordHash)) { admin.mustChangePassword = true; forced++; dirty = true; } } catch (_) {}
  }
  if (dirty) store.saveAll('users', users);
  console.log('[stage28] credentials: ' + stripped + ' plaintext hints removed · ' + hashed + ' legacy passwords hashed · ' + forced + ' accounts forced to change password');
})();
try {
  const home = require('./home');
  home.handlers.search = (ctx) => {
    const q = String(ctx.query.q || '').trim().toLowerCase();
    if (!q || q.length < 2) return { items: [], total: 0, query: q };
    const okPatients = new Map();
    const canSee = (pid) => {
      if (!pid) return false;
      if (!okPatients.has(pid)) { const p = store.get('patients', pid); okPatients.set(pid, !!p && guard.allowed(ctx.actor, p).ok); }
      return okPatients.get(pid);
    };
    const results = [];
    const scan = (module, panel, items, fields, visible) => {
      for (const it of items) {
        if (visible && !visible(it)) continue;
        if (fields.some(f => String(it[f] || '').toLowerCase().includes(q))) results.push({ module, panel, item: it });
      }
    };
    scan('clinical', 'patients', h(ctx, 'patients'), ['firstName', 'lastName', 'mrn', 'diagnosis'], p => canSee(p.id));
    scan('ops', 'staff', h(ctx, 'wf_staff'), ['fullName', 'role', 'ward']);
    scan('clinical', 'mar', h(ctx, 'mar'), ['drugName', 'patientName'], m => canSee(m.patientId));
    scan('workflow', 'consult', h(ctx, 'consults'), ['patientName', 'targetService', 'question'], c => canSee(c.patientId));
    scan('paraclinical', 'labs', h(ctx, 'labs'), ['patientName', 'panelName'], l => canSee(l.patientId));
    if (perms.can(ctx.actor.role, 'quality.view')) scan('safety', 'incidents', h(ctx, 'incidents'), ['description', 'category']);
    return { items: results.slice(0, 40), total: results.length, query: q };
  };
  console.log('[stage28] home.search → scoped by patient guard');
} catch (e) { console.error('[stage28] home.search override failed:', e.message); }
module.exports = { handlers: {}, routes: [], panels: [] };
