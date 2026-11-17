'use strict';
// tools/nabz-health.js — NABZ backend health monitor
const fs = require('fs'), path = require('path');
const R = path.resolve(__dirname, '..');
const rf = (p) => { try { return fs.readFileSync(path.join(R, p), 'utf8'); } catch(_) { return ''; } };
const cnt = (s, re) => (s.match(re) || []).length;
const isClean = (s, coll) => cnt(s, new RegExp(`store\\.put\\(['"]${coll}['"]`, 'g')) === 0;

const DOMAINS = {
  orders:   { files: ['clinical', 'clinical_protocols', 'rounds_v2', 'teaching_mode', 'nursing_workspace', 'encounters'] },
  consults: { files: ['encounters', 'rounds_v2', 'workflow'] },
  mar:      { files: ['clinical', 'nursing_workspace', 'mar_advanced'] },
  vitals:   { files: ['clinical', 'nursing_mode', 'flow'] },
  transfers:  { files: ['workflow'] },
  handovers:  { files: ['workflow'] },
  discharges: { files: ['workflow', 'discharge_transition', 'flow'] }
};

console.log('\n═══════════════════════════════════════════');
console.log('  NABZ HEALTH REPORT   ' + new Date().toISOString().slice(0,19));
console.log('═══════════════════════════════════════════\n');

let allClean = true;
console.log('📊 DOMAINS:');
for (const [coll, cfg] of Object.entries(DOMAINS)) {
  let totalPuts = 0, dirtyFiles = [];
  for (const f of cfg.files) {
    const s = rf(`modules/${f}.js`);
      if (!s) { dirtyFiles.push(f + ':MISSING'); totalPuts += 1; continue; }
    const p = cnt(s, new RegExp(`store\\.put\\(['"]${coll}['"]`, 'g'));
    if (p > 0) { dirtyFiles.push(`${f}:${p}`); totalPuts += p; }
  }
  const ok = totalPuts === 0;
  if (!ok) allClean = false;
  console.log(`  ${ok ? '✅' : '⚠️ '} ${coll.padEnd(10)} ${ok ? 'clean' : 'puts=' + totalPuts + ' [' + dirtyFiles.join(', ') + ']'}`);
}

console.log('\n🎯 CORE MODULES:');
['order-writer', 'vitals-writer', 'mar-writer', 'consult-writer', 'alert-persister', 'news2', 'transfer-writer', 'handover-writer'].forEach(m => {
  const exists = rf(`core/domain/${m}.js`).length > 0;
  console.log(`  ${exists ? '✅' : '❌'} core/domain/${m}.js`);
});

console.log('\n🎯 EVENT BUS:');
const ev = rf('core/events.js');
console.log(`  ${ev.includes('_snap') ? '✅' : '❌'} snapshot for subscribers`);
console.log(`  ${ev.includes('_buf') ? '✅' : '❌'} buffered writes`);
console.log(`  ${ev.includes("process.on('exit'") ? '✅' : '❌'} flush on exit`);

console.log('\n🎯 STATE MACHINES:');
const sm = rf('core/state-machine.js');
['order', 'mar', 'consult', 'ed_visit', 'ed_code', 'transfer'].forEach(m => {
  console.log(`  ${sm.includes(m + ':') ? '✅' : '❌'} ${m}`);
});

console.log('\n🎯 ALERT PIPELINE:');
const srv = rf('core/server.js');
console.log(`  ${rf('core/domain/alert-persister.js').length ? '✅' : '❌'} alert-persister.js`);
console.log(`  ${srv.includes('alert-persister') ? '✅' : '❌'} wired in server.js`);

console.log('\n═══════════════════════════════════════════');
if (allClean) console.log('  ✅ ALL DOMAINS UNIFIED — backend 100% consistent');
else console.log('  ⚠️  SOME DOMAINS HAVE RAW store.put CALLS — see above');
console.log('═══════════════════════════════════════════\n');
