// ═══════════════════════════════════════════════════════════
//  NABZ — Nursing Station v2 UI
//  Flat functions · action-queue pattern · mobile-first
// ═══════════════════════════════════════════════════════════
(function(){
'use strict';
const state = { tab:'actions', data:null, patient:null };
const cache = {};

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
function _ago(iso) { if (!iso) return '—'; const ms=Date.now()-new Date(iso).getTime(); const m=Math.floor(ms/60000); if(m<1)return 'الان'; if(m<60)return m+'د پیش'; const hr=Math.floor(m/60); if(hr<24)return hr+'س پیش'; return Math.floor(hr/24)+' روز پیش'; }
function _time(iso) { if(!iso) return '—'; try { return new Date(iso).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}); } catch(_){ return '—'; } }
function _levelColor(l) { return l === 'critical' ? 'dng' : l === 'high' ? 'warn' : l === 'medium' ? 'info' : 'ok'; }
function _levelFa(l) { return { critical:'بحرانی', high:'پرخطر', medium:'متوسط', low:'پایدار' }[l] || l; }

async function show(p, d) {
  const m = document.getElementById('content');
  m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
  try {
    if (!d) d = await _api('/api/nursing/hq');
    state.data = d;
    _render();
    _subscribeLive();
  } catch (e) {
    const msg = String(e.message || '');
    if (msg.indexOf('ward_not_configured') >= 0) {
      m.innerHTML = '<div class="card" style="padding:24px;text-align:center"><div style="font-size:40px">🏥</div><div style="font-weight:900;font-size:15px;margin-top:8px">بخش شما تعریف نشده</div><div style="font-size:11.5px;color:var(--fg-2);margin-top:6px">با مدیر سیستم تماس بگیرید</div></div>';
    } else {
      m.innerHTML = '<div class="empty">خطا: ' + _esc(msg) + '</div>';
    }
  }
}

function _render() {
  const d = state.data; if (!d) return;
  const m = document.getElementById('content');
  const st = d.stats; const sh = d.shift;
  const tab = state.tab;
  let h = '';

  // ═══ SHIFT HEADER ═══
  h += '<div style="background:linear-gradient(135deg,rgba(6,182,212,.15),rgba(139,92,246,.08));border-radius:14px;padding:12px;margin-bottom:12px;border:1px solid var(--border)">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
  h += '<div>';
  h += '<div style="font-size:16px;font-weight:900">👩‍⚕️ ' + _esc(d.nurse.name) + '</div>';
  h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + _esc(d.ward.label) + ' · شیفت ' + sh.fa + '</div>';
  h += '</div>';
  h += '<div style="text-align:left">';
  h += '<div style="font-size:22px;font-weight:900;color:var(--primary);line-height:1">' + sh.hoursRemaining + 'h</div>';
  h += '<div style="font-size:9px;color:var(--fg-2)">تا ' + sh.endHour + '</div>';
  h += '</div></div>';
  // Compliance bar
  if (st.marCompliancePct !== null) {
    const c = st.marCompliancePct >= 95 ? 'ok' : st.marCompliancePct >= 80 ? 'warn' : 'dng';
    h += '<div style="margin-top:8px">';
    h += '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--fg-2);margin-bottom:3px"><span>MAR on-time</span><span style="font-weight:900;color:var(--' + c + ')">' + st.marCompliancePct + '%</span></div>';
    h += '<div class="progress" style="height:4px"><div class="progress-fill ' + c + '" style="width:' + st.marCompliancePct + '%"></div></div>';
    h += '</div>';
  }
  h += '</div>';

  // ═══ STATS ═══
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">';
  h += _chip(st.patients, 'بیمار', '', 'NABZ.nurseHQ._setTab(\'patients\')');
  h += _chip(st.tasksCritical, 'بحرانی', st.tasksCritical > 0 ? 'dng' : 'ok', 'NABZ.nurseHQ._setTab(\'actions\')');
  h += _chip(st.tasksHigh, 'پرخطر', st.tasksHigh > 0 ? 'warn' : 'ok', 'NABZ.nurseHQ._setTab(\'actions\')');
  h += _chip(st.incomingHandoffs, 'تحویل', st.incomingHandoffs > 0 ? 'warn' : 'ok', 'NABZ.nurseHQ._setTab(\'handoff\')');
  h += '</div>';

  // ═══ TABS ═══
  const tabs = [
    ['actions','⚡ اقدامات (' + st.tasksTotal + ')'],
    ['patients','👥 بیماران (' + st.patients + ')'],
    ['handoff','📥 دریافتی (' + st.incomingHandoffs + ')']
  ];
  h += '<div class="crisis-tabs" style="margin-bottom:12px">';
  tabs.forEach(([k,l]) => { h += '<button class="crisis-tab' + (tab === k ? ' on' : '') + '" onclick="NABZ.nurseHQ._setTab(\'' + k + '\')">' + l + '</button>'; });
  h += '</div>';

  h += '<div id="hqContent"></div>';

  m.innerHTML = h;
  if (tab === 'actions') _renderActions();
  else if (tab === 'patients') _renderPatients();
  else _renderHandoff();
  NABZ.state.current = 'nursing_station_v2.hub';
}

