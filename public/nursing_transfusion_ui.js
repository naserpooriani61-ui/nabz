// ═══════════════════════════════════════════════════════════
//  NABZ — Transfusion UI (flat functions)
// ═══════════════════════════════════════════════════════════
(function(){
'use strict';
function _api(p, o) { return NABZ._api(p, o); }
function _esc(s) { return NABZ._esc(s); }
function _close() { document.querySelectorAll('.bs-backdrop').forEach(el => el.remove()); }
function _sheet(html) {
  const s = document.createElement('div'); s.className = 'bs-backdrop';
  s.onclick = e => { if (e.target === s) s.remove(); };
  const c = document.createElement('div'); c.className = 'bs-sheet';
  c.style.maxHeight='97vh'; c.style.padding='12px 12px calc(env(safe-area-inset-bottom,0px) + 16px)';
  c.innerHTML = html;
  s.appendChild(c); document.body.appendChild(s);
  requestAnimationFrame(() => s.classList.add('show'));
  return { sheet:s, content:c };
}
function _time(iso) { try { return new Date(iso).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}); } catch(_){ return '—'; } }
function _ago(iso) { if (!iso) return '—'; const m = Math.floor((Date.now()-new Date(iso).getTime())/60000); if (m<1) return 'الان'; if (m<60) return m+'د'; return Math.floor(m/60)+'س'; }
function _fmt(sec) { if (sec < 0) sec = 0; const m = Math.floor(sec/60); const s = sec%60; return m + ':' + String(s).padStart(2,'0'); }

let _timer = null;

