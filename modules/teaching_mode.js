'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Teaching Mode (S4, مافوق تخصصی)
//  ACGME-aligned for Sina Teaching Hospital
//  - 13 Core EPAs (AAMC)
//  - 6 ACGME Core Competencies (Milestones)
//  - 5 Supervision Levels
//  - 80h/week duty hour rules with violation detection
//  - Supervised orders (resident → attending approval)
//  - Structured feedback (W3)
//  - Case log (ACGME minimum counts)
// ═══════════════════════════════════════════════════════════
const orderWriter = require('../core/domain/order-writer');
const { h, sd } = require('../core/mod-helpers');
const bus = require('../core/events');
const store = require('../core/store');
const perms = require('../core/permissions');

if (!perms.P['teach.view']) {
  perms.P['teach.view'] = 'admin,hospital_director,medical_director,nursing_director,supervisor_education,supervisor_senior,supervisor_clinical,attending,specialist,surgeon,resident,intern,physician,quality_officer';
  perms.P['teach.supervise'] = 'admin,attending,specialist,surgeon,medical_director';
  perms.P['teach.learn'] = 'admin,resident,intern,attending,specialist,surgeon,physician';
  perms.P['teach.verify_cases'] = 'admin,attending,specialist,surgeon,medical_director';
  perms.P['teach.feedback'] = 'admin,attending,specialist,surgeon';
  perms.P['teach.duty_hours'] = 'admin,resident,intern,attending,specialist,surgeon,medical_director,supervisor_education';
}

const EPA_CATALOG = {
  EPA1:  { fa:'شرح‌حال و معاینه فیزیکی', en:'Gather history and PE', cat:'clinical', icon:'🩺' },
  EPA2:  { fa:'تشخیص افتراقی',           en:'Prioritize differential', cat:'clinical', icon:'🔍' },
  EPA3:  { fa:'تفسیر آزمایش',            en:'Recommend/interpret tests', cat:'clinical', icon:'🧪' },
  EPA4:  { fa:'ثبت دستور و نسخه',        en:'Enter orders/prescriptions', cat:'documentation', icon:'📝' },
  EPA5:  { fa:'مستندسازی بالینی',        en:'Document clinical encounter', cat:'documentation', icon:'📋' },
  EPA6:  { fa:'ارائه شفاهی',             en:'Oral presentation', cat:'communication', icon:'🗣️' },
  EPA7:  { fa:'پرسش بالینی و شواهد',    en:'Form clinical questions', cat:'pbla', icon:'❓' },
  EPA8:  { fa:'تحویل بیمار',             en:'Give/receive handover', cat:'communication', icon:'🔄' },
  EPA9:  { fa:'همکاری بین‌حرفه‌ای',      en:'Collaborate as team member', cat:'professionalism', icon:'🤝' },
  EPA10: { fa:'تشخیص وضعیت اورژانسی',   en:'Recognize urgent/emergent', cat:'clinical', icon:'🚨' },
  EPA11: { fa:'رضایت آگاهانه',           en:'Obtain informed consent', cat:'communication', icon:'✍️' },
  EPA12: { fa:'پروسیجرهای عمومی',       en:'Perform general procedures', cat:'clinical', icon:'💉' },
  EPA13: { fa:'ایمنی بیمار',             en:'Identify system failures', cat:'safety', icon:'🛡️' }
};

const MILESTONE_CATALOG = {
  pc:   { fa:'مراقبت بیمار',    en:'Patient Care',  icon:'🩺' },
  mk:   { fa:'دانش پزشکی',      en:'Medical Knowledge', icon:'📚' },
  pbli: { fa:'یادگیری و بهبود', en:'PBLI', icon:'📈' },
  ics:  { fa:'ارتباطات',        en:'ICS', icon:'💬' },
  prof: { fa:'حرفه‌ای‌گری',     en:'Professionalism', icon:'⚖️' },
  sbp:  { fa:'سیستم‌های سلامت', en:'SBP', icon:'🏥' }
};

const SUPERVISION_LEVELS = {
  1: { fa:'فقط مشاهده',              en:'Observation',      color:'info' },
  2: { fa:'نظارت مستقیم',            en:'Direct supervision',color:'warn' },
  3: { fa:'نظارت غیرمستقیم (اتاق)',  en:'Indirect (in room)',color:'warn' },
  4: { fa:'نظارت غیرمستقیم (دسترس)', en:'Indirect (available)', color:'ok' },
  5: { fa:'مستقل',                    en:'Independent',     color:'ok' }
};

