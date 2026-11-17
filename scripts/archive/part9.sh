
# ═══════════════════════════════════════════════════════════════
#  Part 9 — Sina Foundation
# ═══════════════════════════════════════════════════════════════

# ─── ۱) core/sina.js — داده‌های واقعی سینا ───
cat > core/sina.js << 'EOF'
'use strict';
// ─── ۲۶ بخش واقعی بیمارستان سینا ───
const WARDS = [
  { code:'NURSING_OFFICE', label:'دفتر پرستاری', type:'admin',     beds:0,  group:'admin',    headNurse:'مینا نجفی حقی' },
  { code:'ICU_RESP',       label:'ICU ریه',      type:'icu',       beds:8,  group:'critical', headNurse:'اکرم جلالی' },
  { code:'ICU_NEURO',      label:'ICU اعصاب',    type:'icu',       beds:8,  group:'critical', headNurse:'مرضیه محمودی' },
  { code:'ICU_ER',         label:'ICU اورژانس',  type:'icu',       beds:8,  group:'critical', headNurse:'فهیمه مولائی مشتاق' },
  { code:'ICU_GEN1',       label:'ICU جنرال ۱',  type:'icu',       beds:10, group:'critical', headNurse:'سکینه امینی کیا' },
  { code:'ICU_GEN2',       label:'ICU جنرال ۲',  type:'icu',       beds:10, group:'critical', headNurse:'لیلا اسکندری' },
  { code:'CCU',            label:'CCU قلب',      type:'ccu',       beds:10, group:'critical', headNurse:'سپیده برادران' },
  { code:'ER',             label:'اورژانس',      type:'emergency', beds:30, group:'emergency', headNurse:'زهرا رستم نیاء' },
  { code:'GEN_SURG14',     label:'جراحی ۱ و ۴',  type:'ward',      beds:24, group:'surgical',  headNurse:'فاطمه رضائی نوائی' },
  { code:'GEN_SURG2',      label:'جراحی ۲',      type:'ward',      beds:20, group:'surgical',  headNurse:'مریم عباسی نطنزی' },
  { code:'VASC1',          label:'عروق ۱',       type:'ward',      beds:16, group:'surgical',  headNurse:'نازیلا پورطهماسبی' },
  { code:'VASC2',          label:'عروق ۲',       type:'ward',      beds:16, group:'surgical',  headNurse:'مهتاب غفارزاده' },
  { code:'MAXFAX',         label:'فک و صورت',    type:'ward',      beds:14, group:'surgical',  headNurse:'منیر خزائی' },
  { code:'NSURG_M',        label:'جراحی اعصاب مردان', type:'ward', beds:16, group:'surgical',  headNurse:'فریبا حاجی محمدی' },
  { code:'NSURG_F',        label:'جراحی اعصاب زنان',  type:'ward', beds:14, group:'surgical',  headNurse:'فتانه زینلی گوهری' },
  { code:'ORTHO_M',        label:'ارتوپدی مردان',     type:'ward', beds:18, group:'surgical',  headNurse:'زهرا شجاعی خبیصی' },
  { code:'ORTHO_F',        label:'ارتوپدی زنان',      type:'ward', beds:14, group:'surgical',  headNurse:'سمیه بادی' },
  { code:'URO1',           label:'اورولوژی ۱',   type:'ward',      beds:16, group:'surgical',  headNurse:'پرستو پورمندی' },
  { code:'URO2',           label:'اورولوژی ۲',   type:'ward',      beds:14, group:'surgical',  headNurse:'هدا رئوفی' },
  { code:'KIDNEY_TX',      label:'پیوند کلیه',   type:'ward',      beds:8,  group:'surgical',  headNurse:'محبوبه امین زاده' },
  { code:'INT_M',          label:'داخلی مردان',  type:'ward',      beds:24, group:'internal',  headNurse:'سمیرا بیات' },
  { code:'INT_F',          label:'داخلی زنان',   type:'ward',      beds:20, group:'internal',  headNurse:'مریم خرقانی' },
  { code:'NEURO_M',        label:'نورولوژی مردان', type:'ward',    beds:20, group:'neuro',     headNurse:'فاطمه سلیمانی' },
  { code:'NEURO_F',        label:'نورولوژی زنان',  type:'ward',    beds:18, group:'neuro',     headNurse:'فاطمه سیفی جلال' },
  { code:'MS1',            label:'MS ۱',         type:'ward',      beds:16, group:'neuro',     headNurse:'انسیه یغما' },
  { code:'MS2',            label:'MS ۲',         type:'ward',      beds:14, group:'neuro',     headNurse:'مریم خردروستا' },
  { code:'MS3',            label:'MS ۳',         type:'ward',      beds:12, group:'neuro',     headNurse:'فرانک رهبری' },
  { code:'ONCO',           label:'آنکولوژی',     type:'ward',      beds:16, group:'oncology',  headNurse:'مریم عزلتی سروندانی' },
  { code:'DIALYSIS',       label:'دیالیز',       type:'dialysis',  beds:10, group:'special',   headNurse:'زبیده یحیی زاده جلودار' },
  { code:'CATHLAB',        label:'کت لب',        type:'cathlab',   beds:4,  group:'special',   headNurse:'سیدعباس بنی هاشمی' },
  { code:'VIP',            label:'VIP',          type:'vip',       beds:8,  group:'vip',       headNurse:'مهسا وحیدی' },
  { code:'OR_GEN',         label:'اتاق عمل جنرال',   type:'or',    beds:0,  group:'surgical',  headNurse:'علیرضا طاهری پری' },
  { code:'OR_ER',          label:'اتاق عمل اورژانس', type:'or',    beds:0,  group:'surgical',  headNurse:'زهرا محبی' },
  { code:'CSR',            label:'CSR',          type:'ward',      beds:14, group:'special',   headNurse:'فتانه مستاجران گورتانی' },
  { code:'CLINIC',         label:'درمانگاه تخصصی', type:'clinic',  beds:0,  group:'special',   headNurse:'اکرم آخوندی قهرودی' },
  { code:'ENDOSCOPY',      label:'آندوسکوپی',    type:'clinic',    beds:0,  group:'special',   headNurse:'مژگان دلفانی' }
];

