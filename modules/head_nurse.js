'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Head Nurse HQ
//  Shift management · Assignment · Equipment · Requests
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const store = require('../core/store');
const bus = require('../core/events');
const perms = require('../core/permissions');

if (!perms.P['hn.view']) {
  perms.P['hn.view'] = 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,head_nurse,quality_officer';
  perms.P['hn.action'] = 'admin,head_nurse,nursing_director,supervisor_clinical';
  perms.P['hn.bed'] = 'admin,head_nurse,bed_manager,nursing_director,supervisor_clinical';
}

function resolveWard(ctx) {
  const a = ctx.actor;
  if (a.ward) return a.ward;
  try {
    const resolver = require('../core/ward-resolver');
    const w = resolver.resolveUserWard(a); if (w) return w;
  } catch (_) {}
  const anyPatient = store.readAll('patients').find(p => p.wardCode && ['in_care','admitted'].includes(p.status));
  return anyPatient ? anyPatient.wardCode : null;
}

// ═══ DASHBOARD ═══
function dashboard(ctx) {
  const ward = resolveWard(ctx);
  if (!ward) throw ctx.E.badRequest('ward_not_configured');
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // Patients in ward
  const patients = h(ctx, 'patients').filter(p => p.wardCode === ward && ['in_care','admitted'].includes(p.status));
  const pidSet = new Set(patients.map(p => p.id));

  // Staff
  const staff = h(ctx, 'wf_staff').filter(s => s.ward === ward && s.active !== false);
  const staffIds = new Set(staff.map(s => s.id));
  const attendance = h(ctx, 'attendance').filter(a => a.date === today && staffIds.has(a.userId));
  const present = attendance.filter(a => a.checkIn && !a.checkOut).length;
  const checkedOut = attendance.filter(a => a.checkOut).length;
  const absent = staff.length - present - checkedOut;

  // Today's assignments
  const assignments = h(ctx, 'nurse_assignments').filter(a => a.wardCode === ward && a.date === today);
  const assignedPatientIds = new Set();
  assignments.forEach(a => (a.patientIds || []).forEach(pid => assignedPatientIds.add(pid)));
  const unassigned = patients.filter(p => !assignedPatientIds.has(p.id));

  // Critical patients
  const lastVital = {};
  for (const v of h(ctx, 'vitals')) if (pidSet.has(v.patientId)) if (!lastVital[v.patientId] || sd(v.recordedAt) > sd(lastVital[v.patientId].recordedAt)) lastVital[v.patientId] = v;
  const criticalPatients = patients.map(p => {
    const v = lastVital[p.id];
    return { id:p.id, name:p.firstName+' '+p.lastName, bed:p.bedNumber, age:p.age, diagnosis:p.diagnosis, news2: v ? (v.news2||0) : 0, lastVitalAt: v ? v.recordedAt : null };
  }).filter(p => p.news2 >= 7).sort((a,b) => b.news2 - a.news2);

  // Beds
  const beds = h(ctx, 'beds').filter(b => b.wardCode === ward);
  const bedStats = {
    total: beds.length,
    occupied: beds.filter(b => b.status === 'occupied').length,
    available: beds.filter(b => b.status === 'available').length,
    cleaning: beds.filter(b => b.status === 'cleaning').length,
    maintenance: beds.filter(b => b.status === 'maintenance').length
  };

  // Requests
  const requests = h(ctx, 'requests').filter(r => r.requestedByWard === ward && r.status === 'submitted');

  // Incidents
  const incidents = h(ctx, 'incidents').filter(i => i.wardCode === ward && i.status !== 'closed' && sd(i.reportedAt) > now - 7*86400000);

  // Alerts (critical)
  const sepsis = h(ctx, 'sepsis').filter(s => pidSet.has(s.patientId) && ['suspected','confirmed','septic_shock'].includes(s.status));
  const critLabs = h(ctx, 'labs').filter(l => pidSet.has(l.patientId) && l.criticalFlags && l.criticalFlags.length && (!l.acknowledgment || !l.acknowledgment.acknowledged));

  // MAR compliance
  const shiftStart = new Date(); shiftStart.setHours(shiftStart.getHours() - 8);
  const mar = h(ctx, 'mar').filter(m => pidSet.has(m.patientId) && sd(m.scheduledAt) > sd(shiftStart.toISOString()));
  const given = mar.filter(m => m.status === 'given').length;
  const onTime = mar.filter(m => m.status === 'given' && (m.lateMinutes||0) <= 30).length;
  const missed = mar.filter(m => m.status === 'missed').length;
  const compliance = given > 0 ? Math.round((onTime / given) * 100) : 100;

  return {
    ward, shift: { today, hoursRemaining: (19 - new Date().getHours()) > 0 ? (19 - new Date().getHours()) : (19 + 24 - new Date().getHours()) },
    patients: { total: patients.length, unassigned: unassigned.length, critical: criticalPatients.length, criticalList: criticalPatients },
    staff: { total: staff.length, present, checkedOut, absent },
    mar: { given, onTime, missed, compliance },
    beds: bedStats,
    requests: { total: requests.length, list: requests.slice(0, 5).map(r => ({ id:r.id, typeLabel:r.typeLabel, requestedByName:r.requestedByName, subject:r.subject, priority:r.priority })) },
    incidents: { total: incidents.length, list: incidents.slice(0, 5) },
    alerts: { sepsis: sepsis.length, criticalLabs: critLabs.length }
  };
}

