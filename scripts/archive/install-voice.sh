#!/data/data/com.termux/files/usr/bin/bash
# ═══════════════════════════════════════════════════════════
#  NABZ v1.0 — Part 15: Voice Notes Installer
#  Run from project root: bash install-voice.sh
# ═══════════════════════════════════════════════════════════
set -e

echo "🫀 NABZ Voice Notes — Installer"
echo ""

# ─── 1) Verify project root ───
if [ ! -f "core/server.js" ] || [ ! -d "modules" ] || [ ! -d "public" ]; then
  echo "❌ لطفاً از ریشهٔ پروژه اجرا کنید (جایی که core/, modules/, public/ وجود دارند)"
  exit 1
fi

# ─── 2) Backups ───
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="backups/voice-$STAMP"
mkdir -p "$BACKUP_DIR"
for f in public/extra.js public/index.html public/sw.js public/style.css core/permissions-extra.js; do
  [ -f "$f" ] && cp "$f" "$BACKUP_DIR/" 2>/dev/null || true
done
echo "📦 Backups → $BACKUP_DIR"
echo ""

# ─── 3) Directories ───
mkdir -p data/_voice
mkdir -p modules
mkdir -p public
echo "📁 data/_voice/ آماده شد"

# ═══════════════════════════════════════════════════════════
#  NEW FILE 1 — modules/voice_notes.js
# ═══════════════════════════════════════════════════════════
cat > modules/voice_notes.js << 'EOF_MODULE'
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Voice Notes (Part 15)
//  Audio attachments for ISBAR + other entities
//  Storage:  data/_voice/<id>.bin   (raw binary)
//            data/voice_notes.json  (metadata)
// ═══════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const store = require('../core/store');
const { h, sd } = require('../core/mod-helpers');

const VOICE_DIR = path.join(store.DATA, '_voice');
if (!fs.existsSync(VOICE_DIR)) fs.mkdirSync(VOICE_DIR, { recursive: true });

const MAX_DURATION_SEC = 60;
const MAX_SIZE_BYTES   = 2 * 1024 * 1024;
const MAX_NOTES_PER_FIELD = 10;
const ENTITY_TYPES = ['nursing_report','handover','kardex','vitals'];

function voiceFile(id) { return path.join(VOICE_DIR, id + '.bin'); }

function upload(ctx) {
  const b = ctx.body;
  if (!b.entityType || !ENTITY_TYPES.includes(b.entityType))
    throw ctx.E.badRequest('invalid_entity_type');
  if (!b.entityId) throw ctx.E.badRequest('entity_required');
  if (!b.audio)    throw ctx.E.badRequest('audio_required');

  let buffer;
  try {
    const b64 = String(b.audio).replace(/^data:audio\/[^;]+;base64,/, '');
    buffer = Buffer.from(b64, 'base64');
  } catch (_) { throw ctx.E.badRequest('invalid_audio'); }

  if (buffer.length > MAX_SIZE_BYTES)
    throw ctx.E.badRequest('audio_too_large:' + Math.round(buffer.length/1024) + 'KB');
  if (buffer.length < 100) throw ctx.E.badRequest('audio_too_small');

  const durationSec = Number(b.durationSec) || 0;
  if (durationSec > MAX_DURATION_SEC) throw ctx.E.badRequest('duration_too_long');

  const field = b.field || null;
  const existing = h(ctx, 'voice_notes').filter(n =>
    n.entityType === b.entityType && n.entityId === b.entityId && n.field === field);
  if (existing.length >= MAX_NOTES_PER_FIELD) throw ctx.E.conflict('too_many_notes');

  const id = ctx.uid('vn');
  fs.writeFileSync(voiceFile(id), buffer);

  const rec = {
    id, entityType: b.entityType, entityId: b.entityId, field,
    durationSec: Math.round(durationSec * 10) / 10,
    sizeBytes: buffer.length,
    mimeType: b.mimeType || 'audio/webm',
    uploadedBy: ctx.actor.id, uploadedByName: ctx.actor.username,
    createdAt: ctx.now()
  };
  ctx.store.put('voice_notes', rec);
  ctx.bus.emit('voice.note.created', { record: rec, actor: ctx.actor });
  return rec;
}

