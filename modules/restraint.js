'use strict';
// NABZ JCI COP.5 Restraint Management.
// Violent order: adult 4h · 9-17 2h · <9 1h. Reassess 15m. Face-to-face 60m.
// Non-violent order: 24h. Reassess 4h. Face-to-face 24h.
const store = require('../core/store');
const perms = require('../core/permissions');
const bus = require('../core/events');
const audit = require('../core/audit');

if (!perms.P['restraint.view']) {
  Object.assign(perms.P, {
    'restraint.view': 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,supervisor_er,head_nurse,attending,specialist,resident,intern,physician,nurse,quality_officer',
    'restraint.order': 'admin,attending,specialist,resident,intern,physician',
    'restraint.face_to_face': 'admin,attending,specialist,physician,resident',
    'restraint.assess': 'admin,nurse,head_nurse',
    'restraint.renew': 'admin,attending,specialist,resident,physician',
    'restraint.release': 'admin,attending,specialist,resident,physician,head_nurse'
  });
}

const LIMITS = {
  adult:          { violent: { orderH: 4, reassessMin: 15,  f2fMin: 60   }, nonviolent: { orderH: 24, reassessMin: 240, f2fMin: 1440 } },
  child_9_to_17:  { violent: { orderH: 2, reassessMin: 15,  f2fMin: 60   }, nonviolent: { orderH: 24, reassessMin: 240, f2fMin: 1440 } },
  child_under_9:  { violent: { orderH: 1, reassessMin: 15,  f2fMin: 60   }, nonviolent: { orderH: 24, reassessMin: 240, f2fMin: 1440 } }
};
const COL = 'restraint_events';

function ageBand(age) {
  age = Number(age);
  if (!age || age < 0) return 'adult';
  if (age < 9) return 'child_under_9';
  if (age < 18) return 'child_9_to_17';
  return 'adult';
}
function classifyType(t) { return ['violent_self', 'violent_other'].includes(t) ? 'violent' : 'nonviolent'; }
function limitsFor(type, age) { return LIMITS[ageBand(age)][classifyType(type)]; }

