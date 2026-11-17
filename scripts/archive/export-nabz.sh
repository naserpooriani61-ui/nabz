#!/data/data/com.termux/files/usr/bin/bash
# ═══════════════════════════════════════════════════════════════
#  NABZ Export v1.0
#  Creates: 5 code files + 1 prompt + data backup
# ═══════════════════════════════════════════════════════════════
set +e

NABZ_DIR="$HOME/nabz"
[ ! -d "$NABZ_DIR" ] && { echo "❌ $NABZ_DIR not found"; exit 1; }
cd "$NABZ_DIR"

OUT="/sdcard/Download/nabz-export"
[ ! -d "/sdcard/Download" ] && OUT="$HOME/nabz-export"
mkdir -p "$OUT"
TS=$(date +%Y%m%d_%H%M%S)

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  NABZ Export — $(date)"
echo "═══════════════════════════════════════════════════════════"
echo "📁 Output: $OUT"
echo ""

# ─── 1. Data backup via API ───
echo "→ Data backup..."
if pgrep -f "core/server.js" > /dev/null; then
  TOKEN=$(curl -s -m 5 -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"nabz@2026"}' 2>/dev/null | \
    grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  if [ -n "$TOKEN" ]; then
    curl -s -m 15 -X POST http://localhost:4000/api/ops2/backup/export \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"password":"nabz@2026"}' > "$OUT/DATA-BACKUP-$TS.nabz"
    SZ=$(wc -c < "$OUT/DATA-BACKUP-$TS.nabz" 2>/dev/null || echo 0)
    if [ "$SZ" -gt 100 ]; then
      echo "  ✅ Data: DATA-BACKUP-$TS.nabz ($SZ bytes)"
    else
      echo "  ⚠️  Backup returned empty — server may not have data"
      rm -f "$OUT/DATA-BACKUP-$TS.nabz"
    fi
  else
    echo "  ⚠️  Login failed — skipping data backup"
  fi
else
  echo "  ⚠️  Server down — skipping data backup (code will still export)"
fi
echo ""

# ─── 2. File bundles ───
write_bundle() {
  local outfile="$1" title="$2" files="$3"
  local count=0 missing=0
  {
    echo "════════════════════════════════════════════════════════════════"
    echo "NABZ (نبض) — Neural Hospital Operating System v1.0"
    echo "$title"
    echo "Generated: $(date -Iseconds)"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    echo "CONTENTS:"
    for f in $files; do
      [ -f "$f" ] && echo "  ✓ $f ($(wc -l < "$f" 2>/dev/null || echo 0) lines)"
    done
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo ""
  } > "$outfile"
  for f in $files; do
    if [ -f "$f" ]; then
      {
        echo ""
        echo "════════════════════════════════════════════════════════════════"
        echo "FILE: $f"
        echo "LINES: $(wc -l < "$f" 2>/dev/null || echo 0)"
        echo "════════════════════════════════════════════════════════════════"
        echo ""
        cat "$f"
        echo ""
      } >> "$outfile"
      count=$((count + 1))
    else
      missing=$((missing + 1))
    fi
  done
  echo "  ✅ $title — $count files ($missing missing)"
}

CORE="package.json core/store.js core/events.js core/audit.js core/signature.js core/auth.js core/permissions.js core/permissions-extra.js core/state-machine.js core/sm.js core/neural.js core/server.js core/mod-helpers.js core/seed.js core/sina.js core/real-seed.js core/sse.js"

CLINICAL="modules/clinical.js modules/emergency.js modules/workflow.js modules/paraclinical.js modules/safety.js modules/ops.js modules/bedboard.js modules/home.js modules/actions.js"

SPECIALIZED="modules/analytics.js modules/crisis.js modules/surgical.js modules/education.js modules/quality.js modules/admin.js modules/rights.js modules/advanced_hr.js modules/qr_pulse.js modules/documents.js modules/ops2.js modules/nursing_report.js modules/stream.js"

