// ═══════════════════════════════════════════════════════════
//  NABZ — UI Fixes (drawer, search, offline)
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  // ── Order sections by clinical priority ──
  var PREFERRED = [
    'clinical','emergency','encounters','workflow','paraclinical',
    'surgical','safety','shift_assistant','bedboard','nursing_report',
    'crisis','cdss','education','education_studio','quality','rights',
    'ops','advanced_hr','analytics','qr_pulse','home','ops2','admin','stream'
  ];

  var FAVS_KEY = 'zz_drawer_favs';
  var LAST_KEY = 'zz_drawer_last';

  function getFavs() {
    try { return JSON.parse(localStorage.getItem(FAVS_KEY) || '[]'); } catch (_) { return []; }
  }
  function saveFavs(arr) {
    try { localStorage.setItem(FAVS_KEY, JSON.stringify(arr)); } catch (_) {}
  }
  function toggleFav(panelId, ev) {
    ev.stopPropagation();
    var favs = getFavs();
    var idx = favs.indexOf(panelId);
    if (idx >= 0) favs.splice(idx, 1); else favs.unshift(panelId);
    saveFavs(favs);
    zzRenderDrawer();
  }

  // ── Store panel state ──
  var _state = {
    search: '',
    collapsed: {}, // module → true/false
    built: false
  };

  // ── Build the new drawer ──
  function zzBuildDrawer() {
    var drawer = document.getElementById('drawer');
    if (!drawer) return;
    var panel = drawer.querySelector('.drawer-panel');
    if (!panel) return;

    var user = NABZ.state && NABZ.state.user;
    var panels = (NABZ.state && NABZ.state.panels) || [];

    // Group by module
    var byModule = {};
    panels.forEach(function(p) {
      var m = p.module || (p.id.split('.')[0]);
      if (!byModule[m]) byModule[m] = [];
      byModule[m].push(p);
    });

    // Sort
    var order = PREFERRED.filter(function(m) { return byModule[m]; });
    Object.keys(byModule).forEach(function(m) { if (order.indexOf(m) < 0) order.push(m); });

    // Hide some modules
    var HIDDEN = ['actions','documents','stream'];
    order = order.filter(function(m) { return HIDDEN.indexOf(m) < 0; });

    // Module labels
    var LBL = {
      clinical:'بالینی', emergency:'اورژانس', encounters:'راند و درمان',
      workflow:'گردش کار', paraclinical:'پاراکلینیک', surgical:'جراحی',
      safety:'ایمنی بیمار', shift_assistant:'دستیار شیفت', bedboard:'تخت',
      nursing_report:'گزارش پرستاری', crisis:'بحران', cdss:'موتور بالینی',
      education:'آموزش', education_studio:'استودیوی آموزش', quality:'کیفیت',
      rights:'حقوق بیمار', ops:'عملیات', advanced_hr:'منابع انسانی',
      analytics:'تحلیل', qr_pulse:'QR', home:'خانه', ops2:'سیستم',
      admin:'مدیریت'
    };
    var ICO = {
      clinical:'🩺', emergency:'🚨', encounters:'📝', workflow:'🔄',
      paraclinical:'🧪', surgical:'🔪', safety:'⚠️', shift_assistant:'🏥',
      bedboard:'🛏️', nursing_report:'📝', crisis:'🔥', cdss:'🧠',
      education:'🎓', education_studio:'🎓', quality:'⭐', rights:'⚖️',
      ops:'⚙️', advanced_hr:'💰', analytics:'📊', qr_pulse:'📱',
      home:'🏠', ops2:'🛡️', admin:'🔒'
    };

    var favs = getFavs();
    var favPanels = favs.map(function(id) {
      return panels.find(function(p) { return p.id === id; });
    }).filter(Boolean);

    var html = '';

    // Header
    html += '<div class="zz-drawer-hd">';
    html += '<div class="zz-drawer-logo">🫀 <strong>نبض</strong></div>';
    html += '<button class="zz-drawer-close" onclick="NABZ.hideDrawer()" aria-label="بستن">✕</button>';
    html += '</div>';

    // User chip
    if (user) {
      var roleFa = { admin:'مدیر', nurse:'پرستار', head_nurse:'سرپرستار',
        matron:'مترون', attending:'استاد', specialist:'متخصص',
        resident:'رزیدنت', intern:'اینترن', physician:'پزشک',
        pharmacist:'داروساز', lab_tech:'تکنسین', radiology_tech:'رادیولوژی',
        receptionist:'پذیرش', supervisor:'سوپروایزر',
        clinical_supervisor:'سوپروایزر بالینی', shift_staff:'پرسنل' }[user.role] || user.role;
      html += '<div class="zz-drawer-user">';
      html += '<div style="font-size:13px;font-weight:900">' + NABZ._esc(user.fullName || user.username) + '</div>';
      html += '<div style="font-size:10px;color:var(--fg-2)">' + roleFa + (user.ward ? ' · ' + NABZ._esc(user.ward) : '') + '</div>';
      html += '</div>';
    }

    // Search
    html += '<div class="zz-drawer-search-wrap">';
    html += '<input id="zzDrawerSearch" type="search" placeholder="🔍 جستجوی پنل..." value="' + NABZ._esc(_state.search) + '" autocomplete="off">';
    html += '</div>';

    // Favorites
    if (favPanels.length) {
      html += '<div class="zz-drawer-favs"><div class="zz-drawer-fav-hd">⭐ دسترسی سریع</div>';
      favPanels.forEach(function(p) {
        html += '<button class="zz-fav-item" onclick="NABZ.show(\'' + p.id + '\');NABZ.hideDrawer()">';
        html += '<span class="zz-fav-ico">' + (p.icon || '📄') + '</span>';
        html += '<span class="zz-fav-lbl">' + NABZ._esc(p.title) + '</span>';
        html += '<span class="zz-fav-x" onclick="zzToggleFav(\'' + p.id + '\',event)" title="حذف از دسترسی سریع">✕</span>';
        html += '</button>';
      });
      html += '</div>';
    }

    // Sections
    html += '<div class="zz-drawer-sections" id="zzDrawerSections">';
    order.forEach(function(mod) {
      var items = byModule[mod] || [];
      if (!items.length) return;
      // Filter by search
      var q = _state.search.toLowerCase().trim();
      var filtered = q ? items.filter(function(p) {
        var txt = ((p.title || '') + ' ' + (p.id || '')).toLowerCase();
        return txt.indexOf(q) >= 0;
      }) : items;
      if (q && !filtered.length && !(LBL[mod] || mod).toLowerCase().includes(q)) return;

      var isCollapsed;
      if (q) isCollapsed = false;
      else if (_state.collapsed[mod] !== undefined) isCollapsed = !!_state.collapsed[mod];
      else isCollapsed = true;
      // Default: collapsed unless this is the last used
      var lastUsed = localStorage.getItem(LAST_KEY);
      if (_state.collapsed[mod] === undefined && lastUsed === mod) isCollapsed = false;

      var finalItems = q ? filtered : items;

      html += '<div class="zz-drawer-sec" data-module="' + mod + '">';
      html += '<button class="zz-drawer-sec-hd" onclick="zzToggleSection(\'' + mod + '\')">';
      html += '<span class="zz-sec-ico">' + (ICO[mod] || '📄') + '</span>';
      html += '<span class="zz-sec-lbl">' + (LBL[mod] || mod) + '</span>';
      html += '<span class="zz-sec-count">' + items.length + '</span>';
      html += '<span class="zz-sec-arrow">' + (isCollapsed ? '▸' : '▼') + '</span>';
      html += '</button>';
      html += '<div class="zz-sec-items" style="display:' + (isCollapsed ? 'none' : 'block') + '">';
      finalItems.forEach(function(p) {
        var isFav = favs.indexOf(p.id) >= 0;
        html += '<div class="zz-item" onclick="NABZ.show(\'' + p.id + '\');NABZ.hideDrawer();localStorage.setItem(\'' + LAST_KEY + '\',\'' + mod + '\')">';
        html += '<span class="zz-item-ico">' + (p.icon || '📄') + '</span>';
        html += '<span class="zz-item-lbl">' + NABZ._esc(p.title) + '</span>';
        html += '<button class="zz-item-fav' + (isFav ? ' on' : '') + '" onclick="zzToggleFav(\'' + p.id + '\',event)" title="' + (isFav ? 'حذف' : 'افزودن') + '">' + (isFav ? '★' : '☆') + '</button>';
        html += '</div>';
      });
      html += '</div></div>';
    });
    html += '</div>';

    // Footer
    html += '<div class="zz-drawer-footer">';
    html += '<button class="zz-footer-btn" onclick="NABZ.showNeural();NABZ.hideDrawer()"><span>🧠</span>موتور عصبی</button>';
    html += '<button class="zz-footer-btn dng" onclick="NABZ.logout()"><span>⏻</span>خروج</button>';
    html += '</div>';

    panel.innerHTML = html;
    panel.style.cssText = '';

    // Bind search
    var inp = document.getElementById('zzDrawerSearch');
    if (inp) {
      inp.addEventListener('input', function() {
        _state.search = this.value;
        zzRenderDrawer();
        setTimeout(function() {
          var el = document.getElementById('zzDrawerSearch');
          if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
        }, 20);
      });
    }

    _state.built = true;
  }

  function zzRenderDrawer() {
    zzBuildDrawer();
  }

  window.zzToggleSection = function(mod) {
    var cur = _state.collapsed[mod] === undefined ? true : !!_state.collapsed[mod];
    _state.collapsed[mod] = !cur;
    zzRenderDrawer();
  };

  window.zzToggleFav = function(panelId, ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    var favs = getFavs();
    var idx = favs.indexOf(panelId);
    if (idx >= 0) favs.splice(idx, 1); else favs.unshift(panelId);
    saveFavs(favs);
    zzRenderDrawer();
  };

  // ── Wrap showDrawer ──
  function patchShowDrawer() {
    if (!window.NABZ || typeof NABZ.showDrawer !== 'function') return setTimeout(patchShowDrawer, 100);
    if (NABZ.showDrawer._zzWrapped) return;
    var orig = NABZ.showDrawer;
    NABZ.showDrawer = function() {
      orig.call(NABZ);
      zzBuildDrawer();
    };
    NABZ.showDrawer._zzWrapped = true;
    console.log('[zz-ui] drawer wrapped ✓');
  }
  patchShowDrawer();

  // ── Fix search modal ──
  function patchSearch() {
    if (!window.NABZ || typeof NABZ._api !== 'function') return setTimeout(patchSearch, 100);

    NABZ.showSearch = function() {
      var sheet = document.createElement('div');
      sheet.className = 'bs-backdrop';
      sheet.onclick = function(e) { if (e.target === sheet) sheet.remove(); };

      var html = '<div class="bs-handle"></div>';
      html += '<div class="bs-hd"><div class="bs-title">🔍 جستجوی سراسری</div>';
      html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      html += '<input id="nsIn" type="search" placeholder="نام بیمار، دارو، خدمت..." autocomplete="off" ';
      html += 'style="width:100%;padding:14px;font-size:15px;border:1.5px solid var(--border-2);background:var(--bg-2);color:var(--fg);border-radius:12px;margin-bottom:14px;font-family:inherit;outline:none">';
      html += '<div id="nsRes" style="max-height:55vh;overflow-y:auto;min-height:100px">';
      html += '<div class="empty" style="padding:24px;text-align:center;color:var(--fg-2)">حداقل ۲ حرف تایپ کنید...</div>';
      html += '</div>';

      var content = document.createElement('div');
      content.className = 'bs-sheet';
      content.innerHTML = html;
      sheet.appendChild(content);
      document.body.appendChild(sheet);
      requestAnimationFrame(function() { sheet.classList.add('show'); });

      var input = content.querySelector('#nsIn');
      var res = content.querySelector('#nsRes');
      var timer;

      input.oninput = function() {
        clearTimeout(timer);
        var q = input.value.trim();
        if (q.length < 2) {
          res.innerHTML = '<div class="empty" style="padding:24px">حداقل ۲ حرف</div>';
          return;
        }
        res.innerHTML = '<div style="text-align:center;padding:20px"><span class="spinner"></span></div>';
        timer = setTimeout(function() {
          zzSearch(q, res);
        }, 300);
      };
      setTimeout(function() { input.focus(); }, 100);
    };

    async function zzSearch(q, res) {
      // Try API first
      try {
        var d = await NABZ._api('/api/home/search?q=' + encodeURIComponent(q));
        if (d && d.items && d.items.length) {
          res.innerHTML = zzRenderResults(d.items);
          return;
        }
        // No API results → try client-side
        var clientResults = zzClientSearch(q);
        if (clientResults.length) {
          res.innerHTML = zzRenderResults(clientResults);
          return;
        }
        res.innerHTML = '<div class="empty" style="padding:24px">نتیجه‌ای یافت نشد</div>';
      } catch (e) {
        // API failed → client-side fallback
        var cr = zzClientSearch(q);
        if (cr.length) {
          res.innerHTML = zzRenderResults(cr);
        } else {
          res.innerHTML = '<div class="empty" style="padding:24px">خطا در جستجو: ' + NABZ._esc(e.message) + '</div>';
        }
      }
    }

    function zzClientSearch(q) {
      var results = [];
      var panels = (NABZ.state && NABZ.state.panels) || [];
      var lowerQ = q.toLowerCase();

      // Search panels
      panels.forEach(function(p) {
        var txt = ((p.title || '') + ' ' + (p.id || '')).toLowerCase();
        if (txt.indexOf(lowerQ) >= 0) {
          results.push({
            module: 'panel', panel: p.id,
            item: { name: p.title, _panelId: p.id, _icon: p.icon }
          });
        }
      });
      return results;
    }

    function zzRenderResults(items) {
      var h = '';
      var seen = {};
      items.forEach(function(r) {
        var it = r.item || {};
        var nm = it.patientName || ((it.firstName || '') + ' ' + (it.lastName || '')).trim()
              || it.fullName || it.drugName || it.name
              || (it.description || '').slice(0, 40) || '?';
        var path = r.item && r.item._panelId ? r.item._panelId : (r.module + '.' + r.panel);
        if (seen[path + nm]) return;
        seen[path + nm] = true;
        var icon = (r.item && r.item._icon) || '📄';
        h += '<div class="row lo" onclick="zzGotoResult(\'' + path + '\')" style="cursor:pointer">';
        h += '<div class="row-hd"><div class="row-title">' + icon + ' ' + NABZ._esc(String(nm).slice(0, 50)) + '</div>';
        if (r.module && r.module !== 'panel') {
          h += '<span class="pill info">' + NABZ._esc(r.module) + '</span>';
        }
        h += '</div></div>';
      });
      return h || '<div class="empty" style="padding:24px">نتیجه‌ای یافت نشد</div>';
    }

    window.zzGotoResult = function(path) {
      var bd = document.querySelector('.bs-backdrop');
      if (bd) bd.remove();
      NABZ.show(path);
    };

    console.log('[zz-ui] search rewritten ✓');
  }
  patchSearch();

  // ── Fix offline isFlushing stuck ──
  setInterval(function() {
    if (!window.NABZ || !NABZ.offline) return;
    if (NABZ.offline.isFlushing) {
      if (!window._zzFlushStart) window._zzFlushStart = Date.now();
      else if (Date.now() - window._zzFlushStart > 10000) {
        console.warn('[zz-ui] flush stuck >10s — force reset');
        NABZ.offline.isFlushing = false;
        window._zzFlushStart = null;
        if (typeof NABZ.offline._updateUI === 'function') {
          try { NABZ.offline._updateUI(); } catch (_) {}
        }
      }
    } else {
      window._zzFlushStart = null;
    }
  }, 2000);

  // ── Drop stale queue items ──
  setInterval(function() {
    if (!window.NABZ || !NABZ.offline || !navigator.onLine) return;
    if (typeof NABZ.offline.listQueue !== 'function') return;
    NABZ.offline.listQueue().then(function(items) {
      if (!items || !items.length) return;
      items.forEach(function(item) {
        var age = Date.now() - (item.createdAt || 0);
        if (age > 3600000 || (item.attempts || 0) > 5) {
          console.warn('[zz-ui] dropping stale queue item:', item.url);
          if (typeof NABZ.offline.removeFromQueue === 'function') {
            try { NABZ.offline.removeFromQueue(item.id); } catch (_) {}
          }
        }
      });
    }).catch(function() {});
  }, 60000);

  console.log('[zz-ui] loaded ✓');
})();
