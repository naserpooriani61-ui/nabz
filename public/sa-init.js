// ═══════════════════════════════════════════════════════════
//  NABZ Shift Assistant — Bootstrap
//  ⚠️  هیچ wrap روی NABZ.show نمی‌کنیم. این کار فقط در app.js انجام می‌شود.
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  function whenReady(fn) {
    if (window.NABZ && NABZ.sa && typeof NABZ.sa.showDashboard === 'function') return fn();
    return setTimeout(() => whenReady(fn), 100);
  }

  // ─── 1) Wrap showHome فقط برای shift_staff ───
  whenReady(() => {
    if (NABZ.showHome._saHomePatched) return;
    const orig = NABZ.showHome;
    NABZ.showHome = async function() {
      if (NABZ.state.user && NABZ.state.user.role === 'shift_staff') {
        return NABZ.sa.staffHome();
      }
      return orig.call(this);
    };
    NABZ.showHome._saHomePatched = true;
    console.log('[sa-init] showHome ✓');
  });

  // ─── 2) Wrap boot برای patch nav پرسنل ───
  whenReady(() => {
    if (NABZ.boot._saBootPatched) return;
    const orig = NABZ.boot;
    NABZ.boot = async function() {
      const r = await orig.call(this);
      if (NABZ.state.user && NABZ.state.user.role === 'shift_staff') {
        setTimeout(patchStaffNav, 100);
      }
      return r;
    };
    NABZ.boot._saBootPatched = true;
    console.log('[sa-init] boot ✓');
  });

  function patchStaffNav() {
    const s = document.getElementById('sidebar');
    if (!s || s.dataset.saNavPatched) return;
    s.dataset.saNavPatched = '1';
    s.innerHTML = [
      '<button class="bn-tab on" onclick="NABZ.sa.staffView(\'home\');NABZ._markTab(this)"><span class="bn-icon">🏠</span><span class="bn-label">خانه</span></button>',
      '<button class="bn-tab" onclick="NABZ.sa.staffView(\'checkin\');NABZ._markTab(this)"><span class="bn-icon">📍</span><span class="bn-label">حضور</span></button>',
      '<button class="bn-tab" onclick="NABZ.sa.staffView(\'request\');NABZ._markTab(this)"><span class="bn-icon">📝</span><span class="bn-label">درخواست</span></button>',
      '<button class="bn-tab" onclick="NABZ.sa.staffView(\'schedule\');NABZ._markTab(this)"><span class="bn-icon">📅</span><span class="bn-label">برنامه</span></button>',
      '<button class="bn-tab" onclick="NABZ.logout()"><span class="bn-icon">⏻</span><span class="bn-label">خروج</span></button>'
    ].join('');
    console.log('[sa-init] staff nav ✓');
  }

  NABZ._markTab = function(btn) {
    document.querySelectorAll('.bn-tab').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  };

  // ─── 3) PIN login tab ───
  function injectPin() {
    const tabs = document.querySelector('.lg-tabs');
    if (!tabs) return false;
    if (tabs.querySelector('[data-pin]')) return true;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.pin = '1';
    btn.textContent = '🏥 دستیار';
    btn.onclick = () => switchPin(btn);
    tabs.appendChild(btn);
    return true;
  }
  function tryPin() { if (!injectPin()) setTimeout(tryPin, 400); }

  function switchPin(btn) {
    document.querySelectorAll('.lg-tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const form = document.getElementById('lgf');
    if (!form) return;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const code = String(fd.get('u') || '').trim();
      const pin = String(fd.get('p') || '').trim();
      const sb = form.querySelector('button');
      if (sb) { sb.disabled = true; sb.textContent = '...'; }
      try {
        const r = await fetch('/api/sa/auth/pin', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code, pin }) }).then(x => x.json());
        if (!r.ok) throw new Error(r.error || 'failed');
        localStorage.setItem('nabz_tk', r.data.token);
        localStorage.setItem('nabz_u', JSON.stringify({
          id:'sa_' + r.data.staff.id, username: r.data.staff.code, role:'shift_staff',
          fullName: r.data.staff.name, ward: null,
          staffId: r.data.staff.id, wardId: r.data.staff.wardId
        }));
        location.reload();
      } catch (err) {
        const e2 = document.getElementById('le');
        if (e2) e2.textContent = 'کد یا PIN نادرست';
        if (sb) { sb.disabled = false; sb.textContent = '🔐 ورود'; }
      }
    };
    const ins = form.querySelectorAll('input');
    if (ins[0]) { ins[0].placeholder = 'کد پرسنلی'; ins[0].type = 'text'; ins[0].value = ''; }
    if (ins[1]) { ins[1].placeholder = 'PIN (۴ رقم آخر)'; ins[1].type = 'password'; ins[1].value = ''; }
  }

  // ─── 4) Boot ───
  function boot() {
    const tk = localStorage.getItem('nabz_tk');
    if (!tk) tryPin();
    else setTimeout(() => {
      if (NABZ.state && NABZ.state.user && NABZ.state.user.role === 'shift_staff') patchStaffNav();
    }, 600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  console.log('[sa-init] loaded (no show wrap) ✓');
})();
