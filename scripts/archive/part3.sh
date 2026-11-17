
# ═══════════════════════════════════════════════════════════════
#  Part 3 — Crisis Mode + Surgical (OR/CSSD/PACU)
# ═══════════════════════════════════════════════════════════════

# ─── 1) core/mod-helpers.js ───
cat > core/mod-helpers.js << 'EOF'
const sig = require('./signature'), perms = require('./permissions');
function h(ctx, c) { try { const r = ctx.store.readAll(c); return Array.isArray(r) ? r : []; } catch(_) { return []; } }
function sd(x) { if (!x) return 0; const d = new Date(x); return isNaN(d.getTime()) ? 0 : d.getTime(); }
function num(x) { if (x == null || x === '') return null; const n = Number(x); return isNaN(n) ? null : n; }
function sg(ctx, c, r, a) {
  const s = sig.signAction({ userId: ctx.actor.id, action: a, collection: c, recordId: r.id, data: r });
  ctx.store.put('signatures', s); r.lastSignatureId = s.id; return s;
}
function list(coll, sortField) {
  return (ctx) => {
    let i = perms.scope(ctx.actor, h(ctx, coll));
    if (ctx.query.status) i = i.filter(x => x.status === ctx.query.status);
    const f = sortField || 'createdAt';
    i.sort((a, b) => sd(b[f] || b.requestedAt || b.activatedAt) - sd(a[f] || a.requestedAt || a.activatedAt));
    return { items: i, total: i.length };
  };
}
module.exports = { h, sd, num, sg, list };
EOF

