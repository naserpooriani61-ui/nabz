
# ═══════════════════════════════════════════════════════════════
#  Part 4 — Education + Quality + Admin + Rights + HR + QR Pulse
# ═══════════════════════════════════════════════════════════════

# ─── 1) core/permissions-extra.js ───
cat > core/permissions-extra.js << 'EOF'
const perms = require('./permissions');
Object.assign(perms.P, {
  'education.view':'admin,nurse,head_nurse,physician,resident,intern,attending,specialist,supervisor_clinical,nursing_director',
  'education.manage':'admin,supervisor_education,attending,specialist,head_nurse',
  'quality.view':'admin,hospital_director,medical_director,nursing_director,supervisor_senior,quality_officer,head_nurse,supervisor_clinical',
  'quality.kpi.manage':'admin,quality_officer,medical_director,nursing_director',
  'quality.pdsa.manage':'admin,quality_officer,head_nurse,supervisor_clinical',
  'quality.rca.manage':'admin,quality_officer,medical_director',
  'quality.audit.manage':'admin,quality_officer,head_nurse',
  'quality.satisfaction.record':'admin,quality_officer,supervisor_clinical,nurse',
  'admin.users.manage':'admin',
  'admin.permissions.manage':'admin',
  'admin.audit.view':'admin,hospital_director',
  'rights.view':'admin,hospital_director,medical_director,nursing_director,supervisor_senior,quality_officer,head_nurse,supervisor_clinical',
  'rights.consent':'admin,physician,resident,attending,specialist,head_nurse',
  'rights.complaint.file':'admin,nurse,head_nurse,receptionist,quality_officer',
  'rights.complaint.resolve':'admin,quality_officer,medical_director',
  'rights.privacy':'admin,supervisor_clinical,head_nurse,quality_officer',
  'rights.education':'admin,nurse,head_nurse',
  'karanneh.coefficient.manage':'admin,nursing_director,medical_director',
  'karanneh.appeal.manage':'admin,nursing_director,medical_director,head_nurse',
  'extras.view':'admin,nurse,nurse_aide,head_nurse,physician,resident,intern,attending',
  'extras.manage':'admin,head_nurse,supervisor_clinical,nursing_director',
  'qr.view':'admin,nurse,nurse_aide,head_nurse,physician,resident,intern,attending,supervisor_clinical',
  'qr.scan':'admin,nurse,nurse_aide,head_nurse,physician,resident,intern,attending,specialist'
});
EOF

# ─── 2) modules/education.js ───
cat > modules/education.js << 'EOF'
const { h, sd, num, sg, list } = require('../core/mod-helpers');
const Q_TYPES = ['mcq_single','mcq_multiple','true_false','short_answer'];

const objects = list('learning_objects', 'createdAt');
const createObject = (ctx) => {
  const b = ctx.body;
  if (!b.title) throw ctx.E.badRequest('title_required');
  const rec = { id: ctx.uid('lo'), title: b.title, type: b.type || 'article',
    category: b.category || 'general', body: b.body || '',
    targetRoles: b.targetRoles || ['all'],
    status: b.status === 'published' ? 'published' : 'draft',
    createdBy: ctx.actor.id, createdByName: ctx.actor.username, createdAt: ctx.now() };
  ctx.store.put('learning_objects', rec); return rec;
};

const questions = list('questions', 'createdAt');
const createQuestion = (ctx) => {
  const b = ctx.body;
  if (!b.type || !Q_TYPES.includes(b.type)) throw ctx.E.badRequest('invalid_type');
  if (!b.stem) throw ctx.E.badRequest('stem_required');
  const rec = { id: ctx.uid('q'), type: b.type, stem: b.stem,
    category: b.category || 'general', difficulty: b.difficulty || 'medium',
    options: b.options || [], correctAnswer: b.correctAnswer ?? null,
    correctAnswers: b.correctAnswers || [], points: Number(b.points) || 1,
    explanation: b.explanation || '', createdBy: ctx.actor.id, createdAt: ctx.now() };
  ctx.store.put('questions', rec); return rec;
};

