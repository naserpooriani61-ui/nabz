'use strict';
const { h, sd } = require('../core/mod-helpers');

function today() { return require("../core/time").todayTehran(); }
function resolveWard(ctx) {
  if (ctx.actor.ward) return ctx.actor.ward;
  const sid = ctx.actor.staffId;
  if (sid) {
    const sa = h(ctx, 'sa_staff').find(s => s.id === sid);
    if (sa) { const w = h(ctx, 'sa_wards').find(w => w.id === sa.wardId); return w ? w.code : null; }
    const wf = h(ctx, 'wf_staff').find(s => s.id === sid);
    if (wf) return wf.ward;
  }
  return null;
}

// ═══ SUPERVISOR_ER (اورژانس) ═══
function supervisorER(ctx) {
  const today_ = today();
  const visits = h(ctx, 'ed_visits');
  const active = visits.filter(v => !['closed','discharged'].includes(v.status));
  const codes = h(ctx, 'ed_codes').filter(c => c.status === 'active');
  const mci = h(ctx, 'ed_mci').filter(m => m.status === 'active');
  const waiting = active.filter(v => ['waiting_triage','waiting_doctor'].includes(v.status));
  const boarding = active.filter(v => v.status === 'boarding');
  const critical = active.filter(v => v.esiLevel <= 2);
  const arrivals = visits.filter(v => v.arrivalAt && v.arrivalAt.slice(0,10) === today_).length;
  const beds = h(ctx, 'beds').filter(b => b.wardCode === 'ER');
  const erAssigns = h(ctx, 'sa_assignments').filter(a => a.wardId && a.date === today_);
  return {
    role:'supervisor_er', ward:'ER',
    stats: {
      arrivalsToday: arrivals, waiting: waiting.length, boarding: boarding.length,
      critical: critical.length, activeCodes: codes.length, activeMCI: mci.length,
      bedsTotal: beds.length, bedsAvailable: beds.filter(b => b.status === 'available').length,
      bedsOccupied: beds.filter(b => b.status === 'occupied').length
    },
    alerts: {
      codes: codes.map(c => ({ id:c.id, label:c.codeLabel, patientName:c.patientName })),
      mci: mci.map(m => ({ id:m.id, type:m.incidentType, level:m.alertLevel }))
    },
    waiting: waiting.slice(0, 10).map(v => ({
      id:v.id, name:v.patientName, esi:v.esiLevel, complaint:v.chiefComplaint,
      arrivedAt:v.arrivalAt, waitMin: Math.round((Date.now() - new Date(v.arrivalAt).getTime()) / 60000)
    })),
    boarding: boarding.slice(0, 10).map(v => ({
      id:v.id, name:v.patientName, esi:v.esiLevel,
      boardedMin: Math.round((Date.now() - new Date(v.arrivalAt).getTime()) / 60000)
    }))
  };
}

// ═══ SUPERVISOR_SENIOR (ارشد) ═══
function supervisorSenior(ctx) {
  const patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  const beds = h(ctx, 'beds');
  const codes = h(ctx, 'ed_codes').filter(c => c.status === 'active');
  const mci = h(ctx, 'ed_mci').filter(m => m.status === 'active');
  const crisis = h(ctx, 'crisis_sessions').filter(c => c.status === 'active');
  const incidents = h(ctx, 'incidents').filter(i => i.status !== 'closed');
  const requests = h(ctx, 'requests').filter(r => r.status === 'submitted' && r.priority === 'urgent');
  const sa_staff = h(ctx, 'sa_staff').filter(s => s.active);
  const wards = h(ctx, 'sa_wards').filter(w => !w.isManagement);
  const wardStats = wards.map(w => {
    const wb = beds.filter(b => b.wardCode === w.code);
    const wp = patients.filter(p => p.wardCode === w.code);
    const head = sa_staff.find(s => s.id === w.headStaffId);
    return {
      code: w.code, label: w.label,
      patients: wp.length,
      bedsTotal: wb.length, bedsOccupied: wb.filter(b => b.status === 'occupied').length,
      headNurse: head ? head.name : null
    };
  }).sort((a, b) => b.patients - a.patients);
  return {
    role:'supervisor_senior',
    stats: {
      activeWards: wards.length, totalPatients: patients.length,
      bedsOccupied: beds.filter(b => b.status === 'occupied').length, bedsTotal: beds.length,
      activeCodes: codes.length, activeMCI: mci.length, activeCrisis: crisis.length,
      openIncidents: incidents.length, urgentRequests: requests.length
    },
    alerts: { codes, mci, crisis },
    wardStats: wardStats.slice(0, 20),
    urgentRequests: requests.slice(0, 10)
  };
}

