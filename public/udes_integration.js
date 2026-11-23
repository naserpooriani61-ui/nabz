// public/udes_integration.js — Quick data entry bars for any view
(function() {
  'use strict';
  if (window.__udesIntegration) return;
  window.__udesIntegration = true;

  if (!document.getElementById('udes-integ-bar-style')) {
    var st = document.createElement('style');
    st.id = 'udes-integ-bar-style';
    st.textContent =
      '.udes-qbar{display:grid;grid-template-columns:repeat(auto-fit,minmax(72px,1fr));gap:6px;margin:10px 0;direction:rtl}' +
      '.udes-qbar button{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 4px;font-family:inherit;font-size:10px;font-weight:800;color:#0f172a;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;transition:all .15s;box-shadow:0 1px 3px rgba(15,23,42,.06)}' +
      '.udes-qbar button:active{transform:scale(.96);background:#f8fafc}' +
      '.udes-qbar button .qbar-ico{font-size:18px}' +
      '.udes-qbar button .qbar-lbl{font-size:9.5px;color:#475569;font-weight:700}' +
      '.udes-qbar-hd{font-size:11px;color:#64748b;font-weight:800;margin-bottom:6px;direction:rtl}';
    document.head.appendChild(st);
  }

  function getRole() {
    try { return NABZ.state && NABZ.state.user && NABZ.state.user.role; } catch(_) { return null; }
  }

  // Build the quick bar HTML for a given patient
  function buildQuickBar(patientId, opts) {
    opts = opts || {};
    var role = getRole();
    var isNurse = ['nurse','head_nurse','nurse_aide','midwife','supervisor_clinical','supervisor_er'].indexOf(role) >= 0;
    var isDoc = ['physician','resident','attending','specialist','intern','anesthesiologist'].indexOf(role) >= 0;
    var pid = String(patientId || '').replace(/'/g, "\\'");

    var btns = [];
    if (isNurse || isDoc) {
      btns.push({ icon: '💉', label: 'vitals', form: 'vitals' });
      btns.push({ icon: '💧', label: 'I&O', form: 'io' });
      btns.push({ icon: '📝', label: 'یادداشت', form: 'nursing-note' });
    }
    if (isDoc) {
      btns.push({ icon: '📋', label: 'سفارش', form: 'order' });
      btns.push({ icon: '🩺', label: 'مشاوره', form: 'consult' });
      btns.push({ icon: '🔄', label: 'انتقال', form: 'transfer' });
      btns.push({ icon: '🚪', label: 'ترخیص', form: 'discharge' });
      btns.push({ icon: '🩸', label: 'خون', form: 'blood-request' });
    }
    if (!btns.length) return '';

    var h = '';
    if (!opts.bare) h += '<div class="udes-qbar-hd">📋 ثبت سریع</div>';
    h += '<div class="udes-qbar">';
    btns.forEach(function(b) {
      h += '<button onclick="NABZ.udesQuickOpen(\'' + b.form + '\',\'' + pid + '\')">' +
        '<span class="qbar-ico">' + b.icon + '</span>' +
        '<span class="qbar-lbl">' + b.label + '</span>' +
        '</button>';
    });
    h += '</div>';
    return h;
  }

  // Open form with patient context
  function quickOpen(formId, patientId) {
    var ctx = { patientId: patientId };
    try {
      if (NABZ.state && Array.isArray(NABZ.state.patients)) {
        var pt = NABZ.state.patients.find(function(x) { return x.id === patientId; });
        if (pt) {
          ctx.patientName = ((pt.firstName || '') + ' ' + (pt.lastName || '')).trim();
          ctx.wardCode = pt.wardCode;
          ctx.bedNumber = pt.bedNumber;
        }
      }
    } catch (e) {}
    if (window.NABZ && typeof NABZ.openForm === 'function') {
      NABZ.openForm(formId, ctx, function() {
        // on success: refresh current view
        try {
          if (typeof NABZ._kxReload === 'function') NABZ._kxReload();
          else if (typeof NABZ.refresh === 'function') NABZ.refresh();
        } catch (e) {}
      });
    } else {
      alert('UDES بارگذاری نشده — صفحه را refresh کنید');
    }
  }

  // Expose
  if (window.NABZ) {
    NABZ.udesQuickBar = buildQuickBar;
    NABZ.udesQuickOpen = quickOpen;
  } else {
    var iv = setInterval(function() {
      if (window.NABZ) {
        clearInterval(iv);
        NABZ.udesQuickBar = buildQuickBar;
        NABZ.udesQuickOpen = quickOpen;
      }
    }, 100);
  }

  console.log('[udes_integration] ready');
})();
