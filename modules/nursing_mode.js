'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Nursing Mode (S2)
//  Daily nursing shift: patients + prioritized tasks + quick actions
//  Standards: JCI IPSG.3, NANDA/NOC, ISMP 2024
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const bus = require('../core/events');
const store = require('../core/store');
const perms = require('../core/permissions');
const resolver = require('../core/ward-resolver');

if (!perms.P['nursing.mode.view']) {
  perms.P['nursing.mode.view'] = 'admin,nurse,nurse_aide,assistant_nurse,head_nurse,nursing_director,supervisor_clinical,supervisor_senior,supervisor_er,attending,specialist,resident,physician,quality_officer';
  perms.P['nursing.mode.action'] = 'admin,nurse,head_nurse,nurse_aide,assistant_nurse';
}

function currentShift() {
  let hh = 12;
  try { const t = require('../core/time'); hh = t.hourTehran ? t.hourTehran() : new Date().getHours(); }
  catch (_) { hh = new Date().getHours(); }
  if (hh >= 7 && hh < 14) return { code:'morning', fa:'صبح', startHour:7, endHour:14 };
  if (hh >= 14 && hh < 19) return { code:'evening', fa:'عصر', startHour:14, endHour:19 };
  return { code:'night', fa:'شب', startHour:19, endHour:7 };
}

function shiftStartIso() {
  const shift = currentShift();
  const t = require('../core/time');
  const c = t.todayTehranComponents ? t.todayTehranComponents() : { y: new Date().getFullYear(), m: new Date().getMonth()+1, d: new Date().getDate() };
  let start = new Date(Date.UTC(c.y, c.m-1, c.d, shift.startHour, 0, 0) - 3.5*3600000);
  if (start.getTime() > Date.now()) start = new Date(start.getTime() - 86400000);
  return start.toISOString();
}

function resolveWard(actor) {
  if (!actor) return null;
  if (actor.ward) return actor.ward;
  try { const w = resolver.resolveUserWard(actor); if (w) return w; } catch (_) {}
  if (actor.staffId) {
    try {
      const staff = store.readAll('sa_staff').find(s => String(s.id) === String(actor.staffId));
      if (staff) { const ward = store.readAll('sa_wards').find(w => w.id === staff.wardId); if (ward) return ward.code; }
    } catch (_) {}
  }
  return null;
}

