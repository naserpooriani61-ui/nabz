
# ═══════════════════════════════════════════════════════════════
#  Part 8 — Nursing Report (NANDA + ISBAR)
# ═══════════════════════════════════════════════════════════════

# ─── ۱) ماژول backend ───
cat > modules/nursing_report.js << 'EOF'
const { h, sd, sg } = require('../core/mod-helpers');
const perms = require('../core/permissions');

const NANDA = [
  {code:'00155', domain:11, label:'خطر سقوط', risk:true},
  {code:'00047', domain:11, label:'خطر زخم فشاری', risk:true},
  {code:'00004', domain:11, label:'خطر عفونت', risk:true},
  {code:'00039', domain:11, label:'خطر آسپیراسیون', risk:true},
  {code:'00100', domain:11, label:'خطر خونریزی', risk:true},
  {code:'00035', domain:11, label:'خطر آسیب', risk:true},
  {code:'00206', domain:11, label:'خطر خودکشی', risk:true},
  {code:'00085', domain:4, label:'اختلال در تحرک'},
  {code:'00092', domain:4, label:'عدم تحمل فعالیت'},
  {code:'00095', domain:4, label:'اختلال در خواب'},
  {code:'00132', domain:12, label:'درد حاد'},
  {code:'00133', domain:12, label:'درد مزمن'},
  {code:'00134', domain:12, label:'تهوع'},
  {code:'00011', domain:3, label:'یبوست'},
  {code:'00012', domain:3, label:'اسهال'},
  {code:'00016', domain:3, label:'اختلال دفع ادرار'},
  {code:'00023', domain:3, label:'احتباس ادراری'},
  {code:'00002', domain:2, label:'تغذیه کمتر از نیاز'},
  {code:'00003', domain:2, label:'تغذیه بیش از نیاز'},
  {code:'00025', domain:2, label:'خطر عدم تعادل الکترولیت', risk:true},
  {code:'00128', domain:5, label:'گیجی حاد'},
  {code:'00126', domain:5, label:'اختلال حافظه'},
  {code:'00146', domain:9, label:'اضطراب'},
  {code:'00148', domain:9, label:'ترس'},
  {code:'00069', domain:9, label:'مقابله ناکارآمد'},
  {code:'00119', domain:6, label:'احترام به خود پایین'}
];

const DOMAINS = [
  {id:2, label:'تغذیه'},
  {id:3, label:'دفع و تبادل'},
  {id:4, label:'فعالیت و استراحت'},
  {id:5, label:'شناخت'},
  {id:6, label:'خودادراکی'},
  {id:9, label:'استرس'},
  {id:11, label:'ایمنی'},
  {id:12, label:'آسایش'}
];

const listReports = (ctx) => {
  let items = perms.scope(ctx.actor, h(ctx, 'nursing_reports'));
  if (ctx.query.status) items = items.filter(r => r.status === ctx.query.status);
  items.sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  return { items, total: items.length };
};

const getReport = (ctx) => {
  const r = ctx.store.get('nursing_reports', ctx.params.id);
  if (!r) throw ctx.E.notFound('not_found');
  return r;
};

const getNanda = () => ({ diagnoses: NANDA, domains: DOMAINS });

const getContext = (ctx) => {
  const pid = ctx.params.patientId;
  const p = ctx.store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const vitals = h(ctx, 'vitals').filter(v => v.patientId === pid).sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
  const last = vitals[0];
  const orders = h(ctx, 'orders').filter(o => o.patientId === pid && ['verified', 'active'].includes(o.status));
  const mar = h(ctx, 'mar').filter(m => m.patientId === pid);
  const now = Date.now();
  const marDue = mar.filter(m => m.status === 'due' || (m.status === 'scheduled' && sd(m.scheduledAt) < now + 3600000));
  return {
    patient: { id: p.id, name: p.firstName + ' ' + p.lastName, age: p.age, sex: p.sex,
      wardCode: p.wardCode, bedNumber: p.bedNumber, diagnosis: p.diagnosis,
      allergies: p.allergies || [], comorbidities: p.comorbidities || [], codeStatus: p.codeStatus },
    vitals: last ? { hr: last.hr, bp_sys: last.bp_sys, bp_dia: last.bp_dia, rr: last.rr,
      temp: last.temp, spo2: last.spo2, news2: last.news2, at: last.recordedAt } : null,
    orders, marDue: marDue.length,
    meds: orders.filter(o => o.type === 'medication').map(o => o.details.drug || o.details.name).filter(Boolean)
  };
};

