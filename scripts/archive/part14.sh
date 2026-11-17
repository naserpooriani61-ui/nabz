
# ═══════════════════════════════════════════════════════════════
#  Part 14 — Real-time Sync (SSE)
# ═══════════════════════════════════════════════════════════════

# ─── ۱) core/sse.js — SSE Hub ───
cat > core/sse.js << 'EOF'
'use strict';
const bus = require('./events');

const clients = new Set();
let nextId = 1;
const MAX_CLIENTS = 200;
const HEARTBEAT_MS = 25000;

function addClient(res, meta) {
  // Cap to avoid memory blowup on Termux
  if (clients.size >= MAX_CLIENTS) {
    const oldest = clients.values().next().value;
    if (oldest) removeClient(oldest);
  }

  const client = {
    id: 'sse_' + (nextId++),
    res,
    meta: meta || {},
    connectedAt: Date.now(),
    pingInterval: null,
    closed: false
  };

  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization'
    });

    // Retry interval hint
    res.write('retry: 3000\n\n');

    // Welcome
    res.write('event: evt\ndata: ' + JSON.stringify({
      event: 'stream.connected',
      data: { clientId: client.id, serverTime: new Date().toISOString() },
      at: new Date().toISOString()
    }) + '\n\n');

    // Heartbeat to keep proxy from closing
    client.pingInterval = setInterval(() => {
      if (client.closed) return;
      try {
        res.write(': ping ' + Date.now() + '\n\n');
      } catch (_) {
        removeClient(client);
      }
    }, HEARTBEAT_MS);

    res.on('close', () => removeClient(client));
    res.on('error', () => removeClient(client));
    res.on('finish', () => removeClient(client));

    clients.add(client);
    console.log('[sse] +client ' + client.id + ' (total=' + clients.size + ')');

    return client;
  } catch (e) {
    console.error('[sse] failed to init client:', e.message);
    return null;
  }
}

function removeClient(client) {
  if (!client || client.closed) return;
  client.closed = true;
  if (client.pingInterval) clearInterval(client.pingInterval);
  clients.delete(client);
  try { client.res.end(); } catch (_) {}
  console.log('[sse] -client ' + client.id + ' (total=' + clients.size + ')');
}

function broadcast(eventName, payload) {
  if (clients.size === 0) return;
  let frame;
  try {
    frame = 'event: evt\ndata: ' + JSON.stringify({
      event: eventName,
      data: payload,
      at: new Date().toISOString()
    }) + '\n\n';
  } catch (e) {
    // Circular ref in payload — skip
    return;
  }
  for (const c of clients) {
    if (c.closed) continue;
    try {
      c.res.write(frame);
    } catch (_) {
      removeClient(c);
    }
  }
}

// Subscribe to all events from Event Bus
bus.on('*', (payload) => {
  const evt = payload._event;
  if (!evt || evt === 'stream.connected') return;
  broadcast(evt, payload);
});

function stats() {
  return {
    clients: clients.size,
    connections: Array.from(clients).map(c => ({
      id: c.id,
      userId: c.meta.userId,
      role: c.meta.role,
      ward: c.meta.ward,
      connectedForSec: Math.floor((Date.now() - c.connectedAt) / 1000)
    }))
  };
}

module.exports = { addClient, removeClient, broadcast, stats };
EOF
echo "✅ core/sse.js — hub with heartbeat + cap"

# ─── ۲) modules/stream.js — endpoint ───
cat > modules/stream.js << 'EOF'
'use strict';
const sse = require('../core/sse');

function openStream(ctx) {
  if (!ctx.res) {
    throw ctx.E.badRequest('stream_requires_sse');
  }
  const client = sse.addClient(ctx.res, {
    userId: ctx.actor.id,
    username: ctx.actor.username,
    role: ctx.actor.role,
    ward: ctx.actor.ward || null
  });
  if (!client) throw ctx.E.badRequest('stream_init_failed');
  // Response already sent — return undefined so server skips json()
  return undefined;
}

function stats(ctx) {
  return sse.stats();
}

