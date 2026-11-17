'use strict';
const { h, sd } = require('../core/mod-helpers');
const sina = require('../core/sina');

function today() { return new Date().toISOString().slice(0, 10); }

function computeNews(v) {
  let t = 0;
  const rr = Number(v.rr) || 0;
  if (rr) t += rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3;
  const spo2 = Number(v.spo2) || 0;
  if (spo2) t += spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0;
  const sbp = Number(v.bp_sys) || 0;
  if (sbp) t += sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3;
  const hr = Number(v.hr) || 0;
  if (hr) t += hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3;
  const temp = Number(v.temp) || 0;
  if (temp) t += temp <= 35 ? 3 : temp <= 36 ? 1 : temp <= 38 ? 0 : temp <= 39 ? 1 : 2;
  const risk = t >= 7 ? 'critical' : t >= 5 ? 'high' : t >= 1 ? 'medium' : 'low';
  return { total: t, risk };
}

// ─── Available beds grouped by ward ───
function availableBeds(ctx) {
  const beds = h(ctx, 'beds').filter(b => b.status === 'available');
  const wardMap = {};
  for (const w of sina.WARDS) wardMap[w.code] = w;
  const groups = {};
  for (const b of beds) {
    const w = wardMap[b.wardCode] || { code: b.wardCode, label: b.wardCode, group: 'other', headNurse: '—' };
    if (!groups[w.group]) groups[w.group] = { group: w.group, wards: {} };
    if (!groups[w.group].wards[w.code]) {
      groups[w.group].wards[w.code] = {
        code: w.code, label: w.label, headNurse: w.headNurse || '—',
        beds: []
      };
    }
    groups[w.group].wards[w.code].beds.push({ id: b.id, bedNumber: b.bedNumber, isCritical: !!b.isCritical });
  }
  return {
    groups: Object.values(groups).map(g => ({
      group: g.group,
      wards: Object.values(g.wards).sort((a, b) => b.beds.length - a.beds.length)
    })),
    totalAvailable: beds.length
  };
}

// ─── Admit patient ───
function admit(ctx) {
  const b = ctx.body || {};
  if (!b.bedId) throw ctx.E.badRequest('bed_required');
  if (!b.firstName || !b.lastName) throw ctx.E.badRequest('name_required');
  if (!b.sex) throw ctx.E.badRequest('sex_required');

  const bed = ctx.store.get('beds', b.bedId);
  if (!bed) throw ctx.E.notFound('bed_not_found');
  if (bed.status !== 'available') throw ctx.E.conflict('bed_not_available');

  const mrn = (b.mrn || 'MRN-' + Date.now().toString(36).toUpperCase().slice(-6)).trim();
  const patient = {
    id: ctx.uid('pat'),
    mrn,
    firstName: b.firstName.trim(),
    lastName: b.lastName.trim(),
    age: b.age ? Number(b.age) : null,
    sex: b.sex,
    wardCode: bed.wardCode,
    bedId: bed.id,
    bedNumber: bed.bedNumber,
    diagnosis: (b.diagnosis || '').trim(),
    comorbidities: Array.isArray(b.comorbidities) ? b.comorbidities : [],
    allergies: Array.isArray(b.allergies) ? b.allergies : [],
    codeStatus: b.codeStatus || 'full',
    admissionType: b.admissionType || 'elective',
    status: 'in_care',
    admittedAt: ctx.now(),
    admittedBy: ctx.actor.id,
    admittedByName: ctx.actor.username,
    createdAt: ctx.now()
  };

  ctx.store.put('patients', patient);
  bed.status = 'occupied';
  bed.patientId = patient.id;
  ctx.store.put('beds', bed);

  // Initial vitals (if provided)
  let vitalsId = null;
  if (b.vitals && (b.vitals.hr || b.vitals.bp_sys || b.vitals.spo2 || b.vitals.temp || b.vitals.rr)) {
    const news = computeNews(b.vitals);
    const vit = {
      id: ctx.uid('vit'),
      patientId: patient.id,
      patientName: patient.firstName + ' ' + patient.lastName,
      wardCode: bed.wardCode,
      bedNumber: bed.bedNumber,
      recordedAt: ctx.now(),
      recordedBy: ctx.actor.id,
      hr: Number(b.vitals.hr) || null,
      bp_sys: Number(b.vitals.bp_sys) || null,
      bp_dia: Number(b.vitals.bp_dia) || null,
      rr: Number(b.vitals.rr) || null,
      temp: Number(b.vitals.temp) || null,
      spo2: Number(b.vitals.spo2) || null,
      onOxygen: !!b.vitals.onOxygen,
      gcs: 15,
      consciousness: 'alert',
      news2: news.total,
      newsLevel: news.risk,
      notes: 'ثبت اولیه پذیرش'
    };
    require('../core/domain/vitals-writer').record(ctx, vit);
    vitalsId = vit.id;
  }

  // Auto-assign to current nurse
  let assignmentId = null;
  if (['nurse', 'nurse_aide', 'assistant_nurse'].includes(ctx.actor.role)) {
    const date = today();
    let shift = h(ctx, 'shift_assignments').find(s =>
      s.date === date && s.wardCode === bed.wardCode && s.status !== 'closed');
    if (!shift) {
      shift = {
        id: ctx.uid('shf'), date,
        wardCode: bed.wardCode, shift: 'morning',
        status: 'open', assignments: [],
        createdAt: ctx.now()
      };
    }
    const asg = {
      id: ctx.uid('asg'),
      patientId: patient.id,
      patientName: patient.firstName + ' ' + patient.lastName,
      bedNumber: bed.bedNumber,
      nurseId: ctx.actor.id,
      nurseName: ctx.actor.username,
      role: 'primary',
      status: 'accepted',
      assignedAt: ctx.now()
    };
    shift.assignments = shift.assignments || [];
    shift.assignments.push(asg);
    ctx.store.put('shift_assignments', shift);
    assignmentId = asg.id;
  }

  ctx.audit.write('flow', 'admit', patient.id, ctx.actor, {
    bedId: bed.id, ward: bed.wardCode, vitalsId, assignmentId
  });
  ctx.bus.emit('patients.created', { record: patient, actor: ctx.actor });
  if (vitalsId) ctx.bus.emit('vitals.recorded', { record: ctx.store.get('vitals', vitalsId), actor: ctx.actor });

  return { patient, vitalsId, assignmentId };
}

