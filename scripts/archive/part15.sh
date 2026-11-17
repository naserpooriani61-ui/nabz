
# ═══════════════════════════════════════════════════════════════
#  Part 15 — Admission & Discharge Pipeline
# ═══════════════════════════════════════════════════════════════

# ─── ۱) modules/flow.js ───
cat > modules/flow.js << 'EOF'
'use strict';
const { h, sd } = require('../core/mod-helpers');
const sina = require('../core/sina');

function today() { return new Date().toISOString().slice(0, 10); }

function computeNews(v) {
  let t = 0;
  const rr = Number(v.rr) || 0;
  if (rr) t += rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3;
  const spo2 = Number(v.spo2) || 0;
  if (spo2) t += spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0;
  const sbp = Number(v.bp_sys) || 0;
  if (sbp) t += sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3;
  const hr = Number(v.hr) || 0;
  if (hr) t += hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3;
  const temp = Number(v.temp) || 0;
  if (temp) t += temp <= 35 ? 3 : temp <= 36 ? 1 : temp <= 38 ? 0 : temp <= 39 ? 1 : 2;
  const risk = t >= 7 ? 'critical' : t >= 5 ? 'high' : t >= 1 ? 'medium' : 'low';
  return { total: t, risk };
}

// ─── Available beds grouped by ward ───
function availableBeds(ctx) {
  const beds = h(ctx, 'beds').filter(b => b.status === 'available');
  const wardMap = {};
  for (const w of sina.WARDS) wardMap[w.code] = w;
  const groups = {};
  for (const b of beds) {
    const w = wardMap[b.wardCode] || { code: b.wardCode, label: b.wardCode, group: 'other', headNurse: '—' };
    if (!groups[w.group]) groups[w.group] = { group: w.group, wards: {} };
    if (!groups[w.group].wards[w.code]) {
      groups[w.group].wards[w.code] = {
        code: w.code, label: w.label, headNurse: w.headNurse || '—',
        beds: []
      };
    }
    groups[w.group].wards[w.code].beds.push({ id: b.id, bedNumber: b.bedNumber, isCritical: !!b.isCritical });
  }
  return {
    groups: Object.values(groups).map(g => ({
      group: g.group,
      wards: Object.values(g.wards).sort((a, b) => b.beds.length - a.beds.length)
    })),
    totalAvailable: beds.length
  };
}