function broadcastTest(ctx) {
  const b = ctx.body || {};
  sse.broadcast(b.event || 'test.ping', {
    message: b.message || 'test',
    from: ctx.actor.username,
    at: new Date().toISOString(),
    actor: { id: ctx.actor.id, role: ctx.actor.role }
  });
  return { sent: true, event: b.event || 'test.ping', clients: sse.stats().clients };
}

module.exports = {
  handlers: { openStream, stats, broadcastTest },
  routes: [
    { method: 'GET', path: '/api/stream', handler: 'openStream', perm: null },
    { method: 'GET', path: '/api/stream/stats', handler: 'stats', perm: 'admin.users.manage' },
    { method: 'POST', path: '/api/stream/broadcast', handler: 'broadcastTest', perm: 'admin.users.manage' }
  ],
  panels: []
};
EOF
echo "✅ modules/stream.js — /api/stream + test"

# ─── ۳) Patch server.js ───
node << 'SERVER'
const fs = require('fs');
let s = fs.readFileSync('core/server.js', 'utf8');
let changed = false;

// 3.1) Allow token via query param (?token=)
if (!s.includes("parsed.searchParams.get('token')")) {
  s = s.replace(
    /const tk = \(req\.headers\.authorization \|\| ''\)\.replace\('Bearer ',''"'"'\);/,
    "const tk = (req.headers.authorization || '').replace('Bearer ','').trim() || (parsed.searchParams.get('token') || '').trim();"
  );
  if (s.includes("searchParams.get('token')")) {
    console.log('✅ 3.1 query token support');
    changed = true;
  }
}

// 3.2) Pass res to ctx
if (!s.includes('res,') || !s.includes('ctx = {') || !/const ctx = \{[^}]*res\b/.test(s)) {
  if (/const ctx = \{[\s\S]*?module: \{ id: m\.modName \}/.test(s)) {
    s = s.replace(
      /(module: \{ id: m\.modName \})/,
      "$1,\n      res"
    );
    console.log('✅ 3.2 ctx.res exposed');
    changed = true;
  } else {
    console.log('⚠️ 3.2 pattern not matched — trying alt');
    s = s.replace(
      /const ctx = \{ actor: au, params, query, body, store, audit, bus,/,
      "const ctx = { actor: au, params, query, body, store, audit, bus, res,"
    );
    if (s.includes('bus, res,')) {
      console.log('✅ 3.2b ctx.res exposed (alt)');
      changed = true;
    }
  }
}

// 3.3) Skip json() if response already sent (SSE)
if (!s.includes('if (res.headersSent) return;')) {
  s = s.replace(
    /const result = (typeof m\.handler === 'function' \? await m\.handler\(ctx\) : await m\.handler\.handler\(ctx\));\s*\n\s*return json\(res, 200, \{ ok: true, data: result \}\);/,
    "const result = (typeof m.handler === 'function' ? await m.handler(ctx) : await m.handler.handler(ctx));\n    if (res.headersSent) return;\n    return json(res, 200, { ok: true, data: result });"
  );
  if (s.includes('if (res.headersSent) return;')) {
    console.log('✅ 3.3 SSE response skip');
    changed = true;
  }
}

if (changed) fs.writeFileSync('core/server.js', s);
else console.log('⚠️ server.js — no changes');
SERVER

# ─── ۴) public/live.js — EventSource client ───
cat > public/live.js << 'EOF'
// ═══════════════════════════════════════════════════════════
//  NABZ Live — SSE client with auto-reconnect
// ═══════════════════════════════════════════════════════════
const Live = (() => {
  let source = null;
  let connected = false;
  let reconnectDelay = 1000;
  let reconnectAttempts = 0;
  const handlers = {};

  function connect() {
    if (source) return;
    const token = localStorage.getItem('nabz_tk');
    if (!token) return;

    updateIndicator('connecting');

    try {
      source = new EventSource('/api/stream?token=' + encodeURIComponent(token));
    } catch (e) {
      updateIndicator('offline');
      scheduleReconnect();
      return;
    }

    source.addEventListener('evt', (e) => {
      try {
        const msg = JSON.parse(e.data);
        handleEvent(msg.event, msg.data, msg.at);
      } catch (_) {}
    });

    source.addEventListener('error', () => {
      if (source) {
        try { source.close(); } catch (_) {}
        source = null;
      }
      connected = false;
      updateIndicator('offline');
      scheduleReconnect();
    });

    source.addEventListener('open', () => {
      connected = true;
      reconnectDelay = 1000;
      reconnectAttempts = 0;
      updateIndicator('online');
    });
  }

  function scheduleReconnect() {
    reconnectAttempts++;
    const delay = Math.min(30000, reconnectDelay * Math.pow(1.5, Math.min(reconnectAttempts, 6)));
    setTimeout(() => {
      if (!source) connect();
    }, delay);
  }

  function disconnect() {
    if (source) {
      try { source.close(); } catch (_) {}
      source = null;
    }
    connected = false;
    updateIndicator('offline');
  }

  function on(event, fn) {
    if (!handlers[event]) handlers[event] = [];
    handlers[event].push(fn);
  }

  function handleEvent(event, data, at) {
    if (event === 'stream.connected') {
      return;
    }
    const fns = handlers[event] || [];
    for (const fn of fns) {
      try { fn(data, at); } catch (e) { console.error('[live handler]', event, e.message); }
    }
    const wilds = handlers['*'] || [];
    for (const fn of wilds) {
      try { fn({ event, data, at }); } catch (e) { console.error('[live wild]', event, e.message); }
    }
  }

  function updateIndicator(state) {
    const el = document.getElementById('liveDot');
    if (!el) return;
    if (state === 'online') {
      el.style.background = '#10b981';
      el.style.boxShadow = '0 0 8px rgba(16,185,129,0.6)';
      el.title = 'زنده متصل';
    } else if (state === 'offline') {
      el.style.background = '#ef4444';
      el.style.boxShadow = 'none';
      el.title = 'قطع — تلاش مجدد...';
    } else {
      el.style.background = '#f59e0b';
      el.style.boxShadow = '0 0 6px rgba(245,158,11,0.5)';
      el.title = 'در حال اتصال...';
    }
  }

  return {
    connect,
    disconnect,
    on,
    isConnected: () => connected
  };
})();

// ═══════════════════════════════════════════════════════════
//  Panel → Events map (which events trigger refresh)
// ═══════════════════════════════════════════════════════════
const PANEL_EVENT_MAP = {
  'clinical.patients':   ['patients.created','patients.updated','patients.discharged','patients.transferred','bed.assigned'],
  'clinical.vitals':     ['vitals.recorded','vitals.critical','vitals.glucose.critical'],
  'clinical.kardex':     ['kardex.order.created','kardex.order.verified','kardex.order.executed','kardex.order.cancelled'],
  'clinical.mar':        ['kardex.mar.given','kardex.mar.refused','kardex.mar.missed','kardex.order.verified'],
  'clinical.stats':      ['patients.created','vitals.recorded','kardex.mar.given'],
  'emergency.ed':        ['ed.visit.created','ed.triage.completed'],
  'emergency.codes':     ['ed.code.activated','ed.code.closed'],
  'emergency.mci':       ['ed.mci.activated'],
  'emergency.stats':     ['ed.visit.created','ed.triage.completed','ed.code.activated'],
  'workflow.consult':    ['consult.requested','consult.responded','consult.approved','consult.cancelled'],
  'workflow.transfer':   ['transfer.requested','transfer.approved','transfer.completed'],
  'workflow.discharge':  ['discharge.planned','discharge.approved','discharge.completed'],
  'workflow.handover':   ['handover.created','handover.signed','handover.received'],
  'paraclinical.labs':   ['lab.ordered','lab.resulted','lab.verified','lab.critical'],
  'paraclinical.radiology':['radiology.reported','radiology.verified','radiology.critical'],
  'paraclinical.blood':  ['bloodbank.requested','bloodbank.crossmatched','bloodbank.issued'],
  'paraclinical.dispenses':['pharmacy.verified','pharmacy.dispensed'],
  'safety.sepsis':       ['sepsis.screened','sepsis.suspected','sepsis.confirmed'],
  'safety.infections':   ['infection.reported'],
  'safety.incidents':    ['quality.incident.reported','quality.incident.triaged'],
  'safety.risks':        ['risk.registered'],
  'surgical.schedule':   ['or.case.scheduled','or.case.started','or.case.ended'],
  'surgical.pacu':       ['or.pacu.admitted','or.pacu.discharged'],
  'surgical.cssd_sets':  ['cssd.set.created','cssd.set.issued'],
  'surgical.cssd_cycles':['cssd.cycle.closed','cssd.indicator.failed'],
  'nursing_report.nursing':['nursing_report.created','nursing_report.signed','nursing_report.received'],
  'crisis.active':       ['crisis.activated','crisis.deactivated','crisis.role.assigned','crisis.task.created'],
  'ops.rosters':         ['shift.roster.generated','shift.roster.approved'],
  'ops.periods':         ['karanneh.period.calculated','karanneh.period.finalized'],
  'bedboard.wards':      ['bed.assigned','patients.transferred','patients.discharged']
};

// ═══════════════════════════════════════════════════════════
//  Debounced refresh
// ═══════════════════════════════════════════════════════════
let _refreshTimer = null;
let _lastRefresh = 0;
function debouncedRefreshCurrentPanel() {
  if (!NABZ || !NABZ.state || !NABZ.state.current) return;
  // Don't refresh if user is in a form/sheet
  if (document.querySelector('.bs-backdrop')) return;
  if (_refreshTimer) clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(() => {
    const now = Date.now();
    if (now - _lastRefresh < 500) return;
    _lastRefresh = now;
    try { NABZ.show(NABZ.state.current); } catch (_) {}
  }, 700);
}

// ═══════════════════════════════════════════════════════════
//  Toast for critical events
// ═══════════════════════════════════════════════════════════
function liveToast(msg, kind) {
  const colors = {
    dng: 'linear-gradient(135deg,#dc2626,#991b1b)',
    warn: 'linear-gradient(135deg,#f59e0b,#d97706)',
    ok: 'linear-gradient(135deg,#10b981,#059669)',
    info: 'linear-gradient(135deg,#06b6d4,#0891b2)'
  };
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;top:calc(var(--safe-t) + 72px);left:50%;transform:translateX(-50%);background:' + (colors[kind] || colors.info) + ';color:#fff;padding:12px 20px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.35);font-size:13px;font-weight:800;z-index:99999;max-width:90vw;text-align:center;animation:liveSlide 0.3s ease';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 300);
  }, 3500);
  if (navigator.vibrate) { try { navigator.vibrate(30); } catch (_) {} }
}

// Inject animation
if (!document.getElementById('liveStyles')) {
  const st = document.createElement('style');
  st.id = 'liveStyles';
  st.textContent = '@keyframes liveSlide{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes crisisShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}';
  document.head.appendChild(st);
}

// ═══════════════════════════════════════════════════════════
//  Crisis Takeover
// ═══════════════════════════════════════════════════════════
function showCrisisTakeover(session) {
  if (!session) return;
  if (document.getElementById('crisisTakeover')) return;
  const el = document.createElement('div');
  el.id = 'crisisTakeover';
  el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:radial-gradient(circle at center,#dc2626 0%,#7f1d1d 100%);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center;animation:crisisShake 0.5s ease';
  el.innerHTML =
    '<div style="font-size:88px;animation:pulse-critical 1.5s infinite;filter:drop-shadow(0 0 40px rgba(255,255,255,0.4))">' + (session.icon || '🚨') + '</div>' +
    '<h1 style="font-size:32px;font-weight:900;margin:20px 0 10px;letter-spacing:-1px">' + (session.crisisLabel || 'بحران') + '</h1>' +
    '<div style="font-size:13px;opacity:0.9;margin-bottom:8px">' + (session.reason || 'بحران فعال شده') + '</div>' +
    '<div style="font-size:12px;opacity:0.75;margin-bottom:32px">' + new Date().toLocaleString('fa-IR', {hour:'2-digit',minute:'2-digit'}) + (session.activatedByName ? ' · ' + session.activatedByName : '') + '</div>' +
    '<button id="crisisAck" style="background:rgba(255,255,255,0.2);color:#fff;border:2px solid #fff;padding:16px 44px;border-radius:14px;font-size:15px;font-weight:900;font-family:inherit;cursor:pointer;backdrop-filter:blur(10px)">فهمیدم — مشاهده پنل بحران</button>';
  document.body.appendChild(el);
  document.getElementById('crisisAck').onclick = () => {
    el.remove();
    try { NABZ.show('crisis.active'); } catch (_) {}
  };
  if (navigator.vibrate) { try { navigator.vibrate([200,100,200,100,200]); } catch (_) {} }
}

function hideCrisisTakeover() {
  const el = document.getElementById('crisisTakeover');
  if (el) el.remove();
}

// ═══════════════════════════════════════════════════════════
//  Wire events
// ═══════════════════════════════════════════════════════════
Live.on('*', ({ event, data }) => {
  // 1) Auto-refresh current panel if relevant
  const current = NABZ && NABZ.state ? NABZ.state.current : null;
  if (current) {
    const relevant = PANEL_EVENT_MAP[current] || [];
    if (relevant.indexOf(event) >= 0) debouncedRefreshCurrentPanel();
  }

  // 2) Special toasts
  if (event === 'vitals.critical') {
    const p = data.record || {};
    liveToast('🚨 NEWS بحرانی — ' + (p.patientName || '') + ' (' + (p.news2 || '?') + ')', 'dng');
  } else if (event === 'vitals.glucose.critical') {
    const g = data.record || {};
    liveToast('🩸 قند بحرانی — ' + (g.patientName || '') + ' (' + (g.value || '?') + ')', 'dng');
  } else if (event === 'ed.code.activated') {
    const c = data.record || {};
    liveToast('🔴 ' + (c.codeLabel || 'کد فعال') + ' — ' + (c.patientName || ''), 'dng');
  } else if (event === 'ed.mci.activated') {
    liveToast('🌐 MCI فعال — ' + (data.record && data.record.incidentType || ''), 'dng');
  } else if (event === 'sepsis.suspected' || event === 'sepsis.confirmed') {
    const s = data.record || {};
    liveToast('🦠 سپسیس — ' + (s.patientName || ''), 'warn');
  } else if (event === 'lab.critical') {
    liveToast('🧪 مقدار بحرانی آزمایشگاه', 'dng');
  } else if (event === 'radiology.critical') {
    liveToast('🩻 یافته بحرانی تصویربرداری', 'dng');
  } else if (event === 'kardex.mar.missed') {
    const m = data.record || {};
    liveToast('💊 دوز missed — ' + (m.drugName || '') + ' / ' + (m.patientName || ''), 'warn');
  } else if (event === 'crisis.activated') {
    showCrisisTakeover(data.session);
  } else if (event === 'crisis.deactivated') {
    hideCrisisTakeover();
    liveToast('✅ بحران پایان یافت', 'ok');
  }
});

// ═══════════════════════════════════════════════════════════
//  Auto-connect on boot
// ═══════════════════════════════════════════════════════════
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Live.connect());
} else {
  Live.connect();
}

