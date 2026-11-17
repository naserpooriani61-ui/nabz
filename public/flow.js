// ═══════════════════════════════════════════════════════════
//  NABZ Flow — Admission Wizard + Pipeline
// ═══════════════════════════════════════════════════════════

const WARD_GROUP_LABELS = {
  admin:'🏛', critical:'💔 مراقبت ویژه', emergency:'🚨 اورژانس',
  surgical:'🔪 جراحی', internal:'🏥 داخلی', neuro:'🧠 نورولوژی',
  oncology:'🎗 آنکولوژی', special:'✨ ویژه', vip:'⭐ VIP'
};

// ─── Admission Wizard ───
NABZ.openAdmission = async function() {
  try {
    const data = await NABZ._api('/api/flow/available-beds');
    if (data.totalAvailable === 0) {
      alert('❌ هیچ تخت آزادی نیست. ابتدا تخت‌ها را آزاد کنید.');
      return;
    }
    NABZ._admissionState = {
      step: 1,
      bedsData: data,
      selectedWard: null,
      selectedBed: null,
      patient: {},
      vitals: {}
    };
    NABZ._renderAdmissionStep();
  } catch (e) { alert('خطا: ' + e.message); }
};

NABZ._renderAdmissionStep = function() {
  const S = NABZ._admissionState;
  if (!S) return;

  // Remove existing
  const old = document.querySelector('.admission-backdrop');
  if (old) old.remove();

  const sheet = document.createElement('div');
  sheet.className = 'bs-backdrop admission-backdrop';
  sheet.onclick = e => { if (e.target === sheet) { sheet.remove(); NABZ._admissionState = null; } };

  const stepLabels = { 1: 'انتخاب تخت', 2: 'اطلاعات بیمار', 3: 'ویتال (اختیاری)', 4: 'بازبینی' };
  let html = '<div class="bs-handle"></div>';
  html += '<div class="bs-hd"><div class="bs-title">➕ پذیرش بیمار — ' + stepLabels[S.step] + '</div>';
  html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove();NABZ._admissionState=null">✕</button></div>';

  // Progress
  html += '<div class="adm-steps">';
  for (let i = 1; i <= 4; i++) {
    html += '<div class="adm-step ' + (i < S.step ? 'done' : i === S.step ? 'active' : '') + '">' +
      '<div class="adm-step-num">' + (i < S.step ? '✓' : i) + '</div></div>';
  }
  html += '</div>';

  if (S.step === 1) html += NABZ._renderStepBed();
  else if (S.step === 2) html += NABZ._renderStepInfo();
  else if (S.step === 3) html += NABZ._renderStepVitals();
  else if (S.step === 4) html += NABZ._renderStepReview();

  // Nav
  html += '<div class="adm-nav">';
  if (S.step > 1) {
    html += '<button class="btn" onclick="NABZ._admPrev()" style="flex:0 0 40%">← قبلی</button>';
  }
  if (S.step < 4) {
    html += '<button class="btn btn-primary" onclick="NABZ._admNext()" style="flex:1" ' + (S.step === 1 && !S.selectedBed ? 'disabled' : '') + '>ادامه →</button>';
  } else {
    html += '<button class="btn btn-ok" onclick="NABZ._admSubmit()" style="flex:1;padding:14px">✅ پذیرش نهایی</button>';
  }
  html += '</div>';

  const c = document.createElement('div');
  c.className = 'bs-sheet';
  c.style.maxHeight = '94vh';
  c.innerHTML = html;
  sheet.appendChild(c);
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('show'));
};

