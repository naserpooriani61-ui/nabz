'use strict';
// core/domain/ed-physician-service.js — read-only aggregation for physician UI
// Never writes. Uses existing stores + tasks. Zero-tolerance: read-only.

function _store(ctx) { return (ctx && ctx.store) || require('../store'); }
function _h(ctx, col) {
  try {
    const s = _store(ctx);
    const fn = s.readAll || s.list;
    if (typeof fn === 'function') { const r = fn.call(s, col); return Array.isArray(r) ? r : []; }
    return [];
  } catch (_) { return []; }
}
function _activeStatus(s) { return ['closed','discharged','departed','transferred','left','lwbs','absconded'].indexOf(s || '') === -1; }
function _now() { return Date.now(); }

function _buildPatientCtx(ctx, v) {
  const allP = _h(ctx, 'patients');
  let p = null;
  const vPid = v && (v.patientId || v.patient_id || v.pid);
  if (vPid) p = allP.find(x => x && x.id === vPid) || null;
  if (!p && v) {
    const nameCandidates = [v.name, v.patientName, v.fullName, v.patient_name, v.demographics && v.demographics.name];
    for (const nm of nameCandidates) {
      if (nm) { p = allP.find(x => x && x.name && String(x.name).trim() === String(nm).trim()) || null; if (p) break; }
    }
  }
  const embeddedP = v && (v.patient && typeof v.patient === 'object') ? v.patient : null;
  const pFinal = p || embeddedP || null;
  const pick = (...vals) => { for (const x of vals) if (x != null && x !== '') return x; return null; };

  let name = pick(
    v && v.name,
    v && v.patientName,
    v && v.patient_name,
    v && v.fullName,
    v && v.full_name,
    embeddedP && embeddedP.name,
    embeddedP && embeddedP.fullName,
    pFinal && pFinal.name,
    pFinal && pFinal.fullName
  );
  if (!name) {
    const tail = String((vPid || (v && v.id) || '?')).slice(-5).toUpperCase();
    name = 'بیمار #' + tail;
  }

  const SEX = { M:'مرد', F:'زن', male:'مرد', female:'زن', '1':'مرد', '0':'زن', m:'مرد', f:'زن' };
  let age = pick(v && v.age, v && v.ageYears, pFinal && pFinal.age);
  if (age == null && pFinal && pFinal.dob) {
    try { age = Math.floor((Date.now() - new Date(pFinal.dob).getTime()) / 3.15576e10); } catch (_) {}
  }
  let allergies = pick(v && v.allergies, pFinal && pFinal.allergies);
  if (typeof allergies === 'string') allergies = allergies.split(',').map(s => s.trim()).filter(Boolean);
  if (!Array.isArray(allergies)) allergies = [];
  const sexCode = pick(v && v.sex, pFinal && pFinal.sex);

    let comorbidities = pick(v && v.comorbidities, pFinal && pFinal.comorbidities, []);
  if (typeof comorbidities === 'string') comorbidities = comorbidities.split(/[,،;]/).map(s => s.trim()).filter(Boolean);
  if (!Array.isArray(comorbidities)) comorbidities = [];

  return {
    name,
    mrn: pick(v && v.mrn, pFinal && pFinal.mrn, pFinal && pFinal.medicalRecordNumber, vPid || null) || '—',
    age, ageLabel: age != null ? age + ' ساله' : '—',
    sex: SEX[sexCode] || '—',
    allergies, hasAllergies: allergies.length > 0,
    bloodType: pick(v && v.bloodType, pFinal && pFinal.bloodType, '—'),
    esiLevel: (v && v.esiLevel != null) ? v.esiLevel : null,
    chiefComplaint: pick(v && v.chiefComplaint, v && v.complaint, '—'),
    bedCode: pick(v && v.bedCode, v && v.bedId, '—'),
    zone: pick(v && v.zone, '—'),
    arrivalAt: pick(v && v.arrivalAt, v && v.createdAt, null),
    arrivalMode: pick(v && v.arrivalMode, v && v.arrivalModeText, '—'),
    assignedDoctor: pick(v && v.assignedDoctor, v && v.doctorName, '—'),
    assignedNurse: pick(v && v.assignedNurse, v && v.nurseName, '—'),
    status: pick(v && v.status, '—'),
    visitId: v && v.id,
    patientId: vPid || null,
    hasPatientRecord: !!pFinal,
    // NEW fields for rich SBAR
    comorbidities,
    hasComorbidities: comorbidities.length > 0,
    codeStatus: pick(v && v.codeStatus, pFinal && pFinal.codeStatus, '—'),
    contact: pick(v && v.contact, v && v.phone, pFinal && pFinal.phone, '—'),
    triageNurse: pick(v && v.triageNurse, v && v.triageNurseName, '—'),
    triageNote: pick(v && v.triageNote, v && v.nursingNote, '—')
  };
}

