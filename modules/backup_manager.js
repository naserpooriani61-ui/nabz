
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Backup Manager
//  Hourly automatic backups + retention + selective restore + health
// ═══════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const store = require('../core/store');
const perms = require('../core/permissions');
const audit = require('../core/audit');

const DATA = store.DATA;
const BACKUP_DIR = path.join(DATA, '_backups');
const CONFIG_FILE = path.join(DATA, '_backup_config.json');
const INDEX_FILE = path.join(DATA, '_backup_index.json');

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

if (!perms.P['backup.view']) {
  perms.P['backup.view'] = 'admin,hospital_director,it_staff';
  perms.P['backup.manage'] = 'admin,it_staff';
}

// ═══════════════════════════════════════════════════════════
//  Config
// ═══════════════════════════════════════════════════════════
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (_) {}
  // Default: safe for Termux
  const def = {
    enabled: true,
    retention: { hourly: 6, daily: 3, weekly: 2 },
    maxTotalMB: 200,
    alertAfterHours: 3,
    createdAt: new Date().toISOString()
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(def, null, 2));
  return def;
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

// ═══════════════════════════════════════════════════════════
//  Index
// ═══════════════════════════════════════════════════════════
function loadIndex() {
  try {
    if (fs.existsSync(INDEX_FILE)) {
      return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    }
  } catch (_) {}
  return [];
}

function saveIndex(idx) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2));
}

// ═══════════════════════════════════════════════════════════
//  Backup (atomic — temp dir + rename)
// ═══════════════════════════════════════════════════════════
function runBackup(reason, actor) {
  reason = reason || 'manual';
  const start = Date.now();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const id = 'bk_' + ts;
  const tmpDir = path.join(BACKUP_DIR, id + '.tmp');
  const finalDir = path.join(BACKUP_DIR, id);

  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    // Copy all data/*.json (except _backups)
    const files = fs.readdirSync(DATA).filter(f =>
      f.endsWith('.json') && !f.startsWith('_backup_')
    );

    let totalBytes = 0, totalRecords = 0;
    const collections = {};
    let verifyErrors = 0;

    for (const file of files) {
      const src = path.join(DATA, file);
      const dst = path.join(tmpDir, file);
      try {
        const content = fs.readFileSync(src, 'utf8');
        fs.writeFileSync(dst, content);
        totalBytes += Buffer.byteLength(content);
        try {
          const parsed = JSON.parse(content);
          const records = Array.isArray(parsed) ? parsed.length : 0;
          totalRecords += records;
          collections[file.replace('.json', '')] = records;
        } catch (_) { verifyErrors++; }
      } catch (_) {}
    }

    // Metadata
    const meta = {
      id, reason,
      createdAt: new Date().toISOString(),
      files: files.length,
      bytes: totalBytes,
      records: totalRecords,
      collections,
      durationMs: Date.now() - start,
      verified: verifyErrors === 0,
      verifyErrors,
      actor: actor ? { id: actor.id, username: actor.username } : null
    };
    fs.writeFileSync(path.join(tmpDir, '_meta.json'), JSON.stringify(meta, null, 2));

    // Atomic rename
    fs.renameSync(tmpDir, finalDir);

    // Update index
    const idx = loadIndex();
    idx.push(meta);
    saveIndex(idx);

    // Enforce retention
    const removed = enforceRetention();

    // Audit
    try {
      audit.write('backup_manager', 'backup.create', id, actor || { id: 'system', username: 'system', role: 'admin' }, {
        files: files.length, records: totalRecords, bytes: totalBytes, reason
      });
    } catch (_) {}

    return { ok: true, meta, removed: removed.count };
  } catch (e) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    return { ok: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════
//  Retention (keep N hourly + N daily + N weekly)
// ═══════════════════════════════════════════════════════════
function enforceRetention() {
  const cfg = loadConfig();
  const idx = loadIndex();
  if (!idx.length) return { count: 0, removed: [] };

  const now = Date.now();
  const buckets = { hourly: [], daily: [], weekly: [] };

  for (const b of idx) {
    const ageHours = (now - new Date(b.createdAt).getTime()) / 3600000;
    if (ageHours < 24) buckets.hourly.push(b);
    else if (ageHours < 24 * 7) buckets.daily.push(b);
    else buckets.weekly.push(b);
  }

  const toKeep = new Set();
  for (const [type, limit] of Object.entries(cfg.retention)) {
    const list = buckets[type] || [];
    // Keep newest 'limit' in each bucket
    list.slice(-limit).forEach(b => toKeep.add(b.id));
  }

  const toRemove = idx.filter(b => !toKeep.has(b.id));
  for (const b of toRemove) {
    const dir = path.join(BACKUP_DIR, b.id);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  }

  if (toRemove.length > 0) {
    saveIndex(idx.filter(b => toKeep.has(b.id)));
  }

  return { count: toRemove.length, removed: toRemove.map(b => b.id) };
}

// ═══════════════════════════════════════════════════════════
//  Restore (selective + dry-run + pre-backup)
// ═══════════════════════════════════════════════════════════
function previewRestore(backupId, collections) {
  const dir = path.join(BACKUP_DIR, backupId);
  if (!fs.existsSync(dir)) return { ok: false, error: 'backup_not_found' };

  const metaPath = path.join(dir, '_meta.json');
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (_) {}

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== '_meta.json');
  const filtered = collections && collections.length > 0
    ? files.filter(f => collections.includes(f.replace('.json', '')))
    : files;

  const changes = [];
  for (const file of filtered) {
    const coll = file.replace('.json', '');
    const backupContent = fs.readFileSync(path.join(dir, file), 'utf8');
    let backupRecords = 0;
    try { backupRecords = JSON.parse(backupContent).length; } catch (_) {}

    const currentPath = path.join(DATA, file);
    let currentRecords = 0;
    if (fs.existsSync(currentPath)) {
      try { currentRecords = JSON.parse(fs.readFileSync(currentPath, 'utf8')).length; } catch (_) {}
    }

    changes.push({
      collection: coll,
      backupRecords,
      currentRecords,
      diff: backupRecords - currentRecords
    });
  }

  return {
    ok: true,
    backupId,
    meta,
    changes,
    willChangeCollections: changes.filter(c => c.diff !== 0).map(c => c.collection),
    totalChanges: changes.filter(c => c.diff !== 0).length
  };
}

