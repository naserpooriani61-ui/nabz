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
    {method:'GET', path:'/api/edu/cases', handler:'cases', perm:'education.view'},
    {method:'POST', path:'/api/edu/cases', handler:'createCase', perm:'education.manage'},
    {method:'GET', path:'/api/edu/certificates', handler:'certificates', perm:'education.view'},
    {method:'GET', path:'/api/edu/assignments', handler:'assignments', perm:'education.view'},
    {method:'POST', path:'/api/edu/assignments', handler:'createAssignment', perm:'education.manage'},
    {method:'GET', path:'/api/edu/my', handler:'myAssignments', perm:'education.view'},
    {method:'GET', path:'/api/edu/stats', handler:'stats', perm:'education.view'},
    {method:'POST', path:'/api/edu/exams/:id/publish', handler:'publishExam', perm:'education.manage'},
    {method:'POST', path:'/api/edu/exams/:id/start', handler:'startAttempt', perm:'education.view'},
    {method:'POST', path:'/api/edu/attempts/:id/submit', handler:'submitAttempt', perm:'education.view'}
  
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
