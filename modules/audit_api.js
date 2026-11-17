
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Audit API + Panel
//  Endpoints:
//    GET  /api/sysaudit/run          → run full audit
//    GET  /api/sysaudit/run-and-fix  → run + auto-fix + re-run
//    GET  /api/sysaudit/quick        → quick summary
// ═══════════════════════════════════════════════════════════
const SystemAudit = require('../core/system_audit');
const perms = require('../core/permissions');

if (!perms.P['sysaudit.view']) {
  perms.P['sysaudit.view'] = 'admin';
  perms.P['sysaudit.fix'] = 'admin';
}

// Cache last audit result
let _lastAudit = null;
let _lastRunAt = null;

function run(ctx) {
  const audit = new SystemAudit();
  const result = audit.runAll();
  _lastAudit = result;
  _lastRunAt = new Date().toISOString();
  ctx.audit.write('audit_api', 'sysaudit.run', 'full', ctx.actor, {
    critical: result.summary.critical,
    warnings: result.summary.warning
  });
  return result;
}

function runAndFix(ctx) {
  const audit = new SystemAudit();
  const result = audit.runAndFix();
  _lastAudit = result;
  _lastRunAt = new Date().toISOString();
  ctx.audit.write('audit_api', 'sysaudit.run_and_fix', 'full', ctx.actor, {
    fixed: result.fixedCount || 0,
    remaining: result.summary ? result.summary.critical : '?'
  });
  return result;
}

function quick(ctx) {
  if (!_lastAudit) {
    return { cached: false, message: 'Run full audit first' };
  }
  return {
    cached: true,
    lastRunAt: _lastRunAt,
    summary: _lastAudit.summary,
    stats: _lastAudit.stats,
    criticalSample: _lastAudit.findings
      .filter(f => f.severity === 'critical')
      .slice(0, 10)
  };
}

module.exports = {
  handlers: { run, runAndFix, quick },
  routes: [
    { method:'GET', path:'/api/sysaudit/run', handler:'run', perm:'sysaudit.view' },
    { method:'GET', path:'/api/sysaudit/run-and-fix', handler:'runAndFix', perm:'sysaudit.fix' },
    { method:'GET', path:'/api/sysaudit/quick', handler:'quick', perm:'sysaudit.view' }
  ],
  panels: [
    { id:'dashboard', title:'تشخیص سیستم', icon:'🔬', perm:'sysaudit.view',
      kind:'sysaudit_dashboard', api:'/api/sysaudit/quick' }
  ]
};

console.log('[audit-api] loaded — endpoints: /api/sysaudit/*');
