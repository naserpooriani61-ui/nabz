
# ═══════════════════════════════════════════════════════════════
#  Part 6 — Home Dashboard + Global Search
# ═══════════════════════════════════════════════════════════════

# ۱) ماژول home
cat > modules/home.js << 'EOF'
const { h, sd } = require('../core/mod-helpers');
const perms = require('../core/permissions');

const dashboard = (ctx) => {
  const role = ctx.actor.role;
  const ward = ctx.actor.ward;
  const isCross = perms.isCrossWard(role);
  const since = Date.now() - 86400000;

  const scopeWard = (items) => (isCross || !ward) ? items : items.filter(x => x.wardCode === ward);

  const patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  const mar = h(ctx, 'mar');
  const marDue = scopeWard(mar).filter(m => m.status === 'due' ||
    (m.status === 'scheduled' && sd(m.scheduledAt) < Date.now() + 3600000));
  const marMissed = scopeWard(mar).filter(m => m.status === 'missed' && sd(m.scheduledAt) > since);
  const vitals = scopeWard(h(ctx, 'vitals')).filter(v => sd(v.recordedAt) > since);
  const consults = h(ctx, 'consults');
  const pendingConsults = scopeWard(consults).filter(c => c.status === 'requested');
  const orders = h(ctx, 'orders');
  const pendingOrders = scopeWard(orders).filter(o => o.status === 'pending');
  const labs = h(ctx, 'labs').filter(l => l.status === 'resulted');

  const codes = h(ctx, 'ed_codes').filter(c => c.status === 'active');
  const mci = h(ctx, 'ed_mci').filter(m => m.status === 'active');
  const crisis = h(ctx, 'crisis_sessions').filter(c => c.status === 'active');
  const sepsis = h(ctx, 'sepsis').filter(s => ['suspected','confirmed','septic_shock'].includes(s.status));
  const incidents = h(ctx, 'incidents').filter(i => i.status !== 'closed');

  const isManager = ['admin','hospital_director','medical_director','nursing_director',
    'supervisor_senior','supervisor_clinical','head_nurse'].includes(role);
  const isNurse = ['nurse','nurse_aide','assistant_nurse'].includes(role);
  const isPhysician = ['physician','resident','intern','attending','specialist'].includes(role);

  const stats = [];
  if (isNurse) {
    stats.push({ label:'بیماران من', value: scopeWard(patients).length, color:'ok', action:"NABZ.show('clinical.patients')" });
    stats.push({ label:'دوز در انتظار', value: marDue.length, color: marDue.length > 0 ? 'warn' : 'ok', action:"NABZ.show('clinical.mar')" });
    stats.push({ label:'دوز missed', value: marMissed.length, color: marMissed.length > 0 ? 'dng' : 'ok', action:"NABZ.show('clinical.mar')" });
    stats.push({ label:'ویتال امروز', value: vitals.length, color:'ok', action:"NABZ.show('clinical.vitals')" });
  } else if (isPhysician) {
    stats.push({ label:'بیماران', value: scopeWard(patients).length, color:'ok', action:"NABZ.show('clinical.patients')" });
    stats.push({ label:'مشاوره در انتظار', value: pendingConsults.length, color: pendingConsults.length > 0 ? 'warn' : 'ok', action:"NABZ.show('workflow.consult')" });
    stats.push({ label:'دستور تأیید نشده', value: pendingOrders.length, color: pendingOrders.length > 0 ? 'warn' : 'ok', action:"NABZ.show('clinical.kardex')" });
    stats.push({ label:'نتیجه آزمایش', value: labs.length, color:'ok', action:"NABZ.show('paraclinical.labs')" });
  } else if (isManager) {
    stats.push({ label:'بیماران', value: scopeWard(patients).length, color:'ok', action:"NABZ.show('clinical.patients')" });
    stats.push({ label:'حوادث باز', value: incidents.length, color: incidents.length > 0 ? 'dng' : 'ok', action:"NABZ.show('safety.incidents')" });
    stats.push({ label:'بحران فعال', value: crisis.length, color: crisis.length > 0 ? 'dng' : 'ok', action:"NABZ.show('crisis.active')" });
    stats.push({ label:'دوز در انتظار', value: marDue.length, color: marDue.length > 0 ? 'warn' : 'ok', action:"NABZ.show('clinical.mar')" });
  } else {
    stats.push({ label:'بیماران', value: patients.length, color:'ok', action:"NABZ.show('clinical.patients')" });
    stats.push({ label:'کد فعال', value: codes.length, color: codes.length > 0 ? 'dng' : 'ok', action:"NABZ.show('emergency.codes')" });
    stats.push({ label:'بحران', value: crisis.length, color: crisis.length > 0 ? 'dng' : 'ok', action:"NABZ.show('crisis.active')" });
    stats.push({ label:'حوادث', value: incidents.length, color:'ok', action:"NABZ.show('safety.incidents')" });
  }

  const alerts = [];
  for (const c of codes) alerts.push({ severity:'critical', icon:'🚨', title: c.codeLabel || c.code, message: c.patientName, action:"NABZ.show('emergency.codes')" });
  for (const m of mci) alerts.push({ severity:'critical', icon:'🌐', title:'MCI فعال', message: m.incidentType, action:"NABZ.show('emergency.mci')" });
  for (const s of crisis) alerts.push({ severity:'critical', icon: s.icon || '🔥', title:'بحران: ' + s.crisisLabel, message: s.reason, action:"NABZ.show('crisis.active')" });
  for (const s of sepsis.slice(0, 3)) alerts.push({ severity:'high', icon:'🦠', title:'سپسیس مشکوک', message: s.patientName, action:"NABZ.show('safety.sepsis')" });
  for (const m of marDue.slice(0, 3)) alerts.push({ severity:'high', icon:'💊', title:'دوز در انتظار', message: (m.drugName || '') + ' — ' + (m.patientName || ''), action:"NABZ.show('clinical.mar')" });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'صبح بخیر' : hour < 18 ? 'ظهر بخیر' : 'عصر بخیر';

  return {
    greeting,
    user: { name: ctx.actor.username, role, ward },
    stats, alerts,
    quickLinks: [
      { icon:'🩺', label:'بیماران', action:"NABZ.show('clinical.patients')" },
      { icon:'💊', label:'MAR', action:"NABZ.show('clinical.mar')" },
      { icon:'📋', label:'کاردکس', action:"NABZ.show('clinical.kardex')" },
      { icon:'🚨', label:'اورژانس', action:"NABZ.show('emergency.ed')" },
      { icon:'🩺', label:'مشاوره', action:"NABZ.show('workflow.consult')" },
      { icon:'🧪', label:'آزمایشگاه', action:"NABZ.show('paraclinical.labs')" },
      { icon:'🩸', label:'بانک خون', action:"NABZ.show('paraclinical.blood')" },
      { icon:'🎓', label:'آموزش', action:"NABZ.show('education.exams')" }
    ]
  };
};

