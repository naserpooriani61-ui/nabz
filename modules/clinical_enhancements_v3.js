
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Clinical Enhancements v3
//  Surgical enhancements to existing modules:
//   1. Specimen Chain-of-Custody (paraclinical)
//   2. ED Wait-Time Timer (emergency_full)
//   3. Fall Risk Auto-Update (safety + cdss)
//   4. Sepsis Risk 6h Predictor (neural)
//  No new UI. All backward compatible.
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const bus = require('../core/events');
const store = require('../core/store');
const perms = require('../core/permissions');

// ═══════════════════════════════════════════════════════════
//  Safe requires (if any module missing, that part is skipped)
// ═══════════════════════════════════════════════════════════
let paraclinical, emergency_full, safety, neuralMod, cdssMod;
try { paraclinical = require('./paraclinical'); } catch (e) { console.warn('[v3] paraclinical:', e.message); }
try { emergency_full = require('./emergency_full'); } catch (e) { console.warn('[v3] emergency_full:', e.message); }
try { safety = require('./safety'); } catch (e) { console.warn('[v3] safety:', e.message); }
try { neuralMod = require('../core/neural'); } catch (e) { console.warn('[v3] neural:', e.message); }
try { cdssMod = require('./cdss'); } catch (e) { console.warn('[v3] cdss:', e.message); }

// ═══════════════════════════════════════════════════════════
//  Part 1 — Specimen Chain-of-Custody
//  Lab flow: ordered → collected → in_transit → received → resulted → verified
//  Auto-warning if transit > 30min (blood culture) or > 120min (routine)
// ═══════════════════════════════════════════════════════════
function labTransit(ctx) {
  const l = store.get('labs', ctx.params.id);
  if (!l) throw ctx.E.notFound('lab_not_found');
  if (l.status !== 'collected') throw ctx.E.conflict('must_be_collected_first:' + l.status);
  const b = ctx.body || {};
  l.status = 'in_transit';
  l.transitStartedAt = ctx.now();
  l.transitStartedBy = ctx.actor.id;
  l.transitStartedByName = ctx.actor.fullName || ctx.actor.username;
  l.transitDestination = b.destination || 'central_lab';
  l.transitCourier = b.courier || null;
  store.put('labs', l);
  ctx.audit.write('clinical_enhancements_v3', 'lab.transit', l.id, ctx.actor, {
    destination: l.transitDestination, courier: l.transitCourier
  });
  bus.emit('lab.in_transit', { record: l, actor: ctx.actor });
  return l;
}

function labReceive(ctx) {
  const l = store.get('labs', ctx.params.id);
  if (!l) throw ctx.E.notFound('lab_not_found');
  if (l.status !== 'in_transit') throw ctx.E.conflict('must_be_in_transit:' + l.status);
  const b = ctx.body || {};
  l.status = 'received';
  l.receivedAt = ctx.now();
  l.receivedBy = ctx.actor.id;
  l.receivedByName = ctx.actor.fullName || ctx.actor.username;
  l.receivedCondition = b.condition || 'intact';
  l.receivedNotes = b.notes || '';
  const transitMin = Math.round((sd(l.receivedAt) - sd(l.transitStartedAt)) / 60000);
  l.transitMinutes = transitMin;

  // Specimen integrity thresholds per CLSI
  const panel = String(l.panelCode || '').toLowerCase();
  const isBlood = panel.includes('blood') || panel.includes('culture') || panel.includes('abg');
  const threshold = isBlood ? 30 : 120;
  if (transitMin > threshold) {
    l.integrityWarning = 'transit_time_exceeded:' + transitMin + 'min';
    bus.emit('lab.integrity_warning', {
      record: l, transitMin, threshold,
      severity: transitMin > threshold * 2 ? 'critical' : 'warning',
      actor: ctx.actor
    });
  }
  if (l.receivedCondition !== 'intact') {
    l.integrityWarning = (l.integrityWarning ? l.integrityWarning + ';' : '') + 'condition_' + l.receivedCondition;
    bus.emit('lab.integrity_warning', {
      record: l, reason: 'received_' + l.receivedCondition,
      severity: 'critical', actor: ctx.actor
    });
  }
  store.put('labs', l);
  ctx.audit.write('clinical_enhancements_v3', 'lab.receive', l.id, ctx.actor, {
    transitMin, condition: l.receivedCondition
  });
  bus.emit('lab.received', { record: l, actor: ctx.actor });
  return l;
}

