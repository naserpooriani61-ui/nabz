
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Quality Aggregator
//  Unified KPI dashboard + JCI tracer export
//  Standards: JCI, ISMP, SSC 2021, NANDA/NOC, IHI
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const perms = require('../core/permissions');

if (!perms.P['quality.dashboard.view']) {
  perms.P['quality.dashboard.view'] = 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,quality_officer';
  perms.P['quality.dashboard.export'] = 'admin,hospital_director,medical_director,nursing_director,quality_officer';
}

// ═══════════════════════════════════════════════════════════
//  Utilities
// ═══════════════════════════════════════════════════════════
function computeWindow(days) {
  const d = Math.max(1, Math.min(365, Number(days) || 7));
  const now = Date.now();
  return {
    sinceMs: now - d * 86400000,
    untilMs: now,
    since: new Date(now - d * 86400000).toISOString(),
    until: new Date(now).toISOString(),
    days: d
  };
}

function inWindow(iso, w) {
  const t = sd(iso);
  return t >= w.sinceMs && t <= w.untilMs;
}

function computeSeverity(value, target, lowerBetter) {
  if (value == null) return 'unknown';
  if (lowerBetter) {
    if (value <= target) return 'ok';
    if (value <= target * 1.5) return 'warning';
    return 'critical';
  } else {
    if (value >= target) return 'ok';
    if (value >= target * 0.85) return 'warning';
    return 'critical';
  }
}

function makeKpi(opts) {
  let value = null;
  if (opts.rawValue != null) {
    value = opts.rawValue;
  } else if (opts.denominator != null && opts.denominator > 0) {
    if (opts.unit === '%') {
      value = Math.round((opts.numerator / opts.denominator) * 1000) / 10;
    } else {
      value = opts.numerator;
    }
  }
  return {
    code: opts.code,
    fa: opts.fa,
    en: opts.en,
    standard: opts.standard,
    target: opts.target,
    unit: opts.unit,
    lowerIsBetter: !!opts.lowerIsBetter,
    numerator: opts.numerator,
    denominator: opts.denominator,
    value,
    status: value == null ? 'no_data' : 'computed',
    severity: computeSeverity(value, opts.target, opts.lowerIsBetter)
  };
}

function calcPatientDays(ctx, w, ward) {
  let patients = h(ctx, 'patients');
  if (ward) patients = patients.filter(p => p.wardCode === ward);
  let total = 0;
  for (const p of patients) {
    const admitted = sd(p.admittedAt);
    if (!admitted) continue;
    const discharged = p.dischargedAt ? sd(p.dischargedAt) : w.untilMs;
    const start = Math.max(admitted, w.sinceMs);
    const end = Math.min(discharged, w.untilMs);
    if (end > start) total += (end - start) / 86400000;
  }
  return Math.round(total * 10) / 10;
}

function applyWard(items, ward) {
  if (!ward) return items;
  return items.filter(x => x.wardCode === ward);
}

// ═══════════════════════════════════════════════════════════
//  KPI Functions
// ═══════════════════════════════════════════════════════════

// ─── Clinical ───
function kpiHandoffReadback(ctx, w, ward) {
  const reports = applyWard(h(ctx, 'nursing_reports').filter(r => inWindow(r.createdAt, w)), ward);
  const signed = reports.filter(r => r.signedAt);
  const received = reports.filter(r => r.receivedAt);
  return makeKpi({
    code: 'HANDOFF_READBACK', fa: 'انطباق Read-back تحویل', en: 'Handoff Read-back',
    standard: 'JCI IPSG.2', target: 95, unit: '%',
    numerator: received.length, denominator: signed.length
  });
}

function kpiMarRights(ctx, w, ward) {
  const mar = applyWard(h(ctx, 'mar').filter(m => m.status === 'given' && inWindow(m.administeredAt, w)), ward);
  const withRights = mar.filter(m => m.rightsMode === 'verified' || m.rightsMode === 'attested');
  return makeKpi({
    code: 'MAR_RIGHTS', fa: 'انطباق ۵ Rights', en: 'MAR 5-Rights',
    standard: 'ISMP / JCI', target: 98, unit: '%',
    numerator: withRights.length, denominator: mar.length
  });
}

