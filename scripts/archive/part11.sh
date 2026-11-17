
# ═══════════════════════════════════════════════════════════════
#  Part 11 — Analytics + Crisis Mode
# ═══════════════════════════════════════════════════════════════

# ─── ۱) ماژول analytics ───
cat > modules/analytics.js << 'EOF'
'use strict';
const store = require('../core/store');
const { h, sd } = require('../core/mod-helpers');

function today() { return new Date().toISOString().slice(0, 10); }

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
EOF
echo "✅ analytics.js — 5 chart datasets + trends"

# ─── ۲) Patch crisis.js — change panel kind ───
node << 'CRISIS'
const fs = require('fs');
let s = fs.readFileSync('modules/crisis.js', 'utf8');
// Change 'active' panel from 'list' to 'crisis'
s = s.replace(
  /\{id:'active', title:'بحران فعال', icon:'🚨', perm:'crisis\.view', kind:'list',\s*api:'\/api\/crisis\/active',[^}]*\}/,
  "{id:'active', title:'بحران', icon:'🚨', perm:'crisis.view', kind:'crisis', api:'/api/crisis/active'}"
);
fs.writeFileSync('modules/crisis.js', s);
console.log('✅ crisis.js: active panel kind → crisis');
CRISIS

# ─── ۳) Frontend — extra.js append ───
cat >> public/extra.js << 'ENDJS'

// ═══════════════════════════════════════════════════════════
//  SVG Chart Helpers
// ═══════════════════════════════════════════════════════════
function svgLineChart(width, height, labels, series) {
  const pad = { l: 28, r: 8, t: 8, b: 22 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const allVals = series.flatMap(s => s.values);
  const max = Math.max(...allVals, 1);
  const n = labels.length;
  let svg = '<svg viewBox="0 0 ' + width + ' ' + height + '" style="width:100%;height:auto;display:block">';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (h / 4) * i;
    const v = Math.round(max - (max / 4) * i);
    svg += '<line x1="' + pad.l + '" y1="' + y + '" x2="' + (width - pad.r) + '" y2="' + y + '" stroke="#1c2942" stroke-width="0.6" stroke-dasharray="2,2"/>';
    svg += '<text x="' + (pad.l - 4) + '" y="' + (y + 3) + '" font-size="8" fill="#8a96ae" text-anchor="end">' + v + '</text>';
  }
  for (let i = 0; i < n; i++) {
    const x = pad.l + (w / Math.max(1, n - 1)) * i;
    svg += '<text x="' + x + '" y="' + (height - 6) + '" font-size="8" fill="#8a96ae" text-anchor="middle">' + labels[i] + '</text>';
  }
  for (const s of series) {
    const pts = s.values.map((v, i) => {
      const x = pad.l + (w / Math.max(1, n - 1)) * i;
      const y = pad.t + h - (v / max) * h;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    svg += '<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    for (let i = 0; i < s.values.length; i++) {
      const x = pad.l + (w / Math.max(1, n - 1)) * i;
      const y = pad.t + h - (s.values[i] / max) * h;
      svg += '<circle cx="' + x + '" cy="' + y + '" r="2.5" fill="' + s.color + '"/>';
    }
  }
  svg += '</svg>';
  return svg;
}

function svgBarChart(width, height, labels, series) {
  const pad = { l: 28, r: 8, t: 8, b: 22 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const allVals = series.flatMap(s => s.values);
  const max = Math.max(...allVals, 1);
  const n = labels.length;
  const gw = w / n;
  const bw = (gw * 0.7) / series.length;
  let svg = '<svg viewBox="0 0 ' + width + ' ' + height + '" style="width:100%;height:auto;display:block">';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (h / 4) * i;
    const v = Math.round(max - (max / 4) * i);
    svg += '<line x1="' + pad.l + '" y1="' + y + '" x2="' + (width - pad.r) + '" y2="' + y + '" stroke="#1c2942" stroke-width="0.6" stroke-dasharray="2,2"/>';
    svg += '<text x="' + (pad.l - 4) + '" y="' + (y + 3) + '" font-size="8" fill="#8a96ae" text-anchor="end">' + v + '</text>';
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < series.length; j++) {
      const v = series[j].values[i] || 0;
      const bh = (v / max) * h;
      const x = pad.l + i * gw + (gw - bw * series.length) / 2 + j * bw;
      const y = pad.t + h - bh;
      if (bh > 0) svg += '<rect x="' + x + '" y="' + y + '" width="' + (bw - 1) + '" height="' + bh + '" fill="' + series[j].color + '" rx="1"/>';
    }
    svg += '<text x="' + (pad.l + i * gw + gw / 2) + '" y="' + (height - 6) + '" font-size="8" fill="#8a96ae" text-anchor="middle">' + labels[i] + '</text>';
  }
  svg += '</svg>';
  return svg;
}

