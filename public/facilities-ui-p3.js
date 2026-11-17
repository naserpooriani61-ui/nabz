(function() {
  'use strict';
  if (!window.NABZ || !NABZ.fac) { console.warn('[p3] NABZ.fac not ready'); return; }
  var FAC = NABZ.fac;

  FAC._loadTab = function(tab) {
    var el = document.getElementById('facTabContent');
    if (!el) return;
    if (tab === 'beds') return FAC._loadBeds(el);
    if (typeof FAC._loadCleaning === 'function' && tab === 'cleaning') return FAC._loadCleaning(el);
    if (typeof FAC._loadMaintenance === 'function' && tab === 'maintenance') return FAC._loadMaintenance(el);
    if (typeof FAC._loadTemplates === 'function' && tab === 'templates') return FAC._loadTemplates(el);
    if (typeof FAC._loadCapacity === 'function' && tab === 'capacity') return FAC._loadCapacity(el);
    el.innerHTML = '<div class="empty">این تب هنوز نصب نشده — C4 را اجرا کن</div>';
  };

  FAC._loadBeds = async function(el) {
    el = el || document.getElementById('facTabContent');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:20px"><span class="spinner"></span></div>';
    try {
      var params = [];
      if (FAC._bedsFilter.ward) params.push('wardCode=' + encodeURIComponent(FAC._bedsFilter.ward));
      if (FAC._bedsFilter.status) params.push('status=' + encodeURIComponent(FAC._bedsFilter.status));
      if (FAC._bedsFilter.q) params.push('q=' + encodeURIComponent(FAC._bedsFilter.q));
      var qs = params.length ? '?' + params.join('&') : '';
      var results = await Promise.all([
        FAC._api('/api/fac/beds' + qs),
        FAC._api('/api/clinical/patients').catch(function() { return { items: [] }; })
      ]);
      var r = results[0], pr = results[1];
      FAC._cache.beds = r.items || [];
      FAC._cache.patients = {};
      (pr.items || []).forEach(function(p) { FAC._cache.patients[p.id] = { name: p.firstName + ' ' + p.lastName, diagnosis: p.diagnosis }; });
      var wards = (FAC._cache.overview || {}).wards || [];

      var h = '';
      h += '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">';
      h += '<select onchange="NABZ.fac._bedsFilter.ward=this.value;NABZ.fac._loadBeds()" style="flex:1;min-width:120px;padding:8px;background:var(--bg-2);border:1px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:11px">';
      h += '<option value="">همه بخش‌ها</option>';
      wards.forEach(function(w) {
        h += '<option value="' + w.code + '"' + (FAC._bedsFilter.ward === w.code ? ' selected' : '') + '>' + FAC._esc(w.label) + '</option>';
      });
      h += '</select>';
      h += '<select onchange="NABZ.fac._bedsFilter.status=this.value;NABZ.fac._loadBeds()" style="flex:1;min-width:100px;padding:8px;background:var(--bg-2);border:1px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:11px">';
      ['', 'available', 'occupied', 'cleaning', 'maintenance', 'blocked'].forEach(function(s) {
        var lbl = s === '' ? 'همه وضعیت' : s === 'available' ? 'آزاد' : s === 'occupied' ? 'اشغال' : s === 'cleaning' ? 'نظافت' : s === 'maintenance' ? 'تعمیر' : 'مسدود';
        h += '<option value="' + s + '"' + (FAC._bedsFilter.status === s ? ' selected' : '') + '>' + lbl + '</option>';
      });
      h += '</select>';
      h += '</div>';

      h += '<input type="search" placeholder="جستجوی شماره تخت..." value="' + FAC._esc(FAC._bedsFilter.q) + '" oninput="NABZ.fac._bedsFilter.q=this.value;NABZ.fac._loadBeds()" style="width:100%;padding:8px;margin-bottom:10px;background:var(--bg-2);border:1px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:12px">';

      h += '<div style="display:flex;gap:6px;margin-bottom:10px">';
      h += '<button class="btn btn-sm" style="flex:1;padding:8px;font-size:11px" onclick="NABZ.fac._bulkCreate()">ساخت انبوه تخت</button>';
      if (FAC._selectedBeds.size > 0) {
        h += '<button class="btn btn-sm" style="flex:1;padding:8px;font-size:11px;color:var(--dng);border-color:var(--dng)" onclick="NABZ.fac._bulkStatus(\'maintenance\')">' + FAC._selectedBeds.size + ' تخت → تعمیر</button>';
      }
      h += '</div>';

      if (!FAC._cache.beds.length) {
        h += '<div class="empty">تختی با این فیلتر یافت نشد</div>';
      } else {
        h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px">';
        FAC._cache.beds.forEach(function(b) {
          var cls = b.status === 'occupied' ? 'dng' : b.status === 'available' ? 'ok' : b.status === 'cleaning' ? 'warn' : b.status === 'maintenance' ? 'info' : '';
          var icon = b.status === 'occupied' ? '👤' : b.status === 'cleaning' ? '🧹' : b.status === 'maintenance' ? '🔧' : b.status === 'blocked' ? '⛔' : '✓';
          var sel = FAC._selectedBeds.has(b.id);
          h += '<div class="card" style="padding:8px;text-align:center;border-color:var(--' + (cls || 'border') + ');border-width:' + (sel ? '2px' : '1px') + ';cursor:pointer;position:relative" onclick="NABZ.fac._openBed(\'' + b.id + '\')">';
          if (b.status === 'available' || b.status === 'maintenance' || b.status === 'blocked') {
            h += '<div style="position:absolute;top:2px;right:2px" onclick="event.stopPropagation();NABZ.fac._toggleBedSel(\'' + b.id + '\')"><input type="checkbox" ' + (sel ? 'checked' : '') + ' style="width:16px;height:16px;pointer-events:none"></div>';
          }
          h += '<div style="font-size:10px;font-weight:900;color:var(--primary)">' + FAC._esc(b.bedNumber) + '</div>';
          h += '<div style="font-size:16px;margin-top:2px">' + icon + '</div>';
          h += '<div style="font-size:9px;color:var(--fg-2)">' + FAC._esc(b.wardCode) + '</div>';
          if (b.patientId) {
            var pt = FAC._cache.patients[b.patientId];
            h += '<div style="font-size:9px;color:var(--fg-2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + FAC._esc(pt ? pt.name : '-') + '</div>';
          }
          h += '</div>';
        });
        h += '</div>';
      }
      el.innerHTML = h;
    } catch (e) {
      el.innerHTML = '<div class="empty">خطا: ' + FAC._esc(e.message) + '</div>';
    }
  };

  FAC._toggleBedSel = function(id) {
    if (FAC._selectedBeds.has(id)) FAC._selectedBeds.delete(id);
    else FAC._selectedBeds.add(id);
    FAC._loadBeds();
  };

  FAC._bulkStatus = async function(status) {
    if (FAC._selectedBeds.size === 0) return;
    var reason = status === 'maintenance' ? prompt('دلیل تعمیر:') : '';
    if (status === 'maintenance' && !reason) return;
    try {
      var r = await FAC._api('/api/fac/beds/bulk-status', {
        method: 'POST',
        body: JSON.stringify({ bedIds: Array.from(FAC._selectedBeds), status: status, reason: reason })
      });
      NABZ._toast(r.updated + ' تخت به‌روز شد');
      FAC._selectedBeds.clear();
      FAC._loadBeds();
    } catch (e) { alert('خطا: ' + e.message); }
  };

  FAC._bulkCreate = function() {
    var wards = (FAC._cache.overview || {}).wards || [];
    if (!wards.length) return alert('اول یک بخش بسازید');
    var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">ساخت انبوه تخت</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">X</button></div>';
    h += '<div class="wf-field"><label>بخش</label><select id="bcWard">';
    wards.forEach(function(w) { h += '<option value="' + w.code + '"' + (FAC._bedsFilter.ward === w.code ? ' selected' : '') + '>' + FAC._esc(w.label) + '</option>'; });
    h += '</select></div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">';
    h += '<div class="wf-field"><label>تعداد</label><input type="number" id="bcCount" value="10" min="1" max="50"></div>';
    h += '<div class="wf-field"><label>شروع</label><input type="number" id="bcStart" value="1" min="1"></div>';
    h += '<div class="wf-field"><label>پیشوند</label><input type="text" id="bcPrefix" placeholder="خودکار"></div>';
    h += '</div>';
    h += '<div class="wf-field"><label>نوع تخت</label><select id="bcType"><option value="regular">عادی</option><option value="icu">ICU</option><option value="monitored">پایش‌شده</option><option value="isolation">ایزولاسیون</option><option value="vip">VIP</option></select></div>';
    h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.fac._doBulkCreate()">ایجاد</button>';
    FAC._open(h);
  };

  FAC._doBulkCreate = async function() {
    try {
      var r = await FAC._api('/api/fac/beds/bulk', {
        method: 'POST',
        body: JSON.stringify({
          wardCode: document.getElementById('bcWard').value,
          count: parseInt(document.getElementById('bcCount').value),
          startAt: parseInt(document.getElementById('bcStart').value),
          prefix: document.getElementById('bcPrefix').value || undefined,
          type: document.getElementById('bcType').value
        })
      });
      NABZ._toast(r.created + ' تخت ساخته شد');
      FAC._closeAll();
      FAC._loadBeds();
    } catch (e) { alert('خطا: ' + e.message); }
  };

  FAC._openBed = async function(id) {
    var bed = (FAC._cache.beds || []).find(function(x) { return x.id === id; });
    if (!bed) {
      try {
        var r = await FAC._api('/api/fac/beds');
        FAC._cache.beds = r.items || [];
        bed = FAC._cache.beds.find(function(x) { return x.id === id; });
      } catch (e) { return alert('خطا: ' + e.message); }
    }
    if (!bed) return alert('تخت یافت نشد');
    var pt = bed.patientId ? FAC._cache.patients[bed.patientId] : null;
    var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">' + FAC._esc(bed.bedNumber) + '</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">X</button></div>';
    h += '<div class="card" style="margin-bottom:10px;padding:10px">';
    h += '<div style="font-size:11.5px">بخش: <b>' + FAC._esc(bed.wardCode) + '</b></div>';
    h += '<div style="font-size:11.5px">وضعیت: <b>' + FAC._esc(bed.status) + '</b></div>';
    h += '<div style="font-size:11px;color:var(--fg-2)">نوع: ' + FAC._esc(bed.type || 'regular') + (bed.isCritical ? ' / ویژه' : '') + (bed.isIsolation ? ' / ایزوله' : '') + '</div>';
    if (pt) h += '<div style="font-size:12px;color:var(--dng);margin-top:6px;font-weight:800">بیمار: ' + FAC._esc(pt.name) + '</div>';
    if (pt && pt.diagnosis) h += '<div style="font-size:10.5px;color:var(--fg-2)">' + FAC._esc(pt.diagnosis) + '</div>';
    h += '</div>';
    if (bed.status === 'available') {
      h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:6px;font-weight:900" onclick="NABZ.fac._assignBed(\'' + bed.id + '\')">تخصیص بیمار</button>';
    }
    if (bed.status === 'occupied') {
      h += '<button class="btn btn-ok btn-block" style="padding:12px;margin-bottom:6px;font-weight:900" onclick="NABZ.fac._releaseBed(\'' + bed.id + '\')">آزادسازی → صف نظافت</button>';
    }
    if (bed.status === 'cleaning') {
      h += '<button class="btn btn-ok btn-block" style="padding:12px;margin-bottom:6px;font-weight:900" onclick="NABZ.fac._completeCleaning(\'' + bed.id + '\')">نظافت تمام شد</button>';
    }
    if (bed.status === 'maintenance') {
      h += '<button class="btn btn-ok btn-block" style="padding:12px;margin-bottom:6px;font-weight:900" onclick="NABZ.fac._returnFromMaint(\'' + bed.id + '\')">بازگشت به سرویس</button>';
    }
    if (bed.status !== 'occupied') {
      h += '<button class="btn btn-block" style="padding:10px;margin-bottom:6px;color:var(--dng);border-color:var(--dng)" onclick="NABZ.fac._delBed(\'' + bed.id + '\')">حذف تخت</button>';
    }
    h += '<button class="btn btn-block" style="padding:10px;margin-bottom:20px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
    FAC._closeAll();
    FAC._open(h);
  };

  FAC._assignBed = async function(id) {
    try {
      var p = await FAC._api('/api/clinical/patients');
      var active = (p.items || []).filter(function(x) { return ['in_care','admitted'].indexOf(x.status) >= 0; });
      var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">تخصیص بیمار به تخت</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">X</button></div>';
      if (!active.length) h += '<div class="empty">بیماری بستری نیست</div>';
      else active.forEach(function(pat) {
        h += '<button class="btn btn-block" style="text-align:right;padding:10px;margin-bottom:4px;display:flex;flex-direction:column;align-items:stretch" onclick="NABZ.fac._doAssign(\'' + id + '\',\'' + pat.id + '\')">';
        h += '<div style="font-weight:900;font-size:12px">' + FAC._esc(pat.firstName + ' ' + pat.lastName) + '</div>';
        h += '<div style="font-size:10px;color:var(--fg-2)">' + FAC._esc(pat.wardCode || '') + ' / ' + FAC._esc(pat.diagnosis || '') + '</div>';
        h += '</button>';
      });
      FAC._closeAll();
      FAC._open(h);
    } catch (e) { alert('خطا: ' + e.message); }
  };

  FAC._doAssign = async function(bedId, patientId) {
    try {
      await FAC._api('/api/fac/beds/' + bedId + '/assign', { method: 'POST', body: JSON.stringify({ patientId: patientId }) });
      NABZ._toast('تخصیص یافت');
      FAC._closeAll();
      FAC.show(null, null);
    } catch (e) { alert('خطا: ' + e.message); }
  };

  FAC._releaseBed = async function(id) {
    if (!confirm('آزادسازی تخت؟ → صف نظافت')) return;
    try {
      await FAC._api('/api/fac/beds/' + id + '/release', { method: 'POST', body: '{}' });
      NABZ._toast('آزاد شد → صف نظافت');
      FAC._closeAll();
      FAC.show(null, null);
    } catch (e) { alert('خطا: ' + e.message); }
  };

  FAC._completeCleaning = async function(id) {
    try {
      await FAC._api('/api/fac/cleaning/' + id + '/complete', { method: 'POST', body: '{}' });
      NABZ._toast('نظافت تمام شد، تخت آزاد');
      FAC._closeAll();
      FAC.show(null, null);
    } catch (e) { alert('خطا: ' + e.message); }
  };

  FAC._delBed = async function(id) {
    if (!confirm('حذف تخت؟')) return;
    try {
      await FAC._api('/api/fac/beds/' + id, { method: 'DELETE' });
      NABZ._toast('حذف شد');
      FAC._closeAll();
      FAC.show(null, null);
    } catch (e) { alert('خطا: ' + e.message); }
  };

  console.log('[facilities-ui] p3 loaded');
})();
