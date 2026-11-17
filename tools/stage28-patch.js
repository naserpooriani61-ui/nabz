#!/usr/bin/env node
'use strict';
// Anchored, all-or-nothing patches of existing files (function replacers: no "$" pitfalls).
const fs = require('fs'), path = require('path');
const root = process.argv[2] || path.join(process.env.HOME, 'nabz');
const OPS = [
  { file: 'core/ward-resolver.js', expect: 1, from: "return items.filter(x => set.has(x[wardField] || x.ward));",
    to: "return items.filter(x => set.has(normalizeWardCode(x[wardField] || x.ward)));" },
  { file: 'core/ward-resolver.js', expect: 1, from: "const svc = x[serviceField] || serviceForWard(x[wardField] || x.ward);",
    to: "const svc = x[serviceField] || serviceForWard(normalizeWardCode(x[wardField] || x.ward));" },
  { file: 'core/permissions.js', expect: 1, from: "console.warn('[scope] ' + (user.username || user.id) + ' — ' + scopeInfo.reason);",
    to: "{ const k = user.id || user.username, now = Date.now(); global.__nabzScopeWarn = global.__nabzScopeWarn || {}; if (!global.__nabzScopeWarn[k] || now - global.__nabzScopeWarn[k] > 60000) { global.__nabzScopeWarn[k] = now; console.warn('[scope] ' + (user.username || user.id) + ' — ' + scopeInfo.reason); } }" },
  { file: 'modules/zz_auth_users.js', expect: 2, from: "plainHint: 'Sin@' + last4,", to: "mustChangePassword: true," }
];
const plan = [];
for (const op of OPS) {
  const f = path.join(root, op.file);
  if (!fs.existsSync(f)) { console.error('STOP: missing file ' + op.file); process.exit(2); }
  const src = fs.readFileSync(f, 'utf8');
  const n = src.split(op.from).length - 1;
  if (n === 0 && src.includes(op.to)) { console.log('= already applied: ' + op.file); continue; }
  if (n !== op.expect) { console.error('STOP: anchor count ' + n + ' (expected ' + op.expect + ') in ' + op.file + '\n  anchor: ' + op.from); process.exit(3); }
  plan.push({ f, op });
}
const byFile = {};
for (const { f, op } of plan) { byFile[f] = (byFile[f] || fs.readFileSync(f, 'utf8')).split(op.from).join(op.to); }
for (const [f, s] of Object.entries(byFile)) { fs.writeFileSync(f, s); console.log('✔ patched ' + path.relative(root, f)); }
console.log('patch complete (' + plan.length + ' operations)');