function restore(backupId, collections, actor) {
  const dir = path.join(BACKUP_DIR, backupId);
  if (!fs.existsSync(dir)) return { ok: false, error: 'backup_not_found' };

  // Pre-restore safety backup
  const safety = runBackup('pre_restore', actor);
  if (!safety.ok) return { ok: false, error: 'safety_backup_failed: ' + safety.error };

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== '_meta.json');
  const filtered = collections && collections.length > 0
    ? files.filter(f => collections.includes(f.replace('.json', '')))
    : files;

  const restored = [];
  const errors = [];

  for (const file of filtered) {
    try {
      const src = path.join(dir, file);
      const dst = path.join(DATA, file);
      fs.copyFileSync(src, dst);
      restored.push(file);
      // Invalidate store cache
      try { store.readAll(file.replace('.json', '')); } catch (_) {}
    } catch (e) {
      errors.push({ file, error: e.message });
    }
  }

  try {
    audit.write('backup_manager', 'backup.restore', backupId, actor, {
      files: restored.length,
      collections: collections || 'all',
      safetyBackup: safety.meta.id
    });
  } catch (_) {}

  return {
    ok: errors.length === 0,
    restored,
    errors,
    preRestoreBackup: safety.meta.id
  };
}

// ═══════════════════════════════════════════════════════════
//  Health check
// ═══════════════════════════════════════════════════════════
function health() {
  const cfg = loadConfig();
  const idx = loadIndex();
  const now = Date.now();

  let lastBackup = null;
  let lastBackupAgeHours = null;
  if (idx.length > 0) {
    const latest = idx.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b);
    lastBackup = latest;
    lastBackupAgeHours = Math.round(((now - new Date(latest.createdAt).getTime()) / 3600000) * 10) / 10;
  }

  // Disk usage
  let totalBytes = 0;
  let fileCount = 0;
  try {
    for (const f of fs.readdirSync(DATA)) {
      if (f.endsWith('.json')) {
        const stat = fs.statSync(path.join(DATA, f));
        totalBytes += stat.size;
        fileCount++;
      }
    }
  } catch (_) {}

  let backupBytes = 0;
  try {
    for (const b of idx) {
      backupBytes += b.bytes || 0;
    }
  } catch (_) {}

  // Warnings
  const warnings = [];
  if (!cfg.enabled) warnings.push('backup_disabled');
  if (lastBackupAgeHours != null && lastBackupAgeHours > cfg.alertAfterHours) {
    warnings.push('stale_' + lastBackupAgeHours + 'h');
  }
  if (backupBytes > cfg.maxTotalMB * 1024 * 1024) {
    warnings.push('backup_disk_' + Math.round(backupBytes / 1024 / 1024) + 'MB');
  }
  if (idx.length === 0) warnings.push('no_backups_yet');

  const mem = process.memoryUsage();
  return {
    uptime: Math.floor(process.uptime()),
    uptimeHuman: formatUptime(process.uptime()),
    memory: {
      rssMB: Math.round(mem.rss / 1024 / 1024),
      heapMB: Math.round(mem.heapUsed / 1024 / 1024)
    },
    disk: {
      dataFiles: fileCount,
      dataMB: Math.round(totalBytes / 1024 / 1024 * 10) / 10,
      backupMB: Math.round(backupBytes / 1024 / 1024 * 10) / 10
    },
    backup: {
      enabled: cfg.enabled,
      count: idx.length,
      lastAt: lastBackup ? lastBackup.createdAt : null,
      lastAgeHours: lastBackupAgeHours,
      lastRecords: lastBackup ? lastBackup.records : 0
    },
    warnings,
    status: warnings.length === 0 ? 'healthy' : warnings.length <= 1 ? 'warning' : 'critical'
  };
}

function formatUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

// ═══════════════════════════════════════════════════════════
//  Handlers
// ═══════════════════════════════════════════════════════════
function status(ctx) {
  const cfg = loadConfig();
  const idx = loadIndex();
  const sorted = idx.slice().sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );
  return {
    config: cfg,
    backups: sorted.slice(0, 50).map(b => ({
      id: b.id,
      createdAt: b.createdAt,
      reason: b.reason,
      files: b.files,
      records: b.records,
      MB: Math.round(b.bytes / 1024 / 1024 * 10) / 10,
      verified: b.verified
    })),
    total: idx.length
  };
}

function runNow(ctx) {
  const result = runBackup('manual_' + ctx.actor.username, ctx.actor);
  if (!result.ok) throw ctx.E.badRequest(result.error);
  return result;
}

function previewHandler(ctx) {
  const collections = ctx.query.collections
    ? String(ctx.query.collections).split(',')
    : null;
  return previewRestore(ctx.params.id, collections);
}

function restoreHandler(ctx) {
  const b = ctx.body || {};
  if (b.confirm !== true) throw ctx.E.badRequest('confirm_required');
  const collections = Array.isArray(b.collections) ? b.collections : null;
  const result = restore(ctx.params.id, collections, ctx.actor);
  if (!result.ok) throw ctx.E.badRequest(result.error || 'restore_failed');
  return result;
}

