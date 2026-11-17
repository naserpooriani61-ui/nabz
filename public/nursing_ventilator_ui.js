// ═══════════════════════════════════════════════════════════
//  NABZ — Ventilator UI
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

async function render(el, wsData, patientId) {
  const cur = await _api('/api/nc/vent/' + patientId + '/current').catch(() => ({ active: false }));
  if (!cur.active) {
    el.innerHTML = '<div class="card" style="padding:20px;text-align:center"><div style="font-size:36px">🫁</div><div style="font-weight:900;font-size:14px;margin-top:6px">بیمار ونتیله نیست</div><button class="btn btn-primary btn-block" style="padding:10px;margin-top:12px;font-weight:900" onclick="NABZ.nurseVent._openInit(\'' + patientId + '\')">➕ شروع ونتیلاسیون</button></div>';
    return;
  }
  const v = cur.settings;
  let h = '';
  // Settings card
  h += '<div class="card" style="padding:12px;margin-bottom:10px;background:linear-gradient(135deg,rgba(6,182,212,.1),transparent)">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
  h += '<div><div style="font-size:13px;font-weight:900">🫁 ونتیلاتور فعال</div>';
  h += '<div style="font-size:11px;color:var(--fg-2)">از ' + _time(v.startedAt) + ' · ' + _esc(v.startedByName||'') + '</div></div>';
  h += '<button class="btn btn-sm" style="padding:6px 10px;font-size:11px" onclick="NABZ.nurseVent._openUpdate(\'' + v.id + '\')">✎ تنظیمات</button>';
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">';
  const cells = [
    ['Mode', v.mode],
    ['FiO₂', (v.fio2*100).toFixed(0) + '%'],
    ['PEEP', v.peep + ' cmH₂O'],
    ['VT', v.vt ? v.vt + ' mL' : '—'],
    ['RR', v.rr || '—'],
    ['Ppeak', v.ppeak ? v.ppeak + ' cmH₂O' : '—'],
    ['Pplat', v.pplat ? v.pplat + ' cmH₂O' : '—'],
    ['IBW', v.ibwKg ? v.ibwKg + ' kg' : '—'],
    ['Driving P', v.pplat && v.peep ? (v.pplat - v.peep) + ' cmH₂O' : '—']
  ];
  cells.forEach(([l, val]) => {
    let cls = 'ok';
    if (l === 'Pplat' && v.pplat > 30) cls = 'dng';
    if (l === 'FiO₂' && v.fio2 >= 0.6) cls = 'warn';
    if (l === 'Driving P' && v.pplat && v.peep && (v.pplat - v.peep) > 15) cls = 'dng';
    if (l === 'VT' && v.vt && v.ibwKg && v.vt > v.ibwKg * 8) cls = 'dng';
    h += '<div style="text-align:center;padding:6px;background:var(--bg-2);border-radius:6px;border:1px solid var(--' + cls + ')">';
    h += '<div style="font-size:13px;font-weight:900;color:var(--' + cls + ')">' + _esc(String(val)) + '</div>';
    h += '<div style="font-size:9px;color:var(--fg-2)">' + l + '</div></div>';
  });
  h += '</div></div>';

  // ABG quick
  h += '<div class="card" style="padding:10px;margin-bottom:8px">';
  h += '<div style="font-size:11.5px;font-weight:900;color:var(--primary);margin-bottom:6px">🩸 ABG (تفسیر خودکار)</div>';
  h += '<button class="btn btn-block" style="padding:10px;font-size:11.5px" onclick="NABZ.nurseVent._openABG(\'' + patientId + '\', ' + v.fio2 + ')">📊 وارد کردن ABG و تفسیر</button>';
  h += '</div>';

  // VAP bundle
  const vap = cur.vapToday;
  const vapScore = vap ? vap.score : 0;
  const vapTotal = vap ? vap.total : 7;
  const vapCls = vap && vapScore === vapTotal ? 'ok' : vapScore >= 4 ? 'warn' : 'dng';
  h += '<div class="card" style="padding:10px;margin-bottom:8px;border-color:var(--' + vapCls + ')">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
  h += '<div style="font-size:11.5px;font-weight:900">🧼 VAP Bundle</div>';
  h += '<span class="pill ' + vapCls + '">' + vapScore + '/' + vapTotal + '</span>';
  h += '</div>';
  if (!vap) h += '<div style="font-size:10.5px;color:var(--fg-2);margin-bottom:6px">امروز چک نشده</div>';
  else h += '<div style="font-size:10px;color:var(--fg-2);margin-bottom:6px">چک: ' + _time(vap.checkedAt) + ' · ' + _esc(vap.checkedByName||'') + '</div>';
  h += '<button class="btn btn-block" style="padding:8px;font-size:11px" onclick="NABZ.nurseVent._openVAP(\'' + patientId + '\', ' + JSON.stringify(vap ? vap.items : {}).replace(/"/g, '&quot;') + ')">🧼 ' + (vap ? 'بازبینی VAP' : 'چک VAP روزانه') + '</button>';
  h += '</div>';

  // SBT readiness
  try {
    const sbt = await _api('/api/nc/vent/' + patientId + '/sbt-readiness');
    const sbtCls = sbt.ready ? 'ok' : 'warn';
    h += '<div class="card" style="padding:10px;margin-bottom:8px;border-color:var(--' + sbtCls + ')">';
    h += '<div style="display:flex;justify-content:space-between;margin-bottom:6px">';
    h += '<div style="font-size:11.5px;font-weight:900">🎯 SBT Readiness</div>';
    h += '<span class="pill ' + sbtCls + '">' + sbt.score + '/' + sbt.total + '</span></div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2);margin-bottom:6px">' + _esc(sbt.recommendation) + '</div>';
    if (sbt.ready) h += '<button class="btn btn-ok btn-block" style="padding:8px;font-size:11px;font-weight:900" onclick="NABZ.nurseVent._openSBT(\'' + patientId + '\')">▶ شروع SBT</button>';
    h += '</div>';
  } catch (_) {}

  // Last SBT
  if (cur.lastSbt) {
    const sbt = cur.lastSbt;
    const cls = sbt.status === 'completed' ? (sbt.success ? 'ok' : 'warn') : 'info';
    h += '<div class="card" style="padding:8px;margin-bottom:8px;border-color:var(--' + cls + ')">';
    h += '<div style="font-size:10.5px;font-weight:900">📊 آخرین SBT</div>';
    h += '<div style="font-size:10px;color:var(--fg-2)">' + _time(sbt.startedAt) + ' · ' + (sbt.status === 'completed' ? (sbt.success ? 'موفق' : 'ناموفق') : 'در حال اجرا') + '</div>';
    if (sbt.rsbi30min) h += '<div style="font-size:10.5px">RSBI: ' + sbt.rsbi30min + ' (< 105 = آماده extubation)</div>';
    if (sbt.status === 'running') h += '<button class="btn btn-primary btn-block" style="padding:8px;margin-top:6px;font-size:11px" onclick="NABZ.nurseVent._openSBTComplete(\'' + sbt.id + '\')">✅ اتمام SBT</button>';
    h += '</div>';
  }

  // History
  if (v.history && v.history.length) {
    h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin:8px 0 4px">📚 تاریخ تنظیمات</div>';
    v.history.slice().reverse().slice(0, 8).forEach(log => {
      h += '<div style="padding:5px 8px;background:var(--bg-2);border-radius:4px;margin-bottom:2px;font-size:10px">';
      h += '<div><b>' + _time(log.at) + '</b> · ' + _esc(log.byName) + '</div>';
      const changes = [];
      Object.keys(log.after).forEach(k => { if (log.before[k] !== log.after[k]) changes.push(k + ': ' + log.before[k] + '→' + log.after[k]); });
      h += '<div style="color:var(--primary);font-family:monospace">' + _esc(changes.join(' · ')) + '</div>';
      h += '<div style="color:var(--fg-2)">' + _esc(log.reason||'') + '</div>';
      h += '</div>';
    });
  }

  el.innerHTML = h;
}

function _openInit(patientId) {
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">🫁 شروع ونتیلاسیون</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  const modes = ['AC/VC','AC/PC','SIMV','PSV','CPAP','PRVC','APRV','HFNC','NIV','Room Air'];
  h += '<div class="wf-field"><label>Mode *</label><select id="vi_mode" style="font-size:12px">';
  modes.forEach(m => { h += '<option value="' + m + '">' + m + '</option>'; });
  h += '</select></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
  [['vi_fio2','FiO₂ (0.21-1)',0.4],['vi_peep','PEEP (cmH₂O)',5],['vi_vt','VT (mL)',''],['vi_rr','RR',''],['vi_ppeak','Ppeak',''],['vi_pplat','Pplat',''],['vi_height','قد (cm)',''],['vi_ibw','IBW (kg)','']].forEach(([id, lbl, def]) => {
    h += '<div class="wf-field" style="margin:0"><label style="font-size:10px">' + lbl + '</label><input type="number" step="0.01" id="' + id + '" value="' + def + '" style="width:100%;padding:6px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:5px;color:var(--fg);font-size:12px;text-align:center"></div>';
  });
  h += '</div>';
  h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:10px;font-weight:900" onclick="NABZ.nurseVent._doInit(\'' + patientId + '\')">شروع</button>';
  _sheet(h);
}

async function _doInit(patientId) {
  const g = id => { const el = document.getElementById(id); return el && el.value !== '' ? parseFloat(el.value) : null; };
  const body = {
    patientId,
    mode: (document.getElementById('vi_mode') || {}).value,
    fio2: g('vi_fio2'), peep: g('vi_peep'),
    vt: g('vi_vt'), rr: g('vi_rr'),
    ppeak: g('vi_ppeak'), pplat: g('vi_pplat'),
    heightCm: g('vi_height'), ibwKg: g('vi_ibw')
  };
  try {
    await _api('/api/nc/vent/init', { method:'POST', body: JSON.stringify(body) });
    _close(); NABZ._toast('✅ ونتیلاسیون ثبت شد'); NABZ.nurseWS._reload();
  } catch (e) { alert('خطا: ' + e.message); }
}

function _openUpdate(ventId) {
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">✎ تغییر تنظیمات</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  const modes = ['AC/VC','AC/PC','SIMV','PSV','CPAP','PRVC','APRV','HFNC','NIV','Room Air'];
  h += '<div class="wf-field"><label>Mode</label><select id="vu_mode" style="font-size:12px"><option value="">(بدون تغییر)</option>';
  modes.forEach(m => { h += '<option value="' + m + '">' + m + '</option>'; });
  h += '</select></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
  [['vu_fio2','FiO₂'],['vu_peep','PEEP'],['vu_vt','VT mL'],['vu_rr','RR'],['vu_ppeak','Ppeak'],['vu_pplat','Pplat']].forEach(([id, lbl]) => {
    h += '<div class="wf-field" style="margin:0"><label style="font-size:10px">' + lbl + '</label><input type="number" step="0.01" id="' + id + '" placeholder="بدون تغییر" style="width:100%;padding:6px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:5px;color:var(--fg);font-size:12px;text-align:center"></div>';
  });
  h += '</div>';
  h += '<div class="wf-field" style="margin-top:8px"><label>دلیل *</label><textarea id="vu_reason" rows="2"></textarea></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:10px;font-weight:900" onclick="NABZ.nurseVent._doUpdate(\'' + ventId + '\')">ثبت</button>';
  _sheet(h);
}

async function _doUpdate(ventId) {
  const reason = (document.getElementById('vu_reason') || {}).value || '';
  if (reason.trim().length < 5) return alert('دلیل حداقل ۵ کاراکتر');
  const changes = {};
  const g = id => { const el = document.getElementById(id); return el && el.value !== '' ? el.value : null; };
  if (g('vu_mode')) changes.mode = g('vu_mode');
  [['vu_fio2','fio2'],['vu_peep','peep'],['vu_vt','vt'],['vu_rr','rr'],['vu_ppeak','ppeak'],['vu_pplat','pplat']].forEach(([id, k]) => {
    if (g(id) != null) changes[k] = parseFloat(g(id));
  });
  if (!Object.keys(changes).length) return alert('هیچ تغییری مشخص نشده');
  try {
    const r = await _api('/api/nc/vent/' + ventId + '/update', { method:'POST', body: JSON.stringify({ changes, reason }) });
    _close();
    if (r.alerts && r.alerts.length) alert('⚠️ هشدار:\n' + r.alerts.join('\n'));
    NABZ._toast('✅ ثبت شد');
    NABZ.nurseWS._reload();
  } catch (e) { alert('خطا: ' + e.message); }
}

function _openABG(patientId, fio2) {
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">🩸 ABG Interpretation</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">';
  [['abg_ph','pH',7.4,0.01],['abg_pco2','pCO₂',40,1],['abg_po2','pO₂',80,1],['abg_hco3','HCO₃',24,1],['abg_fio2','FiO₂',fio2,0.01]].forEach(([id, lbl, def, step]) => {
    h += '<div class="wf-field" style="margin:0"><label style="font-size:10px">' + lbl + '</label><input type="number" step="' + step + '" id="' + id + '" value="' + def + '" style="width:100%;padding:6px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:5px;color:var(--fg);font-size:13px;text-align:center;font-weight:900"></div>';
  });
  h += '</div>';
  h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:10px;font-weight:900" onclick="NABZ.nurseVent._doABG(\'' + patientId + '\')">🔍 تفسیر</button>';
  h += '<div id="abg_result" style="margin-top:10px"></div>';
  _sheet(h);
}

async function _doABG(patientId) {
  const g = id => parseFloat((document.getElementById(id) || {}).value);
  const body = { patientId, ph: g('abg_ph'), pco2: g('abg_pco2'), po2: g('abg_po2'), hco3: g('abg_hco3'), fio2: g('abg_fio2') };
  if (!body.ph || !body.pco2) return alert('pH و pCO₂ الزامی');
  try {
    const r = await _api('/api/nc/vent/abg', { method:'POST', body: JSON.stringify(body) });
    const el = document.getElementById('abg_result');
    if (!el) return;
    let cls = 'ok';
    if (r.primary.indexOf('acidosis') >= 0) cls = 'warn';
    if (r.hypoxemia === 'severe' || r.ardsSeverity === 'severe') cls = 'dng';
    let html = '<div class="card" style="border-color:var(--' + cls + ')">';
    html += '<div style="font-size:13px;font-weight:900;color:var(--' + cls + ')">' + _esc(r.primary.replace(/_/g, ' ')) + '</div>';
    if (r.compensation) html += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + _esc(r.compensation.replace(/_/g, ' ')) + '</div>';
    if (r.detail) html += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px;font-family:monospace">' + _esc(r.detail) + '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;font-size:11px">';
    html += '<div>A-a gradient: <b>' + r.aaGradient + '</b></div>';
    html += '<div>P/F ratio: <b>' + (r.pfRatio || '—') + '</b></div>';
    if (r.hypoxemia !== 'normal') html += '<div style="color:var(--' + (r.hypoxemia === 'severe' ? 'dng' : 'warn') + ')">Hypoxemia: <b>' + r.hypoxemia + '</b></div>';
    if (r.ardsSeverity) html += '<div style="color:var(--dng)">ARDS: <b>' + r.ardsSeverity + '</b></div>';
    html += '</div></div>';
    el.innerHTML = html;
  } catch (e) { alert('خطا: ' + e.message); }
}

function _openVAP(patientId, currentItems) {
  const items = [
    ['hob_30_45','HOB ۳۰-۴۵ درجه'],
    ['oral_care_chg','مراقبت دهان با CHG'],
    ['sedation_vacation','Sedation vacation'],
    ['dvt_prophylaxis','DVT prophylaxis'],
    ['pud_prophylaxis','PUD prophylaxis'],
    ['cuff_pressure','Cuff pressure ۲۰-۳۰'],
    ['subglottic_suction','Subglottic suction']
  ];
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">🧼 VAP Bundle</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  items.forEach(([k, lbl]) => {
    const checked = currentItems && currentItems[k] ? 'checked' : '';
    h += '<label style="display:flex;align-items:center;gap:6px;padding:6px;background:var(--bg-2);border-radius:5px;margin-bottom:3px;font-size:11px;cursor:pointer">';
    h += '<input type="checkbox" id="vap_' + k + '" ' + checked + ' style="width:18px;height:18px;accent-color:var(--primary)">';
    h += '<span>' + lbl + '</span></label>';
  });
  h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:10px;font-weight:900" onclick="NABZ.nurseVent._doVAP(\'' + patientId + '\')">✅ ثبت</button>';
  _sheet(h);
}

async function _doVAP(patientId) {
  const body = { patientId };
  ['hob_30_45','oral_care_chg','sedation_vacation','dvt_prophylaxis','pud_prophylaxis','cuff_pressure','subglottic_suction'].forEach(k => {
    body[k] = !!(document.getElementById('vap_' + k) || {}).checked;
  });
  try {
    const r = await _api('/api/nc/vent/vap', { method:'POST', body: JSON.stringify(body) });
    _close();
    NABZ._toast('✅ VAP ' + r.score + '/' + r.total);
    NABZ.nurseWS._reload();
  } catch (e) { alert('خطا: ' + e.message); }
}

function _openSBT(patientId) {
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">▶ SBT — Spontaneous Breathing Trial</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="hint info" style="margin-bottom:8px">مدت پیشنهادی: ۳۰ دقیقه · سپس RSBI</div>';
  h += '<div class="wf-field"><label>Mode</label><select id="sbt_mode"><option value="PSV 5/5">PSV 5/5</option><option value="T-piece">T-piece</option><option value="CPAP 5">CPAP 5</option></select></div>';
  h += '<div class="wf-field"><label>مدت (دقیقه)</label><input type="number" id="sbt_dur" value="30"></div>';
  h += '<button class="btn btn-ok btn-block" style="padding:12px;margin-top:10px;font-weight:900" onclick="NABZ.nurseVent._doSBT(\'' + patientId + '\')">▶ شروع SBT</button>';
  _sheet(h);
}

async function _doSBT(patientId) {
  const body = {
    patientId,
    mode: (document.getElementById('sbt_mode') || {}).value,
    plannedDurationMin: parseInt((document.getElementById('sbt_dur') || {}).value) || 30
  };
  try {
    await _api('/api/nc/vent/sbt/start', { method:'POST', body: JSON.stringify(body) });
    _close(); NABZ._toast('▶ SBT شروع شد'); NABZ.nurseWS._reload();
  } catch (e) { alert('خطا: ' + e.message); }
}

function _openSBTComplete(sbtId) {
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">✅ اتمام SBT</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
  h += '<div class="wf-field" style="margin:0"><label style="font-size:10px">RR</label><input type="number" id="sbtc_rr" style="width:100%;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:5px;color:var(--fg);font-size:14px;text-align:center"></div>';
  h += '<div class="wf-field" style="margin:0"><label style="font-size:10px">VT (mL)</label><input type="number" id="sbtc_vt" style="width:100%;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:5px;color:var(--fg);font-size:14px;text-align:center"></div>';
  h += '</div>';
  [['distress','دیسترس تنفسی'],['accessoryMuscles','عضلات فرعی'],['sweating','تعریق'],['tachycardia','تاکی‌کاردی']].forEach(([k, lbl]) => {
    h += '<label style="display:flex;align-items:center;gap:6px;padding:5px;font-size:11px;margin-top:3px"><input type="checkbox" id="sbtc_' + k + '" style="width:16px;height:16px">' + lbl + '</label>';
  });
  h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:10px;font-weight:900" onclick="NABZ.nurseVent._doSBTComplete(\'' + sbtId + '\')">ثبت</button>';
  _sheet(h);
}

async function _doSBTComplete(sbtId) {
  const g = id => parseFloat((document.getElementById(id) || {}).value);
  const gc = id => !!(document.getElementById(id) || {}).checked;
  const body = {
    rr: g('sbtc_rr'), vt: g('sbtc_vt'),
    distress: gc('sbtc_distress'), accessoryMuscles: gc('sbtc_accessoryMuscles'),
    sweating: gc('sbtc_sweating'), tachycardia: gc('sbtc_tachycardia')
  };
  if (!body.rr || !body.vt) return alert('RR و VT الزامی');
  try {
    const r = await _api('/api/nc/vent/sbt/' + sbtId + '/complete', { method:'POST', body: JSON.stringify(body) });
    _close();
    NABZ._toast('✅ SBT — RSBI ' + r.rsbi30min + (r.success ? ' · extubation ready' : ' · ادامه ونتیلاسیون'));
    NABZ.nurseWS._reload();
  } catch (e) { alert('خطا: ' + e.message); }
}

window.NABZ = window.NABZ || {};
NABZ.nurseVent = { render, _openInit, _doInit, _openUpdate, _doUpdate, _openABG, _doABG, _openVAP, _doVAP, _openSBT, _doSBT, _openSBTComplete, _doSBTComplete };
console.log('[nurse-vent-ui] loaded ✓');
})();
