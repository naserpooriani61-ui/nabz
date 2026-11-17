'use strict';
// core/domain/kardex-shift.js — Ward-level shift Kardex (handover sheet)
const store = require('../store');
const SHIFTS = {
  morning: { label: 'صبح', start: 7,  end: 19 },
  evening: { label: 'عصر', start: 19, end: 7  },
  night:   { label: 'شب',  start: 23, end: 7  }
};
function _all(c) { try { return store.readAll(c); } catch (_) { return []; } }
function _sd(x) { return x ? new Date(x).getTime() : 0; }
function _pname(p) { return p ? ((p.firstName||'')+' '+(p.lastName||'')).trim() : ''; }
function _currentShift() {
  const h = new Date().getHours();
  if (h >= 7 && h < 19) return 'morning';
  return 'evening';
}

function getShiftKardex(ctx, wardCode, shiftType) {
  if (!wardCode) throw (ctx.E ? ctx.E.badRequest('ward_required') : new Error('ward_required'));
  shiftType = shiftType || _currentShift();
  if (!SHIFTS[shiftType]) throw (ctx.E ? ctx.E.badRequest('invalid_shift') : new Error('invalid_shift'));

  const now = Date.now(), soon = now + 2*3600*1000, dayAgo = now - 24*3600*1000;
  const patients = _all('patients').filter(p => p.wardCode === wardCode &&
    ['in_care','admitted','active'].includes(p.status));
  const ids = new Set(patients.map(p => p.id));
  const pmap = {}; patients.forEach(p => { pmap[p.id] = p; });

  const mar = _all('mar').filter(m => ids.has(m.patientId));
  const enrich = (arr) => arr.slice(0, 60).map(m => Object.assign({}, m, { patientName: _pname(pmap[m.patientId]) || m.patientName || '' }));

  const overdue = mar.filter(m => _sd(m.scheduledAt) <= now && ['scheduled','due'].includes(m.status))
                      .sort((a,b) => _sd(a.scheduledAt) - _sd(b.scheduledAt));
  const dueNow  = mar.filter(m => { const t = _sd(m.scheduledAt); return t > now && t <= soon && ['scheduled','due'].includes(m.status); })
                     .sort((a,b) => _sd(a.scheduledAt) - _sd(b.scheduledAt));

  const pendingVerify = _all('orders').filter(o => ids.has(o.patientId) && o.status === 'pending');
  const critical = _all('cdss_alerts').filter(a => ids.has(a.patientId) && !a.dismissed &&
    a.severity === 'critical' && _sd(a.createdAt) > dayAgo);

  return {
    wardCode, shiftType, shiftLabel: SHIFTS[shiftType].label,
    generatedAt: new Date().toISOString(),
    dueNow: enrich(dueNow), overdue: enrich(overdue),
    pendingVerify: pendingVerify.slice(0,30).map(o => ({
      id:o.id, patientId:o.patientId, patientName:_pname(pmap[o.patientId]),
      type:o.type, priority:o.priority, drug:(o.details&&o.details.drug)||'',
      dose:(o.details&&o.details.dose)||'', orderedAt:o.orderedAt
    })),
    critical: critical.slice(0,30).map(a => ({
      id:a.id, patientId:a.patientId, patientName:_pname(pmap[a.patientId])||a.patientName||'',
      type:a.type, title:a.title, message:a.message, severity:a.severity, createdAt:a.createdAt
    })),
    totals: { patients: patients.length, dueNow: dueNow.length,
              overdue: overdue.length, pendingVerify: pendingVerify.length,
              critical: critical.length }
  };
}
module.exports = { getShiftKardex, SHIFTS, currentShift: _currentShift };
