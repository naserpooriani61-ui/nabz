'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Permission Admin (persist + custom roles)
// ═══════════════════════════════════════════════════════════
const { h } = require('../core/mod-helpers');
const perms = require('../core/permissions');

// Load overrides on module load
(function loadOverrides() {
  try {
    const overrides = h({ store: require('../core/store') }, 'perm_overrides');
    for (const o of overrides) {
      if (o.perm && Array.isArray(o.roles)) perms.P[o.perm] = o.roles.join(',');
    }
    const custom = h({ store: require('../core/store') }, 'custom_roles');
    for (const r of custom) {
      perms.ROLES[r.code] = { level: r.level || 5, crossWard: !!r.crossWard };
      if (perms.R) perms.R[r.code] = perms.ROLES[r.code];
    }
    if (overrides.length || custom.length) {
      console.log('[perm-admin] loaded ' + overrides.length + ' overrides, ' + custom.length + ' custom roles');
    }
  } catch (e) {
    console.warn('[perm-admin] load:', e.message);
  }
})();

function listAllPermissions(ctx) {
  const P = perms.P;
  const perms_ = Object.keys(P).map(perm => ({
    perm,
    roles: String(P[perm] || '').split(',').filter(Boolean),
    isOverride: h(ctx, 'perm_overrides').some(o => o.perm === perm)
  }));
  return { items: perms_, total: perms_.length };
}

function listAllRoles(ctx) {
  const ROLES = perms.ROLES;
  const custom = new Set(h(ctx, 'custom_roles').map(c => c.code));
  const items = Object.entries(ROLES).map(([code, r]) => ({
    code, level: r.level || r.l || 5,
    crossWard: !!(r.crossWard || r.cw),
    isCustom: custom.has(code),
    permissionCount: Object.keys(perms.P).filter(p =>
      String(perms.P[p] || '').split(',').includes(code)).length
  }));
  return { items, total: items.length };
}

function updatePermission(ctx) {
  const b = ctx.body;
  if (!b.perm) throw ctx.E.badRequest('perm_required');
  if (!Array.isArray(b.roles)) throw ctx.E.badRequest('roles_array_required');
  // Validate roles exist
  for (const r of b.roles) {
    if (!perms.ROLES[r]) throw ctx.E.badRequest('unknown_role:' + r);
  }
  // Update in memory
  perms.P[b.perm] = b.roles.join(',');
  // Persist
  const existing = h(ctx, 'perm_overrides').find(o => o.perm === b.perm);
  if (existing) {
    existing.roles = b.roles;
    existing.updatedAt = ctx.now();
    existing.updatedBy = ctx.actor.id;
    ctx.store.put('perm_overrides', existing);
  } else {
    ctx.store.put('perm_overrides', {
      id: ctx.uid('perm'),
      perm: b.perm,
      roles: b.roles,
      updatedAt: ctx.now(),
      updatedBy: ctx.actor.id,
      updatedByName: ctx.actor.fullName || ctx.actor.username
    });
  }
  ctx.store.put('audit_chain', {
    id: ctx.uid('aud'), module: 'permission_admin', action: 'perm.update',
    entityId: b.perm, actor: { id: ctx.actor.id, role: ctx.actor.role, name: ctx.actor.fullName || ctx.actor.username },
    meta: { roles: b.roles }, at: ctx.now(),
    prevHash: 'genesis', hash: String(Date.now())
  });
  return { perm: b.perm, roles: b.roles, persisted: true };
}

function resetPermission(ctx) {
  const perm = ctx.params.perm;
  for (const o of h(ctx, 'perm_overrides').filter(o => o.perm === perm)) {
    ctx.store.remove('perm_overrides', o.id);
  }
  // Reload defaults (can't easily revert - would need original matrix)
  // Best effort: reset to empty
  return { perm, reset: true, message: 'نیاز به restart برای بازیابی defaults' };
}

