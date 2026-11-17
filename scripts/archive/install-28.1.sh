#!/usr/bin/env bash
# NABZ Stage 28.1 — 3 real bug fixes on top of Stage 28.
#   1) auth.js   — DUMMY_HASH bcrypt cost 8 → COST (closes username timing leak)
#   2) store.js  — invalidate() clears _dirty + _pc (no phantom writes after cache clear)
#   3) gate.js   — child server killed on abnormal exit (no port-4199 zombie)
set -uo pipefail
ROOT="${1:-$HOME/nabz}"
[ -f "$ROOT/core/security.js" ] && [ -f "$ROOT/core/patient-guard.js" ] \
  || { echo "✘ Stage 28 not installed. Nothing changed."; exit 1; }

BK="$HOME/nabz-backups"; mkdir -p "$BK"
STAMP="$(date +%s)"; ARCH="$BK/pre-28.1-$STAMP.tar.gz"
tar -czf "$ARCH" -C "$ROOT" --exclude=./node_modules --exclude=./data/_backups . || { echo "✘ backup failed"; exit 1; }
echo "✔ backup → $ARCH"
rollback() { echo ""; echo "↩ rolling back…"; tar -xzf "$ARCH" -C "$ROOT"; echo "   restored. server NOT restarted."; exit 1; }

patch() {
  local rel="$1" anchor="$2" repl="$3"
  node - "$ROOT" "$rel" "$anchor" "$repl" << 'NODE_PATCHER_EOF'
'use strict';
const fs = require('fs'), path = require('path');
const [, , root, rel, anchor, repl] = process.argv;
const f = path.join(root, rel);
if (!fs.existsSync(f)) { console.error('  ✘ missing: ' + rel); process.exit(2); }
let s = fs.readFileSync(f, 'utf8');
if (s.includes(repl) && !s.includes(anchor)) { console.log('  = already applied: ' + rel); process.exit(0); }
if (!s.includes(anchor)) { console.error('  ✘ anchor not found in ' + rel); process.exit(3); }
fs.writeFileSync(f, s.split(anchor).join(repl));
console.log('  ✓ patched: ' + rel);
NODE_PATCHER_EOF
}

echo "━━ Fix 1/3: auth.js — DUMMY_HASH cost → COST"
patch "core/auth.js" \
  "bcrypt.hashSync('nabz-dummy-' + crypto.randomBytes(4).toString('hex'), 8)" \
  "bcrypt.hashSync('nabz-dummy-' + crypto.randomBytes(4).toString('hex'), COST)" \
  || rollback
echo ""

echo "━━ Fix 2/3: store.js — invalidate() clears _dirty + _pc"
patch "core/store.js" \
  'function invalidate(c) { if (c) { _cache.delete(c); _chk.delete(c); _idx.delete(c); } else { _cache.clear(); _chk.clear(); _idx.clear(); } }' \
  'function invalidate(c) { const clean = k => { _cache.delete(k); _chk.delete(k); _idx.delete(k); _dirty.delete(k); _pc.delete(k); }; if (c) clean(c); else { _cache.clear(); _chk.clear(); _idx.clear(); _dirty.clear(); _pc.clear(); } }' \
  || rollback
echo ""

echo "━━ Fix 3/3: tools/gate.js — child kill on exit"
patch "tools/gate.js" \
  "let exited = false; child.on('exit', () => { exited = true; });" \
  "let exited = false; child.on('exit', () => { exited = true; });
  const killChild = () => { try { child.kill('SIGKILL'); } catch (_) {} };
  process.on('exit', killChild);
  process.on('SIGINT', () => { killChild(); process.exit(130); });
  process.on('SIGTERM', () => { killChild(); process.exit(143); });" \
  || rollback
echo ""

echo "━━ Syntax check"
for f in core/auth.js core/store.js tools/gate.js; do
  node -e "new Function(require('fs').readFileSync(process.argv[1],'utf8'))" "$ROOT/$f" 2>/dev/null \
    && echo "  ✓ $f" \
    || { echo "  ✘ $f syntax error"; rollback; }
done
echo ""

echo "━━ Verifying patches landed"
V=0
grep -q "nabz-dummy.*COST" "$ROOT/core/auth.js" || { echo "  ✘ auth.js not patched"; V=1; }
grep -q "_dirty.delete(k)" "$ROOT/core/store.js" || { echo "  ✘ store.js not patched"; V=1; }
grep -q "child.kill('SIGKILL')" "$ROOT/tools/gate.js" || { echo "  ✘ gate.js not patched"; V=1; }
[ "$V" = "0" ] || rollback
echo "  ✓ all 3 patches verified"
echo ""

echo "━━ Restart server"
pkill -TERM -f "core/server.js" 2>/dev/null || true
sleep 3
pkill -9 -f "core/server.js" 2>/dev/null || true
sleep 1
cd "$ROOT" && NODE_OPTIONS="--max-old-space-size=384" nohup node core/server.js > "$HOME/nabz-server.log" 2>&1 &
sleep 6
if pgrep -f "core/server.js" >/dev/null; then
  echo "  ✓ server running (pid $(pgrep -f 'core/server.js' | head -1))"
  grep -E "NABZ running|kernel warnings" "$HOME/nabz-server.log" | head -2 | sed 's/^/    /'
else
  echo "  ✘ server failed to start:"
  tail -20 "$HOME/nabz-server.log"
  rollback
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✓ Stage 28.1 applied — 3 fixes installed"
echo ""
echo "  1. auth.js   — DUMMY_HASH now uses bcrypt COST (timing leak closed)"
echo "  2. store.js  — invalidate() clears dirty + persisted-count state"
echo "  3. gate.js   — child server SIGKILLed on exit (no port zombie)"
echo ""
echo "  Rollback: tar -xzf $ARCH -C $ROOT"
echo "═══════════════════════════════════════════════════════"