FRONTEND_CORE="public/index.html public/style.css public/app.js"

FRONTEND_EXTRAS="public/extra.js public/documents.js public/scanner.js public/ops2.js public/live.js public/manifest.webmanifest public/sw.js"

echo "→ Writing 5 code bundles..."
write_bundle "$OUT/01-foundation-$TS.txt"        "FILE 1/5 — FOUNDATION & CORE" "$CORE"
write_bundle "$OUT/02-clinical-$TS.txt"          "FILE 2/5 — CLINICAL MODULES" "$CLINICAL"
write_bundle "$OUT/03-specialized-$TS.txt"       "FILE 3/5 — SPECIALIZED MODULES" "$SPECIALIZED"
write_bundle "$OUT/04-frontend-core-$TS.txt"     "FILE 4/5 — FRONTEND CORE" "$FRONTEND_CORE"
write_bundle "$OUT/05-frontend-extras-$TS.txt"   "FILE 5/5 — FRONTEND EXTRAS" "$FRONTEND_EXTRAS"
echo ""

# ─── 3. Master Prompt ───
echo "→ Writing master prompt..."
cat > "$OUT/PROMPT-$TS.txt" << 'PROMPT_EOF'
═══════════════════════════════════════════════════════════════════════
NABZ (نبض) — NEURAL HOSPITAL OPERATING SYSTEM v1.0
Master Continuation Prompt — Part 15 onward
═══════════════════════════════════════════════════════════════════════

## IDENTITY

You are continuing to build NABZ (نبض) — a complete Neural Hospital
Operating System for Sina Hospital (Tehran, Iran). Client: Naser
Pouryani, supervisor at Sina. Target: replace legacy HIS with a
mobile-first, offline-capable, Termux-deployable system that can be
packaged as Android APK.

Parts 1-14 are complete. You are picking up at Part 15.

## CURRENT STATE — 22 MODULES · 229 ROUTES · 5000+ LINES

Backend modules (all in modules/):
 1.  clinical.js       — patients, vitals, kardex, MAR, I/O
 2.  emergency.js      — ED visits, ESI triage, Code 247/724/99, MCI
 3.  workflow.js       — consult, transfer, discharge, handover
 4.  paraclinical.js   — lab, radiology, bloodbank, pharmacy
 5.  safety.js         — sepsis, infection, incidents, risks
 6.  surgical.js       — OR rooms, WHO checklist, PACU, CSSD
 7.  ops.js            — shift rosters, attendance, karanneh
 8.  bedboard.js       — 28 Sina wards, bed map, reseed
 9.  home.js           — dashboard, global search, charts
10.  actions.js        — 30+ declarative actions (approve/dispense/...)
11.  analytics.js      — 5 SVG charts (NEWS trend, MAR, occupancy, ESI)
12.  crisis.js         — 8 types, 15 roles, tasks, evacuation
13.  education.js      — exams, questions, cases, certificates
14.  quality.js        — KPIs, PDSA, RCA, audits, satisfaction
15.  admin.js          — users, roles, permissions, audit verify
16.  rights.js         — charter, consents, complaints, privacy
17.  advanced_hr.js    — coefficients, appeals, extras (claim board)
18.  qr_pulse.js       — HMAC rotating QR (30s bucket, 90s valid)
19.  documents.js      — 7 PDF-ready documents (kardex, MAR, etc.)
20.  ops2.js           — backup (AES-256-GCM), health, audit viewer
21.  nursing_report.js — NANDA-I (26 diagnoses), ISBAR, digital sign
22.  stream.js         — SSE hub for real-time sync