function getWorklist(ctx) {
  const all = _h(ctx, 'ed_visits').filter(v => v && _activeStatus(v.status));
  const meId = ctx.actor && ctx.actor.id;
  const enriched = all.map(v => {
    const pCtx = _buildPatientCtx(ctx, v);
    const isMine = meId && (v.assignedDoctor === meId || v.doctorId === meId);
    return Object.assign({}, pCtx, {
      id: v.id, status: v.status,
      isMine: !!isMine,
      esiLevel: pCtx.esiLevel,
      arrivalAt: v.arrivalAt || v.createdAt,
      losMin: v.arrivalAt ? Math.floor((_now() - new Date(v.arrivalAt).getTime()) / 60000) : null
    });
  });
  enriched.sort((a, b) => {
    const ea = a.esiLevel == null ? 9 : Number(a.esiLevel);
    const eb = b.esiLevel == null ? 9 : Number(b.esiLevel);
    if (ea !== eb) return ea - eb;
    if (a.isMine !== b.isMine) return a.isMine ? -1 : 1;
    return (a.arrivalAt ? new Date(a.arrivalAt).getTime() : 0) - (b.arrivalAt ? new Date(b.arrivalAt).getTime() : 0);
  });
  return { total: enriched.length, mine: enriched.filter(x => x.isMine).length, rows: enriched };
}

function getPatientView(ctx, visitId) {
  const visits = _h(ctx, 'ed_visits');
  const v = visits.find(x => x && (x.id === visitId || x.patientId === visitId));
  if (!v) return { error: 'visit_not_found', searchedId: visitId };
  const pCtx = _buildPatientCtx(ctx, v);
  const pid = v.patientId || v.id;

  // Vitals (with computed NEWS2 trend)
  const vitalsAll = _h(ctx, 'vitals')
    .filter(x => x && (x.patientId === pid || x.patientId === v.id || x.visitId === v.id))
    .sort((a, b) => new Date(b.at || b.createdAt || 0) - new Date(a.at || a.createdAt || 0));
  const vitals = vitalsAll.slice(0, 20);
  let news2Trend = null;
  if (vitals.length >= 2) {
    const cur = vitals[0].news2 != null ? Number(vitals[0].news2) : null;
    const prev = vitals[1].news2 != null ? Number(vitals[1].news2) : null;
    if (cur != null && prev != null) {
      news2Trend = cur > prev ? '↑' : (cur < prev ? '↓' : '→');
    }
  }

  // Orders
  const orders = _h(ctx, 'orders')
    .filter(o => o && (o.patientId === pid || o.visitId === v.id))
    .sort((a, b) => {
      const ta = a.createdAt || (a._trans && a._trans[0] && a._trans[0].at) || 0;
      const tb = b.createdAt || (b._trans && b._trans[0] && b._trans[0].at) || 0;
      return new Date(tb) - new Date(ta);
    });
  const activeStatuses = ['active','verified','pending','partially_executed','pending_cosign','pending_attending','drafted'];
  const activeOrders = orders.filter(o => activeStatuses.includes(o.status));
  const historyOrders = orders.filter(o => !activeStatuses.includes(o.status));

  // Current medications (from active orders that are drugs)
  const currentMeds = activeOrders
    .filter(o => !o.type || o.type === 'drug' || o.type === 'medication')
    .map(o => ({
      name: o.item || o.drugName || '—',
      dose: o.dose || '',
      route: o.route || '',
      frequency: o.frequency || '',
      status: o.status
    }));

  // Labs
  const labsAll = _h(ctx, 'lab_results');
  const labsFromOrders = orders.filter(o => o.type === 'lab' || /lab|cbc|bmp|abg|تست|آزمایش|تروپونین|troponin/i.test((o.item||'') + ' ' + (o.drugName||'')));
  const labs = (labsAll.length ? labsAll.filter(l => l.patient_id === pid || l.visit_id === v.id || l.visitId === v.id) : labsFromOrders).map(l => ({
    id: l.id,
    status: l.status || (l.resulted_at ? 'resulted' : 'pending'),
    test_type: l.test_type || l.item || l.drugName || '—',
    is_critical: !!l.is_critical,
    resulted_at: l.resulted_at || l.resultedAt,
    result_summary: l.result_summary || l.result || null
  }));

  // Consults
  const consults = _h(ctx, 'consults')
    .filter(c => c && (c.patientId === pid || c.visitId === v.id))
    .sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));

  // Tasks
  const tasks = _h(ctx, 'clinical_tasks').filter(t =>
    t && t.related && (t.related.visit_id === v.id || t.related.patient_id === pid)
    && t.status !== 'resolved' && t.status !== 'cancelled'
  ).sort((a, b) => new Date(a.due_at) - new Date(b.due_at));

  // Nursing note (last)
  let lastNursingNote = null;
  try {
    const handovers = _h(ctx, 'handovers').filter(h => h && (h.patientId === pid || h.visitId === v.id));
    if (handovers.length > 0) {
      const last = handovers.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
      lastNursingNote = { text: last.situation || last.assessment || last.note || null, at: last.createdAt, by: last.author || last.createdBy || '—' };
    }
  } catch (_) {}

  // Timeline
  const events = [];
  orders.forEach(o => events.push({
    at: o.createdAt || (o._trans && o._trans[0] && o._trans[0].at),
    type: 'order',
    label: 'دستور: ' + (o.item || o.drugName || '—') + (o.dose ? ' ' + o.dose : ''),
    status: o.status,
    by: o.author && o.author.name
  }));
  vitals.slice(0, 10).forEach(x => events.push({
    at: x.at || x.createdAt,
    type: 'vitals',
    label: 'ویتال: HR ' + (x.hr||'—') + ' · SpO2 ' + (x.spo2||'—') + '%',
    status: x.newsLevel || x.news2,
    by: x.recordedBy || x.by
  }));
  consults.forEach(c => {
    if (c.created_at || c.createdAt) events.push({ at: c.created_at || c.createdAt, type: 'consult', label: 'درخواست مشاوره ' + (c.targetService || c.service || '—'), status: c.status, by: c.requestedBy });
    if (c.responded_at) events.push({ at: c.responded_at, type: 'consult', label: 'پاسخ مشاوره ' + (c.targetService || '—'), status: 'responded', by: c.respondedBy });
  });
  labs.forEach(l => { if (l.resulted_at) events.push({ at: l.resulted_at, type: 'lab', label: 'نتیجه ' + (l.test_type || '—'), status: l.is_critical ? 'critical' : 'resulted' }); });
  tasks.forEach(t => events.push({
    at: t.created_at,
    type: 'task',
    label: t.type + (t.context && t.context.summary ? ' — ' + t.context.summary : ''),
    status: t.status
  }));
  const timeline = events
    .filter(e => e.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 60);

  return {
    visit: v,
    patientContext: pCtx,
    vitals,
    news2Trend,
    orders: { active: activeOrders, history: historyOrders },
    currentMeds,
    labs: {
      pending: labs.filter(l => l.status === 'pending' || !l.resulted_at),
      resulted: labs.filter(l => l.resulted_at)
    },
    consults,
    tasks,
    timeline,
    lastNursingNote
  };
}

