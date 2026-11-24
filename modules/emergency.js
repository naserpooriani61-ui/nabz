'use strict';
const signature = require('../core/signature');
const sm = require('../core/state-machine');

function h(ctx, c) { try { const r = ctx.store.readAll(c); return Array.isArray(r) ? r : []; } catch (_) { return []; } }
function sd(x) { if (!x) return 0; const d = new Date(x); return isNaN(d.getTime()) ? 0 : d.getTime(); }
function sign(ctx, coll, rec, action) {
  const sig = signature.signAction({ userId: ctx.actor.id, userName: ctx.actor.username, role: ctx.actor.role,
    action, collection: coll, recordId: rec.id, data: rec });
  ctx.store.put('signatures', sig);
  rec.lastSignatureId = sig.id;
  return sig;
}

const CODE_DEFS = {
  '247': { label: 'کد ۲۴۷ — STEMI', steps: ['ECG','Troponin','CathLab'] },
  '724': { label: 'کد ۷۲۴ — Stroke', steps: ['CT','Neuro','Thrombolysis'] },
  '99':  { label: 'کد ۹۹ — CPR', steps: ['CPR','ROSC/Death'] }
};

// ── _buildPatientCtx: rich patient context from visit + patients store ──
// Handles missing fields gracefully; falls back to patients collection by patientId or name.
function _buildPatientCtx(ctx, v) {
  const readAll = (c) => { try { const r = (ctx.store || require('../store')).readAll(c); return Array.isArray(r) ? r : []; } catch (_) { return []; } };
  const allPatients = readAll('patients');
  let p = null;
  if (v && v.patientId) p = allPatients.find(x => x && x.id === v.patientId) || null;
  if (!p && v && v.name) p = allPatients.find(x => x && x.name && String(x.name).trim() === String(v.name).trim()) || null;

  const pick = (...vals) => { for (const val of vals) if (val != null && val !== '') return val; return null; };
  const sexCode = pick(v && v.sex, p && p.sex);
  const SEX = { M:'مرد', F:'زن', male:'مرد', female:'زن', '1':'مرد', '0':'زن', m:'مرد', f:'زن' };
  const sexLabel = SEX[sexCode] || '—';

  let age = pick(v && v.age, p && p.age);
  if ((age == null) && p && p.dob) {
    try { age = Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 24 * 3600 * 1000)); } catch (_) {}
  }

  let allergies = pick(v && v.allergies, p && p.allergies);
  if (typeof allergies === 'string') allergies = allergies.split(',').map(s => s.trim()).filter(Boolean);
  if (!Array.isArray(allergies)) allergies = [];

  const rawName = pick(v && v.name, v && v.patientName, v && v.fullName, p && p.name, null);

  return {
    name: rawName || '—',
    mrn: pick(v && v.mrn, p && p.mrn, p && p.medicalRecordNumber, '—'),
    age: age,
    ageLabel: (age != null) ? (age + ' ساله') : '—',
    sex: sexLabel,
    sexCode: sexCode,
    allergies: allergies,
    hasAllergies: allergies.length > 0,
    contact: pick(v && v.contact, v && v.phone, p && p.phone, p && p.contact, '—'),
    bloodType: pick(v && v.bloodType, p && p.bloodType, '—'),
    esiLevel: (v && v.esiLevel != null) ? v.esiLevel : null,
    chiefComplaint: pick(v && v.chiefComplaint, v && v.complaint, '—'),
    bedCode: pick(v && v.bedCode, v && v.bedId, v && v.bed, '—'),
    zone: pick(v && v.zone, '—'),
    arrivalAt: pick(v && v.arrivalAt, v && v.createdAt, null),
    arrivalMode: pick(v && v.arrivalMode, '—'),
    assignedDoctor: pick(v && v.assignedDoctor, v && v.doctorName, v && v.doctor, p && p.attending, '—'),
    assignedNurse: pick(v && v.assignedNurse, v && v.nurseName, v && v.nurse, '—'),
    status: pick(v && v.status, '—'),
    isolation: pick(v && v.isolation, p && p.isolation, null),
    codeStatus: pick(v && v.codeStatus, p && p.codeStatus, null),
    visitId: v && v.id,
    patientId: v && v.patientId,
    hasPatientRecord: !!p
  };
}

