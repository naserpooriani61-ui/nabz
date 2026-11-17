'use strict';
// Comprehensive Education Studio — questions, exams, cohorts, assignments, attempts, certificates, analytics
const store = require('../core/store');
const bus = require('../core/events');
const perms = require('../core/permissions');
const audit = require('../core/audit');

if (!perms.P['edu.studio.view']) {
  Object.assign(perms.P, {
    'edu.studio.view': 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_education,supervisor_clinical,head_nurse,attending,specialist,educator',
    'edu.studio.manage': 'admin,supervisor_education,educator,attending,specialist,head_nurse'
  });
}

const Q_TYPES = {
  mcq_single: { label: 'چندگزینه‌ای تک‌پاسخ', hasOptions: true, hasSingle: true },
  mcq_multiple: { label: 'چندگزینه‌ای چندپاسخ', hasOptions: true, hasMultiple: true },
  true_false: { label: 'صحیح/غلط', hasOptions: true, hasSingle: true, fixedOptions: ['صحیح', 'غلط'] },
  short_answer: { label: 'پاسخ کوتاه', hasText: true },
  essay: { label: 'تشریحی', hasText: true, manualGrading: true },
  fill_blank: { label: 'جای خالی', hasBlanks: true, manualGrading: true },
  numeric: { label: 'عددی', hasNumeric: true },
  matching: { label: 'تطبیق', hasPairs: true, manualGrading: true },
  ordering: { label: 'ترتیب', hasSequence: true }
};
const BLOOMS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const DIFFICULTY = ['easy', 'medium', 'hard'];

const _api = (ctx, coll) => { try { const r = ctx.store.readAll(coll); return Array.isArray(r) ? r : []; } catch (_) { return []; } };
const _now = () => new Date().toISOString();

function validateQuestion(q) {
  if (!q.type || !Q_TYPES[q.type]) return 'invalid_type';
  if (!q.stem || String(q.stem).trim().length < 5) return 'stem_too_short';
  const def = Q_TYPES[q.type];
  if (def.hasOptions) {
    if (!Array.isArray(q.options) || q.options.length < 2) return 'need_2_options';
    if (q.options.some(o => !o || !String(o).trim())) return 'empty_option';
  }
  if (def.hasSingle && (q.correctAnswer === undefined || q.correctAnswer === null || q.correctAnswer === '')) return 'correct_answer_required';
  if (def.hasMultiple && (!Array.isArray(q.correctAnswers) || !q.correctAnswers.length)) return 'correct_answers_required';
  if (def.hasNumeric && (q.correctNumber === undefined || q.correctNumber === null)) return 'correct_number_required';
  return null;
}

function scoreAnswer(question, givenAnswer) {
  const t = question.type;
  if (t === 'mcq_single' || t === 'true_false') {
    const correct = String(givenAnswer) === String(question.correctAnswer);
    return { correct, awarded: correct ? (question.points || 1) : 0 };
  }
  if (t === 'mcq_multiple') {
    const correctSet = new Set(question.correctAnswers || []);
    const givenSet = new Set(Array.isArray(givenAnswer) ? givenAnswer : []);
    const correct = correctSet.size === givenSet.size && [...correctSet].every(x => givenSet.has(x));
    return { correct, awarded: correct ? (question.points || 1) : 0 };
  }
  if (t === 'numeric') {
    const v = parseFloat(givenAnswer);
    const tol = question.numericTolerance || 0.01;
    const correct = !isNaN(v) && Math.abs(v - question.correctNumber) <= tol;
    return { correct, awarded: correct ? (question.points || 1) : 0 };
  }
  if (t === 'short_answer') {
    const given = String(givenAnswer || '').trim().toLowerCase();
    const expected = String(question.correctAnswer || '').trim().toLowerCase();
    const accepted = (question.acceptedAnswers || []).map(a => String(a).trim().toLowerCase());
    const correct = given.length > 0 && (given === expected || accepted.includes(given));
    return { correct, awarded: correct ? (question.points || 1) : 0 };
  }
  if (t === 'ordering') {
    const correctSeq = question.correctSequence || [];
    const given = Array.isArray(givenAnswer) ? givenAnswer : [];
    const correct = correctSeq.length === given.length && correctSeq.every((v, i) => v === given[i]);
    return { correct, awarded: correct ? (question.points || 1) : 0 };
  }
  return { correct: null, awarded: 0, manual: true };
}

function matchRule(staff, rule) {
  const val = staff[rule.field];
  const rv = rule.values || [];
  if (rule.op === 'in') return rv.some(v => String(v) === String(val));
  if (rule.op === 'equals') return String(val) === String(rv[0]);
  if (rule.op === 'gte') return Number(val) >= Number(rv[0]);
  if (rule.op === 'lte') return Number(val) <= Number(rv[0]);
  if (rule.op === 'includes') {
    const arr = Array.isArray(val) ? val : [val];
    return rv.some(v => arr.includes(v));
  }
  return false;
}

