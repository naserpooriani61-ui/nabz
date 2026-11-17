#!/usr/bin/env node
'use strict';
// tools/test-ed-flow.js — چرخهٔ عمر ویزیت اورژانس، مجوزها و تابلو
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const req = (p) => require(path.join(ROOT, p));
const store = req('core/store');
const W = req('core/domain/ed-visit-writer');
const B = req('core/domain/ed-board');
const perms = req('core/permissions');

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); } }
function mk(role) {
  return { store, bus: { emit() {} }, uid: (p) => store.uid(p), now: () => new Date().toISOString(),
    actor: { id: 'usr_edtest_' + role, role: role, username: 'edtest_' + role, fullName: 'ED Test' },
    E: { badRequest: (m) => Object.assign(new Error(m), { code: m }), notFound: (m) => Object.assign(new Error(m), { code: m }),
         conflict: (m) => Object.assign(new Error(m), { code: m }), forbidden: (m) => Object.assign(new Error(m), { code: m }) } };
}
function threw(fn) { try { fn(); return null; } catch (e) { return String((e && e.message) || e); } }
const NS = { sign: false };
const created = [];
function newVisit(role, extra) {
  const v = W.register(mk(role), Object.assign({ patientName: 'EDTEST ' + Math.random().toString(36).slice(2, 6), age: 40, sex: 'male', chiefComplaint: 'تست' }, extra || {}));
  created.push(v.id); return v;
}
const pid = 'pat_edtest_' + Date.now();
let transferId = null;