const getSuggestions = (ctx) => {
  const c = getContext(ctx);
  const p = c.patient;
  const v = c.vitals;

  let situation = 'پایدار';
  if (v) {
    if (v.news2 >= 7) situation = 'وضعیت بحرانی — NEWS2 ' + v.news2;
    else if (v.news2 >= 5) situation = 'نیاز به پایش دقیق — NEWS2 ' + v.news2;
    else situation = 'پایدار — NEWS2 ' + v.news2;
    if (v.spo2 < 92) situation += ' · SpO₂ ' + v.spo2 + '%';
    if (v.temp >= 38.3) situation += ' · تب ' + v.temp + '°C';
  }

  let background = p.diagnosis || 'تشخیص نامشخص';
  if (p.comorbidities.length) background += ' · همراهی: ' + p.comorbidities.join('، ');
  if (p.allergies.length) background += ' · ⚠️ آلرژی: ' + p.allergies.join('، ');

  let assessment = 'پایش هر ۴ ساعت';
  if (v && v.news2 >= 7) assessment = 'پایش مداوم — اطلاع فوری پزشک';
  else if (v && v.news2 >= 5) assessment = 'پایش هر ۱ ساعت';

  let recommendation = 'ادامه مراقبت روتین';
  if (c.marDue > 0) recommendation = c.marDue + ' دوز در انتظار توزیع';
  if (p.codeStatus !== 'full') recommendation += ' · کد ' + p.codeStatus.toUpperCase();

  const nanda = new Set();
  if (v && v.news2 >= 5) { nanda.add('00035'); nanda.add('00004'); }
  if (p.age >= 65) { nanda.add('00155'); nanda.add('00047'); }
  if (v && v.spo2 < 92) nanda.add('00004');
  if (c.marDue > 0) nanda.add('00069');

  return {
    situation, background, assessment, recommendation,
    suggestedNanda: [...nanda],
    vitalsText: v ? 'HR ' + (v.hr||'—') + ' · BP ' + (v.bp_sys||'—') + '/' + (v.bp_dia||'—') + ' · SpO₂ ' + (v.spo2||'—') + '% · T ' + (v.temp||'—') + '°C' : 'ویتال ثبت نشده',
    reminders: v && v.news2 >= 7 ? ['پایش هر ۳۰ دقیقه', 'اطلاع فوری پزشک'] :
               v && v.news2 >= 5 ? ['پایش هر ۱ ساعت'] : ['پایش هر ۴ ساعت']
  };
};

const createReport = (ctx) => {
  const b = ctx.body;
  if (!b.patientId) throw ctx.E.badRequest('patient_required');
  const p = ctx.store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const rec = {
    id: ctx.uid('nr'), patientId: p.id,
    patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode, bedNumber: p.bedNumber,
    shiftType: b.shiftType || 'morning',
    isbar: { situation: {}, background: {}, assessment: { diagnoses: [] }, recommendation: {} },
    status: 'draft', fromUser: ctx.actor.id, fromUserName: ctx.actor.username,
    createdAt: ctx.now()
  };
  ctx.store.put('nursing_reports', rec);
  return rec;
};

