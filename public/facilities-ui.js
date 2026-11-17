(function() {
  'use strict';
  var FAC = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _time: function(iso) { try { return new Date(iso).toLocaleString('fa-IR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); } catch(_) { return '-'; } },
    _open: function(html) {
      var s = document.createElement('div'); s.className = 'bs-backdrop';
      s.onclick = function(e) { if (e.target === s) s.remove(); };
      var c = document.createElement('div'); c.className = 'bs-sheet';
      c.style.maxHeight = '96vh'; c.innerHTML = html;
      s.appendChild(c); document.body.appendChild(s);
      requestAnimationFrame(function() { s.classList.add('show'); });
    },
    _closeAll: function() { document.querySelectorAll('.bs-backdrop').forEach(function(e) { e.remove(); }); },
    _tab: 'overview',
    _cache: {},
    _bedsFilter: { ward: '', status: '', q: '' },
    _selectedBeds: new Set(),
    _refreshTimer: null,
    _tabLabels: { overview: 'نمای کلی', beds: 'تخت‌ها', cleaning: 'نظافت', maintenance: 'تعمیرات', templates: 'قالب‌ها', capacity: 'ظرفیت' },

    show: async function(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) d = await FAC._api('/api/fac/overview');
        FAC._cache.overview = d;
        FAC._render(p);
        FAC._startAutoRefresh();
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + FAC._esc(e.message) + '</div>';
      }
    },

    _startAutoRefresh: function() {
      if (FAC._refreshTimer) clearInterval(FAC._refreshTimer);
      FAC._refreshTimer = setInterval(function() {
        if (NABZ.state.current === 'facilities.dashboard' && !document.querySelector('.bs-backdrop')) {
          FAC.show(null, null).catch(function() {});
        }
      }, 60000);
    },

    _setTab: function(tab) { FAC._tab = tab; FAC._render(); },

    _render: function(p) {
      var d = FAC._cache.overview || {};
      var tab = FAC._tab;
      var m = document.getElementById('content');
      var h = '<div class="sec-hd"><span>🛏️ تخت و تاسیسات</span></div>';
      h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">';
      h += '<div class="rd-stat info"><div class="v">' + (d.activeWards || 0) + '</div><div class="l">بخش فعال</div></div>';
      h += '<div class="rd-stat"><div class="v">' + (d.totalBeds || 0) + '</div><div class="l">کل تخت</div></div>';
      h += '<div class="rd-stat ' + ((d.occupancy || 0) >= 90 ? 'dng' : (d.occupancy || 0) >= 75 ? 'warn' : 'ok') + '"><div class="v">' + (d.occupancy || 0) + '%</div><div class="l">اشغال</div></div>';
      h += '<div class="rd-stat ' + (((d.statuses && d.statuses.available) || 0) > 0 ? 'ok' : 'dng') + '"><div class="v">' + ((d.statuses && d.statuses.available) || 0) + '</div><div class="l">آزاد</div></div>';
      h += '</div>';
      h += '<div class="crisis-tabs" style="margin-bottom:12px;flex-wrap:wrap">';
      Object.keys(FAC._tabLabels).forEach(function(t) {
        h += '<button class="crisis-tab' + (tab === t ? ' on' : '') + '" onclick="NABZ.fac._setTab(\'' + t + '\')">' + FAC._tabLabels[t] + '</button>';
      });
      h += '</div>';
      h += '<div id="facTabContent"></div>';
      m.innerHTML = h;
      if (tab === 'overview') FAC._renderOverview();
      else if (typeof FAC._loadTab === 'function') FAC._loadTab(tab);
      NABZ.state.current = p ? p.id : 'facilities.dashboard';
    },

    _newWard: function() { alert('chunk 2 not loaded'); },
    _editWard: function() { alert('chunk 2 not loaded'); },
    _closeWard: function() { alert('chunk 2 not loaded'); },
    _openWard: function() { alert('chunk 2 not loaded'); },
    _viewWardBeds: function(code) { FAC._bedsFilter.ward = code; FAC._setTab('beds'); }
  };
  window.NABZ = window.NABZ || {};
  NABZ.fac = FAC;
  var tries = 0;
  (function tryReg() {
    if (NABZ._dispatchRegistry && typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('facilities', function(p, d) { return FAC.show(p, d); });
      console.log('[facilities-ui] registered');
      return;
    }
    if (++tries > 60) { console.warn('[facilities-ui] timeout'); return; }
    setTimeout(tryReg, 100);
  })();
  console.log('[facilities-ui] chunk1 loaded');
})();
