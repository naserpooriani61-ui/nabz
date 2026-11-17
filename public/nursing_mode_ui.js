// ═══════════════════════════════════════════════════════════
//  NABZ — Nursing Mode UI (S2)
// ═══════════════════════════════════════════════════════════
(function(){
'use strict';
const NM = {
  _api: (p, o) => NABZ._api(p, o),
  _esc: s => NABZ._esc(s),
  _state: { tab: 'tasks', data: null, tasks: null },
  _time(iso) { try { return new Date(iso).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}); } catch(_){ return '—'; } },
  _closeAll() { document.querySelectorAll('.bs-backdrop').forEach(el => el.remove()); },
  _openSheet(html) {
    const s = document.createElement('div'); s.className = 'bs-backdrop';
    s.onclick = e => { if (e.target === s) s.remove(); };
    const c = document.createElement('div'); c.className = 'bs-sheet';
    c.style.maxHeight = '96vh'; c.innerHTML = html;
    s.appendChild(c); document.body.appendChild(s);
    requestAnimationFrame(() => s.classList.add('show'));
    return { sheet: s, content: c };
  },

  async show(p, d) {
    const m = document.getElementById('content');
    m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
    try {
      const results = await Promise.all([
        d || NM._api('/api/nurse/my-shift'),
        NM._api('/api/nurse/tasks')
      ]);
      NM._state.data = results[0]; NM._state.tasks = results[1];
      NM._render(); NM._subscribeLive();
    } catch(e) { m.innerHTML = '<div class="empty">خطا: ' + NM._esc(e.message) + '</div>'; }
  },

  _render() {
    const d = NM._state.data; if (!d) return;
    const m = document.getElementById('content'); const s = d.shift;
    let h = '';
    h += '<div class="card" style="padding:12px;margin-bottom:12px;background:linear-gradient(135deg,rgba(6,182,212,.12),rgba(139,92,246,.06))">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
    h += '<div><div style="font-size:18px;font-weight:900">👩‍⚕️ کارتابل من</div>';
    h += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:2px">' + NM._esc(d.ward) + ' · شیفت ' + s.fa + '</div></div>';
    h += '<div style="text-align:left"><div style="font-size:28px;font-weight:900;color:var(--' + (d.criticalTaskCount > 0 ? 'dng' : 'primary') + ')">' + d.taskCount + '</div><div style="font-size:9px;color:var(--fg-2)">وظیفه</div></div></div></div>';
    if (d.pendingHandoffs > 0) {
      h += '<div style="background:var(--dng-soft);border:2px solid var(--dng);border-radius:10px;padding:10px;margin-bottom:12px;cursor:pointer" onclick="NABZ.show(\'oncall_handoff_bridge.dashboard\')">';
      h += '<div style="font-size:12.5px;font-weight:900;color:var(--dng)">🚨 ' + d.pendingHandoffs + ' Handoff در انتظار شما</div></div>';
    }
    h += '<div class="rd-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">';
    h += '<div class="rd-stat info"><div class="v">' + d.patientCount + '</div><div class="l">بیمار</div></div>';
    h += '<div class="rd-stat ' + (d.criticalTaskCount > 0 ? 'dng' : 'ok') + '"><div class="v">' + d.criticalTaskCount + '</div><div class="l">بحرانی</div></div>';
    h += '<div class="rd-stat warn"><div class="v">' + d.taskCount + '</div><div class="l">کل</div></div></div>';
    const tabs = [['tasks','📋 کارتابل'],['patients','👥 بیماران'],['quick','⚡ اقدام'],['summary','📊 خلاصه']];
    h += '<div class="crisis-tabs" style="margin-bottom:12px;flex-wrap:wrap">';
    tabs.forEach(([k,l]) => { h += '<button class="crisis-tab' + (NM._state.tab === k ? ' on' : '') + '" onclick="NABZ.nursingMode._setTab(\'' + k + '\')">' + l + '</button>'; });
    h += '</div><div id="nmContent"></div>';
    m.innerHTML = h;
    if (NM._state.tab === 'tasks') NM._renderTasks();
    else if (NM._state.tab === 'patients') NM._renderPatients();
    else if (NM._state.tab === 'quick') NM._renderQuick();
    else if (NM._state.tab === 'summary') NM._renderSummary();
  },

  _setTab(t) { NM._state.tab = t; NM._render(); },

  _renderTasks() {
    const el = document.getElementById('nmContent'); if (!el) return;
    const items = (NM._state.tasks && NM._state.tasks.items) || [];
    if (!items.length) { el.innerHTML = '<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">✅</div><div style="font-weight:900;margin-top:8px">کارتابل خالی است</div></div>'; return; }
    const PC = { critical:'dng', high:'warn', medium:'info', low:'' };
    const PF = { critical:'بحرانی', high:'مهم', medium:'متوسط', low:'پایین' };
    const ICON = { mar:'💊', vitals:'📈', prn_effectiveness:'📊', critical_lab:'🧪', fall_risk:'🚶', restraint_assess:'🔒' };
    let h = '';
    items.forEach(t => {
      const cls = PC[t.priority] || 'info';
      h += '<div class="card" style="padding:10px;margin-bottom:6px;border-right:3px solid var(--' + cls + ');cursor:pointer" onclick="NABZ.nursingMode._doTask(\'' + t.id + '\')">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
      h += '<div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:900">' + (ICON[t.type]||'') + ' ' + NM._esc(t.title) + '</div>';
      if (t.patientName) h += '<div style="font-size:11px;color:var(--primary);margin-top:2px">' + NM._esc(t.patientName) + '</div>';
      if (t.subtitle) h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">' + NM._esc(t.subtitle) + '</div>';
      h += '</div><span class="pill ' + cls + '" style="font-size:9px">' + PF[t.priority] + '</span></div></div>';
    });
    el.innerHTML = h;
  },

  _renderPatients() {
    const el = document.getElementById('nmContent'); if (!el) return;
    const patients = (NM._state.data && NM._state.data.patients) || [];
    if (!patients.length) { el.innerHTML = '<div class="empty">بیماری نیست</div>'; return; }
    let h = '';
    patients.forEach(p => {
      const cls = p.criticalTasks > 0 ? 'dng' : p.riskLevel === 'hi' ? 'dng' : p.riskLevel === 'md' ? 'warn' : 'ok';
      h += '<div class="card" style="padding:10px;margin-bottom:4px;border-right:3px solid var(--' + cls + ');cursor:pointer" onclick="NABZ.nursingMode._openPatient(\'' + p.id + '\')">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
      h += '<div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:900">' + NM._esc(p.name) + '</div>';
      h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">' + (p.age||'?') + ' سال · تخت ' + NM._esc(p.bed||'') + '</div>';
      if (p.diagnosis) h += '<div style="font-size:10.5px;color:var(--fg-2)">' + NM._esc(p.diagnosis.slice(0,50)) + '</div>';
      if (p.allergies && p.allergies.length) h += '<div style="font-size:10px;color:var(--dng);font-weight:800;margin-top:2px">⚠️ ' + NM._esc(p.allergies.join('، ')) + '</div>';
      h += '</div><div style="text-align:left">';
      if (p.news2 !== null) h += '<span class="pill ' + (p.news2 >= 7 ? 'dng' : p.news2 >= 5 ? 'warn' : 'info') + '" style="font-size:9px">NEWS ' + p.news2 + '</span> ';
      if (p.taskCount > 0) h += '<span class="pill ' + (p.criticalTasks > 0 ? 'dng' : 'warn') + '" style="font-size:9px">' + p.taskCount + '</span>';
      h += '</div></div></div>';
    });
    el.innerHTML = h;
  },

  _renderQuick() {
    const el = document.getElementById('nmContent'); if (!el) return;
    let h = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
    [['vitals','📈','ثبت ویتال','NABZ.nursingMode.pickPatientThen(\'vitals\')'],
     ['mar','💊','توزیع MAR','NABZ.show(\'clinical.mar\')'],
     ['io','💧','I/O','NABZ.nursingMode.pickPatientThen(\'io\')'],
     ['note','📝','یادداشت','NABZ.nursingMode.pickPatientThen(\'note\')']].forEach(([k,i,l,fn]) => {
      h += '<button class="btn" style="padding:16px;display:flex;flex-direction:column;gap:6px;align-items:center" onclick="' + fn + '">';
      h += '<span style="font-size:28px">' + i + '</span><span style="font-size:11px;font-weight:900">' + l + '</span></button>';
    });
    h += '</div>';
    el.innerHTML = h;
  },

  async _renderSummary() {
    const el = document.getElementById('nmContent'); if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:20px"><span class="spinner"></span></div>';
    try {
      const s = await NM._api('/api/nurse/shift-summary');
      let h = '<div class="rd-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">';
      h += '<div class="rd-stat ' + (s.mar.compliance >= 95 ? 'ok' : s.mar.compliance >= 80 ? 'warn' : 'dng') + '"><div class="v">' + s.mar.compliance + '%</div><div class="l">MAR</div></div>';
      h += '<div class="rd-stat ' + (s.vitals.critical > 0 ? 'dng' : 'ok') + '"><div class="v">' + s.vitals.total + '</div><div class="l">ویتال</div></div>';
      h += '<div class="rd-stat info"><div class="v">' + s.notes + '</div><div class="l">یادداشت</div></div></div>';
      h += '<div class="card" style="margin-bottom:12px"><div class="card-title">💊 MAR</div>';
      h += '<div style="font-size:11.5px;line-height:1.8">✅ ' + s.mar.given + ' توزیع · ⏰ ' + s.mar.late + ' تأخیر · ❌ ' + s.mar.missed + ' missed · 🚫 ' + s.mar.refused + ' رد<br>';
      if (s.mar.highAlertGiven > 0) h += '⚠️ ' + s.mar.highAlertGiven + ' High-Alert<br>';
      h += '⏳ ' + s.mar.pending + ' در انتظار</div></div>';
      if (s.vitals.critical > 0) h += '<div class="hint danger">🚨 ' + s.vitals.critical + ' ویتال بحرانی</div>';
      h += '<div class="card" style="margin-bottom:12px"><div class="card-title">💧 I/O</div>';
      h += '<div style="font-size:11.5px">ورودی: <b>' + s.io.intake + '</b> ml · خروجی: <b>' + s.io.output + '</b> ml</div>';
      const netColor = s.io.net < -1000 ? 'dng' : s.io.net < -500 ? 'warn' : 'ok';
      h += '<div style="font-size:11.5px;color:var(--' + netColor + ');font-weight:900;margin-top:4px">تعادل: ' + (s.io.net > 0 ? '+' : '') + s.io.net + ' ml</div></div>';
      h += '<div style="display:flex;gap:6px;margin-top:12px">';
      h += '<button class="btn btn-primary" style="flex:1;padding:12px" onclick="NABZ.show(\'nursing_handoff_bridge.board\')">📋 تحویل</button>';
      h += '<button class="btn" style="flex:1;padding:12px" onclick="NABZ.nursingMode._renderSummary()">🔄 بازخوانی</button></div>';
      el.innerHTML = h;
    } catch(e) { el.innerHTML = '<div class="empty">خطا: ' + NM._esc(e.message) + '</div>'; }
  }
};

