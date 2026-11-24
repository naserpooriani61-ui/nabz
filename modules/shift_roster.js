'use strict';
const perms = require('../core/permissions');
const { optimize, T } = require('../core/domain/shift-planner-engine');

if (!perms.P['roster.generate']) perms.P['roster.generate'] = 'admin,head_nurse,supervisor_clinical';

const handlers = {
  generate: async (ctx) => {
    const { staff, days, rules, requests } = ctx.body || {};
    if (!staff || !days) throw new Error('اطلاعات پرسنل یا تعداد روزها ناقص است');

    const initialGrid = staff.map(() => Array(days).fill(0)); // 0 = 'off'
    const staffData = staff.map(s => ({
      ...s,
      locked: s.locked || Array(days).fill(false)
    }));

    const result = await optimize(initialGrid, staffData, rules || { minM: 2, minE: 2, minN: 2, maxConsec: 6, maxConsecNights: 3 }, requests || [], days, 3000);
    
    // Save to store
    const rosterId = ctx.store.uid('rost');
    const roster = {
      id: rosterId,
      date: new Date().toISOString(),
      grid: result.grid,
      staff: staff.map(s => ({ id: s.id, name: s.name })),
      cost: result.cost,
      status: 'draft'
    };
    ctx.store.put('rosters', roster);
    return { ok: true, roster };
  },
  
  list: (ctx) => {
    return { rosters: ctx.store.readAll('rosters') };
  }
};

module.exports = {
  handlers,
  routes: [
    { method: 'POST', path: '/api/shift-roster/generate', handler: 'generate', perm: 'roster.generate' },
    { method: 'GET', path: '/api/shift-roster/list', handler: 'list', perm: 'roster.generate' }
  ]
};
