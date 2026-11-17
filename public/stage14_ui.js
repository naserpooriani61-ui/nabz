
// ═══════════════════════════════════════════════════════════
//  NABZ — Stage 14 UI
//  Password change modal + scope error handling
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var S = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },

    _openSheet: function(html, opts) {
      opts = opts || {};
      var s = document.createElement('div');
      s.className = 'bs-backdrop';
      s.onclick = function(e) { if (e.target === s && !opts.noClose) s.remove(); };
      var c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '96vh';
      c.innerHTML = html;
      s.appendChild(c);
      document.body.appendChild(s);
      requestAnimationFrame(function() { s.classList.add('show'); });
      return { sheet: s, content: c };
    },

    _closeAll: function() { document.querySelectorAll('.bs-backdrop').forEach(function(el) { el.remove(); }); },

    // ═══════════════════════════════════════════════════
    //  PASSWORD CHANGE
    // ═══════════════════════════════════════════════════
    showPasswordChange: function(forced) {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">🔐 ' + (forced ? 'تغییر رمز الزامی' : 'تغییر رمز') + '</div>';
      if (!forced) h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button>';
      h += '</div>';

      if (forced) {
        h += '<div class="hint warn" style="margin-bottom:12px">⚠️ برای امنیت حساب، رمز خود را تغییر دهید. رمز فعلی قابل حدس است.</div>';
      }

      h += '<div class="wf-field"><label>رمز فعلی *</label><input type="password" id="cpOld" autocomplete="current-password"></div>';
      h += '<div class="wf-field"><label>رمز جدید (حداقل ۸ کاراکتر، شامل حرف و عدد) *</label><input type="password" id="cpNew" autocomplete="new-password"></div>';
      h += '<div class="wf-field"><label>تکرار رمز جدید *</label><input type="password" id="cpConfirm" autocomplete="new-password"></div>';
      h += '<div id="cpError" class="err"></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.stage14._submitPasswordChange(' + (forced ? 'true' : 'false') + ')">✅ تغییر رمز</button>';
      if (!forced) h += '<button class="btn btn-block" style="padding:10px;margin-top:6px" onclick="this.closest(\'.bs-backdrop\').remove()">انصراف</button>';

      S._openSheet(h, { noClose: forced });
    },

    _submitPasswordChange: async function(forced) {
      var oldPw = document.getElementById('cpOld').value;
      var newPw = document.getElementById('cpNew').value;
      var confirmPw = document.getElementById('cpConfirm').value;
      var errEl = document.getElementById('cpError');

      if (!oldPw || !newPw) return errEl.textContent = 'همه فیلدها الزامی است';
      if (newPw.length < 8) return errEl.textContent = 'رمز حداقل ۸ کاراکتر';
      if (!/[0-9]/.test(newPw)) return errEl.textContent = 'رمز باید شامل عدد باشد';
      if (!/[a-zA-Zآ-ی]/.test(newPw)) return errEl.textContent = 'رمز باید شامل حرف باشد';
      if (newPw !== confirmPw) return errEl.textContent = 'رمزها یکسان نیستند';
      if (oldPw === newPw) return errEl.textContent = 'رمز جدید با قدیم یکی است';

      errEl.textContent = '';
      try {
        await S._api('/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw })
        });
        S._closeAll();
        NABZ._toast('✅ رمز تغییر کرد');
        if (forced) {
          var user = NABZ.state.user;
          if (user) user.mustChangePassword = false;
          localStorage.setItem('nabz_u', JSON.stringify(user));
          setTimeout(function() { location.reload(); }, 800);
        }
      } catch (e) {
        errEl.textContent = e.message === 'invalid_old_password' ? 'رمز فعلی اشتباه است' : e.message;
      }
    },

    // ═══════════════════════════════════════════════════
    //  CHECK ON LOGIN — force password change
    // ═══════════════════════════════════════════════════
    checkForcePasswordChange: function() {
      var user = NABZ.state && NABZ.state.user;
      if (!user) return;
      if (user.mustChangePassword) {
        setTimeout(function() { S.showPasswordChange(true); }, 500);
      }
    }
  };

  // ═══ Bootstrap ═══
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 60) return;
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.stage14 = S;

    // Hook: after login, check force password change
    var origBoot = NABZ.boot;
    if (typeof origBoot === 'function') {
      NABZ.boot = async function() {
        var r = await origBoot.apply(NABZ);
        setTimeout(function() { S.checkForcePasswordChange(); }, 800);
        return r;
      };
    }

    // Hook: intercept scope errors in API responses
    var origApi = NABZ._api;
    if (typeof origApi === 'function') {
      NABZ._api = async function(p, o) {
        try {
          return await origApi.call(NABZ, p, o);
        } catch (e) {
          // If ward scope error, show helpful message
          if (e.message && (e.message.indexOf('ward_not_configured') >= 0)) {
            S.showWardError();
            throw e;
          }
          throw e;
        }
      };
    }

    // Add ward error modal
    S.showWardError = function() {
      if (document.querySelector('.bs-backdrop')) return;
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">⚠️ بخش تعریف نشده</div></div>';
      h += '<div class="hint warn" style="margin-bottom:14px">شما به هیچ بخشی تخصیص نیافته‌اید. برای دیدن بیماران، مدیر باید ward شما را تنظیم کند.</div>';
      h += '<div class="card" style="background:var(--bg-2);font-size:12px">';
      h += '<div><b>کاربر:</b> ' + S._esc((NABZ.state.user && NABZ.state.user.username) || '—') + '</div>';
      h += '<div style="margin-top:4px"><b>نقش:</b> ' + S._esc((NABZ.state.user && NABZ.state.user.role) || '—') + '</div>';
      h += '</div>';
      h += '<div class="hint info" style="margin-top:12px">راه‌حل: با مدیر سیستم تماس بگیرید تا ward شما را در تنظیمات کاربری تعیین کند.</div>';
      h += '<button class="btn btn-block" style="padding:10px;margin-top:12px" onclick="this.closest(\'.bs-backdrop\').remove()">فهمیدم</button>';
      S._openSheet(h);
    };

    // Add menu item for password change (in header menu)
    var origShowDrawer = NABZ.showDrawer;
    if (typeof origShowDrawer === 'function') {
      NABZ.showDrawer = function() {
        origShowDrawer.call(NABZ);
        setTimeout(function() {
          var panel = document.querySelector('.drawer-panel');
          if (!panel) return;
          if (panel.querySelector('[data-pw-change]')) return;
          // Add "Change Password" button at the bottom
          var footer = panel.querySelector('.zz-drawer-footer');
          if (footer) {
            var btn = document.createElement('button');
            btn.setAttribute('data-pw-change', '1');
            btn.className = 'zz-footer-btn';
            btn.innerHTML = '<span>🔐</span>رمز';
            btn.onclick = function() { NABZ.hideDrawer(); S.showPasswordChange(false); };
            footer.insertBefore(btn, footer.firstChild);
          }
        }, 150);
      };
    }

    console.log('[stage14-ui] loaded — password change + scope error handling');
  });
})();