const saveDraft = (ctx) => {
  const r = ctx.store.get('nursing_reports', ctx.params.id);
  if (!r) throw ctx.E.notFound('not_found');
  if (r.status !== 'draft') throw ctx.E.conflict('not_draft');
  if (ctx.body.isbar) r.isbar = ctx.body.isbar;
  if (ctx.body.shiftType) r.shiftType = ctx.body.shiftType;
  r.updatedAt = ctx.now();
  ctx.store.put('nursing_reports', r);
  return r;
};

const signReport = (ctx) => {
  const r = ctx.store.get('nursing_reports', ctx.params.id);
  if (!r) throw ctx.E.notFound('not_found');
  if (r.status !== 'draft') throw ctx.E.conflict('not_draft');
  const i = r.isbar || {};
  if (!i.situation || !i.situation.currentIssue) throw ctx.E.badRequest('situation_required');
  if (!i.assessment || !i.assessment.clinicalImpression) throw ctx.E.badRequest('assessment_required');
  const code = 'NR-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  r.status = 'signed';
  r.uniqueCode = code;
  r.signedAt = ctx.now();
  r.signedBy = ctx.actor.id;
  r.signedByName = ctx.actor.username;
  ctx.store.put('nursing_reports', r);
  sg(ctx, 'nursing_reports', r, 'sign');
  return r;
};

const receiveReport = (ctx) => {
  const r = ctx.store.get('nursing_reports', ctx.params.id);
  if (!r) throw ctx.E.notFound('not_found');
  if (r.status !== 'signed') throw ctx.E.conflict('not_signed');
  r.status = 'received';
  r.receivedAt = ctx.now();
  r.receivedBy = ctx.actor.id;
  ctx.store.put('nursing_reports', r);
  return r;
};

module.exports = {
  handlers: { listReports, getReport, getNanda, getContext, getSuggestions,
    createReport, saveDraft, signReport, receiveReport },
  routes: [
    { method:'GET', path:'/api/nr/list', handler:'listReports', perm:'nursing_report.view' },
    { method:'GET', path:'/api/nr/nanda', handler:'getNanda', perm:'nursing_report.view' },
    { method:'GET', path:'/api/nr/context/:patientId', handler:'getContext', perm:'nursing_report.view' },
    { method:'GET', path:'/api/nr/suggest/:patientId', handler:'getSuggestions', perm:'nursing_report.view' },
    { method:'GET', path:'/api/nr/:id', handler:'getReport', perm:'nursing_report.view' },
    { method:'POST', path:'/api/nr/create', handler:'createReport', perm:'nursing_report.create' },
    { method:'PUT', path:'/api/nr/:id', handler:'saveDraft', perm:'nursing_report.create' },
    { method:'POST', path:'/api/nr/:id/sign', handler:'signReport', perm:'nursing_report.sign' },
    { method:'POST', path:'/api/nr/:id/receive', handler:'receiveReport', perm:'nursing_report.receive' }
  ],
  panels: [
    { id:'nursing', title:'گزارش پرستاری', icon:'📝', perm:'nursing_report.view', kind:'nursing', api:'/api/nr/list' }
  ]
};
EOF
echo "✅ nursing_report.js — 26 NANDA, ISBAR, auto-fill"

# ─── ۲) Permissions ───
cat >> core/permissions-extra.js << 'EOF'
Object.assign(perms.P, {
  'nursing_report.view':    'admin,nurse,head_nurse,physician,resident,intern,attending,specialist,supervisor_clinical,nursing_director',
  'nursing_report.create':  'admin,nurse,head_nurse',
  'nursing_report.sign':    'admin,nurse,head_nurse',
  'nursing_report.receive': 'admin,nurse,head_nurse'
});
EOF
echo "✅ Permissions added"

# ─── ۳) Frontend — append to extra.js ───
cat >> public/extra.js << 'ENDJS'

// ═══════════════════════════════════════════════════════════
//  Nursing Report — Custom Editor
// ═══════════════════════════════════════════════════════════

