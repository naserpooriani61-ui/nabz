
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Order Sets v2 (from 20 to 40) + Safety Engine
//  Clinical-grade bundles with:
//    · source (guideline reference)
//    · timeCritical (minutes to apply)
//    · applicability (patient eligibility rules)
//    · safety-check endpoint (allergy, age, diagnosis)
// ═══════════════════════════════════════════════════════════
const encounters = require('./encounters');
const store = require('../core/store');
const perms = require('../core/permissions');

if (!perms.P['protocols.safety_check']) {
  perms.P['protocols.safety_check'] = 'admin,attending,specialist,physician,resident,intern,pharmacist';
}

// ═══════════════════════════════════════════════════════════
//  20 new order sets (total will be 40)
// ═══════════════════════════════════════════════════════════
const V2_ORDER_SETS = {

  // ─── RENAL (4) ───
  aki: {
    id:'aki', name:'AKI — آسیب حاد کلیوی', icon:'🫘', category:'renal',
    source:'KDIGO 2024', timeCritical:true, timeCriticalMinutes:120,
    description:'بسته حفاظت کلیه — توقف نفرتوکسین + بهینه‌سازی همودینامیک',
    applicability:{ diagnosis:['aki','نارسایی کلیه','renal','cr بالا','کراتینین'], minAge:18 },
    meds:[
      { drug:'NS 0.9%', dose:'1L bolus اگر هیپوولمیک', route:'IV', frequency:'once', durationDays:1, priority:'stat' },
      { drug:'Furosemide', dose:'40mg', route:'IV', frequency:'BID', durationDays:2, priority:'urgent', prn:true },
      { drug:'Sodium Bicarbonate', dose:'50 mEq', route:'IV', frequency:'PRN pH<7.2', durationDays:1, priority:'urgent', prn:true }
    ],
    labs:['BMP (K+, Cr, BUN)','Urinalysis with micro','Urine Na, FeNa','CBC','ABG if acidotic','CK'],
    imaging:[{ modality:'Renal Ultrasound', bodyPart:'Kidneys' }],
    consults:[{ service:'نفرولوژی', type:'urgent', question:'ارزیابی AKI + اندیکاسیون دیالیز' }],
    nursing:['I/O دقیق ساعتی','وزن روزانه','پایش K+ هر ۶ ساعت','قطع NSAID و نفروتوکسین','پرهیز از کنتراست'],
    diet:'رژیم کلیوی، محدودیت مایع اگر الیگوریک', activity:'استراحت نسبی + تحرک تدریجی',
    notes:'KDIGO criteria: Cr rise ≥0.3/48h or 1.5×baseline or UO<0.5/kg/h×6h. توقف همه نفرتوکسین‌ها. دوز همه داروها را بر اساس CrCl اصلاح کنید.'
  },

  hyponatremia: {
    id:'hyponatremia', name:'Hyponatremia — سدیم پایین', icon:'💧', category:'renal',
    source:'European Hyponatremia Guideline 2014',
    description:'بسته هیپوناترمی — تصحیح تدریجی برای پیشگیری از ODS',
    applicability:{ minAge:18 },
    meds:[
      { drug:'Hypertonic Saline 3%', dose:'100-150 mL bolus', route:'IV', frequency:'PRN Na<120 با علائم', durationDays:1, priority:'stat' },
      { drug:'Tolvaptan', dose:'15mg', route:'PO', frequency:'OD', durationDays:3, priority:'urgent' }
    ],
    labs:['BMP (Na)','Serum Osmolality','Urine Osmolality','Urine Na','TSH','Cortisol AM','Lipid/Protein (pseudohyponatremia)'],
    imaging:[{ modality:'CXR', bodyPart:'Chest (volume status)' }],
    consults:[{ service:'نفرولوژی', type:'urgent', question:'Severe symptomatic hyponatremia' }],
    nursing:['پایش نورولوژیک هر ۲ ساعت','Na هر ۶ ساعت اول','Seizure precautions','I/O دقیق'],
    diet:'محدودیت مایع ۱-۱.۵L روزانه', activity:'Seizure precautions',
    notes:'⚠️ تصحیح ≤۸ mEq/L/24h (خطر Osmotic Demyelination Syndrome). اگر علائم نورولوژیک → ۳٪ سالین + مشاوره نفرولوژی.'
  },

  hypernatremia: {
    id:'hypernatremia', name:'Hypernatremia — سدیم بالا', icon:'🧂', category:'renal',
    source:'UpToDate 2024',
    description:'بسته هیپرناترمی — جایگزینی آب آزاد با دقت',
    applicability:{ minAge:18 },
    meds:[
      { drug:'D5W', dose:'calc based on TBW', route:'IV', frequency:'based on deficit', durationDays:2, priority:'urgent' },
      { drug:'Free water', dose:'oral/NTG tube', route:'PO', frequency:'as tolerated', durationDays:2, priority:'routine' }
    ],
    labs:['BMP (Na)','Urine Osmolality','Urine Na','Glucose','I/O'],
    imaging:[{ modality:'CT Head', bodyPart:'Brain (if neuro symptoms)' }],
    consults:[{ service:'نفرولوژی', type:'routine', question:'Severe hypernatremia Na>160' }],
    nursing:['پایش نورولوژیک','Na هر ۴-۶ ساعت','I/O دقیق','وزن روزانه'],
    diet:'آب آزاد اگر هوشیار', activity:'Seizure precautions',
    notes:'⚠️ تصحیح ≤۱۰ mEq/L/24h (خطر cerebral edema). محاسبه deficit: TBW × (Na/140 − 1).'
  },

  hypokalemia: {
    id:'hypokalemia', name:'Hypokalemia — پتاسیم پایین', icon:'⚡', category:'renal',
    source:'AHA/ACC 2022 + UpToDate',
    description:'بسته هیپوکالمی — اصلاح K + Mg با پایش قلبی',
    applicability:{ minAge:18 },
    meds:[
      { drug:'KCl', dose:'20-40 mEq', route:'IV (central if >10/h)', frequency:'based on level', durationDays:2, priority:'stat' },
      { drug:'MgSO4', dose:'2g', route:'IV', frequency:'once اگر Mg پایین', durationDays:1, priority:'urgent' },
      { drug:'KCl slow release', dose:'40 mEq', route:'PO', frequency:'BID', durationDays:3, priority:'routine' }
    ],
    labs:['BMP (K+)','Mg','ECG','ABG if severe'],
    imaging:[{ modality:'ECG', bodyPart:'Heart' }],
    consults:[],
    nursing:['پایش ECG مداوم','K هر ۴-۶ ساعت اول','پایش محل IV','محل تجویز مرکزی اگر >10mEq/h'],
    diet:'موز، پرتقال، سیب‌زمینی، گوجه', activity:'Continuous cardiac monitoring',
    notes:'⚠️ Mg را اول اصلاح کنید — بدون Mg، K اصلاح نمی‌شود. هدف K ≥4.0. مانیتور QT/prolonged PR/U waves.'
  },

  // ─── RESPIRATORY (2) ───
  hap: {
    id:'hap', name:'HAP — پنومونی بیمارستانی', icon:'🫁', category:'respiratory',
    source:'ATS/IDSA 2016', timeCritical:true, timeCriticalMinutes:240,
    description:'پنومونی اکتسابی بیمارستان (>48h بعد پذیرش)',
    applicability:{ diagnosis:['پنومونی','pneumonia','hap'] },
    meds:[
      { drug:'Piperacillin-Tazobactam', dose:'4.5g', route:'IV', frequency:'Q6H', durationDays:7, priority:'stat' },
      { drug:'Vancomycin', dose:'15-20 mg/kg', route:'IV', frequency:'Q12H', durationDays:7, priority:'stat', isHighAlert:true },
      { drug:'Oxygen', dose:'2-4 L/min', route:'Nasal', frequency:'Cont', durationDays:3, priority:'stat' }
    ],
    labs:['CBC','BMP','Blood Cultures ×2','Sputum Culture','Procalcitonin','ABG if hypoxic','CXR'],
    imaging:[{ modality:'CXR', bodyPart:'Chest' }],
    consults:[{ service:'ریه', type:'urgent', question:'HAP severity + de-escalation' },{ service:'عفونی', type:'urgent', question:'Empiric regimen + MDRO risk' }],
    nursing:['پایش SpO2','HOB 30-45°','Oral care CHG','Aspiration precautions','پایش تب و WBC'],
    diet:'رژیم معمولی یا NPO اگر دیسترس', activity:'نیمه‌نشسته',
    notes:'کشت قبل از آنتی‌بیوتیک. De-escalate بر اساس کشت ظرف 48-72h. Risk MDRO: hospitalization >5d, IV abx in 90d, structural lung disease.'
  },

  vap: {
    id:'vap', name:'VAP — پنومونی وابسته به ونتیلاتور', icon:'🫁', category:'respiratory',
    source:'ATS/IDSA 2016 + SHEA 2022', timeCritical:true, timeCriticalMinutes:120,
    description:'پنومونی >48h بعد از اینتوباسیون',
    applicability:{ diagnosis:['vap','ventilator','intubated'] },
    meds:[
      { drug:'Piperacillin-Tazobactam', dose:'4.5g', route:'IV', frequency:'Q6H', durationDays:7, priority:'stat' },
      { drug:'Vancomycin', dose:'15-20 mg/kg', route:'IV', frequency:'Q12H', durationDays:7, priority:'stat', isHighAlert:true },
      { drug:'Inhaled Tobramycin', dose:'300mg', route:'Inhaled', frequency:'Q12H', durationDays:7, priority:'urgent' }
    ],
    labs:['BAL Culture','Blood Cultures ×2','CBC','BMP','Procalcitonin','ABG','CXR'],
    imaging:[{ modality:'CXR', bodyPart:'Chest' }],
    consults:[{ service:'ریه', type:'urgent', question:'VAP diagnosis + BAL' },{ service:'عفونی', type:'urgent', question:'MDRO risk assessment' }],
    nursing:['VAP bundle: HOB 30-45°','Oral care CHG 2×/shift','Sedation vacation daily','DVT prophylaxis','PUD prophylaxis','Subglottic suction'],
    diet:'NPO یا تغذیه لوله‌ای', activity:'Continuous monitoring',
    notes:'VAP bundle decreases risk 50%. BAL before antibiotics. 7-day course unless complications.'
  },

  // ─── INFECTION (4) ───
  uti: {
    id:'uti', name:'UTI / Pyelonephritis', icon:'🦠', category:'infection',
    source:'IDSA 2010 + EAU 2024',
    description:'عفونت ادراری + پیلونفریت',
    applicability:{ diagnosis:['uti','عفونت ادراری','pyelonephritis','پیلونفریت'] },
    meds:[
      { drug:'Ceftriaxone', dose:'1g', route:'IV', frequency:'Q24H', durationDays:7, priority:'stat' },
      { drug:'Ciprofloxacin', dose:'500mg', route:'PO', frequency:'BID', durationDays:7, priority:'urgent', prn:true },
      { drug:'NS 0.9%', dose:'1L', route:'IV', frequency:'PRN', durationDays:1, priority:'routine' }
    ],
    labs:['Urinalysis with micro','Urine Culture with susceptibilities','CBC','BMP','Blood Cultures if septic'],
    imaging:[{ modality:'Renal Ultrasound', bodyPart:'Kidneys (if recurrent/pyelonephritis)' },{ modality:'CT Abdomen', bodyPart:'Abdomen (if complicated)' }],
    consults:[{ service:'اورولوژی', type:'routine', question:'اگر انسداد یا آبسه' }],
    nursing:['I/O دقیق','هیدراتاسیون','پایش تب','پایش محل Foley اگر دارد'],
    diet:'رژیم معمولی + مایعات فراوان', activity:'استراحت اولیه',
    notes:'Nitrofurantoin فقط برای cystitis (نه pyelonephritis). Trimethoprim-SMX فقط اگر resistance <20%. 7-14 روز بسته به severity.'
  },

  cellulitis: {
    id:'cellulitis', name:'Cellulitis — سلولیت', icon:'🦵', category:'infection',
    source:'IDSA 2014',
    description:'عفونت پوستی — بدون آبسه',
    applicability:{ diagnosis:['cellulitis','سلولیت','wound infection'] },
    meds:[
      { drug:'Cefazolin', dose:'2g', route:'IV', frequency:'Q8H', durationDays:5, priority:'stat' },
      { drug:'Vancomycin', dose:'15-20 mg/kg', route:'IV', frequency:'Q12H', durationDays:5, priority:'stat', prn:true, isHighAlert:true },
      { drug:'Clindamycin', dose:'600mg', route:'IV', frequency:'Q8H', durationDays:5, priority:'urgent' }
    ],
    labs:['CBC','BMP','Blood Cultures if systemic','Wound Culture if drainage'],
    imaging:[{ modality:'X-ray (local)', bodyPart:'Affected area (rule out osteomyelitis/gas)' }],
    consults:[{ service:'جراحی', type:'urgent', question:'Debridement if necrotizing features' }],
    nursing:['Mark borders with pen','Elevate limb','Wound care','Monitor for rapid spread'],
    diet:'رژیم معمولی', activity:'Elevation + limited weight bearing',
    notes:'If no improvement in 48-72h → consider abscess (need I&D), resistant organism, or misdiagnosis. Vancomycin only if MRSA risk.'
  },

  meningitis: {
    id:'meningitis', name:'Meningitis — مننژیت باکتریال', icon:'🧠', category:'infection',
    source:'IDSA 2017 + AAN 2017', timeCritical:true, timeCriticalMinutes:30,
    description:'مننژیت باکتریال — آنتی‌بیوتیک + دگزامتازون',
    applicability:{ diagnosis:['meningitis','مننژیت','csf','نخاع'] },
    meds:[
      { drug:'Ceftriaxone', dose:'2g', route:'IV', frequency:'Q12H', durationDays:14, priority:'stat' },
      { drug:'Vancomycin', dose:'15-20 mg/kg', route:'IV', frequency:'Q12H', durationDays:14, priority:'stat', isHighAlert:true },
      { drug:'Dexamethasone', dose:'10mg', route:'IV', frequency:'Q6H', durationDays:1, priority:'stat' },
      { drug:'Acyclovir', dose:'10 mg/kg', route:'IV', frequency:'Q8H', durationDays:14, priority:'urgent', prn:true },
      { drug:'Mannitol 20%', dose:'1 g/kg', route:'IV', frequency:'PRN ICP', durationDays:2, priority:'urgent', prn:true }
    ],
    labs:['LP (cell count, glucose, protein, Gram stain, culture)','Blood Cultures ×2','CBC','BMP','Procalcitonin','Lactate','HIV','CT Head before LP if focal'],
    imaging:[{ modality:'CT Head (non-contrast)', bodyPart:'Brain (before LP if immunocompromised/focal)' }],
    consults:[{ service:'عفونی', type:'emergency', question:'Bacterial vs viral vs TB' },{ service:'نورولوژی', type:'emergency', question:'ICP management' }],
    nursing:['Droplet precautions','Neuro checks q1h','HOB 30°','Seizure precautions','پایش ICP','Airway readiness'],
    diet:'NPO اگر GCS <13', activity:'Strict bed rest, minimal stimulation',
    notes:'⚠️ آنتی‌بیوتیک + دگزامتازون قبل از LP — تاخیر نکنید. Dexamethasone قبل یا همراه با اولین دوز آنتی‌بیوتیک. اگر HSV مشکوک → Acyclovir فوری.'
  },

  febrile_neutropenia: {
    id:'febrile_neutropenia', name:'Febrile Neutropenia', icon:'🧬', category:'infection',
    source:'IDSA 2010 + ASCO 2023', timeCritical:true, timeCriticalMinutes:60,
    description:'تب + ANC <500 — آنتی‌بیوتیک تجربی',
    applicability:{ diagnosis:['neutropenia','نوتروپنی','chemo','شیمی‌درمانی','leukemia'], minAge:18 },
    meds:[
      { drug:'Piperacillin-Tazobactam', dose:'4.5g', route:'IV', frequency:'Q6H', durationDays:7, priority:'stat' },
      { drug:'Cefepime', dose:'2g', route:'IV', frequency:'Q8H', durationDays:7, priority:'stat', prn:true },
      { drug:'Vancomycin', dose:'15-20 mg/kg', route:'IV', frequency:'Q12H', durationDays:3, priority:'urgent', prn:true, isHighAlert:true },
      { drug:'Filgrastim (G-CSF)', dose:'5 mcg/kg', route:'SC', frequency:'OD', durationDays:5, priority:'urgent' }
    ],
    labs:['CBC with diff (ANC)','Blood Cultures ×2 (peripheral + line)','BMP','LFT','CXR','Procalcitonin','Urine Culture'],
    imaging:[{ modality:'CXR', bodyPart:'Chest' }],
    consults:[{ service:'انکولوژی', type:'emergency', question:'Risk stratification (MASCC)' },{ service:'عفونی', type:'emergency', question:'Empiric regimen' }],
    nursing:['Neutropenic precautions (private room, mask)','Strict hand hygiene','Avoid rectal temp','Avoid fresh flowers','پایش hourly temp','Early sepsis screen'],
    diet:'رژیم خنثی، پرهیز از غذاهای خام', activity:'Bed rest during febrile episodes',
    notes:'⚠️ آنتی‌بیوتیک تجربی <60 دقیقه از شروع تب. MASCC score برای تعیین disposition. اگر خط مرکزی → پوشش گرام مثبت. اگر unstable → شدت درمان (sepsis protocol).'
  },

  // ─── HEMATOLOGY (2) ───
  sickle_crisis: {
    id:'sickle_crisis', name:'Sickle Cell Crisis — بحران داسی', icon:'🔴', category:'hematology',
    source:'ASH 2020 + NHLBI 2014',
    description:'وازواکلوژن کریز — کنترل درد + هیدراتاسیون',
    applicability:{ diagnosis:['sickle','داسی','vaso-occlusive','voc'] },
    meds:[
      { drug:'Morphine', dose:'0.1 mg/kg', route:'IV', frequency:'Q2-4H PRN', durationDays:3, priority:'stat', isHighAlert:true, prn:true },
      { drug:'Hydromorphone', dose:'0.5-1mg', route:'IV', frequency:'Q3H PRN', durationDays:3, priority:'urgent', isHighAlert:true, prn:true },
      { drug:'Ketorolac', dose:'15-30mg', route:'IV', frequency:'Q6H', durationDays:3, priority:'urgent', prn:true },
      { drug:'NS 0.9%', dose:'1.5× maintenance', route:'IV', frequency:'Cont', durationDays:3, priority:'stat' },
      { drug:'Hydroxyurea', dose:'15-20 mg/kg', route:'PO', frequency:'OD', durationDays:30, priority:'routine' }
    ],
    labs:['CBC with retic','Hgb electrophoresis','LDH','Haptoglobin','Type & Crossmatch','BMP','Urinalysis'],
    imaging:[{ modality:'CXR', bodyPart:'Chest (if chest pain)' }],
    consults:[{ service:'خون و انکولوژی', type:'urgent', question:'Crisis management + transfusion threshold' }],
    nursing:['Pain assessment q1h','Incentive spirometry q2h (prevent ACS)','I/O','O2 if SpO2<92','Monitor for acute chest syndrome'],
    diet:'رژیم معمولی + مایعات فراوان', activity:'Bed rest with incentive spirometry',
    notes:'⚠️ هدف Hgb 7-9 (نه بالاتر — خطر hyperviscosity). اگر acute chest syndrome یا stroke → exchange transfusion. Incentive spirometry از ACS جلوگیری می‌کند.'
  },

  mtp: {
    id:'mtp', name:'MTP — Massive Transfusion', icon:'🩸', category:'hematology',
    source:'ACS TQIP 2023 + AABB 2021', timeCritical:true, timeCriticalMinutes:15,
    description:'پروتکل ترانسفوزیون ماسیو — نسبت 1:1:1',
    applicability:{ diagnosis:['hemorrhage','خونریزی','trauma','تروما','gi bleed'] },
    meds:[
      { drug:'PRBC', dose:'1 unit', route:'IV', frequency:'1:1:1 ratio', durationDays:1, priority:'stat', isHighAlert:true },
      { drug:'FFP', dose:'1 unit', route:'IV', frequency:'1:1:1 ratio', durationDays:1, priority:'stat', isHighAlert:true },
      { drug:'Platelets', dose:'1 apheresis unit', route:'IV', frequency:'1:1:1 ratio', durationDays:1, priority:'stat', isHighAlert:true },
      { drug:'Tranexamic Acid (TXA)', dose:'1g', route:'IV', frequency:'once if <3h from injury', durationDays:1, priority:'stat' },
      { drug:'Calcium Gluconate', dose:'1g', route:'IV', frequency:'after every 2 units PRBC', durationDays:1, priority:'stat' }
    ],
    labs:['CBC','Coagulation (PT/INR/aPTT)','Fibrinogen','ABG','Calcium (ionized)','Lactate','Type & Crossmatch q1h'],
    imaging:[],
    consults:[{ service:'جراحی تروما', type:'emergency', question:'Source control' },{ service:'خون و انفوزیون', type:'emergency', question:'MTP activation' }],
    nursing:['Two large bore IVs (14G or larger)','Level 1 rapid infuser','Fluid warmer','Monitor: hypothermia, hypocalcemia, hyperkalemia','Perineal/incision pressure'],
    diet:'NPO', activity:'Bed rest + surgical suite',
    notes:'⚠️ Activate if 4+ units PRBC in 1h or ABC score ≥2. هدف: Hb >7, Plt >50 (100 if CNS injury), INR <1.5, Fibrinogen >150. TXA only if <3h from injury.'
  },

  // ─── ENDOCRINE (3) ───
  thyroid_storm: {
    id:'thyroid_storm', name:'Thyroid Storm — طوفان تیروئید', icon:'🌡', category:'endocrine',
    source:'ATA 2016', timeCritical:true, timeCriticalMinutes:60,
    description:'طوفان تیروئید — مهار + بتا بلاکر + استروئید',
    applicability:{ diagnosis:['thyroid storm','تیروتوکسیکوز','thyrotoxicosis'], minAge:18 },
    meds:[
      { drug:'Propylthiouracil (PTU)', dose:'500-1000mg load then 250mg', route:'PO/NG', frequency:'Q4H', durationDays:3, priority:'stat' },
      { drug:'Propranolol', dose:'60-80mg', route:'PO', frequency:'Q4H', durationDays:3, priority:'stat' },
      { drug:'Iodine (SSKI)', dose:'5 drops', route:'PO', frequency:'Q6H شروع ۱ ساعت بعد PTU', durationDays:3, priority:'urgent' },
      { drug:'Hydrocortisone', dose:'100mg', route:'IV', frequency:'Q8H', durationDays:3, priority:'stat' }
    ],
    labs:['TSH','FT4','FT3','CBC','BMP','LFT','Cortisol','Blood Cultures (trigger search)','ECG'],
    imaging:[],
    consults:[{ service:'غدد', type:'emergency', question:'Thyroid storm management' },{ service:'قلب و عروق', type:'urgent', question:'Rate control + arrhythmia' }],
    nursing:['Cooling measures (ice packs, cool fluids)','پایش قلبی مداوم','پایش نورولوژیک','I/O دقیق','پایش تب هر ۳۰ دقیقه'],
    diet:'رژیم پرکالری + مایعات', activity:'Bed rest, minimal stimulation',
    notes:'⚠️ ترتیب حیاتی: PTU اول → ۱ ساعت بعد ید → هرگز ید قبل از PTU. Burch-Wartofsky score >45 diagnostic. جستجوی trigger (عفونت، MI، trauma). Betablocker برای همه مگر contraindication.'
  },

  adrenal_crisis: {
    id:'adrenal_crisis', name:'Adrenal Crisis — بحران آدرنال', icon:'⚡', category:'endocrine',
    source:'Endocrine Society 2016', timeCritical:true, timeCriticalMinutes:60,
    description:'بحران آدرنال — هیدروکورتیزون فوری + مایع',
    applicability:{ diagnosis:['adrenal','آدرنال','addison','هیپوآدرنال'] },
    meds:[
      { drug:'Hydrocortisone', dose:'100mg', route:'IV', frequency:'bolus then 50mg Q6H', durationDays:2, priority:'stat' },
      { drug:'NS 0.9%', dose:'1L', route:'IV', frequency:'rapid bolus', durationDays:1, priority:'stat' },
      { drug:'Dextrose 50%', dose:'25g', route:'IV', frequency:'PRN hypoglycemia', durationDays:1, priority:'urgent', prn:true }
    ],
    labs:['Cortisol + ACTH (before steroid if possible)','BMP (Na, K, glucose)','CBC','Blood Cultures (trigger search)','ECG'],
    imaging:[{ modality:'CXR', bodyPart:'Chest' }],
    consults:[{ service:'غدد', type:'emergency', question:'Adrenal crisis management + steroid taper' }],
    nursing:['پایش BP هر ۱۵ دقیقه اولیه','پایش BS هر ۳۰ دقیقه','I/O دقیق','پایش K+'],
    diet:'NPO اولیه سپس رژیم معمولی', activity:'Bed rest',
    notes:'⚠️ هیدروکورتیزون را بدون انتظار جواب کورتیزول شروع کنید. اگر کلاسیک (هیپوتنشن + هیپوناترمی + هیپرکالمی) → احتمال بالا. اگر بیمار در ICU استرروئید قبلی دارد → stress dose نیاز دارد.'
  },

  hypercalcemia: {
    id:'hypercalcemia', name:'Hypercalcemia — کلسیم بالا', icon:'🦴', category:'endocrine',
    source:'Endocrine Society 2022',
    description:'هیپرکلسمی علامت‌دار یا >14 mg/dL',
    applicability:{ minAge:18 },
    meds:[
      { drug:'NS 0.9%', dose:'1-2L bolus then 200-300 mL/h', route:'IV', frequency:'Cont', durationDays:2, priority:'stat' },
      { drug:'Zoledronic Acid', dose:'4mg', route:'IV', frequency:'once', durationDays:1, priority:'urgent' },
      { drug:'Calcitonin', dose:'4 IU/kg', route:'SC', frequency:'Q12H', durationDays:2, priority:'urgent' },
      { drug:'Furosemide', dose:'40mg', route:'IV', frequency:'PRN after volume repletion', durationDays:2, priority:'routine', prn:true }
    ],
    labs:['Serum Calcium + Albumin (corrected)','Ionized Calcium','PTH','PTHrP','Vitamin D 25-OH','BMP','Phosphate','ECG'],
    imaging:[{ modality:'CXR', bodyPart:'Chest (malignancy search)' },{ modality:'Bone Scan', bodyPart:'Skeletal' }],
    consults:[{ service:'غدد', type:'urgent', question:'Severe hypercalcemia' },{ service:'انکولوژی', type:'urgent', question:'اگر PTHrP مثبت' }],
    nursing:['I/O دقیق','پایش نورولوژیک','پایش قلبی (QT shortening)','پایش پتاسیم و منیزیوم','وزن روزانه'],
    diet:'رژیم بدون کلسیم، مایعات فراوان', activity:'استراحت + mobilization',
    notes:'هدف Ca <12. اگر Ca >14 → ICU. Furosemide فقط بعد از rehydration کامل. Zoledronic acid 48-72h onset. اگر PTH پایین → PTHrP malignancy workup.'
  },

  // ─── NEURO (2) ───
  ich: {
    id:'ich', name:'ICH — خونریزی داخل مغزی', icon:'🧠', category:'neuro',
    source:'AHA/ASA 2022', timeCritical:true, timeCriticalMinutes:60,
    description:'خونریزی داخل مغزی — BP control + reversal',
    applicability:{ diagnosis:['ich','خونریزی مغزی','intracerebral','hemorrhage'] },
    meds:[
      { drug:'Nicardipine', dose:'5 mg/h', route:'IV', frequency:'titr to SBP 140', durationDays:3, priority:'stat' },
      { drug:'Labetalol', dose:'20mg', route:'IV', frequency:'PRN SBP>140', durationDays:3, priority:'stat', prn:true },
      { drug:'Vitamin K', dose:'10mg', route:'IV', frequency:'once (if on warfarin)', durationDays:1, priority:'stat' },
      { drug:'PCC (Prothrombin Complex)', dose:'25-50 IU/kg', route:'IV', frequency:'once (if warfarin)', durationDays:1, priority:'stat' },
      { drug:'Mannitol 20%', dose:'1 g/kg', route:'IV', frequency:'PRN ICP', durationDays:2, priority:'urgent', prn:true },
      { drug:'Levetiracetam', dose:'1g', route:'IV', frequency:'Q12H', durationDays:7, priority:'urgent' }
    ],
    labs:['CBC','BMP','Coagulation (INR/aPTT)','Type & Crossmatch','Troponin','Glucose','Lactate'],
    imaging:[{ modality:'CT Head (STAT, non-contrast)', bodyPart:'Brain' },{ modality:'CTA Head', bodyPart:'Brain (if SAH suspected)' }],
    consults:[{ service:'جراحی اعصاب', type:'emergency', question:'Surgical evacuation?' },{ service:'نورولوژی', type:'emergency', question:'ICP management' },{ service:'قلب و عروق', type:'urgent', question:'BP control titration' }],
    nursing:['HOB 30°','Neuro checks q1h','ICP monitoring if GCS<8','Seizure precautions','پایش دقیق BP','Reverse anticoagulation within 1h'],
    diet:'NPO اگر GCS<13', activity:'Strict bed rest, minimal stimulation',
    notes:'⚠️ هدف SBP 140 (130-150). Reverse anticoagulation ظرف ۱ ساعت: Warfarin → Vit K + PCC. Dabigatran → Idarucizumab. Xa inhibitors → Andexanet or PCC. ICH score for prognosis.'
  },

  sah: {
    id:'sah', name:'SAH — خونریزی ساب‌آراکنوئید', icon:'🧠', category:'neuro',
    source:'AHA/ASA 2023', timeCritical:true, timeCriticalMinutes:360,
    description:'SAH — nimodipine + neurosurgery',
    applicability:{ diagnosis:['sah','subarachnoid','ساب‌آراکنوئید'] },
    meds:[
      { drug:'Nimodipine', dose:'60mg', route:'PO/NG', frequency:'Q4H', durationDays:21, priority:'stat' },
      { drug:'Nicardipine', dose:'5 mg/h', route:'IV', frequency:'titr SBP<160', durationDays:5, priority:'stat' },
      { drug:'Acetaminophen', dose:'650mg', route:'PO', frequency:'Q6H PRN pain', durationDays:5, priority:'routine', prn:true },
      { drug:'Docusate', dose:'100mg', route:'PO', frequency:'BID', durationDays:14, priority:'routine' }
    ],
    labs:['CBC','BMP','Coagulation','Type & Crossmatch','Troponin','ECG'],
    imaging:[{ modality:'CT Head (STAT)', bodyPart:'Brain' },{ modality:'CTA Head', bodyPart:'Brain (aneurysm)' },{ modality:'Catheter Angiography', bodyPart:'Brain' }],
    consults:[{ service:'جراحی اعصاب', type:'emergency', question:'Coil vs clip' },{ service:'نورولوژی', type:'emergency', question:'Vasospasm monitoring' }],
    nursing:['HOB 30°','Neuro checks q1h','Quiet room, minimal stimulation','Avoid straining','Seizure precautions','پایش vasospasm (d/w 3-14)'],
    diet:'NPO اولیه سپس رژیم معمولی', activity:'Strict bed rest 48h, minimal stimulation',
    notes:'Nimodipine ۲۱ روز از vasospasm جلوگیری می‌کند. اگر Hunt-Hess ≥3 یا Fisher ≥3 → ICU. Rebleed risk بالای ۲۴h اولیه.'
  },

  // ─── GENERAL (3) ───
  delirium: {
    id:'delirium', name:'Delirium — دلیریوم حاد', icon:'🧠', category:'neuro',
    source:'NICE 2023 + AGS 2015',
    description:'دلیریوم — شناسایی علت + مداخلات غیردارویی',
    applicability:{ minAge:18 },
    meds:[
      { drug:'Haloperidol', dose:'0.5-1mg', route:'IV', frequency:'Q4H PRN severe agitation', durationDays:3, priority:'urgent', prn:true },
      { drug:'Quetiapine', dose:'25mg', route:'PO', frequency:'QHS', durationDays:3, priority:'urgent', prn:true },
      { drug:'Dexmedetomidine', dose:'0.2-1.4 mcg/kg/h', route:'IV', frequency:'Cont (ICU only)', durationDays:3, priority:'urgent', prn:true }
    ],
    labs:['CBC','BMP','LFT','TSH','B12','Urinalysis','Blood Cultures','UDS','Ammonia if cirrhosis'],
    imaging:[{ modality:'CXR', bodyPart:'Chest' },{ modality:'CT Head', bodyPart:'Brain (if focal)' }],
    consults:[{ service:'روان‌پزشکی', type:'urgent', question:'Severe agitation + antipsychotic selection' }],
    nursing:['CAM-ICU q shift','Reorientation q shift','Sleep hygiene (lights off at night)','Glasses + hearing aids','Early mobilization','Avoid restraints','Family presence'],
    diet:'رژیم معمولی اگر tolerated', activity:'Early mobilization',
    notes:'⚠️ بنزودیازپین‌ها دلیریوم را بدتر می‌کنند. Antipsychotics فقط برای severe agitation — درمان نیستند. جستجوی علت: عفونت، دارو، withdrawal، metabolic, pain.'
  },

  acute_liver_failure: {
    id:'acute_liver_failure', name:'Acute Liver Failure', icon:'🫀', category:'critical',
    source:'AASLD 2023', timeCritical:true, timeCriticalMinutes:120,
    description:'نارسایی حاد کبدی — NAC + ارزیابی پیوند',
    applicability:{ diagnosis:['acute liver failure','نارسایی کبد','hepatic encephalopathy'] },
    meds:[
      { drug:'N-Acetylcysteine (NAC)', dose:'150 mg/kg', route:'IV', frequency:'over 1h then 50 mg/kg over 4h', durationDays:3, priority:'stat' },
      { drug:'Lactulose', dose:'30-45 mL', route:'PO/NG', frequency:'Q2-4H PRN encephalopathy', durationDays:5, priority:'urgent' },
      { drug:'Pantoprazole', dose:'40mg', route:'IV', frequency:'Q24H', durationDays:5, priority:'routine' },
      { drug:'Vitamin K', dose:'10mg', route:'IV', frequency:'OD', durationDays:3, priority:'urgent' }
    ],
    labs:['LFT','INR','Ammonia','Lactate','Glucose','Acetaminophen level','Viral hepatitis panel','Autoimmune markers','CBC','BMP'],
    imaging:[{ modality:'Liver Ultrasound with Doppler', bodyPart:'Liver' }],
    consults:[{ service:'گوارش/کبد', type:'emergency', question:'ALF etiology + transplant referral' },{ service:'مرکز پیوند', type:'emergency', question:'King\'s College criteria' }],
    nursing:['Neuro checks q2h (HE grade)','پایش ICP if grade III/IV','Glucose q2h','I/O دقیق','Strict NPO if encephalopathic','Avoid sedatives'],
    diet:'NPO اگر encephalopathy grade ≥2', activity:'ICU, minimal stimulation',
    notes:'NAC برای همه ALF (نه فقط acetaminophen). King\'s College criteria: INR >6.5 (PT>100s) OR 3 of: age<10 or >40, etiology (non-A non-B or drug), jaundice-to-encephalopathy >7d, INR >3.5, bilirubin >17.4. ICU + transplant consultation فوری.'
  },

  hemoptysis: {
    id:'hemoptysis', name:'Massive Hemoptysis', icon:'🩸', category:'respiratory',
    source:'CHEST 2018', timeCritical:true, timeCriticalMinutes:30,
    description:'خونریزی شدید تنفسی — >100mL/h یا >600mL/24h',
    applicability:{ diagnosis:['hemoptysis','خونریزی تنفسی','خون در خلط'] },
    meds:[
      { drug:'Tranexamic Acid', dose:'500-1000mg', route:'IV', frequency:'Q8H', durationDays:3, priority:'stat' },
      { drug:'Reversal (Warfarin)', dose:'PCC + Vit K', route:'IV', frequency:'once', durationDays:1, priority:'stat' },
      { drug:'Oxygen', dose:'high flow', route:'Mask', frequency:'Cont', durationDays:3, priority:'stat' }
    ],
    labs:['CBC','Coagulation','Type & Crossmatch (2 units)','ABG','Renal Function'],
    imaging:[{ modality:'CXR', bodyPart:'Chest' },{ modality:'CT Chest', bodyPart:'Chest' }],
    consults:[{ service:'ریه', type:'emergency', question:'Bronchoscopy' },{ service:'رادیولوژی مداخله‌ای', type:'emergency', question:'Bronchial artery embolization' },{ service:'جراحی توراکس', type:'emergency', question:'Resection candidacy' }],
    nursing:['Position: lateral decubitus with bleeding side down','Large bore IV ×2','Prepare for intubation with large ETT (≥8.0)','Suction ready','Pulse oximetry continuous'],
    diet:'NPO', activity:'Strict bed rest',
    notes:'⚠️ massive hemoptysis = >600mL/24h یا >100mL/h. Intubate with ETT ≥8.0 for bronchoscopy access. Position bleeding side down (prevent spillover to healthy lung). Reversal فوری anticoag. Bronchial artery embolization if unstable.'
  }

};

