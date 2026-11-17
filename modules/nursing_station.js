'use strict';
const store = require('../core/store');
const perms = require('../core/permissions');
const neural = require('../core/neural');
const resolver = require('../core/ward-resolver');

if (!perms.P['nursing.station.view']) {
  Object.assign(perms.P, {
    'nursing.station.view': 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,supervisor_er,head_nurse,attending,specialist,physician,resident,nurse,nurse_aide,assistant_nurse'
  });
}

function coll(n) { try { var r = store.readAll(n); return Array.isArray(r) ? r : []; } catch (_) { return []; } }
function sd(x) { if (!x) return 0; var d = new Date(x); return isNaN(d.getTime()) ? 0 : d.getTime(); }

function currentShift() {
  try {
    var t = require('../core/time');
    var h = t.hourTehran ? t.hourTehran() : new Date().getHours();
    if (h >= 7 && h < 14) return 'morning';
    if (h >= 14 && h < 19) return 'evening';
    return 'night';
  } catch (_) { return 'morning'; }
}

function shiftLabel(s) {
  return s === 'morning' ? 'صبح' : s === 'evening' ? 'عصر' : 'شب';
}

function wardAccess(actor, ward) {
  if (actor.role === 'admin') return true;
  if (perms.isCrossWard(actor.role)) return true;
  var scope = null;
  try { scope = perms.resolveScope(actor); } catch (_) {}
  if (!scope || scope.kind === 'none') return false;
  if (scope.kind === 'all') return true;
  if (scope.kind === 'wards') return scope.codes.indexOf(ward) >= 0;
  return false;
}