// ═══ SUPERVISOR_CLINICAL (بالینی) ═══
function supervisorClinical(ctx) {
  const ward = resolveWard(ctx);
  const patients = h(ctx, 'patients').filter(p => p.wardCode === ward && ['in_care','admitted'].includes(p.status));
  const patientIds = new Set(patients.map(p => p.id));
  const vitals = h(ctx, 'vitals').filter(v => patientIds.has(v.patientId) && sd(v.recordedAt) > Date.now() - 86400000);
  const critical = vitals.filter(v => (v.news2 || 0) >= 7);
  const mar = h(ctx, 'mar').filter(m => patientIds.has(m.patientId) && sd(m.scheduledAt) > Date.now() - 86400000);
  const missed = mar.filter(m => m.status === 'missed');
  const pendingOrders = h(ctx, 'orders').filter(o => patientIds.has(o.patientId) && o.status === 'pending');
  const consults = h(ctx, 'consults').filter(c => patientIds.has(c.patientId) && c.status === 'requested');
  const incidents = h(ctx, 'incidents').filter(i => i.wardCode === ward && sd(i.reportedAt) > Date.now() - 86400000);
  return {
    role:'supervisor_clinical', ward,
    stats: {
      patients: patients.length, criticalVitals: critical.length,
      marTotal: mar.length, marMissed: missed.length,
      pendingOrders: pendingOrders.length, pendingConsults: consults.length,
      incidentsToday: incidents.length
    },
    critical: critical.slice(0, 8).map(v => ({ name:v.patientName, news2:v.news2, at:v.recordedAt })),
    incidents: incidents.slice(0, 5),
    pendingOrders: pendingOrders.slice(0, 10)
  };
}

// ═══ SUPERVISOR_EDUCATION (آموزش) ═══
function supervisorEducation(ctx) {
  const exams = h(ctx, 'exams');
  const attempts = h(ctx, 'attempts');
  const cohorts = h(ctx, 'edu_cohorts');
  const micros = h(ctx, 'edu_micro');
  const assignments = h(ctx, 'edu_assignments');
  const pending = assignments.filter(a => a.status === 'assigned');
  const overdue = assignments.filter(a => a.dueAt && new Date(a.dueAt).getTime() < Date.now() && a.status !== 'completed');
  const today_ = today();
  const recent = attempts.filter(a => a.submittedAt && a.submittedAt.slice(0,10) === today_);
  return {
    role:'supervisor_education',
    stats: {
      publishedExams: exams.filter(e => e.status === 'published').length,
      totalExams: exams.length,
      cohorts: cohorts.length,
      attemptsThisMonth: attempts.length,
      pendingAssignments: pending.length,
      overdue: overdue.length,
      microCards: micros.length,
      submissionsToday: recent.length
    },
    pendingAssignments: pending.slice(0, 10),
    overdue: overdue.slice(0, 10),
    recentAttempts: attempts.slice(-10).reverse().map(a => ({
      user: a.userName, exam: a.examTitle, score: a.score, passed: a.passed, at: a.submittedAt
    }))
  };
}

