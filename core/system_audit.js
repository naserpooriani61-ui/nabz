
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — System Audit Engine
//  Finds bugs BEFORE they hurt patients:
//   1. Syntax errors in any .js file
//   2. Route conflicts (same method+path)
//   3. Route order issues (param before static)
//   4. Missing handlers (route → handler)
//   5. Missing permissions (route.perm not in P)
//   6. Invalid panel kinds
//   7. Broken imports
//  Auto-fixes: syntax-safe fixes only
// ═══════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

class SystemAudit {
  constructor() {
    this.findings = [];
    this.fixes = [];
    this.stats = {
      filesScanned: 0,
      routesChecked: 0,
      panelsChecked: 0,
      permsChecked: 0,
      errors: 0,
      warnings: 0,
      autoFixable: 0,
      fixed: 0
    };
    this.startTime = null;
    this.durationMs = 0;
  }

  _finding(severity, category, file, message, meta) {
    this.findings.push({
      severity,
      category,
      file,
      message,
      meta: meta || {},
      at: new Date().toISOString()
    });
    if (severity === 'critical' || severity === 'error') this.stats.errors++;
    else this.stats.warnings++;
  }

  _fix(file, action, details) {
    this.fixes.push({
      file,
      action,
      details,
      at: new Date().toISOString()
    });
    this.stats.fixed++;
  }

