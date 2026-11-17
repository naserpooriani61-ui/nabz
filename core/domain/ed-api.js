'use strict';
// core/domain/ed-api.js — هندلرها و مسیرهای اورژانس بر پایهٔ writer/board (به emergency.js الحاق می‌شود)
const W = require('./ed-visit-writer');
const B = require('./ed-board');
const esi = require('./ed-esi');

function extend(mod) {
  if (!mod || mod._edCoreExtended) return mod;
  mod._edCoreExtended = true;
  const H = mod.handlers, R = mod.routes;

  H.visitCreate = (ctx) => W.register(ctx, ctx.body || {});
  H.visitTriage = (ctx) => W.triage(ctx, ctx.params.id, ctx.body || {});
  H.edStats = (ctx) => B.getStats(ctx, (ctx.query || {}).days);
  H.edBoard = (ctx) => B.getBoard(ctx);
  H.visitTimeline = (ctx) => B.getTimeline(ctx, ctx.params.id);
  H.visitAction = (ctx) => W.act(ctx, ctx.params.id, ctx.params.action, ctx.body || {});
  H.visitRetriage = (ctx) => W.retriage(ctx, ctx.params.id, ctx.body || {});
  H.visitCosign = (ctx) => W.cosign(ctx, ctx.params.id);
  H.visitLink = (ctx) => W.linkPatient(ctx, ctx.params.id, (ctx.body || {}).patientId);
  H.edSuggestEsi = (ctx) => {
    const b = ctx.body || {};
    const v = b.visitId ? ctx.store.get('ed_visits', b.visitId) : null;
    const input = Object.assign({}, b);
    ['lifeSaving', 'highRisk', 'confused'].forEach(k => { input[k] = W.toBool(b[k]); });
    if (v) {
      if (input.age == null && input.ageYears == null) input.age = v.age;
      if (input.ageMonths == null) input.ageMonths = v.ageMonths;
      if (!input.vitals) input.vitals = W.latestVitals(ctx, v).vitals || {};
    }
    const s = esi.suggest(input);
    return b.chosenLevel != null ? Object.assign({}, s, { compare: esi.compare(s, b.chosenLevel) }) : s;
  };

  const reg = R.find(r => r.method === 'POST' && r.path === '/api/emergency/visits');
  if (reg) reg.perm = 'ed.register';   // منشی هم می‌تواند ثبت کند
  R.push(
    { method: 'GET',  path: '/api/emergency/board',                       handler: 'edBoard',        perm: 'ed.view' },
    { method: 'POST', path: '/api/emergency/esi/suggest',                 handler: 'edSuggestEsi',   perm: 'ed.view' },
    { method: 'GET',  path: '/api/emergency/visits/:id/timeline',         handler: 'visitTimeline',  perm: 'ed.view' },
    { method: 'POST', path: '/api/emergency/visits/:id/action/:action',   handler: 'visitAction',    perm: 'ed.view' },
    { method: 'POST', path: '/api/emergency/visits/:id/retriage',         handler: 'visitRetriage',  perm: 'ed.view' },
    { method: 'POST', path: '/api/emergency/visits/:id/cosign',           handler: 'visitCosign',    perm: 'ed.cosign' },
    { method: 'POST', path: '/api/emergency/visits/:id/link-patient',     handler: 'visitLink',      perm: 'ed.register' }
  );
  return mod;
}

module.exports = { extend };
