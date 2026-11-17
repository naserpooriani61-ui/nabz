// ═══════════════════════════════════════════════════════════
//  NABZ — Nursing Workspace UI
//  Patient-centric tabbed workspace
// ═══════════════════════════════════════════════════════════
(function(){
'use strict';
const state = { pid: null, data: null, tab: 'overview' };

function _api(p, o) { return NABZ._api(p, o); }
function _esc(s) { return NABZ._esc(s); }
function _close() { document.querySelectorAll('.bs-backdrop').forEach(el => el.remove()); }
function _sheet(html, opts) {
  opts = opts || {};
  const s = document.createElement('div'); s.className = 'bs-backdrop';
  s.onclick = e => { if (e.target === s && !opts.noClose) s.remove(); };
  const c = document.createElement('div'); c.className = 'bs-sheet';
  c.style.maxHeight='97vh'; c.style.padding = '12px 12px calc(env(safe-area-inset-bottom,0px) + 16px)';
  c.innerHTML = html;
  s.appendChild(c); document.body.appendChild(s);
  requestAnimationFrame(() => s.classList.add('show'));
  return { sheet:s, content:c };
}
function _ago(iso) { if (!iso) return '—'; const ms=Date.now()-new Date(iso).getTime(); const m=Math.floor(ms/60000); if(m<1)return 'الان'; if(m<60)return m+'د'; const hr=Math.floor(m/60); if(hr<24)return hr+'س'; return Math.floor(hr/24)+' روز'; }
function _time(iso) { if(!iso) return '—'; try { return new Date(iso).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}); } catch(_){ return '—'; } }
function _lvl(l) { return l === 'critical' ? 'dng' : l === 'high' ? 'warn' : l === 'medium' ? 'info' : 'ok'; }
function _confirm(msg) { return window.confirm(msg); }

// ═══ OPEN ═══
async function open(patientId) {
  state.pid = patientId;
  state.tab = 'overview';
  NABZ.state.current = 'nursing_workspace.patient';
  _render();
  await _load();
}

async function _load() {
  try {
    const d = await _api('/api/nw/workspace/' + state.pid);
    state.data = d;
    _render();
  } catch (e) {
    document.getElementById('content').innerHTML = '<div class="empty">خطا: ' + _esc(e.message) + '</div>';
  }
}

function _reload() { _load(); }

function _render() {
  const m = document.getElementById('content'); if (!m) return;
  if (!state.data) {
    m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
    return;
  }
  const d = state.data;
  const p = d.patient;
  const v = d.vitals;
  const lv = v.last;
  let h = '';

  // ═══ STICKY HEADER ═══
  h += '<div style="position:sticky;top:0;z-index:10;background:var(--bg);padding-bottom:6px;margin:-4px -4px 8px;padding:8px 4px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
  h += '<button class="btn btn-sm" style="padding:6px 10px;font-size:11px" onclick="NABZ.nurseHQ.show(null,null)">← بازگشت</button>';
  h += '<div style="text-align:left"><div style="font-size:18px;font-weight:900;color:var(--' + _lvl(d.flags.length ? 'critical' : 'ok') + ')">' + _esc(p.name) + '</div>';
  h += '<div style="font-size:11px;color:var(--fg-2)">' + (p.age||'?') + ' سال · ' + _esc(p.ward) + ' · تخت ' + _esc(p.bed) + '</div>';
  if (p.diagnosis) h += '<div style="font-size:11.5px;font-weight:700;margin-top:2px;max-width:70vw">' + _esc(p.diagnosis.slice(0,100)) + '</div>';
  h += '</div></div>';

  // Flags
  if (d.flags.length) {
    h += '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:6px">';
    d.flags.forEach(f => { h += '<span class="pill ' + _lvl(f.severity) + '" style="font-size:9.5px">' + f.icon + ' ' + _esc(f.text) + '</span>'; });
    h += '</div>';
  }

  // Vitals strip
  if (lv) {
    h += '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:3px;margin-top:6px">';
    const cells = [
      ['HR', lv.hr, lv.hr > 110 || lv.hr < 50 ? 'dng' : ''],
      ['BP', (lv.bp_sys||'—')+'/'+(lv.bp_dia||'—'), lv.bp_sys < 90 ? 'dng' : ''],
      ['RR', lv.rr, lv.rr >= 22 ? 'warn' : ''],
      ['T', lv.temp ? lv.temp+'°' : '—', lv.temp >= 38.3 ? 'warn' : ''],
      ['SpO₂', lv.spo2 ? lv.spo2+'%' : '—', lv.spo2 < 92 ? 'dng' : ''],
      ['NEWS', lv.news2, lv.news2 >= 7 ? 'dng' : lv.news2 >= 5 ? 'warn' : 'ok']
    ];
    cells.forEach(([l, val, c]) => {
      h += '<div style="text-align:center;padding:4px 2px;background:var(--bg-2);border-radius:5px;border:1px solid var(--' + (c || 'border') + ')">';
      h += '<div style="font-size:12px;font-weight:900;color:var(--' + (c || 'fg') + ')">' + _esc(String(val == null ? '—' : val)) + '</div>';
      h += '<div style="font-size:8px;color:var(--fg-2)">' + l + '</div></div>';
    });
    h += '</div>';
    if (v.trend && v.trend.dir !== 'flat') {
      const tc = v.trend.dir === 'up' ? 'dng' : 'ok';
      h += '<div style="font-size:10px;color:var(--' + tc + ');margin-top:3px;font-weight:800">' + (v.trend.dir === 'up' ? '📈 NEWS صعودی ' + v.trend.from + '→' + v.trend.to : '📉 بهبود ' + v.trend.from + '→' + v.trend.to) + ' · ' + (v.ageMin < 60 ? v.ageMin + 'د پیش' : Math.round(v.ageMin/60) + 'س پیش') + '</div>';
    }
  }
  h += '</div>';

  // ═══ TABS ═══
  const tabs = [
    ['overview','کلیات'],
    ['kardex','کاردکس' + (d.orders.pending.length ? ' (' + d.orders.pending.length + ')' : '')],
    ['meds','دارو' + (d.mar.overdue ? ' (' + d.mar.overdue + ')' : '')],
    ['infusion','انفوزیون' + (d.infusions.length ? ' (' + d.infusions.length + ')' : '')],
    ['io','I/O'],
    ['transfusion','خون'],
    ['ventilator','ونتیلاتور'],
    ['assess','ارزیابی'],
    ['procedure','پروسیجر'],
    ['wound','زخم' + (d.wounds.length ? ' (' + d.wounds.length + ')' : '')],
    ['notes','یادداشت'],
    ['docs','اسناد']
  ];
  h += '<div style="display:flex;gap:3px;overflow-x:auto;padding-bottom:6px;margin-bottom:8px;-webkit-overflow-scrolling:touch">';
  tabs.forEach(([k, l]) => {
    const on = state.tab === k;
    h += '<button onclick="NABZ.nurseWS._setTab(\'' + k + '\')" style="padding:6px 10px;font-family:inherit;font-size:11px;font-weight:800;white-space:nowrap;cursor:pointer;border-radius:8px;border:1.5px solid ' + (on ? 'var(--primary)' : 'var(--border)') + ';background:' + (on ? 'var(--primary)' : 'var(--bg-2)') + ';color:' + (on ? '#fff' : 'var(--fg)') + '">' + l + '</button>';
  });
  h += '</div>';

  h += '<div id="wsContent"></div>';
  m.innerHTML = h;

  _renderTab();
}

function _setTab(t) { state.tab = t; _render(); }

