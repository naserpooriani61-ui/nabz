'use strict';
const sse = require('../core/sse');

function openStream(ctx) {
  if (!ctx.res) {
    throw ctx.E.badRequest('stream_requires_sse');
  }
  const client = sse.addClient(ctx.res, {
    userId: ctx.actor.id,
    username: ctx.actor.username,
    role: ctx.actor.role,
    ward: ctx.actor.ward || null
  });
  if (!client) throw ctx.E.badRequest('stream_init_failed');
  // Response already sent — return undefined so server skips json()
  return undefined;
}

function stats(ctx) {
  return sse.stats();
}

function broadcastTest(ctx) {
  const b = ctx.body || {};
  sse.broadcast(b.event || 'test.ping', {
    message: b.message || 'test',
    from: ctx.actor.username,
    at: new Date().toISOString(),
    actor: { id: ctx.actor.id, role: ctx.actor.role }
  });
  return { sent: true, event: b.event || 'test.ping', clients: sse.stats().clients };
}

module.exports = {
  handlers: { openStream, stats, broadcastTest },
  routes: [
    { method: 'GET', path: '/api/stream', handler: 'openStream', perm: null },
    { method: 'GET', path: '/api/stream/stats', handler: 'stats', perm: 'admin.users.manage' },
    { method: 'POST', path: '/api/stream/broadcast', handler: 'broadcastTest', perm: 'admin.users.manage' }
  ],
  panels: [
    { id:'live', title:'اتصالات زنده', icon:'📡', perm:'admin.users.manage', kind:'stats', api:'/api/stream/stats' }
  ]
};