// ═══ SHIFT BOARD ═══
function shiftBoard(ctx) {
  const ward = resolveWard(ctx);
  if (!ward) throw ctx.E.badRequest('ward_not_configured');
  const today = new Date().toISOString().slice(0, 10);

  const patients = h(ctx, 'patients').filter(p => p.wardCode === ward && ['in_care','admitted'].includes(p.status));
  const pidSet = new Set(patients.map(p => p.id));
  const lastVital = {};
  for (const v of h(ctx, 'vitals')) if (pidSet.has(v.patientId)) if (!lastVital[v.patientId] || sd(v.recordedAt) > sd(lastVital[v.patientId].recordedAt)) lastVital[v.patientId] = v;

  // Staff with nurse category
  const staff = h(ctx, 'wf_staff').filter(s => s.ward === ward && s.active !== false && ['nurse','nurse_aide','head_nurse','assistant_nurse'].indexOf(s.role) >= 0);

  // Assignments today
  const assignments = h(ctx, 'nurse_assignments').filter(a => a.wardCode === ward && a.date === today);
  const assignmentMap = {};
  assignments.forEach(a => { assignmentMap[a.nurseId] = a; });

  const patientCards = patients.map(p => {
    const v = lastVital[p.id];
    const assignedTo = assignments.find(a => (a.patientIds||[]).indexOf(p.id) >= 0);
    const acuity = h(ctx, 'patient_acuity').find(a => a.patientId === p.id);
    return { id:p.id, name:p.firstName+' '+p.lastName, bed:p.bedNumber, age:p.age, diagnosis:p.diagnosis, news2: v ? (v.news2||0) : 0, acuity: acuity ? acuity.level : null, assignedTo: assignedTo ? { nurseId:assignedTo.nurseId, nurseName:assignedTo.nurseName } : null };
  });

  const staffCards = staff.map(s => {
    const a = assignmentMap[s.id];
    return { id:s.id, name:s.fullName, role:s.role, patientCount: a ? (a.patientIds||[]).length : 0, maxPatients: a ? a.maxPatients : 6 };
  });

  return { ward, date: today, patients: patientCards, staff: staffCards, assignments: assignments.map(a => ({ id:a.id, nurseId:a.nurseId, nurseName:a.nurseName, patientIds:a.patientIds||[], maxPatients:a.maxPatients })) };
}