async function render(el, workspaceData, patientId) {
  if (_timer) { clearInterval(_timer); _timer = null; }
  const active = await _api('/api/nc/transfusion/active').catch(() => ({ items: [] }));
  const patientActive = (active.items || []).filter(t => t.patientId === patientId);
  const history = await _api('/api/nc/transfusion/history?patientId=' + patientId).catch(() => ({ items: [] }));

  let h = '';
  if (patientActive.length) {
    patientActive.forEach(t => { h += _renderActiveCard(t); });
  } else {
    h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:8px;font-weight:900" onclick="NABZ.nurseTx._openStart(\'' + patientId + '\')">🩸 شروع ترانسفوزیون جدید</button>';
  }
  if (history.items && history.items.length) {
    h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin:10px 0 4px">📚 تاریخچه (' + history.items.length + ')</div>';
    history.items.slice(0, 10).forEach(t => {
      const cls = t.status === 'completed' ? 'ok' : t.status === 'stopped_reaction' ? 'dng' : 'warn';
      const statusFa = t.status === 'completed' ? 'تکمیل' : t.status === 'stopped_reaction' ? 'واکنش' : 'در جریان';
      h += '<div class="card" style="padding:8px 10px;margin-bottom:3px;border-right:3px solid var(--' + cls + ')">';
      h += '<div style="display:flex;justify-content:space-between"><div><div style="font-size:11.5px;font-weight:900">' + _esc(t.productType) + ' ' + t.units + ' واحد</div>';
      h += '<div style="font-size:10px;color:var(--fg-2)">' + _time(t.startedAt) + ' · ' + _ago(t.startedAt) + ' · ' + _esc(t.unitNumber) + '</div></div>';
      h += '<span class="pill ' + cls + '">' + statusFa + '</span></div></div>';
    });
  }
  el.innerHTML = h;
  // Start countdown timer for next check
  if (patientActive.length) {
    _timer = setInterval(() => {
      document.querySelectorAll('[data-next-check]').forEach(elm => {
        const target = new Date(elm.dataset.nextCheck).getTime();
        const sec = Math.floor((target - Date.now())/1000);
        elm.textContent = sec > 0 ? _fmt(sec) : 'گذشته ' + _fmt(-sec);
        elm.style.color = sec < 0 ? 'var(--dng)' : sec < 300 ? 'var(--warn)' : 'var(--ok)';
      });
    }, 1000);
  }
}

function _renderActiveCard(t) {
  const next = t.nextCheck;
  const elapsed = t.elapsedMin;
  let h = '<div class="card" style="padding:12px;margin-bottom:8px;border:2px solid var(--dng);background:linear-gradient(135deg,rgba(239,68,68,.06),transparent)">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
  h += '<div><div style="font-size:14px;font-weight:900;color:var(--dng)">🩸 ترانسفوزیون فعال</div>';
  h += '<div style="font-size:11px;color:var(--fg-2)">' + _esc(t.productType) + ' ' + t.units + ' واحد · ' + _esc(t.unitNumber) + '</div>';
  h += '<div style="font-size:10.5px;color:var(--fg-2)">شروع: ' + _time(t.startedAt) + ' · گذشته ' + elapsed + ' دقیقه</div>';
  h += '<div style="font-size:10.5px;color:var(--fg-2)">دو نفره: ' + _esc(t.primaryNurseName) + ' + ' + _esc(t.secondCheckerName) + '</div>';
  h += '</div>';
  h += '<div style="text-align:left;font-size:10.5px">';
  h += '<div style="font-weight:800">Baseline:</div>';
  h += '<div>T ' + t.baselineVitals.temp + '° · HR ' + t.baselineVitals.hr + ' · BP ' + t.baselineVitals.bp_sys + ' · SpO₂ ' + t.baselineVitals.spo2 + '</div>';
  h += '</div></div>';

  // Next check
  if (next) {
    h += '<div style="background:var(--dng-soft);border-radius:8px;padding:10px;margin-bottom:8px;text-align:center">';
    h += '<div style="font-size:10.5px;color:var(--dng);font-weight:900">⏰ ویتال بعدی — ' + _esc(next.label) + '</div>';
    h += '<div style="font-size:32px;font-weight:900;color:var(--dng);font-family:monospace" data-next-check="' + next.dueAt + '">—</div>';
    h += '</div>';
  } else {
    h += '<div class="hint success" style="margin-bottom:8px;text-align:center">✅ همه ویتال‌های برنامه‌ریزی‌شده انجام شد</div>';
  }

  // Actions
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">';
  h += '<button class="btn btn-primary" style="padding:10px;font-weight:900;font-size:12px" onclick="NABZ.nurseTx._openVital(\'' + t.id + '\')">📊 ثبت ویتال</button>';
  h += '<button class="btn btn-dng" style="padding:10px;font-weight:900;font-size:12px" onclick="NABZ.nurseTx._openReaction(\'' + t.id + '\')">🚨 واکنش</button>';
  h += '</div>';
  h += '<button class="btn btn-ok btn-block" style="padding:10px;font-size:11.5px" onclick="NABZ.nurseTx._complete(\'' + t.id + '\')">✅ اتمام ترانسفوزیون</button>';

  // Vital log
  if (t.vitalLogs && t.vitalLogs.length) {
    h += '<div style="font-size:10.5px;font-weight:900;color:var(--primary);margin:10px 0 4px">📋 ویتال‌ها (' + t.vitalLogs.length + ')</div>';
    t.vitalLogs.slice().reverse().forEach(v => {
      const warn = v.warnings && v.warnings.length;
      h += '<div style="padding:4px 8px;background:' + (warn ? 'var(--dng-soft)' : 'var(--bg-2)') + ';border-radius:4px;margin-bottom:2px;font-size:10.5px">';
      h += '<b>' + _time(v.at) + '</b> · T ' + v.temp + ' · HR ' + v.hr + ' · BP ' + v.bp_sys + '/' + v.bp_dia + ' · SpO₂ ' + v.spo2;
      if (warn) h += ' <span style="color:var(--dng);font-weight:900">⚠️ ' + v.warnings.join(', ') + '</span>';
      h += '</div>';
    });
  }
  h += '</div>';
  return h;
}

async function _openStart(patientId) {
  // Load issued blood requests for this patient
  const reqs = await _api('/api/para/blood').catch(() => ({ items: [] }));
  const issued = (reqs.items || []).filter(r => r.patientId === patientId && r.status === 'issued');
  if (!issued.length) {
    _sheet('<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🩸 شروع ترانسفوزیون</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div><div class="empty">هیچ درخواست خونی در وضعیت issued برای این بیمار نیست. ابتدا از پنل بانک خون درخواست را issue کنید.</div>');
    return;
  }
  const users = await _api('/api/admin/users').catch(() => ({ items: [] }));
  const possibleCheckers = (users.items || []).filter(u => u.active !== false && ['admin','nurse','head_nurse','attending','specialist','resident','physician'].includes(u.role) && u.id !== (NABZ.state.user && NABZ.state.user.id));

  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">🩸 ترانسفوزیون — چک ۲ نفره</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="hint warn" style="margin-bottom:8px">⚠️ JCI IPSG.3 — تأیید دو نفره اجباری</div>';
  h += '<div class="wf-field"><label>درخواست خون *</label><select id="tx_req" style="font-size:12px">';
  issued.forEach(r => { h += '<option value="' + r.id + '">' + _esc(r.productType) + ' ' + r.units + ' واحد — ' + _esc(r.patientBloodType || '?') + '</option>'; });
  h += '</select></div>';
  h += '<div class="wf-field"><label>شماره واحد کیسه</label><input type="text" id="tx_unit" placeholder="UNIT-..."></div>';
  h += '<div class="wf-field"><label>تاریخ انقضا</label><input type="date" id="tx_expiry"></div>';
  h += '<div class="wf-field"><label>پرستار دوم *</label><select id="tx_second" style="font-size:12px">';
  possibleCheckers.forEach(u => { h += '<option value="' + u.id + '">' + _esc(u.fullName || u.username) + ' — ' + _esc(u.role) + '</option>'; });
  h += '</select></div>';

  // 10-item checklist
  h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin:10px 0 6px">📋 چک‌لیست ۱۰ آیتمی</div>';
  const items = [
    ['identity','هویت بیمار با برچسب کیسه'],
    ['bloodType','گروه خونی گیرنده/دهنده'],
    ['unitNumber','شماره واحد'],
    ['expiry','تاریخ انقضا معتبر'],
    ['crossmatch','برچسب کراس‌مچ سازگار'],
    ['bag','کیسه سالم بدون نشتی'],
    ['consent','رضایت‌نامه امضا شده'],
    ['ivAccess','دسترسی IV مناسب'],
    ['baselineVitals','ویتال پایه ثبت شد'],
    ['twoPerson','تأیید دو نفره']
  ];
  items.forEach(([k, l]) => {
    h += '<label style="display:flex;align-items:center;gap:8px;padding:6px;background:var(--bg-2);border-radius:5px;margin-bottom:3px;font-size:11px;cursor:pointer">';
    h += '<input type="checkbox" id="tx_c_' + k + '" style="width:16px;height:16px;accent-color:var(--primary)">';
    h += '<span>' + l + '</span></label>';
  });

  // Baseline vitals
  h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin:10px 0 6px">📊 ویتال پایه</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">';
  [['temp','T °C'],['hr','HR'],['bp_sys','SBP'],['bp_dia','DBP'],['rr','RR'],['spo2','SpO₂']].forEach(([id, lbl]) => {
    h += '<div class="wf-field" style="margin:0"><label style="font-size:10px">' + lbl + '</label><input type="number" step="0.1" id="tx_' + id + '" style="width:100%;padding:6px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:5px;color:var(--fg);font-size:13px;text-align:center"></div>';
  });
  h += '</div>';

  h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nurseTx._doStart(\'' + patientId + '\')">🩸 شروع ترانسفوزیون</button>';
  _sheet(h);
}

async function _doStart(patientId) {
  const checklist = {};
  ['identity','bloodType','unitNumber','expiry','crossmatch','bag','consent','ivAccess','baselineVitals','twoPerson'].forEach(k => {
    const el = document.getElementById('tx_c_' + k);
    checklist[k] = el && el.checked;
  });
  const missing = Object.entries(checklist).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) return alert('آیتم‌های ناقص:\n' + missing.join('\n'));

  const g = id => (document.getElementById('tx_' + id) || {}).value;
  const body = {
    patientId,
    bloodRequestId: (document.getElementById('tx_req') || {}).value,
    unitNumber: g('unit'),
    expiry: g('expiry'),
    secondCheckerId: (document.getElementById('tx_second') || {}).value,
    checklist,
    baselineVitals: {
      temp: parseFloat(g('temp')),
      hr: parseFloat(g('hr')),
      bp_sys: parseFloat(g('bp_sys')),
      bp_dia: parseFloat(g('bp_dia')),
      rr: parseFloat(g('rr')),
      spo2: parseFloat(g('spo2'))
    }
  };
  if (!body.baselineVitals.temp || !body.baselineVitals.hr || !body.baselineVitals.bp_sys) return alert('ویتال پایه الزامی');
  try {
    await _api('/api/nc/transfusion/start', { method:'POST', body: JSON.stringify(body) });
    _close();
    NABZ._toast('✅ ترانسفوزیون شروع شد — پایش ۱۵ دقیقه');
    NABZ.nurseWS._reload();
  } catch (e) { alert('خطا: ' + e.message); }
}

function _openVital(txId) {
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">📊 ثبت ویتال ترانسفوزیون</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">';
  [['temp','T °C'],['hr','HR'],['bp_sys','SBP'],['bp_dia','DBP'],['rr','RR'],['spo2','SpO₂']].forEach(([id, lbl]) => {
    h += '<div class="wf-field" style="margin:0"><label style="font-size:10px">' + lbl + '</label><input type="number" step="0.1" id="tv_' + id + '" style="width:100%;padding:6px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:5px;color:var(--fg);font-size:14px;text-align:center;font-weight:900"></div>';
  });
  h += '</div>';
  h += '<div style="font-size:11px;font-weight:900;color:var(--dng);margin:10px 0 4px">علائم واکنش (اگر هست)</div>';
  ['rash','dyspnea','backPain','darkUrine'].forEach((k, i) => {
    const lbl = ['راش/کهیر','تنگی نفس','درد کمر','ادرار تیره'][i];
    h += '<label style="display:flex;align-items:center;gap:6px;padding:4px;font-size:11px"><input type="checkbox" id="tv_' + k + '" style="width:16px;height:16px">' + lbl + '</label>';
  });
  h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:10px;font-weight:900" onclick="NABZ.nurseTx._doVital(\'' + txId + '\')">✅ ثبت</button>';
  _sheet(h);
}

async function _doVital(txId) {
  const g = id => (document.getElementById('tv_' + id) || {}).value;
  const gc = id => (document.getElementById('tv_' + id) || {}).checked;
  const body = {
    temp: parseFloat(g('temp')), hr: parseFloat(g('hr')),
    bp_sys: parseFloat(g('bp_sys')), bp_dia: parseFloat(g('bp_dia')),
    rr: parseFloat(g('rr')), spo2: parseFloat(g('spo2')),
    rash: gc('rash'), dyspnea: gc('dyspnea'), backPain: gc('backPain'), darkUrine: gc('darkUrine')
  };
  if (!body.temp || !body.hr || !body.bp_sys) return alert('T/HR/SBP الزامی');
  try {
    const r = await _api('/api/nc/transfusion/' + txId + '/vital', { method:'POST', body: JSON.stringify(body) });
    _close();
    if (r.requiresAction) {
      alert('🚨 واکنش مشکوک:\n' + r.warnings.join('\n') + '\n\nترانسفوزیون را متوقف کنید.');
      NABZ.nurseTx._openReaction(txId);
    } else if (r.warnings && r.warnings.length) {
      NABZ._toast('⚠️ ' + r.warnings.join(' · '));
      NABZ.nurseWS._reload();
    } else {
      NABZ._toast('✅ ثبت شد');
      NABZ.nurseWS._reload();
    }
  } catch (e) { alert('خطا: ' + e.message); }
}

function _openReaction(txId) {
  const reactions = [
    ['fnhtr','تب/لرز (FNHTR)','medium'],
    ['allergic','آلرژیک (کهیر)','medium'],
    ['anaphylactic','آنافیلاکسی','critical'],
    ['hemolytic','همولیتیک حاد','critical'],
    ['trali','TRALI (ادم ریه)','critical'],
    ['taco','TACO (بار حجمی)','high'],
    ['bacterial','آلودگی باکتریایی','critical'],
    ['gvhd','GVHD','high']
  ];
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title" style="color:var(--dng)">🚨 واکنش ترانسفوزیون</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="hint danger" style="margin-bottom:8px">⚠️ پروتکل: STOP — NS باز نگهدار — پزشک — کیسه به بانک</div>';
  h += '<div class="wf-field"><label>نوع واکنش *</label><select id="tr_type" style="font-size:12px">';
  reactions.forEach(([k, l, sev]) => { h += '<option value="' + k + '">' + (sev === 'critical' ? '🚨 ' : '⚠️ ') + l + '</option>'; });
  h += '</select></div>';
  h += '<div class="wf-field"><label>یافته‌ها</label><textarea id="tr_findings" rows="2"></textarea></div>';
  h += '<div style="font-size:11px;font-weight:900;margin:8px 0 4px">اقدامات انجام‌شده:</div>';
  [['notifiedPhysician','پزشک مطلع شد'],['bagReturned','کیسه به بانک خون'],['bloodBankNotified','بانک خون مطلع']].forEach(([id, lbl]) => {
    h += '<label style="display:flex;align-items:center;gap:6px;padding:5px;background:var(--bg-2);border-radius:5px;margin-bottom:3px;font-size:11px;cursor:pointer"><input type="checkbox" id="tr_' + id + '" style="width:16px;height:16px">' + lbl + '</label>';
  });
  h += '<button class="btn btn-dng btn-block" style="padding:12px;margin-top:10px;font-weight:900" onclick="NABZ.nurseTx._doReaction(\'' + txId + '\')">🚨 ثبت واکنش و توقف</button>';
  _sheet(h);
}

async function _doReaction(txId) {
  const body = {
    reactionType: (document.getElementById('tr_type') || {}).value,
    findings: (document.getElementById('tr_findings') || {}).value,
    notifiedPhysician: (document.getElementById('tr_notifiedPhysician') || {}).checked,
    bagReturned: (document.getElementById('tr_bagReturned') || {}).checked,
    bloodBankNotified: (document.getElementById('tr_bloodBankNotified') || {}).checked
  };
  if (!confirm('تأیید توقف ترانسفوزیون؟')) return;
  try {
    await _api('/api/nc/transfusion/' + txId + '/reaction', { method:'POST', body: JSON.stringify(body) });
    _close();
    NABZ._toast('🚨 واکنش ثبت شد — STOP');
    NABZ.nurseWS._reload();
  } catch (e) { alert('خطا: ' + e.message); }
}

async function _complete(txId) {
  const note = prompt('یادداشت پایانی (اختیاری):') || '';
  try {
    await _api('/api/nc/transfusion/' + txId + '/complete', { method:'POST', body: JSON.stringify({ note }) });
    NABZ._toast('✅ ترانسفوزیون تکمیل شد');
    NABZ.nurseWS._reload();
  } catch (e) { alert('خطا: ' + e.message); }
}

window.NABZ = window.NABZ || {};
NABZ.nurseTx = { render, _openStart, _doStart, _openVital, _doVital, _openReaction, _doReaction, _complete };
console.log('[nurse-tx-ui] loaded ✓');
})();
