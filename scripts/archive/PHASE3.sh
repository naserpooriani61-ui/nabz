#!/data/data/com.termux/files/usr/bin/bash
set -e
[ ! -f core/server.js ] && { echo "❌ از ریشهٔ پروژه"; exit 1; }

echo "🎯 Phase 3 — تقویم دقیق + PDF"
echo ""

# ═══════════════════════════════════════════════════════════
#  Backup
# ═══════════════════════════════════════════════════════════
cp public/sa.js public/sa.js.before-phase3 2>/dev/null || true
cp public/style.css public/style.css.before-phase3 2>/dev/null || true
echo "📦 backup ساخته شد"
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 1 — تقویم جلالی دقیق (جایگزینی دو تابع)
# ═══════════════════════════════════════════════════════════
echo "═══ ۱) تقویم جلالی دقیق ═══"
node << 'EOF_JALALI'
const fs = require('fs');
const F = 'public/sa.js';
let src = fs.readFileSync(F, 'utf8');

// ── محافظ: مطمئن شو patch قبلی اعمال نشده
if (src.includes('_jalCal') && src.includes('_d2j')) {
  console.log('ℹ️  تقویم دقیق از قبل هست');
  process.exit(0);
}

// ── الگوریتم دقیق Birashk (کپی از سرور — تست‌شده)
const exactJalali = `
    // ═══ الگوریتم دقیق جلالی (Birashk) — کپی از سرور ═══
    _div(a, b) { return Math.trunc(a / b); },
    _mod(a, b) { return a - Math.trunc(a / b) * b; },
    _jalCal(jy) {
      var b = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
      var gy = jy + 621;
      var lJ = -14, jp = b[0], jm, jump = 0, n, i;
      for (i = 1; i < b.length; i++) {
        jm = b[i]; jump = jm - jp;
        if (jy < jm) break;
        lJ += Math.trunc(jump / 33) * 8 + Math.trunc((jump % 33) / 4);
        jp = jm;
      }
      n = jy - jp;
      lJ += Math.trunc(n / 33) * 8 + Math.trunc(((n % 33) + 3) / 4);
      if ((jump % 33) === 4 && (jump - n) === 4) lJ += 1;
      var lG = Math.trunc(gy / 4) - Math.trunc(((Math.trunc(gy / 100) + 1) * 3) / 4) - 150;
      var march = 20 + lJ - lG;
      if ((jump - n) < 6) n = n - jump + Math.trunc((jump + 4) / 33) * 33;
      var leap = ((n + 1) % 33 - 1) % 4;
      if (leap === -1) leap = 4;
      return { leap: leap, gy: gy, march: march };
    },
    _g2d(gy, gm, gd) {
      var d = Math.trunc((gy + Math.trunc((gm - 8) / 6) + 100100) * 1461 / 4)
            + Math.trunc((153 * ((gm + 9) % 12) + 2) / 5) + gd - 34840408;
      return d - Math.trunc(Math.trunc((gy + 100100 + Math.trunc((gm - 8) / 6)) / 100) * 3 / 4) + 752;
    },
    _d2g(jdn) {
      var j = 4 * jdn + 139361631;
      j = j + Math.trunc(Math.trunc((4 * jdn + 183187720) / 146097) * 3 / 4) * 4 - 3908;
      var i = Math.trunc((j % 1461) / 4) * 5 + 308;
      return {
        gy: Math.trunc(j / 1461) - 100100 + Math.trunc((8 - Math.trunc((i % 153) / 12)) / 6),
        gm: ((Math.trunc(i / 153) % 12)) + 1,
        gd: Math.trunc((i % 153) / 5) + 1
      };
    },
    _j2d(jy, jm, jd) {
      var r = this._jalCal(jy);
      return this._g2d(r.gy, 3, r.march) + (jm - 1) * 31 - Math.trunc(jm / 7) * (jm - 7) + jd - 1;
    },
    _d2j(jdn) {
      var gy = this._d2g(jdn).gy;
      var jy = gy - 621;
      var r = this._jalCal(jy);
      var jdn1f = this._g2d(gy, 3, r.march);
      var k = jdn - jdn1f;
      if (k >= 0) {
        if (k <= 185) return { jy: jy, jm: 1 + Math.trunc(k / 31), jd: (k % 31) + 1 };
        k -= 186;
      } else {
        jy -= 1; k += 179;
        if (r.leap === 1) k += 1;
      }
      return { jy: jy, jm: 7 + Math.trunc(k / 30), jd: (k % 30) + 1 };
    },
    _jalaliMonthLength(jy, jm) {
      if (jm <= 6) return 31;
      if (jm <= 11) return 30;
      return this._jalCal(jy).leap === 0 ? 30 : 29;
    },
    _todayJ() {
      var n = new Date();
      var g = this._g2d(n.getFullYear(), n.getMonth() + 1, n.getDate());
      var j = this._d2j(g);
      return j.jy + '/' + this._pad(j.jm) + '/' + this._pad(j.jd);
    },
    _monthDays(jy, jm) {
      var ml = this._jalaliMonthLength(jy, jm);
      var days = [];
      for (var d = 1; d <= ml; d++) {
        var jdn = this._j2d(jy, jm, d);
        var wd = ((jdn + 2) % 7 + 7) % 7;
        days.push({ jd: d, date: jy + '/' + this._pad(jm) + '/' + this._pad(d), wd: wd, isFri: wd === 6 });
      }
      return days;
    },`;