function _renderTab() {
  const el = document.getElementById('wsContent'); if (!el) return;
  const d = state.data; if (!d) return;
  if (state.tab === 'overview') return _renderOverview(el, d);
  if (state.tab === 'kardex') return _renderKardex(el, d);
  if (state.tab === 'meds') return _renderMeds(el, d);
  if (state.tab === 'infusion') return _renderInfusion(el, d);
  if (state.tab === 'io') return _renderIO(el, d);
  if (state.tab === 'transfusion') return (NABZ.nurseTx && NABZ.nurseTx.render) ? NABZ.nurseTx.render(el, d, state.pid) : (el.innerHTML = '<div class="empty">ماژول ترانسفوزیون لود نشده</div>');
  if (state.tab === 'ventilator') return (NABZ.nurseVent && NABZ.nurseVent.render) ? NABZ.nurseVent.render(el, d, state.pid) : (el.innerHTML = '<div class="empty">ماژول ونتیلاتور لود نشده</div>');
  if (state.tab === 'assess') return _renderAssess(el, d);
  if (state.tab === 'procedure') return _renderProcedure(el, d);
  if (state.tab === 'wound') return _renderWound(el, d);
  if (state.tab === 'notes') return _renderNotes(el, d);
  if (state.tab === 'docs') return _renderDocs(el, d);
}

// ═══ TAB: OVERVIEW ═══
function _renderOverview(el, d) {
  const p = d.patient;
  let h = '';
  // Active alerts
  const alerts = [];
  if (d.sepsis.active) alerts.push({ icon:'🦠', text:'سپسیس ' + d.sepsis.status + ' — qSOFA ' + d.sepsis.qsofa, action:'NABZ.show(\'safety.sepsis\')' });
  if (d.mar.overdue > 0) alerts.push({ icon:'💊', text:d.mar.overdue + ' MAR دیرکرد', action:'NABZ.nurseWS._setTab(\'meds\')' });
  if (d.mar.missed > 0) alerts.push({ icon:'❌', text:d.mar.missed + ' missed', action:'NABZ.nurseWS._setTab(\'meds\')' });
  if (d.orders.pending.length > 0) alerts.push({ icon:'📝', text:d.orders.pending.length + ' دستور در انتظار تأیید', action:'NABZ.nurseWS._setTab(\'kardex\')' });
  if (d.infusion) { /* not per patient */ }
  if (alerts.length) {
    h += '<div class="card" style="padding:10px;margin-bottom:10px;background:var(--dng-soft);border-color:var(--dng)">';
    alerts.forEach(a => { h += '<div style="padding:4px 0;font-size:12px;font-weight:800;cursor:pointer" onclick="' + a.action + '">' + a.icon + ' ' + _esc(a.text) + '</div>'; });
    h += '</div>';
  }

  // Current infusions
  if (d.infusions.length) {
    h += '<div class="card" style="padding:10px;margin-bottom:10px"><div style="font-size:11.5px;font-weight:900;color:var(--primary);margin-bottom:6px">💉 انفوزیون فعال (' + d.infusions.length + ')</div>';
    d.infusions.forEach(i => {
      h += '<div style="padding:6px 8px;background:var(--bg-2);border-radius:6px;margin-bottom:4px;font-size:11.5px">';
      h += '<div style="font-weight:900">' + _esc(i.drug) + '</div>';
      h += '<div style="font-size:10px;color:var(--fg-2)">' + i.rate + ' ' + _esc(i.rateUnit) + ' · VIP ' + (i.vipScore||0) + ' · ' + _esc(i.site||'') + '</div>';
      h += '</div>';
    });
    h += '</div>';
  }

  // Active meds (compact)
  if (d.mar.active.length) {
    h += '<div class="card" style="padding:10px;margin-bottom:10px"><div style="font-size:11.5px;font-weight:900;color:var(--primary);margin-bottom:6px">💊 دوزهای نزدیک</div>';
    d.mar.active.slice(0, 5).forEach(m => {
      h += '<div style="padding:6px 8px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;font-size:11px;display:flex;justify-content:space-between">';
      h += '<span><b>' + _esc(m.drugName) + '</b> ' + _esc(m.dose||'') + '</span>';
      h += '<span style="color:var(--fg-2)">' + _time(m.scheduledAt) + (m.isHighAlert ? ' ⚠️' : '') + '</span>';
      h += '</div>';
    });
    h += '</div>';
  }

  // I/O 24h
  h += '<div class="card" style="padding:10px;margin-bottom:10px"><div style="font-size:11.5px;font-weight:900;color:var(--primary);margin-bottom:6px">💧 I/O ۲۴h</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center;font-size:11px">';
  h += '<div><div style="font-weight:900;font-size:14px">' + d.io.in + '</div><div style="color:var(--fg-2)">ورودی ml</div></div>';
  h += '<div><div style="font-weight:900;font-size:14px">' + d.io.out + '</div><div style="color:var(--fg-2)">خروجی ml</div></div>';
  const nc = d.io.net < -1000 ? 'dng' : d.io.net < -500 ? 'warn' : 'ok';
  h += '<div style="color:var(--' + nc + ')"><div style="font-weight:900;font-size:14px">' + (d.io.net > 0 ? '+' : '') + d.io.net + '</div><div>تعادل</div></div>';
  h += '</div></div>';

  // Last round
  if (d.lastRound) {
    h += '<div class="card" style="padding:10px;margin-bottom:10px"><div style="font-size:11.5px;font-weight:900;color:var(--primary);margin-bottom:4px">📝 آخرین راند (' + d.lastRound.hoursAgo + 'h پیش)</div>';
    h += '<div style="font-size:11px;color:var(--fg-2)">' + _esc(d.lastRound.author||'') + '</div>';
    if (d.lastRound.impression) h += '<div style="font-size:11px;margin-top:2px">' + _esc(d.lastRound.impression) + '</div>';
    h += '</div>';
  }

  // Quick actions
  h += '<div style="font-size:11.5px;font-weight:900;color:var(--primary);margin:12px 0 6px">⚡ اقدام سریع</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px">';
  h += _qb('📈','ویتال','NABZ.nurseWS._quickVitals()');
  h += _qb('💊','MAR','NABZ.nurseWS._setTab(\'meds\')');
  h += _qb('💧','I/O','NABZ.nurseWS._openIO()');
  h += _qb('📝','یادداشت','NABZ.nurseWS._openNote()');
  h += _qb('🩺','ارزیابی','NABZ.nurseWS._setTab(\'assess\')');
  h += _qb('💉','انفوزیون','NABZ.nurseWS._setTab(\'infusion\')');
  h += _qb('📋','کاردکس','NABZ.nurseWS._setTab(\'kardex\')');
  h += _qb('📄','پرونده','NABZ.nurseWS._openRecord()');
  h += '</div>';
  el.innerHTML = h;
}

function _qb(icon, label, fn) {
  return '<button onclick="' + fn + '" style="background:var(--bg-2);border:1.5px solid var(--border);border-radius:8px;padding:8px 4px;text-align:center;font-family:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px">' +
    '<span style="font-size:20px">' + icon + '</span><span style="font-size:9.5px;font-weight:800">' + label + '</span></button>';
}