function getStation(ctx) {
  var ward = ctx.query.ward || ctx.actor.ward;
  if (!ward) throw ctx.E.badRequest('ward_not_configured');
  if (!wardAccess(ctx.actor, ward)) throw ctx.E.forbidden('ward_out_of_scope');

  var wardInfo = (coll('sa_wards').find(function(w) { return w.code === ward; })) ||
                 (coll('hospital_wards').find(function(w) { return w.code === ward; })) ||
                 { code: ward, label: ward };

  var patients = coll('patients').filter(function(p) { return p.wardCode === ward && ['in_care','admitted'].indexOf(p.status) >= 0; });
  var pidSet = new Set(patients.map(function(p) { return p.id; }));

  var lastVital = {};
  coll('vitals').forEach(function(v) {
    if (!pidSet.has(v.patientId)) return;
    if (!lastVital[v.patientId] || sd(v.recordedAt) > sd(lastVital[v.patientId].recordedAt)) lastVital[v.patientId] = v;
  });

  var nowMs = Date.now();
  var allMar = coll('mar').filter(function(m) { return pidSet.has(m.patientId); });
  var marDue = allMar.filter(function(m) { return ['scheduled','due'].indexOf(m.status) >= 0 && sd(m.scheduledAt) < nowMs + 2*3600000; });
  var marOverdue = marDue.filter(function(m) { return sd(m.scheduledAt) < nowMs; });
  var marHigh = marDue.filter(function(m) { return m.isHighAlert; });

  var marByHour = {};
  marDue.forEach(function(m) {
    var hh = new Date(m.scheduledAt).getHours();
    if (!marByHour[hh]) marByHour[hh] = [];
    marByHour[hh].push(m);
  });
  var bedMap = {};
  coll('beds').forEach(function(b) { if (b.patientId) bedMap[b.patientId] = b.bedNumber; });

  var criticalLabs = coll('labs').filter(function(l) {
    return pidSet.has(l.patientId) && l.criticalFlags && l.criticalFlags.length &&
      ['resulted','verified'].indexOf(l.status) >= 0 &&
      (!l.acknowledgment || !l.acknowledgment.acknowledged);
  });
  var isolations = coll('isolations').filter(function(i) { return pidSet.has(i.patientId) && i.status === 'active'; });
  var sepsis = coll('sepsis').filter(function(s) { return pidSet.has(s.patientId) && ['suspected','confirmed','septic_shock'].indexOf(s.status) >= 0; });

  var patientList = patients.map(function(p) {
    var lv = lastVital[p.id];
    var pMar = marDue.filter(function(m) { return m.patientId === p.id; });
    var pOver = pMar.filter(function(m) { return sd(m.scheduledAt) < nowMs; });
    var pMissed = allMar.filter(function(m) { return m.patientId === p.id && m.status === 'missed'; });
    var risk = { score: 0, level: 'lo' };
    try { risk = neural.patientRisk(p, { lastVital: lv, marMissed: pMissed.length }); } catch (_) {}
    return {
      id: p.id, name: p.firstName + ' ' + p.lastName,
      age: p.age, sex: p.sex, bed: p.bedNumber,
      diagnosis: p.diagnosis, codeStatus: p.codeStatus,
      allergies: p.allergies || [],
      news2: lv ? (lv.news2 || 0) : null,
      lastVitalHours: lv ? Math.round((nowMs - sd(lv.recordedAt)) / 3600000) : null,
      marDue: pMar.length, marOverdue: pOver.length,
      marHigh: pMar.filter(function(m) { return m.isHighAlert; }).length,
      hasIsolation: isolations.some(function(i) { return i.patientId === p.id; }),
      hasSepsis: sepsis.some(function(s) { return s.patientId === p.id; }),
      hasCriticalLab: criticalLabs.some(function(l) { return l.patientId === p.id; }),
      riskScore: risk.score || 0, riskLevel: risk.level || 'lo'
    };
  }).sort(function(a, b) {
    if (a.hasSepsis !== b.hasSepsis) return a.hasSepsis ? -1 : 1;
    if (a.hasCriticalLab !== b.hasCriticalLab) return a.hasCriticalLab ? -1 : 1;
    var aN = a.news2 || 0, bN = b.news2 || 0;
    if (Math.abs(aN - bN) >= 2) return bN - aN;
    return b.riskScore - a.riskScore;
  });

  var vitalsDue = patients.filter(function(p) {
    var lv = lastVital[p.id];
    return !lv || (nowMs - sd(lv.recordedAt)) > 4*3600000;
  }).map(function(p) {
    return { id: p.id, name: p.firstName + ' ' + p.lastName, bed: p.bedNumber,
      hoursSince: lastVital[p.id] ? Math.round((nowMs - sd(lastVital[p.id].recordedAt))/3600000) : null };
  });

  var beds = coll('beds').filter(function(b) { return b.wardCode === ward; });
  var bedStats = {
    total: beds.length,
    occupied: beds.filter(function(b) { return b.status === 'occupied'; }).length,
    available: beds.filter(function(b) { return b.status === 'available'; }).length,
    cleaning: beds.filter(function(b) { return b.status === 'cleaning'; }).length,
    maintenance: beds.filter(function(b) { return b.status === 'maintenance'; }).length
  };

  var handoffs = coll('signouts').filter(function(s) { return s.toUserId === ctx.actor.id && s.status === 'pending'; });
  var shift = currentShift();

  return {
    ward: { code: ward, label: wardInfo.label || wardInfo.label, headNurseName: wardInfo.headNurseName || wardInfo.headNurse || null },
    shift: shift, shiftLabel: shiftLabel(shift),
    actor: { name: ctx.actor.fullName || ctx.actor.username, role: ctx.actor.role },
    patients: patientList,
    marBoard: {
      total: marDue.length, overdue: marOverdue.length, highAlert: marHigh.length,
      byHour: Object.keys(marByHour).map(function(h) {
        return { hour: parseInt(h, 10), count: marByHour[h].length,
          items: marByHour[h].slice(0, 6).map(function(m) {
            return { id: m.id, patientName: m.patientName, bed: bedMap[m.patientId] || null,
              drug: m.drugName, dose: m.dose, isHighAlert: !!m.isHighAlert };
          })};
      }).sort(function(a, b) { return a.hour - b.hour; })
    },
    vitalsDue: { total: vitalsDue.length, list: vitalsDue.slice(0, 20) },
    criticalLabs: {
      total: criticalLabs.length,
      list: criticalLabs.slice(0, 8).map(function(l) {
        return { id: l.id, patientName: l.patientName, panel: l.panelName || l.panelCode, flags: l.criticalFlags.length };
      })
    },
    isolation: { total: isolations.length, list: isolations.map(function(i) { return { id: i.id, patientName: i.patientName, type: i.type }; }) },
    sepsis: { total: sepsis.length, list: sepsis.map(function(s) { return { id: s.id, patientName: s.patientName, status: s.status }; }) },
    beds: bedStats,
    handoffs: { total: handoffs.length,
      list: handoffs.slice(0, 5).map(function(h) { return { id: h.id, fromUserName: h.fromUserName, patientCount: (h.patients || []).length }; }) },
    generatedAt: new Date().toISOString()
  };
}

function listWardsForStation(ctx) {
  var wards = coll('sa_wards');
  var hw = coll('hospital_wards');
  var hwCodes = {};
  hw.forEach(function(w) { hwCodes[w.code] = w; });
  var items = wards.map(function(w) {
    var h = hwCodes[w.code] || {};
    return { code: w.code, label: h.label || w.label || w.code,
      headNurse: h.headNurseName || w.headNurse || null,
      isClosed: !!h.isClosed };
  });
  if (ctx.actor.role !== 'admin' && !perms.isCrossWard(ctx.actor.role)) {
    var scope = null;
    try { scope = perms.resolveScope(ctx.actor); } catch (_) {}
    if (scope && scope.kind === 'wards') items = items.filter(function(w) { return scope.codes.indexOf(w.code) >= 0; });
    else if (ctx.actor.ward) items = items.filter(function(w) { return w.code === ctx.actor.ward; });
  }
  return { items: items, total: items.length, current: ctx.actor.ward };
}

module.exports = {
  handlers: { getStation: getStation, listWards: listWardsForStation },
  routes: [
    { method: 'GET', path: '/api/nursing/station', handler: 'getStation', perm: 'nursing.station.view' },
    { method: 'GET', path: '/api/nursing/wards',   handler: 'listWards',  perm: 'nursing.station.view' }
  ],
  panels: [
    { id: 'station', title: 'ایستگاه پرستاری', icon: '🏥',
      perm: 'nursing.station.view', kind: 'nursing_station', api: '/api/nursing/station' }
  ]
};
console.log('[nursing_station] backend loaded');
