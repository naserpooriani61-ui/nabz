/* public/handover_print.js — Printable SBAR handover report (A4)
 * Registers NABZ.registerKind('handover_print', show)
 * Uses GET /api/kardex/handover/:patientId
 * Zero external deps · RTL · Ctrl+P ready
 */
(function () {
  'use strict';

  if (!document.getElementById('hpr-style')) {
    const st = document.createElement('style'); st.id = 'hpr-style';
    st.textContent = `
.hpr-wrap{direction:rtl;font-family:'Vazirmatn','Tahoma',sans-serif;background:#f0f2f5;padding:14px;color:#1a1a1a;}
.hpr-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;}
.hpr-toolbar button{padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;}
.hpr-btn-print{background:#1a5fb4;color:#fff;}
.hpr-btn-close{background:#eef2f8;color:#333;}
.hpr-btn-copy{background:#16a34a;color:#fff;}
.hpr-page{background:#fff;width:210mm;min-height:297mm;padding:14mm;margin:0 auto;box-shadow:0 2px 12px rgba(0,0,0,.1);border-radius:4px;}
.hpr-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a5fb4;padding-bottom:8px;margin-bottom:12px;}
.hpr-logo{font-size:22px;font-weight:800;color:#1a5fb4;letter-spacing:1px;}
.hpr-logo small{display:block;font-size:10px;font-weight:400;color:#666;letter-spacing:0;margin-top:2px;}
.hpr-meta-box{text-align:left;font-size:11px;color:#555;line-height:1.6;}
.hpr-pt-bar{background:#f5f7fa;border-right:5px solid #1a5fb4;padding:10px 12px;border-radius:6px;margin-bottom:12px;}
.hpr-pt-name{font-size:18px;font-weight:700;margin-bottom:4px;}
.hpr-pt-info{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:#444;}
.hpr-pt-info span b{color:#1a1a1a;}
.hpr-allergy{background:#ffe0e0;color:#a00;padding:6px 10px;border-radius:4px;font-weight:700;margin-top:8px;font-size:13px;}
.hpr-isolation{background:#fff4d6;color:#8a5c00;padding:6px 10px;border-radius:4px;margin-top:6px;font-size:12px;font-weight:600;}
.hpr-sbar{display:flex;flex-direction:column;gap:10px;}
.hpr-sec{border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;}
.hpr-sec-h{background:#1a5fb4;color:#fff;padding:6px 12px;font-weight:700;font-size:13px;display:flex;justify-content:space-between;align-items:center;}
.hpr-sec-h .hpr-badge{background:rgba(255,255,255,.2);padding:2px 8px;border-radius:10px;font-size:10px;font-weight:400;}
.hpr-sec-h.critical{background:#b91c1c;}
.hpr-sec-h.warning{background:#d97706;}
.hpr-sec-b{padding:10px 12px;font-size:12px;line-height:1.7;}
.hpr-row{display:flex;gap:8px;padding:3px 0;border-bottom:1px dashed #eee;}
.hpr-row:last-child{border-bottom:none;}
.hpr-row .k{flex:0 0 110px;color:#666;font-weight:600;}
.hpr-row .v{flex:1 1 auto;color:#1a1a1a;}
.hpr-list{margin:0;padding-right:18px;}
.hpr-list li{padding:2px 0;font-size:12px;}
.hpr-table{width:100%;border-collapse:collapse;font-size:11px;}
.hpr-table th{background:#f5f7fa;text-align:right;padding:5px 8px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#333;}
.hpr-table td{padding:5px 8px;border-bottom:1px solid #f0f0f0;vertical-align:top;}
.hpr-tag{display:inline-block;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;background:#eef2f8;color:#333;}
.hpr-tag.stat{background:#ffe0e0;color:#a00;}
.hpr-tag.crit{background:#ffe0e0;color:#a00;}
.hpr-tag.warn{background:#fff4d6;color:#8a5c00;}
.hpr-tag.ok{background:#d8f0dd;color:#1a6b2e;}
.hpr-empty{color:#888;font-size:11px;font-style:italic;padding:4px 0;}
.hpr-footer{margin-top:16px;padding-top:8px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#888;}
.hpr-sig{display:flex;gap:30px;margin-top:18px;}
.hpr-sig div{flex:1;border-top:1px solid #999;padding-top:4px;font-size:11px;text-align:center;color:#555;}

@media print {
  body{margin:0;background:#fff;}
  .hpr-wrap{padding:0;background:#fff;}
  .hpr-toolbar{display:none !important;}
  .hpr-page{box-shadow:none;border-radius:0;padding:10mm;min-height:auto;}
  .hpr-sec{break-inside:avoid;}
  .hpr-row{break-inside:avoid;}
}
@media (max-width:768px){
  .hpr-page{width:auto;padding:10px;}
  .hpr-header{flex-direction:column;gap:8px;}
  .hpr-meta-box{text-align:right;}
}
    `;
    document.head.appendChild(st);
  }

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
  function fmtT(iso){if(!iso)return'';try{return new Date(iso).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'});}catch(_){return'';}}
  function fmtD(iso){if(!iso)return'';try{return new Date(iso).toLocaleDateString('fa-IR');}catch(_){return'';}}
  function fmtDT(iso){if(!iso)return'';try{return new Date(iso).toLocaleDateString('fa-IR')+' '+new Date(iso).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'});}catch(_){return'';}}
  function statusTag(s){
    const m={'pending':'warn','verified':'ok','active':'ok','held':'warn','given':'ok','given_partial':'warn','missed':'crit','refused':'crit','cancelled':'crit','discontinued':'crit'};
    return '<span class="hpr-tag '+(m[s]||'')+'">'+esc(s)+'</span>';
  }
  function priorityTag(p){
    if(p==='stat')return '<span class="hpr-tag stat">STAT</span>';
    if(p==='urgent')return '<span class="hpr-tag warn">URGENT</span>';
    return '<span class="hpr-tag">'+esc(p||'routine')+'</span>';
  }

  function html(r) {
    const h=r.header, s=r.situation, b=r.background, a=r.assessment, rec=r.recommendation;
    let out='';

    out+='<div class="hpr-header">';
    out+='<div class="hpr-logo">NABZ<small>گزارش تحویل شیفت — SBAR</small></div>';
    out+='<div class="hpr-meta-box">تاریخ: '+fmtD(r._meta.generatedAt)+' · '+fmtT(r._meta.generatedAt)+'<br>';
    out+='توسط: '+esc((r._meta.generatedBy&&r._meta.generatedBy.name)||'—')+' ('+esc((r._meta.generatedBy&&r._meta.generatedBy.role)||'—')+')<br>';
    out+='فرمت: SBAR v1.0</div></div>';

    out+='<div class="hpr-pt-bar">';
    out+='<div class="hpr-pt-name">'+esc(h.name)+'</div>';
    out+='<div class="hpr-pt-info">';
    out+='<span>سن: <b>'+esc(h.age)+'</b></span>';
    out+='<span>جنسیت: <b>'+esc(h.sex)+'</b></span>';
    out+='<span>بخش: <b>'+esc(h.ward)+'</b></span>';
    out+='<span>تخت: <b>'+esc(h.bed)+'</b></span>';
    out+='<span>کد ملی: <b>'+esc(h.nationalCode)+'</b></span>';
    out+='<span>پذیرش: <b>'+fmtDT(h.admissionDate)+'</b> ('+h.hoursSinceAdmission+' ساعت)</span>';
    out+='</div>';
    if(s.allergies && s.allergies.length) out+='<div class="hpr-allergy">⚠️ حساسیت دارویی: '+esc(s.allergies.join('، '))+'</div>';
    if(s.isolation) out+='<div class="hpr-isolation">🔒 ایزوله: '+esc(s.isolation)+'</div>';
    out+='</div>';

    out+='<div class="hpr-sbar">';

    // S — Situation
    out+='<div class="hpr-sec"><div class="hpr-sec-h">S — وضعیت فعلی (Situation) <span class="hpr-badge">'+esc(s.currentStatus)+'</span></div><div class="hpr-sec-b">';
    out+='<div class="hpr-row"><span class="k">علت پذیرش:</span><span class="v">'+esc(s.admissionReason)+'</span></div>';
    out+='<div class="hpr-row"><span class="k">پزشک معالج:</span><span class="v">'+esc(s.attendingPhysician)+'</span></div>';
    out+='<div class="hpr-row"><span class="k">کد احیا:</span><span class="v">'+esc(s.codeStatus)+'</span></div>';
    out+='<div class="hpr-row"><span class="k">دستورات فعال:</span><span class="v">'+s.activeOrdersCount+' <span class="hpr-tag warn">'+s.pendingVerifyCount+' در انتظار تأیید</span></span></div>';
    out+='</div></div>';

    // B — Background
    out+='<div class="hpr-sec"><div class="hpr-sec-h">B — پیشینه (Background)</div><div class="hpr-sec-b">';
    if(b.comorbidities && b.comorbidities.length) out+='<div class="hpr-row"><span class="k">بیماری‌های همراه:</span><span class="v">'+esc(b.comorbidities.join('، '))+'</span></div>';
    out+='<div class="hpr-row"><span class="k">وزن:</span><span class="v">'+esc(b.weight||'—')+' kg</span></div>';
    out+='<div class="hpr-row"><span class="k">گروه خونی:</span><span class="v">'+esc(b.bloodType||'—')+'</span></div>';
    out+='<div class="hpr-row"><span class="k">I&O ۲۴h:</span><span class="v">ورودی '+b.io24h.intake+' cc · خروجی '+b.io24h.output+' cc · <b>بالانس '+(b.io24h.balance>=0?'+':'')+b.io24h.balance+' cc</b></span></div>';
    if(b.activeOrders && b.activeOrders.length){
      out+='<div class="hpr-row" style="flex-direction:column;align-items:stretch;"><span class="k" style="margin-bottom:4px;">دستورات فعال:</span>';
      out+='<table class="hpr-table"><thead><tr><th>دارو/نوع</th><th>دوز</th><th>راه</th><th>تکرار</th><th>اولویت</th><th>وضعیت</th></tr></thead><tbody>';
      b.activeOrders.forEach(o => {
        out+='<tr><td>'+esc(o.drug||o.type)+'</td><td>'+esc(o.dose||'—')+'</td><td>'+esc(o.route||'—')+'</td><td>'+esc(o.frequency||'—')+'</td><td>'+priorityTag(o.priority)+'</td><td>'+statusTag(o.status)+'</td></tr>';
      });
      out+='</tbody></table></div>';
    } else {
      out+='<div class="hpr-empty">هیچ دستور فعالی ثبت نشده.</div>';
    }
    out+='</div></div>';

    // A — Assessment
    const aClass = a.newsRisk==='critical'?'critical':a.newsRisk==='high'?'warning':'';
    out+='<div class="hpr-sec"><div class="hpr-sec-h '+aClass+'">A — ارزیابی (Assessment)'+(a.news2!=null?' <span class="hpr-badge">NEWS2 = '+a.news2+' ('+esc(a.newsRisk)+')</span>':'')+'</div><div class="hpr-sec-b">';
    if(a.latestVitals){
      const v=a.latestVitals;
      out+='<div class="hpr-row"><span class="k">آخرین ویزیت:</span><span class="v">'+fmtDT(v.at)+'</span></div>';
      out+='<div class="hpr-row"><span class="k">علائم حیاتی:</span><span class="v">HR '+esc(v.hr||'—')+' · RR '+esc(v.rr||'—')+' · BP '+esc(v.bp||'—')+' · T '+esc(v.temp||'—')+'°C · SpO2 '+esc(v.spo2||'—')+'%'+(v.onOxygen?' (O₂)':'')+'</span></div>';
      out+='<div class="hpr-row"><span class="k">هوشیاری:</span><span class="v">'+esc(v.consciousness)+(v.pain!=null?' · درد: '+v.pain+'/10':'')+'</span></div>';
    } else {
      out+='<div class="hpr-empty">هیچ ویزیت حیاتی ثبت نشده.</div>';
    }
    if(a.activeAlerts && a.activeAlerts.length){
      out+='<div class="hpr-row" style="flex-direction:column;align-items:stretch;"><span class="k" style="margin-bottom:4px;">هشدارهای فعال ('+a.activeAlerts.length+'):</span>';
      out+='<ul class="hpr-list">';
      a.activeAlerts.forEach(x=>{
        const cl = x.severity==='critical'?'🚨':x.severity==='high'?'⚠️':'ℹ️';
        out+='<li>'+cl+' <b>'+esc(x.title||x.type)+'</b> — '+esc(x.message||'')+' <span style="color:#888;">('+fmtT(x.at)+')</span></li>';
      });
      out+='</ul></div>';
    }
    out+='</div></div>';

    // R — Recommendation
    out+='<div class="hpr-sec"><div class="hpr-sec-h">R — اقدامات بعدی (Recommendation)</div><div class="hpr-sec-b">';
    if(rec.overdueMar && rec.overdueMar.length){
      out+='<div class="hpr-row" style="flex-direction:column;align-items:stretch;"><span class="k" style="margin-bottom:4px;color:#a00;">🔴 MAR عقب‌افتاده ('+rec.overdueMar.length+'):</span><ul class="hpr-list">';
      rec.overdueMar.forEach(m=>{ out+='<li><b>'+esc(m.drug)+' '+esc(m.dose)+'</b> '+esc(m.route)+' — <span style="color:#a00;">'+m.minutesLate+' دقیقه تأخیر</span></li>'; });
      out+='</ul></div>';
    }
    if(rec.upcomingMar && rec.upcomingMar.length){
      out+='<div class="hpr-row" style="flex-direction:column;align-items:stretch;"><span class="k" style="margin-bottom:4px;">⏰ در ۴ ساعت آینده ('+rec.upcomingMar.length+'):</span><ul class="hpr-list">';
      rec.upcomingMar.forEach(m=>{ out+='<li><b>'+esc(m.drug)+' '+esc(m.dose)+'</b> '+esc(m.route)+' — در '+m.minutesUntil+' دقیقه ('+fmtT(m.scheduledAt)+')</li>'; });
      out+='</ul></div>';
    }
    if(rec.pendingVerify && rec.pendingVerify.length){
      out+='<div class="hpr-row" style="flex-direction:column;align-items:stretch;"><span class="k" style="margin-bottom:4px;">📋 در انتظار تأیید ('+rec.pendingVerify.length+'):</span><ul class="hpr-list">';
      rec.pendingVerify.forEach(o=>{ out+='<li>'+priorityTag(o.priority)+' <b>'+esc(o.drug||o.type)+' '+esc(o.dose||'')+'</b></li>'; });
      out+='</ul></div>';
    }
    if(rec.pendingConsults && rec.pendingConsults.length){
      out+='<div class="hpr-row" style="flex-direction:column;align-items:stretch;"><span class="k" style="margin-bottom:4px;">🩺 مشاوره در انتظار ('+rec.pendingConsults.length+'):</span><ul class="hpr-list">';
      rec.pendingConsults.forEach(c=>{ out+='<li><b>'+esc(c.targetService)+'</b> ('+esc(c.consultType)+') — '+esc(c.question)+'</li>'; });
      out+='</ul></div>';
    }
    if((!rec.overdueMar||!rec.overdueMar.length) && (!rec.upcomingMar||!rec.upcomingMar.length) && (!rec.pendingVerify||!rec.pendingVerify.length) && (!rec.pendingConsults||!rec.pendingConsults.length)){
      out+='<div class="hpr-empty">هیچ اقدام فوری برای شیفت بعدی وجود ندارد ✅</div>';
    }
    out+='</div></div>';

    out+='</div>'; // sbar

    out+='<div class="hpr-sig"><div>امضای پرستار تحویل‌دهنده</div><div>امضای پرستار تحویل‌گیرنده</div><div>تاریخ و ساعت</div></div>';
    out+='<div class="hpr-footer"><span>NABZ — سیستم مدیریت بیمارستانی</span><span>شناسه: '+esc(h.patientId)+' · تولید: '+fmtDT(r._meta.generatedAt)+'</span></div>';

    return out;
  }

  async function fetchSBAR(pid){
    const r = await fetch('/api/kardex/handover/'+encodeURIComponent(pid),{credentials:'include'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }
  async function fetchOneLine(pid){
    const r = await fetch('/api/kardex/handover/'+encodeURIComponent(pid)+'/oneline',{credentials:'include'});
    if(!r.ok) return '';
    const d = await r.json(); return d.line || '';
  }

  async function load(pid, wrap, page){
    page.innerHTML = '<div class="hpr-empty">در حال تولید گزارش...</div>';
    try {
      const r = await fetchSBAR(pid);
      page.innerHTML = html(r);
      const copyBtn = wrap.querySelector('.hpr-btn-copy');
      if(copyBtn){
        copyBtn.onclick = async () => {
          const line = await fetchOneLine(pid);
          if(!line){ alert('خطا در دریافت خلاصه'); return; }
          try { await navigator.clipboard.writeText(line); copyBtn.textContent='✅ کپی شد'; setTimeout(()=>{copyBtn.textContent='📋 کپی خلاصه';},1500); }
          catch(_){ prompt('خلاصه (کپی دستی):', line); }
        };
      }
    } catch(e){ page.innerHTML = '<div class="hpr-empty">خطا: '+esc(e.message)+'</div>'; }
  }

  function show(panel, data){
    const wrap = document.createElement('div'); wrap.className='hpr-wrap';
    const pid = (data && data.patientId) || (panel && panel.patientId) || new URLSearchParams(location.search).get('patientId');
    if(!pid){ wrap.innerHTML='<div class="hpr-empty">بیمار انتخاب نشده</div>'; return wrap; }

    const tb = document.createElement('div'); tb.className='hpr-toolbar';
    tb.innerHTML = '<button class="hpr-btn-print">🖨️ چاپ / PDF</button>'+
                   '<button class="hpr-btn-copy">📋 کپی خلاصه</button>'+
                   '<button class="hpr-btn-close">بازگشت</button>';
    wrap.appendChild(tb);
    const page = document.createElement('div'); page.className='hpr-page';
    wrap.appendChild(page);

    tb.querySelector('.hpr-btn-print').onclick = () => window.print();
    tb.querySelector('.hpr-btn-close').onclick = () => { if(window.NABZ && NABZ.go) NABZ.go('patients'); else history.back(); };

    load(pid, wrap, page);
    return wrap;
  }

  function tryReg(){
    if(typeof NABZ !== 'undefined' && typeof NABZ.registerKind === 'function'){
      NABZ.registerKind('handover_print', show);
      console.log('[handover_print] registered');
      return true;
    }
    return false;
  }
  if(!tryReg()){ let t=0; const iv=setInterval(()=>{ if(tryReg()||++t>30)clearInterval(iv); },100); }
})();