// Specimen queue (chain-of-custody dashboard)
function specimenQueue(ctx) {
  const status = ctx.query.status || null;
  let items = h(ctx, 'labs').filter(l => ['collected','in_transit','received'].includes(l.status));
  if (status) items = items.filter(l => l.status === status);
  if (ctx.query.ward) items = items.filter(l => l.wardCode === ctx.query.ward);
  const now = Date.now();
  const enriched = items.map(l => {
    const age = l.collectedAt ? Math.round((now - sd(l.collectedAt)) / 60000) : null;
    const transitAge = l.transitStartedAt ? Math.round((now - sd(l.transitStartedAt)) / 60000) : null;
    const panel = String(l.panelCode || '').toLowerCase();
    const isBlood = panel.includes('blood') || panel.includes('culture') || panel.includes('abg');
    const threshold = isBlood ? 30 : 120;
    const delayed = transitAge != null && transitAge > threshold;
    return {
      id: l.id, patientId: l.patientId, patientName: l.patientName,
      wardCode: l.wardCode, panelCode: l.panelCode, panelName: l.panelName,
      priority: l.priority, status: l.status,
      collectedAt: l.collectedAt, collectedByName: l.collectedByName || l.collectedBy,
      transitStartedAt: l.transitStartedAt, transitStartedByName: l.transitStartedByName,
      receivedAt: l.receivedAt, receivedByName: l.receivedByName,
      ageMin: age, transitMin: transitAge,
      threshold, delayed, severity: delayed ? 'critical' : age != null && age > threshold * 0.8 ? 'warning' : 'ok',
      integrityWarning: l.integrityWarning || null
    };
  }).sort((a, b) => {
    if (a.delayed !== b.delayed) return a.delayed ? -1 : 1;
    return (b.transitMin || b.ageMin || 0) - (a.transitMin || a.ageMin || 0);
  });
  return {
    items: enriched, total: enriched.length,
    stats: {
      collected: enriched.filter(x => x.status === 'collected').length,
      inTransit: enriched.filter(x => x.status === 'in_transit').length,
      received: enriched.filter(x => x.status === 'received').length,
      delayed: enriched.filter(x => x.delayed).length
    },
    checkedAt: new Date().toISOString()
  };
}

// Wrap labResult to accept 'received' status (preserving chain)
if (paraclinical && paraclinical.handlers && paraclinical.handlers.labResult) {
  const origLabResult = paraclinical.handlers.labResult;
  paraclinical.handlers.labResult = function(ctx) {
    const l = ctx.store.get('labs', ctx.params.id);
    if (!l) return origLabResult(ctx);
    if (l.status === 'received') {
      const chainSnapshot = {
        orderedAt: l.orderedAt, collectedAt: l.collectedAt,
        transitStartedAt: l.transitStartedAt, receivedAt: l.receivedAt,
        transitMinutes: l.transitMinutes, integrityWarning: l.integrityWarning || null
      };
      // Temporarily set to 'collected' so original passes
      l.status = 'collected';
      ctx.store.put('labs', l);
      try {
        const result = origLabResult(ctx);
        result.chainOfCustody = chainSnapshot;
        ctx.store.put('labs', result);
        return result;
      } catch (e) {
        l.status = 'received';
        ctx.store.put('labs', l);
        throw e;
      }
    }
    return origLabResult(ctx);
  };
  // Register routes
  paraclinical.handlers.labTransit = labTransit;
  paraclinical.handlers.labReceive = labReceive;
  paraclinical.handlers.specimenQueue = specimenQueue;
  paraclinical.routes.push(
    { method:'POST', path:'/api/para/labs/:id/transit', handler:'labTransit', perm:'lab.collect' },
    { method:'POST', path:'/api/para/labs/:id/receive', handler:'labReceive', perm:'lab.collect' },
    { method:'GET',  path:'/api/para/specimens/queue', handler:'specimenQueue', perm:'lab.view' }
  );
  console.log('[v3] ✅ Specimen Chain-of-Custody attached to paraclinical');
}

