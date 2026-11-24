// public/nav_core.js — NABZ Unified Navigation Core
// Owns URL hash routing, context stack, cross-panel jumps, safe back.
// Load order: AFTER app.js (needs NABZ.show) but BEFORE any *ui.js that uses it.
(function () {
  'use strict';

  // ─── Route registry ───────────────────────────────────────────
  // Each route: [panelKind, defaultTitle, roleHint]
  const ROUTES = {
    'home':            { kind: null,              title: 'خانه',            icon: '🏠' },
    'ed':              { kind: null,              title: 'اورژانس',         icon: '🚨' },
    'ed/cc':           { kind: 'ed_cc',           title: 'مرکز فرماندهی',   icon: '🚨' },
    'ed/cc/board':     { kind: 'ed_cc',           title: 'تابلو زنده',       icon: '📋', tab: 'board' },
    'ed/cc/patients':  { kind: 'ed_cc',           title: 'بیماران',          icon: '👥', tab: 'patients' },
    'ed/cc/beds':      { kind: 'ed_cc',           title: 'تخت‌ها',           icon: '🛏', tab: 'beds' },
    'ed/cc/codes':     { kind: 'ed_cc',           title: 'کدها',             icon: '🔴', tab: 'codes' },
    'ed/cc/mci':       { kind: 'ed_cc',           title: 'MCI',              icon: '🆘', tab: 'mci' },
    'ed/cc/stats':     { kind: 'ed_cc',           title: 'آمار',             icon: '📊', tab: 'stats' },
    'ed/triage':       { kind: 'ed_triage',       title: 'صف تریاژ',         icon: '🩺' },
    'ed/triage/v':     { kind: 'ed_triage',       title: 'تریاژ بیمار',      icon: '🩺', patient: true },
    'ed/nursing':      { kind: 'ed_nursing',      title: 'صف پرستاری',       icon: '💉' },
    'ed/nursing/v':    { kind: 'ed_nursing',      title: 'فضای کار پرستاری', icon: '💉', patient: true },
    'ed/physician':   { kind: 'ed_physician',   title: 'فضای کار پزشک',   icon: '👨‍⚕️' },
        'ed/sbar':        { kind: 'ed_sbar',        title: 'SBAR',            icon: '📋' },
    'ed/sbar/v':      { kind: 'ed_sbar',        title: 'SBAR بیمار',      icon: '📋', patient: true },
    'ed/discharge':   { kind: 'ed_discharge',   title: 'چک‌لیست ترخیص',   icon: '📤' },
    'ed/discharge/v': { kind: 'ed_discharge',   title: 'ترخیص بیمار',     icon: '📤', patient: true },
    'ed/careplan':    { kind: 'ed_careplan',    title: 'برنامه مراقبت',   icon: '🩺' },
    'ed/careplan/v':  { kind: 'ed_careplan',    title: 'مراقبت بیمار',    icon: '🩺', patient: true },
    'ed/physician/v': { kind: 'ed_physician',   title: 'فضای کار بیمار', icon: '👨‍⚕️', patient: true },
    'ed/tasks':        { kind: 'ed_tasks',        title: 'کارتابل من',       icon: '📋' },
        'ed/report': { kind: 'ed_nursing_report', title: 'گزارش پرستاری', icon: '📊' },
    'ed/patients':     { kind: null,              title: 'پرونده‌ها',        icon: '👤' }
  };

  // ─── State ────────────────────────────────────────────────────
  const S = {
    route: 'home',
    visitId: null,
    patientId: null,
    stack: [],           // [{route, visitId, patientId}]
    initialized: false,
    listeners: []
  };

  // ─── URL hash <-> route parsing ───────────────────────────────
  // Format: #/ed/nursing/edv_xxx  or  #/ed/cc/board  or  #/home
  function parseHash() {
    const h = (window.location.hash || '').replace(/^#\/?/, '');
    const parts = h.split('/').filter(Boolean);
    if (parts.length === 0) return { route: 'home', visitId: null, patientId: null };

    // Try longest match first for parent routes
    for (let n = Math.min(parts.length, 3); n >= 1; n--) {
      const candidate = parts.slice(0, n).join('/');
      if (ROUTES[candidate]) {
        const rest = parts.slice(n);
        const visitId = rest[0] || null;
        return { route: candidate, visitId, patientId: null };
      }
    }
    return { route: 'home', visitId: null, patientId: null };
  }

  function buildHash(route, visitId) {
    if (!route) return '#/home';
    if (visitId) return '#/' + route + '/' + encodeURIComponent(visitId);
    return '#/' + route;
  }

  // ─── Core navigation ──────────────────────────────────────────
  function go(route, opts) {
    opts = opts || {};
    if (!route || !ROUTES[route]) {
      console.warn('[NAV] unknown route:', route);
      return false;
    }
    const meta = ROUTES[route];
    const visitId = opts.visitId || null;
    const patientId = opts.patientId || null;

    // Push current onto stack (unless explicitly replacing)
    if (!opts.replace && S.initialized) {
      S.stack.push({ route: S.route, visitId: S.visitId, patientId: S.patientId });
      if (S.stack.length > 40) S.stack.shift();
    }

    S.route = route;
    S.visitId = visitId;
    S.patientId = patientId;

    // Update URL hash WITHOUT triggering hashchange recursion
    const wantHash = buildHash(route, visitId);
    if (window.location.hash !== wantHash) {
      try {
        window.history.pushState({ route, visitId }, '', wantHash);
      } catch (_) {
        window.location.hash = wantHash;
      }
    }

    apply();
    return true;
  }

  function back() {
    const prev = S.stack.pop();
    if (!prev) {
      // Safe fallback: never leave the app
      if (S.route.startsWith('ed/') && S.route !== 'ed/cc') {
        go('ed/cc/board', { replace: true });
      } else {
        go('home', { replace: true });
      }
      return;
    }
    S.route = prev.route;
    S.visitId = prev.visitId;
    S.patientId = prev.patientId;
    const wantHash = buildHash(S.route, S.visitId);
    try {
      window.history.replaceState({ route: S.route, visitId: S.visitId }, '', wantHash);
    } catch (_) {}
    apply();
  }

  function canBack() { return S.stack.length > 0; }

  // ─── Apply route → render panel ───────────────────────────────
  function apply() {
    const meta = ROUTES[S.route] || ROUTES.home;
    const N = window.NABZ;

    // Tell listeners (nav_bar updates itself)
    S.listeners.forEach(fn => { try { fn(snapshot()); } catch (e) { console.warn('[NAV] listener:', e.message); } });

    if (!meta.kind) {
      // Not a panel route — let NABZ handle (home etc.)
      if (N && typeof N.show === 'function' && S.route === 'home') {
        try { N.show('home'); } catch (_) {}
      }
      return;
    }

    if (!N || typeof N.show !== 'function') {
      console.warn('[NAV] NABZ.show not available');
      return;
    }

    // Inject context before showing: the UI files read state.patientId / state.visitId
    try {
      // Reset any URL query so UI's own urlParams.get('visitId') fallback doesn't fight hash
      const u = new URL(window.location.href);
      if (u.search) {
        u.search = '';
        window.history.replaceState({ route: S.route, visitId: S.visitId }, '', u.pathname + buildHash(S.route, S.visitId));
      }
    } catch (_) {}

    // Patch: set global navigation hints that UI files can read
    window.__NAV = {
      route: S.route,
      visitId: S.visitId,
      patientId: S.patientId,
      tab: meta.tab || null
    };

    try {
      N.show(meta.kind);
      // After show, if tab is set and kind is ed_cc, drive tab selection
      if (meta.kind === 'ed_cc' && meta.tab && window.NABZ && typeof window.NABZ._edccOpenTab === 'function') {
        setTimeout(() => { try { window.NABZ._edccOpenTab(meta.tab); } catch (_) {} }, 50);
      }
    } catch (e) {
      console.error('[NAV] apply show failed:', e.message);
    }
  }

  // ─── Snapshot for listeners ───────────────────────────────────
  function snapshot() {
    const meta = ROUTES[S.route] || ROUTES.home;
    return {
      route: S.route,
      visitId: S.visitId,
      patientId: S.patientId,
      title: meta.title,
      icon: meta.icon,
      tab: meta.tab || null,
      canBack: canBack(),
      breadcrumb: buildBreadcrumb()
    };
  }

  function buildBreadcrumb() {
    // Split route into parts and label each
    const parts = S.route.split('/');
    const crumbs = [{ label: 'خانه', route: 'home', icon: '🏠' }];
    for (let i = 1; i <= parts.length; i++) {
      const sub = parts.slice(0, i).join('/');
      if (ROUTES[sub]) {
        crumbs.push({ label: ROUTES[sub].title, route: sub, icon: ROUTES[sub].icon || '' });
      }
    }
    // If patient-specific, append visitId tag
    if (S.visitId && ROUTES[S.route] && ROUTES[S.route].patient) {
      crumbs.push({ label: S.visitId, route: null, tag: true });
    }
    return crumbs;
  }

  // ─── Hashchange integration ───────────────────────────────────
  function onHashChange() {
    const p = parseHash();
    if (p.route !== S.route || p.visitId !== S.visitId) {
      S.route = p.route;
      S.visitId = p.visitId;
      S.patientId = null;
      apply();
    }
  }

  // ─── Public API ───────────────────────────────────────────────
  window.NABZ_NAV = {
    go, back, canBack, snapshot,
    current: () => ({ route: S.route, visitId: S.visitId, patientId: S.patientId }),
    subscribe: (fn) => { S.listeners.push(fn); fn(snapshot()); },
    routes: ROUTES,
    // Convenience helpers
    toWorklist: (kind) => go(kind === 'triage' ? 'ed/triage' : 'ed/nursing'),
    toVisit: (kind, visitId) => go(kind === 'triage' ? 'ed/triage/v' : 'ed/nursing/v', { visitId }),
    toCC: (tab) => go(tab ? 'ed/cc/' + tab : 'ed/cc/board'),
    toHome: () => go('home'),
    // Init from current URL hash
    init: function () {
      if (S.initialized) return;
      S.initialized = true;

      // Install hashchange listener
      window.addEventListener('hashchange', onHashChange);
      window.addEventListener('popstate', onHashChange);

      // Parse initial
      const p = parseHash();
      S.route = p.route;
      S.visitId = p.visitId;
      S.patientId = p.patientId;

      // Wait for NABZ to be ready, then apply
      let tries = 0;
      const boot = () => {
        if (window.NABZ && typeof window.NABZ.show === 'function') {
          apply();
        } else if (++tries < 100) {
          setTimeout(boot, 50);
        } else {
          console.warn('[NAV] NABZ never became available');
        }
      };
      boot();
    }
  };
})();