NM._doTask = function(taskId) {
  const items = (NM._state.tasks && NM._state.tasks.items) || [];
  const task = items.find(t => t.id === taskId); if (!task) return;
  if (task.action === 'administer') return NM._marGiveSheet(task);
  if (task.action === 'vitals') return NM._vitalsSheet(task.patientId);
  if (task.action === 'prn_effectiveness') return NM._prnSheet(task);
  if (task.action === 'acknowledge_lab') return NM._labAckSheet(task);
  if (task.action === 'morse') return NM._morseSheet(task);
  if (task.action === 'restraint_assess') { NM._closeAll(); NABZ.show('restraint.dashboard'); return; }
  if (task.patientId) NM._openPatient(task.patientId);
};

NM.pickPatientThen = async function(action) {
  try {
    const d = await NM._api('/api/nurse/my-shift');
    const patients = d.patients || [];
    if (!patients.length) return alert('بیماری نیست');
    let h = '<div class="bs-handle"></div>';
    h += '<div class="bs-hd"><div class="bs-title">👤 انتخاب بیمار</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    patients.forEach(p => {
      h += '<button class="btn" style="width:100%;text-align:right;padding:10px;margin-bottom:3px;display:flex;flex-direction:column;align-items:stretch;gap:2px" onclick="NABZ.nursingMode._pickAndAct(\'' + p.id + '\',\'' + action + '\')">';
      h += '<div style="font-weight:900">' + NM._esc(p.name) + '</div><div style="font-size:10.5px;color:var(--fg-2)">تخت ' + NM._esc(p.bed||'') + ' · ' + (p.age||'?') + ' سال</div></button>';
    });
    NM._openSheet(h);
  } catch(e) { alert('خطا: ' + e.message); }
};

