'use strict';
const store = require('../core/store');
const perms = require('../core/permissions');
const neural = require('../core/neural');
const resolver = require('../core/ward-resolver');

if (!perms.P['hub.view']) {
  Object.assign(perms.P, {
    'hub.view': 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,supervisor_er,head_nurse,attending,specialist,surgeon,resident,intern,physician,nurse,nurse_aide,pharmacist,quality_officer'
  });
}

function coll(name) { try { const r = store.readAll(name); return Array.isArray(r) ? r : []; } catch (_) { return []; } }
function sd(x) { if (!x) return 0; const d = new Date(x); return isNaN(d.getTime()) ? 0 : d.getTime(); }
function now() { return Date.now(); }

function myScope(actor) {
  const isCross = perms.isCrossWard(actor.role);
  let scope = null;
  try { scope = perms.resolveScope(actor); } catch (_) {}
  return { isCross: isCross, kind: scope ? scope.kind : 'none', codes: scope ? (scope.codes || []) : [] };
}

function inScope(patient, scope) {
  if (scope.kind === 'all') return true;
  if (scope.kind === 'wards') return scope.codes.indexOf(patient.wardCode) >= 0;
  if (scope.kind === 'services') {
    const svc = patient.serviceCode || (resolver.serviceForWard ? resolver.serviceForWard(patient.wardCode) : null);
    return svc && scope.codes.indexOf(svc) >= 0;
  }
  return false;
}

function getPatientsInScope(ctx) {
  const scope = myScope(ctx.actor);
  const all = coll('patients').filter(function(p) { return ['in_care','admitted'].indexOf(p.status) >= 0; });
  return all.filter(function(p) { return inScope(p, scope); });
}

function computePatientCard(ctx, pid) {
  const p = store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const v = coll('vitals').filter(function(x) { return x.patientId === pid; }).sort(function(a,b) { return sd(b.recordedAt) - sd(a.recordedAt); });
  const last = v[0] || null;
  const orders = coll('orders').filter(function(o) { return o.patientId === pid && ['pending','verified','active'].indexOf(o.status) >= 0; });
  const mar = coll('mar').filter(function(m) { return m.patientId === pid; });
  const nowMs = now();
  const marDue = mar.filter(function(m) { return ['scheduled','due'].indexOf(m.status) >= 0 && sd(m.scheduledAt) < nowMs + 2*3600000; });
  const marOverdue = mar.filter(function(m) { return ['scheduled','due'].indexOf(m.status) >= 0 && sd(m.scheduledAt) < nowMs; });
  const marMissed = mar.filter(function(m) { return m.status === 'missed'; });
  const labs = coll('labs').filter(function(l) { return l.patientId === pid; }).sort(function(a,b) { return sd(b.orderedAt) - sd(a.orderedAt); });
  const rads = coll('radiology').filter(function(r) { return r.patientId === pid; }).sort(function(a,b) { return sd(b.orderedAt) - sd(a.orderedAt); });
  const consults = coll('consults').filter(function(c) { return c.patientId === pid && ['requested','responded'].indexOf(c.status) >= 0; });
  const rounds = coll('encounters').filter(function(e) { return e.patientId === pid && e.type === 'round'; }).sort(function(a,b) { return sd(b.createdAt) - sd(a.createdAt); });
  const ncp = coll('nursing_care_plans').find(function(c) { return c.patientId === pid && c.status === 'active'; });
  const iso = coll('isolations').find(function(i) { return i.patientId === pid && i.status === 'active'; });
  const sepsis = coll('sepsis').filter(function(s) { return s.patientId === pid && ['suspected','confirmed','septic_shock'].indexOf(s.status) >= 0; });
  const handoff = coll('nursing_reports').filter(function(r) { return r.patientId === pid; }).sort(function(a,b) { return sd(b.createdAt) - sd(a.createdAt); })[0];
  const team = coll('care_teams').find(function(t) { return t.patientId === pid; });

  let risk = { score: 0, level: 'lo', explain: [] };
  try { risk = neural.patientRisk(p, { lastVital: last, marMissed: marMissed.length }); } catch (_) {}

  return {
    patient: {
      id: p.id, mrn: p.mrn, name: (p.firstName || '') + ' ' + (p.lastName || ''),
      age: p.age, sex: p.sex, ward: p.wardCode, bed: p.bedNumber,
      diagnosis: p.diagnosis, comorbidities: p.comorbidities || [],
      allergies: p.allergies || [], codeStatus: p.codeStatus,
      admittedAt: p.admittedAt, status: p.status
    },
    risk: { score: risk.score || 0, level: risk.level || 'lo', explain: risk.explain || [] },
    vitals: {
      last: last, trend: v.slice(0, 20),
      hoursSinceLast: last ? Math.round((nowMs - sd(last.recordedAt)) / 3600000 * 10) / 10 : null,
      news2: last ? (last.news2 || 0) : null
    },
    orders: { total: orders.length, pending: orders.filter(function(o){return o.status==='pending';}).length, list: orders.slice(0, 15) },
    mar: { due: marDue.length, overdue: marOverdue.length, missed: marMissed.length, highAlert: marDue.filter(function(m){return m.isHighAlert;}).length, list: marDue.slice(0, 10) },
    labs: { total: labs.length, critical: labs.filter(function(l){return l.criticalFlags && l.criticalFlags.length;}).length, pending: labs.filter(function(l){return ['ordered','collected','in_transit','received'].indexOf(l.status)>=0;}).length, list: labs.slice(0, 5) },
    imaging: { total: rads.length, list: rads.slice(0, 5) },
    consults: { total: consults.length, list: consults },
    rounds: { total: rounds.length, last: rounds[0] || null },
    carePlan: ncp ? { active: (ncp.diagnoses || []).filter(function(d){return d.status==='active';}).length, status: ncp.status } : null,
    isolation: iso ? { type: iso.type, startedAt: iso.startedAt } : null,
    sepsis: { active: sepsis.length > 0, list: sepsis },
    handoff: handoff ? { at: handoff.createdAt, by: handoff.fromUserName || '?' } : null,
    team: team ? { members: (team.members || []).length } : null,
    generatedAt: new Date().toISOString()
  };
}

