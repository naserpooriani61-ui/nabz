'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Nursing Station v2 (Nurse HQ)
//  ONE panel — replaces nursing_mode + nursing_station + fragments
//  Philosophy: Action-queue over data-tables. Anticipation over report.
//  Standards: JCI IPSG.2/IPSG.3/COP.5 · ISMP 2024 · NANDA-I · SSC 2021
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const store = require('../core/store');
const bus = require('../core/events');
const perms = require('../core/permissions');
const resolver = require('../core/ward-resolver');

if (!perms.P['nursehq.view']) {
  perms.P['nursehq.view'] = 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,supervisor_er,head_nurse,attending,specialist,resident,intern,physician,nurse,nurse_aide,assistant_nurse,quality_officer';
  perms.P['nursehq.action'] = 'admin,nurse,nurse_aide,assistant_nurse,head_nurse,resident,intern,attending,specialist,physician';
}

// ═══ SHIFT ═══
function currentShift() {
  let hh = new Date().getHours();
  try { const t = require('../core/time'); hh = t.hourTehran ? t.hourTehran() : hh; } catch (_) {}
  if (hh >= 7 && hh < 14) return { code:'morning', fa:'صبح', endHour:14 };
  if (hh >= 14 && hh < 19) return { code:'evening', fa:'عصر', endHour:19 };
  return { code:'night', fa:'شب', endHour:7 };
}

function shiftStartedAt() {
  const s = currentShift();
  let startHour = s.code === 'morning' ? 7 : s.code === 'evening' ? 14 : 19;
  const now = Date.now();
  const t = require('../core/time');
  const c = t.todayTehranComponents ? t.todayTehranComponents() : (function(){ const n = new Date(); return { y:n.getFullYear(), m:n.getMonth()+1, d:n.getDate() }; })();
  let start = new Date(Date.UTC(c.y, c.m-1, c.d, startHour, 0, 0) - 3.5*3600000);
  if (start.getTime() > now) start = new Date(start.getTime() - 86400000);
  return start.toISOString();
}

function resolveWard(ctx) {
  const a = ctx.actor;
  if (a.ward) return a.ward;
  try { const w = resolver.resolveUserWard(a); if (w) return w; } catch (_) {}
  if (a.staffId) {
    try {
      const wf = store.readAll('wf_staff').find(s => s.id === a.staffId);
      if (wf && wf.ward) return wf.ward;
    } catch (_) {}
  }
  return null;
}

