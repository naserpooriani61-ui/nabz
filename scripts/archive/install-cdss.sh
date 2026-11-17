#!/data/data/com.termux/files/usr/bin/bash
# ═══════════════════════════════════════════════════════════
#  NABZ v1.0 — Part 17: Clinical Intelligence Engine (CDSS)
#  Run from project root: bash install-cdss.sh
# ═══════════════════════════════════════════════════════════
set -e

echo "🧠 NABZ Clinical Intelligence — Installer (Part 17)"
echo ""

# ─── 1) Verify project root ───
if [ ! -f "core/server.js" ] || [ ! -d "modules" ] || [ ! -d "public" ]; then
  echo "❌ لطفاً از ریشهٔ پروژه اجرا کنید"
  exit 1
fi

# ─── 2) Backups ───
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="backups/cdss-$STAMP"
mkdir -p "$BACKUP_DIR"
for f in public/app.js public/sw.js public/index.html public/style.css public/offline.js core/permissions-extra.js; do
  [ -f "$f" ] && cp "$f" "$BACKUP_DIR/" 2>/dev/null || true
done
echo "📦 Backups → $BACKUP_DIR"
echo ""

# ═══════════════════════════════════════════════════════════
#  NEW FILE 1 — modules/cdss.js
# ═══════════════════════════════════════════════════════════
cat > modules/cdss.js << 'EOF_CDSS'
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Clinical Decision Support System (Part 17)
//  - 6 evidence-based scoring systems
//  - 35 major drug interactions
//  - 10 renal dose adjustments
//  - Auto-alerts on vitals.recorded & kardex.order.created
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const bus = require('../core/events');
const store = require('../core/store');

// ═══════════════════════════════════════════════════════════════
//  A — Clinical Scoring Systems
// ═══════════════════════════════════════════════════════════════

// qSOFA — Singer et al., JAMA 2016. ≥2 = high risk of poor outcome in suspected infection
function scoreQSOFA(vitals) {
  const v = vitals || {};
  let score = 0;
  const findings = [];
  const rr = Number(v.rr);
  if (rr >= 22) { score++; findings.push('RR >= 22'); }
  const sbp = Number(v.bp_sys);
  if (sbp > 0 && sbp <= 100) { score++; findings.push('SBP <= 100'); }
  const gcs = Number(v.gcs);
  if (gcs > 0 && gcs < 15) { score++; findings.push('GCS < 15'); }
  const level = score >= 2 ? 'high' : score === 1 ? 'moderate' : 'low';
  return {
    score, max: 3, level, findings,
    recommendation: score >= 2
      ? 'ارزیابی فوری سپسیس — کشت خون + لاکتات + آنتی‌بیوتیک وسیع‌الطیف'
      : score === 1 ? 'پایش دقیق‌تر — ارزیابی بالینی' : 'پایش روتین'
  };
}

// Morse Fall Scale — Morse 1989
function scoreMorse(input) {
  const d = input || {};
  let score = 0;
  const items = [];
  const add = (label, points) => { score += points; if (points) items.push(label + ' (+' + points + ')'); };
  add('سابقه سقوط', d.historyOfFalling ? 25 : 0);
  add('تشخیص ثانویه', d.secondaryDiagnosis ? 15 : 0);
  const aid = String(d.ambulatoryAid || 'none');
  add('وسیله کمکی', aid === 'furniture' ? 30 : aid === 'crutch_cane_walker' ? 15 : 0);
  add('سرم/هپارین‌لاک', d.ivOrHeparinLock ? 20 : 0);
  const gait = String(d.gait || 'normal');
  add('راه‌رفتن', gait === 'impaired' ? 10 : gait === 'weak' ? 20 : 0);
  const mental = String(d.mentalStatus || 'oriented');
  add('وضعیت روانی', mental === 'overestimates' ? 15 : 0);
  const level = score >= 45 ? 'high' : score >= 25 ? 'moderate' : 'low';
  return {
    score, max: 125, level, items,
    recommendation: level === 'high'
      ? 'اقدامات پیشگیری سقوط — تخت پایین، دسترسی به زنگ، همراهی، دستبند زرد'
      : level === 'moderate' ? 'پایش هر شیفت + آموزش بیمار'
      : 'پایش روتین'
  };
}

// Braden Scale — Bergstrom 1987. Lower score = higher risk
function scoreBraden(input) {
  const d = input || {};
  const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || hi));
  const sensory   = cl(d.sensoryPerception, 1, 4);
  const moisture  = cl(d.moisture, 1, 4);
  const activity  = cl(d.activity, 1, 4);
  const mobility  = cl(d.mobility, 1, 4);
  const nutrition = cl(d.nutrition, 1, 4);
  const friction  = cl(d.frictionShear, 1, 3);
  const score = sensory + moisture + activity + mobility + nutrition + friction;
  const level = score <= 9 ? 'very_high'
              : score <= 12 ? 'high'
              : score <= 14 ? 'moderate'
              : score <= 18 ? 'mild' : 'none';
  return {
    score, max: 23, level,
    subscales: { sensory, moisture, activity, mobility, nutrition, friction },
    recommendation: (level === 'very_high' || level === 'high')
      ? 'تغییر وضعیت هر ۲ ساعت + سطح تخصصی + ارزیابی تغذیه'
      : level === 'moderate' ? 'تغییر وضعیت هر ۴ ساعت + سطح محافظ'
      : 'پایش روتین'
  };
}

// CURB-65 — Lim et al., Thorax 2003
function scoreCURB65(input) {
  const d = input || {};
  let score = 0;
  const findings = [];
  if (d.confusion) { score++; findings.push('Confusion'); }
  if (Number(d.bun) > 19) { score++; findings.push('BUN > 19'); }
  if (Number(d.rr) >= 30) { score++; findings.push('RR >= 30'); }
  const sbp = Number(d.sbp), dbp = Number(d.dbp);
  if ((sbp > 0 && sbp < 90) || (dbp > 0 && dbp <= 60)) { score++; findings.push('BP low'); }
  if (Number(d.age) >= 65) { score++; findings.push('Age >= 65'); }
  const level = score >= 3 ? 'severe' : score === 2 ? 'moderate' : 'mild';
  return {
    score, max: 5, level, findings,
    recommendation: score >= 3
      ? 'بستری + ارزیابی ICU — آنتی‌بیوتیک وسیع‌الطیف'
      : score === 2 ? 'بستری کوتاه‌مدت + پایش' : 'سرپایی + پیگیری ۴۸ ساعته'
  };
}

// Wells DVT
function scoreWellsDVT(input) {
  const d = input || {};
  let score = 0;
  const items = [];
  const add = (l, p) => { score += p; if (p) items.push(l + ' (' + (p > 0 ? '+' : '') + p + ')'); };
  add('سرطان فعال', d.activeCancer ? 1 : 0);
  add('فلج/پارزی', d.paralysis ? 1 : 0);
  add('بستری/جراحی اخیر', d.recentBedridden ? 1 : 0);
  add('حساسیت در مسیر ورید', d.localizedTenderness ? 1 : 0);
  add('تورم کل اندام', d.entireLegSwollen ? 1 : 0);
  add('اختلاف >3cm در ساق', d.calfSwelling ? 1 : 0);
  add('ادم گوده‌گذار', d.pittingEdema ? 1 : 0);
  add('وریدهای سطحی کولترال', d.collateralVeins ? 1 : 0);
  add('سابقه DVT', d.previousDVT ? 1 : 0);
  add('تشخیص جایگزین', d.alternativeDiagnosis ? -2 : 0);
  const level = score >= 3 ? 'high' : score >= 1 ? 'moderate' : 'low';
  return {
    score, max: 9, level, items,
    recommendation: level === 'high'
      ? 'سونوگرافی داپلر فوری + شروع آنتی‌کوآگولانت'
      : level === 'moderate' ? 'D-dimer + سونوگرافی' : 'D-dimer'
  };
}