const DUTY_HOURS_RULES = {
  maxWeeklyHours: 80,
  maxContinuousHours: 28,
  minRestBetweenShifts: 8,
  maxConsecutiveNights: 4
};

function isLearner(actor) { return actor && ['resident','intern'].includes(actor.role); }
function isSupervisor(actor) { return actor && ['attending','specialist','surgeon','admin','medical_director'].includes(actor.role); }

function getSupervisor(actor) {
  if (!isLearner(actor)) return null;
  const users = store.readAll('users').filter(u => ['attending','specialist'].includes(u.role) && u.active !== false);
  const byWard = users.find(u => u.ward && u.ward === actor.ward);
  if (byWard) return byWard;
  const byService = users.find(u => Array.isArray(u.services) && Array.isArray(actor.services) && u.services.some(s => actor.services.includes(s)));
  if (byService) return byService;
  return users[0] || null;
}

function weekKeyOf(date) {
  const d = date || new Date();
  const yr = d.getFullYear();
  const start = new Date(yr, 0, 1);
  const days = Math.floor((d - start) / 86400000);
  return yr + '-W' + String(Math.ceil((days + start.getDay() + 1) / 7)).padStart(2, '0');
}

// ═══ ATTACHMENT (attribution for teaching moments) ═══
function attachLearner(ctx) {
  const b = ctx.body || {};
  if (!b.patientId || !b.learnerId) throw ctx.E.badRequest('missing');
  const patient = store.get('patients', b.patientId);
  if (!patient) throw ctx.E.notFound('patient_not_found');
  const learner = store.get('users', b.learnerId);
  if (!learner) throw ctx.E.notFound('learner_not_found');
  if (!isLearner(learner) && learner.role !== 'admin') throw ctx.E.badRequest('not_a_learner');
  const existing = store.readAll('teaching_attachments').find(a => a.patientId === b.patientId && a.learnerId === b.learnerId && !a.detachedAt);
  if (existing) return existing;
  const rec = {
    id: ctx.uid('ta'), patientId: patient.id,
    patientName: patient.firstName + ' ' + patient.lastName,
    wardCode: patient.wardCode,
    learnerId: learner.id, learnerName: learner.fullName || learner.username, learnerRole: learner.role,
    attachedBy: ctx.actor.id, attachedByName: ctx.actor.fullName || ctx.actor.username,
    attachedAt: ctx.now(), detachedAt: null,
    expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
    context: b.context || 'rounds'
  };
  store.put('teaching_attachments', rec);
  ctx.audit.write('teaching_mode', 'attach', rec.id, ctx.actor, { patientId: patient.id, learnerId: learner.id });
  bus.emit('teaching.attach', { record: rec });
  return rec;
}

function detachLearner(ctx) {
  const rec = store.get('teaching_attachments', ctx.params.id);
  if (!rec) throw ctx.E.notFound('not_found');
  if (rec.detachedAt) return rec;
  rec.detachedAt = ctx.now(); rec.detachedBy = ctx.actor.id;
  store.put('teaching_attachments', rec);
  return rec;
}

function listAttachments(ctx) {
  const q = ctx.query;
  let items = store.readAll('teaching_attachments');
  if (q.patientId) items = items.filter(a => a.patientId === q.patientId);
  if (q.learnerId) items = items.filter(a => a.learnerId === q.learnerId);
  if (q.activeOnly === '1') items = items.filter(a => !a.detachedAt);
  return { items: items.slice(-50).reverse(), total: items.length };
}

