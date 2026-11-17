'use strict';
const store = require('./core/store');

function ago(ms) { return new Date(Date.now() - ms).toISOString(); }
function days(n) { return ago(n * 86400000); }
function hours(n) { return ago(n * 3600000); }
function today() { return new Date().toISOString().slice(0, 10); }
function ensure(coll, min, fn) {
  const count = store.readAll(coll).length;
  if (count >= min) { console.log('  ⏭  ' + coll + ': ' + count + ' (از قبل)'); return; }
  try { fn(); console.log('  ✅ ' + coll + ': ' + store.readAll(coll).length); }
  catch (e) { console.log('  ❌ ' + coll + ': ' + e.message); }
}

const patients = store.readAll('patients');
const staff = store.readAll('wf_staff');
const users = store.readAll('users');
const rooms = store.readAll('or_rooms');

if (!patients.length) { console.error('❌ patients خالی — seed.js را اجرا کنید'); process.exit(1); }
if (!staff.length) { console.error('❌ wf_staff خالی — seed.js را اجرا کنید'); process.exit(1); }

const P = patients.map(p => ({
  id: p.id, name: p.firstName + ' ' + p.lastName,
  ward: p.wardCode, bed: p.bedNumber, age: p.age,
  dx: p.diagnosis || 'تشخیص نامشخص'
}));
const S = staff.map(s => ({ id: s.id, name: s.fullName, role: s.role, ward: s.ward }));
const admin = users.find(u => u.role === 'admin') || { id: 'usr_admin', username: 'admin' };
const doctor = S.find(s => s.role === 'physician' || s.role === 'attending') || S[0];
const nurse = S.find(s => s.role === 'nurse') || S[0];
const head = S.find(s => s.role === 'head_nurse') || S[0];

console.log('\n═══ شروع seed ═══\n');

// ═══ clinical ═══
ensure('orders', 15, () => {
  const T = [
    { type:'medication', priority:'stat', details:{drug:'Aspirin', dose:'325mg', route:'PO', frequency:'OD', durationDays:7} },
    { type:'medication', priority:'stat', details:{drug:'Meropenem', dose:'1g', route:'IV', frequency:'Q8H', durationDays:10} },
    { type:'medication', priority:'urgent', details:{drug:'Enoxaparin', dose:'40mg', route:'SC', frequency:'OD', durationDays:14} },
    { type:'medication', priority:'routine', details:{drug:'Atorvastatin', dose:'40mg', route:'PO', frequency:'HS', durationDays:30} },
    { type:'medication', priority:'urgent', details:{drug:'Furosemide', dose:'40mg', route:'IV', frequency:'BID', durationDays:3} },
    { type:'lab', priority:'stat', details:{panel:'CBC'} },
    { type:'lab', priority:'stat', details:{panel:'Troponin'} },
    { type:'nursing', priority:'routine', details:{note:'پایش هر ۴ ساعت'} },
    { type:'diet', priority:'routine', details:{diet:'کم نمک'} }
  ];
  for (let i = 0; i < 20; i++) {
    const p = P[i % P.length], t = T[i % T.length];
    store.put('orders', {
      id: store.uid('ord'), patientId: p.id, patientName: p.name, wardCode: p.ward,
      type: t.type, priority: t.priority, details: t.details,
      status: i < 14 ? 'verified' : 'pending',
      orderedBy: doctor.id, orderedAt: hours(24 - i),
      verifiedBy: i < 14 ? nurse.id : null, verifiedAt: i < 14 ? hours(20 - i) : null
    });
  }
});

ensure('mar', 20, () => {
  const D = [
    { drug:'Aspirin', dose:'325mg', route:'PO', high:false },
    { drug:'Meropenem', dose:'1g', route:'IV', high:false },
    { drug:'Enoxaparin', dose:'40mg', route:'SC', high:true },
    { drug:'Furosemide', dose:'40mg', route:'IV', high:false },
    { drug:'Insulin Regular', dose:'10U', route:'IV', high:true },
    { drug:'Heparin', dose:'5000U', route:'SC', high:true },
    { drug:'Morphine', dose:'2mg', route:'IV', high:true }
  ];
  for (let i = 0; i < 40; i++) {
    const p = P[i % P.length], d = D[i % D.length];
    const st = i % 6 === 0 ? 'missed' : i % 8 === 0 ? 'refused' : i < 25 ? 'given' : 'scheduled';
    store.put('mar', {
      id: store.uid('mar'), patientId: p.id, patientName: p.name, wardCode: p.ward,
      drugName: d.drug, dose: d.dose, route: d.route,
      scheduledAt: hours(48 - i), administeredAt: st === 'given' ? hours(48 - i) : null,
      status: st, administeredBy: st === 'given' ? nurse.id : null,
      isHighAlert: d.high, witnessedBy: d.high && st === 'given' ? head.id : null
    });
  }
});

