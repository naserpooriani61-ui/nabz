/* public/offline_ui.js — offline write queue + connection indicator */
(function () {
  'use strict';
  if (window.__nabzOfflineReady) return;
  window.__nabzOfflineReady = true;

  // ─── Indicator styles ───
  if (!document.getElementById('nof-style')) {
    const st = document.createElement('style'); st.id = 'nof-style';
    st.textContent = `
#nof-indicator{position:fixed;bottom:10px;right:10px;z-index:99997;padding:5px 12px;border-radius:20px;font-size:11px;font-family:inherit;direction:rtl;background:#d8f0dd;color:#1a6b2e;box-shadow:0 2px 8px rgba(0,0,0,.1);display:flex;align-items:center;gap:6px;opacity:.9;transition:opacity .3s;}
#nof-indicator.hidden{opacity:0;pointer-events:none;}
#nof-indicator.offline{background:#ffe0e0;color:#a00;}
#nof-indicator.syncing{background:#fff4d6;color:#8a5c00;}
#nof-indicator .queue-badge{background:rgba(0,0,0,.12);padding:1px 8px;border-radius:10px;font-weight:700;font-size:10px;}
    `;
    document.head.appendChild(st);
  }

  // ─── Indicator element ───
  let el = document.getElementById('nof-indicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'nof-indicator';
    document.body.appendChild(el);
  }

  // ─── Queue ───
  const QKEY = 'nabz-offline-queue-v1';
  let queue = [];
  try { queue = JSON.parse(localStorage.getItem(QKEY) || '[]'); if (!Array.isArray(queue)) queue = []; } catch (_) { queue = []; }
  function saveQ() { try { localStorage.setItem(QKEY, JSON.stringify(queue)); } catch (_) {} }

  function updateIndicator() {
    const online = navigator.onLine;
    const n = queue.length;
    el.className = !online ? 'offline' : (n ? 'syncing' : '');
    const txt = !online ? '⚠️ آفلاین' : (n ? '🔄 در حال ارسال ' + n : '✅ آنلاین');
    el.innerHTML = '<span>' + txt + '</span>' + (n ? '' : '');
    if (online && !n) {
      el.classList.add('hidden');
      setTimeout(() => { if (navigator.onLine && !queue.length) el.classList.add('hidden'); }, 100);
    } else {
      el.classList.remove('hidden');
    }
  }

  // ─── Intercept writes ───
  const origFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    init = init || {};
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = String(init.method || (input && input.method) || 'GET').toUpperCase();
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    // Never intercept: auth, alerts/poll, alerts/stream/stats
    if (!isWrite ||
        url.indexOf('/api/auth/') === 0 ||
        url.indexOf('/api/alerts/poll') === 0 ||
        url.indexOf('/api/alerts/stream/stats') === 0) {
      return origFetch(input, init);
    }

    // Tag body with _clientAt (for server timestamp preservation)
    if (init.body && typeof init.body === 'string' && init.body.trim().charAt(0) === '{') {
      try {
        const b = JSON.parse(init.body);
        if (!b._clientAt) b._clientAt = new Date().toISOString();
        init.body = JSON.stringify(b);
      } catch (_) {}
    }

    // Offline: queue immediately
    if (!navigator.onLine) {
      _enqueue({ url, method, headers: init.headers || {}, body: init.body || '', at: new Date().toISOString() });
      return _queuedResp();
    }

    // Online: try; on network failure queue
    try {
      return await origFetch(input, init);
    } catch (err) {
      _enqueue({ url, method, headers: init.headers || {}, body: init.body || '', at: new Date().toISOString() });
      return _queuedResp();
    }
  };

  function _queuedResp() {
    return new Response(JSON.stringify({ ok: true, queued: true, _offline: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }
  function _enqueue(item) {
    item.id = 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    queue.push(item);
    saveQ();
    updateIndicator();
    // Toast if UI helper available
    if (window.NABZ && typeof NABZ.toast === 'function') {
      try { NABZ.toast('📥 آفلاین — نوشتن در صف (' + queue.length + ')', 'warn'); } catch (_) {}
    }
  }

  // ─── Replay ───
  let replaying = false;
  async function replay() {
    if (replaying || !navigator.onLine || !queue.length) return;
    replaying = true;
    const items = queue.slice();
    let ok = 0, fail = 0;
    for (const it of items) {
      try {
        const r = await origFetch(it.url, { method: it.method, headers: it.headers, body: it.body });
        if (r && r.ok) {
          ok++;
          queue = queue.filter(q => q.id !== it.id);
          saveQ();
        } else {
          fail++;
        }
      } catch (_) {
        fail++;
      }
    }
    replaying = false;
    updateIndicator();
    if (ok > 0) {
      console.log('[offline] synced', ok, 'writes');
      if (window.NABZ && typeof NABZ.toast === 'function') {
        try { NABZ.toast('✅ ' + ok + ' نوشتن آفلاین ارسال شد', 'success'); } catch (_) {}
      }
    }
    if (fail > 0) console.log('[offline] still pending:', fail);
  }

  window.addEventListener('online', () => { updateIndicator(); setTimeout(replay, 800); });
  window.addEventListener('offline', updateIndicator);
  setInterval(() => { if (navigator.onLine && queue.length) replay(); }, 15000);

  // ─── SW register ───
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('[offline] SW registered, scope:', reg.scope))
        .catch(err => console.warn('[offline] SW failed:', err.message));
    });
  }

  updateIndicator();
  if (navigator.onLine && queue.length) setTimeout(replay, 2000);
})();
