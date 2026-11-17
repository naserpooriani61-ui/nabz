'use strict';
const { h, sd } = require('../core/mod-helpers');
const bus = require('../core/events');

function todayIso() { return require("../core/time").todayTehran(); }
function getShift(hour) {
  if (hour >= 7 && hour < 14) return { code:'morning', label:'صبح' };
  if (hour >= 14 && hour < 19) return { code:'evening', label:'عصر' };
  return { code:'night', label:'شب' };
}

function resolveWard(ctx) {
  if (ctx.actor.ward) return ctx.actor.ward;
  const staff = h(ctx,'wf_staff').find(s => s.fullName === ctx.actor.fullName || s.id === ctx.actor.staffId);
  return staff && staff.ward ? staff.ward : null;
}

// ═══ Nurse ═══
function nurse(ctx) {
  const ward = resolveWard(ctx);
  if (!ward) return { error:'no_ward', message:'بخش شما تنظیم نشده — با مدیر تماس بگیرید' };
  const hour = new Date().getHours();
  const shift = getShift(hour);
  const patients = h(ctx,'patients').filter(p => p.wardCode === ward && ['in_care','admitted'].includes(p.status));
  const patientIds = new Set(patients.map(p=>p.id));
  
  const vitals = h(ctx,'vitals').filter(v => patientIds.has(v.patientId) && sd(v.recordedAt) > Date.now()-86400000);
  const lastVital = new Map();
  for (const v of vitals) {
    const prev = lastVital.get(v.patientId);
    if (!prev || sd(v.recordedAt) > sd(prev.recordedAt)) lastVital.set(v.patientId, v);
  }
  const criticalVitals = vitals.filter(v => (v.news2||0) >= 7);
  
  const allMar = h(ctx,'mar').filter(m => patientIds.has(m.patientId));
  const dueNow = allMar.filter(m => {
    if (!['scheduled','due'].includes(m.status)) return false;
    const st = sd(m.scheduledAt);
    return st > Date.now()-3600000 && st < Date.now()+7200000;
  });
  const missedMar = allMar.filter(m => m.status === 'missed');
  
  const criticalLabs = h(ctx,'labs').filter(l =>
    patientIds.has(l.patientId) && l.criticalFlags && l.criticalFlags.length > 0 && ['resulted','verified'].includes(l.status));
  const pendingOrders = h(ctx,'orders').filter(o => patientIds.has(o.patientId) && o.status === 'pending');
  const consultsReady = h(ctx,'consults').filter(c => patientIds.has(c.patientId) && c.status === 'responded');
  
  const patientList = patients.map(p => {
    const v = lastVital.get(p.id);
    const pMar = allMar.filter(m => m.patientId === p.id && ['scheduled','due'].includes(m.status));
    return { id:p.id, name:p.firstName+' '+p.lastName, bed:p.bedNumber, age:p.age,
      diagnosis:p.diagnosis, news2:v ? v.news2||0 : 0, marDue:pMar.length, allergies:p.allergies||[] };
  }).sort((a,b) => b.news2 - a.news2);
  
  return {
    role:'nurse', shift, ward,
    stats: { totalPatients:patients.length, criticalVitals:criticalVitals.length,
      marDue:dueNow.length, missedMar:missedMar.length,
      criticalLabs:criticalLabs.length, pendingOrders:pendingOrders.length, consultsReady:consultsReady.length },
    patients: patientList,
    criticalVitals: criticalVitals.slice(0,5).map(v => ({ patientName:v.patientName, news2:v.news2, recordedAt:v.recordedAt })),
    criticalLabs: criticalLabs.slice(0,5).map(l => ({ id:l.id, patientName:l.patientName, panel:l.panelName, flags:l.criticalFlags })),
    marDue: dueNow.slice(0,10).map(m => ({ id:m.id, patientName:m.patientName, drugName:m.drugName,
      dose:m.dose, route:m.route, scheduledAt:m.scheduledAt, isHighAlert:m.isHighAlert })),
    pendingOrders: pendingOrders.slice(0,10).map(o => ({ id:o.id, patientName:o.patientName, type:o.type,
      priority:o.priority, details:o.details })),
    consultsReady: consultsReady.slice(0,5).map(c => ({ id:c.id, patientName:c.patientName, service:c.targetService }))
  };
}

