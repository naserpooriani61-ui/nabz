'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Handoff AI (S5)
//  Physician-to-physician shift handoff with clinical narrative
//  Standards: JCI IPSG.2 · I-PASS (Starmer NEJM 2014) · SBAR (IHI)
//  Differentiator vs nursing_handoff_bridge: physician context
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const store = require('../core/store');
const bus = require('../core/events');
const perms = require('../core/permissions');
const resolver = require('../core/ward-resolver');

if (!perms.P['handoff_ai.view']) {
  perms.P['handoff_ai.view'] = 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,attending,specialist,surgeon,resident,intern,physician,nurse,head_nurse,quality_officer';
  perms.P['handoff_ai.create'] = 'admin,attending,specialist,surgeon,resident,intern,physician,nurse,head_nurse';
  perms.P['handoff_ai.receive'] = 'admin,attending,specialist,surgeon,resident,intern,physician,nurse,head_nurse';
}

const TREND_WINDOW_HOURS = 24;
const NEWS_DELTA_ALERT = 2;

function actorScope(actor) {
  try {
    const s = resolver.resolveUserScope ? resolver.resolveUserScope(actor, perms.isCrossWard(actor.role)) : null;
    if (s) return s;
  } catch (_) {}
  return { kind: 'none', codes: [] };
}
function inScope(patient, scope) {
  if (scope.kind === 'all') return true;
  if (scope.kind === 'wards') return scope.codes.includes(patient.wardCode);
  if (scope.kind === 'services') {
    const svc = patient.serviceCode || (resolver.serviceForWard ? resolver.serviceForWard(patient.wardCode) : null);
    return svc && scope.codes.includes(svc);
  }
  return false;
}

// ═══ Trend detection ═══
function computeVitalsTrends(patientId, vitals) {
  const cutoff = Date.now() - TREND_WINDOW_HOURS * 3600000;
  const recent = vitals
    .filter(v => v.patientId === patientId && sd(v.recordedAt) > cutoff)
    .sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
  if (recent.length < 2) return { hasTrend: false, notes: [], samples: recent.length };
  const latest = recent[0];
  const oldest = recent[recent.length - 1];
  const newsDelta = (Number(latest.news2) || 0) - (Number(oldest.news2) || 0);
  const hoursSpan = Math.max(1, Math.round((sd(latest.recordedAt) - sd(oldest.recordedAt)) / 3600000));
  const notes = [];
  const flags = [];
  if (newsDelta >= 3) { notes.push('NEWS2 افزایش قابل‌توجه: ' + (oldest.news2||0) + ' → ' + (latest.news2||0) + ' در ' + hoursSpan + ' ساعت'); flags.push('critical'); }
  else if (newsDelta >= NEWS_DELTA_ALERT) { notes.push('NEWS2 افزایش: ' + (oldest.news2||0) + ' → ' + (latest.news2||0) + ' در ' + hoursSpan + ' ساعت'); flags.push('high'); }
  else if (newsDelta <= -2) { notes.push('NEWS2 بهبود یافت: ' + (oldest.news2||0) + ' → ' + (latest.news2||0)); flags.push('improving'); }
  if (latest.spo2 && oldest.spo2 && Number(latest.spo2) < Number(oldest.spo2) - 3)
    { notes.push('هیپوکسمی پیشرونده: SpO₂ ' + oldest.spo2 + '% → ' + latest.spo2 + '%'); flags.push('critical'); }
  if (latest.spo2 && Number(latest.spo2) < 92) { notes.push('SpO₂ فعلی ' + latest.spo2 + '% (زیر ۹۲)'); flags.push('high'); }
  if (latest.temp && Number(latest.temp) >= 38.3) { notes.push('تب فعال: ' + latest.temp + '°C'); flags.push('high'); }
  if (latest.bp_sys && Number(latest.bp_sys) < 100) { notes.push('هیپوتنشن: SBP ' + latest.bp_sys); flags.push('critical'); }
  if (latest.hr && Number(latest.hr) > 110) { notes.push('تاکی‌کاردی: HR ' + latest.hr); flags.push('high'); }
  if (latest.rr && Number(latest.rr) >= 22) { notes.push('تاکی‌پنه: RR ' + latest.rr); flags.push('high'); }
  if (latest.gcs && Number(latest.gcs) < 15) { notes.push('کاهش هوشیاری: GCS ' + latest.gcs); flags.push('critical'); }
  return {
    hasTrend: notes.length > 0, newsDelta, hoursSpan,
    oldestNews: oldest.news2, latestNews: latest.news2,
    notes, flags, samples: recent.length,
    latest: { hr: latest.hr, bp_sys: latest.bp_sys, bp_dia: latest.bp_dia, rr: latest.rr, temp: latest.temp, spo2: latest.spo2, news2: latest.news2, gcs: latest.gcs, at: latest.recordedAt }
  };
}

