/* public/kardex_shift_ui.js — Ward shift Kardex (printable handover) */
(function () {
  'use strict';
  if (!document.getElementById('kxs-style')) {
    const st = document.createElement('style'); st.id = 'kxs-style';
    st.textContent = `
.kxs-container{direction:rtl;padding:12px;font-family:inherit;max-width:100%;}
.kxs-header{background:linear-gradient(135deg,#1a5fb4,#4a8de0);color:#fff;padding:14px;border-radius:10px;margin-bottom:12px;}
.kxs-header h2{margin:0 0 4px;font-size:18px;}.kxs-header .sub{opacity:.9;font-size:13px;}
.kxs-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px;margin-bottom:12px;}
.kxs-card{padding:12px;border-radius:8px;text-align:center;background:#f5f7fa;}
.kxs-card .n{font-size:22px;font-weight:700;}.kxs-card .l{font-size:12px;color:#666;margin-top:2px;}
.kxs-card.danger{background:#ffe0e0;color:#a00;}.kxs-card.warn{background:#fff4d6;color:#8a5c00;}
.kxs-card.info{background:#d6e9ff;color:#0a3d7a;}
.kxs-section{margin-bottom:14px;}.kxs-section h3{margin:0 0 8px;font-size:15px;color:#333;border-right:4px solid #1a5fb4;padding-right:8px;}
.kxs-row{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.kxs-row .time{font-weight:700;color:#1a5fb4;font-size:13px;min-width:44px;}
.kxs-row .name{flex:1 1 auto;font-size:13px;}.kxs-row .drug{font-size:12px;color:#555;}
.kxs-row .badge{padding:2px 8px;border-radius:10px;font-size:11px;background:#eef2f8;}
.kxs-row .btn{background:#1a5fb4;color:#fff;border:none;border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer;font-family:inherit;}
.kxs-row.overdue{border-left:3px solid #d00;}.kxs-row.critical{border-left:3px solid #f00;background:#fff8f8;}
.kxs-empty{text-align:center;padding:20px;color:#999;background:#f9f9f9;border-radius:8px;}
@media print{.kxs-row .btn,.kxs-header .sub{display:none!important;}.kxs-container{padding:0;}.kxs-row{break-inside:avoid;}}
    `;
    document.head.appendChild(st);
  }
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
  function fmtT(iso){if(!iso)return'';try{return new Date(iso).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'});}catch(_){return'';}}
  function fmtD(iso){if(!iso)return'';try{return new Date(iso).toLocaleDateString('fa-IR');}catch(_){return'';}}

  async function fetchShift(w, s) {
    const u = '/api/kardex/shift/' + encodeURIComponent(w) + (s ? '?shift=' + s : '');
    const r = await fetch(u, { credentials: 'include' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  async function doAction(e, id, a, b) {
    const r = await fetch('/api/kardex/' + e + '/' + encodeURIComponent(id) + '/' + encodeURIComponent(a), {
      method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{})
    });
    if (!r.ok) { const d = await r.json().catch(()=>({})); throw new Error(d.message||'HTTP '+r.status); }
    return r.json();
  }

  function row(m, opt) {
    const c = opt.overdue ? 'overdue' : (opt.critical ? 'critical' : '');
    let h = '<div class="kxs-row ' + c + '">';
    h += '<span class="time">' + fmtT(m.scheduledAt || m.createdAt) + '</span>';
    h += '<div class="name"><b>' + esc(m.patientName) + '</b><br><span class="drug">' + esc(m.drugName || m.title || m.type) + ' ' + esc(m.dose || '') + '</span></div>';
    if (m.status) h += '<span class="badge">' + esc(m.status) + '</span>';
    if (['scheduled','due'].includes(m.status)) {
      h += '<button class="btn" data-k="mar" data-i="' + esc(m.id) + '" data-a="administer">اجرا</button>';
      h += '<button class="btn" data-k="mar" data-i="' + esc(m.id) + '" data-a="refuse">رد</button>';
    }
    return h + '</div>';
  }

  function html(d) {
    let h = '<div class="kxs-container"><div class="kxs-header">';
    h += '<h2>کاردکس شیفت ' + esc(d.shiftLabel) + ' — ' + esc(d.wardCode) + '</h2>';
    h += '<div class="sub">' + fmtD(d.generatedAt) + ' ' + fmtT(d.generatedAt) + ' · ' + d.totals.patients + ' بیمار</div></div>';
    h += '<div class="kxs-cards">';
    h += '<div class="kxs-card info"><div class="n">' + d.totals.patients + '</div><div class="l">بیمار</div></div>';
    h += '<div class="kxs-card"><div class="n">' + d.totals.dueNow + '</div><div class="l">۲h آینده</div></div>';
    h += '<div class="kxs-card warn"><div class="n">' + d.totals.overdue + '</div><div class="l">عقب‌افتاده</div></div>';
    h += '<div class="kxs-card"><div class="n">' + d.totals.pendingVerify + '</div><div class="l">در انتظار</div></div>';
    if (d.totals.critical > 0) h += '<div class="kxs-card danger"><div class="n">' + d.totals.critical + '</div><div class="l">بحرانی</div></div>';
    h += '</div>';

    if (d.overdue.length) { h += '<div class="kxs-section"><h3>⚠️ عقب‌افتاده (' + d.overdue.length + ')</h3>'; d.overdue.forEach(m => h += row(m, {overdue:true})); h += '</div>'; }
    if (d.dueNow.length) { h += '<div class="kxs-section"><h3>⏰ ۲ ساعت آینده (' + d.dueNow.length + ')</h3>'; d.dueNow.forEach(m => h += row(m, {})); h += '</div>'; }
    if (d.critical.length) {
      h += '<div class="kxs-section"><h3>🚨 هشدار بحرانی (' + d.critical.length + ')</h3>';
      d.critical.forEach(a => { h += '<div class="kxs-row critical"><span class="time">' + fmtT(a.createdAt) + '</span><div class="name"><b>' + esc(a.patientName) + '</b><br><span class="drug">' + esc(a.title) + '</span></div></div>'; });
      h += '</div>';
    }
    if (d.pendingVerify.length) {
      h += '<div class="kxs-section"><h3>📋 در انتظار تأیید (' + d.pendingVerify.length + ')</h3>';
      d.pendingVerify.forEach(o => {
        h += '<div class="kxs-row"><span class="time">' + fmtT(o.orderedAt) + '</span>';
        h += '<div class="name"><b>' + esc(o.patientName) + '</b><br><span class="drug">' + esc(o.drug || o.type) + ' ' + esc(o.dose || '') + '</span></div>';
        h += '<button class="btn" data-k="order" data-i="' + esc(o.id) + '" data-a="verify">تأیید</button></div>';
      });
      h += '</div>';
    }
    if (!d.overdue.length && !d.dueNow.length && !d.critical.length && !d.pendingVerify.length) {
      h += '<div class="kxs-empty">هیچ آیتمی برای این شیفت وجود ندارد ✅</div>';
    }
    return h + '</div>';
  }

  function bind(el, data, w, s) {
    el.querySelectorAll('.kxs-row .btn').forEach(btn => {
      btn.addEventListener('click', async ev => {
        ev.preventDefault();
        const k = btn.dataset.k, i = btn.dataset.i, a = btn.dataset.a;
        let b = {};
        if (a === 'administer') {
          b.fiveRights = { attested: true, at: new Date().toISOString() };
          const wit = prompt('شاهد (اختیاری):'); if (wit) b.witnessId = wit;
        } else if (['refuse','cancel','hold','miss'].includes(a)) {
          const r = prompt('دلیل:'); if (!r) return; b.reason = r;
        }
        btn.disabled = true; const o = btn.textContent; btn.textContent = '...';
        try { await doAction(k, i, a, b); await load(w, s, el); }
        catch (e) { alert('خطا: ' + e.message); btn.disabled = false; btn.textContent = o; }
      });
    });
  }

  async function load(w, s, el) {
    el.innerHTML = '<div class="kxs-empty">در حال بارگذاری...</div>';
    try { const d = await fetchShift(w, s); el.innerHTML = html(d); bind(el, d, w, s); }
    catch (e) { el.innerHTML = '<div class="kxs-empty">خطا: ' + esc(e.message) + '</div>'; }
  }

  function show(panel, data) {
    const el = document.createElement('div'); el.className = 'kxs-container';
    const w = (data && data.wardCode) || (panel && panel.wardCode) || new URLSearchParams(location.search).get('wardCode');
    const s = new URLSearchParams(location.search).get('shift') || '';
    if (!w) { el.innerHTML = '<div class="kxs-empty">بخش مشخص نشده — wardCode بدهید</div>'; return el; }
    load(w, s, el);
    return el;
  }

  function tryReg() {
    if (typeof NABZ !== 'undefined' && typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('kardex_shift', show);
      console.log('[kardex_shift_ui] registered');
      return true;
    }
    return false;
  }
  if (!tryReg()) { let t = 0; const iv = setInterval(() => { if (tryReg() || ++t > 30) clearInterval(iv); }, 100); }
})();