// ═══ SUPERVISED ORDERS ═══
function createSupervisedOrder(ctx) {
  const b = ctx.body || {};
  if (!b.patientId || !b.type || !b.details) throw ctx.E.badRequest('missing');
  const patient = store.get('patients', b.patientId);
  if (!patient) throw ctx.E.notFound('patient_not_found');
  const learner = ctx.actor;
  const supervisor = getSupervisor(learner);
  if (!supervisor) throw ctx.E.conflict('no_supervisor_assigned');
  if (b.type === 'medication' && b.details.drug && patient.allergies && patient.allergies.length) {
    const drug = String(b.details.drug).toLowerCase();
    for (const a of patient.allergies) {
      if (drug.includes(String(a).toLowerCase()) && !b.overrideReason) throw ctx.E.conflict('allergy_conflict:' + a);
    }
  }
  const orderId = ctx.uid('ord');
  const order = {
    id: orderId, patientId: patient.id,
    patientName: patient.firstName + ' ' + patient.lastName,
    wardCode: patient.wardCode, type: b.type,
    priority: b.priority || 'routine', details: b.details,
    status: 'pending_teaching',
    orderedBy: learner.id, orderedAt: ctx.now(),
    teachingLearner: learner.id, teachingSupervisor: supervisor.id,
    allergyOverrideReason: b.overrideReason || null
  };
  orderWriter.create(ctx, order);
  const rec = {
    id: ctx.uid('tso'), orderId,
    patientId: patient.id, patientName: order.patientName,
    learnerId: learner.id, learnerName: learner.fullName || learner.username, learnerRole: learner.role,
    supervisorId: supervisor.id, supervisorName: supervisor.fullName || supervisor.username,
    type: b.type, priority: b.priority || 'routine', details: b.details,
    status: 'pending_approval', createdAt: ctx.now()
  };
  store.put('teaching_supervised_orders', rec);
  try {
    store.put('sa_notifications', { id: ctx.uid('san'), userId: supervisor.id,
      title: '📝 دستور آموزشی جدید', body: order.patientName + ' — ' + (b.details.drug || b.type),
      type: 'info', read: false, createdAt: ctx.now(), link: 'teaching_mode.hub' });
  } catch (_) {}
  ctx.audit.write('teaching_mode', 'order.create', orderId, learner, { patientId: patient.id, supervisorId: supervisor.id, type: b.type });
  bus.emit('teaching.order.created', { order, rec });
  return { order, rec, requiresApproval: true };
}

function listPendingOrders(ctx) {
  let items = store.readAll('teaching_supervised_orders').filter(t => t.status === 'pending_approval');
  if (ctx.actor.role !== 'admin') items = items.filter(t => t.supervisorId === ctx.actor.id);
  items.sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  return { items: items.slice(0, 50), total: items.length };
}

function approveOrder(ctx) {
  const rec = store.get('teaching_supervised_orders', ctx.params.id);
  if (!rec) throw ctx.E.notFound('not_found');
  if (rec.status !== 'pending_approval') throw ctx.E.conflict('not_pending');
  if (rec.supervisorId !== ctx.actor.id && ctx.actor.role !== 'admin') throw ctx.E.forbidden('not_supervisor');
  const order = store.get('orders', rec.orderId);
  if (!order) throw ctx.E.notFound('order_not_found');
  order.status = 'pending';
  order.approvedByTeachingAt = ctx.now();
  order.approvedByTeachingBy = ctx.actor.id;
  orderWriter.save(ctx, order);
  rec.status = 'approved';
  rec.approvedBy = ctx.actor.id;
  rec.approvedByName = ctx.actor.fullName || ctx.actor.username;
  rec.approvedAt = ctx.now();
  rec.feedback = String(ctx.body.feedback || '').slice(0, 1000);
  store.put('teaching_supervised_orders', rec);
  try {
    store.put('sa_notifications', { id: ctx.uid('san'), userId: rec.learnerId,
      title: '✅ دستور تأیید شد', body: rec.patientName + ' — ' + ((rec.details && rec.details.drug) || rec.type),
      type: 'success', read: false, createdAt: ctx.now(), link: 'teaching_mode.hub' });
  } catch (_) {}
  ctx.audit.write('teaching_mode', 'order.approve', rec.id, ctx.actor, { orderId: rec.orderId });
  bus.emit('teaching.order.approved', { rec, order });
  return rec;
}

function rejectOrder(ctx) {
  const rec = store.get('teaching_supervised_orders', ctx.params.id);
  if (!rec) throw ctx.E.notFound('not_found');
  if (rec.status !== 'pending_approval') throw ctx.E.conflict('not_pending');
  if (rec.supervisorId !== ctx.actor.id && ctx.actor.role !== 'admin') throw ctx.E.forbidden('not_supervisor');
  const fb = String((ctx.body && ctx.body.feedback) || '').trim();
  if (fb.length < 10) throw ctx.E.badRequest('feedback_min_10_chars');
  const order = store.get('orders', rec.orderId);
  if (order) { order.status = 'rejected_teaching'; order.rejectedByTeachingAt = ctx.now(); orderWriter.save(ctx, order); }
  rec.status = 'rejected';
  rec.rejectedBy = ctx.actor.id;
  rec.rejectedByName = ctx.actor.fullName || ctx.actor.username;
  rec.rejectedAt = ctx.now();
  rec.feedback = fb.slice(0, 1000);
  store.put('teaching_supervised_orders', rec);
  try {
    store.put('sa_notifications', { id: ctx.uid('san'), userId: rec.learnerId,
      title: '❌ دستور رد شد — بازخورد', body: fb.slice(0, 100),
      type: 'warning', read: false, createdAt: ctx.now(), link: 'teaching_mode.hub' });
  } catch (_) {}
  ctx.audit.write('teaching_mode', 'order.reject', rec.id, ctx.actor, { orderId: rec.orderId, feedback: fb });
  bus.emit('teaching.order.rejected', { rec, order });
  return rec;
}