// ═══ Indexing (O(1) lookups) ═══
function buildIndexes(pidSet) {
  const idx = {
    lastVital: {}, vitalHist: {},
    marByP: {}, labsByP: {}, ordersByP: {}, consultsByP: {},
    sepsisByP: {}, isolationByP: {}, ncpByP: {}, notesByP: {},
    ioByP: {}, restraintByP: {}, morseByP: {}, bradenByP: {},
    lastRoundByP: {}, handoffByP: {}, cdssByP: {}
  };
  // Vitals
  for (const v of store.readAll('vitals')) {
    if (!pidSet.has(v.patientId)) continue;
    if (!idx.lastVital[v.patientId] || sd(v.recordedAt) > sd(idx.lastVital[v.patientId].recordedAt)) idx.lastVital[v.patientId] = v;
    if (!idx.vitalHist[v.patientId]) idx.vitalHist[v.patientId] = [];
    idx.vitalHist[v.patientId].push(v);
  }
  for (const p in idx.vitalHist) idx.vitalHist[p].sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
  for (const m of store.readAll('mar')) { if (!pidSet.has(m.patientId)) continue; if (!idx.marByP[m.patientId]) idx.marByP[m.patientId] = []; idx.marByP[m.patientId].push(m); }
  for (const l of store.readAll('labs')) { if (!pidSet.has(l.patientId)) continue; if (!idx.labsByP[l.patientId]) idx.labsByP[l.patientId] = []; idx.labsByP[l.patientId].push(l); }
  for (const o of store.readAll('orders')) { if (!pidSet.has(o.patientId)) continue; if (!idx.ordersByP[o.patientId]) idx.ordersByP[o.patientId] = []; idx.ordersByP[o.patientId].push(o); }
  for (const c of store.readAll('consults')) { if (!pidSet.has(c.patientId)) continue; if (!idx.consultsByP[c.patientId]) idx.consultsByP[c.patientId] = []; idx.consultsByP[c.patientId].push(c); }
  for (const s of store.readAll('sepsis')) { if (!pidSet.has(s.patientId)) continue; if (!idx.sepsisByP[s.patientId]) idx.sepsisByP[s.patientId] = []; idx.sepsisByP[s.patientId].push(s); }
  for (const i of store.readAll('isolations')) { if (!pidSet.has(i.patientId) || i.status !== 'active') continue; idx.isolationByP[i.patientId] = i; }
  for (const n of store.readAll('nursing_care_plans')) { if (!pidSet.has(n.patientId) || n.status !== 'active') continue; idx.ncpByP[n.patientId] = n; }
  for (const n of store.readAll('nursing_notes')) {
    if (!pidSet.has(n.patientId)) continue;
    if (!idx.notesByP[n.patientId]) idx.notesByP[n.patientId] = [];
    idx.notesByP[n.patientId].push(n);
  }
  for (const p in idx.notesByP) idx.notesByP[p].sort((a, b) => sd(b.at) - sd(a.at));
  for (const r of store.readAll('io_records')) {
    if (!pidSet.has(r.patientId)) continue;
    if (!idx.ioByP[r.patientId]) idx.ioByP[r.patientId] = [];
    idx.ioByP[r.patientId].push(r);
  }
  for (const r of store.readAll('restraint_events')) { if (!pidSet.has(r.patientId) || r.status !== 'active') continue; idx.restraintByP[r.patientId] = r; }
  for (const s of store.readAll('cdss_scores')) {
    if (!pidSet.has(s.patientId)) continue;
    if (s.scoreType === 'morse') {
      if (!idx.morseByP[s.patientId] || sd(s.computedAt) > sd(idx.morseByP[s.patientId].computedAt)) idx.morseByP[s.patientId] = s;
    }
    if (s.scoreType === 'braden') {
      if (!idx.bradenByP[s.patientId] || sd(s.computedAt) > sd(idx.bradenByP[s.patientId].computedAt)) idx.bradenByP[s.patientId] = s;
    }
  }
  for (const e of store.readAll('encounters')) {
    if (!pidSet.has(e.patientId) || e.type !== 'round') continue;
    if (!idx.lastRoundByP[e.patientId] || sd(e.createdAt) > sd(idx.lastRoundByP[e.patientId].createdAt)) idx.lastRoundByP[e.patientId] = e;
  }
  try {
    for (const hd of store.readAll('handoff_ai_records')) {
      if (hd.status !== 'sent') continue;
      for (const it of (hd.items || [])) {
        if (!pidSet.has(it.patientId)) continue;
        if (!idx.handoffByP[it.patientId]) idx.handoffByP[it.patientId] = hd;
      }
    }
  } catch (_) {}
  for (const a of store.readAll('cdss_alerts')) {
    if (a.dismissed) continue;
    if (!pidSet.has(a.patientId)) continue;
    if (!idx.cdssByP[a.patientId]) idx.cdssByP[a.patientId] = [];
    idx.cdssByP[a.patientId].push(a);
  }
  return idx;
}

// ═══ Trends ═══
function computeNewsTrend(hist) {
  if (!hist || hist.length < 2) return null;
  const last3 = hist.slice(0, 3).filter(v => v.news2 != null);
  if (last3.length < 2) return null;
  const first = Number(last3[last3.length - 1].news2) || 0;
  const latest = Number(last3[0].news2) || 0;
  if (latest > first) return { dir: 'up', delta: latest - first, from: first, to: latest };
  if (latest < first) return { dir: 'down', delta: first - latest, from: first, to: latest };
  return { dir: 'flat', delta: 0, from: first, to: latest };
}