// ── حذف نسخه قدیم `_todayJ` و `_monthDays`
// نسخه قدیم با "const n = new Date()" شروع می‌شود
let oldTodayRegex = /_todayJ\(\)\s*\{[\s\S]*?\n    \},\s*\n\s*_monthDays\(jy, jm\)\s*\{[\s\S]*?\n    \}/;
if (!oldTodayRegex.test(src)) {
  // الگوی دیگر — نسخه‌ای که با var/let متفاوت شروع می‌شود
  oldTodayRegex = /_todayJ\(\)\s*\{[\s\S]*?return[^}]+;\s*\},?\s*\n\s*_monthDays\(jy, jm\)\s*\{[\s\S]*?return days;\s*\}/;
}
if (!oldTodayRegex.test(src)) {
  console.error('❌ الگوی توابع قدیم پیدا نشد');
  console.error('شاید نام متفاوت باشد. دستی بررسی کنید:');
  const m = src.match(/_todayJ[\s\S]{0,200}/);
  if (m) console.error(m[0].slice(0, 200));
  process.exit(1);
}

src = src.replace(oldTodayRegex, exactJalali.trim().slice(0, -1)); // برش آخرین کاما
fs.writeFileSync(F, src);
console.log('✅ تقویم جلالی دقیق نصب شد');
EOF_JALALI

# syntax check
if node -e "new Function(require('fs').readFileSync('public/sa.js','utf8'))" 2>/dev/null; then
  echo "✅ sa.js syntax OK"
else
  echo "❌ sa.js syntax error — بازگردانی"
  cp public/sa.js.before-phase3 public/sa.js
  node -e "new Function(require('fs').readFileSync('public/sa.js','utf8'))" 2>&1 | head -3
  exit 1
fi
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 2 — افزودن متدهای PDF به sa.js
# ═══════════════════════════════════════════════════════════
echo "═══ ۲) متدهای PDF ═══"
node << 'EOF_PDF'
const fs = require('fs');
const F = 'public/sa.js';
let src = fs.readFileSync(F, 'utf8');

if (src.includes('printWardSchedule')) {
  console.log('ℹ️  از قبل هست');
  process.exit(0);
}

