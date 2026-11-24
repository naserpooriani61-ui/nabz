'use strict';
// core/domain/clinical-tasks.js — writer for 'clinical_tasks'
// All task state changes MUST go through this module (zero-tolerance).

function _store(ctx) {
  if (ctx && ctx.store && typeof ctx.store.put === 'function') return ctx.store;
  return require('../store');
}
function _bus(ctx) {
  if (ctx && ctx.bus && typeof ctx.bus.emit === 'function') return ctx.bus;
  try { return require('../events'); } catch (_) { return null; }
}
function _now(ctx) { return (ctx && typeof ctx.now === 'function') ? ctx.now() : new Date().toISOString(); }
function _uid(ctx, p) { return (typeof ctx.uid === 'function') ? ctx.uid(p) : _store(ctx).uid(p); }
function _err(code) { const e = new Error(code); e.code = code; return e; }
function _emit(ctx, ev, payload) {
  const b = _bus(ctx);
  if (b && typeof b.emit === 'function') {
    try { b.emit(ev, payload); } catch (e) { console.warn('[clinical-tasks] emit:', e.message); }
  }
}

const TASK_TYPES = {
  esi2_physician_see:        { priority: 'critical', sla: 10,   owner: 'resident_1' },
  esi2_nurse_see:            { priority: 'critical', sla: 5,    owner: 'nurse' },
  order_cosign:              { priority: 'urgent',   sla: 30,   owner: 'resident_senior' },
  attending_cosign:          { priority: 'urgent',   sla: 120,  owner: 'attending' },
  verbal_readback:           { priority: 'critical', sla: 5,    owner: 'nurse' },
  verbal_cosign:             { priority: 'urgent',   sla: 1440, owner: 'resident_senior' },
  lab_critical_alert:        { priority: 'critical', sla: 5,    owner: 'resident_senior' },
  lab_review:                { priority: 'routine',  sla: 60,   owner: 'resident_senior' },
  consult_accept:            { priority: 'urgent',   sla: 15,   owner: 'resident_1' },
  consult_see:               { priority: 'urgent',   sla: 30,   owner: 'resident_1' },
  consult_attending_approve: { priority: 'urgent',   sla: 60,   owner: 'attending' },
  consult_acknowledge:       { priority: 'routine',  sla: 30,   owner: 'resident_1' },
  med_due_alert:             { priority: 'urgent',   sla: 15,   owner: 'nurse' },
  med_overdue:               { priority: 'critical', sla: 5,    owner: 'nurse' },
  discharge_checklist:       { priority: 'urgent',   sla: 30,   owner: 'nurse' },
  sbar_required:             { priority: 'routine',  sla: 30,   owner: 'nurse' },
  handoff_receiver_ack:      { priority: 'urgent',   sla: 10,   owner: 'nurse' },
  clinical_deterioration:    { priority: 'critical', sla: 5,    owner: 'resident_1' },
  bed_assignment_delay:      { priority: 'urgent',   sla: 15,   owner: 'head_nurse' },
  boarding_alert:            { priority: 'urgent',   sla: 0,    owner: 'supervisor' },
  los_alert:                 { priority: 'routine',  sla: 0,    owner: 'head_nurse' }
};

const ESCALATION_MAP = {
  nurse: 'head_nurse', head_nurse: 'supervisor', supervisor: 'attending',
  intern: 'resident_1', resident_1: 'resident_senior',
  resident_senior: 'attending', attending: 'supervisor',
  attending_consultant: 'attending'
};

function create(ctx, raw) {
  const s = _store(ctx);
  const now = _now(ctx);
  const meta = TASK_TYPES[raw.type];
  if (!meta) throw _err('task:unknown_type:' + raw.type);
  const sla = raw.sla_minutes != null ? raw.sla_minutes : meta.sla;
  const dueAt = sla > 0
    ? new Date(Date.now() + sla * 60000).toISOString()
    : now;
  const t = {
    id: raw.id || _uid(ctx, 'tsk'),
    type: raw.type,
    priority: raw.priority || meta.priority,
    sla_minutes: sla,
    created_at: now,
    due_at: dueAt,
    acknowledged_at: null,
    acknowledged_by: null,
    acknowledged_by_name: null,
    resolved_at: null,
    resolved_by: null,
    resolved_by_name: null,
    resolution_note: null,
    cancelled_at: null,
    cancelled_by: null,
    cancelled_reason: null,
    escalated_at: null,
    escalated_to: [],
    related: raw.related || {},
    context: raw.context || {},
    owner_role: raw.owner_role || meta.owner,
    owner_id: raw.owner_id || null,
    status: 'open',
    _trans: [{ at: now, action: 'created', by: (ctx.actor && ctx.actor.id) || 'system' }]
  };
  s.put('clinical_tasks', t);
  _emit(ctx, 'ed.task.created', { task: t });
  return t;
}

