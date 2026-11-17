'use strict';
const store = require('./store');
const _subs = {}, _events = [];
let _buf = [], _timer = null;

function _flushSync() {
  if (!_buf.length) return;
  const batch = _buf; _buf = [];
  if (_timer) { clearTimeout(_timer); _timer = null; }
  for (const rec of batch) {
    try { store.put('event_log_' + rec.at.slice(0, 10), rec); } catch (_) {}
  }
}

function _flushAsync() {
  if (!_buf.length) return;
  const batch = _buf; _buf = [];
  setImmediate(() => {
    for (const rec of batch) {
      try { store.put('event_log_' + rec.at.slice(0, 10), rec); } catch (_) {}
    }
  });
}

function on(evt, fn) { (_subs[evt] = _subs[evt] || []).push(fn); }

function emit(evt, payload) {
  const p = payload || {};
  const _snap = (typeof structuredClone === 'function') ? structuredClone(p) : JSON.parse(JSON.stringify(p));
  const record = {
    id: store.uid('evt'), event: evt, at: new Date().toISOString(),
    actor: p.actor || null, data: _snap
  };
  _events.push(record);
  if (_events.length > 5000) _events.shift();
  _buf.push(record);
  if (_buf.length >= 100) _flushAsync();
  else if (!_timer) _timer = setTimeout(() => { _timer = null; _flushAsync(); }, 1000);
  const fns = (_subs[evt] || []).concat(_subs['*'] || []);
  if (fns.length) queueMicrotask(() => {
    for (const fn of fns) { try { fn(_snap); } catch (e) { console.error('[sub]', evt, e.message); } }
  });
  return record;
}

function recent(limit) { return _events.slice(-(limit || 100)).reverse(); }
function since(iso) { return _events.filter(e => e.at >= iso); }

function flushEvents() { _flushSync(); }

process.on('exit', () => { try { _flushSync(); } catch (_) {} });

module.exports = { on, emit, recent, since, flushEvents };
