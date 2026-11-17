// ═══════════════════════════════════════════════════════════
//  NABZ — Handoff AI UI (S5)  ·  flat functions (S2 lesson)
// ═══════════════════════════════════════════════════════════
(function(){
'use strict';
const state = { tab:'candidates', selected:new Set(), cache:null, inbox:null, outbox:null, stats:null };

function _api(p, o) { return NABZ._api(p, o); }
function _esc(s) { return NABZ._esc(s); }
function _close() { document.querySelectorAll('.bs-backdrop').forEach(el => el.remove()); }
function _sheet(html) {
  const s = document.createElement('div'); s.className = 'bs-backdrop';
  s.onclick = e => { if (e.target === s) s.remove(); };
  const c = document.createElement('div'); c.className = 'bs-sheet';
  c.style.maxHeight='96vh'; c.innerHTML = html;
  s.appendChild(c); document.body.appendChild(s);
  requestAnimationFrame(() => s.classList.add('show'));
  return { sheet:s, content:c };
}
function _ago(iso) { if (!iso) return '—'; const ms=Date.now()-new Date(iso).getTime(); const m=Math.floor(ms/60000); if(m<1)return 'الان'; if(m<60)return m+'د'; const hr=Math.floor(m/60); if(hr<24)return hr+'س'; return Math.floor(hr/24)+' روز'; }

const PRI_FA = { critical:'بحرانی', high:'پرخطر', medium:'متوسط', low:'پایدار' };
const PRI_CLS = { critical:'dng', high:'warn', medium:'info', low:'ok' };

async function show(p, d) {
  const m = document.getElementById('content');
  m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
  try {
    const [cand, inbox, outbox, stats] = await Promise.all([
      _api('/api/handoff_ai/candidates'),
      _api('/api/handoff_ai/inbox').catch(()=>({items:[],total:0})),
      _api('/api/handoff_ai/outbox').catch(()=>({items:[],total:0})),
      _api('/api/handoff_ai/stats').catch(()=>({sent:0,received:0,pending:0,readbackCompliancePct:100}))
    ]);
    state.cache=cand; state.inbox=inbox; state.outbox=outbox; state.stats=stats;
    _render(p);
    _subscribeLive();
  } catch(e) { m.innerHTML='<div class="empty">خطا: '+_esc(e.message)+'</div>'; }
}

function _render(p) {
  const m = document.getElementById('content');
  const c = state.cache || { items:[], stats:{} };
  const st = c.stats || {};
  const ib = state.inbox || { total:0 };
  const stats = state.stats || {};
  let h='';
  h += '<div class="sec-hd"><span>📋 Handoff AI — تحویل پزشکی</span><span class="rd-mini">I-PASS · JCI IPSG.2</span></div>';
  if (ib.total > 0) {
    h += '<div style="background:var(--dng-soft);border:2px solid var(--dng);border-radius:12px;padding:10px;margin-bottom:12px;animation:pulse-critical 2s infinite">';
    h += '<div style="font-size:13px;font-weight:900;color:var(--dng)">📥 '+ib.total+' تحویل منتظر read-back</div></div>';
  }
  h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">';
  h += '<div class="rd-stat '+(st.critical>0?'dng':'ok')+'"><div class="v">'+(st.critical||0)+'</div><div class="l">بحرانی</div></div>';
  h += '<div class="rd-stat '+(st.high>0?'warn':'')+'"><div class="v">'+(st.high||0)+'</div><div class="l">پرخطر</div></div>';
  h += '<div class="rd-stat '+(st.withoutRound24h>0?'warn':'')+'"><div class="v">'+(st.withoutRound24h||0)+'</div><div class="l">بدون راند</div></div>';
  h += '<div class="rd-stat ok"><div class="v">'+(stats.readbackCompliancePct||100)+'%</div><div class="l">Read-back</div></div>';
  h += '</div>';
  const tabs = [
    ['candidates','📋 بیماران ('+c.items.length+')'],
    ['inbox','📥 inbox ('+ib.total+')'],
    ['outbox','📤 ارسال‌ها ('+((state.outbox||{}).total||0)+')']
  ];
  h += '<div class="crisis-tabs" style="margin-bottom:12px">';
  tabs.forEach(([k,l])=>{ h+='<button class="crisis-tab'+(state.tab===k?' on':'')+'" onclick="NABZ.handoffAI._setTab(\''+k+'\')">'+l+'</button>'; });
  h += '</div>';
  h += '<div id="haiContent"></div>';
  m.innerHTML = h;
  if (state.tab==='candidates') _renderCandidates();
  else if (state.tab==='inbox') _renderInbox();
  else _renderOutbox();
  NABZ.state.current = p ? p.id : 'handoff_ai.hub';
}

function _setTab(t){ state.tab=t; _render(null); }

function _renderCandidates() {
  const el = document.getElementById('haiContent'); if(!el) return;
  const items = (state.cache && state.cache.items) || [];
  if (!items.length) { el.innerHTML='<div class="empty" style="padding:30px">بیماری در محدوده شما نیست</div>'; return; }
  let h='';
  if (state.selected.size > 0) {
    h += '<div style="background:var(--primary-soft);border:1px solid var(--primary);border-radius:8px;padding:10px;margin-bottom:10px">';
    h += '<div style="font-size:11.5px;font-weight:900;color:var(--primary)">'+state.selected.size+' بیمار انتخاب شده</div>';
    h += '<button class="btn btn-primary btn-block" style="margin-top:6px;padding:10px;font-weight:900" onclick="NABZ.handoffAI._openGenerate()">📋 تولید Handoff برای '+state.selected.size+' بیمار</button>';
    h += '<button class="btn btn-block" style="margin-top:4px;padding:6px;font-size:11px" onclick="NABZ.handoffAI._clearSel()">پاک کردن انتخاب</button>';
    h += '</div>';
  }
  h += '<div style="display:flex;gap:6px;margin-bottom:8px"><button class="btn btn-sm" style="flex:1;padding:6px;font-size:10.5px" onclick="NABZ.handoffAI._selectAll(true)">انتخاب همه</button><button class="btn btn-sm" style="flex:1;padding:6px;font-size:10.5px" onclick="NABZ.handoffAI._selectCritHigh()">فقط بحرانی+پرخطر</button><button class="btn btn-sm" style="flex:1;padding:6px;font-size:10.5px" onclick="NABZ.handoffAI._clearSel()">پاک</button></div>';
  items.forEach(it=>{
    const pr = it.priority;
    const cls = PRI_CLS[pr.level]||'info';
    const sel = state.selected.has(it.patientId);
    h += '<div class="card" style="padding:10px;margin-bottom:4px;border-right:3px solid var(--'+cls+');'+(sel?'background:var(--primary-soft)':'')+'">';
    h += '<div style="display:flex;gap:8px;align-items:flex-start">';
    h += '<input type="checkbox" '+(sel?'checked':'')+' onchange="NABZ.handoffAI._toggle(\''+it.patientId+'\',this.checked)" style="width:20px;height:20px;margin-top:2px;accent-color:var(--primary)">';
    h += '<div style="flex:1;min-width:0" onclick="NABZ.handoffAI._preview(\''+it.patientId+'\')">';
    h += '<div style="font-size:12.5px;font-weight:900">'+_esc(it.name)+'</div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">'+(it.age||'?')+' سال · '+_esc(it.ward||'')+' · تخت '+_esc(it.bed||'')+'</div>';
    if (it.diagnosis) h += '<div style="font-size:10.5px;color:var(--fg-2)">'+_esc(it.diagnosis.slice(0,55))+'</div>';
    if (pr.reasons.length) h += '<div style="font-size:10px;color:var(--'+cls+');font-weight:800;margin-top:3px">'+_esc(pr.reasons.slice(0,3).join(' · '))+'</div>';
    h += '</div>';
    h += '<div style="text-align:left;min-width:50px"><div style="font-size:22px;font-weight:900;color:var(--'+cls+');line-height:1">'+pr.score+'</div><div style="font-size:8.5px;color:var(--fg-2);font-weight:800">'+PRI_FA[pr.level]+'</div></div>';
    h += '</div></div>';
  });
  el.innerHTML = h;
}

function _toggle(pid, on){ if(on) state.selected.add(pid); else state.selected.delete(pid); _renderCandidates(); }
function _clearSel(){ state.selected.clear(); _renderCandidates(); }
function _selectAll(on){ state.selected.clear(); if(on) (state.cache.items||[]).forEach(i=>state.selected.add(i.patientId)); _renderCandidates(); }
function _selectCritHigh(){ state.selected.clear(); (state.cache.items||[]).forEach(i=>{ if(['critical','high'].includes(i.priority.level)) state.selected.add(i.patientId); }); _renderCandidates(); }

async function _preview(pid) {
  try {
    NABZ._toast('در حال ساخت روایت...');
    const d = await _api('/api/handoff_ai/patient/'+pid);
    let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📋 '+_esc(d.patient.name)+'</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    const pr=d.priority; const cls=PRI_CLS[pr.level]||'info';
    h += '<div class="card" style="background:linear-gradient(135deg,rgba(6,182,212,.1),rgba(139,92,246,.05));margin-bottom:10px">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start"><div>';
    h += '<div style="font-size:14px;font-weight:900">'+_esc(d.patient.name)+'</div>';
    h += '<div style="font-size:11px;color:var(--fg-2)">'+(d.patient.age||'?')+' سال · '+_esc(d.patient.ward||'')+' · تخت '+_esc(d.patient.bed||'')+'</div>';
    if (d.patient.diagnosis) h += '<div style="font-size:11.5px;font-weight:700;margin-top:3px">'+_esc(d.patient.diagnosis)+'</div>';
    if (d.isolation.active) h += '<div style="font-size:11px;color:var(--warn);margin-top:2px">🧼 ایزوله '+_esc(d.isolation.type)+'</div>';
    if (d.sepsis.active) h += '<div style="font-size:11px;color:var(--dng);font-weight:900">🦠 سپسیس '+_esc(d.sepsis.status)+' (qSOFA '+d.sepsis.qsofa+')</div>';
    h += '</div><div style="text-align:left"><div style="font-size:24px;font-weight:900;color:var(--'+cls+')">'+pr.score+'</div><div style="font-size:9px;color:var(--fg-2)">'+PRI_FA[pr.level]+'</div></div></div>';
    if (pr.reasons.length) h += '<div style="font-size:10.5px;color:var(--'+cls+');margin-top:6px;font-weight:800">⚠️ '+_esc(pr.reasons.join(' · '))+'</div>';
    h += '</div>';
    if (d.trends.hasTrend) {
      h += '<div class="card" style="margin-bottom:10px;border-color:var(--warn)"><div style="font-size:11px;font-weight:900;color:var(--warn);margin-bottom:4px">📈 روند '+d.trends.hoursSpan+'h</div>';
      d.trends.notes.forEach(n=>{ h+='<div style="font-size:11px;padding:2px 0">• '+_esc(n)+'</div>'; });
      h += '</div>';
    }
    h += _sbarBlock('S — وضعیت', d.sbar.situation, 'primary');
    h += _sbarBlock('B — سابقه', d.sbar.background, 'primary');
    h += _sbarBlock('A — ارزیابی', d.sbar.assessment, 'primary');
    h += _sbarBlock('R — توصیه', d.sbar.recommendation, 'warn');
    h += '<div style="display:flex;gap:6px;margin-top:12px;margin-bottom:20px">';
    h += '<button class="btn btn-primary" style="flex:1;padding:12px;font-weight:900" onclick="NABZ.handoffAI._toggle(\''+pid+'\',true);this.closest(\'.bs-backdrop\').remove()">+ افزودن به لیست</button>';
    h += '<button class="btn" style="flex:1;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button></div>';
    _sheet(h);
  } catch(e){ alert('خطا: '+e.message); }
}

function _sbarBlock(label, text, cls) {
  if (!text) return '';
  return '<div class="card" style="margin-bottom:8px;border-right:3px solid var(--'+cls+')"><div style="font-size:11px;font-weight:900;color:var(--'+cls+');margin-bottom:4px">'+_esc(label)+'</div><div style="font-size:11.5px;white-space:pre-wrap;line-height:1.7">'+_esc(text)+'</div></div>';
}

async function _openGenerate() {
  if (!state.selected.size) return;
  try {
    const users = await _api('/api/admin/users').catch(()=>({items:[]}));
    const candidates = (users.items||[]).filter(u=>u.active!==false && u.id !== (NABZ.state.user&&NABZ.state.user.id));
    let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📤 ارسال Handoff — '+state.selected.size+' بیمار</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div class="wf-field"><label>به پزشک *</label><select id="hai_to" style="font-size:12px"><option value="">— انتخاب کنید —</option>';
    candidates.forEach(u=>{ h+='<option value="'+u.id+'">'+_esc(u.fullName||u.username)+' — '+_esc(u.role)+(u.ward?' · '+_esc(u.ward):'')+'</option>'; });
    h += '</select></div>';
    h += '<div class="wf-field"><label>تا شیفت</label><select id="hai_shift"><option value="tonight">امشب</option><option value="weekend">آخر هفته</option><option value="week">کل هفته</option></select></div>';
    h += '<div class="wf-field"><label>یادداشت (اختیاری)</label><textarea id="hai_notes" rows="3"></textarea></div>';
    h += '<div class="hint info" style="margin-top:10px">📋 پس از ارسال، گیرنده باید با کد یکتا read-back انجام دهد (JCI IPSG.2)</div>';
    h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.handoffAI._doSave()">📤 ارسال</button>';
    _sheet(h);
  } catch(e){ alert('خطا: '+e.message); }
}

async function _doSave() {
  const to = document.getElementById('hai_to').value;
  const shift = document.getElementById('hai_shift').value;
  const notes = document.getElementById('hai_notes').value;
  if (!to) return alert('گیرنده الزامی است');
  try {
    NABZ._toast('در حال ساخت...');
    const r = await _api('/api/handoff_ai/save',{method:'POST',body:JSON.stringify({patientIds:Array.from(state.selected),toUserId:to,untilShift:shift,notes:notes})});
    _close();
    NABZ._toast('✅ ارسال شد — کد: '+r.uniqueCode);
    state.selected.clear();
    _showReceipt(r);
  } catch(e){ alert('خطا: '+e.message); }
}

function _showReceipt(r) {
  let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">✅ Handoff ارسال شد</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="card" style="text-align:center;padding:20px;background:linear-gradient(135deg,rgba(16,185,129,.1),transparent);border-color:var(--ok)">';
  h += '<div style="font-size:48px">📋</div>';
  h += '<div style="font-size:11px;color:var(--fg-2);margin-top:6px">کد یکتا برای read-back</div>';
  h += '<div style="font-size:22px;font-weight:900;color:var(--ok);font-family:monospace;margin-top:4px">'+_esc(r.uniqueCode)+'</div>';
  h += '<div style="font-size:11px;color:var(--fg-2);margin-top:8px">به: '+_esc(r.toUserName)+' · '+r.patientCount+' بیمار</div>';
  h += '</div>';
  h += '<div class="hint info" style="margin-top:10px">این کد را به گیرنده بگویید تا در read-back ثبت کند</div>';
  h += '<div style="display:flex;gap:6px;margin-top:12px;margin-bottom:20px">';
  h += '<button class="btn btn-primary" style="flex:1;padding:10px" onclick="this.closest(\'.bs-backdrop\').remove();NABZ.handoffAI._setTab(\'outbox\')">مشاهده ارسال‌ها</button>';
  h += '<button class="btn" style="flex:1;padding:10px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button></div>';
  _sheet(h);
}

function _renderInbox() {
  const el = document.getElementById('haiContent'); if(!el) return;
  const items = (state.inbox && state.inbox.items) || [];
  if (!items.length) { el.innerHTML='<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">✅</div><div style="font-weight:900;margin-top:8px">inbox خالی</div></div>'; return; }
  let h='';
  items.forEach(r=>{
    h += '<div class="card" style="padding:10px;margin-bottom:4px;border-right:3px solid var(--warn);cursor:pointer" onclick="NABZ.handoffAI._viewRecord(\''+r.id+'\')">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start"><div style="flex:1">';
    h += '<div style="font-size:12.5px;font-weight:900">📥 از '+_esc(r.fromUserName)+'</div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">'+r.patientCount+' بیمار · '+_esc(r.untilShift)+' · '+_ago(r.sentAt)+'</div>';
    h += '<div style="font-family:monospace;font-size:10px;color:var(--primary);margin-top:2px">🔐 '+_esc(r.uniqueCode)+'</div>';
    h += '</div><span class="pill warn">read-back</span></div></div>';
  });
  el.innerHTML = h;
}

function _renderOutbox() {
  const el = document.getElementById('haiContent'); if(!el) return;
  const items = (state.outbox && state.outbox.items) || [];
  if (!items.length) { el.innerHTML='<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">📤</div><div style="font-weight:900;margin-top:8px">هنوز ارسالی ندارید</div></div>'; return; }
  let h='';
  items.forEach(r=>{
    const cls = r.status==='received' ? 'ok' : 'warn';
    const stFa = r.status==='received' ? 'دریافت شد' : 'در انتظار';
    h += '<div class="card" style="padding:10px;margin-bottom:4px;border-right:3px solid var(--'+cls+')">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start"><div style="flex:1">';
    h += '<div style="font-size:12.5px;font-weight:900">📤 به '+_esc(r.toUserName)+'</div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">'+r.patientCount+' بیمار · '+_ago(r.sentAt)+'</div>';
    h += '<div style="font-family:monospace;font-size:10px;color:var(--primary);margin-top:2px">🔐 '+_esc(r.uniqueCode)+'</div>';
    h += '</div><span class="pill '+cls+'">'+stFa+'</span></div></div>';
  });
  el.innerHTML = h;
}

async function _viewRecord(id) {
  try {
    const all = await _api('/api/handoff_ai/inbox');
    const r = (all.items||[]).find(x=>x.id===id);
    if (!r) return alert('یافت نشد');
    let h='<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📥 '+_esc(r.fromUserName)+' → شما</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div class="card" style="background:var(--warn-soft);border-color:var(--warn);margin-bottom:10px">';
    h += '<div style="font-size:11px;font-weight:900;color:var(--warn)">🔐 کد read-back</div>';
    h += '<div style="font-family:monospace;font-size:18px;font-weight:900;color:var(--warn);margin-top:2px">'+_esc(r.uniqueCode)+'</div>';
    h += '</div>';
    h += '<div style="font-size:11.5px;color:var(--fg-2);margin-bottom:8px">'+r.patientCount+' بیمار · شیفت '+_esc(r.untilShift)+' · '+_ago(r.sentAt)+'</div>';
    if (r.notes) h += '<div class="card" style="margin-bottom:8px;padding:8px"><div style="font-size:11px;font-weight:900;margin-bottom:2px">📝 یادداشت</div><div style="font-size:11.5px">'+_esc(r.notes)+'</div></div>';
    // patients
    (r.items||[]).slice(0,10).forEach(it=>{
      const cls = PRI_CLS[it.priority.level]||'info';
      h += '<div class="card" style="margin-bottom:6px;padding:8px;border-right:3px solid var(--'+cls+')">';
      h += '<div style="font-size:12px;font-weight:900">'+_esc(it.patientName)+' <span class="pill '+cls+'" style="font-size:9px">'+it.priority.score+'</span></div>';
      h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">'+_esc(it.ward||'')+'</div>';
      if (it.priority.reasons && it.priority.reasons.length) h += '<div style="font-size:10px;color:var(--'+cls+');font-weight:800">⚠️ '+_esc(it.priority.reasons.join(' · '))+'</div>';
      h += '<div style="font-size:10.5px;margin-top:4px"><b>S:</b> '+_esc((it.sbar.situation||'').slice(0,150))+'</div>';
      h += '</div>';
    });
    h += '<div class="wf-field" style="margin-top:12px"><label style="color:var(--dng);font-weight:900">متن read-back (حداقل ۱۰ کاراکتر) *</label>';
    h += '<textarea id="hai_rb" rows="3" placeholder="مثلاً: دریافت کردم — کد '+_esc(r.uniqueCode)+' — ۳ بیمار، بیمار X پنومونی با NEWS2 7..."></textarea></div>';
    h += '<button class="btn btn-ok btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.handoffAI._doReceive(\''+id+'\')">✅ تأیید دریافت</button>';
    _sheet(h);
  } catch(e){ alert('خطا: '+e.message); }
}

async function _doReceive(id) {
  const rb = (document.getElementById('hai_rb')||{}).value||'';
  if (rb.trim().length<10) return alert('حداقل ۱۰ کاراکتر');
  try {
    const r = await _api('/api/handoff_ai/'+id+'/receive',{method:'POST',body:JSON.stringify({readBack:rb})});
    _close();
    NABZ._toast('✅ دریافت شد'+(r.readBackCodeMatched?' — کد مطابقت کرد':''));
    show(null, null);
  } catch(e){ alert('خطا: '+e.message); }
}

let _liveSub=false;
function _subscribeLive() {
  if (_liveSub) return;
  if (!window.Live || typeof Live.on !== 'function') return;
  ['handoff_ai.sent','handoff_ai.received'].forEach(e=>{ Live.on(e,()=>{ if(NABZ.state.current==='handoff_ai.hub'&&!document.querySelector('.bs-backdrop')) show(null,null); }); });
  _liveSub = true;
}

window.NABZ = window.NABZ || {};
NABZ.handoffAI = { show, _setTab, _toggle, _clearSel, _selectAll, _selectCritHigh, _preview, _openGenerate, _doSave, _viewRecord, _doReceive, _renderCandidates };
let tries = 0;
(function tryReg(){
  if (NABZ._dispatchRegistry && typeof NABZ.registerKind === 'function') {
    NABZ.registerKind('handoff_ai', function(p,d){ return show(p,d); });
    console.log('[handoff-ai-ui] loaded ✓');
    return;
  }
  if (++tries > 60) return console.warn('[handoff-ai-ui] timeout');
  setTimeout(tryReg, 100);
})();
})();
