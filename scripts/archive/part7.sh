
# ═══════════════════════════════════════════════════════════════
#  Part 7 — Actions + PWA + Charts
# ═══════════════════════════════════════════════════════════════

# ۱) modules/actions.js — Central Action Resolver
cat > modules/actions.js << 'EOF'
const { h } = require('../core/mod-helpers');
const perms = require('../core/permissions');

// ═══════════════════════════════════════════════════════════
//  Declarative action catalog — one entry per collection
//  Each action: { from: status|array|'*', to: id, label, perm, method, path, requires }
//  `requires` maps field name → type: text | number | checkbox | select
// ═══════════════════════════════════════════════════════════
const A = {
  orders: [
    { from:'pending',  to:'verify',  label:'✅ تأیید',    perm:'kardex.order.verify',  method:'POST', path:'/api/clinical/orders/{id}/verify' },
    { from:'verified', to:'execute', label:'▶️ اجرا',     perm:'kardex.order.execute', method:'POST', path:'/api/clinical/orders/{id}/execute' },
    { from:['pending','verified'], to:'cancel', label:'❌ لغو', perm:'kardex.order.verify', method:'POST', path:'/api/clinical/orders/{id}/cancel', requires:{ reason:'text' } }
  ],
  mar: [
    { from:['scheduled','due'], to:'administer', label:'✅ توزیع', perm:'kardex.mar.administer', method:'POST', path:'/api/clinical/mar/{id}/administer',
      requires:{ fiveRights:'five_rights', witnessedBy:'text' } },
    { from:['scheduled','due'], to:'refuse', label:'❌ رد', perm:'kardex.mar.administer', method:'POST', path:'/api/clinical/mar/{id}/refuse', requires:{ reason:'text' } }
  ],
  consults: [
    { from:'requested', to:'respond', label:'💬 پاسخ', perm:'consult.respond', method:'POST', path:'/api/wf/consults/{id}/respond', requires:{ answer:'text', recommendations:'text', followup:'text' } },
    { from:'responded', to:'approve', label:'✅ تأیید', perm:'consult.approve', method:'POST', path:'/api/wf/consults/{id}/approve' },
    { from:['requested','responded'], to:'cancel', label:'❌ لغو', perm:'consult.request', method:'POST', path:'/api/wf/consults/{id}/cancel', requires:{ reason:'text' } }
  ],
  transfers: [
    { from:'requested',     to:'approve',   label:'✅ تأیید', perm:'transfer.approve',    method:'POST', path:'/api/wf/transfers/{id}/approve' },
    { from:'approved',      to:'assign_bed', label:'🛏️ تخصیص تخت', perm:'transfer.assign_bed', method:'POST', path:'/api/wf/transfers/{id}/assign_bed', requires:{ bedId:'text' } },
    { from:'bed_assigned',  to:'handover',  label:'📝 تحویل', perm:'transfer.handover',   method:'POST', path:'/api/wf/transfers/{id}/handover' },
    { from:'handover_done', to:'complete',  label:'✅ تکمیل', perm:'transfer.complete',   method:'POST', path:'/api/wf/transfers/{id}/complete' }
  ],
  discharges: [
    { from:'planned',         to:'summary',  label:'📝 خلاصه', perm:'discharge.plan', method:'POST', path:'/api/wf/discharges/{id}/summary', requires:{ finalDiagnosis:'text', medications:'text', followupInstructions:'text' } },
    { from:'summary_drafted', to:'approve',  label:'✅ تأیید', perm:'discharge.plan', method:'POST', path:'/api/wf/discharges/{id}/approve' },
    { from:'approved',        to:'educate',  label:'🎓 آموزش', perm:'discharge.plan', method:'POST', path:'/api/wf/discharges/{id}/educate', requires:{ topics:'text' } },
    { from:'education_done',  to:'complete', label:'🚪 ترخیص', perm:'discharge.plan', method:'POST', path:'/api/wf/discharges/{id}/complete' }
  ],
  handovers: [
    { from:'draft',  to:'sign',    label:'✍️ امضا',  perm:'handover.sign',    method:'POST', path:'/api/wf/handovers/{id}/sign' },
    { from:'signed', to:'receive', label:'✅ دریافت', perm:'handover.receive', method:'POST', path:'/api/wf/handovers/{id}/receive' }
  ],
  labs: [
    { from:'ordered',   to:'collect', label:'🧫 نمونه', perm:'lab.collect', method:'POST', path:'/api/para/labs/{id}/collect' },
    { from:'collected', to:'result',  label:'📊 نتیجه', perm:'lab.result',  method:'POST', path:'/api/para/labs/{id}/result', requires:{ values:'text' } },
    { from:'resulted',  to:'verify',  label:'✅ تأیید', perm:'lab.verify',  method:'POST', path:'/api/para/labs/{id}/verify' }
  ],
  radiology: [
    { from:'ordered',  to:'report', label:'📝 گزارش', perm:'radiology.report', method:'POST', path:'/api/para/radiology/{id}/report', requires:{ findings:'text', impression:'text', criticalFlag:'checkbox' } },
    { from:'reported', to:'verify', label:'✅ تأیید', perm:'radiology.verify', method:'POST', path:'/api/para/radiology/{id}/verify' }
  ],
  blood_requests: [
    { from:'requested',   to:'crossmatch', label:'🧪 کراس‌مچ', perm:'bloodbank.crossmatch', method:'POST', path:'/api/para/blood/{id}/crossmatch', requires:{ donorBloodType:'text' } },
    { from:'crossmatched', to:'issue',     label:'📦 ارسال',   perm:'bloodbank.issue',      method:'POST', path:'/api/para/blood/{id}/issue' },
    { from:'issued',       to:'transfuse', label:'💉 تزریق',   perm:'bloodbank.transfuse',  method:'POST', path:'/api/para/blood/{id}/transfuse', requires:{ secondCheckerId:'text' } }
  ],
  dispenses: [
    { from:'pending_verify', to:'verify',   label:'✅ تأیید', perm:'pharmacy.verify',   method:'POST', path:'/api/para/dispenses/{id}/verify' },
    { from:'verified',       to:'dispense', label:'💊 تحویل', perm:'pharmacy.dispense', method:'POST', path:'/api/para/dispenses/{id}/dispense' }
  ],
  sepsis: [
    { from:['screening','suspected'],       to:'diagnose', label:'🩺 تشخیص', perm:'sepsis.diagnose', method:'POST', path:'/api/safety/sepsis/{id}/diagnose', requires:{ status:'select:confirmed,ruled_out,septic_shock' } },
    { from:['suspected','confirmed','septic_shock'], to:'bundle', label:'⏱️ Bundle', perm:'sepsis.screen', method:'POST', path:'/api/safety/sepsis/{id}/bundle', requires:{ antibiotics:'checkbox', bloodCultures:'checkbox', fluids:'checkbox' } }
  ],
  incidents: [
    { from:'reported', to:'close', label:'✅ بستن', perm:'quality.view', method:'POST', path:'/api/safety/incidents/{id}/close', requires:{ notes:'text' } }
  ],
  risks: [
    { from:'open', to:'mitigate', label:'🛠️ اقدام', perm:'risk.register', method:'POST', path:'/api/safety/risks/{id}/mitigate', requires:{ action:'text', type:'select:corrective,preventive,detective' } }
  ],
  ed_codes: [
    { from:'active', to:'close', label:'🔚 بستن کد', perm:'ed.code.activate', method:'POST', path:'/api/emergency/codes/{id}/close', requires:{ outcome:'text' } }
  ],
  ed_visits: [
    { from:'waiting_triage', to:'triage', label:'🚑 تریاژ', perm:'ed.triage', method:'POST', path:'/api/emergency/visits/{id}/triage', requires:{ esiLevel:'select:1,2,3,4,5' } }
  ],
  crisis_sessions: [
    { from:'active', to:'deactivate', label:'🔚 پایان بحران', perm:'crisis.activate', method:'POST', path:'/api/crisis/{id}/deactivate' }
  ],
  or_schedule: [
    { from:'scheduled',   to:'start', label:'▶️ شروع عمل', perm:'or.checklist', method:'POST', path:'/api/or/schedule/{id}/start' },
    { from:'in_progress', to:'end',   label:'⏹️ پایان',    perm:'or.checklist', method:'POST', path:'/api/or/schedule/{id}/end' }
  ],
  cssd_sets: [
    { from:'sterilized', to:'issue', label:'📤 ارسال', perm:'cssd.manage', method:'POST', path:'/api/cssd/sets/{id}/issue' }
  ],
  cssd_cycles: [
    { from:'running', to:'indicator', label:'🧪 ثبت شاخص', perm:'cssd.manage', method:'POST', path:'/api/cssd/cycles/{id}/indicator', requires:{ type:'select:biological,chemical', result:'select:pass,fail' } }
  ],
  cssd_recalls: [],
  patient_consents: [
    { from:'pending_signature', to:'sign', label:'✍️ امضا', perm:'rights.consent', method:'POST', path:'/api/rights/consents/{id}/sign' }
  ],
  patient_complaints: [
    { from:'open', to:'resolve', label:'✅ حل', perm:'rights.complaint.resolve', method:'POST', path:'/api/rights/complaints/{id}/resolve', requires:{ resolution:'text' } }
  ],
  appeals: [
    { from:'open', to:'review', label:'⚖️ بازبینی', perm:'karanneh.appeal.manage', method:'POST', path:'/api/hr/appeals/{id}/review', requires:{ decision:'select:accept,reject', notes:'text' } }
  ],
  extra_services: [
    { from:'published', to:'claim',    label:'🙋 قبول', perm:'extras.view', method:'POST', path:'/api/hr/extras/{id}/claim' },
    { from:'claimed',   to:'complete', label:'✅ تکمیل', perm:'extras.view', method:'POST', path:'/api/hr/extras/{id}/complete' }
  ],
  coefficients: [
    { from:'draft', to:'approve', label:'✅ تأیید', perm:'karanneh.coefficient.manage', method:'POST', path:'/api/hr/coefficients/{id}/approve' },
    { from:'draft', to:'reject',  label:'❌ رد',   perm:'karanneh.coefficient.manage', method:'POST', path:'/api/hr/coefficients/{id}/reject', requires:{ reason:'text' } }
  ],
  exams: [
    { from:'draft', to:'publish', label:'📢 انتشار', perm:'education.manage', method:'POST', path:'/api/edu/exams/{id}/publish' }
  ],
  kpis: [
    { from:'*', to:'measure', label:'📊 ثبت مقدار', perm:'quality.kpi.manage', method:'POST', path:'/api/q/kpis/{id}/measure', requires:{ value:'text', note:'text' } }
  ],
  pdsa_cycles: [
    { from:'plan',  to:'do',    label:'▶️ اجرا',    perm:'quality.pdsa.manage', method:'POST', path:'/api/q/pdsa/{id}/phase', requires:{ phase:'select:do', notes:'text' } },
    { from:'do',    to:'study', label:'🔬 بررسی',  perm:'quality.pdsa.manage', method:'POST', path:'/api/q/pdsa/{id}/phase', requires:{ phase:'select:study', notes:'text' } },
    { from:'study', to:'act',   label:'⚡ اقدام',  perm:'quality.pdsa.manage', method:'POST', path:'/api/q/pdsa/{id}/phase', requires:{ phase:'select:act', notes:'text' } }
  ],
  rca_reports: [
    { from:'opened', to:'complete', label:'✅ تکمیل RCA', perm:'quality.rca.manage', method:'POST', path:'/api/q/rca/{id}/complete', requires:{ rootCauses:'text', recommendations:'text' } }
  ]
};