NM._pickAndAct = function(patientId, action) {
  NM._closeAll();
  if (action === 'vitals') NM._vitalsSheet(patientId);
  else if (action === 'io') NM._ioSheet(patientId);
  else if (action === 'note') NM._noteSheet(patientId);
};

NM._vitalsSheet = async function(patientId) {
  try {
    const d = await NM._api('/api/nurse/patients/' + patientId);
    const p = d.patient; const lv = d.lastVital;
    let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📈 ویتال — ' + NM._esc(p.name) + '</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    if (lv) h += '<div class="hint info" style="margin-bottom:10px;font-size:11px">آخرین: HR ' + (lv.hr||'—') + ' · BP ' + (lv.bp_sys||'—') + '/' + (lv.bp_dia||'—') + ' · SpO₂ ' + (lv.spo2||'—') + '% · NEWS2 ' + (lv.news2||'—') + '</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">';
    [['HR','hr','bpm'],['SBP','bp_sys','mmHg'],['DBP','bp_dia','mmHg'],['RR','rr','/min'],['Temp','temp','°C'],['SpO₂','spo2','%']].forEach(([lbl,id,ph]) => {
      h += '<div class="wf-field" style="margin:0"><label style="font-size:11px">' + lbl + '</label>';
      h += '<input type="number" step="0.1" id="nm_' + id + '" placeholder="' + ph + '" style="width:100%;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:14px;font-weight:900;text-align:center;outline:none" oninput="NABZ.nursingMode._calcNews()"></div>';
    });
    h += '</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">';
    h += '<div class="wf-field" style="margin:0"><label style="font-size:11px">Pain (0-10)</label><input type="number" id="nm_pain" min="0" max="10" value="0" style="width:100%;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:14px;text-align:center"></div>';
    h += '<div class="wf-field" style="margin:0"><label style="font-size:11px">هوشیاری</label><select id="nm_consciousness" style="width:100%;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:12px"><option value="alert">Alert</option><option value="voice">Voice</option><option value="pain">Pain</option><option value="unresponsive">Unresponsive</option><option value="confused">Confused</option></select></div>';
    h += '</div>';
    h += '<label style="display:flex;gap:8px;align-items:center;padding:8px;background:var(--bg-2);border-radius:6px;margin:10px 0;font-size:12px"><input type="checkbox" id="nm_onOxygen" onchange="NABZ.nursingMode._calcNews()" style="width:18px;height:18px"><span>اکسیژن مکمل</span></label>';
    h += '<div style="text-align:center;padding:10px;background:var(--bg-3);border-radius:8px;margin-bottom:10px"><div style="font-size:32px;font-weight:900;color:var(--fg-2)" id="nmNewsVal">0</div><div style="font-size:10px;color:var(--fg-2)">NEWS2 (پیش‌نمایش)</div></div>';
    h += '<div class="wf-field"><label>یادداشت</label><textarea id="nm_notes" rows="2" style="width:100%;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:12px;font-family:inherit;outline:none"></textarea></div>';
    h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nursingMode._submitVitals(\'' + patientId + '\')">✅ ثبت</button>';
    NM._openSheet(h);
  } catch(e) { alert('خطا: ' + e.message); }
};

NM._calcNews = function() {
  let n = 0;
  const g = id => { const el = document.getElementById('nm_' + id); return el && el.value !== '' ? parseFloat(el.value) : null; };
  const rr = g('rr'); if (rr != null && !isNaN(rr)) n += rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3;
  const spo2 = g('spo2'); if (spo2 != null && !isNaN(spo2)) n += spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0;
  const o2 = document.getElementById('nm_onOxygen'); if (o2 && o2.checked) n += 2;
  const sbp = g('bp_sys'); if (sbp != null && !isNaN(sbp) && sbp > 0) n += sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3;
  const hr = g('hr'); if (hr != null && !isNaN(hr) && hr > 0) n += hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3;
  const c = document.getElementById('nm_consciousness'); if (c && c.value !== 'alert') n += 3;
  const temp = g('temp'); if (temp != null && !isNaN(temp) && temp > 0) n += temp <= 35 ? 3 : temp <= 36 ? 1 : temp <= 38 ? 0 : temp <= 39 ? 1 : 2;
  const el = document.getElementById('nmNewsVal');
  if (el) { el.textContent = n; el.style.color = n >= 7 ? 'var(--dng)' : n >= 5 ? 'var(--warn)' : n >= 1 ? 'var(--info)' : 'var(--ok)'; }
};

NM._submitVitals = async function(patientId) {
  const g = id => { const el = document.getElementById('nm_' + id); return el && el.value !== '' ? parseFloat(el.value) : null; };
  const body = { patientId, hr: g('hr'), bp_sys: g('bp_sys'), bp_dia: g('bp_dia'), rr: g('rr'), temp: g('temp'), spo2: g('spo2'), pain: g('pain'), onOxygen: document.getElementById('nm_onOxygen').checked, consciousness: document.getElementById('nm_consciousness').value, notes: document.getElementById('nm_notes').value };
  try {
    const r = await NM._api('/api/nurse/quick/vitals', { method:'POST', body: JSON.stringify(body) });
    NM._closeAll();
    NABZ._toast('✅ ثبت شد — NEWS2 ' + r.news2 + (r.alert ? ' ⚠️' : ''));
    NM.show(null, null);
  } catch(e) { alert('خطا: ' + e.message); }
};

NM._marGiveSheet = async function(task) {
  const m = task.meta || {};
  const isLate = m.minutesLate > 30;
  const needsWitness = m.isHighAlert;
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">💊 ' + NM._esc(m.drug) + ' ' + NM._esc(m.dose||'') + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="card" style="margin-bottom:10px;background:linear-gradient(135deg,rgba(6,182,212,.1),rgba(139,92,246,.05))">';
  h += '<div style="font-weight:900;font-size:14px">' + NM._esc(task.patientName) + '</div>';
  h += '<div style="font-size:11px;color:var(--fg-2)">' + NM._esc(m.route||'') + ' · ' + NM._esc(task.subtitle) + '</div>';
  if (needsWitness) h += '<div style="margin-top:6px;padding:6px;background:var(--warn-soft);border-radius:6px;font-size:11px;font-weight:900;color:var(--warn)">⚠️ HIGH-ALERT — نیاز به شاهد</div>';
  h += '</div>';
  h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin:10px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--border)">✅ ۵ Rights</div>';
  ['patient','drug','dose','route','time'].forEach((r, i) => {
    h += '<label style="display:flex;align-items:center;gap:8px;padding:6px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;font-size:11.5px;cursor:pointer">';
    h += '<input type="checkbox" id="nm_right_' + r + '" checked style="width:18px;height:18px;accent-color:var(--primary)">';
    h += '<span>' + ['بیمار صحیح','داروی صحیح','دوز صحیح','مسیر صحیح','زمان صحیح'][i] + '</span></label>';
  });
  if (isLate) {
    h += '<div class="wf-field" style="margin-top:10px"><label style="color:var(--dng);font-weight:900">⏰ دلیل تأخیر *</label><select id="nm_lateReason" style="font-weight:800"><option value="">—</option>';
    const reasons = { patient_npo:'NPO', procedure_pending:'پروسیجر', doctor_hold:'دستور پزشک', pharmacy_delay:'تأخیر داروخانه', clinical_decision:'تصمیم بالینی', patient_refused:'رد بیمار', patient_off_unit:'بیرون بخش', iv_access_issue:'مشکل IV', equipment_issue:'تجهیزات', medication_unavailable:'دارو نیست', other:'سایر' };
    Object.entries(reasons).forEach(([k, v]) => { h += '<option value="' + k + '">' + v + '</option>'; });
    h += '</select></div>';
  }
  if (needsWitness) h += '<div class="wf-field" style="margin-top:10px"><label style="color:var(--warn);font-weight:900">👥 شاهد *</label><input type="text" id="nm_witness" placeholder="username شاهد"></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nursingMode._submitMar(\'' + m.marId + '\',' + (needsWitness?'true':'false') + ',' + (isLate?'true':'false') + ')">✅ توزیع</button>';
  NM._openSheet(h);
};