function myOrders(ctx) {
  const items = store.readAll('teaching_supervised_orders').filter(t => t.learnerId === ctx.actor.id);
  items.sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  return { items: items.slice(0, 50), total: items.length };
}

// ═══ FEEDBACK (W3) ═══
function giveFeedback(ctx) {
  const b = ctx.body || {};
  if (!b.learnerId) throw ctx.E.badRequest('learner_id_required');
  if (!b.context) throw ctx.E.badRequest('context_required');
  if (!b.whatWentWell || b.whatWentWell.length < 5) throw ctx.E.badRequest('what_went_well_min_5');
  if (!b.whatToImprove || b.whatToImprove.length < 5) throw ctx.E.badRequest('what_to_improve_min_5');
  const learner = store.get('users', b.learnerId);
  if (!learner) throw ctx.E.notFound('learner_not_found');
  const rec = {
    id: ctx.uid('fb'),
    learnerId: learner.id, learnerName: learner.fullName || learner.username, learnerRole: learner.role,
    supervisorId: ctx.actor.id, supervisorName: ctx.actor.fullName || ctx.actor.username,
    patientId: b.patientId || null, patientName: b.patientName || null,
    context: String(b.context).slice(0, 200),
    whatWentWell: String(b.whatWentWell).slice(0, 1000),
    whatToImprove: String(b.whatToImprove).slice(0, 1000),
    actionItems: String(b.actionItems || '').slice(0, 1000),
    rating: ['below','meets','above','exceeds'].includes(b.rating) ? b.rating : 'meets',
    at: ctx.now()
  };
  store.put('teaching_feedback', rec);
  ctx.audit.write('teaching_mode', 'feedback', rec.id, ctx.actor, { learnerId: learner.id, context: rec.context });
  bus.emit('teaching.feedback.created', { rec });
  return rec;
}

function listFeedback(ctx) {
  let items = store.readAll('teaching_feedback');
  if (ctx.query.learnerId) items = items.filter(f => f.learnerId === ctx.query.learnerId);
  if (ctx.query.supervisorId) items = items.filter(f => f.supervisorId === ctx.query.supervisorId);
  items.sort((a, b) => sd(b.at) - sd(a.at));
  return { items: items.slice(0, 50), total: items.length };
}

function myFeedback(ctx) {
  const items = store.readAll('teaching_feedback').filter(f => f.learnerId === ctx.actor.id).sort((a, b) => sd(b.at) - sd(a.at));
  return { items: items.slice(0, 50), total: items.length };
}

// ═══ CASE LOG ═══
function logCase(ctx) {
  const b = ctx.body || {};
  if (!b.patientId) throw ctx.E.badRequest('patient_id_required');
  if (!b.caseType) throw ctx.E.badRequest('case_type_required');
  if (!b.caseName) throw ctx.E.badRequest('case_name_required');
  const patient = store.get('patients', b.patientId);
  if (!patient) throw ctx.E.notFound('patient_not_found');
  const rec = {
    id: ctx.uid('cl'),
    learnerId: ctx.actor.id, learnerName: ctx.actor.fullName || ctx.actor.username, learnerRole: ctx.actor.role,
    patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName,
    ward: patient.wardCode,
    caseType: ['diagnosis','procedure','encounter','complication','delivery','resuscitation'].includes(b.caseType) ? b.caseType : 'encounter',
    caseName: String(b.caseName).slice(0, 200),
    role: ['primary','assist','observer','supervisor'].includes(b.role) ? b.role : 'primary',
    supervisorId: b.supervisorId || null,
    notes: String(b.notes || '').slice(0, 500),
    verified: false, verifiedBy: null, verifiedByName: null, verifiedAt: null,
    at: ctx.now()
  };
  store.put('teaching_case_log', rec);
  ctx.audit.write('teaching_mode', 'case.log', rec.id, ctx.actor, { patientId: patient.id, caseType: rec.caseType });
  bus.emit('teaching.case.logged', { rec });
  return rec;
}