// Cockcroft-Gault — 1976
function calcCockcroftGault(input) {
  const d = input || {};
  const age = Number(d.age);
  const weight = Number(d.weightKg);
  const scr = Number(d.creatinineMgDl);
  const female = d.sex === 'female';
  if (!age || !weight || !scr || scr <= 0) {
    return { error: 'invalid_inputs', message: 'سن، وزن، و کراتینین لازم است' };
  }
  let crcl = ((140 - age) * weight) / (72 * scr);
  if (female) crcl *= 0.85;
  crcl = Math.round(crcl * 10) / 10;
  const stage = crcl >= 90 ? 'normal'
              : crcl >= 60 ? 'mild'
              : crcl >= 30 ? 'moderate'
              : crcl >= 15 ? 'severe' : 'failure';
  const ckdStage = crcl >= 90 ? 'G1' : crcl >= 60 ? 'G2' : crcl >= 45 ? 'G3a'
                 : crcl >= 30 ? 'G3b' : crcl >= 15 ? 'G4' : 'G5';
  return { crcl, unit: 'mL/min', stage, ckdStage };
}

// ═══════════════════════════════════════════════════════════════
//  B — Drug Interaction Database (35 pairs)
// ═══════════════════════════════════════════════════════════════
const DRUG_INTERACTIONS = [
  // Anticoagulant / Antiplatelet
  { a:'warfarin', b:'aspirin', severity:'major', effect:'خونریزی شدید', action:'اجتناب — جایگزین کنید یا INR پایش دقیق' },
  { a:'warfarin', b:'amiodarone', severity:'major', effect:'افزایش INR', action:'کاهش دوز warfarin ۳۰-۵۰% + INR' },
  { a:'warfarin', b:'fluconazole', severity:'major', effect:'افزایش INR', action:'کاهش دوز + INR' },
  { a:'warfarin', b:'metronidazole', severity:'major', effect:'افزایش INR', action:'کاهش دوز + INR' },
  { a:'warfarin', b:'trimethoprim', severity:'major', effect:'افزایش INR', action:'INR مکرر' },
  { a:'warfarin', b:'ibuprofen', severity:'major', effect:'خونریزی GI + INR', action:'اجتناب — acetaminophen' },
  { a:'warfarin', b:'naproxen', severity:'major', effect:'خونریزی GI', action:'اجتناب' },
  { a:'clopidogrel', b:'omeprazole', severity:'moderate', effect:'کاهش اثر clopidogrel', action:'pantoprazole جایگزین' },
  { a:'enoxaparin', b:'aspirin', severity:'moderate', effect:'افزایش خونریزی', action:'پایش علائم' },
  // Cardiovascular
  { a:'enalapril', b:'spironolactone', severity:'major', effect:'هیپرکالمی', action:'پایش K+' },
  { a:'lisinopril', b:'spironolactone', severity:'major', effect:'هیپرکالمی', action:'پایش K+' },
  { a:'losartan', b:'spironolactone', severity:'major', effect:'هیپرکالمی', action:'پایش K+' },
  { a:'enalapril', b:'ibuprofen', severity:'major', effect:'AKI + هیپرکالمی', action:'اجتناب' },
  { a:'digoxin', b:'amiodarone', severity:'major', effect:'سمیت digoxin', action:'کاهش دوز ۵۰% + سطح' },
  { a:'digoxin', b:'verapamil', severity:'major', effect:'سمیت digoxin', action:'کاهش دوز + سطح' },
  { a:'digoxin', b:'furosemide', severity:'moderate', effect:'هیپوکالمی → سمیت', action:'پایش K+' },
  // Antimicrobials
  { a:'gentamicin', b:'furosemide', severity:'major', effect:'اتوتوکسیسیتی', action:'اجتناب یا پایش سطح' },
  { a:'gentamicin', b:'vancomycin', severity:'major', effect:'نفروتوکسیسیتی', action:'پایش Cr + سطح' },
  { a:'vancomycin', b:'piperacillin', severity:'moderate', effect:'AKI', action:'پایش Cr روزانه' },
  { a:'ciprofloxacin', b:'warfarin', severity:'major', effect:'INR بالا', action:'INR' },
  { a:'levofloxacin', b:'warfarin', severity:'major', effect:'INR بالا', action:'INR' },
  { a:'ciprofloxacin', b:'prednisone', severity:'moderate', effect:'پارگی تاندون', action:'پایش علائم' },
  // CNS
  { a:'sertraline', b:'tramadol', severity:'major', effect:'سندرم سروتونین', action:'اجتناب' },
  { a:'fluoxetine', b:'tramadol', severity:'major', effect:'سندرم سروتونین', action:'اجتناب' },
  { a:'tramadol', b:'selegiline', severity:'major', effect:'سندرم سروتونین', action:'اجتناب مطلق' },
  { a:'haloperidol', b:'ondansetron', severity:'moderate', effect:'QT طولانی', action:'ECG + پایش' },
  { a:'amiodarone', b:'haloperidol', severity:'major', effect:'QT طولانی', action:'اجتناب — ECG' },
  // Others
  { a:'methotrexate', b:'ibuprofen', severity:'major', effect:'سمیت MTX', action:'اجتناب' },
  { a:'methotrexate', b:'trimethoprim', severity:'major', effect:'سمیت MTX', action:'اجتناب' },
  { a:'lithium', b:'ibuprofen', severity:'major', effect:'سمیت lithium', action:'سطح lithium' },
  { a:'lithium', b:'enalapril', severity:'major', effect:'سمیت lithium', action:'سطح + کاهش دوز' },
  { a:'metformin', b:'contrast', severity:'major', effect:'اسیدوز لاکتیک', action:'قطع ۴۸ ساعت قبل/بعد' },
  { a:'simvastatin', b:'clarithromycin', severity:'major', effect:'رابدومیولیز', action:'قطع simvastatin' },
  { a:'atorvastatin', b:'clarithromycin', severity:'moderate', effect:'رابدومیولیز', action:'کاهش/قطع موقت' },
  { a:'simvastatin', b:'gemfibrozil', severity:'major', effect:'رابدومیولیز', action:'از fenofibrate استفاده کنید' }
];

function normalizeDrug(name) {
  return String(name || '').toLowerCase().trim()
    .replace(/\s+/g, ' ')
    .replace(/^(tab|cap|inj|syr|susp)\s+/, '')
    .replace(/\s+(tab|cap|inj|syr|susp|hcl|sodium|potassium)$/, '');
}

