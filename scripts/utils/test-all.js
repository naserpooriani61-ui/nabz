'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const C = { r:'\x1b[0m', b:'\x1b[1m', d:'\x1b[2m', red:'\x1b[31m', g:'\x1b[32m', y:'\x1b[33m', c:'\x1b[36m', m:'\x1b[35m' };
const hdr = t => {
  console.log('');
  console.log(C.c + '════════════════════════════════════════════════════════════════' + C.r);
  console.log(C.c + '  ' + C.b + t + C.r);
  console.log(C.c + '════════════════════════════════════════════════════════════════' + C.r);
};
const sub = t => console.log('\n' + C.m + '▸ ' + C.b + t + C.r);
const row = (icon, label, detail, color) => {
  color = color || C.r;
  console.log('  ' + icon + C.r + ' ' + label.padEnd(45) + color + (detail || '') + C.r);
};

const modDir = path.join(__dirname, 'modules');
const modFiles = fs.readdirSync(modDir).filter(f => f.endsWith('.js')).sort();
const MODS = {}, loadErrs = [];
for (const f of modFiles) {
  const name = f.replace('.js','');
  try { MODS[name] = require(path.join(modDir, f)); }
  catch (e) { loadErrs.push({ name, err: e.message }); }
}

const routes = [];
for (const [name, mod] of Object.entries(MODS))
  for (const r of (mod.routes || []))
    routes.push({ method: r.method, path: r.path, mod: name });
const coreRoutes = [
  { method:'POST', path:'/api/auth/login' },
  { method:'GET',  path:'/api/auth/me' },
  { method:'GET',  path:'/api/_modules' },
  { method:'GET',  path:'/api/neural/stats' },
  { method:'GET',  path:'/api/neural/alerts' },
  { method:'GET',  path:'/api/neural/cohort' },
  { method:'GET',  path:'/api/events/recent' },
  { method:'GET',  path:'/api/audit/verify' }
];
for (const r of coreRoutes) routes.push({ method:r.method, path:r.path, mod:'core' });

const panels = [];
for (const [name, mod] of Object.entries(MODS))
  for (const p of (mod.panels || []))
    panels.push({ mod: name, id: name + '.' + p.id, kind: p.kind, api: p.api, perm: p.perm, title: p.title });

const KINDS = new Set(['list','stats','chart','action','pipeline','health','backup','audit','crisis','analytics','bedboard','nursing','sa_dashboard','sa_staff','cdss']);

const staticIssues = [];
for (const p of panels) {
  if (p.kind && !KINDS.has(p.kind))
    staticIssues.push({ panel: p.id, type: 'kind', detail: 'kind="'+p.kind+'" renderer ندارد' });
  if (p.api) {
    const ok = routes.some(r => {
      if (r.method !== 'GET') return false;
      if (r.path === p.api) return true;
      const pat = r.path.replace(/:\w+/g, '[^/]+');
      return new RegExp('^' + pat + '$').test(p.api);
    });
    if (!ok) staticIssues.push({ panel: p.id, type: 'api', detail: p.api + ' → route ندارد' });
  }
}

function req(method, p, data, token) {
  return new Promise(res => {
    const body = data ? JSON.stringify(data) : null;
    const o = { hostname:'localhost', port:4000, path:p, method, timeout:5000, headers:{} };
    if (body) { o.headers['Content-Type'] = 'application/json'; o.headers['Content-Length'] = Buffer.byteLength(body); }
    if (token) o.headers['Authorization'] = 'Bearer ' + token;
    const r = http.request(o, r2 => {
      let b = ''; r2.on('data', x => b += x);
      r2.on('end', () => { let pp = null; try { pp = JSON.parse(b); } catch(_){} res({ status: r2.statusCode, parsed: pp }); });
    });
    r.on('error', e => res({ status:0, error:e.message }));
    r.on('timeout', () => { r.destroy(); res({ status:0, error:'timeout' }); });
    if (body) r.write(body);
    r.end();
  });
}

async function main() {
  hdr('تست کامل نبض');

  sub('۱) تحلیل استاتیک');
  console.log('  ماژول‌ها: ' + Object.keys(MODS).length + '  ·  روت‌ها: ' + routes.length + '  ·  پنل‌ها: ' + panels.length);
  if (loadErrs.length) {
    for (const e of loadErrs) row(C.red + '✗' + C.r, e.name, e.err);
  } else {
    row(C.g + '✓' + C.r, 'بارگذاری ماژول‌ها', 'همه موفق');
  }
  if (staticIssues.length === 0) {
    row(C.g + '✓' + C.r, 'route/kind', 'همه معتبر');
  } else {
    for (const i of staticIssues) row(C.red + '✗' + C.r, i.panel, i.detail);
  }

  sub('۲) تست زنده endpoint‌ها');
  const ping = await req('GET', '/api/auth/me');
  if (ping.status === 0) {
    row(C.y + '!' + C.r, 'سرور خاموش', '—');
    return finish(false, [], staticIssues);
  }

  const lg = await req('POST', '/api/auth/login', { username:'admin', password:'nabz@2026' });
  if (!lg.parsed || !lg.parsed.ok) {
    row(C.red + '✗' + C.r, 'login', (lg.parsed && lg.parsed.error) || 'failed');
    return finish(false, [], staticIssues);
  }
  const token = lg.parsed.data.token;
  row(C.g + '✓' + C.r, 'login admin', 'OK');

  const liveIssues = [];
  for (const p of panels) {
    if (!p.api) continue;
    const res = await req('GET', p.api, null, token);
    if (!res.parsed || !res.parsed.ok) {
      liveIssues.push({ panel:p.id, api:p.api, detail: 'HTTP ' + res.status + ' — ' + ((res.parsed && res.parsed.error) || res.error || '?') });
      continue;
    }
    const d = res.parsed.data;
    if (p.kind === 'list' && (!d || !Array.isArray(d.items))) {
      liveIssues.push({ panel:p.id, api:p.api, detail: 'kind=list اما data.items نیست' });
    }
    if (p.kind === 'stats' && (typeof d !== 'object' || d === null || Array.isArray(d))) {
      liveIssues.push({ panel:p.id, api:p.api, detail: 'kind=stats اما data object نیست' });
    }
    if (p.kind === 'chart' && (!d || (!d.series && !d.labels))) {
      liveIssues.push({ panel:p.id, api:p.api, detail: 'kind=chart اما series/labels نیست' });
    }
  }

  if (liveIssues.length === 0) {
    row(C.g + '✓' + C.r, 'همه ' + panels.length + ' پنل', 'سالم');
  } else {
    for (const i of liveIssues) row(C.red + '✗' + C.r, i.panel, i.detail);
  }

  finish(true, liveIssues, staticIssues);
}

function finish(serverUp, live, staticList) {
  live = live || [];
  staticList = staticList || [];
  hdr('خلاصه');
  console.log('  استاتیک: ' + (staticList.length === 0 ? C.g + '✅ 0' + C.r : C.red + '❌ ' + staticList.length + C.r));
  console.log('  زنده:    ' + (serverUp ? (live.length === 0 ? C.g + '✅ 0' + C.r : C.red + '❌ ' + live.length + C.r) : C.y + '! سرور خاموش' + C.r));
  console.log('');
  if ((staticList.length + live.length) > 0) {
    console.log('  ' + C.b + 'برای رفع:' + C.r);
    for (const i of staticList) console.log('    ' + C.red + '✗' + C.r + ' ' + i.panel + ' — ' + i.detail);
    for (const i of live) console.log('    ' + C.red + '✗' + C.r + ' ' + i.panel + ' — ' + i.detail);
  } else {
    console.log('  ' + C.g + C.b + '✅ همه پنل‌ها سالم — آماده تحویل' + C.r);
  }
  console.log('');
}

main().catch(e => { console.error(C.red + 'FATAL: ' + e.message + C.r); process.exit(1); });