// ═══ TAB: KARDEX ═══
function _renderKardex(el, d) {
  let h = '';
  h += '<button class="btn btn-primary btn-block" style="padding:10px;margin-bottom:8px;font-weight:900" onclick="NABZ.nurseWS._openNewOrder()">➕ دستور جدید / Verbal</button>';
  if (d.orders.pending.length) {
    h += '<div style="font-size:11px;font-weight:900;color:var(--warn);margin-bottom:6px;padding:4px 8px;background:var(--warn-soft);border-radius:6px">📝 ' + d.orders.pending.length + ' دستور در انتظار تأیید</div>';
    d.orders.pending.forEach(o => { h += _orderRow(o); });
  }
  if (d.orders.held.length) {
    h += '<div style="font-size:11px;font-weight:900;color:var(--info);margin:8px 0 6px;padding:4px 8px;background:var(--info-soft);border-radius:6px">⏸ ' + d.orders.held.length + ' دستور Hold</div>';
    d.orders.held.forEach(o => { h += _orderRow(o); });
  }
  const active = d.orders.active.filter(o => o.status === 'verified' || o.status === 'active');
  if (active.length) {
    h += '<div style="font-size:11px;font-weight:900;color:var(--ok);margin:8px 0 6px;padding:4px 8px;background:var(--ok-soft);border-radius:6px">✅ ' + active.length + ' دستور فعال</div>';
    active.forEach(o => { h += _orderRow(o); });
  }
  if (!d.orders.active.length) {
    h += '<div class="empty">دستوری ثبت نشده</div>';
  }
  el.innerHTML = h;
}

function _orderRow(o) {
  const cls = o.status === 'pending' ? 'warn' : o.status === 'held' ? 'info' : 'ok';
  const icon = o.type === 'medication' ? '💊' : o.type === 'lab' ? '🧪' : o.type === 'paraclinical' ? '🩻' : o.type === 'consult' ? '🩺' : o.type === 'nursing' ? '📋' : o.type === 'diet' ? '🍽' : '📄';
  const info = o.drug ? o.drug + ' ' + (o.dose||'') + ' · ' + (o.route||'') + ' · ' + (o.frequency||'') :
               o.panel ? o.panel : o.modality ? o.modality + ' ' + (o.bodyPart||'') : o.note || o.diet || '';
  let h = '<div class="card" style="padding:8px 10px;margin-bottom:3px;border-right:3px solid var(--' + cls + ');cursor:pointer" onclick="NABZ.nurseWS._openOrder(\'' + o.id + '\')">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
  h += '<div style="flex:1;min-width:0">';
  h += '<div style="font-size:11.5px;font-weight:900">' + icon + ' ' + _esc(info.slice(0, 80)) + '</div>';
  h += '<div style="font-size:10px;color:var(--fg-2)">' + (o.isVerbal ? '📞 Verbal · ' : '') + (o.priority === 'stat' ? '⚡ STAT · ' : '') + _time(o.orderedAt) + (o.isHighAlert ? ' · ⚠️' : '') + (o.isControlled ? ' · 🔒' : '') + '</div>';
  h += '</div>';
  h += '<span class="pill ' + cls + '" style="font-size:8.5px">' + (o.status === 'pending' ? 'معلق' : o.status === 'held' ? 'Hold' : 'فعال') + '</span>';
  h += '</div></div>';
  return h;
}

// ═══ TAB: MEDS ═══
function _renderMeds(el, d) {
  let h = '';
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:10px">';
  h += '<div class="card" style="padding:8px;text-align:center"><div style="font-size:18px;font-weight:900">' + d.mar.due + '</div><div style="font-size:9px;color:var(--fg-2)">در ۲ ساعت</div></div>';
  h += '<div class="card" style="padding:8px;text-align:center;' + (d.mar.overdue > 0 ? 'border-color:var(--dng)' : '') + '"><div style="font-size:18px;font-weight:900;color:var(--' + (d.mar.overdue > 0 ? 'dng' : 'fg') + ')">' + d.mar.overdue + '</div><div style="font-size:9px;color:var(--fg-2)">دیرکرد</div></div>';
  h += '<div class="card" style="padding:8px;text-align:center;' + (d.mar.missed > 0 ? 'border-color:var(--dng)' : '') + '"><div style="font-size:18px;font-weight:900;color:var(--' + (d.mar.missed > 0 ? 'dng' : 'fg') + ')">' + d.mar.missed + '</div><div style="font-size:9px;color:var(--fg-2)">Missed</div></div>';
  h += '</div>';
  h += '<div style="font-size:11.5px;font-weight:900;color:var(--primary);margin-bottom:6px">💊 دوزهای در انتظار</div>';
  if (!d.mar.active.length) h += '<div class="empty">دوزی در ۲۴ ساعت آینده نیست</div>';
  else d.mar.active.forEach(m => { h += _marRow(m); });
  if (d.mar.recent.length) {
    h += '<div style="font-size:11.5px;font-weight:900;color:var(--primary);margin:14px 0 6px">📋 آخرین توزیع‌ها</div>';
    d.mar.recent.slice(0, 8).forEach(m => { h += _marRecentRow(m); });
  }
  el.innerHTML = h;
}

function _marRow(m) {
  const now = Date.now();
  const dueMs = sd(m.scheduledAt);
  const overdueMin = Math.round((now - dueMs)/60000);
  const cls = overdueMin >= 120 ? 'dng' : overdueMin >= 30 ? 'warn' : 'ok';
  let h = '<div class="card" style="padding:8px 10px;margin-bottom:4px;border-right:3px solid var(--' + cls + ')">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
  h += '<div style="flex:1"><div style="font-size:11.5px;font-weight:900">' + (m.isHighAlert ? '⚠️ ' : '') + _esc(m.drugName) + ' ' + _esc(m.dose||'') + '</div>';
  h += '<div style="font-size:10px;color:var(--fg-2)">' + _esc(m.route||'') + ' · ' + _time(m.scheduledAt) + (overdueMin > 0 ? ' · ' + overdueMin + 'د دیرکرد' : '') + '</div>';
  h += '</div>';
  h += '<button class="btn btn-primary btn-sm" style="padding:6px 10px;font-size:10.5px;min-width:70px" onclick="event.stopPropagation();NABZ.nurseWS._openMarGive(\'' + m.id + '\')">توزیع</button>';
  h += '</div></div>';
  return h;
}

function _marRecentRow(m) {
  const cls = m.status === 'given' ? 'ok' : m.status === 'missed' ? 'dng' : 'warn';
  let h = '<div style="padding:6px 8px;background:var(--bg-2);border-radius:5px;margin-bottom:3px;font-size:11px;border-right:2px solid var(--' + cls + ')">';
  h += '<div style="display:flex;justify-content:space-between"><b>' + _esc(m.drugName) + ' ' + _esc(m.dose||'') + '</b><span style="font-size:9px;color:var(--' + cls + ')">' + (m.status === 'given' ? 'داده شد' : m.status === 'missed' ? 'missed' : m.status) + '</span></div>';
  h += '<div style="font-size:9.5px;color:var(--fg-2)">' + _time(m.administeredAt || m.scheduledAt) + (m.witnessedByName ? ' · شاهد: ' + _esc(m.witnessedByName) : '') + '</div>';
  h += '</div>';
  return h;
}

