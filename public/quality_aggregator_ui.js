
// ═══════════════════════════════════════════════════════════
//  NABZ — Quality Aggregator UI
//  Overview + Drilldown + Trends + Exec + Export
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  const QA = {
    _api: (p, o) => NABZ._api(p, o),
    _esc: s => NABZ._esc(s),
    _state: { days: 7, ward: null, lastData: null, lastTrends: null },

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

    _fmtValue(k) {
      if (k.value == null) return '—';
      if (k.unit === '%') return k.value + '%';
      if (k.unit === 'min') return k.value + ' min';
      if (k.unit && k.unit.startsWith('per')) return k.value + ' ' + k.unit;
      return k.value;
    },

    _colorFor(sev) {
      return sev === 'critical' ? 'dng' : sev === 'warning' ? 'warn' : sev === 'ok' ? 'ok' : 'fg-3';
    },

    // ═══════════════════════════════════════════════════
    //  OVERVIEW
    // ═══════════════════════════════════════════════════
    async show(p, d) {
      const m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) {
          const url = '/api/qa/overview?days=' + QA._state.days + (QA._state.ward ? '&ward=' + QA._state.ward : '');
          d = await QA._api(url);
        }
        QA._state.lastData = d;
        QA._render(d);
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + QA._esc(e.message) + '</div>';
      }
    },

    _render(d) {
      const m = document.getElementById('content');
      const scores = d.scores || {};
      const totals = d.totals || {};
      const scoresColor = (v) => v >= 90 ? 'ok' : v >= 75 ? 'warn' : v == null ? 'fg-3' : 'dng';

      let h = '';
      h += '<div class="sec-hd"><span>📊 داشبورد کیفیت</span>';
      h += '<span class="rd-mini">' + d.window.days + ' روز · ' + (d.ward === 'all' ? 'کل بیمارستان' : d.ward) + '</span></div>';

      // ─── Overall donut ───
      h += '<div class="card" style="padding:16px;background:linear-gradient(135deg,rgba(6,182,212,0.08),rgba(139,92,246,0.05));margin-bottom:12px">';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:center">';
      h += '<div style="text-align:center">' + QA._renderDonut(scores.overall, 140, scoresColor(scores.overall)) + '</div>';
      h += '<div>';
      h += '<div style="font-size:11px;color:var(--fg-2);font-weight:800">QUALITY SCORE</div>';
      h += '<div style="font-size:36px;font-weight:900;color:var(--' + scoresColor(scores.overall) + ');line-height:1.1">' + (scores.overall == null ? '—' : scores.overall) + '</div>';
      h += '<div style="font-size:11px;color:var(--fg-2);margin-top:6px">' + totals.computed + ' از ' + totals.total + ' KPI محاسبه شد</div>';
      h += '<div style="font-size:11px;color:var(--ok);font-weight:800;margin-top:4px">✅ ' + (totals.ok || 0) + ' سالم</div>';
      h += '<div style="font-size:11px;color:var(--warn);font-weight:800">⚠️ ' + (totals.warning || 0) + ' هشدار</div>';
      h += '<div style="font-size:11px;color:var(--dng);font-weight:800">🚨 ' + (totals.critical || 0) + ' بحرانی</div>';
      h += '</div></div></div>';

      // ─── Category bars ───
      h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">';
      const cats = [
        { key: 'clinical', label: 'بالینی', weight: '60%' },
        { key: 'safety', label: 'ایمنی', weight: '25%' },
        { key: 'operational', label: 'عملیاتی', weight: '15%' }
      ];
      for (const c of cats) {
        const val = scores[c.key];
        const color = scoresColor(val);
        h += '<div class="card" style="padding:10px;text-align:center">';
        h += '<div style="font-size:10px;color:var(--fg-2);font-weight:800">' + c.label + '</div>';
        h += '<div style="font-size:22px;font-weight:900;color:var(--' + color + ');line-height:1.2">' + (val == null ? '—' : val) + '</div>';
        h += '<div class="progress" style="margin-top:4px;height:4px"><div class="progress-fill ' + color + '" style="width:' + (val || 0) + '%"></div></div>';
        h += '<div style="font-size:9px;color:var(--fg-3);margin-top:4px">وزن ' + c.weight + '</div>';
        h += '</div>';
      }
      h += '</div>';

      // ─── Actions ───
      h += '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">';
      h += '<button class="btn btn-sm" style="padding:8px 12px;font-size:11px" onclick="NABZ.qaUI.setDays(7)">📅 ۷ روز</button>';
      h += '<button class="btn btn-sm" style="padding:8px 12px;font-size:11px" onclick="NABZ.qaUI.setDays(30)">📅 ۳۰ روز</button>';
      h += '<button class="btn btn-sm" style="padding:8px 12px;font-size:11px" onclick="NABZ.qaUI.trends()">📈 روند</button>';
      h += '<button class="btn btn-sm" style="padding:8px 12px;font-size:11px" onclick="NABZ.qaUI.exec()">📋 خلاصه مدیران</button>';
      h += '<button class="btn btn-sm" style="padding:8px 12px;font-size:11px" onclick="NABZ.qaUI.departments()">🏥 مقایسه بخش</button>';
      h += '<button class="btn btn-primary btn-sm" style="padding:8px 12px;font-size:11px;font-weight:900" onclick="NABZ.qaUI.exportJci()">📤 JCI Export</button>';
      h += '</div>';

      // ─── KPI cards grouped ───
      const cat = [
        { key: 'clinical', label: '🏥 بالینی', list: d.categories.clinical },
        { key: 'safety', label: '⚠️ ایمنی', list: d.categories.safety },
        { key: 'operational', label: '⚙️ عملیاتی', list: d.categories.operational }
      ];
      for (const c of cat) {
        h += '<div class="sec-hd" style="margin-top:14px"><span>' + c.label + '</span></div>';
        h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px">';
        for (const k of c.list) {
          h += QA._renderKpiCard(k);
        }
        h += '</div>';
      }

      m.innerHTML = h;
    },

    _renderKpiCard(k) {
      const color = QA._colorFor(k.severity);
      const icon = k.severity === 'ok' ? '✅' : k.severity === 'warning' ? '⚠️' : k.severity === 'critical' ? '🚨' : '○';
      const targetStr = k.lowerIsBetter ? '≤ ' + k.target : '≥ ' + k.target;
      let card = '<div onclick="NABZ.qaUI.drilldown(\'' + k.code + '\')" style="cursor:pointer;background:var(--bg-2);border:1.5px solid var(--' + color + ');border-radius:10px;padding:10px">';
      card += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">';
      card += '<div style="font-size:10.5px;font-weight:800;color:var(--fg-2);line-height:1.3">' + QA._esc(k.fa) + '</div>';
      card += '<span style="font-size:14px">' + icon + '</span>';
      card += '</div>';
      card += '<div style="font-size:22px;font-weight:900;color:var(--' + color + ');line-height:1">' + QA._fmtValue(k) + '</div>';
      card += '<div style="font-size:9.5px;color:var(--fg-3);margin-top:4px">هدف ' + targetStr + ' ' + k.unit + '</div>';
      card += '<div style="font-size:9px;color:var(--fg-3);font-family:monospace;margin-top:2px">' + k.standard + '</div>';
      card += '</div>';
      return card;
    },

    _renderDonut(value, size, color) {
      const v = value == null ? 0 : Math.max(0, Math.min(100, value));
      const r = size / 2 - 10;
      const cx = size / 2, cy = size / 2;
      const circ = 2 * Math.PI * r;
      const offset = circ * (1 - v / 100);
      return '<svg viewBox="0 0 ' + size + ' ' + size + '" style="width:100%;max-width:' + size + 'px;height:auto;display:block">' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--bg-3)" stroke-width="10"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--' + color + ')" stroke-width="10" ' +
        'stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '" ' +
        'transform="rotate(-90 ' + cx + ' ' + cy + ')" stroke-linecap="round"/>' +
        '<text x="' + cx + '" y="' + (cy + 6) + '" text-anchor="middle" font-size="' + Math.round(size * 0.24) + '" font-weight="900" fill="var(--' + color + ')">' + (value == null ? '—' : value) + '</text>' +
        '</svg>';
    },

    setDays(days) {
      QA._state.days = days;
      QA.show(null, null);
    },

    // ═══════════════════════════════════════════════════
    //  DRILLDOWN
    // ═══════════════════════════════════════════════════
    async drilldown(code) {
      try {
        const url = '/api/qa/kpi/' + code + '?days=' + QA._state.days;
        const d = await QA._api(url);
        QA._renderDrilldown(d);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _renderDrilldown(d) {
      const k = d.kpi;
      const color = QA._colorFor(k.severity);
      let h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">📊 ' + QA._esc(k.fa) + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      // Header
      h += '<div class="card" style="text-align:center;border-color:var(--' + color + ');margin-bottom:12px">';
      h += '<div style="font-size:36px;font-weight:900;color:var(--' + color + ');line-height:1">' + QA._fmtValue(k) + '</div>';
      h += '<div style="font-size:11px;color:var(--fg-2);margin-top:4px">هدف: ' + (k.lowerIsBetter ? '≤' : '≥') + ' ' + k.target + ' ' + k.unit + '</div>';
      h += '<div style="font-size:10px;color:var(--fg-3);font-family:monospace;margin-top:2px">' + k.standard + '</div>';
      h += '</div>';

      // Calculation
      h += '<div class="card" style="margin-bottom:12px">';
      h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin-bottom:4px">محاسبه</div>';
      h += '<div style="font-size:12px">Numerator: <b>' + (k.numerator != null ? k.numerator : '—') + '</b></div>';
      h += '<div style="font-size:12px">Denominator: <b>' + (k.denominator != null ? k.denominator : '—') + '</b></div>';
      h += '<div style="font-size:12px;margin-top:4px">Value: <b style="color:var(--' + color + ')">' + QA._fmtValue(k) + '</b></div>';
      h += '</div>';

      // Drill data
      if (d.drill && d.drill.length > 0) {
        h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin:12px 0 6px">🔍 نمونه داده (' + d.drillCount + ')</div>';
        d.drill.slice(0, 20).forEach(item => {
          h += '<div style="padding:8px;background:var(--bg-2);border-radius:6px;margin-bottom:4px;font-size:11px">';
          Object.entries(item).forEach(([key, val]) => {
            if (val == null || val === '') return;
            const keyFa = { patientName:'بیمار', ward:'بخش', drugName:'دارو', panel:'پنل', status:'وضعیت', signedAt:'امضا', receivedAt:'دریافت', scheduledAt:'زمان برنامه', administeredAt:'توزیع', witnessedBy:'شاهد', flags:'بحرانی', acked:'تأیید', bundleCompleted:'bundle', onTime:'به‌موقع', severity:'شدت', reportedAt:'گزارش', description:'شرح', screenedAt:'غربالگری' }[key] || key;
            h += '<div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:var(--fg-2)">' + keyFa + ':</span><span style="font-weight:700">' + QA._esc(String(val).slice(0, 40)) + '</span></div>';
          });
          h += '</div>';
        });
        if (d.drillCount > 20) {
          h += '<div style="text-align:center;font-size:10px;color:var(--fg-3);padding:6px">+ ' + (d.drillCount - 20) + ' رکورد دیگر</div>';
        }
      } else {
        h += '<div class="empty" style="padding:20px">داده‌ای برای drilldown نیست</div>';
      }

      h += '<div style="margin-top:12px;margin-bottom:20px"><button class="btn btn-block" style="padding:10px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button></div>';

      QA._openSheet(h);
    },

    // ═══════════════════════════════════════════════════
    //  TRENDS
    // ═══════════════════════════════════════════════════
    async trends() {
      try {
        const d = await QA._api('/api/qa/trends?days=' + QA._state.days);
        let h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">📈 روند KPI</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="hint info" style="margin-bottom:12px">نمایش ۶ KPI کلیدی در ' + d.days + ' روز گذشته</div>';

        const codeNames = {
          HANDOFF_READBACK: 'Read-back تحویل',
          MAR_MISSED_RATE: 'Missed MAR',
          SEPSIS_3H_ONTIME: 'Sepsis 3h',
          NOC_MET: 'NOC محقق',
          FALL_RATE: 'سقوط',
          MAR_LATE_RATE: 'تأخیر MAR'
        };

        for (const code of d.codes) {
          const values = d.items.map(x => x[code]).filter(v => v != null);
          if (!values.length) continue;
          const last = values[values.length - 1];
          const first = values[0];
          const delta = last - first;
          const color = delta > 0 ? 'ok' : delta < 0 ? 'dng' : 'fg-2';
          const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';

          h += '<div class="card" style="margin-bottom:8px">';
          h += '<div style="display:flex;justify-content:space-between;align-items:center">';
          h += '<div style="font-size:12px;font-weight:900">' + (codeNames[code] || code) + '</div>';
          h += '<div style="font-size:12px;font-weight:900;color:var(--' + color + ')">' + last + ' ' + arrow + Math.abs(delta) + '</div>';
          h += '</div>';
          h += QA._renderSparkline(d.items.map(x => x[code]), 280, 40, delta > 0 ? 'ok' : 'dng');
          h += '</div>';
        }

        h += '<button class="btn btn-block" style="padding:10px;margin-top:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        QA._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _renderSparkline(values, width, height, color) {
      if (!values || !values.length) return '';
      const max = Math.max(...values.filter(v => v != null), 1);
      const min = Math.min(...values.filter(v => v != null), 0);
      const range = max - min || 1;
      const stepX = width / Math.max(1, values.length - 1);
      const points = values.map((v, i) => {
        const x = i * stepX;
        const y = v == null ? height : height - ((v - min) / range) * (height - 4) - 2;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      return '<svg viewBox="0 0 ' + width + ' ' + height + '" style="width:100%;height:' + height + 'px;display:block;margin-top:4px">' +
        '<polyline points="' + points + '" fill="none" stroke="var(--' + color + ')" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';
    },

    // ═══════════════════════════════════════════════════
    //  EXEC SUMMARY
    // ═══════════════════════════════════════════════════
    async exec() {
      try {
        const d = await QA._api('/api/qa/exec-summary?days=' + Math.max(QA._state.days, 7));
        const gradeColor = { A: 'ok', B: 'ok', C: 'warn', D: 'dng', F: 'dng' }[d.grade] || 'info';

        let h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">📋 خلاصه مدیران</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        // Overall + grade
        h += '<div class="card" style="text-align:center;border-color:var(--' + gradeColor + ');margin-bottom:12px">';
        h += '<div style="font-size:56px;font-weight:900;color:var(--' + gradeColor + ');line-height:1">' + d.grade + '</div>';
        h += '<div style="font-size:11px;color:var(--fg-2)">Overall Score: ' + d.overall + '/100</div>';
        h += '<div style="font-size:10px;color:var(--fg-3);margin-top:4px">' + d.window.days + ' روز گذشته</div>';
        h += '</div>';

        // Category scores
        h += '<div class="card" style="margin-bottom:12px">';
        h += '<div style="font-size:11px;font-weight:900;margin-bottom:6px">امتیاز دسته‌ها</div>';
        for (const [cat, label] of [['clinical','بالینی'],['safety','ایمنی'],['operational','عملیاتی']]) {
          const v = d.categoryScores[cat];
          const c = v >= 90 ? 'ok' : v >= 75 ? 'warn' : 'dng';
          h += '<div style="margin-bottom:6px">';
          h += '<div style="display:flex;justify-content:space-between;font-size:11px"><span>' + label + '</span><b style="color:var(--' + c + ')">' + (v || '—') + '</b></div>';
          h += '<div class="progress" style="margin-top:2px;height:4px"><div class="progress-fill ' + c + '" style="width:' + (v || 0) + '%"></div></div>';
          h += '</div>';
        }
        h += '</div>';

        // Concerns
        if (d.topConcerns.length) {
          h += '<div style="font-size:12px;font-weight:900;color:var(--dng);margin:12px 0 6px">🚨 نگرانی‌های اصلی</div>';
          d.topConcerns.forEach((c, i) => {
            h += '<div style="padding:8px;background:var(--dng-soft);border-radius:6px;margin-bottom:4px;font-size:11.5px">';
            h += '<div style="font-weight:900">' + (i+1) + '. ' + QA._esc(c.fa) + '</div>';
            h += '<div style="font-size:10.5px;color:var(--fg-2)">مقدار ' + c.value + ' ' + c.unit + ' — هدف ' + c.target + ' · ' + c.severity + '</div>';
            h += '</div>';
          });
        }

        // Strengths
        if (d.topStrengths.length) {
          h += '<div style="font-size:12px;font-weight:900;color:var(--ok);margin:12px 0 6px">✅ نقاط قوت</div>';
          d.topStrengths.slice(0, 3).forEach(s => {
            h += '<div style="padding:6px;background:var(--ok-soft);border-radius:6px;margin-bottom:4px;font-size:11.5px">';
            h += '<b>' + QA._esc(s.fa) + '</b> — ' + s.value + ' ' + s.unit;
            h += '</div>';
          });
        }

        // Recommendations
        if (d.recommendations.length) {
          h += '<div style="font-size:12px;font-weight:900;color:var(--primary);margin:12px 0 6px">💡 توصیه‌ها</div>';
          d.recommendations.forEach((r, i) => {
            h += '<div style="padding:8px;background:var(--primary-soft);border-radius:6px;margin-bottom:4px;font-size:11.5px">';
            h += (i+1) + '. ' + QA._esc(r);
            h += '</div>';
          });
        }

        h += '<button class="btn btn-block" style="padding:10px;margin-top:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        QA._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  DEPARTMENT COMPARISON
    // ═══════════════════════════════════════════════════
    async departments() {
      try {
        const d = await QA._api('/api/qa/department-comparison?days=' + QA._state.days);
        let h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">🏥 مقایسه بخش‌ها</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="hint info" style="margin-bottom:12px">' + d.total + ' بخش · مرتب‌شده بر اساس امتیاز (کم به زیاد)</div>';

        if (!d.items.length) {
          h += '<div class="empty" style="padding:30px">داده‌ای نیست</div>';
        } else {
          d.items.forEach(it => {
            const color = it.score == null ? 'fg-3' : it.score >= 85 ? 'ok' : it.score >= 70 ? 'warn' : 'dng';
            h += '<div class="card" style="margin-bottom:8px;cursor:pointer" onclick="NABZ.qaUI._showWard(\'' + QA._esc(it.ward) + '\')">';
            h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
            h += '<div style="font-weight:900;font-size:13px">' + QA._esc(it.ward) + '</div>';
            h += '<div style="font-size:20px;font-weight:900;color:var(--' + color + ')">' + (it.score == null ? '—' : it.score) + '</div>';
            h += '</div>';
            h += '<div style="font-size:10.5px;color:var(--fg-2);margin-bottom:4px">' + it.patientCount + ' بیمار · ' + it.critical + ' بحرانی · ' + it.warning + ' هشدار</div>';
            h += '<div class="progress" style="height:3px"><div class="progress-fill ' + color + '" style="width:' + (it.score || 0) + '%"></div></div>';
            h += '</div>';
          });
        }

        h += '<button class="btn btn-block" style="padding:10px;margin-top:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        QA._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _showWard(ward) {
      QA._state.ward = ward;
      QA._closeAll();
      QA.show(null, null);
    },

    // ═══════════════════════════════════════════════════
    //  JCI EXPORT
    // ═══════════════════════════════════════════════════
    async exportJci() {
      try {
        NABZ._toast('در حال آماده‌سازی...');
        const days = Math.max(30, QA._state.days);
        const d = await QA._api('/api/qa/export/jci?days=' + days);
        const blob = new Blob([d.content], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = d.filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        NABZ._toast('✅ دانلود شد — ' + d.lineCount + ' خط');
      } catch (e) { alert('خطا: ' + e.message); }
    }
  };

  // ═══ Bootstrap ═══
  let waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 60) return console.warn('[qa-ui] timeout');
    setTimeout(() => ready(fn), 100);
  }

  ready(() => {
    NABZ.qaUI = QA;

    if (typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('qa_dashboard', (p, d) => QA.show(p, d));
    }

    console.log('[qa-ui] loaded ✓ — Quality Aggregator');
  });
})();
