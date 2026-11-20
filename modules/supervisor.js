'use strict';
// modules/supervisor.js — Supervisor Dashboard module (9 tabs)
const perms = require('../core/permissions');
const S = require('../core/domain/supervisor-service');
const H = require('../core/domain/shift-handover-writer');
const WR = require('../core/domain/ward-round-writer');

// ─── permissions ───
const SUP_VIEW_ROLES = 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,quality_officer,head_nurse,matron';
if (!perms.P['supervisor.view']) perms.P['supervisor.view'] = SUP_VIEW_ROLES;
if (!perms.P['supervisor.handover']) perms.P['supervisor.handover'] = 'admin,nursing_director,supervisor_senior,supervisor_clinical,head_nurse';

const handlers = {
  // ─── data (read-only) ───
  board:      (ctx) => S.getFullBoard(ctx),
  overview:   (ctx) => S.getOverview(ctx),
  wards:      (ctx) => S.getWards(ctx),
  emergency:  (ctx) => S.getEmergency(ctx),
  or:         (ctx) => S.getOperatingRooms(ctx),
  staff:      (ctx) => S.getStaff(ctx),
  safety:     (ctx) => S.getSafety(ctx),
  incidents:  (ctx) => S.getIncidents(ctx, ctx.query && ctx.query.days),
  analytics:  (ctx) => S.getAnalytics(ctx, ctx.query && ctx.query.days),

  // ─── shift handover (write via writer) ───
  handoverCreate:  (ctx) => H.create(ctx, ctx.body || {}),
  handoverToday:   (ctx) => H.listToday(ctx),
  handoverRecent:  (ctx) => H.listRecent(ctx, ctx.query && ctx.query.days),
  handoverSign:    (ctx) => H.sign(ctx, ctx.params.id),
  handoverReceive: (ctx) => H.receive(ctx, ctx.params.id),

  // ─── ward round ───
  roundCreate:      (ctx) => WR.create(ctx, ctx.body || {}),
  roundToday:       (ctx) => WR.listToday(ctx),
  roundCoverage:    (ctx) => WR.getCoverage(ctx),
  roundStats:       (ctx) => WR.getStats(ctx, ctx.query && ctx.query.days),
  roundChecklist:   (ctx) => WR.updateChecklist(ctx, ctx.params.id, ctx.params.cat, ctx.body || {}),
  roundAddFinding:  (ctx) => WR.addFinding(ctx, ctx.params.id, ctx.body || {}),
  roundRemoveFind:  (ctx) => WR.removeFinding(ctx, ctx.params.id, ctx.params.fid),
  roundFinalNotes:  (ctx) => WR.setFinalNotes(ctx, ctx.params.id, (ctx.body || {}).text),
  roundSubmit:      (ctx) => WR.submit(ctx, ctx.params.id),
  roundSign:        (ctx) => WR.sign(ctx, ctx.params.id),
  roundMetrics:    (ctx) => WR.updateMetrics(ctx, ctx.params.id, ctx.body || {}),
  roundStaffing:   (ctx) => WR.updateStaffing(ctx, ctx.params.id, ctx.body || {}),
  roundRefreshAuto:(ctx) => WR.refreshAutoMetrics(ctx, ctx.params.id),
  roundAutoMetrics:(ctx) => WR.getAutoMetrics(ctx, ctx.query && ctx.query.wardCode)
};

module.exports = {
  handlers,
  routes: [
    { method: 'GET',  path: '/api/supervisor/board',                  handler: 'board',           perm: 'supervisor.view' },
    { method: 'GET',  path: '/api/supervisor/overview',               handler: 'overview',        perm: 'supervisor.view' },
    { method: 'GET',  path: '/api/supervisor/wards',                  handler: 'wards',           perm: 'supervisor.view' },
    { method: 'GET',  path: '/api/supervisor/emergency',              handler: 'emergency',       perm: 'supervisor.view' },
    { method: 'GET',  path: '/api/supervisor/or',                     handler: 'or',              perm: 'supervisor.view' },
    { method: 'GET',  path: '/api/supervisor/staff',                  handler: 'staff',           perm: 'supervisor.view' },
    { method: 'GET',  path: '/api/supervisor/safety',                 handler: 'safety',          perm: 'supervisor.view' },
    { method: 'GET',  path: '/api/supervisor/incidents',              handler: 'incidents',       perm: 'supervisor.view' },
    { method: 'GET',  path: '/api/supervisor/analytics',              handler: 'analytics',       perm: 'supervisor.view' },

    { method: 'POST', path: '/api/supervisor/handover',               handler: 'handoverCreate',  perm: 'supervisor.handover' },
    { method: 'GET',  path: '/api/supervisor/handover/today',         handler: 'handoverToday',   perm: 'supervisor.view' },
    { method: 'GET',  path: '/api/supervisor/handover/recent',        handler: 'handoverRecent',  perm: 'supervisor.view' },
    { method: 'POST', path: '/api/supervisor/handover/:id/sign',      handler: 'handoverSign',    perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/handover/:id/receive',   handler: 'handoverReceive', perm: 'supervisor.handover' },

    // ─── ward round ───
    { method: 'POST', path: '/api/supervisor/round',                   handler: 'roundCreate',     perm: 'supervisor.handover' },
    { method: 'GET',  path: '/api/supervisor/round/today',             handler: 'roundToday',      perm: 'supervisor.view' },
    { method: 'GET',  path: '/api/supervisor/round/coverage',          handler: 'roundCoverage',   perm: 'supervisor.view' },
    { method: 'GET',  path: '/api/supervisor/round/stats',             handler: 'roundStats',      perm: 'supervisor.view' },
    { method: 'POST', path: '/api/supervisor/round/:id/checklist/:cat',handler: 'roundChecklist',  perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/round/:id/finding',       handler: 'roundAddFinding', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/round/:id/finding/:fid/remove', handler: 'roundRemoveFind', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/round/:id/final-notes',   handler: 'roundFinalNotes', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/round/:id/submit',        handler: 'roundSubmit',     perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/round/:id/sign',          handler: 'roundSign',       perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/round/:id/metrics',       handler: 'roundMetrics',    perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/round/:id/staffing',      handler: 'roundStaffing',   perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/round/:id/refresh-auto',  handler: 'roundRefreshAuto',perm: 'supervisor.handover' },
    { method: 'GET',  path: '/api/supervisor/round/auto-metrics',      handler: 'roundAutoMetrics',perm: 'supervisor.view' }
  ],
  panels: [
    {
      id: 'supervisor_dashboard',
      title: '🏛️ داشبورد سوپروایزر',
      icon: '🏛️',
      perm: 'supervisor.view',
      kind: 'supervisor_dashboard',
      api: '/api/supervisor/board'
    }
  ]
};