NABZ.showNursing = async function(p, d) {
  const items = d.items || [];
  let h = '<div class="sec-hd"><span>📝 گزارش پرستاری</span><span style="font-size:11px;color:var(--fg-2)">' + items.length + '</span></div>';
  h += '<button class="btn btn-primary btn-block" style="margin-bottom:12px" onclick="NABZ.pickPatientForReport()">➕ گزارش جدید</button>';

  if (!items.length) {
    h += '<div class="empty">گزارشی ثبت نشده<br><span style="font-size:11px;opacity:.7">اولین گزارش را بساز</span></div>';
  } else {
    for (const r of items) {
      const statusLbl = { draft:'پیش‌نویس', signed:'امضا', received:'دریافت' }[r.status];
      const statusCls = { draft:'warn', signed:'info', received:'ok' }[r.status];
      const shift = { morning:'صبح', evening:'عصر', night:'شب' }[r.shiftType] || r.shiftType;
      h += '<div class="row ' + (r.status === 'signed' ? 'md' : r.status === 'received' ? 'lo' : '') + '" onclick="NABZ.viewNursing(\'' + r.id + '\')">';
      h += '<div class="row-hd"><div class="row-title">' + NABZ._esc(r.patientName) + '</div>';
      h += '<span class="pill ' + statusCls + '">' + statusLbl + '</span></div>';
      h += '<div class="row-meta">' + NABZ._esc(r.wardCode || '') + ' · شیفت ' + shift + ' · ' + NABZ._esc(r.fromUserName || '') + '</div>';
      if (r.uniqueCode) h += '<div class="row-meta" style="color:var(--primary);font-family:monospace;font-size:10px">🔐 ' + NABZ._esc(r.uniqueCode) + '</div>';
      h += '</div>';
    }
  }
  document.getElementById('content').innerHTML = h;
};

NABZ.pickPatientForReport = async function() {
  try {
    const d = await NABZ._api('/api/clinical/patients');
    const patients = (d.items || []).filter(x => ['in_care','admitted'].includes(x.status));
    if (!patients.length) { alert('بیماری در حال بستری نیست'); return; }
    const sheet = document.createElement('div');
    sheet.className = 'bs-backdrop';
    sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
    let h = '<div class="bs-handle"></div>';
    h += '<div class="bs-hd"><div class="bs-title">👤 انتخاب بیمار</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div class="bs-body">';
    for (const p of patients) {
      h += '<button class="btn btn-block" style="text-align:right;padding:16px;margin-bottom:6px" onclick="this.closest(\'.bs-backdrop\').remove();NABZ.createNursingDraft(\'' + p.id + '\')">';
      h += '<div style="font-weight:800">' + NABZ._esc(p.firstName + ' ' + p.lastName) + '</div>';
      h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + NABZ._esc(p.wardCode || '') + ' · تخت ' + NABZ._esc(p.bedNumber || '—') + '</div>';
      h += '</button>';
    }
    h += '</div>';
    const c = document.createElement('div');
    c.className = 'bs-sheet';
    c.innerHTML = h;
    sheet.appendChild(c);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('show'));
  } catch (e) { alert(e.message); }
};

NABZ.createNursingDraft = async function(patientId) {
  try {
    const r = await NABZ._api('/api/nr/create', { method:'POST', body: JSON.stringify({ patientId, shiftType: 'morning' }) });
    await NABZ.openNursingEditor(r.id);
  } catch (e) { alert('خطا: ' + e.message); }
};

