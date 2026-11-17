
# ═══════════════════════════════════════════════════════════════
#  Part 12 — Documents (PDF-ready) + QR Scanner
# ═══════════════════════════════════════════════════════════════

# ─── ۱) Backend: documents module ───
cat > modules/documents.js << 'DOCS_EOF'
'use strict';
const { h, sd } = require('../core/mod-helpers');
const sina = require('../core/sina');

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function jDate(iso) {
  const d = iso ? new Date(iso) : new Date();
  const months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  try {
    const [gy, gm, gd] = d.toISOString().slice(0, 10).split('-').map(Number);
    // Simple approximation (accurate enough for display)
    const jy = gy - 621;
    const jm = gm > 3 ? gm - 3 : gm + 9;
    const jd = gd;
    return jd + ' ' + (months[jm - 1] || '') + ' ' + jy;
  } catch (_) { return d.toISOString().slice(0, 10); }
}

function jDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return jDate(iso) + ' ساعت ' + d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

function docCode() {
  return 'NABZ-' + Date.now().toString(36).toUpperCase();
}

function docShell(title, subtitle, body, footer) {
  return '<!DOCTYPE html>\n<html lang="fa" dir="rtl">\n<head>\n<meta charset="UTF-8">\n<title>' + esc(title) + '</title>\n' +
    '<style>\n' +
    '@page{size:A4;margin:12mm}\n' +
    'body{font-family:"Vazirmatn","Tahoma",sans-serif;font-size:11px;line-height:1.55;color:#000;background:#fff}\n' +
    '.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #06b6d4;padding-bottom:10px;margin-bottom:14px}\n' +
    '.hospital{font-size:18px;font-weight:900;color:#0891b2}\n' +
    '.hospital-sub{font-size:9.5px;color:#666;margin-top:2px}\n' +
    '.title-block{text-align:left}\n' +
    '.title-block .t{font-size:13px;font-weight:900;color:#0f172a}\n' +
    '.title-block .d{font-size:9px;color:#666;font-family:monospace}\n' +
    '.pat-info{background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:10px;margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 12px}\n' +
    '.pat-info div{font-size:10.5px;color:#0f172a}\n' +
    '.pat-info .lbl{font-size:9px;color:#0891b2;font-weight:800;text-transform:uppercase;letter-spacing:0.3px}\n' +
    '.pat-info .val{font-weight:700;margin-top:1px}\n' +
    '.pat-info .val.dng{color:#dc2626}\n' +
    '.section{font-size:11.5px;font-weight:900;background:#06b6d4;color:#fff;padding:5px 10px;margin:12px 0 6px;border-radius:4px}\n' +
    '.section.warn{background:#f59e0b}\n' +
    '.section.dng{background:#dc2626}\n' +
    'table{width:100%;border-collapse:collapse;margin:6px 0;font-size:10px}\n' +
    'th,td{border:1px solid #cbd5e1;padding:5px 6px;text-align:right;vertical-align:top}\n' +
    'th{background:#e0f2fe;font-weight:800;font-size:9.5px;color:#0c4a6e}\n' +
    'tr:nth-child(even) td{background:#f8fafc}\n' +
    '.critical-row td{background:#fef2f2!important;color:#991b1b;font-weight:700}\n' +
    '.box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;margin:6px 0;font-size:10.5px;line-height:1.7}\n' +
    '.box p{margin:3px 0}\n' +
    '.box strong{color:#0891b2}\n' +
    '.sigs{display:flex;justify-content:space-between;margin-top:24px;padding-top:10px;border-top:1px solid #cbd5e1;gap:12px}\n' +
    '.sig{flex:1;text-align:center;font-size:10px}\n' +
    '.sig .lbl{font-weight:800;margin-bottom:24px;color:#64748b}\n' +
    '.sig .line{border-top:1px solid #94a3b8;padding-top:4px;font-family:monospace;font-size:9px;color:#475569}\n' +
    '.footer{margin-top:20px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:8.5px;color:#94a3b8;text-align:center;font-family:monospace}\n' +
    '.stamp{display:inline-block;background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:800}\n' +
    '.stamp.warn{background:#fef3c7;color:#92400e}\n' +
    '.stamp.dng{background:#fee2e2;color:#991b1b}\n' +
    '@media print{body{margin:0}.no-print{display:none}}\n' +
    '</style>\n</head>\n<body>\n' +
    '<div class="header">\n' +
    '  <div>\n' +
    '    <div class="hospital">🫀 بیمارستان سینا</div>\n' +
    '    <div class="hospital-sub">تهران — مرکز درمانی تخصصی</div>\n' +
    '    <div class="hospital-sub">دانشگاه علوم پزشکی تهران</div>\n' +
    '  </div>\n' +
    '  <div class="title-block">\n' +
    '    <div class="t">' + esc(title) + '</div>\n' +
    '    <div class="d">' + esc(subtitle || '') + '</div>\n' +
    '    <div class="d">' + jDate() + '</div>\n' +
    '  </div>\n' +
    '</div>\n' +
    body + '\n' +
    (footer || '') + '\n' +
    '<div class="footer">' + docCode() + ' · ' + new Date().toISOString() + ' · سیستم نبض (NABZ v1.0)</div>\n' +
    '</body>\n</html>';
}

