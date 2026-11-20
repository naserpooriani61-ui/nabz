'use strict';
// core/domain/ward-round-writer.js — v2 (metrics + staffing)

const COLL = 'ward_rounds';
const CATEGORIES = ['staffing', 'equipment', 'infection', 'safety', 'medication', 'beds', 'other'];
const SEVERITIES = ['info', 'warning', 'critical'];

const METRIC_KEYS = [
  'patientsTotal', 'bedsOccupied', 'bedsEmpty', 'ventilated', 'isolated',
  'highRisk', 'icuWaiting',
  'waitingSurgery', 'cancelledSurgery', 'dialysis', 'markerPositive',
  'febrile', 'transfusion', 'newAdmissions', 'deaths', 'transfers', 'pendingDischarge'
];
const AUTO_METRICS = ['patientsTotal', 'bedsOccupied', 'bedsEmpty', 'ventilated', 'isolated', 'highRisk', 'icuWaiting'];

const _store = (ctx) => (ctx && ctx.store) || require('../store');
const _bus   = (ctx) => (ctx && ctx.bus) || require('../events');
const _uid   = (ctx, p) => (ctx && typeof ctx.uid === 'function') ? ctx.uid(p) : _store(ctx).uid(p);
const _now   = (ctx) => (ctx && typeof ctx.now === 'function') ? ctx.now() : new Date().toISOString();
const _err   = (ctx, code) => {
  if (ctx && ctx.E && typeof ctx.E.badRequest === 'function') return ctx.E.badRequest(code);
  return Object.assign(new Error(code), { code });
};
const _all = (ctx, c) => { try { const r = _store(ctx).readAll(c); return Array.isArray(r) ? r : []; } catch (_) { return []; } };

function _todayISO() { return new Date().toISOString().slice(0, 10); }
function _actorName(a) { return (a && (a.fullName || a.username)) || ''; }

function _defaultMetrics() {
  const m = {};
  METRIC_KEYS.forEach(k => { m[k] = 0; });
  m.unrelated = '';
  return m;
}

function _defaultStaffing() {
  return {
    shiftSupervisor: '',
    nurses: 0, nursesNames: '',
    nurseAides: 0, nurseAidesNames: '',
    secretary: '',
    absent: ''
  };
}

// ── Auto metrics from live data ──
function getAutoMetrics(ctx, wardCode) {
  const beds = _all(ctx, 'beds').filter(b => b.wardCode === wardCode);
  const patients = _all(ctx, 'patients').filter(p =>
    p.wardCode === wardCode && p.status !== 'discharged' && p.status !== 'transferred'
  );
  const vents = _all(ctx, 'ventilator_settings').filter(v =>
    v.wardCode === wardCode && (v.status === 'active' || v.on === true)
  );
  const isos = _all(ctx, 'isolations').filter(i =>
    i.wardCode === wardCode && (i.status === 'active' || i.active)
  );
  const risks = _all(ctx, 'risks').filter(r =>
    r.wardCode === wardCode &&
    (Number(r.riskScore) >= 10 || ['high','critical'].indexOf(String(r.level || '').toLowerCase()) !== -1)
  );
  const edBoard = _all(ctx, 'ed_visits').filter(v =>
    v.status === 'boarding' && v.destination === wardCode
  );
  const transfers = _all(ctx, 'transfers').filter(t =>
    t.toWard === wardCode && t.status !== 'completed' && t.status !== 'cancelled'
  );

  return {
    patientsTotal: patients.length,
    bedsOccupied: beds.filter(b => b.status === 'occupied').length,
    bedsEmpty: beds.filter(b => b.status === 'available' || b.status === 'empty').length,
    ventilated: vents.length,
    isolated: isos.length,
    highRisk: risks.length,
    icuWaiting: edBoard.length + transfers.length
  };
}

// ── Create ──
function create(ctx, raw) {
  if (!raw || !raw.wardCode) throw _err(ctx, 'ward_required');
  if (!raw.shiftType) throw _err(ctx, 'shift_required');
  const date = raw.date || _todayISO();
  const store = _store(ctx);

  const dup = _all(ctx, COLL).find(r =>
    r.wardCode === raw.wardCode && r.date === date && r.shiftType === raw.shiftType &&
    r.status !== 'submitted' && r.status !== 'signed'
  );
  if (dup) throw _err(ctx, 'round_exists:' + dup.id);

  const autoM = getAutoMetrics(ctx, raw.wardCode);
  const metrics = Object.assign(_defaultMetrics(), autoM);

  const rec = {
    id: _uid(ctx, 'wrnd'),
    wardCode: String(raw.wardCode),
    wardLabel: String(raw.wardLabel || raw.wardCode),
    date,
    shiftType: String(raw.shiftType),
    supervisorId: ctx.actor && ctx.actor.id,
    supervisorName: _actorName(ctx.actor),
    status: 'draft',
    metrics,
    staffing: _defaultStaffing(),
    checklist: {
      staffing: {status:'na',notes:''}, equipment: {status:'na',notes:''},
      infection: {status:'na',notes:''}, safety: {status:'na',notes:''},
      medication: {status:'na',notes:''}, beds: {status:'na',notes:''},
      other: {status:'na',notes:''}
    },
    findings: [],
    finalNotes: '',
    createdAt: _now(ctx),
    createdBy: ctx.actor && ctx.actor.id
  };
  store.put(COLL, rec);
  try { _bus(ctx).emit('supervisor.round.created', { record: rec, actor: ctx.actor }); } catch (_) {}
  return rec;
}

