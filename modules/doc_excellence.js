
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Clinical Documentation Excellence (v4)
//  4 documents: SBAR + Discharge Summary + Consult Reply + Incident Report
//  Standards: IHI SBAR · JCI discharge · JCI incident/RCA
//  No new UI. Reuses existing document viewer pattern.
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const store = require('../core/store');
const bus = require('../core/events');
const signature = require('../core/signature');
const perms = require('../core/permissions');

if (!perms.P['docx.generate']) {
  perms.P['docx.generate'] = 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,head_nurse,attending,specialist,surgeon,resident,intern,physician,nurse,quality_officer';
}

// ═══ HTML helpers ═══
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function fmt(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('fa-IR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); }
  catch (_) { return '—'; }
}
function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('fa-IR'); } catch (_) { return '—'; }
}

function docShell(title, subtitle, body) {
  return '<!DOCTYPE html>\n<html lang="fa" dir="rtl">\n<head>\n<meta charset="UTF-8">\n' +
    '<title>' + esc(title) + '</title>\n' +
    '<style>\n' +
    '@page{size:A4;margin:12mm}\n' +
    'body{font-family:"Vazirmatn","Tahoma",sans-serif;font-size:11px;line-height:1.55;color:#000;background:#fff;margin:0;padding:0}\n' +
    '.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #06b6d4;padding-bottom:10px;margin-bottom:14px}\n' +
    '.hdr .hospital{font-size:18px;font-weight:900;color:#0891b2}\n' +
    '.hdr .sub{font-size:9.5px;color:#666;margin-top:2px}\n' +
    '.hdr .meta{text-align:left;font-size:9px;color:#666;font-family:monospace}\n' +
    '.hdr .meta .t{font-size:13px;font-weight:900;color:#0f172a;font-family:inherit}\n' +
    '.pt-info{background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:10px;margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 12px}\n' +
    '.pt-info .lbl{font-size:9px;color:#0891b2;font-weight:800}\n' +
    '.pt-info .val{font-weight:700;font-size:10.5px;margin-top:1px}\n' +
    '.section{font-size:11.5px;font-weight:900;background:#06b6d4;color:#fff;padding:5px 10px;margin:12px 0 6px;border-radius:4px}\n' +
    '.section.warn{background:#f59e0b}\n.section.dng{background:#dc2626}\n.section.ok{background:#10b981}\n' +
    '.box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin:6px 0;line-height:1.7}\n' +
    '.box p{margin:4px 0}\n.box strong{color:#0891b2}\n.box ul,.box ol{margin:6px 0;padding-right:20px}\n' +
    'table{width:100%;border-collapse:collapse;margin:6px 0;font-size:10px}\n' +
    'th,td{border:1px solid #cbd5e1;padding:5px 6px;text-align:right;vertical-align:top}\n' +
    'th{background:#e0f2fe;font-weight:800;font-size:9.5px;color:#0c4a6e}\n' +
    'tr:nth-child(even) td{background:#f8fafc}\n' +
    '.sigs{display:flex;justify-content:space-between;margin-top:30px;padding-top:10px;border-top:1px solid #cbd5e1;gap:12px}\n' +
    '.sig{flex:1;text-align:center;font-size:10px}\n.sig .lbl{font-weight:800;margin-bottom:30px;color:#64748b}\n' +
    '.sig .line{border-top:1px solid #94a3b8;padding-top:4px;font-family:monospace;font-size:9px;color:#475569}\n' +
    '.footer{margin-top:20px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:8.5px;color:#94a3b8;text-align:center;font-family:monospace}\n' +
    '.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:800;margin:0 2px}\n' +
    '.tag-ok{background:#d1fae5;color:#065f46}\n.tag-warn{background:#fef3c7;color:#92400e}\n' +
    '.tag-dng{background:#fee2e2;color:#991b1b}\n.tag-info{background:#dbeafe;color:#1e40af}\n' +
    '.blank{min-height:60px;padding:8px;background:#fff;border:1px dashed #cbd5e1;border-radius:4px;color:#94a3b8;font-size:10px}\n' +
    '</style>\n</head>\n<body>\n' +
    '<div class="hdr">\n' +
    '  <div>\n' +
    '    <div class="hospital">🫀 بیمارستان سینا</div>\n' +
    '    <div class="sub">تهران — مرکز درمانی تخصصی</div>\n' +
    '    <div class="sub">دانشگاه علوم پزشکی تهران</div>\n' +
    '  </div>\n' +
    '  <div class="meta">\n' +
    '    <div class="t">' + esc(title) + '</div>\n' +
    '    <div>' + esc(subtitle) + '</div>\n' +
    '    <div>' + new Date().toLocaleString('fa-IR') + '</div>\n' +
    '  </div>\n' +
    '</div>\n' + body + '\n' +
    '<div class="footer">NABZ v1.0 — ' + new Date().toISOString() + '</div>\n' +
    '</body>\n</html>';
}

