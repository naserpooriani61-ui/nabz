'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Central Kind Dispatcher (v3 — race-free)
//  Fixes: handler_not_ready everywhere
//  - registerKind defined IMMEDIATELY (no race)
//  - Comprehensive EXTERNAL map (all known kinds)
//  - Waits up to 8s for late-loading UI files
//  - Friendly error (not "handler_not_ready")
//  - Auto-rerender when registerKind fires for pending kind
// ═══════════════════════════════════════════════════════════
(function() {
  var REGISTRY = {};

  if (!window.NABZ) window.NABZ = {};
  if (!NABZ.state) NABZ.state = {};

  NABZ._dispatchRegistry = REGISTRY;

  // ── registerKind IMMEDIATE (before any UI file) ──
  NABZ.registerKind = function(kind, fn) {
    REGISTRY[kind] = fn;
    // NEW (S5 fix): always retrigger if current panel uses this kind
    try {
      if (NABZ.state && NABZ.state.current && NABZ.state.panels) {
        var cur = NABZ.state.panels.find(function(x){ return x.id === NABZ.state.current; });
        if (cur && cur.kind === kind) {
          console.log('[dispatch] late-register for current panel: ' + kind + ' → re-rendering');
          setTimeout(function(){ try { NABZ.show(NABZ.state.current); } catch(_){} }, 60);
        }
      }
    } catch (_) {}
    // Legacy: pending kind
    if (NABZ.state._pendingKind === kind && NABZ.state._pendingId) {
      var pid = NABZ.state._pendingId;
      NABZ.state._pendingKind = null;
      NABZ.state._pendingId = null;
      if (NABZ.state.current === pid) {
        setTimeout(function() { try { NABZ.show(pid); } catch (_) {} }, 40);
      }
    }
  };

  // ── Built-in app.js kinds (delegate to chain) ──
  var APP_KINDS = {
    'action':1, 'list':1, 'stats':1, 'chart':1, 'pipeline':1,
    'health':1, 'backup':1, 'audit':1, 'crisis':1, 'analytics':1,
    'bedboard':1, 'nursing':1
  };

  // ── External handlers (kind → "path.on.NABZ") ──
  var EXTERNAL = {
    'sa_dashboard':'sa.showDashboard',
    'sa_staff':'sa.staffSchedule',
    'cdss':'showCdss',
    'edu_studio':'eduStudio.showStudio',
    'pa_config':'permUI.show',
    'requests_inbox':'reqUI.showInbox',
    'requests_mine':'reqUI.showMine',
    'roster_builder':'rosterUI.show',
    'roster_my':'rosterUI.mySchedule',
    'erf_dashboard':'erfUI.dashboard',
    'erf_prehospital':'erfUI.showPreHospital',
    'erf_referrals':'erfUI.showReferrals',
    
    'erf_beds':'erfPanels.beds',
    'erf_codes':'erfPanels.codes',
    'erf_orders':'erfPanels.orders',
    'erf_stats':'erfPanels.stats',
    'hops_wards':'hopsUI.showWards',
    'hops_assignment':'hopsUI.showAssignment',
    'mar_v2':'marUI.show',
    'mar_handoff':'marUI.handoff',
    'qa_dashboard':'qaUI.show',
    'oncall_dashboard':'oncallUI.show',
    'asp_dashboard':'enhUI.showAspDashboard',
    'comp_my':'compUI.showMy',
    'comp_ward':'compUI.showWard',
    'learn_daily':'learnUI.showDaily',
    'learn_scenarios':'learnUI.showScenarios',
    'nh_board':'nhbUI.show',
    'backup_dashboard':'backupUI.show',
    'ncp_main':'ncpUI.show',
    'team_my_patients':'careTeamUI.openMyPatients',
    'code_manager':'cmUI.show',
    'sysaudit_dashboard':'sysAudit.show',
    'ops_ward_assign':'s15UI.showWardAssign',
    'ops_my_service':'s15UI.showMyService',
    'ops_oncall':'s15UI.showOnCall',
    'handoff_ai':'handoffAI.show'
  };

  function resolvePath(path) {
    if (!path) return null;
    var parts = path.split('.');
    var obj = window.NABZ;
    for (var i = 0; i < parts.length; i++) {
      if (!obj) return null;
      obj = obj[parts[i]];
    }
    return typeof obj === 'function' ? obj : null;
  }

  function findHandler(kind) {
    if (REGISTRY[kind]) return REGISTRY[kind];
    var path = EXTERNAL[kind];
    if (path) return resolvePath(path);
    return null;
  }

  function waitForHandler(kind, ms, cb) {
    var start = Date.now();
    (function tick() {
      var h = findHandler(kind);
      if (h) return cb(h);
      if (Date.now() - start > ms) return cb(null);
      setTimeout(tick, 120);
    })();
  }

  var esc = function(s) {
    if (typeof NABZ._esc === 'function') return NABZ._esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  };

  function renderLoading(p) {
    var m = document.getElementById('content');
    if (!m) return;
    m.innerHTML = '<div class="sec-hd"><span>' + (p.icon || '📄') + ' ' + esc(p.title) + '</span></div>' +
      '<div style="text-align:center;padding:40px"><span class="spinner"></span>' +
      '<div style="margin-top:12px;color:var(--fg-2);font-size:12px">در حال بارگذاری…</div></div>';
  }

  function renderError(p, err) {
    var m = document.getElementById('content');
    if (!m) return;
    var msg = String((err && err.message) || err || 'unknown');
    m.innerHTML = '<div class="sec-hd"><span>' + (p.icon || '📄') + ' ' + esc(p.title) + '</span></div>' +
      '<div class="card" style="border-color:var(--warn);background:var(--warn-soft);padding:20px;text-align:center">' +
      '<div style="font-size:32px">⚠️</div>' +
      '<div style="font-weight:900;margin-top:8px">پنل بارگذاری نشد</div>' +
      '<div style="font-family:monospace;font-size:11px;margin-top:6px;word-break:break-all;color:var(--fg-2)">' + esc(msg) + '</div>' +
      '<div style="font-size:11px;color:var(--fg-3);margin-top:8px">اگر بعد از retry هم خطا داد، فایل UI مربوطه (<code>public/*_ui.js</code>) را چک کنید</div>' +
      '<button class="btn btn-primary" style="margin-top:14px" onclick="NABZ.show(\'' + esc(p.id) + '\')">🔄 تلاش مجدد</button>' +
      '</div>';
  }

  function renderUnsupported(p, data) {
    var m = document.getElementById('content');
    if (!m) return;
    var h = '<div class="sec-hd"><span>' + (p.icon || '📄') + ' ' + esc(p.title) + '</span></div>' +
      '<div class="card" style="border-color:var(--warn);background:var(--warn-soft);text-align:center;padding:30px">' +
      '<div style="font-size:36px">🛠</div>' +
      '<div style="font-weight:900;margin-top:8px;color:var(--warn)">این پنل هنوز UI ندارد</div>' +
      '<div style="font-size:11.5px;color:var(--fg-2);margin-top:6px">kind: <code>' + esc(p.kind || 'list') + '</code></div>' +
      '</div>';
    if (data && typeof data === 'object') {
      h += '<details style="margin-top:12px"><summary style="cursor:pointer;font-size:12px;color:var(--fg-2);padding:8px">📊 داده خام</summary>' +
        '<pre style="font-size:10px;background:var(--bg-2);padding:10px;border-radius:8px;overflow-x:auto;max-height:300px;margin-top:8px">' +
        esc(JSON.stringify(data, null, 2)) + '</pre></details>';
    }
    m.innerHTML = h;
  }

  // ── Wrap NABZ.show ──
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 200) { console.warn('[dispatch] NABZ.show never appeared'); return; }
    setTimeout(function() { ready(fn); }, 50);
  }

  ready(function() {
    var CHAIN = NABZ.show;

    NABZ.show = async function(id, data) {
      var p = NABZ.state.panels ? NABZ.state.panels.find(function(x) { return x.id === id; }) : null;
      if (!p) {
        // Direct kind resolution (e.g. /kind/kardex when no panel id='kardex')
        var _dh = findHandler(id);
        if (_dh) {
          var _qpid = new URLSearchParams(location.search).get('patientId');
          var _data = (typeof data !== 'undefined' && data) || (_qpid ? { patientId: _qpid } : null);
          var _fp = { kind: id, id: id, title: id, icon: '📄' };
          try { await _dh(_fp, _data); return; }
          catch (e) { console.warn('[dispatch] direct', id, 'failed:', e.message); renderError(_fp, e); return; }
        }
        return CHAIN.call(NABZ, id);
      }

      NABZ.state.current = id;
      document.querySelectorAll('.bn-tab').forEach(function(b) { b.classList.remove('on'); });

      var kind = p.kind || 'list';

      // 1) Built-in app kind → delegate
      if (APP_KINDS[kind]) return CHAIN.call(NABZ, id);

      // 2) Have handler now → call it
      var handler = findHandler(kind);
      if (handler) {
        try {
          await handler(p, (data && data.patientId) ? data : null);
          return;
        } catch (e) {
          console.warn('[dispatch]', kind, 'failed:', e.message);
          renderError(p, e);
          return;
        }
      }

      // 3) Known external but not loaded yet → wait 8s
      if (EXTERNAL[kind]) {
        renderLoading(p);
        var _id = id;
        NABZ.state._pendingKind = kind;
        NABZ.state._pendingId = _id;
        waitForHandler(kind, 8000, async function(h) {
          if (NABZ.state.current !== _id) return;
          if (NABZ.state._pendingId === _id) {
            NABZ.state._pendingKind = null;
            NABZ.state._pendingId = null;
          }
          if (!h) {
            renderError(p, {
              message: 'UI file for "' + kind + '" did not load within 8s. ' +
                       'Check public/*.js that registers this kind.'
            });
            return;
          }
          try {
            await h(p, null);
          } catch (e) {
            console.warn('[dispatch]', kind, 'failed:', e.message);
            renderError(p, e);
          }
        });
        return;
      }

      // 4) Unknown kind → fetch + fallback
      var data = null;
      if (p.api) {
        try { data = await NABZ._api(p.api); }
        catch (e) { renderError(p, e); return; }
      }
      renderUnsupported(p, data);
    };

    NABZ.overview = function() {
      if (typeof NABZ.showHome === 'function') return NABZ.showHome();
      var m = document.getElementById('content');
      if (m) m.innerHTML = '<div class="empty">خانه</div>';
    };

    console.log('[dispatch-v3] ✓ active — ' + Object.keys(EXTERNAL).length + ' external kinds, ' + Object.keys(REGISTRY).length + ' registered');
  })();
})();
