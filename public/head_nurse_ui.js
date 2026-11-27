// ═══════════════════════════════════════════════════════════
//  NABZ — Head Nurse UI
// ═══════════════════════════════════════════════════════════
(function(){
'use strict';
const state = { tab:'dashboard', dash:null, board:null, beds:null, equip:null };

function _api(p,o){return NABZ._api(p,o);}
function _esc(s){return NABZ._esc(s);}
function _close(){document.querySelectorAll('.bs-backdrop').forEach(el=>el.remove());}
function _sheet(html){
  const s=document.createElement('div');s.className='bs-backdrop';
  s.onclick=e=>{if(e.target===s)s.remove();};
  const c=document.createElement('div');c.className='bs-sheet';
  c.style.maxHeight='96vh';c.style.padding='12px 12px calc(env(safe-area-inset-bottom,0px) + 16px)';c.innerHTML=html;
  s.appendChild(c);document.body.appendChild(s);
  requestAnimationFrame(()=>s.classList.add('show'));
  return {sheet:s,content:c};
}

async function show(p,d){
  const m=document.getElementById('content');
  m.innerHTML='<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
  try{
    if(!d)d=await _api('/api/head_nurse/dashboard');
    state.dash=d;
    _render();
  }catch(e){
    const msg=String(e.message||'');
    if(msg.indexOf('ward_not_configured')>=0){
      m.innerHTML='<div class="card" style="padding:24px;text-align:center"><div style="font-size:40px">👨‍⚕️</div><div style="font-weight:900;font-size:15px;margin-top:8px">بخش شما تعریف نشده</div></div>';
    }else m.innerHTML='<div class="empty">خطا: '+_esc(msg)+'</div>';
  }
}

function _render(){
  const d=state.dash;if(!d)return;
  const m=document.getElementById('content');
  let h='';
  // Header
  h+='<div style="background:linear-gradient(135deg,rgba(6,182,212,.15),rgba(139,92,246,.08));border-radius:14px;padding:12px;margin-bottom:12px">';
  h+='<div style="display:flex;justify-content:space-between;align-items:flex-start">';
  h+='<div><div style="font-size:16px;font-weight:900">👨‍⚕️ ایستگاه سرپرستار</div><div style="font-size:11px;color:var(--fg-2);margin-top:2px">'+_esc(d.ward)+' · '+d.shift.today+'</div></div>';
  h+='<div style="text-align:left"><div style="font-size:22px;font-weight:900;color:var(--primary);line-height:1">'+d.shift.hoursRemaining+'h</div><div style="font-size:9px;color:var(--fg-2)">باقیمانده</div></div>';
  h+='</div></div>';
  // Stats
  h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">';
  h+=_chip(d.patients.total,'بیمار','');
  h+=_chip(d.patients.critical,d.patients.critical>0?'بحرانی':'بحرانی',d.patients.critical>0?'dng':'');
  h+=_chip(d.staff.present+'/'+d.staff.total,'حاضر','ok');
  h+=_chip(d.beds.available,'تخت آزاد',d.beds.available>0?'ok':'dng');
  h+='</div>';
  // Alerts
  const alerts=[];
  if(d.patients.critical>0)alerts.push({cls:'dng',txt:'🚨 '+d.patients.critical+' بیمار بحرانی'});
  if(d.patients.unassigned>0)alerts.push({cls:'warn',txt:'⚠️ '+d.patients.unassigned+' بیمار بدون پرستار'});
  if(d.staff.absent>0)alerts.push({cls:'warn',txt:'⚠️ '+d.staff.absent+' نفر غایب'});
  if(d.alerts.sepsis>0)alerts.push({cls:'dng',txt:'🦠 '+d.alerts.sepsis+' سپسیس'});
  if(d.alerts.criticalLabs>0)alerts.push({cls:'dng',txt:'🧪 '+d.alerts.criticalLabs+' lab بحرانی'});
  if(d.requests.total>0)alerts.push({cls:'info',txt:'📥 '+d.requests.total+' درخواست در انتظار'});
  if(alerts.length){
    h+='<div style="margin-bottom:12px">';
    alerts.forEach(a=>{h+='<div style="background:var(--'+a.cls+'-soft);border:1px solid var(--'+a.cls+');border-radius:8px;padding:8px 10px;margin-bottom:4px;font-size:12px;font-weight:800;color:var(--'+a.cls+')">'+a.txt+'</div>';});
    h+='</div>';
  }
  // Tabs
  const tabs=[['dashboard','📊'],['shift','📋 شیفت'],['beds','🛏 تخت'],['equip','🔧 تجهیزات'],['requests','📥 درخواست']];
  h+='<div class="crisis-tabs" style="margin-bottom:12px">';
  tabs.forEach(([k,l])=>{h+='<button class="crisis-tab'+(state.tab===k?' on':'')+'" onclick="NABZ.headNurse._setTab(\''+k+'\')">'+l+'</button>';});
  h+='</div>';
  h+='<div id="hnContent"></div>';
  m.innerHTML=h;
  if(state.tab==='dashboard')_renderDashboard();
  else if(state.tab==='shift')_renderShift();
  else if(state.tab==='beds')_renderBeds();
  else if(state.tab==='equip')_renderEquip();
  else if(state.tab==='requests')_renderRequests();
  NABZ.state.current='head_nurse.hq';
}

function _chip(v,l,c){
  const vc=c==='dng'?'color:var(--dng);':c==='warn'?'color:var(--warn);':c==='ok'?'color:var(--ok);':'';
  return '<div style="background:var(--bg-2);border:1.5px solid var(--border);border-radius:10px;padding:8px 4px;text-align:center"><div style="font-size:20px;font-weight:900;'+vc+'line-height:1">'+v+'</div><div style="font-size:9px;color:var(--fg-2);margin-top:2px">'+l+'</div></div>';
}
function _setTab(t){state.tab=t;_render();}

// ═══ DASHBOARD ═══
function _renderDashboard(){
  const el=document.getElementById('hnContent');if(!el)return;
  const d=state.dash;
  let h='';
  // MAR compliance
  h+='<div class="card" style="padding:10px;margin-bottom:10px">';
  h+='<div style="display:flex;justify-content:space-between;font-size:11px"><span style="font-weight:900">💊 MAR Compliance (8h)</span><span style="color:var(--'+(d.mar.compliance>=95?'ok':d.mar.compliance>=80?'warn':'dng')+');font-weight:900">'+d.mar.compliance+'%</span></div>';
  h+='<div class="progress" style="margin-top:4px;height:4px"><div class="progress-fill '+(d.mar.compliance>=95?'ok':d.mar.compliance>=80?'warn':'dng')+'" style="width:'+d.mar.compliance+'%"></div></div>';
  h+='<div style="font-size:10px;color:var(--fg-2);margin-top:4px">داده: '+d.mar.given+' · Missed: '+d.mar.missed+'</div>';
  h+='</div>';
  // Critical patients
  if(d.patients.criticalList&&d.patients.criticalList.length){
    h+='<div style="font-size:12px;font-weight:900;color:var(--dng);margin:10px 0 6px">🚨 بحرانی</div>';
    d.patients.criticalList.forEach(p=>{
      h+='<div class="card" style="padding:8px 10px;margin-bottom:3px;border-right:3px solid var(--dng);cursor:pointer" onclick="NABZ.nurseConsole._openPatient(\''+p.id+'\')">';
      h+='<div style="font-size:12px;font-weight:900">'+_esc(p.name)+'</div>';
      h+='<div style="font-size:10.5px;color:var(--fg-2)">تخت '+_esc(p.bed||'')+' · NEWS2 '+p.news2+'</div>';
      h+='</div>';
    });
  }
  // Quick links
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px">';
  h+='<button class="btn" style="padding:12px;font-size:11.5px;font-weight:900" onclick="NABZ.headNurse._setTab(\'shift\')">📋 تخصیص شیفت</button>';
  h+='<button class="btn" style="padding:12px;font-size:11.5px;font-weight:900" onclick="NABZ.headNurse._setTab(\'beds\')">🛏 تخت‌ها</button>';
  h+='<button class="btn" style="padding:12px;font-size:11.5px;font-weight:900" onclick="NABZ.headNurse._setTab(\'requests\')">📥 درخواست‌ها</button>';
  h+='<button class="btn" style="padding:12px;font-size:11.5px;font-weight:900" onclick="NABZ.headNurse._setTab(\'equip\')">🔧 تجهیزات</button>';
  h+='</div>';
  el.innerHTML=h;
}

// ═══ SHIFT BOARD ═══
async function _renderShift(){
  const el=document.getElementById('hnContent');if(!el)return;
  el.innerHTML='<div style="text-align:center;padding:20px"><span class="spinner"></span></div>';
  try{
    const d=await _api('/api/head_nurse/shift-board');
    state.board=d;
    let h='<button class="btn btn-primary btn-block" style="padding:10px;margin-bottom:8px;font-weight:900" onclick="NABZ.headNurse._autoAssign()">🚀 تخصیص خودکار</button>';
    h+='<div style="font-size:11px;color:var(--fg-2);margin-bottom:6px">'+d.patients.length+' بیمار · '+d.staff.length+' پرستار</div>';
    h+='<div class="sec-hd" style="margin:10px 0 4px"><span>👥 پرستاران</span></div>';
    d.staff.forEach(s=>{
      h+='<div class="card" style="padding:8px 10px;margin-bottom:4px"><div style="font-size:12px;font-weight:900">'+_esc(s.name)+'</div><div style="font-size:10px;color:var(--fg-2)">'+s.patientCount+'/'+s.maxPatients+' بیمار</div></div>';
    });
    h+='<div class="sec-hd" style="margin:12px 0 4px"><span>🧑‍🦳 بیماران</span></div>';
    d.patients.forEach(p=>{
      const assigned=p.assignedTo?'ok':'warn';
      h+='<div class="card" style="padding:8px 10px;margin-bottom:3px;border-right:3px solid var(--'+assigned+')">';
      h+='<div style="display:flex;justify-content:space-between;align-items:flex-start"><div style="flex:1"><div style="font-size:12px;font-weight:900">'+_esc(p.name)+'</div><div style="font-size:10px;color:var(--fg-2)">تخت '+_esc(p.bed||'')+' · NEWS '+(p.news2||0)+'</div>';
      if(p.assignedTo)h+='<div style="font-size:10px;color:var(--ok);margin-top:2px">→ '+_esc(p.assignedTo.nurseName)+'</div>';
      h+='</div><button class="btn btn-sm" style="padding:4px 10px;font-size:10.5px" onclick="NABZ.headNurse._assignDialog(\''+p.id+'\')">'+(p.assignedTo?'تغییر':'تخصیص')+'</button></div>';
      h+='</div>';
    });
    el.innerHTML=h;
  }catch(e){el.innerHTML='<div class="empty">خطا: '+_esc(e.message)+'</div>';}
}

async function _assignDialog(pid){
  const b=state.board;
  if(!b)return;
  let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">تخصیص بیمار به پرستار</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  b.staff.forEach(s=>{
    const full=s.patientCount>=s.maxPatients;
    h+='<button class="btn" style="width:100%;text-align:right;padding:10px;margin-bottom:3px;'+(full?'opacity:0.5;':'')+'" onclick="NABZ.headNurse._doAssign(\''+pid+'\',\''+s.id+'\')" '+(full?'disabled':'')+'>';
    h+='<div style="font-weight:900">'+_esc(s.name)+'</div>';
    h+='<div style="font-size:10px;color:var(--fg-2)">'+s.patientCount+'/'+s.maxPatients+(full?' (پر)':'')+'</div>';
    h+='</button>';
  });
  _sheet(h);
}

