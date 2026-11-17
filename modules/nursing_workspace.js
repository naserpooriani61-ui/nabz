'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Nursing Workspace v2 (Patient-Centric)
//  Full clinical workspace: Kardex · MAR · Infusion · Controlled · Assessment · Shift
//  Standards: JCI IPSG.3/COP.5/MMU.5/IPSG.2 · ISMP 2024 · ANA
// ═══════════════════════════════════════════════════════════
const orderWriter = require('../core/domain/order-writer');
const { h, sd } = require('../core/mod-helpers');
const store = require('../core/store');
const bus = require('../core/events');
const perms = require('../core/permissions');

// ═══ Permissions ═══
if (!perms.P['nw.view']) {
  Object.assign(perms.P, {
    'nw.view':   'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,supervisor_er,head_nurse,attending,specialist,resident,intern,physician,nurse,nurse_aide,pharmacist,quality_officer',
    'nw.kardex': 'admin,attending,specialist,physician,resident,head_nurse,nurse',
    'nw.mar':    'admin,attending,specialist,physician,resident,head_nurse,nurse,nurse_aide',
    'nw.infusion':'admin,attending,specialist,physician,resident,head_nurse,nurse',
    'nw.controlled':'admin,attending,specialist,head_nurse,nurse',
    'nw.assess': 'admin,attending,specialist,resident,intern,physician,head_nurse,nurse,nurse_aide',
    'nw.shift':  'admin,head_nurse,nurse,nurse_aide'
  });
}

// ═══ Helpers ═══
function actor(ctx) { return ctx.actor; }
function audit(ctx, action, entityId, meta) {
  try { ctx.audit.write('nursing_workspace', action, entityId, ctx.actor, meta || {}); } catch (_) {}
}

const LATE_REASONS = {
  patient_npo:'NPO', procedure_pending:'منتظر پروسیجر', doctor_hold:'دستور پزشک',
  pharmacy_delay:'تأخیر داروخانه', clinical_decision:'تصمیم بالینی', patient_refused:'رد بیمار',
  patient_off_unit:'بیرون از بخش', iv_access_issue:'مشکل دسترسی وریدی',
  equipment_issue:'مشکل تجهیزات', medication_unavailable:'دارو موجود نیست', other:'سایر'
};

