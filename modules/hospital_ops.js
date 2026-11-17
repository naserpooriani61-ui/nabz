'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Hospital Operations
//  مدیریت جامع ساختار بیمارستان:
//  بخش‌ها، تخت‌ها، سطح‌بندی بیماران، تخصیص پرستار
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const bus = require('../core/events');

// ─── WARD TYPES ───
const WARD_TYPES = [
  { code:'icu', label:'ICU', icon:'💔', bedsDefault:10, group:'critical', hasMonitor:true, hasVentilator:true, nurseRatio:2, config:['ventilator','central_line','infusion_pump'] },
  { code:'ccu', label:'CCU', icon:'🫀', bedsDefault:10, group:'critical', hasMonitor:true, hasVentilator:true, nurseRatio:2, config:['ecg_monitor','defibrillator'] },
  { code:'nicu', label:'NICU', icon:'👶', bedsDefault:8, group:'critical', hasMonitor:true, hasVentilator:true, nurseRatio:2, config:['incubator','phototherapy'] },
  { code:'picu', label:'PICU', icon:'🧒', bedsDefault:6, group:'critical', hasMonitor:true, hasVentilator:true, nurseRatio:2, config:['pediatric_ventilator'] },
  { code:'ward', label:'بخش بستری', icon:'🏥', bedsDefault:20, group:'internal', hasMonitor:false, hasVentilator:false, nurseRatio:5, config:['iv_pole'] },
  { code:'surgical', label:'بخش جراحی', icon:'🔪', bedsDefault:20, group:'surgical', hasMonitor:false, hasVentilator:false, nurseRatio:5, config:['iv_pole','dressing_cart'] },
  { code:'ortho', label:'ارتوپدی', icon:'🦴', bedsDefault:18, group:'surgical', hasMonitor:false, hasVentilator:false, nurseRatio:5, config:['traction','cast_cart'] },
  { code:'neuro', label:'نورولوژی', icon:'🧠', bedsDefault:16, group:'neuro', hasMonitor:false, hasVentilator:false, nurseRatio:4, config:['iv_pole'] },
  { code:'onco', label:'آنکولوژی', icon:'🎗️', bedsDefault:14, group:'oncology', hasMonitor:false, hasVentilator:false, nurseRatio:4, config:['chemo_hood','iv_pole'] },
  { code:'emergency', label:'اورژانس', icon:'🚨', bedsDefault:20, group:'emergency', hasMonitor:true, hasVentilator:false, nurseRatio:3, config:['crash_cart','defibrillator','triage'] },
  { code:'or', label:'اتاق عمل', icon:'🏥', bedsDefault:1, group:'surgical', hasMonitor:true, hasVentilator:true, nurseRatio:1, config:['anesthesia_machine','electrocautery'] },
  { code:'pacu', label:'PACU', icon:'🛏️', bedsDefault:6, group:'surgical', hasMonitor:true, hasVentilator:false, nurseRatio:2, config:['ecg_monitor','o2_supply'] },
  { code:'dialysis', label:'دیالیز', icon:'💧', bedsDefault:8, group:'special', hasMonitor:true, hasVentilator:false, nurseRatio:2, config:['dialysis_machine'] },
  { code:'cathlab', label:'کت لب', icon:'💗', bedsDefault:2, group:'special', hasMonitor:true, hasVentilator:false, nurseRatio:2, config:['angiography','cath_lab_monitor'] },
  { code:'clinic', label:'درمانگاه', icon:'🏥', bedsDefault:4, group:'special', hasMonitor:false, hasVentilator:false, nurseRatio:8, config:['exam_bed'] },
  { code:'vip', label:'VIP', icon:'⭐', bedsDefault:8, group:'vip', hasMonitor:true, hasVentilator:false, nurseRatio:2, config:['private_room','bathroom'] },
  { code:'isolation', label:'ایزولاسیون', icon:'🧼', bedsDefault:4, group:'special', hasMonitor:true, hasVentilator:false, nurseRatio:2, config:['negative_pressure','anteroom'] }
];

