
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — MAR Advanced (medication safety depth)
//  Standards: ISMP 2024 High-Alert, JCI IPSG.3, ISMP Late Doses
//  - ISMP 2024 high-alert (very + high)
//  - PRN effectiveness tracking (1h window per JCI)
//  - Late administration with reason codes (ISMP)
//  - Insulin sliding scale (Yale modified)
//  - Auto-escalation overdue → missed (60s timer)
//  - Shift handoff intelligence
//  - Validated witness (real user, not fake string)
//  - Enhanced administer wrapper (rejects late without reason)
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const bus = require('../core/events');
const store = require('../core/store');
const clinical = require('./clinical');

// ═══════════════════════════════════════════════════════════
//  ISMP 2024 Lists (High-Alert Medications in Acute Care)
// ═══════════════════════════════════════════════════════════
const VERY_HIGH_ALERT_KEYWORDS = [
  'insulin', 'heparin', 'warfarin', 'methotrexate', 'chemotherapy',
  'potassium chloride', 'potassium phosphate', 'concentrated sodium',
  'hypertonic saline', 'opioid', 'morphine', 'fentanyl', 'hydromorphone',
  'oxycodone', 'methadone', 'neuromuscular blocker', 'rocuronium',
  'vecuronium', 'succinylcholine', 'paraldehyde', 'sterile water',
  'epoprostenol', 'magnesium sulfate', 'promethazine'
];

const HIGH_ALERT_KEYWORDS = [
  'insulin', 'heparin', 'warfarin', 'morphine', 'fentanyl', 'hydromorphone',
  'oxycodone', 'methadone', 'buprenorphine', 'potassium', 'digoxin',
  'amiodarone', 'lidocaine', 'magnesium', 'chemo', 'methotrexate',
  'cisplatin', 'doxorubicin', 'vincristine', 'cyclophosphamide',
  'epinephrine', 'norepinephrine', 'dopamine', 'dobutamine',
  'nitroprusside', 'nitroglycerin', 'milrinone', 'vasopressin',
  'propofol', 'midazolam', 'dexmedetomidine', 'etomidate',
  'ketamine', 'pentobarbital', 'phenobarbital',
  'alteplase', 'tpa', 'tenecteplase', 'argatroban', 'bivalirudin',
  'apixaban', 'rivaroxaban', 'dabigatran', 'enoxaparin',
  'sodium chloride 3', 'sodium chloride 23.4',
  'glucose 50', 'd50', 'dextrose 50',
  'hypertonic', 'immunosuppressant', 'tacrolimus', 'cyclosporine'
];

function isVeryHighAlert(drug) {
  const d = String(drug || '').toLowerCase();
  return VERY_HIGH_ALERT_KEYWORDS.some(k => d.indexOf(k) >= 0);
}
function isHighAlert(drug) {
  const d = String(drug || '').toLowerCase();
  return HIGH_ALERT_KEYWORDS.some(k => d.indexOf(k) >= 0);
}

