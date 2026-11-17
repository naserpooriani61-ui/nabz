
# ═══════════════════════════════════════════════════════════════
#  Part 10 — Professional Polish + Real Seed Data
# ═══════════════════════════════════════════════════════════════

# ─── ۱) CSS کامل جدید — Professional ───
cat > public/style.css << 'CSS'
/* ═══════════════════════════════════════════════════════════
   NABZ Design System v3 — Professional Clinical
   ═══════════════════════════════════════════════════════════ */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  /* ─── Spacing scale (4px base) ─── */
  --s1:4px;--s2:8px;--s3:12px;--s4:16px;--s5:20px;--s6:24px;--s7:32px;--s8:40px;
  
  /* ─── Type scale ─── */
  --t-xs:10px;--t-sm:11px;--t-base:13px;--t-md:14px;--t-lg:16px;
  --t-xl:20px;--t-2xl:26px;--t-3xl:34px;
  
  /* ─── Dark palette ─── */
  --bg:#060b18;--bg-2:#0d1526;--bg-3:#1a2438;--bg-4:#243147;
  --bg-elev:#0f1a2e;--bg-glass:rgba(15,26,46,0.7);
  --fg:#eef2f9;--fg-2:#8a96ae;--fg-3:#556178;--fg-4:#384357;
  --border:#1c2942;--border-2:#2d3d5c;--border-3:#445878;
  
  /* ─── Brand ─── */
  --primary:#06b6d4;--primary-2:#0891b2;--primary-3:#067b8f;
  --primary-soft:rgba(6,182,212,0.12);
  --primary-glow:rgba(6,182,212,0.35);
  
  /* ─── Semantic ─── */
  --ok:#10b981;--ok-soft:rgba(16,185,129,0.12);
  --warn:#f59e0b;--warn-soft:rgba(245,158,11,0.12);
  --dng:#ef4444;--dng-soft:rgba(239,68,68,0.12);
  --violet:#8b5cf6;--violet-soft:rgba(139,92,246,0.12);
  --info:#3b82f6;--info-soft:rgba(59,130,246,0.12);
  
  /* ─── Gradients ─── */
  --g-primary:linear-gradient(135deg,#06b6d4 0%,#0891b2 100%);
  --g-ok:linear-gradient(135deg,#10b981 0%,#059669 100%);
  --g-warn:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);
  --g-dng:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);
  --g-violet:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%);
  --g-elev:linear-gradient(135deg,rgba(26,36,56,0.9) 0%,rgba(15,26,46,0.9) 100%);
  --g-hero:linear-gradient(135deg,rgba(6,182,212,0.15) 0%,rgba(139,92,246,0.1) 50%,rgba(15,26,46,0) 100%);
  
  /* ─── Shadow — multi layer ─── */
  --sh-xs:0 1px 2px rgba(0,0,0,0.2);
  --sh-sm:0 1px 2px rgba(0,0,0,0.2),0 2px 6px rgba(0,0,0,0.15);
  --sh-md:0 2px 4px rgba(0,0,0,0.2),0 8px 20px rgba(0,0,0,0.18);
  --sh-lg:0 4px 8px rgba(0,0,0,0.2),0 16px 40px rgba(0,0,0,0.25);
  --sh-xl:0 8px 16px rgba(0,0,0,0.25),0 24px 64px rgba(0,0,0,0.3);
  --sh-glow:0 0 0 1px rgba(6,182,212,0.2),0 4px 16px rgba(6,182,212,0.25);
  --sh-glow-hover:0 0 0 1px rgba(6,182,212,0.4),0 8px 24px rgba(6,182,212,0.35);
  
  /* ─── Radius ─── */
  --r-xs:6px;--r-sm:10px;--r:14px;--r-lg:18px;--r-xl:22px;--r-2xl:28px;--r-full:9999px;
  
  /* ─── Layout ─── */
  --hdr-h:60px;--nav-h:72px;
  --safe-t:env(safe-area-inset-top,0px);
  --safe-b:env(safe-area-inset-bottom,0px);
  --safe-l:env(safe-area-inset-left,0px);
  --safe-r:env(safe-area-inset-right,0px);
  
  /* ─── Typography ─── */
  --font:'Vazirmatn','Vazir',-apple-system,'Segoe UI',Tahoma,sans-serif;
  --mono:'JetBrains Mono','Menlo','Consolas',monospace;
  
  /* ─── Transitions ─── */
  --ease:cubic-bezier(0.32,0.72,0,1);
  --ease-out:cubic-bezier(0.16,1,0.3,1);
  --dur-fast:150ms;--dur:250ms;--dur-slow:400ms;
}

/* ─── Light mode ─── */
@media (prefers-color-scheme:light){
  :root{
    --bg:#f4f6fb;--bg-2:#ffffff;--bg-3:#eef2f8;--bg-4:#e3eaf3;
    --bg-elev:#ffffff;--bg-glass:rgba(255,255,255,0.85);
    --fg:#0a1220;--fg-2:#4e5a70;--fg-3:#8592a6;--fg-4:#b8c2d1;
    --border:#dde5ee;--border-2:#c8d2de;--border-3:#a8b4c5;
    --g-elev:linear-gradient(135deg,#ffffff 0%,#f8fafc 100%);
    --g-hero:linear-gradient(135deg,rgba(6,182,212,0.08) 0%,rgba(139,92,246,0.05) 50%,transparent 100%);
    --primary-soft:rgba(6,182,212,0.08);
    --sh-sm:0 1px 2px rgba(15,23,42,0.06),0 2px 6px rgba(15,23,42,0.04);
    --sh-md:0 2px 4px rgba(15,23,42,0.06),0 8px 20px rgba(15,23,42,0.06);
    --sh-lg:0 4px 8px rgba(15,23,42,0.08),0 16px 40px rgba(15,23,42,0.08);
  }
}

/* ═══════════════════════════════════════════════════════════
   Base
   ═══════════════════════════════════════════════════════════ */
html,body{height:100%;overflow:hidden;-webkit-text-size-adjust:100%}
body{
  font-family:var(--font);
  background:var(--bg);
  color:var(--fg);
  font-size:var(--t-md);
  line-height:1.55;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  -webkit-tap-highlight-color:transparent;
  overscroll-behavior:none;
  font-feature-settings:'ss01','ss02','cv11';
  letter-spacing:-0.01em;
}
body.auth{background:var(--bg)}

/* ═══════════════════════════════════════════════════════════
   App Shell
   ═══════════════════════════════════════════════════════════ */
#app{
  height:100vh;height:100dvh;
  display:flex;flex-direction:column;
  padding-top:var(--safe-t);
  padding-left:var(--safe-l);
  padding-right:var(--safe-r);
}

/* ═══════════════════════════════════════════════════════════
   Header — sticky glass
   ═══════════════════════════════════════════════════════════ */
