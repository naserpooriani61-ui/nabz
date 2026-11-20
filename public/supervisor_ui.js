// public/supervisor_ui.js — Supervisor Dashboard (v1)
(function() {
  'use strict';

  if (!document.getElementById('sup-style')) {
    var st = document.createElement('style');
    st.id = 'sup-style';
    st.textContent = '.sup-wrap{direction:rtl;background:var(--kx-bg,#eef2f8);min-height:100vh;padding-bottom:88px;color:var(--kx-text,#0f172a);font-family:Vazirmatn,Tahoma,sans-serif}'
      + '.sup-hd{position:sticky;top:0;z-index:10;background:linear-gradient(135deg,#1e4d8c,#0f172a);color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 4px 20px rgba(15,23,42,.2)}'
      + '.sup-hd-t{font-size:16px;font-weight:900}'
      + '.sup-hd-b{background:rgba(255,255,255,.15);border:none;color:#fff;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer}'
      + '.sup-tabs{display:flex;gap:4px;padding:8px 12px;background:var(--kx-surface,#fff);border-bottom:1px solid var(--kx-border,#e2e8f0);overflow-x:auto;scrollbar-width:none;position:sticky;top:52px;z-index:9}'
      + '.sup-tabs::-webkit-scrollbar{display:none}'
      + '.sup-tab{flex:0 0 auto;padding:8px 14px;border-radius:999px;font-size:12px;font-weight:700;color:var(--kx-text-2,#475569);cursor:pointer;background:var(--kx-surface-2,#f8fafc);border:1px solid transparent;user-select:none;transition:all .2s}'
      + '.sup-tab.active{background:var(--kx-primary,#1e4d8c);color:#fff;box-shadow:0 2px 8px rgba(30,77,140,.3)}'
      + '.sup-tab.disabled{opacity:.5;cursor:not-allowed}'
      + '.sup-body{padding:14px 12px}'
      + '.sup-loading{padding:60px;text-align:center;color:var(--kx-text-3,#94a3b8);font-size:13px}'
      + '.sup-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}'
      + '.sup-kpi{background:var(--kx-surface,#fff);padding:12px 6px;border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,.06);border:1px solid var(--kx-border,#e2e8f0);text-align:center}'
      + '.sup-kpi-v{font-size:22px;font-weight:900;margin-bottom:2px}'
      + '.sup-kpi-l{font-size:10px;color:var(--kx-text-2,#475569);font-weight:700}'
      + '.sup-kpi.dng .sup-kpi-v{color:#dc2626}.sup-kpi.suc .sup-kpi-v{color:#059669}.sup-kpi.wrn .sup-kpi-v{color:#d97706}'
      + '.sup-sec{background:var(--kx-surface,#fff);border-radius:14px;border:1px solid var(--kx-border,#e2e8f0);box-shadow:0 1px 3px rgba(15,23,42,.06);overflow:hidden;margin-bottom:12px}'
      + '.sup-sec-h{padding:12px 14px;font-size:13px;font-weight:800;background:var(--kx-surface-2,#f8fafc);border-bottom:1px solid var(--kx-border,#e2e8f0);display:flex;justify-content:space-between;align-items:center}'
      + '.sup-alert{padding:10px 14px;border-bottom:1px solid var(--kx-border,#e2e8f0);display:flex;gap:10px;align-items:flex-start}'
      + '.sup-alert.critical{background:#fef2f2;border-right:4px solid #dc2626}'
      + '.sup-alert.high{background:#fffbeb;border-right:4px solid #f59e0b}'
      + '.sup-alert.medium{background:#f0f9ff;border-right:4px solid #0284c7}'
      + '.sup-alert-i{font-size:18px;flex-shrink:0}'
      + '.sup-alert-b{flex:1;min-width:0}'
      + '.sup-alert-t{font-weight:800;font-size:12px}'
      + '.sup-alert-d{font-size:11px;color:#64748b;margin-top:2px}'
      + '.sup-ward-row{display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid var(--kx-border,#e2e8f0);gap:10px;font-size:12px}'
      + '.sup-ward-code{font-weight:800;min-width:80px}'
      + '.sup-ward-stats{flex:1;display:flex;gap:8px;font-size:11px;color:var(--kx-text-2,#475569)}'
      + '.sup-ward-stats .occ{color:#dc2626;font-weight:700}'
      + '.sup-ward-stats .emp{color:#059669;font-weight:700}'
      + '.sup-btn{padding:6px 12px;border-radius:8px;font-size:11px;font-weight:700;border:none;cursor:pointer;background:#dbeafe;color:#1e4d8c;transition:all .15s}'
      + '.sup-btn.primary{background:#1e4d8c;color:#fff}'
      + '.sup-btn.success{background:#059669;color:#fff}'
      + '.sup-btn.dng{background:#dc2626;color:#fff}'
      + '.sup-progress{height:8px;background:#eef2f7;border-radius:4px;overflow:hidden;margin:6px 0}'
      + '.sup-progress-in{height:100%;background:linear-gradient(90deg,#059669,#10b981);transition:width .4s;border-radius:4px}'
      + '.sup-coverage-head{padding:14px;background:var(--kx-surface,#fff);border-radius:14px;margin-bottom:12px;border:1px solid var(--kx-border,#e2e8f0)}'
      + '.sup-coverage-pct{font-size:28px;font-weight:900;color:#059669}'
      + '.sup-coverage-lbl{font-size:11px;color:var(--kx-text-2,#475569);font-weight:700}'
      + '.sup-ward-card{background:var(--kx-surface,#fff);border-radius:12px;border:1px solid var(--kx-border,#e2e8f0);margin-bottom:8px;overflow:hidden;transition:all .15s}'
      + '.sup-ward-card.done{border-color:#10b981;background:#f0fdf4}'
      + '.sup-ward-card.pending{border-color:#f59e0b}'
      + '.sup-ward-card.critical{border-color:#dc2626;background:#fef2f2}'
      + '.sup-ward-card-inner{padding:12px 14px;display:flex;align-items:center;gap:10px;cursor:pointer}'
      + '.sup-wc-ico{font-size:22px}'
      + '.sup-wc-b{flex:1;min-width:0}'
      + '.sup-wc-t{font-weight:800;font-size:13px;color:var(--kx-text,#0f172a)}'
      + '.sup-wc-s{font-size:10px;color:var(--kx-text-2,#475569);margin-top:2px}'
      + '.sup-check-sec{background:var(--kx-surface,#fff);border-radius:12px;border:1px solid var(--kx-border,#e2e8f0);margin-bottom:10px;overflow:hidden}'
      + '.sup-check-h{padding:10px 14px;background:var(--kx-surface-2,#f8fafc);font-weight:800;font-size:12px;border-bottom:1px solid var(--kx-border,#e2e8f0);display:flex;justify-content:space-between;align-items:center}'
      + '.sup-check-b{padding:10px 14px}'
      + '.sup-check-btns{display:flex;gap:6px;margin-bottom:8px}'
      + '.sup-check-btns button{flex:1;padding:8px 4px;border-radius:8px;border:1px solid var(--kx-border,#e2e8f0);background:#fff;cursor:pointer;font-size:11px;font-weight:700;transition:all .15s}'
      + '.sup-check-btns button.on.ok{background:#d1fae5;color:#065f46;border-color:#6ee7b7}'
      + '.sup-check-btns button.on.warn{background:#fef3c7;color:#92400e;border-color:#fcd34d}'
      + '.sup-check-btns button.on.crit{background:#fee2e2;color:#991b1b;border-color:#fca5a5}'
      + '.sup-check-btns button.on.na{background:#f1f5f9;color:#64748b;border-color:#cbd5e1}'
      + '.sup-check-notes{width:100%;padding:6px 10px;border:1px solid var(--kx-border,#e2e8f0);border-radius:6px;font-size:11px;font-family:inherit;direction:rtl;background:#fff;color:#0f172a;min-height:36px}'
      + '.sup-finding{padding:8px 12px;border-radius:8px;margin-bottom:6px;font-size:11px;display:flex;justify-content:space-between;align-items:flex-start;gap:8px}'
      + '.sup-finding.critical{background:#fef2f2;border:1px solid #fca5a5}'
      + '.sup-finding.warning{background:#fffbeb;border:1px solid #fcd34d}'
      + '.sup-finding.info{background:#f0f9ff;border:1px solid #bae6fd}'
      + '.sup-finding-b{flex:1}.sup-finding-cat{font-weight:800;font-size:10px;opacity:.7;margin-bottom:2px}'
      + '.sup-finding-text{font-weight:600}'
      + '.sup-textarea{width:100%;padding:8px 10px;border:1px solid var(--kx-border,#e2e8f0);border-radius:8px;font-size:12px;font-family:inherit;direction:rtl;background:#fff;color:#0f172a;resize:vertical;min-height:60px}'
      + '.sup-actions{display:flex;gap:8px;margin-top:14px}'
      + '.sup-actions .sup-btn{flex:1;padding:12px;font-size:12px}'
      + '.sup-metrics-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:12px}'
      + '.sup-metric-card{background:#f8fafc;padding:10px;border-radius:10px;border:1px solid #e2e8f0;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:70px}'
      + '.sup-metric-card.manual{background:#fef9e7;border-color:#fcd34d}'
      + '.sup-metric-i{font-size:16px;margin-bottom:2px}'
      + '.sup-metric-v{font-size:20px;font-weight:900;color:#1e4d8c;margin-bottom:2px}'
      + '.sup-metric-l{font-size:10px;color:#475569;font-weight:700}'
      + '.sup-metric-input{display:flex;align-items:center;gap:2px;margin-bottom:4px}'
      + '.sup-metric-input button{width:26px;height:26px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;font-weight:900;font-size:14px;cursor:pointer;color:#1e4d8c}'
      + '.sup-metric-input button:active{background:#dbeafe}'
      + '.sup-metric-input input{width:38px;text-align:center;border:1px solid #cbd5e1;border-radius:6px;padding:2px 0;font-size:14px;font-weight:900;direction:ltr}'
      + 'details.sup-sec>summary::-webkit-details-marker{display:none}'
      + 'details.sup-sec[open]>summary{background:#f1f5f9}';
    document.head.appendChild(st);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function fa(n) { return String(n == null ? '' : n).replace(/\d/g, function(d) { return '۰۱۲۳۴۵۶۷۸۹'.charAt(Number(d)); }); }
  function toast(m) { if (window.NABZ && NABZ._toast) return NABZ._toast(m); alert(m); }
  function api(url, opts) {
    if (window.NABZ && typeof NABZ._api === 'function') return NABZ._api(url, opts);
    return fetch(url, Object.assign({ credentials: 'include', headers: { 'Content-Type': 'application/json' } }, opts || {}))
      .then(function(r) { return r.json().then(function(j) { if (!r.ok) throw new Error((j && (j.message || j.error)) || r.status); return j; }); });
  }
  function post(url, body) { return api(url, { method: 'POST', body: JSON.stringify(body || {}) }); }
  function mount(html) {
    var el = document.getElementById('content') || document.querySelector('main');
    if (el) el.innerHTML = html;
  }

  var state = { tab: 'overview', data: null, coverage: null, activeRound: null, shiftType: 'morning' };

  async function show() {
    mount('<div class="sup-wrap"><div class="sup-loading">در حال بارگذاری داشبورد سوپروایزر...</div></div>');
    try {
      state.data = await api('/api/supervisor/board');
      state.activeRound = null;
      renderApp();
    } catch (e) {
      mount('<div class="sup-wrap" style="padding:40px;text-align:center;color:#dc2626">خطا: ' + esc(e.message || e) + '</div>');
    }
  }

  function renderApp() {
    var h = '<div class="sup-wrap">';
    h += '<div class="sup-hd"><div class="sup-hd-t">🏛️ داشبورد سوپروایزر</div>';
    h += '<button class="sup-hd-b" onclick="NABZ._supRefresh()">⟳</button></div>';
    h += '<div class="sup-tabs">';
    [['overview','📊 نمای کلی'],['wards','🏥 بخش‌ها'],['round','🏛️ راند'],
     ['_soon_or','🏨 اتاق عمل'],['_soon_staff','👥 پرسنل'],['_soon_safety','🛡 ایمنی'],
     ['_soon_inc','⚠️ حوادث'],['_soon_handover','📝 گزارش شیفت'],['_soon_analytics','📈 تحلیل']].forEach(function(t) {
      var soon = t[0].indexOf('_soon_') === 0;
      var cls = 'sup-tab' + (state.tab === t[0] ? ' active' : '') + (soon ? ' disabled' : '');
      h += '<div class="' + cls + '" onclick="NABZ._supTab(\'' + t[0] + '\')">' + t[1] + (soon ? ' 🔒' : '') + '</div>';
    });
    h += '</div><div class="sup-body" id="sup-body"></div></div>';
    mount(h);
    renderTab();
  }

  function renderTab() {
    var el = document.getElementById('sup-body');
    if (!el) return;
    if (state.tab === 'overview') renderOverview(el);
    else if (state.tab === 'wards') renderWards(el);
    else if (state.tab === 'round') renderRound(el);
  }

  function renderOverview(el) {
    var ov = (state.data && state.data.overview) || {};
    var k = ov.kpis || {};
    var alerts = ov.alerts || [];
    var h = '<div class="sup-kpi-grid">';
    h += '<div class="sup-kpi"><div class="sup-kpi-v">' + fa(k.patientsTotal || 0) + '</div><div class="sup-kpi-l">بیمار</div></div>';
    h += '<div class="sup-kpi suc"><div class="sup-kpi-v">' + fa(k.bedsEmpty || 0) + '</div><div class="sup-kpi-l">تخت خالی</div></div>';
    h += '<div class="sup-kpi ' + (k.edCodes > 0 ? 'dng' : 'suc') + '"><div class="sup-kpi-v">' + fa(k.edCodes || 0) + '</div><div class="sup-kpi-l">کد فعال</div></div>';
    h += '<div class="sup-kpi ' + (k.severeIncidents24h > 0 ? 'dng' : 'suc') + '"><div class="sup-kpi-v">' + fa(k.severeIncidents24h || 0) + '</div><div class="sup-kpi-l">حادثه جدی</div></div>';
    h += '<div class="sup-kpi wrn"><div class="sup-kpi-v">' + fa(k.ventOn || 0) + '</div><div class="sup-kpi-l">ونت</div></div>';
    h += '<div class="sup-kpi wrn"><div class="sup-kpi-v">' + fa(k.isolation || 0) + '</div><div class="sup-kpi-l">ایزوله</div></div>';
    h += '<div class="sup-kpi"><div class="sup-kpi-v">' + fa(k.icuOccupied || 0) + '/' + fa(k.icuTotal || 0) + '</div><div class="sup-kpi-l">ICU</div></div>';
    h += '<div class="sup-kpi"><div class="sup-kpi-v">' + fa(k.occupancyPct || 0) + '%</div><div class="sup-kpi-l">اشغال</div></div>';
    h += '</div>';
    h += '<div class="sup-sec"><div class="sup-sec-h"><span>🚨 هشدارها</span><span style="font-size:11px;color:#64748b">' + fa(alerts.length) + '</span></div>';
    if (!alerts.length) {
      h += '<div style="padding:30px;text-align:center;color:#64748b;font-size:12px">✅ هیچ هشدار فعالی نیست</div>';
    } else {
      alerts.forEach(function(a) {
        h += '<div class="sup-alert ' + (a.severity || 'medium') + '"><div class="sup-alert-i">' + (a.icon || '⚠️') + '</div>';
        h += '<div class="sup-alert-b"><div class="sup-alert-t">' + esc(a.title) + '</div>';
        if (a.detail) h += '<div class="sup-alert-d">' + esc(a.detail) + '</div>';
        h += '</div></div>';
      });
    }
    h += '</div>';
    el.innerHTML = h;
  }

  function renderWards(el) {
    var wards = (state.data && state.data.wards && state.data.wards.wards) || [];
    var h = '<div class="sup-sec"><div class="sup-sec-h"><span>🏥 همه بخش‌ها</span><span style="font-size:11px;color:#64748b">' + fa(wards.length) + '</span></div>';
    if (!wards.length) { h += '<div style="padding:30px;text-align:center;color:#64748b">داده‌ای نیست</div>'; }
    else {
      wards.forEach(function(w) {
        h += '<div class="sup-ward-row"><div class="sup-ward-code">' + esc(w.label || w.code) + '</div>';
        h += '<div class="sup-ward-stats"><span>کل: ' + fa(w.total) + '</span>';
        h += '<span class="occ">اشغال: ' + fa(w.occupied) + '</span>';
        h += '<span class="emp">خالی: ' + fa(w.empty) + '</span>';
        if (w.vent > 0) h += '<span>ونت: ' + fa(w.vent) + '</span>';
        if (w.isolation > 0) h += '<span>🔒: ' + fa(w.isolation) + '</span>';
        h += '</div></div>';
      });
    }
    h += '</div>';
    el.innerHTML = h;
  }

  async function renderRound(el) {
    if (state.activeRound) { renderRoundForm(el); return; }
    el.innerHTML = '<div class="sup-loading">در حال بارگذاری...</div>';
    try {
      state.coverage = await api('/api/supervisor/round/coverage?shiftType=' + state.shiftType);
      renderCoverage(el);
    } catch (e) {
      el.innerHTML = '<div style="padding:30px;text-align:center;color:#dc2626">خطا: ' + esc(e.message) + '</div>';
    }
  }

  function renderCoverage(el) {
    var cov = state.coverage || {};
    var wards = cov.coverage || [];
    var prog = cov.progress || { done: 0, total: 0, pct: 0 };
    var h = '<div class="sup-coverage-head">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center"><div>';
    h += '<div class="sup-coverage-lbl">پیشرفت راند</div>';
    h += '<div class="sup-coverage-pct">' + fa(prog.pct) + '%</div></div>';
    h += '<div style="font-size:13px;font-weight:700;color:#475569">' + fa(prog.done) + ' از ' + fa(prog.total) + '</div></div>';
    h += '<div class="sup-progress"><div class="sup-progress-in" style="width:' + prog.pct + '%"></div></div></div>';

    var pending = wards.filter(function(w) { return !w.rounded; });
    var done = wards.filter(function(w) { return w.rounded; });

    if (pending.length) {
      h += '<div style="font-size:12px;font-weight:800;color:#475569;margin:12px 4px 8px">⏳ منتظر راند (' + fa(pending.length) + ')</div>';
      pending.forEach(function(w) {
        h += '<div class="sup-ward-card pending"><div class="sup-ward-card-inner" onclick="NABZ._supStartRound(\'' + w.wardCode + '\',\'' + esc(w.wardLabel) + '\')">';
        h += '<div class="sup-wc-ico">🏥</div><div class="sup-wc-b"><div class="sup-wc-t">' + esc(w.wardLabel) + '</div>';
        h += '<div class="sup-wc-s">' + fa(w.bedsTotal) + ' تخت</div></div>';
        h += '<button class="sup-btn primary">شروع</button></div></div>';
      });
    }
    if (done.length) {
      h += '<div style="font-size:12px;font-weight:800;color:#059669;margin:14px 4px 8px">✅ راند شده (' + fa(done.length) + ')</div>';
      done.forEach(function(w) {
        var r = w.round || {};
        var cls = r.critical > 0 ? 'critical' : 'done';
        h += '<div class="sup-ward-card ' + cls + '"><div class="sup-ward-card-inner">';
        h += '<div class="sup-wc-ico">' + (r.critical > 0 ? '🔴' : '✅') + '</div>';
        h += '<div class="sup-wc-b"><div class="sup-wc-t">' + esc(w.wardLabel) + '</div>';
        h += '<div class="sup-wc-s">' + fa(r.findings || 0) + ' یافته' + (r.critical > 0 ? ' — ' + fa(r.critical) + ' بحرانی' : '') + '</div></div>';
        h += '<button class="sup-btn" onclick="NABZ._supViewRound(\'' + (r.roundId || '') + '\')">مشاهده</button>';
        h += '</div></div>';
      });
    }
    el.innerHTML = h;
  }

  async function startRound(wardCode, wardLabel) {
    try {
      var today = await api('/api/supervisor/round/today');
      var existing = (today.items || []).find(function(r) { return r.wardCode === wardCode && r.shiftType === state.shiftType; });
      if (existing) { state.activeRound = existing; renderApp(); return; }
      var created = await post('/api/supervisor/round', { wardCode: wardCode, wardLabel: wardLabel || wardCode, shiftType: state.shiftType });
      state.activeRound = created;
      renderApp();
    } catch (e) { toast('❌ ' + (e.message || e)); }
  }

  async function viewRound(roundId) {
    try {
      var today = await api('/api/supervisor/round/today');
      var r = (today.items || []).find(function(x) { return x.id === roundId; });
      if (!r) { toast('راند یافت نشد'); return; }
      state.activeRound = r;
      renderApp();
    } catch (e) { toast('❌ ' + e.message); }
  }

  function renderRoundForm(el) {
    var r = state.activeRound;
    if (!r) { renderCoverage(el); return; }
    var isDraft = r.status === 'draft';
    var m = r.metrics || {};
    var sf = r.staffing || {};
    var h = '';

    // header
    h += '<div class="sup-sec" style="background:linear-gradient(135deg,#1e4d8c,#0f172a);color:#fff;border:none"><div style="padding:14px">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center"><div>';
    h += '<div style="font-size:11px;opacity:.8">راند بخش · ' + (r.shiftType === 'morning' ? 'صبح' : r.shiftType === 'evening' ? 'عصر' : 'شب') + '</div>';
    h += '<div style="font-size:17px;font-weight:900">' + esc(r.wardLabel || r.wardCode) + '</div></div>';
    h += '<button class="sup-btn" onclick="NABZ._supBackToCoverage()" style="background:rgba(255,255,255,.2);color:#fff">→ بازگشت</button>';
    h += '</div><div style="font-size:11px;opacity:.8;margin-top:8px">' + (isDraft ? '✏️ پیش‌نویس' : r.status === 'submitted' ? '📤 ثبت شده' : '✅ امضا شده') + ' · ' + fa(r.date) + '</div></div></div>';

    // ─── Section 1: Auto Metrics ───
    h += '<div class="sup-sec"><div class="sup-sec-h"><span>🟢 آمار خودکار (از سیستم)</span>';
    if (isDraft) h += '<button class="sup-btn" style="padding:3px 8px;font-size:10px" onclick="NABZ._supRefreshAuto(\'' + r.id + '\')">⟳ بروزرسانی</button>';
    h += '</div><div class="sup-metrics-grid">';
    var autos = [
      ['patientsTotal', 'بیمار کل', '👥'],
      ['bedsOccupied', 'اشغال', '🛏'],
      ['bedsEmpty', 'خالی', '✅'],
      ['ventilated', 'ونت', '🫁'],
      ['isolated', 'ایزوله', '🔒'],
      ['highRisk', 'پرخطر', '⚠️'],
      ['icuWaiting', 'منتظر ICU', '🏥']
    ];
    autos.forEach(function(a) {
      var k = a[0], lbl = a[1], ico = a[2];
      h += '<div class="sup-metric-card"><div class="sup-metric-i">' + ico + '</div><div class="sup-metric-v">' + fa(m[k] || 0) + '</div><div class="sup-metric-l">' + lbl + '</div></div>';
    });
    h += '</div></div>';

    // ─── Section 2: Manual Metrics ───
    h += '<div class="sup-sec"><div class="sup-sec-h"><span>✍️ آمار دستی</span><span style="font-size:11px;color:#64748b">' + (isDraft ? 'قابل ویرایش' : 'خواندنی') + '</span></div><div class="sup-metrics-grid">';
    var manuals = [
      ['waitingSurgery', 'منتظر عمل', '⏳'],
      ['cancelledSurgery', 'کنسلی عمل', '❌'],
      ['dialysis', 'دیالیزی', '💧'],
      ['markerPositive', 'مارکر+', '🧬'],
      ['febrile', 'تبدار', '🌡'],
      ['transfusion', 'ترانسفوزیون', '🩸'],
      ['newAdmissions', 'پذیرش جدید', '🆕'],
      ['transfers', 'انتقالی', '🔄'],
      ['pendingDischarge', 'ترخیص نرفته', '📤'],
      ['deaths', 'فوتی', '⚰️']
    ];
    manuals.forEach(function(a) {
      var k = a[0], lbl = a[1], ico = a[2];
      h += '<div class="sup-metric-card manual">';
      h += '<div class="sup-metric-i">' + ico + '</div>';
      if (isDraft) {
        h += '<div class="sup-metric-input"><button onclick="NABZ._supMetricDec(\'' + r.id + '\',\'' + k + '\')">−</button>';
        h += '<input type="number" value="' + (m[k] || 0) + '" min="0" onchange="NABZ._supMetricSet(\'' + r.id + '\',\'' + k + '\',this.value)">';
        h += '<button onclick="NABZ._supMetricInc(\'' + r.id + '\',\'' + k + '\')">+</button></div>';
      } else {
        h += '<div class="sup-metric-v">' + fa(m[k] || 0) + '</div>';
      }
      h += '<div class="sup-metric-l">' + lbl + '</div></div>';
    });
    h += '</div>';
    if (isDraft) {
      h += '<div style="padding:0 14px 14px"><label style="display:block;font-size:11px;font-weight:700;margin-bottom:4px;color:#475569">غیرمرتبط</label>';
      h += '<input type="text" class="sup-check-notes" value="' + esc(m.unrelated || '') + '" placeholder="موارد متفرقه" onblur="NABZ._supMetricSet(\'' + r.id + '\',\'unrelated\',this.value)"></div>';
    } else if (m.unrelated) {
      h += '<div style="padding:0 14px 14px;font-size:11px;color:#475569"><b>غیرمرتبط:</b> ' + esc(m.unrelated) + '</div>';
    }
    h += '</div>';

    // ─── Section 3: Staffing ───
    h += '<div class="sup-sec"><div class="sup-sec-h"><span>👥 پرسنل شیفت</span></div><div style="padding:14px">';
    var fields = [
      ['shiftSupervisor', 'مسئول شیفت', 'text'],
      ['nurses', 'تعداد پرستار', 'number'],
      ['nursesNames', 'نام پرستاران', 'text'],
      ['nurseAides', 'تعداد کمک‌بهیار', 'number'],
      ['nurseAidesNames', 'نام کمک‌بهیاران', 'text'],
      ['secretary', 'منشی', 'text'],
      ['absent', 'غایب', 'text']
    ];
    fields.forEach(function(f) {
      var k = f[0], lbl = f[1], type = f[2];
      h += '<div class="sup-form-group"><label>' + lbl + '</label>';
      if (isDraft) {
        h += '<input type="' + type + '" class="sup-check-notes" value="' + esc(sf[k] || '') + '" onblur="NABZ._supStaffSet(\'' + r.id + '\',\'' + k + '\',this.value)">';
      } else {
        h += '<div style="font-size:12px;padding:6px 0">' + esc(sf[k] || '—') + '</div>';
      }
      h += '</div>';
    });
    h += '</div></div>';

    // ─── Section 4: Quality checklist (collapsible) ───
    h += '<details class="sup-sec"><summary class="sup-sec-h" style="cursor:pointer;list-style:none"><span>📋 ارزیابی کیفیت (JCI)</span><span style="font-size:11px;color:#64748b">اختیاری</span></summary><div style="padding:0">';
    [['staffing','👥 پرسنل'],['equipment','🛠 تجهیزات'],['infection','🦠 کنترل عفونت'],['safety','🛡 ایمنی بیمار'],['medication','💊 دارو و مخدر'],['beds','🛏 تخت'],['other','📝 سایر']].forEach(function(c) {
      var cat = c[0], lbl = c[1];
      var cur = (r.checklist && r.checklist[cat]) || { status: 'na', notes: '' };
      var icon = cur.status === 'ok' ? '✅' : cur.status === 'warn' ? '⚠️' : cur.status === 'crit' ? '🔴' : '—';
      h += '<div class="sup-check-sec" style="margin:8px 10px"><div class="sup-check-h"><span>' + lbl + '</span><span>' + icon + '</span></div><div class="sup-check-b">';
      h += '<div class="sup-check-btns">';
      ['ok','warn','crit','na'].forEach(function(st) {
        var cls = (cur.status === st ? 'on ' : '') + st;
        var lblSt = st === 'ok' ? 'سالم' : st === 'warn' ? 'هشدار' : st === 'crit' ? 'بحرانی' : 'N/A';
        var dis = !isDraft ? ' disabled' : '';
        h += '<button class="' + cls + '"' + dis + ' onclick="NABZ._supSetCheck(\'' + r.id + '\',\'' + cat + '\',\'' + st + '\')">' + lblSt + '</button>';
      });
      h += '</div>';
      if (isDraft) {
        h += '<textarea class="sup-check-notes" placeholder="یادداشت" onblur="NABZ._supNote(\'' + r.id + '\',\'' + cat + '\',this.value)">' + esc(cur.notes || '') + '</textarea>';
      } else if (cur.notes) {
        h += '<div style="font-size:11px;color:#475569;padding:4px 0">' + esc(cur.notes) + '</div>';
      }
      h += '</div></div>';
    });
    h += '</div></details>';

    // ─── Section 5: Findings ───
    h += '<div class="sup-sec"><div class="sup-sec-h"><span>⚠️ یافته‌ها</span><span style="font-size:11px;color:#64748b">' + fa((r.findings || []).length) + '</span></div>';
    if (!(r.findings || []).length) {
      h += '<div style="padding:20px;text-align:center;color:#64748b;font-size:11px">یافته‌ای نیست</div>';
    } else {
      h += '<div style="padding:10px">';
      (r.findings || []).forEach(function(f) {
        var catFa = {staffing:'پرسنل',equipment:'تجهیزات',infection:'عفونت',safety:'ایمنی',medication:'دارو',beds:'تخت',other:'سایر'}[f.category] || f.category;
        h += '<div class="sup-finding ' + f.severity + '"><div class="sup-finding-b">';
        h += '<div class="sup-finding-cat">' + catFa + ' · ' + (f.severity === 'critical' ? '🔴' : f.severity === 'warning' ? '⚠️' : 'ℹ️') + '</div>';
        h += '<div class="sup-finding-text">' + esc(f.text) + '</div></div>';
        if (isDraft) h += '<button class="sup-btn dng" style="padding:2px 8px;font-size:10px" onclick="NABZ._supRemoveFinding(\'' + r.id + '\',\'' + f.id + '\')">✕</button>';
        h += '</div>';
      });
      h += '</div>';
    }
    if (isDraft) h += '<div style="padding:10px;border-top:1px solid #e2e8f0"><button class="sup-btn primary" onclick="NABZ._supAddFinding(\'' + r.id + '\')">+ افزودن یافته</button></div>';
    h += '</div>';

    // ─── Section 6: Final notes ───
    if (isDraft) {
      h += '<label style="display:block;font-size:11px;font-weight:700;margin-bottom:4px;color:#475569">📝 یادداشت پایانی</label>';
      h += '<textarea class="sup-textarea" placeholder="خلاصه راند..." onblur="NABZ._supFinalNotes(\'' + r.id + '\',this.value)">' + esc(r.finalNotes || '') + '</textarea>';
      h += '<div class="sup-actions"><button class="sup-btn primary" onclick="NABZ._supSubmit(\'' + r.id + '\')">📤 ثبت راند</button></div>';
    } else if (r.status === 'submitted') {
      if (r.finalNotes) h += '<div class="sup-sec"><div class="sup-sec-h">📝 یادداشت پایانی</div><div style="padding:12px;font-size:12px">' + esc(r.finalNotes) + '</div></div>';
      h += '<div class="sup-actions"><button class="sup-btn success" onclick="NABZ._supSign(\'' + r.id + '\')">✍️ امضا</button></div>';
    } else if (r.finalNotes) {
      h += '<div class="sup-sec"><div class="sup-sec-h">📝 یادداشت پایانی</div><div style="padding:12px;font-size:12px">' + esc(r.finalNotes) + '</div></div>';
    }

    el.innerHTML = h;
  }


  NABZ._supRefresh = function() { state.activeRound = null; show(); };
  NABZ._supTab = function(t) {
    if (t.indexOf('_soon_') === 0) { toast('🔒 فاز بعدی'); return; }
    state.tab = t; state.activeRound = null; renderApp();
  };
  NABZ._supStartRound = function(wc, wl) { startRound(wc, wl); };
  NABZ._supViewRound = function(id) { viewRound(id); };
  NABZ._supBackToCoverage = function() { state.activeRound = null; renderApp(); };
  NABZ._supSetCheck = async function(rid, cat, st) {
    try {
      var cur = state.activeRound.checklist[cat] || { notes: '' };
      state.activeRound = await post('/api/supervisor/round/' + rid + '/checklist/' + cat, { status: st, notes: cur.notes || '' });
      renderApp();
    } catch (e) { toast('❌ ' + e.message); }
  };
  NABZ._supNote = async function(rid, cat, notes) {
    try {
      var cur = state.activeRound.checklist[cat] || { status: 'na' };
      state.activeRound = await post('/api/supervisor/round/' + rid + '/checklist/' + cat, { status: cur.status || 'na', notes: notes });
    } catch (e) { /* silent */ }
  };
  NABZ._supAddFinding = async function(rid) {
    var cat = prompt('دسته:\n1=پرسنل 2=تجهیزات 3=عفونت 4=ایمنی 5=دارو 6=تخت 7=سایر');
    if (!cat) return;
    var cats = ['staffing','equipment','infection','safety','medication','beds','other'];
    var category = cats[Number(cat) - 1];
    if (!category) { toast('نامعتبر'); return; }
    var sev = prompt('شدت:\n1=اطلاعی 2=هشدار 3=بحرانی');
    if (!sev) return;
    var severities = ['info','warning','critical'];
    var severity = severities[Number(sev) - 1];
    if (!severity) { toast('نامعتبر'); return; }
    var text = prompt('متن یافته:');
    if (!text || text.length < 3) { toast('کوتاه'); return; }
    try {
      await post('/api/supervisor/round/' + rid + '/finding', { category: category, severity: severity, text: text });
      var today = await api('/api/supervisor/round/today');
      var r = (today.items || []).find(function(x) { return x.id === rid; });
      if (r) state.activeRound = r;
      renderApp();
    } catch (e) { toast('❌ ' + e.message); }
  };
  NABZ._supRemoveFinding = async function(rid, fid) {
    if (!confirm('حذف؟')) return;
    try {
      await post('/api/supervisor/round/' + rid + '/finding/' + fid + '/remove', {});
      var today = await api('/api/supervisor/round/today');
      var r = (today.items || []).find(function(x) { return x.id === rid; });
      if (r) state.activeRound = r;
      renderApp();
    } catch (e) { toast('❌ ' + e.message); }
  };
  NABZ._supFinalNotes = async function(rid, text) {
    try { state.activeRound = await post('/api/supervisor/round/' + rid + '/final-notes', { text: text }); }
    catch (e) { /* silent */ }
  };
  NABZ._supSubmit = async function(rid) {
    if (!confirm('ثبت راند؟ بعد از ثبت، ویرایش ممکن نیست.')) return;
    try {
      state.activeRound = await post('/api/supervisor/round/' + rid + '/submit', {});
      toast('✅ راند ثبت شد'); renderApp();
    } catch (e) { toast('❌ ' + e.message); }
  };
  NABZ._supSign = async function(rid) {
    if (!confirm('امضا؟')) return;
    try {
      await post('/api/supervisor/round/' + rid + '/sign', {});
      toast('✍️ امضا شد'); state.activeRound = null; renderApp();
    } catch (e) { toast('❌ ' + e.message); }
  };

  (function reg() {
    if (window.NABZ && typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('supervisor_dashboard', show);
      console.log('[supervisor_ui] v1 registered');
    } else {
      setTimeout(reg, 100);
    }
  })();
})();

// ═══ Floating Access Button ═══
(function() {
  function getRole() {
    try {
      if (window.NABZ && NABZ.state && NABZ.state.user && NABZ.state.user.role) return NABZ.state.user.role;
      var u = localStorage.getItem('nabz_u');
      if (u) { var p = JSON.parse(u); if (p && p.role) return p.role; }
    } catch (e) {}
    return null;
  }
  function tryAdd() {
    var role = getRole();
    if (!role) { setTimeout(tryAdd, 500); return; }
    var allowed = ['admin','hospital_director','medical_director','nursing_director','supervisor_senior','supervisor_clinical','quality_officer','head_nurse','matron'];
    if (allowed.indexOf(role) === -1) return;
    if (document.getElementById('sup-float-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'sup-float-btn';
    btn.innerHTML = '🏛️';
    btn.title = 'داشبورد سوپروایزر';
    btn.style.cssText = 'position:fixed;bottom:90px;left:12px;width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#1e4d8c,#0f172a);color:#fff;border:2px solid rgba(255,255,255,.3);font-size:24px;box-shadow:0 4px 16px rgba(30,77,140,.5);cursor:pointer;z-index:9998;display:flex;align-items:center;justify-content:center;transition:transform .2s;';
    btn.onmouseenter = function() { btn.style.transform = 'scale(1.1)'; };
    btn.onmouseleave = function() { btn.style.transform = 'scale(1)'; };
    btn.onclick = function() {
      try {
        if (window.NABZ && NABZ._dispatchRegistry && typeof NABZ._dispatchRegistry['supervisor_dashboard'] === 'function') {
          NABZ._dispatchRegistry['supervisor_dashboard']();
        } else if (window.NABZ && NABZ.show) {
          NABZ.show('supervisor.supervisor_dashboard');
        } else {
          alert('لطفاً صفحه را refresh کنید');
        }
      } catch (e) { alert('خطا: ' + e.message); }
    };
    document.body.appendChild(btn);
    console.log('[supervisor_ui] floating button added for role:', role);
  }
  tryAdd();
})();