async function _doAssign(pid, nurseId){
  try{
    await _api('/api/head_nurse/shift-board/assign',{method:'POST',body:JSON.stringify({patientId:pid,nurseId:nurseId})});
    _close();NABZ._toast('✅ تخصیص شد');
    _renderShift();
  }catch(e){alert('خطا: '+e.message);}
}

async function _autoAssign(){
  if(!confirm('تخصیص خودکار همه بیماران به پرستاران؟'))return;
  try{
    NABZ._toast('در حال تخصیص...');
    const r=await _api('/api/head_nurse/shift-board/auto-assign',{method:'POST',body:'{}'});
    NABZ._toast('✅ '+r.patients+' بیمار تخصیص شد');
    _renderShift();
  }catch(e){alert('خطا: '+e.message);}
}

// ═══ BEDS ═══
async function _renderBeds(){
  const el=document.getElementById('hnContent');if(!el)return;
  el.innerHTML='<div style="text-align:center;padding:20px"><span class="spinner"></span></div>';
  try{
    const beds=await _api('/api/head_nurse/beds');
    let h='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:6px">';
    beds.forEach(b=>{
      const cls=b.status==='occupied'?'dng':b.status==='available'?'ok':b.status==='cleaning'?'warn':'info';
      h+='<div class="card" style="padding:8px;text-align:center;border-color:var(--'+cls+');cursor:pointer" onclick="NABZ.headNurse._bedAction(\''+b.id+'\',\''+b.status+'\')">';
      h+='<div style="font-size:10px;font-weight:900;color:var(--primary)">'+_esc(b.bedNumber)+'</div>';
      if(b.patient)h+='<div style="font-size:9px;font-weight:700;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_esc(b.patient.name)+'</div>';
      else h+='<div style="font-size:9px;color:var(--fg-2);margin-top:2px">'+b.status+'</div>';
      h+='</div>';
    });
    h+='</div>';
    el.innerHTML=h;
  }catch(e){el.innerHTML='<div class="empty">خطا: '+_esc(e.message)+'</div>';}
}