function _chip(value, label, color, onclick) {
  const cls = color ? ' border-color:var(--' + color + ');' : '';
  const vc = color === 'dng' ? 'color:var(--dng);' : color === 'warn' ? 'color:var(--warn);' : color === 'ok' ? 'color:var(--ok);' : '';
  return '<button onclick="' + onclick + '" style="background:var(--bg-2);' + cls + 'border-radius:10px;padding:8px 4px;text-align:center;font-family:inherit;cursor:pointer;border:1.5px solid var(--border)">' +
    '<div style="font-size:20px;font-weight:900;' + vc + 'line-height:1">' + value + '</div>' +
    '<div style="font-size:9px;color:var(--fg-2);margin-top:2px">' + label + '</div></button>';
}

function _setTab(t) { state.tab = t; _render(); }

// ═══ ACTIONS TAB ═══
function _renderActions() {
  const el = document.getElementById('hqContent'); if (!el) return;
  const actions = (state.data && state.data.actions) || [];
  if (!actions.length) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:40px"><div style="font-size:52px">🎉</div><div style="font-weight:900;font-size:16px;margin-top:8px;color:var(--ok)">صف اقدامات خالی است</div><div style="font-size:11.5px;color:var(--fg-2);margin-top:4px">همه کارهای این شیفت انجام شده</div></div>';
    return;
  }
  // Group by priority
  const groups = { critical: [], high: [], medium: [], low: [] };
  actions.forEach(a => { if (groups[a.priority]) groups[a.priority].push(a); });
  let h = '';
  const ORDER = ['critical','high','medium','low'];
  ORDER.forEach(pri => {
    if (!groups[pri].length) return;
    const cls = _levelColor(pri);
    const label = _levelFa(pri);
    h += '<div style="font-size:11px;font-weight:900;color:var(--' + cls + ');margin:10px 0 6px;padding:4px 10px;background:var(--' + cls + '-soft,var(--bg-3));border-radius:6px">' + label + ' (' + groups[pri].length + ')</div>';
    groups[pri].forEach(a => { h += _actionCard(a); });
  });
  el.innerHTML = h;
}

function _actionCard(a) {
  const cls = _levelColor(a.priority);
  let h = '<div class="card" style="padding:10px;margin-bottom:5px;border-right:3px solid var(--' + cls + ')">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">';
  h += '<div style="flex:1;min-width:0;cursor:pointer" onclick="NABZ.nurseHQ._openPatient(\'' + a.patientId + '\')">';
  h += '<div style="font-size:12.5px;font-weight:900;line-height:1.3">' + _esc(a.title) + '</div>';
  h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">👤 ' + _esc(a.patientName) + ' · تخت ' + _esc(a.bed || '') + '</div>';
  h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">' + _esc(a.subtitle) + '</div>';
  h += '</div>';
  h += '<button class="btn btn-primary btn-sm" style="padding:8px 12px;font-size:11px;font-weight:900;min-width:80px;flex-shrink:0" onclick="event.stopPropagation();NABZ.nurseHQ._runAction(\'' + a.id + '\')">' + _esc(a.actionLabel) + '</button>';
  h += '</div>';
  h += '</div>';
  return h;
}

function _runAction(actionId) {
  const actions = (state.data && state.data.actions) || [];
  const a = actions.find(x => x.id === actionId);
  if (!a) return alert('اقدام یافت نشد');
  if (a.actionModal === 'mar_give') return _openMarGive(a);
  if (a.actionModal === 'vitals') return _openVitals(a);
  if (a.actionModal === 'prn_effectiveness') return _openPrn(a);
  if (a.actionModal === 'lab_ack') return _openLabAck(a);
  if (a.actionModal === 'pain_assess') return _openPain(a);
  if (a.actionModal === 'morse') return _openMorse(a);
  if (a.actionModal === 'restraint_assess') return _openRestraint(a);
  if (a.actionModal === 'sepsis_bundle') return _openSepsis(a);
  if (a.actionModal === 'mar_missed_review') return alert('برای review missed، از پنل MAR استفاده کنید');
  if (a.actionModal === 'consult') return _openConsult(a);
  if (a.actionModal === 'order') return alert('برای مشاهده، بیمار را باز کنید');
  if (a.patientId) _openPatient(a.patientId);
}

// ═══ PATIENTS TAB ═══
function _renderPatients() {
  const el = document.getElementById('hqContent'); if (!el) return;
  const patients = (state.data && state.data.patients) || [];
  if (!patients.length) {
    el.innerHTML = '<div class="empty">بیماری در بخش شما بستری نیست</div>';
    return;
  }
  let h = '';
  patients.forEach(p => { h += _patientCard(p); });
  el.innerHTML = h;
}