// ═══════════════════════════════════════════════════════════
//  Part 2 — ED Wait-Time Timer per ESI
// ═══════════════════════════════════════════════════════════
const ESI_MAX_WAIT = { 1: 0, 2: 10, 3: 30, 4: 60, 5: 120 };

function waitingList(ctx) {
  const visits = h(ctx, 'ed_visits').filter(v => ['waiting_triage', 'waiting_doctor'].includes(v.status));
  const now = Date.now();
  const items = visits.map(v => {
    const waitMin = Math.round((now - sd(v.arrivalAt)) / 60000);
    const esi = Number(v.esiLevel) || 5;
    const max = ESI_MAX_WAIT[esi] || 60;
    const overdue = max > 0 && waitMin > max;
    const warning = max > 0 && !overdue && waitMin > max * 0.8;
    const predictedOverdueInMin = max > 0 && !overdue ? Math.max(0, max - waitMin) : null;
    return {
      id: v.id, patientName: v.patientName, chiefComplaint: v.chiefComplaint,
      arrivalAt: v.arrivalAt, arrivalMode: v.arrivalMode,
      esiLevel: esi, status: v.status,
      waitMin, esiMax: max, overdue, warning,
      predictedOverdueInMin,
      severity: overdue ? 'critical' : warning ? 'warning' : 'ok'
    };
  }).sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.warning !== b.warning) return a.warning ? -1 : 1;
    return b.waitMin - a.waitMin;
  });
  return {
    items, total: items.length,
    stats: {
      overdue: items.filter(x => x.overdue).length,
      warning: items.filter(x => x.warning).length,
      total: items.length,
      avgWaitMin: items.length > 0 ? Math.round(items.reduce((s, x) => s + x.waitMin, 0) / items.length) : 0,
      longestWaitMin: items.length > 0 ? Math.max(...items.map(x => x.waitMin)) : 0
    },
    checkedAt: new Date().toISOString()
  };
}

function waitTimeStats(ctx) {
  const hours = Math.min(24, Number(ctx.query.hours) || 8);
  const since = Date.now() - hours * 3600000;
  const visits = h(ctx, 'ed_visits').filter(v => sd(v.arrivalAt) >= since);
  const byEsi = {};
  for (const v of visits) {
    const esi = Number(v.esiLevel) || 5;
    if (!byEsi[esi]) byEsi[esi] = { count: 0, totalWaitMin: 0, overdue: 0, maxWaitMin: 0 };
    const wait = v.triagedAt ? Math.round((sd(v.triagedAt) - sd(v.arrivalAt)) / 60000) : null;
    if (wait != null) {
      byEsi[esi].count++;
      byEsi[esi].totalWaitMin += wait;
      if (wait > (ESI_MAX_WAIT[esi] || 60)) byEsi[esi].overdue++;
      if (wait > byEsi[esi].maxWaitMin) byEsi[esi].maxWaitMin = wait;
    }
  }
  const items = Object.entries(byEsi).map(([esi, s]) => ({
    esiLevel: Number(esi), maxWaitTarget: ESI_MAX_WAIT[esi] || 60,
    count: s.count,
    avgWaitMin: s.count > 0 ? Math.round(s.totalWaitMin / s.count) : 0,
    maxWaitMin: s.maxWaitMin,
    overdue: s.overdue,
    compliancePct: s.count > 0 ? Math.round(((s.count - s.overdue) / s.count) * 100) : 100
  })).sort((a, b) => a.esiLevel - b.esiLevel);
  return { window: { hours, since: new Date(since).toISOString() }, items, total: items.length };
}

