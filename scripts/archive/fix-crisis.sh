
# ═══════════════════════════════════════════════════════════════
#  Rewrite crisis.js completely — no regex
# ═══════════════════════════════════════════════════════════════

cat > modules/crisis.js << 'CRISIS_EOF'
const { h, sd, sg } = require('../core/mod-helpers');

const TYPES = [
  {code:'war',label:'جنگ',icon:'⚔️'},{code:'flood',label:'سیل',icon:'🌊'},
  {code:'earthquake',label:'زلزله',icon:'🏔️'},{code:'storm',label:'طوفان',icon:'🌪️'},
  {code:'fire',label:'آتش‌سوزی',icon:'🔥'},{code:'bio',label:'تهدید بیولوژیک',icon:'☣️'},
  {code:'terror',label:'تروریستی',icon:'💥'},{code:'pandemic',label:'پاندمی',icon:'🦠'}
];

const ROLES = [
  {code:'commander',label:'فرمانده بحران',icon:'🎖️',priority:1},
  {code:'ops',label:'افسر عملیات',icon:'📋',priority:2},
  {code:'planning',label:'افسر برنامه‌ریزی',icon:'📊',priority:2},
  {code:'logistics',label:'افسر لجستیک',icon:'🔧',priority:2},
  {code:'finance',label:'افسر مالی',icon:'💰',priority:3},
  {code:'comms',label:'افسر ارتباطات',icon:'📞',priority:2},
  {code:'triage',label:'افسر تریاژ',icon:'🚑',priority:1},
  {code:'pharmacy',label:'افسر دارویی',icon:'💊',priority:2},
  {code:'blood',label:'افسر خون',icon:'🩸',priority:2},
  {code:'evacuation',label:'افسر تخلیه',icon:'🚁',priority:2},
  {code:'infection',label:'افسر عفونت',icon:'🦠',priority:2},
  {code:'mental',label:'افسر سلامت روان',icon:'🧠',priority:3},
  {code:'family',label:'ارتباط با خانواده',icon:'👨‍👩‍👧',priority:3},
  {code:'media',label:'افسر رسانه',icon:'📰',priority:3},
  {code:'safety',label:'افسر ایمنی',icon:'🛡️',priority:2}
];

function listActive(ctx) {
  const items = h(ctx, 'crisis_sessions').filter(s => s.status === 'active');
  return { items, total: items.length };
}

function getActive(ctx) {
  const s = h(ctx, 'crisis_sessions').find(x => x.status === 'active');
  return s ? { active: true, session: s } : { active: false };
}

function history(ctx) {
  const items = h(ctx, 'crisis_sessions').filter(s => s.status === 'closed')
    .sort((a, b) => sd(b.activatedAt) - sd(a.activatedAt));
  return { items, total: items.length };
}

function stats(ctx) {
  const all = h(ctx, 'crisis_sessions');
  return {
    active: all.filter(s => s.status === 'active').length,
    history: all.filter(s => s.status === 'closed').length,
    types: TYPES, roles: ROLES
  };
}

function activate(ctx) {
  const b = ctx.body;
  if (!b.crisisType) throw ctx.E.badRequest('crisis_type_required');
  const t = TYPES.find(x => x.code === b.crisisType);
  if (!t) throw ctx.E.badRequest('invalid_type');
  if (b.confirm !== true) throw ctx.E.badRequest('double_confirm_required');
  if (h(ctx, 'crisis_sessions').some(x => x.status === 'active')) {
    throw ctx.E.conflict('already_active');
  }
  const s = {
    id: ctx.uid('crz'),
    crisisType: t.code, crisisLabel: t.label, icon: t.icon,
    phase: 'active',
    reason: b.reason || '', location: b.location || '',
    estimatedCasualties: Number(b.estimatedCasualties) || 0,
    activatedBy: ctx.actor.id, activatedByName: ctx.actor.username,
    activatedAt: ctx.now(), status: 'active', createdAt: ctx.now()
  };
  ctx.store.put('crisis_sessions', s);
  const pts = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  for (const p of pts) {
    ctx.store.put('crisis_evacuation', {
      id: ctx.uid('evac'), sessionId: s.id, patientId: p.id,
      patientName: p.firstName + ' ' + p.lastName,
      wardCode: p.wardCode, bedNumber: p.bedNumber,
      priority: (p.wardCode || '').indexOf('ICU') >= 0 ? 'critical' : 'high',
      status: 'pending', updatedAt: ctx.now()
    });
  }
  ctx.bus.emit('crisis.activated', { session: s, actor: ctx.actor });
  return s;
}

