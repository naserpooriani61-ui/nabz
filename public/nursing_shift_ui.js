// public/nursing_shift_ui.js — یکپارچه‌سازی ۱۰ ماژول پرستاری
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

  if (!document.getElementById('nursing-shift-style')) {
    const st = document.createElement('style'); st.id = 'nursing-shift-style';
    st.textContent = `
      .ns-wrap { direction: rtl; font-family: 'Vazirmatn', Tahoma, sans-serif; background: #f8fafc; min-height: 100vh; padding: 16px; }
      .ns-tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 12px; margin-bottom: 16px; border-bottom: 2px solid #e2e8f0; }
      .ns-tab { padding: 10px 16px; border-radius: 10px 10px 0 0; border: none; background: #e2e8f0; color: #475569; font-weight: 700; font-size: 13px; cursor: pointer; white-space: nowrap; }
      .ns-tab.active { background: #059669; color: #fff; }
      .ns-card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
      .ns-card-header { font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
      .ns-kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px; }
      .ns-kpi { background: #fff; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center; }
      .ns-kpi-v { font-size: 26px; font-weight: 900; color: #059669; }
      .ns-kpi-l { font-size: 11px; color: #64748b; font-weight: 700; margin-top: 4px; }
      .ns-btn { padding: 10px 16px; border-radius: 8px; border: none; font-weight: 700; font-size: 13px; cursor: pointer; width: 100%; transition: opacity 0.2s; }
      .ns-btn-primary { background: #059669; color: #fff; }
      .ns-btn-danger { background: #fee2e2; color: #991b1b; }
      .ns-btn:active { opacity: 0.8; }
      .ns-loading { padding: 40px; text-align: center; color: #64748b; }
      .ns-shift-pill { display: inline-flex; align-items: center; justify-content: center; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; }
      .s-m { background: #fef3c7; color: #92400e; } .s-e { background: #ffedd5; color: #9a3412; } .s-n { background: #e0e7ff; color: #3730a3; } .s-off { background: #f1f5f9; color: #475569; }
      .ns-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin: 12px 0; }
      .ns-grid-cell { aspect-ratio: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; cursor: pointer; }
      .ns-grid-cell.active { background: #059669; color: #fff; border-color: #059669; }
      .ns-person { display: flex; align-items: center; gap: 12px; padding: 12px; background: #f8fafc; border-radius: 10px; margin-bottom: 8px; cursor: pointer; }
      .ns-person:hover { background: #f1f5f9; }
      .ns-avatar { width: 40px; height: 40px; border-radius: 10px; background: #059669; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; }
      .ns-person-info { flex: 1; }
      .ns-person-name { font-weight: 800; font-size: 14px; }
      .ns-person-meta { font-size: 11px; color: #64748b; margin-top: 2px; }
      .ns-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; }
      .ns-modal { background: #fff; border-radius: 16px; padding: 24px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto; }
      .ns-modal-title { font-size: 18px; font-weight: 900; margin-bottom: 16px; color: #1e40af; }
      .ns-form-group { margin-bottom: 12px; }
      .ns-form-label { display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px; }
      .ns-form-input { width: 100%; padding: 10px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
      .ns-form-input:focus { outline: none; border-color: #059669; }
      .ns-progress { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-top: 6px; }
      .ns-progress-bar { height: 100%; background: #059669; transition: width 0.3s; }
    `;
    document.head.appendChild(st);
  }

  let state = { tab: 'dashboard', month: new Date().getMonth() + 1, year: new Date().getFullYear(), wardCode: null };

  async function show() {
    const host = document.getElementById('content'); if (!host) return;
    
    // دریافت wardCode از context کاربر
    if (!state.wardCode) {
      try {
        const user = await api('/api/auth/me');
        state.wardCode = user.wardCode || 'ER';
      } catch (e) {
        state.wardCode = 'ER';
      }
    }

    host.innerHTML = `
      <div class="ns-wrap">
        <div class="ns-tabs">
          <button class="ns-tab ${state.tab==='dashboard'?'active':''}" onclick="NABZ._nsTab('dashboard')">📊 داشبورد</button>
          <button class="ns-tab ${state.tab==='myreq'?'active':''}" onclick="NABZ._nsTab('myreq')">📤 درخواست‌های من</button>
          <button class="ns-tab ${state.tab==='inbox'?'active':''}" onclick="NABZ._nsTab('inbox')">📥 صندوق سرپرستار</button>
          <button class="ns-tab ${state.tab==='roster'?'active':''}" onclick="NABZ._nsTab('roster')">🧠 رستر هوشمند</button>
          <button class="ns-tab ${state.tab==='coverage'?'active':''}" onclick="NABZ._nsTab('coverage')">👩‍⚕️ پوشش پرستاری</button>
          <button class="ns-tab ${state.tab==='report'?'active':''}" onclick="NABZ._nsTab('report')">📝 گزارش پرستاری</button>
          <button class="ns-tab ${state.tab==='careplan'?'active':''}" onclick="NABZ._nsTab('careplan')">📋 برنامه مراقبت</button>
          <button class="ns-tab ${state.tab==='assistant'?'active':''}" onclick="NABZ._nsTab('assistant')">🏥 دستیار شیفت</button>
        </div>
        <div id="ns-body" class="ns-loading">در حال بارگذاری...</div>
      </div>`;
    render();
  }

  function render() {
    const el = document.getElementById('ns-body'); if (!el) return;
    if (state.tab === 'dashboard') renderDashboard(el);
    else if (state.tab === 'myreq') renderMyReq(el);
    else if (state.tab === 'inbox') renderInbox(el);
    else if (state.tab === 'roster') renderRoster(el);
    else if (state.tab === 'coverage') renderCoverage(el);
    else if (state.tab === 'report') renderReport(el);
    else if (state.tab === 'careplan') renderCarePlan(el);
    else if (state.tab === 'assistant') renderAssistant(el);
  }

  function renderDashboard(el) {
    el.innerHTML = `
      <div class="ns-kpi-grid">
        <div class="ns-kpi"><div class="ns-kpi-v">۹۸٪</div><div class="ns-kpi-l">پوشش شیفت صبح</div></div>
        <div class="ns-kpi"><div class="ns-kpi-v" style="color:#f59e0b">۲</div><div class="ns-kpi-l">کمبود نیروی شب</div></div>
        <div class="ns-kpi"><div class="ns-kpi-v">۱۴</div><div class="ns-kpi-l">درخواست در انتظار</div></div>
        <div class="ns-kpi"><div class="ns-kpi-v" style="color:#16a34a">۸۵٪</div><div class="ns-kpi-l">تحقق درخواست‌ها</div></div>
      </div>
      <div class="ns-card"><div class="ns-card-header">📊 وضعیت کلی بخش</div>
        <p style="color:#64748b;font-size:13px;margin-bottom:12px">بخش: <b>${esc(state.wardCode)}</b> | ماه: <b>${fa(state.month)}</b></p>
        <div class="ns-progress"><div class="ns-progress-bar" style="width:85%"></div></div>
        <div style="font-size:11px;color:#64748b;margin-top:4px">۸۵٪ از درخواست‌های پرسنل تحقق یافته</div>
      </div>
      <div class="ns-card"><div class="ns-card-header">⚡ اقدام سریع</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
          <button class="ns-btn ns-btn-primary" onclick="NABZ._nsTab('myreq')">📝 ثبت درخواست</button>
          <button class="ns-btn ns-btn-primary" onclick="NABZ._nsTab('roster')">🧠 چیدمان هوشمند</button>
          <button class="ns-btn ns-btn-primary" onclick="NABZ._nsTab('inbox')">📥 صندوق درخواست‌ها</button>
          <button class="ns-btn ns-btn-primary" onclick="NABZ._nsTab('coverage')">👩‍⚕️ پوشش پرستاری</button>
        </div>
      </div>`;
  }

  function renderMyReq(el) {
    el.innerHTML = `
      <div class="ns-card"><div class="ns-card-header">📝 ثبت درخواست شیفت ${fa(state.month)}</div>
        <p style="font-size:12px;color:#64748b;margin-bottom:12px">الگوهای سریع: 
          <button class="ns-btn" style="width:auto;padding:4px 8px;font-size:11px;background:#f1f5f9" onclick="NABZ._nsApplyRoutine('long_odd')">لانگ روزهای فرد</button>
          <button class="ns-btn" style="width:auto;padding:4px 8px;font-size:11px;background:#f1f5f9" onclick="NABZ._nsApplyRoutine('night_even')">شب تاریخ زوج</button>
        </p>
        <div class="ns-grid" id="ns-cal">
          ${Array.from({length:30},(_,i)=>`<div class="ns-grid-cell" data-day="${i+1}" onclick="NABZ._nsToggleDay(${i+1})">${fa(i+1)}</div>`).join('')}
        </div>
        <textarea class="ns-form-input" style="margin-top:12px;height:80px;resize:vertical" placeholder="توضیحات برای سرپرست (مثلاً: روز ۱۵ کلاس دانشگاه دارم)"></textarea>
        <button class="ns-btn ns-btn-primary" style="margin-top:12px" onclick="NABZ._nsSubmitReq()">📤 ارسال درخواست</button>
      </div>`;
  }

  function renderInbox(el) {
    el.innerHTML = '<div class="ns-loading">در حال دریافت درخواست‌های پرسنل...</div>';
    api('/api/nursing/shifts/requests?status=pending').then(res => {
      const reqs = res.requests || [];
      let h = `<div class="ns-card"><div class="ns-card-header">📥 درخواست‌های در انتظار (${fa(reqs.length)})</div>`;
      if (!reqs.length) h += '<div style="text-align:center;color:#64748b;padding:20px">درخواست جدیدی وجود ندارد.</div>';
      else {
        reqs.forEach(r => {
          h += `<div class="ns-person" onclick="NABZ._nsViewReq('${r.id}')">
            <div class="ns-avatar">${esc((r.staffName || '?')[0])}</div>
            <div class="ns-person-info">
              <div class="ns-person-name">${esc(r.staffName || 'نامشخص')}</div>
              <div class="ns-person-meta">${esc(r.notes || 'بدون توضیحات')}</div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="ns-btn ns-btn-primary" style="width:auto;padding:6px 12px;font-size:11px" onclick="event.stopPropagation();NABZ._nsReqAction('${r.id}', 'approved')">✓</button>
              <button class="ns-btn ns-btn-danger" style="width:auto;padding:6px 12px;font-size:11px" onclick="event.stopPropagation();NABZ._nsReqAction('${r.id}', 'rejected')">✕</button>
            </div>
          </div>`;
        });
      }
      h += '</div>';
      document.getElementById('ns-body').innerHTML = h;
    }).catch(e => { document.getElementById('ns-body').innerHTML = `<div class="ns-loading" style="color:#dc2626">خطا: ${e.message}</div>`; });
  }

  function renderRoster(el) {
    el.innerHTML = `
      <div class="ns-card"><div class="ns-card-header">🧠 تولید رستر هوشمند</div>
        <p style="font-size:13px;color:#475569;margin-bottom:12px">الگوریتم Simulated Annealing با رعایت قوانین استراحت، سقف شب، و درخواست‌های تأییدشده، بهترین چیدمان را تولید می‌کند.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div><label class="ns-form-label">ماه</label><input type="number" value="${state.month}" class="ns-form-input"></div>
          <div><label class="ns-form-label">سال</label><input type="number" value="${state.year}" class="ns-form-input"></div>
        </div>
        <div class="ns-form-group"><label class="ns-form-label">حداقل نیروی صبح</label><input type="number" value="2" class="ns-form-input"></div>
        <div class="ns-form-group"><label class="ns-form-label">حداقل نیروی عصر</label><input type="number" value="2" class="ns-form-input"></div>
        <div class="ns-form-group"><label class="ns-form-label">حداقل نیروی شب</label><input type="number" value="2" class="ns-form-input"></div>
        <button class="ns-btn ns-btn-primary" onclick="NABZ._nsGenerateRoster()">🚀 اجرای چیدمان هوشمند</button>
      </div>
      <div id="ns-roster-result"></div>`;
  }

  function renderCoverage(el) {
    el.innerHTML = `
      <div class="ns-card"><div class="ns-card-header">👩‍⚕️ پوشش پرستاری شیفت جاری</div>
        <div class="ns-kpi-grid">
          <div class="ns-kpi"><div class="ns-kpi-v">۳/۳</div><div class="ns-kpi-l">صبح</div></div>
          <div class="ns-kpi"><div class="ns-kpi-v" style="color:#f59e0b">۲/۳</div><div class="ns-kpi-l">عصر</div></div>
          <div class="ns-kpi"><div class="ns-kpi-v" style="color:#dc2626">۱/۲</div><div class="ns-kpi-l">شب</div></div>
        </div>
        <div style="margin-top:16px">
          <div style="font-weight:800;font-size:13px;margin-bottom:8px">پرسنل حاضر:</div>
          <div class="ns-person"><div class="ns-avatar">ز</div><div class="ns-person-info"><div class="ns-person-name">زهرا محمدی</div><div class="ns-person-meta">پرستار · شیفت صبح</div></div></div>
          <div class="ns-person"><div class="ns-avatar">ع</div><div class="ns-person-info"><div class="ns-person-name">علی رضایی</div><div class="ns-person-meta">پرستار · شیفت صبح</div></div></div>
          <div class="ns-person"><div class="ns-avatar">ف</div><div class="ns-person-info"><div class="ns-person-name">فاطمه حسینی</div><div class="ns-person-meta">پرستار · شیفت صبح</div></div></div>
        </div>
      </div>`;
  }

  function renderReport(el) {
    el.innerHTML = `
      <div class="ns-card"><div class="ns-card-header">📝 گزارش پرستاری</div>
        <p style="font-size:13px;color:#475569;margin-bottom:12px">فرم‌های ساختاریافته SOAP و Focus Charting برای ثبت رویدادهای بالینی.</p>
        <button class="ns-btn ns-btn-primary">📝 شروع گزارش جدید</button>
      </div>`;
  }

  function renderCarePlan(el) {
    el.innerHTML = `
      <div class="ns-card"><div class="ns-card-header">📋 برنامه مراقبت</div>
        <p style="font-size:13px;color:#475569;margin-bottom:12px">نگاشت تشخیص‌های پرستاری (NANDA) به مداخله (NIC) و پیامد (NOC).</p>
        <button class="ns-btn ns-btn-primary">📋 ایجاد برنامه مراقبت</button>
      </div>`;
  }

  function renderAssistant(el) {
    el.innerHTML = `
      <div class="ns-card"><div class="ns-card-header">🏥 دستیار شیفت</div>
        <p style="font-size:13px;color:#475569;margin-bottom:12px">چک‌لیست‌های هوشمند شروع و پایان شیفت.</p>
        <div style="margin-bottom:12px">
          <div style="font-weight:800;font-size:13px;margin-bottom:8px">✅ شروع شیفت</div>
          <div class="ns-person"><input type="checkbox" checked> <span style="flex:1">تحویل داروهای مخدر</span></div>
          <div class="ns-person"><input type="checkbox" checked> <span style="flex:1">بررسی تجهیزات احیا</span></div>
          <div class="ns-person"><input type="checkbox"> <span style="flex:1">بررسی تخت‌های خالی</span></div>
        </div>
        <button class="ns-btn ns-btn-primary">تکمیل چک‌لیست</button>
      </div>`;
  }

  window.NABZ = window.NABZ || {};
  window.NABZ._nsTab = function(tab) { state.tab = tab; document.querySelectorAll('.ns-tab').forEach(b => b.classList.toggle('active', b.getAttribute('onclick').includes(`'${tab}'`))); render(); };
  
  window.NABZ._nsToggleDay = function(day) {
    const el = document.querySelector(`[data-day="${day}"]`);
    if (el) el.classList.toggle('active');
  };

  window.NABZ._nsApplyRoutine = function(routine) {
    alert(`الگوی ${routine} اعمال شد (شبیه‌سازی)`);
  };

  window.NABZ._nsSubmitReq = async function() {
    alert('درخواست شما با موفقیت ثبت و برای سرپرست ارسال شد. (شبیه‌سازی)');
  };

  window.NABZ._nsReqAction = async function(id, status) {
    try {
      await api('/api/nursing/shifts/request/status', { method: 'POST', body: JSON.stringify({ id, status }) });
      renderInbox(document.getElementById('ns-body'));
    } catch (e) { alert('❌ ' + e.message); }
  };

  window.NABZ._nsGenerateRoster = async function() {
    const body = document.getElementById('ns-body');
    body.innerHTML = '<div class="ns-loading">⏳ در حال محاسبه‌ی هزاران ترکیب ممکن برای یافتن بهینه‌ترین چیدمان...</div>';
    try {
      const res = await api('/api/nursing/shifts/roster/generate', { 
        method: 'POST', 
        body: JSON.stringify({ month: state.month, year: state.year, wardCode: state.wardCode, rules: { minM: 2, minE: 2, minN: 2 } }) 
      });
      body.innerHTML = `<div class="ns-card"><div class="ns-card-header">✅ چیدمان با موفقیت انجام شد</div>
        <p style="font-size:13px;color:#059669">امتیاز خطا (Cost): ${fa(res.metrics)} (هرچه کمتر، بهتر)</p>
        <button class="ns-btn ns-btn-primary" style="margin-top:12px">📤 انتشار و ارسال برای پرسنل</button></div>`;
    } catch (e) {
      body.innerHTML = `<div class="ns-loading" style="color:#dc2626">خطا در چیدمان: ${e.message}</div>`;
    }
  };

  if (typeof NABZ !== 'undefined' && typeof NABZ.registerKind === 'function') {
    NABZ.registerKind('nursing_shifts', show);
  }
})();

// دکمه دسترسی سریع سراسری به چیدمان هوشمند
(function() {
  if (document.getElementById('ns-fab')) return;
  const fab = document.createElement('button');
  fab.id = 'ns-fab';
  fab.innerHTML = '🧠 چیدمان هوشمند شیفت';
  fab.style.cssText = 'position:fixed; bottom:90px; left:20px; background:linear-gradient(135deg, #059669, #10b981); color:#fff; border:2px solid rgba(255,255,255,0.2); border-radius:50px; padding:12px 20px; font-weight:800; font-size:14px; box-shadow:0 6px 16px rgba(5,150,105,0.4); cursor:pointer; z-index:9999; display:flex; align-items:center; gap:8px; transition:all 0.2s; font-family:Vazirmatn,Tahoma,sans-serif;';
  fab.onmouseenter = () => fab.style.transform = 'scale(1.05) translateY(-2px)';
  fab.onmouseleave = () => fab.style.transform = 'scale(1) translateY(0)';
  fab.onclick = () => {
    if (typeof NABZ !== 'undefined' && typeof NABZ.show === 'function') {
      NABZ.show('nursing_shifts');
    } else {
      window.location.href = '/?view=nursing_shifts';
    }
  };
  document.body.appendChild(fab);
})();
