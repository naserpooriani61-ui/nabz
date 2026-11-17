#!/data/data/com.termux/files/usr/bin/bash
set -e
[ ! -f core/server.js ] && { echo "❌ از ریشهٔ پروژه"; exit 1; }

echo "🧹 NABZ Clean Fix — بدون wrap اضافی"
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 1 — Reset admin password
# ═══════════════════════════════════════════════════════════
echo "═══ ۱) admin ═══"
node -e "
  const bcrypt = require('bcryptjs');
  const store = require('./core/store');
  const users = store.readAll('users');
  let admin = users.find(u => u.username === 'admin');
  if (!admin) {
    admin = { id:'usr_admin', username:'admin', fullName:'مدیر سیستم', role:'admin', ward:null, active:true, passwordHash:bcrypt.hashSync('nabz@2026', 8), createdAt:new Date().toISOString() };
    store.put('users', admin);
    console.log('✅ admin ساخته شد');
  } else {
    admin.passwordHash = bcrypt.hashSync('nabz@2026', 8);
    admin.active = true;
    admin.role = 'admin';
    store.put('users', admin);
    console.log('✅ admin بازنشانی شد');
  }
  console.log('verify:', bcrypt.compareSync('nabz@2026', admin.passwordHash) ? '✅' : '❌');
"
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 2 — sa-init.js CLEAN (NO show wrap)
# ═══════════════════════════════════════════════════════════
echo "═══ ۲) sa-init.js (بدون wrap روی show) ═══"
cat > public/sa-init.js << 'EOF_INIT'
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
EOF_INIT
node -e "new Function(require('fs').readFileSync('public/sa-init.js','utf8'))" && echo "✅ sa-init.js OK"
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 3 — app.js dispatch (پاک، anchor دقیق)
# ═══════════════════════════════════════════════════════════
echo "═══ ۳) app.js dispatch ═══"
cp public/app.js public/app.js.before-clean 2>/dev/null || true
node << 'EOF_APP'
const fs = require('fs');
const F = 'public/app.js';
let src = fs.readFileSync(F, 'utf8');

