
echo "─── ۱) بررسی backend ───"
[ -f modules/bedboard.js ] && echo "✅ bedboard.js exists ($(wc -l < modules/bedboard.js) lines)" || { echo "❌ missing"; exit 1; }
node -e "const m = require('./modules/bedboard.js'); console.log('✅ handlers:', Object.keys(m.handlers).length, '| panels:', m.panels.length)" || exit 1

echo ""
echo "─── ۲) Patch app.js — add bedboard + sina to drawer ───"

node << 'APP'
const fs = require('fs');
let s = fs.readFileSync('public/app.js', 'utf8');
let changed = false;

// 2.1) Add to MOD_META
if (!s.includes('bedboard:')) {
  const metaOld = "const MOD_META = {";
  const metaNew = "const MOD_META = {\n    bedboard:{l:'تخت',i:'🛏️'},";
  if (s.includes(metaOld)) {
    s = s.replace(metaOld, metaNew);
    changed = true;
    console.log('✅ MOD_META: bedboard added');
  }
}

// 2.2) Add to modOrder
const orderOld = /const modOrder\s*=\s*\[([^\]]*)\];/;
const match = s.match(orderOld);
if (match && !match[1].includes("'bedboard'")) {
  const newOrder = "const modOrder = ['home','bedboard','nursing_report'," + match[1].replace(/^\s*['"](home|nursing_report)['"],?\s*/g, '') + "];";
  s = s.replace(orderOld, newOrder);
  changed = true;
  console.log('✅ modOrder: bedboard added');
}

// 2.3) Ensure kind === 'bedboard' delegated
if (!s.includes("p.kind === 'bedboard'")) {
  const kindOld = "if (p.kind === 'action') renderAction(p, d);";
  const kindNew = "if (p.kind === 'action') renderAction(p, d);\n      else if (p.kind === 'bedboard' && NABZ.showBedboard) await NABZ.showBedboard(p, d);";
  s = s.replace(kindOld, kindNew);
  changed = true;
  console.log('✅ kind bedboard delegated');
}

if (changed) {
  fs.writeFileSync('public/app.js', s);
  console.log('💾 app.js saved');
} else {
  console.log('⚠️ no changes (already patched?)');
}
APP

echo ""
echo "─── ۳) Verify ───"
echo "modOrder has bedboard:"
grep -o "'bedboard'" public/app.js | head -1 && echo "✅" || echo "❌"
echo "MOD_META has bedboard:"
grep -o "bedboard:{" public/app.js | head -1 && echo "✅" || echo "❌"
echo "kind bedboard in show():"
grep -c "p.kind === 'bedboard'" public/app.js

echo ""
echo "─── ۴) Add quick button to Home dashboard ───"

node << 'HOME'
const fs = require('fs');
let s = fs.readFileSync('modules/home.js', 'utf8');
if (!s.includes("bedboard")) {
  // Add bedboard to quickLinks for all roles
  s = s.replace(
    /quickLinks:\s*\[\s*\{ icon:'🩺', label:'بیماران'/,
    "quickLinks: [\n      { icon:'🛏️', label:'نقشه تخت', action:\"NABZ.show('bedboard.wards')\" },\n      { icon:'🩺', label:'بیماران'"
  );
  fs.writeFileSync('modules/home.js', s);
  console.log('✅ home.js: نقشه تخت button added');
}
HOME

echo ""
echo "─── ۵) Restart ───"
for pid in $(pgrep -f "core/server.js" 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done
sleep 1

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✅ Fix applied                          ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Run:"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
echo ""
echo "Then: hard reload in browser"
