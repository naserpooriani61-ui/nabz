// public/erf_ui.js — ER Command Center (Superhuman UI v2)
(function() {
  'use strict';

  // ─── CSS ───
  if (!document.getElementById('erf-style-v2')) {
    var st = document.createElement('style');
    st.id = 'erf-style-v2';
    st.textContent = `
      .erf-wrap{direction:rtl;font-family:'Vazirmatn',Tahoma,sans-serif;background:var(--kx-bg);min-height:100vh;padding-bottom:88px;color:var(--kx-text);}
      .erf-hd{position:sticky;top:0;z-index:10;background:var(--kx-surface);border-bottom:1px solid var(--kx-border);padding:14px 16px;display:flex;justify-content:space-between;align-items:center;box-shadow:var(--kx-shadow-sm);}
      .erf-hd-t{font-size:17px;font-weight:900;color:var(--kx-primary);display:flex;align-items:center;gap:8px;}
      .erf-tabs{display:flex;gap:4px;padding:8px 12px;background:var(--kx-surface);border-bottom:1px solid var(--kx-border);overflow-x:auto;scrollbar-width:none;position:sticky;top:61px;z-index:9;}
      .erf-tabs::-webkit-scrollbar{display:none;}
      .erf-tab{flex:0 0 auto;padding:8px 14px;border-radius:var(--kx-pill);font-size:12px;font-weight:700;color:var(--kx-text-2);cursor:pointer;background:var(--kx-surface-2);border:1px solid transparent;transition:all 0.2s;}
      .erf-tab.active{background:var(--kx-primary);color:#fff;border-color:var(--kx-primary);box-shadow:0 2px 8px rgba(30,77,140,0.3);}
      .erf-body{padding:14px 12px;}
      
      /* KPI */
      .erf-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;}
      .erf-kpi{background:var(--kx-surface);padding:12px 6px;border-radius:var(--kx-r-sm);box-shadow:var(--kx-shadow-sm);border:1px solid var(--kx-border);text-align:center;}
      .erf-kpi-v{font-size:20px;font-weight:900;margin-bottom:4px;font-variant-numeric:tabular-nums;}
      .erf-kpi-l{font-size:10px;color:var(--kx-text-2);font-weight:700;}
      .erf-kpi.dng .erf-kpi-v{color:var(--kx-danger);}
      .erf-kpi.suc .erf-kpi-v{color:var(--kx-success);}
      .erf-kpi.wrn .erf-kpi-v{color:var(--kx-warning);}
      
      /* Sections */
      .erf-sec{background:var(--kx-surface);margin-bottom:12px;border-radius:var(--kx-r);border:1px solid var(--kx-border);box-shadow:var(--kx-shadow-sm);overflow:hidden;}
      .erf-sec-h{padding:12px 14px;font-size:13px;font-weight:800;border-bottom:1px solid var(--kx-border);background:var(--kx-surface-2);display:flex;justify-content:space-between;align-items:center;}
      .erf-sec-b{padding:12px;}
      
      /* ESI Bar */
      .erf-esi-bar{display:flex;height:10px;border-radius:5px;overflow:hidden;margin-top:8px;gap:2px;}
      .erf-esi-seg{height:100%;}
      .erf-esi-leg{display:flex;justify-content:space-between;font-size:10px;margin-top:8px;color:var(--kx-text-2);font-weight:700;}
      
      /* Zones */
      .erf-z-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}
      .erf-z{background:var(--kx-surface-2);padding:10px;border-radius:8px;border:1px solid var(--kx-border);}
      .erf-z-t{font-size:11px;font-weight:800;margin-bottom:6px;display:flex;align-items:center;gap:4px;}
      .erf-z-b{font-size:10px;display:flex;justify-content:space-between;font-weight:700;}
      
      /* Beds */
      .erf-beds-zone{margin-bottom:12px;}
      .erf-bed{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:6px;font-size:10px;font-weight:800;margin:3px;border:1px solid var(--kx-border);cursor:pointer;transition:transform 0.1s;}
      .erf-bed:active{transform:scale(0.95);}
      .erf-bed.empty{background:var(--kx-success-soft);color:var(--kx-success);border-color:#6ee7b7;}
      .erf-bed.occupied{background:var(--kx-danger-soft);color:var(--kx-danger);border-color:#fca5a5;}
      .erf-bed.cleaning{background:var(--kx-warning-soft);color:var(--kx-warning);border-color:#fdba74;}
      
      /* Lists (Triage, Codes, Patients) */
      .erf-row{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--kx-border);font-size:12px;background:var(--kx-surface);}
      .erf-row:last-child{border-bottom:none;}
      .erf-esi-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:900;color:#fff;margin-left:6px;}
      .erf-btn{padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;border:none;cursor:pointer;background:var(--kx-primary-soft);color:var(--kx-primary);}
      .erf-btn.dng{background:var(--kx-danger-soft);color:var(--kx-danger);}
      
      /* Code Card */
      .erf-code-c{background:var(--kx-danger-soft);border:1px solid var(--kx-danger);padding:12px;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;}
    `;
    document.head.appendChild(st);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function fmt(iso) { if (!iso) return '—'; try { return new Date(iso).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}); } catch(_) { return '—'; } }
  async function api(url) { return await NABZ._api(url); }
  function mount(html) { var el = document.getElementById('content'); if (el) { el.innerHTML = html; } }

  var state = { tab: 'status', data: null };

  // ─── Main Renderer ───
  async function show() {
    mount('<div class="erf-wrap"><div class="kx2-loading">در حال بارگذاری مرکز فرماندهی...</div></div>');
    try {
      state.data = await api('/api/erf/overview');
      renderApp();
    } catch (e) {
      mount('<div class="erf-wrap" style="padding:40px;text-align:center;color:var(--kx-danger)">خطا در بارگذاری: ' + esc(e.message) + '</div>');
    }
  }

  function renderApp() {
    var k = state.data.kpis || {};
    var h = '<div class="erf-wrap">';
    
    // Header
    h += '<div class="erf-hd"><div class="erf-hd-t">🚨 مرکز فرماندهی اورژانس</div>';
    h += '<button class="erf-btn" onclick="NABZ._erfShow()">⟳ بروزرسانی</button></div>';

    // Tabs
    h += '<div class="erf-tabs">';
    var tabs = [
      {id:'status', l:'📊 وضعیت'},
      {id:'triage', l:'🚑 ترایاژ'},
      {id:'beds', l:'🛏️ تخت‌ها'},
      {id:'codes', l:'🔴 کدها'},
      {id:'patients', l:'👤 بیماران'},
      {id:'mci', l:'🌐 بحران (MCI)'}
    ];
    tabs.forEach(function(t) {
      h += '<div class="erf-tab ' + (state.tab === t.id ? 'active' : '') + '" onclick="NABZ._erfTab(\'' + t.id + '\')">' + t.l + '</div>';
    });
    h += '</div>';

    // Body
    h += '<div class="erf-body" id="erf-content"></div></div>';
    mount(h);
    
    renderTab();
  }

  function renderTab() {
    var el = document.getElementById('erf-content');
    if (!el) return;
    if (state.tab === 'status') renderStatus(el);
    else if (state.tab === 'triage') renderTriage(el);
    else if (state.tab === 'beds') renderBeds(el);
    else if (state.tab === 'codes') renderCodes(el);
    else if (state.tab === 'patients') renderPatients(el);
    else if (state.tab === 'mci') renderMCI(el);
  }

  // ─── Tab 1: Status ───
  function renderStatus(el) {
    var k = state.data.kpis || {};
    var esi = state.data.byEsi || {};
    var totalEsi = (esi[1]||0)+(esi[2]||0)+(esi[3]||0)+(esi[4]||0)+(esi[5]||0);
    var h = '';

    h += '<div class="erf-kpi-grid">';
    h += '<div class="erf-kpi"><div class="erf-kpi-v">' + (state.data.activeVisits||0) + '</div><div class="erf-kpi-l">فعال</div></div>';
    h += '<div class="erf-kpi ' + ((state.data.activeCodes||[]).length>0?'dng':'suc') + '"><div class="erf-kpi-v">' + (state.data.activeCodes||[]).length + '</div><div class="erf-kpi-l">کد فعال</div></div>';
    h += '<div class="erf-kpi ' + (k.occupancyPct>80?'dng':'wrn') + '"><div class="erf-kpi-v">' + (k.occupancyPct||0) + '%</div><div class="erf-kpi-l">اشغال</div></div>';
    h += '<div class="erf-kpi suc"><div class="erf-kpi-v">' + (k.avgDoorToTriage!=null?k.avgDoorToTriage:'—') + 'm</div><div class="erf-kpi-l">ترایاژ</div></div>';
    h += '</div>';

    h += '<div class="erf-sec"><div class="erf-sec-h">📊 توزیع تریاژ</div><div class="erf-sec-b">';
    if (totalEsi > 0) {
      var cols = {1:'#dc2626',2:'#ea580c',3:'#eab308',4:'#16a34a',5:'#3b82f6'};
      h += '<div class="erf-esi-bar">';
      [1,2,3,4,5].forEach(function(lvl){ if(esi[lvl]) h += '<div class="erf-esi-seg" style="width:'+(esi[lvl]/totalEsi*100)+'%;background:'+cols[lvl]+'"></div>'; });
      h += '</div><div class="erf-esi-leg">';
      [1,2,3,4,5].forEach(function(lvl){ h += '<span><b style="color:'+cols[lvl]+'">'+lvl+'</b>:'+(esi[lvl]||0)+'</span>'; });
      h += '</div>';
    } else { h += '<div style="text-align:center;color:var(--kx-text-3);font-size:12px">صف خالی است</div>'; }
    h += '</div></div>';

    h += '<div class="erf-sec"><div class="erf-sec-h">🗺️ وضعیت زون‌ها</div><div class="erf-sec-b"><div class="erf-z-grid">';
    (state.data.zoneList||[]).forEach(function(z){
      var zd = state.data.zones[z.code] || {occupied:0,empty:0};
      h += '<div class="erf-z"><div class="erf-z-t">'+z.icon+' '+esc(z.label)+'</div>';
      h += '<div class="erf-z-b"><span style="color:var(--kx-danger)">اشغال: '+zd.occupied+'</span><span style="color:var(--kx-success)">آزاد: '+zd.empty+'</span></div></div>';
    });
    h += '</div></div></div>';
    el.innerHTML = h;
  }

  // ─── Tab 2: Triage ───
  async function renderTriage(el) {
    el.innerHTML = '<div class="kx2-loading">در حال بارگذاری صف ترایاژ...</div>';
    try {
      var data = await api('/api/emergency/visits?status=waiting_triage');
      var items = data.items || [];
      var h = '<div class="erf-sec"><div class="erf-sec-h">🚑 صف انتظار ترایاژ <span>'+items.length+'</span></div><div>';
      if (items.length === 0) {
        h += '<div style="text-align:center;padding:20px;color:var(--kx-text-3)">هیچ بیماری در صف نیست</div>';
      } else {
        items.forEach(function(v){
          h += '<div class="erf-row"><div><b>'+esc(v.patientName)+'</b><div style="font-size:10px;color:var(--kx-text-2)">'+esc(v.chiefComplaint)+' · '+fmt(v.arrivalAt)+'</div></div>';
          h += '<button class="erf-btn dng" onclick="NABZ._erfTriage(\''+v.id+'\')">ترایاژ</button></div>';
        });
      }
      h += '</div></div>';
      el.innerHTML = h;
    } catch (e) { el.innerHTML = '<div style="color:var(--kx-danger)">خطا: '+esc(e.message)+'</div>'; }
  }

  // ─── Tab 3: Beds ───
  async function renderBeds(el) {
    el.innerHTML = '<div class="kx2-loading">در حال بارگذاری تخت‌ها...</div>';
    try {
      var data = await api('/api/erf/beds');
      var beds = data.items || data || [];
      var byZone = {};
      beds.forEach(function(b){ var z=b.zone||'سایر'; if(!byZone[z])byZone[z]=[]; byZone[z].push(b); });
      var h = '';
      Object.keys(byZone).forEach(function(z){
        h += '<div class="erf-sec"><div class="erf-sec-h">'+esc(z)+'</div><div class="erf-sec-b">';
        byZone[z].forEach(function(b){
          var cls = b.status==='occupied'?'occupied':(b.status==='cleaning'?'cleaning':'empty');
          h += '<div class="erf-bed '+cls+'" title="'+esc(b.bedNumber||b.id)+'">'+esc(b.bedNumber||'?')+'</div>';
        });
        h += '</div></div>';
      });
      el.innerHTML = h || '<div style="text-align:center;padding:20px">تختی تعریف نشده</div>';
    } catch (e) { el.innerHTML = '<div style="color:var(--kx-danger)">خطا: '+esc(e.message)+'</div>'; }
  }

  // ─── Tab 4: Codes ───
  async function renderCodes(el) {
    el.innerHTML = '<div class="kx2-loading">در حال بارگذاری کدها...</div>';
    try {
      var data = await api('/api/emergency/codes');
      var items = (data.items || []).filter(function(c){ return c.status==='active'; });
      var h = '<div class="erf-sec"><div class="erf-sec-h">🔴 کدهای فعال <span>'+items.length+'</span></div><div class="erf-sec-b">';
      if (items.length === 0) {
        h += '<div style="text-align:center;color:var(--kx-text-3);font-size:12px">هیچ کد فعالی نیست</div>';
      } else {
        items.forEach(function(c){
          h += '<div class="erf-code-c"><div><b style="color:var(--kx-danger)">'+esc(c.codeLabel||c.code)+'</b><div>'+esc(c.patientName)+'</div></div>';
          h += '<button class="erf-btn dng" onclick="NABZ.em.viewCode(\''+c.id+'\')">مدیریت</button></div>';
        });
      }
      h += '</div></div>';
      el.innerHTML = h;
    } catch (e) { el.innerHTML = '<div style="color:var(--kx-danger)">خطا: '+esc(e.message)+'</div>'; }
  }

  // ─── Tab 5: Patients ───
  async function renderPatients(el) {
    el.innerHTML = '<div class="kx2-loading">در حال بارگذاری بیماران...</div>';
    try {
      var data = await api('/api/emergency/visits');
      var items = (data.items || []).filter(function(v){ return !['closed','discharged'].includes(v.status); });
      var cols = {1:'#dc2626',2:'#ea580c',3:'#eab308',4:'#16a34a',5:'#3b82f6'};
      var h = '<div class="erf-sec"><div class="erf-sec-h">👤 بیماران فعال <span>'+items.length+'</span></div><div>';
      if (items.length === 0) {
        h += '<div style="text-align:center;padding:20px;color:var(--kx-text-3)">بیماری در اورژانس نیست</div>';
      } else {
        items.forEach(function(v){
          h += '<div class="erf-row">';
          h += '<div style="display:flex;align-items:center;">';
          if (v.esiLevel) h += '<span class="erf-esi-badge" style="background:'+cols[v.esiLevel]+'">ESI '+v.esiLevel+'</span>';
          h += '<div><b>'+esc(v.patientName)+'</b><div style="font-size:10px;color:var(--kx-text-2)">'+esc(v.chiefComplaint)+'</div></div></div>';
          h += '<button class="erf-btn" onclick="NABZ.openKardexInteractive(\''+v.patientId+'\')">📋 کاردکس</button>';
          h += '</div>';
        });
      }
      h += '</div></div>';
      el.innerHTML = h;
    } catch (e) { el.innerHTML = '<div style="color:var(--kx-danger)">خطا: '+esc(e.message)+'</div>'; }
  }

  // ─── Tab 6: MCI ───
  async function renderMCI(el) {
    el.innerHTML = '<div class="erf-sec"><div class="erf-sec-h">🌐 مدیریت بحران (MCI)</div><div class="erf-sec-b" style="text-align:center;padding:20px;">';
    el.innerHTML += '<div style="font-size:36px;margin-bottom:12px">🌐</div>';
    el.innerHTML += '<div style="font-weight:800;margin-bottom:8px">حوادث دسته‌جمعی (MCI)</div>';
    el.innerHTML += '<div style="font-size:11px;color:var(--kx-text-2);margin-bottom:16px">در صورت وقوع حادثه بزرگ، از این بخش استفاده کنید. (به‌زودی)</div>';
    el.innerHTML += '</div></div>';
  }

  // ─── Handlers ───
  NABZ._erfShow = show;
  NABZ._erfTab = function(t) { state.tab = t; renderApp(); };
  NABZ._erfTriage = async function(id) {
    var lvl = prompt('سطح تریاژ (1-5):\n1=احیا 2=اورژانس 3=فوری 4=نیمه‌فوری 5=غیرفوری');
    if (!lvl) return;
    try {
      await api('/api/emergency/visits/'+id+'/triage', { method:'POST', body: JSON.stringify({esiLevel: Number(lvl)}) });
      NABZ._toast('✅ تریاژ ثبت شد');
      show();
    } catch(e) { alert('خطا: '+e.message); }
  };

  // Register kind
  if (window.NABZ && typeof NABZ.registerKind === 'function') {
    NABZ.registerKind('erf_command', show);
    console.log('[erf_ui] v2 Command Center registered');
  } else {
    var t = setInterval(function(){ if(window.NABZ && NABZ.registerKind){ clearInterval(t); NABZ.registerKind('erf_command', show); } }, 100);
  }
})();