function _patientCard(p) {
  const cls = _levelColor(p.priority.level);
  const flags = p.flags.slice(0, 3);
  let h = '<div class="card" style="padding:10px;margin-bottom:6px;border-right:3px solid var(--' + cls + ');cursor:pointer" onclick="NABZ.nurseHQ._openPatient(\'' + p.id + '\')">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
  h += '<div style="flex:1;min-width:0">';
  h += '<div style="font-size:13px;font-weight:900">' + _esc(p.name) + '</div>';
  h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">' + (p.age||'?') + ' سال · تخت ' + _esc(p.bed||'') + '</div>';
  if (p.diagnosis) h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">' + _esc(p.diagnosis.slice(0,60)) + '</div>';
  if (flags.length) {
    h += '<div style="margin-top:4px;display:flex;gap:3px;flex-wrap:wrap">';
    flags.forEach(f => { h += '<span class="pill ' + _levelColor(f.severity) + '" style="font-size:8.5px">' + f.icon + ' ' + _esc(f.text) + '</span>'; });
    h += '</div>';
  }
  h += '</div>';
  h += '<div style="text-align:left;min-width:55px">';
  if (p.vitals) {
    const nCls = p.vitals.news2 >= 7 ? 'dng' : p.vitals.news2 >= 5 ? 'warn' : p.vitals.news2 >= 1 ? 'info' : 'ok';
    h += '<span class="pill ' + nCls + '" style="font-size:10px;font-weight:900">NEWS ' + p.vitals.news2 + '</span>';
    if (p.vitals.trend && p.vitals.trend.dir === 'up') h += '<div style="font-size:9px;color:var(--dng);margin-top:2px;font-weight:900">📈 +' + p.vitals.trend.delta + '</div>';
    else if (p.vitals.trend && p.vitals.trend.dir === 'down') h += '<div style="font-size:9px;color:var(--ok);margin-top:2px">📉 -' + p.vitals.trend.delta + '</div>';
  }
  h += '<div style="font-size:16px;font-weight:900;color:var(--' + cls + ');line-height:1;margin-top:4px">' + p.priority.score + '</div>';
  h += '</div></div>';

  // Quick stats
  const c = p.counts;
  const stats = [];
  if (c.marDue > 0) stats.push('💊 ' + c.marDue);
  if (c.marOverdue > 0) stats.push('⏰ ' + c.marOverdue);
  if (c.labsCritical > 0) stats.push('🧪 ' + c.labsCritical);
  if (c.prnPending > 0) stats.push('📊 ' + c.prnPending);
  if (stats.length) {
    h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">';
    stats.forEach(s => { h += '<span>' + s + '</span>'; });
    h += '</div>';
  }
  h += '</div>';
  return h;
}

// ═══ HANDOFF TAB ═══
function _renderHandoff() {
  const el = document.getElementById('hqContent'); if (!el) return;
  const items = (state.data && state.data.incomingHandoffs) || [];
  if (!items.length) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:30px"><div style="font-size:48px">📭</div><div style="font-weight:900;margin-top:8px">تحویل دریافتی ندارید</div></div>';
    return;
  }
  let h = '<div style="font-size:11px;color:var(--fg-2);margin-bottom:8px">' + items.length + ' تحویل منتظر read-back</div>';
  items.forEach(it => {
    const typeLabel = it.type === 'nursing_report' ? 'پرستاری' : 'پزشکی';
    h += '<div class="card" style="padding:10px;margin-bottom:6px;border-right:3px solid var(--warn);cursor:pointer" onclick="NABZ.nurseHQ._openHandoff(\'' + it.id + '\',\'' + (it.type||'physician') + '\')">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
    h += '<div style="flex:1">';
    h += '<div style="font-size:12.5px;font-weight:900">📥 از ' + _esc(it.from) + '</div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">' + it.patientCount + ' بیمار · ' + typeLabel + ' · ' + _ago(it.sentAt) + '</div>';
    h += '<div style="font-family:monospace;font-size:10px;color:var(--primary);margin-top:2px">🔐 ' + _esc(it.code) + '</div>';
    h += '</div><span class="pill warn" style="font-size:9px">read-back</span>';
    h += '</div></div>';
  });
  el.innerHTML = h;
}

// ═══ PATIENT DETAIL ═══
async function _openPatient(pid) {
  if (NABZ.nurseWS && typeof NABZ.nurseWS.open === 'function') {
    return NABZ.nurseWS.open(pid);
  }
  try {
    NABZ._toast('در حال بارگذاری...');
    const d = await _api('/api/nursing/hq/patient/' + pid);
    state.patient = d;
    _renderPatientSheet(d);
  } catch (e) { alert('خطا: ' + e.message); }
}