// ── Update metrics (manual + override auto) ──
function updateMetrics(ctx, id, payload) {
  const store = _store(ctx);
  const r = store.get(COLL, id);
  if (!r) throw _err(ctx, 'not_found');
  if (r.status !== 'draft') throw _err(ctx, 'round_locked');
  const p = payload || {};
  r.metrics = r.metrics || _defaultMetrics();
  METRIC_KEYS.forEach(k => {
    if (p[k] != null) {
      const n = Number(p[k]);
      if (isFinite(n) && n >= 0) r.metrics[k] = Math.floor(n);
    }
  });
  if (typeof p.unrelated === 'string') r.metrics.unrelated = p.unrelated.slice(0, 500);
  r.updatedAt = _now(ctx);
  r.updatedBy = ctx.actor && ctx.actor.id;
  store.put(COLL, r);
  return r;
}

// ── Update staffing ──
function updateStaffing(ctx, id, payload) {
  const store = _store(ctx);
  const r = store.get(COLL, id);
  if (!r) throw _err(ctx, 'not_found');
  if (r.status !== 'draft') throw _err(ctx, 'round_locked');
  const p = payload || {};
  r.staffing = r.staffing || _defaultStaffing();
  ['shiftSupervisor','nursesNames','nurseAidesNames','secretary','absent'].forEach(k => {
    if (typeof p[k] === 'string') r.staffing[k] = p[k].slice(0, 300);
  });
  ['nurses','nurseAides'].forEach(k => {
    if (p[k] != null) {
      const n = Number(p[k]);
      if (isFinite(n) && n >= 0) r.staffing[k] = Math.floor(n);
    }
  });
  r.updatedAt = _now(ctx);
  r.updatedBy = ctx.actor && ctx.actor.id;
  store.put(COLL, r);
  return r;
}

// ── Refresh auto metrics ──
function refreshAutoMetrics(ctx, id) {
  const store = _store(ctx);
  const r = store.get(COLL, id);
  if (!r) throw _err(ctx, 'not_found');
  if (r.status !== 'draft') throw _err(ctx, 'round_locked');
  const auto = getAutoMetrics(ctx, r.wardCode);
  r.metrics = r.metrics || _defaultMetrics();
  AUTO_METRICS.forEach(k => { r.metrics[k] = auto[k] || 0; });
  store.put(COLL, r);
  return r;
}

// ── Checklist (kept) ──
function updateChecklist(ctx, id, category, payload) {
  if (CATEGORIES.indexOf(category) === -1) throw _err(ctx, 'invalid_category');
  const store = _store(ctx);
  const r = store.get(COLL, id);
  if (!r) throw _err(ctx, 'not_found');
  if (r.status !== 'draft') throw _err(ctx, 'round_locked');
  const st = (payload && payload.status) || 'na';
  if (['ok','warn','crit','na'].indexOf(st) === -1) throw _err(ctx, 'invalid_status');
  r.checklist[category] = { status: st, notes: String((payload && payload.notes) || '').slice(0, 1000) };
  r.updatedAt = _now(ctx);
  r.updatedBy = ctx.actor && ctx.actor.id;
  store.put(COLL, r);
  return r;
}

// ── Findings ──
function addFinding(ctx, id, payload) {
  const store = _store(ctx);
  const r = store.get(COLL, id);
  if (!r) throw _err(ctx, 'not_found');
  if (r.status !== 'draft') throw _err(ctx, 'round_locked');
  const p = payload || {};
  if (!p.text || !String(p.text).trim()) throw _err(ctx, 'text_required');
  if (CATEGORIES.indexOf(p.category) === -1) throw _err(ctx, 'invalid_category');
  if (SEVERITIES.indexOf(p.severity) === -1) throw _err(ctx, 'invalid_severity');
  const finding = {
    id: _uid(ctx, 'fnd'),
    category: p.category, severity: p.severity,
    text: String(p.text).slice(0, 1000),
    at: _now(ctx),
    by: ctx.actor && ctx.actor.id,
    byName: _actorName(ctx.actor)
  };
  r.findings = r.findings || [];
  r.findings.push(finding);
  store.put(COLL, r);
  return finding;
}

