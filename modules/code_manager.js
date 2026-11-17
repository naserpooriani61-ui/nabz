'use strict';
const fs = require('fs');
const path = require('path');
const { h } = require('../core/mod-helpers');
const { execSync, spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SAFE_DIRS = ['core', 'modules', 'public'];
const EDITABLE_EXT = ['.js', '.json', '.css', '.html', '.md', '.txt'];
const BACKUP_DIR = path.join(ROOT, 'code-backups');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function isSafePath(rel) {
  // Prevent path traversal
  if (!rel) return false;
  var norm = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
  if (norm.indexOf('..') >= 0) return false;
  var parts = norm.split(path.sep).filter(Boolean);
  if (!parts.length) return false;
  if (SAFE_DIRS.indexOf(parts[0]) < 0) return false;
  return true;
}

function absPath(rel) {
  return path.join(ROOT, rel);
}

function isEditable(rel) {
  var ext = path.extname(rel).toLowerCase();
  return EDITABLE_EXT.indexOf(ext) >= 0;
}

// ═══ LIST FILES ═══
function listFiles(ctx) {
  var out = {};
  for (const dir of SAFE_DIRS) {
    var dirPath = path.join(ROOT, dir);
    if (!fs.existsSync(dirPath)) continue;
    out[dir] = [];
    for (const f of fs.readdirSync(dirPath)) {
      var full = path.join(dirPath, f);
      var st;
      try { st = fs.statSync(full); } catch (_) { continue; }
      if (st.isFile()) {
        out[dir].push({
          name: f,
          path: dir + '/' + f,
          size: st.size,
          sizeKB: Math.round(st.size / 1024 * 10) / 10,
          ext: path.extname(f),
          editable: isEditable(dir + '/' + f),
          modifiedAt: st.mtime.toISOString()
        });
      }
    }
    out[dir].sort(function(a, b) { return a.name.localeCompare(b.name); });
  }
  return { files: out, total: Object.values(out).reduce(function(s, arr) { return s + arr.length; }, 0) };
}

// ═══ READ FILE ═══
function readFile(ctx) {
  var rel = ctx.query.path;
  if (!isSafePath(rel)) throw ctx.E.badRequest('invalid_path');
  var full = absPath(rel);
  if (!fs.existsSync(full)) throw ctx.E.notFound('file_not_found');
  if (!isEditable(rel)) throw ctx.E.forbidden('file_not_editable');
  var content = fs.readFileSync(full, 'utf8');
  var st = fs.statSync(full);
  return {
    path: rel,
    content: content,
    size: content.length,
    lines: content.split('\n').length,
    modifiedAt: st.mtime.toISOString(),
    editable: isEditable(rel)
  };
}

// ═══ VALIDATE JS SYNTAX ═══
function validateSyntax(content, ext) {
  if (ext === '.js') {
    try {
      // Wrap in function to check syntax
      new Function(content);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message, line: extractLine(e) };
    }
  }
  if (ext === '.json') {
    try { JSON.parse(content); return { ok: true }; }
    catch (e) { return { ok: false, error: e.message }; }
  }
  return { ok: true }; // CSS/HTML — no strict check
}

function extractLine(err) {
  var m = String(err.stack || err.message || '').match(/:(\d+):\d+/);
  return m ? parseInt(m[1]) : null;
}

