
// ═══════════════════════════════════════════════════════════
//  NABZ — MAR Advanced UI
//  Standards: ISMP 2024, JCI IPSG.3, 5-rights verified mode
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  const SCALE_FA = { pain:'درد', nausea:'تهوع', anxiety:'اضطراب', dyspnea:'تنگی نفس', pruritus:'خارش', agitation:'بی‌قراری', custom:'سایر' };

  const FREQ_MAP = {
    'OD':'روزانه', 'Q24H':'هر ۲۴ ساعت', 'BID':'دوبار در روز', 'Q12H':'هر ۱۲ ساعت',
    'TDS':'سه‌بار در روز', 'Q8H':'هر ۸ ساعت', 'QID':'چهاربار در روز', 'Q6H':'هر ۶ ساعت',
    'HS':'شب‌هنگام', 'Q4H':'هر ۴ ساعت', 'Q1H':'هر ۱ ساعت', 'CONT':'مداوم',
    'Q8H PRN':'هر ۸ ساعت (PRN)', 'Q4H PRN':'هر ۴ ساعت (PRN)', 'Q6H PRN':'هر ۶ ساعت (PRN)',
    'PRN':'در صورت نیاز'
  };
  const ROUTE_MAP = {
    'PO':'خوراکی', 'IV':'وریدی', 'IV INFUSION':'سرم وریدی', 'SC':'زیرجلدی',
    'IM':'عضلانی', 'SL':'زیرزبانی', 'PR':'مقعدی', 'INH':'استنشاقی', 'TOP':'موضعی'
  };

  function _relTime(iso) {
    if (!iso) return '—';
    try {
      const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
      if (diff < 0) {
        const abs = Math.abs(diff);
        if (abs < 60) return abs + ' دقیقه دیگر';
        return Math.floor(abs/60) + 'س ' + (abs%60) + 'د دیگر';
      }
      if (diff < 60) return diff + ' دقیقه پیش';
      if (diff < 1440) return Math.floor(diff/60) + ' ساعت پیش';
      return Math.floor(diff/1440) + ' روز پیش';
    } catch(_) { return '—'; }
  }

  const M = {
    _api: (p, o) => NABZ._api(p, o),
    _esc: s => NABZ._esc(s),
    _tab: 'due',
    _cache: null,

    _fmtTime(iso) {
      try {
        const d = new Date(iso);
        return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      } catch (_) { return '—'; }
    },

    _closeAll() { document.querySelectorAll('.bs-backdrop').forEach(el => el.remove()); },

    _openSheet(html, opts) {
      opts = opts || {};
      const sheet = document.createElement('div');
      sheet.className = 'bs-backdrop';
      sheet.onclick = e => { if (e.target === sheet && !opts.noClose) sheet.remove(); };
      const c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '95vh';
      c.innerHTML = html;
      sheet.appendChild(c);
      document.body.appendChild(sheet);
      requestAnimationFrame(() => sheet.classList.add('show'));
      return { sheet, content: c };
    },

    // ═══════════════════════════════════════════════════
    //  MAIN BOARD
    // ═══════════════════════════════════════════════════
    async show(p, d) {
      const m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        // Capture patientId from data or URL
        M._patientId = (d && d.patientId) || (p && p.patientId) || new URLSearchParams(location.search).get('patientId') || null;
        const q = M._patientId ? ('?patientId=' + encodeURIComponent(M._patientId)) : '';
        const [detail, overdue, handoff] = await Promise.all([
          M._api('/api/mar/detailed' + q),
          M._api('/api/mar/overdue' + (M._patientId ? q : '')),
          M._api('/api/mar/handoff')
        ]);
        M._cache = { detail, overdue, handoff };

        const all = detail.items || [];
        const overdueList = overdue.items || [];
        const handoffCounts = handoff.counts || {};

        // Counts
        const dueCount = all.filter(x => ['scheduled','due'].includes(x.status)).length;
        const histCount = all.filter(x => ['given','refused','missed'].includes(x.status)).length;
        const prnCount = all.filter(x => x._isPRN).length;
        const highCount = all.filter(x => x._isHighAlert || x._isVeryHighAlert).length;
        const overdueCount = (overdueList || []).length;

        // Smart default: if no due items but history exists → history
        let tab = M._tab;
        if (!tab) {
          if (M._patientId && dueCount === 0 && histCount > 0) tab = 'history';
          else tab = 'due';
        }

        let items;
        if (tab === 'due') items = all.filter(x => ['scheduled','due'].includes(x.status)).slice(0, 50);
        else if (tab === 'prn') items = all.filter(x => x._isPRN).slice(0, 50);
        else if (tab === 'high') items = all.filter(x => x._isHighAlert || x._isVeryHighAlert).slice(0, 50);
        else if (tab === 'overdue') items = overdueList || [];
        else if (tab === 'history') items = all.filter(x => ['given','refused','missed'].includes(x.status)).slice(0, 50);
        else items = all.slice(0, 50);

        let h = '';
        // Patient header (clinical)
        if (M._patientId) {
          const sample = all[0] || {};
          const missed8h = all.filter(x => x.status === 'missed' && x.missedAt && (Date.now() - new Date(x.missedAt).getTime()) < 8*3600000).length;
          const highAlertN = all.filter(x => x._isHighAlert || x._isVeryHighAlert || x.isHighAlert).length;
          const prnPend = all.filter(x => x._needsEffectiveness).length;
          const overdueN = all.filter(x => x._isOverdue || x._isVeryOverdue).length;

          h += '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;padding:14px 16px;border-radius:14px;margin:0 0 14px;box-shadow:0 4px 16px rgba(15,23,42,.25)">';
          h += '<div style="font-size:16px;font-weight:800;letter-spacing:-.01em">💊 MAR · ' + M._esc(sample.patientName || M._patientId) + '</div>';
          h += '<div style="font-size:12px;opacity:.85;margin-top:4px">' + M._esc(sample.wardCode || '') + ' · ' + M._patientId + '</div>';
          h += '</div>';

          // Real patient stats
          h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 14px">';
          h += '<div style="background:#fff;border-radius:12px;padding:12px 8px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.06)"><div style="font-size:22px;font-weight:800;color:#dc2626">' + missed8h + '</div><div style="font-size:11px;color:#64748b;margin-top:2px">Missed 8h</div></div>';
          h += '<div style="background:#fff;border-radius:12px;padding:12px 8px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.06)"><div style="font-size:22px;font-weight:800;color:#dc2626">' + highAlertN + '</div><div style="font-size:11px;color:#64748b;margin-top:2px">High-Alert</div></div>';
          h += '<div style="background:#fff;border-radius:12px;padding:12px 8px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.06)"><div style="font-size:22px;font-weight:800;color:#d97706">' + prnPend + '</div><div style="font-size:11px;color:#64748b;margin-top:2px">PRN بی‌ارزیابی</div></div>';
          h += '<div style="background:#fff;border-radius:12px;padding:12px 8px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.06)"><div style="font-size:22px;font-weight:800;color:#ea580c">' + overdueN + '</div><div style="font-size:11px;color:#64748b;margin-top:2px">دیرکرد</div></div>';
          h += '</div>';
        } else {
          h += '<div class="sec-hd"><span>💊 MAR — مدیریت دارو</span>';
          h += '<span class="rd-mini">' + all.length + ' رکورد</span></div>';
        }

        // Critical alerts banner
        const veryOverdue = overdueList.filter(x => x.severity === 'critical').length;
        const veryHighAlerts = all.filter(x => x._isVeryHighAlert && x.status === 'due').length;
        if (veryOverdue > 0 || veryHighAlerts > 0) {
          h += '<div style="background:var(--dng-soft);border:2px solid var(--dng);border-radius:12px;padding:12px;margin-bottom:12px">';
          h += '<div style="font-size:13px;font-weight:900;color:var(--dng)">🚨 نیاز فوری به توجه</div>';
          if (veryOverdue > 0) h += '<div style="font-size:12px;margin-top:4px">' + veryOverdue + ' دوز بسیار دیرکرد (>۲ ساعت)</div>';
          if (veryHighAlerts > 0) h += '<div style="font-size:12px;margin-top:2px">' + veryHighAlerts + ' داروی Very-High-Alert در صف</div>';
          h += '</div>';
        }

        // Stats
        h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">';
        h += '<div class="rd-stat ' + (overdueList.length > 0 ? 'dng' : 'ok') + '"><div class="v">' + overdueList.length + '</div><div class="l">دیرکرد</div></div>';
        h += '<div class="rd-stat warn"><div class="v">' + (handoffCounts.prnWithoutEffectiveness || 0) + '</div><div class="l">PRN بی‌ارزیابی</div></div>';
        h += '<div class="rd-stat info"><div class="v">' + (handoffCounts.highAlertGiven || 0) + '</div><div class="l">High-Alert ۸h</div></div>';
        h += '<div class="rd-stat"><div class="v">' + (handoffCounts.missed || 0) + '</div><div class="l">Missed ۸h</div></div>';
        h += '</div>';

        // Quick actions
        h += '<div style="display:flex;gap:6px;margin-bottom:12px">';
        h += '<button class="btn btn-sm" style="padding:8px 12px;font-size:11px" onclick="NABZ.marUI.slidingScale()">🧮 Sliding Scale</button>';
        h += '<button class="btn btn-sm" style="padding:8px 12px;font-size:11px" onclick="NABZ.marUI.handoff()">📋 تحویل شیفت</button>';
        h += '<button class="btn btn-sm" style="padding:8px 12px;font-size:11px" onclick="NABZ.marUI.highAlertAudit()">🔍 High-Alert Audit</button>';
        h += '</div>';

        // Tabs
        h += '<div class="crisis-tabs" style="margin-bottom:12px">';
        const tabs = [
          ['due', '📋 در نوبت (' + dueCount + ')'],
          ['overdue', '⏰ دیرکرد (' + overdueCount + ')'],
          ['prn', '💊 PRN (' + prnCount + ')'],
          ['high', '⚠️ پرخطر (' + highCount + ')'],
          ['history', '📚 تاریخچه (' + histCount + ')']
        ];
        tabs.forEach(([key, label]) => {
          h += '<button class="crisis-tab' + (tab === key ? ' on' : '') + '" onclick="NABZ.marUI.setTab(\'' + key + '\')">' + label + '</button>';
        });
        h += '</div>';

        // Items list
        if (!items.length) {
          h += '<div class="empty" style="padding:30px">موردی در این دسته نیست</div>';
        } else {
          // group by drug for timeline (all patients)
            const _groups = {};
            items.forEach(function(it) {
              const k = (it.drugName || '?') + '|' + (it.dose || '') + '|' + (it.route || '');
              if (!_groups[k]) _groups[k] = [];
              _groups[k].push(it);
            });
            Object.keys(_groups).forEach(function(k) {
              const g = _groups[k];
              h += M._renderItem(g[0], tab);
              if (g.length > 1 && (tab === 'history' || tab === 'due')) {
                h += M._renderTimeline(g[0].drugName, g);
              }
            });
            // prevent double loop
            items = []; // clear so any outer forEach does nothing
        }

        m.innerHTML = h;
        NABZ.state.current = p ? p.id : 'clinical.mar';
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + M._esc(e.message) + '</div>';
      }
    },

    _renderItem(x, tab) {
      const isHigh = x._isHighAlert || x._isVeryHighAlert;
      const isVery = x._isVeryHighAlert;
      const isPRN = x._isPRN;
      const isOverdue = x._isOverdue || x._isVeryOverdue;
      const status = x.status || '';

      // Status colors
      let border = '#e2e8f0';
      let bg = '#fff';
      if (status === 'missed' || isOverdue) { border = '#dc2626'; bg = '#fef2f2'; }
      else if (status === 'given') { border = '#059669'; bg = '#f0fdf4'; }
      else if (status === 'due' || status === 'scheduled') { border = '#d97706'; bg = '#fffbeb'; }
      else if (isHigh) { border = '#dc2626'; bg = '#fff'; }

      const freqRaw = ((x._orderDetails && x._orderDetails.frequency) || x.frequency || '').toUpperCase();
      const routeRaw = (x.route || '').toUpperCase();
      const freqFa = FREQ_MAP[freqRaw] || freqRaw || '';
      const routeFa = ROUTE_MAP[routeRaw] || routeRaw || '';

      let h = '<div style="margin-bottom:10px;padding:14px;border-radius:14px;border:1.5px solid ' + border + ';background:' + bg + ';box-shadow:0 2px 8px rgba(15,23,42,.06)">';

      // Header line
      h += '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px">';
      h += '<div style="font-size:22px;line-height:1">' + (isVery ? '🔴' : isHigh ? '⚠️' : isPRN ? '💊' : '💉') + '</div>';
      h += '<div style="flex:1;min-width:0">';
      h += '<div style="font-size:15px;font-weight:800;color:#0f172a;line-height:1.3">' + M._esc(x.drugName || '?');
      if (x.dose) h += ' <span style="font-weight:600;color:#475569;font-size:13px">' + M._esc(x.dose) + '</span>';
      h += '</div>';
      h += '<div style="font-size:12px;color:#64748b;margin-top:3px">';
      if (routeFa) h += '<span style="background:#e0e7ff;color:#3730a3;padding:1px 8px;border-radius:999px;font-weight:700;margin-left:4px">' + M._esc(routeFa) + '</span>';
      if (freqFa) h += '<span style="background:#dbeafe;color:#1e40af;padding:1px 8px;border-radius:999px;font-weight:700">' + M._esc(freqFa) + '</span>';
      if (isPRN) h += ' <span style="background:#fef3c7;color:#92400e;padding:1px 8px;border-radius:999px;font-weight:700">PRN</span>';
      h += '</div></div>';

      // Status pill
      const statusMap = { scheduled:'نوبت', due:'موعد', given:'داده‌شده', missed:'از دست‌رفته', refused:'رد شده', cancelled:'لغو' };
      const statusColor = { scheduled:'#3b82f6', due:'#d97706', given:'#059669', missed:'#dc2626', refused:'#dc2626' };
      h += '<span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:' + (statusColor[status]||'#94a3b8') + ';color:#fff;white-space:nowrap">' + (statusMap[status]||status) + '</span>';
      h += '</div>';

      // Time info
      h += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 10px;font-size:12px">';
      if (status === 'given' && x.administeredAt) {
        h += '<span style="background:#d1fae5;color:#065f46;padding:3px 10px;border-radius:8px;font-weight:700">✅ ' + _relTime(x.administeredAt) + '</span>';
        if (x.administeredByName || x.administeredBy) h += '<span style="color:#64748b">توسط ' + M._esc(x.administeredByName || x.administeredBy) + '</span>';
      }
      if (status === 'missed') {
        h += '<span style="background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:8px;font-weight:700">🔴 از دست‌رفته</span>';
        if (x.scheduledAt) h += '<span style="color:#64748b">زمان برنامه: ' + M._fmtTime(x.scheduledAt) + '</span>';
        if (x.missedReason) h += '<span style="color:#b91c1c;font-size:11px">' + M._esc(x.missedReason) + '</span>';
      }
      if (['scheduled','due'].includes(status)) {
        const mins = x._minutesFromScheduled || 0;
        if (mins > 30) h += '<span style="background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:8px;font-weight:700">⏰ دیرکرد ' + mins + ' دقیقه</span>';
        else if (mins < -15) h += '<span style="background:#e0e7ff;color:#3730a3;padding:3px 10px;border-radius:8px;font-weight:700">زودتر از موعد</span>';
        else h += '<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:8px;font-weight:700">⏰ ' + M._fmtTime(x.scheduledAt) + '</span>';
      }
      if (isHigh) h += '<span style="background:#dc2626;color:#fff;padding:3px 10px;border-radius:8px;font-weight:800">HIGH-ALERT</span>';
      h += '</div>';

      // Actions
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
      if (['scheduled','due'].includes(status)) {
        h += '<button class="btn btn-primary btn-sm" style="flex:1;min-width:110px;padding:10px;font-size:13px;font-weight:800;border-radius:10px" onclick="event.stopPropagation();NABZ.marUI.administer(\'' + x.id + '\')">💉 توزیع</button>';
        if (isPRN) h += '<button class="btn btn-sm" style="padding:10px 14px;font-size:12px;color:#dc2626;border:1.5px solid #dc2626;border-radius:10px;background:#fff" onclick="event.stopPropagation();NABZ.marUI.refuse(\'' + x.id + '\')">✗ رد</button>';
      }
      if (x._needsEffectiveness) {
        h += '<button class="btn btn-sm" style="flex:1;min-width:110px;padding:10px;font-size:12px;font-weight:700;background:#fef3c7;color:#92400e;border:1.5px solid #f59e0b;border-radius:10px" onclick="event.stopPropagation();NABZ.marUI.prnEffectiveness(\'' + x.id + '\')">📊 اثربخشی</button>';
      }
      h += '</div>';

      h += '</div>';
      return h;
    },


    _renderTimeline(drugName, doses) {
      if (!doses || doses.length < 2) return '';
      const sorted = doses.slice().sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0));
      const show = sorted.slice(-6);
      let h = '<div style="margin:8px 0 4px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:0 2px">';
      h += '<div style="display:flex;gap:6px;min-width:max-content">';
      show.forEach(d => {
        const st = d.status || '';
        let bg = '#f1f5f9', bd = '#cbd5e1', ic = '·', lb = st;
        if (st === 'given') { bg = '#d1fae5'; bd = '#059669'; ic = '✓'; lb = 'داده'; }
        else if (st === 'missed') { bg = '#fee2e2'; bd = '#dc2626'; ic = '✗'; lb = 'از دست'; }
        else if (st === 'due') { bg = '#fef3c7'; bd = '#d97706'; ic = '⏰'; lb = 'موعد'; }
        else if (st === 'scheduled') { bg = '#e0e7ff'; bd = '#6366f1'; ic = '○'; lb = 'نوبت'; }
        else if (st === 'refused') { bg = '#fee2e2'; bd = '#b91c1c'; ic = '⊘'; lb = 'رد'; }
        const t = d.scheduledAt ? M._fmtTime(d.scheduledAt) : '—';
        h += '<div style="flex:0 0 auto;width:58px;text-align:center">';
        h += '<div style="font-size:10px;color:#64748b;margin-bottom:3px;font-weight:600">' + t + '</div>';
        h += '<div style="height:34px;border-radius:10px;background:' + bg + ';border:1.5px solid ' + bd + ';display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:' + bd + '">' + ic + '</div>';
        h += '<div style="font-size:9px;color:#64748b;margin-top:2px">' + lb + '</div></div>';
      });
      h += '</div></div>';
      return h;
    },

    setTab(tab) {
      M._tab = tab;
      M.show(null, M._patientId ? { patientId: M._patientId } : null);
    },

    // ═══════════════════════════════════════════════════
    //  ADMINISTER MODAL
    // ═══════════════════════════════════════════════════
    async administer(marId) {
      try {
        // Always fetch with current patient context if available
        const q = M._patientId ? ('?patientId=' + encodeURIComponent(M._patientId)) : '';
        const d = await M._api('/api/mar/detailed' + q);
        const m = (d.items || []).find(x => x.id === marId);
        if (!m) return alert('رکورد MAR یافت نشد');

        const isHigh = m.isHighAlert || m._isHighAlert || m._isVeryHighAlert;
        const isVery = m._isVeryHighAlert;
        const minsLate = m._minutesFromScheduled || 0;
        const isLate = minsLate > 30;

        // ── Build safety modal ──
        let html = '<div style="padding:4px 0 12px">';
        html += '<div style="font-size:17px;font-weight:800;margin-bottom:6px">' + M._esc(m.drugName) + (m.dose ? ' — ' + M._esc(m.dose) : '') + '</div>';
        html += '<div style="font-size:12px;color:#64748b;margin-bottom:12px">' + M._esc(m.route || '') + ' · ' + M._fmtTime(m.scheduledAt) + '</div>';

        if (isVery) {
          html += '<div style="background:#7f1d1d;color:#fff;padding:10px 12px;border-radius:10px;font-weight:800;font-size:13px;margin-bottom:10px">🔴 VERY HIGH-ALERT — نیاز به تأیید پزشک مسئول</div>';
        } else if (isHigh) {
          html += '<div style="background:#dc2626;color:#fff;padding:10px 12px;border-radius:10px;font-weight:800;font-size:13px;margin-bottom:10px">⚠️ HIGH-ALERT — شاهد دوم الزامی است</div>';
        }
        if (isLate) {
          html += '<div style="background:#fef3c7;color:#92400e;padding:10px 12px;border-radius:10px;font-weight:700;font-size:12px;margin-bottom:10px">⏰ این دوز ' + minsLate + ' دقیقه تأخیر دارد — ثبت دلیل الزامی</div>';
        }

        // Five Rights checklist
        html += '<div style="font-size:12px;font-weight:700;margin:8px 0 6px">۵ حق دارو</div>';
        const rights = [
          ['patient', 'بیمار صحیح'],
          ['drug', 'داروی صحیح'],
          ['dose', 'دوز صحیح'],
          ['route', 'مسیر صحیح'],
          ['time', 'زمان صحیح']
        ];
        rights.forEach(([k, label]) => {
          html += '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px">';
          html += '<input type="checkbox" id="fr_' + k + '" checked style="width:18px;height:18px"> ' + label;
          html += '</label>';
        });

        if (isHigh) {
          html += '<div style="margin-top:12px"><label style="font-size:12px;font-weight:700">نام / کد شاهد دوم *</label>';
          html += '<input id="mar_witness" type="text" placeholder="مثلاً usr_nurse2 یا نام پرستار" style="width:100%;margin-top:4px;padding:10px;border:1.5px solid #dc2626;border-radius:10px;font-size:14px"></div>';
        }
        if (isLate) {
          html += '<div style="margin-top:12px"><label style="font-size:12px;font-weight:700">دلیل تأخیر *</label>';
          html += '<select id="mar_late_reason" style="width:100%;margin-top:4px;padding:10px;border:1.5px solid #d97706;border-radius:10px;font-size:13px">';
          html += '<option value="">— انتخاب کنید —</option>';
          html += '<option value="patient_npo">بیمار NPO / ناشتا</option>';
          html += '<option value="procedure_pending">منتظر پروسیجر</option>';
          html += '<option value="doctor_hold">دستور نگه‌داشتن پزشک</option>';
          html += '<option value="pharmacy_delay">تأخیر داروخانه</option>';
          html += '<option value="clinical_decision">تصمیم بالینی پرستار</option>';
          html += '<option value="patient_refused">رد بیمار</option>';
          html += '<option value="patient_off_unit">بیمار خارج از بخش</option>';
          html += '<option value="iv_access_issue">مشکل دسترسی وریدی</option>';
          html += '<option value="medication_unavailable">دارو موجود نبود</option>';
          html += '<option value="other">سایر</option>';
          html += '</select></div>';
        }

        html += '<div style="margin-top:12px"><label style="font-size:12px;font-weight:700">یادداشت (اختیاری)</label>';
        html += '<input id="mar_notes" type="text" style="width:100%;margin-top:4px;padding:10px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px"></div>';
        html += '</div>';

        // Use sheet if available, else confirm flow
        const doSubmit = async () => {
          const fiveRights = {};
          let allOk = true;
          rights.forEach(([k]) => {
            const el = document.getElementById('fr_' + k);
            fiveRights[k] = !!(el && el.checked);
            if (!fiveRights[k]) allOk = false;
          });
          if (!allOk) return alert('همهٔ ۵ حق دارو باید تأیید شوند');

          let witnessId = null;
          if (isHigh) {
            const w = document.getElementById('mar_witness');
            witnessId = w ? (w.value || '').trim() : '';
            if (!witnessId || witnessId.length < 2) return alert('برای داروی High-Alert وارد کردن شاهد الزامی است');
          }
          let lateReason = null;
          if (isLate) {
            const lr = document.getElementById('mar_late_reason');
            lateReason = lr ? lr.value : '';
            if (!lateReason) return alert('دلیل تأخیر را انتخاب کنید');
          }
          const notesEl = document.getElementById('mar_notes');
          const notes = notesEl ? notesEl.value : '';

          try {
            // Prefer advanced endpoint
            await M._api('/api/mar/' + marId + '/administer-advanced', {
              method: 'POST',
              body: JSON.stringify({
                fiveRights,
                witnessId: witnessId || undefined,
                lateReason: lateReason || undefined,
                notes: notes || undefined
              })
            });
            if (typeof NABZ._toast === 'function') NABZ._toast('✅ دارو ثبت شد');
            else alert('✅ دارو ثبت شد');
            M.show(null, M._patientId ? { patientId: M._patientId } : null);
          } catch (err) {
            // fallback to basic clinical endpoint
            try {
              await M._api('/api/clinical/mar/' + marId + '/administer', {
                method: 'POST',
                body: JSON.stringify({ fiveRights, witnessId, notes, lateReason })
              });
              if (typeof NABZ._toast === 'function') NABZ._toast('✅ دارو ثبت شد');
              M.show(null, M._patientId ? { patientId: M._patientId } : null);
            } catch (e2) {
              alert('خطا: ' + (e2.message || e2));
            }
          }
        };

        if (typeof M._openSheet === 'function') {
          html += '<button class="btn btn-primary" style="width:100%;margin-top:14px;padding:14px;font-size:15px;font-weight:800;border-radius:12px" id="mar_admin_btn">💉 تأیید و ثبت توزیع</button>';
          M._openSheet(html);
          setTimeout(() => {
            const btn = document.getElementById('mar_admin_btn');
            if (btn) btn.onclick = doSubmit;
          }, 50);
        } else {
          // fallback minimal
          if (!confirm('ثبت توزیع ' + (m.drugName || '') + '؟')) return;
          await doSubmit();
        }
      } catch (e) {
        alert('خطا: ' + (e.message || e));
      }
    },

    async _submitAdminister(marId, needsWitness, isLate) {
      const rights = {};
      let allChecked = true;
      document.querySelectorAll('[data-right]').forEach(cb => {
        rights[cb.dataset.right] = cb.checked;
        if (!cb.checked) allChecked = false;
      });
      if (!allChecked) return alert('همه ۵ rights باید تأیید شوند');

      const body = { fiveRights: rights };
      if (isLate) {
        const lr = document.getElementById('marLateReason');
        if (!lr || !lr.value) return alert('دلیل تأخیر الزامی است');
        body.lateReason = lr.value;
      }
      if (needsWitness) {
        const w = document.getElementById('marWitness');
        if (!w || !w.value.trim()) return alert('کد شاهد الزامی است');
        body.witnessedBy = w.value.trim();
      }
      const notes = document.getElementById('marNotes');
      if (notes && notes.value) body.notes = notes.value;

      try {
        const r = await M._api('/api/mar/' + marId + '/administer-advanced', {
          method: 'POST', body: JSON.stringify(body)
        });
        M._closeAll();
        NABZ._toast('✅ توزیع شد');
        // If PRN — prompt effectiveness
        if (r.prnEffectivenessPending) {
          setTimeout(() => M.prnEffectiveness(marId), 400);
        } else {
          M.show(null, null);
        }
      } catch (e) {
        // Special handling for allergy override
        if (String(e.message).indexOf('allergy_conflict') >= 0) {
          const override = prompt('⚠️ آلرژی: ' + e.message + '\n\nدلیل override (فقط attending):');
          if (override) {
            body.overrideReason = override;
            try {
              await M._api('/api/mar/' + marId + '/administer-advanced', {
                method: 'POST', body: JSON.stringify(body)
              });
              M._closeAll();
              NABZ._toast('✅ با override توزیع شد');
              M.show(null, null);
            } catch (e2) { alert('خطا: ' + e2.message); }
          }
        } else {
          alert('خطا: ' + e.message);
        }
      }
    },

    // ═══════════════════════════════════════════════════
    //  PRN EFFECTIVENESS
    // ═══════════════════════════════════════════════════
    async prnEffectiveness(marId) {
      let h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">📊 اثربخشی PRN</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="hint warn" style="margin-bottom:14px">⚠️ الزام JCI: اثربخشی PRN باید ظرف ۱ ساعت مستند شود</div>';

      h += '<div class="wf-field"><label>مقیاس *</label>';
      h += '<select id="prnScale" style="font-weight:800">';
      Object.entries(SCALE_FA).forEach(([k, v]) => {
        h += '<option value="' + k + '">' + v + ' (0-10)</option>';
      });
      h += '</select></div>';

      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
      h += '<div class="wf-field" style="margin:0"><label>قبل از دارو</label>';
      h += '<input type="number" id="prnBefore" min="0" max="10" value="8" style="font-size:24px;text-align:center;font-weight:900;padding:12px"></div>';
      h += '<div class="wf-field" style="margin:0"><label>بعد از دارو</label>';
      h += '<input type="number" id="prnAfter" min="0" max="10" style="font-size:24px;text-align:center;font-weight:900;padding:12px"></div>';
      h += '</div>';

      h += '<div id="prnDelta" style="text-align:center;padding:8px;background:var(--bg-2);border-radius:8px;margin-bottom:8px;font-size:13px;font-weight:800">—</div>';

      h += '<div class="wf-field"><label>یادداشت</label><textarea id="prnNotes" rows="2" placeholder="اختیاری"></textarea></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.marUI._submitEffectiveness(\'' + marId + '\')">✅ ثبت اثربخشی</button>';

      const s = M._openSheet(h);
      // Live delta
      ['prnBefore','prnAfter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
          const before = parseFloat(document.getElementById('prnBefore').value) || 0;
          const after = parseFloat(document.getElementById('prnAfter').value);
          const delta = document.getElementById('prnDelta');
          if (isNaN(after)) { delta.textContent = '—'; return; }
          const d = before - after;
          const pct = before > 0 ? Math.round((d / before) * 100) : 0;
          delta.textContent = (d >= 0 ? '📉 بهبود ' : '📈 بدتر شد ') + Math.abs(d) + ' (' + pct + '%)';
          delta.style.color = d >= 2 ? 'var(--ok)' : d < 0 ? 'var(--dng)' : 'var(--warn)';
        });
      });
    },

    async _submitEffectiveness(marId) {
      const body = {
        scale: document.getElementById('prnScale').value,
        before: parseFloat(document.getElementById('prnBefore').value),
        after: parseFloat(document.getElementById('prnAfter').value),
        notes: document.getElementById('prnNotes').value
      };
      if (isNaN(body.before) || isNaN(body.after)) return alert('قبل و بعد را وارد کنید');
      try {
        await M._api('/api/mar/' + marId + '/prn-effectiveness', {
          method: 'POST', body: JSON.stringify(body)
        });
        M._closeAll();
        NABZ._toast('✅ اثربخشی ثبت شد');
        M.show(null, null);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  SLIDING SCALE
    // ═══════════════════════════════════════════════════
    async slidingScale() {
      let h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">🧮 Sliding Scale — Insulin</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      let scales = { items: [] };
      try { scales = await M._api('/api/mar/sliding-scales'); } catch (_) {}

      h += '<div class="wf-field"><label>پروتکل</label>';
      h += '<select id="ssScale" style="font-weight:800">';
      (scales.items || []).forEach(s => {
        h += '<option value="' + s.code + '">' + M._esc(s.label) + '</option>';
      });
      h += '</select></div>';

      h += '<div class="wf-field"><label>قند خون (mg/dL) *</label>';
      h += '<input type="number" id="ssGlucose" placeholder="مثلاً 250" style="font-size:24px;text-align:center;font-weight:900;padding:12px" oninput="NABZ.marUI._autoCalcSS()"></div>';

      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.marUI._calcSS()">🧮 محاسبه دوز</button>';
      h += '<div id="ssResult" style="margin-top:14px"></div>';

      M._openSheet(h);
    },

    _autoCalcSS() {
      const g = document.getElementById('ssGlucose').value;
      if (g && !isNaN(+g)) M._calcSS();
    },

    async _calcSS() {
      const g = parseFloat(document.getElementById('ssGlucose').value);
      if (isNaN(g) || g < 0) return;
      const scale = document.getElementById('ssScale').value;
      try {
        const r = await M._api('/api/mar/sliding-scale/calculate', {
          method: 'POST', body: JSON.stringify({ glucose: g, scale })
        });
        const el = document.getElementById('ssResult');
        const color = r.actionType === 'hypo' || r.actionType === 'hyper' ? 'dng' : r.units > 0 ? 'info' : 'ok';
        let h = '<div class="card" style="border-color:var(--' + color + ')">';
        h += '<div style="font-size:11px;color:var(--fg-2)">' + M._esc(r.scaleLabel) + '</div>';
        h += '<div style="font-size:36px;font-weight:900;color:var(--' + color + ');text-align:center;line-height:1.1;margin:8px 0">';
        if (r.units > 0) h += r.units + 'U';
        else h += '۰ واحد';
        h += '</div>';
        h += '<div style="font-size:11px;color:var(--fg-2);text-align:center">قند: ' + g + ' mg/dL</div>';
        if (r.note) h += '<div style="font-size:12px;margin-top:6px;padding:6px;background:var(--bg-3);border-radius:6px">' + M._esc(r.note) + '</div>';
        if (r.action) h += '<div style="font-size:12px;color:var(--dng);font-weight:900;margin-top:8px;padding:8px;background:var(--dng-soft);border-radius:6px">⚠️ ' + M._esc(r.action) + '</div>';
        if (r.units > 0 && r.drug) {
          h += '<div style="font-size:11px;margin-top:6px;text-align:center">دارو: <b>' + M._esc(r.drug) + '</b> · مسیر: <b>' + M._esc(r.route) + '</b></div>';
        }
        h += '</div>';
        el.innerHTML = h;
      } catch (e) {
        document.getElementById('ssResult').innerHTML = '<div class="empty">خطا: ' + M._esc(e.message) + '</div>';
      }
    },

    // ═══════════════════════════════════════════════════
    //  HANDOFF
    // ═══════════════════════════════════════════════════
    async handoff(p, d) {
      const m = document.getElementById('content');
      if (!d) {
        m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
        try { d = await M._api('/api/mar/handoff'); }
        catch (e) { m.innerHTML = '<div class="empty">خطا: ' + M._esc(e.message) + '</div>'; return; }
      }
      const c = d.counts || {};
      let h = '<div class="sec-hd"><span>📋 تحویل شیفت — MAR</span>';
      h += '<span class="rd-mini">' + ((d.window && d.window.hours) || 8) + ' ساعت</span></div>';

      h += '<div class="rd-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">';
      h += '<div class="rd-stat ok"><div class="v">' + (c.given || 0) + '</div><div class="l">داده‌شده</div></div>';
      h += '<div class="rd-stat ' + ((c.missed || 0) > 0 ? 'dng' : '') + '"><div class="v">' + (c.missed || 0) + '</div><div class="l">Missed</div></div>';
      h += '<div class="rd-stat ' + ((c.prnWithoutEffectiveness || 0) > 0 ? 'warn' : '') + '"><div class="v">' + (c.prnWithoutEffectiveness || 0) + '</div><div class="l">PRN بی‌ارزیابی</div></div>';
      h += '</div>';

      h += '<div class="rd-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">';
      h += '<div class="rd-stat info"><div class="v">' + (c.highAlertGiven || 0) + '</div><div class="l">High-Alert</div></div>';
      h += '<div class="rd-stat"><div class="v">' + (c.lateGiven || 0) + '</div><div class="l">تأخیر</div></div>';
      h += '<div class="rd-stat"><div class="v">' + (c.pending || 0) + '</div><div class="l">در انتظار</div></div>';
      h += '</div>';

      // Missed details
      if (d.details.missed && d.details.missed.length) {
        h += '<div class="sec-hd" style="margin-top:14px"><span style="color:var(--dng)">⚠️ Missed (' + d.details.missed.length + ')</span></div>';
        d.details.missed.forEach(x => {
          h += '<div class="row hi" style="padding:8px 10px;margin-bottom:4px">';
          h += '<div style="font-weight:800;font-size:12px">' + M._esc(x.drugName) + '</div>';
          h += '<div style="font-size:10.5px;color:var(--fg-2)">' + M._esc(x.patientName) + ' · ' + x.minutesLate + ' دقیقه</div>';
          h += '</div>';
        });
      }

      // PRN missing effectiveness
      if (d.details.prnWithoutEffectiveness && d.details.prnWithoutEffectiveness.length) {
        h += '<div class="sec-hd" style="margin-top:14px"><span style="color:var(--warn)">📊 PRN بدون اثربخشی</span></div>';
        d.details.prnWithoutEffectiveness.forEach(x => {
          h += '<div class="row md" style="padding:8px 10px;margin-bottom:4px;cursor:pointer" onclick="NABZ.marUI.prnEffectiveness(\'' + x.id + '\')">';
          h += '<div style="font-weight:800;font-size:12px">' + M._esc(x.drugName) + '</div>';
          h += '<div style="font-size:10.5px;color:var(--fg-2)">' + M._esc(x.patientName) + '</div>';
          h += '</div>';
        });
      }

      // High-alert given
      if (d.details.highAlertGiven && d.details.highAlertGiven.length) {
        h += '<div class="sec-hd" style="margin-top:14px"><span>⚠️ High-Alert داده‌شده</span></div>';
        d.details.highAlertGiven.forEach(x => {
          h += '<div class="row lo" style="padding:8px 10px;margin-bottom:4px">';
          h += '<div style="font-weight:800;font-size:12px">' + M._esc(x.drugName) + ' — ' + M._esc(x.dose) + '</div>';
          h += '<div style="font-size:10.5px;color:var(--fg-2)">' + M._esc(x.patientName) + (x.witnessedBy ? ' · شاهد: ' + M._esc(x.witnessedBy) : ' · ⚠️ بدون شاهد') + '</div>';
          h += '</div>';
        });
      }

      // Late given
      if (d.details.lateGiven && d.details.lateGiven.length) {
        h += '<div class="sec-hd" style="margin-top:14px"><span style="color:var(--warn)">⏰ تأخیرها</span></div>';
        d.details.lateGiven.forEach(x => {
          h += '<div class="row md" style="padding:8px 10px;margin-bottom:4px">';
          h += '<div style="font-weight:800;font-size:12px">' + M._esc(x.drugName) + '</div>';
          h += '<div style="font-size:10.5px;color:var(--fg-2)">' + M._esc(x.patientName) + ' · ' + x.minutesLate + ' دقیقه · ' + M._esc(x.reason) + '</div>';
          h += '</div>';
        });
      }

      // Print button
      h += '<button class="btn btn-block" style="padding:12px;margin-top:14px" onclick="NABZ.marUI._printHandoff()">🖨 چاپ خلاصه</button>';

      m.innerHTML = h;
      NABZ.state.current = p ? p.id : 'mar_advanced.handoff';
    },

    _printHandoff() {
      const m = document.getElementById('content');
      const user = NABZ.state.user;
      let html = '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><title>تحویل شیفت — MAR</title>';
      html += '<style>@page{size:A4;margin:15mm}body{font-family:Vazirmatn,Tahoma,sans-serif;font-size:11px}h1{font-size:16px;color:#0891b2}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #cbd5e1;padding:6px;font-size:10px}th{background:#e0f2fe}</style>';
      html += '</head><body><h1>📋 تحویل شیفت — MAR</h1>';
      html += '<p>' + (user ? user.fullName : '') + ' — ' + new Date().toLocaleString('fa-IR') + '</p>';
      html += m.innerHTML.replace(/<button[^>]*>.*?<\/button>/g, '').replace(/class="[^"]*"/g, '');
      html += '</body></html>';
      const w = window.open('', '_blank');
      if (!w) return alert('پاپ‌آپ مسدود است');
      w.document.open(); w.document.write(html); w.document.close();
      setTimeout(() => { try { w.focus(); w.print(); } catch(_) { alert('Ctrl+P'); } }, 500);
    },

    // ═══════════════════════════════════════════════════
    //  HIGH-ALERT AUDIT
    // ═══════════════════════════════════════════════════
    async highAlertAudit() {
      try {
        const d = await M._api('/api/mar/high-alert-audit?days=7');
        let h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">🔍 High-Alert Audit — ۷ روز</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        const compliance = d.compliancePct || 100;
        const color = compliance >= 95 ? 'ok' : compliance >= 80 ? 'warn' : 'dng';
        h += '<div class="card" style="text-align:center;border-color:var(--' + color + ');margin-bottom:12px">';
        h += '<div style="font-size:48px;font-weight:900;color:var(--' + color + ')">' + compliance + '%</div>';
        h += '<div style="font-size:11px;color:var(--fg-2)">Witness Compliance</div>';
        h += '</div>';

        h += '<div class="rd-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">';
        h += '<div class="rd-stat"><div class="v">' + d.totalHighAlert + '</div><div class="l">کل High-Alert</div></div>';
        h += '<div class="rd-stat ok"><div class="v">' + d.withWitness + '</div><div class="l">با شاهد</div></div>';
        h += '<div class="rd-stat ' + (d.withoutWitness > 0 ? 'dng' : '') + '"><div class="v">' + d.withoutWitness + '</div><div class="l">بدون شاهد</div></div>';
        h += '</div>';

        if (d.violations.length) {
          h += '<div style="font-size:12px;font-weight:900;color:var(--dng);margin:12px 0 6px">⚠️ نقض‌ها</div>';
          d.violations.forEach(v => {
            h += '<div class="row hi" style="padding:8px 10px;margin-bottom:4px">';
            h += '<div style="font-weight:800;font-size:12px">' + M._esc(v.drugName) + '</div>';
            h += '<div style="font-size:10.5px;color:var(--fg-2)">' + M._esc(v.patientName) + ' · ' + M._esc(v.administeredBy || '') + ' · ' + M._fmtTime(v.administeredAt) + '</div>';
            h += '</div>';
          });
        }

        M._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  REFUSE
    // ═══════════════════════════════════════════════════
    async refuse(marId) {
      const reason = prompt('دلیل رد دوز:');
      if (!reason) return;
      try {
        await M._api('/api/clinical/mar/' + marId + '/refuse', {
          method: 'POST', body: JSON.stringify({ reason })
        });
        NABZ._toast('✅ ثبت شد');
        M.show(null, null);
      } catch (e) { alert('خطا: ' + e.message); }
    }
  };

  // ═══ Bootstrap ═══
  let waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 60) return console.warn('[mar-ui] timeout');
    setTimeout(() => ready(fn), 100);
  }

  ready(() => {
    NABZ.marUI = M;

    if (typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('mar_v2', async (p, d) => {
      await M.show(p, d);
      if (d && d.patientId) {
        var content = document.getElementById('content');
        if (content && !document.getElementById('mar-pat-header')) {
          var banner = document.createElement('div');
          banner.id = 'mar-pat-header';
          banner.style.cssText = 'background:linear-gradient(90deg,#0ea5e9,#0284c7);color:white;padding:12px;margin:8px 12px;border-radius:12px;text-align:center;font-weight:900;font-size:14px;box-shadow:0 4px 6px rgba(0,0,0,0.1);direction:rtl;';
          NABZ._api('/api/patients/' + d.patientId).then(function(pat) {
            var pt = (pat && pat.patient) || pat || {};
            var name = ((pt.firstName||'') + ' ' + (pt.lastName||'')).trim() || d.patientId;
            banner.innerHTML = '💊 MAR بیمار: ' + name + ' (' + (pt.mrn||d.patientId) + ')';
            content.insertBefore(banner, content.firstChild);
          }).catch(function(){});
        }
      }
    });
      NABZ.registerKind('mar_handoff', (p, d) => M.handoff(p, d));
    }

    // Handle showItem for MAR
    const prevShowItem = NABZ.showItem;
    if (typeof prevShowItem === 'function') {
      NABZ.showItem = function(pid, iid) {
        if (pid === 'clinical.mar' || pid === 'mar_advanced.detailed') {
          return M.administer(iid);
        }
        return prevShowItem.apply(NABZ, arguments);
      };
    }

    console.log('[mar-ui] loaded ✓ — MAR Advanced (ISMP 2024, JCI, sliding scale)');
  });
})();
