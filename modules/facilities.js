'use strict';
const store = require('../core/store');
const bus = require('../core/events');
const perms = require('../core/permissions');
const audit = require('../core/audit');
const resolver = require('../core/ward-resolver');

if (!perms.P['fac.view']) {
  Object.assign(perms.P, {
    'fac.view': 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,supervisor_er,head_nurse,bed_manager,quality_officer,attending,specialist,physician,resident,nurse,it_staff',
    'fac.manage': 'admin,hospital_director,nursing_director,bed_manager',
    'fac.ward.config': 'admin,nursing_director,bed_manager',
    'fac.bed.assign': 'admin,head_nurse,bed_manager,nurse',
    'fac.bed.release': 'admin,head_nurse,bed_manager,nurse',
    'fac.bed.maintenance': 'admin,bed_manager,it_staff,head_nurse',
    'fac.bed.delete': 'admin,bed_manager',
    'fac.cleaning': 'admin,nurse_aide,head_nurse,bed_manager'
  });
}

const WARD_GROUPS = ['critical','surgical','internal','neuro','oncology','emergency','special','vip','admin'];
const WARD_TYPES = [
  { code: 'icu',       label: 'ICU',        icon: 'heart',    group: 'critical' },
  { code: 'ccu',       label: 'CCU',        icon: 'cardio',   group: 'critical' },
  { code: 'nicu',      label: 'NICU',       icon: 'baby',     group: 'critical' },
  { code: 'picu',      label: 'PICU',       icon: 'child',    group: 'critical' },
  { code: 'ward',      label: 'Ward',       icon: 'hospital', group: 'internal' },
  { code: 'surgical',  label: 'Surgical',   icon: 'scalpel',  group: 'surgical' },
  { code: 'ortho',     label: 'Ortho',      icon: 'bone',     group: 'surgical' },
  { code: 'neuro',     label: 'Neuro',      icon: 'brain',    group: 'neuro' },
  { code: 'onco',      label: 'Oncology',   icon: 'ribbon',   group: 'oncology' },
  { code: 'emergency', label: 'Emergency',  icon: 'siren',    group: 'emergency' },
  { code: 'or',        label: 'OR',         icon: 'or',       group: 'surgical' },
  { code: 'pacu',      label: 'PACU',       icon: 'bed',      group: 'surgical' },
  { code: 'dialysis',  label: 'Dialysis',   icon: 'drop',     group: 'special' },
  { code: 'cathlab',   label: 'Cath Lab',   icon: 'cath',     group: 'special' },
  { code: 'clinic',    label: 'Clinic',     icon: 'clinic',   group: 'special' },
  { code: 'vip',       label: 'VIP',        icon: 'star',     group: 'vip' },
  { code: 'isolation', label: 'Isolation',  icon: 'iso',      group: 'special' }
];
const WARD_TEMPLATES = {
  icu_8:       { label: 'ICU 8-bed',    type: 'icu',       group: 'critical',  beds: 8,  capabilities: ['monitor','ventilator','central_line','infusion_pump'] },
  icu_12:      { label: 'ICU 12-bed',   type: 'icu',       group: 'critical',  beds: 12, capabilities: ['monitor','ventilator','central_line','infusion_pump'] },
  ccu_10:      { label: 'CCU 10-bed',   type: 'ccu',       group: 'critical',  beds: 10, capabilities: ['ecg_monitor','defibrillator'] },
  er_20:       { label: 'ER 20-bed',    type: 'emergency', group: 'emergency', beds: 20, capabilities: ['crash_cart','defibrillator','triage'] },
  ward_20:     { label: 'Ward 20-bed',  type: 'ward',      group: 'internal',  beds: 20, capabilities: ['iv_pole'] },
  ward_24:     { label: 'Ward 24-bed',  type: 'ward',      group: 'internal',  beds: 24, capabilities: ['iv_pole'] },
  isolation_4: { label: 'Isolation 4-bed', type: 'isolation', group: 'special', beds: 4, capabilities: ['negative_pressure','anteroom'] }
};

