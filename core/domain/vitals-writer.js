'use strict';
// core/domain/vitals-writer.js — unified write path for 'vitals'
//   record(ctx, raw, opts?)  → new vitals; auto NEWS2; emits vitals.recorded + vitals.critical if needed
//   save(ctx, rec, opts?)    → update existing; emits only if opts.event
let _modStore, _modBus, _modHelpers;

function _store(ctx) {
  if (ctx && ctx.store && typeof ctx.store.put === 'function') return ctx.store;
  if (!_modStore) { try { _modStore = require('../store'); } catch (_) {} }
  if (!_modStore) throw new Error('vitals-writer: no store');
  return _modStore;
}
function _bus(ctx) {
  if (ctx && ctx.bus && typeof ctx.bus.emit === 'function') return ctx.bus;
  if (!_modBus) { try { _modBus = require('../events'); } catch (_) {} }
  return _modBus;
}
function _helpers() {
  if (!_modHelpers) { try { _modHelpers = require('../mod-helpers'); } catch (_) { _modHelpers = {}; } }
  return _modHelpers;
}
function _uid(ctx, prefix) {
  if (ctx && typeof ctx.uid === 'function') return ctx.uid(prefix);
  const s = _store(ctx);
  if (typeof s.uid === 'function') return s.uid(prefix);
  throw new Error('vitals-writer: no uid');
}
function _now(ctx) { return (ctx && typeof ctx.now === 'function') ? ctx.now() : new Date().toISOString(); }
function _num(x) { const n = Number(x); return isFinite(n) ? n : null; }
function _err(ctx, code) {
  if (ctx && ctx.E && typeof ctx.E.badRequest === 'function') {
    try { return ctx.E.badRequest(code); } catch (_) {}
  }
  const e = new Error(code); e.code = code; return e;
}
function _emit(ctx, event, payload) {
  const b = _bus(ctx);
  if (b && typeof b.emit === 'function') {
    try { b.emit(event, payload); } catch (e) { console.warn('[vitals-writer] emit:', e.message); }
  }
}

const NUM_FIELDS = ['hr','bp_sys','bp_dia','rr','temp','spo2','gcs','pain'];

function _validate(ctx, rec) {
  if (!rec || typeof rec !== 'object') throw _err(ctx, 'vitals:invalid_record');
  if (!rec.patientId) throw _err(ctx, 'vitals:patient_id_required');
  return true;
}

function _norm(ctx, rec) {
  for (const f of NUM_FIELDS) if (rec[f] != null) rec[f] = _num(rec[f]);
  rec.onOxygen = !!rec.onOxygen;
  rec.consciousness = rec.consciousness || 'alert';
  rec.notes = rec.notes || '';
  return rec;
}

function _computeNEWS2(rec) {
  try { return require('./news2').calc(rec); } catch (_) { return null; }
}

function record(ctx, raw, opts) {
  _validate(ctx, raw);
  _norm(ctx, raw);
  if (raw.news2 == null) {
    const n = _computeNEWS2(raw);
    if (n && typeof n === 'object') {
      raw.news2 = n.total;
      raw.newsLevel = raw.newsLevel || n.risk;
      raw.newsAction = raw.newsAction || n.action;
    }
  }
  raw.id = raw.id || _uid(ctx, 'vit');
  raw.recordedAt = raw.recordedAt || _now(ctx);
  raw.recordedBy = raw.recordedBy || (ctx && ctx.actor && ctx.actor.id);
  _store(ctx).put('vitals', raw);
  if (opts && typeof opts.sign === 'function') {
    try { opts.sign(raw, ctx); } catch (e) { console.warn('[vitals-writer] sign:', e.message); }
  }
  _emit(ctx, (opts && opts.event) || 'vitals.recorded', { record: raw, actor: ctx.actor });
  if (raw.newsLevel === 'critical' || (typeof raw.news2 === 'number' && raw.news2 >= 7)) {
    _emit(ctx, 'vitals.critical', { record: raw, actor: ctx.actor });
  }
  return raw;
}

function save(ctx, rec, opts) {
  _validate(ctx, rec);
  if (!rec.id) throw _err(ctx, 'vitals:save_needs_id');
  _norm(ctx, rec);
  _store(ctx).put('vitals', rec);
  if (opts && opts.event) _emit(ctx, opts.event, { record: rec, actor: ctx.actor });
  return rec;
}

module.exports = { record, save };