function computeTasks(ctx, ward) {
  const tasks = [];
  const now = Date.now();
  const patients = h(ctx, 'patients').filter(p => p.wardCode === ward && ['in_care','admitted'].includes(p.status));
  const pidSet = new Set(patients.map(p => p.id));

  // MAR due/overdue
  const mar = h(ctx, 'mar').filter(m => pidSet.has(m.patientId));
  for (const m of mar) {
    if (!['scheduled','due'].includes(m.status)) continue;
    const diffMin = Math.round((now - sd(m.scheduledAt)) / 60000);
    if (diffMin < -120 || diffMin > 360) continue;
    const overdue = diffMin > 30;
    const high = !!m.isHighAlert;
    tasks.push({
      id: 'mar_' + m.id, type: 'mar',
      priority: high && overdue ? 'critical' : (overdue || high) ? 'high' : 'medium',
      patientId: m.patientId, patientName: m.patientName,
      title: m.drugName + ' ' + (m.dose || ''),
      subtitle: overdue ? ('دیرکرد ' + diffMin + ' دقیقه') : ('تا ' + Math.abs(diffMin) + ' دقیقه'),
      meta: { marId: m.id, isHighAlert: high, isOverdue: overdue, minutesLate: diffMin, drug: m.drugName, dose: m.dose, route: m.route },
      action: 'administer', actionApi: '/api/nurse/quick/mar-give', actionBody: { marId: m.id }
    });
  }

  // Vitals due
  const lastVitalMap = {};
  h(ctx, 'vitals').forEach(v => {
    if (!pidSet.has(v.patientId)) return;
    if (!lastVitalMap[v.patientId] || sd(v.recordedAt) > sd(lastVitalMap[v.patientId].recordedAt)) lastVitalMap[v.patientId] = v;
  });
  for (const p of patients) {
    const lv = lastVitalMap[p.id];
    const hoursSince = lv ? (now - sd(lv.recordedAt))/3600000 : 999;
    if (hoursSince >= 4) {
      tasks.push({
        id: 'vit_' + p.id, type: 'vitals',
        priority: hoursSince > 8 ? 'critical' : hoursSince > 6 ? 'high' : 'medium',
        patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
        title: 'ثبت علائم حیاتی',
        subtitle: hoursSince > 900 ? 'هرگز ثبت نشده' : Math.round(hoursSince) + ' ساعت پیش',
        meta: { lastVital: lv ? { news2: lv.news2, hr: lv.hr, spo2: lv.spo2, bp_sys: lv.bp_sys, temp: lv.temp, at: lv.recordedAt } : null },
        action: 'vitals', actionApi: '/api/nurse/quick/vitals', actionBody: { patientId: p.id }
      });
    }
  }

  // PRN effectiveness pending
  for (const m of mar) {
    if (m.status !== 'given' || !m.prnEffectivenessPending) continue;
    if (sd(m.prnEffectivenessDueAt) > now) continue;
    tasks.push({
      id: 'prn_' + m.id, type: 'prn_effectiveness', priority: 'medium',
      patientId: m.patientId, patientName: m.patientName,
      title: '📊 اثربخشی PRN — ' + m.drugName,
      subtitle: 'در انتظار ارزیابی',
      meta: { marId: m.id, drug: m.drugName },
      action: 'prn_effectiveness', actionApi: '/api/nurse/quick/prn-effectiveness', actionBody: { marId: m.id }
    });
  }

  // Critical labs unacknowledged
  h(ctx, 'labs').forEach(l => {
    if (!pidSet.has(l.patientId)) return;
    if (!l.criticalFlags || !l.criticalFlags.length) return;
    if (!['resulted','verified'].includes(l.status)) return;
    if (l.acknowledgment && l.acknowledgment.acknowledged) return;
    tasks.push({
      id: 'lab_' + l.id, type: 'critical_lab', priority: 'critical',
      patientId: l.patientId, patientName: l.patientName,
      title: '🧪 ' + (l.panelName || l.panelCode) + ' — بحرانی',
      subtitle: l.criticalFlags.length + ' مقدار',
      meta: { labId: l.id, flags: l.criticalFlags },
      action: 'acknowledge_lab', actionApi: '/api/para/labs/' + l.id + '/acknowledge', actionBody: { readBack: 'تأیید پرستار' }
    });
  });

  // Fall-risk reassessment
  const cdssScores = h(ctx, 'cdss_scores').filter(s => s.scoreType === 'morse');
  const morseMap = {};
  cdssScores.forEach(s => { if (!morseMap[s.patientId] || sd(s.computedAt) > sd(morseMap[s.patientId].computedAt)) morseMap[s.patientId] = s; });
  for (const p of patients) {
    const morse = morseMap[p.id];
    const hours = morse ? (now - sd(morse.computedAt))/3600000 : 999;
    if (hours >= 24) {
      tasks.push({
        id: 'morse_' + p.id, type: 'fall_risk',
        priority: hours > 48 ? 'high' : 'medium',
        patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
        title: '🚶 ارزیابی Morse Fall',
        subtitle: morse ? Math.round(hours) + ' ساعت پیش' : 'انجام نشده',
        meta: { patientId: p.id, lastScore: morse ? morse.score : null },
        action: 'morse', actionApi: '/api/safety/morse/auto-calc/' + p.id, actionMethod: 'GET'
      });
    }
  }

  // Restraint assessments due
  h(ctx, 'restraint_events').forEach(r => {
    if (!pidSet.has(r.patientId) || r.status !== 'active') return;
    if (sd(r.nextAssessmentDueAt) > now) return;
    tasks.push({
      id: 'rst_' + r.id, type: 'restraint_assess', priority: 'critical',
      patientId: r.patientId, patientName: r.patientName,
      title: '🔒 ارزیابی محدودیت',
      subtitle: 'سررسید شده',
      meta: { restraintId: r.id }, action: 'restraint_assess'
    });
  });

  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  tasks.sort((a, b) => order[a.priority] - order[b.priority]);
  return tasks;
}

