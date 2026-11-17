const { h, sd, num, sg, list } = require('../core/mod-helpers');

const kpis = list('kpis', 'createdAt');
const createKpi = (ctx) => {
  const b = ctx.body;
  if (!b.name) throw ctx.E.badRequest('name_required');
  const rec = { id: ctx.uid('kpi'), name: b.name, category: b.category || 'general',
    unit: b.unit || '%', target: Number(b.target) || 90,
    direction: b.direction || 'higher', frequency: b.frequency || 'monthly',
    measurements: [], createdBy: ctx.actor.id, createdAt: ctx.now() };
  ctx.store.put('kpis', rec); return rec;
};
const recordKpi = (ctx) => {
  const k = ctx.store.get('kpis', ctx.params.id);
  if (!k) throw ctx.E.notFound('not_found');
  if (ctx.body.value == null) throw ctx.E.badRequest('value_required');
  const m = { value: Number(ctx.body.value), at: ctx.now(), by: ctx.actor.id, note: ctx.body.note || '' };
  k.measurements = k.measurements || [];
  k.measurements.push(m);
  ctx.store.put('kpis', k); return m;
};

const pdsa = list('pdsa_cycles', 'createdAt');
const createPdsa = (ctx) => {
  const b = ctx.body;
  if (!b.title || !b.problem) throw ctx.E.badRequest('missing');
  const rec = { id: ctx.uid('pdsa'), title: b.title, problem: b.problem,
    aim: b.aim || '', wardCode: b.wardCode || ctx.actor.ward || null,
    phase: 'plan', status: 'active', owner: ctx.actor.id,
    phases: { plan: { startedAt: ctx.now(), notes: b.plan || '' },
      do: { startedAt: null, notes: '' },
      study: { startedAt: null, notes: '' },
      act: { startedAt: null, notes: '' } },
    createdAt: ctx.now() };
  ctx.store.put('pdsa_cycles', rec); return rec;
};
const updatePhase = (ctx) => {
  const p = ctx.store.get('pdsa_cycles', ctx.params.id);
  if (!p) throw ctx.E.notFound('not_found');
  const ph = ctx.body.phase;
  if (!['plan','do','study','act'].includes(ph)) throw ctx.E.badRequest('invalid_phase');
  p.phases[p.phase].completedAt = ctx.now();
  p.phase = ph;
  p.phases[ph].startedAt = ctx.now();
  if (ctx.body.notes) p.phases[ph].notes = ctx.body.notes;
  if (ph === 'act') { p.status = 'completed'; p.completedAt = ctx.now(); }
  ctx.store.put('pdsa_cycles', p); return p;
};

const rca = list('rca_reports', 'openedAt');
const createRca = (ctx) => {
  const b = ctx.body;
  if (!b.incidentId) throw ctx.E.badRequest('incident_required');
  const inc = ctx.store.get('incidents', b.incidentId);
  if (!inc) throw ctx.E.notFound('incident_not_found');
  const rec = { id: ctx.uid('rca'), incidentId: inc.id,
    incidentSummary: (inc.description||'').slice(0,200),
    severity: inc.severity, wardCode: inc.wardCode, status: 'opened',
    openedAt: ctx.now(), openedBy: ctx.actor.id,
    rootCauses: [], recommendations: [] };
  ctx.store.put('rca_reports', rec); return rec;
};
const completeRca = (ctx) => {
  const r = ctx.store.get('rca_reports', ctx.params.id);
  if (!r) throw ctx.E.notFound('not_found');
  const b = ctx.body;
  if (!Array.isArray(b.rootCauses) || !b.rootCauses.length) throw ctx.E.badRequest('roots_required');
  if (!Array.isArray(b.recommendations)) throw ctx.E.badRequest('recs_required');
  r.rootCauses = b.rootCauses;
  r.recommendations = b.recommendations;
  r.status = 'completed'; r.completedAt = ctx.now(); r.completedBy = ctx.actor.id;
  ctx.store.put('rca_reports', r); return r;
};

const audits = list('clinical_audits', 'createdAt');
const createAudit = (ctx) => {
  const b = ctx.body;
  if (!b.title || !Array.isArray(b.criteria)) throw ctx.E.badRequest('missing');
  const rec = { id: ctx.uid('aud'), title: b.title, topic: b.topic || 'general',
    wardCode: b.wardCode || ctx.actor.ward || null,
    criteria: b.criteria, sampleSize: Number(b.sampleSize) || 20,
    scheduledAt: b.scheduledAt || ctx.now(), status: 'planned',
    results: [], auditor: ctx.actor.id, createdAt: ctx.now() };
  ctx.store.put('clinical_audits', rec); return rec;
};
const recordAudit = (ctx) => {
  const a = ctx.store.get('clinical_audits', ctx.params.id);
  if (!a) throw ctx.E.notFound('not_found');
  const b = ctx.body;
  if (!Array.isArray(b.findings)) throw ctx.E.badRequest('findings_required');
  let total = 0, met = 0;
  for (const f of b.findings) {
    total += a.criteria.length;
    met += (f.met || []).length;
    a.results.push({ patientId: f.patientId || null, met: f.met || [], at: ctx.now() });
  }
  a.score = total ? Math.round((met / total) * 100) : 0;
  a.status = 'completed'; a.completedAt = ctx.now();
  ctx.store.put('clinical_audits', a); return a;
};

