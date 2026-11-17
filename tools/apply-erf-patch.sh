#!/usr/bin/env bash
F=modules/emergency_full.js
[ -f "$F" ] || { echo "run from NABZ root ($F missing)"; exit 1; }
mkdir -p backups; B="backups/emergency_full.js.pre-v3.$(date +%s)"; cp "$F" "$B" && echo "backup: $B"
node tools/erf-patch-v3.js "$F"; rc=$?
[ $rc -ne 0 ] && { echo "no change"; exit $rc; }
if node --check "$F"; then echo "syntax OK"; else cp "$B" "$F"; echo "ROLLED BACK"; exit 3; fi
