'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const C = { r:'\x1b[0m', b:'\x1b[1m', d:'\x1b[2m', red:'\x1b[31m', g:'\x1b[32m', y:'\x1b[33m', c:'\x1b[36m' };

// ── چک سرور ──
let running = false;
try {
  const ps = execSync('pgrep -f "core/server.js"', { encoding:'utf8', stdio:['ignore','pipe','ignore'] });
  running = !!ps.trim();
} catch (_) {}
if (running) {
  console.log(C.y + '⚠️  سرور روشن است — اول ببندید:' + C.r);
  console.log('  ' + C.b + 'pkill -9 -f "core/server.js"' + C.r);
  process.exit(1);
}

// ── store ──
const store = require('./core/store');
const DATA_DIR = store.DATA;
const realReadAll = store.readAll.bind(store);
const realGet = store.get.bind(store);

// ── Buffered write ──
const writeBuf = {};
const deleteSet = {};

store.put = function(coll, rec) {
  if (!writeBuf[coll]) writeBuf[coll] = {};
  writeBuf[coll][rec.id] = rec;
  return rec;
};
store.remove = function(coll, id) {
  if (!deleteSet[coll]) deleteSet[coll] = new Set();
  deleteSet[coll].add(id);
  if (writeBuf[coll]) delete writeBuf[coll][id];
  return { deleted:true, id };
};
store.readAll = function(coll) {
  let arr = realReadAll(coll).slice();
  if (deleteSet[coll]) arr = arr.filter(x => !deleteSet[coll].has(x.id));
  if (writeBuf[coll]) {
    const puts = Object.values(writeBuf[coll]);
    const putMap = {};
    for (const r of puts) putMap[r.id] = r;
    const existing = new Set(arr.map(x => x.id));
    const merged = arr.map(x => putMap[x.id] || x);
    for (const r of puts) if (!existing.has(r.id)) merged.push(r);
    arr = merged;
  }
  return arr;
};

function flush() {
  const colls = new Set([...Object.keys(writeBuf), ...Object.keys(deleteSet)]);
  const stats = {};
  for (const coll of colls) {
    const finalArr = store.readAll(coll);
    const fp = path.join(DATA_DIR, coll + '.json');
    fs.writeFileSync(fp, JSON.stringify(finalArr, null, 2));
    stats[coll] = finalArr.length;
  }
  return stats;
}

// ── جلالی ──
const _div = (a,b) => Math.trunc(a/b);
function jc(jy) {
  const b = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
  const gy = jy+621; let lJ=-14, jp=b[0], jm, jump=0, n, i;
  for (i=1;i<b.length;i++){jm=b[i];jump=jm-jp;if(jy<jm)break;lJ+=_div(jump,33)*8+_div(jump%33,4);jp=jm;}
  n=jy-jp; lJ+=_div(n,33)*8+_div((n%33)+3,4);
  if((jump%33)===4&&(jump-n)===4)lJ+=1;
  const lG=_div(gy,4)-_div((_div(gy,100)+1)*3,4)-150;
  const march=20+lJ-lG; if((jump-n)<6)n=n-jump+_div(jump+4,33)*33;
  let leap=((n+1)%33-1)%4; if(leap===-1)leap=4;
  return {leap, gy, march};
}
function g2d(gy,gm,gd){let d=_div((gy+_div(gm-8,6)+100100)*1461,4)+_div(153*((gm+9)%12)+2,5)+gd-34840408;return d-_div(_div(gy+100100+_div(gm-8,6),100)*3,4)+752;}
function d2j(jdn){
  let j=4*jdn+139361631;j=j+_div(_div(4*jdn+183187720,146097)*3,4)*4-3908;
  const i=_div(j%1461,4)*5+308;
  const gy=_div(j,1461)-100100+_div(8-_div(i%153,12),6);
  let jy=gy-621; const r=jc(jy); const jdn1f=g2d(gy,3,r.march); let k=jdn-jdn1f;
  if(k>=0){if(k<=185)return {jy,jm:1+_div(k,31),jd:(k%31)+1};k-=186;}
  else{jy-=1;k+=179;if(r.leap===1)k+=1;}
  return {jy,jm:7+_div(k,30),jd:(k%30)+1};
}
function todayJ(){const n=new Date();return d2j(g2d(n.getFullYear(),n.getMonth()+1,n.getDate()));}
function monthLength(jy,jm){if(jm<=6)return 31;if(jm<=11)return 30;return jc(jy).leap===0?30:29;}
function pad(n){return String(n).padStart(2,'0');}
function monthDays(jy,jm){const ml=monthLength(jy,jm);const out=[];for(let d=1;d<=ml;d++)out.push(jy+'/'+pad(jm)+'/'+pad(d));return out;}

// ── handlers ──
const H = require('./modules/shift_assistant').handlers;

function makeCtx(body) {
  return {
    body: body || {},
    params: {}, query: {},
    actor: { id:'usr_admin', username:'admin', role:'admin' },
    store: store,
    bus: { emit: () => {} },
    now: () => new Date().toISOString(),
    uid: (p) => store.uid(p),
    E: {
      badRequest: m => ({ code:400, message:m }),
      notFound: m => ({ code:404, message:m }),
      forbidden: m => ({ code:403, message:m }),
      conflict: m => ({ code:409, message:m })
    },
    res: null
  };
}

// ── MAIN ──
const t0 = Date.now();
console.log('');
console.log(C.c + '════════════════════════════════════════════════════════════════' + C.r);
console.log(C.c + '  ' + C.b + 'تولید مستقیم — بدون HTTP، بدون O(n²)' + C.r);
console.log(C.c + '════════════════════════════════════════════════════════════════' + C.r);
console.log('');

const period = store.readAll('sa_periods')[0];
if (!period) { console.error(C.red + '❌ دوره نیست' + C.r); process.exit(1); }
const wards = store.readAll('sa_wards').filter(w => !w.isManagement);
const staffAll = store.readAll('sa_staff');
const days = monthDays(period.jy, period.jm);

console.log('  دوره: ' + period.id);
console.log('  بخش‌ها: ' + wards.length);
console.log('  پرسنل: ' + staffAll.length);
console.log('  روزهای ماه: ' + days.length);
console.log('');

// ── ۱) Demands ──
console.log(C.c + '▸ ۱) نیازسنجی' + C.r);
for (const w of wards) {
  const staffCount = staffAll.filter(s => s.wardId === w.id && s.active).length;
  const perShift = Math.max(1, Math.min(3, Math.floor(staffCount / 6)));
  // پاک‌کردن قدیم
  for (const old of realReadAll('sa_demands').filter(d => d.periodId === period.id && d.wardId === w.id)) {
    store.remove('sa_demands', old.id);
  }
  // ساخت جدید
  let cnt = 0;
  for (const date of days) {
    for (const shift of ['M','E','N']) {
      store.put('sa_demands', {
        id: store.uid('sadm'), periodId: period.id, wardId: w.id,
        date, shift, minRn: perShift, minSup: 0, targetRn: perShift, targetSup: 0,
        updatedAt: new Date().toISOString()
      });
      cnt++;
    }
  }
  console.log('  ' + C.g + '✓' + C.r + ' ' + w.label.padEnd(28) + cnt + ' demand rows');
}
console.log('');

// ── ۲) Solve ──
console.log(C.c + '▸ ۲) حل' + C.r);
console.log(C.d + '  ' + 'بخش'.padEnd(28) + 'پرسنل  perShift  تخصیص  پوشش' + C.r);
console.log(C.d + '  ' + '─'.repeat(58) + C.r);

const results = [];
let totalSaved = 0;
for (const w of wards) {
  try {
    const staffCount = staffAll.filter(s => s.wardId === w.id && s.active).length;
    const perShift = Math.max(1, Math.min(3, Math.floor(staffCount / 6)));
    const ctx = makeCtx({ periodId: period.id, wardId: w.id });
    const r = H.solve(ctx);
    totalSaved += r.saved;
    results.push({ ward: w.label, staff: staffCount, perShift, saved: r.saved, coverage: r.coverage });
    const covColor = r.coverage >= 90 ? C.g : r.coverage >= 70 ? C.y : C.red;
    console.log('  ' + w.label.padEnd(28) + String(staffCount).padStart(5) + '    '
      + String(perShift).padStart(3) + '    '
      + String(r.saved).padStart(5) + '    '
      + covColor + String(r.coverage).padStart(6) + '%' + C.r);
  } catch (e) {
    console.log('  ' + C.red + '✗ ' + w.label + ': ' + e.message + C.r);
  }
}
console.log('');

// ── ۳) Flush ──
console.log(C.c + '▸ ۳) ذخیره نهایی' + C.r);
const flushStart = Date.now();
const stats = flush();
const flushMs = Date.now() - flushStart;
for (const [coll, count] of Object.entries(stats)) {
  console.log('  ' + C.g + '✓' + C.r + ' ' + coll + '.json: ' + count.toLocaleString() + ' رکورد');
}
console.log('  ' + C.d + 'flush: ' + flushMs + 'ms' + C.r);
console.log('');

// ── خلاصه ──
const elapsed = Math.round((Date.now() - t0) / 1000);
const avgCov = results.length ? Math.round(results.reduce((s,r) => s + r.coverage, 0) / results.length) : 0;

console.log(C.c + '════════════════════════════════════════════════════════════════' + C.r);
console.log('  ' + C.b + C.g + '✅ تولید کامل — ' + elapsed + ' ثانیه' + C.r);
console.log(C.c + '════════════════════════════════════════════════════════════════' + C.r);
console.log('');
console.log('  کل تخصیص‌ها: ' + totalSaved.toLocaleString());
console.log('  میانگین پوشش: ' + avgCov + '%');
console.log('  موفق: ' + results.length + '/' + wards.length);
console.log('');
console.log('  ' + C.b + 'گام بعد:' + C.r);
console.log('  1. سرور:');
console.log('     ' + C.d + 'export NODE_OPTIONS="--max-old-space-size=384"' + C.r);
console.log('     ' + C.d + 'nohup node core/server.js > ~/nabz-server.log 2>&1 &' + C.r);
console.log('  2. مرورگر:');
console.log('     F12 → Application → Storage → Clear site data');
console.log('     Ctrl+Shift+R × ۲');
console.log('  3. admin / nabz@2026 → دستیار شیفت');
console.log('');