#header{
  height:var(--hdr-h);
  flex-shrink:0;
  background:var(--bg-glass);
  backdrop-filter:blur(24px) saturate(1.8);
  -webkit-backdrop-filter:blur(24px) saturate(1.8);
  border-bottom:1px solid var(--border);
  display:flex;align-items:center;gap:var(--s2);
  padding:0 var(--s4);
  position:relative;z-index:30;
}
#header .logo{
  font-size:var(--t-lg);font-weight:900;
  color:var(--fg);
  letter-spacing:-0.5px;
  display:flex;align-items:center;gap:var(--s2);
  filter:drop-shadow(0 0 8px var(--primary-glow));
}
#header .logo span{color:var(--primary)}

.hbtn{
  width:42px;height:42px;
  border:none;background:transparent;
  color:var(--fg-2);font-size:var(--t-xl);
  border-radius:var(--r-full);
  cursor:pointer;position:relative;
  display:grid;place-items:center;
  transition:all var(--dur-fast) var(--ease);
  -webkit-tap-highlight-color:transparent;
}
.hbtn:active{
  background:var(--bg-3);
  transform:scale(0.9);
  color:var(--primary);
}
.badge{
  position:absolute;top:4px;right:4px;
  background:var(--g-dng);color:#fff;
  font-size:9px;font-weight:900;
  min-width:18px;height:18px;
  padding:0 5px;border-radius:var(--r-full);
  display:none;place-items:center;
  border:2px solid var(--bg-elev);
  animation:pulse-badge 2s infinite;
  box-shadow:0 2px 8px rgba(239,68,68,0.4);
}
@keyframes pulse-badge{
  0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)}
  50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}
}

/* ═══════════════════════════════════════════════════════════
   Main
   ═══════════════════════════════════════════════════════════ */
#main{
  flex:1;overflow-y:auto;overflow-x:hidden;
  padding:var(--s4) var(--s3);
  padding-bottom:calc(var(--nav-h) + var(--safe-b) + var(--s6));
  -webkit-overflow-scrolling:touch;
  scroll-behavior:smooth;
}
body:not(.auth) #main{padding-bottom:var(--s4)}

/* ═══════════════════════════════════════════════════════════
   Bottom Navigation
   ═══════════════════════════════════════════════════════════ */
#sidebar{
  position:fixed;bottom:0;left:0;right:0;
  height:calc(var(--nav-h) + var(--safe-b));
  padding-bottom:var(--safe-b);
  background:var(--bg-glass);
  backdrop-filter:blur(24px) saturate(1.8);
  -webkit-backdrop-filter:blur(24px) saturate(1.8);
  border-top:1px solid var(--border);
  display:flex;align-items:stretch;
  z-index:50;
  box-shadow:0 -8px 32px rgba(0,0,0,0.25);
}
body:not(.auth) #sidebar{display:none}

.bn-tab{
  flex:1;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:4px;
  border:none;background:transparent;
  color:var(--fg-3);
  font-family:inherit;cursor:pointer;
  padding:var(--s2) var(--s1);
  position:relative;
  transition:color var(--dur-fast) var(--ease);
  -webkit-tap-highlight-color:transparent;
}
.bn-tab:active{background:var(--bg-3)}
.bn-tab.on{color:var(--primary)}
.bn-tab.on::before{
  content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);
  width:36px;height:3px;
  background:var(--g-primary);
  border-radius:0 0 var(--r-xs) var(--r-xs);
  box-shadow:0 2px 10px var(--primary-glow);
}
.bn-icon{
  font-size:22px;line-height:1;
  transition:transform var(--dur) var(--ease-out);
}
.bn-tab.on .bn-icon{
  transform:scale(1.15) translateY(-1px);
  filter:drop-shadow(0 0 10px var(--primary-glow));
}
.bn-label{
  font-size:var(--t-xs);font-weight:800;
  letter-spacing:0.02em;
}

/* ═══════════════════════════════════════════════════════════
   Drawer
   ═══════════════════════════════════════════════════════════ */
.drawer{
  position:fixed;inset:0;
  background:rgba(0,0,0,0);
  z-index:200;
  display:flex;justify-content:flex-start;
  animation:fade-in var(--dur) var(--ease) forwards;
}
@keyframes fade-in{
  from{background:rgba(0,0,0,0)}
  to{background:rgba(0,0,0,0.7)}
}
.drawer-panel{
  width:min(360px,90vw);
  height:100%;
  background:var(--bg-elev);
  overflow-y:auto;
  padding:calc(var(--safe-t) + var(--s4)) 0 calc(var(--safe-b) + var(--s4));
  animation:slide-rtl var(--dur-slow) var(--ease-out);
  box-shadow:16px 0 48px rgba(0,0,0,0.5);
}
@keyframes slide-rtl{
  from{transform:translateX(-100%);opacity:0.5}
  to{transform:translateX(0);opacity:1}
}
.drawer-hd{
  display:flex;justify-content:space-between;align-items:center;
  padding:0 var(--s4) var(--s4);
  border-bottom:1px solid var(--border);
  margin-bottom:var(--s2);
}
.drawer-logo{
  font-size:var(--t-xl);font-weight:900;
  letter-spacing:-0.5px;
  filter:drop-shadow(0 0 8px var(--primary-glow));
}
.drawer-logo strong{color:var(--primary)}
.drawer-close{
  width:38px;height:38px;
  border:none;background:var(--bg-3);color:var(--fg);
  border-radius:var(--r-full);font-size:var(--t-lg);
  cursor:pointer;display:grid;place-items:center;
  transition:all var(--dur-fast) var(--ease);
}
.drawer-close:active{background:var(--bg-4);transform:scale(0.9)}
.drawer-sec{padding:var(--s2) var(--s3)}
.drawer-sec-hd{
  font-size:var(--t-xs);font-weight:900;
  color:var(--fg-3);text-transform:uppercase;
  letter-spacing:0.08em;
  padding:var(--s2) var(--s2) var(--s1);
}
.drawer-item{
  width:100%;
  display:flex;align-items:center;gap:var(--s3);
  padding:var(--s3) var(--s3);
  border:none;background:transparent;
  color:var(--fg);
  font-family:inherit;font-size:var(--t-base);font-weight:700;
  border-radius:var(--r-sm);
  cursor:pointer;text-align:right;
  transition:all var(--dur-fast) var(--ease);
  -webkit-tap-highlight-color:transparent;
  margin-bottom:2px;
}
.drawer-item:active{
  background:var(--primary-soft);
  transform:scale(0.98);
  color:var(--primary);
}
.di-ico{
  font-size:20px;flex-shrink:0;
  width:28px;height:28px;
  display:grid;place-items:center;
  background:var(--bg-3);
  border-radius:var(--r-xs);
  transition:background var(--dur-fast);
}
.drawer-item:active .di-ico{background:var(--primary-soft)}
.di-lbl{flex:1;line-height:1.3}

/* ═══════════════════════════════════════════════════════════
   Login
   ═══════════════════════════════════════════════════════════ */
