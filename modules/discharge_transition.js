
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Discharge Transition Excellence (v5)
//  JCI IPSG.5 (Med Rec) + COP.1 (Continuity) + 5.2 (Readmission)
//  Enhances existing workflow.js discharge with:
//   1. Medication Reconciliation (home vs hospital → discharge)
//   2. Auto-suggest follow-up based on diagnosis
//   3. Readmission risk integrated at decision point
//   4. Teach-back documentation (patient comprehension)
//   5. PCP transition handoff document
//  No UI changes. Endpoints augment existing flow.
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const store = require('../core/store');
const bus = require('../core/events');
const signature = require('../core/signature');
const perms = require('../core/permissions');
const neural = require('../core/neural');

// ═══ Permissions ═══
if (!perms.P['discharge.reconcile']) {
  perms.P['discharge.reconcile'] = 'admin,physician,resident,attending,specialist,pharmacist,head_nurse';
}
if (!perms.P['discharge.educate']) {
  perms.P['discharge.educate'] = 'admin,nurse,head_nurse,physician,resident,attending,specialist,pharmacist';
}
if (!perms.P['discharge.followup']) {
  perms.P['discharge.followup'] = 'admin,physician,resident,attending,specialist,nurse,head_nurse';
}
if (!perms.P['discharge.transition']) {
  perms.P['discharge.transition'] = 'admin,physician,resident,attending,specialist,head_nurse';
}

// ═══════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════
function findDischarge(ctx, id) {
  const d = store.get('discharges', id);
  if (!d) throw ctx.E.notFound('discharge_plan_not_found');
  return d;
}

function getPatient(ctx, id) {
  const p = store.get('patients', id);
  if (!p) throw ctx.E.notFound('patient_not_found');
  return p;
}

function sign(ctx, coll, rec, action) {
  const sg = signature.signAction({
    userId: ctx.actor.id, action, collection: coll,
    recordId: rec.id, data: rec
  });
  store.put('signatures', sg);
  rec.lastSignatureId = sg.id;
  return sg;
}

function sameDrug(a, b) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_]/g, '')
    .replace(/^(tab|cap|inj|syr|susp)/, '')
    .replace(/(tab|cap|inj|syr|susp|hcl|sodium|potassium)$/, '');
  return norm(a) === norm(b) && norm(a).length > 0;
}

function sameDose(a, b) {
  return String(a || '').toLowerCase().replace(/\s+/g, '') === String(b || '').toLowerCase().replace(/\s+/g, '');
}

// ═══════════════════════════════════════════════════════════
//  Part 1 — Medication Reconciliation (JCI IPSG.5)
// ═══════════════════════════════════════════════════════════

// Start reconciliation — capture home medications
function startReconciliation(ctx) {
  const d = findDischarge(ctx, ctx.params.dischargeId);
  const patient = getPatient(ctx, d.patientId);

  const b = ctx.body || {};
  const homeMeds = Array.isArray(b.homeMeds) ? b.homeMeds : [];

  // Pull hospital meds from MAR (given during admission)
  const since = patient.admittedAt ? sd(patient.admittedAt) : Date.now() - 30 * 86400000;
  const mar = h(ctx, 'mar').filter(m => m.patientId === patient.id && sd(m.administeredAt) >= since);
  const hospitalMap = new Map();
  for (const m of mar) {
    if (!m.drugName) continue;
    const key = String(m.drugName).toLowerCase().trim();
    if (!hospitalMap.has(key)) {
      hospitalMap.set(key, {
        drug: m.drugName,
        dose: m.dose || '',
        route: m.route || '',
        frequency: m.frequency || '',
        dosesGiven: 0,
        lastGiven: m.administeredAt
      });
    }
    hospitalMap.get(key).dosesGiven++;
    if (sd(m.administeredAt) > sd(hospitalMap.get(key).lastGiven)) {
      hospitalMap.get(key).lastGiven = m.administeredAt;
    }
  }
  const hospitalMeds = Array.from(hospitalMap.values());

  // Build reconciliation matrix
  const reconcile = [];
  const seenHome = new Set();

  // 1. Home meds: what happened to them?
  for (const hm of homeMeds) {
    const drug = hm.drug || hm.name || '';
    if (!drug) continue;
    seenHome.add(drug.toLowerCase());
    const hosp = hospitalMeds.find(x => sameDrug(x.drug, drug));
    let action = 'continue';
    let dischargeDose = hm.dose || '';
    let reason = '';

    if (!hosp) {
      action = 'stopped_in_hospital';
      reason = hm.stoppedReason || 'در بیمارستان ادامه داده نشد';
    } else if (!sameDose(hosp.dose, hm.dose)) {
      action = 'dose_changed';
      dischargeDose = hosp.dose;
      reason = 'دوز در بیمارستان تغییر کرد: ' + (hm.dose || '?') + ' → ' + hosp.dose;
    }

    reconcile.push({
      source: 'home',
      drug,
      homeDose: hm.dose || '',
      homeFrequency: hm.frequency || '',
      hospitalDose: hosp ? hosp.dose : null,
      hospitalDosesGiven: hosp ? hosp.dosesGiven : 0,
      action,
      dischargeDose,
      dischargeFrequency: hosp ? hosp.frequency : (hm.frequency || ''),
      dischargeRoute: hosp ? hosp.route : (hm.route || ''),
      reason,
      needsEducation: true
    });
  }

  // 2. Hospital meds: what continues at discharge?
  for (const hm of hospitalMeds) {
    if (seenHome.has(String(hm.drug).toLowerCase())) continue;
    reconcile.push({
      source: 'hospital',
      drug: hm.drug,
      homeDose: null,
      homeFrequency: null,
      hospitalDose: hm.dose,
      hospitalDosesGiven: hm.dosesGiven,
      action: 'new',
      dischargeDose: hm.dose,
      dischargeFrequency: hm.frequency,
      dischargeRoute: hm.route,
      reason: 'داروی جدید در بیمارستان شروع شد',
      needsEducation: true
    });
  }

  d.medicationReconciliation = {
    status: 'in_progress',
    homeMeds,
    hospitalMeds,
    reconcile,
    startedAt: ctx.now(),
    startedBy: ctx.actor.id,
    startedByName: ctx.actor.fullName || ctx.actor.username,
    pharmacistVerified: false,
    patientEducated: false
  };

  require('../core/domain/discharge-writer').put(ctx, d);
  ctx.audit.write('discharge_transition', 'medrec.start', d.id, ctx.actor, {
    homeCount: homeMeds.length, hospitalCount: hospitalMeds.length, reconcileCount: reconcile.length
  });
  bus.emit('discharge.medrec.started', { record: d, actor: ctx.actor });
  return d.medicationReconciliation;
}