function svgDonut(size, data) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cx = size / 2, cy = size / 2;
  const r = size * 0.35;
  const strokeW = size * 0.14;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  let svg = '<svg viewBox="0 0 ' + size + ' ' + size + '" style="width:100%;max-width:180px;height:auto;display:block;margin:0 auto">';
  for (const d of data) {
    const pct = d.value / total;
    const dash = pct * circ;
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + d.color + '" stroke-width="' + strokeW + '" stroke-dasharray="' + dash + ' ' + (circ - dash) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" opacity="' + (pct > 0 ? 1 : 0.15) + '"/>';
    offset += dash;
  }
  svg += '<text x="' + cx + '" y="' + (cy - 4) + '" font-size="' + (size * 0.16) + '" font-weight="900" text-anchor="middle" fill="#eef2f9">' + total + '</text>';
  svg += '<text x="' + cx + '" y="' + (cy + size * 0.1) + '" font-size="' + (size * 0.07) + '" text-anchor="middle" fill="#8a96ae">بیمار</text>';
  svg += '</svg>';
  return svg;
}

// ═══════════════════════════════════════════════════════════
//  Analytics Dashboard
// ═══════════════════════════════════════════════════════════
NABZ.showAnalytics = async function(p, d) {
  if (!d) d = await NABZ._api('/api/analytics/overview');
  let h = '<div class="sec-hd"><span>📊 تحلیل زنده</span><span style="font-size:11px;color:var(--fg-2)">' + new Date().toLocaleTimeString('fa-IR', {hour:'2-digit',minute:'2-digit'}) + '</span></div>';

  // KPI strip
  const totalNews = d.topCritical.reduce((s, x) => s + 1, 0);
  h += '<div class="grid-4" style="margin-bottom:16px">';
  h += '<div class="stat ' + (d.topCritical[0] && d.topCritical[0].news >= 7 ? 'dng' : 'warn') + '"><div class="v">' + totalNews + '</div><div class="l">بحرانی</div></div>';
  h += '<div class="stat ' + (d.crisisActive ? 'dng' : 'ok') + '"><div class="v">' + (d.crisisActive ? '🚨' : '✓') + '</div><div class="l">بحران</div></div>';
  h += '<div class="stat ' + (d.sepsisAlerts > 0 ? 'warn' : 'ok') + '"><div class="v">' + d.sepsisAlerts + '</div><div class="l">سپسیس</div></div>';
  h += '<div class="stat"><div class="v">' + d.openIncidents + '</div><div class="l">حادثه</div></div>';
  h += '</div>';

  // NEWS Trend
  if (d.newsTrend.series.length) {
    h += '<div class="card"><div class="card-title">📈 روند NEWS2 — ۷ روز</div>';
    h += svgLineChart(340, 160, d.newsTrend.labels, d.newsTrend.series);
    h += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;font-size:11px">';
    for (const s of d.newsTrend.series) {
      h += '<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:' + s.color + ';border-radius:2px"></span>' + NABZ._esc(s.label) + '</span>';
    }
    h += '</div></div>';
  }

  // MAR Trend
  h += '<div class="card"><div class="card-title">💊 روند MAR — ۷ روز</div>';
  h += svgBarChart(340, 140, d.marTrend.labels, d.marTrend.series);
  h += '<div style="display:flex;gap:12px;margin-top:10px;font-size:11px">';
  for (const s of d.marTrend.series) {
    h += '<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:' + s.color + ';border-radius:2px"></span>' + NABZ._esc(s.label) + '</span>';
  }
  h += '</div></div>';

  // Occupancy
  if (d.occupancy.length) {
    h += '<div class="card"><div class="card-title">🛏️ اشغال تخت بر اساس گروه</div>';
    for (const g of d.occupancy.slice(0, 6)) {
      h += '<div style="margin-bottom:10px">';
      h += '<div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px"><span>' + NABZ._esc(g.label) + '</span><span style="font-weight:800">' + g.occupied + '/' + g.total + ' · ' + g.pct + '%</span></div>';
      h += '<div class="progress"><div class="progress-fill ' + g.level + '" style="width:' + g.pct + '%"></div></div>';
      h += '</div>';
    }
    h += '</div>';
  }

  // ESI distribution
  const esiData = [
    { label:'ESI 1', value: d.esi[1], color:'#7f1d1d' },
    { label:'ESI 2', value: d.esi[2], color:'#dc2626' },
    { label:'ESI 3', value: d.esi[3], color:'#f59e0b' },
    { label:'ESI 4', value: d.esi[4], color:'#0ea5e9' },
    { label:'ESI 5', value: d.esi[5], color:'#10b981' }
  ];
  if (esiData.some(e => e.value > 0)) {
    h += '<div class="card"><div class="card-title">🚑 توزیع ESI — اورژانس</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:center">';
    h += '<div>' + svgDonut(180, esiData) + '</div>';
    h += '<div style="font-size:11.5px">';
    for (const e of esiData) {
      if (e.value === 0) continue;
      h += '<div style="display:flex;align-items:center;gap:6px;margin:4px 0"><span style="width:10px;height:10px;background:' + e.color + ';border-radius:2px"></span>' + e.label + ': <strong>' + e.value + '</strong></div>';
    }
    h += '</div></div></div>';
  }

  // Top critical
  if (d.topCritical.length) {
    h += '<div class="sec-hd"><span>🚨 بیماران بحرانی</span></div>';
    for (const p2 of d.topCritical) {
      const lvl = p2.news >= 7 ? 'hi' : 'md';
      h += '<div class="row ' + lvl + '" onclick="NABZ.showItem(\'clinical.patients\',\'' + p2.id + '\')">';
      h += '<div class="row-hd"><div class="row-title">' + NABZ._esc(p2.name) + '</div>';
      h += '<span class="pill ' + (p2.news >= 7 ? 'dng' : 'warn') + '">NEWS ' + p2.news + '</span></div>';
      h += '<div class="row-meta">' + NABZ._esc(p2.ward) + ' · تخت ' + NABZ._esc(p2.bed || '—') + ' · ' + NABZ._esc(p2.dx || '') + '</div>';
      h += '</div>';
    }
  }

  document.getElementById('content').innerHTML = h;
};

