'use strict';
// tools/test-tasks.js — isolated test of clinical-tasks + dispatcher
const path = require('path');
const ROOT = path.join(__dirname, '..');

const memStore = (() => {
  const data = {}; let counter = 0;
  return {
    get: (c, id) => (data[c] || []).find(x => x.id === id) || null,
    put: (c, rec) => { data[c] = data[c] || []; const i = data[c].findIndex(x => x.id === rec.id); if (i >= 0) data[c][i] = rec; else data[c].push(rec); return rec; },
    readAll: (c) => (data[c] || []).slice(),
    uid: (p) => p + '_' + (++counter) + '_' + Math.random().toString(36).slice(2, 8)
  };
})();

const memBus = (() => {
  const listeners = {};
  return {
    on: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    emit: (ev, payload) => { (listeners[ev] || []).forEach(fn => { try { fn(payload); } catch (_) {} }); }
  };
})();

const ctx = {
  store: memStore, bus: memBus,
  actor: { id: 'usr_test', role: 'nurse', fullName: 'پرستار تست' },
  now: () => new Date().toISOString(),
  uid: (p) => memStore.uid(p)
};

const T = require(path.join(ROOT, 'core/domain/clinical-tasks.js'));
require(path.join(ROOT, 'core/domain/task-dispatcher.js')).install(memBus, { store: memStore, bus: memBus });

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { console.log('  ✅', name); pass++; } else { console.log('  ❌', name); fail++; } }

console.log('\n[Task System Tests]');

// 1. manual create
const t1 = T.create(ctx, { type: 'order_cosign', related: { visit_id: 'v1' }, context: { summary: 'test' } });
ok('create → open', t1.status === 'open');
ok('create → has due_at', !!t1.due_at);
ok('create → has _trans[0]', t1._trans.length === 1);

// 2. acknowledge
const t2 = T.acknowledge(ctx, t1.id);
ok('acknowledge → acknowledged', t2.status === 'acknowledged');
ok('acknowledged_by set', t2.acknowledged_by === 'usr_test');

// 3. resolve
const t3 = T.resolve(ctx, t1.id, { note: 'done' });
ok('resolve → resolved', t3.status === 'resolved');
ok('resolution_note saved', t3.resolution_note === 'done');

// 4. cancel
const t4 = T.create(ctx, { type: 'lab_review', related: { visit_id: 'v2' } });
const t4c = T.cancel(ctx, t4.id, { reason: 'no_longer_needed' });
ok('cancel → cancelled', t4c.status === 'cancelled');

// 5. escalate
const t5 = T.create(ctx, { type: 'esi2_physician_see', owner_role: 'resident_1', related: { visit_id: 'v3' } });
const t5e = T.escalate(ctx, t5.id, 'sla_breached');
ok('escalate → escalated', t5e.status === 'escalated');
ok('escalate → next role resident_senior', (t5e.escalated_to || []).some(e => e.role === 'resident_senior'));

// 6. listMine by owner
ctx.actor = { id: 'nurse1', role: 'nurse' };
const t6 = T.create(ctx, { type: 'med_due_alert', owner_role: 'nurse', owner_id: 'nurse1' });
const mine = T.listMine(ctx);
ok('listMine includes nurse1 task', mine.some(x => x.id === t6.id));

// 7. listOverdue
const t7 = T.create(ctx, { type: 'lab_review', sla_minutes: 0 });
t7.due_at = new Date(Date.now() - 10000).toISOString();
memStore.put('clinical_tasks', t7);
const overdue = T.listOverdue(ctx);
ok('listOverdue includes t7', overdue.some(x => x.id === t7.id));

// 8. stats
const stats = T.stats(ctx);
ok('stats.total > 0', stats.total > 0);
ok('stats.byType object', typeof stats.byType === 'object');

// 9. unknown type
let unknownThrew = false;
try { T.create(ctx, { type: 'nonexistent_xyz' }); } catch (e) { unknownThrew = true; }
ok('unknown type rejected', unknownThrew);

// 10. invalid ack state
let ackThrew = false;
try { T.acknowledge(ctx, t3.id); } catch (e) { ackThrew = true; }
ok('acknowledge resolved task rejected', ackThrew);

// 11. event: ed.visit.triaged (ESI 2) → 2 tasks
memBus.emit('ed.visit.triaged', { visit: { id: 'v_event', esiLevel: 2, chiefComplaint: 'CP', name: 'رضا' }, actor: ctx.actor });
const fromEvent = T.readAll(ctx).filter(t => t.related && t.related.visit_id === 'v_event');
ok('triaged ESI 2 → 2 tasks', fromEvent.length === 2);
ok('has esi2_physician_see', fromEvent.some(t => t.type === 'esi2_physician_see'));
ok('has esi2_nurse_see', fromEvent.some(t => t.type === 'esi2_nurse_see'));

// 12. event: ed.visit.triaged (ESI 3) → 0 tasks
memBus.emit('ed.visit.triaged', { visit: { id: 'v_esi3', esiLevel: 3 }, actor: ctx.actor });
const esi3Tasks = T.readAll(ctx).filter(t => t.related && t.related.visit_id === 'v_esi3');
ok('triaged ESI 3 → 0 tasks', esi3Tasks.length === 0);

// 13. event: ed.lab.resulted critical
memBus.emit('ed.lab.resulted', { lab: { id: 'lab1', visit_id: 'v_lab', patient_id: 'p1', test_type: 'troponin', is_critical: true, result_summary: '1.2' }, actor: ctx.actor });
const labTask = T.readAll(ctx).find(t => t.related && t.related.lab_id === 'lab1');
ok('critical lab → lab_critical_alert', labTask && labTask.type === 'lab_critical_alert');

// 14. event: ed.order.drafted high-alert
memBus.emit('ed.order.drafted', { order: { id: 'ord1', visitId: 'v_ord', patientId: 'p2', item: 'مورفین', isHighAlert: true }, actor: ctx.actor });
const ordTask = T.readAll(ctx).find(t => t.related && t.related.order_id === 'ord1');
ok('high-alert order → attending_cosign', ordTask && ordTask.type === 'attending_cosign');

// 15. event: ed.order.drafted normal
memBus.emit('ed.order.drafted', { order: { id: 'ord2', visitId: 'v_ord2', patientId: 'p3', item: 'استامینوفن', isHighAlert: false }, actor: ctx.actor });
const ordTask2 = T.readAll(ctx).find(t => t.related && t.related.order_id === 'ord2');
ok('normal order → order_cosign', ordTask2 && ordTask2.type === 'order_cosign');

// 16. event: consult.requested
memBus.emit('ed.consult.requested', { consult: { id: 'cs1', visitId: 'v_cs', patientId: 'p4', targetService: 'cardio', clinicalQuestion: 'CP', urgency: 'urgent' }, actor: ctx.actor });
const csTask = T.readAll(ctx).find(t => t.related && t.related.consult_id === 'cs1');
ok('consult requested → consult_accept task', csTask && csTask.type === 'consult_accept');

console.log('\n  Results: ' + pass + '/' + (pass + fail) + ' passed');
if (fail === 0) console.log('  ✅ ALL TASK TESTS PASSED');
else { console.log('  ❌ SOME TESTS FAILED'); process.exit(1); }