function computeCohortMembers(ctx, cohort) {
  const manual = cohort.staffIds || [];
  const rules = cohort.filterRules || [];
  if (cohort.selectionMode === 'manual') return manual;
  const allStaff = _api(ctx, 'sa_staff').filter(s => s.active);
  const fromFilter = allStaff.filter(s => rules.length === 0 || rules.every(r => matchRule(s, r))).map(s => s.id);
  if (cohort.selectionMode === 'filter') return fromFilter;
  if (cohort.selectionMode === 'mixed') return [...new Set([...manual, ...fromFilter])];
  return [];
}

// ════════ QUESTIONS ════════
function listQuestions(ctx) {
  let items = _api(ctx, 'questions');
  if (ctx.query.category) items = items.filter(q => q.category === ctx.query.category);
  if (ctx.query.type) items = items.filter(q => q.type === ctx.query.type);
  if (ctx.query.difficulty) items = items.filter(q => q.difficulty === ctx.query.difficulty);
  if (ctx.query.tag) items = items.filter(q => (q.tags || []).includes(ctx.query.tag));
  if (ctx.query.q) {
    const q = String(ctx.query.q).toLowerCase();
    items = items.filter(x => String(x.stem || '').toLowerCase().includes(q));
  }
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { items, total: items.length, types: Q_TYPES, blooms: BLOOMS, difficulty: DIFFICULTY };
}

function getQuestion(ctx) {
  const q = store.get('questions', ctx.params.id);
  if (!q) throw ctx.E.notFound('question_not_found');
  return q;
}

function createQuestion(ctx) {
  const b = ctx.body || {};
  const err = validateQuestion(b);
  if (err) throw ctx.E.badRequest(err);
  const rec = {
    id: ctx.uid('q'), type: b.type,
    stem: String(b.stem).slice(0, 2000),
    options: (b.options || []).slice(0, 20).map(String),
    correctAnswer: b.correctAnswer !== undefined ? b.correctAnswer : null,
    correctAnswers: Array.isArray(b.correctAnswers) ? b.correctAnswers.slice(0, 20) : [],
    correctNumber: typeof b.correctNumber === 'number' ? b.correctNumber : null,
    numericTolerance: typeof b.numericTolerance === 'number' ? b.numericTolerance : null,
    acceptedAnswers: Array.isArray(b.acceptedAnswers) ? b.acceptedAnswers.slice(0, 10) : [],
    correctSequence: Array.isArray(b.correctSequence) ? b.correctSequence : [],
    matchingPairs: Array.isArray(b.matchingPairs) ? b.matchingPairs : [],
    category: b.category || 'general',
    tags: Array.isArray(b.tags) ? b.tags.slice(0, 10) : [],
    difficulty: DIFFICULTY.includes(b.difficulty) ? b.difficulty : 'medium',
    bloomsLevel: BLOOMS.includes(b.bloomsLevel) ? b.bloomsLevel : 'understand',
    clinicalArea: b.clinicalArea || null,
    points: Math.max(1, Math.min(100, Number(b.points) || 1)),
    explanation: String(b.explanation || '').slice(0, 2000),
    media: Array.isArray(b.media) ? b.media.slice(0, 5) : [],
    status: 'approved',
    createdBy: ctx.actor.id, createdByName: ctx.actor.fullName || ctx.actor.username,
    createdAt: _now(), usageCount: 0
  };
  store.put('questions', rec);
  audit.write('edu_studio', 'question.create', rec.id, ctx.actor, { type: b.type });
  bus.emit('edu.question.created', { record: rec, actor: ctx.actor });
  return rec;
}

function updateQuestion(ctx) {
  const q = store.get('questions', ctx.params.id);
  if (!q) throw ctx.E.notFound('question_not_found');
  const b = ctx.body || {};
  const merged = Object.assign({}, q, b);
  const err = validateQuestion(merged);
  if (err) throw ctx.E.badRequest(err);
  ['stem','type','options','correctAnswer','correctAnswers','correctNumber','numericTolerance','acceptedAnswers','correctSequence','matchingPairs','category','tags','difficulty','bloomsLevel','clinicalArea','points','explanation','media'].forEach(k => {
    if (b[k] !== undefined) q[k] = merged[k];
  });
  q.updatedAt = _now();
  q.updatedBy = ctx.actor.id;
  store.put('questions', q);
  return q;
}

function deleteQuestion(ctx) {
  const q = store.get('questions', ctx.params.id);
  if (!q) throw ctx.E.notFound('question_not_found');
  const usedIn = _api(ctx, 'exams').filter(e => (e.questionIds || []).includes(q.id));
  if (usedIn.length && !ctx.query.force) throw ctx.E.conflict('used_in_exams:' + usedIn.length);
  store.remove('questions', q.id);
  return { deleted: true, id: q.id };
}