.login{
  display:grid;place-items:center;
  min-height:calc(100vh - var(--hdr-h) - var(--s7));
  padding:var(--s4);
}
.lcard{
  width:100%;max-width:400px;
  background:var(--g-elev);
  border:1px solid var(--border-2);
  border-radius:var(--r-2xl);
  padding:var(--s7) var(--s5);
  box-shadow:var(--sh-xl);
  position:relative;overflow:hidden;
}
.lcard::before{
  content:'';position:absolute;top:-120px;right:-120px;
  width:280px;height:280px;
  background:radial-gradient(circle,var(--primary-glow),transparent 65%);
  pointer-events:none;
  animation:float 8s ease-in-out infinite;
}
.lcard::after{
  content:'';position:absolute;bottom:-80px;left:-80px;
  width:200px;height:200px;
  background:radial-gradient(circle,rgba(139,92,246,0.2),transparent 65%);
  pointer-events:none;
}
@keyframes float{
  0%,100%{transform:translate(0,0) scale(1)}
  50%{transform:translate(-20px,20px) scale(1.1)}
}
.lcard>*{position:relative;z-index:1}
.lcard>div:first-child{
  font-size:72px;line-height:1;text-align:center;
  filter:drop-shadow(0 0 32px var(--primary-glow));
  animation:heartbeat 1.8s ease-in-out infinite;
}
@keyframes heartbeat{
  0%,100%{transform:scale(1)}
  10%{transform:scale(1.1)}
  20%{transform:scale(1)}
  30%{transform:scale(1.06)}
  50%{transform:scale(1)}
}
.lcard h1{
  font-size:var(--t-3xl);font-weight:900;
  text-align:center;
  margin:var(--s3) 0 var(--s1);
  background:var(--g-primary);
  -webkit-background-clip:text;background-clip:text;
  -webkit-text-fill-color:transparent;
  letter-spacing:-1.5px;
  filter:drop-shadow(0 4px 16px var(--primary-glow));
}
.lcard p{text-align:center}
.lcard form{display:flex;flex-direction:column;gap:var(--s3);margin-top:var(--s6)}
.lcard input{
  padding:var(--s4) var(--s4);
  border:1.5px solid var(--border-2);
  background:var(--bg);
  color:var(--fg);
  border-radius:var(--r);
  font-family:inherit;font-size:var(--t-md);
  transition:all var(--dur-fast) var(--ease);
  outline:none;
}
.lcard input:focus{
  border-color:var(--primary);
  box-shadow:var(--sh-glow);
  background:var(--bg-2);
}
.lcard button{
  padding:var(--s4);
  background:var(--g-primary);
  color:#fff;border:none;
  border-radius:var(--r);
  font-family:inherit;font-size:var(--t-lg);font-weight:900;
  cursor:pointer;
  box-shadow:0 4px 20px var(--primary-glow);
  transition:all var(--dur-fast) var(--ease);
  letter-spacing:0.02em;
}
.lcard button:active{transform:scale(0.97);box-shadow:0 2px 10px var(--primary-glow)}
.err{
  color:var(--dng);font-size:var(--t-sm);font-weight:700;
  min-height:18px;text-align:center;
  display:flex;align-items:center;justify-content:center;gap:6px;
}
.hint{
  font-family:var(--mono);font-size:var(--t-sm);
  color:var(--fg-2);
  margin-top:var(--s4);padding:var(--s3);
  background:var(--bg-3);
  border-radius:var(--r-sm);
  text-align:center;
  border:1px dashed var(--border-3);
  letter-spacing:0.02em;
}

/* ═══════════════════════════════════════════════════════════
   Cards — premium
   ═══════════════════════════════════════════════════════════ */
.card{
  background:var(--g-elev);
  border:1px solid var(--border);
  border-radius:var(--r-lg);
  padding:var(--s4);
  margin-bottom:var(--s3);
  box-shadow:var(--sh-sm);
  transition:all var(--dur-fast) var(--ease);
  position:relative;
  overflow:hidden;
}
.card::before{
  content:'';position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent);
  pointer-events:none;
}
.card:hover{box-shadow:var(--sh-md)}
.card-title{
  font-size:var(--t-base);font-weight:900;
  margin-bottom:var(--s2);
  display:flex;align-items:center;gap:var(--s2);
  color:var(--fg);
}
.card-sub{font-size:var(--t-sm);color:var(--fg-2);line-height:1.5}

/* ═══════════════════════════════════════════════════════════
   Section header
   ═══════════════════════════════════════════════════════════ */
.sec-hd{
  display:flex;justify-content:space-between;align-items:center;
  font-size:var(--t-lg);font-weight:900;
  margin:var(--s5) 0 var(--s3);
  color:var(--fg);
  letter-spacing:-0.01em;
}
.sec-hd > span:first-child{
  display:flex;align-items:center;gap:var(--s2);
}

/* ═══════════════════════════════════════════════════════════
   Stats grid — premium
   ═══════════════════════════════════════════════════════════ */
.grid-4{
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:var(--s3);
}
.stat{
  background:var(--g-elev);
  border:1px solid var(--border);
  border-radius:var(--r-lg);
  padding:var(--s4) var(--s3);
  text-align:center;
  position:relative;
  overflow:hidden;
  transition:all var(--dur-fast) var(--ease);
  box-shadow:var(--sh-xs);
}
.stat::before{
  content:'';position:absolute;top:0;left:0;right:0;height:3px;
  background:var(--g-primary);
  box-shadow:0 2px 12px var(--primary-glow);
}
.stat:active{transform:scale(0.98)}
.stat .v{
  font-size:var(--t-2xl);font-weight:900;
  color:var(--primary);
  line-height:1.05;
  letter-spacing:-0.03em;
  font-variant-numeric:tabular-nums;
}
.stat .l{
  font-size:var(--t-xs);color:var(--fg-2);
  margin-top:var(--s2);
  font-weight:800;
  letter-spacing:0.03em;
  text-transform:uppercase;
}
.stat.dng::before{background:var(--g-dng);box-shadow:0 2px 12px rgba(239,68,68,0.4)}
.stat.dng .v{color:var(--dng)}
.stat.warn::before{background:var(--g-warn);box-shadow:0 2px 12px rgba(245,158,11,0.4)}
.stat.warn .v{color:var(--warn)}
.stat.ok::before{background:var(--g-ok);box-shadow:0 2px 12px rgba(16,185,129,0.4)}
.stat.ok .v{color:var(--ok)}

/* ═══════════════════════════════════════════════════════════
   Pills — refined
   ═══════════════════════════════════════════════════════════ */
.pill{
  display:inline-flex;align-items:center;gap:4px;
  padding:3px 10px;
  border-radius:var(--r-full);
  font-size:var(--t-xs);font-weight:900;
  background:var(--bg-3);
  color:var(--fg-2);
  letter-spacing:0.04em;
  text-transform:uppercase;
}
.pill::before{
  content:'';width:6px;height:6px;border-radius:50%;background:currentColor;
  display:inline-block;
}
.pill.ok{background:var(--ok-soft);color:var(--ok)}
.pill.warn{background:var(--warn-soft);color:var(--warn)}
.pill.dng{background:var(--dng-soft);color:var(--dng)}
.pill.info{background:var(--primary-soft);color:var(--primary)}
.pill.violet{background:var(--violet-soft);color:var(--violet)}

/* ═══════════════════════════════════════════════════════════
   Rows (list items) — premium
   ═══════════════════════════════════════════════════════════ */