function patientInfoBlock(p) {
  if (!p) return '';
  const allergy = (p.allergies || []).length ? p.allergies.join('، ') : '—';
  return '<div class="pat-info">' +
    '<div><div class="lbl">نام</div><div class="val">' + esc(p.firstName + ' ' + p.lastName) + '</div></div>' +
    '<div><div class="lbl">MRN</div><div class="val">' + esc(p.mrn || '—') + '</div></div>' +
    '<div><div class="lbl">سن / جنسیت</div><div class="val">' + (p.age || '—') + ' سال · ' + (p.sex === 'female' ? 'زن' : 'مرد') + '</div></div>' +
    '<div><div class="lbl">بخش</div><div class="val">' + esc(p.wardCode || '') + '</div></div>' +
    '<div><div class="lbl">تخت</div><div class="val">' + esc(p.bedNumber || '—') + '</div></div>' +
    '<div><div class="lbl">وضعیت کد</div><div class="val">' + esc((p.codeStatus || 'full').toUpperCase()) + '</div></div>' +
    '<div style="grid-column:span 2"><div class="lbl">تشخیص</div><div class="val">' + esc(p.diagnosis || '—') + '</div></div>' +
    '<div><div class="lbl">آلرژی</div><div class="val ' + (allergy !== '—' ? 'dng' : '') + '">' + esc(allergy) + '</div></div>' +
    '</div>';
}

// ═══════════════════════════════════════════════════════════
//  Document generators
// ═══════════════════════════════════════════════════════════
function kardex(ctx) {
  const pid = ctx.params.patientId;
  const p = ctx.store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const orders = h(ctx, 'orders').filter(o => o.patientId === pid).sort((a, b) => sd(b.orderedAt) - sd(a.orderedAt));

  let body = patientInfoBlock(p);
  body += '<div class="section">📋 دستورات فعال</div>';
  if (!orders.length) {
    body += '<div class="box">دستوری ثبت نشده است.</div>';
  } else {
    body += '<table><thead><tr><th>#</th><th>نوع</th><th>اولویت</th><th>جزئیات</th><th>وضعیت</th><th>زمان</th></tr></thead><tbody>';
    orders.forEach((o, i) => {
      const d = o.details || {};
      const detail = d.drug ? (d.drug + ' ' + (d.dose || '') + ' · ' + (d.route || '') + ' · ' + (d.frequency || '')) :
                     d.panel ? ('پنل: ' + d.panel) :
                     d.notes ? d.notes : JSON.stringify(d).slice(0, 60);
      body += '<tr' + (o.priority === 'stat' ? ' class="critical-row"' : '') + '>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + esc(o.type) + '</td>' +
        '<td>' + esc(o.priority || 'routine') + '</td>' +
        '<td>' + esc(detail) + '</td>' +
        '<td>' + esc(o.status) + '</td>' +
        '<td>' + jDateTime(o.orderedAt) + '</td></tr>';
    });
    body += '</tbody></table>';
  }
  const sigs = '<div class="sigs">' +
    '<div class="sig"><div class="lbl">امضای پزشک معالج</div><div class="line">' + esc(p.attendingId || '_________________') + '</div></div>' +
    '<div class="sig"><div class="lbl">تأیید سرپرستار</div><div class="line">_________________</div></div>' +
    '</div>';
  return { html: docShell('کاردکس بیمار', 'KARDEX', body, sigs), title: 'کاردکس — ' + p.firstName + ' ' + p.lastName };
}