// Background timer — auto-escalation
const _waitEscalated = new Map();
function escalateWaitTimes() {
  try {
    const now = Date.now();
    const visits = store.readAll('ed_visits').filter(v => ['waiting_triage', 'waiting_doctor'].includes(v.status));
    for (const v of visits) {
      const waitMin = Math.round((now - sd(v.arrivalAt)) / 60000);
      const esi = Number(v.esiLevel) || 5;
      const max = ESI_MAX_WAIT[esi] || 60;
      if (max === 0 || waitMin <= max) continue;
      // 30-min cooldown per visit
      const key = 'wait:' + v.id;
      const last = _waitEscalated.get(key);
      if (last && now - last < 30 * 60000) continue;
      _waitEscalated.set(key, now);
      bus.emit('cdss.alert', {
        type: 'wait_time_exceeded',
        severity: 'critical',
        patientId: v.id, patientName: v.patientName,
        title: '⏰ Wait time exceeded — ' + (v.patientName || ''),
        message: 'ESI ' + esi + ' — ' + waitMin + ' min (حداکثر ' + max + ')',
        recommendation: 'ارزیابی فوری — اختصاص پزشک یا ارتقای ESI'
      });
    }
    if (_waitEscalated.size > 5000) {

      const cutoff = now - 30 * 60000;

      for (const [k, t] of _waitEscalated) if (t < cutoff) _waitEscalated.delete(k);

      if (_waitEscalated.size > 5000) console.warn("[v3] still >5000 after TTL cleanup:", _waitEscalated.size);

    }
  } catch (e) { console.warn('[v3] wait escalation:', e.message); }
}

let _waitTimerStarted = false;
function startWaitTimer() {
  if (_waitTimerStarted) return;
  _waitTimerStarted = true;
  setTimeout(() => {
    escalateWaitTimes();
    setInterval(escalateWaitTimes, 5 * 60000); // every 5 min
  }, 20000);
  console.log('[v3] ✅ ED wait-time timer (5-min) scheduled');
}

if (emergency_full && emergency_full.handlers) {
  emergency_full.handlers.waitingList = waitingList;
  emergency_full.handlers.waitTimeStats = waitTimeStats;
  emergency_full.routes.push(
    { method:'GET', path:'/api/erf/waiting-list', handler:'waitingList', perm:'ed.view' },
    { method:'GET', path:'/api/erf/wait-time-stats', handler:'waitTimeStats', perm:'ed.view' }
  );
  startWaitTimer();
  console.log('[v3] ✅ ED Wait-Time Timer attached to emergency_full');
}

// ═══════════════════════════════════════════════════════════
//  Part 3 — Fall Risk Auto-Update (Morse)
// ═══════════════════════════════════════════════════════════
const SEDATIVE_KEYWORDS = [
  'diazepam','lorazepam','midazolam','morphine','fentanyl','oxycodone',
  'hydromorphone','methadone','codeine','tramadol','zolpidem','zaleplon',
  'diphenhydramine','hydroxyzine','quetiapine','olanzapine','haloperidol',
  'risperidone','clonazepam','alprazolam','phenobarbital','gabapentin',
  'pregabalin','baclofen','cyclobenzaprine','carisoprodol'
];

function isSedative(drug) {
  const d = String(drug || '').toLowerCase();
  return SEDATIVE_KEYWORDS.some(k => d.includes(k));
}

