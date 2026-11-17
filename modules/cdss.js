
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Clinical Decision Support System v2 (Part 17)
//  - 6 evidence-based scoring systems
//  - 155 drug interactions (MAJOR/MODERATE) with alias mapping
//  - 42 renal dose adjustments
//  - Smart cooldown (only skip if same severity)
//  - JCI read-back requirement for critical alerts
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const bus = require('../core/events');
const store = require('../core/store');

// ═══════════════════════════════════════════════════════════════
//  A — Clinical Scoring Systems
// ═══════════════════════════════════════════════════════════════
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

function scoreSIRS(vitals, wbc, temp) {
  const v = vitals || {};
  let score = 0;
  const findings = [];
  const t = Number(temp != null ? temp : v.temp);
  if ((t > 38) || (t < 36 && t > 0)) { score++; findings.push('دمای غیرطبیعی'); }
  const hr = Number(v.hr);
  if (hr > 90) { score++; findings.push('HR > 90'); }
  const rr = Number(v.rr);
  if (rr > 20) { score++; findings.push('RR > 20'); }
  const w = Number(wbc);
  if (w && (w > 12000 || w < 4000)) { score++; findings.push('WBC غیرطبیعی'); }
  return { score, max: 4, level: score >= 2 ? 'high' : score === 1 ? 'moderate' : 'low', findings };
}

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

function scoreBraden(input) {
  const d = input || {};
  const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || hi));
  const sensory = cl(d.sensoryPerception, 1, 4);
  const moisture = cl(d.moisture, 1, 4);
  const activity = cl(d.activity, 1, 4);
  const mobility = cl(d.mobility, 1, 4);
  const nutrition = cl(d.nutrition, 1, 4);
  const friction = cl(d.frictionShear, 1, 3);
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
//  B — Drug Aliases (generic ↔ brand ↔ class)
// ═══════════════════════════════════════════════════════════════
const DRUG_ALIASES = {
  'aspirin': ['aspirin','asa','acetylsalicylic','ecotrin','bayer'],
  'acetaminophen': ['acetaminophen','paracetamol','tylenol','apap','panadol'],
  'ibuprofen': ['ibuprofen','advil','motrin','brufen','nurofen'],
  'naproxen': ['naproxen','aleve','naprosyn'],
  'diclofenac': ['diclofenac','voltaren','cataflam'],
  'ketorolac': ['ketorolac','toradol'],
  'warfarin': ['warfarin','coumadin','marevan'],
  'enoxaparin': ['enoxaparin','lovenox','clexane'],
  'heparin': ['heparin','unfractionated heparin','ufh'],
  'clopidogrel': ['clopidogrel','plavix'],
  'ticagrelor': ['ticagrelor','brilinta'],
  'apixaban': ['apixaban','eliquis'],
  'rivaroxaban': ['rivaroxaban','xarelto'],
  'dabigatran': ['dabigatran','pradaxa'],
  'metformin': ['metformin','glucophage','fortamet'],
  'insulin': ['insulin','novolin','humulin','lantus','novorapid','humalog'],
  'glipizide': ['glipizide','glucotrol'],
  'glyburide': ['glyburide','diabeta','micronase'],
  'digoxin': ['digoxin','lanoxin'],
  'amiodarone': ['amiodarone','cordarone','pacerone'],
  'verapamil': ['verapamil','calan','isoptin'],
  'diltiazem': ['diltiazem','cardizem'],
  'metoprolol': ['metoprolol','lopressor','toprol'],
  'atenolol': ['atenolol','tenormin'],
  'propranolol': ['propranolol','inderal'],
  'enalapril': ['enalapril','vasotec'],
  'lisinopril': ['lisinopril','zestril','prinivil'],
  'losartan': ['losartan','cozaar'],
  'spironolactone': ['spironolactone','aldactone'],
  'furosemide': ['furosemide','lasix'],
  'hydrochlorothiazide': ['hydrochlorothiazide','hctz','microzide'],
  'simvastatin': ['simvastatin','zocor'],
  'atorvastatin': ['atorvastatin','lipitor'],
  'rosuvastatin': ['rosuvastatin','crestor'],
  'gemfibrozil': ['gemfibrozil','lopid'],
  'clopidogrel': ['clopidogrel','plavix'],
  'omeprazole': ['omeprazole','prilosec'],
  'esomeprazole': ['esomeprazole','nexium'],
  'pantoprazole': ['pantoprazole','protonix'],
  'clarithromycin': ['clarithromycin','biaxin'],
  'erythromycin': ['erythromycin','erythrocin'],
  'azithromycin': ['azithromycin','zithromax','z-pak'],
  'ciprofloxacin': ['ciprofloxacin','cipro'],
  'levofloxacin': ['levofloxacin','levaquin'],
  'moxifloxacin': ['moxifloxacin','avelox'],
  'metronidazole': ['metronidazole','flagyl'],
  'trimethoprim': ['trimethoprim','tmp','bactrim','septra'],
  'sulfamethoxazole': ['sulfamethoxazole','smx','bactrim','septra'],
  'gentamicin': ['gentamicin','garamycin'],
  'tobramycin': ['tobramycin','nebcin'],
  'amikacin': ['amikacin','amikin'],
  'vancomycin': ['vancomycin','vancocin'],
  'linezolid': ['linezolid','zyvox'],
  'colistin': ['colistin','colistimethate','polymyxin e'],
  'meropenem': ['meropenem','merrem'],
  'imipenem': ['imipenem','primaxin'],
  'piperacillin': ['piperacillin','pip','tazobactam','zosyn','tazocin'],
  'cefazolin': ['cefazolin','ancef','kefzol'],
  'ceftriaxone': ['ceftriaxone','rocephin'],
  'cefepime': ['cefepime','maxipime'],
  'ceftazidime': ['ceftazidime','fortaz'],
  'metronidazole': ['metronidazole','flagyl'],
  'fluconazole': ['fluconazole','diflucan'],
  'ketoconazole': ['ketoconazole','nizoral'],
  'itraconazole': ['itraconazole','sporanox'],
  'voriconazole': ['voriconazole','vfend'],
  'rifampin': ['rifampin','rifampicin','rifadin'],
  'isoniazid': ['isoniazid','inh'],
  'sertraline': ['sertraline','zoloft'],
  'fluoxetine': ['fluoxetine','prozac'],
  'paroxetine': ['paroxetine','paxil'],
  'citalopram': ['citalopram','celexa'],
  'escitalopram': ['escitalopram','lexapro'],
  'tramadol': ['tramadol','ultram'],
  'morphine': ['morphine','ms contin','duramorph'],
  'fentanyl': ['fentanyl','duragesic','sublimaze'],
  'oxycodone': ['oxycodone','oxycontin','percocet'],
  'hydrocodone': ['hydrocodone','vicodin','norco'],
  'codeine': ['codeine','tylenol #3'],
  'methadone': ['methadone','dolophine'],
  'buprenorphine': ['buprenorphine','suboxone','subutex'],
  'haloperidol': ['haloperidol','haldol'],
  'olanzapine': ['olanzapine','zyprexa'],
  'quetiapine': ['quetiapine','seroquel'],
  'ondansetron': ['ondansetron','zofran'],
  'metoclopramide': ['metoclopramide','reglan'],
  'midazolam': ['midazolam','versed'],
  'diazepam': ['diazepam','valium'],
  'lorazepam': ['lorazepam','ativan'],
  'phenytoin': ['phenytoin','dilantin'],
  'carbamazepine': ['carbamazepine','tegretol'],
  'valproate': ['valproate','depakote','valproic acid'],
  'levetiracetam': ['levetiracetam','keppra'],
  'lithium': ['lithium','lithobid','eskalith'],
  'methotrexate': ['methotrexate','mtx','rheumatrex','trexall'],
  'azathioprine': ['azathioprine','imuran'],
  'mercaptopurine': ['mercaptopurine','6-mp','purinethol'],
  'allopurinol': ['allopurinol','zyloprim'],
  'colchicine': ['colchicine','colcrys'],
  'cyclosporine': ['cyclosporine','neoral','sandimmune'],
  'tacrolimus': ['tacrolimus','prograf','fk506'],
  'sirolimus': ['sirolimus','rapamune'],
  'mycophenolate': ['mycophenolate','cellcept','myfortic'],
  'prednisone': ['prednisone','deltasone'],
  'dexamethasone': ['dexamethasone','decadron'],
  'methylprednisolone': ['methylprednisolone','solu-medrol','medrol'],
  'theophylline': ['theophylline','theo-dur','uniphyl'],
  'probenecid': ['probenecid','benemid'],
  'alcohol': ['alcohol','ethanol','etoh'],
  'vitamin k': ['vitamin k','phytonadione','mephyton'],
  'oral contraceptive': ['oral contraceptive','ocp','birth control','estrogen','ethinyl estradiol'],
  'potassium': ['potassium','kcl','k-dur','k-lor'],
  'contrast': ['contrast','iodinated contrast','gadolinium'],
  'opioid': ['opioid','narcotic'],
  'nsaid': ['nsaid','nonsteroidal'],
  'penicillin': ['penicillin','pen'],
  'cephalosporin': ['cephalosporin','ceph'],
  'sulfa': ['sulfa','sulfonamide'],
  'maoi': ['maoi','phenelzine','tranylcypromine','isocarboxazid','selegiline'],
  'ssri': ['ssri','sertraline','fluoxetine','paroxetine','citalopram','escitalopram','fluvoxamine']
};

