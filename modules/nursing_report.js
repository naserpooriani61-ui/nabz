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
    { method:'POST', path:'/api/nr/create', handler:'createReport', perm:'nursing_report.create' },
    { method:'GET', path:'/api/nr/context/:patientId', handler:'getContext', perm:'nursing_report.view' },
    { method:'GET', path:'/api/nr/suggest/:patientId', handler:'getSuggestions', perm:'nursing_report.view' },
    { method:'GET', path:'/api/nr/:id', handler:'getReport', perm:'nursing_report.view' },
    { method:'PUT', path:'/api/nr/:id', handler:'saveDraft', perm:'nursing_report.create' },
    { method:'POST', path:'/api/nr/:id/sign', handler:'signReport', perm:'nursing_report.sign' },
    { method:'POST', path:'/api/nr/:id/receive', handler:'receiveReport', perm:'nursing_report.receive' }
  
  ],
  panels: [
    { id:'nursing', title:'گزارش پرستاری', icon:'📝', perm:'nursing_report.view', kind:'nursing', api:'/api/nr/list' }
  ]
};
