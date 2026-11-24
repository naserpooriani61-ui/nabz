'use strict';
// core/domain/task-dispatcher.js — converts domain events into clinical tasks
// Only this module creates tasks from events. All business logic lives here.

const T = require('./clinical-tasks');
const _installedBuses = new WeakSet();
let _booted = false;   // module-level install flag (was missing — runtime bug)

function install(bus, baseCtx) {
  if (_booted) { console.log('[task-dispatcher] already installed'); return; }
  if (!bus || typeof bus.on !== 'function') {
    console.warn('[task-dispatcher] bus.on not available — skipping');
    return;
  }
  _booted = true;

  const store = baseCtx && baseCtx.store;
  const mkCtx = (actor) => ({
    store: store,
    bus: bus,
    actor: actor || { id: 'system', role: 'system' },
    now: () => new Date().toISOString(),
    uid: (p) => store.uid(p)
  });

  const safe = (label, fn) => {
    try { fn(); } catch (e) { console.warn('[task-dispatcher] ' + label + ':', e.message); }
  };

  // ── 1. visit.triaged (ESI ≤ 2) ─────────────────────────────
  bus.on('ed.visit.triaged', (payload) => safe('triaged', () => {
    const v = (payload && payload.visit) || payload || {};
    const esi = Number(v.esiLevel);
    if (!esi || esi > 2) return;
    const c = mkCtx(payload && payload.actor);
    const visitId = v.id, pid = v.patientId || v.id;
    T.create(c, {
      type: 'esi2_physician_see',
      sla_minutes: esi === 1 ? 2 : 10,
      related: { visit_id: visitId, patient_id: pid },
      context: { summary: 'ESI ' + esi + ' — ' + (v.chiefComplaint || '—'), patient_name: v.name || '—', esi: esi },
      owner_role: 'resident_1',
      owner_id: v.assignedDoctor || null
    });
    T.create(c, {
      type: 'esi2_nurse_see',
      sla_minutes: esi === 1 ? 2 : 5,
      related: { visit_id: visitId, patient_id: pid },
      context: { summary: 'ESI ' + esi + ' — ' + (v.chiefComplaint || '—'), patient_name: v.name || '—', esi: esi },
      owner_role: 'nurse',
      owner_id: v.assignedNurse || null
    });
  }));

  // ── 2. order.drafted ────────────────────────────────────────
  bus.on('ed.order.drafted', (payload) => safe('order.drafted', () => {
    const o = (payload && payload.order) || payload || {};
    const c = mkCtx(payload && payload.actor);
    const highAlert = o.isHighAlert === true || o.attending_required === true;
    T.create(c, {
      type: highAlert ? 'attending_cosign' : 'order_cosign',
      related: { visit_id: o.visitId, patient_id: o.patientId, order_id: o.id },
      context: {
        summary: (highAlert ? '⚠️ ' : '') + 'دستور: ' + (o.item || o.drugName || '—'),
        author: (payload && payload.actor && payload.actor.fullName) || '—',
        high_alert: highAlert
      }
    });
  }));

  // ── 3. lab.resulted ─────────────────────────────────────────
  bus.on('ed.lab.resulted', (payload) => safe('lab.resulted', () => {
    const lab = (payload && payload.lab) || payload || {};
    const c = mkCtx(payload && payload.actor);
    const crit = lab.is_critical === true;
    T.create(c, {
      type: crit ? 'lab_critical_alert' : 'lab_review',
      related: { visit_id: lab.visit_id, patient_id: lab.patient_id, lab_id: lab.id },
      context: {
        summary: (crit ? '⚠️ ' : '') + (lab.test_type || 'آزمایش') + ': ' + (lab.result_summary || '—'),
        is_critical: crit
      }
    });
  }));

  // ── 4. consult.requested ────────────────────────────────────
  bus.on('ed.consult.requested', (payload) => safe('consult.requested', () => {
    const ct = (payload && payload.consult) || payload || {};
    const c = mkCtx(payload && payload.actor);
    T.create(c, {
      type: 'consult_accept',
      sla_minutes: ct.urgency === 'urgent' ? 15 : 60,
      priority: ct.urgency === 'urgent' ? 'urgent' : 'routine',
      related: { visit_id: ct.visitId, patient_id: ct.patientId, consult_id: ct.id },
      context: {
        summary: 'مشاوره ' + (ct.targetService || '—') + ': ' + (ct.clinicalQuestion || '—'),
        urgency: ct.urgency
      }
    });
  }));

  // ── 5. mar.overdue ──────────────────────────────────────────
  bus.on('ed.mar.overdue', (payload) => safe('mar.overdue', () => {
    const m = (payload && payload.mar) || payload || {};
    const c = mkCtx(payload && payload.actor);
    T.create(c, {
      type: 'med_overdue',
      related: { visit_id: m.visitId, patient_id: m.patientId, mar_id: m.id },
      context: { summary: 'داروی عقب‌افتاده: ' + (m.drugName || '—') + ' ' + (m.dose || '') },
      owner_role: 'nurse',
      owner_id: m.assignedNurse || null
    });
  }));

  // ── 6. clinical deterioration (NEWS2 alert) ─────────────────
  bus.on('ed.visit.news2.alert', (payload) => safe('news2.alert', () => {
    const v = (payload && payload.visit) || payload || {};
    const c = mkCtx(payload && payload.actor);
    T.create(c, {
      type: 'clinical_deterioration',
      related: { visit_id: v.id, patient_id: v.patientId || v.id },
      context: { summary: 'NEWS2 = ' + (payload.news2 || '?') + ' — بیمار بدتر شد' }
    });
  }));

  console.log('[task-dispatcher] installed — listening to 6 events');
}

module.exports = { install };