// ═══ TAB: INFUSION ═══
function _renderInfusion(el, d) {
  let h = '';
  h += '<button class="btn btn-primary btn-block" style="padding:10px;margin-bottom:8px;font-weight:900" onclick="NABZ.nurseWS._openNewInfusion()">➕ شروع انفوزیون جدید</button>';
  if (!d.infusions.length) { h += '<div class="empty">هیچ انفوزیون فعالی نیست</div>'; el.innerHTML = h; return; }
  d.infusions.forEach(i => {
    const cls = i.vipScore >= 3 ? 'dng' : i.vipScore === 2 ? 'warn' : 'ok';
    h += '<div class="card" style="padding:10px;margin-bottom:6px;border-right:3px solid var(--' + cls + ')">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:6px">';
    h += '<div><div style="font-size:12.5px;font-weight:900">💉 ' + _esc(i.drug) + ' ' + _esc(i.dose||'') + '</div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2)">' + i.rate + ' ' + _esc(i.rateUnit) + ' · VIP ' + (i.vipScore||0) + ' · ' + _esc(i.site||'') + '</div>';
    h += '<div style="font-size:10px;color:var(--fg-2)">شروع: ' + _ago(i.startedAt) + ' · Bag: ' + _ago(i.bagStartedAt) + ' · Tubing: ' + _ago(i.tubingChangedAt) + '</div>';
    if (i.remaining != null) h += '<div style="font-size:10px;color:var(--fg-2)">باقی: ' + i.remaining + ' / ' + i.totalVolume + ' ml</div>';
    h += '</div>';
    h += '<span class="pill ' + cls + '" style="font-size:9px">' + (i.isHighAlert ? '⚠️ High-Alert' : 'فعال') + '</span>';
    h += '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">';
    if (i.isTitratable) h += '<button class="btn btn-sm" style="padding:6px;font-size:10px" onclick="NABZ.nurseWS._openTitrate(\'' + i.id + '\')">⚙️ Titration</button>';
    h += '<button class="btn btn-sm" style="padding:6px;font-size:10px" onclick="NABZ.nurseWS._openSite(\'' + i.id + '\')">👁 Site</button>';
    h += '<button class="btn btn-sm" style="padding:6px;font-size:10px" onclick="NABZ.nurseWS._doBag(\'' + i.id + '\')">🔄 Bag</button>';
    h += '<button class="btn btn-sm" style="padding:6px;font-size:10px;color:var(--dng)" onclick="NABZ.nurseWS._openStop(\'' + i.id + '\')">⏹ Stop</button>';
    h += '</div></div>';
  });
  el.innerHTML = h;
}

// ═══ TAB: IO ═══
function _renderIO(el, d) {
  let h = '';
  h += '<button class="btn btn-primary btn-block" style="padding:10px;margin-bottom:8px;font-weight:900" onclick="NABZ.nurseWS._openIO()">➕ ثبت I/O</button>';
  h += '<div class="card" style="padding:10px;margin-bottom:8px"><div style="font-size:11.5px;font-weight:900;color:var(--primary);margin-bottom:6px">📊 خلاصه ۲۴h</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center;font-size:11px">';
  h += '<div><div style="font-size:16px;font-weight:900">' + d.io.in + '</div><div style="color:var(--fg-2)">ورودی ml</div></div>';
  h += '<div><div style="font-size:16px;font-weight:900">' + d.io.out + '</div><div style="color:var(--fg-2)">خروجی ml</div></div>';
  const nc = d.io.net < -1000 ? 'dng' : d.io.net < -500 ? 'warn' : 'ok';
  h += '<div style="color:var(--' + nc + ')"><div style="font-size:16px;font-weight:900">' + (d.io.net > 0 ? '+' : '') + d.io.net + '</div><div>تعادل</div></div>';
  h += '</div></div>';
  // Breakdown
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h += '<div class="card" style="padding:8px"><div style="font-size:10.5px;font-weight:900;color:var(--ok);margin-bottom:4px">ورودی‌ها</div>';
  Object.entries(d.io.bySubtype.in).forEach(([k, v]) => { h += '<div style="font-size:10.5px;padding:1px 0">' + _subFa(k) + ': <b>' + v + '</b></div>'; });
  h += '</div>';
  h += '<div class="card" style="padding:8px"><div style="font-size:10.5px;font-weight:900;color:var(--warn);margin-bottom:4px">خروجی‌ها</div>';
  Object.entries(d.io.bySubtype.out).forEach(([k, v]) => { h += '<div style="font-size:10.5px;padding:1px 0">' + _subFa(k) + ': <b>' + v + '</b></div>'; });
  h += '</div></div>';
  if (d.io.recent.length) {
    h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin:8px 0 4px">📋 آخرین ثبت‌ها</div>';
    d.io.recent.forEach(r => {
      h += '<div style="padding:5px 8px;background:var(--bg-2);border-radius:4px;margin-bottom:2px;font-size:10.5px;display:flex;justify-content:space-between">';
      h += '<span>' + (r.type === 'intake' ? '🟢' : '🔴') + ' ' + _subFa(r.subtype) + '</span>';
      h += '<span><b>' + r.volume + '</b> ml · ' + _time(r.at) + '</span>';
      h += '</div>';
    });
  }
  el.innerHTML = h;
}

function _subFa(k) {
  return { oral:'خوراکی', iv:'وریدی', ngt:'NGT', tpn:'TPN', medication:'دارو', blood:'خون', irrigation:'شستشو',
    urine:'ادرار', stool:'مدفوع', vomit:'استفراغ', drain:'درناژ', wound:'زخم', ng:'NG', other:'سایر' }[k] || k;
}

// ═══ TAB: ASSESS ═══
function _renderAssess(el, d) {
  let h = '';
  const forms = [
    ['head_to_toe', '📋 سر تا پا'],
    ['focused_resp', '🫁 تنفسی'],
    ['focused_cv', '💓 قلبی-عروقی'],
    ['focused_gi', '🫄 گوارشی'],
    ['focused_neuro', '🧠 نورولوژیک'],
    ['wound', '🩹 زخم'],
    ['iv_site', '💉 محل ورید'],
    ['rass', '😴 RASS'],
    ['cam_icu', '🧠 CAM-ICU'],
    ['must', '🥗 MUST'],
    ['pain', '🩹 درد']
  ];
  h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:5px;margin-bottom:10px">';
  forms.forEach(([t, l]) => {
    h += '<button class="btn" style="padding:10px;font-size:11px;font-weight:800" onclick="NABZ.nurseWS._openAssess(\'' + t + '\')">' + l + '</button>';
  });
  h += '</div>';
  if (d.assessments.length) {
    h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin:8px 0 4px">📊 آخرین ارزیابی‌ها</div>';
    d.assessments.slice(0, 15).forEach(a => {
      h += '<div style="padding:6px 8px;background:var(--bg-2);border-radius:5px;margin-bottom:3px;font-size:10.5px">';
      h += '<div style="display:flex;justify-content:space-between"><b>' + _esc(a.summary || a.type) + '</b><span style="color:var(--fg-2)">' + _time(a.at) + '</span></div>';
      h += '<div style="font-size:9.5px;color:var(--fg-2)">' + _esc(a.byName||'') + '</div>';
      h += '</div>';
    });
  }
  el.innerHTML = h;
}

// ═══ TAB: PROCEDURE ═══
function _renderProcedure(el, d) {
  let h = '<button class="btn btn-primary btn-block" style="padding:10px;margin-bottom:8px;font-weight:900" onclick="NABZ.nurseWS._openNewProcedure()">➕ پروسیجر جدید</button>';
  if (!d.procedures.length) { h += '<div class="empty">پروسیجری ثبت نشده</div>'; el.innerHTML = h; return; }
  d.procedures.forEach(p => {
    h += '<div class="card" style="padding:8px 10px;margin-bottom:3px;font-size:11.5px">';
    h += '<div style="font-weight:900">' + _esc(p.typeLabel || p.type) + '</div>';
    h += '<div style="font-size:10px;color:var(--fg-2)">' + _ago(p.createdAt) + ' · ' + _esc(p.operatorName||'') + ' · ' + _esc(p.status||'') + '</div>';
    h += '</div>';
  });
  el.innerHTML = h;
}