// ═══════════════════════════════════════════════════════════
//  5 new pathways (total will be 10)
// ═══════════════════════════════════════════════════════════
const V2_PATHWAYS = {

  aki_pathway: {
    id:'aki_pathway', name:'مسیر AKI', icon:'🫘', totalMinutes:1440,
    milestones:[
      { offset:0,   label:'ارزیابی علت (pre/intra/post-renal)', critical:true },
      { offset:30,  label:'قطع نفروتوکسین‌ها (NSAID, contrast, aminoglycoside)', critical:true },
      { offset:60,  label:'بهینه‌سازی همودینامیک (MAP≥65)', critical:true },
      { offset:180, label:'BMP + Urine Na + FeNa', critical:true },
      { offset:360, label:'تصمیم دیالیز اگر K>6.5 یا pH<7.2 یا Uremia', critical:false },
      { offset:1440,label:'ارزیابی ۲۴h + nephrology consult', critical:false }
    ]
  },

  ich_pathway: {
    id:'ich_pathway', name:'مسیر ICH', icon:'🧠', totalMinutes:360,
    milestones:[
      { offset:0,  label:'CT Head (STAT)', critical:true },
      { offset:15, label:'BP control (SBP 130-150)', critical:true },
      { offset:30, label:'Reversal anticoagulant', critical:true },
      { offset:60, label:'Neurosurgery consult', critical:true },
      { offset:60, label:'ICP management if GCS<8', critical:true },
      { offset:360,label:'Repeat CT + neuro check', critical:false }
    ]
  },

  hyperkalemia_pathway: {
    id:'hyperkalemia_pathway', name:'مسیر Hyperkalemia', icon:'⚡', totalMinutes:240,
    milestones:[
      { offset:0,   label:'ECG (peaked T, wide QRS)', critical:true },
      { offset:5,   label:'Calcium Gluconate 1g IV اگر تغییرات ECG', critical:true },
      { offset:15,  label:'Insulin + D50 IV', critical:true },
      { offset:15,  label:'Albuterol nebulized', critical:true },
      { offset:60,  label:'K binder (patiromer/SPS)', critical:false },
      { offset:120, label:'Recheck K+ + glucose', critical:true },
      { offset:240, label:'تصمیم دیالیز اگر مقاوم', critical:false }
    ]
  },

  febrile_neutropenia_pathway: {
    id:'febrile_neutropenia_pathway', name:'مسیر Febrile Neutropenia', icon:'🧬', totalMinutes:360,
    milestones:[
      { offset:0,  label:'CBC + ANC', critical:true },
      { offset:15, label:'Blood Cultures ×2', critical:true },
      { offset:30, label:'MASCC score', critical:true },
      { offset:60, label:'Empiric broad-spectrum abx', critical:true },
      { offset:120,label:'Neutropenic precautions فعال', critical:false },
      { offset:360,label:'Re-culture اگر تب پایدار', critical:false }
    ]
  },

  mtp_pathway: {
    id:'mtp_pathway', name:'مسیر MTP', icon:'🩸', totalMinutes:240,
    milestones:[
      { offset:0,  label:'فعال‌سازی MTP (1:1:1)', critical:true },
      { offset:5,  label:'Two large bore IVs', critical:true },
      { offset:10, label:'TXA 1g اگر trauma <3h', critical:true },
      { offset:30, label:'Labs q1h (CBC, coags, Ca, ABG)', critical:true },
      { offset:60, label:'Calcium replacement', critical:true },
      { offset:120,label:'Source control (surgery)', critical:true },
      { offset:240,label:'Goal-directed resuscitation', critical:false }
    ]
  }

};

