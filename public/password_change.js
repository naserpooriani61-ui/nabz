(function() {
  'use strict';
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    setTimeout(function() { ready(fn); }, 100);
  }
  ready(function() {
    function injectHeaderBtn() {
      var header = document.getElementById('header');
      if (!header) return setTimeout(injectHeaderBtn, 200);
      if (document.getElementById('pwChangeBtn')) return;
      var btn = document.createElement('button');
      btn.id = 'pwChangeBtn';
      btn.className = 'hbtn';
      btn.title = 'تغییر رمز';
      btn.style.cssText = 'display:flex;flex-direction:column;align-items:center;line-height:1;font-size:14px';
      btn.innerHTML = '<span>🔐</span><span style="font-size:8px;margin-top:1px">رمز</span>';
      btn.onclick = function() { NABZ.openPasswordChange(false); };
      var first = header.querySelector('.hbtn');
      if (first) header.insertBefore(btn, first); else header.appendChild(btn);
    }
    injectHeaderBtn();

    var origShowDrawer = NABZ.showDrawer;
    NABZ.showDrawer = function() {
      if (origShowDrawer) origShowDrawer.call(NABZ);
      setTimeout(function() {
        var footer = document.querySelector('.zz-drawer-footer');
        if (!footer || footer.querySelector('[data-pw-change]')) return;
        var btn = document.createElement('button');
        btn.setAttribute('data-pw-change', '1');
        btn.className = 'zz-footer-btn';
        btn.innerHTML = '<span>🔐</span>تغییر رمز';
        btn.onclick = function() { NABZ.hideDrawer(); NABZ.openPasswordChange(false); };
        footer.insertBefore(btn, footer.firstChild);
      }, 180);
    };

    NABZ.openPasswordChange = function(forced) {
      var existing = document.querySelector('.bs-backdrop');
      if (existing) existing.remove();
      var sheet = document.createElement('div');
      sheet.className = 'bs-backdrop';
      sheet.onclick = function(e) { if (e.target === sheet && !forced) sheet.remove(); };
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">🔐 تغییر رمز عبور</div>';
      if (!forced) h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button>';
      h += '</div>';
      if (forced) h += '<div class="hint warn" style="margin-bottom:12px">⚠️ برای ادامه باید رمز خود را تغییر دهید</div>';
      h += '<div class="wf-field"><label>رمز فعلی *</label><input type="password" id="pcOld" autocomplete="current-password"></div>';
      h += '<div class="wf-field"><label>رمز جدید * (≥۸، حرف+عدد)</label><input type="password" id="pcNew" autocomplete="new-password"></div>';
      h += '<div class="wf-field"><label>تکرار *</label><input type="password" id="pcConfirm" autocomplete="new-password"></div>';
      h += '<div id="pcErr" style="color:var(--dng);font-size:11px;margin:8px 0;min-height:16px"></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;font-weight:900;margin-top:8px" onclick="NABZ._submitPwChange(' + (forced ? 'true' : 'false') + ')">✅ تغییر رمز</button>';
      var c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '95vh';
      c.innerHTML = h;
      sheet.appendChild(c);
      document.body.appendChild(sheet);
      requestAnimationFrame(function() { sheet.classList.add('show'); });
      setTimeout(function() { var i = document.getElementById('pcOld'); if (i) i.focus(); }, 200);
    };

    NABZ._submitPwChange = async function(forced) {
      var o = document.getElementById('pcOld').value;
      var n = document.getElementById('pcNew').value;
      var cf = document.getElementById('pcConfirm').value;
      var err = document.getElementById('pcErr');
      if (!o || !n || !cf) return err.textContent = 'همه فیلدها الزامی';
      if (n.length < 8) return err.textContent = 'رمز جدید ≥۸ کاراکتر';
      if (!/[0-9]/.test(n)) return err.textContent = 'رمز باید شامل عدد باشد';
      if (!/[a-zA-Z\u0600-\u06FF]/.test(n)) return err.textContent = 'رمز باید شامل حرف باشد';
      if (n !== cf) return err.textContent = 'رمزها یکسان نیستند';
      if (n === o) return err.textContent = 'رمز جدید با قدیم یکسان است';
      err.textContent = '';
      try {
        var r = await NABZ._api('/api/auth/change-password', {
          method: 'POST', body: JSON.stringify({ oldPassword: o, newPassword: n })
        });
        if (r.token) {
          localStorage.setItem('nabz_tk', r.token);
          if (r.user) localStorage.setItem('nabz_u', JSON.stringify(r.user));
          if (NABZ.state) { NABZ.state.token = r.token; if (r.user) NABZ.state.user = r.user; }
        }
        if (NABZ._toast) NABZ._toast('✅ رمز تغییر کرد');
        var bd = document.querySelector('.bs-backdrop'); if (bd) bd.remove();
        if (forced) setTimeout(function() { location.reload(); }, 700);
      } catch (e) {
        err.textContent = e.message === 'invalid_old_password' ? 'رمز فعلی اشتباه' : (e.message || 'خطا');
      }
    };

    console.log('[pw-change] loaded');
  });
})();