ensure('io_records', 10, () => {
  for (let i = 0; i < 20; i++) {
    const p = P[i % P.length];
    store.put('io_records', {
      id: store.uid('io'), patientId: p.id, wardCode: p.ward,
      type: i % 2 === 0 ? 'intake' : 'output',
      subtype: i % 2 === 0 ? 'iv_fluid' : 'urine',
      volume: 100 + (i * 37) % 400, recordedAt: hours(24 - i),
      recordedBy: nurse.id, notes: ''
    });
  }
});

// ═══ emergency ═══
ensure('ed_visits', 4, () => {
  const V = [
    { name:'علی اکبری', age:55, complaint:'درد قفسه سینه', esi:2, status:'waiting_doctor' },
    { name:'فاطمه رحیمی', age:72, complaint:'تنگی نفس', esi:2, status:'waiting_doctor' },
    { name:'حسین محمودی', age:28, complaint:'پارگی دست', esi:4, status:'waiting_triage' },
    { name:'زینب کریمی', age:35, complaint:'سرگیجه', esi:3, status:'boarding' },
    { name:'محمدرضا نوری', age:8, complaint:'تب', esi:3, status:'waiting_doctor' }
  ];
  V.forEach((v, i) => {
    store.put('ed_visits', {
      id: store.uid('edv'), patientName: v.name, age: v.age, sex: 'unknown',
      arrivalAt: hours(6 - i * 0.8), arrivalMode: 'walk_in',
      chiefComplaint: v.complaint,
      vitals: { hr: 88 + i * 3, bp_sys: 130 - i * 2, bp_dia: 80, rr: 16 + i, temp: 37 + i * 0.2, spo2: 96 - i },
      esiLevel: v.esi, status: v.status
    });
  });
});

ensure('ed_codes', 1, () => {
  store.put('ed_codes', {
    id: store.uid('code'), code: '247', codeLabel: 'کد ۲۴۷ — STEMI',
    patientName: 'رضا نوری', activatedAt: days(3), closedAt: days(3),
    activatedBy: doctor.id, status: 'closed', outcome: 'success',
    steps: [{ name:'ECG', status:'completed' }, { name:'Troponin', status:'completed' }, { name:'CathLab', status:'completed' }]
  });
});

// ═══ workflow ═══
ensure('consults', 3, () => {
  const types = ['emergency','urgent','routine','routine','urgent'];
  const svc = ['قلب و عروق','عفونی','جراحی اعصاب','نفرولوژی','ریه'];
  const sts = ['requested','responded','approved','requested','responded'];
  for (let i = 0; i < 5; i++) {
    const p = P[i % P.length];
    const rec = {
      id: store.uid('cons'), patientId: p.id, patientName: p.name, wardCode: p.ward,
      bedNumber: p.bed, consultType: types[i], targetService: svc[i],
      question: 'ارزیابی و توصیه درمانی', isbar: {}, status: sts[i],
      requestedBy: doctor.id, requestedAt: hours(4 - i * 0.5), responseDueAt: hours(-1)
    };
    if (sts[i] !== 'requested') {
      rec.response = { answer: 'بررسی شد', recommendations: ['CBC'], followup: '۴۸ ساعت' };
      rec.respondedBy = admin.id; rec.respondedAt = hours(3 - i * 0.5);
    }
    if (sts[i] === 'approved') { rec.approvedBy = doctor.id; rec.approvedAt = hours(2); }
    store.put('consults', rec);
  }
});

ensure('transfers', 1, () => {
  const sts = ['requested','approved','completed'];
  for (let i = 0; i < 3; i++) {
    const p = P[i % P.length];
    store.put('transfers', {
      id: store.uid('trf'), patientId: p.id, patientName: p.name,
      fromWard: p.ward, fromBedId: null,
      toWard: p.ward === 'ICU' ? 'GEN' : 'ICU', toBedId: null,
      reason: 'انتقال درمانی', urgency: i === 0 ? 'urgent' : 'routine',
      status: sts[i], requestedBy: doctor.id, requestedAt: hours(8 - i * 2)
    });
  }
});