function patientBlock(patient) {
  if (!patient) return '';
  const allergy = (patient.allergies || []).length ? patient.allergies.join('، ') : '—';
  const comorb = (patient.comorbidities || []).length ? patient.comorbidities.join('، ') : '—';
  return '<div class="pt-info">' +
    '<div><div class="lbl">نام</div><div class="val">' + esc(patient.firstName + ' ' + patient.lastName) + '</div></div>' +
    '<div><div class="lbl">MRN</div><div class="val">' + esc(patient.mrn || '—') + '</div></div>' +
    '<div><div class="lbl">سن / جنسیت</div><div class="val">' + (patient.age || '—') + ' سال · ' + (patient.sex === 'female' ? 'زن' : 'مرد') + '</div></div>' +
    '<div><div class="lbl">بخش</div><div class="val">' + esc(patient.wardCode || '') + '</div></div>' +
    '<div><div class="lbl">تخت</div><div class="val">' + esc(patient.bedNumber || '—') + '</div></div>' +
    '<div><div class="lbl">کد</div><div class="val">' + esc((patient.codeStatus || 'full').toUpperCase()) + '</div></div>' +
    '<div style="grid-column:span 2"><div class="lbl">تشخیص اصلی</div><div class="val">' + esc(patient.diagnosis || '—') + '</div></div>' +
    '<div><div class="lbl">آلرژی</div><div class="val" style="color:' + (allergy !== '—' ? '#dc2626' : '#000') + '">' + esc(allergy) + '</div></div>' +
    '<div style="grid-column:span 3"><div class="lbl">بیماری همراه</div><div class="val">' + esc(comorb) + '</div></div>' +
    '</div>';
}

function signatureBlock(role1, name1, role2, name2) {
  return '<div class="sigs">' +
    '<div class="sig"><div class="lbl">' + esc(role1) + '</div><div class="line">' + esc(name1 || '_________________') + '</div></div>' +
    (role2 ? '<div class="sig"><div class="lbl">' + esc(role2) + '</div><div class="line">' + esc(name2 || '_________________') + '</div></div>' : '') +
    '</div>';
}

function tags(flags) {
  const tagMap = { critical:'tag-dng', warning:'tag-warn', ok:'tag-ok', info:'tag-info' };
  return (flags || []).map(f => '<span class="tag ' + (tagMap[f.level] || 'tag-info') + '">' + esc(f.text) + '</span>').join(' ');
}

