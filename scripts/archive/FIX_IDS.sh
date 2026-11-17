#!/data/data/com.termux/files/usr/bin/bash
set -e
[ ! -f core/server.js ] && { echo "❌ از ریشهٔ پروژه"; exit 1; }

echo "🔧 Fix duplicate panel IDs in _modules"
echo ""

# ── Backup ──
cp core/server.js core/server.js.before-ids-fix 2>/dev/null || true

# ── Before ──
echo "═══ قبل ═══"
grep -n "panels.push(" core/server.js

# ── Fix ──
node << 'EOF'
const fs = require('fs');
const F = 'core/server.js';
let src = fs.readFileSync(F, 'utf8');
const BAD = 'panels.push({ id: name + "." + p.id, module: name, ...p });';
const GOOD = 'panels.push(Object.assign({}, p, { id: name + "." + p.id, module: name }));';
if (src.includes(GOOD)) { console.log('ℹ️  از قبل درست'); process.exit(0); }
if (!src.includes(BAD)) {
  console.error('❌ الگوی دقیق پیدا نشد — این خط را دستی چک کنید:');
  const m = src.match(/panels\.push\([^)]+\)/);
  if (m) console.error('  ' + m[0]);
  process.exit(1);
}
src = src.replace(BAD, GOOD);
fs.writeFileSync(F, src);
console.log('✅ اصلاح شد');
EOF

# ── After ──
echo ""
echo "═══ بعد ═══"
grep -n "panels.push(" core/server.js

# ── Verify logic ──
echo ""
echo "═══ تست شبیه‌سازی ═══"
node -e "
  function oldWay(name, p) { return { id: name + '.' + p.id, module: name, ...p }; }
  function newWay(name, p) { return Object.assign({}, p, { id: name + '.' + p.id, module: name }); }
  const cdssPanel = { id: 'dashboard', title: 'موتور بالینی', kind: 'cdss' };
  const saPanel   = { id: 'dashboard', title: 'دستیار شیفت', kind: 'sa_dashboard' };
  console.log('روش قدیم:');
  console.log('  cdss.id =', oldWay('cdss', cdssPanel).id);
  console.log('  sa.id   =', oldWay('shift_assistant', saPanel).id);
  console.log('  → دو پنل با id یکسان!');
  console.log('');
  console.log('روش جدید:');
  console.log('  cdss.id =', newWay('cdss', cdssPanel).id);
  console.log('  sa.id   =', newWay('shift_assistant', saPanel).id);
  console.log('  → یکتا ✓');
"

# ── Bump SW ──
node -e "
  const fs = require('fs');
  let s = fs.readFileSync('public/sw.js', 'utf8');
  const v = s.match(/const VERSION = (\d+);/);
  if (v) {
    const nv = parseInt(v[1]) + 1;
    s = s.replace(v[0], 'const VERSION = ' + nv + ';');
    fs.writeFileSync('public/sw.js', s);
    console.log('');
    console.log('✅ SW v' + v[1] + ' → v' + nv);
  }
"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ رفع شد — یک خط در server.js"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🔄 سرور:"
echo "  pkill -9 -f 'core/server.js' 2>/dev/null; sleep 1"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
echo ""
echo "🌐 مرورگر:"
echo "  F12 → Application → Storage → Clear site data"
echo "  Ctrl+Shift+R × ۲ بار"
echo ""
echo "🎯 تست:"
echo "  admin / nabz@2026 → منو ☰"
echo "  → 🏥 دستیار شیفت → داشبورد دستیار (نه CDSS) ✅"
echo "  → 🧠 موتور بالینی → داشبورد CDSS ✅"
echo ""