// ═══════════════════════════════════════════════════════════
//  Crisis Mode UI
// ═══════════════════════════════════════════════════════════
const CRISIS_TYPES = [
  { code:'war', label:'جنگ', icon:'⚔️' },
  { code:'flood', label:'سیل', icon:'🌊' },
  { code:'earthquake', label:'زلزله', icon:'🏔️' },
  { code:'storm', label:'طوفان', icon:'🌪️' },
  { code:'fire', label:'آتش‌سوزی', icon:'🔥' },
  { code:'bio', label:'بیولوژیک', icon:'☣️' },
  { code:'terror', label:'تروریستی', icon:'💥' },
  { code:'pandemic', label:'پاندمی', icon:'🦠' }
];

NABZ.showCrisis = async function(p, d) {
  const m = document.getElementById('content');
  m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
  try {
    const active = await NABZ._api('/api/crisis/active');
    if (!active.active) return NABZ._renderCrisisEmpty();
    const s = active.session;
    NABZ._currentCrisis = s;
    await NABZ._renderCrisisActive(s);
  } catch (e) {
    m.innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>';
  }
};

NABZ._renderCrisisEmpty = function() {
  let h = '<div class="crisis-empty">';
  h += '<div style="font-size:64px;text-align:center;filter:drop-shadow(0 0 24px rgba(16,185,129,0.3))">🛡️</div>';
  h += '<div style="text-align:center;font-size:18px;font-weight:900;margin:16px 0 4px">آماده</div>';
  h += '<div style="text-align:center;color:var(--fg-2);font-size:12px;margin-bottom:24px">هیچ بحرانی فعال نیست · کلیه سیستم‌ها در وضعیت عادی</div>';
  h += '</div>';
  h += '<div class="sec-hd"><span>🚨 فعال‌سازی بحران</span></div>';
  h += '<div class="crisis-warning">⚠️ فعال‌سازی بحران تمام پنل‌ها را به حالت اضطراری می‌برد</div>';
  h += '<div class="crisis-types">';
  for (const t of CRISIS_TYPES) {
    h += '<button class="crisis-type-btn" onclick="NABZ._openCrisisActivation(\'' + t.code + '\',\'' + t.label + '\')">';
    h += '<span style="font-size:32px">' + t.icon + '</span>';
    h += '<span style="font-size:12px;font-weight:800">' + t.label + '</span></button>';
  }
  h += '</div>';
  document.getElementById('content').innerHTML = h;
};