const handlers = {
  // ─── Visits ───
  visits: (ctx) => {
    let items = h(ctx, 'ed_visits');
    if (ctx.query.status) items = items.filter(v => v.status === ctx.query.status);
    items.sort((a, b) => sd(b.arrivalAt) - sd(a.arrivalAt));
    return { items, total: items.length };
  },
  visitCreate: (ctx) => {
    const b = ctx.body;
    if (!b.patientName || !b.chiefComplaint) throw ctx.E.badRequest('missing_fields');
    const rec = { id: ctx.uid('edv'), patientName: b.patientName, age: b.age, sex: b.sex,
      arrivalAt: ctx.now(), arrivalMode: b.arrivalMode || 'walk_in',
      chiefComplaint: b.chiefComplaint, vitals: b.vitals || null,
      esiLevel: b.esiLevel || null, status: 'waiting_triage' };
    ctx.store.put('ed_visits', rec);
    ctx.bus.emit('ed.visit.created', { record: rec, actor: ctx.actor });
    return rec;
  },
  visitTriage: (ctx) => {
    const v = ctx.store.get('ed_visits', ctx.params.id);
    if (!v) throw ctx.E.notFound('visit_not_found');
    const level = Number(ctx.body.esiLevel);
    if (!level || level < 1 || level > 5) throw ctx.E.badRequest('invalid_esi');
    const r = sm.transition('ed_visit', v, 'triage', ctx.actor, {});
    if (!r.ok) throw ctx.E.conflict(r.reason);
    v.esiLevel = level; v.status = r.to; v.triagedAt = ctx.now(); v.triagedBy = ctx.actor.id;
    ctx.store.put('ed_visits', v);
    sign(ctx, 'ed_visits', v, 'triage');
    ctx.bus.emit('ed.triage.completed', { record: v, actor: ctx.actor });
    if (level <= 2) ctx.bus.emit('triage.critical', { record: v, actor: ctx.actor });
    return v;
  },

  // ─── Codes ───
  codes: (ctx) => {
    let items = h(ctx, 'ed_codes');
    if (ctx.query.status) items = items.filter(c => c.status === ctx.query.status);
    items.sort((a, b) => sd(b.activatedAt) - sd(a.activatedAt));
    return { items, total: items.length };
  },
  codeActivate: (ctx) => {
    const b = ctx.body;
    if (!b.code || !CODE_DEFS[b.code]) throw ctx.E.badRequest('invalid_code');
    if (!b.patientName) throw ctx.E.badRequest('patient_name_required');
    const def = CODE_DEFS[b.code];
    const rec = { id: ctx.uid('code'), code: b.code, codeLabel: def.label,
      patientName: b.patientName, activatedAt: ctx.now(), activatedBy: ctx.actor.id,
      status: 'active', steps: def.steps.map(s => ({ name: s, status: 'pending', completedAt: null })) };
    ctx.store.put('ed_codes', rec);
    sign(ctx, 'ed_codes', rec, 'activate');
    ctx.bus.emit('ed.code.activated', { record: rec, actor: ctx.actor });
    return rec;
  },
  codeStep: (ctx) => {
    const c = ctx.store.get('ed_codes', ctx.params.id);
    if (!c) throw ctx.E.notFound('code_not_found');
    if (c.status !== 'active') throw ctx.E.conflict('code_not_active');
    const step = c.steps.find(s => s.name === ctx.body.step);
    if (!step) throw ctx.E.notFound('step_not_found');
    step.status = 'completed'; step.completedAt = ctx.now(); step.completedBy = ctx.actor.id;
    ctx.store.put('ed_codes', c);
    return c;
  },
  codeClose: (ctx) => {
    const c = ctx.store.get('ed_codes', ctx.params.id);
    if (!c) throw ctx.E.notFound('code_not_found');
    const r = sm.transition('ed_code', c, 'close', ctx.actor, {});
    if (!r.ok) throw ctx.E.conflict(r.reason);
    c.status = 'closed'; c.closedAt = ctx.now(); c.outcome = ctx.body.outcome || null;
    ctx.store.put('ed_codes', c);
    ctx.bus.emit('ed.code.closed', { record: c, actor: ctx.actor });
    return c;
  },

  // ─── MCI ───
  mci: (ctx) => {
    const items = h(ctx, 'ed_mci');
    return { items, total: items.length };
  },
  mciActivate: (ctx) => {
    const b = ctx.body;
    if (!b.alertLevel) throw ctx.E.badRequest('alert_level_required');
    const rec = { id: ctx.uid('mci'), alertLevel: b.alertLevel,
      incidentType: b.incidentType || 'unknown', location: b.location || '',
      estimatedCasualties: Number(b.estimatedCasualties) || 0,
      activatedAt: ctx.now(), activatedBy: ctx.actor.id, status: 'active',
      casualties: { red: 0, yellow: 0, green: 0, black: 0 } };
    ctx.store.put('ed_mci', rec);
    ctx.bus.emit('ed.mci.activated', { record: rec, actor: ctx.actor });
    return rec;
  },

  // ─── Stats ───

    erfOverview: (ctx) => {
    const visits = h(ctx, 'ed_visits');
    const codes = h(ctx, 'ed_codes');
    const beds = h(ctx, 'beds') || []; // Fallback if beds store is named differently
    const orders = h(ctx, 'orders') || [];
    
    const now = Date.now();
    const todayStart = now - 86400000;
    
    // 1. Patients Logic (matching dashboard.tsx)
    const activePatients = visits.filter(v => !['closed', 'discharged'].includes(v.status));
    const waitingTriage = activePatients.filter(v => v.status === 'waiting_triage').sort((a, b) => (a.arrivalMode === 'ems' ? -1 : 0) - (b.arrivalMode === 'ems' ? -1 : 0) || a.arrivalAt - b.arrivalAt);
    const waitingBed = activePatients.filter(v => v.status === 'waiting_bed').sort((a, b) => (a.esiLevel || 9) - (b.esiLevel || 9) || a.arrivalAt - b.arrivalAt);
    const notSeen = activePatients.filter(v => v.esiLevel && !v.seenAt);
    
    // ESI Target Minutes (from Sina-ER schema)
    const ESI_TARGET = { 1: 0, 2: 10, 3: 30, 4: 60, 5: 120 };
    const overdue = notSeen.filter(v => {
      const waitMin = (now - v.arrivalAt) / 60000;
      return waitMin > Math.max(ESI_TARGET[v.esiLevel] || 30, 5);
    });
    
    const avgWait = notSeen.length ? notSeen.reduce((sum, v) => sum + ((now - v.arrivalAt) / 60000), 0) / notSeen.length : 0;
    
    // 2. Beds Logic (matching beds.tsx)
    const usableBeds = beds.filter(b => b.status !== 'blocked');
    const occupiedBeds = beds.filter(b => b.status === 'occupied');
    
    // Zone mapping (from Sina-ER ZONES constant)
    const ZONES = [
      { key: 'cpr', label: 'اتاق CPR', desc: 'احیای قلبی ریوی' },
      { key: 'trauma', label: 'تروما', desc: 'آسیب‌های تروماتیک' },
      { key: 'fast', label: 'FAST Track', desc: 'بیماران کم‌خطر و سریع' },
      { key: 'acute1', label: 'حاد ۱', desc: 'بیماری‌های داخلی حاد' },
      { key: 'acute2', label: 'حاد ۲', desc: 'بیماری‌های داخلی نیمه‌حاد' },
      { key: 'or', label: 'اتاق عمل سرپایی', desc: 'جراحی‌های کوچک' }
    ];
    
    // 3. Orders & Alerts Logic
    const statOrders = orders.filter(o => o.priority === 'stat' && !['done', 'cancelled'].includes(o.status));
    const pendingOrders = orders.filter(o => o.status === 'pending');
    
    // NEDOCS-lite Crowding Index
    const crowd = Math.min(200, Math.round((activePatients.length / Math.max(usableBeds.length, 1)) * 100 * 0.7 + waitingTriage.length * 4 + waitingBed.length * 3 + overdue.length * 3));
    
    return {
      patients: activePatients,
      beds: beds,
      codes: codes.filter(c => c.status === 'active'),
      orders: { stat: statOrders, pending: pendingOrders },
      metrics: {
        totalActive: activePatients.length,
        todayTotal: visits.filter(v => v.arrivalAt > todayStart).length,
        waitingTriage: waitingTriage.length,
        waitingBed: waitingBed.length,
        boarding: activePatients.filter(v => v.status === 'awaiting_disposition').length,
        overdue: overdue.length,
        avgWait: Math.round(avgWait),
        crowdIndex: crowd,
        occupancyPct: usableBeds.length ? Math.round((occupiedBeds.length / usableBeds.length) * 100) : 0
      },
      zones: ZONES,
      esiDist: [1, 2, 3, 4, 5].map(e => ({ esi: e, count: activePatients.filter(v => v.esiLevel === e).length }))
    };
  },
  
  edStats: (ctx) => {
    const visits = h(ctx, 'ed_visits');
    const codes = h(ctx, 'ed_codes');
    const mci = h(ctx, 'ed_mci');
    const active = visits.filter(v => !['closed','discharged'].includes(v.status));
    const today = visits.filter(v => sd(v.arrivalAt) > Date.now() - 86400000);
    return {
      today: today.length, active: active.length,
      waiting: active.filter(v => v.status === 'waiting_triage' || v.status === 'waiting_doctor').length,
      boarding: active.filter(v => v.status === 'boarding').length,
      critical: active.filter(v => v.esiLevel <= 2).length,
      esiDist: { 1: active.filter(v => v.esiLevel === 1).length, 2: active.filter(v => v.esiLevel === 2).length,
                 3: active.filter(v => v.esiLevel === 3).length, 4: active.filter(v => v.esiLevel === 4).length,
                 5: active.filter(v => v.esiLevel === 5).length },
      codesActive: codes.filter(c => c.status === 'active').length,
      mciActive: mci.filter(m => m.status === 'active').length
    };
  },
  edNursingDashboard: (ctx) => {
    const q = ctx.query || {};
    const p0 = ctx.params || {};
    const idRaw = q.visitId || q.patientId || p0.visitId || p0.patientId || '';
    const id = String(idRaw || '').trim();
    const allVisits = h(ctx, 'ed_visits') || [];

    if (!id) return { visit: null, patient: null, patientContext: null, mar_due: [], mar_history: [], news2: null,
                      error: 'no_id_provided', totalVisits: allVisits.length };

    let v = null;
    v = allVisits.find(x => x && x.id === id);
    if (!v) v = allVisits.find(x => x && x.patientId === id);
    if (!v) {
      const lower = id.toLowerCase();
      v = allVisits.find(x => x && String(x.id || '').toLowerCase() === lower);
      v = v || allVisits.find(x => x && String(x.patientId || '').toLowerCase() === lower);
    }

    let matchedPatient = null;
    if (!v && (id.startsWith('pat_') || id.startsWith('PAT'))) {
      const allPatients = h(ctx, 'patients');
      matchedPatient = allPatients.find(p => p.id === id) ||
                       allPatients.find(p => String(p.id).toLowerCase() === id.toLowerCase());
      if (matchedPatient && matchedPatient.name) {
        const TERMINAL = ['closed','discharged','departed','transferred','left','lwbs','absconded'];
        v = allVisits.find(x =>
          x && x.name && matchedPatient.name &&
          String(x.name).trim() === String(matchedPatient.name).trim() &&
          !TERMINAL.includes(x.status)
        );
      }
    }

    if (!v) {
      return {
        visit: null, patient: null, patientContext: null, mar_due: [], mar_history: [], news2: null,
        error: matchedPatient ? 'no_active_visit_for_patient' : 'visit_not_found',
        searchedId: id, totalVisits: allVisits.length,
        patientFound: matchedPatient ? { id: matchedPatient.id, name: matchedPatient.name } : null,
        sampleIds: allVisits.slice(0, 12).map(x => ({
          id: x.id, name: x.name || '—', patientId: x.patientId || null, status: x.status
        }))
      };
    }

    if (matchedPatient && !v.patientId) {
      try {
        v.patientId = matchedPatient.id;
        v.linkedAt = new Date().toISOString();
        require('../store').put('ed_visits', v);
      } catch (_) {}
    }

    // Enrich with patientContext
    const pCtx = _buildPatientCtx(ctx, v);
    if (!v.name && pCtx.name && pCtx.name !== '—') v.name = pCtx.name;

    const actualPid = v.patientId || v.id;
    const allMar = h(ctx, 'mar').filter(m => m.patientId == actualPid || m.visitId == v.id || m.patientId == v.id);
    const now = Date.now(), winMs = 30 * 60 * 1000;

    const mar_due = allMar
      .filter(m => m.status === 'pending' || m.status === 'scheduled')
      .map(m => {
        const sch = m.scheduledAt ? new Date(m.scheduledAt).getTime() : null;
        return Object.assign({}, m, {
          overdue_min: sch == null ? null : Math.max(0, Math.floor((now - sch) / 60000)),
          isOverdue: sch != null && now > sch
        });
      })
      .filter(m => { const s = m.scheduledAt ? new Date(m.scheduledAt).getTime() : null; return s == null || s - now <= winMs; })
      .sort((a, b) => { const sa = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity; const sb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity; return sa - sb; });

    const mar_history = allMar
      .filter(m => ['given','refused','held','missed','given_partial','cancelled'].includes(m.status))
      .sort((a, b) => {
        const ta = new Date(b.administeredAt || b.heldAt || b.refusedAt || b.missedAt || 0).getTime();
        const tb = new Date(a.administeredAt || a.heldAt || a.refusedAt || a.missedAt || 0).getTime();
        return ta - tb;
      })
      .slice(0, 20);

    let news2 = null;
    try {
      const W = require('../core/domain/ed-visit-writer');
      const lv = W.latestVitals(ctx, v, h(ctx, 'vitals'));
      if (lv && lv.vitals) news2 = require('../core/domain/news2').calc(lv.vitals);
    } catch (_) {}

    return { visit: v, patient: v, patientContext: pCtx, actualPatientId: actualPid, mar_due, mar_history, news2, pendingOrders: [] };
  },
  edMarEvents: (ctx) => {
    const marId = ctx.params.id;
    const mar = h(ctx, 'mar').find(m => m.id === marId);
    if (!mar) throw { code: 404, message: 'mar_not_found' };
    return { mar, events: (mar._trans || []).slice().reverse() };
  },
  edConsultCreate: (ctx) => {
    const b = ctx.body || {};
    if (!b.patientId) throw { code: 400, message: 'patient_id_required' };
    if (!b.targetService) throw { code: 400, message: 'target_service_required' };
    if (!b.clinicalQuestion || b.clinicalQuestion.length < 5) throw { code: 400, message: 'clinical_question_min_5_chars' };
    const cw = require('../core/domain/consult-writer');
    const rec = cw.create(ctx, {
      patientId: b.patientId,
      visitId: b.visitId || null,
      targetService: b.targetService,
      question: b.clinicalQuestion,
      urgency: b.urgency || 'routine',
      requestedBy: (ctx.actor && (ctx.actor.fullName || ctx.actor.username)) || '—'
    });
    // Emit event for task dispatcher
    try { require('../core/events').emit('ed.consult.requested', { consult: rec, actor: ctx.actor }); } catch (_) {}
    return rec;
  },
  edPatientRegister: (ctx) => {
    const b = ctx.body || {};
    const name = String(b.name || '').trim();
    if (!name || name.length < 2) throw { code: 400, message: 'name_required' };
    const store = ctx.store || require('../core/store');
    const uid = (p) => store.uid(p);
    const now = new Date().toISOString();
    const actor = ctx.actor || { id: 'unknown', role: 'unknown' };
    const patientId = uid('pat');
    const patient = {
      id: patientId, name,
      age: b.age != null ? parseInt(b.age, 10) : null,
      sex: b.sex || null,
      mrn: b.mrn || ('MRN-' + Date.now().toString(36).toUpperCase()),
      phone: b.phone || null,
      allergies: b.allergies ? String(b.allergies).split(',').map(s => s.trim()).filter(Boolean) : [],
      bloodType: b.bloodType || null,
      codeStatus: b.codeStatus || 'Full Code',
      createdAt: now, createdBy: actor.id
    };
    store.put('patients', patient);
    const visitId = uid('edv');
    const visit = {
      id: visitId, patientId, name,
      age: patient.age, sex: patient.sex,
      chiefComplaint: b.chiefComplaint || '—',
      arrivalMode: b.arrivalMode || 'walk-in',
      arrivalAt: now,
      status: 'waiting_triage',
      esiLevel: null, bedCode: null, zone: null,
      createdAt: now, createdBy: actor.id,
      _trans: [{ at: now, action: 'registered', by: actor.id }]
    };
    store.put('ed_visits', visit);
    try { require('../core/events').emit('ed.visit.created', { visit, patient, actor }); } catch (_) {}
    return { ok: true, patientId, visitId, patient, visit };
  },
  edSaveVitals: (ctx) => {
    const b = ctx.body || {};
    const visitId = b.visitId;
    const patientId = b.patientId;
    if (!visitId && !patientId) throw { code: 400, message: 'visit_or_patient_required' };
    let v = null;
    if (visitId) v = h(ctx, 'ed_visits').find(x => x && x.id === visitId);
    if (!v && patientId) v = h(ctx, 'ed_visits').find(x => x && (x.id === patientId || x.patientId === patientId));
    const pid = (v && v.patientId) || patientId || (v && v.id) || visitId;
    if (!pid) throw { code: 400, message: 'cannot_determine_patient' };
    const vw = require('../core/domain/vitals-writer');
    const rec = vw.record(ctx, {
      patientId: pid,
      visitId: visitId || (v && v.id) || null,
      hr: b.hr, bp_sys: b.bp_sys || b.sbp, bp_dia: b.bp_dia || b.dbp,
      rr: b.rr, spo2: b.spo2, temp: b.temp, gcs: b.gcs, pain: b.pain,
      onOxygen: !!b.onOxygen, consciousness: b.consciousness
    });
    try {
      if (rec && (rec.newsLevel === 'critical' || (rec.news2 && rec.news2 >= 7))) {
        require('../core/events').emit('ed.visit.news2.alert', { visit: v, news2: rec.news2, actor: ctx.actor });
      }
    } catch (_) {}
    return rec;
  },
  edMarAction: (ctx) => {
    const marId = ctx.params.id;
    const b = ctx.body || {};
    const action = String(b.action || b.status || '').toLowerCase();
    const MW = require('../core/domain/mar-writer');
    if (['given','administer','administered'].includes(action)) {
      if (!b.fiveRights) throw { code: 400, message: 'five_rights_required' };
      return MW.administer(ctx, marId, { fiveRights: b.fiveRights, witnessId: b.witnessId, witnessName: b.witnessName, administeredDose: b.administeredDose, administeredRoute: b.administeredRoute, barcodes: b.barcodes, notes: b.notes });
    }
    if (['held','hold'].includes(action)) {
      if (!b.reason || b.reason.length < 5) throw { code: 400, message: 'hold_reason_min_5_chars' };
      return MW.hold(ctx, marId, { reason: b.reason });
    }
    if (['refused','refuse'].includes(action)) {
      if (!b.reason || b.reason.length < 5) throw { code: 400, message: 'refuse_reason_min_5_chars' };
      return MW.refuse(ctx, marId, { reason: b.reason });
    }
    if (['missed','miss'].includes(action)) return MW.miss(ctx, marId, { reason: b.reason });
    if (action === 'partial') return MW.partial(ctx, marId, { givenDose: b.givenDose, reason: b.reason, fiveRights: b.fiveRights });
    throw { code: 400, message: 'unknown_mar_action:' + action };
  }
};

