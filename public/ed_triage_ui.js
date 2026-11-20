// public/ed_triage_ui.js — Superhuman ED Triage (Vanilla JS)
(function() {
  'use strict';
  async function apiCall(url, opts = {}) {
    if (typeof NABZ !== 'undefined' && typeof NABZ._api === 'function') {
      return NABZ._api(url, opts);
    }
    const res = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || res.statusText);
    }
    return res.json();
  }

  if (!document.getElementById('ed-triage-style')) {
    const st = document.createElement('style');
    st.id = 'ed-triage-style';
    st.textContent = `
      .triage-wrap { direction: rtl; font-family: 'Vazirmatn', Tahoma, sans-serif; background: var(--kx-bg, #f8fafc); min-height: 100vh; padding: 16px; }
      .triage-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
      @media (min-width: 768px) { .triage-grid { grid-template-columns: 1fr 1fr; } }
      .triage-card { background: var(--kx-surface, #fff); border-radius: 12px; padding: 16px; border: 1px solid var(--kx-border, #e2e8f0); box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
      .triage-title { font-size: 14px; font-weight: 800; margin-bottom: 12px; color: var(--kx-primary, #1e40af); display: flex; align-items: center; gap: 8px; }
      .input-group { margin-bottom: 12px; }
      .input-label { display: block; font-size: 11px; font-weight: 700; color: var(--kx-text-2, #64748b); margin-bottom: 4px; }
      .input-field { width: 100%; padding: 10px; border: 1.5px solid var(--kx-border, #e2e8f0); border-radius: 8px; font-size: 14px; box-sizing: border-box; transition: border-color 0.2s; }
      .input-field:focus { outline: none; border-color: var(--kx-primary, #1e40af); }
      .vitals-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
      @media (min-width: 480px) { .vitals-grid { grid-template-columns: repeat(3, 1fr); } }
      .chip-container { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
      .chip { padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; background: var(--kx-surface-2, #f1f5f9); color: var(--kx-text, #0f172a); border: 1px solid transparent; cursor: pointer; }
      .chip:hover { background: var(--kx-primary-soft, #e0e7ff); color: var(--kx-primary, #1e40af); }
      .esi-badge { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; font-size: 16px; font-weight: 900; color: #fff; }
      .btn-primary { width: 100%; padding: 14px; background: var(--kx-primary, #1e40af); color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 800; cursor: pointer; margin-top: 16px; }
      .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    `;
    document.head.appendChild(st);
  }

  const state = { patientId: null, formData: {} };

  function _esiColorTri(l) { return { 1: '#dc2626', 2: '#ea580c', 3: '#ca8a04', 4: '#16a34a', 5: '#0284c7' }[l] || '#64748b'; }
  function _renderPatientBannerTriage(ctx) {
    if (!ctx) return '';
    const esi = ctx.esiLevel;
    const esiCol = _esiColorTri(esi);
    const safe = (s) => String(s == null ? '—' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const arrival = ctx.arrivalAt ? (() => { try { return new Date(ctx.arrivalAt).toLocaleString('fa-IR', { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' }); } catch(_) { return '—'; } })() : '—';
    let h = '<div style="background:linear-gradient(135deg,#7f1d1d 0%,#0f172a 100%);color:#fff;padding:14px;border-radius:14px;margin-bottom:12px;direction:rtl;box-shadow:0 4px 14px rgba(0,0,0,.15)">';
    h += '<div style="display:flex;justify-content:space-between;gap:10px">';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:18px;font-weight:900">' + safe(ctx.name) + '</div>';
    h += '<div style="font-size:12px;opacity:.85;margin-top:4px">' + safe(ctx.sex) + ' · ' + safe(ctx.ageLabel) + (ctx.mrn && ctx.mrn !== '—' ? ' · MRN: ' + safe(ctx.mrn) : '') + '</div>';
    h += '<div style="font-size:12px;opacity:.85;margin-top:2px">📋 ' + safe(ctx.chiefComplaint) + '</div>';
    h += '<div style="font-size:11px;opacity:.75;margin-top:4px">🕒 ' + safe(arrival) + '</div>';
    h += '</div>';
    h += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">';
    if (esi != null) h += '<div style="background:' + esiCol + ';color:#fff;padding:8px 14px;border-radius:12px;font-weight:900;font-size:18px">ESI ' + esi + '</div>';
    else h += '<div style="background:#ea580c;color:#fff;padding:6px 12px;border-radius:10px;font-weight:800;font-size:12px">در انتظار تریاژ</div>';
    h += '<div style="font-size:11px;opacity:.85">🛏 ' + safe(ctx.bedCode) + '</div>';
    h += '</div></div>';
    if (ctx.hasAllergies) h += '<div style="background:#dc2626;padding:6px 10px;border-radius:8px;margin-top:8px;font-weight:800;font-size:12px">⚠️ حساسیت: ' + ctx.allergies.map(safe).join('، ') + '</div>';
    h += '</div>';
    return h;
  }

  async function show() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlPid = urlParams.get('patientId');
    if (urlPid && urlPid !== 'undefined' && urlPid !== 'null') state.patientId = urlPid;
    if (!state.patientId) { renderWorklist(); return; }
    
    document.getElementById('content').innerHTML = `
      <div class="triage-wrap">
        <div class="triage-title">🚑 تریاژ هوشمند اورژانس</div>
        <div class="triage-grid">
          <div class="triage-card">
            <div class="triage-title">👤 اطلاعات بیمار</div>
            <div class="input-group">
              <label class="input-label">شکایت اصلی (Chief Complaint)</label>
              <input id="t_cc" class="input-field" placeholder="مثلاً: درد قفسه سینه" />
              <div class="chip-container">
                ${['درد قفسه سینه', 'تنگی نفس', 'درد شکم', 'تروما', 'تب', 'کاهش هوشیاری'].map(c => 
                  `<span class="chip" onclick="document.getElementById('t_cc').value='${c}'">${c}</span>`
                ).join('')}
              </div>
            </div>
            <div class="input-group">
              <label class="input-label">نحوه مراجعه</label>
              <select id="t_mode" class="input-field">
                <option value="walk">مراجعه شخصی</option>
                <option value="ems">آمبولانس (EMS)</option>
                <option value="referral">ارجاعی</option>
              </select>
            </div>
          </div>

          <div class="triage-card">
            <div class="triage-title">📊 علائم حیاتی اولیه</div>
            <div class="vitals-grid">
              ${[
                {id: 't_hr', label: 'نبض (HR)'},
                {id: 't_sbp', label: 'فشار سیستول'},
                {id: 't_dbp', label: 'فشار دیاستول'},
                {id: 't_rr', label: 'تنفس (RR)'},
                {id: 't_spo2', label: 'SpO2 %'},
                {id: 't_temp', label: 'دما (°C)'},
                {id: 't_gcs', label: 'GCS'},
                {id: 't_pain', label: 'درد (0-10)'}
              ].map(v => `
                <div class="input-group">
                  <label class="input-label">${v.label}</label>
                  <input id="${v.id}" type="number" inputmode="decimal" class="input-field" />
                </div>
              `).join('')}
            </div>
            <div class="input-group" style="margin-top: 8px;">
              <label class="input-label">سطح هوشیاری</label>
              <select id="t_conscious" class="input-field">
                <option value="alert">هوشیار (Alert)</option>
                <option value="voice">پاسخ به صدا (Voice)</option>
                <option value="pain">پاسخ به درد (Pain)</option>
                <option value="unresponsive">بدون پاسخ (Unresponsive)</option>
              </select>
            </div>
          </div>
        </div>

        <div class="triage-card" style="margin-top: 16px; text-align: center;">
          <div class="triage-title" style="justify-content: center;">🎯 پیشنهاد سیستمی</div>
          <div id="t_esi_display" style="font-size: 24px; font-weight: 900; color: var(--kx-text-2);">لطفاً علائم حیاتی را وارد کنید</div>
          <button id="t_submit" class="btn-primary" onclick="NABZ._edSubmitTriage()">✅ ثبت تریاژ و تخصیص زون</button>
        </div>
      </div>
    `;

    // Auto-calculate ESI logic (Simplified Superhuman heuristic)
    ['t_hr', 't_sbp', 't_spo2', 't_rr', 't_temp', 't_gcs'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', calculateEsi);
    });
  }

  function calculateEsi() {
    const gcs = parseInt(document.getElementById('t_gcs')?.value) || 15;
    const spo2 = parseInt(document.getElementById('t_spo2')?.value) || 100;
    const sbp = parseInt(document.getElementById('t_sbp')?.value) || 120;
    const rr = parseInt(document.getElementById('t_rr')?.value) || 16;
    
    let esi = 3; // Default
    if (gcs < 14 || spo2 < 90 || sbp < 90 || rr > 24 || rr < 10) esi = 2;
    if (gcs <= 8 || spo2 < 85 || sbp < 70) esi = 1;
    
    const colors = { 1: '#dc2626', 2: '#ea580c', 3: '#eab308', 4: '#16a34a', 5: '#3b82f6' };
    const labels = { 1: 'سطح ۱ (احیا - فوری)', 2: 'سطح ۲ (اورژانس)', 3: 'سطح ۳ (فوری)', 4: 'سطح ۴ (نیمه‌فوری)', 5: 'سطح ۵ (غیرفوری)' };
    
    const display = document.getElementById('t_esi_display');
    if (display) {
      display.innerHTML = `<span class="esi-badge" style="background:${colors[esi]}">${esi}</span> <span style="font-size:16px; color:${colors[esi]}">${labels[esi]}</span>`;
    }
    state.formData.suggestedEsi = esi;
  }

  window.NABZ = window.NABZ || {};
  window.NABZ._edSubmitTriage = async function() {
    const btn = document.getElementById('t_submit');
    btn.disabled = true;
    btn.innerText = '⏳ در حال ثبت...';

    const visitId = state.patientId;
    if (!visitId) {
      alert('ویزیت انتخاب نشده');
      btn.disabled = false; btn.innerText = '✅ ثبت تریاژ';
      return;
    }

    const v = state.visit || null;
    const actualPid = v && v.patientId ? v.patientId : null;

    const vitalsPayload = {
      hr: document.getElementById('t_hr').value || null,
      bp_sys: document.getElementById('t_sbp').value || null,
      bp_dia: document.getElementById('t_dbp').value || null,
      rr: document.getElementById('t_rr').value || null,
      spo2: document.getElementById('t_spo2').value || null,
      temp: document.getElementById('t_temp').value || null,
      gcs: document.getElementById('t_gcs').value || null,
      pain: document.getElementById('t_pain').value || null,
      onOxygen: false,
      consciousness: document.getElementById('t_conscious') ? document.getElementById('t_conscious').value : null
    };

    try {
      // 1) Best-effort vitals — never blocks triage submission
      if (actualPid) {
        try {
          await apiCall('/api/ed/vitals', { method: 'POST', body: JSON.stringify(Object.assign({ patientId: actualPid, visitId }, vitalsPayload)) });
        } catch (ve) {
          try { await apiCall('/api/clinical/vitals', { method: 'POST', body: JSON.stringify(Object.assign({ patientId: actualPid }, vitalsPayload)) }); }
          catch (ve2) { console.warn('[triage] vitals skipped:', ve2.message); }
        }
      }

      // 2) Triage submit — required
      await apiCall('/api/emergency/visits/' + encodeURIComponent(visitId) + '/triage', {
        method: 'POST',
        body: JSON.stringify({
          esiLevel: (state.formData && state.formData.suggestedEsi) || 3,
          chiefComplaint: document.getElementById('t_cc').value,
          arrivalMode: document.getElementById('t_mode').value,
          vitals: vitalsPayload
        })
      });

      if (typeof NABZ._toast === 'function') NABZ._toast('✅ تریاژ ثبت شد');
      else alert('✅ تریاژ ثبت شد');

      // 3) Return to worklist cleanly
      state.patientId = null;
      state.visit = null;
      state.formData = {};
      if (typeof NABZ.show === 'function') { window.NABZ_NAV ? window.NABZ_NAV.go("ed/triage") : NABZ.show("ed_triage"); }
      else if (typeof renderWorklist === 'function') { renderWorklist(); }
    } catch (e) {
      console.error('[ED Triage Error]', e);
      alert('خطا در ثبت تریاژ: ' + (e.message || e));
      btn.disabled = false;
      btn.innerText = '✅ ثبت تریاژ و تخصیص زون';
    }
  };


  async function renderWorklist() {
    var host = document.getElementById('content');
    if (!host) return;
    host.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b;direction:rtl">در حال بارگذاری صف تریاژ...</div>';
    try {
      var res = await apiCall('/api/emergency/board');
      var rows = (res.rows || []).filter(function(r){ return r.status === 'waiting_triage'; });
      var h = '<div style="direction:rtl;padding:14px;background:#f8fafc;min-height:100vh">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">';
      h += '<div style="font-size:17px;font-weight:900;color:#1e40af">🩺 صف تریاژ</div>';
      h += '<button onclick="NABZ.show(\'ed_triage\')" style="padding:6px 12px;border-radius:8px;border:none;background:#dbeafe;color:#1e40af;font-weight:700;font-size:11px;cursor:pointer">⟳ بروزرسانی</button>';
      h += '</div>';
      if (!rows.length) {
        h += '<div style="background:#fff;padding:40px;border-radius:12px;text-align:center;color:#64748b;border:1px solid #e2e8f0">';
        h += '<div style="font-size:40px;margin-bottom:12px">✅</div>';
        h += '<div style="font-weight:700">صف تریاژ خالی است</div>';
        h += '</div>';
      } else {
        h += '<div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">';
        rows.forEach(function(r) {
          var newsCls = r.news2
            ? (r.news2.risk === 'critical' ? 'background:#fee2e2;color:#991b1b'
              : r.news2.risk === 'high' ? 'background:#fed7aa;color:#9a3412'
              : 'background:#f1f5f9;color:#334155')
            : 'background:#f1f5f9;color:#64748b';
          h += '<div onclick="NABZ._edTriagePick(\'' + r.id + '\')" style="padding:12px 14px;border-bottom:1px solid #e2e8f0;cursor:pointer;display:flex;align-items:center;gap:10px">';
          h += '<div style="width:40px;height:40px;border-radius:10px;background:#dc2626;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px">🚑</div>';
          h += '<div style="flex:1;min-width:0">';
          h += '<div style="font-weight:800;font-size:13px;color:#0f172a">' + (r.patientName || '—') + '</div>';
          h += '<div style="font-size:11px;color:#64748b;margin-top:2px">' + (r.chiefComplaint || '—') + '</div>';
          h += '<div style="margin-top:4px">';
          if (r.news2) h += '<span style="font-size:10px;padding:2px 8px;border-radius:8px;font-weight:700;' + newsCls + '">NEWS ' + r.news2.total + '</span> ';
          h += '<span style="font-size:10px;color:#94a3b8">⏱ ' + (r.minutesSinceArrival || 0) + ' دقیقه</span>';
          h += '</div></div>';
          h += '<button onclick="event.stopPropagation();NABZ._edTriagePick(\'' + r.id + '\')" style="padding:8px 14px;border-radius:8px;border:none;background:#dc2626;color:#fff;font-weight:700;font-size:11px;cursor:pointer">تریاژ</button>';
          h += '</div>';
        });
        h += '</div>';
      }
      h += '</div>';
      host.innerHTML = h;
    } catch(e) {
      host.innerHTML = '<div style="padding:40px;text-align:center;color:#dc2626;direction:rtl">خطا: ' + (e.message || e) + '</div>';
    }
  }

  async function renderPicker() {
    document.getElementById('content').innerHTML = '<div style="text-align:center;padding:40px">در حال بارگذاری بیماران...</div>';
    try {
      var res = await apiCall('/api/emergency/visits');
      var items = (res.items || res || []).filter(function(v){ return !['closed','discharged'].includes(v.status); });
      var h = '<div style="direction:rtl;padding:16px"><div style="font-size:15px;font-weight:900;margin-bottom:12px">👤 انتخاب بیمار</div>';
      if (!items.length) h += '<div style="padding:20px;color:#64748b">بیمار فعالی در اورژانس نیست</div>';
      items.forEach(function(v){
        h += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:8px;cursor:pointer" onclick="NABZ._edTriagePick(\'' + v.id + '\')">';
        h += '<b>' + (v.patientName || v.id) + '</b><div style="font-size:11px;color:#64748b">' + (v.chiefComplaint || '') + ' · ESI ' + (v.esiLevel || '?') + ' · ' + (v.status || '') + '</div></div>';
      });
      h += '</div>';
      document.getElementById('content').innerHTML = h;
    } catch(e) { console.error("[ED UI Error]", e);  document.getElementById('content').innerHTML = '<div style="color:#dc2626;padding:20px">خطا: ' + e.message + '</div>'; }
  }
  window.NABZ._edTriagePick = async function(pid) {
    state.patientId = pid;
    try {
      const r = await apiCall('/api/emergency/visits');
      const v = (r && ((r.data && r.data.rows) || r.rows || r.visits || r)) || [];
      const arr = Array.isArray(v) ? v : (v.visits || []);
      state.visit = arr.find(x => x.id == pid) || null;
    } catch (_) { state.visit = null; }
    show();
  };;
  if (typeof NABZ !== 'undefined' && typeof NABZ.registerKind === 'function') {
    NABZ.registerKind('ed_triage', show);
  }
})();
