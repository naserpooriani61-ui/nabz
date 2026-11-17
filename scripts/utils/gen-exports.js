
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUT = path.join(process.env.HOME, 'nabz-exports');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function readSafe(p) {
  try { return { ok: true, content: fs.readFileSync(p, 'utf8'), size: fs.statSync(p).size }; }
  catch (e) { return { ok: false, error: e.message }; }
}

function walkDir(dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full)
    .filter(f => f.endsWith('.js') && !f.includes('.bak-') && !f.includes('.tmp'))
    .sort()
    .map(f => dir + '/' + f);
}

function formatFile(relPath, content, size) {
  const lines = content.split('\n').length;
  return '\n' + '═'.repeat(80) + '\n' +
         'FILE: ' + relPath + '\n' +
         'LINES: ' + lines + '\n' +
         'SIZE: ' + size + ' bytes\n' +
         '═'.repeat(80) + '\n\n' +
         content + (content.endsWith('\n') ? '' : '\n') + '\n';
}

const CLINICAL = [
  'clinical', 'emergency', 'emergency_full', 'workflow', 'paraclinical',
  'safety', 'encounters', 'cdss', 'mar_advanced', 'nursing_care_plan',
  'nursing_handoff_bridge', 'discharge_transition', 'doc_excellence',
  'clinical_protocols', 'clinical_enhancements_v3', 'zz_order_sets_v2'
];

function buildFoundation() {
  const files = ['package.json'].concat(walkDir('core'));
  let out = '', header = '';
  header += '═'.repeat(90) + '\n';
  header += 'NABZ — FILE 01 of 05: FOUNDATION\n';
  header += 'Generated: ' + new Date().toISOString() + '\n';
  header += 'Contains: package.json + all core/*.js\n';
  header += '═'.repeat(90) + '\n\nCONTENTS:\n';
  for (const f of files) {
    const full = path.join(ROOT, f);
    if (!fs.existsSync(full)) { header += '  ✗ ' + f + ' (missing)\n'; continue; }
    const r = readSafe(full);
    if (!r.ok) { header += '  ✗ ' + f + ' (error)\n'; continue; }
    header += '  ✓ ' + f + ' (' + r.content.split('\n').length + ' lines)\n';
    out += formatFile(f, r.content, r.size);
  }
  return header + '\n' + '═'.repeat(90) + '\n\n' + out;
}

function buildClinical() {
  let out = '', header = '';
  header += '═'.repeat(90) + '\n';
  header += 'NABZ — FILE 02 of 05: CLINICAL\n';
  header += 'Generated: ' + new Date().toISOString() + '\n';
  header += 'Contains: 16 clinical modules\n';
  header += '═'.repeat(90) + '\n\nCONTENTS:\n';
  for (const name of CLINICAL) {
    const f = 'modules/' + name + '.js';
    const full = path.join(ROOT, f);
    if (!fs.existsSync(full)) { header += '  ✗ ' + f + ' (missing)\n'; continue; }
    const r = readSafe(full);
    if (!r.ok) { header += '  ✗ ' + f + ' (error)\n'; continue; }
    header += '  ✓ ' + f + ' (' + r.content.split('\n').length + ' lines)\n';
    out += formatFile(f, r.content, r.size);
  }
  return header + '\n' + '═'.repeat(90) + '\n\n' + out;
}

function buildOperational() {
  let out = '';
  const allModules = walkDir('modules');
  const operational = allModules.filter(f => {
    const name = path.basename(f, '.js');
    return CLINICAL.indexOf(name) < 0;
  });
  let header = '';
  header += '═'.repeat(90) + '\n';
  header += 'NABZ — FILE 03 of 05: OPERATIONAL\n';
  header += 'Generated: ' + new Date().toISOString() + '\n';
  header += 'Contains: ' + operational.length + ' operational modules\n';
  header += '═'.repeat(90) + '\n\nCONTENTS:\n';
  for (const f of operational) {
    const r = readSafe(path.join(ROOT, f));
    if (r.ok) header += '  ✓ ' + f + ' (' + r.content.split('\n').length + ' lines)\n';
  }
  header += '\n' + '═'.repeat(90) + '\n\n';
  for (const f of operational) {
    const r = readSafe(path.join(ROOT, f));
    if (r.ok) out += formatFile(f, r.content, r.size);
  }
  return header + out;
}

function buildFrontend() {
  let out = '';
  const topFiles = ['public/index.html', 'public/style.css', 'public/manifest.webmanifest'];
  const jsFiles = walkDir('public');
  const all = topFiles.concat(jsFiles);
  let header = '';
  header += '═'.repeat(90) + '\n';
  header += 'NABZ — FILE 04 of 05: FRONTEND\n';
  header += 'Generated: ' + new Date().toISOString() + '\n';
  header += 'Contains: index.html + style.css + manifest + all public/*.js\n';
  header += '═'.repeat(90) + '\n\nCONTENTS (' + all.length + ' files):\n';
  for (const f of all) {
    const full = path.join(ROOT, f);
    if (!fs.existsSync(full)) continue;
    const r = readSafe(full);
    if (r.ok) header += '  ✓ ' + f + ' (' + r.content.split('\n').length + ' lines, ' + r.size + ' bytes)\n';
  }
  header += '\n' + '═'.repeat(90) + '\n\n';
  for (const f of all) {
    const full = path.join(ROOT, f);
    if (!fs.existsSync(full)) continue;
    const r = readSafe(full);
    if (r.ok) out += formatFile(f, r.content, r.size);
  }
  return header + out;
}

const jobs = [
  { name: '01-FOUNDATION.txt', fn: buildFoundation },
  { name: '02-CLINICAL.txt', fn: buildClinical },
  { name: '03-OPERATIONAL.txt', fn: buildOperational },
  { name: '04-FRONTEND.txt', fn: buildFrontend }
];

console.log('');
console.log('═══ GENERATING FILES 01-04 ═══');
for (const j of jobs) {
  try {
    const content = j.fn();
    const p = path.join(OUT, j.name);
    fs.writeFileSync(p, content, 'utf8');
    const lines = content.split('\n').length;
    const kb = Math.round(Buffer.byteLength(content, 'utf8') / 1024);
    console.log('  ✅ ' + j.name + '  (' + lines + ' lines, ' + kb + ' KB)');
  } catch (e) {
    console.error('  ❌ ' + j.name + ': ' + e.message);
  }
}
console.log('');
console.log('Output: ' + OUT);