function _now() { return new Date().toISOString(); }

function getAllWards() {
  var sa = store.readAll("sa_wards");
  var hw = store.readAll("hospital_wards");
  var hwByCode = {};
  hw.forEach(function(w) { if (w.code) hwByCode[w.code] = w; });
  var seenCodes = new Set();
  var merged = [];
  for (var i = 0; i < sa.length; i++) {
    var w = sa[i];
    var code = w.code;
    if (!code) continue;
    seenCodes.add(code);
    var hwRec = hwByCode[code];
    if (hwRec && hwRec._deleted) continue;
    if (hwRec) {
      merged.push(Object.assign({ _source: "hospital_wards" }, hwRec));
    } else {
      var type = code.indexOf("ICU") === 0 ? "icu" : code === "CCU" ? "ccu" : code === "ER" ? "emergency" : "ward";
      merged.push({
        id: "w_" + code, code: code, label: w.label || code,
        type: type, group: "internal", building: "", floor: "", wing: "",
        phone: "", extension: "", bedsPlanned: w.wk || 10,
        headNurseId: w.headStaffId || null, headNurseName: w.headNurse || null,
        serviceCode: resolver.serviceForWard ? resolver.serviceForWard(code) : null,
        capabilities: [], isActive: true, isClosed: false, isManagement: !!w.isManagement,
        notes: "", createdAt: w.createdAt || _now(),
        _source: "sa_wards"
      });
    }
  }
  for (var j = 0; j < hw.length; j++) {
    var wh = hw[j];
    if (wh.code && !seenCodes.has(wh.code) && !wh._deleted) {
      merged.push(Object.assign({ _source: "hospital_wards" }, wh));
    }
  }
  return merged;
}

function putWard(w) { store.put('hospital_wards', w); }

function computeWardStats(wardCode) {
  var beds = store.readAll('beds').filter(function(b) { return b.wardCode === wardCode; });
  var statuses = { available: 0, occupied: 0, cleaning: 0, maintenance: 0, blocked: 0 };
  beds.forEach(function(b) {
    var st = b.status || 'available';
    if (statuses[st] !== undefined) statuses[st]++;
  });
  var total = beds.length;
  return {
    total: total, statuses: statuses,
    occupancy: total > 0 ? Math.round(statuses.occupied / total * 100) : 0,
    availability: total > 0 ? Math.round(statuses.available / total * 100) : 0
  };
}