function checkInteractions(drugs) {
  const norm = drugs.map(normalizeDrug).filter(Boolean);
  const found = [];
  for (let i = 0; i < norm.length; i++) {
    for (let j = i + 1; j < norm.length; j++) {
      for (const ix of DRUG_INTERACTIONS) {
        const a = ix.a, b = ix.b;
        const match = (norm[i].includes(a) && norm[j].includes(b)) ||
                      (norm[i].includes(b) && norm[j].includes(a));
        if (match) {
          found.push({
            drug1: drugs[i], drug2: drugs[j],
            severity: ix.severity, effect: ix.effect, action: ix.action
          });
        }
      }
    }
  }
  const seen = new Set();
  return found.filter(f => {
    const k = [normalizeDrug(f.drug1), normalizeDrug(f.drug2)].sort().join('|');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════
//  C — Renal Dosing
// ═══════════════════════════════════════════════════════════════
const RENAL_DOSING = {
  'vancomycin': { normal: '15-20 mg/kg IV q8-12h', byCrCl: [
    { min: 60, max: 999, dose: '15-20 mg/kg q12h', note: '' },
    { min: 30, max: 59,  dose: '15-20 mg/kg q24h', note: 'پایش سطح' },
    { min: 15, max: 29,  dose: '15-20 mg/kg q48h', note: 'پایش سطح' },
    { min: 0,  max: 14,  dose: 'loading سپس بر اساس سطح', note: 'ID consult' }
  ]},
  'gentamicin': { normal: '5-7 mg/kg IV q24h', byCrCl: [
    { min: 60, max: 999, dose: '5-7 mg/kg q24h', note: '' },
    { min: 40, max: 59,  dose: '5-7 mg/kg q36h', note: '' },
    { min: 20, max: 39,  dose: '5-7 mg/kg q48h', note: 'پایش' },
    { min: 0,  max: 19,  dose: 'بر اساس سطح', note: 'ID consult' }
  ]},
  'meropenem': { normal: '1g IV q8h', byCrCl: [
    { min: 50, max: 999, dose: '1g q8h', note: '' },
    { min: 25, max: 49,  dose: '1g q12h', note: '' },
    { min: 10, max: 24,  dose: '500mg q12h', note: '' },
    { min: 0,  max: 9,   dose: '500mg q24h', note: 'بعد از دیالیز' }
  ]},
  'enoxaparin': { normal: '1 mg/kg SC q12h', byCrCl: [
    { min: 30, max: 999, dose: '1 mg/kg q12h', note: '' },
    { min: 0,  max: 29,  dose: '1 mg/kg q24h', note: 'پروفیلاکسی: 30mg q24h' }
  ]},
  'metformin': { normal: '500-1000mg PO BID', byCrCl: [
    { min: 45, max: 999, dose: 'دوز معمول', note: '' },
    { min: 30, max: 44,  dose: 'کاهش دوز', note: 'Cr هر ۳ ماه' },
    { min: 0,  max: 29,  dose: 'منع مصرف', note: 'اسیدوز لاکتیک' }
  ]},
  'digoxin': { normal: '0.125-0.25 mg PO daily', byCrCl: [
    { min: 60, max: 999, dose: '0.25mg daily', note: '' },
    { min: 30, max: 59,  dose: '0.125-0.25mg daily', note: 'سطح' },
    { min: 10, max: 29,  dose: '0.125mg q48h', note: 'دقیق' },
    { min: 0,  max: 9,   dose: '0.0625mg q48h', note: 'دقیق' }
  ]},
  'gabapentin': { normal: '300-600mg PO TID', byCrCl: [
    { min: 60, max: 999, dose: '300-600mg TID', note: '' },
    { min: 30, max: 59,  dose: '200-400mg BID', note: '' },
    { min: 15, max: 29,  dose: '200-300mg daily', note: '' },
    { min: 0,  max: 14,  dose: '100-300mg daily', note: '' }
  ]},
  'levofloxacin': { normal: '500-750mg daily', byCrCl: [
    { min: 50, max: 999, dose: '500-750mg daily', note: '' },
    { min: 20, max: 49,  dose: '250-500mg daily', note: '' },
    { min: 0,  max: 19,  dose: '250mg q48h', note: '' }
  ]},
  'ciprofloxacin': { normal: '400mg IV q12h یا 500mg PO BID', byCrCl: [
    { min: 30, max: 999, dose: 'دوز معمول', note: '' },
    { min: 0,  max: 29,  dose: '400mg q24h یا 500mg PO daily', note: '' }
  ]},
  'amoxicillin': { normal: '500mg PO TID', byCrCl: [
    { min: 30, max: 999, dose: 'دوز معمول', note: '' },
    { min: 10, max: 29,  dose: '500mg BID', note: '' },
    { min: 0,  max: 9,   dose: '500mg daily', note: '' }
  ]}
};

function renalDoseRecommend(crcl, drugName) {
  const key = normalizeDrug(drugName);
  const entry = Object.entries(RENAL_DOSING).find(([k]) => key.indexOf(k) >= 0);
  if (!entry) return { drug: drugName, found: false, message: 'دارو در پایگاه داده نیست' };
  const drug = entry[0], data = entry[1];
  const match = data.byCrCl.find(r => crcl >= r.min && crcl <= r.max);
  return {
    drug, found: true, crcl,
    normal: data.normal,
    recommended: match ? match.dose : 'نامشخص',
    note: match ? match.note : ''
  };
}

// ═══════════════════════════════════════════════════════════════
//  D — Auto-alerts (subscribe to event bus)
// ═══════════════════════════════════════════════════════════════
const _cooldown = new Map();
function _cooldownOk(key, hours) {
  hours = hours || 6;
  const last = _cooldown.get(key);
  const now = Date.now();
  if (last && (now - last) < hours * 3600000) return false;
  _cooldown.set(key, now);
  return true;
}

function _saveAlert(alert) {
  try {
    store.put('cdss_alerts', Object.assign({
      id: store.uid('cdss_alert'),
      createdAt: new Date().toISOString(),
      dismissed: false
    }, alert));
  } catch (e) { console.warn('[cdss] save alert:', e.message); }
}

bus.on('vitals.recorded', function(payload) {
  try {
    const v = payload.record || {};
    if (!v.patientId) return;
    const q = scoreQSOFA(v);
    if (q.score >= 2 && _cooldownOk('qsofa:' + v.patientId, 6)) {
      const alert = {
        type: 'qsofa_high', severity: 'critical',
        patientId: v.patientId, patientName: v.patientName,
        score: q.score,
        title: 'qSOFA بالا — ' + (v.patientName || ''),
        message: 'امتیاز qSOFA = ' + q.score + ' (' + q.findings.join(' + ') + ')',
        recommendation: q.recommendation
      };
      _saveAlert(alert);
      bus.emit('cdss.alert', alert);
    }
  } catch (e) { console.error('[cdss] vitals handler:', e.message); }
});

bus.on('kardex.order.created', function(payload) {
  try {
    const o = payload.record || {};
    if (o.type !== 'medication' || !o.patientId) return;
    const drug = (o.details && o.details.drug) || '';
    if (!drug) return;
    const active = store.readAll('orders')
      .filter(x => x.patientId === o.patientId && x.type === 'medication')
      .filter(x => ['verified', 'active'].indexOf(x.status) >= 0)
      .map(x => (x.details && x.details.drug) || '')
      .filter(Boolean);
    const all = active.concat([drug]);
    const found = checkInteractions(all);
    const major = found.filter(f => f.severity === 'major');
    if (!major.length) return;
    if (!_cooldownOk('interaction:' + o.patientId + ':' + drug, 24)) return;
    const ix = major[0];
    const other = normalizeDrug(ix.drug1) === normalizeDrug(drug) ? ix.drug2 : ix.drug1;
    const alert = {
      type: 'drug_interaction', severity: 'critical',
      patientId: o.patientId, patientName: o.patientName,
      drug, other, count: major.length, interactions: major,
      title: 'تداخل دارویی ماژور — ' + (o.patientName || ''),
      message: drug + ' + ' + other + ' — ' + ix.effect,
      recommendation: ix.action
    };
    _saveAlert(alert);
    bus.emit('cdss.alert', alert);
  } catch (e) { console.error('[cdss] order handler:', e.message); }
});

// ═══════════════════════════════════════════════════════════════
//  E — Handlers
// ═══════════════════════════════════════════════════════════════
function dashboard(ctx) {
  const patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].indexOf(p.status) >= 0);
  const vitals = h(ctx, 'vitals');
  const mar = h(ctx, 'mar');
  const lastVital = {};
  for (const v of vitals) {
    if (!lastVital[v.patientId] || sd(v.recordedAt) > sd(lastVital[v.patientId].recordedAt)) {
      lastVital[v.patientId] = v;
    }
  }
  const rows = patients.map(p => {
    const v = lastVital[p.id] || {};
    const q = scoreQSOFA(v);
    const missed = mar.filter(m => m.patientId === p.id && m.status === 'missed').length;
    const news2 = Number(v.news2) || 0;
    const composite = Math.min(100, (q.score >= 2 ? 20 : 0) + (news2 >= 5 ? 20 : 0) + missed * 5);
    return {
      id: p.id,
      name: p.firstName + ' ' + p.lastName,
      ward: p.wardCode, bed: p.bedNumber, age: p.age,
      diagnosis: p.diagnosis,
      qsofa: q.score, qsofaLevel: q.level,
      news2, missedMar: missed, composite
    };
  }).sort((a, b) => b.composite - a.composite);

  const critical = rows.filter(r => r.qsofa >= 2 || r.news2 >= 7).length;
  const high = rows.filter(r => (r.qsofa === 1 || r.news2 >= 5) && !(r.qsofa >= 2 || r.news2 >= 7)).length;

  return {
    patients: rows,
    stats: {
      total: rows.length, critical, high,
      moderate: rows.length - critical - high,
      interactionsTracked: DRUG_INTERACTIONS.length,
      renalDrugsTracked: Object.keys(RENAL_DOSING).length
    },
    generatedAt: ctx.now()
  };
}

function computePatientScores(ctx) {
  const pid = ctx.params.patientId;
  const p = ctx.store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const vitals = h(ctx, 'vitals').filter(v => v.patientId === pid)
    .sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
  const last = vitals[0] || {};
  const mar = h(ctx, 'mar').filter(m => m.patientId === pid);
  const missed = mar.filter(m => m.status === 'missed').length;
  const orders = h(ctx, 'orders').filter(o =>
    o.patientId === pid && o.type === 'medication' &&
    ['verified','active','pending'].indexOf(o.status) >= 0);
  const activeDrugs = orders.map(o => (o.details && o.details.drug) || '').filter(Boolean);
  const qsofa = scoreQSOFA(last);
  const news2 = { score: Number(last.news2) || 0, level: last.news2 >= 7 ? 'critical' : last.news2 >= 5 ? 'high' : 'low' };
  const composite = Math.min(100, (qsofa.score >= 2 ? 20 : 0) + (news2.score >= 5 ? 20 : 0) + missed * 5);
  return {
    patient: {
      id: p.id, name: p.firstName + ' ' + p.lastName,
      ward: p.wardCode, bed: p.bedNumber, age: p.age, sex: p.sex,
      diagnosis: p.diagnosis
    },
    scores: { qsofa, news2 },
    composite, missedMar: missed, activeDrugs,
    interactions: checkInteractions(activeDrugs)
  };
}

function computeMorse(ctx) {
  const r = scoreMorse(ctx.body);
  if (ctx.body.patientId) {
    ctx.store.put('cdss_scores', {
      id: 'morse_' + ctx.body.patientId,
      patientId: ctx.body.patientId,
      scoreType: 'morse', score: r.score, level: r.level,
      items: r.items, recommendation: r.recommendation,
      computedAt: ctx.now()
    });
  }
  return r;
}

function computeBraden(ctx) {
  const r = scoreBraden(ctx.body);
  if (ctx.body.patientId) {
    ctx.store.put('cdss_scores', {
      id: 'braden_' + ctx.body.patientId,
      patientId: ctx.body.patientId,
      scoreType: 'braden', score: r.score, level: r.level,
      subscales: r.subscales, recommendation: r.recommendation,
      computedAt: ctx.now()
    });
  }
  return r;
}

function computeCURB65(ctx) { return scoreCURB65(ctx.body); }
function computeWells(ctx) { return scoreWellsDVT(ctx.body); }
function computeCrCl(ctx) { return calcCockcroftGault(ctx.body); }

function drugInteractionCheck(ctx) {
  const drugs = Array.isArray(ctx.body.drugs) ? ctx.body.drugs
    : typeof ctx.body.drugs === 'string' ? ctx.body.drugs.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  if (drugs.length < 2) throw ctx.E.badRequest('need_at_least_2_drugs');
  return {
    drugs,
    interactions: checkInteractions(drugs),
    checkedAt: ctx.now()
  };
}

function renalDose(ctx) {
  const b = ctx.body;
  let crcl = Number(b.crcl);
  if (!crcl) {
    const calc = calcCockcroftGault(b);
    if (calc.error) throw ctx.E.badRequest('invalid_inputs');
    crcl = calc.crcl;
  }
  const arr = Array.isArray(b.drugs) ? b.drugs
    : Array.isArray(b.drug) ? b.drug
    : b.drugs ? [b.drugs]
    : b.drug ? [b.drug] : [];
  if (!arr.length) throw ctx.E.badRequest('drug_required');
  return {
    crcl,
    results: arr.map(d => renalDoseRecommend(crcl, d)),
    computedAt: ctx.now()
  };
}

function listDrugs(ctx) {
  return {
    interactionsCount: DRUG_INTERACTIONS.length,
    renalDosingCount: Object.keys(RENAL_DOSING).length,
    interactionPairs: DRUG_INTERACTIONS.map(i => ({ a: i.a, b: i.b, severity: i.severity })),
    renalDrugs: Object.keys(RENAL_DOSING)
  };
}

function activeAlerts(ctx) {
  const alerts = h(ctx, 'cdss_alerts').filter(a => !a.dismissed);
  alerts.sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  return { items: alerts.slice(0, 30), total: alerts.length };
}

function dismissAlert(ctx) {
  const a = ctx.store.get('cdss_alerts', ctx.params.id);
  if (!a) throw ctx.E.notFound('not_found');
  a.dismissed = true;
  a.dismissedAt = ctx.now();
  a.dismissedBy = ctx.actor.id;
  ctx.store.put('cdss_alerts', a);
  return a;
}

module.exports = {
  handlers: {
    dashboard, computePatientScores,
    computeMorse, computeBraden, computeCURB65, computeWells, computeCrCl,
    drugInteractionCheck, renalDose, listDrugs,
    activeAlerts, dismissAlert
  },
  routes: [
    { method:'GET',  path:'/api/cdss/dashboard', handler:'dashboard', perm:'cdss.view' },
    { method:'GET',  path:'/api/cdss/patient/:patientId', handler:'computePatientScores', perm:'cdss.view' },
    { method:'POST', path:'/api/cdss/score/morse', handler:'computeMorse', perm:'cdss.view' },
    { method:'POST', path:'/api/cdss/score/braden', handler:'computeBraden', perm:'cdss.view' },
    { method:'POST', path:'/api/cdss/score/curb65', handler:'computeCURB65', perm:'cdss.view' },
    { method:'POST', path:'/api/cdss/score/wells', handler:'computeWells', perm:'cdss.view' },
    { method:'POST', path:'/api/cdss/score/crcl', handler:'computeCrCl', perm:'cdss.view' },
    { method:'POST', path:'/api/cdss/interactions', handler:'drugInteractionCheck', perm:'cdss.view' },
    { method:'POST', path:'/api/cdss/renal-dose', handler:'renalDose', perm:'cdss.view' },
    { method:'GET',  path:'/api/cdss/drugs', handler:'listDrugs', perm:'cdss.view' },
    { method:'GET',  path:'/api/cdss/alerts', handler:'activeAlerts', perm:'cdss.view' },
    { method:'POST', path:'/api/cdss/alerts/:id/dismiss', handler:'dismissAlert', perm:'cdss.view' }
  ],
  panels: [
    { id:'dashboard', title:'موتور بالینی', icon:'🧠', perm:'cdss.view', kind:'cdss', api:'/api/cdss/dashboard' },
    { id:'alerts', title:'هشدارهای CDSS', icon:'🚨', perm:'cdss.view', kind:'list',
      api:'/api/cdss/alerts', fields:['type','severity','title','message'] }
  ]
};
EOF_CDSS
echo "✅ modules/cdss.js"

# ═══════════════════════════════════════════════════════════
#  NEW FILE 2 — public/cdss.js
# ═══════════════════════════════════════════════════════════
cat > public/cdss.js << 'EOF_PUBCDSS'
// ═══════════════════════════════════════════════════════════
//  NABZ CDSS Frontend — dashboard, patient sheet, calculators
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  NABZ.showCdss = async function(p, d) {
    const m = document.getElementById('content');
    let h = '<div class="sec-hd"><span>🧠 موتور بالینی</span>';
    h += '<span style="font-size:11px;color:var(--fg-2)">' + d.stats.total + ' بیمار</span></div>';

    h += '<div class="grid-4" style="margin-bottom:16px">';
    h += '<div class="stat dng"><div class="v">' + d.stats.critical + '</div><div class="l">بحرانی</div></div>';
    h += '<div class="stat warn"><div class="v">' + d.stats.high + '</div><div class="l">پرخطر</div></div>';
    h += '<div class="stat ok"><div class="v">' + d.stats.moderate + '</div><div class="l">پایدار</div></div>';
    h += '<div class="stat"><div class="v">' + d.stats.interactionsTracked + '</div><div class="l">تداخل</div></div>';
    h += '</div>';

    h += '<div class="sec-hd"><span>🛠 ابزار بالینی</span></div>';
    h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px">';
    h += '<button class="btn" style="padding:14px;display:flex;flex-direction:column;gap:4px;align-items:center" onclick="NABZ.cdssInteractions()"><span style="font-size:20px">💊</span><span style="font-size:11px;font-weight:800">تداخل دارو</span></button>';
    h += '<button class="btn" style="padding:14px;display:flex;flex-direction:column;gap:4px;align-items:center" onclick="NABZ.cdssRenal()"><span style="font-size:20px">🫘</span><span style="font-size:11px;font-weight:800">دوز کلیوی</span></button>';
    h += '<button class="btn" style="padding:14px;display:flex;flex-direction:column;gap:4px;align-items:center" onclick="NABZ.cdssMorse()"><span style="font-size:20px">🚶</span><span style="font-size:11px;font-weight:800">Morse Fall</span></button>';
    h += '<button class="btn" style="padding:14px;display:flex;flex-direction:column;gap:4px;align-items:center" onclick="NABZ.cdssBraden()"><span style="font-size:20px">🛏</span><span style="font-size:11px;font-weight:800">Braden</span></button>';
    h += '</div>';

    h += '<div class="sec-hd"><span>👥 امتیاز بیماران</span></div>';
    if (!d.patients.length) {
      h += '<div class="empty">بیماری بستری نیست</div>';
    } else {
      for (const pt of d.patients) {
        const lvl = pt.qsofa >= 2 || pt.news2 >= 7 ? 'hi' : pt.qsofa === 1 || pt.news2 >= 5 ? 'md' : 'lo';
        const cc = pt.composite >= 60 ? 'dng' : pt.composite >= 30 ? 'warn' : 'ok';
        h += '<div class="row ' + lvl + '" onclick="NABZ.cdssPatient(\'' + pt.id + '\')">';
        h += '<div class="row-hd"><div class="row-title">' + NABZ._esc(pt.name) + '</div>';
        h += '<span class="pill ' + cc + '">' + pt.composite + '%</span></div>';
        h += '<div class="row-meta">' + NABZ._esc(pt.ward) + ' · تخت ' + NABZ._esc(pt.bed || '—') + ' · ' + (pt.age || '—') + ' س · ' + NABZ._esc(pt.diagnosis || '') + '</div>';
        h += '<div class="row-meta" style="font-size:11px">qSOFA: ' + pt.qsofa + ' · NEWS2: ' + pt.news2 + (pt.missedMar ? ' · ' + pt.missedMar + ' missed' : '') + '</div>';
        h += '</div>';
      }
    }
    m.innerHTML = h;
  };

  NABZ.cdssPatient = async function(patientId) {
    try {
      const d = await NABZ._api('/api/cdss/patient/' + patientId);
      const sheet = document.createElement('div');
      sheet.className = 'bs-backdrop';
      sheet.onclick = function(e) { if (e.target === sheet) sheet.remove(); };
      let h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">🧠 ' + NABZ._esc(d.patient.name) + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="card" style="margin-bottom:12px;background:linear-gradient(135deg,rgba(6,182,212,.1),rgba(139,92,246,.05))">';
      h += '<div style="font-size:15px;font-weight:900">' + NABZ._esc(d.patient.name) + '</div>';
      h += '<div style="font-size:11px;color:var(--fg-2);margin-top:3px">' + (d.patient.age || '—') + ' سال · ' + NABZ._esc(d.patient.ward) + ' · تخت ' + NABZ._esc(d.patient.bed || '—') + '</div>';
      h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + NABZ._esc(d.patient.diagnosis || '') + '</div>';
      h += '</div>';
      const cc = d.composite >= 60 ? 'dng' : d.composite >= 30 ? 'warn' : 'ok';
      h += '<div class="card"><div class="card-title">📊 ریسک ترکیبی</div>';
      h += '<div style="font-size:36px;font-weight:900;color:var(--' + cc + ');text-align:center;line-height:1">' + d.composite + '%</div>';
      h += '<div class="progress" style="margin-top:8px"><div class="progress-fill ' + cc + '" style="width:' + d.composite + '%"></div></div>';
      h += '</div>';
      h += '<div class="card"><div class="card-title">🦠 qSOFA</div>';
      h += '<div style="display:flex;justify-content:space-between;font-size:13px"><span>امتیاز:</span><strong>' + d.scores.qsofa.score + '/3</strong></div>';
      if (d.scores.qsofa.findings.length) {
        h += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:4px">' + NABZ._esc(d.scores.qsofa.findings.join(' + ')) + '</div>';
      }
      h += '<div style="font-size:11.5px;margin-top:6px;padding:6px;background:var(--bg-3);border-radius:6px">' + NABZ._esc(d.scores.qsofa.recommendation) + '</div>';
      h += '</div>';
      h += '<div class="card"><div class="card-title">📈 NEWS2</div>';
      h += '<div style="display:flex;justify-content:space-between;font-size:13px"><span>امتیاز:</span><strong>' + d.scores.news2.score + '</strong></div>';
      h += '</div>';
      if (d.interactions.length) {
        h += '<div class="card" style="border-color:var(--dng)"><div class="card-title">💊 تداخل دارویی</div>';
        for (const ix of d.interactions) {
          h += '<div style="padding:8px;background:var(--dng-soft);border-radius:6px;margin-top:6px;font-size:11.5px">';
          h += '<div><strong>' + NABZ._esc(ix.drug1) + ' + ' + NABZ._esc(ix.drug2) + '</strong></div>';
          h += '<div style="color:var(--fg-2);margin-top:2px">' + NABZ._esc(ix.effect) + '</div>';
          h += '<div style="margin-top:2px">← ' + NABZ._esc(ix.action) + '</div>';
          h += '</div>';
        }
        h += '</div>';
      }
      const c = document.createElement('div');
      c.className = 'bs-sheet';
      c.innerHTML = h;
      sheet.appendChild(c);
      document.body.appendChild(sheet);
      requestAnimationFrame(function() { sheet.classList.add('show'); });
    } catch (e) { alert('خطا: ' + e.message); }
  };

  NABZ.cdssInteractions = function() {
    const sheet = document.createElement('div');
    sheet.className = 'bs-backdrop';
    sheet.onclick = function(e) { if (e.target === sheet) sheet.remove(); };
    let h = '<div class="bs-handle"></div>';
    h += '<div class="bs-hd"><div class="bs-title">💊 بررسی تداخل دارویی</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div class="bs-form">';
    h += '<div class="bs-field"><label>داروها (با کاما)</label>';
    h += '<textarea id="cdssDrugs" rows="3" style="font-family:monospace">warfarin, aspirin</textarea></div>';
    h += '<button class="bs-submit" onclick="NABZ._cdssCheckIx()">🔍 بررسی</button>';
    h += '<div id="cdssIxResult" style="margin-top:12px"></div>';
    h += '</div>';
    const c = document.createElement('div');
    c.className = 'bs-sheet';
    c.innerHTML = h;
    sheet.appendChild(c);
    document.body.appendChild(sheet);
    requestAnimationFrame(function() { sheet.classList.add('show'); });
  };

  NABZ._cdssCheckIx = async function() {
    const drugs = document.getElementById('cdssDrugs').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    if (drugs.length < 2) { alert('حداقل ۲ دارو'); return; }
    const el = document.getElementById('cdssIxResult');
    el.innerHTML = '<div style="text-align:center"><span class="spinner"></span></div>';
    try {
      const d = await NABZ._api('/api/cdss/interactions', {
        method: 'POST', body: JSON.stringify({ drugs: drugs })
      });
      if (!d.interactions.length) {
        el.innerHTML = '<div class="card" style="border-color:var(--ok);text-align:center;color:var(--ok);font-weight:800">✅ تداخلی یافت نشد</div>';
        return;
      }
      let h = '';
      for (const ix of d.interactions) {
        const sev = ix.severity === 'major' ? 'dng' : 'warn';
        h += '<div class="card" style="border-color:var(--' + sev + ')">';
        h += '<div class="row-hd"><div class="row-title">' + NABZ._esc(ix.drug1) + ' + ' + NABZ._esc(ix.drug2) + '</div>';
        h += '<span class="pill ' + sev + '">' + ix.severity + '</span></div>';
        h += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:4px">' + NABZ._esc(ix.effect) + '</div>';
        h += '<div style="font-size:11.5px;margin-top:6px;padding:6px;background:var(--bg-3);border-radius:6px">' + NABZ._esc(ix.action) + '</div>';
        h += '</div>';
      }
      el.innerHTML = h;
    } catch (e) { el.innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>'; }
  };

  NABZ.cdssRenal = function() {
    const sheet = document.createElement('div');
    sheet.className = 'bs-backdrop';
    sheet.onclick = function(e) { if (e.target === sheet) sheet.remove(); };
    let h = '<div class="bs-handle"></div>';
    h += '<div class="bs-hd"><div class="bs-title">🫘 دوز کلیوی — Cockcroft-Gault</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div class="bs-form">';
    h += '<div class="bs-field"><label>سن</label><input type="number" id="rdAge" value="65"></div>';
    h += '<div class="bs-field"><label>وزن (kg)</label><input type="number" id="rdWeight" value="70" step="0.1"></div>';
    h += '<div class="bs-field"><label>کراتینین (mg/dL)</label><input type="number" id="rdScr" value="1.0" step="0.01"></div>';
    h += '<div class="bs-field"><label>جنسیت</label><select id="rdSex"><option value="male">مرد</option><option value="female">زن</option></select></div>';
    h += '<div class="bs-field"><label>داروها (با کاما)</label><input type="text" id="rdDrugs" value="vancomycin, meropenem"></div>';
    h += '<button class="bs-submit" onclick="NABZ._cdssRenal()">🧮 محاسبه</button>';
    h += '<div id="rdResult" style="margin-top:12px"></div>';
    h += '</div>';
    const c = document.createElement('div');
    c.className = 'bs-sheet';
    c.innerHTML = h;
    sheet.appendChild(c);
    document.body.appendChild(sheet);
    requestAnimationFrame(function() { sheet.classList.add('show'); });
  };

  NABZ._cdssRenal = async function() {
    const payload = {
      age: Number(document.getElementById('rdAge').value),
      weightKg: Number(document.getElementById('rdWeight').value),
      creatinineMgDl: Number(document.getElementById('rdScr').value),
      sex: document.getElementById('rdSex').value,
      drugs: document.getElementById('rdDrugs').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean)
    };
    const el = document.getElementById('rdResult');
    el.innerHTML = '<div style="text-align:center"><span class="spinner"></span></div>';
    try {
      const d = await NABZ._api('/api/cdss/renal-dose', { method: 'POST', body: JSON.stringify(payload) });
      let h = '<div class="card"><div class="card-title">📊 CrCl: ' + d.crcl + ' mL/min</div></div>';
      for (const r of d.results) {
        h += '<div class="card">';
        h += '<div class="row-hd"><div class="row-title">' + NABZ._esc(r.drug) + '</div>';
        h += r.found ? '<span class="pill info">CrCl ' + d.crcl + '</span>' : '<span class="pill warn">نامشخص</span>';
        h += '</div>';
        if (r.found) {
          h += '<div style="font-size:11.5px;margin-top:4px"><strong>معمول:</strong> ' + NABZ._esc(r.normal) + '</div>';
          h += '<div style="font-size:11.5px;margin-top:4px;padding:6px;background:var(--primary-soft);border-radius:6px"><strong>توصیه:</strong> ' + NABZ._esc(r.recommended) + '</div>';
          if (r.note) h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">⚠️ ' + NABZ._esc(r.note) + '</div>';
        } else {
          h += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:4px">' + NABZ._esc(r.message) + '</div>';
        }
        h += '</div>';
      }
      el.innerHTML = h;
    } catch (e) { el.innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>'; }
  };

  NABZ.cdssMorse = function() {
    NABZ._cdssForm('morse', '🚶 Morse Fall Scale', [
      { id: 'historyOfFalling', label: 'سابقه سقوط', type: 'checkbox' },
      { id: 'secondaryDiagnosis', label: 'تشخیص ثانویه', type: 'checkbox' },
      { id: 'ambulatoryAid', label: 'وسیله کمکی', type: 'select', options: [
        { v: 'none', l: 'ندارد (0)' }, { v: 'furniture', l: 'مبلمان (30)' },
        { v: 'crutch_cane_walker', l: 'عصا/واکر (15)' } ]},
      { id: 'ivOrHeparinLock', label: 'سرم/هپارین‌لاک', type: 'checkbox' },
      { id: 'gait', label: 'راه‌رفتن', type: 'select', options: [
        { v: 'normal', l: 'طبیعی (0)' }, { v: 'weak', l: 'ضعیف (10)' },
        { v: 'impaired', l: 'اختلال (20)' } ]},
      { id: 'mentalStatus', label: 'وضعیت روانی', type: 'select', options: [
        { v: 'oriented', l: 'آگاه (0)' }, { v: 'overestimates', l: 'بیش‌برآورد (15)' } ]}
    ]);
  };

  NABZ.cdssBraden = function() {
    NABZ._cdssForm('braden', '🛏 Braden Scale', [
      { id: 'sensoryPerception', label: 'درک حسی (1-4)', type: 'number', min: 1, max: 4, default: 3 },
      { id: 'moisture', label: 'رطوبت (1-4)', type: 'number', min: 1, max: 4, default: 2 },
      { id: 'activity', label: 'فعالیت (1-4)', type: 'number', min: 1, max: 4, default: 2 },
      { id: 'mobility', label: 'تحرک (1-4)', type: 'number', min: 1, max: 4, default: 2 },
      { id: 'nutrition', label: 'تغذیه (1-4)', type: 'number', min: 1, max: 4, default: 3 },
      { id: 'frictionShear', label: 'اصطکاک/کشش (1-3)', type: 'number', min: 1, max: 3, default: 2 }
    ]);
  };

  NABZ._cdssForm = function(type, title, fields) {
    const sheet = document.createElement('div');
    sheet.className = 'bs-backdrop';
    sheet.onclick = function(e) { if (e.target === sheet) sheet.remove(); };
    let h = '<div class="bs-handle"></div>';
    h += '<div class="bs-hd"><div class="bs-title">' + title + '</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<form class="bs-form" id="cdssForm">';
    for (const f of fields) {
      h += '<div class="bs-field"><label>' + NABZ._esc(f.label) + '</label>';
      if (f.type === 'checkbox') h += '<input type="checkbox" name="' + f.id + '">';
      else if (f.type === 'select') {
        h += '<select name="' + f.id + '">';
        for (const o of f.options) h += '<option value="' + o.v + '">' + NABZ._esc(o.l) + '</option>';
        h += '</select>';
      } else if (f.type === 'number') {
        h += '<input type="number" name="' + f.id + '" min="' + (f.min || '') + '" max="' + (f.max || '') + '" value="' + (f.default || '') + '">';
      } else {
        h += '<input type="text" name="' + f.id + '">';
      }
      h += '</div>';
    }
    h += '<button type="submit" class="bs-submit">🧮 محاسبه</button>';
    h += '<div id="cdssScoreResult" style="margin-top:12px"></div>';
    h += '</form>';
    const c = document.createElement('div');
    c.className = 'bs-sheet';
    c.innerHTML = h;
    sheet.appendChild(c);
    document.body.appendChild(sheet);
    requestAnimationFrame(function() { sheet.classList.add('show'); });
    c.querySelector('#cdssForm').onsubmit = async function(ev) {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const data = {};
      fd.forEach(function(v, k) { data[k] = v === 'on' ? true : v; });
      try {
        const d = await NABZ._api('/api/cdss/score/' + type, { method: 'POST', body: JSON.stringify(data) });
        const el = document.getElementById('cdssScoreResult');
        const lc = d.level === 'high' || d.level === 'very_high' ? 'dng' : d.level === 'moderate' ? 'warn' : 'ok';
        let rh = '<div class="card" style="border-color:var(--' + lc + ')">';
        rh += '<div style="text-align:center;font-size:32px;font-weight:900;color:var(--' + lc + ')">' + d.score + '</div>';
        rh += '<div style="text-align:center;font-size:11px;color:var(--fg-2)">سطح: ' + d.level + '</div>';
        if (d.items && d.items.length) {
          rh += '<div style="font-size:11px;margin-top:8px;color:var(--fg-2)">' + NABZ._esc(d.items.join(' · ')) + '</div>';
        }
        rh += '<div style="font-size:11.5px;margin-top:8px;padding:6px;background:var(--bg-3);border-radius:6px">' + NABZ._esc(d.recommendation) + '</div>';
        rh += '</div>';
        el.innerHTML = rh;
      } catch (e) { alert('خطا: ' + e.message); }
    };
  };

  // ─── Wrap NABZ.show to intercept kind: 'cdss' ───
  function patchShow() {
    if (!window.NABZ || typeof NABZ.show !== 'function') {
      return setTimeout(patchShow, 200);
    }
    if (NABZ.show._cdssWrapped) return;
    const orig = NABZ.show;
    NABZ.show = async function(id) {
      const p = NABZ.state.panels.find(function(x) { return x.id === id; });
      if (!p || p.kind !== 'cdss') return orig.call(NABZ, id);
      NABZ.state.current = id;
      document.querySelectorAll('.bn-tab').forEach(function(b) { b.classList.remove('on'); });
      const m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        const d = await NABZ._api(p.api);
        await NABZ.showCdss(p, d);
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>';
      }
    };
    NABZ.show._cdssWrapped = true;
    console.log('[cdss] show() wrapped ✓');
  }
  patchShow();

  // ─── Live alert listener ───
  function hookLive() {
    if (typeof window.Live === 'undefined') return setTimeout(hookLive, 300);
    Live.on('cdss.alert', function(data) {
      try {
        const kind = data.severity === 'critical' ? 'dng' : 'warn';
        const msg = '🧠 ' + (data.title || 'CDSS Alert');
        if (typeof liveToast === 'function') liveToast(msg, kind);
        else if (NABZ && NABZ._toast) NABZ._toast(msg);
        if (navigator.vibrate) {
          try { navigator.vibrate(data.severity === 'critical' ? [200,100,200] : 100); } catch (_) {}
        }
      } catch (e) { console.warn('[cdss] alert:', e.message); }
    });
    console.log('[cdss] alert listener ✓');
  }
  hookLive();
})();
EOF_PUBCDSS
echo "✅ public/cdss.js"

