
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Order Set Intelligence
//  Clinical decision support for order set selection:
//   1. Ranked recommendations per patient
//   2. Duplicate detection (already-applied sets)
//   3. Pre-apply safety summary
//   4. Pathway association
// ═══════════════════════════════════════════════════════════
const encounters = require('./encounters');
const store = require('../core/store');
const perms = require('../core/permissions');

if (!perms.P['protocols.intelligence']) {
  perms.P['protocols.intelligence'] = 'admin,attending,specialist,physician,resident,intern,pharmacist,nurse,head_nurse';
}

// ═══ Diagnosis → Order Set mapping ═══
const DX_MAP = {
  'stemi': ['stemi'],
  'سکته قلبی': ['stemi'],
  'nstemi': ['nstemi'],
  'acs': ['stemi','nstemi'],
  'chf': ['chf_exac'],
  'نارسایی قلب': ['chf_exac'],
  'heart failure': ['chf_exac'],
  'af': ['af_rvr'],
  'فیبریلاسیون': ['af_rvr'],
  'atrial fibrillation': ['af_rvr'],
  'htn emergency': ['htn_emergency'],
  'hypertensive emergency': ['htn_emergency'],
  'فشار خون بالا': ['htn_emergency'],
  'sepsis': ['sepsis'],
  'سپسیس': ['sepsis'],
  'septic shock': ['sepsis'],
  'dka': ['dka'],
  'کتواسیدوز': ['dka'],
  'pneumonia': ['pneumonia','hap'],
  'پنومونی': ['pneumonia','hap'],
  'copd': ['copd_exac'],
  'تشدید copd': ['copd_exac'],
  'asthma': ['asthma_exac'],
  'آسم': ['asthma_exac'],
  'cva': ['stroke'],
  'stroke': ['stroke'],
  'سکته مغزی': ['stroke'],
  'ischemic stroke': ['stroke'],
  'ich': ['ich'],
  'خونریزی مغزی': ['ich'],
  'intracerebral hemorrhage': ['ich'],
  'sah': ['sah'],
  'subarachnoid': ['sah'],
  'aki': ['aki'],
  'acute kidney injury': ['aki'],
  'نارسایی کلیه': ['aki'],
  'gi bleed': ['gi_bleed'],
  'خونریزی گوارشی': ['gi_bleed'],
  'upper gi': ['gi_bleed'],
  'pancreatitis': ['pancreatitis'],
  'پانکراتیت': ['pancreatitis'],
  'pe': ['pe'],
  'pulmonary embolism': ['pe'],
  'آمبولی ریه': ['pe'],
  'dvt': ['dvt'],
  'uti': ['uti'],
  'عفونت ادراری': ['uti'],
  'pyelonephritis': ['uti'],
  'cellulitis': ['cellulitis'],
  'سلولیت': ['cellulitis'],
  'meningitis': ['meningitis'],
  'مننژیت': ['meningitis'],
  'neutropenia': ['febrile_neutropenia'],
  'نوتروپنی': ['febrile_neutropenia'],
  'sickle': ['sickle_crisis'],
  'داسی': ['sickle_crisis'],
  'thyroid storm': ['thyroid_storm'],
  'طوفان تیروئید': ['thyroid_storm'],
  'adrenal crisis': ['adrenal_crisis'],
  'hypercalcemia': ['hypercalcemia'],
  'hyperkalemia': ['hyperkalemia'],
  'delirium': ['delirium'],
  'دلیریوم': ['delirium'],
  'acute liver failure': ['acute_liver_failure'],
  'نارسایی کبد': ['acute_liver_failure'],
  'hemoptysis': ['hemoptysis'],
  'خونریزی تنفسی': ['hemoptysis'],
  'massive transfusion': ['mtp'],
  'تروما': ['mtp'],
  'trauma': ['mtp'],
  'hemorrhage': ['mtp']
};

// ═══ Vitals rules ═══
function suggestFromVitals(v) {
  const out = new Set();
  if (!v) return out;
  const news2 = Number(v.news2) || 0;
  const spo2 = Number(v.spo2);
  const sbp = Number(v.bp_sys);
  const hr = Number(v.hr);
  const temp = Number(v.temp);
  const gcs = Number(v.gcs);

  if (news2 >= 7) { out.add('sepsis'); out.add('ich'); out.add('stroke'); }
  if (news2 >= 5) { out.add('sepsis'); }
  if (spo2 > 0 && spo2 < 88) { out.add('pe'); out.add('vap'); out.add('hap'); out.add('pneumonia'); }
  if (sbp > 0 && sbp < 90) { out.add('sepsis'); out.add('mtp'); out.add('adrenal_crisis'); }
  if (hr > 130) { out.add('af_rvr'); out.add('thyroid_storm'); }
  if (temp > 39) { out.add('sepsis'); out.add('meningitis'); }
  if (gcs > 0 && gcs < 13) { out.add('ich'); out.add('stroke'); out.add('meningitis'); }

  return out;
}