// ═══ Head Nurse ═══
function headNurse(ctx) {
  const ward = resolveWard(ctx);
  if (!ward) return { error:'no_ward' };
  const patients = h(ctx,'patients').filter(p => p.wardCode === ward && ['in_care','admitted'].includes(p.status));
  const staff = h(ctx,'wf_staff').filter(s => s.ward === ward && s.active);
  const staffIds = new Set(staff.map(s=>s.id));
  const today = todayIso();
  const attendance = h(ctx,'attendance').filter(a => a.date === today && staffIds.has(a.userId));
  const present = attendance.filter(a => a.checkIn && !a.checkOut).length;
  const checkedOut = attendance.filter(a => a.checkOut).length;
  const absent = staff.length - present - checkedOut;
  
  const patientIds = new Set(patients.map(p=>p.id));
  const mar = h(ctx,'mar').filter(m => patientIds.has(m.patientId) && sd(m.scheduledAt) > Date.now()-86400000);
  const given = mar.filter(m => m.status === 'given').length;
  const marCompliance = mar.length > 0 ? Math.round(given/mar.length*100) : 100;
  
  const pendingPrefs = h(ctx,'sa_preferences').filter(p => p.wardId && p.status === 'submitted' &&
    p.wardId === (h(ctx,'sa_wards').find(w => w.code === ward) || {}).id);
  
  const incidents = h(ctx,'incidents').filter(i => i.wardCode === ward && sd(i.reportedAt) > Date.now()-86400000);
  const beds = h(ctx,'beds').filter(b => b.wardCode === ward);
  const occupied = beds.filter(b => b.status === 'occupied').length;
  
  return {
    role:'head_nurse', ward,
    stats: { staffTotal:staff.length, staffPresent:present, staffCheckedOut:checkedOut,
      staffAbsent:Math.max(0,absent), patients:patients.length, marCompliance,
      pendingRequests:pendingPrefs.length, incidents:incidents.length,
      bedsTotal:beds.length, bedsOccupied:occupied,
      bedOccupancy:beds.length ? Math.round(occupied/beds.length*100) : 0 },
    staff: staff.slice(0,50).map(s => {
      const att = attendance.find(a=>a.userId===s.id);
      return { id:s.id, name:s.fullName, role:s.role,
        state: att ? (att.checkOut ? 'checked_out' : 'checked_in') : 'absent',
        checkInAt: att ? att.checkIn : null };
    }),
    pendingRequests: pendingPrefs.slice(0,10).map(p => ({ id:p.id, staffId:p.staffId, date:p.date, requestType:p.requestType })),
    incidents: incidents.slice(0,5).map(i => ({ category:i.category, severity:i.severity, description:i.description }))
  };
}

// ═══ Resident ═══
function resident(ctx) {
  const ward = resolveWard(ctx);
  const userId = ctx.actor.id;
  const myRounds = h(ctx,'encounters').filter(e => e.type === 'round' && e.authorId === userId && ['draft','pending_cosign'].includes(e.status));
  const patientIds = new Set(h(ctx,'patients').filter(p => p.wardCode === ward && ['in_care','admitted'].includes(p.status)).map(p=>p.id));
  
  const newAdmissions = h(ctx,'patients').filter(p => patientIds.has(p.id) && sd(p.admittedAt) > Date.now()-86400000);
  const wardConsults = h(ctx,'consults').filter(c => patientIds.has(c.patientId) && c.status === 'requested');
  const criticalLabs = h(ctx,'labs').filter(l => patientIds.has(l.patientId) && l.criticalFlags && l.criticalFlags.length > 0 && l.status === 'resulted');
  const pendingProc = h(ctx,'procedures').filter(p => patientIds.has(p.patientId) && p.status === 'in_progress');
  
  return {
    role:'resident', ward: ward || '—',
    stats: { myDrafts:myRounds.filter(r=>r.status==='draft').length,
      myPendingCosign:myRounds.filter(r=>r.status==='pending_cosign').length,
      newAdmissions:newAdmissions.length, wardConsults:wardConsults.length,
      criticalLabs:criticalLabs.length, inProgressProcs:pendingProc.length },
    myRounds: myRounds.slice(0,10).map(r => ({ id:r.id, patientName:r.patientName, status:r.status,
      subtype:r.subtype, createdAt:r.createdAt })),
    newAdmissions: newAdmissions.slice(0,10).map(p => ({ id:p.id, name:p.firstName+' '+p.lastName,
      bed:p.bedNumber, diagnosis:p.diagnosis, admittedAt:p.admittedAt })),
    wardConsults: wardConsults.slice(0,10).map(c => ({ id:c.id, patientName:c.patientName,
      service:c.targetService, type:c.consultType, question:c.question })),
    criticalLabs: criticalLabs.slice(0,5).map(l => ({ id:l.id, patientName:l.patientName, panel:l.panelName, flags:l.criticalFlags }))
  };
}