async function _bedAction(bedId, status){
  if(status==='occupied'){
    if(!confirm('آزادسازی تخت؟ (→ صف نظافت)'))return;
    try{await _api('/api/head_nurse/beds/'+bedId+'/release',{method:'POST',body:'{}'});NABZ._toast('✅ آزاد شد');_renderBeds();}catch(e){alert('خطا: '+e.message);}
    return;
  }
  if(status==='available'){
    var pt = await NABZ.patientPicker({ title: 'انتخاب بیمار برای تخصیص تخت' });
    if(!pt || !pt.id)return;
    const patientId = pt.id;
    try{await _api('/api/head_nurse/beds/'+bedId+'/assign',{method:'POST',body:JSON.stringify({patientId})});NABZ._toast('✅ تخصیص');_renderBeds();}catch(e){alert('خطا: '+e.message);}
  }
}

// ═══ EQUIPMENT ═══
async function _renderEquip(){
  const el=document.getElementById('hnContent');if(!el)return;
  el.innerHTML='<div style="text-align:center;padding:20px"><span class="spinner"></span></div>';
  try{
    const items=await _api('/api/head_nurse/equipment');
    if(!items.length){el.innerHTML='<div class="empty" style="padding:30px">تجهیزات ثبت نشده</div>';return;}
    let h='';
    items.forEach(e=>{
      h+='<div class="card" style="padding:8px 10px;margin-bottom:4px;border-right:3px solid var(--'+(e.status==='ok'?'ok':e.status==='faulty'?'dng':'warn')+')">';
      h+='<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div style="font-size:12px;font-weight:900">'+_esc(e.name)+'</div>';
      h+='<div style="font-size:10px;color:var(--fg-2)">'+_esc(e.type)+' · آخرین چک: '+_ago(e.lastCheckAt)+'</div></div>';
      h+='<button class="btn btn-sm" style="padding:4px 10px;font-size:10.5px" onclick="NABZ.headNurse._equipCheck(\''+e.id+'\')">چک</button></div>';
      h+='</div>';
    });
    el.innerHTML=h;
  }catch(e){el.innerHTML='<div class="empty">خطا: '+_esc(e.message)+'</div>';}
}

