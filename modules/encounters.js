'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Clinical Encounters (Phase A)
//  راند پزشک + SOAP + پروسیجر + Order Sets + Pathways
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const signature = require('../core/signature');
const bus = require('../core/events');

function sign(ctx, coll, rec, action) {
  const s = signature.signAction({
    userId: ctx.actor.id, userName: ctx.actor.username,
    role: ctx.actor.role, action, collection: coll,
    recordId: rec.id, data: rec
  });
  ctx.store.put('signatures', s);
  rec.lastSignatureId = s.id;
  return s;
}

// ═══════════════════════════════════════════════════════════
//  ORDER SETS — بسته‌های درمانی استاندارد
// ═══════════════════════════════════════════════════════════
const ORDER_SETS = {
  stemi: {
    id:'stemi', name:'STEMI — کد ۲۴۷', icon:'💔', category:'cardiac',
    description:'بسته سکته قلبی حاد — door-to-balloon',
    meds: [
      { drug:'Aspirin', dose:'325mg', route:'PO', frequency:'OD', durationDays:7, priority:'stat' },
      { drug:'Clopidogrel', dose:'600mg', route:'PO', frequency:'OD', durationDays:7, priority:'stat' },
      { drug:'Atorvastatin', dose:'80mg', route:'PO', frequency:'HS', durationDays:30, priority:'urgent' },
      { drug:'Metoprolol', dose:'25mg', route:'PO', frequency:'BID', durationDays:7, priority:'urgent' }
    ],
    labs: ['Troponin','CBC','BMP','Coagulation','Lipid Profile'],
    imaging: [{ modality:'CXR', bodyPart:'Chest' }, { modality:'Echo', bodyPart:'Heart' }],
    consults: [{ service:'قلب و عروق', type:'emergency', question:'ارزیابی PCI فوری' }],
    nursing: ['پایش مداوم قلبی', 'O2 ۲-۴ لیتر', 'NPO تا PCI', 'دسترسی IV × ۲'],
    diet: 'NPO', activity: 'استراحت مطلق',
    notes: 'شروع سریع آنتی‌پلاکت دوگانه + انتقال کت لب'
  },
  stroke: {
    id:'stroke', name:'CVA ایسکمیک — کد ۷۲۴', icon:'🧠', category:'neuro',
    description:'بسته سکته مغزی حاد — golden hour',
    meds: [
      { drug:'Alteplase (tPA)', dose:'0.9 mg/kg', route:'IV', frequency:'once', durationDays:1, priority:'stat' },
      { drug:'Atorvastatin', dose:'80mg', route:'PO', frequency:'HS', durationDays:30, priority:'urgent' }
    ],
    labs: ['CBC','BMP','Coagulation','Glucose','HbA1c'],
    imaging: [{ modality:'CT', bodyPart:'Brain' }, { modality:'CTA', bodyPart:'Neck' }],
    consults: [{ service:'نورولوژی', type:'emergency', question:'ارزیابی tPA' }],
    nursing: ['NIHSS اولیه', 'NPO', 'پایش نورولوژیک ساعتی', 'کنترل فشار خون'],
    diet:'NPO', activity:'استراحت مطلق',
    notes:'CT ظرف ۲۵ دقیقه، تصمیم tPA ظرف ۶۰ دقیقه'
  },
  sepsis: {
    id:'sepsis', name:'سپسیس', icon:'🦠', category:'critical',
    description:'بسته ۳ ساعته Surviving Sepsis',
    meds: [
      { drug:'Meropenem', dose:'1g', route:'IV', frequency:'Q8H', durationDays:10, priority:'stat' },
      { drug:'NS 0.9%', dose:'30 ml/kg', route:'IV', frequency:'once', durationDays:1, priority:'stat' }
    ],
    labs: ['Lactate','Blood Culture ×۲','CBC','BMP','Coagulation','UA','CXR'],
    imaging: [{ modality:'CXR', bodyPart:'Chest' }],
    consults: [{ service:'عفونی', type:'urgent', question:'تأیید رژیم' }],
    nursing: ['پایش هر ۳۰ دقیقه', 'ثبت I/O ساعتی', 'پایش MAP ≥ ۶۵'],
    diet:'NPO اگر unstable', activity:'استراحت',
    notes:'کشت قبل از آنتی‌بیوتیک، حجم ۳۰ml/kg، وازوپرسور اگر MAP<65'
  },
  dka: {
    id:'dka', name:'DKA — کتواسیدوز', icon:'💧', category:'endocrine',
    description:'بسته دیابت کتواسیدوز',
    meds: [
      { drug:'Insulin Regular', dose:'0.1 U/kg/hr', route:'IV Infusion', frequency:'cont', durationDays:2, priority:'stat', isHighAlert:true },
      { drug:'NS 0.9%', dose:'1L', route:'IV', frequency:'Q1H×2', durationDays:1, priority:'stat' }
    ],
    labs: ['Glucose','ABG','BMP','Ketones','CBC','HbA1c'],
    imaging: [],
    consults: [{ service:'غدد', type:'urgent', question:'تأیید پروتکل' }],
    nursing: ['ABG هر ۲ ساعت', 'Glucose ساعتی', 'K+ هر ۴ ساعت', 'پایش نورولوژیک'],
    diet:'NPO تا بهبود', activity:'استراحت',
    notes:'پتاسیم اول > ۳٫۳ → K اول، انسولین بعد'
  },
  pneumonia: {
    id:'pneumonia', name:'پنومونی CAP', icon:'🫁', category:'infection',
    description:'بسته پنومونی اکتسابی جامعه',
    meds: [
      { drug:'Ceftriaxone', dose:'1g', route:'IV', frequency:'Q24H', durationDays:7, priority:'urgent' },
      { drug:'Azithromycin', dose:'500mg', route:'IV', frequency:'Q24H', durationDays:5, priority:'urgent' }
    ],
    labs: ['CBC','BMP','CXR','Sputum Culture','Blood Culture'],
    imaging: [{ modality:'CXR', bodyPart:'Chest' }],
    consults: [{ service:'ریه', type:'routine', question:'ارزیابی' }],
    nursing: ['اکسیژن ۲-۴ لیتر', 'پایش SpO2'],
    diet:'رژیم معمولی', activity:'نیمه‌نشسته',
    notes:'CURB-65 جهت تعیین محل بستری'
  }
};