NM._submitMar = async function(marId, needsWitness, isLate) {
  const fiveRights = {}; let all = true;
  ['patient','drug','dose','route','time'].forEach(r => { const el = document.getElementById('nm_right_' + r); fiveRights[r] = el ? el.checked : false; if (!fiveRights[r]) all = false; });
  if (!all) return alert('همه ۵ rights');
  const body = { marId, fiveRights };
  if (isLate) { const lr = document.getElementById('nm_lateReason'); if (!lr || !lr.value) return alert('دلیل تأخیر لازم'); body.lateReason = lr.value; }
  if (needsWitness) { const w = document.getElementById('nm_witness'); if (!w || !w.value.trim()) return alert('شاهد لازم'); body.witnessedBy = w.value.trim(); }
  try {
    await NM._api('/api/nurse/quick/mar-give', { method:'POST', body: JSON.stringify(body) });
    NM._closeAll(); NABZ._toast('✅ توزیع شد'); NM.show(null, null);
  } catch(e) { alert('خطا: ' + e.message); }
};

NM._prnSheet = function(task) {
  const m = task.meta || {};
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📊 اثربخشی ' + NM._esc(m.drug) + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>مقیاس</label><select id="nm_prnScale"><option value="pain">درد</option><option value="nausea">تهوع</option><option value="anxiety">اضطراب</option><option value="dyspnea">تنگی نفس</option></select></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
  h += '<div class="wf-field"><label>قبل</label><input type="number" id="nm_prnBefore" min="0" max="10" value="8" style="font-size:20px;text-align:center;font-weight:900"></div>';
  h += '<div class="wf-field"><label>بعد</label><input type="number" id="nm_prnAfter" min="0" max="10" style="font-size:20px;text-align:center;font-weight:900"></div></div>';
  h += '<div class="wf-field"><label>یادداشت</label><textarea id="nm_prnNotes" rows="2"></textarea></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nursingMode._submitPrn(\'' + m.marId + '\')">✅ ثبت</button>';
  NM._openSheet(h);
};