function myShift(ctx) {
  const ward = resolveWard(ctx.actor);
  if (!ward) throw ctx.E.badRequest('ward_not_configured');
  const shift = currentShift();
  const since = shiftStartIso();
  const patients = h(ctx, 'patients').filter(p => p.wardCode === ward && ['in_care','admitted'].includes(p.status));
  const pidSet = new Set(patients.map(p => p.id));

  const lastVitalMap = {};
  h(ctx, 'vitals').forEach(v => {
    if (!pidSet.has(v.patientId)) return;
    if (!lastVitalMap[v.patientId] || sd(v.recordedAt) > sd(lastVitalMap[v.patientId].recordedAt)) lastVitalMap[v.patientId] = v;
  });

  const allTasks = computeTasks(ctx, ward);
  const taskCount = {};
  allTasks.forEach(t => {
    if (!taskCount[t.patientId]) taskCount[t.patientId] = { total: 0, critical: 0 };
    taskCount[t.patientId].total++;
    if (t.priority === 'critical') taskCount[t.patientId].critical++;
  });

  const patientList = patients.map(p => {
    const lv = lastVitalMap[p.id];
    const tc = taskCount[p.id] || { total: 0, critical: 0 };
    let risk = { score: 0, level: 'lo' };
    try { const neural = require('../core/neural'); risk = neural.patientRisk(p, { lastVital: lv }); } catch (_) {}
    return {
      id: p.id, name: p.firstName + ' ' + p.lastName,
      age: p.age, sex: p.sex, bed: p.bedNumber, diagnosis: p.diagnosis, codeStatus: p.codeStatus,
      allergies: p.allergies || [],
      news2: lv ? (lv.news2 || 0) : null, lastVitalAt: lv ? lv.recordedAt : null,
      riskScore: risk.score || 0, riskLevel: risk.level || 'lo',
      taskCount: tc.total, criticalTasks: tc.critical
    };
  }).sort((a, b) => {
    if ((a.criticalTasks > 0) !== (b.criticalTasks > 0)) return a.criticalTasks > 0 ? -1 : 1;
    return b.riskScore - a.riskScore;
  });

  const handoffs = h(ctx, 'signouts').filter(s => s.toUserId === ctx.actor.id && s.status === 'pending');

  return {
    shift: { code: shift.code, fa: shift.fa, since },
    ward,
    actor: { id: ctx.actor.id, name: ctx.actor.fullName || ctx.actor.username, role: ctx.actor.role },
    patients: patientList, patientCount: patients.length,
    taskCount: allTasks.length,
    criticalTaskCount: allTasks.filter(t => t.priority === 'critical').length,
    pendingHandoffs: handoffs.length,
    generatedAt: ctx.now()
  };
}

function tasks(ctx) {
  const ward = resolveWard(ctx.actor);
  if (!ward) throw ctx.E.badRequest('ward_not_configured');
  const all = computeTasks(ctx, ward);
  let filtered = all;
  if (ctx.query.type) filtered = filtered.filter(t => t.type === ctx.query.type);
  if (ctx.query.priority) filtered = filtered.filter(t => t.priority === ctx.query.priority);
  return {
    items: filtered.slice(0, 100), total: filtered.length,
    byPriority: {
      critical: all.filter(t => t.priority === 'critical').length,
      high: all.filter(t => t.priority === 'high').length,
      medium: all.filter(t => t.priority === 'medium').length
    },
    byType: all.reduce((acc, t) => { acc[t.type] = (acc[t.type] || 0) + 1; return acc; }, {}),
    generatedAt: ctx.now()
  };
}

