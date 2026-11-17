'use strict';
const http = require('http');
const fs = require('fs');

const C = { r:'\x1b[0m', b:'\x1b[1m', d:'\x1b[2m', red:'\x1b[31m', g:'\x1b[32m', y:'\x1b[33m', c:'\x1b[36m' };

function httpReq(method, p, data, token) {
  return new Promise((res, rej) => {
    const body = data ? JSON.stringify(data) : null;
    const o = { hostname:'localhost', port:4000, path:p, method, timeout:15000 };
    o.headers = {};
    if (body) { o.headers['Content-Type']='application/json'; o.headers['Content-Length']=Buffer.byteLength(body); }
    if (token) o.headers['Authorization'] = 'Bearer ' + token;
    const r = http.request(o, r2 => {
      let b = ''; r2.on('data', c => b += c);
      r2.on('end', () => { try { res(JSON.parse(b)); } catch(e) { res({ ok:false, error:b.slice(0,100) }); } });
    });
    r.on('error', rej);
    r.on('timeout', () => { r.destroy(); rej(new Error('timeout')); });
    if (body) r.write(body);
    r.end();
  });
}

// جلالی دقیق (کپی از سرور)
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

function log(msg) { console.log('  ' + msg); }

(async () => {
  console.log('');
  console.log(C.c + '════════════════════════════════════════════════════════════════' + C.r);
  console.log(C.c + '  ' + C.b + 'تولید برنامه برای همه بخش‌ها' + C.r);
  console.log(C.c + '════════════════════════════════════════════════════════════════' + C.r);
  console.log('');

  // ۱) لاگین
  console.log(C.c + '▸ ۱) لاگین' + C.r);
  const lg = await httpReq('POST', '/api/auth/login', { username:'admin', password:'nabz@2026' });
  if (!lg.ok) { console.error(C.red + '  ❌ ' + (lg.error || 'login failed') + C.r); process.exit(1); }
  const token = lg.data.token;
  log(C.g + '✓' + C.r + ' admin / nabz@2026');
  console.log('');

  // ۲) دوره و بخش‌ها
  console.log(C.c + '▸ ۲) اطلاعات' + C.r);
  const period = (await httpReq('GET', '/api/sa/period', null, token)).data;
  const wardsResp = await httpReq('GET', '/api/sa/wards', null, token);
  const wards = wardsResp.data.items.filter(w => !w.isManagement);

  log(C.g + '✓' + C.r + ' دوره: ' + period.id + ' (' + period.jm + '/' + period.jy + ')');
  log(C.g + '✓' + C.r + ' بخش‌ها: ' + wards.length + ' (غیر مدیریتی)');

  const t = todayJ();
  const days = monthDays(t.jy, t.jm);
  log(C.g + '✓' + C.r + ' روزهای ماه: ' + days.length);
  console.log('');

  // ۳) برای هر بخش: نیازسنجی + حل
  console.log(C.c + '▸ ۳) تولید برای هر بخش' + C.r);
  console.log(C.d + '  نام بخش'.padEnd(30) + 'پرسنل  perShift  تخصیص  پوشش' + C.r);
  console.log(C.d + '  ' + '─'.repeat(58) + C.r);

  let totalAssigns = 0, totalNeed = 0, totalFilled = 0, okCount = 0, failCount = 0;
  const results = [];

  for (const w of wards) {
    try {
      const staffCount = w.staffCount || 0;
      // perShift = مینیمم بین ۱ تا ۳ (متناسب با تعداد پرسنل)
      const perShift = Math.max(1, Math.min(3, Math.floor(staffCount / 6)));

      // ساخت نیازسنجی (۳۰ روز × ۳ شیفت)
      const items = [];
      for (const date of days) {
        for (const shift of ['M', 'E', 'N']) {
          items.push({
            date, shift,
            minRn: perShift, minSup: 0,
            targetRn: perShift, targetSup: 0
          });
        }
      }

      // ذخیره نیازسنجی
      await httpReq('POST', '/api/sa/demands', { periodId: period.id, wardId: w.id, items }, token);

      // حل
      const sol = await httpReq('POST', '/api/sa/solve', { periodId: period.id, wardId: w.id }, token);
      if (!sol.ok) throw new Error(sol.error || 'solve failed');

      const saved = sol.data.saved || 0;
      const cov = sol.data.coverage || 0;
      const need = sol.data.metrics ? sol.data.metrics.totalMin : 0;

      totalAssigns += saved;
      totalNeed += need;
      totalFilled += saved;
      okCount++;

      const covColor = cov >= 90 ? C.g : cov >= 70 ? C.y : C.red;
      console.log('  ' + w.label.padEnd(28) + String(staffCount).padStart(4) + '     '
        + String(perShift).padStart(3) + '       '
        + String(saved).padStart(4) + '    '
        + covColor + String(cov).padStart(5) + '%' + C.r);

      results.push({ ward: w.label, staff: staffCount, perShift, saved, coverage: cov });
    } catch (e) {
      failCount++;
      console.log('  ' + C.red + '✗ ' + w.label + ': ' + e.message + C.r);
    }
  }

  console.log('');
  console.log(C.c + '▸ ۴) خلاصه' + C.r);
  log(C.g + '✓' + C.r + ' بخش‌های حل‌شده: ' + okCount + '/' + wards.length);
  if (failCount) log(C.red + '✗' + C.r + ' خطا: ' + failCount);
  log(C.g + '✓' + C.r + ' کل تخصیص‌ها: ' + totalAssigns.toLocaleString());
  const overallPct = totalNeed ? Math.round(totalFilled / totalNeed * 100) : 0;
  log(C.g + '✓' + C.r + ' پوشش کلی: ' + overallPct + '%');
  console.log('');

  // ۵) چک فایل‌ها
  console.log(C.c + '▸ ۵) فایل‌های داده' + C.r);
  const dataFiles = ['sa_assignments.json', 'sa_demands.json'];
  for (const f of dataFiles) {
    const fp = './data/' + f;
    if (fs.existsSync(fp)) {
      const arr = JSON.parse(fs.readFileSync(fp, 'utf8'));
      log(C.g + '✓' + C.r + ' ' + f + ': ' + arr.length.toLocaleString() + ' رکورد');
    } else {
      log(C.red + '✗' + C.r + ' ' + f + ': ساخته نشد');
    }
  }
  console.log('');

  // ۶) لیست ۵ بخش برتر
  console.log(C.c + '▸ ۶) بهترین بخش‌ها' + C.r);
  const top = results.sort((a, b) => b.coverage - a.coverage).slice(0, 5);
  for (const r of top) {
    log(C.g + '✓' + C.r + ' ' + r.ward + ': ' + r.coverage + '% (' + r.saved + ' تخصیص از ' + r.staff + ' پرسنل)');
  }
  console.log('');

  console.log(C.c + '════════════════════════════════════════════════════════════════' + C.r);
  console.log('  ' + C.b + C.g + '✅ تولید کامل شد' + C.r);
  console.log(C.c + '════════════════════════════════════════════════════════════════' + C.r);
  console.log('');
  console.log('  ' + C.d + 'حالا در مرورگر:' + C.r);
  console.log('  ' + C.b + '1' + C.r + '. Hard Reload: Ctrl+Shift+R × ۲');
  console.log('  ' + C.b + '2' + C.r + '. Login: admin / nabz@2026');
  console.log('  ' + C.b + '3' + C.r + '. منو ☰ → دستیار شیفت → بخش‌ها → یک بخش');
  console.log('  ' + C.b + '4' + C.r + '. تب «👁 پیش‌نمایش» → جدول پر شده');
  console.log('  ' + C.b + '5' + C.r + '. دکمه «🖨 چاپ / PDF برنامه» → PDF باز می‌شود');
  console.log('');
})().catch(e => { console.error(C.red + 'FATAL: ' + e.message + C.r); process.exit(1); });
