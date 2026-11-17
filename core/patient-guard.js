'use strict';
const store = require('./store'), perms = require('./permissions'), resolver = require('./ward-resolver');
const audit = require('./audit'), bus = require('./events');
const GRANT_MINUTES = Number(process.env.NABZ_BREAKGLASS_MIN || 30);
const PARAM_COLL = { dischargeId: 'discharges', transferId: 'transfers', consultId: 'consults', orderId: 'orders', marId: 'mar',
  encounterId: 'encounters', labId: 'labs', radiologyId: 'radiology', bloodId: 'blood_requests', visitId: 'ed_visits', handoverId: 'handovers' };
const BODY_KEYS = { orderId: 'orders', marId: 'mar', consultId: 'consults', transferId: 'transfers', dischargeId: 'discharges', encounterId: 'encounters', labId: 'labs', visitId: 'ed_visits' };
const norm = c => (resolver.normalizeWardCode ? resolver.normalizeWardCode(c) : c);
const _denyAudit = new Map();
const _srcCache = new WeakMap();
function collsFromHandler(fn) {
  if (!fn) return [];
  if (_srcCache.has(fn)) return _srcCache.get(fn);
  const src = String(fn), set = new Set();
  for (const m of src.matchAll(/(?:store\.get|\.get)\(\s*['"](\w+)['"]/g)) set.add(m[1]);
  for (const m of src.matchAll(/\bh\(\s*ctx\s*,\s*['"](\w+)['"]/g)) set.add(m[1]);
  const out = [...set]; _srcCache.set(fn, out); return out;
}
function patientIdsFor(routePath, handlerFn, ctx) {
  const ids = new Set(), p = ctx.params || {}, q = ctx.query || {}, b = (ctx.body && typeof ctx.body === 'object') ? ctx.body : {};
  for (const k of ['patientId', 'pid']) if (p[k]) ids.add(String(p[k]));
  if (q.patientId) ids.add(String(q.patientId));
  if (b.patientId) ids.add(String(b.patientId));
  if (Array.isArray(b.patientIds)) b.patientIds.slice(0, 20).forEach(x => ids.add(String(x)));
  const colls = collsFromHandler(handlerFn);
  const resolveRec = (coll, id) => {
    let rec = null; try { rec = store.get(coll, String(id)); } catch (_) {}
    if (!rec) return;
    if (coll === 'patients') ids.add(rec.id); else if (rec.patientId) ids.add(String(rec.patientId));
  };
  for (const [name, val] of Object.entries(p)) {
    if (name === 'patientId' || name === 'pid' || val == null) continue;
    if (PARAM_COLL[name]) resolveRec(PARAM_COLL[name], val);
    else if (name === 'id') { for (const c of colls) resolveRec(c, val); if (/\/patients\/:id/.test(routePath)) resolveRec('patients', val); }
  }
  for (const [k, c] of Object.entries(BODY_KEYS)) if (b[k]) resolveRec(c, b[k]);
  return [...ids].slice(0, 25);
}
function activeGrant(actor, patientId) {
  const now = Date.now();
  return store.readAll('break_glass').some(g => g.userId === actor.id && g.patientId === patientId && Date.parse(g.expiresAt) > now);
}
function allowed(actor, patient) {
  if (!actor) return { ok: false, reason: 'no_actor' };
  if (actor.role === 'admin' || perms.isCrossWard(actor.role)) return { ok: true };
  const scope = perms.resolveScope(actor);
  const pWard = norm(patient.wardCode || patient.ward);
  if (scope.kind === 'all') return { ok: true };
  if (scope.kind === 'wards' && scope.codes.map(norm).includes(pWard)) return { ok: true };
  if (scope.kind === 'services') {
    const svc = patient.serviceCode || resolver.serviceForWard(pWard);
    if (svc && scope.codes.includes(svc)) return { ok: true };
  }
  const team = store.readAll('care_teams').find(t => t.patientId === patient.id);
  if (team && (team.members || []).some(m => m.userId === actor.id)) return { ok: true };
  const services = Array.isArray(actor.services) ? actor.services : [];
  if (store.readAll('consults').some(c => c.patientId === patient.id && ['requested', 'responded'].includes(c.status) &&
      (services.includes(c.targetService) || c.requestedBy === actor.id))) return { ok: true };
  const wards = scope.kind === 'wards' ? scope.codes.map(norm) : [];
  if (wards.length && store.readAll('transfers').some(t => t.patientId === patient.id &&
      !['completed', 'cancelled', 'rejected'].includes(t.status) && wards.includes(norm(t.toWard)))) return { ok: true };
  if (activeGrant(actor, patient.id)) return { ok: true, via: 'break_glass' };
  return { ok: false, reason: scope.kind === 'none' ? 'ward_not_configured' : 'outside_scope' };
}
function authorize(actor, patientIds, req) {
  const denied = [];
  for (const pid of patientIds) {
    const patient = store.get('patients', pid);
    if (!patient) continue;
    const r = allowed(actor, patient);
    if (!r.ok) denied.push({ patientId: pid, reason: r.reason });
  }
  if (denied.length) {
    const key = actor.id + '|' + denied[0].patientId, now = Date.now();
    if (!_denyAudit.has(key) || now - _denyAudit.get(key) > 60000) {
      _denyAudit.set(key, now);
      if (_denyAudit.size > 2000) _denyAudit.clear();
      try { audit.write('security', 'patient_access_denied', denied[0].patientId, actor, { reason: denied[0].reason, route: req ? req.method + ' ' + req.path : null }); } catch (_) {}
      try { bus.emit('security.patient_access_denied', { actor: { id: actor.id, role: actor.role }, patientId: denied[0].patientId, reason: denied[0].reason }); } catch (_) {}
    }
  }
  return denied;
}
function grant(actor, patientId, reason) {
  reason = String(reason || '').trim();
  if (reason.length < 10) throw Object.assign(new Error('reason_min_10_chars'), { code: 400 });
  const patient = store.get('patients', patientId);
  if (!patient) throw Object.assign(new Error('patient_not_found'), { code: 404 });
  const now = Date.now();
  const rec = { id: store.uid('bg'), userId: actor.id, username: actor.username, role: actor.role, patientId, patientWard: patient.wardCode || null,
    reason, grantedAt: new Date(now).toISOString(), expiresAt: new Date(now + GRANT_MINUTES * 60000).toISOString() };
  store.put('break_glass', rec);
  audit.write('security', 'break_glass_granted', patientId, actor, { reason, expiresAt: rec.expiresAt });
  bus.emit('security.break_glass', { actor: { id: actor.id, role: actor.role }, patientId, reason, expiresAt: rec.expiresAt });
  return rec;
}
function listGrants(limit) { return store.readAll('break_glass').slice(-(limit || 100)).reverse(); }
module.exports = { patientIdsFor, authorize, allowed, grant, listGrants, collsFromHandler, GRANT_MINUTES };
