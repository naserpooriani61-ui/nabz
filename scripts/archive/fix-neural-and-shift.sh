#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "🔧 NABZ — Neural + Shift Assistant Fix"
echo ""

# ═══════════════════════════════════════════════════════════
#  FIX 1 — neural.js: add missing methods
# ═══════════════════════════════════════════════════════════
echo "═══ FIX 1: neural.js ═══"
if grep -q "alerts(actor)" core/neural.js 2>/dev/null; then
  echo "ℹ️  already patched"
else
  cp core/neural.js core/neural.js.bak 2>/dev/null || true
  node << 'EOF_NEURAL'
const fs = require('fs');
const F = 'core/neural.js';
let src = fs.readFileSync(F, 'utf8');
const marker = 'module.exports = new Neural();';
if (!src.includes(marker)) { console.error('❌ marker missing'); process.exit(1); }
const idx = src.lastIndexOf('module.exports');
let closeIdx = -1;
for (let i = idx - 1; i >= 0; i--) if (src[i] === '}') { closeIdx = i; break; }
if (closeIdx === -1) { console.error('❌ class close not found'); process.exit(1); }
const methods = '\n\n  // Compatibility aliases\n  alerts(actor) { return this.alertsFor(actor || { role: "admin", id: "sys", username: "sys" }); }\n  cohort() { return this.cohortRisk(); }\n';
src = src.slice(0, closeIdx) + methods + src.slice(closeIdx);
fs.writeFileSync(F, src);
console.log('✅ neural.js patched');
EOF_NEURAL
fi

node -e "
  const n = require('./core/neural.js');
  console.log('  alerts():', typeof n.alerts === 'function' ? '✅' : '❌');
  console.log('  cohort():', typeof n.cohort === 'function' ? '✅' : '❌');
  try { const r = n.alerts(); console.log('  returns:', Array.isArray(r) ? r.length + ' items' : typeof r); }
  catch(e) { console.error('  ❌ call failed:', e.message); }
"
echo ""

# ═══════════════════════════════════════════════════════════
#  DIAG 1 — shift_assistant module
# ═══════════════════════════════════════════════════════════
echo "═══ DIAG: shift_assistant module ═══"
if [ ! -f "modules/shift_assistant.js" ]; then
  echo "❌ FILE MISSING — Phase 1 not installed"
  exit 1
fi

node << 'EOF_DIAG'
try {
  const m = require('./modules/shift_assistant.js');
  console.log('✅ module loads');
  console.log('   handlers:', Object.keys(m.handlers || {}).length);
  console.log('   routes:  ', (m.routes || []).length);
  console.log('   panels:  ', (m.panels || []).length);
  if (m.routes) {
    console.log('   first 3 routes:');
    m.routes.slice(0, 3).forEach(r => console.log('     ' + r.method + ' ' + r.path));
  }
  if (m.panels) {
    m.panels.forEach(p => console.log('     panel: ' + p.id + '  kind: ' + p.kind + '  perm: ' + p.perm));
  }
} catch (e) {
  console.error('❌ LOAD FAILED:', e.message);
  console.error(e.stack);
  process.exit(1);
}
EOF_DIAG
echo ""

# ═══════════════════════════════════════════════════════════
#  FIX 2 — permissions in BOTH files
# ═══════════════════════════════════════════════════════════
echo "═══ FIX 2: permissions ═══"

# Check where sa.view was added
grep -l "sa.view" core/permissions*.js 2>/dev/null || echo "❌ sa.view not found in any permissions file"

if ! grep -q "sa.view" core/permissions.js 2>/dev/null && ! grep -q "sa.view" core/permissions-extra.js 2>/dev/null; then
  cat >> core/permissions-extra.js << 'EOF_P'
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
EOF_P
  echo "✅ added to permissions-extra.js"
else
  echo "✅ sa.view present"
fi

# ═══════════════════════════════════════════════════════════
#  FIX 3 — app.js drawer (bulletproof)
# ═══════════════════════════════════════════════════════════
echo "═══ FIX 3: app.js drawer ═══"
cp public/app.js public/app.js.bak 2>/dev/null || true
node << 'EOF_APP'
const fs = require('fs');
const F = 'public/app.js';
let src = fs.readFileSync(F, 'utf8');
let changes = 0;

