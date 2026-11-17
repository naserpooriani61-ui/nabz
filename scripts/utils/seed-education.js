'use strict';
const store = require('./core/store');

console.log('');
console.log('════════════════════════════════════════════════════════════════');
console.log('  🎓 Seed محتوای آموزشی — بیمارستان آموزشی سینا');
console.log('════════════════════════════════════════════════════════════════');
console.log('');

function has(coll, pred) { return store.readAll(coll).some(pred); }
function addQ(q) {
  if (has('questions', x => x.stem === q.stem)) return false;
  store.put('questions', {
    id: store.uid('q'),
    type: q.type || 'mcq_single',
    stem: q.stem,
    options: q.options || [],
    correctAnswer: q.correctAnswer || null,
    correctAnswers: q.correctAnswers || [],
    category: q.category || 'general',
    difficulty: q.difficulty || 'medium',
    points: q.points || 1,
    explanation: q.explanation || '',
    tags: q.tags || [],
    createdBy: 'usr_admin',
    createdByName: 'مدیر سیستم',
    createdAt: new Date().toISOString()
  });
  return true;
}

// ═════════════════════════════════════════════════════════════════
//  1) BANK QUESTIONS — ۵۶ سوال
// ═════════════════════════════════════════════════════════════════
console.log('▸ ۱) بانک سوالات');