function duplicateQuestion(ctx) {
  const q = store.get('questions', ctx.params.id);
  if (!q) throw ctx.E.notFound('question_not_found');
  const copy = Object.assign({}, q, {
    id: ctx.uid('q'), stem: q.stem + ' (کپی)',
    usageCount: 0,
    createdBy: ctx.actor.id,
    createdByName: ctx.actor.fullName || ctx.actor.username,
    createdAt: _now()
  });
  store.put('questions', copy);
  return copy;
}

// ════════ EXAMS ════════
function listExams(ctx) {
  let items = _api(ctx, 'exams');
  if (ctx.query.status) items = items.filter(e => e.status === ctx.query.status);
  if (ctx.query.category) items = items.filter(e => e.category === ctx.query.category);
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { items: items.map(e => ({
    id: e.id, title: e.title, description: e.description, category: e.category,
    status: e.status, questionCount: (e.questionIds || []).length,
    totalPoints: e.totalPoints || 0, passingScore: e.passingScore,
    timeLimitMinutes: e.timeLimitMinutes, attemptsAllowed: e.attemptsAllowed,
    shuffleQuestions: e.shuffleQuestions, showResultsMode: e.showResultsMode,
    createdByName: e.createdByName, createdAt: e.createdAt, publishedAt: e.publishedAt
  })), total: items.length };
}

function getExam(ctx) {
  const e = store.get('exams', ctx.params.id);
  if (!e) throw ctx.E.notFound('exam_not_found');
  const allQ = _api(ctx, 'questions');
  if ((!e.questions || !e.questions.length) && e.questionIds) {
    e.questions = e.questionIds.map(id => allQ.find(q => q.id === id)).filter(Boolean);
  }
  return e;
}

function createExam(ctx) {
  const b = ctx.body || {};
  if (!b.title || String(b.title).trim().length < 3) throw ctx.E.badRequest('title_required');
  const rec = {
    id: ctx.uid('exm'), title: String(b.title).slice(0, 200),
    description: String(b.description || '').slice(0, 1000),
    category: b.category || 'general',
    tags: Array.isArray(b.tags) ? b.tags.slice(0, 10) : [],
    timeLimitMinutes: Math.max(1, Math.min(600, Number(b.timeLimitMinutes) || 15)),
    passingScore: Math.max(0, Math.min(100, Number(b.passingScore) || 60)),
    attemptsAllowed: Math.max(1, Math.min(20, Number(b.attemptsAllowed) || 1)),
    shuffleQuestions: b.shuffleQuestions === true,
    shuffleOptions: b.shuffleOptions === true,
    showResultsMode: ['immediate','after_due','never'].includes(b.showResultsMode) ? b.showResultsMode : 'immediate',
    availableFrom: b.availableFrom || null,
    availableUntil: b.availableUntil || null,
    antiCheat: {
      preventTabSwitch: b.antiCheat && b.antiCheat.preventTabSwitch === true,
      preventCopyPaste: b.antiCheat && b.antiCheat.preventCopyPaste === true,
      timeWarnings: b.antiCheat && b.antiCheat.timeWarnings !== false
    },
    questions: [], questionIds: [], totalPoints: 0,
    certificate: { enabled: b.certificate && b.certificate.enabled === true, minScore: b.certificate && b.certificate.minScore || 80 },
    status: 'draft',
    createdBy: ctx.actor.id, createdByName: ctx.actor.fullName || ctx.actor.username,
    createdAt: _now()
  };
  store.put('exams', rec);
  return rec;
}

function updateExam(ctx) {
  const e = store.get('exams', ctx.params.id);
  if (!e) throw ctx.E.notFound('exam_not_found');
  if (e.status === 'published' && !ctx.query.force) throw ctx.E.conflict('published_immutable');
  const b = ctx.body || {};
  ['title','description','category','tags','timeLimitMinutes','passingScore','attemptsAllowed','shuffleQuestions','shuffleOptions','showResultsMode','availableFrom','availableUntil','antiCheat','certificate'].forEach(k => {
    if (b[k] !== undefined) e[k] = b[k];
  });
  e.updatedAt = _now();
  store.put('exams', e);
  return e;
}

function setExamQuestions(ctx) {
  const e = store.get('exams', ctx.params.id);
  if (!e) throw ctx.E.notFound('exam_not_found');
  if (e.status === 'published') throw ctx.E.conflict('published_immutable');
  const ids = (ctx.body && ctx.body.questionIds) || [];
  const allQ = _api(ctx, 'questions');
  const qs = ids.map(id => allQ.find(q => q.id === id)).filter(Boolean);
  e.questionIds = qs.map(q => q.id);
  e.questions = qs;
  e.totalPoints = qs.reduce((s, q) => s + (q.points || 1), 0);
  store.put('exams', e);
  return { examId: e.id, questionCount: qs.length, totalPoints: e.totalPoints };
}

