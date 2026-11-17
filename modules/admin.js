const { h, sd } = require('../core/mod-helpers');
const perms = require('../core/permissions');
const bc = require('bcryptjs');

const listUsers = (ctx) => {
  const users = h(ctx, 'users').map(u => ({
    id: u.id, username: u.username, fullName: u.fullName,
    role: u.role, ward: u.ward, active: u.active,
    lastLoginAt: u.lastLoginAt, createdAt: u.createdAt
  }));
  return { items: users, total: users.length };
};
const createUser = (ctx) => {
  const b = ctx.body;
  if (!b.username || !b.password || !b.role) throw ctx.E.badRequest('missing');
  if (!perms.R[b.role]) throw ctx.E.badRequest('invalid_role');
  if (h(ctx, 'users').some(u => u.username === b.username)) throw ctx.E.conflict('username_taken');
  const rec = { id: 'usr_' + b.username.toLowerCase(),
    username: b.username, fullName: b.fullName || b.username,
    role: b.role, ward: b.ward || null, active: true,
    passwordHash: bc.hashSync(b.password, 8), createdAt: ctx.now() };
  ctx.store.put('users', rec);
  return { id: rec.id, username: rec.username, role: rec.role };
};
const updateUser = (ctx) => {
  const u = ctx.store.get('users', ctx.params.id);
  if (!u) throw ctx.E.notFound('not_found');
  const b = ctx.body;
  if (b.role && !perms.R[b.role]) throw ctx.E.badRequest('invalid_role');
  ['fullName','role','ward','active'].forEach(k => { if (b[k] !== undefined) u[k] = b[k]; });
  if (b.password) u.passwordHash = bc.hashSync(b.password, 8);
  ctx.store.put('users', u);
  return { id: u.id, role: u.role, active: u.active };
};

const listRoles = (ctx) => {
  const items = Object.entries(perms.R).map(([code, r]) => ({ code, level: r.l, crossWard: !!r.cw }));
  return { items, total: items.length };
};
const listPerms = (ctx) => {
  const items = Object.keys(perms.P).map(p => ({ perm: p, roles: perms.P[p].split(',') }));
  return { items, total: items.length };
};
const setPerm = (ctx) => {
  const b = ctx.body;
  if (!b.perm || !Array.isArray(b.roles)) throw ctx.E.badRequest('missing');
  for (const r of b.roles) if (!perms.R[r]) throw ctx.E.badRequest('unknown_role:' + r);
  perms.P[b.perm] = b.roles.join(',');
  ctx.audit.write('admin', 'perm.override', b.perm, ctx.actor, { roles: b.roles });
  return { perm: b.perm, roles: b.roles };
};
const auditVerify = (ctx) => require('../core/audit').verify();
const auditRecent = (ctx) => ({ items: require('../core/audit').recent(100) });

module.exports = {
  handlers: { listUsers, createUser, updateUser, listRoles, listPerms, setPerm, auditVerify, auditRecent },
  routes: [

    {method:'GET', path:'/api/admin/users', handler:'listUsers', perm:'admin.users.manage'},
    {method:'POST', path:'/api/admin/users', handler:'createUser', perm:'admin.users.manage'},
    {method:'GET', path:'/api/admin/roles', handler:'listRoles', perm:'admin.users.manage'},
    {method:'GET', path:'/api/admin/perms', handler:'listPerms', perm:'admin.permissions.manage'},
    {method:'POST', path:'/api/admin/perms', handler:'setPerm', perm:'admin.permissions.manage'},
    {method:'GET', path:'/api/admin/audit/verify', handler:'auditVerify', perm:'admin.audit.view'},
    {method:'GET', path:'/api/admin/audit/recent', handler:'auditRecent', perm:'admin.audit.view'},
    {method:'PUT', path:'/api/admin/users/:id', handler:'updateUser', perm:'admin.users.manage'},
  
  ],
  panels: [
    {id:'users', title:'کاربران', icon:'👥', perm:'admin.users.manage', kind:'list',
      api:'/api/admin/users', fields:['username','fullName','role','ward','active'],
      form:{api:'/api/admin/users', method:'POST', fields:[
        {name:'username', label:'نام کاربری', required:true},
        {name:'password', label:'رمز', required:true},
        {name:'fullName', label:'نام کامل'},
        {name:'role', label:'نقش (admin/nurse/physician/...)', required:true},
        {name:'ward', label:'بخش (اختیاری)'}
      ]}},
    {id:'roles', title:'نقش‌ها', icon:'🎭', perm:'admin.users.manage', kind:'list',
      api:'/api/admin/roles', fields:['code','level','crossWard']},
    {id:'perms', title:'مجوزها', icon:'🔐', perm:'admin.permissions.manage', kind:'list',
      api:'/api/admin/perms', fields:['perm','roles']},
    {id:'audit_verify', title:'صحت Audit', icon:'✓', perm:'admin.audit.view', kind:'stats',
      api:'/api/admin/audit/verify'},
    {id:'audit_recent', title:'Audit اخیر', icon:'📋', perm:'admin.audit.view', kind:'list',
      api:'/api/admin/audit/recent', fields:['module','action','entityId','at']}
  ]
};
