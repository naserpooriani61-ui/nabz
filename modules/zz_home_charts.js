'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Home chart endpoints (auto-fix)
//  home.js سه پنل chart دارد ولی endpoint ندارد — اینجا اضافه می‌کنیم
// ═══════════════════════════════════════════════════════════

const home = require('./home.js');
const { h } = require('../core/mod-helpers');

function chartMAR(ctx) {
  const mar = h(ctx, 'mar');
  const days = [];
  for (let d = 6; d >= 0; d--) days.push(new Date(Date.now() - d * 86400000).toISOString().slice(0, 10));
  const given = days.map(d => mar.filter(m => m.status === 'given' && (m.administeredAt || '').slice(0, 10) === d).length);
  const missed = days.map(d => mar.filter(m => m.status === 'missed' && (m.scheduledAt || '').slice(0, 10) === d).length);
  return {
    type: 'bars',
    labels: days.map(d => d.slice(5)),
    series: [
      { name: 'داده‌شده', color: '#10b981', values: given },
      { name: 'missed', color: '#ef4444', values: missed }
    ]
  };
}

function chartVitals(ctx) {
  const vitals = h(ctx, 'vitals');
  const days = [];
  for (let d = 6; d >= 0; d--) days.push(new Date(Date.now() - d * 86400000).toISOString().slice(0, 10));
  const values = days.map(d => {
    const arr = vitals.filter(v => (v.recordedAt || '').slice(0, 10) === d);
    if (!arr.length) return 0;
    return Math.round((arr.reduce((s, v) => s + (v.news2 || 0), 0) / arr.length) * 10) / 10;
  });
  return {
    type: 'line',
    labels: days.map(d => d.slice(5)),
    series: [{ name: 'NEWS2', color: '#06b6d4', values }]
  };
}

function chartKPI(ctx) {
  const kpis = h(ctx, 'kpis').slice(0, 5);
  return {
    type: 'bars',
    labels: kpis.map(k => (k.name || '').slice(0, 15)),
    series: [{
      name: 'آخرین مقدار',
      color: '#8b5cf6',
      values: kpis.map(k => {
        const ms = k.measurements || [];
        return ms.length ? ms[ms.length - 1].value : 0;
      })
    }]
  };
}

home.handlers.chartMAR = chartMAR;
home.handlers.chartVitals = chartVitals;
home.handlers.chartKPI = chartKPI;

home.routes.push({ method:'GET', path:'/api/home/charts/mar',    handler:'chartMAR',    perm:null });
home.routes.push({ method:'GET', path:'/api/home/charts/vitals', handler:'chartVitals', perm:null });
home.routes.push({ method:'GET', path:'/api/home/charts/kpi',    handler:'chartKPI',    perm:'quality.view' });

module.exports = { handlers:{}, routes:[], panels:[] };
console.log('[zz_home_charts] ✓ 3 chart endpoints added to home');