function publishExam(ctx) {
  const e = store.get('exams', ctx.params.id);
  if (!e) throw ctx.E.notFound('exam_not_found');
  if (!(e.questionIds || []).length) throw ctx.E.conflict('no_questions');
  e.status = 'published';
  e.publishedAt = _now();
  e.publishedBy = ctx.actor.id;
  store.put('exams', e);
  bus.emit('edu.exam.published', { record: e, actor: ctx.actor });
  return e;
}

function unpublishExam(ctx) {
  const e = store.get('exams', ctx.params.id);
  if (!e) throw ctx.E.notFound('exam_not_found');
  e.status = 'draft';
  store.put('exams', e);
  return e;
}

function deleteExam(ctx) {
  const e = store.get('exams', ctx.params.id);
  if (!e) throw ctx.E.notFound('exam_not_found');
  if (e.status === 'published') throw ctx.E.conflict('unpublish_first');
  store.remove('exams', e.id);
  return { deleted: true, id: e.id };
}

function duplicateExam(ctx) {
  const e = store.get('exams', ctx.params.id);
  if (!e) throw ctx.E.notFound('exam_not_found');
  const copy = Object.assign({}, e, {
    id: ctx.uid('exm'), title: e.title + ' (کپی)',
    status: 'draft', publishedAt: null, publishedBy: null,
    createdBy: ctx.actor.id, createdByName: ctx.actor.fullName || ctx.actor.username,
    createdAt: _now()
  });
  store.put('exams', copy);
  return copy;
}

// ════════ COHORTS ════════
function listCohorts(ctx) {
  let items = _api(ctx, 'edu_cohorts');
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { items: items.map(c => Object.assign({}, c, {
    memberCount: computeCohortMembers(ctx, c).length
  })), total: items.length };
}

function getCohort(ctx) {
  const c = store.get('edu_cohorts', ctx.params.id);
  if (!c) throw ctx.E.notFound('cohort_not_found');
  return c;
}

function previewCohort(ctx) {
  const b = ctx.body || {};
  const allStaff = _api(ctx, 'sa_staff').filter(s => s.active);
  const manual = b.staffIds || [];
  const rules = b.filterRules || [];
  const mode = b.selectionMode || 'manual';
  let fromFilter = [];
  if (mode === 'filter' || mode === 'mixed') {
    fromFilter = allStaff.filter(s => rules.length === 0 || rules.every(r => matchRule(s, r))).map(s => s.id);
  }
  const ids = mode === 'manual' ? manual : mode === 'filter' ? fromFilter : [...new Set([...manual, ...fromFilter])];
  const staffMap = {};
  allStaff.forEach(s => staffMap[s.id] = s);
  return { count: ids.length, staff: ids.map(id => staffMap[id]).filter(Boolean).map(s => ({
    id: s.id, name: s.name, code: s.code, category: s.category, wardId: s.wardId
  })) };
}

function createCohort(ctx) {
  const b = ctx.body || {};
  if (!b.name || String(b.name).trim().length < 2) throw ctx.E.badRequest('name_required');
  const rec = {
    id: ctx.uid('coh'), name: String(b.name).slice(0, 100),
    description: String(b.description || '').slice(0, 500),
    selectionMode: ['manual','filter','mixed'].includes(b.selectionMode) ? b.selectionMode : 'manual',
    staffIds: Array.isArray(b.staffIds) ? b.staffIds.slice(0, 500) : [],
    filterRules: Array.isArray(b.filterRules) ? b.filterRules.slice(0, 10) : [],
    targetRoles: Array.isArray(b.targetRoles) ? b.targetRoles : [],
    active: true,
    createdBy: ctx.actor.id, createdByName: ctx.actor.fullName || ctx.actor.username,
    createdAt: _now()
  };
  store.put('edu_cohorts', rec);
  return rec;
}

function updateCohort(ctx) {
  const c = store.get('edu_cohorts', ctx.params.id);
  if (!c) throw ctx.E.notFound('cohort_not_found');
  const b = ctx.body || {};
  ['name','description','selectionMode','staffIds','filterRules','targetRoles','active'].forEach(k => {
    if (b[k] !== undefined) c[k] = b[k];
  });
  c.updatedAt = _now();
  store.put('edu_cohorts', c);
  return c;
}

function deleteCohort(ctx) {
  const c = store.get('edu_cohorts', ctx.params.id);
  if (!c) throw ctx.E.notFound('cohort_not_found');
  store.remove('edu_cohorts', c.id);
  return { deleted: true, id: c.id };
}

