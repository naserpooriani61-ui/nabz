'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Nursing Console (bulletproof load)
// ═══════════════════════════════════════════════════════════
let STORE, BUS, PERMS, SIG, MODH;
try {
  MODH = require('../core/mod-helpers');
  STORE = require('../core/store');
  BUS = require('../core/events');
  PERMS = require('../core/permissions');
  SIG = require('../core/signature');
} catch (e) {
  console.error('[nursing-console] ❌ require failed:', e.message);
  module.exports = { handlers: {}, routes: [], panels: [] };
  return;
}

try {
  if (!PERMS.P['nc.view']) {
    PERMS.P['nc.view'] = 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,supervisor_er,head_nurse,attending,specialist,resident,intern,physician,nurse,nurse_aide,assistant_nurse,quality_officer';
    PERMS.P['nc.action'] = 'admin,nurse,nurse_aide,assistant_nurse,head_nurse,resident,intern,attending,specialist,physician';
    PERMS.P['nc.narcotic'] = 'admin,nurse,head_nurse,attending,specialist,physician';
  }
} catch (e) { console.error('[nursing-console] perms:', e.message); }

function H(coll) { try { const r = STORE.readAll(coll); return Array.isArray(r) ? r : []; } catch (_) { return []; } }
function SD(x) { if (!x) return 0; const d = new Date(x); return isNaN(d.getTime()) ? 0 : d.getTime(); }

function sign(ctx, coll, rec, action) {
  try {
    if (!SIG || typeof SIG.signAction !== 'function') return;
    const s = SIG.signAction({ userId: ctx.actor.id, userName: ctx.actor.username, role: ctx.actor.role, action, collection: coll, recordId: rec.id, data: rec });
    if (s && s.id) { STORE.put('signatures', s); rec.lastSignatureId = s.id; }
  } catch (e) { console.warn('[nursing-console] sign:', e.message); }
}

