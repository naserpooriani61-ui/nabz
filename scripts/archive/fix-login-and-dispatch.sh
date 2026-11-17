#!/data/data/com.termux/files/usr/bin/bash
set -e
cd ~/nabz
[ ! -f core/server.js ] && { echo "❌ از ریشهٔ پروژه"; exit 1; }

echo "🔧 NABZ — Fix Login + Shift Assistant Dispatch"
echo ""

# ═══════════════════════════════════════════════════════════
#  DIAG: Users file
# ═══════════════════════════════════════════════════════════
echo "═══ ۱) بررسی users.json ═══"
node -e "
  const store = require('./core/store');
  const users = store.readAll('users');
  console.log('کل کاربران:', users.length);
  const admin = users.find(u => u.username === 'admin');
  if (admin) {
    console.log('admin موجود:');
    console.log('  role:', admin.role);
    console.log('  active:', admin.active);
    console.log('  hasHash:', !!admin.passwordHash);
    console.log('  hash length:', (admin.passwordHash||'').length);
    const bcrypt = require('bcryptjs');
    console.log('  verify nabz@2026:', bcrypt.compareSync('nabz@2026', admin.passwordHash||''));
  } else {
    console.log('❌ admin موجود نیست');
  }
"
echo ""

# ═══════════════════════════════════════════════════════════
#  FIX 1: Force-reset admin
# ═══════════════════════════════════════════════════════════
echo "═══ ۲) Reset admin password ═══"
node -e "
  const bcrypt = require('bcryptjs');
  const store = require('./core/store');
  const users = store.readAll('users');
  let admin = users.find(u => u.username === 'admin');
  if (!admin) {
    admin = {
      id: 'usr_admin', username: 'admin', fullName: 'مدیر سیستم',
      role: 'admin', ward: null, active: true,
      passwordHash: bcrypt.hashSync('nabz@2026', 8),
      createdAt: new Date().toISOString()
    };
    store.put('users', admin);
    console.log('✅ admin ساخته شد');
  } else {
    admin.passwordHash = bcrypt.hashSync('nabz@2026', 8);
    admin.active = true;
    admin.role = 'admin';
    store.put('users', admin);
    console.log('✅ admin بازنشانی شد');
  }
  const verify = bcrypt.compareSync('nabz@2026', admin.passwordHash);
  console.log('تست verify:', verify ? '✅ OK' : '❌ FAIL');
  if (!verify) process.exit(1);
"
echo ""

