'use strict';
const store = require('../core/store');
const bcrypt = require('bcryptjs');

const ROLE_MAP = {
  'rn':'nurse', 'nurse':'nurse', 'head_nurse':'head_nurse',
  'matron':'matron', 'supervisor':'supervisor',
  'clinical_supervisor':'clinical_supervisor',
  'assistant':'nurse_aide', 'support':'nurse_aide', 'beh_yar':'nurse_aide',
  'patient_care':'nurse_aide', 'anesthesia':'anesthesiologist',
  'or_tech':'nurse', 'or_specialist':'nurse', 'midwife':'nurse',
  'secretary':'receptionist', 'physician':'physician', 'resident':'resident',
  'intern':'intern', 'attending':'attending', 'specialist':'specialist',
  'surgeon':'surgeon', 'anesthesiologist':'anesthesiologist',
  'pharmacist':'pharmacist', 'lab_tech':'lab_tech',
  'radiology_tech':'radiology_tech'
};

(function ensureAllUsers() {
  try {
    const users = store.readAll('users');
    const byUser = {};
    users.forEach(u => byUser[u.username] = u);
    const byStaff = {};
    users.forEach(u => { if (u.staffId) byStaff[u.staffId + '|' + (u.source || '')] = u; });
    let added = 0;

    // 1) wf_staff → users
    const wf = store.readAll('wf_staff');
    for (const s of wf) {
      if (!s.fullName || byStaff[s.id + '|wf_staff']) continue;
      const username = s.personnelCode || s.username || ('wf' + s.id);
      if (byUser[username]) continue;
      const last4 = username.length >= 4 ? username.slice(-4) : String(s.id).padStart(4, '0');
      const rec = {
        id: 'usrwf_' + s.id,
        username: username,
        fullName: s.fullName,
        role: ROLE_MAP[s.role] || s.role || 'nurse',
        ward: s.ward || null,
        active: true,
        passwordHash: bcrypt.hashSync('Sin@' + last4, 8),
        mustChangePassword: true,
        staffId: s.id,
        source: 'wf_staff',
        createdAt: new Date().toISOString()
      };
      store.put('users', rec);
      byUser[username] = rec;
      byStaff[s.id + '|wf_staff'] = rec;
      added++;
    }

    // 2) sa_staff → users
    const sa = store.readAll('sa_staff').filter(s => s.active);
    for (const s of sa) {
      if (!s.name || byStaff[s.id + '|sa_staff']) continue;
      let username = s.code || ('sa' + s.id);
      // Handle duplicates
      if (byUser[username]) username = username + '_' + s.id;
      const last4 = (s.code && s.code.length >= 4) ? s.code.slice(-4) : String(s.id).padStart(4, '0');
      const rec = {
        id: 'sau_' + s.id,
        username: username,
        fullName: s.name,
        role: ROLE_MAP[s.category] || 'nurse',
        ward: null,
        active: true,
        passwordHash: bcrypt.hashSync('Sin@' + last4, 8),
        mustChangePassword: true,
        staffId: s.id,
        source: 'sa_staff',
        createdAt: new Date().toISOString()
      };
      store.put('users', rec);
      byUser[username] = rec;
      byStaff[s.id + '|sa_staff'] = rec;
      added++;
    }

    if (added > 0) console.log('[zz_auth_users] ✅ ' + added + ' user accounts created');
  } catch (e) {
    console.error('[zz_auth_users]', e.message);
  }
})();

module.exports = { handlers: {}, routes: [], panels: [] };