const search = (ctx) => {
  const q = (ctx.query.q || '').trim().toLowerCase();
  if (!q || q.length < 2) return { items: [], total: 0, query: q };
  const results = [];
  const scan = (module, panel, items, fields) => {
    for (const it of items) {
      if (fields.some(f => String(it[f] || '').toLowerCase().includes(q))) {
        results.push({ module, panel, item: it });
      }
    }
  };
  scan('clinical', 'patients', h(ctx, 'patients'), ['firstName','lastName','mrn','diagnosis']);
  scan('ops', 'staff', h(ctx, 'wf_staff'), ['fullName','role','ward']);
  scan('clinical', 'mar', h(ctx, 'mar'), ['drugName','patientName']);
  scan('workflow', 'consult', h(ctx, 'consults'), ['patientName','targetService','question']);
  scan('paraclinical', 'labs', h(ctx, 'labs'), ['patientName','panelName']);
  scan('safety', 'incidents', h(ctx, 'incidents'), ['description','category']);
  return { items: results.slice(0, 40), total: results.length, query: q };
};

module.exports = {
  handlers: { dashboard, search },
  routes: [
    { method: 'GET', path: '/api/home/dashboard', handler: 'dashboard', perm: null },
    { method: 'GET', path: '/api/home/search', handler: 'search', perm: null }
  ],
  panels: []
};
EOF
echo "✅ home.js created"

# ۲) extra.js — frontend home + search
cat > public/extra.js << 'EOF'
// ═══════════════════════════════════════════════════════════
//  NABZ Extra — Home Dashboard + Search
// ═══════════════════════════════════════════════════════════

