
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Competency Framework
//  JCI standard 5 & 6 (staff qualifications + education)
//  - 48 competencies across roles
//  - Benner's 4 levels (novice → expert)
//  - 6 verification methods
//  - Auto-expiry + re-verification
//  - Gap analysis per staff + ward
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const store = require('../core/store');
const bus = require('../core/events');
const perms = require('../core/permissions');

if (!perms.P['competency.view']) {
  perms.P['competency.view'] = 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,supervisor_education,head_nurse,attending,specialist,resident,intern,physician,nurse,quality_officer';
  perms.P['competency.verify'] = 'admin,nursing_director,supervisor_education,head_nurse,supervisor_clinical,attending,specialist';
  perms.P['competency.self_renew'] = 'admin,nurse,nurse_aide,resident,intern,attending,specialist,physician,pharmacist,lab_tech,radiology_tech';
  perms.P['competency.assign'] = 'admin,nursing_director,supervisor_education,head_nurse';
}

// ═══════════════════════════════════════════════════════════
//  Competency definitions (48) — JCI + clinical-critical
//  Fields: code, fa, en, category, criticality, level_required,
//          verification_methods[], expiry_months (null=once)
// ═══════════════════════════════════════════════════════════
const COMPETENCIES = {
  // ═══ Safety & Resuscitation (8) ═══
  'BLS': { code:'BLS', fa:'حمایت پایه حیات (BLS)', en:'Basic Life Support', category:'resuscitation', criticality:5, level_required:'competent', verification_methods:['test','simulation','annual_renewal'], expiry_months:24, cert_body:'AHA/ERC' },
  'ACLS': { code:'ACLS', fa:'حمایت پیشرفته قلبی (ACLS)', en:'Advanced Cardiac Life Support', category:'resuscitation', criticality:5, level_required:'proficient', verification_methods:['test','simulation','annual_renewal'], expiry_months:24, cert_body:'AHA' },
  'PALS': { code:'PALS', fa:'ACLS کودکان', en:'Pediatric Advanced Life Support', category:'resuscitation', criticality:4, level_required:'proficient', verification_methods:['test','simulation'], expiry_months:24, cert_body:'AHA' },
  'NRP': { code:'NRP', fa:'احیای نوزاد', en:'Neonatal Resuscitation', category:'resuscitation', criticality:5, level_required:'proficient', verification_methods:['test','simulation'], expiry_months:24, cert_body:'AAP' },
  'CODE_BLUE': { code:'CODE_BLUE', fa:'شرکت در کد آبی', en:'Code Blue Participation', category:'resuscitation', criticality:5, level_required:'competent', verification_methods:['simulation','preceptor_signoff'], expiry_months:12 },
  'RAPID_RESPONSE': { code:'RAPID_RESPONSE', fa:'پاسخ سریع (RRT)', en:'Rapid Response Team', category:'resuscitation', criticality:4, level_required:'competent', verification_methods:['simulation','preceptor_signoff'], expiry_months:12 },
  'AIRWAY': { code:'AIRWAY', fa:'مدیریت راه هوایی', en:'Airway Management', category:'resuscitation', criticality:5, level_required:'proficient', verification_methods:['simulation','preceptor_signoff'], expiry_months:12 },
  'DEFIBRILLATION': { code:'DEFIBRILLATION', fa:'دفیبریلاسیون', en:'Defibrillation', category:'resuscitation', criticality:5, level_required:'competent', verification_methods:['simulation'], expiry_months:12 },

  // ═══ Infection Control (6) ═══
  'HAND_HYGIENE': { code:'HAND_HYGIENE', fa:'بهداشت دست (۵ لحظه WHO)', en:'Hand Hygiene', category:'infection', criticality:5, level_required:'competent', verification_methods:['test','audit'], expiry_months:12 },
  'PPE': { code:'PPE', fa:'Donning/Doffing PPE', en:'PPE Use', category:'infection', criticality:5, level_required:'competent', verification_methods:['test','simulation','audit'], expiry_months:12 },
  'ISOLATION': { code:'ISOLATION', fa:'ایزولاسیون بیمار', en:'Patient Isolation', category:'infection', criticality:4, level_required:'competent', verification_methods:['test','audit'], expiry_months:12 },
  'CLABSI_PREV': { code:'CLABSI_PREV', fa:'پیشگیری CLABSI bundle', en:'CLABSI Prevention Bundle', category:'infection', criticality:5, level_required:'competent', verification_methods:['test','audit'], expiry_months:12 },
  'CAUTI_PREV': { code:'CAUTI_PREV', fa:'پیشگیری CAUTI bundle', en:'CAUTI Prevention Bundle', category:'infection', criticality:4, level_required:'competent', verification_methods:['test','audit'], expiry_months:12 },
  'VAP_PREV': { code:'VAP_PREV', fa:'پیشگیری VAP bundle', en:'VAP Prevention Bundle', category:'infection', criticality:4, level_required:'competent', verification_methods:['test','audit'], expiry_months:12 },

  // ═══ Medication Safety (6) ═══
  'FIVE_RIGHTS': { code:'FIVE_RIGHTS', fa:'۵ حق دارو', en:'Five Rights of Medication', category:'medication', criticality:5, level_required:'competent', verification_methods:['test','audit'], expiry_months:12 },
  'HIGH_ALERT_MED': { code:'HIGH_ALERT_MED', fa:'داروهای پرخطر (ISMP)', en:'High-Alert Medications', category:'medication', criticality:5, level_required:'proficient', verification_methods:['test','simulation','audit'], expiry_months:12 },
  'INSULIN': { code:'INSULIN', fa:'مدیریت انسولین + Sliding Scale', en:'Insulin Management', category:'medication', criticality:5, level_required:'proficient', verification_methods:['test','audit'], expiry_months:12 },
  'IV_CALC': { code:'IV_CALC', fa:'محاسبه دوز IV', en:'IV Dose Calculation', category:'medication', criticality:5, level_required:'proficient', verification_methods:['test','simulation'], expiry_months:24 },
  'CHEMO_SAFE': { code:'CHEMO_SAFE', fa:'مدیریت ایمن شیمی‌درمانی', en:'Safe Chemotherapy Handling', category:'medication', criticality:5, level_required:'proficient', verification_methods:['test','simulation','preceptor_signoff'], expiry_months:12 },
  'BLOOD_TRANSFUSION': { code:'BLOOD_TRANSFUSION', fa:'تزریق خون ایمن (۲-نفره)', en:'Safe Blood Transfusion', category:'medication', criticality:5, level_required:'proficient', verification_methods:['test','simulation','audit'], expiry_months:12 },

  // ═══ Clinical Skills (10) ═══
  'VITAL_SIGNS': { code:'VITAL_SIGNS', fa:'ثبت علائم حیاتی + NEWS2', en:'Vital Signs & NEWS2', category:'clinical', criticality:4, level_required:'competent', verification_methods:['test','audit'], expiry_months:12 },
  'SEPSIS_SCREEN': { code:'SEPSIS_SCREEN', fa:'غربالگری سپسیس (qSOFA)', en:'Sepsis Screening', category:'clinical', criticality:5, level_required:'competent', verification_methods:['test','simulation'], expiry_months:12 },
  'PAIN_ASSESSMENT': { code:'PAIN_ASSESSMENT', fa:'ارزیابی درد (NRS)', en:'Pain Assessment', category:'clinical', criticality:3, level_required:'competent', verification_methods:['test','audit'], expiry_months:12 },
  'FALL_RISK': { code:'FALL_RISK', fa:'ارزیابی خطر سقوط (Morse)', en:'Fall Risk Assessment', category:'clinical', criticality:4, level_required:'competent', verification_methods:['test','audit'], expiry_months:12 },
  'BRADEN': { code:'BRADEN', fa:'ارزیابی Braden Scale', en:'Braden Scale', category:'clinical', criticality:4, level_required:'competent', verification_methods:['test','audit'], expiry_months:12 },
  'WOUND_CARE': { code:'WOUND_CARE', fa:'مراقبت زخم + مرحله‌بندی', en:'Wound Care & Staging', category:'clinical', criticality:4, level_required:'proficient', verification_methods:['simulation','preceptor_signoff'], expiry_months:24 },
  'CATHETERIZATION': { code:'CATHETERIZATION', fa:'کاتتریزاسیون ادراری', en:'Urinary Catheterization', category:'clinical', criticality:3, level_required:'competent', verification_methods:['simulation','preceptor_signoff'], expiry_months:24 },
  'IV_CANNULATION': { code:'IV_CANNULATION', fa:'کارگذاری IV', en:'IV Cannulation', category:'clinical', criticality:3, level_required:'competent', verification_methods:['simulation','preceptor_signoff'], expiry_months:24 },
  'NGT_INSERTION': { code:'NGT_INSERTION', fa:'لوله معده (NGT)', en:'NGT Insertion', category:'clinical', criticality:4, level_required:'competent', verification_methods:['simulation','preceptor_signoff'], expiry_months:24 },
  'SPECIMEN_COLLECTION': { code:'SPECIMEN_COLLECTION', fa:'جمع‌آوری نمونه (Blood Culture)', en:'Specimen Collection', category:'clinical', criticality:4, level_required:'competent', verification_methods:['test','preceptor_signoff'], expiry_months:24 },

  // ═══ Assessment & Documentation (5) ═══
  'NANDA_NOC': { code:'NANDA_NOC', fa:'NANDA-I + NOC scoring', en:'NANDA/NOC', category:'documentation', criticality:4, level_required:'proficient', verification_methods:['test','preceptor_signoff'], expiry_months:24 },
  'ISBAR': { code:'ISBAR', fa:'ISBAR تحویل شیفت', en:'ISBAR Handoff', category:'documentation', criticality:5, level_required:'competent', verification_methods:['test','simulation'], expiry_months:12 },
  'DOCUMENTATION': { code:'DOCUMENTATION', fa:'مستندسازی بالینی', en:'Clinical Documentation', category:'documentation', criticality:4, level_required:'competent', verification_methods:['test','audit'], expiry_months:12 },
  'PATIENT_ID': { code:'PATIENT_ID', fa:'شناسایی صحیح بیمار', en:'Patient Identification', category:'documentation', criticality:5, level_required:'competent', verification_methods:['test','audit'], expiry_months:12 },
  'READ_BACK': { code:'READ_BACK', fa:'Read-back دستورات تلفنی', en:'Telephone Order Read-Back', category:'documentation', criticality:5, level_required:'competent', verification_methods:['test','simulation'], expiry_months:12 },

  // ═══ Emergency & Specialty (6) ═══
  'TRIAGE_ESI': { code:'TRIAGE_ESI', fa:'تریاژ ESI', en:'ESI Triage', category:'emergency', criticality:5, level_required:'proficient', verification_methods:['test','simulation'], expiry_months:12 },
  'TRAUMA_PRIMARY': { code:'TRAUMA_PRIMARY', fa:'ارزیابی اولیه تروما (ABCDE)', en:'Trauma Primary Survey', category:'emergency', criticality:5, level_required:'proficient', verification_methods:['simulation','preceptor_signoff'], expiry_months:12 },
  'STROKE_TPA': { code:'STROKE_TPA', fa:'پروتکل tPA در سکته', en:'Stroke tPA Protocol', category:'emergency', criticality:5, level_required:'proficient', verification_methods:['test','simulation'], expiry_months:12 },
  'STEMI_PATHWAY': { code:'STEMI_PATHWAY', fa:'مسیر STEMI', en:'STEMI Pathway', category:'emergency', criticality:5, level_required:'proficient', verification_methods:['test','simulation'], expiry_months:12 },
  'VENTILATOR': { code:'VENTILATOR', fa:'مدیریت ونتيلاتور', en:'Ventilator Management', category:'emergency', criticality:5, level_required:'proficient', verification_methods:['simulation','preceptor_signoff'], expiry_months:12 },
  'CHEST_TUBE': { code:'CHEST_TUBE', fa:'مراقبت Chest Tube', en:'Chest Tube Care', category:'emergency', criticality:4, level_required:'proficient', verification_methods:['simulation','preceptor_signoff'], expiry_months:24 },

  // ═══ Soft Skills & Ethics (5) ═══
  'FAMILY_COMM': { code:'FAMILY_COMM', fa:'ارتباط با خانواده', en:'Family Communication', category:'soft', criticality:3, level_required:'competent', verification_methods:['preceptor_signoff','peer_review'], expiry_months:24 },
  'CONFLICT_RES': { code:'CONFLICT_RES', fa:'حل تعارض', en:'Conflict Resolution', category:'soft', criticality:3, level_required:'competent', verification_methods:['preceptor_signoff','peer_review'], expiry_months:36 },
  'ETHICS': { code:'ETHICS', fa:'تصمیم‌گیری اخلاقی', en:'Ethical Decision Making', category:'soft', criticality:3, level_required:'proficient', verification_methods:['test','peer_review'], expiry_months:36 },
  'DISCLOSURE': { code:'DISCLOSURE', fa:'افشای خطای پزشکی', en:'Error Disclosure', category:'soft', criticality:4, level_required:'proficient', verification_methods:['test','peer_review'], expiry_months:24 },
  'BURNOUT': { code:'BURNOUT', fa:'پیشگیری فرسودگی شغلی', en:'Burnout Prevention', category:'soft', criticality:3, level_required:'novice', verification_methods:['test'], expiry_months:24 },

  // ═══ Preceptorship & Teaching (2) ═══
  'PRECEPTOR': { code:'PRECEPTOR', fa:'مهارت پرسپتور (تدریس بالینی)', en:'Preceptor Skills', category:'teaching', criticality:3, level_required:'proficient', verification_methods:['test','peer_review'], expiry_months:36 },
  'SIM_DEBRIEF': { code:'SIM_DEBRIEF', fa:'Debriefing شبیه‌سازی', en:'Simulation Debriefing', category:'teaching', criticality:3, level_required:'expert', verification_methods:['test','peer_review'], expiry_months:36 }
};

