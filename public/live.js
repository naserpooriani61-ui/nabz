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