function kpiHighAlertWitness(ctx, w, ward) {
  const mar = applyWard(h(ctx, 'mar').filter(m => m.status === 'given' && inWindow(m.administeredAt, w) && m.isHighAlert), ward);
  const witnessed = mar.filter(m => m.witnessedBy);
  return makeKpi({
    code: 'HIGH_ALERT_WITNESS', fa: 'شاهد High-Alert', en: 'High-Alert Witness',
    standard: 'ISMP 2024', target: 100, unit: '%',
    numerator: witnessed.length, denominator: mar.length
  });
}

function kpiPrnEffectiveness(ctx, w, ward) {
  const mar = applyWard(h(ctx, 'mar').filter(m => m.status === 'given' && inWindow(m.administeredAt, w)), ward);
  const prn = mar.filter(m => m.isPRN);
  const withEff = prn.filter(m => m.prnEffectiveness);
  return makeKpi({
    code: 'PRN_EFFECTIVENESS', fa: 'اثربخشی PRN مستند', en: 'PRN Effectiveness',
    standard: 'JCI IPSG.3', target: 90, unit: '%',
    numerator: withEff.length, denominator: prn.length
  });
}

function kpiCriticalLabReadback(ctx, w, ward) {
  const labs = applyWard(h(ctx, 'labs').filter(l => l.criticalFlags && l.criticalFlags.length && inWindow(l.resultedAt, w)), ward);
  const acked = labs.filter(l => l.acknowledgment && l.acknowledgment.acknowledged);
  return makeKpi({
    code: 'CRITICAL_LAB_READBACK', fa: 'Read-back lab بحرانی', en: 'Critical Lab Read-back',
    standard: 'JCI IPSG.2', target: 100, unit: '%',
    numerator: acked.length, denominator: labs.length
  });
}

function kpiCriticalImgReadback(ctx, w, ward) {
  const rads = applyWard(h(ctx, 'radiology').filter(r => r.criticalFlag && inWindow(r.reportedAt, w)), ward);
  const acked = rads.filter(r => r.acknowledgment && r.acknowledgment.acknowledged);
  return makeKpi({
    code: 'CRITICAL_IMG_READBACK', fa: 'Read-back تصویر بحرانی', en: 'Critical Imaging Read-back',
    standard: 'JCI IPSG.2', target: 100, unit: '%',
    numerator: acked.length, denominator: rads.length
  });
}

function kpiSepsis3h(ctx, w, ward) {
  const sepsis = applyWard(h(ctx, 'sepsis').filter(s => inWindow(s.screenedAt, w)), ward);
  const completed = sepsis.filter(s => s.bundle3h && s.bundle3h.completed);
  const onTime = completed.filter(s => s.bundle3h.onTime);
  return makeKpi({
    code: 'SEPSIS_3H_ONTIME', fa: 'SSC 3h به‌موقع', en: 'Sepsis 3h Bundle',
    standard: 'SSC 2021', target: 90, unit: '%',
    numerator: onTime.length, denominator: completed.length
  });
}

function kpiNOCMet(ctx, w, ward) {
  const scores = applyWard(h(ctx, 'noc_scores').filter(s => inWindow(s.scoredAt, w)), ward);
  const met = scores.filter(s => s.met);
  return makeKpi({
    code: 'NOC_MET', fa: 'NOC محقق', en: 'NOC Outcomes Met',
    standard: 'NANDA-I / NOC', target: 70, unit: '%',
    numerator: met.length, denominator: scores.length
  });
}

function kpiMarMissed(ctx, w, ward) {
  const mar = applyWard(h(ctx, 'mar').filter(m => inWindow(m.scheduledAt, w)), ward);
  const missed = mar.filter(m => m.status === 'missed');
  return makeKpi({
    code: 'MAR_MISSED_RATE', fa: 'نرخ missed MAR', en: 'MAR Missed Rate',
    standard: 'ISMP', target: 2, unit: '%', lowerIsBetter: true,
    numerator: missed.length, denominator: mar.length
  });
}

function kpiMarLate(ctx, w, ward) {
  const mar = applyWard(h(ctx, 'mar').filter(m => m.status === 'given' && inWindow(m.administeredAt, w)), ward);
  const late = mar.filter(m => m.lateMinutes && m.lateMinutes > 30);
  return makeKpi({
    code: 'MAR_LATE_RATE', fa: 'نرخ تأخیر MAR', en: 'MAR Late Rate',
    standard: 'ISMP', target: 5, unit: '%', lowerIsBetter: true,
    numerator: late.length, denominator: mar.length
  });
}

