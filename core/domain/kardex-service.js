'use strict';
// core/domain/kardex-service.js — Hospital-grade Kardex Aggregator
// مطابق فرم استاندارد کاردکس بیمارستانی ایران — دسته‌بندی بالینی
const store = require('../store');
const sm = require('../state-machine');

// ─── Drug classification (route + name pattern) ───
const FLUID_NAMES = ['سرم', 'سالین', 'رینگر', 'دکستروز', 'saline', 'ringer', 'dextrose',
  'd5w', 'd10w', 'ns ', ' lr', 'lr ', 'plasma-lyte', 'plasma lyte', 'کلسیم گلوکونات وریدی'];
const TOPICAL_ROUTES = ['TOP', 'TOPICAL', 'OPH', 'OTIC', 'NASAL', 'DERM', 'CREAM', 'OINT', 'OINTMENT'];
const ORAL_ROUTES = ['PO', 'PO/NG', 'NG', 'SL', 'PR', 'ORAL', 'P.O'];
const INJ_ROUTES = ['IV', 'IM', 'SC', 'IVP', 'IVPB', 'ID', 'INJ', 'IV-PUSH', 'IVPUSH'];
const INHALED_ROUTES = ['INH', 'NEB', 'NEBULIZER', 'MDI', 'INHALED'];

function _classifyDrug(order) {
  const d = order.details || {};
  const drugName = String(d.drug || d.name || '').toLowerCase();
  const route = String(d.route || '').toUpperCase().trim();
  const freq = String(d.frequency || '').toUpperCase();
  const isPrn = !!d.prn || freq === 'PRN' || d.priority === 'prn';
  const isHighAlert = !!d.highAlert || ['warfarin','heparin','insulin','morphine','fentanyl','digoxin',
    'vancomycin','amiodarone','potassium','chemotherapy'].some(n => drugName.includes(n));

  // 1) IV fluids (name-based)
  if (FLUID_NAMES.some(n => drugName.includes(n)) || d.category === 'fluid' || d.isFluid) {
    return { category: 'fluids', sub: null, isPrn, isHighAlert };
  }
  // 2) PRN is its own bucket (overrides route)
  if (isPrn) {
    return { category: 'prn', sub: _subFromRoute(route), isPrn, isHighAlert };
  }
  // 3) Route-based
  if (ORAL_ROUTES.includes(route))       return { category: 'oral', sub: null, isPrn, isHighAlert };
  if (INJ_ROUTES.includes(route))        return { category: 'injectable', sub: route, isPrn, isHighAlert };
  if (TOPICAL_ROUTES.includes(route))    return { category: 'topical', sub: route, isPrn, isHighAlert };
  if (INHALED_ROUTES.includes(route))    return { category: 'inhaled', sub: route, isPrn, isHighAlert };
  // 4) Fallback
  return { category: 'oral', sub: null, isPrn, isHighAlert };
}
function _subFromRoute(route) {
  if (ORAL_ROUTES.includes(route)) return 'oral';
  if (INJ_ROUTES.includes(route)) return 'injectable';
  if (TOPICAL_ROUTES.includes(route)) return 'topical';
  if (INHALED_ROUTES.includes(route)) return 'inhaled';
  return 'other';
}

function _all(coll, pid) {
  try { return store.readAll(coll).filter(r => r.patientId === pid); } catch (_) { return []; }
}
function _sd(x) { return x ? new Date(x).getTime() : 0; }
function _srtAsc(arr, f) { return arr.slice().sort((a, b) => _sd(a[f] || a.createdAt) - _sd(b[f] || b.createdAt)); }
function _srtDesc(arr, f) { return arr.slice().sort((a, b) => _sd(b[f] || b.createdAt) - _sd(a[f] || a.createdAt)); }

function _canRead(ctx, role) {
  if (!ctx || !ctx.actor) return false;
  if (ctx.actor.role === 'admin') return true;
  try { return require('../permissions').can(ctx.actor.role, 'kardex.view'); } catch (_) { return false; }
}
function _actions(ent, e, actor) {
  try { return sm.actions(ent, e, actor) || []; } catch (_) { return []; }
}