var handlers = {
  listWards: function(ctx) {
    var wards = getAllWards();
    if (ctx.query.group) wards = wards.filter(function(w) { return w.group === ctx.query.group; });
    if (ctx.query.active === 'true') wards = wards.filter(function(w) { return w.isActive !== false && !w.isClosed; });
    if (ctx.query.q) {
      var q = String(ctx.query.q).toLowerCase();
      wards = wards.filter(function(w) { return (w.label || '').toLowerCase().indexOf(q) >= 0 || (w.code || '').toLowerCase().indexOf(q) >= 0; });
    }
    wards = wards.map(function(w) { return Object.assign({}, w, { stats: computeWardStats(w.code) }); });
    wards.sort(function(a, b) { return (a.group || '').localeCompare(b.group || '') || (a.label || '').localeCompare(b.label || ''); });
    return { items: wards, total: wards.length, groups: WARD_GROUPS, types: WARD_TYPES };
  },

  getWard: function(ctx) {
    var code = ctx.params.code;
    var w = getAllWards().find(function(x) { return x.code === code; });
    if (!w) throw ctx.E.notFound('ward_not_found');
    var beds = store.readAll('beds').filter(function(b) { return b.wardCode === code; }).map(function(b) {
      var patient = b.patientId ? store.get('patients', b.patientId) : null;
      return Object.assign({}, b, {
        patient: patient ? {
          id: patient.id, name: patient.firstName + ' ' + patient.lastName,
          age: patient.age, sex: patient.sex, diagnosis: patient.diagnosis,
          codeStatus: patient.codeStatus, admittedAt: patient.admittedAt
        } : null
      });
    });
    beds.sort(function(a, b) { return (a.bedNumber || '').localeCompare(b.bedNumber || ''); });
    return { ward: w, beds: beds, stats: computeWardStats(code) };
  },

  createWard: function(ctx) {
    var b = ctx.body || {};
    if (!b.label) throw ctx.E.badRequest('label_required');
    var code = (b.code || 'WARD_' + Date.now().toString(36)).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (getAllWards().some(function(w) { return w.code === code; })) throw ctx.E.conflict('ward_code_exists');
    var rec = {
      id: 'w_' + code, code: code,
      label: String(b.label).slice(0, 100),
      type: b.type || 'ward', group: b.group || 'internal',
      building: String(b.building || '').slice(0, 50), floor: String(b.floor || '').slice(0, 20),
      wing: String(b.wing || '').slice(0, 20),
      phone: String(b.phone || '').slice(0, 30), extension: String(b.extension || '').slice(0, 10),
      headNurseId: b.headNurseId || null, headNurseName: b.headNurseName || null,
      bedsPlanned: Math.max(0, Math.min(200, Number(b.bedsPlanned) || 10)),
      serviceCode: b.serviceCode || (resolver.serviceForWard ? resolver.serviceForWard(code) : null),
      capabilities: Array.isArray(b.capabilities) ? b.capabilities.slice(0, 20) : [],
      isActive: true, isClosed: false, isManagement: false,
      notes: String(b.notes || '').slice(0, 500),
      createdBy: ctx.actor.id, createdAt: _now(), updatedAt: _now()
    };
    putWard(rec);
    audit.write('facilities', 'ward.create', code, ctx.actor, { label: rec.label });
    bus.emit('facilities.ward.created', { ward: rec, actor: ctx.actor });
    var bedsCreated = 0;
    if (b.createBeds === true && rec.bedsPlanned > 0) {
      var r = handlers.bulkCreateBeds(Object.assign({}, ctx, { body: { wardCode: code, count: rec.bedsPlanned, prefix: code + '-', startAt: 1, type: b.bedType || 'regular' } }));
      bedsCreated = r.created;
    }
    return Object.assign({}, rec, { bedsCreated: bedsCreated });
  },

  updateWard: function(ctx) {
    var code = ctx.params.code;
    var w = getAllWards().find(function(x) { return x.code === code; });
    if (!w) throw ctx.E.notFound('ward_not_found');
    var b = ctx.body || {};
    ['label','type','group','building','floor','wing','phone','extension','headNurseId','headNurseName','serviceCode','notes'].forEach(function(k) { if (b[k] !== undefined) w[k] = b[k]; });
    if (b.bedsPlanned !== undefined) w.bedsPlanned = Math.max(0, Math.min(200, Number(b.bedsPlanned)));
    if (b.capabilities !== undefined) w.capabilities = Array.isArray(b.capabilities) ? b.capabilities.slice(0, 20) : [];
    if (b.isActive !== undefined) w.isActive = b.isActive !== false;
    w.updatedAt = _now(); w.updatedBy = ctx.actor.id;
    putWard(w);
    audit.write('facilities', 'ward.update', code, ctx.actor, {});
    bus.emit('facilities.ward.updated', { ward: w, actor: ctx.actor });
    return w;
  },

  deleteWard: function(ctx) {
    var code = ctx.params.code;
    var w = getAllWards().find(function(x) { return x.code === code; });
    if (!w) throw ctx.E.notFound('ward_not_found');
    var beds = store.readAll('beds').filter(function(b) { return b.wardCode === code; });
    if (beds.length) throw ctx.E.conflict('ward_has_beds');
    var patients = store.readAll('patients').filter(function(p) { return p.wardCode === code && (p.status === 'in_care' || p.status === 'admitted'); });
    if (patients.length) throw ctx.E.conflict('ward_has_patients');
    if (w._source === 'sa_wards') {
      var tombstone = Object.assign({}, w, { isActive: false, _deleted: true, deletedAt: _now(), deletedBy: ctx.actor.id });
      delete tombstone._source;
      store.put('hospital_wards', tombstone);
    } else {
      store.remove('hospital_wards', w.id);
    }
    audit.write('facilities', 'ward.delete', code, ctx.actor, { label: w.label });
    bus.emit('facilities.ward.deleted', { ward: w, actor: ctx.actor });
    return { deleted: true, code: code };
  },

  closeWard: function(ctx) {
    var code = ctx.params.code;
    var w = getAllWards().find(function(x) { return x.code === code; });
    if (!w) throw ctx.E.notFound('ward_not_found');
    var b = ctx.body || {};
    if (!b.reason) throw ctx.E.badRequest('reason_required');
    w.isClosed = true;
    w.closedReason = String(b.reason).slice(0, 200);
    w.closedUntil = b.until || null;
    w.closedAt = _now(); w.closedBy = ctx.actor.id;
    w.updatedAt = _now();
    putWard(w);
    audit.write('facilities', 'ward.close', code, ctx.actor, { reason: b.reason });
    bus.emit('facilities.ward.closed', { ward: w, actor: ctx.actor });
    return w;
  },

  openWard: function(ctx) {
    var code = ctx.params.code;
    var w = getAllWards().find(function(x) { return x.code === code; });
    if (!w) throw ctx.E.notFound('ward_not_found');
    w.isClosed = false; w.closedReason = null; w.closedUntil = null;
    w.openedAt = _now(); w.openedBy = ctx.actor.id;
    w.updatedAt = _now();
    putWard(w);
    bus.emit('facilities.ward.opened', { ward: w, actor: ctx.actor });
    return w;
  },

  listBeds: function(ctx) {
    var items = store.readAll('beds');
    if (ctx.query.wardCode) items = items.filter(function(b) { return b.wardCode === ctx.query.wardCode; });
    if (ctx.query.status) {
      var st = String(ctx.query.status).split(',');
      items = items.filter(function(b) { return st.indexOf(b.status) >= 0; });
    }
    if (ctx.query.type) items = items.filter(function(b) { return b.type === ctx.query.type; });
    if (ctx.query.q) {
      var q = String(ctx.query.q).toLowerCase();
      items = items.filter(function(b) { return (b.bedNumber || '').toLowerCase().indexOf(q) >= 0 || (b.roomNumber || '').toLowerCase().indexOf(q) >= 0; });
    }
    items.sort(function(a, b) { return ((a.wardCode || '') + '-' + (a.bedNumber || '')).localeCompare((b.wardCode || '') + '-' + (b.bedNumber || '')); });
    return { items: items, total: items.length };
  },

  bulkCreateBeds: function(ctx) {
    var b = ctx.body || {};
    if (!b.wardCode) throw ctx.E.badRequest('wardCode_required');
    var w = getAllWards().find(function(x) { return x.code === b.wardCode; });
    if (!w) throw ctx.E.notFound('ward_not_found');
    var count = Math.min(200, Number(b.count) || 10);
    var start = Number(b.startAt) || 1;
    var prefix = b.prefix || (b.wardCode + '-');
    var type = b.type || 'regular';
    var existing = new Set(store.readAll('beds').filter(function(x) { return x.wardCode === b.wardCode; }).map(function(x) { return x.bedNumber; }));
    var created = [];
    for (var i = 0; i < count; i++) {
      var num = String(start + i).padStart(2, '0');
      var bedNum = prefix + num;
      if (existing.has(bedNum)) continue;
      var rec = {
        id: 'bed_' + b.wardCode + '_' + bedNum.replace(/[^A-Z0-9]/g, '_'),
        wardCode: b.wardCode, wardLabel: w.label,
        bedNumber: bedNum, roomNumber: b.roomNumber || null,
        status: 'available', patientId: null,
        type: type, isCritical: type === 'icu' || type === 'ccu',
        hasO2: b.hasO2 !== false,
        hasSuction: b.hasSuction === true || type === 'icu',
        hasMonitor: b.hasMonitor === true || type === 'icu' || type === 'monitored',
        hasVentilator: b.hasVentilator === true || type === 'icu',
        hasCallButton: true,
        isIsolation: b.isIsolation === true || type === 'isolation',
        isolationType: b.isolationType || null,
        isNegativePressure: b.isNegativePressure === true,
        isSurge: false,
        genderRestriction: b.genderRestriction || 'mixed',
        ageRestriction: b.ageRestriction || 'adult',
        equipmentIds: [], notes: '',
        createdAt: _now(), createdBy: ctx.actor.id
      };
      store.put('beds', rec);
      created.push(rec);
    }
    bus.emit('facilities.beds.bulk_created', { wardCode: b.wardCode, count: created.length, actor: ctx.actor });
    return { created: created.length, wardCode: b.wardCode };
  },

  updateBed: function(ctx) {
    var bed = store.get('beds', ctx.params.id);
    if (!bed) throw ctx.E.notFound('bed_not_found');
    var b = ctx.body || {};
    ['bedNumber','roomNumber','type','hasO2','hasSuction','hasMonitor','hasVentilator','hasCallButton','isIsolation','isolationType','isNegativePressure','genderRestriction','ageRestriction','notes'].forEach(function(k) { if (b[k] !== undefined) bed[k] = b[k]; });
    if (b.isCritical !== undefined) bed.isCritical = b.isCritical === true;
    bed.updatedAt = _now(); bed.updatedBy = ctx.actor.id;
    store.put('beds', bed);
    bus.emit('facilities.bed.updated', { bed: bed, actor: ctx.actor });
    return bed;
  },

  deleteBed: function(ctx) {
    var bed = store.get('beds', ctx.params.id);
    if (!bed) throw ctx.E.notFound('bed_not_found');
    if (bed.patientId) throw ctx.E.conflict('bed_occupied');
    store.remove('beds', bed.id);
    audit.write('facilities', 'bed.delete', bed.id, ctx.actor, { ward: bed.wardCode });
    bus.emit('facilities.bed.deleted', { bed: bed, actor: ctx.actor });
    return { deleted: true, id: bed.id };
  },

  bulkStatus: function(ctx) {
    var b = ctx.body || {};
    if (!Array.isArray(b.bedIds) || !b.bedIds.length) throw ctx.E.badRequest('bedIds_required');
    if (['available','maintenance','blocked'].indexOf(b.status) < 0) throw ctx.E.badRequest('invalid_status');
    var count = 0;
    var ids = b.bedIds.slice(0, 500);
    for (var i = 0; i < ids.length; i++) {
      var bed = store.get('beds', ids[i]);
      if (!bed || bed.patientId) continue;
      bed.status = b.status;
      if (b.reason) bed.statusReason = b.reason;
      bed.updatedAt = _now(); bed.updatedBy = ctx.actor.id;
      store.put('beds', bed);
      count++;
    }
    bus.emit('facilities.beds.bulk_status', { count: count, status: b.status, actor: ctx.actor });
    return { updated: count, status: b.status };
  },

  assignPatient: function(ctx) {
    var bed = store.get('beds', ctx.params.id);
    if (!bed) throw ctx.E.notFound('bed_not_found');
    if (bed.status === 'occupied') throw ctx.E.conflict('bed_occupied');
    if (bed.status === 'maintenance' || bed.status === 'blocked') throw ctx.E.conflict('bed_' + bed.status);
    var pid = (ctx.body && ctx.body.patientId) || null;
    if (!pid) throw ctx.E.badRequest('patientId_required');
    var patient = store.get('patients', pid);
    if (!patient) throw ctx.E.notFound('patient_not_found');
    if (patient.bedId && patient.bedId !== bed.id) {
      var oldBed = store.get('beds', patient.bedId);
      if (oldBed) { oldBed.status = 'cleaning'; oldBed.patientId = null; oldBed.cleaningStartedAt = _now(); store.put('beds', oldBed); }
    }
    bed.status = 'occupied'; bed.patientId = patient.id; bed.occupiedAt = _now();
    store.put('beds', bed);
    patient.bedId = bed.id; patient.bedNumber = bed.bedNumber;
    patient.wardCode = bed.wardCode; patient.updatedAt = _now();
    store.put('patients', patient);
    bus.emit('facilities.bed.assigned', { bed: bed, patient: patient, actor: ctx.actor });
    return { bed: bed, patient: { id: patient.id, name: patient.firstName + ' ' + patient.lastName } };
  },

  releasePatient: function(ctx) {
    var bed = store.get('beds', ctx.params.id);
    if (!bed) throw ctx.E.notFound('bed_not_found');
    if (!bed.patientId) throw ctx.E.conflict('bed_empty');
    var patient = store.get('patients', bed.patientId);
    bed.status = 'cleaning'; bed.patientId = null;
    bed.cleaningStartedAt = _now(); bed.releasedAt = _now(); bed.releasedBy = ctx.actor.id;
    store.put('beds', bed);
    if (patient) { patient.bedId = null; patient.bedNumber = null; patient.updatedAt = _now(); store.put('patients', patient); }
    bus.emit('facilities.bed.released', { bed: bed, patient: patient, actor: ctx.actor });
    return { bed: bed, patient: patient ? { id: patient.id, name: patient.firstName + ' ' + patient.lastName } : null };
  },

  setBedStatus: function(ctx) {
    var bed = store.get('beds', ctx.params.id);
    if (!bed) throw ctx.E.notFound('bed_not_found');
    var b = ctx.body || {};
    if (!b.status) throw ctx.E.badRequest('status_required');
    if (['available','maintenance','blocked','cleaning'].indexOf(b.status) < 0) throw ctx.E.badRequest('invalid_status');
    if (bed.status === 'occupied') throw ctx.E.conflict('use_release_for_occupied');
    bed.status = b.status;
    if (b.status === 'maintenance') {
      bed.maintenanceReason = b.reason || 'maintenance';
      bed.maintenanceStartedAt = _now();
      bed.maintenanceUntil = b.until || null;
    }
    if (b.status === 'available') {
      bed.maintenanceReason = null; bed.maintenanceStartedAt = null; bed.maintenanceUntil = null;
      bed.statusReason = null;
    }
    bed.updatedAt = _now(); bed.updatedBy = ctx.actor.id;
    store.put('beds', bed);
    bus.emit('facilities.bed.status_changed', { bed: bed, actor: ctx.actor });
    return bed;
  },

  listCleaning: function(ctx) {
    var items = store.readAll('beds').filter(function(b) { return b.status === 'cleaning'; }).map(function(b) {
      return Object.assign({}, b, {
        cleaningDurationMin: b.cleaningStartedAt ? Math.round((Date.now() - new Date(b.cleaningStartedAt).getTime()) / 60000) : null
      });
    });
    items.sort(function(a, b) { return (b.cleaningDurationMin || 0) - (a.cleaningDurationMin || 0); });
    return { items: items, total: items.length };
  },

  startCleaning: function(ctx) {
    var bed = store.get('beds', ctx.params.id);
    if (!bed) throw ctx.E.notFound('bed_not_found');
    if (bed.status !== 'cleaning') throw ctx.E.conflict('bed_not_dirty');
    bed.cleaningStartedAt = bed.cleaningStartedAt || _now();
    bed.cleaningStartedBy = ctx.actor.id;
    bed.cleaningAssignedTo = (ctx.body && ctx.body.assignedTo) || ctx.actor.id;
    bed.updatedAt = _now();
    store.put('beds', bed);
    bus.emit('facilities.cleaning.started', { bed: bed, actor: ctx.actor });
    return bed;
  },

  completeCleaning: function(ctx) {
    var bed = store.get('beds', ctx.params.id);
    if (!bed) throw ctx.E.notFound('bed_not_found');
    if (bed.status !== 'cleaning') throw ctx.E.conflict('bed_not_dirty');
    bed.status = 'available';
    bed.cleaningCompletedAt = _now();
    bed.cleaningCompletedBy = ctx.actor.id;
    bed.cleaningDurationMin = bed.cleaningStartedAt ? Math.round((Date.now() - new Date(bed.cleaningStartedAt).getTime()) / 60000) : null;
    bed.updatedAt = _now();
    store.put('beds', bed);
    bus.emit('facilities.cleaning.completed', { bed: bed, actor: ctx.actor });
    return bed;
  },

  listMaintenance: function(ctx) {
    var items = store.readAll('beds').filter(function(b) { return b.status === 'maintenance'; }).map(function(b) {
      return Object.assign({}, b, {
        daysLeft: b.maintenanceUntil ? Math.round((new Date(b.maintenanceUntil).getTime() - Date.now()) / 86400000) : null,
        overdue: b.maintenanceUntil ? new Date(b.maintenanceUntil).getTime() < Date.now() : false
      });
    });
    items.sort(function(a, b) { return (a.maintenanceUntil || '').localeCompare(b.maintenanceUntil || ''); });
    return { items: items, total: items.length };
  },

  listTemplates: function(ctx) {
    var items = Object.keys(WARD_TEMPLATES).map(function(k) { return Object.assign({ code: k }, WARD_TEMPLATES[k]); });
    return { items: items, total: items.length };
  },

  overview: function(ctx) {
    var wards = getAllWards();
    var beds = store.readAll('beds');
    var statuses = { available: 0, occupied: 0, cleaning: 0, maintenance: 0, blocked: 0 };
    beds.forEach(function(b) { if (statuses[b.status] !== undefined) statuses[b.status]++; });
    var total = beds.length;
    var wardStats = wards.map(function(w) {
      var st = computeWardStats(w.code);
      var typeInfo = WARD_TYPES.find(function(t) { return t.code === w.type; }) || {};
      return {
        code: w.code, label: w.label, group: w.group, type: w.type,
        icon: typeInfo.icon || 'hospital',
        headNurse: w.headNurseName || null,
        isClosed: !!w.isClosed, closedReason: w.closedReason || null,
        total: st.total, statuses: st.statuses, occupancy: st.occupancy, availability: st.availability
      };
    });
    return {
      totalWards: wards.length,
      activeWards: wards.filter(function(w) { return w.isActive !== false && !w.isClosed; }).length,
      closedWards: wards.filter(function(w) { return w.isClosed; }).length,
      totalBeds: total, statuses: statuses,
      occupancy: total > 0 ? Math.round(statuses.occupied / total * 100) : 0,
      wards: wardStats.sort(function(a, b) { return b.occupancy - a.occupancy; }),
      byGroup: WARD_GROUPS.map(function(g) {
        var gw = wardStats.filter(function(w) { return w.group === g; });
        return { group: g, wards: gw.length, beds: gw.reduce(function(s, w) { return s + w.total; }, 0), occupied: gw.reduce(function(s, w) { return s + w.statuses.occupied; }, 0) };
      }).filter(function(g) { return g.wards > 0; }),
      types: WARD_TYPES
    };
  },

  capacityReport: function(ctx) {
    var wards = getAllWards();
    var beds = store.readAll('beds');
    var patients = store.readAll('patients').filter(function(p) { return p.status === 'in_care' || p.status === 'admitted'; });
    var byWard = wards.map(function(w) {
      var wBeds = beds.filter(function(b) { return b.wardCode === w.code; });
      var wPatients = patients.filter(function(p) { return p.wardCode === w.code; });
      return {
        code: w.code, label: w.label, group: w.group,
        bedsTotal: wBeds.length, patients: wPatients.length,
        available: wBeds.filter(function(b) { return b.status === 'available'; }).length,
        cleaning: wBeds.filter(function(b) { return b.status === 'cleaning'; }).length,
        maintenance: wBeds.filter(function(b) { return b.status === 'maintenance'; }).length,
        occupancy: wBeds.length > 0 ? Math.round(wPatients.length / wBeds.length * 100) : 0
      };
    });
    return {
      byWard: byWard,
      criticalWards: byWard.filter(function(w) { return w.occupancy >= 90; }).map(function(w) { return { code: w.code, label: w.label, occupancy: w.occupancy }; }),
      emptyWards: byWard.filter(function(w) { return w.available === 0 && w.occupancy >= 80; }).map(function(w) { return { code: w.code, label: w.label, occupancy: w.occupancy }; }),
      totalCapacity: byWard.reduce(function(s, w) { return s + w.bedsTotal; }, 0),
      totalAvailable: byWard.reduce(function(s, w) { return s + w.available; }, 0)
    };
  }
};