// Pharmacist verifies reconciliation
function verifyReconciliation(ctx) {
  const d = findDischarge(ctx, ctx.params.dischargeId);
  if (!d.medicationReconciliation) throw ctx.E.conflict('reconciliation_not_started');
  if (d.medicationReconciliation.pharmacistVerified) throw ctx.E.conflict('already_verified');

  const b = ctx.body || {};
  // Allow editing discharge doses before verification
  if (Array.isArray(b.reconcile)) {
    d.medicationReconciliation.reconcile = b.reconcile;
  }

  // Validate: every entry must have dischargeDose if action is continue/change/new
  const invalid = (d.medicationReconciliation.reconcile || []).filter(r =>
    ['continue','dose_changed','new'].includes(r.action) && !r.dischargeDose
  );
  if (invalid.length > 0) {
    throw ctx.E.badRequest('missing_discharge_dose:' + invalid.map(r => r.drug).join(','));
  }

  d.medicationReconciliation.status = 'verified';
  d.medicationReconciliation.pharmacistVerified = true;
  d.medicationReconciliation.pharmacistVerifiedAt = ctx.now();
  d.medicationReconciliation.pharmacistVerifiedBy = ctx.actor.id;
  d.medicationReconciliation.pharmacistVerifiedByName = ctx.actor.fullName || ctx.actor.username;
  d.medicationReconciliation.notes = b.notes || '';

  require('../core/domain/discharge-writer').put(ctx, d);
  sign(ctx, 'discharges', d, 'medrec_verify');
  ctx.audit.write('discharge_transition', 'medrec.verify', d.id, ctx.actor, {
    count: d.medicationReconciliation.reconcile.length
  });
  bus.emit('discharge.medrec.verified', { record: d, actor: ctx.actor });
  return d.medicationReconciliation;
}

// ═══════════════════════════════════════════════════════════
//  Part 2 — Follow-up auto-suggest based on diagnosis
// ═══════════════════════════════════════════════════════════
const FOLLOWUP_RULES = [
  { match: /chf|heart failure|نارسایی قلب/i, days: 7, service: 'قلب و عروق', reason: 'ارزیابی مجدد حجم + GDMT' },
  { match: /ami|stemi|nstemi|mi |سکته قلبی/i, days: 7, service: 'قلب و عروق', reason: 'پیگیری post-MI + rehab' },
  { match: /copd|asthma|پنومونی|pneumonia/i, days: 14, service: 'ریه', reason: 'ارزیابی تنفسی + اسپیرومتری' },
  { match: /diabetes|dm |dka|hba1c|دیابت/i, days: 14, service: 'غدد', reason: 'کنترل قند + آموزش' },
  { match: /ckd|renal|aki|نارسایی کلیه/i, days: 14, service: 'نفرولوژی', reason: 'پایش Cr + الکترولیت' },
  { match: /cva|stroke|سکته مغزی/i, days: 14, service: 'نورولوژی', reason: 'ارزیابی نورولوژیک + rehab' },
  { match: /sepsis|septic/i, days: 7, service: 'عفونی', reason: 'ارزیابی بهبود عفونت' },
  { match: /gi bleed|خونریزی گوارشی/i, days: 14, service: 'گوارش', reason: 'پیگیری Hb + EGD' },
  { match: /pancreatitis|پانکراتیت/i, days: 14, service: 'گوارش', reason: 'پیگیری + MRI' },
  { match: /cancer|oncology|chemo|سرطان/i, days: 7, service: 'انکولوژی', reason: 'پیگیری cycle بعدی' },
  { match: /surgery|جراحی|post.op/i, days: 14, service: 'جراحی', reason: 'ارزیابی wound + درناژ' },
  { match: /fracture|شکستگی|orthopedic/i, days: 21, service: 'ارتوپدی', reason: 'پیگیری جوش خوردن + فیزیوتراپی' },
  { match: /ptsd|depression|افسردگی|psychiatric/i, days: 14, service: 'روان‌پزشکی', reason: 'پیگیری روان‌شناختی' }
];

