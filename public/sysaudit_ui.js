
// ═══════════════════════════════════════════════════════════
//  NABZ — System Audit UI
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var A = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _cache: null,

    async show(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) d = await A._api('/api/sysaudit/quick');
        A._cache = d;
        A._render(p, d);
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + A._esc(e.message) + '</div>';
      }
    },

    _render(p, d) {
      var m = document.getElementById('content');

      var h = '';
      h += '<div class="sec-hd"><span>🔬 تشخیص سیستم</span>';
      h += '<span class="rd-mini">' + (d.lastRunAt ? new Date(d.lastRunAt).toLocaleTimeString('fa-IR', {hour:'2-digit',minute:'2-digit'}) : 'اجرا نشده') + '</span></div>';

      if (!d.cached) {
        h += '<div class="card" style="padding:20px;text-align:center">';
        h += '<div style="font-size:40px">🔬</div>';
        h += '<div style="font-weight:900;margin-top:8px">هنوز audit اجرا نشده</div>';
        h += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:4px">اولین بررسی سیستم را اجرا کنید</div>';
        h += '</div>';
      } else {
        var sum = d.summary || { critical: 0, error: 0, warning: 0, total: 0 };
        var stats = d.stats || {};

        // Overall
        var color = sum.critical === 0 && sum.error === 0 ? 'ok' : sum.critical > 0 ? 'dng' : 'warn';
        h += '<div class="card" style="background:linear-gradient(135deg,' +
          (color === 'ok' ? 'rgba(16,185,129,0.1)' : color === 'dng' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)') +
          ',transparent);border-color:var(--' + color + ');margin-bottom:12px">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center">';
        h += '<div>';
        h += '<div style="font-size:11px;color:var(--fg-2);font-weight:800">وضعیت سیستم</div>';
        h += '<div style="font-size:32px;font-weight:900;color:var(--' + color + ');line-height:1">' +
          (color === 'ok' ? '✅' : color === 'dng' ? '🚨' : '⚠️') + '</div>';
        h += '<div style="font-size:11px;color:var(--fg-2);margin-top:4px">' +
          (color === 'ok' ? 'همه چیز سالم' : sum.critical + ' بحرانی، ' + sum.warning + ' هشدار') + '</div>';
        h += '</div>';
        h += '<div style="text-align:left;font-size:11px;line-height:1.7">';
        h += '<div>📁 <b>' + (stats.filesScanned || 0) + '</b> فایل</div>';
        h += '<div>🛣️ <b>' + (stats.routesChecked || 0) + '</b> route</div>';
        h += '<div>🎛️ <b>' + (stats.panelsChecked || 0) + '</b> panel</div>';
        h += '<div>🔐 <b>' + (stats.permsChecked || 0) + '</b> perm</div>';
        h += '</div></div></div>';

        // Stats grid
        h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">';
        h += '<div class="rd-stat ' + (sum.critical > 0 ? 'dng' : 'ok') + '"><div class="v">' + sum.critical + '</div><div class="l">بحرانی</div></div>';
        h += '<div class="rd-stat ' + (sum.error > 0 ? 'dng' : '') + '"><div class="v">' + sum.error + '</div><div class="l">خطا</div></div>';
        h += '<div class="rd-stat ' + (sum.warning > 0 ? 'warn' : '') + '"><div class="v">' + sum.warning + '</div><div class="l">هشدار</div></div>';
        h += '<div class="rd-stat"><div class="v">' + (d.stats && d.stats.fixed ? d.stats.fixed : 0) + '</div><div class="l">رفع شده</div></div>';
        h += '</div>';

        // Critical sample
        if (d.criticalSample && d.criticalSample.length) {
          h += '<div style="font-size:12px;font-weight:900;color:var(--dng);margin:12px 0 6px">🚨 موارد بحرانی (نمونه)</div>';
          d.criticalSample.forEach(function(f) {
            h += '<div style="padding:8px;background:var(--dng-soft);border-radius:6px;margin-bottom:4px;font-size:11.5px;border-right:3px solid var(--dng)">';
            h += '<div style="font-weight:900">' + A._esc(f.category) + '</div>';
            h += '<div style="font-family:monospace;font-size:10px;color:var(--fg-2)">' + A._esc(f.file) + '</div>';
            h += '<div style="margin-top:2px">' + A._esc(f.message) + '</div>';
            h += '</div>';
          });
        }
      }

      // Actions
      h += '<div style="display:flex;flex-direction:column;gap:6px;margin-top:14px">';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;font-weight:900" onclick="NABZ.sysAudit.runAndFix()">🚀 اجرا + رفع خودکار</button>';
      h += '<button class="btn btn-block" style="padding:12px" onclick="NABZ.sysAudit.runFull()">🔍 اجرای کامل (بدون رفع)</button>';
      h += '</div>';

      m.innerHTML = h;
      NABZ.state.current = p ? p.id : 'audit_api.dashboard';
    },

    async runFull() {
      NABZ._toast('در حال اجرا...');
      try {
        var r = await A._api('/api/sysaudit/run');
        A.showFullReport(r);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async runAndFix() {
      if (!confirm('اجرای audit + رفع خودکار باگ‌های ساده؟')) return;
      NABZ._toast('در حال اجرا + رفع...');
      try {
        var r = await A._api('/api/sysaudit/run-and-fix');
        A.showFullReport(r, true);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    showFullReport(r, wasFixed) {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">🔬 گزارش کامل audit</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      // Auto-fix result
      if (wasFixed) {
        if (r.fixedCount && r.fixedCount > 0) {
          h += '<div class="hint success" style="margin-bottom:12px">✅ ' + r.fixedCount + ' مورد خودکار رفع شد</div>';
          if (r.fixes && r.fixes.length) {
            r.fixes.forEach(function(f) {
              h += '<div style="padding:6px;background:var(--ok-soft);border-radius:6px;margin-bottom:3px;font-size:11px">';
              h += '<b>' + A._esc(f.action) + '</b> — ' + A._esc(f.details);
              h += '</div>';
            });
          }
        } else {
          h += '<div class="hint info" style="margin-bottom:12px">ℹ️ هیچ رفع خودکاری انجام نشد (همه مسائل manual)</div>';
        }
      }

      // Summary
      h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">';
      h += '<div style="text-align:center;padding:8px;background:var(--bg-2);border-radius:6px"><div style="font-size:24px;font-weight:900;color:var(--dng)">' + r.summary.critical + '</div><div style="font-size:10px">بحرانی</div></div>';
      h += '<div style="text-align:center;padding:8px;background:var(--bg-2);border-radius:6px"><div style="font-size:24px;font-weight:900;color:var(--warn)">' + r.summary.warning + '</div><div style="font-size:10px">هشدار</div></div>';
      h += '<div style="text-align:center;padding:8px;background:var(--bg-2);border-radius:6px"><div style="font-size:24px;font-weight:900">' + r.summary.total + '</div><div style="font-size:10px">کل</div></div>';
      h += '</div>';

      // Findings by severity
      var crit = r.findings.filter(function(f) { return f.severity === 'critical'; });
      var warn = r.findings.filter(function(f) { return f.severity === 'warning'; });

      if (crit.length) {
        h += '<div style="font-size:12px;font-weight:900;color:var(--dng);margin:12px 0 6px">🚨 بحرانی (' + crit.length + ')</div>';
        crit.slice(0, 30).forEach(function(f) {
          h += '<div style="padding:8px;background:var(--dng-soft);border-radius:6px;margin-bottom:3px;font-size:11px">';
          h += '<div style="font-weight:900">' + A._esc(f.category) + '</div>';
          h += '<div style="font-family:monospace;font-size:9.5px;color:var(--fg-2)">' + A._esc(f.file) + '</div>';
          h += '<div style="margin-top:2px">' + A._esc(f.message) + '</div>';
          h += '</div>';
        });
      }

      if (warn.length) {
        h += '<div style="font-size:12px;font-weight:900;color:var(--warn);margin:12px 0 6px">⚠️ هشدارها (' + warn.length + ')</div>';
        warn.slice(0, 20).forEach(function(f) {
          h += '<div style="padding:6px;background:var(--warn-soft);border-radius:6px;margin-bottom:3px;font-size:10.5px">';
          h += '<b>' + A._esc(f.category) + '</b> — ' + A._esc(f.message);
          h += '</div>';
        });
        if (warn.length > 20) {
          h += '<div style="text-align:center;font-size:10px;color:var(--fg-3);padding:6px">+ ' + (warn.length - 20) + ' دیگر</div>';
        }
      }

      if (r.summary.total === 0) {
        h += '<div class="card" style="text-align:center;padding:30px">';
        h += '<div style="font-size:48px">🎉</div>';
        h += '<div style="font-weight:900;margin-top:8px;color:var(--ok)">هیچ مشکلی پیدا نشد</div>';
        h += '<div style="font-size:11px;color:var(--fg-2);margin-top:4px">' + r.stats.filesScanned + ' فایل، ' + r.stats.routesChecked + ' route بررسی شد</div>';
        h += '</div>';
      }

      h += '<button class="btn btn-block" style="padding:10px;margin-top:14px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';

      // Open in sheet
      var s = document.createElement('div');
      s.className = 'bs-backdrop';
      s.onclick = function(e) { if (e.target === s) s.remove(); };
      var c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '96vh';
      c.innerHTML = h;
      s.appendChild(c);
      document.body.appendChild(s);
      requestAnimationFrame(function() { s.classList.add('show'); });
    }
  };

  // Bootstrap
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 60) return;
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.sysAudit = A;
    if (typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('sysaudit_dashboard', function(p, d) { return A.show(p, d); });
    }
    console.log('[sysaudit-ui] loaded');
  });
})();
