
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Care Team Coordination
//  3 layers: Team + Discussion + I-PASS Handoff
//  Standards: JCI COP.1 · I-PASS (Starmer NEJM 2014)
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const store = require('../core/store');
const bus = require('../core/events');
const perms = require('../core/permissions');

if (!perms.P['care_team.view']) {
  perms.P['care_team.view'] = 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,head_nurse,attending,specialist,surgeon,resident,intern,physician,nurse,pharmacist,quality_officer';
  perms.P['care_team.manage'] = 'admin,attending,specialist,surgeon,head_nurse,resident,physician';
  perms.P['care_team.post'] = 'admin,attending,specialist,surgeon,resident,intern,physician,nurse,head_nurse,pharmacist';
  perms.P['care_team.signout'] = 'admin,attending,specialist,surgeon,resident,physician';
}

const TEAM_ROLES = {
  primary_attending: { fa:'پزشک معالج', icon:'👨‍⚕️', required:true, level:1 },
  resident:          { fa:'رزیدنت', icon:'🩺', required:true, level:1 },
  primary_nurse:     { fa:'پرستار مسئول', icon:'👩‍⚕️', required:true, level:1 },
  charge_nurse:      { fa:'سرپرستار شیفت', icon:'📋', required:false, level:2 },
  pharmacist:        { fa:'داروساز بالینی', icon:'💊', required:false, level:2 },
  case_manager:      { fa:'مدیر مورد', icon:'📊', required:false, level:3 },
  social_worker:     { fa:'مددکار', icon:'🤝', required:false, level:3 },
  nutritionist:      { fa:'تغذیه', icon:'🥗', required:false, level:3 },
  physical_therapy:  { fa:'فیزیوتراپی', icon:'🏃', required:false, level:3 },
  consulting:        { fa:'مشاور', icon:'🩺', required:false, level:2 }
};

// ═══════════════════════════════════════════════════════════
//  Part 1: Team Assignment
// ═══════════════════════════════════════════════════════════
function getTeam(ctx) {
  const pid = ctx.params.patientId;
  const p = store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');

  let team = store.readAll('care_teams').find(t => t.patientId === pid);
  if (!team) {
    team = {
      id: 'ct_' + pid, patientId: pid,
      patientName: p.firstName + ' ' + p.lastName,
      wardCode: p.wardCode,
      members: [],
      createdAt: ctx.now(), updatedAt: ctx.now()
    };
    store.put('care_teams', team);
  }

  // Enrich with current user data
  const users = store.readAll('users');
  const userMap = new Map(users.map(u => [u.id, u]));

  const enriched = team.members.map(m => {
    const u = userMap.get(m.userId);
    return {
      ...m,
      fullName: u ? (u.fullName || u.username) : m.fullName || '?',
      username: u ? u.username : null,
      active: u ? u.active !== false : false
    };
  });

  // Check required roles missing
  const assignedRoles = new Set(enriched.map(m => m.role));
  const missing = Object.keys(TEAM_ROLES)
    .filter(r => TEAM_ROLES[r].required && !assignedRoles.has(r))
    .map(r => ({ role: r, ...TEAM_ROLES[r] }));

  return {
    patientId: pid,
    patientName: team.patientName,
    wardCode: team.wardCode,
    members: enriched,
    missingRequired: missing,
    rolesCatalog: TEAM_ROLES,
    updatedAt: team.updatedAt
  };
}

function assignMember(ctx) {
  const pid = ctx.params.patientId;
  const b = ctx.body || {};
  if (!b.userId || !b.role) throw ctx.E.badRequest('user_id_and_role_required');
  if (!TEAM_ROLES[b.role]) throw ctx.E.badRequest('invalid_role:' + b.role);

  const p = store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const user = store.get('users', b.userId);
  if (!user) throw ctx.E.notFound('user_not_found');

  let team = store.readAll('care_teams').find(t => t.patientId === pid);
  if (!team) {
    team = {
      id: 'ct_' + pid, patientId: pid,
      patientName: p.firstName + ' ' + p.lastName,
      wardCode: p.wardCode,
      members: [], createdAt: ctx.now()
    };
  }

  // For non-consulting roles: replace existing (single slot)
  if (b.role !== 'consulting') {
    team.members = team.members.filter(m => m.role !== b.role);
  }

  // Avoid duplicate
  if (team.members.find(m => m.userId === b.userId && m.role === b.role)) {
    throw ctx.E.conflict('already_assigned');
  }

  team.members.push({
    id: ctx.uid('ctm'),
    userId: b.userId,
    role: b.role,
    roleFa: TEAM_ROLES[b.role].fa,
    fullName: user.fullName || user.username,
    service: b.service || null,
    assignedAt: ctx.now(),
    assignedBy: ctx.actor.id
  });
  team.updatedAt = ctx.now();
  store.put('care_teams', team);

  ctx.audit.write('care_team', 'member.assign', team.id, ctx.actor, {
    patientId: pid, userId: b.userId, role: b.role
  });
  bus.emit('care_team.member.assigned', { team, member: b, actor: ctx.actor });

  return getTeam(ctx);
}

