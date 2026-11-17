
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Clinical Protocols Expansion (v2)
//  Single file that enhances:
//   1. Order Sets:   5 → 20 (adds 15 evidence-based sets)
//   2. Pathways:     3 → 10 (adds 7 clinical pathways)
//   3. Order Hold/Unhold workflow
//   4. Vitals Escalation + Neural predictive models
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const bus = require('../core/events');
const store = require('../core/store');
const perms = require('../core/permissions');
const encounters = require('./encounters');
const neural = require('../core/neural');
const sm = require('../core/state-machine');

// ═══════════════════════════════════════════════════════════
//  Part 1 — 15 additional order sets
// ═══════════════════════════════════════════════════════════
const NEW_ORDER_SETS = {
  nstemi: {
    id:'nstemi', name:'NSTEMI — سندرم حاد کرونر', icon:'💔', category:'cardiac',
    description:'بسته NSTEMI — rule-in/rule-out + آنتی‌پلاکت',
    meds: [
      { drug:'Aspirin', dose:'325mg', route:'PO', frequency:'OD', durationDays:7, priority:'stat' },
      { drug:'Clopidogrel', dose:'300mg', route:'PO', frequency:'OD', durationDays:7, priority:'stat' },
      { drug:'Atorvastatin', dose:'80mg', route:'PO', frequency:'HS', durationDays:30, priority:'urgent' },
      { drug:'Metoprolol', dose:'25mg', route:'PO', frequency:'BID', durationDays:7, priority:'urgent' },
      { drug:'Nitroglycerin SL', dose:'0.4mg', route:'SL', frequency:'PRN', durationDays:1, priority:'stat', prn:true }
    ],
    labs: ['Troponin (serial 0-3-6h)','CBC','BMP','Coagulation','Lipid Profile','HbA1c'],
    imaging: [{ modality:'CXR', bodyPart:'Chest' }, { modality:'Echo', bodyPart:'Heart' }],
    consults: [{ service:'قلب و عروق', type:'urgent', question:'ارزیابی NSTEMI — cath/PCI?' }],
    nursing: ['پایش مداوم قلبی', 'O2 ۲-۴ لیتر', 'NPO تا تصمیم cath', 'دسترسی IV ×۲', 'پایش درد هر ۱۵ دقیقه'],
    diet:'NPO', activity:'استراحت مطلق', notes:'TIMI Risk Score + troponin سریال'
  },
  chf_exac: {
    id:'chf_exac', name:'CHF Exacerbation — تشدید نارسایی قلب', icon:'🫀', category:'cardiac',
    description:'بسته تشدید CHF — دیورز + مانیتور',
    meds: [
      { drug:'Furosemide', dose:'40mg', route:'IV', frequency:'BID', durationDays:3, priority:'stat' },
      { drug:'Carvedilol', dose:'6.25mg', route:'PO', frequency:'BID', durationDays:30, priority:'routine' },
      { drug:'Spironolactone', dose:'25mg', route:'PO', frequency:'OD', durationDays:30, priority:'routine' },
      { drug:'Sacubitril/Valsartan', dose:'24/26mg', route:'PO', frequency:'BID', durationDays:30, priority:'routine' },
      { drug:'Oxygen', dose:'2-4 L/min', route:'Nasal Cannula', frequency:'Cont', durationDays:3, priority:'stat' }
    ],
    labs: ['BNP','BMP','CBC','TSH','Iron Studies','Urinalysis'],
    imaging: [{ modality:'CXR', bodyPart:'Chest' }, { modality:'Echo', bodyPart:'Heart' }],
    consults: [{ service:'قلب و عروق', type:'urgent', question:'ارزیابی حجم + بهینه‌سازی درمان' }],
    nursing: ['I/O دقیق ساعتی', 'وزن روزانه', 'پایش SpO₂', 'ارزیابی ادم هر شیفت', 'پایش K+ هر ۸ ساعت'],
    diet:'کم‌نمک ۲g', activity:'نیمه‌نشسته', notes:'صفر کردن مایعات پس از ۲۴h دیورز'
  },
  af_rvr: {
    id:'af_rvr', name:'AF با RVR — فیبریلاسیون دهلیزی', icon:'💓', category:'cardiac',
    description:'بسته AF با پاسخ بطنی سریع',
    meds: [
      { drug:'Metoprolol', dose:'5mg', route:'IV', frequency:'PRN', durationDays:1, priority:'stat', prn:true },
      { drug:'Diltiazem', dose:'10mg', route:'IV', frequency:'PRN', durationDays:1, priority:'stat', prn:true },
      { drug:'Apixaban', dose:'5mg', route:'PO', frequency:'BID', durationDays:30, priority:'urgent' },
      { drug:'Amiodarone', dose:'150mg', route:'IV', frequency:'once', durationDays:1, priority:'stat' }
    ],
    labs: ['BMP','TSH','CBC','Coagulation','Troponin'],
    imaging: [{ modality:'ECG 12-lead', bodyPart:'Heart' }, { modality:'Echo', bodyPart:'Heart' }],
    consults: [{ service:'قلب و عروق', type:'urgent', question:'استراتژی rate vs rhythm control' }],
    nursing: ['پایش ECG مداوم', 'پایش HR هر ۱۵ دقیقه تا پایدار', 'O2 اگر SpO₂<92', 'دسترسی IV'],
    diet:'رژیم معمولی', activity:'استراحت نسبی', notes:'هدف HR < 110 — CHA₂DS₂-VASc'
  },
  htn_emergency: {
    id:'htn_emergency', name:'Hypertensive Emergency — فشار خون بحرانی', icon:'🩸', category:'cardiac',
    description:'بسته فشار خون بحرانی (>180/120 + آسیب ارگان)',
    meds: [
      { drug:'Labetalol', dose:'20mg', route:'IV', frequency:'PRN', durationDays:1, priority:'stat', prn:true },
      { drug:'Nicardipine', dose:'5 mg/h', route:'IV Infusion', frequency:'Cont', durationDays:2, priority:'stat' },
      { drug:'Nitroglycerin', dose:'5 mcg/min', route:'IV Infusion', frequency:'Cont', durationDays:2, priority:'stat' }
    ],
    labs: ['BMP','CBC','Troponin','Urinalysis','Peripheral Smear'],
    imaging: [{ modality:'CT Head', bodyPart:'Brain' }, { modality:'CXR', bodyPart:'Chest' }],
    consults: [{ service:'قلب و عروق', type:'emergency', question:'فشار بحرانی — مدیریت فوری' }],
    nursing: ['پایش BP هر ۵ دقیقه اولیه', 'دو راه IV', 'پایش نورولوژیک', 'I/O دقیق', 'پایش عوارض IV'],
    diet:'NPO تا پایدار', activity:'استراحت مطلق', notes:'کاهش BP حداکثر ۲۵٪ در ۱ ساعت اول'
  },
  status_epilepticus: {
    id:'status_epilepticus', name:'Status Epilepticus — تشنج پایدار', icon:'🧠', category:'neuro',
    description:'بسته تشنج >5 دقیقه — پروتکل زمان‌بندی‌شده',
    meds: [
      { drug:'Lorazepam', dose:'4mg', route:'IV', frequency:'once', durationDays:1, priority:'stat' },
      { drug:'Midazolam', dose:'10mg', route:'IM', frequency:'PRN', durationDays:1, priority:'stat', prn:true },
      { drug:'Phenytoin', dose:'20 mg/kg', route:'IV', frequency:'once', durationDays:1, priority:'stat' },
      { drug:'Levetiracetam', dose:'60 mg/kg', route:'IV', frequency:'once', durationDays:1, priority:'urgent' }
    ],
    labs: ['Glucose','BMP','CBC','Ca/Mg','Antiepileptic levels','ABG','Toxicology'],
    imaging: [{ modality:'CT Head', bodyPart:'Brain' }],
    consults: [{ service:'نورولوژی', type:'emergency', question:'مدیریت Status Epilepticus' }],
    nursing: ['Airway protection', 'O2 ۱۵L mask', 'پایش نورولوژیک', 'NPO', 'پد روی تخت', 'پایش تشنج recurrence'],
    diet:'NPO', activity:'استراحت مطلق', notes:'بنزودیازپین سریع + فنی‌توئین/لوتیراستام ظرف ۲۰ دقیقه'
  },
  pe: {
    id:'pe', name:'Pulmonary Embolism — آمبولی ریه', icon:'🫁', category:'respiratory',
    description:'بسته PE — anticoag + پایش',
    meds: [
      { drug:'Enoxaparin', dose:'1 mg/kg', route:'SC', frequency:'Q12H', durationDays:7, priority:'stat', isHighAlert:true },
      { drug:'Oxygen', dose:'2-4 L/min', route:'Nasal Cannula', frequency:'Cont', durationDays:3, priority:'stat' },
      { drug:'Warfarin', dose:'5mg', route:'PO', frequency:'OD', durationDays:30, priority:'routine' }
    ],
    labs: ['D-dimer','Troponin','BNP','ABG','CBC','Coagulation','BMP'],
    imaging: [{ modality:'CT Angiography', bodyPart:'Chest' }, { modality:'Echo', bodyPart:'Heart' }, { modality:'Lower Extremity Doppler', bodyPart:'Legs' }],
    consults: [{ service:'ریه', type:'emergency', question:'PE massiveness — thrombolysis?' }, { service:'قلب و عروق', type:'urgent', question:'RV strain' }],
    nursing: ['پایش SpO₂ مداوم', 'O2 هدف 92-96%', 'پایش علائم DVT', 'پایش خونریزی', 'دسترسی IV'],
    diet:'رژیم معمولی', activity:'استراحت مطلق ۲۴h اول', notes:'Wells Score + sPESI — شروع OAC ظرف ۶ ساعت'
  },
  dvt: {
    id:'dvt', name:'DVT — ترومبوز ورید عمقی', icon:'🦵', category:'hematology',
    description:'بسته DVT پروکسیمال',
    meds: [
      { drug:'Enoxaparin', dose:'1 mg/kg', route:'SC', frequency:'Q12H', durationDays:7, priority:'stat', isHighAlert:true },
      { drug:'Warfarin', dose:'5mg', route:'PO', frequency:'OD', durationDays:90, priority:'routine' }
    ],
    labs: ['Coagulation','CBC','BMP','D-dimer'],
    imaging: [{ modality:'Lower Extremity Doppler', bodyPart:'Legs' }],
    consults: [{ service:'قلب و عروق', type:'urgent', question:'مدت anticoag' }],
    nursing: ['پایش علائم PE', 'ارتفاع اندام ۳۰°', 'کمپرس گرم', 'پایش خونریزی', 'آموزش بیمار'],
    diet:'رژیم معمولی', activity:'راه‌رفتن با محدودیت', notes:'DOAC اولویت اگر عدم contraindication'
  },
  copd_exac: {
    id:'copd_exac', name:'COPD Exacerbation — تشدید COPD', icon:'🫁', category:'respiratory',
    description:'بسته تشدید COPD',
    meds: [
      { drug:'Albuterol/Ipratropium', dose:'2.5-0.5 mg', route:'Neb', frequency:'Q4H', durationDays:3, priority:'stat' },
      { drug:'Prednisone', dose:'40mg', route:'PO', frequency:'OD', durationDays:5, priority:'urgent' },
      { drug:'Ceftriaxone', dose:'1g', route:'IV', frequency:'Q24H', durationDays:5, priority:'urgent' },
      { drug:'Azithromycin', dose:'500mg', route:'IV', frequency:'Q24H', durationDays:3, priority:'urgent' }
    ],
    labs: ['ABG','CBC','BMP','Sputum Culture','CXR'],
    imaging: [{ modality:'CXR', bodyPart:'Chest' }],
    consults: [{ service:'ریه', type:'urgent', question:'NIV candidacy' }],
    nursing: ['پایش SpO₂ هدف 88-92%', 'NIV trial اگر pH<7.35', 'پایش ABG هر ۲ ساعت اولیه', 'ارزیابی تنفس'],
    diet:'رژیم معمولی', activity:'نیمه‌نشسته', notes:'Controlled O2 target 88-92% — جلوگیری از hypercapnia'
  },
  asthma_exac: {
    id:'asthma_exac', name:'Asthma Exacerbation — حمله آسم', icon:'🫁', category:'respiratory',
    description:'بسته حمله آسم شدید',
    meds: [
      { drug:'Albuterol', dose:'2.5mg', route:'Neb', frequency:'Q20min×3', durationDays:1, priority:'stat' },
      { drug:'Ipratropium', dose:'0.5mg', route:'Neb', frequency:'Q20min×3', durationDays:1, priority:'stat' },
      { drug:'Prednisone', dose:'60mg', route:'PO', frequency:'OD', durationDays:5, priority:'urgent' },
      { drug:'Magnesium Sulfate', dose:'2g', route:'IV', frequency:'once', durationDays:1, priority:'urgent' }
    ],
    labs: ['ABG','CBC','BMP','Peak Flow'],
    imaging: [{ modality:'CXR', bodyPart:'Chest' }],
    consults: [{ service:'ریه', type:'urgent', question:'Severity + disposition' }],
    nursing: ['پایش SpO₂ مداوم', 'Peak flow قبل/بعد', 'ارزیابی WOB', 'پایش پاسخ برونکودیلاتور'],
    diet:'رژیم معمولی', activity:'نیمه‌نشسته', notes:'Severity: mild/moderate/severe/life-threatening — mag در severe'
  },
  gi_bleed: {
    id:'gi_bleed', name:'Upper GI Bleed — خونریزی گوارشی فوقانی', icon:'🩸', category:'gastro',
    description:'بسته خونریزی گوارشی فوقانی',
    meds: [
      { drug:'Pantoprazole', dose:'80mg', route:'IV', frequency:'Bolus then 8mg/h', durationDays:3, priority:'stat' },
      { drug:'Octreotide', dose:'50 mcg', route:'IV', frequency:'Bolus then 50 mcg/h', durationDays:3, priority:'urgent' },
      { drug:'Ceftriaxone', dose:'1g', route:'IV', frequency:'Q24H', durationDays:3, priority:'urgent' },
      { drug:'NS 0.9%', dose:'1L', route:'IV', frequency:'PRN', durationDays:1, priority:'stat', prn:true }
    ],
    labs: ['CBC','BMP','Coagulation','Type & Crossmatch 2 units','LFT'],
    imaging: [{ modality:'EGD (endoscopy)', bodyPart:'Upper GI', timing:'<24h' }],
    consults: [{ service:'گوارش', type:'emergency', question:'EGD فوری' }],
    nursing: ['پایش hemodynamic هر ۱۵ دقیقه', 'NG lavage', 'I/O دقیق', 'پایش Hb سریال', 'دو راه IV بزرگ'],
    diet:'NPO', activity:'استراحت مطلق', notes:'Glasgow-Blatchford Score — ترانسفوزیون اگر Hb<7 (target 7-8)'
  },
  pancreatitis: {
    id:'pancreatitis', name:'Acute Pancreatitis — پانکراتیت حاد', icon:'🔥', category:'gastro',
    description:'بسته پانکراتیت حاد',
    meds: [
      { drug:'NS 0.9%', dose:'5-10 ml/kg/h', route:'IV', frequency:'Cont', durationDays:2, priority:'stat' },
      { drug:'Morphine', dose:'2-4mg', route:'IV', frequency:'PRN', durationDays:3, priority:'urgent', isHighAlert:true, prn:true },
      { drug:'Ondansetron', dose:'4mg', route:'IV', frequency:'Q6H PRN', durationDays:3, priority:'routine', prn:true }
    ],
    labs: ['Lipase','Amylase','CBC','BMP','LFT','Triglycerides','Ca','CRP'],
    imaging: [{ modality:'RUQ Ultrasound', bodyPart:'Abdomen' }, { modality:'CT Abdomen w/contrast', bodyPart:'Abdomen', timing:'72-96h' }],
    consults: [{ service:'گوارش', type:'urgent', question:'شدت + علت' }],
    nursing: ['NPO تا بهبود', 'پایش I/O', 'پایش درد', 'پوزیشن راحت', 'پایش BS در DM'],
    diet:'NPO → رژیم کم‌چرب تدریجی', activity:'استراحت', notes:'BISAP Score — fluid 5-10ml/kg/h اول 24-48h'
  },
  hyperkalemia: {
    id:'hyperkalemia', name:'Hyperkalemia — پتاسیم بالا', icon:'⚡', category:'renal',
    description:'بسته K+ بحرانی (>6.5 یا با تغییرات ECG)',
    meds: [
      { drug:'Calcium Gluconate', dose:'1g', route:'IV', frequency:'once', durationDays:1, priority:'stat' },
      { drug:'Insulin Regular', dose:'10U', route:'IV', frequency:'once', durationDays:1, priority:'stat', isHighAlert:true },
      { drug:'Dextrose 50%', dose:'25g', route:'IV', frequency:'once', durationDays:1, priority:'stat' },
      { drug:'Sodium Polystyrene', dose:'15g', route:'PO/PR', frequency:'Q6H', durationDays:1, priority:'urgent' },
      { drug:'Salbutamol', dose:'10-20mg', route:'Neb', frequency:'once', durationDays:1, priority:'urgent' }
    ],
    labs: ['BMP (K+ stat)','ABG','ECG','Glucose','CBC'],
    imaging: [{ modality:'ECG 12-lead', bodyPart:'Heart' }],
    consults: [{ service:'نفرولوژی', type:'emergency', question:'HD indication' }],
    nursing: ['پایش ECG مداوم', 'پایش BS هر ۳۰ دقیقه پس از انسولین', 'دسترسی IV بزرگ', 'پایش K+ سریال'],
    diet:'کم‌پتاسیم', activity:'استراحت + پایش', notes:'اگر تغییرات ECG → کلسیم فوری. دیالیز اگر مقاوم'
  },
  anaphylaxis: {
    id:'anaphylaxis', name:'Anaphylaxis — آنافیلاکسی', icon:'⚠️', category:'emergency',
    description:'بسته آنافیلاکسی — Epi first',
    meds: [
      { drug:'Epinephrine', dose:'0.3-0.5mg', route:'IM (thigh)', frequency:'PRN Q5-15min', durationDays:1, priority:'stat', isHighAlert:true, prn:true },
      { drug:'Diphenhydramine', dose:'50mg', route:'IV', frequency:'once', durationDays:1, priority:'urgent' },
      { drug:'Methylprednisolone', dose:'125mg', route:'IV', frequency:'once', durationDays:1, priority:'urgent' },
      { drug:'Famotidine', dose:'20mg', route:'IV', frequency:'once', durationDays:1, priority:'urgent' },
      { drug:'NS 0.9%', dose:'1-2L', route:'IV', frequency:'rapid bolus', durationDays:1, priority:'stat' }
    ],
    labs: ['Tryptase (post-event)','CBC','BMP'],
    imaging: [],
    consults: [{ service:'آلرژی/ایمونولوژی', type:'urgent', question:'ارزیابی trigger + آموزش EpiPen' }],
    nursing: ['Adrenaline first IM', 'O2 ۱۵L mask', 'پایش SpO₂ + BP مداوم', 'دو راه IV', 'پایش biphasic reaction 4-6h'],
    diet:'NPO', activity:'استراحت مطلق', notes:'Epi تأخیر = مرگ. observer 4-6h برای biphasic'
  },
  opioid_od: {
    id:'opioid_od', name:'Opioid Overdose — مسمومیت اپیوئیدی', icon:'💉', category:'toxicology',
    description:'بسته OD اپیوئید',
    meds: [
      { drug:'Naloxone', dose:'0.4mg', route:'IV', frequency:'PRN Q2-3min', durationDays:1, priority:'stat', prn:true },
      { drug:'Naloxone Infusion', dose:'2/3 of arousal dose/h', route:'IV Infusion', frequency:'Cont', durationDays:1, priority:'urgent' }
    ],
    labs: ['ABG','BMP','CBC','Toxicology Screen','Acetaminophen level','Glucose'],
    imaging: [{ modality:'CXR', bodyPart:'Chest' }],
    consults: [{ service:'سم‌شناسی', type:'urgent', question:'مدیریت + disposition' }],
    nursing: ['پایش تنفس + SpO₂ مداوم', 'Airway readiness', 'پایش withdrawal پس از naloxone', 'پایش re-sedation'],
    diet:'NPO', activity:'استراحت + پایش', notes:'Naloxone half-life کوتاه‌تر از اپیوئید — نیاز infusion یا observe 4h'
  },
  alcohol_wd: {
    id:'alcohol_wd', name:'Alcohol Withdrawal — ترک الکل', icon:'🍺', category:'psychiatric',
    description:'بسته ترک الکل با CIWA',
    meds: [
      { drug:'Thiamine', dose:'100mg', route:'IV', frequency:'OD', durationDays:5, priority:'stat' },
      { drug:'Folic Acid', dose:'1mg', route:'PO', frequency:'OD', durationDays:5, priority:'routine' },
      { drug:'Chlordiazepoxide', dose:'25-50mg', route:'PO', frequency:'CIWA-based', durationDays:5, priority:'urgent' },
      { drug:'Dextrose 5%', dose:'1L', route:'IV', frequency:'Cont', durationDays:2, priority:'routine' }
    ],
    labs: ['BMP','LFT','CBC','Coagulation','Mg','Phos','Ammonia'],
    imaging: [],
    consults: [{ service:'روان‌پزشکی', type:'urgent', question:'مدیریت withdrawal + disposition' }],
    nursing: ['CIWA هر ۱-۲ ساعت اولیه', 'پایش seizure', 'پایش DT', 'Fall precautions', 'پایش SpO₂ + تعادل'],
    diet:'رژیم معمولی + thiamine قبل glucose', activity:'Fall precautions', notes:'Thiamine قبل گلوکز (جلوگیری از Wernicke). CIWA > 8 → بنزو'
  }
};