function verifyCase(ctx) {
  const rec = store.get('teaching_case_log', ctx.params.id);
  if (!rec) throw ctx.E.notFound('not_found');
  if (rec.verified) throw ctx.E.conflict('already_verified');
  if (!isSupervisor(ctx.actor)) throw ctx.E.forbidden('not_supervisor');
  rec.verified = true;
  rec.verifiedBy = ctx.actor.id;
  rec.verifiedByName = ctx.actor.fullName || ctx.actor.username;
  rec.verifiedAt = ctx.now();
  store.put('teaching_case_log', rec);
  ctx.audit.write('teaching_mode', 'case.verify', rec.id, ctx.actor, {});
  return rec;
}

function listCases(ctx) {
  let items = store.readAll('teaching_case_log');
  if (ctx.query.learnerId) items = items.filter(c => c.learnerId === ctx.query.learnerId);
  if (ctx.query.unverifiedOnly === '1') items = items.filter(c => !c.verified);
  items.sort((a, b) => sd(b.at) - sd(a.at));
  return { items: items.slice(0, 100), total: items.length };
}

function casesSummary(ctx) {
  const learnerId = ctx.params.learnerId;
  const items = store.readAll('teaching_case_log').filter(c => c.learnerId === learnerId);
  const byType = {}, byRole = {};
  let verified = 0;
  for (const c of items) {
    byType[c.caseType] = (byType[c.caseType] || 0) + 1;
    byRole[c.role] = (byRole[c.role] || 0) + 1;
    if (c.verified) verified++;
  }
  return { learnerId, total: items.length, verified, unverified: items.length - verified, byType, byRole };
}

// ═══ DUTY HOURS (ACGME) ═══
function dutyCheckin(ctx) {
  const open = store.readAll('teaching_duty_hours').find(d => d.learnerId === ctx.actor.id && !d.checkoutAt);
  if (open) throw ctx.E.conflict('already_checked_in:' + open.id);
  const rec = {
    id: ctx.uid('dh'),
    learnerId: ctx.actor.id, learnerName: ctx.actor.fullName || ctx.actor.username,
    role: ctx.actor.role, ward: ctx.actor.ward || null,
    checkinAt: ctx.now(), checkoutAt: null, hours: null,
    weekKey: weekKeyOf(new Date())
  };
  store.put('teaching_duty_hours', rec);
  bus.emit('teaching.duty.checkin', { rec });
  return rec;
}

function dutyCheckout(ctx) {
  const open = store.readAll('teaching_duty_hours').find(d => d.learnerId === ctx.actor.id && !d.checkoutAt);
  if (!open) throw ctx.E.conflict('not_checked_in');
  open.checkoutAt = ctx.now();
  open.hours = Math.round((sd(open.checkoutAt) - sd(open.checkinAt)) / 3600000 * 10) / 10;
  store.put('teaching_duty_hours', open);
  bus.emit('teaching.duty.checkout', { rec: open });
  const violations = checkDutyViolations(ctx.actor.id);
  if (violations.length) bus.emit('teaching.duty.violation', { learnerId: ctx.actor.id, violations });
  return { rec: open, violations };
}

function checkDutyViolations(learnerId) {
  try {
    const weekKey = weekKeyOf(new Date());
    const all = store.readAll('teaching_duty_hours').filter(d => d.learnerId === learnerId && d.weekKey === weekKey && d.checkoutAt);
    const total = all.reduce((s, d) => s + (d.hours || 0), 0);
    const v = [];
    if (total > DUTY_HOURS_RULES.maxWeeklyHours) v.push({ type: 'weekly_over', value: Math.round(total), limit: DUTY_HOURS_RULES.maxWeeklyHours });
    return v;
  } catch (_) { return []; }
}