// ═══ TAB: WOUND ═══
function _renderWound(el, d) {
  let h = '<button class="btn btn-primary btn-block" style="padding:10px;margin-bottom:8px;font-weight:900" onclick="NABZ.nurseWS._openAssess(\'wound\')">➕ ارزیابی زخم جدید</button>';
  if (!d.wounds.length) { h += '<div class="empty">زخمی ثبت نشده</div>'; el.innerHTML = h; return; }
  d.wounds.forEach(w => {
    h += '<div class="card" style="padding:10px;margin-bottom:6px">';
    h += '<div style="font-size:11.5px;font-weight:900">🩹 ' + _esc(w.location) + ' — مرحله ' + _esc(w.stage||'') + '</div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2)">اندازه: ' + _esc(w.size||'') + ' · ' + _esc(w.tissue||'') + '</div>';
    h += '<div style="font-size:10px;color:var(--fg-2)">ترشح: ' + _esc(w.exudate||'') + ' · پانسمان: ' + _esc(w.dressing||'') + '</div>';
    if (w.nextChangeAt) h += '<div style="font-size:10px;color:var(--warn)">تغییر بعدی: ' + _time(w.nextChangeAt) + '</div>';
    h += '</div>';
  });
  el.innerHTML = h;
}

// ═══ TAB: NOTES ═══
function _renderNotes(el, d) {
  let h = '<button class="btn btn-primary btn-block" style="padding:10px;margin-bottom:8px;font-weight:900" onclick="NABZ.nurseWS._openNote()">➕ یادداشت جدید</button>';
  if (!d.notes.length) { h += '<div class="empty">یادداشتی نیست</div>'; el.innerHTML = h; return; }
  d.notes.forEach(n => {
    h += '<div class="card" style="padding:8px 10px;margin-bottom:3px">';
    h += '<div style="display:flex;justify-content:space-between"><b style="font-size:11px">' + _esc(n.category||'') + '</b><span style="font-size:9.5px;color:var(--fg-2)">' + _ago(n.at) + '</span></div>';
    h += '<div style="font-size:11.5px;margin-top:2px;white-space:pre-wrap">' + _esc(n.text||'') + '</div>';
    h += '<div style="font-size:9.5px;color:var(--fg-2);margin-top:2px">' + _esc(n.by||'') + '</div>';
    h += '</div>';
  });
  el.innerHTML = h;
}

// ═══ TAB: DOCS ═══
function _renderDocs(el, d) {
  let h = '';
  h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin-bottom:6px">📄 اسناد پرونده</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px">';
  h += '<button class="btn" style="padding:12px;font-size:11.5px" onclick="NABZ.nurseWS._openDoc(\'kardex\')">📋 کاردکس</button>';
  h += '<button class="btn" style="padding:12px;font-size:11.5px" onclick="NABZ.nurseWS._openDoc(\'mar\')">💊 MAR</button>';
  h += '<button class="btn" style="padding:12px;font-size:11.5px" onclick="NABZ.nurseWS._openDoc(\'vitalsChart\')">📈 ویتال</button>';
  h += '<button class="btn" style="padding:12px;font-size:11.5px" onclick="NABZ.nurseWS._openSBAR()">📋 SBAR</button>';
  h += '</div>';
  if (d.consults.length) {
    h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin-bottom:6px">🩺 مشاوره‌ها</div>';
    d.consults.forEach(c => {
      h += '<div style="padding:5px 8px;background:var(--bg-2);border-radius:4px;margin-bottom:2px;font-size:10.5px">' + _esc(c.service) + ' · ' + _esc(c.status) + '</div>';
    });
  }
  el.innerHTML = h;
}

// ═══ ACTIONS ═══
function _openOrder(orderId) {
  const o = state.data.orders.active.find(x => x.id === orderId);
  if (!o) return;
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">📝 ' + _esc(o.drug || o.panel || o.note || o.diet || o.type) + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="card" style="padding:10px;margin-bottom:8px">';
  h += '<div style="font-size:11px;color:var(--fg-2)">وضعیت: <b>' + o.status + '</b></div>';
  if (o.drug) h += '<div style="font-size:11.5px;margin-top:2px">' + _esc(o.drug) + ' ' + _esc(o.dose||'') + ' · ' + _esc(o.route||'') + ' · ' + _esc(o.frequency||'') + '</div>';
  if (o.durationDays) h += '<div style="font-size:11px;color:var(--fg-2)">مدت: ' + o.durationDays + ' روز</div>';
  if (o.holdReason) h += '<div style="font-size:11px;color:var(--warn);margin-top:4px">Hold: ' + _esc(o.holdReason) + '</div>';
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
  if (o.status === 'pending') h += '<button class="btn btn-ok" style="padding:10px" onclick="NABZ.nurseWS._verifyOrder(\'' + o.id + '\')">✅ تأیید</button>';
  if (o.status === 'verified' || o.status === 'active') h += '<button class="btn btn-dng" style="padding:10px" onclick="NABZ.nurseWS._holdOrder(\'' + o.id + '\')">⏸ Hold</button>';
  if (o.status === 'held') h += '<button class="btn btn-ok" style="padding:10px" onclick="NABZ.nurseWS._resumeOrder(\'' + o.id + '\')">▶ Resume</button>';
  if (o.status === 'verified' || o.status === 'held') h += '<button class="btn" style="padding:10px;color:var(--dng);border-color:var(--dng)" onclick="NABZ.nurseWS._discOrder(\'' + o.id + '\')">✖ Discontinue</button>';
  if (o.status === 'pending' || o.status === 'verified') h += '<button class="btn" style="padding:10px" onclick="NABZ.nurseWS._modOrder(\'' + o.id + '\')">✎ ویرایش</button>';
  h += '</div>';
  _sheet(h, { noClose: false });
}

async function _verifyOrder(id) {
  try { await _api('/api/nw/order/' + id + '/verify', { method:'POST', body:'{}' }); _close(); NABZ._toast('✅ تأیید شد'); _reload(); } catch(e) { alert('خطا: ' + e.message); }
}
function _holdOrder(id) {
  _close();
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">⏸ Hold دستور</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>دلیل *</label><textarea id="ho_reason" rows="2"></textarea></div>';
  h += '<div class="wf-field"><label>مدت (دقیقه، اختیاری)</label><input type="number" id="ho_dur" placeholder="60"></div>';
  h += '<button class="btn btn-dng btn-block" style="padding:12px;margin-top:10px" onclick="NABZ.nurseWS._doHold(\'' + id + '\')">Hold</button>';
  _sheet(h, { noClose: false });
}
async function _doHold(id) {
  const reason = (document.getElementById('ho_reason')||{}).value||'';
  const dur = parseFloat((document.getElementById('ho_dur')||{}).value) || null;
  if (reason.trim().length < 5) return alert('دلیل حداقل ۵ کاراکتر');
  try { await _api('/api/nw/order/' + id + '/hold', { method:'POST', body: JSON.stringify({ reason, durationMinutes: dur }) }); _close(); NABZ._toast('⏸ Hold شد'); _reload(); } catch(e) { alert('خطا: ' + e.message); }
}
async function _resumeOrder(id) {
  try { await _api('/api/nw/order/' + id + '/resume', { method:'POST', body:'{}' }); _close(); NABZ._toast('▶ Resume شد'); _reload(); } catch(e) { alert('خطا: ' + e.message); }
}
function _discOrder(id) {
  _close();
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">✖ Discontinue</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>دلیل *</label><textarea id="do_reason" rows="2"></textarea></div>';
  h += '<button class="btn btn-dng btn-block" style="padding:12px;margin-top:10px" onclick="NABZ.nurseWS._doDisc(\'' + id + '\')">Discontinue</button>';
  _sheet(h, { noClose: false });
}
async function _doDisc(id) {
  const reason = (document.getElementById('do_reason')||{}).value||'';
  if (reason.trim().length < 5) return alert('دلیل حداقل ۵ کاراکتر');
  try { const r = await _api('/api/nw/order/' + id + '/discontinue', { method:'POST', body: JSON.stringify({ reason }) }); _close(); NABZ._toast('✖ لغو شد — ' + r.cancelledMars + ' MAR لغو شد'); _reload(); } catch(e) { alert('خطا: ' + e.message); }
}
function _modOrder(id) {
  _close();
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">✎ ویرایش</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>دوز</label><input type="text" id="mo_dose"></div>';
  h += '<div class="wf-field"><label>تکرار</label><input type="text" id="mo_freq"></div>';
  h += '<div class="wf-field"><label>دلیل *</label><textarea id="mo_reason" rows="2"></textarea></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:10px" onclick="NABZ.nurseWS._doMod(\'' + id + '\')">ثبت</button>';
  _sheet(h, { noClose: false });
}
async function _doMod(id) {
  const dose = (document.getElementById('mo_dose')||{}).value||'';
  const freq = (document.getElementById('mo_freq')||{}).value||'';
  const reason = (document.getElementById('mo_reason')||{}).value||'';
  if (reason.trim().length < 5) return alert('دلیل حداقل ۵ کاراکتر');
  const details = {};
  if (dose) details.dose = dose;
  if (freq) details.frequency = freq;
  try { await _api('/api/nw/order/' + id + '/modify', { method:'POST', body: JSON.stringify({ details, reason }) }); _close(); NABZ._toast('✅ ثبت شد'); _reload(); } catch(e) { alert('خطا: ' + e.message); }
}