// ═══════════════════════════════════════════════════════════
//  Insulin Sliding Scale Protocols
// ═══════════════════════════════════════════════════════════
const SLIDING_SCALES = {
  'insulin_standard': {
    label: 'Insulin Sliding Scale — Standard (modified Yale)',
    unit: 'units', drug: 'insulin regular', route: 'SC',
    source: 'Modified Yale Insulin Infusion Protocol (2019)',
    thresholds: [
      { min: 0, max: 70, units: 0, action: 'HYPOGLYCEMIA — D50 25g IV، نگه‌داشتن انسولین، تماس با پزشک', action_type: 'hypo' },
      { min: 70, max: 150, units: 0, note: 'بدون انسولین' },
      { min: 150, max: 200, units: 2, note: '۲ واحد SC' },
      { min: 200, max: 250, units: 4, note: '۴ واحد SC' },
      { min: 250, max: 300, units: 6, note: '۶ واحد SC' },
      { min: 300, max: 350, units: 8, note: '۸ واحد + اطلاع پزشک' },
      { min: 350, max: 999, units: 8, action: 'HYPERGLYCEMIA SEVERE — اطلاع فوری پزشک، انسولین وریدی', action_type: 'hyper' }
    ]
  },
  'insulin_low_dose': {
    label: 'Insulin Sliding Scale — Low Dose',
    unit: 'units', drug: 'insulin regular', route: 'SC',
    source: 'ICU low-dose protocol',
    thresholds: [
      { min: 0, max: 70, units: 0, action: 'HYPOGLYCEMIA — D50 25g IV', action_type: 'hypo' },
      { min: 70, max: 150, units: 0 },
      { min: 150, max: 200, units: 1 },
      { min: 200, max: 250, units: 2 },
      { min: 250, max: 300, units: 4 },
      { min: 300, max: 400, units: 6, note: 'اطلاع پزشک' },
      { min: 400, max: 999, units: 6, action: 'اطلاع پزشک — انسولین وریدی', action_type: 'hyper' }
    ]
  },
  'insulin_high_dose': {
    label: 'Insulin Sliding Scale — High Dose (insulin-resistant)',
    unit: 'units', drug: 'insulin regular', route: 'SC',
    source: 'Post-op / steroid-induced hyperglycemia',
    thresholds: [
      { min: 0, max: 70, units: 0, action: 'HYPOGLYCEMIA — D50 25g IV', action_type: 'hypo' },
      { min: 70, max: 150, units: 0 },
      { min: 150, max: 200, units: 4 },
      { min: 200, max: 250, units: 8 },
      { min: 250, max: 300, units: 12 },
      { min: 300, max: 350, units: 16, note: 'اطلاع پزشک' },
      { min: 350, max: 999, units: 20, action: 'اطلاع فوری — انسولین وریدی', action_type: 'hyper' }
    ]
  }
};

// ═══════════════════════════════════════════════════════════
//  Late Reason Codes (ISMP taxonomy)
// ═══════════════════════════════════════════════════════════
const LATE_REASONS = {
  patient_npo: 'بیمار NPO / ناشتا',
  procedure_pending: 'منتظر پروسیجر / تصویربرداری',
  doctor_hold: 'دستور نگه‌داشتن توسط پزشک',
  pharmacy_delay: 'تأخیر تحویل داروخانه',
  clinical_decision: 'تصمیم بالینی پرستار',
  patient_refused: 'رد بیمار (با توضیح)',
  patient_off_unit: 'بیمار خارج از بخش',
  iv_access_issue: 'مشکل دسترسی وریدی',
  equipment_issue: 'مشکل پمپ/تجهیزات',
  medication_unavailable: 'دارو موجود نبود',
  other: 'سایر'
};

// ═══════════════════════════════════════════════════════════
//  Panel override (clinical.mar → mar_v2)
// ═══════════════════════════════════════════════════════════
if (clinical && clinical.panels) {
  const mp = clinical.panels.find(p => p.id === 'mar');
  if (mp) {
    mp.kind = 'mar_v2';
    mp.api = '/api/mar/detailed';
    mp.title = 'MAR — مدیریت دارو';
    mp.icon = '💊';
  }
}

