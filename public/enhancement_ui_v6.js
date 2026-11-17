
// ═══════════════════════════════════════════════════════════
//  NABZ — Enhancement UI v6
//  Integrates: ASP Dashboard + Doc Excellence hooks + Discharge advanced tools
//  No new clutter. Only contextual buttons + 1 dashboard panel.
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var ENH = {
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
    _fmt: function(iso) {
      if (!iso) return '—';
      try { return new Date(iso).toLocaleString('fa-IR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); }
      catch (_) { return '—'; }
    },
    _openDoc: async function(url, fallbackTitle) {
      try {
        NABZ._toast('در حال تولید سند...');
        var d = await ENH._api(url);
        if (typeof NABZ._showDocViewer === 'function') {
          NABZ._showDocViewer(d.html, d.title || fallbackTitle || 'سند');
        } else {
          alert('Document viewer not available');
        }
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  ASP DASHBOARD
    // ═══════════════════════════════════════════════════
    _asp: { tab: 'overview', days: 7, cache: null },

    async showAspDashboard(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) d = await ENH._api('/api/asp/dashboard?days=' + ENH._asp.days);
        ENH._asp.cache = d;
        ENH._renderAsp();
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + ENH._esc(e.message) + '</div>';
      }
    },

    _renderAsp() {
      var d = ENH._asp.cache;
      if (!d) return;
      var m = document.getElementById('content');
      var metrics = d.metrics || {};
      var tab = ENH._asp.tab || 'overview';

      var h = '';
      // Header
      h += '<div class="sec-hd"><span>🦠 Antimicrobial Stewardship</span>';
      h += '<span class="rd-mini">' + d.window.days + ' روز</span></div>';

      // Period selector
      h += '<div style="display:flex;gap:6px;margin-bottom:12px">';
      h += '<button class="btn btn-sm" style="padding:6px 12px;font-size:11px' + (ENH._asp.days === 7 ? ';background:var(--primary);color:#fff;border-color:var(--primary)' : '') + '" onclick="NABZ.enhUI.setAspDays(7)">۷ روز</button>';
      h += '<button class="btn btn-sm" style="padding:6px 12px;font-size:11px' + (ENH._asp.days === 30 ? ';background:var(--primary);color:#fff;border-color:var(--primary)' : '') + '" onclick="NABZ.enhUI.setAspDays(30)">۳۰ روز</button>';
      h += '</div>';

      // Metrics grid
      h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">';
      h += '<div class="rd-stat info"><div class="v">' + metrics.dotPer1000 + '</div><div class="l">DOT/1000 pt-day</div></div>';
      h += '<div class="rd-stat"><div class="v">' + metrics.totalDOT + '</div><div class="l">کل DOT</div></div>';
      h += '<div class="rd-stat ' + (metrics.pendingApprovals > 0 ? 'warn' : 'ok') + '"><div class="v">' + metrics.pendingApprovals + '</div><div class="l">در انتظار</div></div>';
      h += '<div class="rd-stat ' + (metrics.cDiffCases > 0 ? 'dng' : 'ok') + '"><div class="v">' + metrics.cDiffCases + '</div><div class="l">C.diff</div></div>';
      h += '</div>';

      // Tabs
      h += '<div class="crisis-tabs" style="margin-bottom:12px">';
      var tabs = [
        ['overview', '📊 خلاصه'],
        ['approvals', '✋ تأییدها (' + metrics.pendingApprovals + ')'],
        ['ivpo', '💊 IV→PO'],
        ['longdur', '⏰ طولانی'],
        ['cdiff', '🦠 C.diff']
      ];
      tabs.forEach(function(t) {
        h += '<button class="crisis-tab' + (tab === t[0] ? ' on' : '') + '" onclick="NABZ.enhUI.setAspTab(\'' + t[0] + '\')">' + t[1] + '</button>';
      });
      h += '</div>';

      // Tab content
      if (tab === 'overview') h += ENH._renderAspOverview(d);
      else if (tab === 'approvals') h += ENH._renderAspApprovals(d);
      else if (tab === 'ivpo') h += ENH._renderAspIvpo(d);
      else if (tab === 'longdur') h += ENH._renderAspLongdur(d);
      else if (tab === 'cdiff') h += ENH._renderAspCdiff(d);

      m.innerHTML = h;
      NABZ.state.current = p ? p.id : 'antimicrobial_stewardship.dashboard';
    },

    _renderAspOverview(d) {
      var metrics = d.metrics || {};
      var byClass = d.byClass || {};
      var bySpectrum = d.bySpectrum || {};

      var h = '';
      // By class
      var classes = Object.keys(byClass).sort(function(a, b) { return byClass[b] - byClass[a]; });
      if (classes.length) {
        h += '<div class="card" style="margin-bottom:12px"><div class="card-title">📊 توزیع بر اساس کلاس</div>';
        for (var i = 0; i < Math.min(classes.length, 8); i++) {
          var k = classes[i];
          var total = Object.values(byClass).reduce(function(s, x) { return s + x; }, 0);
          var pct = total > 0 ? Math.round((byClass[k] / total) * 100) : 0;
          h += '<div style="margin-bottom:6px">';
          h += '<div style="display:flex;justify-content:space-between;font-size:11.5px"><span style="font-family:monospace">' + ENH._esc(k) + '</span><b>' + byClass[k] + ' (' + pct + '%)</b></div>';
          h += '<div class="progress" style="height:3px;margin-top:2px"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
          h += '</div>';
        }
        h += '</div>';
      }

      // By spectrum (broad-spectrum %)
      var spec = Object.keys(bySpectrum);
      if (spec.length) {
        var broad = (bySpectrum['broad'] || 0) + (bySpectrum['very_broad'] || 0) + (bySpectrum['last_resort'] || 0);
        var totalSpec = Object.values(bySpectrum).reduce(function(s, x) { return s + x; }, 0);
        var broadPct = totalSpec > 0 ? Math.round((broad / totalSpec) * 100) : 0;
        h += '<div class="card" style="margin-bottom:12px"><div class="card-title">🎯 طیف مصرف</div>';
        h += '<div style="font-size:11.5px;margin-bottom:6px">طیف وسیع/آخرین‌خط: <b style="color:var(--' + (broadPct > 40 ? 'dng' : broadPct > 25 ? 'warn' : 'ok') + ')">' + broadPct + '%</b></div>';
        h += '<div class="progress" style="height:6px"><div class="progress-fill ' + (broadPct > 40 ? 'dng' : broadPct > 25 ? 'warn' : 'ok') + '" style="width:' + broadPct + '%"></div></div>';
        h += '<div style="font-size:10px;color:var(--fg-2);margin-top:6px">CDC target: کمترین broad-spectrum ممکن</div>';
        h += '</div>';
      }

      h += '<button class="btn btn-block" style="padding:10px;margin-top:12px" onclick="NABZ.enhUI.showAspQuickActions()">⚡ اقدامات سریع ASP</button>';
      return h;
    },

    _renderAspApprovals(d) {
      var pending = d.pendingApprovalsList || [];
      if (!pending.length) {
        return '<div class="card" style="text-align:center;padding:30px"><div style="font-size:36px">✅</div><div style="font-weight:900;margin-top:6px">هیچ درخواستی در انتظار نیست</div></div>';
      }
      var h = '';
      for (var i = 0; i < pending.length; i++) {
        var a = pending[i];
        var cls = a.restriction === 'critical' ? 'hi' : 'md';
        h += '<div class="row ' + cls + '" style="margin-bottom:6px;cursor:pointer" onclick="NABZ.enhUI.openApproval(\'' + a.id + '\')">';
        h += '<div class="row-hd"><div class="row-title">' + ENH._esc(a.patientName) + '</div>';
        h += '<span class="pill ' + (a.restriction === 'critical' ? 'dng' : 'warn') + '">' + ENH._esc(a.restriction) + '</span></div>';
        h += '<div class="row-meta" style="font-family:monospace;font-size:11px">' + ENH._esc(a.drug) + '</div>';
        h += '<div class="row-meta" style="font-size:10.5px">' + ENH._fmt(a.requestedAt) + '</div>';
        h += '</div>';
      }
      h += '<button class="btn btn-block" style="padding:10px;margin-top:8px" onclick="NABZ.enhUI.reloadAsp()">🔄 بازخوانی</button>';
      return h;
    },

    _renderAspIvpo(d) {
      // Fetch IV-to-PO candidates separately (not in dashboard cache)
      var m = '<div class="card"><div class="card-title">💊 کاندیدهای تبدیل IV به PO</div>';
      m += '<div id="aspIvpoList" style="margin-top:8px"><div style="text-align:center;padding:20px"><span class="spinner"></span></div></div>';
      m += '<button class="btn btn-block" style="padding:10px;margin-top:8px" onclick="NABZ.enhUI.reloadAspIvpo()">🔄 بازخوانی</button>';
      m += '</div>';
      setTimeout(function() { ENH.reloadAspIvpo(); }, 100);
      return m;
    },

    async reloadAspIvpo() {
      var el = document.getElementById('aspIvpoList');
      if (!el) return;
      try {
        var d = await ENH._api('/api/asp/iv-to-po');
        var items = d.items || [];
        if (!items.length) {
          el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--fg-2);font-size:12px">هیچ کاندیدی نیست</div>';
          return;
        }
        var h = '';
        for (var i = 0; i < items.length; i++) {
          var c = items[i];
          h += '<div class="row lo" style="margin-bottom:6px;cursor:pointer" onclick="NABZ.showItem(\'clinical.patients\',\'' + c.patientId + '\')">';
          h += '<div class="row-hd"><div class="row-title">' + ENH._esc(c.patientName) + '</div>';
          h += '<span class="pill info">' + ENH._esc(c.wardCode || '') + '</span></div>';
          h += '<div class="row-meta" style="font-size:11px">' + c.candidates.map(function(x) { return ENH._esc(x.drug); }).join(' · ') + '</div>';
          h += '<div class="row-meta" style="font-size:10.5px">PO tolerance (24h): ' + c.poMedsLast24h + ' دارو</div>';
          h += '</div>';
        }
        el.innerHTML = h;
      } catch (e) {
        el.innerHTML = '<div class="empty">خطا: ' + ENH._esc(e.message) + '</div>';
      }
    },

    _renderAspLongdur(d) {
      var m = '<div class="card"><div class="card-title">⏰ آنتی‌بیوتیک‌های طولانی (> ۷ روز)</div>';
      m += '<div id="aspLongList" style="margin-top:8px"><div style="text-align:center;padding:20px"><span class="spinner"></span></div></div>';
      m += '<button class="btn btn-block" style="padding:10px;margin-top:8px" onclick="NABZ.enhUI.reloadAspLong()">🔄 بازخوانی</button>';
      m += '</div>';
      setTimeout(function() { ENH.reloadAspLong(); }, 100);
      return m;
    },

    async reloadAspLong() {
      var el = document.getElementById('aspLongList');
      if (!el) return;
      try {
        var d = await ENH._api('/api/asp/long-duration?minDays=7');
        var items = d.items || [];
        if (!items.length) {
          el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--fg-2);font-size:12px">هیچ موردی > ۷ روز نیست</div>';
          return;
        }
        var h = '';
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          var cls = it.days >= 14 ? 'hi' : 'md';
          h += '<div class="row ' + cls + '" style="margin-bottom:6px;cursor:pointer" onclick="NABZ.showItem(\'clinical.patients\',\'' + it.patientId + '\')">';
          h += '<div class="row-hd"><div class="row-title">' + ENH._esc(it.patientName) + '</div>';
          h += '<span class="pill ' + (it.days >= 14 ? 'dng' : 'warn') + '">' + it.days + ' روز</span></div>';
          h += '<div class="row-meta" style="font-family:monospace;font-size:11px">' + ENH._esc(it.drug) + ' (' + ENH._esc(it.drugClass) + ')</div>';
          h += '<div class="row-meta" style="font-size:10.5px">' + ENH._esc(it.wardCode) + ' · شروع: ' + ENH._fmt(it.firstDose) + '</div>';
          h += '</div>';
        }
        el.innerHTML = h;
      } catch (e) {
        el.innerHTML = '<div class="empty">خطا: ' + ENH._esc(e.message) + '</div>';
      }
    },

    _renderAspCdiff(d) {
      var cases = d.cDiffCasesList || [];
      if (!cases.length) {
        return '<div class="card" style="text-align:center;padding:30px"><div style="font-size:36px">✅</div><div style="font-weight:900;margin-top:6px">هیچ مورد C.diff در این دوره نیست</div></div>';
      }
      var h = '';
      for (var i = 0; i < cases.length; i++) {
        var c = cases[i];
        h += '<div class="row hi" style="margin-bottom:6px;cursor:pointer" onclick="NABZ.showItem(\'clinical.patients\',\'' + c.patientId + '\')">';
        h += '<div class="row-hd"><div class="row-title">' + ENH._esc(c.patientName) + '</div>';
        h += '<span class="pill dng">C.diff</span></div>';
        h += '<div class="row-meta" style="font-size:10.5px">' + ENH._esc(c.wardCode) + ' · ' + ENH._fmt(c.reportedAt) + '</div>';
        h += '</div>';
      }
      return h;
    },

    setAspDays(days) {
      ENH._asp.days = days;
      ENH.showAspDashboard(null, null);
    },
    setAspTab(tab) {
      ENH._asp.tab = tab;
      ENH._renderAsp();
    },
    reloadAsp() { ENH.showAspDashboard(null, null); },

    async showAspQuickActions() {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">⚡ اقدامات سریع ASP</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:6px;font-weight:900" onclick="NABZ.enhUI._closeAll();NABZ.enhUI.showAspTab(\'approvals\')">✋ درخواست‌های در انتظار</button>';
      h += '<button class="btn btn-block" style="padding:12px;margin-bottom:6px" onclick="NABZ.enhUI._closeAll();NABZ.enhUI.showAspTab(\'ivpo\')">💊 IV→PO candidates</button>';
      h += '<button class="btn btn-block" style="padding:12px;margin-bottom:6px" onclick="NABZ.enhUI._closeAll();NABZ.enhUI.showAspTab(\'longdur\')">⏰ طولانی‌مدت</button>';
      h += '<button class="btn btn-block" style="padding:12px;margin-bottom:6px" onclick="NABZ.enhUI._closeAll();NABZ.enhUI.showAspTab(\'cdiff\')">🦠 C.diff surveillance</button>';
      h += '<div class="hint info" style="margin-top:12px">برای de-escalation، از پنل بیمار استفاده کنید: کلینیکال → بیمار → بررسی ASP</div>';
      ENH._openSheet(h);
    },

    // ═══════════════════════════════════════════════════
    //  APPROVAL DETAIL MODAL
    // ═══════════════════════════════════════════════════
    async openApproval(id) {
      try {
        var all = await ENH._api('/api/asp/approvals?status=pending');
        var a = (all.items || []).find(function(x) { return x.id === id; });
        if (!a) return alert('درخواست یافت نشد');

        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">🦠 درخواست تأیید ASP</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        h += '<div class="card" style="border-color:var(--' + (a.restriction === 'critical' ? 'dng' : 'warn') + ');margin-bottom:12px">';
        h += '<div style="font-size:11px;font-weight:900;color:var(--fg-2)">Restriction: ' + ENH._esc(a.restriction) + '</div>';
        h += '<div style="font-size:16px;font-weight:900;margin-top:4px;font-family:monospace">' + ENH._esc(a.drug) + '</div>';
        h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + ENH._esc(a.drugClass) + ' · ' + ENH._esc(a.spectrum) + '</div>';
        h += '</div>';

        h += '<div class="card" style="margin-bottom:12px">';
        h += '<div style="font-size:11px"><b>بیمار:</b> ' + ENH._esc(a.patientName) + ' (' + ENH._esc(a.wardCode) + ')</div>';
        h += '<div style="font-size:11px;margin-top:4px"><b>درخواست‌دهنده:</b> ' + ENH._esc(a.requestedByName) + '</div>';
        h += '<div style="font-size:11px;margin-top:4px"><b>زمان:</b> ' + ENH._fmt(a.requestedAt) + '</div>';
        if (a.culturesSent) h += '<div style="font-size:11px;margin-top:4px;color:var(--ok)">✅ کشت ارسال شده</div>';
        if (a.dose) h += '<div style="font-size:11px;margin-top:4px"><b>دوز:</b> ' + ENH._esc(a.dose) + '</div>';
        if (a.duration) h += '<div style="font-size:11px;margin-top:4px"><b>مدت درخواستی:</b> ' + a.duration + ' روز</div>';
        h += '</div>';

        h += '<div class="card" style="margin-bottom:12px">';
        h += '<div style="font-size:11px;font-weight:900;color:var(--primary)">اندیکاسیون</div>';
        h += '<div style="font-size:12px;margin-top:4px;line-height:1.7">' + ENH._esc(a.indication) + '</div>';
        h += '</div>';

        h += '<div class="wf-field"><label>مدت مجاز (ساعت)</label>';
        h += '<input type="number" id="aspHours" value="72" min="12" max="336" style="text-align:center;font-weight:900;font-size:16px"></div>';

        h += '<div class="wf-field"><label>یادداشت</label>';
        h += '<textarea id="aspNote" rows="2" placeholder="اختیاری"></textarea></div>';

        h += '<div style="display:flex;gap:6px;margin-top:12px;margin-bottom:20px">';
        h += '<button class="btn btn-ok" style="flex:1;padding:14px;font-weight:900" onclick="NABZ.enhUI._decideApproval(\'' + id + '\',\'approve\')">✅ تأیید</button>';
        h += '<button class="btn btn-dng" style="flex:1;padding:14px;font-weight:900" onclick="NABZ.enhUI._decideApproval(\'' + id + '\',\'deny\')">❌ رد</button>';
        h += '</div>';

        ENH._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _decideApproval(id, decision) {
      var hours = parseFloat(document.getElementById('aspHours').value) || 72;
      var note = document.getElementById('aspNote').value || '';
      try {
        await ENH._api('/api/asp/approval/' + id + '/decide', {
          method: 'POST',
          body: JSON.stringify({ decision: decision, approvedDurationHours: hours, note: note })
        });
        NABZ._toast(decision === 'approve' ? '✅ تأیید شد (' + hours + 'h)' : '❌ رد شد');
        ENH._closeAll();
        ENH.showAspDashboard(null, null);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  PATIENT DOC BUTTONS (via _docButtonsFor)
    // ═══════════════════════════════════════════════════
    _patientDocButtons(patientId) {
      var h = '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">';
      h += '<div style="font-size:12px;font-weight:900;margin-bottom:6px">📄 اسناد بالینی</div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
      h += '<button class="btn" style="padding:10px 6px;font-size:11px;justify-content:flex-start;text-align:right;display:flex;gap:6px" onclick="NABZ.enhUI.openSBAR(\'' + patientId + '\')"><span>📋</span> SBAR</button>';
      h += '<button class="btn" style="padding:10px 6px;font-size:11px;justify-content:flex-start;text-align:right;display:flex;gap:6px" onclick="NABZ.enhUI.openDischargeSummary(\'' + patientId + '\')"><span>🚪</span> خلاصه ترخیص</button>';
      h += '<button class="btn" style="padding:10px 6px;font-size:11px;justify-content:flex-start;text-align:right;display:flex;gap:6px" onclick="NABZ.enhUI.openAspReview(\'' + patientId + '\')"><span>🦠</span> ASP Review</button>';
      h += '</div></div>';
      return h;
    },

    _encounterDocButtons(encounterId, patientId) {
      var h = '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">';
      h += '<div style="font-size:12px;font-weight:900;margin-bottom:6px">📄 اسناد</div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
      h += '<button class="btn" style="padding:10px 6px;font-size:11px;display:flex;gap:6px" onclick="NABZ.enhUI.openSBARFromEncounter(\'' + encounterId + '\')"><span>📋</span> SBAR</button>';
      h += '<button class="btn" style="padding:10px 6px;font-size:11px;display:flex;gap:6px" onclick="NABZ.enhUI.openDischargeFromEncounter(\'' + encounterId + '\')"><span>🚪</span> خلاصه ترخیص</button>';
      h += '</div></div>';
      return h;
    },

    _incidentDocButtons(incidentId) {
      var h = '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">';
      h += '<button class="btn btn-block" style="padding:12px;font-size:12px;font-weight:900;background:var(--dng-soft);color:var(--dng);border-color:var(--dng)" onclick="NABZ.enhUI.openIncidentReport(\'' + incidentId + '\')">⚠️ گزارش حادثه (JCI)</button>';
      h += '</div>';
      return h;
    },

    // ═══════════════════════════════════════════════════
    //  DOC OPENERS
    // ═══════════════════════════════════════════════════
    openSBAR(patientId) {
      ENH._openDoc('/api/docx/sbar/latest?patientId=' + encodeURIComponent(patientId), 'SBAR');
    },
    openSBARFromEncounter(encounterId) {
      ENH._openDoc('/api/docx/sbar/' + encodeURIComponent(encounterId), 'SBAR');
    },
    openDischargeSummary(patientId) {
      ENH._openDoc('/api/docx/discharge/latest?patientId=' + encodeURIComponent(patientId), 'خلاصه ترخیص');
    },
    openDischargeFromEncounter(encounterId) {
      ENH._openDoc('/api/docx/discharge/' + encodeURIComponent(encounterId), 'خلاصه ترخیص');
    },
    openIncidentReport(incidentId) {
      ENH._openDoc('/api/docx/incident/' + encodeURIComponent(incidentId), 'گزارش حادثه');
    },

    // ═══════════════════════════════════════════════════
    //  ASP REVIEW (per patient)
    // ═══════════════════════════════════════════════════
    async openAspReview(patientId) {
      try {
        var d = await ENH._api('/api/asp/de-escalation/' + encodeURIComponent(patientId));
        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">🦠 ASP Review — ' + ENH._esc(d.patientName) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        // Current antibiotics
        h += '<div class="card" style="margin-bottom:12px"><div class="card-title">💊 آنتی‌بیوتیک‌های فعال</div>';
        if (!d.currentAntibiotics.length) {
          h += '<div style="text-align:center;padding:12px;color:var(--fg-2);font-size:12px">هیچ آنتی‌بیوتیکی در ۷ روز اخیر</div>';
        } else {
          d.currentAntibiotics.forEach(function(ant) {
            h += '<div style="padding:8px;background:var(--bg-2);border-radius:6px;margin-bottom:4px;font-size:12px">';
            h += '<div style="font-weight:900;font-family:monospace">' + ENH._esc(ant.drug) + '</div>';
            h += '<div style="font-size:10.5px;color:var(--fg-2)">' + ENH._esc(ant.class) + ' · ' + ENH._esc(ant.spectrum) + ' · IV-PO eligible: ' + (ant.iv_po_eligible ? '✓' : '✗') + '</div>';
            h += '</div>';
          });
        }
        h += '</div>';

        // Cultures
        if (d.culturesCount > 0) {
          h += '<div class="hint info" style="margin-bottom:12px">🧪 ' + d.culturesCount + ' کشت مثبت موجود</div>';
        }

        // Suggestions
        h += '<div class="card" style="margin-bottom:12px"><div class="card-title">🔽 پیشنهاد De-escalation</div>';
        if (!d.suggestions.length) {
          h += '<div style="text-align:center;padding:12px;color:var(--fg-2);font-size:12px">پیشنهادی نیست</div>';
        } else {
          d.suggestions.forEach(function(s) {
            h += '<div style="padding:8px;background:' + (s.type === 'de_escalate' ? 'var(--ok-soft)' : 'var(--info-soft)') + ';border-radius:6px;margin-bottom:6px;font-size:12px">';
            h += '<div style="font-weight:900">' + (s.type === 'de_escalate' ? '🔽 De-escalation' : '💊 IV→PO') + '</div>';
            h += '<div style="font-size:11px;margin-top:2px"><b>' + ENH._esc(s.from) + '</b> → <b>' + ENH._esc(s.to) + '</b></div>';
            h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">' + ENH._esc(s.reason) + '</div>';
            h += '</div>';
          });
        }
        h += '</div>';

        // Actions
        h += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:20px">';
        h += '<button class="btn" style="padding:10px;font-size:12px" onclick="NABZ.enhUI._closeAll();NABZ.enhUI.recordAspDecision(\'' + patientId + '\',\'' + ENH._esc(d.patientName) + '\')">📝 ثبت تصمیم ASP</button>';
        h += '</div>';

        ENH._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    recordAspDecision(patientId, patientName) {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">📝 ثبت تصمیم ASP</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>دارو</label><input type="text" id="aspDrug" placeholder="meropenem"></div>';
      h += '<div class="wf-field"><label>تصمیم</label><select id="aspDecision">';
      h += '<option value="continue">ادامه</option>';
      h += '<option value="de_escalate">De-escalate</option>';
      h += '<option value="stop">قطع</option>';
      h += '<option value="iv_to_po">IV → PO</option>';
      h += '<option value="escalate">Escalate</option>';
      h += '</select></div>';
      h += '<div class="wf-field"><label>داروی جدید (اگر de-escalate)</label><input type="text" id="aspNewDrug" placeholder="ceftriaxone"></div>';
      h += '<div class="wf-field"><label>دلیل</label><textarea id="aspReason" rows="2"></textarea></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:12px" onclick="NABZ.enhUI._submitAspDecision(\'' + patientId + '\',\'' + patientName.replace(/'/g, "\\'") + '\')">✅ ثبت</button>';
      ENH._openSheet(h);
    },

    async _submitAspDecision(patientId, patientName) {
      var body = {
        patientId: patientId,
        patientName: patientName,
        drug: document.getElementById('aspDrug').value.trim(),
        decision: document.getElementById('aspDecision').value,
        newDrug: document.getElementById('aspNewDrug').value.trim() || null,
        reason: document.getElementById('aspReason').value.trim()
      };
      if (!body.drug) return alert('نام دارو الزامی است');
      try {
        await ENH._api('/api/asp/review', { method: 'POST', body: JSON.stringify(body) });
        NABZ._toast('✅ تصمیم ثبت شد');
        ENH._closeAll();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  DISCHARGE ADVANCED TOOLS
    // ═══════════════════════════════════════════════════
    async openDischargeAdvanced(dischargeId) {
      try {
        // Load completion checklist to see what's missing
        var chk = await ENH._api('/api/wf/discharges/' + dischargeId + '/checklist');
        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">🎯 ترخیص پیشرفته (JCI)</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        // Status banner
        var color = chk.readyToDischarge ? 'ok' : 'warn';
        h += '<div class="card" style="border-color:var(--' + color + ');margin-bottom:12px">';
        h += '<div style="font-weight:900;font-size:13px;color:var(--' + color + ')">' + (chk.readyToDischarge ? '✅ آماده ترخیص' : '⚠️ ' + chk.missing.length + ' مورد الزامی تکمیل نشده') + '</div>';
        if (chk.missing.length) h += '<div style="font-size:11px;color:var(--fg-2);margin-top:4px">' + chk.missingLabels.join(' · ') + '</div>';
        h += '</div>';

        // Checklist
        h += '<div class="card" style="margin-bottom:12px">';
        h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin-bottom:6px">📋 چک‌لیست JCI</div>';
        chk.checks.forEach(function(c) {
          h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:11.5px">';
          h += '<span>' + (c.done ? '✅' : '○') + ' ' + ENH._esc(c.label) + '</span>';
          h += '<span style="color:var(--fg-2);font-size:10px">' + ENH._esc(c.detail) + '</span>';
          h += '</div>';
        });
        h += '</div>';

        // Tools grid
        h += '<div style="font-size:12px;font-weight:900;margin:12px 0 6px;color:var(--primary)">⚡ ابزارها</div>';
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px">';
        h += '<button class="btn" style="padding:12px 6px;font-size:11px;flex-direction:column;display:flex;gap:4px;align-items:center" onclick="NABZ.enhUI._closeAll();NABZ.enhUI.startMedRec(\'' + dischargeId + '\')"><span style="font-size:20px">💊</span>Med Rec</button>';
        h += '<button class="btn" style="padding:12px 6px;font-size:11px;flex-direction:column;display:flex;gap:4px;align-items:center" onclick="NABZ.enhUI._closeAll();NABZ.enhUI.assessReadmission(\'' + dischargeId + '\')"><span style="font-size:20px">📊</span>Readmission</button>';
        h += '<button class="btn" style="padding:12px 6px;font-size:11px;flex-direction:column;display:flex;gap:4px;align-items:center" onclick="NABZ.enhUI._closeAll();NABZ.enhUI.suggestFollowup(\'' + dischargeId + '\')"><span style="font-size:20px">📅</span>Follow-up</button>';
        h += '<button class="btn" style="padding:12px 6px;font-size:11px;flex-direction:column;display:flex;gap:4px;align-items:center" onclick="NABZ.enhUI._closeAll();NABZ.enhUI.teachBack(\'' + dischargeId + '\')"><span style="font-size:20px">🎓</span>Teach-back</button>';
        h += '</div>';

        h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:6px" onclick="NABZ.enhUI._closeAll();NABZ.enhUI.openPcpHandoff(\'' + dischargeId + '\')">📄 سند انتقال به PCP</button>';
        h += '<button class="btn btn-block" style="padding:10px" onclick="NABZ.enhUI._closeAll()">بستن</button>';

        ENH._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    startMedRec(dischargeId) {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">💊 Medication Reconciliation</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="hint info" style="margin-bottom:12px">داروهای خانگی بیمار را وارد کنید — یک دارو در هر خط<br>مثال: <code>Metformin 500mg BID</code></div>';
      h += '<div class="wf-field"><label>داروهای خانگی</label>';
      h += '<textarea id="medrecHome" rows="6" placeholder="Metformin 500mg&#10;Lisinopril 10mg&#10;Atorvastatin 40mg"></textarea></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:12px" onclick="NABZ.enhUI._submitMedRec(\'' + dischargeId + '\')">▶ شروع Reconciliation</button>';
      ENH._openSheet(h);
    },

    async _submitMedRec(dischargeId) {
      var text = document.getElementById('medrecHome').value || '';
      var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
      var homeMeds = lines.map(function(line) {
        var parts = line.split(/\s+/);
        return { drug: parts[0], dose: parts.slice(1).join(' ') || '' };
      });
      try {
        var d = await ENH._api('/api/wf/discharges/' + dischargeId + '/medrec/start', {
          method: 'POST', body: JSON.stringify({ homeMeds: homeMeds })
        });
        ENH._closeAll();
        ENH._showMedRecResult(dischargeId, d);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _showMedRecResult(dischargeId, d) {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">💊 Reconciliation</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      h += '<div class="card" style="margin-bottom:12px">';
      h += '<div style="font-size:12px;margin-bottom:6px"><b>Home:</b> ' + d.homeMeds.length + ' · <b>Hospital:</b> ' + d.hospitalMeds.length + '</div>';
      h += '<div style="font-size:12px;margin-bottom:6px"><b>Matrix:</b> ' + d.reconcile.length + ' دارو</div>';
      h += '</div>';

      // Group by action
      var actions = { continue: [], dose_changed: [], new: [], stopped_in_hospital: [] };
      d.reconcile.forEach(function(r) { if (actions[r.action]) actions[r.action].push(r); });

      var labels = { continue: 'ادامه', dose_changed: 'تغییر دوز', new: 'جدید', stopped_in_hospital: 'قطع در بیمارستان' };
      var colors = { continue: 'ok', dose_changed: 'warn', new: 'info', stopped_in_hospital: 'dng' };

      Object.keys(actions).forEach(function(key) {
        if (!actions[key].length) return;
        h += '<div class="card" style="margin-bottom:8px;border-color:var(--' + colors[key] + ')">';
        h += '<div style="font-size:11px;font-weight:900;color:var(--' + colors[key] + ');margin-bottom:4px">' + labels[key] + ' (' + actions[key].length + ')</div>';
        actions[key].forEach(function(r) {
          h += '<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:11.5px">';
          h += '<b>' + ENH._esc(r.drug) + '</b> — ' + ENH._esc(r.dischargeDose || '—') + ' ' + ENH._esc(r.dischargeFrequency || '');
          if (r.reason) h += '<div style="font-size:10px;color:var(--fg-2);margin-top:2px">' + ENH._esc(r.reason) + '</div>';
          h += '</div>';
        });
        h += '</div>';
      });

      h += '<button class="btn btn-ok btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.enhUI._verifyMedRec(\'' + dischargeId + '\')">✅ تأیید نهایی (داروساز)</button>';
      ENH._openSheet(h);
    },

    async _verifyMedRec(dischargeId) {
      try {
        await ENH._api('/api/wf/discharges/' + dischargeId + '/medrec/verify', { method: 'POST', body: '{}' });
        NABZ._toast('✅ Reconciliation تأیید شد');
        ENH._closeAll();
        ENH.openDischargeAdvanced(dischargeId);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async assessReadmission(dischargeId) {
      try {
        var d = await ENH._api('/api/wf/discharges/' + dischargeId + '/readmission');
        var color = d.risk.level === 'high' ? 'dng' : d.risk.level === 'moderate' ? 'warn' : 'ok';
        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">📊 ریسک Readmission</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="card" style="text-align:center;border-color:var(--' + color + ');margin-bottom:12px">';
        h += '<div style="font-size:48px;font-weight:900;color:var(--' + color + ')">' + d.risk.score + '</div>';
        h += '<div style="font-size:11px;color:var(--fg-2)">سطح: ' + d.risk.level + '</div>';
        h += '</div>';
        if (d.risk.factors.length) {
          h += '<div class="card" style="margin-bottom:12px"><div style="font-size:11px;font-weight:900;margin-bottom:4px">فاکتورها</div>';
          d.risk.factors.forEach(function(f) {
            h += '<div style="font-size:11px;padding:3px 0">• ' + ENH._esc(f.feature) + ' <span style="color:var(--primary)">(+' + f.weight + ')</span></div>';
          });
          h += '</div>';
        }
        if (d.transitionPlan) {
          h += '<div class="card" style="background:var(--primary-soft);margin-bottom:12px">';
          h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin-bottom:4px">برنامه انتقال مراقبت</div>';
          d.transitionPlan.components.forEach(function(c) {
            h += '<div style="font-size:11.5px;padding:3px 0">• ' + ENH._esc(c) + '</div>';
          });
          h += '</div>';
        }
        h += '<button class="btn btn-block" style="padding:10px;margin-bottom:6px" onclick="NABZ.enhUI._closeAll();NABZ.enhUI.openDischargeAdvanced(\'' + dischargeId + '\')">بازگشت</button>';
        ENH._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async suggestFollowup(dischargeId) {
      try {
        var d = await ENH._api('/api/wf/discharges/' + dischargeId + '/followup/suggest');
        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">📅 Follow-up پیشنهادی</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        d.suggestions.forEach(function(s, i) {
          var priority = s.priority === 'high' ? 'dng' : 'info';
          h += '<div class="card" style="margin-bottom:6px;border-color:var(--' + priority + ')">';
          h += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
          h += '<div><div style="font-weight:900;font-size:12.5px">' + ENH._esc(s.service) + '</div>';
          h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">' + ENH._esc(s.reason) + '</div></div>';
          h += '<span class="pill ' + priority + '">' + s.days + ' روز</span>';
          h += '</div>';
          h += '<button class="btn btn-sm" style="margin-top:6px;padding:6px 12px;font-size:11px" onclick="NABZ.enhUI._scheduleFollowup(\'' + dischargeId + '\',\'' + ENH._esc(s.service) + '\',\'' + s.suggestedDate + '\')">📅 برنامه‌ریزی</button>';
          h += '</div>';
        });
        h += '<button class="btn btn-block" style="padding:10px;margin-top:8px" onclick="NABZ.enhUI._closeAll();NABZ.enhUI.openDischargeAdvanced(\'' + dischargeId + '\')">بازگشت</button>';
        ENH._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _scheduleFollowup(dischargeId, service, date) {
      try {
        await ENH._api('/api/wf/discharges/' + dischargeId + '/followup', {
          method: 'POST',
          body: JSON.stringify({ service: service, scheduledDate: date })
        });
        NABZ._toast('✅ برنامه‌ریزی شد');
        ENH._closeAll();
        ENH.openDischargeAdvanced(dischargeId);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async teachBack(dischargeId) {
      try {
        var topics = await ENH._api('/api/wf/teachback/topics');
        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">🎓 Teach-back</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="hint info" style="margin-bottom:12px">موضوعاتی که بیمار درک خود را نشان داد انتخاب کنید:</div>';
        topics.topics.forEach(function(t) {
          h += '<label style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg-2);border-radius:6px;margin-bottom:4px;font-size:12px;cursor:pointer">';
          h += '<input type="checkbox" data-topic="' + t.code + '" style="width:18px;height:18px;accent-color:var(--primary)">';
          h += '<span>' + ENH._esc(t.label) + '</span>';
          h += '</label>';
        });
        h += '<label style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--ok-soft);border-radius:6px;margin-top:12px;font-size:12px;cursor:pointer;border:1px solid var(--ok)">';
        h += '<input type="checkbox" id="tbDemonstrated" style="width:18px;height:18px;accent-color:var(--ok)">';
        h += '<span><b>بیمار درک خود را به‌طور کامل نشان داد</b></span>';
        h += '</label>';
        h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:12px;font-weight:900" onclick="NABZ.enhUI._submitTeachback(\'' + dischargeId + '\')">✅ ثبت</button>';
        ENH._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _submitTeachback(dischargeId) {
      var verified = [];
      document.querySelectorAll('[data-topic]:checked').forEach(function(cb) { verified.push(cb.dataset.topic); });
      if (!verified.length) return alert('حداقل یک موضوع انتخاب کنید');
      var demonstrated = document.getElementById('tbDemonstrated').checked;
      try {
        await ENH._api('/api/wf/discharges/' + dischargeId + '/teachback', {
          method: 'POST',
          body: JSON.stringify({ verifiedTopics: verified, demonstratedCorrectly: demonstrated, verifiedWith: 'patient' })
        });
        NABZ._toast('✅ Teach-back ثبت شد');
        ENH._closeAll();
        ENH.openDischargeAdvanced(dischargeId);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    openPcpHandoff(dischargeId) {
      ENH._openDoc('/api/wf/discharges/' + dischargeId + '/pcp-handoff', 'سند انتقال به PCP');
    }
  };

  // ═══ Bootstrap ═══
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 60) return console.warn('[enh-ui] timeout');
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.enhUI = ENH;

    // ═══ 1) Register ASP dashboard kind ═══
    if (typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('asp_dashboard', function(p, d) { return ENH.showAspDashboard(p, d); });
    }

    // ═══ 2) Wrap _docButtonsFor for contextual doc buttons ═══
    var origDocBtns = NABZ._docButtonsFor;
    if (typeof origDocBtns === 'function') {
      NABZ._docButtonsFor = function(pid, item) {
        var orig = origDocBtns.apply(NABZ, arguments) || '';
        if (item && item.id) {
          if (pid === 'clinical.patients') {
            return orig + ENH._patientDocButtons(item.id);
          }
          if (pid === 'encounters.rounds') {
            return orig + ENH._encounterDocButtons(item.id, item.patientId);
          }
          if (pid === 'safety.incidents') {
            return orig + ENH._incidentDocButtons(item.id);
          }
        }
        return orig;
      };
    }

    // ═══ 3) Wrap WF discharge to inject advanced button ═══
    function wrapDischarge() {
      if (!window.NABZ || !NABZ.wf || typeof NABZ.wf.viewDischarge !== 'function') {
        return setTimeout(wrapDischarge, 200);
      }
      if (NABZ.wf.viewDischarge._enhWrapped) return;

      var orig = NABZ.wf.viewDischarge;
      NABZ.wf.viewDischarge = async function(id) {
        var result = await orig.apply(NABZ.wf, arguments);
        setTimeout(function() {
          var sheets = document.querySelectorAll('.bs-sheet');
          if (!sheets.length) return;
          var sheet = sheets[sheets.length - 1];
          if (sheet.querySelector('.enh-adv-discharge')) return;
          var block = '<div class="enh-adv-discharge" style="margin:12px 0;padding:10px;background:var(--primary-soft);border:1px solid var(--primary);border-radius:8px">';
          block += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin-bottom:6px">🎯 ترخیص پیشرفته (JCI)</div>';
          block += '<button class="btn btn-primary btn-block" style="padding:10px;font-size:12px;font-weight:900" onclick="NABZ.enhUI._closeAll();NABZ.enhUI.openDischargeAdvanced(\'' + id + '\')">باز کردن ابزارهای ترخیص</button>';
          block += '</div>';
          sheet.insertAdjacentHTML('afterbegin', block);
        }, 100);
        return result;
      };
      NABZ.wf.viewDischarge._enhWrapped = true;
      console.log('[enh-ui] wf.viewDischarge wrapped');
    }
    wrapDischarge();

    // ═══ 4) Wrap WF consult to inject reply button ═══
    function wrapConsult() {
      if (!window.NABZ || !NABZ.wf || typeof NABZ.wf.viewConsult !== 'function') {
        return setTimeout(wrapConsult, 200);
      }
      if (NABZ.wf.viewConsult._enhWrapped) return;

      var orig = NABZ.wf.viewConsult;
      NABZ.wf.viewConsult = async function(id) {
        var result = await orig.apply(NABZ.wf, arguments);
        setTimeout(function() {
          var sheets = document.querySelectorAll('.bs-sheet');
          if (!sheets.length) return;
          var sheet = sheets[sheets.length - 1];
          if (sheet.querySelector('.enh-consult-reply')) return;
          var block = '<div class="enh-consult-reply" style="margin:12px 0">';
          block += '<button class="btn btn-block" style="padding:10px;font-size:12px" onclick="NABZ.enhUI._closeAll();NABZ.enhUI._openDoc(\'/api/docx/consult/' + id + '\',\'پاسخ مشاوره\')">📄 چاپ پاسخ مشاوره</button>';
          block += '</div>';
          sheet.insertAdjacentHTML('afterbegin', block);
        }, 100);
        return result;
      };
      NABZ.wf.viewConsult._enhWrapped = true;
      console.log('[enh-ui] wf.viewConsult wrapped');
    }
    wrapConsult();

    console.log('[enh-ui] loaded — ASP dashboard + doc hooks + discharge advanced');
  });
})();