function listStaffForPicker(ctx) {
  let items = _api(ctx, 'sa_staff').filter(s => s.active)
    .map(s => ({ id: s.id, name: s.name, code: s.code, category: s.category, wardId: s.wardId, active: s.active }));
  if (ctx.query.q) {
    const q = String(ctx.query.q).toLowerCase();
    items = items.filter(s => s.name.toLowerCase().includes(q) || s.code.includes(q));
  }
  if (ctx.query.category) items = items.filter(s => s.category === ctx.query.category);
  return { items: items.slice(0, 500), total: items.length };
}

// ════════ ASSIGNMENTS ════════
function listAssignments(ctx) {
  let items = _api(ctx, 'edu_assignments');
  if (ctx.query.examId) items = items.filter(a => a.examId === ctx.query.examId);
  if (ctx.query.cohortId) items = items.filter(a => a.cohortId === ctx.query.cohortId);
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { items: items.slice(0, 200), total: items.length };
}

function createAssignment(ctx) {
  const b = ctx.body || {};
  if (!b.examId) throw ctx.E.badRequest('exam_id_required');
  const e = store.get('exams', b.examId);
  if (!e) throw ctx.E.notFound('exam_not_found');
  if (e.status !== 'published') throw ctx.E.conflict('exam_must_be_published');
  if (!b.cohortId) throw ctx.E.badRequest('cohort_id_required');
  const c = store.get('edu_cohorts', b.cohortId);
  if (!c) throw ctx.E.notFound('cohort_not_found');
  const members = computeCohortMembers(ctx, c);
  if (!members.length) throw ctx.E.badRequest('empty_cohort');
  const rec = {
    id: ctx.uid('asg'), examId: b.examId, examTitle: e.title,
    cohortId: b.cohortId, cohortName: c.name,
    staffIds: members,
    totalStaff: members.length,
    dueAt: b.dueAt || new Date(Date.now() + 7 * 86400000).toISOString(),
    isMandatory: b.isMandatory !== false,
    maxAttempts: Number(b.maxAttempts) || e.attemptsAllowed || 1,
    status: 'active',
    createdBy: ctx.actor.id, createdAt: _now()
  };
  store.put('edu_assignments', rec);
  for (const sid of members) {
    store.put('edu_staff_assignments', {
      id: ctx.uid('sa'), assignmentId: rec.id,
      examId: b.examId, examTitle: e.title, staffId: sid,
      dueAt: rec.dueAt, status: 'assigned',
      createdAt: _now()
    });
  }
  bus.emit('edu.assignment.created', { record: rec, actor: ctx.actor });
  return rec;
}

function deleteAssignment(ctx) {
  const a = store.get('edu_assignments', ctx.params.id);
  if (!a) throw ctx.E.notFound('assignment_not_found');
  store.remove('edu_assignments', a.id);
  for (const sa of _api(ctx, 'edu_staff_assignments').filter(x => x.assignmentId === a.id)) {
    store.remove('edu_staff_assignments', sa.id);
  }
  return { deleted: true, id: a.id };
}

// ════════ ATTEMPTS ════════
function startAttempt(ctx) {
  const e = store.get('exams', ctx.params.id);
  if (!e) throw ctx.E.notFound('exam_not_found');
  if (e.status !== 'published') throw ctx.E.conflict('not_published');
  const prevAttempts = _api(ctx, 'attempts').filter(a => a.examId === e.id && a.userId === ctx.actor.id && a.status === 'submitted');
  if (prevAttempts.length >= e.attemptsAllowed) throw ctx.E.conflict('max_attempts');
  const allQ = _api(ctx, 'questions');
  const qs = (e.questionIds || []).map(id => allQ.find(q => q.id === id)).filter(Boolean).map(q => ({
    id: q.id, type: q.type, stem: q.stem, options: q.options || [],
    points: q.points || 1, media: q.media || []
  }));
  const rec = {
    id: ctx.uid('att'), examId: e.id, examTitle: e.title,
    userId: ctx.actor.id, userName: ctx.actor.fullName || ctx.actor.username,
    attemptNumber: prevAttempts.length + 1,
    questions: qs, answers: {},
    startedAt: _now(),
    endsAt: new Date(Date.now() + e.timeLimitMinutes * 60000).toISOString(),
    status: 'in_progress',
    antiCheatEvents: []
  };
  store.put('attempts', rec);
  return rec;
}