NABZ.openNursingEditor = async function(reportId) {
  try {
    const [report, nandaCatalog] = await Promise.all([
      NABZ._api('/api/nr/' + reportId),
      NABZ._api('/api/nr/nanda')
    ]);
    const ctx = await NABZ._api('/api/nr/context/' + report.patientId);
    const isDraft = report.status === 'draft';
    const isbar = report.isbar || {};
    const sit = isbar.situation || {};
    const bg = isbar.background || {};
    const asmt = isbar.assessment || {};
    const rec = isbar.recommendation || {};
    const selectedNanda = new Set(asmt.diagnoses || []);

    const sheet = document.createElement('div');
    sheet.className = 'bs-backdrop';
    sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };

    let h = '<div class="bs-handle"></div>';
    h += '<div class="bs-hd"><div class="bs-title">📝 ' + NABZ._esc(ctx.patient.name) + '</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

    // Patient header
    h += '<div class="card" style="margin-bottom:12px;background:linear-gradient(135deg,rgba(6,182,212,.08),rgba(139,92,246,.05))">';
    h += '<div style="font-size:15px;font-weight:900">' + NABZ._esc(ctx.patient.name) + '</div>';
    h += '<div style="font-size:11px;color:var(--fg-2);margin-top:3px">' + (ctx.patient.age || '—') + ' سال · ' + (ctx.patient.sex === 'female' ? 'زن' : 'مرد') + ' · ' + NABZ._esc(ctx.patient.wardCode || '') + ' · تخت ' + NABZ._esc(ctx.patient.bedNumber || '—') + '</div>';
    if (ctx.patient.allergies.length) h += '<div style="font-size:10.5px;color:var(--dng);margin-top:4px;font-weight:700">⚠️ آلرژی: ' + NABZ._esc(ctx.patient.allergies.join('، ')) + '</div>';
    h += '</div>';

    // Shift + auto-fill
    h += '<div class="bs-field"><label>شیفت</label>';
    h += '<select id="nrShift" ' + (isDraft ? '' : 'disabled') + '>';
    for (const [k, v] of [['morning','صبح'],['evening','عصر'],['night','شب']]) {
      h += '<option value="' + k + '"' + (report.shiftType === k ? ' selected' : '') + '>' + v + '</option>';
    }
    h += '</select></div>';

    if (isDraft) {
      h += '<button class="btn btn-block" style="margin-bottom:14px;background:var(--bg-3)" onclick="NABZ.autoFillReport(\'' + reportId + '\')">🤖 پرکردن خودکار از داده‌های بیمار</button>';
    }

    // S
    h += '<div class="card" style="margin-top:10px"><div class="card-title">📌 S — وضعیت فعلی</div>';
    h += '<div class="bs-field"><label>وضعیت</label><input id="nrS" value="' + NABZ._esc(sit.currentIssue || '') + '" ' + (isDraft ? '' : 'disabled') + '></div>';
    h += '<div class="bs-field" style="margin-top:8px"><label>ویتال خلاصه</label><input id="nrSVit" value="' + NABZ._esc(sit.vitals || '') + '" ' + (isDraft ? '' : 'disabled') + '></div>';
    h += '</div>';

    // B
    h += '<div class="card"><div class="card-title">📚 B — سابقه</div>';
    h += '<div class="bs-field"><label>علت بستری</label><input id="nrB" value="' + NABZ._esc(bg.reason || '') + '" ' + (isDraft ? '' : 'disabled') + '></div>';
    h += '<div class="bs-field" style="margin-top:8px"><label>همراهی / سابقه</label><input id="nrBHist" value="' + NABZ._esc(bg.history || '') + '" ' + (isDraft ? '' : 'disabled') + '></div>';
    h += '</div>';

    // A — NANDA picker
    h += '<div class="card"><div class="card-title">🔍 A — ارزیابی</div>';
    h += '<div style="font-size:11px;color:var(--fg-2);margin-bottom:8px">تشخیص‌های NANDA</div>';
    h += '<div style="max-height:240px;overflow-y:auto;background:var(--bg);border-radius:8px;padding:8px" id="nandaBox">';
    for (const dom of nandaCatalog.domains) {
      const items = nandaCatalog.diagnoses.filter(d => d.domain === dom.id);
      if (!items.length) continue;
      h += '<div style="font-size:10px;font-weight:900;color:var(--primary);padding:6px 4px 3px">' + NABZ._esc(dom.label) + '</div>';
      for (const d of items) {
        const on = selectedNanda.has(d.code);
        h += '<label style="display:flex;align-items:center;gap:8px;padding:6px 4px;font-size:11.5px;cursor:pointer' + (isDraft ? '' : ';opacity:.7') + '">';
        h += '<input type="checkbox" data-code="' + d.code + '" ' + (on ? 'checked' : '') + ' ' + (isDraft ? '' : 'disabled') + ' style="width:16px;height:16px;flex-shrink:0">';
        h += '<span>' + (d.risk ? '⚠️ ' : '') + NABZ._esc(d.label) + '</span>';
        h += '<span style="font-family:monospace;font-size:9px;color:var(--fg-3);margin-right:auto">' + d.code + '</span>';
        h += '</label>';
      }
    }
    h += '</div>';
    h += '<div class="bs-field" style="margin-top:8px"><label>ارزیابی بالینی</label><textarea id="nrA" rows="3" ' + (isDraft ? '' : 'disabled') + '>' + NABZ._esc(asmt.clinicalImpression || '') + '</textarea></div>';
    h += '</div>';

    // R
    h += '<div class="card"><div class="card-title">📋 R — پیگیری</div>';
    h += '<div class="bs-field"><label>توصیه‌ها</label><textarea id="nrR" rows="2" ' + (isDraft ? '' : 'disabled') + '>' + NABZ._esc(rec.followUp || '') + '</textarea></div>';
    h += '</div>';

    // Actions
    if (isDraft) {
      h += '<div style="display:flex;gap:8px;margin-top:16px">';
      h += '<button class="btn" style="flex:1;padding:14px" onclick="NABZ.saveNursingReport(\'' + reportId + '\',false)">💾 ذخیره</button>';
      h += '<button class="btn btn-primary" style="flex:1;padding:14px" onclick="NABZ.saveNursingReport(\'' + reportId + '\',true)">✍️ امضا</button>';
      h += '</div>';
    } else if (report.status === 'signed') {
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:16px" onclick="NABZ.receiveReport(\'' + reportId + '\')">✅ دریافت</button>';
    }

    const c = document.createElement('div');
    c.className = 'bs-sheet';
    c.innerHTML = h;
    sheet.appendChild(c);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('show'));
  } catch (e) { alert('خطا: ' + e.message); }
};