.row{
  background:var(--g-elev);
  border:1px solid var(--border);
  border-radius:var(--r-lg);
  padding:var(--s3) var(--s4);
  margin-bottom:var(--s2);
  border-right:3px solid var(--border-2);
  cursor:pointer;
  transition:all var(--dur-fast) var(--ease);
  -webkit-tap-highlight-color:transparent;
  position:relative;
  overflow:hidden;
}
.row::after{
  content:'';position:absolute;inset:0;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.02),transparent);
  pointer-events:none;opacity:0;
  transition:opacity var(--dur-fast);
}
.row:active{transform:scale(0.985);border-color:var(--border-3)}
.row:active::after{opacity:1}
.row.hi{border-right-color:var(--dng);box-shadow:inset 3px 0 12px rgba(239,68,68,0.06)}
.row.md{border-right-color:var(--warn);box-shadow:inset 3px 0 12px rgba(245,158,11,0.06)}
.row.lo{border-right-color:var(--ok);box-shadow:inset 3px 0 12px rgba(16,185,129,0.06)}
.row-hd{
  display:flex;justify-content:space-between;align-items:center;gap:var(--s2);
}
.row-title{
  font-size:var(--t-base);font-weight:800;
  line-height:1.35;
  letter-spacing:-0.01em;
}
.row-meta{
  font-size:var(--t-sm);color:var(--fg-2);
  margin-top:var(--s1);
  line-height:1.5;
}

/* ═══════════════════════════════════════════════════════════
   Alert — refined
   ═══════════════════════════════════════════════════════════ */
.alert{
  background:var(--g-elev);
  border:1px solid var(--border);
  border-radius:var(--r);
  padding:var(--s3) var(--s4);
  margin-bottom:var(--s2);
  border-right:3px solid var(--border-2);
  box-shadow:var(--sh-xs);
}
.alert.critical{
  border-right-color:var(--dng);
  background:linear-gradient(90deg,rgba(239,68,68,0.08) 0%,var(--bg-2) 40%);
  animation:pulse-critical 3s infinite;
}
.alert.high{
  border-right-color:var(--warn);
  background:linear-gradient(90deg,rgba(245,158,11,0.08) 0%,var(--bg-2) 40%);
}
@keyframes pulse-critical{
  0%,100%{box-shadow:var(--sh-xs)}
  50%{box-shadow:var(--sh-xs),0 0 0 4px rgba(239,68,68,0.08)}
}

/* ═══════════════════════════════════════════════════════════
   Buttons
   ═══════════════════════════════════════════════════════════ */
.btn{
  padding:var(--s3) var(--s4);
  min-height:46px;
  border:1.5px solid var(--border-2);
  background:var(--bg-2);
  color:var(--fg);
  font-family:inherit;font-size:var(--t-base);font-weight:800;
  border-radius:var(--r);
  cursor:pointer;
  transition:all var(--dur-fast) var(--ease);
  -webkit-tap-highlight-color:transparent;
  letter-spacing:0.01em;
}
.btn:active{transform:scale(0.97);background:var(--bg-3);border-color:var(--border-3)}
.btn-primary{
  background:var(--g-primary);color:#fff;border:none;
  box-shadow:0 4px 16px var(--primary-glow);
}
.btn-primary:active{transform:scale(0.97);box-shadow:0 2px 8px var(--primary-glow)}
.btn-ok{background:var(--g-ok);color:#fff;border:none;box-shadow:0 4px 16px rgba(16,185,129,0.3)}
.btn-dng{background:var(--g-dng);color:#fff;border:none;box-shadow:0 4px 16px rgba(239,68,68,0.3)}
.btn-block{width:100%}
.btn:disabled{opacity:0.5;pointer-events:none}

/* ═══════════════════════════════════════════════════════════
   Empty & Spinner
   ═══════════════════════════════════════════════════════════ */
.empty{
  text-align:center;
  padding:var(--s8) var(--s5);
  color:var(--fg-3);
  font-size:var(--t-base);
  line-height:1.6;
}
.spinner{
  display:inline-block;
  width:32px;height:32px;
  border:3px solid var(--border);
  border-top-color:var(--primary);
  border-radius:50%;
  animation:spin 0.9s linear infinite;
  box-shadow:0 0 16px var(--primary-glow);
}
@keyframes spin{to{transform:rotate(360deg)}}

/* ═══════════════════════════════════════════════════════════
   Bottom Sheet — premium
   ═══════════════════════════════════════════════════════════ */
.bs-backdrop{
  position:fixed;inset:0;
  background:rgba(0,0,0,0);
  z-index:300;
  display:flex;align-items:flex-end;
  transition:background var(--dur) var(--ease);
}
.bs-backdrop.show{
  background:rgba(0,0,0,0.75);
  backdrop-filter:blur(6px);
  -webkit-backdrop-filter:blur(6px);
}
.bs-sheet{
  width:100%;
  max-height:90vh;
  background:var(--bg-elev);
  border-radius:var(--r-2xl) var(--r-2xl) 0 0;
  padding:var(--s3) var(--s4) calc(var(--safe-b) + var(--s5));
  transform:translateY(100%);
  transition:transform var(--dur-slow) var(--ease-out);
  overflow-y:auto;
  box-shadow:0 -20px 60px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.05);
}
.bs-backdrop.show .bs-sheet{transform:translateY(0)}
.bs-handle{
  width:44px;height:5px;
  background:var(--border-3);
  border-radius:var(--r-full);
  margin:var(--s1) auto var(--s4);
}
.bs-hd{
  display:flex;justify-content:space-between;align-items:center;
  padding-bottom:var(--s4);
  border-bottom:1px solid var(--border);
  margin-bottom:var(--s4);
}
.bs-title{
  font-size:var(--t-lg);font-weight:900;
  letter-spacing:-0.01em;
}
.bs-close{
  width:38px;height:38px;
  border:none;background:var(--bg-3);color:var(--fg);
  border-radius:var(--r-full);font-size:var(--t-lg);
  cursor:pointer;display:grid;place-items:center;
  transition:all var(--dur-fast);
}
.bs-close:active{background:var(--bg-4);transform:scale(0.9)}
.bs-body{display:flex;flex-direction:column;gap:var(--s2)}
.bs-row{
  display:grid;
  grid-template-columns:120px 1fr;
  gap:var(--s3);
  padding:var(--s3) 0;
  border-bottom:1px solid var(--border);
  font-size:var(--t-base);
  align-items:start;
}
.bs-row:last-child{border-bottom:none}
.bs-key{
  color:var(--fg-2);font-weight:700;
  font-size:var(--t-sm);
  font-family:var(--mono);
  direction:ltr;text-align:right;
  overflow:hidden;text-overflow:ellipsis;
  word-break:break-all;
}
.bs-val{
  color:var(--fg);font-weight:600;
  word-break:break-word;
  line-height:1.5;
}
.bs-val code{
  font-family:var(--mono);font-size:var(--t-xs);
  background:var(--bg);padding:var(--s2) var(--s3);
  border-radius:var(--r-xs);
  display:block;white-space:pre-wrap;
  overflow-x:auto;max-height:200px;overflow-y:auto;
  border:1px solid var(--border);
}

/* ═══════════════════════════════════════════════════════════
   Form in sheet
   ═══════════════════════════════════════════════════════════ */
.bs-form{display:flex;flex-direction:column;gap:var(--s4)}
.bs-field label{
  display:block;
  font-size:var(--t-sm);font-weight:800;
  color:var(--fg-2);
  margin-bottom:var(--s2);
  letter-spacing:0.02em;
}
.bs-field input,
.bs-field select,
.bs-field textarea{
  width:100%;
  padding:var(--s3) var(--s4);
  border:1.5px solid var(--border-2);
  background:var(--bg-2);
  color:var(--fg);
  border-radius:var(--r);
  font-family:inherit;font-size:var(--t-md);
  transition:all var(--dur-fast) var(--ease);
  outline:none;
}
.bs-field input:focus,
.bs-field select:focus,
.bs-field textarea:focus{
  border-color:var(--primary);
  box-shadow:var(--sh-glow);
  background:var(--bg);
}
.bs-submit{
  padding:var(--s4);
  background:var(--g-primary);
  color:#fff;border:none;
  border-radius:var(--r);
  font-family:inherit;font-size:var(--t-lg);font-weight:900;
  cursor:pointer;
  box-shadow:0 6px 24px var(--primary-glow);
  margin-top:var(--s3);
  transition:all var(--dur-fast);
  letter-spacing:0.02em;
}
.bs-submit:active{transform:scale(0.98);box-shadow:0 3px 12px var(--primary-glow)}

/* ═══════════════════════════════════════════════════════════
   Action card (QR etc)
   ═══════════════════════════════════════════════════════════ */
.action-card{
  background:var(--g-elev);
  border:1px solid var(--border);
  border-radius:var(--r-2xl);
  padding:var(--s7) var(--s5);
  text-align:center;
  box-shadow:var(--sh-lg);
}
.action-code{
  font-family:var(--mono);
  font-size:var(--t-lg);font-weight:900;
  padding:var(--s5) var(--s4);
  background:var(--bg);
  border-radius:var(--r);
  word-break:break-all;
  letter-spacing:0.08em;
  color:var(--primary);
  border:1.5px solid var(--border-2);
  line-height:1.6;
  box-shadow:inset 0 2px 12px rgba(0,0,0,0.3);
}

/* ═══════════════════════════════════════════════════════════
   Progress bar
   ═══════════════════════════════════════════════════════════ */
.progress{
  height:6px;
  background:var(--border);
  border-radius:var(--r-full);
  overflow:hidden;
  margin-top:var(--s2);
}
.progress-fill{
  height:100%;
  border-radius:var(--r-full);
  background:var(--g-primary);
  transition:width var(--dur-slow) var(--ease-out);
}
.progress-fill.dng{background:var(--g-dng)}
.progress-fill.warn{background:var(--g-warn)}
.progress-fill.ok{background:var(--g-ok)}

/* ═══════════════════════════════════════════════════════════
   Scrollbar
   ═══════════════════════════════════════════════════════════ */
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border-3);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--fg-3)}

