
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Stage 15 Operations
//  3 critical gaps:
//   1. Admin: assign wards to unresolved users
//   2. Physician: see all service patients (across wards)
//   3. Admin: on-call assignment board
//  + Self-diagnostics on load
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const store = require('../core/store');
const resolver = require('../core/ward-resolver');
const perms = require('../core/permissions');

// ═══ Permissions ═══
if (!perms.P['admin.ward.assign']) {
  perms.P['admin.ward.assign'] = 'admin,nursing_director,medical_director';
}
if (!perms.P['admin.oncall.manage']) {
  perms.P['admin.oncall.manage'] = 'admin,nursing_director,medical_director,supervisor_senior,supervisor_clinical';
}
if (!perms.P['service.view_own']) {
  perms.P['service.view_own'] = 'admin,hospital_director,medical_director,attending,specialist,surgeon,physician,resident';
}

// ═══ Role → default ward mapping ═══
const ROLE_DEFAULT_WARD = {
  'nurse': 'INT_M',
  'nurse_aide': 'INT_M',
  'head_nurse': 'INT_M',
  'resident': 'INT_M',
  'intern': 'INT_M',
  'attending': 'INT_M',
  'specialist': 'INT_M',
  'physician': 'INT_M',
  'surgeon': 'GEN_SURG14',
  'anesthesiologist': 'OR_GEN',
  'pharmacist': 'NURSING_OFFICE',
  'lab_tech': 'NURSING_OFFICE',
  'radiology_tech': 'NURSING_OFFICE',
  'receptionist': 'NURSING_OFFICE',
  'midwife': 'INT_F'
};

// ═══════════════════════════════════════════════════════════
//  Part 1 — Admin: Unresolved Users
// ═══════════════════════════════════════════════════════════
function unresolvedUsers(ctx) {
  const users = h(ctx, 'users');
  const roleFilter = ctx.query.role;
  const search = (ctx.query.q || '').toLowerCase();

  const unresolved = [];
  for (const u of users) {
    if (u.ward) continue;
    if (['admin','hospital_director','medical_director','nursing_director'].includes(u.role)) continue;
    if (roleFilter && u.role !== roleFilter) continue;
    if (search &&
        !(u.username || '').toLowerCase().includes(search) &&
        !(u.fullName || '').toLowerCase().includes(search)) continue;

    // Try one more time
    let suggested = null;
    try {
      const r = resolver.resolveUserWard(u);
      if (r) suggested = r;
    } catch (_) {}
    if (!suggested) suggested = ROLE_DEFAULT_WARD[u.role] || null;

    unresolved.push({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      role: u.role,
      staffId: u.staffId,
      source: u.source,
      active: u.active !== false,
      mustChangePassword: !!u.mustChangePassword,
      suggestedWard: suggested,
      canAutoFix: !!suggested
    });
  }

  const byRole = {};
  for (const u of unresolved) byRole[u.role] = (byRole[u.role] || 0) + 1;

  return {
    items: unresolved,
    total: unresolved.length,
    autoFixable: unresolved.filter(u => u.canAutoFix).length,
    byRole,
    generatedAt: new Date().toISOString()
  };
}

function suggestWard(ctx) {
  const userId = ctx.params.userId;
  const user = store.get('users', userId);
  if (!user) throw ctx.E.notFound('user_not_found');

  // Try resolver first (from sa_staff/wf_staff)
  let resolved = null;
  try {
    resolved = resolver.resolveUserWard(user);
  } catch (_) {}

  if (resolved) {
    return {
      userId, wardCode: resolved, source: 'staff_lookup',
      confidence: 'high',
      reason: 'یافت شد از sa_staff/wf_staff'
    };
  }

  // Fallback to role default
  const defaultWard = ROLE_DEFAULT_WARD[user.role];
  if (defaultWard) {
    return {
      userId, wardCode: defaultWard, source: 'role_default',
      confidence: 'low',
      reason: 'پیش‌فرض بر اساس نقش — نیازمند تأیید'
    };
  }

  return { userId, wardCode: null, source: 'none', confidence: 'none', reason: 'نمی‌توان تعیین کرد' };
}