// ═══ 1. SBAR Generator ═══
function getSBAR(ctx) {
  const encounterId = ctx.params.encounterId;
  let encounter = null, patient = null;

  if (encounterId && encounterId !== 'latest') {
    encounter = store.get('encounters', encounterId);
    if (!encounter) throw ctx.E.notFound('encounter_not_found');
    patient = store.get('patients', encounter.patientId);
  } else {
    const patientId = ctx.query.patientId;
    if (!patientId) throw ctx.E.badRequest('patientId_required_when_latest');
    patient = store.get('patients', patientId);
    if (!patient) throw ctx.E.notFound('patient_not_found');
    const encs = h(ctx, 'encounters').filter(e => e.patientId === patientId && e.type === 'round');
    if (encs.length) encounter = encs.sort((a, b) => sd(b.createdAt) - sd(a.createdAt))[0];
  }

  if (!patient) throw ctx.E.notFound('patient_not_found');

  const vitals = h(ctx, 'vitals').filter(v => v.patientId === patient.id).sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
  const lastVital = vitals[0];
  const labs = h(ctx, 'labs').filter(l => l.patientId === patient.id && ['resulted','verified'].includes(l.status))
    .sort((a, b) => sd(b.orderedAt) - sd(a.orderedAt)).slice(0, 5);
  const mar = h(ctx, 'mar').filter(m => m.patientId === patient.id);
  const marDue = mar.filter(m => ['scheduled','due'].includes(m.status));
  const ncp = h(ctx, 'nursing_care_plans').find(c => c.patientId === patient.id && c.status === 'active');

  const s = (encounter && encounter.subjective) || {};
  const a = (encounter && encounter.assessment) || {};
  const p = (encounter && encounter.plan) || {};

  // Situation
  const sit = [];
  if (s.chiefComplaint) sit.push('<strong>شکایت:</strong> ' + esc(s.chiefComplaint));
  if (lastVital) {
    const v = [];
    if (lastVital.hr != null) v.push('HR ' + lastVital.hr);
    if (lastVital.bp_sys != null) v.push('BP ' + lastVital.bp_sys + '/' + (lastVital.bp_dia || '?'));
    if (lastVital.rr != null) v.push('RR ' + lastVital.rr);
    if (lastVital.temp != null) v.push('T ' + lastVital.temp + '°C');
    if (lastVital.spo2 != null) v.push('SpO₂ ' + lastVital.spo2 + '%');
    if (lastVital.news2 != null) v.push('NEWS2 ' + lastVital.news2);
    if (v.length) sit.push('<strong>ویتال (' + fmt(lastVital.recordedAt) + '):</strong> ' + v.join(' · '));
  }
  if (!sit.length) sit.push('<em>ثبت نشده</em>');

  // Background
  const bg = [];
  if (s.history) bg.push('<strong>تاریخچه:</strong> ' + esc(s.history));
  if (patient.diagnosis) bg.push('<strong>تشخیص:</strong> ' + esc(patient.diagnosis));
  if (patient.admittedAt) {
    const los = Math.floor((Date.now() - sd(patient.admittedAt)) / 86400000);
    bg.push('<strong>بستری:</strong> ' + los + ' روز (از ' + fmtDate(patient.admittedAt) + ')');
  }
  if ((patient.comorbidities || []).length) bg.push('<strong>همراهی:</strong> ' + esc(patient.comorbidities.join('، ')));
  if (!bg.length) bg.push('<em>ثبت نشده</em>');

  // Assessment
  const asmt = [];
  if (a.clinicalImpression) asmt.push('<strong>ارزیابی:</strong> ' + esc(a.clinicalImpression));
  if (a.diagnoses && a.diagnoses.length) asmt.push('<strong>افتراقی:</strong> ' + esc(a.diagnoses.join('، ')));
  const flags = [];
  if (lastVital && lastVital.news2 >= 7) flags.push({ level:'critical', text:'NEWS2 ≥ 7' });
  if (lastVital && lastVital.spo2 && lastVital.spo2 < 92) flags.push({ level:'critical', text:'SpO₂ < 92' });
  if (labs.some(l => l.criticalFlags && l.criticalFlags.length)) flags.push({ level:'critical', text:'Lab بحرانی' });
  if (mar.filter(m => m.status === 'missed').length) flags.push({ level:'warning', text:mar.filter(m => m.status === 'missed').length + ' dose missed' });
  if (flags.length) asmt.push(tags(flags));
  if (!asmt.length) asmt.push('<em>ثبت نشده</em>');

  // Recommendation
  const rec = [];
  if (p.labs && p.labs.length) rec.push('<strong>آزمایش:</strong> ' + esc(Array.isArray(p.labs) ? p.labs.join('، ') : String(p.labs)));
  if (p.imaging && p.imaging.length) rec.push('<strong>تصویر:</strong> ' + esc(Array.isArray(p.imaging) ? p.imaging.join('، ') : String(p.imaging)));
  if (p.consults && p.consults.length) rec.push('<strong>مشاوره:</strong> ' + esc(Array.isArray(p.consults) ? p.consults.join('، ') : String(p.consults)));
  if (marDue.length) rec.push('<strong>MAR نزدیک:</strong> ' + marDue.length + ' دوز در انتظار');
  if (ncp) {
    const active = ncp.diagnoses.filter(d => d.status === 'active');
    if (active.length) {
      const unmet = active.filter(d => d.expectedOutcomes.some(o => o.latestScore != null && o.latestScore < o.target));
      if (unmet.length) rec.push('<strong>⚠️ NOC زیر هدف:</strong> ' + esc(unmet.map(d => d.fa).join('، ')));
    }
  }
  if (!rec.length) rec.push('<em>ثبت نشده</em>');

  let body = patientBlock(patient);
  if (!encounter) body += '<div class="box" style="background:#fef3c7"><p>⚠️ هیچ راند اخیر یافت نشد. SBAR از داده‌های موجود ساخته شد.</p></div>';
  body += '<div class="section">S — وضعیت فعلی</div><div class="box"><p>' + sit.join('</p><p>') + '</p></div>';
  body += '<div class="section">B — سابقه</div><div class="box"><p>' + bg.join('</p><p>') + '</p></div>';
  body += '<div class="section">A — ارزیابی</div><div class="box"><p>' + asmt.join('</p><p>') + '</p></div>';
  body += '<div class="section">R — توصیه</div><div class="box"><p>' + rec.join('</p><p>') + '</p></div>';

  if (labs.length) {
    body += '<div class="section warn">📊 آزمایش‌های اخیر</div>';
    body += '<table><thead><tr><th>پنل</th><th>وضعیت</th><th>زمان</th><th>مقادیر</th></tr></thead><tbody>';
    for (const l of labs) {
      const vals = l.results ? Object.entries(l.results).slice(0, 5).map(([k, v]) => k + '=' + v).join(' · ') : '—';
      const crit = l.criticalFlags && l.criticalFlags.length > 0;
      body += '<tr' + (crit ? ' style="background:#fef2f2"' : '') + '><td>' + esc(l.panelName || l.panelCode) + '</td><td>' + esc(l.status) + (crit ? ' ⚠️' : '') + '</td><td>' + fmt(l.orderedAt) + '</td><td style="font-family:monospace;font-size:9px">' + esc(vals) + '</td></tr>';
    }
    body += '</tbody></table>';
  }

  const sigs = signatureBlock('پرستار/پزشک ارائه‌دهنده', (encounter && encounter.authorName) || '', 'گیرنده SBAR', '');

  ctx.audit.write('doc_excellence', 'sbar.generate', encounter ? encounter.id : patient.id, ctx.actor, {
    patientId: patient.id, hasEncounter: !!encounter
  });

  return {
    html: docShell('SBAR — گزارش تحویل', patient.firstName + ' ' + patient.lastName, body + sigs),
    title: 'SBAR — ' + patient.firstName + ' ' + patient.lastName,
    meta: { patientId: patient.id, encounterId: encounter ? encounter.id : null, generatedAt: new Date().toISOString() }
  };
}