/* ═══════════════════════════════════════════════════════════
   Tablet+
   ═══════════════════════════════════════════════════════════ */
@media (min-width:768px){
  #app{max-width:900px;margin:0 auto;
    border-left:1px solid var(--border);border-right:1px solid var(--border);
    box-shadow:0 0 80px rgba(0,0,0,0.3);
  }
  .grid-4{grid-template-columns:repeat(4,1fr)}
  #main{padding:var(--s5) var(--s6)}
}
@media (min-width:1024px){
  #app{max-width:1100px}
  #sidebar{max-width:1100px;margin:0 auto;border-radius:var(--r-xl) var(--r-xl) 0 0}
}
CSS
echo "✅ style.css — premium ($(wc -l < public/style.css) lines)"

# ─── ۲) Real Seed — ۱۵ بیمار واقعی با داده کامل ───
cat > core/real-seed.js << 'EOF'
'use strict';
const store = require('./store');
const sina = require('./sina');

function now() { return new Date().toISOString(); }
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }
function hoursAgo(n) { return new Date(Date.now() - n * 3600000).toISOString(); }

const PATIENTS = [
  // { name, age, sex, ward, diagnosis, comorbidities, allergies, codeStatus, admissionType,
  //   vitals: [...], orders: [...], mar: [...], consults: [...] }
  {
    id:'pat_001', firstName:'رضا', lastName:'محمدی', age:68, sex:'male',
    ward:'ICU_GEN1', diagnosis:'STEMI — سکته قلبی حاد', comorbidities:['HTN','DM','Hyperlipidemia'],
    allergies:['Penicillin'], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:2,
    vitals:[
      { hoursAgo:0.5, hr:118, bp_sys:92, bp_dia:58, rr:24, temp:38.2, spo2:91, news2:9 },
      { hoursAgo:2, hr:112, bp_sys:96, bp_dia:62, rr:22, temp:37.9, spo2:93, news2:7 },
      { hoursAgo:6, hr:108, bp_sys:100, bp_dia:64, rr:20, temp:37.5, spo2:94, news2:5 }
    ],
    orders:[
      { type:'medication', priority:'stat', details:{drug:'Aspirin', dose:'325mg', route:'PO', frequency:'OD', durationDays:7} },
      { type:'medication', priority:'stat', details:{drug:'Clopidogrel', dose:'600mg', route:'PO', frequency:'OD', durationDays:7} },
      { type:'medication', priority:'urgent', details:{drug:'Atorvastatin', dose:'80mg', route:'PO', frequency:'HS', durationDays:30} }
    ],
    mar:[
      { drug:'Aspirin', dose:'325mg', route:'PO', hoursAgo:3, isHighAlert:false },
      { drug:'Clopidogrel', dose:'600mg', route:'PO', hoursAgo:2.5, isHighAlert:false },
      { drug:'Atorvastatin', dose:'80mg', route:'PO', hoursAgo:-3, isHighAlert:false, status:'scheduled' }
    ],
    consult:{ targetService:'قلب و عروق', question:'تأیید PCI فوری', consultType:'emergency' }
  },
  {
    id:'pat_002', firstName:'فاطمه', lastName:'حسینی', age:72, sex:'female',
    ward:'ICU_GEN2', diagnosis:'سپسیس با منشأ پنومونی', comorbidities:['COPD','CKD Stage 3'],
    allergies:[], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:4,
    vitals:[
      { hoursAgo:0.3, hr:124, bp_sys:86, bp_dia:52, rr:28, temp:39.1, spo2:88, news2:11 },
      { hoursAgo:1.5, hr:120, bp_sys:88, bp_dia:54, rr:26, temp:38.9, spo2:90, news2:10 },
      { hoursAgo:4, hr:116, bp_sys:92, bp_dia:56, rr:24, temp:38.6, spo2:91, news2:8 }
    ],
    orders:[
      { type:'medication', priority:'stat', details:{drug:'Meropenem', dose:'1g', route:'IV', frequency:'Q8H', durationDays:10} },
      { type:'medication', priority:'stat', details:{drug:'Norepinephrine', dose:'0.1 mcg/kg/min', route:'IV', frequency:'Cont', durationDays:3} },
      { type:'lab', priority:'stat', details:{panel:'CBC'} },
      { type:'lab', priority:'stat', details:{panel:'Blood Culture'} }
    ],
    mar:[
      { drug:'Meropenem', dose:'1g', route:'IV', hoursAgo:5, isHighAlert:false },
      { drug:'Norepinephrine', dose:'0.1 mcg/kg/min', route:'IV', hoursAgo:1, isHighAlert:true, witnessedBy:'staff_23' },
      { drug:'Meropenem', dose:'1g', route:'IV', hoursAgo:-3, isHighAlert:false, status:'scheduled' }
    ],
    consult:{ targetService:'عفونی', question:'تأیید رژیم آنتی‌بیوتیکی', consultType:'emergency' }
  },
  {
    id:'pat_003', firstName:'محمد', lastName:'کریمی', age:45, sex:'male',
    ward:'ER', diagnosis:'درد قفسه سینه — suspected ACS', comorbidities:['Smoking'],
    allergies:[], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:0,
    vitals:[
      { hoursAgo:0.5, hr:98, bp_sys:138, bp_dia:82, rr:18, temp:37.2, spo2:96, news2:2 },
      { hoursAgo:1.5, hr:102, bp_sys:142, bp_dia:86, rr:20, temp:37.0, spo2:95, news2:3 }
    ],
    orders:[
      { type:'lab', priority:'stat', details:{panel:'Troponin'} },
      { type:'lab', priority:'stat', details:{panel:'ECG'} }
    ],
    mar:[],
    consult:{ targetService:'قلب و عروق', question:'ارزیابی ACS', consultType:'urgent' }
  },
  {
    id:'pat_004', firstName:'علی', lastName:'رضایی', age:32, sex:'male',
    ward:'ER', diagnosis:'ترومای سر — تصادف موتور', comorbidities:[],
    allergies:[], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:0,
    vitals:[
      { hoursAgo:0.2, hr:88, bp_sys:128, bp_dia:78, rr:18, temp:36.8, spo2:97, news2:1 }
    ],
    orders:[
      { type:'lab', priority:'stat', details:{panel:'CBC'} },
      { type:'paraclinical', priority:'stat', details:{modality:'CT', bodyPart:'Brain'} }
    ],
    mar:[],
    consult:{ targetService:'جراحی اعصاب', question:'ارزیابی CT Brain', consultType:'emergency' }
  },
  {
    id:'pat_005', firstName:'زهرا', lastName:'احمدی', age:55, sex:'female',
    ward:'INT_F', diagnosis:'پنومونی اکتسابی جامعه', comorbidities:['Asthma'],
    allergies:['Sulfa'], codeStatus:'full', admissionType:'elective', admittedDaysAgo:3,
    vitals:[
      { hoursAgo:1, hr:94, bp_sys:118, bp_dia:74, rr:22, temp:38.4, spo2:93, news2:5 },
      { hoursAgo:5, hr:96, bp_sys:120, bp_dia:76, rr:20, temp:38.0, spo2:94, news2:4 }
    ],
    orders:[
      { type:'medication', priority:'urgent', details:{drug:'Ceftriaxone', dose:'1g', route:'IV', frequency:'Q24H', durationDays:7} },
      { type:'medication', priority:'urgent', details:{drug:'Azithromycin', dose:'500mg', route:'IV', frequency:'Q24H', durationDays:5} }
    ],
    mar:[
      { drug:'Ceftriaxone', dose:'1g', route:'IV', hoursAgo:8, isHighAlert:false },
      { drug:'Ceftriaxone', dose:'1g', route:'IV', hoursAgo:-16, isHighAlert:false, status:'scheduled' }
    ]
  },
  {
    id:'pat_006', firstName:'سارا', lastName:'نوری', age:28, sex:'female',
    ward:'GEN_SURG14', diagnosis:'آپاندیسیت حاد — POD 1', comorbidities:[],
    allergies:[], codeStatus:'full', admissionType:'elective', admittedDaysAgo:1,
    vitals:[
      { hoursAgo:2, hr:82, bp_sys:118, bp_dia:72, rr:16, temp:37.4, spo2:98, news2:1 }
    ],
    orders:[
      { type:'medication', priority:'routine', details:{drug:'Cefazolin', dose:'1g', route:'IV', frequency:'Q8H', durationDays:3} },
      { type:'medication', priority:'routine', details:{drug:'Acetaminophen', dose:'500mg', route:'PO', frequency:'Q6H PRN', durationDays:3} }
    ],
    mar:[
      { drug:'Cefazolin', dose:'1g', route:'IV', hoursAgo:4, isHighAlert:false },
      { drug:'Acetaminophen', dose:'500mg', route:'PO', hoursAgo:1, isHighAlert:false }
    ]
  },
  {
    id:'pat_007', firstName:'حسن', lastName:'صادقی', age:62, sex:'male',
    ward:'GEN_SURG2', diagnosis:'کوله‌سیستیت حاد — POD 2', comorbidities:['DM Type 2'],
    allergies:[], codeStatus:'full', admissionType:'elective', admittedDaysAgo:2,
    vitals:[
      { hoursAgo:1, hr:78, bp_sys:126, bp_dia:78, rr:16, temp:37.2, spo2:97, news2:0 }
    ],
    orders:[
      { type:'medication', priority:'routine', details:{drug:'Metformin', dose:'500mg', route:'PO', frequency:'BID', durationDays:30} }
    ],
    mar:[
      { drug:'Metformin', dose:'500mg', route:'PO', hoursAgo:6, isHighAlert:false }
    ]
  },
  {
    id:'pat_008', firstName:'عباس', lastName:'قاسمی', age:70, sex:'male',
    ward:'NEURO_M', diagnosis:'CVA ایسکمیک — MCA چپ', comorbidities:['AF','HTN'],
    allergies:[], codeStatus:'dnr', admissionType:'emergency', admittedDaysAgo:5,
    vitals:[
      { hoursAgo:1, hr:86, bp_sys:148, bp_dia:88, rr:18, temp:37.0, spo2:95, news2:3 }
    ],
    orders:[
      { type:'medication', priority:'urgent', details:{drug:'Enoxaparin', dose:'40mg', route:'SC', frequency:'OD', durationDays:14} },
      { type:'medication', priority:'routine', details:{drug:'Atorvastatin', dose:'40mg', route:'PO', frequency:'HS', durationDays:30} }
    ],
    mar:[
      { drug:'Enoxaparin', dose:'40mg', route:'SC', hoursAgo:3, isHighAlert:true, witnessedBy:'staff_24' }
    ]
  },
  {
    id:'pat_009', firstName:'نگار', lastName:'موسوی', age:35, sex:'female',
    ward:'NEURO_F', diagnosis:'تشنج — تحت بررسی', comorbidities:['Epilepsy'],
    allergies:[], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:1,
    vitals:[
      { hoursAgo:0.5, hr:88, bp_sys:118, bp_dia:76, rr:16, temp:37.1, spo2:97, news2:1 }
    ],
    orders:[
      { type:'medication', priority:'urgent', details:{drug:'Levetiracetam', dose:'500mg', route:'IV', frequency:'Q12H', durationDays:5} }
    ],
    mar:[
      { drug:'Levetiracetam', dose:'500mg', route:'IV', hoursAgo:2, isHighAlert:false }
    ]
  },
  {
    id:'pat_010', firstName:'مریم', lastName:'جعفری', age:80, sex:'female',
    ward:'ORTHO_F', diagnosis:'شکستگی گردن فمور — post ORIF', comorbidities:['Osteoporosis','HTN'],
    allergies:[], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:2,
    vitals:[
      { hoursAgo:1, hr:84, bp_sys:132, bp_dia:80, rr:16, temp:37.3, spo2:96, news2:1 }
    ],
    orders:[
      { type:'medication', priority:'urgent', details:{drug:'Enoxaparin', dose:'40mg', route:'SC', frequency:'OD', durationDays:28} },
      { type:'medication', priority:'routine', details:{drug:'Calcium+D', dose:'500mg', route:'PO', frequency:'BID', durationDays:90} }
    ],
    mar:[
      { drug:'Enoxaparin', dose:'40mg', route:'SC', hoursAgo:5, isHighAlert:true, witnessedBy:'staff_26' }
    ]
  },
  {
    id:'pat_011', firstName:'احمد', lastName:'محمدپناه', age:65, sex:'male',
    ward:'CCU', diagnosis:'CHF exacerbation', comorbidities:['HTN','CAD'],
    allergies:[], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:3,
    vitals:[
      { hoursAgo:1, hr:98, bp_sys:108, bp_dia:68, rr:22, temp:36.9, spo2:92, news2:5 }
    ],
    orders:[
      { type:'medication', priority:'urgent', details:{drug:'Furosemide', dose:'40mg', route:'IV', frequency:'BID', durationDays:3} },
      { type:'medication', priority:'routine', details:{drug:'Carvedilol', dose:'6.25mg', route:'PO', frequency:'BID', durationDays:30} }
    ],
    mar:[
      { drug:'Furosemide', dose:'40mg', route:'IV', hoursAgo:6, isHighAlert:false },
      { drug:'Furosemide', dose:'40mg', route:'IV', hoursAgo:-6, isHighAlert:false, status:'scheduled' }
    ]
  },
  {
    id:'pat_012', firstName:'نرگس', lastName:'سلطانی', age:50, sex:'female',
    ward:'ONCO', diagnosis:'Breast Cancer — cycle 3 FEC', comorbidities:[],
    allergies:[], codeStatus:'full', admissionType:'elective', admittedDaysAgo:1,
    vitals:[
      { hoursAgo:2, hr:76, bp_sys:112, bp_dia:72, rr:14, temp:36.8, spo2:98, news2:0 }
    ],
    orders:[
      { type:'medication', priority:'stat', details:{drug:'Ondansetron', dose:'8mg', route:'IV', frequency:'Q8H PRN', durationDays:3} },
      { type:'medication', priority:'routine', details:{drug:'Dexamethasone', dose:'8mg', route:'IV', frequency:'BID', durationDays:3} }
    ],
    mar:[
      { drug:'Ondansetron', dose:'8mg', route:'IV', hoursAgo:4, isHighAlert:false }
    ]
  },
  {
    id:'pat_013', firstName:'حسین', lastName:'طاهری', age:60, sex:'male',
    ward:'ICU_GEN1', diagnosis:'Post CABG day 1', comorbidities:['DM','HTN','CAD 3VD'],
    allergies:[], codeStatus:'full', admissionType:'elective', admittedDaysAgo:1,
    vitals:[
      { hoursAgo:0.5, hr:92, bp_sys:108, bp_dia:62, rr:18, temp:37.4, spo2:95, news2:3 }
    ],
    orders:[
      { type:'medication', priority:'stat', details:{drug:'Heparin', dose:'5000U', route:'SC', frequency:'Q8H', durationDays:5} },
      { type:'medication', priority:'urgent', details:{drug:'Morphine', dose:'2mg', route:'IV', frequency:'Q4H PRN', durationDays:2} }
    ],
    mar:[
      { drug:'Heparin', dose:'5000U', route:'SC', hoursAgo:2, isHighAlert:true, witnessedBy:'staff_23' },
      { drug:'Morphine', dose:'2mg', route:'IV', hoursAgo:1, isHighAlert:true, witnessedBy:'staff_24' }
    ]
  },
  {
    id:'pat_014', firstName:'پریسا', lastName:'کریمی', age:25, sex:'female',
    ward:'ER', diagnosis:'مسمومیت دارویی — تحت نظر', comorbidities:[],
    allergies:[], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:0,
    vitals:[
      { hoursAgo:0.5, hr:108, bp_sys:104, bp_dia:62, rr:18, temp:36.9, spo2:96, news2:3 }
    ],
    orders:[
      { type:'nursing', priority:'stat', details:{note:'پایش هر ۳۰ دقیقه، NPO'} }
    ],
    mar:[],
    consult:{ targetService:'روانپزشکی', question:'ارزیابی suicidal ideation', consultType:'urgent' }
  },
  {
    id:'pat_015', firstName:'سعید', lastName:'نوری', age:40, sex:'male',
    ward:'INT_M', diagnosis:'DKA — دیابت نوع ۱', comorbidities:['DM Type 1'],
    allergies:[], codeStatus:'full', admissionType:'emergency', admittedDaysAgo:1,
    vitals:[
      { hoursAgo:1, hr:112, bp_sys:98, bp_dia:64, rr:28, temp:37.2, spo2:97, news2:6 }
    ],
    orders:[
      { type:'medication', priority:'stat', details:{drug:'Insulin Regular', dose:'0.1 U/kg/hr', route:'IV Infusion', frequency:'Cont', durationDays:2} },
      { type:'medication', priority:'stat', details:{drug:'NS 0.9%', dose:'1L', route:'IV', frequency:'Q1H x2', durationDays:1} }
    ],
    mar:[
      { drug:'Insulin Regular', dose:'10U', route:'IV', hoursAgo:2, isHighAlert:true, witnessedBy:'staff_25' }
    ]
  }
];

