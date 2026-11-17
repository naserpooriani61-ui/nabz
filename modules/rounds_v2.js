'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Rounds Mode v2 (S3, مافوق تخصصی)
//  - Scope-aware queue (attending: service, resident: ward)
//  - 5-layer priority (neglect + acuity + critical-lab + sepsis + new-admit)
//  - SOAP auto-fill from last round + vitals + labs + MAR + nursing notes
//  - Cosign independence (JCI: attending ≠ resident)
//  - Timeline (rounds+orders+labs+consults+discharge)
//  - OrderSet with safety + time-critical flags
// ═══════════════════════════════════════════════════════════
const orderWriter = require('../core/domain/order-writer');
const { h, sd } = require('../core/mod-helpers');
const bus = require('../core/events');
const store = require('../core/store');
const perms = require('../core/permissions');
const resolver = require('../core/ward-resolver');

if (!perms.P['rounds.v2.view']) {
  perms.P['rounds.v2.view'] = 'admin,hospital_director,medical_director,attending,specialist,surgeon,resident,intern,physician,nursing_director,supervisor_senior,supervisor_clinical,head_nurse,quality_officer';
  perms.P['rounds.v2.create'] = 'admin,attending,specialist,surgeon,resident,intern,physician';
  perms.P['rounds.v2.sign'] = 'admin,attending,specialist,surgeon,resident,intern,physician';
  perms.P['rounds.v2.cosign'] = 'admin,attending,specialist,surgeon';
}

function actorScope(actor) {
  try {
    const s = resolver.resolveUserScope ? resolver.resolveUserScope(actor, perms.isCrossWard(actor.role)) : null;
    if (s) return s;
  } catch (_) {}
  return { kind: 'none', reason: 'unresolved' };
}

function inScope(patient, scope) {
  if (scope.kind === 'all') return true;
  if (scope.kind === 'wards') return scope.codes.includes(patient.wardCode);
  if (scope.kind === 'services') {
    const svc = patient.serviceCode || (resolver.serviceForWard ? resolver.serviceForWard(patient.wardCode) : null);
    return svc && scope.codes.includes(svc);
  }
  return false;
}

function lastVitalsMap() {
  const map = {};
  for (const v of store.readAll('vitals')) {
    if (!map[v.patientId] || sd(v.recordedAt) > sd(map[v.patientId].recordedAt)) map[v.patientId] = v;
  }
  return map;
}

function lastRoundMap() {
  const map = {};
  for (const e of store.readAll('encounters')) {
    if (e.type !== 'round') continue;
    if (!map[e.patientId] || sd(e.createdAt) > sd(map[e.patientId].createdAt)) map[e.patientId] = e;
  }
  return map;
}