function computeMarStatus(patientId, mar) {
  const since = Date.now() - 24 * 3600000;
  const recent = mar.filter(m => m.patientId === patientId && sd(m.scheduledAt) > since);
  const missed = recent.filter(m => m.status === 'missed');
  const due1h = recent.filter(m => ['scheduled','due'].includes(m.status) && sd(m.scheduledAt) < Date.now() + 3600000);
  const late = recent.filter(m => m.lateMinutes && m.lateMinutes > 30);
  const highMissed = missed.filter(m => m.isHighAlert);
  return { missed: missed.length, due1h: due1h.length, late: late.length, highMissed: highMissed.length, total: recent.length };
}

function computeLabStatus(patientId, labs) {
  const since = Date.now() - 48 * 3600000;
  const recent = labs.filter(l => l.patientId === patientId && ['resulted','verified'].includes(l.status) && sd(l.resultedAt || l.orderedAt) > since);
  const unacked = recent.filter(l => l.criticalFlags && l.criticalFlags.length && (!l.acknowledgment || !l.acknowledgment.acknowledged));
  return { recent: recent.length, unacked: unacked.length, unackedList: unacked.slice(0, 3).map(l => ({ panel: l.panelName, flags: l.criticalFlags, at: l.resultedAt })) };
}

function computeLastRound(patientId, encounters) {
  const last = encounters.filter(e => e.patientId === patientId && e.type === 'round').sort((a, b) => sd(b.createdAt) - sd(a.createdAt))[0];
  if (!last) return { has: false, hoursAgo: null };
  const hoursAgo = Math.round((Date.now() - sd(last.createdAt)) / 3600000);
  return {
    has: true, id: last.id, hoursAgo, status: last.status,
    author: last.authorName, impression: (last.assessment && last.assessment.clinicalImpression || '').slice(0, 120),
    chiefComplaint: (last.subjective && last.subjective.chiefComplaint || '').slice(0, 100)
  };
}

function computeSepsis(patientId, sepsisAll) {
  const active = sepsisAll.filter(s => s.patientId === patientId && ['suspected','confirmed','septic_shock'].includes(s.status));
  if (!active.length) return { active: false };
  const s = active[0];
  const bundle3hPending = !s.bundle3h || !s.bundle3h.completed;
  const likelihood = s.likelihoodScore || 0;
  return { active: true, status: s.status, qsofa: s.qsofa ? s.qsofa.score : 0, likelihood, bundle3hPending, screenedAt: s.screenedAt };
}

function computeIsolation(patientId, isolationsAll) {
  const active = isolationsAll.find(i => i.patientId === patientId && i.status === 'active');
  return active ? { active: true, type: active.type, reason: active.reason, ppe: active.ppeRequired || [] } : { active: false };
}

function computeActiveConsults(patientId, consults) {
  const active = consults.filter(c => c.patientId === patientId && ['requested','responded'].includes(c.status));
  return active.map(c => ({ service: c.targetService, status: c.status, type: c.consultType, question: (c.question||'').slice(0, 80) }));
}

