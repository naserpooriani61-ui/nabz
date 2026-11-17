(function() {
  'use strict';
  if (!window.NABZ || !NABZ.fac) { console.warn('[p2] NABZ.fac not ready'); return; }
  var FAC = NABZ.fac;

  FAC._renderOverview = function() {
    var d = FAC._cache.overview || {};
    var el = document.getElementById('facTabContent');
    if (!el) return;
    var h = '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:12px;font-weight:900" onclick="NABZ.fac._newWard()">بخش جدید +</button>';
    var wards = d.wards || [];
    if (!wards.length) {
      h += '<div class="empty" style="padding:30px">هنوز بخشی نساخته‌اید. از تب «قالب‌ها» شروع کنید.</div>';
    } else {
      wards.forEach(function(w) {
        var occ = w.occupancy || 0;
        var cls = occ >= 90 ? 'dng' : occ >= 75 ? 'warn' : 'ok';
        var closed = w.isClosed ? ' <span class="pill dng">تعطیل</span>' : '';
        h += '<div class="card" style="padding:12px;margin-bottom:6px">';
        h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
        h += '<div style="flex:1;min-width:0">';
        h += '<div style="font-weight:900;font-size:13px">' + FAC._esc(w.label) + closed + '</div>';
        h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">' + FAC._esc(w.code) + ' / ' + FAC._esc(w.group || '') + ' / ' + FAC._esc(w.headNurse || '-') + '</div>';
        if (w.isClosed && w.closedReason) h += '<div style="font-size:10px;color:var(--dng);margin-top:2px">تعطیل: ' + FAC._esc(w.closedReason) + '</div>';
        h += '</div>';
        h += '<div style="text-align:left"><span class="pill ' + cls + '">' + occ + '%</span></div>';
        h += '</div>';
        h += '<div class="progress" style="margin-top:8px;height:4px"><div class="progress-fill ' + cls + '" style="width:' + occ + '%"></div></div>';
        h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:8px;font-size:10px">';
        h += '<div style="text-align:center"><div style="font-weight:900;color:var(--ok)">' + ((w.statuses && w.statuses.available) || 0) + '</div><div style="color:var(--fg-2)">آزاد</div></div>';
        h += '<div style="text-align:center"><div style="font-weight:900;color:var(--dng)">' + ((w.statuses && w.statuses.occupied) || 0) + '</div><div style="color:var(--fg-2)">اشغال</div></div>';
        h += '<div style="text-align:center"><div style="font-weight:900;color:var(--warn)">' + ((w.statuses && w.statuses.cleaning) || 0) + '</div><div style="color:var(--fg-2)">نظافت</div></div>';
        h += '<div style="text-align:center"><div style="font-weight:900;color:var(--info)">' + ((w.statuses && w.statuses.maintenance) || 0) + '</div><div style="color:var(--fg-2)">تعمیر</div></div>';
        h += '</div>';
        h += '<div style="display:flex;gap:4px;margin-top:8px">';
        h += '<button class="btn btn-sm" style="flex:1;padding:5px;font-size:10px" onclick="NABZ.fac._editWard(\'' + w.code + '\')">ویرایش</button>';
        h += '<button class="btn btn-sm" style="flex:1;padding:5px;font-size:10px" onclick="NABZ.fac._viewWardBeds(\'' + w.code + '\')">تخت‌ها</button>';
        if (w.isClosed) h += '<button class="btn btn-sm" style="flex:1;padding:5px;font-size:10px;color:var(--ok)" onclick="NABZ.fac._openWard(\'' + w.code + '\')">بازگشایی</button>';
        else h += '<button class="btn btn-sm" style="flex:1;padding:5px;font-size:10px;color:var(--dng)" onclick="NABZ.fac._closeWard(\'' + w.code + '\')">تعطیلی</button>';
        h += '</div></div>';
      });
    }
    el.innerHTML = h;
  };

  FAC._newWard = function() {
    var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">بخش جدید</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">X</button></div>';
    h += '<div class="wf-field"><label>نام بخش *</label><input type="text" id="wLabel" placeholder="ICU داخلی"></div>';
    h += '<div class="wf-field"><label>کد (خودکار اگر خالی)</label><input type="text" id="wCode" placeholder="ICU_INT" style="font-family:monospace"></div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
    h += '<div class="wf-field"><label>نوع</label><select id="wType"><option value="ward">بستری</option><option value="icu">ICU</option><option value="ccu">CCU</option><option value="surgical">جراحی</option><option value="emergency">اورژانس</option><option value="neuro">نورو</option><option value="oncology">انکولوژی</option><option value="isolation">ایزولاسیون</option><option value="vip">VIP</option><option value="clinic">درمانگاه</option></select></div>';
    h += '<div class="wf-field"><label>گروه</label><select id="wGroup"><option value="internal">داخلی</option><option value="critical">ویژه</option><option value="surgical">جراحی</option><option value="neuro">نورو</option><option value="emergency">اورژانس</option><option value="oncology">انکولوژی</option><option value="special">ویژه</option><option value="vip">VIP</option></select></div>';
    h += '</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
    h += '<div class="wf-field"><label>تعداد تخت</label><input type="number" id="wBeds" value="10" min="0" max="200"></div>';
    h += '<div class="wf-field"><label>تلفن</label><input type="text" id="wPhone"></div>';
    h += '</div>';
    h += '<label style="display:flex;gap:6px;padding:8px;background:var(--bg-2);border-radius:6px;margin:8px 0;font-size:11.5px;cursor:pointer"><input type="checkbox" id="wCreateBeds" checked style="width:16px;height:16px">ساخت خودکار تخت‌ها</label>';
    h += '<div class="wf-field"><label>توضیحات</label><textarea id="wNotes" rows="2"></textarea></div>';
    h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.fac._saveWard(null)">ساخت</button>';
    FAC._open(h);
  };

  FAC._editWard = async function(code) {
    try {
      var r = await FAC._api('/api/fac/wards/' + code);
      var w = r.ward;
      var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">ویرایش ' + FAC._esc(w.label) + '</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">X</button></div>';
      h += '<div class="wf-field"><label>نام</label><input type="text" id="wLabel" value="' + FAC._esc(w.label) + '"></div>';
      h += '<div class="wf-field"><label>کد</label><input type="text" value="' + FAC._esc(w.code) + '" readonly style="background:var(--bg-3);font-family:monospace"></div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
      h += '<div class="wf-field"><label>نوع</label><select id="wType">';
      ['ward','icu','ccu','surgical','emergency','neuro','oncology','isolation','vip','clinic'].forEach(function(t) {
        h += '<option value="' + t + '"' + (w.type === t ? ' selected' : '') + '>' + t + '</option>';
      });
      h += '</select></div>';
      h += '<div class="wf-field"><label>گروه</label><select id="wGroup">';
      ['internal','critical','surgical','neuro','emergency','oncology','special','vip','admin'].forEach(function(g) {
        h += '<option value="' + g + '"' + (w.group === g ? ' selected' : '') + '>' + g + '</option>';
      });
      h += '</select></div>';
      h += '</div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
      h += '<div class="wf-field"><label>تعداد برنامه‌ریزی</label><input type="number" id="wBeds" value="' + (w.bedsPlanned || 0) + '"></div>';
      h += '<div class="wf-field"><label>تلفن</label><input type="text" id="wPhone" value="' + FAC._esc(w.phone || '') + '"></div>';
      h += '</div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
      h += '<div class="wf-field"><label>سرپرستار</label><input type="text" id="wHeadName" value="' + FAC._esc(w.headNurseName || '') + '"></div>';
      h += '<div class="wf-field"><label>داخلی</label><input type="text" id="wExt" value="' + FAC._esc(w.extension || '') + '"></div>';
      h += '</div>';
      h += '<div class="wf-field"><label>توضیحات</label><textarea id="wNotes" rows="2">' + FAC._esc(w.notes || '') + '</textarea></div>';
      h += '<div style="display:flex;gap:6px;margin-top:12px;margin-bottom:20px">';
      h += '<button class="btn btn-primary" style="flex:2;padding:14px;font-weight:900" onclick="NABZ.fac._saveWard(\'' + w.code + '\')">ذخیره</button>';
      h += '<button class="btn" style="flex:1;padding:14px;color:var(--dng);border-color:var(--dng)" onclick="NABZ.fac._deleteWard(\'' + w.code + '\')">حذف</button>';
      h += '</div>';
      FAC._closeAll();
      FAC._open(h);
    } catch (e) { alert('خطا: ' + e.message); }
  };

  FAC._saveWard = async function(code) {
    var body = {
      label: document.getElementById('wLabel').value.trim(),
      type: document.getElementById('wType').value,
      group: document.getElementById('wGroup').value,
      bedsPlanned: parseInt(document.getElementById('wBeds').value) || 0,
      phone: document.getElementById('wPhone').value,
      headNurseName: document.getElementById('wHeadName') ? document.getElementById('wHeadName').value : null,
      extension: document.getElementById('wExt') ? document.getElementById('wExt').value : null,
      notes: document.getElementById('wNotes').value
    };
    if (!body.label) return alert('نام الزامی');
    if (!code) {
      body.code = document.getElementById('wCode').value.trim() || undefined;
      body.createBeds = document.getElementById('wCreateBeds').checked;
    }
    try {
      var r = code
        ? await FAC._api('/api/fac/wards/' + code, { method:'PUT', body: JSON.stringify(body) })
        : await FAC._api('/api/fac/wards', { method:'POST', body: JSON.stringify(body) });
      NABZ._toast('ذخیره شد' + (r.bedsCreated ? ' / ' + r.bedsCreated + ' تخت' : ''));
      FAC._closeAll();
      FAC.show(null, null);
    } catch (e) { alert('خطا: ' + e.message); }
  };

  FAC._deleteWard = async function(code) {
    if (!confirm('حذف بخش ' + code + '؟')) return;
    try {
      await FAC._api('/api/fac/wards/' + code, { method:'DELETE' });
      NABZ._toast('حذف شد');
      FAC._closeAll();
      FAC.show(null, null);
    } catch (e) { alert('خطا: ' + e.message); }
  };

  FAC._closeWard = async function(code) {
    var r = prompt('دلیل تعطیلی:');
    if (!r || r.length < 3) return;
    try {
      await FAC._api('/api/fac/wards/' + code + '/close', { method:'POST', body: JSON.stringify({ reason: r }) });
      NABZ._toast('بخش تعطیل شد');
      FAC.show(null, null);
    } catch (e) { alert('خطا: ' + e.message); }
  };

  FAC._openWard = async function(code) {
    if (!confirm('بازگشایی بخش؟')) return;
    try {
      await FAC._api('/api/fac/wards/' + code + '/open', { method:'POST', body:'{}' });
      NABZ._toast('بخش باز شد');
      FAC.show(null, null);
    } catch (e) { alert('خطا: ' + e.message); }
  };

  console.log('[facilities-ui] p2 loaded');
})();