// ═══ Attending ═══
function attending(ctx) {
  const ward = resolveWard(ctx);
  const userId = ctx.actor.id;
  const pendingCosign = h(ctx,'encounters').filter(e => e.type === 'round' && e.status === 'pending_cosign' && e.wardCode === ward);
  const pendingConsultApproval = h(ctx,'consults').filter(c => c.status === 'responded' && c.respondedBy !== userId);
  const pendingDischarge = h(ctx,'discharges').filter(d => d.status === 'summary_drafted' && d.wardCode === ward);
  const patients = h(ctx,'patients').filter(p => p.wardCode === ward && ['in_care','admitted'].includes(p.status));
  const team = h(ctx,'wf_staff').filter(s => s.ward === ward && ['resident','intern','nurse'].includes(s.role) && s.active);
  
  return {
    role:'attending', ward: ward || '—',
    stats: { pendingCosign:pendingCosign.length, pendingConsultApproval:pendingConsultApproval.length,
      pendingDischarge:pendingDischarge.length, wardCensus:patients.length, teamSize:team.length },
    pendingCosign: pendingCosign.slice(0,10).map(r => ({ id:r.id, patientName:r.patientName,
      signedByName:r.signedByName, signedAt:r.signedAt,
      chiefComplaint:r.subjective ? r.subjective.chiefComplaint : '' })),
    pendingConsultApproval: pendingConsultApproval.slice(0,10).map(c => ({ id:c.id, patientName:c.patientName,
      service:c.targetService, respondedByName:c.respondedByName||'—' })),
    pendingDischarge: pendingDischarge.slice(0,10).map(d => ({ id:d.id, patientName:d.patientName, plannedAt:d.plannedAt })),
    patients: patients.slice(0,20).map(p => ({ id:p.id, name:p.firstName+' '+p.lastName,
      bed:p.bedNumber, age:p.age, diagnosis:p.diagnosis }))
  };
}

// ═══ Matron ═══
function matron(ctx) {
  const wards = h(ctx,'sa_wards').filter(w => !w.isManagement);
  const period = h(ctx,'sa_periods')[0];
  const today = todayIso();
  const wardStats = wards.map(w => {
    const assigns = h(ctx,'sa_assignments').filter(a => a.wardId === w.id && a.periodId === (period?period.id:'') && a.date === today);
    const staff = h(ctx,'sa_staff').filter(s => s.wardId === w.id && s.active);
    const head = w.headStaffId ? ctx.store.get('sa_staff', w.headStaffId) : null;
    return { id:w.id, code:w.code, label:w.label, staffCount:staff.length,
      assignedToday:assigns.length, headNurse: head ? head.name : null };
  });
  const allPatients = h(ctx,'patients').filter(p => ['in_care','admitted'].includes(p.status));
  const beds = h(ctx,'beds');
  const occupancy = beds.length ? Math.round(beds.filter(b=>b.status==='occupied').length / beds.length * 100) : 0;
  const codes = h(ctx,'ed_codes').filter(c => c.status === 'active');
  const mci = h(ctx,'ed_mci').filter(m => m.status === 'active');
  const crisis = h(ctx,'crisis_sessions').filter(c => c.status === 'active');
  const pendingSupPrefs = h(ctx,'sa_preferences').filter(p => p.status === 'submitted');
  
  return {
    role:'matron',
    stats: { wards:wards.length, totalPatients:allPatients.length, occupancy,
      activeCodes:codes.length, activeMCI:mci.length, activeCrisis:crisis.length,
      pendingSupervisorRequests:pendingSupPrefs.length },
    wards: wardStats,
    alerts: {
      codes: codes.map(c => ({ id:c.id, label:c.codeLabel, patientName:c.patientName })),
      mci: mci.map(m => ({ id:m.id, type:m.incidentType, level:m.alertLevel })),
      crisis: crisis.map(c => ({ id:c.id, label:c.crisisLabel, reason:c.reason }))
    },
    pendingRequests: pendingSupPrefs.slice(0,10).map(p => ({ id:p.id, staffId:p.staffId, date:p.date, requestType:p.requestType }))
  };
}