ensure('discharges', 1, () => {
  const sts = ['planned','approved','discharged'];
  for (let i = 0; i < 3; i++) {
    const p = P[i % P.length];
    const rec = {
      id: store.uid('dsc'), patientId: p.id, patientName: p.name, wardCode: p.ward,
      status: sts[i], plannedAt: hours(12 - i * 3), plannedBy: doctor.id,
      dischargeType: 'home'
    };
    if (i >= 1) {
      rec.summary = { finalDiagnosis: p.dx, medications: 'آسپرین', followupInstructions: 'کنترل ۱ هفته بعد' };
      rec.summaryBy = doctor.id; rec.summaryAt = hours(10 - i * 3);
    }
    if (i === 2) rec.dischargedAt = hours(2);
    store.put('discharges', rec);
  }
});

ensure('handovers', 1, () => {
  for (let i = 0; i < 2; i++) {
    store.put('handovers', {
      id: store.uid('hnd'), wardCode: ['ICU','ER'][i],
      shiftType: i === 0 ? 'morning' : 'evening', shiftDate: days(i),
      fromUser: nurse.id, fromUserName: nurse.name,
      toUser: head.id, toUserName: head.name,
      status: i === 0 ? 'signed' : 'received',
      signedAt: days(i), receivedAt: i === 1 ? days(i) : null,
      entries: P.slice(0, 3).map(p => ({
        patientName: p.name, bedNumber: p.bed, priority: 'medium',
        isbar: { situation: 'پایدار', background: p.dx, assessment: 'تحت درمان', recommendation: 'ادامه' }
      })),
      summary: 'بدون تغییر خاص'
    });
  }
});

// ═══ paraclinical ═══
ensure('labs', 4, () => {
  const panels = ['CBC','BMP','Troponin','Coagulation','ABG','Blood Culture'];
  const sts = ['ordered','collected','resulted','verified','resulted','verified'];
  for (let i = 0; i < 6; i++) {
    const p = P[i % P.length];
    const rec = {
      id: store.uid('lab'), patientId: p.id, patientName: p.name, wardCode: p.ward,
      panelCode: panels[i], panelName: panels[i], priority: i < 2 ? 'stat' : 'routine',
      status: sts[i], orderedBy: doctor.id, orderedAt: hours(12 - i),
      tests: [{ code:'WBC', critLow:4, critHigh:12 }, { code:'Hgb', critLow:7, critHigh:18 }],
      results: {}, criticalFlags: []
    };
    if (['collected','resulted','verified'].includes(rec.status)) {
      rec.collectedBy = nurse.id; rec.collectedAt = hours(10 - i);
    }
    if (['resulted','verified'].includes(rec.status)) {
      rec.resultedBy = admin.id; rec.resultedAt = hours(8 - i);
      rec.results = { WBC: 8.5, Hgb: 12.3 };
    }
    if (rec.status === 'verified') { rec.verifiedBy = admin.id; rec.verifiedAt = hours(6 - i); }
    store.put('labs', rec);
  }
});

ensure('radiology', 3, () => {
  const mods = ['CT','MRI','X-ray','US'], parts = ['Brain','Chest','Abdomen','Pelvis'];
  const sts = ['ordered','reported','verified','reported'];
  for (let i = 0; i < 4; i++) {
    const p = P[i % P.length];
    const rec = {
      id: store.uid('rad'), patientId: p.id, patientName: p.name, wardCode: p.ward,
      modality: mods[i], bodyPart: parts[i], indication: 'بررسی بالینی',
      priority: i < 2 ? 'stat' : 'routine', status: sts[i],
      orderedBy: doctor.id, orderedAt: hours(10 - i), criticalFlag: false
    };
    if (rec.status !== 'ordered') {
      rec.findings = 'یافته پاتولوژیک مشاهده نشد';
      rec.impression = 'طبیعی'; rec.reportedBy = admin.id; rec.reportedAt = hours(8 - i);
    }
    if (rec.status === 'verified') { rec.verifiedBy = doctor.id; rec.verifiedAt = hours(6 - i); }
    store.put('radiology', rec);
  }
});