function mar(ctx) {
  const pid = ctx.params.patientId;
  const p = ctx.store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const records = h(ctx, 'mar').filter(m => m.patientId === pid)
    .sort((a, b) => sd(b.scheduledAt) - sd(a.scheduledAt));

  let body = patientInfoBlock(p);
  body += '<div class="section">💊 MAR — گزارش توزیع دارو</div>';
  if (!records.length) {
    body += '<div class="box">MAR ثبت نشده است.</div>';
  } else {
    const given = records.filter(m => m.status === 'given').length;
    const missed = records.filter(m => m.status === 'missed').length;
    const scheduled = records.filter(m => m.status === 'scheduled' || m.status === 'due').length;
    body += '<div class="box"><strong>خلاصه:</strong> ' + given + ' توزیع · ' + missed + ' missed · ' + scheduled + ' در انتظار · مجموع ' + records.length + '</div>';
    body += '<table><thead><tr><th>#</th><th>دارو</th><th>دوز</th><th>مسیر</th><th>وضعیت</th><th>زمان برنامه</th><th>توزیع‌کننده</th><th>شاهد</th></tr></thead><tbody>';
    records.forEach((m, i) => {
      const isHA = m.isHighAlert;
      body += '<tr' + (m.status === 'missed' || isHA ? ' class="critical-row"' : '') + '>' +
        '<td>' + (i + 1) + (isHA ? ' ⚠️' : '') + '</td>' +
        '<td>' + esc(m.drugName || '') + '</td>' +
        '<td>' + esc(m.dose || '') + '</td>' +
        '<td>' + esc(m.route || '') + '</td>' +
        '<td><span class="stamp ' + (m.status === 'given' ? '' : m.status === 'missed' ? 'dng' : 'warn') + '">' + esc(m.status) + '</span></td>' +
        '<td>' + jDateTime(m.scheduledAt) + '</td>' +
        '<td>' + esc(m.administeredBy ? (m.administeredBy.slice(0, 12)) : '—') + '</td>' +
        '<td>' + esc(m.witnessedBy ? (m.witnessedBy.slice(0, 12)) : '—') + '</td></tr>';
    });
    body += '</tbody></table>';
  }
  const sigs = '<div class="sigs">' +
    '<div class="sig"><div class="lbl">پرستار توزیع‌کننده</div><div class="line">_________________</div></div>' +
    '<div class="sig"><div class="lbl">شاهد (پرخطرها)</div><div class="line">_________________</div></div>' +
    '<div class="sig"><div class="lbl">سرپرستار</div><div class="line">_________________</div></div>' +
    '</div>';
  return { html: docShell('MAR — توزیع دارو', 'MEDICATION ADMINISTRATION RECORD', body, sigs), title: 'MAR — ' + p.firstName + ' ' + p.lastName };
}

function discharge(ctx) {
  const id = ctx.params.planId;
  const plan = ctx.store.get('discharges', id);
  if (!plan) throw ctx.E.notFound('plan_not_found');
  const p = ctx.store.get('patients', plan.patientId);

  let body = p ? patientInfoBlock(p) : '<div class="box">بیمار یافت نشد</div>';
  body += '<div class="section">🚪 خلاصه ترخیص</div>';

  const s = plan.summary || {};
  body += '<div class="box">';
  body += '<p><strong>تشخیص نهایی:</strong> ' + esc(s.finalDiagnosis || '—') + '</p>';
  const meds = Array.isArray(s.medications) ? s.medications.map(m => m.drug || m.name || m).join('، ') : (s.medications || '—');
  body += '<p><strong>داروها:</strong> ' + esc(meds) + '</p>';
  body += '<p><strong>توصیه پیگیری:</strong> ' + esc(s.followupInstructions || '—') + '</p>';
  if (plan.education) {
    body += '<p><strong>آموزش:</strong> ' + (plan.education.completed ? '✅ انجام شده' : '—') +
           ' · Topics: ' + esc((plan.education.topics || []).join('، ')) + '</p>';
  }
  if (plan.followup) {
    body += '<p><strong>پیگیری:</strong> ' + jDate(plan.followup.date) + ' · ' + esc(plan.followup.type || '') + '</p>';
  }
  body += '</div>';

  body += '<div class="section">📊 اطلاعات ترخیص</div>';
  body += '<div class="box">' +
    '<p><strong>نوع ترخیص:</strong> ' + esc(plan.dischargeType || 'home') + '</p>' +
    '<p><strong>وضعیت:</strong> ' + esc(plan.status) + '</p>' +
    '<p><strong>زمان برنامه:</strong> ' + jDateTime(plan.plannedAt) + '</p>' +
    '</div>';

  const sigs = '<div class="sigs">' +
    '<div class="sig"><div class="lbl">پزشک معالج</div><div class="line">_________________</div></div>' +
    '<div class="sig"><div class="lbl">پرستار ترخیص</div><div class="line">_________________</div></div>' +
    '<div class="sig"><div class="lbl">امضای بیمار / همراه</div><div class="line">_________________</div></div>' +
    '</div>';
  return { html: docShell('خلاصه ترخیص', 'DISCHARGE SUMMARY', body, sigs), title: 'ترخیص — ' + (p ? p.firstName + ' ' + p.lastName : '?') };
}