function createCustomRole(ctx) {
  const b = ctx.body;
  if (!b.code || !b.label) throw ctx.E.badRequest('code_and_label_required');
  if (perms.ROLES[b.code]) throw ctx.E.conflict('role_exists');
  const rec = {
    id: ctx.uid('role'),
    code: b.code,
    label: b.label,
    level: Number(b.level) || 5,
    crossWard: !!b.crossWard,
    description: b.description || '',
    createdBy: ctx.actor.id,
    createdAt: ctx.now()
  };
  ctx.store.put('custom_roles', rec);
  perms.ROLES[b.code] = { level: rec.level, crossWard: rec.crossWard };
  if (perms.R) perms.R[b.code] = perms.ROLES[b.code];
  return rec;
}

function deleteCustomRole(ctx) {
  const code = ctx.params.code;
  const rec = h(ctx, 'custom_roles').find(c => c.code === code);
  if (!rec) throw ctx.E.notFound('role_not_found');
  // Remove from all permissions
  for (const perm of Object.keys(perms.P)) {
    const roles = String(perms.P[perm] || '').split(',').filter(r => r !== code);
    perms.P[perm] = roles.join(',');
    const existing = h(ctx, 'perm_overrides').find(o => o.perm === perm);
    if (existing) {
      existing.roles = roles;
      ctx.store.put('perm_overrides', existing);
    }
  }
  delete perms.ROLES[code];
  if (perms.R) delete perms.R[code];
  ctx.store.remove('custom_roles', rec.id);
  return { deleted: true, code };
}

function listUsersWithRoles(ctx) {
  const users = h(ctx, 'users').map(u => ({
    id: u.id, username: u.username, fullName: u.fullName,
    role: u.role, ward: u.ward, active: u.active,
    lastLoginAt: u.lastLoginAt
  }));
  return { items: users, total: users.length };
}

function updateUserRole(ctx) {
  const u = ctx.store.get('users', ctx.params.id);
  if (!u) throw ctx.E.notFound('user_not_found');
  const b = ctx.body;
  if (b.role) {
    if (!perms.ROLES[b.role]) throw ctx.E.badRequest('unknown_role');
    u.role = b.role;
  }
  if (b.ward !== undefined) u.ward = b.ward;
  if (b.active !== undefined) u.active = !!b.active;
  if (b.fullName) u.fullName = b.fullName;
  u.updatedAt = ctx.now();
  ctx.store.put('users', u);
  return u;
}

function permissionMatrix(ctx) {
  // Build a matrix: roles × permissions (bool)
  const roles = Object.keys(perms.ROLES);
  const perms_ = Object.keys(perms.P);
  const matrix = {};
  for (const r of roles) {
    matrix[r] = {};
    for (const p of perms_) {
      matrix[r][p] = String(perms.P[p] || '').split(',').includes(r);
    }
  }
  return { roles, permissions: perms_, matrix };
}

module.exports = {
  handlers: {
    listAllPermissions, listAllRoles, updatePermission, resetPermission,
    createCustomRole, deleteCustomRole,
    listUsersWithRoles, updateUserRole, permissionMatrix
  },
  routes: [

    { method:'GET',  path:'/api/pa/perms', handler:'listAllPermissions', perm:'admin.permissions.manage' },
    { method:'GET',  path:'/api/pa/roles', handler:'listAllRoles', perm:'admin.permissions.manage' },
    { method:'POST', path:'/api/pa/perm', handler:'updatePermission', perm:'admin.permissions.manage' },
    { method:'POST', path:'/api/pa/role', handler:'createCustomRole', perm:'admin.permissions.manage' },
    { method:'GET',  path:'/api/pa/users', handler:'listUsersWithRoles', perm:'admin.users.manage' },
    { method:'GET',  path:'/api/pa/matrix', handler:'permissionMatrix', perm:'admin.permissions.manage' },
    { method:'DELETE', path:'/api/pa/perm/:perm', handler:'resetPermission', perm:'admin.permissions.manage' },
    { method:'DELETE', path:'/api/pa/role/:code', handler:'deleteCustomRole', perm:'admin.permissions.manage' },
    { method:'PUT',  path:'/api/pa/user/:id', handler:'updateUserRole', perm:'admin.users.manage' },
  
  ],
  panels: [
    { id:'config', title:'مدیریت دسترسی‌ها', icon:'🔐', perm:'admin.permissions.manage', kind:'pa_config', api:'/api/pa/perms' }
  ]
};
