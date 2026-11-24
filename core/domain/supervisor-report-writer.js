'use strict';
// core/domain/supervisor-report-writer.js — Supervisor Shift Report v2 (Complete)

const COLL = 'supervisor_reports';
const _store = (ctx) => (ctx && ctx.store) || require('../store');
const _bus = (ctx) => (ctx && ctx.bus) || require('../events');
const _uid = (ctx, p) => (ctx && typeof ctx.uid === 'function') ? ctx.uid(p) : _store(ctx).uid(p);
const _now = (ctx) => (ctx && typeof ctx.now === 'function') ? ctx.now() : new Date().toISOString();
const _err = (ctx, code) => (ctx && ctx.E && typeof ctx.E.badRequest === 'function') ? ctx.E.badRequest(code) : Object.assign(new Error(code), { code });
const _all = (ctx, c) => { try { const r = _store(ctx).readAll(c); return Array.isArray(r) ? r : []; } catch (_) { return []; } };
function _todayISO() { return new Date().toISOString().slice(0, 10); }
function _actorName(a) { return (a && (a.fullName || a.username)) || 'سیستم'; }

function create(ctx, raw) {
  if (!raw || !raw.shiftType) throw _err(ctx, 'shift_required');
  const date = raw.date || _todayISO();
  const store = _store(ctx);
  const dup = _all(ctx, COLL).find(r => r.date === date && r.shiftType === raw.shiftType && !['submitted', 'signed'].includes(r.status));
  if (dup) throw _err(ctx, 'report_exists:' + dup.id);

  const rec = {
    id: _uid(ctx, 'srpt'), date, shiftType: String(raw.shiftType),
    supervisorId: ctx.actor && ctx.actor.id, supervisorName: _actorName(ctx.actor), status: 'draft',
    
    // Section B: Personnel
    absentStaff: [], sickLeave: [], staffTransfers: [],
    
    // Section C: Special Patients
    intubated: [], icuWaiting: [], needsSpecialCare: [],
    dialysis: [], plasmapheresis: [], endoscopy: [], sleepTest: [],
    
    // Section D: Codes
    code99: [], code724: [], deaths: [], deathCertificates: [],
    
    // Section E: High Risk Groups
    highRiskMother: [], highRiskChild: [], fallRisk: [], suicideRisk: [],
    pressureUlcer: [], seizure: [], malnutrition: [], unknownIdentity: [], homeless: [],
    
    // Section F: Infectious
    suspectedCovid: [], confirmedCovid: [], suspectedNH: [], confirmedNH: [],
    
    // Section G: Events
    incidents: [], unexpectedEvents: [], dispatches: [], referrals: [], visits: [], doorOpened: [],
    
    // Section H: Facilities
    ventilatorsFree: [], equipmentBroken: [],
    
    // Section I: Totals
    morseTotal: 0, bradenTotal: 0, totalPatients: 0,
    narcoticConsumption: '', medicationConsumption: '',
    
    // Section J: Signature
    nursingOfficeSignature: '', supervisorSignature: '',
    finalNotes: '',
    
    createdAt: _now(ctx), createdBy: ctx.actor && ctx.actor.id
  };
  store.put(COLL, rec);
  try { _bus(ctx).emit('supervisor.report.created', { record: rec, actor: ctx.actor }); } catch (_) {}
  return rec;
}

function update(ctx, id, payload) {
  const store = _store(ctx); const r = store.get(COLL, id);
  if (!r) throw _err(ctx, 'not_found'); if (r.status !== 'draft') throw _err(ctx, 'report_locked');
  Object.keys(payload).forEach(k => {
    if (typeof r[k] === 'number' && typeof payload[k] === 'number') r[k] = payload[k];
    else if (typeof r[k] === 'string' && typeof payload[k] === 'string') r[k] = payload[k].slice(0, 2000);
  });
  r.updatedAt = _now(ctx); r.updatedBy = ctx.actor && ctx.actor.id;
  store.put(COLL, r); return r;
}

function addDynamicItem(ctx, id, arrayName, payload) {
  const store = _store(ctx); const r = store.get(COLL, id);
  if (!r) throw _err(ctx, 'not_found'); if (r.status !== 'draft') throw _err(ctx, 'report_locked');
  if (!Array.isArray(r[arrayName])) r[arrayName] = [];
  const item = { id: _uid(ctx, 'dyn'), ...payload, at: _now(ctx) };
  r[arrayName].push(item);
  store.put(COLL, r); return r;
}

function removeDynamicItem(ctx, id, arrayName, itemId) {
  const store = _store(ctx); const r = store.get(COLL, id);
  if (!r) throw _err(ctx, 'not_found'); if (r.status !== 'draft') throw _err(ctx, 'report_locked');
  if (!Array.isArray(r[arrayName])) throw _err(ctx, 'invalid_array');
  r[arrayName] = r[arrayName].filter(i => i.id !== itemId);
  store.put(COLL, r); return r;
}

function updateDynamicItem(ctx, id, arrayName, itemId, payload) {
  const store = _store(ctx); const r = store.get(COLL, id);
  if (!r) throw _err(ctx, 'not_found'); if (r.status !== 'draft') throw _err(ctx, 'report_locked');
  if (!Array.isArray(r[arrayName])) throw _err(ctx, 'invalid_array');
  const idx = r[arrayName].findIndex(i => i.id === itemId);
  if (idx === -1) throw _err(ctx, 'item_not_found');
  r[arrayName][idx] = { ...r[arrayName][idx], ...payload, updatedAt: _now(ctx) };
  store.put(COLL, r); return r;
}

function submit(ctx, id) {
  const store = _store(ctx); const r = store.get(COLL, id);
  if (!r || r.status !== 'draft') throw _err(ctx, 'already_submitted');
  r.status = 'submitted'; r.submittedAt = _now(ctx); r.submittedBy = ctx.actor && ctx.actor.id;
  store.put(COLL, r); return r;
}

function sign(ctx, id) {
  const store = _store(ctx); const r = store.get(COLL, id);
  if (!r || r.status !== 'submitted') throw _err(ctx, 'not_submitted');
  r.status = 'signed'; r.signedAt = _now(ctx); r.signedBy = ctx.actor && ctx.actor.id; r.signedByName = _actorName(ctx.actor);
  store.put(COLL, r); return r;
}

function listToday(ctx) { return { items: _all(ctx, COLL).filter(r => r.date === _todayISO()), date: _todayISO() }; }
function listRecent(ctx, days) {
  const d = Number(days) > 0 ? Number(days) : 7; const since = Date.now() - d * 86400000;
  return { items: _all(ctx, COLL).filter(r => { const t = Date.parse(r.date + 'T00:00:00Z'); return isFinite(t) && t >= since; }) };
}

module.exports = { COLL, create, update, addDynamicItem, removeDynamicItem, updateDynamicItem, submit, sign, listToday, listRecent };