// MOD_META — append before closing }; regardless of anchor
if (!/shift_assistant:\{/.test(src)) {
  const mm = src.match(/const MOD_META\s*=\s*\{([\s\S]*?)\n(\s{0,4})\};/);
  if (mm) {
    let inner = mm[1].replace(/[\s,]+$/, '');
    src = src.replace(mm[0], 'const MOD_META = {' + inner + ',\n    shift_assistant:{l:\'دستیار شیفت\',i:\'🏥\'}' + '\n' + mm[2] + '};');
    changes++;
    console.log('✅ MOD_META patched');
  } else console.log('❌ MOD_META pattern failed');
} else console.log('ℹ️  MOD_META already has shift_assistant');

// modOrder — append before closing ] regardless of anchor
const mo = src.match(/const modOrder\s*=\s*\[([^\]]+)\]/);
if (mo && !mo[1].includes("'shift_assistant'")) {
  const inner = mo[1].replace(/[\s,]+$/, '');
  src = src.replace(mo[0], 'const modOrder = [' + inner + ",'shift_assistant']");
  changes++;
  console.log('✅ modOrder patched');
} else if (mo) console.log('ℹ️  modOrder already has shift_assistant');
else console.log('❌ modOrder pattern not found');

if (changes > 0) fs.writeFileSync(F, src);
EOF_APP
echo ""

# ═══════════════════════════════════════════════════════════
#  FIX 4 — index.html
# ═══════════════════════════════════════════════════════════
echo "═══ FIX 4: index.html ═══"
if grep -q '/sa\.js' public/index.html; then
  echo "ℹ️  already present"
else
  node -e "
    const fs = require('fs');
    let s = fs.readFileSync('public/index.html', 'utf8');
    s = s.replace('</body>', '<script src=\"/sa.js\"></script>\n<script src=\"/sa-init.js\"></script>\n</body>');
    fs.writeFileSync('public/index.html', s);
    console.log('✅ injected');
  "
fi
echo ""

# ═══════════════════════════════════════════════════════════
#  FIX 5 — sw.js bump
# ═══════════════════════════════════════════════════════════
echo "═══ FIX 5: sw.js ═══"
node -e "
  const fs = require('fs');
  if (!fs.existsSync('public/sw.js')) process.exit(0);
  let s = fs.readFileSync('public/sw.js', 'utf8');
  const v = s.match(/const VERSION\s*=\s*(\d+);/);
  if (v) {
    const nv = parseInt(v[1]) + 1;
    s = s.replace(v[0], 'const VERSION = ' + nv + ';');
    if (!s.includes('/sa.js')) {
      const sm = s.match(/const STATIC\s*=\s*\[([\s\S]*?)\];/);
      if (sm) {
        let inner = sm[1].replace(/[\s,]+$/, '');
        s = s.replace(sm[0], 'const STATIC = [' + inner + ',\n  \'/sa.js\', \'/sa-init.js\'\n];');
      }
    }
    fs.writeFileSync('public/sw.js', s);
    console.log('✅ sw.js → v' + nv);
  }
"
echo ""

# ═══════════════════════════════════════════════════════════
#  VERIFY — full path
# ═══════════════════════════════════════════════════════════
echo "═══ VERIFY (final) ═══"
node << 'EOF_VERIFY'
const fs = require('fs');
const app = fs.readFileSync('public/app.js', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');
const sw = fs.readFileSync('public/sw.js', 'utf8');
const neu = fs.readFileSync('core/neural.js', 'utf8');

let pass = 0, fail = 0;
function chk(label, ok) {
  console.log((ok ? '✅' : '❌') + ' ' + label);
  ok ? pass++ : fail++;
}

chk('neural.alerts() exists', /alerts\(actor\)/.test(neu));
chk('neural.cohort() exists', /cohort\(\)\s*\{/.test(neu));
chk('MOD_META has shift_assistant', /shift_assistant:/.test(app));
chk('modOrder has shift_assistant', /modOrder\s*=\s*\[[^\]]*'shift_assistant'/.test(app));
chk('index.html has /sa.js', html.includes('/sa.js'));
chk('index.html has /sa-init.js', html.includes('/sa-init.js'));
chk('sw.js has /sa.js', sw.includes('/sa.js'));
chk('public/sa.js exists', fs.existsSync('public/sa.js'));
chk('public/sa-init.js exists', fs.existsSync('public/sa-init.js'));
chk('modules/shift_assistant.js exists', fs.existsSync('modules/shift_assistant.js'));

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail > 0 ? 1 : 0);
EOF_VERIFY

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ DONE"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "🔄 Restart:"
echo "  pkill -9 -f 'core/server.js' 2>/dev/null"
echo "  sleep 1"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
echo ""
echo "Expected in startup:"
echo "  📦 shift_assistant (37)"
echo "  📡 285+ routes · 25 modules"
echo "  ✅ no neural errors"
echo ""
echo "Then:"
echo "  TOKEN=\$(curl -s -X POST http://localhost:4000/api/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"admin\",\"password\":\"nabz@2026\"}' | grep -oP '(?<=\"token\":\")[^\"]+')"
echo "  curl -s http://localhost:4000/api/_modules -H \"Authorization: Bearer \$TOKEN\" | grep -c 'shift_assistant'"
echo ""
echo "  ✅ Must return 2 or more"
echo ""