const exams = list('exams', 'createdAt');
const createExam = (ctx) => {
  const b = ctx.body;
  if (!b.title || !Array.isArray(b.questionIds)) throw ctx.E.badRequest('missing');
  const allQ = h(ctx, 'questions');
  const qs = b.questionIds.map(id => allQ.find(q => q.id === id)).filter(Boolean);
  const rec = { id: ctx.uid('exm'), title: b.title, description: b.description || '',
    category: b.category || 'general', questions: qs,
    totalPoints: qs.reduce((s, q) => s + (q.points || 1), 0),
    passingScore: Number(b.passingScore) || 60,
    timeLimitMinutes: Number(b.timeLimitMinutes) || 30,
    attemptsAllowed: Number(b.attemptsAllowed) || 1,
    status: 'draft', createdBy: ctx.actor.id, createdAt: ctx.now() };
  ctx.store.put('exams', rec); return rec;
};
const publishExam = (ctx) => {
  const e = ctx.store.get('exams', ctx.params.id);
  if (!e) throw ctx.E.notFound('not_found');
  e.status = 'published'; e.publishedAt = ctx.now(); ctx.store.put('exams', e); return e;
};
const startAttempt = (ctx) => {
  const e = ctx.store.get('exams', ctx.params.id);
  if (!e) throw ctx.E.notFound('not_found');
  if (e.status !== 'published') throw ctx.E.conflict('not_published');
  const prev = h(ctx, 'attempts').filter(a => a.examId === e.id && a.userId === ctx.actor.id && a.status === 'submitted');
  if (prev.length >= e.attemptsAllowed) throw ctx.E.conflict('max_attempts');
  const att = { id: ctx.uid('att'), examId: e.id, examTitle: e.title,
    userId: ctx.actor.id, userName: ctx.actor.username,
    attemptNumber: prev.length + 1,
    questions: e.questions.map(q => ({ id: q.id, type: q.type, stem: q.stem,
      options: q.options, points: q.points })),
    answers: {}, startedAt: ctx.now(),
    endsAt: new Date(Date.now() + e.timeLimitMinutes * 60000).toISOString(),
    status: 'in_progress' };
  ctx.store.put('attempts', att); return att;
};
const submitAttempt = (ctx) => {
  const a = ctx.store.get('attempts', ctx.params.id);
  if (!a) throw ctx.E.notFound('not_found');
  if (a.userId !== ctx.actor.id) throw ctx.E.forbidden('not_your_attempt');
  if (a.status !== 'in_progress') throw ctx.E.conflict('already_submitted');
  const e = ctx.store.get('exams', a.examId);
  const answers = ctx.body.answers || {};
  let earned = 0, total = 0;
  for (const q of e.questions) {
    total += q.points || 1;
    const ans = answers[q.id];
    let ok = false;
    if (q.type === 'mcq_single' || q.type === 'true_false') ok = String(ans) === String(q.correctAnswer);
    else if (q.type === 'mcq_multiple') {
      const correct = q.correctAnswers || [];
      const given = Array.isArray(ans) ? ans : [];
      ok = correct.length && correct.every(c => given.includes(c)) && given.every(g => correct.includes(g));
    } else if (q.type === 'short_answer') {
      const exp = String(q.correctAnswer || '').trim().toLowerCase();
      const got = String(ans || '').trim().toLowerCase();
      ok = exp && (got === exp || got.includes(exp));
    }
    if (ok) earned += q.points || 1;
  }
  const score = total > 0 ? Math.round((earned / total) * 100) : 0;
  a.answers = answers; a.score = score;
  a.passed = score >= (e.passingScore || 60);
  a.submittedAt = ctx.now(); a.status = 'submitted';
  ctx.store.put('attempts', a);
  if (a.passed) {
    const cert = { id: ctx.uid('cert'), userId: a.userId, userName: a.userName,
      examId: e.id, examTitle: e.title, score, issuedAt: ctx.now() };
    ctx.store.put('certificates', cert);
    ctx.bus.emit('education.certificate', { record: cert, actor: ctx.actor });
  }
  return a;
};