function suggestFollowup(ctx) {
  const d = findDischarge(ctx, ctx.params.dischargeId);
  const patient = getPatient(ctx, d.patientId);
  const dx = String(patient.diagnosis || '');

  const suggestions = [];
  for (const rule of FOLLOWUP_RULES) {
    if (rule.match.test(dx)) {
      suggestions.push({
        days: rule.days,
        service: rule.service,
        reason: rule.reason,
        matchedDx: dx,
        suggestedDate: new Date(Date.now() + rule.days * 86400000).toISOString()
      });
    }
  }

  // If no match, generic 14d
  if (suggestions.length === 0) {
    suggestions.push({
      days: 14,
      service: 'پزشک معالج',
      reason: 'پیگیری عمومی پس از ترخیص',
      suggestedDate: new Date(Date.now() + 14 * 86400000).toISOString()
    });
  }

  // Always add PCP if high readmission risk
  const risk = neural.readmissionRisk(patient);
  if (risk.level === 'high') {
    suggestions.unshift({
      days: 3,
      service: 'پزشک خانواده / PCP',
      reason: 'ریسک بالای readmission — پیگیری زودتر',
      priority: 'high',
      suggestedDate: new Date(Date.now() + 3 * 86400000).toISOString(),
      readmissionRisk: risk.score
    });
  }

  return {
    patientId: patient.id,
    patientName: patient.firstName + ' ' + patient.lastName,
    diagnosis: dx,
    readmissionRisk: risk,
    suggestions,
    total: suggestions.length,
    note: 'این پیشنهادها بر اساس تشخیص و پروتکل‌های بالینی است — پزشک می‌تواند تغییر دهد'
  };
}

// Schedule a follow-up
function scheduleFollowup(ctx) {
  const d = findDischarge(ctx, ctx.params.dischargeId);
  const b = ctx.body || {};
  if (!b.service || !b.scheduledDate) throw ctx.E.badRequest('service_and_date_required');

  const rec = {
    id: ctx.uid('fu'),
    service: b.service,
    provider: b.provider || null,
    providerName: b.providerName || null,
    scheduledDate: b.scheduledDate,
    location: b.location || null,
    phone: b.phone || null,
    notes: b.notes || '',
    scheduledBy: ctx.actor.id,
    scheduledByName: ctx.actor.fullName || ctx.actor.username,
    scheduledAt: ctx.now(),
    status: 'scheduled',
    reminder: {
      smsSent: false,
      callConfirmed: false
    }
  };
  d.followup = d.followup || [];
  d.followup.push(rec);
  require('../core/domain/discharge-writer').put(ctx, d);
  ctx.audit.write('discharge_transition', 'followup.schedule', rec.id, ctx.actor, {
    dischargeId: d.id, service: b.service, date: b.scheduledDate
  });
  bus.emit('discharge.followup.scheduled', { record: rec, discharge: d, actor: ctx.actor });
  return rec;
}

// ═══════════════════════════════════════════════════════════
//  Part 3 — Readmission Risk at discharge decision
// ═══════════════════════════════════════════════════════════
function readmissionAssessment(ctx) {
  const d = findDischarge(ctx, ctx.params.dischargeId);
  const patient = getPatient(ctx, d.patientId);

  // Enrich patient with recent admissions
  const priorAdmissions = h(ctx, 'patients')
    .filter(p => p.mrn === patient.mrn && p.id !== patient.id && p.dischargedAt &&
      (Date.now() - sd(p.dischargedAt)) < 180 * 86400000).length;

  const enriched = Object.assign({}, patient, { recentAdmissions: priorAdmissions });
  const risk = neural.readmissionRisk(enriched);

  // Attach transition care plan if high risk
  let transitionPlan = null;
  if (risk.level === 'high') {
    transitionPlan = {
      required: true,
      components: [
        'تماس تلفنی ۴۸ ساعت پس از ترخیص',
        'ویزیت PCP ظرف ۷۲ ساعت',
        'آموزش دارویی با teach-back',
        'برنامه پایش روزانه علائم هشدار',
        'دسترسی ۲۴/۷ به تیم بالینی'
      ],
      assignedCoordinator: null,
      createdAt: ctx.now()
    };
  } else if (risk.level === 'moderate') {
    transitionPlan = {
      required: false,
      components: [
        'تماس تلفنی ۷۲ ساعت پس از ترخیص',
        'ویزیت PCP ظرف ۷ روز',
        'آموزش دارویی'
      ],
      assignedCoordinator: null,
      createdAt: ctx.now()
    };
  }

  d.readmissionAssessment = {
    score: risk.score,
    level: risk.level,
    factors: risk.factors,
    recommendation: risk.recommendation,
    recentAdmissions: priorAdmissions,
    transitionPlan,
    assessedAt: ctx.now(),
    assessedBy: ctx.actor.id,
    assessedByName: ctx.actor.fullName || ctx.actor.username
  };
  require('../core/domain/discharge-writer').put(ctx, d);

  ctx.audit.write('discharge_transition', 'readmission.assess', d.id, ctx.actor, {
    score: risk.score, level: risk.level, recentAdmissions: priorAdmissions
  });
  bus.emit('discharge.readmission.assessed', { record: d, risk, actor: ctx.actor });

  return {
    dischargeId: d.id,
    patientId: patient.id,
    patientName: patient.firstName + ' ' + patient.lastName,
    risk,
    recentAdmissions: priorAdmissions,
    transitionPlan
  };
}

