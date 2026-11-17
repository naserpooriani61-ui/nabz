'use strict';
// core/domain/ed-board.js — تابلوی ردیابی، خط زمانی و آمار اورژانس (فقط خواندن)
const esi = require('./ed-esi');
const news2 = require('./news2');
const W = require('./ed-visit-writer');

function _all(ctx, c) { try { const r = (ctx.store || require('../store')).readAll(c); return Array.isArray(r) ? r : []; } catch (_) { return []; } }
function _ms(x) { if (!x) return null; const t = Date.parse(x); return isFinite(t) ? t : null; }
function _diffMin(a, b) { const x = _ms(a), y = _ms(b); return (x == null || y == null || y < x) ? null : Math.round((y - x) / 60000); }
function _pct(arr, p) { if (!arr.length) return null; const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; }
function _bc(C) { return Object.assign({ doorToTriageTargetMin: 10, boardingAlertMin: 240 }, C.board || {}); }

function _newsOf(lv) {
  const x = lv && lv.vitals;
  if (!x) return null;
  if (lv.source === 'vitals' && x.news2 != null) return { total: Number(x.news2), risk: x.newsLevel || null };
  const has = ['hr', 'rr', 'spo2', 'temp', 'gcs', 'bp_sys', 'sbp'].some(k => x[k] != null) || !!x.consciousness;
  if (!has) return null;
  const c = news2.calc({ hr: x.hr, rr: x.rr, spo2: x.spo2, temp: x.temp, onOxygen: x.onOxygen,
    consciousness: x.consciousness, bp_sys: x.bp_sys != null ? x.bp_sys : x.sbp });
  return { total: c.total, risk: c.risk };
}

function getBoard(ctx) {
  const C = esi.getConfig(), BC = _bc(C);
  const now = Date.now();
  const vitalsAll = _all(ctx, 'vitals');
  const rows = _all(ctx, 'ed_visits')
    .filter(v => W.TERMINAL.indexOf(v.status || 'waiting_triage') === -1)
    .map(v => {
      const status = v.status || 'waiting_triage';
      const level = (v.esiLevel != null && v.esiLevel !== '') ? Number(v.esiLevel) : null;
      const arrival = _ms(v.arrivalAt);
      const since = _ms(v.statusSince) || _ms(v.triagedAt) || arrival;
      const sinceArrival = arrival == null ? null : Math.round((now - arrival) / 60000);
      const inStatus = since == null ? null : Math.round((now - since) / 60000);
      const lv = W.latestVitals(ctx, v, vitalsAll);
      const n2 = _newsOf(lv);
      const flags = [];
      let sla = null;
      if (status === 'waiting_triage') {
        sla = { kind: 'door_to_triage', targetMin: BC.doorToTriageTargetMin, minutes: sinceArrival,
          breach: sinceArrival != null && sinceArrival > BC.doorToTriageTargetMin };
        const s = esi.suggest({ age: v.age, ageMonths: v.ageMonths, vitals: lv.vitals || {} });
        if (s.criticalFlags.length) flags.push('critical_vitals_untriaged');
      } else if ((status === 'waiting_doctor' || status === 'waiting_bed') && level != null) {
        const target = C.esi.maxWaitMin[String(level)];
        sla = { kind: 'door_to_provider', targetMin: target, minutes: sinceArrival,
          breach: target === 0 ? true : (sinceArrival != null && sinceArrival > target) };
        const due = _ms(v.nextReassessAt);
        if (due != null && now > due) flags.push('reassess_due');
      }
      if (sla && sla.breach) flags.push('sla_breach');
      if (status === 'boarding' && inStatus != null && inStatus > BC.boardingAlertMin) flags.push('boarding_long');
      if (v.needsCosign && !v.cosignedAt) flags.push('cosign_pending');
      if (n2 && (n2.risk === 'high' || n2.risk === 'critical')) flags.push('news2_high');
      if (!v.patientId) flags.push('unlinked_patient');
      return { id: v.id, patientId: v.patientId || null, patientName: v.patientName, age: v.age, sex: v.sex,
        esiLevel: level, status: status, chiefComplaint: v.chiefComplaint, arrivalAt: v.arrivalAt,
        minutesSinceArrival: sinceArrival, minutesInStatus: inStatus, news2: n2, vitalsSource: lv.source,
        sla: sla, nextReassessAt: v.nextReassessAt || null, destination: v.destination || null,
        dispositionType: v.dispositionType || null, flags: flags };
    });
  const rank = r => r.flags.indexOf('critical_vitals_untriaged') !== -1 ? 0 : (r.esiLevel != null ? r.esiLevel : 3.5);
  rows.sort((a, b) => (rank(a) - rank(b))
    || ((b.sla && b.sla.breach ? 1 : 0) - (a.sla && a.sla.breach ? 1 : 0))
    || ((_ms(a.arrivalAt) || 0) - (_ms(b.arrivalAt) || 0)));
  const byStatus = {}, byEsi = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let breaches = 0, reassessDue = 0, cosignPending = 0, unlinked = 0, boardingLongest = 0;
  rows.forEach(r => {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    if (r.esiLevel >= 1 && r.esiLevel <= 5) byEsi[r.esiLevel]++;
    if (r.flags.indexOf('sla_breach') !== -1) breaches++;
    if (r.flags.indexOf('reassess_due') !== -1) reassessDue++;
    if (r.flags.indexOf('cosign_pending') !== -1) cosignPending++;
    if (r.flags.indexOf('unlinked_patient') !== -1) unlinked++;
    if (r.status === 'boarding' && r.minutesInStatus != null && r.minutesInStatus > boardingLongest) boardingLongest = r.minutesInStatus;
  });
  return { generatedAt: new Date(now).toISOString(), thresholds: { board: BC, maxWaitMin: C.esi.maxWaitMin },
    counts: { active: rows.length, byStatus: byStatus, byEsi: byEsi, untriaged: byStatus.waiting_triage || 0,
      slaBreaches: breaches, reassessDue: reassessDue, cosignPending: cosignPending, unlinked: unlinked,
      boarding: byStatus.boarding || 0, boardingLongestMin: boardingLongest }, rows: rows };
}

