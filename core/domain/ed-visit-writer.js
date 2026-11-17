'use strict';
// core/domain/ed-visit-writer.js
// تنها مسیر مجاز نوشتن ویزیت اورژانس (collection: ed_visits) — همان الگوی writerهای دیگر.
const esi = require('./ed-esi');

const TERMINAL = ['discharged', 'admitted', 'transferred', 'lwbs', 'lama', 'absconded', 'deceased', 'closed'];
const WAITING = ['waiting_triage', 'waiting_doctor', 'waiting_bed'];
const ACTIONS = ['see', 'wait_bed', 'bed_ready', 'observe', 'resume',
  'disposition_admit', 'disposition_discharge', 'disposition_transfer',
  'depart_admitted', 'depart_discharged', 'depart_transferred',
  'leave_unseen', 'leave_ama', 'abscond', 'declare_death'];
const VITAL_KEYS = ['hr', 'bp_sys', 'bp_dia', 'spo2', 'rr', 'temp', 'gcs', 'pain'];

function _store(ctx) { return ctx.store || require('../store'); }
function _bus(ctx) { return ctx.bus || require('../events'); }
function _sm() { return require('../state-machine'); }
function _perms() { return require('../permissions'); }
function _now(ctx) { return (ctx && typeof ctx.now === 'function') ? ctx.now() : new Date().toISOString(); }
function _uid(ctx, p) { return (typeof ctx.uid === 'function') ? ctx.uid(p) : _store(ctx).uid(p); }
function _err(ctx, kind, code) {
  if (ctx && ctx.E && typeof ctx.E[kind] === 'function') return ctx.E[kind](code);
  return Object.assign(new Error(code), { code: code, kind: kind });
}
function _emit(ctx, event, payload) { try { _bus(ctx).emit(event, payload); } catch (_) { /* خطای شنونده نباید نوشتن را بشکند */ } }
function _all(ctx, c) { try { const r = _store(ctx).readAll(c); return Array.isArray(r) ? r : []; } catch (_) { return []; } }
function _isoPlus(iso, min) { return new Date(Date.parse(iso) + min * 60000).toISOString(); }
function toBool(x) {
  if (x === true || x === 'true' || x === 1 || x === '1') return true;
  if (x === false || x === 'false' || x === 0 || x === '0') return false;
  return undefined;
}
function _sign(ctx, rec, action, opts) {
  if (opts && opts.sign === false) return;
  const signature = require('../signature');
  const a = ctx.actor || {};
  const sig = signature.signAction({ userId: a.id, userName: a.username, role: a.role, action: action, collection: 'ed_visits', recordId: rec.id, data: rec });
  _store(ctx).put('signatures', sig);
  rec.lastSignatureId = sig.id;
}

// علائم حیاتی: کلیدهای شناخته‌شده عددی و اعتبارسنجی می‌شوند؛ بقیهٔ مقادیر ساده بدون حذف حفظ می‌شوند
function normVitals(ctx, raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') throw _err(ctx, 'badRequest', 'invalid_vitals');
  const src = Object.assign({}, raw);
  if (src.bp_sys == null && src.sbp != null) src.bp_sys = src.sbp;
  if (src.bp_dia == null && src.dbp != null) src.bp_dia = src.dbp;
  const out = {};
  Object.keys(src).forEach(k => { const x = src[k]; if (x !== null && x !== undefined && x !== '' && typeof x !== 'object') out[k] = x; });
  VITAL_KEYS.forEach(k => {
    if (out[k] === undefined) return;
    const n = Number(out[k]);
    if (!isFinite(n)) throw _err(ctx, 'badRequest', 'invalid_vital_' + k);
    out[k] = n;
  });
  if (out.onOxygen !== undefined) out.onOxygen = out.onOxygen === true || out.onOxygen === 'true';
  return Object.keys(out).length ? out : null;
}