// ═══ Role → required competencies matrix ═══
const ROLE_REQUIREMENTS = {
  nurse: ['BLS','CODE_BLUE','HAND_HYGIENE','PPE','ISOLATION','FIVE_RIGHTS','HIGH_ALERT_MED','VITAL_SIGNS','SEPSIS_SCREEN','PAIN_ASSESSMENT','FALL_RISK','BRADEN','NANDA_NOC','ISBAR','DOCUMENTATION','PATIENT_ID','READ_BACK','IV_CANNULATION','SPECIMEN_COLLECTION','WOUND_CARE'],
  nurse_aide: ['BLS','HAND_HYGIENE','PPE','VITAL_SIGNS','PAIN_ASSESSMENT','FALL_RISK','PATIENT_ID','DOCUMENTATION'],
  head_nurse: ['BLS','ACLS','CODE_BLUE','RAPID_RESPONSE','HAND_HYGIENE','PPE','ISOLATION','CLABSI_PREV','CAUTI_PREV','VAP_PREV','FIVE_RIGHTS','HIGH_ALERT_MED','INSULIN','VITAL_SIGNS','SEPSIS_SCREEN','FALL_RISK','BRADEN','WOUND_CARE','NANDA_NOC','ISBAR','DOCUMENTATION','PATIENT_ID','READ_BACK','TRIAGE_ESI','PRECEPTOR','CONFLICT_RES','FAMILY_COMM'],
  resident: ['BLS','ACLS','CODE_BLUE','RAPID_RESPONSE','AIRWAY','DEFIBRILLATION','HAND_HYGIENE','PPE','ISOLATION','FIVE_RIGHTS','HIGH_ALERT_MED','IV_CALC','BLOOD_TRANSFUSION','VITAL_SIGNS','SEPSIS_SCREEN','PAIN_ASSESSMENT','FALL_RISK','ISBAR','DOCUMENTATION','PATIENT_ID','READ_BACK','TRIAGE_ESI','TRAUMA_PRIMARY','STROKE_TPA','STEMI_PATHWAY','VENTILATOR','CHEST_TUBE','ETHICS','DISCLOSURE'],
  intern: ['BLS','CODE_BLUE','HAND_HYGIENE','PPE','ISOLATION','FIVE_RIGHTS','IV_CALC','VITAL_SIGNS','SEPSIS_SCREEN','PAIN_ASSESSMENT','ISBAR','DOCUMENTATION','PATIENT_ID','READ_BACK','TRAUMA_PRIMARY','ETHICS'],
  attending: ['BLS','ACLS','PALS','CODE_BLUE','RAPID_RESPONSE','AIRWAY','DEFIBRILLATION','HAND_HYGIENE','PPE','FIVE_RIGHTS','HIGH_ALERT_MED','BLOOD_TRANSFUSION','VITAL_SIGNS','SEPSIS_SCREEN','NANDA_NOC','ISBAR','DOCUMENTATION','PATIENT_ID','READ_BACK','TRIAGE_ESI','TRAUMA_PRIMARY','STROKE_TPA','STEMI_PATHWAY','VENTILATOR','CHEST_TUBE','FAMILY_COMM','ETHICS','DISCLOSURE','PRECEPTOR','SIM_DEBRIEF'],
  specialist: ['BLS','ACLS','CODE_BLUE','AIRWAY','DEFIBRILLATION','HAND_HYGIENE','PPE','FIVE_RIGHTS','HIGH_ALERT_MED','VITAL_SIGNS','SEPSIS_SCREEN','ISBAR','DOCUMENTATION','PATIENT_ID','READ_BACK','TRAUMA_PRIMARY','FAMILY_COMM','ETHICS','DISCLOSURE','PRECEPTOR'],
  physician: ['BLS','ACLS','CODE_BLUE','HAND_HYGIENE','PPE','FIVE_RIGHTS','HIGH_ALERT_MED','BLOOD_TRANSFUSION','VITAL_SIGNS','SEPSIS_SCREEN','ISBAR','DOCUMENTATION','PATIENT_ID','READ_BACK','ETHICS'],
  midwife: ['BLS','NRP','PALS','CODE_BLUE','HAND_HYGIENE','PPE','ISOLATION','FIVE_RIGHTS','HIGH_ALERT_MED','BLOOD_TRANSFUSION','VITAL_SIGNS','SEPSIS_SCREEN','PAIN_ASSESSMENT','FALL_RISK','BRADEN','ISBAR','DOCUMENTATION','PATIENT_ID','READ_BACK','FAMILY_COMM','ETHICS'],
  anesthesiologist: ['BLS','ACLS','PALS','CODE_BLUE','AIRWAY','DEFIBRILLATION','HAND_HYGIENE','PPE','FIVE_RIGHTS','HIGH_ALERT_MED','IV_CALC','VITAL_SIGNS','ISBAR','DOCUMENTATION','PATIENT_ID','READ_BACK','VENTILATOR','ETHICS','DISCLOSURE'],
  surgeon: ['BLS','ACLS','CODE_BLUE','AIRWAY','DEFIBRILLATION','HAND_HYGIENE','PPE','FIVE_RIGHTS','HIGH_ALERT_MED','BLOOD_TRANSFUSION','VITAL_SIGNS','ISBAR','DOCUMENTATION','PATIENT_ID','READ_BACK','TRAUMA_PRIMARY','ETHICS','DISCLOSURE'],
  pharmacist: ['BLS','HAND_HYGIENE','PPE','FIVE_RIGHTS','HIGH_ALERT_MED','INSULIN','IV_CALC','CHEMO_SAFE','BLOOD_TRANSFUSION','DOCUMENTATION','PATIENT_ID','READ_BACK','ETHICS'],
  lab_tech: ['BLS','HAND_HYGIENE','PPE','ISOLATION','SPECIMEN_COLLECTION','PATIENT_ID','DOCUMENTATION','READ_BACK'],
  radiology_tech: ['BLS','HAND_HYGIENE','PPE','PATIENT_ID','DOCUMENTATION','READ_BACK'],
  supervisor: ['BLS','ACLS','CODE_BLUE','RAPID_RESPONSE','HAND_HYGIENE','PPE','ISOLATION','FIVE_RIGHTS','HIGH_ALERT_MED','VITAL_SIGNS','SEPSIS_SCREEN','ISBAR','DOCUMENTATION','PATIENT_ID','READ_BACK','TRIAGE_ESI','CONFLICT_RES','FAMILY_COMM','ETHICS','DISCLOSURE','PRECEPTOR'],
  supervisor_clinical: ['BLS','ACLS','CODE_BLUE','RAPID_RESPONSE','HAND_HYGIENE','PPE','ISOLATION','FIVE_RIGHTS','HIGH_ALERT_MED','SEPSIS_SCREEN','ISBAR','DOCUMENTATION','PATIENT_ID','READ_BACK','TRIAGE_ESI','CONFLICT_RES','FAMILY_COMM','ETHICS','PRECEPTOR'],
  supervisor_education: ['BLS','ACLS','HAND_HYGIENE','PPE','FIVE_RIGHTS','HIGH_ALERT_MED','ISBAR','DOCUMENTATION','READ_BACK','ETHICS','PRECEPTOR','SIM_DEBRIEF','CONFLICT_RES'],
  supervisor_senior: ['BLS','ACLS','CODE_BLUE','RAPID_RESPONSE','HAND_HYGIENE','PPE','ISOLATION','FIVE_RIGHTS','HIGH_ALERT_MED','SEPSIS_SCREEN','ISBAR','DOCUMENTATION','PATIENT_ID','READ_BACK','TRIAGE_ESI','CONFLICT_RES','FAMILY_COMM','ETHICS','DISCLOSURE','PRECEPTOR']
};

