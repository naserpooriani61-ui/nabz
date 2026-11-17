'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Nursing Critical: Transfusion Safety + Ventilator Mgmt
//  Standards: JCI IPSG.3 · AABB 2023 · ATS/IDSA VAP · ARDSNet
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const store = require('../core/store');
const bus = require('../core/events');
const perms = require('../core/permissions');

if (!perms.P['nc.transfusion']) Object.assign(perms.P, { 'nc.transfusion':'admin,attending,specialist,resident,head_nurse,nurse' });
if (!perms.P['nc.ventilator'])  Object.assign(perms.P, { 'nc.ventilator':'admin,attending,specialist,resident,head_nurse,nurse' });

// ═══════════════════════════════════════════════════════════
//  TRANSFUSION SAFETY
// ═══════════════════════════════════════════════════════════
const TX_CHECKS = ['identity','bloodType','unitNumber','expiry','crossmatch','bag','consent','ivAccess','baselineVitals','twoPerson'];
const TX_REACTIONS = {
  fnhtr:        { fa:'تب/لرز (FNHTR)',        severity:'medium', action:'meperidine+antipyretic' },
  allergic:     { fa:'آلرژیک (کهیر)',         severity:'medium', action:'diphenhydramine' },
  anaphylactic: { fa:'آنافیلاکسی',             severity:'critical', action:'epinephrine IM' },
  hemolytic:    { fa:'همولیتیک حاد',           severity:'critical', action:'STOP + aggressive fluids + blood bank' },
  trali:        { fa:'TRALI (ادم ریه)',        severity:'critical', action:'O2 + ventilation + notify' },
  taco:         { fa:'TACO (بار حجمی)',        severity:'high', action:'diuretics + sit up' },
  bacterial:    { fa:'آلودگی باکتریایی',       severity:'critical', action:'STOP + cultures + antibiotics' },
  gvhd:         { fa:'GVHD',                   severity:'high', action:'notify blood bank' }
};

function transfusionStart(ctx) {
  const b = ctx.body || {};
  if (!b.patientId) throw ctx.E.badRequest('patient_id_required');
  if (!b.bloodRequestId) throw ctx.E.badRequest('blood_request_id_required');
  const patient = store.get('patients', b.patientId);
  if (!patient) throw ctx.E.notFound('patient_not_found');
  const req = store.get('blood_requests', b.bloodRequestId);
  if (!req) throw ctx.E.notFound('blood_request_not_found');
  if (req.status !== 'issued') throw ctx.E.conflict('must_be_issued:' + req.status);
  if (req.patientId !== patient.id) throw ctx.E.conflict('patient_mismatch');

  // 2-person verification
  if (!b.secondCheckerId) throw ctx.E.badRequest('two_person_required');
  if (b.secondCheckerId === ctx.actor.id) throw ctx.E.badRequest('second_checker_must_differ');
  const witness = h(ctx, 'users').find(u => u.id === b.secondCheckerId || u.username === b.secondCheckerId);
  if (!witness) throw ctx.E.badRequest('second_checker_not_valid');
  if (!['admin','nurse','head_nurse','attending','specialist','resident','physician'].includes(witness.role)) {
    throw ctx.E.badRequest('second_checker_invalid_role');
  }

  // 10-item pre-transfusion checklist
  const checklist = b.checklist || {};
  const missing = TX_CHECKS.filter(k => !checklist[k]);
  if (missing.length) throw ctx.E.conflict('checklist_incomplete:' + missing.join(','));

  // Baseline vitals
  const baseline = b.baselineVitals || {};
  if (baseline.temp == null || baseline.hr == null || baseline.bp_sys == null) {
    throw ctx.E.badRequest('baseline_temp_hr_bp_required');
  }

  const now = Date.now();
  const rec = {
    id: ctx.uid('tx'),
    patientId: patient.id,
    patientName: patient.firstName + ' ' + patient.lastName,
    wardCode: patient.wardCode, bedNumber: patient.bedNumber,
    bloodRequestId: req.id,
    productType: req.productType, units: req.units,
    donorBloodType: (req.crossmatch && req.crossmatch.donor) || null,
    unitNumber: b.unitNumber || ('UNIT-' + Date.now().toString(36).toUpperCase()),
    expiry: b.expiry || null,
    primaryNurseId: ctx.actor.id,
    primaryNurseName: ctx.actor.fullName || ctx.actor.username,
    secondCheckerId: witness.id,
    secondCheckerName: witness.fullName || witness.username,
    checklist,
    baselineVitals: {
      temp: Number(baseline.temp), hr: Number(baseline.hr),
      bp_sys: Number(baseline.bp_sys), bp_dia: Number(baseline.bp_dia || 0),
      rr: Number(baseline.rr || 0), spo2: Number(baseline.spo2 || 0)
    },
    startedAt: new Date(now).toISOString(),
    scheduledChecks: [
      { offsetMin: 15, label: '۱۵ دقیقه', dueAt: new Date(now + 15*60000).toISOString(), done: false },
      { offsetMin: 30, label: '۳۰ دقیقه', dueAt: new Date(now + 30*60000).toISOString(), done: false },
      { offsetMin: 60, label: '۱ ساعت',   dueAt: new Date(now + 60*60000).toISOString(), done: false },
      { offsetMin: 120, label: '۲ ساعت',  dueAt: new Date(now + 120*60000).toISOString(), done: false }
    ],
    vitalLogs: [],
    status: 'running',
    reaction: null,
    completedAt: null,
    notes: String(b.notes || '').slice(0, 1000)
  };
  store.put('transfusions', rec);

  // Mark blood_request transfused
  req.status = 'transfused';
  req.transfusedAt = new Date(now).toISOString();
  req.transfusedBy = ctx.actor.id;
  req.transfusedByName = rec.primaryNurseName;
  req.secondChecker = witness.id;
  req.secondCheckerName = rec.secondCheckerName;
  req.transfusionId = rec.id;
  store.put('blood_requests', req);

  ctx.audit.write('nursing_critical', 'transfusion.start', rec.id, ctx.actor, { productType: req.productType, units: req.units });
  bus.emit('transfusion.started', { record: rec, actor: ctx.actor });
  bus.emit('cdss.alert', {
    type:'transfusion_active', severity:'high',
    patientId: patient.id, patientName: rec.patientName,
    title:'🩸 ترانسفوزیون فعال — ' + rec.patientName,
    message: req.productType + ' ' + req.units + ' واحد — پایش ۱۵ دقیقه',
    recommendation: 'ویزال در t=15min، 30min، 1h، 2h — هر واکنش → STOP'
  });
  return rec;
}

