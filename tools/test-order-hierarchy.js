'use strict';
// tools/test-order-hierarchy.js — 15 isolated tests
const path = require('path');
const ROOT = path.join(__dirname, '..');

const memStore = (() => {
  const data = {}; let c = 0;
  return {
    get: (col, id) => (data[col] || []).find(x => x.id === id) || null,
    put: (col, rec) => { data[col] = data[col] || []; const i = data[col].findIndex(x => x.id === rec.id); if (i >= 0) data[col][i] = rec; else data[col].push(rec); return rec; },
    readAll: (col) => (data[col] || []).slice(),
    uid: (p) => p + '_' + (++c) + '_' + Math.random().toString(36).slice(2, 8)
  };
})();
const memBus = (() => {
  const L = {};
  return { on: (ev, fn) => { (L[ev] = L[ev] || []).push(fn); }, emit: (ev, p) => { (L[ev] || []).forEach(fn => { try { fn(p); } catch (_) {} }); } };
})();
const mkCtx = (role, id) => ({
  store: memStore, bus: memBus,
  actor: { id: id || 'usr_' + role, role: role, fullName: 'Test ' + role },
  now: () => new Date().toISOString(), uid: (p) => memStore.uid(p)
});

const OW = require(path.join(ROOT, 'core/domain/order-writer.js'));

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { console.log('  ✅', name); pass++; } else { console.log('  ❌', name); fail++; } }

console.log('\n[Order Hierarchy Tests]');

// 1. createDraft → drafted
const ctxIntern = mkCtx('intern');
const o1 = OW.createDraft(ctxIntern, { patientId: 'p1', visitId: 'v1', item: 'آسپرین', dose: '325mg', route: 'PO' });
ok('createDraft → drafted', o1.status === 'drafted');
ok('author set', o1.author.role === 'intern');
ok('_trans has drafted', (o1._trans || []).some(x => x.action === 'drafted'));

// 2. submit → pending_cosign
const o2 = OW.submitForCosign(ctxIntern, o1.id);
ok('submitForCosign → pending_cosign', o2.status === 'pending_cosign');

// 3. cosign normal → verified
const ctxRes = mkCtx('resident_senior');
const o3 = OW.cosign(ctxRes, o1.id, { note: 'OK' });
ok('cosign normal → verified', o3.status === 'verified');
ok('cosigner recorded', o3.cosigner && o3.cosigner.role === 'resident_senior');

// 4. High-alert detection
const o4 = OW.createDraft(ctxIntern, { patientId: 'p2', visitId: 'v2', item: 'مورفین', dose: '2mg', route: 'IV' });
ok('high-alert auto-detected', o4.isHighAlert === true);
ok('attending_required set', o4.attending_required === true);

// 5. High-alert flow: submit → cosign → pending_attending
OW.submitForCosign(ctxIntern, o4.id);
const o4b = OW.cosign(ctxRes, o4.id);
ok('high-alert cosign → pending_attending', o4b.status === 'pending_attending');

// 6. attending cosign → verified
const ctxAtt = mkCtx('attending');
const o4c = OW.attendingCosign(ctxAtt, o4.id, { note: 'approved' });
ok('attending_cosign → verified', o4c.status === 'verified');
ok('attending_cosigner recorded', o4c.attending_cosigner && o4c.attending_cosigner.role === 'attending');

// 7. reject from pending_cosign
const o5 = OW.createDraft(ctxIntern, { patientId: 'p3', visitId: 'v3', item: 'استامینوفن', dose: '500mg' });
OW.submitForCosign(ctxIntern, o5.id);
const o5r = OW.reject(ctxRes, o5.id, { reason: 'دوز بالا — بازبینی شود' });
ok('reject from pending_cosign → rejected', o5r.status === 'rejected');
ok('rejectionReason recorded', o5r.rejectionReason.length > 5);
ok('rejectionStage=resident', o5r.rejectionStage === 'resident');

// 8. reject from pending_attending
const o6 = OW.createDraft(ctxIntern, { patientId: 'p4', visitId: 'v4', item: 'هپارین', dose: '5000U' });
OW.submitForCosign(ctxIntern, o6.id);
OW.cosign(ctxRes, o6.id);
const o6r = OW.reject(ctxAtt, o6.id, { reason: 'کنترااندیکاسیون — خونریزی فعال' });
ok('reject from pending_attending → rejected', o6r.status === 'rejected');
ok('rejectionStage=attending', o6r.rejectionStage === 'attending');

// 9. invalid transition rejected
let threw = false;
try { OW.submitForCosign(ctxIntern, o1.id); } catch (e) { threw = true; }
ok('submit on verified → rejected', threw);

// 10. invalid cosign
threw = false;
try { OW.cosign(ctxRes, o1.id); } catch (e) { threw = true; }
ok('cosign on verified → rejected', threw);

// 11. attendingCosign on wrong state
threw = false;
try { OW.attendingCosign(ctxAtt, o1.id); } catch (e) { threw = true; }
ok('attendingCosign on verified → rejected', threw);

// 12. listPendingCosign
const o7 = OW.createDraft(ctxIntern, { patientId: 'p5', visitId: 'v5', item: 'داروی تست', dose: '1mg' });
OW.submitForCosign(ctxIntern, o7.id);
const pendCosign = OW.listPendingCosign(ctxRes);
ok('listPendingCosign includes o7', pendCosign.some(x => x.id === o7.id));

// 13. listPendingAttending
const o8 = OW.createDraft(ctxIntern, { patientId: 'p6', visitId: 'v6', item: 'فنتانیل', dose: '50mcg' });
OW.submitForCosign(ctxIntern, o8.id);
OW.cosign(ctxRes, o8.id);
const pendAtt = OW.listPendingAttending(ctxAtt);
ok('listPendingAttending includes o8', pendAtt.some(x => x.id === o8.id));

// 14. listByVisit
const byV = OW.listByVisit(mkCtx('nurse'), 'v1');
ok('listByVisit v1 includes o1', byV.some(x => x.id === o1.id));

// 15. Backward compat: old create() → pending still works
const oOld = OW.create(ctxIntern, { patientId: 'p_old', item: 'قدیمی', dose: '1mg' });
ok('backward compat create() → pending', oOld.status === 'pending');

console.log('\n  Results: ' + pass + '/' + (pass + fail) + ' passed');
if (fail === 0) console.log('  ✅ ALL ORDER HIERARCHY TESTS PASSED');
else { console.log('  ❌ SOME TESTS FAILED'); process.exit(1); }
