'use strict';
// core/domain/task-scheduler.js — periodic SLA check + escalation

const T = require('./clinical-tasks');
let _timer = null;
let _ctx = null;

function _tick() {
  if (!_ctx) return;
  try {
    const overdue = T.listOverdue(_ctx);
    overdue.forEach(t => {
      if (t.status === 'open' || t.status === 'acknowledged') {
        T.escalate(_ctx, t.id, 'sla_breached');
      }
    });
  } catch (e) {
    console.warn('[task-scheduler] tick error:', e.message);
  }
}

function start(baseCtx) {
  if (_timer) return;
  _ctx = {
    store: baseCtx.store,
    bus: baseCtx.bus,
    actor: { id: 'scheduler', role: 'system' },
    now: () => new Date().toISOString(),
    uid: (p) => baseCtx.store.uid(p)
  };
  _timer = setInterval(_tick, 60000);
  try { if (_timer.unref) _timer.unref(); } catch (_) {}
  console.log('[task-scheduler] started (60s interval)');
}

function stop() { if (_timer) { clearInterval(_timer); _timer = null; } }

module.exports = { start, stop, tick: _tick };