// ─── ACUITY LEVELS ───
const ACUITY_LEVELS = [
  { code:1, label:'سطح ۱ — بحرانی', color:'dng', icon:'🔴', description:'نیاز به مراقبت ۱:۱، ونتيلاتور، وازوپرسور', nurseRatio:1 },
  { code:2, label:'سطح ۲ — شدید', color:'dng', icon:'🟠', description:'پایش مداوم، اکسیژن، IV مداوم', nurseRatio:2 },
  { code:3, label:'سطح ۳ — متوسط', color:'warn', icon:'🟡', description:'مراقبت معمول، پایش دوره‌ای', nurseRatio:3 },
  { code:4, label:'سطح ۴ — خفیف', color:'ok', icon:'🟢', description:'نیمه مستقل، آموزش، آماده ترخیص', nurseRatio:5 },
  { code:5, label:'سطح ۵ — سرپایی', color:'ok', icon:'⚪', description:'بدون نیاز به بستری', nurseRatio:10 }
];

// ─── SHIFT TEMPLATES ───
const SHIFT_TEMPLATES = {
  morning: { label:'صبح', hours:'07:00-14:00', medRounds:['08:00','12:00'], vitalRounds:['06:00','10:00','14:00'], doctorRound:'08:30', assessment:['07:00','13:00'] },
  evening: { label:'عصر', hours:'14:00-19:00', medRounds:['14:00','18:00'], vitalRounds:['14:00','18:00','22:00'], doctorRound:'17:00', assessment:['14:00','18:30'] },
  night:   { label:'شب', hours:'19:00-07:00', medRounds:['20:00','00:00','06:00'], vitalRounds:['22:00','02:00','06:00'], doctorRound:'23:00', assessment:['20:00','06:00'] }
};

// ═══════════════════════════════════════════════════════════
//  WARDS — CRUD
// ═══════════════════════════════════════════════════════════
function listWards(ctx) {
  let items = h(ctx, 'hospital_wards');
  if (!items.length) {
    // fallback: map from sa_wards
    items = h(ctx, 'sa_wards').map(w => ({
      id: w.id, code: w.code, label: w.label,
      type: w.code.indexOf('ICU') === 0 ? 'icu' : 'ward',
      group: 'internal', bedsPlanned: w.wk || 0,
      headNurseId: w.headStaffId, headNurseName: w.headNurse || null,
      isActive: true, isManagement: w.isManagement,
      createdAt: w.createdAt
    }));
  }
  if (ctx.query.group) items = items.filter(w => w.group === ctx.query.group);
  if (ctx.query.active === 'true') items = items.filter(w => w.isActive);
  items.sort((a, b) => (a.group || '').localeCompare(b.group || '') || (a.label || '').localeCompare(b.label || ''));
  return { items, total: items.length };
}

function createWard(ctx) {
  const b = ctx.body;
  if (!b.label) throw ctx.E.badRequest('label_required');
  const rec = {
    id: ctx.uid('wrd'),
    code: b.code || ('WARD_' + Date.now().toString(36).toUpperCase()),
    label: b.label,
    type: b.type || 'ward',
    group: b.group || 'internal',
    floor: b.floor || '',
    bedsPlanned: Number(b.bedsPlanned) || 20,
    headNurseId: b.headNurseId || null,
    headNurseName: b.headNurseName || null,
    isActive: b.isActive !== false,
    isManagement: false,
    capabilities: Array.isArray(b.capabilities) ? b.capabilities : [],
    notes: b.notes || '',
    createdBy: ctx.actor.id,
    createdAt: ctx.now(), updatedAt: ctx.now()
  };
  ctx.store.put('hospital_wards', rec);
  bus.emit('hospital.ward.created', { record: rec, actor: ctx.actor });
  return rec;
}