// ─── پرسنل کلیدی (مترون + سوپروایزرها + سرپرستار + نمونه پرستار) ───
const STAFF = [
  // ═══ دفتر پرستاری ═══
  { firstName:'مینا',  lastName:'نجفی حقی',         role:'nursing_director',   ward:'NURSING_OFFICE', personnelCode:'5059258191', employmentType:'رسمی', position:'مترون' },
  { firstName:'فیروزه',lastName:'علوی لواسانی',      role:'supervisor_senior',  ward:'NURSING_OFFICE', personnelCode:'0056368240', employmentType:'رسمی', position:'سوپروایزر' },
  { firstName:'مریم',  lastName:'محمدزاده نوجه دهی', role:'supervisor_clinical',ward:'NURSING_OFFICE', personnelCode:'0054720060', employmentType:'رسمی', position:'سوپروایزر' },
  { firstName:'زهرا',  lastName:'خادمیان موغاری',    role:'supervisor_er',      ward:'NURSING_OFFICE', personnelCode:'0056049501', employmentType:'رسمی', position:'سوپروایزر' },
  { firstName:'زهره',  lastName:'عظیم بیک',          role:'supervisor_clinical',ward:'NURSING_OFFICE', personnelCode:'0056546130', employmentType:'رسمی', position:'سوپروایزر' },
  { firstName:'مریم',  lastName:'قهرمانی سولدرق',    role:'supervisor_clinical',ward:'NURSING_OFFICE', personnelCode:'0057547531', employmentType:'رسمی', position:'سوپروایزر' },
  { firstName:'فاطمه', lastName:'گرجی زاده ولوکلائی',role:'supervisor_infection',ward:'NURSING_OFFICE',personnelCode:'2061027717', employmentType:'رسمی', position:'سوپروایزر' },
  { firstName:'محسن',  lastName:'مرسلی',             role:'supervisor_clinical',ward:'NURSING_OFFICE', personnelCode:'0057814521', employmentType:'رسمی', position:'سوپروایزر' },
  { firstName:'پروین', lastName:'اسماعیل زاده کندجانی',role:'supervisor_clinical',ward:'NURSING_OFFICE',personnelCode:'0061373834',employmentType:'رسمی',position:'سوپروایزر' },
  { firstName:'مژگان', lastName:'جعفریان',           role:'supervisor_clinical',ward:'NURSING_OFFICE', personnelCode:'0057749876', employmentType:'رسمی', position:'سوپروایزر' },
  { firstName:'رقیه',  lastName:'افتخاری خواتونی',    role:'supervisor_clinical',ward:'NURSING_OFFICE', personnelCode:'0072575697', employmentType:'رسمی', position:'سوپروایزر' },
  { firstName:'فرزانه',lastName:'ثقفی',              role:'supervisor_clinical',ward:'NURSING_OFFICE', personnelCode:'0067710263', employmentType:'رسمی', position:'سوپروایزر' },
  { firstName:'زهرا',  lastName:'میرزائی',           role:'supervisor_clinical',ward:'NURSING_OFFICE', personnelCode:'0066249112', employmentType:'رسمی', position:'سوپروایزر' },
  { firstName:'زهره',  lastName:'کاظم نادی',         role:'supervisor_clinical',ward:'NURSING_OFFICE', personnelCode:'0321990757', employmentType:'رسمی', position:'سوپروایزر' },
  { firstName:'مریم',  lastName:'شریفی صحی',         role:'supervisor_clinical',ward:'NURSING_OFFICE', personnelCode:'0062234854', employmentType:'رسمی', position:'سوپروایزر' },
  { firstName:'ناصر',  lastName:'پوریانی',           role:'supervisor_senior',  ward:'NURSING_OFFICE', personnelCode:'0076299635', employmentType:'رسمی', position:'سوپروایزر ارشد' },
  { firstName:'سید جعفر',lastName:'امیر سادات',      role:'supervisor_clinical',ward:'NURSING_OFFICE', personnelCode:'2452313092', employmentType:'رسمی', position:'سوپروایزر' },
  { firstName:'زهرا',  lastName:'سیف اللهی',         role:'supervisor_clinical',ward:'NURSING_OFFICE', personnelCode:'0421379121', employmentType:'رسمی', position:'سوپروایزر' },
  { firstName:'فهیمه', lastName:'سیاهوشی',           role:'supervisor_clinical',ward:'NURSING_OFFICE', personnelCode:'0066792843', employmentType:'رسمی آزمایشی', position:'سوپروایزر' },
  { firstName:'نسیم',  lastName:'واقفی رضائی',       role:'receptionist',       ward:'NURSING_OFFICE', personnelCode:'0059959347', employmentType:'قراردادی', position:'منشی' },
  { firstName:'فرزانه',lastName:'مشهدی کریم',        role:'receptionist',       ward:'NURSING_OFFICE', personnelCode:'0011979658', employmentType:'شرکتی', position:'منشی' },

  // ═══ ICU ریه ═══
  { firstName:'اکرم', lastName:'جلالی',        role:'head_nurse', ward:'ICU_RESP', personnelCode:'1171155581', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'فرشته',lastName:'آقامحمدی',     role:'nurse',      ward:'ICU_RESP', personnelCode:'0310184371', employmentType:'رسمی', position:'پرستار' },
  { firstName:'منصوره',lastName:'آشوب',        role:'nurse',      ward:'ICU_RESP', personnelCode:'0011156554', employmentType:'رسمی', position:'پرستار' },
  { firstName:'سارا', lastName:'موسوی متین',   role:'nurse',      ward:'ICU_RESP', personnelCode:'2002278301', employmentType:'رسمی', position:'پرستار' },
  { firstName:'مهدی', lastName:'فردی',         role:'nurse',      ward:'ICU_RESP', personnelCode:'0550135553', employmentType:'پیمانی', position:'پرستار' },

  // ═══ ICU اعصاب ═══
  { firstName:'مرضیه',lastName:'محمودی',          role:'head_nurse', ward:'ICU_NEURO', personnelCode:'6479784847', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'فاطمه',lastName:'شعبانی دیوشلی',   role:'nurse',      ward:'ICU_NEURO', personnelCode:'2709623358', employmentType:'رسمی', position:'پرستار' },
  { firstName:'زهره', lastName:'احمدی',           role:'nurse',      ward:'ICU_NEURO', personnelCode:'0321915127', employmentType:'رسمی', position:'پرستار' },

  // ═══ ICU اورژانس ═══
  { firstName:'فهیمه',lastName:'مولائی مشتاق',  role:'head_nurse', ward:'ICU_ER', personnelCode:'0066536911', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'فیروزه',lastName:'رنجبر',         role:'nurse',      ward:'ICU_ER', personnelCode:'5010086164', employmentType:'رسمی', position:'پرستار' },
  { firstName:'هاجر',  lastName:'سلیمانی بشلی',  role:'nurse',      ward:'ICU_ER', personnelCode:'2162263092', employmentType:'رسمی', position:'پرستار' },

  // ═══ ICU جنرال ۱ ═══
  { firstName:'سکینه',lastName:'امینی کیا',   role:'head_nurse', ward:'ICU_GEN1', personnelCode:'4898225578', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'محترم',lastName:'استرکی',      role:'nurse',      ward:'ICU_GEN1', personnelCode:'1239529724', employmentType:'رسمی', position:'پرستار' },
  { firstName:'رضا',  lastName:'نظری سندی',   role:'nurse',      ward:'ICU_GEN1', personnelCode:'3341203362', employmentType:'رسمی', position:'پرستار' },
  { firstName:'اکرم', lastName:'رضائی',       role:'nurse',      ward:'ICU_GEN1', personnelCode:'0058074163', employmentType:'رسمی', position:'پرستار' },

  // ═══ ICU جنرال ۲ ═══
  { firstName:'لیلا',  lastName:'اسکندری',              role:'head_nurse', ward:'ICU_GEN2', personnelCode:'0320835901', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'ام کلثوم',lastName:'تقی پور ایوکی',      role:'nurse',      ward:'ICU_GEN2', personnelCode:'5779888140', employmentType:'رسمی', position:'پرستار' },
  { firstName:'فرهاد', lastName:'حمیدزاده',             role:'nurse',      ward:'ICU_GEN2', personnelCode:'1500230571', employmentType:'رسمی', position:'پرستار' },

  // ═══ CCU ═══
  { firstName:'سپیده',lastName:'برادران',         role:'head_nurse', ward:'CCU', personnelCode:'0057000611', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'امین', lastName:'محمدزاده',        role:'nurse',      ward:'CCU', personnelCode:'4190103683', employmentType:'رسمی', position:'پرستار' },
  { firstName:'فضه',  lastName:'امروی',           role:'nurse',      ward:'CCU', personnelCode:'1600114334', employmentType:'رسمی', position:'پرستار' },
  { firstName:'نسرین',lastName:'یاری',            role:'nurse',      ward:'CCU', personnelCode:'0569398320', employmentType:'رسمی', position:'پرستار' },

  // ═══ اورژانس ═══
  { firstName:'زهرا', lastName:'رستم نیاء',   role:'head_nurse', ward:'ER', personnelCode:'1091248141', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'سارا', lastName:'ظریفی',       role:'nurse',      ward:'ER', personnelCode:'0011473746', employmentType:'رسمی', position:'پرستار' },
  { firstName:'مهدیه',lastName:'رحمتی',       role:'nurse',      ward:'ER', personnelCode:'4073287761', employmentType:'رسمی', position:'پرستار' },
  { firstName:'فاطمه',lastName:'حسین زاده',   role:'nurse',      ward:'ER', personnelCode:'0320600289', employmentType:'رسمی', position:'پرستار' },

  // ═══ جراحی ۱ و ۴ ═══
  { firstName:'فاطمه',lastName:'رضائی نوائی',  role:'head_nurse', ward:'GEN_SURG14', personnelCode:'2091917028', employmentType:'قراردادی', position:'سرپرستار' },
  { firstName:'فاطمه',lastName:'کمال خانی',    role:'nurse',      ward:'GEN_SURG14', personnelCode:'0014061112', employmentType:'رسمی', position:'پرستار' },
  { firstName:'اختر', lastName:'احمدی',        role:'nurse',      ward:'GEN_SURG14', personnelCode:'0084632461', employmentType:'قراردادی', position:'پرستار' },

  // ═══ جراحی ۲ ═══
  { firstName:'مریم', lastName:'عباسی نطنزی',role:'head_nurse', ward:'GEN_SURG2', personnelCode:'0056105495', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'بهاره',lastName:'مهدوی',      role:'nurse',      ward:'GEN_SURG2', personnelCode:'0012060518', employmentType:'رسمی', position:'پرستار' },
  { firstName:'آتنا', lastName:'روان',       role:'nurse',      ward:'GEN_SURG2', personnelCode:'0069771431', employmentType:'رسمی', position:'پرستار' },

  // ═══ عروق ۱ ═══
  { firstName:'نازیلا',lastName:'پورطهماسبی',  role:'head_nurse', ward:'VASC1', personnelCode:'0070689695', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'زهرا',  lastName:'مروج ماسوله', role:'nurse',      ward:'VASC1', personnelCode:'0016869451', employmentType:'رسمی', position:'پرستار' },

  // ═══ عروق ۲ ═══
  { firstName:'مهتاب',lastName:'غفارزاده',  role:'head_nurse', ward:'VASC2', personnelCode:'0059511346', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'سمانه',lastName:'مقدس',      role:'nurse',      ward:'VASC2', personnelCode:'0829441379', employmentType:'رسمی آزمایشی', position:'پرستار' },

  // ═══ فک و صورت ═══
  { firstName:'منیر', lastName:'خزائی',   role:'head_nurse', ward:'MAXFAX', personnelCode:'3358292886', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'مریم', lastName:'قاصد',    role:'nurse',      ward:'MAXFAX', personnelCode:'0015458245', employmentType:'رسمی آزمایشی', position:'پرستار' },

  // ═══ جراحی اعصاب مردان ═══
  { firstName:'فریبا', lastName:'حاجی محمدی', role:'head_nurse', ward:'NSURG_M', personnelCode:'0067536328', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'نیلوفر',lastName:'رضائی',      role:'nurse',      ward:'NSURG_M', personnelCode:'0075595117', employmentType:'رسمی', position:'پرستار' },

  // ═══ جراحی اعصاب زنان ═══
  { firstName:'فتانه',lastName:'زینلی گوهری', role:'head_nurse', ward:'NSURG_F', personnelCode:'2992125660', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'سمیه', lastName:'علیمرادیان',  role:'nurse',      ward:'NSURG_F', personnelCode:'0012836729', employmentType:'شرکتی', position:'پرستار' },

  // ═══ ارتوپدی مردان ═══
  { firstName:'زهرا',lastName:'شجاعی خبیصی', role:'head_nurse', ward:'ORTHO_M', personnelCode:'2090228652', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'هدی', lastName:'شاهیدفر',     role:'nurse',      ward:'ORTHO_M', personnelCode:'0013438514', employmentType:'شرکتی', position:'پرستار' },

  // ═══ ارتوپدی زنان ═══
  { firstName:'سمیه', lastName:'بادی',   role:'head_nurse', ward:'ORTHO_F', personnelCode:'0069847819', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'سپیده',lastName:'راعی',   role:'nurse',      ward:'ORTHO_F', personnelCode:'0011777427', employmentType:'رسمی', position:'پرستار' },

  // ═══ اورولوژی ۱ ═══
  { firstName:'پرستو',lastName:'پورمندی', role:'head_nurse', ward:'URO1', personnelCode:'0081579284', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'مهسا', lastName:'امیدی',   role:'nurse',      ward:'URO1', personnelCode:'2002748594', employmentType:'رسمی', position:'پرستار' },

  // ═══ اورولوژی ۲ ═══
  { firstName:'هدا',  lastName:'رئوفی',              role:'head_nurse', ward:'URO2', personnelCode:'4989587049', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'نگار', lastName:'ضیائی اوغانی',       role:'nurse',      ward:'URO2', personnelCode:'0017418984', employmentType:'رسمی', position:'پرستار' },

  // ═══ پیوند کلیه ═══
  { firstName:'محبوبه',lastName:'امین زاده',        role:'head_nurse', ward:'KIDNEY_TX', personnelCode:'0051389444', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'زهرا',  lastName:'قائینی حصاررویه',  role:'nurse',      ward:'KIDNEY_TX', personnelCode:'0493314962', employmentType:'پیمانی', position:'پرستار' },

  // ═══ داخلی مردان ═══
  { firstName:'سمیرا',lastName:'بیات',           role:'head_nurse', ward:'INT_M', personnelCode:'0076732495', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'احمد', lastName:'محمدپناه',       role:'nurse',      ward:'INT_M', personnelCode:'2949406750', employmentType:'رسمی', position:'پرستار' },
  { firstName:'ونوس', lastName:'بوچانی',         role:'nurse',      ward:'INT_M', personnelCode:'4940037460', employmentType:'رسمی', position:'پرستار' },

  // ═══ داخلی زنان ═══
  { firstName:'مریم', lastName:'خرقانی',           role:'head_nurse', ward:'INT_F', personnelCode:'0082657361', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'عاطفه',lastName:'ربیعی',            role:'nurse',      ward:'INT_F', personnelCode:'0534849008', employmentType:'رسمی', position:'پرستار' },
  { firstName:'فاطمه',lastName:'تقی زاده کجانی',   role:'nurse',      ward:'INT_F', personnelCode:'0076182339', employmentType:'رسمی', position:'پرستار' },

  // ═══ نورولوژی مردان ═══
  { firstName:'فاطمه',lastName:'سلیمانی',    role:'head_nurse', ward:'NEURO_M', personnelCode:'0510003362', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'مریم', lastName:'کاویانی',    role:'nurse',      ward:'NEURO_M', personnelCode:'0014618400', employmentType:'رسمی', position:'پرستار' },

  // ═══ نورولوژی زنان ═══
  { firstName:'فاطمه',lastName:'سیفی جلال',   role:'head_nurse', ward:'NEURO_F', personnelCode:'3874708950', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'سحر',  lastName:'دیندار مهربان',role:'nurse',      ward:'NEURO_F', personnelCode:'4310455247', employmentType:'رسمی', position:'پرستار' },

  // ═══ MS1 ═══
  { firstName:'انسیه',lastName:'یغما',              role:'head_nurse', ward:'MS1', personnelCode:'0067770010', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'الهه', lastName:'عسگری مهرآبادی',    role:'nurse',      ward:'MS1', personnelCode:'0534811434', employmentType:'رسمی', position:'پرستار' },

  // ═══ MS2 ═══
  { firstName:'مریم',  lastName:'خردروستا',       role:'head_nurse', ward:'MS2', personnelCode:'0065583485', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'عاطفه', lastName:'حکیمی نژاد',     role:'nurse',      ward:'MS2', personnelCode:'0780028708', employmentType:'رسمی', position:'پرستار' },

  // ═══ MS3 ═══
  { firstName:'فرانک',lastName:'رهبری',         role:'head_nurse', ward:'MS3', personnelCode:'0322038871', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'روشنک',lastName:'خمس آبادی',    role:'nurse',      ward:'MS3', personnelCode:'4899945647', employmentType:'رسمی', position:'پرستار' },

  // ═══ آنکولوژی ═══
  { firstName:'مریم',lastName:'عزلتی سروندانی',role:'head_nurse', ward:'ONCO', personnelCode:'0492544506', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'مریم',lastName:'الیاسی',        role:'nurse',      ward:'ONCO', personnelCode:'1630023523', employmentType:'رسمی', position:'پرستار' },

  // ═══ دیالیز ═══
  { firstName:'زبیده',lastName:'یحیی زاده جلودار', role:'head_nurse', ward:'DIALYSIS', personnelCode:'2060804272', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'راهله',lastName:'غلام زاده',        role:'nurse',      ward:'DIALYSIS', personnelCode:'0075207591', employmentType:'رسمی آزمایشی', position:'پرستار' },

  // ═══ کت لب ═══
  { firstName:'سیدعباس',lastName:'بنی هاشمی امام قیسی',role:'head_nurse', ward:'CATHLAB', personnelCode:'6299442891', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'زهرا',  lastName:'مجردکمال الدین پشته',  role:'nurse',      ward:'CATHLAB', personnelCode:'2709322943', employmentType:'قراردادی', position:'پرستار' },

  // ═══ VIP ═══
  { firstName:'مهسا',lastName:'وحیدی',                   role:'head_nurse', ward:'VIP', personnelCode:'3750133255', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'صبا', lastName:'رستگار محمدعلی زاده',    role:'nurse',      ward:'VIP', personnelCode:'0017671019', employmentType:'رسمی آزمایشی', position:'پرستار' },

  // ═══ اتاق عمل جنرال ═══
  { firstName:'علیرضا',lastName:'طاهری پری',          role:'head_nurse', ward:'OR_GEN', personnelCode:'3930271176', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'کبری',  lastName:'شهبازی',             role:'nurse',      ward:'OR_GEN', personnelCode:'0071913394', employmentType:'قراردادی', position:'کارشناس اتاق عمل' },
  { firstName:'فاطمه', lastName:'امانی پشم',          role:'nurse',      ward:'OR_GEN', personnelCode:'4070408142', employmentType:'رسمی', position:'کارشناس اتاق عمل' },

  // ═══ اتاق عمل اورژانس ═══
  { firstName:'زهرا', lastName:'محبی',             role:'head_nurse', ward:'OR_ER', personnelCode:'0076044351', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'زهرا', lastName:'صادقی',            role:'nurse',      ward:'OR_ER', personnelCode:'0410002313', employmentType:'رسمی', position:'کارشناس اتاق عمل' },
  { firstName:'نسرین',lastName:'حسین زاده',        role:'nurse',      ward:'OR_ER', personnelCode:'0569772133', employmentType:'رسمی', position:'کارشناس اتاق عمل' },

  // ═══ CSR ═══
  { firstName:'فتانه',lastName:'مستاجران گورتانی',  role:'head_nurse', ward:'CSR', personnelCode:'1290327254', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'سیده مریم',lastName:'مصطفوی',         role:'nurse',      ward:'CSR', personnelCode:'3979269711', employmentType:'رسمی', position:'پرستار' },

  // ═══ درمانگاه تخصصی ═══
  { firstName:'اکرم', lastName:'آخوندی قهرودی',  role:'head_nurse', ward:'CLINIC', personnelCode:'0060084057', employmentType:'رسمی', position:'سرپرستار' },
  { firstName:'زینت', lastName:'نراقی',          role:'nurse',      ward:'CLINIC', personnelCode:'0827987749', employmentType:'رسمی', position:'پرستار' },

  // ═══ آندوسکوپی ═══
  { firstName:'مژگان',lastName:'دلفانی',         role:'head_nurse', ward:'ENDOSCOPY', personnelCode:'2649232961', employmentType:'قراردادی', position:'سرپرستار' },
  { firstName:'ساناز',lastName:'کلاگر',          role:'nurse',      ward:'ENDOSCOPY', personnelCode:'4560149437', employmentType:'تمدیدطرح', position:'پرستار' }
];