// ═══════════════════════════════════════════════════════════
//  CLINICAL PATHWAYS — مسیرهای بالینی
// ═══════════════════════════════════════════════════════════
const PATHWAYS = {
  stemi_pathway: {
    id:'stemi_pathway', name:'مسیر STEMI', icon:'💔', totalMinutes:1440,
    milestones: [
      { offset:0,   label:'ECG ۱۲ لید', critical:true },
      { offset:10,  label:'آسپرین داده شد', critical:true },
      { offset:15,  label:'کشت خون (اگر STEMI+سپسیس)', critical:false },
      { offset:30,  label:'کات‌لب فعال شد', critical:true },
      { offset:90,  label:'Door-to-Balloon', critical:true },
      { offset:360, label:'Post-PCI: تروپونین سریال', critical:false },
      { offset:1440,label:'ارزیابی ۲۴h — شروع Statin', critical:false }
    ]
  },
  stroke_pathway: {
    id:'stroke_pathway', name:'مسیر Stroke', icon:'🧠', totalMinutes:1440,
    milestones: [
      { offset:0,   label:'NIHSS اولیه', critical:true },
      { offset:10,  label:'قند خون', critical:true },
      { offset:25,  label:'CT Brain (بدون کنتراست)', critical:true },
      { offset:45,  label:'تصمیم tPA', critical:true },
      { offset:60,  label:'تزریق tPA (اگر کاندید)', critical:true },
      { offset:180, label:'بستری ICU/Stroke Unit', critical:true },
      { offset:1440,label:'ارزیابی ۲۴h + شروع Aspirin', critical:false }
    ]
  },
  sepsis_pathway: {
    id:'sepsis_pathway', name:'مسیر سپسیس', icon:'🦠', totalMinutes:360,
    milestones: [
      { offset:0,   label:'تشخیص qSOFA ≥ ۲', critical:true },
      { offset:15,  label:'لاکتات', critical:true },
      { offset:30,  label:'کشت خون ×۲', critical:true },
      { offset:60,  label:'آنتی‌بیوتیک وسیع‌الطیف', critical:true },
      { offset:180, label:'مایع ۳۰ ml/kg', critical:true },
      { offset:360, label:'Reassessment', critical:false }
    ]
  }
};

