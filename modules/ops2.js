'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('../core/store');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKUP_DIR = path.join(DATA_DIR, '_backups');
const START_TIME = Date.now();

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// ─── Encryption helpers ───
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}
function encrypt(data, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: authTag.toString('base64'),
    data: encrypted.toString('base64')
  };
}
function decrypt(payload, password) {
  const salt = Buffer.from(payload.salt, 'base64');
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const encrypted = Buffer.from(payload.data, 'base64');
  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}
function checksum(str) {
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

// ─── List all collections ───
function listCollections() {
  ensureBackupDir();
  return fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .map(f => f.replace('.json', ''));
}

function getCollectionSize(name) {
  try {
    const f = path.join(DATA_DIR, name + '.json');
    const stat = fs.statSync(f);
    const data = store.readAll(name);
    return { records: Array.isArray(data) ? data.length : 0, bytes: stat.size };
  } catch (_) { return { records: 0, bytes: 0 }; }
}

// ─── Export ───
function exportBackup(ctx) {
  const b = ctx.body || {};
  const password = (b.password || '').trim();
  if (!password || password.length < 8) {
    throw ctx.E.badRequest('password_min_8_chars');
  }
  ensureBackupDir();

  const collections = listCollections();
  const data = {};
  let totalRecords = 0;
  let totalBytes = 0;
  for (const c of collections) {
    const records = store.readAll(c);
    data[c] = records;
    totalRecords += records.length;
    totalBytes += getCollectionSize(c).bytes;
  }

  const payload = encrypt(data, password);
  const meta = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    createdBy: ctx.actor.username,
    hospital: 'بیمارستان سینا',
    system: 'NABZ v1.0',
    collections: collections.length,
    records: totalRecords,
    bytes: totalBytes,
    checksum: checksum(JSON.stringify(data).slice(0, 10000))
  };
  const file = Object.assign({ metadata: meta }, payload);

  // Save local backup file
  const filename = 'backup_' + new Date().toISOString().replace(/[:.]/g, '-') + '.nabz';
  fs.writeFileSync(path.join(BACKUP_DIR, filename), JSON.stringify(file));

  // Audit
  ctx.audit.write('ops2', 'backup.export', filename, ctx.actor, { collections: collections.length, records: totalRecords });

  return { filename, ...file };
}

// ─── Import ───
function importBackup(ctx) {
  const b = ctx.body || {};
  const password = (b.password || '').trim();
  const payload = b.payload;
  const mode = b.mode || 'replace'; // replace | merge
  if (!password) throw ctx.E.badRequest('password_required');
  if (!payload) throw ctx.E.badRequest('payload_required');

  let data;
  try {
    data = decrypt(payload, password);
  } catch (e) {
    throw ctx.E.badRequest('decryption_failed');
  }

  // Auto-backup current state first
  ensureBackupDir();
  const autoFile = 'auto_before_import_' + Date.now() + '.nabz';
  try {
    const current = {};
    for (const c of listCollections()) current[c] = store.readAll(c);
    const autoPayload = encrypt(current, password);
    fs.writeFileSync(path.join(BACKUP_DIR, autoFile), JSON.stringify({
      metadata: { version:'1.0', createdAt: new Date().toISOString(), createdBy: ctx.actor.username, auto: true },
      ...autoPayload
    }));
  } catch (_) {}

  // Restore
  let totalRecords = 0;
  const restored = [];
  for (const [coll, records] of Object.entries(data)) {
    if (!Array.isArray(records)) continue;
    if (mode === 'replace') {
      const existing = store.readAll(coll);
      for (const r of existing) store.remove(coll, r.id);
    }
    for (const r of records) {
      if (r && r.id) store.put(coll, r);
    }
    totalRecords += records.length;
    restored.push({ collection: coll, count: records.length });
  }

  ctx.audit.write('ops2', 'backup.import', b.filename || 'inline', ctx.actor, { mode, totalRecords, collections: restored.length });
  ctx.bus.emit('ops2.backup.imported', { totalRecords, mode, actor: ctx.actor });

  return { autoBackup: autoFile, mode, totalRecords, collections: restored };
}

// ─── List backups ───
function listBackups(ctx) {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.nabz'))
    .map(f => {
      const full = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(full);
      let meta = {};
      try { meta = JSON.parse(fs.readFileSync(full, 'utf8')).metadata || {}; } catch (_) {}
      return {
        filename: f, bytes: stat.size, modifiedAt: stat.mtime.toISOString(),
        records: meta.records || 0, collections: meta.collections || 0,
        createdBy: meta.createdBy || '?', auto: !!meta.auto
      };
    })
    .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
  return { items: files, total: files.length, backupDir: BACKUP_DIR };
}