// ─── Admit patient ───
function admit(ctx) {
  const b = ctx.body || {};
  if (!b.bedId) throw ctx.E.badRequest('bed_required');
  if (!b.firstName || !b.lastName) throw ctx.E.badRequest('name_required');
  if (!b.sex) throw ctx.E.badRequest('sex_required');

  const bed = ctx.store.get('beds', b.bedId);
  if (!bed) throw ctx.E.notFound('bed_not_found');
  if (bed.status !== 'available') throw ctx.E.conflict('bed_not_available');

  const mrn = (b.mrn || 'MRN-' + Date.now().toString(36).toUpperCase().slice(-6)).trim();
  const patient = {
    id: ctx.uid('pat'),
    mrn,
    firstName: b.firstName.trim(),
    lastName: b.lastName.trim(),
    age: b.age ? Number(b.age) : null,
    sex: b.sex,
    wardCode: bed.wardCode,
    bedId: bed.id,
    bedNumber: bed.bedNumber,
    diagnosis: (b.diagnosis || '').trim(),
    comorbidities: Array.isArray(b.comorbidities) ? b.comorbidities : [],
    allergies: Array.isArray(b.allergies) ? b.allergies : [],
    codeStatus: b.codeStatus || 'full',
    admissionType: b.admissionType || 'elective',
    status: 'in_care',
    admittedAt: ctx.now(),
    admittedBy: ctx.actor.id,
    admittedByName: ctx.actor.username,
    createdAt: ctx.now()
  };

  ctx.store.put('patients', patient);
  bed.status = 'occupied';
  bed.patientId = patient.id;
  ctx.store.put('beds', bed);

  // Initial vitals (if provided)
  let vitalsId = null;
  if (b.vitals && (b.vitals.hr || b.vitals.bp_sys || b.vitals.spo2 || b.vitals.temp || b.vitals.rr)) {
    const news = computeNews(b.vitals);
    const vit = {
      id: ctx.uid('vit'),
      patientId: patient.id,
      patientName: patient.firstName + ' ' + patient.lastName,
      wardCode: bed.wardCode,
      bedNumber: bed.bedNumber,
      recordedAt: ctx.now(),
      recordedBy: ctx.actor.id,
      hr: Number(b.vitals.hr) || null,
      bp_sys: Number(b.vitals.bp_sys) || null,
      bp_dia: Number(b.vitals.bp_dia) || null,
      rr: Number(b.vitals.rr) || null,
      temp: Number(b.vitals.temp) || null,
      spo2: Number(b.vitals.spo2) || null,
      onOxygen: !!b.vitals.onOxygen,
      gcs: 15,
      consciousness: 'alert',
      news2: news.total,
      newsLevel: news.risk,
      notes: 'ثبت اولیه پذیرش'
    };
    ctx.store.put('vitals', vit);
    vitalsId = vit.id;
  }

  // Auto-assign to current nurse
  let assignmentId = null;
  if (['nurse', 'nurse_aide', 'assistant_nurse'].includes(ctx.actor.role)) {
    const date = today();
    let shift = h(ctx, 'shift_assignments').find(s =>
      s.date === date && s.wardCode === bed.wardCode && s.status !== 'closed');
    if (!shift) {
      shift = {
        id: ctx.uid('shf'), date,
        wardCode: bed.wardCode, shift: 'morning',
        status: 'open', assignments: [],
        createdAt: ctx.now()
      };
    }
    const asg = {
      id: ctx.uid('asg'),
      patientId: patient.id,
      patientName: patient.firstName + ' ' + patient.lastName,
      bedNumber: bed.bedNumber,
      nurseId: ctx.actor.id,
      nurseName: ctx.actor.username,
      role: 'primary',
      status: 'accepted',
      assignedAt: ctx.now()
    };
    shift.assignments = shift.assignments || [];
    shift.assignments.push(asg);
    ctx.store.put('shift_assignments', shift);
    assignmentId = asg.id;
  }

  ctx.audit.write('flow', 'admit', patient.id, ctx.actor, {
    bedId: bed.id, ward: bed.wardCode, vitalsId, assignmentId
  });
  ctx.bus.emit('patients.created', { record: patient, actor: ctx.actor });
  if (vitalsId) ctx.bus.emit('vitals.recorded', { record: ctx.store.get('vitals', vitalsId), actor: ctx.actor });

  return { patient, vitalsId, assignmentId };
}

// ─── Discharge patient ───
function discharge(ctx) {
  const pid = ctx.params.patientId;
  const b = ctx.body || {};
  const p = ctx.store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  if (p.status === 'discharged') throw ctx.E.conflict('already_discharged');

  const dischargeType = b.dischargeType || 'home';
  const reason = (b.reason || '').trim();

  // Create discharge record
  const plan = {
    id: ctx.uid('dsc'),
    patientId: p.id,
    patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode,
    status: 'completed',
    dischargeType,
    reason,
    summary: {
      finalDiagnosis: p.diagnosis || '',
      medications: [],
      followupInstructions: b.followupInstructions || ''
    },
    plannedAt: ctx.now(),
    plannedBy: ctx.actor.id,
    completedAt: ctx.now(),
    completedBy: ctx.actor.id,
    completedByName: ctx.actor.username
  };
  ctx.store.put('discharges', plan);

  // Free the bed → cleaning
  if (p.bedId) {
    const bed = ctx.store.get('beds', p.bedId);
    if (bed) {
      bed.status = 'cleaning';
      bed.patientId = null;
      ctx.store.put('beds', bed);
    }
  }

  // Update patient
  p.status = 'discharged';
  p.dischargedAt = ctx.now();
  p.dischargedBy = ctx.actor.id;
  p.dischargeType = dischargeType;
  p.dischargeReason = reason;
  ctx.store.put('patients', p);

  ctx.audit.write('flow', 'discharge', p.id, ctx.actor, {
    dischargeType, bedId: p.bedId, wardCode: p.wardCode
  });
  ctx.bus.emit('patients.discharged', { record: p, actor: ctx.actor });

  return { patient: p, plan };
}