function getPatientConsole(ctx) {
  const pid = ctx.params.id;
  const p = STORE.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const now = Date.now();

  const vitals = H('vitals').filter(v => v.patientId === pid).sort((a, b) => SD(b.recordedAt) - SD(a.recordedAt));
  const orders = H('orders').filter(o => o.patientId === pid);
  const mar = H('mar').filter(m => m.patientId === pid).sort((a, b) => SD(a.scheduledAt) - SD(b.scheduledAt));
  const labs = H('labs').filter(l => l.patientId === pid).sort((a, b) => SD(b.orderedAt) - SD(a.orderedAt));
  const rads = H('radiology').filter(r => r.patientId === pid).sort((a, b) => SD(b.orderedAt) - SD(a.orderedAt));
  const consults = H('consults').filter(c => c.patientId === pid).sort((a, b) => SD(b.requestedAt) - SD(a.requestedAt));
  const io = H('io_records').filter(r => r.patientId === pid).sort((a, b) => SD(b.recordedAt) - SD(a.recordedAt));
  const notes = H('nursing_notes').filter(n => n.patientId === pid).sort((a, b) => SD(b.at) - SD(a.at));
  const ivs = H('iv_sites').filter(i => i.patientId === pid && i.status === 'active');
  const wounds = H('wounds').filter(w => w.patientId === pid && w.status === 'active');
  const ventLogs = H('ventilator_logs').filter(v => v.patientId === pid).sort((a, b) => SD(b.at) - SD(a.at));
  const narcotics = mar.filter(m => m.isNarcotic && m.status === 'given' && !m.narcoticSigned);
  const assessments = H('cdss_scores').filter(s => s.patientId === pid);
  const encounters = H('encounters').filter(e => e.patientId === pid && e.type === 'round').sort((a, b) => SD(b.createdAt) - SD(a.createdAt));
  const sepsisArr = H('sepsis').filter(s => s.patientId === pid && ['suspected','confirmed','septic_shock'].includes(s.status));
  const sepsis = sepsisArr[0] || null;
  const isolation = H('isolations').find(i => i.patientId === pid && i.status === 'active') || null;
  const ncp = H('nursing_care_plans').find(n => n.patientId === pid && n.status === 'active') || null;
  const restraint = H('restraint_events').find(r => r.patientId === pid && r.status === 'active') || null;

  const lastV = vitals[0] || null;
  let trend = null;
  if (vitals.length >= 2 && lastV) {
    const last3 = vitals.slice(0, 3).filter(v => v.news2 != null);
    if (last3.length >= 2) {
      const first = Number(last3[last3.length - 1].news2) || 0;
      const latest = Number(last3[0].news2) || 0;
      trend = { dir: latest > first ? 'up' : latest < first ? 'down' : 'flat', delta: Math.abs(latest - first), from: first, to: latest };
    }
  }

  const io24 = io.filter(r => SD(r.recordedAt) > now - 86400000);
  const ioIn = io24.filter(r => r.type === 'intake').reduce((s, r) => s + (Number(r.volume) || 0), 0);
  const ioOut = io24.filter(r => r.type === 'output').reduce((s, r) => s + (Number(r.volume) || 0), 0);

  const morse = assessments.filter(a => a.scoreType === 'morse').sort((a, b) => SD(b.computedAt) - SD(a.computedAt))[0];
  const braden = assessments.filter(a => a.scoreType === 'braden').sort((a, b) => SD(b.computedAt) - SD(a.computedAt))[0];
  const painAgeHrs = lastV && lastV.pain != null ? Math.round((now - SD(lastV.recordedAt)) / 3600000) : null;

  const kardex = {
    medication: orders.filter(o => o.type === 'medication' && ['pending','verified','active'].includes(o.status)),
    iv_fluids: orders.filter(o => (o.route === 'IV' || (o.details && o.details.route === 'IV')) && ['pending','verified','active'].includes(o.status)),
    prn: orders.filter(o => o.details && o.details.prn && ['verified','active'].includes(o.status)),
    narcotic: orders.filter(o => o.isNarcotic && ['verified','active'].includes(o.status)),
    procedure: orders.filter(o => o.type === 'procedure' && ['pending','verified','active'].includes(o.status)),
    nursing: orders.filter(o => o.type === 'nursing' && ['pending','verified','active'].includes(o.status)),
    diet: orders.filter(o => o.type === 'diet' && ['verified','active'].includes(o.status)),
    activity: orders.filter(o => o.type === 'activity' && ['verified','active'].includes(o.status)),
    lab: orders.filter(o => o.type === 'lab' && ['pending'].includes(o.status)),
    imaging: orders.filter(o => o.type === 'paraclinical' && ['pending'].includes(o.status)),
    consult: consults.filter(c => c.status === 'requested'),
    held: orders.filter(o => o.status === 'held')
  };

  const marSummary = {
    due_1h: mar.filter(m => ['scheduled','due'].includes(m.status) && SD(m.scheduledAt) < now + 3600000 && SD(m.scheduledAt) > now - 60000),
    overdue: mar.filter(m => ['scheduled','due'].includes(m.status) && SD(m.scheduledAt) < now - 30*60000 && SD(m.scheduledAt) > now - 6*3600000),
    missed_24h: mar.filter(m => m.status === 'missed' && SD(m.scheduledAt) > now - 86400000),
    prn_pending: mar.filter(m => m.status === 'given' && m.prnEffectivenessPending)
  };

  const critLabs = labs.filter(l => l.criticalFlags && l.criticalFlags.length && ['resulted','verified'].includes(l.status) && (!l.acknowledgment || !l.acknowledgment.acknowledged));

  const flags = [];
  if ((p.allergies || []).length) flags.push({ type:'allergy', severity:'critical', icon:'⚠️', text:p.allergies.join('، ') });
  if (p.codeStatus && p.codeStatus !== 'full') flags.push({ type:'code', severity:'critical', icon:'🚫', text:p.codeStatus.toUpperCase() });
  if (sepsis) flags.push({ type:'sepsis', severity:'critical', icon:'🦠', text:'سپسیس' });
  if (isolation) flags.push({ type:'isolation', severity:'high', icon:'🧼', text:isolation.type });
  if (restraint) flags.push({ type:'restraint', severity:'critical', icon:'🔒', text:'محدودیت' });
  if (morse && morse.score >= 45) flags.push({ type:'fall', severity:'high', icon:'🚶', text:'Morse ' + morse.score });
  if (braden && braden.score <= 12) flags.push({ type:'pressure', severity:'high', icon:'🛏', text:'Braden ' + braden.score });

  return {
    patient: { id:p.id, mrn:p.mrn, name:p.firstName+' '+p.lastName, age:p.age, sex:p.sex, ward:p.wardCode, bed:p.bedNumber, diagnosis:p.diagnosis, comorbidities:p.comorbidities||[], allergies:p.allergies||[], codeStatus:p.codeStatus, admittedAt:p.admittedAt },
    flags,
    vitals: { last: lastV, history: vitals.slice(0, 20), trend, ageMin: lastV ? Math.round((now - SD(lastV.recordedAt)) / 60000) : null },
    io: { last24h_in: ioIn, last24h_out: ioOut, net: ioIn - ioOut, recent: io.slice(0, 10) },
    sepsis, isolation,
    ncp: ncp ? { id:ncp.id, activeDiagnoses:(ncp.diagnoses||[]).filter(d=>d.status==='active').length } : null,
    restraint, morse, braden, painAgeHrs,
    kardex, mar: mar.slice(0, 30), marSummary, critLabs,
    ivs: ivs.map(i => ({ id:i.id, site:i.site, gauge:i.gauge, fluid:i.fluid, rate:i.rate, rateUnit:i.rateUnit||'mL/h', startedAt:i.startedAt, startedByName:i.startedByName, nextCheckDueAt:i.nextCheckDueAt })),
    wounds: wounds.map(w => ({ id:w.id, location:w.location, stage:w.stage, size:w.size, drainage:w.drainage, lastDressingAt:w.lastDressingAt, nextDressingDueAt:w.nextDressingDueAt })),
    ventilator: ventLogs[0] || null,
    narcotics: narcotics.map(m => ({ id:m.id, drugName:m.drugName, dose:m.dose, administeredAt:m.administeredAt, administeredByName:m.administeredByName })),
    labs: labs.slice(0, 10), rads: rads.slice(0, 5),
    consults: consults.slice(0, 5), rounds: encounters.slice(0, 5),
    notes: notes.slice(0, 15),
    orders_pending: 0,
    generatedAt: ctx.now()
  };
}

