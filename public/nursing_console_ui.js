// ═══════════════════════════════════════════════════════════
//  NABZ — Nursing Console UI v3
//  Full patient chart with 10 tabs · overrides nurseHQ patient sheet
// ═══════════════════════════════════════════════════════════
(function(){
'use strict';
const state = { pid:null, tab:'overview', data:null };
const cache = {};

function _api(p,o){return NABZ._api(p,o);}
function _esc(s){return NABZ._esc(s);}
function _close(){document.querySelectorAll('.bs-backdrop').forEach(el=>el.remove());}
function _sheet(html,opts){
  opts=opts||{};
  const s=document.createElement('div');s.className='bs-backdrop';
  s.onclick=e=>{if(e.target===s&&!opts.noClose)s.remove();};
  const c=document.createElement('div');c.className='bs-sheet';
  c.style.maxHeight='97vh';c.style.padding='12px 12px calc(env(safe-area-inset-bottom,0px) + 16px)';
  c.innerHTML=html;
  s.appendChild(c);document.body.appendChild(s);
  requestAnimationFrame(()=>s.classList.add('show'));
  return {sheet:s,content:c};
}
function _ago(iso){if(!iso)return'—';const ms=Date.now()-new Date(iso).getTime();const m=Math.floor(ms/60000);if(m<1)return'الان';if(m<60)return m+'د پیش';const hr=Math.floor(m/60);if(hr<24)return hr+'س پیش';return Math.floor(hr/24)+' روز پیش';}
function _time(iso){if(!iso)return'—';try{return new Date(iso).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'});}catch(_){return'—';}}
function _cls(l){return l==='critical'?'dng':l==='high'?'warn':l==='medium'?'info':'ok';}

// ═══ OPEN ═══
async function open(pid){
  state.pid=pid;state.tab='overview';
  try{
    NABZ._toast('در حال بارگذاری...');
    const d=await _api('/api/nursing/console/'+pid);
    state.data=d;
    _render();
  }catch(e){alert('خطا: '+e.message);}
}

function _render(){
  const d=state.data;if(!d)return;
  const p=d.patient;
  let h='';
  // Header
  h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
  h+='<div style="flex:1"><div style="font-size:17px;font-weight:900">'+_esc(p.name)+'</div>';
  h+='<div style="font-size:11px;color:var(--fg-2);margin-top:2px">'+(p.age||'?')+' سال · '+_esc(p.ward||'')+' · تخت '+_esc(p.bed||'')+'</div>';
  if(p.diagnosis)h+='<div style="font-size:11.5px;font-weight:700;margin-top:3px">'+_esc(p.diagnosis)+'</div>';
  h+='</div>';
  h+='<button style="background:var(--bg-3);border:none;width:32px;height:32px;border-radius:50%;color:var(--fg);font-size:14px;cursor:pointer" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button>';
  h+='</div>';
  // Flags
  if(d.flags&&d.flags.length){
    h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">';
    d.flags.forEach(f=>{h+='<span class="pill '+_cls(f.severity)+'" style="font-size:10px">'+f.icon+' '+_esc(f.text)+'</span>';});
    h+='</div>';
  }
  // Tab bar (scrollable)
  const tabs=[
    ['overview','📊'],['kardex','📋'],['mar','💊'],['iv','💧'],
    ['procedures','💉'],['wound','🩹'],['ventilator','🫁'],['narcotic','🔒'],
    ['assessment','🧠'],['chart','📄']
  ];
  h+='<div style="display:flex;gap:4px;overflow-x:auto;padding-bottom:6px;margin-bottom:8px;-webkit-overflow-scrolling:touch">';
  tabs.forEach(([k,ic])=>{
    const on=state.tab===k;
    h+='<button onclick="NABZ.nurseConsole._setTab(\''+k+'\')" style="min-width:52px;padding:8px 4px;background:'+(on?'var(--primary)':'var(--bg-2)')+';color:'+(on?'#fff':'var(--fg)')+';border:1.5px solid '+(on?'var(--primary)':'var(--border)')+';border-radius:8px;font-family:inherit;font-size:10.5px;font-weight:800;cursor:pointer;flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:2px">';
    h+='<span style="font-size:16px">'+ic+'</span>';
    h+='<span>'+({overview:'خلاصه',kardex:'کاردکس',mar:'MAR',iv:'IV',procedures:'پروسیجر',wound:'زخم',ventilator:'ونتیلاتور',narcotic:'مخدر',assessment:'ارزیابی',chart:'پرونده'})[k]+'</span>';
    h+='</button>';
  });
  h+='</div>';
  h+='<div id="ncBody" style="max-height:calc(97vh - 200px);overflow-y:auto"></div>';
  const s=_sheet(h,{noClose:true});
  _renderTab();
}

function _setTab(t){state.tab=t;_render();}

function _renderTab(){
  const el=document.getElementById('ncBody');if(!el)return;
  const d=state.data;
  if(state.tab==='overview')return _tabOverview(el,d);
  if(state.tab==='kardex')return _tabKardex(el,d);
  if(state.tab==='mar')return _tabMar(el,d);
  if(state.tab==='iv')return _tabIv(el,d);
  if(state.tab==='procedures')return _tabProcedures(el,d);
  if(state.tab==='wound')return _tabWound(el,d);
  if(state.tab==='ventilator')return _tabVentilator(el,d);
  if(state.tab==='narcotic')return _tabNarcotic(el,d);
  if(state.tab==='assessment')return _tabAssessment(el,d);
  if(state.tab==='chart')return _tabChart(el,d);
}

// ═══ TAB: OVERVIEW ═══
function _tabOverview(el,d){
  let h='';
  if(d.vitals&&d.vitals.last){
    const v=d.vitals.last;
    h+='<div class="card" style="padding:10px;margin-bottom:8px;background:linear-gradient(135deg,rgba(6,182,212,.08),transparent)">';
    h+='<div style="display:flex;justify-content:space-between;margin-bottom:6px"><div style="font-size:10.5px;font-weight:900;color:var(--primary)">📈 آخرین ویتال</div><div style="font-size:10px;color:var(--fg-2)">'+_ago(v.recordedAt)+'</div></div>';
    h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">';
    [['HR',v.hr,v.hr>110||v.hr<50?'dng':''],['BP',(v.bp_sys||'—')+'/'+(v.bp_dia||'—'),v.bp_sys<90?'dng':''],['RR',v.rr,v.rr>=22?'warn':''],['T',v.temp?v.temp+'°':'—',v.temp>=38.3?'warn':''],['SpO₂',v.spo2?v.spo2+'%':'—',v.spo2<92?'dng':''],['NEWS2',v.news2,v.news2>=7?'dng':v.news2>=5?'warn':'ok']].forEach(([l,val,c])=>{
      h+='<div style="text-align:center;padding:6px;background:var(--bg-2);border-radius:6px"><div style="font-size:15px;font-weight:900;color:var(--'+(c||'fg')+')">'+_esc(String(val==null?'—':val))+'</div><div style="font-size:9px;color:var(--fg-2)">'+l+'</div></div>';
    });
    h+='</div>';
    if(d.vitals.trend&&d.vitals.trend.dir!=='flat'){
      const tc=d.vitals.trend.dir==='up'?'dng':'ok';
      h+='<div style="margin-top:6px;font-size:10.5px;font-weight:800;color:var(--'+tc+')">'+(d.vitals.trend.dir==='up'?'📈 '+d.vitals.trend.from+' → '+d.vitals.trend.to+' (بدتر)':'📉 '+d.vitals.trend.from+' → '+d.vitals.trend.to+' (بهبود)')+'</div>';
    }
    h+='</div>';
  } else {
    h+='<div class="card" style="padding:10px;margin-bottom:8px;text-align:center;border-color:var(--dng)"><div style="font-size:11.5px;font-weight:900;color:var(--dng)">⚠️ هیچ ویتالی ثبت نشده</div><button class="btn btn-primary btn-block" style="margin-top:6px;padding:8px;font-size:11px" onclick="NABZ.nurseConsole._vitalsForm()">📈 ثبت ویتال</button></div>';
  }
  // I/O
  if(d.io){
    h+='<div class="card" style="padding:8px;margin-bottom:8px">';
    h+='<div style="font-size:10.5px;font-weight:900;color:var(--primary);margin-bottom:4px">💧 I/O ۲۴ ساعت</div>';
    const nc=d.io.net<-1000?'dng':d.io.net<-500?'warn':'ok';
    h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center;font-size:11px"><div><b>'+d.io.last24h_in+'</b><div style="font-size:9px;color:var(--fg-2)">ورودی ml</div></div><div><b>'+d.io.last24h_out+'</b><div style="font-size:9px;color:var(--fg-2)">خروجی ml</div></div><div style="color:var(--'+nc+');font-weight:900">'+(d.io.net>0?'+':'')+d.io.net+'<div style="font-size:9px;color:var(--fg-2);font-weight:400">تعادل</div></div></div>';
    h+='</div>';
  }
  // Alerts
  if(d.sepsis)h+='<div class="hint danger" style="margin-bottom:6px">🦠 سپسیس '+_esc(d.sepsis.status)+' (qSOFA '+(d.sepsis.qsofa?d.sepsis.qsofa.score:0)+')</div>';
  if(d.isolation)h+='<div class="hint warn" style="margin-bottom:6px">🧼 ایزوله '+_esc(d.isolation.type)+' — PPE: '+_esc((d.isolation.ppeRequired||[]).join(', '))+'</div>';
  if(d.restraint)h+='<div class="hint danger" style="margin-bottom:6px">🔒 محدودیت فعال</div>';
  if(d.marSummary&&d.marSummary.overdue.length>0)h+='<div class="hint danger" style="margin-bottom:6px">⏰ '+d.marSummary.overdue.length+' MAR دیرکرد</div>';
  if(d.critLabs&&d.critLabs.length>0)h+='<div class="hint danger" style="margin-bottom:6px">🧪 '+d.critLabs.length+' lab بحرانی بدون read-back</div>';
  // Quick actions
  h+='<div style="font-size:11.5px;font-weight:900;margin:10px 0 6px">⚡ اقدام سریع</div>';
  h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px">';
  h+=_qb('📈','ویتال','NABZ.nurseConsole._vitalsForm()');
  h+=_qb('🩹','درد','NABZ.nurseConsole._painForm()');
  h+=_qb('💧','I/O','NABZ.nurseConsole._ioForm()');
  h+=_qb('📝','یادداشت','NABZ.nurseConsole._noteForm()');
  h+=_qb('🚶','Morse','NABZ.nurseConsole._assessForm(\'morse\')');
  h+=_qb('🛏','Braden','NABZ.nurseConsole._assessForm(\'braden\')');
  h+=_qb('💧','IV','NABZ.nurseConsole._ivForm()');
  h+=_qb('🩹','زخم','NABZ.nurseConsole._woundForm()');
  h+='</div>';
  // Notes (last 3)
  if(d.notes&&d.notes.length){
    h+='<div style="font-size:11.5px;font-weight:900;margin:10px 0 6px">📝 یادداشت‌های اخیر</div>';
    d.notes.slice(0,3).forEach(n=>{
      h+='<div style="padding:6px 8px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;font-size:11px"><b>'+_esc(n.byName||'')+'</b> — '+_ago(n.at)+'<div style="color:var(--fg-2);margin-top:2px">'+_esc((n.text||'').slice(0,120))+'</div></div>';
    });
  }
  el.innerHTML=h;
}

function _qb(ic,lb,fn){return '<button onclick="'+fn+'" style="background:var(--bg-2);border:1.5px solid var(--border);border-radius:8px;padding:8px 4px;text-align:center;font-family:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px"><span style="font-size:20px">'+ic+'</span><span style="font-size:9.5px;font-weight:800">'+lb+'</span></button>';}

// ═══ TAB: KARDEX ═══
function _tabKardex(el,d){
  const k=d.kardex||{};
  const now=Date.now();
  let h='';
  const groups=[
    ['medication','💊 داروها',k.medication],
    ['iv_fluids','💧 IV/سرم',k.iv_fluids],
    ['prn','💊 PRN',k.prn],
    ['narcotic','🔒 مخدر',k.narcotic],
    ['procedure','💉 پروسیجر',k.procedure],
    ['nursing','📋 پرستاری',k.nursing],
    ['diet','🍽 رژیم',k.diet],
    ['activity','🚶 فعالیت',k.activity],
    ['lab','🧪 آزمایش',k.lab],
    ['imaging','🩻 تصویربرداری',k.imaging],
    ['consult','🩺 مشاوره',k.consult],
    ['held','⏸ نگه‌داشته',k.held]
  ];
  let total=0;
  groups.forEach(([k2,lbl,arr])=>{if(arr&&arr.length)total+=arr.length;});
  if(!total){el.innerHTML='<div class="empty" style="padding:30px">هیچ دستور فعالی نیست</div>';return;}
  groups.forEach(([k2,lbl,arr])=>{
    if(!arr||!arr.length)return;
    h+='<div style="font-size:11px;font-weight:900;color:var(--primary);margin:10px 0 6px;padding:4px 8px;background:var(--primary-soft);border-radius:6px">'+lbl+' ('+arr.length+')</div>';
    arr.forEach(o=>{h+=_orderCard(o);});
  });
  el.innerHTML=h;
}

function _orderCard(o){
  const det=o.details||{};
  const isHeld=o.status==='held';
  const isPending=o.status==='pending';
  const cls=isHeld?'info':isPending?'warn':o.priority==='stat'?'dng':'ok';
  let h='<div class="card" style="padding:8px 10px;margin-bottom:4px;border-right:3px solid var(--'+cls+')">';
  h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:4px">';
  h+='<div style="flex:1;min-width:0">';
  h+='<div style="font-size:12px;font-weight:900">'+(det.drug||det.panel||det.note||o.type)+'</div>';
  if(det.dose)h+='<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">'+_esc(det.dose)+' · '+_esc(det.route||'')+' · '+_esc(det.frequency||'')+'</div>';
  if(det.durationDays)h+='<div style="font-size:10px;color:var(--fg-3)">مدت: '+det.durationDays+' روز</div>';
  if(isHeld&&o.holdReason)h+='<div style="font-size:10px;color:var(--info);font-weight:800;margin-top:2px">⏸ '+_esc(o.holdReason)+'</div>';
  h+='</div>';
  h+='<span class="pill '+cls+'" style="font-size:9px">'+({pending:'تأییدنشده',verified:'تأیید',active:'فعال',held:'نگه‌داشته',completed:'انجام',cancelled:'لغو'}[o.status]||o.status)+'</span>';
  h+='</div>';
  h+='<div style="font-size:10px;color:var(--fg-3)">'+_ago(o.orderedAt)+' · '+_esc(o.priority||'routine')+'</div>';
  // Actions
  h+='<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">';
  if(isPending){h+='<button class="btn btn-primary btn-sm" style="padding:4px 10px;font-size:10.5px" onclick="NABZ.nurseConsole._kardexAct(\''+o.id+'\',\'execute\')">✅ اجرا</button>';}
  if(!isHeld&&['verified','active'].includes(o.status)){h+='<button class="btn btn-sm" style="padding:4px 10px;font-size:10.5px;color:var(--info);border-color:var(--info)" onclick="NABZ.nurseConsole._kardexAct(\''+o.id+'\',\'hold\')">⏸ نگه‌داری</button>';}
  if(isHeld){h+='<button class="btn btn-ok btn-sm" style="padding:4px 10px;font-size:10.5px" onclick="NABZ.nurseConsole._kardexAct(\''+o.id+'\',\'resume\')">▶ ادامه</button>';}
  h+='<button class="btn btn-sm" style="padding:4px 10px;font-size:10.5px;color:var(--dng);border-color:var(--dng)" onclick="NABZ.nurseConsole._kardexAct(\''+o.id+'\',\'cancel\')">✗ لغو</button>';
  h+='</div></div>';
  return h;
}

async function _kardexAct(oid, action){
  const reasons={hold:'دلیل نگه‌داری:', cancel:'دلیل لغو:', discontinue:'دلیل قطع:'};
  let reason=null;
  if(reasons[action]){
    reason=prompt(reasons[action]);
    if(action!=='execute'&&(!reason||reason.trim().length<3))return alert('دلیل الزامی');
  }
  if(action==='execute'){
    const note=prompt('یادداشت اجرا (اختیاری):')||'';
    try{
      await _api('/api/nursing/console/'+state.pid+'/kardex/'+oid+'/execute',{method:'POST',body:JSON.stringify({note})});
      NABZ._toast('✅ اجرا ثبت شد');
      await reload();
    }catch(e){alert('خطا: '+e.message);}
    return;
  }
  try{
    await _api('/api/nursing/console/'+state.pid+'/kardex/'+oid+'/'+action,{method:'POST',body:JSON.stringify({reason})});
    NABZ._toast('✅ انجام شد');
    await reload();
  }catch(e){alert('خطا: '+e.message);}
}

// ═══ TAB: MAR ═══
function _tabMar(el,d){
  const mar=d.mar||[];
  const summary=d.marSummary||{};
  let h='';
  if(summary.overdue&&summary.overdue.length)h+='<div class="hint danger" style="margin-bottom:6px">⏰ '+summary.overdue.length+' دوز دیرکرد</div>';
  if(summary.due_1h&&summary.due_1h.length)h+='<div class="hint warn" style="margin-bottom:6px">⏱ '+summary.due_1h.length+' دوز در ۱ ساعت آینده</div>';
  if(summary.prn_pending&&summary.prn_pending.length)h+='<div class="hint info" style="margin-bottom:6px">📊 '+summary.prn_pending.length+' PRN بی‌ارزیابی</div>';
  if(!mar.length){el.innerHTML=h+'<div class="empty" style="padding:30px">MAR خالی است</div>';return;}
  // Group by status
  const groups={due:[],overdue:[],upcoming:[],given:[],missed:[]};
  const now=Date.now();
  mar.forEach(m=>{
    const dueMs=sd(m.scheduledAt);
    if(m.status==='missed')groups.missed.push(m);
    else if(m.status==='given')groups.given.push(m);
    else if(['scheduled','due'].includes(m.status)){
      if(dueMs<now-30*60000)groups.overdue.push(m);
      else if(dueMs<now+3600000)groups.due.push(m);
      else groups.upcoming.push(m);
    }
  });
  if(groups.overdue.length){h+='<div style="font-size:11px;font-weight:900;color:var(--dng);margin:8px 0 4px">⏰ دیرکرد ('+groups.overdue.length+')</div>';groups.overdue.forEach(m=>{h+=_marCard(m,'overdue');});}
  if(groups.due.length){h+='<div style="font-size:11px;font-weight:900;color:var(--warn);margin:8px 0 4px">⚡ در نوبت ('+groups.due.length+')</div>';groups.due.forEach(m=>{h+=_marCard(m,'due');});}
  if(groups.upcoming.length){h+='<div style="font-size:11px;font-weight:900;color:var(--info);margin:8px 0 4px">📅 آینده ('+groups.upcoming.length+')</div>';groups.upcoming.slice(0,10).forEach(m=>{h+=_marCard(m,'upcoming');});}
  if(groups.given.length){h+='<div style="font-size:11px;font-weight:900;color:var(--ok);margin:8px 0 4px">✅ داده‌شده ('+groups.given.length+')</div>';groups.given.slice(0,10).forEach(m=>{h+=_marCard(m,'given');});}
  if(groups.missed.length){h+='<div style="font-size:11px;font-weight:900;color:var(--dng);margin:8px 0 4px">❌ Missed ('+groups.missed.length+')</div>';groups.missed.forEach(m=>{h+=_marCard(m,'missed');});}
  el.innerHTML=h;
}

function _marCard(m,group){
  const cls=group==='overdue'?'dng':group==='missed'?'dng':group==='due'?'warn':group==='given'?'ok':'info';
  let h='<div class="card" style="padding:8px 10px;margin-bottom:3px;border-right:3px solid var(--'+cls+')">';
  h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
  h+='<div style="flex:1;min-width:0">';
  h+='<div style="font-size:12px;font-weight:900">'+(m.isHighAlert?'⚠️ ':'')+_esc(m.drugName||'')+' '+_esc(m.dose||'')+'</div>';
  h+='<div style="font-size:10px;color:var(--fg-2);margin-top:1px">'+_time(m.scheduledAt)+' · '+_esc(m.route||'')+'</div>';
  if(m.status==='missed')h+='<div style="font-size:10px;color:var(--dng);font-weight:800;margin-top:2px">دوز داده نشد</div>';
  if(m.prnEffectivenessPending)h+='<div style="font-size:10px;color:var(--warn);font-weight:800;margin-top:2px">📊 نیاز به اثربخشی</div>';
  h+='</div>';
  if(['scheduled','due'].includes(m.status))h+='<button class="btn btn-primary btn-sm" style="padding:6px 10px;font-size:11px;font-weight:900;min-width:70px" onclick="NABZ.nurseConsole._administerMar(\''+m.id+'\')">💉 توزیع</button>';
  if(m.prnEffectivenessPending)h+='<button class="btn btn-sm" style="padding:6px 10px;font-size:10.5px;color:var(--warn);border-color:var(--warn)" onclick="NABZ.nurseConsole._prnForm(\''+m.id+'\')">📊 اثربخشی</button>';
  h+='</div></div>';
  return h;
}

async function _administerMar(marId){
  try{
    const d=state.data;
    const m=(d.mar||[]).find(x=>x.id===marId);
    if(!m)return alert('دوز یافت نشد');
    const drift=Math.round((Date.now()-new Date(m.scheduledAt).getTime())/60000);
    const isLate=drift>30;
    const needsWitness=m.isHighAlert;
    let h='<div class="bs-handle"></div>';
    h+='<div class="bs-hd"><div class="bs-title">💊 '+_esc(m.drugName)+' '+_esc(m.dose||'')+'</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h+='<div class="card" style="margin-bottom:10px;background:linear-gradient(135deg,rgba(6,182,212,.1),rgba(139,92,246,.05))">';
    h+='<div style="font-weight:900;font-size:13px">'+_esc(d.patient.name)+'</div>';
    h+='<div style="font-size:11px;color:var(--fg-2)">'+_esc(m.route||'')+' · '+(drift>0?drift+' دقیقه دیرکرد':'در نوبت')+'</div>';
    if(needsWitness)h+='<div style="margin-top:6px;padding:6px;background:var(--warn-soft);border-radius:6px;font-size:11px;color:var(--warn);font-weight:900">⚠️ HIGH-ALERT — شاهد الزامی</div>';
    h+='</div>';
    h+='<div style="font-size:11px;font-weight:900;color:var(--primary);margin-bottom:6px">✅ ۵ Rights</div>';
    ['patient','drug','dose','route','time'].forEach((r,i)=>{h+='<label style="display:flex;align-items:center;gap:8px;padding:6px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;font-size:11.5px;cursor:pointer"><input type="checkbox" id="nc_r_'+r+'" checked style="width:18px;height:18px;accent-color:var(--primary)"><span>'+['بیمار صحیح','دارو صحیح','دوز صحیح','مسیر صحیح','زمان صحیح'][i]+'</span></label>';});
    if(isLate){
      h+='<div class="wf-field" style="margin-top:10px"><label style="color:var(--dng);font-weight:900">⏰ دلیل تأخیر *</label><select id="nc_lateReason" style="font-weight:800"><option value="">—</option>';
      const reasons={patient_npo:'NPO',procedure_pending:'پروسیجر',doctor_hold:'دستور پزشک',pharmacy_delay:'داروخانه',clinical_decision:'تصمیم بالینی',patient_refused:'رد بیمار',patient_off_unit:'بیرون بخش',iv_access_issue:'مشکل IV',equipment_issue:'تجهیزات',medication_unavailable:'دارو نیست',other:'سایر'};
      Object.entries(reasons).forEach(([k,v])=>{h+='<option value="'+k+'">'+v+'</option>';});
      h+='</select></div>';
    }
    if(needsWitness)h+='<div class="wf-field" style="margin-top:10px"><label style="color:var(--warn);font-weight:900">👥 کد شاهد *</label><input type="text" id="nc_witness" placeholder="username"></div>';
    h+='<div class="wf-field" style="margin-top:8px"><label>یادداشت</label><textarea id="nc_marNote" rows="2"></textarea></div>';
    h+='<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseConsole._submitMar(\''+marId+'\','+needsWitness+','+isLate+')">✅ توزیع</button>';
    _sheet(h);
  }catch(e){alert('خطا: '+e.message);}
}

async function _submitMar(marId, needsWitness, isLate){
  const rights={};let ok=true;
  ['patient','drug','dose','route','time'].forEach(r=>{const el=document.getElementById('nc_r_'+r);rights[r]=el&&el.checked;if(!rights[r])ok=false;});
  if(!ok)return alert('همه ۵ rights');
  const body={fiveRights:rights};
  if(isLate){const lr=document.getElementById('nc_lateReason');if(!lr||!lr.value)return alert('دلیل تأخیر');body.lateReason=lr.value;}
  if(needsWitness){const w=document.getElementById('nc_witness');if(!w||!w.value.trim())return alert('شاهد الزامی');body.witnessedBy=w.value.trim();}
  const note=document.getElementById('nc_marNote').value;if(note)body.notes=note;
  try{
    await _api('/api/mar/'+marId+'/administer-advanced',{method:'POST',body:JSON.stringify(body)});
    _close();NABZ._toast('✅ توزیع شد');await reload();
  }catch(e){alert('خطا: '+e.message);}
}

function _prnForm(marId){
  let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📊 اثربخشی PRN</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h+='<div class="wf-field"><label>مقیاس</label><select id="nc_prnScale"><option value="pain">درد</option><option value="nausea">تهوع</option><option value="anxiety">اضطراب</option><option value="dyspnea">تنگی نفس</option></select></div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="wf-field"><label>قبل</label><input type="number" id="nc_prnBefore" value="8" min="0" max="10" style="font-size:20px;text-align:center;font-weight:900;padding:10px"></div><div class="wf-field"><label>بعد</label><input type="number" id="nc_prnAfter" min="0" max="10" style="font-size:20px;text-align:center;font-weight:900;padding:10px"></div></div>';
  h+='<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseConsole._submitPrn(\''+marId+'\')">✅ ثبت</button>';
  _sheet(h);
}

async function _submitPrn(marId){
  const body={scale:document.getElementById('nc_prnScale').value,before:parseFloat(document.getElementById('nc_prnBefore').value),after:parseFloat(document.getElementById('nc_prnAfter').value)};
  if(isNaN(body.before)||isNaN(body.after))return alert('مقادیر الزامی');
  try{await _api('/api/mar/'+marId+'/prn-effectiveness',{method:'POST',body:JSON.stringify(body)});_close();NABZ._toast('✅ ثبت شد');await reload();}catch(e){alert('خطا: '+e.message);}
}

// ═══ TAB: IV ═══
function _tabIv(el,d){
  const ivs=d.ivs||[];
  let h='<button class="btn btn-primary btn-block" style="padding:10px;margin-bottom:10px;font-weight:900" onclick="NABZ.nurseConsole._ivForm()">➕ شروع IV جدید</button>';
  if(!ivs.length){el.innerHTML=h+'<div class="empty" style="padding:30px">IV فعالی نیست</div>';return;}
  ivs.forEach(iv=>{
    const now=Date.now();
    const checkDueMs=sd(iv.nextCheckDueAt);
    const checkCls=checkDueMs<now?'dng':checkDueMs<now+3600000?'warn':'ok';
    h+='<div class="card" style="padding:10px;margin-bottom:6px;border-right:3px solid var(--'+checkCls+')">';
    h+='<div style="display:flex;justify-content:space-between;margin-bottom:6px">';
    h+='<div><div style="font-size:13px;font-weight:900">💧 '+_esc(iv.site)+' — '+_esc(iv.gauge)+'</div>';
    h+='<div style="font-size:10.5px;color:var(--fg-2)">'+_esc(iv.fluid)+' · '+iv.rate+' '+_esc(iv.rateUnit)+'</div>';
    h+='<div style="font-size:10px;color:var(--fg-3)">شروع: '+_time(iv.startedAt)+' · '+_esc(iv.startedByName||'')+'</div></div>';
    h+='</div>';
    h+='<div style="font-size:10.5px;color:var(--'+checkCls+');font-weight:800;margin-bottom:6px">⏰ چک بعدی: '+(checkDueMs<now?'گذشته':_time(iv.nextCheckDueAt))+'</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">';
    h+='<button class="btn btn-sm" style="padding:6px;font-size:10.5px;color:var(--primary);border-color:var(--primary)" onclick="NABZ.nurseConsole._ivRateForm(\''+iv.id+'\','+iv.rate+',\''+_esc(iv.rateUnit)+'\')">⚙️ تغییر Rate</button>';
    h+='<button class="btn btn-sm" style="padding:6px;font-size:10.5px;color:var(--ok);border-color:var(--ok)" onclick="NABZ.nurseConsole._ivCheckForm(\''+iv.id+'\')">✅ چک سایت</button>';
    h+='<button class="btn btn-sm" style="padding:6px;font-size:10.5px;color:var(--dng);border-color:var(--dng);grid-column:span 2" onclick="NABZ.nurseConsole._ivDiscontinue(\''+iv.id+'\')">✗ قطع</button>';
    h+='</div></div>';
  });
  el.innerHTML=h;
}

function _ivForm(){
  let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">💧 شروع IV</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h+='<div class="wf-field"><label>سایت *</label><select id="nc_ivSite"><option value="ساعد راست">ساعد راست</option><option value="ساعد چپ">ساعد چپ</option><option value="پشت دست راست">پشت دست راست</option><option value="پشت دست چپ">پشت دست چپ</option><option value="AC راست">AC راست</option><option value="AC چپ">AC چپ</option><option value="ساب کلاوین راست">ساب کلاوین راست</option><option value="ساب کلاوین چپ">ساب کلاوین چپ</option><option value="ژوگولار راست">ژوگولار راست</option><option value="ژوگولار چپ">ژوگولار چپ</option></select></div>';
  h+='<div class="wf-field"><label>Gauge</label><select id="nc_ivGauge"><option>24G</option><option>22G</option><option selected>20G</option><option>18G</option><option>16G</option><option>14G</option></select></div>';
  h+='<div class="wf-field"><label>مایع</label><select id="nc_ivFluid"><option>NS 0.9%</option><option>D5W</option><option>LR</option><option>D5 1/2 NS</option><option>Half NS</option></select></div>';
  h+='<div class="wf-field"><label>Rate (mL/h) *</label><input type="number" id="nc_ivRate" value="100" style="font-size:18px;text-align:center;font-weight:900"></div>';
  h+='<div class="wf-field"><label>Pump Serial (اختیاری)</label><input type="text" id="nc_ivPump"></div>';
  h+='<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseConsole._submitIv()">✅ شروع</button>';
  _sheet(h);
}

async function _submitIv(){
  const body={site:document.getElementById('nc_ivSite').value,gauge:document.getElementById('nc_ivGauge').value,fluid:document.getElementById('nc_ivFluid').value,rate:parseFloat(document.getElementById('nc_ivRate').value),pumpSerial:document.getElementById('nc_ivPump').value||null};
  try{await _api('/api/nursing/console/'+state.pid+'/iv',{method:'POST',body:JSON.stringify(body)});_close();NABZ._toast('✅ IV شروع شد');await reload();}catch(e){alert('خطا: '+e.message);}
}

function _ivRateForm(ivId, currentRate, unit){
  let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">⚙️ تغییر Rate</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h+='<div style="font-size:11px;color:var(--fg-2);margin-bottom:8px">نرخ فعلی: '+currentRate+' '+unit+'</div>';
  h+='<div class="wf-field"><label>نرخ جدید *</label><input type="number" id="nc_ivNewRate" value="'+currentRate+'" style="font-size:20px;text-align:center;font-weight:900"></div>';
  h+='<div class="wf-field"><label>دلیل *</label><select id="nc_ivReason"><option value="دستور پزشک">دستور پزشک</option><option value="تغییر وضعیت">تغییر وضعیت</option><option value="پایان مایع">پایان مایع</option><option value="سایر">سایر</option></select></div>';
  h+='<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseConsole._submitRate(\''+ivId+'\')">✅ ثبت</button>';
  _sheet(h);
}

async function _submitRate(ivId){
  const body={rate:parseFloat(document.getElementById('nc_ivNewRate').value),reason:document.getElementById('nc_ivReason').value};
  try{await _api('/api/nursing/console/'+state.pid+'/iv/'+ivId+'/rate',{method:'POST',body:JSON.stringify(body)});_close();NABZ._toast('✅ ثبت شد');await reload();}catch(e){alert('خطا: '+e.message);}
}

function _ivCheckForm(ivId){
  let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">✅ چک سایت IV</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h+='<div class="wf-field"><label>یافته</label><select id="nc_ivFinding" style="font-size:12px"><option value="intact">✅ سالم</option><option value="redness">قرمزی</option><option value="swelling">تورم</option><option value="pain">درد</option><option value="infiltration">نفوذ مایع</option><option value="phlebitis">فلبیت</option><option value="dislodged">جابجایی</option></select></div>';
  h+='<div class="wf-field"><label>یادداشت</label><textarea id="nc_ivNotes" rows="2"></textarea></div>';
  h+='<div class="hint warn" style="font-size:11px;margin-top:8px">⚠️ اگر نفوذ/فلبیت/جابجایی = IV خودکار قطع می‌شود</div>';
  h+='<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseConsole._submitCheck(\''+ivId+'\')">✅ ثبت</button>';
  _sheet(h);
}

async function _submitCheck(ivId){
  const body={finding:document.getElementById('nc_ivFinding').value,notes:document.getElementById('nc_ivNotes').value};
  try{await _api('/api/nursing/console/'+state.pid+'/iv/'+ivId+'/check',{method:'POST',body:JSON.stringify(body)});_close();NABZ._toast('✅ ثبت شد');await reload();}catch(e){alert('خطا: '+e.message);}
}

async function _ivDiscontinue(ivId){
  const reason=prompt('دلیل قطع:','پایان درمان');
  if(!reason)return;
  try{await _api('/api/nursing/console/'+state.pid+'/iv/'+ivId+'/discontinue',{method:'POST',body:JSON.stringify({reason})});NABZ._toast('✅ قطع شد');await reload();}catch(e){alert('خطا: '+e.message);}
}

// ═══ TAB: PROCEDURES ═══
function _tabProcedures(el,d){
  const k=d.kardex||{};
  const procs=k.procedure||[];
  let h='<div class="hint info" style="margin-bottom:8px">برای ایجاد پروسیجر از پنل "encounters" استفاده کنید</div>';
  if(!procs.length){el.innerHTML=h+'<div class="empty" style="padding:30px">پروسیجر فعالی نیست</div>';return;}
  procs.forEach(o=>{h+=_orderCard(o);});
  el.innerHTML=h;
}

// ═══ TAB: WOUND ═══
function _tabWound(el,d){
  const ws=d.wounds||[];
  let h='<button class="btn btn-primary btn-block" style="padding:10px;margin-bottom:10px;font-weight:900" onclick="NABZ.nurseConsole._woundForm()">➕ ثبت زخم جدید</button>';
  if(!ws.length){el.innerHTML=h+'<div class="empty" style="padding:30px">زخم فعالی نیست</div>';return;}
  ws.forEach(w=>{
    h+='<div class="card" style="padding:10px;margin-bottom:6px">';
    h+='<div style="font-size:13px;font-weight:900">🩹 '+_esc(w.location)+' — Stage '+_esc(w.stage)+'</div>';
    h+='<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">اندازه: '+_esc(w.size||'—')+' · ترشح: '+_esc(w.drainage)+'</div>';
    h+='<div style="font-size:10.5px;color:var(--fg-2)">آخرین پانسمان: '+_ago(w.lastDressingAt)+'</div>';
    h+='<button class="btn btn-sm btn-block" style="margin-top:6px;padding:6px;font-size:11px;color:var(--primary);border-color:var(--primary)" onclick="NABZ.nurseConsole._dressingForm(\''+w.id+'\')">💉 تغییر پانسمان</button>';
    h+='</div>';
  });
  el.innerHTML=h;
}

function _woundForm(){
  let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🩹 زخم جدید</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h+='<div class="wf-field"><label>محل *</label><input type="text" id="nc_wLoc" placeholder="ساکروم، پاشنه راست، ..."></div>';
  h+='<div class="wf-field"><label>Stage</label><select id="nc_wStage"><option value="1">Stage 1</option><option value="2">Stage 2</option><option value="3">Stage 3</option><option value="4">Stage 4</option><option value="unstageable">Unstageable</option><option value="dtpi">DTPI</option><option value="surgical">جراحی</option><option value="burn">سوختگی</option></select></div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><div class="wf-field"><label>اندازه</label><input type="text" id="nc_wSize" placeholder="2x3 cm"></div><div class="wf-field"><label>عمق</label><input type="text" id="nc_wDepth" placeholder="0.5 cm"></div></div>';
  h+='<div class="wf-field"><label>ترشح</label><select id="nc_wDrain"><option value="none">ندارد</option><option value="serous">سروز</option><option value="sanguineous">خونی</option><option value="purulent">چرکی</option></select></div>';
  h+='<label style="display:flex;gap:8px;padding:8px;background:var(--dng-soft);border-radius:6px;margin:8px 0;font-size:11.5px"><input type="checkbox" id="nc_wInfection" style="width:18px;height:18px"><span><b>علائم عفونت</b> (قرمزی، گرمی، چرک)</span></label>';
  h+='<div class="wf-field"><label>فاصله تعویض (ساعت)</label><input type="number" id="nc_wInterval" value="24"></div>';
  h+='<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseConsole._submitWound()">✅ ثبت</button>';
  _sheet(h);
}

async function _submitWound(){
  const body={location:document.getElementById('nc_wLoc').value,stage:document.getElementById('nc_wStage').value,size:document.getElementById('nc_wSize').value,depth:document.getElementById('nc_wDepth').value,drainage:document.getElementById('nc_wDrain').value,infectionSigns:document.getElementById('nc_wInfection').checked,dressingChangeInterval:parseInt(document.getElementById('nc_wInterval').value)||24};
  if(!body.location)return alert('محل الزامی');
  try{await _api('/api/nursing/console/'+state.pid+'/wound',{method:'POST',body:JSON.stringify(body)});_close();NABZ._toast('✅ ثبت شد');await reload();}catch(e){alert('خطا: '+e.message);}
}

function _dressingForm(wid){
  let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">💉 تغییر پانسمان</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h+='<div class="wf-field"><label>یافته‌ها *</label><textarea id="nc_dFindings" rows="3" placeholder="ظاهر، بافت، ترشح..."></textarea></div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><div class="wf-field"><label>اندازه جدید</label><input type="text" id="nc_dSize"></div><div class="wf-field"><label>ترشح جدید</label><select id="nc_dDrain"><option value="">بدون تغییر</option><option value="none">ندارد</option><option value="serous">سروز</option><option value="sanguineous">خونی</option><option value="purulent">چرکی</option></select></div></div>';
  h+='<div class="wf-field"><label>پانسمان استفاده‌شده</label><input type="text" id="nc_dDressing" placeholder="Tegaderm, hydrocolloid, ..."></div>';
  h+='<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseConsole._submitDressing(\''+wid+'\')">✅ ثبت</button>';
  _sheet(h);
}

async function _submitDressing(wid){
  const body={findings:document.getElementById('nc_dFindings').value,size:document.getElementById('nc_dSize').value,drainage:document.getElementById('nc_dDrain').value,dressingUsed:document.getElementById('nc_dDressing').value};
  if(!body.findings)return alert('یافته‌ها الزامی');
  try{await _api('/api/nursing/console/'+state.pid+'/wound/'+wid+'/dressing',{method:'POST',body:JSON.stringify(body)});_close();NABZ._toast('✅ ثبت شد');await reload();}catch(e){alert('خطا: '+e.message);}
}

// ═══ TAB: VENTILATOR ═══
function _tabVentilator(el,d){
  const v=d.ventilator;
  let h='<button class="btn btn-primary btn-block" style="padding:10px;margin-bottom:10px;font-weight:900" onclick="NABZ.nurseConsole._ventForm()">➕ ثبت تنظیمات</button>';
  if(!v){el.innerHTML=h+'<div class="empty" style="padding:30px">هیچ ثبت ونتيلاتوری نیست</div>';return;}
  h+='<div class="card" style="padding:10px;margin-bottom:6px">';
  h+='<div style="font-size:13px;font-weight:900;margin-bottom:6px">🫁 '+_esc(v.mode)+' — '+_ago(v.at)+'</div>';
  h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:11px">';
  [['FiO₂',v.fio2+'%'],['PEEP',v.peep],['VT',v.tidalVolume],['Rate',v.rate],['SpO₂',v.spo2||'—'],['RASS',v.rass||'—']].forEach(([l,val])=>{
    h+='<div style="text-align:center;padding:4px;background:var(--bg-2);border-radius:4px"><b>'+val+'</b><div style="font-size:9px;color:var(--fg-2)">'+l+'</div></div>';
  });
  h+='</div>';
  // VAP bundle
  const vb=v.vapBundle||{};
  const bundleDone=Object.values(vb).filter(Boolean).length;
  h+='<div style="margin-top:8px;font-size:10.5px"><b>VAP bundle:</b> '+bundleDone+'/5</div>';
  h+='</div>';
  el.innerHTML=h;
}

function _ventForm(){
  let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🫁 تنظیمات ونتيلاتور</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h+='<div class="wf-field"><label>Mode</label><select id="nc_vMode"><option>AC/VC</option><option>AC/PC</option><option>SIMV</option><option>PSV</option><option>CPAP</option></select></div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
  [['FiO₂ %','nc_vFio2',40],['PEEP','nc_vPeep',5],['VT (mL)','nc_vVt',450],['Rate','nc_vRate',14],['SpO₂ %','nc_vSpo2',''],['RASS','nc_vRass','']].forEach(([l,id,def])=>{h+='<div class="wf-field"><label>'+l+'</label><input type="number" id="'+id+'" value="'+def+'" style="text-align:center;font-weight:800"></div>';});
  h+='</div>';
  h+='<div style="font-size:11px;font-weight:900;margin:10px 0 4px">VAP Bundle</div>';
  [['nc_vHob','HOB ۳۰-۴۵°'],['nc_vOral','مراقبت دهان'],['nc_vSed','Sedation vacation'],['nc_vDvt','DVT prophylaxis'],['nc_vPud','PUD prophylaxis']].forEach(([id,l])=>{h+='<label style="display:flex;gap:6px;padding:4px;font-size:11px"><input type="checkbox" id="'+id+'" style="width:16px;height:16px"><span>'+l+'</span></label>';});
  h+='<label style="display:flex;gap:6px;padding:8px;background:var(--ok-soft);border-radius:6px;margin:8px 0;font-size:11.5px"><input type="checkbox" id="nc_vWean" style="width:18px;height:18px"><span>🟢 آماده Weaning</span></label>';
  h+='<button class="btn btn-primary btn-block" style="padding:14px;margin-top:8px;font-weight:900" onclick="NABZ.nurseConsole._submitVent()">✅ ثبت</button>';
  _sheet(h);
}

async function _submitVent(){
  const body={mode:document.getElementById('nc_vMode').value,fio2:parseFloat(document.getElementById('nc_vFio2').value),peep:parseFloat(document.getElementById('nc_vPeep').value),tidalVolume:parseFloat(document.getElementById('nc_vVt').value),rate:parseFloat(document.getElementById('nc_vRate').value),spo2:parseFloat(document.getElementById('nc_vSpo2').value)||null,rass:parseFloat(document.getElementById('nc_vRass').value)||null,vapBundle:{hob30:document.getElementById('nc_vHob').checked,oralCare:document.getElementById('nc_vOral').checked,sedationVacation:document.getElementById('nc_vSed').checked,dvtProphylaxis:document.getElementById('nc_vDvt').checked,pudProphylaxis:document.getElementById('nc_vPud').checked},weaningReady:document.getElementById('nc_vWean').checked};
  try{await _api('/api/nursing/console/'+state.pid+'/ventilator',{method:'POST',body:JSON.stringify(body)});_close();NABZ._toast('✅ ثبت شد');await reload();}catch(e){alert('خطا: '+e.message);}
}

// ═══ TAB: NARCOTIC ═══
function _tabNarcotic(el,d){
  const ns=d.narcotics||[];
  if(!ns.length){el.innerHTML='<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">✅</div><div style="font-weight:900;margin-top:8px">هیچ مخدر بدون امضا نیست</div></div>';return;}
  let h='<div class="hint warn" style="margin-bottom:8px">⚠️ '+ns.length+' دوز مخدر منتظر امضای دوگانه</div>';
  ns.forEach(m=>{
    h+='<div class="card" style="padding:10px;margin-bottom:6px;border-right:3px solid var(--dng)">';
    h+='<div style="font-size:12.5px;font-weight:900">🔒 '+_esc(m.drugName)+' '+_esc(m.dose||'')+'</div>';
    h+='<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">'+_ago(m.administeredAt)+' · '+_esc(m.administeredByName||'')+'</div>';
    h+='<button class="btn btn-primary btn-block" style="margin-top:6px;padding:8px;font-size:11px;font-weight:900" onclick="NABZ.nurseConsole._narcoticSign(\''+m.id+'\')">✍️ امضای دوگانه</button>';
    h+='</div>';
  });
  el.innerHTML=h;
}

function _narcoticSign(mid){
  let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🔒 امضای دوگانه مخدر</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h+='<div class="hint danger" style="margin-bottom:8px">JCI: هر دوز مخدر نیاز به شاهد مستقل دارد</div>';
  h+='<div class="wf-field"><label>کد شاهد *</label><input type="text" id="nc_ntWitness" placeholder="username"></div>';
  h+='<div class="wf-field"><label>مقدار دورریز (mL)</label><input type="number" id="nc_ntWasted" value="0" step="0.1"></div>';
  h+='<div class="wf-field"><label>دلیل دورریز</label><input type="text" id="nc_ntReason" placeholder="partial dose / patient refused remainder"></div>';
  h+='<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseConsole._submitNarcotic(\''+mid+'\')">✅ امضا</button>';
  _sheet(h);
}

async function _submitNarcotic(mid){
  const body={witnessedBy:document.getElementById('nc_ntWitness').value.trim(),wasted:parseFloat(document.getElementById('nc_ntWasted').value)||0,wasteReason:document.getElementById('nc_ntReason').value};
  if(!body.witnessedBy)return alert('کد شاهد الزامی');
  try{await _api('/api/nursing/console/'+state.pid+'/narcotic/'+mid+'/sign',{method:'POST',body:JSON.stringify(body)});_close();NABZ._toast('✅ امضا شد');await reload();}catch(e){alert('خطا: '+e.message);}
}

// ═══ TAB: ASSESSMENT ═══
function _tabAssessment(el,d){
  let h='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">';
  h+='<button class="btn" style="padding:12px;font-size:11.5px;font-weight:900" onclick="NABZ.nurseConsole._assessForm(\'morse\')">🚶 Morse</button>';
  h+='<button class="btn" style="padding:12px;font-size:11.5px;font-weight:900" onclick="NABZ.nurseConsole._assessForm(\'braden\')">🛏 Braden</button>';
  h+='<button class="btn" style="padding:12px;font-size:11.5px;font-weight:900" onclick="NABZ.nurseConsole._painForm()">🩹 Pain</button>';
  h+='<button class="btn" style="padding:12px;font-size:11.5px;font-weight:900" onclick="NABZ.nurseConsole._vitalsForm()">📈 Vitals</button>';
  h+='</div>';
  if(d.morse){
    h+='<div class="card" style="padding:8px;margin-bottom:6px"><b>Morse:</b> '+d.morse.score+' ('+d.morse.level+') — '+_ago(d.morse.computedAt)+'</div>';
  } else {
    h+='<div class="hint warn" style="margin-bottom:6px">⚠️ Morse ارزیابی نشده</div>';
  }
  if(d.braden){
    h+='<div class="card" style="padding:8px;margin-bottom:6px"><b>Braden:</b> '+d.braden.score+' ('+d.braden.level+') — '+_ago(d.braden.computedAt)+'</div>';
  } else {
    h+='<div class="hint warn" style="margin-bottom:6px">⚠️ Braden ارزیابی نشده</div>';
  }
  if(d.painAgeHrs!==null){
    h+='<div class="card" style="padding:8px"><b>آخرین Pain:</b> '+d.painAgeHrs+' ساعت پیش</div>';
  } else {
    h+='<div class="hint warn">⚠️ Pain ثبت نشده</div>';
  }
  el.innerHTML=h;
}

function _assessForm(type){
  if(type==='morse'){
    let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🚶 Morse Fall</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    [['nc_mHist','سابقه سقوط (۲۵)'],['nc_mDx','تشخیص ثانویه (۱۵)'],['nc_mIv','سرم/هپارین (۲۰)']].forEach(([id,l])=>{h+='<label style="display:flex;gap:8px;padding:6px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;font-size:11.5px"><input type="checkbox" id="'+id+'" style="width:18px;height:18px"><span>'+l+'</span></label>';});
    h+='<div class="wf-field"><label>وسیله کمکی</label><select id="nc_mAid"><option value="none">ندارد</option><option value="crutch_cane_walker">عصا/واکر (۱۵)</option><option value="furniture">مبلمان (۳۰)</option></select></div>';
    h+='<div class="wf-field"><label>راه‌رفتن</label><select id="nc_mGait"><option value="normal">طبیعی</option><option value="weak">ضعیف (۲۰)</option><option value="impaired">مختل (۱۰)</option></select></div>';
    h+='<div class="wf-field"><label>وضعیت روانی</label><select id="nc_mMental"><option value="oriented">آگاه</option><option value="overestimates">بیش‌برآورد (۱۵)</option></select></div>';
    h+='<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseConsole._submitMorse()">✅ ثبت</button>';
    _sheet(h);return;
  }
  if(type==='braden'){
    let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🛏 Braden Scale</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    [['nc_bSensory','حسی (1-4)',3],['nc_bMoisture','رطوبت (1-4)',2],['nc_bActivity','فعالیت (1-4)',2],['nc_bMobility','تحرک (1-4)',2],['nc_bNutrition','تغذیه (1-4)',3],['nc_bFriction','اصطکاک (1-3)',2]].forEach(([id,l,def])=>{h+='<div class="wf-field"><label>'+l+'</label><input type="number" id="'+id+'" value="'+def+'" min="1" style="text-align:center;font-weight:900"></div>';});
    h+='<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseConsole._submitBraden()">✅ ثبت</button>';
    _sheet(h);return;
  }
}

async function _submitMorse(){
  const body={type:'morse',historyOfFalling:document.getElementById('nc_mHist').checked,secondaryDiagnosis:document.getElementById('nc_mDx').checked,ivOrHeparinLock:document.getElementById('nc_mIv').checked,ambulatoryAid:document.getElementById('nc_mAid').value,gait:document.getElementById('nc_mGait').value,mentalStatus:document.getElementById('nc_mMental').value};
  try{await _api('/api/nursing/console/'+state.pid+'/assessment',{method:'POST',body:JSON.stringify(body)});_close();NABZ._toast('✅ ثبت شد');await reload();}catch(e){alert('خطا: '+e.message);}
}

async function _submitBraden(){
  const body={type:'braden',sensory:parseInt(document.getElementById('nc_bSensory').value),moisture:parseInt(document.getElementById('nc_bMoisture').value),activity:parseInt(document.getElementById('nc_bActivity').value),mobility:parseInt(document.getElementById('nc_bMobility').value),nutrition:parseInt(document.getElementById('nc_bNutrition').value),friction:parseInt(document.getElementById('nc_bFriction').value)};
  try{await _api('/api/nursing/console/'+state.pid+'/assessment',{method:'POST',body:JSON.stringify(body)});_close();NABZ._toast('✅ ثبت شد');await reload();}catch(e){alert('خطا: '+e.message);}
}

// ═══ TAB: CHART ═══
function _tabChart(el,d){
  let h='';
  // Labs
  if(d.labs&&d.labs.length){
    h+='<div style="font-size:11px;font-weight:900;color:var(--primary);margin-bottom:4px">🧪 آزمایشات اخیر</div>';
    d.labs.slice(0,5).forEach(l=>{
      const crit=l.criticalFlags&&l.criticalFlags.length;
      h+='<div style="padding:6px 8px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;border-right:3px solid var(--'+(crit?'dng':'border')+')">';
      h+='<div style="font-size:11.5px;font-weight:800">'+_esc(l.panelName||l.panelCode)+' '+(crit?'⚠️':'')+'</div>';
      h+='<div style="font-size:10px;color:var(--fg-2)">'+_ago(l.resultedAt||l.orderedAt)+' · '+_esc(l.status)+'</div>';
      h+='</div>';
    });
  }
  // Imaging
  if(d.rads&&d.rads.length){
    h+='<div style="font-size:11px;font-weight:900;color:var(--primary);margin:10px 0 4px">🩻 تصویربرداری</div>';
    d.rads.slice(0,3).forEach(r=>{
      h+='<div style="padding:6px 8px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;border-right:3px solid var(--'+(r.criticalFlag?'dng':'border')+')"><div style="font-size:11.5px;font-weight:800">'+_esc(r.modality+' '+r.bodyPart)+'</div><div style="font-size:10px;color:var(--fg-2)">'+_ago(r.reportedAt||r.orderedAt)+' · '+_esc(r.status)+'</div></div>';
    });
  }
  // Rounds
  if(d.rounds&&d.rounds.length){
    h+='<div style="font-size:11px;font-weight:900;color:var(--primary);margin:10px 0 4px">📝 راند‌های اخیر</div>';
    d.rounds.forEach(r=>{
      h+='<div style="padding:6px 8px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;font-size:11px"><b>'+_esc(r.authorName||'')+'</b> — '+_ago(r.createdAt)+'<div style="color:var(--fg-2);margin-top:2px">'+_esc((r.assessment&&r.assessment.clinicalImpression||'').slice(0,100))+'</div></div>';
    });
  }
  if(!h)h='<div class="empty" style="padding:30px">داده‌ای برای نمایش نیست</div>';
  el.innerHTML=h;
}

// ═══ ADD-ONS (from overview) ═══
function _vitalsForm(){
  let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📈 ثبت ویتال</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">';
  [['HR','nc_v_hr','bpm'],['SBP','nc_v_sbp','mmHg'],['DBP','nc_v_dbp','mmHg'],['RR','nc_v_rr','/min'],['T','nc_v_t','°C'],['SpO₂','nc_v_spo2','%']].forEach(([l,id,ph])=>{h+='<div class="wf-field" style="margin:0"><label style="font-size:10px">'+l+'</label><input type="number" step="0.1" id="'+id+'" placeholder="'+ph+'" style="width:100%;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:14px;text-align:center;font-weight:900" oninput="NABZ.nurseConsole._news()"></div>';});
  h+='</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">';
  h+='<div class="wf-field" style="margin:0"><label style="font-size:10px">GCS</label><input type="number" id="nc_v_gcs" value="15" min="3" max="15" style="width:100%;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:14px;text-align:center" oninput="NABZ.nurseConsole._news()"></div>';
  h+='<div class="wf-field" style="margin:0"><label style="font-size:10px">Pain</label><input type="number" id="nc_v_pain" value="0" min="0" max="10" style="width:100%;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:14px;text-align:center"></div>';
  h+='</div>';
  h+='<label style="display:flex;gap:8px;padding:8px;background:var(--bg-2);border-radius:6px;margin:10px 0;font-size:11.5px"><input type="checkbox" id="nc_v_o2" onchange="NABZ.nurseConsole._news()" style="width:18px;height:18px"><span>اکسیژن مکمل</span></label>';
  h+='<div style="text-align:center;padding:8px;background:var(--bg-3);border-radius:8px"><div style="font-size:28px;font-weight:900;color:var(--fg-2)" id="nc_v_newsPreview">0</div><div style="font-size:9px;color:var(--fg-2)">NEWS2 پیش‌نمایش</div></div>';
  h+='<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseConsole._submitVitals()">✅ ثبت</button>';
  _sheet(h);
  setTimeout(()=>_news(),50);
}

function _news(){
  let n=0;
  const g=id=>{const el=document.getElementById(id);return el&&el.value!==''?parseFloat(el.value):null;};
  const rr=g('nc_v_rr');if(rr!=null&&!isNaN(rr))n+=rr<=8?3:rr<=11?1:rr<=20?0:rr<=24?2:3;
  const spo2=g('nc_v_spo2');if(spo2!=null&&!isNaN(spo2))n+=spo2<=91?3:spo2<=93?2:spo2<=95?1:0;
  const o2=document.getElementById('nc_v_o2');if(o2&&o2.checked)n+=2;
  const sbp=g('nc_v_sbp');if(sbp!=null&&!isNaN(sbp)&&sbp>0)n+=sbp<=90?3:sbp<=100?2:sbp<=110?1:sbp<=219?0:3;
  const hr=g('nc_v_hr');if(hr!=null&&!isNaN(hr)&&hr>0)n+=hr<=40?3:hr<=50?1:hr<=90?0:hr<=110?1:hr<=130?2:3;
  const gcs=g('nc_v_gcs');if(gcs!=null&&!isNaN(gcs)&&gcs<15)n+=3;
  const temp=g('nc_v_t');if(temp!=null&&!isNaN(temp)&&temp>0)n+=temp<=35?3:temp<=36?1:temp<=38?0:temp<=39?1:2;
  const el=document.getElementById('nc_v_newsPreview');
  if(el){el.textContent=n;el.style.color=n>=7?'var(--dng)':n>=5?'var(--warn)':n>=1?'var(--info)':'var(--ok)';}
}

async function _submitVitals(){
  const g=id=>{const el=document.getElementById(id);return el&&el.value!==''?parseFloat(el.value):null;};
  const body={patientId:state.pid,hr:g('nc_v_hr'),bp_sys:g('nc_v_sbp'),bp_dia:g('nc_v_dbp'),rr:g('nc_v_rr'),temp:g('nc_v_t'),spo2:g('nc_v_spo2'),gcs:g('nc_v_gcs'),pain:g('nc_v_pain'),onOxygen:(document.getElementById('nc_v_o2')||{}).checked};
  try{const r=await _api('/api/nurse/quick/vitals',{method:'POST',body:JSON.stringify(body)});_close();NABZ._toast('✅ NEWS2 '+r.news2);await reload();}catch(e){alert('خطا: '+e.message);}
}

function _painForm(){
  let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🩹 ارزیابی درد</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h+='<div class="wf-field"><label>شدت (۰-۱۰)</label><input type="number" id="nc_pScore" value="0" min="0" max="10" style="font-size:26px;text-align:center;font-weight:900;padding:10px"></div>';
  h+='<div class="wf-field"><label>یادداشت</label><textarea id="nc_pNote" rows="2"></textarea></div>';
  h+='<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseConsole._submitPain()">✅ ثبت</button>';
  _sheet(h);
}

async function _submitPain(){
  const body={type:'pain',score:parseInt(document.getElementById('nc_pScore').value)||0,notes:document.getElementById('nc_pNote').value};
  try{await _api('/api/nursing/console/'+state.pid+'/assessment',{method:'POST',body:JSON.stringify(body)});_close();NABZ._toast('✅ ثبت شد');await reload();}catch(e){alert('خطا: '+e.message);}
}

function _ioForm(){
  let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">💧 I/O</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h+='<div class="wf-field"><label>نوع</label><select id="nc_ioType"><option value="intake">ورودی</option><option value="output">خروجی</option></select></div>';
  h+='<div class="wf-field"><label>زیرنوع</label><select id="nc_ioSub"><option value="oral">خوراکی</option><option value="iv">وریدی</option><option value="urine">ادرار</option><option value="drain">درناژ</option><option value="vomit">استفراغ</option><option value="stool">مدفوع</option><option value="other">سایر</option></select></div>';
  h+='<div class="wf-field"><label>حجم (mL)</label><input type="number" id="nc_ioVol" style="font-size:22px;text-align:center;font-weight:900;padding:10px"></div>';
  h+='<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseConsole._submitIO()">✅ ثبت</button>';
  _sheet(h);
}

async function _submitIO(){
  const body={patientId:state.pid,type:document.getElementById('nc_ioType').value,subtype:document.getElementById('nc_ioSub').value,volume:parseFloat(document.getElementById('nc_ioVol').value)};
  if(!body.volume)return alert('حجم الزامی');
  try{await _api('/api/nurse/quick/io',{method:'POST',body:JSON.stringify(body)});_close();NABZ._toast('✅ ثبت شد');await reload();}catch(e){alert('خطا: '+e.message);}
}

function _noteForm(){
  let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📝 یادداشت</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h+='<div class="wf-field"><label>دسته</label><select id="nc_nCat"><option value="observation">مشاهده</option><option value="concern">نگرانی</option><option value="wound">زخم</option><option value="mobility">تحرک</option><option value="education">آموزش</option><option value="other">سایر</option></select></div>';
  h+='<div class="wf-field"><label>متن *</label><textarea id="nc_nText" rows="4"></textarea></div>';
  h+='<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseConsole._submitNote()">✅ ثبت</button>';
  _sheet(h);
}

async function _submitNote(){
  const body={text:document.getElementById('nc_nText').value,category:document.getElementById('nc_nCat').value};
  if(!body.text||body.text.trim().length<3)return alert('متن الزامی');
  try{await _api('/api/nursing/console/'+state.pid+'/note',{method:'POST',body:JSON.stringify(body)});_close();NABZ._toast('✅ ثبت شد');await reload();}catch(e){alert('خطا: '+e.message);}
}

async function reload(){
  try{
    const d=await _api('/api/nursing/console/'+state.pid);
    state.data=d;
    _render();
  }catch(e){console.warn('[nurse-console] reload failed:',e.message);}
}

// ═══ OVERRIDE — replace nurseHQ._openPatient with our console ═══
function install(){
  if(!window.NABZ)return setTimeout(install,100);
  if(NABZ.nurseHQ){
    NABZ.nurseHQ._openPatient=open;
  }
  NABZ.nurseConsole={open,_setTab,_kardexAct,_administerMar,_submitMar,_prnForm,_submitPrn,_ivForm,_submitIv,_ivRateForm,_submitRate,_ivCheckForm,_submitCheck,_ivDiscontinue,_woundForm,_submitWound,_dressingForm,_submitDressing,_ventForm,_submitVent,_narcoticSign,_submitNarcotic,_assessForm,_submitMorse,_submitBraden,_vitalsForm,_news,_submitVitals,_painForm,_submitPain,_ioForm,_submitIO,_noteForm,_submitNote,reload};
  console.log('[nurse-console] installed — 10-tab patient console overrides nurseHQ');
}
install();
})();