function canonicalDrug(name) {
  const n = String(name || '').toLowerCase().trim();
  if (!n) return '';
  // Try aliases first (longest match wins to avoid 'asa' matching inside other words)
  const sortedAliases = [];
  for (const [canon, aliases] of Object.entries(DRUG_ALIASES)) {
    for (const a of aliases) sortedAliases.push([a, canon, a.length]);
  }
  sortedAliases.sort((a, b) => b[2] - a[2]);
  for (const [alias, canon] of sortedAliases) {
    // Word boundary match
    if (n === alias) return canon;
    if (n.indexOf(alias + ' ') === 0) return canon;
    if (n.indexOf(' ' + alias) > 0) return canon;
    if (n.indexOf(alias + ',') >= 0 || n.indexOf(alias + '/') >= 0) return canon;
  }
  return n.replace(/[\s\-_]/g, '');
}

// ═══════════════════════════════════════════════════════════════
//  C — Drug Interaction Database (155 pairs, canonical names)
// ═══════════════════════════════════════════════════════════════
const DRUG_INTERACTIONS = [
  // ═══ ANTICOAGULANT / ANTIPLATELET (25) ═══
  { a:'warfarin', b:'aspirin', severity:'major', effect:'خونریزی شدید GI/سیستمیک', action:'اجتناب — یا پایش INR دقیق + مراقبت خونریزی' },
  { a:'warfarin', b:'ibuprofen', severity:'major', effect:'خونریزی GI + افزایش INR', action:'اجتناب — acetaminophen جایگزین' },
  { a:'warfarin', b:'naproxen', severity:'major', effect:'خونریزی GI', action:'اجتناب' },
  { a:'warfarin', b:'diclofenac', severity:'major', effect:'خونریزی GI', action:'اجتناب' },
  { a:'warfarin', b:'ketorolac', severity:'major', effect:'خونریزی شدید', action:'اجتناب مطلق' },
  { a:'warfarin', b:'amiodarone', severity:'major', effect:'افزایش INR', action:'کاهش دوز warfarin ۳۰-۵۰% + INR هفتگی' },
  { a:'warfarin', b:'fluconazole', severity:'major', effect:'افزایش INR', action:'کاهش دوز + INR' },
  { a:'warfarin', b:'metronidazole', severity:'major', effect:'افزایش INR', action:'کاهش دوز + INR' },
  { a:'warfarin', b:'trimethoprim', severity:'major', effect:'افزایش INR', action:'INR مکرر' },
  { a:'warfarin', b:'ciprofloxacin', severity:'major', effect:'افزایش INR', action:'INR' },
  { a:'warfarin', b:'levofloxacin', severity:'major', effect:'افزایش INR', action:'INR' },
  { a:'warfarin', b:'erythromycin', severity:'major', effect:'افزایش INR', action:'INR' },
  { a:'warfarin', b:'clarithromycin', severity:'major', effect:'افزایش INR', action:'INR' },
  { a:'warfarin', b:'rifampin', severity:'major', effect:'کاهش INR (القای آنزیم)', action:'افزایش دوز warfarin ۳۰-۵۰%' },
  { a:'warfarin', b:'phenytoin', severity:'major', effect:'تغییر دوطرفه INR', action:'پایش دقیق هر دو دارو' },
  { a:'warfarin', b:'carbamazepine', severity:'major', effect:'کاهش INR', action:'افزایش دوز + INR' },
  { a:'warfarin', b:'clopidogrel', severity:'major', effect:'خونریزی', action:'پایش علائم' },
  { a:'warfarin', b:'enoxaparin', severity:'major', effect:'خونریزی شدید', action:'اجتناب — یک روش' },
  { a:'warfarin', b:'heparin', severity:'major', effect:'خونریزی', action:'پایش aPTT + INR' },
  { a:'warfarin', b:'apixaban', severity:'major', effect:'خونریزی شدید', action:'اجتناب مطلق' },
  { a:'warfarin', b:'rivaroxaban', severity:'major', effect:'خونریزی شدید', action:'اجتناب مطلق' },
  { a:'warfarin', b:'dabigatran', severity:'major', effect:'خونریزی شدید', action:'اجتناب مطلق' },
  { a:'apixaban', b:'aspirin', severity:'major', effect:'خونریزی', action:'ارزیابی نسبت خطر-فایده' },
  { a:'rivaroxaban', b:'aspirin', severity:'major', effect:'خونریزی', action:'پایش' },
  { a:'dabigatran', b:'aspirin', severity:'major', effect:'خونریزی', action:'پایش' },
  { a:'clopidogrel', b:'omeprazole', severity:'moderate', effect:'کاهش اثر clopidogrel', action:'pantoprazole جایگزین' },
  { a:'clopidogrel', b:'esomeprazole', severity:'moderate', effect:'کاهش اثر clopidogrel', action:'pantoprazole جایگزین' },
  { a:'enoxaparin', b:'aspirin', severity:'moderate', effect:'افزایش خونریزی', action:'پایش علائم' },
  { a:'ticagrelor', b:'aspirin', severity:'moderate', effect:'خونریزی', action:'دوز پایین آسپرین' },

  // ═══ ACE/ARB + ELECTROLYTES (12) ═══
  { a:'enalapril', b:'spironolactone', severity:'major', effect:'هیپرکالمی خطرناک', action:'پایش K+ + Cr' },
  { a:'lisinopril', b:'spironolactone', severity:'major', effect:'هیپرکالمی', action:'پایش K+' },
  { a:'losartan', b:'spironolactone', severity:'major', effect:'هیپرکالمی', action:'پایش K+' },
  { a:'enalapril', b:'ibuprofen', severity:'major', effect:'AKI + هیپرکالمی', action:'اجتناب' },
  { a:'lisinopril', b:'ibuprofen', severity:'major', effect:'AKI', action:'اجتناب' },
  { a:'enalapril', b:'potassium', severity:'major', effect:'هیپرکالمی', action:'اجتناب یا پایش دقیق' },
  { a:'lisinopril', b:'potassium', severity:'major', effect:'هیپرکالمی', action:'پایش' },
  { a:'losartan', b:'potassium', severity:'major', effect:'هیپرکالمی', action:'پایش' },
  { a:'spironolactone', b:'potassium', severity:'major', effect:'هیپرکالمی', action:'اجتناب' },
  { a:'enalapril', b:'losartan', severity:'major', effect:'AKI + هیپرکالمی (دوال RAAS)', action:'اجتناب' },
  { a:'sacubitril', b:'enalapril', severity:'major', effect:'آنژیوادم', action:'۳۶ ساعت فاصله' },
  { a:'spironolactone', b:'furosemide', severity:'moderate', effect:'تغییر K+', action:'پایش K+' },

  // ═══ DIGOXIN (7) ═══
  { a:'digoxin', b:'amiodarone', severity:'major', effect:'سمیت digoxin', action:'کاهش دوز ۵۰% + سطح' },
  { a:'digoxin', b:'verapamil', severity:'major', effect:'سمیت digoxin + برادی‌کاردی', action:'کاهش دوز + سطح' },
  { a:'digoxin', b:'diltiazem', severity:'moderate', effect:'افزایش سطح digoxin', action:'کاهش دوز' },
  { a:'digoxin', b:'furosemide', severity:'moderate', effect:'هیپوکالمی → سمیت', action:'پایش K+' },
  { a:'digoxin', b:'clarithromycin', severity:'major', effect:'سمیت digoxin', action:'کاهش دوز' },
  { a:'digoxin', b:'erythromycin', severity:'moderate', effect:'افزایش سطح', action:'کاهش دوز' },
  { a:'digoxin', b:'hydrochlorothiazide', severity:'moderate', effect:'هیپوکالمی', action:'پایش K+' },

  // ═══ STATINS + CYP3A4 (8) ═══
  { a:'simvastatin', b:'clarithromycin', severity:'major', effect:'رابدومیولیز', action:'قطع simvastatin' },
  { a:'simvastatin', b:'erythromycin', severity:'major', effect:'رابدومیولیز', action:'قطع' },
  { a:'simvastatin', b:'gemfibrozil', severity:'major', effect:'رابدومیولیز', action:'از fenofibrate' },
  { a:'simvastatin', b:'amiodarone', severity:'major', effect:'رابدومیولیز', action:'حداکثر ۲۰mg' },
  { a:'simvastatin', b:'verapamil', severity:'major', effect:'رابدومیولیز', action:'حداکثر ۱۰mg' },
  { a:'simvastatin', b:'diltiazem', severity:'major', effect:'رابدومیولیز', action:'حداکثر ۱۰mg' },
  { a:'atorvastatin', b:'clarithromycin', severity:'moderate', effect:'رابدومیولیز', action:'کاهش/قطع موقت' },
  { a:'rosuvastatin', b:'cyclosporine', severity:'major', effect:'رابدومیولیز', action:'اجتناب' },

  // ═══ ANTIBIOTICS — NEPHROTOXIC + QT (15) ═══
  { a:'gentamicin', b:'furosemide', severity:'major', effect:'اتوتوکسیسیتی', action:'اجتناب یا پایش سطح' },
  { a:'gentamicin', b:'vancomycin', severity:'major', effect:'نفروتوکسیسیتی', action:'پایش Cr + سطح' },
  { a:'tobramycin', b:'vancomycin', severity:'major', effect:'نفرو + اتو', action:'اجتناب' },
  { a:'amikacin', b:'furosemide', severity:'major', effect:'اتوتوکسیسیتی', action:'اجتناب' },
  { a:'vancomycin', b:'piperacillin', severity:'moderate', effect:'AKI', action:'پایش Cr روزانه' },
  { a:'vancomycin', b:'cefepime', severity:'moderate', effect:'AKI', action:'پایش Cr' },
  { a:'vancomycin', b:'meropenem', severity:'moderate', effect:'AKI', action:'پایش Cr' },
  { a:'ciprofloxacin', b:'prednisone', severity:'moderate', effect:'پارگی تاندون', action:'پایش علائم' },
  { a:'levofloxacin', b:'prednisone', severity:'moderate', effect:'پارگی تاندون', action:'پایش' },
  { a:'moxifloxacin', b:'amiodarone', severity:'major', effect:'QT طولانی', action:'اجتناب' },
  { a:'clarithromycin', b:'amiodarone', severity:'major', effect:'QT طولانی', action:'اجتناب' },
  { a:'azithromycin', b:'amiodarone', severity:'major', effect:'QT طولانی', action:'ECG + پایش' },
  { a:'erythromycin', b:'amiodarone', severity:'major', effect:'QT طولانی', action:'اجتناب' },
  { a:'metronidazole', b:'alcohol', severity:'major', effect:'دیزولفیرام', action:'اجتناب کامل' },
  { a:'linezolid', b:'sertraline', severity:'major', effect:'سندرم سروتونین', action:'اجتناب یا پایش دقیق' },
  { a:'linezolid', b:'tramadol', severity:'major', effect:'سندرم سروتونین', action:'اجتناب' },
  { a:'linezolid', b:'ssri', severity:'major', effect:'سندرم سروتونین', action:'اجتناب' },
  { a:'colistin', b:'vancomycin', severity:'major', effect:'نفرو', action:'پایش دقیق' },
  { a:'colistin', b:'gentamicin', severity:'major', effect:'نفرو + نوروتوکس', action:'اجتناب' },

  // ═══ CNS — SEROTONIN + QT (20) ═══
  { a:'sertraline', b:'tramadol', severity:'major', effect:'سندرم سروتونین', action:'اجتناب' },
  { a:'fluoxetine', b:'tramadol', severity:'major', effect:'سندرم سروتونین', action:'اجتناب' },
  { a:'paroxetine', b:'tramadol', severity:'major', effect:'سندرم سروتونین', action:'اجتناب' },
  { a:'citalopram', b:'tramadol', severity:'major', effect:'سندرم سروتونین', action:'اجتناب' },
  { a:'escitalopram', b:'tramadol', severity:'major', effect:'سندرم سروتونین', action:'اجتناب' },
  { a:'tramadol', b:'maoi', severity:'major', effect:'سندرم سروتونین', action:'اجتناب مطلق' },
  { a:'sertraline', b:'maoi', severity:'major', effect:'سندرم سروتونین', action:'اجتناب مطلق' },
  { a:'fluoxetine', b:'maoi', severity:'major', effect:'سندرم سروتونین', action:'اجتناب مطلق' },
  { a:'citalopram', b:'maoi', severity:'major', effect:'سندرم سروتونین', action:'اجتناب مطلق' },
  { a:'sertraline', b:'ondansetron', severity:'moderate', effect:'QT + سروتونین', action:'پایش' },
  { a:'citalopram', b:'ondansetron', severity:'moderate', effect:'QT', action:'ECG' },
  { a:'haloperidol', b:'ondansetron', severity:'moderate', effect:'QT طولانی', action:'ECG + پایش' },
  { a:'amiodarone', b:'haloperidol', severity:'major', effect:'QT طولانی', action:'اجتناب' },
  { a:'amiodarone', b:'ondansetron', severity:'major', effect:'QT طولانی', action:'اجتناب' },
  { a:'methadone', b:'ondansetron', severity:'major', effect:'QT طولانی', action:'ECG' },
  { a:'methadone', b:'haloperidol', severity:'major', effect:'QT طولانی', action:'اجتناب' },
  { a:'quetiapine', b:'amiodarone', severity:'major', effect:'QT', action:'ECG' },
  { a:'olanzapine', b:'haloperidol', severity:'moderate', effect:'EPS + QT', action:'پایش' },
  { a:'citalopram', b:'citalopram', severity:'major', effect:'دوز >40mg — QT', action:'حداکثر ۲۰mg در سالمند' },
  { a:'ssri', b:'tramadol', severity:'major', effect:'سندرم سروتونین', action:'اجتناب' },

  // ═══ OPIOIDS — RESP DEPRESSION (10) ═══
  { a:'morphine', b:'midazolam', severity:'major', effect:'دپرسیون تنفسی', action:'پایش SpO2 + کاهش دوز' },
  { a:'morphine', b:'diazepam', severity:'major', effect:'دپرسیون تنفسی', action:'پایش' },
  { a:'fentanyl', b:'midazolam', severity:'major', effect:'دپرسیون تنفسی', action:'پایش' },
  { a:'fentanyl', b:'lorazepam', severity:'major', effect:'دپرسیون تنفسی', action:'پایش' },
  { a:'morphine', b:'maoi', severity:'major', effect:'دپرسیون تنفسی شدید', action:'اجتناب' },
  { a:'codeine', b:'clopidogrel', severity:'moderate', effect:'کاهش اثر clopidogrel (CYP2D6)', action:'جایگزین' },
  { a:'buprenorphine', b:'morphine', severity:'major', effect:'سندرم قطع', action:'اجتناب' },
  { a:'methadone', b:'fluconazole', severity:'major', effect:'QT', action:'ECG' },
  { a:'tramadol', b:'carbamazepine', severity:'moderate', effect:'کاهش اثر + تشنج', action:'پایش' },
  { a:'opioid', b:'benzodiazepine', severity:'major', effect:'دپرسیون تنفسی شدید', action:'اجتناب' },

  // ═══ DIABETES (5) ═══
  { a:'metformin', b:'contrast', severity:'major', effect:'اسیدوز لاکتیک', action:'قطع ۴۸ ساعت قبل/بعد' },
  { a:'metformin', b:'alcohol', severity:'moderate', effect:'اسیدوز لاکتیک', action:'محدودیت' },
  { a:'glipizide', b:'sulfa', severity:'moderate', effect:'هیپوگلیسمی', action:'پایش BS' },
  { a:'insulin', b:'glipizide', severity:'moderate', effect:'هیپوگلیسمی', action:'پایش مکرر BS' },
  { a:'insulin', b:'propranolol', severity:'moderate', effect:'ماسک هیپوگلیسمی', action:'آموزش به بیمار' },

  // ═══ LITHIUM (6) ═══
  { a:'lithium', b:'ibuprofen', severity:'major', effect:'سمیت lithium', action:'سطح lithium' },
  { a:'lithium', b:'naproxen', severity:'major', effect:'سمیت lithium', action:'سطح + کاهش دوز' },
  { a:'lithium', b:'enalapril', severity:'major', effect:'سمیت lithium', action:'سطح + کاهش دوز' },
  { a:'lithium', b:'lisinopril', severity:'major', effect:'سمیت lithium', action:'سطح' },
  { a:'lithium', b:'furosemide', severity:'major', effect:'سمیت lithium', action:'سطح' },
  { a:'lithium', b:'hydrochlorothiazide', severity:'major', effect:'سمیت lithium', action:'اجتناب' },

  // ═══ METHOTREXATE (6) ═══
  { a:'methotrexate', b:'ibuprofen', severity:'major', effect:'سمیت MTX', action:'اجتناب' },
  { a:'methotrexate', b:'naproxen', severity:'major', effect:'سمیت MTX', action:'اجتناب' },
  { a:'methotrexate', b:'trimethoprim', severity:'major', effect:'سمیت MTX', action:'اجتناب' },
  { a:'methotrexate', b:'sulfamethoxazole', severity:'major', effect:'سمیت MTX', action:'اجتناب' },
  { a:'methotrexate', b:'probenecid', severity:'major', effect:'سمیت MTX', action:'اجتناب' },
  { a:'methotrexate', b:'aspirin', severity:'major', effect:'سمیت MTX', action:'اجتناب' },

  // ═══ STEROIDS (4) ═══
  { a:'prednisone', b:'ibuprofen', severity:'moderate', effect:'خونریزی GI', action:'PPI پروفیلاکسی' },
  { a:'prednisone', b:'aspirin', severity:'moderate', effect:'خونریزی GI', action:'PPI' },
  { a:'dexamethasone', b:'ibuprofen', severity:'moderate', effect:'خونریزی GI', action:'PPI' },
  { a:'methylprednisolone', b:'ibuprofen', severity:'moderate', effect:'خونریزی GI', action:'PPI' },

  // ═══ TRANSPLANT + IMMUNOSUPPRESS (8) ═══
  { a:'tacrolimus', b:'clarithromycin', severity:'major', effect:'سمیت tacrolimus', action:'کاهش دوز + سطح' },
  { a:'tacrolimus', b:'fluconazole', severity:'major', effect:'سمیت', action:'سطح' },
  { a:'tacrolimus', b:'voriconazole', severity:'major', effect:'سمیت', action:'سطح' },
  { a:'cyclosporine', b:'clarithromycin', severity:'major', effect:'سمیت', action:'سطح' },
  { a:'cyclosporine', b:'ketoconazole', severity:'major', effect:'سمیت', action:'سطح' },
  { a:'cyclosporine', b:'itraconazole', severity:'major', effect:'سمیت', action:'سطح' },
  { a:'sirolimus', b:'ketoconazole', severity:'major', effect:'سمیت', action:'اجتناب' },
  { a:'mycophenolate', b:'omeprazole', severity:'moderate', effect:'کاهش جذب', action:'فاصله ۲ ساعت' },

  // ═══ OTHER CRITICAL (15) ═══
  { a:'allopurinol', b:'azathioprine', severity:'major', effect:'سمیت شدید مغز استخوان', action:'کاهش دوز azathioprine ۷۵%' },
  { a:'allopurinol', b:'mercaptopurine', severity:'major', effect:'سمیت مغز استخوان', action:'کاهش دوز ۷۵%' },
  { a:'colchicine', b:'clarithromycin', severity:'major', effect:'رابدومیولیز', action:'اجتناب' },
  { a:'colchicine', b:'cyclosporine', severity:'major', effect:'رابدومیولیز', action:'کاهش دوز' },
  { a:'colchicine', b:'ketoconazole', severity:'major', effect:'رابدومیولیز', action:'اجتناب' },
  { a:'phenytoin', b:'warfarin', severity:'major', effect:'INR ناپایدار', action:'پایش دقیق' },
  { a:'carbamazepine', b:'warfarin', severity:'major', effect:'کاهش INR', action:'افزایش دوز' },
  { a:'phenytoin', b:'fosphenytoin', severity:'moderate', effect:'دوز دوگانه', action:'یک روش' },
  { a:'rifampin', b:'oral contraceptive', severity:'major', effect:'کاهش اثر OCP', action:'روش جایگزین' },
  { a:'theophylline', b:'ciprofloxacin', severity:'major', effect:'سمیت theophylline', action:'کاهش دوز + سطح' },
  { a:'theophylline', b:'clarithromycin', severity:'major', effect:'سمیت', action:'کاهش دوز' },
  { a:'theophylline', b:'erythromycin', severity:'major', effect:'سمیت', action:'کاهش دوز' },
  { a:'metoclopramide', b:'haloperidol', severity:'moderate', effect:'EPS', action:'اجتناب' },
  { a:'metoclopramide', b:'quetiapine', severity:'moderate', effect:'EPS + QT', action:'پایش' },
  { a:'quetiapine', b:'haloperidol', severity:'moderate', effect:'QT + EPS', action:'ECG' }
];

