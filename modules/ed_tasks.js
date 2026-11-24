'use strict';
// modules/ed_tasks.js — Clinical Tasks HTTP API

const T = require('../core/domain/clinical-tasks');

const handlers = {
  myTasks: (ctx) => T.listMine(ctx),
  allTasks: (ctx) => {
    const q = ctx.query || {};
    let all = T.readAll(ctx);
    if (q.status) all = all.filter(t => t.status === q.status);
    if (q.priority) all = all.filter(t => t.priority === q.priority);
    if (q.overdue === '1') {
      const now = Date.now();
      all = all.filter(t => new Date(t.due_at).getTime() < now && t.status !== 'resolved' && t.status !== 'cancelled');
    }
    return all;
  },
  byVisit: (ctx) => T.listByVisit(ctx, ctx.params.visitId),
  byId: (ctx) => {
    const t = T.readOne(ctx, ctx.params.id);
    if (!t) throw { code: 404, message: 'task_not_found' };
    return t;
  },
  acknowledge: (ctx) => T.acknowledge(ctx, ctx.params.id),
  resolve:     (ctx) => T.resolve(ctx, ctx.params.id, ctx.body || {}),
  cancel:      (ctx) => T.cancel(ctx, ctx.params.id, ctx.body || {}),
  escalate:    (ctx) => T.escalate(ctx, ctx.params.id, (ctx.body || {}).reason),
  stats:       (ctx) => T.stats(ctx),
  createManual: (ctx) => {
    const b = ctx.body || {};
    if (!b.type) throw { code: 400, message: 'type_required' };
    return T.create(ctx, b);
  }
};

module.exports = {
  handlers,
  routes: [
    { method: 'GET',  path: '/api/ed/tasks/my',                handler: 'myTasks',      perm: 'ed.task.acknowledge' },
    { method: 'GET',  path: '/api/ed/tasks',                   handler: 'allTasks',     perm: 'ed.task.acknowledge' },
    { method: 'GET',  path: '/api/ed/tasks/stats',             handler: 'stats',        perm: 'ed.task.acknowledge' },
    { method: 'GET',  path: '/api/ed/tasks/by-visit/:visitId', handler: 'byVisit',      perm: 'ed.task.acknowledge' },
    { method: 'GET',  path: '/api/ed/tasks/:id',               handler: 'byId',         perm: 'ed.task.acknowledge' },
    { method: 'POST', path: '/api/ed/tasks/:id/acknowledge',   handler: 'acknowledge',  perm: 'ed.task.acknowledge' },
    { method: 'POST', path: '/api/ed/tasks/:id/resolve',       handler: 'resolve',      perm: 'ed.task.resolve' },
    { method: 'POST', path: '/api/ed/tasks/:id/cancel',        handler: 'cancel',       perm: 'ed.task.resolve' },
    { method: 'POST', path: '/api/ed/tasks/:id/escalate',      handler: 'escalate',     perm: 'ed.task.resolve' },
    { method: 'POST', path: '/api/ed/tasks',                   handler: 'createManual', perm: 'ed.task.resolve' }
  ],
  panels: [
    { id: 'ed_tasks', module: 'ed_tasks', title: 'کارتابل وظایف من', icon: '📋', perm: 'ed.task.acknowledge', kind: 'ed_tasks' }
  ]
};