// ═══ ASSIGN PATIENT ═══
function assignPatient(ctx) {
  const ward = resolveWard(ctx);
  const b = ctx.body || {};
  if (!b.patientId || !b.nurseId) throw ctx.E.badRequest('patient_id_nurse_id_required');
  const p = store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');
  if (p.wardCode !== ward) throw ctx.E.badRequest('patient_not_in_ward');
  const today = new Date().toISOString().slice(0, 10);

  // Find or create assignment
  let a = h(ctx, 'nurse_assignments').find(x => x.wardCode === ward && x.date === today && x.nurseId === b.nurseId);
  if (!a) {
    const staff = store.get('wf_staff', b.nurseId);
    if (!staff) throw ctx.E.notFound('staff_not_found');
    a = {
      id: ctx.uid('nasg'),
      wardCode: ward,
      nurseId: b.nurseId,
      nurseName: staff.fullName,
      nurseCategory: staff.role,
      date: today,
      shiftType: 'morning',
      patientIds: [],
      role: 'primary',
      maxPatients: 6,
      status: 'active',
      createdBy: ctx.actor.id,
      createdAt: ctx.now()
    };
  }

  // Remove from other assignments
  for (const other of h(ctx, 'nurse_assignments').filter(x => x.wardCode === ward && x.date === today && x.id !== a.id)) {
    if ((other.patientIds||[]).indexOf(b.patientId) >= 0) {
      other.patientIds = other.patientIds.filter(x => x !== b.patientId);
      store.put('nurse_assignments', other);
    }
  }

  // Add if room
  if ((a.patientIds||[]).length >= a.maxPatients && (a.patientIds||[]).indexOf(b.patientId) < 0) {
    throw ctx.E.conflict('max_patients_reached:' + a.maxPatients);
  }
  if ((a.patientIds||[]).indexOf(b.patientId) < 0) a.patientIds.push(b.patientId);
  store.put('nurse_assignments', a);
  ctx.audit.write('head_nurse', 'assign', a.id, ctx.actor, { patientId: b.patientId, nurseId: b.nurseId });
  bus.emit('nurse.assignment.updated', { record: a, actor: ctx.actor });
  return a;
}

// ═══ AUTO ASSIGN (smart) ═══
function autoAssign(ctx) {
  const ward = resolveWard(ctx);
  if (!ward) throw ctx.E.badRequest('ward_not_configured');
  const today = new Date().toISOString().slice(0, 10);
  const patients = h(ctx, 'patients').filter(p => p.wardCode === ward && ['in_care','admitted'].indexOf(p.status) >= 0);
  const staff = h(ctx, 'wf_staff').filter(s => s.ward === ward && s.active !== false && ['nurse','assistant_nurse'].indexOf(s.role) >= 0);
  if (!staff.length) throw ctx.E.badRequest('no_nurses');
  if (!patients.length) throw ctx.E.badRequest('no_patients');
  const patientIds = new Set(patients.map(p => p.id));
  const lastVital = {};
  for (const v of h(ctx, 'vitals')) {
    if (!patientIds.has(v.patientId)) continue;
    if (!lastVital[v.patientId] || sd(v.recordedAt) > sd(lastVital[v.patientId].recordedAt)) lastVital[v.patientId] = v;
  }
  const acuityMap = {};
  for (const a of h(ctx, 'patient_acuity')) if (patientIds.has(a.patientId)) acuityMap[a.patientId] = a.level;
  const scored = patients.map(p => {
    const v = lastVital[p.id];
    const news2 = v ? (Number(v.news2) || 0) : 0;
    const acuity = acuityMap[p.id];
    const as = acuity ? (6 - acuity) * 15 : 15;
    return { p, score: news2 * 10 + as };
  }).sort((a, b) => b.score - a.score);
  for (const a of h(ctx, 'nurse_assignments').filter(x => x.wardCode === ward && x.date === today)) store.remove('nurse_assignments', a.id);
  const assignments = {};
  for (const stf of staff) {
    assignments[stf.id] = {
      id: ctx.uid('nasg'), wardCode: ward, nurseId: stf.id, nurseName: stf.fullName,
      nurseCategory: stf.role, date: today, shiftType: 'morning',
      patientIds: [], role: 'primary', maxPatients: 6, status: 'active',
      createdBy: ctx.actor.id, createdAt: ctx.now()
    };
  }
  let assigned = 0;
  for (const { p } of scored) {
    const sorted = Object.values(assignments).sort((a, b) => a.patientIds.length - b.patientIds.length);
    const chosen = sorted.find(a => a.patientIds.length < a.maxPatients);
    if (chosen) { chosen.patientIds.push(p.id); assigned++; }
  }
  let created = 0;
  for (const a of Object.values(assignments)) if (a.patientIds.length > 0) { store.put('nurse_assignments', a); created++; }
  ctx.audit.write('head_nurse', 'auto_assign', ward, ctx.actor, { patients: patients.length, nurses: created });
  return { ok: true, created, patients: patients.length, assigned, nurses: created };
}