function kardexAction(ctx) {
  const id = ctx.params.id, oid = ctx.params.oid, action = ctx.params.action;
  const o = STORE.get('orders', oid);
  if (!o) throw ctx.E.notFound('order_not_found');
  if (o.patientId !== id) throw ctx.E.badRequest('patient_mismatch');
  if (['execute','hold','resume','cancel','discontinue'].indexOf(action) < 0) throw ctx.E.badRequest('invalid_action');
  const now = ctx.now();
  if (action === 'execute') { o.status='completed'; o.executedAt=now; o.executedBy=ctx.actor.id; o.executedByName=ctx.actor.fullName||ctx.actor.username; o.executionNote=(ctx.body&&ctx.body.note)||''; }
  else if (action === 'hold') { if (['verified','active'].indexOf(o.status)<0) throw ctx.E.conflict('cannot_hold'); o.status='held'; o.heldAt=now; o.heldBy=ctx.actor.id; o.holdReason=(ctx.body&&ctx.body.reason)||'no reason'; }
  else if (action === 'resume') { if (o.status!=='held') throw ctx.E.conflict('not_held'); o.status='active'; o.resumedAt=now; o.resumedBy=ctx.actor.id; }
  else if (action === 'cancel') { o.status='cancelled'; o.cancelledAt=now; o.cancelledBy=ctx.actor.id; o.cancelReason=(ctx.body&&ctx.body.reason)||''; }
  else if (action === 'discontinue') { o.status='discontinued'; o.discontinuedAt=now; o.discontinuedBy=ctx.actor.id; o.discontinueReason=(ctx.body&&ctx.body.reason)||''; }
  STORE.put('orders', o);
  sign(ctx, 'orders', o, action);
  ctx.audit.write('nursing_console', 'kardex.'+action, o.id, ctx.actor, { patientId:id });
  BUS.emit('kardex.order.'+action, { record:o, actor:ctx.actor });
  return o;
}

