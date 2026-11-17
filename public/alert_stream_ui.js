/* public/alert_stream_ui.js — real-time alert toasts via long-polling */
(function () {
  'use strict';
  if (!window.fetch) return;

  if (!document.getElementById('as-style')) {
    const st = document.createElement('style'); st.id = 'as-style';
    st.textContent = `
#as-container{position:fixed;top:12px;right:12px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:360px;direction:rtl;font-family:inherit;pointer-events:none;}
.as-toast{pointer-events:auto;background:#fff;border-radius:10px;padding:12px 14px;box-shadow:0 4px 20px rgba(0,0,0,.15);border-right:5px solid #1a5fb4;cursor:pointer;transition:transform .2s,opacity .2s;animation:as-slide .25s ease-out;}
.as-toast:hover{transform:translateX(-4px);}
.as-toast.critical{border-right-color:#b91c1c;background:#fff5f5;}
.as-toast.high{border-right-color:#d97706;background:#fffbeb;}
.as-toast.warning{border-right-color:#d97706;}
.as-toast.info{border-right-color:#1a5fb4;}
.as-toast .hdr{display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:13px;font-weight:700;}
.as-toast .body{font-size:12px;color:#333;line-height:1.5;}
.as-toast .meta{font-size:10px;color:#888;margin-top:4px;}
.as-toast .sev-pill{display:inline-block;padding:1px 8px;border-radius:10px;font-size:10px;font-weight:600;background:#eef2f8;color:#333;}
.as-toast.critical .sev-pill{background:#ffe0e0;color:#a00;}
.as-toast .close{position:absolute;top:6px;left:6px;background:none;border:none;color:#999;font-size:16px;cursor:pointer;padding:0 6px;line-height:1;}
.as-toast{position:relative;padding-left:24px;}
#as-status{position:fixed;bottom:10px;left:10px;z-index:99998;font-size:10px;color:#666;background:#f5f5f5;padding:3px 8px;border-radius:10px;direction:rtl;}
#as-status.offline{background:#ffe0e0;color:#a00;}
@keyframes as-slide{from{opacity:0;transform:translateX(40px);}to{opacity:1;transform:translateX(0);}}
@media (max-width:480px){#as-container{left:8px;right:8px;max-width:none;top:8px;}}
    `;
    document.head.appendChild(st);
  }

  let container = document.getElementById('as-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'as-container';
    document.body.appendChild(container);
  }
  const status = document.createElement('div');
  status.id = 'as-status'; status.textContent = '';
  document.body.appendChild(status);

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }
  const seen = new Set();
  let connected = false;

  function beep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!window.__asAudio) window.__asAudio = new AudioCtx();
      const ac = window.__asAudio;
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.frequency.value = 880; g.gain.value = 0.08;
      o.start(); o.stop(ac.currentTime + 0.15);
      setTimeout(() => {
        const o2 = ac.createOscillator(), g2 = ac.createGain();
        o2.connect(g2); g2.connect(ac.destination);
        o2.frequency.value = 1100; g2.gain.value = 0.08;
        o2.start(); o2.stop(ac.currentTime + 0.15);
      }, 180);
    } catch (_) {}
  }

  function showToast(alert) {
    if (alert.id && seen.has(alert.id)) return;
    if (alert.id) seen.add(alert.id);
    if (seen.size > 500) seen.clear();

    const isCrit = alert.severity === 'critical';
    const el = document.createElement('div');
    el.className = 'as-toast ' + (alert.severity || 'info');
    const icon = isCrit ? '🚨' : alert.severity === 'high' ? '⚠️' : '🔔';
    el.innerHTML =
      '<button class="close" title="بستن">×</button>' +
      '<div class="hdr">' + icon + ' ' + esc(alert.title) + '</div>' +
      '<div class="body">' + esc(alert.message || '') + '</div>' +
      '<div class="meta">' +
        '<span class="sev-pill">' + esc(alert.severity || 'info') + '</span> ' +
        esc(alert.patientName || '') + ' · ' + new Date(alert.at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) +
      '</div>';
    container.appendChild(el);

    const dismiss = () => { el.style.opacity = '0'; el.style.transform = 'translateX(40px)'; setTimeout(() => el.remove(), 250); };
    el.querySelector('.close').onclick = (ev) => { ev.stopPropagation(); dismiss(); };
    el.onclick = (ev) => {
      if (ev.target.classList.contains('close')) return;
      if (window.NABZ && typeof NABZ.show === 'function' && alert.patientId) {
        try { NABZ.show('kardex', { patientId: alert.patientId }); return; } catch (_) {}
      }
      if (alert.patientId) window.open('/kind/handover_print?patientId=' + encodeURIComponent(alert.patientId), '_blank');
    };

    if (isCrit) {
      beep();
      // persistent critical — only manual close
    } else {
      const ttl = alert.severity === 'high' ? 12000 : 7000;
      setTimeout(dismiss, ttl);
    }

    // Cap at 4 visible toasts
    while (container.children.length > 4) container.firstChild.remove();
  }

  let since = Date.now() - 5000;
  let fails = 0;

  async function loop() {
    try {
      const r = await fetch('/api/alerts/poll?since=' + since, { credentials: 'include' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (Array.isArray(d.alerts) && d.alerts.length) {
        d.alerts.reverse().forEach(showToast);
      }
      if (typeof d.since === 'number') since = d.since;
      if (!connected) {
        connected = true; fails = 0;
        status.textContent = '🔔 هشدارها آنلاین';
        status.classList.remove('offline');
        setTimeout(() => { if (status.textContent.indexOf('آنلاین') >= 0) status.style.opacity = '0'; }, 3000);
      }
    } catch (e) {
      fails++;
      if (fails >= 3 && connected) {
        connected = false;
        status.textContent = '⚠️ اتصال قطع — تلاش مجدد';
        status.style.opacity = '1';
        status.classList.add('offline');
      }
    }
    setTimeout(loop, connected ? 100 : 3000);
  }

  setTimeout(loop, 2000);
})();
