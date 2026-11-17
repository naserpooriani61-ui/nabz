
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Adaptive Learning Engine
//  SM-2 spaced repetition + auto-generated drills + scenarios
//  Personalized from real hospital data (CDSS, MAR, NANDA, incidents)
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const store = require('../core/store');
const bus = require('../core/events');
const perms = require('../core/permissions');
const cdss = require('./cdss');

if (!perms.P['learning.view']) {
  perms.P['learning.view'] = 'admin,nurse,nurse_aide,head_nurse,resident,intern,attending,specialist,physician,pharmacist,lab_tech,radiology_tech,midwife,anesthesiologist,surgeon,supervisor,supervisor_clinical,supervisor_education,nursing_director,medical_director';
  perms.P['learning.drill'] = 'admin,nurse,nurse_aide,head_nurse,resident,intern,attending,specialist,physician,pharmacist,lab_tech,radiology_tech,midwife,anesthesiologist,surgeon';
}

// ═══════════════════════════════════════════════════════════
//  SM-2 Algorithm
// ═══════════════════════════════════════════════════════════
function sm2(state, quality) {
  // quality: 0-5 (0=total blackout, 5=perfect)
  state = state || { repetitions: 0, interval: 1, easeFactor: 2.5, dueAt: new Date().toISOString() };
  quality = Math.max(0, Math.min(5, Number(quality) || 0));

  if (quality < 3) {
    state.repetitions = 0;
    state.interval = 1;
  } else {
    if (state.repetitions === 0) state.interval = 1;
    else if (state.repetitions === 1) state.interval = 6;
    else state.interval = Math.round(state.interval * state.easeFactor);
    state.repetitions++;
  }

  state.easeFactor = Math.max(1.3,
    state.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  const nextDue = new Date(Date.now() + state.interval * 86400000);
  state.dueAt = nextDue.toISOString();
  state.lastReviewedAt = new Date().toISOString();
  state.lastQuality = quality;
  state.totalReviews = (state.totalReviews || 0) + 1;

  return state;
}

// ═══════════════════════════════════════════════════════════
//  Drill generators from real data
// ═══════════════════════════════════════════════════════════

// ─── From CDSS drug interaction DB ───
function generateInteractionDrill(index) {
  // Access CDSS internal DRUG_INTERACTIONS if exposed; fall back to catalog
  let catalog;
  try {
    catalog = cdss.handlers.listDrugs({});
  } catch (_) {
    catalog = { interactionPairs: [] };
  }
  const pairs = catalog.interactionPairs || [];
  if (!pairs.length) return null;
  const p = pairs[index % pairs.length];
  // Build question: given two drugs, what's the interaction severity?
  return {
    id: 'gen_int_' + index,
    source: 'cdss_interactions',
    category: 'medication',
    difficulty: p.severity === 'major' ? 'hard' : 'medium',
    fa_question: 'تداخل ' + p.a + ' + ' + p.b + ' — شدت؟',
    question: 'Drug: ' + p.a + ' + ' + p.b + '. What is the severity of this interaction?',
    options: [
      { id: 'a', text: 'Major', isCorrect: p.severity === 'major' },
      { id: 'b', text: 'Moderate', isCorrect: p.severity === 'moderate' },
      { id: 'c', text: 'Minor', isCorrect: p.severity === 'minor' },
      { id: 'd', text: 'No interaction', isCorrect: false }
    ].filter(o => o.isCorrect || Math.random() > 0.3).slice(0, 4),
    explanation_fa: 'تداخل ' + p.a + ' + ' + p.b + ' سطح ' + p.severity + ' — اقدام لازم: ' + (p.severity === 'major' ? 'اجتناب' : 'پایش'),
    reference: 'CDSS / ISMP'
  };
}

// ─── From NANDA/NOC/NIC (from NCP module) ───
function generateNandaDrill(ctx, index) {
  let nandaData;
  try {
    const ncp = require('./nursing_care_plan');
    nandaData = ncp.handlers.listNanda(ctx);
  } catch (_) { return null; }
  const items = nandaData.items || [];
  if (!items.length) return null;
  const diag = items[index % items.length];
  // Question: which domain does this NANDA belong to?
  const domains = Object.values(nandaData.domainLabels || {});
  const correctDomain = (nandaData.domainLabels || {})[diag.domain];
  if (!correctDomain) return null;
  const wrongDomains = domains.filter(d => d !== correctDomain).slice(0, 3);
  const options = [
    { id: 'correct', text: correctDomain, isCorrect: true }
  ].concat(wrongDomains.map((d, i) => ({ id: 'w' + i, text: d, isCorrect: false })));
  // Shuffle
  const shuffled = options.sort(() => Math.random() - 0.5);
  return {
    id: 'gen_nanda_' + index,
    source: 'nanda_noc',
    category: 'documentation',
    difficulty: 'medium',
    fa_question: 'تشخیص «' + diag.fa + '» در کدام دامنه NANDA است؟',
    question: 'Which NANDA domain does ' + diag.fa + ' belong to?',
    options: shuffled,
    explanation_fa: '«' + diag.fa + '» در دامنه ' + correctDomain + ' (کد ' + diag.code + ') است.',
    reference: 'NANDA-I 2021-2023'
  };
}

// ─── From own MAR errors ───
function generateMARDrill(ctx, index) {
  const userId = ctx.actor.id;
  const myMAR = h(ctx, 'mar').filter(m => m.administeredBy === userId || m.refusedBy === userId);
  const errors = myMAR.filter(m => m.status === 'missed' || m.lateMinutes > 60 || m.allergyOverrideReason);
  if (!errors.length) return null;
  const err = errors[index % errors.length];
  // Generic learning point per error type
  let question, explanation;
  if (err.status === 'missed') {
    question = 'دوز «' + err.drugName + '» که برای بیمار برنامه‌ریزی شده بود داده نشد. اولین اقدام صحیح چیست؟';
    const correct = 'ثبت reason code + اطلاع پزشک در همان شیفت';
    const opts = [
      { id: 'a', text: correct, isCorrect: true },
      { id: 'b', text: 'ثبت در شیفت بعد', isCorrect: false },
      { id: 'c', text: 'نادیده گرفتن اگر بیمار پایدار است', isCorrect: false },
      { id: 'd', text: 'دو برابر دوز در نوبت بعدی', isCorrect: false }
    ];
    explanation = 'طبق ISMP، دوز missed باید با reason code مستند شود و پزشک در همان شیفت مطلع گردد.';
    return {
      id: 'gen_mar_' + index,
      source: 'mar_error',
      category: 'medication',
      difficulty: 'medium',
      fa_question: question,
      options: opts,
      explanation_fa: explanation,
      reference: 'ISMP Late Doses'
    };
  }
  if (err.lateMinutes > 60) {
    question = 'دوز «' + err.drugName + '» با ' + err.lateMinutes + ' دقیقه تأخیر داده شد. کدام اقدام درست بود؟';
    const opts = [
      { id: 'a', text: 'ثبت late reason code قبل از administer', isCorrect: true },
      { id: 'b', text: 'دوز را رد کردن بدون ثبت', isCorrect: false },
      { id: 'c', text: 'بدون ثبت تاخیر administer', isCorrect: false },
      { id: 'd', text: 'دوز را به شیفت بعد موکول کردن', isCorrect: false }
    ];
    return {
      id: 'gen_mar_late_' + index,
      source: 'mar_error',
      category: 'medication',
      difficulty: 'medium',
      fa_question: question,
      options: opts,
      explanation_fa: 'تأخیر > ۳۰ دقیقه نیاز به reason code دارد (ISMP). تأخیر > ۶۰ دقیقه ممکن است پزشک را نیازمند اطلاع کند.',
      reference: 'ISMP'
    };
  }
  return null;
}

// ─── From own HIGH-ALERT MAR (reinforce correct behavior) ───
function generateHighAlertDrill(ctx, index) {
  const userId = ctx.actor.id;
  const myHigh = h(ctx, 'mar').filter(m => m.administeredBy === userId && m.isHighAlert && m.status === 'given');
  if (!myHigh.length) return null;
  const m = myHigh[index % myHigh.length];
  const question = 'دوز «' + m.drugName + '» (High-Alert) که داده‌اید — چرا شاهد اجباری است؟';
  const opts = [
    { id: 'a', text: 'کاهش خطر خطای دوز در داروهای پرخطر (ISMP)', isCorrect: true },
    { id: 'b', text: 'صرفه‌جویی زمان', isCorrect: false },
    { id: 'c', text: 'الزام بیمه', isCorrect: false },
    { id: 'd', text: 'فقط برای بیهوشی', isCorrect: false }
  ];
  return {
    id: 'gen_high_' + index,
    source: 'high_alert_reinforce',
    category: 'medication',
    difficulty: 'easy',
    fa_question: question,
    options: opts,
    explanation_fa: 'ISMP 2024 الزام شاهد مستقل برای همه High-Alert Medications دارد (مورفین، هپارین، انسولین، شیمی‌درمانی و...).',
    reference: 'ISMP 2024'
  };
}

// ─── From own sepsis data ───
function generateSepsisDrill(ctx, index) {
  const userId = ctx.actor.id;
  const mySepsis = h(ctx, 'sepsis').filter(s => s.screenedBy === userId);
  if (!mySepsis.length) return null;
  const s = mySepsis[index % mySepsis.length];
  const question = 'SSC 2021: کدام یک جزء bundle ۳ ساعته سپسیس نیست؟';
  const opts = [
    { id: 'a', text: 'وازوپرسور برای MAP ≥ ۶۵', isCorrect: true }, // 6h not 3h
    { id: 'b', text: 'کشت خون ×۲ قبل از آنتی‌بیوتیک', isCorrect: false },
    { id: 'c', text: 'آنتی‌بیوتیک وسیع‌الطیف', isCorrect: false },
    { id: 'd', text: 'لاکتات سرم', isCorrect: false }
  ];
  return {
    id: 'gen_sepsis_' + index,
    source: 'sepsis_3h',
    category: 'clinical',
    difficulty: 'hard',
    fa_question: question,
    options: opts,
    explanation_fa: 'وازوپرسور جزء ۶h bundle است (نه ۳h). ۳h = لاکتات + کشت + آنتی‌بیوتیک + مایع ۳۰ml/kg.',
    reference: 'Surviving Sepsis Campaign 2021'
  };
}

// ─── From incident learning ───
function generateIncidentDrill(ctx, index) {
  const ward = ctx.actor.ward;
  const incidents = h(ctx, 'incidents').filter(i => (!ward || i.wardCode === ward) &&
    i.category === 'fall' && i.severity !== 'near_miss');
  if (!incidents.length) return null;
  const question = 'پس از سقوط بیمار (JCI IPSG.6)، اولین اقدام مستندسازی چه باید باشد؟';
  const opts = [
    { id: 'a', text: 'ارزیابی آسیب + اطلاع پزشک + ثبت incident report + بازبینی Morse', isCorrect: true },
    { id: 'b', text: 'فقط ثبت در پرونده', isCorrect: false },
    { id: 'c', text: 'جابجایی بیمار به تخت دیگر', isCorrect: false },
    { id: 'd', text: 'اطلاع به خانواده قبل از ارزیابی', isCorrect: false }
  ];
  return {
    id: 'gen_fall_' + index,
    source: 'incident_fall',
    category: 'clinical',
    difficulty: 'medium',
    fa_question: question,
    options: opts,
    explanation_fa: 'پس از سقوط: ABCDE → ارزیابی آسیب → اطلاع پزشک → مستندسازی → بازبینی Morse + اقدامات پیشگیرانه.',
    reference: 'JCI IPSG.6'
  };
}

// ─── Generator dispatcher ───
function pickDrills(ctx, count) {
  const generators = [
    generateInteractionDrill,
    (idx) => generateNandaDrill(ctx, idx),
    (idx) => generateMARDrill(ctx, idx),
    (idx) => generateHighAlertDrill(ctx, idx),
    (idx) => generateSepsisDrill(ctx, idx),
    (idx) => generateIncidentDrill(ctx, idx)
  ];
  const result = [];
  let tries = 0;
  while (result.length < count && tries < count * 10) {
    const gi = Math.floor(Math.random() * generators.length);
    const gen = generators[gi];
    const drill = gen(Math.floor(Math.random() * 20));
    if (drill && !result.find(r => r.id === drill.id)) {
      // Shuffle options
      drill.options = drill.options.sort(() => Math.random() - 0.5);
      result.push(drill);
    }
    tries++;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════
//  SRS state per user × card
// ═══════════════════════════════════════════════════════════
function getSRS(userId, cardId) {
  return h(store ? { store } : { store }, 'srs_state')
    .find(s => s.userId === userId && s.cardId === cardId);
}

function ensureCard(ctx, drill) {
  // Persist generated drill as reusable card
  const existing = h(ctx, 'drill_cards').find(c => c.sourceId === drill.id);
  if (existing) return existing;
  const card = {
    id: ctx.uid('dc'),
    sourceId: drill.id,
    source: drill.source,
    category: drill.category,
    difficulty: drill.difficulty,
    fa_question: drill.fa_question,
    question: drill.question || drill.fa_question,
    options: drill.options,
    explanation_fa: drill.explanation_fa,
    reference: drill.reference,
    createdAt: new Date().toISOString(),
    usage_count: 0,
    correct_count: 0
  };
  store.put('drill_cards', card);
  return card;
}

// ═══════════════════════════════════════════════════════════
//  Session: get due drills for a user
// ═══════════════════════════════════════════════════════════
function due(ctx) {
  const userId = ctx.actor.id;
  const limit = Math.min(20, Number(ctx.query.limit) || 5);
  const now = Date.now();

  // Find due cards from SRS
  const dueSRS = h(ctx, 'srs_state').filter(s => s.userId === userId && sd(s.dueAt) <= now)
    .sort((a, b) => sd(a.dueAt) - sd(b.dueAt)).slice(0, limit);

  const cards = [];
  for (const s of dueSRS) {
    const c = store.get('drill_cards', s.cardId);
    if (c) cards.push({ card: c, srs: s, isNew: false });
  }

  // Fill remaining slots with new cards from generators
  const remaining = limit - cards.length;
  if (remaining > 0) {
    const generated = pickDrills(ctx, remaining * 2);
    const seen = new Set(cards.map(x => x.card.id));
    for (const d of generated) {
      if (cards.length >= limit) break;
      const c = ensureCard(ctx, d);
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      // Skip if user already has SRS state
      const existing = h(ctx, 'srs_state').find(s => s.userId === userId && s.cardId === c.id);
      if (existing) continue;
      cards.push({ card: c, srs: null, isNew: true });
    }
  }

  return {
    items: cards,
    total: cards.length,
    dueCount: dueSRS.length,
    newCount: cards.filter(x => x.isNew).length,
    userId,
    generatedAt: new Date().toISOString()
  };
}

// ═══════════════════════════════════════════════════════════
//  Review: submit an answer
// ═══════════════════════════════════════════════════════════
function review(ctx) {
  const b = ctx.body || {};
  if (!b.cardId) throw ctx.E.badRequest('card_id_required');
  if (!b.optionId) throw ctx.E.badRequest('option_id_required');
  const card = store.get('drill_cards', b.cardId);
  if (!card) throw ctx.E.notFound('card_not_found');
  const chosen = (card.options || []).find(o => o.id === b.optionId);
  if (!chosen) throw ctx.E.badRequest('option_not_found');
  const correct = chosen.isCorrect === true;

  // Record attempt
  const attempt = {
    id: ctx.uid('att'),
    userId: ctx.actor.id,
    cardId: card.id,
    optionId: b.optionId,
    correct,
    responseMs: Number(b.responseMs) || null,
    attemptedAt: new Date().toISOString()
  };
  store.put('drill_attempts', attempt);

  // Update card stats
  card.usage_count = (card.usage_count || 0) + 1;
  if (correct) card.correct_count = (card.correct_count || 0) + 1;
  card.lastUsedAt = new Date().toISOString();
  store.put('drill_cards', card);

  // Update SRS state (SM-2)
  let srs = h(ctx, 'srs_state').find(s => s.userId === ctx.actor.id && s.cardId === card.id);
  if (!srs) {
    srs = { id: ctx.uid('srs'), userId: ctx.actor.id, cardId: card.id, repetitions: 0, interval: 1, easeFactor: 2.5 };
  }
  // Quality score for SM-2: correct→4 (or 5 if quick), wrong→2
  const quality = correct ? (attempt.responseMs && attempt.responseMs < 8000 ? 5 : 4) : 2;
  srs = sm2(srs, quality);
  store.put('srs_state', srs);

  // Update competency-linked progress
  try {
    linkToCompetency(ctx, card, correct);
  } catch (_) {}

  return {
    correct,
    correctOptionId: (card.options.find(o => o.isCorrect) || {}).id,
    explanation_fa: card.explanation_fa,
    reference: card.reference,
    srs: {
      repetitions: srs.repetitions,
      interval: srs.interval,
      easeFactor: srs.easeFactor,
      nextDue: srs.dueAt
    },
    attempt
  };
}

// Link drill to competency progress
function linkToCompetency(ctx, card, correct) {
  // Map category → competency code
  const map = {
    medication: 'HIGH_ALERT_MED',
    clinical: 'VITAL_SIGNS',
    documentation: 'NANDA_NOC',
    infection: 'HAND_HYGIENE'
  };
  const compCode = map[card.category];
  if (!compCode) return;
  const key = 'drill_progress_' + ctx.actor.id + '_' + compCode;
  let prog = store.get('drill_progress', key);
  if (!prog) {
    prog = { id: key, userId: ctx.actor.id, competencyCode: compCode, total: 0, correct: 0 };
  }
  prog.total++;
  if (correct) prog.correct++;
  prog.lastAt = new Date().toISOString();
  store.put('drill_progress', prog);
}

// ═══════════════════════════════════════════════════════════
//  Progress stats
// ═══════════════════════════════════════════════════════════
function progress(ctx) {
  const userId = ctx.actor.id;
  const attempts = h(ctx, 'drill_attempts').filter(a => a.userId === userId);
  const last7 = attempts.filter(a => sd(a.attemptedAt) > Date.now() - 7 * 86400000);
  const last30 = attempts.filter(a => sd(a.attemptedAt) > Date.now() - 30 * 86400000);
  const byCategory = {};
  for (const a of attempts) {
    const card = store.get('drill_cards', a.cardId);
    if (!card) continue;
    const cat = card.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = { total: 0, correct: 0 };
    byCategory[cat].total++;
    if (a.correct) byCategory[cat].correct++;
  }
  const dueSRS = h(ctx, 'srs_state').filter(s => s.userId === userId && sd(s.dueAt) <= Date.now());
  return {
    overall: {
      totalAttempts: attempts.length,
      last7Days: last7.length,
      last30Days: last30.length,
      overallCorrectPct: attempts.length > 0
        ? Math.round((attempts.filter(a => a.correct).length / attempts.length) * 100)
        : 0,
      dueNow: dueSRS.length
    },
    byCategory: Object.entries(byCategory).map(([cat, v]) => ({
      category: cat, total: v.total, correct: v.correct,
      accuracyPct: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0
    })),
    streak: calcStreak(attempts)
  };
}

function calcStreak(attempts) {
  const days = new Set(attempts.map(a => a.attemptedAt.slice(0, 10)));
  let streak = 0;
  let d = new Date();
  for (let i = 0; i < 365; i++) {
    const ds = d.toISOString().slice(0, 10);
    if (days.has(ds)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ═══════════════════════════════════════════════════════════
//  Branching Clinical Scenarios
// ═══════════════════════════════════════════════════════════
const SCENARIOS = {
  'sepsis_recognition': {
    id: 'sepsis_recognition',
    fa: 'تشخیص سپسیس — تصمیم سریع',
    difficulty: 'hard',
    category: 'clinical',
    estimatedMin: 5,
    clinicalCase: 'بیمار ۷۲ ساله، بستری در ICU داخلی به دلیل پنومونی. ۴ ساعت پیش: HR 98, BP 128/82, RR 20, T 38.5, SpO2 94%. الان: HR 118, BP 96/60, RR 26, T 39.2, SpO2 91%, GCS 14 (قبلاً ۱۵).',
    startStep: 's1',
    steps: {
      s1: {
        question: 'اولین اقدام شما چیست؟',
        choices: [
          { id: 'a', text: 'محاسبه qSOFA + NEWS2 و شروع Sepsis Screen', next: 's2a', isCorrect: true },
          { id: 'b', text: 'ادامه مانیتورینگ و ارزیابی مجدد ۱ ساعت بعد', next: 's2b', isCorrect: false },
          { id: 'c', text: 'فقط اکسیژن O2 ۲ لیتر شروع و تماس با پزشک', next: 's2c', isCorrect: false }
        ]
      },
      s2a: {
        question: 'qSOFA = ۳ (RR≥22, SBP≤100, GCS<15). لاکتات ۴.۲. شما دستور شروع bundle ۳ ساعته را ثبت کردید. کدام ترتیب درست است؟',
        choices: [
          { id: 'a', text: 'کشت خون → آنتی‌بیوتیک → مایع ۳۰ml/kg → لاکتات', next: 's3a', isCorrect: false },
          { id: 'b', text: 'لاکتات → کشت خون → آنتی‌بیوتیک وسیع‌الطیف → مایع ۳۰ml/kg', next: 's3b', isCorrect: true },
          { id: 'c', text: 'آنتی‌بیوتیک → لاکتات → کشت → مایع', next: 's3c', isCorrect: false }
        ]
      },
      s2b: {
        question: 'در ۱ ساعت بعد بیمار دچار افت هوشیاری (GCS 12) و SBP 82 می‌شود. اولین اقدام؟',
        choices: [
          { id: 'a', text: 'شروع فوری Sepsis Bundle + اطلاع پزشک', next: 's3_fail', isCorrect: false },
          { id: 'b', text: 'وازوپرسور + مایع + کشت + آنتی‌بیوتیک', next: 's3_ok', isCorrect: true }
        ]
      },
      s2c: {
        question: 'پزشک می‌گوید: "بیمار پایدار است، فعلاً کاری نکنید". شما چه می‌کنید؟',
        choices: [
          { id: 'a', text: 'اطاعت بی‌قید و شرط', next: 's3_fail', isCorrect: false },
          { id: 'b', text: 'advocate: مطرح کردن qSOFA≥2 + لاکتات بالا و پیشنهاد Screen', next: 's3b_advocate', isCorrect: true }
        ]
      },
      s3a: {
        question: 'بیمار با همان وضعیت، آنتی‌بیوتیک قبل از کشت داده شد. کدام درست است؟',
        choices: [
          { id: 'a', text: 'اشکالی ندارد، کشت را الان بگیر', next: 'end_partial', isCorrect: false },
          { id: 'b', text: 'وقفه‌ای طولانی ممکن است؛ اما کشت الان و شروع درمان هم‌زمان OK است', next: 'end_ok', isCorrect: true }
        ]
      },
      s3b: {
        question: 'شما bundle را درست شروع کردید. ۳۰ دقیقه بعد، پزشک می‌گوید "نیازی به ICU نیست". بیمار همچنان SBP 88. اقدام؟',
        choices: [
          { id: 'a', text: 'پذیرش تصمیم پزشک و انتقال به بخش', next: 'end_partial', isCorrect: false },
          { id: 'b', text: 'advocate: qSOFA 3 + لاکتات 4.2 + عدم پاسخ به مایع → نیاز ICU', next: 'end_excellent', isCorrect: true }
        ]
      },
      s3c: {
        question: 'کشت پس از آنتی‌بیوتیک گرفته شد — این خطا چه تأثیری دارد؟',
        choices: [
          { id: 'a', text: 'بدون تأثیر', next: 'end_partial', isCorrect: false },
          { id: 'b', text: 'کاهش حساسیت کشت تا ۵۰٪ — تلاش مجدد برای کشت لازم', next: 'end_ok', isCorrect: true }
        ]
      },
      s3b_advocate: {
        question: 'شما موفق شدید پزشک را قانع کنید. حالا:',
        choices: [
          { id: 'a', text: 'شروع bundle + درخواست ICU consult', next: 'end_excellent', isCorrect: true },
          { id: 'b', text: 'فقط آنتی‌بیوتیک و مایع', next: 'end_ok', isCorrect: false }
        ]
      },
      s3_ok: {
        question: 'بیمار به ICU منتقل شد. ۶ ساعت بعد: لاکتات ۲.۸، MAP ۶۸. آیا ۶h bundle کامل است؟',
        choices: [
          { id: 'a', text: 'بله، همه bundle 3h + vasopressor + repeat lactate ثبت شد', next: 'end_excellent', isCorrect: true },
          { id: 'b', text: 'فقط ۳h کافی است', next: 'end_partial', isCorrect: false }
        ]
      },
      s3_fail: {
        question: 'این تصمیم منجر به شوک سپتیک و مرگ شد. بازبینی: کدام نشانه در t=0 وجود داشت و نادیده گرفته شد؟',
        choices: [
          { id: 'a', text: 'qSOFA ۲ از قبل', next: 'end_fail', isCorrect: false }
        ]
      },
      end_excellent: {
        outcome: 'excellent',
        title: '🏆 تصمیم عالی — Patient Safety Champion',
        explanation: 'شما Sepsis را سریع شناسایی کردید، bundle را در <۳ ساعت شروع کردید، و advocate کردید وقتی تصمیم پزشک با شواهد هم‌خوان نبود. Patient advocacy نقش اصلی پرستار است.',
        reference: 'SSC 2021 · IHI Framework for Safe, Reliable Care'
      },
      end_ok: {
        outcome: 'ok',
        title: '✅ تصمیم قابل قبول',
        explanation: 'شما bundle را شروع کردید اما minor delays داشتید. هدف: کاهش زمان door-to-antibiotics به <۱ ساعت.',
        reference: 'SSC 2021'
      },
      end_partial: {
        outcome: 'partial',
        title: '⚠️ تصمیم ناقص',
        explanation: 'شما sepsis را دیدید اما در advocate یا ترتیب اقدام ضعف داشتید. نکته کلیدی: کشت قبل از آنتی‌بیوتیک + قانع‌کردن پزشک با شواهد.',
        reference: 'SSC 2021'
      },
      end_fail: {
        outcome: 'fail',
        title: '❌ تصمیم خطرناک',
        explanation: 'نادیده‌گرفتن qSOFA≥2 در بیمار با تب بالا منجر به تأخیر در آنتی‌بیوتیک شد. هر دقیقه تأخیر = ۷٪ افزایش مرگ.',
        reference: 'Kumar et al., Crit Care Med 2006'
      }
    }
  },

  'high_alert_insulin': {
    id: 'high_alert_insulin',
    fa: 'Insulin Sliding Scale — جلوگیری از هیپوگلیسمی',
    difficulty: 'medium',
    category: 'medication',
    estimatedMin: 4,
    clinicalCase: 'بیمار ۶۵ ساله دیابتی، MAR: انسولین regular SC q6h sliding scale. BS الان: 68 mg/dL. شما شیفت شب هستید.',
    startStep: 's1',
    steps: {
      s1: {
        question: 'BS = 68 mg/dL — طبق Yale modified scale:',
        choices: [
          { id: 'a', text: 'صفر واحد + D50 25g IV + اطلاع پزشک', next: 'end_excellent', isCorrect: true },
          { id: 'b', text: '۲ واحد طبق schedule', next: 'end_fail', isCorrect: false },
          { id: 'c', text: 'صفر واحد و چک مجدد در ۶ ساعت', next: 'end_partial', isCorrect: false }
        ]
      },
      end_excellent: {
        outcome: 'excellent',
        title: '✅ تصمیم صحیح',
        explanation: 'BS<70 = هیپوگلیسمی. طبق پروتکل: صفر انسولین + D50 (۲۵g IV) یا Glucagon 1mg IM (اگر IV نبود) + اطلاع پزشک + چک BS در ۱۵ دقیقه.',
        reference: 'ADA Standards 2024 · Yale Protocol'
      },
      end_partial: {
        outcome: 'partial',
        title: '⚠️ ناقص',
        explanation: 'شما دوز صحیح دادید (صفر) اما مداخله هیپوگلیسمی نکردید. BS<70 نیازمند treatment فوری است، نه فقط skip.',
        reference: 'ADA Standards 2024'
      },
      end_fail: {
        outcome: 'fail',
        title: '❌ خطای بحرانی',
        explanation: 'دادن انسولین به BS=68 یک Never Event است. منجر به seizure/coma/مرگ می‌شود. بیمار باید در ۱۵ دقیقه remedy شود.',
        reference: 'Joint Commission Sentinel Event · ADA'
      }
    }
  },

  'handoff_omission': {
    id: 'handoff_omission',
    fa: 'تحویل شیفت با اطلاعات ناقص',
    difficulty: 'medium',
    category: 'documentation',
    estimatedMin: 4,
    clinicalCase: 'شما شیفت صبح را تحویل می‌گیرید. پرستار قبلی می‌گوید: "بیمار اتاق ۱۲ خوبه، فقط درد داره". نگاه می‌کنید: MAR او نشان می‌دهد ۲ دوز missed، lab بحرانی ۳ ساعت پیش بدون acknowledgment، و بیمار در ایزولاسیون تماسی (MRSA) است.',
    startStep: 's1',
    steps: {
      s1: {
        question: 'اولین اقدام؟',
        choices: [
          { id: 'a', text: 'قبول تحویل و ادامه کار', next: 'end_fail', isCorrect: false },
          { id: 'b', text: 'مطالبه ISBAR کامل از پرستار + بررسی پرونده الکترونیک', next: 's2', isCorrect: true },
          { id: 'c', text: 'شکایت به سوپروایزر', next: 'end_partial', isCorrect: false }
        ]
      },
      s2: {
        question: 'پرستار قبلی می‌گوید "من وقت نداشتم". شما چه می‌کنید؟',
        choices: [
          { id: 'a', text: 'تماس با پزشک برای lab بحرانی، اعمال ایزولاسیون، ثبت دوزهای missed', next: 'end_excellent', isCorrect: true },
          { id: 'b', text: 'فقط ایزولاسیون را چک می‌کنم', next: 'end_partial', isCorrect: false }
        ]
      },
      end_excellent: {
        outcome: 'excellent',
        title: '🏆 شما Patient Safety را حفظ کردید',
        explanation: 'ISBAR کامل + بررسی independent + اقدام فوری روی ۳ داده حیاتی. JCI IPSG.2 می‌گوید read-back الزامی است و must be documented.',
        reference: 'JCI IPSG.2 · IHI SBAR'
      },
      end_partial: {
        outcome: 'partial',
        title: '⚠️ بخشی از اطلاعات نادیده',
        explanation: 'ایزولاسیون حیاتی است اما lab بحرانی نیز ممکن است منجر به مرگ شود. همه ۳ آیتم باید اقدام شوند.',
        reference: 'JCI IPSG.2'
      },
      end_fail: {
        outcome: 'fail',
        title: '❌ پذیرش تحویل ناقص = مسئولیت شما',
        explanation: 'شما به‌عنوان گیرنده شیفت، مسئول قانونی و اخلاقی هستید که ISBAR را دریافت کنید. بدترین سناریو: بیمار با lab بحرانی (مثلاً K=6.8) در چند ساعت می‌میرد.',
        reference: 'JCI IPSG.2 · NABZ Handoff Bridge'
      }
    }
  }
};

// ═══════════════════════════════════════════════════════════
//  Scenario handlers
// ═══════════════════════════════════════════════════════════
function listScenarios() {
  return {
    items: Object.values(SCENARIOS).map(s => ({
      id: s.id, fa: s.fa, difficulty: s.difficulty,
      category: s.category, estimatedMin: s.estimatedMin,
      stepCount: Object.keys(s.steps).length
    })),
    total: Object.keys(SCENARIOS).length
  };
}

function startScenario(ctx) {
  const sc = SCENARIOS[ctx.params.id];
  if (!sc) throw ctx.E.notFound('scenario_not_found');
  const attempt = {
    id: ctx.uid('scn'),
    userId: ctx.actor.id,
    scenarioId: sc.id,
    scenarioFa: sc.fa,
    startedAt: new Date().toISOString(),
    currentStep: sc.startStep,
    path: [],
    status: 'active',
    score: 0
  };
  store.put('scenario_attempts', attempt);
  return {
    attempt,
    step: getStepPublic(sc, sc.startStep),
    clinicalCase: sc.clinicalCase
  };
}

function getStepPublic(sc, stepId) {
  const s = sc.steps[stepId];
  if (!s) return null;
  if (s.outcome) return { stepId, outcome: s.outcome, title: s.title, explanation: s.explanation, reference: s.reference, terminal: true };
  return {
    stepId,
    question: s.question,
    choices: s.choices.map(c => ({ id: c.id, text: c.text })),
    terminal: false
  };
}

function decideScenario(ctx) {
  const b = ctx.body || {};
  const attempt = store.get('scenario_attempts', ctx.params.attemptId);
  if (!attempt) throw ctx.E.notFound('attempt_not_found');
  if (attempt.userId !== ctx.actor.id) throw ctx.E.forbidden('not_owner');
  if (attempt.status !== 'active') throw ctx.E.conflict('not_active');
  const sc = SCENARIOS[attempt.scenarioId];
  if (!sc) throw ctx.E.notFound('scenario_not_found');
  const step = sc.steps[attempt.currentStep];
  if (!step) throw ctx.E.conflict('invalid_step');
  const choice = step.choices.find(c => c.id === b.choiceId);
  if (!choice) throw ctx.E.badRequest('choice_not_found');

  attempt.path.push({
    stepId: attempt.currentStep,
    choiceId: b.choiceId,
    choiceText: choice.text,
    isCorrect: !!choice.isCorrect,
    at: new Date().toISOString()
  });
  if (choice.isCorrect) attempt.score += 10;

  const next = sc.steps[choice.next];
  if (!next) throw ctx.E.conflict('invalid_transition');

  if (next.outcome) {
    attempt.status = 'completed';
    attempt.completedAt = new Date().toISOString();
    attempt.outcome = next.outcome;
    attempt.finalScore = attempt.score;
    attempt.maxScore = attempt.path.length * 10;
    // Outcome-based quality score for competency linking
    const finalQuality = next.outcome === 'excellent' ? 5 : next.outcome === 'ok' ? 4 : next.outcome === 'partial' ? 3 : 1;
    attempt.finalQuality = finalQuality;
    store.put('scenario_attempts', attempt);
    // Award competency drill
    try { linkScenarioToCompetency(ctx, sc, attempt); } catch (_) {}
    return {
      attempt,
      step: { outcome: next.outcome, title: next.title, explanation: next.explanation, reference: next.reference, terminal: true },
      completed: true
    };
  }

  attempt.currentStep = choice.next;
  store.put('scenario_attempts', attempt);
  return {
    attempt,
    step: getStepPublic(sc, choice.next),
    completed: false
  };
}

function linkScenarioToCompetency(ctx, sc, attempt) {
  const compMap = {
    sepsis_recognition: 'SEPSIS_SCREEN',
    high_alert_insulin: 'INSULIN',
    handoff_omission: 'ISBAR'
  };
  const code = compMap[sc.id];
  if (!code) return;
  const key = 'scenario_progress_' + ctx.actor.id + '_' + code;
  let prog = store.get('scenario_progress', key);
  if (!prog) {
    prog = { id: key, userId: ctx.actor.id, competencyCode: code, total: 0, excellent: 0, sumQuality: 0 };
  }
  prog.total++;
  prog.sumQuality += attempt.finalQuality || 0;
  if (attempt.outcome === 'excellent') prog.excellent++;
  prog.avgQuality = prog.total > 0 ? Math.round((prog.sumQuality / prog.total) * 10) / 10 : 0;
  prog.lastAt = new Date().toISOString();
  store.put('scenario_progress', prog);
}

function scenarioHistory(ctx) {
  const items = h(ctx, 'scenario_attempts').filter(a => a.userId === ctx.actor.id && a.status === 'completed')
    .sort((a, b) => sd(b.completedAt) - sd(a.completedAt));
  return { items: items.slice(0, 20), total: items.length };
}

module.exports = {
  handlers: {
    due, review, progress,
    listScenarios, startScenario, decideScenario, scenarioHistory
  },
  routes: [

    { method:'GET',  path:'/api/learn/due', handler:'due', perm:'learning.drill' },
    { method:'POST', path:'/api/learn/review', handler:'review', perm:'learning.drill' },
    { method:'GET',  path:'/api/learn/progress', handler:'progress', perm:'learning.drill' },
    { method:'GET',  path:'/api/learn/scenarios', handler:'listScenarios', perm:'learning.drill' },
    { method:'GET',  path:'/api/learn/scenarios/history', handler:'scenarioHistory', perm:'learning.drill' },
    { method:'POST', path:'/api/learn/scenarios/:id/start', handler:'startScenario', perm:'learning.drill' },
    { method:'POST', path:'/api/learn/scenarios/attempt/:attemptId/decide', handler:'decideScenario', perm:'learning.drill' },
  
  ],
  panels: [
    { id:'daily', title:'یادگیری روزانه', icon:'🧠', perm:'learning.drill', kind:'learn_daily', api:'/api/learn/due' },
    { id:'scenarios', title:'سناریوهای بالینی', icon:'🎮', perm:'learning.drill', kind:'learn_scenarios', api:'/api/learn/scenarios' }
  ]
};