// ─── Delete a backup ───
function deleteBackup(ctx) {
  const fname = ctx.params.filename;
  if (!fname || fname.includes('..') || fname.includes('/')) {
    throw ctx.E.badRequest('invalid_filename');
  }
  const full = path.join(BACKUP_DIR, fname);
  if (!fs.existsSync(full)) throw ctx.E.notFound('backup_not_found');
  fs.unlinkSync(full);
  ctx.audit.write('ops2', 'backup.delete', fname, ctx.actor, {});
  return { deleted: true, filename: fname };
}

// ─── Health check ───
function healthCheck(ctx) {
  const collections = listCollections();
  const collStats = collections.map(c => {
    const s = getCollectionSize(c);
    return { name: c, records: s.records, bytes: s.bytes };
  }).sort((a, b) => b.bytes - a.bytes);
  const totalRecords = collStats.reduce((s, c) => s + c.records, 0);
  const totalBytes = collStats.reduce((s, c) => s + c.bytes, 0);
  const backups = listBackups(ctx);
  const auditChain = require('../core/audit').verify();
  const uptimeSec = Math.floor((Date.now() - START_TIME) / 1000);
  const memory = process.memoryUsage();
  return {
    uptime: {
      seconds: uptimeSec,
      human: Math.floor(uptimeSec / 3600) + 'h ' + Math.floor((uptimeSec % 3600) / 60) + 'm'
    },
    memory: {
      rssMB: Math.round(memory.rss / 1024 / 1024),
      heapMB: Math.round(memory.heapUsed / 1024 / 1024)
    },
    storage: {
      collections: collections.length,
      totalRecords,
      totalMB: Math.round(totalBytes / 1024 / 1024 * 100) / 100,
      topCollections: collStats.slice(0, 5)
    },
    backups: {
      count: backups.total,
      latest: backups.items[0] || null
    },
    audit: auditChain,
    versions: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    }
  };
}

// ─── Audit viewer ───
function listAudit(ctx) {
  const chain = store.readAll('audit_chain');
  let items = chain.slice().reverse();
  if (ctx.query.module) items = items.filter(a => a.module === ctx.query.module);
  if (ctx.query.action) items = items.filter(a => a.action === ctx.query.action);
  if (ctx.query.actor) items = items.filter(a => a.actor && a.actor.id === ctx.query.actor);
  if (ctx.query.since) {
    const since = new Date(ctx.query.since).getTime();
    items = items.filter(a => new Date(a.at).getTime() >= since);
  }
  const limit = Math.min(Number(ctx.query.limit) || 50, 200);
  const modules = [...new Set(chain.map(a => a.module))];
  const actions = [...new Set(chain.map(a => a.action))];
  return { items: items.slice(0, limit), total: items.length, modules, actions };
}

module.exports = {
  handlers: { exportBackup, importBackup, listBackups, deleteBackup, healthCheck, listAudit },
  routes: [
    { method:'POST', path:'/api/ops2/backup/export',  handler:'exportBackup',   perm:'admin.users.manage' },
    { method:'POST', path:'/api/ops2/backup/import',  handler:'importBackup',   perm:'admin.users.manage' },
    { method:'GET',  path:'/api/ops2/backup/list',    handler:'listBackups',    perm:'admin.users.manage' },
    { method:'DELETE', path:'/api/ops2/backup/:filename', handler:'deleteBackup', perm:'admin.users.manage' },
    { method:'GET',  path:'/api/ops2/health',         handler:'healthCheck',    perm:'admin.users.manage' },
    { method:'GET',  path:'/api/ops2/audit',          handler:'listAudit',      perm:'admin.audit.view' }
  ],
  panels: [
    { id:'health',  title:'سلامت سیستم', icon:'💚', perm:'admin.users.manage', kind:'health',  api:'/api/ops2/health' },
    { id:'backup',  title:'پشتیبان‌گیری', icon:'💾', perm:'admin.users.manage', kind:'backup',  api:'/api/ops2/backup/list' },
    { id:'audit',   title:'Audit Trail',  icon:'📋', perm:'admin.audit.view',  kind:'audit',   api:'/api/ops2/audit' }
  ]
};