// ═══ WRITE FILE ═══
function writeFile(ctx) {
  var b = ctx.body;
  var rel = b.path;
  var content = b.content;
  if (!isSafePath(rel)) throw ctx.E.badRequest('invalid_path');
  if (!isEditable(rel)) throw ctx.E.forbidden('file_not_editable');
  if (typeof content !== 'string') throw ctx.E.badRequest('content_required');

  // Validate
  var ext = path.extname(rel).toLowerCase();
  var validation = validateSyntax(content, ext);
  if (!validation.ok && !b.force) {
    return { ok: false, error: 'syntax_error', detail: validation, message: 'خطای syntax — برای اجبار، force=true ارسال کنید' };
  }

  // Backup
  ensureBackupDir();
  var full = absPath(rel);
  var existing = fs.existsSync(full);
  var backupFile = null;
  if (existing) {
    var ts = new Date().toISOString().replace(/[:.]/g, '-');
    var safeName = rel.replace(/[\/\\]/g, '__');
    backupFile = 'bk_' + ts + '__' + safeName + '.bak';
    fs.copyFileSync(full, path.join(BACKUP_DIR, backupFile));
  }

  // Write
  fs.writeFileSync(full, content, 'utf8');

  // Audit
  try {
    ctx.store.put('audit_chain', {
      id: ctx.uid('aud'), module: 'code_manager', action: 'file.write',
      entityId: rel, actor: { id: ctx.actor.id, role: ctx.actor.role, name: ctx.actor.fullName || ctx.actor.username },
      meta: { size: content.length, backup: backupFile, forced: !!b.force },
      at: ctx.now(), prevHash: 'genesis', hash: String(Date.now())
    });
  } catch (_) {}

  return {
    ok: true,
    path: rel,
    size: content.length,
    backupFile: backupFile,
    syntax: validation,
    note: 'برای اعمال تغییرات در سرور، restart لازم است'
  };
}

// ═══ LIST BACKUPS ═══
function listBackups(ctx) {
  ensureBackupDir();
  var files = fs.readdirSync(BACKUP_DIR).filter(function(f) { return f.endsWith('.bak'); });
  var items = files.map(function(f) {
    var full = path.join(BACKUP_DIR, f);
    var st = fs.statSync(full);
    // Parse filename: bk_<timestamp>__<safeName>.bak
    var parts = f.replace('.bak', '').split('__');
    var origPath = parts.length > 1 ? parts[1].replace(/__/g, '/') : '?';
    var ts = parts[0].replace('bk_', '').replace(/-/g, ':').replace('T', ' ');
    return {
      name: f,
      originalPath: origPath,
      size: st.size,
      sizeKB: Math.round(st.size / 1024 * 10) / 10,
      backupAt: st.mtime.toISOString(),
      backupAtHuman: ts
    };
  });
  items.sort(function(a, b) { return b.backupAt.localeCompare(a.backupAt); });
  return { items: items.slice(0, 100), total: items.length };
}

// ═══ RESTORE BACKUP ═══
function restoreBackup(ctx) {
  var b = ctx.body;
  var name = b.backupName;
  if (!name || name.indexOf('..') >= 0 || name.indexOf('/') >= 0) throw ctx.E.badRequest('invalid_name');
  var full = path.join(BACKUP_DIR, name);
  if (!fs.existsSync(full)) throw ctx.E.notFound('backup_not_found');

  // Parse original path
  var parts = name.replace('.bak', '').split('__');
  if (parts.length < 2) throw ctx.E.badRequest('invalid_backup_name');
  var origPath = parts.slice(1).join('__').replace(/__/g, '/');
  if (!isSafePath(origPath)) throw ctx.E.badRequest('invalid_target');

  // Backup current before restore
  var currentFull = absPath(origPath);
  if (fs.existsSync(currentFull)) {
    var ts = new Date().toISOString().replace(/[:.]/g, '-');
    var safeName = origPath.replace(/[\/\\]/g, '__');
    fs.copyFileSync(currentFull, path.join(BACKUP_DIR, 'bk_' + ts + '__' + safeName + '.bak'));
  }

  // Restore
  fs.copyFileSync(full, currentFull);

  try {
    ctx.store.put('audit_chain', {
      id: ctx.uid('aud'), module: 'code_manager', action: 'backup.restore',
      entityId: origPath, actor: { id: ctx.actor.id, role: ctx.actor.role, name: ctx.actor.fullName || ctx.actor.username },
      meta: { backupName: name }, at: ctx.now(), prevHash: 'genesis', hash: String(Date.now())
    });
  } catch (_) {}

  return { ok: true, restored: origPath, from: name, note: 'restart لازم است' };
}

