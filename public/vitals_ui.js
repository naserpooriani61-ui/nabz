'use strict';
(function () {
  var V = {
    _patientId: null,
    _cache: null,
    _tab: 'now',

    _api: function (url, opts) {
      if (typeof NABZ !== 'undefined' && typeof NABZ._api === 'function') return NABZ._api(url, opts);
      return fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {})).then(function (r) {
        if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
        return r.json();
      });
    },
    _esc: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    _fmtTime: function (iso) {
      if (!iso) return '—';
      try {
        return new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      } catch (_) { return '—'; }
    },
    _rel: function (iso) {
      if (!iso) return '';
      var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
      if (m < 60) return m + ' دقیقه پیش';
      if (m < 1440) return Math.floor(m / 60) + ' ساعت پیش';
      return Math.floor(m / 1440) + ' روز پیش';
    },
    _color: function (key, val) {
      if (val == null || val === '') return { c: '#94a3b8', bg: '#f8fafc', label: '—' };
      var n = Number(val);
      if (key === 'hr') {
        if (n <= 40 || n >= 131) return { c: '#dc2626', bg: '#fef2f2', label: 'بحرانی' };
        if (n <= 50 || n >= 111) return { c: '#d97706', bg: '#fffbeb', label: 'هشدار' };
        return { c: '#059669', bg: '#f0fdf4', label: 'طبیعی' };
      }
      if (key === 'bp_sys') {
        if (n <= 90 || n >= 220) return { c: '#dc2626', bg: '#fef2f2', label: 'بحرانی' };
        if (n <= 100) return { c: '#d97706', bg: '#fffbeb', label: 'پایین' };
        return { c: '#059669', bg: '#f0fdf4', label: 'طبیعی' };
      }
      if (key === 'spo2') {
        if (n <= 91) return { c: '#dc2626', bg: '#fef2f2', label: 'بحرانی' };
        if (n <= 95) return { c: '#d97706', bg: '#fffbeb', label: 'هشدار' };
        return { c: '#059669', bg: '#f0fdf4', label: 'طبیعی' };
      }
      if (key === 'rr') {
        if (n <= 8 || n >= 25) return { c: '#dc2626', bg: '#fef2f2', label: 'بحرانی' };
        if (n <= 11 || n >= 21) return { c: '#d97706', bg: '#fffbeb', label: 'هشدار' };
        return { c: '#059669', bg: '#f0fdf4', label: 'طبیعی' };
      }
      if (key === 'temp') {
        if (n <= 35 || n >= 39.1) return { c: '#dc2626', bg: '#fef2f2', label: 'بحرانی' };
        if (n <= 36 || n >= 38.1) return { c: '#d97706', bg: '#fffbeb', label: 'هشدار' };
        return { c: '#059669', bg: '#f0fdf4', label: 'طبیعی' };
      }
      return { c: '#64748b', bg: '#f8fafc', label: '' };
    },
    _newsColor: function (level) {
      if (level === 'critical') return { bg: '#7f1d1d', fg: '#fff', border: '#dc2626' };
      if (level === 'high') return { bg: '#9a3412', fg: '#fff', border: '#ea580c' };
      if (level === 'medium') return { bg: '#a16207', fg: '#fff', border: '#d97706' };
      return { bg: '#065f46', fg: '#fff', border: '#059669' };
    },
    _svgChart: function (series) {
      if (!series || series.length < 2) {
        return '<div style="text-align:center;color:#94a3b8;padding:24px;font-size:13px">دادهٔ کافی برای نمودار نیست</div>';
      }
      var pad = 28, W = 340, H = 160, n = series.length;
      var xs = series.map(function (_, i) { return pad + (i / (n - 1)) * (W - pad * 2); });
      function line(key, color, minV, maxV) {
        var vals = series.map(function (s) { return s[key]; }).filter(function (v) { return v != null && isFinite(v); });
        if (vals.length < 2) return '';
        var lo = minV != null ? minV : Math.min.apply(null, vals);
        var hi = maxV != null ? maxV : Math.max.apply(null, vals);
        var span = (hi - lo) || 1;
        var pts = [];
        series.forEach(function (s, i) {
          var v = s[key];
          if (v == null || !isFinite(v)) return;
          var y = H - pad - ((v - lo) / span) * (H - pad * 2);
          pts.push(xs[i] + ',' + y);
        });
        if (pts.length < 2) return '';
        return '<polyline fill="none" stroke="' + color + '" stroke-width="2.2" stroke-linejoin="round" points="' + pts.join(' ') + '"/>';
      }
      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;background:#0f172a;border-radius:12px">';
      svg += '<line x1="' + pad + '" y1="' + (H / 2) + '" x2="' + (W - pad) + '" y2="' + (H / 2) + '" stroke="#1e293b" stroke-width="1"/>';
      svg += line('news', '#f59e0b', 0, 20);
      svg += line('hr', '#38bdf8', 40, 180);
      svg += line('spo2', '#34d399', 70, 100);
      svg += line('sbp', '#f472b6', 70, 200);
      svg += '<text x="' + pad + '" y="14" fill="#94a3b8" font-size="10">NEWS2</text>';
      svg += '<circle cx="' + (pad + 42) + '" cy="10" r="3" fill="#f59e0b"/>';
      svg += '<text x="' + (pad + 55) + '" y="14" fill="#94a3b8" font-size="10">HR</text>';
      svg += '<circle cx="' + (pad + 78) + '" cy="10" r="3" fill="#38bdf8"/>';
      svg += '<text x="' + (pad + 90) + '" y="14" fill="#94a3b8" font-size="10">SpO2</text>';
      svg += '<circle cx="' + (pad + 120) + '" cy="10" r="3" fill="#34d399"/>';
      svg += '<text x="' + (pad + 132) + '" y="14" fill="#94a3b8" font-size="10">SBP</text>';
      svg += '<circle cx="' + (pad + 160) + '" cy="10" r="3" fill="#f472b6"/>';
      svg += '</svg>';
      return svg;
    },

    show: function (p, d) {
      var m = document.getElementById('content');
      if (!m) return;
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      V._patientId = (d && d.patientId) || (p && p.patientId) || null;
      if (!V._patientId && typeof location !== 'undefined') {
        V._patientId = new URLSearchParams(location.search).get('patientId');
      }

      var load = function () {
        if (V._patientId) {
          return Promise.all([
            V._api('/api/clinical/vitals?patientId=' + encodeURIComponent(V._patientId)),
            V._api('/api/clinical/vitals/' + encodeURIComponent(V._patientId) + '/chart').catch(function () { return { series: [] }; })
          ]).then(function (arr) {
            return { items: (arr[0].items || arr[0] || []), series: arr[1].series || [] };
          });
        }
        return V._api('/api/clinical/vitals').then(function (list) {
          return { items: (list.items || list || []).slice(0, 30), series: [] };
        });
      };

      load().then(function (data) {
        var items = (data.items || []).slice().sort(function (a, b) {
          return new Date(b.recordedAt) - new Date(a.recordedAt);
        });
        var series = data.series || [];
        V._cache = { items: items, series: series };
        var latest = items[0] || {};
        var prev = items[1] || {};
        var newsLevel = latest.newsLevel || (latest.news2 >= 7 ? 'critical' : latest.news2 >= 5 ? 'high' : latest.news2 >= 1 ? 'medium' : 'low');
        var nc = V._newsColor(newsLevel);
        var h = '';

        h += '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;padding:14px 16px;border-radius:14px;margin:0 0 12px">';
        h += '<div style="font-size:16px;font-weight:800">علائم حیاتی · ' + V._esc(latest.patientName || V._patientId || 'همه') + '</div>';
        if (V._patientId) h += '<div style="font-size:12px;opacity:.85;margin-top:3px">' + V._esc(latest.wardCode || '') + ' · ' + V._patientId + '</div>';
        h += '</div>';

        if (latest.news2 != null) {
          h += '<div style="background:' + nc.bg + ';color:' + nc.fg + ';border:2px solid ' + nc.border + ';border-radius:14px;padding:14px;margin:0 0 14px;text-align:center">';
          h += '<div style="font-size:11px;opacity:.9;font-weight:700">NEWS2</div>';
          h += '<div style="font-size:42px;font-weight:900;line-height:1.1">' + latest.news2 + '</div>';
          h += '<div style="font-size:13px;font-weight:800;margin-top:4px">' + (newsLevel === 'critical' ? 'بحرانی' : newsLevel === 'high' ? 'بالا' : newsLevel === 'medium' ? 'متوسط' : 'پایین');
          if (latest.newsAction) h += ' · ' + V._esc(latest.newsAction);
          h += '</div>';
          if (latest.recordedAt) h += '<div style="font-size:11px;opacity:.8;margin-top:6px">' + V._rel(latest.recordedAt) + '</div>';
          h += '</div>';
        }

        if (latest.hr != null || latest.bp_sys != null) {
          var cards = [
            { key: 'hr', label: 'نبض', val: latest.hr, raw: latest.hr },
            { key: 'bp_sys', label: 'فشار', val: latest.bp_sys != null ? (latest.bp_sys + '/' + (latest.bp_dia || '—')) : null, raw: latest.bp_sys },
            { key: 'spo2', label: 'SpO2', val: latest.spo2 != null ? latest.spo2 + '%' : null, raw: latest.spo2 },
            { key: 'rr', label: 'تنفس', val: latest.rr, raw: latest.rr },
            { key: 'temp', label: 'دما', val: latest.temp, raw: latest.temp },
            { key: 'gcs', label: 'GCS', val: latest.gcs, raw: latest.gcs }
          ];
          h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 14px">';
          cards.forEach(function (c) {
            if (c.val == null && c.raw == null) return;
            var col = V._color(c.key, c.raw);
            h += '<div style="background:' + col.bg + ';border:1.5px solid ' + col.c + ';border-radius:12px;padding:10px 8px;text-align:center">';
            h += '<div style="font-size:10px;color:#64748b;font-weight:700">' + c.label + '</div>';
            h += '<div style="font-size:20px;font-weight:900;color:' + col.c + '">' + V._esc(String(c.val)) + '</div>';
            if (col.label) h += '<div style="font-size:9px;color:' + col.c + ';font-weight:700">' + col.label + '</div>';
            h += '</div>';
          });
          h += '</div>';
          if (latest.onOxygen) {
            h += '<div style="background:#dbeafe;color:#1e40af;padding:8px 12px;border-radius:10px;font-size:12px;font-weight:700;margin:0 0 12px">بیمار اکسیژن دریافت می‌کند</div>';
          }
        }

        var tabs = [['now', 'اکنون'], ['trend', 'روند'], ['entry', 'ثبت جدید']];
        h += '<div style="display:flex;gap:6px;margin:0 0 12px">';
        tabs.forEach(function (pair) {
          var id = pair[0], label = pair[1];
          var on = (V._tab || 'now') === id;
          h += '<button type="button" data-tab="' + id + '" class="vit-tab-btn" style="flex:1;padding:10px;border-radius:10px;font-weight:800;font-size:12px;border:none;';
          h += on ? 'background:#0f172a;color:#fff' : 'background:#f1f5f9;color:#475569';
          h += '">' + label + '</button>';
        });
        h += '</div>';

        var tab = V._tab || 'now';
        if (tab === 'trend') {
          var ser = series.length ? series : items.slice().reverse().map(function (v) {
            return { t: v.recordedAt, hr: v.hr, sbp: v.bp_sys, spo2: v.spo2, temp: v.temp, news: v.news2 };
          });
          h += V._svgChart(ser);
          h += '<div style="font-size:11px;color:#64748b;text-align:center;margin-top:8px">روند HR / SpO2 / SBP / NEWS2</div>';
        } else if (tab === 'entry') {
          h += V._renderEntryForm();
        } else {
          if (!items.length) {
            h += '<div style="text-align:center;color:#94a3b8;padding:30px">هنوز علائمی ثبت نشده</div>';
          } else {
            items.slice(0, 20).forEach(function (v) {
              var nl = v.newsLevel || '';
              var ncol = V._newsColor(nl);
              h += '<div style="background:#fff;border-radius:12px;padding:12px;margin-bottom:8px;border:1px solid #e2e8f0">';
              h += '<div style="display:flex;justify-content:space-between;margin-bottom:6px">';
              h += '<span style="font-size:12px;color:#64748b">' + V._fmtTime(v.recordedAt) + ' · ' + V._rel(v.recordedAt) + '</span>';
              if (v.news2 != null) h += '<span style="background:' + ncol.bg + ';color:' + ncol.fg + ';padding:2px 10px;border-radius:999px;font-size:11px;font-weight:800">NEWS2 ' + v.news2 + '</span>';
              h += '</div><div style="font-size:13px">';
              if (v.hr != null) h += '<b>HR</b> ' + v.hr + '  ';
              if (v.bp_sys != null) h += '<b>BP</b> ' + v.bp_sys + '/' + (v.bp_dia || '—') + '  ';
              if (v.spo2 != null) h += '<b>SpO2</b> ' + v.spo2 + '%  ';
              if (v.rr != null) h += '<b>RR</b> ' + v.rr + '  ';
              if (v.temp != null) h += '<b>T</b> ' + v.temp;
              h += '</div>';
              if (v.recordedByName) h += '<div style="font-size:11px;color:#94a3b8;margin-top:4px">' + V._esc(v.recordedByName) + '</div>';
              h += '</div>';
            });
          }
        }

        m.innerHTML = h;
        var btns = m.querySelectorAll('.vit-tab-btn');
        for (var i = 0; i < btns.length; i++) {
          btns[i].addEventListener('click', function (ev) {
            V.setTab(ev.currentTarget.getAttribute('data-tab'));
          });
        }
        var sub = document.getElementById('vit_submit_btn');
        if (sub) sub.addEventListener('click', function () { V.submit(); });
      }).catch(function (e) {
        m.innerHTML = '<div class="empty">خطا: ' + V._esc(e.message || e) + '</div>';
      });
    },

    setTab: function (tab) {
      V._tab = tab;
      V.show(null, V._patientId ? { patientId: V._patientId } : null);
    },

    _renderEntryForm: function () {
      var h = '<div style="background:#fff;border-radius:14px;padding:16px;border:1px solid #e2e8f0">';
      h += '<div style="font-size:14px;font-weight:800;margin-bottom:12px">ثبت سریع علائم</div>';
      var fields = [
        ['hr', 'نبض (HR)'], ['bp_sys', 'فشار سیستول'], ['bp_dia', 'فشار دیاستول'],
        ['spo2', 'SpO2 %'], ['rr', 'تنفس'], ['temp', 'دما'], ['gcs', 'GCS'], ['pain', 'درد 0-10']
      ];
      fields.forEach(function (f) {
        h += '<label style="display:block;font-size:12px;font-weight:700;color:#475569;margin:8px 0 4px">' + f[1] + '</label>';
        h += '<input id="vit_' + f[0] + '" type="number" inputmode="decimal" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:16px;box-sizing:border-box">';
      });
      h += '<label style="display:flex;align-items:center;gap:8px;margin:12px 0;font-size:13px"><input type="checkbox" id="vit_onOxygen" style="width:18px;height:18px"> اکسیژن</label>';
      h += '<label style="display:block;font-size:12px;font-weight:700;margin:8px 0 4px">هوشیاری</label>';
      h += '<select id="vit_consciousness" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px">';
      h += '<option value="alert">هوشیار</option><option value="voice">پاسخ به صدا</option><option value="pain">پاسخ به درد</option><option value="unresponsive">بدون پاسخ</option>';
      h += '</select>';
      h += '<button type="button" id="vit_submit_btn" style="width:100%;margin-top:16px;padding:14px;font-size:15px;font-weight:800;border-radius:12px;background:#0f172a;color:#fff;border:none">ثبت علائم + NEWS2</button>';
      h += '</div>';
      return h;
    },

    submit: function () {
      if (!V._patientId) return alert('بیمار مشخص نیست');
      function num(id) {
        var el = document.getElementById('vit_' + id);
        if (!el || el.value === '') return null;
        var n = Number(el.value);
        return isFinite(n) ? n : null;
      }
      var body = {
        patientId: V._patientId,
        hr: num('hr'), bp_sys: num('bp_sys'), bp_dia: num('bp_dia'),
        spo2: num('spo2'), rr: num('rr'), temp: num('temp'),
        gcs: num('gcs'), pain: num('pain'),
        onOxygen: !!(document.getElementById('vit_onOxygen') || {}).checked,
        consciousness: (document.getElementById('vit_consciousness') || {}).value || 'alert'
      };
      V._api('/api/clinical/vitals', { method: 'POST', body: JSON.stringify(body) }).then(function () {
        if (typeof NABZ !== 'undefined' && NABZ._toast) NABZ._toast('ثبت شد');
        V._tab = 'now';
        V.show(null, { patientId: V._patientId });
      }).catch(function (e) { alert('خطا: ' + (e.message || e)); });
    }
  };

  if (typeof NABZ !== 'undefined') {
    NABZ.vitalsUI = V;
    if (typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('vitals_v2', function (p, d) { return V.show(p, d); });
      NABZ.registerKind('vitals', function (p, d) { return V.show(p, d); });
    }
  }
  if (typeof location !== 'undefined' && /kind\/vitals/.test(location.pathname)) {
    setTimeout(function () {
      var pid = new URLSearchParams(location.search).get('patientId');
      V.show(null, pid ? { patientId: pid } : null);
    }, 120);
  }
})();