// ═══ STAFF CHECKIN/OUT ═══
function staffCheckIn(ctx) {
  const ward = resolveWard(ctx);
  const staffId = ctx.params.id;
  const today = new Date().toISOString().slice(0, 10);
  const staff = store.get('wf_staff', staffId);
  if (!staff) throw ctx.E.notFound('staff_not_found');
  if (staff.ward !== ward) throw ctx.E.badRequest('staff_not_in_ward');

  let rec = h(ctx, 'attendance').find(a => a.date === today && a.staffId === staffId);
  if (!rec) {
    rec = { id: ctx.uid('att'), staffId, staffName: staff.fullName, wardCode: ward, date: today, checkIn: null, checkOut: null };
  }
  if (rec.checkIn) throw ctx.E.conflict('already_checked_in');
  rec.checkIn = ctx.now();
  rec.checkInBy = ctx.actor.id;
  store.put('attendance', rec);
  ctx.audit.write('head_nurse', 'staff.checkin', staffId, ctx.actor, {});
  return rec;
}

function staffCheckOut(ctx) {
  const today = new Date().toISOString().slice(0, 10);
  const staffId = ctx.params.id;
  const rec = h(ctx, 'attendance').find(a => a.date === today && a.staffId === staffId);
  if (!rec || !rec.checkIn) throw ctx.E.badRequest('not_checked_in');
  if (rec.checkOut) throw ctx.E.conflict('already_checked_out');
  rec.checkOut = ctx.now();
  rec.workedHours = Math.round((sd(rec.checkOut) - sd(rec.checkIn)) / 360000) / 10;
  store.put('attendance', rec);
  return rec;
}

// ═══ BED MANAGEMENT ═══
function bedMgmt(ctx) {
  const ward = resolveWard(ctx);
  const beds = h(ctx, 'beds').filter(b => b.wardCode === ward);
  const patients = h(ctx, 'patients');
  const patientMap = {};
  patients.forEach(p => { patientMap[p.id] = p; });
  return beds.map(b => ({
    id: b.id, bedNumber: b.bedNumber, status: b.status, isCritical: b.isCritical,
    patient: b.patientId && patientMap[b.patientId] ? {
      id: b.patientId,
      name: patientMap[b.patientId].firstName + ' ' + patientMap[b.patientId].lastName,
      age: patientMap[b.patientId].age,
      diagnosis: patientMap[b.patientId].diagnosis
    } : null
  }));
}

function bedAssign(ctx) {
  const bedId = ctx.params.bedId;
  const bed = store.get('beds', bedId);
  if (!bed) throw ctx.E.notFound('bed_not_found');
  if (bed.status !== 'available') throw ctx.E.conflict('bed_not_available');
  const b = ctx.body || {};
  if (!b.patientId) throw ctx.E.badRequest('patient_required');
  const p = store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');

  bed.status = 'occupied';
  bed.patientId = p.id;
  store.put('beds', bed);
  p.bedId = bed.id;
  p.bedNumber = bed.bedNumber;
  p.wardCode = bed.wardCode;
  store.put('patients', p);
  bus.emit('bed.assigned', { bed, patient: p, actor: ctx.actor });
  return { bed, patient: { id:p.id, name:p.firstName+' '+p.lastName } };
}

function bedRelease(ctx) {
  const bedId = ctx.params.bedId;
  const bed = store.get('beds', bedId);
  if (!bed) throw ctx.E.notFound('bed_not_found');
  const p = bed.patientId ? store.get('patients', bed.patientId) : null;
  bed.status = 'cleaning';
  bed.patientId = null;
  store.put('beds', bed);
  if (p) { p.bedId = null; p.bedNumber = null; store.put('patients', p); }
  bus.emit('bed.released', { bed, patient: p, actor: ctx.actor });
  return { bed, patient: p ? { id:p.id, name:p.firstName+' '+p.lastName } : null };
}

