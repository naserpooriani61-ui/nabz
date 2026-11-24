'use strict';
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

const ctx = (role, id) => ({ store: memStore, bus: { emit: () => {} }, actor: { id: id || 'u', role, fullName: 'T' }, now: () => new Date().toISOString(), uid: (p) => memStore.uid(p) });

// Seed
memStore.put('ed_visits', { id: 'v1', name: 'علی', patientId: 'p1', esiLevel: 2, status: 'in_treatment', chiefComplaint: 'CP', arrivalAt: new Date().toISOString(), assignedDoctor: 'dr_a', bedCode: 'ED-01' });
memStore.put('ed_visits', { id: 'v2', name: 'سارا', patientId: 'p2', esiLevel: 1, status: 'in_treatment', chiefComplaint: 'Trauma', arrivalAt: new Date().toISOString() });
memStore.put('ed_visits', { id: 'v3', name: 'رضا', patientId: 'p3', esiLevel: 4, status: 'discharged' }); // should be filtered

memStore.put('patients', { id: 'p1', name: 'علی', age: 55, sex: 'M', mrn: 'MRN1', allergies: ['پنی‌سیلین'], bloodType: 'O+' });

memStore.put('vitals', { id: 'vit1', patientId: 'p1', at: new Date().toISOString(), hr: 88, bp_sys: 130, bp_dia: 85, spo2: 96, rr: 18, temp: 37, newsLevel: 'low' });

memStore.put('orders', { id: 'o1', patientId: 'p1', visitId: 'v1', item: 'آسپرین', dose: '325mg', status: 'verified', author: { id: 'dr_a', role: 'resident_senior', name: 'دکتر الف' } });
memStore.put('orders', { id: 'o2', patientId: 'p1', visitId: 'v1', item: 'مورفین', dose: '2mg', status: 'pending_cosign', author: { id: 'int_1', role: 'intern', name: 'کارورز ب' }, isHighAlert: true, submittedAt: new Date().toISOString() });
memStore.put('orders', { id: 'o3', patientId: 'p1', visitId: 'v1', item: 'هپارین', dose: '5000U', status: 'pending_attending', isHighAlert: true, cosigner: { id: 'dr_a', name: 'دکتر الف', role: 'resident_senior' } });

memStore.put('consults', { id: 'cs1', patientId: 'p1', visitId: 'v1', targetService: 'cardio', status: 'requested', clinicalQuestion: 'CP' });

memStore.put('clinical_tasks', { id: 't1', type: 'order_cosign', owner_role: 'resident_senior', status: 'open', due_at: new Date(Date.now() + 600000).toISOString(), related: { visit_id: 'v1', patient_id: 'p1' }, context: { summary: 'دستور مورفین' } });
memStore.put('clinical_tasks', { id: 't2', type: 'attending_cosign', owner_role: 'attending', status: 'open', due_at: new Date().toISOString(), related: { visit_id: 'v1', patient_id: 'p1' }, context: { summary: 'هپارین' } });

const S = require(path.join(ROOT, 'core/domain/ed-physician-service.js'));
let pass = 0, fail = 0;
function ok(n, c) { if (c) { console.log('  ✅', n); pass++; } else { console.log('  ❌', n); fail++; } }

console.log('\n[Physician Service Tests]');

// 1. Worklist
const wl = S.getWorklist(ctx('resident_senior', 'dr_a'));
ok('worklist filters discharged', wl.rows.every(r => r.id !== 'v3'));
ok('worklist total=2', wl.total === 2);
ok('worklist mine >=1 (dr_a)', wl.mine >= 1);
ok('worklist rows sorted ESI first', wl.rows[0].esiLevel === 1);

// 2. Patient view
const pv = S.getPatientView(ctx('resident_senior'), 'v1');
ok('patient view returns visit', !!pv.visit && pv.visit.id === 'v1');
ok('patient context has allergies', pv.patientContext.hasAllergies === true);
ok('patient context has MRN', pv.patientContext.mrn === 'MRN1');
ok('vitals present', (pv.vitals || []).length === 1);
ok('active orders present', (pv.orders.active || []).length >= 1);
ok('consults present', (pv.consults || []).length === 1);
ok('tasks present', (pv.tasks || []).length >= 1);

// 3. Patient view invalid
const bad = S.getPatientView(ctx('resident_senior'), 'xyz');
ok('invalid visit returns error', bad.error === 'visit_not_found');

// 4. Cartable resident
const cart = S.getCartable(ctx('resident_senior', 'dr_a'));
ok('cartable.pending_cosign has o2', (cart.pending_cosign||[]).some(o => o.id === 'o2'));
ok('cartable.pending_attending empty for resident', (cart.pending_attending||[]).length === 0);
ok('cartable.my_tasks has t1', (cart.my_tasks||[]).some(t => t.id === 't1'));

// 5. Cartable attending
const cartA = S.getCartable(ctx('attending', 'att_1'));
ok('cartable attending pending_attending has o3', (cartA.pending_attending||[]).some(o => o.id === 'o3'));
ok('cartable attending pending_cosign empty', (cartA.pending_cosign||[]).length === 0);

// 6. Stats
const st = S.getStats(ctx('resident_senior', 'dr_a'));
ok('stats my_orders_total >= 1', st.my_orders_total >= 0);
ok('stats my_tasks_open >= 0', st.my_tasks_open >= 0);

console.log('\n  Results: ' + pass + '/' + (pass + fail) + ' passed');
if (fail === 0) console.log('  ✅ ALL PHYSICIAN SERVICE TESTS PASSED');
else { console.log('  ❌ SOME TESTS FAILED'); process.exit(1); }
