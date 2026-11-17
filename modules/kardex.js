'use strict';
// modules/kardex.js — Kardex API: aggregator + unified action dispatcher
const ks = require('../core/domain/kardex-service');

const handlers = {
  // GET /api/kardex/:patientId
  patientKardex: (ctx) => {
    const fn = ks.getPatientKardexV2 || ks.getPatientKardex;
    return fn(ctx, ctx.params.patientId);
  },

  shift: (ctx) => {
    const kxSh = require('../core/domain/kardex-shift');
    return kxSh.getShiftKardex(ctx, ctx.params.wardCode, ctx.query && ctx.query.shift);
  },

  handover: (ctx) => {
    const hr = require('../core/domain/handover-report');
    return hr.generate(ctx, ctx.params.patientId);
  },

  handoverOneLine: (ctx) => {
    const hr = require('../core/domain/handover-report');
    const r = hr.generate(ctx, ctx.params.patientId);
    return { line: hr.oneLine(r) };
  },

  // POST /api/kardex/:entity/:id/:action
  // entity: order | mar | consult
  // Maps to existing writers without exposing internal route-splits to UI
  action: (ctx) => {
    const entity = ctx.params.entity;
    const id = ctx.params.id;
    const action = ctx.params.action;
    const body = ctx.body || {};

    if (entity === 'order') {
      // Delegate to clinical.orderAction — preserves MAR generation + sign
      const clinical = require('./clinical');
      const orig = ctx.params;
      ctx.params = { id, action };
      try { return clinical.handlers.orderAction(ctx); }
      finally { ctx.params = orig; }
    }

    if (entity === 'mar') {
      const mw = require('../core/domain/mar-writer');
      if (action === 'administer') {
        const o = {
          fiveRights: body.fiveRights || { attested: true, at: ctx.now() },
          witnessId: body.witnessId,
          witnessName: body.witnessName,
          overrideReason: body.overrideReason,
          notes: body.notes,
          administeredDose: body.administeredDose
        };
        if (body._clientAt || body.administeredAt) {
          o.administeredAt = body._clientAt || body.administeredAt;
        }
        return mw.administer(ctx, id, o);
      }
      if (action === 'refuse')  return mw.refuse(ctx, id, { reason: body.reason });
      if (action === 'miss')    return mw.miss(ctx, id, { reason: body.reason });
      if (action === 'hold')    return mw.hold(ctx, id, { reason: body.reason });
      if (action === 'resume')  return mw.resume(ctx, id, { reason: body.reason });
      if (action === 'cancel')  return mw.userCancel(ctx, id, { reason: body.reason });
      if (action === 'partial') return mw.partial(ctx, id, { givenDose: body.givenDose, reason: body.reason, fiveRights: body.fiveRights });
      throw ctx.E.badRequest('unknown_mar_action:' + action);
    }

    if (entity === 'consult') {
      const cw = require('../core/domain/consult-writer');
      const fields = {};
      fields[action + 'By'] = ctx.actor.id;
      fields[action + 'At'] = ctx.now();
      if (action === 'respond') {
        fields.response = {
          answer: body.answer || '',
          recommendations: body.recommendations || [],
          followup: body.followup || ''
        };
      }
      return cw.transition(ctx, id, action, {
        fields,
        event: 'kardex.consult.' + action
      });
    }

    throw ctx.E.badRequest('unknown_entity:' + entity);
  }
};

module.exports = {
  handlers,
  routes: [
    { method: 'GET',  path: '/api/kardex/:patientId',            handler: 'patientKardex', perm: 'kardex.view' },
    { method: 'GET',  path: '/api/kardex/shift/:wardCode',        handler: 'shift',         perm: 'kardex.view' },
    { method: 'GET',  path: '/api/kardex/handover/:patientId',     handler: 'handover',      perm: 'kardex.view' },
    { method: 'GET',  path: '/api/kardex/handover/:patientId/oneline', handler: 'handoverOneLine', perm: 'kardex.view' },
    { method: 'POST', path: '/api/kardex/:entity/:id/:action',   handler: 'action',        perm: 'kardex.view' }
  ],
  panels: [
    { id: 'kardex-unified', title: 'کاردکس یکپارچه', icon: '📋', perm: 'kardex.view', kind: 'kardex', api: '/api/kardex' }
  ]
};
console.log('[kardex] loaded — unified Kardex service + action dispatcher');