const LEVEL_ORDER = { novice: 1, competent: 2, proficient: 3, expert: 4 };
const METHOD_FA = {
  test: 'آزمون کتبی',
  simulation: 'شبیه‌سازی',
  preceptor_signoff: 'تأیید پرسپتور',
  annual_renewal: 'تمدید سالانه',
  peer_review: 'بازبینی همتا',
  audit: 'ممیزی مستندات'
};

// ═══════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════
function getUserCompRecords(ctx, userId) {
  return h(ctx, 'staff_competencies').filter(c => c.userId === userId);
}

function getUserComp(ctx, userId, code) {
  return h(ctx, 'staff_competencies').find(c => c.userId === userId && c.code === code);
}

function resolveRole(actor) {
  if (!actor) return null;
  const role = actor.role;
  if (ROLE_REQUIREMENTS[role]) return role;
  // Map aliases
  const map = {
    'clinical_supervisor': 'supervisor_clinical',
    'nursing_director': 'supervisor_senior',
    'medical_director': 'attending',
    'hospital_director': 'attending',
    'admin': 'supervisor_senior'
  };
  return map[role] || 'nurse';
}

function computeStatus(record, def) {
  if (!record) return { status: 'missing', severity: 'critical', daysUntilExpiry: null };
  if (!record.verifiedAt) return { status: 'missing', severity: 'critical', daysUntilExpiry: null };
  if (record.expiresAt) {
    const days = Math.round((sd(record.expiresAt) - Date.now()) / 86400000);
    if (days < 0) return { status: 'expired', severity: 'critical', daysUntilExpiry: days };
    if (days <= 30) return { status: 'expiring_soon', severity: 'warning', daysUntilExpiry: days };
    return { status: 'valid', severity: 'ok', daysUntilExpiry: days };
  }
  return { status: 'valid', severity: 'ok', daysUntilExpiry: null };
}

