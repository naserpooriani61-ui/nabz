'use strict';
const fs = require('fs');
const path = require('path');

const lines = [];
function out(s) { lines.push(s); console.log(s); }

out('# NABZ — Neural Hospital Operating System');
out('');
out('**Generated:** ' + new Date().toISOString());
out('');

// ── Modules ──
out('## ماژول‌ها');
out('');
out('| ماژول | Routes | Panels | Collections |');
out('|--------|--------|--------|-------------|');

const modDir = path.join(__dirname, 'modules');
const mods = fs.readdirSync(modDir).filter(f => f.endsWith('.js')).sort();
let totalRoutes = 0, totalPanels = 0;

for (const f of mods) {
  try {
    const m = require(path.join(modDir, f));
    const routes = (m.routes || []).length;
    const panels = (m.panels || []).length;
    totalRoutes += routes;
    totalPanels += panels;
    const name = f.replace('.js', '');
    out(`| ${name} | ${routes} | ${panels} | — |`);
  } catch (e) {
    out(`| ${f} | ERROR | ${e.message.slice(0, 30)} | — |`);
  }
}
out('');
out(`**Total:** ${mods.length} ماژول · ${totalRoutes} روت · ${totalPanels} پنل`);
out('');

// ── Frontend files ──
out('## فایل‌های Frontend');
out('');
const pubDir = path.join(__dirname, 'public');
const pubFiles = fs.readdirSync(pubDir).filter(f => f.endsWith('.js') || f.endsWith('.css') || f.endsWith('.html')).sort();
for (const f of pubFiles) {
  const size = (fs.statSync(path.join(pubDir, f)).size / 1024).toFixed(1);
  out(`- \`public/${f}\` — ${size} KB`);
}
out('');

// ── Data ──
out('## داده');
out('');
const dataDir = path.join(__dirname, 'data');
if (fs.existsSync(dataDir)) {
  const dataFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.json')).sort();
  const interesting = ['patients','wf_staff','sa_wards','sa_staff','sa_assignments','beds','questions','learning_objects','edu_micro','edu_cohorts','exams','vitals','mar','orders'];
  for (const f of dataFiles) {
    const name = f.replace('.json', '');
    try {
      const d = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
      const count = Array.isArray(d) ? d.length : (typeof d === 'object' ? Object.keys(d).length : 0);
      if (interesting.includes(name) || count > 0) {
        out(`- \`${f}\` — ${count} رکورد`);
      }
    } catch (_) {}
  }
}
out('');

// ── Core files ──
out('## هسته');
out('');
const coreDir = path.join(__dirname, 'core');
const coreFiles = fs.readdirSync(coreDir).filter(f => f.endsWith('.js')).sort();
for (const f of coreFiles) {
  const size = (fs.statSync(path.join(coreDir, f)).size / 1024).toFixed(1);
  out(`- \`core/${f}\` — ${size} KB`);
}
out('');

// ── Deploy instructions ──
out('## راه‌اندازی');
out('');
out('```bash');
out('cd ~/nabz');
out('export NODE_OPTIONS="--max-old-space-size=384"');
out('node core/server.js');
out('# → http://localhost:4000');
out('# admin / nabz@2026');
out('```');
out('');
out('**PIN login پرسنل:**');
out('```');
out('کد: 5059258191 (مینا نجفی حقی)');
out('PIN: 8191 (۴ رقم آخر)');
out('```');
out('');

// ── Routes detail ──
out('## همه Routes');
out('');
for (const f of mods) {
  try {
    const m = require(path.join(modDir, f));
    if (!(m.routes || []).length) continue;
    out(`### ${f.replace('.js', '')}`);
    out('');
    for (const r of m.routes) {
      out(`- \`${r.method} ${r.path}\` — perm: \`${r.perm || 'public'}\``);
    }
    out('');
  } catch (_) {}
}

// ── Panels ──
out('## همه Panels');
out('');
for (const f of mods) {
  try {
    const m = require(path.join(modDir, f));
    if (!(m.panels || []).length) continue;
    out(`### ${f.replace('.js', '')}`);
    out('');
    for (const p of m.panels) {
      out(`- **${p.id}** — ${p.title} · kind:\`${p.kind || 'list'}\` · icon:${p.icon || ''}`);
    }
    out('');
  } catch (_) {}
}

fs.writeFileSync(path.join(__dirname, 'DOCS.md'), lines.join('\n'));
console.log('');
console.log('✅ DOCS.md ساخته شد (' + lines.length + ' خط)');