function handover(ctx) {
  const id = ctx.params.handoverId;
  const hnd = ctx.store.get('handovers', id);
  if (!hnd) throw ctx.E.notFound('handover_not_found');

  let body = '<div class="box">' +
    '<p><strong>بخش:</strong> ' + esc(hnd.wardCode) + ' · <strong>شیفت:</strong> ' + esc(hnd.shiftType) + '</p>' +
    '<p><strong>از:</strong> ' + esc(hnd.fromUserName) + ' · <strong>به:</strong> ' + esc(hnd.toUserName || 'در انتظار') + '</p>' +
    '<p><strong>وضعیت:</strong> ' + esc(hnd.status) + '</p>' +
    '</div>';

  body += '<div class="section">📝 موارد تحویل (ISBAR)</div>';
  const entries = hnd.entries || [];
  if (!entries.length) {
    body += '<div class="box">موردی ثبت نشده</div>';
  } else {
    entries.forEach((e, i) => {
      body += '<div class="box">';
      body += '<p><strong>' + (i + 1) + '. ' + esc(e.patientName) + '</strong> — تخت ' + esc(e.bedNumber || '—') + ' · اولویت: ' + esc(e.priority) + '</p>';
      const isbar = e.isbar || {};
      if (isbar.situation) body += '<p><strong>S:</strong> ' + esc(isbar.situation) + '</p>';
      if (isbar.background) body += '<p><strong>B:</strong> ' + esc(isbar.background) + '</p>';
      if (isbar.assessment) body += '<p><strong>A:</strong> ' + esc(isbar.assessment) + '</p>';
      if (isbar.recommendation) body += '<p><strong>R:</strong> ' + esc(isbar.recommendation) + '</p>';
      body += '</div>';
    });
  }

  const sigs = '<div class="sigs">' +
    '<div class="sig"><div class="lbl">پرستار تحویل‌دهنده</div><div class="line">' + esc(hnd.fromUserName) + '</div></div>' +
    '<div class="sig"><div class="lbl">پرستار تحویل‌گیرنده</div><div class="line">' + esc(hnd.toUserName || '_________________') + '</div></div>' +
    '</div>';
  return { html: docShell('تحویل شیفت', 'SHIFT HANDOVER', body, sigs), title: 'تحویل — ' + hnd.wardCode };
}

function nursingReport(ctx) {
  const id = ctx.params.reportId;
  const r = ctx.store.get('nursing_reports', id);
  if (!r) throw ctx.E.notFound('report_not_found');
  const p = ctx.store.get('patients', r.patientId);

  let body = p ? patientInfoBlock(p) : '';
  const isbar = r.isbar || {};
  const sit = isbar.situation || {};
  const bg = isbar.background || {};
  const asmt = isbar.assessment || {};
  const rec = isbar.recommendation || {};

  if (r.uniqueCode) {
    body += '<div class="box"><strong>🔐 کد امضا:</strong> <span style="font-family:monospace">' + esc(r.uniqueCode) + '</span> · ' + jDateTime(r.signedAt) + '</div>';
  }

  body += '<div class="section">📌 S — وضعیت</div><div class="box"><p>' + esc(sit.currentIssue || '—') + '</p>' +
    (sit.vitals ? '<p style="font-size:10px;color:#64748b">' + esc(sit.vitals) + '</p>' : '') + '</div>';

  body += '<div class="section">📚 B — سابقه</div><div class="box"><p>' + esc(bg.reason || '—') + '</p>' +
    (bg.history ? '<p style="font-size:10px;color:#64748b">' + esc(bg.history) + '</p>' : '') + '</div>';

  body += '<div class="section">🔍 A — ارزیابی</div><div class="box"><p>' + esc(asmt.clinicalImpression || '—') + '</p></div>';

  body += '<div class="section">📋 R — پیگیری</div><div class="box"><p>' + esc(rec.followUp || '—') + '</p></div>';

  const sigs = '<div class="sigs">' +
    '<div class="sig"><div class="lbl">پرستار ثبت‌کننده</div><div class="line">' + esc(r.fromUserName) + '</div></div>' +
    '<div class="sig"><div class="lbl">سرپرستار</div><div class="line">_________________</div></div>' +
    '</div>';
  return { html: docShell('گزارش پرستاری', 'NURSING REPORT (ISBAR)', body, sigs), title: 'گزارش — ' + r.patientName };
}

function wardCensus(ctx) {
  const ward = ctx.params.wardCode;
  const w = sina.WARDS.find(x => x.code === ward);
  const beds = h(ctx, 'beds').filter(b => b.wardCode === ward);
  const patients = h(ctx, 'patients').filter(p => p.wardCode === ward && ['in_care','admitted'].includes(p.status));

  let body = '<div class="box"><p><strong>بخش:</strong> ' + esc(w ? w.label : ward) + ' · ' +
    '<strong>سرپرستار:</strong> ' + esc(w ? w.headNurse : '—') + '</p>' +
    '<p><strong>تعداد تخت:</strong> ' + beds.length + ' · <strong>اشغال:</strong> ' + beds.filter(b => b.status === 'occupied').length + '</p></div>';

  body += '<div class="section">👥 بیماران بستری</div>';
  if (!patients.length) {
    body += '<div class="box">بیماری بستری نیست</div>';
  } else {
    body += '<table><thead><tr><th>#</th><th>نام</th><th>سن</th><th>تخت</th><th>تشخیص</th><th>آلرژی</th><th>وضعیت کد</th></tr></thead><tbody>';
    patients.forEach((p, i) => {
      body += '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + esc(p.firstName + ' ' + p.lastName) + '</td>' +
        '<td>' + (p.age || '—') + '</td>' +
        '<td>' + esc(p.bedNumber || '—') + '</td>' +
        '<td>' + esc(p.diagnosis || '—') + '</td>' +
        '<td>' + ((p.allergies || []).length ? esc(p.allergies.join('، ')) : '—') + '</td>' +
        '<td>' + esc((p.codeStatus || 'full').toUpperCase()) + '</td></tr>';
    });
    body += '</tbody></table>';
  }

  const sigs = '<div class="sigs">' +
    '<div class="sig"><div class="lbl">سرپرستار بخش</div><div class="line">' + esc(w ? w.headNurse : '_________________') + '</div></div>' +
    '</div>';
  return { html: docShell('لیست بیماران بخش', 'WARD CENSUS', body, sigs), title: 'لیست — ' + (w ? w.label : ward) };
}