NABZ.showHome = async function() {
  document.querySelectorAll('.bn-tab').forEach((b, i) => b.classList.toggle('on', i === 0));
  const m = document.getElementById('content');
  m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
  try {
    const d = await NABZ._api('/api/home/dashboard');

    let h = '';
    // Greeting
    h += '<div class="card" style="background:linear-gradient(135deg,rgba(6,182,212,.15),rgba(139,92,246,.1));border-color:rgba(6,182,212,.3)">';
    h += '<div style="font-size:24px;font-weight:900">' + NABZ._esc(d.greeting) + ' 👋</div>';
    h += '<div class="card-sub" style="margin-top:4px">' + NABZ._esc(d.user.role) + (d.user.ward ? ' · ' + NABZ._esc(d.user.ward) : '') + '</div>';
    h += '<div class="card-sub" style="margin-top:2px">' + new Date().toLocaleDateString('fa-IR', {weekday:'long', year:'numeric', month:'long', day:'numeric'}) + '</div>';
    h += '</div>';

    // Stats
    if (d.stats.length) {
      h += '<div class="sec-hd"><span>📊 امروز</span></div><div class="grid-4">';
      for (const s of d.stats) {
        const act = s.action ? ' onclick="' + s.action + '" style="cursor:pointer"' : '';
        h += '<div class="stat ' + (s.color || '') + '"' + act + '>';
        h += '<div class="v">' + s.value + '</div><div class="l">' + NABZ._esc(s.label) + '</div></div>';
      }
      h += '</div>';
    }

    // Alerts
    if (d.alerts.length) {
      h += '<div class="sec-hd"><span>🚨 هشدارها</span><span style="font-size:11px;color:var(--fg-2)">' + d.alerts.length + '</span></div>';
      for (const a of d.alerts) {
        const act = a.action ? ' onclick="' + a.action + '" style="cursor:pointer"' : '';
        h += '<div class="alert ' + a.severity + '"' + act + '>';
        h += '<div class="row-title">' + a.icon + ' ' + NABZ._esc(a.title) + '</div>';
        h += '<div class="row-meta">' + NABZ._esc(a.message || '') + '</div></div>';
      }
    } else {
      h += '<div class="empty" style="padding:24px">✅ همه چیز تحت کنترل</div>';
    }

    // Quick links
    if (d.quickLinks.length) {
      h += '<div class="sec-hd"><span>⚡ دسترسی سریع</span></div>';
      h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">';
      for (const q of d.quickLinks) {
        h += '<button class="btn" style="flex-direction:column;padding:16px 8px;display:flex;gap:6px;align-items:center" onclick="' + q.action + '">';
        h += '<span style="font-size:22px">' + q.icon + '</span>';
        h += '<span style="font-size:10.5px;font-weight:800">' + NABZ._esc(q.label) + '</span></button>';
      }
      h += '</div>';
    }

    m.innerHTML = h;
  } catch (e) {
    m.innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>';
  }
};

NABZ.showSearch = function() {
  const sheet = document.createElement('div');
  sheet.className = 'bs-backdrop';
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };

  let html = '<div class="bs-handle"></div>';
  html += '<div class="bs-hd"><div class="bs-title">🔍 جستجوی سراسری</div>';
  html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  html += '<input id="nsIn" type="search" placeholder="نام بیمار، دارو، خدمت..." autocomplete="off" ';
  html += 'style="width:100%;padding:14px;font-size:15px;border:1.5px solid var(--border-2);background:var(--bg-2);color:var(--fg);border-radius:12px;margin-bottom:14px;font-family:inherit">';
  html += '<div id="nsRes" style="max-height:55vh;overflow-y:auto"></div>';

  const content = document.createElement('div');
  content.className = 'bs-sheet';
  content.innerHTML = html;
  sheet.appendChild(content);
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('show'));

  const input = content.querySelector('#nsIn');
  const res = content.querySelector('#nsRes');
  let timer;

  input.oninput = () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { res.innerHTML = '<div class="empty">حداقل ۲ حرف</div>'; return; }
    timer = setTimeout(async () => {
      res.innerHTML = '<div style="text-align:center;padding:20px"><span class="spinner"></span></div>';
      try {
        const d = await NABZ._api('/api/home/search?q=' + encodeURIComponent(q));
        if (!d.items.length) { res.innerHTML = '<div class="empty">نتیجه‌ای نیست</div>'; return; }
        let rh = '';
        for (const r of d.items) {
          const it = r.item;
          const nm = it.patientName || ((it.firstName || '') + ' ' + (it.lastName || '')).trim()
            || it.fullName || it.drugName || (it.description || '').slice(0, 40) || '?';
          const path = r.module + '.' + r.panel;
          rh += '<div class="row lo" onclick="NABZ._closeAndGo(\'' + path + '\')">';
          rh += '<div class="row-hd"><div class="row-title">' + NABZ._esc(String(nm).slice(0, 50)) + '</div>';
          rh += '<span class="pill info">' + NABZ._esc(r.module) + '</span></div></div>';
        }
        res.innerHTML = rh;
      } catch (e) { res.innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>'; }
    }, 300);
  };
  setTimeout(() => input.focus(), 100);
};

