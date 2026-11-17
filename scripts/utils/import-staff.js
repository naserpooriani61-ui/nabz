'use strict';
const fs = require('fs');
const path = require('path');

const C = { r:'\x1b[0m', b:'\x1b[1m', d:'\x1b[2m', red:'\x1b[31m', g:'\x1b[32m', y:'\x1b[33m', c:'\x1b[36m' };
function hdr(t) {
  console.log('');
  console.log(C.c + '════════════════════════════════════════════════════════════════' + C.r);
  console.log(C.c + '  ' + C.b + t + C.r);
  console.log(C.c + '════════════════════════════════════════════════════════════════' + C.r);
}
function sub(t) { console.log('\n' + C.c + '▸ ' + C.b + t + C.r); }
function log(msg) { console.log('  ' + msg); }
function ok(msg) { console.log('  ' + C.g + '✓' + C.r + ' ' + msg); }
function warn(msg) { console.log('  ' + C.y + '!' + C.r + ' ' + msg); }
function err(msg) { console.log('  ' + C.red + '✗' + C.r + ' ' + msg); }

const POS_MAP = { M:'matron', S:'supervisor', H:'head_nurse', R:'rn', U:'support', B:'beh_yar', A:'assistant', N:'anesthesia', O:'or_tech', X:'or_specialist', W:'midwife', E:'ecg', C:'secretary', P:'patient_care', Z:'wound_specialist' };
const EMP_MAP = { '1':'رسمی', '2':'رسمی آزمایشی', '3':'قراردادی', '4':'شرکتی', '5':'پیمانی', '6':'طرحی', '7':'تمدید طرح' };

// درخت همه مسیرهای ممکن
const SEARCH_PATHS = [
  'dastyar_v19_fixed.html',
  'public/dastyar_v19_fixed.html',
  path.join(process.env.HOME || '', 'dastyar_v19_fixed.html'),
  '/sdcard/Download/dastyar_v19_fixed.html',
  '/sdcard/dastyar_v19_fixed.html',
  '/storage/emulated/0/Download/dastyar_v19_fixed.html'
];