module.exports = { WARDS, STAFF };
EOF
echo "✅ sina.js: $(grep -c "code:" core/sina.js) wards, $(grep -c "firstName:" core/sina.js) staff"

# ─── ۲) ماژول bedboard ───
cat > modules/bedboard.js << 'EOF'
const { h, sd } = require('../core/mod-helpers');
const sina = require('../core/sina');
const perms = require('../core/permissions');

const wards = (ctx) => {
  const beds = h(ctx, 'beds');
  const patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  const stats = sina.WARDS.map(w => {
    const wb = beds.filter(b => b.wardCode === w.code);
    const occupied = wb.filter(b => b.status === 'occupied').length;
    const available = wb.filter(b => b.status === 'available').length;
    const critical = wb.filter(b => b.status === 'occupied' && b.isCritical).length;
    return {
      code: w.code, label: w.label, type: w.type, group: w.group,
      headNurse: w.headNurse,
      total: wb.length || w.beds,
      occupied, available,
      occupancyPct: w.beds > 0 ? Math.round((occupied / wb.length) * 100) : 0
    };
  });
  return { items: stats, total: stats.length };
};

const ward = (ctx) => {
  const code = ctx.params.code;
  const w = sina.WARDS.find(x => x.code === code);
  if (!w) throw ctx.E.notFound('ward_not_found');
  const beds = h(ctx, 'beds').filter(b => b.wardCode === code);
  const patients = h(ctx, 'patients');
  const items = beds.map(b => {
    const p = b.patientId ? patients.find(x => x.id === b.patientId) : null;
    return {
      id: b.id, bedNumber: b.bedNumber, status: b.status,
      isCritical: !!b.isCritical,
      patient: p ? {
        id: p.id, name: p.firstName + ' ' + p.lastName,
        age: p.age, diagnosis: p.diagnosis
      } : null
    };
  });
  return { ward: { code: w.code, label: w.label, type: w.type, headNurse: w.headNurse }, items, total: items.length };
};

