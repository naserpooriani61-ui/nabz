
# ═══════════════════════════════════════════════════════════════
#  Fix Part 8 — add nursing_report to drawer + load permissions
# ═══════════════════════════════════════════════════════════════

echo "─── ۱) بررسی فایل nursing_report.js ───"
if [ ! -f modules/nursing_report.js ]; then
  echo "❌ فایل وجود ندارد — Part 8 اجرا نشد"
  exit 1
fi
echo "✅ فایل موجود است ($(wc -l < modules/nursing_report.js) خط)"

echo "─── ۲) بررسی syntax ───"
node -e "const m = require('./modules/nursing_report.js'); console.log('✅ handlers:', Object.keys(m.handlers).length, '| routes:', m.routes.length, '| panels:', m.panels.length)" || exit 1

echo "─── ۳) Patch server.js — load permissions-extra ───"
node << 'SRV'
const fs = require('fs');
let src = fs.readFileSync('core/server.js', 'utf8');
if (src.includes("require('./permissions-extra')")) {
  console.log('⚠️  already required');
} else {
  const marker = '// ─── 4) Auto-discovery';
  if (src.includes(marker)) {
    src = src.replace(marker,
      "try { require('./permissions-extra'); } catch(e) { console.error('perm-extra:', e.message); }\n\n" + marker);
    fs.writeFileSync('core/server.js', src);
    console.log('✅ server.js patched');
  } else {
    console.log('❌ marker "// ─── 4) Auto-discovery" not found');
    // Try alternative markers
    const alternatives = [
      '// ─── Auto-discovery',
      'const modDir',
      'auth.seedAdmin();'
    ];
    for (const alt of alternatives) {
      if (src.includes(alt)) {
        src = src.replace(alt,
          "try { require('./permissions-extra'); } catch(e) { console.error('perm-extra:', e.message); }\n" + alt);
        fs.writeFileSync('core/server.js', src);
        console.log('✅ patched via alternative: ' + alt);
        break;
      }
    }
  }
}
SRV

echo "─── ۴) Patch app.js — add nursing_report + home to drawer ───"
node << 'APP'
const fs = require('fs');
let s = fs.readFileSync('public/app.js', 'utf8');
let changed = 0;

// Add to MOD_META
if (!s.includes('nursing_report:') && s.includes('const MOD_META = {')) {
  s = s.replace('const MOD_META = {',
    "const MOD_META = {\n    home:{l:'خانه',i:'🏠'}, nursing_report:{l:'گزارش پرستاری',i:'📝'},");
  changed++;
  console.log('✅ MOD_META: home + nursing_report added');
} else {
  console.log('⚠️ MOD_META already contains nursing_report or pattern missing');
}

// Add to modOrder
const orderPatterns = [
  { old: "const modOrder = ['clinical','emergency','workflow','paraclinical','safety','surgical','ops','education','quality','rights','advanced_hr','admin','qr_pulse','crisis'];",
    new: "const modOrder = ['home','nursing_report','clinical','emergency','workflow','paraclinical','safety','surgical','ops','education','quality','rights','advanced_hr','admin','qr_pulse','crisis'];" },
  { old: "const modOrder=['clinical','emergency','workflow','paraclinical','safety','surgical','ops','education','quality','rights','advanced_hr','admin','qr_pulse','crisis'];",
    new: "const modOrder=['home','nursing_report','clinical','emergency','workflow','paraclinical','safety','surgical','ops','education','quality','rights','advanced_hr','admin','qr_pulse','crisis'];" }
];

for (const p of orderPatterns) {
  if (s.includes(p.old)) {
    s = s.replace(p.old, p.new);
    changed++;
    console.log('✅ modOrder: home + nursing_report added');
    break;
  }
}

if (changed === 0) {
  // Fallback: just add nursing_report at the end
  s = s.replace(/const modOrder\s*=\s*\[([^\]]*)\];/,
    (m, inner) => {
      if (inner.includes("'nursing_report'")) return m;
      return "const modOrder = ['home','nursing_report'," + inner + "];";
    });
  if (s.includes("'nursing_report'")) {
    changed++;
    console.log('✅ modOrder patched via fallback');
  }
}

if (changed > 0) {
  fs.writeFileSync('public/app.js', s);
  console.log('💾 app.js saved');
} else {
  console.log('❌ no changes applied — check app.js structure');
}
APP

echo "─── ۵) Verify ───"
echo ""
echo "app.js — nursing_report in modOrder:"
grep -o "'nursing_report'" public/app.js | head -1 && echo "✅ found" || echo "❌ not found"
echo ""
echo "app.js — nursing_report in MOD_META:"
grep -o "nursing_report:{" public/app.js | head -1 && echo "✅ found" || echo "❌ not found"
echo ""
echo "server.js — permissions-extra:"
grep -c "permissions-extra" core/server.js

echo ""
echo "─── ۶) Restart ───"
for pid in $(pgrep -f "core/server.js" 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done
sleep 1

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✅ Fix applied — now restart server    ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Run:"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
echo ""
echo "Then in browser: Ctrl+Shift+R (hard reload)"