NABZ._openCrisisActivation = function(code, label) {
  const sheet = document.createElement('div');
  sheet.className = 'bs-backdrop';
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">🚨 فعال‌سازی ' + NABZ._esc(label) + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<form class="bs-form" id="crisisForm">';
  h += '<div class="bs-field"><label>علت</label><input name="reason" placeholder="مثلاً: تمرین ناتو"></div>';
  h += '<div class="bs-field"><label>محل</label><input name="location" placeholder="مثلاً: تهران"></div>';
  h += '<div class="bs-field"><label>تخمین مصدومان</label><input type="number" name="estimatedCasualties" value="0"></div>';
  h += '<label style="display:flex;gap:10px;padding:14px;background:rgba(239,68,68,0.1);border-radius:12px;font-size:12.5px;cursor:pointer"><input type="checkbox" name="confirm" value="true" required style="width:20px;height:20px;accent-color:var(--dng)"><span><strong>تأیید می‌کنم</strong> — تمام اقدامات لازم را انجام داده‌ام</span></label>';
  h += '<button type="submit" class="bs-submit" style="background:var(--g-dng)">🚨 فعال‌سازی</button>';
  h += '</form>';
  const c = document.createElement('div');
  c.className = 'bs-sheet';
  c.innerHTML = h;
  sheet.appendChild(c);
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('show'));
  c.querySelector('#crisisForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const data = {
      crisisType: code,
      reason: fd.get('reason') || '',
      location: fd.get('location') || '',
      estimatedCasualties: Number(fd.get('estimatedCasualties')) || 0,
      confirm: true
    };
    try {
      await NABZ._api('/api/crisis/activate', { method:'POST', body: JSON.stringify(data) });
      sheet.remove();
      NABZ.showCrisis();
    } catch (e) { alert('❌ ' + e.message); }
  };
};

NABZ._renderCrisisActive = async function(s) {
  const [roles, tasks, evac] = await Promise.all([
    NABZ._api('/api/crisis/' + s.id + '/roles'),
    NABZ._api('/api/crisis/' + s.id + '/tasks'),
    NABZ._api('/api/crisis/' + s.id + '/evacuation')
  ]);
  const elapsed = Math.floor((Date.now() - new Date(s.activatedAt).getTime()) / 60000);
  const filledRoles = roles.roles.filter(r => r.status === 'filled').length;
  const completedTasks = (tasks.items || []).filter(t => t.status === 'completed').length;
  const movedEvac = (evac.items || []).filter(e => e.status === 'moved').length;

  let h = '<div class="crisis-active-hero">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
  h += '<div><div style="font-size:24px;font-weight:900">' + (s.icon || '🚨') + ' ' + NABZ._esc(s.crisisLabel) + '</div>';
  h += '<div style="font-size:11.5px;opacity:0.9;margin-top:4px">' + NABZ._esc(s.reason || '') + (s.location ? ' · ' + NABZ._esc(s.location) : '') + '</div></div>';
  h += '<div style="text-align:left;background:rgba(0,0,0,0.3);padding:8px 12px;border-radius:10px;font-weight:900" id="crisisTimer">' + elapsed + ' دقیقه</div>';
  h += '</div>';
  h += '<div style="font-size:10.5px;opacity:0.8;margin-top:12px">شروع: ' + new Date(s.activatedAt).toLocaleString('fa-IR', {hour:'2-digit',minute:'2-digit'}) + ' · ' + NABZ._esc(s.activatedByName || '') + '</div>';
  h += '</div>';

  // Stats
  h += '<div class="grid-4" style="margin-bottom:16px">';
  h += '<div class="stat ok"><div class="v">' + filledRoles + '/' + roles.roles.length + '</div><div class="l">نقش‌ها</div></div>';
  h += '<div class="stat"><div class="v">' + completedTasks + '/' + (tasks.items || []).length + '</div><div class="l">وظایف</div></div>';
  h += '<div class="stat warn"><div class="v">' + movedEvac + '/' + (evac.items || []).length + '</div><div class="l">تخلیه</div></div>';
  h += '<div class="stat dng"><div class="v">' + (s.estimatedCasualties || 0) + '</div><div class="l">مصدومان</div></div>';
  h += '</div>';

  // Tabs
  h += '<div class="crisis-tabs">';
  h += '<button class="crisis-tab on" onclick="NABZ._crisisTab(\'roles\',this)">🎖️ نقش‌ها</button>';
  h += '<button class="crisis-tab" onclick="NABZ._crisisTab(\'tasks\',this)">📋 وظایف</button>';
  h += '<button class="crisis-tab" onclick="NABZ._crisisTab(\'evac\',this)">🚑 تخلیه</button>';
  h += '</div>';

  h += '<div id="crisisTabContent"></div>';
  h += '<div style="margin-top:20px"><button class="btn btn-block" style="background:var(--g-dng);color:#fff;border:none;padding:14px;font-weight:900" onclick="NABZ._deactivateCrisis(\'' + s.id + '\')">🔚 پایان بحران</button></div>';

  document.getElementById('content').innerHTML = h;
  NABZ._crisisData = { roles, tasks, evac, session: s };
  NABZ._renderCrisisRoles();

  // Auto-refresh timer
  if (NABZ._crisisTimerId) clearInterval(NABZ._crisisTimerId);
  NABZ._crisisTimerId = setInterval(() => {
    const el = document.getElementById('crisisTimer');
    if (!el) { clearInterval(NABZ._crisisTimerId); return; }
    const e2 = Math.floor((Date.now() - new Date(s.activatedAt).getTime()) / 60000);
    el.textContent = e2 + ' دقیقه';
  }, 30000);
};