function transfusionRecordVital(ctx) {
  const rec = store.get('transfusions', ctx.params.id);
  if (!rec) throw ctx.E.notFound('transfusion_not_found');
  if (rec.status !== 'running') throw ctx.E.conflict('not_running:' + rec.status);
  const b = ctx.body || {};
  if (b.temp == null || b.hr == null || b.bp_sys == null) throw ctx.E.badRequest('vitals_required');
  const vit = {
    at: new Date().toISOString(),
    temp: Number(b.temp), hr: Number(b.hr),
    bp_sys: Number(b.bp_sys), bp_dia: Number(b.bp_dia || 0),
    rr: Number(b.rr || 0), spo2: Number(b.spo2 || 0),
    by: ctx.actor.id, byName: ctx.actor.fullName || ctx.actor.username,
    notes: String(b.notes || '').slice(0, 300)
  };
  rec.vitalLogs.push(vit);

  // Reaction detection
  const base = rec.baselineVitals;
  const warnings = [];
  if (vit.temp - base.temp >= 1) warnings.push('تب افزایش ≥۱°C');
  if (vit.temp >= 39) warnings.push('تب ≥ ۳۹°C');
  if (vit.hr - base.hr >= 20) warnings.push('تاکی‌کاردی +۲۰');
  if (base.bp_sys > 0 && vit.bp_sys < base.bp_sys - 30) warnings.push('افت SBP > ۳۰');
  if (vit.bp_sys < 90) warnings.push('هیپوتنشن SBP < ۹۰');
  if (base.spo2 > 0 && vit.spo2 < base.spo2 - 5) warnings.push('افت SpO₂ > ۵٪');
  if (vit.spo2 > 0 && vit.spo2 < 90) warnings.push('SpO₂ < ۹۰٪');
  if (b.rash) warnings.push('راش/کهیر');
  if (b.dyspnea) warnings.push('تنگی نفس');
  if (b.backPain) warnings.push('درد کمر');
  if (b.darkUrine) warnings.push('ادرار تیره');

  // Mark matched scheduled check as done
  const now = Date.now();
  for (const sch of rec.scheduledChecks) {
    if (!sch.done && sd(sch.dueAt) <= now + 5*60000) { sch.done = true; sch.doneAt = vit.at; break; }
  }

  rec.vitalLogs[rec.vitalLogs.length - 1].warnings = warnings;
  store.put('transfusions', rec);

  if (warnings.length >= 2) {
    bus.emit('cdss.alert', {
      type:'transfusion_reaction_suspect', severity:'critical',
      patientId: rec.patientId, patientName: rec.patientName,
      title:'🚨 واکنش ترانسفوزیون مشکوک — ' + rec.patientName,
      message: warnings.join(' · '),
      recommendation: 'STOP فوری — NS باز نگهدار — پزشک — کیسه به بانک خون'
    });
  }
  ctx.audit.write('nursing_critical', 'transfusion.vital', rec.id, ctx.actor, { warnings: warnings.length });
  bus.emit('transfusion.vital', { record: rec, vital: vit, warnings, actor: ctx.actor });
  return { record: rec, vital: vit, warnings, requiresAction: warnings.length >= 2 };
}

function transfusionReaction(ctx) {
  const rec = store.get('transfusions', ctx.params.id);
  if (!rec) throw ctx.E.notFound('transfusion_not_found');
  if (rec.status !== 'running') throw ctx.E.conflict('not_running');
  const b = ctx.body || {};
  if (!b.reactionType || !TX_REACTIONS[b.reactionType]) throw ctx.E.badRequest('invalid_reaction_type');
  const info = TX_REACTIONS[b.reactionType];
  rec.status = 'stopped_reaction';
  rec.reaction = {
    type: b.reactionType,
    fa: info.fa,
    severity: info.severity,
    action: info.action,
    findings: String(b.findings || '').slice(0, 1000),
    stoppedAt: new Date().toISOString(),
    stoppedBy: ctx.actor.id,
    stoppedByName: ctx.actor.fullName || ctx.actor.username,
    notifiedPhysician: b.notifiedPhysician === true,
    bagReturned: b.bagReturned === true,
    bloodBankNotified: b.bloodBankNotified === true
  };
  rec.completedAt = new Date().toISOString();
  store.put('transfusions', rec);
  ctx.audit.write('nursing_critical', 'transfusion.reaction', rec.id, ctx.actor, { type: b.reactionType });
  bus.emit('transfusion.reaction', { record: rec, actor: ctx.actor });
  bus.emit('cdss.alert', {
    type:'transfusion_reaction', severity: info.severity === 'critical' ? 'critical' : 'high',
    patientId: rec.patientId, patientName: rec.patientName,
    title:'🚨 واکنش ترانسفوزیون: ' + info.fa,
    message: 'اقدام: ' + info.action,
    recommendation: 'گزارش به بانک خون + مستندسازی کامل'
  });
  return rec;
}

