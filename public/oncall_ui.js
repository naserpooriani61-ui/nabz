
// ═══════════════════════════════════════════════════════════
//  NABZ — On-Call Handoff UI
//  1) Panel dashboard
//  2) Auto-route override in sign-out form
//  3) Home banner for pending handoffs
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var OC = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _closeAll: function() { document.querySelectorAll('.bs-backdrop').forEach(function(el) { el.remove(); }); },
    _openSheet: function(html, opts) {
      opts = opts || {};
      var s = document.createElement('div');
      s.className = 'bs-backdrop';
      s.onclick = function(e) { if (e.target === s && !opts.noClose) s.remove(); };
      var c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '96vh';
      c.innerHTML = html;
      s.appendChild(c);
      document.body.appendChild(s);
      requestAnimationFrame(function() { s.classList.add('show'); });
      return { sheet: s, content: c };
    },
    _fmtAge: function(min) {
      if (min < 1) return 'الان';
      if (min < 60) return min + ' دقیقه';
      return Math.floor(min / 60) + ' ساعت';
    },
    _severityFa: function(s) {
      return { critical:'🚨 بحرانی', guarded:'⚠️ نگران‌کننده', watcher:'👁 تحت نظر', stable:'✅ پایدار' }[s] || s;
    },

    // ═══════════════════════════════════════════════════
    //  DASHBOARD PANEL
    // ═══════════════════════════════════════════════════
    async show(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) d = await this._api('/api/oncall/handoff/dashboard');
        this._render(p, d);
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + this._esc(e.message) + '</div>';
      }
    },

    _render: function(p, d) {
      var m = document.getElementById('content');
      var shiftFa = { morning:'صبح', evening:'عصر', night:'شب' }[d.coverage.shift] || d.coverage.shift;

      var h = '';
      h += '<div class="sec-hd"><span>📋 On-Call Handoffs</span>';
      h += '<span class="rd-mini">' + shiftFa + ' · ' + d.coverage.month + '</span></div>';

      // My status
      if (d.my.isOnCall) {
        h += '<div class="card" style="background:linear-gradient(135deg,rgba(6,182,212,.12),rgba(139,92,246,.06));border-color:var(--primary);margin-bottom:12px">';
        h += '<div style="font-weight:900;font-size:13px;color:var(--primary)">📞 شما در این شیفت on-call هستید</div>';
        h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">';
        d.my.services.forEach(function(s) {
          h += '<span class="pill info" style="font-size:11px">' + this._esc(s.service) + ' (' + (s.role === 'primary' ? 'اصلی' : 'پشتیبان') + ')</span>';
        }, this);
        h += '</div></div>';
      } else {
        h += '<div class="card" style="background:var(--bg-2);margin-bottom:12px">';
        h += '<div style="font-weight:900;font-size:12.5px;color:var(--fg-2)">📞 شما در این شیفت on-call نیستید</div>';
        h += '</div>';
      }

      // Pending for me
      if (d.myPending.total > 0) {
        h += '<div class="card" style="border-color:var(--dng);background:var(--dng-soft);margin-bottom:12px;animation:rd-pulse 2s infinite">';
        h += '<div style="font-weight:900;font-size:14px;color:var(--dng)">🚨 ' + d.myPending.total + ' Handoff در انتظار تأیید</div>';
        h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">شما گیرنده هستید — نیاز به تأیید و synthesis</div>';
        h += '</div>';

        d.myPending.items.forEach(function(so) {
          h += '<div class="card" style="border-right:3px solid var(--warn);margin-bottom:6px;padding:10px">';
          h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
          h += '<div style="flex:1;min-width:0">';
          h += '<div style="font-size:12.5px;font-weight:900">از ' + this._esc(so.fromUserName) + '</div>';
          h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + so.patientCount + ' بیمار · شیفت ' + this._esc(so.untilShift) + '</div>';
          h += '<div style="font-size:10.5px;color:var(--fg-3);margin-top:2px">' + this._fmtAge(so.ageMinutes) + ' پیش' + (so.escalations.length ? ' · ' + so.escalations.join(', ') : '') + '</div>';
          h += '</div>';
          h += '<button class="btn btn-primary btn-sm" style="padding:6px 10px;font-size:11px;font-weight:900" onclick="NABZ.oncallUI.viewSignOut(\'' + so.id + '\')">مشاهده</button>';
          h += '</div></div>';
        }, this);
      }

      // Coverage map
      h += '<div class="sec-hd" style="margin-top:14px"><span>🗺 پوشش On-Call</span>';
      var covCls = d.coverage.uncoveredCount === 0 ? 'ok' : d.coverage.uncoveredCount < 3 ? 'warn' : 'dng';
      h += '<span class="pill ' + covCls + '" style="font-size:10px">' + d.coverage.coveredCount + '/' + d.coverage.total + '</span></div>';

      if (d.coverage.uncoveredCount > 0) {
        h += '<div class="card" style="border-color:var(--warn);background:var(--warn-soft);margin-bottom:8px;padding:8px 10px">';
        h += '<div style="font-size:11.5px;font-weight:900;color:var(--warn)">⚠️ ' + d.coverage.uncoveredCount + ' سرویس بدون on-call</div>';
        h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">' + this._esc(d.coverage.uncoveredServices.join(' · ')) + '</div>';
        h += '</div>';
      }

      // Service list
      d.coverage.services.forEach(function(s) {
        var cls = s.covered ? 'ok' : 'dng';
        h += '<div style="padding:8px 10px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;border-right:3px solid var(--' + cls + ')">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center">';
        h += '<div style="font-weight:900;font-size:12px;font-family:monospace">' + this._esc(s.service) + '</div>';
        h += '<div style="font-size:10px;color:var(--' + cls + ')">' + (s.covered ? '✓' : '✗') + '</div>';
        h += '</div>';
        if (s.primaryName) h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">' + this._esc(s.primaryName) + (s.backupName ? ' · پشتیبان: ' + this._esc(s.backupName) : '') + '</div>';
        else if (s.backupName) h += '<div style="font-size:10.5px;color:var(--fg-2)">فقط پشتیبان: ' + this._esc(s.backupName) + '</div>';
        else h += '<div style="font-size:10.5px;color:var(--dng);font-weight:800">بدون on-call</div>';
        h += '</div>';
      }, this);

      m.innerHTML = h;
      NABZ.state.current = p ? p.id : 'oncall_handoff_bridge.dashboard';
    },

    // ═══════════════════════════════════════════════════
    //  VIEW SIGN-OUT DETAIL
    // ═══════════════════════════════════════════════════
    async viewSignOut(id) {
      try {
        var list = await this._api('/api/team/signouts?type=received');
        var so = (list.items || []).find(function(s) { return s.id === id; });
        if (!so) return alert('یافت نشد');

        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">📋 Sign-out از ' + this._esc(so.fromUserName) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        h += '<div class="card" style="background:var(--bg-2);margin-bottom:12px;padding:10px">';
        h += '<div style="font-size:11.5px;color:var(--fg-2)">تا شیفت: <b>' + this._esc(so.untilShift) + '</b></div>';
        h += '<div style="font-size:11.5px;color:var(--fg-2)">' + (so.patients || []).length + ' بیمار</div>';
        if (so.notes) h += '<div style="font-size:11.5px;margin-top:6px">' + this._esc(so.notes) + '</div>';
        h += '</div>';

        // Patients with I-PASS
        (so.patients || []).forEach(function(pt) {
          var ip = pt.ipass || {};
          h += '<div class="card" style="margin-bottom:8px;border-right:3px solid var(--' + (pt.severity === 'critical' ? 'dng' : pt.severity === 'guarded' ? 'warn' : 'ok') + ')">';
          h += '<div style="font-weight:900;font-size:13px">' + this._esc(pt.patientName) + ' <span class="pill ' + (pt.severity === 'critical' ? 'dng' : pt.severity === 'guarded' ? 'warn' : 'ok') + '" style="font-size:9px">' + this._severityFa(pt.severity) + '</span></div>';
          h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + this._esc(pt.wardCode) + ' · تخت ' + this._esc(pt.bedNumber || '—') + ' · NEWS2 ' + (pt.news2 || 0) + '</div>';
          if (ip.patientSummary) h += '<div style="font-size:11.5px;margin-top:6px"><b>P:</b> ' + this._esc(ip.patientSummary) + '</div>';
          if (ip.actionList && ip.actionList.length) h += '<div style="font-size:11.5px;margin-top:4px"><b>A:</b> ' + this._esc(ip.actionList.join(' · ')) + '</div>';
          if (ip.situationAwareness) h += '<div style="font-size:11.5px;margin-top:4px"><b>S:</b> ' + this._esc(ip.situationAwareness) + '</div>';
          h += '</div>';
        }, this);

        // Acknowledge button
        h += '<div style="margin-top:14px;margin-bottom:20px">';
        h += '<button class="btn btn-ok btn-block" style="padding:14px;font-weight:900;font-size:14px" onclick="NABZ.oncallUI.ackSignOut(\'' + so.id + '\')">✅ دریافت و تأیید (Synthesis)</button>';
        h += '</div>';

        this._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    ackSignOut: function(id) {
      var synthesis = prompt('Synthesis (S در I-PASS) — خلاصه درک خود را بنویسید:\n\nمثال: بیمار X پایدار است، K+ کنترل می‌شود، در صورت تب تماس بگیرید');
      if (!synthesis || synthesis.length < 10) {
        if (synthesis !== null) alert('Synthesis حداقل ۱۰ کاراکتر');
        return;
      }
      this._api('/api/team/signout/' + id + '/acknowledge', {
        method: 'POST',
        body: JSON.stringify({ synthesis: synthesis })
      }).then(function() {
        NABZ._toast('✅ دریافت شد');
        document.querySelectorAll('.bs-backdrop').forEach(function(el) { el.remove(); });
        NABZ.show('oncall_handoff_bridge.dashboard');
      }).catch(function(e) { alert('خطا: ' + e.message); });
    },

    // ═══════════════════════════════════════════════════
    //  HOME BANNER for pending handoffs
    // ═══════════════════════════════════════════════════
    async checkHomeBanner() {
      try {
        var pending = await this._api('/api/oncall/handoff/my-pending');
        if (pending.total === 0) return;
        var content = document.getElementById('content');
        if (!content) return;
        if (document.getElementById('oncallHomeBanner')) return;

        var banner = document.createElement('div');
        banner.id = 'oncallHomeBanner';
        banner.style.cssText = 'background:var(--dng-soft);border:2px solid var(--dng);border-radius:12px;padding:14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:8px;cursor:pointer';
        banner.onclick = function() { NABZ.show('oncall_handoff_bridge.dashboard'); };
        banner.innerHTML =
          '<div>' +
            '<div style="font-weight:900;font-size:14px;color:var(--dng)">🚨 ' + pending.total + ' Handoff در انتظار</div>' +
            '<div style="font-size:11.5px;color:var(--fg-2);margin-top:2px">از همکاران شما — دریافت و تأیید نیاز است</div>' +
          '</div>' +
          '<button class="btn" style="padding:8px 14px;font-size:12px;background:var(--dng);color:#fff;border:none;font-weight:900">مشاهده</button>';
        content.insertBefore(banner, content.firstChild);
      } catch (_) {}
    },

    // ═══════════════════════════════════════════════════
    //  AUTO-ROUTE OVERRIDE for sign-out form
    // ═══════════════════════════════════════════════════
    _patchSignOut: function() {
      var CT = NABZ.careTeamUI;
      if (!CT || CT._ocPatched) return;

      // Override _loadSignOutForm to inject auto-route option
      var origLoad = CT._loadSignOutForm;
      CT._loadSignOutForm = async function(patientId) {
        await origLoad.call(this, patientId);
        var el = document.getElementById('signoutContainer');
        if (!el) return;

        // Hide the manual "toUserId" input initially
        var toInput = document.getElementById('soToUserId');
        if (toInput) {
          var wrap = toInput.parentElement;
          if (wrap) wrap.style.display = 'none';
        }

        // Inject auto-route checkbox at top
        var toggleDiv = document.createElement('div');
        toggleDiv.style.cssText = 'margin:8px 0 14px;padding:10px;background:var(--info-soft);border:1px solid var(--info);border-radius:8px';
        toggleDiv.innerHTML =
          '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer">' +
            '<input type="checkbox" id="soAutoRoute" checked style="width:18px;height:18px;accent-color:var(--primary);margin-top:2px">' +
            '<div>' +
              '<div style="font-weight:900;font-size:12px;color:var(--info)">🎯 مسیریابی خودکار بر اساس سرویس</div>' +
              '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">به on-call هر سرویس ارسال می‌شود — اگر نباشد، به supervisor escalate</div>' +
            '</div>' +
          '</label>';
        el.insertBefore(toggleDiv, el.firstChild);

        // Toggle manual input visibility
        var checkbox = document.getElementById('soAutoRoute');
        if (checkbox && toInput && wrap) {
          checkbox.addEventListener('change', function() {
            wrap.style.display = checkbox.checked ? 'none' : '';
          });
        }
      };

      // Override _submitSignOut
      var origSubmit = CT._submitSignOut;
      CT._submitSignOut = async function(patientId) {
        var autoRoute = document.getElementById('soAutoRoute');
        if (autoRoute && autoRoute.checked) {
          var shift = document.getElementById('soShift').value;
          var notes = document.getElementById('soNotes').value;
          try {
            var r = await this._api('/api/oncall/handoff/smart', {
              method: 'POST',
              body: JSON.stringify({
                patientIds: [patientId],
                untilShift: shift,
                notes: notes
              })
            });
            if (r.totalCreated > 0) {
              var msg = '✅ ' + r.totalCreated + ' sign-out مسیریابی شد';
              if (r.created[0]) msg += '\n→ ' + r.created[0].toUserName;
              if (r.escalations.length > 0) msg += '\n\n⚠️ ' + r.escalations.length + ' escalation (بدون on-call)';
              alert(msg);
              document.querySelectorAll('.bs-backdrop').forEach(function(el) { el.remove(); });
              if (NABZ.state.current) NABZ.show(NABZ.state.current);
            } else {
              alert('هیچ مسیری یافت نشد — بیمار سرویس مشخص ندارد');
            }
          } catch (e) { alert('خطا: ' + e.message); }
          return;
        }
        return origSubmit.call(this, patientId);
      };

      CT._ocPatched = true;
      console.log('[oncall-ui] sign-out form patched');
    }
  };

  // ═══ Bootstrap ═══
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 60) return console.warn('[oncall-ui] timeout');
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.oncallUI = OC;

    if (typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('oncall_dashboard', function(p, d) { return OC.show(p, d); });
    }

    // Wrap showHome to add banner
    var origHome = NABZ.showHome;
    if (typeof origHome === 'function') {
      NABZ.showHome = async function() {
        var r = await origHome.apply(NABZ);
        setTimeout(function() { OC.checkHomeBanner(); }, 400);
        return r;
      };
    }

    // Patch care-team sign-out form
    var patchCount = 0;
    function tryPatch() {
      if (NABZ.careTeamUI && !NABZ.careTeamUI._ocPatched) {
        OC._patchSignOut();
      } else if (patchCount++ < 30) {
        setTimeout(tryPatch, 200);
      }
    }
    tryPatch();

    console.log('[oncall-ui] loaded ✓');
  });
})();