function listForEntity(ctx) {
  const items = h(ctx, 'voice_notes').filter(n =>
    n.entityType === ctx.params.entityType && n.entityId === ctx.params.entityId);
  items.sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  return { items, total: items.length };
}

function getMeta(ctx) {
  const n = ctx.store.get('voice_notes', ctx.params.id);
  if (!n) throw ctx.E.notFound('not_found');
  return n;
}

function streamAudio(ctx) {
  const n = ctx.store.get('voice_notes', ctx.params.id);
  if (!n) throw ctx.E.notFound('not_found');
  const f = voiceFile(n.id);
  if (!fs.existsSync(f)) throw ctx.E.notFound('audio_file_missing');
  const buf = fs.readFileSync(f);
  if (ctx.res) {
    ctx.res.writeHead(200, {
      'Content-Type': n.mimeType || 'audio/webm',
      'Content-Length': buf.length,
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': 'inline'
    });
    ctx.res.end(buf);
  }
  return undefined;
}

function remove(ctx) {
  const n = ctx.store.get('voice_notes', ctx.params.id);
  if (!n) throw ctx.E.notFound('not_found');
  if (n.uploadedBy !== ctx.actor.id && ctx.actor.role !== 'admin')
    throw ctx.E.forbidden('not_owner');
  try { if (fs.existsSync(voiceFile(n.id))) fs.unlinkSync(voiceFile(n.id)); } catch (_) {}
  ctx.store.remove('voice_notes', n.id);
  ctx.bus.emit('voice.note.deleted', { record: n, actor: ctx.actor });
  return { deleted: true, id: n.id };
}

function cleanup(ctx) {
  const allNotes = h(ctx, 'voice_notes');
  const validIds = {
    nursing_report: new Set(h(ctx,'nursing_reports').map(x=>x.id)),
    handover:       new Set(h(ctx,'handovers').map(x=>x.id)),
    kardex:         new Set(h(ctx,'orders').map(x=>x.id)),
    vitals:         new Set(h(ctx,'vitals').map(x=>x.id))
  };
  let removed = 0;
  for (const n of allNotes) {
    const set = validIds[n.entityType];
    if (set && !set.has(n.entityId)) {
      try { if (fs.existsSync(voiceFile(n.id))) fs.unlinkSync(voiceFile(n.id)); } catch (_) {}
      ctx.store.remove('voice_notes', n.id);
      removed++;
    }
  }
  return { scanned: allNotes.length, removed };
}

function stats(ctx) {
  const all = h(ctx, 'voice_notes');
  const totalBytes = all.reduce((s, n) => s + (n.sizeBytes || 0), 0);
  return {
    total: all.length,
    totalMB: Math.round(totalBytes / 1024 / 1024 * 100) / 100,
    maxPerField: MAX_NOTES_PER_FIELD,
    maxSizeBytes: MAX_SIZE_BYTES,
    maxDurationSec: MAX_DURATION_SEC
  };
}

module.exports = {
  handlers: { upload, listForEntity, getMeta, streamAudio, remove, cleanup, stats },
  routes: [
    { method:'POST', path:'/api/voice/upload', handler:'upload', perm:'voice.create' },
    { method:'GET',  path:'/api/voice/:entityType/:entityId', handler:'listForEntity', perm:'voice.view' },
    { method:'GET',  path:'/api/voice/note/:id', handler:'getMeta', perm:'voice.view' },
    { method:'GET',  path:'/api/voice/note/:id/audio', handler:'streamAudio', perm:'voice.view' },
    { method:'DELETE', path:'/api/voice/note/:id', handler:'remove', perm:'voice.delete' },
    { method:'POST', path:'/api/voice/cleanup', handler:'cleanup', perm:'admin.users.manage' },
    { method:'GET',  path:'/api/voice/stats', handler:'stats', perm:'voice.view' }
  ],
  panels: []
};
EOF_MODULE
echo "✅ modules/voice_notes.js"