// ─── Discharge patient ───
function discharge(ctx) {
  const pid = ctx.params.patientId;
  const b = ctx.body || {};
  const p = ctx.store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  if (p.status === 'discharged') throw ctx.E.conflict('already_discharged');

  const dischargeType = b.dischargeType || 'home';
  const reason = (b.reason || '').trim();

  // Create discharge record
  const plan = {
    id: ctx.uid('dsc'),
    patientId: p.id,
    patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode,
    status: 'completed',
    dischargeType,
    reason,
    summary: {
      finalDiagnosis: p.diagnosis || '',
      medications: [],
      followupInstructions: b.followupInstructions || ''
    },
    plannedAt: ctx.now(),
    plannedBy: ctx.actor.id,
    completedAt: ctx.now(),
    completedBy: ctx.actor.id,
    completedByName: ctx.actor.username
  };
  require('../core/domain/discharge-writer').put(ctx, plan);

  // Free the bed → cleaning
  if (p.bedId) {
    const bed = ctx.store.get('beds', p.bedId);
    if (bed) {
      bed.status = 'cleaning';
      bed.patientId = null;
      ctx.store.put('beds', bed);
    }
  }

  // Update patient
  p.status = 'discharged';
  p.dischargedAt = ctx.now();
  p.dischargedBy = ctx.actor.id;
  p.dischargeType = dischargeType;
  p.dischargeReason = reason;
  ctx.store.put('patients', p);

  ctx.audit.write('flow', 'discharge', p.id, ctx.actor, {
    dischargeType, bedId: p.bedId, wardCode: p.wardCode
  });
  ctx.bus.emit('patients.discharged', { record: p, actor: ctx.actor });

  return { patient: p, plan };
}

// ─── Pipeline stats ───
function pipeline(ctx) {
  const date = today();
  const patients = h(ctx, 'patients');
  const admits = patients.filter(p => (p.admittedAt || '').slice(0, 10) === date);
  const discharges = h(ctx, 'discharges').filter(d => (d.completedAt || '').slice(0, 10) === date);
  const active = patients.filter(p => ['in_care','admitted'].includes(p.status));
  const byWard = {};
  for (const p of active) {
    if (!byWard[p.wardCode]) byWard[p.wardCode] = 0;
    byWard[p.wardCode]++;
  }
  return {
    date,
    admissionsToday: admits.length,
    dischargesToday: discharges.length,
    activePatients: active.length,
    byWard,
    recentAdmits: admits.sort((a, b) => sd(b.admittedAt) - sd(a.admittedAt)).slice(0, 10).map(p => ({
      id: p.id, name: p.firstName + ' ' + p.lastName, ward: p.wardCode, bed: p.bedNumber,
      at: p.admittedAt, admittedBy: p.admittedByName
    })),
    recentDischarges: discharges.sort((a, b) => sd(b.completedAt) - sd(a.completedAt)).slice(0, 10).map(d => ({
      id: d.id, patientId: d.patientId, name: d.patientName, ward: d.wardCode,
      at: d.completedAt, by: d.completedByName, type: d.dischargeType
    }))
  };
}

module.exports = {
  handlers: { availableBeds, admit, discharge, pipeline },
  routes: [

    { method: 'GET',  path: '/api/flow/available-beds', handler: 'availableBeds', perm: 'patients.view' },
    { method: 'POST', path: '/api/flow/admit', handler: 'admit', perm: 'patients.create' },
    { method: 'GET',  path: '/api/flow/pipeline', handler: 'pipeline', perm: 'patients.view' },
    { method: 'POST', path: '/api/flow/discharge/:patientId', handler: 'discharge', perm: 'patients.update' },
  
  ],
  panels: [
    { id:'pipeline', title:'جریان بیمار', icon:'🔄', perm:'patients.view', kind:'pipeline', api:'/api/flow/pipeline' }
  ]
};