NABZ.autoFillReport = async function(reportId) {
  try {
    const r = await NABZ._api('/api/nr/' + reportId);
    const s = await NABZ._api('/api/nr/suggest/' + r.patientId);
    const setv = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
    setv('nrS', s.situation);
    setv('nrSVit', s.vitalsText);
    setv('nrB', s.background);
    setv('nrA', s.assessment);
    setv('nrR', s.recommendation);
    // NANDA
    document.querySelectorAll('#nandaBox input[type=checkbox]').forEach(cb => {
      if (s.suggestedNanda.includes(cb.dataset.code)) cb.checked = true;
    });
    alert('✅ پر شد — بازبینی کن و امضا');
  } catch (e) { alert('خطا: ' + e.message); }
};

NABZ.saveNursingReport = async function(reportId, sign) {
  try {
    const isbar = {
      situation: { currentIssue: document.getElementById('nrS').value, vitals: document.getElementById('nrSVit').value },
      background: { reason: document.getElementById('nrB').value, history: document.getElementById('nrBHist').value },
      assessment: {
        diagnoses: [...document.querySelectorAll('#nandaBox input:checked')].map(c => c.dataset.code),
        clinicalImpression: document.getElementById('nrA').value
      },
      recommendation: { followUp: document.getElementById('nrR').value }
    };
    const shiftType = document.getElementById('nrShift').value;
    await NABZ._api('/api/nr/' + reportId, { method: 'PUT', body: JSON.stringify({ isbar, shiftType }) });
    if (sign) {
      const signed = await NABZ._api('/api/nr/' + reportId + '/sign', { method: 'POST', body: '{}' });
      document.querySelector('.bs-backdrop')?.remove();
      setTimeout(() => {
        alert('✅ امضا شد!\n\nکد یکتا: ' + signed.uniqueCode + '\n\nاین کد در گزارش‌های دریافت‌کننده ثبت می‌شود.');
        NABZ.show('nursing_report.nursing');
      }, 100);
    } else {
      document.querySelector('.bs-backdrop')?.remove();
      alert('💾 ذخیره شد');
      NABZ.show('nursing_report.nursing');
    }
  } catch (e) { alert('خطا: ' + e.message); }
};