# ═══════════════════════════════════════════════════════════
#  PATCH 1 — core/permissions-extra.js
# ═══════════════════════════════════════════════════════════
if ! grep -q "cdss.view" core/permissions-extra.js 2>/dev/null; then
cat >> core/permissions-extra.js << 'EOF_PERMS'

Object.assign(perms.P, {
  'cdss.view': 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,supervisor_er,head_nurse,attending,specialist,resident,intern,physician,nurse,pharmacist,quality_officer'
});
EOF_PERMS
echo "✅ core/permissions-extra.js (+cdss.view)"
else
echo "ℹ️  permissions-extra.js already has cdss.view"
fi

# ═══════════════════════════════════════════════════════════
#  PATCH 2 — public/index.html (add script tag)
# ═══════════════════════════════════════════════════════════
node << 'EOF_HTML'
const fs = require('fs');
const F = 'public/index.html';
let src = fs.readFileSync(F, 'utf8');
if (src.includes('/cdss.js')) { console.log('ℹ️  index.html already has cdss.js'); process.exit(0); }
const from = '<script src="/offline-init.js"></script>';
const to   = '<script src="/offline-init.js"></script>\n<script src="/cdss.js"></script>';
if (!src.includes(from)) { console.error('❌ anchor not found'); process.exit(1); }
src = src.replace(from, to);
fs.writeFileSync(F, src);
console.log('✅ public/index.html (+cdss.js script)');
EOF_HTML