function getCartable(ctx) {
  const role = (ctx.actor && ctx.actor.role) || '';
  const uid = ctx.actor && ctx.actor.id;
  const isResident = role === 'resident_1' || role === 'resident_senior' || role === 'admin';
  const isAttending = role === 'attending' || role === 'attending_consultant' || role === 'admin';

  const orders = _h(ctx, 'orders');
  const pendingCosign = isResident ? orders.filter(o => o && o.status === 'pending_cosign') : [];
  const pendingAttending = isAttending ? orders.filter(o => o && o.status === 'pending_attending') : [];

  const tasks = _h(ctx, 'clinical_tasks').filter(t => {
    if (!t || t.status === 'resolved' || t.status === 'cancelled') return false;
    if (t.owner_id && t.owner_id === uid) return true;
    if (!t.owner_id && t.owner_role === role) return true;
    if (t.status === 'escalated' && (t.escalated_to || []).some(e => e.role === role)) return true;
    return false;
  });

  const byType = {};
  tasks.forEach(t => { byType[t.type] = byType[t.type] || []; byType[t.type].push(t); });

  return {
    pending_cosign: pendingCosign.map(o => ({
      id: o.id, item: o.item || o.drugName, dose: o.dose,
      author: o.author, visitId: o.visitId, patientId: o.patientId,
      isHighAlert: !!o.isHighAlert, submittedAt: o.submittedAt
    })),
    pending_attending: pendingAttending.map(o => ({
      id: o.id, item: o.item || o.drugName, dose: o.dose,
      author: o.author, cosigner: o.cosigner, visitId: o.visitId,
      isHighAlert: true
    })),
    lab_review: (byType.lab_review || []).concat(byType.lab_critical_alert || []),
    consult_accept: byType.consult_accept || [],
    attending_approve: byType.consult_attending_approve || byType.attending_cosign || [],
    my_tasks: tasks,
    role
  };
}

function getStats(ctx) {
  const uid = ctx.actor && ctx.actor.id;
  const orders = _h(ctx, 'orders').filter(o => o && o.author && o.author.id === uid);
  const tasks = _h(ctx, 'clinical_tasks').filter(t => t && t.owner_id === uid);
  return {
    my_orders_total: orders.length,
    my_orders_active: orders.filter(o => ['verified','active'].includes(o.status)).length,
    my_cosigns_done: orders.filter(o => o.cosigner && o.cosigner.id === uid).length,
    my_tasks_total: tasks.length,
    my_tasks_open: tasks.filter(t => t.status === 'open' || t.status === 'escalated').length
  };
}

module.exports = { getWorklist, getPatientView, getCartable, getStats, _buildPatientCtx };
