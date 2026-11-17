(function() {
  'use strict';
  if (!window.NABZ || !NABZ.fac) { console.warn('[p4] NABZ.fac not ready'); return; }
  var FAC = NABZ.fac;

  FAC._loadCleaning = async function(el) {
    el = el || document.getElementById('facTabContent');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:20px"><span class="spinner"></span></div>';
    try {
      var r = await FAC._api('/api/fac/cleaning');
      var h = '';
      if (!r.items.length) {
        h += '<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">✅</div><div style="font-weight:900;margin-top:8px">صف نظافت خالی است</div><div style="font-size:11px;color:var(--fg-2);margin-top:4px">هیچ تختی در انتظار نظافت نیست</div></div>';
      } else {
        h += '<div style="font-size:11px;color:var(--fg-2);margin-bottom:8px">' + r.total + ' تخت در انتظار نظافت</div>';
        r.items.forEach(function(b) {
          var dur = b.cleaningDurationMin || 0;
          var urgency = dur > 60 ? 'dng' : dur > 30 ? 'warn' : 'ok';
          h += '<div class="card" style="padding:10px;margin-bottom:4px;border-right:3px solid var(--' + urgency + ')">';
          h += '<div style="display:flex;justify-content:space-between;align-items:center">';
          h += '<div style="flex:1;min-width:0">';
          h += '<div style="font-weight:900;font-size:12px">' + FAC._esc(b.bedNumber) + '</div>';
          h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">' + FAC._esc(b.wardCode) + (dur ? ' / ' + dur + ' دقیقه در صف' : '') + '</div>';
          h += '</div>';
          h += '<button class="btn btn-sm" style="padding:6px 10px;font-size:10.5px;color:var(--ok);border-color:var(--ok);font-weight:800" onclick="NABZ.fac._completeCleaning(\'' + b.id + '\')">اتمام</button>';
          h += '</div></div>';
        });
      }
      el.innerHTML = h;
    } catch (e) { el.innerHTML = '<div class="empty">خطا: ' + FAC._esc(e.message) + '</div>'; }
  };

  FAC._loadMaintenance = async function(el) {
    el = el || document.getElementById('facTabContent');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:20px"><span class="spinner"></span></div>';
    try {
      var r = await FAC._api('/api/fac/maintenance');
      var h = '';
      if (!r.items.length) {
        h += '<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">✅</div><div style="font-weight:900;margin-top:8px">هیچ تختی در تعمیر نیست</div></div>';
      } else {
        h += '<div style="font-size:11px;color:var(--fg-2);margin-bottom:8px">' + r.total + ' تخت در تعمیر</div>';
        r.items.forEach(function(b) {
          var cls = b.overdue ? 'dng' : 'warn';
          h += '<div class="card" style="padding:10px;margin-bottom:4px;border-color:var(--' + cls + ')">';
          h += '<div style="display:flex;justify-content:space-between;align-items:center">';
          h += '<div style="flex:1;min-width:0">';
          h += '<div style="font-weight:900;font-size:12px">' + FAC._esc(b.bedNumber) + '</div>';
          h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">' + FAC._esc(b.wardCode) + ' / ' + FAC._esc(b.maintenanceReason || 'تعمیر') + '</div>';
          if (b.daysLeft !== null && b.daysLeft !== undefined) {
            h += '<div style="font-size:10px;color:var(--' + (b.overdue ? 'dng' : 'fg-2') + ');margin-top:2px;font-weight:800">' + (b.overdue ? 'گذشته از موعد' : b.daysLeft + ' روز مانده') + '</div>';
          }
          h += '</div>';
          h += '<button class="btn btn-sm" style="padding:6px 10px;font-size:10.5px;color:var(--ok);border-color:var(--ok);font-weight:800" onclick="NABZ.fac._returnFromMaint(\'' + b.id + '\')">بازگشت</button>';
          h += '</div></div>';
        });
      }
      el.innerHTML = h;
    } catch (e) { el.innerHTML = '<div class="empty">خطا: ' + FAC._esc(e.message) + '</div>'; }
  };

  FAC._returnFromMaint = async function(id) {
    if (!confirm('بازگشت تخت به سرویس؟')) return;
    try {
      await FAC._api('/api/fac/beds/' + id + '/status', { method: 'POST', body: JSON.stringify({ status: 'available' }) });
      NABZ._toast('بازگشت به سرویس');
      FAC._closeAll();
      FAC.show(null, null);
    } catch (e) { alert('خطا: ' + e.message); }
  };

  FAC._loadTemplates = async function(el) {
    el = el || document.getElementById('facTabContent');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:20px"><span class="spinner"></span></div>';
    try {
      var r = await FAC._api('/api/fac/templates');
      var h = '<div style="font-size:11.5px;color:var(--fg-2);margin-bottom:10px">یک قالب را انتخاب کنید تا بخش + تخت‌ها با یک کلیک ساخته شوند</div>';
      h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">';
      (r.items || []).forEach(function(t) {
        h += '<button class="btn" style="padding:14px 8px;text-align:center;display:flex;flex-direction:column;gap:4px;align-items:center;min-height:100px" onclick="NABZ.fac._applyTemplate(\'' + t.code + '\')">';
        h += '<div style="font-weight:900;font-size:12.5px">' + FAC._esc(t.label) + '</div>';
        h += '<div style="font-size:10px;color:var(--fg-2)">' + t.beds + ' تخت / ' + FAC._esc(t.type) + '</div>';
        h += '<div style="font-size:9px;color:var(--primary);margin-top:auto">+ ساخت خودکار</div>';
        h += '</button>';
      });
      h += '</div>';
      el.innerHTML = h;
    } catch (e) { el.innerHTML = '<div class="empty">خطا: ' + FAC._esc(e.message) + '</div>'; }
  };

  FAC._applyTemplate = async function(code) {
    try {
      var r = await FAC._api('/api/fac/templates');
      var tpl = (r.items || []).find(function(t) { return t.code === code; });
      if (!tpl) return alert('قالب یافت نشد');

      var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">ساخت از قالب: ' + FAC._esc(tpl.label) + '</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">X</button></div>';
      h += '<div class="card" style="padding:10px;margin-bottom:10px;background:var(--primary-soft)">';
      h += '<div style="font-size:11.5px"><b>' + tpl.beds + ' تخت</b> / نوع <b>' + FAC._esc(tpl.type) + '</b> / گروه <b>' + FAC._esc(tpl.group) + '</b></div>';
      h += '</div>';
      h += '<div class="wf-field"><label>نام بخش *</label><input type="text" id="tplLabel" value="' + FAC._esc(tpl.label + ' ' + new Date().toLocaleDateString('fa-IR')) + '"></div>';
      h += '<div class="wf-field"><label>کد بخش (انگلیسی، یا خالی برای خودکار)</label><input type="text" id="tplCode" placeholder="AUTO" style="font-family:monospace"></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.fac._doApplyTemplate(\'' + code + '\')">ساخت بخش + ' + tpl.beds + ' تخت</button>';
      FAC._closeAll();
      FAC._open(h);
    } catch (e) { alert('خطا: ' + e.message); }
  };

  FAC._doApplyTemplate = async function(code) {
    try {
      var r = await FAC._api('/api/fac/templates');
      var tpl = (r.items || []).find(function(t) { return t.code === code; });
      if (!tpl) return alert('قالب یافت نشد');
      var body = {
        label: document.getElementById('tplLabel').value.trim(),
        code: document.getElementById('tplCode').value.trim() || undefined,
        type: tpl.type,
        group: tpl.group,
        bedsPlanned: tpl.beds,
        capabilities: tpl.capabilities,
        createBeds: true
      };
      if (!body.label) return alert('نام الزامی');
      var result = await FAC._api('/api/fac/wards', { method: 'POST', body: JSON.stringify(body) });
      NABZ._toast('بخش + ' + (result.bedsCreated || tpl.beds) + ' تخت ساخته شد');
      FAC._closeAll();
      FAC.show(null, null);
    } catch (e) { alert('خطا: ' + e.message); }
  };

  FAC._loadCapacity = async function(el) {
    el = el || document.getElementById('facTabContent');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:20px"><span class="spinner"></span></div>';
    try {
      var r = await FAC._api('/api/fac/capacity');
      var h = '';

      if (r.criticalWards && r.criticalWards.length) {
        h += '<div style="background:var(--dng-soft);border:2px solid var(--dng);border-radius:8px;padding:10px;margin-bottom:10px">';
        h += '<div style="font-weight:900;color:var(--dng);font-size:12.5px">🚨 ' + r.criticalWards.length + ' بخش در آستانه اشباع (≥90%)</div>';
        r.criticalWards.forEach(function(w) {
          h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + FAC._esc(w.label) + ' — ' + w.occupancy + '%</div>';
        });
        h += '</div>';
      }

      if (r.emptyWards && r.emptyWards.length) {
        h += '<div style="background:var(--warn-soft);border:2px solid var(--warn);border-radius:8px;padding:10px;margin-bottom:10px">';
        h += '<div style="font-weight:900;color:var(--warn);font-size:12px">⚠️ ' + r.emptyWards.length + ' بخش بدون تخت آزاد</div>';
        r.emptyWards.forEach(function(w) {
          h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + FAC._esc(w.label) + ' — ' + w.occupancy + '%</div>';
        });
        h += '</div>';
      }

      h += '<div class="rd-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">';
      h += '<div class="rd-stat"><div class="v">' + r.totalCapacity + '</div><div class="l">ظرفیت</div></div>';
      h += '<div class="rd-stat ok"><div class="v">' + r.totalAvailable + '</div><div class="l">آزاد</div></div>';
      h += '<div class="rd-stat ' + (r.totalCapacity > 0 && r.totalAvailable === 0 ? 'dng' : 'info') + '"><div class="v">' + (r.totalCapacity - r.totalAvailable) + '</div><div class="l">اشغال+نظافت</div></div>';
      h += '</div>';

      h += '<div class="sec-hd" style="margin:10px 0 6px"><span>📊 ظرفیت هر بخش</span></div>';
      h += '<div style="overflow-x:auto">';
      h += '<table style="width:100%;font-size:10.5px;border-collapse:collapse;min-width:340px">';
      h += '<thead><tr style="background:var(--bg-3)">';
      h += '<th style="padding:6px;text-align:right">بخش</th><th style="padding:4px">تخت</th><th style="padding:4px">بیمار</th><th style="padding:4px">آزاد</th><th style="padding:4px">اشغال</th>';
      h += '</tr></thead><tbody>';
      (r.byWard || []).forEach(function(w) {
        var occ = w.occupancy || 0;
        var cls = occ >= 90 ? 'dng' : occ >= 75 ? 'warn' : 'ok';
        h += '<tr style="border-bottom:1px solid var(--border)">';
        h += '<td style="padding:5px 6px;text-align:right;font-weight:800">' + FAC._esc(w.label) + '</td>';
        h += '<td style="padding:4px;text-align:center">' + w.bedsTotal + '</td>';
        h += '<td style="padding:4px;text-align:center">' + w.patients + '</td>';
        h += '<td style="padding:4px;text-align:center;color:var(--ok);font-weight:800">' + w.available + '</td>';
        h += '<td style="padding:4px;text-align:center"><span class="pill ' + cls + '">' + occ + '%</span></td>';
        h += '</tr>';
      });
      h += '</tbody></table></div>';
      el.innerHTML = h;
    } catch (e) { el.innerHTML = '<div class="empty">خطا: ' + FAC._esc(e.message) + '</div>'; }
  };

  console.log('[facilities-ui] p4 loaded (cleaning/maint/templates/capacity)');
})();