NABZ._crisisTab = function(tab, btn) {
  document.querySelectorAll('.crisis-tab').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  if (tab === 'roles') NABZ._renderCrisisRoles();
  else if (tab === 'tasks') NABZ._renderCrisisTasks();
  else if (tab === 'evac') NABZ._renderCrisisEvac();
};

NABZ._renderCrisisRoles = function() {
  const { roles, session } = NABZ._crisisData;
  const priorityLabel = { 1: 'بحرانی', 2: 'بالا', 3: 'متوسط' };
  let h = '';
  for (const r of roles.roles.sort((a, b) => a.priority - b.priority)) {
    const cls = r.status === 'filled' ? 'filled' : r.status === 'pending' ? 'pending' : 'unfilled';
    h += '<div class="crisis-role-card ' + cls + '">';
    h += '<div style="display:flex;align-items:center;gap:12px">';
    h += '<div style="font-size:28px">' + (r.icon || '🎖️') + '</div>';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-weight:900;font-size:13px">' + NABZ._esc(r.label) + '</div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">';
    if (r.current) h += NABZ._esc(r.current.staffName);
    else h += 'بدون مسئول';
    h += '</div></div>';
    h += '<span class="pill ' + (cls === 'filled' ? 'ok' : cls === 'pending' ? 'warn' : 'dng') + '">' + (cls === 'filled' ? 'فعال' : cls === 'pending' ? 'در انتظار' : 'خالی') + '</span>';
    h += '</div>';
    if (r.status !== 'filled') {
      h += '<button class="btn btn-block" style="margin-top:10px;padding:10px;font-size:12px" onclick="NABZ._assignRole(\'' + r.code + '\')">' + (r.current ? 'تغییر مسئول' : 'انتخاب مسئول') + '</button>';
    }
    h += '</div>';
  }
  document.getElementById('crisisTabContent').innerHTML = h;
};

NABZ._assignRole = async function(roleCode) {
  const d = await NABZ._api('/api/clinical/patients').catch(() => ({ items: [] }));
  const staff = await NABZ._api('/api/bedboard/stats').catch(() => ({ staffCount: 0 }));
  // Get staff from wf_staff via home search - use a simpler approach
  const all = await NABZ._api('/api/_modules');
  // Fallback: just show text field for staff ID
  const staffId = prompt('شناسه پرسنل (مثلاً staff_1 تا staff_107):');
  if (!staffId) return;
  try {
    await NABZ._api('/api/crisis/' + NABZ._crisisData.session.id + '/roles/assign', {
      method: 'POST',
      body: JSON.stringify({ roleCode, staffId })
    });
    NABZ.showCrisis();
  } catch (e) { alert('❌ ' + e.message); }
};

