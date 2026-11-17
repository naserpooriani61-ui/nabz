'use strict';
// core/domain/alert-stream.js — long-polling alert stream
//   poll(actor, sinceMs) → { alerts, since, hasMore }
// Blocks up to 20s waiting for a new alert matching the actor's ward/role.
const bus = require('../events');
const store = require('../store');
const waiters = new Set();

function _matches(actor, alert) {
  if (!actor) return false;
  const role = actor.role || '';
  if (['admin', 'supervisor_clinical', 'head_nurse'].includes(role)) return true;
  const aw = actor.wardCode || actor.ward;
  const bw = alert.wardCode;
  if (aw && bw && aw !== bw) return false;
  return true;
}

function _norm(a) {
  return {
    id: a.id || null,
    type: a.type || 'event',
    severity: a.severity || 'warning',
    patientId: a.patientId,
    patientName: a.patientName || '',
    title: a.title || a.type || 'هشدار',
    message: a.message || '',
    recommendation: a.recommendation || '',
    wardCode: a.wardCode || null,
    at: a.createdAt || new Date().toISOString()
  };
}

function _fromStore(actor, sinceMs) {
  try {
    return store.readAll('cdss_alerts')
      .filter(a => !a.dismissed &&
                   new Date(a.createdAt || 0).getTime() > sinceMs &&
                   _matches(actor, a))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 20)
      .map(_norm);
  } catch (_) { return []; }
}

function _liveEmit(p) {
  const raw = (p && (p.record || p)) || {};
  if (!raw.patientId) return;
  const alert = _norm(raw);
  for (const w of Array.from(waiters)) {
    if (w.done) continue;
    if (!_matches(w.actor, alert)) continue;
    w.done = true;
    clearTimeout(w.timer);
    waiters.delete(w);
    try { w.resolve({ alerts: [alert], since: Date.now(), hasMore: true }); } catch (_) {}
  }
}

bus.on('cdss.alert', _liveEmit);

async function poll(actor, sinceMs) {
  sinceMs = Number(sinceMs) || (Date.now() - 5000);
  // 1. Catch-up from persistent store
  const fresh = _fromStore(actor, sinceMs);
  if (fresh.length > 0) {
    return { alerts: fresh, since: Date.now(), hasMore: true };
  }
  // 2. Long-poll
  return new Promise((resolve) => {
    const w = { resolve, actor, done: false, timer: null };
    w.timer = setTimeout(() => {
      if (w.done) return;
      w.done = true;
      waiters.delete(w);
      resolve({ alerts: [], since: sinceMs, hasMore: false });
    }, 20000);
    waiters.add(w);
  });
}

function stats() {
  return { waiters: waiters.size };
}

module.exports = { poll, stats };