function vitalsChart(ctx) {
  const pid = ctx.params.patientId;
  const p = ctx.store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const vitals = h(ctx, 'vitals').filter(v => v.patientId === pid)
    .filter(v => sd(v.recordedAt) > Date.now() - 7 * 86400000)
    .sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));

  let body = patientInfoBlock(p);
  body += '<div class="section">📈 علائم حیاتی — ۷ روز</div>';
  if (!vitals.length) {
    body += '<div class="box">ویتال ثبت نشده</div>';
  } else {
    body += '<table><thead><tr><th>زمان</th><th>HR</th><th>BP</th><th>RR</th><th>T</th><th>SpO₂</th><th>NEWS2</th></tr></thead><tbody>';
    vitals.forEach(v => {
      const news = v.news2 || v.newsScore || 0;
      body += '<tr' + (news >= 7 ? ' class="critical-row"' : '') + '>' +
        '<td>' + jDateTime(v.recordedAt) + '</td>' +
        '<td>' + (v.hr || '—') + '</td>' +
        '<td>' + (v.bp_sys || '—') + '/' + (v.bp_dia || '—') + '</td>' +
        '<td>' + (v.rr || '—') + '</td>' +
        '<td>' + (v.temp || '—') + '°</td>' +
        '<td>' + (v.spo2 || '—') + '%</td>' +
        '<td><strong>' + news + '</strong></td></tr>';
    });
    body += '</tbody></table>';
  }
  return { html: docShell('نمودار علائم حیاتی', 'VITAL SIGNS CHART', body, ''), title: 'ویتال — ' + p.firstName + ' ' + p.lastName };
}

// ═══════════════════════════════════════════════════════════
//  Handler for frontend
// ═══════════════════════════════════════════════════════════
function getDocument(ctx) {
  const type = ctx.params.type;
  const generators = {
    kardex, mar, discharge, handover, nursingReport, wardCensus, vitalsChart
  };
  const gen = generators[type];
  if (!gen) throw ctx.E.badRequest('invalid_doc_type');
  return gen(ctx);
}

function listTypes(ctx) {
  return {
    types: [
      { id: 'kardex', title: 'کاردکس', icon: '📋', param: 'patientId' },
      { id: 'mar', title: 'MAR', icon: '💊', param: 'patientId' },
      { id: 'vitalsChart', title: 'نمودار ویتال', icon: '📈', param: 'patientId' },
      { id: 'discharge', title: 'خلاصه ترخیص', icon: '🚪', param: 'planId' },
      { id: 'handover', title: 'تحویل شیفت', icon: '🔄', param: 'handoverId' },
      { id: 'nursingReport', title: 'گزارش پرستاری', icon: '📝', param: 'reportId' },
      { id: 'wardCensus', title: 'لیست بخش', icon: '👥', param: 'wardCode' }
    ]
  };
}

module.exports = {
  handlers: { getDocument, listTypes },
  routes: [
    { method: 'GET', path: '/api/docs/types', handler: 'listTypes', perm: null },
    { method: 'GET', path: '/api/docs/:type/:patientId', handler: 'getDocument', perm: null }
  ],
  panels: []
};
DOCS_EOF
echo "✅ documents.js — 7 document types"

# ─── ۲) Frontend: print & share ───
cat > public/documents.js << 'PRINT_EOF'
// ═══════════════════════════════════════════════════════════
//  NABZ Documents — Print, Share, Viewer
// ═══════════════════════════════════════════════════════════

NABZ.openDoc = async function(type, paramValue) {
  try {
    NABZ._toast('در حال آماده‌سازی...');
    const doc = await NABZ._api('/api/docs/' + type + '/' + paramValue);
    NABZ._showDocViewer(doc.html, doc.title);
  } catch (e) {
    alert('خطا: ' + e.message);
  }
};