const QS = [
  // ── ایمنی بیمار (8) ──
  { stem:'مهم‌ترین اقدام پیش از هر مداخله بالینی برای شناسایی بیمار چیست؟',
    options:['پرسیدن نام بیمار','استفاده از دو شناسه مستقل (نام + تاریخ تولد یا کد ملی)','تشخیص چهره','بررسی تخت بیمار'],
    correctAnswer:'استفاده از دو شناسه مستقل (نام + تاریخ تولد یا کد ملی)',
    category:'safety', difficulty:'easy',
    explanation:'استفاده از دو شناسه مستقل استاندارد طلایی شناسایی بیمار است. فقط پرسیدن نام کافی نیست چون بیماران هم‌نام وجود دارند.',
    tags:['شناسایی بیمار','ایمنی'] },
  { stem:'کدام گزینه از اجزای «پنج Right» توزیع دارو نیست؟',
    options:['بیمار صحیح','داروی صحیح','دوز صحیح','محل نگهداری صحیح'],
    correctAnswer:'محل نگهداری صحیح',
    category:'safety', difficulty:'medium',
    explanation:'پنج Right = بیمار، دارو، دوز، مسیر، زمان صحیح. محل نگهداری در این فهرست نیست.',
    tags:['دارو','پنج Right'] },
  { stem:'کدام ابزار برای ارزیابی خطر سقوط در بیماران استفاده می‌شود؟',
    options:['Braden Scale','Morse Fall Scale','Glasgow Coma Scale','Aldrete Score'],
    correctAnswer:'Morse Fall Scale',
    category:'safety', difficulty:'medium',
    explanation:'Morse Fall Scale مخصوص ارزیابی خطر سقوط است. Braden برای زخم فشاری، GCS برای سطح هوشیاری، Aldrete برای ریکاوری.',
    tags:['سقوط','Morse'] },
  { stem:'برای پیشگیری از زخم فشاری، بیمار بی‌حرکت باید هر چند ساعت تغییر وضعیت دهد؟',
    options:['هر ۳۰ دقیقه','هر ۲ ساعت','هر ۴ ساعت','هر ۸ ساعت'],
    correctAnswer:'هر ۲ ساعت',
    category:'safety', difficulty:'easy',
    explanation:'پروتکل استاندارد تغییر وضعیت هر ۲ ساعت است. در بیماران پرخطر با سطح محافظ هر ۴ ساعت.',
    tags:['زخم فشاری','Braden'] },
  { stem:'اولین اقدام در صورت کشف خطای دارویی که به بیمار داده شده چیست؟',
    options:['فراموش کردن ماجرا','ارزیابی وضعیت بیمار و اطلاع فوری پزشک','دادن پادزهر بدون تجویز','دادن دارو به بیماران دیگر'],
    correctAnswer:'ارزیابی وضعیت بیمار و اطلاع فوری پزشک',
    category:'safety', difficulty:'medium',
    explanation:'اولویت اول ارزیابی بالینی بیمار است. سپس گزارش‌دهی به پزشک و مسئول ایمنی بیمار.',
    tags:['خطای دارویی','گزارش'] },
  { stem:'«Near Miss» در ایمنی بیمار به چه معناست؟',
    options:['مرگ بیمار','حادثه‌ای که به بیمار آسیب رساند','حادثه‌ای که نزدیک بود آسیب برساند ولی نرساند','مشکل تجهیزات'],
    correctAnswer:'حادثه‌ای که نزدیک بود آسیب برساند ولی نرساند',
    category:'safety', difficulty:'easy',
    explanation:'Near Miss یعنی خطا رخ داد ولی به بیمار نرسید یا آسیبی وارد نکرد. اهمیت گزارش‌دهی دارد چون می‌تواند به آسیب واقعی منجر شود.',
    tags:['Near Miss','گزارش'] },
  { stem:'هدف اصلی استقرار «Culture of Safety» در بیمارستان چیست؟',
    options:['تنبیه کارکنان خطاکار','گزارش‌دهی بدون ترس از مجازات','افزایش آمار گزارش','کاهش حقوق کارکنان'],
    correctAnswer:'گزارش‌دهی بدون ترس از مجازات',
    category:'safety', difficulty:'medium',
    explanation:'فرهنگ ایمنی یعنی کارکنان بدون ترس از سرزنش، خطاها و Near Miss‌ها را گزارش دهند تا از تکرار جلوگیری شود.',
    tags:['فرهنگ ایمنی'] },
  { stem:'دستبند شناسایی بیمار با کدام رنگ برای بیمار در معرض سقوط است؟',
    options:['قرمز','زرد','سبز','آبی'],
    correctAnswer:'زرد',
    category:'safety', difficulty:'easy',
    explanation:'دستبند زرد = خطر سقوط. قرمز = آلرژی. سبز = بدون محدودیت.',
    tags:['سقوط','دستبند'] },

  // ── کنترل عفونت (8) ──
  { stem:'مهم‌ترین اقدام برای پیشگیری از عفونت بیمارستانی چیست؟',
    options:['استفاده از دستکش','شستشوی دست','ماسک زدن','آنتی‌بیوتیک پروفیلاکسی'],
    correctAnswer:'شستشوی دست',
    category:'infection_control', difficulty:'easy',
    explanation:'شستشوی دست مهم‌ترین مداخله برای کاهش عفونت بیمارستانی است. ۵ موقعیت WHO برای آن تعریف شده.',
    tags:['شستشوی دست','WHO'] },
  { stem:'مدت شستشوی دست با آب و صابون (روش معمول) چقدر است؟',
    options:['۵-۱۰ ثانیه','۱۵-۲۰ ثانیه','۴۰-۶۰ ثانیه','۳ دقیقه'],
    correctAnswer:'۴۰-۶۰ ثانیه',
    category:'infection_control', difficulty:'medium',
    explanation:'۴۰-۶۰ ثانیه با آب و صابون. الکل‌ریت ۲۰-۳۰ ثانیه (اگر دست مرئی آلوده نباشد).',
    tags:['شستشوی دست'] },
  { stem:'برای ورود به اتاق ایزولاسیون هوایی (Airborne) کدام ماسک لازم است؟',
    options:['ماسک جراحی','ماسک N95 یا بالاتر','ماسک پارچه‌ای','ماسک بدون فیلتر'],
    correctAnswer:'ماسک N95 یا بالاتر',
    category:'infection_control', difficulty:'medium',
    explanation:'ایزولاسیون هوایی (سل، سرخک، آبله) نیاز به N95 یا FFP2/FFP3. ماسک جراحی برای Droplet کافی است.',
    tags:['ایزولاسیون','N95'] },
  { stem:'CLABSI به چه معناست؟',
    options:['عفونت ادراری','عفونت خون مرتبط با کاتتر مرکزی','عفونت محل جراحی','پنومونی ونتیلاتور'],
    correctAnswer:'عفونت خون مرتبط با کاتتر مرکزی',
    category:'infection_control', difficulty:'medium',
    explanation:'CLABSI = Central Line-Associated Bloodstream Infection. پیشگیری با آنتی‌سپتیک پوست، دسترسی استریل.',
    tags:['CLABSI','کاتتر'] },
  { stem:'بهترین روش پیشگیری از VAP (پنومونی ونتیلاتور) چیست؟',
    options:['کاهش آنتی‌بیوتیک','بالا نگه داشتن سر تخت ۳۰-۴۵ درجه','شستشوی دهان با آب','ماسک N95 برای همه'],
    correctAnswer:'بالا نگه داشتن سر تخت ۳۰-۴۵ درجه',
    category:'infection_control', difficulty:'medium',
    explanation:'VAP Bundle: سر تخت ۳۰-۴۵ درجه، شستشوی دهان با کلرهگزیدین، پروفیلاکسی زخم معده، قطع روزانه sedation.',
    tags:['VAP','ونتیلاتور'] },
  { stem:'CAUTI یعنی چه؟',
    options:['عفونت خون','عفونت ادراری مرتبط با کاتتر','عفونت تنفسی','عفونت پوست'],
    correctAnswer:'عفونت ادراری مرتبط با کاتتر',
    category:'infection_control', difficulty:'medium',
    explanation:'CAUTI = Catheter-Associated Urinary Tract Infection. بهترین پیشگیری: حذف روزانه سوند و بررسی اندیکاسیون.',
    tags:['CAUTI','سوند'] },
  { stem:'SSI (عفونت محل جراحی) در چه بازه زمانی رخ می‌دهد؟',
    options:['فقط در اتاق عمل','تا ۳۰ روز بعد از جراحی (یا ۹۰ روز برای ایمپلنت)','فقط ۴۸ ساعت اول','فقط در بیماران دیابتی'],
    correctAnswer:'تا ۳۰ روز بعد از جراحی (یا ۹۰ روز برای ایمپلنت)',
    category:'infection_control', difficulty:'hard',
    explanation:'تعریف CDC: SSI تا ۳۰ روز بعد از جراحی یا ۹۰ روز در صورت کاشت ایمپلنت.',
    tags:['SSI','جراحی'] },
  { stem:'ست تزریق سرم و لوله‌های IV هر چند وقت باید تعویض شوند؟',
    options:['هر ۲۴-۴۸ ساعت','هر هفته','هر ماه','تا زمانی که سالم است'],
    correctAnswer:'هر ۲۴-۴۸ ساعت',
    category:'infection_control', difficulty:'medium',
    explanation:'ست تزریق ۲۴-۴۸ ساعت، محل کاتتر محیطی ۷۲-۹۶ ساعت (اگر آلوده نشده) — مگر در صورت آلودگی فوری.',
    tags:['IV','ست'] },

  // ── سپسیس (6) ──
  { stem:'qSOFA از کدام سه پارامتر تشکیل شده است؟',
    options:['HR، Temp، BP','RR≥22، SBP≤100، GCS<15','WBC، CRP، Lactate','Age، BP، HR'],
    correctAnswer:'RR≥22، SBP≤100، GCS<15',
    category:'clinical', difficulty:'medium',
    explanation:'qSOFA = quick Sepsis-related Organ Failure Assessment. سه پارامتر بالینی بدون آزمایش.',
    tags:['qSOFA','سپسیس'] },
  { stem:'حداقل امتیاز qSOFA برای مشکوک شدن به سپسیس چند است؟',
    options:['۱','۲','۳','۴'],
    correctAnswer:'۲',
    category:'clinical', difficulty:'easy',
    explanation:'qSOFA ≥ ۲ نشان‌دهنده خطر بالای مرگ در بیمار با عفونت. نیاز به ارزیابی فوری.',
    tags:['qSOFA','سپسیس'] },
  { stem:'حداکثر زمان مجاز برای تجویز آنتی‌بیوتیک وسیع‌الطیف در سپسیس چقدر است؟',
    options:['۳۰ دقیقه','۱ ساعت','۳ ساعت','۶ ساعت'],
    correctAnswer:'۱ ساعت',
    category:'clinical', difficulty:'medium',
    explanation:'Surviving Sepsis Campaign: آنتی‌بیوتیک وسیع‌الطیف در ۱ ساعت اول. کشت خون قبل از آنتی‌بیوتیک.',
    tags:['سپسیس','آنتی‌بیوتیک'] },
  { stem:'حجم مایع اولیه توصیه‌شده در سپسیس چقدر است؟',
    options:['۱۰ ml/kg','۲۰ ml/kg','۳۰ ml/kg','۵۰ ml/kg'],
    correctAnswer:'۳۰ ml/kg',
    category:'clinical', difficulty:'medium',
    explanation:'۳۰ ml/kg کریستالوئید (معمولاً RL) در ۳ ساعت اول. سپس ارزیابی پاسخ.',
    tags:['سپسیس','مایع‌درمانی'] },
  { stem:'وازوپرسور خط اول در شوک سپتیک چیست؟',
    options:['دوپامین','نوراپی‌نفرین','اپی‌نفرین','وازوپرسین'],
    correctAnswer:'نوراپی‌نفرین',
    category:'clinical', difficulty:'medium',
    explanation:'نوراپی‌نفرین خط اول. هدف MAP ≥ 65 mmHg. در صورت نیاز، وازوپرسین افزوده می‌شود.',
    tags:['سپسیس','وازوپرسور'] },
  { stem:'کدام یک از موارد زیر نشانه‌ی سپسیس نیست؟',
    options:['تب یا هایپوترمی','تاکی‌پنه','هیپرگلیسمی در غیر دیابتی','برادی‌کاردی شدید'],
    correctAnswer:'برادی‌کاردی شدید',
    category:'clinical', difficulty:'medium',
    explanation:'در سپسیس معمولاً تاکی‌کاردی داریم. برادی‌کاردی شدید نشانه‌ی سپسیس نیست (مگر در شرایط خاص).',
    tags:['سپسیس','علائم'] },

  // ── تزریق خون (6) ──
  { stem:'تزریق خون ایمن چند نفر باید آن را چک کنند؟',
    options:['۱ نفر','۲ نفر','۳ نفر','۴ نفر'],
    correctAnswer:'۲ نفر',
    category:'safety', difficulty:'easy',
    explanation:'چک دو نفره اجباری است: هویت بیمار، گروه خونی، شماره کیسه، تاریخ انقضا. هر دو امضا می‌کنند.',
    tags:['تزریق خون','ایمنی'] },
  { stem:'علائم واکنش همولیتیک حاد در تزریق خون کدامند؟',
    options:['فقط تب','تب، لرز، درد پهلو و ادرار تیره','خارش ساده','افت فشار تنها'],
    correctAnswer:'تب، لرز، درد پهلو و ادرار تیره',
    category:'safety', difficulty:'medium',
    explanation:'واکنش همولیتیک حاد: تب، لرز، درد کمر/پهلو، ادرار تیره، افت فشار. درمان: توقف فوری + مایع + اطلاع بانک خون.',
    tags:['تزریق خون','واکنش'] },
  { stem:'حداکثر مدت تزریق یک واحد PRBC چقدر است؟',
    options:['۱ ساعت','۲ ساعت','۴ ساعت','۸ ساعت'],
    correctAnswer:'۴ ساعت',
    category:'safety', difficulty:'medium',
    explanation:'حداکثر ۴ ساعت. در صورت نیاز به تزریق آهسته (مثل نارسایی قلبی)، باز هم نباید از ۴ ساعت بیشتر شود.',
    tags:['تزریق خون','مدت'] },
  { stem:'گروه خونی «دهنده جهانی» کدام است؟',
    options:['A+','B+','AB+','O-'],
    correctAnswer:'O-',
    category:'safety', difficulty:'easy',
    explanation:'O- بدون آنتی‌ژن A/B و Rh است. در شرایط اورژانس به هر بیماری قابل تزریق است.',
    tags:['خون','ABO'] },
  { stem:'گروه خونی «گیرنده جهانی» کدام است؟',
    options:['O+','O-','AB+','A-'],
    correctAnswer:'AB+',
    category:'safety', difficulty:'easy',
    explanation:'AB+ می‌تواند هر گروه خونی را دریافت کند چون هیچ آنتی‌بادی علیه A، B یا Rh ندارد.',
    tags:['خون','ABO'] },
  { stem:'چند دقیقه اول تزریق خون بحرانی است؟',
    options:['۵ دقیقه اول با سرعت آهسته','۳۰ دقیقه اول بدون پایش','ساعت اول','کل مدت تزریق'],
    correctAnswer:'۵ دقیقه اول با سرعت آهسته',
    category:'safety', difficulty:'medium',
    explanation:'۱۵ دقیقه اول با سرعت آهسته (۲ ml/min) و پایش دقیق. بیشتر واکنش‌های همولیتیک در همین بازه رخ می‌دهند.',
    tags:['تزریق خون','پایش'] },

  // ── دارو (7) ──
  { stem:'High-Alert Medication به چه معناست؟',
    options:['داروهای گران','داروهایی که خطا در آن‌ها آسیب جدی می‌زند','داروهای کمیاب','داروهای مخدر'],
    correctAnswer:'داروهایی که خطا در آن‌ها آسیب جدی می‌زند',
    category:'safety', difficulty:'medium',
    explanation:'شامل انسولین، هپارین، وارفارین، مخدرها، پتاسیم غلیظ، شیمی‌درمانی. نیاز به چک دو نفره یا پروتکل سختگیرانه.',
    tags:['High-Alert','دارو'] },
  { stem:'پادزهر هپارین چیست؟',
    options:['ویتامین K','پروتامین سولفات','نالوکسان','فلومازنیل'],
    correctAnswer:'پروتامین سولفات',
    category:'safety', difficulty:'medium',
    explanation:'پروتامین هپارین را خنثی می‌کند. ۱ mg پروتامین برای هر ۱۰۰ واحد هپارین.',
    tags:['هپارین','پادزهر'] },
  { stem:'پادزهر وارفارین چیست؟',
    options:['پروتامین','ویتامین K','نالوکسان','بی‌کربنات'],
    correctAnswer:'ویتامین K',
    category:'safety', difficulty:'medium',
    explanation:'ویتامین K (فیتومندادیون). در موارد شدید: PCC یا FFP نیز.',
    tags:['وارفارین','پادزهر'] },
  { stem:'پادزهر مسمومیت با مخدرها (مورفین، فنتانیل) چیست؟',
    options:['فلومازنیل','نالوکسان','اتانول','متادون'],
    correctAnswer:'نالوکسان',
    category:'safety', difficulty:'medium',
    explanation:'نالوکسان آنتاگونیست اختصاصی گیرنده‌های اپیوئیدی است. دوز ۰٫۴ mg IV.',
    tags:['مخدر','پادزهر'] },
  { stem:'پادزهر مسمومیت با بنزودیازپین‌ها چیست؟',
    options:['نالوکسان','فلومازنیل','پروتامین','N-استیل‌سیستئین'],
    correctAnswer:'فلومازنیل',
    category:'safety', difficulty:'medium',
    explanation:'فلومازنیل آنتاگونیست گیرنده بنزودیازپین است. احتیاط در بیماران صرعی.',
    tags:['بنزودیازپین','پادزهر'] },
  { stem:'انسولین باید در چه دمایی نگه‌داری شود؟',
    options:['دمای اتاق','یخچال دارویی (۲-۸ درجه)','فریزر','هر دمایی'],
    correctAnswer:'یخچال دارویی (۲-۸ درجه)',
    category:'safety', difficulty:'easy',
    explanation:'انسولین قلمی باز نشده در یخچال. قلم باز شده تا ۲۸ روز در دمای اتاق.',
    tags:['انسولین','نگهداری'] },
  { stem:'دوز آسپرین توصیه‌شده در ACS حاد چقدر است؟',
    options:['۸۱ mg','۱۶۲ mg','۳۲۵ mg','۵۰۰ mg'],
    correctAnswer:'۳۲۵ mg',
    category:'clinical', difficulty:'medium',
    explanation:'۳۲۵ mg جویدنی در دوز اول. سپس ۸۱ mg روزانه به‌عنوان دوز نگه‌دارنده.',
    tags:['آسپرین','ACS'] },

  // ── اورژانس (6) ──
  { stem:'اولین اقدام در کد ۹۹ (ایست قلبی) چیست؟',
    options:['اینتیوباسیون','شروع CPR','شوک فوری','تجویز اپی‌نفرین'],
    correctAnswer:'شروع CPR',
    category:'emergency', difficulty:'easy',
    explanation:'شروع فوری فشردن قفسه سینه. ABC به C-A-B تغییر یافته: Compressions first.',
    tags:['CPR','کد ۹۹'] },
  { stem:'نسبت فشردن به تنفس در CPR بزرگسال (تک نفره) چقدر است؟',
    options:['۱۵:۲','۳۰:۲','۵:۱','۱۵:۱'],
    correctAnswer:'۳۰:۲',
    category:'emergency', difficulty:'medium',
    explanation:'۳۰ فشردن، ۲ تنفس. سرعت ۱۰۰-۱۲۰ در دقیقه، عمق ۵-۶ سانتی‌متر.',
    tags:['CPR','BLS'] },
  { stem:'عمق فشردن قفسه سینه در CPR بزرگسال چقدر است؟',
    options:['۲-۳ سانتی‌متر','۳-۴ سانتی‌متر','۵-۶ سانتی‌متر','۸ سانتی‌متر'],
    correctAnswer:'۵-۶ سانتی‌متر',
    category:'emergency', difficulty:'medium',
    explanation:'حداقل ۵ سانتی‌متر، حداکثر ۶ سانتی‌متر. بیش از ۶ سانتی‌متر می‌تواند آسیب برساند.',
    tags:['CPR','BLS'] },
  { stem:'کد ۲۴۷ در بیمارستان برای چه فعال می‌شود؟',
    options:['ایست قلبی','سکته مغزی','سکته قلبی STEMI','ترومای شدید'],
    correctAnswer:'سکته قلبی STEMI',
    category:'emergency', difficulty:'easy',
    explanation:'کد ۲۴۷ = STEMI. کد ۷۲۴ = Stroke. کد ۹۹ = ایست قلبی.',
    tags:['کد ۲۴۷','STEMI'] },
  { stem:'ESI Level 1 در تریاژ اورژانس یعنی چه؟',
    options:['غیرفوری','فوری','اورژانسی','نیاز به احیای فوری'],
    correctAnswer:'نیاز به احیای فوری',
    category:'emergency', difficulty:'medium',
    explanation:'ESI ۱ = نیاز به احیای فوری (توقف قلبی، شوک، GCS ≤ ۸). ESI ۲ = اورژانسی، ESI ۳-۵ به ترتیب.',
    tags:['ESI','تریاژ'] },
  { stem:'در MCI (سانحه دسته‌جمعی)، اولویت اول چیست؟',
    options:['درمان همه','تریاژ سریع بر اساس شدت','ثبت اطلاعات','انتقال همه به MRI'],
    correctAnswer:'تریاژ سریع بر اساس شدت',
    category:'emergency', difficulty:'medium',
    explanation:'در MCI، تریاژ START/SALT: قرمز (فوری)، زرد (تأخیری)، سبز (سرپایی)، سیاه (فوت/انتظار).',
    tags:['MCI','تریاژ'] },

  // ── ارتباط (5) ──
  { stem:'ISBAR برای چه هدفی طراحی شده است؟',
    options:['ثبت ویتال','ارتباط ساختاریافته بالینی','محاسبه دوز','مدیریت شیفت'],
    correctAnswer:'ارتباط ساختاریافته بالینی',
    category:'communication', difficulty:'easy',
    explanation:'ISBAR = Identify, Situation, Background, Assessment, Recommendation. برای کاهش خطا در ارتباط.',
    tags:['ISBAR','ارتباط'] },
  { stem:'S در ISBAR مخفف چیست؟',
    options:['Summary','Situation','Safety','System'],
    correctAnswer:'Situation',
    category:'communication', difficulty:'easy',
    explanation:'S = Situation (وضعیت فعلی). I = Identify (شناسایی). B = Background. A = Assessment. R = Recommendation.',
    tags:['ISBAR'] },
  { stem:'Closed-loop communication یعنی چه؟',
    options:['قطع ارتباط','تکرار دستور توسط گیرنده برای تأیید','ارتباط بی‌صدا','ارتباط کتبی'],
    correctAnswer:'تکرار دستور توسط گیرنده برای تأیید',
    category:'communication', difficulty:'medium',
    explanation:'مثال: پزشک می‌گوید "اپی‌نفرین ۱ میلی‌گرم". پرستار تکرار می‌کند و اجرا می‌کند. کاهش خطا در محیط پر استرس.',
    tags:['closed-loop','ارتباط'] },
  { stem:'تحویل شیفت (Handover) بهتر است کجا انجام شود؟',
    options:['اتاق استراحت','نزدیک تخت بیمار','تلفنی','کتبی'],
    correctAnswer:'نزدیک تخت بیمار',
    category:'communication', difficulty:'medium',
    explanation:'تحویل بالینی با حضور بیمار یا نزدیک تخت، خطا را کاهش می‌دهد. حداقل اطلاعات حیاتی مبادله شود.',
    tags:['تحویل شیفت','handover'] },
  { stem:'Read-back در دستورات تلفنی برای چه هدفی است؟',
    options:['صرفه‌جویی وقت','تأیید صحت دستور','ثبت قانونی','جلوگیری از تماس مجدد'],
    correctAnswer:'تأیید صحت دستور',
    category:'communication', difficulty:'easy',
    explanation:'در دستور تلفنی، گیرنده دستور را تکرار می‌کند و فرستنده تأیید می‌کند. الزامی برای داروهای High-Alert.',
    tags:['read-back','دستور تلفنی'] },

  // ── بالینی (6) ──
  { stem:'NEWS2 حداقل چند امتیاز نشان‌دهنده خطر بالا است؟',
    options:['۱','۳','۵','۷'],
    correctAnswer:'۵',
    category:'clinical', difficulty:'medium',
    explanation:'NEWS2 ≥ ۵ = خطر بالا (بازبینی فوری). NEWS2 ≥ ۷ = بحرانی (پاسخ فوری).',
    tags:['NEWS2','ویتال'] },
  { stem:'NEWS2 حداقل چند امتیاز بحرانی است؟',
    options:['۳','۵','۷','۱۰'],
    correctAnswer:'۷',
    category:'clinical', difficulty:'medium',
    explanation:'NEWS2 ≥ ۷ = بحرانی. پاسخ فوری تیم احیا.',
    tags:['NEWS2','بحرانی'] },
  { stem:'محدوده طبیعی SpO2 در بزرگسال سالم چقدر است؟',
    options:['۸۵-۹۰٪','۹۰-۹۴٪','۹۵-۱۰۰٪','بالای ۱۰۰٪'],
    correctAnswer:'۹۵-۱۰۰٪',
    category:'clinical', difficulty:'easy',
    explanation:'SpO2 طبیعی ۹۵-۱۰۰٪. زیر ۹۴٪ نیاز به بررسی. زیر ۹۰٪ بحرانی.',
    tags:['SpO2','ویتال'] },
  { stem:'HR طبیعی بزرگسال در حالت استراحت چقدر است؟',
    options:['۴۰-۶۰','۶۰-۱۰۰','۱۰۰-۱۲۰','۱۲۰-۱۵۰'],
    correctAnswer:'۶۰-۱۰۰',
    category:'clinical', difficulty:'easy',
    explanation:'۶۰-۱۰۰ ضربه در دقیقه. زیر ۶۰ برادی‌کاردی، بالای ۱۰۰ تاکی‌کاردی.',
    tags:['HR','ویتال'] },
  { stem:'RR طبیعی بزرگسال چقدر است؟',
    options:['۶-۱۰','۱۲-۲۰','۲۲-۳۰','۳۰-۴۰'],
    correctAnswer:'۱۲-۲۰',
    category:'clinical', difficulty:'easy',
    explanation:'۱۲-۲۰ تنفس در دقیقه. ≥ ۲۵ = هشدار، ≥ ۳۰ = بحرانی.',
    tags:['RR','ویتال'] },
  { stem:'دمای طبیعی بدن انسان چقدر است؟',
    options:['۳۵-۳۶','۳۶-۳۷.۵','۳۸-۳۹','۳۹-۴۰'],
    correctAnswer:'۳۶-۳۷.۵',
    category:'clinical', difficulty:'easy',
    explanation:'۳۶-۳۷.۵ درجه سانتی‌گراد. بالای ۳۸ = تب. زیر ۳۶ = هایپوترمی.',
    tags:['دما','ویتال'] },

  // ── آموزش بیمار (4) ──
  { stem:'Teach-back در آموزش بیمار یعنی چه؟',
    options:['آموزش با ویدیو','بیمار با کلمات خودش توضیح می‌دهد','آموزش با کتابچه','آموزش به خانواده'],
    correctAnswer:'بیمار با کلمات خودش توضیح می‌دهد',
    category:'clinical', difficulty:'medium',
    explanation:'Teach-back روش تأیید درک بیمار است. "می‌خواهم به من بگویید چطور دارو را مصرف می‌کنید"',
    tags:['آموزش بیمار','teach-back'] },
  { stem:'آموزش بیمار با سطح سواد پایین چگونه انجام شود؟',
    options:['متن طولانی','تصویر + گفتار ساده','اصطلاحات تخصصی','به خانواده بسپارید'],
    correctAnswer:'تصویر + گفتار ساده',
    category:'clinical', difficulty:'easy',
    explanation:'استفاده از تصویر، زبان ساده، تکرار و teach-back. اجتناب از اصطلاحات تخصصی.',
    tags:['آموزش بیمار'] },
  { stem:'آموزش ترخیصی بیمار چه زمانی انجام می‌شود؟',
    options:['یک ماه بعد','قبل از ترخیص','بعد از ترخیص','لازم نیست'],
    correctAnswer:'قبل از ترخیص',
    category:'clinical', difficulty:'easy',
    explanation:'آموزش ترخیصی باید در زمان بستری و با فرصت کافی برای پرسش باشد، نه در لحظه ترخیص.',
    tags:['آموزش بیمار','ترخیص'] },
  { stem:'در آموزش به بیمار، بهترین رویکرد چیست؟',
    options:['یک بار آموزش کافی است','ساده، قابل فهم، با تکرار و بازخورد','فقط کتبی','فقط به همراه'],
    correctAnswer:'ساده، قابل فهم، با تکرار و بازخورد',
    category:'clinical', difficulty:'easy',
    explanation:'آموزش مؤثر: ساده، تکرار، teach-back، محیط آرام، حضور همراه. آموزش یک‌بار کافی نیست.',
    tags:['آموزش بیمار'] }
];