function transfusionComplete(ctx) {
  const rec = store.get('transfusions', ctx.params.id);
  if (!rec) throw ctx.E.notFound('transfusion_not_found');
  if (rec.status !== 'running') throw ctx.E.conflict('not_running');
  const b = ctx.body || {};
  // Require at least 3 vital checks for a full unit
  if (rec.vitalLogs.length < 3 && !b.forceComplete) {
    throw ctx.E.conflict('need_at_least_3_vital_checks_or_force');
  }
  rec.status = 'completed';
  rec.completedAt = new Date().toISOString();
  rec.completedBy = ctx.actor.id;
  rec.completedByName = ctx.actor.fullName || ctx.actor.username;
  rec.finalNote = String(b.note || '').slice(0, 1000);
  rec.postVitals = b.postVitals ? { temp: Number(b.postVitals.temp), hr: Number(b.postVitals.hr), bp_sys: Number(b.postVitals.bp_sys), bp_dia: Number(b.postVitals.bp_dia||0), spo2: Number(b.postVitals.spo2||0) } : null;
  store.put('transfusions', rec);
  ctx.audit.write('nursing_critical', 'transfusion.complete', rec.id, ctx.actor, { vitalCount: rec.vitalLogs.length });
  bus.emit('transfusion.completed', { record: rec, actor: ctx.actor });
  return rec;
}

function transfusionActive(ctx) {
  const items = h(ctx, 'transfusions').filter(t => t.status === 'running');
  return {
    items: items.map(t => ({ ...t, nextCheck: t.scheduledChecks.find(c => !c.done), elapsedMin: Math.round((Date.now()-sd(t.startedAt))/60000) })),
    total: items.length
  };
}

function transfusionHistory(ctx) {
  const pid = ctx.query.patientId;
  let items = h(ctx, 'transfusions');
  if (pid) items = items.filter(t => t.patientId === pid);
  items = items.sort((a, b) => sd(b.startedAt) - sd(a.startedAt)).slice(0, 30);
  return { items, total: items.length };
}

function transfusionCompliance(ctx) {
  const days = Math.min(30, Number(ctx.query.days) || 7);
  const since = Date.now() - days*86400000;
  const all = h(ctx, 'transfusions').filter(t => sd(t.startedAt) >= since);
  const complete = all.filter(t => t.status === 'completed');
  const withReaction = all.filter(t => t.reaction);
  // Compliance: how many had ≥3 vital checks
  const wellMonitored = all.filter(t => (t.vitalLogs || []).length >= 3);
  // On-time first check (within 20 min)
  const onTime15 = all.filter(t => {
    const first = (t.vitalLogs || [])[0];
    if (!first) return false;
    return (sd(first.at) - sd(t.startedAt)) <= 20*60000;
  });
  return {
    window: { days, since: new Date(since).toISOString() },
    total: all.length,
    completed: complete.length,
    reactions: withReaction.length,
    reactionRate: all.length > 0 ? Math.round((withReaction.length/all.length)*1000)/10 : 0,
    monitoringCompliance: all.length > 0 ? Math.round((wellMonitored.length/all.length)*100) : 100,
    firstCheckOnTime: all.length > 0 ? Math.round((onTime15.length/all.length)*100) : 100,
    reactionsDetail: withReaction.map(t => ({ id: t.id, patientName: t.patientName, type: t.reaction.fa, severity: t.reaction.severity, at: t.reaction.stoppedAt }))
  };
}

