
// ═══════════════════════════════════════════════════════════
//  NABZ — Competency UI
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  const CAT_FA = {
    resuscitation:'احیای قلبی-ریوی', infection:'کنترل عفونت', medication:'ایمنی دارویی',
    clinical:'مهارت بالینی', documentation:'مستندسازی', emergency:'اورژانس',
    soft:'مهارت نرم', teaching:'تدریس و پرسپتوری'
  };
  const CAT_ICON = {
    resuscitation:'🫀', infection:'🧼', medication:'💊', clinical:'🩺',
    documentation:'📝', emergency:'🚨', soft:'🤝', teaching:'🎓'
  };
  const STATUS_FA = { valid:'معتبر', expiring_soon:'نزدیک انقضا', expired:'منقضی', missing:'ثبت نشده' };
  const STATUS_CLS = { valid:'ok', expiring_soon:'warn', expired:'dng', missing:'dng' };
  const LEVEL_FA = { novice:'نوآموز', competent:'شایسته', proficient:'ماهر', expert:'خبره' };
  const METHOD_FA = { test:'آزمون', simulation:'شبیه‌سازی', preceptor_signoff:'تأیید پرسپتور', annual_renewal:'تمدید سالانه', peer_review:'بازبینی همتا', audit:'ممیزی' };

  const C = {
    _api: (p, o) => NABZ._api(p, o),
    _esc: s => NABZ._esc(s),
    _closeAll() { document.querySelectorAll('.bs-backdrop').forEach(el => el.remove()); },
    _openSheet(html, opts) {
      opts = opts || {};
      const s = document.createElement('div');
      s.className = 'bs-backdrop';
      s.onclick = e => { if (e.target === s && !opts.noClose) s.remove(); };
      const c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '96vh';
      c.innerHTML = html;
      s.appendChild(c);
      document.body.appendChild(s);
      requestAnimationFrame(() => s.classList.add('show'));
      return { sheet: s, content: c };
    },
    _fmt(iso) {
      if (!iso) return '—';
      try { return new Date(iso).toLocaleDateString('fa-IR', { year:'2-digit', month:'2-digit', day:'2-digit' }); } catch (_) { return '—'; }
    },

    // ═══════════════════════════════════════════════════
    //  MY COMPETENCIES
    // ═══════════════════════════════════════════════════
    async showMy(p, d) {
      const m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) d = await C._api('/api/comp/my');
        C._renderMy(d);
      } catch (e) { m.innerHTML = '<div class="empty">خطا: ' + C._esc(e.message) + '</div>'; }
    },

    _renderMy(d) {
      const m = document.getElementById('content');
      const color = d.compliancePct >= 90 ? 'ok' : d.compliancePct >= 75 ? 'warn' : 'dng';

      let h = '<div class="sec-hd"><span>🎯 شایستگی‌های من</span>';
      h += '<span class="rd-mini">' + d.role + '</span></div>';

      // Overall
      h += '<div class="card" style="background:linear-gradient(135deg,rgba(6,182,212,.1),rgba(139,92,246,.05));margin-bottom:12px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center">';
      h += '<div>';
      h += '<div style="font-size:11px;color:var(--fg-2);font-weight:800">انطباق کلی</div>';
      h += '<div style="font-size:42px;font-weight:900;color:var(--' + color + ');line-height:1">' + d.compliancePct + '%</div>';
      h += '<div style="font-size:11px;color:var(--fg-2)">' + d.stats.ok + ' از ' + d.required + ' معتبر</div>';
      h += '</div>';
      h += '<div style="text-align:left;font-size:12px">';
      if (d.stats.critical > 0) h += '<div style="color:var(--dng);font-weight:900">🚨 ' + d.stats.critical + ' بحرانی</div>';
      if (d.stats.warning > 0) h += '<div style="color:var(--warn);font-weight:900">⚠️ ' + d.stats.warning + ' هشدار</div>';
      h += '</div></div></div>';

      // Group by category
      const byCat = {};
      d.items.forEach(i => {
        if (!byCat[i.category]) byCat[i.category] = [];
        byCat[i.category].push(i);
      });

      Object.keys(byCat).forEach(cat => {
        h += '<div class="sec-hd" style="margin-top:12px"><span>' + (CAT_ICON[cat] || '●') + ' ' + (CAT_FA[cat] || cat) + '</span></div>';
        byCat[cat].forEach(i => {
          const cls = STATUS_CLS[i.status] || 'info';
          h += '<div class="row ' + (i.status === 'valid' ? 'lo' : i.status === 'expiring_soon' ? 'md' : 'hi') + '" style="margin-bottom:4px;padding:10px 12px">';
          h += '<div class="row-hd">';
          h += '<div class="row-title" style="font-size:12.5px">' + C._esc(i.fa) + '</div>';
          h += '<span class="pill ' + cls + '">' + (STATUS_FA[i.status] || i.status) + '</span>';
          h += '</div>';
          h += '<div class="row-meta" style="font-size:10.5px">';
          if (i.verifiedAt) h += 'آخرین تأیید: ' + C._fmt(i.verifiedAt);
          if (i.method) h += ' · ' + (METHOD_FA[i.method] || i.method);
          if (i.level) h += ' · ' + (LEVEL_FA[i.level] || i.level);
          h += '</div>';
          if (i.expiresAt) {
            const expired = i.status === 'expired';
            const warn = i.status === 'expiring_soon';
            h += '<div class="row-meta" style="font-size:10.5px;color:' + (expired ? 'var(--dng)' : warn ? 'var(--warn)' : 'var(--fg-3)') + '">';
            h += (expired ? 'منقضی شده: ' : 'انقضا: ') + C._fmt(i.expiresAt);
            if (i.daysUntilExpiry != null) h += ' (' + i.daysUntilExpiry + ' روز)';
            h += '</div>';
          }
          // Actions
          h += '<div style="display:flex;gap:4px;margin-top:6px">';
          if (i.status !== 'valid') {
            h += '<button class="btn btn-sm" style="padding:4px 10px;font-size:10.5px;color:var(--primary);border-color:var(--primary)" onclick="event.stopPropagation();NABZ.compUI.selfRenew(\'' + i.code + '\')">🔄 تمدید</button>';
          }
          if (i.cert_body) h += '<span style="font-size:10px;color:var(--fg-3);font-family:monospace">' + i.cert_body + '</span>';
          h += '</div>';
          h += '</div>';
        });
      });

      if (d.extras.length) {
        h += '<div class="sec-hd" style="margin-top:14px"><span>⭐ اضافی (' + d.extras.length + ')</span></div>';
        d.extras.forEach(x => {
          h += '<div style="padding:6px 10px;font-size:11px;color:var(--fg-2)">' + C._esc(x.fa) + ' — ' + C._fmt(x.verifiedAt) + '</div>';
        });
      }

      m.innerHTML = h;
      NABZ.state.current = p ? p.id : 'competency_framework.my';
    },

    async selfRenew(code) {
      const scoreStr = prompt('نمره آزمون (حداقل ۸۰):', '85');
      if (!scoreStr) return;
      const score = parseFloat(scoreStr);
      if (isNaN(score) || score < 80) return alert('نمره < ۸۰ قابل قبول نیست');
      try {
        await C._api('/api/comp/self-renew', {
          method: 'POST', body: JSON.stringify({ code, method: 'test', score })
        });
        NABZ._toast('✅ تمدید شد');
        C.showMy(null, null);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  WARD GAPS
    // ═══════════════════════════════════════════════════
    async showWard(p, d) {
      const m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) d = await C._api('/api/comp/ward-gaps');
        C._renderWard(d);
      } catch (e) { m.innerHTML = '<div class="empty">خطا: ' + C._esc(e.message) + '</div>'; }
    },

    _renderWard(d) {
      const m = document.getElementById('content');
      const color = d.compliance >= 90 ? 'ok' : d.compliance >= 75 ? 'warn' : 'dng';

      let h = '<div class="sec-hd"><span>⚠️ شکاف‌های بخش — ' + C._esc(d.ward) + '</span>';
      h += '<span class="rd-mini">' + d.staffCount + ' پرسنل</span></div>';

      h += '<div class="card" style="background:linear-gradient(135deg,rgba(6,182,212,.1),rgba(139,92,246,.05));margin-bottom:12px">';
      h += '<div style="display:flex;justify-content:space-between">';
      h += '<div><div style="font-size:11px;color:var(--fg-2)">انطباق پرسنل</div>';
      h += '<div style="font-size:36px;font-weight:900;color:var(--' + color + ');line-height:1">' + d.compliance + '%</div></div>';
      h += '<div style="text-align:left">';
      h += '<div style="font-size:22px;font-weight:900">' + d.staffWithGaps + '</div>';
      h += '<div style="font-size:10px;color:var(--fg-2)">نفر با شکاف</div>';
      h += '</div></div>';
      h += '</div>';

      // Critical gaps
      if (d.criticalGaps.length) {
        h += '<div class="sec-hd" style="margin-top:12px"><span style="color:var(--dng)">🚨 شکاف بحرانی</span></div>';
        d.criticalGaps.slice(0, 8).forEach(g => {
          h += '<div class="card" style="border-color:var(--dng);margin-bottom:6px;padding:10px" onclick="NABZ.compUI.showGapDetail(\'' + g.code + '\')">';
          h += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
          h += '<div><div style="font-weight:900;font-size:12.5px">' + (CAT_ICON[g.category] || '●') + ' ' + C._esc(g.fa) + '</div>';
          h += '<div style="font-size:10px;color:var(--fg-2);margin-top:2px">criticality: ' + g.criticality + '/5</div></div>';
          h += '<div style="text-align:left"><div style="font-size:22px;font-weight:900;color:var(--dng);line-height:1">' + g.affected + '</div>';
          h += '<div style="font-size:9px;color:var(--fg-2)">نفر</div></div>';
          h += '</div></div>';
        });
      }

      // Staff with most gaps
      if (d.staffMissing.length) {
        h += '<div class="sec-hd" style="margin-top:12px"><span>👥 پرسنل با بیشترین شکاف</span></div>';
        d.staffMissing.slice(0, 10).forEach(s => {
          h += '<div class="row md" style="padding:8px 12px;margin-bottom:4px">';
          h += '<div class="row-hd"><div class="row-title" style="font-size:12px">' + C._esc(s.name) + '</div>';
          h += '<span class="pill ' + (s.gapCount > 5 ? 'dng' : 'warn') + '">' + s.gapCount + ' شکاف</span></div>';
          h += '<div class="row-meta" style="font-size:10.5px">' + s.role + ' · ' + s.requiredCount + ' نیاز</div>';
          h += '</div>';
        });
      }

      m.innerHTML = h;
    },

    async showGapDetail(code) {
      try {
        const d = await C._api('/api/comp/' + code);
        const w = await C._api('/api/comp/ward-gaps');
        const gap = w.items.find(i => i.code === code);
        if (!gap) return alert('یافت نشد');

        let h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">' + (CAT_ICON[d.competency.category] || '●') + ' ' + C._esc(d.competency.fa) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        h += '<div class="card" style="margin-bottom:12px">';
        h += '<div style="font-size:11px;color:var(--fg-2)">English: ' + C._esc(d.competency.en) + '</div>';
        h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">سطح مورد نیاز: ' + (LEVEL_FA[d.competency.level_required] || d.competency.level_required) + '</div>';
        if (d.competency.cert_body) h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">گواهی: ' + d.competency.cert_body + '</div>';
        if (d.competency.expiry_months) h += '<div style="font-size:11px;color:var(--fg-2)">اعتبار: ' + d.competency.expiry_months + ' ماه</div>';
        h += '<div style="font-size:11px;color:var(--fg-2);margin-top:4px">روش‌های تأیید: ' + d.competency.verification_methods.map(m => METHOD_FA[m] || m).join(' · ') + '</div>';
        h += '</div>';

        h += '<div class="sec-hd"><span>پرسنل با شکاف (' + gap.affected + ')</span></div>';
        gap.staffList.slice(0, 20).forEach(name => {
          h += '<div style="padding:6px 10px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;font-size:11.5px">' + C._esc(name) + '</div>';
        });

        h += '<div style="margin-top:12px;margin-bottom:20px"><button class="btn btn-block" style="padding:10px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button></div>';
        C._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    }
  };

  let waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 60) return;
    setTimeout(() => ready(fn), 100);
  }
  ready(() => {
    NABZ.compUI = C;
    if (typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('comp_my', (p, d) => C.showMy(p, d));
      NABZ.registerKind('comp_ward', (p, d) => C.showWard(p, d));
    }
    console.log('[comp-ui] loaded ✓');
  });
})();
