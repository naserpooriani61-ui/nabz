const { h, sd, sg, list } = require('../core/mod-helpers');
const CHARTER_AXES = [
  {axis:1, title:'دریافت مطلوب خدمات'},
  {axis:2, title:'اطلاعات کافی'},
  {axis:3, title:'حق انتخاب'},
  {axis:4, title:'حریم خصوصی'},
  {axis:5, title:'رسیدگی به شکایات'}
];

const getCharter = (ctx) => ({ version: '1404', axes: CHARTER_AXES });
const charterStatus = (ctx) => {
  const consents = h(ctx, 'patient_consents');
  const complaints = h(ctx, 'patient_complaints');
  const privacy = h(ctx, 'privacy_checks');
  const axes = CHARTER_AXES.map(a => ({
    ...a,
    monitored: (a.axis === 1 || a.axis === 2) ? consents.length > 0 :
               a.axis === 3 ? consents.length > 0 :
               a.axis === 4 ? privacy.length > 0 :
               complaints.length > 0
  }));
  return { version: '1404', axes };
};

const consents = list('patient_consents', 'createdAt');
const createConsent = (ctx) => {
  const b = ctx.body;
  if (!b.patientId || !b.consentType) throw ctx.E.badRequest('missing');
  const p = ctx.store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const rec = { id: ctx.uid('cons'), patientId: p.id,
    patientName: p.firstName + ' ' + p.lastName, wardCode: p.wardCode,
    consentType: b.consentType, procedure: b.procedure || '',
    status: 'pending_signature', validUntil: b.validUntil || new Date(Date.now()+30*86400000).toISOString(),
    createdBy: ctx.actor.id, createdAt: ctx.now() };
  ctx.store.put('patient_consents', rec); return rec;
};
const signConsent = (ctx) => {
  const c = ctx.store.get('patient_consents', ctx.params.id);
  if (!c) throw ctx.E.notFound('not_found');
  if (c.status === 'signed') throw ctx.E.conflict('already_signed');
  c.status = 'signed'; c.signedBy = ctx.actor.id; c.signedAt = ctx.now();
  ctx.store.put('patient_consents', c); sg(ctx, 'patient_consents', c, 'sign');
  return c;
};

const complaints = list('patient_complaints', 'filedAt');
const fileComplaint = (ctx) => {
  const b = ctx.body;
  if (!b.description || !b.category) throw ctx.E.badRequest('missing');
  const rec = { id: ctx.uid('cmp'), patientName: b.patientName || 'ناشناس',
    patientId: b.patientId || null, wardCode: b.wardCode || ctx.actor.ward || null,
    category: b.category, description: b.description,
    anonymous: b.anonymous === true, status: 'open',
    filedBy: ctx.actor.id, filedAt: ctx.now() };
  ctx.store.put('patient_complaints', rec);
  ctx.bus.emit('rights.complaint', { record: rec, actor: ctx.actor });
  return rec;
};
const resolveComplaint = (ctx) => {
  const c = ctx.store.get('patient_complaints', ctx.params.id);
  if (!c) throw ctx.E.notFound('not_found');
  if (!ctx.body.resolution) throw ctx.E.badRequest('resolution_required');
  c.status = 'resolved'; c.resolution = ctx.body.resolution;
  c.resolvedAt = ctx.now(); c.resolvedBy = ctx.actor.id;
  ctx.store.put('patient_complaints', c); return c;
};

const privacyChecks = list('privacy_checks', 'checkedAt');
const recordPrivacy = (ctx) => {
  const b = ctx.body;
  if (!b.wardCode) throw ctx.E.badRequest('ward_required');
  const items = ['curtain','handover','record','confidentiality','consent'];
  const passed = items.filter(k => b[k] === true).length;
  const score = Math.round((passed / items.length) * 100);
  const rec = { id: ctx.uid('priv'), wardCode: b.wardCode,
    score, status: score === 100 ? 'compliant' : score >= 60 ? 'partial' : 'non_compliant',
    checkedBy: ctx.actor.id, checkedAt: ctx.now(), notes: b.notes || '' };
  ctx.store.put('privacy_checks', rec); return rec;
};

