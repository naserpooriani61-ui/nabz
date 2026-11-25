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
    h += '<button class="sup-hd-b" onclick="NABZ.show(\'supervisor.supervisor_report\')" title="گزارش رسمی" style="background:linear-gradient(135deg,#10b981,#059669)">📋 گزارش</button>';
    h += '<button class="sup-hd-b" onclick="NABZ._supRefresh()">⟳</button></div>';
    h += '<div class="sup-tabs">';
    [['overview','📊 نمای کلی'],['wards','🏥 بخش‌ها'],['round','🏛️ راند'],
     ['or','🏨 اتاق عمل'],['staff','👥 پرسنل'],['safety','🛡 ایمنی'],
     ['incidents','⚠️ حوادث'],['handover','📝 گزارش شیفت'],['analytics','📈 تحلیل']].forEach(function(t) {
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
    var fns = {
      overview: renderOverview, wards: renderWards, round: renderRound,
      or: renderOR, staff: renderStaff, safety: renderSafety,
      incidents: renderIncidents, handover: renderHandover, analytics: renderAnalytics
    };
    var fn = fns[state.tab];
    if (fn) fn(el);
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
    state._lastWard = wardCode;
    state._lastWardLabel = wardLabel || wardCode;
    try {
      var today = await api('/api/supervisor/round/today');
      var existing = (today.items || []).find(function(r) { return r.wardCode === wardCode && r.shiftType === state.shiftType; });
      if (existing && existing.id) { state.activeRound = existing; renderApp(); return; }
      var created = await post('/api/supervisor/round', { wardCode: wardCode, wardLabel: wardLabel || wardCode, shiftType: state.shiftType });
      if (!created || !created.id) {
        toast('❌ ' + ((created && created.error) || 'ساخت راند ناموفق'));
        return;
      }
      state.activeRound = created;
      renderApp();
    } catch (e) { toast('❌ ' + ((e && (e.message || e.error)) || 'خطا')); }
  }


  async function viewRound(roundId) {
    try {
      var today = await api('/api/supervisor/round/today');
      var r = (today.items || []).find(function(x) { return x.id === roundId; });
      if (!r) {
        toast('⚠️ راند در سرور نیست، بازسازی...');
        await recoverRound();
        return;
      }
      state.activeRound = r;
      state._lastWard = r.wardCode;
      state._lastWardLabel = r.wardLabel;
      renderApp();
    } catch (e) { toast('❌ ' + ((e && (e.message || e.error)) || 'خطا')); }
  }


  async function recoverRound() {
    var wc = (state.activeRound && state.activeRound.wardCode) || state._lastWard || null;
    var wl = (state.activeRound && state.activeRound.wardLabel) || state._lastWardLabel || wc;
    if (!wc) { toast('❌ بخش مشخص نیست'); return false; }
    var oldId = state.activeRound && state.activeRound.id;
    state.activeRound = null;
    try {
      var today = await api('/api/supervisor/round/today');
      var existing = (today.items || []).find(function(r) {
        return r.wardCode === wc && r.shiftType === state.shiftType;
      });
      if (existing && existing.id) { state.activeRound = existing; renderApp(); return true; }
      var created = await post('/api/supervisor/round', { wardCode: wc, wardLabel: wl || wc, shiftType: state.shiftType });
      if (created && created.id) {
        console.log('[recover] old:', oldId, '→ new:', created.id);
        state.activeRound = created;
        renderApp();
        return true;
      }
    } catch (e) { console.error('[recover]', e); }
    toast('❌ بازسازی ناموفق');
    return false;
  }

  function renderRoundForm(el) {
    var r = state.activeRound;
    if (!r) { renderCoverage(el); return; }
    var isDraft = r.status === 'draft';
    var m = r.metrics || {};
    var sf = r.staffing || {};
    var dt = r.details || {};

    if (!document.getElementById('sup-style-detail')) {
      var st3 = document.createElement('style');
      st3.id = 'sup-style-detail';
      st3.textContent = '.sup-detail-section{background:#fff;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(15,23,42,.06);margin-bottom:12px;overflow:hidden}'
        + '.sup-detail-header{padding:12px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}'
        + '.sup-detail-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;color:#0f172a}'
        + '.sup-detail-count{background:#1e4d8c;color:#fff;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:800;min-width:24px;text-align:center}'
        + '.sup-detail-hint{font-size:10px;color:#d97706;font-weight:700;padding:2px 8px;background:#fef3c7;border-radius:8px}'
        + '.sup-detail-empty{padding:20px;text-align:center;color:#94a3b8;font-size:11px}'
        + '.sup-detail-list{padding:10px}'
        + '.sup-detail-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin-bottom:8px}'
        + '.sup-detail-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:11px;color:#64748b;font-weight:700}'
        + '.sup-detail-remove{width:26px;height:26px;border-radius:50%;border:1px solid #fca5a5;background:#fef2f2;color:#dc2626;font-weight:900;cursor:pointer;font-size:14px;line-height:1}'
        + '.sup-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}'
        + '.sup-detail-field.full{grid-column:span 2}'
        + '.sup-detail-field label{display:block;font-size:10px;color:#475569;font-weight:700;margin-bottom:3px}'
        + '.sup-detail-field input,.sup-detail-field select{width:100%;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;direction:rtl;background:#fff;color:#0f172a;font-family:inherit;box-sizing:border-box}'
        + '.sup-detail-readonly{padding:6px 8px;font-size:11px;color:#0f172a;background:#fff;border-radius:6px;border:1px solid #e2e8f0;min-height:18px}';
      document.head.appendChild(st3);
    }

    var SCHEMAS = {
      isolated: { label: 'ایزوله', icon: '🔒', fields: [
        { key: 'name', label: 'نام بیمار', type: 'text', req: true, w: 'full' },
        { key: 'mrn', label: 'MRN', type: 'text', w: 'half' },
        { key: 'isolationType', label: 'نوع ایزولاسیون', type: 'select', options: ['تماسی','قطره‌ای','هوایی','معکوس'], w: 'half' },
        { key: 'startDate', label: 'تاریخ شروع', type: 'date', w: 'half' }
      ]},
      ventilated: { label: 'تحت ونتیلاتور', icon: '🫁', fields: [
        { key: 'name', label: 'نام بیمار', type: 'text', req: true, w: 'full' },
        { key: 'ventilatorNo', label: 'شماره ونتیلاتور', type: 'text', w: 'half' },
        { key: 'intubationDate', label: 'تاریخ اینتوباسیون', type: 'date', w: 'half' }
      ]},
      highRisk: { label: 'بیمار پرخطر', icon: '⚠️', fields: [
        { key: 'name', label: 'نام بیمار', type: 'text', req: true, w: 'full' },
        { key: 'riskType', label: 'نوع خطر', type: 'select', options: ['سقوط','زخم فشاری','خودکشی','تشنج','سوءتغذیه','سایر'], w: 'half' },
        { key: 'notes', label: 'یادداشت', type: 'text', w: 'half' }
      ]},
      icuWaiting: { label: 'منتظر ICU', icon: '🏥', fields: [
        { key: 'name', label: 'نام بیمار', type: 'text', req: true, w: 'full' },
        { key: 'fromWard', label: 'از بخش', type: 'text', w: 'half' },
        { key: 'targetIcu', label: 'ICU مقصد', type: 'text', w: 'half' },
        { key: 'waitingSince', label: 'از ساعت', type: 'time', w: 'half' }
      ]},
      transfusion: { label: 'ترانسفوزیون', icon: '🩸', fields: [
        { key: 'name', label: 'نام بیمار', type: 'text', req: true, w: 'full' },
        { key: 'mrn', label: 'MRN', type: 'text', w: 'half' },
        { key: 'productType', label: 'فرآورده', type: 'select', options: ['PRBC','FFP','Platelet','Cryo'], w: 'half' },
        { key: 'units', label: 'تعداد واحد', type: 'number', w: 'half' },
        { key: 'startTime', label: 'ساعت شروع', type: 'time', w: 'half' },
        { key: 'endTime', label: 'ساعت پایان', type: 'time', w: 'half' },
        { key: 'reaction', label: 'واکنش', type: 'select', options: ['ندارد','خفیف','شدید'], w: 'half' }
      ]},
      waitingSurgery: { label: 'منتظر عمل', icon: '🔪', fields: [
        { key: 'name', label: 'نام بیمار', type: 'text', req: true, w: 'full' },
        { key: 'surgeryType', label: 'نوع عمل', type: 'text', w: 'full' },
        { key: 'surgeon', label: 'جراح', type: 'text', w: 'half' },
        { key: 'plannedDate', label: 'تاریخ برنامه', type: 'date', w: 'half' },
        { key: 'delayReason', label: 'علت تأخیر', type: 'text', w: 'full' }
      ]},
      cancelledSurgery: { label: 'کنسلی عمل', icon: '❌', fields: [
        { key: 'name', label: 'نام بیمار', type: 'text', req: true, w: 'full' },
        { key: 'surgeryType', label: 'نوع عمل', type: 'text', w: 'half' },
        { key: 'reason', label: 'دلیل کنسلی', type: 'text', w: 'half' }
      ]},
      dialysis: { label: 'دیالیز', icon: '💧', fields: [
        { key: 'name', label: 'نام بیمار', type: 'text', req: true, w: 'full' },
        { key: 'dialysisType', label: 'نوع', type: 'select', options: ['HD','CRRT','PD'], w: 'half' },
        { key: 'session', label: 'نوبت', type: 'text', w: 'half' },
        { key: 'machine', label: 'دستگاه', type: 'text', w: 'half' },
        { key: 'time', label: 'ساعت', type: 'time', w: 'half' }
      ]},
      markerPositive: { label: 'مارکر مثبت', icon: '🧬', fields: [
        { key: 'name', label: 'نام بیمار', type: 'text', req: true, w: 'full' },
        { key: 'markerType', label: 'نوع مارکر', type: 'select', options: ['HBsAg','HCV','HIV','Other'], w: 'half' },
        { key: 'isolated', label: 'ایزوله شد؟', type: 'select', options: ['بله','خیر'], w: 'half' }
      ]},
      febrile: { label: 'تبدار', icon: '🌡', fields: [
        { key: 'name', label: 'نام بیمار', type: 'text', req: true, w: 'full' },
        { key: 'temp', label: 'دما (°C)', type: 'number', w: 'half' },
        { key: 'suspectedCause', label: 'علت مشکوک', type: 'text', w: 'half' }
      ]},
      newAdmissions: { label: 'پذیرش جدید', icon: '🆕', fields: [
        { key: 'name', label: 'نام بیمار', type: 'text', req: true, w: 'full' },
        { key: 'source', label: 'منبع', type: 'select', options: ['اورژانس','درمانگاه','انتقالی','الکتیو'], w: 'half' },
        { key: 'diagnosis', label: 'تشخیص', type: 'text', w: 'half' }
      ]},
      transfers: { label: 'انتقالی', icon: '🔄', fields: [
        { key: 'name', label: 'نام بیمار', type: 'text', req: true, w: 'full' },
        { key: 'from', label: 'از بخش', type: 'text', w: 'half' },
        { key: 'to', label: 'به بخش', type: 'text', w: 'half' },
        { key: 'reason', label: 'علت', type: 'text', w: 'full' }
      ]},
      pendingDischarge: { label: 'ترخیص نرفته', icon: '📤', fields: [
        { key: 'name', label: 'نام بیمار', type: 'text', req: true, w: 'full' },
        { key: 'delayReason', label: 'علت تأخیر', type: 'text', w: 'half' },
        { key: 'plan', label: 'برنامه', type: 'text', w: 'half' }
      ]},
      deaths: { label: 'فوتی', icon: '⚰️', fields: [
        { key: 'name', label: 'نام بیمار', type: 'text', req: true, w: 'full' },
        { key: 'mrn', label: 'MRN', type: 'text', w: 'half' },
        { key: 'cprTime', label: 'ساعت CPR', type: 'time', w: 'half' },
        { key: 'deathTime', label: 'ساعت فوت', type: 'time', w: 'half' },
        { key: 'cause', label: 'علت', type: 'text', w: 'half' },
        { key: 'certIssued', label: 'گواهی صادر شد؟', type: 'select', options: ['بله','خیر'], w: 'half' },
        { key: 'code99', label: 'کد ۹۹؟', type: 'select', options: ['بله','خیر'], w: 'half' }
      ]}
    };

    var h = '';

    h += '<div class="sup-sec" style="background:linear-gradient(135deg,#1e4d8c,#0f172a);color:#fff;border:none"><div style="padding:14px">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center"><div>';
    h += '<div style="font-size:11px;opacity:.8">راند بخش · ' + (r.shiftType === 'morning' ? 'صبح' : r.shiftType === 'evening' ? 'عصر' : 'شب') + '</div>';
    h += '<div style="font-size:17px;font-weight:900">' + esc(r.wardLabel || r.wardCode) + '</div></div>';
    h += '<button class="sup-btn" onclick="NABZ._supBackToCoverage()" style="background:rgba(255,255,255,.2);color:#fff">→ بازگشت</button>';
    h += '</div><div style="font-size:11px;opacity:.8;margin-top:8px">' + (isDraft ? '✏️ پیش‌نویس' : r.status === 'submitted' ? '📤 ثبت شده' : '✅ امضا شده') + ' · ' + fa(r.date) + '</div></div></div>';

    h += '<div class="sup-sec"><div class="sup-sec-h"><span>🟢 آمار خودکار</span>';
    if (isDraft) h += '<button class="sup-btn" style="padding:3px 8px;font-size:10px" onclick="NABZ._supRefreshAuto(\'' + r.id + '\')">⟳</button>';
    h += '</div><div class="sup-metrics-grid">';
    [['patientsTotal','بیمار کل','👥'],['bedsOccupied','اشغال','🛏'],['bedsEmpty','خالی','✅']].forEach(function(a) {
      h += '<div class="sup-metric-card"><div class="sup-metric-i">' + a[2] + '</div><div class="sup-metric-v">' + fa(m[a[0]] || 0) + '</div><div class="sup-metric-l">' + a[1] + '</div></div>';
    });
    h += '</div></div>';

    Object.keys(SCHEMAS).forEach(function(key) {
      var sch = SCHEMAS[key];
      var items = dt[key] || [];
      var autoHint = ['isolated','ventilated','highRisk','icuWaiting'].indexOf(key) !== -1 ? m[key] : null;

      h += '<div class="sup-detail-section">';
      h += '<div class="sup-detail-header">';
      h += '<div class="sup-detail-title">' + sch.icon + ' <span>' + sch.label + '</span><span class="sup-detail-count">' + fa(items.length) + '</span>';
      if (autoHint != null && autoHint !== items.length) h += '<span class="sup-detail-hint">سیستم: ' + fa(autoHint) + '</span>';
      h += '</div>';
      if (isDraft) h += '<button class="sup-btn primary" style="padding:4px 10px;font-size:11px" onclick="NABZ._supAddDetail(\'' + r.id + '\',\'' + key + '\')">+ افزودن</button>';
      h += '</div>';

      if (!items.length) {
        h += '<div class="sup-detail-empty">موردی ثبت نشده — با «+» اضافه کنید</div>';
      } else {
        h += '<div class="sup-detail-list">';
        items.forEach(function(item, idx) {
          h += '<div class="sup-detail-card">';
          h += '<div class="sup-detail-card-head"><span>#' + fa(idx + 1) + '</span>';
          if (isDraft) h += '<button class="sup-detail-remove" onclick="NABZ._supRemoveDetail(\'' + r.id + '\',\'' + key + '\',\'' + item._id + '\')">×</button>';
          h += '</div>';
          h += '<div class="sup-detail-grid">';
          sch.fields.forEach(function(f) {
            var w = f.w === 'half' ? 'sup-detail-field half' : 'sup-detail-field full';
            var val = item[f.key] != null ? item[f.key] : '';
            h += '<div class="' + w + '"><label>' + f.label + (f.req ? ' *' : '') + '</label>';
            if (!isDraft) {
              h += '<div class="sup-detail-readonly">' + esc(val || '—') + '</div>';
            } else if (f.type === 'select') {
              h += '<select onchange="NABZ._supUpdateDetail(\'' + r.id + '\',\'' + key + '\',\'' + item._id + '\',\'' + f.key + '\',this.value)">';
              h += '<option value="">—</option>';
              f.options.forEach(function(opt) {
                h += '<option value="' + esc(opt) + '"' + (String(val) === String(opt) ? ' selected' : '') + '>' + esc(opt) + '</option>';
              });
              h += '</select>';
            } else {
              h += '<input type="' + f.type + '" value="' + esc(val) + '" onchange="NABZ._supUpdateDetail(\'' + r.id + '\',\'' + key + '\',\'' + item._id + '\',\'' + f.key + '\',this.value)">';
            }
            h += '</div>';
          });
          h += '</div></div>';
        });
        h += '</div>';
      }
      h += '</div>';
    });

    h += '<div class="sup-sec"><div class="sup-sec-h"><span>👥 پرسنل شیفت</span></div><div style="padding:14px">';
    [['shiftSupervisor','مسئول شیفت','text'],['nurses','تعداد پرستار','number'],['nursesNames','نام پرستاران','text'],['nurseAides','تعداد کمک‌بهیار','number'],['nurseAidesNames','نام کمک‌بهیارها','text'],['secretary','منشی','text'],['absent','غایب','text']].forEach(function(f) {
      h += '<div class="sup-form-group" style="margin-bottom:10px"><label style="display:block;font-size:11px;font-weight:700;margin-bottom:4px;color:#475569">' + f[1] + '</label>';
      if (isDraft) {
        h += '<input type="' + f[2] + '" value="' + esc(sf[f[0]] || '') + '" onblur="NABZ._supStaffSet(\'' + r.id + '\',\'' + f[0] + '\',this.value)" style="width:100%;padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;direction:rtl;background:#fff;color:#0f172a;box-sizing:border-box">';
      } else {
        h += '<div style="font-size:12px;padding:6px 0">' + esc(sf[f[0]] || '—') + '</div>';
      }
      h += '</div>';
    });
    h += '</div></div>';

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


  NABZ._supOpenReport = function() { NABZ.show('supervisor.supervisor_report'); };
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

  // ═══════ Tab 4: OR ═══════
  function renderOR(el) {
    var d = (state.data && state.data.or) || {};
    var rooms = d.rooms || [];
    var t = d.totals || {};
    var h = '<div class="sup-kpi-grid">';
    h += '<div class="sup-kpi"><div class="sup-kpi-v">' + fa(t.total || 0) + '</div><div class="sup-kpi-l">اتاق کل</div></div>';
    h += '<div class="sup-kpi dng"><div class="sup-kpi-v">' + fa(t.inProgress || 0) + '</div><div class="sup-kpi-l">در حال عمل</div></div>';
    h += '<div class="sup-kpi wrn"><div class="sup-kpi-v">' + fa(t.waiting || 0) + '</div><div class="sup-kpi-l">منتظر</div></div>';
    h += '<div class="sup-kpi suc"><div class="sup-kpi-v">' + fa(t.scheduled || 0) + '</div><div class="sup-kpi-l">برنامه امروز</div></div>';
    h += '</div>';
    h += '<div class="sup-sec"><div class="sup-sec-h"><span>🏨 اتاق‌های عمل</span><span style="font-size:11px;color:#64748b">' + fa(rooms.length) + '</span></div>';
    if (!rooms.length) {
      h += '<div style="padding:30px;text-align:center;color:#64748b">داده‌ای نیست</div>';
    } else {
      rooms.forEach(function(r) {
        var icon = r.inProgress > 0 ? '🔴' : (r.waiting > 0 ? '🟡' : '🟢');
        h += '<div class="sup-ward-row"><div style="font-size:18px">' + icon + '</div>';
        h += '<div style="flex:1"><div style="font-weight:800;font-size:12px">' + esc(r.name || r.id) + '</div>';
        h += '<div style="font-size:10px;color:#64748b">' + esc(r.specialty || '—') + ' · ' + esc(r.wardCode || '—') + '</div></div>';
        h += '<div class="sup-ward-stats"><span class="occ">درحال: ' + fa(r.inProgress || 0) + '</span>';
        h += '<span>منتظر: ' + fa(r.waiting || 0) + '</span>';
        h += '<span class="emp">کل: ' + fa(r.scheduled || 0) + '</span></div></div>';
      });
    }
    h += '</div>';
    el.innerHTML = h;
  }

  // ═══════ Tab 5: Staff ═══════
  function renderStaff(el) {
    var d = (state.data && state.data.staff) || {};
    var onCall = d.onCallToday || [];
    var rosters = d.todayRosters || [];
    var byRole = d.usersByRole || {};
    var t = d.totals || {};
    var roleFa = {physician:'پزشک',nurse:'پرستار',head_nurse:'سرپرستار',nurse_aide:'کمک‌بهیار',midwife:'ماما',resident:'رزیدنت',attending:'استاد',other:'سایر'};
    var h = '<div class="sup-kpi-grid">';
    h += '<div class="sup-kpi"><div class="sup-kpi-v">' + fa(t.usersActive || 0) + '</div><div class="sup-kpi-l">کاربر فعال</div></div>';
    h += '<div class="sup-kpi suc"><div class="sup-kpi-v">' + fa(onCall.length) + '</div><div class="sup-kpi-l">آنکال امروز</div></div>';
    h += '<div class="sup-kpi wrn"><div class="sup-kpi-v">' + fa(rosters.length) + '</div><div class="sup-kpi-l">شیفت امروز</div></div>';
    h += '<div class="sup-kpi"><div class="sup-kpi-v">' + fa(t.nurseAssignments || 0) + '</div><div class="sup-kpi-l">تخصیص پرستار</div></div>';
    h += '</div>';
    h += '<div class="sup-sec"><div class="sup-sec-h"><span>👥 توزیع نقش‌ها</span></div><div style="padding:12px">';
    Object.keys(byRole).forEach(function(role) {
      if (byRole[role] > 0) {
        h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px"><span>' + (roleFa[role] || role) + '</span><b>' + fa(byRole[role]) + '</b></div>';
      }
    });
    h += '</div></div>';
    h += '<div class="sup-sec"><div class="sup-sec-h"><span>📞 آنکال امروز</span><span style="font-size:11px;color:#64748b">' + fa(onCall.length) + '</span></div>';
    if (!onCall.length) {
      h += '<div style="padding:20px;text-align:center;color:#64748b;font-size:11px">آنکال امروز ثبت نشده</div>';
    } else {
      onCall.forEach(function(o) {
        h += '<div class="sup-ward-row"><div style="flex:1"><div style="font-weight:800;font-size:12px">' + esc(o.userName || o.name || '—') + '</div>';
        h += '<div style="font-size:10px;color:#64748b">' + esc(o.wardCode || '—') + ' · ' + esc(o.role || '—') + '</div></div>';
        if (o.phone) h += '<div style="font-size:11px;color:#1e4d8c;font-weight:700;direction:ltr">' + esc(o.phone) + '</div>';
        h += '</div>';
      });
    }
    h += '</div>';
    el.innerHTML = h;
  }

  // ═══════ Tab 6: Safety ═══════
  function renderSafety(el) {
    var d = (state.data && state.data.safety) || {};
    var hr = d.highRiskRegister || [];
    var ptRisks = d.patientsWithRisks || [];
    var t = d.totals || {};
    var flagFa = {fall_risk:'سقوط', pressure_ulcer:'زخم فشاری', high_fall:'Morse بالا'};
    var h = '<div class="sup-kpi-grid">';
    h += '<div class="sup-kpi dng"><div class="sup-kpi-v">' + fa(t.highRiskRegister || 0) + '</div><div class="sup-kpi-l">ریسک بالا</div></div>';
    h += '<div class="sup-kpi wrn"><div class="sup-kpi-v">' + fa(t.patientsFlagged || 0) + '</div><div class="sup-kpi-l">بیمار با فلگ</div></div>';
    h += '</div>';
    h += '<div class="sup-sec"><div class="sup-sec-h"><span>🔴 ثبت ریسک بالا</span><span style="font-size:11px;color:#64748b">' + fa(hr.length) + '</span></div>';
    if (!hr.length) {
      h += '<div style="padding:20px;text-align:center;color:#64748b;font-size:11px">ریسک بالایی ثبت نشده</div>';
    } else {
      hr.forEach(function(r) {
        var lvl = (r.level || '').toLowerCase();
        var sev = lvl === 'critical' ? 'critical' : (lvl === 'high' ? 'warning' : 'info');
        h += '<div class="sup-finding ' + sev + '"><div class="sup-finding-b">';
        h += '<div class="sup-finding-cat">' + esc(r.wardCode || '—') + ' · نمره: ' + fa(r.riskScore || 0) + '</div>';
        h += '<div class="sup-finding-text">' + esc(r.title || '—') + '</div></div></div>';
      });
    }
    h += '</div>';
    h += '<div class="sup-sec"><div class="sup-sec-h"><span>⚠️ بیماران با فاکتور خطر</span><span style="font-size:11px;color:#64748b">' + fa(ptRisks.length) + '</span></div>';
    if (!ptRisks.length) {
      h += '<div style="padding:20px;text-align:center;color:#64748b;font-size:11px">بیماری با فاکتور خطر ثبت نشده</div>';
    } else {
      ptRisks.forEach(function(p) {
        var flags = (p.flags || []).map(function(f) { return flagFa[f] || f; }).join(' · ');
        h += '<div class="sup-ward-row"><div style="flex:1"><div style="font-weight:800;font-size:12px">' + esc(p.name || p.patientId) + '</div>';
        h += '<div style="font-size:10px;color:#64748b">' + esc(p.wardCode || '—') + ' · تخت ' + esc(p.bedNumber || '?') + '</div></div>';
        h += '<div style="font-size:10px;padding:2px 8px;border-radius:8px;background:#fef3c7;color:#92400e;font-weight:700">' + esc(flags) + '</div></div>';
      });
    }
    h += '</div>';
    el.innerHTML = h;
  }

  // ═══════ Tab 7: Incidents ═══════
  async function renderIncidents(el) {
    el.innerHTML = '<div class="sup-loading">در حال بارگذاری...</div>';
    try {
      var d = await api('/api/supervisor/incidents?days=7');
      var inc = d.incidents || [];
      var bySev = d.bySeverity || {};
      var byCat = d.byCategory || {};
      var t = d.totals || {};
      var h = '<div class="sup-kpi-grid">';
      h += '<div class="sup-kpi"><div class="sup-kpi-v">' + fa(t.count || 0) + '</div><div class="sup-kpi-l">۷ روز اخیر</div></div>';
      h += '<div class="sup-kpi dng"><div class="sup-kpi-v">' + fa(bySev.critical || 0) + '</div><div class="sup-kpi-l">بحرانی</div></div>';
      h += '<div class="sup-kpi wrn"><div class="sup-kpi-v">' + fa(bySev.major || 0) + '</div><div class="sup-kpi-l">جدی</div></div>';
      h += '<div class="sup-kpi wrn"><div class="sup-kpi-v">' + fa(t.requiresRca || 0) + '</div><div class="sup-kpi-l">نیاز RCA</div></div>';
      h += '</div>';
      h += '<div class="sup-sec"><div class="sup-sec-h"><span>📊 دسته‌بندی</span></div><div style="padding:12px">';
      var cats = Object.keys(byCat);
      if (!cats.length) { h += '<div style="text-align:center;color:#64748b;font-size:11px">داده‌ای نیست</div>'; }
      else { cats.forEach(function(c) { h += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px"><span>' + esc(c) + '</span><b>' + fa(byCat[c]) + '</b></div>'; }); }
      h += '</div></div>';
      h += '<div class="sup-sec"><div class="sup-sec-h"><span>⚠️ حوادث</span><span style="font-size:11px;color:#64748b">' + fa(inc.length) + '</span></div>';
      if (!inc.length) { h += '<div style="padding:20px;text-align:center;color:#64748b;font-size:11px">حادثه‌ای ثبت نشده</div>'; }
      else {
        inc.forEach(function(i) {
          var s = (i.severity || 'unknown').toLowerCase();
          var sev = s === 'critical' ? 'critical' : ((s === 'major' || s === 'high') ? 'warning' : 'info');
          h += '<div class="sup-finding ' + sev + '"><div class="sup-finding-b">';
          h += '<div class="sup-finding-cat">' + esc(i.category || '—') + ' · ' + esc(i.wardCode || '—') + '</div>';
          h += '<div class="sup-finding-text">' + esc(i.description || i.title || '—') + '</div></div></div>';
        });
      }
      h += '</div>';
      el.innerHTML = h;
    } catch (e) {
      el.innerHTML = '<div style="padding:30px;text-align:center;color:#dc2626">خطا: ' + esc(e.message) + '</div>';
    }
  }

  // ═══════ Tab 8: Handover ═══════
  async function renderHandover(el) {
    el.innerHTML = '<div class="sup-loading">در حال بارگذاری...</div>';
    try {
      var today = await api('/api/supervisor/handover/today');
      var items = today.items || [];
      var h = '<div class="sup-sec"><div class="sup-sec-h"><span>📝 گزارش شیفت امروز</span><span style="font-size:11px;color:#64748b">' + fa(today.date) + '</span></div>';
      if (!items.length) {
        h += '<div style="padding:20px;text-align:center;color:#64748b;font-size:11px">گزارشی برای امروز ثبت نشده</div>';
      } else {
        items.forEach(function(it) {
          var shiftFa = {morning:'صبح', evening:'عصر', night:'شب'}[it.shiftType] || it.shiftType;
          var statusFa = {draft:'✏️ پیش‌نویس', signed:'✍️ امضا شده', received:'✅ تحویل گرفته'}[it.status] || it.status;
          var icon = it.shiftType === 'morning' ? '☀️' : (it.shiftType === 'evening' ? '🌅' : '🌙');
          h += '<div class="sup-ward-card"><div class="sup-ward-card-inner" style="cursor:default">';
          h += '<div class="sup-wc-ico">' + icon + '</div>';
          h += '<div class="sup-wc-b"><div class="sup-wc-t">شیفت ' + shiftFa + '</div>';
          h += '<div class="sup-wc-s">' + statusFa + ' · ' + esc(it.supervisorName || '—') + '</div></div>';
          if (it.status === 'draft') {
            h += '<button class="sup-btn primary" onclick="NABZ._supSignHandover(\'' + it.id + '\')">امضا</button>';
          } else if (it.status === 'signed') {
            h += '<button class="sup-btn success" onclick="NABZ._supReceiveHandover(\'' + it.id + '\')">تحویل</button>';
          }
          h += '</div></div>';
        });
      }
      h += '</div>';
      h += '<button class="sup-btn primary" style="width:100%;padding:14px;margin-top:14px;font-size:13px" onclick="NABZ._supNewHandover()">+ ثبت گزارش شیفت جدید</button>';
      el.innerHTML = h;
    } catch (e) {
      el.innerHTML = '<div style="padding:30px;text-align:center;color:#dc2626">خطا: ' + esc(e.message) + '</div>';
    }
  }

  // ═══════ Tab 9: Analytics ═══════
  async function renderAnalytics(el) {
    el.innerHTML = '<div class="sup-loading">در حال بارگذاری...</div>';
    try {
      var days = state.analyticsDays || 7;
      var d = await api('/api/supervisor/analytics?days=' + days);
      var adm = d.admissionsPerDay || {};
      var ed = d.edVisitsPerDay || {};
      var inc = d.incidentsPerDay || {};
      var t = d.totals || {};
      var h = '<div style="display:flex;gap:6px;margin-bottom:12px">';
      [7, 30].forEach(function(dd) {
        var active = days === dd ? 'primary' : '';
        h += '<button class="sup-btn ' + active + '" onclick="NABZ._supAnalyticsDays(' + dd + ')">' + dd + ' روز</button>';
      });
      h += '</div>';
      h += '<div class="sup-kpi-grid">';
      h += '<div class="sup-kpi suc"><div class="sup-kpi-v">' + fa(t.admissions || 0) + '</div><div class="sup-kpi-l">پذیرش</div></div>';
      h += '<div class="sup-kpi wrn"><div class="sup-kpi-v">' + fa(t.edVisits || 0) + '</div><div class="sup-kpi-l">مراجعه ED</div></div>';
      h += '<div class="sup-kpi dng"><div class="sup-kpi-v">' + fa(t.incidents || 0) + '</div><div class="sup-kpi-l">حادثه</div></div>';
      h += '</div>';
      h += '<div class="sup-sec"><div class="sup-sec-h"><span>📈 روند روزانه</span></div><div style="padding:14px;overflow-x:auto">';
      var allDays = Object.keys(adm).concat(Object.keys(ed)).concat(Object.keys(inc));
      var uniqueDays = [];
      allDays.forEach(function(dd) { if (uniqueDays.indexOf(dd) === -1) uniqueDays.push(dd); });
      uniqueDays.sort();
      if (!uniqueDays.length) {
        h += '<div style="text-align:center;color:#64748b;font-size:11px">داده‌ای نیست</div>';
      } else {
        h += '<table style="width:100%;font-size:11px;border-collapse:collapse">';
        h += '<tr style="background:#f8fafc"><th style="padding:6px;text-align:right;border-bottom:1px solid #e2e8f0">تاریخ</th><th style="padding:6px;text-align:center;border-bottom:1px solid #e2e8f0">پذیرش</th><th style="padding:6px;text-align:center;border-bottom:1px solid #e2e8f0">ED</th><th style="padding:6px;text-align:center;border-bottom:1px solid #e2e8f0">حادثه</th></tr>';
        uniqueDays.forEach(function(dd) {
          h += '<tr><td style="padding:6px;border-bottom:1px solid #f1f5f9">' + esc(dd) + '</td>';
          h += '<td style="padding:6px;text-align:center;color:#059669;font-weight:700">' + fa(adm[dd] || 0) + '</td>';
          h += '<td style="padding:6px;text-align:center;color:#d97706;font-weight:700">' + fa(ed[dd] || 0) + '</td>';
          h += '<td style="padding:6px;text-align:center;color:#dc2626;font-weight:700">' + fa(inc[dd] || 0) + '</td></tr>';
        });
        h += '</table>';
      }
      h += '</div></div>';
      el.innerHTML = h;
    } catch (e) {
      el.innerHTML = '<div style="padding:30px;text-align:center;color:#dc2626">خطا: ' + esc(e.message) + '</div>';
    }
  }

  // ═══════ Handlers ═══════
  NABZ._supNewHandover = async function() {
    var shift = prompt('شیفت:\n1 = صبح\n2 = عصر\n3 = شب');
    if (!shift) return;
    var shifts = ['morning', 'evening', 'night'];
    var st = shifts[Number(shift) - 1];
    if (!st) { toast('نامعتبر'); return; }
    var summary = prompt('خلاصه شیفت (اختیاری):') || '';
    try {
      await post('/api/supervisor/handover', { date: new Date().toISOString().slice(0, 10), shiftType: st, summary: summary });
      toast('✅ گزارش ایجاد شد');
      renderTab();
    } catch (e) { toast('❌ ' + e.message); }
  };
  NABZ._supSignHandover = async function(id) {
    if (!confirm('امضای گزارش؟')) return;
    try { await post('/api/supervisor/handover/' + id + '/sign', {}); toast('✍️ امضا شد'); renderTab(); }
    catch (e) { toast('❌ ' + e.message); }
  };
  NABZ._supReceiveHandover = async function(id) {
    if (!confirm('تحویل گرفتن؟')) return;
    try { await post('/api/supervisor/handover/' + id + '/receive', {}); toast('✅ تحویل شد'); renderTab(); }
    catch (e) { toast('❌ ' + e.message); }
  };
  NABZ._supAnalyticsDays = function(days) {
    state.analyticsDays = days;
    renderTab();
  };

  NABZ._supAddDetail = async function(rid, key) {
    async function tryAdd(id) {
      try {
        var r = await post('/api/supervisor/round/' + encodeURIComponent(id) + '/detail/' + encodeURIComponent(key), {});
        if (r && r.ok === false) return { ok: false, err: r.error || r.message || 'ناموفق' };
        if (!r || !r.id) return { ok: false, err: 'پاسخ نامعتبر' };
        return { ok: true, round: r };
      } catch (e) {
        return { ok: false, err: (e && (e.message || e.error)) || 'خطا' };
      }
    }
    var res = await tryAdd(rid);
    if (res.ok) {
      state.activeRound = res.round;
      renderApp();
      return;
    }
    if (String(res.err).indexOf('not_found') >= 0) {
      toast('⚠️ راند پیدا نشد، بازسازی...');
      var recovered = await recoverRound();
      if (recovered && state.activeRound && state.activeRound.id) {
        var retry = await tryAdd(state.activeRound.id);
        if (retry.ok) {
          state.activeRound = retry.round;
          renderApp();
          toast('✅ ثبت شد (راند بازسازی شد)');
          return;
        }
        toast('❌ ' + (retry.err || 'خطای نامشخص'));
        return;
      }
      return;
    }
    toast('❌ ' + res.err);
  };

  NABZ._supUpdateDetail = async function(rid, key, detailId, field, value) {
    try {
      var payload = {};
      payload[field] = value;
      state.activeRound = await post('/api/supervisor/round/' + rid + '/detail/' + key + '/' + detailId, payload);
    } catch (e) { toast('❌ ' + e.message); }
  };
  NABZ._supRemoveDetail = async function(rid, key, detailId) {
    if (!confirm('حذف این مورد؟')) return;
    try {
      state.activeRound = await post('/api/supervisor/round/' + rid + '/detail/' + key + '/' + detailId + '/remove', {});
      renderApp();
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

/* [FAB-REMOVED] FAB is now managed by fab_v3.js */

