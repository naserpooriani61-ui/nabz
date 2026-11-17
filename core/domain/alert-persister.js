'use strict';
// core/domain/alert-persister.js
// Persists external `cdss.alert` emits into `cdss_alerts` collection.
// cdss.js already persists its own alerts (has id). This fills the gap for
// 13 other emit points that previously NEVER reached the Alerts Hub.
const bus = require('../events');
const store = require('../store');

const COOLDOWN_MS = {
  wait_time_exceeded:  30 * 60 * 1000,
  asp_48h_review:      12 * 60 * 60 * 1000,
  transfusion_active:  15 * 60 * 1000,
  qsofa_high:           6 * 60 * 60 * 1000,
  _default:             1 * 60 * 60 * 1000
};
const CRITICAL_MAX_MS = 15 * 60 * 1000;
const _cooldown = new Map();

function _ttlFor(type, severity) {
  const base = COOLDOWN_MS[type] || COOLDOWN_MS._default;
  return severity === 'critical' ? Math.min(base, CRITICAL_MAX_MS) : base;
}

function _shouldSkip(key, type, severity) {
  const now = Date.now();
  const prev = _cooldown.get(key);
  if (prev && now - prev < _ttlFor(type, severity)) return true;
  _cooldown.set(key, now);
  if (_cooldown.size > 2000) {
    const maxTtl = Math.max.apply(null, Object.values(COOLDOWN_MS));
    const cutoff = now - maxTtl;
    for (const [k, t] of _cooldown) if (t < cutoff) _cooldown.delete(k);
  }
  return false;
}

function _persist(alert) {
  try {
    if (!alert || typeof alert !== 'object') return null;
    if (alert.id) return null;                 // already persisted by cdss.js internals
    if (!alert.patientId || !alert.type) return null;
    const key = alert.patientId + ':' + alert.type;
    if (_shouldSkip(key, alert.type, alert.severity)) return null;
    const rec = {
      id: store.uid('cdss_alert'),
      createdAt: new Date().toISOString(),
      dismissed: false,
      readBack: alert.severity === 'critical'
        ? { required: true, acknowledged: false, acknowledgedAt: null, acknowledgedBy: null }
        : null,
      _source: 'external-persister',
      type: alert.type,
      severity: alert.severity || 'warning',
      patientId: alert.patientId,
      patientName: alert.patientName || '',
      title: alert.title || alert.type,
      message: alert.message || '',
      recommendation: alert.recommendation || ''
    };
    store.put('cdss_alerts', rec);
    return rec;
  } catch (e) {
    console.warn('[alert-persister] persist:', e.message);
    return null;
  }
}

bus.on('cdss.alert', _persist);

module.exports = { _persist, _cooldown, _ttlFor };