function dutyStatus(ctx) {
  const learnerId = ctx.params.learnerId || ctx.actor.id;
  const weekKey = weekKeyOf(new Date());
  const all = store.readAll('teaching_duty_hours').filter(d => d.learnerId === learnerId && d.weekKey === weekKey);
  const closed = all.filter(d => d.checkoutAt);
  const totalHours = closed.reduce((s, d) => s + (d.hours || 0), 0);
  const open = all.find(d => !d.checkoutAt);
  let maxContinuous = 0;
  for (const d of all) {
    const end = d.checkoutAt ? sd(d.checkoutAt) : Date.now();
    const hours = (end - sd(d.checkinAt)) / 3600000;
    if (hours > maxContinuous) maxContinuous = hours;
  }
  const sorted = closed.sort((a, b) => sd(a.checkinAt) - sd(b.checkinAt));
  let minRest = 999;
  for (let i = 1; i < sorted.length; i++) {
    const rest = (sd(sorted[i].checkinAt) - sd(sorted[i-1].checkoutAt)) / 3600000;
    if (rest < minRest) minRest = rest;
  }
  const violations = [];
  if (totalHours > DUTY_HOURS_RULES.maxWeeklyHours) violations.push({ type: 'weekly_over', value: Math.round(totalHours), limit: DUTY_HOURS_RULES.maxWeeklyHours });
  if (maxContinuous > DUTY_HOURS_RULES.maxContinuousHours) violations.push({ type: 'continuous_over', value: Math.round(maxContinuous), limit: DUTY_HOURS_RULES.maxContinuousHours });
  if (sorted.length >= 2 && minRest < DUTY_HOURS_RULES.minRestBetweenShifts) violations.push({ type: 'rest_under', value: Math.round(minRest), limit: DUTY_HOURS_RULES.minRestBetweenShifts });
  return {
    learnerId, weekKey,
    totalHours: Math.round(totalHours * 10) / 10,
    maxContinuousHours: Math.round(maxContinuous * 10) / 10,
    minRestHours: minRest < 999 ? Math.round(minRest * 10) / 10 : null,
    shiftsCount: all.length, currentlyOnDuty: !!open, openShift: open,
    violations, rules: DUTY_HOURS_RULES
  };
}

// ═══ EPA ═══
function listEPAs() {
  return { items: Object.entries(EPA_CATALOG).map(([code, e]) => ({ code, ...e })), total: Object.keys(EPA_CATALOG).length, levels: SUPERVISION_LEVELS };
}

function assessEPA(ctx) {
  const b = ctx.body || {};
  if (!b.learnerId || !b.epaCode) throw ctx.E.badRequest('missing');
  if (!EPA_CATALOG[b.epaCode]) throw ctx.E.badRequest('invalid_epa');
  const level = Number(b.level);
  if (!level || level < 1 || level > 5) throw ctx.E.badRequest('level_1_to_5');
  if (!isSupervisor(ctx.actor)) throw ctx.E.forbidden('supervisor_only');
  const learner = store.get('users', b.learnerId);
  if (!learner) throw ctx.E.notFound('learner_not_found');
  const rec = {
    id: ctx.uid('epa'),
    learnerId: b.learnerId, learnerName: learner.fullName || learner.username,
    epaCode: b.epaCode, level,
    supervisorId: ctx.actor.id, supervisorName: ctx.actor.fullName || ctx.actor.username,
    evidence: String(b.evidence || '').slice(0, 500), at: ctx.now()
  };
  store.put('teaching_epa_assessments', rec);
  bus.emit('teaching.epa.assessed', { rec });
  return rec;
}

function epaProgress(ctx) {
  const learnerId = ctx.params.learnerId;
  const all = store.readAll('teaching_epa_assessments').filter(e => e.learnerId === learnerId);
  const byEPA = {};
  for (const a of all) {
    if (!byEPA[a.epaCode]) byEPA[a.epaCode] = { level: a.level, at: a.at, by: a.supervisorName, count: 1 };
    else { if (a.level > byEPA[a.epaCode].level) { byEPA[a.epaCode].level = a.level; byEPA[a.epaCode].at = a.at; byEPA[a.epaCode].by = a.supervisorName; } byEPA[a.epaCode].count++; }
  }
  return {
    learnerId,
    items: Object.entries(EPA_CATALOG).map(([code, def]) => {
      const latest = byEPA[code];
      return { code, ...def, currentLevel: latest ? latest.level : null, lastAt: latest ? latest.at : null, lastBy: latest ? latest.by : null, assessmentsCount: latest ? latest.count : 0 };
    }),
    totalAssessments: all.length
  };
}

// ═══ MILESTONES ═══
function assessMilestone(ctx) {
  const b = ctx.body || {};
  if (!b.learnerId || !b.competency) throw ctx.E.badRequest('missing');
  if (!MILESTONE_CATALOG[b.competency]) throw ctx.E.badRequest('invalid_competency');
  const level = Number(b.level);
  if (!level || level < 1 || level > 5) throw ctx.E.badRequest('level_1_to_5');
  if (!isSupervisor(ctx.actor)) throw ctx.E.forbidden('supervisor_only');
  const learner = store.get('users', b.learnerId);
  if (!learner) throw ctx.E.notFound('learner_not_found');
  const rec = {
    id: ctx.uid('ms'),
    learnerId: b.learnerId, learnerName: learner.fullName || learner.username,
    competency: b.competency, level,
    supervisorId: ctx.actor.id, supervisorName: ctx.actor.fullName || ctx.actor.username,
    evidence: String(b.evidence || '').slice(0, 500), at: ctx.now()
  };
  store.put('teaching_milestone_assessments', rec);
  bus.emit('teaching.milestone.assessed', { rec });
  return rec;
}

