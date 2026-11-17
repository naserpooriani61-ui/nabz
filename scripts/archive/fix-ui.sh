# ═══════════════════════════════════════════════════════════════
#  Fix UI — Rebuild CSS + index.html + restart server
# ═══════════════════════════════════════════════════════════════

# ۱) کشتن همه node ها
for pid in $(pgrep -f "core/server.js" 2>/dev/null); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

# ۲) بازنویسی style.css (نسخه فشرده موبایل‌محور)
cat > public/style.css << 'CSS'
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0f1e;--bg-2:#131a2e;--bg-3:#1e2842;--bg-elev:#141b30;
  --fg:#e8ecf5;--fg-2:#8b95ab;--fg-3:#566178;
  --border:#232f4d;--border-2:#334466;
  --primary:#06b6d4;--ok:#10b981;--warn:#f59e0b;--dng:#ef4444;
  --grad-primary:linear-gradient(135deg,#06b6d4,#0891b2);
  --grad-elev:linear-gradient(135deg,#1a2338,#0f1525);
  --header-h:56px;--nav-h:68px;
  --safe-t:env(safe-area-inset-top,0px);
  --safe-b:env(safe-area-inset-bottom,0px);
  --safe-l:env(safe-area-inset-left,0px);
  --safe-r:env(safe-area-inset-right,0px);
  --r-sm:8px;--r:12px;--r-lg:16px;--r-xl:20px;--r-full:999px;
  --sh:0 4px 12px rgba(0,0,0,.4);
  --sh-lg:0 12px 32px rgba(0,0,0,.5);
  --glow:0 0 24px rgba(6,182,212,.25);
  --font:'Vazirmatn',-apple-system,system-ui,Tahoma,sans-serif;
}
@media(prefers-color-scheme:light){
  :root{--bg:#f5f7fb;--bg-2:#fff;--bg-3:#eef1f7;--bg-elev:#fff;
    --fg:#0a0f1e;--fg-2:#4a5468;--border:#dde2ee;--border-2:#c5cce0;
    --grad-elev:linear-gradient(135deg,#fff,#f5f7fb)}
}
html,body{height:100%;overflow:hidden}
body{font-family:var(--font);background:var(--bg);color:var(--fg);
  font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;
  -webkit-tap-highlight-color:transparent;overscroll-behavior:none}
#app{height:100vh;height:100dvh;display:flex;flex-direction:column;
  padding-top:var(--safe-t);padding-left:var(--safe-l);padding-right:var(--safe-r)}
#header{height:var(--header-h);flex-shrink:0;background:var(--bg-elev);
  border-bottom:1px solid var(--border);display:flex;align-items:center;
  gap:6px;padding:0 12px;position:relative;z-index:30}
#header .logo{font-size:20px;font-weight:900;color:var(--fg);
  letter-spacing:-.5px;display:flex;align-items:center;gap:8px}
#header .logo span{color:var(--primary)}
.hbtn{width:42px;height:42px;border:none;background:transparent;color:var(--fg-2);
  font-size:20px;border-radius:50%;cursor:pointer;position:relative;
  display:grid;place-items:center;transition:all .15s}
.hbtn:active{background:var(--bg-3);transform:scale(.92)}
.badge{position:absolute;top:4px;right:4px;background:var(--dng);color:#fff;
  font-size:10px;font-weight:900;min-width:18px;height:18px;padding:0 5px;
  border-radius:var(--r-full);display:none;place-items:center;
  border:2px solid var(--bg-elev)}
#main{flex:1;overflow-y:auto;overflow-x:hidden;padding:16px 14px;
  padding-bottom:calc(var(--nav-h) + var(--safe-b) + 16px);
  -webkit-overflow-scrolling:touch}
body:not(.auth) #main{padding-bottom:16px}
#sidebar{position:fixed;bottom:0;left:0;right:0;
  height:calc(var(--nav-h) + var(--safe-b));padding-bottom:var(--safe-b);
  background:var(--bg-elev);border-top:1px solid var(--border);
  display:flex;align-items:stretch;z-index:50;
  box-shadow:0 -8px 24px rgba(0,0,0,.3)}
body:not(.auth) #sidebar{display:none}
.bn-tab{flex:1;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:3px;border:none;background:transparent;
  color:var(--fg-3);font-family:inherit;cursor:pointer;padding:6px 4px;
  position:relative;transition:color .2s}
