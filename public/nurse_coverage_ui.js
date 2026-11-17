
// ═══════════════════════════════════════════════════════════
//  NABZ — Nurse Coverage UI
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var NC = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },

    async show(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) d = await this._api('/api/nurse-coverage/dashboard');
        this._render(p, d);
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + this._esc(e.message) + '</div>';
      }
    },

    _render: function(p, d) {
      var m = document.getElementById('content');
      var cov = d.coverage;
      var esc = d.escalations;
      var mine = d.myShift;

      var h = '';
      h += '<div class="sec-hd"><span>👩‍⚕️ پوشش پرستاری</span>';
      h += '<span class="rd-mini">' + cov.shiftLabel + ' · ' + cov.date + '</span></div>';

      // My shift banner
      if (mine.isStaff && mine.isAssigned) {
        h += '<div class="card" style="background:linear-gradient(135deg,rgba(16,185,129,.12),rgba(6,182,212,.06));border-color:var(--ok);margin-bottom:12px">';
        h += '<div style="font-weight:900;font-size:13px;color:var(--ok)">✅ شما این شیفت روی وظیفه هستید</div>';
        h += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:4px">';
        if (mine.assignment && mine.assignment.wardLabel) h += 'بخش: <b>' + this._esc(mine.assignment.wardLabel) + '</b>';
        h += ' · وضعیت: ' + (mine.assignment.state === 'checked_in' ? 'حاضر' : mine.assignment.state === 'scheduled' ? 'در انتظار' : mine.assignment.state);
        h += '</div></div>';
      } else if (mine.isStaff) {
        h += '<div class="card" style="background:var(--bg-2);margin-bottom:12px">';
        h += '<div style="font-weight:900;font-size:12.5px;color:var(--fg-2)">💤 شما این شیفت روی وظیفه نیستید</div>';
        h += '</div>';
      }

      // Critical escalations
      if (esc.items.length > 0) {
        var critical = esc.items.filter(function(e) { return e.severity === 'critical'; });
        var warning = esc.items.filter(function(e) { return e.severity === 'warning'; });
        if (critical.length > 0) {
          h += '<div class="card" style="border-color:var(--dng);background:var(--dng-soft);margin-bottom:8px;animation:rd-pulse 2s infinite">';
          h += '<div style="font-weight:900;color:var(--dng);font-size:13px">🚨 ' + critical.length + ' مورد بحرانی</div>';
          critical.forEach(function(e) {
            h += '<div style="font-size:11.5px;margin-top:4px;color:var(--fg)"><b>' + this._esc(e.wardLabel) + '</b> — ' + this._esc(e.message) + '</div>';
          }, this);
          h += '</div>';
        }
        if (warning.length > 0) {
          h += '<div class="card" style="border-color:var(--warn);background:var(--warn-soft);margin-bottom:8px">';
          h += '<div style="font-weight:900;color:var(--warn);font-size:12px">⚠️ ' + warning.length + ' هشدار</div>';
          h += '</div>';
        }
      }

      // Stats
      h += '<div class="rd-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">';
      h += '<div class="rd-stat ok"><div class="v">' + cov.coveredCount + '</div><div class="l">پوشش‌دار</div></div>';
      h += '<div class="rd-stat ' + (cov.uncoveredCount > 0 ? 'dng' : '') + '"><div class="v">' + cov.uncoveredCount + '</div><div class="l">بدون پوشش</div></div>';
      h += '<div class="rd-stat ' + (cov.overloadedCount > 0 ? 'warn' : '') + '"><div class="v">' + cov.overloadedCount + '</div><div class="l">اضافه‌بار</div></div>';
      h += '</div>';

      // Ward list
      h += '<div class="sec-hd" style="margin-top:14px"><span>🏥 بخش‌ها</span></div>';
      if (cov.services.length === 0) {
        h += '<div class="empty">هیچ بخشی با بیمار یا پرستار نیست</div>';
      } else {
        cov.services.forEach(function(s) {
          var cls = s.ratioFlag === 'uncovered' ? 'hi' :
                    s.ratioFlag === 'overloaded' ? 'hi' :
                    s.covered ? 'lo' : 'md';
          var badge = s.ratioFlag === 'uncovered' ? 'dng' :
                      s.ratioFlag === 'overloaded' ? 'warn' :
                      s.covered ? 'ok' : 'info';
          var badgeFa = s.ratioFlag === 'uncovered' ? 'بدون پرستار' :
                        s.ratioFlag === 'overloaded' ? 'اضافه‌بار' :
                        s.covered ? 'پوشش‌دار' : '—';
          h += '<div class="row ' + cls + '" style="margin-bottom:4px">';
          h += '<div class="row-hd">';
          h += '<div class="row-title">' + this._esc(s.wardLabel) + '</div>';
          h += '<span class="pill ' + badge + '">' + badgeFa + '</span>';
          h += '</div>';
          h += '<div class="row-meta">';
          h += s.patients + ' بیمار · ' + s.nurses + ' پرستار';
          if (s.ratio !== null) h += ' · نسبت ' + s.ratio;
          if (s.headNurse) h += ' · ' + this._esc(s.headNurse);
          h += '</div>';
          h += '</div>';
        }, this);
      }

      // Refresh
      h += '<button class="btn btn-block" style="padding:10px;margin-top:14px" onclick="NABZ.nurseCoverageUI.show(null,null)">🔄 بازخوانی</button>';

      m.innerHTML = h;
      NABZ.state.current = p ? p.id : 'nurse_coverage.coverage';
    }
  };

  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 60) return;
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.nurseCoverageUI = NC;
    if (typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('nurse_coverage', function(p, d) { return NC.show(p, d); });
    }
    console.log('[nurse-coverage-ui] loaded');
  });
})();