let added = 0;
for (const q of QS) { if (addQ(q)) added++; }
console.log('  ✅ ' + added + ' سوال (کل: ' + store.readAll('questions').length + ')');
console.log('');

// ═════════════════════════════════════════════════════════════════
//  2) ARTICLES
// ═════════════════════════════════════════════════════════════════
console.log('▸ ۲) مقالات آموزشی');

const ARTICLES = [
  { title:'پنج لحظه شستشوی دست WHO', category:'infection_control',
    body: 'سازمان جهانی بهداشت ۵ لحظه حیاتی برای شستشوی دست تعریف کرده:\n\n۱. قبل از تماس با بیمار\n۲. قبل از اقدام آسپتیک (مثل کاتتر، پانسمان)\n۳. بعد از تماس با مایعات بدن\n۴. بعد از تماس با بیمار\n۵. بعد از تماس با اشیای اطراف بیمار\n\nمدت: ۴۰-۶۰ ثانیه با آب و صابون، یا ۲۰-۳۰ ثانیه با الکل‌ریت. مهم‌ترین مداخله در کاهش عفونت بیمارستانی.',
    targetRoles:['all'], status:'published' },
  { title:'ISBAR — چارچوب ارتباط بالینی ایمن', category:'communication',
    body: 'ISBAR یک چارچوب ارتباطی برای انتقال ایمن اطلاعات بین اعضای تیم درمان است:\n\nI — Identify: خودت را و بیمار را معرفی کن (بخش، تخت، سن)\nS — Situation: وضعیت فعلی (چرا تماس گرفتی؟)\nB — Background: سابقه مختصر (تشخیص، بستری، داروهای مهم)\nA — Assessment: ارزیابی شما (چیزی که فکر می‌کنی)\nR — Recommendation: توصیه یا درخواست مشخص\n\nمثال: "من سارا، پرستار ICU، تخت ۳. بیمار آقای احمدی ۶۸ ساله. وضعیت: درد قفسه سینه از ۳۰ دقیقه پیش. سابقه: STEMI دو ماه قبل. ارزیابی: احتمال آنژین ناپایدار. توصیه: نیاز به ارزیابی فوری شما."',
    targetRoles:['all'], status:'published' },
  { title:'سپسیس: تشخیص زود و درمان سریع', category:'clinical',
    body: 'سپسیس پاسخ شدید بدن به عفونت است که می‌تواند به شوک و مرگ منجر شود.\n\nqSOFA (بستر):\n- RR ≥ ۲۲\n- SBP ≤ ۱۰۰\n- GCS < ۱۵\nامتیاز ≥ ۲ = مشکوک\n\nاقدامات ۳ ساعته (Sepsis-3 Bundle):\n۱. اندازه‌گیری لاکتات\n۲. کشت خون (قبل از آنتی‌بیوتیک)\n۳. آنتی‌بیوتیک وسیع‌الطیف\n۴. مایع کریستالوئید ۳۰ ml/kg\n\nهدف: MAP ≥ ۶۵ mmHg با نوراپی‌نفرین اگر نیاز. هر ساعت تأخیر آنتی‌بیوتیک = افزایش ۷٪ مرگ.',
    targetRoles:['all'], status:'published' },
  { title:'تزریق خون ایمن: چک دو نفره اجباری', category:'safety',
    body: 'تزریق خون یکی از پرخطرترین اقدامات بیمارستانی است. خطای همولیتیک می‌تواند کشنده باشد.\n\nقبل از شروع تزریق، دو نفر (اجباری):\n۱. هویت بیمار با برچسب کیسه\n۲. گروه خونی گیرنده و دهنده\n۳. شماره کیسه با فرم بانک خون\n۴. تاریخ انقضا\n۵. سالم بودن کیسه\n۶. رضایت‌نامه\n\nمهم: نفر دوم نمی‌تواند همان نفر اول باشد. هر دو امضا می‌کنند.\n\nعلائم واکنش: تب، لرز، درد کمر، ادرار تیره، افت فشار. اگر دیدید: توقف فوری، مایع، اطلاع فوری.',
    targetRoles:['all'], status:'published' },
  { title:'ایمنی دارویی: High-Alert Medications', category:'safety',
    body: 'High-Alert Medications داروهایی هستند که خطا در آن‌ها به آسیب جدی یا مرگ منجر می‌شود:\n\n- انسولین\n- هپارین و ضدانعقادها\n- مخدرها (مورفین، فنتانیل، متادون)\n- وارفارین\n- پتاسیم غلیظ (KCl)\n- شیمی‌درمانی\n- محلول‌های غلیظ سدیم\n\nاقدامات ایمنی:\n- خواندن برچسب دو بار\n- چک دو نفره در توزیع\n- محاسبه دوز کتبی\n- پایش علائم حیاتی قبل و بعد\n- ثبت دقیق در MAR',
    targetRoles:['all'], status:'published' },
  { title:'پیشگیری از سقوط: پروتکل Morse', category:'safety',
    body: 'سقوط شایع‌ترین حادثه بیمارستانی است. ابزار Morse Fall Scale:\n\nعوامل خطر:\n- سابقه سقوط قبلی (۲۵ امتیاز)\n- تشخیص ثانویه (۱۵)\n- وسیله کمکی (۱۵-۳۰)\n- سرم/هپارین‌لاک (۲۰)\n- اختلال راه‌رفتن (۱۰-۲۰)\n- اختلال شناختی (۱۵)\n\nتفسیر:\n- ۰-۲۴: کم\n- ۲۵-۴۴: متوسط\n- ≥ ۴۵: بالا\n\nاقدامات در پرخطر:\n- دستبند زرد\n- تخت پایین\n- زنگ در دسترس\n- همراهی در حرکت\n- کف اتاق خشک\n- نور کافی شب',
    targetRoles:['all'], status:'published' }
];

