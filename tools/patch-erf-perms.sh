#!/usr/bin/env bash
set -u
F=core/permissions.js
[ -f "$F" ] || { echo "core/permissions.js not found - run from NABZ root"; exit 1; }
mkdir -p backups; B="backups/permissions.js.pre-erf.$(date +%s)"; cp "$F" "$B" && echo "backup: $B"
node - <<'JS'
const fs=require('fs');const f='core/permissions.js';let s=fs.readFileSync(f,'utf8');
const R='admin,supervisor_er,physician,resident,attending,nurse,head_nurse';
const add={'ed.manage':'admin,supervisor_er,head_nurse','ed.code':R,'ed.order':R};
const re=/^([ \t]*)'ed\.code\.activate'\s*:\s*'[^']*',?[ \t]*$/m;
const m=s.match(re); if(!m){console.log('ANCHOR NOT FOUND - nothing changed');process.exit(2)}
let ins='';for(const [k,v] of Object.entries(add)){ if(!s.includes("'"+k+"'")) ins+='\n'+m[1]+"'"+k+"': '"+v+"',"}
if(!ins){console.log('already present');process.exit(0)}
const line=m[0].replace(/[ \t]+$/,'');
s=s.replace(m[0],(line.endsWith(',')?line:line+',')+ins);
fs.writeFileSync(f,s);console.log('patched: '+Object.keys(add).filter(k=>ins.includes("'"+k+"'")).join(', '));
JS
rc=$?
if [ $rc -ne 0 ]; then echo "no change (rc=$rc)"; exit $rc; fi
if node --check "$F"; then echo "syntax OK"; else cp "$B" "$F"; echo "ROLLED BACK"; exit 3; fi
