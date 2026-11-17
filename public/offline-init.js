// ═══════════════════════════════════════════════════════════
//  NABZ Offline Init — bootstrap + logout wrap
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  // ─── Insert banner into DOM ───
  function ensureBanner() {
    if (document.getElementById('offlineBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'offlineBanner';
    banner.className = 'offline-banner';
    banner.style.display = 'none';
    const header = document.getElementById('header');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(banner, header.nextSibling);
    } else {
      document.body.appendChild(banner);
    }
  }

  // ─── Wrap NABZ.logout to clear queue first ───
  function wrapLogout() {
    if (!window.NABZ || typeof NABZ.logout !== 'function') {
      return setTimeout(wrapLogout, 200);
    }
    if (NABZ.logout._offlineWrapped) return;

    const orig = NABZ.logout;
    NABZ.logout = async function() {
      try {
        const st = await NABZ.offline.stats();
        if (st.queueCount > 0) {
          const ok = confirm(
            '⚠️ ' + st.queueCount + ' عملیات همگام‌نشده وجود دارد.\n\n' +
            'با خروج، این عملیات پاک می‌شوند و از بین می‌روند.\n\n' +
            'ادامه می‌دهید؟'
          );
          if (!ok) return;
        }
        await NABZ.offline.clear();
      } catch (_) {}
      return orig.apply(this, arguments);
    };
    NABZ.logout._offlineWrapped = true;
    console.log('[offline-init] logout wrapped ✓');
  }

  // ─── Boot ───
  function boot() {
    ensureBanner();

    if (!window.NABZ || !NABZ.offline) {
      return setTimeout(boot, 150);
    }

    NABZ.offline.init().then(() => {
      console.log('[offline-init] offline engine ready ✓');
    }).catch(e => {
      console.warn('[offline-init]', e.message);
    });

    wrapLogout();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