// ═══ SUPERVISOR_INFECTION (عفونی) ═══
function supervisorInfection(ctx) {
  const infections = h(ctx, 'infections');
  const isolations = h(ctx, 'isolations');
  const sepsis = h(ctx, 'sepsis').filter(s => ['suspected','confirmed','septic_shock'].includes(s.status));
  const privacy = h(ctx, 'privacy_checks');
  const handHygieneAudits = h(ctx, 'clinical_audits').filter(a => a.topic === 'infection_control');
  const activeInf = infections.filter(i => i.status === 'confirmed');
  const activeIso = isolations.filter(i => i.status === 'active');
  const byWard = {};
  activeInf.forEach(i => { byWard[i.wardCode] = (byWard[i.wardCode] || 0) + 1; });
  return {
    role:'supervisor_infection',
    stats: {
      activeInfections: activeInf.length,
      activeIsolations: activeIso.length,
      suspectedSepsis: sepsis.length,
      handHygieneAudits: handHygieneAudits.length,
      wardsWithOutbreak: Object.keys(byWard).length
    },
    recentInfections: activeInf.slice(0, 10).map(i => ({
      patientName: i.patientName, wardCode: i.wardCode, type: i.type, pathogen: i.pathogen, at: i.reportedAt
    })),
    activeIsolations: activeIso.slice(0, 10).map(i => ({
      patientName: i.patientName, wardCode: i.wardCode, type: i.type, startedAt: i.startedAt
    })),
    byWard,
    sepsisAlerts: sepsis.slice(0, 5).map(s => ({
      patientName: s.patientName, wardCode: s.wardCode, qsofa: s.qsofa ? s.qsofa.score : 0
    }))
  };
}

// ═══ NURSE_AIDE (کمک بهیار) ═══
function nurseAide(ctx) {
  const ward = resolveWard(ctx);
  const patients = h(ctx, 'patients').filter(p => p.wardCode === ward && ['in_care','admitted'].includes(p.status));
  const patientIds = new Set(patients.map(p => p.id));
  // Only tasks nurse aides can do
  const tasks = h(ctx, 'orders').filter(o =>
    patientIds.has(o.patientId) &&
    o.type === 'nursing' &&
    o.status === 'verified');
  const today_ = today();
  const myAssigns = h(ctx, 'sa_assignments').filter(a => a.staffId === ctx.actor.staffId && a.date === today_);
  return {
    role:'nurse_aide', ward,
    stats: {
      myPatients: patients.length,
      pendingTasks: tasks.length,
      shiftsToday: myAssigns.length
    },
    patients: patients.slice(0, 20).map(p => ({
      id: p.id, name: p.firstName + ' ' + p.lastName, bed: p.bedNumber, age: p.age
    })),
    tasks: tasks.slice(0, 15).map(t => ({
      id: t.id, patientName: t.patientName, details: t.details
    }))
  };
}

// ═══ INTERN (اینترن) ═══
function intern(ctx) {
  const ward = resolveWard(ctx);
  const patients = h(ctx, 'patients').filter(p => p.wardCode === ward && ['in_care','admitted'].includes(p.status));
  const patientIds = new Set(patients.map(p => p.id));
  const myRounds = h(ctx, 'encounters').filter(e =>
    e.type === 'round' && e.authorId === ctx.actor.id && ['draft','pending_cosign'].includes(e.status));
  const wardConsults = h(ctx, 'consults').filter(c => patientIds.has(c.patientId) && c.status === 'requested');
  const criticalLabs = h(ctx, 'labs').filter(l =>
    patientIds.has(l.patientId) && l.criticalFlags && l.criticalFlags.length && l.status === 'resulted');
  // Interns should NOT be able to cosign/approve; only draft
  return {
    role:'intern', ward,
    stats: {
      myDrafts: myRounds.filter(r => r.status === 'draft').length,
      pendingCosign: myRounds.filter(r => r.status === 'pending_cosign').length,
      wardPatients: patients.length,
      wardConsults: wardConsults.length,
      criticalLabs: criticalLabs.length
    },
    myRounds: myRounds.slice(0, 10),
    wardConsults: wardConsults.slice(0, 5),
    criticalLabs: criticalLabs.slice(0, 5),
    // Note: interns cannot approve/cosign
    permissions_notes: 'اینترن نمی‌تواند راند را نهایی تأیید کند — نیاز به attending'
  };
}

// ═══ SURGEON / ANESTHESIOLOGIST ═══
function surgeon(ctx) {
  const today_ = today();
  const myCases = h(ctx, 'or_schedule').filter(c =>
    c.surgeon === ctx.actor.id && c.scheduledDate === today_);
  const scheduled = myCases.filter(c => c.status === 'scheduled');
  const inProgress = myCases.filter(c => c.status === 'in_progress');
  const completed = myCases.filter(c => c.status === 'completed');
  const allTodayCases = h(ctx, 'or_schedule').filter(c => c.scheduledDate === today_);
  const pacu = h(ctx, 'or_pacu').filter(p => p.status === 'active');
  return {
    role:'surgeon',
    stats: {
      myCasesToday: myCases.length,
      scheduled: scheduled.length,
      inProgress: inProgress.length,
      completed: completed.length,
      totalORToday: allTodayCases.length,
      pacuPatients: pacu.length
    },
    myCases: myCases.map(c => ({
      id:c.id, patientName:c.patientName, procedure:c.procedure,
      roomCode:c.roomCode, status:c.status,
      signIn: !!c.checklist?.signIn, timeOut: !!c.checklist?.timeOut, signOut: !!c.checklist?.signOut
    })),
    pacu: pacu.slice(0, 10)
  };
}