Core (all in core/):
  store.js            — JSON file store with atomic writes + cache
  events.js           — in-memory Event Bus + wildcard subscriber
  audit.js            — SHA-256 chained tamper-proof log
  signature.js        — Ed25519 digital signatures
  auth.js             — JWT + bcrypt + session
  permissions.js      — RBAC matrix (50+ perms, 25 roles) + ward scope
  permissions-extra.js— extended perms for Part 2-14 modules
  state-machine.js    — unified transitions (order/mar/consult/ed/transfer/crisis)
  neural.js           — 4-layer ML (anomaly, sequence, cohort, ensemble)
  server.js           — HTTP router with auto-discovery of modules/
  mod-helpers.js      — shared helpers (h, sd, sg, list)
  seed.js             — initial admin + demo data
  sina.js             — 28 real wards + 107 real staff (from Excel)
  real-seed.js        — 15 realistic patients with full clinical data
  sse.js              — SSE hub with heartbeat + connection cap (200)

Frontend (all in public/):
  index.html          — single SPA shell (login + app + bottom nav)
  style.css           — full design system (mobile-first, dark/light)
  app.js              — SPA router + renderers (list/stats/chart/action/
                        bedboard/crisis/analytics/nursing kinds)
  extra.js            — analytics + crisis + bedboard + actions UI
  documents.js        — print + share + PDF viewer
  scanner.js          — QR scanner (BarcodeDetector + manual fallback)
  ops2.js             — backup + health + audit UI
  live.js             — SSE client + crisis takeover + auto-refresh
  manifest.webmanifest— PWA manifest
  sw.js               — service worker (cache-first for static)

## ARCHITECTURE (DO NOT DEVIATE)

- Server-driven: ALL logic on server. Client only renders.
- Modules = { handlers, routes, panels }
  - handlers: object of functions
  - routes: [{ method, path, handler, perm }]
  - panels: [{ id, title, icon, perm, kind, api, fields?, form? }]
  - server.js auto-discovers *.js in modules/ — no manual registration
- JSON store: no database. Each collection = data/<name>.json
- Event Bus: every state change emits event → SSE → all clients
- Panel kinds (renderer in app.js): list | stats | action | bedboard |
  crisis | analytics | nursing | chart
- Real-time: SSE at /api/stream?token=X (EventSource, auto-reconnect)
- Actions: declarative catalog in modules/actions.js resolves which
  buttons appear on which item based on status + role

## HARD CONSTRAINTS

- NO CDN — all libraries local or handwritten
- NO frameworks (React/Vue/etc) — vanilla JS
- NO build step — files served directly
- NO database — JSON files only
- Mobile-first (375px base). Bottom nav + drawer + bottom sheet.
- Persian RTL, Vazirmatn font (embedded or system).
- Termux on Android (4-core, ~2GB RAM available to node).
- Must work with `NODE_OPTIONS='--max-old-space-size=384'`
- Node.js 20+ (tested on 26).

## KEY DESIGN DECISIONS

- SSE over WebSocket (Termux RAM + auto-reconnect)
- SVG charts handwritten (no Chart.js)
- Single SPA (no multi-page) — saves space, faster nav
- Server-side HTML generation for documents (print-ready)
- QR uses HMAC-SHA256 with rotating 30s buckets
- Backup uses AES-256-GCM with PBKDF2 (100k iterations)
- All state changes go through Event Bus → SSE broadcast
- Panel auto-refresh: panel → event map in live.js
- Crisis takeover: full-screen overlay on crisis.activated event

## TESTING PROTOCOL (MANDATORY)

After EVERY change:
1. `pkill -9 -f "core/server.js"` (kill any stale server)
2. `sleep 1`
3. `export NODE_OPTIONS="--max-old-space-size=384"`
4. `node core/server.js`
5. Verify startup shows `📡 NNN routes · NN modules`
6. Check for `❌` lines in output
7. On browser: **Hard Reload** (Ctrl+Shift+R)
8. Check console for errors
9. Login: `admin` / `nabz@2026`

## KNOWN PITFALLS