function buildWorklist(ctx) {
  const actor = ctx.actor;
  const scope = myScope(actor);
  const patients = getPatientsInScope(ctx);
  const pidSet = new Set(patients.map(function(p) { return p.id; }));
  const nowMs = now();
  const tasks = [];

  // MAR due or overdue
  coll('mar').forEach(function(m) {
    if (!pidSet.has(m.patientId)) return;
    if (['scheduled','due'].indexOf(m.status) < 0) return;
    const sched = sd(m.scheduledAt);
    const dueInMin = Math.round((sched - nowMs) / 60000);
    if (dueInMin > 120 || dueInMin < -60) return;
    const overdue = dueInMin < 0;
    const high = m.isHighAlert || false;
    tasks.push({
      type: 'mar', priority: overdue ? 'critical' : (high ? 'high' : 'medium'),
      patientId: m.patientId, patientName: m.patientName,
      title: (m.drugName || '?') + ' ' + (m.dose || ''),
      subtitle: overdue ? 'دیرکرد ' + (-dueInMin) + ' دقیقه' : 'تا ' + dueInMin + ' دقیقه',
      action: 'administer_mar', resourceId: m.id,
      at: m.scheduledAt, isHigh: high
    });
  });

  // Vitals missing
  const lastVitalMap = {};
  coll('vitals').forEach(function(v) {
    if (!pidSet.has(v.patientId)) return;
    if (!lastVitalMap[v.patientId] || sd(v.recordedAt) > sd(lastVitalMap[v.patientId].recordedAt)) lastVitalMap[v.patientId] = v;
  });
  patients.forEach(function(p) {
    const lv = lastVitalMap[p.id];
    const ageH = lv ? (nowMs - sd(lv.recordedAt)) / 3600000 : 999;
    if (ageH > 4) {
      tasks.push({
        type: 'vitals', priority: ageH > 8 ? 'high' : 'medium',
        patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
        title: 'ثبت علائم حیاتی',
        subtitle: ageH > 998 ? 'ثبت نشده' : Math.round(ageH) + ' ساعت پیش',
        action: 'record_vitals'
      });
    }
  });

  // Pending orders (physicians)
  if (['attending','specialist','surgeon','resident','intern','physician','admin'].indexOf(actor.role) >= 0) {
    coll('orders').forEach(function(o) {
      if (!pidSet.has(o.patientId)) return;
      if (o.status !== 'pending') return;
      tasks.push({
        type: 'order_verify', priority: o.priority === 'stat' ? 'critical' : 'medium',
        patientId: o.patientId, patientName: o.patientName,
        title: 'دستور: ' + ((o.details && o.details.drug) || o.type || '?'),
        subtitle: o.priority || 'routine',
        action: 'verify_order', resourceId: o.id
      });
    });
  }

  // Rounds to cosign
  if (['attending','specialist','surgeon','admin'].indexOf(actor.role) >= 0) {
    coll('encounters').forEach(function(e) {
      if (e.type !== 'round' || e.status !== 'pending_cosign') return;
      if (!pidSet.has(e.patientId)) return;
      tasks.push({
        type: 'round_cosign', priority: 'medium',
        patientId: e.patientId, patientName: e.patientName,
        title: 'تأیید راند', subtitle: e.signedByName || '',
        action: 'cosign_round', resourceId: e.id
      });
    });
  }

  // Handoffs pending receive
  coll('signouts').forEach(function(so) {
    if (so.toUserId !== actor.id) return;
    if (so.status !== 'pending') return;
    tasks.push({
      type: 'handoff', priority: 'high',
      title: 'دریافت تحویل', subtitle: so.fromUserName + ' · ' + ((so.patients || []).length) + ' بیمار',
      action: 'receive_handoff', resourceId: so.id
    });
  });

  // Critical labs unacked
  coll('labs').forEach(function(l) {
    if (!pidSet.has(l.patientId)) return;
    if (!l.criticalFlags || !l.criticalFlags.length) return;
    if (l.acknowledgment && l.acknowledgment.acknowledged) return;
    if (['resulted','verified'].indexOf(l.status) < 0) return;
    tasks.push({
      type: 'critical_lab', priority: 'critical',
      patientId: l.patientId, patientName: l.patientName,
      title: 'آزمایش بحرانی: ' + (l.panelName || l.panelCode),
      subtitle: l.criticalFlags.length + ' مورد',
      action: 'acknowledge_lab', resourceId: l.id
    });
  });

  // Consults requested (physicians)
  if (['attending','specialist','surgeon','resident','intern','physician','admin'].indexOf(actor.role) >= 0) {
    coll('consults').forEach(function(c) {
      if (!pidSet.has(c.patientId)) return;
      if (c.status !== 'requested') return;
      tasks.push({
        type: 'consult', priority: c.consultType === 'emergency' ? 'critical' : 'high',
        patientId: c.patientId, patientName: c.patientName,
        title: 'مشاوره: ' + c.targetService,
        subtitle: c.consultType || 'routine',
        action: 'respond_consult', resourceId: c.id
      });
    });
  }

  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  tasks.sort(function(a, b) { return (order[a.priority] || 9) - (order[b.priority] || 9); });

  return {
    tasks: tasks.slice(0, 50),
    counts: {
      critical: tasks.filter(function(t){return t.priority==='critical';}).length,
      high: tasks.filter(function(t){return t.priority==='high';}).length,
      medium: tasks.filter(function(t){return t.priority==='medium';}).length,
      total: tasks.length
    },
    generatedAt: new Date().toISOString()
  };
}