NABZ.receiveReport = async function(reportId) {
  try {
    await NABZ._api('/api/nr/' + reportId + '/receive', { method: 'POST', body: '{}' });
    document.querySelector('.bs-backdrop')?.remove();
    alert('✅ دریافت شد');
    NABZ.show('nursing_report.nursing');
  } catch (e) { alert('خطا: ' + e.message); }
};

NABZ.viewNursing = async function(reportId) {
  try {
    const r = await NABZ._api('/api/nr/' + reportId);
    const nanda = await NABZ._api('/api/nr/nanda');
    const isbar = r.isbar || {};
    const sit = isbar.situation || {};
    const bg = isbar.background || {};
    const asmt = isbar.assessment || {};
    const rec = isbar.recommendation || {};

    const sheet = document.createElement('div');
    sheet.className = 'bs-backdrop';
    sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
    let h = '<div class="bs-handle"></div>';
    h += '<div class="bs-hd"><div class="bs-title">📝 ' + NABZ._esc(r.patientName) + '</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div style="font-size:11px;color:var(--fg-2);padding-bottom:10px;border-bottom:1px solid var(--border);margin-bottom:14px">';
    h += NABZ._esc(r.wardCode) + ' · شیفت ' + ({morning:'صبح',evening:'عصر',night:'شب'})[r.shiftType] + ' · ' + NABZ._esc(r.fromUserName);
    if (r.uniqueCode) h += '<div style="margin-top:6px;font-family:monospace;color:var(--primary);font-weight:800">🔐 ' + NABZ._esc(r.uniqueCode) + '</div>';
    h += '</div>';

    if (sit.currentIssue) h += '<div class="card"><div class="card-title">📌 S</div><div>' + NABZ._esc(sit.currentIssue) + '</div>' + (sit.vitals ? '<div style="font-size:11px;color:var(--fg-2);margin-top:4px">' + NABZ._esc(sit.vitals) + '</div>' : '') + '</div>';
    if (bg.reason || bg.history) h += '<div class="card"><div class="card-title">📚 B</div>' + (bg.reason ? '<div>' + NABZ._esc(bg.reason) + '</div>' : '') + (bg.history ? '<div style="font-size:11px;color:var(--fg-2);margin-top:4px">' + NABZ._esc(bg.history) + '</div>' : '') + '</div>';
    if (asmt.diagnoses?.length || asmt.clinicalImpression) {
      h += '<div class="card"><div class="card-title">🔍 A</div>';
      if (asmt.diagnoses?.length) {
        const dnames = asmt.diagnoses.map(c => { const d = nanda.diagnoses.find(x => x.code === c); return d ? d.label : c; }).join('، ');
        h += '<div style="font-size:12px;margin-bottom:4px"><strong>NANDA:</strong> ' + NABZ._esc(dnames) + '</div>';
      }
      if (asmt.clinicalImpression) h += '<div style="font-size:12px">' + NABZ._esc(asmt.clinicalImpression) + '</div>';
      h += '</div>';
    }
    if (rec.followUp) h += '<div class="card"><div class="card-title">📋 R</div><div>' + NABZ._esc(rec.followUp) + '</div></div>';

    if (r.status === 'signed') {
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:14px" onclick="NABZ.receiveReport(\'' + reportId + '\')">✅ دریافت این گزارش</button>';
    }
    if (r.status === 'received') {
      h += '<div class="card" style="border-color:var(--ok);text-align:center;color:var(--ok);font-weight:800">✅ دریافت شده</div>';
    }

    const c = document.createElement('div');
    c.className = 'bs-sheet';
    c.innerHTML = h;
    sheet.appendChild(c);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('show'));
  } catch (e) { alert('خطا: ' + e.message); }
};
ENDJS
echo "✅ Frontend nursing UI added (~250 lines)"

