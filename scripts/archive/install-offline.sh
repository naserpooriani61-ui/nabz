#!/data/data/com.termux/files/usr/bin/bash
# ═══════════════════════════════════════════════════════════
#  NABZ v1.0 — Part 16: Offline-First PWA Installer
#  Run from project root: bash install-offline.sh
# ═══════════════════════════════════════════════════════════
set -e

echo "🫀 NABZ Offline-First — Installer (Part 16)"
echo ""

# ─── 1) Verify project root ───
if [ ! -f "core/server.js" ] || [ ! -d "modules" ] || [ ! -d "public" ]; then
  echo "❌ لطفاً از ریشهٔ پروژه اجرا کنید"
  exit 1
fi

# ─── 2) Backups ───
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="backups/offline-$STAMP"
mkdir -p "$BACKUP_DIR"
for f in public/sw.js public/index.html public/style.css public/manifest.webmanifest; do
  [ -f "$f" ] && cp "$f" "$BACKUP_DIR/" 2>/dev/null || true
done
echo "📦 Backups → $BACKUP_DIR"
echo ""

# ═══════════════════════════════════════════════════════════
#  FILE 1 — public/sw.js (complete rewrite)
# ═══════════════════════════════════════════════════════════
cat > public/sw.js << 'EOF_SW'
// ═══════════════════════════════════════════════════════════
//  NABZ Service Worker v9 — Offline-First
//  Strategy:
//    Static assets  → cache-first + background update
//    API GET        → network-first + cache fallback
//    API mutations  → network only (client queues failed)
//    Navigation     → cache-first with index fallback
// ═══════════════════════════════════════════════════════════
const VERSION = 9;
const STATIC_CACHE = 'nabz-static-v' + VERSION;
const API_CACHE    = 'nabz-api-v' + VERSION;

const STATIC_ASSETS = [
  '/', '/index.html', '/style.css', '/manifest.webmanifest',
  '/app.js', '/extra.js',
  '/voice.js', '/voice-init.js',
  '/documents.js', '/scanner.js', '/ops2.js', '/live.js',
  '/offline.js', '/offline-init.js',
  '/flow.js'
];

// APIs that MUST NOT be cached (auth, live stream, huge audio)
const NO_CACHE_API = [
  /^\/api\/stream/,
  /^\/api\/auth\//,
  /^\/api\/voice\/note\/[^/]+\/audio/,
  /^\/api\/neural\/alerts/
];

// ─── Install ───
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(c => c.addAll(STATIC_ASSETS).catch(err => {
      console.warn('[sw] partial static cache:', err.message);
    }))
  );
  self.skipWaiting();
});

// ─── Activate ───
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== STATIC_CACHE && k !== API_CACHE)
          .map(k => { console.log('[sw] deleting old cache:', k); return caches.delete(k); })
    ))
  );
  self.clients.claim();
});

// ─── Fetch ───
self.addEventListener('fetch', (e) => {
  const req = e.request;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Only same-origin
  if (url.origin !== location.origin) return;

  // API
  if (url.pathname.startsWith('/api/')) {
    if (NO_CACHE_API.some(p => p.test(url.pathname))) return;
    if (req.method !== 'GET') return;   // mutations handled by client
    e.respondWith(handleAPIGet(req));
    return;
  }

  // Static / navigation
  if (req.method === 'GET') {
    e.respondWith(handleStatic(req));
  }
});

