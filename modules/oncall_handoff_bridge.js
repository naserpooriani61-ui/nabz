
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — On-Call Handoff Bridge
//  Integrates I-PASS sign-out with on-call coverage
//  - Smart routing by service
//  - Coverage gap detection
//  - 3-level escalation (15/30/60 min)
//  - My pending handoffs
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const store = require('../core/store');
const bus = require('../core/events');
const perms = require('../core/permissions');
const resolver = require('../core/ward-resolver');
const careTeam = require('./care_team');

if (!perms.P['oncall_handoff.view']) {
  perms.P['oncall_handoff.view'] = 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,attending,specialist,surgeon,resident,physician,nurse,head_nurse';
  perms.P['oncall_handoff.create'] = 'admin,attending,specialist,surgeon,resident,physician';
}

function currentShift() {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 14) return 'morning';
  if (hour >= 14 && hour < 19) return 'evening';
  return 'night';
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function userName(id) {
  if (!id) return null;
  const u = store.get('users', id);
  return u ? (u.fullName || u.username) : null;
}

// ═══════════════════════════════════════════════════════════
//  Part 1: Coverage map
// ═══════════════════════════════════════════════════════════
function coverage(ctx) {
  const month = ctx.query.month || currentMonth();
  const shift = ctx.query.shift || currentShift();
  const oncall = store.readAll('on_call').filter(o => o.month === month && o.shift === shift);

  const services = oncall.map(o => ({
    service: o.service,
    shift: o.shift,
    primaryUserId: o.primaryUserId || null,
    primaryName: userName(o.primaryUserId),
    backupUserId: o.backupUserId || null,
    backupName: userName(o.backupUserId),
    covered: !!(o.primaryUserId || o.backupUserId)
  }));

  const uncovered = services.filter(s => !s.covered);

  return {
    month, shift,
    services: services.sort((a, b) => a.service.localeCompare(b.service)),
    total: services.length,
    coveredCount: services.filter(s => s.covered).length,
    uncoveredCount: uncovered.length,
    uncoveredServices: uncovered.map(s => s.service),
    checkedAt: ctx.now()
  };
}

// ═══════════════════════════════════════════════════════════
//  Part 2: Smart sign-out (auto-route by service)
// ═══════════════════════════════════════════════════════════
function smartSignOut(ctx) {
  const b = ctx.body || {};
  if (!Array.isArray(b.patientIds) || b.patientIds.length === 0) {
    throw ctx.E.badRequest('patient_ids_required');
  }

  const month = currentMonth();
  const shift = b.shift || currentShift();
  const untilShift = b.untilShift || shift;

  // Group patients by service
  const byService = {};
  const skipped = [];
  for (const pid of b.patientIds) {
    const p = store.get('patients', pid);
    if (!p) { skipped.push({ patientId: pid, reason: 'not_found' }); continue; }
    const svc = p.serviceCode || (resolver.serviceForWard ? resolver.serviceForWard(p.wardCode) : null) || 'unknown';
    if (!byService[svc]) byService[svc] = [];
    byService[svc].push(p);
  }

  // Find on-call for each service
  const routed = [];
  const unrouted = [];
  const oncallAll = store.readAll('on_call').filter(o => o.month === month && o.shift === shift);

  for (const [svc, patients] of Object.entries(byService)) {
    const entry = oncallAll.find(o => o.service === svc);
    const patientIds = patients.map(p => p.id);

    if (entry && entry.primaryUserId) {
      routed.push({
        service: svc,
        toUserId: entry.primaryUserId,
        toUserName: userName(entry.primaryUserId),
        patientIds, patientCount: patients.length,
        isBackup: false
      });
    } else if (entry && entry.backupUserId) {
      routed.push({
        service: svc,
        toUserId: entry.backupUserId,
        toUserName: userName(entry.backupUserId),
        patientIds, patientCount: patients.length,
        isBackup: true
      });
    } else {
      unrouted.push({
        service: svc,
        patientIds, patientCount: patients.length,
        patients: patients.map(p => ({ id: p.id, name: p.firstName + ' ' + p.lastName }))
      });
    }
  }

  // Escalate unrouted to supervisor
  const escalations = [];
  if (unrouted.length > 0) {
    const supervisor = store.readAll('users').find(u =>
      ['supervisor_senior', 'supervisor_clinical', 'nursing_director', 'medical_director'].includes(u.role) &&
      u.active !== false
    );

    for (const u of unrouted) {
      if (supervisor) {
        routed.push({
          service: u.service,
          toUserId: supervisor.id,
          toUserName: userName(supervisor.id),
          patientIds: u.patientIds,
          patientCount: u.patientCount,
          isBackup: false,
          isEscalated: true,
          reason: 'no_oncall_for_' + u.service
        });
        escalations.push({
          service: u.service,
          to: userName(supervisor.id),
          patientCount: u.patientCount,
          reason: 'no_oncall_for_' + u.service
        });
      } else {
        skipped.push({ service: u.service, reason: 'no_supervisor_available' });
      }
    }
  }

  // Create sign-outs
  const created = [];
  for (const route of routed) {
    try {
      const so = careTeam.handlers.createSignOut({
        ...ctx,
        body: {
          patientIds: route.patientIds,
          toUserId: route.toUserId,
          untilShift,
          notes: (b.notes || '') +
            (route.isBackup ? ' [BACKUP-ROUTED]' : '') +
            (route.isEscalated ? ' [ESCALATED: ' + route.reason + ']' : '')
        }
      });
      so._routedBy = 'auto';
      so._service = route.service;
      store.put('signouts', so);
      created.push({
        id: so.id,
        service: route.service,
        toUserId: route.toUserId,
        toUserName: route.toUserName,
        patientCount: route.patientCount,
        isBackup: route.isBackup,
        isEscalated: route.isEscalated || false
      });
    } catch (e) {
      skipped.push({ service: route.service, reason: e.message || String(e) });
    }
  }

  ctx.audit.write('oncall_handoff_bridge', 'smart_signout', 'batch', ctx.actor, {
    routed: routed.length, unrouted: unrouted.length, created: created.length, escalated: escalations.length
  });

  return {
    month, shift,
    created,
    escalations,
    unroutedServices: unrouted.map(u => ({ service: u.service, patientCount: u.patientCount })),
    skipped,
    totalCreated: created.length,
    totalPatients: created.reduce((s, c) => s + c.patientCount, 0)
  };
}