let aAdded = 0;
for (const a of ARTICLES) {
  if (has('learning_objects', x => x.title === a.title)) continue;
  store.put('learning_objects', {
    id: store.uid('lo'),
    title: a.title,
    type: 'article',
    category: a.category,
    body: a.body,
    targetRoles: a.targetRoles,
    status: a.status,
    createdBy: 'usr_admin',
    createdByName: 'مدیر سیستم',
    createdAt: new Date().toISOString()
  });
  aAdded++;
}
console.log('  ✅ ' + aAdded + ' مقاله (کل: ' + store.readAll('learning_objects').length + ')');
console.log('');

// ═════════════════════════════════════════════════════════════════
//  3) MICRO-CARDS — ۲۵ کارت
// ═════════════════════════════════════════════════════════════════
console.log('▸ ۳) Micro-cards');

const MICROS = [
  { title:'۲ شناسه بیمار قبل از هر مداخله', body:'قبل از هر دارو، تزریق یا پروسیجر، نام + تاریخ تولد یا کد ملی بیمار را از دستبند بخوانید و تأیید کنید. اگر دستبند نیست — ابتدا دستبند ببندید.', category:'safety' },
  { title:'۵ لحظه شستشوی دست', body:'۱. قبل از تماس با بیمار\n۲. قبل از اقدام آسپتیک\n۳. بعد از تماس با مایعات بدن\n۴. بعد از تماس با بیمار\n۵. بعد از تماس با اشیای اطراف', category:'infection_control' },
  { title:'پنج Right دارو', body:'بیمار صحیح + دارو صحیح + دوز صحیح + مسیر صحیح + زمان صحیح. اگر یکی نبود — توقف و سؤال.', category:'safety' },
  { title:'تزریق خون = چک دو نفره', body:'قبل از هر تزریق خون، دو نفر جدا هویت، گروه خونی و شماره کیسه را چک کنند. هر دو امضا. نفر دوم نمی‌تواند همان نفر اول باشد.', category:'safety' },
  { title:'High-Alert = چک اضافه', body:'انسولین، هپارین، مخدر، پتاسیم غلیظ، شیمی‌درمانی. این‌ها حتماً چک دو نفره یا پروتکل خاص دارند.', category:'safety' },
  { title:'qSOFA — ۳ پارامتر', body:'RR ≥ ۲۲ + SBP ≤ ۱۰۰ + GCS < ۱۵. حداقل ۲ = مشکوک به سپسیس. ارزیابی فوری.', category:'clinical' },
  { title:'NEWS2 — عدد را جدی بگیر', body:'NEWS2 ≥ ۵ = بازبینی فوری. NEWS2 ≥ ۷ = بحرانی — تیم احیا. هر امتیاز بالاتر، خطر بیشتر.', category:'clinical' },
  { title:'ISBAR در هر تماس بالینی', body:'I - خودت و بیمار. S - وضعیت. B - سابقه. A - ارزیابی. R - درخواست. کاهش خطا در انتقال اطلاعات.', category:'communication' },
  { title:'سقوط: ۳ اقدام سریع', body:'تخت پایین + دستبند زرد + زنگ در دسترس. اگر حرکت می‌کند — همراهی. کف خشک. نور کافی.', category:'safety' },
  { title:'تغییر وضعیت بیمار هر ۲ ساعت', body:'در بیماران بی‌حرکت (Braden پایین)، تغییر پوزیشن هر ۲ ساعت از زخم فشاری پیشگیری می‌کند.', category:'safety' },
  { title:'آنتی‌بیوتیک در ۱ ساعت', body:'در سپسیس، هر ساعت تأخیر آنتی‌بیوتیک = افزایش ۷٪ مرگ. کشت قبل، تجویز در ۱ ساعت.', category:'clinical' },
  { title:'پادزهرها — حفظ کن', body:'هپارین → پروتامین. وارفارین → ویتامین K. مخدر → نالوکسان. بنزودیازپین → فلومازنیل.', category:'safety' },
  { title:'علائم واکنش تزریق خون', body:'تب، لرز، درد کمر، ادرار تیره، افت فشار. توقف فوری + مایع + اطلاع بانک خون. کیسه را نگه دار.', category:'safety' },
  { title:'کاتتر: هر روز بازبینی', body:'هر کاتتر مرکزی روزانه از نظر نیاز، قرمزی، ترشح، حساسیت بررسی شود. بدون نیاز → خارج.', category:'infection_control' },
  { title:'N95 برای ایزولاسیون هوایی', body:'سل، سرخک، آبله = N95 یا FFP2/3. ماسک جراحی برای Droplet کافی است. قبل از ورود ماسک بزن.', category:'infection_control' },
  { title:'سر تخت ۳۰-۴۵ درجه', body:'در بیمار ونتیلاتور، بالا نگه داشتن سر تخت از VAP پیشگیری می‌کند. قطع روزانه sedation.', category:'infection_control' },
  { title:'دستور تلفنی = read-back', body:'دستور دارو تلفنی: بنویس، بلند بخوان، فرستنده تأیید کند. برای High-Alert اجباری.', category:'communication' },
  { title:'تهویه اتاق — ۶ بار در ساعت', body:'اتاق ایزولاسیون هوایی باید حداقل ۶ بار در ساعت هوای اتاق تعویض شود. فشار منفی برای سل.', category:'infection_control' },
  { title:'۲ دقیقه صبر بعد از بستن دارو', body:'بعد از بستن دارو با سوزن، ۲ دقیقه صبر کنید یا سوزن را خم کنید تا فشار داخل ویال متعادل شود.', category:'safety' },
  { title:'آموزش با teach-back', body:'بعد از آموزش، به بیمار بگو "به من بگویید چطور دارو را مصرف می‌کنید". اگر بازگو نکرد — آموزش دوباره.', category:'communication' },
  { title:'کنترل قند در بیمار دیابتی', body:'قند هدف در بیمار بستری دیابتی: ۱۴۰-۱۸۰. در ICU: ۱۴۰-۱۸۰. هر ۴ ساعت چک. انسولین اصلاحی طبق پروتکل.', category:'clinical' },
  { title:'درد = علامت حیاتی پنجم', body:'درد را با NRS (۰-۱۰) بسنج. در بیمار ناتوان، از PAINAD استفاده کن. درد کنترل نشده = عارضه.', category:'clinical' },
  { title:'ایمنی در انتقال بیمار', body:'قبل از انتقال: IV و لوله‌ها محکم، تخت قفل، بیمار آرام، اکسیژن کافی. مانیتور همراه.', category:'safety' },
  { title:'مستندسازی — ننوشتی، نکردی', body:'هر اقدام بالینی باید در زمان واقعی ثبت شود. بعد از شیفت، حافظه قابل اعتماد نیست.', category:'safety' },
  { title:'زخم فشاری — Braden پایین', body:'Braden ≤ ۱۲ = خطر بالا. تغییر وضعیت هر ۲ ساعت + سطح محافظ + ارزیابی تغذیه.', category:'safety' }
];