function deactivate(ctx) {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  if (s.status !== 'active') throw ctx.E.conflict('not_active');
  s.status = 'closed';
  s.phase = 'recovery';
  s.deactivatedAt = ctx.now();
  s.deactivatedBy = ctx.actor.id;
  ctx.store.put('crisis_sessions', s);
  ctx.bus.emit('crisis.deactivated', { session: s, actor: ctx.actor });
  return s;
}

function dashboard(ctx) {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const roles = h(ctx, 'crisis_roles').filter(r => r.sessionId === s.id);
  const tasks = h(ctx, 'crisis_tasks').filter(t => t.sessionId === s.id);
  const evac = h(ctx, 'crisis_evacuation').filter(e => e.sessionId === s.id);
  const beds = h(ctx, 'beds');
  const occ = beds.filter(b => b.status === 'occupied').length;
  return {
    session: s,
    roles: { total: ROLES.length, assigned: roles.filter(r => r.status === 'accepted').length },
    tasks: { total: tasks.length, completed: tasks.filter(t => t.status === 'completed').length },
    evacuation: { total: evac.length, moved: evac.filter(e => e.status === 'moved').length },
    beds: { occupied: occ, total: beds.length, available: beds.length - occ }
  };
}

function roleCards(ctx) {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const assigned = h(ctx, 'crisis_roles').filter(r => r.sessionId === s.id);
  const roles = ROLES.map(def => {
    const fills = assigned.filter(a => a.roleCode === def.code);
    const acc = fills.find(f => f.status === 'accepted');
    const pen = fills.find(f => f.status === 'pending');
    return Object.assign({}, def, {
      current: acc || pen || null,
      status: acc ? 'filled' : pen ? 'pending' : 'unfilled'
    });
  });
  return { session: s, roles };
}

function assignRole(ctx) {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const b = ctx.body;
  if (!b.roleCode || !b.staffId) throw ctx.E.badRequest('missing');
  const def = ROLES.find(r => r.code === b.roleCode);
  if (!def) throw ctx.E.badRequest('invalid_role');
  const staff = h(ctx, 'wf_staff').find(x => x.id === b.staffId) ||
                h(ctx, 'users').find(x => x.id === b.staffId);
  if (!staff) throw ctx.E.notFound('staff_not_found');
  const prior = h(ctx, 'crisis_roles').filter(r =>
    r.sessionId === s.id && r.roleCode === b.roleCode && r.status !== 'accepted'
  );
  for (const e of prior) ctx.store.remove('crisis_roles', e.id);
  const rec = {
    id: ctx.uid('crole'), sessionId: s.id,
    roleCode: def.code, roleLabel: def.label, roleIcon: def.icon,
    staffId: staff.id, staffName: staff.fullName || staff.username,
    status: 'pending', assignedBy: ctx.actor.id, assignedAt: ctx.now()
  };
  ctx.store.put('crisis_roles', rec);
  ctx.bus.emit('crisis.role.assigned', { record: rec, actor: ctx.actor });
  return rec;
}

function acceptRole(ctx) {
  const r = ctx.store.get('crisis_roles', ctx.params.rid);
  if (!r) throw ctx.E.notFound('not_found');
  r.status = 'accepted'; r.acceptedAt = ctx.now();
  ctx.store.put('crisis_roles', r);
  return r;
}

function declineRole(ctx) {
  const r = ctx.store.get('crisis_roles', ctx.params.rid);
  if (!r) throw ctx.E.notFound('not_found');
  r.status = 'declined'; r.declinedAt = ctx.now();
  r.reason = ctx.body.reason || '';
  ctx.store.put('crisis_roles', r);
  return r;
}