NM._submitPrn = async function(marId) {
  const body = { marId, scale: document.getElementById('nm_prnScale').value, before: parseFloat(document.getElementById('nm_prnBefore').value), after: parseFloat(document.getElementById('nm_prnAfter').value), notes: document.getElementById('nm_prnNotes').value };
  if (isNaN(body.before) || isNaN(body.after)) return alert('قبل و بعد لازم');
  try {
    await NM._api('/api/nurse/quick/prn-effectiveness', { method:'POST', body: JSON.stringify(body) });
    NM._closeAll(); NABZ._toast('✅ ثبت شد'); NM.show(null, null);
  } catch(e) { alert('خطا: ' + e.message); }
};

NM._labAckSheet = function(task) {
  const m = task.meta || {};
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🧪 Read-back آزمایش</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="card" style="margin-bottom:10px"><div style="font-weight:900">' + NM._esc(task.patientName) + '</div>';
  (m.flags || []).forEach(f => { h += '<div style="font-size:12px;color:var(--dng);font-weight:900">' + NM._esc(f.test) + ': ' + f.value + ' (' + f.type + ')</div>'; });
  h += '</div>';
  h += '<div class="hint info" style="margin-bottom:10px">JCI IPSG.2 — متن read-back الزامی است</div>';
  h += '<div class="wf-field"><label>متن read-back *</label><textarea id="nm_readback" rows="3" placeholder="مثلاً: K=6.8 بیمار X را دریافت کردم و به پزشک اطلاع دادم"></textarea></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nursingMode._submitLabAck(\'' + m.labId + '\')">✅ تأیید</button>';
  NM._openSheet(h);
};