// ═══════════════════════════════════════════════════════════
//  SOAP DATA — برای پر کردن راند
// ═══════════════════════════════════════════════════════════
function soapData(ctx) {
  const pid = ctx.params.patientId;
  const p = ctx.store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');

  // ویتال اخیر و ۲۴ ساعته
  const vitals = h(ctx, 'vitals').filter(v => v.patientId === pid)
    .sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
  const lastVital = vitals[0] || null;
  const vitals24h = vitals.filter(v => sd(v.recordedAt) > Date.now() - 86400000).slice(0, 20);

  // آزمایشات اخیر
  const labs = h(ctx, 'labs').filter(l => l.patientId === pid)
    .sort((a, b) => sd(b.orderedAt) - sd(a.orderedAt)).slice(0, 5);

  // دستورات فعال
  const orders = h(ctx, 'orders').filter(o => o.patientId === pid &&
    ['pending','verified','active'].includes(o.status));

  // MAR فعال
  const mar = h(ctx, 'mar').filter(m => m.patientId === pid &&
    ['scheduled','due'].includes(m.status));

  // مشاوره‌های فعال
  const consults = h(ctx, 'consults').filter(c => c.patientId === pid &&
    ['requested','responded'].includes(c.status));

  // راندهای قبلی
  const rounds = h(ctx, 'encounters').filter(e => e.patientId === pid && e.type === 'round')
    .sort((a, b) => sd(b.createdAt) - sd(a.createdAt)).slice(0, 5);

  // مسیرهای بالینی فعال
  const pathways = h(ctx, 'pathway_instances').filter(pi => pi.patientId === pid &&
    pi.status === 'active');

  // نیازسنجی ML — risk
  let riskScore = 0;
  try {
    const neural = require('../core/neural');

// ── NABZ v3.1: unified order creation — emits kardex.order.created ──
// Fix: order-set application bypassed CDSS/allergy pipeline.
function putOrder(ctx, rec) {
  return require('../core/domain/order-writer').create(ctx, rec);
}
    const r = neural.patientRisk(p, { lastVital });
    riskScore = r.score;
  } catch (_) {}

  return {
    patient: {
      id: p.id, mrn: p.mrn, name: p.firstName + ' ' + p.lastName,
      age: p.age, sex: p.sex, ward: p.wardCode, bed: p.bedNumber,
      diagnosis: p.diagnosis, comorbidities: p.comorbidities,
      allergies: p.allergies, codeStatus: p.codeStatus,
      admittedAt: p.admittedAt
    },
    lastVital,
    vitals24h,
    labs,
    activeOrders: orders,
    marDue: mar,
    activeConsults: consults,
    previousRounds: rounds,
    activePathways: pathways,
    mlRiskScore: riskScore,
    orderSets: Object.values(ORDER_SETS),
    pathwayTemplates: Object.values(PATHWAYS),
    generatedAt: ctx.now()
  };
}

// ═══════════════════════════════════════════════════════════
//  ROUNDS — SOAP notes
// ═══════════════════════════════════════════════════════════
function createRound(ctx) {
  const b = ctx.body;
  if (!b.patientId) throw ctx.E.badRequest('patient_required');
  const p = ctx.store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');

  const rec = {
    id: ctx.uid('enc'),
    type: 'round',
    patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode, bedNumber: p.bedNumber,
    date: b.date || ctx.now().slice(0, 10),
    subtype: b.subtype || 'morning',
    authorId: ctx.actor.id,
    authorName: ctx.actor.fullName || ctx.actor.username,
    authorRole: ctx.actor.role,
    subjective: b.subjective || { chiefComplaint:'', history:'', reviewOfSystems:'' },
    objective: b.objective || { physicalExam:'', additionalNotes:'' },
    assessment: b.assessment || { diagnoses: [], severity:'', differential: [] },
    plan: b.plan || { medications: [], labs: [], imaging: [], consults: [], nursing: [], diet:'', activity:'', education:'' },
    status: 'draft',
    cosignRequired: ['resident','intern'].includes(ctx.actor.role),
    createdAt: ctx.now(), updatedAt: ctx.now()
  };
  ctx.store.put('encounters', rec);
  bus.emit('encounter.round.created', { record: rec, actor: ctx.actor });
  return rec;
}