// ═══════════════════════════════════════════════════════════
//  Part 3: My pending handoffs
// ═══════════════════════════════════════════════════════════
function myPending(ctx) {
  const items = store.readAll('signouts').filter(s =>
    s.toUserId === ctx.actor.id && s.status === 'pending'
  ).sort((a, b) => sd(b.createdAt) - sd(a.createdAt));

  return {
    items: items.map(s => ({
      id: s.id,
      fromUserId: s.fromUserId,
      fromUserName: s.fromUserName,
      patientCount: (s.patients || []).length,
      patients: (s.patients || []).map(p => ({
        patientId: p.patientId,
        patientName: p.patientName,
        severity: p.severity,
        news2: p.news2
      })),
      untilShift: s.untilShift,
      createdAt: s.createdAt,
      ageMinutes: Math.round((Date.now() - sd(s.createdAt)) / 60000),
      escalations: s._escalations || []
    })),
    total: items.length
  };
}

// ═══════════════════════════════════════════════════════════
//  Part 4: My coverage (which services am I on-call for?)
// ═══════════════════════════════════════════════════════════
function myCoverage(ctx) {
  const month = ctx.query.month || currentMonth();
  const shift = ctx.query.shift || currentShift();
  const all = store.readAll('on_call').filter(o => o.month === month && o.shift === shift);

  const mine = all.filter(o =>
    o.primaryUserId === ctx.actor.id || o.backupUserId === ctx.actor.id
  ).map(o => ({
    service: o.service,
    role: o.primaryUserId === ctx.actor.id ? 'primary' : 'backup',
    shift: o.shift,
    month: o.month
  }));

  return {
    actor: { id: ctx.actor.id, name: ctx.actor.fullName || ctx.actor.username, role: ctx.actor.role },
    month, shift,
    services: mine,
    total: mine.length,
    isOnCall: mine.length > 0
  };
}

