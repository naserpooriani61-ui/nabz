(function() {
  'use strict';
  function ready(fn) {
    if (window.NABZ && typeof NABZ.registerKind === 'function') return fn();
    setTimeout(function() { ready(fn); }, 100);
  }
  ready(function() {
    NABZ.registerKind('security_config', async function(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) d = await NABZ._api(p.api);
        render(d);
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>';
      }
    });

    function render(d) {
      var enabled = d.forcePasswordChangeOnLogin === true;
      var m = document.getElementById('content');
      var h = '<div class="sec-hd"><span>🔐 مدیریت رمز عبور</span></div>';
      h += '<div class="card" style="background:linear-gradient(135deg,' + (enabled ? 'rgba(239,68,68,.1)' : 'rgba(16,185,129,.1)') + ',transparent);border-color:var(--' + (enabled ? 'dng' : 'ok') + ');margin-bottom:12px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">';
      h += '<div><div style="font-size:11px;color:var(--fg-2);font-weight:800">وضعیت</div>';
      h += '<div style="font-size:22px;font-weight:900;color:var(--' + (enabled ? 'dng' : 'ok') + ')">' + (enabled ? '🔒 فعال' : '🔓 غیرفعال') + '</div>';
      h += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:4px">' + (enabled ? 'کاربران با flag باید در اولین ورود رمز عوض کنند' : 'همه بدون اجبار وارد می‌شوند') + '</div></div>';
      h += '<div style="text-align:left;font-size:11px;color:var(--fg-2)"><div><b>' + d.usersPendingChange + '</b> / ' + d.totalUsers + '</div><div>در انتظار</div></div>';
      h += '</div></div>';
      h += '<div class="card" style="margin-bottom:12px"><div class="card-title">تغییر وضعیت</div><div style="display:flex;gap:6px">';
      h += '<button class="btn ' + (!enabled ? 'btn-ok' : '') + '" style="flex:1;padding:12px;font-weight:900" onclick="NABZ.pwAdminToggle(false)">🔓 غیرفعال</button>';
      h += '<button class="btn ' + (enabled ? 'btn-dng' : '') + '" style="flex:1;padding:12px;font-weight:900" onclick="NABZ.pwAdminToggle(true)">🔒 فعال</button>';
      h += '</div></div>';
      h += '<div class="card" style="margin-bottom:12px"><div class="card-title">اقدامات دسته‌جمعی</div>';
      h += '<div class="hint info" style="margin-bottom:10px;font-size:11px;line-height:1.7"><div><b>Toggle بالا:</b> فقط سیاست سرور</div><div><b>پاک کردن:</b> flag از همه حذف</div><div><b>فعال کردن:</b> flag روی همه</div></div>';
      h += '<button class="btn btn-block" style="padding:12px;margin-bottom:6px" onclick="NABZ.pwAdminBulkClear()">🧹 پاک کردن flag از همه</button>';
      h += '<button class="btn btn-block" style="padding:12px;color:var(--dng);border-color:var(--dng)" onclick="NABZ.pwAdminBulkSet()">⚠️ فعال کردن flag روی همه</button>';
      h += '</div>';
      h += '<div class="hint info" style="margin-top:12px;font-size:11px;line-height:1.7"><div style="font-weight:900;margin-bottom:4px">🔐 تغییر رمز اختیاری</div><div>دکمه 🔐 در هدر بالا — همه هر وقت خواستند رمز عوض می‌کنند.</div></div>';
      m.innerHTML = h;
    }

    NABZ.pwAdminToggle = async function(enable) {
      try {
        await NABZ._api('/api/admin/security/config', { method: 'POST', body: JSON.stringify({ forcePasswordChangeOnLogin: enable }) });
        NABZ._toast(enable ? '🔒 فعال شد' : '🔓 غیرفعال شد');
        setTimeout(function() { NABZ.show('admin_security_config.config'); }, 200);
      } catch (e) { alert('خطا: ' + e.message); }
    };
    NABZ.pwAdminBulkClear = async function() {
      if (!confirm('flag تغییر رمز از همه پاک شود؟\n\nهمه بدون اجبار وارد می‌شوند.')) return;
      try {
        var r = await NABZ._api('/api/admin/security/clear-all-pending', { method: 'POST', body: '{}' });
        NABZ._toast('✅ ' + r.cleared + ' کاربر آزاد شد');
        setTimeout(function() { NABZ.show('admin_security_config.config'); }, 200);
      } catch (e) { alert('خطا: ' + e.message); }
    };
    NABZ.pwAdminBulkSet = async function() {
      if (!confirm('flag تغییر رمز روی همه فعال شود؟')) return;
      try {
        var r = await NABZ._api('/api/admin/security/set-all-pending', { method: 'POST', body: '{}' });
        NABZ._toast('⚠️ ' + r.enabled + ' کاربر باید رمز عوض کنند');
        setTimeout(function() { NABZ.show('admin_security_config.config'); }, 200);
      } catch (e) { alert('خطا: ' + e.message); }
    };

    console.log('[admin-pw-config] loaded');
  });
})();
