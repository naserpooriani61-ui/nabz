const perms = require('./permissions');
Object.assign(perms.P, {
  'education.view':'admin,nurse,head_nurse,physician,resident,intern,attending,specialist,supervisor_clinical,nursing_director',
  'education.manage':'admin,supervisor_education,attending,specialist,head_nurse',
  'quality.view':'admin,hospital_director,medical_director,nursing_director,supervisor_senior,quality_officer,head_nurse,supervisor_clinical',
  'quality.kpi.manage':'admin,quality_officer,medical_director,nursing_director',
  'quality.pdsa.manage':'admin,quality_officer,head_nurse,supervisor_clinical',
  'quality.rca.manage':'admin,quality_officer,medical_director',
  'quality.audit.manage':'admin,quality_officer,head_nurse',
  'quality.satisfaction.record':'admin,quality_officer,supervisor_clinical,nurse',
  'admin.users.manage':'admin',
  'admin.permissions.manage':'admin',
  'admin.audit.view':'admin,hospital_director',
  'rights.view':'admin,hospital_director,medical_director,nursing_director,supervisor_senior,quality_officer,head_nurse,supervisor_clinical',
  'rights.consent':'admin,physician,resident,attending,specialist,head_nurse',
  'rights.complaint.file':'admin,nurse,head_nurse,receptionist,quality_officer',
  'rights.complaint.resolve':'admin,quality_officer,medical_director',
  'rights.privacy':'admin,supervisor_clinical,head_nurse,quality_officer',
  'rights.education':'admin,nurse,head_nurse',
  'karanneh.coefficient.manage':'admin,nursing_director,medical_director',
  'karanneh.appeal.manage':'admin,nursing_director,medical_director,head_nurse',
  'extras.view':'admin,nurse,nurse_aide,head_nurse,physician,resident,intern,attending',
  'extras.manage':'admin,head_nurse,supervisor_clinical,nursing_director',
  'qr.view':'admin,nurse,nurse_aide,head_nurse,physician,resident,intern,attending,supervisor_clinical',
  'qr.scan':'admin,nurse,nurse_aide,head_nurse,physician,resident,intern,attending,specialist'
});
Object.assign(perms.P, {
  'nursing_report.view':    'admin,nurse,head_nurse,physician,resident,intern,attending,specialist,supervisor_clinical,nursing_director',
  'nursing_report.create':  'admin,nurse,head_nurse',
  'nursing_report.sign':    'admin,nurse,head_nurse',
  'nursing_report.receive': 'admin,nurse,head_nurse'
});

Object.assign(perms.P, {
  'voice.view':   'admin,nurse,head_nurse,physician,resident,intern,attending,specialist,supervisor_clinical,nursing_director',
  'voice.create': 'admin,nurse,head_nurse,physician,resident,intern,attending,specialist',
  'voice.delete': 'admin,nurse,head_nurse,physician,resident,intern,attending,specialist'
});

Object.assign(perms.P, {
  'cdss.view': 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,supervisor_er,head_nurse,attending,specialist,resident,intern,physician,nurse,pharmacist,quality_officer'
});
Object.assign(perms.P, {
  'sa.view': 'admin,matron,supervisor,clinical_supervisor,head_nurse,nurse,shift_staff',
  'sa.request': 'admin,matron,supervisor,clinical_supervisor,head_nurse,nurse,shift_staff',
  'sa.checkin': 'admin,matron,supervisor,clinical_supervisor,head_nurse,nurse,shift_staff',
  'sa.manage': 'admin,matron,head_nurse',
  'sa.solve': 'admin,matron,head_nurse',
  'sa.approve': 'admin,matron',
  'sa.lock': 'admin,matron',
  'sa.payroll': 'admin,matron',
  'sa.admin': 'admin'
});