function autoMorseInputs(ctx, patient) {
  const pid = patient.id;
  const mar = h(ctx, 'mar').filter(m => m.patientId === pid && m.status === 'given' && sd(m.administeredAt) > Date.now() - 24 * 3600000);
  const vitals = h(ctx, 'vitals').filter(v => v.patientId === pid).sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
  const last = vitals[0] || {};

  const hasSedative = mar.some(m => isSedative(m.drugName));
  const hasIV = mar.some(m => {
    const r = String(m.route || '').toLowerCase();
    return r.includes('iv') || r.includes('intravenous') || (m.drugName || '').toLowerCase().includes('heparin');
  });
  const gcs = last.gcs != null ? Number(last.gcs) : 15;
  const sbp = last.bp_sys != null ? Number(last.bp_sys) : 120;
  const hasHipo = sbp > 0 && sbp < 100;

  // Previous morse to preserve explicit state
  const prev = h(ctx, 'cdss_scores').find(c => c.patientId === pid && c.scoreType === 'morse');

  return {
    historyOfFalling: patient.hasFallen || (Number(patient.age) >= 65 && (patient.comorbidities || []).length >= 1),
    secondaryDiagnosis: (patient.comorbidities || []).length >= 2 || String(patient.diagnosis || '').length > 10,
    ambulatoryAid: patient.ambulatoryAid || (hasSedative || hasHipo ? 'crutch_cane_walker' : 'none'),
    ivOrHeparinLock: hasIV,
    gait: hasSedative || hasHipo || gcs < 15 ? 'weak' : 'normal',
    mentalStatus: gcs < 15 ? 'overestimates' : 'oriented'
  };
}

function autoMorseCalc(ctx) {
  const pid = ctx.params.patientId;
  const patient = store.get('patients', pid);
  if (!patient) throw ctx.E.notFound('patient_not_found');

  const inputs = autoMorseInputs(ctx, patient);

  // Delegate to cdss's computeMorse if available
  let result;
  if (cdssMod && cdssMod.handlers && cdssMod.handlers.computeMorse) {
    result = cdssMod.handlers.computeMorse({ ...ctx, body: { ...inputs, patientId: pid } });
  } else {
    // Fallback: local Morse implementation
    let score = 0;
    const items = [];
    if (inputs.historyOfFalling) { score += 25; items.push('سابقه سقوط (+25)'); }
    if (inputs.secondaryDiagnosis) { score += 15; items.push('تشخیص ثانویه (+15)'); }
    if (inputs.ambulatoryAid === 'furniture') { score += 30; items.push('وسیله کمکی: مبلمان (+30)'); }
    else if (inputs.ambulatoryAid === 'crutch_cane_walker') { score += 15; items.push('وسیله کمکی (+15)'); }
    if (inputs.ivOrHeparinLock) { score += 20; items.push('سرم/هپارین (+20)'); }
    if (inputs.gait === 'impaired') { score += 10; items.push('راه‌رفتن مختل (+10)'); }
    else if (inputs.gait === 'weak') { score += 20; items.push('راه‌رفتن ضعیف (+20)'); }
    if (inputs.mentalStatus === 'overestimates') { score += 15; items.push('بیش‌برآورد (+15)'); }
    const level = score >= 45 ? 'high' : score >= 25 ? 'moderate' : 'low';
    result = {
      score, max: 125, level, items,
      recommendation: level === 'high'
        ? 'اقدامات پیشگیری سقوط — تخت پایین، زنگ در دسترس، همراهی، دستبند زرد'
        : level === 'moderate' ? 'پایش هر شیفت + آموزش بیمار'
        : 'پایش روتین'
    };
    store.put('cdss_scores', {
      id: 'morse_' + pid, patientId: pid, scoreType: 'morse',
      score, level, items, recommendation: result.recommendation,
      computedAt: ctx.now(), source: 'auto_v3'
    });
  }

  // Attach auto-calc metadata
  result.autoGenerated = true;
  result.autoInputs = inputs;
  result.patientId = pid;
  result.computedAt = ctx.now();

  ctx.audit.write('clinical_enhancements_v3', 'morse.auto_calc', pid, ctx.actor, {
    score: result.score, level: result.level
  });
  bus.emit('morse.auto_calculated', { patientId: pid, result, actor: ctx.actor });

  // High risk alert
  if (result.level === 'high') {
    bus.emit('cdss.alert', {
      type: 'fall_risk_high',
      severity: 'critical',
      patientId: pid, patientName: patient.firstName + ' ' + patient.lastName,
      title: '🚶 خطر سقوط بالا — ' + (patient.firstName + ' ' + patient.lastName),
      message: 'Morse Score ' + result.score + ' (سطح بالا)',
      recommendation: result.recommendation
    });
  }
  return result;
}