NABZ._renderCrisisTasks = function() {
  const { tasks, session } = NABZ._crisisData;
  let h = '<button class="btn btn-primary btn-block" style="margin-bottom:10px" onclick="NABZ._openTaskForm()">➕ وظیفه جدید</button>';
  if (!(tasks.items || []).length) {
    h += '<div class="empty">وظیفه‌ای تعریف نشده</div>';
  } else {
    for (const t of tasks.items) {
      const cls = t.status === 'completed' ? 'completed' : t.status === 'confirmed' ? 'confirmed' : t.priority === 'critical' ? 'critical' : '';
      h += '<div class="crisis-task ' + cls + '">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
      h += '<div style="flex:1;min-width:0">';
      h += '<div style="font-weight:900;font-size:13px">' + NABZ._esc(t.title) + '</div>';
      h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">' + NABZ._esc(t.assignedName || '') + ' · ' + t.status + '</div>';
      h += '</div>';
      h += '<span class="pill ' + (t.priority === 'critical' ? 'dng' : t.priority === 'high' ? 'warn' : 'info') + '">' + t.priority + '</span>';
      h += '</div>';
      if (t.status === 'pending') {
        h += '<div style="display:flex;gap:6px;margin-top:10px">';
        h += '<button class="btn" style="flex:1;padding:8px;font-size:11px" onclick="NABZ._taskAction(\'' + t.id + '\',\'confirm\')">✅ تأیید</button>';
        h += '<button class="btn" style="flex:1;padding:8px;font-size:11px;color:var(--dng)" onclick="NABZ._taskAction(\'' + t.id + '\',\'decline\')">❌ رد</button>';
        h += '</div>';
      } else if (t.status === 'confirmed') {
        h += '<button class="btn btn-primary btn-block" style="margin-top:10px;padding:8px;font-size:11px" onclick="NABZ._taskAction(\'' + t.id + '\',\'complete\')">✅ تکمیل</button>';
      }
      h += '</div>';
    }
  }
  document.getElementById('crisisTabContent').innerHTML = h;
};

NABZ._taskAction = async function(tid, action) {
  const s = NABZ._crisisData.session.id;
  try {
    await NABZ._api('/api/crisis/' + s + '/tasks/' + tid + '/' + action, { method:'POST', body: '{}' });
    const refreshed = await NABZ._api('/api/crisis/' + s + '/tasks');
    NABZ._crisisData.tasks = refreshed;
    NABZ._renderCrisisTasks();
  } catch (e) { alert('❌ ' + e.message); }
};

NABZ._openTaskForm = function() {
  const sheet = document.createElement('div');
  sheet.className = 'bs-backdrop';
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">➕ وظیفه جدید</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<form class="bs-form" id="taskForm">';
  h += '<div class="bs-field"><label>عنوان *</label><input name="title" required></div>';
  h += '<div class="bs-field"><label>شرح</label><textarea name="description" rows="2"></textarea></div>';
  h += '<div class="bs-field"><label>شناسه پرسنل</label><input name="assignedTo" placeholder="staff_1"></div>';
  h += '<div class="bs-field"><label>اولویت</label><select name="priority"><option value="critical">بحرانی</option><option value="high" selected>بالا</option><option value="medium">متوسط</option></select></div>';
  h += '<button type="submit" class="bs-submit">✅ ایجاد</button></form>';
  const c = document.createElement('div');
  c.className = 'bs-sheet';
  c.innerHTML = h;
  sheet.appendChild(c);
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('show'));
  c.querySelector('#taskForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      await NABZ._api('/api/crisis/' + NABZ._crisisData.session.id + '/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: fd.get('title'),
          description: fd.get('description') || '',
          assignedTo: fd.get('assignedTo') || 'staff_1',
          priority: fd.get('priority')
        })
      });
      sheet.remove();
      const refreshed = await NABZ._api('/api/crisis/' + NABZ._crisisData.session.id + '/tasks');
      NABZ._crisisData.tasks = refreshed;
      NABZ._renderCrisisTasks();
    } catch (e) { alert('❌ ' + e.message); }
  };
};