function submitAttempt(ctx) {
  const a = store.get('attempts', ctx.params.id);
  if (!a) throw ctx.E.notFound('attempt_not_found');
  if (a.userId !== ctx.actor.id) throw ctx.E.forbidden('not_your_attempt');
  if (a.status !== 'in_progress') throw ctx.E.conflict('already_submitted');
  const e = store.get('exams', a.examId);
  const allQ = _api(ctx, 'questions');
  const answers = (ctx.body && ctx.body.answers) || a.answers || {};
  let earned = 0, total = 0, manualPending = 0;
  const graded = [];
  for (const qa of a.questions) {
    const qFull = allQ.find(q => q.id === qa.id);
    const pts = (qFull && qFull.points) || qa.points || 1;
    total += pts;
    const given = answers[qa.id];
    if (!qFull) continue;
    const res = scoreAnswer(qFull, given);
    if (res.manual) { manualPending++; graded.push({ id: qa.id, given, awarded: 0, manual: true }); }
    else { earned += res.awarded; graded.push({ id: qa.id, given, awarded: res.awarded, correct: res.correct }); }
  }
  a.answers = answers;
  a.graded = graded;
  a.score = total > 0 ? Math.round(earned / total * 100) : 0;
  a.earned = earned;
  a.total = total;
  a.manualPending = manualPending;
  a.submittedAt = _now();
  a.status = manualPending > 0 ? 'pending_manual' : 'graded';
  a.passed = manualPending === 0 ? (a.score >= (e.passingScore || 60)) : null;
  store.put('attempts', a);
  if (a.status === 'graded' && a.passed && e && e.certificate && e.certificate.enabled) {
    const cert = {
      id: ctx.uid('cert'), userId: a.userId, userName: a.userName,
      examId: e.id, examTitle: e.title, score: a.score,
      issuedAt: _now(),
      verificationCode: 'CERT-' + Math.random().toString(36).slice(2, 10).toUpperCase()
    };
    store.put('certificates', cert);
    bus.emit('edu.certificate.issued', { record: cert, actor: ctx.actor });
  }
  return a;
}

function listAttempts(ctx) {
  let items = _api(ctx, 'attempts');
  if (ctx.query.examId) items = items.filter(a => a.examId === ctx.query.examId);
  if (ctx.query.userId) items = items.filter(a => a.userId === ctx.query.userId);
  if (ctx.query.status) items = items.filter(a => a.status === ctx.query.status);
  items.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  return { items: items.slice(0, 200), total: items.length };
}

function gradeAttempt(ctx) {
  const a = store.get('attempts', ctx.params.id);
  if (!a) throw ctx.E.notFound('attempt_not_found');
  const b = ctx.body || {};
  const scores = b.scores || {};
  for (const g of a.graded || []) {
    if (g.manual && scores[g.id] !== undefined) {
      g.awarded = Math.max(0, Math.min(a.questions.find(x => x.id === g.id)?.points || 1, Number(scores[g.id]) || 0));
      g.gradedBy = ctx.actor.id;
      g.gradedAt = _now();
    }
  }
  a.earned = a.graded.reduce((s, g) => s + (g.awarded || 0), 0);
  a.score = a.total > 0 ? Math.round(a.earned / a.total * 100) : 0;
  a.manualPending = a.graded.filter(g => g.manual && g.gradedBy === undefined).length;
  if (a.manualPending === 0) {
    a.status = 'graded';
    const e = store.get('exams', a.examId);
    a.passed = a.score >= (e.passingScore || 60);
    if (a.passed && e.certificate && e.certificate.enabled) {
      const cert = {
        id: ctx.uid('cert'), userId: a.userId, userName: a.userName,
        examId: e.id, examTitle: e.title, score: a.score,
        issuedAt: _now(),
        verificationCode: 'CERT-' + Math.random().toString(36).slice(2, 10).toUpperCase()
      };
      store.put('certificates', cert);
      bus.emit('edu.certificate.issued', { record: cert, actor: ctx.actor });
    }
  }
  a.gradedAt = _now();
  a.gradedBy = ctx.actor.id;
  store.put('attempts', a);
  return a;
}

// ════════ CERTIFICATES ════════
function listCertificates(ctx) {
  let items = _api(ctx, 'certificates');
  if (ctx.query.userId) items = items.filter(c => c.userId === ctx.query.userId);
  items.sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
  return { items: items.slice(0, 100), total: items.length };
}

function verifyCertificate(ctx) {
  const code = ctx.params.code;
  const cert = _api(ctx, 'certificates').find(c => c.verificationCode === code);
  if (!cert) return { valid: false, reason: 'not_found' };
  return { valid: true, certificate: cert };
}

