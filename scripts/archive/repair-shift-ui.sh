#!/data/data/com.termux/files/usr/bin/bash
# ═══════════════════════════════════════════════════════════
#  NABZ — Shift Assistant UI Repair (diagnose + fix)
# ═══════════════════════════════════════════════════════════
set -e

echo "🔧 NABZ Shift Assistant — تعمیر UI"
echo ""

if [ ! -f "core/server.js" ]; then
  echo "❌ از ریشهٔ پروژه اجرا کنید"
  exit 1
fi

# ═══════════════════════════════════════════════════════════
#  STEP 1 — Prerequisites
# ═══════════════════════════════════════════════════════════
echo "═══ ۱) بررسی فایل‌های لازم ═══"
MISSING=""
[ ! -f "modules/shift_assistant.js" ] && MISSING="$MISSING modules/shift_assistant.js"
[ ! -f "public/sa.js" ]              && MISSING="$MISSING public/sa.js"
[ ! -f "public/sa-init.js" ]         && MISSING="$MISSING public/sa-init.js"
if [ -n "$MISSING" ]; then
  echo "❌ فایل‌های گم‌شده:$MISSING"
  echo ""
  echo "ابتدا اجرا کنید:"
  echo "  bash install-shift-assistant.sh"
  echo "  bash install-shift-frontend.sh"
  exit 1
fi
echo "✅ همه فایل‌ها موجودند"
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 2 — Permissions
# ═══════════════════════════════════════════════════════════
echo "═══ ۲) مجوزها ═══"
if grep -q "sa.view" core/permissions-extra.js 2>/dev/null; then
  echo "✅ sa.view موجود"
else
  cat >> core/permissions-extra.js << 'PEOF'

Object.assign(perms.P, {
  'sa.view':     'admin,matron,supervisor,clinical_supervisor,head_nurse,nurse,shift_staff',
  'sa.request':  'admin,matron,supervisor,clinical_supervisor,head_nurse,nurse,shift_staff',
  'sa.checkin':  'admin,matron,supervisor,clinical_supervisor,head_nurse,nurse,shift_staff',
  'sa.manage':   'admin,matron,head_nurse',
  'sa.solve':    'admin,matron,head_nurse',
  'sa.approve':  'admin,matron',
  'sa.lock':     'admin,matron',
  'sa.payroll':  'admin,matron',
  'sa.admin':    'admin'
});
PEOF
  echo "✅ اضافه شد"
fi
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 3 — Diagnose app.js
# ═══════════════════════════════════════════════════════════
echo "═══ ۳) وضعیت فعلی app.js ═══"
node << 'DIAG'
const fs = require('fs');
if (!fs.existsSync('public/app.js')) { console.error('❌ app.js نیست'); process.exit(1); }
const src = fs.readFileSync('public/app.js', 'utf8');

