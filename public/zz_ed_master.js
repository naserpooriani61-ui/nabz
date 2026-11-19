(function() {
  'use strict';
  if (!window.NABZ) return;

  var css = `
    .ed-hero { padding: 16px; background: linear-gradient(135deg, rgba(14,165,233,0.1) 0%, transparent 100%); border-radius: 16px; margin-bottom: 16px; border: 1px solid rgba(14,165,233,0.2); }
    .ed-title { font-size: 20px; font-weight: 900; margin: 0 0 8px 0; color: var(--fg); display: flex; align-items: center; gap: 8px; }
    .ed-kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px; }
    @media (min-width: 600px) { .ed-kpi-grid { grid-template-columns: repeat(4, 1fr); } }
    .ed-kpi { background: var(--bg-2, #1e293b); border: 1px solid var(--border, #334155); border-radius: 12px; padding: 12px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .ed-kpi-lbl { font-size: 11px; color: #94a3b8; font-weight: 700; margin-bottom: 4px; }
    .ed-kpi-val { font-size: 24px; font-weight: 900; color: var(--fg, #fff); }
    .ed-kpi-val.danger { color: #ef4444; text-shadow: 0 0 10px rgba(239,68,68,0.3); }
    .ed-kpi-val.success { color: #10b981; }

    .ed-zone-bar { margin-bottom: 12px; background: var(--bg-2, #1e293b); border: 1px solid var(--border, #334155); border-radius: 8px; padding: 10px; }
    .ed-zone-head { display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin-bottom: 6px; color: var(--fg); }
    .ed-progress { height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; }
    .ed-progress-fill { height: 100%; background: var(--primary, #0ea5e9); border-radius: 3px; transition: width 0.3s; }

    .ed-btn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .ed-btn { padding: 12px; border-radius: 10px; border: 1px solid var(--border, #334155); background: var(--bg-2, #1e293b); color: var(--fg, #fff); font-weight: bold; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: 0.2s; font-family: inherit; }
    .ed-btn:active { transform: scale(0.97); }
    .ed-btn.primary { background: var(--primary, #0ea5e9); color: #000; border: none; }
    .ed-btn.danger { background: #ef4444; color: #fff; border: none; }
    
    .ed-bed-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 8px; }
    .ed-bed { aspect-ratio: 1; border-radius: 8px; border: 2px solid var(--border, #334155); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
    .ed-bed.empty { border-style: dashed; color: #64748b; background: rgba(0,0,0,0.1); }
    .ed-bed.occupied { background: rgba(14,165,233,0.15); border-color: var(--primary, #0ea5e9); color: var(--primary, #0ea5e9); }
    .ed-bed.cleaning { background: rgba(245,158,11,0.15); border-color: #f59e0b; color: #f59e0b; }
    .ed-bed.blocked { background: rgba(239,68,68,0.1); border-color: #ef4444; color: #ef4444; opacity: 0.6; }
    
    .ed-code-card { background: var(--bg-2, #1e293b); border: 1px solid #ef4444; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 4px 15px rgba(239,68,68,0.2); }
    .ed-code-title { font-size: 16px; font-weight: 900; color: #ef4444; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .ed-timer { font-family: monospace; font-size: 20px; background: #000; color: #ef4444; padding: 2px 8px; border-radius: 6px; }
    
    .ed-list-item { display: flex; justify-content: space-between; padding: 12px; background: var(--bg-2, #1e293b); border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--border, #334155); }
  `;
  var style = document.createElement('style');
  style.innerHTML = css;
  document.head.appendChild(style);

  function esc(s) { return NABZ._esc ? NABZ._esc(s) : String(s || ''); }
  function box() { return document.getElementById('content'); }
  function toast(m) { try { NABZ._toast(m); } catch(_) { alert(m); } }

  async function showDashboard() {
    box().innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';
    try {
      var d = await NABZ._api('/api/erf/overview');
      var h = `
        <div class="ed-hero">
          <h2 class="ed-title">🚨 فرماندهی اورژانس (SinaER)</h2>
          <div style="font-size:12px;color:#94a3b8">وضعیت لحظه‌ای بخش اورژانس</div>
        </div>
        <div class="ed-kpi-grid">
          <div class="ed-kpi"><div class="ed-kpi-lbl">بیماران فعال</div><div class="ed-kpi-val">${d.activeVisits || 0}</div></div>
          <div class="ed-kpi"><div class="ed-kpi-lbl">اشغال تخت</div><div class="ed-kpi-val ${d.kpis.occupancyPct > 85 ? 'danger' : 'success'}">${d.kpis.occupancyPct}%</div></div>
          <div class="ed-kpi"><div class="ed-kpi-lbl">کدهای فعال</div><div class="ed-kpi-val ${d.activeCodes.length ? 'danger' : ''}">${d.activeCodes.length}</div></div>
          <div class="ed-kpi"><div class="ed-kpi-lbl">میانگین تریاژ</div><div class="ed-kpi-val">${d.kpis.avgDoorToTriage || '—'} <span style="font-size:12px;font-weight:normal">دقیقه</span></div></div>
        </div>`;
      if (d.activeCodes.length > 0) {
        h += '<div style="margin-bottom:16px">';
        d.activeCodes.forEach(c => {
          h += `<div class="ed-code-card" onclick="NABZ.edUI.showCodes()" style="cursor:pointer;animation:pulse 2s infinite">
            <div class="ed-code-title">🚨 ${esc(c.label)} <span class="ed-timer">ACTIVE</span></div>
            <div style="font-size:12px;color:#cbd5e1">${esc(c.activatedBy)} · ${new Date(c.activatedAt).toLocaleTimeString('fa-IR')}</div>
          </div>`;
        });
        h += '</div>';
      }
      h += '<h3 style="font-size:14px;font-weight:bold;margin-bottom:12px;color:var(--fg)">وضعیت زون‌ها</h3>';
      d.zoneList.forEach(z => {
        var zd = d.zones[z.code];
        if (!zd) return;
        var pct = zd.total ? Math.round((zd.occupied / zd.total) * 100) : 0;
        h += `<div class="ed-zone-bar">
          <div class="ed-zone-head"><span>${esc(z.icon)} ${esc(z.label)}</span><span>${zd.occupied} / ${zd.total}</span></div>
          <div class="ed-progress"><div class="ed-progress-fill" style="width:${pct}%;background:${pct>85?'#ef4444':'var(--primary)'}"></div></div>
        </div>`;
      });
      box().innerHTML = h;
    } catch(e) { box().innerHTML = '<div class="empty">خطا در دریافت اطلاعات</div>'; }
  }

  async function showBeds() {
    box().innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';
    try {
      var d = await NABZ._api('/api/erf/beds');
      var byZone = {};
      (d.items || []).forEach(b => { (byZone[b.zone] = byZone[b.zone] || []).push(b); });
      var h = `<div class="ed-hero"><h2 class="ed-title">🛏️ مدیریت تخت‌ها</h2></div>`;
      (d.zones || []).forEach(z => {
        var list = byZone[z.code] || [];
        if (!list.length) return;
        h += `<div style="margin-bottom:24px">
          <div style="font-size:14px;font-weight:bold;margin-bottom:8px;display:flex;justify-content:space-between;color:var(--fg)">
            <span>${esc(z.icon)} ${esc(z.label)}</span>
            <span style="color:#94a3b8;font-size:12px">${list.filter(b=>b.status==='occupied').length}/${list.length} اشغال</span>
          </div>
          <div class="ed-bed-grid">`;
        list.forEach(b => {
          h += `<div class="ed-bed ${b.status}" onclick="NABZ.edUI.bedAction('${b.id}', '${b.status}')">
            <div>${esc(b.code.split('-').pop())}</div>
            <div style="font-size:9px;opacity:0.7">${b.status === 'empty' ? 'آزاد' : b.status === 'occupied' ? 'اشغال' : b.status === 'cleaning' ? 'نظافت' : 'مسدود'}</div>
          </div>`;
        });
        h += `</div></div>`;
      });
      box().innerHTML = h;
    } catch(e) { box().innerHTML = '<div class="empty">خطا در دریافت تخت‌ها</div>'; }
  }

  async function showCodes() {
    box().innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';
    try {
      var d = await NABZ._api('/api/erf/codes');
      var h = `<div class="ed-hero"><h2 class="ed-title">🔴 کدهای اورژانس</h2></div>`;
      var active = (d.items || []).filter(c => c.status === 'active');
      if (active.length > 0) {
        active.forEach(c => {
          var stepsHtml = c.steps.map(s => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.1);color:var(--fg)">
            <span>${s.status === 'done' ? '✅' : '⬜'} ${esc(s.name)}</span>
            ${s.status !== 'done' ? `<button class="ed-btn" style="padding:2px 8px;font-size:11px;width:auto" onclick="NABZ.edUI.stepCode('${c.id}','${s.id}')">انجام شد</button>` : ''}
          </div>`).join('');
          h += `<div class="ed-code-card">
            <div class="ed-code-title">🚨 ${esc(c.label)} <span class="ed-timer">${Math.round((Date.now() - new Date(c.activatedAt).getTime())/60000)}m</span></div>
            ${stepsHtml}
            <button class="ed-btn danger" style="margin-top:12px" onclick="NABZ.edUI.resolveCode('${c.id}')">بستن کد</button>
          </div>`;
        });
      } else {
        h += '<div style="text-align:center;padding:20px;color:#94a3b8">کد فعالی وجود ندارد</div>';
      }
      h += `<h3 style="font-size:14px;font-weight:bold;margin:16px 0 12px;color:var(--fg)">فعال‌سازی کد جدید</h3>
      <div class="ed-btn-grid">`;
      Object.keys(d.meta).forEach(k => {
        h += `<button class="ed-btn danger" onclick="NABZ.edUI.activateCode('${k}')">${esc(d.meta[k].label)}</button>`;
      });
      h += `</div>`;
      box().innerHTML = h;
    } catch(e) { box().innerHTML = '<div class="empty">خطا در دریافت کدها</div>'; }
  }

  async function showOrders() {
    box().innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';
    try {
      var d = await NABZ._api('/api/erf/orders');
      var h = `<div class="ed-hero"><h2 class="ed-title">📋 کاردکس و دستورات</h2></div>`;
      if (!d.items || !d.items.length) {
        h += '<div class="empty">دستوری ثبت نشده است</div>';
      } else {
        d.items.forEach(o => {
          h += `<div class="ed-list-item">
            <div>
              <div style="font-weight:bold;font-size:14px;color:var(--fg)">${esc(o.item)}</div>
              <div style="font-size:11px;color:#94a3b8">${esc(o.dose)} ${esc(o.route)} · ${esc(o.priority)}</div>
            </div>
            <div style="display:flex;align-items:center">
              <span class="badge" style="background:${o.status==='done'?'#10b981':'#3b82f6'};color:#fff;padding:4px 8px;border-radius:4px;font-size:11px">${o.status}</span>
            </div>
          </div>`;
        });
      }
      box().innerHTML = h;
    } catch(e) { box().innerHTML = '<div class="empty">خطا در دریافت دستورات</div>'; }
  }

  async function showStats() {
    box().innerHTML = '<div style="text-align:center;padding:40px"><div class="spinner"></div></div>';
    try {
      var d = await NABZ._api('/api/erf/stats');
      var h = `<div class="ed-hero"><h2 class="ed-title">📊 آمار عملکرد اورژانس</h2></div>
      <div class="ed-kpi-grid">
        <div class="ed-kpi"><div class="ed-kpi-lbl">کل مراجعات</div><div class="ed-kpi-val">${d.totalVisits || 0}</div></div>
        <div class="ed-kpi"><div class="ed-kpi-lbl">میانگین تریاژ (دقیقه)</div><div class="ed-kpi-val">${d.doorToTriage?.median || '—'}</div></div>
        <div class="ed-kpi"><div class="ed-kpi-lbl">میانگین ویزیت (دقیقه)</div><div class="ed-kpi-val">${d.doorToDoctor?.median || '—'}</div></div>
        <div class="ed-kpi"><div class="ed-kpi-lbl">مدت اقامت (دقیقه)</div><div class="ed-kpi-val">${d.lengthOfStay?.median || '—'}</div></div>
      </div>`;
      box().innerHTML = h;
    } catch(e) { box().innerHTML = '<div class="empty">خطا در دریافت آمار</div>'; }
  }

  async function bedAction(id, status) {
    if (status === 'cleaning') {
      if (!confirm('تخت نظافت شد و آماده پذیرش است؟')) return;
      try { await NABZ._api('/api/erf/beds/' + id + '/status', { method: 'POST', body: JSON.stringify({ status: 'empty' }) }); toast('تخت آزاد شد'); showBeds(); } catch(e) { alert(e.message); }
    } else if (status === 'empty') {
      alert('برای پذیرش بیمار در این تخت، از منوی «بیماران جدید» استفاده کنید یا بیمار را از کاردکس منتقل کنید.');
    }
  }

  async function activateCode(type) {
    if (!confirm('کد اورژانس فعال شود؟')) return;
    try { await NABZ._api('/api/erf/codes', { method: 'POST', body: JSON.stringify({ type: type }) }); toast('کد فعال شد'); showCodes(); } catch(e) { alert(e.message); }
  }

  async function stepCode(id, stepId) {
    try { await NABZ._api('/api/erf/codes/' + id + '/step', { method: 'POST', body: JSON.stringify({ step: stepId }) }); showCodes(); } catch(e) { alert(e.message); }
  }

  async function resolveCode(id) {
    if (!confirm('کد بسته شود؟')) return;
    try { await NABZ._api('/api/erf/codes/' + id + '/resolve', { method: 'POST', body: JSON.stringify({}) }); toast('کد بسته شد'); showCodes(); } catch(e) { alert(e.message); }
  }

  window.NABZ = window.NABZ || {};
  NABZ.edUI = { showDashboard, showBeds, showCodes, showOrders, showStats, bedAction, activateCode, stepCode, resolveCode };

  var tries = 0;
  (function ready() {
    if (window.NABZ && typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('_disabled_erf_dashboard', function() { showDashboard(); });
      NABZ.registerKind('_disabled_erf_beds', function() { showBeds(); });
      NABZ.registerKind('_disabled_erf_codes', function() { showCodes(); });
      NABZ.registerKind('_disabled_erf_orders', function() { showOrders(); });
      NABZ.registerKind('_disabled_erf_stats', function() { showStats(); });
      console.log('[ED-Master] Registered all 5 superhuman ERF panels ✓');
      return;
    }
    if (++tries >= 100) return console.warn('[ED-Master] NABZ.registerKind not found');
    setTimeout(ready, 100);
  })();
})();