module.exports = {
  handlers,
  routes: [
    { method: 'GET',  path: '/api/emergency/visits',      handler: 'visits',       perm: 'ed.view' },
    { method: 'POST', path: '/api/emergency/visits',      handler: 'visitCreate',  perm: 'ed.triage' },
    { method: 'GET',  path: '/api/emergency/codes',       handler: 'codes',        perm: 'ed.view' },
    { method: 'POST', path: '/api/emergency/codes',       handler: 'codeActivate', perm: 'ed.code.activate' },
    { method: 'GET',  path: '/api/emergency/mci',         handler: 'mci',          perm: 'ed.view' },
    { method: 'POST', path: '/api/emergency/mci',         handler: 'mciActivate',  perm: 'ed.mci.activate' },
    { method: 'GET',  path: '/api/emergency/stats',       handler: 'edStats',      perm: 'ed.view' },
    { method: 'POST', path: '/api/emergency/visits/:id/triage', handler: 'visitTriage', perm: 'ed.triage' },
    { method: 'POST', path: '/api/emergency/codes/:id/step', handler: 'codeStep',  perm: 'ed.code.activate' },
    { method: 'POST', path: '/api/emergency/codes/:id/close', handler: 'codeClose', perm: 'ed.code.activate' },
    { method: 'GET',  path: '/api/ed/nursing_dashboard', handler: 'edNursingDashboard', perm: 'ed.view' },
    { method: 'POST', path: '/api/ed/vitals',   handler: 'edSaveVitals',  perm: 'ed.view' },
    { method: 'POST', path: '/api/ed/mar/:id',  handler: 'edMarAction',   perm: 'ed.view' },
    { method: 'GET',  path: '/api/ed/mar/:id/events', handler: 'edMarEvents', perm: 'ed.view' },
  
    { method: 'POST', path: '/api/ed/consults', handler: 'edConsultCreate', perm: 'ed.view' },
    { method: 'POST', path: '/api/emergency/patients/register', handler: 'edPatientRegister', perm: 'ed.triage' },
  ],
  panels: [
    { id: 'ed_triage', module: 'emergency', title: 'تریاژ هوشمند', icon: '🩺', perm: 'ed.triage', kind: 'ed_triage' },
    { id: 'ed_nursing', module: 'emergency', title: 'فضای کار پرستاری', icon: '💉', perm: 'ed.view', kind: 'ed_nursing' },
    { id: 'ed_sbar', module: 'emergency', title: 'SBAR', icon: '📋', perm: 'ed.view', kind: 'ed_sbar' },
    { id: 'ed_discharge', module: 'emergency', title: 'چک‌لیست ترخیص', icon: '📤', perm: 'ed.view', kind: 'ed_discharge' },
    { id: 'ed_careplan', module: 'emergency', title: 'برنامه مراقبت', icon: '🩺', perm: 'ed.view', kind: 'ed_careplan' },
    { id: 'ed_physician', module: 'emergency', title: 'فضای کار پزشک', icon: '👨‍⚕️', perm: 'ed.view', kind: 'ed_physician' }
  ]
};

