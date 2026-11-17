
'use strict';
const perms = require('./permissions'), bus = require('./events');

// ═══════════════════════════════════════════════════════════
//  Unified State Machine Catalog
//  v2: + hold/unhold for orders, + cancelled from active, + execute paths
// ═══════════════════════════════════════════════════════════
const M = {
  order: {
    initial: 'pending', emit: 'order',
    transitions: [
      // Lifecycle
      { from:'pending',  action:'verify',   to:'verified',  perm:'kardex.order.verify' },
      { from:'verified', action:'activate', to:'active',    perm:'kardex.order.verify' },
      { from:'verified', action:'execute',  to:'completed', perm:'kardex.order.execute' },
      { from:'active',   action:'execute',  to:'completed', perm:'kardex.order.execute' },
      { from:'active',   action:'complete', to:'completed', perm:'kardex.order.execute' },
      // Hold / Unhold (clinical decision)
      { from:'active',   action:'hold',     to:'held',      perm:'kardex.order.hold' },
      { from:'held',     action:'unhold',   to:'active',    perm:'kardex.order.hold' },
      { from:'held',     action:'cancel',   to:'cancelled', perm:'kardex.order.hold' },
      // Cancel (before execution)
      { from:'pending',  action:'cancel',   to:'cancelled', perm:'kardex.order.cancel' },
      { from:'verified', action:'cancel',   to:'cancelled', perm:'kardex.order.cancel' },
      { from:'active',   action:'cancel',   to:'cancelled', perm:'kardex.order.cancel' }
    ]
  },
  mar: {
    initial: 'scheduled', emit: 'mar',
    transitions: [
      { from:'scheduled', action:'administer', to:'given', perm:'kardex.mar.administer',
        when:'!isHighAlert || witnessedBy', requires:['fiveRights'] },
      { from:'due',       action:'administer', to:'given', perm:'kardex.mar.administer',
        when:'!isHighAlert || witnessedBy', requires:['fiveRights'] },
      { from:'scheduled', action:'refuse', to:'refused', perm:'kardex.mar.administer' },
      { from:'due',       action:'refuse', to:'refused', perm:'kardex.mar.administer' },
      { from:'scheduled', action:'miss',   to:'missed',  perm:'kardex.mar.administer' },
      // Hold (physician decision — e.g., NPO for procedure)
      { from:'scheduled', action:'hold',   to:'held',    perm:'kardex.order.hold' },
      { from:'due',       action:'hold',   to:'held',    perm:'kardex.order.hold' },
      { from:'held',      action:'resume', to:'scheduled', perm:'kardex.order.hold' }
    ]
  },
  consult: {
    initial: 'requested', emit: 'consult',
    transitions: [
      { from:'requested', action:'respond', to:'responded', perm:'consult.respond', independent:true },
      { from:'responded', action:'approve', to:'approved',  perm:'consult.approve', independent:true },
      { from:'requested', action:'cancel',  to:'cancelled', perm:'consult.request' },
      { from:'responded', action:'cancel',  to:'cancelled', perm:'consult.request' },
      { from:'requested', action:'escalate', to:'escalated', perm:'consult.request' },
      { from:'escalated', action:'respond', to:'responded', perm:'consult.respond', independent:true },
      { from:'escalated', action:'cancel',  to:'cancelled', perm:'consult.request' }
    ]
  },
  ed_visit: {
    initial: 'waiting_triage', emit: 'ed_visit',
    transitions: [
      { from:'waiting_triage', action:'triage', to:'waiting_doctor', perm:'ed.triage' },
      { from:'waiting_triage', action:'leave_unseen', to:'lwbs', perm:'ed.register' },
      { from:'waiting_doctor', action:'leave_unseen', to:'lwbs', perm:'ed.register' },
      { from:'waiting_bed', action:'leave_unseen', to:'lwbs', perm:'ed.register' },
      { from:'waiting_doctor', action:'wait_bed', to:'waiting_bed', perm:'ed.triage' },
      { from:'waiting_bed', action:'bed_ready', to:'waiting_doctor', perm:'ed.triage' },
      { from:'waiting_doctor', action:'see', to:'in_treatment', perm:'ed.treat' },
      { from:'waiting_bed', action:'see', to:'in_treatment', perm:'ed.treat' },
      { from:'in_treatment', action:'observe', to:'observation', perm:'ed.treat' },
      { from:'observation', action:'resume', to:'in_treatment', perm:'ed.treat' },
      { from:'in_treatment', action:'disposition_admit', to:'boarding', perm:'ed.disposition', requires:['destination'] },
      { from:'in_treatment', action:'disposition_discharge', to:'ready_discharge', perm:'ed.disposition' },
      { from:'in_treatment', action:'disposition_transfer', to:'transferring', perm:'ed.disposition', requires:['destination'] },
      { from:'observation', action:'disposition_admit', to:'boarding', perm:'ed.disposition', requires:['destination'] },
      { from:'observation', action:'disposition_discharge', to:'ready_discharge', perm:'ed.disposition' },
      { from:'observation', action:'disposition_transfer', to:'transferring', perm:'ed.disposition', requires:['destination'] },
      { from:'boarding', action:'resume', to:'in_treatment', perm:'ed.treat' },
      { from:'boarding', action:'disposition_discharge', to:'ready_discharge', perm:'ed.disposition' },
      { from:'boarding', action:'disposition_transfer', to:'transferring', perm:'ed.disposition', requires:['destination'] },
      { from:'ready_discharge', action:'resume', to:'in_treatment', perm:'ed.treat' },
      { from:'ready_discharge', action:'disposition_admit', to:'boarding', perm:'ed.disposition', requires:['destination'] },
      { from:'ready_discharge', action:'disposition_transfer', to:'transferring', perm:'ed.disposition', requires:['destination'] },
      { from:'transferring', action:'resume', to:'in_treatment', perm:'ed.treat' },
      { from:'transferring', action:'disposition_admit', to:'boarding', perm:'ed.disposition', requires:['destination'] },
      { from:'transferring', action:'disposition_discharge', to:'ready_discharge', perm:'ed.disposition' },
      { from:'boarding', action:'depart_admitted', to:'admitted', perm:'ed.depart' },
      { from:'ready_discharge', action:'depart_discharged', to:'discharged', perm:'ed.depart' },
      { from:'transferring', action:'depart_transferred', to:'transferred', perm:'ed.depart' },
      { from:'in_treatment', action:'leave_ama', to:'lama', perm:'ed.depart', requires:['reason'] },
      { from:'in_treatment', action:'abscond', to:'absconded', perm:'ed.depart', requires:['reason'] },
      { from:'observation', action:'leave_ama', to:'lama', perm:'ed.depart', requires:['reason'] },
      { from:'observation', action:'abscond', to:'absconded', perm:'ed.depart', requires:['reason'] },
      { from:'boarding', action:'leave_ama', to:'lama', perm:'ed.depart', requires:['reason'] },
      { from:'boarding', action:'abscond', to:'absconded', perm:'ed.depart', requires:['reason'] },
      { from:'ready_discharge', action:'leave_ama', to:'lama', perm:'ed.depart', requires:['reason'] },
      { from:'ready_discharge', action:'abscond', to:'absconded', perm:'ed.depart', requires:['reason'] },
      { from:'transferring', action:'leave_ama', to:'lama', perm:'ed.depart', requires:['reason'] },
      { from:'transferring', action:'abscond', to:'absconded', perm:'ed.depart', requires:['reason'] },
      { from:'waiting_triage', action:'declare_death', to:'deceased', perm:'ed.pronounce', requires:['note'] },
      { from:'waiting_doctor', action:'declare_death', to:'deceased', perm:'ed.pronounce', requires:['note'] },
      { from:'waiting_bed', action:'declare_death', to:'deceased', perm:'ed.pronounce', requires:['note'] },
      { from:'in_treatment', action:'declare_death', to:'deceased', perm:'ed.pronounce', requires:['note'] },
      { from:'observation', action:'declare_death', to:'deceased', perm:'ed.pronounce', requires:['note'] },
      { from:'boarding', action:'declare_death', to:'deceased', perm:'ed.pronounce', requires:['note'] },
      { from:'ready_discharge', action:'declare_death', to:'deceased', perm:'ed.pronounce', requires:['note'] },
      { from:'transferring', action:'declare_death', to:'deceased', perm:'ed.pronounce', requires:['note'] }
    ]
  },
  ed_code: {
    initial: 'active', emit: 'ed_code',
    transitions: [{ from:'active', action:'close', to:'closed', perm:'ed.code.activate' }]
  },
  transfer: {
    initial: 'requested', emit: 'transfer',
    transitions: [
      { from:'requested', action:'approve',     to:'approved',      perm:'transfer.approve', exceptRequester:true },
      { from:'approved',  action:'assign_bed',  to:'bed_assigned',  perm:'transfer.assign_bed' },
      { from:'bed_assigned', action:'handover', to:'handover_done', perm:'transfer.handover' },
      { from:'handover_done', action:'complete', to:'completed',    perm:'transfer.complete' },
      { from:'requested', action:'cancel', to:'cancelled', perm:'transfer.request' },
      { from:'approved',  action:'cancel', to:'cancelled', perm:'transfer.approve' }
    ]
  }
};