# ═══════════════════════════════════════════════════════════
#  PATCH 3 — public/sw.js (bump + add cdss.js)
# ═══════════════════════════════════════════════════════════
node << 'EOF_SW'
const fs = require('fs');
const F = 'public/sw.js';
let src = fs.readFileSync(F, 'utf8');
const vMatch = src.match(/const VERSION = (\d+);/);
if (!vMatch) { console.error('❌ VERSION not found in sw.js'); process.exit(1); }
const oldV = parseInt(vMatch[1]);
const newV = oldV + 1;
src = src.replace('const VERSION = ' + oldV + ';', 'const VERSION = ' + newV + ';');
if (!src.includes('/cdss.js')) {
  src = src.replace("'/offline-init.js'", "'/offline-init.js',\n  '/cdss.js'");
  console.log('✅ sw.js: STATIC + /cdss.js');
}
console.log('✅ sw.js: v' + oldV + ' → v' + newV);
fs.writeFileSync(F, src);
EOF_SW

# ═══════════════════════════════════════════════════════════
#  PATCH 4 — public/offline.js (add /api/cdss/ to NO_QUEUE)
# ═══════════════════════════════════════════════════════════
node << 'EOF_OFF'
const fs = require('fs');
const F = 'public/offline.js';
let src = fs.readFileSync(F, 'utf8');
if (src.includes("'/api/cdss/'")) { console.log('ℹ️  offline.js already has /api/cdss/'); process.exit(0); }
if (!src.includes("'/api/voice/note/'")) { console.error('❌ anchor not found'); process.exit(1); }
src = src.replace("'/api/voice/note/'", "'/api/voice/note/',\n    '/api/cdss/'");
fs.writeFileSync(F, src);
console.log('✅ public/offline.js: NO_QUEUE += /api/cdss/');
EOF_OFF