// ═══ 2. Discharge Summary ═══
function getDischargeSummary(ctx) {
  const encId = ctx.params.encounterId;
  let patient = null, latestEncounter = null;

  if (encId && encId !== 'latest') {
    latestEncounter = store.get('encounters', encId);
    if (!latestEncounter) throw ctx.E.notFound('encounter_not_found');
    patient = store.get('patients', latestEncounter.patientId);
  } else {
    const patientId = ctx.query.patientId;
    if (!patientId) throw ctx.E.badRequest('patientId_required_when_latest');
    patient = store.get('patients', patientId);
    if (!patient) throw ctx.E.notFound('patient_not_found');
  }
  if (!patient) throw ctx.E.notFound('patient_not_found');

  const encounters = h(ctx, 'encounters').filter(e => e.patientId === patient.id && e.type === 'round')
    .sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  if (!latestEncounter && encounters.length) latestEncounter = encounters[0];

  const orders = h(ctx, 'orders').filter(o => o.patientId === patient.id);
  const activeMeds = orders.filter(o => o.type === 'medication' && ['verified','active'].includes(o.status));
  const mar = h(ctx, 'mar').filter(m => m.patientId === patient.id);
  const labs = h(ctx, 'labs').filter(l => l.patientId === patient.id).sort((a, b) => sd(b.orderedAt) - sd(a.orderedAt));
  const pendingLabs = labs.filter(l => ['ordered','collected','in_transit','received'].includes(l.status));
  const procedures = h(ctx, 'procedures').filter(p => p.patientId === patient.id && p.status === 'completed');
  const consults = h(ctx, 'consults').filter(c => c.patientId === patient.id && ['approved','responded'].includes(c.status));
  const ncp = h(ctx, 'nursing_care_plans').find(c => c.patientId === patient.id && c.status === 'active');

  // Diagnoses
  const dxSet = new Set();
  if (patient.diagnosis) dxSet.add(patient.diagnosis);
  for (const e of encounters) {
    const dx = (e.assessment && e.assessment.diagnoses) || [];
    dx.forEach(d => { if (d) dxSet.add(d); });
  }
  const diagnoses = Array.from(dxSet);

  let body = patientBlock(patient);

  body += '<div class="section">📋 تشخیص نهایی</div>';
  body += '<div class="box">';
  if (diagnoses.length) {
    body += '<ol style="margin:0;padding-right:20px">';
    for (const dx of diagnoses) body += '<li>' + esc(dx) + '</li>';
    body += '</ol>';
  } else body += '<em>ثبت نشده</em>';
  body += '</div>';

  body += '<div class="section">🏥 خلاصه بستری</div>';
  body += '<div class="box">';
  body += '<p><strong>تاریخ پذیرش:</strong> ' + fmtDate(patient.admittedAt) + '</p>';
  const los = patient.admittedAt ? Math.ceil((Date.now() - sd(patient.admittedAt)) / 86400000) : null;
  if (los != null) body += '<p><strong>مدت بستری:</strong> ' + los + ' روز</p>';
  body += '<p><strong>تعداد راندها:</strong> ' + encounters.length + '</p>';
  if (latestEncounter && latestEncounter.assessment && latestEncounter.assessment.clinicalImpression) {
    body += '<p><strong>آخرین ارزیابی:</strong> ' + esc(latestEncounter.assessment.clinicalImpression) + '</p>';
  }
  body += '</div>';

  if (procedures.length) {
    body += '<div class="section">💉 پروسیجرها</div>';
    body += '<table><thead><tr><th>پروسیجر</th><th>تاریخ</th><th>اپراتور</th><th>یافته</th></tr></thead><tbody>';
    for (const pr of procedures) {
      body += '<tr><td>' + esc(pr.typeLabel || pr.type) + '</td><td>' + fmt(pr.completedAt) + '</td><td>' + esc(pr.operatorName || pr.operator || '—') + '</td><td>' + esc((pr.note && pr.note.findings) || '—') + '</td></tr>';
    }
    body += '</tbody></table>';
  }

  body += '<div class="section ok">💊 داروهای ترخیص</div>';
  if (activeMeds.length) {
    body += '<table><thead><tr><th>#</th><th>دارو</th><th>دوز</th><th>مسیر</th><th>تکرار</th><th>مدت</th></tr></thead><tbody>';
    let i = 1;
    for (const m of activeMeds) {
      const d = m.details || {};
      body += '<tr><td>' + (i++) + '</td><td>' + esc(d.drug || d.name || '—') + '</td><td>' + esc(d.dose || '—') + '</td><td>' + esc(d.route || '—') + '</td><td>' + esc(d.frequency || '—') + '</td><td>' + esc(String(d.durationDays || '—')) + ' روز</td></tr>';
    }
    body += '</tbody></table>';
    body += '<div class="box" style="background:#fef3c7"><p><strong>⚠️ توجه:</strong> لیست باید با نسخه نهایی پزشک تطبیق داده شود. آموزش بیمار الزامی است.</p></div>';
  } else body += '<div class="box"><em>داروی فعال ثبت نشده</em></div>';

  if (pendingLabs.length) {
    body += '<div class="section warn">⏳ نتایج در انتظار</div>';
    body += '<div class="box"><ul style="margin:6px 0;padding-right:20px">';
    for (const l of pendingLabs) body += '<li>' + esc(l.panelName || l.panelCode) + ' — ' + esc(l.status) + '</li>';
    body += '</ul></div>';
  }

  if (consults.length) {
    body += '<div class="section">🩺 مشاوره‌ها</div>';
    body += '<div class="box">';
    for (const c of consults) {
      const ans = (c.response && c.response.answer) || '—';
      body += '<p><strong>' + esc(c.targetService) + ':</strong> ' + esc(ans) + '</p>';
    }
    body += '</div>';
  }

  if (ncp) {
    const active = ncp.diagnoses.filter(d => d.status === 'active');
    const resolved = ncp.diagnoses.filter(d => d.status === 'resolved');
    if (active.length || resolved.length) {
      body += '<div class="section">📋 وضعیت NCP</div>';
      body += '<div class="box">';
      body += '<p><strong>تشخیص‌های حل‌شده:</strong> ' + resolved.length + '</p>';
      body += '<p><strong>تشخیص‌های فعال:</strong> ' + active.length + '</p>';
      if (active.length) {
        body += '<ul style="margin:6px 0;padding-right:20px">';
        for (const d of active) body += '<li>' + esc(d.fa) + '</li>';
        body += '</ul>';
      }
      body += '</div>';
    }
  }

  body += '<div class="section">📅 پیگیری و توصیه‌ها</div>';
  body += '<div class="blank">— توسط پزشک معالج تکمیل شود —</div>';

  body += '<div class="section">🚪 وضعیت در زمان ترخیص</div>';
  body += '<div class="blank">— توسط پزشک تکمیل شود —</div>';

  const sigs = signatureBlock('پزشک معالج', patient.attendingName || '', 'پرستار ترخیص', '');

  ctx.audit.write('doc_excellence', 'discharge.generate', latestEncounter ? latestEncounter.id : patient.id, ctx.actor, {
    patientId: patient.id, encounterCount: encounters.length
  });

  return {
    html: docShell('خلاصه ترخیص', patient.firstName + ' ' + patient.lastName, body + sigs),
    title: 'خلاصه ترخیص — ' + patient.firstName + ' ' + patient.lastName,
    meta: { patientId: patient.id, generatedAt: new Date().toISOString() }
  };
}