function updateWard(ctx) {
  const w = ctx.store.get('hospital_wards', ctx.params.id);
  if (!w) throw ctx.E.notFound('ward_not_found');
  const b = ctx.body;
  ['label','type','group','floor','bedsPlanned','headNurseId','headNurseName','isActive','capabilities','notes','code']
    .forEach(k => { if (b[k] !== undefined) w[k] = k === 'bedsPlanned' ? Number(b[k]) : b[k]; });
  w.updatedAt = ctx.now();
  ctx.store.put('hospital_wards', w);
  bus.emit('hospital.ward.updated', { record: w, actor: ctx.actor });
  return w;
}

function deleteWard(ctx) {
  const w = ctx.store.get('hospital_wards', ctx.params.id);
  if (!w) throw ctx.E.notFound('ward_not_found');
  // Check for beds
  const beds = h(ctx, 'beds').filter(b => b.wardCode === w.code);
  if (beds.length) throw ctx.E.conflict('ward_has_beds — ابتدا تخت‌ها را حذف کنید');
  // Check for active patients
  const patients = h(ctx, 'patients').filter(p => p.wardCode === w.code && ['in_care','admitted'].includes(p.status));
  if (patients.length) throw ctx.E.conflict('ward_has_patients');
  ctx.store.remove('hospital_wards', w.id);
  bus.emit('hospital.ward.deleted', { record: w, actor: ctx.actor });
  return { deleted: true, id: w.id };
}

// ═══════════════════════════════════════════════════════════
//  BEDS — CRUD + bulk create
// ═══════════════════════════════════════════════════════════
function listBeds(ctx) {
  let items = h(ctx, 'beds');
  if (ctx.query.wardCode) items = items.filter(b => b.wardCode === ctx.query.wardCode);
  if (ctx.query.status) items = items.filter(b => b.status === ctx.query.status);
  items.sort((a, b) => (a.bedNumber || '').localeCompare(b.bedNumber || ''));
  return { items, total: items.length };
}

function bulkCreateBeds(ctx) {
  const b = ctx.body;
  if (!b.wardCode) throw ctx.E.badRequest('wardCode_required');
  const count = Number(b.count) || 0;
  if (count < 1 || count > 200) throw ctx.E.badRequest('count_1_to_200');
  const prefix = b.prefix || (b.wardCode + '-');
  const startAt = Number(b.startAt) || 1;
  const type = b.type || 'regular';
  const isCritical = !!b.isCritical;
  const existing = h(ctx, 'beds').filter(x => x.wardCode === b.wardCode);
  const existingNums = new Set(existing.map(x => x.bedNumber));
  let created = 0;
  for (let i = 0; i < count; i++) {
    const num = String(startAt + i).padStart(2, '0');
    const bedNum = prefix + num;
    if (existingNums.has(bedNum)) continue;
    ctx.store.put('beds', {
      id: 'bed_' + b.wardCode + '_' + num,
      wardCode: b.wardCode, wardLabel: b.wardLabel || null,
      bedNumber: bedNum, status: 'available', patientId: null,
      isCritical: isCritical, type: type,
      hasO2: b.hasO2 !== false, hasSuction: !!b.hasSuction, hasMonitor: !!b.hasMonitor,
      isIsolation: type === 'isolation', isNegativePressure: b.isNegativePressure === true,
      createdAt: ctx.now()
    });
    created++;
  }
  bus.emit('hospital.beds.created', { wardCode: b.wardCode, count: created, actor: ctx.actor });
  return { created, wardCode: b.wardCode, startAt: startAt + created };
}

