'use strict';
// core/domain/transfer-writer.js — unified write path for 'transfers'

let _modStore, _modBus;

function _store(ctx) {
  if (ctx && ctx.store && typeof ctx.store.put === 'function') return ctx.store;
  if (!_modStore) { try { _modStore = require('../store'); } catch (_) {} }
  if (!_modStore) throw new Error('transfer-writer: no store');
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
  throw new Error('transfer-writer: no uid');
}
function _now(ctx) { return (ctx && typeof ctx.now === 'function') ? ctx.now() : new Date().toISOString(); }
function _emit(ctx, event, payload) {
  const b = _bus(ctx);
  if (b && typeof b.emit === 'function') {
    try { b.emit(event, payload); } catch (e) { console.warn('[transfer-writer] emit:', e.message); }
  }
}
function _validate(ctx, rec) {
  if (!rec || typeof rec !== 'object') throw new Error('transfer:invalid_record');
  if (!rec.patientId) throw new Error('transfer:patient_id_required');
  if (!rec.toWard) throw new Error('transfer:to_ward_required');
  return true;
}

function create(ctx, raw, opts) {
  _validate(ctx, raw);
  raw.id = raw.id || _uid(ctx, 'trf');
  raw.status = raw.status || 'requested';
  raw.requestedAt = raw.requestedAt || _now(ctx);
  raw.requestedBy = raw.requestedBy || (ctx && ctx.actor && ctx.actor.id);
  _store(ctx).put('transfers', raw);
  _emit(ctx, (opts && opts.event) || 'transfer.requested', { record: raw, actor: ctx && ctx.actor });
  return raw;
}

function put(ctx, rec, opts) {
  if (!rec || !rec.id) throw new Error('transfer:put_needs_id');
  _store(ctx).put('transfers', rec);
  if (opts && opts.event) _emit(ctx, opts.event, { record: rec, actor: ctx && ctx.actor });
  return rec;
}

module.exports = { create, put };
