'use strict';
// core/domain/mar-writer.js — unified write path for 'mar'
//   administer(ctx, id, { fiveRights, witnessId, administeredAt, notes })
//   refuse(ctx, id, { reason })
//   miss(ctx, id, { reason })
//   hold(ctx, id, { reason })
//   resume(ctx, id, { reason })
//   userCancel(ctx, id, { reason })    ← SM-enforced, perm-checked
//   systemCancel(ctx, id, reason)       ← bypass SM, for cascades (e.g. order discontinued)
//   update(ctx, rec, { event })         ← non-transition updates (titrate, dose adjust)
//   saveAll(ctx, list, { event })       ← bulk save (generateMAR)
let _modStore, _modBus, _modSM;
function _store(ctx) {
  if (ctx && ctx.store && typeof ctx.store.put === 'function') return ctx.store;
  if (!_modStore) { try { _modStore = require('../store'); } catch (_) {} }
  if (!_modStore) throw new Error('mar-writer: no store');
  return _modStore;
}
function _bus(ctx) {
  if (ctx && ctx.bus && typeof ctx.bus.emit === 'function') return ctx.bus;
  if (!_modBus) { try { _modBus = require('../events'); } catch (_) {} }
  return _modBus;
}
function _sm() {
  if (!_modSM) { try { _modSM = require('../state-machine'); } catch (_) {} }
  if (!_modSM) throw new Error('mar-writer: no SM');
  return _modSM;
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
    try { b.emit(event, payload); } catch (e) { console.warn('[mar-writer] emit:', e.message); }
  }
}

const EVENTS = {
  administer: 'kardex.mar.given',
  refuse:     'kardex.mar.refused',
  miss:       'kardex.mar.missed',
  hold:       'kardex.mar.held',
  resume:     'kardex.mar.resumed',
  cancel:     'kardex.mar.cancelled'
};

function partial(ctx, id, opts) {
  const o = opts || {};
  if (o.givenDose == null) throw _err(ctx, 'mar:given_dose_required');
  if (!o.reason || o.reason.length < 5) throw _err(ctx, 'mar:reason_min_5_chars');
  const mar = _store(ctx).get('mar', id);
  if (!mar) throw _err(ctx, 'mar:not_found:' + id);
  const r = _sm().transition('mar', mar, 'administer_partial', ctx.actor || {}, {});
  if (!r.ok) {
    const e = _err(ctx, 'mar:transition_rejected:' + (r.reason || 'unknown'));
    e.code = r.reason || 'transition_rejected';
    throw e;
  }
  const now = _now(ctx);
  mar.administeredAt = now;
  mar.administeredBy = ctx.actor && ctx.actor.id;
  mar.administeredByName = ctx.actor && (ctx.actor.fullName || ctx.actor.username);
  mar.prescribedDose = mar.prescribedDose || mar.dose;
  mar.givenDose = String(o.givenDose).slice(0, 50);
  mar.partialReason = String(o.reason).slice(0, 500);
  mar.rightsMode = 'verified';
  if (o.fiveRights) mar.rightsDetail = o.fiveRights;
  mar._partial = true;
  _store(ctx).put('mar', mar);
  // match existing pattern (downstream subscribers listen to kardex.mar.given)
  _emit(ctx, 'kardex.mar.given', { record: mar, actor: ctx.actor, _partial: true });
  // new precise event for future subscribers
  _emit(ctx, 'kardex.mar.given_partial', { record: mar, actor: ctx.actor });
  return mar;
}

function _transition(ctx, id, action, opts) {
  const mar = _store(ctx).get('mar', id);
  if (!mar) throw _err(ctx, 'mar:not_found:' + id);
  const extras = (opts && opts.extras) || {};
  const r = _sm().transition('mar', mar, action, ctx.actor || {}, extras);
  if (!r.ok) {
    const e = _err(ctx, 'mar:transition_rejected:' + (r.reason || 'unknown'));
    e.code = r.reason || 'transition_rejected';
    throw e;
  }
  if (opts && opts.fields) Object.assign(mar, opts.fields);
  _store(ctx).put('mar', mar);
  if (opts && typeof opts.after === 'function') {
    try { opts.after(mar, ctx); } catch (e) { console.warn('[mar-writer] after:', e.message); }
  }
  _emit(ctx, (opts && opts.event) || EVENTS[action] || ('kardex.mar.' + action),
        { record: mar, actor: ctx.actor });
  return mar;
}

