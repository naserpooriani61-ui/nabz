(function() {
  'use strict';
  if (window.__patientPicker) return;
  window.__patientPicker = true;

  async function pick(opts) {
    opts = opts || {};
    var pts;
    try {
      var r = await NABZ._api('/api/clinical/patients');
      pts = (r.items || r || []).filter(function(p) {
        return p.status !== 'discharged' && p.status !== 'transferred';
      });
    } catch (e) {
      alert('خطا در بارگذاری بیماران: ' + ((e && e.message) || e));
      return null;
    }

    if (!pts.length) {
      alert('بیمار فعالی وجود ندارد');
      return null;
    }

    if (pts.length === 1) return pts[0];

    return new Promise(function(resolve) {
      if (!document.getElementById('ppicker-style')) {
        var st = document.createElement('style');
        st.id = 'ppicker-style';
        st.textContent = '.ppk-overlay{position:fixed;inset:0;background:rgba(15,23,42,.65);z-index:100002;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;direction:rtl;font-family:Vazirmatn,Tahoma,sans-serif;padding:20px;box-sizing:border-box}'
          + '.ppk-overlay.open{opacity:1}'
          + '.ppk{background:#fff;border-radius:16px;max-width:520px;width:100%;max-height:80vh;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35);transform:scale(.95);transition:transform .2s;display:flex;flex-direction:column}'
          + '.ppk-overlay.open .ppk{transform:scale(1)}'
          + '.ppk-hd{background:linear-gradient(135deg,#1e4d8c,#0f172a);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}'
          + '.ppk-hd-icon{font-size:22px}'
          + '.ppk-hd-t{flex:1;font-size:14px;font-weight:900}'
          + '.ppk-search{padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0}'
          + '.ppk-input{width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-family:inherit;direction:rtl;outline:none;box-sizing:border-box}'
          + '.ppk-input:focus{border-color:#1e4d8c;box-shadow:0 0 0 3px rgba(30,77,140,.1)}'
          + '.ppk-list{flex:1;overflow-y:auto;padding:8px}'
          + '.ppk-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background .15s;border:1px solid transparent}'
          + '.ppk-row:hover{background:#f1f5f9;border-color:#e2e8f0}'
          + '.ppk-row-ico{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#60a5fa,#3b82f6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;flex-shrink:0}'
          + '.ppk-row-b{flex:1;min-width:0}'
          + '.ppk-row-name{font-size:13px;font-weight:800;color:#0f172a}'
          + '.ppk-row-sub{font-size:10.5px;color:#64748b;margin-top:2px}'
          + '.ppk-empty{text-align:center;padding:40px;color:#94a3b8;font-size:12px}'
          + '.ppk-ft{padding:8px 16px 14px;border-top:1px solid #e2e8f0;background:#fff}'
          + '.ppk-btn{padding:10px 16px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;width:100%}';
        document.head.appendChild(st);
      }

      var ov = document.createElement('div');
      ov.className = 'ppk-overlay';
      var h = '<div class="ppk">';
      h += '<div class="ppk-hd"><div class="ppk-hd-icon">👤</div><div class="ppk-hd-t">' + (opts.title || 'انتخاب بیمار') + '</div></div>';
      h += '<div class="ppk-search"><input type="text" class="ppk-input" id="ppk-q" placeholder="جستجو: نام، MRN، تخت، بخش..."></div>';
      h += '<div class="ppk-list" id="ppk-list"></div>';
      h += '<div class="ppk-ft"><button class="ppk-btn" id="ppk-cancel">انصراف</button></div>';
      h += '</div>';
      ov.innerHTML = h;
      document.body.appendChild(ov);
      requestAnimationFrame(function() { ov.classList.add('open'); });

      var list = ov.querySelector('#ppk-list');
      var input = ov.querySelector('#ppk-q');

      function render(filter) {
        var q = (filter || '').toLowerCase().trim();
        var filtered = !q ? pts : pts.filter(function(p) {
          var name = ((p.firstName || '') + ' ' + (p.lastName || '')).toLowerCase();
          return name.indexOf(q) >= 0 || (p.mrn || '').toLowerCase().indexOf(q) >= 0
            || (p.bedNumber || '').toLowerCase().indexOf(q) >= 0
            || (p.wardCode || '').toLowerCase().indexOf(q) >= 0
            || (p.id || '').toLowerCase().indexOf(q) >= 0;
        });
        if (!filtered.length) {
          list.innerHTML = '<div class="ppk-empty">هیچ بیماری پیدا نشد</div>';
          return;
        }
        list.innerHTML = filtered.map(function(p, i) {
          var name = ((p.firstName || '') + ' ' + (p.lastName || '')).trim() || p.id;
          var initial = (p.firstName || '?').charAt(0);
          var sub = [];
          if (p.age) sub.push(p.age + ' سال');
          if (p.sex) sub.push(p.sex === 'male' ? 'مرد' : 'زن');
          if (p.wardCode) sub.push(p.wardCode);
          if (p.bedNumber) sub.push('تخت ' + p.bedNumber);
          return '<div class="ppk-row" data-id="' + esc(p.id) + '">'
            + '<div class="ppk-row-ico">' + esc(initial) + '</div>'
            + '<div class="ppk-row-b"><div class="ppk-row-name">' + esc(name) + '</div>'
            + '<div class="ppk-row-sub">' + esc(sub.join(' · ')) + '</div></div></div>';
        }).join('');
        list.querySelectorAll('.ppk-row').forEach(function(row) {
          row.onclick = function() {
            var id = row.getAttribute('data-id');
            var pt = pts.find(function(x) { return x.id === id; });
            ov.classList.remove('open');
            setTimeout(function() { ov.remove(); }, 200);
            resolve(pt);
          };
        });
      }

      function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

      input.addEventListener('input', function() { render(input.value); });
      render('');
      setTimeout(function() { input.focus(); }, 350);

      ov.querySelector('#ppk-cancel').onclick = function() {
        ov.classList.remove('open');
        setTimeout(function() { ov.remove(); }, 200);
        resolve(null);
      };
    });
  }

  if (window.NABZ) NABZ.patientPicker = pick;
  else { var iv = setInterval(function() { if (window.NABZ) { clearInterval(iv); NABZ.patientPicker = pick; } }, 100); }

  console.log('[patient_picker] ready');
})();
