#!/usr/bin/env node
'use strict';
// tools/test-all.js — NABZ regression test suite
// Usage: node tools/test-all.js
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const req = (p) => require(path.join(ROOT, p));

const store = req('core/store');
const bus = req('core/events');
const sm = req('core/state-machine');
const ow = req('core/domain/order-writer');
const vw = req('core/domain/vitals-writer');
const mw = req('core/domain/mar-writer');
const cw = req('core/domain/consult-writer');
const tw = req('core/domain/transfer-writer');
const dw = req('core/domain/discharge-writer');
const hw = req('core/domain/handover-writer');
const n2 = req('core/domain/news2');
const kxs = req('core/domain/kardex-service');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; fails.push(name); console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); }
}

const pid = 'pat_test_' + Date.now();
const ctx = {
  store, bus,
  uid: (p) => store.uid(p),
  now: () => new Date().toISOString(),
  actor: { id: 'usr_test', role: 'admin', username: 'test', fullName: 'Test' },
  E: {
    badRequest: (m) => Object.assign(new Error(m), { code: m }),
    notFound: (m) => Object.assign(new Error(m), { code: m }),
    conflict: (m) => Object.assign(new Error(m), { code: m }),
    forbidden: (m) => Object.assign(new Error(m), { code: m })
  }
};

const created = { orders: [], mars: [], vitals: [], consults: [], patients: [], transfers: [], discharges: [], handovers: [] };
function track(coll, id) { created[coll] && created[coll].push(id); }
function cleanup() {
  Object.keys(created).forEach(coll => {
    created[coll].forEach(id => { try { store.remove(coll, id); } catch(_){} });
  });
  store.readAll('mar').filter(m => m.patientId === pid).forEach(m => store.remove('mar', m.id));
  store.readAll('orders').filter(o => o.patientId === pid).forEach(o => store.remove('orders', o.id));
  store.readAll('vitals').filter(v => v.patientId === pid).forEach(v => store.remove('vitals', v.id));
  store.readAll('consults').filter(c => c.patientId === pid).forEach(c => store.remove('consults', c.id));
}

console.log('\n═══════════════════════════════════════════');
console.log('  NABZ REGRESSION TEST SUITE');
console.log('═══════════════════════════════════════════');