// ═══ VALIDATE (dry-run) ═══
function validate(ctx) {
  var b = ctx.body;
  var content = b.content;
  var rel = b.path || 'file.js';
  var ext = path.extname(rel).toLowerCase();
  var v = validateSyntax(content, ext);
  return { ok: v.ok, error: v.error || null, line: v.line || null };
}

// ═══ RESTART SERVER ═══
function restart(ctx) {
  var b = ctx.body || {};
  // Confirm safety
  if (b.confirm !== true) throw ctx.E.badRequest('confirm_required');
  try {
    // Spawn detached restart script
    var script = path.join(ROOT, 'restart.sh');
    if (!fs.existsSync(script)) {
      // Create inline restart
      fs.writeFileSync(script,
        '#!/data/data/com.termux/files/usr/bin/bash\n' +
        'sleep 1\n' +
        'cd "' + ROOT + '"\n' +
        'export NODE_OPTIONS="--max-old-space-size=384"\n' +
        'pkill -9 -f "core/server.js" 2>/dev/null\n' +
        'sleep 1\n' +
        'nohup node core/server.js > ~/nabz-server.log 2>&1 &\n');
      try { fs.chmodSync(script, 0o755); } catch (_) {}
    }
    spawn('bash', [script], { detached: true, stdio: 'ignore' }).unref();
    return { ok: true, message: 'سرور در ۱-۲ ثانیه دیگر restart می‌شود', restartIn: 1500 };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ═══ DELETE BACKUP ═══
function deleteBackup(ctx) {
  var name = ctx.params.name;
  if (!name || name.indexOf('..') >= 0 || name.indexOf('/') >= 0) throw ctx.E.badRequest('invalid_name');
  var full = path.join(BACKUP_DIR, name);
  if (!fs.existsSync(full)) throw ctx.E.notFound('not_found');
  fs.unlinkSync(full);
  return { ok: true, deleted: name };
}

// ═══ READ RAW (for non-editable show) ═══
function readRaw(ctx) {
  var rel = ctx.query.path;
  if (!isSafePath(rel)) throw ctx.E.badRequest('invalid_path');
  var full = absPath(rel);
  if (!fs.existsSync(full)) throw ctx.E.notFound('not_found');
  // Don't allow giant files
  var st = fs.statSync(full);
  if (st.size > 500 * 1024) throw ctx.E.badRequest('file_too_large');
  return {
    path: rel, content: fs.readFileSync(full, 'utf8'),
    size: st.size, lines: fs.readFileSync(full, 'utf8').split('\n').length,
    editable: isEditable(rel), modifiedAt: st.mtime.toISOString()
  };
}

module.exports = {
  handlers: { listFiles, readFile, readRaw, writeFile, listBackups, restoreBackup,
    deleteBackup, validate, restart },
  routes: [
    { method:'GET',  path:'/api/cm/files', handler:'listFiles', perm:'admin.users.manage' },
    { method:'GET',  path:'/api/cm/file', handler:'readFile', perm:'admin.users.manage' },
    { method:'GET',  path:'/api/cm/raw', handler:'readRaw', perm:'admin.users.manage' },
    { method:'POST', path:'/api/cm/file', handler:'writeFile', perm:'admin.users.manage' },
    { method:'POST', path:'/api/cm/validate', handler:'validate', perm:'admin.users.manage' },
    { method:'GET',  path:'/api/cm/backups', handler:'listBackups', perm:'admin.users.manage' },
    { method:'POST', path:'/api/cm/restore', handler:'restoreBackup', perm:'admin.users.manage' },
    { method:'DELETE', path:'/api/cm/backups/:name', handler:'deleteBackup', perm:'admin.users.manage' },
    { method:'POST', path:'/api/cm/restart', handler:'restart', perm:'admin.users.manage' }
  ],
  panels: [
    { id:'code', title:'ویرایشگر کد', icon:'💻', perm:'admin.users.manage', kind:'code_manager', api:'/api/cm/files' }
  ]
};