function acknowledge(ctx, id) {
  const s = _store(ctx);
  const t = s.get('clinical_tasks', id);
  if (!t) throw _err('task:not_found:' + id);
  if (t.status !== 'open' && t.status !== 'escalated') throw _err('task:invalid_state:' + t.status);
  const now = _now(ctx);
  t.status = 'acknowledged';
  t.acknowledged_at = now;
  t.acknowledged_by = (ctx.actor && ctx.actor.id) || 'unknown';
  t.acknowledged_by_name = (ctx.actor && (ctx.actor.fullName || ctx.actor.username)) || null;
  t._trans.push({ at: now, action: 'acknowledged', by: t.acknowledged_by });
  s.put('clinical_tasks', t);
  _emit(ctx, 'ed.task.acknowledged', { task: t, actor: ctx.actor });
  return t;
}

function resolve(ctx, id, opts) {
  const o = opts || {};
  const s = _store(ctx);
  const t = s.get('clinical_tasks', id);
  if (!t) throw _err('task:not_found:' + id);
  if (t.status === 'resolved' || t.status === 'cancelled') return t;
  const now = _now(ctx);
  t.status = 'resolved';
  t.resolved_at = now;
  t.resolved_by = (ctx.actor && ctx.actor.id) || 'unknown';
  t.resolved_by_name = (ctx.actor && (ctx.actor.fullName || ctx.actor.username)) || null;
  t.resolution_note = o.note || null;
  t._trans.push({ at: now, action: 'resolved', by: t.resolved_by, note: o.note || null });
  s.put('clinical_tasks', t);
  _emit(ctx, 'ed.task.resolved', { task: t, actor: ctx.actor });
  return t;
}

function cancel(ctx, id, opts) {
  const o = opts || {};
  const s = _store(ctx);
  const t = s.get('clinical_tasks', id);
  if (!t) throw _err('task:not_found:' + id);
  if (t.status === 'resolved' || t.status === 'cancelled') return t;
  const now = _now(ctx);
  t.status = 'cancelled';
  t.cancelled_at = now;
  t.cancelled_by = (ctx.actor && ctx.actor.id) || 'system';
  t.cancelled_reason = o.reason || 'no_reason';
  t._trans.push({ at: now, action: 'cancelled', by: t.cancelled_by, reason: t.cancelled_reason });
  s.put('clinical_tasks', t);
  _emit(ctx, 'ed.task.cancelled', { task: t, actor: ctx.actor });
  return t;
}

function escalate(ctx, id, reason) {
  const s = _store(ctx);
  const t = s.get('clinical_tasks', id);
  if (!t) return null;
  if (t.status === 'resolved' || t.status === 'cancelled') return t;
  const now = _now(ctx);
  const next = ESCALATION_MAP[t.owner_role] || 'supervisor';
  t.status = 'escalated';
  t.escalated_at = now;
  t.escalated_to = t.escalated_to || [];
  t.escalated_to.push({ role: next, at: now });
  t._trans.push({ at: now, action: 'escalated', to_role: next, reason: reason || 'sla_breached' });
  s.put('clinical_tasks', t);
  _emit(ctx, 'ed.task.escalated', { task: t, reason });
  return t;
}

function readAll(ctx) { const r = _store(ctx).readAll('clinical_tasks'); return Array.isArray(r) ? r : []; }
function readOne(ctx, id) { return _store(ctx).get('clinical_tasks', id); }

function listMine(ctx) {
  const role = (ctx.actor && ctx.actor.role) || 'nurse';
  const uid = ctx.actor && ctx.actor.id;
  return readAll(ctx).filter(t => {
    if (t.status === 'resolved' || t.status === 'cancelled') return false;
    if (t.owner_id && t.owner_id === uid) return true;
    if (!t.owner_id && t.owner_role === role) return true;
    if (t.status === 'escalated' && (t.escalated_to || []).some(e => e.role === role)) return true;
    return false;
  }).sort((a, b) => {
    const P = { critical: 0, urgent: 1, routine: 2 };
    const pa = P[a.priority] != null ? P[a.priority] : 9;
    const pb = P[b.priority] != null ? P[b.priority] : 9;
    if (pa !== pb) return pa - pb;
    return new Date(a.due_at) - new Date(b.due_at);
  });
}

function listByVisit(ctx, visitId) {
  return readAll(ctx).filter(t => t.related && t.related.visit_id === visitId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function listOverdue(ctx) {
  const now = Date.now();
  return readAll(ctx).filter(t => {
    if (t.status === 'resolved' || t.status === 'cancelled') return false;
    return new Date(t.due_at).getTime() < now;
  });
}

function stats(ctx) {
  const all = readAll(ctx);
  const now = Date.now();
  const open = all.filter(t => t.status === 'open' || t.status === 'acknowledged' || t.status === 'escalated');
  const overdue = open.filter(t => new Date(t.due_at).getTime() < now);
  const byType = {};
  all.forEach(t => { byType[t.type] = (byType[t.type] || 0) + 1; });
  return { total: all.length, open: open.length, overdue: overdue.length, byType, TASK_TYPES_KEYS: Object.keys(TASK_TYPES) };
}

module.exports = {
  create, acknowledge, resolve, cancel, escalate,
  readAll, readOne, listMine, listByVisit, listOverdue, stats,
  TASK_TYPES, ESCALATION_MAP
};