NM._submitLabAck = async function(labId) {
  const rb = document.getElementById('nm_readback').value.trim();
  if (!rb || rb.length < 10) return alert('حداقل ۱۰ کاراکتر');
  try {
    await NM._api('/api/para/labs/' + labId + '/acknowledge', { method:'POST', body: JSON.stringify({ readBack: rb }) });
    NM._closeAll(); NABZ._toast('✅ تأیید شد'); NM.show(null, null);
  } catch(e) { alert('خطا: ' + e.message); }
};

NM._morseSheet = async function(task) {
  try {
    await NM._api(task.actionApi, { method: task.actionMethod || 'POST', body: '{}' });
    NABZ._toast('✅ Morse به‌روز شد'); NM.show(null, null);
  } catch(e) { alert('خطا: ' + e.message); }
};

NM._ioSheet = function(patientId) {
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">💧 ثبت I/O</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>نوع</label><select id="nm_ioType"><option value="intake">ورودی</option><option value="output">خروجی</option></select></div>';
  h += '<div class="wf-field"><label>زیرنوع</label><select id="nm_ioSub"><option value="oral">خوراکی</option><option value="iv">وریدی</option><option value="urine">ادرار</option><option value="drain">درناژ</option><option value="vomit">استفراغ</option><option value="stool">مدفوع</option><option value="other">سایر</option></select></div>';
  h += '<div class="wf-field"><label>حجم (ml) *</label><input type="number" id="nm_ioVol" style="font-size:20px;text-align:center;font-weight:900"></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nursingMode._submitIo(\'' + patientId + '\')">✅ ثبت</button>';
  NM._openSheet(h);
};