function _renderPatientSheet(d) {
  const p = d.patient;
  const s = d.snapshot;
  const cls = _levelColor(s.priority.level);
  let h = '<div class="bs-handle"></div>';

  // Header
  h += '<div style="margin-bottom:8px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
  h += '<div><div style="font-size:17px;font-weight:900">' + _esc(p.name) + '</div>';
  h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + (p.age||'?') + ' سال · ' + (p.sex === 'female'?'زن':'مرد') + ' · ' + _esc(p.ward||'') + ' · تخت ' + _esc(p.bed||'') + '</div>';
  if (p.diagnosis) h += '<div style="font-size:11.5px;font-weight:700;margin-top:3px">' + _esc(p.diagnosis) + '</div>';
  h += '</div>';
  h += '<div style="text-align:left"><div style="font-size:24px;font-weight:900;color:var(--' + cls + ')">' + s.priority.score + '</div><div style="font-size:9px;color:var(--fg-2)">' + _levelFa(s.priority.level) + '</div></div>';
  h += '</div></div>';

  // Safety flags
  if (s.flags.length) {
    h += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">';
    s.flags.forEach(f => { h += '<span class="pill ' + _levelColor(f.severity) + '" style="font-size:10px">' + f.icon + ' ' + _esc(f.text) + '</span>'; });
    h += '</div>';
  }

  // Vitals snapshot
  if (s.vitals) {
    const v = s.vitals;
    h += '<div class="card" style="padding:10px;margin-bottom:10px;background:linear-gradient(135deg,rgba(6,182,212,.06),transparent)">';
    h += '<div style="display:flex;justify-content:space-between;margin-bottom:6px">';
    h += '<div style="font-size:10.5px;font-weight:900;color:var(--primary)">📈 آخرین ویتال</div>';
    h += '<div style="font-size:10px;color:var(--fg-2)">' + (v.ageMin < 60 ? v.ageMin + ' دقیقه پیش' : Math.round(v.ageMin/60) + ' ساعت پیش') + '</div>';
    h += '</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">';
    const vals = [
      ['HR', v.hr, v.hr > 110 || v.hr < 50 ? 'dng' : ''],
      ['BP', (v.bp_sys||'—')+'/'+(v.bp_dia||'—'), v.bp_sys < 90 ? 'dng' : ''],
      ['RR', v.rr, v.rr >= 22 ? 'warn' : ''],
      ['T', v.temp ? v.temp+'°' : '—', v.temp >= 38.3 ? 'warn' : ''],
      ['SpO₂', v.spo2 ? v.spo2+'%' : '—', v.spo2 < 92 ? 'dng' : ''],
      ['NEWS2', v.news2, v.news2 >= 7 ? 'dng' : v.news2 >= 5 ? 'warn' : 'ok']
    ];
    vals.forEach(([l, val, c]) => {
      h += '<div style="text-align:center;padding:6px;background:var(--bg-2);border-radius:6px">';
      h += '<div style="font-size:15px;font-weight:900;color:var(--' + (c || 'fg') + ')">' + _esc(String(val == null ? '—' : val)) + '</div>';
      h += '<div style="font-size:9px;color:var(--fg-2)">' + l + '</div></div>';
    });
    h += '</div>';
    if (v.trend && v.trend.dir !== 'flat') {
      const tc = v.trend.dir === 'up' ? 'dng' : 'ok';
      h += '<div style="margin-top:6px;font-size:10.5px;color:var(--' + tc + ');font-weight:800">' + (v.trend.dir === 'up' ? '📈 NEWS2 صعودی: ' + v.trend.from + ' → ' + v.trend.to : '📉 بهبود: ' + v.trend.from + ' → ' + v.trend.to) + '</div>';
    }
    h += '</div>';
  } else {
    h += '<div class="card" style="padding:10px;margin-bottom:10px;text-align:center;border-color:var(--dng)"><div style="font-size:11.5px;font-weight:900;color:var(--dng)">⚠️ هیچ ویتالی ثبت نشده</div></div>';
  }

  // I/O last 24h
  if (s.io && (s.io.last24h.in > 0 || s.io.last24h.out > 0)) {
    const io = s.io.last24h;
    h += '<div class="card" style="padding:8px;margin-bottom:10px">';
    h += '<div style="font-size:10.5px;font-weight:900;color:var(--primary);margin-bottom:4px">💧 I/O ۲۴ ساعت</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:11px;text-align:center">';
    h += '<div><b>' + io.in + '</b> ml ورودی</div>';
    h += '<div><b>' + io.out + '</b> ml خروجی</div>';
    const nc = io.net < -1000 ? 'dng' : io.net < -500 ? 'warn' : 'ok';
    h += '<div style="color:var(--' + nc + ');font-weight:900">' + (io.net > 0 ? '+' : '') + io.net + ' تعادل</div>';
    h += '</div></div>';
  }

  // Active actions
  if (d.actions && d.actions.length) {
    h += '<div style="font-size:11.5px;font-weight:900;color:var(--dng);margin:10px 0 6px">⚡ ' + d.actions.length + ' اقدام در انتظار</div>';
    d.actions.slice(0, 5).forEach(a => { h += _actionCard(a); });
  }

  // Quick actions
  h += '<div style="font-size:11.5px;font-weight:900;color:var(--primary);margin:12px 0 6px">⚡ اقدام سریع</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:10px">';
  h += _quickBtn('📈','ویتال','NABZ.nurseHQ._quickVitals(\''+p.id+'\')');
  h += _quickBtn('💊','MAR','NABZ.nurseHQ._quickMar(\''+p.id+'\')');
  h += _quickBtn('💧','I/O','NABZ.nurseHQ._quickIO(\''+p.id+'\')');
  h += _quickBtn('📝','یادداشت','NABZ.nurseHQ._quickNote(\''+p.id+'\')');
  h += _quickBtn('🩹','درد','NABZ.nurseHQ._quickPain(\''+p.id+'\')');
  h += _quickBtn('🩺','مشاوره','NABZ.nurseHQ._quickConsult(\''+p.id+'\')');
  h += _quickBtn('📋','NCP','NABZ.nurseHQ._quickNcp(\''+p.id+'\')');
  h += _quickBtn('📄','پرونده','NABZ.nurseHQ._quickRecord(\''+p.id+'\')');
  h += '</div>';

  // Timeline
  if (d.timeline && d.timeline.length) {
    h += '<div style="font-size:11.5px;font-weight:900;color:var(--primary);margin:10px 0 6px">📅 تایم‌لاین</div>';
    h += '<div style="max-height:250px;overflow-y:auto">';
    d.timeline.slice(0, 20).forEach(ev => {
      const evc = ev.severity === 'critical' ? 'dng' : '';
      h += '<div style="display:flex;gap:8px;padding:6px 8px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;border-right:2px solid var(--' + (evc || 'border') + ')">';
      h += '<div style="font-size:14px">' + ev.icon + '</div>';
      h += '<div style="flex:1"><div style="font-size:11px;font-weight:700">' + _esc(ev.title) + '</div><div style="font-size:9.5px;color:var(--fg-2)">' + _ago(ev.at) + '</div></div>';
      h += '</div>';
    });
    h += '</div>';
  }

  h += '<button class="btn btn-block" style="padding:10px;margin-top:14px;margin-bottom:20px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
  _sheet(h, { noClose: false });
}

