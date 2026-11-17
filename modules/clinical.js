
'use strict';
const signature = require('../core/signature');
const perms = require('../core/permissions');
const sm = require('../core/state-machine');
const neural = require('../core/neural');
const HIGH_ALERT = ['insulin','heparin','warfarin','morphine','fentanyl','potassium','digoxin','chemotherapy','methotrexate','opioid','norepinephrine','epinephrine','amiodarone','lidocaine'];

// Permission for allergy override
if (!perms.P['kardex.mar.override_allergy']) {
  perms.P['kardex.mar.override_allergy'] = 'admin,attending,specialist';
}

// Cross-reactivity table for allergy checks
const CROSS_REACTIVITY = {
  'penicillin': ['amoxicillin','ampicillin','piperacillin','methicillin','oxacillin','nafcillin','augmentin','unasyn','penicillin','amoxi'],
  'cephalosporin': ['cefazolin','ceftriaxone','cefepime','cefuroxime','cephalexin','ceftazidime','ceftaroline','cefotaxime'],
  'sulfa': ['sulfamethoxazole','sulfasalazine','trimethoprim-sulfamethoxazole','cotrimoxazole','bactrim','sulfadiazine'],
  'nsaid': ['ibuprofen','naproxen','diclofenac','ketorolac','indomethacin','piroxicam','meloxicam','celecoxib'],
  'aspirin': ['aspirin','asa','acetylsalicylic'],
  'opioid': ['morphine','fentanyl','codeine','oxycodone','hydrocodone','tramadol','meperidine','methadone'],
  'codeine': ['codeine','morphine','tramadol'],
  'iodine': ['iodine','contrast','iodixanol','iohexol'],
  'latex': ['latex']
};

function checkAllergy(patient, drugName) {
  if (!patient) return { ok: true };
  const aller = patient.allergies || [];
  if (!aller.length) return { ok: true };
  const d = String(drugName || '').toLowerCase().trim();
  if (!d) return { ok: true };

  for (const raw of aller) {
    const a = String(raw || '').toLowerCase().trim();
    if (!a) continue;
    if (d.indexOf(a) >= 0) {
      return { ok: false, allergy: raw, reason: 'direct_match', severity: 'critical' };
    }
    const group = CROSS_REACTIVITY[a];
    if (group) {
      for (const alt of group) {
        if (d.indexOf(alt) >= 0) {
          return { ok: false, allergy: raw, reason: 'cross_' + alt, severity: 'critical' };
        }
      }
    }
    for (const [groupName, members] of Object.entries(CROSS_REACTIVITY)) {
      if (members.some(m => a.indexOf(m) >= 0)) {
        if (d.indexOf(groupName) >= 0 || members.some(m => d.indexOf(m) >= 0)) {
          return { ok: false, allergy: raw, reason: 'cross_group_' + groupName, severity: 'critical' };
        }
      }
    }
  }
  return { ok: true };
}

function normDrug(s) {
  return String(s || '').toLowerCase().replace(/[\s\-_]/g, '').replace(/^(tab|cap|inj|syr|susp)/, '').replace(/(tab|cap|inj|syr|susp|hcl|sodium|potassium)$/, '');
}
function normDose(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '').replace(/microgram|mcg|μg/g, 'mcg').replace(/milligram|mg/g, 'mg');
}
function normRoute(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '').replace('intravenous', 'iv').replace('oral', 'po').replace('intramuscular', 'im').replace('subcutaneous', 'sc');
}

function h(ctx, c) { try { const r = ctx.store.readAll(c); return Array.isArray(r) ? r : Object.values(r || {}); } catch (_) { return []; } }
function sd(x) { if (!x) return 0; const d = new Date(x); return isNaN(d.getTime()) ? 0 : d.getTime(); }
function num(x) { if (x == null || x === '') return null; const n = Number(x); return isNaN(n) ? null : n; }
function sign(ctx, coll, rec, action) {
  const sig = signature.signAction({ userId: ctx.actor.id, userName: ctx.actor.username, role: ctx.actor.role,
    action, collection: coll, recordId: rec.id, data: rec });
  ctx.store.put('signatures', sig);
  rec.lastSignatureId = sig.id;
  return sig;
}