function start(ctx) {
  const b = ctx.body || {};
  if (!b.patientId) throw ctx.E.badRequest('patient_id_required');
  if (!['violent_self', 'violent_other', 'nonviolent_medical'].includes(b.type)) throw ctx.E.badRequest('invalid_type');
  if (!b.reason || String(b.reason).trim().length < 10) throw ctx.E.badRequest('reason_min_10_chars');
  if (!Array.isArray(b.alternativesTried) || !b.alternativesTried.length) throw ctx.E.badRequest('alternatives_required');
  const patient = store.get('patients', b.patientId);
  if (!patient) throw ctx.E.notFound('patient_not_found');
  const existing = store.readAll(COL).find(r => r.patientId === b.patientId && r.status === 'active');
  if (existing) throw ctx.E.conflict('patient_already_restrained:' + existing.id);
  const lim = limitsFor(b.type, patient.age);
  const now = Date.now();
  const rec = {
    id: store.uid('rst'),
    patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName,
    wardCode: patient.wardCode, bedNumber: patient.bedNumber,
    age: patient.age, ageBand: ageBand(patient.age),
    type: b.type, typeClass: classifyType(b.type),
    restraintType: b.restraintType || 'physical',
    indication: b.indication || 'behavioral',
    reason: String(b.reason).trim(),
    alternativesTried: b.alternativesTried.slice(0, 10).map(String),
    orderedBy: ctx.actor.id, orderedByName: ctx.actor.fullName || ctx.actor.username,
    orderedAt: new Date(now).toISOString(),
    orderDurationMinutes: lim.orderH * 60,
    orderExpiresAt: new Date(now + lim.orderH * 3600000).toISOString(),
    renewals: [], faceToFace: null,
    faceToFaceDeadline: new Date(now + lim.f2fMin * 60000).toISOString(),
    reassessmentIntervalMin: lim.reassessMin,
    nextAssessmentDueAt: new Date(now + lim.reassessMin * 60000).toISOString(),
    assessments: [], status: 'active',
    startedBy: ctx.actor.id, startedByName: ctx.actor.fullName || ctx.actor.username,
    startedAt: new Date(now).toISOString(),
    events: [{ type: 'started', at: new Date(now).toISOString(), by: ctx.actor.id, byName: ctx.actor.fullName || ctx.actor.username }]
  };
  store.put(COL, rec);
  try { audit.write('restraint', 'started', rec.id, ctx.actor, { type: b.type }); } catch (_) {}
  bus.emit('restraint.started', { record: rec, actor: ctx.actor });
  return rec;
}
function recordFaceToFace(ctx) {
  const r = store.get(COL, ctx.params.id);
  if (!r) throw ctx.E.notFound('restraint_not_found');
  if (r.status !== 'active') throw ctx.E.conflict('not_active');
  if (r.faceToFace) throw ctx.E.conflict('already_recorded');
  const b = ctx.body || {};
  if (!b.findings || String(b.findings).trim().length < 10) throw ctx.E.badRequest('findings_min_10_chars');
  r.faceToFace = { doneBy: ctx.actor.id, doneByName: ctx.actor.fullName || ctx.actor.username,
    doneAt: new Date().toISOString(), findings: String(b.findings).trim(),
    appropriateForRestraint: b.appropriateForRestraint !== false, notedStatusChanges: b.notedStatusChanges || '' };
  r.events.push({ type: 'face_to_face', at: r.faceToFace.doneAt, by: ctx.actor.id, byName: r.faceToFace.doneByName });
  store.put(COL, r);
  try { audit.write('restraint', 'face_to_face', r.id, ctx.actor, {}); } catch (_) {}
  bus.emit('restraint.face_to_face', { record: r, actor: ctx.actor });
  if (r.faceToFace.appropriateForRestraint === false) bus.emit('restraint.critical', { record: r, reason: 'f2f_inappropriate', actor: ctx.actor });
  return r;
}
function assess(ctx) {
  const r = store.get(COL, ctx.params.id);
  if (!r) throw ctx.E.notFound('restraint_not_found');
  if (r.status !== 'active') throw ctx.E.conflict('not_active');
  const b = ctx.body || {};
  const now = Date.now();
  const a = { id: store.uid('ras'), at: new Date(now).toISOString(), by: ctx.actor.id,
    byName: ctx.actor.fullName || ctx.actor.username,
    behavior: b.behavior || 'unknown', circulation: b.circulation || 'unknown',
    sensation: b.sensation || 'unknown', skinCondition: b.skinCondition || 'unknown',
    toileting: b.toileting === true, hydration: b.hydration === true,
    rangeOfMotion: b.rangeOfMotion === true, vitals: b.vitals || {},
    releaseConsidered: b.releaseConsidered === true, notes: String(b.notes || '').slice(0, 500) };
  r.assessments.push(a);
  r.nextAssessmentDueAt = new Date(now + r.reassessmentIntervalMin * 60000).toISOString();
  r._overdueAssessAlerted = false;
  r.events.push({ type: 'assessed', at: a.at, by: ctx.actor.id, byName: a.byName });
  store.put(COL, r);
  bus.emit('restraint.assessed', { record: r, assessment: a, actor: ctx.actor });
  return { record: r, assessment: a };
}
function renew(ctx) {
  const r = store.get(COL, ctx.params.id);
  if (!r) throw ctx.E.notFound('restraint_not_found');
  if (r.status !== 'active') throw ctx.E.conflict('not_active');
  const b = ctx.body || {};
  if (!b.reason || String(b.reason).trim().length < 10) throw ctx.E.badRequest('reason_min_10_chars');
  const lim = limitsFor(r.type, r.age);
  const now = Date.now();
  const rn = { renewedBy: ctx.actor.id, renewedByName: ctx.actor.fullName || ctx.actor.username,
    renewedAt: new Date(now).toISOString(), durationMinutes: lim.orderH * 60,
    expiresAt: new Date(now + lim.orderH * 3600000).toISOString(), reason: String(b.reason).trim() };
  r.renewals.push(rn);
  r.orderDurationMinutes = lim.orderH * 60; r.orderExpiresAt = rn.expiresAt;
  r.nextAssessmentDueAt = new Date(now + lim.reassessMin * 60000).toISOString();
  r._overdueOrderAlerted = false;
  r.events.push({ type: 'renewed', at: rn.renewedAt, by: ctx.actor.id, byName: rn.renewedByName });
  store.put(COL, r);
  try { audit.write('restraint', 'renewed', r.id, ctx.actor, { expiresAt: rn.expiresAt }); } catch (_) {}
  bus.emit('restraint.renewed', { record: r, renewal: rn, actor: ctx.actor });
  return r;
}
function release(ctx) {
  const r = store.get(COL, ctx.params.id);
  if (!r) throw ctx.E.notFound('restraint_not_found');
  if (r.status !== 'active') throw ctx.E.conflict('not_active');
  const b = ctx.body || {};
  if (!b.reason || String(b.reason).trim().length < 5) throw ctx.E.badRequest('reason_min_5_chars');
  r.status = 'released'; r.releasedAt = new Date().toISOString();
  r.releasedBy = ctx.actor.id; r.releasedByName = ctx.actor.fullName || ctx.actor.username;
  r.releaseReason = String(b.reason).trim();
  r.events.push({ type: 'released', at: r.releasedAt, by: ctx.actor.id, byName: r.releasedByName });
  store.put(COL, r);
  try { audit.write('restraint', 'released', r.id, ctx.actor, { reason: r.releaseReason }); } catch (_) {}
  bus.emit('restraint.released', { record: r, actor: ctx.actor });
  return r;
}
function listActive(ctx) {
  let items = store.readAll(COL).filter(r => r.status === 'active');
  if (ctx.query.wardCode) items = items.filter(r => r.wardCode === ctx.query.wardCode);
  const now = Date.now();
  return { items: items.map(r => Object.assign({}, r, {
    _orderExpired: new Date(r.orderExpiresAt).getTime() < now,
    _overdue: new Date(r.nextAssessmentDueAt).getTime() < now,
    _f2fOverdue: !!r.faceToFaceDeadline && !r.faceToFace && new Date(r.faceToFaceDeadline).getTime() < now
  })), total: items.length };
}
function listAll(ctx) {
  let items = store.readAll(COL);
  if (ctx.query.status) items = items.filter(r => r.status === ctx.query.status);
  if (ctx.query.wardCode) items = items.filter(r => r.wardCode === ctx.query.wardCode);
  items.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  return { items: items.slice(0, 100), total: items.length };
}
function listOverdue(ctx) {
  const now = Date.now();
  const items = store.readAll(COL).filter(r => r.status === 'active' && (
    new Date(r.nextAssessmentDueAt).getTime() < now ||
    new Date(r.orderExpiresAt).getTime() < now ||
    (r.faceToFaceDeadline && !r.faceToFace && new Date(r.faceToFaceDeadline).getTime() < now)
  ));
  return { items: items.map(r => ({ id: r.id, patientId: r.patientId, patientName: r.patientName, wardCode: r.wardCode,
    reasons: [
      new Date(r.nextAssessmentDueAt).getTime() < now ? 'reassessment_overdue' : null,
      new Date(r.orderExpiresAt).getTime() < now ? 'order_expired' : null,
      r.faceToFaceDeadline && !r.faceToFace && new Date(r.faceToFaceDeadline).getTime() < now ? 'face_to_face_overdue' : null
    ].filter(Boolean) })), total: items.length };
}
function stats(ctx) {
  const all = store.readAll(COL); const now = Date.now();
  const active = all.filter(r => r.status === 'active');
  return {
    active: active.length,
    overdue: active.filter(r => new Date(r.nextAssessmentDueAt).getTime() < now || new Date(r.orderExpiresAt).getTime() < now).length,
    released24h: all.filter(r => r.status === 'released' && new Date(r.releasedAt).getTime() > now - 86400000).length,
    byType: {
      violent_self: active.filter(r => r.type === 'violent_self').length,
      violent_other: active.filter(r => r.type === 'violent_other').length,
      nonviolent_medical: active.filter(r => r.type === 'nonviolent_medical').length
    }, generatedAt: new Date().toISOString()
  };
}
function getById(ctx) {
  const r = store.get(COL, ctx.params.id);
  if (!r) throw ctx.E.notFound('restraint_not_found');
  return r;
}
function escalationCycle() {
  try {
    const now = Date.now();
    for (const r of store.readAll(COL).filter(r => r.status === 'active')) {
      if (new Date(r.nextAssessmentDueAt).getTime() < now && !r._overdueAssessAlerted) {
        r._overdueAssessAlerted = true; store.put(COL, r);
        bus.emit('restraint.overdue', { record: r, reason: 'reassessment_due', title: '⚠️ ارزیابی سررسید — ' + r.patientName });
      }
      if (new Date(r.orderExpiresAt).getTime() < now && !r._overdueOrderAlerted) {
        r._overdueOrderAlerted = true; store.put(COL, r);
        bus.emit('restraint.critical_overdue', { record: r, reason: 'order_expired', title: '🚨 دستور منقضی — ' + r.patientName });
      }
    }
  } catch (e) { console.warn('[restraint] escalation:', e.message); }
}
setTimeout(() => { escalationCycle(); setInterval(escalationCycle, 5 * 60 * 1000); }, 20000);