let mAdded = 0;
for (const m of MICROS) {
  if (has('edu_micro', x => x.title === m.title)) continue;
  store.put('edu_micro', {
    id: store.uid('mc'),
    title: m.title,
    body: m.body,
    category: m.category,
    targetRoles: ['all'],
    duration: 60,
    active: true,
    createdBy: 'usr_admin',
    createdByName: 'مدیر سیستم',
    createdAt: new Date().toISOString()
  });
  mAdded++;
}
console.log('  ✅ ' + mAdded + ' کارت (کل: ' + store.readAll('edu_micro').length + ')');
console.log('');

// ═════════════════════════════════════════════════════════════════
//  4) COHORTS
// ═════════════════════════════════════════════════════════════════
console.log('▸ ۴) کلاس‌های آموزشی');

const staff = store.readAll('sa_staff').filter(s => s.active);
const rn = staff.filter(s => ['rn','nurse','head_nurse'].includes(s.category));
const doctors = staff.filter(s => ['physician','resident','intern','attending','specialist','surgeon','anesthesiologist'].includes(s.category));

const COHORTS = [
  { name:'پرستاران', description:'تمام پرستاران، سرپرستاران و کمک‌پرستاران', staffIds: rn.map(s => s.id), targetRoles:['nurse','head_nurse'] },
  { name:'پزشکان', description:'پزشکان، رزیدنت‌ها، اینترن‌ها و متخصصین', staffIds: doctors.map(s => s.id), targetRoles:['physician','resident','intern','attending','specialist'] },
  { name:'همه پرسنل', description:'تمام کادر درمانی و اداری', staffIds: staff.map(s => s.id), targetRoles:['all'] }
];