function milestoneProgress(ctx) {
  const learnerId = ctx.params.learnerId;
  const all = store.readAll('teaching_milestone_assessments').filter(m => m.learnerId === learnerId);
  const byComp = {};
  for (const a of all) { if (!byComp[a.competency] || a.level > byComp[a.competency].level) byComp[a.competency] = { level: a.level, at: a.at, by: a.supervisorName }; }
  return {
    learnerId,
    items: Object.entries(MILESTONE_CATALOG).map(([code, def]) => {
      const latest = byComp[code];
      return { code, ...def, currentLevel: latest ? latest.level : null, lastAt: latest ? latest.at : null, lastBy: latest ? latest.by : null };
    }),
    total: all.length
  };
}

// ═══ DASHBOARD (attending view) ═══
function dashboard(ctx) {
  const actor = ctx.actor;
  const pendingOrders = store.readAll('teaching_supervised_orders').filter(t => t.status === 'pending_approval' && (actor.role === 'admin' || t.supervisorId === actor.id));
  const unverifiedCases = store.readAll('teaching_case_log').filter(c => !c.verified);
  const mySupervised = store.readAll('teaching_supervised_orders').filter(t => t.supervisorId === actor.id);
  const learners = store.readAll('users').filter(u => isLearner(u) && u.active !== false && (!u.ward || u.ward === actor.ward || !actor.ward));
  const violations = [];
  for (const l of learners) {
    const v = checkDutyViolations(l.id);
    if (v.length) violations.push({ learnerId: l.id, learnerName: l.fullName || l.username, violations: v });
  }
  return {
    pendingOrders: { total: pendingOrders.length, items: pendingOrders.slice(0, 10).map(t => ({ id: t.id, orderId: t.orderId, patientName: t.patientName, learnerName: t.learnerName, type: t.type, priority: t.priority, details: t.details, createdAt: t.createdAt })) },
    unverifiedCases: { total: unverifiedCases.length, items: unverifiedCases.slice(0, 10).map(c => ({ id: c.id, learnerName: c.learnerName, patientName: c.patientName, caseType: c.caseType, caseName: c.caseName, at: c.at })) },
    learners: { total: learners.length, items: learners.slice(0, 30).map(l => ({ id: l.id, name: l.fullName || l.username, role: l.role, ward: l.ward })) },
    dutyViolations: violations,
    stats: {
      approved: mySupervised.filter(t => t.status === 'approved').length,
      rejected: mySupervised.filter(t => t.status === 'rejected').length,
      totalSupervisions: mySupervised.length,
      totalLearners: learners.length
    },
    generatedAt: ctx.now()
  };
}

// ═══ PORTFOLIO (learner view) ═══
function portfolio(ctx) {
  const learnerId = ctx.params.learnerId || ctx.actor.id;
  const learner = store.get('users', learnerId);
  if (!learner) throw ctx.E.notFound('learner_not_found');
  const cases = store.readAll('teaching_case_log').filter(c => c.learnerId === learnerId);
  const verified = cases.filter(c => c.verified).length;
  const epas = epaProgress({ params: { learnerId } });
  const milestones = milestoneProgress({ params: { learnerId } });
  const feedback = store.readAll('teaching_feedback').filter(f => f.learnerId === learnerId).sort((a, b) => sd(b.at) - sd(a.at)).slice(0, 20);
  const duty = dutyStatus({ params: { learnerId } });
  const orders = store.readAll('teaching_supervised_orders').filter(t => t.learnerId === learnerId).sort((a, b) => sd(b.createdAt) - sd(a.createdAt)).slice(0, 20);
  return {
    learner: { id: learner.id, name: learner.fullName || learner.username, role: learner.role, ward: learner.ward },
    cases: { total: cases.length, verified, byType: cases.reduce((a, c) => { a[c.caseType] = (a[c.caseType] || 0) + 1; return a; }, {}), list: cases.slice(0, 20).map(c => ({ id: c.id, patientName: c.patientName, caseType: c.caseType, caseName: c.caseName, role: c.role, verified: c.verified, verifiedByName: c.verifiedByName, at: c.at })) },
    epas: epas.items,
    milestones: milestones.items,
    feedback: feedback.map(f => ({ context: f.context, whatWentWell: f.whatWentWell, whatToImprove: f.whatToImprove, actionItems: f.actionItems, rating: f.rating, at: f.at, by: f.supervisorName })),
    duty,
    recentOrders: orders.map(o => ({ id: o.id, patientName: o.patientName, type: o.type, status: o.status, at: o.createdAt, feedback: o.feedback, learnerName: o.learnerName })),
    generatedAt: ctx.now()
  };
}

