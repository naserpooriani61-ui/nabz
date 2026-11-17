(function() {
  'use strict';
  var NS = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _cache: null,
    _ward: null,
    _tab: 'patients',

    show: async function(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!NS._ward) {
          try {
            var w = await NS._api('/api/nursing/wards');
            NS._ward = w.current || (w.items[0] ? w.items[0].code : null);
          } catch (_) {}
        }
        if (!NS._ward) {
          m.innerHTML = '<div class="empty">بخشی به شما اختصاص نیافته. با مدیر سیستم تماس بگیرید.</div>';
          return;
        }
        var r = await NS._api('/api/nursing/station?ward=' + encodeURIComponent(NS._ward));
        NS._cache = r;
        NS._render(p);
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + NS._esc(e.message) + '</div>';
      }
    },

    _render: function(p) {
      var d = NS._cache;
      if (!d) return;
      var m = document.getElementById('content');
      var h = '';

      // Header
      h += '<div class="card" style="padding:12px;margin-bottom:10px;background:linear-gradient(135deg,rgba(6,182,212,.12),rgba(139,92,246,.06))">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
      h += '<div><div style="font-size:18px;font-weight:900">' + NS._esc(d.ward.label) + '</div>';
      h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + NS._esc(d.ward.headNurseName || '') + ' / شیفت ' + d.shiftLabel + '</div></div>';
      h += '<div style="text-align:left;font-size:10.5px;color:var(--fg-2);line-height:1.6">';
      h += '<div><b>' + d.beds.occupied + '</b>/' + d.beds.total + ' تخت</div>';
      h += '<div>' + d.beds.available + ' آزاد</div>';
      h += '</div></div>';
      h += '</div>';

      // Critical alerts banner
      var alertCount = d.sepsis.total + d.criticalLabs.total + d.isolation.total;
      if (alertCount > 0) {
        h += '<div style="background:var(--dng-soft);border:2px solid var(--dng);border-radius:10px;padding:10px;margin-bottom:10px;animation:pulse-critical 2s infinite">';
        if (d.sepsis.total > 0) h += '<div style="font-size:12px;font-weight:900;color:var(--dng)">🦠 ' + d.sepsis.total + ' سپسیس فعال</div>';
        if (d.criticalLabs.total > 0) h += '<div style="font-size:12px;font-weight:900;color:var(--dng)">🧪 ' + d.criticalLabs.total + ' آزمایش بحرانی بدون read-back</div>';
        if (d.isolation.total > 0) h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">🧼 ' + d.isolation.total + ' بیمار ایزوله</div>';
        h += '</div>';
      }

      // Stats
      h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:10px">';
      h += '<div class="rd-stat ' + (d.patients.some(function(p){return (p.news2||0) >= 7;}) ? 'dng' : '') + '"><div class="v">' + d.patients.filter(function(p){return (p.news2||0) >= 5;}).length + '</div><div class="l">پرخطر</div></div>';
      h += '<div class="rd-stat ' + (d.marBoard.overdue > 0 ? 'dng' : 'warn') + '"><div class="v">' + d.marBoard.overdue + '</div><div class="l">MAR دیرکرد</div></div>';
      h += '<div class="rd-stat ' + (d.vitalsDue.total > 0 ? 'warn' : 'ok') + '"><div class="v">' + d.vitalsDue.total + '</div><div class="l">ویتال سررسید</div></div>';
      h += '<div class="rd-stat info"><div class="v">' + d.patients.length + '</div><div class="l">بیمار</div></div>';
      h += '</div>';

      // Tabs
      h += '<div class="crisis-tabs" style="margin-bottom:10px;flex-wrap:wrap">';
      [['patients', 'بیماران (' + d.patients.length + ')'],
       ['mar', 'MAR (' + d.marBoard.total + ')'],
       ['vitals', 'ویتال (' + d.vitalsDue.total + ')'],
       ['alerts', 'هشدارها (' + alertCount + ')']].forEach(function(t) {
        h += '<button class="crisis-tab' + (NS._tab === t[0] ? ' on' : '') + '" onclick="NABZ.nursingStation._setTab(\'' + t[0] + '\')">' + t[1] + '</button>';
      });
      h += '</div>';

      h += '<div id="nsContent"></div>';
      m.innerHTML = h;
      if (NS._tab === 'patients') NS._renderPatients();
      else if (NS._tab === 'mar') NS._renderMar();
      else if (NS._tab === 'vitals') NS._renderVitals();
      else if (NS._tab === 'alerts') NS._renderAlerts();
      NABZ.state.current = p ? p.id : 'nursing_station.station';
    },

    _setTab: function(t) { NS._tab = t; NS._render(null); },

    _renderPatients: function() {
      var el = document.getElementById('nsContent');
      if (!el) return;
      var items = NS._cache.patients || [];
      if (!items.length) { el.innerHTML = '<div class="empty">بیماری در این بخش بستری نیست</div>'; return; }
      var h = '';
      items.forEach(function(p) {
        var lvl = p.hasSepsis ? 'dng' : (p.news2 >= 7 || p.hasCriticalLab) ? 'dng' : p.news2 >= 5 ? 'warn' : 'ok';
        var badges = [];
        if (p.hasSepsis) badges.push('🦠');
        if (p.hasCriticalLab) badges.push('🧪');
        if (p.hasIsolation) badges.push('🧼');
        if (p.marOverdue > 0) badges.push('💊');
        h += '<div class="card" style="padding:10px;margin-bottom:4px;border-right:3px solid var(--' + lvl + ');cursor:pointer" onclick="NABZ.clinicalHub.openPatient(\'' + p.id + '\')">';
        h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
        h += '<div style="flex:1;min-width:0">';
        h += '<div style="font-size:12.5px;font-weight:900">' + badges.join(' ') + ' ' + NS._esc(p.name) + '</div>';
        h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">' + (p.age||'?') + ' سال / تخت ' + NS._esc(p.bed||'') + '</div>';
        if (p.diagnosis) h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">' + NS._esc(p.diagnosis.slice(0, 50)) + '</div>';
        h += '</div>';
        h += '<div style="text-align:left">';
        if (p.news2 !== null) h += '<span class="pill ' + ((p.news2||0) >= 7 ? 'dng' : (p.news2||0) >= 5 ? 'warn' : 'info') + '" style="font-size:9px">NEWS ' + p.news2 + '</span> ';
        if (p.marDue > 0) h += '<span class="pill ' + (p.marOverdue > 0 ? 'dng' : 'warn') + '" style="font-size:9px">MAR ' + p.marDue + '</span>';
        h += '</div></div></div>';
      });
      el.innerHTML = h;
    },

    _renderMar: function() {
      var el = document.getElementById('nsContent');
      if (!el) return;
      var board = NS._cache.marBoard;
      if (board.total === 0) { el.innerHTML = '<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">✅</div><div style="font-weight:900;margin-top:8px">هیچ دوزی در ۲ ساعت آینده</div></div>'; return; }
      var h = '<div style="font-size:11.5px;color:var(--fg-2);margin-bottom:10px">' + board.total + ' دوز / ' + board.overdue + ' دیرکرد / ' + board.highAlert + ' پرخطر</div>';
      board.byHour.forEach(function(bh) {
        var nowH = new Date().getHours();
        var cls = bh.hour <= nowH ? 'dng' : bh.hour <= nowH + 1 ? 'warn' : 'info';
        h += '<div class="card" style="padding:10px;margin-bottom:6px;border-right:3px solid var(--' + cls + ')">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
        h += '<div style="font-weight:900;font-size:13px">⏰ ساعت ' + String(bh.hour).padStart(2,'0') + ':00</div>';
        h += '<span class="pill ' + cls + '">' + bh.count + ' دوز</span>';
        h += '</div>';
        bh.items.forEach(function(m) {
          h += '<div style="padding:6px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;font-size:11px;' + (m.isHighAlert ? 'border-left:3px solid var(--dng)' : '') + '">';
          h += '<b>' + NS._esc(m.patientName) + '</b>' + (m.bed ? ' (تخت ' + NS._esc(m.bed) + ')' : '') + ' — ' + NS._esc(m.drug) + ' ' + NS._esc(m.dose);
          if (m.isHighAlert) h += ' ⚠️';
          h += '</div>';
        });
        h += '</div>';
      });
      el.innerHTML = h;
    },

    _renderVitals: function() {
      var el = document.getElementById('nsContent');
      if (!el) return;
      var v = NS._cache.vitalsDue;
      if (v.total === 0) { el.innerHTML = '<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">✅</div><div style="font-weight:900;margin-top:8px">همه ویتال‌ها به‌روزند</div></div>'; return; }
      var h = '<div style="font-size:11.5px;color:var(--fg-2);margin-bottom:10px">' + v.total + ' بیمار بدون ویتال در ۴ ساعت گذشته</div>';
      v.list.forEach(function(p) {
        var cls = p.hoursSince === null ? 'dng' : p.hoursSince > 8 ? 'dng' : p.hoursSince > 6 ? 'warn' : 'info';
        h += '<div class="card" style="padding:10px;margin-bottom:4px;border-right:3px solid var(--' + cls + ')">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center">';
        h += '<div><div style="font-weight:900;font-size:12px">' + NS._esc(p.name) + '</div>';
        h += '<div style="font-size:10.5px;color:var(--fg-2)">تخت ' + NS._esc(p.bed||'') + '</div></div>';
        h += '<span class="pill ' + cls + '">' + (p.hoursSince === null ? 'ثبت نشده' : p.hoursSince + ' ساعت') + '</span>';
        h += '</div></div>';
      });
      el.innerHTML = h;
    },

    _renderAlerts: function() {
      var el = document.getElementById('nsContent');
      if (!el) return;
      var d = NS._cache;
      var h = '';
      if (d.sepsis.total > 0) {
        h += '<div class="sec-hd" style="margin-bottom:6px"><span>🦠 سپسیس (' + d.sepsis.total + ')</span></div>';
        d.sepsis.list.forEach(function(s) {
          h += '<div class="card" style="padding:8px;margin-bottom:3px;border-color:var(--dng)"><b>' + NS._esc(s.patientName) + '</b> / ' + NS._esc(s.status) + '</div>';
        });
      }
      if (d.criticalLabs.total > 0) {
        h += '<div class="sec-hd" style="margin:12px 0 6px"><span>🧪 آزمایش بحرانی (' + d.criticalLabs.total + ')</span></div>';
        d.criticalLabs.list.forEach(function(l) {
          h += '<div class="card" style="padding:8px;margin-bottom:3px;border-color:var(--dng)"><b>' + NS._esc(l.patientName) + '</b> / ' + NS._esc(l.panel) + ' / ' + l.flags + ' مورد</div>';
        });
      }
      if (d.isolation.total > 0) {
        h += '<div class="sec-hd" style="margin:12px 0 6px"><span>🧼 ایزولاسیون (' + d.isolation.total + ')</span></div>';
        d.isolation.list.forEach(function(i) {
          h += '<div class="card" style="padding:8px;margin-bottom:3px;border-color:var(--warn)"><b>' + NS._esc(i.patientName) + '</b> / ' + NS._esc(i.type) + '</div>';
        });
      }
      if (d.handoffs.total > 0) {
        h += '<div class="sec-hd" style="margin:12px 0 6px"><span>📋 تحویل در انتظار (' + d.handoffs.total + ')</span></div>';
        d.handoffs.list.forEach(function(h2) {
          h += '<div class="card" style="padding:8px;margin-bottom:3px"><b>' + NS._esc(h2.fromUserName) + '</b> / ' + h2.patientCount + ' بیمار</div>';
        });
      }
      if (!h) h = '<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">✅</div><div style="font-weight:900;margin-top:8px">هیچ هشداری در بخش</div></div>';
      el.innerHTML = h;
    }
  };

  window.NABZ = window.NABZ || {};
  NABZ.nursingStation = NS;

  var tries = 0;
  (function tryReg() {
    if (NABZ._dispatchRegistry && typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('nursing_station', function(p, d) { return NS.show(p, d); });
      console.log('[nursing-station-ui] registered');
      return;
    }
    if (++tries > 60) { console.warn('[nursing-station] timeout'); return; }
    setTimeout(tryReg, 100);
  })();
  console.log('[nursing-station-ui] loaded');
})();