// ─── Pipeline stats ───
function pipeline(ctx) {
  const date = today();
  const patients = h(ctx, 'patients');
  const admits = patients.filter(p => (p.admittedAt || '').slice(0, 10) === date);
  const discharges = h(ctx, 'discharges').filter(d => (d.completedAt || '').slice(0, 10) === date);
  const active = patients.filter(p => ['in_care','admitted'].includes(p.status));
  const byWard = {};
  for (const p of active) {
    if (!byWard[p.wardCode]) byWard[p.wardCode] = 0;
    byWard[p.wardCode]++;
  }
  return {
    date,
    admissionsToday: admits.length,
    dischargesToday: discharges.length,
    activePatients: active.length,
    byWard,
    recentAdmits: admits.sort((a, b) => sd(b.admittedAt) - sd(a.admittedAt)).slice(0, 10).map(p => ({
      id: p.id, name: p.firstName + ' ' + p.lastName, ward: p.wardCode, bed: p.bedNumber,
      at: p.admittedAt, admittedBy: p.admittedByName
    })),
    recentDischarges: discharges.sort((a, b) => sd(b.completedAt) - sd(a.completedAt)).slice(0, 10).map(d => ({
      id: d.id, patientId: d.patientId, name: d.patientName, ward: d.wardCode,
      at: d.completedAt, by: d.completedByName, type: d.dischargeType
    }))
  };
}

module.exports = {
  handlers: { availableBeds, admit, discharge, pipeline },
  routes: [
    { method: 'GET',  path: '/api/flow/available-beds', handler: 'availableBeds', perm: 'patients.view' },
    { method: 'POST', path: '/api/flow/admit', handler: 'admit', perm: 'patients.create' },
    { method: 'POST', path: '/api/flow/discharge/:patientId', handler: 'discharge', perm: 'patients.update' },
    { method: 'GET',  path: '/api/flow/pipeline', handler: 'pipeline', perm: 'patients.view' }
  ],
  panels: [
    { id:'pipeline', title:'جریان بیمار', icon:'🔄', perm:'patients.view', kind:'pipeline', api:'/api/flow/pipeline' }
  ]
};
EOF
echo "✅ flow.js — 4 endpoints"

# ─── ۲) Add patients actions to actions.js ───
node << 'ACTIONS'
const fs = require('fs');
let s = fs.readFileSync('modules/actions.js', 'utf8');
if (!s.includes('patients: [')) {
  // Find the const A = { and insert patients first
  s = s.replace('const A = {', `const A = {
  patients: [
    { from: ['in_care','admitted'], to: 'discharge', label: '🚪 ترخیص', perm: 'patients.update', method: 'POST', path: '/api/flow/discharge/{id}', requires: { dischargeType: 'select:home,transfer,ama,expired', reason: 'text', followupInstructions: 'text' } },
    { from: ['in_care','admitted'], to: 'transfer', label: '🔄 انتقال', perm: 'patients.transfer', method: 'POST', path: '/api/wf/transfers', requires: { toWard: 'text', reason: 'text' } }
  ],`);
  fs.writeFileSync('modules/actions.js', s);
  console.log('✅ A.patients added (discharge + transfer)');
} else {
  console.log('⚠️ A.patients already exists');
}
ACTIONS