const pdfCode = `
    // ═══════════════════════════════════════════════════════════
    //  PDF — برنامه ماهانه بخش
    // ═══════════════════════════════════════════════════════════
    async printWardSchedule(wardId, periodId) {
      try {
        NABZ._toast('در حال آماده‌سازی...');
        var ward = ((this._cache.wards || {}).items || []).find(function(w){ return w.id === wardId; });
        if (!ward) throw new Error('ward_not_found');
        var assigns = await this._api('/api/sa/assignments?wardId=' + wardId + '&periodId=' + periodId);
        var staff = await this._api('/api/sa/staff?wardId=' + wardId + '&limit=500');
        var period = await this._api('/api/sa/period/' + periodId).catch(function(){ return null; });
        if (!period) period = await this._getPeriod();
        if (!period) throw new Error('period_not_found');

        var staffMap = {};
        for (var i = 0; i < (staff.items || []).length; i++) {
          staffMap[staff.items[i].id] = staff.items[i];
        }

        var days = this._monthDays(period.jy, period.jm);
        var grid = {};
        for (var j = 0; j < (assigns.items || []).length; j++) {
          var a = assigns.items[j];
          var k = a.date + '|' + a.shift;
          if (!grid[k]) grid[k] = [];
          var s = staffMap[a.staffId];
          if (s) grid[k].push({ name: s.name, category: s.category });
        }
        for (var key in grid) {
          grid[key].sort(function(x, y) { return (x.category === 'rn' ? 0 : 1) - (y.category === 'rn' ? 0 : 1) || x.name.localeCompare(y.name); });
        }

        var MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
        var WDAYS = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
        var SH = { M:'صبح', E:'عصر', N:'شب', L:'لانگ', EN:'عصر+شب', H24:'۲۴ساعته' };

        var html = '<!DOCTYPE html>\\n<html lang="fa" dir="rtl"><head><meta charset="UTF-8">';
        html += '<title>برنامه ' + ward.label + ' — ' + MONTHS[period.jm-1] + ' ' + period.jy + '</title>';
        html += '<style>';
        html += '@page{size:A4 landscape;margin:8mm}';
        html += 'body{font-family:"Vazirmatn",Tahoma,sans-serif;font-size:9.5px;color:#000;background:#fff;padding:0;margin:0}';
        html += '.hdr{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0891b2;padding-bottom:6px;margin-bottom:8px}';
        html += '.hdr h1{font-size:15px;margin:0;color:#0c4a6e}';
        html += '.hdr .meta{font-size:9px;color:#666;text-align:left}';
        html += 'table{width:100%;border-collapse:collapse;font-size:8.5px}';
        html += 'th{background:#e0f2fe;color:#0c4a6e;padding:4px 3px;border:1px solid #94a3b8;font-weight:900;text-align:center;font-size:8.5px}';
        html += 'td{border:1px solid #cbd5e1;padding:3px 2px;vertical-align:top;text-align:center}';
        html += '.date-cell{background:#f8fafc;font-weight:900;font-size:9.5px;min-width:32px}';
        html += '.wd-cell{background:#f8fafc;font-size:7.5px;color:#64748b;min-width:26px}';
        html += '.shift-cell{min-height:38px}';
        html += '.rn{color:#0369a1;font-weight:700}';
        html += '.sup{color:#7c3aed;font-weight:600}';
        html += '.cell-empty{color:#cbd5e1;font-style:italic}';
        html += '.fri td{background:#fef2f2}';
        html += '.fri .date-cell{background:#fee2e2;color:#991b1b}';
        html += '.footer{margin-top:8px;padding-top:4px;border-top:1px solid #cbd5e1;font-size:7.5px;color:#94a3b8;display:flex;justify-content:space-between}';
        html += '.legend{margin-bottom:6px;font-size:8px;color:#475569}';
        html += '.legend span{margin-left:12px}';
        html += '.legend .chip{display:inline-block;padding:1px 6px;border-radius:3px;margin-left:3px}';
        html += '.sig{margin-top:16px;display:flex;justify-content:space-around}';
        html += '.sig-box{flex:1;text-align:center;font-size:8.5px;padding:0 10px}';
        html += '.sig-line{margin-top:24px;border-top:1px solid #64748b;padding-top:4px;font-size:7.5px;color:#64748b}';
        html += '</style></head><body>';
        html += '<div class="hdr">';
        html += '<div><h1>🫀 بیمارستان سینا — برنامه شیفت ' + ward.label + '</h1>';
        html += '<div style="font-size:9px;color:#666;margin-top:2px">' + MONTHS[period.jm-1] + ' ' + period.jy + ' · ' + (ward.headNurse || '—') + ' · ' + (staff.items || []).length + ' پرسنل</div></div>';
        html += '<div class="meta"><div>' + new Date().toLocaleDateString('fa-IR') + '</div><div style="font-family:monospace">NABZ-SA-' + ward.code + '-' + periodId + '</div></div>';
        html += '</div>';

        html += '<div class="legend">';
        html += '<span><span class="chip" style="background:#dbeafe;color:#1e40af">M</span>صبح ۷-۱۴</span>';
        html += '<span><span class="chip" style="background:#fef3c7;color:#92400e">E</span>عصر ۱۳-۲۰</span>';
        html += '<span><span class="chip" style="background:#1e293b;color:#fff">N</span>شب ۱۹-۸</span>';
        html += '<span><span class="chip" style="background:#dcfce7;color:#166534">L</span>لانگ</span>';
        html += '<span>·</span><span class="rn">آبی=پرستار</span><span class="sup">بنفش=کمک</span>';
        html += '</div>';

        html += '<table><thead><tr><th>تاریخ</th><th>روز</th><th>🌅 صبح</th><th>🌆 عصر</th><th>🌙 شب</th></tr></thead><tbody>';
        for (var d = 0; d < days.length; d++) {
          var dd = days[d];
          html += '<tr' + (dd.isFri ? ' class="fri"' : '') + '>';
          html += '<td class="date-cell">' + dd.jd + '</td>';
          html += '<td class="wd-cell">' + WDAYS[dd.wd] + '</td>';
          var shifts = ['M', 'E', 'N'];
          for (var si = 0; si < shifts.length; si++) {
            var sh = shifts[si];
            var names = grid[dd.date + '|' + sh] || [];
            html += '<td class="shift-cell">';
            if (names.length === 0) html += '<span class="cell-empty">—</span>';
            else {
              for (var ni = 0; ni < names.length; ni++) {
                var cls = (names[ni].category === 'rn' || names[ni].category === 'anesthesia' || names[ni].category === 'midwife' || names[ni].category === 'or_tech' || names[ni].category === 'or_specialist' || names[ni].category === 'wound_specialist' || names[ni].category === 'ecg') ? 'rn' : 'sup';
                html += '<div class="' + cls + '">' + names[ni].name + '</div>';
              }
            }
            html += '</td>';
          }
          html += '</tr>';
        }
        html += '</tbody></table>';

        html += '<div class="sig">';
        html += '<div class="sig-box"><div class="sig-line">سرپرستار بخش — ' + (ward.headNurse || '') + '</div></div>';
        html += '<div class="sig-box"><div class="sig-line">مترون / مدیر پرستاری</div></div>';
        html += '<div class="sig-box"><div class="sig-line">تاریخ تأیید</div></div>';
        html += '</div>';

        html += '<div class="footer"><span>NABZ v1.0 — Neural Hospital OS</span><span>' + new Date().toISOString() + '</span></div>';
        html += '</body></html>';

        var w = window.open('', '_blank');
        if (!w) {
          alert('پاپ‌آپ مسدود است — لطفاً اجازه دهید یا از دکمهٔ چاپ مرورگر استفاده کنید');
          return;
        }
        w.document.open();
        w.document.write(html);
        w.document.close();
        setTimeout(function() {
          try { w.focus(); w.print(); } catch (e) { alert('لطفاً Ctrl+P بزنید'); }
        }, 500);
        NABZ._toast('✅ برنامه آماده شد');
      } catch (e) {
        console.error('[sa] printWardSchedule:', e);
        alert('خطا: ' + e.message);
      }
    },

    // ═══════════════════════════════════════════════════════════
    //  PDF — برنامه شخصی پرسنل
    // ═══════════════════════════════════════════════════════════
    async printStaffSchedule() {
      try {
        var user = NABZ.state.user;
        if (!user || user.role !== 'shift_staff') { alert('فقط برای پرسنل'); return; }
        NABZ._toast('در حال آماده‌سازی...');
        var period = await this._getPeriod();
        if (!period) throw new Error('period_not_found');
        var assigns = await this._api('/api/sa/assignments?staffId=' + user.staffId + '&periodId=' + period.id);
        var staff = await this._api('/api/sa/staff/' + user.staffId).catch(function() { return null; });

        var MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
        var WDAYS = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
        var SH = { M:'صبح', E:'عصر', N:'شب', L:'لانگ', EN:'عصر+شب', H24:'۲۴ساعته' };
        var days = this._monthDays(period.jy, period.jm);
        var byDate = {};
        for (var i = 0; i < (assigns.items || []).length; i++) {
          byDate[assigns.items[i].date] = assigns.items[i];
        }

        var totalMin = 0, nights = 0, shifts = 0;
        for (var j = 0; j < (assigns.items || []).length; j++) {
          var a = assigns.items[j];
          totalMin += a.actualMinutes || 0;
          if (a.shift === 'N' || a.shift === 'EN') nights++;
          shifts++;
        }

        var html = '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">';
        html += '<title>برنامه ' + user.fullName + ' — ' + MONTHS[period.jm-1] + ' ' + period.jy + '</title>';
        html += '<style>';
        html += '@page{size:A4;margin:12mm}';
        html += 'body{font-family:"Vazirmatn",Tahoma,sans-serif;font-size:10px;color:#000;background:#fff;padding:0;margin:0}';
        html += '.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #0891b2;padding-bottom:8px;margin-bottom:12px}';
        html += '.hdr h1{font-size:16px;margin:0;color:#0c4a6e}';
        html += '.meta{font-size:9px;color:#666;margin-top:2px}';
        html += '.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}';
        html += '.stat{background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:8px;text-align:center}';
        html += '.stat .v{font-size:20px;font-weight:900;color:#0c4a6e}';
        html += '.stat .l{font-size:8.5px;color:#0891b2;font-weight:700}';
        html += 'table{width:100%;border-collapse:collapse;font-size:10px}';
        html += 'th{background:#e0f2fe;color:#0c4a6e;padding:5px;border:1px solid #94a3b8;font-weight:900;text-align:center}';
        html += 'td{border:1px solid #cbd5e1;padding:4px 6px;text-align:center}';
        html += '.d-cell{font-weight:900;background:#f8fafc}';
        html += '.fri td{background:#fef2f2}';
        html += '.fri .d-cell{background:#fee2e2}';
        html += '.empty{color:#cbd5e1}';
        html += '.footer{margin-top:14px;padding-top:6px;border-top:1px solid #e2e8f0;font-size:8px;color:#94a3b8;text-align:center;font-family:monospace}';
        html += '</style></head><body>';
        html += '<div class="hdr">';
        html += '<div><h1>🫀 کارت شیفت شخصی</h1>';
        html += '<div class="meta">' + user.fullName + ' · ' + (staff ? staff.code : '') + ' · ' + (staff ? staff.category : '') + '</div></div>';
        html += '<div style="text-align:left;font-size:9px;color:#666"><div>' + MONTHS[period.jm-1] + ' ' + period.jy + '</div><div>' + new Date().toLocaleDateString('fa-IR') + '</div></div>';
        html += '</div>';

        html += '<div class="stats">';
        html += '<div class="stat"><div class="v">' + shifts + '</div><div class="l">تعداد شیفت</div></div>';
        html += '<div class="stat"><div class="v">' + Math.round(totalMin / 60) + '</div><div class="l">ساعت کارکرد</div></div>';
        html += '<div class="stat"><div class="v">' + nights + '</div><div class="l">شب</div></div>';
        html += '</div>';

        html += '<table><thead><tr><th>تاریخ</th><th>روز</th><th>شیفت</th><th>وضعیت</th></tr></thead><tbody>';
        for (var k = 0; k < days.length; k++) {
          var dd2 = days[k];
          var asn = byDate[dd2.date];
          html += '<tr' + (dd2.isFri ? ' class="fri"' : '') + '>';
          html += '<td class="d-cell">' + dd2.jd + '</td>';
          html += '<td>' + WDAYS[dd2.wd] + '</td>';
          html += '<td>' + (asn ? (SH[asn.shift] || asn.shift) : '<span class="empty">—</span>') + '</td>';
          html += '<td>' + (asn ? (asn.state === 'checked_in' ? 'حاضر' : asn.state === 'checked_out' ? 'پایان' : asn.state === 'late' ? 'تأخیر' : asn.state === 'absent' ? 'غیبت' : 'در انتظار') : '') + '</td>';
          html += '</tr>';
        }
        html += '</tbody></table>';

        html += '<div class="footer">NABZ v1.0 · ' + new Date().toISOString() + '</div>';
        html += '</body></html>';

        var w2 = window.open('', '_blank');
        if (!w2) { alert('پاپ‌آپ مسدود است'); return; }
        w2.document.open();
        w2.document.write(html);
        w2.document.close();
        setTimeout(function() { try { w2.focus(); w2.print(); } catch (e) { alert('Ctrl+P'); } }, 500);
        NABZ._toast('✅ آماده شد');
      } catch (e) {
        console.error('[sa] printStaffSchedule:', e);
        alert('خطا: ' + e.message);
      }
    },

    // ═══════════════════════════════════════════════════════════
`;