// ═══ 5-layer priority (0-100) ═══
function computePriority(patient, ctx) {
  const reasons = [];
  let score = 0;

  // Layer 1 — Neglect (hours since last round)
  const hoursSince = ctx.lastRound ? (Date.now() - sd(ctx.lastRound.createdAt)) / 3600000 : null;
  if (hoursSince === null) { score += 25; reasons.push('بیمار جدید — بدون راند'); }
  else if (hoursSince > 48) { score += 30; reasons.push(Math.round(hoursSince) + 'h بدون راند'); }
  else if (hoursSince > 24) { score += 20; reasons.push(Math.round(hoursSince) + 'h بدون راند'); }
  else if (hoursSince > 12) { score += 8; }

  // Layer 2 — Acuity (NEWS2)
  const news2 = ctx.lastVital ? (ctx.lastVital.news2 || 0) : 0;
  if (news2 >= 9) { score += 40; reasons.push('NEWS2 ' + news2 + ' بحرانی'); }
  else if (news2 >= 7) { score += 30; reasons.push('NEWS2 ' + news2); }
  else if (news2 >= 5) { score += 15; reasons.push('NEWS2 ' + news2); }

  // Layer 3 — Critical lab unacknowledged
  const critLabs = ctx.criticalLabs || [];
  if (critLabs.length > 0) { score += 20; reasons.push(critLabs.length + ' lab بحرانی'); }

  // Layer 4 — Sepsis active
  if (ctx.sepsisActive) { score += 35; reasons.push('سپسیس فعال'); }

  // Layer 5 — New admit (<24h)
  if (ctx.admittedAt && sd(ctx.admittedAt) > Date.now() - 86400000) { score += 15; reasons.push('پذیرش <۲۴h'); }

  // Bonuses
  if (ctx.missedMar > 0) { score += Math.min(15, ctx.missedMar * 5); reasons.push(ctx.missedMar + ' دوز missed'); }

  // DNR/DNI reduces intervention urgency
  if (patient.codeStatus === 'dnr' || patient.codeStatus === 'dni') { score -= 10; reasons.push('DNR/DNI — تمرکز آسایش'); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low';
  return { score, level, reasons, hoursSinceLastRound: hoursSince !== null ? Math.round(hoursSince) : null, news2 };
}

// ═══ SOAP auto-fill from clinical data ═══
function buildSoapAutoFill(patient, context) {
  const { lastRound, lastVital, labs, mar, nursingNotes, orders, consults, radiology, sepsis } = context;

  // S — Subjective
  const lr = lastRound || {};
  const lrSubj = lr.subjective || {};
  const intervalNotes = (nursingNotes || [])
    .filter(n => sd(n.at) > sd(lr.createdAt || 0))
    .slice(-10)
    .map(n => '• ' + n.byName + ': ' + n.text);
  const subjective = {
    chiefComplaint: lrSubj.chiefComplaint || patient.diagnosis || '',
    history: lrSubj.history || '',
    intervalHistory: intervalNotes.join('\n'),
    reviewOfSystems: lrSubj.reviewOfSystems || ''
  };

  // O — Objective
  const vitalsLine = lastVital ? ('HR ' + (lastVital.hr||'—') + ' · BP ' + (lastVital.bp_sys||'—') + '/' + (lastVital.bp_dia||'—') + ' · RR ' + (lastVital.rr||'—') + ' · T ' + (lastVital.temp||'—') + '° · SpO₂ ' + (lastVital.spo2||'—') + '% · NEWS2 ' + (lastVital.news2||'—')) : 'ثبت نشده';
  const newLabs = (labs || []).filter(l => sd(l.resultedAt) > sd(lr.createdAt || 0)).slice(0, 8);
  const newImaging = (radiology || []).filter(r => sd(r.reportedAt) > sd(lr.createdAt || 0)).slice(0, 3);
  const marSince = (mar || []).filter(m => sd(m.administeredAt) > sd(lr.createdAt || 0));
  const marAdherence = {
    given: marSince.filter(m => m.status === 'given').length,
    missed: marSince.filter(m => m.status === 'missed').length,
    refused: marSince.filter(m => m.status === 'refused').length,
    highAlert: marSince.filter(m => m.isHighAlert && m.status === 'given').length
  };
  const objective = {
    physicalExam: (lr.objective && lr.objective.physicalExam) || '',
    vitalsLine,
    vitals: lastVital ? { hr: lastVital.hr, bp: (lastVital.bp_sys||'—') + '/' + (lastVital.bp_dia||'—'), rr: lastVital.rr, temp: lastVital.temp, spo2: lastVital.spo2, news2: lastVital.news2, at: lastVital.recordedAt } : null,
    newLabs: newLabs.map(l => ({ id: l.id, panel: l.panelName || l.panelCode, at: l.resultedAt, critical: !!(l.criticalFlags && l.criticalFlags.length), results: l.results || {} })),
    newImaging: newImaging.map(r => ({ id: r.id, modality: r.modality, bodyPart: r.bodyPart, impression: r.impression || '', at: r.reportedAt, critical: !!r.criticalFlag })),
    marAdherence,
    additionalNotes: (lr.objective && lr.objective.additionalNotes) || ''
  };

  // A — Assessment
  const lrAsmt = lr.assessment || {};
  const flags = [];
  if (lastVital && lastVital.news2 >= 7) flags.push({ level: 'critical', text: 'NEWS2 ≥ 7' });
  else if (lastVital && lastVital.news2 >= 5) flags.push({ level: 'warning', text: 'NEWS2 5-6' });
  const critLabs = (labs || []).filter(l => l.criticalFlags && l.criticalFlags.length && !(l.acknowledgment && l.acknowledgment.acknowledged));
  if (critLabs.length > 0) flags.push({ level: 'critical', text: critLabs.length + ' lab بحرانی' });
  if (marAdherence.missed > 0) flags.push({ level: 'warning', text: marAdherence.missed + ' دوز missed' });
  if (sepsis && sepsis.length > 0) flags.push({ level: 'critical', text: 'سپسیس فعال' });
  if (newLabs.some(l => l.critical)) flags.push({ level: 'critical', text: 'lab جدید بحرانی' });
  const assessment = {
    diagnoses: (lrAsmt.diagnoses || [patient.diagnosis]).filter(Boolean),
    clinicalImpression: lrAsmt.clinicalImpression || '',
    differential: lrAsmt.differential || [],
    severity: lrAsmt.severity || '',
    flags
  };

  // P — Plan (carry-forward last round's plan, then user can edit)
  const lrPlan = lr.plan || {};
  const plan = {
    medications: lrPlan.medications || [],
    labs: lrPlan.labs || [],
    imaging: lrPlan.imaging || [],
    consults: lrPlan.consults || [],
    nursing: lrPlan.nursing || [],
    diet: lrPlan.diet || '',
    activity: lrPlan.activity || '',
    education: lrPlan.education || ''
  };

  return { subjective, objective, assessment, plan };
}

// ═══ HANDLERS ═══
function queue(ctx) {
  const scope = actorScope(ctx.actor);
  const patients = store.readAll('patients').filter(p => ['in_care','admitted'].includes(p.status) && inScope(p, scope));
  const vmap = lastVitalsMap();
  const rmap = lastRoundMap();
  const labs = store.readAll('labs');
  const mar = store.readAll('mar');
  const sepsis = store.readAll('sepsis');
  const pidSet = new Set(patients.map(p => p.id));
  const critByP = {};
  labs.forEach(l => {
    if (!pidSet.has(l.patientId)) return;
    if (!l.criticalFlags || !l.criticalFlags.length) return;
    if (l.acknowledgment && l.acknowledgment.acknowledged) return;
    critByP[l.patientId] = (critByP[l.patientId] || 0) + 1;
  });
  const missedByP = {};
  mar.forEach(m => { if (m.status === 'missed' && pidSet.has(m.patientId)) missedByP[m.patientId] = (missedByP[m.patientId] || 0) + 1; });
  const sepsisByP = {};
  sepsis.forEach(s => { if (['suspected','confirmed','septic_shock'].includes(s.status) && pidSet.has(s.patientId)) sepsisByP[s.patientId] = true; });

  const items = patients.map(p => {
    const ctx2 = { lastVital: vmap[p.id], lastRound: rmap[p.id], criticalLabs: critByP[p.id] ? new Array(critByP[p.id]).fill(1) : [], sepsisActive: !!sepsisByP[p.id], admittedAt: p.admittedAt, missedMar: missedByP[p.id] || 0 };
    const pr = computePriority(p, ctx2);
    return {
      id: p.id, name: p.firstName + ' ' + p.lastName, age: p.age, sex: p.sex,
      ward: p.wardCode, bed: p.bedNumber, diagnosis: p.diagnosis, codeStatus: p.codeStatus,
      serviceCode: p.serviceCode || (resolver.serviceForWard ? resolver.serviceForWard(p.wardCode) : null),
      priority: pr,
      lastVital: vmap[p.id] ? { news2: vmap[p.id].news2, spo2: vmap[p.id].spo2, hr: vmap[p.id].hr, at: vmap[p.id].recordedAt } : null,
      lastRound: rmap[p.id] ? { id: rmap[p.id].id, at: rmap[p.id].createdAt, by: rmap[p.id].authorName, status: rmap[p.id].status } : null
    };
  }).sort((a, b) => b.priority.score - a.priority.score);

  return {
    items, total: items.length,
    scope: { kind: scope.kind, codes: scope.codes || [] },
    stats: { critical: items.filter(i => i.priority.level === 'critical').length, high: items.filter(i => i.priority.level === 'high').length, medium: items.filter(i => i.priority.level === 'medium').length },
    generatedAt: ctx.now()
  };
}

function context(ctx) {
  const pid = ctx.params.patientId;
  const p = store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const vitals = store.readAll('vitals').filter(v => v.patientId === pid).sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
  const lastVital = vitals[0] || null;
  const rounds = store.readAll('encounters').filter(e => e.patientId === pid && e.type === 'round').sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  const lastRound = rounds[0] || null;
  const labs = store.readAll('labs').filter(l => l.patientId === pid).sort((a, b) => sd(b.resultedAt || b.orderedAt) - sd(a.resultedAt || a.orderedAt));
  const mar = store.readAll('mar').filter(m => m.patientId === pid);
  const orders = store.readAll('orders').filter(o => o.patientId === pid && ['pending','verified','active'].includes(o.status));
  const consults = store.readAll('consults').filter(c => c.patientId === pid && ['requested','responded','approved'].includes(c.status));
  const radiology = store.readAll('radiology').filter(r => r.patientId === pid).sort((a, b) => sd(b.reportedAt || b.orderedAt) - sd(a.reportedAt || a.orderedAt));
  const nursingNotes = store.readAll('nursing_notes').filter(n => n.patientId === pid).sort((a, b) => sd(b.at) - sd(a.at)).slice(0, 30);
  const sepsisActive = store.readAll('sepsis').filter(s => s.patientId === pid && ['suspected','confirmed','septic_shock'].includes(s.status));
  const isolation = store.readAll('isolations').find(i => i.patientId === pid && i.status === 'active');
  const ncp = store.readAll('nursing_care_plans').find(n => n.patientId === pid && n.status === 'active');

  const ctxForFill = { lastRound, lastVital, labs, mar, nursingNotes, orders, consults, radiology, sepsis: sepsisActive };
  const autoFill = buildSoapAutoFill(p, ctxForFill);
  const pr = computePriority(p, { lastRound, lastVital, criticalLabs: labs.filter(l => l.criticalFlags && l.criticalFlags.length && !(l.acknowledgment && l.acknowledgment.acknowledged)), sepsisActive: sepsisActive.length > 0, admittedAt: p.admittedAt, missedMar: mar.filter(m => m.status === 'missed').length });

  return {
    patient: { id: p.id, mrn: p.mrn, name: p.firstName + ' ' + p.lastName, age: p.age, sex: p.sex, ward: p.wardCode, bed: p.bedNumber, diagnosis: p.diagnosis, comorbidities: p.comorbidities || [], allergies: p.allergies || [], codeStatus: p.codeStatus, admittedAt: p.admittedAt, serviceCode: p.serviceCode || null },
    lastVital, priority: pr, autoFill,
    previousRounds: rounds.slice(0, 5).map(r => ({ id: r.id, at: r.createdAt, by: r.authorName, role: r.authorRole, status: r.status, impression: (r.assessment && r.assessment.clinicalImpression) || '' })),
    ordersSummary: { total: orders.length, stat: orders.filter(o => o.priority === 'stat').length },
    consultsActive: consults.length,
    isolation: isolation ? { type: isolation.type, startedAt: isolation.startedAt } : null,
    sepsisActive: sepsisActive.length > 0,
    carePlan: ncp ? { activeDiagnoses: (ncp.diagnoses || []).filter(d => d.status === 'active').length } : null,
    generatedAt: ctx.now()
  };
}

function createRound(ctx) {
  const b = ctx.body || {};
  if (!b.patientId) throw ctx.E.badRequest('patient_id_required');
  const p = store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const rec = {
    id: ctx.uid('enc'), type: 'round',
    patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode, bedNumber: p.bedNumber,
    date: ctx.now().slice(0, 10), subtype: b.subtype || 'morning',
    authorId: ctx.actor.id, authorName: ctx.actor.fullName || ctx.actor.username, authorRole: ctx.actor.role,
    subjective: b.subjective || { chiefComplaint: '', history: '', reviewOfSystems: '' },
    objective: b.objective || { physicalExam: '', additionalNotes: '' },
    assessment: b.assessment || { diagnoses: [], clinicalImpression: '', differential: [], severity: '' },
    plan: b.plan || { medications: [], labs: [], imaging: [], consults: [], nursing: [], diet: '', activity: '', education: '' },
    status: 'draft',
    cosignRequired: ['resident','intern'].includes(ctx.actor.role),
    createdAt: ctx.now(), updatedAt: ctx.now()
  };
  store.put('encounters', rec);
  ctx.audit.write('rounds_v2', 'round.create', rec.id, ctx.actor, { patientId: p.id });
  ctx.bus.emit('encounter.round.created', { record: rec, actor: ctx.actor });
  return rec;
}

function updateRound(ctx) {
  const r = store.get('encounters', ctx.params.roundId);
  if (!r) throw ctx.E.notFound('round_not_found');
  if (r.status !== 'draft') throw ctx.E.conflict('not_draft');
  if (r.authorId !== ctx.actor.id && ctx.actor.role !== 'admin') throw ctx.E.forbidden('not_author');
  const b = ctx.body || {};
  ['subtype','subjective','objective','assessment','plan'].forEach(k => { if (b[k]) r[k] = Object.assign(r[k] || {}, b[k]); });
  r.updatedAt = ctx.now();
  store.put('encounters', r);
  return r;
}

function signRound(ctx) {
  const r = store.get('encounters', ctx.params.roundId);
  if (!r) throw ctx.E.notFound('round_not_found');
  if (r.status !== 'draft') throw ctx.E.conflict('not_draft');
  if (r.authorId !== ctx.actor.id && ctx.actor.role !== 'admin') throw ctx.E.forbidden('not_author');
  const s = r.subjective || {}; const a = r.assessment || {};
  if (!s.chiefComplaint && !a.clinicalImpression) throw ctx.E.badRequest('at_least_chief_complaint_or_assessment');
  const needsCosign = ['resident','intern'].includes(ctx.actor.role);
  r.signedAt = ctx.now(); r.signedBy = ctx.actor.id;
  r.signedByName = ctx.actor.fullName || ctx.actor.username;
  r.status = needsCosign ? 'pending_cosign' : 'signed';
  if (!needsCosign) r.cosignRequired = false;
  store.put('encounters', r);
  ctx.audit.write('rounds_v2', 'round.sign', r.id, ctx.actor, { patientId: r.patientId, needsCosign });
  ctx.bus.emit('encounter.round.signed', { record: r, actor: ctx.actor, needsCosign });
  if (needsCosign) {
    const attendings = store.readAll('users').filter(u => ['attending','specialist'].includes(u.role) && u.ward === r.wardCode && u.active !== false);
    for (const at of attendings) {
      try { store.put('sa_notifications', { id: ctx.uid('san'), userId: at.id, title: '✍️ نیاز به cosign راند', body: r.patientName + ' — ' + r.signedByName, type: 'info', read: false, createdAt: ctx.now(), link: 'rounds_v2.hub' }); } catch (_) {}
    }
  }
  return r;
}

function cosignRound(ctx) {
  const r = store.get('encounters', ctx.params.roundId);
  if (!r) throw ctx.E.notFound('round_not_found');
  if (r.status !== 'pending_cosign') throw ctx.E.conflict('not_pending_cosign');
  if (!['attending','specialist','admin'].includes(ctx.actor.role)) throw ctx.E.forbidden('attending_only');
  if (r.signedBy === ctx.actor.id) throw ctx.E.conflict('cannot_cosign_own');
  r.cosignedBy = ctx.actor.id;
  r.cosignedByName = ctx.actor.fullName || ctx.actor.username;
  r.cosignedAt = ctx.now();
  r.status = 'signed';
  store.put('encounters', r);
  ctx.audit.write('rounds_v2', 'round.cosign', r.id, ctx.actor, { patientId: r.patientId });
  ctx.bus.emit('encounter.round.cosigned', { record: r, actor: ctx.actor });
  return r;
}

function pendingCosign(ctx) {
  const scope = actorScope(ctx.actor);
  const items = store.readAll('encounters').filter(e => e.type === 'round' && e.status === 'pending_cosign' && e.signedBy !== ctx.actor.id);
  const inScope2 = items.filter(e => {
    const p = store.get('patients', e.patientId);
    if (!p) return false;
    if (ctx.actor.role === 'admin') return true;
    if (scope.kind === 'all') return true;
    if (scope.kind === 'wards') return scope.codes.includes(p.wardCode);
    return false;
  });
  inScope2.sort((a, b) => sd(b.signedAt) - sd(a.signedAt));
  return { items: inScope2.slice(0, 50), total: inScope2.length };
}

function myRounds(ctx) {
  const items = store.readAll('encounters').filter(e => e.type === 'round' && e.authorId === ctx.actor.id).sort((a, b) => sd(b.createdAt) - sd(a.createdAt)).slice(0, 50);
  return { items, total: items.length };
}

function patientRounds(ctx) {
  const pid = ctx.params.patientId;
  const items = store.readAll('encounters').filter(e => e.patientId === pid && e.type === 'round').sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  return { items, total: items.length };
}

function timeline(ctx) {
  const pid = ctx.params.patientId;
  const p = store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const events = [];
  function add(type, icon, title, at, detail, color) {
    if (!at) return;
    events.push({ type, icon, title, at, detail: detail || '', color: color || '' });
  }
  store.readAll('encounters').filter(e => e.patientId === pid && e.type === 'round').forEach(r => {
    const imp = (r.assessment && r.assessment.clinicalImpression) || '';
    const st = r.status === 'pending_cosign' ? 'warn' : r.status === 'signed' ? 'ok' : '';
    add('round', '📝', 'راند (' + r.subtype + ') — ' + r.authorName, r.signedAt || r.createdAt, imp.slice(0, 100), st);
  });
  store.readAll('vitals').filter(v => v.patientId === pid).forEach(v => {
    add('vital', '📈', 'ویتال NEWS2=' + (v.news2 || '?'), v.recordedAt, 'HR ' + (v.hr||'—') + ' · BP ' + (v.bp_sys||'—') + '/' + (v.bp_dia||'—') + ' · SpO₂ ' + (v.spo2||'—') + '%', v.news2 >= 7 ? 'dng' : v.news2 >= 5 ? 'warn' : '');
  });
  store.readAll('orders').filter(o => o.patientId === pid).forEach(o => {
    add('order', '💊', (o.type === 'medication' ? 'دارو: ' + ((o.details && o.details.drug) || '') : 'دستور: ' + o.type), o.orderedAt, 'وضعیت: ' + o.status, o.priority === 'stat' ? 'dng' : '');
  });
  store.readAll('labs').filter(l => l.patientId === pid).forEach(l => {
    const crit = l.criticalFlags && l.criticalFlags.length;
    add('lab', '🧪', l.panelName + ' — ' + l.status, l.resultedAt || l.orderedAt, crit ? crit + ' بحرانی' : '', crit ? 'dng' : '');
  });
  store.readAll('radiology').filter(r => r.patientId === pid).forEach(r => {
    add('imaging', '🩻', r.modality + ' ' + r.bodyPart + ' — ' + r.status, r.reportedAt || r.orderedAt, r.impression || '', r.criticalFlag ? 'dng' : '');
  });
  store.readAll('consults').filter(c => c.patientId === pid).forEach(c => {
    add('consult', '🩺', 'مشاوره ' + c.targetService + ' — ' + c.status, c.respondedAt || c.requestedAt, c.question || '', c.consultType === 'emergency' ? 'dng' : '');
  });
  store.readAll('nursing_notes').filter(n => n.patientId === pid).forEach(n => {
    add('note', '📋', 'پرستار: ' + n.byName, n.at, n.text.slice(0, 80), '');
  });
  events.sort((a, b) => sd(b.at) - sd(a.at));
  return { patient: { id: p.id, name: p.firstName + ' ' + p.lastName, ward: p.wardCode, bed: p.bedNumber }, events: events.slice(0, 100), total: events.length };
}

function applyOrderSet(ctx) {
  const r = store.get('encounters', ctx.params.roundId);
  if (!r) throw ctx.E.notFound('round_not_found');
  const b = ctx.body || {};
  if (!b.setId) throw ctx.E.badRequest('set_id_required');
  let sets = null;
  try { sets = require('./encounters')._orderSets; } catch (_) {}
  const set = sets && sets[b.setId];
  if (!set) throw ctx.E.notFound('set_not_found');
  const p = store.get('patients', r.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const created = { orders: 0, labs: 0, imaging: 0, consults: 0, nursing: 0 };
  (set.meds || []).forEach(m => {
    orderWriter.create(ctx, { id: ctx.uid('ord'), patientId: p.id, patientName: p.firstName + ' ' + p.lastName, wardCode: p.wardCode, type: 'medication', priority: m.priority || 'routine', details: m, status: 'pending', orderedBy: ctx.actor.id, orderedAt: ctx.now(), sourceOrderSet: b.setId, sourceRoundId: r.id });
    created.orders++;
  });
  (set.labs || []).forEach(lbl => { orderWriter.create(ctx, { id: ctx.uid('ord'), patientId: p.id, patientName: p.firstName + ' ' + p.lastName, wardCode: p.wardCode, type: 'lab', priority: 'routine', details: { panel: lbl }, status: 'pending', orderedBy: ctx.actor.id, orderedAt: ctx.now(), sourceOrderSet: b.setId, sourceRoundId: r.id }); created.labs++; });
  (set.imaging || []).forEach(im => { orderWriter.create(ctx, { id: ctx.uid('ord'), patientId: p.id, patientName: p.firstName + ' ' + p.lastName, wardCode: p.wardCode, type: 'paraclinical', priority: 'routine', details: { modality: im.modality, bodyPart: im.bodyPart }, status: 'pending', orderedBy: ctx.actor.id, orderedAt: ctx.now(), sourceOrderSet: b.setId, sourceRoundId: r.id }); created.imaging++; });
  (set.consults || []).forEach(c => { require('../core/domain/consult-writer').create(ctx, { id: ctx.uid('cons'), patientId: p.id, patientName: p.firstName + ' ' + p.lastName, wardCode: p.wardCode, bedNumber: p.bedNumber, consultType: c.type || 'routine', targetService: c.service, question: c.question || '', isbar: {}, status: 'requested', requestedBy: ctx.actor.id, requestedAt: ctx.now(), responseDueAt: new Date(Date.now() + (c.type === 'emergency' ? 30 : 120) * 60000).toISOString(), sourceRoundId: r.id }); created.consults++; });
  (set.nursing || []).forEach(n => { orderWriter.create(ctx, { id: ctx.uid('ord'), patientId: p.id, patientName: p.firstName + ' ' + p.lastName, wardCode: p.wardCode, type: 'nursing', priority: 'routine', details: { note: n }, status: 'pending', orderedBy: ctx.actor.id, orderedAt: ctx.now(), sourceOrderSet: b.setId, sourceRoundId: r.id }); created.nursing++; });
  r.plan = r.plan || {};
  r.plan.medications = r.plan.medications || [];
  (set.meds || []).forEach(m => { r.plan.medications.push(m.drug + ' ' + (m.dose || '')); });
  r.appliedOrderSets = r.appliedOrderSets || [];
  r.appliedOrderSets.push({ setId: b.setId, name: set.name, at: ctx.now(), by: ctx.actor.id });
  store.put('encounters', r);
  ctx.audit.write('rounds_v2', 'orderset.applied', r.id, ctx.actor, { setId: b.setId, created });
  ctx.bus.emit('encounter.orderset.applied', { record: { patientId: p.id, setId: b.setId, created }, actor: ctx.actor });
  return { roundId: r.id, setId: b.setId, orderSet: set.name, created, total: Object.values(created).reduce((s, x) => s + x, 0) };
}

module.exports = {
  handlers: { queue, context, createRound, updateRound, signRound, cosignRound, pendingCosign, myRounds, patientRounds, timeline, applyOrderSet },
  routes: [
    { method:'GET',  path:'/api/rv2/queue',                    handler:'queue',        perm:'rounds.v2.view' },
    { method:'GET',  path:'/api/rv2/context/:patientId',       handler:'context',      perm:'rounds.v2.view' },
    { method:'GET',  path:'/api/rv2/patient/:patientId/rounds',handler:'patientRounds',perm:'rounds.v2.view' },
    { method:'GET',  path:'/api/rv2/timeline/:patientId',      handler:'timeline',     perm:'rounds.v2.view' },
    { method:'GET',  path:'/api/rv2/pending-cosign',           handler:'pendingCosign',perm:'rounds.v2.view' },
    { method:'GET',  path:'/api/rv2/my-rounds',                handler:'myRounds',     perm:'rounds.v2.view' },
    { method:'POST', path:'/api/rv2/create',                   handler:'createRound',  perm:'rounds.v2.create' },
    { method:'PUT',  path:'/api/rv2/:roundId',                 handler:'updateRound',  perm:'rounds.v2.create' },
    { method:'POST', path:'/api/rv2/:roundId/sign',            handler:'signRound',    perm:'rounds.v2.sign' },
    { method:'POST', path:'/api/rv2/:roundId/cosign',          handler:'cosignRound',  perm:'rounds.v2.cosign' },
    { method:'POST', path:'/api/rv2/:roundId/orderset',        handler:'applyOrderSet',perm:'rounds.v2.create' }
  ],
  panels: [
    { id:'hub', title:'راند پزشکی v2', icon:'📝', perm:'rounds.v2.view', kind:'rounds_v2', api:'/api/rv2/queue' }
  ]
};
console.log('[rounds_v2] loaded — scope-aware queue + SOAP autofill + cosign + timeline');
