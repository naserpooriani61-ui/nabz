'use strict';
const store = require('../core/store');
const perms = require('../core/permissions');
const neural = require('../core/neural');
const resolver = require('../core/ward-resolver');

if (!perms.P['rounds.hub.view']) {
  Object.assign(perms.P, {
    'rounds.hub.view': 'admin,hospital_director,medical_director,attending,specialist,surgeon,resident,intern,physician,nursing_director,supervisor_senior,supervisor_clinical,head_nurse,quality_officer'
  });
}

function coll(n) { try { var r = store.readAll(n); return Array.isArray(r) ? r : []; } catch (_) { return []; } }
function sd(x) { if (!x) return 0; var d = new Date(x); return isNaN(d.getTime()) ? 0 : d.getTime(); }

function inScope(p, scope) {
  if (scope.kind === 'all') return true;
  if (scope.kind === 'wards') return scope.codes.indexOf(p.wardCode) >= 0;
  if (scope.kind === 'services') {
    var svc = p.serviceCode || (resolver.serviceForWard ? resolver.serviceForWard(p.wardCode) : null);
    return svc && scope.codes.indexOf(svc) >= 0;
  }
  return false;
}

function queue(ctx) {
  var scope = { kind: 'none' };
  try { scope = perms.resolveScope(ctx.actor); } catch (_) {}
  var all = coll('patients').filter(function(p) { return ['in_care','admitted'].indexOf(p.status) >= 0; });
  var pts = all.filter(function(p) { return inScope(p, scope); });
  var pidSet = new Set(pts.map(function(p) { return p.id; }));
  var nowMs = Date.now();
  var rounds = coll('encounters').filter(function(e) { return e.type === 'round' && pidSet.has(e.patientId); });
  var lastRound = {};
  rounds.forEach(function(r) { if (!lastRound[r.patientId] || sd(r.createdAt) > sd(lastRound[r.patientId].createdAt)) lastRound[r.patientId] = r; });
  var lastVital = {};
  coll('vitals').forEach(function(v) { if (pidSet.has(v.patientId) && (!lastVital[v.patientId] || sd(v.recordedAt) > sd(lastVital[v.patientId].recordedAt))) lastVital[v.patientId] = v; });
  var sepsisPids = new Set(coll('sepsis').filter(function(s) { return pidSet.has(s.patientId) && ['suspected','confirmed','septic_shock'].indexOf(s.status) >= 0; }).map(function(s) { return s.patientId; }));
  var critPids = new Set(coll('labs').filter(function(l) { return pidSet.has(l.patientId) && l.criticalFlags && l.criticalFlags.length && (!l.acknowledgment || !l.acknowledgment.acknowledged); }).map(function(l) { return l.patientId; }));

  var items = pts.map(function(p) {
    var lr = lastRound[p.id];
    var lv = lastVital[p.id];
    var sinceRoundH = lr ? (nowMs - sd(lr.createdAt)) / 3600000 : null;
    var lastVitalH = lv ? (nowMs - sd(lv.recordedAt)) / 3600000 : null;
    var news = lv ? (lv.news2 || 0) : 0;
    var risk = { score: 0, level: 'lo' };
    try { risk = neural.patientRisk(p, { lastVital: lv }); } catch (_) {}
    var pr = 0, reason = 'راند دوره‌ای';
    if (sepsisPids.has(p.id)) { pr += 100; reason = 'سپسیس فعال'; }
    if (critPids.has(p.id)) { pr += 80; if (pr === 80) reason = 'آزمایش بحرانی'; }
    if (news >= 7) { pr += 60; if (pr <= 60) reason = 'NEWS2 بحرانی'; }
    else if (news >= 5) { pr += 30; if (pr <= 30) reason = 'NEWS2 بالا'; }
    if (sinceRoundH === null) { pr += 25; if (pr <= 25) reason = 'بیمار جدید'; }
    else if (sinceRoundH > 24) { pr += 25; if (pr <= 25) reason = 'بدون راند ۲۴h'; }
    else if (sinceRoundH > 12) pr += 15;
    if (risk.score >= 60) pr += 20;
    else if (risk.score >= 30) pr += 10;
    return {
      id: p.id, name: (p.firstName||'') + ' ' + (p.lastName||''),
      age: p.age, sex: p.sex, ward: p.wardCode, bed: p.bedNumber,
      diagnosis: p.diagnosis, codeStatus: p.codeStatus,
      allergies: p.allergies || [],
      news2: news, lastVitalHours: lastVitalH !== null ? Math.round(lastVitalH) : null,
      hoursSinceRound: sinceRoundH !== null ? Math.round(sinceRoundH) : null,
      lastRoundBy: lr ? (lr.authorName || '?') : null,
      lastRoundStatus: lr ? lr.status : null,
      hasSepsis: sepsisPids.has(p.id), hasCriticalLab: critPids.has(p.id),
      riskScore: risk.score || 0, riskLevel: risk.level || 'lo',
      priority: pr, reason: reason
    };
  }).sort(function(a, b) { return b.priority - a.priority; });
  return {
    items: items, total: items.length,
    stats: {
      withSepsis: sepsisPids.size,
      withCriticalLab: critPids.size,
      withoutRound24h: items.filter(function(x) { return x.hoursSinceRound === null || x.hoursSinceRound > 24; }).length,
      newPatients: items.filter(function(x) { return x.hoursSinceRound === null; }).length
    },
    generatedAt: new Date().toISOString()
  };
}