function kpiCriticalAlertAck(ctx, w, ward) {
  const alerts = applyWard(h(ctx, 'cdss_alerts').filter(a => a.severity === 'critical' && inWindow(a.createdAt, w)), ward);
  const acked = alerts.filter(a => a.readBack && a.readBack.acknowledged);
  return makeKpi({
    code: 'CRITICAL_ALERT_ACK', fa: 'تأیید هشدار بحرانی', en: 'Critical Alert Read-back',
    standard: 'JCI', target: 100, unit: '%',
    numerator: acked.length, denominator: alerts.length
  });
}

function kpiNcpCoverage(ctx, w, ward) {
  // ICU patients with active NCP
  let patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  if (ward) patients = patients.filter(p => p.wardCode === ward);
  else patients = patients.filter(p => /ICU|CCU/i.test(p.wardCode || ''));
  const ncp = h(ctx, 'nursing_care_plans').filter(c => c.status === 'active');
  const ncpPatientIds = new Set(ncp.map(c => c.patientId));
  const covered = patients.filter(p => ncpPatientIds.has(p.id));
  return makeKpi({
    code: 'NCP_COVERAGE', fa: 'پوشش NCP در ICU', en: 'NCP Coverage (ICU)',
    standard: 'NANDA-I', target: 90, unit: '%',
    numerator: covered.length, denominator: patients.length
  });
}

// ─── Safety ───
function kpiFallRate(ctx, w, ward) {
  const falls = applyWard(h(ctx, 'incidents').filter(i => i.category === 'fall' && inWindow(i.reportedAt, w)), ward);
  const ptDays = calcPatientDays(ctx, w, ward);
  const rate = ptDays > 0 ? Math.round((falls.length / ptDays) * 1000 * 10) / 10 : null;
  return makeKpi({
    code: 'FALL_RATE', fa: 'نرخ سقوط', en: 'Fall Rate',
    standard: 'JCI IPSG.6', target: 3, unit: 'per 1000 pt-day', lowerIsBetter: true,
    numerator: falls.length, denominator: ptDays, rawValue: rate
  });
}

function kpiPressureInjury(ctx, w, ward) {
  const pi = applyWard(h(ctx, 'incidents').filter(i => i.category === 'pressure_injury' && inWindow(i.reportedAt, w)), ward);
  const ptDays = calcPatientDays(ctx, w, ward);
  const rate = ptDays > 0 ? Math.round((pi.length / ptDays) * 1000 * 10) / 10 : null;
  return makeKpi({
    code: 'PRESSURE_INJURY_RATE', fa: 'نرخ زخم فشاری', en: 'Pressure Injury Rate',
    standard: 'JCI IPSG.6', target: 2, unit: 'per 1000 pt-day', lowerIsBetter: true,
    numerator: pi.length, denominator: ptDays, rawValue: rate
  });
}

// ─── Operational ───
function kpiEdBoarding(ctx, w, ward) {
  const boarding = h(ctx, 'ed_visits').filter(v => v.status === 'boarding' && inWindow(v.arrivalAt, w));
  const now = Date.now();
  let totalMin = 0;
  for (const b of boarding) totalMin += (now - sd(b.arrivalAt)) / 60000;
  const avgMin = boarding.length > 0 ? Math.round(totalMin / boarding.length) : null;
  return makeKpi({
    code: 'ED_BOARDING_TIME', fa: 'زمان boarding', en: 'ED Boarding Time',
    standard: 'ACEP', target: 240, unit: 'min', lowerIsBetter: true,
    numerator: boarding.length, denominator: null, rawValue: avgMin
  });
}

function kpiBedOccupancy(ctx, w, ward) {
  let beds = h(ctx, 'beds');
  if (ward) beds = beds.filter(b => b.wardCode === ward);
  const occ = beds.filter(b => b.status === 'occupied').length;
  const value = beds.length > 0 ? Math.round((occ / beds.length) * 1000) / 10 : null;
  return makeKpi({
    code: 'BED_OCCUPANCY', fa: 'اشغال تخت', en: 'Bed Occupancy',
    standard: 'Operations', target: 85, unit: '%',
    numerator: occ, denominator: beds.length
  });
}