// ═══ REQUESTS ═══
function approveRequest(ctx) {
  const id = ctx.params.id;
  const decision = ctx.body.decision === 'reject' ? 'reject' : 'approve';
  const r = store.get('requests', id);
  if (!r) throw ctx.E.notFound('request_not_found');
  if (!['submitted','escalated'].includes(r.status)) throw ctx.E.conflict('not_pending');
  if (decision === 'approve') {
    r.status = 'approved';
    r.approvedAt = ctx.now();
    r.approvedBy = ctx.actor.id;
    r.approvedByName = ctx.actor.fullName || ctx.actor.username;
  } else {
    if (!ctx.body.reason) throw ctx.E.badRequest('reason_required');
    r.status = 'rejected';
    r.rejectedAt = ctx.now();
    r.rejectedBy = ctx.actor.id;
    r.rejectReason = ctx.body.reason;
  }
  store.put('requests', r);
  bus.emit('request.' + decision + 'd', { record: r, actor: ctx.actor });
  return r;
}

// ═══ EQUIPMENT ═══
function equipment(ctx) {
  const ward = resolveWard(ctx);
  const equips = h(ctx, 'equipment').filter(e => e.wardCode === ward);
  return equips.map(e => ({ id:e.id, name:e.name, type:e.type, status:e.status||'ok', lastCheckAt:e.lastCheckAt, nextCheckDueAt:e.nextCheckDueAt, notes:e.notes }));
}

function equipmentCheck(ctx) {
  const ward = resolveWard(ctx);
  const equipId = ctx.params.equipId;
  const b = ctx.body || {};
  let rec = store.get('equipment', equipId);
  if (!rec) {
    rec = { id: ctx.uid('eq'), wardCode: ward, name: b.name || 'Unknown', type: b.type || 'other', status: 'ok', lastCheckAt: null, checks: [] };
  }
  rec.checks = rec.checks || [];
  rec.checks.push({ at: ctx.now(), by: ctx.actor.id, byName: ctx.actor.fullName || ctx.actor.username, status: b.status || 'ok', notes: String(b.notes || '').slice(0, 300) });
  rec.status = b.status || 'ok';
  rec.lastCheckAt = ctx.now();
  rec.nextCheckDueAt = new Date(Date.now() + 24 * 3600000).toISOString();
  store.put('equipment', rec);
  bus.emit('equipment.checked', { record: rec, actor: ctx.actor });
  return rec;
}

module.exports = {
  handlers: { dashboard, shiftBoard, assignPatient, autoAssign, staffCheckIn, staffCheckOut, bedMgmt, bedAssign, bedRelease, approveRequest, equipment, equipmentCheck },
  routes: [
    { method:'GET',  path:'/api/head_nurse/dashboard', handler:'dashboard', perm:'hn.view' },
    { method:'GET',  path:'/api/head_nurse/shift-board', handler:'shiftBoard', perm:'hn.view' },
    { method:'POST', path:'/api/head_nurse/shift-board/assign', handler:'assignPatient', perm:'hn.action' },
    { method:'POST', path:'/api/head_nurse/shift-board/auto-assign', handler:'autoAssign', perm:'hn.action' },
    { method:'POST', path:'/api/head_nurse/staff/:id/checkin', handler:'staffCheckIn', perm:'hn.action' },
    { method:'POST', path:'/api/head_nurse/staff/:id/checkout', handler:'staffCheckOut', perm:'hn.action' },
    { method:'GET',  path:'/api/head_nurse/beds', handler:'bedMgmt', perm:'hn.view' },
    { method:'POST', path:'/api/head_nurse/beds/:bedId/assign', handler:'bedAssign', perm:'hn.bed' },
    { method:'POST', path:'/api/head_nurse/beds/:bedId/release', handler:'bedRelease', perm:'hn.bed' },
    { method:'POST', path:'/api/head_nurse/requests/:id/approve', handler:'approveRequest', perm:'hn.action' },
    { method:'GET',  path:'/api/head_nurse/equipment', handler:'equipment', perm:'hn.view' },
    { method:'POST', path:'/api/head_nurse/equipment/:equipId/check', handler:'equipmentCheck', perm:'hn.action' }
  ],
  panels: [
    { id:'hq', title:'ایستگاه سرپرستار', icon:'👨‍⚕️', perm:'hn.view', kind:'head_nurse', api:'/api/head_nurse/dashboard' }
  ]
};
console.log('[head-nurse] loaded — 12 endpoints · shift board · beds · requests · equipment');