// ═══════════════════════════════════════════════════════════
//  Transition validation
// ═══════════════════════════════════════════════════════════
function canTransition(name, entity, action, actor, extras) {
  const m = M[name];
  if (!m) return { ok: false, reason: 'unknown_machine' };
  const from = entity[m.statusField || 'status'] || m.initial;
  const matches = (m.transitions || []).filter(t => t.from === from && t.action === action);
  if (!matches.length) return { ok: false, reason: `invalid: ${from}→${action}` };
  const allowed = matches.find(t => actor.role === 'admin' || !t.perm || perms.can(actor.role, t.perm));
  if (!allowed) return { ok: false, reason: `forbidden for role ${actor.role}` };

  if (allowed.exceptRequester && entity.requestedBy === actor.id && actor.role !== 'admin') {
    return { ok: false, reason: 'cannot_approve_own_request' };
  }
  if (allowed.independent) {
    const authors = ['createdBy','orderedBy','respondedBy','summaryBy','requestedBy'];
    for (const f of authors) {
      if (entity[f] && entity[f] === actor.id && actor.role !== 'admin') {
        return { ok: false, reason: 'independence_violation: author=' + f };
      }
    }
  }
  if (allowed.when && extras) {
    try {
      const fn = new Function('e','x','return (' + allowed.when.replace(/(\w+)/g, (m) => m in extras ? `x.${m}` : `e.${m}`) + ')');
      if (!fn(entity, extras)) return { ok: false, reason: 'condition_failed' };
    } catch (_) { return { ok: false, reason: 'condition_error' }; }
  }
  if (allowed.requires) {
    for (const r of allowed.requires) {
      if (!extras || !extras[r]) return { ok: false, reason: 'missing:' + r };
    }
  }
  return { ok: true, to: allowed.to, action, emit: m.emit };
}

