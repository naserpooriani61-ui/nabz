// ═══════════════════════════════════════════════════════════
//  NABZ — Alerts Hub UI (S6)
//  Flat functions — no object literal wrapping
// ═══════════════════════════════════════════════════════════
(function(){
'use strict';
const state = { filter: { severity: '', category: '', onlyUnacked: false }, data: null, tab: 'active' };
const cache = {};

function _api(p, o) { return NABZ._api(p, o); }
function _esc(s) { return NABZ._esc(s); }
function _close() { document.querySelectorAll('.bs-backdrop').forEach(el => el.remove()); }
function _sheet(html) {
  const s = document.createElement('div'); s.className = 'bs-backdrop';
  s.onclick = e => { if (e.target === s) s.remove(); };
  const c = document.createElement('div'); c.className = 'bs-sheet';
  c.style.maxHeight = '96vh'; c.innerHTML = html;
  s.appendChild(c); document.body.appendChild(s);
  requestAnimationFrame(() => s.classList.add('show'));
  return { sheet: s, content: c };
}
function _time(iso) { if (!iso) return '—'; try { return new Date(iso).toLocaleString('fa-IR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); } catch (_) { return '—'; } }
function _ago(iso) { if (!iso) return '—'; const ms = Date.now() - new Date(iso).getTime(); const m = Math.floor(ms/60000); if (m < 1) return 'الان'; if (m < 60) return m + 'د'; const hr = Math.floor(m/60); if (hr < 24) return hr + 'س'; return Math.floor(hr/24) + ' روز'; }

const SEV_FA = { critical:'بحرانی', high:'مهم', medium:'متوسط', low:'پایین' };
const SEV_CLS = { critical:'dng', high:'warn', medium:'info', low:'' };
const CAT_FA = { medication:'دارویی', clinical:'بالینی', vitals:'ویتال', paraclinical:'پاراکلینیک', safety:'ایمنی', nursing:'پرستاری', other:'سایر' };
const CAT_ICON = { medication:'💊', clinical:'🩺', vitals:'📈', paraclinical:'🧪', safety:'⚠️', nursing:'📋', other:'●' };

async function show(p, d) {
  const m = document.getElementById('content');
  m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
  try {
    const q = [];
    if (state.filter.severity) q.push('severity=' + encodeURIComponent(state.filter.severity));
    if (state.filter.category) q.push('category=' + encodeURIComponent(state.filter.category));
    if (state.filter.onlyUnacked) q.push('onlyUnacked=1');
    const url = '/api/alerts/hub' + (q.length ? '?' + q.join('&') : '');
    const data = await _api(url);
    state.data = data;
    _render(p);
    _subscribeLive();
  } catch (e) {
    m.innerHTML = '<div class="empty">خطا: ' + _esc(e.message) + '</div>';
  }
}

function _render(p) {
  const m = document.getElementById('content');
  const d = state.data || { items: [], total: 0, bySeverity: {}, byCategory: {}, unackedCritical: 0, unackedHigh: 0 };
  let h = '<div class="sec-hd"><span>🔔 مرکز هشدارها</span><span class="rd-mini">' + d.total + ' هشدار</span></div>';

  if (d.unackedCritical > 0) {
    h += '<div style="background:var(--dng-soft);border:2px solid var(--dng);border-radius:12px;padding:12px;margin-bottom:12px;animation:pulse-critical 2s infinite">';
    h += '<div style="font-size:14px;font-weight:900;color:var(--dng)">🚨 ' + d.unackedCritical + ' هشدار بحرانی بدون تأیید</div>';
    if (d.unackedHigh > 0) h += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:2px">+ ' + d.unackedHigh + ' مهم</div>';
    h += '</div>';
  }

  h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">';
  h += '<div class="rd-stat dng"><div class="v">' + (d.bySeverity.critical || 0) + '</div><div class="l">بحرانی</div></div>';
  h += '<div class="rd-stat warn"><div class="v">' + (d.bySeverity.high || 0) + '</div><div class="l">مهم</div></div>';
  h += '<div class="rd-stat info"><div class="v">' + (d.bySeverity.medium || 0) + '</div><div class="l">متوسط</div></div>';
  h += '<div class="rd-stat"><div class="v">' + d.total + '</div><div class="l">کل</div></div>';
  h += '</div>';

  h += '<div class="crisis-tabs" style="margin-bottom:12px;flex-wrap:wrap">';
  [['active','🔔 فعال'],['history','📚 تاریخچه'],['muteds','🔇 Muteها']].forEach(([k,l]) => {
    h += '<button class="crisis-tab' + (state.tab === k ? ' on' : '') + '" onclick="NABZ.alertsHub.setTab(\'' + k + '\')">' + l + '</button>';
  });
  h += '</div>';

  if (state.tab === 'active') {
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">';
    h += '<select onchange="NABZ.alertsHub._filter(\'severity\',this.value)" style="padding:6px 10px;background:var(--bg-2);border:1px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:11px;font-family:inherit">';
    h += '<option value="">همه شدت‌ها</option>';
    ['critical','high','medium','low'].forEach(s => { h += '<option value="' + s + '"' + (state.filter.severity === s ? ' selected' : '') + '>' + SEV_FA[s] + '</option>'; });
    h += '</select>';
    h += '<select onchange="NABZ.alertsHub._filter(\'category\',this.value)" style="padding:6px 10px;background:var(--bg-2);border:1px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:11px;font-family:inherit">';
    h += '<option value="">همه دسته‌ها</option>';
    Object.entries(CAT_FA).forEach(([k, v]) => { h += '<option value="' + k + '"' + (state.filter.category === k ? ' selected' : '') + '>' + CAT_ICON[k] + ' ' + v + '</option>'; });
    h += '</select>';
    h += '<label style="display:flex;gap:6px;align-items:center;padding:6px 10px;background:var(--bg-2);border:1px solid var(--border-2);border-radius:6px;font-size:11px;cursor:pointer">';
    h += '<input type="checkbox" ' + (state.filter.onlyUnacked ? 'checked' : '') + ' onchange="NABZ.alertsHub._filter(\'onlyUnacked\',this.checked)" style="width:14px;height:14px">';
    h += '<span>فقط بی‌تأیید</span></label>';
    h += '</div>';

    h += '<div id="alertsList"></div>';
  } else {
    h += '<div id="alertsList" style="text-align:center;padding:20px"><span class="spinner"></span></div>';
  }
  m.innerHTML = h;
  if (state.tab === 'active') _renderList();
  else if (state.tab === 'history') _loadHistory();
  else if (state.tab === 'muteds') _loadMuteds();
  NABZ.state.current = p ? p.id : 'alerts_hub.hub';
}

function setTab(t) { state.tab = t; _render(null); }
function _filter(k, v) { state.filter[k] = v; show(null, null); }

function _renderList() {
  const el = document.getElementById('alertsList');
  if (!el) return;
  const items = (state.data && state.data.items) || [];
  if (!items.length) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">✅</div><div style="font-weight:900;margin-top:8px">هیچ هشداری نیست</div></div>';
    return;
  }
  // Group by patient
  const byPatient = {};
  for (const a of items) {
    if (!byPatient[a.patientId]) byPatient[a.patientId] = { patientName: a.patientName, ward: a.ward, bed: a.bed, items: [] };
    byPatient[a.patientId].items.push(a);
  }
  let h = '';
  Object.entries(byPatient).forEach(([pid, g]) => {
    const hasCritical = g.items.some(a => a.severity === 'critical' && !a.acknowledged);
    const cls = hasCritical ? 'dng' : g.items.some(a => a.severity === 'high') ? 'warn' : 'info';
    h += '<div class="card" style="margin-bottom:6px;border-right:3px solid var(--' + cls + ')">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:6px;cursor:pointer" onclick="NABZ.roundsV2.openSoap(\'' + pid + '\')">';
    h += '<div><div style="font-size:13px;font-weight:900">' + _esc(g.patientName || '') + '</div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2)">' + _esc(g.ward || '') + ' · تخت ' + _esc(g.bed || '') + ' · ' + g.items.length + ' هشدار</div></div>';
    h += '<button class="btn btn-sm" style="padding:4px 8px;font-size:10px" onclick="event.stopPropagation();NABZ.alertsHub._muteDialog(\'' + pid + '\',\'' + _esc(g.patientName || '') + '\')">🔇</button>';
    h += '</div>';
    g.items.forEach(a => {
      const sevCls = SEV_CLS[a.severity] || 'info';
      const acked = a.acknowledged;
      h += '<div style="padding:6px 8px;margin-bottom:3px;background:' + (acked ? 'var(--bg-3)' : 'var(--bg-2)') + ';border-radius:6px;opacity:' + (acked ? '0.6' : '1') + ';font-size:11.5px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
      h += '<div style="flex:1;min-width:0">';
      h += '<div style="font-weight:800">' + (a.icon || '●') + ' ' + _esc(a.title) + '</div>';
      if (a.detail) h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">' + _esc(a.detail) + '</div>';
      h += '<div style="font-size:9.5px;color:var(--fg-3);margin-top:1px">' + _esc(a.sourceLabel) + ' · ' + _ago(a.at) + (acked ? ' · ✅ ' + _esc(a.acknowledgedBy || '') : '') + '</div>';
      h += '</div>';
      h += '<div style="display:flex;flex-direction:column;gap:3px;min-width:40px">';
      h += '<span class="pill ' + sevCls + '" style="font-size:8.5px">' + SEV_FA[a.severity] + '</span>';
      if (!acked) {
        h += '<button class="btn btn-sm" style="padding:3px 6px;font-size:9.5px;background:var(--ok-soft);color:var(--ok);border-color:var(--ok)" onclick="event.stopPropagation();NABZ.alertsHub._ackDialog(\'' + a.alertId + '\',' + (a.severity === 'critical' ? 'true' : 'false') + ',\'' + _esc(a.patientId || '') + '\',\'' + _esc(a.patientName || '') + '\')">✓</button>';
        h += '<button class="btn btn-sm" style="padding:3px 6px;font-size:9.5px;color:var(--fg-3)" onclick="event.stopPropagation();NABZ.alertsHub._dismissDialog(\'' + a.alertId + '\')">✕</button>';
      }
      h += '</div></div></div>';
    });
    h += '</div>';
  });
  el.innerHTML = h;
}

function _ackDialog(alertId, isCritical, patientId, patientName) {
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">✅ تأیید دریافت هشدار</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div style="font-size:11.5px;color:var(--fg-2);margin-bottom:8px">' + _esc(alertId) + '</div>';
  if (isCritical) {
    h += '<div class="hint danger" style="margin-bottom:10px">⚠️ JCI IPSG.2 — برای هشدار بحرانی، متن read-back الزامی است</div>';
    h += '<div class="wf-field"><label>متن read-back *</label><textarea id="ah_readBack" rows="3" placeholder="مثلاً: K=6.8 بیمار رضایی را دریافت کردم و به پزشک اطلاع دادم"></textarea></div>';
  }
  h += '<div class="wf-field"><label>یادداشت (اختیاری)</label><textarea id="ah_note" rows="2" placeholder="اقدام انجام‌شده..."></textarea></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.alertsHub._submitAck(\'' + alertId + '\',' + (isCritical ? 'true' : 'false') + ',\'' + _esc(patientId || '') + '\',\'' + _esc(patientName || '') + '\')">✅ تأیید</button>';
  _sheet(h);
}

async function _submitAck(alertId, isCritical, patientId, patientName) {
  const body = { patientId, patientName };
  const rb = document.getElementById('ah_readBack');
  if (isCritical) {
    if (!rb || rb.value.trim().length < 10) return alert('متن read-back الزامی (حداقل ۱۰ کاراکتر)');
    body.readBack = rb.value.trim();
  }
  const nt = document.getElementById('ah_note');
  if (nt && nt.value.trim()) body.note = nt.value.trim();
  try {
    await _api('/api/alerts/' + encodeURIComponent(alertId) + '/ack', { method:'POST', body: JSON.stringify(body) });
    _close(); NABZ._toast('✅ تأیید شد');
    show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

function _dismissDialog(alertId) {
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">✕ نادیده گرفتن</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="hint info" style="margin-bottom:10px">این هشدار فقط برای شما نادیده گرفته می‌شود — سایر کاربران همچنان می‌بینند</div>';
  h += '<div class="wf-field"><label>دلیل *</label><textarea id="ah_dismissReason" rows="3" placeholder="چرا این هشدار را نادیده می‌گیرید؟"></textarea></div>';
  h += '<button class="btn btn-dng btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.alertsHub._submitDismiss(\'' + alertId + '\')">✕ نادیده بگیر</button>';
  _sheet(h);
}

async function _submitDismiss(alertId) {
  const reason = document.getElementById('ah_dismissReason').value.trim();
  if (reason.length < 5) return alert('دلیل حداقل ۵ کاراکتر');
  try {
    await _api('/api/alerts/' + encodeURIComponent(alertId) + '/dismiss', { method:'POST', body: JSON.stringify({ reason }) });
    _close(); NABZ._toast('✅ نادیده گرفته شد');
    show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

function _muteDialog(patientId, patientName) {
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🔇 Mute — ' + _esc(patientName) + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="hint warn" style="margin-bottom:10px">⚠️ Mute برای همه کاربران اعمال می‌شود — با احتیاط استفاده کنید</div>';
  h += '<div class="wf-field"><label>دسته *</label><select id="ah_muteCat">';
  Object.entries(CAT_FA).forEach(([k, v]) => { h += '<option value="' + k + '">' + CAT_ICON[k] + ' ' + v + '</option>'; });
  h += '</select></div>';
  h += '<div class="wf-field"><label>مدت (ساعت)</label><select id="ah_muteHours"><option value="1">۱ ساعت</option><option value="4" selected>۴ ساعت</option><option value="8">۸ ساعت</option><option value="24">۲۴ ساعت</option></select></div>';
  h += '<div class="wf-field"><label>دلیل *</label><textarea id="ah_muteReason" rows="2"></textarea></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.alertsHub._submitMute(\'' + patientId + '\',\'' + _esc(patientName) + '\')">🔇 Mute</button>';
  _sheet(h);
}

async function _submitMute(patientId, patientName) {
  const category = document.getElementById('ah_muteCat').value;
  const hours = parseInt(document.getElementById('ah_muteHours').value) || 4;
  const reason = document.getElementById('ah_muteReason').value.trim();
  if (reason.length < 5) return alert('دلیل حداقل ۵ کاراکتر');
  try {
    await _api('/api/alerts/mute', { method:'POST', body: JSON.stringify({ patientId, patientName, category, hours, reason }) });
    _close(); NABZ._toast('🔇 Mute شد');
    show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

async function _loadHistory() {
  const el = document.getElementById('alertsList');
  if (!el) return;
  try {
    const d = await _api('/api/alerts/history?days=7');
    let h = '<div class="rd-stats" style="grid-template-columns:1fr 1fr;margin-bottom:12px">';
    h += '<div class="rd-stat ok"><div class="v">' + d.total.acks + '</div><div class="l">تأیید</div></div>';
    h += '<div class="rd-stat warn"><div class="v">' + d.total.dismissals + '</div><div class="l">نادیده</div></div>';
    h += '</div>';
    if (d.acks.length) {
      h += '<div style="font-size:12px;font-weight:900;color:var(--ok);margin:12px 0 6px">✅ تأییدها</div>';
      d.acks.slice(0, 30).forEach(a => {
        h += '<div style="padding:6px 8px;background:var(--bg-2);border-radius:4px;margin-bottom:2px;font-size:11px">';
        h += '<b>' + _esc(a.by) + '</b> · ' + _ago(a.at) + '<div style="font-size:10px;color:var(--fg-2);font-family:monospace">' + _esc(a.alertId) + '</div>';
        if (a.readBack) h += '<div style="font-size:10px;color:var(--ok);margin-top:2px">📖 ' + _esc(a.readBack).slice(0, 80) + '</div>';
        h += '</div>';
      });
    }
    if (d.dismissals.length) {
      h += '<div style="font-size:12px;font-weight:900;color:var(--warn);margin:12px 0 6px">✕ نادیده گرفته‌ها</div>';
      d.dismissals.slice(0, 30).forEach(x => {
        h += '<div style="padding:6px 8px;background:var(--bg-2);border-radius:4px;margin-bottom:2px;font-size:11px">';
        h += '<b>' + _esc(x.by) + '</b> · ' + _ago(x.at);
        if (x.reason) h += '<div style="font-size:10px;color:var(--fg-2)">' + _esc(x.reason) + '</div>';
        h += '</div>';
      });
    }
    el.innerHTML = h;
  } catch (e) { el.innerHTML = '<div class="empty">خطا: ' + _esc(e.message) + '</div>'; }
}

async function _loadMuteds() {
  const el = document.getElementById('alertsList');
  if (!el) return;
  try {
    const d = await _api('/api/alerts/muteds');
    if (!d.items.length) { el.innerHTML = '<div class="empty">هیچ mute فعالی نیست</div>'; return; }
    let h = '';
    d.items.forEach(m => {
      h += '<div style="padding:8px 10px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;font-size:11.5px">';
      h += '<div style="display:flex;justify-content:space-between"><b>' + _esc(m.patientName || m.patientId) + '</b><span class="pill warn">' + _esc(m.category) + '</span></div>';
      h += '<div style="font-size:10.5px;color:var(--fg-2)">از ' + _esc(m.mutedByName) + ' · تا ' + _time(m.mutedUntil) + '</div>';
      if (m.reason) h += '<div style="font-size:10px;color:var(--fg-3)">' + _esc(m.reason) + '</div>';
      h += '</div>';
    });
    el.innerHTML = h;
  } catch (e) { el.innerHTML = '<div class="empty">خطا: ' + _esc(e.message) + '</div>'; }
}

let _liveSubscribed = false;
function _subscribeLive() {
  if (_liveSubscribed) return;
  if (!window.Live || typeof Live.on !== 'function') return;
  ['alert.acknowledged','vitals.critical','vitals.recorded','lab.critical','radiology.critical','sepsis.suspected','cdss.alert','kardex.mar.missed','kardex.mar.given','restraint.overdue','restraint.critical_overdue','alerts_hub.source_changed'].forEach(evt => {
    Live.on(evt, () => {
      if (NABZ.state.current === 'alerts_hub.hub' && !document.querySelector('.bs-backdrop')) show(null, null);
    });
  });
  _liveSubscribed = true;
}

// ═══ Register ═══
window.NABZ = window.NABZ || {};
NABZ.alertsHub = { show, setTab, _filter, _ackDialog, _submitAck, _dismissDialog, _submitDismiss, _muteDialog, _submitMute };
let tries = 0;
(function tryReg(){
  if (window.NABZ && typeof NABZ.registerKind === 'function') {
    NABZ.registerKind('alerts_hub', function(p, d){ return show(p, d); });
    console.log('[alerts-hub-ui] loaded ✓');
    return;
  }
  if (++tries > 60) return console.warn('[alerts-hub-ui] timeout');
  setTimeout(tryReg, 100);
})();
})();