// ═══════════════════════════════════════════════════════════
//  Handlers
// ═══════════════════════════════════════════════════════════
function listCompetencies() {
  return {
    items: Object.values(COMPETENCIES).map(c => ({
      code: c.code, fa: c.fa, en: c.en, category: c.category,
      criticality: c.criticality, level_required: c.level_required,
      expiry_months: c.expiry_months, cert_body: c.cert_body || null,
      methods: c.verification_methods.map(m => ({ code: m, fa: METHOD_FA[m] || m }))
    })),
    total: Object.keys(COMPETENCIES).length,
    categories: ['resuscitation','infection','medication','clinical','documentation','emergency','soft','teaching'],
    methods: METHOD_FA,
    levels: LEVEL_ORDER
  };
}

function getCompetency(ctx) {
  const c = COMPETENCIES[ctx.params.code];
  if (!c) throw ctx.E.notFound('competency_not_found');
  return {
    competency: c,
    roleRequirements: Object.entries(ROLE_REQUIREMENTS)
      .filter(([r, codes]) => codes.includes(c.code))
      .map(([r]) => r)
  };
}

// ═══ My competencies (staff view) ═══
function myCompetencies(ctx) {
  const userId = ctx.actor.id;
  const role = resolveRole(ctx.actor);
  const requiredCodes = ROLE_REQUIREMENTS[role] || [];
  const records = getUserCompRecords(ctx, userId);

  const items = requiredCodes.map(code => {
    const def = COMPETENCIES[code];
    if (!def) return null;
    const rec = records.find(r => r.code === code);
    const st = computeStatus(rec, def);
    return {
      code,
      fa: def.fa,
      category: def.category,
      criticality: def.criticality,
      level_required: def.level_required,
      cert_body: def.cert_body || null,
      verifiedAt: rec ? rec.verifiedAt : null,
      expiresAt: rec ? rec.expiresAt : null,
      level: rec ? rec.level : null,
      method: rec ? rec.method : null,
      verifiedBy: rec ? rec.verifiedByName : null,
      ...st
    };
  }).filter(Boolean);

  const bySeverity = {
    critical: items.filter(i => i.severity === 'critical').length,
    warning: items.filter(i => i.severity === 'warning').length,
    ok: items.filter(i => i.severity === 'ok').length
  };
  const compliancePct = items.length > 0 ? Math.round((bySeverity.ok / items.length) * 100) : 100;

  // Extra competencies (beyond role requirements)
  const extras = records.filter(r => !requiredCodes.includes(r.code)).map(r => ({
    code: r.code,
    fa: COMPETENCIES[r.code] ? COMPETENCIES[r.code].fa : r.code,
    verifiedAt: r.verifiedAt,
    expiresAt: r.expiresAt,
    level: r.level
  }));

  return {
    role,
    userId,
    userName: ctx.actor.fullName || ctx.actor.username,
    required: items.length,
    compliancePct,
    items,
    extras,
    stats: bySeverity
  };
}