// Background listener — auto-recalc on MAR given (sedative) or vitals change
const _morseRecalc = new Map();
function scheduleMorseRecalc(pid, trigger) {
  const key = 'morse:' + pid;
  const last = _morseRecalc.get(key);
  if (last && Date.now() - last < 6 * 3600000) return; // 6h cooldown
  _morseRecalc.set(key, Date.now());
  setTimeout(() => {
    try {
      const ctx = {
        store, audit: require('../core/audit'), bus,
        actor: { id: 'sys_auto', username: 'auto_morse', role: 'admin', fullName: 'Auto Morse' },
        params: { patientId: pid }, body: {}, E: {
          notFound: (m) => ({ code: 404, message: m }),
          badRequest: (m) => ({ code: 400, message: m }),
          conflict: (m) => ({ code: 409, message: m }),
          forbidden: (m) => ({ code: 403, message: m })
        }
      };
      const r = autoMorseCalc(ctx);
      console.log('[v3] Morse auto-recalc for', pid, '→', r.score, '(trigger:', trigger + ')');
    } catch (e) { console.warn('[v3] morse auto-recalc:', e.message); }
  }, 5000);
}

bus.on('kardex.mar.given', function(payload) {
  const m = payload.record || {};
  if (!m.patientId) return;
  if (isSedative(m.drugName)) scheduleMorseRecalc(m.patientId, 'sedative_given:' + m.drugName);
  if (String(m.route || '').toLowerCase().includes('iv')) scheduleMorseRecalc(m.patientId, 'iv_access');
});

bus.on('vitals.recorded', function(payload) {
  const v = payload.record || {};
  if (!v.patientId) return;
  if (v.gcs != null && Number(v.gcs) < 15) scheduleMorseRecalc(v.patientId, 'gcs_decline');
  if (v.bp_sys != null && Number(v.bp_sys) < 100) scheduleMorseRecalc(v.patientId, 'hypotension');
});

if (safety && safety.handlers) {
  safety.handlers.autoMorseCalc = autoMorseCalc;
  safety.routes.push(
    { method:'GET', path:'/api/safety/morse/auto-calc/:patientId', handler:'autoMorseCalc', perm:'patients.view' },
    { method:'POST', path:'/api/safety/morse/auto-calc/:patientId', handler:'autoMorseCalc', perm:'patients.view' }
  );
  console.log('[v3] ✅ Fall Risk Auto-Update attached to safety');
}

