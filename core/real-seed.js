'use strict';
const store = require('./store');
const sina = require('./sina');

function now() { return new Date().toISOString(); }
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }
function hoursAgo(n) { return new Date(Date.now() - n * 3600000).toISOString(); }

const PATIENTS = [
  // { name, age, sex, ward, diagnosis, comorbidities, allergies, codeStatus, admissionType,
  //   vitals: [...], orders: [...], mar: [...], consults: [...] }
  {
    id:'pat_001', firstName:'رضا', lastName:'محمدی', age:68, sex:'male',
    ward:'ICU_GEN1', diagnosis:'STEMI — سکته قلبی حاد', comorbidities:['HTN','DM','Hyperlipidemia'],
    allergies:['Penicillin'], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:2,
    vitals:[
      { hoursAgo:0.5, hr:118, bp_sys:92, bp_dia:58, rr:24, temp:38.2, spo2:91, news2:9 },
      { hoursAgo:2, hr:112, bp_sys:96, bp_dia:62, rr:22, temp:37.9, spo2:93, news2:7 },
      { hoursAgo:6, hr:108, bp_sys:100, bp_dia:64, rr:20, temp:37.5, spo2:94, news2:5 }
    ],
    orders:[
      { type:'medication', priority:'stat', details:{drug:'Aspirin', dose:'325mg', route:'PO', frequency:'OD', durationDays:7} },
      { type:'medication', priority:'stat', details:{drug:'Clopidogrel', dose:'600mg', route:'PO', frequency:'OD', durationDays:7} },
      { type:'medication', priority:'urgent', details:{drug:'Atorvastatin', dose:'80mg', route:'PO', frequency:'HS', durationDays:30} }
    ],
    mar:[
      { drug:'Aspirin', dose:'325mg', route:'PO', hoursAgo:3, isHighAlert:false },
      { drug:'Clopidogrel', dose:'600mg', route:'PO', hoursAgo:2.5, isHighAlert:false },
      { drug:'Atorvastatin', dose:'80mg', route:'PO', hoursAgo:-3, isHighAlert:false, status:'scheduled' }
    ],
    consult:{ targetService:'قلب و عروق', question:'تأیید PCI فوری', consultType:'emergency' }
  },
  {
    id:'pat_002', firstName:'فاطمه', lastName:'حسینی', age:72, sex:'female',
    ward:'ICU_GEN2', diagnosis:'سپسیس با منشأ پنومونی', comorbidities:['COPD','CKD Stage 3'],
    allergies:[], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:4,
    vitals:[
      { hoursAgo:0.3, hr:124, bp_sys:86, bp_dia:52, rr:28, temp:39.1, spo2:88, news2:11 },
      { hoursAgo:1.5, hr:120, bp_sys:88, bp_dia:54, rr:26, temp:38.9, spo2:90, news2:10 },
      { hoursAgo:4, hr:116, bp_sys:92, bp_dia:56, rr:24, temp:38.6, spo2:91, news2:8 }
    ],
    orders:[
      { type:'medication', priority:'stat', details:{drug:'Meropenem', dose:'1g', route:'IV', frequency:'Q8H', durationDays:10} },
      { type:'medication', priority:'stat', details:{drug:'Norepinephrine', dose:'0.1 mcg/kg/min', route:'IV', frequency:'Cont', durationDays:3} },
      { type:'lab', priority:'stat', details:{panel:'CBC'} },
      { type:'lab', priority:'stat', details:{panel:'Blood Culture'} }
    ],
    mar:[
      { drug:'Meropenem', dose:'1g', route:'IV', hoursAgo:5, isHighAlert:false },
      { drug:'Norepinephrine', dose:'0.1 mcg/kg/min', route:'IV', hoursAgo:1, isHighAlert:true, witnessedBy:'staff_23' },
      { drug:'Meropenem', dose:'1g', route:'IV', hoursAgo:-3, isHighAlert:false, status:'scheduled' }
    ],
    consult:{ targetService:'عفونی', question:'تأیید رژیم آنتی‌بیوتیکی', consultType:'emergency' }
  },
  {
    id:'pat_003', firstName:'محمد', lastName:'کریمی', age:45, sex:'male',
    ward:'ER', diagnosis:'درد قفسه سینه — suspected ACS', comorbidities:['Smoking'],
    allergies:[], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:0,
    vitals:[
      { hoursAgo:0.5, hr:98, bp_sys:138, bp_dia:82, rr:18, temp:37.2, spo2:96, news2:2 },
      { hoursAgo:1.5, hr:102, bp_sys:142, bp_dia:86, rr:20, temp:37.0, spo2:95, news2:3 }
    ],
    orders:[
      { type:'lab', priority:'stat', details:{panel:'Troponin'} },
      { type:'lab', priority:'stat', details:{panel:'ECG'} }
    ],
    mar:[],
    consult:{ targetService:'قلب و عروق', question:'ارزیابی ACS', consultType:'urgent' }
  },
  {
    id:'pat_004', firstName:'علی', lastName:'رضایی', age:32, sex:'male',
    ward:'ER', diagnosis:'ترومای سر — تصادف موتور', comorbidities:[],
    allergies:[], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:0,
    vitals:[
      { hoursAgo:0.2, hr:88, bp_sys:128, bp_dia:78, rr:18, temp:36.8, spo2:97, news2:1 }
    ],
    orders:[
      { type:'lab', priority:'stat', details:{panel:'CBC'} },
      { type:'paraclinical', priority:'stat', details:{modality:'CT', bodyPart:'Brain'} }
    ],
    mar:[],
    consult:{ targetService:'جراحی اعصاب', question:'ارزیابی CT Brain', consultType:'emergency' }
  },
  {
    id:'pat_005', firstName:'زهرا', lastName:'احمدی', age:55, sex:'female',
    ward:'INT_F', diagnosis:'پنومونی اکتسابی جامعه', comorbidities:['Asthma'],
    allergies:['Sulfa'], codeStatus:'full', admissionType:'elective', admittedDaysAgo:3,
    vitals:[
      { hoursAgo:1, hr:94, bp_sys:118, bp_dia:74, rr:22, temp:38.4, spo2:93, news2:5 },
      { hoursAgo:5, hr:96, bp_sys:120, bp_dia:76, rr:20, temp:38.0, spo2:94, news2:4 }
    ],
    orders:[
      { type:'medication', priority:'urgent', details:{drug:'Ceftriaxone', dose:'1g', route:'IV', frequency:'Q24H', durationDays:7} },
      { type:'medication', priority:'urgent', details:{drug:'Azithromycin', dose:'500mg', route:'IV', frequency:'Q24H', durationDays:5} }
    ],
    mar:[
      { drug:'Ceftriaxone', dose:'1g', route:'IV', hoursAgo:8, isHighAlert:false },
      { drug:'Ceftriaxone', dose:'1g', route:'IV', hoursAgo:-16, isHighAlert:false, status:'scheduled' }
    ]
  },
  {
    id:'pat_006', firstName:'سارا', lastName:'نوری', age:28, sex:'female',
    ward:'GEN_SURG14', diagnosis:'آپاندیسیت حاد — POD 1', comorbidities:[],
    allergies:[], codeStatus:'full', admissionType:'elective', admittedDaysAgo:1,
    vitals:[
      { hoursAgo:2, hr:82, bp_sys:118, bp_dia:72, rr:16, temp:37.4, spo2:98, news2:1 }
    ],
    orders:[
      { type:'medication', priority:'routine', details:{drug:'Cefazolin', dose:'1g', route:'IV', frequency:'Q8H', durationDays:3} },
      { type:'medication', priority:'routine', details:{drug:'Acetaminophen', dose:'500mg', route:'PO', frequency:'Q6H PRN', durationDays:3} }
    ],
    mar:[
      { drug:'Cefazolin', dose:'1g', route:'IV', hoursAgo:4, isHighAlert:false },
      { drug:'Acetaminophen', dose:'500mg', route:'PO', hoursAgo:1, isHighAlert:false }
    ]
  },
  {
    id:'pat_007', firstName:'حسن', lastName:'صادقی', age:62, sex:'male',
    ward:'GEN_SURG2', diagnosis:'کوله‌سیستیت حاد — POD 2', comorbidities:['DM Type 2'],
    allergies:[], codeStatus:'full', admissionType:'elective', admittedDaysAgo:2,
    vitals:[
      { hoursAgo:1, hr:78, bp_sys:126, bp_dia:78, rr:16, temp:37.2, spo2:97, news2:0 }
    ],
    orders:[
      { type:'medication', priority:'routine', details:{drug:'Metformin', dose:'500mg', route:'PO', frequency:'BID', durationDays:30} }
    ],
    mar:[
      { drug:'Metformin', dose:'500mg', route:'PO', hoursAgo:6, isHighAlert:false }
    ]
  },
  {
    id:'pat_008', firstName:'عباس', lastName:'قاسمی', age:70, sex:'male',
    ward:'NEURO_M', diagnosis:'CVA ایسکمیک — MCA چپ', comorbidities:['AF','HTN'],
    allergies:[], codeStatus:'dnr', admissionType:'emergency', admittedDaysAgo:5,
    vitals:[
      { hoursAgo:1, hr:86, bp_sys:148, bp_dia:88, rr:18, temp:37.0, spo2:95, news2:3 }
    ],
    orders:[
      { type:'medication', priority:'urgent', details:{drug:'Enoxaparin', dose:'40mg', route:'SC', frequency:'OD', durationDays:14} },
      { type:'medication', priority:'routine', details:{drug:'Atorvastatin', dose:'40mg', route:'PO', frequency:'HS', durationDays:30} }
    ],
    mar:[
      { drug:'Enoxaparin', dose:'40mg', route:'SC', hoursAgo:3, isHighAlert:true, witnessedBy:'staff_24' }
    ]
  },
  {
    id:'pat_009', firstName:'نگار', lastName:'موسوی', age:35, sex:'female',
    ward:'NEURO_F', diagnosis:'تشنج — تحت بررسی', comorbidities:['Epilepsy'],
    allergies:[], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:1,
    vitals:[
      { hoursAgo:0.5, hr:88, bp_sys:118, bp_dia:76, rr:16, temp:37.1, spo2:97, news2:1 }
    ],
    orders:[
      { type:'medication', priority:'urgent', details:{drug:'Levetiracetam', dose:'500mg', route:'IV', frequency:'Q12H', durationDays:5} }
    ],
    mar:[
      { drug:'Levetiracetam', dose:'500mg', route:'IV', hoursAgo:2, isHighAlert:false }
    ]
  },
  {
    id:'pat_010', firstName:'مریم', lastName:'جعفری', age:80, sex:'female',
    ward:'ORTHO_F', diagnosis:'شکستگی گردن فمور — post ORIF', comorbidities:['Osteoporosis','HTN'],
    allergies:[], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:2,
    vitals:[
      { hoursAgo:1, hr:84, bp_sys:132, bp_dia:80, rr:16, temp:37.3, spo2:96, news2:1 }
    ],
    orders:[
      { type:'medication', priority:'urgent', details:{drug:'Enoxaparin', dose:'40mg', route:'SC', frequency:'OD', durationDays:28} },
      { type:'medication', priority:'routine', details:{drug:'Calcium+D', dose:'500mg', route:'PO', frequency:'BID', durationDays:90} }
    ],
    mar:[
      { drug:'Enoxaparin', dose:'40mg', route:'SC', hoursAgo:5, isHighAlert:true, witnessedBy:'staff_26' }
    ]
  },
  {
    id:'pat_011', firstName:'احمد', lastName:'محمدپناه', age:65, sex:'male',
    ward:'CCU', diagnosis:'CHF exacerbation', comorbidities:['HTN','CAD'],
    allergies:[], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:3,
    vitals:[
      { hoursAgo:1, hr:98, bp_sys:108, bp_dia:68, rr:22, temp:36.9, spo2:92, news2:5 }
    ],
    orders:[
      { type:'medication', priority:'urgent', details:{drug:'Furosemide', dose:'40mg', route:'IV', frequency:'BID', durationDays:3} },
      { type:'medication', priority:'routine', details:{drug:'Carvedilol', dose:'6.25mg', route:'PO', frequency:'BID', durationDays:30} }
    ],
    mar:[
      { drug:'Furosemide', dose:'40mg', route:'IV', hoursAgo:6, isHighAlert:false },
      { drug:'Furosemide', dose:'40mg', route:'IV', hoursAgo:-6, isHighAlert:false, status:'scheduled' }
    ]
  },
  {
    id:'pat_012', firstName:'نرگس', lastName:'سلطانی', age:50, sex:'female',
    ward:'ONCO', diagnosis:'Breast Cancer — cycle 3 FEC', comorbidities:[],
    allergies:[], codeStatus:'full', admissionType:'elective', admittedDaysAgo:1,
    vitals:[
      { hoursAgo:2, hr:76, bp_sys:112, bp_dia:72, rr:14, temp:36.8, spo2:98, news2:0 }
    ],
    orders:[
      { type:'medication', priority:'stat', details:{drug:'Ondansetron', dose:'8mg', route:'IV', frequency:'Q8H PRN', durationDays:3} },
      { type:'medication', priority:'routine', details:{drug:'Dexamethasone', dose:'8mg', route:'IV', frequency:'BID', durationDays:3} }
    ],
    mar:[
      { drug:'Ondansetron', dose:'8mg', route:'IV', hoursAgo:4, isHighAlert:false }
    ]
  },
  {
    id:'pat_013', firstName:'حسین', lastName:'طاهری', age:60, sex:'male',
    ward:'ICU_GEN1', diagnosis:'Post CABG day 1', comorbidities:['DM','HTN','CAD 3VD'],
    allergies:[], codeStatus:'full', admissionType:'elective', admittedDaysAgo:1,
    vitals:[
      { hoursAgo:0.5, hr:92, bp_sys:108, bp_dia:62, rr:18, temp:37.4, spo2:95, news2:3 }
    ],
    orders:[
      { type:'medication', priority:'stat', details:{drug:'Heparin', dose:'5000U', route:'SC', frequency:'Q8H', durationDays:5} },
      { type:'medication', priority:'urgent', details:{drug:'Morphine', dose:'2mg', route:'IV', frequency:'Q4H PRN', durationDays:2} }
    ],
    mar:[
      { drug:'Heparin', dose:'5000U', route:'SC', hoursAgo:2, isHighAlert:true, witnessedBy:'staff_23' },
      { drug:'Morphine', dose:'2mg', route:'IV', hoursAgo:1, isHighAlert:true, witnessedBy:'staff_24' }
    ]
  },
  {
    id:'pat_014', firstName:'پریسا', lastName:'کریمی', age:25, sex:'female',
    ward:'ER', diagnosis:'مسمومیت دارویی — تحت نظر', comorbidities:[],
    allergies:[], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:0,
    vitals:[
      { hoursAgo:0.5, hr:108, bp_sys:104, bp_dia:62, rr:18, temp:36.9, spo2:96, news2:3 }
    ],
    orders:[
      { type:'nursing', priority:'stat', details:{note:'پایش هر ۳۰ دقیقه، NPO'} }
    ],
    mar:[],
    consult:{ targetService:'روانپزشکی', question:'ارزیابی suicidal ideation', consultType:'urgent' }
  },
  {
    id:'pat_015', firstName:'سعید', lastName:'نوری', age:40, sex:'male',
    ward:'INT_M', diagnosis:'DKA — دیابت نوع ۱', comorbidities:['DM Type 1'],
    allergies:[], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:1,
    vitals:[
      { hoursAgo:1, hr:112, bp_sys:98, bp_dia:64, rr:28, temp:37.2, spo2:97, news2:6 }
    ],
    orders:[
      { type:'medication', priority:'stat', details:{drug:'Insulin Regular', dose:'0.1 U/kg/hr', route:'IV Infusion', frequency:'Cont', durationDays:2} },
      { type:'medication', priority:'stat', details:{drug:'NS 0.9%', dose:'1L', route:'IV', frequency:'Q1H x2', durationDays:1} }
    ],
    mar:[
      { drug:'Insulin Regular', dose:'10U', route:'IV', hoursAgo:2, isHighAlert:true, witnessedBy:'staff_25' }
    ]
  }
];