// ════════ ANALYTICS ════════
function analytics(ctx) {
  const exams = _api(ctx, 'exams');
  const attempts = _api(ctx, 'attempts');
  const cohorts = _api(ctx, 'edu_cohorts');
  const assignments = _api(ctx, 'edu_assignments');
  const questions = _api(ctx, 'questions');
  const certs = _api(ctx, 'certificates');

  const byExam = exams.map(e => {
    const eatt = attempts.filter(a => a.examId === e.id && a.status === 'graded');
    const avg = eatt.length ? Math.round(eatt.reduce((s, a) => s + (a.score || 0), 0) / eatt.length) : 0;
    const pass = eatt.filter(a => a.passed).length;
    return {
      id: e.id, title: e.title, status: e.status,
      attempts: eatt.length, avgScore: avg,
      passRate: eatt.length ? Math.round(pass / eatt.length * 100) : 0
    };
  });

  const byCohort = cohorts.map(c => {
    const cass = assignments.filter(a => a.cohortId === c.id);
    const staffAssignments = _api(ctx, 'edu_staff_assignments').filter(sa => cass.some(a => a.id === sa.assignmentId));
    const completed = staffAssignments.filter(sa => sa.status === 'completed').length;
    return {
      id: c.id, name: c.name,
      staffCount: (c.staffIds || []).length,
      assignments: cass.length, completed,
      progress: staffAssignments.length ? Math.round(completed / staffAssignments.length * 100) : 0
    };
  });

  return {
    stats: {
      exams: exams.length, published: exams.filter(e => e.status === 'published').length,
      questions: questions.length, cohorts: cohorts.length,
      assignments: assignments.length, attempts: attempts.length,
      certificates: certs.length
    },
    exams: byExam, cohorts: byCohort,
    recentAttempts: attempts.slice(-10).reverse().map(a => ({
      examTitle: a.examTitle, userName: a.userName, score: a.score, passed: a.passed, submittedAt: a.submittedAt
    }))
  };
}

function examAnalytics(ctx) {
  const e = store.get('exams', ctx.params.id);
  if (!e) throw ctx.E.notFound('exam_not_found');
  const attempts = _api(ctx, 'attempts').filter(a => a.examId === e.id && a.status === 'graded');
  const questions = _api(ctx, 'questions');
  const qStats = (e.questionIds || []).map(qid => {
    const q = questions.find(x => x.id === qid);
    if (!q) return null;
    const answers = attempts.flatMap(a => (a.graded || []).filter(g => g.id === qid));
    const total = answers.length;
    const correct = answers.filter(x => x.correct === true).length;
    return {
      id: qid, stem: q.stem, type: q.type,
      timesAnswered: total, timesCorrect: correct,
      pValue: total > 0 ? Math.round(correct / total * 100) : null
    };
  }).filter(Boolean);
  return {
    exam: { id: e.id, title: e.title, status: e.status, questionCount: (e.questionIds || []).length, totalPoints: e.totalPoints },
    attempts: attempts.length,
    avgScore: attempts.length ? Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / attempts.length) : 0,
    passRate: attempts.length ? Math.round(attempts.filter(a => a.passed).length / attempts.length * 100) : 0,
    questionStats: qStats
  };
}

function cohortProgress(ctx) {
  const c = store.get('edu_cohorts', ctx.params.id);
  if (!c) throw ctx.E.notFound('cohort_not_found');
  const assignments = _api(ctx, 'edu_assignments').filter(a => a.cohortId === c.id);
  const staffAssignments = _api(ctx, 'edu_staff_assignments').filter(sa => assignments.some(a => a.id === sa.assignmentId));
  const allStaff = _api(ctx, 'sa_staff');
  const staffMap = {};
  allStaff.forEach(s => staffMap[s.id] = s);
  const byStaff = (c.staffIds || []).map(sid => {
    const s = staffMap[sid];
    if (!s) return null;
    const myAssignments = staffAssignments.filter(sa => sa.staffId === sid);
    const completed = myAssignments.filter(sa => sa.status === 'completed').length;
    return { id: sid, name: s.name, code: s.code, assignments: myAssignments.length, completed };
  }).filter(Boolean);
  return {
    cohort: { id: c.id, name: c.name, memberCount: (c.staffIds || []).length },
    assignments: assignments.length,
    completedTotal: staffAssignments.filter(sa => sa.status === 'completed').length,
    staffProgress: byStaff
  };
}