const assignBed = (ctx) => {
  const bed = ctx.store.get('beds', ctx.params.id);
  if (!bed) throw ctx.E.notFound('bed_not_found');
  if (bed.status !== 'available') throw ctx.E.conflict('bed_not_available');
  const pid = ctx.body.patientId;
  if (!pid) throw ctx.E.badRequest('patient_required');
  const p = ctx.store.get('patients', pid);
  if (!p) throw ctx.E.notFound('patient_not_found');
  // Release previous bed
  if (p.bedId && p.bedId !== bed.id) {
    const old = ctx.store.get('beds', p.bedId);
    if (old) { old.status = 'cleaning'; old.patientId = null; ctx.store.put('beds', old); }
  }
  bed.status = 'occupied'; bed.patientId = p.id; ctx.store.put('beds', bed);
  p.bedId = bed.id; p.bedNumber = bed.bedNumber; p.wardCode = bed.wardCode;
  ctx.store.put('patients', p);
  ctx.bus.emit('bed.assigned', { bed, patient: p, actor: ctx.actor });
  return { bed, patient: p };
};

const releaseBed = (ctx) => {
  const bed = ctx.store.get('beds', ctx.params.id);
  if (!bed) throw ctx.E.notFound('bed_not_found');
  const p = bed.patientId ? ctx.store.get('patients', bed.patientId) : null;
  bed.status = 'cleaning'; bed.patientId = null; ctx.store.put('beds', bed);
  if (p) { p.bedId = null; p.bedNumber = null; ctx.store.put('patients', p); }
  return { bed, patient: p };
};