// ═══════════════════════════════════════════════════════════
//  Aggregation
// ═══════════════════════════════════════════════════════════
function gatherKpis(ctx, w, ward) {
  return {
    clinical: [
      kpiHandoffReadback(ctx, w, ward),
      kpiMarRights(ctx, w, ward),
      kpiHighAlertWitness(ctx, w, ward),
      kpiPrnEffectiveness(ctx, w, ward),
      kpiCriticalLabReadback(ctx, w, ward),
      kpiCriticalImgReadback(ctx, w, ward),
      kpiSepsis3h(ctx, w, ward),
      kpiNOCMet(ctx, w, ward),
      kpiMarMissed(ctx, w, ward),
      kpiMarLate(ctx, w, ward),
      kpiCriticalAlertAck(ctx, w, ward),
      kpiNcpCoverage(ctx, w, ward)
    ],
    safety: [
      kpiFallRate(ctx, w, ward),
      kpiPressureInjury(ctx, w, ward)
    ],
    operational: [
      kpiEdBoarding(ctx, w, ward),
      kpiBedOccupancy(ctx, w, ward)
    ]
  };
}

function scoreFor(kpis) {
  const valid = kpis.filter(k => k.value != null);
  if (!valid.length) return null;
  let sum = 0;
  for (const k of valid) {
    if (k.lowerIsBetter) {
      sum += k.value <= k.target ? 100 : Math.max(0, 100 - ((k.value - k.target) / k.target) * 50);
    } else {
      sum += Math.min(100, Math.max(0, k.value));
    }
  }
  return Math.round(sum / valid.length);
}

// ═══════════════════════════════════════════════════════════
//  Handlers
// ═══════════════════════════════════════════════════════════
function overview(ctx) {
  const w = computeWindow(ctx.query.days || 7);
  const ward = ctx.query.ward || null;
  const grouped = gatherKpis(ctx, w, ward);
  const allKpis = [...grouped.clinical, ...grouped.safety, ...grouped.operational];

  const scores = {
    clinical: scoreFor(grouped.clinical),
    safety: scoreFor(grouped.safety),
    operational: scoreFor(grouped.operational)
  };
  scores.overall = Math.round(
    (scores.clinical || 0) * 0.6 +
    (scores.safety || 0) * 0.25 +
    (scores.operational || 0) * 0.15
  );

  return {
    window: w,
    ward: ward || 'all',
    categories: grouped,
    scores,
    totals: {
      total: allKpis.length,
      computed: allKpis.filter(k => k.status === 'computed').length,
      noData: allKpis.filter(k => k.status === 'no_data').length,
      ok: allKpis.filter(k => k.severity === 'ok').length,
      warning: allKpis.filter(k => k.severity === 'warning').length,
      critical: allKpis.filter(k => k.severity === 'critical').length
    }
  };
}

function trends(ctx) {
  const days = Math.min(30, Number(ctx.query.days) || 7);
  const codes = ['HANDOFF_READBACK', 'MAR_MISSED_RATE', 'SEPSIS_3H_ONTIME', 'NOC_MET', 'FALL_RATE', 'MAR_LATE_RATE'];
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(Date.now() - i * 86400000);
    dayStart.setHours(0, 0, 0, 0);
    const w = {
      sinceMs: dayStart.getTime(),
      untilMs: dayStart.getTime() + 86400000,
      since: dayStart.toISOString(),
      until: new Date(dayStart.getTime() + 86400000).toISOString(),
      days: 1
    };
    const daily = gatherKpis(ctx, w, null);
    const flat = [...daily.clinical, ...daily.safety, ...daily.operational];
    const bucket = { day: dayStart.toISOString().slice(0, 10) };
    for (const code of codes) {
      const k = flat.find(x => x.code === code);
      bucket[code] = k ? k.value : null;
    }
    buckets.push(bucket);
  }
  return { items: buckets, days, codes };
}