function computeNcp(patientId, ncps) {
  const ncp = ncps.find(n => n.patientId === patientId && n.status === 'active');
  if (!ncp) return { active: false };
  const activeDx = (ncp.diagnoses || []).filter(d => d.status === 'active');
  const unmetNoc = [];
  for (const d of activeDx) for (const o of (d.expectedOutcomes || [])) {
    if (o.latestScore != null && o.latestScore < o.target) unmetNoc.push(o.fa);
  }
  return { active: true, activeDiagnoses: activeDx.length, unmetNoc: unmetNoc.slice(0, 3) };
}

function computePendingOrders(patientId, orders) {
  const pending = orders.filter(o => o.patientId === patientId && o.status === 'pending');
  const stat = pending.filter(o => o.priority === 'stat');
  return { total: pending.length, stat: stat.length };
}

// ═══ Patient priority score for handoff list ═══
function computeHandoffPriority(patient, ctx) {
  const t = ctx.trends;
  const mar = ctx.mar;
  const labs = ctx.labs;
  const sepsis = ctx.sepsis;
  const round = ctx.round;
  let score = 30;
  const reasons = [];

  if (sepsis.active) { score += 40; reasons.push('سپسیس فعال'); }
  const news = t.latest ? Number(t.latest.news2) || 0 : 0;
  if (news >= 9) { score += 35; reasons.push('NEWS2 ' + news + ' بحرانی'); }
  else if (news >= 7) { score += 28; reasons.push('NEWS2 ' + news); }
  else if (news >= 5) { score += 15; reasons.push('NEWS2 ' + news); }
  else if (news >= 3) { score += 5; }
  if (t.newsDelta >= 3) { score += 20; reasons.push('NEWS2 صعودی +' + t.newsDelta); }
  if (labs.unacked > 0) { score += 20; reasons.push(labs.unacked + ' lab بحرانی بدون read-back'); }
  if (mar.missed > 0) { score += Math.min(20, mar.missed * 6); reasons.push(mar.missed + ' دوز missed'); }
  if (mar.highMissed > 0) { score += 10; reasons.push(mar.highMissed + ' High-Alert missed'); }
  if (round.hoursAgo === null) { score += 15; reasons.push('بدون راند اخیر'); }
  else if (round.hoursAgo > 24) { score += 12; reasons.push(round.hoursAgo + 'h از راند'); }
  else if (round.hoursAgo > 12) { score += 5; }
  if (ctx.isolation.active) { score += 8; reasons.push('ایزولاسیون ' + ctx.isolation.type); }
  if (ctx.pendingOrders.stat > 0) { score += 10; reasons.push(ctx.pendingOrders.stat + ' دستور STAT'); }
  if (patient.codeStatus === 'dnr' || patient.codeStatus === 'dni') { score -= 8; }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low';
  return { score, level, reasons, news, newsDelta: t.newsDelta, marMissed: mar.missed, labsUnacked: labs.unacked };
}