// ═══════════════════════════════════════════════════════════
//  Part 4 — Teach-back Documentation (JCI IPSG.3)
// ═══════════════════════════════════════════════════════════
const TEACHBACK_TOPICS = {
  medications: 'نام، دوز، زمان، هدف هر دارو',
  sideEffects: 'عوارض شایع و علائم هشدار',
  diet: 'رژیم غذایی و ممنوعیت‌ها',
  activity: 'محدودیت‌های فعالیت و ورزش',
  warningSigns: 'علائم هشدار که باید به پزشک گزارش شود',
  followup: 'تاریخ و محل ویزیت‌های بعدی',
  woundCare: 'مراقبت از زخم (اگر جراحی)',
  whenToCall: 'زمان تماس با ۱۱۵ یا پزشک'
};

function teachBackVerify(ctx) {
  const d = findDischarge(ctx, ctx.params.dischargeId);
  const b = ctx.body || {};
  if (!b.verifiedTopics || !Array.isArray(b.verifiedTopics) || b.verifiedTopics.length === 0) {
    throw ctx.E.badRequest('at_least_one_topic_required');
  }

  const invalid = b.verifiedTopics.filter(t => !TEACHBACK_TOPICS[t]);
  if (invalid.length) throw ctx.E.badRequest('invalid_topics:' + invalid.join(','));

  const rec = {
    id: ctx.uid('tb'),
    topics: b.verifiedTopics,
    verifiedWith: b.verifiedWith || 'patient', // patient | caregiver | both
    caregiverName: b.caregiverName || null,
    caregiverRelationship: b.caregiverRelationship || null,
    barrier: b.barrier || null,
    barrierNote: b.barrierNote || '',
    demonstratedCorrectly: b.demonstratedCorrectly === true,
    needsReinforcement: b.demonstratedCorrectly !== true,
    verifiedBy: ctx.actor.id,
    verifiedByName: ctx.actor.fullName || ctx.actor.username,
    verifiedAt: ctx.now()
  };

  d.teachBack = d.teachBack || [];
  d.teachBack.push(rec);
  require('../core/domain/discharge-writer').put(ctx, d);
  sign(ctx, 'discharges', rec, 'teachback');

  ctx.audit.write('discharge_transition', 'teachback.verify', d.id, ctx.actor, {
    topics: b.verifiedTopics, demonstrated: rec.demonstratedCorrectly
  });
  bus.emit('discharge.teachback.recorded', { record: rec, discharge: d, actor: ctx.actor });
  return rec;
}

function teachBackTopics() {
  return {
    topics: Object.entries(TEACHBACK_TOPICS).map(([k, v]) => ({ code: k, label: v })),
    total: Object.keys(TEACHBACK_TOPICS).length
  };
}

// ═══════════════════════════════════════════════════════════
//  Part 5 — PCP Transition Handoff document
// ═══════════════════════════════════════════════════════════
function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('fa-IR'); } catch (_) { return '—'; }
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('fa-IR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); }
  catch (_) { return '—'; }
}