function seedReal() {
  // Clear previous patients (keep staff + beds)
  const existingPatients = store.readAll('patients');
  for (const p of existingPatients) store.remove('patients', p.id);
  // Clear vitals, mar, orders, consults
  for (const coll of ['vitals','mar','orders','consults']) {
    for (const x of store.readAll(coll)) store.remove(coll, x.id);
  }
  // Reset all beds to available
  const beds = store.readAll('beds');
  for (const b of beds) { b.status = 'available'; b.patientId = null; store.put('beds', b); }

  // Assign patients to beds
  const usedBeds = new Set();
  let created = 0, vitalsCount = 0, ordersCount = 0, marCount = 0;
  const now_ts = now();

  for (let i = 0; i < PATIENTS.length; i++) {
    const p = PATIENTS[i];
    // Find a free bed in this ward
    const freeBed = beds.find(b => b.wardCode === p.ward && b.status === 'available' && !usedBeds.has(b.id));
    if (!freeBed) {
      console.warn('No bed in ' + p.ward + ' for ' + p.firstName + ' ' + p.lastName);
      continue;
    }
    usedBeds.add(freeBed.id);
    freeBed.status = 'occupied';
    freeBed.patientId = p.id;
    store.put('beds', freeBed);

    // Create patient record
    const patient = {
      id: p.id, mrn: 'MRN-' + (10000 + i),
      firstName: p.firstName, lastName: p.lastName,
      age: p.age, sex: p.sex,
      wardCode: p.ward, bedId: freeBed.id, bedNumber: freeBed.bedNumber,
      diagnosis: p.diagnosis, comorbidities: p.comorbidities, allergies: p.allergies,
      codeStatus: p.codeStatus, admissionType: p.admissionType,
      status: 'in_care', admittedAt: daysAgo(p.admittedDaysAgo),
      createdAt: now_ts
    };
    store.put('patients', patient);
    created++;

    // Vitals
    for (let vi = 0; vi < p.vitals.length; vi++) {
      const v = p.vitals[vi];
      store.put('vitals', {
        id: 'vit_' + p.id + '_' + vi,
        patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
        wardCode: p.ward, bedNumber: freeBed.bedNumber,
        recordedAt: hoursAgo(v.hoursAgo),
        recordedBy: 'usr_admin',
        hr: v.hr, bp_sys: v.bp_sys, bp_dia: v.bp_dia, rr: v.rr,
        temp: v.temp, spo2: v.spo2, onOxygen: v.spo2 < 94,
        gcs: 15, pain: 3, consciousness: 'alert',
        news2: v.news2, newsLevel: v.news2 >= 7 ? 'critical' : v.news2 >= 5 ? 'high' : v.news2 >= 1 ? 'medium' : 'low',
        notes: ''
      });
      vitalsCount++;
    }

    // Orders + MAR
    for (let oi = 0; oi < p.orders.length; oi++) {
      const o = p.orders[oi];
      const orderId = 'ord_' + p.id + '_' + oi;
      store.put('orders', {
        id: orderId, patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
        wardCode: p.ward, type: o.type, priority: o.priority,
        details: o.details, status: 'verified',
        orderedBy: 'usr_admin', orderedAt: hoursAgo(2 + oi * 0.5),
        verifiedBy: 'usr_admin', verifiedAt: hoursAgo(1.5 + oi * 0.5)
      });
      ordersCount++;
    }

    for (let mi = 0; mi < p.mar.length; mi++) {
      const m = p.mar[mi];
      const status = m.status || 'given';
      store.put('mar', {
        id: 'mar_' + p.id + '_' + mi,
        orderId: 'ord_' + p.id + '_0',
        patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
        wardCode: p.ward,
        drugName: m.drug, dose: m.dose, route: m.route,
        scheduledAt: hoursAgo(m.hoursAgo),
        administeredAt: status === 'given' ? hoursAgo(m.hoursAgo) : null,
        status: status,
        administeredBy: status === 'given' ? 'usr_admin' : null,
        witnessedBy: m.witnessedBy || null,
        isHighAlert: m.isHighAlert,
        fiveRights: status === 'given' ? { patient: true, drug: true, dose: true, route: true, time: true } : null
      });
      marCount++;
    }

    // Consult
    if (p.consult) {
      store.put('consults', {
        id: 'cons_' + p.id,
        patientId: p.id, patientName: p.firstName + ' ' + p.lastName,
        wardCode: p.ward, bedNumber: freeBed.bedNumber,
        consultType: p.consult.consultType,
        targetService: p.consult.targetService,
        question: p.consult.question,
        isbar: {}, status: 'requested',
        requestedBy: 'usr_admin', requestedAt: hoursAgo(1.5),
        responseDueAt: new Date(Date.now() + (p.consult.consultType === 'emergency' ? 30 : 120) * 60000).toISOString()
      });
    }
  }

  return { patients: created, vitals: vitalsCount, orders: ordersCount, mar: marCount };
}

