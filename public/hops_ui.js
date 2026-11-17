// ═══════════════════════════════════════════════════════════
//  NABZ — Hospital Operations UI
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var HUI = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _closeAll: function() { document.querySelectorAll('.bs-backdrop').forEach(function(e) { e.remove(); }); },
    _openSheet: function(html) {
      var s = document.createElement('div');
      s.className = 'bs-backdrop';
      s.onclick = function(e) { if (e.target === s) s.remove(); };
      var c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '96vh';
      c.innerHTML = html;
      s.appendChild(c);
      document.body.appendChild(s);
      requestAnimationFrame(function() { s.classList.add('show'); });
      return { sheet: s, content: c };
    },

    // ═══════════════════════════════════════════════════
    //  WARD CONFIG
    // ═══════════════════════════════════════════════════
    async showWards() {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        var [wards, cfg] = await Promise.all([
          HUI._api('/api/hops/wards'),
          HUI._api('/api/hops/config')
        ]);
        HUI._config = cfg;
        var items = wards.items || [];
        var byGroup = {};
        items.forEach(function(w) {
          var g = w.group || 'internal';
          if (!byGroup[g]) byGroup[g] = [];
          byGroup[g].push(w);
        });
        var GL = { critical:'💔 مراقبت ویژه', surgical:'🔪 جراحی', internal:'🏥 داخلی', neuro:'🧠 نورولوژی', oncology:'🎗️ آنکولوژی', emergency:'🚨 اورژانس', special:'✨ ویژه', vip:'⭐ VIP', admin:'🏛 اداری' };

        var h = '<div class="sec-hd"><span>🏗️ مدیریت بخش‌ها</span><span class="rd-mini">' + items.length + '</span></div>';
        h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:12px" onclick="NABZ.hopsUI.newWard()">➕ بخش جدید</button>';
        h += '<div class="rd-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">';
        h += '<div class="rd-stat"><div class="v">' + items.length + '</div><div class="l">بخش</div></div>';
        h += '<div class="rd-stat info"><div class="v">' + (cfg.wardTypes || []).length + '</div><div class="l">نوع</div></div>';
        h += '<div class="rd-stat ok"><div class="v">' + (cfg.acuityLevels || []).length + '</div><div class="l">سطح مراقبت</div></div>';
        h += '</div>';

        Object.keys(GL).forEach(function(g) {
          if (!byGroup[g]) return;
          h += '<div style="font-size:12px;font-weight:900;color:var(--fg-2);margin:14px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--border)">' + GL[g] + '</div>';
          byGroup[g].forEach(function(w) {
            var t = (cfg.wardTypes || []).find(function(x) { return x.code === w.type; }) || {};
            h += '<div class="row lo">';
            h += '<div class="row-hd"><div class="row-title">' + (t.icon || '🏥') + ' ' + HUI._esc(w.label) + '</div>';
            h += '<span class="pill info">' + (t.label || w.type) + '</span></div>';
            h += '<div class="row-meta">کد: <code>' + HUI._esc(w.code) + '</code> · ' + w.bedsPlanned + ' تخت · سرپرستار: ' + HUI._esc(w.headNurseName || w.headNurse || '—') + '</div>';
            h += '<div style="display:flex;gap:4px;margin-top:6px">';
            h += '<button class="btn btn-sm" style="flex:1;padding:6px;font-size:11px" onclick="event.stopPropagation();NABZ.hopsUI.editWard(\'' + w.id + '\')">✎ ویرایش</button>';
            h += '<button class="btn btn-sm" style="flex:1;padding:6px;font-size:11px" onclick="event.stopPropagation();NABZ.hopsUI.manageBeds(\'' + w.code + '\',\'' + HUI._esc(w.label) + '\')">🛏 تخت‌ها</button>';
            h += '</div>';
            h += '</div>';
          });
        });

        m.innerHTML = h;
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + HUI._esc(e.message) + '</div>';
      }
    },

    async newWard() {
      var cfg = HUI._config || await HUI._api('/api/hops/config');
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">➕ بخش جدید</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>نام بخش *</label><input type="text" id="hwLabel" placeholder="مثلاً: ICU داخلی"></div>';
      h += '<div class="wf-field"><label>کد (اختیاری — خودکار)</label><input type="text" id="hwCode" placeholder="ICU_INT"></div>';
      h += '<div class="wf-field"><label>نوع بخش *</label><select id="hwType">';
      cfg.wardTypes.forEach(function(t) { h += '<option value="' + t.code + '">' + t.icon + ' ' + t.label + ' (' + t.bedsDefault + ' تخت پیش‌فرض)</option>'; });
      h += '</select></div>';
      h += '<div class="wf-field"><label>گروه</label><select id="hwGroup">';
      ['critical','surgical','internal','neuro','oncology','emergency','special','vip'].forEach(function(g) {
        h += '<option value="' + g + '">' + g + '</option>';
      });
      h += '</select></div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
      h += '<div class="wf-field"><label>تعداد تخت *</label><input type="number" id="hwBeds" value="20" min="1" max="100"></div>';
      h += '<div class="wf-field"><label>طبقه</label><input type="text" id="hwFloor" placeholder="۳"></div>';
      h += '</div>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.hopsUI._createWard()">✅ ساخت</button>';
      HUI._openSheet(h);
    },

    async editWard(id) {
      var list = await HUI._api('/api/hops/wards');
      var w = (list.items || []).find(function(x) { return x.id === id; });
      if (!w) return alert('بخش یافت نشد');
      var cfg = HUI._config || await HUI._api('/api/hops/config');
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">✎ ویرایش ' + HUI._esc(w.label) + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>نام</label><input type="text" id="ewLabel" value="' + HUI._esc(w.label) + '"></div>';
      h += '<div class="wf-field"><label>کد</label><input type="text" id="ewCode" value="' + HUI._esc(w.code) + '"></div>';
      h += '<div class="wf-field"><label>نوع</label><select id="ewType">';
      cfg.wardTypes.forEach(function(t) { h += '<option value="' + t.code + '"' + (w.type === t.code ? ' selected' : '') + '>' + t.icon + ' ' + t.label + '</option>'; });
      h += '</select></div>';
      h += '<div class="wf-field"><label>گروه</label><select id="ewGroup">';
      ['critical','surgical','internal','neuro','oncology','emergency','special','vip','admin'].forEach(function(g) { h += '<option value="' + g + '"' + (w.group === g ? ' selected' : '') + '>' + g + '</option>'; });
      h += '</select></div>';
      h += '<div class="wf-field"><label>تعداد تخت</label><input type="number" id="ewBeds" value="' + (w.bedsPlanned || 20) + '"></div>';
      h += '<div class="wf-field"><label>سرپرستار</label><input type="text" id="ewHead" value="' + HUI._esc(w.headNurseName || w.headNurse || '') + '"></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.hopsUI._updateWard(\'' + id + '\')">💾 ذخیره</button>';
      HUI._openSheet(h);
    },

    async _createWard() {
      var label = document.getElementById('hwLabel').value.trim();
      if (!label) return alert('نام الزامی');
      try {
        var w = await HUI._api('/api/hops/wards', {
          method:'POST',
          body: JSON.stringify({
            label: label,
            code: document.getElementById('hwCode').value.trim() || undefined,
            type: document.getElementById('hwType').value,
            group: document.getElementById('hwGroup').value,
            bedsPlanned: parseInt(document.getElementById('hwBeds').value) || 20,
            floor: document.getElementById('hwFloor').value
          })
        });
        NABZ._toast('✅ بخش ساخته شد');
        HUI._closeAll();
        // Offer to create beds
        if (confirm('آیا ' + w.bedsPlanned + ' تخت ساخته شود؟')) {
          HUI._bulkBeds(w.code, w.label, w.bedsPlanned);
        } else {
          HUI.showWards();
        }
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _updateWard(id) {
      try {
        await HUI._api('/api/hops/wards/' + id, {
          method:'PUT',
          body: JSON.stringify({
            label: document.getElementById('ewLabel').value,
            code: document.getElementById('ewCode').value,
            type: document.getElementById('ewType').value,
            group: document.getElementById('ewGroup').value,
            bedsPlanned: parseInt(document.getElementById('ewBeds').value),
            headNurseName: document.getElementById('ewHead').value
          })
        });
        NABZ._toast('✅ ذخیره شد');
        HUI._closeAll();
        HUI.showWards();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  BED MANAGEMENT
    // ═══════════════════════════════════════════════════
    async manageBeds(wardCode, wardLabel) {
      var beds = await HUI._api('/api/hops/beds?wardCode=' + wardCode);
      var items = beds.items || [];
      var h = '<div class="sec-hd"><span>🛏️ تخت‌های ' + HUI._esc(wardLabel) + '</span><span class="rd-mini">' + items.length + '</span></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:12px" onclick="NABZ.hopsUI.bulkBedsForm(\'' + wardCode + '\',\'' + HUI._esc(wardLabel) + '\')">➕ افزودن تخت (دسته‌ای)</button>';
      
      // Status summary
      var byStatus = { available:0, occupied:0, cleaning:0, maintenance:0, blocked:0 };
      items.forEach(function(b) { byStatus[b.status] = (byStatus[b.status] || 0) + 1; });
      h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">';
      h += '<div class="rd-stat ok"><div class="v">' + (byStatus.available||0) + '</div><div class="l">آزاد</div></div>';
      h += '<div class="rd-stat dng"><div class="v">' + (byStatus.occupied||0) + '</div><div class="l">اشغال</div></div>';
      h += '<div class="rd-stat warn"><div class="v">' + ((byStatus.cleaning||0) + (byStatus.maintenance||0)) + '</div><div class="l">تمیز/تعمیر</div></div>';
      h += '<div class="rd-stat"><div class="v">' + items.length + '</div><div class="l">کل</div></div>';
      h += '</div>';
      
      h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px;margin-bottom:12px">';
      items.forEach(function(b) {
        var cls = b.status === 'occupied' ? 'dng' : b.status === 'available' ? 'ok' : b.status === 'cleaning' ? 'warn' : '';
        h += '<div class="card" style="padding:8px;text-align:center;border-color:var(--' + (cls || 'border') + ')" onclick="NABZ.hopsUI.editBed(\'' + b.id + '\')">';
        h += '<div style="font-weight:900;font-size:12px;color:var(--primary)">' + HUI._esc(b.bedNumber) + '</div>';
        h += '<div style="font-size:9px;color:var(--fg-2);margin-top:2px">' + (b.isCritical ? '🔴' : '') + (b.hasMonitor ? ' 📺' : '') + '</div>';
        h += '<span class="pill ' + cls + '" style="font-size:8px;margin-top:2px">' + (b.status === 'occupied' ? 'اشغال' : b.status === 'available' ? 'آزاد' : b.status === 'cleaning' ? 'تمیز' : b.status) + '</span>';
        h += '</div>';
      });
      h += '</div>';
      
      h += '<button class="btn btn-block" style="padding:12px" onclick="NABZ.hopsUI.showWards()">← بازگشت</button>';
      document.getElementById('content').innerHTML = h;
    },

    bulkBedsForm: function(wardCode, wardLabel) {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">➕ افزودن تخت — ' + HUI._esc(wardLabel) + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>تعداد *</label><input type="number" id="bbCount" value="10" min="1" max="100"></div>';
      h += '<div class="wf-field"><label>شماره شروع</label><input type="number" id="bbStart" value="1" min="1"></div>';
      h += '<div class="wf-field"><label>پیشوند</label><input type="text" id="bbPrefix" value="' + wardCode + '-' + '"></div>';
      h += '<div class="wf-field"><label>نوع تخت</label><select id="bbType">';
      h += '<option value="regular">عادی</option>';
      h += '<option value="isolation">ایزولاسیون</option>';
      h += '<option value="icu">ویژه</option>';
      h += '<option value="monitored">پایش‌شده</option>';
      h += '</select></div>';
      h += '<div style="display:flex;gap:8px;margin:8px 0">';
      h += '<label><input type="checkbox" id="bbCritical"> تخت ویژه</label>';
      h += '<label><input type="checkbox" id="bbO2" checked> اکسیژن</label>';
      h += '<label><input type="checkbox" id="bbMonitor"> مانیتور</label>';
      h += '</div>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.hopsUI._bulkBeds(\'' + wardCode + '\',\'' + HUI._esc(wardLabel) + '\',null)">✅ ایجاد</button>';
      HUI._openSheet(h);
    },

    async _bulkBeds(wardCode, wardLabel, presetCount) {
      var count, start, prefix, type, critical, o2, monitor;
      if (presetCount) {
        count = presetCount; start = 1; prefix = wardCode + '-'; type = 'regular';
        critical = false; o2 = true; monitor = false;
      } else {
        count = parseInt(document.getElementById('bbCount').value) || 10;
        start = parseInt(document.getElementById('bbStart').value) || 1;
        prefix = document.getElementById('bbPrefix').value || (wardCode + '-');
        type = document.getElementById('bbType').value;
        critical = document.getElementById('bbCritical').checked;
        o2 = document.getElementById('bbO2').checked;
        monitor = document.getElementById('bbMonitor').checked;
      }
      try {
        var r = await HUI._api('/api/hops/beds/bulk', {
          method:'POST',
          body: JSON.stringify({
            wardCode: wardCode, wardLabel: wardLabel,
            count: count, startAt: start, prefix: prefix,
            type: type, isCritical: critical, hasO2: o2, hasMonitor: monitor
          })
        });
        NABZ._toast('✅ ' + r.created + ' تخت ساخته شد');
        HUI._closeAll();
        HUI.manageBeds(wardCode, wardLabel);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async editBed(bedId) {
      var beds = await HUI._api('/api/hops/beds');
      var b = (beds.items || []).find(function(x) { return x.id === bedId; });
      if (!b) return alert('تخت یافت نشد');
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">🛏️ ' + HUI._esc(b.bedNumber) + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="card" style="margin-bottom:12px"><div style="font-size:12px;color:var(--fg-2)">بخش: ' + HUI._esc(b.wardCode) + '</div>';
      h += '<div style="font-size:12px;color:var(--fg-2)">وضعیت: <b>' + b.status + '</b></div></div>';
      h += '<div class="wf-field"><label>تغییر وضعیت</label><select id="ebStatus">';
      ['available','occupied','cleaning','maintenance','blocked'].forEach(function(s) {
        h += '<option value="' + s + '"' + (b.status === s ? ' selected' : '') + '>' + s + '</option>';
      });
      h += '</select></div>';
      if (b.status === 'available') {
        h += '<button class="btn btn-dng btn-block" style="padding:12px;margin-top:8px" onclick="NABZ.hopsUI._deleteBed(\'' + b.id + '\',\'' + b.wardCode + '\')">🗑 حذف تخت</button>';
      }
      h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:8px" onclick="NABZ.hopsUI._updateBed(\'' + b.id + '\',\'' + b.wardCode + '\')">💾 ذخیره</button>';
      HUI._openSheet(h);
    },

    async _updateBed(id, wardCode) {
      try {
        await HUI._api('/api/hops/beds/' + id, {
          method:'PUT',
          body: JSON.stringify({ status: document.getElementById('ebStatus').value })
        });
        NABZ._toast('✅ ذخیره شد');
        HUI._closeAll();
        HUI.manageBeds(wardCode, '');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _deleteBed(id, wardCode) {
      if (!confirm('تخت حذف شود؟')) return;
      try {
        await HUI._api('/api/hops/beds/' + id, { method:'DELETE' });
        NABZ._toast('✅ حذف شد');
        HUI._closeAll();
        HUI.manageBeds(wardCode, '');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  ASSIGNMENT BOARD
    // ═══════════════════════════════════════════════════
    async showAssignment() {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        var wards = await HUI._api('/api/hops/wards');
        var items = (wards.items || []).filter(function(w) { return !w.isManagement; });
        if (!items.length) {
          m.innerHTML = '<div class="empty">بخشی وجود ندارد</div>';
          return;
        }
        var h = '<div class="sec-hd"><span>👩‍⚕️ تخصیص پرستار — بیمار</span></div>';
        h += '<div class="wf-field"><label>بخش</label><select id="asgWard" onchange="NABZ.hopsUI._loadWardSnapshot(this.value)">';
        items.forEach(function(w) { h += '<option value="' + w.code + '">' + HUI._esc(w.label) + '</option>'; });
        h += '</select></div>';
        h += '<div id="asgContent" style="margin-top:12px"><div style="text-align:center;padding:20px"><span class="spinner"></span></div></div>';
        m.innerHTML = h;
        // Load first
        if (items[0]) HUI._loadWardSnapshot(items[0].code);
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + HUI._esc(e.message) + '</div>';
      }
    },

    async _loadWardSnapshot(wardCode) {
      var el = document.getElementById('asgContent');
      if (!el) return;
      el.innerHTML = '<div style="text-align:center;padding:20px"><span class="spinner"></span></div>';
      try {
        var snap = await HUI._api('/api/hops/ward-snapshot?wardCode=' + wardCode);
        HUI._snapshot = snap;
        var h = '';
        
        // Stats
        var s = snap.stats;
        h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">';
        h += '<div class="rd-stat ok"><div class="v">' + s.bedsAvailable + '</div><div class="l">تخت آزاد</div></div>';
        h += '<div class="rd-stat dng"><div class="v">' + s.bedsOccupied + '</div><div class="l">اشغال</div></div>';
        h += '<div class="rd-stat"><div class="v">' + s.patients + '</div><div class="l">بیمار</div></div>';
        h += '<div class="rd-stat ' + (s.unassignedPatients ? 'warn' : 'ok') + '"><div class="v">' + s.unassignedPatients + '</div><div class="l">بدون پرستار</div></div>';
        h += '</div>';
        
        // Acuity distribution
        var ad = s.acuityDist;
        h += '<div class="card" style="margin-bottom:12px"><div class="card-title">📊 سطح مراقبت بیماران</div>';
        h += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">';
        for (var i = 1; i <= 5; i++) {
          var lvl = (HUI._config && HUI._config.acuityLevels || []).find(function(x) { return x.code === i; }) || {};
          h += '<div style="text-align:center;padding:8px;background:var(--bg-3);border-radius:6px">';
          h += '<div style="font-size:20px;font-weight:900;color:var(--' + (lvl.color || 'fg') + ')">' + (ad[i] || 0) + '</div>';
          h += '<div style="font-size:9px;color:var(--fg-2)">' + (lvl.icon || '') + ' L' + i + '</div>';
          h += '</div>';
        }
        h += '</div>';
        if (ad['null']) h += '<div class="hint warn" style="margin-top:8px">⚠️ ' + ad['null'] + ' بیمار بدون سطح مراقبت</div>';
        h += '</div>';
        
        // Assignments
        h += '<div class="sec-hd"><span>👥 پرستاران شیفت امروز</span></div>';
        h += '<button class="btn btn-primary btn-block" style="padding:10px;margin-bottom:8px" onclick="NABZ.hopsUI.newAssignment(\'' + wardCode + '\')">➕ افزودن پرستار</button>';
        if (!snap.assignments.length) {
          h += '<div class="empty">پرستاری تخصیص نیافته</div>';
        } else {
          snap.assignments.forEach(function(a) {
            h += '<div class="card" style="margin-bottom:8px">';
            h += '<div class="row-hd"><div class="row-title">👩‍⚕️ ' + HUI._esc(a.nurseName) + '</div>';
            h += '<span class="pill info">' + (a.shiftType === 'morning' ? 'صبح' : a.shiftType === 'evening' ? 'عصر' : 'شب') + '</span></div>';
            h += '<div class="row-meta">' + (a.patients.length) + '/' + a.maxPatients + ' بیمار · ' + a.nurseCategory + '</div>';
            if (a.patients.length) {
              h += '<div style="margin-top:6px;display:flex;flex-direction:column;gap:4px">';
              a.patients.forEach(function(p) {
                var lvl = p.acuity ? (HUI._config && HUI._config.acuityLevels || []).find(function(x) { return x.code === p.acuity; }) : null;
                h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--bg);border-radius:6px;font-size:11.5px">';
                h += '<span>' + (lvl ? lvl.icon + ' ' : '') + HUI._esc(p.name) + ' <small style="color:var(--fg-2)">· تخت ' + HUI._esc(p.bed) + '</small></span>';
                h += '<button class="btn btn-xs" style="padding:2px 6px;font-size:9px;color:var(--dng)" onclick="NABZ.hopsUI._removePatient(\'' + a.id + '\',\'' + p.id + '\',\'' + wardCode + '\')">✗</button>';
                h += '</div>';
              });
              h += '</div>';
            }
            h += '<button class="btn btn-block" style="margin-top:6px;padding:8px;font-size:11px" onclick="NABZ.hopsUI.assignPatient(\'' + a.id + '\',\'' + wardCode + '\')">➕ افزودن بیمار</button>';
            h += '</div>';
          });
        }
        
        // Unassigned patients
        if (snap.unassignedPatients.length) {
          h += '<div class="sec-hd" style="margin-top:14px"><span>⚠️ بیماران بدون پرستار</span><span class="rd-mini">' + snap.unassignedPatients.length + '</span></div>';
          snap.unassignedPatients.forEach(function(p) {
            var lvl = p.acuity ? (HUI._config && HUI._config.acuityLevels || []).find(function(x) { return x.code === p.acuity; }) : null;
            h += '<div class="row ' + (lvl ? '' : 'md') + '">';
            h += '<div class="row-hd"><div class="row-title">' + (lvl ? lvl.icon + ' ' : '') + HUI._esc(p.name) + '</div>';
            h += '<span class="pill">تخت ' + HUI._esc(p.bed) + '</span></div>';
            h += '<div class="row-meta">' + HUI._esc(p.diagnosis || '') + ' · ' + (p.age || '—') + ' سال</div>';
            h += '</div>';
          });
        }
        
        el.innerHTML = h;
      } catch (e) {
        el.innerHTML = '<div class="empty">خطا: ' + HUI._esc(e.message) + '</div>';
      }
    },

    async newAssignment(wardCode) {
      try {
        var staff = await HUI._api('/api/hops/staff?wardCode=' + wardCode);
        var items = staff.items || [];
        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">➕ افزودن پرستار</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="wf-field"><label>پرستار</label><select id="naNurse">';
        items.forEach(function(s) { h += '<option value="' + s.id + '">' + HUI._esc(s.name) + ' — ' + s.category + '</option>'; });
        h += '</select></div>';
        h += '<div class="wf-field"><label>شیفت</label><select id="naShift">';
        h += '<option value="morning">صبح (07-14)</option>';
        h += '<option value="evening">عصر (14-19)</option>';
        h += '<option value="night">شب (19-07)</option>';
        h += '</select></div>';
        h += '<div class="wf-field"><label>حداکثر بیمار</label><input type="number" id="naMax" value="6" min="1" max="20"></div>';
        h += '<div class="wf-field"><label>نقش</label><select id="naRole">';
        h += '<option value="primary">پرستار اصلی</option>';
        h += '<option value="team_lead">سرتیم</option>';
        h += '<option value="charge">مسئول شیفت</option>';
        h += '</select></div>';
        h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.hopsUI._createAssignment(\'' + wardCode + '\')">✅ افزودن</button>';
        HUI._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _createAssignment(wardCode) {
      try {
        await HUI._api('/api/hops/assignments', {
          method:'POST',
          body: JSON.stringify({
            wardCode: wardCode,
            nurseId: parseInt(document.getElementById('naNurse').value),
            shiftType: document.getElementById('naShift').value,
            maxPatients: parseInt(document.getElementById('naMax').value),
            role: document.getElementById('naRole').value,
            date: new Date().toISOString().slice(0,10)
          })
        });
        NABZ._toast('✅ اضافه شد');
        HUI._closeAll();
        HUI._loadWardSnapshot(wardCode);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async assignPatient(assignmentId, wardCode) {
      var snap = HUI._snapshot;
      if (!snap || !snap.unassignedPatients.length) return alert('بیمار بدون پرستاری نیست');
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">افزودن بیمار</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      snap.unassignedPatients.forEach(function(p) {
        var lvl = p.acuity ? (HUI._config && HUI._config.acuityLevels || []).find(function(x) { return x.code === p.acuity; }) : null;
        h += '<button class="btn btn-block" style="text-align:right;padding:10px;margin-bottom:4px;display:flex;flex-direction:column;align-items:stretch;gap:2px" onclick="NABZ.hopsUI._doAssign(\'' + assignmentId + '\',\'' + p.id + '\',\'' + wardCode + '\')">';
        h += '<div style="font-weight:900">' + (lvl ? lvl.icon + ' ' : '') + HUI._esc(p.name) + '</div>';
        h += '<div style="font-size:10.5px;color:var(--fg-2)">تخت ' + HUI._esc(p.bed) + ' · ' + HUI._esc(p.diagnosis || '') + '</div>';
        h += '</button>';
      });
      HUI._openSheet(h);
    },

    async _doAssign(assignmentId, patientId, wardCode) {
      try {
        await HUI._api('/api/hops/assignments/' + assignmentId + '/patient', {
          method:'POST', body: JSON.stringify({ patientId })
        });
        NABZ._toast('✅ تخصیص شد');
        HUI._closeAll();
        HUI._loadWardSnapshot(wardCode);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _removePatient(assignmentId, patientId, wardCode) {
      try {
        await HUI._api('/api/hops/assignments/' + assignmentId + '/patient/remove', {
          method:'POST', body: JSON.stringify({ patientId })
        });
        NABZ._toast('حذف شد');
        HUI._loadWardSnapshot(wardCode);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══ Bootstrap ═══
    _bootstrap() {
      var waitCount = 0;
      function ready(fn) {
        if (window.NABZ && typeof NABZ.show === 'function') return fn();
        if (++waitCount >= 50) return;
        setTimeout(function() { ready(fn); }, 100);
      }
      ready(function() {
        NABZ.hopsUI = HUI;
        var origShow = NABZ.show;
        NABZ.show = async function(id) {
          var p = NABZ.state.panels.find(function(x) { return x.id === id; });
          if (p && p.kind === 'hops_wards') {
            NABZ.state.current = id;
            document.querySelectorAll('.bn-tab').forEach(function(b) { b.classList.remove('on'); });
            return HUI.showWards();
          }
          if (p && p.kind === 'hops_assignment') {
            NABZ.state.current = id;
            document.querySelectorAll('.bn-tab').forEach(function(b) { b.classList.remove('on'); });
            return HUI.showAssignment();
          }
          return origShow.call(NABZ, id);
        };
        console.log('[hops-ui] loaded ✓');
      });
    }
  };

  HUI._bootstrap();
})();
