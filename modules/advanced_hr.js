const { h, sd, sg, list } = require('../core/mod-helpers');

// ─── Karanneh Coefficients ───
const coefficients = list('coefficients', 'createdAt');
const createCoefficient = (ctx) => {
  const b = ctx.body;
  if (!b.staffId || !b.periodId) throw ctx.E.badRequest('missing');
  const rec = { id: ctx.uid('coef'), staffId: b.staffId, periodId: b.periodId,
    qualityFactor: Math.max(0.5, Math.min(1.25, Number(b.qualityFactor) || 1)),
    attendanceFactor: Math.max(1, Math.min(2, Number(b.attendanceFactor) || 1)),
    wardDifficulty: Math.max(0.5, Math.min(2, Number(b.wardDifficulty) || 1)),
    status: 'draft', createdBy: ctx.actor.id, createdAt: ctx.now() };
  ctx.store.put('coefficients', rec); return rec;
};
const approveCoefficient = (ctx) => {
  const c = ctx.store.get('coefficients', ctx.params.id);
  if (!c) throw ctx.E.notFound('not_found');
  c.status = 'approved'; c.approvedBy = ctx.actor.id; c.approvedAt = ctx.now();
  ctx.store.put('coefficients', c); return c;
};
const rejectCoefficient = (ctx) => {
  const c = ctx.store.get('coefficients', ctx.params.id);
  if (!c) throw ctx.E.notFound('not_found');
  c.status = 'rejected'; c.rejectedBy = ctx.actor.id;
  c.rejectReason = ctx.body.reason || ''; c.rejectedAt = ctx.now();
  ctx.store.put('coefficients', c); return c;
};

// ─── Appeals ───
const appeals = list('appeals', 'createdAt');
const createAppeal = (ctx) => {
  const b = ctx.body;
  if (!b.subject || !b.description) throw ctx.E.badRequest('missing');
  const priv = b.privacy || 'normal';
  if (!['normal','special','confidential','anonymous'].includes(priv))
    throw ctx.E.badRequest('invalid_privacy');
  const sla = priv === 'normal' ? 48 : priv === 'special' ? 72 : 168;
  const rec = { id: ctx.uid('apl'), subject: b.subject,
    description: b.description, privacy: priv,
    category: b.category || 'general',
    submittedBy: priv === 'anonymous' ? null : ctx.actor.id,
    submittedByName: priv === 'anonymous' ? 'ناشناس' : ctx.actor.username,
    status: 'open', slaHours: sla,
    dueAt: new Date(Date.now() + sla*3600000).toISOString(),
    createdAt: ctx.now() };
  ctx.store.put('appeals', rec); return rec;
};
const reviewAppeal = (ctx) => {
  const a = ctx.store.get('appeals', ctx.params.id);
  if (!a) throw ctx.E.notFound('not_found');
  if (a.status !== 'open') throw ctx.E.conflict('not_open');
  if (!ctx.body.decision) throw ctx.E.badRequest('decision_required');
  a.status = ctx.body.decision === 'accept' ? 'accepted' : 'rejected';
  a.reviewNotes = ctx.body.notes || '';
  a.reviewedBy = ctx.actor.id; a.reviewedAt = ctx.now();
  ctx.store.put('appeals', a); return a;
};

// ─── Extra Services (Claim Board) ───
const extras = list('extra_services', 'createdAt');
const createExtra = (ctx) => {
  const b = ctx.body;
  if (!b.title) throw ctx.E.badRequest('title_required');
  const rec = { id: ctx.uid('xsvc'), title: b.title,
    description: b.description || '', category: b.category || 'clinical',
    difficulty: Number(b.difficulty) || 1,
    urgency: Number(b.urgency) || 1,
    wardCode: b.wardCode || ctx.actor.ward || null,
    status: 'published', claimedBy: null, claimedAt: null,
    completedAt: null, createdBy: ctx.actor.id, createdAt: ctx.now() };
  ctx.store.put('extra_services', rec); return rec;
};
const claimExtra = (ctx) => {
  const x = ctx.store.get('extra_services', ctx.params.id);
  if (!x) throw ctx.E.notFound('not_found');
  // Atomic claim (single-threaded JS, no race)
  if (x.status !== 'published') throw ctx.E.conflict('already_claimed');
  if (x.claimedBy && x.claimedBy !== ctx.actor.id) throw ctx.E.conflict('claimed_by_other');
  x.status = 'claimed'; x.claimedBy = ctx.actor.id;
  x.claimedByName = ctx.actor.username; x.claimedAt = ctx.now();
  ctx.store.put('extra_services', x);
  ctx.bus.emit('extras.claimed', { record: x, actor: ctx.actor });
  return x;
};
const completeExtra = (ctx) => {
  const x = ctx.store.get('extra_services', ctx.params.id);
  if (!x) throw ctx.E.notFound('not_found');
  if (x.claimedBy !== ctx.actor.id && ctx.actor.role !== 'admin')
    throw ctx.E.forbidden('not_your_claim');
  if (x.status !== 'claimed') throw ctx.E.conflict('not_claimed');
  x.status = 'completed'; x.completedAt = ctx.now();
  x.coefficient = Number(x.difficulty) * Number(x.urgency);
  ctx.store.put('extra_services', x);
  ctx.bus.emit('extras.completed', { record: x, actor: ctx.actor });
  return x;
};