function patientDetail(ctx) {
  const pid = ctx.params.id;
  const p = store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const ward = resolveWard(ctx.actor);
  const allTasks = ward ? computeTasks(ctx, ward).filter(t => t.patientId === pid) : [];
  const vitals = h(ctx, 'vitals').filter(v => v.patientId === pid).sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt)).slice(0, 10);
  const last = vitals[0] || null;
  const orders = h(ctx, 'orders').filter(o => o.patientId === pid && ['pending','verified','active'].includes(o.status));
  const mar = h(ctx, 'mar').filter(m => m.patientId === pid && ['scheduled','due'].includes(m.status));
  const isolation = h(ctx, 'isolations').find(i => i.patientId === pid && i.status === 'active');
  const sepsis = h(ctx, 'sepsis').find(s => s.patientId === pid && ['suspected','confirmed','septic_shock'].includes(s.status));
  const ncp = h(ctx, 'nursing_care_plans').find(n => n.patientId === pid && n.status === 'active');
  return {
    patient: {
      id: p.id, name: p.firstName + ' ' + p.lastName,
      age: p.age, sex: p.sex, bed: p.bedNumber, ward: p.wardCode,
      diagnosis: p.diagnosis, codeStatus: p.codeStatus,
      allergies: p.allergies || [], comorbidities: p.comorbidities || [], admittedAt: p.admittedAt
    },
    lastVital: last,
    vitals: vitals.map(v => ({ at: v.recordedAt, news2: v.news2, hr: v.hr, spo2: v.spo2, bp_sys: v.bp_sys, temp: v.temp })),
    orders: { total: orders.length, stat: orders.filter(o => o.priority === 'stat').length },
    marDue: mar.length,
    isolation: isolation ? { type: isolation.type, startedAt: isolation.startedAt } : null,
    sepsisActive: !!sepsis,
    carePlan: ncp ? { activeDiagnoses: (ncp.diagnoses || []).filter(d => d.status === 'active').length } : null,
    tasks: allTasks
  };
}

function quickVitals(ctx) {
  const b = ctx.body || {};
  if (!b.patientId) throw ctx.E.badRequest('patient_id_required');
  const p = store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const rec = {
    patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode, bedNumber: p.bedNumber,
    recordedAt: ctx.now(), recordedBy: ctx.actor.id, recordedByName: ctx.actor.fullName || ctx.actor.username,
    hr: b.hr != null ? Number(b.hr) : null,
    bp_sys: b.bp_sys != null ? Number(b.bp_sys) : null,
    bp_dia: b.bp_dia != null ? Number(b.bp_dia) : null,
    rr: b.rr != null ? Number(b.rr) : null,
    temp: b.temp != null ? Number(b.temp) : null,
    spo2: b.spo2 != null ? Number(b.spo2) : null,
    onOxygen: !!b.onOxygen,
    gcs: b.gcs != null ? Number(b.gcs) : 15,
    pain: b.pain != null ? Number(b.pain) : 0,
    consciousness: b.consciousness || 'alert',
    notes: String(b.notes || '').slice(0, 500)
  };
  require('../core/domain/vitals-writer').record(ctx, rec);
  ctx.audit.write('nursing_mode', 'quick.vitals', rec.id, ctx.actor, { patientId: p.id, news2: rec.news2 });
  return { vitals: rec, news2: rec.news2, level: rec.newsLevel, alert: rec.news2 >= 5 };
}

function quickMarGive(ctx) {
  const b = ctx.body || {};
  if (!b.marId) throw ctx.E.badRequest('mar_id_required');
  const fiveRights = b.fiveRights || { patient:true, drug:true, dose:true, route:true, time:true };
  const missing = ['patient','drug','dose','route','time'].filter(r => !fiveRights[r]);
  if (missing.length) throw ctx.E.conflict('five_rights_missing:' + missing.join(','));
  try {
    const marAdv = require('./mar_advanced');
    if (marAdv.handlers && marAdv.handlers.administerAdvanced) {
      return marAdv.handlers.administerAdvanced({
        ...ctx, params: { id: b.marId },
        body: { fiveRights, witnessedBy: b.witnessedBy, lateReason: b.lateReason, notes: b.notes }
      });
    }
  } catch (e) { if (e && e.code) throw e; }
  const clinical = require('./clinical');
  return clinical.handlers.marAdminister({
    ...ctx, params: { id: b.marId },
    body: { fiveRights, witnessedBy: b.witnessedBy, overrideReason: b.overrideReason, notes: b.notes }
  });
}

function quickMarRefuse(ctx) {
  const b = ctx.body || {};
  if (!b.marId) throw ctx.E.badRequest('mar_id_required');
  if (!b.reason) throw ctx.E.badRequest('reason_required');
  const clinical = require('./clinical');
  return clinical.handlers.marRefuse({ ...ctx, params: { id: b.marId }, body: { reason: b.reason } });
}