function transfusionPrint(ctx) {
  const rec = store.get('transfusions', ctx.params.id);
  if (!rec) throw ctx.E.notFound('transfusion_not_found');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = iso => { try { return new Date(iso).toLocaleString('fa-IR'); } catch(_) { return '—'; } };
  const fmtTime = iso => { try { return new Date(iso).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}); } catch(_) { return '—'; } };
  let body = '';
  body += '<div style="text-align:center;border-bottom:2px solid #0891b2;padding-bottom:8px;margin-bottom:14px">';
  body += '<div style="font-size:18px;font-weight:900;color:#0891b2">🫀 بیمارستان سینا</div>';
  body += '<div style="font-size:11px;color:#64748b">Blood Transfusion Record — JCI IPSG.3</div>';
  body += '</div>';
  body += '<table style="width:100%;font-size:11px;margin-bottom:12px;border-collapse:collapse">';
  body += '<tr><td style="padding:4px;border:1px solid #cbd5e1"><b>بیمار:</b> ' + esc(rec.patientName) + '</td><td style="padding:4px;border:1px solid #cbd5e1"><b>بخش:</b> ' + esc(rec.wardCode) + '</td><td style="padding:4px;border:1px solid #cbd5e1"><b>تخت:</b> ' + esc(rec.bedNumber||'') + '</td></tr>';
  body += '<tr><td style="padding:4px;border:1px solid #cbd5e1"><b>محصول:</b> ' + esc(rec.productType) + '</td><td style="padding:4px;border:1px solid #cbd5e1"><b>واحد:</b> ' + rec.units + '</td><td style="padding:4px;border:1px solid #cbd5e1"><b>گروه خونی:</b> ' + esc(rec.donorBloodType||'—') + '</td></tr>';
  body += '<tr><td colspan="2" style="padding:4px;border:1px solid #cbd5e1"><b>شماره واحد:</b> ' + esc(rec.unitNumber) + '</td><td style="padding:4px;border:1px solid #cbd5e1"><b>انقضا:</b> ' + esc(rec.expiry||'—') + '</td></tr>';
  body += '<tr><td style="padding:4px;border:1px solid #cbd5e1"><b>پرستار اصلی:</b> ' + esc(rec.primaryNurseName) + '</td><td colspan="2" style="padding:4px;border:1px solid #cbd5e1"><b>چک دوم:</b> ' + esc(rec.secondCheckerName) + '</td></tr>';
  body += '<tr><td colspan="3" style="padding:4px;border:1px solid #cbd5e1"><b>شروع:</b> ' + fmt(rec.startedAt) + ' · <b>پایان:</b> ' + (rec.completedAt ? fmt(rec.completedAt) : '—') + '</td></tr>';
  body += '</table>';
  body += '<div style="font-size:12px;font-weight:900;color:#0891b2;margin:12px 0 6px">✅ چک‌لیست ۱۰ آیتمی</div>';
  body += '<table style="width:100%;font-size:10.5px;border-collapse:collapse"><tr>';
  for (let i = 0; i < TX_CHECKS.length; i++) {
    body += '<td style="padding:4px;border:1px solid #cbd5e1;text-align:center">' + (rec.checklist[TX_CHECKS[i]] ? '✅' : '❌') + '<br><span style="font-size:9px">' + TX_CHECKS[i] + '</span></td>';
  }
  body += '</tr></table>';
  body += '<div style="font-size:12px;font-weight:900;color:#0891b2;margin:12px 0 6px">📊 ویتال‌ها</div>';
  body += '<table style="width:100%;font-size:10.5px;border-collapse:collapse"><thead><tr style="background:#e0f2fe"><th style="padding:4px;border:1px solid #cbd5e1">زمان</th><th style="padding:4px;border:1px solid #cbd5e1">T</th><th style="padding:4px;border:1px solid #cbd5e1">HR</th><th style="padding:4px;border:1px solid #cbd5e1">BP</th><th style="padding:4px;border:1px solid #cbd5e1">RR</th><th style="padding:4px;border:1px solid #cbd5e1">SpO₂</th><th style="padding:4px;border:1px solid #cbd5e1">ثبت‌کننده</th></tr></thead><tbody>';
  body += '<tr style="background:#f0f9ff"><td style="padding:4px;border:1px solid #cbd5e1">Baseline</td><td style="padding:4px;border:1px solid #cbd5e1">' + rec.baselineVitals.temp + '</td><td style="padding:4px;border:1px solid #cbd5e1">' + rec.baselineVitals.hr + '</td><td style="padding:4px;border:1px solid #cbd5e1">' + rec.baselineVitals.bp_sys + '/' + rec.baselineVitals.bp_dia + '</td><td style="padding:4px;border:1px solid #cbd5e1">' + rec.baselineVitals.rr + '</td><td style="padding:4px;border:1px solid #cbd5e1">' + rec.baselineVitals.spo2 + '</td><td style="padding:4px;border:1px solid #cbd5e1">—</td></tr>';
  for (const v of (rec.vitalLogs || [])) {
    const warn = v.warnings && v.warnings.length ? '⚠️' : '';
    body += '<tr><td style="padding:4px;border:1px solid #cbd5e1">' + fmtTime(v.at) + ' ' + warn + '</td><td style="padding:4px;border:1px solid #cbd5e1">' + v.temp + '</td><td style="padding:4px;border:1px solid #cbd5e1">' + v.hr + '</td><td style="padding:4px;border:1px solid #cbd5e1">' + v.bp_sys + '/' + v.bp_dia + '</td><td style="padding:4px;border:1px solid #cbd5e1">' + v.rr + '</td><td style="padding:4px;border:1px solid #cbd5e1">' + v.spo2 + '</td><td style="padding:4px;border:1px solid #cbd5e1">' + esc(v.byName) + '</td></tr>';
  }
  body += '</tbody></table>';
  if (rec.reaction) {
    body += '<div style="background:#fef2f2;border:2px solid #dc2626;border-radius:6px;padding:8px;margin-top:12px">';
    body += '<div style="font-weight:900;color:#dc2626">🚨 واکنش: ' + esc(rec.reaction.fa) + '</div>';
    body += '<div style="font-size:11px;margin-top:4px">اقدام: ' + esc(rec.reaction.action) + '</div>';
    body += '<div style="font-size:11px">زمان توقف: ' + fmt(rec.reaction.stoppedAt) + ' · توسط: ' + esc(rec.reaction.stoppedByName) + '</div>';
    body += '<div style="font-size:10px;margin-top:2px">پزشک مطلع: ' + (rec.reaction.notifiedPhysician ? '✅' : '❌') + ' · کیسه به بانک: ' + (rec.reaction.bagReturned ? '✅' : '❌') + '</div>';
    body += '</div>';
  }
  body += '<div style="margin-top:30px;display:flex;justify-content:space-around;font-size:11px">';
  body += '<div style="text-align:center"><div style="border-top:1px solid #64748b;padding-top:4px;width:180px">پرستار اصلی</div></div>';
  body += '<div style="text-align:center"><div style="border-top:1px solid #64748b;padding-top:4px;width:180px">چک دوم</div></div>';
  body += '<div style="text-align:center"><div style="border-top:1px solid #64748b;padding-top:4px;width:180px">پزشک</div></div>';
  body += '</div>';
  return {
    html: '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><title>Blood Transfusion — ' + esc(rec.patientName) + '</title><style>@page{size:A4;margin:12mm}body{font-family:Vazirmatn,Tahoma,sans-serif;font-size:11px}</style></head><body>' + body + '</body></html>',
    title: 'Blood Transfusion — ' + rec.patientName
  };
}