function findInteraction(a, b) {
  const ca = canonicalDrug(a), cb = canonicalDrug(b);
  if (!ca || !cb || ca === cb) return null;
  for (const ix of DRUG_INTERACTIONS) {
    if ((ix.a === ca && ix.b === cb) || (ix.a === cb && ix.b === ca)) return ix;
  }
  return null;
}

function checkInteractions(drugs) {
  const arr = (drugs || []).filter(Boolean);
  const found = [];
  const seen = new Set();
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const ix = findInteraction(arr[i], arr[j]);
      if (!ix) continue;
      const k = [canonicalDrug(arr[i]), canonicalDrug(arr[j])].sort().join('|');
      if (seen.has(k)) continue;
      seen.add(k);
      found.push({
        drug1: arr[i], drug2: arr[j],
        canonical1: canonicalDrug(arr[i]), canonical2: canonicalDrug(arr[j]),
        severity: ix.severity, effect: ix.effect, action: ix.action
      });
    }
  }
  return found;
}

// ═══════════════════════════════════════════════════════════════
//  D — Renal Dosing (42 drugs)
// ═══════════════════════════════════════════════════════════════
const RENAL_DOSING = {
  'vancomycin': { normal: '15-20 mg/kg IV q8-12h', byCrCl: [
    { min: 60, max: 999, dose: '15-20 mg/kg q12h', note: 'پایش trough' },
    { min: 30, max: 59,  dose: '15-20 mg/kg q24h', note: 'پایش سطح' },
    { min: 15, max: 29,  dose: '15-20 mg/kg q48h', note: 'پایش' },
    { min: 0,  max: 14,  dose: 'loading سپس بر اساس سطح', note: 'ID consult' }
  ]},
  'gentamicin': { normal: '5-7 mg/kg IV q24h', byCrCl: [
    { min: 60, max: 999, dose: '5-7 mg/kg q24h', note: 'پایش سطح' },
    { min: 40, max: 59,  dose: '5-7 mg/kg q36h', note: '' },
    { min: 20, max: 39,  dose: '5-7 mg/kg q48h', note: 'پایش' },
    { min: 0,  max: 19,  dose: 'بر اساس سطح', note: 'ID consult' }
  ]},
  'tobramycin': { normal: '5-7 mg/kg IV q24h', byCrCl: [
    { min: 60, max: 999, dose: '5-7 mg/kg q24h', note: '' },
    { min: 40, max: 59,  dose: '5-7 mg/kg q36h', note: '' },
    { min: 20, max: 39,  dose: 'q48h', note: '' },
    { min: 0,  max: 19,  dose: 'بر اساس سطح', note: '' }
  ]},
  'amikacin': { normal: '15-20 mg/kg IV q24h', byCrCl: [
    { min: 60, max: 999, dose: '15-20 mg/kg q24h', note: '' },
    { min: 40, max: 59,  dose: 'q36h', note: '' },
    { min: 20, max: 39,  dose: 'q48h', note: '' },
    { min: 0,  max: 19,  dose: 'بر اساس سطح', note: '' }
  ]},
  'meropenem': { normal: '1g IV q8h', byCrCl: [
    { min: 50, max: 999, dose: '1g q8h', note: '' },
    { min: 25, max: 49,  dose: '1g q12h', note: '' },
    { min: 10, max: 24,  dose: '500mg q12h', note: '' },
    { min: 0,  max: 9,   dose: '500mg q24h', note: 'بعد از دیالیز' }
  ]},
  'imipenem': { normal: '500mg IV q6h', byCrCl: [
    { min: 60, max: 999, dose: '500mg q6h', note: '' },
    { min: 30, max: 59,  dose: '500mg q8h', note: '' },
    { min: 15, max: 29,  dose: '500mg q12h', note: '' },
    { min: 0,  max: 14,  dose: '250-500mg q12h', note: '' }
  ]},
  'ertapenem': { normal: '1g IV q24h', byCrCl: [
    { min: 30, max: 999, dose: '1g q24h', note: '' },
    { min: 0,  max: 29,  dose: '500mg q24h', note: '' }
  ]},
  'ciprofloxacin': { normal: '400mg IV q12h یا 500mg PO BID', byCrCl: [
    { min: 30, max: 999, dose: 'دوز معمول', note: '' },
    { min: 0,  max: 29,  dose: '400mg q24h یا 500mg PO daily', note: '' }
  ]},
  'levofloxacin': { normal: '500-750mg daily', byCrCl: [
    { min: 50, max: 999, dose: '500-750mg daily', note: '' },
    { min: 20, max: 49,  dose: '250-500mg daily', note: '' },
    { min: 0,  max: 19,  dose: '250mg q48h', note: '' }
  ]},
  'piperacillin': { normal: '4.5g IV q6-8h', byCrCl: [
    { min: 40, max: 999, dose: '4.5g q6h', note: '' },
    { min: 20, max: 39,  dose: '3.375g q6h', note: '' },
    { min: 0,  max: 19,  dose: '2.25g q6h', note: '' }
  ]},
  'cefazolin': { normal: '1-2g IV q8h', byCrCl: [
    { min: 55, max: 999, dose: '1-2g q8h', note: '' },
    { min: 35, max: 54,  dose: '1-2g q12h', note: '' },
    { min: 11, max: 34,  dose: '1g q24h', note: '' },
    { min: 0,  max: 10,  dose: '1g q48h', note: '' }
  ]},
  'ceftriaxone': { normal: '1-2g IV q24h', byCrCl: [
    { min: 0, max: 999, dose: 'دوز معمول (بدون تنظیم)', note: 'استثنا: هیچ تنظیمی لازم نیست' }
  ]},
  'ceftazidime': { normal: '1-2g IV q8h', byCrCl: [
    { min: 50, max: 999, dose: '1-2g q8h', note: '' },
    { min: 31, max: 49,  dose: '1g q12h', note: '' },
    { min: 16, max: 30,  dose: '1g q24h', note: '' },
    { min: 6,  max: 15,  dose: '500mg q24h', note: '' },
    { min: 0,  max: 5,   dose: '500mg q48h', note: '' }
  ]},
  'cefepime': { normal: '1-2g IV q8-12h', byCrCl: [
    { min: 60, max: 999, dose: 'دوز معمول', note: '' },
    { min: 30, max: 59,  dose: '1-2g q12h', note: '' },
    { min: 11, max: 29,  dose: '1-2g q24h', note: '' },
    { min: 0,  max: 10,  dose: '500mg-1g q24h', note: '' }
  ]},
  'colistin': { normal: '2.5-5 mg/kg/day ÷ 2-4 doses', byCrCl: [
    { min: 80, max: 999, dose: 'دوز معمول', note: '' },
    { min: 50, max: 79,  dose: '2.5-3.8 mg/kg/day', note: '' },
    { min: 30, max: 49,  dose: '2.5 mg/kg/day', note: '' },
    { min: 0,  max: 29,  dose: '1.5 mg/kg/day', note: 'پایش دقیق' }
  ]},
  'linezolid': { normal: '600mg IV/PO q12h', byCrCl: [
    { min: 0, max: 999, dose: 'دوز معمول (بدون تنظیم)', note: 'استثنا' }
  ]},
  'enoxaparin': { normal: '1 mg/kg SC q12h', byCrCl: [
    { min: 30, max: 999, dose: '1 mg/kg q12h', note: '' },
    { min: 0,  max: 29,  dose: '1 mg/kg q24h', note: 'پروفیلاکسی: 30mg q24h' }
  ]},
  'heparin': { normal: 'aPTT-adjusted', byCrCl: [
    { min: 0, max: 999, dose: 'aPTT-adjusted (بدون تنظیم کلیوی)', note: 'پایش aPTT' }
  ]},
  'warfarin': { normal: 'INR-adjusted', byCrCl: [
    { min: 0, max: 999, dose: 'INR-adjusted', note: 'INR هدف 2-3' }
  ]},
  'apixaban': { normal: '5mg PO BID', byCrCl: [
    { min: 30, max: 999, dose: '5mg BID', note: '' },
    { min: 15, max: 29,  dose: '2.5mg BID', note: 'یا معیارهای دیگر' },
    { min: 0,  max: 14,  dose: 'اجتناب', note: '' }
  ]},
  'rivaroxaban': { normal: '20mg PO daily', byCrCl: [
    { min: 50, max: 999, dose: '20mg daily', note: '' },
    { min: 15, max: 49,  dose: '15mg daily', note: '' },
    { min: 0,  max: 14,  dose: 'اجتناب', note: '' }
  ]},
  'dabigatran': { normal: '150mg PO BID', byCrCl: [
    { min: 50, max: 999, dose: '150mg BID', note: '' },
    { min: 30, max: 49,  dose: '75-150mg BID', note: '' },
    { min: 0,  max: 29,  dose: 'اجتناب', note: '' }
  ]},
  'digoxin': { normal: '0.125-0.25 mg PO daily', byCrCl: [
    { min: 60, max: 999, dose: '0.25mg daily', note: '' },
    { min: 30, max: 59,  dose: '0.125-0.25mg daily', note: 'سطح' },
    { min: 10, max: 29,  dose: '0.125mg q48h', note: 'دقیق' },
    { min: 0,  max: 9,   dose: '0.0625mg q48h', note: 'دقیق' }
  ]},
  'metoprolol': { normal: '25-100mg PO BID', byCrCl: [
    { min: 0, max: 999, dose: 'بدون تنظیم', note: '' }
  ]},
  'atenolol': { normal: '25-100mg PO daily', byCrCl: [
    { min: 35, max: 999, dose: 'دوز معمول', note: '' },
    { min: 15, max: 34,  dose: 'حداکثر 50mg daily', note: '' },
    { min: 0,  max: 14,  dose: '25mg daily یا q48h', note: '' }
  ]},
  'lisinopril': { normal: '5-40mg PO daily', byCrCl: [
    { min: 30, max: 999, dose: 'دوز معمول', note: '' },
    { min: 10, max: 29,  dose: 'شروع 2.5-5mg', note: '' },
    { min: 0,  max: 9,   dose: '2.5mg', note: '' }
  ]},
  'enalapril': { normal: '5-20mg PO BID', byCrCl: [
    { min: 30, max: 999, dose: 'دوز معمول', note: '' },
    { min: 10, max: 29,  dose: 'شروع 2.5mg', note: '' },
    { min: 0,  max: 9,   dose: '2.5mg' }
  ]},
  'losartan': { normal: '50-100mg PO daily', byCrCl: [
    { min: 0, max: 999, dose: 'بدون تنظیم', note: '' }
  ]},
  'spironolactone': { normal: '25-100mg PO daily', byCrCl: [
    { min: 30, max: 999, dose: 'دوز معمول', note: 'پایش K+' },
    { min: 0,  max: 29,  dose: 'اجتناب', note: '' }
  ]},
  'furosemide': { normal: '20-80mg PO/IV', byCrCl: [
    { min: 0, max: 999, dose: 'دوز بر اساس پاسخ (ممکن است نیاز به دوز بالاتر)', note: '' }
  ]},
  'metformin': { normal: '500-1000mg PO BID', byCrCl: [
    { min: 45, max: 999, dose: 'دوز معمول', note: '' },
    { min: 30, max: 44,  dose: 'کاهش دوز', note: 'Cr هر ۳ ماه' },
    { min: 0,  max: 29,  dose: 'منع مصرف', note: 'اسیدوز لاکتیک' }
  ]},
  'glipizide': { normal: '2.5-10mg PO daily', byCrCl: [
    { min: 0, max: 999, dose: 'شروع پایین + تیتراسیون', note: 'پایش BS' }
  ]},
  'gabapentin': { normal: '300-600mg PO TID', byCrCl: [
    { min: 60, max: 999, dose: '300-600mg TID', note: '' },
    { min: 30, max: 59,  dose: '200-400mg BID', note: '' },
    { min: 15, max: 29,  dose: '200-300mg daily', note: '' },
    { min: 0,  max: 14,  dose: '100-300mg daily', note: '' }
  ]},
  'pregabalin': { normal: '75-150mg PO BID', byCrCl: [
    { min: 60, max: 999, dose: '75-150mg BID', note: '' },
    { min: 30, max: 59,  dose: '75-150mg daily ÷ 1-2', note: '' },
    { min: 15, max: 29,  dose: '25-75mg daily', note: '' },
    { min: 0,  max: 14,  dose: '25-50mg daily', note: '' }
  ]},
  'levetiracetam': { normal: '500-1500mg PO/IV BID', byCrCl: [
    { min: 80, max: 999, dose: 'دوز معمول', note: '' },
    { min: 50, max: 79,  dose: '500-1000mg BID', note: '' },
    { min: 30, max: 49,  dose: '250-750mg BID', note: '' },
    { min: 0,  max: 29,  dose: '250-500mg BID', note: '' }
  ]},
  'morphine': { normal: '2-10mg IV/PO', byCrCl: [
    { min: 50, max: 999, dose: 'دوز معمول', note: '' },
    { min: 30, max: 49,  dose: 'کاهش دوز 25%', note: '' },
    { min: 10, max: 29,  dose: 'کاهش دوز 50%', note: 'متابولیت فعال' },
    { min: 0,  max: 9,   dose: 'اجتناب یا دوز بسیار پایین', note: '' }
  ]},
  'allopurinol': { normal: '100-300mg PO daily', byCrCl: [
    { min: 60, max: 999, dose: '300mg daily', note: '' },
    { min: 30, max: 59,  dose: '200mg daily', note: '' },
    { min: 15, max: 29,  dose: '100mg daily', note: '' },
    { min: 0,  max: 14,  dose: '100mg q48h', note: '' }
  ]},
  'colchicine': { normal: '0.6mg PO BID', byCrCl: [
    { min: 60, max: 999, dose: '0.6mg BID', note: '' },
    { min: 30, max: 59,  dose: '0.6mg daily', note: 'پایش' },
    { min: 0,  max: 29,  dose: 'اجتناب', note: '' }
  ]},
  'famotidine': { normal: '20-40mg PO daily', byCrCl: [
    { min: 50, max: 999, dose: 'دوز معمول', note: '' },
    { min: 30, max: 49,  dose: '50% دوز یا فاصله', note: '' },
    { min: 0,  max: 29,  dose: '25% دوز', note: '' }
  ]},
  'metoclopramide': { normal: '10mg PO/IV q6h', byCrCl: [
    { min: 60, max: 999, dose: 'دوز معمول', note: '' },
    { min: 30, max: 59,  dose: '75% دوز', note: '' },
    { min: 0,  max: 29,  dose: '50% دوز', note: 'خطر EPS بالا' }
  ]},
  'ranitidine': { normal: '150mg PO BID', byCrCl: [
    { min: 50, max: 999, dose: 'دوز معمول', note: '' },
    { min: 0,  max: 49,  dose: '150mg daily یا 50mg IV q18-24h', note: '' }
  ]},
  'amoxicillin': { normal: '500mg PO TID', byCrCl: [
    { min: 30, max: 999, dose: 'دوز معمول', note: '' },
    { min: 10, max: 29,  dose: '500mg BID', note: '' },
    { min: 0,  max: 9,   dose: '500mg daily', note: '' }
  ]}
};

