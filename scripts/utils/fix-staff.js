'use strict';
const store = require('./core/store');

console.log('\n═══ چک پیش‌نیازها ═══\n');

// ۱) patients
const patients = store.readAll('patients');
console.log('patients:', patients.length);
if (patients.length === 0) {
  console.log('⏳ patients خالی — اجرای seed()');
  try { require('./core/seed').seed(); } catch (e) { console.error('  seed:', e.message); }
  const p2 = store.readAll('patients');
  console.log('  patients الان:', p2.length);
  if (p2.length === 0) { console.error('❌ patients باز هم خالی'); process.exit(1); }
}

// ۲) wf_staff — مستقیم
const staff = store.readAll('wf_staff');
console.log('wf_staff:', staff.length);
if (staff.length === 0) {
  console.log('⏳ wf_staff خالی — اضافه کردن ۱۵ پرسنل');
  const list = [
    { name:'مریم موسوی',      role:'nurse',          ward:'ICU' },
    { name:'احمد رضایی',      role:'nurse',          ward:'ER'  },
    { name:'زهرا کریمی',      role:'head_nurse',     ward:'ICU' },
    { name:'محمد احمدی',      role:'physician',      ward:'ER'  },
    { name:'فاطمه حسینی',     role:'resident',       ward:'ICU' },
    { name:'علی نوری',        role:'attending',      ward:'ICU' },
    { name:'سارا مهدوی',      role:'nurse',          ward:'GEN' },
    { name:'رضا صادقی',       role:'pharmacist',     ward:'PHARM' },
    { name:'نگار بهرامی',     role:'lab_tech',       ward:'LAB' },
    { name:'حسین زمانی',      role:'anesthesiologist', ward:'OR' },
    { name:'فاطمه رضایی',     role:'nurse',          ward:'ER'  },
    { name:'محسن کریمی',      role:'nurse',          ward:'ICU' },
    { name:'نسرین احمدی',     role:'nurse',          ward:'GEN' },
    { name:'حسین محمدی',      role:'physician',      ward:'GEN' },
    { name:'لیلا موسوی',      role:'head_nurse',     ward:'ER'  }
  ];
  list.forEach((s, i) => {
    store.put('wf_staff', {
      id: 'wf_' + (i + 1),
      fullName: s.name,
      role: s.role,
      ward: s.ward,
      active: true,
      oncallEligible: true,
      createdAt: new Date().toISOString()
    });
  });
  console.log('  ✅ wf_staff الان:', store.readAll('wf_staff').length);
}

// ۳) or_rooms
const rooms = store.readAll('or_rooms');
console.log('or_rooms:', rooms.length);
if (rooms.length === 0) {
  console.log('⏳ or_rooms خالی — ساخت ۲۲ اتاق');
  const groups = [['GEN', 12], ['URO', 5], ['EMG', 5]];
  for (const [g, n] of groups) {
    for (let i = 1; i <= n; i++) {
      store.put('or_rooms', {
        id: 'or_' + g + i,
        code: 'OR-' + g + '-' + String(i).padStart(2, '0'),
        group: g,
        status: 'available',
        currentCaseId: null,
        createdAt: new Date().toISOString()
      });
    }
  }
  console.log('  ✅ or_rooms الان:', store.readAll('or_rooms').length);
}

// ۴) users (برای admin actor)
const users = store.readAll('users');
console.log('users:', users.length);
if (!users.find(u => u.role === 'admin')) {
  console.log('⏳ admin نیست — اجرای seedAdmin');
  try { require('./core/auth').seedAdmin(); } catch (e) { console.error(e.message); }
}

console.log('\n✅ همه پیش‌نیازها آماده‌اند\n');
console.log('حالا اجرا کنید:');
console.log('  ' + '\x1b[36mnode ~/nabz/seed-all.js\x1b[0m');
console.log('');
