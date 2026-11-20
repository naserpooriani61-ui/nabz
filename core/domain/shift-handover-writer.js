'use strict';
// core/domain/shift-handover-writer.js — تنها مسیر نوشتن shift_handovers
const COLL = 'shift_handovers';
const _store = (ctx) => (ctx && ctx.store) || require('../store');
const _bus = (ctx) => (ctx && ctx.bus) || require('../events');
const _uid = (ctx, p) => (ctx && typeof ctx.uid === 'function') ? ctx.uid(p) : _store(ctx).uid(p);
const _now = (ctx) => (ctx && typeof ctx.now === 'function') ? ctx.now() : new Date().toISOString();
const _err = (ctx, code) => {
  if (ctx && ctx.E && typeof ctx.E.badRequest === 'function') return ctx.E.badRequest(code);
  return Object.assign(new Error(code), { code });
};
const _all = (ctx, c) => { try { const r = _store(ctx).readAll(c); return Array.isArray(r) ? r : []; } catch (_) { return []; } };

function create(ctx, raw) {
  if (!raw || typeof raw !== 'object') throw _err(ctx, 'invalid_payload');
  if (!raw.shiftType) throw _err(ctx, 'shift_required');
  if (!raw.date) throw _err(ctx, 'date_required');
  const store = _store(ctx);
  // uniqueness: one active handover per date+shift
  const dup = _all(ctx, COLL).find(h => h.date === raw.date && h.shiftType === raw.shiftType && h.status !== 'archived');
  if (dup) throw _err(ctx, 'handover_exists:' + dup.id);
  const rec = {
    id: _uid(ctx, 'shf'),
    date: String(raw.date),
    shiftType: String(raw.shiftType),
    supervisorId: ctx.actor && ctx.actor.id,
    supervisorName: (ctx.actor && (ctx.actor.fullName || ctx.actor.username)) || '',
    summary: String(raw.summary || '').slice(0, 2000),
    issues: Array.isArray(raw.issues) ? raw.issues.slice(0, 50) : [],
    incidents: Array.isArray(raw.incidents) ? raw.incidents.slice(0, 50) : [],
    metrics: (raw.metrics && typeof raw.metrics === 'object') ? raw.metrics : {},
    status: 'draft',
    createdAt: _now(ctx),
    createdBy: ctx.actor && ctx.actor.id
  };
  store.put(COLL, rec);
  try { _bus(ctx).emit('supervisor.handover.created', { record: rec, actor: ctx.actor }); } catch (_) {}
  return rec;
}

function sign(ctx, id) {
  const store = _store(ctx);
  const h = store.get(COLL, id);
  if (!h) throw _err(ctx, 'not_found');
  if (h.status === 'signed' || h.status === 'received') throw _err(ctx, 'already_signed');
  if (h.status !== 'draft') throw _err(ctx, 'not_draft');
  h.status = 'signed';
  h.signedAt = _now(ctx);
  h.signedBy = ctx.actor && ctx.actor.id;
  h.signedByName = (ctx.actor && (ctx.actor.fullName || ctx.actor.username)) || '';
  store.put(COLL, h);
  try { _bus(ctx).emit('supervisor.handover.signed', { record: h, actor: ctx.actor }); } catch (_) {}
  return h;
}

function receive(ctx, id) {
  const store = _store(ctx);
  const h = store.get(COLL, id);
  if (!h) throw _err(ctx, 'not_found');
  if (h.status !== 'signed') throw _err(ctx, 'not_signed');
  h.status = 'received';
  h.receivedAt = _now(ctx);
  h.receivedBy = ctx.actor && ctx.actor.id;
  h.receivedByName = (ctx.actor && (ctx.actor.fullName || ctx.actor.username)) || '';
  store.put(COLL, h);
  try { _bus(ctx).emit('supervisor.handover.received', { record: h, actor: ctx.actor }); } catch (_) {}
  return h;
}

function listToday(ctx) {
  const today = new Date().toISOString().slice(0, 10);
  const items = _all(ctx, COLL).filter(h => h.date === today).sort((a, b) => (a.shiftType || '').localeCompare(b.shiftType || ''));
  return { items, date: today };
}

function listRecent(ctx, days) {
  const d = Number(days) > 0 ? Number(days) : 7;
  const since = Date.now() - d * 86400000;
  const items = _all(ctx, COLL).filter(h => {
    const t = Date.parse(h.date + 'T00:00:00Z');
    return isFinite(t) && t >= since;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { items, periodDays: d };
}

module.exports = { COLL, create, sign, receive, listToday, listRecent };