const dashboard = (ctx) => ({
  coefficients: {
    total: h(ctx,'coefficients').length,
    approved: h(ctx,'coefficients').filter(c => c.status === 'approved').length,
    pending: h(ctx,'coefficients').filter(c => c.status === 'draft').length
  },
  appeals: {
    open: h(ctx,'appeals').filter(a => a.status === 'open').length,
    accepted: h(ctx,'appeals').filter(a => a.status === 'accepted').length,
    rejected: h(ctx,'appeals').filter(a => a.status === 'rejected').length
  },
  extras: {
    published: h(ctx,'extra_services').filter(x => x.status === 'published').length,
    claimed: h(ctx,'extra_services').filter(x => x.status === 'claimed').length,
    completed: h(ctx,'extra_services').filter(x => x.status === 'completed').length
  }
});

module.exports = {
  handlers: { coefficients, createCoefficient, approveCoefficient, rejectCoefficient,
    appeals, createAppeal, reviewAppeal,
    extras, createExtra, claimExtra, completeExtra, dashboard },
  routes: [

    {method:'GET', path:'/api/hr/coefficients', handler:'coefficients', perm:'karanneh.coefficient.manage'},
    {method:'POST', path:'/api/hr/coefficients', handler:'createCoefficient', perm:'karanneh.coefficient.manage'},
    {method:'GET', path:'/api/hr/appeals', handler:'appeals', perm:'karanneh.appeal.manage'},
    {method:'POST', path:'/api/hr/appeals', handler:'createAppeal', perm:'karanneh.appeal.manage'},
    {method:'GET', path:'/api/hr/extras', handler:'extras', perm:'extras.view'},
    {method:'POST', path:'/api/hr/extras', handler:'createExtra', perm:'extras.manage'},
    {method:'GET', path:'/api/hr/dashboard', handler:'dashboard', perm:'karanneh.coefficient.manage'},
    {method:'POST', path:'/api/hr/coefficients/:id/approve', handler:'approveCoefficient', perm:'karanneh.coefficient.manage'},
    {method:'POST', path:'/api/hr/coefficients/:id/reject', handler:'rejectCoefficient', perm:'karanneh.coefficient.manage'},
    {method:'POST', path:'/api/hr/appeals/:id/review', handler:'reviewAppeal', perm:'karanneh.appeal.manage'},
    {method:'POST', path:'/api/hr/extras/:id/claim', handler:'claimExtra', perm:'extras.view'},
    {method:'POST', path:'/api/hr/extras/:id/complete', handler:'completeExtra', perm:'extras.view'},
  
  ],
  panels: [
    {id:'coefficients', title:'ضرایب کارانه', icon:'🎯', perm:'karanneh.coefficient.manage', kind:'list',
      api:'/api/hr/coefficients', fields:['staffId','periodId','qualityFactor','status'],
      form:{api:'/api/hr/coefficients', method:'POST', fields:[
        {name:'staffId', label:'شناسه پرسنل', required:true},
        {name:'periodId', label:'شناسه دوره', required:true},
        {name:'qualityFactor', label:'ضریب کیفی (0.5-1.25)', type:'number'},
        {name:'attendanceFactor', label:'ضریب حضور (1-2)', type:'number'},
        {name:'wardDifficulty', label:'سختی بخش (0.5-2)', type:'number'}
      ]}},
    {id:'appeals', title:'اعتراضات', icon:'⚖️', perm:'karanneh.appeal.manage', kind:'list',
      api:'/api/hr/appeals', fields:['subject','category','privacy','status'],
      form:{api:'/api/hr/appeals', method:'POST', fields:[
        {name:'subject', label:'موضوع', required:true},
        {name:'description', label:'شرح', required:true},
        {name:'privacy', label:'محرمانگی (normal/special/confidential/anonymous)'},
        {name:'category', label:'دسته'}
      ]}},
    {id:'extras', title:'خدمات اکسترا', icon:'🌟', perm:'extras.view', kind:'list',
      api:'/api/hr/extras', fields:['title','category','status','claimedByName'],
      form:{api:'/api/hr/extras', method:'POST', fields:[
        {name:'title', label:'عنوان', required:true},
        {name:'description', label:'شرح'},
        {name:'category', label:'دسته (clinical/physical/cultural/emergency)'},
        {name:'difficulty', label:'سختی (0.5-2)', type:'number'},
        {name:'urgency', label:'فوریت (1-2)', type:'number'}
      ]}},
    {id:'dash', title:'داشبورد HR', icon:'📊', perm:'karanneh.coefficient.manage', kind:'stats', api:'/api/hr/dashboard'}
  ]
};