function ivStart(ctx) {
  const pid = ctx.params.id;
  const p = STORE.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const b = ctx.body || {};
  if (!b.site) throw ctx.E.badRequest('site_required');
  const now = Date.now();
  const rec = { id: ctx.uid('iv'), patientId:pid, patientName:p.firstName+' '+p.lastName, wardCode:p.wardCode, site:b.site, gauge:b.gauge||'20G', fluid:b.fluid||'NS 0.9%', rate:Number(b.rate)||100, rateUnit:b.rateUnit||'mL/h', startedAt:ctx.now(), startedBy:ctx.actor.id, startedByName:ctx.actor.fullName||ctx.actor.username, lastCheckAt:ctx.now(), nextCheckDueAt:new Date(now+4*3600000).toISOString(), status:'active', checks:[], rateChanges:[], pumpSerial:b.pumpSerial||null };
  STORE.put('iv_sites', rec);
  sign(ctx, 'iv_sites', rec, 'start');
  BUS.emit('iv.started', { record:rec, actor:ctx.actor });
  return rec;
}

function ivRateChange(ctx) {
  const iv = STORE.get('iv_sites', ctx.params.ivId);
  if (!iv) throw ctx.E.notFound('iv_not_found');
  if (iv.status !== 'active') throw ctx.E.conflict('iv_not_active');
  const b = ctx.body || {};
  const newRate = Number(b.rate);
  if (!newRate || newRate < 0 || newRate > 9999) throw ctx.E.badRequest('invalid_rate');
  if (!b.reason) throw ctx.E.badRequest('reason_required');
  iv.rateChanges = iv.rateChanges || [];
  iv.rateChanges.push({ at:ctx.now(), by:ctx.actor.id, byName:ctx.actor.fullName||ctx.actor.username, fromRate:iv.rate, toRate:newRate, reason:String(b.reason).slice(0,300) });
  iv.rate = newRate;
  STORE.put('iv_sites', iv);
  BUS.emit('iv.rate_changed', { record:iv, actor:ctx.actor });
  return iv;
}

function ivSiteCheck(ctx) {
  const iv = STORE.get('iv_sites', ctx.params.ivId);
  if (!iv) throw ctx.E.notFound('iv_not_found');
  if (iv.status !== 'active') throw ctx.E.conflict('iv_not_active');
  const b = ctx.body || {};
  const finding = b.finding || 'intact';
  if (['intact','redness','swelling','pain','infiltration','phlebitis','dislodged'].indexOf(finding) < 0) throw ctx.E.badRequest('invalid_finding');
  const now = Date.now();
  iv.checks = iv.checks || [];
  iv.checks.push({ at:ctx.now(), by:ctx.actor.id, byName:ctx.actor.fullName||ctx.actor.username, finding, notes:String(b.notes||'').slice(0,300) });
  iv.lastCheckAt = ctx.now();
  iv.nextCheckDueAt = new Date(now+4*3600000).toISOString();
  if (['infiltration','phlebitis','dislodged'].indexOf(finding)>=0) { iv.status='discontinued'; iv.discontinuedAt=ctx.now(); iv.discontinuedReason='complication:'+finding; }
  STORE.put('iv_sites', iv);
  return iv;
}