// ─── MAR timeline per order ───
function _buildMarTimeline(marForOrder) {
  const now = Date.now();
  let lastGiven = null, nextDue = null, overdueCount = 0, missedCount = 0, givenTodayCount = 0;
  const dayAgo = now - 24*3600*1000;
  for (const m of marForOrder) {
    if (m.status === 'given' || m.status === 'given_partial') {
      if (!lastGiven || _sd(m.administeredAt) > _sd(lastGiven.administeredAt)) lastGiven = m;
      if (_sd(m.administeredAt) > dayAgo) givenTodayCount++;
    }
    if (['scheduled', 'due'].includes(m.status)) {
      const t = _sd(m.scheduledAt);
      if (t < now) overdueCount++;
      if (t >= now && (!nextDue || t < _sd(nextDue.scheduledAt))) nextDue = m;
    }
    if (m.status === 'missed') missedCount++;
  }
  return {
    total: marForOrder.length,
    lastGiven: lastGiven ? { at: lastGiven.administeredAt, by: lastGiven.administeredByName || lastGiven.administeredBy, dose: lastGiven.dose } : null,
    nextDue: nextDue ? { at: nextDue.scheduledAt, dose: nextDue.dose } : null,
    overdueCount, missedCount, givenToday: givenTodayCount
  };
}