// ── ED core extension (28A): writer-based lifecycle, board, ESI suggestion ──
try { require('../core/domain/ed-api').extend(module.exports); } catch (e) { console.error('[ed-core] extend failed:', e && e.message); }
// ── ED ops extension (28B): beds, bed assignment, patient creation, MCI ──
try { require('../core/domain/ed-ops').extend(module.exports); } catch (e) { console.error('[ed-ops] extend failed:', e && e.message); }
// ── Task dispatcher boot + visitTriage emit hook ────────────
try {
  const _bus = require('../core/events');
  const _store = require('../core/store');
  require('../core/domain/task-dispatcher').install(_bus, { store: _store, bus: _bus });
  require('../core/domain/task-scheduler').start({ store: _store, bus: _bus });
  // ── MAR generation on order verified ──
  try {
    const _mw = require('../core/domain/mar-writer');
    const _mkCtx = (actor) => ({
      store: _store, bus: _bus,
      actor: actor || { id: 'system', role: 'system' },
      now: () => new Date().toISOString(),
      uid: (p) => _store.uid(p)
    });
    _bus.on('ed.order.cosigned', (p) => {
      try {
        const o = (p && p.order) || p;
        if (o && o.status === 'verified' && typeof _mw.createFromOrder === 'function') {
          _mw.createFromOrder(_mkCtx(p && p.actor), o);
        }
      } catch (e) { console.warn('[mar-hook cosigned]', e.message); }
    });
    _bus.on('ed.order.attending_cosigned', (p) => {
      try {
        const o = (p && p.order) || p;
        if (o && o.status === 'verified' && typeof _mw.createFromOrder === 'function') {
          _mw.createFromOrder(_mkCtx(p && p.actor), o);
        }
      } catch (e) { console.warn('[mar-hook attending]', e.message); }
    });
  } catch (e) { console.warn('[mar-hook boot]', e.message); }
  if (module.exports.handlers && module.exports.handlers.visitTriage && !module.exports.handlers.visitTriage.__taskWrapped) {
    const _origTriage = module.exports.handlers.visitTriage;
    const _wrapped = (ctx) => {
      const r = _origTriage(ctx);
      try {
        const v = (r && r.visit) ? r.visit : (r && r.id ? r : null);
        if (v && v.esiLevel != null) {
          try { _bus.emit('ed.visit.triaged', { visit: v, actor: ctx.actor }); } catch (_) {}
        }
      } catch (_) {}
      return r;
    };
    _wrapped.__taskWrapped = true;
    module.exports.handlers.visitTriage = _wrapped;
  }
} catch (e) {
  console.warn('[emergency] task boot error:', e && e.message);
}