NABZ._renderStepBed = function() {
  const S = NABZ._admissionState;
  let h = '';
  if (S.selectedWard) {
    const ward = NABZ._findWard(S.selectedWard);
    if (!ward) { S.selectedWard = null; return NABZ._renderStepBed(); }
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">';
    h += '<button class="btn" style="padding:6px 12px;font-size:12px" onclick="NABZ._admBackToWards()">←</button>';
    h += '<div style="flex:1"><div style="font-weight:900;font-size:14px">' + NABZ._esc(ward.label) + '</div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2)">سرپرستار: ' + NABZ._esc(ward.headNurse) + ' · ' + ward.beds.length + ' تخت آزاد</div></div>';
    h += '</div>';
    h += '<div class="adm-bed-grid">';
    for (const b of ward.beds) {
      const sel = S.selectedBed === b.id;
      h += '<button class="adm-bed ' + (sel ? 'selected' : '') + '" onclick="NABZ._admPickBed(\'' + b.id + '\')">';
      h += '<div style="font-size:16px">🛏️</div>';
      h += '<div style="font-size:10px;font-weight:800">' + NABZ._esc(b.bedNumber) + '</div>';
      h += '</button>';
    }
    h += '</div>';
  } else {
    h += '<div style="font-size:12px;color:var(--fg-2);margin-bottom:10px">' + S.bedsData.totalAvailable + ' تخت آزاد — بخش انتخاب کنید</div>';
    for (const g of S.bedsData.groups) {
      h += '<div class="adm-group-hd">' + (WARD_GROUP_LABELS[g.group] || g.group) + '</div>';
      for (const w of g.wards) {
        h += '<button class="adm-ward" onclick="NABZ._admPickWard(\'' + w.code + '\')">';
        h += '<div style="flex:1;text-align:right">';
        h += '<div style="font-weight:900;font-size:13px">' + NABZ._esc(w.label) + '</div>';
        h += '<div style="font-size:10.5px;color:var(--fg-2)">' + NABZ._esc(w.headNurse) + '</div>';
        h += '</div>';
        h += '<div style="text-align:center;min-width:50px"><div style="font-size:18px;font-weight:900;color:var(--ok)">' + w.beds.length + '</div><div style="font-size:9px;color:var(--fg-2)">آزاد</div></div>';
        h += '</button>';
      }
    }
  }
  return h;
};

NABZ._findWard = function(code) {
  for (const g of NABZ._admissionState.bedsData.groups) {
    for (const w of g.wards) {
      if (w.code === code) return w;
    }
  }
  return null;
};

NABZ._admPickWard = function(code) {
  NABZ._admissionState.selectedWard = code;
  NABZ._admissionState.selectedBed = null;
  NABZ._renderAdmissionStep();
};

NABZ._admBackToWards = function() {
  NABZ._admissionState.selectedWard = null;
  NABZ._admissionState.selectedBed = null;
  NABZ._renderAdmissionStep();
};

NABZ._admPickBed = function(id) {
  NABZ._admissionState.selectedBed = id;
  NABZ._renderAdmissionStep();
};

NABZ._renderStepInfo = function() {
  const p = NABZ._admissionState.patient;
  let h = '';
  h += '<div class="bs-form">';
  h += '<div class="adm-row-2"><div class="bs-field"><label>نام *</label><input id="admFirst" value="' + NABZ._esc(p.firstName || '') + '" required></div>';
  h += '<div class="bs-field"><label>نام خانوادگی *</label><input id="admLast" value="' + NABZ._esc(p.lastName || '') + '" required></div></div>';
  h += '<div class="adm-row-2"><div class="bs-field"><label>سن</label><input id="admAge" type="number" value="' + (p.age || '') + '"></div>';
  h += '<div class="bs-field"><label>جنسیت *</label><select id="admSex"><option value="male"' + (p.sex === 'male' ? ' selected' : '') + '>مرد</option><option value="female"' + (p.sex === 'female' ? ' selected' : '') + '>زن</option></select></div></div>';
  h += '<div class="bs-field"><label>تشخیص</label><input id="admDx" value="' + NABZ._esc(p.diagnosis || '') + '" placeholder="مثلاً: پنومونی"></div>';
  h += '<div class="bs-field"><label>بیماری‌های همراه (با کاما)</label><input id="admComorb" value="' + NABZ._esc((p.comorbidities || []).join(', ')) + '" placeholder="HTN, DM"></div>';
  h += '<div class="bs-field"><label>آلرژی‌ها (با کاما)</label><input id="admAllergy" value="' + NABZ._esc((p.allergies || []).join(', ')) + '" placeholder="Penicillin"></div>';
  h += '<div class="adm-row-2"><div class="bs-field"><label>وضعیت کد</label><select id="admCode">' +
    '<option value="full"' + (p.codeStatus === 'full' ? ' selected' : '') + '>Full</option>' +
    '<option value="dnr"' + (p.codeStatus === 'dnr' ? ' selected' : '') + '>DNR</option>' +
    '<option value="dni"' + (p.codeStatus === 'dni' ? ' selected' : '') + '>DNI</option></select></div>';
  h += '<div class="bs-field"><label>نوع پذیرش</label><select id="admType">' +
    '<option value="elective"' + (p.admissionType === 'elective' ? ' selected' : '') + '>الکتیو</option>' +
    '<option value="emergency"' + (p.admissionType === 'emergency' ? ' selected' : '') + '>اورژانسی</option>' +
    '<option value="transfer"' + (p.admissionType === 'transfer' ? ' selected' : '') + '>انتقالی</option></select></div></div>';
  h += '</div>';
  return h;
};