function assignWard(ctx) {
  const userId = ctx.params.userId;
  const b = ctx.body || {};
  if (!b.wardCode) throw ctx.E.badRequest('ward_code_required');

  const user = store.get('users', userId);
  if (!user) throw ctx.E.notFound('user_not_found');

  if (!resolver.isRealWardCode(b.wardCode)) {
    throw ctx.E.badRequest('invalid_ward:' + b.wardCode);
  }

  user.ward = b.wardCode;
  user.wardAssignedAt = new Date().toISOString();
  user.wardAssignedBy = ctx.actor.id;
  user.wardAssignedByName = ctx.actor.fullName || ctx.actor.username;

  // Add service
  const svc = resolver.serviceForWard(b.wardCode);
  if (svc) {
    const current = Array.isArray(user.services) ? user.services.slice() : [];
    if (!current.includes(svc)) current.push(svc);
    user.services = current;
  }

  store.put('users', user);
  ctx.audit.write('stage15_ops', 'ward.assign', userId, ctx.actor, {
    ward: b.wardCode, services: user.services
  });

  return {
    user: {
      id: user.id, username: user.username, fullName: user.fullName,
      ward: user.ward, services: user.services
    }
  };
}

function bulkAssignWard(ctx) {
  const b = ctx.body || {};
  if (!Array.isArray(b.assignments)) throw ctx.E.badRequest('assignments_array_required');

  const results = { success: 0, failed: 0, errors: [] };
  const users = store.readAll('users');
  const userMap = new Map(users.map(u => [u.id, u]));

  for (const a of b.assignments) {
    if (!a.userId || !a.wardCode) {
      results.failed++;
      results.errors.push({ userId: a.userId, error: 'missing_fields' });
      continue;
    }
    const user = userMap.get(a.userId);
    if (!user) {
      results.failed++;
      results.errors.push({ userId: a.userId, error: 'user_not_found' });
      continue;
    }
    if (!resolver.isRealWardCode(a.wardCode)) {
      results.failed++;
      results.errors.push({ userId: a.userId, error: 'invalid_ward' });
      continue;
    }
    user.ward = a.wardCode;
    user.wardAssignedAt = new Date().toISOString();
    user.wardAssignedBy = ctx.actor.id;
    const svc = resolver.serviceForWard(a.wardCode);
    if (svc) {
      const cur = Array.isArray(user.services) ? user.services.slice() : [];
      if (!cur.includes(svc)) cur.push(svc);
      user.services = cur;
    }
    results.success++;
  }

  // Batch save
  store.saveAll ? store.saveAll('users', users) : users.forEach(u => store.put('users', u));

  ctx.audit.write('stage15_ops', 'ward.bulk_assign', 'bulk', ctx.actor, {
    success: results.success, failed: results.failed
  });

  return results;
}