// درج قبل از آخرین } از شیء Sa
const marker = '\n  };\n\n  window.NABZ = window.NABZ || {};';
if (!src.includes(marker)) {
  console.error('❌ marker انتهای Sa پیدا نشد');
  process.exit(1);
}
src = src.replace(marker, pdfCode + '\n  };\n\n  window.NABZ = window.NABZ || {};');
fs.writeFileSync(F, src);
console.log('✅ متدهای PDF نصب شد');
EOF_PDF

# syntax check
if node -e "new Function(require('fs').readFileSync('public/sa.js','utf8'))" 2>/dev/null; then
  echo "✅ sa.js syntax OK"
else
  echo "❌ sa.js syntax error"
  node -e "new Function(require('fs').readFileSync('public/sa.js','utf8'))" 2>&1 | head -3
  cp public/sa.js.before-phase3 public/sa.js
  exit 1
fi
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 3 — دکمه PDF در تب پیش‌نمایش
# ═══════════════════════════════════════════════════════════
echo "═══ ۳) دکمه PDF در پیش‌نمایش ═══"
node << 'EOF_BTN'
const fs = require('fs');
const F = 'public/sa.js';
let src = fs.readFileSync(F, 'utf8');

// دکمه PDF قبل از بسته شدن تابع _previewTab
const anchor = "return h;\n    },\n\n    async cellDetail";
if (src.includes(anchor)) {
  const newAnchor = "h += '<button class=\"btn btn-primary btn-block\" style=\"margin-top:12px;padding:14px\" onclick=\"NABZ.sa.printWardSchedule(' + wid + ',\\'' + period.id + '\\')\">🖨 چاپ / PDF برنامه</button>';\n      return h;\n    },\n\n    async cellDetail";
  src = src.replace(anchor, newAnchor);
  fs.writeFileSync(F, src);
  console.log('✅ دکمه چاپ اضافه شد');
} else if (src.includes('printWardSchedule(') && src.includes("onclick=\"NABZ.sa.printWardSchedule")) {
  console.log('ℹ️  از قبل هست');
} else {
  console.warn('⚠️  anchor پیدا نشد — دکمه به‌صورت دستی اضافه نشد');
}
EOF_BTN
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 4 — دکمه PDF در نمای شخصی پرسنل
# ═══════════════════════════════════════════════════════════
echo "═══ ۴) دکمه PDF در نمای شخصی ═══"
node << 'EOF_BTN2'
const fs = require('fs');
const F = 'public/sa.js';
let src = fs.readFileSync(F, 'utf8');