function execSummary(ctx) {
  const w = computeWindow(ctx.query.days || 30);
  const data = overview({ ...ctx, query: { ...ctx.query, days: w.days } });
  const flat = [
    ...data.categories.clinical,
    ...data.categories.safety,
    ...data.categories.operational
  ];
  const worst = flat
    .filter(k => k.value != null && (k.severity === 'warning' || k.severity === 'critical'))
    .sort((a, b) => {
      const aGap = a.lowerIsBetter ? (a.value - a.target) / a.target : (a.target - a.value) / a.target;
      const bGap = b.lowerIsBetter ? (b.value - b.target) / b.target : (b.target - b.value) / b.target;
      return bGap - aGap;
    })
    .slice(0, 5);
  const best = flat
    .filter(k => k.value != null && k.severity === 'ok')
    .sort((a, b) => {
      const aMargin = a.lowerIsBetter ? (a.target - a.value) / a.target : (a.value - a.target) / a.target;
      const bMargin = b.lowerIsBetter ? (b.target - b.value) / b.target : (b.value - b.target) / b.target;
      return bMargin - aMargin;
    })
    .slice(0, 5);

  const recommendations = [];
  for (const k of worst) {
    if (k.code === 'HANDOFF_READBACK') recommendations.push('تحویل شیفت: آموزش read-back (JCI IPSG.2) — شبیه‌سازی ماهانه');
    else if (k.code === 'MAR_MISSED_RATE') recommendations.push('MAR missed: بازبینی workflow — دوزهای high-alert با تایمر اضافی');
    else if (k.code === 'MAR_LATE_RATE') recommendations.push('MAR late: تنظیم timing MAR با shift schedule');
    else if (k.code === 'HIGH_ALERT_WITNESS') recommendations.push('High-Alert witness: الزام دیجیتال ۲-نفره');
    else if (k.code === 'CRITICAL_LAB_READBACK') recommendations.push('lab بحرانی: workflow read-back اجباری در pharmacy و ward');
    else if (k.code === 'SEPSIS_3H_ONTIME') recommendations.push('Sepsis: شروع bundle خودکار از triage');
    else if (k.code === 'NOC_MET') recommendations.push('NOC: آموزش پرستاران به Likert scoring');
    else if (k.code === 'FALL_RATE') recommendations.push('سقوط: بازبینی Morse Fall Scale + bed alarm');
    else if (k.code === 'PRESSURE_INJURY_RATE') recommendations.push('زخم فشاری: تغییر وضعیت هر ۲ ساعت — audit');
    else if (k.code === 'PRN_EFFECTIVENESS') recommendations.push('PRN: prompt خودکار اثربخشی پس از ۱ ساعت');
    else if (k.code === 'CRITICAL_ALERT_ACK') recommendations.push('هشدار بحرانی: آموزش read-back + audit روزانه');
    else if (k.code === 'NCP_COVERAGE') recommendations.push('NCP: auto-generate از پیشنهاد برای همه ICU');
  }

  return {
    window: w,
    overall: data.scores.overall,
    grade: data.scores.overall >= 90 ? 'A' : data.scores.overall >= 80 ? 'B' : data.scores.overall >= 70 ? 'C' : data.scores.overall >= 60 ? 'D' : 'F',
    categoryScores: { clinical: data.scores.clinical, safety: data.scores.safety, operational: data.scores.operational },
    topConcerns: worst.map(k => ({ code: k.code, fa: k.fa, value: k.value, target: k.target, unit: k.unit, severity: k.severity })),
    topStrengths: best.map(k => ({ code: k.code, fa: k.fa, value: k.value, target: k.target, unit: k.unit })),
    recommendations,
    noDataKPIs: flat.filter(k => k.status === 'no_data').map(k => ({ code: k.code, fa: k.fa })),
    generatedAt: new Date().toISOString()
  };
}

function departmentComparison(ctx) {
  const w = computeWindow(ctx.query.days || 7);
  const wards = Array.from(new Set(
    h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status))
      .map(p => p.wardCode).filter(Boolean)
  )).sort();
  const items = [];
  for (const ward of wards) {
    const grouped = gatherKpis(ctx, w, ward);
    const flat = [...grouped.clinical, ...grouped.safety, ...grouped.operational];
    const valid = flat.filter(k => k.value != null);
    const wardScore = valid.length ? Math.round(
      valid.reduce((s, k) => {
        if (k.lowerIsBetter) return s + (k.value <= k.target ? 100 : Math.max(0, 100 - (k.value - k.target) * 20));
        return s + Math.min(100, k.value);
      }, 0) / valid.length
    ) : null;
    const patientCount = h(ctx, 'patients').filter(p => p.wardCode === ward && ['in_care','admitted'].includes(p.status)).length;
    items.push({
      ward,
      patientCount,
      score: wardScore,
      critical: flat.filter(k => k.severity === 'critical').length,
      warning: flat.filter(k => k.severity === 'warning').length,
      kpis: {
        handoff: grouped.clinical[0].value,
        marMissed: grouped.clinical[8].value,
        marLate: grouped.clinical[9].value,
        sepsis3h: grouped.clinical[6].value,
        nocMet: grouped.clinical[7].value,
        fall: grouped.safety[0].value,
        pi: grouped.safety[1].value
      }
    });
  }
  items.sort((a, b) => (a.score == null ? 999 : a.score) - (b.score == null ? 999 : b.score));
  return { window: w, items, total: items.length };
}