// ═══════════════════════════════════════════════════════════
//  WORKSPACE AGGREGATION (single call for full patient view)
// ═══════════════════════════════════════════════════════════
function workspace(ctx) {
  const pid = ctx.params.patientId;
  const patient = store.get('patients', pid);
  if (!patient) throw ctx.E.notFound('patient_not_found');

  const orders = h(ctx, 'orders').filter(o => o.patientId === pid);
  const mar = h(ctx, 'mar').filter(m => m.patientId === pid);
  const infusions = h(ctx, 'infusions').filter(i => i.patientId === pid && i.status === 'active');
  const assessments = h(ctx, 'nursing_assessments').filter(a => a.patientId === pid).sort((a, b) => sd(b.at) - sd(a.at)).slice(0, 40);
  const wounds = h(ctx, 'wounds').filter(w => w.patientId === pid && w.status !== 'healed');
  const vitals = h(ctx, 'vitals').filter(v => v.patientId === pid).sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
  const io24 = h(ctx, 'io_records').filter(r => r.patientId === pid && sd(r.recordedAt) > Date.now() - 86400000);
  const procedures = h(ctx, 'procedures').filter(p => p.patientId === pid).sort((a, b) => sd(b.createdAt) - sd(a.createdAt)).slice(0, 30);
  const notes = h(ctx, 'nursing_notes').filter(n => n.patientId === pid).sort((a, b) => sd(b.at) - sd(a.at)).slice(0, 30);
  const sepsisArr = h(ctx, 'sepsis').filter(s => s.patientId === pid && ['suspected','confirmed','septic_shock'].includes(s.status));
  const isolation = h(ctx, 'isolations').find(i => i.patientId === pid && i.status === 'active');
  const ncp = h(ctx, 'nursing_care_plans').find(n => n.patientId === pid && n.status === 'active');
  const lastRound = h(ctx, 'encounters').filter(e => e.patientId === pid && e.type === 'round').sort((a, b) => sd(b.createdAt) - sd(a.createdAt))[0];
  const restraint = h(ctx, 'restraint_events').find(r => r.patientId === pid && r.status === 'active');
  const consults = h(ctx, 'consults').filter(c => c.patientId === pid && ['requested','responded'].includes(c.status));

  // Orders: active/pending/held
  const activeOrders = orders.filter(o => ['pending','verified','active','held'].includes(o.status));
  // MAR: due/overdue
  const now = Date.now();
  const marDue = mar.filter(m => ['scheduled','due'].includes(m.status) && sd(m.scheduledAt) < now + 2*3600000);
  const marOverdue = mar.filter(m => ['scheduled','due'].includes(m.status) && sd(m.scheduledAt) < now);
  const marMissed = mar.filter(m => m.status === 'missed' && sd(m.scheduledAt) > now - 24*3600000);
  const prnPending = mar.filter(m => m.status === 'given' && m.prnEffectivenessPending);

  // Vitals analysis
  const lastV = vitals[0];
  const recentV = vitals.slice(0, 3).filter(v => v.news2 != null);
  let newsTrend = null;
  if (recentV.length >= 2) {
    const first = Number(recentV[recentV.length - 1].news2);
    const latest = Number(recentV[0].news2);
    if (latest > first) newsTrend = { dir: 'up', delta: latest - first, from: first, to: latest };
    else if (latest < first) newsTrend = { dir: 'down', delta: first - latest, from: first, to: latest };
  }

  // I/O breakdown
  const io = { in: 0, out: 0, bySubtype: { in: {}, out: {} } };
  for (const r of io24) {
    const v = Number(r.volume) || 0;
    if (r.type === 'intake') { io.in += v; io.bySubtype.in[r.subtype||'other'] = (io.bySubtype.in[r.subtype||'other']||0) + v; }
    else { io.out += v; io.bySubtype.out[r.subtype||'other'] = (io.bySubtype.out[r.subtype||'other']||0) + v; }
  }
  io.net = io.in - io.out;

  // Flags
  const flags = [];
  if (patient.allergies && patient.allergies.length) flags.push({ type:'allergy', severity:'critical', icon:'⚠️', text: patient.allergies.join('، ') });
  if (patient.codeStatus && patient.codeStatus !== 'full') flags.push({ type:'code', severity:'critical', icon:'🚫', text: patient.codeStatus.toUpperCase() });
  if (sepsisArr.length) flags.push({ type:'sepsis', severity:'critical', icon:'🦠', text:'سپسیس ' + sepsisArr[0].status });
  if (isolation) flags.push({ type:'isolation', severity:'high', icon:'🧼', text: isolation.type });
  if (restraint) flags.push({ type:'restraint', severity:'critical', icon:'🔒', text:'محدودیت فعال' });
  if (lastV && lastV.news2 >= 7) flags.push({ type:'news2', severity:'critical', icon:'📈', text:'NEWS2 ' + lastV.news2 });
  if (marOverdue.length) flags.push({ type:'mar', severity:'critical', icon:'⏰', text: marOverdue.length + ' MAR دیرکرد' });

  return {
    patient: {
      id: patient.id, mrn: patient.mrn,
      name: patient.firstName + ' ' + patient.lastName,
      age: patient.age, sex: patient.sex,
      ward: patient.wardCode, bed: patient.bedNumber,
      diagnosis: patient.diagnosis, comorbidities: patient.comorbidities || [],
      allergies: patient.allergies || [], codeStatus: patient.codeStatus,
      admittedAt: patient.admittedAt, attendingName: patient.attendingName || null
    },
    flags,
    vitals: {
      last: lastV || null,
      recent: vitals.slice(0, 20).map(v => ({ at: v.recordedAt, hr: v.hr, sbp: v.bp_sys, dbp: v.bp_dia, rr: v.rr, temp: v.temp, spo2: v.spo2, gcs: v.gcs, pain: v.pain, news2: v.news2, onOxygen: v.onOxygen })),
      trend: newsTrend,
      ageMin: lastV ? Math.round((now - sd(lastV.recordedAt)) / 60000) : null
    },
    orders: {
      active: activeOrders.map(compactOrder),
      pending: activeOrders.filter(o => o.status === 'pending').map(compactOrder),
      held: activeOrders.filter(o => o.status === 'held').map(compactOrder),
      byCategory: {
        medication: activeOrders.filter(o => o.type === 'medication').length,
        lab: activeOrders.filter(o => o.type === 'lab').length,
        paraclinical: activeOrders.filter(o => o.type === 'paraclinical').length,
        consult: activeOrders.filter(o => o.type === 'consult').length,
        nursing: activeOrders.filter(o => o.type === 'nursing').length,
        diet: activeOrders.filter(o => o.type === 'diet').length
      }
    },
    mar: {
      due: marDue.length, overdue: marOverdue.length, missed: marMissed.length, prnPending: prnPending.length,
      active: mar.filter(m => ['scheduled','due'].includes(m.status) && sd(m.scheduledAt) < now + 24*3600000).sort((a,b) => sd(a.scheduledAt) - sd(b.scheduledAt)).slice(0, 30).map(compactMar),
      recent: mar.filter(m => ['given','missed','refused'].includes(m.status)).sort((a,b) => sd(b.administeredAt || b.scheduledAt) - sd(a.administeredAt || a.scheduledAt)).slice(0, 20).map(compactMar),
      prn: mar.filter(m => m.isPRN && m.status === 'given' && sd(m.administeredAt) > now - 24*3600000).slice(0, 10).map(compactMar)
    },
    infusions: infusions.map(compactInfusion),
    assessments: assessments.slice(0, 20).map(compactAssessment),
    wounds: wounds.map(compactWound),
    io: {
      in: io.in, out: io.out, net: io.net, bySubtype: io.bySubtype,
      recent: io24.slice(0, 10).map(r => ({ at: r.recordedAt, type: r.type, subtype: r.subtype, volume: r.volume }))
    },
    procedures: procedures.slice(0, 10),
    notes: notes.slice(0, 15).map(n => ({ id: n.id, at: n.at, by: n.byName || n.by, category: n.category, text: n.text })),
    sepsis: sepsisArr[0] ? { active: true, status: sepsisArr[0].status, qsofa: sepsisArr[0].qsofa ? sepsisArr[0].qsofa.score : 0, bundle3hComplete: !!(sepsisArr[0].bundle3h && sepsisArr[0].bundle3h.completed) } : { active: false },
    isolation: isolation ? { type: isolation.type, reason: isolation.reason } : null,
    ncp: ncp ? { activeDiagnoses: (ncp.diagnoses || []).filter(d => d.status === 'active').length } : null,
    lastRound: lastRound ? { hoursAgo: Math.round((now - sd(lastRound.createdAt))/3600000), author: lastRound.authorName, impression: (lastRound.assessment && lastRound.assessment.clinicalImpression || '').slice(0, 120) } : null,
    consults: consults.map(c => ({ id: c.id, service: c.targetService, status: c.status, type: c.consultType })),
    checkedAt: ctx.now()
  };
}

function compactOrder(o) {
  const d = o.details || {};
  return {
    id: o.id, type: o.type, priority: o.priority, status: o.status,
    drug: d.drug || d.name || null, dose: d.dose || null, route: d.route || null,
    frequency: d.frequency || null, durationDays: d.durationDays || null,
    panel: d.panel || null, modality: d.modality || null, bodyPart: d.bodyPart || null,
    service: d.service || o.targetService || null, note: d.note || null, diet: d.diet || null,
    rate: d.rate || null, rateUnit: d.rateUnit || null,
    orderedAt: o.orderedAt, orderedBy: o.orderedBy,
    verifiedBy: o.verifiedBy || null, verifiedAt: o.verifiedAt || null,
    holdReason: o.holdReason || null, holdUntil: o.holdUntil || null,
    discontinueReason: o.discontinueReason || null,
    sourceOrderSet: o.sourceOrderSet || null,
    isHighAlert: !!d.isHighAlert, isPRN: !!d.prn, isControlled: !!d.controlled,
    isVerbal: !!o.isVerbal
  };
}

function compactMar(m) {
  return {
    id: m.id, patientId: m.patientId, orderId: m.orderId,
    drugName: m.drugName, dose: m.dose, route: m.route,
    scheduledAt: m.scheduledAt, administeredAt: m.administeredAt,
    administeredBy: m.administeredBy, administeredByName: m.administeredByName,
    status: m.status, isHighAlert: !!m.isHighAlert, isPRN: !!m.isPRN,
    witnessedBy: m.witnessedBy, witnessedByName: m.witnessedByName,
    lateMinutes: m.lateMinutes, lateReason: m.lateReason,
    prnEffectiveness: m.prnEffectiveness, prnEffectivenessPending: !!m.prnEffectivenessPending,
    notes: m.notes
  };
}

