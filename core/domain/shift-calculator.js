'use strict';
// منطق کامل محاسبات شیفت از شیفت‌یار
const SH = {
  off: { c: 'O', f: '—', n: 'استراحت', cls: 's-off', w: 0, t: null, cov: '' },
  morning: { c: 'M', f: 'ص', n: 'صبح', cls: 's-m', w: 1, t: [7, 14], cov: 'M', tm: '۰۷:۰۰–۱۴:۰۰' },
  evening: { c: 'E', f: 'ع', n: 'عصر', cls: 's-e', w: 1, t: [13, 20], cov: 'E', tm: '۱۳:۰۰–۲۰:۰۰' },
  night: { c: 'N', f: 'ش', n: 'شب', cls: 's-n', w: 1, t: [19, 32], cov: 'N', night: 1, tm: '۱۹:۰۰–۰۸:۰۰' },
  long: { c: 'L', f: 'ل', n: 'لانگ (صبح+عصر)', cls: 's-l', w: 1, t: [7, 19], cov: 'ME', tm: '۰۷:۰۰–۱۹:۰۰' },
  'evening-night': { c: 'EN', f: 'عش', n: 'عصر+شب', cls: 's-en', w: 1, t: [13, 32], cov: 'EN', night: 1, tm: '۱۳:۰۰–۰۸:۰۰' },
  'full-day': { c: 'FD', f: '۲۴', n: '۲۴ ساعته', cls: 's-fd', w: 1, t: [7, 31], cov: 'MEN', night: 1, tm: '۰۷:۰۰–۰۷:۰۰' },
  holiday: { c: 'H', f: 'م', n: 'مرخصی', cls: 's-h', w: 0, t: null, cov: '', leave: 1 },
  sick: { c: 'S', f: 'است', n: 'استعلاجی', cls: 's-s', w: 0, t: null, cov: '', leave: 1 }
};

const DEFAULT_CALC = {
  morningRegularNoProd: 7, morningRegularProd: 7, morningHolidayProd: 10.5,
  eveningRegularNoProd: 7, eveningRegularProd: 7, eveningHolidayProd: 10.5,
  nightRegularNoProd: 13, nightRegularProd: 19.5, nightHolidayProd: 19.5,
  longRegularNoProd: 13, longRegularProd: 13, longHolidayProd: 19.5,
  'evening-nightRegularNoProd': 19, 'evening-nightRegularProd': 25.5, 'evening-nightHolidayProd': 28.5,
  'full-dayRegularNoProd': 24, 'full-dayRegularProd': 32.5, 'full-dayHolidayProd': 36,
  holidayAllDay: 7, sickAllDay: 7
};

function expCoef(years, months) {
  const t = (years || 0) + (months || 0) / 12;
  if (t < 4) return 0.5; if (t < 8) return 1; if (t < 12) return 1.5; if (t < 16) return 2; return 2.5;
}

function diffCoef(percent) {
  if (percent >= 8 && percent <= 25) return 0.5;
  if (percent > 25 && percent <= 50) return 1;
  if (percent > 50 && percent <= 75) return 1.5;
  if (percent > 75 && percent <= 100) return 2;
  return 0;
}

function calcMandatoryHours(staff, unit = 4) {
  const ec = expCoef(staff.years || 0, staff.months || 0);
  const dc = diffCoef(staff.diffPercent || 30);
  const eh = ec * unit, dh = dc * unit;
  const red = eh + dh + (staff.hourReduction || 0);
  const weekly = Math.abs((staff.baseWeekly || 44) - red);
  const monthly = Math.abs(weekly * (staff.monthlyMult || 4.33));
  const fin = Math.abs(monthly - (staff.vacationHours || 0));
  return {
    expC: ec, diffC: dc, expH: eh, diffH: dh, red,
    weekly: Math.round(weekly * 100) / 100,
    monthly: Math.round(monthly * 100) / 100,
    mandatory: Math.round(fin * 100) / 100
  };
}

function shiftHours(type, isHoliday, noProd, calc = DEFAULT_CALC) {
  const def = SH[type];
  if (!def) return { h: 0, b: 0 };
  const b = def.t ? (def.t[1] - def.t[0]) : 0;
  let h = 0;
  switch (type) {
    case 'morning': h = isHoliday ? calc.morningHolidayProd : calc.morningRegularProd; break;
    case 'evening': h = isHoliday ? calc.eveningHolidayProd : calc.eveningRegularProd; break;
    case 'night': h = isHoliday ? calc.nightHolidayProd : calc.nightRegularProd; break;
    case 'long': h = isHoliday ? calc.longHolidayProd : calc.longRegularProd; break;
    case 'evening-night': h = isHoliday ? calc['evening-nightHolidayProd'] : calc['evening-nightRegularProd']; break;
    case 'full-day': h = isHoliday ? calc['full-dayHolidayProd'] : calc['full-dayRegularProd']; break;
    case 'holiday': h = calc.holidayAllDay; break;
    case 'sick': h = calc.sickAllDay; break;
  }
  if (noProd) h = b;
  return { h, b };
}

function isWork(type) { return SH[type] && SH[type].w === 1; }
function isNight(type) { return SH[type] && SH[type].night === 1; }
function covers(type, slot) { return SH[type] && SH[type].cov.indexOf(slot) !== -1; }

module.exports = { SH, DEFAULT_CALC, expCoef, diffCoef, calcMandatoryHours, shiftHours, isWork, isNight, covers };
