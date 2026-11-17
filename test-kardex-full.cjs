'use strict';
// test-kardex-full.cjs — COMPREHENSIVE seed for Reza Mohammadi
// Usage: node test-kardex-full.cjs [patientId]
const path = require('path');
process.chdir(path.resolve(__dirname));

const store = require('./core/store');
const bus = require('./core/events');
const ow = require('./core/domain/order-writer');
const vw = require('./core/domain/vitals-writer');
const mw = require('./core/domain/mar-writer');
const cw = require('./core/domain/consult-writer');

const SEED = 'kardex-demo-v2';
const T_ALERT = 'demo_v2_' + Date.now() + '_';
const PID = process.argv[2] || 'pat_001';
const H = 3600000, M = 60000;
const NOW = Date.now();

function iso(ms) { return new Date(ms).toISOString(); }
function hAgo(h) { return iso(NOW - h * H); }
function hFrom(h) { return iso(NOW + h * H); }

// ─── Patient ───
let patient = store.get('patients', PID);
if (!patient) {
  patient = {
    id: PID, firstName: 'رضا', lastName: 'محمدی', age: 62, sex: 'male',
    nationalCode: '0012345678', wardCode: 'ICU_GEN1', bedNumber: 'ICU-5',
    status: 'admitted',
    allergies: ['پنی‌سیلین', 'آسپرین'],
    admissionReason: 'سکته قلبی حاد (STEMI) + شوک کاردیوژنیک',
    attendingPhysician: 'دکتر ناصر نوری',
    weight: 82, bloodType: 'B+',
    riskFactors: ['دیابت نوع ۲', 'فشار خون بالا', 'سیگاری (۳۰ pack-year)', 'هایپرلیپیدمی'],
    codeStatus: 'full_code',
    isolation: null,
    admittedAt: hAgo(18)
  };
  store.put('patients', patient);
  console.log('✅ patient CREATED:', PID);
} else {
  console.log('✅ patient EXISTS:', PID, '-', patient.firstName, patient.lastName);
}

// ─── Cleanup previous demo ───
let cleaned = 0;
['orders','mar','vitals','consults','io_records'].forEach(coll => {
  store.readAll(coll).filter(r => r.patientId === PID && r._seed === SEED).forEach(r => {
    store.remove(coll, r.id); cleaned++;
  });
});
store.readAll('cdss_alerts').filter(r => r.patientId === PID && r.type && String(r.type).startsWith('demo_v2_')).forEach(r => {
  store.remove('cdss_alerts', r.id); cleaned++;
});
console.log('🧹 cleaned', cleaned, 'old demo records\n');

const ctx = {
  store, bus,
  uid: (p) => store.uid(p),
  now: () => new Date().toISOString(),
  actor: { id: 'usr_demo_admin', role: 'admin', username: 'admin', fullName: 'Demo Admin' },
  E: {
    badRequest: (m) => Object.assign(new Error(m), { code: m }),
    notFound: (m) => Object.assign(new Error(m), { code: m }),
    conflict: (m) => Object.assign(new Error(m), { code: m }),
    forbidden: (m) => Object.assign(new Error(m), { code: m })
  }
};

function seed(o) { o._seed = SEED; return o; }
function mkMar(orderId, drug, dose, route, schedAt, status, extra) {
  const m = seed(Object.assign({
    id: store.uid('mar'), orderId, patientId: PID, patientName: 'رضا محمدی',
    wardCode: 'ICU_GEN1', drugName: drug, dose, route,
    scheduledAt: schedAt, status, isHighAlert: false
  }, extra || {}));
  store.put('mar', m);
  return m;
}
function giveMar(m, hoursAgo) {
  const opts = {
    fiveRights: { attested: true, at: hAgo(hoursAgo) },
    administeredAt: hAgo(hoursAgo),
    administeredByName: 'پرستار سمیه رحیمی'
  };
  // High-Alert drugs REQUIRE a witness (per SM: !isHighAlert || witnessedBy)
  if (m && m.isHighAlert) {
    opts.witnessId = 'usr_witness_' + (hoursAgo * 10);
    opts.witnessName = 'پرستار دوم — شاهد';
    opts.rightsMode = 'verified';
  }
  mw.administer(ctx, m.id, opts);
}

// ══════════════════════════════════════════════════════════════
//  1. ORAL MEDICATIONS (5 items)
// ══════════════════════════════════════════════════════════════
console.log('💊 [1/10] ORAL medications...');

