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
    const urlPid = urlParams.get('patientId');
    if (urlPid && urlPid !== 'undefined' && urlPid !== 'null') state.patientId = urlPid;
    if (!state.patientId) { renderWorklist(); return; }
    document.getElementById('content').innerHTML = '<div style="text-align:center;padding:40px">در حال بارگذاری...</div>';

    try {
      const res = await apiCall(`/api/ed/nursing_dashboard?patientId=${state.patientId}`);
      state.data = res;
      render();
    } catch(e) { console.error("[ED UI Error]", e); 
      document.getElementById('content').innerHTML = `<div style="color:red;padding:20px">خطا: ${e.message}</div>`;
    }
  }

  function render() {
    const p = state.data && state.data.patient;
    if (!p) { document.getElementById('content').innerHTML = '<div style="padding:24px;color:#dc2626;text-align:center;font-weight:700">❌ پرونده یافت نشد</div>'; return; }
    const orders = state.data.pendingOrders || [];
    
    let h = `<div class="nursing-wrap">`;
    h += `<div class="nursing-header">`;
    h += `<div><div style="font-size:18px;font-weight:900">${p.name}</div>`;
    h += `<div style="font-size:12px;color:var(--kx-text-2)">ESI: ${p.esiLevel} | تخت: ${p.bedCode || 'نامشخص'} | ${p.chiefComplaint}</div></div>`;
    h += `<button class="mar-btn hold" onclick="window.history.back()">بازگشت</button>`;
    h += `</div>`;

    h += `<div class="nursing-grid">`;
    
    // Left: MAR & Actions
    h += `<div class="n-card">`;
    h += `<div class="n-title">💊 دستورات در انتظار اجرا (MAR)</div>`;
    if (orders.length === 0) {
      h += `<div style="text-align:center;color:var(--kx-text-2);padding:20px">دستور جدیدی در انتظار نیست</div>`;
    } else {
      orders.forEach(o => {
        const isHighAlert = o.item.includes('مورفین') || o.item.includes('انسولین') || o.item.includes('هپارین');
        h += `<div class="mar-item" style="${isHighAlert ? 'border-color:#dc2626; background:#fef2f2;' : ''}">`;
        h += `<div><div style="font-weight:700">${o.item} ${o.dose || ''}</div>`;
        h += `<div style="font-size:11px;color:var(--kx-text-2)">${o.route || ''} - ${o.frequency || ''} ${isHighAlert ? '⚠️ نیاز به شاهد' : ''}</div></div>`;
        h += `<div>`;
        h += `<button class="mar-btn give" onclick="NABZ._edMarAction('${o.id}', 'given')">✅ اجرا</button>`;
        h += `<button class="mar-btn hold" onclick="NABZ._edMarAction('${o.id}', 'held')">❌ عدم اجرا</button>`;
        h += `</div></div>`;
      });
    }
    h += `</div>`;

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
  window.NABZ._edMarAction = async function(orderId, action) {
    if (action === 'given') {
      // In a real superhuman system, high-alert meds would prompt for a second nurse's PIN here
      const confirmed = confirm('آیا از اجرای این دستور اطمینان دارید؟');
      if (!confirmed) return;
    }
    try {
      await apiCall(`/api/ed/mar/${orderId}`, { 
        method: 'POST', 
        body: JSON.stringify({ action, nurseId: 'current_user' }) // Replace with actual auth ID
      });
      if (typeof NABZ._toast === 'function') NABZ._toast(`دستور با موفقیت ${action === 'given' ? 'اجرا' : 'متوقف'} شد`);
      show(); // Refresh
    } catch(e) { console.error("[ED UI Error]", e); 
      alert('خطا: ' + e.message);
    }
  };

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
  window.NABZ._edNursingPick = function(pid){ state.patientId = pid; show(); };
  if (typeof NABZ !== 'undefined' && typeof NABZ.registerKind === 'function') {
    NABZ.registerKind('ed_nursing', show);
  }
})();
