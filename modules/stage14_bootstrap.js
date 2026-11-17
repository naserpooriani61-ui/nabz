
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Stage 14 Bootstrap (v2 — BATCHED)
//  Fix: single write per collection (not per record)
//  Fix: defer migration via setTimeout (server starts first)
// ═══════════════════════════════════════════════════════════
const store = require('../core/store');
const resolver = require('../core/ward-resolver');

const MIGRATION_VERSION = 'stage14_v2';
const MARKER_KEY = '_migration_stage14';

function isAlreadyMigrated() {
  const marker = store.readAll(MARKER_KEY)[0];
  return !!(marker && (marker.version === MIGRATION_VERSION || marker.version === 'stage14_v1'));
}

function migrate() {
  const t0 = Date.now();
  console.log('[stage14] ═══ MIGRATION v2 START ═══');

  if (isAlreadyMigrated()) {
    const marker = store.readAll(MARKER_KEY)[0];
    console.log('[stage14] ✅ Already migrated:', marker.completedAt, '(v:', marker.version + ')');
    return { alreadyDone: true, report: marker.report };
  }

  const report = {
    startAt: new Date().toISOString(),
    version: MIGRATION_VERSION,
    users: { total: 0, wardFixed: 0, wardUnresolved: 0, servicesAdded: 0, mustChangePasswordSet: 0 },
    patients: { total: 0, serviceCodeSet: 0, serviceCodeUnresolved: 0 },
    onCall: { slotsInitialized: 0 }
  };

  // ═══ USERS — batch, single save ═══
  console.log('[stage14] Processing users...');
  const users = store.readAll('users');
  report.users.total = users.length;
  const unresolved = [];
  let dirty = false;

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    let changed = false;

    const resolvedWard = resolver.resolveUserWard(u);
    if (resolvedWard) {
      if (u.ward !== resolvedWard) {
        u.ward = resolvedWard;
        u.wardFixedAt = new Date().toISOString();
        report.users.wardFixed++;
        changed = true;
      }
    } else if (!u.ward) {
      unresolved.push({ id: u.id, username: u.username, role: u.role });
      report.users.wardUnresolved++;
    }

    const services = resolver.resolveUserServices(u, resolvedWard);
    if (services.length) {
      const current = Array.isArray(u.services) ? u.services : [];
      const merged = Array.from(new Set([...current, ...services]));
      if (merged.length !== current.length) {
        u.services = merged;
        report.users.servicesAdded++;
        changed = true;
      }
    }

    if (u.plainHint && u.plainHint.startsWith('Sin@') && !u.passwordChangedAt && !u.mustChangePassword) {
      u.mustChangePassword = true;
      report.users.mustChangePasswordSet++;
      changed = true;
    }

    if (changed) dirty = true;

    if ((i + 1) % 200 === 0) {
      console.log('[stage14]   progress: ' + (i + 1) + '/' + users.length + ' · fixed=' + report.users.wardFixed + ' · null=' + report.users.wardUnresolved);
    }
  }

  if (dirty) {
    store.saveAll('users', users);
    console.log('[stage14] ✅ Users batch-saved: ' + report.users.wardFixed + ' fixed');
  }

  // ═══ PATIENTS — batch ═══
  console.log('[stage14] Processing patients...');
  const patients = store.readAll('patients');
  report.patients.total = patients.length;
  let pDirty = false;

  for (const p of patients) {
    if (p.serviceCode) continue;
    const svc = resolver.serviceForPatient(p);
    if (svc) {
      p.serviceCode = svc;
      p.serviceCodeSetAt = new Date().toISOString();
      report.patients.serviceCodeSet++;
      pDirty = true;
    } else {
      report.patients.serviceCodeUnresolved++;
    }
  }

  if (pDirty) {
    store.saveAll('patients', patients);
    console.log('[stage14] ✅ Patients batch-saved: ' + report.patients.serviceCodeSet + ' updated');
  }

  // ═══ ON_CALL ═══
  const existingOnCall = store.readAll('on_call');
  if (existingOnCall.length === 0) {
    const services = ['pulmo','neuro','emergency','internal','cardio','surgery','vascular','maxillofacial','neurosurgery','ortho','urology','transplant','oncology','nephrology','vip','recovery','outpatient','gastro'];
    const now = new Date();
    const monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const slots = [];
    for (const svc of services) {
      for (const shift of ['morning', 'evening', 'night']) {
        slots.push({
          id: 'oncall_' + svc + '_' + monthKey + '_' + shift,
          service: svc, month: monthKey, shift,
          primaryUserId: null, backupUserId: null,
          createdAt: new Date().toISOString(),
          note: 'auto-initialized, admin must assign'
        });
      }
    }
    store.saveAll('on_call', slots);
    report.onCall.slotsInitialized = slots.length;
    console.log('[stage14] ✅ On-call slots: ' + slots.length);
  }

  // ═══ ALERT if many unresolved ═══
  if (unresolved.length > 10) {
    store.saveAll('_admin_alerts', [{
      id: 'stage14_ward_unresolved',
      type: 'critical',
      title: unresolved.length + ' کاربر بدون ward',
      affectedCount: unresolved.length,
      sample: unresolved.slice(0, 20),
      createdAt: new Date().toISOString(),
      resolved: false
    }]);
    console.log('[stage14] ⚠️ Alert: ' + unresolved.length + ' users unresolved');
  }

  report.endAt = new Date().toISOString();
  report.durationMs = Date.now() - t0;

  store.saveAll(MARKER_KEY, [{
    id: 'stage14',
    version: MIGRATION_VERSION,
    completedAt: report.endAt,
    report
  }]);

  console.log('[stage14] ═══ MIGRATION COMPLETE ═══');
  console.log('[stage14]   Duration: ' + report.durationMs + 'ms');
  console.log('[stage14]   Users fixed: ' + report.users.wardFixed + '/' + report.users.total + ' · null: ' + report.users.wardUnresolved);
  console.log('[stage14]   Patients: ' + report.patients.serviceCodeSet + '/' + report.patients.total);
  console.log('[stage14]   mustChangePassword: ' + report.users.mustChangePasswordSet);
  console.log('[stage14]   On-call: ' + report.onCall.slotsInitialized + ' slots');

  return { alreadyDone: false, report };
}

