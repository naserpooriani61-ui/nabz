'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ store v2 (Stage 28) — API-compatible with v1
//  · corrupt file → quarantined (never silently replaced by [])
//  · compact JSON + fsync + atomic rename
//  · stat() throttled (was: 1 syscall per readAll)
//  · O(1) id lookup index (was: O(n) findIndex per put)
//  · event_log_* write-behind (non-authoritative, derived data)
//  · failed disk write rolls cache back (no phantom state)
// ═══════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const DATA = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
const PRETTY = process.env.NABZ_PRETTY_JSON === '1';
const FSYNC = process.env.NABZ_FSYNC !== '0';
const STAT_TTL = Number(process.env.NABZ_STAT_TTL_MS || 1000);
const DEFER = /^event_log_/;
const APPEND_ONLY = /^(audit_chain|signatures)$/;
const _cache = new Map(), _mtime = new Map(), _chk = new Map(), _idx = new Map(), _dirty = new Map(), _pc = new Map();
const stats = { writes: 0, deferredFlushes: 0, quarantined: [], recoveredFromTmp: 0, writeErrors: 0 };
let _timer = null;

function file(c) {
  if (typeof c !== 'string' || !/^[A-Za-z0-9_.-]{1,120}$/.test(c) || c.includes('..')) throw new Error('bad_collection');
  return path.join(DATA, c + '.json');
}
function repairTruncated(raw) {
  let depth = 0, inStr = false, esc = false, lastEnd = -1;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') { depth--; if (depth === 1) lastEnd = i; }
  }
  if (lastEnd < 0) return null;
  try { const a = JSON.parse(raw.slice(0, lastEnd + 1) + ']'); return Array.isArray(a) ? a : null; } catch (_) { return null; }
}
function appendRecords(c, recs) {
  const f = file(c); const fd = fs.openSync(f, 'r+');
  try {
    const st = fs.fstatSync(fd), n = Math.min(64, st.size), buf = Buffer.alloc(n);
    fs.readSync(fd, buf, 0, n, st.size - n);
    const k = buf.lastIndexOf(0x5D);
    if (k < 0) throw new Error('append_unsafe');
    for (let j = k + 1; j < n; j++) if (![0x20, 0x0a, 0x0d, 0x09].includes(buf[j])) throw new Error('append_unsafe');
    let j = k - 1; while (j >= 0 && [0x20, 0x0a, 0x0d, 0x09].includes(buf[j])) j--;
    if (j < 0) throw new Error('append_unsafe');
    const empty = buf[j] === 0x5B;
    const payload = (empty ? '' : ',') + recs.map(r => JSON.stringify(r)).join(',') + ']';
    fs.writeSync(fd, payload, st.size - n + k);
    if (FSYNC) fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  try { _mtime.set(c, fs.statSync(f).mtimeMs); } catch (_) {}
  _chk.set(c, Date.now()); stats.appends = (stats.appends || 0) + 1;
}
function recover(c, f, raw, err) {
  const fixed = repairTruncated(raw);
  if (fixed) {
    const q0 = f + '.corrupt-' + Date.now();
    try { fs.writeFileSync(q0, raw); fs.writeFileSync(f, JSON.stringify(fixed)); } catch (_) {}
    stats.quarantined.push({ collection: c, file: path.basename(q0), at: new Date().toISOString(), error: 'truncated_repaired', kept: fixed.length });
    console.error('[store] ⚠️ ' + c + ' truncated — repaired, kept ' + fixed.length + ' records');
    return fixed;
  }
  const q = f + '.corrupt-' + Date.now();
  try { fs.renameSync(f, q); } catch (_) {}
  stats.quarantined.push({ collection: c, file: path.basename(q), at: new Date().toISOString(), error: String(err && err.message) });
  console.error('[store] ❌ CORRUPT ' + c + '.json quarantined → ' + path.basename(q));
  try {
    const t = f + '.tmp';
    if (fs.existsSync(t)) {
      const arr = JSON.parse(fs.readFileSync(t, 'utf8'));
      fs.renameSync(t, f); stats.recoveredFromTmp++;
      console.error('[store] ✅ ' + c + ' recovered from .tmp');
      return arr;
    }
  } catch (_) {}
  return [];
}
function load(c) {
  if (_dirty.has(c) && _cache.has(c)) return _cache.get(c);
  const now = Date.now();
  if (_cache.has(c) && now - (_chk.get(c) || 0) < STAT_TTL) return _cache.get(c);
  const f = file(c); let st;
  try { st = fs.statSync(f); }
  catch (e) {
    if (e.code !== 'ENOENT') throw e;
    if (_cache.has(c) && _mtime.get(c) === 0) { _chk.set(c, now); return _cache.get(c); }
    const empty = []; _cache.set(c, empty); _mtime.set(c, 0); _chk.set(c, now); return empty;
  }
  if (_cache.has(c) && _mtime.get(c) === st.mtimeMs) { _chk.set(c, now); return _cache.get(c); }
  const raw = fs.readFileSync(f, 'utf8'); let arr;
  try { arr = JSON.parse(raw); } catch (pe) { arr = recover(c, f, raw, pe); }
  _cache.set(c, arr); _idx.delete(c); _pc.set(c, Array.isArray(arr) ? arr.length : 0);
  try { _mtime.set(c, fs.statSync(f).mtimeMs); } catch (_) { _mtime.set(c, 0); }
  _chk.set(c, now); return arr;
}
function writeNow(c, arr) {
  const f = file(c), tmp = f + '.tmp';
  const data = PRETTY ? JSON.stringify(arr, null, 2) : JSON.stringify(arr);
  let fd = null;
  try {
    fd = fs.openSync(tmp, 'w'); fs.writeSync(fd, data);
    if (FSYNC) fs.fsyncSync(fd);
    fs.closeSync(fd); fd = null;
    fs.renameSync(tmp, f);
  } catch (e) {
    stats.writeErrors++;
    try { if (fd !== null) fs.closeSync(fd); } catch (_) {}
    try { fs.unlinkSync(tmp); } catch (_) {}
    _cache.delete(c); _chk.delete(c); _mtime.delete(c); _idx.delete(c);
    throw e;
  }
  try { _mtime.set(c, fs.statSync(f).mtimeMs); } catch (_) {}
  _chk.set(c, Date.now()); stats.writes++; _pc.set(c, Array.isArray(arr) ? arr.length : 0);
}
function flushAll() {
  if (_timer) { clearTimeout(_timer); _timer = null; }
  for (const [c, arr] of _dirty) {
    try {
      const pc = _pc.get(c);
      if (pc !== undefined && pc > 0 && pc <= arr.length) { if (pc < arr.length) { try { appendRecords(c, arr.slice(pc)); _pc.set(c, arr.length); } catch (_) { writeNow(c, arr); } } }
      else writeNow(c, arr);
      stats.deferredFlushes++;
    } catch (e) { console.error('[store] flush failed', c, e.message); }
  }
  _dirty.clear();
}
function save(c, arr) {
  _cache.set(c, arr);
  if (DEFER.test(c)) {
    _dirty.set(c, arr);
    if (!_timer) { _timer = setTimeout(flushAll, 300); if (_timer.unref) _timer.unref(); }
    return;
  }
  writeNow(c, arr);
}
function indexOf(c, arr, id) {
  const build = () => { const m = { arr, n: arr.length, map: new Map() }; arr.forEach((x, i) => { if (x && x.id !== undefined && !m.map.has(x.id)) m.map.set(x.id, i); }); _idx.set(c, m); return m; };
  let m = _idx.get(c);
  if (!m || m.arr !== arr || m.n !== arr.length) m = build();
  let i = m.map.get(id);
  if (i !== undefined && arr[i] && arr[i].id === id) return i;
  if (i !== undefined || m.map.size !== arr.length) { m = build(); i = m.map.get(id); if (i !== undefined && arr[i] && arr[i].id === id) return i; }
  return -1;
}
function readAll(c) { return load(c); }
function get(c, id) { const arr = load(c), i = indexOf(c, arr, id); return i >= 0 ? arr[i] : null; }
function put(c, rec) {
  const arr = load(c), i = indexOf(c, arr, rec.id);
  if (i >= 0) arr[i] = rec;
  else {
    arr.push(rec); const m = _idx.get(c); if (m && m.arr === arr) { m.map.set(rec.id, arr.length - 1); m.n = arr.length; }
    if (APPEND_ONLY.test(c) && _pc.get(c) === arr.length - 1 && _pc.get(c) > 0) {
      try { _cache.set(c, arr); appendRecords(c, [rec]); _pc.set(c, arr.length); return rec; } catch (_) { }
    }
  }
  save(c, arr); return rec;
}
function remove(c, id) {
  const arr = load(c);
  if (indexOf(c, arr, id) < 0) return { deleted: true, id };
  save(c, arr.filter(x => x.id !== id)); _idx.delete(c);
  return { deleted: true, id };
}
function uid(prefix) {
  const r = crypto.randomBytes(6).toString('hex');
  return (prefix ? prefix + '_' : '') + Date.now().toString(36) + r;
}
function saveAll(c, arr) { save(c, arr); _idx.delete(c); return arr; }
function invalidate(c) { if (c) { _cache.delete(c); _chk.delete(c); _idx.delete(c); } else { _cache.clear(); _chk.clear(); _idx.clear(); } }
process.on('exit', () => { try { flushAll(); } catch (_) {} });
module.exports = { readAll, get, put, remove, uid, saveAll, flushAll, invalidate, stats, DATA };
