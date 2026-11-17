
# ═══════════════════════════════════════════════════════════════
#  Part 5 — Mobile-First Complete Redesign
# ═══════════════════════════════════════════════════════════════

# ─── 1) آزادسازی امن پورت 4000 ───
echo "🔧 Freeing port 4000..."
for i in 1 2 3; do
  PID=$(pgrep -f "core/server.js" 2>/dev/null | head -1)
  if [ -z "$PID" ]; then echo "✅ Port free"; break; fi
  echo "   Killing PID $PID..."
  kill -9 "$PID" 2>/dev/null
  sleep 1
done

# ─── 2) Backup ───
[ -f public/style.css ] && cp public/style.css public/style.css.bak
[ -f public/app.js ] && cp public/app.js public/app.js.bak
echo "✅ Backups saved (.bak)"

# ─── 3) New Mobile-First style.css ───
cat > public/style.css << 'CSS_EOF'
/* ═══════════════════════════════════════════════════════════
   NABZ Mobile-First Design System v2
   Clinical • Dark • Cinematic
   ═══════════════════════════════════════════════════════════ */

* { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  /* ─── Dark Theme (default) ─── */
  --bg: #0a0f1e;
  --bg-2: #131a2e;
  --bg-3: #1e2842;
  --bg-elev: #141b30;
  --fg: #e8ecf5;
  --fg-2: #8b95ab;
  --fg-3: #566178;
  --border: #232f4d;
  --border-2: #334466;

  /* ─── Brand ─── */
  --primary: #06b6d4;
  --primary-2: #0891b2;
  --primary-glow: rgba(6,182,212,0.25);

  --ok: #10b981;
  --warn: #f59e0b;
  --dng: #ef4444;
  --violet: #8b5cf6;
  --info: #3b82f6;

  /* ─── Gradients ─── */
  --grad-primary: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  --grad-ok: linear-gradient(135deg, #10b981 0%, #059669 100%);
  --grad-warn: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  --grad-dng: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  --grad-violet: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  --grad-elev: linear-gradient(135deg, #1a2338 0%, #0f1525 100%);

  /* ─── Layout ─── */
  --header-h: 56px;
  --nav-h: 68px;
  --safe-t: env(safe-area-inset-top, 0px);
  --safe-b: env(safe-area-inset-bottom, 0px);
  --safe-l: env(safe-area-inset-left, 0px);
  --safe-r: env(safe-area-inset-right, 0px);

  /* ─── Radius ─── */
  --r-sm: 8px;
  --r: 12px;
  --r-lg: 16px;
  --r-xl: 20px;
  --r-full: 999px;

  /* ─── Shadow ─── */
  --sh-sm: 0 1px 3px rgba(0,0,0,0.3);
  --sh: 0 4px 12px rgba(0,0,0,0.4);
  --sh-lg: 0 12px 32px rgba(0,0,0,0.5);
  --sh-glow: 0 0 24px var(--primary-glow);

  /* ─── Typography ─── */
  --font: 'Vazirmatn', 'Vazir', -apple-system, system-ui, 'Segoe UI', Tahoma, sans-serif;
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;
}

/* ─── Light Mode ─── */
@media (prefers-color-scheme: light) {
  :root {
    --bg: #f5f7fb;
    --bg-2: #ffffff;
    --bg-3: #eef1f7;
    --bg-elev: #ffffff;
    --fg: #0a0f1e;
    --fg-2: #4a5468;
    --fg-3: #8b95ab;
    --border: #dde2ee;
    --border-2: #c5cce0;
    --sh-sm: 0 1px 3px rgba(0,0,0,0.06);
    --sh: 0 4px 12px rgba(0,0,0,0.08);
    --sh-lg: 0 12px 32px rgba(0,0,0,0.12);
    --primary-glow: rgba(6,182,212,0.15);
    --grad-elev: linear-gradient(135deg, #ffffff 0%, #f5f7fb 100%);
  }
}

/* ─── Base ─── */
html, body {
  height: 100%;
  overflow: hidden;
}
body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--fg);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none;
  font-feature-settings: 'ss01', 'ss02';
}

/* ─── App Shell ─── */
#app {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  padding-top: var(--safe-t);
  padding-left: var(--safe-l);
  padding-right: var(--safe-r);
}