function compactInfusion(i) {
  return {
    id: i.id, orderId: i.orderId, patientId: i.patientId,
    drug: i.drug, dose: i.dose, rate: i.rate, rateUnit: i.rateUnit,
    totalVolume: i.totalVolume, remaining: i.remaining,
    bagStartedAt: i.bagStartedAt, bagExpiresAt: i.bagExpiresAt,
    tubingChangedAt: i.tubingChangedAt, tubingExpiresAt: i.tubingExpiresAt,
    site: i.site, siteAssessedAt: i.siteAssessedAt, vipScore: i.vipScore,
    pump: i.pump, startedAt: i.startedAt, startedByName: i.startedByName,
    status: i.status, isHighAlert: !!i.isHighAlert, isTitratable: !!i.isTitratable,
    rateMin: i.rateMin, rateMax: i.rateMax,
    titrationHistory: (i.titrationHistory || []).slice(-5),
    siteHistory: (i.siteHistory || []).slice(-3),
    notes: i.notes
  };
}

function compactAssessment(a) {
  return { id: a.id, type: a.type, subtype: a.subtype, data: a.data, summary: a.summary, status: a.status, by: a.by, byName: a.byName, at: a.at };
}
function compactWound(w) {
  return { id: w.id, location: w.location, stage: w.stage, size: w.size, tissue: w.tissue, exudate: w.exudate, dressing: w.dressing, nextChangeAt: w.nextChangeAt, status: w.status, createdAt: w.createdAt };
}

// ═══════════════════════════════════════════════════════════
//  KARDEX — Order Lifecycle
// ═══════════════════════════════════════════════════════════
function orderVerify(ctx) {
  const o = store.get('orders', ctx.params.orderId);
  if (!o) throw ctx.E.notFound('order_not_found');
  if (o.status !== 'pending') throw ctx.E.conflict('not_pending:' + o.status);
  orderWriter.transition(ctx, ctx.params.orderId, 'verify', {
    fields: { verifiedBy: ctx.actor.id, verifiedByName: ctx.actor.fullName || ctx.actor.username, verifiedAt: ctx.now() },
    event: 'kardex.order.verified'
  });
  audit(ctx, 'order.verify', o.id, { patientId: o.patientId });
  return { ok: true, order: compactOrder(o) };
}

function orderHold(ctx) {
  const o = store.get('orders', ctx.params.orderId);
  if (!o) throw ctx.E.notFound('order_not_found');
  if (!['verified','active'].includes(o.status)) throw ctx.E.conflict('cannot_hold:' + o.status);
  const b = ctx.body || {};
  if (!b.reason || b.reason.length < 5) throw ctx.E.badRequest('reason_min_5_chars');
  orderWriter.transition(ctx, ctx.params.orderId, 'hold', {
    fields: {
      holdReason: String(b.reason).slice(0, 500),
      holdUntil: b.durationMinutes ? new Date(Date.now() + Number(b.durationMinutes)*60000).toISOString() : null,
      heldBy: ctx.actor.id, heldByName: ctx.actor.fullName || ctx.actor.username,
      heldAt: ctx.now()
    },
    event: 'kardex.order.held'
  });
  audit(ctx, 'order.hold', o.id, { reason: o.holdReason });
  return { ok: true, order: compactOrder(o) };
}

function orderResume(ctx) {
  const o = store.get('orders', ctx.params.orderId);
  if (!o) throw ctx.E.notFound('order_not_found');
  if (o.status !== 'held') throw ctx.E.conflict('not_held');
  orderWriter.transition(ctx, ctx.params.orderId, 'resume', {
    fields: {
      resumedBy: ctx.actor.id, resumedByName: ctx.actor.fullName || ctx.actor.username,
      resumedAt: ctx.now(), resumeReason: (ctx.body && ctx.body.reason) || ''
    },
    event: 'kardex.order.resumed'
  });
  audit(ctx, 'order.resume', o.id, {});
  return { ok: true, order: compactOrder(o) };
}

function orderDiscontinue(ctx) {
  const o = store.get('orders', ctx.params.orderId);
  if (!o) throw ctx.E.notFound('order_not_found');
  if (!['pending','verified','active','held'].includes(o.status)) throw ctx.E.conflict('cannot_discontinue:' + o.status);
  const b = ctx.body || {};
  if (!b.reason || b.reason.length < 5) throw ctx.E.badRequest('reason_min_5_chars');
  let cancelledMars = 0;
  orderWriter.transition(ctx, ctx.params.orderId, 'discontinue', {
    fields: {
      discontinuedBy: ctx.actor.id, discontinuedByName: ctx.actor.fullName || ctx.actor.username,
      discontinuedAt: ctx.now(), discontinueReason: String(b.reason).slice(0, 500)
    },
    event: 'kardex.order.discontinued',
    after: (order, c) => {
      const marW = require('../core/domain/mar-writer');
      const mar = h(c, 'mar').filter(m => m.orderId === order.id && ['scheduled','due'].includes(m.status));
      for (const m of mar) marW.systemCancel(c, m.id, 'order_discontinued');
      cancelledMars = mar.length;
    }
  });
  audit(ctx, 'order.discontinue', o.id, { reason: o.discontinueReason });
  return { ok: true, order: compactOrder(o), cancelledMars };
}

function orderModify(ctx) {
  const o = store.get('orders', ctx.params.orderId);
  if (!o) throw ctx.E.notFound('order_not_found');
  if (!['pending','verified','active','held'].includes(o.status)) throw ctx.E.conflict('cannot_modify');
  const b = ctx.body || {};
  if (!b.reason || b.reason.length < 5) throw ctx.E.badRequest('reason_min_5_chars');
  const oldDetails = JSON.parse(JSON.stringify(o.details || {}));
  if (b.details && typeof b.details === 'object') {
    o.details = Object.assign({}, o.details || {}, b.details);
  }
  o.modifiedBy = ctx.actor.id; o.modifiedByName = ctx.actor.fullName || ctx.actor.username;
  o.modifiedAt = ctx.now();
  o.modifyReason = String(b.reason).slice(0, 500);
  o.modifyHistory = o.modifyHistory || [];
  o.modifyHistory.push({ at: ctx.now(), by: ctx.actor.id, oldDetails, newDetails: JSON.parse(JSON.stringify(o.details)), reason: o.modifyReason });
  orderWriter.save(ctx, o, { event: 'kardex.order.modified' });
  audit(ctx, 'order.modify', o.id, { reason: o.modifyReason });
  return { ok: true, order: compactOrder(o) };
}