module.exports = {
  handlers: { listActive, listAll, listOverdue, start, recordFaceToFace, assess, renew, release, stats, getById },
  routes: [
    { method: 'GET',  path: '/api/restraint/active',           handler: 'listActive',       perm: 'restraint.view' },
    { method: 'GET',  path: '/api/restraint/all',              handler: 'listAll',          perm: 'restraint.view' },
    { method: 'GET',  path: '/api/restraint/overdue',          handler: 'listOverdue',      perm: 'restraint.view' },
    { method: 'GET',  path: '/api/restraint/stats',            handler: 'stats',            perm: 'restraint.view' },
    { method: 'POST', path: '/api/restraint/start',            handler: 'start',            perm: 'restraint.order' },
    { method: 'GET',  path: '/api/restraint/:id',              handler: 'getById',          perm: 'restraint.view' },
    { method: 'POST', path: '/api/restraint/:id/face-to-face', handler: 'recordFaceToFace', perm: 'restraint.face_to_face' },
    { method: 'POST', path: '/api/restraint/:id/assess',       handler: 'assess',           perm: 'restraint.assess' },
    { method: 'POST', path: '/api/restraint/:id/renew',        handler: 'renew',            perm: 'restraint.renew' },
    { method: 'POST', path: '/api/restraint/:id/release',      handler: 'release',          perm: 'restraint.release' }
  ],
  panels: [
    { id: 'dashboard', title: 'مدیریت محدودیت (JCI COP.5)', icon: '🔒',
      perm: 'restraint.view', kind: 'restraint_dashboard', api: '/api/restraint/stats' }
  ]
};
console.log('[restraint] JCI COP.5 module loaded');