// ═══════════════════════════════════════════════════════════
//  Part 2 — Service Patients (for physicians)
// ═══════════════════════════════════════════════════════════
function myServicePatients(ctx) {
  const user = ctx.actor;
  let userServices = [];
  try {
    userServices = resolver.resolveUserServices(user);
  } catch (_) {}

  if (!userServices.length) {
    return {
      services: [],
      items: [],
      total: 0,
      requiresConfig: true,
      message: 'شما به هیچ سرویسی تخصیص نیافته‌اید. با مدیر سیستم تماس بگیرید.'
    };
  }

  const patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  const vitals = h(ctx, 'vitals');
  const lastVital = {};
  for (const v of vitals) {
    if (!lastVital[v.patientId] || sd(v.recordedAt) > sd(lastVital[v.patientId].recordedAt)) {
      lastVital[v.patientId] = v;
    }
  }

  const svcSet = new Set(userServices);
  const myPatients = patients
    .map(p => {
      const svc = p.serviceCode || (resolver.serviceForWard ? resolver.serviceForWard(p.wardCode) : null);
      if (!svc || !svcSet.has(svc)) return null;
      const v = lastVital[p.id] || {};
      return {
        id: p.id,
        name: p.firstName + ' ' + p.lastName,
        age: p.age, sex: p.sex,
        wardCode: p.wardCode, bedNumber: p.bedNumber,
        serviceCode: svc,
        diagnosis: p.diagnosis,
        codeStatus: p.codeStatus,
        admittedAt: p.admittedAt,
        news2: Number(v.news2) || 0,
        lastVitalAt: v.recordedAt || null
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.news2 - a.news2);

  // Group by service then ward
  const byService = {};
  for (const p of myPatients) {
    if (!byService[p.serviceCode]) byService[p.serviceCode] = { byWard: {}, total: 0, critical: 0 };
    byService[p.serviceCode].total++;
    if (p.news2 >= 7) byService[p.serviceCode].critical++;
    if (!byService[p.serviceCode].byWard[p.wardCode]) byService[p.serviceCode].byWard[p.wardCode] = [];
    byService[p.serviceCode].byWard[p.wardCode].push(p);
  }

  return {
    services: userServices,
    items: myPatients,
    total: myPatients.length,
    byService,
    stats: {
      total: myPatients.length,
      critical: myPatients.filter(p => p.news2 >= 7).length,
      high: myPatients.filter(p => p.news2 >= 5 && p.news2 < 7).length,
      wardsCovered: [...new Set(myPatients.map(p => p.wardCode))].length
    },
    generatedAt: new Date().toISOString()
  };
}

// ═══════════════════════════════════════════════════════════
//  Part 3 — On-Call Board
// ═══════════════════════════════════════════════════════════
function getOnCall(ctx) {
  const month = ctx.query.month || new Date().toISOString().slice(0, 7);
  const service = ctx.query.service;

  let items = h(ctx, 'on_call').filter(o => o.month === month);
  if (service) items = items.filter(o => o.service === service);

  const users = h(ctx, 'users');
  const userMap = new Map(users.map(u => [u.id, u]));

  // Enrich
  const enriched = items.map(o => {
    const primary = o.primaryUserId ? userMap.get(o.primaryUserId) : null;
    const backup = o.backupUserId ? userMap.get(o.backupUserId) : null;
    return {
      id: o.id, service: o.service, month: o.month, shift: o.shift,
      primaryUserId: o.primaryUserId || null,
      primaryName: primary ? (primary.fullName || primary.username) : null,
      backupUserId: o.backupUserId || null,
      backupName: backup ? (backup.fullName || backup.username) : null,
      updatedAt: o.updatedAt || null,
      isAssigned: !!(o.primaryUserId || o.backupUserId)
    };
  });

  // Group by service, sort by shift order
  const shiftOrder = { morning: 0, evening: 1, night: 2 };
  enriched.sort((a, b) => {
    if (a.service !== b.service) return a.service.localeCompare(b.service);
    return shiftOrder[a.shift] - shiftOrder[b.shift];
  });

  const coverage = {
    total: enriched.length,
    assigned: enriched.filter(x => x.isAssigned).length,
    unassigned: enriched.filter(x => !x.isAssigned).length,
    services: [...new Set(enriched.map(x => x.service))]
  };

  return {
    items: enriched,
    total: enriched.length,
    month,
    service: service || 'all',
    coverage,
    generatedAt: new Date().toISOString()
  };
}

function assignOnCall(ctx) {
  const b = ctx.body || {};
  if (!b.service || !b.month || !b.shift) {
    throw ctx.E.badRequest('service_month_shift_required');
  }
  if (!['morning','evening','night'].includes(b.shift)) {
    throw ctx.E.badRequest('invalid_shift');
  }

  const id = 'oncall_' + b.service + '_' + b.month + '_' + b.shift;
  let rec = store.get('on_call', id);
  if (!rec) {
    rec = { id, service: b.service, month: b.month, shift: b.shift,
      createdAt: new Date().toISOString() };
  }

  if (b.primaryUserId !== undefined) {
    if (b.primaryUserId) {
      const u = store.get('users', b.primaryUserId);
      if (!u) throw ctx.E.notFound('primary_user_not_found');
    }
    rec.primaryUserId = b.primaryUserId || null;
  }
  if (b.backupUserId !== undefined) {
    if (b.backupUserId) {
      const u = store.get('users', b.backupUserId);
      if (!u) throw ctx.E.notFound('backup_user_not_found');
    }
    rec.backupUserId = b.backupUserId || null;
  }

  rec.updatedAt = new Date().toISOString();
  rec.updatedBy = ctx.actor.id;
  rec.updatedByName = ctx.actor.fullName || ctx.actor.username;

  store.put('on_call', rec);
  ctx.audit.write('stage15_ops', 'oncall.assign', id, ctx.actor, {
    service: b.service, shift: b.shift
  });
  return rec;
}

// ═══ Auto-fill on-call from available staff ═══
function autoFillOnCall(ctx) {
  const b = ctx.body || {};
  const month = b.month || new Date().toISOString().slice(0, 7);
  const services = ['pulmo','neuro','emergency','internal','cardio','surgery','vascular',
    'maxillofacial','neurosurgery','ortho','urology','transplant','oncology',
    'nephrology','vip','recovery','outpatient','gastro'];

  const users = h(ctx, 'users').filter(u => u.active !== false && u.ward);
  const usersByService = {};
  for (const u of users) {
    if (!['attending','specialist','surgeon','physician','resident'].includes(u.role)) continue;
    const svcs = Array.isArray(u.services) ? u.services : [];
    for (const s of svcs) {
      if (!usersByService[s]) usersByService[s] = [];
      usersByService[s].push(u);
    }
  }

  let filled = 0, skipped = 0;
  const details = [];

  for (const service of services) {
    const pool = usersByService[service] || [];
    for (const shift of ['morning','evening','night']) {
      const id = 'oncall_' + service + '_' + month + '_' + shift;
      const existing = store.get('on_call', id);
      if (existing && existing.primaryUserId) { skipped++; continue; }
      if (!pool.length) { details.push({ service, shift, error: 'no_staff' }); continue; }

      // Rotate: pick based on hash of service+shift to distribute fairly
      const idx = (service.length + shift.length) % pool.length;
      const primary = pool[idx];
      const backup = pool[(idx + 1) % pool.length];

      const rec = existing || { id, service, month, shift, createdAt: new Date().toISOString() };
      rec.primaryUserId = primary.id;
      rec.backupUserId = backup.id !== primary.id ? backup.id : null;
      rec.autoFilled = true;
      rec.autoFilledAt = new Date().toISOString();
      rec.updatedAt = new Date().toISOString();
      rec.updatedBy = ctx.actor.id;
      store.put('on_call', rec);
      filled++;
    }
  }

  ctx.audit.write('stage15_ops', 'oncall.autofill', month, ctx.actor, { filled, skipped });
  return { month, filled, skipped, details };
}

// ═══ List services with staff availability ═══
function listServices(ctx) {
  const users = h(ctx, 'users').filter(u => u.active !== false);
  const patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));

  const stats = {};

  function ensure(code) {
    if (!stats[code]) stats[code] = { code, patients: 0, staff: 0, onCall: 0 };
    return stats[code];
  }

  for (const p of patients) {
    const svc = p.serviceCode || (resolver.serviceForWard ? resolver.serviceForWard(p.wardCode) : null);
    if (svc) ensure(svc).patients++;
  }

  for (const u of users) {
    let svcs = [];
    try { svcs = resolver.resolveUserServices(u); } catch (_) {}
    for (const s of svcs) ensure(s).staff++;
  }

  const month = new Date().toISOString().slice(0, 7);
  const onCall = h(ctx, 'on_call').filter(o => o.month === month);
  for (const o of onCall) {
    if (o.primaryUserId) ensure(o.service).onCall++;
  }

  return {
    items: Object.values(stats).sort((a, b) => b.patients - a.patients),
    total: Object.keys(stats).length,
    serviceLabels: {
      pulmo:'ریه', neuro:'اعصاب', emergency:'اورژانس', internal:'داخلی',
      cardio:'قلب', surgery:'جراحی', vascular:'عروق', maxillofacial:'فک و صورت',
      neurosurgery:'جراحی اعصاب', ortho:'ارتوپدی', urology:'اورولوژی',
      transplant:'پیوند', oncology:'آنکولوژی', nephrology:'نفرولوژی',
      vip:'VIP', recovery:'ریکاوری', outpatient:'سرپایی', gastro:'گوارش', admin:'اداری'
    }
  };
}