NABZ._renderCrisisEvac = function() {
  const { evac } = NABZ._crisisData;
  if (!(evac.items || []).length) {
    document.getElementById('crisisTabContent').innerHTML = '<div class="empty">لیست تخلیه خالی است</div>';
    return;
  }
  let h = '';
  const sorted = evac.items.sort((a, b) => {
    const order = { critical:0, high:1, medium:2, low:3 };
    return (order[a.priority]||9) - (order[b.priority]||9);
  });
  for (const e of sorted) {
    const cls = e.status === 'moved' ? 'moved' : e.priority === 'critical' ? 'critical' : '';
    h += '<div class="crisis-evac ' + cls + '">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-weight:800;font-size:12.5px">' + NABZ._esc(e.patientName) + '</div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2)">' + NABZ._esc(e.wardCode) + ' · تخت ' + NABZ._esc(e.bedNumber || '—') + '</div>';
    h += '</div>';
    h += '<span class="pill ' + (e.priority === 'critical' ? 'dng' : e.status === 'moved' ? 'ok' : 'warn') + '">' + e.priority + '</span>';
    h += '</div>';
    if (e.status !== 'moved') {
      h += '<button class="btn" style="margin-top:8px;padding:8px;font-size:11px;width:100%" onclick="NABZ._evacMove(\'' + e.patientId + '\')">✅ منتقل شد</button>';
    }
    h += '</div>';
  }
  document.getElementById('crisisTabContent').innerHTML = h;
};

NABZ._evacMove = async function(patientId) {
  try {
    await NABZ._api('/api/crisis/' + NABZ._crisisData.session.id + '/evacuation/' + patientId, {
      method: 'PUT',
      body: JSON.stringify({ status: 'moved', destination: 'خارج از بیمارستان' })
    });
    const refreshed = await NABZ._api('/api/crisis/' + NABZ._crisisData.session.id + '/evacuation');
    NABZ._crisisData.evac = refreshed;
    NABZ._renderCrisisEvac();
  } catch (e) { alert('❌ ' + e.message); }
};

NABZ._deactivateCrisis = async function(id) {
  if (!confirm('⚠️ بحران پایان یابد؟ تمام نقش‌ها و وظایف آرشیو می‌شوند.')) return;
  try {
    await NABZ._api('/api/crisis/' + id + '/deactivate', { method:'POST', body: '{}' });
    if (NABZ._crisisTimerId) { clearInterval(NABZ._crisisTimerId); NABZ._crisisTimerId = null; }
    NABZ.showCrisis();
  } catch (e) { alert('❌ ' + e.message); }
};
ENDJS
echo "✅ extra.js — analytics + crisis UI (~500 lines)"

# ─── ۴) CSS append — crisis specific ───
cat >> public/style.css << 'CSS'

/* ═══════════════════════════════════════════════════════════
   Crisis Mode
   ═══════════════════════════════════════════════════════════ */
.crisis-empty{
  background:var(--g-elev);
  border:1px solid var(--border);
  border-radius:var(--r-2xl);
  padding:var(--s7) var(--s5);
  margin-bottom:var(--s4);
  box-shadow:var(--sh-md);
}
.crisis-warning{
  background:rgba(239,68,68,0.08);
  border:1px solid var(--dng);
  border-radius:var(--r);
  padding:var(--s3) var(--s4);
  font-size:12.5px;
  font-weight:700;
  color:var(--dng);
  margin-bottom:var(--s4);
  line-height:1.6;
}
.crisis-types{
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:var(--s3);
}
.crisis-type-btn{
  background:var(--g-elev);
  border:1.5px solid var(--border);
  border-radius:var(--r-lg);
  padding:var(--s4) var(--s3);
  display:flex;flex-direction:column;align-items:center;gap:var(--s2);
  cursor:pointer;
  font-family:inherit;
  color:var(--fg);
  transition:all var(--dur) var(--ease);
  box-shadow:var(--sh-xs);
}
.crisis-type-btn:active{
  transform:scale(0.96);
  border-color:var(--dng);
  box-shadow:0 0 0 2px rgba(239,68,68,0.15);
}