function _openNewOrder() {
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📝 دستور جدید / Verbal</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>نوع</label><select id="no_type"><option value="medication">دارو</option><option value="nursing">پرستاری</option><option value="diet">رژیم</option></select></div>';
  h += '<div class="wf-field"><label>دارو / شرح</label><input type="text" id="no_drug" placeholder="مثلاً Morphine"></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
  h += '<div class="wf-field"><label>دوز</label><input type="text" id="no_dose"></div>';
  h += '<div class="wf-field"><label>مسیر</label><input type="text" id="no_route" placeholder="IV/PO/SC"></div>';
  h += '</div>';
  h += '<div class="wf-field"><label>تکرار</label><input type="text" id="no_freq" placeholder="Q6H/OD"></div>';
  h += '<div class="wf-field"><label>اولویت</label><select id="no_pri"><option value="routine">روتین</option><option value="urgent">فوری</option><option value="stat">STAT</option></select></div>';
  h += '<div class="wf-field"><label>Verbal from (پزشک)</label><input type="text" id="no_verbal" placeholder="نام پزشک"></div>';
  h += '<div class="wf-field"><label>Read-back *</label><textarea id="no_readback" rows="2" placeholder="بازگویی شفاهی متن دستور"></textarea></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:10px" onclick="NABZ.nurseWS._doNewOrder()">ثبت</button>';
  _sheet(h, { noClose: false });
}
async function _doNewOrder() {
  const body = {
    patientId: state.pid,
    type: (document.getElementById('no_type')||{}).value,
    details: {
      drug: (document.getElementById('no_drug')||{}).value,
      dose: (document.getElementById('no_dose')||{}).value,
      route: (document.getElementById('no_route')||{}).value,
      frequency: (document.getElementById('no_freq')||{}).value
    },
    priority: (document.getElementById('no_pri')||{}).value,
    verbalFrom: (document.getElementById('no_verbal')||{}).value,
    readBack: (document.getElementById('no_readback')||{}).value
  };
  if (!body.details.drug) return alert('نام دارو الزامی');
  if (body.readBack.length < 10) return alert('read-back حداقل ۱۰ کاراکتر');
  try { await _api('/api/nw/order/verbal', { method:'POST', body: JSON.stringify(body) }); _close(); NABZ._toast('✅ ثبت شد (نیاز به تأیید)'); _reload(); } catch(e) { alert('خطا: ' + e.message); }
}

// ═══ MAR ═══
function _openMarGive(marId) {
  const m = state.data.mar.active.find(x => x.id === marId);
  if (!m) return;
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">💊 ' + _esc(m.drugName) + ' ' + _esc(m.dose||'') + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  if (m.isHighAlert) h += '<div class="hint warn" style="margin-bottom:8px">⚠️ HIGH-ALERT — نیاز به شاهد</div>';
  h += '<div style="font-size:10.5px;color:var(--fg-2);margin-bottom:8px">5 Rights باید تأیید شوند:</div>';
  ['patient','drug','dose','route','time'].forEach((r, i) => {
    h += '<label style="display:flex;align-items:center;gap:8px;padding:6px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;font-size:11.5px;cursor:pointer">';
    h += '<input type="checkbox" id="mg_r_' + r + '" checked style="width:18px;height:18px;accent-color:var(--primary)">';
    h += '<span>' + ['بیمار','دارو','دوز','مسیر','زمان'][i] + '</span></label>';
  });
  const minsLate = Math.round((Date.now() - sd(m.scheduledAt))/60000);
  if (minsLate > 30) {
    h += '<div class="wf-field" style="margin-top:8px"><label style="color:var(--dng);font-weight:900">⏰ دلیل تأخیر</label><select id="mg_late"><option value="">—</option>';
    const reasons = { patient_npo:'NPO', procedure_pending:'پروسیجر', doctor_hold:'دستور پزشک', pharmacy_delay:'داروخانه', clinical_decision:'تصمیم بالینی', patient_refused:'رد بیمار', patient_off_unit:'بیرون بخش', iv_access_issue:'مشکل IV', equipment_issue:'تجهیزات', medication_unavailable:'دارو نیست', other:'سایر' };
    Object.entries(reasons).forEach(([k, v]) => { h += '<option value="' + k + '">' + v + '</option>'; });
    h += '</select></div>';
  }
  if (m.isHighAlert) h += '<div class="wf-field" style="margin-top:8px"><label style="color:var(--warn);font-weight:900">👥 شاهد (username)</label><input type="text" id="mg_witness"></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px">';
  h += '<button class="btn btn-primary" style="padding:12px;font-weight:900" onclick="NABZ.nurseWS._doMarGive(\'' + marId + '\')">✅ توزیع</button>';
  h += '<button class="btn" style="padding:12px" onclick="NABZ.nurseWS._openMarPartial(\'' + marId + '\')">📊 دوز جزئی</button>';
  h += '</div>';
  _sheet(h, { noClose: false });
}
async function _doMarGive(marId) {
  const rights = {}; let ok = true;
  ['patient','drug','dose','route','time'].forEach(r => { const el = document.getElementById('mg_r_'+r); rights[r] = el && el.checked; if (!rights[r]) ok = false; });
  if (!ok) return alert('همه ۵ rights الزامی');
  const body = { fiveRights: rights };
  const late = document.getElementById('mg_late');
  if (late && late.value) body.lateReason = late.value;
  const wit = document.getElementById('mg_witness');
  if (wit && wit.value.trim()) body.witnessedBy = wit.value.trim();
  try { await _api('/api/mar/' + marId + '/administer-advanced', { method:'POST', body: JSON.stringify(body) }); _close(); NABZ._toast('✅ توزیع شد'); _reload(); } catch(e) { alert('خطا: ' + e.message); }
}
function _openMarPartial(marId) {
  _close();
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📊 دوز جزئی</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>دوز داده‌شده</label><input type="text" id="mp_dose"></div>';
  h += '<div class="wf-field"><label>دلیل *</label><textarea id="mp_reason" rows="2"></textarea></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:10px" onclick="NABZ.nurseWS._doMarPartial(\'' + marId + '\')">ثبت</button>';
  _sheet(h, { noClose: false });
}
async function _doMarPartial(marId) {
  const givenDose = (document.getElementById('mp_dose')||{}).value||'';
  const reason = (document.getElementById('mp_reason')||{}).value||'';
  if (!givenDose) return alert('دوز الزامی');
  if (reason.length < 5) return alert('دلیل حداقل ۵ کاراکتر');
  try { await _api('/api/nw/mar/' + marId + '/partial', { method:'POST', body: JSON.stringify({ givenDose, reason }) }); _close(); NABZ._toast('✅ ثبت شد'); _reload(); } catch(e) { alert('خطا: ' + e.message); }
}