// ═══ NURSING_DIRECTOR / MEDICAL_DIRECTOR / HOSPITAL_DIRECTOR ═══
function director(ctx) {
  const patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  const beds = h(ctx, 'beds');
  const staff = h(ctx, 'sa_staff').filter(s => s.active);
  const incidents = h(ctx, 'incidents');
  const openInc = incidents.filter(i => i.status !== 'closed');
  const codes = h(ctx, 'ed_codes').filter(c => c.status === 'active');
  const mci = h(ctx, 'ed_mci').filter(m => m.status === 'active');
  const crisis = h(ctx, 'crisis_sessions').filter(c => c.status === 'active');
  const requests = h(ctx, 'requests').filter(r => ['submitted','escalated'].includes(r.status));
  const satisfaction = h(ctx, 'satisfaction');
  const avgSat = satisfaction.length ? Math.round(satisfaction.reduce((s, x) => s + (x.overallScore || 0), 0) / satisfaction.length * 10) / 10 : 0;
  const occupancy = beds.length ? Math.round(beds.filter(b => b.status === 'occupied').length / beds.length * 100) : 0;
  return {
    role: ctx.actor.role,
    stats: {
      patients: patients.length, bedsOccupied: beds.filter(b => b.status === 'occupied').length,
      bedsTotal: beds.length, occupancy,
      staff: staff.length,
      openIncidents: openInc.length,
      activeCodes: codes.length, activeMCI: mci.length, activeCrisis: crisis.length,
      pendingRequests: requests.length,
      satisfaction: avgSat
    },
    alerts: { codes, mci, crisis },
    pendingRequests: requests.slice(0, 15)
  };
}

// ═══ QUALITY_OFFICER ═══
function qualityOfficer(ctx) {
  const complaints = h(ctx, 'patient_complaints').filter(c => c.status === 'open');
  const incidents = h(ctx, 'incidents').filter(i => i.status !== 'closed');
  const requests = h(ctx, 'requests').filter(r => r.approverRole === 'quality_officer' && r.status === 'submitted');
  const kpis = h(ctx, 'kpis');
  const pdsa = h(ctx, 'pdsa_cycles').filter(p => p.status === 'active');
  const audits = h(ctx, 'clinical_audits').filter(a => a.status === 'completed');
  return {
    role:'quality_officer',
    stats: {
      openComplaints: complaints.length,
      openIncidents: incidents.length,
      pendingRequests: requests.length,
      kpis: kpis.length,
      activePDSA: pdsa.length,
      completedAudits: audits.length
    },
    complaints: complaints.slice(0, 10),
    incidents: incidents.slice(0, 10),
    pendingRequests: requests.slice(0, 10)
  };
}

// ═══ HR_OFFICER ═══
function hrOfficer(ctx) {
  const staff = h(ctx, 'sa_staff').filter(s => s.active);
  const requests = h(ctx, 'requests').filter(r => r.status === 'submitted');
  const coefficients = h(ctx, 'coefficients').filter(c => c.status === 'draft');
  const appeals = h(ctx, 'appeals').filter(a => a.status === 'open');
  return {
    role:'hr_officer',
    stats: {
      totalStaff: staff.length,
      pendingRequests: requests.length,
      pendingCoefficients: coefficients.length,
      openAppeals: appeals.length
    },
    pendingRequests: requests.slice(0, 10),
    pendingCoefficients: coefficients.slice(0, 10),
    appeals: appeals.slice(0, 5)
  };
}

