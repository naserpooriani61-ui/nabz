/* public/system_status_ui.js — NABZ ops dashboard */
(function () {
  'use strict';

  if (!document.getElementById('sys-style')) {
    const st = document.createElement('style'); st.id = 'sys-style';
    st.textContent = `
.sys-wrap{direction:rtl;font-family:inherit;padding:14px;max-width:1100px;margin:0 auto;background:#f5f7fa;min-height:100vh;}
.sys-header{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:8px;margin-bottom:14px;}
.sys-header h1{margin:0;font-size:20px;color:#1a1a1a;}
.sys-meta{font-size:11px;color:#666;}
.sys-overall{display:flex;align-items:center;gap:16px;padding:18px;border-radius:12px;margin-bottom:14px;color:#fff;}
.sys-overall.ok{background:linear-gradient(135deg,#16a34a,#22c55e);}
.sys-overall.warn{background:linear-gradient(135deg,#d97706,#f59e0b);}
.sys-overall.bad{background:linear-gradient(135deg,#b91c1c,#ef4444);}
.sys-big{font-size:42px;line-height:1;}
.sys-big-title{font-size:18px;font-weight:700;}
.sys-big-sub{font-size:12px;opacity:.9;margin-top:2px;}
.sys-card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.04);}
.sys-card h3{margin:0 0 10px;font-size:14px;color:#333;border-right:4px solid #1a5fb4;padding-right:8px;}
.sys-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;}
.sys-grid-sm{grid-template-columns:repeat(auto-fit,minmax(90px,1fr));}
.sys-tile{padding:10px;border-radius:8px;background:#f5f7fa;text-align:center;border:1px solid transparent;}
.sys-tile.ok{background:#f0fdf4;border-color:#bbf7d0;}
.sys-tile.bad{background:#fef2f2;border-color:#fecaca;}
.sys-tile-name{font-size:11px;color:#666;margin-bottom:4px;}
.sys-tile-val{font-size:15px;font-weight:700;color:#1a1a1a;}
.sys-alerts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.sys-alert-tile{padding:14px;border-radius:8px;text-align:center;font-size:20px;font-weight:700;color:#fff;}
.sys-alert-tile.critical{background:#dc2626;}
.sys-alert-tile.high{background:#d97706;}
.sys-alert-tile.total{background:#1a5fb4;}
.sys-alert-tile div{font-size:11px;font-weight:400;opacity:.9;margin-top:2px;}
.sys-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:6px;font-size:12px;color:#444;}
.sys-kv b{color:#1a1a1a;}
.sys-test{padding:10px;border-radius:8px;margin-bottom:8px;}
.sys-test.ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-weight:700;}
.sys-test.bad{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-weight:700;}
.sys-test-meta{font-size:11px;font-weight:400;opacity:.8;margin-top:2px;}
.sys-test-empty{color:#888;font-size:12px;font-style:italic;}
.sys-btn-run{background:#1a5fb4;color:#fff;border:none;border-radius:6px;padding:8px 16px;font-family:inherit;font-size:13px;cursor:pointer;margin-top:8px;}
.sys-btn-run:disabled{opacity:.5;cursor:wait;}
.sys-btn-refresh{background:#eef2f8;color:#333;border:none;border-radius:6px;padding:6px 12px;font-family:inherit;font-size:12px;cursor:pointer;}
.sys-loading{padding:20px;text-align:center;color:#888;}
.sys-events{font-size:12px;color:#555;margin-top:4px;}
.sys-events.stale{color:#b91c1c;font-weight:700;}
@media (max-width:600px){.sys-header h1{font-size:16px;}.sys-overall{padding:12px;}.sys-big{font-size:32px;}}
    `;
    document.head.appendChild(st);
  }

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
  function ago(iso){if(!iso)return'—';const s=Math.floor((Date.now()-new Date(iso).getTime())/1000);if(s<60)return s+'s';if(s<3600)return Math.floor(s/60)+'m';return Math.floor(s/3600)+'h';}

  async function fetchStatus(){
    const r = await fetch('/api/system/status',{credentials:'include'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }
  async function runTests(){
    const r = await fetch('/api/system/test-run',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:'{}'});
    return r.json();
  }

  function render(d){
    const allOk = d.allDomainsClean;
    let h = '';
    h += '<div class="sys-overall ' + (allOk ? 'ok' : 'warn') + '">';
    h += '<div class="sys-big">' + (allOk ? '✅' : '⚠️') + '</div>';
    h += '<div><div class="sys-big-title">' + (allOk ? 'همه دامنه‌ها یکدست' : 'دامنه ناهمسان یافت شد') + '</div>';
    h += '<div class="sys-big-sub">' + (allOk ? 'هر نوشتن از core/domain می‌گذرد' : 'بررسی بخش دامنه‌ها') + '</div></div>';
    h += '</div>';

    h += '<div class="sys-card"><h3>📊 دامنه‌های داده</h3><div class="sys-grid">';
    Object.entries(d.domains).forEach(([name, s]) => {
      h += '<div class="sys-tile ' + (s.clean ? 'ok' : 'bad') + '">';
      h += '<div class="sys-tile-name">' + esc(name) + '</div>';
      h += '<div class="sys-tile-val">' + (s.clean ? '✅' : '⚠️ ' + s.totalPuts) + '</div>';
      h += '</div>';
    });
    h += '</div></div>';

    h += '<div class="sys-card"><h3>🗄️ مجموعه‌ها</h3><div class="sys-grid sys-grid-sm">';
    Object.entries(d.collections).forEach(([k, v]) => {
      h += '<div class="sys-tile"><div class="sys-tile-name">' + esc(k) + '</div><div class="sys-tile-val">' + (v==null?'—':v) + '</div></div>';
    });
    h += '</div></div>';

    h += '<div class="sys-card"><h3>🔔 هشدارها (۲۴h)</h3><div class="sys-alerts">';
    h += '<div class="sys-alert-tile critical">' + d.alerts.critical + '<div>بحرانی</div></div>';
    h += '<div class="sys-alert-tile high">' + d.alerts.high + '<div>بالا</div></div>';
    h += '<div class="sys-alert-tile total">' + d.alerts.last24h + '<div>کل</div></div>';
    h += '</div></div>';

    h += '<div class="sys-card"><h3>🧪 تست‌های رگرسیون</h3>';
    if(d.tests.at){
      const ok = d.tests.passed === d.tests.total && d.tests.total > 0;
      h += '<div class="sys-test ' + (ok?'ok':'bad') + '">' + (ok?'✅':'❌') + ' ' + d.tests.passed + '/' + d.tests.total + ' passed';
      h += '<div class="sys-test-meta">آخرین اجرا ' + ago(d.tests.at) + ' پیش — ' + (d.tests.durationMs||'—') + 'ms</div></div>';
    } else {
      h += '<div class="sys-test-empty">هنوز تستی اجرا نشده</div>';
    }
    h += '<button class="sys-btn-run" id="sys-run-tests">▶️ اجرای تست‌ها</button>';
    h += '</div>';

    const stale = d.events.latestAt && (Date.now() - new Date(d.events.latestAt).getTime() > 3600000);
    h += '<div class="sys-card"><h3>⚙️ سرور</h3><div class="sys-kv">';
    h += '<div><b>Uptime:</b> ' + d.server.uptime.human + '</div>';
    h += '<div><b>RAM:</b> ' + d.server.memory.rss_mb + 'MB (heap ' + d.server.memory.heap_mb + 'MB)</div>';
    h += '<div><b>Node:</b> ' + d.server.nodeVersion + '</div>';
    h += '<div><b>PID:</b> ' + d.server.pid + '</div>';
    h += '</div>';
    h += '<div class="sys-events' + (stale?' stale':'') + '">آخرین رویداد: ' + (d.events.latestEvent || '—') + ' — ' + ago(d.events.latestAt) + ' پیش</div>';
    h += '</div>';
    return h;
  }

  async function load(el, btn){
    if(btn) btn.disabled = true;
    try{
      const d = await fetchStatus();
      el.innerHTML = render(d);
      const runBtn = el.querySelector('#sys-run-tests');
      if(runBtn){
        runBtn.onclick = async () => {
          runBtn.disabled = true; runBtn.textContent = '⏳ در حال اجرا...';
          try{
            const r = await runTests();
            if(r && r.ok){ alert('✅ ' + r.passed + '/' + r.total + ' تست پاس شد (' + r.durationMs + 'ms)'); }
            else if(r && r.error){ alert('⚠️ ' + r.error); }
            else { alert('❌ ' + (r.failed||0) + ' تست شکست خورد'); }
            await load(el);
          }catch(e){ alert('خطا: ' + e.message); }
          finally { runBtn.disabled = false; runBtn.textContent = '▶️ اجرای تست‌ها'; }
        };
      }
    }catch(e){
      el.innerHTML = '<div class="sys-card" style="background:#fef2f2;">خطا: ' + esc(e.message) + '</div>';
    }
    if(btn) btn.disabled = false;
  }

  function show(panel, data){
    const el = document.createElement('div');
    el.className = 'sys-wrap';
    const hdr = document.createElement('div');
    hdr.className = 'sys-header';
    hdr.innerHTML = '<div><h1>🩺 وضعیت سیستم NABZ</h1><div class="sys-meta">به‌روزرسانی خودکار هر ۳۰ ثانیه</div></div>';
    const btn = document.createElement('button');
    btn.className = 'sys-btn-refresh';
    btn.textContent = '🔄 به‌روزرسانی';
    btn.onclick = () => load(el, btn);
    hdr.appendChild(btn);
    el.appendChild(hdr);
    const body = document.createElement('div');
    body.className = 'sys-loading';
    body.textContent = 'در حال بارگذاری...';
    el.appendChild(body);
    load(body, btn);
    // auto refresh while mounted
    const iv = setInterval(() => {
      if(!document.body.contains(el)){ clearInterval(iv); return; }
      load(body);
    }, 30000);
    return el;
  }

  function tryReg(){
    if(typeof NABZ !== 'undefined' && typeof NABZ.registerKind === 'function'){
      NABZ.registerKind('system_status', show);
      console.log('[system_status_ui] registered');
      return true;
    }
    return false;
  }
  if(!tryReg()){ let t=0; const iv=setInterval(()=>{ if(tryReg()||++t>30)clearInterval(iv); },100); }
})();