// ═══ Wards list (for picker) ═══
function listWards(ctx) {
  const wards = resolver.listAllWards ? resolver.listAllWards() : h(ctx, 'sa_wards');
  const WARD_LABELS = {
    ICU_RESP:'ICU ریه', ICU_NEURO:'ICU اعصاب', ICU_ER:'ICU اورژانس',
    ICU_GEN1:'ICU جنرال ۱', ICU_GEN2:'ICU جنرال ۲', CCU:'CCU قلب',
    ER:'اورژانس', GEN_SURG14:'جراحی ۱ و ۴', GEN_SURG2:'جراحی ۲',
    VASC1:'عروق ۱', VASC2:'عروق ۲', MAXFAX:'فک و صورت',
    NSURG_M:'جراحی اعصاب مردان', NSURG_F:'جراحی اعصاب زنان',
    ORTHO_M:'ارتوپدی مردان', ORTHO_F:'ارتوپدی زنان',
    URO1:'اورولوژی ۱', URO2:'اورولوژی ۲', KIDNEY_TX:'پیوند کلیه',
    INT_M:'داخلی مردان', INT_F:'داخلی زنان', NEURO_M:'نورولوژی مردان',
    NEURO_F:'نورولوژی زنان', MS1:'MS ۱', MS2:'MS ۲', MS3:'MS ۳',
    ONCO:'آنکولوژی', DIALYSIS:'دیالیز', CATHLAB:'کت لب', VIP:'VIP',
    OR_GEN:'اتاق عمل جنرال', OR_ER:'اتاق عمل اورژانس',
    CSR:'CSR', CLINIC:'درمانگاه', ENDOSCOPY:'آندوسکوپی', NURSING_OFFICE:'دفتر پرستاری'
  };
  return {
    items: wards.map(w => ({
      code: w.code,
      label: WARD_LABELS[w.code] || w.label || w.code,
      service: resolver.serviceForWard ? resolver.serviceForWard(w.code) : null
    })).sort((a, b) => a.code.localeCompare(b.code)),
    total: wards.length
  };
}