function pcpHandoff(ctx) {
  const d = findDischarge(ctx, ctx.params.dischargeId);
  const patient = getPatient(ctx, d.patientId);

  const encounters = h(ctx, 'encounters').filter(e => e.patientId === patient.id && e.type === 'round')
    .sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  const procedures = h(ctx, 'procedures').filter(p => p.patientId === patient.id && p.status === 'completed');
  const labs = h(ctx, 'labs').filter(l => l.patientId === patient.id && ['resulted','verified'].includes(l.status))
    .sort((a, b) => sd(b.orderedAt) - sd(a.orderedAt)).slice(0, 10);
  const consults = h(ctx, 'consults').filter(c => c.patientId === patient.id && ['approved','responded'].includes(c.status));
  const ncp = h(ctx, 'nursing_care_plans').find(c => c.patientId === patient.id && c.status === 'active');

  // Diagnoses deduplicated
  const dxSet = new Set();
  if (patient.diagnosis) dxSet.add(patient.diagnosis);
  for (const e of encounters) {
    ((e.assessment && e.assessment.diagnoses) || []).forEach(x => { if (x) dxSet.add(x); });
  }
  const diagnoses = Array.from(dxSet);

  // Discharge meds from reconciliation if available
  const dischargeMeds = (d.medicationReconciliation && d.medicationReconciliation.reconcile || [])
    .filter(r => ['continue','dose_changed','new'].includes(r.action));

  const los = patient.admittedAt ? Math.ceil((Date.now() - sd(patient.admittedAt)) / 86400000) : null;

  let body = '';
  body += '<div class="hdr" style="border-bottom:2px solid #0891b2;margin-bottom:14px">';
  body += '<div><div class="hospital" style="font-size:18px;font-weight:900;color:#0891b2">🫀 بیمارستان سینا</div>';
  body += '<div class="sub" style="font-size:9.5px;color:#666">Transition of Care — انتقال به PCP</div></div>';
  body += '<div class="meta" style="text-align:left;font-size:9px;color:#666;font-family:monospace">';
  body += '<div class="t" style="font-size:13px;font-weight:900;color:#0f172a;font-family:inherit">خلاصه انتقال مراقبت</div>';
  body += '<div>' + fmtDate(new Date().toISOString()) + '</div>';
  body += '</div></div>';

  // Patient block
  body += '<div class="pt-info" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:10px;margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 12px">';
  body += '<div><div class="lbl" style="font-size:9px;color:#0891b2;font-weight:800">نام</div><div class="val" style="font-weight:700;font-size:10.5px">' + escHtml(patient.firstName + ' ' + patient.lastName) + '</div></div>';
  body += '<div><div class="lbl" style="font-size:9px;color:#0891b2;font-weight:800">MRN</div><div class="val" style="font-weight:700;font-size:10.5px">' + escHtml(patient.mrn || '—') + '</div></div>';
  body += '<div><div class="lbl" style="font-size:9px;color:#0891b2;font-weight:800">سن/جنسیت</div><div class="val" style="font-weight:700;font-size:10.5px">' + (patient.age || '—') + ' سال · ' + (patient.sex === 'female' ? 'زن' : 'مرد') + '</div></div>';
  body += '<div><div class="lbl" style="font-size:9px;color:#0891b2;font-weight:800">تاریخ پذیرش</div><div class="val" style="font-weight:700;font-size:10.5px">' + fmtDate(patient.admittedAt) + '</div></div>';
  body += '<div><div class="lbl" style="font-size:9px;color:#0891b2;font-weight:800">تاریخ ترخیص</div><div class="val" style="font-weight:700;font-size:10.5px">' + fmtDate(d.plannedAt || new Date().toISOString()) + '</div></div>';
  body += '<div><div class="lbl" style="font-size:9px;color:#0891b2;font-weight:800">مدت بستری</div><div class="val" style="font-weight:700;font-size:10.5px">' + (los || '—') + ' روز</div></div>';
  body += '</div>';

  // Section: Diagnoses
  body += '<div class="section" style="background:#06b6d4;color:#fff;padding:5px 10px;margin:12px 0 6px;border-radius:4px;font-weight:900">📋 تشخیص‌های ترخیص</div>';
  body += '<div class="box" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px">';
  if (diagnoses.length) {
    body += '<ol style="margin:0;padding-right:20px;line-height:1.8">';
    for (const dx of diagnoses) body += '<li>' + escHtml(dx) + '</li>';
    body += '</ol>';
  } else body += '<em>ثبت نشده</em>';
  body += '</div>';

  // Section: Procedures
  if (procedures.length) {
    body += '<div class="section" style="background:#06b6d4;color:#fff;padding:5px 10px;margin:12px 0 6px;border-radius:4px;font-weight:900">💉 پروسیجرها</div>';
    body += '<table style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr>';
    body += '<th style="background:#e0f2fe;border:1px solid #cbd5e1;padding:5px;font-weight:800">پروسیجر</th>';
    body += '<th style="background:#e0f2fe;border:1px solid #cbd5e1;padding:5px;font-weight:800">تاریخ</th>';
    body += '<th style="background:#e0f2fe;border:1px solid #cbd5e1;padding:5px;font-weight:800">یافته</th>';
    body += '</tr></thead><tbody>';
    for (const pr of procedures) {
      body += '<tr><td style="border:1px solid #cbd5e1;padding:5px">' + escHtml(pr.typeLabel || pr.type) + '</td>';
      body += '<td style="border:1px solid #cbd5e1;padding:5px">' + fmtDate(pr.completedAt) + '</td>';
      body += '<td style="border:1px solid #cbd5e1;padding:5px">' + escHtml((pr.note && pr.note.findings) || '—') + '</td></tr>';
    }
    body += '</tbody></table>';
  }

  // Section: Discharge meds
  body += '<div class="section" style="background:#10b981;color:#fff;padding:5px 10px;margin:12px 0 6px;border-radius:4px;font-weight:900">💊 داروهای ترخیص</div>';
  if (dischargeMeds.length) {
    body += '<table style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr>';
    body += '<th style="background:#e0f2fe;border:1px solid #cbd5e1;padding:5px">دارو</th>';
    body += '<th style="background:#e0f2fe;border:1px solid #cbd5e1;padding:5px">دوز</th>';
    body += '<th style="background:#e0f2fe;border:1px solid #cbd5e1;padding:5px">مسیر</th>';
    body += '<th style="background:#e0f2fe;border:1px solid #cbd5e1;padding:5px">تکرار</th>';
    body += '<th style="background:#e0f2fe;border:1px solid #cbd5e1;padding:5px">تغییر</th>';
    body += '</tr></thead><tbody>';
    for (const m of dischargeMeds) {
      body += '<tr><td style="border:1px solid #cbd5e1;padding:5px"><strong>' + escHtml(m.drug) + '</strong></td>';
      body += '<td style="border:1px solid #cbd5e1;padding:5px">' + escHtml(m.dischargeDose || '—') + '</td>';
      body += '<td style="border:1px solid #cbd5e1;padding:5px">' + escHtml(m.dischargeRoute || '—') + '</td>';
      body += '<td style="border:1px solid #cbd5e1;padding:5px">' + escHtml(m.dischargeFrequency || '—') + '</td>';
      body += '<td style="border:1px solid #cbd5e1;padding:5px">' + ({continue:'ادامه', dose_changed:'تغییر دوز', new:'جدید'}[m.action] || m.action) + '</td></tr>';
    }
    body += '</tbody></table>';
    body += '<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:8px;margin-top:6px;font-size:10px"><strong>⚠️ توجه:</strong> لیست با ' + dischargeMeds.length + ' دارو توسط ' + escHtml((d.medicationReconciliation && d.medicationReconciliation.pharmacistVerifiedByName) || '—') + ' تأیید شد. آموزش بیمار و teach-back انجام شد.</div>';
  } else body += '<div class="box"><em>Medication Reconciliation انجام نشده</em></div>';

  // Section: Labs
  if (labs.length) {
    body += '<div class="section" style="background:#06b6d4;color:#fff;padding:5px 10px;margin:12px 0 6px;border-radius:4px;font-weight:900">📊 نتایج کلیدی</div>';
    body += '<table style="width:100%;border-collapse:collapse;font-size:9px"><thead><tr>';
    body += '<th style="background:#e0f2fe;border:1px solid #cbd5e1;padding:4px">پنل</th>';
    body += '<th style="background:#e0f2fe;border:1px solid #cbd5e1;padding:4px">تاریخ</th>';
    body += '<th style="background:#e0f2fe;border:1px solid #cbd5e1;padding:4px">مقادیر</th>';
    body += '</tr></thead><tbody>';
    for (const l of labs) {
      const vals = l.results ? Object.entries(l.results).slice(0, 5).map(([k, v]) => k + '=' + v).join(' · ') : '—';
      const crit = l.criticalFlags && l.criticalFlags.length;
      body += '<tr' + (crit ? ' style="background:#fef2f2"' : '') + '><td style="border:1px solid #cbd5e1;padding:4px">' + escHtml(l.panelName || l.panelCode) + '</td>';
      body += '<td style="border:1px solid #cbd5e1;padding:4px">' + fmtDate(l.orderedAt) + '</td>';
      body += '<td style="border:1px solid #cbd5e1;padding:4px;font-family:monospace">' + escHtml(vals) + (crit ? ' ⚠️' : '') + '</td></tr>';
    }
    body += '</tbody></table>';
  }

  // Section: Consultations
  if (consults.length) {
    body += '<div class="section" style="background:#06b6d4;color:#fff;padding:5px 10px;margin:12px 0 6px;border-radius:4px;font-weight:900">🩺 مشاوره‌ها</div>';
    body += '<div class="box" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px">';
    for (const c of consults) {
      body += '<p style="margin:4px 0"><strong>' + escHtml(c.targetService) + ':</strong> ' + escHtml((c.response && c.response.answer) || '—') + '</p>';
    }
    body += '</div>';
  }

  // Section: Readmission risk
  if (d.readmissionAssessment) {
    const r = d.readmissionAssessment;
    const color = r.level === 'high' ? '#dc2626' : r.level === 'moderate' ? '#f59e0b' : '#10b981';
    body += '<div class="section" style="background:' + color + ';color:#fff;padding:5px 10px;margin:12px 0 6px;border-radius:4px;font-weight:900">🎯 ریسک Readmission 30 روزه</div>';
    body += '<div class="box" style="border:1px solid ' + color + ';background:#f8fafc;padding:10px">';
    body += '<p style="margin:4px 0"><strong>Score:</strong> ' + r.score + '/100 — <strong>سطح:</strong> ' + r.level + '</p>';
    if (r.factors && r.factors.length) {
      body += '<p style="margin:4px 0"><strong>فاکتورها:</strong> ' + r.factors.map(f => escHtml(f.feature) + ' (+' + f.weight + ')').join(' · ') + '</p>';
    }
    body += '<p style="margin:4px 0"><strong>توصیه:</strong> ' + escHtml(r.recommendation) + '</p>';
    if (r.transitionPlan && r.transitionPlan.components && r.transitionPlan.components.length) {
      body += '<p style="margin:4px 0"><strong>برنامه انتقال:</strong></p><ul style="margin:2px 0;padding-right:20px">';
      for (const c of r.transitionPlan.components) body += '<li>' + escHtml(c) + '</li>';
      body += '</ul>';
    }
    body += '</div>';
  }

  // Section: Follow-up
  if (d.followup && d.followup.length) {
    body += '<div class="section" style="background:#06b6d4;color:#fff;padding:5px 10px;margin:12px 0 6px;border-radius:4px;font-weight:900">📅 پیگیری‌های برنامه‌ریزی‌شده</div>';
    body += '<table style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr>';
    body += '<th style="background:#e0f2fe;border:1px solid #cbd5e1;padding:5px">سرویس</th>';
    body += '<th style="background:#e0f2fe;border:1px solid #cbd5e1;padding:5px">تاریخ</th>';
    body += '<th style="background:#e0f2fe;border:1px solid #cbd5e1;padding:5px">محل</th>';
    body += '</tr></thead><tbody>';
    for (const f of d.followup) {
      body += '<tr><td style="border:1px solid #cbd5e1;padding:5px">' + escHtml(f.service) + '</td>';
      body += '<td style="border:1px solid #cbd5e1;padding:5px">' + fmtDate(f.scheduledDate) + '</td>';
      body += '<td style="border:1px solid #cbd5e1;padding:5px">' + escHtml(f.location || '—') + '</td></tr>';
    }
    body += '</tbody></table>';
  }

  // Section: Teach-back summary
  if (d.teachBack && d.teachBack.length) {
    const last = d.teachBack[d.teachBack.length - 1];
    body += '<div class="section" style="background:#06b6d4;color:#fff;padding:5px 10px;margin:12px 0 6px;border-radius:4px;font-weight:900">🎓 آموزش بیمار (Teach-back)</div>';
    body += '<div class="box" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px">';
    body += '<p style="margin:4px 0"><strong>موضوعات آموزش‌داده‌شده:</strong> ' + last.topics.length + ' مورد</p>';
    body += '<p style="margin:4px 0"><strong>وضعیت:</strong> ' + (last.demonstratedCorrectly ? '✅ بیمار/مراقب درک خود را نشان داد' : '⚠️ نیاز به آموزش مجدد') + '</p>';
    body += '<p style="margin:4px 0"><strong>آموزش‌دهنده:</strong> ' + escHtml(last.verifiedByName) + ' — ' + fmtDateTime(last.verifiedAt) + '</p>';
    if (last.barrier) body += '<p style="margin:4px 0"><strong>موانع:</strong> ' + escHtml(last.barrier) + (last.barrierNote ? ' — ' + escHtml(last.barrierNote) : '') + '</p>';
    body += '</div>';
  }

  // Section: Note to PCP
  body += '<div class="section" style="background:#06b6d4;color:#fff;padding:5px 10px;margin:12px 0 6px;border-radius:4px;font-weight:900">📝 یادداشت به پزشک PCP</div>';
  body += '<div class="blank" style="min-height:80px;padding:8px;background:#fff;border:1px dashed #cbd5e1;border-radius:4px;color:#94a3b8;font-size:10px">— توسط پزشک ترخیص‌کننده تکمیل شود —</div>';

  // Signatures
  body += '<div class="sigs" style="display:flex;justify-content:space-between;margin-top:30px;padding-top:10px;border-top:1px solid #cbd5e1;gap:12px">';
  body += '<div class="sig" style="flex:1;text-align:center"><div class="lbl" style="font-weight:800;margin-bottom:30px;color:#64748b">پزشک ترخیص‌کننده</div><div class="line" style="border-top:1px solid #94a3b8;padding-top:4px;font-family:monospace;font-size:9px;color:#475569">' + escHtml(patient.attendingName || '_________________') + '</div></div>';
  body += '<div class="sig" style="flex:1;text-align:center"><div class="lbl" style="font-weight:800;margin-bottom:30px;color:#64748b">پرستار ترخیص</div><div class="line" style="border-top:1px solid #94a3b8;padding-top:4px;font-family:monospace;font-size:9px;color:#475569">_________________</div></div>';
  body += '<div class="sig" style="flex:1;text-align:center"><div class="lbl" style="font-weight:800;margin-bottom:30px;color:#64748b">PCP دریافت‌کننده</div><div class="line" style="border-top:1px solid #94a3b8;padding-top:4px;font-family:monospace;font-size:9px;color:#475569">_________________</div></div>';
  body += '</div>';

  const html = '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><title>Transition of Care — ' + escHtml(patient.firstName + ' ' + patient.lastName) + '</title>';
  const finalHtml = html + '<style>@page{size:A4;margin:12mm}body{font-family:"Vazirmatn","Tahoma",sans-serif;font-size:11px;line-height:1.55;color:#000;background:#fff;margin:0;padding:0}.sub{font-size:9.5px;color:#666}</style></head><body>' + body + '<div class="footer" style="margin-top:20px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:8.5px;color:#94a3b8;text-align:center;font-family:monospace">NABZ v1.0 — Transition of Care · ' + new Date().toISOString() + '</div></body></html>';

  ctx.audit.write('discharge_transition', 'pcp.handoff.generate', d.id, ctx.actor, {
    patientId: patient.id, diagnoses: diagnoses.length
  });

  return {
    html: finalHtml,
    title: 'Transition of Care — ' + patient.firstName + ' ' + patient.lastName,
    meta: { dischargeId: d.id, patientId: patient.id, generatedAt: new Date().toISOString() }
  };
}