// ═══ Auto-registered (stage17) ═══
if (!perms.P['bloodbank.crossmatch']) perms.P['bloodbank.crossmatch'] = 'admin';
if (!perms.P['bloodbank.issue']) perms.P['bloodbank.issue'] = 'admin';
if (!perms.P['bloodbank.request']) perms.P['bloodbank.request'] = 'admin';
if (!perms.P['bloodbank.transfuse']) perms.P['bloodbank.transfuse'] = 'admin';
if (!perms.P['bloodbank.view']) perms.P['bloodbank.view'] = 'admin';
if (!perms.P['crisis.activate']) perms.P['crisis.activate'] = 'admin';
if (!perms.P['crisis.alert']) perms.P['crisis.alert'] = 'admin';
if (!perms.P['crisis.assign']) perms.P['crisis.assign'] = 'admin';
if (!perms.P['crisis.confirm']) perms.P['crisis.confirm'] = 'admin';
if (!perms.P['crisis.evacuate']) perms.P['crisis.evacuate'] = 'admin';
if (!perms.P['crisis.view']) perms.P['crisis.view'] = 'admin';
if (!perms.P['cssd.manage']) perms.P['cssd.manage'] = 'admin';
if (!perms.P['cssd.view']) perms.P['cssd.view'] = 'admin';
if (!perms.P['discharge.plan']) perms.P['discharge.plan'] = 'admin';
if (!perms.P['discharge.view']) perms.P['discharge.view'] = 'admin';
if (!perms.P['handover.create']) perms.P['handover.create'] = 'admin';
if (!perms.P['handover.sign']) perms.P['handover.sign'] = 'admin';
if (!perms.P['handover.view']) perms.P['handover.view'] = 'admin';
if (!perms.P['infection.isolation']) perms.P['infection.isolation'] = 'admin';
if (!perms.P['infection.report']) perms.P['infection.report'] = 'admin';
if (!perms.P['infection.view']) perms.P['infection.view'] = 'admin';
if (!perms.P['karanneh.manage']) perms.P['karanneh.manage'] = 'admin,nursing_director,medical_director';
if (!perms.P['karanneh.view']) perms.P['karanneh.view'] = 'admin,nursing_director,medical_director';
if (!perms.P['lab.collect']) perms.P['lab.collect'] = 'admin';
if (!perms.P['lab.order']) perms.P['lab.order'] = 'admin';
if (!perms.P['lab.result']) perms.P['lab.result'] = 'admin';
if (!perms.P['lab.verify']) perms.P['lab.verify'] = 'admin';
if (!perms.P['lab.view']) perms.P['lab.view'] = 'admin';
if (!perms.P['or.checklist']) perms.P['or.checklist'] = 'admin';
if (!perms.P['or.pacu']) perms.P['or.pacu'] = 'admin';
if (!perms.P['or.schedule']) perms.P['or.schedule'] = 'admin';
if (!perms.P['or.view']) perms.P['or.view'] = 'admin';
if (!perms.P['pharmacy.dispense']) perms.P['pharmacy.dispense'] = 'admin';
if (!perms.P['pharmacy.verify']) perms.P['pharmacy.verify'] = 'admin';
if (!perms.P['pharmacy.view']) perms.P['pharmacy.view'] = 'admin';
if (!perms.P['quality.incident.report']) perms.P['quality.incident.report'] = 'admin,quality_officer,medical_director,nursing_director';
if (!perms.P['radiology.order']) perms.P['radiology.order'] = 'admin';
if (!perms.P['radiology.report']) perms.P['radiology.report'] = 'admin';
if (!perms.P['radiology.verify']) perms.P['radiology.verify'] = 'admin';
if (!perms.P['radiology.view']) perms.P['radiology.view'] = 'admin';
if (!perms.P['risk.register']) perms.P['risk.register'] = 'admin';
if (!perms.P['risk.view']) perms.P['risk.view'] = 'admin';
if (!perms.P['sepsis.diagnose']) perms.P['sepsis.diagnose'] = 'admin';
if (!perms.P['sepsis.screen']) perms.P['sepsis.screen'] = 'admin';
if (!perms.P['sepsis.view']) perms.P['sepsis.view'] = 'admin';
if (!perms.P['shift.manage']) perms.P['shift.manage'] = 'admin,nursing_director,supervisor_senior,supervisor_clinical,head_nurse';
if (!perms.P['shift.view']) perms.P['shift.view'] = 'admin,nursing_director,supervisor_senior,supervisor_clinical,head_nurse';
if (!perms.P['workforce.checkin']) perms.P['workforce.checkin'] = 'admin,nursing_director,supervisor_senior,head_nurse';
if (!perms.P['workforce.view']) perms.P['workforce.view'] = 'admin,nursing_director,supervisor_senior,head_nurse';

// ═══ Backward-compat aliases for legacy admin.js ═══
// admin.js از perms.R + r.l + r.cw استفاده می‌کند (کد قدیمی)
// permissions.js فقط perms.ROLES + r.level + r.crossWard دارد
// این patch هر دو را هم‌ارز می‌کند بدون تغییر admin.js
if (!perms.R) perms.R = perms.ROLES;
if (perms.R && perms.ROLES) {
  Object.keys(perms.ROLES).forEach(function(k) {
    var r = perms.ROLES[k];
    if (r && r.l === undefined) r.l = r.level;
    if (r && r.cw === undefined) r.cw = r.crossWard;
  });
}

Object.assign(perms.P, {
  'encounters.view':     'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,head_nurse,attending,specialist,surgeon,resident,intern,physician,nurse,quality_officer',
  'encounters.create':   'admin,attending,specialist,surgeon,resident,intern,physician',
  'encounters.sign':     'admin,attending,specialist,surgeon,resident,intern,physician',
  'encounters.cosign':   'admin,attending,specialist,surgeon',
  'procedures.create':   'admin,attending,specialist,surgeon,resident,intern,physician',
  'procedures.sign':     'admin,attending,specialist,surgeon,resident,intern,physician'
});