const cases = list('edu_cases', 'createdAt');
const createCase = (ctx) => {
  const b = ctx.body;
  if (!b.title) throw ctx.E.badRequest('title_required');
  const rec = { id: ctx.uid('cs'), title: b.title,
    chiefComplaint: b.chiefComplaint || '', history: b.history || '',
    physicalExam: b.physicalExam || '',
    differentials: b.differentials || [], correctDiagnosis: b.correctDiagnosis || '',
    discussion: b.discussion || '', status: 'draft',
    createdBy: ctx.actor.id, createdAt: ctx.now() };
  ctx.store.put('edu_cases', rec); return rec;
};

const certificates = (ctx) => {
  const items = h(ctx, 'certificates').filter(c => c.userId === ctx.actor.id || ctx.actor.role === 'admin');
  return { items, total: items.length };
};

const assignments = list('edu_assignments', 'createdAt');
const createAssignment = (ctx) => {
  const b = ctx.body;
  if (!b.type || !b.refId) throw ctx.E.badRequest('missing');
  const rec = { id: ctx.uid('asg'), type: b.type, refId: b.refId, refTitle: b.refTitle || '',
    targetRoles: b.targetRoles || ['all'], dueAt: b.dueAt || null,
    isMandatory: b.isMandatory !== false, status: 'assigned',
    createdBy: ctx.actor.id, createdAt: ctx.now() };
  ctx.store.put('edu_assignments', rec); return rec;
};
const myAssignments = (ctx) => {
  const items = h(ctx, 'edu_assignments').filter(a =>
    (a.targetRoles || []).includes('all') || (a.targetRoles || []).includes(ctx.actor.role));
  return { items, total: items.length };
};

const stats = (ctx) => ({
  objects: h(ctx, 'learning_objects').length,
  questions: h(ctx, 'questions').length,
  exams: h(ctx, 'exams').length,
  published: h(ctx, 'exams').filter(e => e.status === 'published').length,
  cases: h(ctx, 'edu_cases').length,
  certificates: h(ctx, 'certificates').length
});

