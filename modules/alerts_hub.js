'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Alerts Hub (S6)
//  Unified patient-safety alert aggregation
//  Standards: JCI IPSG.2 (read-back), IPSG.3 (high-alert),
//             SSC 2021 (sepsis bundle), ISMP 2024 (High-Alert),
//             AHA/ACC (vitals trend), COP.5 (restraint)
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const bus = require('../core/events');
const store = require('../core/store');
const perms = require('../core/permissions');
const resolver = require('../core/ward-resolver');

if (!perms.P['alerts.view']) {
  perms.P['alerts.view'] = 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,supervisor_er,supervisor_infection,quality_officer,head_nurse,attending,specialist,surgeon,resident,intern,physician,nurse,nurse_aide,pharmacist,lab_tech,radiology_tech';
  perms.P['alerts.ack'] = 'admin,head_nurse,attending,specialist,surgeon,resident,intern,physician,nurse,pharmacist,lab_tech,radiology_tech';
  perms.P['alerts.dismiss'] = 'admin,head_nurse,attending,specialist,surgeon,resident,intern,physician,nurse,pharmacist,lab_tech,radiology_tech';
  perms.P['alerts.mute'] = 'admin,head_nurse,attending,specialist,surgeon,resident,intern,physician,nurse';
  perms.P['alerts.manage'] = 'admin,nursing_director,medical_director';
}

// ═══ SOURCES catalog ═══
const SOURCES = {
  cdss_drug_interaction:    { icon:'💊', label:'تداخل دارویی',   severity:'critical', cat:'medication', perm:'cdss.view' },
  cdss_allergy:             { icon:'⚠️', label:'آلرژی دارویی',  severity:'critical', cat:'medication', perm:'cdss.view' },
  cdss_qsofa:               { icon:'🦠', label:'qSOFA بالا',      severity:'high',     cat:'clinical',   perm:'cdss.view' },
  sepsis_suspected:         { icon:'🦠', label:'سپسیس مشکوک',   severity:'critical', cat:'clinical',   perm:'sepsis.view' },
  sepsis_bundle_incomplete: { icon:'⏱', label:'Bundle ناقص',    severity:'high',     cat:'clinical',   perm:'sepsis.view' },
  vitals_critical:          { icon:'📈', label:'NEWS بحرانی',   severity:'critical', cat:'vitals',     perm:'vitals.view' },
  vitals_worsening:         { icon:'📈', label:'NEWS بدتر شد',  severity:'high',     cat:'vitals',     perm:'vitals.view' },
  lab_critical:             { icon:'🧪', label:'Lab بحرانی',    severity:'critical', cat:'paraclinical', perm:'lab.view' },
  radiology_critical:       { icon:'🩻', label:'تصویر بحرانی',  severity:'critical', cat:'paraclinical', perm:'radiology.view' },
  mar_overdue:              { icon:'💊', label:'MAR دیرکرد',    severity:'high',     cat:'medication', perm:'kardex.view' },
  mar_missed:               { icon:'❌', label:'MAR missed',    severity:'high',     cat:'medication', perm:'kardex.view' },
  mar_high_alert_due:       { icon:'⚠️', label:'High-Alert در صف', severity:'high',  cat:'medication', perm:'kardex.view' },
  restraint_overdue:        { icon:'🔒', label:'محدودیت سررسید', severity:'critical', cat:'safety',    perm:'restraint.view' },
  falls_risk_due:           { icon:'🚶', label:'Morse سررسید',  severity:'medium',   cat:'safety',     perm:'nursing.care_plan.view' },
  noc_not_met:              { icon:'📋', label:'NOC زیر هدف',   severity:'medium',   cat:'nursing',    perm:'nursing.care_plan.view' }
};

const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const COOLDOWN_MS = 30 * 60 * 1000;