// _ed_extras_merged — force-load ed_extras routes/handlers (kernel may skip it)
try {
  const _extras = require('./ed_extras.js');
  const _exRoutes = _extras.routes || [];
  const _exHandlers = _extras.handlers || {};
  let _added = 0;
  _exRoutes.forEach(function(r) {
    var exists = module.exports.routes.some(function(x) { return x.method === r.method && x.path === r.path; });
    if (!exists) { module.exports.routes.push(r); _added++; }
  });
  Object.keys(_exHandlers).forEach(function(k) {
    if (!module.exports.handlers[k]) module.exports.handlers[k] = _exHandlers[k];
  });
  console.log('[emergency] ed_extras merged: ' + _added + ' new routes');
} catch (e) {
  console.warn('[emergency] ed_extras merge failed:', e && e.message);
}


// _ed_nursing_report_merged — force-load nursing report routes + panel
try {
  const _nrep = require('./ed_nursing_report.js');
  const _nrepRoutes = _nrep.routes || [];
  const _nrepHandlers = _nrep.handlers || {};
  const _nrepPanels = _nrep.panels || [];
  let _nrepAdded = 0;
  _nrepRoutes.forEach(function(r) {
    var exists = module.exports.routes.some(function(x) { return x.method === r.method && x.path === r.path; });
    if (!exists) { module.exports.routes.push(r); _nrepAdded++; }
  });
  Object.keys(_nrepHandlers).forEach(function(k) {
    if (!module.exports.handlers[k]) module.exports.handlers[k] = _nrepHandlers[k];
  });
  _nrepPanels.forEach(function(p) {
    var exists = module.exports.panels.some(function(x) { return x.id === p.id; });
    if (!exists) module.exports.panels.push(p);
  });
  console.log('[emergency] ed_nursing_report merged: ' + _nrepAdded + ' new routes, ' + _nrepPanels.length + ' panel');
} catch (e) {
  console.warn('[emergency] ed_nursing_report merge failed:', e && e.message);
}

