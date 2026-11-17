
// ═══════════════════════════════════════════════════════════
//  NABZ — Roster Shift UI (grid builder + my schedule)
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var SHIFT_FA = { M:'صبح', E:'عصر', N:'شب', L:'لانگ', EN:'عصر+شب', H24:'۲۴', OFF:'آف' };
  var SHIFT_ICO = { M:'🌅', E:'🌆', N:'🌙', L:'📏', EN:'🌗', H24:'⏰' };
  var SHIFT_COL = { M:'#3b82f6', E:'#f59e0b', N:'#8b5cf6', L:'#10b981', EN:'#a855f7', H24:'#ef4444' };
  var SHIFT_MIN = { M:420, E:420, N:780, L:780, EN:1140, H24:1440 };
  var ALL_SHIFTS = ['M','E','N','L','EN','H24'];
  var WDAYS = ['ش','ی','د','س','چ','پ','ج'];
  var MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  var REQ_FA = { MORNING:'صبح', EVENING:'عصر', NIGHT:'شب', LONG:'لانگ', EVENING_NIGHT:'عصر+شب', H24:'۲۴ساعته', LEAVE:'مرخصی', SICK:'استعلاجی', HALF_M:'نیم‌روز صبح', HALF_E:'نیم‌روز عصر', REST:'استراحت' };

  var R = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _ui: { wardCode: null, periodId: null, grid: null, loading: false },

    async show(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        var period = await R._api('/api/sa/period').catch(function() { return null; });
        if (period) this._ui.periodId = period.id;

        if (!this._ui.wardCode) {
          var user = NABZ.state.user;
          var wards = await R._api('/api/sa/wards');
          var active = (wards.items || []).filter(function(w) { return !w.isManagement; });
          if (user && user.ward) {
            var match = active.find(function(w) { return w.code === user.ward; });
            if (match) this._ui.wardCode = match.code;
          }
          if (!this._ui.wardCode && active.length) this._ui.wardCode = active[0].code;
        }

        if (!this._ui.wardCode) {
          m.innerHTML = '<div class="empty">شما به بخشی تخصیص نیافته‌اید</div>';
          return;
        }
        await this._load();
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + R._esc(e.message) + '</div>';
      }
    },

    async _load() {
      if (this._ui.loading) return;
      this._ui.loading = true;
      var m = document.getElementById('content');
      try {
        var url = '/api/roster/grid?wardCode=' + encodeURIComponent(this._ui.wardCode);
        if (this._ui.periodId) url += '&periodId=' + encodeURIComponent(this._ui.periodId);
        var grid = await R._api(url);
        this._ui.grid = grid;
        this._ui.periodId = grid.period.id;
        this._render();
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + R._esc(e.message) + '</div>';
      } finally {
        this._ui.loading = false;
      }
    },

    _render() {
      var g = this._ui.grid;
      if (!g) return;
      var m = document.getElementById('content');

      var h = '';
      h += '<div class="sec-hd"><span>📅 چیدمان شیفت — ' + R._esc(g.ward.label) + '</span>';
      h += '<span class="rd-mini">' + MONTHS[g.period.jm - 1] + ' ' + g.period.jy + '</span></div>';

      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">';
      h += '<button class="btn btn-sm" style="padding:8px 12px;font-size:11px" onclick="NABZ.rosterUI.navMonth(-1)">◀ ماه قبل</button>';
      h += '<button class="btn btn-sm" style="padding:8px 12px;font-size:11px" onclick="NABZ.rosterUI.navMonth(1)">ماه بعد ▶</button>';
      h += '<button class="btn btn-primary btn-sm" style="padding:8px 12px;font-size:11px;font-weight:900" onclick="NABZ.rosterUI.action(\'auto\')">🚀 تولید خودکار</button>';
      h += '<button class="btn btn-sm" style="padding:8px 12px;font-size:11px" onclick="NABZ.rosterUI.action(\'copy\')">📋 کپی ماه قبل</button>';
      h += '<button class="btn btn-sm" style="padding:8px 12px;font-size:11px" onclick="NABZ.rosterUI.action(\'fromprefs\')">💜 از ترجیحات</button>';
      h += '<button class="btn btn-sm" style="padding:8px 12px;font-size:11px;color:var(--dng)" onclick="NABZ.rosterUI.action(\'clear\')">🗑 پاک کردن</button>';
      h += '<button class="btn btn-sm" style="padding:8px 12px;font-size:11px" onclick="NABZ.rosterUI.action(\'lock\')">🔒 قفل ماه</button>';
      h += '<button class="btn btn-sm" style="padding:8px 12px;font-size:11px" onclick="NABZ.rosterUI.printMonth()">🖨 PDF</button>';
      h += '</div>';

      var totalAssigns = 0;
      Object.keys(g.stats).forEach(function(sid) { totalAssigns += g.stats[sid].shifts; });
      h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">';
      h += '<div class="rd-stat ok"><div class="v">' + g.staff.length + '</div><div class="l">پرسنل</div></div>';
      h += '<div class="rd-stat"><div class="v">' + totalAssigns + '</div><div class="l">کل شیفت</div></div>';
      h += '<div class="rd-stat info"><div class="v">' + g.period.ml + '</div><div class="l">روز ماه</div></div>';
      h += '<div class="rd-stat warn"><div class="v">' + Object.keys(g.prefGrid).length + '</div><div class="l">ترجیح</div></div>';
      h += '</div>';

      if (!g.staff.length) {
        h += '<div class="empty">پرسنلی در این بخش نیست</div>';
        m.innerHTML = h;
        return;
      }

      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;font-size:10px">';
      ALL_SHIFTS.forEach(function(s) {
        h += '<span style="display:inline-flex;align-items:center;gap:3px"><span style="width:10px;height:10px;background:' + SHIFT_COL[s] + ';border-radius:2px"></span>' + SHIFT_ICO[s] + ' ' + SHIFT_FA[s] + '</span>';
      });
      h += '</div>';

      h += '<div style="overflow-x:auto;overflow-y:visible;-webkit-overflow-scrolling:touch;border:1px solid var(--border);border-radius:10px;background:var(--bg-2)">';
      h += '<table class="roster-grid" style="border-collapse:collapse;font-size:10px;min-width:' + (120 + g.days.length * 32 + 100) + 'px">';

      h += '<thead><tr>';
      h += '<th style="position:sticky;right:0;background:var(--bg-3);padding:6px 4px;font-size:10px;text-align:right;min-width:120px;z-index:2;border-bottom:1px solid var(--border)">پرسنل</th>';
      var self = this;
      g.days.forEach(function(d) {
        var isFri = d.isFri ? 'background:rgba(239,68,68,0.08);' : '';
        h += '<th style="' + isFri + 'padding:4px 2px;font-size:9px;font-weight:800;text-align:center;min-width:28px;border-bottom:1px solid var(--border)">';
        h += '<div>' + d.jd + '</div>';
        h += '<div style="font-size:8px;color:var(--fg-2)">' + WDAYS[d.wd] + '</div>';
        h += '</th>';
      });
      h += '<th style="position:sticky;left:0;background:var(--bg-3);padding:6px 4px;font-size:9px;text-align:center;min-width:90px;z-index:2;border-bottom:1px solid var(--border)">جمع</th>';
      h += '</tr></thead><tbody>';

      g.staff.forEach(function(s) {
        h += '<tr>';
        h += '<td style="position:sticky;right:0;background:var(--bg-2);padding:6px 4px;font-size:11px;font-weight:800;border-bottom:1px solid var(--border);z-index:1;text-align:right">';
        h += self._esc(s.name);
        h += '<div style="font-size:9px;color:var(--fg-2);font-weight:400">' + (s.category || '') + '</div>';
        h += '</td>';

        g.days.forEach(function(d) {
          var key = s.id + '|' + d.date;
          var shifts = (g.assignGrid[key] || []).map(function(x) { return x.shift; });
          var pref = g.prefGrid[key];
          var isFri = d.isFri ? 'background:rgba(239,68,68,0.06);' : '';

          h += '<td style="' + isFri + 'padding:1px;text-align:center;border-bottom:1px solid var(--border);border-right:1px solid rgba(0,0,0,0.1);cursor:pointer" onclick="NABZ.rosterUI.openCell(\'' + s.id + '\',\'' + d.date + '\')">';

          if (shifts.length) {
            shifts.forEach(function(sh) {
              h += '<div style="background:' + SHIFT_COL[sh] + ';color:#fff;border-radius:3px;padding:2px 1px;font-size:9px;font-weight:900;margin:1px 0">' + SHIFT_ICO[sh] + '</div>';
            });
          } else if (pref) {
            var prefColor = pref.requestType === 'LEAVE' ? '#ef4444' : pref.requestType === 'SICK' ? '#f59e0b' : pref.requestType === 'REST' ? '#64748b' : '#06b6d4';
            h += '<div style="background:transparent;border:1px dashed ' + prefColor + ';color:' + prefColor + ';border-radius:3px;padding:1px;font-size:8px;font-weight:800">' + (pref.requestType === 'LEAVE' ? 'م' : pref.requestType === 'SICK' ? 'S' : pref.requestType === 'REST' ? 'ر' : '●') + '</div>';
          } else {
            h += '<div style="color:var(--fg-3);font-size:9px">—</div>';
          }
          h += '</td>';
        });

        var st = g.stats[s.id] || { shifts:0, hours:0, nights:0, fridays:0 };
        h += '<td style="position:sticky;left:0;background:var(--bg-2);padding:4px;font-size:9px;text-align:center;border-bottom:1px solid var(--border);z-index:1">';
        h += '<div style="font-weight:900;color:var(--primary)">' + st.shifts + '</div>';
        h += '<div style="color:var(--fg-2)">' + Math.round(st.hours) + 'h</div>';
        if (st.nights) h += '<div style="color:#8b5cf6;font-size:8px">🌙' + st.nights + '</div>';
        h += '</td>';
        h += '</tr>';
      });

      h += '</tbody></table></div>';

      var pendingPrefs = [];
      Object.keys(g.prefGrid).forEach(function(k) {
        var p = g.prefGrid[k];
        if (p.status === 'submitted') pendingPrefs.push({ key: k, pref: p });
      });
      if (pendingPrefs.length) {
        h += '<div class="sec-hd" style="margin-top:14px"><span>📥 درخواست‌های در انتظار</span><span class="rd-mini">' + pendingPrefs.length + '</span></div>';
        h += '<button class="btn btn-primary btn-block" style="padding:10px;margin-bottom:8px;font-size:12px" onclick="NABZ.rosterUI.showPrefs()">📋 مدیریت ترجیحات</button>';
      }

      m.innerHTML = h;
    },

    navMonth(dir) {
      var g = this._ui.grid;
      if (!g) return;
      var jy = g.period.jy, jm = g.period.jm + dir;
      if (jm > 12) { jm = 1; jy++; }
      if (jm < 1) { jm = 12; jy--; }
      this._ui.periodId = jy + '-' + String(jm).padStart(2, '0');
      this._load();
    },

    async openCell(staffId, date) {
      var g = this._ui.grid;
      if (!g) return;
      var staff = g.staff.find(function(s) { return String(s.id) === String(staffId); });
      if (!staff) return;
      var key = staffId + '|' + date;
      var current = (g.assignGrid[key] || []).map(function(x) { return x.shift; });
      var pref = g.prefGrid[key];

      var sheet = document.createElement('div');
      sheet.className = 'bs-backdrop';
      sheet.onclick = function(e) { if (e.target === sheet) sheet.remove(); };

      var html = '<div class="bs-handle"></div>';
      html += '<div class="bs-hd"><div class="bs-title">' + R._esc(staff.name) + ' — ' + date + '</div>';
      html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      if (pref) {
        html += '<div class="hint info" style="margin-bottom:12px">درخواست: <b>' + (REQ_FA[pref.requestType] || pref.requestType) + '</b> — وضعیت: ' + pref.status + '</div>';
      }

      html += '<div style="font-size:11px;font-weight:900;color:var(--fg-2);margin-bottom:6px">شیفت‌های فعال</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">';
      ALL_SHIFTS.forEach(function(sh) {
        var isOn = current.indexOf(sh) >= 0;
        html += '<button class="roster-shift-btn" data-shift="' + sh + '" onclick="NABZ.rosterUI._toggleShift(this)" ';
        html += 'style="padding:10px;background:' + (isOn ? SHIFT_COL[sh] : 'var(--bg-2)') + ';color:' + (isOn ? '#fff' : 'var(--fg)') + ';border:1.5px solid ' + (isOn ? SHIFT_COL[sh] : 'var(--border-2)') + ';border-radius:8px;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer">';
        html += '<div style="font-size:16px">' + SHIFT_ICO[sh] + '</div>';
        html += '<div>' + SHIFT_FA[sh] + '</div>';
        html += '<div style="font-size:9px;opacity:0.8">' + (SHIFT_MIN[sh] / 60) + 'h</div>';
        html += '</button>';
      });
      html += '</div>';

      html += '<div style="display:flex;gap:6px;margin-bottom:12px">';
      html += '<button class="btn btn-sm" style="flex:1;padding:8px;font-size:11px" onclick="NABZ.rosterUI._preset(\'M\')">🌅 صبح فقط</button>';
      html += '<button class="btn btn-sm" style="flex:1;padding:8px;font-size:11px" onclick="NABZ.rosterUI._preset(\'N\')">🌙 شب فقط</button>';
      html += '<button class="btn btn-sm" style="flex:1;padding:8px;font-size:11px;color:var(--dng)" onclick="NABZ.rosterUI._preset(\'OFF\')">🚫 آف</button>';
      html += '</div>';

      html += '<button class="btn btn-primary btn-block" style="padding:14px;font-weight:900" onclick="NABZ.rosterUI._saveCell(\'' + staffId + '\',\'' + date + '\')">✅ ذخیره</button>';

      var c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '90vh';
      c.innerHTML = html;
      c._selectedShifts = current.slice();
      sheet.appendChild(c);
      document.body.appendChild(sheet);
      requestAnimationFrame(function() { sheet.classList.add('show'); });
    },

    _toggleShift(btn) {
      var sh = btn.dataset.shift;
      var sheet = btn.closest('.bs-sheet');
      if (!sheet) return;
      var arr = sheet._selectedShifts || [];
      var idx = arr.indexOf(sh);
      if (idx >= 0) {
        arr.splice(idx, 1);
        btn.style.background = 'var(--bg-2)';
        btn.style.color = 'var(--fg)';
        btn.style.borderColor = 'var(--border-2)';
      } else {
        if (sh === 'L' || sh === 'EN' || sh === 'H24') {
          arr.length = 0;
          sheet.querySelectorAll('.roster-shift-btn').forEach(function(b) {
            b.style.background = 'var(--bg-2)';
            b.style.color = 'var(--fg)';
            b.style.borderColor = 'var(--border-2)';
          });
        }
        arr.push(sh);
        btn.style.background = SHIFT_COL[sh];
        btn.style.color = '#fff';
        btn.style.borderColor = SHIFT_COL[sh];
      }
      sheet._selectedShifts = arr;
    },

    _preset(sh) {
      var sheet = document.querySelector('.bs-sheet');
      if (!sheet) return;
      sheet._selectedShifts = sh === 'OFF' ? [] : [sh];
      sheet.querySelectorAll('.roster-shift-btn').forEach(function(b) {
        var on = sh !== 'OFF' && b.dataset.shift === sh;
        b.style.background = on ? SHIFT_COL[b.dataset.shift] : 'var(--bg-2)';
        b.style.color = on ? '#fff' : 'var(--fg)';
        b.style.borderColor = on ? SHIFT_COL[b.dataset.shift] : 'var(--border-2)';
      });
    },

    async _saveCell(staffId, date) {
      var sheet = document.querySelector('.bs-sheet');
      if (!sheet) return;
      var shifts = sheet._selectedShifts || [];
      try {
        await R._api('/api/roster/cell', {
          method: 'POST',
          body: JSON.stringify({
            wardCode: this._ui.wardCode,
            periodId: this._ui.periodId,
            staffId: parseInt(staffId),
            date: date,
            shifts: shifts
          })
        });
        sheet.closest('.bs-backdrop').remove();
        NABZ._toast(shifts.length ? '✅ ذخیره شد' : '✅ آف شد');
        await this._load();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async action(type) {
      var labels = { auto:'تولید خودکار', copy:'کپی از ماه قبل', fromprefs:'اعمال ترجیحات', clear:'پاک کردن', lock:'قفل ماه' };
      if (!confirm(labels[type] + ' — ادامه؟')) return;
      try {
        NABZ._toast('در حال انجام...');
        var endpoint = '/api/roster/' + ({ auto: 'auto-generate', copy: 'copy-previous', fromprefs: 'from-prefs', clear: 'clear', lock: 'lock' }[type]);
        var body = { wardCode: this._ui.wardCode, periodId: this._ui.periodId };
        if (type === 'lock') body.locked = true;
        var r = await R._api(endpoint, { method: 'POST', body: JSON.stringify(body) });
        var msg = r.saved ? (r.saved + ' تخصیص') : (r.removed ? (r.removed + ' حذف') : 'انجام شد');
        NABZ._toast('✅ ' + msg);
        await this._load();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async showPrefs() {
      try {
        var prefs = await R._api('/api/roster/prefs?wardCode=' + encodeURIComponent(this._ui.wardCode) + '&periodId=' + encodeURIComponent(this._ui.periodId) + '&status=submitted');
        var items = prefs.items || [];
        var staff = this._ui.grid ? this._ui.grid.staff : [];
        var staffMap = {};
        staff.forEach(function(s) { staffMap[s.id] = s; });

        var sheet = document.createElement('div');
        sheet.className = 'bs-backdrop';
        sheet.onclick = function(e) { if (e.target === sheet) sheet.remove(); };

        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">📥 ترجیحات در انتظار — ' + items.length + '</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        if (!items.length) html += '<div class="empty">درخواستی نیست</div>';
        else {
          items.forEach(function(p) {
            var s = staffMap[p.staffId];
            html += '<div style="padding:8px;background:var(--bg-2);border-radius:8px;margin-bottom:6px">';
            html += '<div style="font-weight:900;font-size:12px">' + (s ? s.name : 'پرسنل #' + p.staffId) + ' — ' + p.date + '</div>';
            html += '<div style="font-size:11px;color:var(--fg-2);margin-bottom:6px">' + (REQ_FA[p.requestType] || p.requestType) + '</div>';
            html += '<div style="display:flex;gap:4px">';
            html += '<button class="btn btn-ok btn-sm" style="flex:1;padding:4px;font-size:10px" onclick="NABZ.rosterUI._approvePref(\'' + p.id + '\',true)">✓ تأیید</button>';
            html += '<button class="btn btn-dng btn-sm" style="flex:1;padding:4px;font-size:10px" onclick="NABZ.rosterUI._approvePref(\'' + p.id + '\',false)">✗ رد</button>';
            html += '</div></div>';
          });
        }

        var c = document.createElement('div');
        c.className = 'bs-sheet';
        c.style.maxHeight = '90vh';
        c.innerHTML = html;
        sheet.appendChild(c);
        document.body.appendChild(sheet);
        requestAnimationFrame(function() { sheet.classList.add('show'); });
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _approvePref(id, approve) {
      try {
        await R._api('/api/roster/pref/' + id + '/review', {
          method: 'POST',
          body: JSON.stringify({ approve: approve })
        });
        NABZ._toast(approve ? '✅ تأیید شد' : '❌ رد شد');
        document.querySelectorAll('.bs-backdrop').forEach(function(b) { b.remove(); });
        await this._load();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    printMonth() {
      var g = this._ui.grid;
      if (!g) return;
      var html = '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">';
      html += '<title>چیدمان شیفت — ' + g.ward.label + '</title>';
      html += '<style>';
      html += '@page{size:A4 landscape;margin:6mm}';
      html += 'body{font-family:"Vazirmatn",Tahoma,sans-serif;font-size:8px;padding:0;margin:0}';
      html += '.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #0891b2;padding-bottom:6px;margin-bottom:8px}';
      html += '.hdr h1{font-size:15px;color:#0c4a6e;margin:0}';
      html += '.hdr .meta{font-size:9px;color:#666;text-align:left}';
      html += 'table{width:100%;border-collapse:collapse;font-size:7.5px}';
      html += 'th{background:#e0f2fe;color:#0c4a6e;padding:3px 1px;border:1px solid #94a3b8;font-weight:900;text-align:center}';
      html += 'td{border:1px solid #cbd5e1;padding:2px 1px;text-align:center;font-size:7.5px}';
      html += '.name{background:#f8fafc;text-align:right;padding:2px 4px;font-weight:800;font-size:8px}';
      html += '.fri td{background:#fef2f2}';
      html += '.stats{background:#f0f9ff;text-align:center;font-size:7px;font-weight:900;color:#0c4a6e}';
      html += '</style></head><body>';
      html += '<div class="hdr"><div><h1>📅 چیدمان شیفت — ' + g.ward.label + '</h1>';
      html += '<div style="font-size:9px;color:#666;margin-top:2px">' + MONTHS[g.period.jm - 1] + ' ' + g.period.jy + '</div></div>';
      html += '<div class="meta">تولید: ' + new Date().toLocaleString('fa-IR') + '</div></div>';
      html += '<table><thead><tr><th style="width:120px">پرسنل</th>';
      g.days.forEach(function(d) {
        var cls = d.isFri ? ' style="background:#fee2e2"' : '';
        html += '<th' + cls + '>' + d.jd + '<br><span style="font-size:6px">' + WDAYS[d.wd] + '</span></th>';
      });
      html += '<th style="width:60px">جمع</th></tr></thead><tbody>';

      g.staff.forEach(function(s) {
        html += '<tr>';
        html += '<td class="name">' + s.name + '<div style="font-size:6.5px;color:#666">' + (s.category || '') + '</div></td>';
        g.days.forEach(function(d) {
          var key = s.id + '|' + d.date;
          var shifts = (g.assignGrid[key] || []).map(function(x) { return x.shift; });
          var isFri = d.isFri ? ' class="fri"' : '';
          html += '<td' + isFri + ' style="padding:0">';
          if (shifts.length) {
            shifts.forEach(function(sh) { html += '<span style="display:inline-block;padding:1px 2px;margin:0.5px;font-size:6px;font-weight:900;background:' + SHIFT_COL[sh] + ';color:#fff;border-radius:2px">' + SHIFT_ICO[sh] + '</span>'; });
          } else {
            html += '·';
          }
          html += '</td>';
        });
        var st = g.stats[s.id] || {};
        html += '<td class="stats">' + (st.shifts || 0) + '<br>' + Math.round(st.hours || 0) + 'h</td>';
        html += '</tr>';
      });

      html += '</tbody></table>';
      html += '<div style="margin-top:8px;font-size:8px;color:#64748b;text-align:center">NABZ · ' + new Date().toISOString() + '</div>';
      html += '</body></html>';

      var w = window.open('', '_blank');
      if (!w) return alert('پاپ‌آپ مسدود است');
      w.document.open(); w.document.write(html); w.document.close();
      setTimeout(function() { try { w.focus(); w.print(); } catch(_) { alert('Ctrl+P'); } }, 500);
    },

    async mySchedule() {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        var period = await R._api('/api/sa/period').catch(function() { return null; });
        var periodId = period ? period.id : null;
        var d = await R._api('/api/roster/my' + (periodId ? '?periodId=' + periodId : ''));
        var days = d.days || [];

        var h = '<div class="sec-hd"><span>📅 برنامه من</span><span class="rd-mini">' + d.period + '</span></div>';

        h += '<div class="card" style="padding:10px">';
        h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:6px">';
        WDAYS.forEach(function(w) { h += '<div style="text-align:center;font-size:9px;font-weight:900;color:var(--fg-2);padding:4px 0">' + w + '</div>'; });
        h += '</div>';
        h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">';
        if (days.length) {
          for (var i = 0; i < days[0].wd; i++) h += '<div></div>';
        }
        days.forEach(function(dd) {
          var bg = dd.isFri ? 'rgba(239,68,68,0.08)' : 'var(--bg-2)';
          var border = dd.isFri ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border)';
          h += '<div style="background:' + bg + ';border:' + border + ';border-radius:6px;padding:4px;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px">';
          h += '<div style="font-size:11px;font-weight:900">' + dd.jd + '</div>';
          if (dd.shifts && dd.shifts.length) {
            dd.shifts.forEach(function(sh) {
              h += '<div style="background:' + SHIFT_COL[sh] + ';color:#fff;border-radius:3px;padding:1px 4px;font-size:8px;font-weight:900;width:100%;text-align:center">' + SHIFT_ICO[sh] + '</div>';
            });
          }
          h += '</div>';
        });
        h += '</div></div>';

        var totalShifts = (d.assignments || []).length;
        var totalMin = (d.assignments || []).reduce(function(s, a) { return s + (a.actualMinutes || 0); }, 0);
        var nights = (d.assignments || []).filter(function(a) { return a.shift === 'N' || a.shift === 'EN'; }).length;
        h += '<div class="rd-stats" style="grid-template-columns:repeat(3,1fr);margin-top:14px">';
        h += '<div class="rd-stat ok"><div class="v">' + totalShifts + '</div><div class="l">شیفت</div></div>';
        h += '<div class="rd-stat"><div class="v">' + Math.round(totalMin / 60) + 'h</div><div class="l">کارکرد</div></div>';
        h += '<div class="rd-stat info"><div class="v">' + nights + '</div><div class="l">شب</div></div>';
        h += '</div>';

        h += '<button class="btn btn-block" style="padding:12px;margin-top:12px" onclick="NABZ.rosterUI.printMyCard()">🖨 چاپ کارت شیفت</button>';

        m.innerHTML = h;
        NABZ.state.current = null;
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + R._esc(e.message) + '</div>';
      }
    },

    printMyCard() {
      var m = document.getElementById('content');
      var user = NABZ.state.user;
      var printHtml = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>کارت شیفت</title>';
      printHtml += '<style>@page{size:A4;margin:15mm}body{font-family:Vazirmatn,Tahoma,sans-serif;padding:20px}h1{font-size:20px;color:#0891b2}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:center;font-size:12px}th{background:#e0f2fe}</style>';
      printHtml += '</head><body><h1>🫀 کارت شیفت — ' + (user ? user.fullName : '') + '</h1>';
      printHtml += '<p>' + new Date().toLocaleDateString('fa-IR') + '</p>';
      printHtml += m.innerHTML.replace(/<button[^>]*>.*?<\/button>/g, '').replace(/class="[^"]*"/g, '');
      printHtml += '</body></html>';
      var w = window.open('', '_blank');
      if (!w) return alert('پاپ‌آپ مسدود است');
      w.document.open(); w.document.write(printHtml); w.document.close();
      setTimeout(function() { try { w.focus(); w.print(); } catch(_) { alert('Ctrl+P'); } }, 500);
    }
  };

  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 60) return console.warn('[roster-ui] timeout');
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.rosterUI = R;
    if (NABZ.registerKind) {
      NABZ.registerKind('roster_builder', function(p, d) { return R.show(p, d); });
      NABZ.registerKind('roster_my', function(p, d) { return R.mySchedule(); });
    }
    console.log('[roster-ui] loaded ✓ — grid builder + my schedule');
  });
})();