NM._submitIo = async function(patientId) {
  const body = { patientId, type: document.getElementById('nm_ioType').value, subtype: document.getElementById('nm_ioSub').value, volume: parseFloat(document.getElementById('nm_ioVol').value) };
  if (!body.volume) return alert('حجم لازم');
  try {
    const r = await NM._api('/api/nurse/quick/io', { method:'POST', body: JSON.stringify(body) });
    NM._closeAll(); NABZ._toast('✅ ' + body.volume + 'ml — تعادل: ' + (r.balance24h.net > 0 ? '+' : '') + r.balance24h.net); NM.show(null, null);
  } catch(e) { alert('خطا: ' + e.message); }
};

NM._noteSheet = function(patientId) {
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📝 یادداشت پرستاری</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>دسته</label><select id="nm_noteCat"><option value="observation">مشاهده</option><option value="concern">نگرانی</option><option value="wound">زخم</option><option value="mobility">تحرک</option><option value="education">آموزش</option><option value="other">سایر</option></select></div>';
  h += '<div class="wf-field"><label>متن *</label><textarea id="nm_noteText" rows="4"></textarea></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nursingMode._submitNote(\'' + patientId + '\')">✅ ثبت</button>';
  NM._openSheet(h);
};

NM._submitNote = async function(patientId) {
  const text = document.getElementById('nm_noteText').value.trim();
  if (!text) return alert('متن لازم');
  try {
    await NM._api('/api/nurse/quick/note', { method:'POST', body: JSON.stringify({ patientId, text, category: document.getElementById('nm_noteCat').value }) });
    NM._closeAll(); NABZ._toast('✅ ثبت شد'); NM.show(null, null);
  } catch(e) { alert('خطا: ' + e.message); }
};