function updateRound(ctx) {
  const r = ctx.store.get('encounters', ctx.params.id);
  if (!r) throw ctx.E.notFound('round_not_found');
  if (r.status !== 'draft') throw ctx.E.conflict('not_draft');
  if (r.authorId !== ctx.actor.id && ctx.actor.role !== 'admin')
    throw ctx.E.forbidden('not_author');
  const b = ctx.body;
  if (b.subtype) r.subtype = b.subtype;
  if (b.subjective) r.subjective = Object.assign(r.subjective, b.subjective);
  if (b.objective) r.objective = Object.assign(r.objective, b.objective);
  if (b.assessment) r.assessment = Object.assign(r.assessment, b.assessment);
  if (b.plan) r.plan = Object.assign(r.plan, b.plan);
  r.updatedAt = ctx.now();
  ctx.store.put('encounters', r);
  return r;
}

function signRound(ctx) {
  const r = ctx.store.get('encounters', ctx.params.id);
  if (!r) throw ctx.E.notFound('round_not_found');
  if (r.status !== 'draft') throw ctx.E.conflict('not_draft');
  if (r.authorId !== ctx.actor.id && ctx.actor.role !== 'admin')
    throw ctx.E.forbidden('not_author');
  if (!r.subjective.chiefComplaint && !r.assessment.clinicalImpression) {
    throw ctx.E.badRequest('at_least_chief_complaint_or_assessment');
  }
  // اگر نویسنده attending/specialist → امضای نهایی
  // اگر resident/intern → نیاز به cosign
  const needsCosign = ['resident','intern'].includes(ctx.actor.role);
  r.signedAt = ctx.now();
  r.signedBy = ctx.actor.id;
  r.signedByName = ctx.actor.fullName || ctx.actor.username;
  r.status = needsCosign ? 'pending_cosign' : 'signed';
  if (!needsCosign) r.cosignRequired = false;
  sign(ctx, 'encounters', r, 'sign');
  ctx.store.put('encounters', r);
  bus.emit('encounter.round.signed', { record: r, needsCosign, actor: ctx.actor });
  // اگر pending → notify attending
  if (needsCosign) {
    // notify attendings of same ward
    const attendings = h(ctx, 'wf_staff').filter(s =>
      s.role === 'attending' && s.ward === r.wardCode && s.active);
    for (const a of attendings) {
      ctx.store.put('sa_notifications', {
        id: ctx.uid('san'), userId: 'sa_' + a.id,
        title: '📝 نیاز به تأیید راند',
        body: r.patientName + ' — ' + r.signedByName,
        type: 'info', read: false, createdAt: ctx.now()
      });
    }
  }
  return r;
}

function cosignRound(ctx) {
  const r = ctx.store.get('encounters', ctx.params.id);
  if (!r) throw ctx.E.notFound('round_not_found');
  if (r.status !== 'pending_cosign') throw ctx.E.conflict('not_pending_cosign');
  if (!['attending','specialist','admin'].includes(ctx.actor.role))
    throw ctx.E.forbidden('attending_only');
  if (r.signedBy === ctx.actor.id) throw ctx.E.conflict('cannot_cosign_own');
  r.cosignedBy = ctx.actor.id;
  r.cosignedByName = ctx.actor.fullName || ctx.actor.username;
  r.cosignedAt = ctx.now();
  r.status = 'signed';
  sign(ctx, 'encounters', r, 'cosign');
  ctx.store.put('encounters', r);
  bus.emit('encounter.round.cosigned', { record: r, actor: ctx.actor });
  return r;
}

function listRounds(ctx) {
  let items = h(ctx, 'encounters').filter(e => e.type === 'round');
  if (ctx.query.patientId) items = items.filter(e => e.patientId === ctx.query.patientId);
  if (ctx.query.wardCode) items = items.filter(e => e.wardCode === ctx.query.wardCode);
  if (ctx.query.status) items = items.filter(e => e.status === ctx.query.status);
  if (ctx.query.authorId) items = items.filter(e => e.authorId === ctx.query.authorId);
  if (ctx.query.pendingCosign) {
    items = items.filter(e => e.status === 'pending_cosign' && e.wardCode === ctx.actor.ward);
  }
  items.sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  return { items: items.slice(0, 100), total: items.length };
}