/* ─── Header ─── */
#header {
  height: var(--header-h);
  flex-shrink: 0;
  background: var(--bg-elev);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  position: relative;
  z-index: 30;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
#header .logo {
  font-size: 20px;
  font-weight: 900;
  color: var(--fg);
  letter-spacing: -0.5px;
  display: flex;
  align-items: center;
  gap: 8px;
}
#header .logo span { color: var(--primary); }
#header > div[style*="flex"] { flex: 1; }

.hbtn {
  width: 42px;
  height: 42px;
  border: none;
  background: transparent;
  color: var(--fg-2);
  font-size: 20px;
  border-radius: 50%;
  cursor: pointer;
  position: relative;
  display: grid;
  place-items: center;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.hbtn:active {
  background: var(--bg-3);
  transform: scale(0.92);
}
.badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: var(--dng);
  color: #fff;
  font-size: 10px;
  font-weight: 900;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--r-full);
  display: none;
  place-items: center;
  border: 2px solid var(--bg-elev);
  animation: pulseBadge 2s infinite;
}
@keyframes pulseBadge {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
  50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
}

/* ─── Main ─── */
#main {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 14px;
  padding-bottom: calc(var(--nav-h) + var(--safe-b) + 16px);
  -webkit-overflow-scrolling: touch;
}
body:not(.auth) #main {
  padding-bottom: 16px;
}

/* ─── Bottom Nav ─── */
#sidebar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(var(--nav-h) + var(--safe-b));
  padding-bottom: var(--safe-b);
  background: var(--bg-elev);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: stretch;
  z-index: 50;
  box-shadow: 0 -8px 24px rgba(0,0,0,0.3);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
body:not(.auth) #sidebar { display: none; }

.bn-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: none;
  background: transparent;
  color: var(--fg-3);
  font-family: inherit;
  cursor: pointer;
  padding: 6px 4px;
  position: relative;
  transition: color 0.2s;
  -webkit-tap-highlight-color: transparent;
}
.bn-tab:active {
  background: var(--bg-3);
}
.bn-tab.on {
  color: var(--primary);
}
.bn-tab.on::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 32px;
  height: 3px;
  background: var(--primary);
  border-radius: 0 0 3px 3px;
  box-shadow: 0 2px 8px var(--primary-glow);
}
.bn-icon {
  font-size: 22px;
  line-height: 1;
  transition: transform 0.2s;
}
.bn-tab.on .bn-icon {
  transform: scale(1.1);
  filter: drop-shadow(0 0 8px var(--primary-glow));
}
.bn-label {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

/* ─── Drawer ─── */
.drawer {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0);
  z-index: 200;
  display: flex;
  justify-content: flex-end;
  animation: fadeIn 0.2s ease forwards;
}
@keyframes fadeIn {
  to { background: rgba(0,0,0,0.65); }
}
.drawer-panel {
  width: min(340px, 88vw);
  height: 100%;
  background: var(--bg-elev);
  overflow-y: auto;
  padding: calc(var(--safe-t) + 16px) 0 calc(var(--safe-b) + 16px);
  animation: slideIn 0.28s cubic-bezier(0.32, 0.72, 0, 1);
  box-shadow: -12px 0 40px rgba(0,0,0,0.5);
}
@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
.drawer-hd {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}
.drawer-logo {
  font-size: 18px;
  font-weight: 900;
}
.drawer-logo strong { color: var(--primary); }
.drawer-close {
  width: 36px;
  height: 36px;
  border: none;
  background: var(--bg-3);
  color: var(--fg);
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.drawer-sec {
  padding: 8px 12px;
}
.drawer-sec-hd {
  font-size: 11px;
  font-weight: 900;
  color: var(--fg-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 8px 8px 4px;
}
.drawer-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 10px;
  border: none;
  background: transparent;
  color: var(--fg);
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 600;
  border-radius: var(--r-sm);
  cursor: pointer;
  text-align: right;
  -webkit-tap-highlight-color: transparent;
}
.drawer-item:active {
  background: var(--bg-3);
  transform: scale(0.98);
}
.di-ico { font-size: 20px; flex-shrink: 0; }
.di-lbl { flex: 1; }

/* ─── Login ─── */
.login {
  display: grid;
  place-items: center;
  min-height: calc(100vh - var(--header-h) - 32px);
  padding: 16px;
}
.lcard {
  width: 100%;
  max-width: 380px;
  background: var(--grad-elev);
  border: 1px solid var(--border);
  border-radius: var(--r-xl);
  padding: 32px 24px;
  box-shadow: var(--sh-lg);
  position: relative;
  overflow: hidden;
}
.lcard::before {
  content: '';
  position: absolute;
  top: -100px;
  right: -100px;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, var(--primary-glow), transparent 70%);
  pointer-events: none;
}
.lcard > div:first-child {
  font-size: 64px;
  line-height: 1;
  text-align: center;
  filter: drop-shadow(0 0 24px var(--primary-glow));
  animation: heartbeat 2s infinite;
}
@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  14% { transform: scale(1.08); }
  28% { transform: scale(1); }
  42% { transform: scale(1.05); }
  70% { transform: scale(1); }
}
.lcard h1 {
  font-size: 28px;
  font-weight: 900;
  text-align: center;
  margin: 12px 0 4px;
  background: var(--grad-primary);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -1px;
}
.lcard form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}
.lcard input {
  padding: 14px 16px;
  border: 1.5px solid var(--border-2);
  background: var(--bg);
  color: var(--fg);
  border-radius: var(--r);
  font-family: inherit;
  font-size: 15px;
  transition: all 0.15s;
}
.lcard input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 4px var(--primary-glow);
}
.lcard button {
  padding: 14px;
  background: var(--grad-primary);
  color: #fff;
  border: none;
  border-radius: var(--r);
  font-family: inherit;
  font-size: 15px;
  font-weight: 900;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 4px 16px var(--primary-glow);
}
.lcard button:active {
  transform: scale(0.98);
}
.err {
  color: var(--dng);
  font-size: 12px;
  font-weight: 700;
  min-height: 16px;
  text-align: center;
}
.hint {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--fg-2);
  margin-top: 16px;
  padding: 10px;
  background: var(--bg-3);
  border-radius: var(--r-sm);
  text-align: center;
  border: 1px dashed var(--border-2);
}

