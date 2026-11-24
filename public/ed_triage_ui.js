// public/ed_triage_ui.js — Superhuman ED Triage (Vanilla JS)
(function() {
  'use strict';
  async function apiCall(url, opts = {}) {
    if (typeof NABZ !== 'undefined' && typeof NABZ._api === 'function') return NABZ._api(url, opts);
    const res = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, ...opts });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || err.message || res.statusText); }
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
      .input-field { width: 100%; padding: 10px; border: 1.5px solid var(--kx-border, #e2e8f0); border-radius: 8px; font-size: 14px; box-sizing: border-box; }
      .input-field:focus { outline: none; border-color: var(--kx-primary, #1e40af); }
      .vitals-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
      @media (min-width: 480px) { .vitals-grid { grid-template-columns: repeat(3, 1fr); } }
      .chip-container { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
      .chip { padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; background: var(--kx-surface-2, #f1f5f9); color: var(--kx-text, #0f172a); border: 1px solid transparent; cursor: pointer; }
      .chip:hover { background: var(--kx-primary-soft, #e0e7ff); color: var(--kx-primary, #1e40af); }
      .btn-primary { width: 100%; padding: 14px; background: var(--kx-primary, #1e40af); color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 800; cursor: pointer; margin-top: 16px; }
      .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
      .btn-ghost { padding: 8px 16px; border-radius: 8px; border: 1px solid var(--kx-border, #e2e8f0); background: #fff; color: #475569; font-weight: 700; font-size: 12px; cursor: pointer; }
    `;
    document.head.appendChild(st);
  }

  const state = { patientId: null, visit: null, formData: {} };

  function _esiColorTri(l) { return { 1: '#dc2626', 2: '#ea580c', 3: '#ca8a04', 4: '#16a34a', 5: '#0284c7' }[l] || '#64748b'; }
  
  function _renderPatientBannerTriage(ctx) {
    if (!ctx) return '<div style="background:#fee2e2;color:#991b1b;padding:12px;border-radius:8px;margin-bottom:12px;font-weight:700">⚠️ اطلاعات بیمار بارگذاری نشد</div>';
    const esi = ctx.esiLevel;
    const esiCol = _esiColorTri(esi);
    const safe = (s) => String(s == null ? '—' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const arrival = ctx.arrivalAt ? (() => { try { return new Date(ctx.arrivalAt).toLocaleString('fa-IR', { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' }); } catch(_) { return '—'; } })() : '—';
    let h = '<div style="background:linear-gradient(135deg,#7f1d1d 0%,#0f172a 100%);color:#fff;padding:14px;border-radius:14px;margin-bottom:12px;direction:rtl;box-shadow:0 4px 14px rgba(0,0,0,.15)">';
    h += '<div style="display:flex;justify-content:space-between;gap:10px">';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:18px;font-weight:900">' + safe(ctx.patientName || ctx.name || 'بیمار ناشناس') + '</div>';
    h += '<div style="font-size:12px;opacity:.85;margin-top:4px">' + safe(ctx.sex || '—') + ' · ' + safe(ctx.ageLabel || '—') + (ctx.mrn && ctx.mrn !== '—' ? ' · MRN: ' + safe(ctx.mrn) : '') + '</div>';
    h += '<div style="font-size:12px;opacity:.85;margin-top:2px"> 📋 ' + safe(ctx.chiefComplaint || 'ثبت نشده') + '</div>';
    h += '<div style="font-size:11px;opacity:.75;margin-top:4px"> 🕒 ' + safe(arrival) + '</div>';
    h += '</div>';
    h += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">';
    if (esi != null) h += '<div style="background:' + esiCol + ';color:#fff;padding:8px 14px;border-radius:12px;font-weight:900;font-size:18px">ESI ' + esi + '</div>';
    else h += '<div style="background:#ea580c;color:#fff;padding:6px 12px;border-radius:10px;font-weight:800;font-size:12px">در انتظار تریاژ</div>';
    h += '<div style="font-size:11px;opacity:.85">🛏 ' + safe(ctx.bedCode || '—') + '</div>';
    h += '</div></div>';
    if (ctx.hasAllergies && ctx.allergies && ctx.allergies.length) h += '<div style="background:#dc2626;padding:6px 10px;border-radius:8px;margin-top:8px;font-weight:800;font-size:12px">⚠️ حساسیت: ' + ctx.allergies.map(safe).join('، ') + '</div>';
    h += '</div>';
    return h;
  }

  async function show() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlPid = urlParams.get('visitId') || urlParams.get('patientId');
    if (urlPid && urlPid !== 'undefined' && urlPid !== 'null') state.patientId = urlPid;
    
    if (!state.patientId) { renderWorklist(); return; }

    // اگر visit لود نشده، سعی کن لود کنی
    if (!state.visit && state.patientId) {
      try {
        const res = await apiCall('/api/emergency/visits');
        const arr = Array.isArray(res) ? res : (res.visits || res.rows || res.data || []);
        state.visit = arr.find(x => x.id == state.patientId || x.patientId == state.patientId) || null;
      } catch(e) { console.warn('Failed to load visit details', e); }
    }

    const v = state.visit || {};
    const displayName = v.patientName || v.name || 'بیمار انتخاب شده';

    document.getElementById('content').innerHTML = `
      <div class="triage-wrap">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div class="triage-title" style="margin:0">🚑 تریاژ: ${displayName}</div>
          <button class="btn-ghost" onclick="NABZ._edTriageReturn()">⟵ بازگشت به صف</button>
        </div>
        ${_renderPatientBannerTriage(v)}
        <div class="triage-grid">
          <div class="triage-card">
            <div class="triage-title">📝 اطلاعات تریاژ</div>
            <div class="input-group">
              <label class="input-label">شکایت اصلی (Chief Complaint)</label>
              <input id="t_cc" class="input-field" value="${v.chiefComplaint || ''}" placeholder="مثلاً: درد قفسه سینه" />
              <div class="chip-container">
                ${['درد قفسه سینه', 'تنگی نفس', 'درد شکم', 'تروما', 'تب', 'کاهش هوشیاری'].map(c =>
                  `<span class="chip" onclick="document.getElementById('t_cc').value='${c}'">${c}</span>`
                ).join('')}
              </div>
            </div>
            <div class="input-group">
              <label class="input-label">نحوه مراجعه</label>
              <select id="t_mode" class="input-field">
                <option value="walk" ${v.arrivalMode==='walk'?'selected':''}>مراجعه شخصی</option>
                <option value="ems" ${v.arrivalMode==='ems'?'selected':''}>آمبولانس (EMS)</option>
                <option value="referral" ${v.arrivalMode==='referral'?'selected':''}>ارجاعی</option>
              </select>
            </div>
          </div>

          <div class="triage-card">
            <div class="triage-title">📊 علائم حیاتی اولیه</div>
            <div class="vitals-grid">
              ${[
                {id: 't_hr', label: 'نبض (HR)', val: v.hr},
                {id: 't_sbp', label: 'فشار سیستول', val: v.sbp},
                {id: 't_dbp', label: 'فشار دیاستول', val: v.dbp},
                {id: 't_rr', label: 'تنفس (RR)', val: v.rr},
                {id: 't_spo2', label: 'SpO2 %', val: v.spo2},
                {id: 't_temp', label: 'دما (°C)', val: v.temp},
                {id: 't_gcs', label: 'GCS', val: v.gcs},
                {id: 't_pain', label: 'درد (0-10)', val: v.pain}
              ].map(vf => `
                <div class="input-group">
                  <label class="input-label">${vf.label}</label>
                  <input id="${vf.id}" type="number" inputmode="decimal" class="input-field" value="${vf.val || ''}" />
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="triage-card" style="margin-top: 16px; text-align: center;">
          <div class="triage-title" style="justify-content: center;">🎯 پیشنهاد سیستمی ESI</div>
          <div id="t_esi_display" style="font-size: 24px; font-weight: 900; color: var(--kx-text-2);">لطفاً علائم حیاتی را وارد کنید</div>
          <button id="t_submit" class="btn-primary" onclick="NABZ._edSubmitTriage()">✅ ثبت تریاژ و تخصیص زون</button>
        </div>
      </div>
    `;

    ['t_hr', 't_sbp', 't_spo2', 't_rr', 't_temp', 't_gcs'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', calculateEsi);
    });
    calculateEsi(); // محاسبه اولیه
  }

  function calculateEsi() {
    const gcs = parseInt(document.getElementById('t_gcs')?.value) || 15;
    const spo2 = parseInt(document.getElementById('t_spo2')?.value) || 100;
    const sbp = parseInt(document.getElementById('t_sbp')?.value) || 120;
    const rr = parseInt(document.getElementById('t_rr')?.value) || 16;

    let esi = 3;
    if (gcs < 14 || spo2 < 90 || sbp < 90 || rr > 24 || rr < 10) esi = 2;
    if (gcs <= 8 || spo2 < 85 || sbp < 70) esi = 1;

    const colors = { 1: '#dc2626', 2: '#ea580c', 3: '#eab308', 4: '#16a34a', 5: '#3b82f6' };
    const labels = { 1: 'سطح ۱ (احیا - فوری)', 2: 'سطح ۲ (اورژانس)', 3: 'سطح ۳ (فوری)', 4: 'سطح ۴ (نیمه‌فوری)', 5: 'سطح ۵ (غیرفوری)' };

    const display = document.getElementById('t_esi_display');
    if (display) {
      display.innerHTML = `<span class="esi-badge" style="background:${colors[esi]};display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;color:#fff;font-size:16px;font-weight:900;vertical-align:middle;margin-left:8px">${esi}</span> <span style="font-size:16px; color:${colors[esi]}">${labels[esi]}</span>`;
    }
    state.formData.suggestedEsi = esi;
  }

  window.NABZ = window.NABZ || {};
  
  // تابع جهانی برای بازگشت به صف (رفع باگ scope)
  window.NABZ._edTriageReturn = function() {
    state.patientId = null;
    state.visit = null;
    state.formData = {};
    renderWorklist();
  };

  window.NABZ._edSubmitTriage = async function() {
    const btn = document.getElementById('t_submit');
    btn.disabled = true; btn.innerText = '⏳ در حال ثبت...';
    const visitId = state.patientId; // در اینجا patientId در واقع visitId است

    try {
      const vitalsPayload = {
        hr: document.getElementById('t_hr').value || null,
        bp_sys: document.getElementById('t_sbp').value || null,
        bp_dia: document.getElementById('t_dbp').value || null,
        rr: document.getElementById('t_rr').value || null,
        spo2: document.getElementById('t_spo2').value || null,
        temp: document.getElementById('t_temp').value || null,
        gcs: document.getElementById('t_gcs').value || null,
        pain: document.getElementById('t_pain').value || null,
        consciousness: 'alert'
      };

      await apiCall('/api/emergency/visits/' + encodeURIComponent(visitId) + '/triage', {
        method: 'POST',
        body: JSON.stringify({
          esiLevel: state.formData.suggestedEsi || 3,
          chiefComplaint: document.getElementById('t_cc').value,
          arrivalMode: document.getElementById('t_mode').value,
          vitals: vitalsPayload
        })
      });

      if (typeof NABZ._toast === 'function') NABZ._toast('✅ تریاژ با موفقیت ثبت شد');
      else alert('✅ تریاژ ثبت شد');

      window.NABZ._edTriageReturn();
    } catch (e) {
      console.error('[ED Triage Error]', e);
      alert('خطا در ثبت تریاژ: ' + (e.message || e));
      btn.disabled = false; btn.innerText = '✅ ثبت تریاژ و تخصیص زون';
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
      h += '<div style="font-size:17px;font-weight:900;color:#1e40af">🩺 صف تریاژ (' + rows.length + ' بیمار)</div>';
      h += '<button onclick="NABZ.show(\'ed_triage\')" style="padding:6px 12px;border-radius:8px;border:none;background:#dbeafe;color:#1e40af;font-weight:700;font-size:11px;cursor:pointer">⟳ بروزرسانی</button>';
      h += '</div>';
      if (!rows.length) {
        h += '<div style="background:#fff;padding:40px;border-radius:12px;text-align:center;color:#64748b;border:1px solid #e2e8f0">';
        h += '<div style="font-size:40px;margin-bottom:12px">✅</div><div style="font-weight:700">صف تریاژ خالی است</div></div>';
      } else {
        h += '<div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">';
        rows.forEach(function(r) {
          var newsCls = r.news2 ? (r.news2.risk === 'critical' ? 'background:#fee2e2;color:#991b1b' : r.news2.risk === 'high' ? 'background:#fed7aa;color:#9a3412' : 'background:#f1f5f9;color:#334155') : 'background:#f1f5f9;color:#64748b';
          h += '<div onclick="NABZ._edTriagePick(\'' + r.id + '\')" style="padding:12px 14px;border-bottom:1px solid #e2e8f0;cursor:pointer;display:flex;align-items:center;gap:10px">';
          h += '<div style="width:40px;height:40px;border-radius:10px;background:#dc2626;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px">🚑</div>';
          h += '<div style="flex:1;min-width:0">';
          h += '<div style="font-weight:800;font-size:13px;color:#0f172a">' + (r.patientName || 'ناشناس') + '</div>';
          h += '<div style="font-size:11px;color:#64748b;margin-top:2px">' + (r.chiefComplaint || 'بدون شکایت ثبت شده') + '</div>';
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

  window.NABZ._edTriagePick = async function(visitId) {
    state.patientId = visitId;
    state.visit = null; // ریست برای لود مجدد
    show();
  }

// Triage UI helpers — inserted by patch script
window.NABZ._triRegisterNewPatient = function() {
  var html = "<div id='tri_reg_bg' style='position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:flex-end;justify-content:center'>" +
    "<div style='background:#fff;width:100%;max-width:560px;border-radius:20px 20px 0 0;padding:18px;direction:rtl;max-height:90vh;overflow-y:auto'>" +
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:14px'>" +
    "<div style='font-weight:900;font-size:16px'>+ ورود بیمار جدید</div>" +
    "<button onclick=\"document.getElementById('tri_reg_bg').remove()\" style='background:#f1f5f9;border:none;border-radius:8px;padding:6px 10px;font-size:14px;cursor:pointer'>✕</button>" +
    "</div>" +
    "<div style='margin-bottom:10px'><label style='font-size:12px;font-weight:800;display:block;margin-bottom:4px'>نام و نام خانوادگی <span style='color:#dc2626'>*</span></label><input id='tri_reg_name' type='text' placeholder='مثلاً: رضا محمدی' style='width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box'></div>" +
    "<div style='display:flex;gap:8px;margin-bottom:10px'>" +
    "<div style='flex:1'><label style='font-size:12px;font-weight:800;display:block;margin-bottom:4px'>سن</label><input id='tri_reg_age' type='number' style='width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box'></div>" +
    "<div style='flex:1'><label style='font-size:12px;font-weight:800;display:block;margin-bottom:4px'>جنس</label><select id='tri_reg_sex' style='width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box'><option value='M'>مرد</option><option value='F'>زن</option></select></div>" +
    "</div>" +
    "<div style='margin-bottom:10px'><label style='font-size:12px;font-weight:800;display:block;margin-bottom:4px'>MRN (اختیاری)</label><input id='tri_reg_mrn' type='text' placeholder='خودکار' style='width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box'></div>" +
    "<div style='margin-bottom:10px'><label style='font-size:12px;font-weight:800;display:block;margin-bottom:4px'>شکایت اصلی</label><input id='tri_reg_cc' type='text' style='width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box'></div>" +
    "<div style='margin-bottom:10px'><label style='font-size:12px;font-weight:800;display:block;margin-bottom:4px'>حساسیت دارویی</label><input id='tri_reg_allergies' type='text' placeholder='با کاما جدا کن' style='width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box'></div>" +
    "<div style='margin-bottom:12px'><label style='font-size:12px;font-weight:800;display:block;margin-bottom:4px'>نحوه مراجعه</label><select id='tri_reg_mode' style='width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box'><option value='walk-in'>شخصی</option><option value='ambulance'>آمبولانس</option><option value='transfer'>اعزام</option></select></div>" +
    "<button onclick=\"NABZ._triSubmitNewPatient()\" style='width:100%;padding:14px;border:none;border-radius:12px;background:#059669;color:#fff;font-weight:900;font-size:15px;cursor:pointer'>ثبت و ادامه به تریاژ</button>" +
    "</div></div>";
  var wrap = document.createElement("div");
  wrap.innerHTML = html;
  document.body.appendChild(wrap.firstChild);
  setTimeout(function() { var el = document.getElementById("tri_reg_name"); if (el) el.focus(); }, 100);
};

window.NABZ._triSubmitNewPatient = async function() {
  var g = function(id) { var e = document.getElementById(id); return e ? e.value : ""; };
  var name = g("tri_reg_name").trim();
  if (!name) { alert("نام الزامی است"); return; }
  var payload = {
    name: name,
    age: g("tri_reg_age") || null,
    sex: g("tri_reg_sex"),
    mrn: g("tri_reg_mrn") || null,
    chiefComplaint: g("tri_reg_cc") || "—",
    allergies: g("tri_reg_allergies") || null,
    arrivalMode: g("tri_reg_mode")
  };
  try {
    var r = await apiCall("/api/emergency/patients/register", { method: "POST", body: JSON.stringify(payload) });
    var data = (r && r.data) ? r.data : r;
    var visitId = data.visitId || (data.visit && data.visit.id);
    var bg = document.getElementById("tri_reg_bg"); if (bg) bg.remove();
    if (window.NABZ._toast) NABZ._toast("✅ بیمار ثبت شد");
    if (visitId) { state.patientId = visitId; state.visit = data.visit || null; show(); }
    else if (typeof renderWorklist === "function") { renderWorklist(); }
  } catch (e) { alert("❌ خطا: " + (e.message || e)); }
};
;

  if (typeof NABZ !== 'undefined' && typeof NABZ.registerKind === 'function') {
    NABZ.registerKind('ed_triage', show);
  }
})();