module.exports = {
  handlers: {
    attachLearner, detachLearner, listAttachments,
    createSupervisedOrder, listPendingOrders, approveOrder, rejectOrder, myOrders,
    giveFeedback, listFeedback, myFeedback,
    logCase, verifyCase, listCases, casesSummary,
    dutyCheckin, dutyCheckout, dutyStatus,
    listEPAs, assessEPA, epaProgress, assessMilestone, milestoneProgress,
    dashboard, portfolio
  },
  routes: [
    { method:'GET',  path:'/api/teach/dashboard',         handler:'dashboard',            perm:'teach.view' },
    { method:'GET',  path:'/api/teach/portfolio/:learnerId', handler:'portfolio',         perm:'teach.view' },
    { method:'GET',  path:'/api/teach/epas',              handler:'listEPAs',             perm:'teach.view' },
    { method:'GET',  path:'/api/teach/epa/:learnerId',    handler:'epaProgress',          perm:'teach.view' },
    { method:'GET',  path:'/api/teach/milestone/:learnerId', handler:'milestoneProgress', perm:'teach.view' },
    { method:'GET',  path:'/api/teach/pending-orders',    handler:'listPendingOrders',    perm:'teach.view' },
    { method:'GET',  path:'/api/teach/my-orders',         handler:'myOrders',             perm:'teach.view' },
    { method:'GET',  path:'/api/teach/feedback',          handler:'listFeedback',         perm:'teach.view' },
    { method:'GET',  path:'/api/teach/my-feedback',       handler:'myFeedback',           perm:'teach.view' },
    { method:'GET',  path:'/api/teach/cases',             handler:'listCases',            perm:'teach.view' },
    { method:'GET',  path:'/api/teach/cases-summary/:learnerId', handler:'casesSummary',  perm:'teach.view' },
    { method:'GET',  path:'/api/teach/duty/:learnerId',   handler:'dutyStatus',           perm:'teach.view' },
    { method:'GET',  path:'/api/teach/attachments',       handler:'listAttachments',      perm:'teach.view' },
    { method:'POST', path:'/api/teach/attach',            handler:'attachLearner',        perm:'teach.supervise' },
    { method:'POST', path:'/api/teach/order',             handler:'createSupervisedOrder',perm:'teach.learn' },
    { method:'POST', path:'/api/teach/order/:id/approve', handler:'approveOrder',         perm:'teach.supervise' },
    { method:'POST', path:'/api/teach/order/:id/reject',  handler:'rejectOrder',          perm:'teach.supervise' },
    { method:'POST', path:'/api/teach/feedback',          handler:'giveFeedback',         perm:'teach.feedback' },
    { method:'POST', path:'/api/teach/case',              handler:'logCase',              perm:'teach.learn' },
    { method:'POST', path:'/api/teach/case/:id/verify',   handler:'verifyCase',           perm:'teach.verify_cases' },
    { method:'POST', path:'/api/teach/duty/checkin',      handler:'dutyCheckin',          perm:'teach.duty_hours' },
    { method:'POST', path:'/api/teach/duty/checkout',     handler:'dutyCheckout',         perm:'teach.duty_hours' },
    { method:'POST', path:'/api/teach/epa/assess',        handler:'assessEPA',            perm:'teach.supervise' },
    { method:'POST', path:'/api/teach/milestone/assess',  handler:'assessMilestone',      perm:'teach.supervise' },
    { method:'DELETE', path:'/api/teach/attach/:id',      handler:'detachLearner',        perm:'teach.supervise' }
  ],
  panels: [
    { id:'hub', title:'بیمارستان آموزشی', icon:'🎓', perm:'teach.view', kind:'teaching_mode', api:'/api/teach/dashboard' }
  ]
};
console.log('[teaching_mode] loaded — ACGME · 13 EPA · 6 milestones · duty hours · supervised orders');