// ═══════════════════════════════════════════════════════════
//  Part 5: Escalation timer (15/30/60 min)
// ═══════════════════════════════════════════════════════════
function checkEscalations() {
  const now = Date.now();
  let escalated = 0;
  const signouts = store.readAll('signouts').filter(s => s.status === 'pending');

  for (const so of signouts) {
    const ageMin = (now - sd(so.createdAt)) / 60000;
    if (!Array.isArray(so._escalations)) so._escalations = [];
    let dirty = false;

    // Level 1: 15 min → notify backup on-call
    if (ageMin >= 15 && so._escalations.indexOf('backup') < 0) {
      so._escalations.push('backup');
      dirty = true;
      escalated++;
      bus.emit('care_team.signout.escalation', {
        signout: so, level: 'backup', ageMin: Math.round(ageMin)
      });
    }

    // Level 2: 30 min → notify supervisor
    if (ageMin >= 30 && so._escalations.indexOf('supervisor') < 0) {
      so._escalations.push('supervisor');
      dirty = true;
      escalated++;
      const sup = store.readAll('users').find(u =>
        ['supervisor_senior', 'supervisor_clinical'].includes(u.role) && u.active !== false
      );
      if (sup) {
        bus.emit('notification.user', {
          userId: sup.id,
          title: '⚠️ Sign-out بدون تأیید ۳۰ دقیقه',
          message: so.fromUserName + ' → ' + so.toUserName + ' (' + (so.patients || []).length + ' بیمار)',
          signoutId: so.id,
          severity: 'urgent'
        });
      }
    }

    // Level 3: 60 min → director
    if (ageMin >= 60 && so._escalations.indexOf('director') < 0) {
      so._escalations.push('director');
      dirty = true;
      escalated++;
      const dir = store.readAll('users').find(u =>
        ['nursing_director', 'medical_director', 'hospital_director'].includes(u.role) && u.active !== false
      );
      if (dir) {
        bus.emit('notification.user', {
          userId: dir.id,
          title: '🚨 Sign-out بدون تأیید ۱ ساعت',
          message: so.fromUserName + ' → ' + so.toUserName + ' — مداخله فوری',
          signoutId: so.id,
          severity: 'critical'
        });
      }
      so._criticalEscalation = true;
    }

    if (dirty) store.put('signouts', so);
  }

  if (escalated > 0) {
    console.log('[oncall-bridge] escalated ' + escalated + ' signouts');
  }
}

// ═══════════════════════════════════════════════════════════
//  Part 6: Overview dashboard
// ═══════════════════════════════════════════════════════════
function dashboard(ctx) {
  const cov = coverage(ctx);
  const mine = myCoverage(ctx);
  const pending = myPending(ctx);

  const allSignouts = store.readAll('signouts');
  const pendingTotal = allSignouts.filter(s => s.status === 'pending').length;
  const acknowledgedLast24 = allSignouts.filter(s =>
    s.status === 'acknowledged' && sd(s.acknowledgedAt) > Date.now() - 86400000
  ).length;

  return {
    coverage: cov,
    my: mine,
    myPending: pending,
    stats: {
      totalPending: pendingTotal,
      acknowledged24h: acknowledgedLast24,
      servicesWithoutCover: cov.uncoveredCount
    },
    generatedAt: ctx.now()
  };
}

// ═══ Start escalation timer ═══
let _timerStarted = false;
function startTimer() {
  if (_timerStarted) return;
  _timerStarted = true;
  setTimeout(function() {
    checkEscalations();
    setInterval(checkEscalations, 5 * 60 * 1000);
    console.log('[oncall-bridge] escalation timer started (5-min cycles)');
  }, 45000);
}
startTimer();

module.exports = {
  handlers: {
    coverage, smartSignOut, myPending, myCoverage, dashboard,
    _checkEscalations: checkEscalations
  },
  routes: [
    { method:'GET',  path:'/api/oncall/handoff/coverage',  handler:'coverage',     perm:'oncall_handoff.view' },
    { method:'POST', path:'/api/oncall/handoff/smart',     handler:'smartSignOut', perm:'oncall_handoff.create' },
    { method:'GET',  path:'/api/oncall/handoff/my-pending', handler:'myPending',   perm:'oncall_handoff.view' },
    { method:'GET',  path:'/api/oncall/handoff/my',        handler:'myCoverage',   perm:'oncall_handoff.view' },
    { method:'GET',  path:'/api/oncall/handoff/dashboard', handler:'dashboard',    perm:'oncall_handoff.view' }
  ],
  panels: [
    { id:'dashboard', title:'On-Call Handoffs', icon:'📋', perm:'oncall_handoff.view',
      kind:'oncall_dashboard', api:'/api/oncall/handoff/dashboard' }
  ]
};

console.log('[oncall-handoff-bridge] loaded — smart-routing + escalation timer');
