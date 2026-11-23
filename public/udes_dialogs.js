(function() {
  'use strict';
  if (window.__udesDialogs) return;
  window.__udesDialogs = true;

  if (!document.getElementById('udes-dialogs-style')) {
    var st = document.createElement('style');
    st.id = 'udes-dialogs-style';
    st.textContent = '.udlg-overlay{position:fixed;inset:0;background:rgba(15,23,42,.65);z-index:100001;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;direction:rtl;font-family:Vazirmatn,Tahoma,sans-serif;padding:20px;box-sizing:border-box}'
      + '.udlg-overlay.open{opacity:1}'
      + '.udlg{background:#fff;border-radius:16px;max-width:480px;width:100%;max-height:85vh;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35);transform:scale(.95);transition:transform .2s;display:flex;flex-direction:column}'
      + '.udlg-overlay.open .udlg{transform:scale(1)}'
      + '.udlg-hd{background:linear-gradient(135deg,#1e4d8c,#0f172a);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0}'
      + '.udlg-hd-icon{font-size:22px}'
      + '.udlg-hd-title{flex:1;font-size:14px;font-weight:900;line-height:1.3}'
      + '.udlg-hd-sub{font-size:10.5px;opacity:.85;margin-top:2px;font-weight:600}'
      + '.udlg-body{padding:14px 16px;overflow-y:auto;flex:1;background:#f8fafc}'
      + '.udlg-pick-grid{display:grid;gap:8px}'
      + '.udlg-pick-btn{padding:14px;border-radius:12px;border:2px solid #e2e8f0;background:#fff;cursor:pointer;display:flex;align-items:center;gap:12px;transition:all .15s;font-family:inherit;text-align:right}'
      + '.udlg-pick-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.08)}'
      + '.udlg-pick-btn:active{transform:scale(.98)}'
      + '.udlg-pick-icon{font-size:22px;flex-shrink:0}'
      + '.udlg-pick-label{flex:1;font-size:13px;font-weight:800;color:#0f172a}'
      + '.udlg-pick-hint{font-size:10px;color:#64748b;font-weight:600;margin-top:2px}'
      + '.udlg-field{margin-bottom:10px}'
      + '.udlg-field label{display:block;font-size:11px;font-weight:700;margin-bottom:4px;color:#475569}'
      + '.udlg-input,.udlg-select,.udlg-textarea{width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-family:inherit;background:#fff;color:#0f172a;box-sizing:border-box;direction:rtl;outline:none;transition:border-color .15s}'
      + '.udlg-input:focus,.udlg-select:focus,.udlg-textarea:focus{border-color:#1e4d8c;box-shadow:0 0 0 3px rgba(30,77,140,.1)}'
      + '.udlg-textarea{resize:vertical;min-height:60px}'
      + '.udlg-ft{padding:10px 16px 14px;background:#fff;border-top:1px solid #e2e8f0;display:flex;gap:8px;flex-shrink:0}'
      + '.udlg-btn{flex:1;padding:12px;border:none;border-radius:10px;font-size:13px;font-weight:800;font-family:inherit;cursor:pointer;transition:all .15s}'
      + '.udlg-btn.primary{background:#1e4d8c;color:#fff}'
      + '.udlg-btn.primary:active{background:#163a6b}'
      + '.udlg-btn.secondary{background:#f1f5f9;color:#475569;flex:0.5}';
    document.head.appendChild(st);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  function createOverlay(html) {
    var ov = document.createElement('div');
    ov.className = 'udlg-overlay';
    ov.innerHTML = '<div class="udlg">' + html + '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function() { ov.classList.add('open'); });
    return ov;
  }

  function closeAll() {
    document.querySelectorAll('.udlg-overlay').forEach(function(el) {
      el.classList.remove('open');
      setTimeout(function() { el.remove(); }, 200);
    });
  }

  function pick(cfg) {
    return new Promise(function(resolve) {
      var c = cfg || {};
      var h = '<div class="udlg-hd">' + (c.icon ? '<div class="udlg-hd-icon">' + esc(c.icon) + '</div>' : '');
      h += '<div class="udlg-hd-title">' + esc(c.title || 'انتخاب') + (c.subtitle ? '<div class="udlg-hd-sub">' + esc(c.subtitle) + '</div>' : '') + '</div></div>';
      h += '<div class="udlg-body"><div class="udlg-pick-grid">';
      (c.options || []).forEach(function(o, i) {
        var border = o.color ? 'border-color:' + o.color + '55;' : '';
        h += '<button class="udlg-pick-btn" data-idx="' + i + '" style="' + border + '">';
        h += '<div class="udlg-pick-icon">' + esc(o.icon || '•') + '</div>';
        h += '<div class="udlg-pick-label">' + esc(o.label) + (o.hint ? '<div class="udlg-pick-hint">' + esc(o.hint) + '</div>' : '') + '</div>';
        h += '</button>';
      });
      h += '</div></div><div class="udlg-ft"><button class="udlg-btn secondary" data-act="cancel">' + esc(c.cancelLabel || 'انصراف') + '</button></div>';
      var ov = createOverlay(h);
      ov.querySelectorAll('.udlg-pick-btn').forEach(function(btn) {
        btn.onclick = function() { closeAll(); resolve(c.options[Number(btn.getAttribute('data-idx'))]); };
      });
      ov.querySelector('[data-act="cancel"]').onclick = function() { closeAll(); resolve(null); };
    });
  }

  function form(cfg) {
    return new Promise(function(resolve) {
      var c = cfg || {};
      var h = '<div class="udlg-hd">' + (c.icon ? '<div class="udlg-hd-icon">' + esc(c.icon) + '</div>' : '');
      h += '<div class="udlg-hd-title">' + esc(c.title || 'فرم') + '</div></div>';
      h += '<div class="udlg-body">';
      (c.fields || []).forEach(function(f) {
        h += '<div class="udlg-field"><label>' + esc(f.label) + (f.required ? ' <span style="color:#ef4444">*</span>' : '') + '</label>';
        if (f.type === 'select') {
          h += '<select class="udlg-select" data-k="' + esc(f.key) + '"><option value="">—</option>';
          (f.options || []).forEach(function(o) {
            var v = (typeof o === 'object') ? o.value : o;
            var lbl = (typeof o === 'object') ? o.label : o;
            h += '<option value="' + esc(v) + '">' + esc(lbl) + '</option>';
          });
          h += '</select>';
        } else if (f.type === 'textarea') {
          h += '<textarea class="udlg-textarea" data-k="' + esc(f.key) + '" rows="' + (f.rows || 3) + '"></textarea>';
        } else {
          h += '<input class="udlg-input" data-k="' + esc(f.key) + '" type="' + (f.type || 'text') + '"' + (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') + '>';
        }
        h += '</div>';
      });
      h += '</div><div class="udlg-ft"><button class="udlg-btn secondary" data-act="cancel">انصراف</button>';
      h += '<button class="udlg-btn primary" data-act="submit">' + esc(c.submitLabel || 'تأیید') + '</button></div>';
      var ov = createOverlay(h);
      ov.querySelector('[data-act="cancel"]').onclick = function() { closeAll(); resolve(null); };
      ov.querySelector('[data-act="submit"]').onclick = function() {
        var data = {}, errs = [];
        (c.fields || []).forEach(function(f) {
          var el = ov.querySelector('[data-k="' + f.key + '"]');
          var v = el ? el.value.trim() : '';
          if (f.required && !v) { errs.push(f.label); el.style.borderColor = '#ef4444'; }
          else if (v) data[f.key] = v;
        });
        if (errs.length) { alert('فیلدهای اجباری: ' + errs.join('، ')); return; }
        closeAll();
        resolve(data);
      };
    });
  }

  function confirm(msg, opts) {
    return new Promise(function(resolve) {
      var o = opts || {};
      var h = '<div class="udlg-hd"><div class="udlg-hd-icon">' + (o.icon || '❓') + '</div><div class="udlg-hd-title">' + esc(o.title || 'تأیید') + '</div></div>';
      h += '<div class="udlg-body" style="text-align:center;padding:24px 16px"><div style="font-size:13px;line-height:1.6">' + esc(msg) + '</div></div>';
      h += '<div class="udlg-ft"><button class="udlg-btn secondary" data-act="no">' + esc(o.noLabel || 'خیر') + '</button><button class="udlg-btn primary" data-act="yes">' + esc(o.yesLabel || 'بله') + '</button></div>';
      var ov = createOverlay(h);
      ov.querySelector('[data-act="no"]').onclick = function() { closeAll(); resolve(false); };
      ov.querySelector('[data-act="yes"]').onclick = function() { closeAll(); resolve(true); };
    });
  }

  if (window.NABZ) NABZ.dialog = { pick: pick, form: form, confirm: confirm };
  else { var iv = setInterval(function() { if (window.NABZ) { clearInterval(iv); NABZ.dialog = { pick: pick, form: form, confirm: confirm }; } }, 100); }

  console.log('[udes_dialogs] ready');
})();