# ═══════════════════════════════════════════════════════════
#  PATCH 5 — public/app.js (MOD_META + modOrder)
# ═══════════════════════════════════════════════════════════
node << 'EOF_APP'
const fs = require('fs');
const F = 'public/app.js';
let src = fs.readFileSync(F, 'utf8');
let changed = 0;

// (a) MOD_META — add cdss after crisis
if (!src.includes("cdss:{l:'موتور بالینی'")) {
  const from = "crisis:{l:'بحران',i:'🔥'}";
  const to = "crisis:{l:'بحران',i:'🔥'},\n    cdss:{l:'موتور بالینی',i:'🧠'}";
  if (src.includes(from)) { src = src.replace(from, to); changed++; }
  else console.warn('⚠️  MOD_META anchor not found');
}

// (b) modOrder — insert 'cdss' after 'clinical'
if (!src.includes("'cdss'")) {
  const from = "'clinical','emergency'";
  const to = "'clinical','cdss','emergency'";
  if (src.includes(from)) { src = src.replace(from, to); changed++; }
  else console.warn('⚠️  modOrder anchor not found');
}

if (changed) {
  fs.writeFileSync(F, src);
  console.log('✅ public/app.js: patched ' + changed + ' spots');
} else {
  console.log('ℹ️  app.js already patched');
}
EOF_APP