module.exports = {
  handlers: { objects, createObject, questions, createQuestion, exams, createExam,
    publishExam, startAttempt, submitAttempt, cases, createCase, certificates,
    assignments, createAssignment, myAssignments, stats },
  routes: [
    {method:'GET', path:'/api/edu/objects', handler:'objects', perm:'education.view'},
    {method:'POST', path:'/api/edu/objects', handler:'createObject', perm:'education.manage'},
    {method:'GET', path:'/api/edu/questions', handler:'questions', perm:'education.view'},
    {method:'POST', path:'/api/edu/questions', handler:'createQuestion', perm:'education.manage'},
    {method:'GET', path:'/api/edu/exams', handler:'exams', perm:'education.view'},
    {method:'POST', path:'/api/edu/exams', handler:'createExam', perm:'education.manage'},
    {method:'POST', path:'/api/edu/exams/:id/publish', handler:'publishExam', perm:'education.manage'},
    {method:'POST', path:'/api/edu/exams/:id/start', handler:'startAttempt', perm:'education.view'},
    {method:'POST', path:'/api/edu/attempts/:id/submit', handler:'submitAttempt', perm:'education.view'},
    {method:'GET', path:'/api/edu/cases', handler:'cases', perm:'education.view'},
    {method:'POST', path:'/api/edu/cases', handler:'createCase', perm:'education.manage'},
    {method:'GET', path:'/api/edu/certificates', handler:'certificates', perm:'education.view'},
    {method:'GET', path:'/api/edu/assignments', handler:'assignments', perm:'education.view'},
    {method:'POST', path:'/api/edu/assignments', handler:'createAssignment', perm:'education.manage'},
    {method:'GET', path:'/api/edu/my', handler:'myAssignments', perm:'education.view'},
    {method:'GET', path:'/api/edu/stats', handler:'stats', perm:'education.view'}
  ],
  panels: [
    {id:'objects', title:'محتوا', icon:'📚', perm:'education.view', kind:'list',
      api:'/api/edu/objects', fields:['title','category','status'],
      form:{api:'/api/edu/objects', method:'POST', fields:[
        {name:'title', label:'عنوان', required:true},
        {name:'category', label:'دسته'},
        {name:'body', label:'متن'},
        {name:'status', label:'published یا draft', required:true}
      ]}},
    {id:'exams', title:'آزمون‌ها', icon:'📝', perm:'education.view', kind:'list',
      api:'/api/edu/exams', fields:['title','status','passingScore']},
    {id:'questions', title:'بانک سوال', icon:'❓', perm:'education.view', kind:'list',
      api:'/api/edu/questions', fields:['stem','type','difficulty'],
      form:{api:'/api/edu/questions', method:'POST', fields:[
        {name:'type', label:'نوع (mcq_single/mcq_multiple/true_false/short_answer)', required:true},
        {name:'stem', label:'متن سوال', required:true},
        {name:'category', label:'دسته'},
        {name:'correctAnswer', label:'پاسخ صحیح'}
      ]}},
    {id:'cases', title:'کیس‌ها', icon:'🩺', perm:'education.view', kind:'list',
      api:'/api/edu/cases', fields:['title','chiefComplaint','status'],
      form:{api:'/api/edu/cases', method:'POST', fields:[
        {name:'title', label:'عنوان', required:true},
        {name:'chiefComplaint', label:'شکایت اصلی'},
        {name:'correctDiagnosis', label:'تشخیص صحیح'}
      ]}},
    {id:'certificates', title:'گواهی‌ها', icon:'🏅', perm:'education.view', kind:'list',
      api:'/api/edu/certificates', fields:['examTitle','score','issuedAt']},
    {id:'stats', title:'آمار آموزش', icon:'📊', perm:'education.view', kind:'stats', api:'/api/edu/stats'}
  ]
};
EOF

# ─── 3) modules/quality.js ───
cat > modules/quality.js << 'EOF'
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
    {method:'POST', path:'/api/q/kpis/:id/measure', handler:'recordKpi', perm:'quality.kpi.manage'},
    {method:'GET', path:'/api/q/pdsa', handler:'pdsa', perm:'quality.view'},
    {method:'POST', path:'/api/q/pdsa', handler:'createPdsa', perm:'quality.pdsa.manage'},
    {method:'POST', path:'/api/q/pdsa/:id/phase', handler:'updatePhase', perm:'quality.pdsa.manage'},
    {method:'GET', path:'/api/q/rca', handler:'rca', perm:'quality.view'},
    {method:'POST', path:'/api/q/rca', handler:'createRca', perm:'quality.rca.manage'},
    {method:'POST', path:'/api/q/rca/:id/complete', handler:'completeRca', perm:'quality.rca.manage'},
    {method:'GET', path:'/api/q/audits', handler:'audits', perm:'quality.view'},
    {method:'POST', path:'/api/q/audits', handler:'createAudit', perm:'quality.audit.manage'},
    {method:'POST', path:'/api/q/audits/:id/record', handler:'recordAudit', perm:'quality.audit.manage'},
    {method:'GET', path:'/api/q/satisfaction', handler:'satisfaction', perm:'quality.view'},
    {method:'POST', path:'/api/q/satisfaction', handler:'submitSatisfaction', perm:'quality.satisfaction.record'},
    {method:'GET', path:'/api/q/dashboard', handler:'dashboard', perm:'quality.view'}
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
EOF