NM._openPatient = async function(patientId) {
  try {
    const d = await NM._api('/api/nurse/patients/' + patientId);
    const p = d.patient;
    let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🩺 ' + NM._esc(p.name) + '</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div class="card" style="margin-bottom:10px;background:linear-gradient(135deg,rgba(6,182,212,.1),rgba(139,92,246,.05))">';
    h += '<div style="font-weight:900;font-size:14px">' + NM._esc(p.name) + '</div>';
    h += '<div style="font-size:11px;color:var(--fg-2)">' + (p.age||'?') + ' سال · ' + NM._esc(p.ward) + ' · تخت ' + NM._esc(p.bed||'') + '</div>';
    if (p.diagnosis) h += '<div style="font-size:11.5px;margin-top:4px;font-weight:700">' + NM._esc(p.diagnosis) + '</div>';
    if (p.allergies && p.allergies.length) h += '<div style="font-size:11px;color:var(--dng);margin-top:4px;font-weight:900">⚠️ ' + NM._esc(p.allergies.join('، ')) + '</div>';
    h += '</div>';
    if (d.isolation) h += '<div class="hint warn" style="margin-bottom:6px">🧼 ایزولاسیون ' + NM._esc(d.isolation.type) + '</div>';
    if (d.sepsisActive) h += '<div class="hint danger" style="margin-bottom:6px">🦠 سپسیس فعال</div>';
    if (d.tasks.length > 0) {
      h += '<div style="font-size:11.5px;font-weight:900;color:var(--primary);margin:10px 0 6px">📋 ' + d.tasks.length + ' وظیفه</div>';
      d.tasks.forEach(t => {
        const cls = t.priority === 'critical' ? 'dng' : t.priority === 'high' ? 'warn' : 'info';
        h += '<div style="padding:8px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;font-size:11.5px;border-right:3px solid var(--' + cls + ')"><b>' + NM._esc(t.title) + '</b>';
        if (t.subtitle) h += '<div style="font-size:10.5px;color:var(--fg-2)">' + NM._esc(t.subtitle) + '</div>';
        h += '</div>';
      });
    }
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;margin-top:12px;margin-bottom:20px">';
    h += '<button class="btn" style="padding:10px;font-size:10px;flex-direction:column;display:flex;align-items:center;gap:3px" onclick="NABZ.nursingMode._closeAll();NABZ.nursingMode._vitalsSheet(\'' + p.id + '\')"><span style="font-size:20px">📈</span>ویتال</button>';
    h += '<button class="btn" style="padding:10px;font-size:10px;flex-direction:column;display:flex;align-items:center;gap:3px" onclick="NABZ.nursingMode._closeAll();NABZ.nursingMode._ioSheet(\'' + p.id + '\')"><span style="font-size:20px">💧</span>I/O</button>';
    h += '<button class="btn" style="padding:10px;font-size:10px;flex-direction:column;display:flex;align-items:center;gap:3px" onclick="NABZ.nursingMode._closeAll();NABZ.nursingMode._noteSheet(\'' + p.id + '\')"><span style="font-size:20px">📝</span>یادداشت</button>';
    h += '<button class="btn" style="padding:10px;font-size:10px;flex-direction:column;display:flex;align-items:center;gap:3px" onclick="NABZ.nursingMode._closeAll();NABZ.showItem(\'clinical.patients\',\'' + p.id + '\')"><span style="font-size:20px">📂</span>پرونده</button>';
    h += '</div>';
    NM._openSheet(h);
  } catch(e) { alert('خطا: ' + e.message); }
};

NM._liveSubscribed = false;
NM._subscribeLive = function() {
  if (NM._liveSubscribed) return;
  if (!window.Live || typeof Live.on !== 'function') return;
  const events = ['vitals.recorded','kardex.mar.given','kardex.mar.refused','kardex.mar.missed','nursing.note.recorded','kardex.io.recorded','lab.critical','sepsis.suspected','patients.created','patients.discharged'];
  events.forEach(evt => { Live.on(evt, () => { if (NABZ.state.current === 'nursing_mode.shift' && !document.querySelector('.bs-backdrop')) NM.show(null, null); }); });
  NM._liveSubscribed = true;
};

let tries = 0;
(function tryReg() {
  if (window.NABZ && typeof NABZ.registerKind === 'function') {
    NABZ.nursingMode = NM;
    NABZ.registerKind('nursing_mode', (p, d) => NM.show(p, d));
    console.log('[nursing-mode-ui] loaded ✓');
    return;
  }
  if (++tries > 60) return console.warn('[nursing-mode-ui] timeout');
  setTimeout(tryReg, 100);
})();
})();