function patientContext(ctx) {
  var pid = ctx.params.patientId;
  var p = store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  var vitals = coll('vitals').filter(function(v) { return v.patientId === pid; }).sort(function(a,b) { return sd(b.recordedAt) - sd(a.recordedAt); });
  var last = vitals[0] || null;
  var orders = coll('orders').filter(function(o) { return o.patientId === pid && ['pending','verified','active'].indexOf(o.status) >= 0; });
  var mar = coll('mar').filter(function(m) { return m.patientId === pid; });
  var missedMar = mar.filter(function(m) { return m.status === 'missed'; });
  var dueMar = mar.filter(function(m) { return ['scheduled','due'].indexOf(m.status) >= 0; });
  var labs = coll('labs').filter(function(l) { return l.patientId === pid && ['resulted','verified'].indexOf(l.status) >= 0; }).sort(function(a,b) { return sd(b.orderedAt) - sd(a.orderedAt); }).slice(0, 10);
  var critLabs = labs.filter(function(l) { return l.criticalFlags && l.criticalFlags.length; });
  var rads = coll('radiology').filter(function(r) { return r.patientId === pid && ['reported','verified'].indexOf(r.status) >= 0; }).sort(function(a,b) { return sd(b.orderedAt) - sd(a.orderedAt); }).slice(0, 5);
  var consults = coll('consults').filter(function(c) { return c.patientId === pid && ['requested','responded','approved'].indexOf(c.status) >= 0; });
  var prevRounds = coll('encounters').filter(function(e) { return e.type === 'round' && e.patientId === pid; }).sort(function(a,b) { return sd(b.createdAt) - sd(a.createdAt); }).slice(0, 5);
  var lastRound = prevRounds[0] || null;
  var ncp = coll('nursing_care_plans').find(function(c) { return c.patientId === pid && c.status === 'active'; });
  var iso = coll('isolations').find(function(i) { return i.patientId === pid && i.status === 'active'; });
  var sepsis = coll('sepsis').filter(function(s) { return s.patientId === pid && ['suspected','confirmed','septic_shock'].indexOf(s.status) >= 0; });
  var since24 = Date.now() - 86400000;
  var io = coll('io_records').filter(function(r) { return r.patientId === pid && sd(r.recordedAt) >= since24; });
  var intake = io.filter(function(r) { return r.type === 'intake'; }).reduce(function(s, r) { return s + (r.volume || 0); }, 0);
  var output = io.filter(function(r) { return r.type === 'output'; }).reduce(function(s, r) { return s + (r.volume || 0); }, 0);
  var risk = { score: 0, level: 'lo', explain: [] };
  try { risk = neural.patientRisk(p, { lastVital: last, marMissed: missedMar.length }); } catch (_) {}
  var lrS = lastRound && lastRound.subjective || {};
  var lrA = lastRound && lastRound.assessment || {};
  var lrP = lastRound && lastRound.plan || {};
  var autoFill = {
    chiefComplaint: lrS.chiefComplaint || p.diagnosis || '',
    history: lrS.history || '',
    vitalsText: last ? ('HR ' + (last.hr||'-') + ' / BP ' + (last.bp_sys||'-') + '/' + (last.bp_dia||'-') + ' / RR ' + (last.rr||'-') + ' / T ' + (last.temp||'-') + ' / SpO2 ' + (last.spo2||'-') + '% / NEWS2 ' + (last.news2||0)) : 'ثبت نشده',
    impression: lrA.clinicalImpression || '',
    planDiet: lrP.diet || '',
    planActivity: lrP.activity || ''
  };
  return {
    patient: {
      id: p.id, mrn: p.mrn, name: (p.firstName||'') + ' ' + (p.lastName||''),
      age: p.age, sex: p.sex, ward: p.wardCode, bed: p.bedNumber,
      diagnosis: p.diagnosis, comorbidities: p.comorbidities || [],
      allergies: p.allergies || [], codeStatus: p.codeStatus,
      admittedAt: p.admittedAt, admissionType: p.admissionType
    },
    vitals: { last: last, count24h: vitals.filter(function(v) { return sd(v.recordedAt) > since24; }).length },
    labs: labs, criticalLabs: critLabs, imaging: rads,
    orders: { total: orders.length, pending: orders.filter(function(o){return o.status==='pending';}).length, list: orders.slice(0, 10) },
    mar: { due: dueMar.length, missed: missedMar.length, highAlert: dueMar.filter(function(m){return m.isHighAlert;}).length },
    consults: consults, previousRounds: prevRounds,
    carePlan: ncp ? { active: (ncp.diagnoses || []).filter(function(d){return d.status==='active';}).length } : null,
    isolation: iso ? { type: iso.type } : null,
    sepsis: { active: sepsis.length > 0, list: sepsis },
    io: { intake: intake, output: output, net: intake - output },
    risk: risk, autoFill: autoFill,
    generatedAt: new Date().toISOString()
  };
}