function quickPrnEffectiveness(ctx) {
  const b = ctx.body || {};
  if (!b.marId) throw ctx.E.badRequest('mar_id_required');
  const marAdv = require('./mar_advanced');
  return marAdv.handlers.prnEffectiveness({
    ...ctx, params: { id: b.marId },
    body: { scale: b.scale, before: b.before, after: b.after, notes: b.notes }
  });
}

function quickIO(ctx) {
  const b = ctx.body || {};
  if (!b.patientId) throw ctx.E.badRequest('patient_id_required');
  if (!b.type || !['intake','output'].includes(b.type)) throw ctx.E.badRequest('invalid_type');
  if (b.volume == null) throw ctx.E.badRequest('volume_required');
  const p = store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const rec = {
    id: ctx.uid('io'), patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode, type: b.type, subtype: b.subtype || 'other',
    volume: Number(b.volume), recordedAt: ctx.now(),
    recordedBy: ctx.actor.id, recordedByName: ctx.actor.fullName || ctx.actor.username,
    notes: String(b.notes || '').slice(0, 300)
  };
  store.put('io_records', rec);
  ctx.audit.write('nursing_mode', 'quick.io', rec.id, ctx.actor, { patientId: p.id, type: b.type, volume: rec.volume });
  ctx.bus.emit('kardex.io.recorded', { record: rec, actor: ctx.actor });
  const since = Date.now() - 86400000;
  const all = h(ctx, 'io_records').filter(r => r.patientId === p.id && sd(r.recordedAt) >= since);
  const intake = all.filter(r => r.type === 'intake').reduce((s, r) => s + r.volume, 0);
  const output = all.filter(r => r.type === 'output').reduce((s, r) => s + r.volume, 0);
  return { record: rec, balance24h: { intake, output, net: intake - output } };
}

function quickNote(ctx) {
  const b = ctx.body || {};
  if (!b.patientId || !b.text) throw ctx.E.badRequest('patient_id_and_text_required');
  const p = store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const rec = {
    id: ctx.uid('nn'), patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode, bedNumber: p.bedNumber,
    text: String(b.text).slice(0, 2000),
    category: ['observation','concern','education','wound','mobility','other'].includes(b.category) ? b.category : 'observation',
    shiftCode: currentShift().code, at: ctx.now(),
    by: ctx.actor.id, byName: ctx.actor.fullName || ctx.actor.username
  };
  store.put('nursing_notes', rec);
  ctx.audit.write('nursing_mode', 'quick.note', rec.id, ctx.actor, { patientId: p.id, category: rec.category });
  ctx.bus.emit('nursing.note.recorded', { record: rec, actor: ctx.actor });
  return rec;
}

function shiftSummary(ctx) {
  const ward = resolveWard(ctx.actor);
  if (!ward) throw ctx.E.badRequest('ward_not_configured');
  const shift = currentShift();
  const since = shiftStartIso();
  const sinceMs = sd(since);
  const patients = h(ctx, 'patients').filter(p => p.wardCode === ward && ['in_care','admitted'].includes(p.status));
  const pidSet = new Set(patients.map(p => p.id));
  const mar = h(ctx, 'mar').filter(m => pidSet.has(m.patientId) && sd(m.scheduledAt) >= sinceMs);
  const given = mar.filter(m => m.status === 'given').length;
  const missed = mar.filter(m => m.status === 'missed').length;
  const refused = mar.filter(m => m.status === 'refused').length;
  const late = mar.filter(m => m.lateMinutes && m.lateMinutes > 30).length;
  const highAlertGiven = mar.filter(m => m.isHighAlert && m.status === 'given').length;
  const pending = mar.filter(m => ['scheduled','due'].includes(m.status)).length;
  const compliance = (given + missed + refused) > 0 ? Math.round(given / (given + missed + refused) * 100) : 100;
  const vitals = h(ctx, 'vitals').filter(v => pidSet.has(v.patientId) && sd(v.recordedAt) >= sinceMs);
  const critVitals = vitals.filter(v => v.news2 >= 7).length;
  const io = h(ctx, 'io_records').filter(r => pidSet.has(r.patientId) && sd(r.recordedAt) >= sinceMs);
  const intake = io.filter(r => r.type === 'intake').reduce((s, r) => s + (r.volume || 0), 0);
  const output = io.filter(r => r.type === 'output').reduce((s, r) => s + (r.volume || 0), 0);
  const notes = h(ctx, 'nursing_notes').filter(n => pidSet.has(n.patientId) && sd(n.at) >= sinceMs);
  return {
    shift: { code: shift.code, fa: shift.fa }, ward, since,
    patients: patients.length,
    mar: { total: mar.length, given, missed, refused, late, highAlertGiven, pending, compliance },
    vitals: { total: vitals.length, critical: critVitals },
    io: { intake, output, net: intake - output },
    notes: notes.length,
    pendingTasks: computeTasks(ctx, ward).length,
    generatedAt: ctx.now()
  };
}