// ═══════════════════════════════════════════════════════════
//  Merge into encounters
// ═══════════════════════════════════════════════════════════
if (encounters._orderSets) {
  Object.assign(encounters._orderSets, V2_ORDER_SETS);
}
if (encounters._pathways) {
  Object.assign(encounters._pathways, V2_PATHWAYS);
}

// ═══════════════════════════════════════════════════════════
//  Safety Check — pre-apply clinical safety verification
// ═══════════════════════════════════════════════════════════
function safetyCheck(ctx) {
  const setId = ctx.params.id;
  const patientId = ctx.params.patientId;
  const set = encounters._orderSets[setId];
  if (!set) throw ctx.E.notFound('set_not_found');
  const patient = store.get('patients', patientId);
  if (!patient) throw ctx.E.notFound('patient_not_found');

  const conflicts = [];
  const warnings = [];

  // ── 1. Allergy check (critical) ──
  const allergies = (patient.allergies || []).map(a => String(a).toLowerCase().trim()).filter(Boolean);
  for (const med of (set.meds || [])) {
    const drug = String(med.drug || '').toLowerCase();
    for (const allergy of allergies) {
      if (allergy && drug.includes(allergy)) {
        conflicts.push({
          type: 'allergy',
          severity: 'critical',
          drug: med.drug,
          allergy: patient.allergies[allergies.indexOf(allergy)],
          message: '⚠️ دارو «' + med.drug + '» با آلرژی «' + allergy + '» تداخل دارد'
        });
      }
    }
  }

  // ── 2. Age warnings ──
  if (patient.age) {
    for (const med of (set.meds || [])) {
      const drug = String(med.drug || '').toLowerCase();
      if (/ibuprofen|naproxen|diclofenac|ketorolac|indomethacin/i.test(drug) && patient.age >= 75) {
        warnings.push({
          type: 'age',
          severity: 'warning',
          message: 'NSAID در بیمار ≥75 — افزایش خطر خونریزی GI و AKI. در صورت امکان، جایگزین (Acetaminophen) استفاده کنید.'
        });
      }
    }
  }

  // ── 3. Time-critical warning ──
  if (set.timeCritical) {
    warnings.push({
      type: 'time_critical',
      severity: 'high',
      minutesTarget: set.timeCriticalMinutes,
      message: '⏱ بسته حیاتی — باید ظرف ' + set.timeCriticalMinutes + ' دقیقه اعمال شود'
    });
  }

  // ── 4. Applicability check ──
  if (set.applicability) {
    const app = set.applicability;
    if (app.minAge && patient.age && patient.age < app.minAge) {
      warnings.push({
        type: 'applicability',
        severity: 'warning',
        message: 'بیمار کمتر از سن توصیه‌شده (' + app.minAge + ')'
      });
    }
    if (app.diagnosis && app.diagnosis.length) {
      const dx = String(patient.diagnosis || '').toLowerCase();
      const matches = app.diagnosis.some(k => dx.includes(k.toLowerCase()));
      if (dx && !matches) {
        warnings.push({
          type: 'applicability',
          severity: 'warning',
          message: 'تشخیص بیمار («' + patient.diagnosis + '») با اندیکاسیون این بسته همخوان نیست'
        });
      }
    }
  }

  return {
    set: {
      id: setId, name: set.name, category: set.category,
      source: set.source || null,
      timeCritical: !!set.timeCritical,
      timeCriticalMinutes: set.timeCriticalMinutes || null,
      totalMeds: (set.meds || []).length,
      totalLabs: (set.labs || []).length
    },
    patient: {
      id: patient.id,
      name: patient.firstName + ' ' + patient.lastName,
      age: patient.age, allergies: patient.allergies || []
    },
    conflicts,
    warnings,
    safeToApply: conflicts.filter(c => c.severity === 'critical').length === 0,
    generatedAt: new Date().toISOString()
  };
}