function kpiDetail(ctx) {
  const code = ctx.params.code;
  const w = computeWindow(ctx.query.days || 7);
  const ward = ctx.query.ward || null;
  const grouped = gatherKpis(ctx, w, ward);
  const flat = [...grouped.clinical, ...grouped.safety, ...grouped.operational];
  const k = flat.find(x => x.code === code);
  if (!k) throw ctx.E.notFound('kpi_not_found');

  let drill = [];
  if (code === 'HANDOFF_READBACK') {
    drill = applyWard(h(ctx, 'nursing_reports').filter(r => inWindow(r.createdAt, w)), ward)
      .filter(r => r.signedAt)
      .map(r => ({ patientName: r.patientName, ward: r.wardCode, status: r.status, signedAt: r.signedAt, receivedAt: r.receivedAt }))
      .slice(0, 50);
  } else if (code === 'MAR_MISSED_RATE') {
    drill = applyWard(h(ctx, 'mar').filter(m => m.status === 'missed' && inWindow(m.scheduledAt, w)), ward)
      .map(m => ({ patientName: m.patientName, ward: m.wardCode, drugName: m.drugName, scheduledAt: m.scheduledAt }))
      .slice(0, 50);
  } else if (code === 'CRITICAL_LAB_READBACK') {
    drill = applyWard(h(ctx, 'labs').filter(l => l.criticalFlags && l.criticalFlags.length && inWindow(l.resultedAt, w)), ward)
      .map(l => ({ patientName: l.patientName, ward: l.wardCode, panel: l.panelName, flags: l.criticalFlags.length, acked: !!(l.acknowledgment && l.acknowledgment.acknowledged) }))
      .slice(0, 50);
  } else if (code === 'SEPSIS_3H_ONTIME') {
    drill = applyWard(h(ctx, 'sepsis').filter(s => inWindow(s.screenedAt, w)), ward)
      .map(s => ({ patientName: s.patientName, ward: s.wardCode, screenedAt: s.screenedAt, bundleCompleted: s.bundle3h && s.bundle3h.completed, onTime: s.bundle3h && s.bundle3h.onTime }))
      .slice(0, 50);
  } else if (code === 'HIGH_ALERT_WITNESS') {
    drill = applyWard(h(ctx, 'mar').filter(m => m.status === 'given' && m.isHighAlert && inWindow(m.administeredAt, w)), ward)
      .map(m => ({ patientName: m.patientName, ward: m.wardCode, drugName: m.drugName, administeredAt: m.administeredAt, witnessedBy: m.witnessedByName || null }))
      .slice(0, 50);
  } else if (code === 'FALL_RATE' || code === 'PRESSURE_INJURY_RATE') {
    const cat = code === 'FALL_RATE' ? 'fall' : 'pressure_injury';
    drill = applyWard(h(ctx, 'incidents').filter(i => i.category === cat && inWindow(i.reportedAt, w)), ward)
      .map(i => ({ patientName: i.patientName, ward: i.wardCode, severity: i.severity, reportedAt: i.reportedAt, description: (i.description || '').slice(0, 80) }))
      .slice(0, 50);
  }

  return {
    kpi: k,
    window: w,
    ward: ward || 'all',
    drill,
    drillCount: drill.length,
    generatedAt: new Date().toISOString()
  };
}