function ivDiscontinue(ctx) {
  const iv = STORE.get('iv_sites', ctx.params.ivId);
  if (!iv) throw ctx.E.notFound('iv_not_found');
  if (iv.status !== 'active') throw ctx.E.conflict('not_active');
  iv.status = 'discontinued';
  iv.discontinuedAt = ctx.now();
  iv.discontinuedBy = ctx.actor.id;
  iv.discontinuedReason = (ctx.body && ctx.body.reason) || 'completed';
  STORE.put('iv_sites', iv);
  BUS.emit('iv.discontinued', { record:iv, actor:ctx.actor });
  return iv;
}

function woundAdd(ctx) {
  const pid = ctx.params.id;
  const p = STORE.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const b = ctx.body || {};
  if (!b.location) throw ctx.E.badRequest('location_required');
  if (!b.stage) throw ctx.E.badRequest('stage_required');
  const now = Date.now();
  const interval = Number(b.dressingChangeInterval) || 24;
  const rec = { id:ctx.uid('wnd'), patientId:pid, patientName:p.firstName+' '+p.lastName, wardCode:p.wardCode, location:b.location, stage:String(b.stage), size:b.size||'', depth:b.depth||'', drainage:b.drainage||'none', tissue:b.tissue||'granulation', infectionSigns:b.infectionSigns===true, painScore:Number(b.painScore)||0, dressingType:b.dressingType||'transparent', dressingChangeInterval:interval, lastDressingAt:ctx.now(), nextDressingDueAt:new Date(now+interval*3600000).toISOString(), status:'active', createdBy:ctx.actor.id, createdByName:ctx.actor.fullName||ctx.actor.username, changes:[], createdAt:ctx.now() };
  STORE.put('wounds', rec);
  BUS.emit('wound.added', { record:rec, actor:ctx.actor });
  return rec;
}

function woundDressingChange(ctx) {
  const w = STORE.get('wounds', ctx.params.wId);
  if (!w) throw ctx.E.notFound('wound_not_found');
  if (w.status !== 'active') throw ctx.E.conflict('wound_not_active');
  const b = ctx.body || {};
  const now = Date.now();
  w.changes = w.changes || [];
  w.changes.push({ at:ctx.now(), by:ctx.actor.id, byName:ctx.actor.fullName||ctx.actor.username, findings:String(b.findings||'').slice(0,500), size:b.size||w.size, drainage:b.drainage||w.drainage, tissue:b.tissue||w.tissue, dressingUsed:b.dressingUsed||w.dressingType });
  w.lastDressingAt = ctx.now();
  w.nextDressingDueAt = new Date(now + w.dressingChangeInterval*3600000).toISOString();
  if (b.size) w.size = b.size;
  if (b.drainage) w.drainage = b.drainage;
  if (b.tissue) w.tissue = b.tissue;
  STORE.put('wounds', w);
  BUS.emit('wound.dressing_changed', { record:w, actor:ctx.actor });
  return w;
}

function ventSettings(ctx) {
  const pid = ctx.params.id;
  const p = STORE.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const b = ctx.body || {};
  const rec = { id:ctx.uid('vent'), patientId:pid, patientName:p.firstName+' '+p.lastName, wardCode:p.wardCode, mode:b.mode||'AC/VC', fio2:Number(b.fio2)||40, peep:Number(b.peep)||5, tidalVolume:Number(b.tidalVolume)||450, rate:Number(b.rate)||14, peakPressure:b.peakPressure!=null?Number(b.peakPressure):null, plateauPressure:b.plateauPressure!=null?Number(b.plateauPressure):null, spo2:b.spo2!=null?Number(b.spo2):null, etco2:b.etco2!=null?Number(b.etco2):null, rass:b.rass!=null?Number(b.rass):null, vapBundle:{ hob30:b.vapBundle&&b.vapBundle.hob30===true, oralCare:b.vapBundle&&b.vapBundle.oralCare===true, sedationVacation:b.vapBundle&&b.vapBundle.sedationVacation===true, dvtProphylaxis:b.vapBundle&&b.vapBundle.dvtProphylaxis===true, pudProphylaxis:b.vapBundle&&b.vapBundle.pudProphylaxis===true }, weaningReady:b.weaningReady===true, notes:String(b.notes||'').slice(0,300), at:ctx.now(), by:ctx.actor.id, byName:ctx.actor.fullName||ctx.actor.username };
  STORE.put('ventilator_logs', rec);
  BUS.emit('vent.settings_logged', { record:rec, actor:ctx.actor });
  return rec;
}