const reseed = (ctx) => {
  // Clear beds + staff, reload from sina.js
  const bedsBefore = h(ctx, 'beds').length;
  const staffBefore = h(ctx, 'wf_staff').length;
  // Delete beds
  for (const b of h(ctx, 'beds')) ctx.store.remove('beds', b.id);
  // Delete staff
  for (const s of h(ctx, 'wf_staff')) ctx.store.remove('wf_staff', s.id);
  // Generate beds per ward
  for (const w of sina.WARDS) {
    if (!w.beds || w.beds < 1) continue;
    for (let i = 1; i <= w.beds; i++) {
      ctx.store.put('beds', {
        id: 'bed_' + w.code + '_' + i,
        wardCode: w.code, wardLabel: w.label,
        bedNumber: w.code + '-' + String(i).padStart(2, '0'),
        status: 'available', patientId: null,
        isCritical: ['icu','ccu','emergency'].includes(w.type)
      });
    }
  }
  // Add staff
  for (let i = 0; i < sina.STAFF.length; i++) {
    const s = sina.STAFF[i];
    ctx.store.put('wf_staff', {
      id: 'staff_' + (i + 1),
      fullName: s.firstName + ' ' + s.lastName,
      firstName: s.firstName, lastName: s.lastName,
      role: s.role, ward: s.ward,
      personnelCode: s.personnelCode,
      employmentType: s.employmentType,
      position: s.position,
      active: true, oncallEligible: true,
      createdAt: ctx.now()
    });
  }
  // Fix patients: reassign to real beds
  const patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  const freeBeds = h(ctx, 'beds').filter(b => b.status === 'available');
  for (let i = 0; i < patients.length && i < freeBeds.length; i++) {
    const p = patients[i], b = freeBeds[i];
    b.status = 'occupied'; b.patientId = p.id;
    ctx.store.put('beds', b);
    p.bedId = b.id; p.bedNumber = b.bedNumber; p.wardCode = b.wardCode;
    ctx.store.put('patients', p);
  }
  return {
    bedsBefore, staffBefore,
    bedsAfter: h(ctx, 'beds').length,
    staffAfter: h(ctx, 'wf_staff').length,
    wardsLoaded: sina.WARDS.filter(w => w.beds > 0).length,
    patientsReassigned: Math.min(patients.length, freeBed.length || patients.length)
  };
};