function removeFinding(ctx, id, fid) {
  const store = _store(ctx);
  const r = store.get(COLL, id);
  if (!r) throw _err(ctx, 'not_found');
  if (r.status !== 'draft') throw _err(ctx, 'round_locked');
  r.findings = (r.findings || []).filter(f => f.id !== fid);
  store.put(COLL, r);
  return r;
}

// ── Final notes / Submit / Sign ──
function setFinalNotes(ctx, id, text) {
  const store = _store(ctx);
  const r = store.get(COLL, id);
  if (!r) throw _err(ctx, 'not_found');
  if (r.status !== 'draft') throw _err(ctx, 'round_locked');
  r.finalNotes = String(text || '').slice(0, 2000);
  r.updatedAt = _now(ctx);
  store.put(COLL, r);
  return r;
}

function submit(ctx, id) {
  const store = _store(ctx);
  const r = store.get(COLL, id);
  if (!r) throw _err(ctx, 'not_found');
  if (r.status !== 'draft') throw _err(ctx, 'already_submitted');
  r.status = 'submitted';
  r.submittedAt = _now(ctx);
  r.submittedBy = ctx.actor && ctx.actor.id;
  store.put(COLL, r);
  try { _bus(ctx).emit('supervisor.round.submitted', { record: r, actor: ctx.actor }); } catch (_) {}
  return r;
}

function sign(ctx, id) {
  const store = _store(ctx);
  const r = store.get(COLL, id);
  if (!r) throw _err(ctx, 'not_found');
  if (r.status !== 'submitted') throw _err(ctx, 'not_submitted');
  r.status = 'signed';
  r.signedAt = _now(ctx);
  r.signedBy = ctx.actor && ctx.actor.id;
  r.signedByName = _actorName(ctx.actor);
  store.put(COLL, r);
  try { _bus(ctx).emit('supervisor.round.signed', { record: r, actor: ctx.actor }); } catch (_) {}
  return r;
}

// ── Lists ──
function listToday(ctx) {
  const today = _todayISO();
  const items = _all(ctx, COLL).filter(r => r.date === today);
  return { items, date: today };
}

function getCoverage(ctx) {
  const today = _todayISO();
  const shiftType = (ctx.query && ctx.query.shiftType) || 'morning';
  const rounds = _all(ctx, COLL).filter(r => r.date === today && r.shiftType === shiftType);
  const beds = _all(ctx, 'beds');
  const wards = {};
  beds.forEach(b => {
    const w = b.wardCode || '?';
    if (!wards[w]) wards[w] = { code: w, label: b.wardLabel || w, bedsTotal: 0 };
    wards[w].bedsTotal++;
  });
  const roundByWard = {};
  rounds.forEach(r => {
    roundByWard[r.wardCode] = {
      roundId: r.id, status: r.status,
      findings: (r.findings || []).length,
      critical: (r.findings || []).filter(f => f.severity === 'critical').length,
      metrics: r.metrics || null,
      staffing: r.staffing || null
    };
  });
  const coverage = Object.values(wards).map(w => ({
    wardCode: w.code, wardLabel: w.label, bedsTotal: w.bedsTotal,
    rounded: !!roundByWard[w.code],
    round: roundByWard[w.code] || null
  })).sort((a, b) => a.wardCode.localeCompare(b.wardCode));
  const done = coverage.filter(c => c.rounded).length;
  return {
    date: today, shiftType, coverage,
    progress: { done, total: coverage.length, pct: coverage.length ? Math.round(done / coverage.length * 100) : 0 }
  };
}

function getStats(ctx, days) {
  const d = Number(days) > 0 ? Number(days) : 7;
  const since = Date.now() - d * 86400000;
  const all = _all(ctx, COLL);
  const inP = all.filter(r => {
    const t = Date.parse(r.date + 'T00:00:00Z');
    return isFinite(t) && t >= since;
  });
  const bySev = { info: 0, warning: 0, critical: 0 };
  const byCat = {};
  let totalFindings = 0;
  inP.forEach(r => {
    (r.findings || []).forEach(f => {
      totalFindings++;
      if (bySev[f.severity] != null) bySev[f.severity]++;
      byCat[f.category] = (byCat[f.category] || 0) + 1;
    });
  });
  return {
    periodDays: d, rounds: inP.length,
    signed: inP.filter(r => r.status === 'signed').length,
    submitted: inP.filter(r => r.status === 'submitted').length,
    draft: inP.filter(r => r.status === 'draft').length,
    totalFindings, findingsBySeverity: bySev, findingsByCategory: byCat
  };
}

module.exports = {
  COLL, CATEGORIES, SEVERITIES, METRIC_KEYS, AUTO_METRICS,
  create, updateMetrics, updateStaffing, refreshAutoMetrics, getAutoMetrics,
  updateChecklist, addFinding, removeFinding, setFinalNotes,
  submit, sign, listToday, getCoverage, getStats
};