// Expose for manual control
window.NABZ_LIVE = Live;
EOF
echo "✅ public/live.js — EventSource client"

# ─── ۵) Patch app.js — logout disconnects + expose helpers ───
node << 'APP'
const fs = require('fs');
let s = fs.readFileSync('public/app.js', 'utf8');
let changed = false;

// 5.1) In logout, disconnect Live
if (!s.includes('NABZ_LIVE.disconnect') && !s.includes('window.NABZ_LIVE')) {
  s = s.replace(
    /function logout\(\)\s*\{/,
    'function logout() {\n  try { if (window.NABZ_LIVE) window.NABZ_LIVE.disconnect(); } catch(_) {}\n  try { if (window.Live) window.Live.disconnect(); } catch(_) {}'
  );
  if (s.includes('NABZ_LIVE.disconnect')) {
    console.log('✅ 5.1 logout disconnects Live');
    changed = true;
  }
}

// 5.2) Expose state publicly (for live.js to read current panel)
if (!s.includes('window.NABZ_STATE')) {
  s = s.replace(
    /return \{ boot, show, showNeural, showAlerts, refresh, logout, showItem, openForm, showDrawer, hideDrawer, runAction, _docButtonsFor, state: S \};/,
    "window.NABZ_STATE = S;\n  return { boot, show, showNeural, showAlerts, refresh, logout, showItem, openForm, showDrawer, hideDrawer, runAction, _docButtonsFor, state: S };"
  );
  if (s.includes('window.NABZ_STATE')) {
    console.log('✅ 5.2 state exposed');
    changed = true;
  }
}

if (changed) fs.writeFileSync('public/app.js', s);
else console.log('⚠️ app.js — no changes');
APP

# ─── ۶) Patch index.html — add live dot + script ───
node << 'HTML'
const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');
let changed = false;

// 6.1) Add live dot next to title
if (!h.includes('id="liveDot"')) {
  h = h.replace(
    '<div class="logo">🫀 <span>نبض</span></div>',
    '<div class="logo">🫀 <span>نبض</span><span id="liveDot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b;margin-right:8px;box-shadow:0 0 6px rgba(245,158,11,0.5);transition:all 0.3s" title="در حال اتصال..."></span></div>'
  );
  if (h.includes('id="liveDot"')) {
    console.log('✅ 6.1 live dot added');
    changed = true;
  }
}

// 6.2) Add live.js script
if (!h.includes('/live.js')) {
  h = h.replace('<script src="/ops2.js"></script>', '<script src="/ops2.js"></script>\n<script src="/live.js"></script>');
  if (h.includes('/live.js')) {
    console.log('✅ 6.2 live.js script');
    changed = true;
  }
}

if (changed) fs.writeFileSync('public/index.html', h);
else console.log('⚠️ index.html — no changes');
HTML

# ─── ۷) Add stream status panel to admin ───
node << 'PANEL'
const fs = require('fs');
let s = fs.readFileSync('modules/stream.js', 'utf8');
if (!s.includes("title:'اتصالات زنده'")) {
  s = s.replace(
    '  panels: []',
    "  panels: [\n    { id:'live', title:'اتصالات زنده', icon:'📡', perm:'admin.users.manage', kind:'stats', api:'/api/stream/stats' }\n  ]"
  );
  fs.writeFileSync('modules/stream.js', s);
  console.log('✅ stream panel added to admin');
}
PANEL

# ─── ۸) CSS — live dot + takeover ───
cat >> public/style.css << 'CSS'

/* ═══════════════════════════════════════════════════════════
   Live Indicator
   ═══════════════════════════════════════════════════════════ */
#liveDot {
  vertical-align: middle;
  animation: livePulse 2s infinite;
}
@keyframes livePulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* ═══════════════════════════════════════════════════════════
   Crisis Takeover
   ═══════════════════════════════════════════════════════════ */
#crisisTakeover {
  animation: crisisShake 0.5s ease;
}
@keyframes crisisShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}
CSS
echo "✅ CSS — live dot + shake"

# ─── ۹) Verify ───
echo ""
echo "─── Verify ───"
node -e "require('./core/sse.js')" && echo "✅ sse OK"
node -e "require('./modules/stream.js')" && echo "✅ stream OK"
node -e "new Function(require('fs').readFileSync('public/live.js','utf8'))" && echo "✅ live OK"
node -e "new Function(require('fs').readFileSync('public/app.js','utf8'))" && echo "✅ app OK"

# ─── ۱۰) Restart ───
for pid in $(pgrep -f "core/server.js" 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done
sleep 1

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ Part 14 — Real-time Sync Ready          ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "New endpoints:"
echo "  GET  /api/stream           (SSE, query token)"
echo "  GET  /api/stream/stats"
echo "  POST /api/stream/broadcast"
echo ""
echo "Next:"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