// آخرین علائم: اگر بیمار وصل باشد از ماژول ویتال (با NEWS2 ثبت‌شده)، وگرنه علائم خود ویزیت
function latestVitals(ctx, v, list) {
  if (v && v.patientId) {
    const all = list || _all(ctx, 'vitals');
    let best = null, bt = -1;
    for (const r of all) {
      if (r.patientId !== v.patientId) continue;
      const t = Date.parse(r.recordedAt || r.createdAt || '');
      if (isFinite(t) && t >= bt) { best = r; bt = t; }
    }
    if (best) return { source: 'vitals', at: best.recordedAt || best.createdAt, vitals: best };
  }
  return { source: (v && v.vitals) ? 'visit' : null, at: v ? v.arrivalAt : null, vitals: (v && v.vitals) || null };
}

function register(ctx, raw) {
  const store = _store(ctx);
  const b = raw || {};
  let patient = null;
  if (b.patientId) {
    patient = store.get('patients', b.patientId);
    if (!patient) throw _err(ctx, 'notFound', 'patient_not_found');
  }
  const first = String(b.firstName || '').trim(), last = String(b.lastName || '').trim();
  let name = String(b.patientName || '').trim() || [first, last].filter(Boolean).join(' ');
  if (!name && patient) name = [patient.firstName, patient.lastName].filter(Boolean).join(' ');
  const unknown = b.unknown === true || b.unknown === 'true';
  if (!name && unknown) name = 'ناشناس-' + String(Date.now()).slice(-5);
  const cc = String(b.chiefComplaint || '').trim();
  if (!name || !cc) throw _err(ctx, 'badRequest', 'missing_fields');
  let age = null, ageMonths = null;
  if (b.age !== undefined && b.age !== null && b.age !== '') {
    age = Number(b.age);
    if (!isFinite(age) || age < 0 || age > 130) throw _err(ctx, 'badRequest', 'invalid_age');
  } else if (patient && patient.age != null) { age = Number(patient.age); }
  if (b.ageMonths !== undefined && b.ageMonths !== null && b.ageMonths !== '') {
    ageMonths = Number(b.ageMonths);
    if (!isFinite(ageMonths) || ageMonths < 0 || ageMonths > 1560) throw _err(ctx, 'badRequest', 'invalid_age_months');
  }
  const t = _now(ctx);
  const arrivalAt = b.arrivalAt || t;
  const rec = {
    id: _uid(ctx, 'edv'),
    patientId: patient ? patient.id : null,
    unlinked: !patient,
    unknown: unknown,
    patientName: name, age: age, ageMonths: ageMonths, sex: b.sex || (patient && patient.sex) || null,
    arrivalAt: arrivalAt, arrivalMode: b.arrivalMode || 'walk_in',
    chiefComplaint: cc, vitals: normVitals(ctx, b.vitals),
    esiLevel: null, status: 'waiting_triage', statusSince: arrivalAt,
    registeredBy: (ctx.actor || {}).id || null
  };
  store.put('ed_visits', rec);
  _emit(ctx, 'ed.visit.created', { record: rec, actor: ctx.actor });
  return rec;
}