// ═══ BED_MANAGER ═══
function bedManager(ctx) {
  const beds = h(ctx, 'beds');
  const patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  const edVisits = h(ctx, 'ed_visits').filter(v => v.status === 'boarding');
  const available = beds.filter(b => b.status === 'available');
  const cleaning = beds.filter(b => b.status === 'cleaning');
  const occupancy = beds.length ? Math.round(beds.filter(b => b.status === 'occupied').length / beds.length * 100) : 0;
  return {
    role:'bed_manager',
    stats: {
      bedsTotal: beds.length, available: available.length,
      occupied: beds.filter(b => b.status === 'occupied').length,
      cleaning: cleaning.length, occupancy,
      boarding: edVisits.length
    },
    availableBeds: available.slice(0, 20).map(b => ({
      id:b.id, wardCode:b.wardCode, bedNumber:b.bedNumber, isCritical:b.isCritical
    })),
    boarding: edVisits.slice(0, 10)
  };
}

// ═══ OR_MANAGER ═══
function orManager(ctx) {
  const today_ = today();
  const cases = h(ctx, 'or_schedule').filter(c => c.scheduledDate === today_);
  const rooms = h(ctx, 'or_rooms');
  const pacu = h(ctx, 'or_pacu').filter(p => p.status === 'active');
  return {
    role:'or_manager',
    stats: {
      casesToday: cases.length,
      scheduled: cases.filter(c => c.status === 'scheduled').length,
      inProgress: cases.filter(c => c.status === 'in_progress').length,
      completed: cases.filter(c => c.status === 'completed').length,
      roomsTotal: rooms.length,
      roomsAvailable: rooms.filter(r => r.status === 'available').length,
      pacuCount: pacu.length
    },
    rooms: rooms.map(r => ({ id:r.id, code:r.code, group:r.group, status:r.status })),
    cases: cases
  };
}

// ═══ CSSD_SUPERVISOR ═══
function cssdSupervisor(ctx) {
  const sets = h(ctx, 'cssd_sets');
  const cycles = h(ctx, 'cssd_cycles');
  const recalls = h(ctx, 'cssd_recalls').filter(r => r.status === 'open');
  const byStatus = {};
  sets.forEach(s => { byStatus[s.status] = (byStatus[s.status] || 0) + 1; });
  return {
    role:'cssd_supervisor',
    stats: {
      setsTotal: sets.length, byStatus,
      activeCycles: cycles.filter(c => c.status === 'running').length,
      failedCycles: cycles.filter(c => c.status === 'failed').length,
      openRecalls: recalls.length
    },
    activeCycles: cycles.filter(c => c.status !== 'closed').slice(0, 10),
    recalls: recalls.slice(0, 5),
    sets: sets.slice(0, 20)
  };
}

module.exports = {
  handlers: {
    supervisorER, supervisorSenior, supervisorClinical, supervisorEducation,
    supervisorInfection, nurseAide, intern, surgeon, director,
    qualityOfficer, hrOfficer, bedManager, orManager, cssdSupervisor
  },
  routes: [
    { method:'GET', path:'/api/rde/supervisor_er', handler:'supervisorER', perm:null },
    { method:'GET', path:'/api/rde/supervisor_senior', handler:'supervisorSenior', perm:null },
    { method:'GET', path:'/api/rde/supervisor_clinical', handler:'supervisorClinical', perm:null },
    { method:'GET', path:'/api/rde/supervisor_education', handler:'supervisorEducation', perm:null },
    { method:'GET', path:'/api/rde/supervisor_infection', handler:'supervisorInfection', perm:null },
    { method:'GET', path:'/api/rde/nurse_aide', handler:'nurseAide', perm:null },
    { method:'GET', path:'/api/rde/intern', handler:'intern', perm:null },
    { method:'GET', path:'/api/rde/surgeon', handler:'surgeon', perm:null },
    { method:'GET', path:'/api/rde/director', handler:'director', perm:null },
    { method:'GET', path:'/api/rde/quality_officer', handler:'qualityOfficer', perm:null },
    { method:'GET', path:'/api/rde/hr_officer', handler:'hrOfficer', perm:null },
    { method:'GET', path:'/api/rde/bed_manager', handler:'bedManager', perm:null },
    { method:'GET', path:'/api/rde/or_manager', handler:'orManager', perm:null },
    { method:'GET', path:'/api/rde/cssd_supervisor', handler:'cssdSupervisor', perm:null }
  ],
  panels: []
};
