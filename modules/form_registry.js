'use strict';
// modules/form_registry.js — UDES form metadata API (read-only)
const S = require('../core/config/form-schemas');

const handlers = {
  list: (ctx) => ({ items: S.listSchemas(), total: S.listSchemas().length }),
  get: (ctx) => {
    const s = S.getSchema(ctx.params.id);
    if (!s) throw ctx.E.notFound('schema_not_found');
    return s;
  }
};

module.exports = {
  handlers: handlers,
  routes: [
    { method: 'GET', path: '/api/forms/list', handler: 'list', perm: 'patients.view' },
    { method: 'GET', path: '/api/forms/:id', handler: 'get',  perm: 'patients.view' }
  ],
  panels: []
};
