// ═══════════════════════════════════════════════════════════
//  NABZ Shift Assistant — Extras
//  تقویم جلالی دقیق + PDF — بدون لمس sa.js
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var MAX_WAIT = 60, waitCount = 0;

  function ready(fn) {
    if (window.NABZ && NABZ.sa && typeof NABZ.sa.showDashboard === 'function') return fn(NABZ.sa);
    if (++waitCount >= MAX_WAIT) return console.warn('[sa-extra] timeout');
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function(Sa) {
    if (Sa._extraApplied) return console.log('[sa-extra] already applied');
    Sa._extraApplied = true;

    // ═══ تقویم دقیق Birashk ═══
    Sa._jalCal = function(jy) {
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
    };
    Sa._g2d = function(gy, gm, gd) {
      var d = Math.trunc((gy + Math.trunc((gm - 8) / 6) + 100100) * 1461 / 4) +
              Math.trunc((153 * ((gm + 9) % 12) + 2) / 5) + gd - 34840408;
      return d - Math.trunc(Math.trunc((gy + 100100 + Math.trunc((gm - 8) / 6)) / 100) * 3 / 4) + 752;
    };
    Sa._d2g = function(jdn) {
      var j = 4 * jdn + 139361631;
      j = j + Math.trunc(Math.trunc((4 * jdn + 183187720) / 146097) * 3 / 4) * 4 - 3908;
      var i = Math.trunc((j % 1461) / 4) * 5 + 308;
      return {
        gy: Math.trunc(j / 1461) - 100100 + Math.trunc((8 - Math.trunc((i % 153) / 12)) / 6),
        gm: ((Math.trunc(i / 153) % 12)) + 1,
        gd: Math.trunc((i % 153) / 5) + 1
      };
    };
    Sa._j2d = function(jy, jm, jd) {
      var r = this._jalCal(jy);
      return this._g2d(r.gy, 3, r.march) + (jm - 1) * 31 - Math.trunc(jm / 7) * (jm - 7) + jd - 1;
    };
    Sa._d2j = function(jdn) {
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
    };
    Sa._jalaliMonthLength = function(jy, jm) {
      if (jm <= 6) return 31;
      if (jm <= 11) return 30;
      return this._jalCal(jy).leap === 0 ? 30 : 29;
    };
    Sa._todayJ = function() {
      var n = new Date();
      var g = this._g2d(n.getFullYear(), n.getMonth() + 1, n.getDate());
      var j = this._d2j(g);
      return j.jy + '/' + this._pad(j.jm) + '/' + this._pad(j.jd);
    };
    Sa._monthDays = function(jy, jm) {
      var ml = this._jalaliMonthLength(jy, jm);
      var days = [];
      for (var d = 1; d <= ml; d++) {
        var jdn = this._j2d(jy, jm, d);
        var wd = ((jdn + 2) % 7 + 7) % 7;
        days.push({ jd: d, date: jy + '/' + this._pad(jm) + '/' + this._pad(d), wd: wd, isFri: wd === 6 });
      }
      return days;
    };
    console.log('[sa-extra] calendar ✓');

    // ═══ PDF برنامه بخش ═══
    Sa.printWardSchedule = async function(wardId, periodId) {
      try {
        NABZ._toast('آماده‌سازی...');
        var ward = ((this._cache.wards || {}).items || []).find(function(w) { return w.id === wardId; });
        if (!ward) throw new Error('ward_not_found');
        var assigns = await this._api('/api/sa/assignments?wardId=' + wardId + '&periodId=' + periodId);
        var staff = await this._api('/api/sa/staff?wardId=' + wardId + '&limit=500');
        var period = await this._getPeriod();
        if (!period) throw new Error('period_not_found');

        var staffMap = {};
        for (var i = 0; i < (staff.items || []).length; i++) staffMap[staff.items[i].id] = staff.items[i];

        var days = this._monthDays(period.jy, period.jm);
        var grid = {};
        for (var j = 0; j < (assigns.items || []).length; j++) {
          var a = assigns.items[j];
          var k = a.date + '|' + a.shift;
          if (!grid[k]) grid[k] = [];
          var s = staffMap[a.staffId];
          if (s) grid[k].push(s);
        }

        var MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
        var WDAYS = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];

        var html = '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">';
        html += '<title>برنامه ' + ward.label + '</title>';
        html += '<style>';
        html += '@page{size:A4 landscape;margin:8mm}';
        html += 'body{font-family:"Vazirmatn",Tahoma,sans-serif;font-size:9.5px;padding:0;margin:0}';
        html += '.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #0891b2;padding-bottom:6px;margin-bottom:8px}';
        html += '.hdr h1{font-size:15px;margin:0;color:#0c4a6e}';
        html += 'table{width:100%;border-collapse:collapse;font-size:8.5px}';
        html += 'th{background:#e0f2fe;color:#0c4a6e;padding:4px;border:1px solid #94a3b8;font-weight:900}';
        html += 'td{border:1px solid #cbd5e1;padding:3px;vertical-align:top;text-align:center}';
        html += '.date-cell{background:#f8fafc;font-weight:900}';
        html += '.wd-cell{background:#f8fafc;font-size:7.5px;color:#64748b}';
        html += '.rn{color:#0369a1;font-weight:700}';
        html += '.fri td{background:#fef2f2}';
        html += '.footer{margin-top:8px;font-size:7.5px;color:#94a3b8;text-align:center}';
        html += '</style></head><body>';
        html += '<div class="hdr"><div><h1>🫀 برنامه شیفت ' + ward.label + '</h1>';
        html += '<div style="font-size:9px;color:#666">' + MONTHS[period.jm-1] + ' ' + period.jy + ' · ' + (ward.headNurse || '—') + '</div></div>';
        html += '<div style="text-align:left;font-size:9px;color:#666">' + new Date().toLocaleDateString('fa-IR') + '</div></div>';
        html += '<table><thead><tr><th>ت</th><th>روز</th><th>🌅 صبح</th><th>🌆 عصر</th><th>🌙 شب</th></tr></thead><tbody>';
        for (var d = 0; d < days.length; d++) {
          var dd = days[d];
          html += '<tr' + (dd.isFri ? ' class="fri"' : '') + '>';
          html += '<td class="date-cell">' + dd.jd + '</td>';
          html += '<td class="wd-cell">' + WDAYS[dd.wd] + '</td>';
          for (var si = 0; si < 3; si++) {
            var sh = ['M','E','N'][si];
            var names = grid[dd.date + '|' + sh] || [];
            html += '<td>';
            if (names.length === 0) html += '—';
            else for (var ni = 0; ni < names.length; ni++) {
              html += '<div class="' + (names[ni].category === 'rn' ? 'rn' : '') + '">' + names[ni].name + '</div>';
            }
            html += '</td>';
          }
          html += '</tr>';
        }
        html += '</tbody></table>';
        html += '<div class="footer">NABZ v1.0 · ' + new Date().toISOString() + '</div>';
        html += '</body></html>';

        var w = window.open('', '_blank');
        if (!w) { alert('پاپ‌آپ مسدود است'); return; }
        w.document.open(); w.document.write(html); w.document.close();
        setTimeout(function() { try { w.focus(); w.print(); } catch(e) { alert('Ctrl+P'); } }, 400);
        NABZ._toast('✅ آماده شد');
      } catch (e) {
        console.error('[sa] printWardSchedule:', e);
        alert('خطا: ' + e.message);
      }
    };

    // ═══ PDF کارت شخصی ═══
    Sa.printStaffSchedule = async function() {
      try {
        var user = NABZ.state.user;
        if (!user || user.role !== 'shift_staff') { alert('فقط پرسنل'); return; }
        NABZ._toast('آماده‌سازی...');
        var period = await this._getPeriod();
        if (!period) throw new Error('period_not_found');
        var assigns = await this._api('/api/sa/assignments?staffId=' + user.staffId + '&periodId=' + period.id);
        var staff = await this._api('/api/sa/staff/' + user.staffId).catch(function() { return null; });

        var MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
        var WDAYS = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
        var SH = { M:'صبح', E:'عصر', N:'شب', L:'لانگ', EN:'عصر+شب', H24:'۲۴ساعته' };
        var days = this._monthDays(period.jy, period.jm);
        var byDate = {};
        for (var i = 0; i < (assigns.items || []).length; i++) byDate[assigns.items[i].date] = assigns.items[i];

        var totalMin = 0, nights = 0, shifts = 0;
        for (var j = 0; j < (assigns.items || []).length; j++) {
          totalMin += assigns.items[j].actualMinutes || 0;
          if (assigns.items[j].shift === 'N' || assigns.items[j].shift === 'EN') nights++;
          shifts++;
        }

        var html = '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><title>کارت شیفت</title>';
        html += '<style>';
        html += '@page{size:A4;margin:12mm}';
        html += 'body{font-family:"Vazirmatn",Tahoma,sans-serif;font-size:10px;padding:0;margin:0}';
        html += '.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #0891b2;padding-bottom:8px;margin-bottom:12px}';
        html += '.hdr h1{font-size:16px;margin:0;color:#0c4a6e}';
        html += '.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}';
        html += '.stat{background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:8px;text-align:center}';
        html += '.stat .v{font-size:20px;font-weight:900;color:#0c4a6e}';
        html += '.stat .l{font-size:8.5px;color:#0891b2;font-weight:700}';
        html += 'table{width:100%;border-collapse:collapse;font-size:10px}';
        html += 'th{background:#e0f2fe;color:#0c4a6e;padding:5px;border:1px solid #94a3b8;font-weight:900}';
        html += 'td{border:1px solid #cbd5e1;padding:4px;text-align:center}';
        html += '.d-cell{font-weight:900;background:#f8fafc}';
        html += '.fri td{background:#fef2f2}';
        html += '.footer{margin-top:14px;font-size:8px;color:#94a3b8;text-align:center}';
        html += '</style></head><body>';
        html += '<div class="hdr"><div><h1>🫀 کارت شیفت شخصی</h1>';
        html += '<div style="font-size:9px;color:#666;margin-top:2px">' + user.fullName + (staff ? ' · ' + staff.code : '') + '</div></div>';
        html += '<div style="text-align:left;font-size:9px;color:#666">' + MONTHS[period.jm-1] + ' ' + period.jy + '</div></div>';
        html += '<div class="stats">';
        html += '<div class="stat"><div class="v">' + shifts + '</div><div class="l">شیفت</div></div>';
        html += '<div class="stat"><div class="v">' + Math.round(totalMin/60) + '</div><div class="l">ساعت</div></div>';
        html += '<div class="stat"><div class="v">' + nights + '</div><div class="l">شب</div></div>';
        html += '</div>';
        html += '<table><thead><tr><th>تاریخ</th><th>روز</th><th>شیفت</th><th>وضعیت</th></tr></thead><tbody>';
        for (var k = 0; k < days.length; k++) {
          var dd = days[k];
          var asn = byDate[dd.date];
          html += '<tr' + (dd.isFri ? ' class="fri"' : '') + '>';
          html += '<td class="d-cell">' + dd.jd + '</td>';
          html += '<td>' + WDAYS[dd.wd] + '</td>';
          html += '<td>' + (asn ? (SH[asn.shift] || asn.shift) : '—') + '</td>';
          html += '<td>' + (asn ? (asn.state === 'checked_in' ? 'حاضر' : asn.state === 'late' ? 'تأخیر' : asn.state === 'absent' ? 'غیبت' : asn.state === 'checked_out' ? 'پایان' : 'در انتظار') : '') + '</td>';
          html += '</tr>';
        }
        html += '</tbody></table>';
        html += '<div class="footer">NABZ v1.0 · ' + new Date().toISOString() + '</div>';
        html += '</body></html>';

        var w = window.open('', '_blank');
        if (!w) { alert('پاپ‌آپ مسدود است'); return; }
        w.document.open(); w.document.write(html); w.document.close();
        setTimeout(function() { try { w.focus(); w.print(); } catch(e) { alert('Ctrl+P'); } }, 400);
        NABZ._toast('✅ آماده شد');
      } catch (e) {
        console.error('[sa] printStaffSchedule:', e);
        alert('خطا: ' + e.message);
      }
    };
    console.log('[sa-extra] PDF ✓');

    // ═══ دکمه PDF در پیش‌نمایش بخش — wrap _render ═══
    var origRender = Sa._render;
    if (origRender) {
      Sa._render = async function() {
        await origRender.call(this);
        if (this.ui.section === 'ward_detail' && this.ui.rosterTab === 'preview') {
          var content = document.getElementById('content');
          if (content && !content.querySelector('[data-pdf-ward-btn]')) {
            var p2 = await this._getPeriod();
            var wid2 = this.ui.wardId;
            var pid2 = p2 ? p2.id : '';
            var b1 = document.createElement('button');
            b1.setAttribute('data-pdf-ward-btn', '1');
            b1.className = 'btn btn-primary btn-block';
            b1.style.cssText = 'margin-top:12px;padding:14px';
            b1.textContent = '🖨 چاپ / PDF برنامه';
            b1.onclick = function() { Sa.printWardSchedule(wid2, pid2); };
            content.appendChild(b1);
          }
        }
      };
    }

    // ═══ دکمه PDF در نمای شخصی — wrap staffHome ═══
    var origStaffHome = Sa.staffHome;
    if (origStaffHome) {
      Sa.staffHome = async function() {
        await origStaffHome.call(this);
        var content2 = document.getElementById('content');
        if (content2 && !content2.querySelector('[data-pdf-staff-btn]')) {
          var b2 = document.createElement('button');
          b2.setAttribute('data-pdf-staff-btn', '1');
          b2.className = 'btn';
          b2.style.cssText = 'width:100%;margin-top:12px;padding:10px;font-size:12px';
          b2.textContent = '🖨 چاپ کارت شیفت';
          b2.onclick = function() { Sa.printStaffSchedule(); };
          content2.appendChild(b2);
        }
      };
    }
    console.log('[sa-extra] buttons injected ✓');
  });
})();