// ═══ Patient snapshot ═══
function snapshotPatient(patient, idx) {
  const pid = patient.id;
  const lastV = idx.lastVital[pid] || null;
  const hist = idx.vitalHist[pid] || [];
  const trend = computeNewsTrend(hist);
  const news2 = lastV ? Number(lastV.news2) || 0 : null;
  const vitalAgeMin = lastV ? Math.round((Date.now() - sd(lastV.recordedAt)) / 60000) : null;

  // MAR
  const mar = idx.marByP[pid] || [];
  const now = Date.now();
  const due1h = mar.filter(m => ['scheduled','due'].includes(m.status) && sd(m.scheduledAt) < now + 3600000 && sd(m.scheduledAt) > now - 60000);
  const overdue = mar.filter(m => ['scheduled','due'].includes(m.status) && sd(m.scheduledAt) < now - 30*60000 && sd(m.scheduledAt) > now - 6*3600000);
  const veryOverdue = overdue.filter(m => sd(m.scheduledAt) < now - 2*3600000);
  const highOverdue = overdue.filter(m => m.isHighAlert);
  const missed = mar.filter(m => m.status === 'missed' && sd(m.scheduledAt) > now - 24*3600000);
  const prnPending = mar.filter(m => m.status === 'given' && m.prnEffectivenessPending && sd(m.prnEffectivenessDueAt) < now);

  // Labs
  const labs = idx.labsByP[pid] || [];
  const critUnacked = labs.filter(l => l.criticalFlags && l.criticalFlags.length && ['resulted','verified'].includes(l.status) && (!l.acknowledgment || !l.acknowledgment.acknowledged));

  // Consults
  const consults = idx.consultsByP[pid] || [];
  const consultRequested = consults.filter(c => c.status === 'requested' && sd(c.responseDueAt) < now);
  const consultReady = consults.filter(c => c.status === 'responded');

  // Sepsis
  const sepsisArr = idx.sepsisByP[pid] || [];
  const sepsisActive = sepsisArr.find(s => ['suspected','confirmed','septic_shock'].includes(s.status));
  const sepsisBundleIncomplete = sepsisActive && (!sepsisActive.bundle3h || !sepsisActive.bundle3h.completed);

  // Isolation
  const isolation = idx.isolationByP[pid] || null;

  // NCP
  const ncp = idx.ncpByP[pid] || null;
  let ncpActiveDx = 0, ncpUnmetNoc = [];
  if (ncp) {
    for (const d of (ncp.diagnoses || [])) {
      if (d.status !== 'active') continue;
      ncpActiveDx++;
      for (const o of (d.expectedOutcomes || [])) {
        if (o.latestScore != null && o.latestScore < o.target) ncpUnmetNoc.push(o.fa);
      }
    }
  }

  // Round
  const lastR = idx.lastRoundByP[pid] || null;
  const lastRoundHrs = lastR ? Math.round((Date.now() - sd(lastR.createdAt)) / 3600000) : null;

  // Morse / Braden
  const morse = idx.morseByP[pid] || null;
  const braden = idx.bradenByP[pid] || null;
  const morseAgeHrs = morse ? Math.round((Date.now() - sd(morse.computedAt)) / 3600000) : null;
  const bradenAgeHrs = braden ? Math.round((Date.now() - sd(braden.computedAt)) / 3600000) : null;

  // Restraint
  const restraint = idx.restraintByP[pid] || null;
  const restraintOverdue = restraint && sd(restraint.nextAssessmentDueAt) < now;

  // Orders pending
  const orders = idx.ordersByP[pid] || [];
  const pendingOrders = orders.filter(o => o.status === 'pending');

  // Handoff incoming
  const handoff = idx.handoffByP[pid] || null;

  // CDSS alerts
  const cdssAlerts = idx.cdssByP[pid] || [];
  const cdssCritical = cdssAlerts.filter(a => a.severity === 'critical');

  // I/O last 24h
  const io = idx.ioByP[pid] || [];
  const io24 = io.filter(r => sd(r.recordedAt) > now - 86400000);
  const ioIn = io24.filter(r => r.type === 'intake').reduce((s, r) => s + (Number(r.volume) || 0), 0);
  const ioOut = io24.filter(r => r.type === 'output').reduce((s, r) => s + (Number(r.volume) || 0), 0);

  // Pain — from last vital
  const painAgeHrs = lastV && lastV.pain != null ? Math.round((Date.now() - sd(lastV.recordedAt)) / 3600000) : null;

  // ── Flags ──
  const flags = [];
  if (patient.allergies && patient.allergies.length) {
    flags.push({ type:'allergy', severity:'critical', icon:'⚠️', text: patient.allergies.join('، ') });
  }
  if (patient.codeStatus && patient.codeStatus !== 'full') {
    flags.push({ type:'code', severity:'critical', icon:'🚫', text: patient.codeStatus.toUpperCase() });
  }
  if (sepsisActive) {
    flags.push({ type:'sepsis', severity:'critical', icon:'🦠', text:'سپسیس ' + sepsisActive.status });
  }
  if (isolation) {
    flags.push({ type:'isolation', severity:'high', icon:'🧼', text: isolation.type });
  }
  if (morse && morse.score >= 45) {
    flags.push({ type:'fall', severity:'high', icon:'🚶', text:'Morse ' + morse.score });
  }
  if (braden && braden.score <= 12) {
    flags.push({ type:'pressure', severity:'high', icon:'🛏', text:'Braden ' + braden.score });
  }
  if (restraint) {
    flags.push({ type:'restraint', severity:'critical', icon:'🔒', text:'محدودیت فعال' });
  }
  if (veryOverdue.length > 0) {
    flags.push({ type:'mar_very_overdue', severity:'critical', icon:'⏰', text: veryOverdue.length + ' MAR بسیار دیرکرد' });
  }
  if (critUnacked.length > 0) {
    flags.push({ type:'crit_lab', severity:'critical', icon:'🧪', text: critUnacked.length + ' lab بحرانی' });
  }

  // ── Priority score ──
  let score = 25;
  const reasons = [];
  if (sepsisActive) { score += 40; reasons.push('سپسیس'); }
  if (news2 !== null) {
    if (news2 >= 9) { score += 35; reasons.push('NEWS2 ' + news2); }
    else if (news2 >= 7) { score += 28; reasons.push('NEWS2 ' + news2); }
    else if (news2 >= 5) { score += 14; reasons.push('NEWS2 ' + news2); }
    else if (news2 >= 3) { score += 5; }
  }
  if (trend && trend.dir === 'up' && trend.delta >= 2) { score += 15; reasons.push('NEWS صعودی'); }
  if (critUnacked.length > 0) { score += 20; reasons.push(critUnacked.length + ' lab بحرانی'); }
  if (highOverdue.length > 0) { score += 15; reasons.push(highOverdue.length + ' High-Alert دیرکرد'); }
  else if (overdue.length > 0) { score += Math.min(15, overdue.length * 5); reasons.push(overdue.length + ' MAR دیرکرد'); }
  if (missed.length > 0) { score += Math.min(12, missed.length * 4); reasons.push(missed.length + ' missed'); }
  if (lastRoundHrs === null) { score += 10; reasons.push('بدون راند'); }
  else if (lastRoundHrs > 24) { score += 8; reasons.push(lastRoundHrs + 'h بدون راند'); }
  if (pendingOrders.some(o => o.priority === 'stat')) { score += 8; reasons.push('STAT'); }
  if (patient.codeStatus === 'dnr' || patient.codeStatus === 'dni') { score -= 10; }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low';

  return {
    id: pid,
    name: patient.firstName + ' ' + patient.lastName,
    age: patient.age, sex: patient.sex,
    ward: patient.wardCode, bed: patient.bedNumber,
    diagnosis: patient.diagnosis, codeStatus: patient.codeStatus,
    admittedAt: patient.admittedAt,
    flags,
    priority: { score, level, reasons },
    vitals: lastV ? {
      hr: lastV.hr, bp_sys: lastV.bp_sys, bp_dia: lastV.bp_dia,
      rr: lastV.rr, temp: lastV.temp, spo2: lastV.spo2, gcs: lastV.gcs,
      news2, ageMin: vitalAgeMin,
      trend: trend ? { dir: trend.dir, delta: trend.delta, from: trend.from, to: trend.to } : null
    } : null,
    counts: {
      marDue: due1h.length,
      marOverdue: overdue.length,
      marVeryOverdue: veryOverdue.length,
      marMissed: missed.length,
      marHighOverdue: highOverdue.length,
      prnPending: prnPending.length,
      labsCritical: critUnacked.length,
      consultsPending: consultRequested.length,
      consultsReady: consultReady.length,
      pendingOrders: pendingOrders.length,
      ncpActiveDx: ncpActiveDx,
      ncpUnmetNoc: ncpUnmetNoc.length
    },
    io: { last24h: { in: ioIn, out: ioOut, net: ioIn - ioOut } },
    lastRound: lastR ? { hoursAgo: lastRoundHrs, author: lastR.authorName, impression: (lastR.assessment && lastR.assessment.clinicalImpression || '').slice(0, 100) } : null,
    morse: morse ? { score: morse.score, level: morse.level, ageHrs: morseAgeHrs } : null,
    braden: braden ? { score: braden.score, level: braden.level, ageHrs: bradenAgeHrs } : null,
    painAgeHrs,
    isolation: isolation ? { type: isolation.type, reason: isolation.reason, ppe: isolation.ppeRequired || [] } : null,
    sepsis: sepsisActive ? { status: sepsisActive.status, qsofa: sepsisActive.qsofa ? sepsisActive.qsofa.score : 0, likelihood: sepsisActive.likelihoodScore || 0, bundle3hIncomplete: sepsisBundleIncomplete, screenedAt: sepsisActive.screenedAt } : null,
    handoff: handoff ? { id: handoff.id, code: handoff.uniqueCode, from: handoff.fromUserName, sentAt: handoff.sentAt, patientCount: handoff.patientCount } : null,
    cdss: cdssCritical.length > 0 ? cdssCritical.map(a => ({ id: a.id, type: a.type, severity: a.severity, title: a.title, message: a.message })) : null,
    restraint: restraint ? { active: true, nextAssessDueAt: restraint.nextAssessmentDueAt, overdue: restraintOverdue } : null
  };
}

