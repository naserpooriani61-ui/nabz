'use strict';
const store = require('../core/store');
const { h, sd } = require('../core/mod-helpers');

function today() { return require("../core/time").todayTehran(); }

function overview(ctx) {
  const patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  const vitals = h(ctx, 'vitals');
  const mar = h(ctx, 'mar');
  const beds = h(ctx, 'beds');
  const edVisits = h(ctx, 'ed_visits');
  const days = [];
  for (let d = 6; d >= 0; d--) {
    const date = new Date(Date.now() - d * 86400000);
    days.push(date.toISOString().slice(0, 10));
  }

  // ─── NEWS trend per ward ───
  const newsByDay = {};
  for (const v of vitals) {
    const dk = (v.recordedAt || '').slice(0, 10);
    if (!days.includes(dk)) continue;
    if (!newsByDay[dk]) newsByDay[dk] = {};
    const w = v.wardCode || '?';
    if (!newsByDay[dk][w]) newsByDay[dk][w] = [];
    newsByDay[dk][w].push(v.news2 || 0);
  }
  const wardCount = {};
  for (const p of patients) wardCount[p.wardCode] = (wardCount[p.wardCode] || 0) + 1;
  const topWards = Object.entries(wardCount).sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => x[0]);
  const newsTrend = {
    labels: days.map(d => { const [_, m, dd] = d.split('-'); return dd + '/' + m; }),
    series: topWards.map((w, i) => ({
      label: w,
      color: ['#06b6d4','#8b5cf6','#f59e0b','#10b981'][i],
      values: days.map(dk => {
        const arr = newsByDay[dk]?.[w] || [];
        return arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
      })
    }))
  };

  // ─── MAR trend ───
  const marByDay = {};
  for (const d of days) marByDay[d] = { given: 0, missed: 0, refused: 0 };
  for (const m of mar) {
    const dk = (m.scheduledAt || '').slice(0, 10);
    if (!marByDay[dk]) continue;
    if (m.status === 'given') marByDay[dk].given++;
    else if (m.status === 'missed') marByDay[dk].missed++;
    else if (m.status === 'refused') marByDay[dk].refused++;
  }
  const marTrend = {
    labels: days.map(d => { const [_, m, dd] = d.split('-'); return dd + '/' + m; }),
    series: [
      { label: 'توزیع', color: '#10b981', values: days.map(d => marByDay[d].given) },
      { label: 'missed', color: '#ef4444', values: days.map(d => marByDay[d].missed) }
    ]
  };

  // ─── Occupancy by group ───
  const sina = require('../core/sina');
  const wardToGroup = {};
  for (const w of sina.WARDS) wardToGroup[w.code] = w.group;
  const groupStats = {};
  for (const b of beds) {
    const g = wardToGroup[b.wardCode] || 'other';
    if (!groupStats[g]) groupStats[g] = { total: 0, occupied: 0 };
    groupStats[g].total++;
    if (b.status === 'occupied') groupStats[g].occupied++;
  }
  const groupLabels = { critical:'ویژه', emergency:'اورژانس', surgical:'جراحی', internal:'داخلی', neuro:'نورولوژی', oncology:'آنکولوژی', special:'ویژه', vip:'VIP', admin:'اداری', other:'سایر' };
  const occupancy = Object.entries(groupStats).map(([g, s]) => ({
    group: g, label: groupLabels[g] || g,
    total: s.total, occupied: s.occupied,
    pct: s.total ? Math.round((s.occupied / s.total) * 100) : 0,
    level: s.total && s.occupied / s.total >= 0.85 ? 'dng' : s.total && s.occupied / s.total >= 0.65 ? 'warn' : 'ok'
  })).sort((a, b) => b.pct - a.pct);

  // ─── ESI distribution ───
  const esi = { 1:0, 2:0, 3:0, 4:0, 5:0 };
  const activeED = edVisits.filter(v => !['closed','discharged'].includes(v.status));
  for (const v of activeED) if (v.esiLevel && esi[v.esiLevel] != null) esi[v.esiLevel]++;

  // ─── Top critical patients ───
  const lastVital = {};
  for (const v of vitals) {
    if (!lastVital[v.patientId] || sd(v.recordedAt) > sd(lastVital[v.patientId].recordedAt)) lastVital[v.patientId] = v;
  }
  const topCritical = patients
    .filter(p => lastVital[p.id] && (lastVital[p.id].news2 || 0) >= 5)
    .map(p => ({
      id: p.id, name: p.firstName + ' ' + p.lastName,
      ward: p.wardCode, bed: p.bedNumber,
      news: lastVital[p.id].news2 || 0,
      dx: p.diagnosis
    }))
    .sort((a, b) => b.news - a.news)
    .slice(0, 8);

  // ─── Alerts feed ───
  const sepsis = h(ctx, 'sepsis').filter(s => ['suspected','confirmed','septic_shock'].includes(s.status));
  const crisis = h(ctx, 'crisis_sessions').filter(c => c.status === 'active');
  const incidents = h(ctx, 'incidents').filter(i => i.status !== 'closed');

  return {
    newsTrend, marTrend, occupancy,
    esi,
    topCritical,
    sepsisAlerts: sepsis.length,
    crisisActive: crisis.length > 0,
    openIncidents: incidents.length,
    generatedAt: new Date().toISOString()
  };
}

// ─── NEWS sparkline (last 24h for a specific patient) ───
function patientTrend(ctx) {
  const pid = ctx.params.patientId;
  const vitals = h(ctx, 'vitals').filter(v => v.patientId === pid && v.news2 != null)
    .filter(v => sd(v.recordedAt) > Date.now() - 7 * 86400000)
    .sort((a, b) => sd(a.recordedAt) - sd(b.recordedAt));
  return {
    patientId: pid,
    points: vitals.map(v => ({ t: v.recordedAt, y: v.news2, hr: v.hr, spo2: v.spo2 }))
  };
}

module.exports = {
  handlers: { overview, patientTrend },
  routes: [
    { method: 'GET', path: '/api/analytics/overview', handler: 'overview', perm: null },
    { method: 'GET', path: '/api/analytics/patient/:patientId', handler: 'patientTrend', perm: null }
  ],
  panels: [
    { id:'analytics', title:'تحلیل زنده', icon:'📊', perm:null, kind:'analytics', api:'/api/analytics/overview' }
  ]
};