const oMetop = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'routine',
  details: { drug: 'Metoprolol', dose: '25mg', route: 'PO', frequency: 'BID', durationDays: 5 }
}));
ow.transition(ctx, oMetop.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oMetop.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ Metoprolol (active)');
const mM1 = mkMar(oMetop.id, 'Metoprolol', '25mg', 'PO', hAgo(10), 'scheduled'); giveMar(mM1, 10);
const mM2 = mkMar(oMetop.id, 'Metoprolol', '25mg', 'PO', hAgo(2), 'due');   // overdue
const mM3 = mkMar(oMetop.id, 'Metoprolol', '25mg', 'PO', hFrom(10), 'scheduled');
const mM4 = mkMar(oMetop.id, 'Metoprolol', '25mg', 'PO', hFrom(22), 'scheduled');

const oAtor = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'routine',
  details: { drug: 'Atorvastatin', dose: '40mg', route: 'PO', frequency: 'OD', durationDays: 30 }
}));
ow.transition(ctx, oAtor.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oAtor.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ Atorvastatin (active)');
const mA1 = mkMar(oAtor.id, 'Atorvastatin', '40mg', 'PO', hAgo(14), 'scheduled'); giveMar(mA1, 14);

const oClop = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'routine',
  details: { drug: 'Clopidogrel', dose: '75mg', route: 'PO', frequency: 'OD', durationDays: 30 }
}));
ow.transition(ctx, oClop.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oClop.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ Clopidogrel (active)');
const mC1 = mkMar(oClop.id, 'Clopidogrel', '75mg', 'PO', hAgo(14), 'scheduled'); giveMar(mC1, 14);

const oOme = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'routine',
  details: { drug: 'Omeprazole', dose: '20mg', route: 'PO', frequency: 'OD', durationDays: 10 }
}));
ow.transition(ctx, oOme.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oOme.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ Omeprazole (active)');
const mO1 = mkMar(oOme.id, 'Omeprazole', '20mg', 'PO', hAgo(13), 'scheduled'); giveMar(mO1, 13);

const oAspirin = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'stat',
  details: { drug: 'Aspirin', dose: '325mg', route: 'PO', frequency: 'OD' },
  allergyOverrideReason: 'STEMI indication — benefits outweigh risk; P2Y12 coverage active'
}));
ow.transition(ctx, oAspirin.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oAspirin.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ Aspirin 325mg STAT (⚠️ allergy override: پنی‌سیلین/آسپرین)');
const mAs1 = mkMar(oAspirin.id, 'Aspirin', '325mg', 'PO', hAgo(16), 'scheduled'); giveMar(mAs1, 16);

// ══════════════════════════════════════════════════════════════
//  2. INJECTABLE MEDICATIONS (4 items)
// ══════════════════════════════════════════════════════════════
console.log('\n💉 [2/10] INJECTABLE medications...');

const oVanco = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'stat',
  details: { drug: 'Vancomycin', dose: '1g', route: 'IV', frequency: 'Q12H', durationDays: 7, highAlert: true }
}));
ow.transition(ctx, oVanco.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oVanco.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ Vancomycin 1g IV (HIGH-ALERT, witness needed)');
const mV1 = mkMar(oVanco.id, 'Vancomycin', '1g', 'IV', hAgo(6), 'scheduled', { isHighAlert: true }); giveMar(mV1, 6);
const mV2 = mkMar(oVanco.id, 'Vancomycin', '1g', 'IV', hFrom(6), 'scheduled', { isHighAlert: true });

const oHep = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'routine',
  details: { drug: 'Heparin', dose: '5000 units', route: 'SC', frequency: 'Q8H', durationDays: 7, highAlert: true }
}));
ow.transition(ctx, oHep.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oHep.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ Heparin 5000 U SC (HIGH-ALERT)');
const mH1 = mkMar(oHep.id, 'Heparin', '5000 units', 'SC', hAgo(4), 'scheduled', { isHighAlert: true }); giveMar(mH1, 4);
const mH2 = mkMar(oHep.id, 'Heparin', '5000 units', 'SC', hFrom(4), 'scheduled', { isHighAlert: true });

const oFur = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'routine',
  details: { drug: 'Furosemide', dose: '40mg', route: 'IV', frequency: 'BID', durationDays: 3 }
}));
ow.transition(ctx, oFur.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oFur.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ Furosemide 40mg IV');
const mF1 = mkMar(oFur.id, 'Furosemide', '40mg', 'IV', hAgo(8), 'scheduled'); giveMar(mF1, 8);
const mF2 = mkMar(oFur.id, 'Furosemide', '40mg', 'IV', hAgo(1), 'due');   // overdue

const oIns = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'routine',
  details: { drug: 'Insulin Regular', dose: '8 units', route: 'SC', frequency: 'AC meals', highAlert: true }
}));
ow.transition(ctx, oIns.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oIns.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ Insulin Regular 8U SC (HIGH-ALERT)');
const mI1 = mkMar(oIns.id, 'Insulin Regular', '8 units', 'SC', hAgo(3), 'scheduled', { isHighAlert: true }); giveMar(mI1, 3);

// ══════════════════════════════════════════════════════════════
//  3. IV FLUIDS (3 items)
// ══════════════════════════════════════════════════════════════
console.log('\n💧 [3/10] IV FLUIDS...');

const oNS = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'routine',
  details: { drug: 'Normal Saline 0.9%', dose: '1000 cc', route: 'IV', frequency: 'over 8h', category: 'fluid', rate: '125 cc/h' }
}));
ow.transition(ctx, oNS.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oNS.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ Normal Saline 1L / 8h (running)');
mkMar(oNS.id, 'Normal Saline 0.9%', '1000 cc', 'IV', hAgo(2), 'due');
mkMar(oNS.id, 'Normal Saline 0.9%', '1000 cc', 'IV', hFrom(6), 'scheduled');

const oD5 = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'routine',
  details: { drug: 'Dextrose 5% in Water', dose: '500 cc', route: 'IV', frequency: 'over 6h', category: 'fluid', rate: '83 cc/h' }
}));
ow.transition(ctx, oD5.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oD5.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ D5W 500cc / 6h');
mkMar(oD5.id, 'Dextrose 5% in Water', '500 cc', 'IV', hAgo(4), 'scheduled'); giveMar(mkMar(oD5.id, 'Dextrose 5% in Water', '500 cc', 'IV', hAgo(4), 'scheduled'), 4);

const oRL = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'routine',
  details: { drug: 'Ringer Lactate', dose: '1000 cc', route: 'IV', frequency: 'over 10h', category: 'fluid', rate: '100 cc/h' }
}));
ow.transition(ctx, oRL.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oRL.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ Ringer Lactate 1L / 10h');
mkMar(oRL.id, 'Ringer Lactate', '1000 cc', 'IV', hAgo(5), 'scheduled');

// ══════════════════════════════════════════════════════════════
//  4. PRN MEDICATIONS (4 items)
// ══════════════════════════════════════════════════════════════
console.log('\n📋 [4/10] PRN medications...');

const oMorph = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'routine',
  details: { drug: 'Morphine', dose: '2mg', route: 'IV', frequency: 'PRN', prn: true, prnIndication: 'pain 7/10 or higher', highAlert: true }
}));
ow.transition(ctx, oMorph.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oMorph.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ Morphine 2mg IV PRN (HIGH-ALERT)');
const mMo1 = mkMar(oMorph.id, 'Morphine', '2mg', 'IV', hAgo(5), 'scheduled', { isHighAlert: true });
giveMar(mMo1, 5);

const oZof = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'routine',
  details: { drug: 'Ondansetron', dose: '4mg', route: 'IV', frequency: 'PRN', prn: true, prnIndication: 'nausea/vomiting' }
}));
ow.transition(ctx, oZof.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oZof.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ Ondansetron 4mg IV PRN');

const oAce = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'routine',
  details: { drug: 'Acetaminophen', dose: '500mg', route: 'PO', frequency: 'PRN', prn: true, prnIndication: 'fever >38.5 or mild pain' }
}));
ow.transition(ctx, oAce.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oAce.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ Acetaminophen 500mg PO PRN');
const mAc1 = mkMar(oAce.id, 'Acetaminophen', '500mg', 'PO', hAgo(7), 'scheduled');
mw.refuse(ctx, mAc1.id, { reason: 'بیمار امتناع کرد — تهوع' });

const oNTG = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'routine',
  details: { drug: 'Nitroglycerin SL', dose: '0.4mg', route: 'SL', frequency: 'PRN', prn: true, prnIndication: 'chest pain >5/10', highAlert: true }
}));
ow.transition(ctx, oNTG.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oNTG.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ Nitroglycerin 0.4mg SL PRN (HIGH-ALERT)');
const mNT1 = mkMar(oNTG.id, 'Nitroglycerin SL', '0.4mg', 'SL', hAgo(9), 'scheduled', { isHighAlert: true });
giveMar(mNT1, 9);

// ══════════════════════════════════════════════════════════════
//  5. TOPICAL + INHALED
// ══════════════════════════════════════════════════════════════
console.log('\n🩹 [5/10] TOPICAL + INHALED...');

const oPatch = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'routine',
  details: { drug: 'Nitroglycerin Patch', dose: '0.2mg/h', route: 'TOP', frequency: 'OD (12h on/12h off)' }
}));
ow.transition(ctx, oPatch.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oPatch.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ Nitroglycerin Patch 0.2mg/h (topical)');
const mP1 = mkMar(oPatch.id, 'Nitroglycerin Patch', '0.2mg/h', 'TOP', hAgo(12), 'scheduled'); giveMar(mP1, 12);

const oNeb = ow.create(ctx, seed({
  patientId: PID, type: 'medication', priority: 'stat',
  details: { drug: 'Salbutamol Nebulizer', dose: '2.5mg', route: 'NEB', frequency: 'Q6H' }
}));
ow.transition(ctx, oNeb.id, 'verify', { event: 'kardex.order.verify' });
ow.transition(ctx, oNeb.id, 'activate', { event: 'kardex.order.activate' });
console.log('  ✓ Salbutamol Neb 2.5mg (inhaled)');
const mN1 = mkMar(oNeb.id, 'Salbutamol Nebulizer', '2.5mg', 'NEB', hAgo(2), 'scheduled'); giveMar(mN1, 2);
const mN2 = mkMar(oNeb.id, 'Salbutamol Nebulizer', '2.5mg', 'NEB', hFrom(4), 'scheduled');

// ══════════════════════════════════════════════════════════════
//  6. LABS (6 items)
// ══════════════════════════════════════════════════════════════
console.log('\n🧪 [6/10] LABS...');
const labs = [
  { panel: 'CBC + Diff', priority: 'stat', status: 'pending' },
  { panel: 'BMP (Basic Metabolic Panel)', priority: 'routine', status: 'pending' },
  { panel: 'Troponin I (0h/3h protocol)', priority: 'stat', status: 'pending' },
  { panel: 'PT / INR / aPTT', priority: 'routine', status: 'pending' },
  { panel: 'ABG (Arterial Blood Gas)', priority: 'stat', status: 'pending' },
  { panel: 'Lactate', priority: 'stat', status: 'pending' },
  { panel: 'HbA1c', priority: 'routine', status: 'pending' }
];
labs.forEach((lab, i) => {
  const o = ow.create(ctx, seed({
    patientId: PID, type: 'lab', priority: lab.priority,
    details: { panel: lab.panel }
  }));
  if (i < 4) ow.transition(ctx, o.id, 'verify', { event: 'kardex.order.verify' });
  console.log('  ✓ lab:', lab.panel, '(' + lab.priority + ')');
});

// ══════════════════════════════════════════════════════════════
//  7. IMAGING (4 items)
// ══════════════════════════════════════════════════════════════
console.log('\n📷 [7/10] IMAGING...');
const imaging = [
  { modality: 'CXR', bodyPart: 'PA/Lateral', priority: 'stat', contrast: false },
  { modality: 'CT', bodyPart: 'Chest', priority: 'urgent', contrast: true },
  { modality: 'Echocardiography', bodyPart: 'TTE', priority: 'urgent', contrast: false },
  { modality: 'ECG (12-lead)', bodyPart: 'serial', priority: 'stat', contrast: false }
];
imaging.forEach((im, i) => {
  const o = ow.create(ctx, seed({
    patientId: PID, type: 'paraclinical', priority: im.priority,
    details: { modality: im.modality, bodyPart: im.bodyPart, withContrast: im.contrast }
  }));
  if (i < 2) ow.transition(ctx, o.id, 'verify', { event: 'kardex.order.verify' });
  console.log('  ✓ imaging:', im.modality, im.bodyPart);
});

// ══════════════════════════════════════════════════════════════
//  8. CONSULTS (3 items)
// ══════════════════════════════════════════════════════════════
console.log('\n🩺 [8/10] CONSULTS...');

const cCardio = cw.create(ctx, seed({
  patientId: PID, targetService: 'کاردیولوژی — اینترونشنال',
  consultType: 'emergency',
  question: 'ST elevation in V2-V4 — نیاز فوری به PCI primary. بیمار تحت دوز بارگذاریASA+Clopidogrel.'
}));
console.log('  ✓ consult: cardiology (URGENT, pending):', cCardio.id);

const cNephro = cw.create(ctx, seed({
  patientId: PID, targetService: 'نفرولوژی',
  consultType: 'urgent',
  question: 'AKI stage 2 — Cr 2.8 (baseline 1.1)، K+ 5.4. ارزیابی نیاز به CRRT؟'
}));
cw.transition(ctx, cNephro.id, 'respond', {
  fields: { respondedBy: 'usr_nephro_1', respondedByName: 'دکتر شیرین احمدی', respondedAt: hAgo(3),
            response: { answer: 'ادامه مایع‌درمانی، پایش دقیق I&O، تکرار Cr/K در ۱۲ ساعت. CRRT در صورت K>6.5 یا oliguria>6h.', recommendations: ['Kayexalate 15g PO', 'تکرار K در 4h'] } },
  event: 'kardex.consult.respond'
});
console.log('  ✓ consult: nephrology (responded)');

const cID = cw.create(ctx, seed({
  patientId: PID, targetService: 'عفونی (Infectious Disease)',
  consultType: 'routine',
  question: 'تب ۳۹.۵°C، WBC 18K با left shift. منشأ نامشخص، کشت خون ×۲ درخواست شده. شروع امپریک Vancomycin + Pip/Tazo مناسب است؟'
}));
cw.transition(ctx, cID.id, 'respond', {
  fields: { respondedBy: 'usr_id_1', respondedByName: 'دکتر مریم کریمی', respondedAt: hAgo(5),
            response: { answer: 'بله، Vancomycin + Pip/Tazo مناسب است. سطح Vancomycin روزانه چک شود. کشت ×3 از سایت‌های مختلف.', recommendations: ['Vanco trough before 4th dose', 'Pip/Tazo 4.5g Q6H'] } },
  event: 'kardex.consult.respond'
});
cw.transition(ctx, cID.id, 'approve', {
  fields: { approvedBy: 'usr_attending', approvedByName: 'دکتر ناصر نوری', approvedAt: hAgo(4) },
  event: 'kardex.consult.approve'
});
console.log('  ✓ consult: ID (approved)');

// ══════════════════════════════════════════════════════════════
//  9. NURSING ORDERS (4 items)
// ══════════════════════════════════════════════════════════════
console.log('\n🩹 [9/10] NURSING orders...');
[
  { note: 'پانسمان روزانه زخم پای چپ (فمورال کاتتر)', status: 'pending' },
  { note: 'تغییر پوزیشن هر ۲ ساعت (prevent pressure ulcer)', status: 'pending' },
  { note: 'پایش دقیق I&O (Cath urine output hourly)', status: 'active' },
  { note: 'اکسیژن تراپی ۲ L/min via nasal cannula', status: 'active' }
].forEach((n, i) => {
  const o = ow.create(ctx, seed({
    patientId: PID, type: 'nursing', priority: 'routine',
    details: { note: n.note }
  }));
  if (n.status === 'active') {
    ow.transition(ctx, o.id, 'verify', { event: 'kardex.order.verify' });
    ow.transition(ctx, o.id, 'activate', { event: 'kardex.order.activate' });
  } else if (i < 1) {
    ow.transition(ctx, o.id, 'verify', { event: 'kardex.order.verify' });
  }
  console.log('  ✓ nursing:', n.note.substring(0, 40) + '...');
});

// ══════════════════════════════════════════════════════════════
//  10. VITALS (7 entries showing deterioration + improvement)
// ══════════════════════════════════════════════════════════════
console.log('\n📊 [10/10] VITALS trend...');
const vitalsData = [
  { hoursAgo: 18, hr: 118, rr: 26, spo2: 88, sbp: 92, dbp: 58, temp: 38.9, onO2: true, gcs: 14, pain: 8, cons: 'alert' },     // critical on admission
  { hoursAgo: 14, hr: 112, rr: 24, spo2: 91, sbp: 98, dbp: 62, temp: 38.6, onO2: true, gcs: 14, pain: 7, cons: 'alert' },     // high
  { hoursAgo: 10, hr: 108, rr: 22, spo2: 93, sbp: 102, dbp: 65, temp: 38.2, onO2: true, gcs: 15, pain: 6, cons: 'alert' },    // high
  { hoursAgo: 6, hr: 102, rr: 22, spo2: 94, sbp: 108, dbp: 68, temp: 38.0, onO2: true, gcs: 15, pain: 5, cons: 'alert' },     // high
  { hoursAgo: 3, hr: 128, rr: 28, spo2: 89, sbp: 88, dbp: 55, temp: 39.5, onO2: true, gcs: 13, pain: 8, cons: 'voice' },      // critical (acute deterioration)
  { hoursAgo: 1, hr: 122, rr: 26, spo2: 92, sbp: 92, dbp: 58, temp: 39.1, onO2: true, gcs: 14, pain: 6, cons: 'alert' },      // critical
  { hoursAgo: 0.2, hr: 115, rr: 24, spo2: 94, sbp: 98, dbp: 62, temp: 38.8, onO2: true, gcs: 15, pain: 5, cons: 'alert' }     // high (improving)
];
vitalsData.forEach(v => {
  const rec = vw.record(ctx, seed({
    patientId: PID,
    hr: v.hr, rr: v.rr, spo2: v.spo2, bp_sys: v.sbp, bp_dia: v.dbp, temp: v.temp,
    onOxygen: v.onO2, gcs: v.gcs, pain: v.pain, consciousness: v.cons,
    recordedAt: hAgo(v.hoursAgo)
  }));
  console.log('  ✓ vitals @-' + v.hoursAgo + 'h: NEWS2=' + rec.news2 + ' (' + rec.newsLevel + ')');
});

// ══════════════════════════════════════════════════════════════
//  I&O records (8 entries)
// ══════════════════════════════════════════════════════════════
console.log('\n💧 I&O records...');
const ioData = [
  { type: 'intake', volume: 500, subtype: 'iv_fluid', at: 16 },
  { type: 'output', volume: 400, subtype: 'urine', at: 15 },
  { type: 'intake', volume: 250, subtype: 'iv_med', at: 12 },
  { type: 'output', volume: 350, subtype: 'urine', at: 10 },
  { type: 'intake', volume: 500, subtype: 'iv_fluid', at: 8 },
  { type: 'output', volume: 300, subtype: 'urine', at: 6 },
  { type: 'intake', volume: 300, subtype: 'oral', at: 4 },
  { type: 'output', volume: 450, subtype: 'urine', at: 2 },
  { type: 'intake', volume: 400, subtype: 'iv_fluid', at: 1 },
  { type: 'output', volume: 250, subtype: 'urine', at: 0.5 }
];
ioData.forEach(io => {
  store.put('io_records', seed({
    id: store.uid('io'), patientId: PID, type: io.type, subtype: io.subtype,
    volume: io.volume, recordedAt: hAgo(io.at), recordedBy: 'usr_nurse_1'
  }));
});
console.log('  ✓ 10 I&O records (intake 1950cc, output 1750cc)');

// ══════════════════════════════════════════════════════════════
//  ALERTS (6 items)
// ══════════════════════════════════════════════════════════════
console.log('\n🚨 ALERTS...');

bus.emit('cdss.alert', seed({
  type: T_ALERT + 'sepsis', severity: 'critical',
  patientId: PID, patientName: 'رضا محمدی', wardCode: 'ICU_GEN1',
  title: '🚨 سپسیس مشکوک — qSOFA=3',
  message: 'RR≥22 + SBP≤100 + GCS<15 + Lactate 4.2 + Temp 39.5°C',
  recommendation: 'کشت خون ×۳، Vancomycin + Pip/Tazo فوری، مایع‌درمانی 30ml/kg'
}));

bus.emit('cdss.alert', seed({
  type: T_ALERT + 'allergy_override', severity: 'high',
  patientId: PID, patientName: 'رضا محمدی', wardCode: 'ICU_GEN1',
  title: '⚠️ Allergy Override — Aspirin',
  message: 'بیمار به آسپرین حساسیت دارد — Aspirin 325mg با override تجویز شد (STEMI indication)',
  recommendation: 'پایش علائم آنافیلاکسی در ۳۰ دقیقه اول، دوز بارگذاری P2Y12 فعال'
}));

bus.emit('cdss.alert', seed({
  type: T_ALERT + 'mar_overdue', severity: 'critical',
  patientId: PID, patientName: 'رضا محمدی', wardCode: 'ICU_GEN1',
  title: '⏰ MAR عقب‌افتاده — Metoprolol',
  message: 'Metoprolol 25mg — ۲ ساعت تأخیر (scheduled 2h ago)',
  recommendation: 'اجرای فوری توسط پرستار مسئول یا گزارش به پزشک'
}));

bus.emit('cdss.alert', seed({
  type: T_ALERT + 'mar_overdue_furosemide', severity: 'high',
  patientId: PID, patientName: 'رضا محمدی', wardCode: 'ICU_GEN1',
  title: '⏰ MAR عقب‌افتاده — Furosemide',
  message: 'Furosemide 40mg IV — ۱ ساعت تأخیر',
  recommendation: 'اجرای فوری'
}));

bus.emit('cdss.alert', seed({
  type: T_ALERT + 'high_alert_due', severity: 'high',
  patientId: PID, patientName: 'رضا محمدی', wardCode: 'ICU_GEN1',
  title: '⚠️ Vancomycin — HIGH-ALERT Due Soon',
  message: 'Vancomycin 1g IV — در ۶ ساعت آینده، نیاز به شاهد دوم',
  recommendation: 'هماهنگی با پرستار شاهد، تأیید پنج حق، پایش trough قبل از دوز ۴'
}));

bus.emit('cdss.alert', seed({
  type: T_ALERT + 'aki_warning', severity: 'warning',
  patientId: PID, patientName: 'رضا محمدی', wardCode: 'ICU_GEN1',
  title: 'ℹ️ AKI Stage 2 — پایش دقیق',
  message: 'Cr 2.8 (baseline 1.1), K+ 5.4 — نفرولوژی consult داده شد',
  recommendation: 'پایش hourly urine output، تکرار Cr/K در 4h'
}));

// ─── Wait for persister + final report ───
setTimeout(() => {
  try { bus.flushEvents && bus.flushEvents(); } catch(_) {}

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  ✅ SEED v2 COMPLETE — رضا محمدی (' + PID + ')');
  console.log('═══════════════════════════════════════════════════\n');

  const ks = require('./core/domain/kardex-service');
  const kx = ks.getPatientKardex(ctx, PID);
  console.log('📊 Kardex categorization:');
  console.log('  💊 oral:        ' + kx.oral.length);
  console.log('  💉 injectable:  ' + kx.injectable.length);
  console.log('  💧 fluids:      ' + kx.fluids.length);
  console.log('  📋 prn:         ' + kx.prn.length);
  console.log('  🩹 topical:     ' + kx.topical.length);
  console.log('  🌬️ inhaled:     ' + kx.inhaled.length);
  console.log('  🧪 labs:        ' + kx.labs.length);
  console.log('  📷 imaging:     ' + kx.imaging.length);
  console.log('  🩺 consults:    ' + kx.consults.length);
  console.log('  🩹 nursing:     ' + kx.nursing.length);
  console.log('  📊 vitals:      ' + kx.vitals.length);
  console.log('  🚨 alerts:      ' + kx.alerts.length);
  console.log('  💧 I&O:         ' + (kx.ioSummary.intake + '/' + kx.ioSummary.output + ' balance:' + kx.ioSummary.balance));
  console.log('');
  console.log('  Latest NEWS2: ' + (kx.latestVital && kx.latestVital.news2) + ' (' + (kx.latestVital && kx.latestVital.newsLevel) + ')');
  console.log('  Overdue MARs: ' + kx._meta.counts.overdueMar);
  console.log('  Pending verify: ' + kx._meta.counts.pendingVerify);
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  🌐 OPEN IN BROWSER (logged in):');
  console.log('═══════════════════════════════════════════════════');
  console.log('  کاردکس:  http://localhost:4000/kind/kardex.kardex-unified?patientId=' + PID);
  console.log('  SBAR:    http://localhost:4000/kind/handover_print?patientId=' + PID);
  console.log('  شیفت:    http://localhost:4000/kind/kardex_shift?wardCode=ICU_GEN1');
  console.log('  🧹 cleanup: node tools/cleanup-kardex-demo.cjs ' + PID);
  console.log('');
}, 1000);