// ═══ SBAR synthesis — narrative generation ═══
function synthesizeSBAR(patient, ctx) {
  const t = ctx.trends;
  const mar = ctx.mar;
  const labs = ctx.labs;
  const sepsis = ctx.sepsis;
  const iso = ctx.isolation;
  const round = ctx.round;
  const consults = ctx.consults;
  const ncp = ctx.ncp;
  const pending = ctx.pendingOrders;
  const los = patient.admittedAt ? Math.floor((Date.now() - sd(patient.admittedAt)) / 86400000) : null;

  // ─── S — Situation ───
  let situation = '';
  if (sepsis.active) situation += '🦠 سپسیس ' + sepsis.status + ' (qSOFA ' + sepsis.qsofa + ', likelihood ' + sepsis.likelihood + '%). ';
  if (t.hasTrend && t.notes.length) situation += '📈 ' + t.notes.slice(0, 3).join(' · ') + '. ';
  else if (t.latest) situation += '📊 ویتال: NEWS2 ' + (t.latest.news2||0) + ' (HR ' + (t.latest.hr||'—') + ', BP ' + (t.latest.bp_sys||'—') + '/' + (t.latest.bp_dia||'—') + ', SpO₂ ' + (t.latest.spo2||'—') + '%, RR ' + (t.latest.rr||'—') + '). ';
  if (!situation) situation = 'وضعیت پایدار — داده کافی برای سنتز روند نیست.';

  // ─── B — Background ───
  const bgParts = [];
  if (patient.diagnosis) bgParts.push('تشخیص: ' + patient.diagnosis);
  if (patient.age) bgParts.push(patient.age + ' ساله');
  if (patient.sex) bgParts.push(patient.sex === 'female' ? 'زن' : 'مرد');
  if (los !== null) bgParts.push('بستری ' + los + ' روز');
  if (patient.comorbidities && patient.comorbidities.length) bgParts.push('همراهی: ' + patient.comorbidities.join('، '));
  if (patient.allergies && patient.allergies.length) bgParts.push('⚠️ آلرژی: ' + patient.allergies.join('، '));
  if (iso.active) bgParts.push('🧼 ایزوله ' + iso.type);
  const background = bgParts.join(' · ');

  // ─── A — Assessment ───
  const asmtParts = [];
  if (round.has) {
    if (round.impression) asmtParts.push('آخرین راند (' + round.hoursAgo + 'h، ' + round.author + '): ' + round.impression);
    else if (round.chiefComplaint) asmtParts.push('آخرین راند (' + round.hoursAgo + 'h): ' + round.chiefComplaint);
  } else {
    asmtParts.push('⚠️ بدون راند ثبت‌شده');
  }
  if (ncp.active) {
    let s = 'NCP: ' + ncp.activeDiagnoses + ' تشخیص فعال';
    if (ncp.unmetNoc.length) s += ' — NOC زیر هدف: ' + ncp.unmetNoc.join('، ');
    asmtParts.push(s);
  }
  if (labs.unacked > 0) asmtParts.push('🧪 ' + labs.unacked + ' lab بحرانی بدون تأیید');
  if (consults.length) {
    asmtParts.push('🩺 مشاورات فعال: ' + consults.map(c => c.service + ' (' + c.status + ')').join(' · '));
  }
  const assessment = asmtParts.join('\n');

  // ─── R — Recommendation ───
  const recs = [];
  if (sepsis.active && sepsis.bundle3hPending) recs.push('🦠 تکمیل ۳h Sepsis Bundle');
  if (labs.unacked > 0) recs.push('🧪 read-back ' + labs.unacked + ' lab بحرانی با پزشک');
  if (mar.missed > 0) recs.push('💊 بررسی ' + mar.missed + ' دوز missed');
  if (mar.due1h > 0) recs.push('⏰ ' + mar.due1h + ' دوز MAR در ۱ ساعت آینده');
  if (pending.stat > 0) recs.push('📝 ' + pending.stat + ' دستور STAT تأییدنشده');
  if (pending.total > pending.stat) recs.push('📋 ' + (pending.total - pending.stat) + ' دستور در انتظار تأیید');
  if (!round.has) recs.push('📝 ثبت راند برای این بیمار');
  if (iso.active) recs.push('🧼 PPE: ' + (iso.ppe.join(', ') || iso.type));
  if (!recs.length) recs.push('ادامه مراقبت روتین — پایش NEWS2');

  return {
    situation: situation.trim(),
    background: background.trim(),
    assessment: assessment.trim(),
    recommendation: recs.map(r => '• ' + r).join('\n')
  };
}

// ═══ HANDLERS ═══