module.exports = { seedReal, PATIENTS };
EOF
echo "✅ real-seed.js — 15 realistic patients"

# ─── ۳) Endpoint برای اجرای real-seed ───
node << 'ENDPOINT'
const fs = require('fs');
let s = fs.readFileSync('modules/bedboard.js', 'utf8');
if (!s.includes('seedRealPatients')) {
  const insertion = `
const seedRealPatients = (ctx) => {
  const realSeed = require('../core/real-seed');
  const result = realSeed.seedReal();
  return result;
};

module.exports = {`;
  s = s.replace('module.exports = {', insertion);
  s = s.replace('handlers: { wards, ward, assignBed, releaseBed, reseed, stats },',
    "handlers: { wards, ward, assignBed, releaseBed, reseed, seedRealPatients, stats },");
  s = s.replace("    { method:'POST', path:'/api/bedboard/reseed-sina',  handler:'reseed',     perm:'admin.users.manage' },",
    "    { method:'POST', path:'/api/bedboard/reseed-sina',  handler:'reseed',     perm:'admin.users.manage' },\n    { method:'POST', path:'/api/bedboard/seed-real',    handler:'seedRealPatients', perm:'admin.users.manage' },");
  fs.writeFileSync('modules/bedboard.js', s);
  console.log('✅ endpoint /api/bedboard/seed-real added');
}
ENDPOINT