// ═══ Supervisor ═══
function supervisor(ctx) {
  const today = todayIso();
  const patients = h(ctx,'patients').filter(p => ['in_care','admitted'].includes(p.status));
  const beds = h(ctx,'beds');
  const attendance = h(ctx,'attendance').filter(a => a.date === today);
  const present = attendance.filter(a => a.checkIn && !a.checkOut).length;
  const codes = h(ctx,'ed_codes').filter(c => c.status === 'active');
  const mci = h(ctx,'ed_mci').filter(m => m.status === 'active');
  const crisis = h(ctx,'crisis_sessions').filter(c => c.status === 'active');
  const recentEvents = bus.recent(20).filter(e => sd(e.at) > Date.now()-3600000);
  
  return {
    role:'supervisor',
    stats: { patients:patients.length, present,
      bedsOccupied:beds.filter(b=>b.status==='occupied').length, bedsTotal:beds.length,
      activeCodes:codes.length, activeMCI:mci.length, activeCrisis:crisis.length },
    alerts: {
      codes: codes.slice(0,5).map(c => ({ id:c.id, label:c.codeLabel, patientName:c.patientName })),
      mci: mci.slice(0,3).map(m => ({ id:m.id, type:m.incidentType, level:m.alertLevel })),
      crisis: crisis.slice(0,3).map(c => ({ id:c.id, label:c.crisisLabel, reason:c.reason }))
    },
    recentEvents: recentEvents.slice(0,10).map(e => ({ event:e.event, at:e.at,
      actor: e.actor ? e.actor.username : null }))
  };
}

// ═══ Pharmacist ═══
function pharmacist(ctx) {
  const pendingVerify = h(ctx,'dispenses').filter(d => d.status === 'pending_verify');
  const readyToDispense = h(ctx,'dispenses').filter(d => d.status === 'verified');
  const cdssAlerts = h(ctx,'cdss_alerts').filter(a => a.type === 'drug_interaction' && !a.dismissed);
  return {
    role:'pharmacist',
    stats: { pendingVerify:pendingVerify.length, readyToDispense:readyToDispense.length, interactionAlerts:cdssAlerts.length },
    pendingVerify: pendingVerify.slice(0,20).map(d => ({ id:d.id, patientName:d.patientName,
      drugName:d.drugName, dose:d.dose, createdAt:d.createdAt })),
    readyToDispense: readyToDispense.slice(0,20).map(d => ({ id:d.id, patientName:d.patientName,
      drugName:d.drugName, dose:d.dose })),
    interactionAlerts: cdssAlerts.slice(0,10).map(a => ({ id:a.id, patientName:a.patientName, drug:a.drug, other:a.other }))
  };
}

// ═══ Lab Tech ═══
function labTech(ctx) {
  const collected = h(ctx,'labs').filter(l => l.status === 'collected');
  const resulted = h(ctx,'labs').filter(l => l.status === 'resulted');
  const criticals = h(ctx,'labs').filter(l => l.criticalFlags && l.criticalFlags.length > 0 && ['resulted','verified'].includes(l.status));
  return {
    role:'lab_tech',
    stats: { awaitingResult:collected.length, awaitingVerify:resulted.length, criticals:criticals.length },
    awaitingResult: collected.slice(0,20).map(l => ({ id:l.id, patientName:l.patientName,
      panel:l.panelName, priority:l.priority, collectedAt:l.collectedAt })),
    awaitingVerify: resulted.slice(0,20).map(l => ({ id:l.id, patientName:l.patientName, panel:l.panelName })),
    criticals: criticals.slice(0,10).map(l => ({ id:l.id, patientName:l.patientName, panel:l.panelName, flags:l.criticalFlags }))
  };
}

// ═══ Radiology ═══
function radiologyTech(ctx) {
  const ordered = h(ctx,'radiology').filter(r => r.status === 'ordered');
  const reported = h(ctx,'radiology').filter(r => r.status === 'reported');
  const criticals = h(ctx,'radiology').filter(r => r.criticalFlag);
  return {
    role:'radiology_tech',
    stats: { awaitingReport:ordered.length, awaitingVerify:reported.length, criticals:criticals.length },
    awaitingReport: ordered.slice(0,20).map(r => ({ id:r.id, patientName:r.patientName,
      modality:r.modality, bodyPart:r.bodyPart, priority:r.priority })),
    awaitingVerify: reported.slice(0,20).map(r => ({ id:r.id, patientName:r.patientName,
      modality:r.modality, bodyPart:r.bodyPart })),
    criticals: criticals.slice(0,10).map(r => ({ id:r.id, patientName:r.patientName, modality:r.modality }))
  };
}