// ═══ Verify a competency ═══
function verify(ctx) {
  const b = ctx.body || {};
  if (!b.userId) throw ctx.E.badRequest('user_id_required');
  if (!b.code) throw ctx.E.badRequest('code_required');
  if (!b.method) throw ctx.E.badRequest('method_required');
  if (!b.level) throw ctx.E.badRequest('level_required');
  const def = COMPETENCIES[b.code];
  if (!def) throw ctx.E.notFound('competency_not_found');
  if (!def.verification_methods.includes(b.method)) {
    throw ctx.E.badRequest('method_not_allowed:' + def.verification_methods.join(','));
  }
  if (!LEVEL_ORDER[b.level]) throw ctx.E.badRequest('invalid_level');
  if (LEVEL_ORDER[b.level] < LEVEL_ORDER[def.level_required]) {
    throw ctx.E.badRequest('level_too_low:' + def.level_required);
  }

  const targetUser = ctx.store.get('users', b.userId);
  if (!targetUser) throw ctx.E.notFound('user_not_found');

  // Cross-ward check
  const isCross = perms.isCrossWard(ctx.actor.role);
  if (!isCross && ctx.actor.role !== 'admin') {
    const myWard = ctx.actor.ward;
    const theirWard = targetUser.ward;
    if (myWard && theirWard && myWard !== theirWard) {
      throw ctx.E.forbidden('cross_ward_not_allowed');
    }
  }

  const existing = getUserComp(ctx, b.userId, b.code);
  const now = Date.now();
  let expiresAt = null;
  if (def.expiry_months) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + def.expiry_months);
    expiresAt = d.toISOString();
  }

  const rec = existing ? Object.assign(existing, {}) : { id: ctx.uid('sc'), userId: b.userId, code: b.code, createdAt: new Date().toISOString() };
  rec.verifiedAt = new Date().toISOString();
  rec.verifiedBy = ctx.actor.id;
  rec.verifiedByName = ctx.actor.fullName || ctx.actor.username;
  rec.method = b.method;
  rec.level = b.level;
  rec.expiresAt = expiresAt;
  rec.notes = b.notes || '';
  rec.score = b.score != null ? Number(b.score) : null;
  rec.evidence = b.evidence || null;

  store.put('staff_competencies', rec);

  ctx.audit.write('competency_framework', 'competency.verify', rec.id, ctx.actor, {
    targetUser: b.userId, code: b.code, method: b.method, level: b.level, expiresAt
  });

  bus.emit('competency.verified', { record: rec, targetUser: b.userId, actor: ctx.actor });
  return rec;
}