// ═══ INFUSION ═══
function _openNewInfusion() {
  _close();
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">💉 انفوزیون جدید</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  const orders = state.data.orders.active.filter(o => o.type === 'medication' && (o.route||'').toLowerCase().indexOf('iv') >= 0);
  if (!orders.length) { h += '<div class="hint warn">هیچ دستور IV فعالی وجود ندارد</div>'; _sheet(h); return; }
  h += '<div class="wf-field"><label>دستور IV</label><select id="ni_order">';
  orders.forEach(o => { h += '<option value="' + o.id + '">' + _esc(o.drug + ' ' + (o.dose||'') + ' — ' + (o.rate||'')) + '</option>'; });
  h += '</select></div>';
  h += '<div class="wf-field"><label>محل ورید</label><input type="text" id="ni_site" placeholder="مثلاً Left forearm"></div>';
  h += '<div class="wf-field"><label>پمپ</label><input type="text" id="ni_pump" placeholder="Alaris / Baxter"></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:10px" onclick="NABZ.nurseWS._doStartInfusion()">شروع</button>';
  _sheet(h, { noClose: false });
}
async function _doStartInfusion() {
  const body = {
    orderId: (document.getElementById('ni_order')||{}).value,
    site: (document.getElementById('ni_site')||{}).value,
    pump: (document.getElementById('ni_pump')||{}).value
  };
  try { await _api('/api/nw/infusion/start', { method:'POST', body: JSON.stringify(body) }); _close(); NABZ._toast('✅ شروع شد'); _reload(); } catch(e) { alert('خطا: ' + e.message); }
}
function _openTitrate(infId) {
  const i = state.data.infusions.find(x => x.id === infId);
  if (!i) return;
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">⚙️ Titration — ' + _esc(i.drug) + '</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div style="font-size:11px;color:var(--fg-2);margin-bottom:8px">فعلی: <b>' + i.rate + ' ' + _esc(i.rateUnit) + '</b>';
  if (i.rateMin != null) h += ' · محدوده: ' + i.rateMin + '-' + i.rateMax;
  h += '</div>';
  h += '<div class="wf-field"><label>نرخ جدید</label><input type="number" step="0.1" id="tt_rate" style="font-size:22px;text-align:center;font-weight:900;padding:10px"></div>';
  h += '<div class="wf-field"><label>دلیل *</label><textarea id="tt_reason" rows="2" placeholder="مثلاً: SBP 78 → نیازی به افزایش"></textarea></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:10px" onclick="NABZ.nurseWS._doTitrate(\'' + infId + '\')">ثبت</button>';
  _sheet(h, { noClose: false });
}
async function _doTitrate(infId) {
  const rate = parseFloat((document.getElementById('tt_rate')||{}).value);
  const reason = (document.getElementById('tt_reason')||{}).value||'';
  if (isNaN(rate)) return alert('نرخ الزامی');
  if (reason.length < 5) return alert('دلیل حداقل ۵ کاراکتر');
  try { await _api('/api/nw/infusion/' + infId + '/rate', { method:'POST', body: JSON.stringify({ rate, reason }) }); _close(); NABZ._toast('✅ تنظیم شد'); _reload(); } catch(e) { alert('خطا: ' + e.message); }
}
function _openSite(infId) {
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">👁 ارزیابی محل ورید (VIP)</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>VIP Score (0-5)</label><select id="vs_vip"><option value="0">0 — سالم</option><option value="1">1 — درد خفیف یا قرمزی خفیف</option><option value="2">2 — دو مورد: درد، قرمزی، تورم</option><option value="3">3 — سه مورد + سفتی</option><option value="4">4 — همه + طناب وریدی</option><option value="5">5 — همه + تب</option></select></div>';
  h += '<div class="wf-field"><label>یافته‌ها</label><textarea id="vs_findings" rows="2"></textarea></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:10px" onclick="NABZ.nurseWS._doSite(\'' + infId + '\')">ثبت</button>';
  _sheet(h, { noClose: false });
}
async function _doSite(infId) {
  const vipScore = parseInt((document.getElementById('vs_vip')||{}).value) || 0;
  const findings = (document.getElementById('vs_findings')||{}).value||'';
  try {
    const r = await _api('/api/nw/infusion/' + infId + '/site', { method:'POST', body: JSON.stringify({ vipScore, findings }) });
    _close();
    NABZ._toast('✅ ثبت شد — ' + (r.action === 'continue' ? 'ادامه' : r.action === 'resite_soon' ? 'نیاز به محل جدید' : '🚨 حذف فوری'));
    _reload();
  } catch(e) { alert('خطا: ' + e.message); }
}
async function _doBag(infId) {
  if (!_confirm('تغییر Bag؟')) return;
  try { await _api('/api/nw/infusion/' + infId + '/bag', { method:'POST', body:'{}' }); NABZ._toast('✅ Bag تغییر کرد'); _reload(); } catch(e) { alert('خطا: ' + e.message); }
}
function _openStop(infId) {
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">⏹ Stop Infusion</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>دلیل</label><textarea id="si_reason" rows="2"></textarea></div>';
  h += '<button class="btn btn-dng btn-block" style="padding:12px;margin-top:10px" onclick="NABZ.nurseWS._doStop(\'' + infId + '\')">Stop</button>';
  _sheet(h, { noClose: false });
}
async function _doStop(infId) {
  const reason = (document.getElementById('si_reason')||{}).value||'';
  if (reason.length < 3) return alert('دلیل الزامی');
  try { await _api('/api/nw/infusion/' + infId + '/stop', { method:'POST', body: JSON.stringify({ reason }) }); _close(); NABZ._toast('⏹ متوقف شد'); _reload(); } catch(e) { alert('خطا: ' + e.message); }
}

// ═══ I/O ═══
function _openIO() {
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">💧 ثبت I/O</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>نوع</label><select id="io_type" onchange="NABZ.nurseWS._ioSubtype(this.value)"><option value="intake">ورودی</option><option value="output">خروجی</option></select></div>';
  h += '<div id="io_subtype_wrap"></div>';
  h += '<div class="wf-field"><label>حجم (ml)</label><input type="number" id="io_vol" style="font-size:22px;text-align:center;font-weight:900;padding:10px"></div>';
  h += '<div class="wf-field"><label>مشخصات</label><input type="text" id="io_char" placeholder="مثلاً: زرد روشن"></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:10px" onclick="NABZ.nurseWS._doIO()">ثبت</button>';
  _sheet(h, { noClose: false });
  setTimeout(() => _ioSubtype('intake'), 50);
}
function _ioSubtype(type) {
  const subs = type === 'intake' ?
    [['oral','خوراکی'],['iv','وریدی'],['ngt','NGT'],['tpn','TPN'],['medication','دارو'],['blood','خون'],['irrigation','شستشو']] :
    [['urine','ادرار'],['stool','مدفوع'],['vomit','استفراغ'],['drain','درناژ'],['wound','زخم'],['blood','خون'],['ng','NG']];
  const w = document.getElementById('io_subtype_wrap');
  if (!w) return;
  let h = '<div class="wf-field"><label>زیرنوع</label><select id="io_sub">';
  subs.forEach(([k, v]) => { h += '<option value="' + k + '">' + v + '</option>'; });
  h += '</select></div>';
  w.innerHTML = h;
}
async function _doIO() {
  const body = {
    patientId: state.pid,
    type: (document.getElementById('io_type')||{}).value,
    subtype: (document.getElementById('io_sub')||{}).value,
    volume: parseFloat((document.getElementById('io_vol')||{}).value),
    characteristics: (document.getElementById('io_char')||{}).value
  };
  if (!body.volume) return alert('حجم الزامی');
  try { await _api('/api/nw/io', { method:'POST', body: JSON.stringify(body) }); _close(); NABZ._toast('✅ ثبت شد'); _reload(); } catch(e) { alert('خطا: ' + e.message); }
}