# ═══════════════════════════════════════════════════════════
#  NEW FILE 2 — public/voice.js
# ═══════════════════════════════════════════════════════════
cat > public/voice.js << 'EOF_VOICE'
// ═══════════════════════════════════════════════════════════
//  NABZ Voice — MediaRecorder + ISBAR integration
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';
  const MAX_SEC   = 60;
  const MAX_BYTES = 2 * 1024 * 1024;

  let recorder = null, chunks = [], startTime = 0;
  let currentBtn = null, currentMeta = null;
  let timerInterval = null, checkInterval = null, stream = null;

  const Voice = {
    isSupported() { return !!(navigator.mediaDevices && window.MediaRecorder); },

    toggle(btn) {
      if (btn.dataset.recording === '1') Voice.stop();
      else Voice.start(btn, btn.dataset.entity, btn.dataset.id, btn.dataset.field);
    },

    async start(btn, entityType, entityId, field) {
      if (!Voice.isSupported()) { alert('دستگاه شما از ضبط صدا پشتیبانی نمی‌کند'); return; }
      if (recorder && recorder.state === 'recording') { alert('یک ضبط در حال اجراست'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:true }
        });
      } catch (e) { alert('دسترسی به میکروفون داده نشد: ' + e.message); return; }

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
      else if (MediaRecorder.isTypeSupported('audio/mp4'))        mimeType = 'audio/mp4';
      else if (MediaRecorder.isTypeSupported('audio/ogg'))        mimeType = 'audio/ogg';

      chunks = [];
      recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => Voice._finish(mimeType);
      recorder.start(1000);

      startTime = Date.now();
      currentBtn = btn;
      currentMeta = { entityType, entityId, field };

      btn.dataset.recording = '1';
      btn.innerHTML = '⏹️ <span class="voice-timer">00</span>s';
      btn.style.background = 'var(--dng)';
      btn.style.color = '#fff';

      timerInterval = setInterval(() => {
        const sec = Math.floor((Date.now() - startTime) / 1000);
        const el = btn.querySelector('.voice-timer');
        if (el) el.textContent = String(sec).padStart(2, '0');
        if (sec >= MAX_SEC) Voice.stop();
      }, 250);

      checkInterval = setInterval(() => {
        if (!currentBtn || !currentBtn.isConnected) Voice.stop();
      }, 500);

      if (navigator.vibrate) try { navigator.vibrate(30); } catch(_) {}
    },

    async stop() {
      if (!recorder || recorder.state !== 'recording') return;
      try { recorder.stop(); } catch(_) {}
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    },

    async _finish(mimeType) {
      const durationSec = (Date.now() - startTime) / 1000;
      const blob = new Blob(chunks, { type: mimeType });
      if (currentBtn) {
        currentBtn.dataset.recording = '';
        currentBtn.innerHTML = '🎤';
        currentBtn.style.background = '';
        currentBtn.style.color = '';
      }
      if (blob.size > MAX_BYTES) { alert('فایل صوتی بزرگ‌تر از ۲ مگابایت است'); return; }
      if (blob.size < 100)       { alert('ضبط خیلی کوتاه بود'); return; }

      const b64 = await Voice._blobToBase64(blob);
      try {
        await NABZ._api('/api/voice/upload', {
          method: 'POST',
          body: JSON.stringify({
            entityType: currentMeta.entityType,
            entityId:   currentMeta.entityId,
            field:      currentMeta.field,
            audio:      b64,
            durationSec,
            mimeType
          })
        });
        NABZ._toast('✅ یادداشت صوتی ذخیره شد');
        await Voice.refreshField(currentMeta);
      } catch (e) { alert('خطا در ذخیره: ' + e.message); }
    },

    _blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    },

    async refreshField(meta) {
      const el = document.getElementById('voiceList_' + meta.field);
      if (!el) return;
      try {
        const d = await NABZ._api('/api/voice/' + meta.entityType + '/' + meta.entityId);
        const notes = (d.items || []).filter(n => n.field === meta.field);
        el.innerHTML = Voice.renderList(notes);
      } catch (_) {}
    },

    renderList(notes) {
      if (!notes.length) return '';
      let h = '';
      for (const n of notes) {
        const dur  = n.durationSec ? n.durationSec.toFixed(1) : '?';
        const size = Math.round(n.sizeBytes / 1024) + 'KB';
        h += '<div class="voice-note" data-id="' + n.id + '">';
        h += '<button class="voice-play" onclick="NABZ.voice.togglePlay(\'' + n.id + '\',this)">▶️</button>';
        h += '<span class="voice-meta">' + dur + 's · ' + size + '</span>';
        h += '<span class="voice-author">' + NABZ._esc(n.uploadedByName || '') + '</span>';
        h += '<button class="voice-del" onclick="NABZ.voice.remove(\'' + n.id + '\',\'' + n.entityType + '\',\'' + n.entityId + '\',\'' + (n.field||'') + '\')">🗑</button>';
        h += '<audio preload="none" data-id="' + n.id + '" style="display:none"></audio>';
        h += '</div>';
      }
      return h;
    },

    async togglePlay(id, btn) {
      const wrap  = btn.closest('.voice-note');
      const audio = wrap.querySelector('audio');
      if (!audio.dataset.loaded) {
        audio.src = '/api/voice/note/' + id + '/audio';
        audio.dataset.loaded = '1';
      }
      if (audio.paused) {
        try { await audio.play(); btn.textContent = '⏸'; } catch(e) { alert('خطا: ' + e.message); }
      } else { audio.pause(); btn.textContent = '▶️'; }
      audio.onended = () => { btn.textContent = '▶️'; };
    },

    async remove(id, entityType, entityId, field) {
      if (!confirm('این یادداشت صوتی حذف شود؟')) return;
      try {
        await NABZ._api('/api/voice/note/' + id, { method: 'DELETE' });
        NABZ._toast('✅ حذف شد');
        Voice.refreshField({ entityType, entityId, field });
      } catch (e) { alert('خطا: ' + e.message); }
    }
  };

  window.NABZ = window.NABZ || {};
  NABZ.voice = Voice;
})();
EOF_VOICE
echo "✅ public/voice.js"