NABZ._closeAndGo = function(path) {
  const bd = document.querySelector('.bs-backdrop');
  if (bd) bd.remove();
  NABZ.show(path);
};

// Expose internal helpers for extra.js
NABZ._api = function(path, opts) {
  const t = NABZ.state.token;
  return fetch(path, {
    ...(opts || {}),
    headers: { 'Content-Type': 'application/json', ...(opts && opts.headers || {}), Authorization: 'Bearer ' + t }
  }).then(r => r.json()).then(b => {
    if (!b.ok) throw new Error(b.error || 'error');
    return b.data;
  });
};
NABZ._esc = function(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
};
EOF
echo "✅ extra.js created"

# ۳) index.html — rewrite with search button + extra.js
cat > public/index.html << 'HTML'
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a0f1e">
<title>نبض — NABZ</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div id="app">
<header id="header" style="display:none">
<div class="logo">🫀 <span>نبض</span></div>
<div style="flex:1"></div>
<button class="hbtn" onclick="NABZ.showSearch()" title="جستجو">🔍</button>
<button class="hbtn" onclick="NABZ.showAlerts()" title="اعلان‌ها">🔔<span id="nc" class="badge"></span></button>
<button class="hbtn" onclick="NABZ.refresh()" title="بازخوانی">🔄</button>
<button class="hbtn" onclick="NABZ.logout()" title="خروج">⏻</button>
</header>
<nav id="sidebar"></nav>
<main id="main">
<div id="loginView" class="login">
<div class="lcard">
<div>🫀</div>
<h1>نبض</h1>
<p style="color:var(--fg-2);font-size:12px;margin-bottom:20px;text-align:center">سیستم‌عامل عصبی بیمارستان</p>
<form id="lf">
<input id="u" placeholder="نام کاربری" autocomplete="username" required>
<input id="p" type="password" placeholder="رمز" autocomplete="current-password" required>
<button type="submit">ورود به سیستم</button>
<div id="le" class="err"></div>
</form>
<div class="hint">admin / nabz@2026</div>
</div>
</div>
<div id="content" style="display:none"></div>
</main>
</div>
<script src="/app.js"></script>
<script src="/extra.js"></script>
</body>
</html>
HTML
echo "✅ index.html rewritten"

# ۴) Minimal app.js patch: home tab + boot
node << 'PATCH'
const fs = require('fs');
let s = fs.readFileSync('public/app.js', 'utf8');
// Home tab → showHome
s = s.replace(
  "{ icon:'🏠', label:'خانه', action:'NABZ.showNeural()' },",
  "{ icon:'🏠', label:'خانه', action:'(NABZ.showHome||NABZ.showNeural)()' },"
);
// Boot → prefer showHome, else first panel
s = s.replace(
  "if (S.panels.length) show(S.panels[0].id);",
  "if (NABZ.showHome) await NABZ.showHome(); else if (S.panels.length) show(S.panels[0].id);"
);
fs.writeFileSync('public/app.js', s);
console.log('✅ app.js patched');
PATCH

# ۵) Restart
for pid in $(pgrep -f "core/server.js" 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done
sleep 1

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   ✅ Part 6 — Command Center ready          ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Now: node core/server.js"