function candidates(ctx) {
  const scope = actorScope(ctx.actor);
  const patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status) && inScope(p, scope));
  if (!patients.length) return { items: [], total: 0, generatedAt: ctx.now() };

  const vitals = h(ctx, 'vitals');
  const mar = h(ctx, 'mar');
  const labs = h(ctx, 'labs');
  const encounters = h(ctx, 'encounters');
  const sepsisAll = h(ctx, 'sepsis');
  const isolations = h(ctx, 'isolations');
  const orders = h(ctx, 'orders');
  const consultsAll = h(ctx, 'consults');
  const ncps = h(ctx, 'nursing_care_plans');

  const items = patients.map(p => {
    const t = computeVitalsTrends(p.id, vitals);
    const m = computeMarStatus(p.id, mar);
    const l = computeLabStatus(p.id, labs);
    const r = computeLastRound(p.id, encounters);
    const s = computeSepsis(p.id, sepsisAll);
    const iso = computeIsolation(p.id, isolations);
    const po = computePendingOrders(p.id, orders);
    const pr = computeHandoffPriority(p, { trends: t, mar: m, labs: l, sepsis: s, isolation: iso, round: r, pendingOrders: po });
    return {
      patientId: p.id,
      name: p.firstName + ' ' + p.lastName,
      age: p.age, sex: p.sex, ward: p.wardCode, bed: p.bedNumber,
      diagnosis: p.diagnosis, codeStatus: p.codeStatus, admittedAt: p.admittedAt,
      priority: pr,
      hasSepsis: s.active,
      hasIsolation: iso.active,
      lastVital: t.latest,
      lastRoundHours: r.hoursAgo,
      marMissed: m.missed,
      labsUnacked: l.unacked
    };
  }).sort((a, b) => b.priority.score - a.priority.score);

  const stats = {
    total: items.length,
    critical: items.filter(i => i.priority.level === 'critical').length,
    high: items.filter(i => i.priority.level === 'high').length,
    withSepsis: items.filter(i => i.hasSepsis).length,
    withUnackedLabs: items.filter(i => i.labsUnacked > 0).length,
    withoutRound24h: items.filter(i => i.lastRoundHours === null || i.lastRoundHours > 24).length
  };

  return { items, stats, generatedAt: ctx.now() };
}

function patientNarrative(ctx) {
  const pid = ctx.params.patientId;
  const patient = store.get('patients', pid);
  if (!patient) throw ctx.E.notFound('patient_not_found');

  const scope = actorScope(ctx.actor);
  if (!perms.isCrossWard(ctx.actor.role) && scope.kind !== 'all' && !inScope(patient, scope)) {
    throw ctx.E.forbidden('outside_scope');
  }

  const vitals = h(ctx, 'vitals').filter(v => v.patientId === pid);
  const mar = h(ctx, 'mar').filter(m => m.patientId === pid);
  const labs = h(ctx, 'labs').filter(l => l.patientId === pid);
  const encounters = h(ctx, 'encounters').filter(e => e.patientId === pid);
  const sepsisAll = h(ctx, 'sepsis').filter(s => s.patientId === pid);
  const isolationsAll = h(ctx, 'isolations').filter(i => i.patientId === pid);
  const orders = h(ctx, 'orders').filter(o => o.patientId === pid);
  const consultsAll = h(ctx, 'consults').filter(c => c.patientId === pid);
  const ncps = h(ctx, 'nursing_care_plans').filter(n => n.patientId === pid);

  const t = computeVitalsTrends(pid, vitals);
  const m = computeMarStatus(pid, mar);
  const l = computeLabStatus(pid, labs);
  const r = computeLastRound(pid, encounters);
  const s = computeSepsis(pid, sepsisAll);
  const iso = computeIsolation(pid, isolationsAll);
  const c = computeActiveConsults(pid, consultsAll);
  const ncp = computeNcp(pid, ncps);
  const po = computePendingOrders(pid, orders);

  const context = { trends: t, mar: m, labs: l, round: r, sepsis: s, isolation: iso, consults: c, ncp, pendingOrders: po };
  const priority = computeHandoffPriority(patient, context);
  const sbar = synthesizeSBAR(patient, context);

  return {
    patient: {
      id: patient.id, mrn: patient.mrn,
      name: patient.firstName + ' ' + patient.lastName,
      age: patient.age, sex: patient.sex,
      ward: patient.wardCode, bed: patient.bedNumber,
      diagnosis: patient.diagnosis, codeStatus: patient.codeStatus,
      admittedAt: patient.admittedAt, serviceCode: patient.serviceCode
    },
    priority,
    sbar,
    trends: t,
    mar: m,
    labs: l,
    sepsis: s,
    isolation: iso,
    consults: c,
    ncp,
    pendingOrders: po,
    lastRound: r,
    generatedAt: ctx.now()
  };
}