function tasks(ctx) {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const items = h(ctx, 'crisis_tasks').filter(t => t.sessionId === s.id);
  const order = { critical: 0, high: 1, medium: 2 };
  items.sort((a, b) => (order[a.priority] || 9) - (order[b.priority] || 9));
  return { items, total: items.length };
}

function createTask(ctx) {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const b = ctx.body;
  if (!b.title || !b.assignedTo) throw ctx.E.badRequest('missing');
  const staff = h(ctx, 'wf_staff').find(x => x.id === b.assignedTo) ||
                h(ctx, 'users').find(x => x.id === b.assignedTo);
  if (!staff) throw ctx.E.notFound('staff_not_found');
  const rec = {
    id: ctx.uid('ctask'), sessionId: s.id,
    title: b.title, description: b.description || '',
    priority: b.priority || 'high',
    assignedTo: staff.id,
    assignedName: staff.fullName || staff.username,
    requiredTick: b.requiredTick !== false,
    status: 'pending', createdBy: ctx.actor.id, createdAt: ctx.now()
  };
  ctx.store.put('crisis_tasks', rec);
  ctx.bus.emit('crisis.task.created', { record: rec, actor: ctx.actor });
  return rec;
}

function confirmTask(ctx) {
  const t = ctx.store.get('crisis_tasks', ctx.params.tid);
  if (!t) throw ctx.E.notFound('not_found');
  if (t.status !== 'pending') throw ctx.E.conflict('not_pending');
  t.status = 'confirmed'; t.confirmedAt = ctx.now(); t.confirmedBy = ctx.actor.id;
  ctx.store.put('crisis_tasks', t);
  return t;
}

function completeTask(ctx) {
  const t = ctx.store.get('crisis_tasks', ctx.params.tid);
  if (!t) throw ctx.E.notFound('not_found');
  t.status = 'completed'; t.completedAt = ctx.now(); t.completedBy = ctx.actor.id;
  t.result = ctx.body.result || '';
  ctx.store.put('crisis_tasks', t);
  return t;
}

function declineTask(ctx) {
  const t = ctx.store.get('crisis_tasks', ctx.params.tid);
  if (!t) throw ctx.E.notFound('not_found');
  t.status = 'declined'; t.declinedAt = ctx.now();
  t.declineReason = ctx.body.reason || '';
  ctx.store.put('crisis_tasks', t);
  return t;
}

function alerts(ctx) {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const items = h(ctx, 'crisis_alerts').filter(a => a.sessionId === s.id)
    .sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  return { items, total: items.length };
}

function sendAlert(ctx) {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const b = ctx.body;
  if (!b.title) throw ctx.E.badRequest('title_required');
  const rec = {
    id: ctx.uid('ca'), sessionId: s.id,
    title: b.title, message: b.message || '',
    severity: b.severity || 'high',
    sentBy: ctx.actor.id, sentByName: ctx.actor.username, createdAt: ctx.now()
  };
  ctx.store.put('crisis_alerts', rec);
  ctx.bus.emit('crisis.alert.sent', { record: rec, actor: ctx.actor });
  return rec;
}

function evacuation(ctx) {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const items = h(ctx, 'crisis_evacuation').filter(e => e.sessionId === s.id);
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  items.sort((a, b) => (order[a.priority] || 9) - (order[b.priority] || 9));
  return { items, total: items.length };
}

function updateEvac(ctx) {
  const items = h(ctx, 'crisis_evacuation').filter(e =>
    e.sessionId === ctx.params.id && e.patientId === ctx.params.pid);
  const e = items[0];
  if (!e) throw ctx.E.notFound('not_found');
  e.status = ctx.body.status || e.status;
  e.destination = ctx.body.destination || e.destination;
  e.updatedAt = ctx.now();
  ctx.store.put('crisis_evacuation', e);
  return e;
}

