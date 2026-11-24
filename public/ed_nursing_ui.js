// public/ed_nursing_ui.js — Superhuman ED Nursing Worklist
(function() {
  'use strict';
  async function apiCall(url, opts = {}) {
    if (typeof NABZ !== 'undefined' && typeof NABZ._api === 'function') return NABZ._api(url, opts);
    const res = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, ...opts });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || err.message || res.statusText); }
    return res.json();
  }

  if (!document.getElementById('ed-nursing-style')) {
    const st = document.createElement('style');
    st.id = 'ed-nursing-style';
    st.textContent = `
      .nursing-wrap { direction: rtl; font-family: 'Vazirmatn', Tahoma, sans-serif; background: var(--kx-bg, #f8fafc); min-height: 100vh; padding: 16px; }
      .nursing-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
      .n-card { background: var(--kx-surface, #fff); border-radius: 12px; border: 1px solid var(--kx-border, #e2e8f0); overflow: hidden; margin-bottom: 16px; }
      .n-row { padding: 14px; border-bottom: 1px solid #e2e8f0; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: background 0.2s; }
      .n-row:hover { background: #f8fafc; }
      .n-row:last-child { border-bottom: none; }
      .esi-badge { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; font-size: 16px; flex-shrink: 0; }
      .btn-kardex { padding: 8px 16px; border-radius: 8px; border: none; background: #1e40af; color: #fff; font-weight: 700; font-size: 12px; cursor: pointer; }
    `;
    document.head.appendChild(st);
  }

  async function show() {
    renderWorklist();
  }

  async function renderWorklist() {
    var host = document.getElementById('content');
    if (!host) return;
    host.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b;direction:rtl">در حال بارگذاری فضای کار پرستاری...</div>';
    try {
      var res = await apiCall('/api/emergency/board');
      var all = res.rows || [];
      var groups = {
        in_treatment: { label: '💉 در حال درمان', items: all.filter(function(r){ return r.status === 'in_treatment'; }) },
        observation: { label: '👁️ تحت مشاهده', items: all.filter(function(r){ return r.status === 'observation'; }) },
        boarding: { label: '🛏️ منتظر پذیرش/تخت', items: all.filter(function(r){ return r.status === 'boarding'; }) }
      };
      
      var h = '<div class="nursing-wrap">';
      h += '<div class="nursing-header">';
      h += '<div style="font-size:18px;font-weight:900;color:#059669">💉 فضای کار پرستاری اورژانس</div>';
      h += '<button onclick="NABZ.show(\'ed_nursing\')" style="padding:8px 16px;border-radius:8px;border:1px solid #d1fae5;background:#ecfdf5;color:#065f46;font-weight:700;font-size:12px;cursor:pointer">⟳ بروزرسانی</button>';
      h += '</div>';
      
      h += '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px;margin-bottom:16px;font-size:13px;color:#1e40af;line-height:1.6">';
      h += '💡 <b>راهنمای بالینی:</b> برای ثبت دارو (MAR)، علائم حیاتی و مشاهده دستورات پزشک، روی بیمار کلیک کنید تا <b>کاردکس یکپارچه</b> همان ویزیت باز شود. این استاندارد ایمنی بیمار (Mayo Clinic) است.';
      h += '</div>';

      var total = 0;
      Object.keys(groups).forEach(function(k){ total += groups[k].items.length; });
      
      if (total === 0) {
        h += '<div class="n-card" style="padding:40px;text-align:center;color:#64748b">';
        h += '<div style="font-size:40px;margin-bottom:12px">✅</div><div style="font-weight:700">هیچ بیماری در حال درمان یا مشاهده نیست</div></div>';
      } else {
        Object.keys(groups).forEach(function(k) {
          var g = groups[k];
          if (!g.items.length) return;
          h += '<div style="font-size:13px;font-weight:800;color:#475569;margin-bottom:8px;padding:0 4px">' + g.label + ' (' + g.items.length + ')</div>';
          h += '<div class="n-card">';
          g.items.forEach(function(r) {
            var esiColor = r.esiLevel === 1 ? '#dc2626' : r.esiLevel === 2 ? '#ea580c' : r.esiLevel === 3 ? '#ca8a04' : r.esiLevel === 4 ? '#16a34a' : '#3b82f6';
            var newsBadge = '';
            if (r.news2) {
              var nc = r.news2.risk === 'critical' ? 'background:#fee2e2;color:#991b1b' : r.news2.risk === 'high' ? 'background:#fed7aa;color:#9a3412' : 'background:#f1f5f9;color:#334155';
              newsBadge = '<span style="font-size:10px;padding:2px 8px;border-radius:8px;font-weight:700;' + nc + '">NEWS ' + r.news2.total + '</span>';
            }
            
            h += '<div class="n-row" onclick="NABZ._edNursingOpenKardex(\'' + r.id + '\', \'' + (r.patientId || '') + '\')">';
            h += '<div class="esi-badge" style="background:' + esiColor + '">' + (r.esiLevel || '?') + '</div>';
            h += '<div style="flex:1;min-width:0">';
            h += '<div style="font-weight:800;font-size:14px;color:#0f172a">' + (r.patientName || 'ناشناس') + '</div>';
            h += '<div style="font-size:12px;color:#64748b;margin-top:2px">' + (r.chiefComplaint || '—') + ' · تخت: ' + (r.bedCode || '—') + '</div>';
            h += '<div style="margin-top:4px">' + newsBadge + '</div>';
            h += '</div>';
            h += '<button class="btn-kardex">مشاهده کاردکس</button>';
            h += '</div>';
          });
          h += '</div>';
        });
      }
      h += '</div>';
      host.innerHTML = h;
    } catch(e) {
      host.innerHTML = '<div style="padding:40px;text-align:center;color:#dc2626;direction:rtl">خطا در بارگذاری: ' + (e.message || e) + '</div>';
    }
  }

  window.NABZ = window.NABZ || {};
  
  // هدایت مستقیم به کاردکس برای ثبت بالینی (رعایت اصل نمای واحد بیمار)
  window.NABZ._edNursingOpenKardex = function(visitId, patientId) {
    // اگر سیستم ناوبری NABZ از پارامتر دوم برای visitId پشتیبانی می‌کند:
    if (typeof NABZ.show === 'function') {
      // فرض بر این است که kardex_ui می‌تواند با visitId یا patientId کار کند.
      // در معماری ED، visitId اولویت دارد.
      NABZ.show('kardex', visitId || patientId);
    } else {
      // Fallback به تغییر URL
      window.location.href = '?view=kardex&visitId=' + encodeURIComponent(visitId);
    }
  };

  if (typeof NABZ !== 'undefined' && typeof NABZ.registerKind === 'function') {
    NABZ.registerKind('ed_nursing', show);
  }
})();