// ═══════════════════════════════════════════════════════════
//  Resolver: which actions available for this item?
// ═══════════════════════════════════════════════════════════
function resolveActions(ctx) {
  const coll = ctx.params.coll;
  const id = ctx.params.id;
  const defs = A[coll];
  if (!defs) return { items: [] };

  // Find collection name in store (may differ from A key)
  const collName = coll;
  const item = ctx.store.get(collName, id);
  if (!item) throw ctx.E.notFound('item_not_found');

  const status = item.status;
  const available = [];
  for (const d of defs) {
    // Match status
    const matchStatus = d.from === '*' ||
      (Array.isArray(d.from) ? d.from.includes(status) : d.from === status);
    if (!matchStatus) continue;

    // Check permission
    if (d.perm && !perms.can(ctx.actor.role, d.perm)) continue;

    // Build requires spec
    const requires = {};
    if (d.requires) {
      for (const [k, v] of Object.entries(d.requires)) {
        if (typeof v === 'string' && v.startsWith('select:')) {
          requires[k] = { type: 'select', options: v.slice(7).split(',') };
        } else if (v === 'five_rights') {
          requires[k] = { type: 'five_rights' };
        } else {
          requires[k] = { type: v };
        }
      }
    }
    // MAR: add witnessedBy only if high-alert
    if (coll === 'mar' && d.to === 'administer') {
      if (!item.isHighAlert) delete requires.witnessedBy;
    }

    available.push({
      id: d.to,
      label: d.label,
      method: d.method,
      path: d.path.replace('{id}', id),
      requires: Object.keys(requires).length ? requires : null
    });
  }
  return { items: available, status, collection: coll };
}