function actorScope(actor) {
  try { const s = resolver.resolveUserScope ? resolver.resolveUserScope(actor, perms.isCrossWard(actor.role)) : null; if (s) return s; } catch (_) {}
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

// ═══ Collector context (indexes built once) ═══
function buildIndexes() {
  const idx = {
    vitalsByP: {}, lastVitalByP: {}, labByP: {}, radByP: {},
    marByP: {}, alertAcks: {}, dismissals: {}, mutes: {}
  };
  for (const v of store.readAll('vitals')) {
    if (!idx.vitalsByP[v.patientId]) idx.vitalsByP[v.patientId] = [];
    idx.vitalsByP[v.patientId].push(v);
    if (!idx.lastVitalByP[v.patientId] || sd(v.recordedAt) > sd(idx.lastVitalByP[v.patientId].recordedAt)) idx.lastVitalByP[v.patientId] = v;
  }
  for (const p in idx.vitalsByP) idx.vitalsByP[p].sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
  for (const l of store.readAll('labs')) { if (!idx.labByP[l.patientId]) idx.labByP[l.patientId] = []; idx.labByP[l.patientId].push(l); }
  for (const r of store.readAll('radiology')) { if (!idx.radByP[r.patientId]) idx.radByP[r.patientId] = []; idx.radByP[r.patientId].push(r); }
  for (const m of store.readAll('mar')) { if (!idx.marByP[m.patientId]) idx.marByP[m.patientId] = []; idx.marByP[m.patientId].push(m); }
  for (const a of store.readAll('alert_acks')) idx.alertAcks[a.alertId] = a;
  for (const d of store.readAll('alert_dismissals')) idx.dismissals[d.alertId + '|' + d.userId] = d;
  const now = Date.now();
  for (const m of store.readAll('alert_mutes')) { if (sd(m.mutedUntil) > now) idx.mutes[m.patientId + '|' + m.category] = m; }
  return idx;
}

// ═══ Per-patient collectors — return array of {alert} ═══
function collectVitals(patient, idx) {
  const out = [];
  const last = idx.lastVitalByP[patient.id];
  if (!last) return out;
  const news = Number(last.news2) || 0;
  if (news >= 7) {
    out.push({
      source: 'vitals_critical', sourceId: patient.id + '_' + last.id,
      patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName,
      ward: patient.wardCode, bed: patient.bedNumber,
      title: 'NEWS2 ' + news + ' — بحرانی',
      detail: 'HR ' + (last.hr||'—') + ' · BP ' + (last.bp_sys||'—') + '/' + (last.bp_dia||'—') + ' · SpO₂ ' + (last.spo2||'—') + '% · T ' + (last.temp||'—') + '°',
      at: last.recordedAt,
      actionLabel: 'ثبت اقدام', actionApi: '/api/nurse/quick/note', actionBody: { patientId: patient.id }
    });
  } else if (news >= 5) {
    const hist = (idx.vitalsByP[patient.id] || []).slice(0, 6);
    if (hist.length >= 3) {
      const oldest = hist[hist.length - 1];
      const delta = news - (Number(oldest.news2) || 0);
      const hours = (sd(last.recordedAt) - sd(oldest.recordedAt)) / 3600000;
      if (delta >= 2 && hours < 12) {
        out.push({
          source: 'vitals_worsening', sourceId: patient.id + '_trend_' + last.id,
          patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName,
          ward: patient.wardCode, bed: patient.bedNumber,
          title: 'NEWS2 بدتر شد (' + oldest.news2 + '→' + news + ' در ' + Math.round(hours) + 'h)',
          detail: 'روند نگران‌کننده — بازبینی بالینی',
          at: last.recordedAt
        });
      }
    }
  }
  return out;
}

function collectLabs(patient, idx) {
  const out = [];
  const labs = idx.labByP[patient.id] || [];
  for (const l of labs) {
    if (!['resulted','verified'].includes(l.status)) continue;
    if (!l.criticalFlags || !l.criticalFlags.length) continue;
    if (l.acknowledgment && l.acknowledgment.acknowledged) continue;
    out.push({
      source: 'lab_critical', sourceId: l.id,
      patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName,
      ward: patient.wardCode, bed: patient.bedNumber,
      title: (l.panelName || l.panelCode) + ' — ' + l.criticalFlags.length + ' مقدار بحرانی',
      detail: l.criticalFlags.map(f => f.test + '=' + f.value).join(' · '),
      at: l.resultedAt || l.orderedAt,
      actionLabel: 'Read-back', actionApi: '/api/para/labs/' + l.id + '/acknowledge', actionBody: { readBack: 'نیاز به متن' }
    });
  }
  return out;
}

function collectRadiology(patient, idx) {
  const out = [];
  const rads = idx.radByP[patient.id] || [];
  for (const r of rads) {
    if (!r.criticalFlag) continue;
    if (!['reported','verified'].includes(r.status)) continue;
    if (r.acknowledgment && r.acknowledgment.acknowledged) continue;
    out.push({
      source: 'radiology_critical', sourceId: r.id,
      patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName,
      ward: patient.wardCode, bed: patient.bedNumber,
      title: r.modality + ' ' + r.bodyPart + ' — بحرانی',
      detail: (r.impression || '').slice(0, 100),
      at: r.reportedAt || r.orderedAt,
      actionLabel: 'Read-back', actionApi: '/api/para/radiology/' + r.id + '/acknowledge', actionBody: { readBack: 'نیاز به متن' }
    });
  }
  return out;
}

function collectMAR(patient, idx) {
  const out = [];
  const now = Date.now();
  const mar = idx.marByP[patient.id] || [];
  for (const m of mar) {
    if (m.status === 'missed' && sd(m.scheduledAt) > now - 86400000) {
      out.push({
        source: 'mar_missed', sourceId: m.id,
        patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName,
        ward: patient.wardCode, bed: patient.bedNumber,
        title: 'Missed: ' + m.drugName + ' ' + (m.dose||''),
        detail: 'برنامه: ' + new Date(m.scheduledAt).toLocaleString('fa-IR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }),
        at: m.scheduledAt
      });
    } else if (['scheduled','due'].includes(m.status)) {
      const diff = Math.round((now - sd(m.scheduledAt)) / 60000);
      if (diff > 30 && diff < 1440) {
        out.push({
          source: 'mar_overdue', sourceId: m.id,
          patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName,
          ward: patient.wardCode, bed: patient.bedNumber,
          title: 'دیرکرد: ' + m.drugName + ' ' + (m.dose||''),
          detail: diff + ' دقیقه — ' + (m.isHighAlert ? 'High-Alert' : 'عادی'),
          at: m.scheduledAt,
          actionLabel: 'توزیع', actionApi: '/api/nurse/quick/mar-give', actionBody: { marId: m.id, fiveRights: { patient:true, drug:true, dose:true, route:true, time:true } }
        });
      } else if (m.isHighAlert && diff > -60 && diff < 60) {
        out.push({
          source: 'mar_high_alert_due', sourceId: m.id,
          patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName,
          ward: patient.wardCode, bed: patient.bedNumber,
          title: 'High-Alert در صف: ' + m.drugName,
          detail: (diff >= 0 ? diff + ' دقیقه دیرکرد' : Math.abs(diff) + ' دقیقه مانده') + ' — نیاز به شاهد',
          at: m.scheduledAt
        });
      }
    }
  }
  return out;
}

function collectSepsis(patient, idx) {
  const out = [];
  for (const s of store.readAll('sepsis')) {
    if (s.patientId !== patient.id) continue;
    if (!['suspected','confirmed','septic_shock'].includes(s.status)) continue;
    if (!s.bundle3h || !s.bundle3h.completed) {
      const remainMin = s.bundle3h && s.bundle3h.deadline ? Math.round((new Date(s.bundle3h.deadline).getTime() - Date.now()) / 60000) : null;
      out.push({
        source: 'sepsis_bundle_incomplete', sourceId: s.id,
        patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName,
        ward: patient.wardCode, bed: patient.bedNumber,
        title: 'Sepsis Bundle ناقص',
        detail: remainMin !== null ? (remainMin > 0 ? remainMin + ' دقیقه تا deadline' : Math.abs(remainMin) + ' دقیقه گذشته') : 'وضعیت نامشخص',
        at: s.screenedAt,
        actionLabel: 'Bundle', actionApi: '/api/safety/sepsis/' + s.id + '/bundle3h', actionBody: {}
      });
    }
    if (s.status === 'suspected') {
      out.push({
        source: 'sepsis_suspected', sourceId: s.id + '_suspect',
        patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName,
        ward: patient.wardCode, bed: patient.bedNumber,
        title: 'سپسیس مشکوک (qSOFA ' + (s.qsofa && s.qsofa.score || 0) + ')',
        detail: s.infectionSource ? 'منشأ: ' + s.infectionSource : 'نیاز به تشخیص',
        at: s.screenedAt,
        actionLabel: 'تشخیص', actionApi: '/api/safety/sepsis/' + s.id + '/diagnose', actionBody: { status: 'confirmed' }
      });
    }
  }
  return out;
}

function collectCDSS(patient, idx) {
  const out = [];
  const alerts = store.readAll('cdss_alerts').filter(a => a.patientId === patient.id && !a.dismissed && sd(a.createdAt) > Date.now() - 86400000);
  for (const a of alerts) {
    if (a.type === 'drug_interaction') {
      out.push({ source: 'cdss_drug_interaction', sourceId: a.id, patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName, ward: patient.wardCode, bed: patient.bedNumber, title: 'تداخل: ' + (a.drug || '') + ' + ' + (a.other || ''), detail: a.message || '', at: a.createdAt });
    } else if (a.type === 'allergy_alert') {
      out.push({ source: 'cdss_allergy', sourceId: a.id, patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName, ward: patient.wardCode, bed: patient.bedNumber, title: 'آلرژی: ' + (a.drug || ''), detail: a.message || '', at: a.createdAt });
    } else if (a.type === 'qsofa_high') {
      out.push({ source: 'cdss_qsofa', sourceId: a.id, patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName, ward: patient.wardCode, bed: patient.bedNumber, title: 'qSOFA ' + (a.score || 0), detail: a.message || '', at: a.createdAt });
    }
  }
  return out;
}

function collectSafety(patient, idx) {
  const out = [];
  const now = Date.now();
  for (const r of store.readAll('restraint_events')) {
    if (r.patientId !== patient.id || r.status !== 'active') continue;
    if (sd(r.nextAssessmentDueAt) < now) {
      out.push({ source: 'restraint_overdue', sourceId: r.id, patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName, ward: patient.wardCode, bed: patient.bedNumber, title: 'ارزیابی محدودیت سررسید', detail: 'از ' + new Date(r.nextAssessmentDueAt).toLocaleString('fa-IR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }), at: r.nextAssessmentDueAt });
    }
    if (r.faceToFaceDeadline && !r.faceToFace && sd(r.faceToFaceDeadline) < now) {
      out.push({ source: 'restraint_overdue', sourceId: r.id + '_f2f', patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName, ward: patient.wardCode, bed: patient.bedNumber, title: 'Face-to-Face سررسید', detail: 'JCI COP.5', at: r.faceToFaceDeadline });
    }
  }
  return out;
}

function collectFallsRisk(patient, idx) {
  const out = [];
  const morse = store.readAll('cdss_scores').filter(s => s.patientId === patient.id && s.scoreType === 'morse').sort((a, b) => sd(b.computedAt) - sd(a.computedAt))[0];
  const now = Date.now();
  const hours = morse ? (now - sd(morse.computedAt)) / 3600000 : 999;
  if (hours >= 24) {
    out.push({ source: 'falls_risk_due', sourceId: patient.id, patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName, ward: patient.wardCode, bed: patient.bedNumber, title: 'Morse Fall نیاز به بازبینی', detail: morse ? Math.round(hours) + ' ساعت پیش' : 'انجام نشده', at: morse ? morse.computedAt : patient.admittedAt });
  }
  return out;
}

function collectNCP(patient, idx) {
  const out = [];
  const ncp = store.readAll('nursing_care_plans').find(n => n.patientId === patient.id && n.status === 'active');
  if (!ncp) return out;
  for (const d of (ncp.diagnoses || [])) {
    if (d.status !== 'active') continue;
    for (const o of (d.expectedOutcomes || [])) {
      if (o.latestScore != null && o.latestScore < (o.target || 4)) {
        out.push({ source: 'noc_not_met', sourceId: ncp.id + '_' + d.code + '_' + o.code, patientId: patient.id, patientName: patient.firstName + ' ' + patient.lastName, ward: patient.wardCode, bed: patient.bedNumber, title: 'NOC زیر هدف: ' + o.fa, detail: d.fa + ' — ' + o.latestScore + '/' + (o.target || 4), at: o.latestScoredAt || ncp.createdAt });
      }
    }
  }
  return out;
}

function collectForPatient(patient, idx) {
  let all = [];
  all = all.concat(collectVitals(patient, idx));
  all = all.concat(collectLabs(patient, idx));
  all = all.concat(collectRadiology(patient, idx));
  all = all.concat(collectMAR(patient, idx));
  all = all.concat(collectSepsis(patient, idx));
  all = all.concat(collectCDSS(patient, idx));
  all = all.concat(collectSafety(patient, idx));
  all = all.concat(collectFallsRisk(patient, idx));
  all = all.concat(collectNCP(patient, idx));
  return all;
}

function enrichAlert(alert, idx) {
  const src = SOURCES[alert.source] || { icon:'●', label: alert.source, severity:'medium', cat:'other', perm:null };
  const alertId = alert.source + '_' + alert.sourceId;
  const ack = idx.alertAcks[alertId];
  return Object.assign({}, alert, {
    alertId, icon: src.icon, category: src.cat, sourceLabel: src.label, requiredPerm: src.perm,
    severity: src.severity,
    acknowledged: !!ack,
    acknowledgedBy: ack ? ack.ackedByName : null,
    acknowledgedAt: ack ? ack.ackedAt : null
  });
}

// ═══ Aggregate all alerts for actor ═══
function aggregate(ctx) {
  const scope = actorScope(ctx.actor);
  const actorRole = ctx.actor.role;
  const actorId = ctx.actor.id;
  const idx = buildIndexes();
  const patients = store.readAll('patients').filter(p => ['in_care','admitted'].includes(p.status) && inScope(p, scope));
  const raw = [];
  for (const p of patients) {
    const list = collectForPatient(p, idx);
    for (const a of list) {
      // Permission filter
      const src = SOURCES[a.source];
      if (src && src.perm && !perms.can(actorRole, src.perm)) continue;
      // Dismiss filter (per-user)
      if (idx.dismissals[a.source + '_' + a.sourceId + '|' + actorId]) continue;
      // Mute filter
      if (idx.mutes[p.id + '|' + (src ? src.cat : 'other')]) continue;
      raw.push(enrichAlert(a, idx));
    }
  }
  // Dedupe by (source, sourceId) — keep first
  const seen = new Set();
  const unique = [];
  for (const a of raw) {
    if (seen.has(a.alertId)) continue;
    seen.add(a.alertId);
    unique.push(a);
  }
  // Sort: severity asc (critical first), then at desc
  unique.sort((a, b) => {
    const sa = SEV_RANK[a.severity] != null ? SEV_RANK[a.severity] : 9;
    const sb = SEV_RANK[b.severity] != null ? SEV_RANK[b.severity] : 9;
    if (sa !== sb) return sa - sb;
    return sd(b.at) - sd(a.at);
  });
  return unique;
}

function hub(ctx) {
  const all = aggregate(ctx);
  let filtered = all;
  if (ctx.query.severity) filtered = filtered.filter(a => a.severity === ctx.query.severity);
  if (ctx.query.category) filtered = filtered.filter(a => a.category === ctx.query.category);
  if (ctx.query.ward) filtered = filtered.filter(a => a.ward === ctx.query.ward);
  if (ctx.query.patientId) filtered = filtered.filter(a => a.patientId === ctx.query.patientId);
  if (ctx.query.onlyUnacked === '1') filtered = filtered.filter(a => !a.acknowledged);
  if (ctx.query.source) filtered = filtered.filter(a => a.source === ctx.query.source);

  const bySev = { critical: 0, high: 0, medium: 0, low: 0 };
  const byCat = {};
  const bySource = {};
  for (const a of filtered) {
    bySev[a.severity] = (bySev[a.severity] || 0) + 1;
    byCat[a.category] = (byCat[a.category] || 0) + 1;
    bySource[a.source] = (bySource[a.source] || 0) + 1;
  }

  return {
    items: filtered.slice(0, 200),
    total: filtered.length,
    unackedCritical: filtered.filter(a => a.severity === 'critical' && !a.acknowledged).length,
    unackedHigh: filtered.filter(a => a.severity === 'high' && !a.acknowledged).length,
    bySeverity: bySev,
    byCategory: byCat,
    bySource,
    categories: ['medication','clinical','vitals','paraclinical','safety','nursing','other'],
    scope: { kind: scope_kind(ctx.actor) },
    generatedAt: ctx.now()
  };
}

function scope_kind(actor) {
  try { const s = actorScope(actor); return s.kind; } catch (_) { return 'none'; }
}

function stats(ctx) {
  const all = aggregate(ctx);
  const byWard = {};
  for (const a of all) { if (!byWard[a.ward]) byWard[a.ward] = { critical: 0, high: 0, medium: 0, total: 0 }; byWard[a.ward][a.severity] = (byWard[a.ward][a.severity] || 0) + 1; byWard[a.ward].total++; }
  const byPatient = {};
  for (const a of all) { if (!byPatient[a.patientId]) byPatient[a.patientId] = { patientName: a.patientName, ward: a.ward, bed: a.bed, count: 0, critical: 0 }; byPatient[a.patientId].count++; if (a.severity === 'critical') byPatient[a.patientId].critical++; }
  const topPatients = Object.entries(byPatient).map(([id, d]) => ({ patientId: id, ...d })).sort((a, b) => (b.critical - a.critical) || (b.count - a.count)).slice(0, 10);
  return {
    total: all.length,
    unackedCritical: all.filter(a => a.severity === 'critical' && !a.acknowledged).length,
    bySeverity: { critical: all.filter(a => a.severity === 'critical').length, high: all.filter(a => a.severity === 'high').length, medium: all.filter(a => a.severity === 'medium').length },
    byCategory: all.reduce((acc, a) => { acc[a.category] = (acc[a.category] || 0) + 1; return acc; }, {}),
    byWard, topPatients, generatedAt: ctx.now()
  };
}

function ack(ctx) {
  const alertId = ctx.params.alertId;
  const b = ctx.body || {};
  if (!alertId) throw ctx.E.badRequest('alert_id_required');
  const existing = store.readAll('alert_acks').find(a => a.alertId === alertId);
  if (existing) return existing;
  const isCritical = alertId.indexOf('_critical_') >= 0 || alertId.startsWith('vitals_critical_') || alertId.startsWith('sepsis_suspected_') || alertId.startsWith('cdss_drug_interaction_') || alertId.startsWith('cdss_allergy_') || alertId.startsWith('restraint_overdue_');
  if (isCritical && (!b.readBack || String(b.readBack).trim().length < 10)) {
    throw ctx.E.badRequest('read_back_min_10_chars_required_for_critical');
  }
  const rec = {
    id: ctx.uid('ack'), alertId,
    source: alertId.split('_').slice(0, -1).join('_') || alertId,
    patientId: b.patientId || null, patientName: b.patientName || null,
    ackedBy: ctx.actor.id, ackedByName: ctx.actor.fullName || ctx.actor.username,
    ackedAt: ctx.now(),
    note: String(b.note || '').slice(0, 500),
    readBack: isCritical ? String(b.readBack).slice(0, 500) : null
  };
  store.put('alert_acks', rec);
  ctx.audit.write('alerts_hub', 'alert.ack', alertId, ctx.actor, { note: rec.note, readBack: !!rec.readBack });
  ctx.bus.emit('alert.acknowledged', { record: rec, actor: ctx.actor });
  return rec;
}

function dismiss(ctx) {
  const alertId = ctx.params.alertId;
  const b = ctx.body || {};
  if (!alertId) throw ctx.E.badRequest('alert_id_required');
  if (!b.reason || String(b.reason).trim().length < 5) throw ctx.E.badRequest('reason_min_5_chars');
  const rec = {
    id: ctx.uid('dsm'), alertId, userId: ctx.actor.id, userName: ctx.actor.fullName || ctx.actor.username,
    reason: String(b.reason).slice(0, 500), dismissedAt: ctx.now()
  };
  store.put('alert_dismissals', rec);
  ctx.audit.write('alerts_hub', 'alert.dismiss', alertId, ctx.actor, { reason: rec.reason });
  return rec;
}

function mute(ctx) {
  const b = ctx.body || {};
  if (!b.patientId || !b.category) throw ctx.E.badRequest('patient_id_and_category_required');
  const hours = Math.max(1, Math.min(168, Number(b.hours) || 4));
  if (!b.reason || String(b.reason).trim().length < 5) throw ctx.E.badRequest('reason_min_5_chars');
  const rec = {
    id: ctx.uid('mut'),
    patientId: b.patientId, patientName: b.patientName || null,
    category: b.category, reason: String(b.reason).slice(0, 500),
    mutedBy: ctx.actor.id, mutedByName: ctx.actor.fullName || ctx.actor.username,
    mutedAt: ctx.now(), mutedUntil: new Date(Date.now() + hours * 3600000).toISOString(),
    hours
  };
  store.put('alert_mutes', rec);
  ctx.audit.write('alerts_hub', 'alert.mute', rec.id, ctx.actor, { patientId: b.patientId, category: b.category, hours });
  return rec;
}

function history(ctx) {
  const days = Math.min(30, Number(ctx.query.days) || 7);
  const since = Date.now() - days * 86400000;
  const acks = store.readAll('alert_acks').filter(a => sd(a.ackedAt) >= since).sort((a, b) => sd(b.ackedAt) - sd(a.ackedAt)).slice(0, 100);
  const dismissals = store.readAll('alert_dismissals').filter(d => sd(d.dismissedAt) >= since).sort((a, b) => sd(b.dismissedAt) - sd(a.dismissedAt)).slice(0, 100);
  return {
    acks: acks.map(a => ({ alertId: a.alertId, by: a.ackedByName, at: a.ackedAt, note: a.note, readBack: a.readBack })),
    dismissals: dismissals.map(d => ({ alertId: d.alertId, by: d.userName, at: d.dismissedAt, reason: d.reason })),
    total: { acks: acks.length, dismissals: dismissals.length },
    window: { days, since: new Date(since).toISOString() }
  };
}

function mutedsList(ctx) {
  const now = Date.now();
  return {
    items: store.readAll('alert_mutes').filter(m => sd(m.mutedUntil) > now).sort((a, b) => sd(b.mutedAt) - sd(a.mutedAt)).slice(0, 100),
    total: store.readAll('alert_mutes').filter(m => sd(m.mutedUntil) > now).length,
    checkedAt: ctx.now()
  };
}

// ═══ SSE broadcast on every source event ═══
['vitals.recorded','vitals.critical','kardex.mar.missed','kardex.mar.given','lab.critical','radiology.critical','sepsis.suspected','cdss.alert','restraint.started','restraint.overdue','restraint.critical_overdue'].forEach(evt => {
  bus.on(evt, (payload) => {
    try { bus.emit('alerts_hub.source_changed', { source: evt, at: new Date().toISOString() }); } catch (_) {}
  });
});

module.exports = {
  handlers: { hub, stats, ack, dismiss, mute, history, mutedsList },
  routes: [
    { method:'GET',  path:'/api/alerts/hub',             handler:'hub',          perm:'alerts.view' },
    { method:'GET',  path:'/api/alerts/stats',           handler:'stats',        perm:'alerts.view' },
    { method:'GET',  path:'/api/alerts/history',         handler:'history',      perm:'alerts.view' },
    { method:'GET',  path:'/api/alerts/muteds',          handler:'mutedsList',   perm:'alerts.view' },
    { method:'POST', path:'/api/alerts/:alertId/ack',    handler:'ack',          perm:'alerts.ack' },
    { method:'POST', path:'/api/alerts/:alertId/dismiss',handler:'dismiss',      perm:'alerts.dismiss' },
    { method:'POST', path:'/api/alerts/mute',            handler:'mute',         perm:'alerts.mute' }
  ],
  panels: [
    { id:'hub', title:'مرکز هشدارها', icon:'🔔', perm:'alerts.view', kind:'alerts_hub', api:'/api/alerts/hub' }
  ]
};
console.log('[alerts_hub] loaded — 15 sources · ack/dismiss/mute · read-back · SSE');
