'use strict';
const signature = require('../core/signature');
const sm = require('../core/state-machine');

function h(ctx, c) { try { const r = ctx.store.readAll(c); return Array.isArray(r) ? r : []; } catch (_) { return []; } }
function sd(x) { if (!x) return 0; const d = new Date(x); return isNaN(d.getTime()) ? 0 : d.getTime(); }
function sign(ctx, coll, rec, action) {
  const sig = signature.signAction({ userId: ctx.actor.id, userName: ctx.actor.username, role: ctx.actor.role,
    action, collection: coll, recordId: rec.id, data: rec });
  ctx.store.put('signatures', sig);
  rec.lastSignatureId = sig.id;
  return sig;
}

const CODE_DEFS = {
  '247': { label: 'کد ۲۴۷ — STEMI', steps: ['ECG','Troponin','CathLab'] },
  '724': { label: 'کد ۷۲۴ — Stroke', steps: ['CT','Neuro','Thrombolysis'] },
  '99':  { label: 'کد ۹۹ — CPR', steps: ['CPR','ROSC/Death'] }
};

const handlers = {
  // ─── Visits ───
  visits: (ctx) => {
    let items = h(ctx, 'ed_visits');
    if (ctx.query.status) items = items.filter(v => v.status === ctx.query.status);
    items.sort((a, b) => sd(b.arrivalAt) - sd(a.arrivalAt));
    return { items, total: items.length };
  },
  visitCreate: (ctx) => {
    const b = ctx.body;
    if (!b.patientName || !b.chiefComplaint) throw ctx.E.badRequest('missing_fields');
    const rec = { id: ctx.uid('edv'), patientName: b.patientName, age: b.age, sex: b.sex,
      arrivalAt: ctx.now(), arrivalMode: b.arrivalMode || 'walk_in',
      chiefComplaint: b.chiefComplaint, vitals: b.vitals || null,
      esiLevel: b.esiLevel || null, status: 'waiting_triage' };
    ctx.store.put('ed_visits', rec);
    ctx.bus.emit('ed.visit.created', { record: rec, actor: ctx.actor });
    return rec;
  },
  visitTriage: (ctx) => {
    const v = ctx.store.get('ed_visits', ctx.params.id);
    if (!v) throw ctx.E.notFound('visit_not_found');
    const level = Number(ctx.body.esiLevel);
    if (!level || level < 1 || level > 5) throw ctx.E.badRequest('invalid_esi');
    const r = sm.transition('ed_visit', v, 'triage', ctx.actor, {});
    if (!r.ok) throw ctx.E.conflict(r.reason);
    v.esiLevel = level; v.status = r.to; v.triagedAt = ctx.now(); v.triagedBy = ctx.actor.id;
    ctx.store.put('ed_visits', v);
    sign(ctx, 'ed_visits', v, 'triage');
    ctx.bus.emit('ed.triage.completed', { record: v, actor: ctx.actor });
    if (level <= 2) ctx.bus.emit('triage.critical', { record: v, actor: ctx.actor });
    return v;
  },

  // ─── Codes ───
  codes: (ctx) => {
    let items = h(ctx, 'ed_codes');
    if (ctx.query.status) items = items.filter(c => c.status === ctx.query.status);
    items.sort((a, b) => sd(b.activatedAt) - sd(a.activatedAt));
    return { items, total: items.length };
  },
  codeActivate: (ctx) => {
    const b = ctx.body;
    if (!b.code || !CODE_DEFS[b.code]) throw ctx.E.badRequest('invalid_code');
    if (!b.patientName) throw ctx.E.badRequest('patient_name_required');
    const def = CODE_DEFS[b.code];
    const rec = { id: ctx.uid('code'), code: b.code, codeLabel: def.label,
      patientName: b.patientName, activatedAt: ctx.now(), activatedBy: ctx.actor.id,
      status: 'active', steps: def.steps.map(s => ({ name: s, status: 'pending', completedAt: null })) };
    ctx.store.put('ed_codes', rec);
    sign(ctx, 'ed_codes', rec, 'activate');
    ctx.bus.emit('ed.code.activated', { record: rec, actor: ctx.actor });
    return rec;
  },
  codeStep: (ctx) => {
    const c = ctx.store.get('ed_codes', ctx.params.id);
    if (!c) throw ctx.E.notFound('code_not_found');
    if (c.status !== 'active') throw ctx.E.conflict('code_not_active');
    const step = c.steps.find(s => s.name === ctx.body.step);
    if (!step) throw ctx.E.notFound('step_not_found');
    step.status = 'completed'; step.completedAt = ctx.now(); step.completedBy = ctx.actor.id;
    ctx.store.put('ed_codes', c);
    return c;
  },
  codeClose: (ctx) => {
    const c = ctx.store.get('ed_codes', ctx.params.id);
    if (!c) throw ctx.E.notFound('code_not_found');
    const r = sm.transition('ed_code', c, 'close', ctx.actor, {});
    if (!r.ok) throw ctx.E.conflict(r.reason);
    c.status = 'closed'; c.closedAt = ctx.now(); c.outcome = ctx.body.outcome || null;
    ctx.store.put('ed_codes', c);
    ctx.bus.emit('ed.code.closed', { record: c, actor: ctx.actor });
    return c;
  },

  // ─── MCI ───
  mci: (ctx) => {
    const items = h(ctx, 'ed_mci');
    return { items, total: items.length };
  },
  mciActivate: (ctx) => {
    const b = ctx.body;
    if (!b.alertLevel) throw ctx.E.badRequest('alert_level_required');
    const rec = { id: ctx.uid('mci'), alertLevel: b.alertLevel,
      incidentType: b.incidentType || 'unknown', location: b.location || '',
      estimatedCasualties: Number(b.estimatedCasualties) || 0,
      activatedAt: ctx.now(), activatedBy: ctx.actor.id, status: 'active',
      casualties: { red: 0, yellow: 0, green: 0, black: 0 } };
    ctx.store.put('ed_mci', rec);
    ctx.bus.emit('ed.mci.activated', { record: rec, actor: ctx.actor });
    return rec;
  },

  // ─── Stats ───
  edStats: (ctx) => {
    const visits = h(ctx, 'ed_visits');
    const codes = h(ctx, 'ed_codes');
    const mci = h(ctx, 'ed_mci');
    const active = visits.filter(v => !['closed','discharged'].includes(v.status));
    const today = visits.filter(v => sd(v.arrivalAt) > Date.now() - 86400000);
    return {
      today: today.length, active: active.length,
      waiting: active.filter(v => v.status === 'waiting_triage' || v.status === 'waiting_doctor').length,
      boarding: active.filter(v => v.status === 'boarding').length,
      critical: active.filter(v => v.esiLevel <= 2).length,
      esiDist: { 1: active.filter(v => v.esiLevel === 1).length, 2: active.filter(v => v.esiLevel === 2).length,
                 3: active.filter(v => v.esiLevel === 3).length, 4: active.filter(v => v.esiLevel === 4).length,
                 5: active.filter(v => v.esiLevel === 5).length },
      codesActive: codes.filter(c => c.status === 'active').length,
      mciActive: mci.filter(m => m.status === 'active').length
    };
  }
};