# ═══════════════════════════════════════════════════════════
#  FIX 2: sa_dashboard dispatch در app.js (belt-and-suspenders)
# ═══════════════════════════════════════════════════════════
echo "═══ ۳) Dispatch در app.js ═══"
cp public/app.js public/app.js.bak-$(date +%s) 2>/dev/null || true
node -e "
  const fs = require('fs');
  const F = 'public/app.js';
  let src = fs.readFileSync(F, 'utf8');
  if (src.includes(\"kind === 'sa_dashboard'\")) {
    console.log('ℹ️  از قبل هست');
    process.exit(0);
  }
  const marker = \"else if (p.kind === 'nursing' && NABZ.showNursing) await NABZ.showNursing(p, d);\";
  if (!src.includes(marker)) {
    console.error('❌ marker پیدا نشد — app.js نسخهٔ متفاوت');
    process.exit(1);
  }
  const addition = marker
    + \"\n      else if (p.kind === 'sa_dashboard' && NABZ.sa) await NABZ.sa.showDashboard(p, d);\"
    + \"\n      else if (p.kind === 'sa_staff' && NABZ.sa) await NABZ.sa.staffSchedule();\";
  src = src.replace(marker, addition);
  fs.writeFileSync(F, src);
  console.log('✅ app.js dispatch اضافه شد');
"
echo ""

# ═══════════════════════════════════════════════════════════
#  FIX 3: sa-init defer wrap until sa.js loaded
# ═══════════════════════════════════════════════════════════
echo "═══ ۴) sa-init: صبر کن NABZ.sa لود شود ═══"
node -e "
  const fs = require('fs');
  const F = 'public/sa-init.js';
  let src = fs.readFileSync(F, 'utf8');
  if (src.includes('WAIT_FOR_SA')) { console.log('ℹ️  قبلاً'); process.exit(0); }
  // Replace the immediate patchShow with waiting version
  const oldBlock = /function patchShow\(\) \{[\s\S]*?\n  patchShow\(\);/;
  const newBlock = \`function patchShow() {
    // WAIT_FOR_SA — صبر کن sa.js کامل لود شود
    if (!window.NABZ || typeof NABZ.show !== 'function' || !NABZ.sa) {
      return setTimeout(patchShow, 100);
    }
    if (NABZ.show._saWrapped) return;
    const orig = NABZ.show;
    NABZ.show = async function(id) {
      if (id === 'shift_assistant.dashboard' && NABZ.sa) {
        NABZ.state.current = id;
        document.querySelectorAll('.bn-tab').forEach(b => b.classList.remove('on'));
        document.getElementById('content').innerHTML = '<div style=\\\\\"text-align:center;padding:40px\\\\\"><span class=\\\\\"spinner\\\\\"></span></div>';
        try {
          const d = await NABZ._api('/api/sa/wards');
          await NABZ.sa.showDashboard(null, d);
        } catch (e) {
          document.getElementById('content').innerHTML = '<div class=\\\\\"empty\\\\\">خطا: ' + NABZ._esc(e.message) + '</div>';
        }
        return;
      }
      const p = NABZ.state.panels.find(x => x.id === id);
      if (p && p.kind === 'sa_dashboard' && NABZ.sa) {
        NABZ.state.current = id;
        document.querySelectorAll('.bn-tab').forEach(b => b.classList.remove('on'));
        try {
          const d = await NABZ._api(p.api);
          await NABZ.sa.showDashboard(p, d);
        } catch (e) {
          document.getElementById('content').innerHTML = '<div class=\\\\\"empty\\\\\">خطا: ' + NABZ._esc(e.message) + '</div>';
        }
        return;
      }
      return orig.call(NABZ, id);
    };
    NABZ.show._saWrapped = true;
    console.log('[sa-init] show wrapped ✓');
  }
  patchShow();\`;
  if (oldBlock.test(src)) {
    src = src.replace(oldBlock, newBlock);
    fs.writeFileSync(F, src);
    console.log('✅ sa-init بازنویسی شد');
  } else {
    console.log('❌ الگو پیدا نشد — دستی بررسی');
  }
"
echo ""

# ═══════════════════════════════════════════════════════════
#  FIX 4: sa.js syntax check
# ═══════════════════════════════════════════════════════════
echo "═══ ۵) Syntax check ═══"
node -e "
  const fs = require('fs');
  try {
    new Function(fs.readFileSync('public/sa.js', 'utf8'));
    console.log('✅ sa.js OK');
  } catch (e) {
    console.error('❌ sa.js:', e.message);
    process.exit(1);
  }
  try {
    new Function(fs.readFileSync('public/sa-init.js', 'utf8'));
    console.log('✅ sa-init.js OK');
  } catch (e) {
    console.error('❌ sa-init.js:', e.message);
    process.exit(1);
  }
"
echo ""

# ═══════════════════════════════════════════════════════════
#  FIX 5: bump sw
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
#  VERIFY
# ═══════════════════════════════════════════════════════════
echo "═══ ۷) VERIFY ═══"
node << 'EOF_V'
const fs = require('fs');
const bcrypt = require('bcryptjs');
const store = require('./core/store');

let p = 0, f = 0;
function c(l, ok) { console.log((ok ? '✅' : '❌') + ' ' + l); ok ? p++ : f++; }

// Admin
const admin = store.readAll('users').find(u => u.username === 'admin');
c('admin exists', !!admin);
c('admin active', admin && admin.active === true);
c('admin password = nabz@2026', admin && bcrypt.compareSync('nabz@2026', admin.passwordHash || ''));

// app.js dispatch
const app = fs.readFileSync('public/app.js', 'utf8');
c('app.js has sa_dashboard dispatch', /kind === 'sa_dashboard'/.test(app));

// sa-init
const init = fs.readFileSync('public/sa-init.js', 'utf8');
c('sa-init waits for NABZ.sa', init.includes('!NABZ.sa') && init.includes('setTimeout(patchShow'));

// sa.js syntax
try { new Function(fs.readFileSync('public/sa.js', 'utf8')); c('sa.js parses', true); }
catch (e) { c('sa.js parses', false); }

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(p + ' PASS / ' + f + ' FAIL');
process.exit(f > 0 ? 1 : 0);
EOF_V

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ تمام"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🔄 سرور:"
echo "  pkill -9 -f 'core/server.js' 2>/dev/null; sleep 1"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
echo ""
echo "🧪 تست login (ترمینال دوم):"
echo "  curl -s -X POST http://localhost:4000/api/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"username\":\"admin\",\"password\":\"nabz@2026\"}' | head -c 200"
echo ""
echo "  ✅ باید token برگرداند"
echo ""
echo "🌐 مرورگر:"
echo "  F12 → Application → Clear site data"
echo "  Ctrl+Shift+R × 2"
echo "  admin / nabz@2026 → منو ☰ → 🏥 دستیار شیفت → دستیار شیفت"
echo ""
