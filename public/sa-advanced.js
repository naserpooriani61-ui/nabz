// ═══════════════════════════════════════════════════════════
//  NABZ Shift Assistant — Advanced Features
//  مقایسه سناریو + PDF کامل + گزارش روزانه
//  ⚠️ هیچ wrap یا تغییر در sa.js انجام نمی‌شود
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var MAX_WAIT = 60, waitCount = 0;
  function ready(fn) {
    if (window.NABZ && NABZ.sa && typeof NABZ.sa.showDashboard === 'function') return fn(NABZ.sa);
    if (++waitCount >= MAX_WAIT) return console.warn('[sa-adv] timeout');
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function(Sa) {
    if (Sa._advApplied) return console.log('[sa-adv] already applied');
    Sa._advApplied = true;

    var MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
    var WDAYS = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
    var SH = { M:'صبح', E:'عصر', N:'شب', L:'لانگ', EN:'عصر+شب', H24:'۲۴ساعته' };

    // ═══════════════════════════════════════════════════════
    //  ویژگی ۱ — مقایسه سناریو
    // ═══════════════════════════════════════════════════════
    Sa.compareScenarios = async function(wardId) {
      var period = await this._getPeriod();
      if (!period) return alert('دوره یافت نشد');
      var ward = ((this._cache.wards || {}).items || []).find(function(w) { return w.id === wardId; });
      if (!ward) return alert('بخش یافت نشد');

      var scenarios = [
        { name: 'پوشش‌محور', icon: '🎯', weights: { coverage: 200, pref: 20, fair: 20, rest: 15, random: 2 }, desc: 'حداکثر پوشش، ترجیحات نادیده' },
        { name: 'متعادل', icon: '⚖️', weights: { coverage: 100, pref: 50, fair: 30, rest: 15, random: 2 }, desc: 'توازن پوشش + ترجیحات + عدالت' },
        { name: 'عدالت‌محور', icon: '📊', weights: { coverage: 80, pref: 40, fair: 150, rest: 20, random: 2 }, desc: 'توزیع یکنواخت شب/جمعه/ساعت' },
        { name: 'ترجیح‌محور', icon: '💜', weights: { coverage: 50, pref: 150, fair: 20, rest: 15, random: 2 }, desc: 'اولویت به درخواست‌های پرسنل' }
      ];

      // ── نمایش loading ──
      var sheet = document.createElement('div');
      sheet.className = 'bs-backdrop';
      sheet.onclick = function(e) { if (e.target === sheet) sheet.remove(); };
      var c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '95vh';
      c.innerHTML = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🔬 مقایسه سناریو — ' + NABZ._esc(ward.label) + '</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>' +
        '<div style="text-align:center;padding:40px"><span class="spinner"></span><div style="margin-top:12px;color:var(--fg-2)">در حال اجرای ۴ الگوریتم موازی...</div></div>';
      sheet.appendChild(c);
      document.body.appendChild(sheet);
      requestAnimationFrame(function() { sheet.classList.add('show'); });

      var results = [];
      for (var i = 0; i < scenarios.length; i++) {
        var sc = scenarios[i];
        try {
          // ذخیره snapshot
          var before = await NABZ._api('/api/sa/assignments?wardId=' + wardId + '&periodId=' + period.id);
          var sol = await NABZ._api('/api/sa/solve', {
            method: 'POST',
            body: JSON.stringify({ wardId: wardId, periodId: period.id, weights: sc.weights })
          });

          // بخوان
          var assigns = await NABZ._api('/api/sa/assignments?wardId=' + wardId + '&periodId=' + period.id);
          var staff = await NABZ._api('/api/sa/staff?wardId=' + wardId + '&limit=500');

          // محاسبه شاخص‌ها
          var staffMap = {};
          for (var k = 0; k < (staff.items || []).length; k++) staffMap[staff.items[k].id] = staff.items[k];

          var stats = {
            totalMin: 0, nights: 0, perStaff: {},
            maxHours: 0, minHours: 0, hoursList: []
          };
          var perStaff = {};
          for (var m = 0; m < (assigns.items || []).length; m++) {
            var a = assigns.items[m];
            var mins = a.actualMinutes || 0;
            stats.totalMin += mins;
            if (a.shift === 'N' || a.shift === 'EN') stats.nights++;
            if (!perStaff[a.staffId]) perStaff[a.staffId] = { hours: 0, nights: 0 };
            perStaff[a.staffId].hours += mins / 60;
            if (a.shift === 'N' || a.shift === 'EN') perStaff[a.staffId].nights++;
          }
          var hoursList = [];
          for (var sid in perStaff) hoursList.push(perStaff[sid].hours);
          if (hoursList.length) {
            stats.maxHours = Math.round(Math.max.apply(null, hoursList));
            stats.minHours = Math.round(Math.min.apply(null, hoursList));
            var sum = 0;
            for (var h = 0; h < hoursList.length; h++) sum += hoursList[h];
            var mean = sum / hoursList.length;
            var variance = 0;
            for (var h2 = 0; h2 < hoursList.length; h2++) variance += Math.pow(hoursList[h2] - mean, 2);
            variance /= hoursList.length;
            stats.hourCV = mean > 0 ? Math.round(Math.sqrt(variance) / mean * 1000) / 1000 : 0;
          }
          stats.nightsList = [];
          for (var sid2 in perStaff) stats.nightsList.push(perStaff[sid2].nights);
          stats.nightGap = stats.nightsList.length ? Math.max.apply(null, stats.nightsList) - Math.min.apply(null, stats.nightsList) : 0;

          results.push({
            scenario: sc,
            saved: sol.saved,
            coverage: sol.coverage,
            shortages: sol.shortages,
            stats: stats
          });
        } catch (e) {
          results.push({ scenario: sc, error: e.message });
        }
      }

      // ── نمایش نتایج ──
      var best = null;
      for (var b = 0; b < results.length; b++) {
        if (results[b].error) continue;
        if (!best || results[b].coverage > best.coverage) best = results[b];
      }

      var html = '<div class="bs-handle"></div>';
      html += '<div class="bs-hd"><div class="bs-title">🔬 مقایسه سناریو — ' + NABZ._esc(ward.label) + '</div>';
      html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      html += '<div style="padding:10px;background:var(--primary-soft);border-radius:8px;margin-bottom:12px;font-size:11.5px;color:var(--primary);text-align:center;font-weight:800">';
      html += '✅ ۴ سناریو اجرا شد — بهترین: ' + (best ? best.scenario.name + ' (' + best.coverage + '%)' : '—');
      html += '</div>';

      // جدول مقایسه
      html += '<div class="scroll-x" style="margin-bottom:12px"><table style="width:100%;font-size:11px">';
      html += '<thead><tr><th style="padding:6px;text-align:right">سناریو</th><th>پوشش</th><th>تخصیص</th><th>کمبود</th><th>CV ساعت</th><th>شکاف شب</th></tr></thead><tbody>';
      for (var r = 0; r < results.length; r++) {
        var res = results[r];
        if (res.error) {
          html += '<tr><td style="padding:6px">' + res.scenario.icon + ' ' + res.scenario.name + '</td><td colspan="5" style="color:var(--dng);text-align:center">خطا: ' + res.error + '</td></tr>';
          continue;
        }
        var isBest = res === best;
        var rowStyle = isBest ? 'background:var(--primary-soft);font-weight:900' : '';
        var covColor = res.coverage >= 95 ? 'var(--ok)' : res.coverage >= 80 ? 'var(--warn)' : 'var(--dng)';
        html += '<tr style="' + rowStyle + '">';
        html += '<td style="padding:6px;text-align:right">' + res.scenario.icon + ' ' + res.scenario.name + (isBest ? ' 🏆' : '') + '</td>';
        html += '<td style="text-align:center;color:' + covColor + ';font-weight:900">' + res.coverage + '%</td>';
        html += '<td style="text-align:center">' + res.saved + '</td>';
        html += '<td style="text-align:center;color:' + (res.shortages > 0 ? 'var(--dng)' : 'var(--ok)') + '">' + res.shortages + '</td>';
        html += '<td style="text-align:center">' + (res.stats.hourCV || '—') + '</td>';
        html += '<td style="text-align:center">' + (res.stats.nightGap || '—') + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table></div>';

      // کارت‌های تفصیلی
      for (var q = 0; q < results.length; q++) {
        var res2 = results[q];
        if (res2.error) continue;
        var isBest2 = res2 === best;
        html += '<div class="card" style="margin-bottom:8px;' + (isBest2 ? 'border-color:var(--primary);border-width:2px' : '') + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
        html += '<div><div style="font-weight:900;font-size:13px">' + res2.scenario.icon + ' ' + res2.scenario.name + '</div>';
        html += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">' + res2.scenario.desc + '</div></div>';
        if (isBest2) html += '<span class="pill ok">🏆 بهترین</span>';
        html += '</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;font-size:11px">';
        html += '<div style="text-align:center;padding:6px;background:var(--bg-3);border-radius:6px"><div style="font-size:16px;font-weight:900;color:var(--primary)">' + res2.coverage + '%</div><div style="color:var(--fg-2);font-size:9px">پوشش</div></div>';
        html += '<div style="text-align:center;padding:6px;background:var(--bg-3);border-radius:6px"><div style="font-size:16px;font-weight:900">' + res2.saved + '</div><div style="color:var(--fg-2);font-size:9px">تخصیص</div></div>';
        html += '<div style="text-align:center;padding:6px;background:var(--bg-3);border-radius:6px"><div style="font-size:16px;font-weight:900;color:' + (res2.stats.nightGap > 3 ? 'var(--dng)' : 'var(--ok)') + '">' + res2.stats.nightGap + '</div><div style="color:var(--fg-2);font-size:9px">شکاف شب</div></div>';
        html += '<div style="text-align:center;padding:6px;background:var(--bg-3);border-radius:6px"><div style="font-size:16px;font-weight:900">' + Math.round(res2.stats.totalMin / 60) + 'h</div><div style="color:var(--fg-2);font-size:9px">کل ساعت</div></div>';
        html += '</div>';
        html += '<button class="btn btn-primary btn-block" style="margin-top:8px;padding:10px;font-size:12px" onclick="NABZ.sa._applyScenario(' + wardId + ',' + q + ')">✅ اعمال این سناریو</button>';
        html += '</div>';
      }

      // دکمه‌ها
      html += '<div style="margin-top:12px"><button class="btn btn-block" onclick="this.closest(\'.bs-backdrop\').remove();NABZ.sa._render()">بستن و بازخوانی</button></div>';

      c.innerHTML = html;
      Sa._lastScenarios = { wardId: wardId, periodId: period.id, results: results };
      console.log('[sa-adv] compared ' + results.length + ' scenarios');
    };

    Sa._applyScenario = async function(wardId, idx) {
      var data = Sa._lastScenarios;
      if (!data) return;
      var res = data.results[idx];
      if (!res || res.error) return;
      if (!confirm('سناریوی «' + res.scenario.name + '» اعمال شود؟\n\nپوشش: ' + res.coverage + '%')) return;
      try {
        NABZ._toast('در حال اعمال...');
        var sol = await NABZ._api('/api/sa/solve', {
          method: 'POST',
          body: JSON.stringify({ wardId: wardId, periodId: data.periodId, weights: res.scenario.weights })
        });
        NABZ._toast('✅ ' + sol.saved + ' تخصیص — ' + sol.coverage + '%');
        document.querySelector('.bs-backdrop') && document.querySelector('.bs-backdrop').remove();
        Sa.ui.rosterTab = 'preview';
        Sa._render();
      } catch (e) {
        alert('خطا: ' + e.message);
      }
    };

    // ═══════════════════════════════════════════════════════
    //  ویژگی ۲ — PDF کامل همه بخش‌ها
    // ═══════════════════════════════════════════════════════
    Sa.printAllWards = async function() {
      var period = await this._getPeriod();
      if (!period) return alert('دوره یافت نشد');
      var wards = ((this._cache.wards || {}).items || []).filter(function(w) { return !w.isManagement; });
      if (!wards.length) return alert('بخشی نیست');

      var sheet = document.createElement('div');
      sheet.className = 'bs-backdrop';
      sheet.onclick = function(e) { if (e.target === sheet) sheet.remove(); };
      var c = document.createElement('div');
      c.className = 'bs-sheet';
      c.innerHTML = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📚 PDF کامل — ' + wards.length + ' بخش</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>' +
        '<div style="text-align:center;padding:30px"><span class="spinner"></span><div id="pdfProgress" style="margin-top:12px;color:var(--fg-2);font-size:12px">آماده‌سازی...</div></div>';
      sheet.appendChild(c);
      document.body.appendChild(sheet);
      requestAnimationFrame(function() { sheet.classList.add('show'); });

      var progressEl = function() { return document.getElementById('pdfProgress'); };

      try {
        // همه تخصیص‌ها
        var allAssign = await NABZ._api('/api/sa/assignments?periodId=' + period.id);
        var allStaff = await NABZ._api('/api/sa/staff?limit=500');

        var staffMap = {};
        for (var i = 0; i < (allStaff.items || []).length; i++) staffMap[allStaff.items[i].id] = allStaff.items[i];

        // گروه‌بندی بر اساس ward
        var byWard = {};
        for (var j = 0; j < (allAssign.items || []).length; j++) {
          var a = allAssign.items[j];
          if (!byWard[a.wardId]) byWard[a.wardId] = [];
          byWard[a.wardId].push(a);
        }

        var days = Sa._monthDays(period.jy, period.jm);

        // ── شروع HTML ──
        var html = '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">';
        html += '<title>برنامه کامل بیمارستان — ' + MONTHS[period.jm-1] + ' ' + period.jy + '</title>';
        html += '<style>';
        html += '@page{size:A4 landscape;margin:6mm}';
        html += 'body{font-family:"Vazirmatn",Tahoma,sans-serif;font-size:8.5px;color:#000;padding:0;margin:0}';
        html += '.cover{page-break-after:always;padding:40mm 20mm;text-align:center}';
        html += '.cover h1{font-size:28px;color:#0c4a6e;margin:0 0 12px}';
        html += '.cover .sub{font-size:14px;color:#64748b;margin-bottom:8px}';
        html += '.cover .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:60px}';
        html += '.cover .stat{background:#f0f9ff;border:2px solid #bae6fd;border-radius:8px;padding:20px}';
        html += '.cover .stat .v{font-size:36px;font-weight:900;color:#0c4a6e}';
        html += '.cover .stat .l{font-size:11px;color:#0891b2;font-weight:700}';
        html += '.ward{page-break-before:always;padding:4mm}';
        html += '.ward:first-of-type{page-break-before:auto}';
        html += '.ward-hdr{display:flex;justify-content:space-between;border-bottom:2px solid #0891b2;padding-bottom:4px;margin-bottom:6px}';
        html += '.ward-hdr h2{font-size:14px;margin:0;color:#0c4a6e}';
        html += '.ward-hdr .meta{font-size:9px;color:#666;text-align:left}';
        html += 'table{width:100%;border-collapse:collapse;font-size:7.5px}';
        html += 'th{background:#e0f2fe;color:#0c4a6e;padding:3px;border:1px solid #94a3b8;font-weight:900;text-align:center;font-size:7.5px}';
        html += 'td{border:1px solid #cbd5e1;padding:2px 1px;vertical-align:top;text-align:center}';
        html += '.date-cell{background:#f8fafc;font-weight:900;font-size:8px;min-width:22px}';
        html += '.wd-cell{background:#f8fafc;font-size:6.5px;color:#64748b;min-width:20px}';
        html += '.rn{color:#0369a1;font-weight:700;font-size:7px}';
        html += '.sup{color:#7c3aed;font-weight:600;font-size:7px}';
        html += '.fri td{background:#fef2f2}';
        html += '.footer{position:running(footer);font-size:7px;color:#94a3b8;text-align:center}';
        html += '</style></head><body>';

        // ── جلد ──
        html += '<div class="cover">';
        html += '<h1>🫀 برنامه ماهانه بیمارستان سینا</h1>';
        html += '<div class="sub">' + MONTHS[period.jm-1] + ' ' + period.jy + '</div>';
        html += '<div class="sub">سیستم نبض — Neural Hospital OS</div>';
        html += '<div style="font-size:10px;color:#94a3b8;margin-top:8px">' + new Date().toLocaleString('fa-IR') + '</div>';
        html += '<div class="stats">';
        html += '<div class="stat"><div class="v">' + wards.length + '</div><div class="l">بخش فعال</div></div>';
        html += '<div class="stat"><div class="v">' + (allAssign.items || []).length.toLocaleString('fa-IR') + '</div><div class="l">تخصیص کل</div></div>';
        html += '<div class="stat"><div class="v">' + (allStaff.items || []).length + '</div><div class="l">پرسنل</div></div>';
        html += '</div>';
        html += '<div style="margin-top:80px;font-size:9px;color:#64748b">';
        html += '<div style="display:flex;justify-content:space-around">';
        html += '<div style="text-align:center"><div style="border-top:1px solid #64748b;padding-top:4px;width:180px">سرپرستار بخش‌ها</div></div>';
        html += '<div style="text-align:center"><div style="border-top:1px solid #64748b;padding-top:4px;width:180px">مترون</div></div>';
        html += '<div style="text-align:center"><div style="border-top:1px solid #64748b;padding-top:4px;width:180px">مدیر پرستاری</div></div>';
        html += '</div></div>';
        html += '</div>';

        // ── هر بخش ──
        for (var wi = 0; wi < wards.length; wi++) {
          var w = wards[wi];
          var wardAssigns = byWard[w.id] || [];
          if (!wardAssigns.length) continue;
          if (progressEl()) progressEl().textContent = 'بخش ' + (wi + 1) + ' از ' + wards.length + ': ' + w.label;

          var grid = {};
          for (var ga = 0; ga < wardAssigns.length; ga++) {
            var ass = wardAssigns[ga];
            var gk = ass.date + '|' + ass.shift;
            if (!grid[gk]) grid[gk] = [];
            var stf = staffMap[ass.staffId];
            if (stf) grid[gk].push(stf);
          }

          html += '<div class="ward">';
          html += '<div class="ward-hdr">';
          html += '<div><h2>' + w.label + '</h2><div style="font-size:8px;color:#666;margin-top:1px">' + (w.headNurse || '—') + ' · ' + w.staffCount + ' پرسنل</div></div>';
          html += '<div class="meta"><div>' + MONTHS[period.jm-1] + ' ' + period.jy + '</div><div style="font-family:monospace">' + w.code + '</div></div>';
          html += '</div>';
          html += '<table><thead><tr><th>ت</th><th>ر</th><th>🌅 صبح</th><th>🌆 عصر</th><th>🌙 شب</th></tr></thead><tbody>';
          for (var di = 0; di < days.length; di++) {
            var dd = days[di];
            html += '<tr' + (dd.isFri ? ' class="fri"' : '') + '>';
            html += '<td class="date-cell">' + dd.jd + '</td>';
            html += '<td class="wd-cell">' + WDAYS[dd.wd].slice(0,2) + '</td>';
            var shiftsArr = ['M', 'E', 'N'];
            for (var si = 0; si < 3; si++) {
              var sh = shiftsArr[si];
              var names = grid[dd.date + '|' + sh] || [];
              html += '<td>';
              if (!names.length) html += '<span style="color:#cbd5e1">—</span>';
              else for (var ni = 0; ni < names.length; ni++) {
                var isRn = ['rn','anesthesia','midwife','or_tech','or_specialist','wound_specialist','ecg'].indexOf(names[ni].category) >= 0;
                html += '<div class="' + (isRn ? 'rn' : 'sup') + '">' + names[ni].name + '</div>';
              }
              html += '</td>';
            }
            html += '</tr>';
          }
          html += '</tbody></table>';
          html += '</div>';
        }

        html += '<div class="footer">NABZ — Neural Hospital OS v1.0 · ' + new Date().toISOString() + '</div>';
        html += '</body></html>';

        if (progressEl()) progressEl().textContent = 'در حال باز کردن...';

        var wOpen = window.open('', '_blank');
        if (!wOpen) { alert('پاپ‌آپ مسدود است'); sheet.remove(); return; }
        wOpen.document.open();
        wOpen.document.write(html);
        wOpen.document.close();
        setTimeout(function() { try { wOpen.focus(); wOpen.print(); } catch (e) { alert('Ctrl+P'); } }, 800);

        sheet.remove();
        NABZ._toast('✅ PDF کامل آماده شد (' + wards.length + ' بخش)');
      } catch (e) {
        console.error('[sa-adv] printAllWards:', e);
        alert('خطا: ' + e.message);
        sheet.remove();
      }
    };

    // ═══════════════════════════════════════════════════════
    //  ویژگی ۳ — گزارش روزانه کامل
    // ═══════════════════════════════════════════════════════
    Sa.printDailyReport = async function() {
      var period = await this._getPeriod();
      if (!period) return alert('دوره یافت نشد');
      try {
        NABZ._toast('آماده‌سازی...');
        var today = this._todayJ();
        var todayAssign = await NABZ._api('/api/sa/assignments?periodId=' + period.id);
        var allStaff = await NABZ._api('/api/sa/staff?limit=500');
        var wards = ((this._cache.wards || {}).items || []).filter(function(w) { return !w.isManagement; });

        var staffMap = {};
        for (var i = 0; i < (allStaff.items || []).length; i++) staffMap[allStaff.items[i].id] = allStaff.items[i];

        var todayItems = [];
        for (var j = 0; j < (todayAssign.items || []).length; j++) {
          if (todayAssign.items[j].date === today) todayItems.push(todayAssign.items[j]);
        }

        // گروه‌بندی بر اساس بخش
        var byWard = {};
        for (var k = 0; k < todayItems.length; k++) {
          var it = todayItems[k];
          if (!byWard[it.wardId]) byWard[it.wardId] = { total: 0, present: 0, late: 0, absent: 0, waiting: 0, shifts: { M: [], E: [], N: [] } };
          var wd = byWard[it.wardId];
          wd.total++;
          var st = staffMap[it.staffId];
          var entry = { name: st ? st.name : '?', category: st ? st.category : '?', state: it.state, checkInAt: it.checkInAt, reason: it.lateReason || it.absentReason };
          if (it.state === 'checked_in' || it.state === 'checked_out') wd.present++;
          else if (it.state === 'late') wd.late++;
          else if (it.state === 'absent') wd.absent++;
          else wd.waiting++;
          if (wd.shifts[it.shift]) wd.shifts[it.shift].push(entry);
        }

        var totalPresent = 0, totalLate = 0, totalAbsent = 0, totalWait = 0;
        for (var wid in byWard) {
          totalPresent += byWard[wid].present;
          totalLate += byWard[wid].late;
          totalAbsent += byWard[wid].absent;
          totalWait += byWard[wid].waiting;
        }

        var html = '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">';
        html += '<title>گزارش روزانه — ' + today + '</title>';
        html += '<style>';
        html += '@page{size:A4 landscape;margin:8mm}';
        html += 'body{font-family:"Vazirmatn",Tahoma,sans-serif;font-size:9px;color:#000;padding:0;margin:0}';
        html += '.hdr{display:flex;justify-content:space-between;border-bottom:3px solid #0891b2;padding-bottom:8px;margin-bottom:10px}';
        html += '.hdr h1{font-size:18px;color:#0c4a6e;margin:0}';
        html += '.hdr .meta{text-align:left;font-size:10px;color:#666}';
        html += '.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}';
        html += '.stat{padding:10px;border-radius:6px;text-align:center;border:2px solid}';
        html += '.stat .v{font-size:24px;font-weight:900;line-height:1}';
        html += '.stat .l{font-size:9px;margin-top:4px;font-weight:700}';
        html += '.stat.total{background:#eff6ff;border-color:#3b82f6;color:#1e40af}';
        html += '.stat.present{background:#dcfce7;border-color:#16a34a;color:#166534}';
        html += '.stat.late{background:#fef3c7;border-color:#d97706;color:#92400e}';
        html += '.stat.absent{background:#fee2e2;border-color:#dc2626;color:#991b1b}';
        html += 'table{width:100%;border-collapse:collapse;font-size:8.5px}';
        html += 'th{background:#e0f2fe;color:#0c4a6e;padding:4px;border:1px solid #94a3b8;font-weight:900}';
        html += 'td{border:1px solid #cbd5e1;padding:3px;text-align:center}';
        html += '.ward-name{background:#f8fafc;font-weight:900;text-align:right;padding:4px 6px}';
        html += '.name{text-align:right;padding:3px 6px;font-size:8px}';
        html += '.present-row{background:#f0fdf4}';
        html += '.late-row{background:#fffbeb}';
        html += '.absent-row{background:#fef2f2}';
        html += '.sig{margin-top:16px;display:flex;justify-content:space-around}';
        html += '.sig-line{border-top:1px solid #64748b;padding-top:6px;font-size:9px;text-align:center;width:180px}';
        html += '</style></head><body>';
        html += '<div class="hdr"><div><h1>📋 گزارش روزانه شیفت — ' + today + '</h1>';
        html += '<div style="font-size:10px;color:#666;margin-top:2px">' + MONTHS[period.jm-1] + ' ' + period.jy + ' · بیمارستان سینا</div></div>';
        html += '<div class="meta"><div>' + new Date().toLocaleString('fa-IR') + '</div><div style="font-family:monospace;margin-top:2px">NABZ-DR-' + today.replace(/\//g,'') + '</div></div></div>';

        html += '<div class="stats">';
        html += '<div class="stat total"><div class="v">' + (totalPresent + totalLate + totalAbsent + totalWait) + '</div><div class="l">کل شیفت</div></div>';
        html += '<div class="stat present"><div class="v">' + totalPresent + '</div><div class="l">حاضر</div></div>';
        html += '<div class="stat late"><div class="v">' + totalLate + '</div><div class="l">تأخیر</div></div>';
        html += '<div class="stat absent"><div class="v">' + totalAbsent + '</div><div class="l">غیبت</div></div>';
        html += '</div>';

        // جدول هر بخش
        html += '<table><thead><tr><th style="width:20%">بخش</th><th style="width:10%">شیفت</th><th>حاضر</th><th>در انتظار</th><th>تأخیر</th><th>غیبت</th><th style="width:35%">نام‌ها</th></tr></thead><tbody>';

        for (var wIdx = 0; wIdx < wards.length; wIdx++) {
          var w = wards[wIdx];
          var wd = byWard[w.id];
          if (!wd || !wd.total) continue;
          var shiftsList = ['M', 'E', 'N'];
          var firstShift = true;
          for (var sIdx = 0; sIdx < shiftsList.length; sIdx++) {
            var sh = shiftsList[sIdx];
            var arr = wd.shifts[sh] || [];
            if (!arr.length) continue;
            var present = arr.filter(function(x){ return x.state === 'checked_in' || x.state === 'checked_out'; }).length;
            var late = arr.filter(function(x){ return x.state === 'late'; }).length;
            var absent = arr.filter(function(x){ return x.state === 'absent'; }).length;
            var wait = arr.filter(function(x){ return !x.state || x.state === 'scheduled'; }).length;

            var rowCls = present === arr.length ? 'present-row' : late > 0 ? 'late-row' : absent > 0 ? 'absent-row' : '';
            html += '<tr class="' + rowCls + '">';
            if (firstShift) {
              html += '<td class="ward-name" rowspan="' + shiftsList.filter(function(s){ return (wd.shifts[s] || []).length > 0; }).length + '">' + w.label + '</td>';
              firstShift = false;
            }
            html += '<td><b>' + SH[sh] + '</b></td>';
            html += '<td style="color:#16a34a;font-weight:900">' + present + '</td>';
            html += '<td style="color:#3b82f6">' + wait + '</td>';
            html += '<td style="color:#d97706;font-weight:900">' + late + '</td>';
            html += '<td style="color:#dc2626;font-weight:900">' + absent + '</td>';
            var nameList = arr.map(function(x) {
              var icon = x.state === 'checked_in' || x.state === 'checked_out' ? '✓' : x.state === 'late' ? '⚠' : x.state === 'absent' ? '✗' : '·';
              return icon + ' ' + x.name + (x.reason ? ' (' + x.reason + ')' : '');
            }).join(' · ');
            html += '<td class="name">' + nameList + '</td>';
            html += '</tr>';
          }
        }
        html += '</tbody></table>';

        html += '<div class="sig"><div><div class="sig-line">سوپروایزر شیفت</div></div>';
        html += '<div><div class="sig-line">مترون</div></div>';
        html += '<div><div class="sig-line">تاریخ تأیید</div></div></div>';

        html += '</body></html>';

        var wOpen = window.open('', '_blank');
        if (!wOpen) { alert('پاپ‌آپ مسدود است'); return; }
        wOpen.document.open(); wOpen.document.write(html); wOpen.document.close();
        setTimeout(function() { try { wOpen.focus(); wOpen.print(); } catch (e) { alert('Ctrl+P'); } }, 500);
        NABZ._toast('✅ گزارش روزانه آماده شد');
      } catch (e) {
        console.error('[sa-adv] printDailyReport:', e);
        alert('خطا: ' + e.message);
      }
    };

    // ═══════════════════════════════════════════════════════
    //  تزریق دکمه‌ها در UI
    // ═══════════════════════════════════════════════════════

    // ۱) در داشبورد اصلی — دکمه‌های PDF کامل و گزارش روزانه
    var origHome = Sa._home;
    if (origHome) {
      Sa._home = async function() {
        var html = await origHome.call(this);
        // اضافه کردن کارت مافوق تخصصی قبل از آخرین بخش (تولید همه)
        var extraCard = '<div class="sec-hd"><span>🔬 گزارش‌های پیشرفته</span></div>';
        extraCard += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">';
        extraCard += '<button class="btn" style="padding:16px;display:flex;flex-direction:column;gap:6px;align-items:center;border-color:var(--primary)" onclick="NABZ.sa.printAllWards()">';
        extraCard += '<span style="font-size:22px">📚</span><span style="font-size:11px;font-weight:800">PDF کامل همه بخش‌ها</span>';
        extraCard += '<span style="font-size:9px;color:var(--fg-2);text-align:center">۳۵ فایل در یک PDF</span></button>';
        extraCard += '<button class="btn" style="padding:16px;display:flex;flex-direction:column;gap:6px;align-items:center;border-color:var(--ok)" onclick="NABZ.sa.printDailyReport()">';
        extraCard += '<span style="font-size:22px">📋</span><span style="font-size:11px;font-weight:800">گزارش روزانه</span>';
        extraCard += '<span style="font-size:9px;color:var(--fg-2);text-align:center">حضور امروز همه بخش‌ها</span></button>';
        extraCard += '</div>';

        // درج قبل از "🚀 تولید همه بخش‌ها"
        var anchor = '<div class="sec-hd"><span>🚀 تولید همه بخش‌ها</span></div>';
        if (html.indexOf(anchor) >= 0) {
          html = html.replace(anchor, extraCard + anchor);
        } else {
          html = html + extraCard;
        }
        return html;
      };
    }

    // ۲) در تب چیدمان بخش — دکمه مقایسه سناریو
    var origSolveTab = Sa._solveTab;
    if (origSolveTab) {
      Sa._solveTab = async function(wid) {
        var html = await origSolveTab.call(this, wid);
        // درج بعد از دکمه تولید
        var anchor = '<button class="btn btn-primary btn-block" style="padding:16px;font-size:14px" onclick="NABZ.sa.runSolve(' + wid + ')">🚀 تولید برنامه</button>';
        if (html.indexOf(anchor) >= 0) {
          html = html.replace(anchor, anchor +
            '<button class="btn btn-block" style="margin-top:8px;padding:14px;font-size:13px;border-color:var(--primary);color:var(--primary)" onclick="NABZ.sa.compareScenarios(' + wid + ')">🔬 مقایسه ۴ سناریو</button>');
        }
        return html;
      };
    }

    console.log('[sa-adv] ✓ مقایسه سناریو + PDF کامل + گزارش روزانه');
  });

  console.log('[sa-adv] loaded');
})();