// ═══════════════════════════════════════════════════════════
//  VENTILATOR
// ═══════════════════════════════════════════════════════════
const VENT_MODES = ['AC/VC','AC/PC','SIMV','PSV','CPAP','PRVC','APRV','HFNC','NIV','Room Air'];

function interpretABG(ph, pco2, po2, hco3, fio2) {
  ph = Number(ph); pco2 = Number(pco2); po2 = Number(po2); hco3 = Number(hco3); fio2 = Number(fio2) || 0.21;
  const acidemia = ph < 7.35;
  const alkalemia = ph > 7.45;
  let primary = 'normal', compensation = null, detail = '';

  if (acidemia) {
    if (pco2 > 45 && hco3 < 22) { primary = 'mixed_acidosis'; detail = 'Respiratory + Metabolic'; }
    else if (pco2 > 45) primary = 'respiratory_acidosis';
    else if (hco3 < 22) primary = 'metabolic_acidosis';
  } else if (alkalemia) {
    if (pco2 < 35 && hco3 > 26) { primary = 'mixed_alkalosis'; detail = 'Respiratory + Metabolic'; }
    else if (pco2 < 35) primary = 'respiratory_alkalosis';
    else if (hco3 > 26) primary = 'metabolic_alkalosis';
  } else if (pco2 > 45 || hco3 < 22) {
    primary = 'compensated_metabolic_acidosis';
  } else if (pco2 < 35 || hco3 > 26) {
    primary = 'compensated_metabolic_alkalosis';
  }

  if (primary === 'metabolic_acidosis' || primary === 'mixed_acidosis') {
    const expected = 1.5 * hco3 + 8;
    const diff = pco2 - expected;
    if (diff > 2) { compensation = 'respiratory_acidosis_added'; }
    else if (diff < -2) { compensation = 'respiratory_alkalosis_added'; }
    else { compensation = 'appropriate_compensation'; }
    detail += 'Winter: expected pCO2 ' + expected.toFixed(1) + ' ± 2 · measured ' + pco2;
  }

  if (primary === 'metabolic_alkalosis' || primary === 'mixed_alkalosis') {
    const expected = 0.7 * hco3 + 21;
    const diff = pco2 - expected;
    if (Math.abs(diff) > 2) { compensation = 'concurrent_respiratory_disorder'; }
    else { compensation = 'appropriate_compensation'; }
    detail = 'Expected pCO2 ' + expected.toFixed(1) + ' ± 2 · measured ' + pco2;
  }

  if (primary === 'respiratory_acidosis' || primary === 'respiratory_alkalosis') {
    const pco2Deviation = pco2 - 40;
    const acuteHco3 = 24 + (pco2Deviation / 10) * 1;
    const chronicHco3 = 24 + (pco2Deviation / 10) * 3.5;
    const acuteMatch = Math.abs(hco3 - acuteHco3) < 2;
    const chronicMatch = Math.abs(hco3 - chronicHco3) < 2;
    if (acuteMatch && !chronicMatch) { detail = 'Acute (HCO3 ' + hco3 + ' ≈ expected ' + acuteHco3.toFixed(1) + ')'; }
    else if (chronicMatch && !acuteMatch) { detail = 'Chronic (HCO3 ' + hco3 + ' ≈ expected ' + chronicHco3.toFixed(1) + ')'; }
    else if (acuteMatch && chronicMatch) { detail = 'Acute-on-chronic or mixed'; }
    else { detail = 'Mixed — expected acute ' + acuteHco3.toFixed(1) + ' or chronic ' + chronicHco3.toFixed(1); }
  }

  // A-a gradient and P/F ratio
  const PAO2 = fio2 * (760 - 47) - (pco2 / 0.8);
  const aaGradient = Math.round((PAO2 - po2) * 10) / 10;
  const pfRatio = fio2 > 0 ? Math.round(po2 / fio2) : null;

  let hypoxemia = 'normal';
  if (po2 < 60) hypoxemia = 'severe';
  else if (po2 < 80) hypoxemia = 'moderate';
  else if (po2 < 100 && fio2 >= 0.21) hypoxemia = 'mild';

  let ardsSeverity = null;
  if (pfRatio != null) {
    if (pfRatio < 100) ardsSeverity = 'severe';
    else if (pfRatio < 200) ardsSeverity = 'moderate';
    else if (pfRatio < 300) ardsSeverity = 'mild';
  }

  return { ph, pco2, po2, hco3, fio2, primary, compensation, detail, aaGradient, pfRatio, hypoxemia, ardsSeverity };
}