function getTimeline(ctx, id) {
  const v = (ctx.store || require('../store')).get('ed_visits', id);
  if (!v) {
    if (ctx.E && typeof ctx.E.notFound === 'function') throw ctx.E.notFound('visit_not_found');
    throw Object.assign(new Error('visit_not_found'), { code: 'visit_not_found' });
  }
  return { id: v.id, status: v.status, esiLevel: v.esiLevel != null ? Number(v.esiLevel) : null,
    milestones: { arrivalAt: v.arrivalAt || null, triagedAt: v.triagedAt || null, seenAt: v.seenAt || null,
      dispositionAt: v.dispositionAt || null, departedAt: v.departedAt || null },
    intervals: { doorToTriageMin: _diffMin(v.arrivalAt, v.triagedAt), doorToProviderMin: _diffMin(v.arrivalAt, v.seenAt),
      seenToDispositionMin: _diffMin(v.seenAt, v.dispositionAt), dispositionToDepartureMin: _diffMin(v.dispositionAt, v.departedAt),
      losMin: _diffMin(v.arrivalAt, v.departedAt) },
    esiHistory: v.esiHistory || [], triage: v.triage || null, transitions: v._trans || [] };
}

function getStats(ctx, days) {
  const d = Number(days) > 0 ? Number(days) : 1;
  const now = Date.now(), since = now - d * 86400000;
  const all = _all(ctx, 'ed_visits');
  const active = all.filter(v => W.TERMINAL.indexOf(v.status || 'waiting_triage') === -1);
  const inPeriod = all.filter(v => (_ms(v.arrivalAt) || 0) >= since);
  const level = v => (v.esiLevel != null && v.esiLevel !== '') ? Number(v.esiLevel) : null;
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  active.forEach(v => { const l = level(v); if (l >= 1 && l <= 5) dist[l]++; });
  const d2t = inPeriod.map(v => _diffMin(v.arrivalAt, v.triagedAt)).filter(x => x != null);
  const d2p = inPeriod.map(v => _diffMin(v.arrivalAt, v.seenAt)).filter(x => x != null);
  const los = inPeriod.map(v => _diffMin(v.arrivalAt, v.departedAt)).filter(x => x != null);
  const lwbs = inPeriod.filter(v => v.status === 'lwbs').length;
  const boardingMins = active.filter(v => v.status === 'boarding').map(v => Math.round((now - (_ms(v.statusSince) || now)) / 60000));
  return {
    today: all.filter(v => (_ms(v.arrivalAt) || 0) > now - 86400000).length,
    active: active.length,
    waiting: active.filter(v => W.WAITING.indexOf(v.status || 'waiting_triage') !== -1).length,
    untriaged: active.filter(v => (v.status || 'waiting_triage') === 'waiting_triage').length,
    boarding: active.filter(v => v.status === 'boarding').length,
    critical: active.filter(v => { const l = level(v); return l != null && l <= 2; }).length,
    esiDist: dist,
    codesActive: _all(ctx, 'ed_codes').filter(c => c.status === 'active').length,
    mciActive: _all(ctx, 'ed_mci').filter(m => m.status === 'active').length,
    periodDays: d, visitsInPeriod: inPeriod.length, lwbsInPeriod: lwbs,
    lwbsRatePct: inPeriod.length ? Math.round(lwbs / inPeriod.length * 1000) / 10 : 0,
    doorToTriageMedian: _pct(d2t, 0.5), doorToTriageP90: _pct(d2t, 0.9),
    doorToProviderMedian: _pct(d2p, 0.5), doorToProviderP90: _pct(d2p, 0.9),
    losMedian: _pct(los, 0.5), losP90: _pct(los, 0.9),
    boardingLongestMin: boardingMins.length ? Math.max.apply(null, boardingMins) : 0
  };
}

module.exports = { getBoard, getTimeline, getStats };