// Merge into encounters._orderSets
if (encounters._orderSets) {
  Object.assign(encounters._orderSets, NEW_ORDER_SETS);
}

// ═══════════════════════════════════════════════════════════
//  Part 2 — 7 additional clinical pathways
// ═══════════════════════════════════════════════════════════
const NEW_PATHWAYS = {
  chest_pain_pathway: {
    id:'chest_pain_pathway', name:'مسیر Chest Pain', icon:'💔', totalMinutes:360,
    milestones: [
      { offset:0,   label:'ECG ۱۲ لید', critical:true },
      { offset:10,  label:'Troponin اول', critical:true },
      { offset:60,  label:'Troponin ۱h delta', critical:true },
      { offset:180, label:'Troponin ۳h', critical:false },
      { offset:360, label:'تصمیم disposition', critical:true }
    ]
  },
  pe_pathway: {
    id:'pe_pathway', name:'مسیر PE', icon:'🫁', totalMinutes:240,
    milestones: [
      { offset:0,   label:'Wells Score', critical:true },
      { offset:30,  label:'D-dimer (age-adjusted)', critical:true },
      { offset:120, label:'CT Angiography', critical:true },
      { offset:180, label:'شروع anticoagulant', critical:true },
      { offset:240, label:'Echo + Troponin', critical:false }
    ]
  },
  gi_bleed_pathway: {
    id:'gi_bleed_pathway', name:'مسیر GI Bleed', icon:'🩸', totalMinutes:1440,
    milestones: [
      { offset:0,   label:'Glasgow-Blatchford Score', critical:true },
      { offset:30,  label:'دو راه IV بزرگ', critical:true },
      { offset:60,  label:'PPI IV bolus', critical:true },
      { offset:120, label:'Type & Crossmatch', critical:true },
      { offset:360, label:'EGD انجام شد', critical:true },
      { offset:1440,label:'ارزیابی ۲۴h', critical:false }
    ]
  },
  dka_pathway: {
    id:'dka_pathway', name:'مسیر DKA', icon:'💧', totalMinutes:1440,
    milestones: [
      { offset:0,   label:'ABG + K+ اولیه', critical:true },
      { offset:30,  label:'شروع NS 0.9%', critical:true },
      { offset:60,  label:'انسولین IV (پس از K≥3.3)', critical:true },
      { offset:120, label:'K+ هر ۲ ساعت', critical:true },
      { offset:360, label:'گلوکز < 250 → D5NS', critical:true },
      { offset:720, label:'AG بسته شد', critical:false },
      { offset:1440,label:'transition به SC', critical:false }
    ]
  },
  chf_pathway: {
    id:'chf_pathway', name:'مسیر CHF', icon:'🫀', totalMinutes:2880,
    milestones: [
      { offset:0,   label:'BNP + Echo', critical:true },
      { offset:60,  label:'Furosemide IV', critical:true },
      { offset:360, label:'I/O ۶h ارزیابی', critical:true },
      { offset:1440,label:'وزن روزانه + K+', critical:true },
      { offset:2880,label:'بهینه‌سازی GDMT', critical:false }
    ]
  },
  anaphylaxis_pathway: {
    id:'anaphylaxis_pathway', name:'مسیر Anaphylaxis', icon:'⚠️', totalMinutes:360,
    milestones: [
      { offset:0,   label:'Epi IM فوری', critical:true },
      { offset:5,   label:'O2 + IV access', critical:true },
      { offset:15,  label:'Antihistamine + Steroid', critical:true },
      { offset:60,  label:'ارزیابی پاسخ', critical:true },
      { offset:360, label:'مشاهده biphasic', critical:false }
    ]
  },
  postop_fever_pathway: {
    id:'postop_fever_pathway', name:'مسیر Post-op Fever', icon:'🌡', totalMinutes:1440,
    milestones: [
      { offset:0,   label:'ارزیابی A-B-C + wound', critical:true },
      { offset:60,  label:'کشت خون ×۲', critical:true },
      { offset:120, label:'CXR + UA', critical:false },
      { offset:240, label:'تصمیم آنتی‌بیوتیک', critical:true },
      { offset:1440,label:'ارزیابی ۲۴h', critical:false }
    ]
  }
};