NABZ._showDocViewer = function(html, title) {
  const sheet = document.createElement('div');
  sheet.className = 'bs-backdrop';
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };

  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">📄 ' + NABZ._esc(title) + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div style="display:flex;gap:8px;margin-bottom:14px">';
  h += '<button class="btn btn-primary" style="flex:1;padding:12px" onclick="NABZ._printDoc(\'' + encodeURIComponent(html) + '\')">🖨️ چاپ / PDF</button>';
  h += '<button class="btn" style="flex:1;padding:12px" onclick="NABZ._shareDoc(\'' + encodeURIComponent(html) + '\',\'' + encodeURIComponent(title) + '\')">📤 اشتراک</button>';
  h += '</div>';
  h += '<div style="background:#fff;border-radius:8px;overflow:hidden;max-height:60vh;overflow-y:auto">';
  h += '<iframe id="docPreview" style="width:100%;height:60vh;border:none" srcdoc="' + html.replace(/"/g, '&quot;') + '"></iframe>';
  h += '</div>';

  const c = document.createElement('div');
  c.className = 'bs-sheet';
  c.style.maxHeight = '95vh';
  c.innerHTML = h;
  sheet.appendChild(c);
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('show'));
};

NABZ._printDoc = function(encodedHtml) {
  const html = decodeURIComponent(encodedHtml);
  const w = window.open('', '_blank');
  if (!w) { alert('پاپ‌آپ مسدود است'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    try { w.focus(); w.print(); } catch (_) { alert('لطفاً Ctrl+P بزنید'); }
  }, 600);
};

NABZ._shareDoc = async function(encodedHtml, encodedTitle) {
  const html = decodeURIComponent(encodedHtml);
  const title = decodeURIComponent(encodedTitle);
  try {
    if (navigator.share) {
      // Try file share first (for real PDF/text)
      const blob = new Blob([html], { type: 'text/html' });
      const file = new File([blob], title.replace(/\s+/g, '_') + '.html', { type: 'text/html' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: title });
        return;
      }
      // Fallback: text share
      await navigator.share({ title: title, text: 'سند از سیستم نبض — بیمارستان سینا' });
    } else {
      // Fallback: copy title to clipboard
      await navigator.clipboard.writeText(title + '\n\n' + html.slice(0, 500) + '...');
      NABZ._toast('لینک در کلیپ‌بورد کپی شد');
    }
  } catch (e) {
    if (e.name !== 'AbortError') NABZ._toast('اشتراک ممکن نشد');
  }
};

NABZ._toast = function(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:calc(var(--nav-h) + 20px);left:50%;transform:translateX(-50%);background:var(--bg-elev);color:var(--fg);padding:10px 20px;border-radius:24px;box-shadow:var(--sh-lg);font-size:13px;font-weight:800;z-index:9999;border:1px solid var(--border-2);pointer-events:none';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
};
PRINT_EOF
echo "✅ documents.js frontend"

# ─── ۳) Frontend: QR Scanner ───
cat > public/scanner.js << 'SCANNER_EOF'
// ═══════════════════════════════════════════════════════════
//  NABZ QR Scanner — Camera + BarcodeDetector
// ═══════════════════════════════════════════════════════════

NABZ.openQRScanner = async function() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('دوربین در دسترس نیست. از ورود دستی استفاده کنید.');
    return NABZ._qrManualPrompt();
  }

  const modal = document.createElement('div');
  modal.className = 'qr-modal';
  modal.innerHTML =
    '<div class="qr-hdr"><button class="qr-close" onclick="NABZ._closeQR()">✕</button><span>📷 اسکن QR</span></div>' +
    '<div class="qr-video-wrap"><video id="qrVideo" autoplay playsinline muted></video>' +
    '<div class="qr-frame"></div>' +
    '<div class="qr-loading" id="qrLoading"><div class="spinner"></div></div>' +
    '</div>' +
    '<div class="qr-hint" id="qrHint">کد QR بخش را در کادر قرار دهید</div>' +
    '<div class="qr-manual">' +
    '<input id="qrManual" placeholder="یا کد را دستی وارد کنید">' +
    '<button onclick="NABZ._qrManualInput()">تأیید</button>' +
    '</div>';
  document.body.appendChild(modal);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    modal._stream = stream;
    const video = document.getElementById('qrVideo');
    video.srcObject = stream;

    // Wait for video metadata
    await new Promise(resolve => {
      if (video.readyState >= 2) resolve();
      else video.onloadedmetadata = resolve;
    });
    document.getElementById('qrLoading').style.display = 'none';

    // BarcodeDetector support?
    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      let stopped = false;

      const scanLoop = async () => {
        if (stopped || !document.body.contains(modal)) return;
        try {
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const codes = await detector.detect(video);
            if (codes.length > 0) {
              stopped = true;
              NABZ._qrProcess(codes[0].rawValue);
              return;
            }
          }
        } catch (_) {}
        if (!stopped) requestAnimationFrame(scanLoop);
      };
      scanLoop();
    } else {
      // No BarcodeDetector — notify user
      document.getElementById('qrHint').textContent = '⚠️ مرورگر از اسکن خودکار پشتیبانی نمی‌کند — کد را دستی وارد کنید';
      document.getElementById('qrHint').style.background = 'rgba(245,158,11,0.9)';
    }
  } catch (e) {
    NABZ._closeQR();
    if (e.name === 'NotAllowedError') {
      alert('اجازه دسترسی به دوربین داده نشد.');
    } else {
      alert('خطا: ' + e.message);
    }
  }
};

