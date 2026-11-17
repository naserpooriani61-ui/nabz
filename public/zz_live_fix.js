(function() {
  'use strict';
  var tries = 0, source = null, polling = null, connected = false, handlers = {};

  function setDot(state) {
    var el = document.getElementById('liveDot');
    if (!el) return;
    if (state === 'online') { el.style.background = '#10b981'; el.style.boxShadow = '0 0 8px rgba(16,185,129,0.6)'; el.title = 'زنده'; }
    else if (state === 'offline') { el.style.background = '#ef4444'; el.style.boxShadow = 'none'; el.title = 'قطع'; }
    else { el.style.background = '#f59e0b'; el.style.boxShadow = '0 0 6px rgba(245,158,11,0.5)'; el.title = 'اتصال...'; }
  }

  function fire(event, data) {
    var fns = (handlers[event] || []).slice();
    var wild = (handlers['*'] || []).slice();
    fns.forEach(function(fn) { try { fn(data); } catch(_) {} });
    wild.forEach(function(fn) { try { fn({ event: event, data: data }); } catch(_) {} });
  }

  function connectSSE() {
    var token = localStorage.getItem('nabz_tk');
    if (!token) { setDot('offline'); return; }
    setDot('connecting');
    try {
      source = new EventSource('/api/stream?token=' + encodeURIComponent(token));
    } catch (e) {
      tries++;
      if (tries >= 2) fallbackPolling();
      else setTimeout(connectSSE, 1500);
      return;
    }
    source.addEventListener('open', function() {
      connected = true; tries = 0; setDot('online');
      console.log('[live-fix] SSE connected');
      if (polling) { clearInterval(polling); polling = null; }
    });
    source.addEventListener('evt', function(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.event === 'stream.connected') return;
        fire(msg.event, msg.data);
      } catch (_) {}
    });
    source.addEventListener('error', function() {
      connected = false; tries++;
      setDot('offline');
      if (source) { try { source.close(); } catch(_) {} source = null; }
      if (tries >= 3) {
        console.log('[live-fix] switching to polling');
        fallbackPolling();
      } else {
        setTimeout(connectSSE, Math.min(15000, 800 * Math.pow(1.5, tries)));
      }
    });
  }

  function fallbackPolling() {
    if (polling) return;
    console.log('[live-fix] polling active');
    var lastCheck = Date.now();
    polling = setInterval(async function() {
      try {
        var token = localStorage.getItem('nabz_tk');
        if (!token) return;
        var res = await fetch('/api/neural/alerts', { headers: { 'Authorization': 'Bearer ' + token } });
        if (res.ok) {
          connected = true;
          setDot('online');
          // Fire pseudo-events every 30s
          if (Date.now() - lastCheck > 30000) {
            fire('poll.tick', { at: new Date().toISOString() });
            lastCheck = Date.now();
          }
        } else {
          connected = false;
          setDot('offline');
        }
      } catch (_) {
        setDot('offline');
      }
    }, 12000);
  }

  // Replace Live with our own
  var Live = {
    connect: connectSSE,
    disconnect: function() {
      if (source) { try { source.close(); } catch(_) {} source = null; }
      if (polling) { clearInterval(polling); polling = null; }
      connected = false;
      setDot('offline');
    },
    on: function(event, fn) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(fn);
    },
    isConnected: function() { return connected; }
  };
  window.Live = Live;
  window.NABZ_LIVE = Live;

  // Auto-connect after login
  setInterval(function() {
    if (localStorage.getItem('nabz_tk') && !connected && !source && !polling) connectSSE();
  }, 5000);

  setTimeout(connectSSE, 500);
  console.log('[live-fix] loaded');
})();