ensure('blood_requests', 2, () => {
  const types = ['PRBC','FFP','Platelet'];
  const sts = ['requested','crossmatched','issued','transfused'];
  for (let i = 0; i < 4; i++) {
    const p = P[i % P.length];
    const rec = {
      id: store.uid('bl'), patientId: p.id, patientName: p.name, wardCode: p.ward,
      productType: types[i % 3], units: 2, priority: 'urgent', status: sts[i],
      requestedBy: doctor.id, requestedAt: hours(8 - i * 1.5)
    };
    if (i >= 1) { rec.crossmatch = { donor: 'O+', result: 'compatible', at: hours(7 - i) }; rec.crossmatchedBy = admin.id; rec.crossmatchedAt = hours(7 - i); }
    if (i >= 2) { rec.issuedBy = admin.id; rec.issuedAt = hours(5); }
    if (i >= 3) { rec.transfusedBy = nurse.id; rec.transfusedAt = hours(3); rec.secondChecker = head.id; }
    store.put('blood_requests', rec);
  }
});

ensure('dispenses', 2, () => {
  const sts = ['pending_verify','verified','dispensed'];
  for (let i = 0; i < 3; i++) {
    const p = P[i % P.length];
    store.put('dispenses', {
      id: store.uid('disp'), patientId: p.id, patientName: p.name, wardCode: p.ward,
      drugName: ['Aspirin','Meropenem','Atorvastatin'][i], dose: '1 tab', quantity: 30,
      status: sts[i], verifiedBy: i >= 1 ? admin.id : null, verifiedAt: i >= 1 ? hours(4) : null,
      dispensedBy: i >= 2 ? admin.id : null, dispensedAt: i >= 2 ? hours(2) : null
    });
  }
});

// ═══ safety ═══
ensure('sepsis', 3, () => {
  const sts = ['screening','suspected','confirmed','septic_shock'];
  for (let i = 0; i < 4; i++) {
    const p = P[i % P.length];
    store.put('sepsis', {
      id: store.uid('sep'), patientId: p.id, patientName: p.name, wardCode: p.ward,
      qsofa: { score: i >= 2 ? 2 : 1 }, lactate: i >= 2 ? 3.5 : null,
      infectionSource: i >= 2 ? 'ریه' : null, status: sts[i],
      screenedAt: hours(20 - i * 4), screenedBy: nurse.id,
      bundle: { startAt: hours(20 - i * 4), lactateMeasured: i >= 2, bloodCultures: i >= 2, antibiotics: i >= 2, fluids: i >= 2 }
    });
  }
});

ensure('infections', 3, () => {
  const types = ['CLABSI','VAP','CAUTI','SSI'], patho = ['Staph','Pseudomonas','E. coli','Klebsiella'];
  for (let i = 0; i < 4; i++) {
    const p = P[i % P.length];
    store.put('infections', {
      id: store.uid('inf'), patientId: p.id, patientName: p.name, wardCode: p.ward,
      type: types[i], pathogen: patho[i], cultureConfirmed: true, status: 'confirmed',
      reportedBy: nurse.id, reportedAt: hours(36 - i * 6)
    });
  }
});

ensure('isolations', 2, () => {
  const types = ['airborne','contact','droplet'];
  for (let i = 0; i < 3; i++) {
    const p = P[i % P.length];
    store.put('isolations', {
      id: store.uid('iso'), patientId: p.id, patientName: p.name,
      wardCode: p.ward, bedNumber: p.bed, type: types[i], reason: 'پیشگیری',
      requiresNegativePressure: types[i] === 'airborne',
      negativePressureVerified: types[i] === 'airborne',
      status: 'active', startedBy: nurse.id, startedAt: hours(48 - i * 12)
    });
  }
});

ensure('incidents', 3, () => {
  const cats = ['medication','fall','equipment','infection'], sevs = ['near_miss','mild_harm','moderate_harm','severe_harm'];
  for (let i = 0; i < 4; i++) {
    const p = P[i % P.length];
    store.put('incidents', {
      id: store.uid('inc'), category: cats[i], severity: sevs[i], severityWeight: i + 1,
      requiresRca: i >= 2, description: 'شرح حادثه — ' + cats[i],
      patientId: p.id, patientName: p.name, wardCode: p.ward,
      occurredAt: hours(48 - i * 6), reportedAt: hours(46 - i * 6),
      reportedBy: nurse.id, reportedByName: nurse.name, immediateAction: 'اقدام فوری',
      status: i < 2 ? 'reported' : 'closed',
      closedAt: i >= 2 ? hours(24 - i * 6) : null,
      closedBy: i >= 2 ? admin.id : null,
      closureNotes: i >= 2 ? 'بررسی انجام شد' : null
    });
  }
});