console.log('ED lifecycle / permissions / board');
try {
  ok('receptionist می‌تواند ثبت کند', perms.can('receptionist', 'ed.register'));
  ok('nurse_aide ed.view دارد ولی ed.triage ندارد', perms.can('nurse_aide', 'ed.view') && !perms.can('nurse_aide', 'ed.triage'));
  ok('supervisor ed.view دارد', perms.can('supervisor', 'ed.view'));
  ok('nurse نمی‌تواند تعیین‌تکلیف کند', !perms.can('nurse', 'ed.disposition'));
  ok('فقط attending/admin می‌توانند co-sign کنند', perms.can('attending', 'ed.cosign') && !perms.can('resident', 'ed.cosign') && !perms.can('nurse', 'ed.cosign'));

  const nurse = mk('nurse'), phys = mk('physician'), res = mk('resident');
  const v1 = newVisit('receptionist', { vitals: { gcs: 7, hr: 120 } });
  ok('ثبت توسط receptionist (بدون patientId → unlinked)', v1.status === 'waiting_triage' && v1.unlinked === true && v1.esiLevel === null);
  const row = B.getBoard(nurse).rows.find(r => r.id === v1.id);
  ok('تابلو: علامت «علائم بحرانی بدون تریاژ»', !!row && row.flags.indexOf('critical_vitals_untriaged') !== -1);

  let e = threw(() => W.triage(nurse, v1.id, { esiLevel: 4 }, NS));
  ok('انتخاب ۴ در برابر پیشنهاد ۱ بدون دلیل رد می‌شود', !!e && e.indexOf('override_reason_required') !== -1, e);
  const t1 = W.triage(nurse, v1.id, { esiLevel: 1 }, NS);
  ok('تریاژ ۱ با پیشنهاد هم‌خوان', t1.status === 'waiting_doctor' && t1.esiLevel === 1 && t1.triage.suggested === 1 && t1.nextReassessAt === null);

  e = threw(() => W.act(nurse, v1.id, 'see', {}, NS));
  ok('nurse نمی‌تواند «دیده‌شدن توسط پزشک» را ثبت کند', !!e && e.indexOf('forbidden') !== -1, e);
  const s1 = W.act(phys, v1.id, 'see', {}, NS);
  ok('physician: see → in_treatment', s1.status === 'in_treatment' && !!s1.seenAt);

  e = threw(() => W.act(res, v1.id, 'disposition_admit', {}, NS));
  ok('بستری بدون مقصد رد می‌شود', !!e && e.indexOf('missing:destination') !== -1, e);
  const d1 = W.act(res, v1.id, 'disposition_admit', { destination: 'ICU_GEN1' }, { sign: false, transfer: false });
  ok('resident: بستری → boarding با نیاز به co-sign', d1.status === 'boarding' && d1.needsCosign === true && d1.dispositionType === 'admit');

  e = threw(() => W.act(nurse, v1.id, 'depart_admitted', {}, NS));
  ok('خروج بدون co-sign استاد مسدود است', !!e && e.indexOf('attending_cosign_required') !== -1, e);
  ok('resident نمی‌تواند co-sign کند', !!threw(() => W.cosign(mk('resident'), v1.id, NS)));
  W.cosign(mk('attending'), v1.id, NS);
  const dep = W.act(nurse, v1.id, 'depart_admitted', {}, NS);
  ok('پس از co-sign خروج انجام می‌شود', dep.status === 'admitted' && !!dep.departedAt && dep.outcome === 'admitted');
  const tl = B.getTimeline(nurse, v1.id);
  ok('خط زمانی: فاصله‌های کلیدی محاسبه شد', tl.intervals.doorToTriageMin !== null && tl.intervals.doorToProviderMin !== null && tl.intervals.losMin !== null);

  const v2 = newVisit('nurse');
  W.triage(nurse, v2.id, { esiLevel: 3 }, NS);
  W.act(phys, v2.id, 'see', {}, NS);
  e = threw(() => W.act(nurse, v2.id, 'leave_ama', {}, NS));
  ok('ترک با رضایت شخصی بدون دلیل رد می‌شود', !!e && e.indexOf('missing:reason') !== -1, e);
  const l2 = W.act(nurse, v2.id, 'leave_ama', { reason: 'رضایت شخصی' }, NS);
  ok('LAMA ثبت شد', l2.status === 'lama' && l2.outcomeReason === 'رضایت شخصی');

  const v3 = newVisit('receptionist');
  const l3 = W.act(mk('receptionist'), v3.id, 'leave_unseen', {}, NS);
  ok('LWBS توسط منشی', l3.status === 'lwbs' && l3.outcome === 'lwbs');

  const v4 = newVisit('nurse');
  W.triage(nurse, v4.id, { esiLevel: 1 }, NS);
  ok('nurse نمی‌تواند فوت اعلام کند', !!threw(() => W.act(nurse, v4.id, 'declare_death', { note: 'x' }, NS)));
  ok('اعلام فوت توسط attending', W.act(mk('attending'), v4.id, 'declare_death', { note: 'احیا ناموفق' }, NS).status === 'deceased');

  const v5 = newVisit('nurse');
  const st = B.getStats(nurse, 1);
  const expectCrit = store.readAll('ed_visits').filter(v => W.TERMINAL.indexOf(v.status) === -1 && v.esiLevel != null && Number(v.esiLevel) <= 2).length;
  ok('آمار: بیمار بدون تریاژ «بحرانی» شمرده نمی‌شود', st.critical === expectCrit && st.untriaged >= 1, 'critical=' + st.critical + ' expected=' + expectCrit);
  W.triage(nurse, v5.id, { esiLevel: 3 }, NS);
  ok('بازتریاژ بدون دلیل رد می‌شود', !!threw(() => W.retriage(nurse, v5.id, { esiLevel: 2 }, NS)));
  const rt = W.retriage(nurse, v5.id, { esiLevel: 2, reason: 'افت فشار' }, NS);
  ok('بازتریاژ با تاریخچه', rt.esiLevel === 2 && rt.esiHistory.length === 2);

  store.put('patients', { id: pid, firstName: 'ED', lastName: 'TEST', age: 40, sex: 'male', wardCode: 'ER', status: 'active', createdAt: new Date().toISOString() });
  const v6 = newVisit('nurse', { patientId: pid });
  ok('ویزیت به patientId وصل شد', v6.patientId === pid && v6.unlinked === false);
  W.triage(nurse, v6.id, { esiLevel: 2 }, NS);
  W.act(phys, v6.id, 'see', {}, NS);
  const w6 = W.act(res, v6.id, 'disposition_admit', { destination: 'ICU_GEN1' }, NS);
  transferId = w6.transferId || null;
  ok('بستری برای بیمار متصل ثبت شد', w6.status === 'boarding');
  console.log('  ℹ️  درخواست انتقال خودکار: ' + (w6.transferId ? ('ساخته شد ' + w6.transferId) : ('ساخته نشد — ' + w6.transferError)));
} catch (err) {
  fail++; console.log('  ❌ استثنای پیش‌بینی‌نشده: ' + ((err && err.stack) || err));
} finally {
  created.forEach(id => { try { store.remove('ed_visits', id); } catch (_) {} });
  try { store.remove('patients', pid); } catch (_) {}
  if (transferId) { try { store.remove('transfers', transferId); } catch (_) {} }
}
console.log('\n  Results: ' + pass + '/' + (pass + fail) + ' passed');
if (fail) { console.log('  ❌ ED FLOW TESTS FAILED'); process.exit(1); }
console.log('  ✅ ALL ED FLOW TESTS PASSED');