const stats = (ctx) => {
  const beds = h(ctx, 'beds');
  const wardsData = sina.WARDS.filter(w => w.beds > 0);
  const occ = beds.filter(b => b.status === 'occupied').length;
  const avail = beds.filter(b => b.status === 'available').length;
  return {
    totalWards: wardsData.length,
    totalBeds: beds.length,
    occupied: occ,
    available: avail,
    occupancyPct: beds.length ? Math.round((occ / beds.length) * 100) : 0,
    staffCount: h(ctx, 'wf_staff').length
  };
};

module.exports = {
  handlers: { wards, ward, assignBed, releaseBed, reseed, stats },
  routes: [
    { method:'GET',  path:'/api/bedboard/wards',        handler:'wards',      perm:null },
    { method:'GET',  path:'/api/bedboard/ward/:code',   handler:'ward',       perm:null },
    { method:'POST', path:'/api/bedboard/bed/:id/assign',  handler:'assignBed',  perm:'patients.transfer' },
    { method:'POST', path:'/api/bedboard/bed/:id/release', handler:'releaseBed', perm:'patients.transfer' },
    { method:'POST', path:'/api/bedboard/reseed-sina',  handler:'reseed',     perm:'admin.users.manage' },
    { method:'GET',  path:'/api/bedboard/stats',        handler:'stats',      perm:null }
  ],
  panels: [
    { id:'wards', title:'نقشه تخت', icon:'🛏️', perm:null, kind:'bedboard', api:'/api/bedboard/wards' }
  ]
};
EOF
echo "✅ bedboard.js — 6 endpoints"

