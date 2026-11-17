(function() {
  'use strict';
  var CH = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _tab: 'worklist',
    _cache: {},
    _open: function(html) {
      var s = document.createElement('div'); s.className = 'bs-backdrop';
      s.onclick = function(e) { if (e.target === s) s.remove(); };
      var c = document.createElement('div'); c.className = 'bs-sheet';
      c.style.maxHeight = '96vh'; c.innerHTML = html;
      s.appendChild(c); document.body.appendChild(s);
      requestAnimationFrame(function() { s.classList.add('show'); });
    },
    _close: function() { document.querySelectorAll('.bs-backdrop').forEach(function(e){e.remove();}); },

    show: async function(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        var results = await Promise.all([
          CH._api('/api/hub/worklist'),
          CH._api('/api/hub/patients')
        ]);
        CH._cache = { worklist: results[0], patients: results[1] };
        CH._render(p);
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + CH._esc(e.message) + '</div>';
      }
    },

    _render: function(p) {
      var wl = CH._cache.worklist || { tasks: [], counts: {} };
      var pts = CH._cache.patients || { items: [] };
      var m = document.getElementById('content');
      var h = '<div class="sec-hd"><span>🩺 کارتابل بالینی</span><span class="rd-mini">' + new Date().toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}) + '</span></div>';
      h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">';
      h += '<div class="rd-stat ' + ((wl.counts.critical||0) > 0 ? 'dng' : 'ok') + '"><div class="v">' + (wl.counts.critical||0) + '</div><div class="l">بحرانی</div></div>';
      h += '<div class="rd-stat ' + ((wl.counts.high||0) > 0 ? 'warn' : '') + '"><div class="v">' + (wl.counts.high||0) + '</div><div class="l">مهم</div></div>';
      h += '<div class="rd-stat"><div class="v">' + (wl.counts.medium||0) + '</div><div class="l">متوسط</div></div>';
      h += '<div class="rd-stat info"><div class="v">' + (pts.items||[]).length + '</div><div class="l">بیمار</div></div>';
      h += '</div>';
      h += '<div class="crisis-tabs" style="margin-bottom:12px">';
      h += '<button class="crisis-tab' + (CH._tab === 'worklist' ? ' on' : '') + '" onclick="NABZ.clinicalHub._setTab(\'worklist\')">کارتابل</button>';
      h += '<button class="crisis-tab' + (CH._tab === 'patients' ? ' on' : '') + '" onclick="NABZ.clinicalHub._setTab(\'patients\')">بیماران</button>';
      h += '</div>';
      h += '<div id="chContent"></div>';
      m.innerHTML = h;
      if (CH._tab === 'worklist') CH._renderWorklist();
      else CH._renderPatients();
      NABZ.state.current = p ? p.id : 'clinical_hub.dashboard';
    },

    _setTab: function(t) { CH._tab = t; CH._render(); },

    _renderWorklist: function() {
      var el = document.getElementById('chContent');
      if (!el) return;
      var wl = CH._cache.worklist || { tasks: [] };
      var tasks = wl.tasks || [];
      if (!tasks.length) {
        el.innerHTML = '<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">✅</div><div style="font-weight:900;margin-top:8px">کارتابل خالی است</div><div style="font-size:11.5px;color:var(--fg-2);margin-top:4px">همه کارهای این شیفت انجام شده</div></div>';
        return;
      }
      var h = '';
      var ICONS = { critical: '🚨', high: '⚠️', medium: '📋', low: '○' };
      tasks.forEach(function(t) {
        var cls = t.priority === 'critical' ? 'dng' : t.priority === 'high' ? 'warn' : 'info';
        h += '<div class="card" style="padding:10px;margin-bottom:4px;border-right:3px solid var(--' + cls + ');cursor:pointer" onclick="NABZ.clinicalHub._openTask(\'' + (t.patientId || '') + '\',\'' + t.type + '\',\'' + (t.resourceId || '') + '\')">';
        h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
        h += '<div style="flex:1;min-width:0">';
        h += '<div style="font-size:12.5px;font-weight:900">' + (ICONS[t.priority] || '') + ' ' + CH._esc(t.title) + '</div>';
        if (t.patientName) h += '<div style="font-size:11px;color:var(--primary);margin-top:2px">' + CH._esc(t.patientName) + '</div>';
        if (t.subtitle) h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">' + CH._esc(t.subtitle) + '</div>';
        h += '</div><span class="pill ' + cls + '" style="font-size:9px">' + t.priority + '</span>';
        h += '</div></div>';
      });
      el.innerHTML = h;
    },

    _renderPatients: function() {
      var el = document.getElementById('chContent');
      if (!el) return;
      var items = (CH._cache.patients || {}).items || [];
      if (!items.length) {
        el.innerHTML = '<div class="empty">بیماری در محدوده شما نیست</div>';
        return;
      }
      var h = '';
      items.forEach(function(p) {
        var lvl = p.riskLevel;
        var cls = lvl === 'hi' ? 'dng' : lvl === 'md' ? 'warn' : 'ok';
        h += '<div class="card" style="padding:10px;margin-bottom:4px;border-right:3px solid var(--' + cls + ');cursor:pointer" onclick="NABZ.clinicalHub.openPatient(\'' + p.id + '\')">';
        h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
        h += '<div style="flex:1;min-width:0">';
        h += '<div style="font-size:13px;font-weight:900">' + CH._esc(p.name) + '</div>';
        h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">' + (p.age || '?') + ' سال / ' + CH._esc(p.ward || '') + ' / تخت ' + CH._esc(p.bed || '') + '</div>';
        if (p.diagnosis) h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">' + CH._esc(p.diagnosis.slice(0, 60)) + '</div>';
        h += '</div>';
        h += '<div style="text-align:left">';
        if (p.news2) h += '<span class="pill ' + (p.news2 >= 7 ? 'dng' : p.news2 >= 5 ? 'warn' : 'info') + '" style="font-size:9px">NEWS ' + p.news2 + '</span> ';
        h += '<span class="pill ' + cls + '" style="font-size:9px">' + (p.riskScore || 0) + '%</span>';
        h += '</div></div></div>';
      });
      el.innerHTML = h;
    },

    _openTask: function(pid, type, rid) {
      if (pid) return CH.openPatient(pid);
      CH._close();
    },

    openPatient: async function(pid) {
      try {
        var d = await CH._api('/api/hub/patient/' + pid);
        var p = d.patient;
        var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🩺 ' + CH._esc(p.name) + '</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        // Patient header
        h += '<div class="card" style="padding:10px;margin-bottom:10px;background:linear-gradient(135deg,rgba(6,182,212,.1),rgba(139,92,246,.05))">';
        h += '<div style="font-size:15px;font-weight:900">' + CH._esc(p.name) + '</div>';
        h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + (p.age || '?') + ' سال / ' + (p.sex === 'female' ? 'زن' : 'مرد') + ' / ' + CH._esc(p.ward || '') + ' / تخت ' + CH._esc(p.bed || '') + '</div>';
        if (p.diagnosis) h += '<div style="font-size:11.5px;margin-top:4px;font-weight:700">' + CH._esc(p.diagnosis) + '</div>';
        if (p.allergies && p.allergies.length) h += '<div style="font-size:11px;color:var(--dng);margin-top:4px;font-weight:800">⚠️ آلرژی: ' + CH._esc(p.allergies.join(' / ')) + '</div>';
        if (p.codeStatus && p.codeStatus !== 'full') h += '<div style="font-size:11px;color:var(--warn);margin-top:2px;font-weight:800">کد: ' + CH._esc(p.codeStatus.toUpperCase()) + '</div>';
        h += '</div>';

        // Risk + vitals row
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">';
        var riskCls = d.risk.level === 'hi' ? 'dng' : d.risk.level === 'md' ? 'warn' : 'ok';
        h += '<div class="card" style="padding:8px;text-align:center;border-color:var(--' + riskCls + ')">';
        h += '<div style="font-size:20px;font-weight:900;color:var(--' + riskCls + ')">' + d.risk.score + '%</div>';
        h += '<div style="font-size:9.5px;color:var(--fg-2)">ریسک</div></div>';
        var vitCls = d.vitals.news2 >= 7 ? 'dng' : d.vitals.news2 >= 5 ? 'warn' : 'ok';
        h += '<div class="card" style="padding:8px;text-align:center;border-color:var(--' + vitCls + ')">';
        h += '<div style="font-size:20px;font-weight:900;color:var(--' + vitCls + ')">' + (d.vitals.news2 || '-') + '</div>';
        h += '<div style="font-size:9.5px;color:var(--fg-2)">NEWS2</div></div>';
        h += '</div>';

        // Last vitals
        if (d.vitals.last) {
          var v = d.vitals.last;
          h += '<div class="card" style="padding:8px;margin-bottom:10px">';
          h += '<div style="font-size:10.5px;color:var(--fg-2);margin-bottom:4px">آخرین ویتال ' + (d.vitals.hoursSinceLast || '?') + ' ساعت پیش</div>';
          h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:10.5px">';
          h += '<div><b>HR:</b> ' + (v.hr || '-') + '</div><div><b>BP:</b> ' + (v.bp_sys||'-') + '/' + (v.bp_dia||'-') + '</div><div><b>RR:</b> ' + (v.rr || '-') + '</div>';
          h += '<div><b>T:</b> ' + (v.temp || '-') + '</div><div><b>SpO₂:</b> ' + (v.spo2 || '-') + '</div><div><b>GCS:</b> ' + (v.gcs || '-') + '</div>';
          h += '</div></div>';
        }

        // MAR due
        if (d.mar.due > 0) {
          h += '<div class="card" style="padding:8px;margin-bottom:10px;border-color:var(--warn)">';
          h += '<div style="font-size:11.5px;font-weight:900;color:var(--warn)">💊 ' + d.mar.due + ' دوز در ۲ ساعت آینده';
          if (d.mar.overdue > 0) h += ' / ' + d.mar.overdue + ' دیرکرد';
          if (d.mar.highAlert > 0) h += ' / ' + d.mar.highAlert + ' پرخطر';
          h += '</div></div>';
        }

        // Orders / Labs / Consults
        h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">';
        h += '<div class="card" style="padding:8px;text-align:center"><div style="font-size:16px;font-weight:900">' + d.orders.total + '</div><div style="font-size:9.5px;color:var(--fg-2)">دستور</div></div>';
        h += '<div class="card" style="padding:8px;text-align:center;' + (d.labs.critical > 0 ? 'border-color:var(--dng)' : '') + '"><div style="font-size:16px;font-weight:900;color:' + (d.labs.critical > 0 ? 'var(--dng)' : 'inherit') + '">' + d.labs.total + '</div><div style="font-size:9.5px;color:var(--fg-2)">آزمایش</div></div>';
        h += '<div class="card" style="padding:8px;text-align:center"><div style="font-size:16px;font-weight:900">' + d.consults.total + '</div><div style="font-size:9.5px;color:var(--fg-2)">مشاوره</div></div>';
        h += '</div>';

        // Special flags
        if (d.isolation) h += '<div class="hint warn" style="margin-bottom:6px">🧼 ایزولاسیون: ' + CH._esc(d.isolation.type) + '</div>';
        if (d.sepsis.active) h += '<div class="hint danger" style="margin-bottom:6px">🦠 سپسیس فعال</div>';
        if (d.carePlan && d.carePlan.active > 0) h += '<div class="hint info" style="margin-bottom:6px">📋 ' + d.carePlan.active + ' تشخیص فعال در NCP</div>';

        // Quick actions
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px;margin-bottom:20px">';
        h += '<button class="btn" style="padding:10px;font-size:11px" onclick="NABZ.clinicalHub._close();NABZ.showItem(\'clinical.patients\',\'' + p.id + '\')">پروندهٔ کامل</button>';
        h += '<button class="btn" style="padding:10px;font-size:11px" onclick="NABZ.clinicalHub._close();NABZ.cw&&NABZ.cw.timeline&&NABZ.cw.timeline(\'' + p.id + '\')">تایم‌لاین</button>';
        h += '<button class="btn" style="padding:10px;font-size:11px" onclick="NABZ.clinicalHub._close();NABZ.show(\'clinical.vitals\')">ثبت ویتال</button>';
        h += '<button class="btn" style="padding:10px;font-size:11px" onclick="NABZ.clinicalHub._close();NABZ.show(\'clinical.mar\')">MAR</button>';
        h += '</div>';

        CH._open(h);
      } catch (e) { alert('خطا: ' + e.message); }
    }
  };

  window.NABZ = window.NABZ || {};
  NABZ.clinicalHub = CH;

  var tries = 0;
  (function tryReg() {
    if (NABZ._dispatchRegistry && typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('clinical_hub', function(p, d) { return CH.show(p, d); });
      console.log('[clinical-hub] registered');
      return;
    }
    if (++tries > 60) { console.warn('[clinical-hub] timeout'); return; }
    setTimeout(tryReg, 100);
  })();
  console.log('[clinical-hub-ui] loaded');
})();