// _ed_tasks_merged — merge tasks routes
try {
  const _t = require('./ed_tasks.js');
  let _n = 0;
  (_t.routes || []).forEach(r => {
    if (!module.exports.routes.some(x => x.method === r.method && x.path === r.path)) { module.exports.routes.push(r); _n++; }
  });
  Object.keys(_t.handlers || {}).forEach(k => { if (!module.exports.handlers[k]) module.exports.handlers[k] = _t.handlers[k]; });
  (_t.panels || []).forEach(p => { if (!module.exports.panels.some(x => x.id === p.id)) module.exports.panels.push(p); });
  console.log('[emergency] ed_tasks merged:', _n, 'routes');
} catch(e) { console.warn('[emergency] ed_tasks merge failed:', e && e.message); }

// _ed_orders_merged — merge order hierarchy routes
try {
  const _o = require('./ed_orders.js');
  let _n = 0;
  (_o.routes || []).forEach(r => {
    if (!module.exports.routes.some(x => x.method === r.method && x.path === r.path)) { module.exports.routes.push(r); _n++; }
  });
  Object.keys(_o.handlers || {}).forEach(k => { if (!module.exports.handlers[k]) module.exports.handlers[k] = _o.handlers[k]; });
  console.log('[emergency] ed_orders merged:', _n, 'routes');
} catch(e) { console.warn('[emergency] ed_orders merge failed:', e && e.message); }

// _ed_physician_merged — merge physician workspace routes
try {
  const _p = require('./ed_physician.js');
  let _n = 0;
  (_p.routes || []).forEach(r => {
    if (!module.exports.routes.some(x => x.method === r.method && x.path === r.path)) { module.exports.routes.push(r); _n++; }
  });
  Object.keys(_p.handlers || {}).forEach(k => { if (!module.exports.handlers[k]) module.exports.handlers[k] = _p.handlers[k]; });
  console.log('[emergency] ed_physician merged:', _n, 'routes');
} catch(e) { console.warn('[emergency] ed_physician merge failed:', e && e.message); }