function status(ctx) {
  const marker = store.readAll(MARKER_KEY)[0];
  const alerts = store.readAll('_admin_alerts');
  return {
    migrated: !!marker,
    version: marker ? marker.version : null,
    completedAt: marker ? marker.completedAt : null,
    durationMs: marker && marker.report ? marker.report.durationMs : null,
    report: marker ? marker.report : null,
    unresolvedAlert: alerts.find(a => a.id === 'stage14_ward_unresolved') || null
  };
}

function forceRemigrate(ctx) {
  if (ctx.actor.role !== 'admin') throw ctx.E.forbidden('admin_only');
  store.saveAll(MARKER_KEY, []);
  resolver.invalidateCache();
  return migrate();
}

function listUnresolvedUsers(ctx) {
  const users = store.readAll('users');
  const unresolved = [];
  for (const u of users) {
    if (u.ward) continue;
    if (['admin', 'hospital_director', 'medical_director', 'nursing_director'].includes(u.role)) continue;
    const resolved = resolver.resolveUserWard(u);
    if (!resolved) {
      unresolved.push({ id: u.id, username: u.username, fullName: u.fullName, role: u.role, staffId: u.staffId, source: u.source });
    }
  }
  return { items: unresolved, total: unresolved.length };
}

module.exports = {
  handlers: { status, forceRemigrate, listUnresolvedUsers },
  routes: [
    { method:'GET',  path:'/api/stage14/status', handler:'status', perm:'admin.users.manage' },
    { method:'POST', path:'/api/stage14/remigrate', handler:'forceRemigrate', perm:'admin.users.manage' },
    { method:'GET',  path:'/api/stage14/unresolved', handler:'listUnresolvedUsers', perm:'admin.users.manage' }
  ],
  panels: []
};

// ═══ Run migration AFTER server is listening (deferred) ═══
setTimeout(function() {
  try {
    migrate();
  } catch (e) {
    console.error('[stage14] ❌ Migration failed:', e.message);
    console.error(e.stack);
  }
}, 300);