module.exports = {
  handlers: { resolveActions },
  routes: [
    { method: 'GET', path: '/api/actions/:coll/:id', handler: 'resolveActions', perm: null }
  ],
  panels: []
};
EOF
echo "✅ actions.js — 30+ actions across 28 collections"

# ۲) Patch home.js — add chart endpoint
cat > /tmp/home_add.js << 'EOF'

// ═══════════════════════════════════════════════════════════
//  Chart data — small datasets for SVG rendering
// ═══════════════════════════════════════════════════════════
const charts = (ctx) => {
  const type = ctx.params.type || 'kpi';
  if (type === 'kpi') {
    const kpis = h(ctx, 'kpis');
    const series = kpis.slice(0, 8).map(k => {
      const ms = (k.measurements || []).slice(-7);
      return {
        name: k.name,
        target: k.target,
        points: ms.map((m, i) => ({ x: i, y: m.value, t: m.at }))
      };
    });
    return { type: 'multiline', title: 'KPI Trend (7d)', series };
  }
  if (type === 'mar') {
    const days = [0,1,2,3,4,5,6];
    const mar = h(ctx, 'mar');
    const series = days.map(i => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const day = d.toISOString().slice(0,10);
      const daily = mar.filter(m => (m.scheduledAt||'').startsWith(day));
      return {
        x: i,
        given: daily.filter(m => m.status === 'given').length,
        missed: daily.filter(m => m.status === 'missed').length
      };
    });
    return { type: 'bars', title: 'MAR (7d)', labels: ['۶روز پیش','۵روز','۴روز','۳روز','۲روز','دیروز','امروز'], series: [
      { name: 'توزیع', values: series.map(s => s.given), color: '#10b981' },
      { name: 'missed', values: series.map(s => s.missed), color: '#ef4444' }
    ]};
  }
  if (type === 'vitals') {
    const vitals = h(ctx, 'vitals')
      .filter(v => v.news2 != null && new Date(v.recordedAt) > new Date(Date.now() - 7*86400000))
      .sort((a,b) => new Date(a.recordedAt) - new Date(b.recordedAt));
    return {
      type: 'line', title: 'NEWS2 (7d)',
      series: [{ name: 'NEWS2', values: vitals.slice(-40).map(v => ({ x: v.recordedAt, y: v.news2 })), color: '#0ea5e9' }]
    };
  }
  return { type: 'empty' };
};
EOF