ensure('risks', 3, () => {
  const titles = ['خطر سقوط','خطر عفونت','خطر دارویی','خطر تجهیزات'];
  for (let i = 0; i < 4; i++) {
    const like = 3 + i, sev = 3 + i, score = like * sev;
    store.put('risks', {
      id: store.uid('rsk'), title: titles[i], description: 'شرح خطر', category: 'clinical',
      wardCode: P[i % P.length].ward, likelihood: like, severity: sev, riskScore: score,
      level: score >= 15 ? 'extreme' : score >= 9 ? 'high' : 'medium',
      status: 'open', identifiedBy: nurse.id, identifiedAt: hours(72 - i * 12),
      mitigations: []
    });
  }
});

// ═══ surgical ═══
ensure('or_schedule', 3, () => {
  const emg = rooms.filter(r => r.group === 'EMG');
  const gen = rooms.filter(r => r.group === 'GEN');
  const procs = ['Appendectomy','Cholecystectomy','CABG','Craniotomy','Hernia repair','Laparotomy'];
  for (let i = 0; i < 6; i++) {
    const p = P[i % P.length];
    const room = i < 3 ? (emg[i % emg.length] || gen[0]) : (gen[i % gen.length] || emg[0]);
    if (!room) continue;
    const st = i < 2 ? 'scheduled' : i === 2 ? 'in_progress' : 'completed';
    store.put('or_schedule', {
      id: store.uid('ors'), patientId: p.id, patientName: p.name, wardCode: p.ward,
      roomId: room.id, roomCode: room.code, procedure: procs[i], specialty: 'general',
      surgeon: doctor.id, anesthesiologist: null, scheduledDate: today(),
      scheduledStart: hours(6 - i * 0.8), estimatedDurationMin: 90,
      priority: i < 3 ? 'emergency' : 'elective', status: st,
      actualStart: st !== 'scheduled' ? hours(5 - i * 0.8) : null,
      actualEnd: st === 'completed' ? hours(3 - i * 0.8) : null,
      checklist: {
        signIn: st !== 'scheduled' ? { signedBy: nurse.id, signedAt: hours(6) } : null,
        timeOut: st !== 'scheduled' ? { signedBy: nurse.id, signedAt: hours(5.5) } : null,
        signOut: st === 'completed' ? { signedBy: nurse.id, signedAt: hours(3) } : null
      },
      createdAt: hours(24)
    });
  }
});

ensure('or_pacu', 1, () => {
  const completed = store.readAll('or_schedule').filter(s => s.status === 'completed');
  for (let i = 0; i < Math.min(2, completed.length); i++) {
    const c = completed[i];
    store.put('or_pacu', {
      id: store.uid('pacu'), caseId: c.id, patientId: c.patientId, patientName: c.patientName,
      admittedAt: hours(2 + i * 0.5), aldreteScore: 9,
      status: i === 0 ? 'active' : 'discharged',
      dischargedAt: i === 1 ? hours(1) : null, nurse: nurse.id
    });
  }
});

ensure('cssd_sets', 5, () => {
  const names = ['ست لاپاراتومی','ست آپاندکتومی','ست عمومی','ست چست تیوب','ست کاتتر'];
  const depts = ['اتاق عمل جنرال','اتاق عمل اورژانس','CSR','اتاق عمل جنرال','CSR'];
  for (let i = 0; i < 8; i++) {
    store.put('cssd_sets', {
      id: store.uid('set'), setName: names[i % names.length], department: depts[i % depts.length],
      itemCount: 8 + i, indicatorClass: 4, method: 'steam',
      status: i < 3 ? 'prepared' : i < 5 ? 'sterilized' : i < 6 ? 'issued' : 'prepared',
      cycleId: null, label: null, preparedBy: admin.id,
      preparedAt: hours(48 - i * 4), createdAt: hours(48 - i * 4)
    });
  }
});

ensure('cssd_cycles', 1, () => {
  const sets = store.readAll('cssd_sets').filter(s => ['sterilized','issued'].includes(s.status));
  if (!sets.length) return;
  store.put('cssd_cycles', {
    id: store.uid('cyc'), cycleNumber: 'C-001', sterilizerCode: 'AUT-01', method: 'steam',
    setIds: sets.slice(0, 2).map(s => s.id), status: 'closed',
    loadedBy: admin.id, loadedByName: admin.username,
    startedAt: hours(24), closedAt: hours(22),
    indicators: { biological: 'pass', chemical: 'pass' }, createdAt: hours(24)
  });
});