function removeMember(ctx) {
  const pid = ctx.params.patientId;
  const memberId = ctx.params.memberId;
  const team = store.readAll('care_teams').find(t => t.patientId === pid);
  if (!team) throw ctx.E.notFound('team_not_found');

  const before = team.members.length;
  team.members = team.members.filter(m => m.id !== memberId);
  if (team.members.length === before) throw ctx.E.notFound('member_not_found');
  team.updatedAt = ctx.now();
  store.put('care_teams', team);

  ctx.audit.write('care_team', 'member.remove', team.id, ctx.actor, { memberId });
  return getTeam(ctx);
}

// ═══════════════════════════════════════════════════════════
//  Part 2: Discussion Thread
// ═══════════════════════════════════════════════════════════
function getThread(ctx) {
  const pid = ctx.params.patientId;
  const limit = Math.min(100, Number(ctx.query.limit) || 30);
  const messages = store.readAll('care_discussions')
    .filter(m => m.patientId === pid)
    .sort((a, b) => sd(a.postedAt) - sd(b.postedAt))
    .slice(-limit);

  const users = store.readAll('users');
  const userMap = new Map(users.map(u => [u.id, u]));

  return {
    patientId: pid,
    messages: messages.map(m => {
      const u = userMap.get(m.authorId);
      return {
        id: m.id,
        authorName: u ? (u.fullName || u.username) : m.authorName || '?',
        authorRole: m.authorRole,
        text: m.text,
        priority: m.priority || 'normal',
        linkedData: m.linkedData || null,
        replies: m.replies || [],
        postedAt: m.postedAt,
        readBy: (m.readBy || []).length
      };
    }),
    total: messages.length
  };
}

function postMessage(ctx) {
  const pid = ctx.params.patientId;
  const b = ctx.body || {};
  if (!b.text || !b.text.trim()) throw ctx.E.badRequest('text_required');
  const p = store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');

  // Verify user is on team (or cross-ward)
  const team = store.readAll('care_teams').find(t => t.patientId === pid);
  const isMember = team && team.members.find(m => m.userId === ctx.actor.id);
  const isCross = perms.isCrossWard(ctx.actor.role);
  if (!isMember && !isCross && ctx.actor.role !== 'admin') {
    throw ctx.E.forbidden('not_on_care_team');
  }

  const rec = {
    id: ctx.uid('cdm'),
    patientId: pid,
    patientName: p.firstName + ' ' + p.lastName,
    authorId: ctx.actor.id,
    authorName: ctx.actor.fullName || ctx.actor.username,
    authorRole: ctx.actor.role,
    text: String(b.text).slice(0, 2000),
    priority: ['normal','urgent','critical'].includes(b.priority) ? b.priority : 'normal',
    linkedData: b.linkedData || null,
    replyToId: b.replyToId || null,
    replies: [],
    readBy: [],
    postedAt: ctx.now()
  };
  store.put('care_discussions', rec);

  // If reply, append to parent
  if (b.replyToId) {
    const parent = store.get('care_discussions', b.replyToId);
    if (parent) {
      parent.replies = parent.replies || [];
      parent.replies.push({
        id: rec.id, authorName: rec.authorName, text: rec.text, postedAt: rec.postedAt
      });
      store.put('care_discussions', parent);
    }
  }

  bus.emit('care_team.message.posted', { record: rec, actor: ctx.actor });

  // Notify team members via SSE
  if (team && rec.priority !== 'normal') {
    for (const m of team.members) {
      if (m.userId !== ctx.actor.id) {
        bus.emit('notification.user', {
          userId: m.userId,
          title: (rec.priority === 'critical' ? '🚨 ' : '⚠️ ') + 'پیام ' + p.firstName,
          message: rec.text.slice(0, 100),
          patientId: pid
        });
      }
    }
  }

  ctx.audit.write('care_team', 'message.posted', rec.id, ctx.actor, {
    patientId: pid, priority: rec.priority, length: rec.text.length
  });

  return rec;
}