function getRound(ctx) {
  const r = ctx.store.get('encounters', ctx.params.id);
  if (!r) throw ctx.E.notFound('round_not_found');
  return r;
}

// ═══════════════════════════════════════════════════════════
//  ORDER SETS — اعمال بسته
// ═══════════════════════════════════════════════════════════
function listOrderSets(ctx) {
  return { items: Object.values(ORDER_SETS), total: Object.keys(ORDER_SETS).length };
}
function getOrderSet(ctx) {
  const s = ORDER_SETS[ctx.params.id];
  if (!s) throw ctx.E.notFound('order_set_not_found');
  return s;
}
function applyOrderSet(ctx) {
  const b = ctx.body;
  const setId = ctx.params.id;
  const set = ORDER_SETS[setId];
  if (!set) throw ctx.E.notFound('order_set_not_found');
  const pid = b.patientId;
  if (!pid) throw ctx.E.badRequest('patient_required');
  const p = ctx.store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');

  const created = { orders: 0, labs: 0, imaging: 0, consults: 0, nursing: 0 };

  // meds → orders (pending)
  for (const m of (set.meds || [])) {
    putOrder(ctx, {
      id: ctx.uid('ord'), patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
      wardCode: p.wardCode, type: 'medication',
      priority: m.priority || 'routine', details: m,
      status: 'pending', orderedBy: ctx.actor.id, orderedAt: ctx.now(),
      sourceOrderSet: setId
    });
    created.orders++;
  }

  // labs → orders type=lab
  for (const panel of (set.labs || [])) {
    putOrder(ctx, {
      id: ctx.uid('ord'), patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
      wardCode: p.wardCode, type: 'lab',
      priority: 'routine', details: { panel },
      status: 'pending', orderedBy: ctx.actor.id, orderedAt: ctx.now(),
      sourceOrderSet: setId
    });
    created.labs++;
  }

  // imaging → orders type=paraclinical
  for (const im of (set.imaging || [])) {
    putOrder(ctx, {
      id: ctx.uid('ord'), patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
      wardCode: p.wardCode, type: 'paraclinical',
      priority: 'routine', details: { modality: im.modality, bodyPart: im.bodyPart },
      status: 'pending', orderedBy: ctx.actor.id, orderedAt: ctx.now(),
      sourceOrderSet: setId
    });
    created.imaging++;
  }

  // consults → consults
  for (const c of (set.consults || [])) {
    require('../core/domain/consult-writer').create(ctx, {
      id: ctx.uid('cons'), patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
      wardCode: p.wardCode, bedNumber: p.bedNumber,
      consultType: c.type || 'routine', targetService: c.service,
      question: c.question || '', isbar: {}, status: 'requested',
      requestedBy: ctx.actor.id, requestedAt: ctx.now(),
      responseDueAt: new Date(Date.now() + (c.type === 'emergency' ? 30 : 120) * 60000).toISOString(),
      sourceOrderSet: setId
    });
    created.consults++;
  }

  // nursing → orders type=nursing
  for (const n of (set.nursing || [])) {
    putOrder(ctx, {
      id: ctx.uid('ord'), patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
      wardCode: p.wardCode, type: 'nursing',
      priority: 'routine', details: { note: n },
      status: 'pending', orderedBy: ctx.actor.id, orderedAt: ctx.now(),
      sourceOrderSet: setId
    });
    created.nursing++;
  }

  // ثبت در audit
  bus.emit('encounter.orderset.applied', {
    record: { patientId: pid, setId, created }, actor: ctx.actor
  });

  return {
    patient: { id: p.id, name: p.firstName + ' ' + p.lastName },
    orderSet: set.name,
    created,
    total: created.orders + created.labs + created.imaging + created.consults + created.nursing
  };
}