// ═══ ops ═══
ensure('karanneh_periods', 1, () => {
  const kp = store.uid('kper');
  store.put('karanneh_periods', {
    id: kp, year: 1403, month: 7, status: 'calculated',
    totalRevenue: 50000000, totalPoints: 0, valuePerPoint: 0,
    calculatedAt: days(30), calculatedBy: admin.id, createdAt: days(60)
  });
  for (let i = 0; i < 10; i++) {
    store.put('karanneh_calcs', {
      id: store.uid('kcal'), periodId: kp,
      staffId: S[i % S.length].id, staffName: S[i % S.length].name,
      wardCode: S[i % S.length].ward, hours: 150 + i * 3, points: 150 + i * 3
    });
  }
});

ensure('rosters', 2, () => {
  for (let i = 0; i < 3; i++) {
    store.put('rosters', {
      id: store.uid('ros'), wardCode: ['ICU','ER','GEN'][i],
      month: '1403/07', assignments: {}, status: i === 0 ? 'approved' : 'draft',
      createdBy: head.id, approvedBy: i === 0 ? admin.id : null,
      approvedAt: i === 0 ? days(5) : null, createdAt: days(10)
    });
  }
});

// ═══ education ═══
ensure('learning_objects', 3, () => {
  const objs = [
    ['اصول شستشوی دست', 'infection_control'],
    ['مدیریت راه هوایی', 'clinical'],
    ['شناسایی سپسیس', 'clinical'],
    ['ارتباط با بیمار', 'communication'],
    ['ایمنی دارویی', 'safety']
  ];
  objs.forEach(([title, cat], i) => {
    store.put('learning_objects', {
      id: store.uid('lo'), title, type: 'article', category: cat,
      body: 'متن آموزشی درباره ' + title, targetRoles: ['all'],
      status: 'published', createdBy: admin.id, createdByName: admin.username,
      createdAt: days(30 - i * 5)
    });
  });
});

ensure('questions', 10, () => {
  const QS = [
    { stem: 'کدام مورد نشانه سپسیس است؟', options: ['تب','qSOFA ≥ 2','سردرد','خستگی'], correct: 'qSOFA ≥ 2' },
    { stem: 'شستشوی دست قبل از پوشیدن دستکش الزامی است', options: ['صحیح','غلط'], correct: 'صحیح' },
    { stem: 'دوز استاندارد آسپرین در ACS؟', options: ['81mg','325mg','500mg','1000mg'], correct: '325mg' },
    { stem: 'اولین اقدام در کد ۹۹؟', options: ['CPR','اینتیوباسیون','شوک','دارو'], correct: 'CPR' },
    { stem: 'شکستگی گردن فمور در سالمند نیاز به جراحی دارد', options: ['صحیح','غلط'], correct: 'صحیح' }
  ];
  for (let i = 0; i < 10; i++) {
    const q = QS[i % QS.length];
    store.put('questions', {
      id: store.uid('q'), type: q.options.length === 2 ? 'true_false' : 'mcq_single',
      stem: q.stem, category: 'clinical', difficulty: 'medium',
      options: q.options, correctAnswer: q.correct, correctAnswers: [],
      points: 1, explanation: 'توضیح', createdBy: admin.id, createdAt: days(20 - i)
    });
  }
});

ensure('exams', 2, () => {
  const qs = store.readAll('questions');
  for (let i = 0; i < 3; i++) {
    store.put('exams', {
      id: store.uid('exm'),
      title: ['آزمون ایمنی بیمار','آزمون سپسیس','آزمون مراقبت ICU'][i],
      description: 'آزمون دوره‌ای', category: 'clinical',
      questions: qs.slice(i * 3, i * 3 + 3),
      totalPoints: 3, passingScore: 60, timeLimitMinutes: 15, attemptsAllowed: 2,
      status: i === 0 ? 'published' : 'draft',
      publishedAt: i === 0 ? days(5) : null,
      createdBy: admin.id, createdAt: days(15)
    });
  }
});

ensure('edu_cases', 2, () => {
  const CS = [
    ['بیمار با درد قفسه سینه','درد قفسه سینه از ۲ ساعت پیش','STEMI'],
    ['بیمار با تنگی نفس','تنگی نفس پیش‌رونده','CHF'],
    ['بیمار با تب و لرز','تب و لرز ۳ روزه','پیلونفریت']
  ];
  CS.forEach(([title, cc, dx]) => {
    store.put('edu_cases', {
      id: store.uid('cs'), title, chiefComplaint: cc,
      history: 'سابقه بیماری زمینه‌ای', physicalExam: 'معاینه بالینی',
      differentials: ['ACS','PE','پنوموتوراکس'], correctDiagnosis: dx,
      discussion: 'بحث آموزشی', status: 'draft',
      createdBy: admin.id, createdAt: days(20)
    });
  });
});

