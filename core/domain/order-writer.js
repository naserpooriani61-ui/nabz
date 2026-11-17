'use strict';
// core/domain/order-writer.js — unified write path for 'orders'
//   create(ctx, raw, opts?)               → emits kardex.order.created (or opts.event)
//   save(ctx, rec, opts?)                 → plain update; emits only if opts.event
//   transition(ctx, id, action, opts?)    → SM + fields + emit + after hook
let _modStore = null, _modBus = null, _modSM = null;

function _store(ctx) {
  if (ctx && ctx.store && typeof ctx.store.put === 'function') return ctx.store;
  if (!_modStore) { try { _modStore = require('../store'); } catch (_) {} }
  if (!_modStore) throw new Error('order-writer: no store available');
  return _modStore;
}
function _bus(ctx) {
  if (ctx && ctx.bus && typeof ctx.bus.emit === 'function') return ctx.bus;
  if (!_modBus) { try { _modBus = require('../events'); } catch (_) {} }
  return _modBus;
}
function _sm() {
  if (!_modSM) { try { _modSM = require('../state-machine'); } catch (_) {} }
  if (!_modSM) throw new Error('order-writer: state-machine unavailable');
  return _modSM;
}
function _uid(ctx, prefix) {
  if (ctx && typeof ctx.uid === 'function') return ctx.uid(prefix);
  const s = _store(ctx);
  if (typeof s.uid === 'function') return s.uid(prefix);
  throw new Error('order-writer: no uid() available');
}
function _now(ctx) { return (ctx && typeof ctx.now === 'function') ? ctx.now() : new Date().toISOString(); }
function _err(ctx, code) {
  if (ctx && ctx.E && typeof ctx.E.badRequest === 'function') {
    try { return ctx.E.badRequest(code); } catch (_) {}
  }
  const e = new Error(code); e.code = code; return e;
}
function _emit(ctx, event, payload) {
  const b = _bus(ctx);
  if (b && typeof b.emit === 'function') {
    try { b.emit(event, payload); }
    catch (e) { console.warn('[order-writer] emit failed:', e.message); }
  }
}

const ALLOWED_TYPES = ['medication','lab','paraclinical','imaging','nursing','consult'];

function _validate(ctx, rec) {
  if (!rec || typeof rec !== 'object') throw _err(ctx, 'order:invalid_record');
  if (!rec.patientId) throw _err(ctx, 'order:patient_id_required');
  if (!rec.type) throw _err(ctx, 'order:type_required');
  if (!ALLOWED_TYPES.includes(rec.type)) console.warn('[order-writer] unknown type:', rec.type);
  return true;
}

function create(ctx, raw, opts) {
  _validate(ctx, raw);
  raw.id = raw.id || _uid(ctx, 'ord');
  raw.status = raw.status || 'pending';
  raw.orderedAt = raw.orderedAt || _now(ctx);
  raw.orderedBy = raw.orderedBy || (ctx && ctx.actor && ctx.actor.id);
  _store(ctx).put('orders', raw);
  _emit(ctx, (opts && opts.event) || 'kardex.order.created', { record: raw, actor: ctx.actor });
  return raw;
}

function save(ctx, rec, opts) {
  _validate(ctx, rec);
  if (!rec.id) throw _err(ctx, 'order:save_needs_id');
  _store(ctx).put('orders', rec);
  if (opts && opts.event) _emit(ctx, opts.event, { record: rec, actor: ctx.actor });
  return rec;
}

function transition(ctx, id, action, opts) {
  const order = _store(ctx).get('orders', id);
  if (!order) throw _err(ctx, 'order:not_found:' + id);
  const extras = (opts && opts.extras) || {};
  const r = _sm().transition('order', order, action, ctx.actor || {}, extras);
  if (!r.ok) {
    const e = _err(ctx, 'order:transition_rejected:' + (r.reason || 'unknown'));
    e.code = r.reason || 'transition_rejected';
    throw e;
  }
  if (opts && opts.fields) Object.assign(order, opts.fields);
  _store(ctx).put('orders', order);
  if (opts && typeof opts.after === 'function') {
    try { opts.after(order, ctx); } catch (e) { console.warn('[order-writer] after-hook:', e.message); }
  }
  _emit(ctx, (opts && opts.event) || ('kardex.order.' + action), { record: order, actor: ctx.actor });
  return order;
}

function _rawPut(ctx, rec) { _store(ctx).put('orders', rec); return rec; }

module.exports = { create, save, transition, _rawPut, ALLOWED_TYPES };