// ═══════════════════════════════════════════════════════════
//  Self-diagnostics on load
// ═══════════════════════════════════════════════════════════
function runSelfDiagnostics() {
  try {
    const users = store.readAll('users');
    const activeUsers = users.filter(u => u.active !== false);
    const withWard = activeUsers.filter(u => u.ward).length;
    const withoutWard = activeUsers.length - withWard;
    const mustChange = activeUsers.filter(u => u.mustChangePassword).length;

    const patients = store.readAll('patients').filter(p => ['in_care','admitted'].includes(p.status));
    const patientsWithSvc = patients.filter(p => p.serviceCode).length;

    const onCall = store.readAll('on_call');
    const onCallAssigned = onCall.filter(o => o.primaryUserId).length;

    console.log('[stage15-ops] ═══ SELF-DIAGNOSTICS ═══');
    console.log('[stage15-ops]   Users: ' + activeUsers.length + ' active · ' +
      withWard + ' with ward · ' + withoutWard + ' unresolved · ' +
      mustChange + ' must change password');
    console.log('[stage15-ops]   Patients: ' + patients.length + ' active · ' +
      patientsWithSvc + ' with serviceCode');
    console.log('[stage15-ops]   On-call: ' + onCallAssigned + '/' + onCall.length + ' slots assigned');

    const health = {
      ok: withoutWard < activeUsers.length * 0.15,
      warnings: []
    };
    if (withoutWard > 10) health.warnings.push(withoutWard + ' users without ward');
    if (mustChange > activeUsers.length * 0.8) health.warnings.push(mustChange + ' users must change password');
    if (onCallAssigned < onCall.length * 0.5) health.warnings.push('On-call under-assigned');

    if (health.ok && !health.warnings.length) {
      console.log('[stage15-ops]   Status: ✅ HEALTHY');
    } else {
      console.log('[stage15-ops]   Status: ⚠️ NEEDS ATTENTION');
      for (const w of health.warnings) console.log('[stage15-ops]      • ' + w);
    }
  } catch (e) {
    console.error('[stage15-ops] diagnostics error:', e.message);
  }
}