# ─── ۳) Patch seed.js — add sina reseed hint ───
node << 'SEED'
const fs = require('fs');
let s = fs.readFileSync('core/seed.js', 'utf8');
if (!s.includes('reseed-sina') && !s.includes('Sina data')) {
  s = s.replace('module.exports={seed};',
    "module.exports={seed};\n// Sina real data: use POST /api/bedboard/reseed-sina (admin) to load real wards/staff");
  fs.writeFileSync('core/seed.js', s);
  console.log('✅ seed.js hint added');
}
SEED

# ─── ۴) Frontend — bed board + ward filter in extra.js ───
cat >> public/extra.js << 'ENDJS'

// ═══════════════════════════════════════════════════════════
//  Bed Board + Ward Filter
// ═══════════════════════════════════════════════════════════

const WARD_GROUP_LABELS = {
  admin:'🏛 دفتر', critical:'💔 مراقبت ویژه', emergency:'🚨 اورژانس',
  surgical:'🔪 جراحی', internal:'🏥 داخلی', neuro:'🧠 نورولوژی',
  oncology:'🎗 آنکولوژی', special:'✨ ویژه', vip:'⭐ VIP'
};

NABZ.showBedboard = async function(p, d) {
  const wards = d.items || [];
  const byGroup = {};
  for (const w of wards) {
    if (!byGroup[w.group]) byGroup[w.group] = [];
    byGroup[w.group].push(w);
  }
  const groupOrder = ['critical','emergency','surgical','internal','neuro','oncology','special','vip','admin'];

  const totalBeds = wards.reduce((s, w) => s + w.total, 0);
  const totalOcc = wards.reduce((s, w) => s + w.occupied, 0);
  const totalAvail = wards.reduce((s, w) => s + w.available, 0);

  let h = '<div class="sec-hd"><span>🛏️ نقشه تخت سینا</span><span style="font-size:11px;color:var(--fg-2)">' + wards.length + ' بخش</span></div>';

  // Stats
  h += '<div class="grid-4" style="margin-bottom:16px">';
  h += '<div class="stat ok"><div class="v">' + totalAvail + '</div><div class="l">تخت آزاد</div></div>';
  h += '<div class="stat dng"><div class="v">' + totalOcc + '</div><div class="l">اشغال</div></div>';
  h += '<div class="stat"><div class="v">' + totalBeds + '</div><div class="l">کل</div></div>';
  h += '<div class="stat ' + (totalOcc/totalBeds >= 0.85 ? 'warn' : '') + '"><div class="v">' + Math.round(totalOcc/totalBeds*100) + '%</div><div class="l">اشغال</div></div>';
  h += '</div>';

  // Wards by group
  for (const grp of groupOrder) {
    if (!byGroup[grp]) continue;
    h += '<div style="font-size:12px;font-weight:900;color:var(--fg-2);margin:16px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--border)">' + (WARD_GROUP_LABELS[grp] || grp) + '</div>';
    for (const w of byGroup[grp]) {
      const lvl = w.occupancyPct >= 90 ? 'dng' : w.occupancyPct >= 75 ? 'warn' : 'ok';
      h += '<div class="row ' + (lvl === 'dng' ? 'hi' : lvl === 'warn' ? 'md' : 'lo') + '" onclick="NABZ.openWard(\'' + w.code + '\')">';
      h += '<div class="row-hd"><div class="row-title">' + NABZ._esc(w.label) + '</div>';
      h += '<span class="pill ' + lvl + '">' + w.occupancyPct + '%</span></div>';
      h += '<div class="row-meta">سرپرستار: ' + NABZ._esc(w.headNurse || '—') + ' · ' + w.occupied + '/' + w.total + ' تخت</div>';
      // occupancy bar
      h += '<div style="height:4px;background:var(--border);border-radius:2px;margin-top:8px;overflow:hidden"><div style="height:100%;width:' + w.occupancyPct + '%;background:var(--' + (lvl === 'dng' ? 'dng' : lvl === 'warn' ? 'warn' : 'ok') + ');border-radius:2px"></div></div>';
      h += '</div>';
    }
  }
  document.getElementById('content').innerHTML = h;
};