# Insert charts into home.js
node << 'INSERT'
const fs = require('fs');
let src = fs.readFileSync('modules/home.js', 'utf8');
const addon = fs.readFileSync('/tmp/home_add.js', 'utf8');
// Insert before module.exports
src = src.replace('module.exports = {', addon + '\nmodule.exports = {');
// Add to handlers
src = src.replace('handlers: { dashboard, search }', 'handlers: { dashboard, search, charts }');
// Add route
src = src.replace('{ method: \'GET\', path: \'/api/home/search\', handler: \'search\', perm: null }',
  '{ method: \'GET\', path: \'/api/home/search\', handler: \'search\', perm: null },\n    { method: \'GET\', path: \'/api/home/charts/:type\', handler: \'charts\', perm: null }');
fs.writeFileSync('modules/home.js', src);
console.log('✅ home.js charts added');
INSERT

# ۳) PWA manifest
cat > public/manifest.webmanifest << 'EOF'
{
  "name": "نبض — NABZ Hospital OS",
  "short_name": "نبض",
  "description": "سیستم‌عامل عصبی بیمارستان",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0f1e",
  "theme_color": "#06b6d4",
  "orientation": "portrait",
  "lang": "fa",
  "dir": "rtl",
  "icons": [
    {
      "src": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' rx='100' fill='%230a0f1e'/%3E%3Ctext x='50%25' y='50%25' font-size='320' text-anchor='middle' dominant-baseline='central' fill='%2306b6d4'%3E🫀%3C/text%3E%3C/svg%3E",
      "sizes": "512x512",
      "type": "image/svg+xml",
      "purpose": "any"
    }
  ]
}
EOF
echo "✅ manifest.webmanifest"