function ventInit(ctx) {
  const b = ctx.body || {};
  if (!b.patientId) throw ctx.E.badRequest('patient_id_required');
  if (!b.mode || !VENT_MODES.includes(b.mode)) throw ctx.E.badRequest('invalid_mode');
  const p = store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');
  // Check existing
  const existing = h(ctx, 'ventilator_settings').find(v => v.patientId === b.patientId && v.status === 'active');
  if (existing) throw ctx.E.conflict('already_on_ventilator');
  const rec = {
    id: ctx.uid('vent'),
    patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode,
    mode: b.mode,
    fio2: Number(b.fio2) || 0.21,
    peep: Number(b.peep) || 5,
    vt: Number(b.vt) || null,          // mL
    rr: Number(b.rr) || null,
    ppeak: Number(b.ppeak) || null,
    pplat: Number(b.pplat) || null,
    flow: Number(b.flow) || null,
    sensitivity: Number(b.sensitivity) || null,
    heightCm: Number(b.heightCm) || null,
    ibwKg: Number(b.ibwKg) || null,
    status: 'active',
    startedAt: new Date().toISOString(),
    startedBy: ctx.actor.id, startedByName: ctx.actor.fullName || ctx.actor.username,
    history: [],
    notes: String(b.notes || '').slice(0, 1000)
  };
  // Compute IBW if height provided
  if (rec.heightCm && !rec.ibwKg && p.sex) {
    const heightIn = rec.heightCm / 2.54;
    rec.ibwKg = p.sex === 'female' ? 45.5 + 2.3*(heightIn - 60) : 50 + 2.3*(heightIn - 60);
    rec.ibwKg = Math.round(rec.ibwKg * 10) / 10;
  }
  store.put('ventilator_settings', rec);
  ctx.audit.write('nursing_critical', 'vent.init', rec.id, ctx.actor, { mode: rec.mode });
  bus.emit('ventilator.started', { record: rec, actor: ctx.actor });
  return rec;
}

function ventUpdate(ctx) {
  const v = store.get('ventilator_settings', ctx.params.id);
  if (!v) throw ctx.E.notFound('ventilator_not_found');
  if (v.status !== 'active') throw ctx.E.conflict('not_active');
  const b = ctx.body || {};
  if (!b.changes || typeof b.changes !== 'object') throw ctx.E.badRequest('changes_required');
  if (!b.reason || b.reason.length < 5) throw ctx.E.badRequest('reason_min_5_chars');
  const before = {};
  const allowed = ['mode','fio2','peep','vt','rr','ppeak','pplat','flow','sensitivity'];
  for (const k of Object.keys(b.changes)) {
    if (!allowed.includes(k)) continue;
    before[k] = v[k];
    v[k] = k === 'mode' ? String(b.changes[k]) : Number(b.changes[k]);
  }
  const after = {};
  for (const k of Object.keys(before)) after[k] = v[k];
  const log = {
    at: new Date().toISOString(),
    by: ctx.actor.id, byName: ctx.actor.fullName || ctx.actor.username,
    before, after, reason: String(b.reason).slice(0, 500)
  };
  v.history = v.history || [];
  v.history.push(log);
  v.lastUpdatedAt = log.at;
  store.put('ventilator_settings', v);

  // Safety alerts on dangerous settings
  const alerts = [];
  if (v.pplat && v.pplat > 30) alerts.push('Pplat > 30 — خطر باروتروما');
  if (v.vt && v.ibwKg && v.vt > v.ibwKg * 8) alerts.push('VT > 8 ml/kg IBW — از lung protective خارج');
  if (v.fio2 >= 0.6) alerts.push('FiO₂ ≥ 0.6 — خطر جذب نیتروژن');
  if (v.peep > 15) alerts.push('PEEP > 15 — ارزیابی hemodynamics');
  if (alerts.length) {
    bus.emit('cdss.alert', {
      type:'vent_dangerous_settings', severity:'warning',
      patientId: v.patientId, patientName: v.patientName,
      title:'⚠️ تنظیمات خطرناک ونتیلاتور',
      message: alerts.join(' · '),
      recommendation:'بازبینی توسط پزشک'
    });
  }
  ctx.audit.write('nursing_critical', 'vent.update', v.id, ctx.actor, { changes: Object.keys(before) });
  bus.emit('ventilator.updated', { record: v, log, actor: ctx.actor });
  return { record: v, log, alerts };
}

function ventCurrent(ctx) {
  const pid = ctx.params.patientId;
  const v = h(ctx, 'ventilator_settings').find(x => x.patientId === pid && x.status === 'active');
  if (!v) return { active: false };
  const p = store.get('patients', pid);
  // VAP bundle today?
  const today = new Date().toISOString().slice(0, 10);
  const vapToday = h(ctx, 'vap_bundles').find(vb => vb.patientId === pid && vb.date === today);
  // SBT candidates (last SBT within 24h)
  const lastSbt = h(ctx, 'sbt_trials').filter(s => s.patientId === pid).sort((a, b) => sd(b.startedAt) - sd(a.startedAt))[0];
  return { active: true, settings: v, vapToday: vapToday || null, lastSbt: lastSbt || null, patient: p ? { name: p.firstName + ' ' + p.lastName, ward: p.wardCode } : null };
}