const education = list('patient_education', 'educatedAt');
const recordEducation = (ctx) => {
  const b = ctx.body;
  if (!b.patientId || !Array.isArray(b.topics)) throw ctx.E.badRequest('missing');
  const p = ctx.store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('not_found');
  const rec = { id: ctx.uid('edu'), patientId: p.id,
    patientName: p.firstName + ' ' + p.lastName, wardCode: p.wardCode,
    topics: b.topics, teachBack: b.teachBack === true,
    educatedBy: ctx.actor.id, educatedAt: ctx.now() };
  ctx.store.put('patient_education', rec); return rec;
};

const stats = (ctx) => ({
  consents: h(ctx,'patient_consents').length,
  pendingConsents: h(ctx,'patient_consents').filter(c => c.status !== 'signed').length,
  complaints: h(ctx,'patient_complaints').length,
  openComplaints: h(ctx,'patient_complaints').filter(c => c.status === 'open').length,
  privacyChecks: h(ctx,'privacy_checks').length,
  education: h(ctx,'patient_education').length
});

module.exports = {
  handlers: { getCharter, charterStatus, consents, createConsent, signConsent,
    complaints, fileComplaint, resolveComplaint,
    privacyChecks, recordPrivacy, education, recordEducation, stats },
  routes: [
    {method:'GET', path:'/api/rights/charter', handler:'getCharter', perm:'rights.view'},
    {method:'GET', path:'/api/rights/charter/status', handler:'charterStatus', perm:'rights.view'},
    {method:'GET', path:'/api/rights/consents', handler:'consents', perm:'rights.view'},
    {method:'POST', path:'/api/rights/consents', handler:'createConsent', perm:'rights.consent'},
    {method:'GET', path:'/api/rights/complaints', handler:'complaints', perm:'rights.view'},
    {method:'POST', path:'/api/rights/complaints', handler:'fileComplaint', perm:'rights.complaint.file'},
    {method:'GET', path:'/api/rights/privacy', handler:'privacyChecks', perm:'rights.view'},
    {method:'POST', path:'/api/rights/privacy', handler:'recordPrivacy', perm:'rights.privacy'},
    {method:'GET', path:'/api/rights/education', handler:'education', perm:'rights.view'},
    {method:'POST', path:'/api/rights/education', handler:'recordEducation', perm:'rights.education'},
    {method:'GET', path:'/api/rights/stats', handler:'stats', perm:'rights.view'},
    {method:'POST', path:'/api/rights/consents/:id/sign', handler:'signConsent', perm:'rights.consent'},
    {method:'POST', path:'/api/rights/complaints/:id/resolve', handler:'resolveComplaint', perm:'rights.complaint.resolve'}
  
  ],
  panels: [
    {id:'charter', title:'منشور حقوق', icon:'⚖️', perm:'rights.view', kind:'stats', api:'/api/rights/charter/status'},
    {id:'consents', title:'رضایت‌نامه‌ها', icon:'✍️', perm:'rights.view', kind:'list',
      api:'/api/rights/consents', fields:['patientName','consentType','status'],
      form:{api:'/api/rights/consents', method:'POST', fields:[
        {name:'patientId', label:'شناسه بیمار', required:true},
        {name:'consentType', label:'نوع (surgery/anesthesia/blood/...)', required:true},
        {name:'procedure', label:'پروسیجر'}
      ]}},
    {id:'complaints', title:'شکایات', icon:'📢', perm:'rights.view', kind:'list',
      api:'/api/rights/complaints', fields:['patientName','category','description','status'],
      form:{api:'/api/rights/complaints', method:'POST', fields:[
        {name:'category', label:'دسته (service/staff/privacy/billing)', required:true},
        {name:'description', label:'شرح', required:true},
        {name:'patientName', label:'نام بیمار (اختیاری)'}
      ]}},
    {id:'privacy', title:'حریم خصوصی', icon:'🔒', perm:'rights.view', kind:'list',
      api:'/api/rights/privacy', fields:['wardCode','score','status']},
    {id:'stats', title:'آمار حقوق', icon:'📊', perm:'rights.view', kind:'stats', api:'/api/rights/stats'}
  ]
};
