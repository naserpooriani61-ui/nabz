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