function getPatientKardex(ctx, patientId) {
  if (!patientId) throw (ctx && ctx.E ? ctx.E.badRequest('patient_id_required') : new Error('patient_id_required'));
  const patient = (() => { try { return store.get('patients', patientId); } catch (_) { return null; } })();
  if (!patient) throw (ctx && ctx.E ? ctx.E.notFound('patient_not_found') : new Error('patient_not_found'));

  const allOrders = _all('orders', patientId);
  const allMars = _all('mar', patientId);
  const allVitals = _all('vitals', patientId);
  const allConsults = _all('consults', patientId);
  const allIo = _all('io_records', patientId);
  const allAlerts = _all('cdss_alerts', patientId).filter(a => !a.dismissed);

  const buckets = {
    oral: [], injectable: [], fluids: [], prn: [], topical: [], inhaled: [],
    labs: [], imaging: [], nursing: [], consultOrders: []
  };

  for (const o of allOrders) {
    if (!_canRead(ctx, o.type)) continue;
    if (['completed','cancelled','discontinued','rejected_teaching'].includes(o.status)) continue;

    if (o.type === 'medication') {
      const cls = _classifyDrug(o);
      const mars = allMars.filter(m => m.orderId === o.id).sort((a, b) => _sd(a.scheduledAt) - _sd(b.scheduledAt));
      const timeline = _buildMarTimeline(mars);
      const entry = {
        order: o,
        classification: cls,
        mar: mars.map(m => ({ ...m, actions: _actions('mar', m, ctx.actor) })),
        timeline,
        actions: _actions('order', o, ctx.actor)
      };
      const bucket = buckets[cls.category] || buckets.oral;
      bucket.push(entry);
    } else if (o.type === 'lab') {
      buckets.labs.push({ order: o, actions: _actions('order', o, ctx.actor) });
    } else if (o.type === 'paraclinical' || o.type === 'imaging') {
      buckets.imaging.push({ order: o, actions: _actions('order', o, ctx.actor) });
    } else if (o.type === 'nursing') {
      buckets.nursing.push({ order: o, actions: _actions('order', o, ctx.actor) });
    } else if (o.type === 'consult') {
      buckets.consultOrders.push({ order: o, actions: _actions('order', o, ctx.actor) });
    }
  }

  // Sort each medication bucket by drug name (Persian-friendly)
  Object.keys(buckets).forEach(k => {
    if (['oral','injectable','fluids','prn','topical','inhaled'].includes(k)) {
      buckets[k].sort((a, b) => String((a.order.details||{}).drug||'').localeCompare(String((b.order.details||{}).drug||''), 'fa'));
    } else {
      buckets[k].sort((a, b) => _sd(b.order.orderedAt) - _sd(a.order.orderedAt));
    }
  });

  // Consults: full objects
  const consults = _srtDesc(allConsults, 'requestedAt').map(c => ({
    consult: c, actions: _actions('consult', c, ctx.actor)
  }));

  // Vitals: last 10 + trend
  const vitals = _srtDesc(allVitals, 'recordedAt').slice(0, 10);
  const latestVital = vitals[0] || null;

  // I&O 24h
  const since24 = Date.now() - 24*3600*1000;
  const io24 = allIo.filter(r => _sd(r.recordedAt) >= since24);
  const ioSummary = {
    intake: io24.filter(r => r.type === 'intake').reduce((s, r) => s + (Number(r.volume) || 0), 0),
    output: io24.filter(r => r.type === 'output').reduce((s, r) => s + (Number(r.volume) || 0), 0),
    count: io24.length
  };
  ioSummary.balance = ioSummary.intake - ioSummary.output;

  // Alerts (24h, critical first)
  const dayAgo = Date.now() - 24*3600*1000;
  const alerts = allAlerts
    .filter(a => _sd(a.createdAt) > dayAgo)
    .sort((a, b) => {
      const order = { critical: 0, high: 1, warning: 2, info: 3 };
      const s = (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
      if (s !== 0) return s;
      return _sd(b.createdAt) - _sd(a.createdAt);
    })
    .slice(0, 30);

  // Counts per category
  const counts = {
    oral: buckets.oral.length,
    injectable: buckets.injectable.length,
    fluids: buckets.fluids.length,
    prn: buckets.prn.length,
    topical: buckets.topical.length,
    inhaled: buckets.inhaled.length,
    labs: buckets.labs.length,
    imaging: buckets.imaging.length,
    nursing: buckets.nursing.length,
    consults: consults.length,
    vitals: vitals.length,
    alerts: alerts.length,
    overdueMar: Object.values(buckets).reduce((s, arr) =>
      s + (Array.isArray(arr) ? arr.reduce((ss, e) => ss + ((e.timeline && e.timeline.overdueCount) || 0), 0) : 0), 0),
    pendingVerify: allOrders.filter(o => o.status === 'pending' && !['completed','cancelled','discontinued'].includes(o.status)).length
  };

  return {
    _rawOrders: allOrders, _rawMars: allMars, _rawConsults: allConsults,
    patient: {
      id: patient.id,
      name: ((patient.firstName || '') + ' ' + (patient.lastName || '')).trim(),
      age: patient.age || null,
      sex: patient.sex || null,
      wardCode: patient.wardCode || null,
      bedNumber: patient.bedNumber || null,
      nationalCode: patient.nationalCode || null,
      allergies: Array.isArray(patient.allergies) ? patient.allergies : (patient.allergies ? [patient.allergies] : []),
      admissionReason: patient.admissionReason || patient.chiefComplaint || null,
      attendingPhysician: patient.attendingPhysician || patient.attending || null,
      admittedAt: patient.admittedAt || patient.createdAt || null,
      weight: patient.weight || null,
      bloodType: patient.bloodType || null,
      riskFactors: patient.riskFactors || [],
      codeStatus: patient.codeStatus || null,
      isolation: patient.isolation || null
    },
    oral: buckets.oral,
    injectable: buckets.injectable,
    fluids: buckets.fluids,
    prn: buckets.prn,
    topical: buckets.topical,
    inhaled: buckets.inhaled,
    medications: [].concat(buckets.oral, buckets.injectable, buckets.fluids, buckets.prn, buckets.topical, buckets.inhaled),
    labs: buckets.labs,
    imaging: buckets.imaging,
    nursing: buckets.nursing,
    consults,
    vitals,
    latestVital,
    ioSummary,
    alerts,
    _meta: {
      generatedAt: new Date().toISOString(),
      generatedBy: ctx.actor ? { id: ctx.actor.id, role: ctx.actor.role } : null,
      counts
    }
  };
}

module.exports = { getPatientKardex, _classifyDrug };

// ═══════════════════════════════════════════════════════════
//  Clinical Cockpit v2 — additions
// ═══════════════════════════════════════════════════════════

const DRUG_CLASS = {
  cardiovascular: ['aspirin','clopidogrel','metoprolol','atorvastatin','nitroglycerin','heparin',
    'warfarin','amiodarone','digoxin','lisinopril','losartan','amlodipine','furosemide',
    'spironolactone','carvedilol','bisoprolol','ticagrelor','prasugrel','apixaban',
    'rivaroxaban','dabigatran','enoxaparin','nebivolol','valsartan','enalapril','isosorbide'],
  anti_infective: ['vancomycin','piperacillin','tazobactam','meropenem','ceftriaxone',
    'cefazolin','ciprofloxacin','levofloxacin','azithromycin','clindamycin','metronidazole',
    'amoxicillin','ampicillin','gentamicin','amikacin','linezolid','daptomycin',
    'fluconazole','acyclovir','oseltamivir','imipenem','cefepime','colistin'],
  endocrine: ['insulin','metformin','glipizide','levothyroxine','methimazole',
    'hydrocortisone','dexamethasone','prednisone','prednisolone','glucagon'],
  analgesia: ['morphine','fentanyl','hydromorphone','oxycodone','tramadol','acetaminophen',
    'paracetamol','ketorolac','ibuprofen','diclofenac','naproxen','pethidine','nalbuphine'],
  gi: ['omeprazole','pantoprazole','ranitidine','famotidine','ondansetron','metoclopramide',
    'domperidone','lactulose','bisacodyl','lansoprazole','esomeprazole'],
  respiratory: ['salbutamol','albuterol','ipratropium','budesonide','fluticasone',
    'montelukast','theophylline','aminophylline','tiotropium'],
  cns: ['midazolam','lorazepam','diazepam','haloperidol','quetiapine','olanzapine',
    'phenytoin','levetiracetam','valproate','propofol','dexmedetomidine','risperidone'],
  electrolytes: ['potassium chloride','magnesium sulfate','calcium gluconate','sodium bicarbonate'],
  fluid: ['normal saline','saline 0.9','ringer','lactate','dextrose','d5w','d10w','plasma-lyte']
};

function _drugClass(drugName) {
  const n = String(drugName || '').toLowerCase();
  for (const [cls, names] of Object.entries(DRUG_CLASS)) {
    if (names.some(d => n.includes(d))) return cls;
  }
  return 'other';
}

// Sort keys for classes (higher = more important)
const CLASS_PRIORITY = {
  cardiovascular: 10,
  anti_infective: 9,
  fluid: 8,
  endocrine: 7,
  analgesia: 6,
  respiratory: 5,
  gi: 4,
  cns: 3,
  electrolytes: 2,
  topical: 1,
  inhaled: 1,
  other: 0
};

function _trend(vitals, field) {
  if (!vitals || vitals.length < 2) return null;
  const recent = Number(vitals[0] && vitals[0][field]) || null;
  const prev = Number(vitals[1] && vitals[1][field]) || null;
  if (recent == null || prev == null) return null;
  if (Math.abs(recent - prev) < Math.max(2, Math.abs(prev) * 0.05)) return 'flat';
  return recent > prev ? 'up' : 'down';
}

function _computeUrgent(patientId, orders, mars, consults, alerts, actor) {
  const now = Date.now();
  const urgent = [];

  // 1) Overdue MARs
  mars.filter(m => ['scheduled','due'].includes(m.status) && _sd(m.scheduledAt) < now)
    .forEach(m => {
      const mins = Math.round((now - _sd(m.scheduledAt)) / 60000);
      urgent.push({
        kind: 'mar_overdue', entity: 'mar', id: m.id,
        severity: mins > 60 ? 'critical' : 'high',
        sortKey: 10000 + Math.min(9999, mins),
        icon: m.isHighAlert ? '⚠️' : '⏰',
        title: `${m.drugName} ${m.dose || ''}`,
        subtitle: `${mins} دقیقه تأخیر${m.isHighAlert ? ' — HIGH-ALERT (شاهد)' : ''}`,
        actions: ['administer','refuse','miss']
      });
    });

  // 2) Critical alerts
  alerts.filter(a => a.severity === 'critical').forEach(a => {
    urgent.push({
      kind: 'alert_critical', entity: 'alert', id: a.id,
      severity: 'critical', sortKey: 9000,
      icon: '🚨',
      title: a.title || a.type,
      subtitle: String(a.message || '').slice(0, 80),
      actions: []
    });
  });

  // 3) High-alert MARs due within 2h
  mars.filter(m => m.isHighAlert && ['scheduled','due'].includes(m.status) &&
    _sd(m.scheduledAt) > now && _sd(m.scheduledAt) < now + 2*3600*1000)
    .forEach(m => {
      const mins = Math.round((_sd(m.scheduledAt) - now) / 60000);
      urgent.push({
        kind: 'mar_high_due', entity: 'mar', id: m.id,
        severity: 'high', sortKey: 5000 + (120 - Math.min(120, mins)),
        icon: '⚠️',
        title: `${m.drugName} ${m.dose || ''} (High-Alert)`,
        subtitle: `در ${mins} دقیقه — نیاز به شاهد دوم`,
        actions: ['administer']
      });
    });

  // 4) Pending orders (verify)
  orders.filter(o => o.status === 'pending').forEach(o => {
    const d = o.details || {};
    urgent.push({
      kind: 'order_pending', entity: 'order', id: o.id,
      severity: o.priority === 'stat' ? 'high' : 'warning',
      sortKey: o.priority === 'stat' ? 4000 : 2000,
      icon: o.priority === 'stat' ? '⚡' : '📋',
      title: `دستور جدید: ${d.drug || d.panel || o.type}`,
      subtitle: `${d.dose || ''} ${d.route || ''}`.trim(),
      actions: ['verify','cancel']
    });
  });

  // 5) Emergency consults awaiting response
  consults.filter(c => c.status === 'requested' && c.consultType === 'emergency')
    .forEach(c => {
      urgent.push({
        kind: 'consult_urgent', entity: 'consult', id: c.id,
        severity: 'high', sortKey: 3000,
        icon: '🩺',
        title: `مشاوره اورژانسی — ${c.targetService}`,
        subtitle: String(c.question || '').slice(0, 80),
        actions: ['respond']
      });
    });

  return urgent.sort((a, b) => b.sortKey - a.sortKey);
}

function _nextHoursTimeline(orders, mars, consults) {
  const now = Date.now();
  const horizon = now + 8 * 3600 * 1000;
  const items = [];

  // MARs in next 8h
  mars.filter(m => ['scheduled','due'].includes(m.status) &&
    _sd(m.scheduledAt) >= now && _sd(m.scheduledAt) <= horizon)
    .forEach(m => {
      items.push({
        at: m.scheduledAt, type: 'mar', entity: 'mar', id: m.id,
        icon: m.isHighAlert ? '⚠️' : '💊',
        title: `${m.drugName} ${m.dose || ''}`,
        subtitle: m.route || '',
        isHighAlert: !!m.isHighAlert
      });
    });

  // Consults due
  consults.filter(c => c.status === 'requested' && c.responseDueAt &&
    _sd(c.responseDueAt) <= horizon).forEach(c => {
    items.push({
      at: c.responseDueAt, type: 'consult', entity: 'consult', id: c.id,
      icon: '🩺',
      title: `پاسخ مشاوره — ${c.targetService}`,
      subtitle: 'expected response',
      isHighAlert: c.consultType === 'emergency'
    });
  });

  return items.sort((a, b) => _sd(a.at) - _sd(b.at));
}

// Wrap original getPatientKardex — enrich with new fields
const _origGet = getPatientKardex;
function getPatientKardexV2(ctx, patientId) {
  const d = _origGet(ctx, patientId);

  // Group medications by clinical class
  const medGroups = {};
  ['oral','injectable','fluids','prn','topical','inhaled'].forEach(bucket => {
    (d[bucket] || []).forEach(entry => {
      const drug = (entry.order.details || {}).drug || '';
      let cls = _drugClass(drug);
      // Override: PRN or fluids buckets stay their own class
      if (bucket === 'prn') cls = 'analgesia_prn';
      else if (bucket === 'fluids') cls = 'fluid';
      if (!medGroups[cls]) medGroups[cls] = [];
      medGroups[cls].push(Object.assign({}, entry, { _bucket: bucket }));
    });
  });

  // Sort each group by drug name
  Object.values(medGroups).forEach(arr => {
    arr.sort((a, b) => String(a.order.details?.drug || '').localeCompare(String(b.order.details?.drug || ''), 'fa'));
  });

  // Order groups by clinical priority
  const orderedGroups = Object.entries(medGroups)
    .sort((a, b) => {
      const pa = a[0] === 'analgesia_prn' ? CLASS_PRIORITY.analgesia : (CLASS_PRIORITY[a[0]] ?? 0);
      const pb = b[0] === 'analgesia_prn' ? CLASS_PRIORITY.analgesia : (CLASS_PRIORITY[b[0]] ?? 0);
      return pb - pa;
    })
    .map(([cls, entries]) => ({ class: cls, entries }));

  // Vitals trend
  const v = d.vitals || [];
  const trends = {
    hr: _trend(v, 'hr'),
    spo2: _trend(v, 'spo2'),
    sbp: _trend(v, 'bp_sys'),
    temp: _trend(v, 'temp'),
    news: _trend(v, 'news2')
  };

  // Urgent actions
  const urgent = _computeUrgent(patientId, d._rawOrders || [], d._rawMars || [], d._rawConsults || [], d.alerts || [], ctx.actor);

  // Next 8h timeline
  const timeline = _nextHoursTimeline(d._rawOrders || [], d._rawMars || [], d._rawConsults || []);

  return Object.assign({}, d, {
    medGroups: orderedGroups,
    trends,
    urgent,
    timeline,
    currentVitals: d.latestVital ? {
      hr: d.latestVital.hr, spo2: d.latestVital.spo2,
      sbp: d.latestVital.bp_sys, dbp: d.latestVital.bp_dia,
      temp: d.latestVital.temp, news2: d.latestVital.news2,
      newsLevel: d.latestVital.newsLevel, recordedAt: d.latestVital.recordedAt
    } : null
  });
}

module.exports.getPatientKardexV2 = getPatientKardexV2;