let cAdded = 0;
for (const c of COHORTS) {
  if (!c.staffIds.length) continue;
  if (has('edu_cohorts', x => x.name === c.name)) continue;
  store.put('edu_cohorts', {
    id: store.uid('coh'),
    name: c.name,
    description: c.description,
    staffIds: c.staffIds,
    targetRoles: c.targetRoles,
    active: true,
    createdBy: 'usr_admin',
    createdByName: 'مدیر سیستم',
    createdAt: new Date().toISOString()
  });
  cAdded++;
}
console.log('  ✅ ' + cAdded + ' کلاس (کل: ' + store.readAll('edu_cohorts').length + ')');
if (rn.length) console.log('     - پرستاران: ' + rn.length + ' نفر');
if (doctors.length) console.log('     - پزشکان: ' + doctors.length + ' نفر');
console.log('     - همه: ' + staff.length + ' نفر');
console.log('');

// ═════════════════════════════════════════════════════════════════
//  5) EXAMS
// ═════════════════════════════════════════════════════════════════
console.log('▸ ۵) آزمون‌ها');

const allQ = store.readAll('questions');
const safetyQ = allQ.filter(q => q.category === 'safety');
const infectionQ = allQ.filter(q => q.category === 'infection_control');
const clinicalQ = allQ.filter(q => q.category === 'clinical');
const commQ = allQ.filter(q => q.category === 'communication');
const emergQ = allQ.filter(q => q.category === 'emergency');