# ۴) Service Worker — cache-first for static, network-only for API
cat > public/sw.js << 'EOF'
const CACHE = 'nabz-v7';
const STATIC = ['/', '/index.html', '/style.css', '/app.js', '/extra.js', '/manifest.webmanifest'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return; // API always network
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok && e.request.method === 'GET') {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match('/index.html')))
  );
});
EOF
echo "✅ sw.js"

# ۵) Patch index.html — PWA links + chart kind
node << 'IDX'
const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');
h = h.replace('<link rel="stylesheet" href="/style.css">',
  '<link rel="manifest" href="/manifest.webmanifest">\n<link rel="stylesheet" href="/style.css">');
h = h.replace('</body>',
  '<script>if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});</script>\n</body>');
fs.writeFileSync('public/index.html', h);
console.log('✅ index.html PWA ready');
IDX

# ۶) Patch app.js — add action buttons to showItem + chart kind
node << 'APP'
const fs = require('fs');
let s = fs.readFileSync('public/app.js', 'utf8');

// -- Add action buttons in showItem --
const marker = "html += '</div>';\n      const content = document.createElement('div');\n      content.className = 'bs-sheet';\n      content.innerHTML = html;";
const replacement = `html += '</div>';
      // ─── Actions ───
      try {
        const coll = p.api.split('/').filter(Boolean).pop();
        const acts = await api('/api/actions/' + coll + '/' + iid);
        if (acts.items && acts.items.length) {
          html += '<div class="bs-hd" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);border-bottom:none;padding-bottom:8px"><div class="bs-title">⚡ اقدامات</div></div>';
          html += '<div id="bsActs" style="display:flex;flex-direction:column;gap:8px;padding-bottom:8px">';
          for (let ai = 0; ai < acts.items.length; ai++) {
            const a = acts.items[ai];
            html += '<button class="btn" data-idx="' + ai + '" style="padding:14px;font-size:13px;background:var(--grad-primary);color:#fff;border:none" onclick="NABZ.runAction(this,\\'' + iid + '\\',\\'' + pid + '\\',\\'' + coll + '\\')">' + esc(a.label) + '</button>';
          }
          html += '</div>';
          window._bsActions = acts.items;
        }
      } catch(_) {}
      const content = document.createElement('div');
      content.className = 'bs-sheet';
      content.innerHTML = html;`;