ensure('edu_assignments', 2, () => {
  const exams = store.readAll('exams');
  for (let i = 0; i < Math.min(3, exams.length); i++) {
    store.put('edu_assignments', {
      id: store.uid('asg'), type: 'exam', refId: exams[i].id, refTitle: exams[i].title,
      targetRoles: ['nurse','head_nurse'], dueAt: days(-5), isMandatory: true,
      status: 'assigned', createdBy: admin.id, createdAt: days(5)
    });
  }
});

// ═══ quality ═══
ensure('kpis', 3, () => {
  const KP = [
    ['نرخ عفونت CLABSI','infection','/1000 روز',2],
    ['رضایت بیمار','satisfaction','%',90],
    ['نرخ سقوط','safety','/1000 روز',1],
    ['مرگ و میر ICU','outcome','%',15],
    ['زمان انتظار ED','process','دقیقه',30]
  ];
  KP.forEach(([name, cat, unit, target]) => {
    store.put('kpis', {
      id: store.uid('kpi'), name, category: cat, unit, target,
      direction: 'lower', frequency: 'monthly',
      measurements: [
        { value: target + 0.5, at: days(30), by: admin.id },
        { value: target + 0.2, at: days(15), by: admin.id },
        { value: target, at: days(1), by: admin.id }
      ],
      createdBy: admin.id, createdAt: days(60)
    });
  });
});

ensure('pdsa_cycles', 1, () => {
  for (let i = 0; i < 2; i++) {
    store.put('pdsa_cycles', {
      id: store.uid('pdsa'), title: 'کاهش عفونت ' + ['CLABSI','CAUTI'][i],
      problem: 'نرخ بالاتر از هدف', aim: 'کاهش ۵۰٪ در ۶ ماه',
      wardCode: 'ICU', phase: ['do','study'][i], status: 'active',
      owner: admin.id,
      phases: {
        plan: { startedAt: days(60), notes: 'طرح اولیه' },
        do: { startedAt: days(30), notes: 'اجرا' },
        study: { startedAt: days(10), notes: 'بررسی' },
        act: { startedAt: null, notes: '' }
      },
      createdAt: days(60)
    });
  }
});

ensure('rca_reports', 1, () => {
  const incidents = store.readAll('incidents');
  for (let i = 0; i < Math.min(2, incidents.length); i++) {
    store.put('rca_reports', {
      id: store.uid('rca'), incidentId: incidents[i].id,
      incidentSummary: incidents[i].description, severity: incidents[i].severity,
      wardCode: incidents[i].wardCode, status: i === 0 ? 'completed' : 'opened',
      openedAt: days(5), openedBy: admin.id,
      rootCauses: i === 0 ? [{ cause:'نقص آموزش', category:'human' }] : [],
      recommendations: i === 0 ? [{ action:'آموزش مجدد', owner: admin.id }] : [],
      completedAt: i === 0 ? days(2) : null
    });
  }
});

ensure('clinical_audits', 1, () => {
  store.put('clinical_audits', {
    id: store.uid('aud'), title: 'ممیزی شستشوی دست', topic: 'infection_control',
    wardCode: 'ICU',
    criteria: ['قبل از تماس','بعد از تماس','قبل از اقدام آسپتیک'],
    sampleSize: 20, scheduledAt: days(10), status: 'completed',
    results: [{ patientId: null, met: ['قبل از تماس'], at: days(5) }],
    score: 33, auditor: admin.id, createdAt: days(15)
  });
});

ensure('satisfaction', 3, () => {
  for (let i = 0; i < 5; i++) {
    store.put('satisfaction', {
      id: store.uid('sat'), patientId: P[i % P.length].id,
      wardCode: P[i % P.length].ward, overallScore: 4 + (i % 2),
      comment: 'رضایت کلی', collectedBy: nurse.id, collectedAt: days(i)
    });
  }
});

// ═══ rights ═══
ensure('patient_consents', 3, () => {
  const types = ['surgery','anesthesia','blood','admission'];
  for (let i = 0; i < 4; i++) {
    const p = P[i % P.length], signed = i >= 2;
    store.put('patient_consents', {
      id: store.uid('cons'), patientId: p.id, patientName: p.name, wardCode: p.ward,
      consentType: types[i], procedure: 'جراحی برنامه‌ریزی‌شده',
      status: signed ? 'signed' : 'pending_signature',
      validUntil: days(-30), createdBy: doctor.id, createdAt: hours(20 - i * 3),
      signedBy: signed ? p.id : null, signedAt: signed ? hours(18 - i * 3) : null
    });
  }
});