function updateBed(ctx) {
  const b = ctx.store.get('beds', ctx.params.id);
  if (!b) throw ctx.E.notFound('bed_not_found');
  const body = ctx.body;
  ['status','isCritical','type','hasO2','hasSuction','hasMonitor','isIsolation','isNegativePressure']
    .forEach(k => { if (body[k] !== undefined) b[k] = body[k]; });
  b.updatedAt = ctx.now();
  ctx.store.put('beds', b);
  bus.emit('hospital.bed.updated', { record: b, actor: ctx.actor });
  return b;
}

function deleteBed(ctx) {
  const b = ctx.store.get('beds', ctx.params.id);
  if (!b) throw ctx.E.notFound('bed_not_found');
  if (b.patientId) throw ctx.E.conflict('bed_occupied');
  ctx.store.remove('beds', b.id);
  return { deleted: true, id: b.id };
}

// ═══════════════════════════════════════════════════════════
//  ACUITY — patient level 1-5
// ═══════════════════════════════════════════════════════════
function getAcuity(ctx) {
  const pid = ctx.params.patientId;
  const p = ctx.store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const rec = h(ctx, 'patient_acuity').find(a => a.patientId === pid);
  return rec || { patientId: pid, level: null, message: 'not_assessed' };
}

function setAcuity(ctx) {
  const pid = ctx.body.patientId;
  if (!pid) throw ctx.E.badRequest('patient_required');
  const p = ctx.store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const level = Number(ctx.body.level);
  if (!level || level < 1 || level > 5) throw ctx.E.badRequest('level_1_to_5');
  let rec = h(ctx, 'patient_acuity').find(a => a.patientId === pid);
  if (rec) {
    rec.level = level;
    rec.assessedAt = ctx.now();
    rec.assessedBy = ctx.actor.id;
    rec.assessedByName = ctx.actor.fullName || ctx.actor.username;
  } else {
    rec = {
      id: ctx.uid('acu'),
      patientId: pid, patientName: p.firstName + ' ' + p.lastName,
      level: level, assessedAt: ctx.now(), assessedBy: ctx.actor.id,
      assessedByName: ctx.actor.fullName || ctx.actor.username,
      createdAt: ctx.now()
    };
  }
  ctx.store.put('patient_acuity', rec);
  bus.emit('hospital.acuity.set', { record: rec, actor: ctx.actor });
  return rec;
}

function listAcuity(ctx) {
  let items = h(ctx, 'patient_acuity');
  const patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  const patMap = {};
  patients.forEach(p => patMap[p.id] = p);
  items = items.filter(a => patMap[a.patientId]);
  // Also check for patients without acuity
  const assessed = new Set(items.map(a => a.patientId));
  const unassessed = patients.filter(p => !assessed.has(p.id));
  return { items, total: items.length, unassessed: unassessed.length };
}

// ═══════════════════════════════════════════════════════════
//  NURSE ASSIGNMENTS
// ═══════════════════════════════════════════════════════════
function listAssignments(ctx) {
  let items = h(ctx, 'nurse_assignments');
  if (ctx.query.wardCode) items = items.filter(a => a.wardCode === ctx.query.wardCode);
  if (ctx.query.date) items = items.filter(a => a.date === ctx.query.date);
  if (ctx.query.shiftType) items = items.filter(a => a.shiftType === ctx.query.shiftType);
  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { items, total: items.length };
}

function createAssignment(ctx) {
  const b = ctx.body;
  if (!b.wardCode || !b.nurseId || !b.date) throw ctx.E.badRequest('missing');
  const staff = h(ctx, 'sa_staff').find(s => s.id === b.nurseId);
  if (!staff) throw ctx.E.notFound('staff_not_found');
  const existing = h(ctx, 'nurse_assignments').find(a =>
    a.wardCode === b.wardCode && a.nurseId === b.nurseId && a.date === b.date && a.shiftType === (b.shiftType || 'morning'));
  if (existing) throw ctx.E.conflict('already_assigned');
  const rec = {
    id: ctx.uid('nasg'),
    wardCode: b.wardCode,
    nurseId: b.nurseId,
    nurseName: staff.name,
    nurseCategory: staff.category,
    date: b.date, shiftType: b.shiftType || 'morning',
    patientIds: Array.isArray(b.patientIds) ? b.patientIds : [],
    role: b.role || 'primary',   // primary | team_lead | charge
    maxPatients: Number(b.maxPatients) || 6,
    status: 'active',
    createdBy: ctx.actor.id, createdAt: ctx.now()
  };
  ctx.store.put('nurse_assignments', rec);
  bus.emit('hospital.assignment.created', { record: rec, actor: ctx.actor });
  return rec;
}

