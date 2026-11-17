'use strict';
// core/domain/consult-writer.js — unified write path for 'consults'
let _modStore, _modBus, _modSM;
function _store(ctx) {
  if (ctx && ctx.store && typeof ctx.store.put === 'function') return ctx.store;
  if (!_modStore) { try { _modStore = require('../store'); } catch (_) {} }
  if (!_modStore) throw new Error('consult-writer: no store');
  return _modStore;
}
function _bus(ctx) {
  if (ctx && ctx.bus && typeof ctx.bus.emit === 'function') return ctx.bus;
  if (!_modBus) { try { _modBus = require('../events'); } catch (_) {} }
  return _modBus;
}
function _sm() {
  if (!_modSM) { try { _modSM = require('../state-machine'); } catch (_) {} }
  return _modSM;
}
function _uid(ctx, prefix) {
  if (ctx && typeof ctx.uid === 'function') return ctx.uid(prefix);
  const s = _store(ctx);
  if (typeof s.uid === 'function') return s.uid(prefix);
  throw new Error('consult-writer: no uid');
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
    try { b.emit(event, payload); } catch (e) { console.warn('[consult-writer] emit:', e.message); }
  }
}
function _validate(ctx, rec) {
  if (!rec || typeof rec !== 'object') throw _err(ctx, 'consult:invalid_record');
  if (!rec.patientId) throw _err(ctx, 'consult:patient_id_required');
  if (!rec.targetService) console.warn('[consult-writer] targetService missing:', rec.id);
  return true;
}

function create(ctx, raw, opts) {
  _validate(ctx, raw);
  raw.id = raw.id || _uid(ctx, 'cons');
  raw.status = raw.status || 'requested';
  raw.requestedAt = raw.requestedAt || _now(ctx);
  raw.requestedBy = raw.requestedBy || (ctx && ctx.actor && ctx.actor.id);
  if (!raw.responseDueAt) {
    const hours = raw.consultType === 'emergency' ? 0.5 : 2;
    raw.responseDueAt = new Date(Date.now() + hours * 3600000).toISOString();
  }
  _store(ctx).put('consults', raw);
  _emit(ctx, (opts && opts.event) || 'kardex.consult.requested', { record: raw, actor: ctx.actor });
  return raw;
}

function transition(ctx, id, action, opts) {
  const c = _store(ctx).get('consults', id);
  if (!c) throw _err(ctx, 'consult:not_found:' + id);
  const r = _sm().transition('consult', c, action, ctx.actor || {}, (opts && opts.extras) || {});
  if (!r.ok) {
    const e = _err(ctx, 'consult:transition_rejected:' + (r.reason || 'unknown'));
    e.code = r.reason || 'transition_rejected';
    throw e;
  }
  if (opts && opts.fields) Object.assign(c, opts.fields);
  _store(ctx).put('consults', c);
  if (opts && typeof opts.after === 'function') {
    try { opts.after(c, ctx); } catch (e) { console.warn('[consult-writer] after:', e.message); }
  }
  _emit(ctx, (opts && opts.event) || ('kardex.consult.' + action), { record: c, actor: ctx.actor });
  return c;
}

function save(ctx, rec, opts) {
  _validate(ctx, rec);
  if (!rec.id) throw _err(ctx, 'consult:save_needs_id');
  _store(ctx).put('consults', rec);
  if (opts && opts.event) _emit(ctx, opts.event, { record: rec, actor: ctx.actor });
  return rec;
}

module.exports = { create, transition, save };