function transition(name, entity, action, actor, extras) {
  const chk = canTransition(name, entity, action, actor, extras);
  if (!chk.ok) return chk;
  const m = M[name], from = entity[m.statusField || 'status'] || m.initial;
  entity[m.statusField || 'status'] = chk.to;
  entity._trans = entity._trans || [];
  if (entity._trans.length > 50) entity._trans = entity._trans.slice(-50);
  entity._trans.push({ from, to: chk.to, action, at: new Date().toISOString(), by: actor.id });
  if (m.emit) bus.emit(m.emit + '.' + chk.to, { entity, record: entity, from, to: chk.to, action, actor });
  return chk;
}

function actions(name, entity, actor) {
  const m = M[name];
  if (!m) return [];
  const from = entity[m.statusField || 'status'] || m.initial;
  const seen = new Set();
  return (m.transitions || []).filter(t => t.from === from).map(t => {
    if (seen.has(t.action)) return null;
    seen.add(t.action);
    const chk = canTransition(name, entity, t.action, actor, {});
    return { action: t.action, to: t.to, allowed: chk.ok, reason: chk.reason || null };
  }).filter(Boolean);
}

// ── NABZ v3.1: parity with nursing_workspace.js lifecycle ──
// nursing_workspace.js sets o.status='discontinued' directly; SM didn't know this state.
// This adds it to the catalog without changing any existing transition.
M.order.transitions.push(
  { from:'verified', action:'hold',   to:'held',     perm:'kardex.order.hold' },
  { from:'held',     action:'resume', to:'verified', perm:'kardex.order.verify' }
);

M.order.transitions.push(
  { from:'pending',      action:'discontinue', to:'discontinued', perm:'kardex.order.cancel' },
  { from:'verified',     action:'discontinue', to:'discontinued', perm:'kardex.order.cancel' },
  { from:'active',       action:'discontinue', to:'discontinued', perm:'kardex.order.hold' },
  { from:'held',         action:'discontinue', to:'discontinued', perm:'kardex.order.hold' },
  { from:'discontinued', action:'resume',      to:'verified',     perm:'kardex.order.hold' }
);

M.mar.transitions.push(
  { from:'due',       action:'miss',   to:'missed',    perm:'kardex.mar.administer' },
  { from:'scheduled', action:'cancel', to:'cancelled', perm:'kardex.mar.administer' },
  { from:'due',       action:'cancel', to:'cancelled', perm:'kardex.mar.administer' },
  { from:'held',      action:'cancel', to:'cancelled', perm:'kardex.mar.administer' }
);

M.mar.transitions.push(
  { from:'scheduled', action:'administer_partial', to:'given_partial', perm:'kardex.mar.administer' },
  { from:'due',       action:'administer_partial', to:'given_partial', perm:'kardex.mar.administer' }
);

module.exports = { M, canTransition, transition, actions, list: () => Object.keys(M) };
