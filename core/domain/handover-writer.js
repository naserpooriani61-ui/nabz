'use strict';
// core/domain/handover-writer.js — unified write path for 'handovers'

let _modStore;

function _store(ctx) {
  if (ctx && ctx.store && typeof ctx.store.put === 'function') return ctx.store;
  if (!_modStore) { try { _modStore = require('../store'); } catch (_) {} }
  if (!_modStore) throw new Error('handover-writer: no store');
  return _modStore;
}
function _uid(ctx, prefix) {
  if (ctx && typeof ctx.uid === 'function') return ctx.uid(prefix);
  const s = _store(ctx);
  if (typeof s.uid === 'function') return s.uid(prefix);
  throw new Error('handover-writer: no uid');
}
function _validate(ctx, rec) {
  if (!rec || typeof rec !== 'object') throw new Error('handover:invalid_record');
  if (!rec.wardCode) throw new Error('handover:ward_required');
  if (!rec.shiftType) throw new Error('handover:shift_required');
  return true;
}

function create(ctx, raw, opts) {
  _validate(ctx, raw);
  raw.id = raw.id || _uid(ctx, 'hnd');
  raw.status = raw.status || 'draft';
  _store(ctx).put('handovers', raw);
  return raw;
}

function put(ctx, rec, opts) {
  if (!rec || !rec.id) throw new Error('handover:put_needs_id');
  _store(ctx).put('handovers', rec);
  return rec;
}

module.exports = { create, put };
