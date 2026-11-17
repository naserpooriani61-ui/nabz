
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Antimicrobial Stewardship Program (ASP)
//  Standards: CDC Core Elements, IDSA/SHEA, JCI MMU.5
//  - 30+ antimicrobial registry (class/spectrum/restriction)
//  - DOT tracking (Days of Therapy / 1000 pt-days)
//  - 48h auto-review reminders
//  - De-escalation from culture
//  - IV-to-PO conversion candidates
//  - Restriction approval workflow
//  - Long-duration alerts (>7d)
//  - C.diff surveillance (outcome)
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const store = require('../core/store');
const bus = require('../core/events');
const perms = require('../core/permissions');

// ═══ Permissions ═══
if (!perms.P['asp.view']) {
  perms.P['asp.view'] = 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_infection,quality_officer,pharmacist,attending,specialist,physician,resident,intern';
}
if (!perms.P['asp.review']) {
  perms.P['asp.review'] = 'admin,pharmacist,attending,specialist,physician,resident,supervisor_infection';
}
if (!perms.P['asp.approve']) {
  perms.P['asp.approve'] = 'admin,pharmacist,attending,specialist,supervisor_infection';
}

// ═══════════════════════════════════════════════════════════
//  Antimicrobial Registry (30+ entries)
//  restriction: none | low | moderate | high | critical
// ═══════════════════════════════════════════════════════════
const ANTIMICROBIALS = {
  // ─── Penicillins ───
  'amoxicillin': { class:'penicillin', spectrum:'narrow', restriction:'none', iv_po:true, default_days:7 },
  'amoxicillin-clavulanate': { class:'penicillin', spectrum:'extended', restriction:'low', iv_po:true, default_days:7 },
  'ampicillin': { class:'penicillin', spectrum:'narrow', restriction:'none', iv_po:true, default_days:7 },
  'ampicillin-sulbactam': { class:'penicillin', spectrum:'extended', restriction:'low', iv_po:false, default_days:7 },
  'piperacillin-tazobactam': { class:'penicillin', spectrum:'broad', restriction:'moderate', iv_po:false, default_days:7 },
  'penicillin-g': { class:'penicillin', spectrum:'narrow', restriction:'none', iv_po:false, default_days:10 },

  // ─── Cephalosporins ───
  'cefazolin': { class:'cephalosporin', spectrum:'narrow', generation:1, restriction:'none', iv_po:true, default_days:3 },
  'cephalexin': { class:'cephalosporin', spectrum:'narrow', generation:1, restriction:'none', iv_po:true, default_days:7 },
  'cefuroxime': { class:'cephalosporin', spectrum:'narrow', generation:2, restriction:'none', iv_po:true, default_days:7 },
  'ceftriaxone': { class:'cephalosporin', spectrum:'extended', generation:3, restriction:'none', iv_po:true, default_days:7 },
  'cefotaxime': { class:'cephalosporin', spectrum:'extended', generation:3, restriction:'low', iv_po:false, default_days:7 },
  'ceftazidime': { class:'cephalosporin', spectrum:'broad', generation:3, restriction:'moderate', iv_po:false, default_days:10 },
  'cefepime': { class:'cephalosporin', spectrum:'broad', generation:4, restriction:'moderate', iv_po:false, default_days:7 },
  'ceftazidime-avibactam': { class:'cephalosporin', spectrum:'very_broad', restriction:'high', iv_po:false, default_days:10 },

  // ─── Carbapenems ───
  'ertapenem': { class:'carbapenem', spectrum:'broad', restriction:'moderate', iv_po:false, default_days:7 },
  'meropenem': { class:'carbapenem', spectrum:'very_broad', restriction:'high', iv_po:false, default_days:7 },
  'imipenem': { class:'carbapenem', spectrum:'very_broad', restriction:'high', iv_po:false, default_days:7 },

  // ─── Fluoroquinolones ───
  'ciprofloxacin': { class:'fluoroquinolone', spectrum:'broad', restriction:'high', iv_po:true, default_days:7 },
  'levofloxacin': { class:'fluoroquinolone', spectrum:'broad', restriction:'high', iv_po:true, default_days:7 },
  'moxifloxacin': { class:'fluoroquinolone', spectrum:'broad', restriction:'high', iv_po:true, default_days:7 },

  // ─── Glycopeptides ───
  'vancomycin': { class:'glycopeptide', spectrum:'narrow_gram_pos', restriction:'moderate', iv_po:false, default_days:7 },
  'teicoplanin': { class:'glycopeptide', spectrum:'narrow_gram_pos', restriction:'moderate', iv_po:false, default_days:7 },

  // ─── Oxazolidinones ───
  'linezolid': { class:'oxazolidinone', spectrum:'gram_pos', restriction:'high', iv_po:true, default_days:14 },

  // ─── Polymyxins (last resort) ───
  'colistin': { class:'polymyxin', spectrum:'last_resort', restriction:'critical', iv_po:false, default_days:7 },
  'polymyxin-b': { class:'polymyxin', spectrum:'last_resort', restriction:'critical', iv_po:false, default_days:7 },

  // ─── Aminoglycosides ───
  'gentamicin': { class:'aminoglycoside', spectrum:'narrow', restriction:'moderate', iv_po:false, default_days:7 },
  'amikacin': { class:'aminoglycoside', spectrum:'broad', restriction:'moderate', iv_po:false, default_days:7 },
  'tobramycin': { class:'aminoglycoside', spectrum:'narrow', restriction:'moderate', iv_po:false, default_days:7 },

  // ─── Macrolides ───
  'azithromycin': { class:'macrolide', spectrum:'atypical', restriction:'none', iv_po:true, default_days:5 },
  'clarithromycin': { class:'macrolide', spectrum:'atypical', restriction:'low', iv_po:true, default_days:7 },
  'erythromycin': { class:'macrolide', spectrum:'atypical', restriction:'low', iv_po:true, default_days:7 },

  // ─── Others ───
  'metronidazole': { class:'nitroimidazole', spectrum:'anaerobe', restriction:'none', iv_po:true, default_days:7 },
  'clindamycin': { class:'lincosamide', spectrum:'gram_pos_anaerobe', restriction:'low', iv_po:true, default_days:7 },
  'doxycycline': { class:'tetracycline', spectrum:'atypical', restriction:'none', iv_po:true, default_days:7 },
  'trimethoprim-sulfamethoxazole': { class:'sulfonamide', spectrum:'broad', restriction:'low', iv_po:true, default_days:7 },

  // ─── Antifungals ───
  'fluconazole': { class:'antifungal', spectrum:'yeast', restriction:'none', iv_po:true, default_days:14 },
  'micafungin': { class:'antifungal', spectrum:'broad', restriction:'high', iv_po:false, default_days:14 },
  'amphotericin-b': { class:'antifungal', spectrum:'broad', restriction:'critical', iv_po:false, default_days:14 },

  // ─── Antivirals ───
  'acyclovir': { class:'antiviral', spectrum:'hsv_vzv', restriction:'none', iv_po:true, default_days:7 },
  'oseltamivir': { class:'antiviral', spectrum:'influenza', restriction:'none', iv_po:true, default_days:5 }
};