const EXAMS = [
  { title:'آزمون ایمنی بیمار — مقدماتی',
    description:'ارزیابی دانش پایه در ایمنی بیمار — مناسب پرسنل تازه‌کار',
    category:'safety',
    questions: safetyQ.slice(0, 8),
    timeLimitMinutes: 15, passingScore: 70, attemptsAllowed: 3 },
  { title:'آزمون کنترل عفونت',
    description:'ارزیابی دانش کنترل عفونت و ایزولاسیون',
    category:'infection_control',
    questions: infectionQ.slice(0, 8),
    timeLimitMinutes: 15, passingScore: 70, attemptsAllowed: 2 },
  { title:'آزمون جامع پرسنل جدید',
    description:'ارزیابی جامع: ایمنی + عفونت + ارتباط + بالینی',
    category:'general',
    questions: [].concat(safetyQ.slice(0, 3), infectionQ.slice(0, 3), commQ.slice(0, 2), clinicalQ.slice(0, 4)),
    timeLimitMinutes: 20, passingScore: 65, attemptsAllowed: 2 }
];

let eAdded = 0;
for (const e of EXAMS) {
  if (!e.questions.length) continue;
  if (has('exams', x => x.title === e.title)) continue;
  const total = e.questions.reduce((s, q) => s + (q.points || 1), 0);
  store.put('exams', {
    id: store.uid('exm'),
    title: e.title,
    description: e.description,
    category: e.category,
    questions: e.questions,
    questionIds: e.questions.map(q => q.id),
    totalPoints: total,
    passingScore: e.passingScore,
    timeLimitMinutes: e.timeLimitMinutes,
    attemptsAllowed: e.attemptsAllowed,
    status: 'published',
    publishedAt: new Date().toISOString(),
    publishedBy: 'usr_admin',
    createdBy: 'usr_admin',
    createdByName: 'مدیر سیستم',
    createdAt: new Date().toISOString()
  });
  eAdded++;
}
console.log('  ✅ ' + eAdded + ' آزمون منتشرشده (کل: ' + store.readAll('exams').length + ')');
console.log('');