function administer(ctx, id, opts) {
  const o = opts || {};
  if (!o.fiveRights) throw _err(ctx, 'mar:five_rights_required');
  return _transition(ctx, id, 'administer', {
    extras: { fiveRights: o.fiveRights, witnessedBy: o.witnessId },
    fields: {
      administeredAt: o.administeredAt || _now(ctx),
      administeredBy: ctx.actor && ctx.actor.id,
      administeredByName: ctx.actor && (ctx.actor.fullName || ctx.actor.username),
      witnessId: o.witnessId || null,
      witnessName: o.witnessName || null,
      overrideReason: o.overrideReason || null,
      administeredDose: o.administeredDose || null,
      rightsMode: o.rightsMode || (o.fiveRights ? 'verified' : 'attested'),
      notes: o.notes || null
    },
    event: 'kardex.mar.given',
    after: o.after
  });
}

function refuse(ctx, id, opts) {
  const o = opts || {};
  return _transition(ctx, id, 'refuse', {
    fields: {
      refusedAt: _now(ctx), refusedBy: ctx.actor && ctx.actor.id,
      refusedReason: o.reason || '', patientRefusal: true
    },
    event: 'kardex.mar.refused'
  });
}

function miss(ctx, id, opts) {
  const o = opts || {};
  return _transition(ctx, id, 'miss', {
    fields: {
      missedAt: _now(ctx), missedBy: ctx.actor && ctx.actor.id,
      missedReason: o.reason || 'not_given'
    },
    event: 'kardex.mar.missed'
  });
}

function hold(ctx, id, opts) {
  const o = opts || {};
  return _transition(ctx, id, 'hold', {
    fields: {
      heldAt: _now(ctx), heldBy: ctx.actor && ctx.actor.id,
      holdReason: o.reason || ''
    },
    event: 'kardex.mar.held'
  });
}

function resume(ctx, id, opts) {
  const o = opts || {};
  return _transition(ctx, id, 'resume', {
    fields: {
      resumedAt: _now(ctx), resumedBy: ctx.actor && ctx.actor.id,
      resumeReason: o.reason || ''
    },
    event: 'kardex.mar.resumed'
  });
}

function userCancel(ctx, id, opts) {
  const o = opts || {};
  return _transition(ctx, id, 'cancel', {
    fields: {
      cancelledAt: _now(ctx), cancelledBy: ctx.actor && ctx.actor.id,
      cancelledReason: o.reason || 'user_cancel'
    },
    event: 'kardex.mar.cancelled'
  });
}

function systemMiss(ctx, id, reason) {
  const mar = _store(ctx).get('mar', id);
  if (!mar) return null;
  // Safety guard: don't override terminal states
  if (['missed', 'cancelled', 'given', 'given_partial', 'refused'].includes(mar.status)) return mar;
  const prev = mar.status;
  mar.status = 'missed';
  mar.missedAt = _now(ctx);
  mar.missedBy = 'system';
  mar.missedReason = reason || 'auto: >2h overdue';
  mar._trans = mar._trans || [];
  if (mar._trans.length > 50) mar._trans = mar._trans.slice(-50);
  mar._trans.push({ from: prev, to: 'missed', action: 'system_miss', at: _now(ctx), by: 'system' });
  _store(ctx).put('mar', mar);
  _emit(ctx, 'kardex.mar.missed', { record: mar, actor: null });
  return mar;
}

function systemCancel(ctx, id, reason) {
  const mar = _store(ctx).get('mar', id);
  if (!mar) return null;
  if (['cancelled', 'given', 'refused', 'missed'].includes(mar.status)) return mar;
  const prev = mar.status;
  mar.status = 'cancelled';
  mar.cancelledAt = _now(ctx);
  mar.cancelledReason = reason || 'system_cancel';
  mar._trans = mar._trans || [];
  if (mar._trans.length > 50) mar._trans = mar._trans.slice(-50);
  mar._trans.push({ from: prev, to: 'cancelled', action: 'system_cancel', at: _now(ctx), by: 'system' });
  _store(ctx).put('mar', mar);
  _emit(ctx, 'kardex.mar.cancelled', { record: mar, actor: ctx.actor || null });
  return mar;
}

function update(ctx, rec, opts) {
  if (!rec || !rec.id) throw _err(ctx, 'mar:update_needs_id');
  _store(ctx).put('mar', rec);
  if (opts && opts.event) _emit(ctx, opts.event, { record: rec, actor: ctx.actor });
  return rec;
}

function saveAll(ctx, list, opts) {
  const s = _store(ctx);
  for (const m of list) s.put('mar', m);
  if (opts && opts.event) for (const m of list) _emit(ctx, opts.event, { record: m, actor: ctx.actor });
  return list;
}

module.exports = {
  administer, partial, refuse, miss, hold, resume,
  userCancel, systemCancel, systemMiss, update, saveAll, EVENTS
};