function suggestSets(ctx) {
  var pid = ctx.params.patientId;
  var p = store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  var dx = String(p.diagnosis || '').toLowerCase();
  var com = (p.comorbidities || []).map(function(c) { return String(c).toLowerCase(); });
  var sets = null;
  try { sets = require('./encounters')._orderSets; } catch (_) {}
  if (!sets) return { items: [], total: 0 };
  var lastVital = coll('vitals').filter(function(v){return v.patientId===pid;}).sort(function(a,b){return sd(b.recordedAt)-sd(a.recordedAt);})[0] || {};
  var DX_MAP = {
    'stemi': ['stemi'], 'mi': ['stemi','nstemi'], 'سکته قلبی': ['stemi','nstemi'],
    'nstemi': ['nstemi'], 'acs': ['stemi','nstemi'],
    'sepsis': ['sepsis'], 'septic': ['sepsis'], 'سپسیس': ['sepsis'],
    'dka': ['dka'], 'ketoacid': ['dka'], 'کتواسیدوز': ['dka'],
    'pneumonia': ['pneumonia','hap'], 'پنومونی': ['pneumonia','hap'],
    'copd': ['copd_exac'], 'asthma': ['asthma_exac'], 'آسم': ['asthma_exac'],
    'stroke': ['stroke'], 'cva': ['stroke'], 'سکته مغزی': ['stroke'],
    'ich': ['ich'], 'خونریزی مغزی': ['ich'],
    'chf': ['chf_exac'], 'heart failure': ['chf_exac'], 'نارسایی قلب': ['chf_exac'],
    'af': ['af_rvr'], 'atrial fibrillation': ['af_rvr'], 'فیبریلاسیون': ['af_rvr'],
    'aki': ['aki'], 'renal': ['aki'], 'نارسایی کلیه': ['aki'],
    'gi bleed': ['gi_bleed'], 'خونریزی گوارشی': ['gi_bleed'],
    'pancreatitis': ['pancreatitis'], 'پانکراتیت': ['pancreatitis'],
    'pe': ['pe'], 'pulmonary embolism': ['pe'], 'آمبولی ریه': ['pe'],
    'dvt': ['dvt'], 'hyperkalemia': ['hyperkalemia']
  };
  var suggested = {};
  Object.keys(DX_MAP).forEach(function(k) {
    var hit = dx.indexOf(k) >= 0 || com.some(function(c){return c.indexOf(k) >= 0;});
    if (hit) DX_MAP[k].forEach(function(sid) {
      if (!suggested[sid]) suggested[sid] = { id: sid, reasons: [], score: 0 };
      suggested[sid].reasons.push('تشخیص: ' + k);
      suggested[sid].score += 50;
    });
  });
  var news = lastVital.news2 || 0;
  if (news >= 7) ['sepsis','stroke','ich'].forEach(function(sid) {
    if (!suggested[sid]) suggested[sid] = { id: sid, reasons: [], score: 0 };
    suggested[sid].reasons.push('NEWS2 ' + news);
    suggested[sid].score += 25;
  });
  else if (news >= 5) ['sepsis'].forEach(function(sid) {
    if (!suggested[sid]) suggested[sid] = { id: sid, reasons: [], score: 0 };
    suggested[sid].reasons.push('NEWS2 ' + news);
    suggested[sid].score += 15;
  });
  if (lastVital.spo2 && lastVital.spo2 < 92) ['pe','pneumonia','hap'].forEach(function(sid) {
    if (!suggested[sid]) suggested[sid] = { id: sid, reasons: [], score: 0 };
    suggested[sid].reasons.push('SpO2 ' + lastVital.spo2 + '%');
    suggested[sid].score += 15;
  });
  var items = Object.keys(suggested).map(function(sid) {
    var s = suggested[sid];
    var meta = sets[sid] || {};
    return {
      id: sid, name: meta.name || sid, icon: meta.icon || '💊',
      category: meta.category || 'other',
      timeCritical: !!meta.timeCritical, timeCriticalMinutes: meta.timeCriticalMinutes,
      totalMeds: (meta.meds || []).length,
      score: s.score, reasons: s.reasons
    };
  }).sort(function(a, b) { return b.score - a.score; }).slice(0, 8);
  return { items: items, total: items.length };
}

module.exports = {
  handlers: { queue: queue, context: patientContext, suggestSets: suggestSets },
  routes: [
    { method: 'GET', path: '/api/rounds/queue', handler: 'queue', perm: 'rounds.hub.view' },
    { method: 'GET', path: '/api/rounds/context/:patientId', handler: 'context', perm: 'rounds.hub.view' },
    { method: 'GET', path: '/api/rounds/suggest/:patientId', handler: 'suggestSets', perm: 'rounds.hub.view' }
  ],
  panels: [
    { id: 'hub', title: 'راند پزشکی', icon: '✍️',
      perm: 'rounds.hub.view', kind: 'rounds_hub', api: '/api/rounds/queue' }
  ]
};
console.log('[rounds_hub] backend loaded');