function triage(ctx, id, body, opts) {
  const store = _store(ctx);
  const v = store.get('ed_visits', id);
  if (!v) throw _err(ctx, 'notFound', 'visit_not_found');
  const b = body || {};
  const chosen = Number(b.esiLevel);
  if (!isFinite(chosen) || chosen < 1 || chosen > 5 || Math.floor(chosen) !== chosen) throw _err(ctx, 'badRequest', 'invalid_esi');
  const vit = normVitals(ctx, b.vitals);
  const lv = latestVitals(ctx, v);
  const answers = {
    lifeSaving: toBool(b.lifeSaving), highRisk: toBool(b.highRisk), confused: toBool(b.confused),
    painScore: (b.painScore !== undefined && b.painScore !== null && b.painScore !== '') ? Number(b.painScore) : null,
    resources: (b.resources !== undefined && b.resources !== null && b.resources !== '') ? Number(b.resources) : null
  };
  const sug = esi.suggest({ age: v.age, ageMonths: v.ageMonths, vitals: vit || lv.vitals || {},
    lifeSaving: answers.lifeSaving, highRisk: answers.highRisk, confused: answers.confused,
    painScore: answers.painScore, resources: answers.resources });
  const cmp = esi.compare(sug, chosen);
  const reason = String(b.overrideReason || '').trim();
  if (cmp.reasonRequired && reason.length < 3) throw _err(ctx, 'badRequest', 'override_reason_required');
  const r = _sm().transition('ed_visit', v, 'triage', ctx.actor, {});
  if (!r.ok) throw _err(ctx, 'conflict', r.reason);
  const t = _now(ctx);
  const rm = esi.getConfig().esi.reassessMin[String(chosen)];
  v.esiLevel = chosen; v.triagedAt = t; v.triagedBy = ctx.actor.id; v.statusSince = t;
  if (vit) v.vitals = vit;
  v.triage = { chosen: chosen, suggested: sug.level, considerLevel: sug.considerLevel, direction: cmp.direction,
    reasons: sug.reasons, warnings: sug.warnings, missing: sug.missing, answers: answers, overrideReason: reason || null };
  v.esiHistory = [{ level: chosen, at: t, by: ctx.actor.id, kind: 'triage', reason: reason || null }];
  v.nextReassessAt = rm > 0 ? _isoPlus(t, rm) : null;
  if (vit && v.patientId) {
    try { require('./vitals-writer').record(ctx, Object.assign({ patientId: v.patientId }, vit), {}); }
    catch (e) { v.vitalsRecordError = String((e && e.message) || e); }
  }
  _sign(ctx, v, 'triage', opts);
  store.put('ed_visits', v);
  _emit(ctx, 'ed.triage.completed', { record: v, actor: ctx.actor });
  if (chosen <= 2) _emit(ctx, 'triage.critical', { record: v, actor: ctx.actor });
  return v;
}

function retriage(ctx, id, body, opts) {
  const store = _store(ctx);
  const v = store.get('ed_visits', id);
  if (!v) throw _err(ctx, 'notFound', 'visit_not_found');
  const role = (ctx.actor || {}).role;
  const P = _perms();
  if (!(P.can(role, 'ed.triage') || P.can(role, 'ed.treat'))) throw _err(ctx, 'forbidden', 'forbidden_retriage');
  const st = v.status || 'waiting_triage';
  if (st === 'waiting_triage') throw _err(ctx, 'conflict', 'use_triage_first');
  if (TERMINAL.indexOf(st) !== -1) throw _err(ctx, 'conflict', 'visit_closed');
  const b = body || {};
  const level = Number(b.esiLevel);
  if (!isFinite(level) || level < 1 || level > 5 || Math.floor(level) !== level) throw _err(ctx, 'badRequest', 'invalid_esi');
  const reason = String(b.reason || b.overrideReason || '').trim();
  if (reason.length < 3) throw _err(ctx, 'badRequest', 'reason_required');
  const prev = v.esiLevel != null ? Number(v.esiLevel) : null;
  if (prev === level) throw _err(ctx, 'conflict', 'same_level');
  const t = _now(ctx);
  const rm = esi.getConfig().esi.reassessMin[String(level)];
  v.esiLevel = level;
  v.esiHistory = (v.esiHistory || []).concat([{ level: level, at: t, by: ctx.actor.id, kind: 'retriage', from: prev, reason: reason }]).slice(-20);
  v.nextReassessAt = (WAITING.indexOf(st) !== -1 && rm > 0) ? _isoPlus(t, rm) : null;
  _sign(ctx, v, 'retriage', opts);
  store.put('ed_visits', v);
  _emit(ctx, 'ed.visit.retriaged', { record: v, actor: ctx.actor, from: prev, to: level });
  if (level <= 2 && (prev == null || prev > 2)) _emit(ctx, 'triage.critical', { record: v, actor: ctx.actor });
  return v;
}

