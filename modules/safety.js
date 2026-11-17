
const sig=require('../core/signature'),perms=require('../core/permissions');
function h(ctx,c){try{const r=ctx.store.readAll(c);return Array.isArray(r)?r:[]}catch(_){return[]}}
function sd(x){if(!x)return 0;const d=new Date(x);return isNaN(d.getTime())?0:d.getTime()}
function sg(ctx,c,r,a){const s=sig.signAction({userId:ctx.actor.id,action:a,collection:c,recordId:r.id,data:r});ctx.store.put('signatures',s);r.lastSignatureId=s.id;return s}
const list=(c)=>(ctx)=>{let i=perms.scope(ctx.actor,h(ctx,c));
if(ctx.query.status)i=i.filter(x=>x.status===ctx.query.status);
i.sort((a,b)=>sd(b.createdAt||b.reportedAt)-sd(a.createdAt||a.reportedAt));
return{items:i,total:i.length}};

// ═══════════════════════════════════════════════════════════
//  SEPSIS — SSC 2021 Hour-1 Bundle + 6h Bundle
// ═══════════════════════════════════════════════════════════
function calcQSOFA(v) {
  let s = 0; const f = [];
  const rr = Number(v.rr);
  if (rr >= 22) { s++; f.push('RR ≥ 22'); }
  const sbp = Number(v.bp_sys);
  if (sbp > 0 && sbp <= 100) { s++; f.push('SBP ≤ 100'); }
  const gcs = Number(v.gcs);
  if (gcs > 0 && gcs < 15) { s++; f.push('GCS < 15'); }
  return { score: s, findings: f };
}

function calcSIRS(v, wbc, temp) {
  let s = 0; const f = [];
  const t = Number(temp != null ? temp : v.temp);
  if ((t > 38) || (t < 36 && t > 0)) { s++; f.push('T غیرطبیعی'); }
  if (Number(v.hr) > 90) { s++; f.push('HR > 90'); }
  if (Number(v.rr) > 20) { s++; f.push('RR > 20'); }
  const w = Number(wbc);
  if (w && (w > 12000 || w < 4000)) { s++; f.push('WBC غیرطبیعی'); }
  return { score: s, findings: f };
}

function calcNEWS2(v) {
  return require('../core/domain/news2').calc(v).total;
}

// ═══ SEPSIS SCREEN — creates 3h and 6h bundle timers ═══
const sepsisScreen = (ctx) => {
  const b = ctx.body;
  if (!b.patientId) throw ctx.E.badRequest('patient_required');
  const p = ctx.store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const v = b.vitals || {};
  const qsofa = calcQSOFA(v);
  const sirs = calcSIRS(v, b.wbc, b.temp);
  const news2 = calcNEWS2(v);
  const lactate = b.lactate != null ? Number(b.lactate) : null;

  // Sepsis likelihood composite (qSOFA + SIRS + NEWS2 + lactate)
  let likelihoodScore = 0;
  if (qsofa.score >= 2) likelihoodScore += 40;
  else if (qsofa.score === 1) likelihoodScore += 15;
  if (sirs.score >= 2) likelihoodScore += 20;
  if (news2 >= 7) likelihoodScore += 20;
  else if (news2 >= 5) likelihoodScore += 10;
  if (lactate != null && lactate >= 4) likelihoodScore += 30;
  else if (lactate != null && lactate >= 2) likelihoodScore += 15;
  likelihoodScore = Math.min(100, likelihoodScore);

  const suspected = qsofa.score >= 2 || (sirs.score >= 2 && (news2 >= 5 || (lactate != null && lactate >= 2)));

  const now = Date.now();
  const deadline3h = new Date(now + 3 * 3600000).toISOString();
  const deadline6h = new Date(now + 6 * 3600000).toISOString();

  const rec = {
    id: ctx.uid('sep'),
    patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode,
    qsofa: { score: qsofa.score, findings: qsofa.findings },
    sirs: { score: sirs.score, findings: sirs.findings },
    news2,
    lactate,
    infectionSource: b.infectionSource || null,
    likelihoodScore,
    status: suspected ? 'suspected' : 'screening',
    screenedAt: ctx.now(),
    screenedBy: ctx.actor.id,
    screenedByName: ctx.actor.fullName || ctx.actor.username,

    // ═══ Surviving Sepsis Campaign — 1h/3h bundle ═══
    bundle3h: {
      startedAt: ctx.now(),
      deadline: deadline3h,
      completed: false,
      completedAt: null,
      items: {
        lactate: { done: lactate != null, doneAt: lactate != null ? ctx.now() : null, value: lactate },
        bloodCultures: { done: false, doneAt: null },
        broadAntibiotics: { done: false, doneAt: null, drug: null },
        crystalloid30ml: { done: false, doneAt: null, volumeMl: null }
      },
      // Auto-compute completion when all 4 done
      incompleteAlertSent: false
    },

    // ═══ 6h bundle ═══
    bundle6h: {
      startedAt: ctx.now(),
      deadline: deadline6h,
      completed: false,
      completedAt: null,
      items: {
        vasopressors: { done: false, doneAt: null, drug: null, targetMAP: 65 },
        repeatLactate: { done: false, doneAt: null, value: null },
        remeasure: { done: false, doneAt: null }
      },
      incompleteAlertSent: false
    }
  };
  ctx.store.put('sepsis', rec);
  sg(ctx, 'sepsis', rec, 'screen');
  if (suspected) {
    ctx.bus.emit('sepsis.suspected', { record: rec, actor: ctx.actor });
    ctx.bus.emit('cdss.alert', {
      type: 'sepsis_suspected',
      severity: likelihoodScore >= 60 ? 'critical' : 'warning',
      patientId: p.id, patientName: rec.patientName,
      score: likelihoodScore,
      title: '🦠 سپسیس مشکوک — ' + rec.patientName,
      message: 'qSOFA=' + qsofa.score + ' SIRS=' + sirs.score + ' NEWS2=' + news2 + (lactate != null ? ' Lactate=' + lactate : ''),
      recommendation: 'شروع Bundle ۳ ساعته: کشت + لاکتات + آنتی‌بیوتیک + مایع'
    });
  }
  return rec;
};