const satisfaction = list('satisfaction', 'collectedAt');
const submitSatisfaction = (ctx) => {
  const b = ctx.body;
  if (b.overallScore == null) throw ctx.E.badRequest('score_required');
  const rec = { id: ctx.uid('sat'), patientId: b.patientId || null,
    wardCode: b.wardCode || ctx.actor.ward || null,
    overallScore: Number(b.overallScore), comment: b.comment || '',
    collectedBy: ctx.actor.id, collectedAt: ctx.now() };
  ctx.store.put('satisfaction', rec); return rec;
};

const dashboard = (ctx) => {
  const k = h(ctx, 'kpis');
  const r = h(ctx, 'rca_reports');
  const p = h(ctx, 'pdsa_cycles');
  const s = h(ctx, 'satisfaction');
  const avgSat = s.length ? Math.round((s.reduce((sum,x) => sum+x.overallScore,0)/s.length)*10)/10 : null;
  return {
    kpis: k.length, kpiMeasured: k.filter(x => (x.measurements||[]).length > 0).length,
    rcaOpen: r.filter(x => x.status !== 'completed').length,
    rcaCompleted: r.filter(x => x.status === 'completed').length,
    pdsaActive: p.filter(x => x.status === 'active').length,
    pdsaCompleted: p.filter(x => x.status === 'completed').length,
    satisfaction: { count: s.length, avgScore: avgSat }
  };
};

module.exports = {
  handlers: { kpis, createKpi, recordKpi, pdsa, createPdsa, updatePhase,
    rca, createRca, completeRca, audits, createAudit, recordAudit,
    satisfaction, submitSatisfaction, dashboard },
  routes: [

    {method:'GET', path:'/api/q/kpis', handler:'kpis', perm:'quality.view'},
    {method:'POST', path:'/api/q/kpis', handler:'createKpi', perm:'quality.kpi.manage'},
    {method:'GET', path:'/api/q/pdsa', handler:'pdsa', perm:'quality.view'},
    {method:'POST', path:'/api/q/pdsa', handler:'createPdsa', perm:'quality.pdsa.manage'},
    {method:'GET', path:'/api/q/rca', handler:'rca', perm:'quality.view'},
    {method:'POST', path:'/api/q/rca', handler:'createRca', perm:'quality.rca.manage'},
    {method:'GET', path:'/api/q/audits', handler:'audits', perm:'quality.view'},
    {method:'POST', path:'/api/q/audits', handler:'createAudit', perm:'quality.audit.manage'},
    {method:'GET', path:'/api/q/satisfaction', handler:'satisfaction', perm:'quality.view'},
    {method:'POST', path:'/api/q/satisfaction', handler:'submitSatisfaction', perm:'quality.satisfaction.record'},
    {method:'GET', path:'/api/q/dashboard', handler:'dashboard', perm:'quality.view'},
    {method:'POST', path:'/api/q/kpis/:id/measure', handler:'recordKpi', perm:'quality.kpi.manage'},
    {method:'POST', path:'/api/q/pdsa/:id/phase', handler:'updatePhase', perm:'quality.pdsa.manage'},
    {method:'POST', path:'/api/q/rca/:id/complete', handler:'completeRca', perm:'quality.rca.manage'},
    {method:'POST', path:'/api/q/audits/:id/record', handler:'recordAudit', perm:'quality.audit.manage'},
  
  ],
  panels: [
    {id:'kpis', title:'KPIها', icon:'📊', perm:'quality.view', kind:'list',
      api:'/api/q/kpis', fields:['name','category','target'],
      form:{api:'/api/q/kpis', method:'POST', fields:[
        {name:'name', label:'نام KPI', required:true},
        {name:'category', label:'دسته'},
        {name:'target', label:'هدف', type:'number'},
        {name:'unit', label:'واحد (%, دقیقه)'}
      ]}},
    {id:'pdsa', title:'چرخه PDSA', icon:'🔄', perm:'quality.view', kind:'list',
      api:'/api/q/pdsa', fields:['title','problem','phase','status'],
      form:{api:'/api/q/pdsa', method:'POST', fields:[
        {name:'title', label:'عنوان', required:true},
        {name:'problem', label:'مشکل', required:true},
        {name:'aim', label:'هدف'},
        {name:'plan', label:'طرح اولیه'}
      ]}},
    {id:'rca', title:'RCA', icon:'🔍', perm:'quality.view', kind:'list',
      api:'/api/q/rca', fields:['incidentSummary','severity','status']},
    {id:'audits', title:'ممیزی بالینی', icon:'📋', perm:'quality.view', kind:'list',
      api:'/api/q/audits', fields:['title','topic','status','score'],
      form:{api:'/api/q/audits', method:'POST', fields:[
        {name:'title', label:'عنوان', required:true},
        {name:'topic', label:'موضوع'},
        {name:'sampleSize', label:'تعداد نمونه', type:'number'}
      ]}},
    {id:'sat', title:'رضایت بیمار', icon:'😊', perm:'quality.view', kind:'list',
      api:'/api/q/satisfaction', fields:['wardCode','overallScore','comment'],
      form:{api:'/api/q/satisfaction', method:'POST', fields:[
        {name:'overallScore', label:'امتیاز (۱-۵)', type:'number', required:true},
        {name:'wardCode', label:'بخش'},
        {name:'comment', label:'نظر'}
      ]}},
    {id:'dash', title:'داشبورد کیفیت', icon:'⭐', perm:'quality.view', kind:'stats', api:'/api/q/dashboard'}
  ]
};