function act(ctx, id, action, body, opts) {
  if (ACTIONS.indexOf(action) === -1) throw _err(ctx, 'badRequest', 'invalid_action');
  const store = _store(ctx);
  const v = store.get('ed_visits', id);
  if (!v) throw _err(ctx, 'notFound', 'visit_not_found');
  const b = body || {};
  const C = esi.getConfig();
  const role = (ctx.actor || {}).role;
  const departing = action === 'depart_admitted' || action === 'depart_discharged' || action === 'depart_transferred';
  if (departing && v.needsCosign && !v.cosignedAt && role !== 'attending' && role !== 'admin') throw _err(ctx, 'conflict', 'attending_cosign_required');
  const extras = {};
  ['destination', 'reason', 'note'].forEach(k => { const s = b[k] != null ? String(b[k]).trim() : ''; if (s) extras[k] = s; });
  const prev = v.status || 'waiting_triage';
  const r = _sm().transition('ed_visit', v, action, ctx.actor, extras);
  if (!r.ok) throw _err(ctx, 'conflict', r.reason);
  const t = _now(ctx);
  v.statusSince = t;
  if (action === 'see') {
    if (!v.seenAt) { v.seenAt = t; v.seenBy = ctx.actor.id; }
    v.nextReassessAt = null;
  } else if (action.indexOf('disposition_') === 0) {
    v.dispositionAt = t; v.dispositionBy = ctx.actor.id;
    v.dispositionType = action.slice('disposition_'.length);
    v.destination = extras.destination || null;
    v.dispositionNote = extras.note || null;
    v.needsCosign = !!(C.disposition && C.disposition.requireAttendingCosignForResident) && role === 'resident';
    v.cosignedAt = null; v.cosignedBy = null;
    if (action === 'disposition_admit' && v.patientId && !v.transferId && !(opts && opts.transfer === false)) {
      try {
        const tr = require('./transfer-writer').create(ctx, { patientId: v.patientId, toWard: extras.destination, reason: 'پذیرش از اورژانس: ' + (v.chiefComplaint || '') });
        v.transferId = (tr && tr.id) ? tr.id : null; v.transferError = null;
      } catch (e) { v.transferId = null; v.transferError = String((e && e.message) || e); }
    }
  }
  if (TERMINAL.indexOf(v.status) !== -1) {
    v.departedAt = t; v.departedBy = ctx.actor.id; v.outcome = v.status; v.nextReassessAt = null;
    const why = extras.reason || extras.note;
    if (why) v.outcomeReason = why;
  }
  _sign(ctx, v, action, opts);
  store.put('ed_visits', v);
  const ev = action === 'see' ? 'ed.visit.seen'
    : action.indexOf('disposition_') === 0 ? 'ed.visit.disposition'
    : (TERMINAL.indexOf(v.status) !== -1 ? 'ed.visit.departed' : 'ed.visit.updated');
  _emit(ctx, ev, { record: v, actor: ctx.actor, action: action, from: prev });
  return v;
}

function cosign(ctx, id, opts) {
  const store = _store(ctx);
  const v = store.get('ed_visits', id);
  if (!v) throw _err(ctx, 'notFound', 'visit_not_found');
  if (!_perms().can((ctx.actor || {}).role, 'ed.cosign')) throw _err(ctx, 'forbidden', 'forbidden_cosign');
  if (!v.needsCosign) throw _err(ctx, 'conflict', 'cosign_not_required');
  if (v.cosignedAt) throw _err(ctx, 'conflict', 'already_cosigned');
  v.cosignedAt = _now(ctx); v.cosignedBy = ctx.actor.id;
  _sign(ctx, v, 'cosign', opts);
  store.put('ed_visits', v);
  _emit(ctx, 'ed.visit.cosigned', { record: v, actor: ctx.actor });
  return v;
}

function linkPatient(ctx, id, patientId, opts) {
  const store = _store(ctx);
  const v = store.get('ed_visits', id);
  if (!v) throw _err(ctx, 'notFound', 'visit_not_found');
  const p = patientId ? store.get('patients', patientId) : null;
  if (!p) throw _err(ctx, 'notFound', 'patient_not_found');
  if (v.patientId && v.patientId !== p.id && !(opts && opts.force)) throw _err(ctx, 'conflict', 'already_linked');
  v.patientId = p.id; v.unlinked = false;
  if (!v.patientName) v.patientName = [p.firstName, p.lastName].filter(Boolean).join(' ');
  store.put('ed_visits', v);
  _emit(ctx, 'ed.visit.linked', { record: v, actor: ctx.actor });
  return v;
}

module.exports = { TERMINAL, WAITING, ACTIONS, toBool, normVitals, latestVitals, register, triage, retriage, act, cosign, linkPatient };