function updateAssignment(ctx) {
  const a = ctx.store.get('nurse_assignments', ctx.params.id);
  if (!a) throw ctx.E.notFound('assignment_not_found');
  const b = ctx.body;
  if (Array.isArray(b.patientIds)) a.patientIds = b.patientIds;
  if (b.role) a.role = b.role;
  if (b.maxPatients !== undefined) a.maxPatients = Number(b.maxPatients);
  if (b.status) a.status = b.status;
  a.updatedAt = ctx.now();
  ctx.store.put('nurse_assignments', a);
  bus.emit('hospital.assignment.updated', { record: a, actor: ctx.actor });
  return a;
}

function assignPatientToNurse(ctx) {
  const a = ctx.store.get('nurse_assignments', ctx.params.id);
  if (!a) throw ctx.E.notFound('assignment_not_found');
  const pid = ctx.body.patientId;
  if (!pid) throw ctx.E.badRequest('patient_required');
  const p = ctx.store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  // Remove from other assignments same ward/date/shift
  const same = h(ctx, 'nurse_assignments').filter(x =>
    x.wardCode === a.wardCode && x.date === a.date && x.shiftType === a.shiftType && x.id !== a.id);
  for (const s of same) {
    if ((s.patientIds || []).indexOf(pid) >= 0) {
      s.patientIds = s.patientIds.filter(x => x !== pid);
      ctx.store.put('nurse_assignments', s);
    }
  }
  if (!a.patientIds) a.patientIds = [];
  if (a.patientIds.indexOf(pid) < 0) {
    if (a.patientIds.length >= a.maxPatients) throw ctx.E.conflict('max_patients_reached');
    a.patientIds.push(pid);
  }
  ctx.store.put('nurse_assignments', a);
  return a;
}

function removePatientFromNurse(ctx) {
  const a = ctx.store.get('nurse_assignments', ctx.params.id);
  if (!a) throw ctx.E.notFound('assignment_not_found');
  const pid = ctx.body.patientId;
  if (!pid) throw ctx.E.badRequest('patient_required');
  a.patientIds = (a.patientIds || []).filter(x => x !== pid);
  ctx.store.put('nurse_assignments', a);
  return a;
}

function deleteAssignment(ctx) {
  const a = ctx.store.get('nurse_assignments', ctx.params.id);
  if (!a) throw ctx.E.notFound('assignment_not_found');
  ctx.store.remove('nurse_assignments', a.id);
  return { deleted: true };
}