# ═══════════════════════════════════════════════════════════
#  PATCH 6 — public/style.css (cdss accents)
# ═══════════════════════════════════════════════════════════
if ! grep -q "cdss-" public/style.css 2>/dev/null; then
cat >> public/style.css << 'EOF_CSS'

/* ═══════════════════════════════════════════════════════════
   CDSS — Part 17 visual accents
   ═══════════════════════════════════════════════════════════ */
.cdss-score {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 900;
  background: var(--bg-3);
  color: var(--fg-2);
  font-family: var(--mono);
}
.cdss-score.hi  { background: var(--dng-soft);  color: var(--dng); }
.cdss-score.md  { background: var(--warn-soft); color: var(--warn); }
.cdss-score.lo  { background: var(--ok-soft);   color: var(--ok); }
EOF_CSS
echo "✅ public/style.css (+cdss accents)"
else
echo "ℹ️  style.css already has cdss accents"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Part 17 نصب شد"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📁 فایل‌های جدید:"
echo "   modules/cdss.js    ← موتور بالینی (۱۲ روت)"
echo "   public/cdss.js     ← UI + wrap NABZ.show + alert listener"
echo ""
echo "✏️  فایل‌های پچ‌شده:"
echo "   core/permissions-extra.js (+cdss.view)"
echo "   public/index.html         (+cdss.js script)"
echo "   public/sw.js              (v10 + cdss.js STATIC)"
echo "   public/offline.js         (+/api/cdss/ NO_QUEUE)"
echo "   public/app.js             (MOD_META + modOrder)"
echo "   public/style.css          (+cdss accents)"
echo ""
echo "📦 Backup: $BACKUP_DIR"
echo ""
echo "🔄 مرحله بعد:"
echo "  pkill -9 -f 'core/server.js' 2>/dev/null || true"
echo "  sleep 1"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
echo ""
echo "  ✅ انتظار:"
echo "    📦 cdss (12)"
echo "    📡 248 routes · 24 modules"
echo ""
echo "  ⚠️  در مرورگر: Hard Reload دو بار (SW جدید)"
echo "     لاگین: admin / nabz@2026"
echo "     منو → 🧠 موتور بالینی"
echo ""