try {
  // ────── Setup patient ──────
  store.put('patients', { id: pid, firstName: 'تست', lastName: 'تستی', age: 40, sex: 'male', wardCode: 'ER_TEST', bedNumber: 'B1', status: 'admitted', allergies: [] });
  track('patients', pid);

  // ────── 1. NEWS2 canonical ──────
  console.log('\n[1] NEWS2 canonical');
  const n2Normal = n2.calc({ hr: 72, rr: 16, spo2: 98, bp_sys: 120, temp: 37 });
  ok('normal → 0 low', n2Normal.total === 0 && n2Normal.risk === 'low');
  const n2Crit = n2.calc({ hr: 130, rr: 30, spo2: 88, bp_sys: 85, temp: 39.5, onOxygen: true });
  ok('critical → >=7', n2Crit.total >= 7 && n2Crit.risk === 'critical');
  const n2Zero = n2.calc({ hr: 0, rr: 0, spo2: 0, bp_sys: 0, temp: 0 });
  ok('edge rr=0 → >=7 (was bug)', n2Zero.total >= 7);

  // ────── 2. Orders (create/verify/hold/execute) ──────
  console.log('\n[2] Orders');
  const o1 = ow.create(ctx, { patientId: pid, type: 'medication', details: { drug: 'Test', dose: '1mg' } });
  track('orders', o1.id);
  ok('create → pending', o1.status === 'pending');
  const o2 = ow.transition(ctx, o1.id, 'verify', { event: 'kardex.order.verify' });
  ok('verify → verified', o2.status === 'verified');
  const o3 = ow.transition(ctx, o1.id, 'hold', { fields: { holdReason: 'test' }, event: 'kardex.order.hold' });
  ok('hold → held', o3.status === 'held');
  const o4 = ow.transition(ctx, o1.id, 'resume', { event: 'kardex.order.resume' });
  ok('resume → verified', o4.status === 'verified');
  const o5 = ow.transition(ctx, o1.id, 'execute', { event: 'kardex.order.execute' });
  ok('execute → completed', o5.status === 'completed');
  let threw = false;
  try { ow.transition(ctx, o1.id, 'verify'); } catch (e) { threw = true; }
  ok('invalid transition rejected', threw);

  // ────── 3. Vitals ──────
  console.log('\n[3] Vitals');
  const v1 = vw.record(ctx, { patientId: pid, hr: 72, rr: 16, spo2: 98, bp_sys: 120, temp: 37 });
  track('vitals', v1.id);
  ok('record → newsLevel set', v1.newsLevel === 'low');
  const v2 = vw.record(ctx, { patientId: pid, hr: 130, rr: 30, spo2: 88, bp_sys: 85, temp: 39.5, onOxygen: true });
  track('vitals', v2.id);
  ok('critical vitals → newsLevel critical', v2.newsLevel === 'critical');

  // ────── 4. MAR (safety-grade) ──────
  console.log('\n[4] MAR (safety)');

  const mkMar = (name, highAlert, status) => {
    const m = {
      id: store.uid('mar'), orderId: o1.id, patientId: pid, patientName: 'تست',
      drugName: name, dose: '1mg', route: 'IV',
      scheduledAt: new Date().toISOString(),
      status: status || 'scheduled', isHighAlert: !!highAlert
    };
    store.put('mar', m);
    return m;
  };
  const FULL_RIGHTS = { patient: true, drug: true, dose: true, route: true, time: true };
  const actorId = (ctx.actor && (ctx.actor.id || ctx.actor.username)) || 'usr_test';

  // ── 1. administer with full five rights ──
  const mA1 = mkMar('Aspirin');
  const mR1 = mw.administer(ctx, mA1.id, { fiveRights: FULL_RIGHTS });
  ok('administer with full five rights → given', mR1.status === 'given');

  // ── 2. administer without full five rights → rejected ──
  const mA2 = mkMar('Aspirin2');
  let throwsNoRights = false;
  try { mw.administer(ctx, mA2.id, { fiveRights: { attested: true } }); }
  catch (e) { throwsNoRights = /five_rights_incomplete/.test(String(e.message || e.code || '')); }
  ok('administer with incomplete five rights → rejected', throwsNoRights);

  // ── 3. high-alert without witness → rejected ──
  const mH1 = mkMar('Morphine', true);
  let throwsNoWitness = false;
  try { mw.administer(ctx, mH1.id, { fiveRights: FULL_RIGHTS }); }
  catch (e) { throwsNoWitness = /witness_required/.test(String(e.message || e.code || '')); }
  ok('high-alert without witness → rejected', throwsNoWitness);

  // ── 4. high-alert with self witness → rejected ──
  const mH2 = mkMar('Heparin', true);
  let throwsSelfWitness = false;
  try { mw.administer(ctx, mH2.id, { fiveRights: FULL_RIGHTS, witnessId: actorId }); }
  catch (e) { throwsSelfWitness = /witness_cannot_be_self/.test(String(e.message || e.code || '')); }
  ok('high-alert with self witness → rejected', throwsSelfWitness);

  // ── 5. high-alert with valid witness → given ──
  const mH3 = mkMar('Insulin', true);
  const mHR = mw.administer(ctx, mH3.id, { fiveRights: FULL_RIGHTS, witnessId: 'usr_witness_test' });
  ok('high-alert with valid witness → given', mHR.status === 'given');

  // ── 6. refuse → refused ──
  const mR2 = mkMar('Med-R2');
  const mRef = mw.refuse(ctx, mR2.id, { reason: 'patient refused' });
  ok('refuse → refused', mRef.status === 'refused');

  // ── 7. miss → missed (from due state) ──
  const mM1 = mkMar('Med-M1', false, 'due');
  const mMiss = mw.miss(ctx, mM1.id, { reason: 'overdue' });
  ok('miss from due → missed', mMiss.status === 'missed');
  // ────── 5. Consults ──────
  console.log('\n[5] Consults');
  const c1 = cw.create(ctx, { patientId: pid, targetService: 'cardio', question: 'chest pain' });
  track('consults', c1.id);
  ok('create → requested', c1.status === 'requested');
  const c2 = cw.transition(ctx, c1.id, 'respond', { fields: { respondedBy: 'usr_test' }, event: 'kardex.consult.respond' });
  ok('respond → responded', c2.status === 'responded');
  const c3 = cw.transition(ctx, c1.id, 'approve', { fields: { approvedBy: 'usr_test' }, event: 'kardex.consult.approve' });
  ok('approve → approved', c3.status === 'approved');

  // ────── 6. Kardex aggregator ──────
  console.log('\n[6] Kardex aggregator');
  const kx = kxs.getPatientKardex(ctx, pid);
  ok('patient name present', kx.patient.name === 'تست تستی');
  ok('medications bucket', Array.isArray(kx.medications));
  ok('vitals included', Array.isArray(kx.vitals));
  ok('_meta.counts object', typeof kx._meta.counts === 'object');

  // ────── 7. State machine catalog ──────
  console.log('\n[7] State machine catalog');
  const machines = sm.list();
  ok('order machine', machines.includes('order'));
  ok('mar machine', machines.includes('mar'));
  ok('consult machine', machines.includes('consult'));
  const orderActions = sm.actions('order', { status: 'pending' }, { role: 'nurse', id: 'n' });
  ok('nurse can verify pending order', orderActions.some(a => a.action === 'verify' && a.allowed));
  const docActions = sm.actions('order', { status: 'pending' }, { role: 'physician', id: 'd' });
  ok('physician can cancel pending order', docActions.some(a => a.action === 'cancel' && a.allowed));
  ok('physician cannot verify', docActions.some(a => a.action === 'verify' && !a.allowed));

  // ────── 8. Domain writers (transfers/discharges/handovers) ──────
  console.log('\n[8] Domain writers — transfers/discharges/handovers');

  // ─── transfer-writer ───
  const t1 = tw.create(ctx, { patientId: pid, toWard: 'ICU_TEST', reason: 'need ICU' });
  track('transfers', t1.id);
  ok('tw.create status=requested', t1.status === 'requested');
  ok('tw.create id starts with trf', String(t1.id).indexOf('trf') === 0);
  ok('tw.create requestedAt set', !!t1.requestedAt);
  let twErr1 = false;
  try { tw.create(ctx, { toWard: 'ICU_TEST' }); } catch(_) { twErr1 = true; }
  ok('tw.create missing patientId throws', twErr1);
  let twErr2 = false;
  try { tw.create(ctx, { patientId: pid }); } catch(_) { twErr2 = true; }
  ok('tw.create missing toWard throws', twErr2);
  t1.status = 'approved';
  tw.put(ctx, t1);
  const t1v = store.get('transfers', t1.id);
  ok('tw.put persists change', !!(t1v && t1v.status === 'approved'));
  let twPutErr = false;
  try { tw.put(ctx, {}); } catch(_) { twPutErr = true; }
  ok('tw.put missing id throws', twPutErr);

  // ─── discharge-writer ───
  const d1 = dw.create(ctx, { patientId: pid });
  track('discharges', d1.id);
  ok('dw.create status=planned', d1.status === 'planned');
  ok('dw.create id starts with dsc', String(d1.id).indexOf('dsc') === 0);
  let dwErr = false;
  try { dw.create(ctx, {}); } catch(_) { dwErr = true; }
  ok('dw.create missing patientId throws', dwErr);
  d1.status = 'summary_drafted';
  dw.put(ctx, d1);
  const d1v = store.get('discharges', d1.id);
  ok('dw.put persists change', !!(d1v && d1v.status === 'summary_drafted'));

  // ─── handover-writer ───
  const h1 = hw.create(ctx, { wardCode: 'ICU_TEST', shiftType: 'morning', entries: [] });
  track('handovers', h1.id);
  ok('hw.create status=draft', h1.status === 'draft');
  ok('hw.create id starts with hnd', String(h1.id).indexOf('hnd') === 0);
  let hwErr1 = false;
  try { hw.create(ctx, { shiftType: 'morning' }); } catch(_) { hwErr1 = true; }
  ok('hw.create missing wardCode throws', hwErr1);
  let hwErr2 = false;
  try { hw.create(ctx, { wardCode: 'ICU_TEST' }); } catch(_) { hwErr2 = true; }
  ok('hw.create missing shiftType throws', hwErr2);

  // ────── Summary ──────
  console.log('\n═══════════════════════════════════════════');
  console.log('  Results: ' + pass + '/' + (pass + fail) + ' passed');
  if (fail > 0) {
    console.log('  Failed:');
    fails.forEach(f => console.log('    ✗ ' + f));
  } else {
    console.log('  ✅ ALL TESTS PASSED');
  }
  console.log('═══════════════════════════════════════════\n');
} catch (e) {
  console.error('\n❌ FATAL:', e.message, '\n', e.stack);
  fail++;
} finally {
  cleanup();
}
try {
  require('fs').writeFileSync(
    require('path').join(__dirname, '..', 'data', 'test-last.json'),
    JSON.stringify({ at: new Date().toISOString(), passed: pass, failed: fail, total: pass + fail })
  );
} catch(_) {}
process.exit(fail > 0 ? 1 : 0);