// Force intercept NABZ.show for vitals kinds
(function(){
  function install(){
    if (typeof NABZ === 'undefined' || !NABZ.show) return setTimeout(install, 50);
    if (NABZ._vitalsShowHooked) return;
    NABZ._vitalsShowHooked = true;
    var _orig = NABZ.show.bind(NABZ);
    NABZ.show = function(kind, data){
      if (kind === 'vitals' || kind === 'vitals_v2') {
        if (NABZ.vitalsUI && typeof NABZ.vitalsUI.show === 'function') {
          return NABZ.vitalsUI.show(null, data || {});
        }
      }
      return _orig(kind, data);
    };
  }
  install();
})();


// ── patch: patient picker + NABZ.openVitalsInteractive ──
(function () {
  function install() {
    if (typeof NABZ === 'undefined' || !NABZ.vitalsUI) return setTimeout(install, 50);
    var V = NABZ.vitalsUI;
    if (V._pickerInstalled) return;
    V._pickerInstalled = true;
    var origShow = V.show;
    V._patients = null;

    V._pname = function (p) {
      return p.name || p.fullName || p.patientName ||
        [p.firstName, p.lastName].filter(Boolean).join(' ') || p.id || '—';
    };
    V._loadPatients = function () {
      if (V._patients) return Promise.resolve(V._patients);
      return V._api('/api/clinical/patients').then(function (r) {
        var arr = Array.isArray(r) ? r : (r.items || r.patients || []);
        V._patients = arr;
        return arr;
      });
    };
    V._drawList = function (q) {
      var box = document.getElementById('vit_plist');
      if (!box) return;
      var list = (V._patients || []).filter(function (p) {
        if (!q) return true;
        var hay = (V._pname(p) + ' ' + (p.id || '') + ' ' + (p.mrn || '') + ' ' + (p.nationalId || '')).toLowerCase();
        return hay.indexOf(q.toLowerCase()) !== -1;
      }).slice(0, 60);
      if (!list.length) {
        box.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:24px;font-size:13px">بیماری پیدا نشد</div>';
        return;
      }
      var h = '';
      list.forEach(function (p) {
        var meta = [p.wardCode || p.ward, p.bed || p.bedCode, p.id].filter(Boolean).join(' · ');
        h += '<button type="button" class="vit-pick" data-pid="' + V._esc(p.id) + '" style="display:block;width:100%;text-align:right;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:8px">';
        h += '<div style="font-size:14px;font-weight:800;color:#0f172a">' + V._esc(V._pname(p)) + '</div>';
        h += '<div style="font-size:11px;color:#64748b;margin-top:3px">' + V._esc(meta) + '</div></button>';
      });
      box.innerHTML = h;
      var btns = box.querySelectorAll('.vit-pick');
      for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener('click', function (ev) {
          V._tab = 'now';
          V.show(null, { patientId: ev.currentTarget.getAttribute('data-pid') });
        });
      }
    };
    V._renderPicker = function () {
      var m = document.getElementById('content');
      if (!m) return;
      var h = '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;padding:14px 16px;border-radius:14px;margin:0 0 12px">';
      h += '<div style="font-size:16px;font-weight:800">علائم حیاتی</div>';
      h += '<div style="font-size:12px;opacity:.85;margin-top:3px">ابتدا بیمار را انتخاب کنید</div></div>';
      h += '<input id="vit_search" type="search" placeholder="جستجوی نام یا شناسه…" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:16px;box-sizing:border-box;margin-bottom:10px">';
      h += '<div id="vit_plist"><div style="text-align:center;padding:30px"><span class="spinner"></span></div></div>';
      m.innerHTML = h;
      var s = document.getElementById('vit_search');
      if (s) s.addEventListener('input', function () { V._drawList(s.value.trim()); });
      V._loadPatients().then(function () { V._drawList(''); }).catch(function (e) {
        var box = document.getElementById('vit_plist');
        if (!box) return;
        box.innerHTML = '<div style="background:#fffbeb;border:1px solid #d97706;border-radius:12px;padding:14px;font-size:13px">' +
          'فهرست بیماران بارگذاری نشد (' + V._esc(e.message || e) + '). شناسهٔ بیمار را دستی وارد کنید:' +
          '<input id="vit_manual" placeholder="pat_001" style="width:100%;margin-top:8px;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:16px;box-sizing:border-box">' +
          '<button type="button" id="vit_manual_go" style="width:100%;margin-top:8px;padding:12px;border-radius:10px;background:#0f172a;color:#fff;border:none;font-weight:800">برو</button></div>';
        var go = document.getElementById('vit_manual_go');
        if (go) go.addEventListener('click', function () {
          var v = (document.getElementById('vit_manual') || {}).value;
          if (v) V.show(null, { patientId: v.trim() });
        });
      });
    };

    V.show = function (p, d) {
      var pid = (d && d.patientId) || (p && p.patientId) || null;
      if (!pid && typeof location !== 'undefined') pid = new URLSearchParams(location.search).get('patientId');
      if (!pid) { V._patientId = null; return V._renderPicker(); }
      return origShow.call(V, null, { patientId: pid });
    };

    NABZ.openVitalsInteractive = function (id) {
      ['closeDrawer', 'closeModal', 'closeSheet', 'closeDetail'].forEach(function (fn) {
        try { if (typeof NABZ[fn] === 'function') NABZ[fn](); } catch (_) {}
      });
      V._tab = 'now';
      return V.show(null, { patientId: id });
    };
  }
  install();
})();