// ═══ Action queue ═══
function buildActions(patientSnap, patient, idx) {
  const actions = [];
  const pid = patient.id;
  const pName = patientSnap.name;
  const bed = patient.bedNumber;
  const ward = patient.wardCode;
  const now = Date.now();

  // 1) Sepsis bundle
  if (patientSnap.sepsis && patientSnap.sepsis.bundle3hIncomplete) {
    actions.push({
      id: 'sepsis_' + pid,
      type: 'sepsis_bundle', priority: 'critical',
      patientId: pid, patientName: pName, bed, ward,
      title: '🦠 تکمیل Sepsis Bundle',
      subtitle: 'qSOFA ' + patientSnap.sepsis.qsofa + ' · likelihood ' + patientSnap.sepsis.likelihood + '%',
      actionLabel: 'شروع bundle',
      actionModal: 'sepsis_bundle',
      actionData: { patientId: pid, sepsisStatus: patientSnap.sepsis.status },
      dueAt: null, minutesOverdue: 0,
      reason: 'sepsis_active'
    });
  }

  // 2) MAR — Very overdue first, then overdue, then high-alert due
  const mar = (idx.marByP[pid] || []).slice().sort((a, b) => sd(a.scheduledAt) - sd(b.scheduledAt));
  for (const m of mar) {
    if (!['scheduled','due'].includes(m.status)) continue;
    const dueMs = sd(m.scheduledAt);
    const minsFromNow = Math.round((now - dueMs) / 60000);
    const minsUntilDue = -minsFromNow;
    if (minsUntilDue > 120) continue;
    const isHA = !!m.isHighAlert;
    let priority, subtitle, reason;
    if (minsFromNow >= 120) { priority = 'critical'; subtitle = Math.round(minsFromNow) + ' دقیقه دیرکرد' + (isHA ? ' · ⚠️ پرخطر' : ''); reason = 'very_overdue'; }
    else if (minsFromNow >= 30) { priority = isHA ? 'critical' : 'high'; subtitle = minsFromNow + ' دقیقه دیرکرد' + (isHA ? ' · ⚠️ پرخطر' : ''); reason = 'overdue'; }
    else if (minsFromNow >= 0) { priority = isHA ? 'high' : 'medium'; subtitle = 'همین الان' + (isHA ? ' · ⚠️ پرخطر' : ''); reason = 'due'; }
    else { priority = isHA ? 'high' : 'medium'; subtitle = 'در ' + minsUntilDue + ' دقیقه'; reason = 'upcoming'; }

    actions.push({
      id: 'mar_' + m.id,
      type: 'mar', priority, patientId: pid, patientName: pName, bed, ward,
      title: '💊 ' + (m.drugName || '') + ' ' + (m.dose || ''),
      subtitle,
      actionLabel: 'توزیع',
      actionModal: 'mar_give',
      actionData: { marId: m.id, drugName: m.drugName, dose: m.dose, route: m.route, patientName: pName, isHighAlert: isHA, scheduledAt: m.scheduledAt, minutesLate: minsFromNow },
      dueAt: m.scheduledAt, minutesOverdue: Math.max(0, minsFromNow),
      reason, flags: isHA ? ['high_alert'] : []
    });
  }

  // 3) Missed MAR
  for (const m of (idx.marByP[pid] || [])) {
    if (m.status === 'missed' && sd(m.scheduledAt) > now - 24*3600000) {
      const minsLate = Math.round((now - sd(m.scheduledAt)) / 60000);
      actions.push({
        id: 'missed_' + m.id,
        type: 'mar_missed', priority: 'critical',
        patientId: pid, patientName: pName, bed, ward,
        title: '❌ Missed: ' + (m.drugName || ''),
        subtitle: 'از ' + Math.round(minsLate/60) + ' ساعت پیش' + (m.isHighAlert ? ' · ⚠️ پرخطر' : ''),
        actionLabel: 'ثبت missed',
        actionModal: 'mar_missed_review',
        actionData: { marId: m.id },
        dueAt: m.scheduledAt, minutesOverdue: minsLate,
        reason: 'missed'
      });
    }
  }

  // 4) PRN effectiveness pending
  for (const m of (idx.marByP[pid] || [])) {
    if (m.status === 'given' && m.prnEffectivenessPending && sd(m.prnEffectivenessDueAt) < now) {
      actions.push({
        id: 'prn_' + m.id,
        type: 'prn', priority: 'medium',
        patientId: pid, patientName: pName, bed, ward,
        title: '📊 اثربخشی ' + (m.drugName || ''),
        subtitle: 'در انتظار ارزیابی',
        actionLabel: 'ارزیابی',
        actionModal: 'prn_effectiveness',
        actionData: { marId: m.id, drugName: m.drugName },
        dueAt: m.prnEffectivenessDueAt, minutesOverdue: Math.round((now - sd(m.prnEffectivenessDueAt)) / 60000),
        reason: 'prn_effectiveness'
      });
    }
  }

  // 5) Vitals
  if (patientSnap.vitals) {
    const ageMin = patientSnap.vitals.ageMin;
    let priority, subtitle, reason;
    if (ageMin > 8*60) { priority = 'critical'; subtitle = Math.round(ageMin/60) + ' ساعت پیش'; reason = 'vitals_critical_age'; }
    else if (ageMin > 6*60) { priority = 'high'; subtitle = Math.round(ageMin/60) + ' ساعت پیش'; reason = 'vitals_high_age'; }
    else if (ageMin > 4*60) { priority = 'medium'; subtitle = Math.round(ageMin/60) + ' ساعت پیش'; reason = 'vitals_due'; }
    else priority = null;
    if (priority) {
      actions.push({
        id: 'vitals_' + pid,
        type: 'vitals', priority,
        patientId: pid, patientName: pName, bed, ward,
        title: '📈 ثبت علائم حیاتی',
        subtitle,
        actionLabel: 'ثبت',
        actionModal: 'vitals',
        actionData: { patientId: pid, lastVital: patientSnap.vitals },
        dueAt: null, minutesOverdue: 0, reason
      });
    }
  } else {
    actions.push({
      id: 'vitals_none_' + pid,
      type: 'vitals', priority: 'high',
      patientId: pid, patientName: pName, bed, ward,
      title: '📈 اولین ویتال',
      subtitle: 'هرگز ثبت نشده',
      actionLabel: 'ثبت',
      actionModal: 'vitals',
      actionData: { patientId: pid, lastVital: null },
      dueAt: null, minutesOverdue: 0, reason: 'vitals_none'
    });
  }

  // 6) Critical lab unacked
  for (const l of (idx.labsByP[pid] || [])) {
    if (l.criticalFlags && l.criticalFlags.length && ['resulted','verified'].includes(l.status) && (!l.acknowledgment || !l.acknowledgment.acknowledged)) {
      actions.push({
        id: 'lab_' + l.id,
        type: 'lab_readback', priority: 'critical',
        patientId: pid, patientName: pName, bed, ward,
        title: '🧪 ' + (l.panelName || l.panelCode) + ' — بحرانی',
        subtitle: l.criticalFlags.map(f => f.test + '=' + f.value).join(' · '),
        actionLabel: 'Read-back',
        actionModal: 'lab_ack',
        actionData: { labId: l.id, panel: l.panelName || l.panelCode, flags: l.criticalFlags },
        dueAt: l.resultedAt, minutesOverdue: Math.round((now - sd(l.resultedAt)) / 60000),
        reason: 'lab_critical'
      });
    }
  }

  // 7) Consult overdue
  for (const c of (idx.consultsByP[pid] || [])) {
    if (c.status === 'requested' && sd(c.responseDueAt) < now) {
      actions.push({
        id: 'consult_' + c.id,
        type: 'consult_overdue', priority: 'high',
        patientId: pid, patientName: pName, bed, ward,
        title: '🩺 مشاوره ' + (c.targetService || '') + ' دیرکرد',
        subtitle: (c.consultType || 'routine') + ' · ' + Math.round((now - sd(c.responseDueAt)) / 60000) + ' دقیقه',
        actionLabel: 'مشاهده',
        actionModal: 'consult',
        actionData: { consultId: c.id },
        dueAt: c.responseDueAt, minutesOverdue: Math.round((now - sd(c.responseDueAt)) / 60000),
        reason: 'consult_overdue'
      });
    }
  }

  // 8) Pain assessment
  if (patientSnap.painAgeHrs === null || patientSnap.painAgeHrs > 8) {
    actions.push({
      id: 'pain_' + pid,
      type: 'pain', priority: 'medium',
      patientId: pid, patientName: pName, bed, ward,
      title: '🩹 ارزیابی درد',
      subtitle: patientSnap.painAgeHrs === null ? 'انجام نشده' : patientSnap.painAgeHrs + ' ساعت پیش',
      actionLabel: 'ارزیابی',
      actionModal: 'pain_assess',
      actionData: { patientId: pid },
      dueAt: null, minutesOverdue: 0, reason: 'pain_due'
    });
  }

  // 9) Morse
  if (!patientSnap.morse || patientSnap.morse.ageHrs > 24) {
    actions.push({
      id: 'morse_' + pid,
      type: 'morse', priority: 'medium',
      patientId: pid, patientName: pName, bed, ward,
      title: '🚶 ارزیابی Morse Fall',
      subtitle: !patientSnap.morse ? 'انجام نشده' : patientSnap.morse.ageHrs + ' ساعت پیش',
      actionLabel: 'شروع',
      actionModal: 'morse',
      actionData: { patientId: pid },
      dueAt: null, minutesOverdue: 0, reason: 'morse_due'
    });
  }

  // 10) Restraint reassessment
  if (patientSnap.restraint && patientSnap.restraint.overdue) {
    actions.push({
      id: 'restraint_' + pid,
      type: 'restraint', priority: 'critical',
      patientId: pid, patientName: pName, bed, ward,
      title: '🔒 ارزیابی محدودیت',
      subtitle: 'سررسید شده',
      actionLabel: 'ارزیابی',
      actionModal: 'restraint_assess',
      actionData: { patientId: pid },
      dueAt: patientSnap.restraint.nextAssessDueAt, minutesOverdue: Math.round((now - sd(patientSnap.restraint.nextAssessDueAt)) / 60000),
      reason: 'restraint_overdue'
    });
  }

  // 11) Pending orders (STAT)
  for (const o of (idx.ordersByP[pid] || [])) {
    if (o.status === 'pending' && o.priority === 'stat') {
      actions.push({
        id: 'order_' + o.id,
        type: 'order_stat', priority: 'high',
        patientId: pid, patientName: pName, bed, ward,
        title: '📝 دستور STAT تأییدنشده',
        subtitle: (o.details && o.details.drug) || o.type || '',
        actionLabel: 'مشاهده',
        actionModal: 'order',
        actionData: { orderId: o.id },
        dueAt: o.orderedAt, minutesOverdue: Math.round((now - sd(o.orderedAt)) / 60000),
        reason: 'order_stat'
      });
    }
  }

  return actions;
}