function normalizeRenalDrug(name) {
  const c = canonicalDrug(name);
  if (RENAL_DOSING[c]) return c;
  const k = String(name || '').toLowerCase().trim();
  for (const drug of Object.keys(RENAL_DOSING)) {
    if (k.indexOf(drug) >= 0) return drug;
  }
  return null;
}

function renalDoseRecommend(crcl, drugName) {
  const key = normalizeRenalDrug(drugName);
  if (!key) return { drug: drugName, found: false, message: 'دارو در پایگاه داده نیست' };
  const data = RENAL_DOSING[key];
  const match = data.byCrCl.find(r => crcl >= r.min && crcl <= r.max);
  return {
    drug: key, found: true, crcl,
    normal: data.normal,
    recommended: match ? match.dose : 'نامشخص',
    note: match ? match.note : ''
  };
}

// ═══════════════════════════════════════════════════════════════
//  E — Smart Cooldown + JCI Read-Back
// ═══════════════════════════════════════════════════════════════
const _cooldown = new Map();

function _cooldownOk(key, severity, score) {
  const prev = _cooldown.get(key);
  const now = Date.now();
  // Only skip if same or lower severity AND same or lower score within 6h
  if (prev) {
    const age = now - prev.at;
    const prevSevRank = prev.severity === 'critical' ? 2 : 1;
    const curSevRank = severity === 'critical' ? 2 : 1;
    if (age < 6 * 3600000 && curSevRank <= prevSevRank) {
      if (score != null && prev.score != null && score <= prev.score) return false;
      if (score == null && severity !== 'critical') return false;
    }
  }
  _cooldown.set(key, { at: now, severity, score });
  return true;
}