function generate(ctx) {
  const b = ctx.body || {};
  if (!Array.isArray(b.patientIds) || !b.patientIds.length) throw ctx.E.badRequest('patient_ids_required');

  const items = [];
  for (const pid of b.patientIds.slice(0, 30)) {
    const patient = store.get('patients', pid);
    if (!patient) continue;
    try {
      const d = patientNarrative({ ...ctx, params: { patientId: pid } });
      items.push(d);
    } catch (_) {}
  }
  return {
    items,
    total: items.length,
    generatedAt: ctx.now(),
    generatedBy: { id: ctx.actor.id, name: ctx.actor.fullName || ctx.actor.username, role: ctx.actor.role }
  };
}

function save(ctx) {
  const b = ctx.body || {};
  if (!Array.isArray(b.patientIds) || !b.patientIds.length) throw ctx.E.badRequest('patient_ids_required');
  if (!b.toUserId) throw ctx.E.badRequest('to_user_required');
  if (!b.untilShift) throw ctx.E.badRequest('until_shift_required');

  const target = store.get('users', b.toUserId);
  if (!target) throw ctx.E.notFound('to_user_not_found');

  // Generate fresh narratives
  const generated = generate({ ...ctx, body: b, params: {} });
  if (!generated.items.length) throw ctx.E.badRequest('no_valid_patients');

  const rec = {
    id: ctx.uid('hoai'),
    fromUserId: ctx.actor.id,
    fromUserName: ctx.actor.fullName || ctx.actor.username,
    fromUserRole: ctx.actor.role,
    toUserId: b.toUserId,
    toUserName: target.fullName || target.username,
    untilShift: b.untilShift,
    patientCount: generated.items.length,
    items: generated.items.map(it => ({
      patientId: it.patient.id,
      patientName: it.patient.name,
      ward: it.patient.ward,
      priority: it.priority,
      sbar: it.sbar,
      trends: { hasTrend: it.trends.hasTrend, newsDelta: it.trends.newsDelta, notes: it.trends.notes }
    })),
    notes: String(b.notes || '').slice(0, 1000),
    status: 'sent',
    sentAt: ctx.now(),
    receivedAt: null,
    readBack: null,
    uniqueCode: 'HAI-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 5).toUpperCase()
  };
  store.put('handoff_ai_records', rec);
  ctx.audit.write('handoff_ai', 'handoff.save', rec.id, ctx.actor, { patientCount: rec.patientCount, to: b.toUserId });
  bus.emit('handoff_ai.sent', { record: rec, actor: ctx.actor });
  bus.emit('notification.user', {
    userId: b.toUserId,
    title: '📋 تحویل پزشکی از ' + rec.fromUserName,
    message: rec.patientCount + ' بیمار · کد: ' + rec.uniqueCode,
    handoffId: rec.id
  });
  return rec;
}

function receive(ctx) {
  const id = ctx.params.id;
  const rec = store.get('handoff_ai_records', id);
  if (!rec) throw ctx.E.notFound('handoff_not_found');
  if (rec.toUserId !== ctx.actor.id && ctx.actor.role !== 'admin') throw ctx.E.forbidden('not_recipient');
  if (rec.receivedAt) throw ctx.E.conflict('already_received');
  const b = ctx.body || {};
  if (!b.readBack || String(b.readBack).trim().length < 10) {
    throw ctx.E.badRequest('read_back_min_10_chars');
  }
  rec.status = 'received';
  rec.receivedAt = ctx.now();
  rec.receivedBy = ctx.actor.id;
  rec.receivedByName = ctx.actor.fullName || ctx.actor.username;
  rec.readBack = String(b.readBack).slice(0, 1000);
  rec.readBackCodeMatched = rec.uniqueCode && String(b.readBack).indexOf(rec.uniqueCode) >= 0;
  store.put('handoff_ai_records', rec);
  ctx.audit.write('handoff_ai', 'handoff.received', rec.id, ctx.actor, { codeMatched: rec.readBackCodeMatched });
  bus.emit('handoff_ai.received', { record: rec, actor: ctx.actor });
  return rec;
}