function narcoticSign(ctx) {
  const pid = ctx.params.id, mid = ctx.params.mid;
  const m = STORE.get('mar', mid);
  if (!m) throw ctx.E.notFound('mar_not_found');
  if (m.patientId !== pid) throw ctx.E.badRequest('patient_mismatch');
  if (m.status !== 'given') throw ctx.E.conflict('not_given');
  const b = ctx.body || {};
  if (!b.witnessedBy) throw ctx.E.badRequest('witness_required');
  if (b.witnessedBy === ctx.actor.id || b.witnessedBy === ctx.actor.username) throw ctx.E.badRequest('witness_must_differ');
  const witness = H('users').find(u => (u.id === b.witnessedBy || u.username === b.witnessedBy) && u.active !== false);
  if (!witness) throw ctx.E.badRequest('witness_not_valid');
  m.narcoticSigned = true;
  m.narcoticSignedAt = ctx.now();
  m.narcoticSignedBy = ctx.actor.id;
  m.narcoticSignedByName = ctx.actor.fullName || ctx.actor.username;
  m.narcoticWitnessId = witness.id;
  m.narcoticWitnessName = witness.fullName || witness.username;
  m.narcoticWasted = Number(b.wasted) || 0;
  m.narcoticWastedReason = String(b.wasteReason || '').slice(0,300);
  STORE.put('mar', m);
  BUS.emit('narcotic.signed', { record:m, actor:ctx.actor });
  return m;
}

function addAssessment(ctx) {
  const pid = ctx.params.id;
  const p = STORE.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const b = ctx.body || {};
  const type = b.type;
  const now = Date.now();
  if (['morse','braden','pain','gcs','comprehensive'].indexOf(type) < 0) throw ctx.E.badRequest('invalid_assessment_type');
  if (type === 'morse') {
    let score = 0;
    if (b.historyOfFalling) score += 25;
    if (b.secondaryDiagnosis) score += 15;
    if (b.ambulatoryAid === 'furniture') score += 30; else if (b.ambulatoryAid === 'crutch_cane_walker') score += 15;
    if (b.ivOrHeparinLock) score += 20;
    if (b.gait === 'impaired') score += 10; else if (b.gait === 'weak') score += 20;
    if (b.mentalStatus === 'overestimates') score += 15;
    const level = score >= 45 ? 'high' : score >= 25 ? 'moderate' : 'low';
    const rec = { id:'morse_'+pid+'_'+now, patientId:pid, scoreType:'morse', score, level, input:b, computedAt:ctx.now(), computedBy:ctx.actor.id };
    STORE.put('cdss_scores', rec);
    if (level === 'high') BUS.emit('cdss.alert', { type:'fall_risk_high', severity:'critical', patientId:pid, patientName:p.firstName+' '+p.lastName, title:'🚶 سقوط — خطر بالا', message:'Morse '+score, recommendation:'اقدامات پیشگیری' });
    return rec;
  }
  if (type === 'braden') {
    const s = (Number(b.sensory)||4)+(Number(b.moisture)||4)+(Number(b.activity)||4)+(Number(b.mobility)||4)+(Number(b.nutrition)||4)+(Number(b.friction)||3);
    const level = s<=9?'very_high':s<=12?'high':s<=14?'moderate':s<=18?'mild':'none';
    const rec = { id:'braden_'+pid+'_'+now, patientId:pid, scoreType:'braden', score:s, level, input:b, computedAt:ctx.now(), computedBy:ctx.actor.id };
    STORE.put('cdss_scores', rec);
    return rec;
  }
  if (type === 'pain') {
    const score = Number(b.score) || 0;
    const vit = { id:ctx.uid('vit'), patientId:pid, patientName:p.firstName+' '+p.lastName, wardCode:p.wardCode, bedNumber:p.bedNumber, recordedAt:ctx.now(), recordedBy:ctx.actor.id, pain:score, notes:'Pain assessment' };
    STORE.put('vitals', vit);
    BUS.emit('vitals.recorded', { record:vit, actor:ctx.actor });
    return vit;
  }
  const rec = { id:ctx.uid('nn'), patientId:pid, patientName:p.firstName+' '+p.lastName, wardCode:p.wardCode, bedNumber:p.bedNumber, text:'Comprehensive: '+JSON.stringify(b).slice(0,1000), category:'comprehensive_assessment', shiftCode:'current', at:ctx.now(), by:ctx.actor.id, byName:ctx.actor.fullName||ctx.actor.username };
  STORE.put('nursing_notes', rec);
  return rec;
}

