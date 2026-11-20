// public/ed_nursing_ui.js — Superhuman Nursing Workspace
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

  if (!document.getElementById('ed-nursing-style')) {
    const st = document.createElement('style');
    st.id = 'ed-nursing-style';
    st.textContent = `
      .nursing-wrap { direction: rtl; font-family: 'Vazirmatn', Tahoma, sans-serif; background: var(--kx-bg, #f8fafc); min-height: 100vh; padding: 16px; }
      .nursing-header { background: var(--kx-surface, #fff); padding: 16px; border-radius: 12px; margin-bottom: 16px; border-left: 6px solid var(--kx-primary, #1e40af); display: flex; justify-content: space-between; align-items: center; }
      .nursing-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
      @media (min-width: 1024px) { .nursing-grid { grid-template-columns: 2fr 1fr; } }
      .n-card { background: var(--kx-surface, #fff); border-radius: 12px; padding: 16px; border: 1px solid var(--kx-border, #e2e8f0); }
      .n-title { font-size: 14px; font-weight: 800; margin-bottom: 12px; color: var(--kx-text, #0f172a); border-bottom: 1px solid var(--kx-border, #e2e8f0); padding-bottom: 8px; }
      .mar-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--kx-surface-2, #f8fafc); border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--kx-border, #e2e8f0); }
      .mar-btn { padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; border: none; cursor: pointer; margin-right: 4px; }
      .mar-btn.give { background: #dcfce7; color: #166534; }
      .mar-btn.hold { background: #fee2e2; color: #991b1b; }
      .vitals-quick-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .v-input { width: 100%; padding: 8px; border: 1px solid var(--kx-border, #e2e8f0); border-radius: 6px; text-align: center; font-size: 16px; font-weight: 700; }
    `;
    document.head.appendChild(st);
  }

  let state = { patientId: null, data: null };

  async function show() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlVid = urlParams.get('visitId');
    const urlPid = urlParams.get('patientId');
    if (urlVid && urlVid !== 'undefined' && urlVid !== 'null') state.patientId = urlVid;
    else if (urlPid && urlPid !== 'undefined' && urlPid !== 'null') state.patientId = urlPid;

    if (!state.patientId) { renderWorklist(); return; }
    document.getElementById('content').innerHTML = '<div style="text-align:center;padding:40px">در حال بارگذاری...</div>';

    try {
      const res = await apiCall('/api/ed/nursing_dashboard?visitId=' + encodeURIComponent(state.patientId));
      let data = res;
      if (data && typeof data === 'object' && !data.visit && !data.patient) {
        if (data.data && (data.data.visit || data.data.patient)) data = data.data;
        else if (data.payload && (data.payload.visit || data.payload.patient)) data = data.payload;
      }
      if (!data || typeof data !== 'object') data = {};

      state.data = data;
      const visit = data.visit || data.patient;

      if (!visit) {
        console.error('[NABZ] nursing_dashboard — visit not found. Raw response:', res);
        const errCode = data.error || 'unknown';
        const searched = data.searchedId || state.patientId;
        const total = data.totalVisits != null ? data.totalVisits : '?';
        const samples = Array.isArray(data.sampleIds) ? data.sampleIds : [];
        const patientFound = data.patientFound;

        let errBody = '<div style="padding:24px;text-align:center;direction:rtl">';
        errBody += '<div style="color:#dc2626;font-size:16px;font-weight:800;margin-bottom:8px">❌ پرونده باز نشد</div>';
        errBody += '<div style="color:#64748b;font-size:12px;margin-bottom:2px">شناسه ارسالی: <b>' + searched + '</b></div>';
        errBody += '<div style="color:#64748b;font-size:12px;margin-bottom:2px">کد: ' + errCode + '</div>';
        if (patientFound) errBody += '<div style="color:#0891b2;font-size:12px;margin-bottom:2px">بیمار یافت شد: ' + patientFound.name + '</div>';
        errBody += '<div style="color:#64748b;font-size:12px;margin-bottom:16px">ویزیت‌های موجود: ' + total + '</div>';

        if (samples.length > 0) {
          errBody += '<div style="background:#f8fafc;border-radius:12px;padding:12px;margin:0 auto 16px;max-width:520px;text-align:right">';
          errBody += '<div style="font-weight:800;font-size:13px;margin-bottom:8px">یکی از ویزیت‌های فعال را انتخاب کن:</div>';
          samples.forEach(s => {
            if (['closed','discharged','departed','transferred'].includes(s.status)) return;
            errBody += '<button onclick="NABZ._edNursingPick(\'' + s.id + '\')" style="display:block;width:100%;text-align:right;padding:10px;margin-bottom:6px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;cursor:pointer">';
            errBody += '<b>' + (s.name || '—') + '</b> <span style="color:#64748b;font-size:11px">(' + s.status + ')</span>';
            errBody += '<div style="color:#94a3b8;font-size:10px;margin-top:2px">' + s.id + '</div>';
            errBody += '</button>';
          });
          errBody += '</div>';
        }

        errBody += '<button onclick="NABZ.show(\'ed_nursing\')" style="padding:10px 20px;background:#0f172a;color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer">بازگشت به صف</button>';
        errBody += '</div>';
        document.getElementById('content').innerHTML = errBody;
        return;
      }

      render();
    } catch(e) {
      console.error("[ED UI Error]", e);
      document.getElementById('content').innerHTML = '<div style="color:red;padding:20px">خطا: ' + e.message + '</div>';
    }
  }

  function _esiColor(l) {
    return { 1: '#dc2626', 2: '#ea580c', 3: '#ca8a04', 4: '#16a34a', 5: '#0284c7' }[l] || '#64748b';
  }
  function _renderPatientBanner(ctx) {
    if (!ctx) return '';
    const esi = ctx.esiLevel;
    const esiCol = _esiColor(esi);
    const safe = (s) => String(s == null ? '—' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const arrival = ctx.arrivalAt ? (() => { try { return new Date(ctx.arrivalAt).toLocaleString('fa-IR', { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' }); } catch(_) { return '—'; } })() : '—';
    let h = '<div style="background:linear-gradient(135deg,#0f172a 0%,#334155 100%);color:#fff;padding:16px;border-radius:16px;margin-bottom:14px;direction:rtl;box-shadow:0 4px 14px rgba(0,0,0,.15)">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:20px;font-weight:900;line-height:1.2">' + safe(ctx.name) + '</div>';
    h += '<div style="font-size:12px;opacity:.85;margin-top:6px">';
    h += '<span>' + safe(ctx.sex) + '</span> · <span>' + safe(ctx.ageLabel) + '</span>';
    if (ctx.mrn && ctx.mrn !== '—') h += ' · <span>MRN: ' + safe(ctx.mrn) + '</span>';
    if (ctx.bloodType && ctx.bloodType !== '—') h += ' · <span>گروه خون: ' + safe(ctx.bloodType) + '</span>';
    h += '</div>';
    h += '<div style="font-size:12px;opacity:.85;margin-top:4px">📋 شکایت: ' + safe(ctx.chiefComplaint) + '</div>';
    h += '<div style="font-size:12px;opacity:.75;margin-top:4px">🕒 ورود: ' + safe(arrival) + (ctx.arrivalMode && ctx.arrivalMode !== '—' ? ' · ' + safe(ctx.arrivalMode) : '') + '</div>';
    h += '</div>';
    h += '<div style="text-align:left;display:flex;flex-direction:column;gap:6px;align-items:flex-end">';
    if (esi != null) h += '<div style="background:' + esiCol + ';color:#fff;padding:10px 16px;border-radius:14px;font-weight:900;font-size:22px;line-height:1;min-width:56px;text-align:center">ESI<br><span style="font-size:22px">' + esi + '</span></div>';
    h += '<div style="font-size:11px;opacity:.85;background:rgba(255,255,255,.12);padding:4px 10px;border-radius:8px">🛏 ' + safe(ctx.bedCode) + '</div>';
    h += '<div style="font-size:11px;opacity:.75">📍 ' + safe(ctx.zone) + '</div>';
    h += '</div>';
    h += '</div>';
    if (ctx.hasAllergies) {
      h += '<div style="background:#dc2626;padding:8px 12px;border-radius:10px;margin-top:10px;font-weight:800;font-size:13px">⚠️ حساسیت دارویی: ' + ctx.allergies.map(safe).join('، ') + '</div>';
    }
    if (ctx.isolation) h += '<div style="background:#7c3aed;padding:6px 12px;border-radius:10px;margin-top:6px;font-weight:800;font-size:12px">🧪 ایزوله: ' + safe(ctx.isolation) + '</div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;font-size:11px;opacity:.8;border-top:1px solid rgba(255,255,255,.15);padding-top:10px">';
    h += '<span>👨‍⚕️ پزشک: ' + safe(ctx.assignedDoctor) + '</span>';
    h += '<span>👩‍⚕️ پرستار: ' + safe(ctx.assignedNurse) + '</span>';
    if (ctx.contact && ctx.contact !== '—') h += '<span>📞 ' + safe(ctx.contact) + '</span>';
    h += '<span>🏥 ' + safe(ctx.status) + '</span>';
    h += '</div>';
    h += '</div>';
    return h;
  }

  function render() {
    const d = state.data || {};
    const p = d.visit || d.patient || {};
    const orders = d.pendingOrders || [];
    const news2 = d.news2 || null;
    
    let h = `<div class="nursing-wrap">`;
    h += _renderPatientBanner(d.patientContext);
    h += `<div class="nursing-header">`;
    h += `<div><div style="font-size:18px;font-weight:900">${p.name || p.patientName || p.fullName || "—"}</div>`;
    h += `<div style="font-size:12px;color:var(--kx-text-2)">ESI: ${p.esiLevel != null ? p.esiLevel : "—"} | تخت: ${p.bedCode || p.bedId || "—"} | ${p.chiefComplaint || "—"}</div></div>`;
    h += `<button class="mar-btn hold" onclick="(window.NABZ_NAV ? window.NABZ_NAV.back() : (window.NABZ && window.NABZ.show ? window.NABZ.show("ed_cc") : null))">بازگشت</button>`;
    h += `</div>`;

    h += `<div class="nursing-grid">`;
    
    // Left: MAR due & history
    h += `<div class="n-card">`;
    h += `<div class="n-title">💊 دستورات دارویی (${(d.mar_due||[]).length} در انتظار)</div>`;
    if (!d.mar_due || d.mar_due.length === 0) {
      h += `<div style="text-align:center;color:var(--kx-text-2);padding:20px">دستور جدیدی در انتظار نیست</div>`;
    } else {
      d.mar_due.forEach(m => {
        const bg = m.isHighAlert ? 'border-color:#dc2626;background:#fef2f2' : (m.isOverdue ? 'border-color:#f59e0b;background:#fffbeb' : '');
        const badge = m.isHighAlert ? '<span style="background:#dc2626;color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:800;margin-left:6px">⚠️ پرخطر</span>' : '';
        const overdue = m.isOverdue ? `<span style="color:#dc2626;font-size:10px;font-weight:800">${m.overdue_min}د تأخیر</span>` : '';
        const sch = m.scheduledAt ? new Date(m.scheduledAt).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}) : '—';
        h += `<div class="mar-item" style="${bg}"><div style="flex:1"><div style="font-weight:800">${m.drugName||m.item||'—'} ${m.dose||''} ${badge}</div><div style="font-size:11px;color:var(--kx-text-2)">${m.route||''} · ${sch} · ${overdue}</div></div><div style="display:flex;gap:4px"><button class="mar-btn give" onclick="NABZ._edMarOpen('${m.id}')">✅ اجرا</button><button class="mar-btn hold" onclick="NABZ._edMarQuickHold('${m.id}')">❌</button></div></div>`;
      });
    }
    h += `</div>`;

    if (d.mar_history && d.mar_history.length > 0) {
      h += `<div class="n-card"><div class="n-title">📜 تاریخچه اخیر (${d.mar_history.length})</div>`;
      d.mar_history.slice(0, 8).forEach(m => {
        const st = m.status === 'given' ? '✅' : m.status === 'refused' ? '🚫' : m.status === 'held' ? '⏸' : '⏰';
        const t = m.administeredAt || m.heldAt || m.refusedAt || m.missedAt;
        const w = t ? new Date(t).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}) : '—';
        h += `<div style="padding:8px;border-bottom:1px solid #f1f5f9;font-size:12px;display:flex;justify-content:space-between"><span>${st} ${m.drugName||'—'} ${m.dose||''}</span><span style="color:#64748b">${w} · ${m.administeredByName||m.heldBy||m.refusedBy||'—'}</span></div>`;
      });
      h += `</div>`;
    }

    // Right: Quick Vitals
    h += `<div class="n-card">`;
    h += `<div class="n-title">📊 ثبت سریع علائم حیاتی</div>`;
    h += `<div class="vitals-quick-grid">`;
    ['hr', 'sbp', 'dbp', 'rr', 'spo2', 'temp'].forEach(k => {
      h += `<div><label style="font-size:10px;font-weight:700;display:block;margin-bottom:4px">${k.toUpperCase()}</label>`;
      h += `<input id="nv_${k}" class="v-input" type="number" inputmode="decimal" /></div>`;
    });
    h += `</div>`;
    h += `<button class="mar-btn give" style="width:100%;margin-top:12px;padding:12px;font-size:14px" onclick="NABZ._edSaveVitals()">💾 ثبت علائم حیاتی</button>`;
    h += `</div>`;

    h += `</div></div>`;
    document.getElementById('content').innerHTML = h;
  }

  window.NABZ = window.NABZ || {};
  window.NABZ._edMarOpen = function(marId) {
    const m = (state.data && state.data.mar_due || []).find(x => x.id === marId);
    if (!m) { alert('MAR یافت نشد'); return; }
    const ha = !!m.isHighAlert;
    const labels = {patient:'بیمار',drug:'دارو',dose:'دوز',route:'مسیر',time:'زمان'};
    const html = `
      <div id="mar_sheet_bg" style="position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center">
        <div style="background:#fff;width:100%;max-width:520px;border-radius:20px 20px 0 0;padding:18px;direction:rtl;max-height:90vh;overflow-y:auto">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div style="font-weight:900;font-size:16px">تأیید اجرای دارو</div>
            <button onclick="document.getElementById('mar_sheet_bg').remove()" style="background:#f1f5f9;border:none;border-radius:8px;padding:6px 10px;font-size:14px;cursor:pointer">✕</button>
          </div>
          <div style="background:${ha?'#fef2f2':'#f8fafc'};border:2px solid ${ha?'#dc2626':'#e2e8f0'};border-radius:12px;padding:12px;margin-bottom:12px">
            <div style="font-weight:800;font-size:14px">${m.drugName||m.item} ${m.dose||''}</div>
            <div style="font-size:12px;color:#64748b">${m.route||''} · ${m.frequency||''}</div>
            ${ha?'<div style="margin-top:6px;color:#dc2626;font-weight:800;font-size:12px">⚠️ داروی پرخطر — تأیید پرستار دوم الزامی</div>':''}
          </div>
          <div style="font-weight:800;font-size:13px;margin-bottom:8px">✅ تأیید حقوق پنج‌گانه</div>
          <div id="mar_rights" style="margin-bottom:12px">
            ${['patient','drug','dose','route','time'].map(k=>`<label style="display:flex;align-items:center;gap:8px;padding:10px;background:#f8fafc;border-radius:8px;margin-bottom:6px;cursor:pointer"><input type="checkbox" data-right="${k}" style="width:18px;height:18px"><span style="font-weight:700">${labels[k]}</span></label>`).join('')}
          </div>
          ${ha?`<div style="margin-bottom:12px"><label style="display:block;font-size:13px;font-weight:800;margin-bottom:6px">پرستار دوم (شاهد)</label><input id="mar_witness" type="text" placeholder="نام کاربری پرستار دوم" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px"></div>`:''}
          <div style="margin-bottom:12px;display:flex;gap:8px">
            <div style="flex:1"><label style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">دوز واقعی</label><input id="mar_dose" type="text" value="${m.dose||''}" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px"></div>
            <div style="flex:1"><label style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">مسیر واقعی</label><input id="mar_route" type="text" value="${m.route||''}" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px"></div>
          </div>
          <div style="margin-bottom:12px">
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;margin-bottom:4px"><input type="checkbox" id="mar_bc1" style="width:16px;height:16px">بارکد بازوی بیمار اسکن شد</label>
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700"><input type="checkbox" id="mar_bc2" style="width:16px;height:16px">بارکد بسته دارو اسکن شد</label>
          </div>
          <button id="mar_submit" style="width:100%;padding:14px;border:none;border-radius:12px;background:#059669;color:#fff;font-weight:900;font-size:15px;cursor:pointer" onclick="NABZ._edMarSubmit('${marId}')">ثبت اجرا</button>
        </div>
      </div>`;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
  };

  window.NABZ._edMarSubmit = async function(marId) {
    const rights = {};
    document.querySelectorAll('#mar_rights input[data-right]').forEach(el => { rights[el.getAttribute('data-right')] = el.checked; });
    if (!Object.values(rights).every(Boolean)) { alert('همه پنج حق باید تأیید شود'); return; }
    const wEl = document.getElementById('mar_witness');
    const payload = {
      action: 'given',
      fiveRights: rights,
      administeredDose: (document.getElementById('mar_dose')||{}).value || null,
      administeredRoute: (document.getElementById('mar_route')||{}).value || null,
      barcodes: { patient: !!(document.getElementById('mar_bc1')||{}).checked, drug: !!(document.getElementById('mar_bc2')||{}).checked },
      witnessId: wEl ? wEl.value.trim() : null
    };
    const btn = document.getElementById('mar_submit');
    btn.disabled = true; btn.innerText = '⏳...';
    try {
      await apiCall('/api/ed/mar/' + encodeURIComponent(marId), { method: 'POST', body: JSON.stringify(payload) });
      const bg = document.getElementById('mar_sheet_bg'); if (bg) bg.remove();
      if (typeof NABZ._toast === 'function') NABZ._toast('✅ ثبت شد');
      show();
    } catch(e) { alert('خطا: ' + (e.message||e)); btn.disabled = false; btn.innerText = 'ثبت اجرا'; }
  };

  window.NABZ._edMarQuickHold = async function(marId) {
    const reason = prompt('دلیل عدم اجرا (۵+ کاراکتر):');
    if (!reason || reason.length < 5) return;
    try { await apiCall('/api/ed/mar/' + encodeURIComponent(marId), { method: 'POST', body: JSON.stringify({ action: 'held', reason }) }); if (typeof NABZ._toast === 'function') NABZ._toast('متوقف شد'); show(); }
    catch(e) { alert('خطا: ' + (e.message||e)); }
  };

  window.NABZ._edMarAction = window.NABZ._edMarOpen;

  window.NABZ._edSaveVitals = async function() {
    try {
      const payload = {
        patientId: state.patientId,
        hr: document.getElementById('nv_hr').value || null,
        sbp: document.getElementById('nv_sbp').value || null,
        dbp: document.getElementById('nv_dbp').value || null,
        rr: document.getElementById('nv_rr').value || null,
        spo2: document.getElementById('nv_spo2').value || null,
        temp: document.getElementById('nv_temp').value || null
      };
      await apiCall('/api/ed/vitals', { method: 'POST', body: JSON.stringify(payload) });
      if (typeof NABZ._toast === 'function') NABZ._toast('✅ علائم حیاتی ثبت شد');
      // Clear inputs
      ['hr', 'sbp', 'dbp', 'rr', 'spo2', 'temp'].forEach(k => document.getElementById(`nv_${k}`).value = '');
    } catch(e) { console.error("[ED UI Error]", e); 
      alert('خطا: ' + e.message);
    }
  };


  async function renderWorklist() {
    var host = document.getElementById('content');
    if (!host) return;
    host.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b;direction:rtl">در حال بارگذاری فضای کار...</div>';
    try {
      var res = await apiCall('/api/emergency/board');
      var all = res.rows || [];
      var groups = {
        in_treatment: { label: '💉 در حال درمان', items: all.filter(function(r){ return r.status === 'in_treatment'; }) },
        observation: { label: '👁️ تحت مشاهده', items: all.filter(function(r){ return r.status === 'observation'; }) },
        boarding: { label: '🛏️ منتظر پذیرش', items: all.filter(function(r){ return r.status === 'boarding'; }) }
      };
      var h = '<div style="direction:rtl;padding:14px;background:#f8fafc;min-height:100vh">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">';
      h += '<div style="font-size:17px;font-weight:900;color:#059669">💉 فضای کار پرستاری</div>';
      h += '<button onclick="NABZ.show(\'ed_nursing\')" style="padding:6px 12px;border-radius:8px;border:none;background:#d1fae5;color:#065f46;font-weight:700;font-size:11px;cursor:pointer">⟳ بروزرسانی</button>';
      h += '</div>';
      var total = 0;
      Object.keys(groups).forEach(function(k){ total += groups[k].items.length; });
      if (total === 0) {
        h += '<div style="background:#fff;padding:40px;border-radius:12px;text-align:center;color:#64748b;border:1px solid #e2e8f0">';
        h += '<div style="font-size:40px;margin-bottom:12px">✅</div>';
        h += '<div style="font-weight:700">هیچ بیماری در حال درمان نیست</div>';
        h += '</div>';
      } else {
        Object.keys(groups).forEach(function(k) {
          var g = groups[k];
          if (!g.items.length) return;
          h += '<div style="margin-bottom:14px">';
          h += '<div style="font-size:12px;font-weight:800;color:#475569;margin-bottom:6px;padding:0 4px">' + g.label + ' (' + g.items.length + ')</div>';
          h += '<div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">';
          g.items.forEach(function(r) {
            var esiColor = r.esiLevel === 1 ? '#dc2626' : r.esiLevel === 2 ? '#ea580c' : r.esiLevel === 3 ? '#ca8a04' : r.esiLevel === 4 ? '#16a34a' : '#3b82f6';
            h += '<div onclick="NABZ._edNursingPick(\'' + r.id + '\')" style="padding:12px 14px;border-bottom:1px solid #e2e8f0;cursor:pointer;display:flex;align-items:center;gap:10px">';
            h += '<div style="width:32px;height:32px;border-radius:8px;background:' + esiColor + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px">' + (r.esiLevel || '?') + '</div>';
            h += '<div style="flex:1;min-width:0">';
            h += '<div style="font-weight:800;font-size:13px;color:#0f172a">' + (r.patientName || '—') + '</div>';
            h += '<div style="font-size:11px;color:#64748b;margin-top:2px">' + (r.chiefComplaint || '—') + '</div>';
            if (r.news2) {
              var nc = r.news2.risk === 'critical' ? 'background:#fee2e2;color:#991b1b'
                : r.news2.risk === 'high' ? 'background:#fed7aa;color:#9a3412'
                : 'background:#f1f5f9;color:#334155';
              h += '<span style="font-size:10px;padding:2px 8px;border-radius:8px;font-weight:700;margin-top:3px;display:inline-block;' + nc + '">NEWS ' + r.news2.total + '</span>';
            }
            h += '</div>';
            h += '<button onclick="event.stopPropagation();NABZ._edNursingPick(\'' + r.id + '\')" style="padding:8px 14px;border-radius:8px;border:none;background:#059669;color:#fff;font-weight:700;font-size:11px;cursor:pointer">ورود</button>';
            h += '</div>';
          });
          h += '</div></div>';
        });
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
        h += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:8px;cursor:pointer" onclick="NABZ._edNursingPick(\'' + v.id + '\')">';
        h += '<b>' + (v.patientName || v.id) + '</b><div style="font-size:11px;color:#64748b">' + (v.chiefComplaint || '') + ' · ESI ' + (v.esiLevel || '?') + ' · ' + (v.status || '') + '</div></div>';
      });
      h += '</div>';
      document.getElementById('content').innerHTML = h;
    } catch(e) { console.error("[ED UI Error]", e);  document.getElementById('content').innerHTML = '<div style="color:#dc2626;padding:20px">خطا: ' + e.message + '</div>'; }
  }
  window.NABZ._edNursingPick_rich = function(visitId) {
    state.patientId = visitId;
    try { const u = new URL(window.location.href); u.searchParams.set('visitId', visitId); u.searchParams.delete('patientId'); window.history.replaceState({}, '', u.toString()); } catch (_) {}
    show();
  };

  window.NABZ._edNursingPick = function(pid) {
    state.patientId = pid;
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('visitId', pid);
      u.searchParams.delete('patientId');
      window.history.replaceState({}, '', u.toString());
    } catch (_) {}
    show();
  };;
  if (typeof NABZ !== 'undefined' && typeof NABZ.registerKind === 'function') {
    NABZ.registerKind('ed_nursing', show);
  }
})();