function buildPatientsWithRisk(ctx) {
  const patients = getPatientsInScope(ctx);
  const lastVital = {};
  coll('vitals').forEach(function(v) {
    if (!lastVital[v.patientId] || sd(v.recordedAt) > sd(lastVital[v.patientId].recordedAt)) lastVital[v.patientId] = v;
  });
  const marMissed = {};
  coll('mar').forEach(function(m) { if (m.status === 'missed') marMissed[m.patientId] = (marMissed[m.patientId] || 0) + 1; });

  return patients.map(function(p) {
    let risk = { score: 0, level: 'lo' };
    try { risk = neural.patientRisk(p, { lastVital: lastVital[p.id], marMissed: marMissed[p.id] || 0 }); } catch (_) {}
    return {
      id: p.id, name: p.firstName + ' ' + p.lastName,
      age: p.age, sex: p.sex, ward: p.wardCode, bed: p.bedNumber,
      diagnosis: p.diagnosis, codeStatus: p.codeStatus,
      news2: lastVital[p.id] ? (lastVital[p.id].news2 || 0) : 0,
      lastVitalAt: lastVital[p.id] ? lastVital[p.id].recordedAt : null,
      marMissed: marMissed[p.id] || 0,
      riskScore: risk.score || 0, riskLevel: risk.level || 'lo'
    };
  }).sort(function(a, b) { return b.riskScore - a.riskScore; });
}

const handlers = {
  patientCard: function(ctx) { return computePatientCard(ctx, ctx.params.id); },
  worklist: function(ctx) { return buildWorklist(ctx); },
  patients: function(ctx) { return { items: buildPatientsWithRisk(ctx), generatedAt: new Date().toISOString() }; }
};

module.exports = {
  handlers: handlers,
  routes: [
    { method: 'GET', path: '/api/hub/patient/:id', handler: 'patientCard', perm: 'hub.view' },
    { method: 'GET', path: '/api/hub/worklist',    handler: 'worklist',    perm: 'hub.view' },
    { method: 'GET', path: '/api/hub/patients',    handler: 'patients',    perm: 'hub.view' }
  ],
  panels: [
    { id: 'dashboard', title: 'کارتابل بالینی', icon: '🩺',
      perm: 'hub.view', kind: 'clinical_hub', api: '/api/hub/worklist' }
  ]
};
console.log('[clinical_hub] backend loaded');