function wardSnapshot(ctx) {
  const code = ctx.query.wardCode;
  if (!code) throw ctx.E.badRequest('wardCode_required');
  const ward = h(ctx, 'hospital_wards').find(w => w.code === code) ||
               h(ctx, 'sa_wards').find(w => w.code === code);
  if (!ward) throw ctx.E.notFound('ward_not_found');
  const beds = h(ctx, 'beds').filter(b => b.wardCode === code);
  const patients = h(ctx, 'patients').filter(p => p.wardCode === code && ['in_care','admitted'].includes(p.status));
  const acuity = h(ctx, 'patient_acuity');
  const acMap = {};
  acuity.forEach(a => acMap[a.patientId] = a.level);
  const patientMap = {};
  patients.forEach(p => patientMap[p.id] = p);
  const today = require("../core/time").todayTehran();
  const assignments = h(ctx, 'nurse_assignments').filter(a => a.wardCode === code && a.date === today);
  
  // Bed list with patient info
  const bedList = beds.map(b => {
    const p = b.patientId ? patientMap[b.patientId] : null;
    return {
      id: b.id, bedNumber: b.bedNumber, status: b.status,
      type: b.type || 'regular', isCritical: !!b.isCritical,
      hasO2: !!b.hasO2, hasSuction: !!b.hasSuction, hasMonitor: !!b.hasMonitor,
      isIsolation: !!b.isIsolation,
      patient: p ? { id: p.id, name: p.firstName + ' ' + p.lastName, age: p.age, sex: p.sex, diagnosis: p.diagnosis, acuity: acMap[p.id] || null } : null
    };
  });
  
  // Acuity distribution
  const acuityDist = { 1:0, 2:0, 3:0, 4:0, 5:0, null:0 };
  patients.forEach(p => {
    const lvl = acMap[p.id] || null;
    acuityDist[lvl === null ? 'null' : lvl]++;
  });
  
  // Unassigned patients
  const assignedPids = new Set();
  assignments.forEach(a => (a.patientIds || []).forEach(pid => assignedPids.add(pid)));
  const unassigned = patients.filter(p => !assignedPids.has(p.id));
  
  return {
    ward: { code: ward.code, label: ward.label, type: ward.type || 'ward', group: ward.group || 'internal', headNurse: ward.headNurse || ward.headNurseName },
    beds: bedList,
    stats: {
      bedsTotal: beds.length,
      bedsOccupied: beds.filter(b => b.status === 'occupied').length,
      bedsAvailable: beds.filter(b => b.status === 'available').length,
      bedsCleaning: beds.filter(b => b.status === 'cleaning').length,
      bedsMaintenance: beds.filter(b => b.status === 'maintenance').length,
      patients: patients.length,
      acuityDist: acuityDist,
      assignmentsCount: assignments.length,
      unassignedPatients: unassigned.length
    },
    assignments: assignments.map(a => ({
      id: a.id, nurseId: a.nurseId, nurseName: a.nurseName, nurseCategory: a.nurseCategory,
      shiftType: a.shiftType, role: a.role, maxPatients: a.maxPatients,
      patientIds: a.patientIds || [],
      patients: (a.patientIds || []).map(pid => patientMap[pid]).filter(Boolean).map(p => ({
        id: p.id, name: p.firstName + ' ' + p.lastName, bed: p.bedNumber, acuity: acMap[p.id] || null
      }))
    })),
    unassignedPatients: unassigned.map(p => ({
      id: p.id, name: p.firstName + ' ' + p.lastName, bed: p.bedNumber,
      age: p.age, diagnosis: p.diagnosis, acuity: acMap[p.id] || null
    }))
  };
}

function listStaffForAssignment(ctx) {
  const wardCode = ctx.query.wardCode;
  let items = h(ctx, 'sa_staff').filter(s => s.active);
  if (wardCode) {
    const wardStaff = items.filter(s => {
      const w = h(ctx, 'hospital_wards').find(x => x.code === wardCode);
      return !w || s.wardId === w.id || true; // allow cross-ward if needed
    });
  }
  items = items.filter(s => ['rn','head_nurse','nurse','midwife','anesthesia'].includes(s.category));
  return {
    items: items.slice(0, 200).map(s => ({
      id: s.id, name: s.name, code: s.code, category: s.category,
      wardId: s.wardId, seniority: s.seniorityYears
    })),
    total: items.length
  };
}