// ═══ Receptionist ═══
function receptionist(ctx) {
  const availableBeds = h(ctx,'beds').filter(b => b.status === 'available');
  const recentAdmissions = h(ctx,'patients').filter(p => ['in_care','admitted'].includes(p.status) && sd(p.admittedAt) > Date.now()-86400000);
  const waitingED = h(ctx,'ed_visits').filter(v => v.status === 'waiting_triage');
  return {
    role:'receptionist',
    stats: { availableBeds:availableBeds.length, recentAdmissions:recentAdmissions.length, waitingED:waitingED.length },
    availableBeds: availableBeds.slice(0,20).map(b => ({ id:b.id, wardCode:b.wardCode, bedNumber:b.bedNumber, isCritical:b.isCritical })),
    recentAdmissions: recentAdmissions.slice(0,10).map(p => ({ id:p.id, name:p.firstName+' '+p.lastName,
      ward:p.wardCode, bed:p.bedNumber, admittedAt:p.admittedAt })),
    waitingED: waitingED.slice(0,10).map(v => ({ id:v.id, patientName:v.patientName,
      chiefComplaint:v.chiefComplaint, arrivalAt:v.arrivalAt }))
  };
}

// ═══ Admin ═══
function admin(ctx) {
  const users = h(ctx,'users');
  const staff = h(ctx,'wf_staff');
  const audit = h(ctx,'audit_chain');
  const patients = h(ctx,'patients').filter(p => ['in_care','admitted'].includes(p.status));
  const mem = process.memoryUsage();
  return {
    role:'admin',
    stats: { users:users.length, staff:staff.length, patients:patients.length,
      auditEvents:audit.length, uptimeMin:Math.floor(process.uptime()/60),
      memoryMB:Math.round(mem.rss/1024/1024) },
    recentAudit: audit.slice(-10).reverse().map(a => ({ action:a.action, module:a.module,
      actorName: a.actor ? a.actor.name : '—', at:a.at }))
  };
}

// ═══ Router ═══
function router(ctx) {
  const ROLE_MAP = {
    'nurse':'nurse','nurse_aide':'nurse','assistant_nurse':'nurse',
    'head_nurse':'head_nurse',
    'resident':'resident','intern':'resident',
    'attending':'attending','specialist':'attending','surgeon':'attending','anesthesiologist':'attending','physician':'attending',
    'matron':'matron','nursing_director':'matron','medical_director':'matron','hospital_director':'matron',
    'supervisor':'supervisor','clinical_supervisor':'supervisor','supervisor_senior':'supervisor','supervisor_er':'supervisor','supervisor_infection':'supervisor','supervisor_accreditation':'supervisor','supervisor_education':'supervisor',
    'pharmacist':'pharmacist',
    'lab_tech':'lab_tech',
    'radiology_tech':'radiology_tech',
    'receptionist':'receptionist',
    'admin':'admin','it_staff':'admin'
  };
  return { dashboard: ROLE_MAP[ctx.actor.role] || 'generic', role: ctx.actor.role };
}

module.exports = {
  handlers: { nurse, headNurse, resident, attending, matron, supervisor,
    pharmacist, labTech, radiologyTech, receptionist, admin, router },
  routes: [
    { method:'GET', path:'/api/rd/router', handler:'router', perm:null },
    { method:'GET', path:'/api/rd/nurse', handler:'nurse', perm:null },
    { method:'GET', path:'/api/rd/head_nurse', handler:'headNurse', perm:null },
    { method:'GET', path:'/api/rd/resident', handler:'resident', perm:null },
    { method:'GET', path:'/api/rd/attending', handler:'attending', perm:null },
    { method:'GET', path:'/api/rd/matron', handler:'matron', perm:null },
    { method:'GET', path:'/api/rd/supervisor', handler:'supervisor', perm:null },
    { method:'GET', path:'/api/rd/pharmacist', handler:'pharmacist', perm:null },
    { method:'GET', path:'/api/rd/lab_tech', handler:'labTech', perm:null },
    { method:'GET', path:'/api/rd/radiology_tech', handler:'radiologyTech', perm:null },
    { method:'GET', path:'/api/rd/receptionist', handler:'receptionist', perm:null },
    { method:'GET', path:'/api/rd/admin', handler:'admin', perm:null }
  ],
  panels: []
};