// ═══ Self-renew (staff can renew after test) ═══
function selfRenew(ctx) {
  const b = ctx.body || {};
  if (!b.code) throw ctx.E.badRequest('code_required');
  const def = COMPETENCIES[b.code];
  if (!def) throw ctx.E.notFound('competency_not_found');
  // Only allow renewal via 'test' or 'annual_renewal'
  const method = b.method || 'test';
  if (!['test','annual_renewal'].includes(method)) {
    throw ctx.E.forbidden('only_test_or_annual_renewal_allowed');
  }
  // If 'test', require score >= 80
  if (method === 'test' && (b.score == null || Number(b.score) < 80)) {
    throw ctx.E.badRequest('test_score_too_low');
  }

  const now = Date.now();
  let expiresAt = null;
  if (def.expiry_months) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + def.expiry_months);
    expiresAt = d.toISOString();
  }

  const existing = getUserComp(ctx, ctx.actor.id, b.code);
  const rec = existing || { id: ctx.uid('sc'), userId: ctx.actor.id, code: b.code, createdAt: new Date().toISOString() };
  rec.verifiedAt = new Date().toISOString();
  rec.verifiedBy = ctx.actor.id;
  rec.verifiedByName = ctx.actor.fullName || ctx.actor.username;
  rec.method = method;
  rec.level = b.level || (existing && existing.level) || 'competent';
  rec.expiresAt = expiresAt;
  rec.score = b.score != null ? Number(b.score) : null;
  rec.selfRenewed = true;
  store.put('staff_competencies', rec);
  ctx.audit.write('competency_framework', 'competency.self_renew', rec.id, ctx.actor, {
    code: b.code, method, score: rec.score
  });
  bus.emit('competency.self_renewed', { record: rec, actor: ctx.actor });
  return rec;
}