function configHandler(ctx) {
  const b = ctx.body || {};
  const cfg = loadConfig();
  if (b.enabled !== undefined) cfg.enabled = !!b.enabled;
  if (b.retention) cfg.retention = Object.assign(cfg.retention, b.retention);
  if (b.maxTotalMB) cfg.maxTotalMB = Number(b.maxTotalMB);
  if (b.alertAfterHours) cfg.alertAfterHours = Number(b.alertAfterHours);
  saveConfig(cfg);
  return cfg;
}

function healthHandler(ctx) {
  return health();
}

function cleanupHandler(ctx) {
  return enforceRetention();
}

function deleteBackup(ctx) {
  const id = ctx.params.id;
  const dir = path.join(BACKUP_DIR, id);
  if (!fs.existsSync(dir)) throw ctx.E.notFound('backup_not_found');
  fs.rmSync(dir, { recursive: true, force: true });
  const idx = loadIndex().filter(b => b.id !== id);
  saveIndex(idx);
  return { deleted: id };
}

// ═══════════════════════════════════════════════════════════
//  Scheduler (runs every hour)
// ═══════════════════════════════════════════════════════════
let _schedulerStarted = false;
function startScheduler() {
  if (_schedulerStarted) return;
  _schedulerStarted = true;

  // Initial backup after 60s (safe — after server fully boots)
  setTimeout(() => {
    const cfg = loadConfig();
    if (!cfg.enabled) return;
    const idx = loadIndex();
    // Skip if already have backup < 30 min old
    if (idx.length > 0) {
      const latest = idx[idx.length - 1];
      const ageMin = (Date.now() - new Date(latest.createdAt).getTime()) / 60000;
      if (ageMin < 30) {
        console.log('[backup] skipped — recent backup exists (' + Math.round(ageMin) + 'min old)');
        return;
      }
    }
    const r = runBackup('scheduled_initial', { id: 'system', username: 'scheduler', role: 'admin' });
    if (r.ok) console.log('[backup] ✅ initial: ' + r.meta.records + ' records · ' + r.meta.durationMs + 'ms');
    else console.error('[backup] ❌ initial:', r.error);
  }, 60000);

  // Hourly
  setInterval(() => {
    const cfg = loadConfig();
    if (!cfg.enabled) return;
    const r = runBackup('scheduled_hourly', { id: 'system', username: 'scheduler', role: 'admin' });
    if (r.ok) console.log('[backup] ✅ hourly: ' + r.meta.records + ' records · removed=' + r.removed);
    else console.error('[backup] ❌ hourly:', r.error);
  }, 60 * 60 * 1000);

  console.log('[backup] scheduler started (initial in 60s, then hourly)');
}

startScheduler();

module.exports = {
  handlers: { status, runNow, previewHandler, restoreHandler, configHandler, healthHandler, cleanupHandler, deleteBackup },
  routes: [
    { method: 'GET',  path: '/api/backup/status',         handler: 'status',         perm: 'backup.view' },
    { method: 'GET',  path: '/api/backup/health',         handler: 'healthHandler',  perm: 'backup.view' },
    { method: 'GET',  path: '/api/backup/preview/:id',    handler: 'previewHandler', perm: 'backup.view' },
    { method: 'POST', path: '/api/backup/run',            handler: 'runNow',         perm: 'backup.manage' },
    { method: 'POST', path: '/api/backup/restore/:id',    handler: 'restoreHandler', perm: 'backup.manage' },
    { method: 'POST', path: '/api/backup/config',         handler: 'configHandler',  perm: 'backup.manage' },
    { method: 'POST', path: '/api/backup/cleanup',        handler: 'cleanupHandler', perm: 'backup.manage' },
    { method: 'DELETE', path: '/api/backup/:id',          handler: 'deleteBackup',   perm: 'backup.manage' }
  ],
  panels: [
    { id:'dashboard', title:'پشتیبان‌گیری', icon:'💾', perm:'backup.view', kind:'backup_dashboard', api:'/api/backup/status' }
  ]
};

console.log('[backup-manager] loaded — hourly scheduler + health + selective restore');