// ═══ 3. Consult Reply ═══
function getConsultReply(ctx) {
  const consultId = ctx.params.consultId;
  const consult = store.get('consults', consultId);
  if (!consult) throw ctx.E.notFound('consult_not_found');
  const patient = store.get('patients', consult.patientId);

  let body = patientBlock(patient);
  body += '<div class="section">📋 جزئیات مشاوره</div>';
  body += '<div class="box">';
  body += '<p><strong>بخش درخواست‌کننده:</strong> ' + esc(consult.wardCode || '—') + '</p>';
  body += '<p><strong>سرویس مشاور:</strong> ' + esc(consult.targetService) + '</p>';
  body += '<p><strong>نوع:</strong> ' + esc(consult.consultType || 'routine') + '</p>';
  body += '<p><strong>تاریخ درخواست:</strong> ' + fmt(consult.requestedAt) + '</p>';
  if (consult.responseDueAt) body += '<p><strong>مهلت پاسخ:</strong> ' + fmt(consult.responseDueAt) + '</p>';
  body += '</div>';

  if (consult.isbar) {
    const isb = consult.isbar;
    if (isb.situation || isb.background || isb.assessment || isb.recommendation) {
      body += '<div class="section">ISBAR</div>';
      body += '<div class="box">';
      if (isb.situation) body += '<p><strong>S:</strong> ' + esc(isb.situation) + '</p>';
      if (isb.background) body += '<p><strong>B:</strong> ' + esc(isb.background) + '</p>';
      if (isb.assessment) body += '<p><strong>A:</strong> ' + esc(isb.assessment) + '</p>';
      if (isb.recommendation) body += '<p><strong>R:</strong> ' + esc(isb.recommendation) + '</p>';
      body += '</div>';
    }
  }

  body += '<div class="section warn">❓ سؤال بالینی</div>';
  body += '<div class="box"><p>' + esc(consult.question || '—') + '</p></div>';

  if (consult.response) {
    body += '<div class="section ok">✅ پاسخ مشاور</div>';
    body += '<div class="box">';
    body += '<p><strong>پاسخ:</strong> ' + esc(consult.response.answer || '—') + '</p>';
    if (consult.response.recommendations && consult.response.recommendations.length) {
      body += '<p><strong>توصیه‌ها:</strong></p><ul style="margin:4px 0;padding-right:20px">';
      for (const r of consult.response.recommendations) body += '<li>' + esc(r) + '</li>';
      body += '</ul>';
    }
    if (consult.response.followup) body += '<p><strong>پیگیری:</strong> ' + esc(consult.response.followup) + '</p>';
    body += '</div>';
  } else {
    body += '<div class="section warn">⏳ هنوز پاسخی ثبت نشده</div>';
    body += '<div class="blank">— توسط سرویس مشاور تکمیل شود —</div>';
  }

  const sigs = signatureBlock('سرویس مشاور', consult.respondedByName || '', 'پزشک درخواست‌کننده', consult.requestedByName || '');

  ctx.audit.write('doc_excellence', 'consult.reply.generate', consult.id, ctx.actor, {
    patientId: patient.id, consultId: consult.id
  });

  return {
    html: docShell('پاسخ مشاوره', consult.targetService + ' — ' + patient.firstName + ' ' + patient.lastName, body + sigs),
    title: 'پاسخ مشاوره — ' + patient.firstName + ' ' + patient.lastName,
    meta: { patientId: patient.id, consultId: consult.id }
  };
}