function mlAnalysis(ctx) {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const roles = h(ctx, 'crisis_roles').filter(r => r.sessionId === s.id);
  const tasksList = h(ctx, 'crisis_tasks').filter(t => t.sessionId === s.id);
  const uncovered = ROLES.filter(r => r.priority === 1 &&
    !roles.some(x => x.roleCode === r.code && x.status === 'accepted'));
  let risk = uncovered.length * 20 + tasksList.filter(t => t.status === 'pending').length * 5;
  risk = Math.min(100, risk);
  return {
    uncoveredCritical: uncovered,
    tasks: { total: tasksList.length, pending: tasksList.filter(t => t.status === 'pending').length },
    riskScore: risk,
    level: risk >= 60 ? 'hi' : risk >= 30 ? 'md' : 'lo'
  };
}

module.exports = {
  handlers: {
    listActive, getActive, history, stats,
    activate, deactivate, dashboard,
    roleCards, assignRole, acceptRole, declineRole,
    tasks, createTask, confirmTask, completeTask, declineTask,
    alerts, sendAlert,
    evacuation, updateEvac,
    mlAnalysis
  },
  routes: [
    {method:'GET', path:'/api/crisis/active', handler:'listActive', perm:'crisis.view'},
    {method:'GET', path:'/api/crisis/history', handler:'history', perm:'crisis.view'},
    {method:'GET', path:'/api/crisis/stats', handler:'stats', perm:'crisis.view'},
    {method:'GET', path:'/api/crisis/session', handler:'getActive', perm:'crisis.view'},
    {method:'POST', path:'/api/crisis/activate', handler:'activate', perm:'crisis.activate'},
    {method:'POST', path:'/api/crisis/:id/deactivate', handler:'deactivate', perm:'crisis.activate'},
    {method:'GET', path:'/api/crisis/:id/dashboard', handler:'dashboard', perm:'crisis.view'},
    {method:'GET', path:'/api/crisis/:id/roles', handler:'roleCards', perm:'crisis.view'},
    {method:'POST', path:'/api/crisis/:id/roles/assign', handler:'assignRole', perm:'crisis.assign'},
    {method:'POST', path:'/api/crisis/:id/roles/:rid/accept', handler:'acceptRole', perm:'crisis.view'},
    {method:'POST', path:'/api/crisis/:id/roles/:rid/decline', handler:'declineRole', perm:'crisis.view'},
    {method:'GET', path:'/api/crisis/:id/tasks', handler:'tasks', perm:'crisis.view'},
    {method:'POST', path:'/api/crisis/:id/tasks', handler:'createTask', perm:'crisis.assign'},
    {method:'POST', path:'/api/crisis/:id/tasks/:tid/confirm', handler:'confirmTask', perm:'crisis.confirm'},
    {method:'POST', path:'/api/crisis/:id/tasks/:tid/complete', handler:'completeTask', perm:'crisis.confirm'},
    {method:'POST', path:'/api/crisis/:id/tasks/:tid/decline', handler:'declineTask', perm:'crisis.confirm'},
    {method:'GET', path:'/api/crisis/:id/alerts', handler:'alerts', perm:'crisis.view'},
    {method:'POST', path:'/api/crisis/:id/alerts', handler:'sendAlert', perm:'crisis.alert'},
    {method:'GET', path:'/api/crisis/:id/evacuation', handler:'evacuation', perm:'crisis.view'},
    {method:'PUT', path:'/api/crisis/:id/evacuation/:pid', handler:'updateEvac', perm:'crisis.evacuate'},
    {method:'GET', path:'/api/crisis/:id/ml', handler:'mlAnalysis', perm:'crisis.view'}
  ],
  panels: [
    { id:'active', title:'بحران', icon:'🚨', perm:'crisis.view', kind:'crisis', api:'/api/crisis/active' },
    { id:'history', title:'تاریخچه بحران', icon:'📚', perm:'crisis.view', kind:'list', api:'/api/crisis/history', fields:['crisisLabel','activatedAt','deactivatedAt'] }
  ]
};
CRISIS_EOF

echo "─── Verify syntax ───"
node -e "const m = require('./modules/crisis.js'); console.log('✅ handlers:', Object.keys(m.handlers).length, '| routes:', m.routes.length, '| panels:', m.panels.length)" || { echo "❌ still broken"; exit 1; }

echo ""
echo "─── Restart ───"
for pid in $(pgrep -f "core/server.js" 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done
sleep 1

echo ""
echo "✅ Done — now run: node core/server.js"