// ═══════════════════════════════════════════════════════════
//  Enhanced MAR Administer (wraps clinical.js with validations)
// ═══════════════════════════════════════════════════════════
function administerAdvanced(ctx) {
  const marId = ctx.params.id;
  const m = store.get('mar', marId);
  if (!m) throw ctx.E.notFound('mar_not_found');

  // ─── Late reason validation ───
  const sched = sd(m.scheduledAt);
  const driftMin = Math.round((Date.now() - sched) / 60000);
  const b = ctx.body || {};
  if (driftMin > 30 && !b.lateReason) {
    throw ctx.E.conflict('late_reason_required:' + driftMin + '_minutes_late');
  }
  if (driftMin > 30 && b.lateReason && !LATE_REASONS[b.lateReason]) {
    throw ctx.E.badRequest('invalid_late_reason');
  }

  // ─── Very-high-alert: require attending-level or admin ───
  const veryHigh = isVeryHighAlert(m.drugName);
  if (veryHigh && !['admin','attending','specialist'].includes(ctx.actor.role)) {
    throw ctx.E.forbidden('very_high_alert_requires_attending');
  }

  // ─── Call clinical.js's original logic ───
  const original = clinical.handlers.marAdminister;
  if (typeof original !== 'function') throw ctx.E.badRequest('clinical_mars_unavailable');
  const result = original(ctx);

  // ─── Annotate with late reason ───
  if (driftMin > 30) {
    result.lateReason = b.lateReason;
    result.lateMinutes = driftMin;
    require('../core/domain/mar-writer').update(ctx, result);
    bus.emit('mar.late_administration', { record: result, driftMin, lateReason: b.lateReason, actor: ctx.actor });
  }

  // ─── PRN: flag for effectiveness ───
  const order = result.orderId ? store.get('orders', result.orderId) : null;
  if (order && order.details && order.details.prn) {
    result.prnEffectivenessPending = true;
    result.prnEffectivenessDueAt = new Date(Date.now() + 3600000).toISOString(); // 1h window
    require('../core/domain/mar-writer').update(ctx, result);
  }

  // ─── Very-high-alert: audit ───
  if (veryHigh) {
    ctx.audit.write('mar_advanced', 'very_high_alert.administered', result.id, ctx.actor, {
      drug: result.drugName, dose: result.dose, patient: result.patientName
    });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════
//  PRN Effectiveness (JCI IPSG.3)
// ═══════════════════════════════════════════════════════════
function prnEffectiveness(ctx) {
  const m = store.get('mar', ctx.params.id);
  if (!m) throw ctx.E.notFound('mar_not_found');
  if (m.status !== 'given') throw ctx.E.conflict('must_be_given_first');

  const order = m.orderId ? store.get('orders', m.orderId) : null;
  if (!order || !order.details || !order.details.prn) {
    throw ctx.E.conflict('not_a_prn_medication');
  }

  const b = ctx.body || {};
  if (!b.scale || b.before == null || b.after == null) {
    throw ctx.E.badRequest('scale_before_after_required');
  }
  const valid = ['pain','nausea','anxiety','dyspnea','pruritus','agitation','custom'];
  if (!valid.includes(b.scale)) throw ctx.E.badRequest('invalid_scale');

  const before = Number(b.before);
  const after = Number(b.after);
  if (isNaN(before) || isNaN(after)) throw ctx.E.badRequest('invalid_numbers');
  const delta = before - after;
  const pct = before > 0 ? Math.round((delta / before) * 100) : 0;

  let effective;
  if (b.scale === 'pain') effective = after < 4 || delta >= 3;
  else if (b.scale === 'nausea') effective = after < 2 || delta >= 2;
  else effective = delta >= 2;

  const rec = {
    id: ctx.uid('prn_eff'),
    marId: m.id, orderId: m.orderId,
    patientId: m.patientId, patientName: m.patientName,
    drugName: m.drugName, dose: m.dose,
    administeredAt: m.administeredAt,
    checkedAt: ctx.now(),
    checkedBy: ctx.actor.id,
    checkedByName: ctx.actor.fullName || ctx.actor.username,
    scale: b.scale, before, after, delta, pctImprovement: pct,
    effective, notes: b.notes || ''
  };
  store.put('prn_effectiveness', rec);
  m.prnEffectiveness = rec.id;
  m.prnEffectivenessAt = ctx.now();
  m.prnEffectivenessPending = false;
  require('../core/domain/mar-writer').update(ctx, m);
  ctx.audit.write('mar_advanced', 'prn.effectiveness', m.id, ctx.actor, { before, after, scale: b.scale, effective });
  bus.emit('mar.prn.effectiveness', { record: rec, actor: ctx.actor });
  if (!effective) {
    bus.emit('cdss.alert', {
      type: 'prn_ineffective', severity: 'warning',
      patientId: m.patientId, patientName: m.patientName,
      title: '⚠️ PRN بی‌اثر — ' + m.patientName,
      message: m.drugName + ' — ' + b.scale + ': ' + before + ' → ' + after,
      recommendation: 'بررسی مجدد بالینی — روش جایگزین یا تماس با پزشک'
    });
  }
  return rec;
}

// ═══════════════════════════════════════════════════════════
//  PRN Administer (create + give in one — for PRN orders without MAR)
// ═══════════════════════════════════════════════════════════
function prnAdminister(ctx) {
  const b = ctx.body || {};
  if (!b.orderId) throw ctx.E.badRequest('order_id_required');
  const order = store.get('orders', b.orderId);
  if (!order) throw ctx.E.notFound('order_not_found');
  if (!order.details || !order.details.prn) throw ctx.E.conflict('order_not_prn');
  if (order.status !== 'verified' && order.status !== 'active') throw ctx.E.conflict('order_not_verified');

  const patient = store.get('patients', order.patientId);
  if (!patient) throw ctx.E.notFound('patient_not_found');

  // 5 rights
  const rights = b.rights || {};
  if (rights.patientId && rights.patientId !== order.patientId) throw ctx.E.badRequest('patient_mismatch');
  const missing = ['patient','drug','dose','route','time'].filter(r => !rights[r] && !b.fiveRights?.[r]);
  if (missing.length) throw ctx.E.badRequest('five_rights_missing:' + missing.join(','));

  // High-alert witness
  const drug = order.details.drug || '';
  const high = isHighAlert(drug);
  let witness = null;
  if (high) {
    if (!b.witnessedBy) throw ctx.E.badRequest('witness_required');
    if (b.witnessedBy === ctx.actor.id || b.witnessedBy === ctx.actor.username) throw ctx.E.badRequest('witness_must_differ');
    witness = h(ctx, 'users').find(u => (u.id === b.witnessedBy || u.username === b.witnessedBy) && u.active !== false);
    if (!witness) throw ctx.E.badRequest('witness_not_valid_user');
  }

  const mar = {
    id: ctx.uid('mar'),
    orderId: order.id,
    patientId: order.patientId,
    patientName: patient.firstName + ' ' + patient.lastName,
    wardCode: patient.wardCode,
    drugName: drug, dose: order.details.dose || '', route: order.details.route || '',
    scheduledAt: ctx.now(), // PRN: administered at request time
    administeredAt: ctx.now(),
    administeredBy: ctx.actor.id,
    administeredByName: ctx.actor.fullName || ctx.actor.username,
    status: 'given',
    isHighAlert: high,
    isPRN: true,
    witnessedBy: witness ? witness.id : null,
    witnessedByName: witness ? (witness.fullName || witness.username) : null,
    rightsMode: 'verified',
    rightsDetail: rights,
    prnReason: b.prnReason || '', // e.g., "pain 8/10"
    prnIndication: b.prnIndication || null,
    prnEffectivenessPending: true,
    prnEffectivenessDueAt: new Date(Date.now() + 3600000).toISOString(),
    notes: b.notes || ''
  };
  require('../core/domain/mar-writer').update(ctx, mar, { event: 'kardex.mar.given' });
  ctx.audit.write('mar_advanced', 'prn.administer', mar.id, ctx.actor, {
    drug, dose: mar.dose, patient: mar.patientName, prnReason: mar.prnReason
  });
  return mar;
}

// ═══════════════════════════════════════════════════════════
//  Sliding Scale Calculator
// ═══════════════════════════════════════════════════════════
function slidingScaleCalculate(ctx) {
  const b = ctx.body || {};
  if (b.glucose == null) throw ctx.E.badRequest('glucose_required');
  const glucose = Number(b.glucose);
  if (isNaN(glucose) || glucose < 0) throw ctx.E.badRequest('invalid_glucose');
  const key = b.scale || 'insulin_standard';
  const scale = SLIDING_SCALES[key];
  if (!scale) throw ctx.E.badRequest('invalid_scale');
  const th = scale.thresholds.find(t => glucose >= t.min && glucose < t.max) || scale.thresholds[scale.thresholds.length - 1];
  const result = {
    scale: key, scaleLabel: scale.label, source: scale.source,
    glucose, units: th.units,
    action: th.action || null,
    actionType: th.action_type || null,
    note: th.note || null,
    needsNotify: th.action_type === 'hyper' || th.action_type === 'hypo',
    drug: scale.drug, route: scale.route, unit: scale.unit
  };
  if (b.patientId) {
    store.put('sliding_scale_checks', {
      id: ctx.uid('ssc'),
      patientId: b.patientId,
      scale: key, glucose, units: th.units,
      actionType: result.actionType,
      checkedAt: ctx.now(), checkedBy: ctx.actor.id
    });
  }
  return result;
}

function listSlidingScales() {
  return {
    items: Object.entries(SLIDING_SCALES).map(([k, v]) => ({
      code: k, label: v.label, source: v.source, drug: v.drug,
      route: v.route, thresholds: v.thresholds.length
    })),
    total: Object.keys(SLIDING_SCALES).length
  };
}

function listLateReasons() {
  return { items: LATE_REASONS, total: Object.keys(LATE_REASONS).length };
}

// ═══════════════════════════════════════════════════════════
//  Overdue / Missed escalation
// ═══════════════════════════════════════════════════════════
function overdueList(ctx) {
  const now = Date.now();
  const mar = h(ctx, 'mar').filter(m => m.status === 'scheduled' || m.status === 'due');
  const overdue = [];
  for (const m of mar) {
    const sched = sd(m.scheduledAt);
    const diffMin = Math.round((now - sched) / 60000);
    if (diffMin > 30) {
      overdue.push({
        id: m.id, patientId: m.patientId, patientName: m.patientName,
        drugName: m.drugName, dose: m.dose, route: m.route,
        scheduledAt: m.scheduledAt, minutesLate: diffMin,
        isHighAlert: m.isHighAlert || isHighAlert(m.drugName),
        isVeryHighAlert: isVeryHighAlert(m.drugName),
        wardCode: m.wardCode, orderId: m.orderId,
        severity: diffMin > 120 ? 'critical' : diffMin > 60 ? 'high' : 'medium'
      });
    }
  }
  overdue.sort((a, b) => b.minutesLate - a.minutesLate);
  return { items: overdue, total: overdue.length, checkedAt: ctx.now() };
}

// ─── Timer-based escalation ───
const _escalated = new Set();
function escalateOverdue() {
  try {
    const now = Date.now();
    const mar = store.readAll('mar').filter(m => m.status === 'scheduled' || m.status === 'due');
    for (const m of mar) {
      const diffMin = Math.round((now - sd(m.scheduledAt)) / 60000);
      if (diffMin >= 60 && !_escalated.has(m.id)) {
        _escalated.add(m.id);
        if (diffMin >= 120) {
          require('../core/domain/mar-writer').systemMiss(null, m.id, 'auto: >2h overdue');
        }
        bus.emit('cdss.alert', {
          type: 'mar_overdue',
          severity: diffMin >= 120 ? 'critical' : 'warning',
          patientId: m.patientId, patientName: m.patientName,
          title: (diffMin >= 120 ? '🚨 دوز missed — ' : '⚠️ دوز دیرکرد — ') + m.patientName,
          message: m.drugName + ' — ' + diffMin + ' دقیقه تأخیر',
          recommendation: diffMin >= 120 ? 'بررسی فوری: آیا داده شده؟' : 'توزیع سریع یا ثبت دلیل'
        });
      }
    }
    // Cleanup old escalations to prevent memory leak
    if (_escalated.size > 10000) _escalated.clear();
  } catch (e) {
    console.warn('[mar_adv] escalateOverdue:', e.message);
  }
}

let _timerStarted = false;
function startTimer() {
  if (_timerStarted) return;
  _timerStarted = true;
  setTimeout(() => {
    escalateOverdue();
    setInterval(escalateOverdue, 60000);
  }, 5000);
  console.log('[mar_advanced] background timer (60s) scheduled');
}
startTimer();

// ═══════════════════════════════════════════════════════════
//  MAR Detailed (enriched for UI)
// ═══════════════════════════════════════════════════════════
function detailed(ctx) {
  let items = h(ctx, 'mar');
  if (ctx.query.patientId) items = items.filter(m => m.patientId === ctx.query.patientId);
  if (ctx.query.ward) items = items.filter(m => m.wardCode === ctx.query.ward);
  if (ctx.query.status) items = items.filter(m => m.status === ctx.query.status);
  const now = Date.now();
  const enriched = items.map(m => {
    const diff = Math.round((now - sd(m.scheduledAt)) / 60000);
    const order = m.orderId ? store.get('orders', m.orderId) : null;
    const isPRN = !!(order && order.details && order.details.prn);
    const vhigh = isVeryHighAlert(m.drugName);
    const high = m.isHighAlert || isHighAlert(m.drugName);
    return Object.assign({}, m, {
      _minutesFromScheduled: diff,
      _isOverdue: diff > 30 && ['scheduled','due'].includes(m.status),
      _isVeryOverdue: diff > 120 && ['scheduled','due'].includes(m.status),
      _isHighAlert: high,
      _isVeryHighAlert: vhigh,
      _isPRN: isPRN,
      _prnOrderId: isPRN ? m.orderId : null,
      _needsEffectiveness: isPRN && m.status === 'given' && !m.prnEffectiveness,
      _hasEffectiveness: !!m.prnEffectiveness,
      _orderDetails: order ? order.details : null
    });
  }).sort((a, b) => {
    if (a._isVeryOverdue !== b._isVeryOverdue) return a._isVeryOverdue ? -1 : 1;
    if (a._isOverdue !== b._isOverdue) return a._isOverdue ? -1 : 1;
    if (a._isVeryHighAlert !== b._isVeryHighAlert) return a._isVeryHighAlert ? -1 : 1;
    return sd(a.scheduledAt) - sd(b.scheduledAt);
  });
  return { items: enriched, total: enriched.length, checkedAt: ctx.now() };
}

// ═══════════════════════════════════════════════════════════
//  Shift Handoff Intelligence
// ═══════════════════════════════════════════════════════════
function handoff(ctx) {
  const ward = ctx.query.ward || ctx.actor.ward || null;
  const hours = Number(ctx.query.hours) || 8;
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  const all = h(ctx, 'mar').filter(m => {
    if (ward && m.wardCode !== ward) return false;
    return sd(m.administeredAt) >= sd(since) || sd(m.scheduledAt) >= sd(since);
  });
  const given = all.filter(m => m.status === 'given');
  const missed = all.filter(m => m.status === 'missed');
  const refused = all.filter(m => m.status === 'refused');
  const pending = all.filter(m => ['scheduled','due'].includes(m.status));
  const highGiven = given.filter(m => m.isHighAlert || isHighAlert(m.drugName));
  const prnGiven = given.filter(m => {
    const o = m.orderId ? store.get('orders', m.orderId) : null;
    return o && o.details && o.details.prn;
  });
  const prnMissing = prnGiven.filter(m => !m.prnEffectiveness);
  const lateGiven = given.filter(m => m.lateMinutes && m.lateMinutes > 30);

  return {
    window: { since, until: ctx.now(), hours, ward },
    counts: {
      given: given.length, missed: missed.length, refused: refused.length,
      pending: pending.length, highAlertGiven: highGiven.length,
      prnGiven: prnGiven.length, prnWithoutEffectiveness: prnMissing.length,
      lateGiven: lateGiven.length
    },
    details: {
      missed: missed.slice(0, 20).map(m => ({ id: m.id, patientName: m.patientName, drugName: m.drugName, scheduledAt: m.scheduledAt, minutesLate: Math.round((Date.now() - sd(m.scheduledAt)) / 60000) })),
      highAlertGiven: highGiven.slice(0, 20).map(m => ({ id: m.id, patientName: m.patientName, drugName: m.drugName, dose: m.dose, administeredAt: m.administeredAt, witnessedBy: m.witnessedByName || null })),
      prnWithoutEffectiveness: prnMissing.slice(0, 20).map(m => ({ id: m.id, patientName: m.patientName, drugName: m.drugName, administeredAt: m.administeredAt, dueAt: m.prnEffectivenessDueAt })),
      lateGiven: lateGiven.slice(0, 20).map(m => ({ id: m.id, patientName: m.patientName, drugName: m.drugName, minutesLate: m.lateMinutes, reason: LATE_REASONS[m.lateReason] || m.lateReason }))
    }
  };
}

// ═══════════════════════════════════════════════════════════
//  High-Alert Audit
// ═══════════════════════════════════════════════════════════
function highAlertAudit(ctx) {
  const days = Number(ctx.query.days) || 7;
  const since = Date.now() - days * 86400000;
  const given = h(ctx, 'mar').filter(m => m.status === 'given' && sd(m.administeredAt) >= since);
  const high = given.filter(m => m.isHighAlert || isHighAlert(m.drugName));
  const withWitness = high.filter(m => m.witnessedBy);
  const withoutWitness = high.filter(m => !m.witnessedBy);
  return {
    window: { days, since: new Date(since).toISOString(), until: ctx.now() },
    totalHighAlert: high.length,
    withWitness: withWitness.length,
    withoutWitness: withoutWitness.length,
    compliancePct: high.length > 0 ? Math.round((withWitness.length / high.length) * 100) : 100,
    violations: withoutWitness.slice(0, 20).map(m => ({
      id: m.id, patientName: m.patientName, drugName: m.drugName,
      administeredAt: m.administeredAt, administeredBy: m.administeredByName
    }))
  };
}

// ═══════════════════════════════════════════════════════════
//  Annotate (for legacy/fix)
// ═══════════════════════════════════════════════════════════
function annotate(ctx) {
  const m = store.get('mar', ctx.params.id);
  if (!m) throw ctx.E.notFound('mar_not_found');
  const b = ctx.body || {};
  if (b.lateReason) {
    if (!LATE_REASONS[b.lateReason]) throw ctx.E.badRequest('invalid_late_reason');
    m.lateReason = b.lateReason;
  }
  if (b.notes !== undefined) m.notes = b.notes;
  if (b.prnIndication) m.prnIndication = b.prnIndication;
  require('../core/domain/mar-writer').update(ctx, m);
  return m;
}

module.exports = {
  handlers: {
    detailed, administerAdvanced, prnEffectiveness, prnAdminister,
    slidingScaleCalculate, listSlidingScales, listLateReasons,
    overdueList, handoff, highAlertAudit, annotate
  },
  routes: [

    { method:'GET',  path:'/api/mar/detailed', handler:'detailed', perm:'kardex.view' },
    { method:'POST', path:'/api/mar/prn-administer', handler:'prnAdminister', perm:'kardex.mar.administer' },
    { method:'POST', path:'/api/mar/sliding-scale/calculate', handler:'slidingScaleCalculate', perm:'cdss.view' },
    { method:'GET',  path:'/api/mar/sliding-scales', handler:'listSlidingScales', perm:'cdss.view' },
    { method:'GET',  path:'/api/mar/late-reasons', handler:'listLateReasons', perm:'kardex.view' },
    { method:'GET',  path:'/api/mar/overdue', handler:'overdueList', perm:'kardex.view' },
    { method:'GET',  path:'/api/mar/handoff', handler:'handoff', perm:'kardex.view' },
    { method:'GET',  path:'/api/mar/high-alert-audit', handler:'highAlertAudit', perm:'quality.view' },
    { method:'POST', path:'/api/mar/:id/administer-advanced', handler:'administerAdvanced', perm:'kardex.mar.administer' },
    { method:'POST', path:'/api/mar/:id/prn-effectiveness', handler:'prnEffectiveness', perm:'kardex.mar.administer' },
    { method:'POST', path:'/api/mar/:id/annotate', handler:'annotate', perm:'kardex.mar.administer' },
  
  ],
  panels: [
    { id:'handoff', title:'MAR — تحویل شیفت', icon:'📋', perm:'kardex.view', kind:'mar_handoff', api:'/api/mar/handoff' }
  ]
};
