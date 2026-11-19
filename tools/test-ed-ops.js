#!/usr/bin/env node
'use strict';
// tools/test-ed-ops.js — تخت، پروندهٔ موقت، MCI و آزادسازی تخت هنگام خروج
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const req = (p) => require(path.join(ROOT, p));
const store = req('core/store');
const W = req('core/domain/ed-visit-writer');
const O = req('core/domain/ed-ops');

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); } }
function mk(role) {
  return { store, bus: { emit() {} }, uid: (p) => store.uid(p), now: () => new Date().toISOString(),
    actor: { id: 'usr_edops_' + role, role: role, username: 'edops_' + role, fullName: 'ED Ops' },
    E: { badRequest: (m) => Object.assign(new Error(m), { code: m }), notFound: (m) => Object.assign(new Error(m), { code: m }),
         conflict: (m) => Object.assign(new Error(m), { code: m }), forbidden: (m) => Object.assign(new Error(m), { code: m }) } };
}
function threw(fn) { try { fn(); return null; } catch (e) { return String((e && e.message) || e); } }
const NS = { sign: false };
const made = { visits: [], beds: ['ED-TEST-01', 'ED-TEST-02'], patients: [], mci: [] };

console.log('ED ops: beds / temp patient / MCI');
try {
  const t = new Date().toISOString();
  store.put('beds', { id: 'ED-TEST-01', code: 'T-1', zone: 'TEST', area: 'ed', label: 'تست #1', status: 'empty', patientId: null, visitId: null, updatedAt: t });
  store.put('beds', { id: 'ED-TEST-02', code: 'T-2', zone: 'TEST', area: 'ed', label: 'تست #2', status: 'empty', patientId: null, visitId: null, updatedAt: t });
  const nurse = mk('nurse'), phys = mk('physician'), rec = mk('receptionist');
  const nv = (n) => { const v = W.register(rec, { patientName: 'EDOPS ' + n, age: 30, sex: 'female', chiefComplaint: 'تست' }); made.visits.push(v.id); return v; };

  const v1 = nv('a'), v2 = nv('b');
  W.triage(nurse, v1.id, { esiLevel: 3 }, NS);
  const a1 = O.assignBed(nurse, v1.id, 'ED-TEST-01');
  ok('تخصیص تخت: تخت اشغال و ویزیت دارای bedId', store.get('beds', 'ED-TEST-01').status === 'occupied' && a1.visit.bedId === 'ED-TEST-01' && a1.visit.zone === 'TEST');
  ok('تخصیص تخت اشغال رد می‌شود', (threw(() => O.assignBed(nurse, v2.id, 'ED-TEST-01')) || '').indexOf('bed_not_available') !== -1);
  ok('منشی نمی‌تواند تخت تخصیص دهد', !!threw(() => O.assignBed(rec, v2.id, 'ED-TEST-02')));
  ok('تخت اشغال را نمی‌شود دستی آزاد کرد', (threw(() => O.setBedStatus(nurse, 'ED-TEST-01', 'empty')) || '').indexOf('bed_occupied') !== -1);
  O.assignBed(nurse, v1.id, 'ED-TEST-02');
  ok('جابه‌جایی: تخت قبلی نظافت، تخت جدید اشغال', store.get('beds', 'ED-TEST-01').status === 'cleaning' && store.get('beds', 'ED-TEST-02').status === 'occupied');
  ok('تخت در حال نظافت قابل تخصیص نیست', (threw(() => O.assignBed(nurse, v2.id, 'ED-TEST-01')) || '').indexOf('bed_not_available') !== -1);
  ok('وضعیت نامعتبر تخت رد می‌شود', !!threw(() => O.setBedStatus(nurse, 'ED-TEST-01', 'occupied')));
  O.setBedStatus(nurse, 'ED-TEST-01', 'empty');
  ok('نظافت تمام شد → تخت آزاد', store.get('beds', 'ED-TEST-01').status === 'empty');
  const lb = O.listBeds(nurse);
  ok('فهرست تخت‌ها: ناحیهٔ TEST با ۱ اشغال و ۱ آزاد', (function () { const z = lb.zones.find(x => x.code === 'TEST'); return !!z && z.occupied === 1 && z.free === 1; })());

  W.act(phys, v1.id, 'see', {}, NS);
  W.act(phys, v1.id, 'disposition_discharge', {}, NS);
  const dep = W.act(nurse, v1.id, 'depart_discharged', {}, NS);
  ok('خروج: تخت خودکار آزاد (نظافت) و bedId پاک', dep.status === 'discharged' && !dep.bedId && dep.lastBedId === 'ED-TEST-02' && store.get('beds', 'ED-TEST-02').status === 'cleaning');

  const v3 = W.register(rec, { unknown: true, chiefComplaint: 'تصادف', age: 25 }); made.visits.push(v3.id);
  ok('بیمار ناشناس نام موقت می‌گیرد', /^ناشناس/.test(v3.patientName) && v3.unknown === true);
  ok('nurse_aide نمی‌تواند پرونده بسازد', !!threw(() => O.createPatient(mk('nurse_aide'), v3.id)));
  const cp = O.createPatient(rec, v3.id); made.patients.push(cp.patient.id);
  ok('پروندهٔ موقت: بخش ER، آلرژی تأییدنشده، ویزیت متصل', cp.patient.wardCode === 'ER' && cp.patient.allergiesVerified === false && cp.patient.tempRecord === true && cp.visit.patientId === cp.patient.id && cp.visit.unlinked === false);
  ok('ساخت دوباره رد می‌شود', (threw(() => O.createPatient(rec, v3.id)) || '').indexOf('already_linked') !== -1);

  const mid = 'mci_edtest_' + Date.now(); made.mci.push(mid);
  store.put('ed_mci', { id: mid, alertLevel: 'L1', incidentType: 'تست', status: 'active', casualties: { red: 0, yellow: 0, green: 0, black: 0 }, activatedAt: t });
  const admin = mk('admin');
  ok('MCI: شمارش +۱', O.mciCount(admin, mid, 'red', 1).casualties.red === 1);
  ok('MCI: شمارش −۱', O.mciCount(admin, mid, 'red', -1).casualties.red === 0);
  ok('MCI: کف صفر', O.mciCount(admin, mid, 'red', -1).casualties.red === 0);
  ok('MCI: رنگ نامعتبر رد می‌شود', !!threw(() => O.mciCount(admin, mid, 'blue', 1)));
  ok('MCI: بستن', O.mciClose(admin, mid, 'تمام').status === 'closed');
  ok('MCI: شمارش بعد از بستن رد می‌شود', (threw(() => O.mciCount(admin, mid, 'red', 1)) || '').indexOf('mci_not_active') !== -1);
} catch (err) {
  fail++; console.log('  ❌ استثنای پیش‌بینی‌نشده: ' + ((err && err.stack) || err));
} finally {
  made.visits.forEach(id => { try { store.remove('ed_visits', id); } catch (_) {} });
  made.beds.forEach(id => { try { store.remove('beds', id); } catch (_) {} });
  made.patients.forEach(id => { try { store.remove('patients', id); } catch (_) {} });
  made.mci.forEach(id => { try { store.remove('ed_mci', id); } catch (_) {} });
}
console.log('\n  Results: ' + pass + '/' + (pass + fail) + ' passed');
if (fail) { console.log('  ❌ ED OPS TESTS FAILED'); process.exit(1); }
console.log('  ✅ ALL ED OPS TESTS PASSED');