module.exports = {
  handlers: handlers,
  routes: [
    { method: 'GET',  path: '/api/fac/wards',                 handler: 'listWards',        perm: 'fac.view' },
    { method: 'GET',  path: '/api/fac/wards/:code',           handler: 'getWard',          perm: 'fac.view' },
    { method: 'POST', path: '/api/fac/wards',                 handler: 'createWard',       perm: 'fac.ward.config' },
    { method: 'PUT',  path: '/api/fac/wards/:code',           handler: 'updateWard',       perm: 'fac.ward.config' },
    { method: 'DELETE', path: '/api/fac/wards/:code',         handler: 'deleteWard',       perm: 'fac.ward.config' },
    { method: 'POST', path: '/api/fac/wards/:code/close',     handler: 'closeWard',        perm: 'fac.ward.config' },
    { method: 'POST', path: '/api/fac/wards/:code/open',      handler: 'openWard',         perm: 'fac.ward.config' },
    { method: 'GET',  path: '/api/fac/beds',                  handler: 'listBeds',         perm: 'fac.view' },
    { method: 'POST', path: '/api/fac/beds/bulk',             handler: 'bulkCreateBeds',   perm: 'fac.ward.config' },
    { method: 'POST', path: '/api/fac/beds/bulk-status',      handler: 'bulkStatus',       perm: 'fac.ward.config' },
    { method: 'PUT',  path: '/api/fac/beds/:id',              handler: 'updateBed',        perm: 'fac.ward.config' },
    { method: 'DELETE', path: '/api/fac/beds/:id',            handler: 'deleteBed',        perm: 'fac.bed.delete' },
    { method: 'POST', path: '/api/fac/beds/:id/assign',       handler: 'assignPatient',    perm: 'fac.bed.assign' },
    { method: 'POST', path: '/api/fac/beds/:id/release',      handler: 'releasePatient',   perm: 'fac.bed.release' },
    { method: 'POST', path: '/api/fac/beds/:id/status',       handler: 'setBedStatus',     perm: 'fac.bed.maintenance' },
    { method: 'GET',  path: '/api/fac/cleaning',              handler: 'listCleaning',     perm: 'fac.view' },
    { method: 'POST', path: '/api/fac/cleaning/:id/start',    handler: 'startCleaning',    perm: 'fac.cleaning' },
    { method: 'POST', path: '/api/fac/cleaning/:id/complete', handler: 'completeCleaning', perm: 'fac.cleaning' },
    { method: 'GET',  path: '/api/fac/maintenance',           handler: 'listMaintenance',  perm: 'fac.view' },
    { method: 'GET',  path: '/api/fac/templates',             handler: 'listTemplates',    perm: 'fac.view' },
    { method: 'GET',  path: '/api/fac/overview',              handler: 'overview',         perm: 'fac.view' },
    { method: 'GET',  path: '/api/fac/capacity',              handler: 'capacityReport',   perm: 'fac.view' }
  ],
  panels: [
    { id: 'dashboard', title: 'تخت و تاسیسات', icon: 'bed',
      perm: 'fac.view', kind: 'facilities', api: '/api/fac/overview' }
  ]
};

console.log('[facilities] comprehensive backend loaded');