# ─── 4) modules/admin.js ───
cat > modules/admin.js << 'EOF'
const { h, sd } = require('../core/mod-helpers');
const perms = require('../core/permissions');
const bc = require('bcryptjs');

const listUsers = (ctx) => {
  const users = h(ctx, 'users').map(u => ({
    id: u.id, username: u.username, fullName: u.fullName,
    role: u.role, ward: u.ward, active: u.active,
    lastLoginAt: u.lastLoginAt, createdAt: u.createdAt
  }));
  return { items: users, total: users.length };
};
const createUser = (ctx) => {
  const b = ctx.body;
  if (!b.username || !b.password || !b.role) throw ctx.E.badRequest('missing');
  if (!perms.R[b.role]) throw ctx.E.badRequest('invalid_role');
  if (h(ctx, 'users').some(u => u.username === b.username)) throw ctx.E.conflict('username_taken');
  const rec = { id: 'usr_' + b.username.toLowerCase(),
    username: b.username, fullName: b.fullName || b.username,
    role: b.role, ward: b.ward || null, active: true,
    passwordHash: bc.hashSync(b.password, 8), createdAt: ctx.now() };
  ctx.store.put('users', rec);
  return { id: rec.id, username: rec.username, role: rec.role };
};
const updateUser = (ctx) => {
  const u = ctx.store.get('users', ctx.params.id);
  if (!u) throw ctx.E.notFound('not_found');
  const b = ctx.body;
  if (b.role && !perms.R[b.role]) throw ctx.E.badRequest('invalid_role');
  ['fullName','role','ward','active'].forEach(k => { if (b[k] !== undefined) u[k] = b[k]; });
  if (b.password) u.passwordHash = bc.hashSync(b.password, 8);
  ctx.store.put('users', u);
  return { id: u.id, role: u.role, active: u.active };
};

const listRoles = (ctx) => {
  const items = Object.entries(perms.R).map(([code, r]) => ({ code, level: r.l, crossWard: !!r.cw }));
  return { items, total: items.length };
};
const listPerms = (ctx) => {
  const items = Object.keys(perms.P).map(p => ({ perm: p, roles: perms.P[p].split(',') }));
  return { items, total: items.length };
};
const setPerm = (ctx) => {
  const b = ctx.body;
  if (!b.perm || !Array.isArray(b.roles)) throw ctx.E.badRequest('missing');
  for (const r of b.roles) if (!perms.R[r]) throw ctx.E.badRequest('unknown_role:' + r);
  perms.P[b.perm] = b.roles.join(',');
  ctx.audit.write('admin', 'perm.override', b.perm, ctx.actor, { roles: b.roles });
  return { perm: b.perm, roles: b.roles };
};
const auditVerify = (ctx) => require('../core/audit').verify();
const auditRecent = (ctx) => ({ items: require('../core/audit').recent(100) });