const checks = [
  ['MOD_META دارد crisis', /crisis:\{l:/.test(src)],
  ['MOD_META دارد shift_assistant', /shift_assistant:/.test(src)],
  ['MOD_META دارد cdss (Part17)', /cdss:\{l:/.test(src)],
  ['modOrder شامل crisis', /modOrder\s*=\s*\[[^\]]*'crisis'/.test(src)],
  ['modOrder شامل shift_assistant', /modOrder\s*=\s*\[[^\]]*'shift_assistant'/.test(src)],
  ['modOrder شامل cdss', /modOrder\s*=\s*\[[^\]]*'cdss'/.test(src)],
  ['show() می‌شناسد sa_dashboard', src.includes('sa_dashboard')],
  ['index.html بارگذاری sa.js (بررسی جداست)']
];
for (const [label, ok] of checks.slice(0, 7)) {
  console.log((ok ? '✅' : '❌') + ' ' + label);
}

const mm = src.match(/const MOD_META\s*=\s*\{[\s\S]*?\n\s{0,4}\};/);
if (mm) {
  console.log('\n📋 MOD_META:');
  console.log(mm[0].split('\n').slice(0, 3).join('\n'));
  console.log('  ...');
  console.log(mm[0].split('\n').slice(-3).join('\n'));
}

const mo = src.match(/const modOrder\s*=\s*\[[^\]]+\]/);
if (mo) {
  console.log('\n📋 modOrder:');
  console.log(mo[0]);
}
DIAG
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 4 — Fix app.js (bulletproof regex, NO anchor dependency)
# ═══════════════════════════════════════════════════════════
echo "═══ ۴) تعمیر app.js ═══"
node << 'FIX'
const fs = require('fs');
const F = 'public/app.js';
let src = fs.readFileSync(F, 'utf8');
let changed = 0;

// ── (a) MOD_META — append before closing }; no matter what anchor
if (!/shift_assistant:\{/.test(src)) {
  const mm = src.match(/const MOD_META\s*=\s*\{([\s\S]*?)\n(\s{0,4})\};/);
  if (mm) {
    // Remove trailing whitespace from inner, add ours
    let inner = mm[1].replace(/[\s,]+$/, '');
    const closing = '\n' + mm[2] + '};';
    const fixed = 'const MOD_META = {' + inner +
                  ',\n    shift_assistant:{l:\'دستیار شیفت\',i:\'🏥\'}' +
                  closing;
    src = src.replace(mm[0], fixed);
    changed++;
    console.log('✅ MOD_META ← shift_assistant');
  } else {
    console.log('❌ MOD_META regex failed');
  }
} else {
  console.log('ℹ️  MOD_META قبلاً هست');
}

// ── (b) modOrder — append before closing ], no matter what anchor
const moMatch = src.match(/const modOrder\s*=\s*\[([^\]]+)\]/);
if (moMatch && !moMatch[1].includes("'shift_assistant'")) {
  const inner = moMatch[1].replace(/[\s,]+$/, '');
  const fixed = 'const modOrder = [' + inner + ",'shift_assistant']";
  src = src.replace(moMatch[0], fixed);
  changed++;
  console.log('✅ modOrder ← shift_assistant');
} else if (moMatch) {
  console.log('ℹ️  modOrder قبلاً هست');
}

if (changed > 0) {
  fs.writeFileSync(F, src);
  console.log('\n✅ app.js ذخیره شد (' + changed + ' تغییر)');
}
FIX
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 5 — index.html
# ═══════════════════════════════════════════════════════════
echo "═══ ۵) index.html ═══"
if grep -q '/sa\.js' public/index.html; then
  echo "✅ /sa.js موجود"
else
  node << 'FIX_HTML'
const fs = require('fs');
const F = 'public/index.html';
let src = fs.readFileSync(F, 'utf8');
// Insert sa.js + sa-init.js before </body> if not present
if (!src.includes('/sa.js')) {
  const tag = '<script src="/sa.js"></script>\n<script src="/sa-init.js"></script>\n';
  // Prefer to insert after the last existing script to preserve order
  const lastScript = src.lastIndexOf('<script src="/');
  if (lastScript !== -1) {
    const endTag = src.indexOf('</script>', lastScript);
    if (endTag !== -1) {
      src = src.slice(0, endTag + 9) + '\n' + tag + src.slice(endTag + 9);
      fs.writeFileSync(F, src);
      console.log('✅ اضافه شد');
      process.exit(0);
    }
  }
  // Fallback: before </body>
  src = src.replace('</body>', tag + '</body>');
  fs.writeFileSync(F, src);
  console.log('✅ اضافه شد (fallback)');
}
FIX_HTML
fi
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 6 — sw.js (bump + STATIC)
# ═══════════════════════════════════════════════════════════
echo "═══ ۶) sw.js ═══"
node << 'FIX_SW'
const fs = require('fs');
if (!fs.existsSync('public/sw.js')) process.exit(0);
const F = 'public/sw.js';
let src = fs.readFileSync(F, 'utf8');
let changes = 0;

// Add to STATIC
if (!src.includes('/sa.js')) {
  const sm = src.match(/const STATIC\s*=\s*\[([\s\S]*?)\];/);
  if (sm) {
    let inner = sm[1].replace(/[\s,]+$/, '');
    const fixed = 'const STATIC = [' + inner + ",\n  '/sa.js', '/sa-init.js'\n];";
    src = src.replace(sm[0], fixed);
    changes++;
    console.log('✅ STATIC + sa.js, sa-init.js');
  }
} else {
  console.log('ℹ️  STATIC قبلاً هست');
}

// Bump version
const vm = src.match(/const VERSION = (\d+);/);
if (vm) {
  const nv = parseInt(vm[1]) + 1;
  src = src.replace(vm[0], 'const VERSION = ' + nv + ';');
  console.log('✅ VERSION ' + vm[1] + ' → ' + nv);
  changes++;
}

if (changes > 0) fs.writeFileSync(F, src);
FIX_SW
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 7 — Enhance sa-init.js (SELF-HEALING DRAWER)
# ═══════════════════════════════════════════════════════════
echo "═══ ۷) تقویت sa-init.js (self-healing) ═══"

# Append self-healing block to existing sa-init.js
if ! grep -q "SELF_HEALING_DRAWER" public/sa-init.js 2>/dev/null; then
cat >> public/sa-init.js << 'EOF_HEAL'

// ═══════════════════════════════════════════════════════════
//  SELF_HEALING_DRAWER — inject drawer item at runtime
//  حتی اگر MOD_META/modOrder پچ نشده باشند، کار می‌کند
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  // Direct dispatch — NABZ.show wrapper enhanced
  function patchShowFallback() {
    if (!window.NABZ || typeof NABZ.show !== 'function') return setTimeout(patchShowFallback, 200);
    const current = NABZ.show;
    if (current._saFallback) return;

    NABZ.show = async function(id) {
      // Direct dispatch to sa when panel not found OR kind mismatch
      if (id === 'shift_assistant.dashboard' || id === 'shift_assistant.dashboard') {
        if (NABZ.sa && NABZ.sa.showDashboard) {
          NABZ.state.current = id;
          document.querySelectorAll('.bn-tab').forEach(b => b.classList.remove('on'));
          document.getElementById('content').innerHTML =
            '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
          try {
            const d = await NABZ._api('/api/sa/wards');
            await NABZ.sa.showDashboard(null, d);
            return;
          } catch (e) {
            document.getElementById('content').innerHTML =
              '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>';
            return;
          }
        }
      }
      return current.call(NABZ, id);
    };
    NABZ.show._saFallback = true;
    console.log('[sa-heal] show fallback ready ✓');
  }
  patchShowFallback();

  // Inject drawer item after boot — retry until drawer exists
  let _healAttempts = 0;
  function healDrawer() {
    _healAttempts++;
    if (_healAttempts > 60) return; // give up after ~30s

    const user = (window.NABZ && NABZ.state && NABZ.state.user) || null;
    if (!user) return setTimeout(healDrawer, 500);

    const isManager = ['admin','matron','head_nurse','supervisor','clinical_supervisor'].includes(user.role);
    if (!isManager) return; // shift_staff has custom nav

    const drawer = document.getElementById('drawer');
    if (!drawer) return setTimeout(healDrawer, 500);

    const panel = drawer.querySelector('.drawer-panel');
    if (!panel) return setTimeout(healDrawer, 500);

    if (panel.querySelector('[data-sa-injected]')) return; // already injected

    const section = document.createElement('div');
    section.className = 'drawer-sec';
    section.setAttribute('data-sa-injected', '1');
    section.innerHTML = [
      '<div class="drawer-sec-hd">🏥 دستیار شیفت</div>',
      '<button class="drawer-item" onclick="NABZ.show(\'shift_assistant.dashboard\');NABZ.hideDrawer()">',
      '  <span class="di-ico">📊</span>',
      '  <span class="di-lbl">دستیار شیفت</span>',
      '</button>',
      '<button class="drawer-item" onclick="NABZ.sa.go(\'attendance\');NABZ.show(\'shift_assistant.dashboard\');NABZ.hideDrawer()">',
      '  <span class="di-ico">📍</span>',
      '  <span class="di-lbl">حضور امروز</span>',
      '</button>'
    ].join('');

    // Insert before last drawer-sec (logout) or append
    const lastSec = panel.querySelector('.drawer-sec[style*="border-top"]') ||
                    panel.querySelector(':scope > .drawer-sec:last-child');
    if (lastSec && lastSec.parentNode === panel) {
      panel.insertBefore(section, lastSec);
    } else {
      panel.appendChild(section);
    }
    console.log('[sa-heal] drawer item injected ✓');
  }

  // Start attempting after boot completes
  setTimeout(healDrawer, 1500);

  // Also re-inject on drawer recreation (renderNav can rebuild drawer)
  const origShowDrawer = window.NABZ && NABZ.showDrawer;
  if (typeof origShowDrawer === 'function') {
    NABZ.showDrawer = function() {
      const result = origShowDrawer.apply(this, arguments);
      setTimeout(() => {
        _healAttempts = 0;
        healDrawer();
      }, 50);
      return result;
    };
  }
})();
EOF_HEAL
echo "✅ Self-healing اضافه شد"
else
echo "ℹ️  Self-healing قبلاً هست"
fi
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 8 — Verify module loads
# ═══════════════════════════════════════════════════════════
echo "═══ ۸) لود ماژول ═══"
if node -e "require('./modules/shift_assistant.js'); console.log('✅ ماژول OK');" 2>&1; then
  :