.bn-tab:active{background:var(--bg-3)}
.bn-tab.on{color:var(--primary)}
.bn-tab.on::before{content:'';position:absolute;top:0;left:50%;
  transform:translateX(-50%);width:32px;height:3px;background:var(--primary);
  border-radius:0 0 3px 3px;box-shadow:0 2px 8px var(--glow)}
.bn-icon{font-size:22px;line-height:1}
.bn-tab.on .bn-icon{transform:scale(1.1);filter:drop-shadow(0 0 8px var(--glow))}
.bn-label{font-size:9.5px;font-weight:700}
.drawer{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:200;
  display:flex;justify-content:flex-start}
.drawer-panel{width:min(340px,88vw);height:100%;background:var(--bg-elev);
  overflow-y:auto;padding:calc(var(--safe-t) + 16px) 0 calc(var(--safe-b) + 16px);
  animation:slideRTL .28s cubic-bezier(.32,.72,0,1);
  box-shadow:12px 0 40px rgba(0,0,0,.5)}
@keyframes slideRTL{from{transform:translateX(-100%)}to{transform:translateX(0)}}
.drawer-hd{display:flex;justify-content:space-between;align-items:center;
  padding:0 16px 16px;border-bottom:1px solid var(--border);margin-bottom:8px}
.drawer-logo{font-size:18px;font-weight:900}
.drawer-logo strong{color:var(--primary)}
.drawer-close{width:36px;height:36px;border:none;background:var(--bg-3);
  color:var(--fg);border-radius:50%;font-size:16px;cursor:pointer;
  display:grid;place-items:center}
.drawer-sec{padding:8px 12px}
.drawer-sec-hd{font-size:11px;font-weight:900;color:var(--fg-3);
  text-transform:uppercase;letter-spacing:.5px;padding:8px 8px 4px}
.drawer-item{width:100%;display:flex;align-items:center;gap:12px;
  padding:12px 10px;border:none;background:transparent;color:var(--fg);
  font-family:inherit;font-size:13.5px;font-weight:600;border-radius:var(--r-sm);
  cursor:pointer;text-align:right}
.drawer-item:active{background:var(--bg-3)}
.di-ico{font-size:20px;flex-shrink:0}.di-lbl{flex:1}
.login{display:grid;place-items:center;min-height:calc(100vh - var(--header-h) - 32px);padding:16px}
.lcard{width:100%;max-width:380px;background:var(--grad-elev);
  border:1px solid var(--border);border-radius:var(--r-xl);padding:32px 24px;
  box-shadow:var(--sh-lg);position:relative;overflow:hidden}
.lcard::before{content:'';position:absolute;top:-100px;right:-100px;
  width:200px;height:200px;background:radial-gradient(circle,rgba(6,182,212,.25),transparent 70%);
  pointer-events:none}
.lcard>div:first-child{font-size:64px;line-height:1;text-align:center;
  filter:drop-shadow(0 0 24px var(--glow));animation:heartbeat 2s infinite}
@keyframes heartbeat{0%,100%{transform:scale(1)}14%{transform:scale(1.08)}28%{transform:scale(1)}42%{transform:scale(1.05)}70%{transform:scale(1)}}
.lcard h1{font-size:28px;font-weight:900;text-align:center;margin:12px 0 4px;
  background:var(--grad-primary);-webkit-background-clip:text;
  background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-1px}
.lcard form{display:flex;flex-direction:column;gap:12px;margin-top:24px}
.lcard input{padding:14px 16px;border:1.5px solid var(--border-2);
  background:var(--bg);color:var(--fg);border-radius:var(--r);
  font-family:inherit;font-size:15px;transition:all .15s}
.lcard input:focus{outline:none;border-color:var(--primary);
  box-shadow:0 0 0 4px rgba(6,182,212,.25)}
.lcard button{padding:14px;background:var(--grad-primary);color:#fff;
  border:none;border-radius:var(--r);font-family:inherit;font-size:15px;
  font-weight:900;cursor:pointer;box-shadow:0 4px 16px rgba(6,182,212,.25)}
.lcard button:active{transform:scale(.98)}
.err{color:var(--dng);font-size:12px;font-weight:700;min-height:16px;text-align:center}
.hint{font-family:monospace;font-size:11px;color:var(--fg-2);
  margin-top:16px;padding:10px;background:var(--bg-3);border-radius:var(--r-sm);
  text-align:center;border:1px dashed var(--border-2)}