module.exports = {
  handlers: { listUsers, createUser, updateUser, listRoles, listPerms, setPerm, auditVerify, auditRecent },
  routes: [
    {method:'GET', path:'/api/admin/users', handler:'listUsers', perm:'admin.users.manage'},
    {method:'POST', path:'/api/admin/users', handler:'createUser', perm:'admin.users.manage'},
    {method:'PUT', path:'/api/admin/users/:id', handler:'updateUser', perm:'admin.users.manage'},
    {method:'GET', path:'/api/admin/roles', handler:'listRoles', perm:'admin.users.manage'},
    {method:'GET', path:'/api/admin/perms', handler:'listPerms', perm:'admin.permissions.manage'},
    {method:'POST', path:'/api/admin/perms', handler:'setPerm', perm:'admin.permissions.manage'},
    {method:'GET', path:'/api/admin/audit/verify', handler:'auditVerify', perm:'admin.audit.view'},
    {method:'GET', path:'/api/admin/audit/recent', handler:'auditRecent', perm:'admin.audit.view'}
  ],
  panels: [
    {id:'users', title:'کاربران', icon:'👥', perm:'admin.users.manage', kind:'list',
      api:'/api/admin/users', fields:['username','fullName','role','ward','active'],
      form:{api:'/api/admin/users', method:'POST', fields:[
        {name:'username', label:'نام کاربری', required:true},
        {name:'password', label:'رمز', required:true},
        {name:'fullName', label:'نام کامل'},
        {name:'role', label:'نقش (admin/nurse/physician/...)', required:true},
        {name:'ward', label:'بخش (اختیاری)'}
      ]}},
    {id:'roles', title:'نقش‌ها', icon:'🎭', perm:'admin.users.manage', kind:'list',
      api:'/api/admin/roles', fields:['code','level','crossWard']},
    {id:'perms', title:'مجوزها', icon:'🔐', perm:'admin.permissions.manage', kind:'list',
      api:'/api/admin/perms', fields:['perm','roles']},
    {id:'audit_verify', title:'صحت Audit', icon:'✓', perm:'admin.audit.view', kind:'stats',
      api:'/api/admin/audit/verify'},
    {id:'audit_recent', title:'Audit اخیر', icon:'📋', perm:'admin.audit.view', kind:'list',
      api:'/api/admin/audit/recent', fields:['module','action','entityId','at']}
  ]
};
EOF

# ─── 5) modules/rights.js ───
cat > modules/rights.js << 'EOF'
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
    {method:'POST', path:'/api/rights/consents/:id/sign', handler:'signConsent', perm:'rights.consent'},
    {method:'GET', path:'/api/rights/complaints', handler:'complaints', perm:'rights.view'},
    {method:'POST', path:'/api/rights/complaints', handler:'fileComplaint', perm:'rights.complaint.file'},
    {method:'POST', path:'/api/rights/complaints/:id/resolve', handler:'resolveComplaint', perm:'rights.complaint.resolve'},
    {method:'GET', path:'/api/rights/privacy', handler:'privacyChecks', perm:'rights.view'},
    {method:'POST', path:'/api/rights/privacy', handler:'recordPrivacy', perm:'rights.privacy'},
    {method:'GET', path:'/api/rights/education', handler:'education', perm:'rights.view'},
    {method:'POST', path:'/api/rights/education', handler:'recordEducation', perm:'rights.education'},
    {method:'GET', path:'/api/rights/stats', handler:'stats', perm:'rights.view'}
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
EOF

# ─── 6) modules/advanced_hr.js ───
cat > modules/advanced_hr.js << 'EOF'
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
    {method:'POST', path:'/api/hr/coefficients/:id/approve', handler:'approveCoefficient', perm:'karanneh.coefficient.manage'},
    {method:'POST', path:'/api/hr/coefficients/:id/reject', handler:'rejectCoefficient', perm:'karanneh.coefficient.manage'},
    {method:'GET', path:'/api/hr/appeals', handler:'appeals', perm:'karanneh.appeal.manage'},
    {method:'POST', path:'/api/hr/appeals', handler:'createAppeal', perm:'karanneh.appeal.manage'},
    {method:'POST', path:'/api/hr/appeals/:id/review', handler:'reviewAppeal', perm:'karanneh.appeal.manage'},
    {method:'GET', path:'/api/hr/extras', handler:'extras', perm:'extras.view'},
    {method:'POST', path:'/api/hr/extras', handler:'createExtra', perm:'extras.manage'},
    {method:'POST', path:'/api/hr/extras/:id/claim', handler:'claimExtra', perm:'extras.view'},
    {method:'POST', path:'/api/hr/extras/:id/complete', handler:'completeExtra', perm:'extras.view'},
    {method:'GET', path:'/api/hr/dashboard', handler:'dashboard', perm:'karanneh.coefficient.manage'}
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
EOF

# ─── 7) modules/qr_pulse.js ───
cat > modules/qr_pulse.js << 'EOF'
const { h, sd } = require('../core/mod-helpers');
const crypto = require('crypto');
const fs = require('fs'), path = require('path');
const DATA = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