// ═══════════════════════════════════════════════════════════
//  Part 3: I-PASS Sign-out
//  I = Illness severity, P = Patient summary, A = Action list,
//  S = Situation awareness, S = Synthesis by receiver
// ═══════════════════════════════════════════════════════════
function createSignOut(ctx) {
  const b = ctx.body || {};
  if (!b.patientIds || !Array.isArray(b.patientIds) || b.patientIds.length === 0) {
    throw ctx.E.badRequest('patient_ids_required');
  }
  if (!b.toUserId) throw ctx.E.badRequest('to_user_required');
  if (!b.untilShift) throw ctx.E.badRequest('until_shift_required');

  const targetUser = store.get('users', b.toUserId);
  if (!targetUser) throw ctx.E.notFound('to_user_not_found');

  // Build I-PASS for each patient
  const patients = [];
  for (const pid of b.patientIds) {
    const p = store.get('patients', pid);
    if (!p) continue;

    const lastVital = h(ctx, 'vitals').filter(v => v.patientId === pid)
      .sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt))[0];
    const activeOrders = h(ctx, 'orders').filter(o => o.patientId === pid && ['pending','verified','active'].includes(o.status));
    const pendingLabs = h(ctx, 'labs').filter(l => l.patientId === pid && ['ordered','collected','in_transit','received'].includes(l.status));
    const recentConsults = h(ctx, 'consults').filter(c => c.patientId === pid && ['requested','responded'].includes(c.status));
    const marDue = h(ctx, 'mar').filter(m => m.patientId === pid && ['scheduled','due'].includes(m.status));

    // Determine illness severity from NEWS2 + conditions
    const news2 = lastVital ? (Number(lastVital.news2) || 0) : 0;
    let severity = 'stable';
    if (news2 >= 7) severity = 'critical';
    else if (news2 >= 5) severity = 'guarded';
    else if (news2 >= 3) severity = 'watcher';

    // P: summary
    const summary = (p.diagnosis || '') + (p.comorbidities && p.comorbidities.length ? ' · ' + p.comorbidities.join('، ') : '');

    // A: action items from active orders/pending labs/consults/marDue
    const actions = [];
    if (marDue.length > 0) actions.push(marDue.length + ' دوز MAR در انتظار');
    if (pendingLabs.length > 0) actions.push(pendingLabs.length + ' آزمایش در انتظار');
    if (recentConsults.length > 0) actions.push(recentConsults.length + ' مشاوره فعال');
    const statOrders = activeOrders.filter(o => o.priority === 'stat');
    if (statOrders.length > 0) actions.push(statOrders.length + ' دستور STAT');

    // S: situational awareness — note the risk
    const situation = [];
    if (news2 >= 5) situation.push('NEWS2 ' + news2 + ' — پایش دقیق');
    if (p.codeStatus && p.codeStatus !== 'full') situation.push('کد ' + p.codeStatus.toUpperCase());
    if ((p.allergies || []).length > 0) situation.push('آلرژی: ' + p.allergies.join('، '));
    if (lastVital && lastVital.spo2 && lastVital.spo2 < 92) situation.push('SpO2 ' + lastVital.spo2 + '%');

    patients.push({
      patientId: pid,
      patientName: p.firstName + ' ' + p.lastName,
      wardCode: p.wardCode,
      bedNumber: p.bedNumber,
      severity,
      news2,
      ipass: {
        illness: severity,
        patientSummary: summary,
        actionList: actions,
        situationAwareness: situation.join(' · ')
      }
    });
  }

  const signout = {
    id: ctx.uid('sout'),
    fromUserId: ctx.actor.id,
    fromUserName: ctx.actor.fullName || ctx.actor.username,
    toUserId: b.toUserId,
    toUserName: targetUser.fullName || targetUser.username,
    untilShift: b.untilShift,
    patients,
    notes: String(b.notes || '').slice(0, 1000),
    status: 'pending',
    createdAt: ctx.now(),
    acknowledgedAt: null,
    acknowledgedBy: null,
    synthesis: null
  };
  store.put('signouts', signout);

  // Notify receiver
  bus.emit('notification.user', {
    userId: b.toUserId,
    title: '📋 Sign-out از ' + signout.fromUserName,
    message: patients.length + ' بیمار · تا شیفت ' + b.untilShift,
    signoutId: signout.id
  });

  ctx.audit.write('care_team', 'signout.created', signout.id, ctx.actor, {
    patients: patients.length, to: b.toUserId
  });
  bus.emit('care_team.signout.created', { signout, actor: ctx.actor });

  return signout;
}