module.exports = {
  handlers,
  routes: [
    { method: 'GET',  path: '/api/emergency/visits',      handler: 'visits',       perm: 'ed.view' },
    { method: 'POST', path: '/api/emergency/visits',      handler: 'visitCreate',  perm: 'ed.triage' },
    { method: 'GET',  path: '/api/emergency/codes',       handler: 'codes',        perm: 'ed.view' },
    { method: 'POST', path: '/api/emergency/codes',       handler: 'codeActivate', perm: 'ed.code.activate' },
    { method: 'GET',  path: '/api/emergency/mci',         handler: 'mci',          perm: 'ed.view' },
    { method: 'POST', path: '/api/emergency/mci',         handler: 'mciActivate',  perm: 'ed.mci.activate' },
    { method: 'GET',  path: '/api/emergency/stats',       handler: 'edStats',      perm: 'ed.view' },
    { method: 'POST', path: '/api/emergency/visits/:id/triage', handler: 'visitTriage', perm: 'ed.triage' },
    { method: 'POST', path: '/api/emergency/codes/:id/step', handler: 'codeStep',  perm: 'ed.code.activate' },
    { method: 'POST', path: '/api/emergency/codes/:id/close', handler: 'codeClose', perm: 'ed.code.activate' }
  
  ],
  panels: [
    { id: 'ed',    title: 'اورژانس',  icon: '🚨', perm: 'ed.view',        kind: 'list',  api: '/api/emergency/visits', fields: ['patientName','esiLevel','chiefComplaint','status'] },
    { id: 'codes', title: 'کدها',     icon: '🔴', perm: 'ed.view',        kind: 'list',  api: '/api/emergency/codes',  fields: ['codeLabel','patientName','status'] },
    { id: 'mci',   title: 'MCI',      icon: '🌐', perm: 'ed.view',        kind: 'list',  api: '/api/emergency/mci',    fields: ['alertLevel','incidentType','status'] },
    { id: 'stats', title: 'آمار ED',   icon: '📊', perm: 'ed.view',        kind: 'stats', api: '/api/emergency/stats' }
  ]
};
