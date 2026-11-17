'use strict';
const sys = require('../core/domain/system-status');
const { execFile } = require('child_process');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let _testRunning = false;

const handlers = {
  status: () => sys.getStatus(),

  testRun: (ctx) => {
    if (!ctx.actor || ctx.actor.role !== 'admin') {
      const e = new Error('admin_only'); e.code = 'admin_only';
      if (ctx.E && ctx.E.forbidden) throw ctx.E.forbidden('admin_only');
      throw e;
    }
    if (_testRunning) return { ok: false, error: 'test_already_running' };
    _testRunning = true;
    return new Promise((resolve) => {
      const t0 = Date.now();
      execFile(process.execPath, ['tools/test-all.js'], { cwd: ROOT, timeout: 30000 }, (err, stdout) => {
        _testRunning = false;
        const ms = Date.now() - t0;
        const m = (stdout || '').match(/Results:\s+(\d+)\/(\d+)\s+passed/);
        const passed = m ? Number(m[1]) : 0;
        const total = m ? Number(m[2]) : 0;
        resolve({
          ok: passed === total && total > 0,
          passed, failed: total - passed, total,
          durationMs: ms,
          exitCode: err ? err.code : 0
        });
      });
    });
  }
};

module.exports = {
  handlers,
  routes: [
    { method: 'GET',  path: '/api/system/status',   handler: 'status',  perm: 'patients.view' },
    { method: 'POST', path: '/api/system/test-run', handler: 'testRun', perm: 'patients.view' }
  ],
  panels: [
    { id: 'system_status', title: 'وضعیت سیستم', icon: '🩺', perm: 'patients.view', kind: 'system_status', api: '/api/system/status' }
  ]
};
console.log('[system_status] loaded — health dashboard + test runner');