function acknowledgeSignOut(ctx) {
  const b = ctx.body || {};
  const so = store.get('signouts', ctx.params.id);
  if (!so) throw ctx.E.notFound('signout_not_found');
  if (so.toUserId !== ctx.actor.id && ctx.actor.role !== 'admin') {
    throw ctx.E.forbidden('not_receiver');
  }
  if (so.status !== 'pending') throw ctx.E.conflict('already_' + so.status);

  so.status = 'acknowledged';
  so.acknowledgedAt = ctx.now();
  so.acknowledgedBy = ctx.actor.id;
  so.synthesis = String(b.synthesis || '').slice(0, 500);
  store.put('signouts', so);

  ctx.audit.write('care_team', 'signout.acknowledged', so.id, ctx.actor, {
    hasSynthesis: !!so.synthesis
  });
  bus.emit('care_team.signout.acknowledged', { signout: so, actor: ctx.actor });

  return so;
}

function listSignOuts(ctx) {
  const type = ctx.query.type || 'received';
  let items = store.readAll('signouts');
  if (type === 'received') {
    items = items.filter(s => s.toUserId === ctx.actor.id);
  } else if (type === 'sent') {
    items = items.filter(s => s.fromUserId === ctx.actor.id);
  } else if (type === 'pending') {
    items = items.filter(s => s.status === 'pending' && s.toUserId === ctx.actor.id);
  }
  items.sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  return { items: items.slice(0, 50), total: items.length };
}

// ═══════════════════════════════════════════════════════════
//  My Patients (for a given user)
// ═══════════════════════════════════════════════════════════
function myPatients(ctx) {
  const teams = store.readAll('care_teams');
  const myTeams = teams.filter(t =>
    t.members && t.members.some(m => m.userId === ctx.actor.id)
  );

  const pids = new Set(myTeams.map(t => t.patientId));
  const patients = store.readAll('patients')
    .filter(p => pids.has(p.id) && ['in_care','admitted'].includes(p.status));

  const vitals = store.readAll('vitals');
  const lastVital = {};
  for (const v of vitals) {
    if (!lastVital[v.patientId] || sd(v.recordedAt) > sd(lastVital[v.patientId].recordedAt)) {
      lastVital[v.patientId] = v;
    }
  }

  const roleInTeam = {};
  for (const t of myTeams) {
    const m = t.members.find(m => m.userId === ctx.actor.id);
    if (m) roleInTeam[t.patientId] = m.roleFa || m.role;
  }

  return {
    items: patients.map(p => {
      const v = lastVital[p.id] || {};
      return {
        id: p.id,
        name: p.firstName + ' ' + p.lastName,
        wardCode: p.wardCode, bedNumber: p.bedNumber,
        diagnosis: p.diagnosis,
        age: p.age,
        news2: Number(v.news2) || 0,
        roleInTeam: roleInTeam[p.id] || null
      };
    }).sort((a, b) => b.news2 - a.news2),
    total: patients.length
  };
}

module.exports = {
  handlers: {
    getTeam, assignMember, removeMember,
    getThread, postMessage,
    createSignOut, acknowledgeSignOut, listSignOuts,
    myPatients
  },
  routes: [
    { method:'GET',    path:'/api/team/my-patients',                           handler:'myPatients',        perm:'care_team.view' },
    { method:'GET',    path:'/api/team/:patientId',                            handler:'getTeam',           perm:'care_team.view' },
    { method:'POST',   path:'/api/team/:patientId/member',                     handler:'assignMember',      perm:'care_team.manage' },
    { method:'DELETE', path:'/api/team/:patientId/member/:memberId',           handler:'removeMember',      perm:'care_team.manage' },
    { method:'GET',    path:'/api/team/:patientId/thread',                     handler:'getThread',         perm:'care_team.view' },
    { method:'POST',   path:'/api/team/:patientId/thread',                     handler:'postMessage',       perm:'care_team.post' },
    { method:'POST',   path:'/api/team/signout',                               handler:'createSignOut',     perm:'care_team.signout' },
    { method:'GET',    path:'/api/team/signouts',                              handler:'listSignOuts',      perm:'care_team.view' },
    { method:'POST',   path:'/api/team/signout/:id/acknowledge',               handler:'acknowledgeSignOut', perm:'care_team.view' },
  ],
  panels: [
    { id:'my_patients', title:'بیماران تیم من', icon:'👥', perm:'care_team.view',
      kind:'team_my_patients', api:'/api/team/my-patients' }
  ]
};

console.log('[care-team] loaded — team + discussion + I-PASS sign-out');