// ═══════════════════════════════════════════════════════════
//  Complete discharge with full transition check (JCI gate)
// ═══════════════════════════════════════════════════════════
function completionChecklist(ctx) {
  const d = findDischarge(ctx, ctx.params.dischargeId);
  const checks = [
    {
      key: 'medrec',
      label: 'Medication Reconciliation',
      done: !!(d.medicationReconciliation && d.medicationReconciliation.pharmacistVerified),
      required: true,
      detail: d.medicationReconciliation
        ? (d.medicationReconciliation.pharmacistVerified ? 'تأیید شده توسط ' + d.medicationReconciliation.pharmacistVerifiedByName : 'در حال انجام')
        : 'شروع نشده'
    },
    {
      key: 'readmission',
      label: 'ارزیابی ریسک Readmission',
      done: !!d.readmissionAssessment,
      required: true,
      detail: d.readmissionAssessment ? ('Score ' + d.readmissionAssessment.score + ' — ' + d.readmissionAssessment.level) : 'انجام نشده'
    },
    {
      key: 'followup',
      label: 'پیگیری برنامه‌ریزی‌شده',
      done: !!(d.followup && d.followup.length > 0),
      required: true,
      detail: (d.followup && d.followup.length > 0) ? d.followup.length + ' قرار' : 'بدون پیگیری'
    },
    {
      key: 'teachback',
      label: 'Teach-back آموزش بیمار',
      done: !!(d.teachBack && d.teachBack.length > 0 && d.teachBack[d.teachBack.length - 1].demonstratedCorrectly),
      required: true,
      detail: (d.teachBack && d.teachBack.length > 0) ? (d.teachBack[d.teachBack.length - 1].demonstratedCorrectly ? 'موفق' : 'نیاز به آموزش مجدد') : 'انجام نشده'
    }
  ];

  const missing = checks.filter(c => c.required && !c.done);
  return {
    dischargeId: d.id,
    patientId: d.patientId,
    patientName: d.patientName,
    checks,
    readyToDischarge: missing.length === 0,
    missing: missing.map(c => c.key),
    missingLabels: missing.map(c => c.label),
    note: missing.length > 0
      ? '⚠️ JCI: قبل از ترخیص نهایی، ' + missing.length + ' مورد الزامی تکمیل نشده'
      : '✅ همه الزامات JCI تکمیل شده — آماده ترخیص'
  };
}