// ═══ MAIN: Dashboard ═══
function dashboard(ctx) {
  const ward = resolveWard(ctx);
  if (!ward && !perms.isCrossWard(ctx.actor.role)) {
    throw ctx.E.badRequest('ward_not_configured');
  }
  const scope = perms.isCrossWard(ctx.actor.role) ? { kind:'all', codes:[] } : { kind:'wards', codes: [ward] };
  let patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  if (scope.kind === 'wards') patients = patients.filter(p => scope.codes.includes(p.wardCode));
  const pidSet = new Set(patients.map(p => p.id));

  const idx = buildIndexes(pidSet);
  const snapshots = patients.map(p => snapshotPatient(p, idx));
  snapshots.sort((a, b) => b.priority.score - a.priority.score);

  // Build action queue — merge all patient actions
  const allActions = [];
  for (const p of patients) {
    const snap = snapshots.find(s => s.id === p.id);
    const acts = buildActions(snap, p, idx);
    allActions.push(...acts);
  }
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  allActions.sort((a, b) => {
    const pa = order[a.priority] || 9, pb = order[b.priority] || 9;
    if (pa !== pb) return pa - pb;
    if (a.minutesOverdue !== b.minutesOverdue) return b.minutesOverdue - a.minutesOverdue;
    return sd(a.dueAt) - sd(b.dueAt);
  });

  // Shift
  const sh = currentShift();
  const startedIso = shiftStartedAt();
  const now = new Date();
  let endHour = sh.endHour;
  let hoursRemaining = endHour - now.getHours();
  if (hoursRemaining <= 0) hoursRemaining += 24;

  // Compliance (on shift)
  const shiftStartMs = sd(startedIso);
  let marGiven = 0, marOnTime = 0, marLate = 0;
  let vitalCount = 0;
  for (const p of patients) {
    for (const m of (idx.marByP[p.id] || [])) {
      if (m.status === 'given' && sd(m.administeredAt) >= shiftStartMs) {
        marGiven++;
        if ((m.lateMinutes || 0) <= 30) marOnTime++;
        else marLate++;
      }
    }
    vitalCount += (idx.vitalHist[p.id] || []).filter(v => sd(v.recordedAt) >= shiftStartMs).length;
  }
  const marCompliancePct = marGiven > 0 ? Math.round((marOnTime / marGiven) * 100) : null;

  // Incoming handoffs
  const incomingHandoffs = [];
  try {
    const user = ctx.actor;
    for (const hd of store.readAll('handoff_ai_records')) {
      if (hd.toUserId === user.id && hd.status === 'sent') {
        incomingHandoffs.push({ id: hd.id, code: hd.uniqueCode, from: hd.fromUserName, patientCount: hd.patientCount, sentAt: hd.sentAt, minutesAgo: Math.round((now.getTime() - sd(hd.sentAt)) / 60000) });
      }
    }
    // Also nursing_handoff_bridge reports
    for (const nr of store.readAll('nursing_reports')) {
      if (nr.status === 'signed' && nr.wardCode === ward && !nr.receivedAt) {
        incomingHandoffs.push({ id: nr.id, type: 'nursing_report', code: nr.uniqueCode, from: nr.fromUserName, patientCount: 1, sentAt: nr.signedAt, minutesAgo: Math.round((now.getTime() - sd(nr.signedAt)) / 60000) });
      }
    }
  } catch (_) {}

  // Stats
  const stats = {
    patients: patients.length,
    critical: snapshots.filter(s => s.priority.level === 'critical').length,
    high: snapshots.filter(s => s.priority.level === 'high').length,
    tasksTotal: allActions.length,
    tasksCritical: allActions.filter(a => a.priority === 'critical').length,
    tasksHigh: allActions.filter(a => a.priority === 'high').length,
    tasksMedium: allActions.filter(a => a.priority === 'medium').length,
    marCompliancePct,
    marGiven, marLate,
    vitalCount,
    incomingHandoffs: incomingHandoffs.length
  };

  return {
    shift: { code: sh.code, fa: sh.fa, startedAt: startedIso, hoursRemaining, endHour: String(endHour).padStart(2, '0') + ':00' },
    nurse: { id: ctx.actor.id, name: ctx.actor.fullName || ctx.actor.username, role: ctx.actor.role },
    ward: { code: ward || 'all', label: ward || 'همه بخش‌ها' },
    patients: snapshots,
    actions: allActions.slice(0, 100),
    incomingHandoffs,
    stats,
    generatedAt: ctx.now()
  };
}