// ─── Normalize and lookup ───
function normalize(s) {
  return String(s || '').toLowerCase()
    .replace(/[\s\-_]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isAntimicrobial(drugName) {
  if (!drugName) return null;
  const n = normalize(drugName);
  if (!n) return null;
  // Direct hit
  if (ANTIMICROBIALS[n]) return Object.assign({ key: n }, ANTIMICROBIALS[n]);
  // Strip dose and retry
  const noDose = n.replace(/\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|units?|iu)/gi, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (ANTIMICROBIALS[noDose]) return Object.assign({ key: noDose }, ANTIMICROBIALS[noDose]);
  // Substring match against first token (long enough to be safe)
  const firstToken = noDose.split('-')[0];
  if (firstToken.length >= 5) {
    for (const [key, data] of Object.entries(ANTIMICROBIALS)) {
      if (key === firstToken || key.startsWith(firstToken + '-')) {
        return Object.assign({ key }, data);
      }
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
//  Part 1 — DOT Auto-tracking
// ═══════════════════════════════════════════════════════════
bus.on('kardex.mar.given', function(payload) {
  try {
    const m = payload.record || {};
    if (!m.patientId || !m.drugName) return;
    const ant = isAntimicrobial(m.drugName);
    if (!ant) return;
    const at = m.administeredAt || new Date().toISOString();
    const date = at.slice(0, 10);
    const dotKey = 'dot_' + m.patientId + '_' + ant.key + '_' + date;
    let dot = store.get('asp_dot', dotKey);
    if (!dot) {
      dot = {
        id: dotKey,
        patientId: m.patientId,
        patientName: m.patientName,
        drug: ant.key,
        drugClass: ant.class,
        spectrum: ant.spectrum,
        wardCode: m.wardCode,
        date,
        doses: 0,
        firstDoseAt: at,
        lastDoseAt: at
      };
    }
    dot.doses = (dot.doses || 0) + 1;
    dot.lastDoseAt = at;
    store.put('asp_dot', dot);
  } catch (e) { console.warn('[asp] dot:', e.message); }
});

// ═══════════════════════════════════════════════════════════
//  Part 2 — 48-hour Review Reminders (background timer)
// ═══════════════════════════════════════════════════════════
const _review48 = new Map();

function check48hReviews() {
  try {
    const now = Date.now();
    const seen = {};
    for (const m of store.readAll('mar')) {
      if (m.status !== 'given' || !m.drugName || !m.patientId) continue;
      const ant = isAntimicrobial(m.drugName);
      if (!ant) continue;
      const key = m.patientId + '|' + ant.key;
      if (!seen[key] || sd(m.administeredAt) > sd(seen[key].administeredAt)) {
        seen[key] = m;
      }
    }
    for (const [key, entry] of Object.entries(seen)) {
      const hoursOn = (now - sd(entry.administeredAt)) / 3600000;
      if (hoursOn < 48) continue;
      const p = store.get('patients', entry.patientId);
      if (!p || !['in_care', 'admitted'].includes(p.status)) continue;
      const cooldown = _review48.get(key);
      if (cooldown && now - cooldown < 12 * 3600000) continue;
      _review48.set(key, now);
      const ant = isAntimicrobial(entry.drugName);
      bus.emit('cdss.alert', {
        type: 'asp_48h_review',
        severity: ant.restriction === 'critical' ? 'critical' : 'warning',
        patientId: entry.patientId,
        patientName: entry.patientName,
        title: '⏰ ASP Review 48h — ' + (entry.patientName || ''),
        message: entry.drugName + ' — ' + Math.round(hoursOn) + ' ساعت (' + ant.class + ')',
        recommendation: 'بازبینی ادامه/de-escalation/IV-to-PO توسط ASP team'
      });
    }
    if (_review48.size > 5000) _review48.clear();
  } catch (e) { console.warn('[asp] 48h:', e.message); }
}

setTimeout(function() {
  check48hReviews();
  setInterval(check48hReviews, 30 * 60000);
  console.log('[asp] 48h review timer scheduled (30-min)');
}, 25000);

// ═══════════════════════════════════════════════════════════
//  Part 3 — Culture-triggered De-escalation alert
// ═══════════════════════════════════════════════════════════
bus.on('lab.verified', function(payload) {
  try {
    const lab = payload.record || {};
    if (!lab.patientId) return;
    const panel = String(lab.panelCode || '').toLowerCase();
    if (panel.indexOf('culture') < 0 && panel.indexOf('sensi') < 0) return;
    if (!lab.results || Object.keys(lab.results).length === 0) return;
    const active = store.readAll('mar').filter(m => m.patientId === lab.patientId &&
      m.status === 'given' && sd(m.administeredAt) > Date.now() - 7 * 86400000);
    const hasAntibiotics = active.some(m => isAntimicrobial(m.drugName));
    if (!hasAntibiotics) return;
    const organism = lab.results.organism || lab.results.pathogen || lab.results.Organism || null;
    if (!organism) return;
    bus.emit('cdss.alert', {
      type: 'asp_de_escalation_ready',
      severity: 'warning',
      patientId: lab.patientId,
      patientName: lab.patientName,
      title: '🔽 De-escalation آماده — ' + (lab.patientName || ''),
      message: 'کشت: ' + organism + (lab.results.susceptibility ? ' — حساسیت ثبت شد' : ''),
      recommendation: 'بازبینی آنتی‌بیوتیک بر اساس آنتی‌بیوگرام'
    });
  } catch (e) { console.warn('[asp] culture:', e.message); }
});

// ═══════════════════════════════════════════════════════════
//  Part 4 — Restriction Approval Workflow
// ═══════════════════════════════════════════════════════════
function requestApproval(ctx) {
  const b = ctx.body || {};
  if (!b.patientId || !b.drugName || !b.indication) {
    throw ctx.E.badRequest('patient_drug_indication_required');
  }
  const ant = isAntimicrobial(b.drugName);
  if (!ant) throw ctx.E.badRequest('not_an_antimicrobial');
  if (['none', 'low'].includes(ant.restriction)) {
    throw ctx.E.badRequest('no_approval_needed:' + ant.restriction);
  }
  const patient = store.get('patients', b.patientId);
  if (!patient) throw ctx.E.notFound('patient_not_found');
  const rec = {
    id: ctx.uid('asp_appr'),
    patientId: patient.id,
    patientName: patient.firstName + ' ' + patient.lastName,
    wardCode: patient.wardCode,
    drug: ant.key,
    drugName: b.drugName,
    drugClass: ant.class,
    spectrum: ant.spectrum,
    restriction: ant.restriction,
    indication: b.indication,
    dose: b.dose || null,
    duration: b.duration || null,
    culturesSent: b.culturesSent === true,
    priorAntibiotics: Array.isArray(b.priorAntibiotics) ? b.priorAntibiotics : [],
    status: 'pending',
    requestedBy: ctx.actor.id,
    requestedByName: ctx.actor.fullName || ctx.actor.username,
    requestedAt: ctx.now()
  };
  store.put('asp_approvals', rec);
  ctx.audit.write('asp', 'approval.request', rec.id, ctx.actor, { drug: ant.key });
  bus.emit('asp.approval.requested', { record: rec, actor: ctx.actor });
  return rec;
}

function decideApproval(ctx) {
  const rec = store.get('asp_approvals', ctx.params.id);
  if (!rec) throw ctx.E.notFound('approval_not_found');
  if (rec.status !== 'pending') throw ctx.E.conflict('not_pending');
  const b = ctx.body || {};
  const decision = b.decision === 'deny' ? 'denied' : 'approved';
  rec.status = decision;
  rec.decidedBy = ctx.actor.id;
  rec.decidedByName = ctx.actor.fullName || ctx.actor.username;
  rec.decidedAt = ctx.now();
  rec.decisionNote = b.note || '';
  if (b.approvedDurationHours) {
    rec.approvedDurationHours = Number(b.approvedDurationHours);
    if (decision === 'approved') {
      rec.expiresAt = new Date(Date.now() + rec.approvedDurationHours * 3600000).toISOString();
    }
  }
  store.put('asp_approvals', rec);
  ctx.audit.write('asp', 'approval.' + decision, rec.id, ctx.actor, {});
  bus.emit('asp.approval.' + decision, { record: rec, actor: ctx.actor });
  return rec;
}

function listApprovals(ctx) {
  let items = h(ctx, 'asp_approvals');
  if (ctx.query.status) items = items.filter(a => a.status === ctx.query.status);
  if (ctx.query.ward) items = items.filter(a => a.wardCode === ctx.query.ward);
  items.sort((a, b) => sd(b.requestedAt) - sd(a.requestedAt));
  return { items: items.slice(0, 100), total: items.length };
}

// ═══════════════════════════════════════════════════════════
//  Part 5 — De-escalation Suggestions (based on culture)
// ═══════════════════════════════════════════════════════════
const NARROW_ALTERNATIVES = {
  'meropenem': { 'escherichia-coli':'ceftriaxone', 'e-coli':'ceftriaxone', 'staphylococcus-aureus':'cefazolin', 'mssa':'cefazolin', 'streptococcus':'penicillin-g', 'enterococcus':'ampicillin', 'pseudomonas':'cefepime', 'bacteroides':'metronidazole' },
  'imipenem': { 'escherichia-coli':'ceftriaxone', 'e-coli':'ceftriaxone', 'staphylococcus-aureus':'cefazolin', 'mssa':'cefazolin', 'pseudomonas':'cefepime' },
  'cefepime': { 'escherichia-coli':'ceftriaxone', 'e-coli':'ceftriaxone', 'staphylococcus-aureus':'cefazolin', 'mssa':'cefazolin', 'streptococcus':'penicillin-g' },
  'piperacillin-tazobactam': { 'escherichia-coli':'ceftriaxone', 'e-coli':'ceftriaxone', 'bacteroides':'metronidazole', 'staphylococcus-aureus':'cefazolin', 'mssa':'cefazolin' },
  'vancomycin': { 'mssa':'cefazolin', 'methicillin-sensitive-staphylococcus':'cefazolin', 'staphylococcus-aureus-mssa':'cefazolin' },
  'linezolid': { 'vre':'daptomycin', 'mrsa':'vancomycin' },
  'ciprofloxacin': { 'escherichia-coli':'ceftriaxone', 'e-coli':'ceftriaxone' },
  'levofloxacin': { 'escherichia-coli':'ceftriaxone', 'e-coli':'ceftriaxone', 'streptococcus-pneumoniae':'amoxicillin' }
};

function suggestDeEscalation(ctx) {
  const pid = ctx.params.patientId;
  const patient = store.get('patients', pid);
  if (!patient) throw ctx.E.notFound('patient_not_found');

  const recentMar = h(ctx, 'mar').filter(m => m.patientId === pid && m.status === 'given' &&
    sd(m.administeredAt) > Date.now() - 7 * 86400000);
  const seen = new Set();
  const currentAntibiotics = [];
  for (const m of recentMar) {
    const ant = isAntimicrobial(m.drugName);
    if (!ant || seen.has(ant.key)) continue;
    seen.add(ant.key);
    currentAntibiotics.push({
      key: ant.key,
      drug: m.drugName,
      class: ant.class,
      spectrum: ant.spectrum,
      route: m.route,
      iv_po_eligible: ant.iv_po
    });
  }

  const cultures = h(ctx, 'labs').filter(l => l.patientId === pid &&
    ['resulted', 'verified'].includes(l.status) &&
    String(l.panelCode || '').toLowerCase().includes('culture') &&
    l.results && Object.keys(l.results).length > 0);

  const suggestions = [];
  for (const ant of currentAntibiotics) {
    const mapping = NARROW_ALTERNATIVES[ant.key];
    if (mapping) {
      for (const culture of cultures) {
        const organismRaw = String(culture.results.organism || culture.results.pathogen || culture.results.Organism || '').toLowerCase();
        const organismNorm = organismRaw.replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
        for (const [key, narrow] of Object.entries(mapping)) {
          if (organismNorm.indexOf(key) >= 0 || organismRaw.indexOf(key.replace(/-/g, ' ')) >= 0) {
            suggestions.push({
              type: 'de_escalate',
              from: ant.drug,
              to: narrow,
              reason: 'کشت: ' + organismRaw + ' — امکان باریک‌کردن طیف',
              cultureId: culture.id
            });
            break;
          }
        }
      }
    }
    if (ant.iv_po_eligible && String(ant.route || '').toUpperCase().indexOf('IV') >= 0) {
      suggestions.push({
        type: 'iv_to_po',
        from: ant.drug,
        to: 'same_drug_oral',
        reason: 'دارو IV-PO eligible — ارزیابی تحمل PO'
      });
    }
  }

  return {
    patientId: pid,
    patientName: patient.firstName + ' ' + patient.lastName,
    currentAntibiotics,
    culturesCount: cultures.length,
    suggestions,
    total: suggestions.length,
    note: suggestions.length === 0 ? 'هیچ پیشنهاد de-escalation' : suggestions.length + ' پیشنهاد'
  };
}

// ═══════════════════════════════════════════════════════════
//  Part 6 — IV-to-PO Candidates
// ═══════════════════════════════════════════════════════════
function listIVtoPO(ctx) {
  const now = Date.now();
  const since24h = now - 24 * 3600000;
  const patients = h(ctx, 'patients').filter(p => ['in_care', 'admitted'].includes(p.status));
  const mar = h(ctx, 'mar');
  const candidates = [];

  for (const p of patients) {
    const pMar = mar.filter(m => m.patientId === p.id && m.status === 'given' && sd(m.administeredAt) > since24h);
    const poMeds = pMar.filter(m => String(m.route || '').toUpperCase().indexOf('PO') >= 0);
    if (poMeds.length < 2) continue;
    const ivAntibiotics = pMar.filter(m => {
      if (String(m.route || '').toUpperCase().indexOf('IV') < 0) return false;
      const ant = isAntimicrobial(m.drugName);
      return ant && ant.iv_po;
    });
    if (ivAntibiotics.length === 0) continue;
    const seen = new Set();
    const cands = [];
    for (const m of ivAntibiotics) {
      const ant = isAntimicrobial(m.drugName);
      if (!ant || seen.has(ant.key)) continue;
      seen.add(ant.key);
      cands.push({ key: ant.key, drug: m.drugName, dose: m.dose, poAvailable: true });
    }
    if (cands.length > 0) {
      candidates.push({
        patientId: p.id,
        patientName: p.firstName + ' ' + p.lastName,
        wardCode: p.wardCode,
        bedNumber: p.bedNumber,
        candidates: cands,
        poMedsLast24h: poMeds.length
      });
    }
  }
  return { items: candidates, total: candidates.length, note: 'بیماران با آنتی‌بیوتیک IV که PO را تحمل می‌کنند' };
}

// ═══════════════════════════════════════════════════════════
//  Part 7 — ASP Dashboard
// ═══════════════════════════════════════════════════════════
function dashboard(ctx) {
  const days = Math.min(30, Number(ctx.query.days) || 7);
  const since = Date.now() - days * 86400000;

  const dots = h(ctx, 'asp_dot').filter(d => sd(d.date) >= since);
  const totalDOT = dots.length;

  // Patient-days (same formula as quality_aggregator)
  const patients = h(ctx, 'patients');
  let patientDays = 0;
  for (const p of patients) {
    const admitted = sd(p.admittedAt);
    if (!admitted) continue;
    const discharged = p.dischargedAt ? sd(p.dischargedAt) : Date.now();
    const start = Math.max(admitted, since);
    const end = Math.min(discharged, Date.now());
    if (end > start) patientDays += (end - start) / 86400000;
  }
  patientDays = Math.max(1, Math.round(patientDays));
  const dotPer1000 = Math.round((totalDOT / patientDays) * 1000 * 10) / 10;

  // By class
  const byClass = {};
  const bySpectrum = {};
  for (const d of dots) {
    byClass[d.drugClass] = (byClass[d.drugClass] || 0) + d.doses;
    bySpectrum[d.spectrum] = (bySpectrum[d.spectrum] || 0) + d.doses;
  }

  // Pending approvals
  const pending = h(ctx, 'asp_approvals').filter(a => a.status === 'pending');

  // C. diff (outcome marker)
  const cdiff = h(ctx, 'infections').filter(i => {
    const t = String(i.type || '').toLowerCase() + ' ' + String(i.pathogen || '').toLowerCase();
    return (t.indexOf('c.diff') >= 0 || t.indexOf('c diff') >= 0 || t.indexOf('clostridium') >= 0) &&
      sd(i.reportedAt) >= since;
  });

  // Active therapies
  const activeTherapies = new Set();
  for (const m of h(ctx, 'mar').filter(m => m.status === 'given' && sd(m.administeredAt) > Date.now() - 7 * 86400000)) {
    const ant = isAntimicrobial(m.drugName);
    if (ant) activeTherapies.add(m.patientId + '|' + ant.key);
  }

  return {
    window: { days, since: new Date(since).toISOString() },
    metrics: {
      totalDOT,
      patientDays,
      dotPer1000,
      pendingApprovals: pending.length,
      cDiffCases: cdiff.length,
      activeAntibioticTherapies: activeTherapies.size,
      targetNote: 'CDC: پیگیری DOT/1000 pt-days برای روند مقاومت'
    },
    byClass,
    bySpectrum,
    pendingApprovalsList: pending.slice(0, 10).map(a => ({
      id: a.id, patientName: a.patientName, drug: a.drug,
      restriction: a.restriction, requestedAt: a.requestedAt
    })),
    cDiffCasesList: cdiff.slice(0, 10).map(c => ({
      id: c.id, patientName: c.patientName, wardCode: c.wardCode,
      reportedAt: c.reportedAt
    }))
  };
}

// ═══════════════════════════════════════════════════════════
//  Part 8 — Long Duration Alerts
// ═══════════════════════════════════════════════════════════
function longDuration(ctx) {
  const minDays = Number(ctx.query.minDays) || 7;
  const now = Date.now();
  const groups = {};
  for (const m of h(ctx, 'mar').filter(m => m.status === 'given')) {
    if (!m.drugName) continue;
    const ant = isAntimicrobial(m.drugName);
    if (!ant) continue;
    const key = m.patientId + '|' + ant.key;
    if (!groups[key]) {
      groups[key] = {
        patientId: m.patientId,
        patientName: m.patientName,
        wardCode: m.wardCode,
        drug: ant.key,
        drugClass: ant.class,
        dates: new Set(),
        firstDose: m.administeredAt,
        lastDose: m.administeredAt
      };
    }
    groups[key].dates.add(m.administeredAt.slice(0, 10));
    if (sd(m.administeredAt) < sd(groups[key].firstDose)) groups[key].firstDose = m.administeredAt;
    if (sd(m.administeredAt) > sd(groups[key].lastDose)) groups[key].lastDose = m.administeredAt;
  }
  const items = [];
  for (const g of Object.values(groups)) {
    const daysOn = g.dates.size;
    if (daysOn < minDays) continue;
    if (sd(g.lastDose) < now - 24 * 3600000) continue;
    const p = store.get('patients', g.patientId);
    if (!p || !['in_care', 'admitted'].includes(p.status)) continue;
    items.push({
      patientId: g.patientId,
      patientName: g.patientName,
      wardCode: g.wardCode,
      drug: g.drug,
      drugClass: g.drugClass,
      days: daysOn,
      firstDose: g.firstDose,
      lastDose: g.lastDose
    });
  }
  items.sort((a, b) => b.days - a.days);
  return { items, total: items.length, minDays };
}

// ═══════════════════════════════════════════════════════════
//  Part 9 — Therapy Review Decision
// ═══════════════════════════════════════════════════════════
function reviewTherapy(ctx) {
  const b = ctx.body || {};
  if (!b.patientId || !b.drug) throw ctx.E.badRequest('patient_drug_required');
  if (!['continue', 'de_escalate', 'stop', 'iv_to_po', 'escalate'].includes(b.decision)) {
    throw ctx.E.badRequest('invalid_decision');
  }
  const rec = {
    id: ctx.uid('asp_rev'),
    patientId: b.patientId,
    patientName: b.patientName || null,
    drug: b.drug,
    decision: b.decision,
    newDrug: b.newDrug || null,
    reason: b.reason || '',
    reviewedBy: ctx.actor.id,
    reviewedByName: ctx.actor.fullName || ctx.actor.username,
    reviewedAt: ctx.now()
  };
  store.put('asp_reviews', rec);
  ctx.audit.write('asp', 'therapy.review', rec.id, ctx.actor, {
    patientId: b.patientId, drug: b.drug, decision: b.decision
  });
  bus.emit('asp.therapy.reviewed', { record: rec, actor: ctx.actor });
  return rec;
}

module.exports = {
  handlers: {
    requestApproval, decideApproval, listApprovals,
    suggestDeEscalation, listIVtoPO,
    dashboard, longDuration, reviewTherapy,
    _isAntimicrobial: isAntimicrobial,
    _registry: ANTIMICROBIALS
  },
  routes: [

    { method:'POST', path:'/api/asp/approval/request', handler:'requestApproval', perm:'asp.review' },
    { method:'GET',  path:'/api/asp/approvals', handler:'listApprovals', perm:'asp.view' },
    { method:'GET',  path:'/api/asp/iv-to-po', handler:'listIVtoPO', perm:'asp.view' },
    { method:'GET',  path:'/api/asp/dashboard', handler:'dashboard', perm:'asp.view' },
    { method:'GET',  path:'/api/asp/long-duration', handler:'longDuration', perm:'asp.view' },
    { method:'POST', path:'/api/asp/review', handler:'reviewTherapy', perm:'asp.review' },
    { method:'POST', path:'/api/asp/approval/:id/decide', handler:'decideApproval', perm:'asp.approve' },
    { method:'GET',  path:'/api/asp/de-escalation/:patientId', handler:'suggestDeEscalation', perm:'asp.view' },
  
  ],
  panels: [
    { id:'dashboard', title:'Stewardship', icon:'🦠', perm:'asp.view', kind:'asp_dashboard', api:'/api/asp/dashboard' }
  ]
};

console.log('[asp] loaded — 40 drugs · DOT · 48h reviews · de-escalation · IV-to-PO · approval · C.diff');