// ═══════════════════════════════════════════════════════════
//  ROUTINES — templates per ward type
// ═══════════════════════════════════════════════════════════
function listRoutines(ctx) {
  let items = h(ctx, 'routine_templates');
  if (!items.length) {
    // Return defaults
    items = Object.entries(SHIFT_TEMPLATES).map(([key, t]) => ({
      id: 'default_' + key,
      shiftType: key,
      label: t.label,
      hours: t.hours,
      medRounds: t.medRounds,
      vitalRounds: t.vitalRounds,
      doctorRound: t.doctorRound,
      assessment: t.assessment,
      isDefault: true
    }));
  }
  return { items, total: items.length, wardTypes: WARD_TYPES, acuityLevels: ACUITY_LEVELS, shiftTemplates: SHIFT_TEMPLATES };
}

function getWardTypeConfig(ctx) {
  return { wardTypes: WARD_TYPES, acuityLevels: ACUITY_LEVELS, shiftTemplates: SHIFT_TEMPLATES };
}

module.exports = {
  handlers: {
    listWards, createWard, updateWard, deleteWard,
    listBeds, bulkCreateBeds, updateBed, deleteBed,
    getAcuity, setAcuity, listAcuity,
    listAssignments, createAssignment, updateAssignment,
    assignPatientToNurse, removePatientFromNurse, deleteAssignment,
    wardSnapshot, listStaffForAssignment,
    listRoutines, getWardTypeConfig
  },
  routes: [

    { method:'POST', path:'/api/hops/wards', handler:'createWard', perm:'admin.users.manage' },
    { method:'POST', path:'/api/hops/beds/bulk', handler:'bulkCreateBeds', perm:'admin.users.manage' },
    { method:'POST', path:'/api/hops/assignments', handler:'createAssignment', perm:'admin.users.manage' },
    { method:'GET',  path:'/api/hops/wards', handler:'listWards', perm:null },
    { method:'PUT',  path:'/api/hops/wards/:id', handler:'updateWard', perm:'admin.users.manage' },
    { method:'DELETE', path:'/api/hops/wards/:id', handler:'deleteWard', perm:'admin.users.manage' },
    { method:'GET',  path:'/api/hops/beds', handler:'listBeds', perm:null },
    { method:'PUT',  path:'/api/hops/beds/:id', handler:'updateBed', perm:'admin.users.manage' },
    { method:'DELETE', path:'/api/hops/beds/:id', handler:'deleteBed', perm:'admin.users.manage' },
    { method:'GET',  path:'/api/hops/acuity/:patientId', handler:'getAcuity', perm:null },
    { method:'POST', path:'/api/hops/acuity', handler:'setAcuity', perm:null },
    { method:'GET',  path:'/api/hops/acuity', handler:'listAcuity', perm:null },
    { method:'GET',  path:'/api/hops/assignments', handler:'listAssignments', perm:null },
    { method:'PUT',  path:'/api/hops/assignments/:id', handler:'updateAssignment', perm:'admin.users.manage' },
    { method:'POST', path:'/api/hops/assignments/:id/patient', handler:'assignPatientToNurse', perm:'admin.users.manage' },
    { method:'POST', path:'/api/hops/assignments/:id/patient/remove', handler:'removePatientFromNurse', perm:'admin.users.manage' },
    { method:'DELETE', path:'/api/hops/assignments/:id', handler:'deleteAssignment', perm:'admin.users.manage' },
    { method:'GET',  path:'/api/hops/ward-snapshot', handler:'wardSnapshot', perm:null },
    { method:'GET',  path:'/api/hops/staff', handler:'listStaffForAssignment', perm:null },
    { method:'GET',  path:'/api/hops/routines', handler:'listRoutines', perm:null },
    { method:'GET',  path:'/api/hops/config', handler:'getWardTypeConfig', perm:null },
  
  ],
  panels: [
    { id:'ward_config', title:'مدیریت بخش‌ها', icon:'🏗️', perm:'admin.users.manage', kind:'facilities', api:'/api/hops/wards' },
    { id:'assignment_board', title:'تخصیص پرستار', icon:'👩‍⚕️', perm:null, kind:'facilities', api:'/api/hops/wards' }
  ]
};
