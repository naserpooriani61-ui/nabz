'use strict';
const store = require('./core/store');
const C = { r:'\x1b[0m', b:'\x1b[1m', red:'\x1b[31m', g:'\x1b[32m', c:'\x1b[36m' };

// نقشه: ماژول → پنل → collection
const MAP = [
  ['clinical', 'کاردکس', 'orders'],
  ['clinical', 'MAR', 'mar'],
  ['clinical', 'I/O', 'io_records'],
  ['emergency', 'اورژانس', 'ed_visits'],
  ['emergency', 'کدها', 'ed_codes'],
  ['workflow', 'مشاوره', 'consults'],
  ['workflow', 'انتقال', 'transfers'],
  ['workflow', 'ترخیص', 'discharges'],
  ['workflow', 'تحویل', 'handovers'],
  ['paraclinical', 'آزمایشگاه', 'labs'],
  ['paraclinical', 'تصویربرداری', 'radiology'],
  ['paraclinical', 'بانک خون', 'blood_requests'],
  ['paraclinical', 'داروخانه', 'dispenses'],
  ['safety', 'سپسیس', 'sepsis'],
  ['safety', 'عفونی', 'infections'],
  ['safety', 'ایزولاسیون', 'isolations'],
  ['safety', 'حوادث', 'incidents'],
  ['safety', 'ریسک', 'risks'],
  ['surgical', 'اتاق عمل', 'or_schedule'],
  ['surgical', 'PACU', 'or_pacu'],
  ['surgical', 'CSSD ست', 'cssd_sets'],
  ['surgical', 'CSSD چرخه', 'cssd_cycles'],
  ['ops', 'کارانه', 'karanneh_periods'],
  ['ops', 'شیفت', 'rosters'],
  ['education', 'محتوا', 'learning_objects'],
  ['education', 'سوالات', 'questions'],
  ['education', 'آزمون', 'exams'],
  ['education', 'کیس', 'edu_cases'],
  ['education', 'گواهی', 'certificates'],
  ['education', 'تخصیص', 'edu_assignments'],
  ['quality', 'KPI', 'kpis'],
  ['quality', 'PDSA', 'pdsa_cycles'],
  ['quality', 'RCA', 'rca_reports'],
  ['quality', 'ممیزی', 'clinical_audits'],
  ['quality', 'رضایت', 'satisfaction'],
  ['rights', 'رضایت‌نامه', 'patient_consents'],
  ['rights', 'شکایت', 'patient_complaints'],
  ['rights', 'حریم خصوصی', 'privacy_checks'],
  ['rights', 'آموزش بیمار', 'patient_education'],
  ['advanced_hr', 'ضرایب', 'coefficients'],
  ['advanced_hr', 'اعتراض', 'appeals'],
  ['advanced_hr', 'خدمات', 'extra_services'],
  ['crisis', 'بحران (تاریخچه)', 'crisis_sessions'],
  ['nursing_report', 'گزارش پرستاری', 'nursing_reports'],
  ['voice_notes', 'یادداشت صوتی', 'voice_notes']
];

console.log('');
console.log(C.c + '══════════════════════════════════════════════════════════' + C.r);
console.log('  وضعیت واقعی داده‌ها');
console.log(C.c + '══════════════════════════════════════════════════════════' + C.r);
console.log('');

let empty = 0, has = 0;
let lastMod = '';
for (const [mod, panel, coll] of MAP) {
  if (mod !== lastMod) { console.log('\n' + C.b + '▸ ' + mod + C.r); lastMod = mod; }
  const count = store.readAll(coll).length;
  if (count === 0) {
    console.log('  ' + C.red + '✗' + C.r + ' ' + panel.padEnd(22) + ' 0 (خالی!)');
    empty++;
  } else {
    console.log('  ' + C.g + '✓' + C.r + ' ' + panel.padEnd(22) + ' ' + count);
    has++;
  }
}

console.log('');
console.log(C.c + '══════════════════════════════════════════════════════════' + C.r);
console.log('  ' + C.g + has + ' پنل داده دارد' + C.r + ' · ' + C.red + empty + ' پنل خالی' + C.r);
console.log(C.c + '══════════════════════════════════════════════════════════' + C.r);
console.log('');
