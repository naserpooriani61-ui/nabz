'use strict';
// modules/supervisor.js — Supervisor Dashboard module (9 tabs)
const perms = require('../core/permissions');
const S = require('../core/domain/supervisor-service');
const H = require('../core/domain/shift-handover-writer');
const WR = require('../core/domain/ward-round-writer');
const SupRounds = require('../core/domain/supervisor-rounds');
const SR = require('../core/domain/supervisor-report-writer');

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
  roundAutoMetrics:(ctx) => WR.getAutoMetrics(ctx, ctx.query && ctx.query.wardCode),
  roundAddDetail:    (ctx) => WR.addDetail(ctx, ctx.params.id, ctx.params.key, ctx.body || {}),
  roundUpdateDetail: (ctx) => WR.updateDetail(ctx, ctx.params.id, ctx.params.key, ctx.params.detailId, ctx.body || {}),
  roundRemoveDetail: (ctx) => WR.removeDetail(ctx, ctx.params.id, ctx.params.key, ctx.params.detailId),
  roundCreate: (ctx) => SupRounds.create(ctx, ctx.body || {}),
  roundAddItem: (ctx) => SupRounds.addDynamicItem(ctx, ctx.params.id, ctx.params.array, ctx.body || {}),
  roundRemoveItem: (ctx) => SupRounds.removeDynamicItem(ctx, ctx.params.id, ctx.params.array, ctx.params.itemId),
  roundUpdateField: (ctx) => SupRounds.updateField(ctx, ctx.params.id, ctx.params.field, ctx.body.value),
  roundSubmit: (ctx) => SupRounds.submit(ctx, ctx.params.id),
  roundSign: (ctx) => SupRounds.sign(ctx, ctx.params.id),
  roundListToday: (ctx) => SupRounds.listToday(ctx),
  reportCreate: (ctx) => SupRounds.create(ctx, ctx.body || {}),
  reportUpdate: (ctx) => SR.update(ctx, ctx.params.id, ctx.body || {}),
  reportAddItem: (ctx) => SupRounds.addDynamicItem(ctx, ctx.params.id, ctx.params.array, ctx.body || {}),
  reportRemoveItem: (ctx) => SupRounds.removeDynamicItem(ctx, ctx.params.id, ctx.params.array, ctx.params.itemId),
  reportUpdateItem: (ctx) => SR.updateDynamicItem(ctx, ctx.params.id, ctx.params.array, ctx.params.itemId, ctx.body || {}),
  reportSubmit: (ctx) => SupRounds.submit(ctx, ctx.params.id),
  reportSign: (ctx) => SupRounds.sign(ctx, ctx.params.id),
  reportToday: (ctx) => SupRounds.listToday(ctx),
  reportRecent: (ctx) => SR.listRecent(ctx, ctx.query && ctx.query.days),
  addDynamicItem: (ctx) => WR.addDynamicItem(ctx, ctx.params.id, ctx.params.array, ctx.body || {}),
  removeDynamicItem: (ctx) => WR.removeDynamicItem(ctx, ctx.params.id, ctx.params.array, ctx.params.itemId),
  updateDynamicItem: (ctx) => WR.updateDynamicItem(ctx, ctx.params.id, ctx.params.array, ctx.params.itemId, ctx.body || {}),
  addDeath: (ctx) => WR.addDeath(ctx, ctx.params.id, ctx.body || {}),
  removeDeath: (ctx) => WR.removeDeath(ctx, ctx.params.id, ctx.params.did),
  addICUWaiting: (ctx) => WR.addICUWaiting(ctx, ctx.params.id, ctx.body || {}),
  removeICUWaiting: (ctx) => WR.removeICUWaiting(ctx, ctx.params.id, ctx.params.iid)
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
    { method: 'GET',  path: '/api/supervisor/round/auto-metrics',      handler: 'roundAutoMetrics',perm: 'supervisor.view' },
    { method: 'POST', path: '/api/supervisor/round/:id/detail/:key',                  handler: 'roundAddDetail',    perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/round/:id/detail/:key/:detailId',        handler: 'roundUpdateDetail', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/round/:id/detail/:key/:detailId/remove', handler: 'roundRemoveDetail', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/rounds', handler: 'roundCreate', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/rounds/:id/array/:array', handler: 'roundAddItem', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/rounds/:id/array/:array/:itemId/remove', handler: 'roundRemoveItem', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/rounds/:id/field/:field', handler: 'roundUpdateField', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/rounds/:id/submit', handler: 'roundSubmit', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/rounds/:id/sign', handler: 'roundSign', perm: 'supervisor.handover' },
    { method: 'GET', path: '/api/supervisor/rounds/today', handler: 'roundListToday', perm: 'supervisor.view' },
    { method: 'POST', path: '/api/supervisor/report', handler: 'reportCreate', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/report/:id', handler: 'reportUpdate', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/report/:id/array/:array', handler: 'reportAddItem', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/report/:id/array/:array/:itemId/remove', handler: 'reportRemoveItem', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/report/:id/array/:array/:itemId', handler: 'reportUpdateItem', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/report/:id/submit', handler: 'reportSubmit', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/report/:id/sign', handler: 'reportSign', perm: 'supervisor.handover' },
    { method: 'GET', path: '/api/supervisor/report/today', handler: 'reportToday', perm: 'supervisor.view' },
    { method: 'GET', path: '/api/supervisor/report/recent', handler: 'reportRecent', perm: 'supervisor.view' },
    { method: 'POST', path: '/api/supervisor/round/:id/array/:array', handler: 'addDynamicItem', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/round/:id/array/:array/:itemId/remove', handler: 'removeDynamicItem', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/round/:id/array/:array/:itemId', handler: 'updateDynamicItem', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/round/:id/death', handler: 'addDeath', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/round/:id/death/:did/remove', handler: 'removeDeath', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/round/:id/icu-waiting', handler: 'addICUWaiting', perm: 'supervisor.handover' },
    { method: 'POST', path: '/api/supervisor/round/:id/icu-waiting/:iid/remove', handler: 'removeICUWaiting', perm: 'supervisor.handover' }
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