// ═══════════════════════════════════════════════════════════
//  Static — cache-first + background update
// ═══════════════════════════════════════════════════════════
async function handleStatic(req) {
  const cached = await caches.match(req);

  // Fire network update regardless (stale-while-revalidate)
  const updatePromise = fetch(req).then(res => {
    if (res && res.ok) {
      const clone = res.clone();
      caches.open(STATIC_CACHE).then(c => c.put(req, clone));
    }
    return res;
  }).catch(() => null);

  if (cached) { updatePromise; return cached; }

  const fresh = await updatePromise;
  if (fresh) return fresh;

  // Offline + uncached
  if (req.mode === 'navigate') {
    const index = await caches.match('/index.html');
    if (index) return index;
  }
  return new Response('آفلاین — فایل در دسترس نیست', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

// ═══════════════════════════════════════════════════════════
//  API GET — network-first + cache fallback
// ═══════════════════════════════════════════════════════════
async function handleAPIGet(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const clone = res.clone();
      caches.open(API_CACHE).then(c => c.put(req, clone));
    }
    return res;
  } catch (err) {
    // Network failed — try cache
    const cached = await caches.match(req);
    if (cached) {
      const body = await cached.text();
      const headers = new Headers(cached.headers);
      headers.set('X-Nabz-Cached', '1');
      headers.set('X-Nabz-Cached-At', new Date().toISOString());
      return new Response(body, {
        status: cached.status,
        statusText: cached.statusText,
        headers
      });
    }
    // No cache — return error JSON
    return new Response(JSON.stringify({
      ok: false,
      error: 'offline_no_cache',
      _offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ─── Message handler (for cache clearing from client) ───
self.addEventListener('message', (e) => {
  const msg = e.data || {};
  if (msg.type === 'CLEAR_ALL') {
    Promise.all([
      caches.delete(STATIC_CACHE),
      caches.delete(API_CACHE)
    ]).then(() => {
      if (e.source) e.source.postMessage({ type: 'CLEARED' });
    });
  }
});
EOF_SW
echo "✅ public/sw.js (rewritten)"

# ═══════════════════════════════════════════════════════════
#  FILE 2 — public/offline.js
# ═══════════════════════════════════════════════════════════
cat > public/offline.js << 'EOF_OFFLINE'
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
    '/api/voice/note/'      // audio stream/delete
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
            const res = await fetch(item.url, {
              method: item.method,
              headers: item.headers || {},
              body: item.body
            });
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
EOF_OFFLINE
echo "✅ public/offline.js"

# ═══════════════════════════════════════════════════════════
#  FILE 3 — public/offline-init.js
# ═══════════════════════════════════════════════════════════
cat > public/offline-init.js << 'EOF_INIT'
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
EOF_INIT
echo "✅ public/offline-init.js"

# ═══════════════════════════════════════════════════════════
#  PATCH 1 — public/style.css (append offline styles)
# ═══════════════════════════════════════════════════════════
if ! grep -q "offline-banner" public/style.css 2>/dev/null; then
cat >> public/style.css << 'EOF_CSS'

/* ═══════════════════════════════════════════════════════════
   Offline Banner — Part 16
   ═══════════════════════════════════════════════════════════ */
.offline-banner{
  position:fixed;
  top:calc(var(--hdr-h) + var(--safe-t));
  left:0;right:0;
  z-index:40;
  display:flex;
  align-items:center;
  gap:10px;
  padding:8px 16px;
  font-size:12px;
  font-weight:800;
  border-bottom:1px solid;
  backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);
  transition:transform var(--dur) var(--ease);
}
.offline-banner.warn{
  background:rgba(245,158,11,0.18);
  border-bottom-color:var(--warn);
  color:var(--warn);
}
.offline-banner.info{
  background:rgba(6,182,212,0.15);
  border-bottom-color:var(--primary);
  color:var(--primary);
}
.offline-count{
  background:currentColor;
  color:var(--bg);
  padding:2px 8px;
  border-radius:10px;
  font-size:10px;
  font-weight:900;
  min-width:24px;
  text-align:center;
}
.offline-hint{
  flex:1;
  font-size:10.5px;
  font-weight:600;
  opacity:0.85;
  text-align:right;
}
.offline-btn{
  background:var(--primary);
  color:#fff;
  border:none;
  padding:5px 12px;
  border-radius:6px;
  font-family:inherit;
  font-size:11px;
  font-weight:800;
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}
.offline-btn:active{transform:scale(0.95);background:var(--primary-2)}

/* Push content down when banner is active */
body.offline-active #main{
  padding-top:calc(var(--s4) + 38px);
}
EOF_CSS
echo "✅ public/style.css (+offline styles)"
else
echo "ℹ️  style.css already has offline styles"
fi

# ═══════════════════════════════════════════════════════════
#  PATCH 2 — public/index.html (add script tags)
# ═══════════════════════════════════════════════════════════
node << 'EOF_NODE_HTML'
const fs = require('fs');
const F = 'public/index.html';
let src = fs.readFileSync(F, 'utf8');
if (src.includes('/offline.js')) { console.log('ℹ️  index.html already patched'); process.exit(0); }
const from = '<script src="/live.js"></script>';
const to   = '<script src="/live.js"></script>\n<script src="/offline.js"></script>\n<script src="/offline-init.js"></script>';
if (!src.includes(from)) { console.error('❌ anchor <script src="/live.js"> not found'); process.exit(1); }
src = src.replace(from, to);
fs.writeFileSync(F, src);
console.log('✅ public/index.html (+2 script tags)');
EOF_NODE_HTML

# ═══════════════════════════════════════════════════════════
#  PATCH 3 — public/manifest.webmanifest (add scope + offline)
# ═══════════════════════════════════════════════════════════
node << 'EOF_NODE_MF'
const fs = require('fs');
const F = 'public/manifest.webmanifest';
let mf = JSON.parse(fs.readFileSync(F, 'utf8'));
let changed = false;

if (!mf.scope) { mf.scope = '/'; changed = true; }
if (!mf.id)    { mf.id = '/'; changed = true; }
if (!mf.prefer_related_applications) { mf.prefer_related_applications = false; changed = true; }

// Update description to mention offline
if (!mf.description.includes('آفلاین')) {
  mf.description = mf.description + ' — با پشتیبانی آفلاین';
  changed = true;
}

if (changed) {
  fs.writeFileSync(F, JSON.stringify(mf, null, 2));
  console.log('✅ public/manifest.webmanifest (scope+id+offline)');
} else {
  console.log('ℹ️  manifest already up-to-date');
}
EOF_NODE_MF

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Part 16 نصب شد"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📁 فایل‌های جدید:"
echo "   public/sw.js           ← Service Worker v9 (استراتژی جدید)"
echo "   public/offline.js      ← صف IndexedDB + fetch wrapper"
echo "   public/offline-init.js ← بنر + wrap logout"
echo ""
echo "✏️  فایل‌های پچ‌شده:"
echo "   public/style.css          (+بنر آفلاین)"
echo "   public/index.html         (+۲ script tag)"
echo "   public/manifest.webmanifest (+scope + offline)"
echo ""
echo "📦 Backup: $BACKUP_DIR"
echo ""
echo "🔄 مرحله بعد:"
echo "  pkill -9 -f 'core/server.js' 2>/dev/null || true"
echo "  sleep 1"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
echo ""
echo "  ⚠️  IMPORTANT: در مرورگر Hard Reload کنید (Ctrl+Shift+R)"
echo "     Service Worker جدید فقط پس از reload دوگانه فعال می‌شود"
echo ""
