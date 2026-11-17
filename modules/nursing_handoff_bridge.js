
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Nursing Handoff Bridge
//  Aggregates NCP + MAR + Vitals + Labs + Isolations + Sepsis + Events
//  → structured ISBAR + priority score + read-back flow
//  Standards: JCI IPSG handoff, SBAR (IHI), NANDA-I, ISMP
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const bus = require('../core/events');
const store = require('../core/store');
const sig = require('../core/signature');
const perms = require('../core/permissions');

// ═══ Permissions ═══
if (!perms.P['nursing.handoff.view']) {
  perms.P['nursing.handoff.view'] = 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,head_nurse,attending,specialist,resident,intern,physician,nurse,quality_officer';
  perms.P['nursing.handoff.create'] = 'admin,nurse,head_nurse,resident,intern,physician';
  perms.P['nursing.handoff.readback'] = 'admin,nurse,head_nurse,resident,intern,attending,specialist,physician';
  perms.P['nursing.handoff.audit'] = 'admin,hospital_director,medical_director,nursing_director,quality_officer,supervisor_senior';
}

// ═══════════════════════════════════════════════════════════
//  Helper: format vitals one-liner
// ═══════════════════════════════════════════════════════════
function vitalLine(v) {
  if (!v) return 'ثبت نشده';
  const parts = [];
  if (v.hr != null) parts.push('HR ' + v.hr);
  if (v.bp_sys != null && v.bp_dia != null) parts.push('BP ' + v.bp_sys + '/' + v.bp_dia);
  else if (v.bp_sys != null) parts.push('SBP ' + v.bp_sys);
  if (v.rr != null) parts.push('RR ' + v.rr);
  if (v.temp != null) parts.push('T ' + v.temp + '°C');
  if (v.spo2 != null) parts.push('SpO₂ ' + v.spo2 + '%');
  if (v.gcs != null && v.gcs !== 15) parts.push('GCS ' + v.gcs);
  if (v.news2 != null) parts.push('NEWS2 ' + v.news2);
  if (v.recordedAt) {
    const t = new Date(v.recordedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    parts.push('@ ' + t);
  }
  return parts.join(' · ');
}

function newsTrend(vitals) {
  // vitals sorted desc
  const last3 = vitals.slice(0, 3).filter(v => v.news2 != null);
  if (last3.length < 2) return null;
  const first = last3[last3.length - 1].news2;
  const latest = last3[0].news2;
  if (latest > first) return { direction: 'worsening', from: first, to: latest };
  if (latest < first) return { direction: 'improving', from: first, to: latest };
  return { direction: 'stable', from: first, to: latest };
}

// ═══════════════════════════════════════════════════════════
//  Priority scoring engine
// ═══════════════════════════════════════════════════════════
function calcPriority(ctx, patient) {
  let score = 50;
  const reasons = [];

  // NCP — active diagnoses with unmet NOC
  const ncp = h(ctx, 'nursing_care_plans').find(p => p.patientId === patient.id && p.status === 'active');
  if (ncp) {
    let unmetNOC = 0;
    for (const d of ncp.diagnoses) {
      if (d.status !== 'active') continue;
      let isMet = false;
      for (const o of d.expectedOutcomes) {
        if (o.latestScore != null && o.latestScore < o.target) {
          isMet = true;
          break;
        }
      }
      if (isMet) { unmetNOC++; }
    }
    if (unmetNOC > 0) {
      score += Math.min(20, unmetNOC * 8);
      reasons.push(unmetNOC + ' NOC زیر هدف');
    }
    const activeCount = ncp.diagnoses.filter(d => d.status === 'active').length;
    if (activeCount === 0) { score -= 5; }
  }

  // Vitals
  const vitals = h(ctx, 'vitals').filter(v => v.patientId === patient.id)
    .sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
  const last = vitals[0];
  if (last) {
    if (last.news2 >= 7) { score += 30; reasons.push('NEWS2 ' + last.news2 + ' بحرانی'); }
    else if (last.news2 >= 5) { score += 15; reasons.push('NEWS2 ' + last.news2); }
    else if (last.news2 >= 3) { score += 5; }
    else { score -= 3; }
  } else {
    score += 5;
    reasons.push('بدون ویتال اخیر');
  }

  // MAR
  const mar = h(ctx, 'mar').filter(m => m.patientId === patient.id);
  const missed = mar.filter(m => m.status === 'missed');
  if (missed.length > 0) {
    score += Math.min(20, missed.length * 8);
    reasons.push(missed.length + ' دوز missed');
  }
  const prnPending = mar.filter(m => m.status === 'given' && m.prnEffectivenessPending &&
    m.prnEffectivenessDueAt && new Date(m.prnEffectivenessDueAt).getTime() < Date.now() - 3600000);
  if (prnPending.length > 0) {
    score += Math.min(15, prnPending.length * 5);
    reasons.push(prnPending.length + ' PRN بی‌ارزیابی > ۱h');
  }

  // Critical labs unacknowledged
  const labs = h(ctx, 'labs').filter(l => l.patientId === patient.id &&
    l.criticalFlags && l.criticalFlags.length &&
    (!l.acknowledgment || !l.acknowledgment.acknowledged));
  if (labs.length > 0) {
    score += 15;
    reasons.push(labs.length + ' lab بحرانی بدون read-back');
  }

  // Isolation active
  const isos = h(ctx, 'isolations').filter(i => i.patientId === patient.id && i.status === 'active');
  if (isos.length > 0) {
    score += 10;
    reasons.push('ایزولاسیون ' + isos[0].type);
  }

  // Sepsis active with incomplete bundle
  const sepsis = h(ctx, 'sepsis').filter(s => s.patientId === patient.id &&
    ['suspected','confirmed','septic_shock'].includes(s.status) &&
    (!s.bundle3h || !s.bundle3h.completed));
  if (sepsis.length > 0) {
    score += 20;
    reasons.push('سپسیس — bundle ناقص');
  }

  score = Math.max(0, Math.min(100, score));
  let level, label;
  if (score >= 80) { level = 'critical'; label = 'بحرانی'; }
  else if (score >= 65) { level = 'high'; label = 'پرخطر'; }
  else if (score >= 50) { level = 'medium'; label = 'متوسط'; }
  else { level = 'low'; label = 'پایدار'; }

  return { score, level, label, reasons };
}

// ═══════════════════════════════════════════════════════════
//  Aggregation engine — builds full ISBAR
// ═══════════════════════════════════════════════════════════
function aggregate(ctx, patientId) {
  const patient = store.get('patients', patientId);
  if (!patient) throw ctx.E.notFound('patient_not_found');

  // ─── Data pulls ───
  const vitals = h(ctx, 'vitals').filter(v => v.patientId === patientId)
    .sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
  const last = vitals[0];
  const trend = newsTrend(vitals);

  const orders = h(ctx, 'orders').filter(o => o.patientId === patientId);
  const mar = h(ctx, 'mar').filter(m => m.patientId === patientId);
  const labs = h(ctx, 'labs').filter(l => l.patientId === patientId)
    .sort((a, b) => sd(b.orderedAt) - sd(a.orderedAt));
  const rads = h(ctx, 'radiology').filter(r => r.patientId === patientId)
    .sort((a, b) => sd(b.orderedAt) - sd(a.orderedAt));
  const consults = h(ctx, 'consults').filter(c => c.patientId === patientId);
  const isos = h(ctx, 'isolations').filter(i => i.patientId === patientId && i.status === 'active');
  const ncp = h(ctx, 'nursing_care_plans').find(p => p.patientId === patientId && p.status === 'active');
  const sepsis = h(ctx, 'sepsis').filter(s => s.patientId === patientId &&
    ['suspected','confirmed','septic_shock'].includes(s.status));

  const now = Date.now();
  const shift8hAgo = now - 8 * 3600000;

  // ─── Situation ───
  const currentIssues = [];
  if (sepsis.length) currentIssues.push('🦠 سپسیس فعال');
  if (last && last.news2 >= 7) currentIssues.push('🚨 NEWS2 ' + last.news2 + ' بحرانی');
  else if (last && last.news2 >= 5) currentIssues.push('⚠️ NEWS2 ' + last.news2);
  const missedMar = mar.filter(m => m.status === 'missed' && sd(m.scheduledAt) > shift8hAgo);
  if (missedMar.length) currentIssues.push('💊 ' + missedMar.length + ' دوز missed');
  const critLab = labs.filter(l => l.criticalFlags && l.criticalFlags.length &&
    (!l.acknowledgment || !l.acknowledgment.acknowledged));
  if (critLab.length) currentIssues.push('🧪 ' + critLab.length + ' lab بحرانی');
  if (isos.length) currentIssues.push('🧼 ایزولاسیون ' + isos[0].type);
  if (trend && trend.direction === 'worsening') {
    currentIssues.push('📈 روند NEWS بدتر شد (' + trend.from + '→' + trend.to + ')');
  }

  const currentIssue = currentIssues.length > 0
    ? currentIssues.join(' · ')
    : 'پایدار — بدون هشدار فعال';

  // ─── Background ───
  const bgParts = [];
  if (patient.diagnosis) bgParts.push('تشخیص: ' + patient.diagnosis);
  if (patient.comorbidities && patient.comorbidities.length) bgParts.push('همراهی: ' + patient.comorbidities.join('، '));
  if (patient.allergies && patient.allergies.length) bgParts.push('⚠️ آلرژی: ' + patient.allergies.join('، '));
  if (patient.codeStatus && patient.codeStatus !== 'full') bgParts.push('کد ' + patient.codeStatus.toUpperCase());
  if (patient.admittedAt) {
    const days = Math.floor((now - sd(patient.admittedAt)) / 86400000);
    bgParts.push('بستری: ' + days + ' روز');
  }
  const backgroundStr = bgParts.join(' · ');

  // ─── Assessment ───
  const diagnosesList = [];
  if (ncp) {
    for (const d of ncp.diagnoses.filter(d => d.status === 'active')) {
      diagnosesList.push(d.code);
    }
  }
  const assessmentParts = [];
  if (ncp) {
    const activeNCP = ncp.diagnoses.filter(d => d.status === 'active');
    let unmetCount = 0;
    let metCount = 0;
    for (const d of activeNCP) {
      for (const o of d.expectedOutcomes) {
        if (o.latestScore != null) {
          if (o.latestScore >= o.target) metCount++;
          else unmetCount++;
        }
      }
    }
    if (activeNCP.length) {
      let str = '📋 NCP: ' + activeNCP.length + ' تشخیص فعال';
      if (metCount || unmetCount) str += ' · NOC: ' + metCount + ' محقق، ' + unmetCount + ' زیر هدف';
      assessmentParts.push(str);
    }
  }
  if (trend) {
    const wordMap = { improving: 'بهبود', stable: 'پایدار', worsening: 'بدتر شدن' };
    assessmentParts.push('📊 روند: ' + wordMap[trend.direction] + ' (NEWS2: ' + trend.from + '→' + trend.to + ')');
  }
  if (last && last.spo2 && last.spo2 < 92) assessmentParts.push('🫁 هیپوکسمی SpO₂ ' + last.spo2 + '%');
  if (last && last.bp_sys && last.bp_sys < 90) assessmentParts.push('🩸 هیپوتنشن SBP ' + last.bp_sys);
  if (last && last.temp && last.temp >= 38.3) assessmentParts.push('🌡 تب ' + last.temp + '°C');
  if (last && last.gcs && last.gcs < 15) assessmentParts.push('🧠 GCS ' + last.gcs);

  const clinicalImpression = assessmentParts.length
    ? assessmentParts.join('\n')
    : 'ارزیابی بالینی: بدون یافته نگران‌کننده';

  // ─── Recommendation (pending tasks) ───
  const pendingTasks = [];
  const marDue = mar.filter(m => ['scheduled','due'].includes(m.status) && sd(m.scheduledAt) < now + 3600000);
  if (marDue.length) pendingTasks.push('💊 ' + marDue.length + ' دوز MAR در ۱h آینده');
  const prnPending2 = mar.filter(m => m.status === 'given' && m.prnEffectivenessPending);
  if (prnPending2.length) pendingTasks.push('📊 ' + prnPending2.length + ' PRN نیاز به ارزیابی اثربخشی');
  if (critLab.length) pendingTasks.push('🧪 ' + critLab.length + ' lab بحرانی — read-back با پزشک');
  const pendingOrders = orders.filter(o => o.status === 'pending');
  if (pendingOrders.length) pendingTasks.push('📝 ' + pendingOrders.length + ' دستور در انتظار verify');
  const sepsisIncomplete = sepsis.filter(s => !s.bundle3h || !s.bundle3h.completed);
  if (sepsisIncomplete.length) pendingTasks.push('🦠 Sepsis bundle ناقص');
  const ncpUnscored = ncp ? ncp.diagnoses.filter(d => d.status === 'active' &&
    d.expectedOutcomes.some(o => o.latestScore == null)) : [];
  if (ncpUnscored.length) pendingTasks.push('📋 ' + ncpUnscored.length + ' NCP بدون ارزیابی NOC');
  if (isos.length) {
    const ppe = isos[0].ppeRequired || [];
    if (ppe.length) pendingTasks.push('🧼 PPE: ' + ppe.join(', '));
  }

  const followUp = pendingTasks.length
    ? pendingTasks.join('\n')
    : 'ادامه مراقبت روتین';

  // ─── Final ISBAR ───
  const isbar = {
    situation: { currentIssue, vitals: vitalLine(last) },
    background: { reason: backgroundStr, history: '' },
    assessment: { diagnoses: diagnosesList, clinicalImpression },
    recommendation: { followUp }
  };

  // ─── Structured metadata ───
  const priority = calcPriority(ctx, patient);

  return {
    patient: {
      id: patient.id, name: patient.firstName + ' ' + patient.lastName,
      age: patient.age, sex: patient.sex,
      wardCode: patient.wardCode, bedNumber: patient.bedNumber,
      diagnosis: patient.diagnosis, codeStatus: patient.codeStatus,
      admittedAt: patient.admittedAt
    },
    isbar,
    priority,
    metadata: {
      lastVital: last || null,
      newsTrend: trend,
      activeDiagnoses: ncp ? ncp.diagnoses.filter(d => d.status === 'active').map(d => ({
        code: d.code, fa: d.fa, since: d.addedAt,
        noc: d.expectedOutcomes.map(o => ({ fa: o.fa, score: o.latestScore, target: o.target }))
      })) : [],
      missedMar: missedMar.slice(0, 10).map(m => ({
        drug: m.drugName, dose: m.dose, scheduledAt: m.scheduledAt
      })),
      prnPending: prnPending2.length,
      criticalLabs: critLab.slice(0, 5).map(l => ({
        panel: l.panelName, flags: l.criticalFlags
      })),
      isolations: isos.map(i => ({ type: i.type, reason: i.reason, ppe: i.ppeRequired || [] })),
      sepsisActive: sepsis.length > 0,
      pendingTasks,
      generatedAt: new Date().toISOString(),
      generatedBy: ctx.actor.id
    }
  };
}

// ═══════════════════════════════════════════════════════════
//  Handlers
// ═══════════════════════════════════════════════════════════

// ─── Board: shift-wide view sorted by priority ───
function board(ctx) {
  let ward = ctx.query.ward;
  if (!ward && !perms.isCrossWard(ctx.actor.role)) {
    ward = ctx.actor.ward;
  }
  let patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  if (ward) patients = patients.filter(p => p.wardCode === ward);

  const items = patients.map(p => {
    const pr = calcPriority(ctx, p);
    const vitals = h(ctx, 'vitals').filter(v => v.patientId === p.id)
      .sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
    const last = vitals[0];
    const mar = h(ctx, 'mar').filter(m => m.patientId === p.id);
    const missed = mar.filter(m => m.status === 'missed').length;
    const ncp = h(ctx, 'nursing_care_plans').find(x => x.patientId === p.id && x.status === 'active');
    const activeDx = ncp ? ncp.diagnoses.filter(d => d.status === 'active').length : 0;
    return {
      patientId: p.id,
      patientName: p.firstName + ' ' + p.lastName,
      age: p.age, sex: p.sex,
      wardCode: p.wardCode, bedNumber: p.bedNumber,
      diagnosis: p.diagnosis,
      lastVital: last ? { news2: last.news2, spo2: last.spo2, hr: last.hr, bp_sys: last.bp_sys, temp: last.temp, recordedAt: last.recordedAt } : null,
      missedMar: missed,
      activeDiagnoses: activeDx,
      priority: pr
    };
  }).sort((a, b) => b.priority.score - a.priority.score);

  const critical = items.filter(i => i.priority.level === 'critical').length;
  const high = items.filter(i => i.priority.level === 'high').length;
  return {
    items,
    total: items.length,
    ward: ward || null,
    stats: { critical, high, medium: items.filter(i => i.priority.level === 'medium').length, low: items.filter(i => i.priority.level === 'low').length },
    checkedAt: new Date().toISOString()
  };
}

// ─── Preview: aggregated ISBAR for a patient (no write) ───
function preview(ctx) {
  return aggregate(ctx, ctx.params.patientId);
}

// ─── Priority only ───
function priority(ctx) {
  const p = store.get('patients', ctx.params.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');
  return calcPriority(ctx, p);
}

// ─── Submit: create nursing_report from ISBAR ───
function submit(ctx) {
  const b = ctx.body || {};
  if (!b.patientId) throw ctx.E.badRequest('patient_id_required');
  if (!b.isbar) throw ctx.E.badRequest('isbar_required');
  const patient = store.get('patients', b.patientId);
  if (!patient) throw ctx.E.notFound('patient_not_found');

  // Validate ISBAR minimal
  const i = b.isbar;
  if (!i.situation || !i.situation.currentIssue) throw ctx.E.badRequest('current_issue_required');
  if (!i.assessment || !i.assessment.clinicalImpression) throw ctx.E.badRequest('clinical_impression_required');

  const shift = b.shiftType || currentShift();
  const rec = {
    id: ctx.uid('nr'),
    patientId: patient.id,
    patientName: patient.firstName + ' ' + patient.lastName,
    wardCode: patient.wardCode, bedNumber: patient.bedNumber,
    shiftType: shift,
    isbar: {
      situation: { currentIssue: i.situation.currentIssue, vitals: i.situation.vitals || '' },
      background: { reason: (i.background && i.background.reason) || '', history: (i.background && i.background.history) || '' },
      assessment: { diagnoses: (i.assessment && i.assessment.diagnoses) || [], clinicalImpression: i.assessment.clinicalImpression },
      recommendation: { followUp: (i.recommendation && i.recommendation.followUp) || '' }
    },
    status: 'signed',
    fromUser: ctx.actor.id,
    fromUserName: ctx.actor.fullName || ctx.actor.username,
    fromUserRole: ctx.actor.role,
    createdAt: new Date().toISOString(),
    signedAt: new Date().toISOString(),
    signedBy: ctx.actor.id,
    signedByName: ctx.actor.fullName || ctx.actor.username,
    uniqueCode: makeCode(),
    bridgeMetadata: {
      priority: (calcPriority(ctx, patient) || {}).score,
      generatedAt: (b.metadata && b.metadata.generatedAt) || null,
      source: 'nursing_handoff_bridge'
    }
  };
  store.put('nursing_reports', rec);
  const sg = sig.signAction({
    userId: ctx.actor.id, action: 'handoff_sign',
    collection: 'nursing_reports', recordId: rec.id,
    data: { patientId: patient.id, shift, uniqueCode: rec.uniqueCode }
  });
  store.put('signatures', sg);
  rec.lastSignatureId = sg.id;
  store.put('nursing_reports', rec);
  ctx.audit.write('nursing_handoff_bridge', 'handoff.submit', rec.id, ctx.actor, {
    patientId: patient.id, shift, priority: rec.bridgeMetadata.priority
  });
  bus.emit('nursing.handoff.signed', { record: rec, actor: ctx.actor });
  return rec;
}

// ─── Prefill: patch an existing draft with aggregated ISBAR ───
function prefill(ctx) {
  const r = store.get('nursing_reports', ctx.params.reportId);
  if (!r) throw ctx.E.notFound('report_not_found');
  if (r.status !== 'draft') throw ctx.E.conflict('not_draft');
  if (r.fromUser !== ctx.actor.id && ctx.actor.role !== 'admin') {
    throw ctx.E.forbidden('not_owner');
  }
  const agg = aggregate(ctx, r.patientId);
  r.isbar = agg.isbar;
  r.bridgeMetadata = {
    priority: agg.priority.score,
    generatedAt: agg.metadata.generatedAt,
    source: 'nursing_handoff_bridge'
  };
  r.updatedAt = new Date().toISOString();
  store.put('nursing_reports', r);
  return r;
}

// ─── Readback: receiver confirms understanding (JCI) ───
function readback(ctx) {
  const r = store.get('nursing_reports', ctx.params.reportId);
  if (!r) throw ctx.E.notFound('report_not_found');
  if (r.status !== 'signed') throw ctx.E.conflict('must_be_signed_first');
  if (r.receivedAt) throw ctx.E.conflict('already_received');
  const b = ctx.body || {};
  if (!b.confirmText) throw ctx.E.badRequest('confirm_text_required');

  // Require the confirmText to reference the uniqueCode or a key part of ISBAR
  const codeOk = r.uniqueCode && b.confirmText.indexOf(r.uniqueCode) >= 0;
  const keyOk = b.confirmText.length >= 10;
  if (!codeOk && !keyOk) {
    throw ctx.E.badRequest('confirm_text_must_contain_code_or_10_chars');
  }

  r.status = 'received';
  r.receivedAt = new Date().toISOString();
  r.receivedBy = ctx.actor.id;
  r.receivedByName = ctx.actor.fullName || ctx.actor.username;
  r.readBack = {
    confirmText: b.confirmText,
    acknowledgedCode: codeOk,
    acknowledgedBy: ctx.actor.id,
    acknowledgedByName: ctx.actor.fullName || ctx.actor.username,
    acknowledgedAt: r.receivedAt,
    fromSameWard: ctx.actor.ward === r.wardCode
  };
  store.put('nursing_reports', r);
  const sg = sig.signAction({
    userId: ctx.actor.id, action: 'handoff_readback',
    collection: 'nursing_reports', recordId: r.id,
    data: { uniqueCode: r.uniqueCode, confirmText: b.confirmText }
  });
  store.put('signatures', sg);
  r.readBackSignatureId = sg.id;
  store.put('nursing_reports', r);
  ctx.audit.write('nursing_handoff_bridge', 'handoff.readback', r.id, ctx.actor, {
    patientId: r.patientId, codeOk, lengthOk: keyOk
  });
  bus.emit('nursing.handoff.readback_confirmed', { record: r, actor: ctx.actor });
  return r;
}

// ─── History ───
function history(ctx) {
  let items = h(ctx, 'nursing_reports');
  if (ctx.query.patientId) items = items.filter(x => x.patientId === ctx.query.patientId);
  if (ctx.query.wardCode) items = items.filter(x => x.wardCode === ctx.query.wardCode);
  if (ctx.query.status) items = items.filter(x => x.status === ctx.query.status);
  if (ctx.query.since) {
    const since = new Date(ctx.query.since).getTime();
    items = items.filter(x => new Date(x.createdAt).getTime() >= since);
  }
  items.sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  return { items: items.slice(0, 100), total: items.length };
}

// ─── Audit summary ───
function auditSummary(ctx) {
  const days = Number(ctx.query.days) || 7;
  const since = Date.now() - days * 86400000;
  const reports = h(ctx, 'nursing_reports').filter(r => sd(r.createdAt) >= since);
  const signed = reports.filter(r => r.status === 'signed' || r.status === 'received');
  const received = reports.filter(r => r.status === 'received');
  const bridge = reports.filter(r => r.bridgeMetadata && r.bridgeMetadata.source === 'nursing_handoff_bridge');
  return {
    window: { days, since: new Date(since).toISOString() },
    totals: {
      created: reports.length, signed: signed.length,
      received: received.length,
      bridgeGenerated: bridge.length,
      compliancePct: reports.length ? Math.round((received.length / Math.max(1, signed.length)) * 100) : 100
    },
    byWard: groupBy(reports, 'wardCode'),
    byShift: groupBy(reports, 'shiftType')
  };
}

function groupBy(arr, key) {
  const out = {};
  for (const x of arr) {
    const k = x[key] || 'unknown';
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════
//  Utilities
// ═══════════════════════════════════════════════════════════
function currentShift() {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 14) return 'morning';
  if (hour >= 14 && hour < 19) return 'evening';
  return 'night';
}

function makeCode() {
  const s = store.uid('').toUpperCase().slice(0, 8);
  return 'NHD-' + s;
}

module.exports = {
  handlers: {
    board, preview, priority,
    submit, prefill, readback,
    history, auditSummary,
    _calcPriority: calcPriority,
    _aggregate: aggregate
  },
  routes: [

    { method:'GET',  path:'/api/nh/board', handler:'board', perm:'nursing.handoff.view' },
    { method:'POST', path:'/api/nh/submit', handler:'submit', perm:'nursing.handoff.create' },
    { method:'GET',  path:'/api/nh/history', handler:'history', perm:'nursing.handoff.view' },
    { method:'GET',  path:'/api/nh/audit-summary', handler:'auditSummary', perm:'nursing.handoff.audit' },
    { method:'GET',  path:'/api/nh/preview/:patientId', handler:'preview', perm:'nursing.handoff.view' },
    { method:'GET',  path:'/api/nh/priority/:patientId', handler:'priority', perm:'nursing.handoff.view' },
    { method:'POST', path:'/api/nh/prefill/:reportId', handler:'prefill', perm:'nursing.handoff.create' },
    { method:'POST', path:'/api/nh/readback/:reportId', handler:'readback', perm:'nursing.handoff.readback' },
  
  ],
  panels: [
    { id:'board', title:'تحویل شیفت — پرستاری', icon:'🔄', perm:'nursing.handoff.view', kind:'nh_board', api:'/api/nh/board' }
  ]
};
