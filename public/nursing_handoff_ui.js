
// ═══════════════════════════════════════════════════════════
//  NABZ — Nursing Handoff UI
//  Board + preview + edit + sign + readback + print
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  const PRIORITY_FA = { critical:'بحرانی', high:'پرخطر', medium:'متوسط', low:'پایدار' };
  const PRIORITY_CLS = { critical:'dng', high:'dng', medium:'warn', low:'ok' };
  const SHIFT_FA = { morning:'صبح', evening:'عصر', night:'شب' };

  const NHB = {
    _api: (p, o) => NABZ._api(p, o),
    _esc: s => NABZ._esc(s),
    _state: { board: null, preview: null, patientId: null },

    _closeAll() { document.querySelectorAll('.bs-backdrop').forEach(el => el.remove()); },

    _openSheet(html, opts) {
      opts = opts || {};
      const sheet = document.createElement('div');
      sheet.className = 'bs-backdrop';
      sheet.onclick = e => { if (e.target === sheet && !opts.noClose) sheet.remove(); };
      const c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '96vh';
      c.innerHTML = html;
      sheet.appendChild(c);
      document.body.appendChild(sheet);
      requestAnimationFrame(() => sheet.classList.add('show'));
      return { sheet, content: c };
    },

    _fmt(iso) {
      try { return new Date(iso).toLocaleString('fa-IR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); }
      catch (_) { return '—'; }
    },

    // ═══════════════════════════════════════════════════
    //  BOARD
    // ═══════════════════════════════════════════════════
    async show(p, d) {
      const m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) d = await NHB._api('/api/nh/board');
        NHB._state.board = d;
        NHB._renderBoard(d);
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + NHB._esc(e.message) + '</div>';
      }
    },

    _renderBoard(d) {
      const m = document.getElementById('content');
      const items = d.items || [];
      const stats = d.stats || {};

      let h = '<div class="sec-hd"><span>🔄 تحویل شیفت — پرستاری</span>';
      h += '<span class="rd-mini">' + (d.ward || 'همه بخش‌ها') + ' · ' + items.length + '</span></div>';

      // Priority summary
      h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">';
      h += '<div class="rd-stat dng"><div class="v">' + (stats.critical || 0) + '</div><div class="l">بحرانی</div></div>';
      h += '<div class="rd-stat warn"><div class="v">' + (stats.high || 0) + '</div><div class="l">پرخطر</div></div>';
      h += '<div class="rd-stat info"><div class="v">' + (stats.medium || 0) + '</div><div class="l">متوسط</div></div>';
      h += '<div class="rd-stat ok"><div class="v">' + (stats.low || 0) + '</div><div class="l">پایدار</div></div>';
      h += '</div>';

      // Incoming handoffs awaiting readback
      NHB._loadIncoming();

      // Actions
      h += '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">';
      h += '<button class="btn btn-sm" style="padding:8px 12px;font-size:11px" onclick="NABZ.nhbUI.audit()">📊 Audit ۷ روز</button>';
      h += '<button class="btn btn-sm" style="padding:8px 12px;font-size:11px" onclick="NABZ.nhbUI.history()">📚 تاریخچه</button>';
      h += '</div>';

      if (!items.length) {
        h += '<div class="empty" style="padding:40px">بیماری در این بخش بستری نیست</div>';
        m.innerHTML = h;
        return;
      }

      items.forEach(it => {
        const pr = it.priority || { level: 'low', score: 0, reasons: [] };
        const cls = PRIORITY_CLS[pr.level] || 'lo';
        h += '<div class="row ' + (pr.level === 'critical' || pr.level === 'high' ? 'hi' : pr.level === 'medium' ? 'md' : 'lo') + '" style="margin-bottom:6px">';
        h += '<div class="row-hd">';
        h += '<div class="row-title">' + NHB._esc(it.patientName) + '</div>';
        h += '<span class="pill ' + cls + '" style="font-weight:900">' + pr.score + ' · ' + PRIORITY_FA[pr.level] + '</span>';
        h += '</div>';
        h += '<div class="row-meta">' + (it.age || '—') + ' س · ' + NHB._esc(it.wardCode || '') + ' · تخت ' + NHB._esc(it.bedNumber || '—') + '</div>';
        h += '<div class="row-meta">' + NHB._esc(it.diagnosis || '') + '</div>';
        // Vitals strip
        if (it.lastVital) {
          const v = it.lastVital;
          h += '<div class="row-meta" style="font-size:11px;color:var(--fg-2)">';
          h += 'HR ' + (v.hr || '—') + ' · BP ' + (v.bp_sys || '—') + ' · SpO₂ ' + (v.spo2 || '—') + '% · NEWS2 ' + (v.news2 || '—');
          if (v.news2 >= 7) h += ' <span style="color:var(--dng);font-weight:900">🚨</span>';
          else if (v.news2 >= 5) h += ' <span style="color:var(--warn);font-weight:900">⚠️</span>';
          h += '</div>';
        }
        // Reasons
        if (pr.reasons && pr.reasons.length) {
          h += '<div class="row-meta" style="font-size:11px;color:var(--dng);font-weight:800">' + NHB._esc(pr.reasons.join(' · ')) + '</div>';
        }
        // Summary meta
        h += '<div class="row-meta" style="font-size:10.5px;color:var(--fg-3)">';
        if (it.activeDiagnoses) h += '📋 ' + it.activeDiagnoses + ' تشخیص · ';
        if (it.missedMar) h += '💊 ' + it.missedMar + ' missed';
        h += '</div>';
        // Actions
        h += '<div style="display:flex;gap:6px;margin-top:8px">';
        h += '<button class="btn btn-primary btn-sm" style="flex:1;padding:8px 12px;font-size:11px;font-weight:900" onclick="event.stopPropagation();NABZ.nhbUI.generate(\'' + it.patientId + '\')">📝 تولید ISBAR</button>';
        h += '</div>';
        h += '</div>';
      });

      m.innerHTML = h;
      NABZ.state.current = p ? p.id : 'nursing_handoff_bridge.board';
    },

    async _loadIncoming() {
      try {
        const reports = await NHB._api('/api/nh/history?status=signed&since=' + new Date(Date.now() - 24 * 3600000).toISOString());
        const pending = (reports.items || []).filter(r => !r.receivedAt);
        if (!pending.length) return;

        const h = document.getElementById('incomingHandoffs');
        if (h) h.remove();

        let html = '<div id="incomingHandoffs" style="background:var(--warn-soft);border:2px solid var(--warn);border-radius:12px;padding:12px;margin-bottom:12px">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
        html += '<div style="font-size:13px;font-weight:900;color:var(--warn)">📥 تحویل‌های منتظر Read-back</div>';
        html += '<span class="pill warn">' + pending.length + '</span>';
        html += '</div>';
        pending.slice(0, 5).forEach(r => {
          html += '<div onclick="NABZ.nhbUI.readback(\'' + r.id + '\')" style="cursor:pointer;background:var(--bg-2);border-radius:8px;padding:8px;margin-bottom:4px;font-size:11.5px">';
          html += '<div style="font-weight:900">' + NHB._esc(r.patientName) + '</div>';
          html += '<div style="font-size:10.5px;color:var(--fg-2)">' + NHB._esc(r.wardCode || '') + ' · ' + (SHIFT_FA[r.shiftType] || r.shiftType) + ' · از ' + NHB._esc(r.fromUserName || '') + '</div>';
          html += '<div style="font-size:10px;color:var(--primary);font-family:monospace;margin-top:2px">' + NHB._esc(r.uniqueCode || '') + '</div>';
          html += '</div>';
        });
        html += '</div>';

        const content = document.getElementById('content');
        if (content) content.insertAdjacentHTML('afterbegin', html);
      } catch (_) {}
    },

    // ═══════════════════════════════════════════════════
    //  GENERATE (preview + edit + submit)
    // ═══════════════════════════════════════════════════
    async generate(patientId) {
      NHB._state.patientId = patientId;
      try {
        NABZ._toast('در حال جمع‌آوری داده...');
        const preview = await NHB._api('/api/nh/preview/' + patientId);
        NHB._state.preview = preview;
        NHB._renderPreview(preview);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _renderPreview(pr) {
      const patient = pr.patient;
      const isbar = pr.isbar;
      const priority = pr.priority;
      const meta = pr.metadata;

      const cls = PRIORITY_CLS[priority.level] || 'info';

      let h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">📝 ISBAR — ' + NHB._esc(patient.name) + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      // Patient + priority header
      h += '<div class="card" style="background:linear-gradient(135deg,rgba(6,182,212,0.1),rgba(139,92,246,0.05));margin-bottom:12px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
      h += '<div>';
      h += '<div style="font-weight:900;font-size:15px">' + NHB._esc(patient.name) + '</div>';
      h += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:2px">' + (patient.age || '—') + ' س · ' + NHB._esc(patient.wardCode || '') + ' · تخت ' + NHB._esc(patient.bedNumber || '—') + '</div>';
      h += '<div style="font-size:11.5px;color:var(--fg-2)">' + NHB._esc(patient.diagnosis || '') + '</div>';
      h += '</div>';
      h += '<div style="text-align:left"><div style="font-size:24px;font-weight:900;color:var(--' + cls + ');line-height:1">' + priority.score + '</div>';
      h += '<div style="font-size:9px;color:var(--fg-2);font-weight:800">' + PRIORITY_FA[priority.level] + '</div></div>';
      h += '</div>';
      if (priority.reasons && priority.reasons.length) {
        h += '<div style="font-size:10.5px;color:var(--dng);margin-top:6px;font-weight:800">⚠️ ' + NHB._esc(priority.reasons.join(' · ')) + '</div>';
      }
      h += '</div>';

      // ISBAR form
      h += '<div class="card" style="margin-bottom:12px">';

      // S
      h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin-bottom:4px">S — Situation</div>';
      h += '<div class="wf-field" style="margin-bottom:8px"><label>وضعیت فعلی *</label>';
      h += '<textarea id="nhbS" rows="2" style="font-size:12px">' + NHB._esc(isbar.situation.currentIssue) + '</textarea></div>';
      h += '<div class="wf-field" style="margin-bottom:8px"><label>ویتال خلاصه</label>';
      h += '<input type="text" id="nhbSVit" value="' + NHB._esc(isbar.situation.vitals) + '"></div>';

      // B
      h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin:10px 0 4px">B — Background</div>';
      h += '<div class="wf-field" style="margin-bottom:8px"><label>سابقه</label>';
      h += '<textarea id="nhbB" rows="2" style="font-size:12px">' + NHB._esc(isbar.background.reason) + '</textarea></div>';

      // A
      h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin:10px 0 4px">A — Assessment</div>';
      h += '<div class="wf-field" style="margin-bottom:8px"><label>ارزیابی بالینی *</label>';
      h += '<textarea id="nhbA" rows="4" style="font-size:12px">' + NHB._esc(isbar.assessment.clinicalImpression) + '</textarea></div>';

      // R
      h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin:10px 0 4px">R — Recommendation</div>';
      h += '<div class="wf-field" style="margin-bottom:8px"><label>اقدامات بعدی</label>';
      h += '<textarea id="nhbR" rows="3" style="font-size:12px">' + NHB._esc(isbar.recommendation.followUp) + '</textarea></div>';

      // Shift
      h += '<div class="wf-field"><label>شیفت</label>';
      h += '<select id="nhbShift">';
      ['morning','evening','night'].forEach(s => {
        h += '<option value="' + s + '">' + SHIFT_FA[s] + '</option>';
      });
      h += '</select></div>';

      h += '</div>';

      // Metadata summary
      if (meta) {
        h += '<div class="card" style="background:var(--bg-2);margin-bottom:12px">';
        h += '<div style="font-size:11px;font-weight:900;color:var(--fg-2);margin-bottom:6px">📊 داده‌های جمع‌آوری‌شده</div>';
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">';
        if (meta.activeDiagnoses && meta.activeDiagnoses.length) {
          h += '<div style="padding:6px;background:var(--bg-3);border-radius:6px"><b>' + meta.activeDiagnoses.length + '</b> تشخیص فعال</div>';
        }
        if (meta.missedMar && meta.missedMar.length) {
          h += '<div style="padding:6px;background:var(--dng-soft);border-radius:6px"><b style="color:var(--dng)">' + meta.missedMar.length + '</b> missed MAR</div>';
        }
        if (meta.prnPending) {
          h += '<div style="padding:6px;background:var(--warn-soft);border-radius:6px"><b style="color:var(--warn)">' + meta.prnPending + '</b> PRN بی‌ارزیابی</div>';
        }
        if (meta.criticalLabs && meta.criticalLabs.length) {
          h += '<div style="padding:6px;background:var(--dng-soft);border-radius:6px"><b style="color:var(--dng)">' + meta.criticalLabs.length + '</b> lab بحرانی</div>';
        }
        if (meta.isolations && meta.isolations.length) {
          h += '<div style="padding:6px;background:var(--info-soft);border-radius:6px">🧼 ایزوله ' + NHB._esc(meta.isolations[0].type) + '</div>';
        }
        if (meta.sepsisActive) {
          h += '<div style="padding:6px;background:var(--dng-soft);border-radius:6px;color:var(--dng);font-weight:900">🦠 سپسیس فعال</div>';
        }
        h += '</div>';
        if (meta.pendingTasks && meta.pendingTasks.length) {
          h += '<div style="margin-top:8px;font-size:11px;color:var(--fg-2)"><b>وظایف باقیمانده:</b><br>' + meta.pendingTasks.map(t => '· ' + NHB._esc(t)).join('<br>') + '</div>';
        }
        h += '</div>';
      }

      // Actions
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-bottom:8px;font-weight:900;font-size:14px" onclick="NABZ.nhbUI.submit()">✍️ امضا و ثبت</button>';
      h += '<button class="btn btn-block" style="padding:10px;font-size:12px" onclick="this.closest(\'.bs-backdrop\').remove()">انصراف</button>';

      NHB._openSheet(h, { noClose: true });
    },

    async submit() {
      const pr = NHB._state.preview;
      if (!pr) return alert('Preview missing');
      const currentIssue = document.getElementById('nhbS').value.trim();
      const vitals = document.getElementById('nhbSVit').value.trim();
      const reason = document.getElementById('nhbB').value.trim();
      const impression = document.getElementById('nhbA').value.trim();
      const followUp = document.getElementById('nhbR').value.trim();
      const shift = document.getElementById('nhbShift').value;

      if (!currentIssue) return alert('وضعیت فعلی الزامی است');
      if (!impression) return alert('ارزیابی بالینی الزامی است');

      try {
        const r = await NHB._api('/api/nh/submit', {
          method: 'POST',
          body: JSON.stringify({
            patientId: pr.patient.id,
            shiftType: shift,
            isbar: {
              situation: { currentIssue, vitals },
              background: { reason, history: '' },
              assessment: { diagnoses: pr.isbar.assessment.diagnoses, clinicalImpression: impression },
              recommendation: { followUp }
            },
            metadata: pr.metadata
          })
        });
        NHB._closeAll();
        NABZ._toast('✅ تحویل ثبت شد — کد: ' + r.uniqueCode);
        NHB.show(null, null);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  READBACK (receiver)
    // ═══════════════════════════════════════════════════
    async readback(reportId) {
      try {
        const d = await NHB._api('/api/nh/history');
        const r = (d.items || []).find(x => x.id === reportId);
        if (!r) return alert('گزارش یافت نشد');
        if (r.receivedAt) return alert('قبلاً دریافت شده');

        let h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">📥 دریافت تحویل — ' + NHB._esc(r.patientName) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        h += '<div class="card" style="background:var(--primary-soft);margin-bottom:12px">';
        h += '<div style="font-size:11.5px;color:var(--fg-2)">از: <b>' + NHB._esc(r.fromUserName || '') + '</b> · شیفت: ' + (SHIFT_FA[r.shiftType] || r.shiftType) + '</div>';
        h += '<div style="font-size:11.5px;color:var(--fg-2)">بخش: ' + NHB._esc(r.wardCode || '') + ' · ' + NHB._fmt(r.signedAt) + '</div>';
        h += '<div style="font-size:13px;font-weight:900;color:var(--primary);font-family:monospace;margin-top:6px">' + NHB._esc(r.uniqueCode || '') + '</div>';
        h += '</div>';

        // Show ISBAR read-only
        const i = r.isbar || {};
        h += '<div class="card" style="margin-bottom:12px">';
        h += '<div style="font-size:11px;font-weight:900;color:var(--primary)">S</div>';
        h += '<div style="font-size:12px;margin-bottom:6px">' + NHB._esc(i.situation && i.situation.currentIssue || '—') + '</div>';
        if (i.situation && i.situation.vitals) {
          h += '<div style="font-size:11px;color:var(--fg-2);margin-bottom:6px">' + NHB._esc(i.situation.vitals) + '</div>';
        }
        h += '<div style="font-size:11px;font-weight:900;color:var(--primary)">B</div>';
        h += '<div style="font-size:12px;margin-bottom:6px">' + NHB._esc(i.background && i.background.reason || '—') + '</div>';
        h += '<div style="font-size:11px;font-weight:900;color:var(--primary)">A</div>';
        h += '<div style="font-size:12px;white-space:pre-wrap;margin-bottom:6px">' + NHB._esc(i.assessment && i.assessment.clinicalImpression || '—') + '</div>';
        h += '<div style="font-size:11px;font-weight:900;color:var(--primary)">R</div>';
        h += '<div style="font-size:12px;white-space:pre-wrap">' + NHB._esc(i.recommendation && i.recommendation.followUp || '—') + '</div>';
        h += '</div>';

        h += '<div class="hint warn" style="margin-bottom:12px">⚠️ بر اساس JCI، متن تأیید باید شامل کد یکتا یا حداقل ۱۰ کاراکتر بازگویی باشد</div>';

        h += '<div class="wf-field"><label>متن Read-back *</label>';
        h += '<textarea id="nhbReadback" rows="3" placeholder="مثلاً: بیمار X، وضعیت Y را دریافت کردم. کد: ' + NHB._esc(r.uniqueCode || '') + '"></textarea></div>';

        h += '<button class="btn btn-ok btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.nhbUI._doReadback(\'' + reportId + '\')">✅ تأیید دریافت</button>';

        NHB._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _doReadback(reportId) {
      const text = document.getElementById('nhbReadback').value.trim();
      if (!text) return alert('متن تأیید الزامی است');
      try {
        await NHB._api('/api/nh/readback/' + reportId, {
          method: 'POST', body: JSON.stringify({ confirmText: text })
        });
        NHB._closeAll();
        NABZ._toast('✅ Read-back ثبت شد');
        NHB.show(null, null);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  HISTORY / AUDIT
    // ═══════════════════════════════════════════════════
    async history() {
      try {
        const d = await NHB._api('/api/nh/history');
        const items = d.items || [];

        let h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">📚 تاریخچه تحویل‌ها</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        if (!items.length) {
          h += '<div class="empty">تحویلی ثبت نشده</div>';
        } else {
          items.slice(0, 30).forEach(r => {
            const cls = r.status === 'received' ? 'ok' : r.status === 'signed' ? 'warn' : 'info';
            h += '<div style="padding:8px;background:var(--bg-2);border-radius:8px;margin-bottom:4px;font-size:11.5px">';
            h += '<div style="display:flex;justify-content:space-between"><b>' + NHB._esc(r.patientName) + '</b>';
            h += '<span class="pill ' + cls + '">' + (r.status === 'received' ? 'دریافت شد' : r.status === 'signed' ? 'منتظر' : r.status) + '</span></div>';
            h += '<div style="font-size:10.5px;color:var(--fg-2)">' + NHB._esc(r.wardCode || '') + ' · از ' + NHB._esc(r.fromUserName || '') + ' · ' + NHB._fmt(r.createdAt) + '</div>';
            if (r.uniqueCode) h += '<div style="font-family:monospace;color:var(--primary);font-size:10px">' + NHB._esc(r.uniqueCode) + '</div>';
            if (r.status === 'signed' && !r.receivedAt) {
              h += '<button class="btn btn-sm" style="margin-top:4px;padding:4px 10px;font-size:10px" onclick="this.closest(\'.bs-backdrop\').remove();NABZ.nhbUI.readback(\'' + r.id + '\')">📥 Read-back</button>';
            }
            h += '</div>';
          });
        }

        NHB._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async audit() {
      try {
        const d = await NHB._api('/api/nh/audit-summary?days=7');
        const t = d.totals || {};
        const color = t.compliancePct >= 95 ? 'ok' : t.compliancePct >= 80 ? 'warn' : 'dng';

        let h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">📊 Audit — ۷ روز</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        h += '<div class="card" style="text-align:center;border-color:var(--' + color + ');margin-bottom:12px">';
        h += '<div style="font-size:48px;font-weight:900;color:var(--' + color + ')">' + t.compliancePct + '%</div>';
        h += '<div style="font-size:11px;color:var(--fg-2)">Read-back Compliance</div>';
        h += '</div>';

        h += '<div class="rd-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">';
        h += '<div class="rd-stat"><div class="v">' + t.created + '</div><div class="l">کل</div></div>';
        h += '<div class="rd-stat warn"><div class="v">' + t.signed + '</div><div class="l">امضا</div></div>';
        h += '<div class="rd-stat ok"><div class="v">' + t.received + '</div><div class="l">دریافت</div></div>';
        h += '</div>';

        if (t.bridgeGenerated) {
          h += '<div class="hint info" style="margin-bottom:12px">🤖 ' + t.bridgeGenerated + ' از ' + t.created + ' توسط Bridge تولید شده</div>';
        }

        // By ward
        if (d.byWard) {
          h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin:12px 0 6px">به تفکیک بخش</div>';
          Object.entries(d.byWard).forEach(([ward, count]) => {
            h += '<div style="display:flex;justify-content:space-between;padding:4px 8px;background:var(--bg-2);border-radius:6px;margin-bottom:2px;font-size:11.5px"><span>' + NHB._esc(ward) + '</span><b>' + count + '</b></div>';
          });
        }

        NHB._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    }
  };

  // ═══ Bootstrap ═══
  let waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 60) return console.warn('[nhb-ui] timeout');
    setTimeout(() => ready(fn), 100);
  }

  ready(() => {
    NABZ.nhbUI = NHB;

    if (typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('nh_board', (p, d) => NHB.show(p, d));
    }

    // Handle patient button
    const prevDocBtns = NABZ._docButtonsFor;
    if (typeof prevDocBtns === 'function') {
      NABZ._docButtonsFor = function(pid, item) {
        const orig = prevDocBtns.apply(NABZ, arguments) || '';
        if (pid === 'clinical.patients' && item && item.id) {
          return orig + '<div style="margin-top:6px"><button class="btn btn-block" style="background:var(--info-soft);color:var(--info);border-color:var(--info);padding:10px;font-size:12px;font-weight:800" onclick="NABZ.nhbUI.generate(\'' + item.id + '\')">🔄 تولید ISBAR تحویل</button></div>';
        }
        return orig;
      };
    }

    console.log('[nhb-ui] loaded ✓ — Nursing Handoff Bridge');
  });
})();