// ═══════════════════════════════════════════════════════════
//  Summary — count all sets by category
// ═══════════════════════════════════════════════════════════
function summary(ctx) {
  const all = Object.values(encounters._orderSets || {});
  const byCategory = {};
  for (const s of all) {
    byCategory[s.category] = (byCategory[s.category] || 0) + 1;
  }
  return {
    totalOrderSets: all.length,
    totalPathways: Object.keys(encounters._pathways || {}).length,
    byCategory,
    timeCritical: all.filter(s => s.timeCritical).length,
    withSource: all.filter(s => s.source).length,
    newInV2: Object.keys(V2_ORDER_SETS).length,
    categories: Object.keys(byCategory).sort()
  };
}

module.exports = {
  handlers: { safetyCheck, summary },
  routes: [
    { method:'GET', path:'/api/protocols/safety-check/:id/:patientId', handler:'safetyCheck', perm:'protocols.safety_check' },
    { method:'GET', path:'/api/protocols/order-sets-summary',          handler:'summary',     perm:'kardex.view' }
  ],
  panels: []
};

console.log('[order-sets-v2] loaded — +' + Object.keys(V2_ORDER_SETS).length +
  ' sets (total: ' + Object.keys(encounters._orderSets || {}).length + ') · +' +
  Object.keys(V2_PATHWAYS).length + ' pathways (total: ' +
  Object.keys(encounters._pathways || {}).length + ') · safety-check endpoint registered');