function ventABG(ctx) {
  const b = ctx.body || {};
  if (!b.patientId) throw ctx.E.badRequest('patient_id_required');
  if (b.ph == null || b.pco2 == null) throw ctx.E.badRequest('ph_pco2_required');
  const result = interpretABG(b.ph, b.pco2, b.po2 || 0, b.hco3 || 24, b.fio2 || 0.21);
  // Save for history
  if (b.save !== false) {
    const rec = {
      id: ctx.uid('abg'),
      patientId: b.patientId,
      ph: result.ph, pco2: result.pco2, po2: result.po2, hco3: result.hco3, fio2: result.fio2,
      primary: result.primary, compensation: result.compensation, detail: result.detail,
      aaGradient: result.aaGradient, pfRatio: result.pfRatio, hypoxemia: result.hypoxemia, ardsSeverity: result.ardsSeverity,
      by: ctx.actor.id, byName: ctx.actor.fullName || ctx.actor.username,
      at: new Date().toISOString()
    };
    store.put('abg_interpretations', rec);
    ctx.audit.write('nursing_critical', 'vent.abg', rec.id, ctx.actor, { primary: result.primary });
  }
  return result;
}

function vapBundleCheck(ctx) {
  const b = ctx.body || {};
  if (!b.patientId) throw ctx.E.badRequest('patient_id_required');
  const today = new Date().toISOString().slice(0, 10);
  const items = {
    hob_30_45: b.hob_30_45 === true,
    oral_care_chg: b.oral_care_chg === true,
    sedation_vacation: b.sedation_vacation === true,
    dvt_prophylaxis: b.dvt_prophylaxis === true,
    pud_prophylaxis: b.pud_prophylaxis === true,
    cuff_pressure: b.cuff_pressure === true,
    subglottic_suction: b.subglottic_suction === true
  };
  const score = Object.values(items).filter(Boolean).length;
  const total = Object.keys(items).length;
  const existing = h(ctx, 'vap_bundles').find(vb => vb.patientId === b.patientId && vb.date === today);
  const rec = existing || { id: ctx.uid('vap'), patientId: b.patientId, date: today };
  rec.items = items;
  rec.score = score;
  rec.total = total;
  rec.compliancePct = Math.round((score/total)*100);
  rec.checkedBy = ctx.actor.id;
  rec.checkedByName = ctx.actor.fullName || ctx.actor.username;
  rec.checkedAt = new Date().toISOString();
  store.put('vap_bundles', rec);
  ctx.audit.write('nursing_critical', 'vent.vap', rec.id, ctx.actor, { score });
  if (score < total) {
    const missing = Object.entries(items).filter(([, v]) => !v).map(([k]) => k);
    bus.emit('cdss.alert', {
      type:'vap_noncompliant', severity:'warning',
      patientId: b.patientId, title:'⚠️ VAP Bundle ناقص',
      message: missing.join(' · '), recommendation:'تکمیل آیتم‌ها در همین شیفت'
    });
  }
  return rec;
}

function sbtReadiness(ctx) {
  const pid = ctx.params.patientId;
  const v = h(ctx, 'ventilator_settings').find(x => x.patientId === pid && x.status === 'active');
  if (!v) throw ctx.E.badRequest('not_on_ventilator');
  const criteria = {
    fio2_low: v.fio2 <= 0.4,
    peep_low: v.peep <= 8,
    no_high_vasopressor: true, // can be extended if pressor data exists
    adequate_ph: true,          // will be checked from last ABG
    adequate_oxygenation: true,
    hemodynamically_stable: true,
    afebrile: true,
    not_under_sedation: true
  };
  // Check last ABG if available
  const lastAbg = h(ctx, 'abg_interpretations').filter(a => a.patientId === pid).sort((a, b) => sd(b.at) - sd(a.at))[0];
  if (lastAbg) {
    criteria.adequate_ph = lastAbg.ph >= 7.30;
    criteria.adequate_oxygenation = lastAbg.po2 >= 60 && lastAbg.fio2 <= 0.4;
  }
  // Check last vitals
  const lastVital = h(ctx, 'vitals').filter(vt => vt.patientId === pid).sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt))[0];
  if (lastVital) {
    criteria.afebrile = (Number(lastVital.temp) || 37) < 38.3;
    criteria.hemodynamically_stable = (Number(lastVital.bp_sys) || 90) >= 90 && (Number(lastVital.hr) || 80) < 120;
  }
  const score = Object.values(criteria).filter(Boolean).length;
  const total = Object.keys(criteria).length;
  return {
    ready: score >= total - 1, // allow 1 miss
    score, total,
    criteria,
    recommendation: score >= total-1 ? 'می‌توان SBT را شروع کرد — اطلاع پزشک' : 'شرایط SBT فراهم نیست — ' + (total - score) + ' معیار ناموفق'
  };
}