// ═══ Already-applied detection ═══
function detectApplied(patientId) {
  const orders = store.readAll('orders').filter(o =>
    o.patientId === patientId &&
    ['pending', 'verified', 'active'].includes(o.status) &&
    o.sourceOrderSet
  );
  const bySet = {};
  for (const o of orders) {
    bySet[o.sourceOrderSet] = (bySet[o.sourceOrderSet] || 0) + 1;
  }
  return bySet;
}

// ═══ Pathway association ═══
const SET_TO_PATHWAY = {
  'stemi': 'stemi_pathway',
  'stroke': 'stroke_pathway',
  'sepsis': 'sepsis_pathway',
  'aki': 'aki_pathway',
  'ich': 'ich_pathway',
  'hyperkalemia': 'hyperkalemia_pathway',
  'febrile_neutropenia': 'febrile_neutropenia_pathway',
  'mtp': 'mtp_pathway'
};

// ═══════════════════════════════════════════════════════════
//  Recommendation engine
// ═══════════════════════════════════════════════════════════
function recommend(ctx, patientId) {
  const patient = store.get('patients', patientId);
  if (!patient) throw ctx.E.notFound('patient_not_found');

  const allSets = Object.values(encounters._orderSets || {});
  const lastVital = store.readAll('vitals')
    .filter(v => v.patientId === patientId)
    .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))[0];

  const dx = String(patient.diagnosis || '').toLowerCase();
  const comorb = (patient.comorbidities || []).map(c => String(c).toLowerCase());
  const allergies = (patient.allergies || []).map(a => String(a).toLowerCase());
  const applied = detectApplied(patientId);
  const vitalsSets = suggestFromVitals(lastVital);

  // Diagnosis matching sets
  const dxSets = new Set();
  for (const [key, setIds] of Object.entries(DX_MAP)) {
    if (dx.includes(key)) setIds.forEach(s => dxSets.add(s));
  }
  for (const c of comorb) {
    for (const [key, setIds] of Object.entries(DX_MAP)) {
      if (c.includes(key)) setIds.forEach(s => dxSets.add(s));
    }
  }

  // Score each set
  const ranked = [];
  for (const s of allSets) {
    let score = 0;
    const reasons = [];
    const flags = [];

    // Diagnosis match
    if (dxSets.has(s.id)) {
      score += 50;
      reasons.push('تشخیص بیمار');
    }

    // Vitals match
    if (vitalsSets.has(s.id)) {
      score += 25;
      reasons.push('نشانه‌های حیاتی');
    }

    // Already applied — strong downrank
    if (applied[s.id]) {
      score -= 40;
      flags.push({ type: 'duplicate', message: 'قبلاً اعمال شده (' + applied[s.id] + ' دستور فعال)' });
    }

    // Allergy conflict — critical downrank + warn
    for (const med of (s.meds || [])) {
      const drug = String(med.drug || '').toLowerCase();
      for (const a of allergies) {
        if (a && drug.includes(a)) {
          score -= 100;
          flags.push({ type: 'allergy', severity: 'critical', message: 'تداخل با ' + a });
        }
      }
    }

    // Age
    if (s.applicability && s.applicability.minAge && patient.age < s.applicability.minAge) {
      score -= 30;
      flags.push({ type: 'age', message: 'سن بیمار کمتر از ' + s.applicability.minAge });
    }

    // Time-critical boost
    if (s.timeCritical && score > 0) {
      score += 10;
      flags.push({ type: 'time_critical', minutes: s.timeCriticalMinutes });
    }

    if (score > 0) {
      ranked.push({
        id: s.id,
        name: s.name,
        icon: s.icon,
        category: s.category,
        source: s.source || null,
        timeCritical: !!s.timeCritical,
        timeCriticalMinutes: s.timeCriticalMinutes || null,
        score: Math.round(score),
        reasons,
        flags,
        alreadyApplied: applied[s.id] || 0,
        pathwayLink: SET_TO_PATHWAY[s.id] || null
      });
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  const top = ranked.slice(0, 5);

  return {
    patient: {
      id: patient.id,
      name: patient.firstName + ' ' + patient.lastName,
      age: patient.age,
      diagnosis: patient.diagnosis,
      allergies: patient.allergies || []
    },
    lastVital: lastVital ? {
      news2: lastVital.news2,
      spo2: lastVital.spo2,
      bp_sys: lastVital.bp_sys,
      hr: lastVital.hr,
      temp: lastVital.temp,
      gcs: lastVital.gcs,
      recordedAt: lastVital.recordedAt
    } : null,
    recommendations: top,
    totalRanked: ranked.length,
    totalCatalog: allSets.length,
    generatedAt: new Date().toISOString()
  };
}

// ═══════════════════════════════════════════════════════════
//  Pre-apply safety check (deep)
// ═══════════════════════════════════════════════════════════
function preApplyCheck(ctx, setId, patientId) {
  const set = encounters._orderSets[setId];
  if (!set) throw ctx.E.notFound('set_not_found');
  const patient = store.get('patients', patientId);
  if (!patient) throw ctx.E.notFound('patient_not_found');

  const conflicts = [];
  const warnings = [];
  const duplicates = [];

  const allergies = (patient.allergies || []).map(a => String(a).toLowerCase().trim()).filter(Boolean);

  // ── Allergy scan ──
  for (const med of (set.meds || [])) {
    const drug = String(med.drug || '').toLowerCase();
    for (let i = 0; i < allergies.length; i++) {
      if (allergies[i] && drug.includes(allergies[i])) {
        conflicts.push({
          type: 'allergy',
          severity: 'critical',
          drug: med.drug,
          allergy: patient.allergies[i],
          message: 'دارو «' + med.drug + '» با آلرژی «' + patient.allergies[i] + '» تداخل دارد'
        });
      }
    }
  }

  // ── Duplicate orders ──
  const existing = store.readAll('orders').filter(o =>
    o.patientId === patientId &&
    ['pending','verified','active'].includes(o.status)
  );
  for (const med of (set.meds || [])) {
    const drug = String(med.drug || '').toLowerCase().trim();
    if (!drug) continue;
    const dup = existing.find(o =>
      o.type === 'medication' &&
      o.details &&
      String(o.details.drug || '').toLowerCase().includes(drug)
    );
    if (dup) {
      duplicates.push({
        drug: med.drug,
        existing: dup.details.drug,
        existingStatus: dup.status,
        existingAt: dup.orderedAt,
        message: '«' + med.drug + '» هم‌اکنون در دستورات فعال است'
      });
    }
  }

  // ── Age warnings ──
  if (patient.age) {
    for (const med of (set.meds || [])) {
      const drug = String(med.drug || '').toLowerCase();
      if (/ibuprofen|naproxen|diclofenac|ketorolac|indomethacin/i.test(drug) && patient.age >= 75) {
        warnings.push({
          type: 'age',
          severity: 'warning',
          message: 'NSAID در بیمار ≥۷۵ سال — خطر خونریزی GI و AKI'
        });
      }
    }
  }

  // ── Applicability ──
  if (set.applicability && set.applicability.diagnosis && set.applicability.diagnosis.length) {
    const dx = String(patient.diagnosis || '').toLowerCase();
    if (dx) {
      const matches = set.applicability.diagnosis.some(k => dx.includes(k.toLowerCase()));
      if (!matches) {
        warnings.push({
          type: 'applicability',
          severity: 'warning',
          message: 'تشخیص بیمار با اندیکاسیون این بسته هم‌خوان نیست'
        });
      }
    }
  }

  // ── Time-critical info ──
  let timeCritical = null;
  if (set.timeCritical) {
    timeCritical = {
      minutes: set.timeCriticalMinutes,
      message: '⏱ بسته حیاتی — باید ظرف ' + set.timeCriticalMinutes + ' دقیقه اعمال شود'
    };
  }

  return {
    set: {
      id: setId,
      name: set.name,
      icon: set.icon,
      category: set.category,
      source: set.source || null,
      totalMeds: (set.meds || []).length,
      totalLabs: (set.labs || []).length,
      totalImaging: (set.imaging || []).length,
      timeCritical
    },
    patient: {
      id: patient.id,
      name: patient.firstName + ' ' + patient.lastName,
      age: patient.age,
      diagnosis: patient.diagnosis,
      allergies: patient.allergies || []
    },
    conflicts,
    warnings,
    duplicates,
    safeToApply: conflicts.filter(c => c.severity === 'critical').length === 0,
    pathwayLink: SET_TO_PATHWAY[setId] || null,
    generatedAt: new Date().toISOString()
  };
}

// ═══════════════════════════════════════════════════════════
//  Handlers
// ═══════════════════════════════════════════════════════════
function recommendHandler(ctx) {
  return recommend(ctx, ctx.params.patientId);
}

function preApplyCheckHandler(ctx) {
  return preApplyCheck(ctx, ctx.params.setId, ctx.params.patientId);
}

module.exports = {
  handlers: { recommendHandler, preApplyCheckHandler },
  routes: [
    { method:'GET', path:'/api/intel/order-sets/:patientId', handler:'recommendHandler', perm:'protocols.intelligence' },
    { method:'GET', path:'/api/intel/order-sets/:setId/:patientId', handler:'preApplyCheckHandler', perm:'protocols.intelligence' }
  ],
  panels: []
};

console.log('[order-set-intelligence] loaded — recommendation + safety check');
