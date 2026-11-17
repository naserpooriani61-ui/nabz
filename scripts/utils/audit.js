'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const C = { r:'\x1b[0m', b:'\x1b[1m', d:'\x1b[2m', red:'\x1b[31m', g:'\x1b[32m', y:'\x1b[33m', c:'\x1b[36m', m:'\x1b[35m' };
function hdr(t) {
  console.log('');
  console.log(C.c + '════════════════════════════════════════════════════════════════' + C.r);
  console.log(C.c + '  ' + C.b + t + C.r);
  console.log(C.c + '════════════════════════════════════════════════════════════════' + C.r);
}
function sub(t) { console.log('\n' + C.m + '▸ ' + C.b + t + C.r + '\n' + C.d + '  ─────────────────────────────────' + C.r); }
function row(l, v, s) {
  const i = s === 'ok' ? C.g+'✓' : s === 'warn' ? C.y+'!' : s === 'fail' ? C.red+'✗' : '·';
  console.log('  ' + i + C.r + ' ' + l.padEnd(40) + C.c + v + C.r);
}
function req(method, p, data, token) {
  return new Promise(res => {
    const body = data ? JSON.stringify(data) : null;
    const o = { hostname:'localhost', port:4000, path:p, method, timeout:4000 };
    o.headers = {};
    if (body) { o.headers['Content-Type']='application/json'; o.headers['Content-Length']=Buffer.byteLength(body); }
    if (token) o.headers['Authorization'] = 'Bearer ' + token;
    const r = http.request(o, r2 => {
      let b = ''; r2.on('data', x => b += x);
      r2.on('end', () => { let p2 = null; try { p2 = JSON.parse(b); } catch(_){} res({ status:r2.statusCode, parsed:p2 }); });
    });
    r.on('error', e => res({ status:0, error:e.message }));
    r.on('timeout', () => { r.destroy(); res({ status:0, error:'timeout' }); });
    if (body) r.write(body);
    r.end();
  });
}

async function main() {
  const cwd = process.cwd();
  hdr('NABZ — ممیزی');
  console.log(C.d + '  cwd: ' + cwd + C.r);
  console.log(C.d + '  file: ' + __filename + C.r);

  // ── درستی محل
  if (!fs.existsSync('modules') || !fs.existsSync('core')) {
    console.log('\n' + C.red + '❌ در ریشهٔ پروژه نیستید!' + C.r);
    console.log('   نیاز: modules/ و core/ اینجا باشند');
    return;
  }

  // ۱) ماژول‌ها
  sub('۱) ماژول‌ها — بارگذاری');
  const files = fs.readdirSync('modules').filter(f => f.endsWith('.js')).sort();
  let ok = 0, fail = 0;
  const loaded = {};
  for (const f of files) {
    const n = f.replace('.js','');
    try {
      const m = require(path.join(cwd, 'modules', f));
      loaded[n] = m;
      row(n, (m.routes||[]).length + 'r · ' + (m.panels||[]).length + 'p · ' + Object.keys(m.handlers||{}).length + 'h', 'ok');
      ok++;
    } catch (e) { row(n, 'ERR: ' + e.message.slice(0,35), 'fail'); fail++; }
  }
  console.log('\n  ' + C.b + ok + ' موفق' + C.r + (fail ? ' · ' + C.red + fail + ' خطا' + C.r : ''));

  // ۲) پنل‌ها
  sub('۲) پنل‌ها — یکتایی');
  const panels = [];
  for (const [n, m] of Object.entries(loaded))
    for (const p of (m.panels || []))
      panels.push({ id: n + '.' + p.id, kind: p.kind, module: n });
  const seen = {}; let dup = 0;
  for (const p of panels) { if (seen[p.id]) dup++; seen[p.id] = 1; }
  row('کل', String(panels.length), 'ok');
  row('یکتا', dup === 0 ? 'همه' : dup + ' تکراری', dup === 0 ? 'ok' : 'fail');
  // مهم‌ترین‌ها
  for (const key of ['shift_assistant.dashboard', 'cdss.dashboard', 'clinical.patients']) {
    row(key, seen[key] ? 'موجود' : 'غایب', seen[key] ? 'ok' : 'fail');
  }

  // ۳) داده
  sub('۳) داده — روی دیسک');
  const dataDir = path.join(cwd, 'data');
  const dataFiles = ['sa_wards.json','sa_staff.json','sa_periods.json','sa_assignments.json','sa_demands.json','sa_preferences.json'];
  for (const f of dataFiles) {
    const fp = path.join(dataDir, f);
    if (!fs.existsSync(fp)) { row(f, 'نیست', 'warn'); continue; }
    try {
      const arr = JSON.parse(fs.readFileSync(fp, 'utf8'));
      row(f, Array.isArray(arr) ? arr.length + ' رکورد' : 'object', 'ok');
    } catch (e) { row(f, 'خراب: ' + e.message.slice(0,25), 'fail'); }
  }

  // ۴) لاگین
  sub('۴) لاگین');
  const lg = await req('POST', '/api/auth/login', { username:'admin', password:'nabz@2026' });
  if (lg.parsed && lg.parsed.ok && lg.parsed.data && lg.parsed.data.token) {
    row('admin / nabz@2026', 'OK', 'ok');
  } else {
    row('admin / nabz@2026', 'HTTP ' + lg.status + ' — ' + ((lg.parsed && lg.parsed.error) || lg.error || '?'), 'fail');
    return;
  }
  const token = lg.parsed.data.token;

  // ۵) endpoint
  sub('۵) endpoint‌های کلیدی');
  const eps = [
    ['/api/_modules', 'پنل‌ها'],
    ['/api/home/dashboard', 'داشبورد'],
    ['/api/clinical/patients', 'بیماران'],
    ['/api/neural/alerts', 'هشدار عصبی'],
    ['/api/cdss/dashboard', 'CDSS'],
    ['/api/sa/wards', 'دستیار شیفت'],
    ['/api/voice/stats', 'یادداشت صوتی'],
    ['/api/crisis/active', 'بحران'],
    ['/api/ops2/health', 'سلامت']
  ];
  for (const [p, l] of eps) {
    const r = await req('GET', p, null, token);
    const good = r.status === 200 && r.parsed && r.parsed.ok;
    let extra = '';
    if (good && r.parsed.data && Array.isArray(r.parsed.data.items)) extra = ' (' + r.parsed.data.items.length + ')';
    row(l, 'HTTP ' + r.status + extra, good ? 'ok' : (r.status === 403 ? 'warn' : 'fail'));
  }

  // ۶) تقویم
  sub('۶) تقویم جلالی');
  const _d = (a,b) => Math.trunc(a/b);
  function jc(jy) {
    const b = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
    const gy = jy+621; let lJ=-14, jp=b[0], jm, jump=0, n, i;
    for (i=1;i<b.length;i++){jm=b[i];jump=jm-jp;if(jy<jm)break;lJ+=_d(jump,33)*8+_d(jump%33,4);jp=jm;}
    n=jy-jp; lJ+=_d(n,33)*8+_d((n%33)+3,4);
    if((jump%33)===4&&(jump-n)===4)lJ+=1;
    const lG=_d(gy,4)-_d((_d(gy,100)+1)*3,4)-150;
    const march=20+lJ-lG; if((jump-n)<6)n=n-jump+_d(jump+4,33)*33;
    let leap=((n+1)%33-1)%4; if(leap===-1)leap=4;
    return {leap, gy, march};
  }
  function g2d(gy,gm,gd){let d=_d((gy+_d(gm-8,6)+100100)*1461,4)+_d(153*((gm+9)%12)+2,5)+gd-34840408;return d-_d(_d(gy+100100+_d(gm-8,6),100)*3,4)+752;}
  function d2j(jdn){
    let j=4*jdn+139361631;j=j+_d(_d(4*jdn+183187720,146097)*3,4)*4-3908;
    const i=_d(j%1461,4)*5+308;
    const gy=_d(j,1461)-100100+_d(8-_d(i%153,12),6);
    let jy=gy-621; const r=jc(jy); const jdn1f=g2d(gy,3,r.march); let k=jdn-jdn1f;
    if(k>=0){if(k<=185)return {jy,jm:1+_d(k,31),jd:(k%31)+1};k-=186;}
    else{jy-=1;k+=179;if(r.leap===1)k+=1;}
    return {jy,jm:7+_d(k,30),jd:(k%30)+1};
  }
  const T = [
    {g:[2024,3,20], j:[1403,1,1], n:'نوروز ۱۴۰۳'},
    {g:[2024,10,10], j:[1403,7,19], n:'۱۴۰۳/۷/۱۹'},
    {g:[2025,3,21], j:[1404,1,1], n:'نوروز ۱۴۰۴'}
  ];
  let cok = 0;
  for (const t of T) {
    const j = d2j(g2d(t.g[0],t.g[1],t.g[2]));
    const m = j.jy===t.j[0] && j.jm===t.j[1] && j.jd===t.j[2];
    row(t.n, m ? 'OK' : 'انتظار ' + t.j.join('/'), m ? 'ok' : 'fail');
    if (m) cok++;
  }

  // ۷) فرانت
  sub('۷) فرانت — syntax');
  const ff = ['app.js','extra.js','sa.js','sa-init.js','sa-extra.js','cdss.js','voice.js','voice-init.js','offline.js','offline-init.js'];
  let fok = 0, ffail = 0;
  for (const f of ff) {
    const p = path.join(cwd, 'public', f);
    if (!fs.existsSync(p)) { row(f, 'نیست', 'warn'); continue; }
    try { new Function(fs.readFileSync(p, 'utf8')); row(f, (fs.statSync(p).size/1024).toFixed(0)+'KB', 'ok'); fok++; }
    catch (e) { row(f, 'ERR: ' + e.message.slice(0,30), 'fail'); ffail++; }
  }

  // خلاصه
  hdr('خلاصه');
  console.log('');
  console.log('  ' + C.b + 'ماژول‌ها: ' + C.r + (fail === 0 ? C.g : C.y) + ok + ' موفق' + C.r + (fail ? ' · ' + C.red + fail + ' خطا' + C.r : ''));
  console.log('  ' + C.b + 'پنل‌ها: ' + C.r + panels.length + ' · ' + (dup === 0 ? C.g + 'یکتا' + C.r : C.red + dup + ' تکراری' + C.r));
  console.log('  ' + C.b + 'تقویم: ' + C.r + (cok === T.length ? C.g + 'دقیق' + C.r : C.red + cok + '/' + T.length + C.r));
  console.log('  ' + C.b + 'فرانت: ' + C.r + (ffail === 0 ? C.g : C.y) + fok + ' OK' + C.r + (ffail ? ' · ' + C.red + ffail + ' خطا' + C.r : ''));
  console.log('');
  console.log(C.d + '  ─────────────────────────────' + C.r);
}

main().catch(e => { console.error(C.red + 'FATAL: ' + e.message + C.r); console.error(e.stack); process.exit(1); });