function jciExport(ctx) {
  const w = computeWindow(ctx.query.days || 30);
  const data = overview({ ...ctx, query: { ...ctx.query, days: w.days } });
  const flat = [
    ...data.categories.clinical,
    ...data.categories.safety,
    ...data.categories.operational
  ];
  const categoryMap = { clinical: 'Clinical', safety: 'Safety', operational: 'Operational' };

  const escCsv = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  let csv = '';
  csv += '# NABZ — JCI Tracer Data Export\n';
  csv += '# Generated: ' + new Date().toISOString() + '\n';
  csv += '# Window: ' + w.days + ' days (' + w.since + ' to ' + w.until + ')\n';
  csv += '# Overall Score: ' + data.scores.overall + '/100\n';
  csv += '\n';

  csv += 'SECTION: KPI_SNAPSHOT\n';
  csv += 'Category,KPI_Code,KPI_Name_FA,KPI_Name_EN,Value,Target,Unit,Standard,Status,Severity,Numerator,Denominator\n';
  for (const [cat, list] of Object.entries(data.categories)) {
    for (const k of list) {
      csv += [
        escCsv(categoryMap[cat]), escCsv(k.code), escCsv(k.fa), escCsv(k.en),
        escCsv(k.value), escCsv(k.target), escCsv(k.unit), escCsv(k.standard),
        escCsv(k.status), escCsv(k.severity),
        escCsv(k.numerator), escCsv(k.denominator)
      ].join(',') + '\n';
    }
  }

  csv += '\n\nSECTION: PATIENT_TRACER\n';
  csv += 'PatientID,PatientName,Ward,Bed,AdmittedAt,Diagnosis,Status,Age,NCP_Active,Last_NEWS2,Missed_MAR_Count,Handoff_Received\n';
  const activePatients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  const ncps = h(ctx, 'nursing_care_plans').filter(c => c.status === 'active');
  const ncpMap = {};
  ncps.forEach(c => { ncpMap[c.patientId] = c; });
  const allVitals = h(ctx, 'vitals');
  const allMar = h(ctx, 'mar');
  const allReports = h(ctx, 'nursing_reports');
  for (const p of activePatients) {
    const ncp = ncpMap[p.id];
    const pVitals = allVitals.filter(v => v.patientId === p.id).sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
    const pMar = allMar.filter(m => m.patientId === p.id);
    const missedCount = pMar.filter(m => m.status === 'missed').length;
    const lastHandoff = allReports.filter(r => r.patientId === p.id).sort((a, b) => sd(b.createdAt) - sd(a.createdAt))[0];
    csv += [
      escCsv(p.id), escCsv(p.firstName + ' ' + p.lastName), escCsv(p.wardCode), escCsv(p.bedNumber),
      escCsv(p.admittedAt), escCsv(p.diagnosis), escCsv(p.status), escCsv(p.age),
      escCsv(ncp ? 'Y' : 'N'),
      escCsv(pVitals[0] ? pVitals[0].news2 : null),
      escCsv(missedCount),
      escCsv(lastHandoff && lastHandoff.receivedAt ? 'Y' : 'N')
    ].join(',') + '\n';
  }

  csv += '\n\nSECTION: RECOMMENDATIONS\n';
  const summary = execSummary({ ...ctx, query: { ...ctx.query, days: w.days } });
  csv += 'Rank,Concern_Code,Concern_FA,Current_Value,Target,Severity\n';
  summary.topConcerns.forEach((c, i) => {
    csv += [escCsv(i + 1), escCsv(c.code), escCsv(c.fa), escCsv(c.value), escCsv(c.target), escCsv(c.severity)].join(',') + '\n';
  });
  csv += '\nAction Items:\n';
  summary.recommendations.forEach((r, i) => {
    csv += escCsv((i + 1) + '. ' + r) + '\n';
  });

  csv += '\n\n# End of export\n';

  return {
    window: w,
    format: 'csv',
    filename: 'jci-tracer-' + new Date().toISOString().slice(0, 10) + '.csv',
    content: csv,
    lineCount: csv.split('\n').length,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  handlers: {
    overview, trends, execSummary, departmentComparison, kpiDetail, jciExport
  },
  routes: [

    { method:'GET', path:'/api/qa/overview', handler:'overview', perm:'quality.dashboard.view' },
    { method:'GET', path:'/api/qa/trends', handler:'trends', perm:'quality.dashboard.view' },
    { method:'GET', path:'/api/qa/exec-summary', handler:'execSummary', perm:'quality.dashboard.view' },
    { method:'GET', path:'/api/qa/department-comparison', handler:'departmentComparison', perm:'quality.dashboard.view' },
    { method:'GET', path:'/api/qa/export/jci', handler:'jciExport', perm:'quality.dashboard.export' },
    { method:'GET', path:'/api/qa/kpi/:code', handler:'kpiDetail', perm:'quality.dashboard.view' },
  
  ],
  panels: [
    { id:'dashboard', title:'داشبورد کیفیت', icon:'📊', perm:'quality.dashboard.view', kind:'qa_dashboard', api:'/api/qa/overview' }
  ]
};