function findDastyar() {
  for (const p of SEARCH_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function extractRealData(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const startMarker = 'const REAL_DATA = [';
  const startIdx = src.indexOf(startMarker);
  if (startIdx === -1) throw new Error('REAL_DATA start not found');
  const arrayStart = startIdx + startMarker.length - 1;
  // پیدا کردن بسته‌شدن آرایه — از انتها
  const endMarker = '\n];';
  const endIdx = src.indexOf(endMarker, arrayStart);
  if (endIdx === -1) throw new Error('REAL_DATA end not found');
  const arrText = src.slice(arrayStart, endIdx + 3);
  return new Function('return ' + arrText)();
}

async function main() {
  hdr('واردسازی کامل پرسنل سینا');

  // ── ۱) پیدا کردن فایل
  sub('۱) جستجوی dastyar_v19_fixed.html');
  const filePath = findDastyar();
  if (!filePath) {
    err('فایل در هیچ‌کدام از این مسیرها نیست:');
    for (const p of SEARCH_PATHS) console.log('      ' + C.d + p + C.r);
    console.log('');
    warn('اگر مایل بودید، فایل را در یکی از این مسیرها بگذارید و دوباره اجرا کنید.');
    warn('در غیر این صورت، همان ۹۱ پرسنل فعلی باقی می‌مانند.');
    return;
  }
  ok('یافت شد: ' + filePath);

  // ── ۲) استخراج
  sub('۲) استخراج REAL_DATA');
  let REAL_DATA;
  try {
    REAL_DATA = extractRealData(filePath);
    ok('استخراج موفق: ' + REAL_DATA.length + ' بخش');
  } catch (e) {
    err('استخراج شکست: ' + e.message);
    return;
  }

  // شمارش پرسنل واقعی
  let totalRealStaff = 0;
  for (const [, , , , staffList] of REAL_DATA) {
    totalRealStaff += staffList.length;
  }
  ok('کل پرسنل در فایل: ' + totalRealStaff);

  // ── ۳) خواندن store و داده فعلی
  sub('۳) داده فعلی');
  const store = require('./core/store');
  const existingWards = store.readAll('sa_wards');
  const existingStaff = store.readAll('sa_staff');

  ok('بخش‌های فعلی: ' + existingWards.length);
  ok('پرسنل فعلی: ' + existingStaff.length);

  // پیدا کردن max ID
  let maxStaffId = 0;
  for (const s of existingStaff) if (s.id > maxStaffId) maxStaffId = s.id;
  ok('بیشترین ID فعلی: ' + maxStaffId);

  // map کد→رکورد فعلی
  const byCode = {};
  for (const s of existingStaff) byCode[s.code] = s;

  // map کد بخش→ID بخش فعلی
  const wardByCode = {};
  for (const w of existingWards) wardByCode[w.code] = w;

  // ── ۴) واردسازی
  sub('۴) واردسازی پرسنل جدید');
  let added = 0, skipped = 0, errCount = 0;
  const newIds = [];

  for (const [wardCode, wardLabel, diff, wk, staffList] of REAL_DATA) {
    const ward = wardByCode[wardCode];
    if (!ward) {
      warn('بخش ناشناخته: ' + wardCode + ' — skip');
      continue;
    }

    for (let i = 0; i < staffList.length; i++) {
      const [pCode, pName, posCode, empCode] = staffList[i];
      if (!pName) continue;

      // کد یکتا
      let code = (pCode && String(pCode).trim()) || (wardCode + '-' + (i + 1));
      code = String(code).trim();

      // اگر کد قبلاً هست → skip
      if (byCode[code]) { skipped++; continue; }

      try {
        const cat = POS_MAP[posCode] || 'rn';
        const emp = EMP_MAP[empCode] || 'قراردادی';
        const newId = ++maxStaffId;

        const rec = {
          id: newId,
          code: code,
          name: String(pName).trim(),
          wardId: ward.id,
          category: cat,
          employment: emp,
          seniorityYears: 3 + (newId * 7 % 15),
          targetHours: 168,
          maxOvertime: 40,
          nightEligible: true,
          active: true,
          phone: '',
          nationalId: '',
          headOfWard: null,
          createdAt: new Date().toISOString()
        };

        // سرپرستار: بروزرسانی بخش
        if (cat === 'head_nurse') {
          rec.headOfWard = ward.id;
          // فقط اگر بخش سرپرستار ندارد
          if (!ward.headStaffId) {
            ward.headStaffId = newId;
            store.put('sa_wards', ward);
          }
        }

        store.put('sa_staff', rec);
        byCode[code] = rec;
        newIds.push({ id: newId, name: rec.name, ward: wardLabel, cat });
        added++;
      } catch (e) {
        errCount++;
        if (errCount <= 3) err('خطا در ' + pName + ': ' + e.message);
      }
    }
  }

  ok('اضافه‌شده: ' + added);
  ok('تکراری (skip): ' + skipped);
  if (errCount) warn('خطا: ' + errCount);

  // ── ۵) خلاصه نهایی
  sub('۵) خلاصه');
  const finalStaff = store.readAll('sa_staff');
  ok('کل پرسنل الان: ' + finalStaff.length);

  // گروه‌بندی بر اساس سمت
  const byCat = {};
  for (const s of finalStaff) byCat[s.category] = (byCat[s.category] || 0) + 1;
  const CAT_FA = { matron:'مترون', supervisor:'سوپروایزر', clinical_supervisor:'سوپروایزر بالینی', head_nurse:'سرپرستار', rn:'پرستار', support:'کمک‌پرستار', beh_yar:'بهیار', anesthesia:'هوشبری', or_tech:'اتاق عمل', or_specialist:'کارشناس اتاق عمل', midwife:'ماما', ecg:'نوارنگار', secretary:'منشی', patient_care:'بیماریار', wound_specialist:'کارشناس زخم', assistant:'کمک‌بهیار' };

  console.log('');
  console.log('  ' + C.b + 'بر اساس سمت:' + C.r);
  const sortedCats = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
  for (const cat of sortedCats) {
    console.log('    ' + (CAT_FA[cat] || cat).padEnd(20) + C.c + byCat[cat] + C.r);
  }

  // گروه‌بندی بر اساس بخش
  const byWard = {};
  for (const s of finalStaff) byWard[s.wardId] = (byWard[s.wardId] || 0) + 1;
  const wardMap = {};
  for (const w of existingWards) wardMap[w.id] = w;

  console.log('');
  console.log('  ' + C.b + 'بزرگ‌ترین بخش‌ها:' + C.r);
  const sortedWards = Object.keys(byWard).sort((a, b) => byWard[b] - byWard[a]).slice(0, 10);
  for (const wid of sortedWards) {
    const w = wardMap[wid];
    if (!w) continue;
    console.log('    ' + w.label.padEnd(25) + C.c + byWard[wid] + ' پرسنل' + C.r);
  }

  // ── ۶) پیشنهاد بعدی
  console.log('');
  hdr('✅ واردسازی کامل شد');

  console.log('');
  console.log('  ' + C.b + 'گام بعد:' + C.r);
  console.log('  ' + C.b + '1.' + C.r + ' سرور را restart کنید:');
  console.log('     ' + C.d + 'pkill -9 -f "core/server.js"; sleep 1; node core/server.js' + C.r);
  console.log('  ' + C.b + '2.' + C.r + ' برنامه را دوباره تولید کنید (بخش‌های بزرگ حالا پرسنل بیشتری دارند):');
  console.log('     ' + C.d + 'node ~/nabz/populate.js' + C.r);
  console.log('  ' + C.b + '3.' + C.r + ' در مرورگر: Hard Reload × ۲ → admin/nabz@2026 → دستیار شیفت');
  console.log('');

  // ذخیره لیست staff جدید برای مراجعه
  if (newIds.length) {
    const reportPath = path.join(process.env.HOME || '', 'nabz-new-staff.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      importedAt: new Date().toISOString(),
      count: newIds.length,
      staff: newIds
    }, null, 2));
    console.log('  ' + C.d + '📄 لیست staff جدید: ' + reportPath + C.r);
  }
  console.log('');
}

main().catch(e => {
  console.error(C.red + 'FATAL: ' + e.message + C.r);
  console.error(e.stack);
  process.exit(1);
});