// ═══════════════════════════════════════════════════════════
//  PROCEDURES — پروسیجرهای بالینی
// ═══════════════════════════════════════════════════════════
const PROCEDURE_TYPES = {
  lp:           { label:'LP — پونکسیون کمری', icon:'💉', checklist:['رضایت','پوزیشن','استریل','بی‌حسی موضعی','نمونه CSF'] },
  central_line: { label:'Central Line',         icon:'🩺', checklist:['رضایت','اولتراسوند','استریل کامل','تأیید موقعیت با CXR'] },
  arterial_line:{ label:'Arterial Line',        icon:'💗', checklist:['رضایت','آزمون Allen','استریل','تأیید پالس'] },
  intubation:   { label:'اینتوباسیون',          icon:'🫁', checklist:['پیش‌اکسیژناسیون','داروها آماده','ساکشن','لارنگوسکوپ','تأیید با کاپنوگرافی'] },
  thoracentesis:{ label:'توراسنتز',             icon:'🫁', checklist:['رضایت','US راهنما','استریل','بی‌حسی','CXR بعدی'] },
  paracentesis: { label:'پاراسنتز',             icon:'🩸', checklist:['رضایت','US راهنما','استریل','بی‌حسی'] },
  chest_tube:   { label:'Chest Tube',           icon:'🫁', checklist:['رضایت','استریل','بی‌حسی','تأیید با CXR'] },
  foley:        { label:'فولی',                 icon:'💧', checklist:['اندیکاسیون','استریل','تأیید ادرار'] },
  ngt:          { label:'NGT',                  icon:'🍽️', checklist:['تأیید معده','استریل','تأیید موقعیت'] },
  wound_suture: { label:'بخیه زخم',             icon:'🩹', checklist:['بی‌حسی','شستشو','دبریدمان','پانسمان'] }
};

function listProcedureTypes(ctx) {
  return {
    items: Object.keys(PROCEDURE_TYPES).map(k => Object.assign({ id: k }, PROCEDURE_TYPES[k])),
    total: Object.keys(PROCEDURE_TYPES).length
  };
}

function createProcedure(ctx) {
  const b = ctx.body;
  if (!b.patientId) throw ctx.E.badRequest('patient_required');
  if (!b.type || !PROCEDURE_TYPES[b.type]) throw ctx.E.badRequest('invalid_type');
  const p = ctx.store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');

  const def = PROCEDURE_TYPES[b.type];
  const rec = {
    id: ctx.uid('proc'),
    patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode, bedNumber: p.bedNumber,
    type: b.type, typeLabel: def.label, icon: def.icon,
    indication: b.indication || '',
    consent: {
      obtained: b.consentObtained === true,
      obtainedAt: b.consentObtained ? ctx.now() : null,
      by: b.consentObtained ? ctx.actor.id : null
    },
    checklist: def.checklist.map(item => ({ item, done: false })),
    operator: b.operator || ctx.actor.id,
    operatorName: b.operatorName || (ctx.actor.fullName || ctx.actor.username),
    supervisor: b.supervisor || null,
    plannedAt: b.plannedAt || ctx.now(),
    status: 'planned',
    note: { technique:'', findings:'', complications:'', plan:'' },
    authorId: ctx.actor.id,
    createdAt: ctx.now()
  };
  ctx.store.put('procedures', rec);
  bus.emit('encounter.procedure.created', { record: rec, actor: ctx.actor });
  return rec;
}

function updateProcedure(ctx) {
  const r = ctx.store.get('procedures', ctx.params.id);
  if (!r) throw ctx.E.notFound('procedure_not_found');
  const b = ctx.body;
  if (b.checklist && Array.isArray(b.checklist)) {
    for (const item of b.checklist) {
      const existing = r.checklist.find(c => c.item === item.item);
      if (existing) existing.done = !!item.done;
    }
  }
  if (b.start) {
    r.status = 'in_progress';
    r.startAt = ctx.now();
    r.timeOut = {
      performedAt: ctx.now(), by: ctx.actor.id,
      checklist: r.checklist.map(c => ({ item: c.item, done: c.done }))
    };
  }
  if (b.note) r.note = Object.assign(r.note, b.note);
  ctx.store.put('procedures', r);
  return r;
}

function completeProcedure(ctx) {
  const r = ctx.store.get('procedures', ctx.params.id);
  if (!r) throw ctx.E.notFound('procedure_not_found');
  // FIX: merge note from body FIRST
  if (ctx.body && ctx.body.note) {
    r.note = Object.assign(r.note || {}, ctx.body.note);
  }
  if (!r.consent.obtained) throw ctx.E.conflict('consent_required');
  if (!r.timeOut) throw ctx.E.conflict('timeout_required');
  const allDone = r.checklist.every(c => c.done);
  if (!allDone) throw ctx.E.conflict('checklist_incomplete');
  if (!r.note.findings) throw ctx.E.conflict('findings_required');

  r.status = 'completed';
  r.endAt = ctx.now();
  r.durationMin = r.startAt ? Math.round((sd(r.endAt) - sd(r.startAt)) / 60000) : null;
  r.completedBy = ctx.actor.id;
  r.completedAt = ctx.now();
  sign(ctx, 'procedures', r, 'complete');
  ctx.store.put('procedures', r);
  bus.emit('encounter.procedure.completed', { record: r, actor: ctx.actor });
  return r;
}