NABZ._closeQR = function() {
  const modal = document.querySelector('.qr-modal');
  if (!modal) return;
  if (modal._stream) {
    modal._stream.getTracks().forEach(t => t.stop());
  }
  modal.remove();
};

NABZ._qrManualPrompt = function() {
  const code = prompt('کد QR را وارد کنید:');
  if (code) NABZ._qrProcess(code);
};

NABZ._qrManualInput = function() {
  const inp = document.getElementById('qrManual');
  if (!inp || !inp.value.trim()) return;
  NABZ._qrProcess(inp.value.trim());
};

NABZ._qrProcess = async function(code) {
  NABZ._closeQR();
  NABZ._toast('در حال بررسی کد...');
  try {
    const r = await NABZ._api('/api/qr/scan', { method: 'POST', body: JSON.stringify({ code: code }) });
    const action = r.action === 'checkin' ? 'ثبت ورود' : 'ثبت خروج';
    NABZ._toast('✅ ' + action + ' — بخش ' + r.ward);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    // Refresh current panel
    if (NABZ.state.current) NABZ.show(NABZ.state.current);
  } catch (e) {
    alert('❌ ' + e.message);
  }
};
SCANNER_EOF
echo "✅ scanner.js frontend"

# ─── ۴) CSS for scanner + print ───
cat >> public/style.css << 'CSS'

/* ═══════════════════════════════════════════════════════════
   QR Scanner Modal
   ═══════════════════════════════════════════════════════════ */
.qr-modal{
  position:fixed;inset:0;
  background:#000;
  z-index:9999;
  display:flex;flex-direction:column;
  animation:fade-in 0.2s ease;
}
.qr-hdr{
  background:rgba(0,0,0,0.7);
  color:#fff;
  padding:16px 20px;
  display:flex;align-items:center;gap:16px;
  font-size:16px;font-weight:900;
  flex-shrink:0;
  backdrop-filter:blur(10px);
}
.qr-close{
  width:40px;height:40px;
  border:none;background:rgba(255,255,255,0.15);color:#fff;
  border-radius:50%;font-size:18px;cursor:pointer;
  display:grid;place-items:center;
}
.qr-video-wrap{
  flex:1;
  position:relative;
  overflow:hidden;
  display:flex;align-items:center;justify-content:center;
}
#qrVideo{
  width:100%;height:100%;object-fit:cover;
}
.qr-frame{
  position:absolute;
  width:240px;height:240px;
  border:3px solid var(--primary);
  border-radius:24px;
  box-shadow:0 0 0 9999px rgba(0,0,0,0.55),0 0 40px rgba(6,182,212,0.6);
  animation:pulse-frame 1.8s infinite;
}
@keyframes pulse-frame{
  0%,100%{box-shadow:0 0 0 9999px rgba(0,0,0,0.55),0 0 20px rgba(6,182,212,0.4)}
  50%{box-shadow:0 0 0 9999px rgba(0,0,0,0.55),0 0 50px rgba(6,182,212,0.8)}
}
.qr-frame::before,.qr-frame::after{
  content:'';position:absolute;width:28px;height:28px;border:4px solid var(--primary);
}
.qr-frame::before{top:-4px;left:-4px;border-right:none;border-bottom:none;border-radius:24px 0 0 0}
.qr-frame::after{bottom:-4px;right:-4px;border-left:none;border-top:none;border-radius:0 0 24px 0}
.qr-loading{
  position:absolute;
  inset:0;display:grid;place-items:center;
  background:rgba(0,0,0,0.4);
}
.qr-hint{
  background:rgba(6,182,212,0.9);
  color:#fff;
  padding:12px 20px;
  text-align:center;
  font-size:13px;font-weight:800;
  flex-shrink:0;
  transition:background 0.2s;
}
.qr-manual{
  background:var(--bg-elev);
  padding:16px 20px calc(16px + var(--safe-b));
  display:flex;gap:8px;
  flex-shrink:0;
}
.qr-manual input{
  flex:1;
  padding:12px 16px;
  border:1.5px solid var(--border-2);
  background:var(--bg-2);color:var(--fg);
  border-radius:10px;
  font-family:var(--mono);font-size:13px;
  outline:none;
}
.qr-manual input:focus{
  border-color:var(--primary);
  box-shadow:0 0 0 3px var(--primary-soft);
}
.qr-manual button{
  padding:12px 20px;
  background:var(--g-primary);color:#fff;
  border:none;border-radius:10px;
  font-family:inherit;font-size:13px;font-weight:900;
  cursor:pointer;
}
CSS
echo "✅ CSS scanner styles"

# ─── ۵) Patch index.html — add scripts ───
node << 'IDX'
const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');
if (!h.includes('documents.js')) {
  h = h.replace('<script src="/extra.js"></script>',
    '<script src="/extra.js"></script>\n<script src="/documents.js"></script>\n<script src="/scanner.js"></script>');
  fs.writeFileSync('public/index.html', h);
  console.log('✅ index.html — documents + scanner added');
}
IDX

