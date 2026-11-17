'use strict';
// Standalone diagnostic — port 4001, no SW, no cache.
const http = require('http');
const PORT = 4001;
const MAIN_PORT = 4000;

const HTML = `<!DOCTYPE html>
<html lang="fa" dir="rtl"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>NABZ Diagnostic</title>
<style>
body{font-family:system-ui,Vazirmatn,sans-serif;background:#f8fafc;color:#0f172a;padding:16px;max-width:900px;margin:0 auto;font-size:14px}
h1{font-size:20px;color:#0891b2;margin-bottom:4px}
h2{font-size:14px;margin:0 0 10px;color:#0f172a}
.sub{font-size:12px;color:#64748b;margin-bottom:16px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:12px}
.card.ok{border-color:#16a34a;background:#f0fdf4}
.card.bad{border-color:#dc2626;background:#fef2f2}
.card.warn{border-color:#d97706;background:#fffbeb}
.row{display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;border-bottom:1px solid #f1f5f9;gap:8px}
.row:last-child{border:none}
.key{color:#64748b;flex-shrink:0}
.val{font-family:ui-monospace,monospace;font-weight:600;text-align:left;word-break:break-all}
.ok{color:#16a34a}.bad{color:#dc2626}.warn{color:#d97706}
button{padding:12px 20px;background:#0891b2;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-family:inherit;font-size:14px;margin:4px 4px 4px 0}
button:hover{opacity:.9}
button.orange{background:#d97706}
button.red{background:#dc2626}
button.green{background:#16a34a}
pre{background:#f1f5f9;padding:10px;border-radius:6px;overflow-x:auto;font-size:11px;font-family:monospace;margin:8px 0 0;max-height:200px;overflow-y:auto;white-space:pre-wrap;word-break:break-all}
.hint{background:#eff6ff;border:1px solid #3b82f6;border-radius:6px;padding:10px;font-size:12px;margin-top:10px;line-height:1.7}
.big{font-size:16px;font-weight:900;margin-bottom:4px}
</style></head><body>

<h1>🔍 NABZ Login Diagnostic</h1>
<div class="sub">پورت 4001 — بدون Service Worker، بدون Cache — تست خالص</div>

<div class="card">
  <h2>1. اطلاعات مرورگر</h2>
  <div class="row"><span class="key">URL</span><span class="val" id="v-url">…</span></div>
  <div class="row"><span class="key">Hostname</span><span class="val" id="v-host">…</span></div>
  <div class="row"><span class="key">User-Agent</span><span class="val" id="v-ua" style="font-size:10px">…</span></div>
</div>

<div class="card" id="c-sw">
  <h2>2. Service Worker در این origin (4001)</h2>
  <div class="row"><span class="key">پشتیبانی</span><span class="val" id="v-swsup">…</span></div>
  <div class="row"><span class="key">تعداد ثبت‌شده</span><span class="val" id="v-swcount">…</span></div>
  <div class="hint" style="margin-top:8px">👈 اینجا 0 باید باشد (چون هیچ SW ثبت نکرده‌ایم). SW در origin 4000 کاملاً جدا است و از اینجا دیده نمی‌شود.</div>
</div>

<div class="card">
  <h2>3. LocalStorage در این origin</h2>
  <div class="row"><span class="key">تعداد کلید</span><span class="val" id="v-lscount">…</span></div>
  <div class="row"><span class="key">nabz_tk</span><span class="val" id="v-lstk">…</span></div>
</div>

<div class="card">
  <h2>4. 🔥 تست ۱ — دسترسی به سرور اصلی (پورت 4000)</h2>
  <div style="font-size:12px;color:#64748b;margin-bottom:8px">این فقط چک می‌کند که مرورگر می‌تواند به پورت 4000 وصل شود.</div>
  <button onclick="testAccess()">🔍 تست دسترسی</button>
  <pre id="r-access" style="display:none"></pre>
</div>

<div class="card">
  <h2>5. 🔥 تست ۲ — Backend Login API</h2>
  <div style="font-size:12px;color:#64748b;margin-bottom:8px">این از طریق پروکسی همین سرور به <code>/api/auth/login</code> پورت 4000 وصل می‌شود. اگر HTTP 200 برگشت، بک‌اند کامل سالم است.</div>
  <button onclick="testLogin()">🔍 تست Login</button>
  <pre id="r-login" style="display:none"></pre>
</div>

<div class="card" id="c-result" style="display:none">
  <h2>نتیجه‌گیری</h2>
  <div id="result" class="big"></div>
  <div id="result-detail" style="font-size:12.5px;color:#64748b;margin-top:6px"></div>
</div>

<div class="card">
  <h2>6. راه‌حل بر اساس نتیجه</h2>
  <div style="font-size:12px;line-height:2">
    <div>🟢 اگر <b>هر دو تست سبز</b> بودند → مشکل Cache/SW در پورت 4000</div>
    <div>🔴 اگر <b>تست ۱ قرمز</b> → مرورگر به پورت 4000 دسترسی ندارد</div>
    <div>🟠 اگر <b>تست ۲ قرمز</b> → Backend مشکل دارد (باید ببینیم چرا curl کار می‌کند)</div>
  </div>
  <div style="margin-top:12px">
    <button class="orange" onclick="openReset()">🧹 باز کردن zz_reset.html (پورت 4000)</button>
    <button class="green" onclick="testLoginAndReset()">🔐 تست + پاکسازی + ورود</button>
  </div>
</div>

<div class="card">
  <h2>7. اسکرین‌شات / کپی</h2>
  <div style="font-size:12px;color:#64748b;margin-bottom:8px">اگر چیزی درست نشد، این متن را کامل کپی کن و برایم بفرست.</div>
  <button onclick="dumpAll()">📋 جمع‌آوری همه اطلاعات</button>
  <pre id="r-dump" style="display:none"></pre>
</div>

<script>
var HOST = location.hostname;
document.getElementById('v-url').textContent = location.href;
document.getElementById('v-host').textContent = HOST;
document.getElementById('v-ua').textContent = navigator.userAgent;

var sw = 'serviceWorker' in navigator;
document.getElementById('v-swsup').textContent = sw ? '✓ بله' : '✗ خیر';
if (sw) {
  navigator.serviceWorker.getRegistrations().then(function(rs) {
    var el = document.getElementById('v-swcount');
    el.textContent = rs.length;
    el.className = 'val ' + (rs.length > 0 ? 'warn' : 'ok');
  }).catch(function() { document.getElementById('v-swcount').textContent = 'خطا'; });
} else {
  document.getElementById('v-swcount').textContent = 'N/A';
}

document.getElementById('v-lscount').textContent = localStorage.length;
document.getElementById('v-lstk').textContent = (localStorage.getItem('nabz_tk') || '—').slice(0, 40);

async function testAccess() {
  var pre = document.getElementById('r-access');
  pre.style.display = 'block';
  pre.textContent = '⏳ در حال تست http://' + HOST + ':4000/api/auth/me ...';
  var url = 'http://' + HOST + ':4000/api/auth/me';
  try {
    var ctrl = new AbortController();
    setTimeout(function() { ctrl.abort(); }, 5000);
    var r = await fetch(url, { signal: ctrl.signal });
    pre.textContent = '✓ HTTP ' + r.status + '\\n' + url + '\\n\\nسرور پاسخ داد (حتی اگر 401 باشد، دسترسی OK است).';
    pre.style.color = '#16a34a';
    window._accessOK = true;
  } catch (e) {
    pre.textContent = '✗ خطا: ' + e.message + '\\n\\nURL: ' + url + '\\n\\nیعنی مرورگر نمی‌تواند به پورت 4000 وصل شود.\\nدلایل احتمالی:\\n- firewall\\n- VPN\\n- IP اشتباه در URL\\n- سرور روی 127.0.0.1 بایند شده (نه 0.0.0.0)';
    pre.style.color = '#dc2626';
    window._accessOK = false;
  }
  showResult();
}

async function testLogin() {
  var pre = document.getElementById('r-login');
  pre.style.display = 'block';
  pre.textContent = '⏳ در حال تست از طریق پروکسی ...';
  try {
    var r = await fetch('/proxy-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'nabz@2026' })
    });
    var t = await r.text();
    pre.textContent = 'HTTP ' + r.status + '\\n\\n' + t.slice(0, 500);
    pre.style.color = r.status === 200 ? '#16a34a' : '#dc2626';
    window._loginOK = r.status === 200;
  } catch (e) {
    pre.textContent = '✗ خطای پروکسی: ' + e.message;
    pre.style.color = '#dc2626';
    window._loginOK = false;
  }
  showResult();
}

function showResult() {
  if (window._accessOK === undefined || window._loginOK === undefined) return;
  var c = document.getElementById('c-result');
  var r = document.getElementById('result');
  var d = document.getElementById('result-detail');
  c.style.display = 'block';
  if (window._accessOK && window._loginOK) {
    c.className = 'card ok';
    r.innerHTML = '🟢 هر دو تست سبز';
    r.className = 'big ok';
    d.innerHTML = 'یعنی: مرورگر به 4000 وصل می‌شود، Backend 200 برمی‌گرداند.<br>پس ۱۰۰٪ مشکل در <b>Service Worker / Cache</b> پورت 4000 است.<br><br>کلیک کن: 🧹 باز کردن zz_reset.html';
  } else if (!window._accessOK) {
    c.className = 'card bad';
    r.innerHTML = '🔴 مرورگر به پورت 4000 نمی‌رسد';
    r.className = 'big bad';
    d.innerHTML = 'مشکل شبکه/فایروال، نه Cache.<br><br>چک کن:<br>• اگر در Termux هستی: <code>curl http://localhost:4000/api/auth/me</code><br>• اگر از دستگاه دیگر: ping IP و تست پورت<br>• اگر VPN روشن است، خاموش کن';
  } else {
    c.className = 'card warn';
    r.innerHTML = '🟠 Backend پاسخ نداد';
    r.className = 'big warn';
    d.innerHTML = 'مرورگر به 4000 وصل می‌شود ولی login API خطا می‌دهد.<br><br>در ترمینال چک کن:<br><code>tail -30 ~/nabz-server.log</code>';
  }
}

function openReset() {
  window.open('http://' + HOST + ':4000/zz_reset.html?_=' + Date.now(), '_blank');
}

async function testLoginAndReset() {
  await testAccess();
  await testLogin();
  if (window._accessOK && window._loginOK) {
    setTimeout(function() { location.href = 'http://' + HOST + ':4000/zz_reset.html?_=' + Date.now(); }, 1500);
  }
}

function dumpAll() {
  var pre = document.getElementById('r-dump');
  pre.style.display = 'block';
  pre.textContent =
    '=== NABZ DIAGNOSTIC DUMP ===\\n' +
    'time: ' + new Date().toISOString() + '\\n' +
    'url: ' + location.href + '\\n' +
    'hostname: ' + HOST + '\\n' +
    'ua: ' + navigator.userAgent + '\\n' +
    'sw-supported: ' + ('serviceWorker' in navigator) + '\\n' +
    'localStorage-keys: ' + localStorage.length + '\\n' +
    'nabz_tk: ' + (localStorage.getItem('nabz_tk') || 'null') + '\\n' +
    'nabz_u: ' + (localStorage.getItem('nabz_u') || 'null') + '\\n' +
    '--- test access ---\\n' + document.getElementById('r-access').textContent + '\\n' +
    '--- test login ---\\n' + document.getElementById('r-login').textContent + '\\n' +
    '=== END ===\\n';
  pre.scrollIntoView();
}
</script>
</body></html>`;

const server = http.createServer(function(req, res) {
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate' });
    res.end(HTML);
    return;
  }
  if (req.method === 'POST' && req.url === '/proxy-login') {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', async function() {
      try {
        var r = await fetch('http://127.0.0.1:' + MAIN_PORT + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body
        });
        var text = await r.text();
        res.writeHead(r.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(text);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'proxy_failed', message: e.message }));
      }
    });
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, '0.0.0.0', function() {
  console.log('🔍 NABZ Diagnostic');
  console.log('   Local:   http://localhost:' + PORT + '/');
  var nets = require('os').networkInterfaces();
  for (var name in nets) {
    for (var i = 0; i < nets[name].length; i++) {
      var net = nets[name][i];
      if (net.family === 'IPv4' && !net.internal) {
        console.log('   Network: http://' + net.address + ':' + PORT + '/');
      }
    }
  }
  console.log('');
  console.log('   این آدرس را در مرورگر باز کن و اسکرین‌شات/متن را بفرست.');
});
