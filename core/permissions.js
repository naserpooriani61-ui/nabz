'use strict';
const ROLES = {
  admin:{ level:0, crossWard:true },
  hospital_director:{ level:1, crossWard:true },
  medical_director:{ level:1, crossWard:true },
  nursing_director:{ level:1, crossWard:true },
  supervisor_senior:{ level:2, crossWard:true },
  supervisor_clinical:{ level:2, crossWard:true },
  supervisor_er:{ level:2, crossWard:false },
  supervisor_infection:{ level:2, crossWard:true },
  supervisor_accreditation:{ level:2, crossWard:true },
  supervisor_education:{ level:2, crossWard:true },
  head_nurse:{ level:3, crossWard:false },
  attending:{ level:3, crossWard:false },
  specialist:{ level:3, crossWard:false },
  surgeon:{ level:3, crossWard:false },
  anesthesiologist:{ level:3, crossWard:false },
  resident:{ level:4, crossWard:false },
  intern:{ level:5, crossWard:false },
  physician:{ level:3, crossWard:false },
  nurse:{ level:5, crossWard:false },
  nurse_aide:{ level:6, crossWard:false },
  assistant_nurse:{ level:6, crossWard:false },
  pharmacist:{ level:4, crossWard:true },
  lab_tech:{ level:4, crossWard:true },
  radiology_tech:{ level:4, crossWard:true },
  cathlab_tech:{ level:4, crossWard:true },
  receptionist:{ level:6, crossWard:false },
  bed_manager:{ level:3, crossWard:true },
  quality_officer:{ level:3, crossWard:true },
  hr_officer:{ level:3, crossWard:true },
  it_staff:{ level:4, crossWard:true },
  educator:{ level:4, crossWard:true },
  or_manager:{ level:3, crossWard:true },
  cssd_supervisor:{ level:3, crossWard:true }
};
// Default permission matrix (compact)
const P = {
  'patients.view': 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,supervisor_er,head_nurse,attending,specialist,resident,intern,physician,nurse,nurse_aide,receptionist,bed_manager',
  'patients.create': 'admin,receptionist,nurse,head_nurse',
  'patients.update': 'admin,nurse,head_nurse,physician,resident,attending',
  'patients.transfer': 'admin,head_nurse,attending,supervisor_clinical,bed_manager',
  'vitals.view': 'admin,nurse,nurse_aide,head_nurse,physician,resident,intern,attending,specialist,supervisor_clinical,supervisor_er',
  'vitals.create': 'admin,nurse,nurse_aide,head_nurse',
  'kardex.view': 'admin,nurse,head_nurse,physician,resident,intern,attending,specialist,pharmacist,supervisor_clinical',
  'kardex.order.create': 'admin,physician,resident,intern,attending,specialist,surgeon,anesthesiologist',
  'kardex.order.cancel': 'admin,attending,specialist,physician,resident,intern,head_nurse,supervisor_clinical',
  'kardex.order.verify': 'admin,nurse,head_nurse',
  'kardex.order.execute': 'admin,nurse,nurse_aide,head_nurse',
  'kardex.mar.administer': 'admin,nurse',
  'kardex.mar.witness': 'admin,nurse,head_nurse',
  'consult.view': 'admin,nurse,head_nurse,physician,resident,intern,attending,specialist,supervisor_clinical',
  'consult.request': 'admin,physician,resident,intern,attending,specialist',
  'consult.respond': 'admin,resident,attending,specialist',
  'consult.approve': 'admin,attending,specialist',
  'transfer.view': 'admin,head_nurse,nurse,physician,resident,attending,bed_manager,supervisor_clinical',
  'transfer.request': 'admin,physician,resident,attending,head_nurse,nurse',
  'transfer.approve': 'admin,head_nurse,supervisor_clinical',
  'transfer.assign_bed': 'admin,bed_manager,head_nurse',
  'transfer.handover': 'admin,nurse,head_nurse',
  'transfer.complete': 'admin,nurse,head_nurse,bed_manager',
  'ed.view': 'admin,supervisor_er,supervisor_senior,supervisor_clinical,head_nurse,nurse,physician,resident,intern,attending,specialist,supervisor,nurse_aide,receptionist,bed_manager,matron,nursing_director,medical_director,hospital_director,anesthesiologist',
  'ed.triage': 'admin,supervisor_er,nurse,head_nurse',
  'ed.code.activate': 'admin,supervisor_er,physician,resident,attending,nurse,head_nurse',
  'ed.manage': 'admin,supervisor_er,head_nurse',
  'ed.code': 'admin,supervisor_er,physician,resident,attending,nurse,head_nurse',
  'ed.order': 'admin,supervisor_er,physician,resident,attending,nurse,head_nurse',
  'ed.mci.activate': 'admin,supervisor_er,supervisor_senior,medical_director,hospital_director',
  'ed.depart': 'admin,nurse,head_nurse,supervisor_er,physician,attending',
  'ed.cosign': 'admin,attending',
  'ed.pronounce': 'admin,physician,resident,attending',
  'ed.disposition': 'admin,physician,resident,attending',
  'ed.treat': 'admin,physician,resident,attending,specialist,anesthesiologist',
  'ed.register': 'admin,receptionist,nurse,head_nurse,supervisor_er,supervisor',
  'admin.permissions.manage': 'admin',
  'admin.users.manage': 'admin',
  'admin.audit.view': 'admin,hospital_director',
  'neural.view': 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,quality_officer'
};
function can(role, perm) {
  if (role === 'admin') return true;
  const allowed = (P[perm] || '').split(',');
  return allowed.includes(role);
}
function isCrossWard(role) { return !!(ROLES[role] && ROLES[role].crossWard); }
function level(role) { return (ROLES[role] || {}).level ?? 9; }
function scope(user, items, wardField) {
  wardField = wardField || 'wardCode';
  if (!user) return [];
  const resolver = require('./ward-resolver');
  const scopeInfo = resolver.resolveUserScope(user, isCrossWard(user.role));
  if (scopeInfo.kind === 'none') {
    // CRITICAL FIX: Don't silently return empty
    // Set flag on user so UI can show meaningful error
    user._scopeError = scopeInfo.reason;
    { const k = user.id || user.username, now = Date.now(); global.__nabzScopeWarn = global.__nabzScopeWarn || {}; if (!global.__nabzScopeWarn[k] || now - global.__nabzScopeWarn[k] > 60000) { global.__nabzScopeWarn[k] = now; console.warn('[scope] ' + (user.username || user.id) + ' — ' + scopeInfo.reason); } }
    return [];
  }
  return resolver.filterByScope(scopeInfo, items, wardField);
}
function listPerms() {
  return Object.keys(P).map(k => ({ perm: k, roles: P[k].split(',') }));
}
module.exports = { can, isCrossWard, level, scope, listPerms, ROLES, P,
  resolveScope: (user) => require('./ward-resolver').resolveUserScope(user, isCrossWard(user.role)),
  serviceForWard: (code) => require('./ward-resolver').serviceForWard(code) };
