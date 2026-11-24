'use strict';
const perms = require('../core/permissions');
const { optimizeRoster, SHIFTS } = require('../core/domain/shift-roster-engine');

if (!perms.P['nursing.shifts.view']) perms.P['nursing.shifts.view'] = 'admin,head_nurse,nurse,supervisor_clinical';
if (!perms.P['nursing.shifts.manage']) perms.P['nursing.shifts.manage'] = 'admin,head_nurse,supervisor_clinical';

const handlers = {
  getCoverage: (ctx) => {
    const { wardCode } = ctx.query || {};
    const store = ctx.store;
    const staff = store.readAll('users').filter(u => u.active && u.ward === wardCode && (u.role === 'nurse' || u.role === 'nurse_aide'));
    const rosters = store.readAll('shift_rosters').filter(r => r.wardCode === wardCode && r.status !== 'cancelled');
    
    const coverage = { M: 0, E: 0, N: 0, totalStaff: staff.length };
    const today = new Date().getDate();
    
    rosters.forEach(r => {
      if (r.grid) {
        r.grid.forEach((row, i) => {
          const shift = row[today - 1] || 'off';
          if (shift === 'morning' || shift === 'long') coverage.M++;
          if (shift === 'evening' || shift === 'long') coverage.E++;
          if (shift === 'night') coverage.N++;
        });
      }
    });

    return { ok: true, ward: wardCode, coverage, required: { M: 2, E: 2, N: 2 }, staffCount: staff.length };
  },

  generateRoster: async (ctx) => {
    const { wardCode, days = 30, rules } = ctx.body || {};
    const store = ctx.store;
    const users = store.readAll('users').filter(u => u.active && u.ward === wardCode && (u.role === 'nurse' || u.role === 'nurse_aide'));
    if (users.length === 0) throw new Error('پرسنل فعالی برای این بخش یافت نشد');

    const staffData = users.map(u => ({
      id: u.id, name: u.fullName, role: u.role,
      locked: Array(days).fill(false), maxNights: 10, maxConsec: 6, maxConsecNights: 3
    }));

    const requests = staffData.map(() => Array(days).fill(null));
    const initialGrid = staffData.map(() => Array(days).fill('off'));
    const defaultRules = { minM: 2, minE: 2, minN: 2, maxConsec: 6, maxConsecNights: 3, ...rules };

    const result = await optimizeRoster(initialGrid, staffData, defaultRules, requests, days, 3000);

    const rosterId = store.uid('rost');
    const roster = {
      id: rosterId, wardCode, date: new Date().toISOString(),
      grid: result.grid,
      staff: staffData.map(s => ({ id: s.id, name: s.name, role: s.role })),
      metrics: { cost: result.cost, generatedAt: new Date().toISOString() },
      status: 'draft'
    };
    store.put('shift_rosters', roster);
    return { ok: true, roster, metrics: result.cost };
  },

  submitRequest: async (ctx) => {
    const { staffId, month, year, shifts, notes } = ctx.body || {};
    if (!staffId || !month || !year) throw new Error('اطلاعات درخواست ناقص است');
    const store = ctx.store;
    const reqId = store.uid('req');
    const request = {
      id: reqId, staffId, month, year, shifts, notes,
      status: 'pending', createdAt: new Date().toISOString()
    };
    store.put('shift_requests', request);
    return { ok: true, request };
  },

  getRequests: (ctx) => {
    const { wardCode, status } = ctx.query || {};
    const store = ctx.store;
    const users = store.readAll('users').filter(u => u.ward === wardCode).map(u => u.id);
    let reqs = store.readAll('shift_requests').filter(r => users.includes(r.staffId));
    if (status) reqs = reqs.filter(r => r.status === status);
    
    const enriched = reqs.map(r => {
      const user = store.readAll('users').find(u => u.id === r.staffId);
      return { ...r, staffName: user ? user.fullName : 'نامشخص' };
    });
    return { ok: true, requests: enriched };
  },

  updateRequestStatus: (ctx) => {
    const { id, status } = ctx.body || {};
    const store = ctx.store;
    const req = store.get('shift_requests', id);
    if (!req) throw new Error('درخواست یافت نشد');
    req.status = status;
    store.put('shift_requests', req);
    return { ok: true, request: req };
  }
};

module.exports = {
  handlers,
  routes: [
    { method: 'GET', path: '/api/nursing/coverage', handler: 'getCoverage', perm: 'nursing.shifts.view' },
    { method: 'POST', path: '/api/nursing/roster/generate', handler: 'generateRoster', perm: 'nursing.shifts.manage' },
    { method: 'POST', path: '/api/nursing/shifts/request', handler: 'submitRequest', perm: 'nursing.shifts.view' },
    { method: 'GET', path: '/api/nursing/shifts/requests', handler: 'getRequests', perm: 'nursing.shifts.manage' },
    { method: 'POST', path: '/api/nursing/shifts/request/status', handler: 'updateRequestStatus', perm: 'nursing.shifts.manage' }
  ]
};
