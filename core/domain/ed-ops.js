'use strict';
// core/domain/ed-ops.js — عملیات اورژانس: تخت، پرونده موقت، MCI (28B)
const W = require('./ed-visit-writer');

const BED_NA = ['occupied', 'cleaning', 'blocked', 'maintenance', 'out_of_service'];
const BED_SET = ['empty', 'cleaning', 'blocked'];
const MCI_COLORS = ['red', 'yellow', 'green', 'black'];

function _store(ctx) { return ctx.store || require('../store'); }
function _bus(ctx) { return ctx.bus || require('../events'); }
function _now(ctx) { return (ctx && typeof ctx.now === 'function') ? ctx.now() : new Date().toISOString(); }
function _uid(ctx, p) { return (typeof ctx.uid === 'function') ? ctx.uid(p) : _store(ctx).uid(p); }
function _err(ctx, kind, code) {
  if (ctx && ctx.E && typeof ctx.E[kind] === 'function') return ctx.E[kind](code);
  return Object.assign(new Error(code), { code: code, kind: kind });
}
function _emit(ctx, ev, payload) { try { _bus(ctx).emit(ev, payload); } catch (_) { /* شنونده نباید نوشتن را بشکند */ } }
function _all(ctx, c) { try { const r = _store(ctx).readAll(c); return Array.isArray(r) ? r : []; } catch (_) { return []; } }
function _can(ctx, perm) { return require('../permissions').can((ctx.actor || {}).role, perm); }
function _active(v) { return !!v && W.TERMINAL.indexOf(v.status || 'waiting_triage') === -1; }
function _zoneLabel(b) { return String(b.label || b.zone || '').replace(/\s*#\s*\d+\s*$/, '') || b.zone; }
function _mode(list, key) {
  const c = {}; let best = null, n = 0;
  list.forEach(p => { const x = p && p[key]; if (x === null || x === undefined || x === '') return; c[x] = (c[x] || 0) + 1; if (c[x] > n) { n = c[x]; best = x; } });
  return best;
}

// ── تخت‌ها ──
function listBeds(ctx) {
  const visits = {};
  _all(ctx, 'ed_visits').forEach(v => { visits[v.id] = v; });
  const now = Date.now(), zones = {};
  const items = _all(ctx, 'beds').filter(b => b && b.zone).map(b => {
    const v = b.visitId ? visits[b.visitId] : null;
    const act = _active(v);
    const since = act && v.bedAssignedAt ? Date.parse(v.bedAssignedAt) : null;
    const status = b.status || 'empty';
    const rec = { id: b.id, code: b.code, zone: b.zone, label: b.label, status: status, critical: !!b.critical,
      visitId: act ? v.id : null, patientName: act ? v.patientName : null,
      esiLevel: act && v.esiLevel != null ? Number(v.esiLevel) : null, visitStatus: act ? v.status : null,
      minutesInBed: (act && since) ? Math.round((now - since) / 60000) : null,
      orphan: status === 'occupied' && !act };
    const z = zones[b.zone] = zones[b.zone] || { code: b.zone, label: _zoneLabel(b), total: 0, occupied: 0, free: 0, cleaning: 0 };
    z.total++;
    if (status === 'occupied') z.occupied++;
    else if (status === 'cleaning') z.cleaning++;
    else if (BED_NA.indexOf(status) === -1) z.free++;
    return rec;
  });
  items.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return { items: items, zones: Object.keys(zones).map(k => zones[k]).sort((a, b) => String(a.label).localeCompare(String(b.label))) };
}

function _freeBed(ctx, bedId, visitId, status) {
  const store = _store(ctx);
  const bed = bedId ? store.get('beds', bedId) : null;
  if (!bed) return null;
  if (bed.visitId && bed.visitId !== visitId) return null;
  bed.status = status; bed.visitId = null; bed.patientId = null; bed.updatedAt = _now(ctx);
  store.put('beds', bed);
  _emit(ctx, 'ed.bed.updated', { record: bed, actor: ctx.actor });
  return bed;
}

// آزادسازی تخت هنگام خروج (از writer صدا زده می‌شود؛ ذخیرهٔ ویزیت با فراخواننده است)
function releaseVisitBed(ctx, v, status) {
  if (!v || !v.bedId) return null;
  const bed = _freeBed(ctx, v.bedId, v.id, status || 'cleaning');
  v.lastBedId = v.bedId; v.bedReleasedAt = _now(ctx); v.bedId = null;
  return bed;
}

function assignBed(ctx, visitId, bedId) {
  if (!_can(ctx, 'ed.triage')) throw _err(ctx, 'forbidden', 'forbidden_assign_bed');
  const store = _store(ctx);
  const v = store.get('ed_visits', visitId);
  if (!v) throw _err(ctx, 'notFound', 'visit_not_found');
  if (!_active(v)) throw _err(ctx, 'conflict', 'visit_closed');
  const bed = bedId ? store.get('beds', bedId) : null;
  if (!bed || !bed.zone) throw _err(ctx, 'notFound', 'bed_not_found');
  if (v.bedId === bed.id) throw _err(ctx, 'conflict', 'already_in_this_bed');
  if (BED_NA.indexOf(bed.status) !== -1) throw _err(ctx, 'conflict', 'bed_not_available');
  const t = _now(ctx);
  if (v.bedId) _freeBed(ctx, v.bedId, v.id, 'cleaning');
  bed.status = 'occupied'; bed.visitId = v.id; bed.patientId = v.patientId || null; bed.updatedAt = t;
  store.put('beds', bed);
  v.bedId = bed.id; v.bedLabel = bed.label || bed.code || bed.id; v.zone = bed.zone; v.bedAssignedAt = t;
  if ((v.status || 'waiting_triage') === 'waiting_bed') {
    const r = require('../state-machine').transition('ed_visit', v, 'bed_ready', ctx.actor, {});
    if (r.ok) v.statusSince = t;
  }
  store.put('ed_visits', v);
  _emit(ctx, 'ed.bed.updated', { record: bed, actor: ctx.actor });
  _emit(ctx, 'ed.visit.assigned', { record: v, actor: ctx.actor });
  return { visit: v, bed: bed };
}

function releaseBed(ctx, visitId) {
  if (!_can(ctx, 'ed.triage')) throw _err(ctx, 'forbidden', 'forbidden_release_bed');
  const store = _store(ctx);
  const v = store.get('ed_visits', visitId);
  if (!v) throw _err(ctx, 'notFound', 'visit_not_found');
  if (!v.bedId) throw _err(ctx, 'conflict', 'no_bed');
  releaseVisitBed(ctx, v, 'cleaning');
  store.put('ed_visits', v);
  return v;
}

function setBedStatus(ctx, bedId, status) {
  if (!_can(ctx, 'ed.triage')) throw _err(ctx, 'forbidden', 'forbidden_bed_status');
  if (BED_SET.indexOf(status) === -1) throw _err(ctx, 'badRequest', 'invalid_bed_status');
  const store = _store(ctx);
  const bed = bedId ? store.get('beds', bedId) : null;
  if (!bed || !bed.zone) throw _err(ctx, 'notFound', 'bed_not_found');
  if (bed.status === 'occupied') {
    const v = bed.visitId ? store.get('ed_visits', bed.visitId) : null;
    if (_active(v)) throw _err(ctx, 'conflict', 'bed_occupied');
  }
  bed.status = status; bed.visitId = null; bed.patientId = null; bed.updatedAt = _now(ctx);
  store.put('beds', bed);
  _emit(ctx, 'ed.bed.updated', { record: bed, actor: ctx.actor });
  return bed;
}

// ── پروندهٔ موقت اورژانس (برای فعال شدن کاردکس/MAR/ویتال) ──
function createPatient(ctx, visitId) {
  if (!_can(ctx, 'patients.create')) throw _err(ctx, 'forbidden', 'forbidden_create_patient');
  const store = _store(ctx);
  const v = store.get('ed_visits', visitId);
  if (!v) throw _err(ctx, 'notFound', 'visit_not_found');
  if (v.patientId) throw _err(ctx, 'conflict', 'already_linked');
  const all = _all(ctx, 'patients');
  const er = all.filter(p => p.wardCode === 'ER');
  const name = String(v.patientName || '').trim();
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts.length > 1 ? parts[0] : (v.unknown ? 'ناشناس' : name);
  const last = parts.length > 1 ? parts.slice(1).join(' ') : (v.unknown ? name : '');
  const t = _now(ctx);
  const rec = {
    id: _uid(ctx, 'pat'), mrn: 'ED' + String(Date.now()).slice(-8),
    firstName: first, lastName: last, age: v.age != null ? v.age : null, sex: v.sex || null,
    wardCode: 'ER', bedId: null, bedNumber: v.bedLabel || null,
    diagnosis: v.chiefComplaint || '', comorbidities: [], allergies: [], allergiesVerified: false,
    codeStatus: _mode(all, 'codeStatus'),
    admissionType: (er[0] && er[0].admissionType) || _mode(all, 'admissionType'),
    status: (er[0] && er[0].status) || _mode(all, 'status') || 'active',
    admittedAt: v.arrivalAt || t, createdAt: t, source: 'ed_visit', tempRecord: true, edVisitId: v.id
  };
  store.put('patients', rec);
  v.patientId = rec.id; v.unlinked = false;
  store.put('ed_visits', v);
  _emit(ctx, 'ed.visit.linked', { record: v, actor: ctx.actor });
  return { patient: rec, visit: v };
}

// ── MCI ──
function mciCount(ctx, id, color, delta) {
  const store = _store(ctx);
  const m = id ? store.get('ed_mci', id) : null;
  if (!m) throw _err(ctx, 'notFound', 'mci_not_found');
  if (m.status !== 'active') throw _err(ctx, 'conflict', 'mci_not_active');
  if (MCI_COLORS.indexOf(color) === -1) throw _err(ctx, 'badRequest', 'invalid_color');
  const d = Number(delta);
  if (d !== 1 && d !== -1) throw _err(ctx, 'badRequest', 'invalid_delta');
  m.casualties = Object.assign({ red: 0, yellow: 0, green: 0, black: 0 }, m.casualties || {});
  m.casualties[color] = Math.max(0, (Number(m.casualties[color]) || 0) + d);
  m.lastCountAt = _now(ctx);
  store.put('ed_mci', m);
  _emit(ctx, 'ed.mci.updated', { record: m, actor: ctx.actor });
  return m;
}
function mciClose(ctx, id, note) {
  const store = _store(ctx);
  const m = id ? store.get('ed_mci', id) : null;
  if (!m) throw _err(ctx, 'notFound', 'mci_not_found');
  if (m.status !== 'active') throw _err(ctx, 'conflict', 'mci_not_active');
  m.status = 'closed'; m.closedAt = _now(ctx); m.closedBy = (ctx.actor || {}).id || null;
  if (note) m.closeNote = String(note);
  store.put('ed_mci', m);
  _emit(ctx, 'ed.mci.closed', { record: m, actor: ctx.actor });
  return m;
}

function extend(mod) {
  if (!mod || mod._edOpsExtended) return mod;
  mod._edOpsExtended = true;
  const H = mod.handlers, R = mod.routes;
  H.edBeds = (ctx) => listBeds(ctx);
  H.edAssignBed = (ctx) => assignBed(ctx, ctx.params.id, (ctx.body || {}).bedId);
  H.edReleaseBed = (ctx) => releaseBed(ctx, ctx.params.id);
  H.edBedStatus = (ctx) => setBedStatus(ctx, ctx.params.id, (ctx.body || {}).status);
  H.edCreatePatient = (ctx) => createPatient(ctx, ctx.params.id);
  H.edMciCount = (ctx) => mciCount(ctx, ctx.params.id, (ctx.body || {}).color, (ctx.body || {}).delta);
  H.edMciClose = (ctx) => mciClose(ctx, ctx.params.id, (ctx.body || {}).note);
  R.push(
    { method: 'GET',  path: '/api/emergency/beds',                      handler: 'edBeds',          perm: 'ed.view' },
    { method: 'POST', path: '/api/emergency/visits/:id/assign-bed',     handler: 'edAssignBed',     perm: 'ed.triage' },
    { method: 'POST', path: '/api/emergency/visits/:id/release-bed',    handler: 'edReleaseBed',    perm: 'ed.triage' },
    { method: 'POST', path: '/api/emergency/beds/:id/status',           handler: 'edBedStatus',     perm: 'ed.triage' },
    { method: 'POST', path: '/api/emergency/visits/:id/create-patient', handler: 'edCreatePatient', perm: 'patients.create' },
    { method: 'POST', path: '/api/emergency/mci/:id/count',             handler: 'edMciCount',      perm: 'ed.mci.activate' },
    { method: 'POST', path: '/api/emergency/mci/:id/close',             handler: 'edMciClose',      perm: 'ed.mci.activate' }
  );
  return mod;
}

module.exports = { listBeds, assignBed, releaseBed, releaseVisitBed, setBedStatus, createPatient, mciCount, mciClose, extend };