function _quickBtn(icon, label, fn) {
  return '<button onclick="' + fn + '" style="background:var(--bg-2);border:1.5px solid var(--border);border-radius:8px;padding:8px 4px;text-align:center;font-family:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px">' +
    '<span style="font-size:20px">' + icon + '</span><span style="font-size:9.5px;font-weight:800">' + label + '</span></button>';
}

// ═══ MODALS ═══
function _openMarGive(a) {
  const ad = a.actionData || {};
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">💊 ' + _esc(ad.drugName || '') + ' ' + _esc(ad.dose || '') + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="card" style="margin-bottom:10px;background:linear-gradient(135deg,rgba(6,182,212,.1),rgba(139,92,246,.05))">';
  h += '<div style="font-weight:900;font-size:14px">' + _esc(ad.patientName||'') + '</div>';
  h += '<div style="font-size:11px;color:var(--fg-2)">' + _esc(ad.route||'') + ' · ' + _esc(a.subtitle) + '</div>';
  if (ad.isHighAlert) h += '<div style="margin-top:6px;padding:6px;background:var(--warn-soft);border-radius:6px;font-size:11px;color:var(--warn);font-weight:900">⚠️ HIGH-ALERT — نیاز به شاهد</div>';
  h += '</div>';
  h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin-bottom:6px">✅ ۵ Rights</div>';
  ['patient','drug','dose','route','time'].forEach((r, i) => {
    h += '<label style="display:flex;align-items:center;gap:8px;padding:6px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;font-size:11.5px;cursor:pointer">';
    h += '<input type="checkbox" id="hq_r_' + r + '" checked style="width:18px;height:18px;accent-color:var(--primary)">';
    h += '<span>' + ['بیمار صحیح','داروی صحیح','دوز صحیح','مسیر صحیح','زمان صحیح'][i] + '</span></label>';
  });
  if (ad.minutesLate > 30) {
    h += '<div class="wf-field" style="margin-top:10px"><label style="color:var(--dng);font-weight:900">⏰ دلیل تأخیر *</label><select id="hq_lateReason" style="font-weight:800"><option value="">—</option>';
    const reasons = { patient_npo:'NPO', procedure_pending:'پروسیجر', doctor_hold:'دستور پزشک', pharmacy_delay:'داروخانه', clinical_decision:'تصمیم بالینی', patient_refused:'رد بیمار', patient_off_unit:'بیرون بخش', iv_access_issue:'مشکل IV', equipment_issue:'تجهیزات', medication_unavailable:'دارو نیست', other:'سایر' };
    Object.entries(reasons).forEach(([k,v]) => { h += '<option value="' + k + '">' + v + '</option>'; });
    h += '</select></div>';
  }
  if (ad.isHighAlert) {
    h += '<div class="wf-field" style="margin-top:10px"><label style="color:var(--warn);font-weight:900">👥 شاهد *</label><input type="text" id="hq_witness" placeholder="username شاهد"></div>';
  }
  h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseHQ._submitMar(\'' + ad.marId + '\',' + (ad.isHighAlert?'true':'false') + ',' + (ad.minutesLate>30?'true':'false') + ')">✅ توزیع</button>';
  _sheet(h, { noClose: false });
}

async function _submitMar(marId, needsWitness, isLate) {
  const rights = {}; let ok = true;
  ['patient','drug','dose','route','time'].forEach(r => { const el = document.getElementById('hq_r_'+r); rights[r] = el && el.checked; if (!rights[r]) ok = false; });
  if (!ok) return alert('همه ۵ rights باید تأیید شوند');
  const body = { fiveRights: rights };
  if (isLate) {
    const lr = document.getElementById('hq_lateReason');
    if (!lr || !lr.value) return alert('دلیل تأخیر الزامی');
    body.lateReason = lr.value;
  }
  if (needsWitness) {
    const w = document.getElementById('hq_witness');
    if (!w || !w.value.trim()) return alert('کد شاهد الزامی');
    body.witnessedBy = w.value.trim();
  }
  try {
    await _api('/api/mar/' + marId + '/administer-advanced', { method:'POST', body: JSON.stringify(body) });
    _close();
    NABZ._toast('✅ توزیع شد');
    show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

async function _openVitals(a) {
  const ad = a.actionData || {};
  const pId = ad.patientId;
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">📈 ' + _esc(a.patientName) + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  if (ad.lastVital) {
    const lv = ad.lastVital;
    h += '<div style="font-size:10.5px;color:var(--fg-2);margin-bottom:8px">آخرین: HR ' + (lv.hr||'—') + ' · BP ' + (lv.bp_sys||'—') + '/' + (lv.bp_dia||'—') + ' · SpO₂ ' + (lv.spo2||'—') + '% · NEWS ' + (lv.news2||'—') + '</div>';
  }
  h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">';
  [['HR','hr','bpm'],['SBP','bp_sys','mmHg'],['DBP','bp_dia','mmHg'],['RR','rr','/min'],['Temp','temp','°C'],['SpO₂','spo2','%']].forEach(([l,id,ph]) => {
    h += '<div class="wf-field" style="margin:0"><label style="font-size:10px">' + l + '</label>';
    h += '<input type="number" step="0.1" id="hq_' + id + '" placeholder="' + ph + '" style="width:100%;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:14px;font-weight:900;text-align:center;outline:none" oninput="NABZ.nurseHQ._calcNews()"></div>';
  });
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">';
  h += '<div class="wf-field" style="margin:0"><label style="font-size:10px">GCS</label><input type="number" id="hq_gcs" value="15" min="3" max="15" style="width:100%;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:14px;text-align:center" oninput="NABZ.nurseHQ._calcNews()"></div>';
  h += '<div class="wf-field" style="margin:0"><label style="font-size:10px">Pain (0-10)</label><input type="number" id="hq_pain" value="0" min="0" max="10" style="width:100%;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:14px;text-align:center"></div>';
  h += '</div>';
  h += '<label style="display:flex;gap:8px;align-items:center;padding:8px;background:var(--bg-2);border-radius:6px;margin:10px 0;font-size:11.5px"><input type="checkbox" id="hq_o2" onchange="NABZ.nurseHQ._calcNews()" style="width:18px;height:18px"><span>اکسیژن مکمل</span></label>';
  h += '<div style="text-align:center;padding:8px;background:var(--bg-3);border-radius:8px;margin-bottom:8px"><div style="font-size:28px;font-weight:900;color:var(--fg-2)" id="hq_newsPreview">0</div><div style="font-size:9px;color:var(--fg-2)">NEWS2 پیش‌نمایش</div></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:14px;font-weight:900" onclick="NABZ.nurseHQ._submitVitals(\'' + pId + '\')">✅ ثبت</button>';
  _sheet(h, { noClose: false });
  setTimeout(() => { if (ad.lastVital) { /* prefill patient-aware defaults */ } _calcNews(); }, 50);
}

function _calcNews() {
  let n = 0;
  const g = id => { const el = document.getElementById('hq_' + id); return el && el.value !== '' ? parseFloat(el.value) : null; };
  const rr = g('rr'); if (rr != null && !isNaN(rr)) n += rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3;
  const spo2 = g('spo2'); if (spo2 != null && !isNaN(spo2)) n += spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0;
  const o2 = document.getElementById('hq_o2'); if (o2 && o2.checked) n += 2;
  const sbp = g('bp_sys'); if (sbp != null && !isNaN(sbp) && sbp > 0) n += sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3;
  const hr = g('hr'); if (hr != null && !isNaN(hr) && hr > 0) n += hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3;
  const gcs = g('gcs'); if (gcs != null && !isNaN(gcs) && gcs < 15) n += 3;
  const temp = g('temp'); if (temp != null && !isNaN(temp) && temp > 0) n += temp <= 35 ? 3 : temp <= 36 ? 1 : temp <= 38 ? 0 : temp <= 39 ? 1 : 2;
  const el = document.getElementById('hq_newsPreview');
  if (el) { el.textContent = n; el.style.color = n >= 7 ? 'var(--dng)' : n >= 5 ? 'var(--warn)' : n >= 1 ? 'var(--info)' : 'var(--ok)'; }
}

async function _submitVitals(pId) {
  const g = id => { const el = document.getElementById('hq_' + id); return el && el.value !== '' ? parseFloat(el.value) : null; };
  const body = { patientId: pId, hr: g('hr'), bp_sys: g('bp_sys'), bp_dia: g('bp_dia'), rr: g('rr'), temp: g('temp'), spo2: g('spo2'), gcs: g('gcs'), pain: g('pain'), onOxygen: (document.getElementById('hq_o2')||{}).checked };
  try {
    const r = await _api('/api/nurse/quick/vitals', { method:'POST', body: JSON.stringify(body) });
    _close();
    NABZ._toast('✅ ثبت شد — NEWS2 ' + r.news2 + (r.alert ? ' ⚠️' : ''));
    show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

function _openPrn(a) {
  const ad = a.actionData || {};
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">📊 اثربخشی ' + _esc(ad.drugName) + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>مقیاس</label><select id="hq_prnScale"><option value="pain">درد</option><option value="nausea">تهوع</option><option value="anxiety">اضطراب</option><option value="dyspnea">تنگی نفس</option></select></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
  h += '<div class="wf-field"><label>قبل</label><input type="number" id="hq_prnBefore" min="0" max="10" value="8" style="font-size:22px;text-align:center;font-weight:900;padding:10px"></div>';
  h += '<div class="wf-field"><label>بعد</label><input type="number" id="hq_prnAfter" min="0" max="10" style="font-size:22px;text-align:center;font-weight:900;padding:10px"></div>';
  h += '</div>';
  h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseHQ._submitPrn(\'' + ad.marId + '\')">✅ ثبت</button>';
  _sheet(h, { noClose: false });
}

async function _submitPrn(marId) {
  const body = { scale: document.getElementById('hq_prnScale').value, before: parseFloat(document.getElementById('hq_prnBefore').value), after: parseFloat(document.getElementById('hq_prnAfter').value) };
  if (isNaN(body.before) || isNaN(body.after)) return alert('قبل و بعد الزامی');
  try {
    await _api('/api/mar/' + marId + '/prn-effectiveness', { method:'POST', body: JSON.stringify(body) });
    _close(); NABZ._toast('✅ ثبت شد'); show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

function _openLabAck(a) {
  const ad = a.actionData || {};
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">🧪 Read-back — ' + _esc(ad.panel) + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="card" style="margin-bottom:10px;background:var(--dng-soft);border-color:var(--dng)">';
  h += '<div style="font-weight:900;font-size:13px;color:var(--dng)">⚠️ مقدار بحرانی</div>';
  ad.flags.forEach(f => { h += '<div style="font-size:12px;color:var(--dng);font-weight:900;margin-top:4px">' + _esc(f.test) + ' = ' + f.value + ' (' + f.type + ')</div>'; });
  h += '</div>';
  h += '<div class="hint info" style="margin-bottom:10px">JCI IPSG.2 — متن read-back الزامی</div>';
  h += '<div class="wf-field"><label>متن read-back (حداقل ۱۰ کاراکتر) *</label><textarea id="hq_rb" rows="3" placeholder="مثلاً: K=6.8 بیمار X را دریافت کردم و به پزشک اطلاع دادم"></textarea></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseHQ._submitLabAck(\'' + ad.labId + '\')">✅ تأیید</button>';
  _sheet(h, { noClose: false });
}

async function _submitLabAck(labId) {
  const rb = (document.getElementById('hq_rb')||{}).value||'';
  if (rb.trim().length < 10) return alert('حداقل ۱۰ کاراکتر');
  try {
    await _api('/api/para/labs/' + labId + '/acknowledge', { method:'POST', body: JSON.stringify({ readBack: rb }) });
    _close(); NABZ._toast('✅ تأیید شد'); show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

function _openPain(a) {
  const pid = a.actionData.patientId;
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">🩹 ارزیابی درد</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>شدت درد (۰-۱۰)</label><input type="number" id="hq_painVal" min="0" max="10" value="0" style="font-size:28px;text-align:center;font-weight:900;padding:12px"></div>';
  h += '<div class="wf-field"><label>یادداشت</label><textarea id="hq_painNote" rows="2"></textarea></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseHQ._submitPain(\'' + pid + '\')">✅ ثبت</button>';
  _sheet(h, { noClose: false });
}

async function _submitPain(pid) {
  const pain = parseInt(document.getElementById('hq_painVal').value) || 0;
  const note = document.getElementById('hq_painNote').value;
  try {
    await _api('/api/nurse/quick/note', { method:'POST', body: JSON.stringify({ patientId: pid, text: 'Pain assessment: ' + pain + '/10' + (note ? ' — ' + note : ''), category: 'observation' }) });
    _close(); NABZ._toast('✅ ثبت شد'); show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

async function _openMorse(a) {
  try {
    NABZ._toast('در حال محاسبه...');
    const r = await _api('/api/safety/morse/auto-calc/' + a.actionData.patientId, { method:'GET' });
    const cls = r.level === 'high' ? 'dng' : r.level === 'moderate' ? 'warn' : 'ok';
    let h = '<div class="bs-handle"></div>';
    h += '<div class="bs-hd"><div class="bs-title">🚶 Morse Fall — نتیجه</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div class="card" style="text-align:center;border-color:var(--' + cls + ')">';
    h += '<div style="font-size:48px;font-weight:900;color:var(--' + cls + ')">' + r.score + '</div>';
    h += '<div style="font-size:11px;color:var(--fg-2)">' + (r.level === 'high' ? 'خطر بالا' : r.level === 'moderate' ? 'خطر متوسط' : 'خطر پایین') + '</div>';
    h += '</div>';
    if (r.items && r.items.length) {
      h += '<div class="card" style="margin-top:8px"><div style="font-size:11px;font-weight:900;margin-bottom:4px">عوامل</div>';
      r.items.forEach(it => { h += '<div style="font-size:11px;padding:2px 0">• ' + _esc(it) + '</div>'; });
      h += '</div>';
    }
    if (r.recommendation) h += '<div class="hint warn" style="margin-top:8px">' + _esc(r.recommendation) + '</div>';
    h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:12px" onclick="this.closest(\'.bs-backdrop\').remove();NABZ.nurseHQ.show(null,null)">✅ ثبت شد</button>';
    _sheet(h, { noClose: false });
  } catch (e) { alert('خطا: ' + e.message); }
}

function _openRestraint(a) {
  _close();
  alert('ارزیابی محدودیت — از پنل "محدودیت" استفاده کنید');
  NABZ.show('restraint.dashboard');
}

function _openSepsis(a) {
  NABZ._toast('باز کردن پنل سپسیس...');
  NABZ.show('safety.sepsis');
}

function _openConsult(a) {
  _close();
  NABZ.show('workflow.consult');
}

// ═══ QUICK ACTIONS (from patient sheet) ═══
async function _quickVitals(pid) {
  _close();
  const action = { id:'v_'+pid, patientId:pid, patientName:'', actionModal:'vitals', actionData:{ patientId:pid, lastVital: state.patient && state.patient.vitals && state.patient.vitals.last } };
  _openVitals(action);
}

function _quickMar(pid) {
  _close();
  NABZ.show('clinical.mar');
}

function _quickIO(pid) {
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">💧 I/O</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>نوع</label><select id="hq_ioType"><option value="intake">ورودی</option><option value="output">خروجی</option></select></div>';
  h += '<div class="wf-field"><label>زیرنوع</label><select id="hq_ioSub"><option value="oral">خوراکی</option><option value="iv">وریدی</option><option value="urine">ادرار</option><option value="drain">درناژ</option><option value="vomit">استفراغ</option><option value="stool">مدفوع</option><option value="other">سایر</option></select></div>';
  h += '<div class="wf-field"><label>حجم (ml)</label><input type="number" id="hq_ioVol" style="font-size:22px;text-align:center;font-weight:900;padding:10px"></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseHQ._submitIO(\'' + pid + '\')">✅ ثبت</button>';
  _sheet(h, { noClose: false });
}

async function _submitIO(pid) {
  const body = { patientId: pid, type: document.getElementById('hq_ioType').value, subtype: document.getElementById('hq_ioSub').value, volume: parseFloat(document.getElementById('hq_ioVol').value) };
  if (!body.volume) return alert('حجم الزامی');
  try {
    await _api('/api/nurse/quick/io', { method:'POST', body: JSON.stringify(body) });
    _close(); NABZ._toast('✅ ثبت شد'); show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

function _quickNote(pid) {
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">📝 یادداشت</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>متن *</label><textarea id="hq_noteText" rows="4"></textarea></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseHQ._submitNote(\'' + pid + '\')">✅ ثبت</button>';
  _sheet(h, { noClose: false });
}

async function _submitNote(pid) {
  const text = (document.getElementById('hq_noteText')||{}).value||'';
  if (!text.trim()) return alert('متن الزامی');
  try {
    await _api('/api/nurse/quick/note', { method:'POST', body: JSON.stringify({ patientId: pid, text, category: 'observation' }) });
    _close(); NABZ._toast('✅ ثبت شد'); show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

function _quickPain(pid) { _close(); _openPain({ actionData: { patientId: pid } }); }

function _quickConsult(pid) { _close(); NABZ.wf && NABZ.wf.consultRequest ? NABZ.wf.consultRequest(pid) : NABZ.show('workflow.consult'); }

function _quickNcp(pid) { _close(); NABZ.ncpUI && NABZ.ncpUI.showForPatient ? NABZ.ncpUI.showForPatient(pid) : NABZ.show('nursing_care_plan.plans'); }

function _quickRecord(pid) { _close(); if (NABZ.showItem) NABZ.showItem('clinical.patients', pid); }

// ═══ HANDOFF RECEIVE ═══
async function _openHandoff(id, type) {
  if (type === 'physician') {
    // delegate to handoff_ai
    if (NABZ.handoffAI && NABZ.handoffAI._viewRecord) {
      _close();
      return NABZ.handoffAI._viewRecord(id);
    }
  }
  if (type === 'nursing_report') {
    if (NABZ.nhbUI && NABZ.nhbUI.readback) {
      _close();
      return NABZ.nhbUI.readback(id);
    }
  }
  alert('این نوع تحویل هنوز قابل دریافت نیست');
}

// ═══ LIVE ═══
let _liveSub = false;
function _subscribeLive() {
  if (_liveSub) return;
  if (!window.Live || typeof Live.on !== 'function') return;
  ['vitals.recorded','kardex.mar.given','kardex.mar.missed','nursing.note.recorded','kardex.io.recorded','lab.critical','sepsis.suspected','handoff_ai.sent','handoff_ai.received','patients.created','patients.discharged'].forEach(e => {
    Live.on(e, () => { if (NABZ.state.current === 'nursing_station_v2.hub' && !document.querySelector('.bs-backdrop')) show(null, null); });
  });
  _liveSub = true;
}

// ═══ REGISTER + showHome wrap ═══
window.NABZ = window.NABZ || {};
NABZ.nurseHQ = { show, _setTab, _openPatient, _runAction, _openMarGive, _submitMar, _openVitals, _submitVitals, _openPrn, _submitPrn, _openLabAck, _submitLabAck, _openPain, _submitPain, _openMorse, _openRestraint, _openSepsis, _openConsult, _quickVitals, _quickMar, _quickIO, _quickNote, _quickPain, _quickConsult, _quickNcp, _quickRecord, _submitIO, _submitNote, _calcNews, _openHandoff };

// Redirect nurse home to this panel (registered after role-dashboards-ui)
setTimeout(function() {
  var orig = NABZ.showHome;
  if (orig && !orig._nursehqWrapped) {
    NABZ.showHome = async function() {
      var user = NABZ.state.user;
      if (user && ['nurse','nurse_aide','assistant_nurse'].indexOf(user.role) >= 0) {
        return NABZ.show('nursing_station_v2.hub');
      }
      return orig.call(NABZ);
    };
    NABZ.showHome._nursehqWrapped = true;
    console.log('[nurse-hq] showHome wrapped for nurse roles');
  }
}, 300);

let tries = 0;
(function tryReg() {
  if (window.NABZ && typeof NABZ.registerKind === 'function') {
    NABZ.registerKind('nursing_station_v2', function(p, d) { return show(p, d); });
    console.log('[nurse-hq-ui] loaded ✓');
    return;
  }
  if (++tries > 60) return console.warn('[nurse-hq-ui] timeout');
  setTimeout(tryReg, 100);
})();
})();
