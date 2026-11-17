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