function orderVerbal(ctx) {
  const b = ctx.body || {};
  if (!b.patientId) throw ctx.E.badRequest('patient_id_required');
  if (!b.type) throw ctx.E.badRequest('type_required');
  if (!b.details || typeof b.details !== 'object') throw ctx.E.badRequest('details_required');
  if (!b.verbalFrom || b.verbalFrom.length < 2) throw ctx.E.badRequest('verbal_from_required');
  if (!b.readBack || b.readBack.length < 10) throw ctx.E.badRequest('read_back_min_10_chars');
  const p = store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const rec = {
    id: ctx.uid('ord'),
    patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode, type: b.type,
    priority: b.priority || 'routine',
    details: b.details,
    status: 'pending', // still needs attending confirmation
    isVerbal: true,
    verbalFrom: String(b.verbalFrom).slice(0, 100),
    readBack: String(b.readBack).slice(0, 500),
    readBackBy: ctx.actor.id, readBackByName: ctx.actor.fullName || ctx.actor.username,
    orderedBy: ctx.actor.id, orderedAt: ctx.now(),
    requiresConfirmation: true,
    confirmedBy: null, confirmedAt: null
  };
  rec.type = rec.type || b.type;
  rec.patientId = rec.patientId || b.patientId;
  orderWriter.create(ctx, rec, { event: 'kardex.order.verbal' });
  audit(ctx, 'order.verbal', rec.id, { verbalFrom: rec.verbalFrom });
  return { ok: true, order: compactOrder(rec) };
}

// ═══════════════════════════════════════════════════════════
//  MAR — Extended (titrate, partial, waste, hold, refuse)
// ═══════════════════════════════════════════════════════════
function marTitrate(ctx) {
  const m = store.get('mar', ctx.params.marId);
  if (!m) throw ctx.E.notFound('mar_not_found');
  const o = store.get('orders', m.orderId);
  if (!o) throw ctx.E.notFound('order_not_found');
  const b = ctx.body || {};
  if (!b.newRate || isNaN(Number(b.newRate))) throw ctx.E.badRequest('new_rate_required');
  const newRate = Number(b.newRate);
  // Validate rate against order min/max
  const minR = Number(o.details.rateMin) || 0;
  const maxR = Number(o.details.rateMax) || 999999;
  if (newRate < minR || newRate > maxR) {
    throw ctx.E.badRequest('rate_out_of_bounds:' + minR + '-' + maxR);
  }
  if (!b.reason || b.reason.length < 5) throw ctx.E.badRequest('reason_min_5_chars');
  const rec = {
    id: ctx.uid('tit'),
    marId: m.id, orderId: o.id, patientId: m.patientId, patientName: m.patientName,
    drugName: m.drugName, oldRate: o.details.rate, newRate,
    rateUnit: o.details.rateUnit || '/h',
    reason: String(b.reason).slice(0, 500),
    by: ctx.actor.id, byName: ctx.actor.fullName || ctx.actor.username,
    at: ctx.now()
  };
  store.put('mar_titrations', rec);
  o.details.rate = newRate;
  o.lastTitratedAt = ctx.now();
  o.lastTitratedBy = ctx.actor.id;
  o.titrationCount = (o.titrationCount || 0) + 1;
  orderWriter.save(ctx, o);
  audit(ctx, 'mar.titrate', m.id, { oldRate: rec.oldRate, newRate });
  bus.emit('mar.titrated', { record: rec, actor: ctx.actor });
  return { ok: true, titration: rec, currentRate: newRate };
}

function marPartial(ctx) {
  const b = ctx.body || {};
  const m = require('../core/domain/mar-writer').partial(ctx, ctx.params.marId, {
    givenDose: b.givenDose,
    reason: b.reason,
    fiveRights: b.fiveRights
  });
  audit(ctx, 'mar.partial', m.id, { prescribed: m.prescribedDose, given: m.givenDose });
  return { ok: true, mar: compactMar(m) };
}

function marWaste(ctx) {
  const m = store.get('mar', ctx.params.marId);
  if (!m) throw ctx.E.notFound('mar_not_found');
  const o = store.get('orders', m.orderId);
  if (!o) throw ctx.E.notFound('order_not_found');
  if (!o.details.controlled) throw ctx.E.badRequest('not_controlled_substance');
  const b = ctx.body || {};
  if (b.wasteAmount == null) throw ctx.E.badRequest('waste_amount_required');
  if (!b.witnessId) throw ctx.E.badRequest('witness_required');
  if (b.witnessId === ctx.actor.id) throw ctx.E.badRequest('witness_must_differ');
  const witness = h(ctx, 'users').find(u => u.id === b.witnessId || u.username === b.witnessId);
  if (!witness) throw ctx.E.notFound('witness_not_found');
  const waste = {
    id: ctx.uid('wst'),
    marId: m.id, orderId: o.id, patientId: m.patientId, patientName: m.patientName,
    drugName: m.drugName, amount: Number(b.wasteAmount),
    unit: o.details.unit || 'mg',
    reason: String(b.reason || '').slice(0, 500),
    by: ctx.actor.id, byName: ctx.actor.fullName || ctx.actor.username,
    witnessedBy: witness.id, witnessedByName: witness.fullName || witness.username,
    at: ctx.now()
  };
  store.put('mar_waste', waste);
  // Update controlled inventory (decrement)
  try {
    const inv = h(ctx, 'controlled_substances').find(i => i.wardCode === m.wardCode && i.drugName === m.drugName);
    if (inv) {
      inv.currentCount = Math.max(0, (inv.currentCount || 0) - waste.amount);
      inv.lastUpdatedAt = ctx.now();
      store.put('controlled_substances', inv);
      store.put('controlled_transactions', {
        id: ctx.uid('ctx'), type: 'waste', drugName: m.drugName, amount: waste.amount,
        wardCode: m.wardCode, patientId: m.patientId, marId: m.id,
        by: ctx.actor.id, byName: waste.byName,
        witness: witness.id, witnessName: waste.witnessedByName,
        at: ctx.now(), countAfter: inv.currentCount, reference: waste.id
      });
    }
  } catch (_) {}
  audit(ctx, 'mar.waste', m.id, { amount: waste.amount, witness: waste.witnessedByName });
  bus.emit('mar.waste', { record: waste, actor: ctx.actor });
  return { ok: true, waste };
}