function sbarDraft(ctx) {
  const pid = ctx.params.patientId;
  const p = store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  try {
    const nhb = require('./nursing_handoff_bridge');
    if (nhb.handlers && nhb.handlers._aggregate) return nhb.handlers._aggregate(ctx, pid);
  } catch (_) {}
  const vitals = h(ctx, 'vitals').filter(v => v.patientId === pid).sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
  const last = vitals[0] || null;
  const mar = h(ctx, 'mar').filter(m => m.patientId === pid);
  const missed = mar.filter(m => m.status === 'missed').length;
  return {
    patient: { id: p.id, name: p.firstName + ' ' + p.lastName, age: p.age, wardCode: p.wardCode, bedNumber: p.bedNumber, diagnosis: p.diagnosis },
    isbar: {
      situation: { currentIssue: 'پایش روتین', vitals: last ? ('HR ' + (last.hr||'—') + ' · SpO₂ ' + (last.spo2||'—') + '% · NEWS2 ' + (last.news2||'—')) : 'ثبت نشده' },
      background: { reason: p.diagnosis || '' },
      assessment: { diagnoses: [], clinicalImpression: '' },
      recommendation: { followUp: missed > 0 ? missed + ' دوز missed — بازبینی' : 'ادامه مراقبت' }
    },
    note: 'fallback_draft', generatedAt: ctx.now()
  };
}

module.exports = {
  handlers: { myShift, tasks, patientDetail, quickVitals, quickMarGive, quickMarRefuse, quickPrnEffectiveness, quickIO, quickNote, shiftSummary, sbarDraft },
  routes: [
    { method:'GET',  path:'/api/nurse/my-shift',                 handler:'myShift',               perm:'nursing.mode.view' },
    { method:'GET',  path:'/api/nurse/tasks',                    handler:'tasks',                 perm:'nursing.mode.view' },
    { method:'GET',  path:'/api/nurse/patients/:id',             handler:'patientDetail',         perm:'nursing.mode.view' },
    { method:'GET',  path:'/api/nurse/shift-summary',            handler:'shiftSummary',          perm:'nursing.mode.view' },
    { method:'GET',  path:'/api/nurse/sbar/:patientId',          handler:'sbarDraft',             perm:'nursing.mode.view' },
    { method:'POST', path:'/api/nurse/quick/vitals',             handler:'quickVitals',           perm:'vitals.create' },
    { method:'POST', path:'/api/nurse/quick/mar-give',           handler:'quickMarGive',          perm:'kardex.mar.administer' },
    { method:'POST', path:'/api/nurse/quick/mar-refuse',         handler:'quickMarRefuse',        perm:'kardex.mar.administer' },
    { method:'POST', path:'/api/nurse/quick/prn-effectiveness',  handler:'quickPrnEffectiveness',  perm:'kardex.mar.administer' },
    { method:'POST', path:'/api/nurse/quick/io',                 handler:'quickIO',               perm:'kardex.order.execute' },
    { method:'POST', path:'/api/nurse/quick/note',               handler:'quickNote',             perm:'nursing.mode.action' }
  ],
  panels: [
    { id:'shift', title:'کارتابل پرستار', icon:'👩‍⚕️', perm:'nursing.mode.view', kind:'nursing_mode', api:'/api/nurse/my-shift' }
  ]
};
console.log('[nursing_mode] loaded — shift task inbox + quick actions');