# ═══════════════════════════════════════════════════════════
#  NEW FILE 3 — public/voice-init.js
#  Wraps NABZ.openNursingEditor to inject mic UI (no extra.js patch)
# ═══════════════════════════════════════════════════════════
cat > public/voice-init.js << 'EOF_INIT'
// ═══════════════════════════════════════════════════════════
//  NABZ Voice Init — inject mic buttons into ISBAR editor
//  Wraps NABZ.openNursingEditor without touching extra.js
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  const FIELDS = [
    { id: 'nrS', field: 'situation' },
    { id: 'nrB', field: 'background' },
    { id: 'nrA', field: 'assessment' },
    { id: 'nrR', field: 'recommendation' }
  ];

  function injectVoiceUI(reportId) {
    for (const f of FIELDS) {
      const input = document.getElementById(f.id);
      if (!input) continue;

      const label = input.previousElementSibling;
      if (!label || label.tagName !== 'LABEL') continue;

      // Guard: skip if already injected
      if (label.querySelector('.voice-mic')) continue;

      // Wrap label text in span
      const text = label.textContent || '';
      label.innerHTML = '<span>' + text + '</span>';
      label.style.display = 'flex';
      label.style.justifyContent = 'space-between';
      label.style.alignItems = 'center';

      // Add mic only for editable (draft) fields
      if (!input.hasAttribute('disabled')) {
        const mic = document.createElement('button');
        mic.type = 'button';
        mic.className = 'voice-mic';
        mic.textContent = '🎤';
        mic.dataset.entity = 'nursing_report';
        mic.dataset.id = String(reportId);
        mic.dataset.field = f.field;
        mic.addEventListener('click', () => {
          NABZ.voice.toggle(mic);
        });
        label.appendChild(mic);
      }

      // Insert voice list container right after input/textarea
      const voiceList = document.createElement('div');
      voiceList.id = 'voiceList_' + f.field;
      voiceList.className = 'voice-list';
      voiceList.dataset.field = f.field;
      input.parentNode.insertBefore(voiceList, input.nextSibling);
    }
  }

  async function loadExistingNotes(reportId) {
    try {
      const vd = await NABZ._api('/api/voice/nursing_report/' + reportId);
      const all = vd.items || [];
      for (const f of FIELDS) {
        const el = document.getElementById('voiceList_' + f.field);
        if (!el) continue;
        const notes = all.filter(n => n.field === f.field);
        if (notes.length) el.innerHTML = NABZ.voice.renderList(notes);
      }
    } catch (_) {}
  }

  function patch() {
    if (!window.NABZ || typeof NABZ.openNursingEditor !== 'function') {
      setTimeout(patch, 200);
      return;
    }
    if (NABZ.openNursingEditor._voicePatched) return;

    const orig = NABZ.openNursingEditor;
    NABZ.openNursingEditor = async function(reportId) {
      await orig.call(this, reportId);
      const sheet = document.querySelector('.bs-backdrop .bs-sheet');
      if (!sheet) return;               // original failed → skip
      try {
        injectVoiceUI(reportId);
        await loadExistingNotes(reportId);
      } catch (e) {
        console.warn('[voice-init]', e.message);
      }
    };
    NABZ.openNursingEditor._voicePatched = true;
    console.log('[voice-init] Nursing editor wrapped ✓');
  }

  patch();
})();
EOF_INIT
echo "✅ public/voice-init.js"

