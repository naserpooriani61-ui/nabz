'use strict';
const perms = require('../core/permissions');
const { calcMandatoryHours } = require('../core/domain/shift-calculator');
const { optimize, generateInitialGrid, SHIFTS } = require('../core/domain/shift-planner');

if (!perms.P['roster.view']) perms.P['roster.view'] = 'admin,head_nurse,nurse,supervisor_clinical';
if (!perms.P['roster.manage']) perms.P['roster.manage'] = 'admin,head_nurse,supervisor_clinical';

const handlers = {
  submitRequest: async (ctx) => {
    const { staffId, month, year, shifts, prefs, notes } = ctx.body || {};
    if (!staffId || !month || !year) throw new Error('اطلاعات ناقص است');
    const store = ctx.store;
    const existing = store.readAll('shift_requests').find(r => r.staffId === staffId && r.month === month && r.year === year);
    const reqData = {
      id: existing ? existing.id : store.uid('req'),
      staffId, month, year, shifts, prefs: prefs || {}, notes,
      status: 'pending', submittedAt: new Date().toISOString()
    };
    if (existing) store.put('shift_requests', reqData);
    else store.put('shift_requests', reqData);
    return { ok: true, request: reqData };
  },

  getRequests: (ctx) => {
    const { month, year, status } = ctx.query || {};
    let reqs = ctx.store.readAll('shift_requests');
    if (month) reqs = reqs.filter(r => r.month == month && r.year == year);
    if (status) reqs = reqs.filter(r => r.status === status);
    return { requests: reqs };
  },

  updateRequestStatus: (ctx) => {
    const { id, status } = ctx.body || {};
    const store = ctx.store;
    const req = store.get('shift_requests', id);
    if (!req) throw new Error('درخواست یافت نشد');
    req.status = status;
    store.put('shift_requests', req);
    return { ok: true, request: req };
  },

  generateRoster: async (ctx) => {
    const { month, year, wardCode, rules } = ctx.body || {};
    const store = ctx.store;
    const allStaff = store.readAll('staff').filter(s => s.wardCode === wardCode && !s.exclude);
    if (allStaff.length === 0) throw new Error('پرسنلی برای این بخش یافت نشد');

    const staffData = allStaff.map(s => ({
      ...s,
      mandatoryHours: calcMandatoryHours(s),
      maxNights: s.maxNights || 10,
      maxConsec: s.maxConsec || 6,
      maxConsecNights: s.maxConsecNights || 3
    }));

    const allReqs = store.readAll('shift_requests').filter(r => r.month == month && r.year == year);
    const requestsMap = {};
    staffData.forEach(s => {
      const req = allReqs.find(r => r.staffId === s.id);
      requestsMap[s.id] = req ? req.shifts : Array(30).fill(null);
    });

    const daysInMonth = 30;
    const initialGrid = generateInitialGrid(staffData, daysInMonth);
    const defaultRules = { minM: 2, minE: 2, minN: 2, maxConsec: 6, maxConsecNights: 3, maxNights: 10, ...rules };

    const result = await optimize(initialGrid, staffData, defaultRules, requestsMap, daysInMonth, 8000);

    const rosterId = store.uid('rost');
    const roster = {
      id: rosterId, month, year, wardCode,
      grid: result.grid,
      metrics: { cost: result.cost, generatedAt: new Date().toISOString() },
      status: 'draft'
    };
    store.put('shift_rosters', roster);
    return { ok: true, roster, metrics: result.cost };
  }
};

module.exports = {
  handlers,
  routes: [
    { method: 'POST', path: '/api/roster/request', handler: 'submitRequest', perm: 'roster.view' },
    { method: 'GET', path: '/api/roster/requests', handler: 'getRequests', perm: 'roster.manage' },
    { method: 'POST', path: '/api/roster/request/status', handler: 'updateRequestStatus', perm: 'roster.manage' },
    { method: 'POST', path: '/api/roster/generate', handler: 'generateRoster', perm: 'roster.manage' }
  ]
};
