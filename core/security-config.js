'use strict';
const fs = require('fs'), path = require('path');
const store = require('./store');
const FILE = path.join(store.DATA, '_security_config.json');
const DEFAULTS = { forcePasswordChangeOnLogin: false, updatedAt: null, updatedBy: null };
let _cache = null, _cacheTs = 0;
function read() {
  const now = Date.now();
  if (_cache && now - _cacheTs < 2000) return _cache;
  try {
    if (fs.existsSync(FILE)) _cache = Object.assign({}, DEFAULTS, JSON.parse(fs.readFileSync(FILE, 'utf8')));
    else _cache = Object.assign({}, DEFAULTS);
  } catch (_) { _cache = Object.assign({}, DEFAULTS); }
  _cacheTs = now;
  return _cache;
}
function write(patch, actor) {
  const next = Object.assign({}, read(), patch, {
    updatedAt: new Date().toISOString(),
    updatedBy: actor ? (actor.username || actor.id) : 'system'
  });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, FILE);
  _cache = next; _cacheTs = Date.now();
  return next;
}
function isForcePasswordChangeActive() { return read().forcePasswordChangeOnLogin === true; }
module.exports = { read, write, isForcePasswordChangeActive, DEFAULTS, FILE };
