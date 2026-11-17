#!/usr/bin/env bash
OUT=tools/diag-erf2.out; mkdir -p tools; : > "$OUT"
say(){ echo "$@" | tee -a "$OUT"; }
EX="--exclude-dir=node_modules --exclude-dir=backups --exclude-dir=.git"
say "== A) section 1-3 of previous run =="
sed -n '/== 1)/,/== 4)/p' tools/diag-erf.out 2>/dev/null | tee -a "$OUT"
say "== B) erf_ui.js: size, exported kinds, registration =="
wc -l public/erf_ui.js 2>/dev/null | tee -a "$OUT"
grep -nE "registerPanel|panelKinds|kinds\[|kind *[:=]|NABZ\.(panel|render)|window\.E *=|E\.(register|render)" public/erf_ui.js 2>/dev/null | head -25 | tee -a "$OUT"
say "== C) script tags / load order in index.html =="
grep -nE "<script" public/index.html 2>/dev/null | grep -E "erf|zz_|app\.js" | tee -a "$OUT"
say "== D) where permissions are defined (ed.* lines) =="
grep -rnE $EX "ed\.(view|triage|manage|code|order)" core 2>/dev/null | head -12 | tee -a "$OUT"
say "== E) which module owns er_* panels and /api/erf routes =="
grep -rlE $EX "id: *'er_|/api/erf/" modules core public 2>/dev/null | tee -a "$OUT"
say "== F) panel ids er_* defined (all files) =="
grep -rnoE $EX "id: *'er_[a-z_]+'" modules public 2>/dev/null | head -20 | tee -a "$OUT"
say "== G) server start errors (last 15 lines of log, if any) =="
ls -t *.log logs/*.log 2>/dev/null | head -1 | xargs -r tail -15 | tee -a "$OUT"
say "== H) live HTTP (start server first: npm start in another session) =="
for P in ${PORT:-3000} 8080 5000 3001; do
  say "port $P -> $(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:$P/api/erf/meta 2>/dev/null)"
done
say "saved: $OUT"