const sepsisDiagnose = (ctx) => {
  const s = ctx.store.get('sepsis', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const st = ctx.body.status || 'confirmed';
  if (!['confirmed','ruled_out','septic_shock'].includes(st)) throw ctx.E.badRequest('invalid_status');
  s.status = st;
  s.diagnosedBy = ctx.actor.id;
  s.diagnosedByName = ctx.actor.fullName || ctx.actor.username;
  s.diagnosedAt = ctx.now();
  s.diagnosisNote = ctx.body.note || '';
  ctx.store.put('sepsis', s);
  sg(ctx, 'sepsis', s, 'diagnose');
  ctx.bus.emit('sepsis.' + st, { record: s, actor: ctx.actor });
  return s;
};

// ═══ 3h bundle tick ═══
const sepsisBundle3h = (ctx) => {
  const s = ctx.store.get('sepsis', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const b = ctx.body || {};

  if (b.lactate != null) {
    s.bundle3h.items.lactate.done = true;
    s.bundle3h.items.lactate.doneAt = ctx.now();
    s.bundle3h.items.lactate.value = Number(b.lactate);
    s.lactate = Number(b.lactate);
  }
  if (b.bloodCultures) {
    s.bundle3h.items.bloodCultures.done = true;
    s.bundle3h.items.bloodCultures.doneAt = ctx.now();
    s.bundle3h.items.bloodCultures.sites = b.bloodCultures === 'both' ? ['peripheral','central'] : [b.bloodCultures];
  }
  if (b.broadAntibiotics) {
    s.bundle3h.items.broadAntibiotics.done = true;
    s.bundle3h.items.broadAntibiotics.doneAt = ctx.now();
    s.bundle3h.items.broadAntibiotics.drug = b.antibioticDrug || 'unspecified';
  }
  if (b.crystalloid30ml) {
    s.bundle3h.items.crystalloid30ml.done = true;
    s.bundle3h.items.crystalloid30ml.doneAt = ctx.now();
    s.bundle3h.items.crystalloid30ml.volumeMl = Number(b.crystalloidVolumeMl) || 30;
  }

  const all = Object.values(s.bundle3h.items).every(i => i.done);
  if (all && !s.bundle3h.completed) {
    s.bundle3h.completed = true;
    s.bundle3h.completedAt = ctx.now();
    const elapsed = (sd(s.bundle3h.completedAt) - sd(s.bundle3h.startedAt)) / 60000;
    s.bundle3h.elapsedMin = Math.round(elapsed);
    s.bundle3h.onTime = elapsed <= 180;
    ctx.bus.emit('sepsis.bundle3h.complete', { record: s, onTime: s.bundle3h.onTime, actor: ctx.actor });
  }
  ctx.store.put('sepsis', s);
  sg(ctx, 'sepsis', s, 'bundle3h');
  return s;
};

// ═══ 6h bundle tick ═══
const sepsisBundle6h = (ctx) => {
  const s = ctx.store.get('sepsis', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  if (!s.bundle3h.completed) throw ctx.E.conflict('3h_bundle_incomplete');
  const b = ctx.body || {};

  if (b.vasopressors) {
    s.bundle6h.items.vasopressors.done = true;
    s.bundle6h.items.vasopressors.doneAt = ctx.now();
    s.bundle6h.items.vasopressors.drug = b.vasopressorDrug || 'norepinephrine';
    s.bundle6h.items.vasopressors.targetMAP = Number(b.targetMAP) || 65;
  }
  if (b.repeatLactate != null) {
    s.bundle6h.items.repeatLactate.done = true;
    s.bundle6h.items.repeatLactate.doneAt = ctx.now();
    s.bundle6h.items.repeatLactate.value = Number(b.repeatLactate);
    s.repeatLactate = Number(b.repeatLactate);
  }
  if (b.remeasure) {
    s.bundle6h.items.remeasure.done = true;
    s.bundle6h.items.remeasure.doneAt = ctx.now();
  }

  const all = Object.values(s.bundle6h.items).every(i => i.done);
  if (all && !s.bundle6h.completed) {
    s.bundle6h.completed = true;
    s.bundle6h.completedAt = ctx.now();
    const elapsed = (sd(s.bundle6h.completedAt) - sd(s.bundle6h.startedAt)) / 60000;
    s.bundle6h.elapsedMin = Math.round(elapsed);
    s.bundle6h.onTime = elapsed <= 360;
    ctx.bus.emit('sepsis.bundle6h.complete', { record: s, onTime: s.bundle6h.onTime, actor: ctx.actor });
  }
  ctx.store.put('sepsis', s);
  sg(ctx, 'sepsis', s, 'bundle6h');
  return s;
};

// ═══ Legacy: keep sepsisBundle as alias for 3h ═══
const sepsisBundle = sepsisBundle3h;

// ═══════════════════════════════════════════════════════════
//  INFECTION + ISOLATION
// ═══════════════════════════════════════════════════════════
const infectionReport = (ctx) => {
  const b = ctx.body;
  if (!b.patientId || !b.type) throw ctx.E.badRequest('missing');
  const p = ctx.store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('not_found');
  const rec = {
    id: ctx.uid('inf'),
    patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode, type: b.type,
    pathogen: b.pathogen || null,
    cultureConfirmed: b.cultureConfirmed === true,
    status: 'confirmed',
    reportedBy: ctx.actor.id, reportedByName: ctx.actor.fullName || ctx.actor.username,
    reportedAt: ctx.now(),
    // CDC/NHSN classification
    haiClassification: classifyHAI(b.type, p),
    // Auto-isolation recommendation
    isolationRecommended: recommendIsolation(b.type, b.pathogen)
  };
  ctx.store.put('infections', rec);
  sg(ctx, 'infections', rec, 'report');
  ctx.bus.emit('infection.reported', { record: rec, actor: ctx.actor });
  if (rec.isolationRecommended) {
    ctx.bus.emit('cdss.alert', {
      type: 'isolation_needed',
      severity: 'warning',
      patientId: p.id, patientName: rec.patientName,
      title: '🧼 ایزولاسیون توصیه‌شده — ' + rec.patientName,
      message: 'نوع: ' + rec.isolationRecommended.type + ' — ' + rec.isolationRecommended.reason,
      recommendation: 'ایزولاسیون ' + rec.isolationRecommended.type + ' اعمال شود'
    });
  }
  return rec;
};

function classifyHAI(type, patient) {
  const t = String(type || '').toLowerCase();
  if (t.includes('clabsi')) return 'CLABSI (مرکزی)';
  if (t.includes('vap') || t.includes('ventilator')) return 'VAP';
  if (t.includes('cauti') || t.includes('urinary')) return 'CAUTI';
  if (t.includes('ssi') || t.includes('surgical')) return 'SSI';
  if (t.includes('bacteremia')) return 'BSI';
  if (t.includes('pneumonia')) return 'HAP';
  return 'Other HAI';
}

function recommendIsolation(type, pathogen) {
  const t = String(type || '').toLowerCase();
  const p = String(pathogen || '').toLowerCase();
  if (p.includes('mrsa') || p.includes('vre') || p.includes('cre') || p.includes('c.diff') || p.includes('c diff')) {
    return { type: 'contact', reason: 'MDRO — contact precautions' };
  }
  if (p.includes('tb') || p.includes('tubercul') || t.includes('tb')) {
    return { type: 'airborne', reason: 'TB — airborne + negative pressure' };
  }
  if (p.includes('influenza') || p.includes('covid') || p.includes('pertussis')) {
    return { type: 'droplet', reason: 'Respiratory — droplet' };
  }
  if (p.includes('candida') || p.includes('pseudomonas') || p.includes('acinetobacter')) {
    return { type: 'contact', reason: 'MDRO risk — contact' };
  }
  return null;
}

const isolationCreate = (ctx) => {
  const b = ctx.body;
  if (!b.patientId || !b.type) throw ctx.E.badRequest('missing');
  const p = ctx.store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('not_found');
  const rec = {
    id: ctx.uid('iso'),
    patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
    wardCode: p.wardCode, bedNumber: p.bedNumber,
    type: b.type, reason: b.reason || '',
    requiresNegativePressure: b.type === 'airborne',
    negativePressureVerified: b.negativePressureVerified === true,
    status: 'active',
    startedBy: ctx.actor.id, startedByName: ctx.actor.fullName || ctx.actor.username,
    startedAt: ctx.now(),
    ppeRequired: PPE_REQUIRED[b.type] || []
  };
  ctx.store.put('isolations', rec);
  ctx.bus.emit('isolation.started', { record: rec, actor: ctx.actor });
  return rec;
};

const PPE_REQUIRED = {
  contact: ['gloves', 'gown'],
  droplet: ['mask', 'goggles', 'gloves', 'gown'],
  airborne: ['N95', 'goggles', 'gloves', 'gown', 'negative_pressure_room'],
  protective: ['mask', 'cap', 'sterile_gown', 'sterile_gloves']
};

// ═══════════════════════════════════════════════════════════
//  QUALITY INCIDENT + RISK
// ═══════════════════════════════════════════════════════════
const incidentReport = (ctx) => {
  const b = ctx.body;
  if (!b.category || !b.description || !b.severity) throw ctx.E.badRequest('missing');
  const weights = { near_miss:1, no_harm:2, mild_harm:3, moderate_harm:4, severe_harm:5, sentinel:6 };
  const rec = {
    id: ctx.uid('inc'),
    category: b.category, severity: b.severity,
    severityWeight: weights[b.severity] || 1,
    requiresRca: (weights[b.severity] || 1) >= 4,
    description: b.description,
    patientId: b.patientId || null, patientName: b.patientName || null,
    wardCode: b.wardCode || ctx.actor.ward || null,
    occurredAt: b.occurredAt || ctx.now(), reportedAt: ctx.now(),
    reportedBy: ctx.actor.id, reportedByName: ctx.actor.fullName || ctx.actor.username,
    immediateAction: b.immediateAction || '',
    status: 'reported',
    rcaDeadline: (weights[b.severity] || 1) >= 4
      ? new Date(Date.now() + 30 * 86400000).toISOString()
      : null
  };
  ctx.store.put('incidents', rec);
  sg(ctx, 'incidents', rec, 'report');
  if (rec.requiresRca) {
    ctx.bus.emit('quality.rca_required', { record: rec, actor: ctx.actor });
    ctx.bus.emit('cdss.alert', {
      type: 'rca_required',
      severity: rec.severity === 'sentinel' ? 'critical' : 'warning',
      title: '🔍 RCA الزامی — ' + rec.category,
      message: rec.severity + ' — ' + rec.description.slice(0, 80),
      recommendation: 'RCA ظرف ۳۰ روز تشکیل شود (deadline: ' + rec.rcaDeadline + ')'
    });
  }
  return rec;
};

const incidentClose = (ctx) => {
  const i = ctx.store.get('incidents', ctx.params.id);
  if (!i) throw ctx.E.notFound('not_found');
  if (!ctx.body.notes) throw ctx.E.badRequest('notes_required');
  i.status = 'closed'; i.closedAt = ctx.now();
  i.closedBy = ctx.actor.id;
  i.closureNotes = ctx.body.notes;
  i.rootCause = ctx.body.rootCause || null;
  i.correctiveAction = ctx.body.correctiveAction || null;
  ctx.store.put('incidents', i);
  return i;
};

const riskRegister = (ctx) => {
  const b = ctx.body;
  if (!b.title || !b.likelihood || !b.severity) throw ctx.E.badRequest('missing');
  const l = Number(b.likelihood), s = Number(b.severity);
  const score = l * s;
  const level = score >= 15 ? 'extreme' : score >= 9 ? 'high' : score >= 4 ? 'medium' : 'low';
  const rec = {
    id: ctx.uid('rsk'),
    title: b.title, description: b.description || '',
    category: b.category || 'clinical',
    wardCode: b.wardCode || ctx.actor.ward || null,
    likelihood: l, severity: s, riskScore: score, level,
    status: 'open',
    identifiedBy: ctx.actor.id,
    identifiedByName: ctx.actor.fullName || ctx.actor.username,
    identifiedAt: ctx.now(),
    mitigations: [],
    reviewDeadline: level === 'extreme' || level === 'high'
      ? new Date(Date.now() + 7 * 86400000).toISOString()
      : null
  };
  ctx.store.put('risks', rec);
  sg(ctx, 'risks', rec, 'register');
  if (level === 'extreme' || level === 'high') {
    ctx.bus.emit('cdss.alert', {
      type: 'high_risk_registered',
      severity: level === 'extreme' ? 'critical' : 'warning',
      title: '⚠️ ریسک ' + level + ' — ' + rec.title,
      message: 'Score ' + score + ' (L' + l + ' × S' + s + ')',
      recommendation: 'اقدام اصلاحی ظرف ۷ روز'
    });
  }
  return rec;
};

const riskMitigate = (ctx) => {
  const r = ctx.store.get('risks', ctx.params.id);
  if (!r) throw ctx.E.notFound('not_found');
  const b = ctx.body;
  if (!b.action) throw ctx.E.badRequest('action_required');
  r.mitigations.push({
    action: b.action, owner: ctx.actor.id,
    type: b.type || 'corrective',
    status: 'open',
    dueAt: b.dueAt || new Date(Date.now() + 7 * 86400000).toISOString(),
    at: ctx.now()
  });
  // Auto re-evaluate after 3 mitigations
  if (r.mitigations.filter(m => m.status === 'completed').length >= 3) {
    r.level = 'reduced';
  }
  ctx.store.put('risks', r);
  return r;
};

module.exports = {
  handlers: {
    sepsis: list('sepsis'),
    sepsisScreen, sepsisDiagnose, sepsisBundle, sepsisBundle3h, sepsisBundle6h,
    infections: list('infections'), infectionReport,
    isolations: list('isolations'), isolationCreate,
    incidents: list('incidents'), incidentReport, incidentClose,
    risks: list('risks'), riskRegister, riskMitigate
  },
  routes: [

    {method:'GET', path:'/api/safety/sepsis', handler:'sepsis', perm:'sepsis.view'},
    {method:'POST', path:'/api/safety/sepsis', handler:'sepsisScreen', perm:'sepsis.screen'},
    {method:'GET', path:'/api/safety/infections', handler:'infections', perm:'infection.view'},
    {method:'POST', path:'/api/safety/infections', handler:'infectionReport', perm:'infection.report'},
    {method:'GET', path:'/api/safety/isolations', handler:'isolations', perm:'infection.view'},
    {method:'POST', path:'/api/safety/isolations', handler:'isolationCreate', perm:'infection.isolation'},
    {method:'GET', path:'/api/safety/incidents', handler:'incidents', perm:'quality.view'},
    {method:'POST', path:'/api/safety/incidents', handler:'incidentReport', perm:'quality.incident.report'},
    {method:'GET', path:'/api/safety/risks', handler:'risks', perm:'risk.view'},
    {method:'POST', path:'/api/safety/risks', handler:'riskRegister', perm:'risk.register'},
    {method:'POST', path:'/api/safety/sepsis/:id/diagnose', handler:'sepsisDiagnose', perm:'sepsis.diagnose'},
    {method:'POST', path:'/api/safety/sepsis/:id/bundle', handler:'sepsisBundle', perm:'sepsis.screen'},
    {method:'POST', path:'/api/safety/sepsis/:id/bundle3h', handler:'sepsisBundle3h', perm:'sepsis.screen'},
    {method:'POST', path:'/api/safety/sepsis/:id/bundle6h', handler:'sepsisBundle6h', perm:'sepsis.screen'},
    {method:'POST', path:'/api/safety/incidents/:id/close', handler:'incidentClose', perm:'quality.view'},
    {method:'POST', path:'/api/safety/risks/:id/mitigate', handler:'riskMitigate', perm:'risk.register'},
  
  ],
  panels: [
    {id:'sepsis',title:'سپسیس',icon:'🦠',perm:'sepsis.view',kind:'list',api:'/api/safety/sepsis',fields:['patientName','status','likelihoodScore']},
    {id:'infections',title:'عفونت',icon:'🧫',perm:'infection.view',kind:'list',api:'/api/safety/infections',fields:['patientName','type','pathogen','status']},
    {id:'incidents',title:'حوادث',icon:'⭐',perm:'quality.view',kind:'list',api:'/api/safety/incidents',fields:['category','severity','description','status']},
    {id:'risks',title:'ریسک',icon:'⚠️',perm:'risk.view',kind:'list',api:'/api/safety/risks',fields:['title','category','level','status']}
  ]
};