# ─── ۶) Patch app.js — add print + scanner buttons to header ───
node << 'APP'
const fs = require('fs');
let s = fs.readFileSync('public/app.js', 'utf8');

// Add QR scan + doc action to header (after search button)
if (!s.includes("openQRScanner")) {
  const old = '<button class="hbtn" onclick="NABZ.showSearch()" title="جستجو">🔍</button>';
  const neu = '<button class="hbtn" onclick="NABZ.openQRScanner()" title="اسکن QR">📷</button>\n<button class="hbtn" onclick="NABZ.showSearch()" title="جستجو">🔍</button>';
  // index.html has this header; app.js doesn't directly
}

// Add print buttons to showItem - inject before actions
if (!s.includes("_showDocButtons")) {
  // Find the point after bs-body close, before Actions
  const marker = "      html += '</div>';\n      // ─── Actions ───";
  const neu = "      html += '</div>';\n      // ─── Document actions ───\n      const docBtns = NABZ._docButtonsFor(pid, item);\n      if (docBtns) html += docBtns;\n      // ─── Actions ───";
  if (s.includes(marker)) {
    s = s.replace(marker, neu);
    console.log('✅ showItem patched for doc buttons');
  }
}

// Add _docButtonsFor function + export
if (!s.includes("_docButtonsFor")) {
  const addon = `

// ═══════════════════════════════════════════════════════════
//  Document buttons resolver
// ═══════════════════════════════════════════════════════════
function _docButtonsFor(panelId, item) {
  const btn = (label, type, val) => '<button class="btn btn-block" style="margin-top:6px;background:var(--bg-3);padding:10px;font-size:12px" onclick="NABZ.openDoc(\\'' + type + '\\',\\'' + val + '\\')">' + label + '</button>';
  let html = '';
  const pid = item.patientId || item.id;
  if (panelId === 'clinical.patients' && item.id) {
    html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)"><div style="font-size:12px;font-weight:900;margin-bottom:8px">📄 اسناد</div>' +
      btn('📋 کاردکس', 'kardex', item.id) +
      btn('💊 MAR', 'mar', item.id) +
      btn('📈 نمودار ویتال', 'vitalsChart', item.id) +
      '</div>';
  } else if (panelId === 'workflow.discharge' && item.id) {
    html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">' +
      btn('🚪 خلاصه ترخیص', 'discharge', item.id) + '</div>';
  } else if (panelId === 'workflow.handover' && item.id) {
    html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">' +
      btn('📄 چاپ تحویل', 'handover', item.id) + '</div>';
  } else if (panelId === 'nursing_report.nursing' && item.id) {
    html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">' +
      btn('📄 چاپ گزارش', 'nursingReport', item.id) + '</div>';
  } else if (panelId === 'bedboard.wards' && item.code) {
    html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">' +
      btn('👥 لیست بخش', 'wardCensus', item.code) + '</div>';
  }
  return html;
}
`;
  s = s.replace('async function showNeural() {', addon + '\nasync function showNeural() {');
  // Export
  s = s.replace('return { boot, show, showNeural, showAlerts, refresh, logout, showItem, openForm, showDrawer, hideDrawer, runAction, state: S };',
    'return { boot, show, showNeural, showAlerts, refresh, logout, showItem, openForm, showDrawer, hideDrawer, runAction, _docButtonsFor, state: S };');
  console.log('✅ _docButtonsFor added');
}

fs.writeFileSync('public/app.js', s);
APP

# ─── ۷) Patch header buttons — add QR scan ───
node << 'HDR'
const fs = require('fs');
let h = fs.readFileSync('public/index.html', 'utf8');
if (!h.includes('openQRScanner')) {
  h = h.replace(
    '<button class="hbtn" onclick="NABZ.showSearch()" title="جستجو">🔍</button>',
    '<button class="hbtn" onclick="NABZ.openQRScanner()" title="اسکن QR">📷</button>\n<button class="hbtn" onclick="NABZ.showSearch()" title="جستجو">🔍</button>'
  );
  fs.writeFileSync('public/index.html', h);
  console.log('✅ header — QR scan button added');
}
HDR

# ─── ۸) Verify all syntax ───
echo ""
echo "─── Verify ───"
node -e "require('./modules/documents.js')" && echo "✅ documents.js OK"
node -e "new Function(require('fs').readFileSync('public/documents.js','utf8'))" && echo "✅ public/documents.js OK"
node -e "new Function(require('fs').readFileSync('public/scanner.js','utf8'))" && echo "✅ public/scanner.js OK"

# ─── ۹) Restart ───
for pid in $(pgrep -f "core/server.js" 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done
sleep 1

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ Part 12 — Documents + QR Scanner        ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "7 documents:  kardex · mar · vitalsChart · discharge · handover · nursingReport · wardCensus"
echo "QR Scanner:   camera + BarcodeDetector + manual fallback"
echo ""
echo "Next:"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
