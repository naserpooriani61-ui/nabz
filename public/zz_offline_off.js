(function() {
  'use strict';
  setTimeout(async function() {
    if (!window.NABZ || !NABZ.offline) return;
    try {
      if (NABZ.offline.clear) await NABZ.offline.clear();
      NABZ.offline.isFlushing = false;
      NABZ.offline._flushStartedAt = null;
      NABZ.offline.flush = async function() { return { flushed: 0, failed: 0, dropped: 0 }; };
      NABZ.offline._updateUI = function() {
        var el = document.getElementById('offlineBanner');
        if (el) el.style.display = 'none';
        document.body.classList.remove('offline-active');
      };
      NABZ.offline.enqueue = async function() { throw new Error('offline_disabled'); };
      // Clear any queue in IndexedDB
      if (NABZ.offline.db) {
        try { await NABZ.offline.clear(); } catch (_) {}
      }
      NABZ.offline._updateUI();
      console.log('[zz-offline] disabled');
    } catch (e) { console.warn('[zz-offline]', e.message); }
  }, 1500);
})();