function calcNEWS2(v) {
  return require('../core/domain/news2').calc(v);
}

function isHigh(drug) { return HIGH_ALERT.some(d => (drug || '').toLowerCase().includes(d)); }

const handlers = {
  patients: (ctx) => {
    let items = perms.scope(ctx.actor, h(ctx, 'patients'));
    if (ctx.query.status) items = items.filter(p => p.status === ctx.query.status);
    items.sort((a, b) => sd(b.admittedAt) - sd(a.admittedAt));
    return { items, total: items.length };
  },
  patientCreate: (ctx) => {
    const b = ctx.body;
    if (!b.firstName || !b.lastName || !b.sex || !b.bedId) throw ctx.E.badRequest('missing_fields');
    const bed = ctx.store.get('beds', b.bedId);
    if (!bed || bed.status !== 'available') throw ctx.E.conflict('bed_not_available');
    const rec = { id: ctx.uid('pat'), mrn: b.mrn || 'MRN-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      firstName: b.firstName, lastName: b.lastName, age: num(b.age), sex: b.sex,
      wardCode: bed.wardCode, bedId: bed.id, bedNumber: bed.bedNumber,
      diagnosis: b.diagnosis || '', comorbidities: b.comorbidities || [], allergies: b.allergies || [],
      codeStatus: b.codeStatus || 'full', admissionType: b.admissionType || 'elective',
      status: 'in_care', admittedAt: ctx.now(), createdAt: ctx.now() };
    ctx.store.put('patients', rec);
    bed.status = 'occupied'; bed.patientId = rec.id; ctx.store.put('beds', bed);
    sign(ctx, 'patients', rec, 'create');
    ctx.bus.emit('patients.created', { record: rec, actor: ctx.actor });
    return rec;
  },
  patientUpdate: (ctx) => {
    const p = ctx.store.get('patients', ctx.params.id);
    if (!p) throw ctx.E.notFound('patient_not_found');
    Object.assign(p, ctx.body, { updatedAt: ctx.now() });
    ctx.store.put('patients', p);
    ctx.bus.emit('patients.updated', { record: p, actor: ctx.actor });
    return p;
  },
  patientDetail: (ctx) => {
    const p = ctx.store.get('patients', ctx.params.id);
    if (!p) throw ctx.E.notFound('patient_not_found');
    const vitals = h(ctx, 'vitals').filter(v => v.patientId === p.id).sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
    const orders = h(ctx, 'orders').filter(o => o.patientId === p.id);
    const mar = h(ctx, 'mar').filter(m => m.patientId === p.id && ['scheduled','due'].includes(m.status));
    const risk = neural.patientRisk(p, { lastVital: vitals[0] });
    return { patient: p, vitals: vitals.slice(0, 10), orders, marDue: mar, risk };
  },

  vitals: (ctx) => {
    let items = perms.scope(ctx.actor, h(ctx, 'vitals'));
    if (ctx.query.patientId) items = items.filter(v => v.patientId === ctx.query.patientId);
    items.sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
    return { items: items.slice(0, 100), total: items.length };
  },
  vitalsAdd: (ctx) => {
    const b = ctx.body;
    if (!b.patientId) throw ctx.E.badRequest('patient_id_required');
    const p = ctx.store.get('patients', b.patientId);
    if (!p) throw ctx.E.notFound('patient_not_found');
    const rec = { patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
      wardCode: p.wardCode, bedNumber: p.bedNumber, recordedAt: b.recordedAt || ctx.now(),
      recordedBy: ctx.actor.id, hr: num(b.hr), bp_sys: num(b.bp_sys), bp_dia: num(b.bp_dia),
      rr: num(b.rr), temp: num(b.temp), spo2: num(b.spo2), onOxygen: !!b.onOxygen,
      gcs: num(b.gcs), pain: num(b.pain), consciousness: b.consciousness || 'alert',
      notes: b.notes || '' };
    require('../core/domain/vitals-writer').record(ctx, rec, {
      sign: (r, c) => sign(c, 'vitals', r, 'add')
    });
    return rec;
  },
  vitalsChart: (ctx) => {
    const pid = ctx.params.patientId;
    const items = h(ctx, 'vitals').filter(v => v.patientId === pid).sort((a, b) => sd(a.recordedAt) - sd(b.recordedAt));
    return { patientId: pid, series: items.map(v => ({
      t: v.recordedAt, hr: v.hr, sbp: v.bp_sys, dbp: v.bp_dia, spo2: v.spo2, temp: v.temp, news: v.news2
    })) };
  },

  orders: (ctx) => {
    let items = perms.scope(ctx.actor, h(ctx, 'orders'));
    if (ctx.query.patientId) items = items.filter(o => o.patientId === ctx.query.patientId);
    items.sort((a, b) => sd(b.orderedAt) - sd(a.orderedAt));
    return { items, total: items.length };
  },
  orderCreate: (ctx) => {
    const b = ctx.body;
    if (!b.patientId || !b.type || !b.details) throw ctx.E.badRequest('missing_fields');
    const p = ctx.store.get('patients', b.patientId);
    if (!p) throw ctx.E.notFound('patient_not_found');

    // ═══ ALLERGY CHECK ═══
    if (b.type === 'medication' && b.details.drug) {
      const al = checkAllergy(p, b.details.drug);
      if (!al.ok) {
        if (!b.overrideReason) {
          throw ctx.E.conflict('allergy_conflict: ' + al.allergy + ' (' + al.reason + ')');
        }
        if (!perms.can(ctx.actor.role, 'kardex.mar.override_allergy')) {
          throw ctx.E.forbidden('allergy_override_requires_attending');
        }
      }
    }

    const rec = { id: ctx.uid('ord'), patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
      wardCode: p.wardCode, type: b.type, priority: b.priority || 'routine', details: b.details,
      status: 'pending', orderedBy: ctx.actor.id, orderedAt: ctx.now(),
      allergyOverrideReason: b.overrideReason || null };
    require('../core/domain/order-writer').create(ctx, rec);
    sign(ctx, 'orders', rec, 'create');
    if (rec.allergyOverrideReason) {
      ctx.bus.emit('safety.allergy_override', { record: rec, reason: rec.allergyOverrideReason, actor: ctx.actor });
    }
    return rec;
  },
  orderAction: (ctx) => {
    const o = ctx.store.get('orders', ctx.params.id);
    if (!o) throw ctx.E.notFound('order_not_found');
    const fields = {};
    fields[ctx.params.action + 'By'] = ctx.actor.id;
    fields[ctx.params.action + 'At'] = ctx.now();
    if (ctx.params.action === 'cancel') fields.cancelReason = ctx.body.reason || '';
    require('../core/domain/order-writer').transition(ctx, ctx.params.id, ctx.params.action, {
      fields,
      event: 'kardex.order.' + ctx.params.action,
      after: (order, c) => {
        if (ctx.params.action === 'verify' && order.type === 'medication' && !order.details.prn) {
          generateMAR(c, order);
        }
      }
    });
    sign(ctx, 'orders', o, ctx.params.action);
    return o;
  },

  mar: (ctx) => {
    let items = perms.scope(ctx.actor, h(ctx, 'mar'));
    if (ctx.query.patientId) items = items.filter(m => m.patientId === ctx.query.patientId);
    if (ctx.query.status) items = items.filter(m => m.status === ctx.query.status);
    const now = Date.now();
    for (const m of items) if (m.status === 'scheduled' && sd(m.scheduledAt) - now < 30 * 60000) m.status = 'due';
    items.sort((a, b) => sd(a.scheduledAt) - sd(b.scheduledAt));
    return { items: items.slice(0, 100), total: items.length };
  },
  marAdminister: (ctx) => {
    const m = ctx.store.get('mar', ctx.params.id);
    if (!m) throw ctx.E.notFound('mar_not_found');
    const b = ctx.body;

    const errors = [];
    let rightsMode = null;
    const hasReal = b.rights && typeof b.rights === 'object' &&
                    (b.rights.patientId || b.rights.drugName || b.rights.dose || b.rights.route);
    const hasLegacy = b.fiveRights && typeof b.fiveRights === 'object';

    if (hasReal) {
      rightsMode = 'verified';
      if (b.rights.patientId !== m.patientId) errors.push('patient');
      if (normDrug(b.rights.drugName) !== normDrug(m.drugName)) errors.push('drug');
      if (normDose(b.rights.dose) !== normDose(m.dose)) errors.push('dose');
      if (normRoute(b.rights.route) !== normRoute(m.route)) errors.push('route');
      const drift = Math.abs(Date.now() - sd(m.scheduledAt));
      if (drift > 30 * 60000 && !b.overrideReason) errors.push('time');
    } else if (hasLegacy) {
      rightsMode = 'attested';
      const missing = ['patient','drug','dose','route','time'].filter(r => !b.fiveRights[r]);
      if (missing.length) errors.push(...missing);
      const drift = Math.abs(Date.now() - sd(m.scheduledAt));
      if (drift > 60 * 60000 && !b.overrideReason) errors.push('time_attested');
    } else {
      throw ctx.E.badRequest('rights_required');
    }

    if (errors.length) throw ctx.E.conflict('five_rights_failed: ' + errors.join(','));

    // Allergy recheck
    const p = ctx.store.get('patients', m.patientId);
    if (p) {
      const al = checkAllergy(p, m.drugName);
      if (!al.ok) {
        if (!b.overrideReason) {
          throw ctx.E.conflict('allergy_conflict: ' + al.allergy + ' (' + al.reason + ')');
        }
        if (!perms.can(ctx.actor.role, 'kardex.mar.override_allergy')) {
          throw ctx.E.forbidden('allergy_override_requires_attending');
        }
      }
    }

    // High alert witness validation
    const high = m.isHighAlert || isHigh(m.drugName);
    let witnessRecord = null;
    if (high) {
      if (!b.witnessedBy) throw ctx.E.badRequest('witness_required');
      if (b.witnessedBy === ctx.actor.id) throw ctx.E.badRequest('witness_must_differ');
      witnessRecord = ctx.store.readAll('users').find(u =>
        (u.id === b.witnessedBy || u.username === b.witnessedBy) && u.active !== false
      );
      if (!witnessRecord) throw ctx.E.badRequest('witness_not_valid_user');
    }

    const r = sm.transition('mar', m, 'administer', ctx.actor, { fiveRights: true, isHighAlert: high, witnessedBy: b.witnessedBy });
    if (!r.ok) throw ctx.E.conflict(r.reason);

    m.status = 'given';
    m.administeredAt = ctx.now();
    m.administeredBy = ctx.actor.id;
    m.administeredByName = ctx.actor.fullName || ctx.actor.username;
    m.witnessedBy = witnessRecord ? witnessRecord.id : null;
    m.witnessedByName = witnessRecord ? (witnessRecord.fullName || witnessRecord.username) : null;
    m.rightsMode = rightsMode;
    m.rightsDetail = hasReal ? b.rights : (b.fiveRights || null);
    m.allergyOverrideReason = b.overrideReason || null;
    m.notes = b.notes || '';
    sign(ctx, 'mar', m, 'administer');
    require('../core/domain/mar-writer').update(ctx, m, { event: 'kardex.mar.given' });
    if (m.allergyOverrideReason) {
      ctx.bus.emit('safety.allergy_override', { record: m, reason: m.allergyOverrideReason, actor: ctx.actor });
    }
    return m;
  },
  marRefuse: (ctx) => {
    const m = ctx.store.get('mar', ctx.params.id);
    if (!m) throw ctx.E.notFound('mar_not_found');
    if (!ctx.body.reason) throw ctx.E.badRequest('reason_required');
    m.status = 'refused'; m.notes = 'رد: ' + ctx.body.reason;
    m.refusedReason = ctx.body.reason;
    m.refusedBy = ctx.actor.id; m.refusedAt = ctx.now();
    sign(ctx, 'mar', m, 'refuse');
    require('../core/domain/mar-writer').update(ctx, m, { event: 'kardex.mar.refused' });
    return m;
  },

  io: (ctx) => {
    let items = perms.scope(ctx.actor, h(ctx, 'io_records'));
    if (ctx.query.patientId) items = items.filter(r => r.patientId === ctx.query.patientId);
    items.sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
    return { items, total: items.length };
  },
  ioAdd: (ctx) => {
    const b = ctx.body;
    if (!b.patientId || !b.type || b.volume == null) throw ctx.E.badRequest('missing_fields');
    const p = ctx.store.get('patients', b.patientId);
    if (!p) throw ctx.E.notFound('patient_not_found');
    const rec = { id: ctx.uid('io'), patientId: p.id, wardCode: p.wardCode,
      type: b.type, subtype: b.subtype || 'other', volume: Number(b.volume),
      recordedAt: b.recordedAt || ctx.now(), recordedBy: ctx.actor.id, notes: b.notes || '' };
    ctx.store.put('io_records', rec);
    ctx.bus.emit('kardex.io.recorded', { record: rec, actor: ctx.actor });
    return rec;
  },
  ioBalance: (ctx) => {
    const pid = ctx.params.patientId;
    const since = Date.now() - 24 * 3600000;
    const items = h(ctx, 'io_records').filter(r => r.patientId === pid && sd(r.recordedAt) >= since);
    const inSum = items.filter(r => r.type === 'intake').reduce((s, r) => s + r.volume, 0);
    const outSum = items.filter(r => r.type === 'output').reduce((s, r) => s + r.volume, 0);
    return { patientId: pid, intake: inSum, output: outSum, balance: inSum - outSum,
      status: (inSum - outSum) < -1000 ? 'critical' : (inSum - outSum) < -500 ? 'warning' : 'normal' };
  },

  clinicalStats: (ctx) => {
    const patients = perms.scope(ctx.actor, h(ctx, 'patients'));
    const vitals = perms.scope(ctx.actor, h(ctx, 'vitals'));
    const mar = perms.scope(ctx.actor, h(ctx, 'mar'));
    return {
      patients: { total: patients.length, active: patients.filter(p => ['in_care','admitted'].includes(p.status)).length },
      vitals: { today: vitals.filter(v => sd(v.recordedAt) > Date.now() - 86400000).length,
                critical: vitals.filter(v => v.news2 >= 7 && sd(v.recordedAt) > Date.now() - 86400000).length },
      mar: { due: mar.filter(m => m.status === 'due').length, missed: mar.filter(m => m.status === 'missed').length }
    };
  }
};