// ═══ 4. Incident Report (JCI) ═══
function getIncidentDoc(ctx) {
  const incidentId = ctx.params.incidentId;
  const incident = store.get('incidents', incidentId);
  if (!incident) throw ctx.E.notFound('incident_not_found');
  const patient = incident.patientId ? store.get('patients', incident.patientId) : null;

  let body = '';
  if (patient) body += patientBlock(patient);

  body += '<div class="section dng">⚠️ اطلاعات حادثه</div>';
  body += '<div class="box">';
  body += '<p><strong>شماره پرونده:</strong> ' + esc(incident.id) + '</p>';
  body += '<p><strong>دسته:</strong> ' + esc(incident.category) + '</p>';
  body += '<p><strong>شدت:</strong> ' + esc(incident.severity) + ' (وزن ' + (incident.severityWeight || 1) + '/6)</p>';
  body += '<p><strong>تاریخ وقوع:</strong> ' + fmt(incident.occurredAt) + '</p>';
  body += '<p><strong>تاریخ گزارش:</strong> ' + fmt(incident.reportedAt) + '</p>';
  body += '<p><strong>گزارش‌دهنده:</strong> ' + esc(incident.reportedByName || incident.reportedBy) + '</p>';
  body += '<p><strong>بخش:</strong> ' + esc(incident.wardCode || '—') + '</p>';
  if (incident.requiresRca) body += '<p><span class="tag tag-dng">RCA الزامی</span> ظرف ۳۰ روز</p>';
  body += '</div>';

  body += '<div class="section">📝 شرح حادثه</div>';
  body += '<div class="box"><p style="white-space:pre-wrap">' + esc(incident.description || '—') + '</p></div>';

  if (incident.immediateAction) {
    body += '<div class="section warn">🚑 اقدام فوری</div>';
    body += '<div class="box"><p style="white-space:pre-wrap">' + esc(incident.immediateAction) + '</p></div>';
  }

  body += '<div class="section">🔍 تحلیل ریشه‌ای (RCA — JCI)</div>';
  body += '<div class="box">';
  body += '<p><strong>۱. چه اتفاقی افتاد؟</strong></p><div class="blank">— توسط تیم RCA —</div>';
  body += '<p style="margin-top:8px"><strong>۲. چرا اتفاق افتاد؟ (5 Whys)</strong></p><div class="blank">— تحلیل زنجیره‌ای —</div>';
  body += '<p style="margin-top:8px"><strong>۳. عوامل مشارکت‌کننده:</strong></p>';
  body += '<ul style="margin:4px 0;padding-right:20px">';
  body += '<li>Human factors</li><li>System factors</li><li>Environmental</li><li>Equipment</li>';
  body += '</ul>';
  body += '<p style="margin-top:8px"><strong>۴. توصیه‌های اصلاحی:</strong></p><div class="blank" style="min-height:80px">— هر توصیه با مسئول + تاریخ —</div>';
  body += '</div>';

  if (incident.status === 'closed') {
    body += '<div class="section ok">✅ بستن پرونده</div>';
    body += '<div class="box">';
    body += '<p><strong>بسته‌شده توسط:</strong> ' + esc(incident.closedBy || '—') + '</p>';
    body += '<p><strong>تاریخ:</strong> ' + fmt(incident.closedAt) + '</p>';
    if (incident.rootCause) body += '<p><strong>ریشه:</strong> ' + esc(incident.rootCause) + '</p>';
    if (incident.correctiveAction) body += '<p><strong>اقدام اصلاحی:</strong> ' + esc(incident.correctiveAction) + '</p>';
    if (incident.closureNotes) body += '<p><strong>یادداشت:</strong> ' + esc(incident.closureNotes) + '</p>';
    body += '</div>';
  }

  const sigs = signatureBlock('گزارش‌دهنده', incident.reportedByName || '', 'مدیر ایمنی/کیفیت', '');

  ctx.audit.write('doc_excellence', 'incident.generate', incident.id, ctx.actor, {
    severity: incident.severity, category: incident.category
  });

  return {
    html: docShell('گزارش حادثه', incident.category + ' — ' + incident.severity, body + sigs),
    title: 'گزارش حادثه — ' + incident.category,
    meta: { incidentId: incident.id, severity: incident.severity }
  };
}