# ─── 2) modules/crisis.js ───
cat > modules/crisis.js << 'EOF'
const { h, sd, sg, list } = require('../core/mod-helpers');
const TYPES = [
  {code:'war',label:'جنگ',icon:'⚔️'}, {code:'flood',label:'سیل',icon:'🌊'},
  {code:'earthquake',label:'زلزله',icon:'🏔️'}, {code:'storm',label:'طوفان',icon:'🌪️'},
  {code:'fire',label:'آتش‌سوزی',icon:'🔥'}, {code:'bio',label:'تهدید بیولوژیک',icon:'☣️'},
  {code:'terror',label:'تروریستی',icon:'💥'}, {code:'pandemic',label:'پاندمی',icon:'🦠'}
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

const activeList = (ctx) => {
  const items = h(ctx, 'crisis_sessions').filter(s => s.status === 'active');
  return { items, total: items.length };
};
const getActive = (ctx) => {
  const s = h(ctx, 'crisis_sessions').find(x => x.status === 'active');
  return s ? { active: true, session: s } : { active: false };
};
const history = (ctx) => {
  const items = h(ctx, 'crisis_sessions').filter(s => s.status === 'closed')
    .sort((a, b) => sd(b.activatedAt) - sd(a.activatedAt));
  return { items, total: items.length };
};
const activate = (ctx) => {
  const b = ctx.body;
  if (!b.crisisType) throw ctx.E.badRequest('crisis_type_required');
  const t = TYPES.find(x => x.code === b.crisisType);
  if (!t) throw ctx.E.badRequest('invalid_type');
  if (b.confirm !== true) throw ctx.E.badRequest('double_confirm_required');
  if (h(ctx, 'crisis_sessions').some(x => x.status === 'active'))
    throw ctx.E.conflict('already_active');
  const s = {
    id: ctx.uid('crz'), crisisType: t.code, crisisLabel: t.label, icon: t.icon,
    phase: 'active', reason: b.reason || '', location: b.location || '',
    estimatedCasualties: Number(b.estimatedCasualties) || 0,
    activatedBy: ctx.actor.id, activatedByName: ctx.actor.username,
    activatedAt: ctx.now(), status: 'active', createdAt: ctx.now()
  };
  ctx.store.put('crisis_sessions', s);
  // Auto-evacuation list
  const pts = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  for (const p of pts) {
    ctx.store.put('crisis_evacuation', {
      id: ctx.uid('evac'), sessionId: s.id, patientId: p.id,
      patientName: p.firstName + ' ' + p.lastName, wardCode: p.wardCode,
      bedNumber: p.bedNumber, priority: (p.wardCode||'').includes('ICU') ? 'critical' : 'high',
      status: 'pending', updatedAt: ctx.now()
    });
  }
  ctx.bus.emit('crisis.activated', { session: s, actor: ctx.actor });
  return s;
};
const deactivate = (ctx) => {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  if (s.status !== 'active') throw ctx.E.conflict('not_active');
  s.status = 'closed'; s.phase = 'recovery';
  s.deactivatedAt = ctx.now(); s.deactivatedBy = ctx.actor.id;
  ctx.store.put('crisis_sessions', s);
  ctx.bus.emit('crisis.deactivated', { session: s, actor: ctx.actor });
  return s;
};
const dashboard = (ctx) => {
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
};
const roleCards = (ctx) => {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const assigned = h(ctx, 'crisis_roles').filter(r => r.sessionId === s.id);
  return {
    session: s,
    roles: ROLES.map(def => {
      const fills = assigned.filter(a => a.roleCode === def.code);
      const acc = fills.find(f => f.status === 'accepted');
      const pen = fills.find(f => f.status === 'pending');
      return { ...def, current: acc || pen || null,
        status: acc ? 'filled' : pen ? 'pending' : 'unfilled' };
    })
  };
};
const assignRole = (ctx) => {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const b = ctx.body;
  if (!b.roleCode || !b.staffId) throw ctx.E.badRequest('missing');
  const def = ROLES.find(r => r.code === b.roleCode);
  if (!def) throw ctx.E.badRequest('invalid_role');
  const staff = h(ctx, 'wf_staff').find(x => x.id === b.staffId) ||
                h(ctx, 'users').find(x => x.id === b.staffId);
  if (!staff) throw ctx.E.notFound('staff_not_found');
  // Clear prior pending
  for (const e of h(ctx, 'crisis_roles').filter(r => r.sessionId === s.id && r.roleCode === b.roleCode)) {
    if (e.status !== 'accepted') ctx.store.remove('crisis_roles', e.id);
  }
  const rec = {
    id: ctx.uid('crole'), sessionId: s.id,
    roleCode: def.code, roleLabel: def.label, roleIcon: def.icon,
    staffId: staff.id, staffName: staff.fullName || staff.username,
    status: 'pending', assignedBy: ctx.actor.id, assignedAt: ctx.now()
  };
  ctx.store.put('crisis_roles', rec);
  ctx.bus.emit('crisis.role.assigned', { record: rec, actor: ctx.actor });
  return rec;
};
const acceptRole = (ctx) => {
  const r = ctx.store.get('crisis_roles', ctx.params.rid);
  if (!r) throw ctx.E.notFound('not_found');
  r.status = 'accepted'; r.acceptedAt = ctx.now();
  ctx.store.put('crisis_roles', r);
  return r;
};
const declineRole = (ctx) => {
  const r = ctx.store.get('crisis_roles', ctx.params.rid);
  if (!r) throw ctx.E.notFound('not_found');
  r.status = 'declined'; r.declinedAt = ctx.now();
  r.reason = ctx.body.reason || '';
  ctx.store.put('crisis_roles', r);
  return r;
};
const tasks = (ctx) => {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const items = h(ctx, 'crisis_tasks').filter(t => t.sessionId === s.id);
  const order = { critical: 0, high: 1, medium: 2 };
  items.sort((a, b) => (order[a.priority]||9) - (order[b.priority]||9));
  return { items, total: items.length };
};
const createTask = (ctx) => {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const b = ctx.body;
  if (!b.title || !b.assignedTo) throw ctx.E.badRequest('missing');
  const staff = h(ctx, 'wf_staff').find(x => x.id === b.assignedTo) ||
                h(ctx, 'users').find(x => x.id === b.assignedTo);
  if (!staff) throw ctx.E.notFound('staff_not_found');
  const rec = {
    id: ctx.uid('ctask'), sessionId: s.id, title: b.title,
    description: b.description || '', priority: b.priority || 'high',
    assignedTo: staff.id, assignedName: staff.fullName || staff.username,
    requiredTick: b.requiredTick !== false, status: 'pending',
    createdBy: ctx.actor.id, createdAt: ctx.now()
  };
  ctx.store.put('crisis_tasks', rec);
  ctx.bus.emit('crisis.task.created', { record: rec, actor: ctx.actor });
  return rec;
};
const confirmTask = (ctx) => {
  const t = ctx.store.get('crisis_tasks', ctx.params.tid);
  if (!t) throw ctx.E.notFound('not_found');
  if (t.status !== 'pending') throw ctx.E.conflict('not_pending');
  t.status = 'confirmed'; t.confirmedAt = ctx.now(); t.confirmedBy = ctx.actor.id;
  ctx.store.put('crisis_tasks', t);
  return t;
};
const completeTask = (ctx) => {
  const t = ctx.store.get('crisis_tasks', ctx.params.tid);
  if (!t) throw ctx.E.notFound('not_found');
  t.status = 'completed'; t.completedAt = ctx.now(); t.completedBy = ctx.actor.id;
  t.result = ctx.body.result || '';
  ctx.store.put('crisis_tasks', t);
  return t;
};
const alerts = (ctx) => {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const items = h(ctx, 'crisis_alerts').filter(a => a.sessionId === s.id)
    .sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  return { items, total: items.length };
};
const sendAlert = (ctx) => {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const b = ctx.body;
  if (!b.title) throw ctx.E.badRequest('title_required');
  const rec = {
    id: ctx.uid('ca'), sessionId: s.id, title: b.title,
    message: b.message || '', severity: b.severity || 'high',
    sentBy: ctx.actor.id, sentByName: ctx.actor.username, createdAt: ctx.now()
  };
  ctx.store.put('crisis_alerts', rec);
  ctx.bus.emit('crisis.alert.sent', { record: rec, actor: ctx.actor });
  return rec;
};
const evacuation = (ctx) => {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const items = h(ctx, 'crisis_evacuation').filter(e => e.sessionId === s.id);
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  items.sort((a, b) => (order[a.priority]||9) - (order[b.priority]||9));
  return { items, total: items.length };
};
const updateEvac = (ctx) => {
  const items = h(ctx, 'crisis_evacuation').filter(e =>
    e.sessionId === ctx.params.id && e.patientId === ctx.params.pid);
  const e = items[0];
  if (!e) throw ctx.E.notFound('not_found');
  e.status = ctx.body.status || e.status;
  e.destination = ctx.body.destination || e.destination;
  e.updatedAt = ctx.now();
  ctx.store.put('crisis_evacuation', e);
  return e;
};
const mlAnalysis = (ctx) => {
  const s = ctx.store.get('crisis_sessions', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const roles = h(ctx, 'crisis_roles').filter(r => r.sessionId === s.id);
  const tasks = h(ctx, 'crisis_tasks').filter(t => t.sessionId === s.id);
  const uncovered = ROLES.filter(r => r.priority === 1 &&
    !roles.some(x => x.roleCode === r.code && x.status === 'accepted'));
  let risk = uncovered.length * 20 + tasks.filter(t => t.status === 'pending').length * 5;
  risk = Math.min(100, risk);
  return {
    uncoveredCritical: uncovered,
    tasks: { total: tasks.length, pending: tasks.filter(t => t.status === 'pending').length },
    riskScore: risk, level: risk >= 60 ? 'hi' : risk >= 30 ? 'md' : 'lo'
  };
};
const stats = (ctx) => {
  const ss = h(ctx, 'crisis_sessions');
  return {
    active: ss.filter(s => s.status === 'active').length,
    history: ss.filter(s => s.status === 'closed').length,
    types: TYPES, roles: ROLES
  };
};

module.exports = {
  handlers: {
    activeList, getActive, history, activate, deactivate, dashboard,
    roleCards, assignRole, acceptRole, declineRole,
    tasks, createTask, confirmTask, completeTask,
    alerts, sendAlert, evacuation, updateEvac, mlAnalysis, stats
  },
  routes: [
    {method:'GET', path:'/api/crisis/active', handler:'activeList', perm:'crisis.view'},
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
    {method:'GET', path:'/api/crisis/:id/alerts', handler:'alerts', perm:'crisis.view'},
    {method:'POST', path:'/api/crisis/:id/alerts', handler:'sendAlert', perm:'crisis.alert'},
    {method:'GET', path:'/api/crisis/:id/evacuation', handler:'evacuation', perm:'crisis.view'},
    {method:'PUT', path:'/api/crisis/:id/evacuation/:pid', handler:'updateEvac', perm:'crisis.evacuate'},
    {method:'GET', path:'/api/crisis/:id/ml', handler:'mlAnalysis', perm:'crisis.view'}
  ],
  panels: [
    {id:'active', title:'بحران فعال', icon:'🚨', perm:'crisis.view', kind:'list',
      api:'/api/crisis/active', fields:['crisisLabel','status','activatedAt','reason'],
      form:{api:'/api/crisis/activate', method:'POST', fields:[
        {name:'crisisType', label:'نوع بحران (war/flood/earthquake/storm/fire/bio/terror/pandemic)', required:true},
        {name:'reason', label:'علت'},
        {name:'location', label:'محل'},
        {name:'confirm', label:'تأیید فعال‌سازی (بنویس: true)', required:true}
      ]}},
    {id:'history', title:'تاریخچه بحران', icon:'📚', perm:'crisis.view', kind:'list',
      api:'/api/crisis/history', fields:['crisisLabel','activatedAt','deactivatedAt']}
  ]
};
EOF

# ─── 3) modules/surgical.js ───
cat > modules/surgical.js << 'EOF'
const { h, sd, num, sg, list } = require('../core/mod-helpers');

const OR_GROUPS = { GEN: 'جنرال', URO: 'اورولوژی', EMG: 'اورژانس' };
const CSSD_METHODS = ['steam', 'eto', 'plasma', 'chemical'];

const rooms = (ctx) => {
  const items = h(ctx, 'or_rooms');
  return { items, total: items.length, groups: OR_GROUPS, methods: CSSD_METHODS };
};

const schedule = list('or_schedule', 'scheduledStart');
const scheduleCreate = (ctx) => {
  const b = ctx.body;
  if (!b.patientId || !b.roomId || !b.procedure) throw ctx.E.badRequest('missing');
  const p = ctx.store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const room = ctx.store.get('or_rooms', b.roomId);
  if (!room) throw ctx.E.notFound('room_not_found');
  const rec = {
    id: ctx.uid('ors'), patientId: p.id,
    patientName: p.firstName + ' ' + p.lastName, wardCode: p.wardCode,
    roomId: room.id, roomCode: room.code,
    procedure: b.procedure, specialty: b.specialty || 'general',
    surgeon: b.surgeon || null, anesthesiologist: b.anesthesiologist || null,
    scheduledDate: b.scheduledDate || new Date().toISOString().slice(0,10),
    scheduledStart: b.scheduledStart || ctx.now(),
    estimatedDurationMin: Number(b.estimatedDurationMin) || 90,
    priority: b.priority || 'elective',
    status: 'scheduled',
    checklist: { signIn: null, timeOut: null, signOut: null },
    createdAt: ctx.now()
  };
  ctx.store.put('or_schedule', rec);
  sg(ctx, 'or_schedule', rec, 'schedule');
  ctx.bus.emit('or.case.scheduled', { record: rec, actor: ctx.actor });
  return rec;
};

const checklist = (ctx) => {
  const s = ctx.store.get('or_schedule', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const phase = ctx.params.phase;
  if (!['signin', 'timeout', 'signout'].includes(phase)) throw ctx.E.badRequest('invalid_phase');
  const key = phase === 'signin' ? 'signIn' : phase === 'timeout' ? 'timeOut' : 'signOut';
  const required = phase === 'signin' ? ['patientIdentity','siteMarked','consentSigned','allergiesChecked','anesthesiaSafety']
    : phase === 'timeout' ? ['teamIntroduced','procedureConfirmed','antibioticGiven','imagingDisplayed','instrumentSterility']
    : ['procedureRecorded','instrumentCountCorrect','specimenLabeled','equipmentIssuesNoted','recoveryPlan'];
  const b = ctx.body || {};
  for (const r of required) if (b[r] !== true) throw ctx.E.badRequest('missing_' + r);
  s.checklist[key] = { signedBy: ctx.actor.id, signedAt: ctx.now(), items: b };
  ctx.store.put('or_schedule', s);
  sg(ctx, 'or_schedule', s, phase);
  return s;
};

const startCase = (ctx) => {
  const s = ctx.store.get('or_schedule', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  if (s.status !== 'scheduled') throw ctx.E.conflict('not_scheduled');
  if (!s.checklist.signIn || !s.checklist.timeOut) throw ctx.E.badRequest('checklists_incomplete');
  s.status = 'in_progress';
  s.actualStart = ctx.now();
  ctx.store.put('or_schedule', s);
  const room = ctx.store.get('or_rooms', s.roomId);
  if (room) { room.status = 'occupied'; room.currentCaseId = s.id; ctx.store.put('or_rooms', room); }
  ctx.bus.emit('or.case.started', { record: s, actor: ctx.actor });
  return s;
};

const endCase = (ctx) => {
  const s = ctx.store.get('or_schedule', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  if (s.status !== 'in_progress') throw ctx.E.conflict('not_in_progress');
  if (!s.checklist.signOut) throw ctx.E.badRequest('signout_incomplete');
  s.status = 'completed';
  s.actualEnd = ctx.now();
  s.actualDurationMin = Math.round((sd(s.actualEnd) - sd(s.actualStart)) / 60000);
  ctx.store.put('or_schedule', s);
  const room = ctx.store.get('or_rooms', s.roomId);
  if (room) { room.status = 'cleaning'; room.currentCaseId = null; ctx.store.put('or_rooms', room); }
  ctx.bus.emit('or.case.ended', { record: s, actor: ctx.actor });
  return s;
};

const pacu = (ctx) => {
  const items = h(ctx, 'or_pacu').filter(p => p.status === 'active');
  return { items, total: items.length };
};

const pacuAdmit = (ctx) => {
  const s = ctx.store.get('or_schedule', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  if (s.status !== 'completed') throw ctx.E.conflict('case_not_completed');
  const rec = {
    id: ctx.uid('pacu'), caseId: s.id, patientId: s.patientId,
    patientName: s.patientName, admittedAt: ctx.now(),
    aldreteScore: Number(ctx.body.aldreteScore) || 8,
    status: 'active', nurse: ctx.actor.id
  };
  ctx.store.put('or_pacu', rec);
  return rec;
};

const pacuDischarge = (ctx) => {
  const p = ctx.store.get('or_pacu', ctx.params.id);
  if (!p) throw ctx.E.notFound('not_found');
  if (p.status !== 'active') throw ctx.E.conflict('not_active');
  if (p.aldreteScore < 9) throw ctx.E.conflict('aldrete_too_low');
  p.status = 'discharged';
  p.dischargedAt = ctx.now();
  ctx.store.put('or_pacu', p);
  return p;
};

// ─── CSSD ───
const cssdSets = list('cssd_sets', 'sterilizedAt');
const cssdCreate = (ctx) => {
  const b = ctx.body;
  if (!b.setName || !b.department) throw ctx.E.badRequest('missing');
  const itemCount = Number(b.itemCount) || 0;
  const rec = {
    id: ctx.uid('set'), setName: b.setName, department: b.department,
    itemCount, indicatorClass: itemCount > 12 ? 6 : 4,
    method: b.method || 'steam',
    status: 'prepared', cycleId: null, label: null,
    preparedBy: ctx.actor.id, preparedAt: ctx.now(), createdAt: ctx.now()
  };
  ctx.store.put('cssd_sets', rec);
  sg(ctx, 'cssd_sets', rec, 'create');
  return rec;
};

const cssdCycles = list('cssd_cycles', 'startedAt');
const cssdCycleCreate = (ctx) => {
  const b = ctx.body;
  if (!b.sterilizerCode || !b.method || !Array.isArray(b.setIds))
    throw ctx.E.badRequest('missing');
  const rec = {
    id: ctx.uid('cyc'), cycleNumber: 'C-' + Date.now().toString(36).toUpperCase(),
    sterilizerCode: b.sterilizerCode, method: b.method, setIds: b.setIds,
    status: 'running', loadedBy: ctx.actor.id, loadedByName: ctx.actor.username,
    startedAt: ctx.now(), closedAt: null,
    indicators: { biological: 'pending', chemical: 'pending' },
    createdAt: ctx.now()
  };
  ctx.store.put('cssd_cycles', rec);
  // Link sets
  for (const sid of b.setIds) {
    const s = ctx.store.get('cssd_sets', sid);
    if (s) { s.cycleId = rec.id; s.status = 'sterilizing'; ctx.store.put('cssd_sets', s); }
  }
  return rec;
};

const cssdIndicator = (ctx) => {
  const c = ctx.store.get('cssd_cycles', ctx.params.id);
  if (!c) throw ctx.E.notFound('not_found');
  const b = ctx.body;
  if (!['biological', 'chemical'].includes(b.type)) throw ctx.E.badRequest('invalid_type');
  if (!['pass', 'fail'].includes(b.result)) throw ctx.E.badRequest('invalid_result');
  c.indicators[b.type] = b.result;
  if (b.result === 'fail') c.status = 'failed';
  ctx.store.put('cssd_cycles', c);
  if (b.result === 'fail') ctx.bus.emit('cssd.indicator.failed', { record: c, actor: ctx.actor });
  return c;
};

const cssdIssueSet = (ctx) => {
  const s = ctx.store.get('cssd_sets', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  if (s.status !== 'sterilized') throw ctx.E.conflict('not_sterilized');
  s.status = 'issued'; s.issuedAt = ctx.now(); s.issuedBy = ctx.actor.id;
  ctx.store.put('cssd_sets', s);
  return s;
};

const cssdRecalls = list('cssd_recalls', 'initiatedAt');
const cssdRecallCreate = (ctx) => {
  const b = ctx.body;
  if (!b.cycleId || !b.reason) throw ctx.E.badRequest('missing');
  const cyc = ctx.store.get('cssd_cycles', b.cycleId);
  if (!cyc) throw ctx.E.notFound('cycle_not_found');
  const affected = h(ctx, 'cssd_sets').filter(s => s.cycleId === cyc.id);
  const rec = {
    id: ctx.uid('recall'), cycleId: cyc.id, cycleNumber: cyc.cycleNumber,
    reason: b.reason, affectedSetCount: affected.length,
    status: 'open', initiatedBy: ctx.actor.id, initiatedAt: ctx.now()
  };
  ctx.store.put('cssd_recalls', rec);
  for (const s of affected) { s.status = 'recalled'; ctx.store.put('cssd_sets', s); }
  ctx.bus.emit('cssd.recall.initiated', { record: rec, actor: ctx.actor });
  return rec;
};

module.exports = {
  handlers: {
    rooms, schedule, scheduleCreate, checklist, startCase, endCase,
    pacu, pacuAdmit, pacuDischarge,
    cssdSets, cssdCreate, cssdCycles, cssdCycleCreate,
    cssdIndicator, cssdIssueSet, cssdRecalls, cssdRecallCreate
  },
  routes: [
    {method:'GET', path:'/api/or/rooms', handler:'rooms', perm:'or.view'},
    {method:'GET', path:'/api/or/schedule', handler:'schedule', perm:'or.view'},
    {method:'POST', path:'/api/or/schedule', handler:'scheduleCreate', perm:'or.schedule'},
    {method:'POST', path:'/api/or/schedule/:id/checklist/:phase', handler:'checklist', perm:'or.checklist'},
    {method:'POST', path:'/api/or/schedule/:id/start', handler:'startCase', perm:'or.checklist'},
    {method:'POST', path:'/api/or/schedule/:id/end', handler:'endCase', perm:'or.checklist'},
    {method:'GET', path:'/api/or/pacu', handler:'pacu', perm:'or.view'},
    {method:'POST', path:'/api/or/pacu/:id/admit', handler:'pacuAdmit', perm:'or.pacu'},
    {method:'POST', path:'/api/or/pacu/:id/discharge', handler:'pacuDischarge', perm:'or.pacu'},
    {method:'GET', path:'/api/cssd/sets', handler:'cssdSets', perm:'cssd.view'},
    {method:'POST', path:'/api/cssd/sets', handler:'cssdCreate', perm:'cssd.manage'},
    {method:'POST', path:'/api/cssd/sets/:id/issue', handler:'cssdIssueSet', perm:'cssd.manage'},
    {method:'GET', path:'/api/cssd/cycles', handler:'cssdCycles', perm:'cssd.view'},
    {method:'POST', path:'/api/cssd/cycles', handler:'cssdCycleCreate', perm:'cssd.manage'},
    {method:'POST', path:'/api/cssd/cycles/:id/indicator', handler:'cssdIndicator', perm:'cssd.manage'},
    {method:'GET', path:'/api/cssd/recalls', handler:'cssdRecalls', perm:'cssd.view'},
    {method:'POST', path:'/api/cssd/recalls', handler:'cssdRecallCreate', perm:'cssd.manage'}
  ],
  panels: [
    {id:'rooms', title:'اتاق‌های عمل', icon:'🔪', perm:'or.view', kind:'list',
      api:'/api/or/rooms', fields:['code','group','status']},
    {id:'schedule', title:'برنامه جراحی', icon:'📅', perm:'or.view', kind:'list',
      api:'/api/or/schedule', fields:['patientName','procedure','roomCode','status'],
      form:{api:'/api/or/schedule', method:'POST', fields:[
        {name:'patientId', label:'شناسه بیمار', required:true},
        {name:'roomId', label:'شناسه اتاق (or_GEN1...)', required:true},
        {name:'procedure', label:'نوع عمل', required:true},
        {name:'specialty', label:'تخصص'},
        {name:'priority', label:'اولویت (elective/urgent/emergency)'}
      ]}},
    {id:'pacu', title:'PACU', icon:'🛏️', perm:'or.view', kind:'list',
      api:'/api/or/pacu', fields:['patientName','aldreteScore','status']},
    {id:'cssd_sets', title:'ست‌های استریل', icon:'🧼', perm:'cssd.view', kind:'list',
      api:'/api/cssd/sets', fields:['setName','department','status'],
      form:{api:'/api/cssd/sets', method:'POST', fields:[
        {name:'setName', label:'نام ست', required:true},
        {name:'department', label:'بخش', required:true},
        {name:'itemCount', label:'تعداد اقلام', type:'number'},
        {name:'method', label:'روش (steam/eto/plasma/chemical)'}
      ]}},
    {id:'cssd_cycles', title:'چرخه‌های استریل', icon:'🔄', perm:'cssd.view', kind:'list',
      api:'/api/cssd/cycles', fields:['cycleNumber','method','status']},
    {id:'cssd_recalls', title:'فراخوان‌ها', icon:'🚨', perm:'cssd.view', kind:'list',
      api:'/api/cssd/recalls', fields:['cycleNumber','reason','status']}
  ]
};
EOF

# ─── 4) Patch server.js — permissions ───
node << 'SRVPATCH'
const fs = require('fs');
const p = 'core/server.js';
let src = fs.readFileSync(p, 'utf8');

const newPerms = `
Object.assign(perms.P, {
  'crisis.view':'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,supervisor_er,head_nurse,quality_officer',
  'crisis.activate':'admin,hospital_director,medical_director,nursing_director',
  'crisis.assign':'admin,hospital_director,medical_director,nursing_director,supervisor_senior',
  'crisis.confirm':'admin,nurse,nurse_aide,head_nurse,physician,resident,intern,attending,specialist,supervisor_senior,supervisor_clinical',
  'crisis.alert':'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical',
  'crisis.evacuate':'admin,nursing_director,supervisor_senior,head_nurse',
  'or.view':'admin,head_nurse,supervisor_senior,supervisor_clinical,nursing_director,medical_director,anesthesiologist,surgeon,resident,attending,or_manager',
  'or.schedule':'admin,or_manager,head_nurse,supervisor_senior,attending',
  'or.checklist':'admin,nurse,surgeon,anesthesiologist,or_manager,head_nurse',
  'or.pacu':'admin,nurse,head_nurse,anesthesiologist',
  'cssd.view':'admin,cssd_supervisor,head_nurse,or_manager,supervisor_infection,quality_officer,nursing_director',
  'cssd.manage':'admin,cssd_supervisor,or_manager,supervisor_infection'
});
`;
src = src.replace(/(Object\.assign\(perms\.P, \{[\s\S]*?\}\);)/, '$1\n' + newPerms);
fs.writeFileSync(p, src);
console.log('✅ server.js permissions extended');
SRVPATCH

# ─── 5) Patch seed.js — add staff + OR rooms ───
node << 'SEEDPATCH'
const fs = require('fs');
const p = 'core/seed.js';
let src = fs.readFileSync(p, 'utf8');
const addon = `
  // ─── Demo staff ───
  if (store.readAll('wf_staff').length === 0) {
    const staff = [
      {fn:'مریم', ln:'موسوی', role:'nurse', ward:'ICU'},
      {fn:'احمد', ln:'رضایی', role:'nurse', ward:'ER'},
      {fn:'زهرا', ln:'کریمی', role:'head_nurse', ward:'ICU'},
      {fn:'محمد', ln:'احمدی', role:'physician', ward:'ER'},
      {fn:'فاطمه', ln:'حسینی', role:'resident', ward:'ICU'},
      {fn:'علی', ln:'نوری', role:'attending', ward:'ICU'},
      {fn:'سارا', ln:'مهدوی', role:'nurse', ward:'GEN'},
      {fn:'رضا', ln:'صادقی', role:'pharmacist', ward:'PHARM'},
      {fn:'نگار', ln:'بهرامی', role:'lab_tech', ward:'LAB'},
      {fn:'حسین', ln:'زمانی', role:'anesthesiologist', ward:'OR'}
    ];
    for (let i = 0; i < staff.length; i++) {
      const s = staff[i];
      store.put('wf_staff', {
        id: 'wf_' + (i+1), userId: null,
        fullName: s.fn + ' ' + s.ln,
        role: s.role, ward: s.ward,
        active: true, oncallEligible: true,
        createdAt: new Date().toISOString()
      });
    }
    console.log('🌱 Seeded: ' + staff.length + ' staff members');
  }
  // ─── OR rooms ───
  if (store.readAll('or_rooms').length === 0) {
    const groups = [['GEN',12],['URO',5],['EMG',5]];
    for (const [g,n] of groups) {
      for (let i = 1; i <= n; i++) {
        store.put('or_rooms', {
          id: 'or_' + g + i,
          code: 'OR-' + g + '-' + String(i).padStart(2,'0'),
          group: g, status: 'available',
          currentCaseId: null, createdAt: new Date().toISOString()
        });
      }
    }
    console.log('🌱 Seeded: 22 OR rooms');
  }
`;
// Insert before closing brace
src = src.replace(/(\n)\}/, '\n' + addon + '\n}');
fs.writeFileSync(p, src);
console.log('✅ seed.js extended (staff + OR rooms)');
SEEDPATCH

# ─── 6) Patch app.js — add showItem + openForm + form button ───
node << 'APPPATCH'
const fs = require('fs');
const p = 'public/app.js';
let src = fs.readFileSync(p, 'utf8');

// Add onclick to row div
src = src.replace(
  /h\+=`<div class="row \$\{c\}"><div class="row-hd"><div class="row-title">\$\{fmtTitle\(it\)\}<\/div>`;/,
  "h+=`<div class=\"row ${c}\" onclick=\"NABZ.showItem('${p.id}','${it.id}')\"><div class=\"row-hd\"><div class=\"row-title\">${fmtTitle(it)}</div>`;"
);

// Add form button after sec-hd
src = src.replace(
  /(<\/span><\/div>`;\s*\n\s*if\(!items\.length\)h\+=)/,
  `$1\n  if(p.form){h+=\`<div style="margin-bottom:10px"><button class="btn btn-primary" onclick="NABZ.openForm('\${p.id}')">➕ جدید</button></div>\`;}\n`
);

// Append new functions
src += `
NABZ.showItem=async function(pid,iid){
const p=S.panels.find(x=>x.id===pid);if(!p)return;
try{const d=await api(p.api);const item=(d.items||[]).find(x=>x.id===iid)||d;
const ov=document.createElement('div');
ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;padding:20px;display:grid;place-items:center';
ov.onclick=e=>{if(e.target===ov)ov.remove()};
const pre=document.createElement('pre');
pre.textContent=JSON.stringify(item,null,2);
pre.style.cssText='background:var(--bg2);padding:16px;border-radius:8px;font-size:11px;overflow:auto;max-height:85vh;max-width:92vw;color:var(--fg);font-family:monospace';
ov.appendChild(pre);document.body.appendChild(ov);
}catch(e){alert(e.message)}};
NABZ.openForm=async function(pid){
const p=S.panels.find(x=>x.id===pid);if(!p||!p.form)return;
const data={};
for(const f of(p.form.fields||[])){
const v=prompt(f.label+(f.required?' *':''));
if(v===null)return;
if(v===''&&f.required){alert('الزامی: '+f.label);return}
data[f.name]=f.type==='number'?Number(v):v}
try{await api(p.form.api||p.api,{method:p.form.method||'POST',body:JSON.stringify(data)});
alert('✅ ثبت شد');show(pid)}catch(e){alert('❌ '+e.message)}};
`;
fs.writeFileSync(p, src);
console.log('✅ app.js enhanced (form + detail modal)');
APPPATCH

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ Part 3 — Crisis + Surgical added         ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
