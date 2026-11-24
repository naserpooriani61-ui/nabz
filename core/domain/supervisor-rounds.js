'use strict';
// NABZ Supervisor Rounds & Final Report Engine
const COLL = 'supervisor_rounds';
const _store = (ctx) => (ctx && ctx.store) || require('../store');
const _uid = (ctx, p) => (ctx && typeof ctx.uid === 'function') ? ctx.uid(p) : _store(ctx).uid(p);
const _now = (ctx) => (ctx && typeof ctx.now === 'function') ? ctx.now() : new Date().toISOString();
const _err = (ctx, code) => (ctx && ctx.E && typeof ctx.E.badRequest === 'function') ? ctx.E.badRequest(code) : Object.assign(new Error(code), { code });
const _all = (ctx, c) => { try { const r = _store(ctx).readAll(c); return Array.isArray(r) ? r : []; } catch (_) { return []; } };

function _todayISO() { return new Date().toISOString().slice(0, 10); }

function create(ctx, raw) {
  if (!raw || !raw.wardCode || !raw.shiftType) throw _err(ctx, 'ward_and_shift_required');
  const date = raw.date || _todayISO();
  const store = _store(ctx);
  
  const dup = _all(ctx, COLL).find(r => r.wardCode === raw.wardCode && r.date === date && r.shiftType === raw.shiftType && r.status !== 'signed');
  if (dup) throw _err(ctx, 'round_exists:' + dup.id);

  const rec = {
    id: _uid(ctx, 'rnd'),
    wardCode: String(raw.wardCode),
    wardName: String(raw.wardName || raw.wardCode),
    date,
    shiftType: String(raw.shiftType),
    supervisorId: ctx.actor && ctx.actor.id,
    supervisorName: (ctx.actor && (ctx.actor.fullName || ctx.actor.username)) || 'سیستم',
    status: 'draft',
    // Dynamic Arrays (Initialized empty)
    absentStaff: [], intubated: [], icuWaiting: [], specialCare: [],
    code99: [], code724: [], highRisk: [], infectious: [],
    incidents: [], dispatches: [], facilities: [],
    // Totals
    totalPatients: 0, morseTotal: 0, bradenTotal: 0, narcoticConsumption: '',
    finalNotes: '',
    supervisorSignature: '',
    nursingOfficeSignature: '',
    createdAt: _now(ctx)
  };
  store.put(COLL, rec);
  return rec;
}

function addDynamicItem(ctx, id, arrayName, payload) {
  const store = _store(ctx);
  const r = store.get(COLL, id);
  if (!r) throw _err(ctx, 'not_found');
  if (r.status === 'signed') throw _err(ctx, 'round_locked');
  if (!Array.isArray(r[arrayName])) r[arrayName] = [];
  
  const item = { id: _uid(ctx, 'itm'), ...payload, addedAt: _now(ctx) };
  r[arrayName].push(item);
  store.put(COLL, r);
  return r;
}

function removeDynamicItem(ctx, id, arrayName, itemId) {
  const store = _store(ctx);
  const r = store.get(COLL, id);
  if (!r) throw _err(ctx, 'not_found');
  if (r.status === 'signed') throw _err(ctx, 'round_locked');
  if (!Array.isArray(r[arrayName])) throw _err(ctx, 'invalid_array');
  
  r[arrayName] = r[arrayName].filter(i => i.id !== itemId);
  store.put(COLL, r);
  return r;
}

function updateField(ctx, id, field, value) {
  const store = _store(ctx);
  const r = store.get(COLL, id);
  if (!r) throw _err(ctx, 'not_found');
  if (r.status === 'signed') throw _err(ctx, 'round_locked');
  
  r[field] = value;
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
  store.put(COLL, r);
  return r;
}

function sign(ctx, id) {
  const store = _store(ctx);
  const r = store.get(COLL, id);
  if (!r) throw _err(ctx, 'not_found');
  if (r.status !== 'submitted') throw _err(ctx, 'not_submitted');
  r.status = 'signed';
  r.signedAt = _now(ctx);
  store.put(COLL, r);
  return r;
}

function listToday(ctx) {
  const today = _todayISO();
  const { wardCode } = ctx.query || {};
  let items = _all(ctx, COLL).filter(r => r.date === today);
  if (wardCode) items = items.filter(r => r.wardCode === wardCode);
  return { items, date: today };
}

module.exports = { COLL, create, addDynamicItem, removeDynamicItem, updateField, submit, sign, listToday };