function seedReal() {
  // Clear previous patients (keep staff + beds)
  const existingPatients = store.readAll('patients');
  for (const p of existingPatients) store.remove('patients', p.id);
  // Clear vitals, mar, orders, consults
  for (const coll of ['vitals','mar','orders','consults']) {
    for (const x of store.readAll(coll)) store.remove(coll, x.id);
  }
  // Reset all beds to available
  const beds = store.readAll('beds');
  for (const b of beds) { b.status = 'available'; b.patientId = null; store.put('beds', b); }

  // Assign patients to beds
  const usedBeds = new Set();
  let created = 0, vitalsCount = 0, ordersCount = 0, marCount = 0;
  const now_ts = now();

  for (let i = 0; i < PATIENTS.length; i++) {
    const p = PATIENTS[i];
    // Find a free bed in this ward
    const freeBed = beds.find(b => b.wardCode === p.ward && b.status === 'available' && !usedBeds.has(b.id));
    if (!freeBed) {
      console.warn('No bed in ' + p.ward + ' for ' + p.firstName + ' ' + p.lastName);
      continue;
    }
    usedBeds.add(freeBed.id);
    freeBed.status = 'occupied';
    freeBed.patientId = p.id;
    store.put('beds', freeBed);

    // Create patient record
    const patient = {
      id: p.id, mrn: 'MRN-' + (10000 + i),
      firstName: p.firstName, lastName: p.lastName,
      age: p.age, sex: p.sex,
      wardCode: p.ward, bedId: freeBed.id, bedNumber: freeBed.bedNumber,
      diagnosis: p.diagnosis, comorbidities: p.comorbidities, allergies: p.allergies,
      codeStatus: p.codeStatus, admissionType: p.admissionType,
      status: 'in_care', admittedAt: daysAgo(p.admittedDaysAgo),
      createdAt: now_ts
    };
    store.put('patients', patient);
    created++;

    // Vitals
    for (let vi = 0; vi < p.vitals.length; vi++) {
      const v = p.vitals[vi];
      store.put('vitals', {
        id: 'vit_' + p.id + '_' + vi,
        patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
        wardCode: p.ward, bedNumber: freeBed.bedNumber,
        recordedAt: hoursAgo(v.hoursAgo),
        recordedBy: 'usr_admin',
        hr: v.hr, bp_sys: v.bp_sys, bp_dia: v.bp_dia, rr: v.rr,
        temp: v.temp, spo2: v.spo2, onOxygen: v.spo2 < 94,
        gcs: 15, pain: 3, consciousness: 'alert',
        news2: v.news2, newsLevel: v.news2 >= 7 ? 'critical' : v.news2 >= 5 ? 'high' : v.news2 >= 1 ? 'medium' : 'low',
        notes: ''
      });
      vitalsCount++;
    }

    // Orders + MAR
    for (let oi = 0; oi < p.orders.length; oi++) {
      const o = p.orders[oi];
      const orderId = 'ord_' + p.id + '_' + oi;
      store.put('orders', {
        id: orderId, patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
        wardCode: p.ward, type: o.type, priority: o.priority,
        details: o.details, status: 'verified',
        orderedBy: 'usr_admin', orderedAt: hoursAgo(2 + oi * 0.5),
        verifiedBy: 'usr_admin', verifiedAt: hoursAgo(1.5 + oi * 0.5)
      });
      ordersCount++;
    }

    for (let mi = 0; mi < p.mar.length; mi++) {
      const m = p.mar[mi];
      const status = m.status || 'given';
      store.put('mar', {
        id: 'mar_' + p.id + '_' + mi,
        orderId: 'ord_' + p.id + '_0',
        patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
        wardCode: p.ward,
        drugName: m.drug, dose: m.dose, route: m.route,
        scheduledAt: hoursAgo(m.hoursAgo),
        administeredAt: status === 'given' ? hoursAgo(m.hoursAgo) : null,
        status: status,
        administeredBy: status === 'given' ? 'usr_admin' : null,
        witnessedBy: m.witnessedBy || null,
        isHighAlert: m.isHighAlert,
        fiveRights: status === 'given' ? { patient: true, drug: true, dose: true, route: true, time: true } : null
      });
      marCount++;
    }

    // Consult
    if (p.consult) {
      store.put('consults', {
        id: 'cons_' + p.id,
        patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
        wardCode: p.ward, bedNumber: freeBed.bedNumber,
        consultType: p.consult.consultType,
        targetService: p.consult.targetService,
        question: p.consult.question,
        isbar: {}, status: 'requested',
        requestedBy: 'usr_admin', requestedAt: hoursAgo(1.5),
        responseDueAt: new Date(Date.now() + (p.consult.consultType === 'emergency' ? 30 : 120) * 60000).toISOString()
      });
    }
  }

  return { patients: created, vitals: vitalsCount, orders: ordersCount, mar: marCount };
}

module.exports = { seedReal, PATIENTS };
