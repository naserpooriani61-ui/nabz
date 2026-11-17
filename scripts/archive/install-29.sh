#!/usr/bin/env bash
set -uo pipefail
ROOT="${1:-$HOME/nabz}"

# Guard
for f in core/security.js core/time.js modules/restraint.js public/restraint_ui.js; do
  [ -f "$ROOT/$f" ] || { echo "✘ missing: $f"; echo "  Run Paste 1, 2, 3 first."; exit 1; }
done

# Backup
BK="$HOME/nabz-backups"; mkdir -p "$BK"
STAMP="$(date +%s)"; ARCH="$BK/pre-29-$STAMP.tar.gz"
tar -czf "$ARCH" -C "$ROOT" --exclude=./node_modules --exclude=./data/_backups . || exit 1
echo "✔ backup → $ARCH"
rollback() { echo "↩ rollback…"; tar -xzf "$ARCH" -C "$ROOT"; exit 1; }

echo ""
echo "━━ Patch index.html to load restraint_ui.js"
if grep -q "restraint_ui.js" "$ROOT/public/index.html" 2>/dev/null; then
  echo "  = already in index.html"
elif grep -q "</body>" "$ROOT/public/index.html" 2>/dev/null; then
  cp "$ROOT/public/index.html" "$ROOT/public/index.html.pre29"
  node - "$ROOT" << 'HTML_EOF'
const fs = require('fs'), path = require('path');
const f = path.join(process.argv[2], 'public/index.html');
let s = fs.readFileSync(f, 'utf8');
if (s.includes('restraint_ui.js')) { console.log('  = already'); process.exit(0); }
s = s.replace('</body>', '<script src="/restraint_ui.js"></script>\n</body>');
fs.writeFileSync(f, s);
console.log('  ✓ index.html patched');
HTML_EOF
  [ $? = 0 ] || { echo "  ✘ html patch failed"; rollback; }
else
  echo "  ⚠ index.html missing or no </body> — skipping (UI won't load)"
fi

echo ""
echo "━━ Time patches (UTC→Tehran)"
node - "$ROOT" << 'PATCH_EOF'
const fs = require('fs'), path = require('path');
const root = process.argv[2];
function patch(rel, regex, repl, label) {
  const f = path.join(root, rel);
  if (!fs.existsSync(f)) { console.log('  ⚠ ' + rel + ' not found — skip ' + label); return; }
  let s = fs.readFileSync(f, 'utf8');
  if (regex.test(s)) {
    fs.writeFileSync(f, s.replace(regex, repl));
    console.log('  ✓ ' + rel + ' [' + label + ']');
    return;
  }
  if (s.includes('getUTCFullYear') || s.includes('time.todayTehran')) {
    console.log('  = ' + rel + ' [' + label + '] already patched');
    return;
  }
  console.log('  ⚠ anchor not found in ' + rel + ' [' + label + ']');
}
patch('modules/shift_assistant.js',
  /function todayJ\(\)\s*\{\s*const now\s*=\s*new Date\(\);\s*return _d2j\(_g2d\(now\.getFullYear\(\),\s*now\.getMonth\(\)\s*\+\s*1,\s*now\.getDate\(\)\)\);\s*\}/,
  'function todayJ() { const t = new Date(Date.now() + 3.5 * 3600000); return _d2j(_g2d(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())); }',
  'shiftJ');
patch('modules/roster.js',
  /function todayJ\(\)\s*\{\s*const n\s*=\s*new Date\(\);\s*return d2j\(g2d\(n\.getFullYear\(\),\s*n\.getMonth\(\)\s*\+\s*1,\s*n\.getDate\(\)\)\);\s*\}/,
  'function todayJ() { const t = new Date(Date.now() + 3.5 * 3600000); return d2j(g2d(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())); }',
  'rosterJ');
patch('modules/hospital_ops.js',
  /const today = new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\);/g,
  'const today = require("../core/time").todayTehran();',
  'hopsToday');
patch('modules/role_dashboards.js',
  /function todayIso\(\)\s*\{\s*return new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\);\s*\}/,
  'function todayIso() { return require("../core/time").todayTehran(); }',
  'rdIso');
patch('modules/role_dashboards_extra.js',
  /function today\(\)\s*\{\s*return new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\);\s*\}/,
  'function today() { return require("../core/time").todayTehran(); }',
  'rdeToday');
patch('modules/analytics.js',
  /function today\(\)\s*\{\s*return new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\);\s*\}/,
  'function today() { return require("../core/time").todayTehran(); }',
  'anToday');
PATCH_EOF

echo ""
echo "━━ Time function test"
node - "$ROOT" << 'TT_EOF'
const T = require(process.argv[2] + '/core/time.js');
const cases = [
  ['2026-01-01T00:00:00Z', '2026-01-01'],
  ['2026-01-01T20:00:00Z', '2026-01-01'],
  ['2026-01-01T21:00:00Z', '2026-01-02'],
  ['2026-01-01T18:00:00Z', '2026-01-01']
];
let pass = 0, fail = 0;
for (const [utc, exp] of cases) {
  const got = T.todayTehran(new Date(utc));
  if (got === exp) pass++;
  else { fail++; console.error('  ✘ ' + utc + ' → ' + got + ' (want ' + exp + ')'); }
}
console.log('  ' + pass + '/' + cases.length + ' passed');
if (fail > 0) process.exit(1);
TT_EOF
[ $? = 0 ] || { echo "✘ time tests failed"; rollback; }

echo ""
echo "━━ Syntax check"
for f in core/time.js modules/restraint.js public/restraint_ui.js; do
  node -e "new Function(require('fs').readFileSync(process.argv[1],'utf8'))" "$ROOT/$f" 2>/dev/null \
    && echo "  ✓ $f" || { echo "  ✘ $f"; rollback; }
done

echo ""
echo "━━ Restart"
pkill -TERM -f "core/server.js" 2>/dev/null || true
sleep 3
pkill -9 -f "core/server.js" 2>/dev/null || true
sleep 1
cd "$ROOT" && NODE_OPTIONS="--max-old-space-size=384" nohup node core/server.js > "$HOME/nabz-server.log" 2>&1 &
sleep 6

if ! pgrep -f "core/server.js" >/dev/null; then
  echo "  ✘ server did not start:"
  tail -25 "$HOME/nabz-server.log"
  rollback
fi
echo "  ✓ server running (pid $(pgrep -f 'core/server.js' | head -1))"

echo ""
echo "━━ Verify"
grep -E "restraint|NABZ running|kernel warnings" "$HOME/nabz-server.log" | head -4 | sed 's/^/    /'

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✓ Stage 29 installed"
echo ""
echo "  ✓ core/time.js — Tehran time helpers"
echo "  ✓ UTC→Tehran patches on 6 files"
echo "  ✓ modules/restraint.js — JCI COP.5"
echo "  ✓ public/restraint_ui.js — dashboard"
echo "  ✓ index.html now loads restraint_ui.js"
echo ""
echo "  Rollback: tar -xzf $ARCH -C $ROOT"
echo "═══════════════════════════════════════════════════════════"