function inbox(ctx) {
  const items = h(ctx, 'handoff_ai_records')
    .filter(r => r.toUserId === ctx.actor.id && r.status === 'sent')
    .sort((a, b) => sd(b.sentAt) - sd(a.sentAt));
  return { items: items.slice(0, 20), total: items.length };
}

function outbox(ctx) {
  const items = h(ctx, 'handoff_ai_records')
    .filter(r => r.fromUserId === ctx.actor.id)
    .sort((a, b) => sd(b.sentAt) - sd(a.sentAt));
  return { items: items.slice(0, 20), total: items.length };
}

function history(ctx) {
  const days = Math.min(30, Number(ctx.query.days) || 7);
  const since = Date.now() - days * 86400000;
  let items = h(ctx, 'handoff_ai_records').filter(r => sd(r.sentAt) >= since);
  if (ctx.actor.role !== 'admin' && !perms.isCrossWard(ctx.actor.role)) {
    items = items.filter(r => r.fromUserId === ctx.actor.id || r.toUserId === ctx.actor.id);
  }
  items.sort((a, b) => sd(b.sentAt) - sd(a.sentAt));
  return {
    items: items.slice(0, 50).map(r => ({
      id: r.id, code: r.uniqueCode,
      from: r.fromUserName, to: r.toUserName,
      patientCount: r.patientCount, status: r.status,
      sentAt: r.sentAt, receivedAt: r.receivedAt
    })),
    total: items.length,
    window: { days, since: new Date(since).toISOString() }
  };
}

function stats(ctx) {
  const all = h(ctx, 'handoff_ai_records');
  const last7 = all.filter(r => sd(r.sentAt) > Date.now() - 7 * 86400000);
  const received = last7.filter(r => r.status === 'received');
  const pending = last7.filter(r => r.status === 'sent');
  const codeMatched = received.filter(r => r.readBackCodeMatched);
  return {
    window: '7d',
    sent: last7.length,
    received: received.length,
    pending: pending.length,
    readbackCompliancePct: received.length > 0 ? Math.round((codeMatched.length / received.length) * 100) : 100,
    avgPatientsPerHandoff: last7.length > 0 ? Math.round(last7.reduce((s, r) => s + (r.patientCount || 0), 0) / last7.length) : 0
  };
}