// بعد از اولین </div> از card شیفت امروز در staffHome
const anchor = "h += '<div class=\"sec-hd\"><span>📅 شیفت‌های ماه</span></div>';";
if (src.includes(anchor) && !src.includes("printStaffSchedule()'\">🖨")) {
  const newAnchor = "h += '<button class=\"btn\" style=\"width:100%;margin-bottom:12px;padding:10px;font-size:12px\" onclick=\"NABZ.sa.printStaffSchedule()\">🖨 چاپ کارت شیفت</button>';\n        h += '<div class=\"sec-hd\"><span>📅 شیفت‌های ماه</span></div>';";
  src = src.replace(anchor, newAnchor);
  fs.writeFileSync(F, src);
  console.log('✅ دکمه چاپ شخصی اضافه شد');
} else {
  console.log('ℹ️  از قبل هست یا anchor نیست');
}
EOF_BTN2
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 5 — CSS چاپ
# ═══════════════════════════════════════════════════════════
echo "═══ ۵) CSS چاپ ═══"
if ! grep -q "NABZ Phase 3 Print" public/style.css 2>/dev/null; then
cat >> public/style.css << 'EOF_CSS'

/* ═══════════════════════════════════════════════════════════
   NABZ Phase 3 Print Styles
   ═══════════════════════════════════════════════════════════ */