if (encounters._pathways) {
  Object.assign(encounters._pathways, NEW_PATHWAYS);
}

// ═══════════════════════════════════════════════════════════
//  Part 3 — Order Hold / Unhold (new permissions + handlers)
// ═══════════════════════════════════════════════════════════
if (!perms.P['kardex.order.hold']) {
  perms.P['kardex.order.hold'] = 'admin,attending,specialist,physician,resident,head_nurse,supervisor_clinical';
}

function orderHold(ctx) {
  const b = ctx.body || {};
  if (!b.reason) throw ctx.E.badRequest('reason_required');
  const o = require('../core/domain/order-writer').transition(ctx, ctx.params.id, 'hold', {
    fields: {
      holdReason: b.reason,
      holdUntil: b.durationMinutes
        ? new Date(Date.now() + Number(b.durationMinutes) * 60000).toISOString()
        : null,
      heldBy: ctx.actor.id,
      heldByName: ctx.actor.fullName || ctx.actor.username,
      heldAt: ctx.now()
    },
    event: 'kardex.order.held'
  });
  ctx.audit.write('clinical_protocols', 'order.hold', o.id, ctx.actor, { reason: b.reason, until: o.holdUntil });
  return o;
}

function orderUnhold(ctx) {
  const o = require('../core/domain/order-writer').transition(ctx, ctx.params.id, 'unhold', {
    fields: {
      unholdReason: (ctx.body && ctx.body.reason) || '',
      unheldBy: ctx.actor.id,
      unheldByName: ctx.actor.fullName || ctx.actor.username,
      unheldAt: ctx.now()
    },
    event: 'kardex.order.unheld'
  });
  ctx.audit.write('clinical_protocols', 'order.unhold', o.id, ctx.actor, { reason: o.unholdReason });
  return o;
}