// ═══ ASSESSMENT ═══
function _openAssess(type) {
  const forms = {
    head_to_toe: { fa:'سر تا پا', fields: ['general','heent','neck','resp','cv','abd','gu','msk','skin','neuro','psych'] },
    focused_resp: { fa:'تنفسی', fields: ['rate','effort','breathSounds','sputum','spo2','o2Delivery'] },
    focused_cv: { fa:'قلبی-عروقی', fields: ['hr','rhythm','heartSounds','peripheralPulses','edema','capillaryRefill'] },
    focused_gi: { fa:'گوارشی', fields: ['abdShape','bowelSounds','tenderness','lastBM','nausea','vomiting'] },
    focused_neuro: { fa:'نورولوژیک', fields: ['loc','gcs','pupils','motor','sensory','speech'] },
    focused_skin: { fa:'پوستی', fields: ['color','integrity','turgor','temp','lesions','wounds'] },
    wound: { fa:'زخم', fields: ['location','stage','length','width','depth','tissueType','exudate','periwound','dressing','nextChangeAt'] },
    iv_site: { fa:'محل ورید', fields: ['location','vipScore','findings'] },
    rass: { fa:'RASS', fields: ['score','description'] },
    cam_icu: { fa:'CAM-ICU', fields: ['acuteOnset','inattention','alteredLoc','disorganized','result'] },
    must: { fa:'MUST', fields: ['bmi','weightLoss','acuteDisease','totalScore','risk'] },
    pain: { fa:'درد', fields: ['scale','value','location','character','aggravating','relief','intervention'] }
  };
  const def = forms[type] || forms.head_to_toe;
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📋 ' + def.fa + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  for (const f of def.fields) {
    if (type === 'rass' && f === 'score') {
      h += '<div class="wf-field"><label>امتیاز</label><select id="as_score" onchange="NABZ.nurseWS._rassDesc(this.value)">';
      for (let s = 4; s >= -5; s--) h += '<option value="' + s + '">' + s + '</option>';
      h += '</select></div>';
    } else if (type === 'rass' && f === 'description') {
      h += '<div class="wf-field"><label>توضیح</label><input type="text" id="as_description" readonly></div>';
    } else if (type === 'cam_icu' && f === 'result') {
      h += '<div class="wf-field"><label>نتیجه</label><select id="as_result"><option value="negative">منفی</option><option value="positive">مثبت</option><option value="unable">غیرقابل ارزیابی</option></select></div>';
    } else if (type === 'cam_icu' && ['acuteOnset','inattention','alteredLoc','disorganized'].includes(f)) {
      h += '<label style="display:flex;align-items:center;gap:6px;padding:6px;background:var(--bg-2);border-radius:5px;margin-bottom:3px;font-size:11px;cursor:pointer"><input type="checkbox" id="as_' + f + '" style="width:16px;height:16px"><span>' + ({acuteOnset:'Acute Onset',inattention:'Inattention',alteredLoc:'Altered LOC',disorganized:'Disorganized thinking'}[f]) + '</span></label>';
    } else if (f === 'vipScore') {
      h += '<div class="wf-field"><label>VIP (0-5)</label><input type="number" id="as_vipScore" min="0" max="5" value="0"></div>';
    } else if (f === 'pain' || f === 'value') {
      h += '<div class="wf-field"><label>' + f + '</label><input type="number" id="as_' + f + '" min="0" max="10"></div>';
    } else {
      h += '<div class="wf-field"><label>' + f + '</label><input type="text" id="as_' + f + '"></div>';
    }
  }
  h += '<div class="wf-field"><label>یادداشت</label><textarea id="as_notes" rows="2"></textarea></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:10px" onclick="NABZ.nurseWS._doAssess(\'' + type + '\')">✅ ثبت</button>';
  _sheet(h, { noClose: false });
  if (type === 'rass') setTimeout(() => _rassDesc(0), 30);
}
function _rassDesc(v) {
  const el = document.getElementById('as_description');
  if (!el) return;
  const d = { '4':'Combativeness', '3':'Very agitated', '2':'Agitated', '1':'Restless', '0':'Alert and calm', '-1':'Drowsy', '-2':'Light sedation', '-3':'Moderate sedation', '-4':'Deep sedation', '-5':'Unarousable' };
  el.value = d[v] || '';
}
async function _doAssess(type) {
  const data = {};
  document.querySelectorAll('[id^="as_"]').forEach(el => {
    const k = el.id.slice(3);
    if (k === 'notes') return;
    if (el.type === 'checkbox') data[k] = el.checked;
    else data[k] = el.value;
  });
  const notes = (document.getElementById('as_notes')||{}).value||'';
  try {
    await _api('/api/nw/assessment/create', { method:'POST', body: JSON.stringify({ patientId: state.pid, type, data, notes }) });
    _close(); NABZ._toast('✅ ثبت شد'); _reload();
  } catch(e) { alert('خطا: ' + e.message); }
}

// ═══ PROCEDURE / DOCS / MISC ═══
function _openNewProcedure() { _close(); if (NABZ.enc && NABZ.enc.newProcedure) NABZ.enc.newProcedure(state.pid); else alert('پنل پروسیجر موجود نیست'); }
function _openRecord() { if (NABZ.showItem) NABZ.showItem('clinical.patients', state.pid); }
function _openDoc(type) { if (NABZ.openDoc) NABZ.openDoc(type, state.pid); }
function _openSBAR() { if (NABZ.enhUI && NABZ.enhUI.openSBAR) NABZ.enhUI.openSBAR(state.pid); }
function _quickVitals() { _close(); if (NABZ.nurseHQ && NABZ.nurseHQ._quickVitals) NABZ.nurseHQ._quickVitals(state.pid); }
function _openNote() {
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📝 یادداشت</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>متن *</label><textarea id="nn_text" rows="4"></textarea></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:10px" onclick="NABZ.nurseWS._doNote()">ثبت</button>';
  _sheet(h, { noClose: false });
}
async function _doNote() {
  const text = (document.getElementById('nn_text')||{}).value||'';
  if (!text.trim()) return alert('متن الزامی');
  try { await _api('/api/nurse/quick/note', { method:'POST', body: JSON.stringify({ patientId: state.pid, text, category: 'observation' }) }); _close(); NABZ._toast('✅ ثبت شد'); _reload(); } catch(e) { alert('خطا: ' + e.message); }
}

// ═══ EXPORT ═══
window.NABZ = window.NABZ || {};
NABZ.nurseWS = {
  open, _setTab, _reload,
  _openOrder, _verifyOrder, _holdOrder, _doHold, _resumeOrder, _discOrder, _doDisc, _modOrder, _doMod,
  _openNewOrder, _doNewOrder,
  _openMarGive, _doMarGive, _openMarPartial, _doMarPartial,
  _openNewInfusion, _doStartInfusion, _openTitrate, _doTitrate, _openSite, _doSite, _doBag, _openStop, _doStop,
  _openIO, _doIO, _ioSubtype,
  _openAssess, _doAssess, _rassDesc,
  _openNewProcedure, _openRecord, _openDoc, _openSBAR,
  _quickVitals, _openNote, _doNote
};
console.log('[nurse-workspace-ui] loaded ✓');
})();