NABZ.openWard = async function(code) {
  const m = document.getElementById('content');
  m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
  try {
    const d = await NABZ._api('/api/bedboard/ward/' + code);
    const w = d.ward;
    let h = '<div class="sec-hd"><span>🛏️ ' + NABZ._esc(w.label) + '</span><span style="font-size:11px;color:var(--fg-2)">' + d.items.length + ' تخت</span></div>';
    h += '<div class="card" style="margin-bottom:12px"><div style="font-size:12px">سرپرستار: <strong>' + NABZ._esc(w.headNurse) + '</strong></div></div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:8px">';
    for (const b of d.items) {
      const color = b.status === 'occupied' ? 'var(--dng)' : b.status === 'cleaning' ? 'var(--warn)' : 'var(--ok)';
      h += '<div class="card" style="padding:8px;text-align:center;border-top:3px solid ' + color + ';cursor:pointer" onclick="NABZ.showBedDetail(\'' + b.id + '\')">';
      h += '<div style="font-size:11px;font-weight:900;color:var(--primary)">' + NABZ._esc(b.bedNumber) + '</div>';
      if (b.patient) {
        h += '<div style="font-size:9.5px;font-weight:700;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + NABZ._esc(b.patient.name) + '</div>';
        h += '<div style="font-size:8.5px;color:var(--fg-2)">' + (b.patient.age || '—') + ' س</div>';
      } else {
        h += '<div style="font-size:9px;color:var(--fg-3);margin-top:2px">' + (b.status === 'cleaning' ? '🧹' : '✓') + '</div>';
      }
      h += '</div>';
    }
    h += '</div>';
    h += '<div style="margin-top:16px"><button class="btn btn-block" onclick="NABZ.show(\'bedboard.wards\')">← بازگشت</button></div>';
    m.innerHTML = h;
  } catch (e) { m.innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>'; }
};

NABZ.showBedDetail = function(bedId) {
  const sheet = document.createElement('div');
  sheet.className = 'bs-backdrop';
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
  NABZ._api('/api/bedboard/ward/' + NABZ._currentWard).then(d => {
    const b = d.items.find(x => x.id === bedId);
    if (!b) return;
    let h = '<div class="bs-handle"></div>';
    h += '<div class="bs-hd"><div class="bs-title">🛏️ ' + NABZ._esc(b.bedNumber) + '</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div class="bs-body">';
    h += '<div class="bs-row"><div class="bs-key">status</div><div class="bs-val">' + NABZ._esc(b.status) + '</div></div>';
    if (b.patient) {
      h += '<div class="bs-row"><div class="bs-key">patient</div><div class="bs-val">' + NABZ._esc(b.patient.name) + '</div></div>';
      h += '<div class="bs-row"><div class="bs-key">age</div><div class="bs-val">' + (b.patient.age || '—') + '</div></div>';
      h += '<div class="bs-row"><div class="bs-key">diagnosis</div><div class="bs-val">' + NABZ._esc(b.patient.diagnosis || '—') + '</div></div>';
    }
    h += '</div>';
    const c = document.createElement('div');
    c.className = 'bs-sheet';
    c.innerHTML = h;
    sheet.appendChild(c);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('show'));
  }).catch(e => alert(e.message));
};

// Store current ward for bed detail
const _origOpenWard = NABZ.openWard;
NABZ.openWard = async function(code) {
  NABZ._currentWard = code;
  return _origOpenWard(code);
};

// ═══════════════════════════════════════════════════════════
//  Sina Reseed Button
// ═══════════════════════════════════════════════════════════

NABZ.loadSinaData = async function() {
  if (!confirm('⚠️ این عمل تمام تخت‌ها و پرسنل فعلی را پاک می‌کند و دیتای واقعی سینا را بارگذاری می‌کند.\n\nبیماران و سایر داده‌ها حفظ می‌شوند.\n\nادامه؟')) return;
  try {
    const r = await NABZ._api('/api/bedboard/reseed-sina', { method:'POST', body: '{}' });
    alert('✅ دیتای سینا بارگذاری شد\n\nبخش‌ها: ' + r.wardsLoaded + '\nتخت‌ها: ' + r.bedsAfter + '\nپرسنل: ' + r.staffAfter);
    NABZ.show('bedboard.wards');
  } catch (e) { alert('❌ ' + e.message); }
};
ENDJS
echo "✅ Frontend bed board + reseed UI added"

# ─── ۵) Patch app.js — delegate bedboard kind ───
node << 'APP'
const fs = require('fs');
let s = fs.readFileSync('public/app.js', 'utf8');
if (!s.includes("p.kind === 'bedboard'")) {
  const old = "if (p.kind === 'action') renderAction(p, d);";
  const neu = "if (p.kind === 'action') renderAction(p, d);\n      else if (p.kind === 'bedboard' && NABZ.showBedboard) await NABZ.showBedboard(p, d);";
  s = s.replace(old, neu);
  fs.writeFileSync('public/app.js', s);
  console.log('✅ app.js — bedboard kind delegated');
}
APP

# ─── ۶) Patch home dashboard — add bed occupancy stat ───
node << 'HOME'
const fs = require('fs');
let s = fs.readFileSync('modules/home.js', 'utf8');
if (!s.includes("'bedboard'")) {
  // Add beds stat to all role variants
  s = s.replace(
    /(stats\.push\(\{ label:'بیماران من'[^\n]*\n)/,
    "$1    const bedStats = h(ctx, 'beds');\n    const occupied = bedStats.filter(b => b.status === 'occupied').length;\n    stats.push({ label:'اشغال تخت', value: occupied + '/' + bedStats.length, color: occupied/Math.max(1,bedStats.length) >= 0.85 ? 'dng' : 'ok', action:\"NABZ.show('bedboard.wards')\" });\n"
  );
  fs.writeFileSync('modules/home.js', s);
  console.log('✅ home.js bed occupancy stat added');
}
HOME

# ─── ۷) Add head nurse login users (sample 8) ───
node << 'USERS'
const store = require('./core/store');
const bc = require('bcryptjs');
const sina = require('./core/sina');
const existing = store.readAll('users');
const headNurses = sina.STAFF.filter(s => s.role === 'head_nurse').slice(0, 8);
for (const hn of headNurses) {
  const uname = 'hn_' + hn.personnelCode;
  if (existing.some(u => u.username === uname)) continue;
  store.put('users', {
    id: 'usr_' + hn.personnelCode,
    username: uname,
    fullName: hn.firstName + ' ' + hn.lastName,
    role: 'head_nurse',
    ward: hn.ward,
    active: true,
    passwordHash: bc.hashSync('nabz@2026', 8),
    createdAt: new Date().toISOString()
  });
}
console.log('✅ ' + headNurses.length + ' head nurse logins added (password: nabz@2026)');
USERS

# ─── ۸) Restart ───
for pid in $(pgrep -f "core/server.js" 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done
sleep 1

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ Part 9 — Sina Foundation ready          ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Wards:   $(grep -c "code:" core/sina.js)"
echo "Staff:   $(grep -c "firstName:" core/sina.js)"
echo "Routes:  +6"
echo ""
echo "Next: node core/server.js"
echo ""
echo "After login: Drawer → 🛏️ نقشه تخت"
echo "Then click: 🏥 Load Sina Data button (inside bedboard panel)"