function _equipCheck(equipId){
  let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">چک تجهیزات</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h+='<div class="wf-field"><label>وضعیت</label><select id="hn_eStatus"><option value="ok">سالم</option><option value="faulty">خراب</option><option value="needs_repair">نیاز به تعمیر</option></select></div>';
  h+='<div class="wf-field"><label>یادداشت</label><textarea id="hn_eNotes" rows="2"></textarea></div>';
  h+='<button class="btn btn-primary btn-block" style="padding:12px;margin-top:8px" onclick="NABZ.headNurse._submitEquip(\''+equipId+'\')">✅ ثبت</button>';
  _sheet(h);
}

async function _submitEquip(equipId){
  const body={status:document.getElementById('hn_eStatus').value,notes:document.getElementById('hn_eNotes').value};
  try{await _api('/api/head_nurse/equipment/'+equipId+'/check',{method:'POST',body:JSON.stringify(body)});_close();NABZ._toast('✅ ثبت شد');_renderEquip();}catch(e){alert('خطا: '+e.message);}
}

// ═══ REQUESTS ═══
async function _renderRequests(){
  const el=document.getElementById('hnContent');if(!el)return;
  const reqs=(state.dash&&state.dash.requests&&state.dash.requests.list)||[];
  if(!reqs.length){el.innerHTML='<div class="empty" style="padding:30px">درخواستی نیست</div>';return;}
  let h='';
  reqs.forEach(r=>{
    h+='<div class="card" style="padding:10px;margin-bottom:4px">';
    h+='<div style="font-size:12px;font-weight:900">'+_esc(r.typeLabel||r.subject)+'</div>';
    h+='<div style="font-size:10.5px;color:var(--fg-2)">'+_esc(r.requestedByName||'')+'</div>';
    h+='<div style="display:flex;gap:4px;margin-top:6px">';
    h+='<button class="btn btn-ok btn-sm" style="flex:1;padding:6px;font-size:10.5px" onclick="NABZ.headNurse._decideRequest(\''+r.id+'\',\'approve\')">✅ تأیید</button>';
    h+='<button class="btn btn-dng btn-sm" style="flex:1;padding:6px;font-size:10.5px" onclick="NABZ.headNurse._decideRequest(\''+r.id+'\',\'reject\')">❌ رد</button>';
    h+='</div></div>';
  });
  el.innerHTML=h;
}

