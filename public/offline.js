// ═══════════════════════════════════════════════════════════
//  NABZ Offline — IndexedDB queue + fetch wrapper
//  - Queues POST/PUT/DELETE that fail offline
//  - Auto-flush on reconnect
//  - Shows offline banner
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  const DB_NAME = 'nabz-offline';
  const DB_VERSION = 1;
  const STORE_QUEUE = 'queue';
  const STORE_META = 'meta';

  // URLs NEVER queued (either must be live, or caller depends on response id)
  const NO_QUEUE = [
    '/api/auth/',
    '/api/stream',
    '/api/nr/',             // nursing report sign = legal, must be online
    '/api/wf/',             // workflow chains need response ids
    '/api/crisis/activate', // safety-critical
    '/api/ops2/backup',
    '/api/voice/note/',
    '/api/cdss/'      // audio stream/delete
  ];

  const Offline = {
    db: null,
    isFlushing: false,
    _patched: false,
    _uiTimer: null,

    async init() {
      try {
        this.db = await this._openDB();
      } catch (e) {
        console.error('[offline] IndexedDB unavailable:', e.message);
        return;
      }
      this._patchFetch();
      this._wireEvents();
      this._updateUI();
      // Flush pending from last session
      if (navigator.onLine) setTimeout(() => this.flush(), 2500);
    },

    _openDB() {
      return new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('no_indexeddb'));
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (ev) => {
          const db = ev.target.result;
          if (!db.objectStoreNames.contains(STORE_QUEUE)) {
            const s = db.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true });
            s.createIndex('createdAt', 'createdAt');
          }
          if (!db.objectStoreNames.contains(STORE_META)) {
            db.createObjectStore(STORE_META, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('open_failed'));
      });
    },

    _tx(store, mode) {
      return this.db.transaction(store, mode).objectStore(store);
    },

    async enqueue(data) {
      return new Promise((resolve, reject) => {
        const rec = Object.assign({}, data, {
          createdAt: Date.now(),
          attempts: 0,
          lastError: null
        });
        const req = this._tx(STORE_QUEUE, 'readwrite').add(rec);
        req.onsuccess = () => resolve(Object.assign({ id: req.result }, rec));
        req.onerror = () => reject(req.error);
      });
    },

    async listQueue() {
      if (!this.db) return [];
      return new Promise((resolve, reject) => {
        const req = this._tx(STORE_QUEUE, 'readonly').getAll();
        req.onsuccess = () => resolve((req.result || []).sort((a, b) => a.createdAt - b.createdAt));
        req.onerror = () => reject(req.error);
      });
    },

    async removeFromQueue(id) {
      return new Promise((resolve, reject) => {
        const req = this._tx(STORE_QUEUE, 'readwrite').delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },

    async updateInQueue(rec) {
      return new Promise((resolve, reject) => {
        const req = this._tx(STORE_QUEUE, 'readwrite').put(rec);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },

    async clear() {
      if (!this.db) return;
      return new Promise((resolve, reject) => {
        const req = this._tx(STORE_QUEUE, 'readwrite').clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },

    async flush() {
      if (!this.db) return { error: 'no_db' };
      if (!navigator.onLine) {
        this._toast('📡 آفلاین — همگام‌سازی ممکن نیست');
        return { offline: true };
      }
      if (this.isFlushing) return { busy: true };

      const doFlush = async () => {
        this.isFlushing = true;
        this._flushStartedAt = Date.now();
        try {
        this._updateUI();
        let items = [];
        try { items = await this.listQueue(); } catch (_) {}
        if (!items.length) {
          this.isFlushing = false;
          this._updateUI();
          return { flushed: 0, failed: 0, dropped: 0 };
        }

        let flushed = 0, failed = 0, dropped = 0;
        for (const item of items) {
          try {
            // ZZ_TIMEOUT_FIX — 8s timeout per fetch
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 8000);
            let res;
            try {
              res = await fetch(item.url, {
                method: item.method,
                headers: item.headers || {},
                body: item.body,
                signal: ctrl.signal
              });
            } finally {
              clearTimeout(timer);
            }
            if (res.ok) {
              await this.removeFromQueue(item.id);
              flushed++;
            } else if (res.status >= 400 && res.status < 500) {
              // Permanent client error — drop
              const err = await res.json().catch(() => ({}));
              console.warn('[offline] dropped', item.url, res.status, err.error);
              await this.removeFromQueue(item.id);
              dropped++;
            } else {
              // 5xx — retryable, stop
              item.attempts = (item.attempts || 0) + 1;
              item.lastError = 'HTTP ' + res.status;
              await this.updateInQueue(item);
              break;
            }
          } catch (err) {
            item.attempts = (item.attempts || 0) + 1;
            item.lastError = String(err.message || err);
            await this.updateInQueue(item);
            break;
          }
        }

        this.isFlushing = false;
        this._updateUI();

        if (flushed > 0) this._toast('✅ ' + flushed + ' عملیات همگام شد');
        if (dropped > 0) this._toast('⚠️ ' + dropped + ' عملیات رد شد — لاگ بررسی کنید');
        if (failed > 0) this._toast('❌ ' + failed + ' خطا — بعداً تلاش می‌شود');

        return { flushed, failed, dropped };
        } finally {
          this.isFlushing = false;
          this._flushStartedAt = null;
          this._updateUI();
        }
      };

      if (navigator.locks && navigator.locks.request) {
        try {
          return await navigator.locks.request('nabz-flush', doFlush);
        } catch (_) {
          return doFlush();
        }
      }
      return doFlush();
    },

    _patchFetch() {
      if (this._patched) return;
      this._patched = true;
      const orig = window.fetch.bind(window);
      const self = this;

      window.fetch = async function(url, opts) {
        opts = opts || {};
        let urlStr = '';
        try {
          urlStr = typeof url === 'string' ? url : (url && url.url) || String(url);
        } catch (_) { return orig(url, opts); }

        const method = String(opts.method || 'GET').toUpperCase();

        // Not API — passthrough
        if (!urlStr.startsWith('/api/')) return orig(url, opts);

        // Try network first (SW handles GET cache)
        try {
          return await orig(url, opts);
        } catch (err) {
          // Network failure
          if (method === 'GET') {
            // Try cache one more time manually (in case SW missed)
            try {
              const cached = await caches.match(url);
              if (cached) {
                const body = await cached.text();
                return new Response(body, {
                  status: cached.status,
                  headers: cached.headers
                });
              }
            } catch (_) {}
            throw err;
          }

          // Blacklisted — must fail
          if (NO_QUEUE.some(p => urlStr.startsWith(p))) throw err;

          // Non-string body (FormData/Blob) — can't queue
          if (opts.body !== undefined && typeof opts.body !== 'string') throw err;

          // Queue it
          let queued;
          try {
            queued = await self.enqueue({
              method: method,
              url: urlStr,
              body: opts.body,
              headers: opts.headers || {}
            });
          } catch (qerr) {
            console.error('[offline] enqueue failed:', qerr.message);
            throw err;
          }

          self._toast('📥 ذخیره آفلاین — بعد از اتصال ارسال می‌شود');
          self._updateUI();

          return new Response(JSON.stringify({
            ok: true,
            data: {
              queued: true,
              queueId: queued.id,
              _offline: true,
              _method: method,
              _url: urlStr
            }
          }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      };
    },

    _wireEvents() {
      window.addEventListener('online', () => {
        this._toast('🌐 آنلاین شد');
        this._updateUI();
        setTimeout(() => this.flush(), 600);
      });

      window.addEventListener('offline', () => {
        this._toast('📡 آفلاین — داده‌ها ذخیره می‌شوند');
        this._updateUI();
      });

      // Periodic retry
      setInterval(() => {
        if (navigator.onLine && !this.isFlushing && this.db) {
          this.listQueue().then(items => {
            if (items.length) this.flush();
          }).catch(() => {});
        } else if (this.db) {
          this._updateUI();
        }
      }, 30000);
    },

    async _updateUI() {
      // Throttle
      if (this._uiTimer) return;
      this._uiTimer = setTimeout(() => { this._uiTimer = null; }, 200);

      const el = document.getElementById('offlineBanner');
      if (!el) return;

      const online = navigator.onLine;
      let count = 0;
      try {
        const items = await this.listQueue();
        count = items.length;
      } catch (_) {}

      if (online && count === 0 && !this.isFlushing) {
        el.style.display = 'none';
        document.body.classList.remove('offline-active');
        return;
      }

      el.style.display = 'flex';
      document.body.classList.add('offline-active');

      if (!online) {
        el.className = 'offline-banner warn';
        el.innerHTML =
          '<span>📡 آفلاین</span>' +
          (count > 0 ? '<span class="offline-count">' + count + ' در انتظار</span>' : '') +
          '<span class="offline-hint">داده‌های نمایش‌داده‌شده ممکن است قدیمی باشند</span>';
      } else if (this.isFlushing) {
        el.className = 'offline-banner info';
        el.innerHTML = '<span>🔄 در حال همگام‌سازی...</span>' +
                       '<span class="offline-count">' + count + '</span>';
      } else {
        el.className = 'offline-banner info';
        el.innerHTML =
          '<span>⏳ ' + count + ' عملیات در انتظار</span>' +
          '<button class="offline-btn" onclick="NABZ.offline.flush()">همگام‌سازی</button>';
      }
    },

    _toast(msg) {
      try {
        if (window.NABZ && typeof NABZ._toast === 'function') {
          NABZ._toast(msg);
        } else {
          console.log('[offline]', msg);
        }
      } catch (_) {}
    },

    async stats() {
      let items = [];
      try { items = await this.listQueue(); } catch (_) {}
      return {
        online: navigator.onLine,
        queueCount: items.length,
        oldestAgeSec: items.length ? Math.floor((Date.now() - items[0].createdAt) / 1000) : 0,
        isFlushing: this.isFlushing,
        supported: !!this.db
      };
    },

    async clearAllCaches() {
      try {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_ALL' });
        }
        if (window.caches && caches.keys) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        return { cleared: true };
      } catch (e) {
        return { cleared: false, error: e.message };
      }
    }
  };

  window.NABZ = window.NABZ || {};
  NABZ.offline = Offline;
})();


// ZZ_HARD_RESET — guarantee flush cannot hang
setInterval(function() {
  if (Offline && Offline.isFlushing && Offline._flushStartedAt) {
    if (Date.now() - Offline._flushStartedAt > 15000) {
      console.warn('[offline] hard-reset flushing');
      Offline.isFlushing = false;
      Offline._flushStartedAt = null;
      if (typeof Offline._updateUI === 'function') try { Offline._updateUI(); } catch(_) {}
    }
  }
}, 2000);