.crisis-active-hero{
  background:linear-gradient(135deg,#7f1d1d 0%,#dc2626 100%);
  color:#fff;
  border-radius:var(--r-2xl);
  padding:var(--s5);
  margin-bottom:var(--s4);
  box-shadow:0 8px 32px rgba(220,38,38,0.35);
  animation:crisis-pulse 2.5s infinite;
}
@keyframes crisis-pulse{
  0%,100%{box-shadow:0 8px 32px rgba(220,38,38,0.35)}
  50%{box-shadow:0 8px 32px rgba(220,38,38,0.6),0 0 0 6px rgba(220,38,38,0.1)}
}

.crisis-tabs{
  display:flex;gap:4px;
  padding:4px;
  background:var(--bg-2);
  border-radius:var(--r);
  margin-bottom:var(--s4);
}
.crisis-tab{
  flex:1;
  padding:var(--s2) var(--s2);
  border-radius:var(--r-sm);
  border:none;
  background:transparent;
  color:var(--fg-2);
  font-family:inherit;
  font-size:11.5px;
  font-weight:800;
  cursor:pointer;
  transition:all var(--dur-fast);
}
.crisis-tab.on{
  background:var(--g-dng);
  color:#fff;
}

.crisis-role-card{
  background:var(--g-elev);
  border:1px solid var(--border);
  border-right:3px solid var(--border-2);
  border-radius:var(--r);
  padding:var(--s3) var(--s4);
  margin-bottom:var(--s2);
}
.crisis-role-card.filled{border-right-color:var(--ok)}
.crisis-role-card.pending{border-right-color:var(--warn)}
.crisis-role-card.unfilled{border-right-color:var(--dng)}

.crisis-task{
  background:var(--g-elev);
  border:1px solid var(--border);
  border-right:3px solid var(--border-2);
  border-radius:var(--r);
  padding:var(--s3) var(--s4);
  margin-bottom:var(--s2);
}
.crisis-task.critical{
  border-right-color:var(--dng);
  background:linear-gradient(90deg,rgba(239,68,68,0.06),var(--bg-2) 40%);
}
.crisis-task.confirmed{border-right-color:var(--primary)}
.crisis-task.completed{border-right-color:var(--ok);opacity:0.65}

.crisis-evac{
  background:var(--g-elev);
  border:1px solid var(--border);
  border-right:3px solid var(--warn);
  border-radius:var(--r);
  padding:var(--s3) var(--s4);
  margin-bottom:var(--s2);
}
.crisis-evac.critical{border-right-color:var(--dng)}
.crisis-evac.moved{border-right-color:var(--ok);opacity:0.6;text-decoration:line-through}
CSS
echo "✅ style.css — crisis mode (~80 lines)"

# ─── ۵) Patch app.js — delegate crisis + analytics ───
node << 'APP'
const fs = require('fs');
let s = fs.readFileSync('public/app.js', 'utf8');

// Delegate crisis
if (!s.includes("p.kind === 'crisis'")) {
  const old = "if (p.kind === 'action') renderAction(p, d);";
  const neu = "if (p.kind === 'action') renderAction(p, d);\n      else if (p.kind === 'crisis' && NABZ.showCrisis) await NABZ.showCrisis(p, d);\n      else if (p.kind === 'analytics' && NABZ.showAnalytics) await NABZ.showAnalytics(p, d);";
  s = s.replace(old, neu);
}

// Cleanup crisis timer when navigating
s = s.replace(
  /async function show\(id\) \{/,
  `async function show(id) {\n  if (NABZ._crisisTimerId) { clearInterval(NABZ._crisisTimerId); NABZ._crisisTimerId = null; }`
);

fs.writeFileSync('public/app.js', s);
console.log('✅ app.js — crisis + analytics kinds');
APP

# ─── ۶) Add analytics + crisis quick links to home ───
node << 'HOME'
const fs = require('fs');
let s = fs.readFileSync('modules/home.js', 'utf8');
if (!s.includes('analytics.analytics')) {
  s = s.replace(
    /quickLinks:\s*\[\s*\{ icon:'✨', label:'دیتای سینا'/,
    "quickLinks: [\n      { icon:'📊', label:'تحلیل', action:\"NABZ.show('analytics.analytics')\" },\n      { icon:'🚨', label:'بحران', action:\"NABZ.show('crisis.active')\" },\n      { icon:'✨', label:'دیتای سینا'"
  );
  fs.writeFileSync('modules/home.js', s);
  console.log('✅ home.js — analytics + crisis quick links');
}
HOME

# ─── ۷) Restart ───
for pid in $(pgrep -f "core/server.js" 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done
sleep 1

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ Part 11 — Analytics + Crisis            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "New:"
echo "  📊 5 charts (SVG, no CDN)"
echo "  🚨 Crisis Mode (8 types, 15 roles, tasks, evac)"
echo ""
echo "Next:"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
