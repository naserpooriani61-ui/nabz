// ═══════════════════════════════════════════════════════════
//  NABZ Documents — Print, Share, Viewer
// ═══════════════════════════════════════════════════════════


// ─── Interactive Views (Kardex, MAR) ───
NABZ.openKardexInteractive = function(patientId) {
  var b = document.querySelector('.bs-backdrop');
  if (b) b.remove();
  if (!patientId) return;
  try { history.replaceState(null, '', '/kind/kardex?patientId=' + encodeURIComponent(patientId)); } catch(_) {}
  if (typeof NABZ.show === 'function') NABZ.show('kardex', { patientId: patientId });
};

NABZ.openMarInteractive = function(patientId) {
  var b = document.querySelector('.bs-backdrop');
  if (b) b.remove();
  if (!patientId) return;
  try { history.replaceState(null, '', '/kind/mar_patient?patientId=' + encodeURIComponent(patientId)); } catch(_) {}
  if (typeof NABZ.show === 'function') NABZ.show('mar_patient', { patientId: patientId });
};

NABZ.openDoc = async function(type, paramValue) {
  try {
    NABZ._toast('در حال آماده‌سازی...');
    const doc = await NABZ._api('/api/docs/' + type + '/' + paramValue);
    NABZ._showDocViewer(doc.html, doc.title);
  } catch (e) {
    alert('خطا: ' + e.message);
  }
};

NABZ._showDocViewer = function(html, title) {
  const sheet = document.createElement('div');
  sheet.className = 'bs-backdrop';
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };

  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">📄 ' + NABZ._esc(title) + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div style="display:flex;gap:8px;margin-bottom:14px">';
  h += '<button class="btn btn-primary" style="flex:1;padding:12px" onclick="NABZ._printDoc(\'' + encodeURIComponent(html) + '\')">🖨️ چاپ / PDF</button>';
  h += '<button class="btn" style="flex:1;padding:12px" onclick="NABZ._shareDoc(\'' + encodeURIComponent(html) + '\',\'' + encodeURIComponent(title) + '\')">📤 اشتراک</button>';
  h += '</div>';
  h += '<div style="background:#fff;border-radius:8px;overflow:hidden;max-height:60vh;overflow-y:auto">';
  h += '<iframe id="docPreview" style="width:100%;height:60vh;border:none" srcdoc="' + html.replace(/"/g, '&quot;') + '"></iframe>';
  h += '</div>';

  const c = document.createElement('div');
  c.className = 'bs-sheet';
  c.style.maxHeight = '95vh';
  c.innerHTML = h;
  sheet.appendChild(c);
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('show'));
};

NABZ._printDoc = function(encodedHtml) {
  const html = decodeURIComponent(encodedHtml);
  const w = window.open('', '_blank');
  if (!w) { alert('پاپ‌آپ مسدود است'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    try { w.focus(); w.print(); } catch (_) { alert('لطفاً Ctrl+P بزنید'); }
  }, 600);
};

NABZ._shareDoc = async function(encodedHtml, encodedTitle) {
  const html = decodeURIComponent(encodedHtml);
  const title = decodeURIComponent(encodedTitle);
  try {
    if (navigator.share) {
      // Try file share first (for real PDF/text)
      const blob = new Blob([html], { type: 'text/html' });
      const file = new File([blob], title.replace(/\s+/g, '_') + '.html', { type: 'text/html' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: title });
        return;
      }
      // Fallback: text share
      await navigator.share({ title: title, text: 'سند از سیستم نبض — بیمارستان سینا' });
    } else {
      // Fallback: copy title to clipboard
      await navigator.clipboard.writeText(title + '\n\n' + html.slice(0, 500) + '...');
      NABZ._toast('لینک در کلیپ‌بورد کپی شد');
    }
  } catch (e) {
    if (e.name !== 'AbortError') NABZ._toast('اشتراک ممکن نشد');
  }
};

NABZ._toast = function(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:calc(var(--nav-h) + 20px);left:50%;transform:translateX(-50%);background:var(--bg-elev);color:var(--fg);padding:10px 20px;border-radius:24px;box-shadow:var(--sh-lg);font-size:13px;font-weight:800;z-index:9999;border:1px solid var(--border-2);pointer-events:none';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
};

// ─── Interactive Views ───
NABZ.openKardexInteractive = function(patientId) {
  var b = document.querySelector('.bs-backdrop');
  if (b) b.remove();
  if (!patientId) return;
  try { history.replaceState(null, '', '/kind/kardex?patientId=' + encodeURIComponent(patientId)); } catch(_) {}
  if (typeof NABZ.show === 'function') NABZ.show('kardex', { patientId: patientId });
};

NABZ.openMarInteractive = function(patientId) {
  var b = document.querySelector('.bs-backdrop');
  if (b) b.remove();
  if (!patientId) return;
  try { history.replaceState(null, '', '/kind/mar_v2?patientId=' + encodeURIComponent(patientId)); } catch(_) {}
  if (typeof NABZ.show === 'function') NABZ.show('mar_v2', { patientId: patientId });
};