# ─── ۳) Frontend flow.js ───
cat > public/flow.js << 'EOF'
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
EOF
echo "✅ flow.js frontend — 4-step wizard"

# ─── ۴) CSS ───
cat >> public/style.css << 'CSS'

/* ═══════════════════════════════════════════════════════════
   Admission Wizard
   ═══════════════════════════════════════════════════════════ */
.adm-steps{
  display:flex;justify-content:center;gap:8px;
  margin-bottom:20px;
}
.adm-step{
  display:flex;align-items:center;
}
.adm-step:not(:last-child)::after{
  content:'';width:20px;height:2px;background:var(--border);margin:0 4px;
}
.adm-step.done:not(:last-child)::after{background:var(--primary)}
.adm-step.active:not(:last-child)::after{background:var(--border)}
.adm-step-num{
  width:32px;height:32px;border-radius:50%;
  display:grid;place-items:center;
  font-size:12px;font-weight:900;
  background:var(--bg-3);color:var(--fg-2);
  border:2px solid var(--border);
  transition:all 0.2s;
}
.adm-step.done .adm-step-num{background:var(--ok);color:#fff;border-color:var(--ok)}
.adm-step.active .adm-step-num{background:var(--primary);color:#fff;border-color:var(--primary);box-shadow:0 0 0 4px var(--primary-soft)}

.adm-nav{
  display:flex;gap:8px;margin-top:20px;
}
.adm-nav .btn{flex:1;padding:14px}

.adm-group-hd{
  font-size:11px;font-weight:900;color:var(--fg-2);
  margin:14px 0 6px;
  padding-bottom:4px;
  border-bottom:1px solid var(--border);
}

.adm-ward{
  width:100%;
  display:flex;align-items:center;gap:12px;
  padding:14px;
  background:var(--g-elev);
  border:1px solid var(--border);
  border-radius:12px;
  margin-bottom:6px;
  cursor:pointer;
  font-family:inherit;
  color:var(--fg);
  text-align:right;
  transition:all 0.15s;
}
.adm-ward:active{transform:scale(0.98);background:var(--bg-3);border-color:var(--primary)}

.adm-bed-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(80px,1fr));
  gap:8px;
}
.adm-bed{
  display:flex;flex-direction:column;align-items:center;gap:4px;
  padding:12px 6px;
  background:var(--g-elev);
  border:2px solid var(--border);
  border-radius:10px;
  cursor:pointer;
  font-family:inherit;
  color:var(--fg);
  transition:all 0.15s;
}
.adm-bed:active{transform:scale(0.95)}
.adm-bed.selected{
  border-color:var(--primary);
  background:linear-gradient(135deg,rgba(6,182,212,0.15),rgba(16,185,129,0.08));
  box-shadow:0 0 0 4px var(--primary-soft);
}

.adm-row-2{
  display:grid;grid-template-columns:1fr 1fr;gap:10px;
}
.adm-row-3{
  display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;
}
CSS
echo "✅ CSS admission wizard"

# ─── ۵) Patch app.js ───
node << 'APP'
const fs = require('fs');
let s = fs.readFileSync('public/app.js', 'utf8');
let changed = 0;

// 5.1) Delegate pipeline kind
if (!s.includes("p.kind === 'pipeline'")) {
  const old = "if (p.kind === 'action') renderAction(p, d);";
  const neu = "if (p.kind === 'action') renderAction(p, d);\n      else if (p.kind === 'pipeline' && NABZ.showPipeline) await NABZ.showPipeline(p, d);";
  s = s.replace(old, neu);
  if (s.includes("p.kind === 'pipeline'")) {
    console.log('✅ 5.1 pipeline kind');
    changed++;
  }
}