async function _decideRequest(id, decision){
  let reason=null;
  if(decision==='reject'){var d=await NABZ.dialog.form({icon:'❌',title:'دلیل رد',fields:[{key:'v',label:'دلیل رد',required:true,type:'textarea'}],submitLabel:'رد'});if(!d||!d.v)return;reason=d.v;}
  try{await _api('/api/head_nurse/requests/'+id+'/approve',{method:'POST',body:JSON.stringify({decision,reason})});NABZ._toast('✅ ثبت شد');show(null,null);}catch(e){alert('خطا: '+e.message);}
}

function _ago(iso){if(!iso)return'—';const ms=Date.now()-new Date(iso).getTime();const m=Math.floor(ms/60000);if(m<1)return'الان';if(m<60)return m+'د';const hr=Math.floor(m/60);if(hr<24)return hr+'س';return Math.floor(hr/24)+'d';}

window.NABZ=window.NABZ||{};
NABZ.headNurse={show,_setTab,_autoAssign,_assignDialog,_doAssign,_bedAction,_equipCheck,_submitEquip,_decideRequest,_renderShift,_renderBeds,_renderEquip,_renderRequests};
let tries=0;
(function tryReg(){
  if(NABZ._dispatchRegistry&&typeof NABZ.registerKind==='function'){
    NABZ.registerKind('head_nurse',function(p,d){return show(p,d);});
    console.log('[head-nurse-ui] loaded ✓');
    return;
  }
  if(++tries>60)return console.warn('[head-nurse-ui] timeout');
  setTimeout(tryReg,100);
})();
})();
