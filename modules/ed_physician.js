'use strict';
// modules/ed_physician.js — Physician workspace API
const S = require('../core/domain/ed-physician-service');

const handlers = {
  worklist: (ctx) => S.getWorklist(ctx),
  patientView: (ctx) => {
    const r = S.getPatientView(ctx, ctx.params.visitId);
    if (r.error) throw { code: 404, message: r.error };
    return r;
  },
  cartable: (ctx) => S.getCartable(ctx),
  stats: (ctx) => S.getStats(ctx)
};

module.exports = {
  handlers,
  routes: [
    { method: 'GET', path: '/api/ed/physician/worklist',           handler: 'worklist',    perm: 'ed.view' },
    { method: 'GET', path: '/api/ed/physician/patient/:visitId',   handler: 'patientView', perm: 'ed.view' },
    { method: 'GET', path: '/api/ed/physician/cartable',           handler: 'cartable',    perm: 'ed.view' },
    { method: 'GET', path: '/api/ed/physician/stats',              handler: 'stats',       perm: 'ed.view' }
  ]
};
