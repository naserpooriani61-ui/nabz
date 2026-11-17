
const { h, sd } = require('../core/mod-helpers');
const sina = require('../core/sina');
const perms = require('../core/permissions');

const wards = (ctx) => {
  const beds = h(ctx, 'beds');
  const patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  const stats = sina.WARDS.map(w => {
    const wb = beds.filter(b => b.wardCode === w.code);
    const occupied = wb.filter(b => b.status === 'occupied').length;
    const available = wb.filter(b => b.status === 'available').length;
    const total = wb.length;
    return {
      code: w.code, label: w.label, type: w.type, group: w.group,
      headNurse: w.headNurse,
      total: total || w.beds,
      occupied, available,
      occupancyPct: total > 0 ? Math.round((occupied / total) * 100) : 0
    };
  });
  return { items: stats, total: stats.length };
};

const ward = (ctx) => {
  const code = ctx.params.code;
  const w = sina.WARDS.find(x => x.code === code);
  if (!w) throw ctx.E.notFound('ward_not_found');
  const beds = h(ctx, 'beds').filter(b => b.wardCode === code);
  const patients = h(ctx, 'patients');
  const items = beds.map(b => {
    const p = b.patientId ? patients.find(x => x.id === b.patientId) : null;
    return {
      id: b.id, bedNumber: b.bedNumber, status: b.status,
      isCritical: !!b.isCritical,
      patient: p ? {
        id: p.id, name: p.firstName + ' ' + p.lastName,
        age: p.age, diagnosis: p.diagnosis
      } : null
    };
  });
  return { ward: { code: w.code, label: w.label, type: w.type, headNurse: w.headNurse }, items, total: items.length };
};

const assignBed = (ctx) => {
  const bed = ctx.store.get('beds', ctx.params.id);
  if (!bed) throw ctx.E.notFound('bed_not_found');
  if (bed.status !== 'available') throw ctx.E.conflict('bed_not_available');
  const pid = ctx.body.patientId;
  if (!pid) throw ctx.E.badRequest('patient_required');
  const p = ctx.store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  if (p.bedId && p.bedId !== bed.id) {
    const old = ctx.store.get('beds', p.bedId);
    if (old) { old.status = 'cleaning'; old.patientId = null; ctx.store.put('beds', old); }
  }
  bed.status = 'occupied'; bed.patientId = p.id; ctx.store.put('beds', bed);
  p.bedId = bed.id; p.bedNumber = bed.bedNumber; p.wardCode = bed.wardCode;
  ctx.store.put('patients', p);
  ctx.bus.emit('bed.assigned', { bed, patient: p, actor: ctx.actor });
  return { bed, patient: p };
};

const releaseBed = (ctx) => {
  const bed = ctx.store.get('beds', ctx.params.id);
  if (!bed) throw ctx.E.notFound('bed_not_found');
  const p = bed.patientId ? ctx.store.get('patients', bed.patientId) : null;
  bed.status = 'cleaning'; bed.patientId = null; ctx.store.put('beds', bed);
  if (p) { p.bedId = null; p.bedNumber = null; ctx.store.put('patients', p); }
  return { bed, patient: p };
};

const reseed = (ctx) => {
  const bedsBefore = h(ctx, 'beds').length;
  const staffBefore = h(ctx, 'wf_staff').length;
  for (const b of h(ctx, 'beds')) ctx.store.remove('beds', b.id);
  for (const s of h(ctx, 'wf_staff')) ctx.store.remove('wf_staff', s.id);
  for (const w of sina.WARDS) {
    if (!w.beds || w.beds < 1) continue;
    for (let i = 1; i <= w.beds; i++) {
      ctx.store.put('beds', {
        id: 'bed_' + w.code + '_' + i,
        wardCode: w.code, wardLabel: w.label,
        bedNumber: w.code + '-' + String(i).padStart(2, '0'),
        status: 'available', patientId: null,
        isCritical: ['icu','ccu','emergency'].includes(w.type)
      });
    }
  }
  for (let i = 0; i < sina.STAFF.length; i++) {
    const s = sina.STAFF[i];
    ctx.store.put('wf_staff', {
      id: 'staff_' + (i + 1),
      fullName: s.firstName + ' ' + s.lastName,
      firstName: s.firstName, lastName: s.lastName,
      role: s.role, ward: s.ward,
      personnelCode: s.personnelCode,
      employmentType: s.employmentType,
      position: s.position,
      active: true, oncallEligible: true,
      createdAt: ctx.now()
    });
  }
  const patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  const freeBeds = h(ctx, 'beds').filter(b => b.status === 'available');
  for (let i = 0; i < patients.length && i < freeBeds.length; i++) {
    const p = patients[i], b = freeBeds[i];
    b.status = 'occupied'; b.patientId = p.id;
    ctx.store.put('beds', b);
    p.bedId = b.id; p.bedNumber = b.bedNumber; p.wardCode = b.wardCode;
    ctx.store.put('patients', p);
  }
  return {
    bedsBefore, staffBefore,
    bedsAfter: h(ctx, 'beds').length,
    staffAfter: h(ctx, 'wf_staff').length,
    wardsLoaded: sina.WARDS.filter(w => w.beds > 0).length,
    patientsReassigned: Math.min(patients.length, freeBeds.length)
  };
};

const stats = (ctx) => {
  const beds = h(ctx, 'beds');
  const wardsData = sina.WARDS.filter(w => w.beds > 0);
  const occ = beds.filter(b => b.status === 'occupied').length;
  const avail = beds.filter(b => b.status === 'available').length;
  return {
    totalWards: wardsData.length,
    totalBeds: beds.length,
    occupied: occ,
    available: avail,
    occupancyPct: beds.length ? Math.round((occ / beds.length) * 100) : 0,
    staffCount: h(ctx, 'wf_staff').length
  };
};

const seedRealPatients = (ctx) => {
  const realSeed = require('../core/real-seed');
  return realSeed.seedReal();
};

module.exports = {
  handlers: { wards, ward, assignBed, releaseBed, reseed, seedRealPatients, stats },
  routes: [
    { method:'POST', path:'/api/bedboard/reseed-sina',  handler:'reseed',     perm:'admin.users.manage' },
    { method:'POST', path:'/api/bedboard/seed-real',    handler:'seedRealPatients', perm:'admin.users.manage' },
    { method:'GET',  path:'/api/bedboard/wards',        handler:'wards',      perm:null },
    { method:'GET',  path:'/api/bedboard/ward/:code',   handler:'ward',       perm:null },
    { method:'POST', path:'/api/bedboard/bed/:id/assign',  handler:'assignBed',  perm:'patients.transfer' },
    { method:'POST', path:'/api/bedboard/bed/:id/release', handler:'releaseBed', perm:'patients.transfer' },
    { method:'GET',  path:'/api/bedboard/stats',        handler:'stats',      perm:null }
  
  ],
  panels: [
    { id:'wards', title:'نقشه تخت', icon:'🛏️', perm:null, kind:'bedboard', api:'/api/bedboard/wards' }
  ]
};