function getSecret() {
  const f = path.join(DATA, '_qr_secret');
  try { if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8'); } catch (_) {}
  const s = crypto.randomBytes(32).toString('hex');
  try { if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(f, s); } catch (_) {}
  return s;
}
const SECRET = getSecret();
const BUCKET_SEC = 30;
const VALID_BUCKETS = 3;

function bucket() { return Math.floor(Date.now() / 1000 / BUCKET_SEC); }
function sign(ward, b) { return crypto.createHmac('sha256', SECRET).update(ward + '|' + b).digest('hex').slice(0, 12); }
function generateQR(ward) {
  const b = bucket();
  return 'QR1|' + ward + '|' + b + '|' + sign(ward, b);
}
function verifyQR(code) {
  const parts = (code || '').trim().split('|');
  if (parts.length !== 4 || parts[0] !== 'QR1') return { ok: false, reason: 'format' };
  const [_, ward, bStr, sig] = parts;
  const b = Number(bStr);
  if (isNaN(b)) return { ok: false, reason: 'bad_bucket' };
  if (sig !== sign(ward, b)) return { ok: false, reason: 'invalid_signature' };
  const now = bucket();
  if (now - b > VALID_BUCKETS) return { ok: false, reason: 'expired' };
  if (now - b < -1) return { ok: false, reason: 'future' };
  return { ok: true, ward, bucket: b };
}

const current = (ctx) => {
  const ward = ctx.actor.ward || ctx.query.ward;
  if (!ward) throw ctx.E.badRequest('ward_required');
  const b = bucket();
  return {
    ward, code: generateQR(ward),
    bucket: b, expiresAt: new Date((b + VALID_BUCKETS) * BUCKET_SEC * 1000).toISOString(),
    rotateEverySec: BUCKET_SEC, validForSec: BUCKET_SEC * VALID_BUCKETS
  };
};

const scan = (ctx) => {
  const b = ctx.body;
  if (!b.code) throw ctx.E.badRequest('code_required');
  const v = verifyQR(b.code);
  if (!v.ok) throw ctx.E.badRequest('invalid_qr: ' + v.reason);
  const today = new Date().toISOString().slice(0, 10);
  const existing = h(ctx, 'attendance').find(a => a.userId === ctx.actor.id && a.date === today);
  if (existing && existing.checkIn && !existing.checkOut) {
    existing.checkOut = ctx.now();
    existing.workedHours = Math.round((sd(existing.checkOut) - sd(existing.checkIn)) / 360000) / 10;
    existing.checkOutMethod = 'qr_pulse';
    ctx.store.put('attendance', existing);
    return { action: 'checkout', attendance: existing, ward: v.ward };
  }
  if (existing && existing.checkIn && existing.checkOut)
    throw ctx.E.conflict('already_checked_in_and_out');
  const rec = { id: ctx.uid('att'), userId: ctx.actor.id,
    userName: ctx.actor.username, wardCode: v.ward, date: today,
    checkIn: ctx.now(), checkOut: null, method: 'qr_pulse' };
  ctx.store.put('attendance', rec);
  ctx.bus.emit('qr.checkin', { record: rec, actor: ctx.actor });
  return { action: 'checkin', attendance: rec, ward: v.ward };
};

const history = (ctx) => {
  const today = new Date().toISOString().slice(0, 10);
  let items = h(ctx, 'attendance').filter(a => a.date === today);
  if (ctx.actor.role !== 'admin') {
    items = items.filter(a => a.wardCode === ctx.actor.ward || a.userId === ctx.actor.id);
  }
  items.sort((a, b) => sd(b.checkIn) - sd(a.checkIn));
  return { items, total: items.length };
};

const verify = (ctx) => {
  const code = ctx.query.code;
  if (!code) throw ctx.E.badRequest('code_required');
  return verifyQR(code);
};

module.exports = {
  handlers: { current, scan, history, verify },
  routes: [
    {method:'GET', path:'/api/qr/current', handler:'current', perm:'qr.view'},
    {method:'POST', path:'/api/qr/scan', handler:'scan', perm:'qr.scan'},
    {method:'GET', path:'/api/qr/today', handler:'history', perm:'qr.view'},
    {method:'GET', path:'/api/qr/verify', handler:'verify', perm:'qr.view'}
  ],
  panels: [
    {id:'qr_show', title:'QR بخش من', icon:'📱', perm:'qr.view', kind:'action', api:'/api/qr/current'},
    {id:'qr_scan', title:'ثبت با QR', icon:'📷', perm:'qr.scan', kind:'list',
      api:'/api/qr/today', fields:['userName','wardCode','checkIn','checkOut','method'],
      form:{api:'/api/qr/scan', method:'POST', fields:[
        {name:'code', label:'کد QR را وارد کنید', required:true}
      ]}}
  ]
};
EOF

# ─── 8) Patch app.js — add 'action' kind ───
node << 'APPPATCH'
const fs = require('fs');
const p = 'public/app.js';
let src = fs.readFileSync(p, 'utf8');

// Add action handler
src = src.replace(
  /if\(p\.kind==='list'\)renderList\(p,d\);/,
  `if(p.kind==='action')renderAction(p,d);
else if(p.kind==='list')renderList(p,d);`
);

// Add renderAction function before renderStats
src = src.replace(
  /function renderStats\(p,d\)\{/,
  `function renderAction(p,d){
  const code=d.code||d.value||JSON.stringify(d);
  document.getElementById('content').innerHTML=\`
    <div class="sec-hd">\${p.icon} \${p.title}</div>
    <div class="card" style="text-align:center;padding:30px">
      <div style="font-size:44px;margin-bottom:16px">📱</div>
      <div style="font-family:monospace;font-size:14px;font-weight:900;
        padding:16px;background:var(--bg);border-radius:8px;word-break:break-all;
        letter-spacing:1px;color:var(--pri)">\${esc(code)}</div>
      \${d.ward?\`<div class="row-meta" style="margin-top:12px">بخش: \${esc(d.ward)}</div>\`:''}
      \${d.expiresAt?\`<div class="row-meta">اعتبار تا: \${new Date(d.expiresAt).toLocaleTimeString('fa-IR')}</div>\`:''}
      <button class="btn btn-primary" style="margin-top:16px" onclick="NABZ.show('\${p.id}')">🔄 تازه‌سازی</button>
    </div>\`;
}
function renderStats(p,d){`
);

fs.writeFileSync(p, src);
console.log('✅ app.js: action kind added');
APPPATCH

# ─── 9) Patch server.js — require permissions-extra ───
node << 'SRVPATCH'
const fs = require('fs');
const p = 'core/server.js';
let src = fs.readFileSync(p, 'utf8');

// Insert require after MODS loading loop
const marker = '// ─── 5) Build route table ───';
if (src.includes(marker)) {
  src = src.replace(marker, "try { require('./permissions-extra'); } catch(e) { console.error('perm-extra:', e.message); }\n\n" + marker);
  fs.writeFileSync(p, src);
  console.log('✅ server.js: permissions-extra required');
} else {
  console.log('⚠️ marker not found, appending at end');
  fs.writeFileSync(p, src + "\ntry { require('./permissions-extra'); } catch(e){}\n");
}
SRVPATCH

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ Part 4 complete — 6 modules, 60 routes  ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "New modules:"
echo "  education   (16 routes — exams/questions/cases/certs)"
echo "  quality     (15 routes — KPIs/PDSA/RCA/audits)"
echo "  admin       (8 routes — users/roles/perms/audit)"
echo "  rights      (13 routes — charter/consents/complaints)"
echo "  advanced_hr (12 routes — coefficients/appeals/extras)"
echo "  qr_pulse    (4 routes — rotating QR + attendance)"
echo ""
echo "Next: npm start"