- Regex patches on JS often break — prefer full file rewrites
- `pkill -9 node` can kill Termux itself — use `-f "core/server.js"`
- `/tmp` doesn't exist on Termux — use `$HOME` for temp files
- `url.parse()` deprecated — server.js uses `new URL()`
- When adding a module, MUST add to MOD_META + modOrder in app.js
  (drawer rendering) — this was missed multiple times
- Server.js login endpoint must bypass auth check
- permissions-extra.js MUST be required in server.js
- `Killed` = OOM killer — reduce MAX_CLIENTS or heap size

## WHAT'S LEFT (Choose one to build next)

**Part 15 options (user will pick):**

A) Push Notifications — Web Push + VAPID keys
B) Voice Notes — MediaRecorder in ISBAR form
C) APK Build — Capacitor + Android Studio
D) Delta Sync — between multiple phones via server
E) Full Excel Import — all 500+ staff from original .xls
F) Offline-first PWA — cache-all + background sync
G) Doctor's specific panel — separate workflow
H) Lab integration — actual analyzer HL7

**Part 16-20 roadmap (suggestions):**
- Multi-tenancy (multiple hospitals)
- Advanced reporting (Excel, PDF batch)
- Integration with national health systems
- Wearable vitals integration
- AI-assisted diagnosis (like sepsis, but for more)
- Patient mobile app (separate SPA)

## CODE STYLE

- Persian UI text, English identifiers
- Compact but readable: no unnecessary whitespace
- Named exports at end of file
- Persian comments only for critical logic
- Helpers via mod-helpers.js (h, sd, sg, list)
- Response shape: { ok: true, data: ... } or { ok: false, error }
- Handlers throw ctx.E.badRequest/notFound/forbidden/conflict

## HOW TO CONTINUE

1. Read the 5 attached txt files completely BEFORE responding
2. Ask user which Part 15 option (A-H) they want
3. Implement it following the same pattern:
   - New file modules/<name>.js with handlers/routes/panels
   - Server.js auto-discovers → no change needed there
   - Add panel to app.js MOD_META + modOrder
   - Add kind → renderer if new UI pattern
   - Add CSS if needed
   - Restart + test
4. After completion, report:
   - Number of new routes/modules
   - Any new dependencies
   - Test results
   - Screenshots if user provides
5. Move to next Part

## ABSOLUTE RULES

- NEVER skip the testing protocol
- NEVER introduce CDN dependencies
- NEVER break the mobile-first layout
- ALWAYS preserve backward compatibility with existing routes
- ALWAYS emit events on state changes (for SSE sync)
- ALWAYS add to MOD_META + modOrder (drawer visibility)
- ALWAYS verify syntax after each file write

═══════════════════════════════════════════════════════════════════════
END OF PROMPT
═══════════════════════════════════════════════════════════════════════
PROMPT_EOF

echo "  ✅ PROMPT-$TS.txt ($(wc -l < "$OUT/PROMPT-$TS.txt") lines)"
echo ""

# ─── 4. Final report ───
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ EXPORT COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📁 Location: $OUT"
echo ""
echo "Generated files:"
ls -1 "$OUT" 2>/dev/null | while read f; do
  [ -f "$OUT/$f" ] && printf "  %-50s %10s bytes\n" "$f" "$(wc -c < "$OUT/$f" 2>/dev/null)"
done
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  📱 NEXT STEPS"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "1. Open file manager → Download → nabz-export/"
echo "2. Copy PROMPT file content entirely"
echo "3. Start NEW chat"
echo "4. Paste PROMPT text"
echo "5. Attach all 5 txt files + DATA-BACKUP file"
echo "6. New AI continues from Part 15"
echo ""
echo "Backup integrity (do NOT lose these):"
echo "  • DATA-BACKUP-*.nabz — encrypted with password: nabz@2026"
echo "  • 5 txt files — full source code snapshot"
echo "  • PROMPT — continuation context"
echo ""