ensure('patient_complaints', 2, () => {
  const cats = ['service','staff','privacy','billing'];
  for (let i = 0; i < 3; i++) {
    const p = P[i % P.length];
    store.put('patient_complaints', {
      id: store.uid('cmp'), patientName: p.name, patientId: p.id, wardCode: p.ward,
      category: cats[i], description: 'شرح شکایت', anonymous: false,
      status: i === 0 ? 'resolved' : 'open',
      resolution: i === 0 ? 'بررسی و حل شد' : null,
      filedBy: nurse.id, filedAt: hours(48 - i * 12),
      resolvedAt: i === 0 ? hours(36) : null, resolvedBy: i === 0 ? admin.id : null
    });
  }
});

ensure('privacy_checks', 2, () => {
  for (let i = 0; i < 3; i++) {
    store.put('privacy_checks', {
      id: store.uid('priv'), wardCode: P[i % P.length].ward,
      score: 80 + i * 5, status: i === 2 ? 'compliant' : 'partial',
      checkedBy: nurse.id, checkedAt: days(i), notes: ''
    });
  }
});

ensure('patient_education', 2, () => {
  for (let i = 0; i < 3; i++) {
    const p = P[i % P.length];
    store.put('patient_education', {
      id: store.uid('edu'), patientId: p.id, patientName: p.name, wardCode: p.ward,
      topics: ['دارو','تغذیه','فعالیت'], teachBack: true,
      educatedBy: nurse.id, educatedAt: days(i)
    });
  }
});

// ═══ advanced_hr ═══
ensure('coefficients', 2, () => {
  const kp = store.readAll('karanneh_periods')[0];
  if (!kp) return;
  for (let i = 0; i < 5; i++) {
    store.put('coefficients', {
      id: store.uid('coef'), staffId: S[i % S.length].id, periodId: kp.id,
      qualityFactor: 1.0 + (i * 0.05), attendanceFactor: 1.0 + (i * 0.02),
      wardDifficulty: 1.0, status: i < 3 ? 'approved' : 'draft',
      createdBy: admin.id, createdAt: days(5)
    });
  }
});

ensure('appeals', 2, () => {
  for (let i = 0; i < 3; i++) {
    store.put('appeals', {
      id: store.uid('apl'),
      subject: ['اعتراض کارانه','درخواست شیفت','شکایت شرایط'][i],
      description: 'شرح اعتراض', privacy: 'normal', category: 'payroll',
      submittedBy: S[i % S.length].id, submittedByName: S[i % S.length].name,
      status: i === 0 ? 'accepted' : 'open', slaHours: 48, dueAt: days(-2),
      createdAt: hours(24 - i * 6),
      reviewedBy: i === 0 ? admin.id : null, reviewedAt: i === 0 ? hours(12) : null,
      reviewNotes: i === 0 ? 'پذیرفته شد' : null
    });
  }
});

ensure('extra_services', 3, () => {
  const titles = ['همراهی بیمار','کمک آموزش','پشتیبانی شب','پوشش مرخصی','کمک تجهیزات'];
  for (let i = 0; i < 5; i++) {
    store.put('extra_services', {
      id: store.uid('xsvc'), title: titles[i], description: 'شرح خدمت',
      category: 'clinical', difficulty: 1.5, urgency: 1.5,
      wardCode: S[i % S.length].ward,
      status: i < 2 ? 'published' : i < 4 ? 'claimed' : 'completed',
      claimedBy: i >= 2 ? S[i % S.length].id : null,
      claimedByName: i >= 2 ? S[i % S.length].name : null,
      claimedAt: i >= 2 ? hours(12) : null,
      completedAt: i === 4 ? hours(4) : null,
      coefficient: i === 4 ? 2.25 : null,
      createdBy: head.id, createdAt: hours(48 - i * 8)
    });
  }
});

// ═══ crisis (historical) ═══
ensure('crisis_sessions', 1, () => {
  store.put('crisis_sessions', {
    id: store.uid('crz'), crisisType: 'earthquake', crisisLabel: 'زلزله', icon: '🏔️',
    phase: 'recovery', reason: 'تمرین سالانه', location: 'تهران',
    estimatedCasualties: 50,
    activatedBy: admin.id, activatedByName: admin.username,
    activatedAt: days(60), deactivatedAt: days(59), deactivatedBy: admin.id,
    status: 'closed', createdAt: days(60)
  });
});

console.log('\n═══ تمام ═══\n');
