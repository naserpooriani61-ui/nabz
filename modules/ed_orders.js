'use strict';
// modules/ed_orders.js — Order Hierarchy API
const OW = require('../core/domain/order-writer');

const handlers = {
  draft: (ctx) => {
    const b = ctx.body || {};
    if (!b.patientId) throw { code: 400, message: 'patient_id_required' };
    if (!b.item && !b.drugName) throw { code: 400, message: 'item_required' };
    return OW.createDraft(ctx, b);
  },
  submit: (ctx) => OW.submitForCosign(ctx, ctx.params.id),
  cosign: (ctx) => OW.cosign(ctx, ctx.params.id, ctx.body || {}),
  attendingCosign: (ctx) => OW.attendingCosign(ctx, ctx.params.id, ctx.body || {}),
  reject: (ctx) => {
    const b = ctx.body || {};
    if (!b.reason || String(b.reason).length < 5) {
      throw { code: 400, message: 'rejection_reason_min_5_chars' };
    }
    return OW.reject(ctx, ctx.params.id, b);
  },
  pendingCosign: (ctx) => OW.listPendingCosign(ctx),
  pendingAttending: (ctx) => OW.listPendingAttending(ctx),
  byVisit: (ctx) => OW.listByVisit(ctx, ctx.params.visitId),
  byId: (ctx) => {
    const s = (ctx.store || require('../store'));
    const r = s.get('orders', ctx.params.id);
    if (!r) throw { code: 404, message: 'order_not_found' };
    return r;
  }
};

module.exports = {
  handlers,
  routes: [
    { method: 'POST', path: '/api/ed/orders/draft',                handler: 'draft',           perm: 'ed.order.draft' },
    { method: 'POST', path: '/api/ed/orders/:id/submit',           handler: 'submit',          perm: 'ed.order.draft' },
    { method: 'POST', path: '/api/ed/orders/:id/cosign',           handler: 'cosign',          perm: 'ed.order.cosign' },
    { method: 'POST', path: '/api/ed/orders/:id/attending-cosign', handler: 'attendingCosign', perm: 'ed.order.cosign_attending' },
    { method: 'POST', path: '/api/ed/orders/:id/reject',           handler: 'reject',          perm: 'ed.order.reject' },
    { method: 'GET',  path: '/api/ed/orders/pending-cosign',       handler: 'pendingCosign',   perm: 'ed.order.cosign' },
    { method: 'GET',  path: '/api/ed/orders/pending-attending',    handler: 'pendingAttending', perm: 'ed.order.cosign_attending' },
    { method: 'GET',  path: '/api/ed/orders/by-visit/:visitId',    handler: 'byVisit',         perm: 'ed.view' },
    { method: 'GET',  path: '/api/ed/orders/:id',                  handler: 'byId',            perm: 'ed.view' }
  ]
};