s = s.replace(marker, replacement);

// -- Add runAction function before NABZ.showNeural --
const runMarker = "async function showNeural() {";
const runFn = `async function runAction(btn, iid, pid, coll) {
  const idx = Number(btn.dataset.idx);
  const acts = window._bsActions || [];
  const a = acts[idx];
  if (!a) return;
  const sheet = btn.closest('.bs-backdrop');
  let data = {};
  if (a.requires) {
    // Build mini-form
    const form = document.createElement('form');
    form.className = 'bs-form';
    form.style.cssText = 'margin-top:16px;padding-top:16px;border-top:1px solid var(--border)';
    let fh = '<div style="font-size:13px;font-weight:900;margin-bottom:8px">ورودی‌های ' + esc(a.label) + '</div>';
    for (const [k, spec] of Object.entries(a.requires)) {
      fh += '<div class="bs-field"><label>' + esc(k) + '</label>';
      if (spec.type === 'five_rights') {
        fh += '<div style="padding:10px;background:var(--bg);border-radius:8px">';
        for (const r of ['patient','drug','dose','route','time']) {
          fh += '<label style="display:flex;gap:8px;padding:6px 0;font-size:12px"><input type="checkbox" data-right="' + r + '" style="width:18px;height:18px"><span>' + r + '</span></label>';
        }
        fh += '</div>';
      } else if (spec.type === 'select') {
        fh += '<select name="' + k + '">';
        for (const o of spec.options) fh += '<option value="' + esc(o) + '">' + esc(o) + '</option>';
        fh += '</select>';
      } else if (spec.type === 'checkbox') {
        fh += '<input type="checkbox" name="' + k + '">';
      } else {
        fh += '<input type="text" name="' + k + '">';
      }
      fh += '</div>';
    }
    fh += '<button type="submit" class="bs-submit">✅ اجرا</button>';
    form.innerHTML = fh;
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const payload = {};
      for (const [k, v] of fd.entries()) {
        if (a.requires[k] && a.requires[k].type === 'checkbox') payload[k] = v === 'on';
        else if (v !== '') payload[k] = v;
      }
      // Five rights
      const rights = {};
      ev.target.querySelectorAll('[data-right]').forEach(cb => rights[cb.dataset.right] = cb.checked);
      if (Object.keys(rights).length) payload.fiveRights = rights;
      try {
        await api(a.path, { method: a.method, body: JSON.stringify(payload) });
        sheet.remove();
        show(pid);
      } catch (e) { alert('❌ ' + e.message); }
    };
    sheet.querySelector('.bs-sheet').appendChild(form);
    return;
  }
  // No requires — direct call
  if (!confirm(a.label + '؟')) return;
  try {
    await api(a.path, { method: a.method, body: '{}' });
    sheet.remove();
    show(pid);
  } catch (e) { alert('❌ ' + e.message); }
}

async function showNeural() {`;
s = s.replace(runMarker, runFn);

// -- Export runAction --
s = s.replace('return { boot, show, showNeural, showAlerts, refresh, logout, showItem, openForm, showDrawer, hideDrawer, state: S };',
  'return { boot, show, showNeural, showAlerts, refresh, logout, showItem, openForm, showDrawer, hideDrawer, runAction, state: S };');

// -- Add 'chart' kind handling in show() --
s = s.replace(
  "if (p.kind === 'action') renderAction(p, d);",
  "if (p.kind === 'action') renderAction(p, d);\n      else if (p.kind === 'chart') renderChart(p, d);"
);