// ═══════════════════════════════════════════════════════════
//  Part 4a — Vitals Escalation (auto-alert on trend)
// ═══════════════════════════════════════════════════════════
const _escalationCooldown = new Map();

bus.on('vitals.recorded', function(payload) {
  try {
    const v = payload.record || {};
    if (!v.patientId) return;
    const prev = h({ store }, 'vitals')
      .filter(x => x.patientId === v.patientId && x.id !== v.id)
      .sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt))[0];
    const news = Number(v.news2) || 0;
    const prevNews = prev ? (Number(prev.news2) || 0) : null;
    const delta = prevNews != null ? news - prevNews : null;

    let reason = null, severity = null;
    if (news >= 7 && (!prevNews || prevNews < 7)) {
      reason = 'NEWS2 crossed critical threshold (7)';
      severity = 'critical';
    } else if (delta != null && delta >= 3) {
      reason = 'NEWS2 increased by ' + delta + ' in short interval';
      severity = 'critical';
    } else if (news >= 5 && (!prevNews || prevNews < 5)) {
      reason = 'NEWS2 crossed high threshold (5)';
      severity = 'warning';
    } else if (delta != null && delta >= 2) {
      reason = 'NEWS2 increased by ' + delta;
      severity = 'warning';
    }

    if (!reason) return;
    const key = 'escalate:' + v.patientId;
    const last = _escalationCooldown.get(key);
    if (last && Date.now() - last < 30 * 60000) return;
    _escalationCooldown.set(key, Date.now());

    bus.emit('cdss.alert', {
      type: 'vitals_escalation',
      severity,
      patientId: v.patientId,
      patientName: v.patientName,
      score: news,
      title: (severity === 'critical' ? '🚨 ' : '⚠️ ') + 'Escalation — ' + (v.patientName || ''),
      message: reason + ' (NEWS2 ' + (prevNews != null ? prevNews + ' → ' : '') + news + ')',
      recommendation: severity === 'critical'
        ? 'اطلاع فوری پزشک + بررسی ABC + شروع RRT'
        : 'بازبینی بالینی + ارزیابی بیشتر'
    });
  } catch (e) { console.warn('[protocols] escalation:', e.message); }
});