# ─── ۴) Add seed button to frontend ───
cat >> public/extra.js << 'ENDJS'

NABZ.loadRealPatients = async function() {
  if (!confirm('⚠️ تمام بیماران و داده‌های بالینی فعلی پاک می‌شوند.\n\n۱۵ بیمار واقعی با داده کامل جایگزین می‌شوند.\n\nادامه؟')) return;
  try {
    const r = await NABZ._api('/api/bedboard/seed-real', { method:'POST', body: '{}' });
    alert('✅ دیتا بارگذاری شد\n\nبیماران: ' + r.patients + '\nویتال: ' + r.vitals + '\nدستورات: ' + r.orders + '\nMAR: ' + r.mar);
    if (NABZ.showHome) NABZ.showHome();
    else NABZ.show('bedboard.wards');
  } catch (e) { alert('❌ ' + e.message); }
};
ENDJS

echo "✅ Frontend seed button added"

# ─── ۵) Add to home dashboard — quick action ───
node << 'HOME'
const fs = require('fs');
let s = fs.readFileSync('modules/home.js', 'utf8');
if (!s.includes('loadRealPatients')) {
  s = s.replace(
    /quickLinks:\s*\[\s*\{ icon:'🛏️', label:'نقشه تخت'/,
    "quickLinks: [\n      { icon:'✨', label:'دیتای سینا', action:\"NABZ.loadRealPatients()\" },\n      { icon:'🛏️', label:'نقشه تخت'"
  );
  fs.writeFileSync('modules/home.js', s);
  console.log('✅ home.js: دیتای سینا button added');
}
HOME

# ─── ۶) Restart ───
for pid in $(pgrep -f "core/server.js" 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done
sleep 1

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ Part 10 — Professional Polish           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "CSS:    $(wc -l < public/style.css) lines (premium)"
echo "Seed:   15 patients with 40+ vitals/MAR/orders"
echo ""
echo "Next:"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
echo ""
echo "Then in browser: hard reload + click '✨ دیتای سینا'"