# ─── ۴) Patch app.js — delegate 'nursing' kind ───
node << 'PATCH'
const fs = require('fs');
let s = fs.readFileSync('public/app.js', 'utf8');
const old = "if (p.kind === 'action') renderAction(p, d);";
const newLine = "if (p.kind === 'action') renderAction(p, d);\n      else if (p.kind === 'nursing' && NABZ.showNursing) await NABZ.showNursing(p, d);";
if (s.includes(old) && !s.includes("p.kind === 'nursing'")) {
  s = s.replace(old, newLine);
  fs.writeFileSync('public/app.js', s);
  console.log('✅ app.js patched — nursing kind delegated');
} else {
  console.log('⚠️ patch already applied or pattern not found');
}
PATCH

# ─── ۵) Seed 2 sample reports ───
node << 'SEED'
const store = require('./core/store');
const existing = store.readAll('nursing_reports').filter(r => r.id.startsWith('nr_demo'));
if (existing.length) { console.log('✅ Demo reports already exist'); return; }

const now = new Date().toISOString();
store.put('nursing_reports', {
  id: 'nr_demo_1', patientId: 'pat_1', patientName: 'علی رضایی',
  wardCode: 'ICU', bedNumber: 'ICU-01', shiftType: 'morning',
  isbar: {
    situation: { currentIssue: 'پایدار — NEWS2 9', vitals: 'HR 110 · BP 95/60 · SpO₂ 92% · T 38.5°C' },
    background: { reason: 'STEMI', history: 'HTN، DM · ⚠️ آلرژی: Penicillin' },
    assessment: { diagnoses: ['00035','00004','00132'], clinicalImpression: 'پایش مداوم — اطلاع فوری پزشک' },
    recommendation: { followUp: 'ادامه آنتی‌بیوتیک · پایش هر ۱ ساعت' }
  },
  status: 'draft', fromUser: 'usr_admin', fromUserName: 'admin', createdAt: now
});
store.put('nursing_reports', {
  id: 'nr_demo_2', patientId: 'pat_2', patientName: 'مریم احمدی',
  wardCode: 'ER', bedNumber: 'ER-02', shiftType: 'evening',
  isbar: {
    situation: { currentIssue: 'پایدار — NEWS2 5', vitals: 'HR 95 · BP 115/75 · SpO₂ 94% · T 39°C' },
    background: { reason: 'پنومونی', history: 'آسم' },
    assessment: { diagnoses: ['00004','00134'], clinicalImpression: 'پایش هر ۱ ساعت' },
    recommendation: { followUp: 'ادامه آنتی‌بیوتیک، تب‌بر PRN' }
  },
  status: 'signed', uniqueCode: 'NR-DEMO-SIGNED',
  fromUser: 'usr_admin', fromUserName: 'admin',
  signedBy: 'usr_admin', signedByName: 'admin',
  signedAt: now, createdAt: now
});
console.log('✅ 2 demo nursing reports seeded (1 draft, 1 signed)');
SEED

# ─── ۶) Restart ───
for pid in $(pgrep -f "core/server.js" 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done
sleep 1

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ Part 8 — Nursing Report (NANDA+ISBAR)    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Now: node core/server.js"