// ═══ Ward gaps (manager view) ═══
function wardGaps(ctx) {
  let ward = ctx.query.ward || ctx.actor.ward;
  // FIX: admin without ward — fallback to any ward with patients
  if (!ward) {
    const anyPatient = store.readAll('patients').find(p => p.wardCode && ['in_care','admitted'].includes(p.status));
    if (anyPatient) {
      ward = anyPatient.wardCode;
      console.log('[comp] wardGaps fallback for admin → ' + ward);
    }
  }
  if (!ward) throw ctx.E.badRequest('ward_required_no_patients');
  const staff = h(ctx, 'users').filter(u => u.active !== false && u.ward === ward);
  if (!staff.length) return { ward, staffCount: 0, items: [], criticalGaps: [] };

  const allComps = h(ctx, 'staff_competencies');
  const gapsByCode = {};
  const staffMissing = [];

  for (const s of staff) {
    const role = resolveRole(s);
    const required = ROLE_REQUIREMENTS[role] || [];
    const myComps = allComps.filter(c => c.userId === s.id);
    let myGaps = 0;
    for (const code of required) {
      const def = COMPETENCIES[code];
      if (!def) continue;
      const rec = myComps.find(c => c.code === code);
      const st = computeStatus(rec, def);
      if (st.status !== 'valid') {
        if (!gapsByCode[code]) gapsByCode[code] = {
          code, fa: def.fa, category: def.category, criticality: def.criticality,
          affected: 0, staffList: []
        };
        gapsByCode[code].affected++;
        gapsByCode[code].staffList.push(s.fullName || s.username);
        myGaps++;
      }
    }
    if (myGaps > 0) {
      staffMissing.push({
        userId: s.id, name: s.fullName || s.username, role,
        gapCount: myGaps,
        requiredCount: required.length
      });
    }
  }

  const items = Object.values(gapsByCode).sort((a, b) => {
    if (b.criticality !== a.criticality) return b.criticality - a.criticality;
    return b.affected - a.affected;
  });

  const criticalGaps = items.filter(g => g.criticality >= 4);

  const compliance = staff.length > 0
    ? Math.round((1 - staffMissing.length / staff.length) * 100)
    : 100;

  return {
    ward,
    staffCount: staff.length,
    staffWithGaps: staffMissing.length,
    compliance,
    items,
    criticalGaps,
    staffMissing: staffMissing.sort((a, b) => b.gapCount - a.gapCount)
  };
}

