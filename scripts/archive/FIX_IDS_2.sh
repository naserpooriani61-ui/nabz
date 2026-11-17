#!/data/data/com.termux/files/usr/bin/bash
set -e
cp core/server.js core/server.js.before-ids-fix 2>/dev/null || true

echo "═══ قبل ═══"
grep -n "panels.push" core/server.js

node << 'EOF'
const fs = require('fs');
const F = 'core/server.js';
let src = fs.readFileSync(F, 'utf8');

// الگوی دقیق با کوتیشن تک
const BAD = "panels.push({ id: name + '.' + p.id, module: name, ...p });";
const GOOD = "panels.push(Object.assign({}, p, { id: name + '.' + p.id, module: name }));";

if (src.includes(GOOD)) { console.log('ℹ️  از قبل درست'); process.exit(0); }
if (!src.includes(BAD)) {
  console.error('❌ باز هم پیدا نشد. خط را دقیق نشان می‌دهم:');
  src.split('\n').forEach((line, i) => {
    if (line.includes('panels.push')) console.log('  ' + (i+1) + ': ' + JSON.stringify(line));
  });
  process.exit(1);
}

src = src.replace(BAD, GOOD);
fs.writeFileSync(F, src);
console.log('✅ اصلاح شد');
EOF

echo ""
echo "═══ بعد ═══"
grep -n "panels.push" core/server.js

echo ""
echo "═══ تست منطق ═══"
node -e "
  function oldWay(name, p) { return { id: name + '.' + p.id, module: name, ...p }; }
  function newWay(name, p) { return Object.assign({}, p, { id: name + '.' + p.id, module: name }); }
  var c = { id: 'dashboard', title: 'CDSS', kind: 'cdss' };
  var s = { id: 'dashboard', title: 'SA', kind: 'sa_dashboard' };
  console.log('قدیم: cdss.id=' + oldWay('cdss', c).id + '  sa.id=' + oldWay('shift_assistant', s).id + '  ← تداخل!');
  console.log('جدید: cdss.id=' + newWay('cdss', c).id + '  sa.id=' + newWay('shift_assistant', s).id + '  ← یکتا');
"

# syntax check
node -e "require('./core/server.js')" > /dev/null 2>&1 || node -c core/server.js 2>/dev/null && echo "✅ server.js syntax OK" || echo "⚠️  syntax check"

# SW bump
node -e "
  const fs = require('fs');
  let s = fs.readFileSync('public/sw.js', 'utf8');
  const v = s.match(/const VERSION = (\d+);/);
  if (v) {
    const nv = parseInt(v[1]) + 1;
    s = s.replace(v[0], 'const VERSION = ' + nv + ';');
    fs.writeFileSync('public/sw.js', s);
    console.log('✅ SW v' + v[1] + ' → v' + nv);
  }
"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🔄 سرور:"
echo "  pkill -9 -f 'core/server.js' 2>/dev/null; sleep 1"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
echo ""
echo "🌐 مرورگر:"
echo "  F12 → Application → Storage → Clear site data"
echo "  Ctrl+Shift+R × ۲"
echo ""