// ═══ 5. List available documents ═══
function listDocTypes(ctx) {
  return {
    items: [
      { id:'sbar', title:'SBAR — گزارش تحویل', icon:'📋', endpoint:'/api/docx/sbar/{encounterId} or /api/docx/sbar/latest?patientId={id}' },
      { id:'discharge', title:'خلاصه ترخیص جامع', icon:'🚪', endpoint:'/api/docx/discharge/{encounterId} or /api/docx/discharge/latest?patientId={id}' },
      { id:'consult', title:'پاسخ مشاوره', icon:'🩺', endpoint:'/api/docx/consult/{consultId}' },
      { id:'incident', title:'گزارش حادثه (JCI)', icon:'⚠️', endpoint:'/api/docx/incident/{incidentId}' }
    ],
    total: 4,
    note: 'SBAR و Discharge از همه داده موجود auto-fill می‌شوند: vitals + labs + MAR + NCP + encounters'
  };
}

module.exports = {
  handlers: { getSBAR, getDischargeSummary, getConsultReply, getIncidentDoc, listDocTypes },
  routes: [
    { method:'GET', path:'/api/docx/list', handler:'listDocTypes', perm:null },
    { method:'GET', path:'/api/docx/sbar/:encounterId', handler:'getSBAR', perm:'docx.generate' },
    { method:'GET', path:'/api/docx/discharge/:encounterId', handler:'getDischargeSummary', perm:'docx.generate' },
    { method:'GET', path:'/api/docx/consult/:consultId', handler:'getConsultReply', perm:'docx.generate' },
    { method:'GET', path:'/api/docx/incident/:incidentId', handler:'getIncidentDoc', perm:'docx.generate' }
  ],
  panels: []
};

console.log('[doc_excellence] loaded — SBAR + Discharge + Consult Reply + Incident Report');