function _saveAlert(alert) {
  try {
    const rec = Object.assign({
      id: store.uid('cdss_alert'),
      createdAt: new Date().toISOString(),
      dismissed: false,
      readBack: alert.severity === 'critical' ? { required: true, acknowledged: false, acknowledgedAt: null, acknowledgedBy: null } : null
    }, alert);
    store.put('cdss_alerts', rec);
    try { alert.id = rec.id; } catch (_) {}
    return rec;
  } catch (e) { console.warn('[cdss] save alert:', e.message); return null; }
}

// ═══════════════════════════════════════════════════════════════
//  F — Auto-alerts
// ═══════════════════════════════════════════════════════════════
bus.on('vitals.recorded', function(payload) {
  try {
    const v = payload.record || {};
    if (!v.patientId) return;
    const q = scoreQSOFA(v);
    if (q.score >= 2 && _cooldownOk('qsofa:' + v.patientId, q.score >= 3 ? 'critical' : 'warning', q.score)) {
      const alert = {
        type: 'qsofa_high',
        severity: q.score >= 3 ? 'critical' : 'warning',
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

    // ═══ Allergy check at order time (defense in depth) ═══
    const patient = store.get('patients', o.patientId);
    if (patient && patient.allergies && patient.allergies.length) {
      const dName = String(drug).toLowerCase();
      for (const aller of patient.allergies) {
        const aName = String(aller).toLowerCase();
        if (dName.indexOf(aName) >= 0) {
          const alert = {
            type: 'allergy_alert',
            severity: 'critical',
            patientId: o.patientId, patientName: o.patientName,
            allergy: aller, drug: drug,
            title: '⚠️ آلرژی — ' + (o.patientName || ''),
            message: 'دارو: ' + drug + ' — آلرژی: ' + aller,
            recommendation: 'اجتناب — جایگزین انتخاب کنید'
          };
          _saveAlert(alert);
          bus.emit('cdss.alert', alert);
          return;
        }
      }
    }

    // ═══ Drug interaction check ═══
    const active = store.readAll('orders')
      .filter(x => x.patientId === o.patientId && x.type === 'medication')
      .filter(x => ['verified', 'active', 'pending'].indexOf(x.status) >= 0)
      .map(x => (x.details && x.details.drug) || '')
      .filter(Boolean);
    const all = active.concat([drug]);
    const found = checkInteractions(all);
    const major = found.filter(f => f.severity === 'major');
    if (!major.length) return;
    if (!_cooldownOk('interaction:' + o.patientId + ':' + canonicalDrug(drug), 'critical', null)) return;
    const ix = major[0];
    const other = canonicalDrug(ix.drug1) === canonicalDrug(drug) ? ix.drug2 : ix.drug1;
    const alert = {
      type: 'drug_interaction',
      severity: 'critical',
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
//  G — Handlers
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
  const sirs = scoreSIRS(last, null, null);
  const news2 = { score: Number(last.news2) || 0, level: last.news2 >= 7 ? 'critical' : last.news2 >= 5 ? 'high' : 'low' };
  const composite = Math.min(100, (qsofa.score >= 2 ? 20 : 0) + (news2.score >= 5 ? 20 : 0) + missed * 5);
  return {
    patient: {
      id: p.id, name: p.firstName + ' ' + p.lastName,
      ward: p.wardCode, bed: p.bedNumber, age: p.age, sex: p.sex,
      diagnosis: p.diagnosis
    },
    scores: { qsofa, sirs, news2 },
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
  return { items: alerts.slice(0, 50), total: alerts.length };
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

// ═══ JCI: Acknowledge critical alert via read-back ═══
function acknowledgeAlert(ctx) {
  const a = ctx.store.get('cdss_alerts', ctx.params.id);
  if (!a) throw ctx.E.notFound('not_found');
  if (!a.readBack || !a.readBack.required) throw ctx.E.conflict('no_readback_required');
  if (a.readBack.acknowledged) throw ctx.E.conflict('already_acknowledged');
  if (!ctx.body.readBack) throw ctx.E.badRequest('read_back_required');
  a.readBack.acknowledged = true;
  a.readBack.acknowledgedAt = ctx.now();
  a.readBack.acknowledgedBy = ctx.actor.id;
  a.readBack.acknowledgedByName = ctx.actor.fullName || ctx.actor.username;
  a.readBack.text = ctx.body.readBack;
  a.readBack.note = ctx.body.note || '';
  ctx.store.put('cdss_alerts', a);
  ctx.bus.emit('cdss.alert.acknowledged', { record: a, actor: ctx.actor });
  return a;
}

module.exports = {
  handlers: {
    dashboard, computePatientScores,
    computeMorse, computeBraden, computeCURB65, computeWells, computeCrCl,
    drugInteractionCheck, renalDose, listDrugs,
    activeAlerts, dismissAlert, acknowledgeAlert
  },
  routes: [

    { method:'GET',  path:'/api/cdss/dashboard', handler:'dashboard', perm:'cdss.view' },
    { method:'POST', path:'/api/cdss/score/morse', handler:'computeMorse', perm:'cdss.view' },
    { method:'POST', path:'/api/cdss/score/braden', handler:'computeBraden', perm:'cdss.view' },
    { method:'POST', path:'/api/cdss/score/curb65', handler:'computeCURB65', perm:'cdss.view' },
    { method:'POST', path:'/api/cdss/score/wells', handler:'computeWells', perm:'cdss.view' },
    { method:'POST', path:'/api/cdss/score/crcl', handler:'computeCrCl', perm:'cdss.view' },
    { method:'POST', path:'/api/cdss/interactions', handler:'drugInteractionCheck', perm:'cdss.view' },
    { method:'POST', path:'/api/cdss/renal-dose', handler:'renalDose', perm:'cdss.view' },
    { method:'GET',  path:'/api/cdss/drugs', handler:'listDrugs', perm:'cdss.view' },
    { method:'GET',  path:'/api/cdss/alerts', handler:'activeAlerts', perm:'cdss.view' },
    { method:'GET',  path:'/api/cdss/patient/:patientId', handler:'computePatientScores', perm:'cdss.view' },
    { method:'POST', path:'/api/cdss/alerts/:id/dismiss', handler:'dismissAlert', perm:'cdss.view' },
    { method:'POST', path:'/api/cdss/alerts/:id/acknowledge', handler:'acknowledgeAlert', perm:'cdss.view' },
  
  ],
  panels: [
    { id:'dashboard', title:'موتور بالینی', icon:'🧠', perm:'cdss.view', kind:'cdss', api:'/api/cdss/dashboard' },
    { id:'alerts', title:'هشدارهای CDSS', icon:'🚨', perm:'cdss.view', kind:'list',
      api:'/api/cdss/alerts', fields:['type','severity','title','message'] }
  ]
};