NABZ._renderStepVitals = function() {
  const v = NABZ._admissionState.vitals;
  let h = '<div style="font-size:11.5px;color:var(--fg-2);margin-bottom:12px;line-height:1.6">اگر خالی بگذارید، ثبت اولیه انجام نمی‌شود و بعداً می‌توانید اضافه کنید.</div>';
  h += '<div class="bs-form">';
  h += '<div class="adm-row-3">';
  h += '<div class="bs-field"><label>HR</label><input id="vHR" type="number" value="' + (v.hr || '') + '"></div>';
  h += '<div class="bs-field"><label>RR</label><input id="vRR" type="number" value="' + (v.rr || '') + '"></div>';
  h += '<div class="bs-field"><label>SpO₂%</label><input id="vSPO2" type="number" value="' + (v.spo2 || '') + '"></div>';
  h += '</div>';
  h += '<div class="adm-row-3">';
  h += '<div class="bs-field"><label>SBP</label><input id="vSBP" type="number" value="' + (v.bp_sys || '') + '"></div>';
  h += '<div class="bs-field"><label>DBP</label><input id="vDBP" type="number" value="' + (v.bp_dia || '') + '"></div>';
  h += '<div class="bs-field"><label>Temp°C</label><input id="vTEMP" type="number" step="0.1" value="' + (v.temp || '') + '"></div>';
  h += '</div>';
  h += '<label style="display:flex;gap:10px;padding:12px;background:var(--bg-2);border-radius:10px;font-size:12.5px;cursor:pointer"><input type="checkbox" id="vO2" ' + (v.onOxygen ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:var(--primary)"><span>اکسیژن مکمل</span></label>';
  h += '</div>';
  return h;
};

NABZ._renderStepReview = function() {
  const S = NABZ._admissionState;
  const ward = NABZ._findWard(S.selectedWard);
  const bed = ward ? ward.beds.find(b => b.id === S.selectedBed) : null;
  const p = S.patient;
  const v = S.vitals;

  let h = '<div style="background:linear-gradient(135deg,rgba(6,182,212,0.1),rgba(16,185,129,0.06));border:1px solid var(--primary);border-radius:12px;padding:14px;margin-bottom:16px">';
  h += '<div style="font-size:10.5px;font-weight:900;color:var(--primary);margin-bottom:8px">📋 خلاصه پذیرش</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px">';
  h += '<div><div style="color:var(--fg-2);font-size:10px">نام</div><div style="font-weight:900">' + NABZ._esc((p.firstName||'') + ' ' + (p.lastName||'')) + '</div></div>';
  h += '<div><div style="color:var(--fg-2);font-size:10px">سن/جنسیت</div><div style="font-weight:900">' + (p.age||'—') + ' سال · ' + (p.sex === 'female' ? 'زن' : 'مرد') + '</div></div>';
  h += '<div><div style="color:var(--fg-2);font-size:10px">بخش</div><div style="font-weight:900">' + NABZ._esc(ward ? ward.label : '?') + '</div></div>';
  h += '<div><div style="color:var(--fg-2);font-size:10px">تخت</div><div style="font-weight:900">' + NABZ._esc(bed ? bed.bedNumber : '?') + '</div></div>';
  if (p.diagnosis) h += '<div style="grid-column:1/-1"><div style="color:var(--fg-2);font-size:10px">تشخیص</div><div style="font-weight:900">' + NABZ._esc(p.diagnosis) + '</div></div>';
  if ((p.allergies||[]).length) h += '<div style="grid-column:1/-1"><div style="color:var(--dng);font-size:10px;font-weight:900">⚠️ آلرژی</div><div style="color:var(--dng);font-weight:900">' + NABZ._esc(p.allergies.join('، ')) + '</div></div>';
  h += '</div></div>';

  if (v.hr || v.bp_sys || v.spo2 || v.temp) {
    h += '<div style="background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px">';
    h += '<div style="font-size:10.5px;font-weight:900;color:var(--fg-2);margin-bottom:6px">📈 ویتال اولیه</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:11.5px;text-align:center">';
    if (v.hr) h += '<div><div style="font-weight:900">' + v.hr + '</div><div style="font-size:9px;color:var(--fg-2)">HR</div></div>';
    if (v.bp_sys) h += '<div><div style="font-weight:900">' + v.bp_sys + '/' + (v.bp_dia||'—') + '</div><div style="font-size:9px;color:var(--fg-2)">BP</div></div>';
    if (v.spo2) h += '<div><div style="font-weight:900">' + v.spo2 + '%</div><div style="font-size:9px;color:var(--fg-2)">SpO₂</div></div>';
    if (v.rr) h += '<div><div style="font-weight:900">' + v.rr + '</div><div style="font-size:9px;color:var(--fg-2)">RR</div></div>';
    if (v.temp) h += '<div><div style="font-weight:900">' + v.temp + '°</div><div style="font-size:9px;color:var(--fg-2)">Temp</div></div>';
    h += '</div></div>';
  }

  h += '<div style="background:rgba(245,158,11,0.1);border:1px solid var(--warn);border-radius:10px;padding:12px;font-size:11.5px;line-height:1.6;color:#92400e">⚠️ با تأیید، تخت اشغال می‌شود و بیمار در سیستم ثبت می‌گردد.</div>';
  return h;
};

NABZ._admPrev = function() {
  if (NABZ._admissionState.step > 1) {
    // Save current step data before going back
    if (NABZ._admissionState.step === 2) NABZ._admSaveInfo();
    else if (NABZ._admissionState.step === 3) NABZ._admSaveVitals();
    NABZ._admissionState.step--;
    NABZ._renderAdmissionStep();
  }
};

NABZ._admNext = function() {
  const S = NABZ._admissionState;
  if (S.step === 2) {
    if (!NABZ._admSaveInfo()) return;
  } else if (S.step === 3) {
    NABZ._admSaveVitals();
  }
  S.step++;
  NABZ._renderAdmissionStep();
};

NABZ._admSaveInfo = function() {
  const g = id => document.getElementById(id)?.value?.trim() || '';
  const first = g('admFirst'), last = g('admLast');
  if (!first || !last) { alert('نام و نام خانوادگی الزامی است'); return false; }
  NABZ._admissionState.patient = {
    firstName: first,
    lastName: last,
    age: g('admAge') ? Number(g('admAge')) : null,
    sex: document.getElementById('admSex').value,
    diagnosis: g('admDx'),
    comorbidities: g('admComorb').split(',').map(x => x.trim()).filter(Boolean),
    allergies: g('admAllergy').split(',').map(x => x.trim()).filter(Boolean),
    codeStatus: document.getElementById('admCode').value,
    admissionType: document.getElementById('admType').value
  };
  return true;
};

NABZ._admSaveVitals = function() {
  const g = id => document.getElementById(id)?.value;
  NABZ._admissionState.vitals = {
    hr: g('vHR') ? Number(g('vHR')) : null,
    rr: g('vRR') ? Number(g('vRR')) : null,
    bp_sys: g('vSBP') ? Number(g('vSBP')) : null,
    bp_dia: g('vDBP') ? Number(g('vDBP')) : null,
    spo2: g('vSPO2') ? Number(g('vSPO2')) : null,
    temp: g('vTEMP') ? Number(g('vTEMP')) : null,
    onOxygen: document.getElementById('vO2')?.checked || false
  };
};

NABZ._admSubmit = async function() {
  const S = NABZ._admissionState;
  try {
    NABZ._toast('در حال ثبت پذیرش...');
    const result = await NABZ._api('/api/flow/admit', {
      method: 'POST',
      body: JSON.stringify({
        bedId: S.selectedBed,
        ...S.patient,
        vitals: S.vitals
      })
    });
    NABZ._toast('✅ بیمار پذیرش شد — MRN: ' + result.patient.mrn);
    if (navigator.vibrate) try { navigator.vibrate([100, 60, 100]); } catch (_) {}

    // Close wizard
    const bd = document.querySelector('.admission-backdrop');
    if (bd) bd.remove();
    NABZ._admissionState = null;

    // Refresh patients list
    setTimeout(() => {
      if (NABZ.state.current === 'clinical.patients') NABZ.show('clinical.patients');
      else NABZ.show('clinical.patients');
    }, 300);
  } catch (e) {
    alert('❌ ' + e.message);
  }
};

// ─── Pipeline view ───
NABZ.showPipeline = async function(p, d) {
  if (!d) d = await NABZ._api('/api/flow/pipeline');
  let h = '<div class="sec-hd"><span>🔄 جریان بیمار</span><span style="font-size:11px;color:var(--fg-2)">' + d.date + '</span></div>';

  h += '<div class="grid-4" style="margin-bottom:16px">';
  h += '<div class="stat ok"><div class="v">' + d.admissionsToday + '</div><div class="l">پذیرش امروز</div></div>';
  h += '<div class="stat warn"><div class="v">' + d.dischargesToday + '</div><div class="l">ترخیص امروز</div></div>';
  h += '<div class="stat"><div class="v">' + d.activePatients + '</div><div class="l">بستری فعال</div></div>';
  h += '<div class="stat"><div class="v">' + Object.keys(d.byWard).length + '</div><div class="l">بخش فعال</div></div>';
  h += '</div>';

  h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-bottom:12px" onclick="NABZ.openAdmission()">➕ پذیرش بیمار جدید</button>';

  h += '<div class="sec-hd"><span>📥 پذیرش‌های امروز</span></div>';
  if (!d.recentAdmits.length) {
    h += '<div class="empty">امروز پذیرشی ثبت نشده</div>';
  } else {
    for (const a of d.recentAdmits) {
      h += '<div class="row lo">';
      h += '<div class="row-hd"><div class="row-title">' + NABZ._esc(a.name) + '</div><span class="pill ok">' + NABZ._esc(a.ward) + '</span></div>';
      h += '<div class="row-meta">تخت ' + NABZ._esc(a.bed || '—') + ' · ' + new Date(a.at).toLocaleTimeString('fa-IR', {hour:'2-digit',minute:'2-digit'}) + ' · ' + NABZ._esc(a.admittedBy || '') + '</div>';
      h += '</div>';
    }
  }

  h += '<div class="sec-hd"><span>📤 ترخیص‌های امروز</span></div>';
  if (!d.recentDischarges.length) {
    h += '<div class="empty">امروز ترخیصی ثبت نشده</div>';
  } else {
    for (const a of d.recentDischarges) {
      h += '<div class="row md">';
      h += '<div class="row-hd"><div class="row-title">' + NABZ._esc(a.name) + '</div><span class="pill warn">' + NABZ._esc(a.type) + '</span></div>';
      h += '<div class="row-meta">' + NABZ._esc(a.ward || '') + ' · ' + new Date(a.at).toLocaleTimeString('fa-IR', {hour:'2-digit',minute:'2-digit'}) + ' · ' + NABZ._esc(a.by || '') + '</div>';
      h += '</div>';
    }
  }

  document.getElementById('content').innerHTML = h;
};
