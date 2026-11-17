'use strict';
const store = require('../core/store');
const bus = require('../core/events');
const audit = require('../core/audit');
const cfg = require('../core/security-config');

function getStatus(ctx) {
  const users = store.readAll('users');
  return {
    forcePasswordChangeOnLogin: cfg.isForcePasswordChangeActive(),
    usersPendingChange: users.filter(u => u.mustChangePassword).length,
    totalUsers: users.length,
    config: cfg.read()
  };
}
function setConfig(ctx) {
  const b = ctx.body || {};
  if (typeof b.forcePasswordChangeOnLogin !== 'boolean') throw ctx.E.badRequest('boolean_required');
  const before = cfg.read();
  const after = cfg.write({ forcePasswordChangeOnLogin: b.forcePasswordChangeOnLogin }, ctx.actor);
  try { audit.write('security_config', 'update', 'force_password_change', ctx.actor, { before, after }); } catch (_) {}
  bus.emit('security_config.updated', { before, after, actor: ctx.actor });
  return { ok: true, config: after };
}
function disableForAll(ctx) {
  const users = store.readAll('users');
  let cleared = 0;
  for (const u of users) {
    if (u.mustChangePassword) {
      u.mustChangePassword = false;
      u.passwordChangedAt = u.passwordChangedAt || new Date().toISOString();
      store.put('users', u);
      cleared++;
    }
  }
  try { audit.write('security_config', 'bulk_clear', 'all', ctx.actor, { cleared }); } catch (_) {}
  bus.emit('security_config.bulk_clear', { cleared, actor: ctx.actor });
  return { cleared };
}
function enableForAll(ctx) {
  const users = store.readAll('users');
  let enabled = 0;
  for (const u of users) {
    if (!u.mustChangePassword && u.active !== false) {
      u.mustChangePassword = true;
      store.put('users', u);
      enabled++;
    }
  }
  try { audit.write('security_config', 'bulk_set', 'all', ctx.actor, { enabled }); } catch (_) {}
  bus.emit('security_config.bulk_set', { enabled, actor: ctx.actor });
  return { enabled };
}
module.exports = {
  handlers: { getStatus, setConfig, disableForAll, enableForAll },
  routes: [
    { method: 'GET',  path: '/api/admin/security/config',            handler: 'getStatus',     perm: 'admin.users.manage' },
    { method: 'POST', path: '/api/admin/security/config',            handler: 'setConfig',     perm: 'admin.users.manage' },
    { method: 'POST', path: '/api/admin/security/clear-all-pending', handler: 'disableForAll', perm: 'admin.users.manage' },
    { method: 'POST', path: '/api/admin/security/set-all-pending',   handler: 'enableForAll',  perm: 'admin.users.manage' }
  ],
  panels: [
    { id: 'config', title: 'مدیریت رمز عبور', icon: '🔐',
      perm: 'admin.users.manage', kind: 'security_config', api: '/api/admin/security/config' }
  ]
};