// Run after boot
setTimeout(runSelfDiagnostics, 2000);

// ═══════════════════════════════════════════════════════════
//  Exports
// ═══════════════════════════════════════════════════════════
module.exports = {
  handlers: {
    unresolvedUsers, suggestWard, assignWard, bulkAssignWard,
    myServicePatients,
    getOnCall, assignOnCall, autoFillOnCall,
    listServices, listWards,
    selfDiagnostics: () => { runSelfDiagnostics(); return { ok: true }; }
  },
  routes: [
    // Admin: Ward assignment
    { method:'GET',  path:'/api/admin/ops/unresolved-users', handler:'unresolvedUsers', perm:'admin.ward.assign' },
    { method:'GET',  path:'/api/admin/ops/suggest-ward/:userId', handler:'suggestWard', perm:'admin.ward.assign' },
    { method:'POST', path:'/api/admin/ops/assign-ward/:userId', handler:'assignWard', perm:'admin.ward.assign' },
    { method:'POST', path:'/api/admin/ops/bulk-assign-ward', handler:'bulkAssignWard', perm:'admin.ward.assign' },
    { method:'GET',  path:'/api/admin/ops/wards', handler:'listWards', perm:'admin.ward.assign' },

    // Clinical: My service patients
    { method:'GET',  path:'/api/clinical/ops/my-service-patients', handler:'myServicePatients', perm:'service.view_own' },

    // Admin: On-call
    { method:'GET',  path:'/api/admin/ops/on-call', handler:'getOnCall', perm:'admin.oncall.manage' },
    { method:'POST', path:'/api/admin/ops/on-call', handler:'assignOnCall', perm:'admin.oncall.manage' },
    { method:'POST', path:'/api/admin/ops/on-call/autofill', handler:'autoFillOnCall', perm:'admin.oncall.manage' },

    // Admin: Services overview
    { method:'GET',  path:'/api/admin/ops/services', handler:'listServices', perm:'admin.ward.assign' },

    // Self-diagnostics
    { method:'GET',  path:'/api/admin/ops/diagnostics', handler:'selfDiagnostics', perm:'admin.users.manage' }
  ],
  panels: [
    { id:'ward_assign', title:'مدیریت بخش کاربران', icon:'🏷️', perm:'admin.ward.assign',
      kind:'ops_ward_assign', api:'/api/admin/ops/unresolved-users' },
    { id:'on_call', title:'On-Call Board', icon:'📞', perm:'admin.oncall.manage',
      kind:'ops_oncall', api:'/api/admin/ops/on-call' },
    { id:'my_service', title:'بیماران سرویس من', icon:'🩺', perm:'service.view_own',
      kind:'ops_my_service', api:'/api/clinical/ops/my-service-patients' }
  ]
};

console.log('[stage15-ops] loaded — ward assignment + service view + on-call board');