// ═══ Expiring soon (all wards or specific) ═══
function expiring(ctx) {
  const days = Math.min(90, Number(ctx.query.days) || 30);
  const threshold = Date.now() + days * 86400000;
  const ward = ctx.query.ward || null;
  let users = h(ctx, 'users').filter(u => u.active !== false);
  if (ward) users = users.filter(u => u.ward === ward);
  const userIds = new Set(users.map(u => u.id));
  const comps = h(ctx, 'staff_competencies')
    .filter(c => userIds.has(c.userId) && c.expiresAt && sd(c.expiresAt) < threshold);
  const items = comps.map(c => {
    const u = users.find(x => x.id === c.userId);
    const def = COMPETENCIES[c.code];
    return {
      userId: c.userId,
      userName: u ? (u.fullName || u.username) : '?',
      ward: u ? u.ward : null,
      code: c.code,
      fa: def ? def.fa : c.code,
      criticality: def ? def.criticality : 3,
      expiresAt: c.expiresAt,
      daysUntil: Math.round((sd(c.expiresAt) - Date.now()) / 86400000),
      expired: sd(c.expiresAt) < Date.now()
    };
  }).sort((a, b) => a.daysUntil - b.daysUntil);
  return { items, total: items.length, window: { days } };
}

// ═══ Summary (org-wide) ═══
function summary(ctx) {
  const users = h(ctx, 'users').filter(u => u.active !== false);
  const allComps = h(ctx, 'staff_competencies');
  const totalRequired = users.reduce((s, u) => {
    const role = resolveRole(u);
    return s + (ROLE_REQUIREMENTS[role] || []).length;
  }, 0);

  let totalValid = 0, totalExpiring = 0, totalExpired = 0, totalMissing = 0;
  for (const u of users) {
    const role = resolveRole(u);
    const req = ROLE_REQUIREMENTS[role] || [];
    const myComps = allComps.filter(c => c.userId === u.id);
    for (const code of req) {
      const def = COMPETENCIES[code];
      if (!def) continue;
      const rec = myComps.find(c => c.code === code);
      const st = computeStatus(rec, def);
      if (st.status === 'valid') totalValid++;
      else if (st.status === 'expiring_soon') totalExpiring++;
      else if (st.status === 'expired') totalExpired++;
      else totalMissing++;
    }
  }

  const byCategory = {};
  for (const code of Object.keys(COMPETENCIES)) {
    const def = COMPETENCIES[code];
    if (!byCategory[def.category]) byCategory[def.category] = { required: 0, valid: 0 };
    const usersWithReq = users.filter(u => {
      const role = resolveRole(u);
      return (ROLE_REQUIREMENTS[role] || []).includes(code);
    });
    byCategory[def.category].required += usersWithReq.length;
    byCategory[def.category].valid += allComps.filter(c =>
      c.code === code && usersWithReq.find(u => u.id === c.userId) && computeStatus(c, def).status === 'valid'
    ).length;
  }

  return {
    overall: {
      totalUsers: users.length,
      totalRequired,
      totalValid, totalExpiring, totalExpired, totalMissing,
      compliancePct: totalRequired > 0 ? Math.round((totalValid / totalRequired) * 100) : 100,
      expiryCompliancePct: totalRequired > 0 ? Math.round(((totalValid + totalExpiring) / totalRequired) * 100) : 100
    },
    byCategory: Object.entries(byCategory).map(([cat, v]) => ({
      category: cat, required: v.required, valid: v.valid,
      compliancePct: v.required > 0 ? Math.round((v.valid / v.required) * 100) : 100
    })),
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  handlers: {
    listCompetencies, getCompetency,
    myCompetencies, verify, selfRenew,
    wardGaps, expiring, summary
  },
  routes: [
    { method:'GET',  path:'/api/comp/list', handler:'listCompetencies', perm:'competency.view' },
    { method:'GET',  path:'/api/comp/my', handler:'myCompetencies', perm:'competency.view' },
    { method:'POST', path:'/api/comp/verify', handler:'verify', perm:'competency.verify' },
    { method:'POST', path:'/api/comp/self-renew', handler:'selfRenew', perm:'competency.self_renew' },
    { method:'GET',  path:'/api/comp/ward-gaps', handler:'wardGaps', perm:'competency.view' },
    { method:'GET',  path:'/api/comp/expiring', handler:'expiring', perm:'competency.view' },
    { method:'GET',  path:'/api/comp/summary', handler:'summary', perm:'competency.view' },
    { method:'GET',  path:'/api/comp/:code', handler:'getCompetency', perm:'competency.view' }
  
  ],
  panels: [
    { id:'my', title:'شایستگی‌های من', icon:'🎯', perm:'competency.view', kind:'comp_my', api:'/api/comp/my' },
    { id:'ward', title:'شکاف‌های بخش', icon:'⚠️', perm:'competency.view', kind:'comp_ward', api:'/api/comp/ward-gaps' }
  ]
};
