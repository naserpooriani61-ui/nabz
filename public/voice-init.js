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
