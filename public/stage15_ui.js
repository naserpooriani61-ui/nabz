
// ═══════════════════════════════════════════════════════════
//  NABZ — Stage 15 UI
//  3 panels: Ward Assign, My Service, On-Call Board
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var S15 = {
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

    // ═══════════════════════════════════════════════════
    //  1. ADMIN WARD ASSIGNMENT
    // ═══════════════════════════════════════════════════
    _wa: { cache: null, filter: '', roleFilter: '', selected: new Set() },

    async showWardAssign(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) d = await S15._api('/api/admin/ops/unresolved-users');
        S15._wa.cache = d;
        S15._renderWardAssign();
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + S15._esc(e.message) + '</div>';
      }
    },

    _renderWardAssign() {
      var d = S15._wa.cache;
      if (!d) return;
      var m = document.getElementById('content');
      var items = d.items || [];
      var filter = S15._wa.filter.toLowerCase();
      var roleFilter = S15._wa.roleFilter;

      var filtered = items.filter(function(it) {
        if (roleFilter && it.role !== roleFilter) return false;
        if (filter && (it.username + ' ' + (it.fullName || '')).toLowerCase().indexOf(filter) < 0) return false;
        return true;
      });

      var h = '';
      h += '<div class="sec-hd"><span>🏷️ مدیریت بخش کاربران</span>';
      h += '<span class="rd-mini">' + d.total + ' بدون بخش</span></div>';

      // Stats
      h += '<div class="rd-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">';
      h += '<div class="rd-stat ' + (d.total > 0 ? 'dng' : 'ok') + '"><div class="v">' + d.total + '</div><div class="l">بدون بخش</div></div>';
      h += '<div class="rd-stat ok"><div class="v">' + d.autoFixable + '</div><div class="l">قابل رفع خودکار</div></div>';
      h += '<div class="rd-stat info"><div class="v">' + Object.keys(d.byRole).length + '</div><div class="l">نقش‌ها</div></div>';
      h += '</div>';

      // Auto-fix all
      if (d.autoFixable > 0) {
        h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:12px;font-weight:900" onclick="NABZ.s15UI.autoFixAll()">🚀 رفع خودکار ' + d.autoFixable + ' کاربر</button>';
      }

      // Search + filter
      h += '<input type="search" placeholder="🔍 جستجو نام کاربری..." value="' + S15._esc(S15._wa.filter) + '" oninput="NABZ.s15UI.setWaFilter(this.value)" style="width:100%;padding:10px;margin-bottom:8px;border:1.5px solid var(--border-2);border-radius:8px;background:var(--bg-2);color:var(--fg);font-family:inherit;font-size:13px">';

      // Role chips
      var roles = Object.keys(d.byRole).sort(function(a, b) { return d.byRole[b] - d.byRole[a]; });
      if (roles.length) {
        h += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px">';
        h += '<button class="btn btn-sm" style="padding:4px 10px;font-size:10.5px' + (!roleFilter ? ';background:var(--primary);color:#fff;border-color:var(--primary)' : '') + '" onclick="NABZ.s15UI.setWaRole(\'\')">همه</button>';
        roles.forEach(function(r) {
          var active = roleFilter === r ? ';background:var(--primary);color:#fff;border-color:var(--primary)' : '';
          h += '<button class="btn btn-sm" style="padding:4px 10px;font-size:10.5px' + active + '" onclick="NABZ.s15UI.setWaRole(\'' + r + '\')">' + r + ' (' + d.byRole[r] + ')</button>';
        });
        h += '</div>';
      }

      // List
      if (!filtered.length) {
        h += '<div class="card" style="text-align:center;padding:30px">';
        h += '<div style="font-size:40px">✅</div>';
        h += '<div style="font-weight:900;margin-top:6px">' + (items.length === 0 ? 'همه کاربران بخش دارند' : 'نتیجه‌ای نیست') + '</div>';
        h += '</div>';
      } else {
        h += '<div style="font-size:10.5px;color:var(--fg-2);margin-bottom:6px">' + filtered.length + ' نتیجه</div>';
        filtered.slice(0, 100).forEach(function(u) {
          h += S15._renderWaRow(u);
        });
        if (filtered.length > 100) {
          h += '<div style="text-align:center;font-size:10.5px;color:var(--fg-3);padding:8px">+ ' + (filtered.length - 100) + ' کاربر دیگر</div>';
        }
      }

      m.innerHTML = h;
      NABZ.state.current = p ? p.id : 'stage15_ops.ward_assign';
    },

    _renderWaRow(u) {
      var cls = u.canAutoFix ? 'md' : 'hi';
      var h = '<div class="row ' + cls + '" style="margin-bottom:4px;padding:10px">';
      h += '<div class="row-hd"><div class="row-title">' + S15._esc(u.fullName || u.username) + '</div>';
      h += '<span class="pill info">' + S15._esc(u.role) + '</span></div>';
      h += '<div class="row-meta" style="font-size:10.5px">@' + S15._esc(u.username) + ' · staffId: ' + S15._esc(u.staffId || '—') + '</div>';
      if (u.suggestedWard) {
        h += '<div class="row-meta" style="font-size:11px;color:var(--ok);font-weight:800">پیشنهاد: ' + S15._esc(u.suggestedWard) + '</div>';
      } else {
        h += '<div class="row-meta" style="font-size:11px;color:var(--dng);font-weight:800">پیشنهادی نیست</div>';
      }
      h += '<div style="display:flex;gap:4px;margin-top:6px">';
      if (u.suggestedWard) {
        h += '<button class="btn btn-ok btn-sm" style="flex:1;padding:6px;font-size:10.5px;font-weight:800" onclick="NABZ.s15UI._assignOne(\'' + u.id + '\',\'' + u.suggestedWard + '\')">✅ ' + S15._esc(u.suggestedWard) + '</button>';
      }
      h += '<button class="btn btn-sm" style="flex:1;padding:6px;font-size:10.5px" onclick="NABZ.s15UI._pickWard(\'' + u.id + '\')">🎯 انتخاب دستی</button>';
      h += '</div></div>';
      return h;
    },

    setWaFilter(v) { S15._wa.filter = v; S15._renderWardAssign(); setTimeout(function() { var el = document.querySelector('input[type=search]'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 20); },
    setWaRole(r) { S15._wa.roleFilter = r; S15._renderWardAssign(); },

    async _assignOne(userId, wardCode) {
      try {
        await S15._api('/api/admin/ops/assign-ward/' + userId, {
          method: 'POST', body: JSON.stringify({ wardCode: wardCode })
        });
        NABZ._toast('✅ بخش اختصاص یافت');
        var d = await S15._api('/api/admin/ops/unresolved-users');
        S15._wa.cache = d;
        S15._renderWardAssign();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _pickWard(userId) {
      try {
        var wards = await S15._api('/api/admin/ops/wards');
        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">🎯 انتخاب بخش</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<input type="search" id="waSearch" placeholder="🔍 جستجو..." oninput="NABZ.s15UI._filterWards(this.value)" style="width:100%;padding:10px;margin-bottom:8px;border:1.5px solid var(--border-2);border-radius:8px;background:var(--bg-2);color:var(--fg);font-family:inherit">';
        h += '<div id="wardList" style="max-height:50vh;overflow-y:auto">';
        wards.items.forEach(function(w) {
          h += '<button class="ward-pick-btn" data-text="' + (w.code + ' ' + w.label).toLowerCase() + '" onclick="NABZ.s15UI._doAssign(\'' + userId + '\',\'' + w.code + '\')" style="width:100%;padding:10px;margin-bottom:4px;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;font-family:inherit;color:var(--fg);text-align:right;cursor:pointer;font-size:12px">';
          h += '<div style="font-weight:800;font-family:monospace">' + S15._esc(w.code) + '</div>';
          h += '<div style="font-size:10.5px;color:var(--fg-2)">' + S15._esc(w.label) + ' · ' + S15._esc(w.service || '—') + '</div>';
          h += '</button>';
        });
        h += '</div>';
        S15._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _filterWards(q) {
      q = q.toLowerCase();
      document.querySelectorAll('.ward-pick-btn').forEach(function(b) {
        b.style.display = b.dataset.text.indexOf(q) >= 0 ? '' : 'none';
      });
    },

    async _doAssign(userId, wardCode) {
      S15._closeAll();
      await S15._assignOne(userId, wardCode);
    },

    async autoFixAll() {
      if (!confirm('رفع خودکار همه کاربران قابل تعیین؟')) return;
      var d = S15._wa.cache;
      if (!d) return;
      var fixable = d.items.filter(function(u) { return u.canAutoFix && u.suggestedWard; });
      if (!fixable.length) return alert('هیچ کاربر قابل رفع نیست');

      NABZ._toast('در حال رفع ' + fixable.length + ' کاربر...');
      var assignments = fixable.map(function(u) { return { userId: u.id, wardCode: u.suggestedWard }; });
      try {
        var r = await S15._api('/api/admin/ops/bulk-assign-ward', {
          method: 'POST', body: JSON.stringify({ assignments: assignments })
        });
        NABZ._toast('✅ ' + r.success + ' موفق، ' + r.failed + ' ناموفق');
        var d2 = await S15._api('/api/admin/ops/unresolved-users');
        S15._wa.cache = d2;
        S15._renderWardAssign();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  2. MY SERVICE PATIENTS
    // ═══════════════════════════════════════════════════
    async showMyService(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) d = await S15._api('/api/clinical/ops/my-service-patients');
        S15._renderMyService(d, p);
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + S15._esc(e.message) + '</div>';
      }
    },

    _renderMyService(d, p) {
      var m = document.getElementById('content');
      var SERVICE_LABELS = {
        pulmo:'ریه', neuro:'اعصاب', emergency:'اورژانس', internal:'داخلی',
        cardio:'قلب', surgery:'جراحی', vascular:'عروق', maxillofacial:'فک و صورت',
        neurosurgery:'جراحی اعصاب', ortho:'ارتوپدی', urology:'اورولوژی',
        transplant:'پیوند', oncology:'آنکولوژی', nephrology:'نفرولوژی',
        vip:'VIP', recovery:'ریکاوری', outpatient:'سرپایی', gastro:'گوارش'
      };

      var h = '';
      h += '<div class="sec-hd"><span>🩺 بیماران سرویس من</span></div>';

      if (d.requiresConfig) {
        h += '<div class="card" style="background:var(--warn-soft);border-color:var(--warn);padding:20px;text-align:center">';
        h += '<div style="font-size:40px">⚠️</div>';
        h += '<div style="font-weight:900;margin-top:8px">شما به سرویسی تخصیص نیافته‌اید</div>';
        h += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:6px">' + S15._esc(d.message || '') + '</div>';
        h += '<div style="font-size:11px;color:var(--fg-3);margin-top:8px">راه‌حل: مدیر سیستم بخش شما را تعیین کند</div>';
        h += '</div>';
        m.innerHTML = h;
        return;
      }

      // Services header
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">';
      d.services.forEach(function(s) {
        h += '<span class="pill info" style="font-size:11px">' + S15._esc(SERVICE_LABELS[s] || s) + '</span>';
      });
      h += '</div>';

      // Stats
      h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">';
      h += '<div class="rd-stat ok"><div class="v">' + d.stats.total + '</div><div class="l">کل بیمار</div></div>';
      h += '<div class="rd-stat dng"><div class="v">' + d.stats.critical + '</div><div class="l">بحرانی</div></div>';
      h += '<div class="rd-stat warn"><div class="v">' + d.stats.high + '</div><div class="l">پرخطر</div></div>';
      h += '<div class="rd-stat info"><div class="v">' + d.stats.wardsCovered + '</div><div class="l">بخش</div></div>';
      h += '</div>';

      if (!d.items.length) {
        h += '<div class="card" style="text-align:center;padding:30px">';
        h += '<div style="font-size:40px">😴</div>';
        h += '<div style="font-weight:900;margin-top:6px">هیچ بیماری در سرویس شما نیست</div>';
        h += '<div style="font-size:11px;color:var(--fg-2);margin-top:4px">وقتی بیماری در بخش‌های سرویس شما بستری شود، اینجا نمایش داده می‌شود</div>';
        h += '</div>';
        m.innerHTML = h;
        return;
      }

      // Group by service
      Object.keys(d.byService).forEach(function(svc) {
        var svcData = d.byService[svc];
        h += '<div style="font-size:12px;font-weight:900;color:var(--primary);margin:14px 0 6px;padding-bottom:6px;border-bottom:2px solid var(--primary)">' +
          S15._esc(SERVICE_LABELS[svc] || svc) + ' (' + svcData.total + (svcData.critical > 0 ? ' · ' + svcData.critical + ' بحرانی' : '') + ')</div>';

        Object.keys(svcData.byWard).forEach(function(ward) {
          var wardPatients = svcData.byWard[ward];
          h += '<div style="font-size:11px;color:var(--fg-2);font-weight:800;margin:8px 0 4px">📍 ' + S15._esc(ward) + '</div>';
          wardPatients.forEach(function(pt) {
            var cls = pt.news2 >= 7 ? 'hi' : pt.news2 >= 5 ? 'md' : 'lo';
            h += '<div class="row ' + cls + '" style="margin-bottom:4px;cursor:pointer" onclick="NABZ.showItem(\'clinical.patients\',\'' + pt.id + '\')">';
            h += '<div class="row-hd"><div class="row-title">' + S15._esc(pt.name) + '</div>';
            if (pt.news2 > 0) h += '<span class="pill ' + (pt.news2 >= 7 ? 'dng' : pt.news2 >= 5 ? 'warn' : 'info') + '">NEWS2 ' + pt.news2 + '</span>';
            h += '</div>';
            h += '<div class="row-meta" style="font-size:11px">' + (pt.age || '—') + ' سال · تخت ' + S15._esc(pt.bedNumber || '—') + '</div>';
            h += '<div class="row-meta" style="font-size:10.5px">' + S15._esc(pt.diagnosis || '') + '</div>';
            h += '</div>';
          });
        });
      });

      m.innerHTML = h;
      NABZ.state.current = p ? p.id : 'stage15_ops.my_service';
    },

    // ═══════════════════════════════════════════════════
    //  3. ON-CALL BOARD
    // ═══════════════════════════════════════════════════
    _oc: { cache: null, month: null },

    async showOnCall(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) d = await S15._api('/api/admin/ops/on-call');
        S15._oc.cache = d;
        S15._oc.month = d.month;
        S15._renderOnCall();
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + S15._esc(e.message) + '</div>';
      }
    },

    _renderOnCall() {
      var d = S15._oc.cache;
      if (!d) return;
      var m = document.getElementById('content');
      var SERVICE_LABELS = {
        pulmo:'ریه', neuro:'اعصاب', emergency:'اورژانس', internal:'داخلی',
        cardio:'قلب', surgery:'جراحی', vascular:'عروق', maxillofacial:'فک و صورت',
        neurosurgery:'جراحی اعصاب', ortho:'ارتوپدی', urology:'اورولوژی',
        transplant:'پیوند', oncology:'آنکولوژی', nephrology:'نفرولوژی',
        vip:'VIP', recovery:'ریکاوری', outpatient:'سرپایی', gastro:'گوارش'
      };
      var SHIFT_FA = { morning:'صبح', evening:'عصر', night:'شب' };

      var h = '';
      h += '<div class="sec-hd"><span>📞 On-Call Board</span>';
      h += '<span class="rd-mini">' + d.month + '</span></div>';

      // Coverage
      var cov = d.coverage;
      var covPct = cov.total > 0 ? Math.round((cov.assigned / cov.total) * 100) : 0;
      var color = covPct >= 90 ? 'ok' : covPct >= 60 ? 'warn' : 'dng';
      h += '<div class="card" style="background:linear-gradient(135deg,rgba(6,182,212,.1),rgba(139,92,246,.05));margin-bottom:12px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center">';
      h += '<div><div style="font-size:11px;color:var(--fg-2)">پوشش On-Call</div>';
      h += '<div style="font-size:36px;font-weight:900;color:var(--' + color + ')">' + covPct + '%</div>';
      h += '<div style="font-size:11px;color:var(--fg-2)">' + cov.assigned + ' از ' + cov.total + '</div></div>';
      h += '<div style="text-align:left">';
      if (cov.unassigned > 0) {
        h += '<button class="btn btn-primary btn-sm" style="padding:8px 12px;font-size:11px;font-weight:900" onclick="NABZ.s15UI.autoFillOnCall()">🚀 خودکار پر کن</button>';
      }
      h += '</div></div></div>';

      // Group by service
      var byService = {};
      d.items.forEach(function(x) {
        if (!byService[x.service]) byService[x.service] = { shifts: {}, assigned: 0, total: 0 };
        byService[x.service].shifts[x.shift] = x;
        byService[x.service].total++;
        if (x.isAssigned) byService[x.service].assigned++;
      });

      Object.keys(byService).sort().forEach(function(svc) {
        var svcData = byService[svc];
        var svcColor = svcData.assigned === svcData.total ? 'ok' : svcData.assigned > 0 ? 'warn' : 'dng';
        h += '<div class="card" style="margin-bottom:8px;border-color:var(--' + svcColor + ')">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
        h += '<div style="font-weight:900;font-size:12.5px">' + S15._esc(SERVICE_LABELS[svc] || svc) + '</div>';
        h += '<span class="pill ' + svcColor + '">' + svcData.assigned + '/' + svcData.total + '</span>';
        h += '</div>';
        ['morning','evening','night'].forEach(function(shift) {
          var o = svcData.shifts[shift];
          if (!o) return;
          h += '<div style="padding:6px;background:var(--bg-2);border-radius:6px;margin-bottom:4px;font-size:11.5px">';
          h += '<div style="display:flex;justify-content:space-between;align-items:center">';
          h += '<span style="color:var(--fg-2);font-weight:800;font-size:10.5px">' + SHIFT_FA[shift] + '</span>';
          h += '<button class="btn btn-sm" style="padding:2px 8px;font-size:10px;color:var(--primary);border-color:var(--primary)" onclick="NABZ.s15UI._editOnCall(\'' + svc + '\',\'' + shift + '\')">✎</button>';
          h += '</div>';
          if (o.primaryName) {
            h += '<div style="font-weight:800;margin-top:2px">' + S15._esc(o.primaryName) + '</div>';
            if (o.backupName) h += '<div style="font-size:10px;color:var(--fg-2)">پشتیبان: ' + S15._esc(o.backupName) + '</div>';
          } else {
            h += '<div style="font-size:10.5px;color:var(--fg-3);font-style:italic;margin-top:2px">تخصیص نیافته</div>';
          }
          h += '</div>';
        });
        h += '</div>';
      });

      m.innerHTML = h;
      NABZ.state.current = p ? p.id : 'stage15_ops.on_call';
    },

    async _editOnCall(service, shift) {
      try {
        var users = await S15._api('/api/admin/users');
        var candidates = (users.items || []).filter(function(u) {
          return u.active !== false && ['attending','specialist','surgeon','physician','resident'].indexOf(u.role) >= 0;
        });
        var current = S15._oc.cache.items.find(function(x) { return x.service === service && x.shift === shift; }) || {};

        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">📞 On-Call: ' + S15._esc(service) + ' — ' + (shift === 'morning' ? 'صبح' : shift === 'evening' ? 'عصر' : 'شب') + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        h += '<div class="wf-field"><label>Primary (اصلی)</label>';
        h += '<select id="ocPrimary" style="font-size:12px">';
        h += '<option value="">— خالی —</option>';
        candidates.forEach(function(u) {
          var sel = u.id === current.primaryUserId ? ' selected' : '';
          h += '<option value="' + u.id + '"' + sel + '>' + S15._esc(u.fullName || u.username) + ' (' + u.role + ')</option>';
        });
        h += '</select></div>';

        h += '<div class="wf-field"><label>Backup (پشتیبان)</label>';
        h += '<select id="ocBackup" style="font-size:12px">';
        h += '<option value="">— خالی —</option>';
        candidates.forEach(function(u) {
          var sel = u.id === current.backupUserId ? ' selected' : '';
          h += '<option value="' + u.id + '"' + sel + '>' + S15._esc(u.fullName || u.username) + ' (' + u.role + ')</option>';
        });
        h += '</select></div>';

        h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.s15UI._saveOnCall(\'' + service + '\',\'' + shift + '\')">✅ ذخیره</button>';
        S15._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _saveOnCall(service, shift) {
      var primary = document.getElementById('ocPrimary').value || null;
      var backup = document.getElementById('ocBackup').value || null;
      if (primary && backup && primary === backup) return alert('Primary و Backup نمی‌توانند یکی باشند');
      try {
        await S15._api('/api/admin/ops/on-call', {
          method: 'POST',
          body: JSON.stringify({ service, month: S15._oc.month, shift, primaryUserId: primary, backupUserId: backup })
        });
        NABZ._toast('✅ ذخیره شد');
        S15._closeAll();
        var d = await S15._api('/api/admin/ops/on-call');
        S15._oc.cache = d;
        S15._renderOnCall();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async autoFillOnCall() {
      if (!confirm('پر کردن خودکار On-Call از کارکنان موجود؟ موارد موجود پر شده دست نخورده باقی می‌مانند.')) return;
      try {
        NABZ._toast('در حال پر کردن...');
        var r = await S15._api('/api/admin/ops/on-call/autofill', {
          method: 'POST', body: JSON.stringify({ month: S15._oc.month })
        });
        NABZ._toast('✅ ' + r.filled + ' پر شد · ' + r.skipped + ' رد شد');
        var d = await S15._api('/api/admin/ops/on-call');
        S15._oc.cache = d;
        S15._renderOnCall();
      } catch (e) { alert('خطا: ' + e.message); }
    }
  };

  // ═══ Bootstrap ═══
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 60) return console.warn('[stage15-ui] timeout');
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.s15UI = S15;

    if (typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('ops_ward_assign', function(p, d) { return S15.showWardAssign(p, d); });
      NABZ.registerKind('ops_my_service', function(p, d) { return S15.showMyService(p, d); });
      NABZ.registerKind('ops_oncall', function(p, d) { return S15.showOnCall(p, d); });
    }

    console.log('[stage15-ui] loaded — ward assign + my service + on-call');
  });
})();