// -- renderChart function before renderStats --
const chartMarker = "function renderStats(p, d) {";
const chartFn = `function renderChart(p, d) {
  let h = '<div class="sec-hd"><span>' + (p.icon || '📊') + ' ' + esc(p.title) + '</span></div>';
  h += '<div class="card" style="padding:16px;overflow-x:auto">';
  if (!d.series || !d.series.length) {
    h += '<div class="empty">داده‌ای نیست</div>';
  } else {
    h += renderSVGChart(d);
  }
  h += '</div>';
  document.getElementById('content').innerHTML = h;
}

function renderSVGChart(d) {
  const W = 400, H = 180, PAD = 30;
  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;min-width:320px">';
  if (d.type === 'bars') {
    const series = d.series;
    const n = series[0].values.length;
    const max = Math.max(...series.flatMap(s => s.values), 1);
    const gw = (W - PAD * 2) / n;
    const bw = gw / (series.length + 1);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < series.length; j++) {
        const v = series[j].values[i];
        const bh = (v / max) * (H - PAD * 2);
        const x = PAD + i * gw + j * bw + 4;
        const y = H - PAD - bh;
        svg += '<rect x="' + x + '" y="' + y + '" width="' + (bw - 6) + '" height="' + bh + '" fill="' + series[j].color + '" rx="2"/>';
      }
    }
    // Legend
    let lx = PAD;
    for (const s of series) {
      svg += '<rect x="' + lx + '" y="8" width="10" height="10" fill="' + s.color + '" rx="2"/>';
      svg += '<text x="' + (lx + 14) + '" y="17" font-size="9" fill="#8b95ab">' + esc(s.name) + '</text>';
      lx += 60;
    }
  } else if (d.type === 'line' || d.type === 'multiline') {
    const series = d.series.filter(s => s.values && s.values.length);
    if (!series.length) return '<div class="empty">داده نیست</div>';
    const allVals = series.flatMap(s => s.values.map(p => p.y));
    const max = Math.max(...allVals, 1);
    const min = Math.min(...allVals, 0);
    const range = max - min || 1;
    for (const s of series) {
      const pts = s.values.map((p, i) => {
        const x = PAD + (i / Math.max(1, s.values.length - 1)) * (W - PAD * 2);
        const y = H - PAD - ((p.y - min) / range) * (H - PAD * 2);
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      svg += '<polyline points="' + pts + '" fill="none" stroke="' + (s.color || '#0ea5e9') + '" stroke-width="2"/>';
    }
    // Target line
    if (series[0].target) {
      const ty = H - PAD - ((series[0].target - min) / range) * (H - PAD * 2);
      svg += '<line x1="' + PAD + '" y1="' + ty + '" x2="' + (W - PAD) + '" y2="' + ty + '" stroke="#f59e0b" stroke-dasharray="4,4" stroke-width="1"/>';
    }
  }
  svg += '</svg>';
  return svg;
}

function renderStats(p, d) {`;
s = s.replace(chartMarker, chartFn);

fs.writeFileSync('public/app.js', s);
console.log('✅ app.js — actions + charts');
APP

# ۷) Add charts panel to home.js panels (frontend access)
node << 'HP'
const fs = require('fs');
let s = fs.readFileSync('modules/home.js', 'utf8');
s = s.replace('panels: []',
  `panels: [
    {id:'chart_mar', title:'نمودار MAR', icon:'📊', perm:null, kind:'chart', api:'/api/home/charts/mar'},
    {id:'chart_vitals', title:'روند NEWS2', icon:'📈', perm:null, kind:'chart', api:'/api/home/charts/vitals'},
    {id:'chart_kpi', title:'روند KPI', icon:'📉', perm:'quality.view', kind:'chart', api:'/api/home/charts/kpi'}
  ]`);
fs.writeFileSync('modules/home.js', s);
console.log('✅ home.js chart panels added');
HP

# ۸) Kill + restart
for pid in $(pgrep -f "core/server.js" 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done
sleep 1

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ Part 7 — Actions + PWA + Charts ready   ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Now: node core/server.js"