function addNote(ctx) {
  const pid = ctx.params.id;
  const p = STORE.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const b = ctx.body || {};
  if (!b.text || String(b.text).trim().length < 3) throw ctx.E.badRequest('text_too_short');
  const rec = { id:ctx.uid('nn'), patientId:pid, patientName:p.firstName+' '+p.lastName, wardCode:p.wardCode, bedNumber:p.bedNumber, text:String(b.text).slice(0,2000), category:b.category||'observation', shiftCode:'current', at:ctx.now(), by:ctx.actor.id, byName:ctx.actor.fullName||ctx.actor.username };
  STORE.put('nursing_notes', rec);
  BUS.emit('nursing.note.recorded', { record:rec, actor:ctx.actor });
  return rec;
}

// ─── HEALTH PROBE ───
function healthCheck(ctx) {
  return { ok: true, module: 'nursing_console', version: '3.0', ts: ctx.now() };
}

module.exports = {
  handlers: {
    healthCheck, getPatientConsole,
    kardexAction, ivStart, ivRateChange, ivSiteCheck, ivDiscontinue,
    woundAdd, woundDressingChange, ventSettings, narcoticSign,
    addAssessment, addNote
  },
  routes: [
    { method:'GET',  path:'/api/nursing/console/_health', handler:'healthCheck', perm:null },
    { method:'GET',  path:'/api/nursing/console/:id', handler:'getPatientConsole', perm:'nc.view' },
    { method:'POST', path:'/api/nursing/console/:id/kardex/:oid/:action', handler:'kardexAction', perm:'nc.action' },
    { method:'POST', path:'/api/nursing/console/:id/iv', handler:'ivStart', perm:'nc.action' },
    { method:'POST', path:'/api/nursing/console/:id/iv/:ivId/rate', handler:'ivRateChange', perm:'nc.action' },
    { method:'POST', path:'/api/nursing/console/:id/iv/:ivId/check', handler:'ivSiteCheck', perm:'nc.action' },
    { method:'POST', path:'/api/nursing/console/:id/iv/:ivId/discontinue', handler:'ivDiscontinue', perm:'nc.action' },
    { method:'POST', path:'/api/nursing/console/:id/wound', handler:'woundAdd', perm:'nc.action' },
    { method:'POST', path:'/api/nursing/console/:id/wound/:wId/dressing', handler:'woundDressingChange', perm:'nc.action' },
    { method:'POST', path:'/api/nursing/console/:id/ventilator', handler:'ventSettings', perm:'nc.action' },
    { method:'POST', path:'/api/nursing/console/:id/narcotic/:mid/sign', handler:'narcoticSign', perm:'nc.narcotic' },
    { method:'POST', path:'/api/nursing/console/:id/assessment', handler:'addAssessment', perm:'nc.action' },
    { method:'POST', path:'/api/nursing/console/:id/note', handler:'addNote', perm:'nc.action' }
  ],
  panels: []
};
console.log('[nursing-console] loaded — 13 routes (health probe at /_health)');
