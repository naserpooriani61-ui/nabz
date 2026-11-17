'use strict';
// core/domain/discharge-writer.js — unified write path for 'discharges'

let _modStore, _modBus;

function _store(ctx) {
  if (ctx && ctx.store && typeof ctx.store.put === 'function') return ctx.store;
  if (!_modStore) { try { _modStore = require('../store'); } catch (_) {} }
  if (!_modStore) throw new Error('discharge-writer: no store');
  return _modStore;
}
function _bus(ctx) {
  if (ctx && ctx.bus && typeof ctx.bus.emit === 'function') return ctx.bus;
  if (!_modBus) { try { _modBus = require('../events'); } catch (_) {} }
  return _modBus;
}
function _uid(ctx, prefix) {
  if (ctx && typeof ctx.uid === 'function') return ctx.uid(prefix);
  const s = _store(ctx);
  if (typeof s.uid === 'function') return s.uid(prefix);
  throw new Error('discharge-writer: no uid');
}
function _now(ctx) { return (ctx && typeof ctx.now === 'function') ? ctx.now() : new Date().toISOString(); }
function _emit(ctx, event, payload) {
  const b = _bus(ctx);
  if (b && typeof b.emit === 'function') {
    try { b.emit(event, payload); } catch (e) { console.warn('[discharge-writer] emit:', e.message); }
  }
}
function _validate(ctx, rec) {
  if (!rec || typeof rec !== 'object') throw new Error('discharge:invalid_record');
  if (!rec.patientId) throw new Error('discharge:patient_id_required');
  return true;
}

function create(ctx, raw, opts) {
  _validate(ctx, raw);
  raw.id = raw.id || _uid(ctx, 'dsc');
  raw.status = raw.status || 'planned';
  raw.plannedAt = raw.plannedAt || _now(ctx);
  raw.plannedBy = raw.plannedBy || (ctx && ctx.actor && ctx.actor.id);
  _store(ctx).put('discharges', raw);
  if (opts && opts.event) _emit(ctx, opts.event, { record: raw, actor: ctx && ctx.actor });
  return raw;
}

function put(ctx, rec, opts) {
  if (!rec || !rec.id) throw new Error('discharge:put_needs_id');
  _store(ctx).put('discharges', rec);
  if (opts && opts.event) _emit(ctx, opts.event, { record: rec, actor: ctx && ctx.actor });
  return rec;
}

module.exports = { create, put };