function printHTML(ctx) {
  const id = ctx.params.id;
  const rec = store.get('handoff_ai_records', id);
  if (!rec) throw ctx.E.notFound('handoff_not_found');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let body = '';
  body += '<div style="border-bottom:3px solid #0891b2;padding-bottom:12px;margin-bottom:16px">';
  body += '<div style="font-size:22px;font-weight:900;color:#0891b2">🫀 بیمارستان سینا</div>';
  body += '<div style="font-size:12px;color:#64748b">Handoff AI — تحویل پزشکی شیفت</div>';
  body += '<div style="font-size:11px;font-family:monospace;color:#0891b2;font-weight:900;margin-top:6px">🔐 ' + esc(rec.uniqueCode) + '</div>';
  body += '</div>';
  body += '<table style="width:100%;font-size:11.5px;margin-bottom:14px"><tr>';
  body += '<td><b>از:</b> ' + esc(rec.fromUserName) + ' (' + esc(rec.fromUserRole) + ')</td>';
  body += '<td><b>به:</b> ' + esc(rec.toUserName) + '</td>';
  body += '<td><b>تا شیفت:</b> ' + esc(rec.untilShift) + '</td></tr>';
  body += '<tr><td colspan="3" style="padding-top:6px"><b>زمان ارسال:</b> ' + new Date(rec.sentAt).toLocaleString('fa-IR') + ' · <b>تعداد بیمار:</b> ' + rec.patientCount + '</td></tr></table>';
  for (const it of rec.items) {
    const pr = it.priority;
    const color = pr.level === 'critical' ? '#dc2626' : pr.level === 'high' ? '#f59e0b' : '#10b981';
    body += '<div style="page-break-inside:avoid;margin-bottom:16px;border:2px solid ' + color + ';border-radius:8px;padding:10px">';
    body += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
    body += '<div style="font-size:15px;font-weight:900">' + esc(it.patientName) + '</div>';
    body += '<div style="background:' + color + ';color:#fff;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:900">' + pr.score + ' · ' + esc(pr.level) + '</div>';
    body += '</div>';
    body += '<div style="font-size:10.5px;color:#64748b;margin-bottom:6px">' + esc(it.ward) + '</div>';
    if (pr.reasons && pr.reasons.length) {
      body += '<div style="font-size:10.5px;color:' + color + ';font-weight:800;margin-bottom:6px">⚠️ ' + esc(pr.reasons.join(' · ')) + '</div>';
    }
    body += '<div style="margin-top:8px"><b style="color:#0891b2">S — وضعیت:</b><div style="font-size:11.5px;white-space:pre-wrap;margin-top:2px">' + esc(it.sbar.situation) + '</div></div>';
    body += '<div style="margin-top:6px"><b style="color:#0891b2">B — سابقه:</b><div style="font-size:11.5px;white-space:pre-wrap;margin-top:2px">' + esc(it.sbar.background) + '</div></div>';
    body += '<div style="margin-top:6px"><b style="color:#0891b2">A — ارزیابی:</b><div style="font-size:11.5px;white-space:pre-wrap;margin-top:2px">' + esc(it.sbar.assessment) + '</div></div>';
    body += '<div style="margin-top:6px"><b style="color:#0891b2">R — توصیه:</b><div style="font-size:11.5px;white-space:pre-wrap;margin-top:2px">' + esc(it.sbar.recommendation) + '</div></div>';
    body += '</div>';
  }
  body += '<div style="margin-top:24px;padding-top:12px;border-top:1px solid #cbd5e1;font-size:10px;color:#64748b;text-align:center">NABZ Handoff AI · ' + new Date().toISOString() + '</div>';
  return {
    html: '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><title>Handoff ' + esc(rec.uniqueCode) + '</title><style>@page{size:A4;margin:12mm}body{font-family:Vazirmatn,Tahoma,sans-serif;padding:0;margin:0}table{border-collapse:collapse}</style></head><body>' + body + '</body></html>',
    title: 'Handoff — ' + rec.uniqueCode,
    meta: { handoffId: rec.id }
  };
}

module.exports = {
  handlers: { candidates, patientNarrative, generate, save, receive, inbox, outbox, history, stats, printHTML },
  routes: [
    { method:'GET',  path:'/api/handoff_ai/candidates',          handler:'candidates',       perm:'handoff_ai.view' },
    { method:'POST', path:'/api/handoff_ai/generate',            handler:'generate',         perm:'handoff_ai.view' },
    { method:'POST', path:'/api/handoff_ai/save',                handler:'save',             perm:'handoff_ai.create' },
    { method:'POST', path:'/api/handoff_ai/:id/receive',         handler:'receive',          perm:'handoff_ai.receive' },
    { method:'GET',  path:'/api/handoff_ai/inbox',               handler:'inbox',            perm:'handoff_ai.view' },
    { method:'GET',  path:'/api/handoff_ai/outbox',              handler:'outbox',           perm:'handoff_ai.view' },
    { method:'GET',  path:'/api/handoff_ai/history',             handler:'history',          perm:'handoff_ai.view' },
    { method:'GET',  path:'/api/handoff_ai/stats',               handler:'stats',            perm:'handoff_ai.view' },
    { method:'GET',  path:'/api/handoff_ai/patient/:patientId',  handler:'patientNarrative', perm:'handoff_ai.view' },
    { method:'GET',  path:'/api/handoff_ai/:id/print',           handler:'printHTML',        perm:'handoff_ai.view' }
  ],
  panels: [
    { id:'hub', title:'Handoff AI — تحویل پزشکی', icon:'📋', perm:'handoff_ai.view', kind:'handoff_ai', api:'/api/handoff_ai/candidates' }
  ]
};
console.log('[handoff_ai] loaded — trend detection · SBAR synthesis · read-back');
