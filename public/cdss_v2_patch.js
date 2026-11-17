
// ═══════════════════════════════════════════════════════════
//  NABZ — CDSS v2 Patch
//  - JCI read-back acknowledgment for critical alerts
//  - Sepsis bundle timers (3h + 6h) with real-time progress
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var C2 = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _closeAll: function() { document.querySelectorAll('.bs-backdrop').forEach(el => el.remove()); },
    _openSheet: function(html) {
      const sheet = document.createElement('div');
      sheet.className = 'bs-backdrop';
      sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
      const c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '96vh';
      c.innerHTML = html;
      sheet.appendChild(c);
      document.body.appendChild(sheet);
      requestAnimationFrame(() => sheet.classList.add('show'));
      return { sheet, content: c };
    },

    // ═══ Read-back acknowledgment (JCI requirement) ═══
    async acknowledgeAlert(alertId) {
      try {
        const all = await C2._api('/api/cdss/alerts');
        const a = (all.items || []).find(x => x.id === alertId);
        if (!a) return alert('هشدار یافت نشد');
        if (a.readBack && a.readBack.acknowledged) return alert('قبلاً تأیید شده');

        let h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">✍️ تأیید دریافت هشدار (Read-Back)</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        h += '<div class="card" style="border-color:var(--dng);background:var(--dng-soft);margin-bottom:12px">';
        h += '<div style="font-weight:900;font-size:13px;color:var(--dng)">🚨 ' + C2._esc(a.title || a.type) + '</div>';
        if (a.patientName) h += '<div style="font-size:12px;margin-top:4px">بیمار: <b>' + C2._esc(a.patientName) + '</b></div>';
        if (a.message) h += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:4px">' + C2._esc(a.message) + '</div>';
        if (a.recommendation) h += '<div style="font-size:11.5px;margin-top:6px;padding:6px;background:var(--bg-3);border-radius:6px">💡 ' + C2._esc(a.recommendation) + '</div>';
        h += '</div>';

        h += '<div class="hint info" style="margin-bottom:12px">بر اساس JCI، برای هشدارهای critical باید پاسخ خود را بازگو کنید (read-back)</div>';
        h += '<div class="wf-field"><label>متن تأیید (بازگویی) *</label><textarea id="rbText" rows="3" placeholder="مثلاً: تزریق هپارین ۵۰۰۰ واحد زیرجلدی را برای بیمار X دریافت کردم..."></textarea></div>';
        h += '<div class="wf-field"><label>اقدام انجام‌شده (اختیاری)</label><textarea id="rbNote" rows="2" placeholder="مثلاً: دستور قطع شد، پزشک مطلع شد"></textarea></div>';
        h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.cdssV2._doAcknowledge(\'' + alertId + '\')">✅ تأیید دریافت</button>';

        C2._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _doAcknowledge(alertId) {
      const text = (document.getElementById('rbText') || {}).value || '';
      const note = (document.getElementById('rbNote') || {}).value || '';
      if (!text.trim()) return alert('متن read-back الزامی است');
      try {
        await C2._api('/api/cdss/alerts/' + alertId + '/acknowledge', {
          method: 'POST',
          body: JSON.stringify({ readBack: text, note })
        });
        C2._closeAll();
        NABZ._toast('✅ Read-back ثبت شد');
        if (NABZ.state.current === 'cdss.dashboard') NABZ.show('cdss.dashboard');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══ Sepsis Bundles View ═══
    async sepsisBundles() {
      const m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        const d = await C2._api('/api/safety/sepsis');
        const items = (d.items || []).filter(s => ['suspected','confirmed','septic_shock','screening'].includes(s.status) &&
          !s.bundle3h.completed);
        // Also include completed but 6h pending
        const s6 = (d.items || []).filter(s => s.bundle3h.completed && !s.bundle6h.completed);
        const all = items.concat(s6);

        let h = '<div class="sec-hd"><span>🦠 Sepsis Bundles — SSC 2021</span>';
        h += '<span class="rd-mini">' + all.length + ' فعال</span></div>';
        h += '<button class="btn" style="padding:8px 12px;margin-bottom:12px;font-size:11px" onclick="NABZ.show(\'safety.sepsis\')">← لیست کامل</button>';

        if (!all.length) {
          h += '<div class="empty">هیچ bundle فعالی نیست</div>';
          m.innerHTML = h;
          return;
        }

        all.forEach(s => {
          h += C2._renderBundleCard(s);
        });

        m.innerHTML = h;
        C2._startBundleTimers();
      } catch (e) { m.innerHTML = '<div class="empty">خطا: ' + C2._esc(e.message) + '</div>'; }
    },

    _renderBundleCard(s) {
      const now = Date.now();
      const d3 = new Date(s.bundle3h.deadline).getTime();
      const d6 = new Date(s.bundle6h.deadline).getTime();
      const remain3 = Math.floor((d3 - now) / 1000);
      const remain6 = Math.floor((d6 - now) / 1000);

      let h = '<div class="card" style="margin-bottom:12px;border-color:' + (s.status === 'suspected' ? 'var(--warn)' : 'var(--dng)') + '">';

      // Header
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
      h += '<div><div style="font-weight:900;font-size:14px">' + C2._esc(s.patientName) + '</div>';
      h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">';
      h += 'qSOFA=' + s.qsofa.score + ' · SIRS=' + s.sirs.score + ' · NEWS2=' + s.news2;
      if (s.lactate != null) h += ' · Lactate=' + s.lactate;
      h += '</div></div>';
      h += '<span class="pill ' + (s.status === 'suspected' ? 'warn' : 'dng') + '">' + C2._esc(s.status) + '</span>';
      h += '</div>';

      // Likelihood bar
      h += '<div style="margin-top:8px">';
      h += '<div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--fg-2)"><span>Likelihood</span><span>' + (s.likelihoodScore || 0) + '%</span></div>';
      h += '<div class="progress" style="margin-top:3px"><div class="progress-fill ' + ((s.likelihoodScore || 0) >= 60 ? 'dng' : 'warn') + '" style="width:' + (s.likelihoodScore || 0) + '%"></div></div>';
      h += '</div>';

      // 3h bundle
      h += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
      h += '<div style="font-size:11px;font-weight:900;color:var(--primary)">⏱ 3-Hour Bundle</div>';
      h += '<div style="font-size:11px;font-weight:900;color:' + (remain3 < 0 ? 'var(--dng)' : remain3 < 1800 ? 'var(--warn)' : 'var(--ok)') + '" data-countdown-to="' + s.bundle3h.deadline + '">' + C2._fmtSec(Math.max(0, remain3)) + '</div>';
      h += '</div>';

      const items3 = s.bundle3h.items;
      const keys3 = [
        ['lactate', '📊 لاکتات'],
        ['bloodCultures', '🧪 کشت خون ×۲'],
        ['broadAntibiotics', '💊 آنتی‌بیوتیک وسیع‌الطیف'],
        ['crystalloid30ml', '💧 مایع ۳۰ml/kg']
      ];
      keys3.forEach(([k, label]) => {
        const item = items3[k];
        const done = item.done;
        h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:' + (done ? 'var(--ok-soft)' : 'var(--bg-2)') + ';border-radius:6px;margin-bottom:3px;font-size:11.5px">';
        h += '<span>' + (done ? '✅' : '⏳') + ' ' + label + (item.value != null ? ' — ' + item.value : '') + '</span>';
        if (!done) {
          h += '<button class="btn btn-sm" style="padding:2px 8px;font-size:10px" onclick="NABZ.cdssV2._tick3h(\'' + s.id + '\',\'' + k + '\')">انجام</button>';
        } else {
          h += '<span style="font-size:9px;color:var(--ok);font-weight:900">✓</span>';
        }
        h += '</div>';
      });
      h += '</div>';

      // 6h bundle (if 3h completed)
      if (s.bundle3h.completed) {
        h += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
        h += '<div style="font-size:11px;font-weight:900;color:var(--violet)">⏱ 6-Hour Bundle</div>';
        h += '<div style="font-size:11px;font-weight:900;color:' + (remain6 < 0 ? 'var(--dng)' : remain6 < 1800 ? 'var(--warn)' : 'var(--ok)') + '" data-countdown-to="' + s.bundle6h.deadline + '">' + C2._fmtSec(Math.max(0, remain6)) + '</div>';
        h += '</div>';

        const items6 = s.bundle6h.items;
        const keys6 = [
          ['vasopressors', '💉 وازوپرسور (MAP≥65)'],
          ['repeatLactate', '📊 لاکتات مجدد'],
          ['remeasure', '🔬 ارزیابی مجدد']
        ];
        keys6.forEach(([k, label]) => {
          const item = items6[k];
          const done = item.done;
          h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:' + (done ? 'var(--ok-soft)' : 'var(--bg-2)') + ';border-radius:6px;margin-bottom:3px;font-size:11.5px">';
          h += '<span>' + (done ? '✅' : '⏳') + ' ' + label + (item.value != null ? ' — ' + item.value : '') + '</span>';
          if (!done) {
            h += '<button class="btn btn-sm" style="padding:2px 8px;font-size:10px" onclick="NABZ.cdssV2._tick6h(\'' + s.id + '\',\'' + k + '\')">انجام</button>';
          } else {
            h += '<span style="font-size:9px;color:var(--ok);font-weight:900">✓</span>';
          }
          h += '</div>';
        });
        h += '</div>';
      }

      // Timing summary
      if (s.bundle3h.completed) {
        const onTime = s.bundle3h.onTime;
        h += '<div class="hint ' + (onTime ? 'success' : 'danger') + '" style="margin-top:8px;font-size:10.5px">';
        h += (onTime ? '✅' : '⚠️') + ' 3h bundle در ' + (s.bundle3h.elapsedMin || 0) + ' دقیقه';
        h += '</div>';
      }

      h += '</div>';
      return h;
    },

    _fmtSec(sec) {
      if (sec <= 0) return 'گذشته';
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    },

    async _tick3h(sepsisId, item) {
      const body = {};
      if (item === 'lactate') {
        const v = prompt('مقدار لاکتات (mg/dL):');
        if (!v || isNaN(+v)) return;
        body.lactate = parseFloat(v);
      } else if (item === 'bloodCultures') {
        body.bloodCultures = 'both';
      } else if (item === 'broadAntibiotics') {
        const drug = prompt('نام دارو (مثلاً Meropenem):') || 'unspecified';
        body.broadAntibiotics = true;
        body.antibioticDrug = drug;
      } else if (item === 'crystalloid30ml') {
        const v = prompt('حجم مایع (ml):', '2000') || '2000';
        body.crystalloid30ml = true;
        body.crystalloidVolumeMl = parseFloat(v);
      }
      try {
        await C2._api('/api/safety/sepsis/' + sepsisId + '/bundle3h', {
          method: 'POST', body: JSON.stringify(body)
        });
        NABZ._toast('✅ ثبت شد');
        C2.sepsisBundles();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _tick6h(sepsisId, item) {
      const body = {};
      if (item === 'vasopressors') {
        const drug = prompt('وازوپرسور (norepinephrine):', 'norepinephrine') || 'norepinephrine';
        body.vasopressors = true;
        body.vasopressorDrug = drug;
      } else if (item === 'repeatLactate') {
        const v = prompt('لاکتات مجدد (mg/dL):');
        if (!v || isNaN(+v)) return;
        body.repeatLactate = parseFloat(v);
      } else if (item === 'remeasure') {
        body.remeasure = true;
      }
      try {
        await C2._api('/api/safety/sepsis/' + sepsisId + '/bundle6h', {
          method: 'POST', body: JSON.stringify(body)
        });
        NABZ._toast('✅ ثبت شد');
        C2.sepsisBundles();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _bundleTimerInterval: null,
    _startBundleTimers() {
      if (C2._bundleTimerInterval) clearInterval(C2._bundleTimerInterval);
      C2._bundleTimerInterval = setInterval(() => {
        document.querySelectorAll('[data-countdown-to]').forEach(el => {
          try {
            const target = new Date(el.dataset.countdownTo).getTime();
            const sec = Math.floor((target - Date.now()) / 1000);
            el.textContent = C2._fmtSec(Math.max(0, sec));
            if (sec < 0) el.style.color = 'var(--dng)';
          } catch (_) {}
        });
      }, 1000);
    }
  };

  // ═══ Bootstrap ═══
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 60) return;
    setTimeout(() => ready(fn), 100);
  }

  ready(function() {
    NABZ.cdssV2 = C2;

    // Wrap showCdss to add "read-back pending" section
    var orig = NABZ.showCdss;
    if (typeof orig === 'function') {
      NABZ.showCdss = async function(p, d) {
        await orig.call(NABZ, p, d);
        // Post-process: add sepsis bundle card + readback pending section
        try {
          const alerts = await C2._api('/api/cdss/alerts');
          const pendingReadback = (alerts.items || []).filter(a => a.readBack && a.readBack.required && !a.readBack.acknowledged);
          const content = document.getElementById('content');
          if (!content) return;
          
          let inject = '';
          // Read-back pending
          if (pendingReadback.length) {
            inject += '<div class="sec-hd" style="margin-top:16px"><span>✍️ منتظر Read-back</span><span class="rd-mini">' + pendingReadback.length + '</span></div>';
            pendingReadback.forEach(a => {
              inject += '<div class="row hi" onclick="NABZ.cdssV2.acknowledgeAlert(\'' + a.id + '\')">';
              inject += '<div class="row-hd"><div class="row-title">' + C2._esc(a.title || a.type) + '</div>';
              inject += '<span class="pill dng">تأیید</span></div>';
              if (a.patientName) inject += '<div class="row-meta">' + C2._esc(a.patientName) + '</div>';
              inject += '</div>';
            });
          }

          // Sepsis bundle link
          inject += '<div class="sec-hd" style="margin-top:16px"><span>🦠 Sepsis Bundles</span></div>';
          inject += '<button class="btn btn-block" style="padding:12px;background:var(--dng-soft);color:var(--dng);border-color:var(--dng)" onclick="NABZ.cdssV2.sepsisBundles()">⏱ مشاهده Bundle Timers</button>';

          content.insertAdjacentHTML('beforeend', inject);
        } catch (_) {}
      };
    }

    console.log('[cdss-v2] loaded ✓ — read-back + sepsis bundles');
  });
})();