// ═══════════════════════════════════════════════════════════
//  INFUSION
// ═══════════════════════════════════════════════════════════
function infusionStart(ctx) {
  const b = ctx.body || {};
  if (!b.orderId) throw ctx.E.badRequest('order_id_required');
  const o = store.get('orders', b.orderId);
  if (!o) throw ctx.E.notFound('order_not_found');
  if (o.type !== 'medication') throw ctx.E.badRequest('not_medication');
  const p = store.get('patients', o.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const d = o.details || {};
  if (!d.rate) throw ctx.E.badRequest('order_missing_rate');
  const now = Date.now();
  const rec = {
    id: ctx.uid('inf'),
    orderId: o.id, patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode,
    drug: d.drug || d.name, dose: d.dose, rate: Number(d.rate), rateUnit: d.rateUnit || 'ml/h',
    rateMin: d.rateMin ? Number(d.rateMin) : null, rateMax: d.rateMax ? Number(d.rateMax) : null,
    totalVolume: d.totalVolume ? Number(d.totalVolume) : null,
    remaining: d.totalVolume ? Number(d.totalVolume) : null,
    bagStartedAt: new Date(now).toISOString(),
    bagExpiresAt: d.bagDurationHours ? new Date(now + Number(d.bagDurationHours)*3600000).toISOString() : new Date(now + 24*3600000).toISOString(),
    tubingChangedAt: new Date(now).toISOString(),
    tubingExpiresAt: new Date(now + 72*3600000).toISOString(),
    site: b.site || 'unknown',
    pump: b.pump || null,
    isHighAlert: !!d.isHighAlert,
    isTitratable: !!(d.rateMin && d.rateMax),
    status: 'active',
    startedAt: new Date(now).toISOString(),
    startedBy: ctx.actor.id, startedByName: ctx.actor.fullName || ctx.actor.username,
    siteAssessedAt: null, vipScore: 0,
    siteHistory: [], titrationHistory: [], notes: ''
  };
  store.put('infusions', rec);
  audit(ctx, 'infusion.start', rec.id, { drug: rec.drug, rate: rec.rate });
  bus.emit('infusion.started', { record: rec, actor: ctx.actor });
  return { ok: true, infusion: compactInfusion(rec) };
}

function infusionRateChange(ctx) {
  const i = store.get('infusions', ctx.params.id);
  if (!i) throw ctx.E.notFound('infusion_not_found');
  if (i.status !== 'active') throw ctx.E.conflict('not_active');
  const b = ctx.body || {};
  if (b.rate == null || isNaN(Number(b.rate))) throw ctx.E.badRequest('rate_required');
  const newRate = Number(b.rate);
  if (i.rateMin != null && newRate < i.rateMin) throw ctx.E.badRequest('rate_below_min:' + i.rateMin);
  if (i.rateMax != null && newRate > i.rateMax) throw ctx.E.badRequest('rate_above_max:' + i.rateMax);
  if (!b.reason || b.reason.length < 5) throw ctx.E.badRequest('reason_min_5_chars');
  const oldRate = i.rate;
  i.rate = newRate;
  i.titrationHistory = i.titrationHistory || [];
  i.titrationHistory.push({ oldRate, newRate, reason: String(b.reason).slice(0, 500), by: ctx.actor.id, byName: ctx.actor.fullName || ctx.actor.username, at: ctx.now() });
  store.put('infusions', i);
  audit(ctx, 'infusion.rate', i.id, { oldRate, newRate });
  bus.emit('infusion.rate_changed', { record: i, actor: ctx.actor });
  return { ok: true, infusion: compactInfusion(i) };
}

function infusionSiteAssess(ctx) {
  const i = store.get('infusions', ctx.params.id);
  if (!i) throw ctx.E.notFound('infusion_not_found');
  const b = ctx.body || {};
  if (b.vipScore == null || b.vipScore < 0 || b.vipScore > 5) throw ctx.E.badRequest('vip_score_0_5');
  const vip = Number(b.vipScore);
  let action;
  if (vip <= 1) action = 'continue';
  else if (vip === 2) action = 'resite_soon';
  else action = 'remove_now';
  i.vipScore = vip;
  i.siteAssessedAt = new Date().toISOString();
  i.siteHistory = i.siteHistory || [];
  i.siteHistory.push({ vip, action, findings: String(b.findings || '').slice(0, 500), by: ctx.actor.id, byName: ctx.actor.fullName || ctx.actor.username, at: ctx.now() });
  if (vip >= 3) i.status = 'removed_phlebitis';
  store.put('infusions', i);
  audit(ctx, 'infusion.site_assess', i.id, { vip, action });
  bus.emit('infusion.site_assessed', { record: i, vip, action, actor: ctx.actor });
  return { ok: true, infusion: compactInfusion(i), action };
}

function infusionBagChange(ctx) {
  const i = store.get('infusions', ctx.params.id);
  if (!i) throw ctx.E.notFound('infusion_not_found');
  if (i.status !== 'active') throw ctx.E.conflict('not_active');
  const now = Date.now();
  i.bagStartedAt = new Date(now).toISOString();
  i.bagExpiresAt = new Date(now + 24*3600000).toISOString();
  i.remaining = i.totalVolume || i.remaining;
  store.put('infusions', i);
  audit(ctx, 'infusion.bag_change', i.id, {});
  bus.emit('infusion.bag_changed', { record: i, actor: ctx.actor });
  return { ok: true, infusion: compactInfusion(i) };
}

function infusionTubingChange(ctx) {
  const i = store.get('infusions', ctx.params.id);
  if (!i) throw ctx.E.notFound('infusion_not_found');
  const now = Date.now();
  i.tubingChangedAt = new Date(now).toISOString();
  i.tubingExpiresAt = new Date(now + 72*3600000).toISOString();
  store.put('infusions', i);
  audit(ctx, 'infusion.tubing_change', i.id, {});
  return { ok: true, infusion: compactInfusion(i) };
}

function infusionStop(ctx) {
  const i = store.get('infusions', ctx.params.id);
  if (!i) throw ctx.E.notFound('infusion_not_found');
  if (i.status !== 'active') throw ctx.E.conflict('not_active');
  const b = ctx.body || {};
  if (!b.reason || b.reason.length < 3) throw ctx.E.badRequest('reason_required');
  i.status = 'stopped';
  i.stoppedAt = new Date().toISOString();
  i.stoppedBy = ctx.actor.id; i.stoppedByName = ctx.actor.fullName || ctx.actor.username;
  i.stopReason = String(b.reason).slice(0, 500);
  store.put('infusions', i);
  audit(ctx, 'infusion.stop', i.id, { reason: i.stopReason });
  bus.emit('infusion.stopped', { record: i, actor: ctx.actor });
  return { ok: true, infusion: compactInfusion(i) };
}

// ═══════════════════════════════════════════════════════════
//  CONTROLLED SUBSTANCES
// ═══════════════════════════════════════════════════════════
function controlledInventory(ctx) {
  const ward = ctx.query.ward || ctx.actor.ward;
  if (!ward) throw ctx.E.badRequest('ward_required');
  let items = h(ctx, 'controlled_substances').filter(i => i.wardCode === ward);
  return {
    ward,
    items: items.map(i => ({
      id: i.id, drugName: i.drugName, unit: i.unit, currentCount: i.currentCount,
      lastCountAt: i.lastCountAt, lastCountBy: i.lastCountByName,
      lastUpdatedAt: i.lastUpdatedAt,
      isLow: i.currentCount <= (i.reorderThreshold || 5)
    })),
    total: items.length,
    checkedAt: ctx.now()
  };
}

function controlledInit(ctx) {
  const b = ctx.body || {};
  if (!b.wardCode || !b.drugName) throw ctx.E.badRequest('ward_drug_required');
  const existing = h(ctx, 'controlled_substances').find(i => i.wardCode === b.wardCode && i.drugName === b.drugName);
  if (existing) throw ctx.E.conflict('already_exists');
  const rec = {
    id: ctx.uid('cs'), wardCode: b.wardCode, drugName: b.drugName,
    unit: b.unit || 'mg', currentCount: 0, reorderThreshold: Number(b.reorderThreshold) || 5,
    createdAt: ctx.now(), createdBy: ctx.actor.id
  };
  store.put('controlled_substances', rec);
  return { ok: true, inventory: rec };
}

function controlledShiftCount(ctx) {
  const b = ctx.body || {};
  if (!b.wardCode) throw ctx.E.badRequest('ward_required');
  if (!Array.isArray(b.counts)) throw ctx.E.badRequest('counts_array_required');
  if (!b.witnessId) throw ctx.E.badRequest('witness_required');
  if (b.witnessId === ctx.actor.id) throw ctx.E.badRequest('witness_must_differ');
  const witness = h(ctx, 'users').find(u => u.id === b.witnessId || u.username === b.witnessId);
  if (!witness) throw ctx.E.notFound('witness_not_found');
  const discrepancies = [];
  for (const c of b.counts) {
    const inv = h(ctx, 'controlled_substances').find(i => i.wardCode === b.wardCode && i.drugName === c.drugName);
    if (!inv) continue;
    const expected = inv.currentCount;
    const actual = Number(c.actualCount);
    if (Math.abs(expected - actual) > 0.001) {
      discrepancies.push({ drugName: c.drugName, expected, actual, diff: actual - expected });
    }
    inv.currentCount = actual;
    inv.lastCountAt = ctx.now();
    inv.lastCountBy = ctx.actor.id; inv.lastCountByName = ctx.actor.fullName || ctx.actor.username;
    inv.lastWitnessedBy = witness.id; inv.lastWitnessedByName = witness.fullName || witness.username;
    store.put('controlled_substances', inv);
    store.put('controlled_transactions', {
      id: ctx.uid('ctx'), type: 'shift_count', drugName: c.drugName, amount: actual,
      wardCode: b.wardCode, by: ctx.actor.id, byName: ctx.actor.fullName || ctx.actor.username,
      witness: witness.id, witnessName: witness.fullName || witness.username,
      at: ctx.now(), countAfter: actual, previousCount: expected,
      discrepancy: actual !== expected
    });
  }
  const rec = {
    id: ctx.uid('cnt'), wardCode: b.wardCode,
    counts: b.counts, discrepancies,
    by: ctx.actor.id, byName: ctx.actor.fullName || ctx.actor.username,
    witnessedBy: witness.id, witnessedByName: witness.fullName || witness.username,
    at: ctx.now(), shift: b.shift || 'current'
  };
  store.put('narcotic_counts', rec);
  audit(ctx, 'controlled.shift_count', rec.id, { discrepancies: discrepancies.length });
  bus.emit('controlled.shift_count', { record: rec, actor: ctx.actor });
  if (discrepancies.length > 0) {
    bus.emit('cdss.alert', {
      type: 'narcotic_discrepancy', severity: 'critical',
      title: '🚨 مغایرت مخدر در ' + b.wardCode,
      message: discrepancies.map(d => d.drugName + ' (اختلاف ' + d.diff + ')').join('، '),
      recommendation: 'گزارش فوری به سوپروایزر و داروخانه'
    });
  }
  return { ok: true, count: rec, discrepancies };
}

function controlledDispense(ctx) {
  const b = ctx.body || {};
  if (!b.wardCode || !b.drugName) throw ctx.E.badRequest('ward_drug_required');
  if (!b.amount || isNaN(Number(b.amount))) throw ctx.E.badRequest('amount_required');
  const inv = h(ctx, 'controlled_substances').find(i => i.wardCode === b.wardCode && i.drugName === b.drugName);
  if (!inv) throw ctx.E.notFound('inventory_not_found');
  const amt = Number(b.amount);
  inv.currentCount = (inv.currentCount || 0) + amt;
  inv.lastUpdatedAt = ctx.now();
  store.put('controlled_substances', inv);
  const rec = {
    id: ctx.uid('ctx'), type: 'dispense', drugName: b.drugName, amount: amt,
    wardCode: b.wardCode,
    by: ctx.actor.id, byName: ctx.actor.fullName || ctx.actor.username,
    witness: b.witnessId || null, witnessName: null,
    at: ctx.now(), countAfter: inv.currentCount,
    notes: String(b.notes || '').slice(0, 500)
  };
  store.put('controlled_transactions', rec);
  return { ok: true, transaction: rec, inventory: inv };
}

// ═══════════════════════════════════════════════════════════
//  ASSESSMENTS — All forms
// ═══════════════════════════════════════════════════════════
const ASSESSMENT_TYPES = {
  head_to_toe: {
    fa: 'ارزیابی سر تا پا',
    fields: ['general','heent','neck','resp','cv','abd','gu','msk','skin','neuro','psych']
  },
  focused_resp: { fa: 'تنفسی', fields: ['rate','effort','breathSounds','sputum','spo2','o2Delivery'] },
  focused_cv: { fa: 'قلبی-عروقی', fields: ['hr','rhythm','heartSounds','peripheralPulses','edema','capillaryRefill'] },
  focused_gi: { fa: 'گوارشی', fields: ['abdShape','bowelSounds','tenderness','lastBM','nausea','vomiting'] },
  focused_neuro: { fa: 'نورولوژیک', fields: ['loc','gcs','pupils','motor','sensory','speech'] },
  focused_skin: { fa: 'پوستی', fields: ['color','integrity','turgor','temp','lesions','wounds'] },
  wound: { fa: 'زخم', fields: ['location','stage','length','width','depth','tissueType','exudate','periwound','dressing','nextChangeAt'] },
  iv_site: { fa: 'محل ورید', fields: ['location','vipScore','findings'] },
  rass: { fa: 'آرام‌بخشی (RASS)', fields: ['score','description'] },
  cam_icu: { fa: 'دلیریوم (CAM-ICU)', fields: ['acuteOnset','inattention','alteredLoc','disorganized','result'] },
  must: { fa: 'تغذیه (MUST)', fields: ['bmi','weightLoss','acuteDisease','totalScore','risk'] },
  pain: { fa: 'درد', fields: ['scale','value','location','character','aggravating','relief','intervention'] }
};

function assessmentList(ctx) {
  return {
    types: Object.entries(ASSESSMENT_TYPES).map(([k, v]) => ({ code: k, fa: v.fa, fields: v.fields })),
    total: Object.keys(ASSESSMENT_TYPES).length
  };
}

function assessmentCreate(ctx) {
  const b = ctx.body || {};
  if (!b.patientId) throw ctx.E.badRequest('patient_id_required');
  if (!b.type || !ASSESSMENT_TYPES[b.type]) throw ctx.E.badRequest('invalid_type');
  const p = store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const def = ASSESSMENT_TYPES[b.type];
  const data = b.data || {};
  // Compose summary
  let summary = '';
  if (b.type === 'rass') summary = 'RASS ' + (data.score || 0) + ' — ' + (data.description || '');
  else if (b.type === 'cam_icu') summary = 'CAM-ICU: ' + (data.result === 'positive' ? 'مثبت' : data.result === 'negative' ? 'منفی' : 'غیرقابل ارزیابی');
  else if (b.type === 'must') summary = 'MUST: ' + (data.totalScore || 0) + ' — ' + (data.risk || '');
  else if (b.type === 'pain') summary = 'درد ' + (data.value || 0) + '/10';
  else if (b.type === 'iv_site') summary = 'VIP ' + (data.vipScore || 0) + '/5';
  else if (b.type === 'wound') summary = 'زخم ' + (data.location || '') + ' مرحله ' + (data.stage || '');
  else summary = (def.fa || b.type) + ' انجام شد';

  const rec = {
    id: ctx.uid('ass'),
    patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode, type: b.type, subtype: b.subtype || null,
    data,
    summary: String(summary).slice(0, 300),
    status: b.status || 'stable',
    by: ctx.actor.id, byName: ctx.actor.fullName || ctx.actor.username,
    at: ctx.now(),
    notes: String(b.notes || '').slice(0, 1000)
  };
  store.put('nursing_assessments', rec);
  audit(ctx, 'assessment.create', rec.id, { type: b.type });
  bus.emit('assessment.created', { record: rec, actor: ctx.actor });
  // If wound, also create/update wounds collection
  if (b.type === 'wound') {
    try {
      const wid = ctx.uid('wnd');
      const wound = {
        id: wid, patientId: p.id, patientName: rec.patientName, wardCode: p.wardCode,
        location: data.location, stage: data.stage, size: data.length + '×' + data.width + '×' + data.depth,
        tissue: data.tissueType, exudate: data.exudate, dressing: data.dressing,
        nextChangeAt: data.nextChangeAt, status: 'active',
        createdAt: ctx.now(), createdBy: ctx.actor.id
      };
      store.put('wounds', wound);
    } catch (_) {}
  }
  return { ok: true, assessment: compactAssessment(rec) };
}

// ═══════════════════════════════════════════════════════════
//  IO — Detailed with subtypes
// ═══════════════════════════════════════════════════════════
function ioRecord(ctx) {
  const b = ctx.body || {};
  if (!b.patientId) throw ctx.E.badRequest('patient_id_required');
  if (!b.type || !['intake','output'].includes(b.type)) throw ctx.E.badRequest('invalid_type');
  if (b.volume == null || isNaN(Number(b.volume))) throw ctx.E.badRequest('volume_required');
  const p = store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const validSubtypes = {
    intake: ['oral','iv','ngt','tpn','medication','blood','irrigation','other'],
    output: ['urine','stool','vomit','drain','wound','blood','ng','other']
  };
  const subtype = validSubtypes[b.type].includes(b.subtype) ? b.subtype : 'other';
  const rec = {
    id: ctx.uid('io'),
    patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode, type: b.type, subtype,
    volume: Number(b.volume),
    source: b.source || null,
    characteristics: String(b.characteristics || '').slice(0, 200),
    recordedAt: b.recordedAt || ctx.now(),
    recordedBy: ctx.actor.id, recordedByName: ctx.actor.fullName || ctx.actor.username,
    notes: String(b.notes || '').slice(0, 300)
  };
  store.put('io_records', rec);
  audit(ctx, 'io.record', rec.id, { type: b.type, subtype, volume: rec.volume });
  bus.emit('kardex.io.recorded', { record: rec, actor: ctx.actor });
  return { ok: true, record: rec };
}

// ═══════════════════════════════════════════════════════════
//  SHIFT TOOLS — Crash cart, bedside handoff
// ═══════════════════════════════════════════════════════════
const CART_ITEMS = [
  'defibrillator', 'suction', 'ambu_bag', 'o2_mask_nonrebreather',
  'airway_kit', 'iv_fluids_2L', 'epinephrine_1mg', 'amiodarone_150mg',
  'atropine_1mg', 'lidocaine_100mg', 'sodium_bicarb', 'naloxone_2mg',
  'dextrose_50', 'dopamine', 'vasopressin', 'laryngoscope_blades_3',
  'ett_7_0','ett_7_5','ett_8_0','needles_iv_18_20','iodine','gloves_sterile'
];

function crashCartGet(ctx) {
  const ward = ctx.query.ward || ctx.actor.ward;
  if (!ward) throw ctx.E.badRequest('ward_required');
  const existing = h(ctx, 'shift_tools').find(t => t.wardCode === ward && t.tool === 'crash_cart');
  return {
    ward,
    items: CART_ITEMS,
    check: existing || { id: null, items: {}, checkedAt: null, checkedByName: null },
    checked: !!existing
  };
}

function crashCartCheck(ctx) {
  const b = ctx.body || {};
  const ward = b.ward || ctx.actor.ward;
  if (!ward) throw ctx.E.badRequest('ward_required');
  if (!b.items || typeof b.items !== 'object') throw ctx.E.badRequest('items_required');
  const existing = h(ctx, 'shift_tools').find(t => t.wardCode === ward && t.tool === 'crash_cart');
  const rec = existing || { id: ctx.uid('st'), wardCode: ward, tool: 'crash_cart' };
  rec.items = b.items;
  rec.checkedBy = ctx.actor.id; rec.checkedByName = ctx.actor.fullName || ctx.actor.username;
  rec.checkedAt = ctx.now();
  rec.expiresAt = new Date(Date.now() + 24*3600000).toISOString();
  const missing = CART_ITEMS.filter(k => !b.items[k]);
  rec.missing = missing;
  store.put('shift_tools', rec);
  audit(ctx, 'shift.crash_cart', rec.id, { missing: missing.length });
  bus.emit('shift.cart_checked', { record: rec, actor: ctx.actor });
  return { ok: true, check: rec, missing, warning: missing.length > 0 ? 'Cart incomplete: ' + missing.join(', ') : null };
}

function bedsideHandoffStart(ctx) {
  const b = ctx.body || {};
  if (!b.toUserId) throw ctx.E.badRequest('to_user_required');
  const target = store.get('users', b.toUserId);
  if (!target) throw ctx.E.notFound('to_user_not_found');
  const rec = {
    id: ctx.uid('bsh'),
    fromUserId: ctx.actor.id, fromUserName: ctx.actor.fullName || ctx.actor.username,
    toUserId: target.id, toUserName: target.fullName || target.username,
    wardCode: b.wardCode || ctx.actor.ward,
    patients: Array.isArray(b.patientIds) ? b.patientIds : [],
    startedAt: ctx.now(),
    status: 'in_progress',
    confirmations: [],
    notes: String(b.notes || '').slice(0, 1000)
  };
  store.put('bedside_handoffs', rec);
  bus.emit('bedside_handoff.started', { record: rec, actor: ctx.actor });
  return { ok: true, handoff: rec };
}

function bedsideHandoffConfirm(ctx) {
  const r = store.get('bedside_handoffs', ctx.params.id);
  if (!r) throw ctx.E.notFound('handoff_not_found');
  if (r.toUserId !== ctx.actor.id) throw ctx.E.forbidden('not_receiver');
  const b = ctx.body || {};
  if (!b.patientId) throw ctx.E.badRequest('patient_id_required');
  r.confirmations.push({
    patientId: b.patientId,
    at: ctx.now(),
    by: ctx.actor.id, byName: ctx.actor.fullName || ctx.actor.username,
    iSee: b.iSee === true, iAgree: b.iAgree === true,
    concerns: String(b.concerns || '').slice(0, 500)
  });
  store.put('bedside_handoffs', r);
  bus.emit('bedside_handoff.confirmed', { record: r, patientId: b.patientId, actor: ctx.actor });
  return { ok: true, handoff: r };
}

module.exports = {
  handlers: {
    workspace,
    orderVerify, orderHold, orderResume, orderDiscontinue, orderModify, orderVerbal,
    marTitrate, marPartial, marWaste,
    infusionStart, infusionRateChange, infusionSiteAssess, infusionBagChange, infusionTubingChange, infusionStop,
    controlledInventory, controlledInit, controlledShiftCount, controlledDispense,
    assessmentList, assessmentCreate,
    ioRecord,
    crashCartGet, crashCartCheck,
    bedsideHandoffStart, bedsideHandoffConfirm
  },
  routes: [
    { method:'GET',  path:'/api/nw/workspace/:patientId', handler:'workspace', perm:'nw.view' },
    // Kardex
    { method:'POST', path:'/api/nw/order/:orderId/verify', handler:'orderVerify', perm:'nw.kardex' },
    { method:'POST', path:'/api/nw/order/:orderId/hold', handler:'orderHold', perm:'nw.kardex' },
    { method:'POST', path:'/api/nw/order/:orderId/resume', handler:'orderResume', perm:'nw.kardex' },
    { method:'POST', path:'/api/nw/order/:orderId/discontinue', handler:'orderDiscontinue', perm:'nw.kardex' },
    { method:'POST', path:'/api/nw/order/:orderId/modify', handler:'orderModify', perm:'nw.kardex' },
    { method:'POST', path:'/api/nw/order/verbal', handler:'orderVerbal', perm:'nw.kardex' },
    // MAR extended
    { method:'POST', path:'/api/nw/mar/:marId/titrate', handler:'marTitrate', perm:'nw.mar' },
    { method:'POST', path:'/api/nw/mar/:marId/partial', handler:'marPartial', perm:'nw.mar' },
    { method:'POST', path:'/api/nw/mar/:marId/waste', handler:'marWaste', perm:'nw.controlled' },
    // Infusion
    { method:'POST', path:'/api/nw/infusion/start', handler:'infusionStart', perm:'nw.infusion' },
    { method:'POST', path:'/api/nw/infusion/:id/rate', handler:'infusionRateChange', perm:'nw.infusion' },
    { method:'POST', path:'/api/nw/infusion/:id/site', handler:'infusionSiteAssess', perm:'nw.infusion' },
    { method:'POST', path:'/api/nw/infusion/:id/bag', handler:'infusionBagChange', perm:'nw.infusion' },
    { method:'POST', path:'/api/nw/infusion/:id/tubing', handler:'infusionTubingChange', perm:'nw.infusion' },
    { method:'POST', path:'/api/nw/infusion/:id/stop', handler:'infusionStop', perm:'nw.infusion' },
    // Controlled
    { method:'GET',  path:'/api/nw/controlled/inventory', handler:'controlledInventory', perm:'nw.controlled' },
    { method:'POST', path:'/api/nw/controlled/init', handler:'controlledInit', perm:'nw.controlled' },
    { method:'POST', path:'/api/nw/controlled/count', handler:'controlledShiftCount', perm:'nw.controlled' },
    { method:'POST', path:'/api/nw/controlled/dispense', handler:'controlledDispense', perm:'nw.controlled' },
    // Assessments
    { method:'GET',  path:'/api/nw/assessment/types', handler:'assessmentList', perm:'nw.view' },
    { method:'POST', path:'/api/nw/assessment/create', handler:'assessmentCreate', perm:'nw.assess' },
    // IO
    { method:'POST', path:'/api/nw/io', handler:'ioRecord', perm:'nw.mar' },
    // Shift tools
    { method:'GET',  path:'/api/nw/shift/crash-cart', handler:'crashCartGet', perm:'nw.shift' },
    { method:'POST', path:'/api/nw/shift/crash-cart', handler:'crashCartCheck', perm:'nw.shift' },
    { method:'POST', path:'/api/nw/shift/bedside-handoff', handler:'bedsideHandoffStart', perm:'nw.shift' },
    { method:'POST', path:'/api/nw/shift/bedside-handoff/:id/confirm', handler:'bedsideHandoffConfirm', perm:'nw.shift' }
  ],
  panels: []
};
console.log('[nursing-workspace] loaded — kardex + mar + infusion + controlled + assess + shift');