function listProcedures(ctx) {
  let items = h(ctx, 'procedures');
  if (ctx.query.patientId) items = items.filter(p => p.patientId === ctx.query.patientId);
  if (ctx.query.wardCode) items = items.filter(p => p.wardCode === ctx.query.wardCode);
  if (ctx.query.status) items = items.filter(p => p.status === ctx.query.status);
  items.sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  return { items, total: items.length };
}

function getProcedure(ctx) {
  const r = ctx.store.get('procedures', ctx.params.id);
  if (!r) throw ctx.E.notFound('procedure_not_found');
  return r;
}

// ═══════════════════════════════════════════════════════════
//  PATHWAYS — شروع مسیر
// ═══════════════════════════════════════════════════════════
function listPathways(ctx) {
  return { items: Object.values(PATHWAYS), total: Object.keys(PATHWAYS).length };
}

function startPathway(ctx) {
  const b = ctx.body;
  const pathId = ctx.params.id;
  const tpl = PATHWAYS[pathId];
  if (!tpl) throw ctx.E.notFound('pathway_not_found');
  const pid = b.patientId;
  if (!pid) throw ctx.E.badRequest('patient_required');
  const p = ctx.store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  // چک نبود duplicate فعال
  const active = h(ctx, 'pathway_instances').filter(x =>
    x.patientId === pid && x.pathwayId === pathId && x.status === 'active');
  if (active.length) throw ctx.E.conflict('pathway_already_active');

  const startAt = ctx.now();
  const startMs = sd(startAt);
  const milestones = tpl.milestones.map(m => ({
    label: m.label, critical: m.critical,
    offset: m.offset,
    dueAt: new Date(startMs + m.offset * 60000).toISOString(),
    done: false, doneAt: null
  }));

  const rec = {
    id: ctx.uid('pw'),
    pathwayId: pathId, pathwayName: tpl.name, icon: tpl.icon,
    patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode,
    startAt, startBy: ctx.actor.id,
    milestones,
    status: 'active',
    createdAt: ctx.now()
  };
  ctx.store.put('pathway_instances', rec);
  bus.emit('encounter.pathway.started', { record: rec, actor: ctx.actor });
  return rec;
}

function advancePathway(ctx) {
  const pi = ctx.store.get('pathway_instances', ctx.params.id);
  if (!pi) throw ctx.E.notFound('pathway_not_found');
  const b = ctx.body;
  if (!b.milestoneLabel) throw ctx.E.badRequest('milestone_required');
  const ms = pi.milestones.find(m => m.label === b.milestoneLabel);
  if (!ms) throw ctx.E.notFound('milestone_not_found');
  if (ms.done) throw ctx.E.conflict('already_done');
  ms.done = true;
  ms.doneAt = ctx.now();
  ms.doneBy = ctx.actor.id;
  if (b.note) ms.note = b.note;
  // چک همه critical
  const allCritical = pi.milestones.filter(m => m.critical).every(m => m.done);
  if (allCritical) pi.criticalCompletedAt = ctx.now();
  ctx.store.put('pathway_instances', pi);
  return pi;
}

function completePathway(ctx) {
  const pi = ctx.store.get('pathway_instances', ctx.params.id);
  if (!pi) throw ctx.E.notFound('pathway_not_found');
  pi.status = 'completed';
  pi.completedAt = ctx.now();
  pi.completedBy = ctx.actor.id;
  ctx.store.put('pathway_instances', pi);
  return pi;
}

function listPathwayInstances(ctx) {
  let items = h(ctx, 'pathway_instances');
  if (ctx.query.patientId) items = items.filter(x => x.patientId === ctx.query.patientId);
  if (ctx.query.status) items = items.filter(x => x.status === ctx.query.status);
  items.sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  return { items, total: items.length };
}