// ═══════════════════════════════════════════════════════════
//  Part 4 — Sepsis Risk 6h Predictor (extends neural)
// ═══════════════════════════════════════════════════════════
function computeSepsisRisk6h(patient, context) {
  if (!patient) return { score: 0, level: 'unknown', factors: [] };
  const factors = [];
  let score = 0;

  // Baseline: age
  const age = Number(patient.age) || 50;
  if (age >= 75) { score += 8; factors.push({ feature: 'Age ≥ 75', weight: 8 }); }
  else if (age >= 65) { score += 4; factors.push({ feature: 'Age 65-74', weight: 4 }); }

  // Comorbidities
  const comorb = (patient.comorbidities || []).length;
  if (comorb >= 3) { score += 10; factors.push({ feature: comorb + ' comorbidities', weight: 10 }); }
  else if (comorb >= 1) { score += 5; factors.push({ feature: comorb + ' comorbidity', weight: 5 }); }

  // Vitals trajectory
  const vitals = context.vitalsHistory || [];
  if (vitals.length >= 2) {
    const current = vitals[0];
    const sixHoursAgo = vitals.find(v => (Date.now() - sd(v.recordedAt)) >= 6 * 3600000);
    if (sixHoursAgo) {
      const newsDelta = (Number(current.news2) || 0) - (Number(sixHoursAgo.news2) || 0);
      if (newsDelta >= 3) { score += 20; factors.push({ feature: 'NEWS2 +' + newsDelta + ' (6h)', weight: 20 }); }
      else if (newsDelta >= 1) { score += 8; factors.push({ feature: 'NEWS2 rising', weight: 8 }); }

      const hrDelta = (Number(current.hr) || 0) - (Number(sixHoursAgo.hr) || 0);
      if (hrDelta >= 15) { score += 10; factors.push({ feature: 'HR +' + hrDelta, weight: 10 }); }
      else if (hrDelta >= 8) { score += 5; }

      const rrDelta = (Number(current.rr) || 0) - (Number(sixHoursAgo.rr) || 0);
      if (rrDelta >= 4) { score += 10; factors.push({ feature: 'RR +' + rrDelta, weight: 10 }); }

      const temp = Number(current.temp);
      if (temp >= 38.0) { score += 12; factors.push({ feature: 'Fever ' + temp + '°C', weight: 12 }); }
      else if (temp >= 37.5) { score += 5; }

      const sbp = Number(current.bp_sys);
      if (sbp > 0 && sbp <= 100) { score += 12; factors.push({ feature: 'SBP ' + sbp, weight: 12 }); }
      else if (sbp > 0 && sbp <= 110) { score += 4; }

      if (Number(current.rr) >= 22) { score += 10; factors.push({ feature: 'RR ≥ 22', weight: 10 }); }
    }
  }

  // WBC
  const wbc = Number(context.wbc);
  if (wbc >= 15 || (wbc > 0 && wbc < 4)) {
    score += 12; factors.push({ feature: 'WBC ' + wbc + ' (abnormal)', weight: 12 });
  } else if (wbc >= 12) { score += 6; factors.push({ feature: 'WBC ' + wbc + ' (high)', weight: 6 }); }

  // Lactate
  const lactate = Number(context.lactate);
  if (lactate >= 4) { score += 25; factors.push({ feature: 'Lactate ≥ 4', weight: 25 }); }
  else if (lactate >= 2) { score += 12; factors.push({ feature: 'Lactate ≥ 2', weight: 12 }); }

  // WBC trend
  if (context.wbcTrend != null) {
    if (context.wbcTrend > 5) { score += 8; factors.push({ feature: 'WBC +' + context.wbcTrend.toFixed(1) + ' (6h)', weight: 8 }); }
  }

  // Recent surgery / admission
  if (context.recentSurgery) { score += 8; factors.push({ feature: 'جراحی < ۷۲h', weight: 8 }); }
  if (context.recentAdmission24h) { score += 5; factors.push({ feature: 'پذیرش < ۲۴h', weight: 5 }); }

  // Invasive devices
  if (context.hasCentralLine) { score += 6; factors.push({ feature: 'Central Line', weight: 6 }); }
  if (context.hasUrinaryCatheter) { score += 4; factors.push({ feature: 'Foley', weight: 4 }); }
  if (context.ventilated) { score += 8; factors.push({ feature: 'Ventilator', weight: 8 }); }

  // Already on broad antibiotics (for non-sepsis reasons)
  if (context.onAntibiotics) { score -= 5; factors.push({ feature: 'درمان با آنتی‌بیوتیک', weight: -5 }); }

  // If already flagged as sepsis, cap at 100 and note
  if (context.alreadySepsis) {
    factors.push({ feature: 'Already sepsis-flagged', weight: 0 });
    score = Math.max(score, 70);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 65 ? 'critical' : score >= 40 ? 'high' : score >= 20 ? 'moderate' : 'low';

  return {
    score, level, factors,
    window: '6-hour',
    recommendation:
      score >= 65 ? 'شروع Sepsis Screen فوری + کشت + لاکتات + اطلاع پزشک' :
      score >= 40 ? 'غربالگری ساعتی + پایش دقیق NEWS2 + درخواست لاکتات' :
      score >= 20 ? 'پایش بیشتر + بررسی کانون عفونت' :
      'پایش روتین',
    generatedAt: new Date().toISOString()
  };
}

function sepsisRiskHandler(ctx) {
  const pid = ctx.params.patientId;
  const patient = store.get('patients', pid);
  if (!patient) throw ctx.E.notFound('patient_not_found');
  const vitals = h(ctx, 'vitals').filter(v => v.patientId === pid).sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
  const labs = h(ctx, 'labs').filter(l => l.patientId === pid).sort((a, b) => sd(b.orderedAt) - sd(a.orderedAt));
  const mar = h(ctx, 'mar').filter(m => m.patientId === pid);
  const sepsisActive = h(ctx, 'sepsis').some(s => s.patientId === pid && ['suspected','confirmed','septic_shock'].includes(s.status));

  const lastWbc = labs.find(l => l.results && l.results.WBC);
  const wbc = lastWbc ? Number(lastWbc.results.WBC) : null;
  const lastLactate = labs.find(l => l.results && (l.results.Lactate || l.results['Lactate']));
  const lactate = lastLactate ? Number(lastLactate.results.Lactate || lastLactate.results['Lactate']) : null;

  // WBC trend 6h
  const sixHoursAgo = Date.now() - 6 * 3600000;
  const pastLabs = labs.filter(l => l.results && l.results.WBC && sd(l.orderedAt) < sixHoursAgo);
  const priorWbc = pastLabs.length > 0 ? Number(pastLabs[0].results.WBC) : null;
  const wbcTrend = (wbc != null && priorWbc != null) ? (wbc - priorWbc) : null;

  // Recent surgery
  const recentSurgery = h(ctx, 'or_schedule').some(x => x.patientId === pid &&
    ['in_progress','completed'].includes(x.status) &&
    sd(x.actualStart || x.actualEnd) > Date.now() - 72 * 3600000);
  const recentAdmission24h = patient.admittedAt && sd(patient.admittedAt) > Date.now() - 24 * 3600000;
  const hasCentralLine = mar.some(m => (m.drugName || '').toLowerCase().includes('central') || (m.route || '').toLowerCase().includes('central'));
  const hasUrinaryCatheter = h(ctx, 'orders').some(o => (o.details && o.details.note || '').toLowerCase().includes('foley'));
  const ventilated = mar.some(m => (m.drugName || '').toLowerCase().includes('propofol') || (m.drugName || '').toLowerCase().includes('fentanyl') && (m.notes || '').toLowerCase().includes('vent'));
  const onAntibiotics = mar.some(m => ['meropenem','cefepime','piperacillin','vancomycin','ceftriaxone'].some(a => (m.drugName || '').toLowerCase().includes(a)));

  return computeSepsisRisk6h(patient, {
    vitalsHistory: vitals.slice(0, 5),
    wbc, wbcTrend, lactate,
    recentSurgery, recentAdmission24h,
    hasCentralLine, hasUrinaryCatheter, ventilated,
    onAntibiotics, alreadySepsis: sepsisActive
  });
}

// Extend neural
if (neuralMod) {
  neuralMod.sepsisRisk6h = computeSepsisRisk6h;
  console.log('[v3] ✅ Sepsis Risk 6h attached to neural');
}

module.exports = {
  handlers: { labTransit, labReceive, specimenQueue, waitingList, waitTimeStats, autoMorseCalc, sepsisRiskHandler },
  routes: [
    { method:'GET', path:'/api/protocols/sepsis-risk/:patientId', handler:'sepsisRiskHandler', perm:'patients.view' }
  ],
  panels: []
};

console.log('[clinical_enhancements_v3] loaded — specimen custody + ED wait timer + morse auto + sepsis predict');
