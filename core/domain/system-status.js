'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');

function _file(p) { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch(_) { return ''; } }
function _cnt(s, re) { return (s.match(re) || []).length; }
function _sd(x) { return x ? new Date(x).getTime() : 0; }
function _all(c) { try { return require('../store').readAll(c); } catch(_) { return []; } }

const DOMAIN_DEF = {
  orders:   { coll: 'orders',   files: ['modules/clinical.js','modules/clinical_protocols.js','modules/rounds_v2.js','modules/teaching_mode.js','modules/nursing_workspace.js','modules/encounters.js'] },
  vitals:   { coll: 'vitals',   files: ['modules/clinical.js','modules/nursing_mode.js','modules/flow.js'] },
  mar:      { coll: 'mar',      files: ['modules/clinical.js','modules/nursing_workspace.js','modules/mar_advanced.js'] },
  consults: { coll: 'consults', files: ['modules/encounters.js','modules/rounds_v2.js','modules/workflow.js'] }
};

function _domains() {
  const out = {};
  for (const [name, d] of Object.entries(DOMAIN_DEF)) {
    let puts = 0, dirty = [];
    for (const f of d.files) {
      const c = _cnt(_file(f), new RegExp("store\\.put\\(['\"]" + d.coll + "['\"]", 'g'));
      if (c > 0) { puts += c; dirty.push({ file: f, puts: c }); }
    }
    out[name] = { clean: puts === 0, totalPuts: puts, dirty };
  }
  return out;
}

function _collections() {
  const keys = ['patients','orders','vitals','mar','consults','cdss_alerts','io_records','beds'];
  const o = {};
  for (const k of keys) o[k] = _all(k).length;
  return o;
}

function _alerts() {
  const d24 = Date.now() - 86400000;
  const a = _all('cdss_alerts').filter(x => !x.dismissed && _sd(x.createdAt) > d24);
  return {
    last24h: a.length,
    critical: a.filter(x => x.severity === 'critical').length,
    high: a.filter(x => x.severity === 'high').length
  };
}

function _events() {
  try {
    const b = require('../events');
    const r = b.recent ? b.recent(1) : [];
    return r[0] ? { latestEvent: r[0].event, latestAt: r[0].at } : { latestEvent: null, latestAt: null };
  } catch(_) { return { latestEvent: null, latestAt: null }; }
}

function _tests() {
  try {
    const raw = fs.readFileSync(path.join(ROOT, 'data', 'test-last.json'), 'utf8');
    return JSON.parse(raw);
  } catch(_) { return { at: null, passed: 0, failed: 0, total: 0 }; }
}

function _uptime() {
  const s = Math.floor(process.uptime());
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  return { seconds: s, human: h + 'h ' + m + 'm ' + sec + 's' };
}

function _memory() {
  const m = process.memoryUsage();
  return { rss_mb: Math.round(m.rss/1048576), heap_mb: Math.round(m.heapUsed/1048576) };
}

function getStatus() {
  const domains = _domains();
  return {
    at: new Date().toISOString(),
    server: { uptime: _uptime(), memory: _memory(), nodeVersion: process.version, pid: process.pid },
    domains,
    allDomainsClean: Object.values(domains).every(d => d.clean),
    collections: _collections(),
    alerts: _alerts(),
    events: _events(),
    tests: _tests()
  };
}

module.exports = { getStatus };