function generateMAR(ctx, order) {
  const freqMap = { OD:['08:00'], BID:['08:00','20:00'], TID:['08:00','14:00','20:00'],
                    QID:['06:00','12:00','18:00','22:00'], Q6H:['00:00','06:00','12:00','18:00'],
                    Q8H:['00:00','08:00','16:00'], Q12H:['08:00','20:00'] };
  const d = order.details || {};
  const times = freqMap[d.frequency] || ['08:00'];
  const days = d.durationDays || 1;
  const batch = [];
  for (let day = 0; day < days; day++) {
    for (const t of times) {
      const [hh, mm] = t.split(':').map(Number);
      const sched = new Date(); sched.setDate(sched.getDate() + day); sched.setHours(hh, mm, 0, 0);
      batch.push({ id: ctx.uid('mar'), orderId: order.id, patientId: order.patientId,
        patientName: order.patientName, wardCode: order.wardCode,
        drugName: d.drug || d.name || '', dose: d.dose || '', route: d.route || '',
        scheduledAt: sched.toISOString(), status: 'scheduled',
        isHighAlert: isHigh(d.drug || d.name) });
    }
  }
  require('../core/domain/mar-writer').saveAll(ctx, batch);
}

module.exports = {
  handlers,
  routes: [
    { method: 'GET',  path: '/api/clinical/patients',           handler: 'patients',       perm: 'patients.view' },
    { method: 'POST', path: '/api/clinical/patients',           handler: 'patientCreate',  perm: 'patients.create' },
    { method: 'GET',  path: '/api/clinical/vitals',             handler: 'vitals',         perm: 'vitals.view' },
    { method: 'POST', path: '/api/clinical/vitals',             handler: 'vitalsAdd',      perm: 'vitals.create' },
    { method: 'GET',  path: '/api/clinical/orders',             handler: 'orders',         perm: 'kardex.view' },
    { method: 'POST', path: '/api/clinical/orders',             handler: 'orderCreate',    perm: 'kardex.order.create' },
    { method: 'GET',  path: '/api/clinical/mar',                handler: 'mar',            perm: 'kardex.view' },
    { method: 'GET',  path: '/api/clinical/io',                 handler: 'io',             perm: 'kardex.view' },
    { method: 'POST', path: '/api/clinical/io',                 handler: 'ioAdd',          perm: 'kardex.order.execute' },
    { method: 'GET',  path: '/api/clinical/stats',              handler: 'clinicalStats',  perm: 'patients.view' },
    { method: 'GET',  path: '/api/clinical/patients/:id',       handler: 'patientDetail',  perm: 'patients.view' },
    { method: 'PUT',  path: '/api/clinical/patients/:id',       handler: 'patientUpdate',  perm: 'patients.update' },
    { method: 'GET',  path: '/api/clinical/vitals/:patientId/chart', handler: 'vitalsChart', perm: 'vitals.view' },
    { method: 'POST', path: '/api/clinical/orders/:id/:action', handler: 'orderAction',    perm: 'kardex.order.verify' },
    { method: 'POST', path: '/api/clinical/mar/:id/administer', handler: 'marAdminister',  perm: 'kardex.mar.administer' },
    { method: 'POST', path: '/api/clinical/mar/:id/refuse',     handler: 'marRefuse',      perm: 'kardex.mar.administer' },
    { method: 'GET',  path: '/api/clinical/io/:patientId/balance', handler: 'ioBalance',   perm: 'kardex.view' }
  
  ],
  panels: [
    { id: 'patients',   title: 'بیماران',    icon: '👥', perm: 'patients.view',    kind: 'list',   api: '/api/clinical/patients',  fields: ['firstName','lastName','wardCode','bedNumber','diagnosis','status'] },
    { id: 'vitals',     title: 'علائم حیاتی', icon: '📈', perm: 'vitals.view',      kind: 'vitals_v2',   api: '/api/clinical/vitals',    fields: ['patientName','news2','newsLevel','recordedAt'] },
    { id: 'kardex',     title: 'کاردکس',      icon: '📋', perm: 'kardex.view',      kind: 'list',   api: '/api/clinical/orders',    fields: ['patientName','type','priority','status'] },
    { id: 'mar',        title: 'MAR',         icon: '💊', perm: 'kardex.view',      kind: 'list',   api: '/api/clinical/mar',       fields: ['drugName','patientName','status','scheduledAt'] },
    { id: 'stats',      title: 'آمار',        icon: '📊', perm: 'patients.view',    kind: 'stats',  api: '/api/clinical/stats' }
  ]
};