// ═══════════════════════════════════════════════════════════
//  Part 4b — Neural Enhancement (deterioration + readmission)
// ═══════════════════════════════════════════════════════════
neural.deteriorationIndex = function(patient, context) {
  if (!patient) return { score: 0, level: 'unknown', factors: [] };
  const v = (context && context.lastVital) || {};
  const factors = [];
  let score = 0;

  // NEWS2 component
  const news = Number(v.news2) || 0;
  if (news >= 7) { score += 45; factors.push({ feature: 'NEWS2 ≥ 7', weight: 45 }); }
  else if (news >= 5) { score += 25; factors.push({ feature: 'NEWS2 5-6', weight: 25 }); }
  else if (news >= 3) { score += 10; factors.push({ feature: 'NEWS2 3-4', weight: 10 }); }

  // Trend (if previous vitals)
  const history = (context && context.vitalsHistory) || [];
  if (history.length >= 2) {
    const recent = history.slice(0, 3).map(x => Number(x.news2) || 0);
    const slope = recent[0] - recent[recent.length - 1];
    if (slope >= 3) { score += 15; factors.push({ feature: 'NEWS2 rising +' + slope, weight: 15 }); }
    else if (slope <= -2) { score -= 5; factors.push({ feature: 'NEWS2 improving', weight: -5 }); }
  }

  // Lactate
  const lactate = Number(context && context.lastLactate);
  if (lactate >= 4) { score += 20; factors.push({ feature: 'Lactate ≥ 4', weight: 20 }); }
  else if (lactate >= 2) { score += 10; factors.push({ feature: 'Lactate 2-3.9', weight: 10 }); }

  // Missed MAR
  const missed = Number(context && context.missedMar) || 0;
  if (missed >= 3) { score += 10; factors.push({ feature: missed + ' missed doses', weight: 10 }); }

  // Age
  const age = Number(patient.age) || 50;
  if (age >= 80) { score += 8; factors.push({ feature: 'Age ≥ 80', weight: 8 }); }
  else if (age >= 70) { score += 4; factors.push({ feature: 'Age 70-79', weight: 4 }); }

  // Code status (DNR means we may not escalate)
  if (patient.codeStatus === 'dnr' || patient.codeStatus === 'dni') {
    score -= 10;
    factors.push({ feature: 'DNR/DNI — comfort focus', weight: -10 });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 25 ? 'moderate' : 'low';

  // Estimate time horizon
  let horizon = 'stable';
  if (score >= 70) horizon = '1-2h';
  else if (score >= 45) horizon = '6-12h';
  else if (score >= 25) horizon = '24-48h';

  return {
    score, level, horizon, factors,
    recommendation:
      score >= 70 ? 'اطلاع فوری پزشک + RRT + بازبینی ABC' :
      score >= 45 ? 'ارزیابی بالینی فوری + اطلاع head nurse' :
      score >= 25 ? 'پایش دقیق‌تر + ارزیابی مجدد در ۲ ساعت' :
      'پایش روتین',
    generatedAt: new Date().toISOString()
  };
};

neural.readmissionRisk = function(patient) {
  if (!patient) return { score: 0, level: 'unknown', factors: [] };
  const factors = [];
  let score = 15; // baseline

  // Age
  const age = Number(patient.age) || 50;
  if (age >= 75) { score += 15; factors.push({ feature: 'Age ≥ 75', weight: 15 }); }
  else if (age >= 65) { score += 8; factors.push({ feature: 'Age 65-74', weight: 8 }); }

  // Comorbidities
  const comorb = (patient.comorbidities || []).length;
  if (comorb >= 4) { score += 20; factors.push({ feature: comorb + ' comorbidities', weight: 20 }); }
  else if (comorb >= 2) { score += 10; factors.push({ feature: comorb + ' comorbidities', weight: 10 }); }

  // Diagnosis category (LACE-like)
  const dx = String(patient.diagnosis || '').toLowerCase();
  const highRiskDx = ['chf','copd','pneumonia','ami','sepsis','diabetes','renal','ckd','cancer'];
  for (const k of highRiskDx) {
    if (dx.indexOf(k) >= 0) { score += 12; factors.push({ feature: 'Diagnosis: ' + k, weight: 12 }); break; }
  }

  // Recent admissions (from context if available)
  const recentAdmits = (patient.recentAdmissions || 0);
  if (recentAdmits >= 2) { score += 25; factors.push({ feature: recentAdmits + ' admissions in 6mo', weight: 25 }); }
  else if (recentAdmits === 1) { score += 12; factors.push({ feature: '1 admission in 6mo', weight: 12 }); }

  // Length of stay (proxy)
  const admitted = patient.admittedAt ? sd(patient.admittedAt) : 0;
  const los = admitted ? (Date.now() - admitted) / 86400000 : 0;
  if (los >= 7) { score += 10; factors.push({ feature: 'LOS ≥ 7d', weight: 10 }); }

  // Code status
  if (patient.codeStatus === 'dnr') { score -= 20; factors.push({ feature: 'DNR — hospice focus', weight: -20 }); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 60 ? 'high' : score >= 30 ? 'moderate' : 'low';
  return {
    score, level, factors,
    window: '30-day',
    recommendation:
      score >= 60 ? 'شروع discharge planning زودتر + follow-up ظرف ۷۲h + transition care' :
      score >= 30 ? 'آموزش بیمار + تعیین appointment ۷ روزه' :
      'ترخیص استاندارد',
    generatedAt: new Date().toISOString()
  };
};

// ═══════════════════════════════════════════════════════════
//  Handlers (routes appended to encounters + new routes)
// ═══════════════════════════════════════════════════════════
function listAllOrderSets(ctx) {
  const sets = encounters._orderSets ? Object.values(encounters._orderSets) : [];
  return { items: sets, total: sets.length };
}

function listAllPathways(ctx) {
  const pws = encounters._pathways ? Object.values(encounters._pathways) : [];
  return { items: pws, total: pws.length };
}

function deterioration(ctx) {
  const pid = ctx.params.patientId;
  const patient = store.get('patients', pid);
  if (!patient) throw ctx.E.notFound('patient_not_found');
  const vitals = h(ctx, 'vitals').filter(v => v.patientId === pid)
    .sort((a, b) => sd(b.recordedAt) - sd(a.recordedAt));
  const labs = h(ctx, 'labs').filter(l => l.patientId === pid);
  const lastLactate = (labs.find(l => l.results && l.results.Lactate) || {}).results?.Lactate
    || (labs.find(l => l.results && l.results['Lactate']) || {}).results?.['Lactate'];
  const mar = h(ctx, 'mar').filter(m => m.patientId === pid);
  const missedMar = mar.filter(m => m.status === 'missed').length;
  return neural.deteriorationIndex(patient, {
    lastVital: vitals[0],
    vitalsHistory: vitals.slice(0, 5),
    lastLactate,
    missedMar
  });
}

function readmission(ctx) {
  const pid = ctx.params.patientId;
  const patient = store.get('patients', pid);
  if (!patient) throw ctx.E.notFound('patient_not_found');
  // Recent admissions from discharged patients same MRN
  const priorAdmissions = h(ctx, 'patients')
    .filter(p => p.mrn === patient.mrn && p.id !== patient.id && p.dischargedAt &&
      (Date.now() - sd(p.dischargedAt)) < 180 * 86400000).length;
  const enriched = Object.assign({}, patient, { recentAdmissions: priorAdmissions });
  return neural.readmissionRisk(enriched);
}

module.exports = {
  handlers: {
    listAllOrderSets, listAllPathways,
    orderHold, orderUnhold,
    deterioration, readmission
  },
  routes: [
    { method:'GET',  path:'/api/protocols/order-sets', handler:'listAllOrderSets', perm:'kardex.view' },
    { method:'GET',  path:'/api/protocols/pathways', handler:'listAllPathways', perm:'kardex.view' },
    { method:'POST', path:'/api/clinical/orders/:id/hold', handler:'orderHold', perm:'kardex.order.hold' },
    { method:'POST', path:'/api/clinical/orders/:id/unhold', handler:'orderUnhold', perm:'kardex.order.hold' },
    { method:'GET',  path:'/api/protocols/deterioration/:patientId', handler:'deterioration', perm:'patients.view' },
    { method:'GET',  path:'/api/protocols/readmission/:patientId', handler:'readmission', perm:'patients.view' }
  ],
  panels: []
};

console.log('[clinical_protocols] loaded — +15 order sets, +7 pathways, +hold workflow, +2 neural models');