// ═══ Patient card (full detail) ═══
function patientCard(ctx) {
  const pid = ctx.params.id;
  const patient = store.get('patients', pid);
  if (!patient) throw ctx.E.notFound('patient_not_found');

  const pidSet = new Set([pid]);
  const idx = buildIndexes(pidSet);
  const snap = snapshotPatient(patient, idx);

  // Get full timeline data
  const vitals = (idx.vitalHist[pid] || []).slice(0, 20);
  const mar = (idx.marByP[pid] || []).slice().sort((a, b) => sd(b.scheduledAt) - sd(a.scheduledAt));
  const labs = (idx.labsByP[pid] || []).slice().sort((a, b) => sd(b.orderedAt) - sd(a.orderedAt));
  const orders = (idx.ordersByP[pid] || []).slice().sort((a, b) => sd(b.orderedAt) - sd(a.orderedAt));
  const consults = (idx.consultsByP[pid] || []).slice().sort((a, b) => sd(b.requestedAt) - sd(a.requestedAt));
  const notes = (idx.notesByP[pid] || []).slice(0, 20);
  const io = (idx.ioByP[pid] || []).filter(r => sd(r.recordedAt) > Date.now() - 24*3600000).sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
  const ncp = idx.ncpByP[pid] || null;

  // Timeline merged
  const timeline = [];
  for (const v of vitals.slice(0, 6)) timeline.push({ at: v.recordedAt, icon: '📈', title: 'ویتال NEWS2=' + (v.news2 || 0), severity: (v.news2 || 0) >= 7 ? 'critical' : '' });
  for (const m of mar.filter(m => m.status === 'given').slice(0, 6)) timeline.push({ at: m.administeredAt, icon: '💊', title: m.drugName + ' ' + (m.dose || ''), severity: '' });
  for (const l of labs.slice(0, 6)) {
    const crit = l.criticalFlags && l.criticalFlags.length;
    timeline.push({ at: l.resultedAt || l.orderedAt, icon: '🧪', title: (l.panelName || l.panelCode) + ' — ' + l.status, severity: crit ? 'critical' : '' });
  }
  for (const n of notes.slice(0, 6)) timeline.push({ at: n.at, icon: '📝', title: 'پرستار: ' + (n.byName || '') + ' — ' + (n.text || '').slice(0, 60), severity: '' });
  if (idx.lastRoundByP[pid]) {
    const r = idx.lastRoundByP[pid];
    timeline.push({ at: r.signedAt || r.createdAt, icon: '📝', title: 'راند — ' + (r.authorName || ''), severity: '' });
  }
  timeline.sort((a, b) => sd(b.at) - sd(a.at));

  // Actions for this patient
  const actions = buildActions(snap, patient, idx);

  return {
    patient: {
      id: patient.id, mrn: patient.mrn,
      name: patient.firstName + ' ' + patient.lastName,
      age: patient.age, sex: patient.sex,
      ward: patient.wardCode, bed: patient.bedNumber,
      diagnosis: patient.diagnosis, comorbidities: patient.comorbidities || [],
      allergies: patient.allergies || [], codeStatus: patient.codeStatus,
      admittedAt: patient.admittedAt
    },
    snapshot: snap,
    actions,
    vitals: { last: vitals[0] || null, history: vitals },
    mar: { list: mar.slice(0, 20) },
    labs: { list: labs.slice(0, 10) },
    orders: { list: orders.slice(0, 10) },
    consults: { list: consults.slice(0, 5) },
    notes: { list: notes },
    io: { last24h: io, in: io.filter(r => r.type === 'intake').reduce((s, r) => s + (Number(r.volume) || 0), 0), out: io.filter(r => r.type === 'output').reduce((s, r) => s + (Number(r.volume) || 0), 0) },
    ncp: ncp ? { id: ncp.id, status: ncp.status, diagnoses: (ncp.diagnoses || []).filter(d => d.status === 'active').map(d => ({ code: d.code, fa: d.fa, expectedOutcomes: (d.expectedOutcomes || []).map(o => ({ fa: o.fa, score: o.latestScore, target: o.target })) })) } : null,
    timeline: timeline.slice(0, 30),
    generatedAt: ctx.now()
  };
}

module.exports = {
  handlers: { dashboard, patientCard },
  routes: [
    { method:'GET', path:'/api/nursing/hq',         handler:'dashboard',   perm:'nursehq.view' },
    { method:'GET', path:'/api/nursing/hq/patient/:id', handler:'patientCard', perm:'nursehq.view' }
  ],
  panels: [
    { id:'hub', title:'ایستگاه پرستاری', icon:'🏥', perm:'nursehq.view', kind:'nursing_station_v2', api:'/api/nursing/hq' }
  ]
};
console.log('[nurse-hq] loaded — action-queue dashboard + patient card');