function getPathwayInstance(ctx) {
  const pi = ctx.store.get('pathway_instances', ctx.params.id);
  if (!pi) throw ctx.E.notFound('pathway_not_found');
  return pi;
}

// ═══════════════════════════════════════════════════════════
//  HANDLERS
// ═══════════════════════════════════════════════════════════
module.exports = {
  _orderSets: ORDER_SETS,
  _pathways: PATHWAYS,
  handlers: {
    soapData, createRound, updateRound, signRound, cosignRound,
    listRounds, getRound,
    listOrderSets, getOrderSet, applyOrderSet,
    listProcedureTypes, createProcedure, updateProcedure,
    completeProcedure, listProcedures, getProcedure,
    listPathways, startPathway, advancePathway,
    completePathway, listPathwayInstances, getPathwayInstance
  },
  routes: [

    { method:'POST', path:'/api/enc/round', handler:'createRound', perm:'encounters.create' },
    { method:'GET',  path:'/api/enc/rounds', handler:'listRounds', perm:'encounters.view' },
    { method:'GET',  path:'/api/enc/ordersets', handler:'listOrderSets', perm:'encounters.view' },
    { method:'GET',  path:'/api/enc/proctypes', handler:'listProcedureTypes', perm:'encounters.view' },
    { method:'POST', path:'/api/enc/procedure', handler:'createProcedure', perm:'procedures.create' },
    { method:'GET',  path:'/api/enc/procedures', handler:'listProcedures', perm:'encounters.view' },
    { method:'GET',  path:'/api/enc/pathways', handler:'listPathways', perm:'encounters.view' },
    { method:'GET',  path:'/api/enc/pathway-instances', handler:'listPathwayInstances', perm:'encounters.view' },
    { method:'GET',  path:'/api/enc/soap/:patientId', handler:'soapData', perm:'encounters.view' },
    { method:'PUT',  path:'/api/enc/round/:id', handler:'updateRound', perm:'encounters.create' },
    { method:'POST', path:'/api/enc/round/:id/sign', handler:'signRound', perm:'encounters.sign' },
    { method:'POST', path:'/api/enc/round/:id/cosign', handler:'cosignRound', perm:'encounters.cosign' },
    { method:'GET',  path:'/api/enc/round/:id', handler:'getRound', perm:'encounters.view' },
    { method:'GET',  path:'/api/enc/ordersets/:id', handler:'getOrderSet', perm:'encounters.view' },
    { method:'POST', path:'/api/enc/ordersets/:id/apply', handler:'applyOrderSet', perm:'encounters.create' },
    { method:'PUT',  path:'/api/enc/procedure/:id', handler:'updateProcedure', perm:'procedures.create' },
    { method:'POST', path:'/api/enc/procedure/:id/complete', handler:'completeProcedure', perm:'procedures.sign' },
    { method:'GET',  path:'/api/enc/procedure/:id', handler:'getProcedure', perm:'encounters.view' },
    { method:'POST', path:'/api/enc/pathways/:id/start', handler:'startPathway', perm:'encounters.create' },
    { method:'POST', path:'/api/enc/pathway/:id/advance', handler:'advancePathway', perm:'encounters.create' },
    { method:'POST', path:'/api/enc/pathway/:id/complete', handler:'completePathway', perm:'encounters.create' },
    { method:'GET',  path:'/api/enc/pathway/:id', handler:'getPathwayInstance', perm:'encounters.view' },
  
  ],
  panels: [
    { id:'pending_cosign', title:'راندهای در انتظار تأیید', icon:'✍️', perm:'encounters.cosign',
      kind:'list', api:'/api/enc/rounds?pendingCosign=1', fields:['patientName','authorName','signedAt'] },
    { id:'rounds', title:'راندها', icon:'🩺', perm:'encounters.view',
      kind:'list', api:'/api/enc/rounds', fields:['patientName','authorName','subtype','status'] },
    { id:'procedures', title:'پروسیجرها', icon:'💉', perm:'encounters.view',
      kind:'list', api:'/api/enc/procedures', fields:['patientName','typeLabel','operatorName','status'] },
    { id:'pathways', title:'مسیرهای بالینی فعال', icon:'🛤️', perm:'encounters.view',
      kind:'list', api:'/api/enc/pathway-instances?status=active', fields:['patientName','pathwayName','startAt'] }
  ]
};