# ═══════════════════════════════════════════════════════════
#  PATCH 1 — core/permissions-extra.js (append)
# ═══════════════════════════════════════════════════════════
if ! grep -q "voice.view" core/permissions-extra.js 2>/dev/null; then
cat >> core/permissions-extra.js << 'EOF_PERMS'

Object.assign(perms.P, {
  'voice.view':   'admin,nurse,head_nurse,physician,resident,intern,attending,specialist,supervisor_clinical,nursing_director',
  'voice.create': 'admin,nurse,head_nurse,physician,resident,intern,attending,specialist',
  'voice.delete': 'admin,nurse,head_nurse,physician,resident,intern,attending,specialist'
});
EOF_PERMS
echo "✅ core/permissions-extra.js (+3 perms)"
else
echo "ℹ️  core/permissions-extra.js already has voice perms"
fi

# ═══════════════════════════════════════════════════════════
#  PATCH 2 — public/style.css (append)
# ═══════════════════════════════════════════════════════════
if ! grep -q "voice-mic" public/style.css 2>/dev/null; then
cat >> public/style.css << 'EOF_CSS'

/* ═══════════════════════════════════════════════════════════
   Voice Notes (ISBAR) — Part 15
   ═══════════════════════════════════════════════════════════ */
.voice-mic{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:32px;height:28px;padding:0 8px;
  border:1.5px solid var(--border-2);
  background:var(--bg-2);color:var(--fg);
  border-radius:8px;font-size:14px;cursor:pointer;
  transition:all var(--dur-fast) var(--ease);
  -webkit-tap-highlight-color:transparent;
  font-family:inherit;
}
.voice-mic:active{transform:scale(0.92)}
.voice-mic:disabled{opacity:0.4;pointer-events:none}
.voice-mic[data-recording="1"]{
  background:var(--g-dng)!important;color:#fff!important;border-color:var(--dng);
  animation:voice-rec 1s infinite;
}
@keyframes voice-rec{
  0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)}
  50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}
}
.voice-list{display:flex;flex-direction:column;gap:4px;margin-top:4px;margin-bottom:10px}
.voice-note{
  display:flex;align-items:center;gap:8px;padding:6px 10px;
  background:var(--bg-3);border-radius:8px;font-size:11px;
}
.voice-play,.voice-del{
  border:none;background:transparent;cursor:pointer;
  font-size:14px;padding:2px 4px;border-radius:4px;
  -webkit-tap-highlight-color:transparent;color:var(--fg);
}
.voice-play:active,.voice-del:active{background:var(--bg-4)}
.voice-meta{color:var(--fg-2);font-family:var(--mono);font-size:10px;min-width:60px}
.voice-author{flex:1;color:var(--fg-2);font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
EOF_CSS
echo "✅ public/style.css (+voice styles)"
else
echo "ℹ️  public/style.css already has voice styles"
fi

# ═══════════════════════════════════════════════════════════
#  PATCH 3 — public/index.html (add script tags)
# ═══════════════════════════════════════════════════════════
node << 'EOF_NODE_HTML'
const fs = require('fs');
const F = 'public/index.html';
let src = fs.readFileSync(F, 'utf8');
if (src.includes('/voice.js')) { console.log('ℹ️  index.html already patched'); process.exit(0); }
const from = '<script src="/extra.js"></script>';
const to   = '<script src="/extra.js"></script>\n<script src="/voice.js"></script>\n<script src="/voice-init.js"></script>';
if (!src.includes(from)) { console.error('❌ anchor not found in index.html'); process.exit(1); }
src = src.replace(from, to);
fs.writeFileSync(F, src);
console.log('✅ public/index.html (+2 script tags)');
EOF_NODE_HTML

# ═══════════════════════════════════════════════════════════
#  PATCH 4 — public/sw.js (bump cache + add to STATIC)
# ═══════════════════════════════════════════════════════════
node << 'EOF_NODE_SW'
const fs = require('fs');
const F = 'public/sw.js';
let src = fs.readFileSync(F, 'utf8');

const vMatch = src.match(/const CACHE = 'nabz-v(\d+)';/);
if (!vMatch) { console.error('❌ CACHE pattern not found'); process.exit(1); }
const oldV = parseInt(vMatch[1]);
const newV = oldV + 1;
src = src.replace(vMatch[0], "const CACHE = 'nabz-v" + newV + "';");

if (!src.includes('/voice.js')) {
  const staticMatch = src.match(/const STATIC = \[([^\]]+)\];/);
  if (staticMatch) {
    src = src.replace(staticMatch[0], staticMatch[0].replace(']', ", '/voice.js', '/voice-init.js']"));
    console.log('✅ public/sw.js: STATIC + /voice.js + /voice-init.js');
  }
} else {
  console.log('ℹ️  public/sw.js: STATIC already updated');
}
console.log('✅ public/sw.js: cache v' + oldV + ' → v' + newV);
fs.writeFileSync(F, src);
EOF_NODE_SW

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ نصب کامل شد"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📁 فایل‌های جدید:"
echo "   modules/voice_notes.js   ← ماژول بک‌اند (۷ روت)"
echo "   public/voice.js           ← کلاس ضبط صدا"
echo "   public/voice-init.js      ← پچ بدون تغییر extra.js"
echo "   data/_voice/              ← دایرکتوری فایل‌های صوتی"
echo ""
echo "✏️  فایل‌های پچ‌شده:"
echo "   core/permissions-extra.js (+۳ مجوز)"
echo "   public/style.css          (+استایل voice)"
echo "   public/index.html         (+۲ script tag)"
echo "   public/sw.js              (bump cache + STATIC)"
echo ""
echo "📦 Backup: $BACKUP_DIR"
echo ""
echo "🔄 مرحله بعد:"
echo "  pkill -9 -f 'core/server.js' 2>/dev/null || true"
echo "  sleep 1"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
echo ""
echo "  انتظار:"
echo "    📦 voice_notes (7)"
echo "    📡 236 routes · 23 modules"
echo ""
echo "  مرورگر: Hard Reload (Ctrl+Shift+R)"
echo "  لاگین:  admin / nabz@2026"
echo ""
