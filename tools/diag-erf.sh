#!/usr/bin/env bash
OUT=tools/diag-erf.out; mkdir -p tools; : > "$OUT"
say(){ echo "$@" | tee -a "$OUT"; }
EX="--exclude-dir=node_modules --exclude-dir=backups --exclude-dir=.git"
say "== 1) module files =="
FILES=$(find . -name 'emergency*.js' -not -path './node_modules/*' -not -path './backups/*' 2>/dev/null)
say "${FILES:-NOT FOUND}"
for f in $FILES; do
  node --check "$f" 2>&1 | head -3 | tee -a "$OUT"
  node -e "try{const m=require(require('path').resolve('$f'));console.log('load OK routes='+(m.routes||[]).length+' panels='+(m.panels||[]).length)}catch(e){console.log('LOAD FAIL: '+e.message.split('\n')[0])}" 2>&1 | tee -a "$OUT"
done
say "== 2) panel kinds vs frontend renderers =="
for k in erf_dashboard erf_beds erf_codes erf_orders erf_stats; do
  n=$(grep -rl $EX "$k" public 2>/dev/null | wc -l)
  [ "$n" -gt 0 ] && say "$k: FOUND in $n public file(s)" || say "$k: MISSING in public/  <- panel has no renderer"
done
say "== 3) how the loader consumes module.panels / module.routes =="
grep -rnE $EX "\.panels|\.routes" core 2>/dev/null | head -12 | tee -a "$OUT"
say "== 4) permissions registered? =="
for p in ed.view ed.manage ed.triage ed.code ed.order; do
  n=$(grep -rlF $EX "'$p'" core modules 2>/dev/null | grep -v emergency | wc -l)
  say "$p: referenced in $n other file(s)"
done
say "== 5) duplicate /api/erf or er_ panel ids elsewhere =="
grep -rnE $EX "/api/erf/|id: 'er_" modules core public 2>/dev/null | grep -v emergency_full | head -10 | tee -a "$OUT"
say "== 6) live HTTP (404 = route not registered, 401/403 = registered) =="
for P in ${PORT:-3000} 8080 5000; do
  c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$P/api/erf/meta" 2>/dev/null)
  say "port $P -> ${c:-no-server}"
done
say "saved: $OUT"