/* ─── Cards ─── */
.card {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 14px;
  margin-bottom: 10px;
  box-shadow: var(--sh-sm);
}
.card-title {
  font-size: 13px;
  font-weight: 900;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.card-sub {
  font-size: 11.5px;
  color: var(--fg-2);
}

/* ─── Section Header ─── */
.sec-hd {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  font-weight: 900;
  margin: 16px 0 10px;
  color: var(--fg);
}
.sec-hd > span:first-child {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ─── Stats Grid ─── */
.grid-4 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.stat {
  background: var(--grad-elev);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 16px 10px;
  text-align: center;
  position: relative;
  overflow: hidden;
  transition: transform 0.15s;
}
.stat::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--grad-primary);
}
.stat .v {
  font-size: 26px;
  font-weight: 900;
  color: var(--primary);
  line-height: 1.1;
  font-feature-settings: 'tnum';
}
.stat .l {
  font-size: 10.5px;
  color: var(--fg-2);
  margin-top: 6px;
  font-weight: 700;
  letter-spacing: 0.3px;
}
.stat.dng::before { background: var(--grad-dng); }
.stat.dng .v { color: var(--dng); }
.stat.warn::before { background: var(--grad-warn); }
.stat.warn .v { color: var(--warn); }
.stat.ok::before { background: var(--grad-ok); }
.stat.ok .v { color: var(--ok); }

/* ─── Pills ─── */
.pill {
  display: inline-block;
  padding: 3px 9px;
  border-radius: var(--r-full);
  font-size: 10px;
  font-weight: 800;
  background: var(--bg-3);
  color: var(--fg-2);
  letter-spacing: 0.2px;
}
.pill.ok { background: rgba(16,185,129,0.15); color: var(--ok); }
.pill.warn { background: rgba(245,158,11,0.15); color: var(--warn); }
.pill.dng { background: rgba(239,68,68,0.15); color: var(--dng); }
.pill.info { background: rgba(6,182,212,0.15); color: var(--primary); }