// پاک‌کردن هر patch قبلی
src = src.replace(/[ \t]*else if \(p\.kind === 'sa_dashboard'[^\n]*\n/g, '');
src = src.replace(/[ \t]*else if \(p\.kind === 'sa_staff'[^\n]*\n/g, '');

const anchor = "else if (p.kind === 'nursing' && NABZ.showNursing) await NABZ.showNursing(p, d);";
if (!src.includes(anchor)) {
  console.error('❌ anchor پیدا نشد');
  process.exit(1);
}

const addition = anchor
  + "\n      else if (p.kind === 'sa_dashboard' && NABZ.sa) await NABZ.sa.showDashboard(p, d);"
  + "\n      else if (p.kind === 'sa_staff' && NABZ.sa) await NABZ.sa.staffSchedule();";

src = src.replace(anchor, addition);
fs.writeFileSync(F, src);
console.log('✅ app.js dispatch اضافه شد (یک نسخه)');
EOF_APP
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 4 — بررسی cdss.js که wrap خودش رو داره
# ═══════════════════════════════════════════════════════════
echo "═══ ۴) بررسی cdss.js ═══"
node << 'EOF_CDSS'
const fs = require('fs');
if (!fs.existsSync('public/cdss.js')) { console.log('ℹ️  cdss.js نیست'); process.exit(0); }
const src = fs.readFileSync('public/cdss.js', 'utf8');
if (src.includes("NABZ.show._cdssWrapped")) {
  console.log('✅ cdss.js: wrap روی show دارد (فقط kind=cdss را می‌گیرد — بی‌خطر)');
} else {
  console.log('ℹ️  cdss.js: wrap روی show ندارد');
}
EOF_CDSS
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 5 — بررسی تعداد wrapها روی NABZ.show
# ═══════════════════════════════════════════════════════════
echo "═══ ۵) شمارش wrapها روی NABZ.show ═══"
node << 'EOF_COUNT'
const fs = require('fs');
const files = ['app.js','extra.js','voice-init.js','offline-init.js','cdss.js','sa-init.js'];
let wraps = [];
for (const f of files) {
  if (!fs.existsSync('public/' + f)) continue;
  const src = fs.readFileSync('public/' + f, 'utf8');
  const count = (src.match(/NABZ\.show\s*=\s*(async\s+)?function/g) || []).length;
  if (count > 0) wraps.push(f + ': ' + count);
}
console.log('wrapها روی NABZ.show:');
for (const w of wraps) console.log('  ' + w);
if (wraps.length === 0) console.log('  (هیچ)');
console.log('');
console.log('انتظار: فقط cdss.js (۱) — sa-init نباید هیچ wrap داشته باشد');
EOF_COUNT
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 6 — SW bump
# ═══════════════════════════════════════════════════════════
echo "═══ ۶) SW bump ═══"
node -e "
  const fs = require('fs');
  let s = fs.readFileSync('public/sw.js', 'utf8');
  const v = s.match(/const VERSION = (\d+);/);
  if (v) {
    const nv = parseInt(v[1]) + 1;
    s = s.replace(v[0], 'const VERSION = ' + nv + ';');
    fs.writeFileSync('public/sw.js', s);
    console.log('✅ v' + v[1] + ' → v' + nv);
  }
"
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 7 — VERIFY
# ═══════════════════════════════════════════════════════════
echo "═══ ۷) VERIFY نهایی ═══"
node << 'EOF_V'
const fs = require('fs');
const bcrypt = require('bcryptjs');
const store = require('./core/store');

let p = 0, f = 0;
function c(l, ok) { console.log((ok ? '✅' : '❌') + ' ' + l); ok ? p++ : f++; }

// admin
const admin = store.readAll('users').find(u => u.username === 'admin');
c('admin password = nabz@2026', !!admin && bcrypt.compareSync('nabz@2026', admin.passwordHash || ''));

// app.js
const app = fs.readFileSync('public/app.js', 'utf8');
c('app.js has sa_dashboard dispatch', /kind === 'sa_dashboard'/.test(app));
c('app.js has sa_staff dispatch', /kind === 'sa_staff'/.test(app));
c('app.js only ONE sa_dashboard line', (app.match(/sa_dashboard/g) || []).length === 1);

// sa-init
const init = fs.readFileSync('public/sa-init.js', 'utf8');
c('sa-init: NO wrap on NABZ.show', !/NABZ\.show\s*=\s*/.test(init));
c('sa-init: has PIN login', init.includes('injectPin'));
c('sa-init: has staff nav', init.includes('patchStaffNav'));
c('sa-init.js parses', (() => { try { new Function(init); return true; } catch (e) { console.log('  ' + e.message); return false; } })());

// sa.js
try { new Function(fs.readFileSync('public/sa.js', 'utf8')); c('sa.js parses', true); }
catch (e) { c('sa.js parses: ' + e.message, false); }

// module
const m = require('./modules/shift_assistant.js');
c('module routes (' + m.routes.length + ')', m.routes.length > 0);
c('module panels (' + m.panels.length + ')', m.panels.length > 0);

// index.html scripts
const html = fs.readFileSync('public/index.html', 'utf8');
const iSa = html.indexOf('/sa.js');
const iSaInit = html.indexOf('/sa-init.js');
const iCdss = html.indexOf('/cdss.js');
c('index.html: /cdss.js before /sa.js', iCdss >= 0 && iSa > iCdss);
c('index.html: /sa.js before /sa-init.js', iSa > 0 && iSaInit > iSa);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(p + ' PASS / ' + f + ' FAIL');
process.exit(f > 0 ? 1 : 0);
EOF_V

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ رفع شد"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🔄 سرور:"
echo "  pkill -9 -f 'core/server.js' 2>/dev/null; sleep 1"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
echo ""
echo "🌐 مرورگر — پاک‌سازی حتمی:"
echo "  1. F12 → Application → Service Workers → Unregister ALL"
echo "  2. F12 → Application → Storage → Clear site data"
echo "  3. Ctrl+Shift+R × ۲ بار"
echo ""
echo "🎯 مسیر تست:"
echo "  admin / nabz@2026"
echo "  منو ☰ → 🏥 دستیار شیفت → دستیار شیفت"
echo "  ✅ باید داشبورد shift assistant ببینید (نه CDSS)"
echo ""