function sbtStart(ctx) {
  const b = ctx.body || {};
  if (!b.patientId) throw ctx.E.badRequest('patient_id_required');
  const v = h(ctx, 'ventilator_settings').find(x => x.patientId === b.patientId && x.status === 'active');
  if (!v) throw ctx.E.badRequest('not_on_ventilator');
  const rec = {
    id: ctx.uid('sbt'),
    patientId: b.patientId,
    ventSettingsId: v.id,
    mode: b.mode || 'PSV 5/5 or T-piece',
    startedAt: new Date().toISOString(),
    plannedDurationMin: Number(b.plannedDurationMin) || 30,
    rsbiStart: null, rsbi30min: null,
    status: 'running',
    startedBy: ctx.actor.id, startedByName: ctx.actor.fullName || ctx.actor.username,
    notes: String(b.notes || '').slice(0, 500)
  };
  store.put('sbt_trials', rec);
  bus.emit('sbt.started', { record: rec, actor: ctx.actor });
  return rec;
}

function sbtComplete(ctx) {
  const s = store.get('sbt_trials', ctx.params.id);
  if (!s) throw ctx.E.notFound('sbt_not_found');
  if (s.status !== 'running') throw ctx.E.conflict('not_running');
  const b = ctx.body || {};
  // RSBI = RR / VT(L)
  const rr = Number(b.rr);
  const vt = Number(b.vt); // mL
  if (!rr || !vt) throw ctx.E.badRequest('rr_vt_required');
  const rsbi = Math.round(rr / (vt / 1000));
  s.rsbi30min = rsbi;
  s.rr = rr; s.vt = vt;
  s.success = rsbi < 105 && !b.distress && !b.accessoryMuscles;
  s.distress = b.distress === true;
  s.accessoryMuscles = b.accessoryMuscles === true;
  s.sweating = b.sweating === true;
  s.tachycardia = b.tachycardia === true;
  s.completedAt = new Date().toISOString();
  s.completedBy = ctx.actor.id;
  s.completedByName = ctx.actor.fullName || ctx.actor.username;
  s.status = 'completed';
  s.recommendation = s.success ? 'extubation_ready' : 'continue_ventilation';
  store.put('sbt_trials', s);
  ctx.audit.write('nursing_critical', 'vent.sbt', s.id, ctx.actor, { rsbi, success: s.success });
  bus.emit('sbt.completed', { record: s, actor: ctx.actor });
  return s;
}

function ventHistory(ctx) {
  const pid = ctx.params.patientId;
  const all = h(ctx, 'ventilator_settings').filter(v => v.patientId === pid).sort((a, b) => sd(b.startedAt) - sd(a.startedAt));
  return { items: all, total: all.length };
}

module.exports = {
  handlers: {
    transfusionStart, transfusionRecordVital, transfusionReaction, transfusionComplete,
    transfusionActive, transfusionHistory, transfusionCompliance, transfusionPrint,
    ventInit, ventUpdate, ventCurrent, ventABG, vapBundleCheck, sbtReadiness, sbtStart, sbtComplete, ventHistory,
    _interpretABG: interpretABG, _VENT_MODES: VENT_MODES, _TX_REACTIONS: TX_REACTIONS, _TX_CHECKS: TX_CHECKS
  },
  routes: [
    { method:'POST', path:'/api/nc/transfusion/start', handler:'transfusionStart', perm:'nc.transfusion' },
    { method:'POST', path:'/api/nc/transfusion/:id/vital', handler:'transfusionRecordVital', perm:'nc.transfusion' },
    { method:'POST', path:'/api/nc/transfusion/:id/reaction', handler:'transfusionReaction', perm:'nc.transfusion' },
    { method:'POST', path:'/api/nc/transfusion/:id/complete', handler:'transfusionComplete', perm:'nc.transfusion' },
    { method:'GET',  path:'/api/nc/transfusion/active', handler:'transfusionActive', perm:'nc.transfusion' },
    { method:'GET',  path:'/api/nc/transfusion/history', handler:'transfusionHistory', perm:'nc.transfusion' },
    { method:'GET',  path:'/api/nc/transfusion/compliance', handler:'transfusionCompliance', perm:'nc.transfusion' },
    { method:'GET',  path:'/api/nc/transfusion/:id/print', handler:'transfusionPrint', perm:'nc.transfusion' },
    { method:'POST', path:'/api/nc/vent/init', handler:'ventInit', perm:'nc.ventilator' },
    { method:'POST', path:'/api/nc/vent/:id/update', handler:'ventUpdate', perm:'nc.ventilator' },
    { method:'GET',  path:'/api/nc/vent/:patientId/current', handler:'ventCurrent', perm:'nc.ventilator' },
    { method:'POST', path:'/api/nc/vent/abg', handler:'ventABG', perm:'nc.ventilator' },
    { method:'POST', path:'/api/nc/vent/vap', handler:'vapBundleCheck', perm:'nc.ventilator' },
    { method:'GET',  path:'/api/nc/vent/:patientId/sbt-readiness', handler:'sbtReadiness', perm:'nc.ventilator' },
    { method:'POST', path:'/api/nc/vent/sbt/start', handler:'sbtStart', perm:'nc.ventilator' },
    { method:'POST', path:'/api/nc/vent/sbt/:id/complete', handler:'sbtComplete', perm:'nc.ventilator' },
    { method:'GET',  path:'/api/nc/vent/:patientId/history', handler:'ventHistory', perm:'nc.ventilator' }
  ],
  panels: []
};
console.log('[nursing-critical] loaded — transfusion + ventilator');