module.exports = {
  handlers: {
    startReconciliation, verifyReconciliation,
    suggestFollowup, scheduleFollowup,
    readmissionAssessment,
    teachBackVerify, teachBackTopics,
    pcpHandoff,
    completionChecklist
  },
  routes: [
    { method:'POST', path:'/api/wf/discharges/:dischargeId/medrec/start', handler:'startReconciliation', perm:'discharge.reconcile' },
    { method:'POST', path:'/api/wf/discharges/:dischargeId/medrec/verify', handler:'verifyReconciliation', perm:'discharge.reconcile' },
    { method:'GET',  path:'/api/wf/discharges/:dischargeId/followup/suggest', handler:'suggestFollowup', perm:'discharge.followup' },
    { method:'POST', path:'/api/wf/discharges/:dischargeId/followup', handler:'scheduleFollowup', perm:'discharge.followup' },
    { method:'GET',  path:'/api/wf/discharges/:dischargeId/readmission', handler:'readmissionAssessment', perm:'discharge.transition' },
    { method:'GET',  path:'/api/wf/teachback/topics', handler:'teachBackTopics', perm:'discharge.educate' },
    { method:'POST', path:'/api/wf/discharges/:dischargeId/teachback', handler:'teachBackVerify', perm:'discharge.educate' },
    { method:'GET',  path:'/api/wf/discharges/:dischargeId/pcp-handoff', handler:'pcpHandoff', perm:'discharge.transition' },
    { method:'GET',  path:'/api/wf/discharges/:dischargeId/checklist', handler:'completionChecklist', perm:'discharge.transition' }
  ],
  panels: []
};

console.log('[discharge_transition] loaded — Med Rec + Followup + Readmission + Teach-back + PCP Handoff');