@media print {
  body { background:#fff !important; color:#000 !important; }
  #header, #sidebar, .bnav, .sec-hd button, .bs-close { display:none !important; }
  .card, .row, .stat { break-inside:avoid; box-shadow:none !important; }
  a[href]::after { content:''; }
}

/* دکمه چاپ — استایل ظریف */
.btn-print {
  background: var(--primary-soft);
  color: var(--primary);
  border: 1.5px solid var(--primary);
}
EOF_CSS
  echo "✅ CSS اضافه شد"
else
  echo "ℹ️  CSS از قبل هست"
fi
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 6 — SW bump
# ═══════════════════════════════════════════════════════════
echo "═══ ۶) SW bump ═══"
node -e "
  const fs = require('fs');
  let s = fs.readFileSync('public/sw.js', 'utf8');
  const v = s.match(/const VERSION = (\d+);/);
  if (v) {
    const nv = parseInt(v[1]) + 1;
    s = s.replace(v[0], 'const VERSION = ' + nv + ';');
    fs.writeFileSync('public/sw.js', s);
    console.log('✅ v' + v[1] + ' → v' + nv);
  }
"
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 7 — VERIFY
# ═══════════════════════════════════════════════════════════
echo "═══ ۷) VERIFY ═══"
node << 'EOF_V'
const fs = require('fs');
const src = fs.readFileSync('public/sa.js', 'utf8');
let p = 0, f = 0;
function c(l, ok) { console.log((ok ? '✅' : '❌') + ' ' + l); ok ? p++ : f++; }

c('sa.js syntax', (() => { try { new Function(src); return true; } catch (e) { return false; } })());
c('_jalCal موجود', src.includes('_jalCal'));
c('_j2d موجود', src.includes('_j2d'));
c('_monthDays از الگوریتم دقیق', src.includes('_jalaliMonthLength'));
c('_todayJ از الگوریتم دقیق', src.includes('_d2j(this._g2d') || src.includes('this._d2j(this._g2d'));
c('printWardSchedule موجود', src.includes('printWardSchedule'));
c('printStaffSchedule موجود', src.includes('printStaffSchedule'));
c('دکمه چاپ برنامه بخش', src.includes("printWardSchedule(' + wid") || src.includes('printWardSchedule(\' + wid'));
c('دکمه چاپ شخصی', src.includes('printStaffSchedule()\''));

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(p + ' PASS / ' + f + ' FAIL');
process.exit(f > 0 ? 1 : 0);
EOF_V

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Phase 3 نصب شد"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🔄 سرور:"
echo "  pkill -9 -f 'core/server.js' 2>/dev/null; sleep 1"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
echo ""
echo "🌐 مرورگر:"
echo "  F12 → Application → Storage → Clear site data"
echo "  Ctrl+Shift+R × ۲"
echo ""
echo "🎯 تست:"
echo "  1. داشبورد → بخش‌ها → ICU جنرال ۱ → پیش‌نمایش → دکمه «🖨 چاپ / PDF»"
echo "  2. لاگین PIN (5059258191 / 8191) → تب برنامه → دکمه «🖨 چاپ کارت شیفت»"
echo ""
echo "✅ اگر تقویم دقیق است:"
echo "  امروز باید با تاریخ گوشی/سیستم شما بخواند"
echo "  و روزهای هفته درست باشند (جمعه = ستون آخر)"
echo ""