.card{background:var(--bg-2);border:1px solid var(--border);
  border-radius:var(--r-lg);padding:14px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.card-title{font-size:13px;font-weight:900;margin-bottom:8px}
.sec-hd{display:flex;justify-content:space-between;align-items:center;
  font-size:14px;font-weight:900;margin:16px 0 10px}
.grid-4{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.stat{background:var(--grad-elev);border:1px solid var(--border);
  border-radius:var(--r-lg);padding:16px 10px;text-align:center;
  position:relative;overflow:hidden}
.stat::before{content:'';position:absolute;top:0;left:0;right:0;
  height:3px;background:var(--grad-primary)}
.stat .v{font-size:26px;font-weight:900;color:var(--primary);line-height:1.1}
.stat .l{font-size:10.5px;color:var(--fg-2);margin-top:6px;font-weight:700}
.stat.dng::before{background:linear-gradient(135deg,#ef4444,#dc2626)}
.stat.dng .v{color:var(--dng)}
.stat.warn::before{background:linear-gradient(135deg,#f59e0b,#d97706)}
.stat.warn .v{color:var(--warn)}
.stat.ok::before{background:linear-gradient(135deg,#10b981,#059669)}
.stat.ok .v{color:var(--ok)}
.pill{display:inline-block;padding:3px 9px;border-radius:var(--r-full);
  font-size:10px;font-weight:800;background:var(--bg-3);color:var(--fg-2)}
.pill.ok{background:rgba(16,185,129,.15);color:var(--ok)}
.pill.warn{background:rgba(245,158,11,.15);color:var(--warn)}
.pill.dng{background:rgba(239,68,68,.15);color:var(--dng)}
.row{background:var(--bg-2);border:1px solid var(--border);
  border-radius:var(--r-lg);padding:14px;margin-bottom:8px;
  border-right:3px solid var(--border-2);cursor:pointer}
.row:active{transform:scale(.985);background:var(--bg-3)}
.row.hi{border-right-color:var(--dng)}
.row.md{border-right-color:var(--warn)}
.row.lo{border-right-color:var(--ok)}
.row-hd{display:flex;justify-content:space-between;align-items:center;gap:8px}
.row-title{font-size:13.5px;font-weight:800;line-height:1.3}
.row-meta{font-size:11.5px;color:var(--fg-2);margin-top:4px;line-height:1.4}
.alert{background:var(--bg-2);border:1px solid var(--border);
  border-radius:var(--r);padding:12px 14px;margin-bottom:8px;
  border-right:3px solid var(--border-2)}
.alert.critical{border-right-color:var(--dng);
  background:linear-gradient(90deg,rgba(239,68,68,.06),var(--bg-2) 40%)}
.alert.high{border-right-color:var(--warn);
  background:linear-gradient(90deg,rgba(245,158,11,.06),var(--bg-2) 40%)}
.btn{padding:12px 18px;min-height:44px;border:1.5px solid var(--border-2);
  background:var(--bg-2);color:var(--fg);font-family:inherit;
  font-size:13px;font-weight:800;border-radius:var(--r);cursor:pointer}
.btn:active{transform:scale(.97);background:var(--bg-3)}
.btn-primary{background:var(--grad-primary);color:#fff;border:none;
  box-shadow:0 4px 16px rgba(6,182,212,.25)}
.btn-block{width:100%}
.empty{text-align:center;padding:48px 20px;color:var(--fg-3);font-size:13px;line-height:1.6}
.spinner{display:inline-block;width:28px;height:28px;
  border:2.5px solid var(--border);border-top-color:var(--primary);
  border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.bs-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0);z-index:300;
  display:flex;align-items:flex-end;transition:background .25s}
.bs-backdrop.show{background:rgba(0,0,0,.7)}
.bs-sheet{width:100%;max-height:88vh;background:var(--bg-elev);
  border-radius:var(--r-xl) var(--r-xl) 0 0;
  padding:10px 16px calc(var(--safe-b) + 20px);
  transform:translateY(100%);
  transition:transform .35s cubic-bezier(.32,.72,0,1);
  overflow-y:auto;box-shadow:0 -12px 48px rgba(0,0,0,.5)}
.bs-backdrop.show .bs-sheet{transform:translateY(0)}
.bs-handle{width:40px;height:4px;background:var(--border-2);
  border-radius:2px;margin:0 auto 16px}
.bs-hd{display:flex;justify-content:space-between;align-items:center;
  padding-bottom:14px;border-bottom:1px solid var(--border);margin-bottom:16px}
.bs-title{font-size:15px;font-weight:900}
.bs-close{width:36px;height:36px;border:none;background:var(--bg-3);
  color:var(--fg);border-radius:50%;font-size:16px;cursor:pointer;
  display:grid;place-items:center}
.bs-body{display:flex;flex-direction:column;gap:8px}
.bs-row{display:grid;grid-template-columns:110px 1fr;gap:12px;
  padding:10px 0;border-bottom:1px solid var(--border);font-size:12.5px}
.bs-row:last-child{border-bottom:none}
.bs-key{color:var(--fg-2);font-weight:700;font-size:11px;
  font-family:monospace;direction:ltr;text-align:right;overflow:hidden;
  text-overflow:ellipsis}
.bs-val{color:var(--fg);font-weight:600;word-break:break-word}
.bs-val code{font-family:monospace;font-size:10.5px;background:var(--bg);
  padding:6px 8px;border-radius:6px;display:block;white-space:pre-wrap;
  overflow-x:auto;max-height:200px;overflow-y:auto}
.bs-form{display:flex;flex-direction:column;gap:14px}
.bs-field label{display:block;font-size:12px;font-weight:800;
  color:var(--fg-2);margin-bottom:6px}
.bs-field input,.bs-field select,.bs-field textarea{width:100%;
  padding:13px 14px;border:1.5px solid var(--border-2);background:var(--bg-2);
  color:var(--fg);border-radius:var(--r);font-family:inherit;font-size:14px}
.bs-field input:focus,.bs-field select:focus,.bs-field textarea:focus{
  outline:none;border-color:var(--primary);box-shadow:0 0 0 4px rgba(6,182,212,.25)}
.bs-submit{padding:16px;background:var(--grad-primary);color:#fff;border:none;
  border-radius:var(--r);font-family:inherit;font-size:15px;font-weight:900;
  cursor:pointer;box-shadow:0 6px 20px rgba(6,182,212,.25);margin-top:8px}
.bs-submit:active{transform:scale(.98)}
.action-card{background:var(--grad-elev);border:1px solid var(--border);
  border-radius:var(--r-xl);padding:32px 20px;text-align:center}
.action-code{font-family:monospace;font-size:15px;font-weight:900;
  padding:20px 16px;background:var(--bg);border-radius:var(--r);
  word-break:break-all;letter-spacing:1px;color:var(--primary);
  border:1px solid var(--border-2);line-height:1.5}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border-2);border-radius:3px}
@media(min-width:768px){
  #app{max-width:900px;margin:0 auto;
    border-left:1px solid var(--border);border-right:1px solid var(--border)}
  .grid-4{grid-template-columns:repeat(4,1fr)}
  #main{padding:20px 24px}
}
CSS
echo "✅ style.css rebuilt ($(wc -l < public/style.css) lines)"

# ۳) بازنویسی index.html
cat > public/index.html << 'HTML'
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a0f1e">
<title>نبض — NABZ</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div id="app">
<header id="header" style="display:none">
<div class="logo">🫀 <span>نبض</span></div>
<div style="flex:1"></div>
<button class="hbtn" onclick="NABZ.showAlerts()" title="اعلان‌ها">🔔<span id="nc" class="badge"></span></button>
<button class="hbtn" onclick="NABZ.refresh()" title="بازخوانی">🔄</button>
<button class="hbtn" onclick="NABZ.logout()" title="خروج">⏻</button>
</header>
<nav id="sidebar"></nav>
<main id="main">
<div id="loginView" class="login">
<div class="lcard">
<div>🫀</div>
<h1>نبض</h1>
<p style="color:var(--fg-2);font-size:12px;margin-bottom:20px;text-align:center">سیستم‌عامل عصبی بیمارستان</p>
<form id="lf">
<input id="u" placeholder="نام کاربری" autocomplete="username" required>
<input id="p" type="password" placeholder="رمز" autocomplete="current-password" required>
<button type="submit">ورود به سیستم</button>
<div id="le" class="err"></div>
</form>
<div class="hint">admin / nabz@2026</div>
</div>
</div>
<div id="content" style="display:none"></div>
</main>
</div>
<script src="/app.js"></script>
</body>
</html>
HTML
echo "✅ index.html rebuilt"

# ۴) اجرای مجدد
echo ""
echo "🚀 Starting server..."
export NODE_OPTIONS="--max-old-space-size=384"
termux-wake-lock 2>/dev/null || true
node core/server.js