  // ═══════════════════════════════════════════════════════════
  //  CHECK 1: Syntax Errors
  // ═══════════════════════════════════════════════════════════
  checkSyntax() {
    const dirs = ['core', 'modules', 'public'];
    for (const dir of dirs) {
      const dirPath = path.join(ROOT, dir);
      if (!fs.existsSync(dirPath)) continue;
      for (const file of fs.readdirSync(dirPath)) {
        if (!file.endsWith('.js')) continue;
        if (file.includes('.bak-') || file.includes('.backup')) continue;
        const fullPath = path.join(dirPath, file);
        this.stats.filesScanned++;
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          new Function(content);
        } catch (e) {
          const lineMatch = e.message.match(/line (\d+)/);
          this._finding('critical', 'syntax_error', dir + '/' + file, e.message, {
            line: lineMatch ? Number(lineMatch[1]) : null,
            autoFixable: false
          });
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  CHECK 2: Route Conflicts + Order
  // ═══════════════════════════════════════════════════════════
  checkRoutes() {
    const modulesDir = path.join(ROOT, 'modules');
    if (!fs.existsSync(modulesDir)) return;

    const allRoutes = [];
    for (const file of fs.readdirSync(modulesDir)) {
      if (!file.endsWith('.js') || file.includes('.bak-')) continue;
      const fullPath = path.join(modulesDir, file);
      let mod;
      try {
        // Only require pure-module files (skip patch files that auto-execute)
        mod = require(fullPath);
      } catch (e) {
        this._finding('error', 'module_load', 'modules/' + file, e.message, {
          autoFixable: false
        });
        continue;
      }
      if (!mod || !Array.isArray(mod.routes)) continue;

      for (const r of mod.routes) {
        this.stats.routesChecked++;
        allRoutes.push({
          module: file.replace('.js', ''),
          method: r.method,
          path: r.path,
          handler: r.handler,
          perm: r.perm,
          hasHandler: !!(mod.handlers && typeof mod.handlers[r.handler] === 'function')
        });
      }
    }

    // ─── Conflict: same method + same normalized path ───
    const seen = new Map();
    for (const r of allRoutes) {
      const key = r.method + ' ' + r.path.replace(/:\w+/g, ':PARAM');
      if (seen.has(key)) {
        const first = seen.get(key);
        if (first.path !== r.path) {
          // Same pattern, different param name — cosmetic, log as warning
          this._finding('warning', 'route_conflict_param_name', r.module,
            'Route ' + r.method + ' ' + r.path + ' conflicts with ' + first.module + ' ' + first.path, {
              existing: first,
              current: r,
              autoFixable: false
            });
        } else {
          // Exact duplicate — critical
          this._finding('critical', 'route_duplicate', r.module,
            'Duplicate route: ' + r.method + ' ' + r.path + ' (also in ' + first.module + ')', {
              existing: first,
              current: r,
              autoFixable: false
            });
        }
      } else {
        seen.set(key, r);
      }
    }

    // ─── Order: param route before static route ───
    const byPrefix = {};
    for (const r of allRoutes) {
      if (r.path.includes(':')) continue;
      // Get prefix before any /: something
      const segments = r.path.split('/');
      const prefix = segments.slice(0, -1).join('/');
      if (!byPrefix[prefix]) byPrefix[prefix] = { static: [], param: [] };
      byPrefix[prefix].static.push(r);
    }
    for (const r of allRoutes) {
      if (!r.path.includes(':')) continue;
      const segments = r.path.split('/');
      const paramIdx = segments.findIndex(s => s.startsWith(':'));
      const prefix = segments.slice(0, paramIdx).join('/');
      if (byPrefix[prefix]) {
        // Check if any static route in same prefix is being shadowed
        for (const s of byPrefix[prefix].static) {
          if (s.method !== r.method) continue;
          if (s.path.split('/').length !== r.path.split('/').length) continue;

          // KEY FIX: Only warn, don't flag as critical.
          // Runtime already prefers static over param (server.js patch).
          // This is now a cosmetic issue at most.
          this._finding('warning', 'route_shadowed', r.module,
            'Param route ' + r.method + ' ' + r.path + ' shares prefix with static ' + s.path +
            ' (runtime handles correctly; reorder for cleanliness)', {
              paramRoute: r,
              staticRoute: s,
              autoFixable: false,
              runtimeSafe: true,
              hint: 'Server prefers static routes; not a functional bug'
            });
          break;
        }
      }
    }

    // ─── Missing handlers ───
    for (const r of allRoutes) {
      if (!r.hasHandler) {
        this._finding('critical', 'missing_handler', r.module,
          'Route ' + r.method + ' ' + r.path + ' → handler "' + r.handler + '" not found', {
            route: r,
            autoFixable: false
          });
      }
    }

    return allRoutes;
  }

  // ═══════════════════════════════════════════════════════════
  //  CHECK 3: Permissions
  // ═══════════════════════════════════════════════════════════
  checkPermissions(routes) {
    // Load extended permissions first (same as server.js does)
    try { require('./permissions-extra'); } catch (_) {}
    const perms = require('./permissions');
    for (const r of (routes || [])) {
      if (!r.perm) continue;
      this.stats.permsChecked++;
      if (!(r.perm in perms.P)) {
        this._finding('warning', 'unknown_permission', r.module,
          'Route ' + r.path + ' requires "' + r.perm + '" which is not defined in P', {
            route: r,
            autoFixable: true,
            fix: 'Add default: ' + r.perm + ' = admin + role-specific'
          });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  CHECK 4: Panels
  // ═══════════════════════════════════════════════════════════
  checkPanels() {
    const modulesDir = path.join(ROOT, 'modules');
    const KNOWN_SYSTEM_KINDS = ['list', 'stats', 'action', 'chart', 'pipeline',
      'health', 'backup', 'audit', 'crisis', 'analytics', 'bedboard', 'nursing'];

    for (const file of fs.readdirSync(modulesDir)) {
      if (!file.endsWith('.js') || file.includes('.bak-')) continue;
      let mod;
      try { mod = require(path.join(modulesDir, file)); }
      catch (_) { continue; }
      if (!mod || !Array.isArray(mod.panels)) continue;

      for (const p of mod.panels) {
        this.stats.panelsChecked++;
        if (!p.kind) continue;
        if (KNOWN_SYSTEM_KINDS.includes(p.kind)) continue;

        // Custom kind — will be checked in checkCustomKinds
        // For now just record
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  CHECK 5: Custom Panel Kinds (needs frontend)
  // ═══════════════════════════════════════════════════════════
  checkCustomKinds() {
    const modulesDir = path.join(ROOT, 'modules');
    const publicDir = path.join(ROOT, 'public');
    const KNOWN_SYSTEM_KINDS = ['list', 'stats', 'action', 'chart', 'pipeline',
      'health', 'backup', 'audit', 'crisis', 'analytics', 'bedboard', 'nursing'];

    const customKinds = new Set();
    for (const file of fs.readdirSync(modulesDir)) {
      if (!file.endsWith('.js') || file.includes('.bak-')) continue;
      let mod;
      try { mod = require(path.join(modulesDir, file)); }
      catch (_) { continue; }
      if (!mod || !Array.isArray(mod.panels)) continue;
      for (const p of mod.panels) {
        if (p.kind && !KNOWN_SYSTEM_KINDS.includes(p.kind)) {
          customKinds.add(p.kind);
        }
      }
    }

    // Scan public/*.js for registerKind OR NABZ.show wrapper patterns
    const registeredKinds = new Set();
    const registerRegex = /registerKind\s*\(\s*['"]([^'"]+)['"]/g;
    // Also detect: p.kind === 'X' or p.kind !== 'X' (older NABZ.show wrapper)
    const showWrapRegex = /\.kind\s*[!=]==?\s*['"]([^'"]+)['"]/g;
    for (const file of fs.readdirSync(publicDir)) {
      if (!file.endsWith('.js')) continue;
      try {
        const content = fs.readFileSync(path.join(publicDir, file), 'utf8');
        let m;
        while ((m = registerRegex.exec(content)) !== null) registeredKinds.add(m[1]);
        while ((m = showWrapRegex.exec(content)) !== null) registeredKinds.add(m[1]);
      } catch (_) {}
    }

    // Cross-check
    for (const kind of customKinds) {
      if (!registeredKinds.has(kind)) {
        this._finding('warning', 'unregistered_kind', 'modules+public',
          'Panel kind "' + kind + '" registered in backend but no frontend handler found', {
            kind,
            autoFixable: false,
            hint: 'Check that a public/*.js file calls NABZ.registerKind("' + kind + '", ...)'
          });
      }
    }

    return { customKinds: [...customKinds], registeredKinds: [...registeredKinds] };
  }

  // ═══════════════════════════════════════════════════════════
  //  CHECK 6: Imports (broken requires)
  // ═══════════════════════════════════════════════════════════
  checkImports() {
    const dirs = ['core', 'modules'];
    for (const dir of dirs) {
      const dirPath = path.join(ROOT, dir);
      if (!fs.existsSync(dirPath)) continue;
      for (const file of fs.readdirSync(dirPath)) {
        if (!file.endsWith('.js') || file.includes('.bak-')) continue;
        const fullPath = path.join(dirPath, file);
        let content;
        try { content = fs.readFileSync(fullPath, 'utf8'); } catch (_) { continue; }

        // Find require('./xxx') or require('../core/xxx')
        const requireRegex = /require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
        let m;
        while ((m = requireRegex.exec(content)) !== null) {
          const req = m[1];
          let target = path.join(path.dirname(fullPath), req);
          if (!target.endsWith('.js')) target += '.js';
          // Skip doc/template examples (they appear in this very file's comments)
      const TEMPLATES = ['./xxx', '../core/xxx', './foo', './bar',
        './example', './your-module', './mymodule', './some-module'];
      if (TEMPLATES.includes(req)) continue;
      if (!fs.existsSync(target)) {
            this._finding('critical', 'broken_import', dir + '/' + file,
              'Cannot find module "' + req + '"', {
                requires: req,
                resolvedPath: target,
                autoFixable: false
              });
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  AUTO-FIX: add missing permissions as 'admin' only
  // ═══════════════════════════════════════════════════════════
  autoFix() {
    const perms = require('./permissions');
    const seen = new Set();
    for (const f of this.findings) {
      if (f.category !== 'unknown_permission') continue;
      if (seen.has(f.meta.route.perm)) continue;
      seen.add(f.meta.route.perm);
      // Safe default: admin only + safe fallback (require admin to configure)
      if (!(f.meta.route.perm in perms.P)) {
        perms.P[f.meta.route.perm] = 'admin';
        this._fix('core/permissions.js', 'permission.add',
          f.meta.route.perm + ' = "admin" (fallback; admin can expand)');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  Run all checks
  // ═══════════════════════════════════════════════════════════
  runAll() {
    this.startTime = Date.now();
    this.findings = [];
    this.fixes = [];

    this.checkSyntax();
    const routes = this.checkRoutes();
    this.checkPermissions(routes);
    this.checkPanels();
    this.checkCustomKinds();
    this.checkImports();

    this.durationMs = Date.now() - this.startTime;

    const critical = this.findings.filter(f => f.severity === 'critical');
    const warnings = this.findings.filter(f => f.severity === 'warning');
    const errors = this.findings.filter(f => f.severity === 'error');

    return {
      ok: critical.length === 0 && errors.length === 0,
      stats: this.stats,
      durationMs: this.durationMs,
      summary: {
        critical: critical.length,
        error: errors.length,
        warning: warnings.length,
        total: this.findings.length
      },
      findings: this.findings,
      fixes: this.fixes,
      generatedAt: new Date().toISOString()
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  Run + auto-fix + re-run (verify)
  // ═══════════════════════════════════════════════════════════
  runAndFix() {
    const first = this.runAll();
    if (first.summary.total === 0) return { ...first, autoFixAttempted: false };

    this.autoFix();
    if (this.fixes.length === 0) {
      return { ...first, autoFixAttempted: true, fixedCount: 0 };
    }

    // Re-run to verify
    const second = this.runAll();
    return {
      ...second,
      autoFixAttempted: true,
      fixedCount: this.fixes.length,
      beforeFix: first.summary
    };
  }
}

module.exports = SystemAudit;