/* ─── Rows (list items) ─── */
.row {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 14px;
  margin-bottom: 8px;
  border-right: 3px solid var(--border-2);
  cursor: pointer;
  transition: transform 0.1s, border-color 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.row:active {
  transform: scale(0.985);
  background: var(--bg-3);
}
.row.hi { border-right-color: var(--dng); }
.row.md { border-right-color: var(--warn); }
.row.lo { border-right-color: var(--ok); }
.row-hd {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.row-title {
  font-size: 13.5px;
  font-weight: 800;
  line-height: 1.3;
}
.row-meta {
  font-size: 11.5px;
  color: var(--fg-2);
  margin-top: 4px;
  line-height: 1.4;
}

/* ─── Alert ─── */
.alert {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 12px 14px;
  margin-bottom: 8px;
  border-right: 3px solid var(--border-2);
}
.alert.critical {
  border-right-color: var(--dng);
  background: linear-gradient(90deg, rgba(239,68,68,0.06), var(--bg-2) 40%);
  animation: alertPulse 3s infinite;
}
.alert.high {
  border-right-color: var(--warn);
  background: linear-gradient(90deg, rgba(245,158,11,0.06), var(--bg-2) 40%);
}
@keyframes alertPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
  50% { box-shadow: 0 0 0 4px rgba(239,68,68,0.08); }
}

/* ─── Buttons ─── */
.btn {
  padding: 12px 18px;
  min-height: 44px;
  border: 1.5px solid var(--border-2);
  background: var(--bg-2);
  color: var(--fg);
  font-family: inherit;
  font-size: 13px;
  font-weight: 800;
  border-radius: var(--r);
  cursor: pointer;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.btn:active {
  transform: scale(0.97);
  background: var(--bg-3);
}
.btn-primary {
  background: var(--grad-primary);
  color: #fff;
  border: none;
  box-shadow: 0 4px 16px var(--primary-glow);
}
.btn-primary:active {
  box-shadow: 0 2px 8px var(--primary-glow);
}
.btn-block { width: 100%; }

/* ─── Empty / Spinner ─── */
.empty {
  text-align: center;
  padding: 48px 20px;
  color: var(--fg-3);
  font-size: 13px;
  line-height: 1.6;
}
.spinner {
  display: inline-block;
  width: 28px;
  height: 28px;
  border: 2.5px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ─── Bottom Sheet ─── */
.bs-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0);
  z-index: 300;
  display: flex;
  align-items: flex-end;
  transition: background 0.25s ease;
  -webkit-tap-highlight-color: transparent;
}
.bs-backdrop.show {
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.bs-sheet {
  width: 100%;
  max-height: 88vh;
  background: var(--bg-elev);
  border-radius: var(--r-xl) var(--r-xl) 0 0;
  padding: 10px 16px calc(var(--safe-b) + 20px);
  transform: translateY(100%);
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  overflow-y: auto;
  box-shadow: 0 -12px 48px rgba(0,0,0,0.5);
}
.bs-backdrop.show .bs-sheet {
  transform: translateY(0);
}
.bs-handle {
  width: 40px;
  height: 4px;
  background: var(--border-2);
  border-radius: 2px;
  margin: 0 auto 16px;
}
.bs-hd {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}
.bs-title {
  font-size: 15px;
  font-weight: 900;
}
.bs-close {
  width: 36px;
  height: 36px;
  border: none;
  background: var(--bg-3);
  color: var(--fg);
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.bs-body { display: flex; flex-direction: column; gap: 8px; }
.bs-row {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  font-size: 12.5px;
}
.bs-row:last-child { border-bottom: none; }
.bs-key {
  color: var(--fg-2);
  font-weight: 700;
  font-size: 11px;
  font-family: var(--font-mono);
  direction: ltr;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bs-val {
  color: var(--fg);
  font-weight: 600;
  word-break: break-word;
}
.bs-val code {
  font-family: var(--font-mono);
  font-size: 10.5px;
  background: var(--bg);
  padding: 6px 8px;
  border-radius: 6px;
  display: block;
  white-space: pre-wrap;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
}

/* ─── Form (in bottom sheet) ─── */
.bs-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.bs-field label {
  display: block;
  font-size: 12px;
  font-weight: 800;
  color: var(--fg-2);
  margin-bottom: 6px;
}
.bs-field input,
.bs-field select,
.bs-field textarea {
  width: 100%;
  padding: 13px 14px;
  border: 1.5px solid var(--border-2);
  background: var(--bg-2);
  color: var(--fg);
  border-radius: var(--r);
  font-family: inherit;
  font-size: 14px;
  transition: all 0.15s;
}
.bs-field input:focus,
.bs-field select:focus,
.bs-field textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 4px var(--primary-glow);
}
.bs-submit {
  padding: 16px;
  background: var(--grad-primary);
  color: #fff;
  border: none;
  border-radius: var(--r);
  font-family: inherit;
  font-size: 15px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 6px 20px var(--primary-glow);
  margin-top: 8px;
}
.bs-submit:active { transform: scale(0.98); }

/* ─── Sticky action button (for 'action' kind panels) ─── */
.action-card {
  background: var(--grad-elev);
  border: 1px solid var(--border);
  border-radius: var(--r-xl);
  padding: 32px 20px;
  text-align: center;
}
.action-code {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 900;
  padding: 20px 16px;
  background: var(--bg);
  border-radius: var(--r);
  word-break: break-all;
  letter-spacing: 1px;
  color: var(--primary);
  border: 1px solid var(--border-2);
  line-height: 1.5;
  box-shadow: inset 0 2px 8px rgba(0,0,0,0.3);
}

/* ─── Scrollbar ─── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--border-2);
  border-radius: 3px;
}

/* ─── RTL adjustments ─── */
[dir="rtl"] .drawer { justify-content: flex-start; }
[dir="rtl"] .drawer-panel {
  animation: slideInRTL 0.28s cubic-bezier(0.32, 0.72, 0, 1);
  box-shadow: 12px 0 40px rgba(0,0,0,0.5);
}
@keyframes slideInRTL {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

/* ─── Tablet / Desktop enhancement ─── */
@media (min-width: 768px) {
  #app {
    max-width: 900px;
    margin: 0 auto;
    border-left: 1px solid var(--border);
    border-right: 1px solid var(--border);
  }
  .grid-4 { grid-template-columns: repeat(4, 1fr); }
  #main { padding: 20px 24px; }
}
CSS_EOF
echo "✅ New mobile-first style.css installed"

# ─── 4) Patch app.js for mobile nav + bottom sheet ───
node << 'APP_PATCH'
const fs = require('fs');
const p = 'public/app.js';
let src = fs.readFileSync(p, 'utf8');

// ── Replace renderNav entirely ──
const oldRenderNavRegex = /function renderNav\(\)\{[\s\S]*?^\}/m;
const newRenderNav = `const MOD_META = {
  clinical:{l:'بالینی',i:'🩺'}, emergency:{l:'اورژانس',i:'🚨'},
  workflow:{l:'گردش کار',i:'🔄'}, paraclinical:{l:'پاراکلینیک',i:'🧪'},
  safety:{l:'ایمنی',i:'⚠️'}, surgical:{l:'جراحی',i:'🔪'},
  ops:{l:'عملیات',i:'⚙️'}, education:{l:'آموزش',i:'🎓'},
  quality:{l:'کیفیت',i:'⭐'}, rights:{l:'حقوق بیمار',i:'⚖️'},
  advanced_hr:{l:'منابع انسانی',i:'💰'}, admin:{l:'مدیریت',i:'🛡️'},
  qr_pulse:{l:'QR نبضی',i:'📱'}, crisis:{l:'بحران',i:'🔥'}
};
function renderNav(){
  const byModule={};
  for(const p of S.panels){if(!byModule[p.module])byModule[p.module]=[];byModule[p.module].push(p);}
  const modOrder=['clinical','emergency','workflow','paraclinical','safety','surgical','ops','education','quality','rights','advanced_hr','admin','qr_pulse','crisis'];
  
  // Bottom tabs
  const tabs=[
    {icon:'🏠',label:'خانه',action:'NABZ.showNeural()'},
    {icon:'🚨',label:'اورژانس',action:byModule.emergency?\`NABZ.show('\${byModule.emergency[0].id}')\`:'NABZ.showDrawer()'},
    {icon:'🩺',label:'بالینی',action:byModule.clinical?\`NABZ.show('\${byModule.clinical[0].id}')\`:'NABZ.showDrawer()'},
    {icon:'🧠',label:'عصبی',action:'NABZ.showNeural()'},
    {icon:'☰',label:'منو',action:'NABZ.showDrawer()'}
  ];
  
  // Drawer
  let dh='<div class="drawer-hd"><div class="drawer-logo">🫀 <strong>نبض</strong></div><button class="drawer-close" onclick="NABZ.hideDrawer()">✕</button></div>';
  for(const m of modOrder){
    if(!byModule[m])continue;
    const info=MOD_META[m]||{l:m,i:'📄'};
    dh+=\`<div class="drawer-sec"><div class="drawer-sec-hd">\${info.i} \${info.l}</div>\`;
    for(const p of byModule[m]){
      dh+=\`<button class="drawer-item" onclick="NABZ.show('\${p.id}');NABZ.hideDrawer()"><span class="di-ico">\${p.icon||'📄'}</span><span class="di-lbl">\${p.title}</span></button>\`;
    }
    dh+='</div>';
  }
  dh+='<div class="drawer-sec" style="border-top:1px solid var(--border);margin-top:8px">';
  dh+=\`<button class="drawer-item" onclick="NABZ.showNeural();NABZ.hideDrawer()"><span class="di-ico">🧠</span><span class="di-lbl">موتور عصبی</span></button>\`;
  dh+=\`<button class="drawer-item" style="color:var(--dng)" onclick="NABZ.logout()"><span class="di-ico">⏻</span><span class="di-lbl">خروج</span></button>\`;
  dh+='</div>';
  
  document.getElementById('sidebar').innerHTML=tabs.map(t=>
    \`<button class="bn-tab" onclick="\${t.action}"><span class="bn-icon">\${t.icon}</span><span class="bn-label">\${t.label}</span></button>\`
  ).join('');
  
  let old=document.getElementById('drawer');if(old)old.remove();
  document.body.insertAdjacentHTML('beforeend',
    \`<div id="drawer" class="drawer" style="display:none" onclick="if(event.target===this)NABZ.hideDrawer()"><div class="drawer-panel">\${dh}</div></div>\`);
}`;

if (oldRenderNavRegex.test(src)) {
  src = src.replace(oldRenderNavRegex, newRenderNav);
  console.log('✅ renderNav replaced');
} else {
  console.log('⚠️ renderNav regex not matched — will append');
}

// ── Replace showItem with bottom sheet ──
const oldShowItemRegex = /NABZ\.showItem=async function[\s\S]*?\};/;
const newShowItem = `NABZ.showItem=async function(pid,iid){
  const p=S.panels.find(x=>x.id===pid);if(!p)return;
  try{
    const d=await api(p.api);
    const item=(d.items||[]).find(x=>x.id===iid)||d;
    const sheet=document.createElement('div');
    sheet.className='bs-backdrop';
    sheet.onclick=e=>{if(e.target===sheet)sheet.remove();};
    const content=document.createElement('div');
    content.className='bs-sheet';
    let html='<div class="bs-handle"></div>';
    html+=\`<div class="bs-hd"><div class="bs-title">\${p.icon||'📄'} \${p.title}</div><button class="bs-close" onclick="this.closest('.bs-backdrop').remove()">✕</button></div>\`;
    html+='<div class="bs-body">';
    for(const [k,v] of Object.entries(item)){
      if(v==null||v===''||k==='_trans'||k==='lastSignatureId')continue;
      let valHtml;
      if(typeof v==='object')valHtml='<code>'+esc(JSON.stringify(v,null,2))+'</code>';
      else valHtml=esc(String(v));
      html+=\`<div class="bs-row"><div class="bs-key">\${esc(k)}</div><div class="bs-val">\${valHtml}</div></div>\`;
    }
    html+='</div>';
    content.innerHTML=html;
    sheet.appendChild(content);
    document.body.appendChild(sheet);
    requestAnimationFrame(()=>sheet.classList.add('show'));
  }catch(e){alert(e.message);}
};`;
src = src.replace(oldShowItemRegex, newShowItem);

// ── Replace openForm with proper bottom sheet form ──
const oldOpenFormRegex = /NABZ\.openForm=async function[\s\S]*?\};/;
const newOpenForm = `NABZ.openForm=async function(pid){
  const p=S.panels.find(x=>x.id===pid);if(!p||!p.form)return;
  const sheet=document.createElement('div');
  sheet.className='bs-backdrop';
  sheet.onclick=e=>{if(e.target===sheet)sheet.remove();};
  const content=document.createElement('div');
  content.className='bs-sheet';
  let html='<div class="bs-handle"></div>';
  html+=\`<div class="bs-hd"><div class="bs-title">➕ \${p.title}</div><button class="bs-close" onclick="this.closest('.bs-backdrop').remove()">✕</button></div>\`;
  html+='<form class="bs-form" id="dynForm">';
  for(const f of (p.form.fields||[])){
    html+='<div class="bs-field">';
    html+=\`<label>\${esc(f.label)}\${f.required?' <span style="color:var(--dng)">*</span>':''}</label>\`;
    if(f.type==='number') html+=\`<input type="number" name="\${f.name}" step="any" \${f.required?'required':''}>\`;
    else if(f.options) {
      html+=\`<select name="\${f.name}" \${f.required?'required':''}>\`;
      for(const o of f.options) html+=\`<option value="\${o}">\${o}</option>\`;
      html+='</select>';
    } else if(f.textarea) html+=\`<textarea name="\${f.name}" rows="3" \${f.required?'required':''}></textarea>\`;
    else html+=\`<input type="text" name="\${f.name}" \${f.required?'required':''}>\`;
    html+='</div>';
  }
  html+='<button type="submit" class="bs-submit">✅ ثبت</button>';
  html+='</form>';
  content.innerHTML=html;
  content.querySelector('#dynForm').onsubmit=async(ev)=>{
    ev.preventDefault();
    const fd=new FormData(ev.target);
    const data={};
    for(const [k,v] of fd.entries()){
      if(v==='')continue;
      const n=Number(v);
      data[k]=isNaN(n)||v==='true'||v==='false'? (v==='true'?true:v==='false'?false:v) : n;
    }
    try{
      await api(p.form.api||p.api,{method:p.form.method||'POST',body:JSON.stringify(data)});
      sheet.remove();
      show(pid);
    }catch(e){alert('❌ '+e.message);}
  };
  sheet.appendChild(content);
  document.body.appendChild(sheet);
  requestAnimationFrame(()=>sheet.classList.add('show'));
};
NABZ.showDrawer=function(){const d=document.getElementById('drawer');if(d)d.style.display='flex';};
NABZ.hideDrawer=function(){const d=document.getElementById('drawer');if(d)d.style.display='none';};`;
src = src.replace(oldOpenFormRegex, newOpenForm);

// ── Add 'auth' class handling in boot/showLogin ──
src = src.replace(
  /document\.getElementById\('header'\)\.style\.display='flex';/,
  "document.body.classList.add('auth');document.getElementById('header').style.display='flex';"
);
src = src.replace(
  /document\.getElementById\('loginView'\)\.style\.display='grid';/,
  "document.body.classList.remove('auth');document.getElementById('loginView').style.display='grid';"
);

// ── Add highlight in show() ──
src = src.replace(
  /document\.querySelectorAll\('\.nbtn'\)\.forEach\(b=>b\.classList\.toggle\('on',b\.dataset\.id===id\)\);/,
  `document.querySelectorAll('.bn-tab').forEach((b,i)=>{b.classList.toggle('on',false)});`
);

fs.writeFileSync(p, src);
console.log('✅ app.js patched for mobile');
APP_PATCH

# ─── 5) Restart ───
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   ✅ Part 5 — Mobile-First Redesign Ready   ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Next:"
echo "   npm start"
echo ""
echo "Then open http://localhost:4000 on your phone"