else
  echo "❌ ماژول لود نمی‌شود — خطای بالا"
  exit 1
fi
echo ""

# ═══════════════════════════════════════════════════════════
#  STEP 9 — Final verify
# ═══════════════════════════════════════════════════════════
echo "═══ ۹) بررسی نهایی ═══"
node << 'VERIFY'
const fs = require('fs');
const src = fs.readFileSync('public/app.js', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');
const sw = fs.readFileSync('public/sw.js', 'utf8');

let pass = 0, fail = 0;
function check(label, ok) {
  console.log((ok ? '✅' : '❌') + ' ' + label);
  ok ? pass++ : fail++;
}

check('MOD_META ← shift_assistant', /shift_assistant:/.test(src));
check('modOrder ← shift_assistant', /modOrder\s*=\s*\[[^\]]*'shift_assistant'/.test(src));
check('index.html ← /sa.js', html.includes('/sa.js'));
check('sw.js ← /sa.js در STATIC', sw.includes('/sa.js'));
check('sa.js فایل موجود', fs.existsSync('public/sa.js'));
check('sa-init.js فایل موجود', fs.existsSync('public/sa-init.js'));
check('Self-healing در sa-init', fs.readFileSync('public/sa-init.js', 'utf8').includes('SELF_HEALING_DRAWER'));

const swv = sw.match(/const VERSION = (\d+);/);
console.log('\n📊 SW version: v' + (swv ? swv[1] : '?'));

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log((fail === 0 ? '✅' : '⚠️ ') + pass + ' پاس / ' + fail + ' خطا');
if (fail > 0) process.exit(1);
VERIFY

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ تعمیر کامل شد — همه چیز آماده"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🔄 اجرا:"
echo "  pkill -9 -f 'core/server.js' 2>/dev/null || true"
echo "  sleep 1"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
echo ""
echo "⚠️  در مرورگر:"
echo "  1) F12 → Application → Service Workers → Unregister همه"
echo "  2) F12 → Application → Cache Storage → Delete همه"
echo "  3) Ctrl+Shift+R (Hard Reload)"
echo "  4) دوباره Ctrl+Shift+R"
echo ""
echo "✅ تایید سریع (بعد از سرور):"
echo "  curl -s -X POST http://localhost:4000/api/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"admin\",\"password\":\"nabz@2026\"}' | grep -oP '(?<=\"token\":\")[^\"]+' > /tmp/tk"
echo "  curl -s http://localhost:4000/api/_modules -H \"Authorization: Bearer \$(cat /tmp/tk)\" | grep -o 'shift_assistant[^\"]*'"
echo ""
echo "  باید ببینید: shift_assistant.dashboard"
echo ""
