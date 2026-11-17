'use strict';
const stream = require('../core/domain/alert-stream');
const handlers = {
  poll: (ctx) => stream.poll(ctx.actor, ctx.query && ctx.query.since),
  stats: (ctx) => stream.stats()
};
module.exports = {
  handlers,
  routes: [
    { method: 'GET', path: '/api/alerts/poll',  handler: 'poll',  perm: 'alerts.view' },
    { method: 'GET', path: '/api/alerts/stream/stats', handler: 'stats', perm: 'alerts.view' }
  ]
};
console.log('[alerts_stream] loaded — long-polling real-time alerts');
