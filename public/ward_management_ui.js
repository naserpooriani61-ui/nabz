// public/ward_management_ui.js — Superhuman Ward & Bed Management (Sina Hospital)
(function() {
  'use strict';
  const fa = (n) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function api(url, opts = {}) {
    if (typeof NABZ !== 'undefined' && typeof NABZ._api === 'function') return NABZ._api(url, opts);
    const res = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, ...opts });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || err.message || res.statusText); }
    return res.json();
  }

  if (!document.getElementById('ward-mgmt-style')) {
    const st = document.createElement('style'); st.id = 'ward-mgmt-style';
    st.textContent = `
      .ward-wrap{direction:rtl;font-family:'Vazirmatn',Tahoma,sans-serif;background:#f8fafc;min-height:100vh;padding:16px}
      .ward-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
      .ward-title{font-size:20px;font-weight:900;color:#1e40af}
      .ward-subtitle{font-size:12px;color:#64748b;margin-top:4px}
      .ward-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
      .ward-card{background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:16px;transition:all 0.2s;position:relative;overflow:hidden}
      .ward-card:hover{box-shadow:0 4px 12px rgba(0,0,0,0.1);transform:translateY(-2px)}
      .ward-card-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
      .ward-name{font-size:15px;font-weight:800;color:#0f172a;line-height:1.4}
      .ward-code{font-size:10px;color:#64748b;font-weight:700;background:#f1f5f9;padding:2px 8px;border-radius:6px;white-space:nowrap}
      .ward-type-badge{position:absolute;top:0;left:0;padding:4px 12px;font-size:10px;font-weight:800;color:#fff;border-radius:0 0 8px 0}
      .ward-type-badge.emergency{background:#dc2626}
      .ward-type-badge.icu{background:#f59e0b}
      .ward-type-badge.surgical{background:#8b5cf6}
      .ward-type-badge.medical{background:#06b6d4}
      .ward-type-badge.vip{background:#ec4899}
      .ward-type-badge.specialty{background:#10b981}
      .ward-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
      .ward-stat{text-align:center;padding:8px;background:#f8fafc;border-radius:8px}
      .ward-stat-v{font-size:18px;font-weight:900;color:#1e40af}
      .ward-stat-l{font-size:10px;color:#64748b;font-weight:700;margin-top:2px}
      .ward-info{font-size:11px;color:#64748b;margin:8px 0;line-height:1.6}
      .ward-actions{display:flex;gap:8px;margin-top:12px}
      .ward-btn{flex:1;padding:8px;border-radius:8px;border:none;font-weight:700;font-size:11px;cursor:pointer;transition:all 0.2s}
      .ward-btn:hover{opacity:0.9}
      .ward-btn.primary{background:#1e40af;color:#fff}
      .ward-btn.dng{background:#fee2e2;color:#991b1b}
      .ward-btn.success{background:#dcfce7;color:#166534}
      .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999}
      .modal{background:#fff;border-radius:16px;padding:24px;max-width:500px;width:90%;max-height:90vh;overflow-y:auto}
      .modal-title{font-size:18px;font-weight:900;margin-bottom:16px;color:#1e40af}
      .form-group{margin-bottom:12px}
      .form-label{display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:4px}
      .form-input{width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box}
      .form-input:focus{outline:none;border-color:#1e40af}
      .filter-bar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
      .filter-btn{padding:6px 12px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;font-size:11px;font-weight:700;cursor:pointer}
      .filter-btn.active{background:#1e40af;color:#fff;border-color:#1e40af}
    `;
    document.head.appendChild(st);
  }

  let wards = [];
  let beds = [];
  let filterType = 'all';

  async function show() {
    const host = document.getElementById('content');
    if (!host) return;
    host.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b">در حال بارگذاری...</div>';
    try {
      const data = await api('/api/bedboard/wards');
      wards = data.wards || [];
      beds = data.beds || [];
      render();
    } catch (e) {
      host.innerHTML = `<div style="padding:30px;text-align:center;color:#dc2626">خطا: ${esc(e.message)}</div>`;
    }
  }

  function render() {
    const host = document.getElementById('content');
    const totalBeds = beds.length;
    const occupiedBeds = beds.filter(b => b.status === 'occupied').length;
    const availableBeds = beds.filter(b => b.status === 'available').length;
    const occupancyRate = totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    let h = '<div class="ward-wrap">';
    h += '<div class="ward-header"><div><div class="ward-title">🏥 مدیریت بخش‌های بیمارستان سینا</div>';
    h += '<div class="ward-subtitle">بیمارستان آموزشی درمانی دانشگاه علوم پزشکی تهران</div></div>';
    h += '<button class="ward-btn primary" onclick="NABZ._wardAdd()">+ افزودن بخش جدید</button></div>';
    
    h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">';
    h += `<div style="background:#fff;padding:16px;border-radius:12px;border:1px solid #e2e8f0;text-align:center"><div style="font-size:24px;font-weight:900;color:#1e40af">${fa(wards.length)}</div><div style="font-size:11px;color:#64748b;font-weight:700">بخش فعال</div></div>`;
    h += `<div style="background:#fff;padding:16px;border-radius:12px;border:1px solid #e2e8f0;text-align:center"><div style="font-size:24px;font-weight:900;color:#0f172a">${fa(totalBeds)}</div><div style="font-size:11px;color:#64748b;font-weight:700">تخت کل</div></div>`;
    h += `<div style="background:#fff;padding:16px;border-radius:12px;border:1px solid #e2e8f0;text-align:center"><div style="font-size:24px;font-weight:900;color:#16a34a">${fa(availableBeds)}</div><div style="font-size:11px;color:#64748b;font-weight:700">تخت خالی</div></div>`;
    h += `<div style="background:#fff;padding:16px;border-radius:12px;border:1px solid #e2e8f0;text-align:center"><div style="font-size:24px;font-weight:900;color:#f59e0b">${fa(occupancyRate)}%</div><div style="font-size:11px;color:#64748b;font-weight:700">ضریب اشغال</div></div>`;
    h += '</div>';

    // Filter bar
    h += '<div class="filter-bar">';
    ['all','emergency','icu','surgical','medical','vip','specialty'].forEach(t => {
      const label = {all:'همه',emergency:'اورژانس',icu:'ویژه',surgical:'جراحی',medical:'داخلی',vip:'VIP',specialty:'تخصصی'}[t];
      h += `<button class="filter-btn ${filterType===t?'active':''}" onclick="NABZ._wardFilter('${t}')">${label}</button>`;
    });
    h += '</div>';

    h += '<div class="ward-grid">';
    const filteredWards = filterType === 'all' ? wards : wards.filter(w => w.type === filterType);
    
    filteredWards.forEach(w => {
      const wardBeds = beds.filter(b => b.wardCode === w.code);
      const occupied = wardBeds.filter(b => b.status === 'occupied').length;
      const available = wardBeds.filter(b => b.status === 'available').length;
      const typeFa = {emergency:'اورژانس',icu:'ویژه',surgical:'جراحی',medical:'داخلی',vip:'VIP',specialty:'تخصصی'}[w.type] || w.type;

      h += `<div class="ward-card">`;
      h += `<div class="ward-type-badge ${w.type}">${typeFa}</div>`;
      h += `<div class="ward-card-header"><div style="flex:1"><div class="ward-name">${esc(w.name)}</div>`;
      h += `<div class="ward-code">${esc(w.code)}</div></div></div>`;
      h += `<div class="ward-info">📍 ${esc(w.floor)} · 📞 ${esc(w.phone || '—')}${w.notes ? ' · 💡 ' + esc(w.notes) : ''}</div>`;
      h += `<div class="ward-stats">`;
      h += `<div class="ward-stat"><div class="ward-stat-v">${fa(w.beds)}</div><div class="ward-stat-l">تخت مصوب</div></div>`;
      h += `<div class="ward-stat"><div class="ward-stat-v" style="color:#dc2626">${fa(occupied)}</div><div class="ward-stat-l">اشغال</div></div>`;
      h += `<div class="ward-stat"><div class="ward-stat-v" style="color:#16a34a">${fa(available)}</div><div class="ward-stat-l">خالی</div></div>`;
      h += `</div>`;
      h += `<div class="ward-actions">`;
      h += `<button class="ward-btn primary" onclick="NABZ._wardEdit('${w.code}')">✏️ ویرایش</button>`;
      h += `<button class="ward-btn success" onclick="NABZ._wardBeds('${w.code}')">🛏️ تخت‌ها</button>`;
      h += `<button class="ward-btn dng" onclick="NABZ._wardDelete('${w.code}')">🗑️ حذف</button>`;
      h += `</div></div>`;
    });
    h += '</div></div>';
    host.innerHTML = h;
  }

  window.NABZ = window.NABZ || {};

  window.NABZ._wardFilter = function(type) {
    filterType = type;
    render();
  };

  window.NABZ._wardAdd = function() {
    const html = `<div class="modal-bg" onclick="if(event.target===this)this.remove()"><div class="modal">
      <div class="modal-title">➕ افزودن بخش جدید</div>
      <div class="form-group"><label class="form-label">کد بخش (انگلیسی)</label><input id="w_code" class="form-input" placeholder="مثلاً: ICU_GEN"></div>
      <div class="form-group"><label class="form-label">نام بخش</label><input id="w_name" class="form-input" placeholder="مثلاً: ICU جنرال"></div>
      <div class="form-group"><label class="form-label">نوع بخش</label><select id="w_type" class="form-input"><option value="emergency">اورژانس</option><option value="icu">ویژه</option><option value="surgical">جراحی</option><option value="medical">داخلی</option><option value="vip">VIP</option><option value="specialty">تخصصی</option></select></div>
      <div class="form-group"><label class="form-label">تعداد تخت مصوب</label><input id="w_beds" type="number" class="form-input" value="10"></div>
      <div class="form-group"><label class="form-label">طبقه</label><input id="w_floor" class="form-input" placeholder="مثلاً: طبقه 2"></div>
      <div class="form-group"><label class="form-label">شماره تلفن</label><input id="w_phone" class="form-input" placeholder="مثلاً: 2010"></div>
      <div class="form-group"><label class="form-label">یادداشت (اختیاری)</label><input id="w_notes" class="form-input" placeholder="مثلاً: 47 ثابت + 11 اکسترا"></div>
      <div style="display:flex;gap:8px;margin-top:16px"><button class="ward-btn primary" onclick="NABZ._wardSave()">ذخیره</button><button class="ward-btn dng" onclick="document.querySelector('.modal-bg').remove()">انصراف</button></div>
    </div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  };

  window.NABZ._wardSave = async function() {
    const ward = {
      code: document.getElementById('w_code').value,
      name: document.getElementById('w_name').value,
      type: document.getElementById('w_type').value,
      beds: parseInt(document.getElementById('w_beds').value) || 0,
      floor: document.getElementById('w_floor').value,
      phone: document.getElementById('w_phone').value,
      notes: document.getElementById('w_notes').value,
      status: 'active'
    };
    if (!ward.code || !ward.name) { alert('کد و نام بخش الزامی است'); return; }
    try {
      await api('/api/bedboard/wards', { method: 'POST', body: JSON.stringify(ward) });
      document.querySelector('.modal-bg').remove();
      show();
    } catch (e) { alert('❌ ' + e.message); }
  };

  window.NABZ._wardEdit = function(code) {
    const w = wards.find(x => x.code === code);
    if (!w) return;
    const html = `<div class="modal-bg" onclick="if(event.target===this)this.remove()"><div class="modal">
      <div class="modal-title">✏️ ویرایش بخش ${esc(w.name)}</div>
      <div class="form-group"><label class="form-label">کد بخش</label><input id="w_code" class="form-input" value="${esc(w.code)}" disabled></div>
      <div class="form-group"><label class="form-label">نام بخش</label><input id="w_name" class="form-input" value="${esc(w.name)}"></div>
      <div class="form-group"><label class="form-label">نوع بخش</label><select id="w_type" class="form-input"><option value="emergency"${w.type==='emergency'?' selected':''}>اورژانس</option><option value="icu"${w.type==='icu'?' selected':''}>ویژه</option><option value="surgical"${w.type==='surgical'?' selected':''}>جراحی</option><option value="medical"${w.type==='medical'?' selected':''}>داخلی</option><option value="vip"${w.type==='vip'?' selected':''}>VIP</option><option value="specialty"${w.type==='specialty'?' selected':''}>تخصصی</option></select></div>
      <div class="form-group"><label class="form-label">تعداد تخت مصوب</label><input id="w_beds" type="number" class="form-input" value="${w.beds}"></div>
      <div class="form-group"><label class="form-label">طبقه</label><input id="w_floor" class="form-input" value="${esc(w.floor || '')}"></div>
      <div class="form-group"><label class="form-label">شماره تلفن</label><input id="w_phone" class="form-input" value="${esc(w.phone || '')}"></div>
      <div class="form-group"><label class="form-label">یادداشت</label><input id="w_notes" class="form-input" value="${esc(w.notes || '')}"></div>
      <div style="display:flex;gap:8px;margin-top:16px"><button class="ward-btn primary" onclick="NABZ._wardUpdate('${code}')">بروزرسانی</button><button class="ward-btn dng" onclick="document.querySelector('.modal-bg').remove()">انصراف</button></div>
    </div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  };

  window.NABZ._wardUpdate = async function(code) {
    const ward = {
      name: document.getElementById('w_name').value,
      type: document.getElementById('w_type').value,
      beds: parseInt(document.getElementById('w_beds').value) || 0,
      floor: document.getElementById('w_floor').value,
      phone: document.getElementById('w_phone').value,
      notes: document.getElementById('w_notes').value
    };
    try {
      await api('/api/bedboard/wards/' + code, { method: 'PUT', body: JSON.stringify(ward) });
      document.querySelector('.modal-bg').remove();
      show();
    } catch (e) { alert('❌ ' + e.message); }
  };

  window.NABZ._wardDelete = async function(code) {
    if (!confirm('آیا از حذف این بخش اطمینان دارید؟ تمام تخت‌های آن نیز حذف خواهند شد.')) return;
    try {
      await api('/api/bedboard/wards/' + code, { method: 'DELETE' });
      show();
    } catch (e) { alert('❌ ' + e.message); }
  };

  window.NABZ._wardBeds = function(code) {
    if (typeof NABZ.show === 'function') NABZ.show('bedboard', code);
    else window.location.href = '/?view=bedboard&ward=' + code;
  };

  if (typeof NABZ !== 'undefined' && typeof NABZ.registerKind === 'function') {
    NABZ.registerKind('ward_management', show);
  }
})();