module.exports = {
  handlers: {
    listQuestions, getQuestion, createQuestion, updateQuestion, deleteQuestion, duplicateQuestion,
    listExams, getExam, createExam, updateExam, setExamQuestions, publishExam, unpublishExam, deleteExam, duplicateExam,
    listCohorts, getCohort, previewCohort, createCohort, updateCohort, deleteCohort, listStaffForPicker,
    listAssignments, createAssignment, deleteAssignment,
    startAttempt, submitAttempt, listAttempts, gradeAttempt,
    listCertificates, verifyCertificate,
    analytics, examAnalytics, cohortProgress
  },
  routes: [
    // Questions
    { method: 'GET',    path: '/api/edu-studio/questions',              handler: 'listQuestions',      perm: 'edu.studio.view' },
    { method: 'POST',   path: '/api/edu-studio/questions',              handler: 'createQuestion',     perm: 'edu.studio.manage' },
    { method: 'GET',    path: '/api/edu-studio/questions/:id',          handler: 'getQuestion',        perm: 'edu.studio.view' },
    { method: 'PUT',    path: '/api/edu-studio/questions/:id',          handler: 'updateQuestion',     perm: 'edu.studio.manage' },
    { method: 'DELETE', path: '/api/edu-studio/questions/:id',          handler: 'deleteQuestion',     perm: 'edu.studio.manage' },
    { method: 'POST',   path: '/api/edu-studio/questions/:id/duplicate', handler: 'duplicateQuestion', perm: 'edu.studio.manage' },
    // Exams
    { method: 'GET',    path: '/api/edu-studio/exams',                  handler: 'listExams',          perm: 'edu.studio.view' },
    { method: 'POST',   path: '/api/edu-studio/exams',                  handler: 'createExam',         perm: 'edu.studio.manage' },
    { method: 'GET',    path: '/api/edu-studio/exams/:id',              handler: 'getExam',            perm: 'edu.studio.view' },
    { method: 'PUT',    path: '/api/edu-studio/exams/:id',              handler: 'updateExam',         perm: 'edu.studio.manage' },
    { method: 'DELETE', path: '/api/edu-studio/exams/:id',              handler: 'deleteExam',         perm: 'edu.studio.manage' },
    { method: 'POST',   path: '/api/edu-studio/exams/:id/questions',    handler: 'setExamQuestions',   perm: 'edu.studio.manage' },
    { method: 'POST',   path: '/api/edu-studio/exams/:id/publish',      handler: 'publishExam',        perm: 'edu.studio.manage' },
    { method: 'POST',   path: '/api/edu-studio/exams/:id/unpublish',    handler: 'unpublishExam',      perm: 'edu.studio.manage' },
    { method: 'POST',   path: '/api/edu-studio/exams/:id/duplicate',    handler: 'duplicateExam',      perm: 'edu.studio.manage' },
    { method: 'GET',    path: '/api/edu-studio/exams/:id/analytics',    handler: 'examAnalytics',      perm: 'edu.studio.view' },
    // Cohorts
    { method: 'GET',    path: '/api/edu-studio/cohorts',                handler: 'listCohorts',        perm: 'edu.studio.view' },
    { method: 'POST',   path: '/api/edu-studio/cohorts',                handler: 'createCohort',       perm: 'edu.studio.manage' },
    { method: 'GET',    path: '/api/edu-studio/cohorts/:id',            handler: 'getCohort',          perm: 'edu.studio.view' },
    { method: 'PUT',    path: '/api/edu-studio/cohorts/:id',            handler: 'updateCohort',       perm: 'edu.studio.manage' },
    { method: 'DELETE', path: '/api/edu-studio/cohorts/:id',            handler: 'deleteCohort',       perm: 'edu.studio.manage' },
    { method: 'POST',   path: '/api/edu-studio/cohorts/preview',        handler: 'previewCohort',      perm: 'edu.studio.view' },
    { method: 'GET',    path: '/api/edu-studio/cohorts/:id/progress',   handler: 'cohortProgress',     perm: 'edu.studio.view' },
    { method: 'GET',    path: '/api/edu-studio/staff',                  handler: 'listStaffForPicker', perm: 'edu.studio.view' },
    // Assignments
    { method: 'GET',    path: '/api/edu-studio/assignments',            handler: 'listAssignments',    perm: 'edu.studio.view' },
    { method: 'POST',   path: '/api/edu-studio/assignments',            handler: 'createAssignment',   perm: 'edu.studio.manage' },
    { method: 'DELETE', path: '/api/edu-studio/assignments/:id',        handler: 'deleteAssignment',   perm: 'edu.studio.manage' },
    // Attempts
    { method: 'GET',    path: '/api/edu-studio/attempts',               handler: 'listAttempts',       perm: 'edu.studio.view' },
    { method: 'POST',   path: '/api/edu-studio/exams/:id/start',        handler: 'startAttempt',       perm: null },
    { method: 'POST',   path: '/api/edu-studio/attempts/:id/submit',    handler: 'submitAttempt',      perm: null },
    { method: 'POST',   path: '/api/edu-studio/attempts/:id/grade',     handler: 'gradeAttempt',       perm: 'edu.studio.manage' },
    // Certificates
    { method: 'GET',    path: '/api/edu-studio/certificates',           handler: 'listCertificates',   perm: null },
    { method: 'GET',    path: '/api/edu-studio/certificates/:code/verify', handler: 'verifyCertificate', perm: null },
    // Analytics
    { method: 'GET',    path: '/api/edu-studio/analytics',              handler: 'analytics',          perm: 'edu.studio.view' }
  ],
  panels: [
    { id: 'studio', title: 'استودیوی آموزشی', icon: '🎓', perm: 'edu.studio.view',
      kind: 'edu_studio', api: '/api/edu-studio/analytics' }
  ]
};

console.log('[education-studio] comprehensive backend loaded');