// 5.2) Add admission button to patients list + addons map
if (!s.includes('PANEL_ADDONS')) {
  const addonCode = `
const PANEL_ADDONS = {
  'clinical.patients': { label: '➕ پذیرش بیمار', fn: 'NABZ.openAdmission()' },
  'bedboard.wards': { label: '➕ پذیرش', fn: 'NABZ.openAdmission()' },
  'flow.pipeline': { label: '➕ پذیرش بیمار', fn: 'NABZ.openAdmission()' }
};
`;
  s = s.replace('const MOD_META = {', addonCode + '\nconst MOD_META = {');

  // Insert addon button in renderList, after form button
  const renderMarker = "if (p.form) {\n      h += '<div style=\"margin-bottom:10px\"><button class=\"btn btn-primary btn-block\" onclick=\"NABZ.openForm(\\'' + p.id + '\\')\">➕ جدید</button></div>';\n    }";
  if (s.includes(renderMarker)) {
    const neu = renderMarker + "\n    if (PANEL_ADDONS[p.id] && (!p.form || true)) {\n      h += '<div style=\"margin-bottom:10px\"><button class=\"btn btn-primary btn-block\" style=\"padding:14px\" onclick=\"' + PANEL_ADDONS[p.id].fn + '\">' + PANEL_ADDONS[p.id].label + '</button></div>';\n    }";
    s = s.replace(renderMarker, neu);
    if (s.includes('PANEL_ADDONS[p.id]')) {
      console.log('✅ 5.2 addon button in list');
      changed++;
    }
  } else {
    console.log('⚠️ 5.2 renderList pattern not matched');
  }
}

fs.writeFileSync('public/app.js', s);
console.log('Total changes: ' + changed);
APP

# ─── ۶) Patch index.html ───
node << 'HTML'
const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');
if (!h.includes('/flow.js')) {
  h = h.replace('<script src="/live.js"></script>', '<script src="/live.js"></script>\n<script src="/flow.js"></script>');
  fs.writeFileSync('public/index.html', h);
  console.log('✅ index.html — flow.js');
}
HTML

# ─── ۷) Add flow to home quick links ───
node << 'HOME'
const fs = require('fs');
let s = fs.readFileSync('modules/home.js', 'utf8');
if (!s.includes('flow.pipeline')) {
  s = s.replace(
    /quickLinks:\s*\[\s*\{ icon:'💾', label:'پشتیبان'/,
    "quickLinks: [\n      { icon:'🔄', label:'جریان', action:\"NABZ.show('flow.pipeline')\" },\n      { icon:'💾', label:'پشتیبان'"
  );
  fs.writeFileSync('modules/home.js', s);
  console.log('✅ home — flow quick link');
}
HOME

# ─── ۸) Add flow to drawer ───
node << 'META'
const fs = require('fs');
let s = fs.readFileSync('public/app.js', 'utf8');
if (!s.includes('flow:{')) {
  s = s.replace("const MOD_META = {", "const MOD_META = {\n    flow:{l:'جریان بیمار',i:'🔄'},");
  s = s.replace(/(const modOrder\s*=\s*\[)/, "$1'flow',");
  fs.writeFileSync('public/app.js', s);
  console.log('✅ flow in drawer');
}
META

# ─── ۹) Verify ───
echo ""
echo "─── Verify ───"
node -e "require('./modules/flow.js')" && echo "✅ flow backend OK"
node -e "require('./modules/actions.js')" && echo "✅ actions OK"
node -e "new Function(require('fs').readFileSync('public/flow.js','utf8'))" && echo "✅ flow frontend OK"
node -e "new Function(require('fs').readFileSync('public/app.js','utf8'))" && echo "✅ app OK"

for pid in $(pgrep -f "core/server.js" 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done
sleep 1

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ Part 15 — Admission & Discharge         ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "New: 4 endpoints"
echo "  GET  /api/flow/available-beds"
echo "  POST /api/flow/admit"
echo "  POST /api/flow/discharge/:patientId"
echo "  GET  /api/flow/pipeline"
echo ""
echo "Next:"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