// ═════════════════════════════════════════════════════════════════
//  SUMMARY
// ═════════════════════════════════════════════════════════════════
console.log('════════════════════════════════════════════════════════════════');
console.log('  ✅ Seed کامل شد');
console.log('════════════════════════════════════════════════════════════════');
console.log('');

const stats = {
  questions: store.readAll('questions').length,
  articles: store.readAll('learning_objects').length,
  microCards: store.readAll('edu_micro').length,
  cohorts: store.readAll('edu_cohorts').length,
  exams: store.readAll('exams').filter(e => e.status === 'published').length
};

console.log('  📊 مجموع محتوا:');
console.log('     ❓ سوالات: ' + stats.questions);
console.log('     📖 مقالات: ' + stats.articles);
console.log('     💡 Micro-cards: ' + stats.microCards);
console.log('     👥 کلاس‌ها: ' + stats.cohorts);
console.log('     📝 آزمون‌های منتشرشده: ' + stats.exams);
console.log('');
console.log('  🎯 مرحله بعد:');
console.log('     1. سرور را restart کنید:');
console.log('        pkill -9 -f "core/server.js"; sleep 1; node core/server.js');
console.log('     2. مرورگر: F12 → Application → Clear site data → Ctrl+Shift+R × ۲');
console.log('     3. منو ☰ → 🎓 استودیوی آموزش');
console.log('     4. تب‌ها را ببینید:');
console.log('        - 📝 آزمون‌ها: ۳ آزمون منتشرشده');
console.log('        - ❓ بانک سوال: ۵۶ سوال');
console.log('        - 👥 کلاس‌ها: ۳ کلاس با اعضا');
console.log('        - 💡 Microlearning: ۲۵ کارت');
console.log('');
console.log('  📤 تخصیص آزمون (اختیاری):');
console.log('     - آزمون ایمنی بیمار را باز کنید → تب تخصیص → کلاس «پرستاران» → 📤');
console.log('     - سپس پرسنل در login بعدی آزمون را می‌بینند');
console.log('');
