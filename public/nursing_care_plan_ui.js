
// ═══════════════════════════════════════════════════════════
//  NABZ — Nursing Care Plan UI (NANDA/NIC/NOC)
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  const SCORE_FA = { 1:'وابسته', 2:'کم', 3:'متوسط', 4:'کافی', 5:'کاملاً کافی' };
  const DOMAIN_FA = {
    1:'ارتقای سلامت', 2:'تغذیه', 3:'دفع و تبادل', 4:'فعالیت و استراحت',
    5:'ادراک و شناخت', 6:'خودادراکی', 7:'نقش‌های ارتباطی', 8:'جنسیت',
    9:'مقابله و استرس', 10:'اصول زندگی', 11:'امنیت و حفاظت',
    12:'راحتی', 13:'رشد و تکامل'
  };
  const STATUS_FA = { draft:'پیش‌نویس', active:'فعال', resolved:'حل‌شده', closed:'بسته' };
  const STATUS_CLS = { draft:'warn', active:'ok', resolved:'info', closed:'' };

  const N = {
    _api: (p, o) => NABZ._api(p, o),
    _esc: s => NABZ._esc(s),
    _state: { patientId: null, planId: null },

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
    //  MAIN
    // ═══════════════════════════════════════════════════
    async show(p, d) {
      const m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        // Load active plans for ward
        const plans = await N._api('/api/ncp/plans?status=active').catch(() => ({ items: [] }));
        const drafts = await N._api('/api/ncp/plans?status=draft').catch(() => ({ items: [] }));
        const all = (plans.items || []).concat(drafts.items || []);
        const resolved = (await N._api('/api/ncp/plans?status=resolved').catch(() => ({ items: [] }))).items || [];

        let h = '<div class="sec-hd"><span>📋 برنامه مراقبت پرستاری</span>';
        h += '<span class="rd-mini">' + all.length + ' فعال</span></div>';

        h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">';
        h += '<div class="rd-stat ok"><div class="v">' + (plans.items || []).length + '</div><div class="l">فعال</div></div>';
        h += '<div class="rd-stat warn"><div class="v">' + (drafts.items || []).length + '</div><div class="l">پیش‌نویس</div></div>';
        h += '<div class="rd-stat info"><div class="v">' + resolved.length + '</div><div class="l">حل‌شده</div></div>';
        h += '<div class="rd-stat"><div class="v">' + all.length + '</div><div class="l">کل</div></div>';
        h += '</div>';

        h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:12px;font-weight:900" onclick="NABZ.ncpUI.newPlan()">➕ برنامه جدید</button>';

        if (drafts.items && drafts.items.length) {
          h += '<div style="font-size:12px;font-weight:900;color:var(--warn);margin:12px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--warn)">📝 پیش‌نویس‌ها</div>';
          drafts.items.forEach(plan => { h += N._renderPlanRow(plan); });
        }

        if (plans.items && plans.items.length) {
          h += '<div style="font-size:12px;font-weight:900;color:var(--ok);margin:12px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--ok)">✅ فعال</div>';
          plans.items.forEach(plan => { h += N._renderPlanRow(plan); });
        }

        if (!all.length) {
          h += '<div class="empty" style="padding:30px">هنوز برنامه‌ای ساخته نشده<br><span style="font-size:11px;opacity:0.7">اولین برنامه را با دکمه بالا بسازید</span></div>';
        }

        if (resolved.length) {
          h += '<div class="sec-hd" style="margin-top:14px"><span>📚 حل‌شده‌ها</span></div>';
          resolved.slice(0, 5).forEach(plan => { h += N._renderPlanRow(plan); });
        }

        m.innerHTML = h;
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + N._esc(e.message) + '</div>';
      }
    },

    _renderPlanRow(plan) {
      const active = plan.diagnoses.filter(d => d.status === 'active').length;
      const resolved = plan.diagnoses.filter(d => d.status === 'resolved').length;
      const cls = STATUS_CLS[plan.status] || 'info';
      let h = '<div class="row lo" onclick="NABZ.ncpUI.openPlan(\'' + plan.id + '\')">';
      h += '<div class="row-hd"><div class="row-title">' + N._esc(plan.patientName) + '</div>';
      h += '<span class="pill ' + cls + '">' + (STATUS_FA[plan.status] || plan.status) + '</span></div>';
      h += '<div class="row-meta">' + N._esc(plan.wardCode || '') + ' · تخت ' + N._esc(plan.bedNumber || '—') + '</div>';
      h += '<div class="row-meta">' + active + ' فعال · ' + resolved + ' حل‌شده · ' + plan.diagnoses.length + ' کل</div>';
      h += '</div>';
      return h;
    },

    // ═══════════════════════════════════════════════════
    //  NEW PLAN — patient picker → suggest → select
    // ═══════════════════════════════════════════════════
    async newPlan() {
      try {
        const d = await N._api('/api/clinical/patients');
        const active = (d.items || []).filter(p => ['in_care','admitted'].includes(p.status));
        if (!active.length) return alert('بیماری بستری نیست');

        let h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">👤 بیمار</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        active.forEach(p => {
          h += '<button class="btn" style="width:100%;text-align:right;padding:12px;margin-bottom:6px;display:flex;flex-direction:column;gap:2px;align-items:stretch" onclick="NABZ.ncpUI._selectPatient(\'' + p.id + '\')">';
          h += '<div style="font-weight:900">' + N._esc(p.firstName + ' ' + p.lastName) + '</div>';
          h += '<div style="font-size:10.5px;color:var(--fg-2)">' + N._esc(p.wardCode || '') + ' · تخت ' + N._esc(p.bedNumber || '—') + ' · ' + N._esc(p.diagnosis || '') + '</div>';
          h += '</button>';
        });
        N._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _selectPatient(patientId) {
      N._state.patientId = patientId;
      N._closeAll();
      try {
        const s = await N._api('/api/ncp/suggest/' + patientId);
        N._renderSuggestion(s);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _renderSuggestion(s) {
      const m = document.getElementById('content');
      let h = '<div class="sec-hd"><span>🤖 پیشنهاد تشخیص — ' + s.items.length + '</span></div>';
      h += '<button class="btn" style="padding:8px 12px;margin-bottom:12px;font-size:11px" onclick="NABZ.ncpUI.show(null, null)">← بازگشت</button>';

      if (!s.items.length) {
        h += '<div class="hint info">هیچ پیشنهادی وجود ندارد — می‌توانید دستی تشخیص اضافه کنید</div>';
      } else {
        h += '<div class="hint info" style="margin-bottom:12px">این‌ها از روی ویتال، تشخیص، داروها و شرایط بیمار پیشنهاد شده‌اند. موارد را انتخاب کنید:</div>';

        // Track selection
        N._selected = new Set();

        s.items.forEach((item, idx) => {
          const conf = item.confidence === 'high' ? 'dng' : item.confidence === 'medium' ? 'warn' : 'info';
          h += '<div class="card" style="margin-bottom:8px;cursor:pointer" onclick="NABZ.ncpUI._toggle(\'' + item.code + '\',this)" data-code="' + item.code + '">';
          h += '<div style="display:flex;align-items:flex-start;gap:10px">';
          h += '<input type="checkbox" id="nanda_' + item.code + '" style="width:20px;height:20px;margin-top:2px;pointer-events:none;accent-color:var(--primary)">';
          h += '<div style="flex:1">';
          h += '<div style="font-weight:900;font-size:13px">' + (item.is_risk ? '⚠️ ' : '● ') + N._esc(item.fa) + '</div>';
          h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">' + N._esc(item.en) + '</div>';
          h += '<div style="font-size:10.5px;color:var(--fg-3);margin-top:2px">کد: ' + item.code + ' · دامنه: ' + (DOMAIN_FA[item.domain] || item.domain) + '</div>';
          h += '<div style="display:flex;gap:4px;margin-top:6px">';
          h += '<span class="pill ' + conf + '">' + (item.confidence === 'high' ? 'اطمینان بالا' : item.confidence === 'medium' ? 'متوسط' : 'پایین') + '</span>';
          h += '<span class="pill info">' + item.reason + '</span>';
          h += '</div>';
          h += '</div></div></div>';
        });
      }

      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.ncpUI.showAddManual()">🔍 جستجوی دستی NANDA</button>';
      h += '<button class="btn btn-ok btn-block" style="padding:14px;margin-top:8px;font-weight:900" onclick="NABZ.ncpUI._createSelected()">✅ ساخت برنامه با ' + (N._selected ? N._selected.size : 0) + ' تشخیص</button>';

      m.innerHTML = h;
    },

    _toggle(code, el) {
      const cb = document.getElementById('nanda_' + code);
      if (!cb) return;
      cb.checked = !cb.checked;
      if (cb.checked) N._selected.add(code);
      else N._selected.delete(code);
      el.style.borderColor = cb.checked ? 'var(--primary)' : '';
      el.style.background = cb.checked ? 'var(--primary-soft)' : '';
      // Update button
      const btn = document.querySelector('.btn-ok');
      if (btn) btn.textContent = '✅ ساخت برنامه با ' + N._selected.size + ' تشخیص';
    },

    async showAddManual() {
      try {
        const d = await N._api('/api/ncp/nanda');
        N._allNanda = d.items;
        N._byDomain = d.byDomain;
        N._renderManualPicker();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _renderManualPicker() {
      let h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">🔍 جستجوی NANDA</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<input type="search" id="nandaSearch" placeholder="جستجو نام یا کد..." style="width:100%;padding:10px;margin-bottom:8px;border:1.5px solid var(--border-2);border-radius:8px;background:var(--bg-2);color:var(--fg);font-family:inherit;font-size:13px" oninput="NABZ.ncpUI._filterNanda(this.value)">';
      h += '<div id="nandaList" style="max-height:60vh;overflow-y:auto">';

      Object.entries(N._byDomain).forEach(([domain, items]) => {
        h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin:10px 0 6px;padding:4px 8px;background:var(--primary-soft);border-radius:6px" data-domain="' + domain + '">';
        h += DOMAIN_FA[domain] || ('Domain ' + domain) + ' (' + items.length + ')';
        h += '</div>';
        items.forEach(item => {
          const text = (item.fa + ' ' + item.en + ' ' + item.code).toLowerCase();
          h += '<label class="nanda-item" data-text="' + N._esc(text) + '" style="display:flex;align-items:flex-start;gap:8px;padding:8px;background:var(--bg-2);border-radius:6px;margin-bottom:4px;cursor:pointer">';
          h += '<input type="checkbox" ' + (N._selected && N._selected.has(item.code) ? 'checked' : '') + ' onchange="NABZ.ncpUI._toggleManual(\'' + item.code + '\',this.checked)" style="width:18px;height:18px;margin-top:2px;accent-color:var(--primary)">';
          h += '<div style="flex:1"><div style="font-size:12px;font-weight:800">' + (item.is_risk ? '⚠️ ' : '● ') + N._esc(item.fa) + '</div>';
          h += '<div style="font-size:10px;color:var(--fg-2)">' + item.code + ' · ' + N._esc(item.en) + '</div></div>';
          h += '</label>';
        });
      });
      h += '</div>';
      h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:10px;font-weight:900" onclick="this.closest(\'.bs-backdrop\').remove();NABZ.ncpUI.show(null, null)" id="nandaManualDone">تمام شد</button>';
      N._openSheet(h);
    },

    _filterNanda(q) {
      q = q.toLowerCase();
      document.querySelectorAll('.nanda-item').forEach(el => {
        el.style.display = el.dataset.text.includes(q) ? '' : 'none';
      });
    },

    _toggleManual(code, checked) {
      if (checked) N._selected.add(code);
      else N._selected.delete(code);
    },

    async _createSelected() {
      if (!N._selected || !N._selected.size) return alert('حداقل یک تشخیص انتخاب کنید');
      const diagnoses = Array.from(N._selected).map(code => ({ code }));
      try {
        const r = await N._api('/api/ncp/plan', {
          method: 'POST',
          body: JSON.stringify({
            patientId: N._state.patientId,
            diagnoses: diagnoses
          })
        });
        NABZ._toast('✅ برنامه ساخته شد');
        N._state.planId = r.id;
        N._selected.clear();
        N.openPlan(r.id);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  OPEN PLAN
    // ═══════════════════════════════════════════════════
    async openPlan(planId) {
      const m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        const plan = await N._api('/api/ncp/plan/' + planId);
        N._state.planId = planId;
        N._state.plan = plan;

        const active = plan.diagnoses.filter(d => d.status === 'active');
        const resolved = plan.diagnoses.filter(d => d.status === 'resolved');

        let h = '<div class="sec-hd"><span>📋 ' + N._esc(plan.patientName) + '</span>';
        h += '<span class="pill ' + (STATUS_CLS[plan.status] || 'info') + '">' + (STATUS_FA[plan.status] || plan.status) + '</span></div>';
        h += '<button class="btn" style="padding:8px 12px;font-size:11px;margin-bottom:12px" onclick="NABZ.ncpUI.show(null,null)">← بازگشت</button>';

        // Meta
        h += '<div class="card" style="margin-bottom:12px">';
        h += '<div style="font-size:12px;color:var(--fg-2)">بخش: ' + N._esc(plan.wardCode || '') + ' · تخت ' + N._esc(plan.bedNumber || '—') + '</div>';
        h += '<div style="font-size:12px;color:var(--fg-2);margin-top:2px">ایجاد: ' + N._esc(plan.createdByName || '—') + ' · ' + N._fmt(plan.createdAt) + '</div>';
        h += '</div>';

        // Stats
        h += '<div class="rd-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">';
        h += '<div class="rd-stat ok"><div class="v">' + active.length + '</div><div class="l">فعال</div></div>';
        h += '<div class="rd-stat info"><div class="v">' + resolved.length + '</div><div class="l">حل‌شده</div></div>';
        h += '<div class="rd-stat"><div class="v">' + plan.diagnoses.length + '</div><div class="l">کل</div></div>';
        h += '</div>';

        // Actions
        h += '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">';
        if (plan.status === 'draft') {
          h += '<button class="btn btn-primary" style="flex:1;min-width:140px;padding:10px;font-size:11px;font-weight:900" onclick="NABZ.ncpUI._activate(\'' + plan.id + '\')">✅ فعال‌سازی</button>';
        }
        if (plan.status === 'active') {
          h += '<button class="btn" style="flex:1;min-width:140px;padding:10px;font-size:11px" onclick="NABZ.ncpUI.showAddManual()">➕ افزودن تشخیص</button>';
          h += '<button class="btn" style="flex:1;min-width:140px;padding:10px;font-size:11px" onclick="NABZ.ncpUI._printPlan(\'' + plan.id + '\')">🖨 PDF</button>';
        }
        h += '</div>';

        // Diagnoses
        active.forEach(d => { h += N._renderDiagnosisCard(plan, d); });

        if (resolved.length) {
          h += '<div class="sec-hd" style="margin-top:14px"><span>📚 حل‌شده</span></div>';
          resolved.forEach(d => {
            h += '<div class="row lo" style="padding:10px 12px;opacity:0.75;margin-bottom:4px">';
            h += '<div class="row-hd"><div class="row-title" style="font-size:12px;text-decoration:line-through">' + N._esc(d.fa) + '</div>';
            h += '<span class="pill info">حل‌شده</span></div>';
            h += '<div class="row-meta">' + N._fmt(d.resolvedAt) + ' — ' + N._esc(d.resolvedByName || '') + '</div>';
            h += '</div>';
          });
        }

        m.innerHTML = h;
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + N._esc(e.message) + '</div>';
      }
    },

    _renderDiagnosisCard(plan, d) {
      const canResolve = plan.status === 'active';
      let h = '<div class="card" style="margin-bottom:12px;border-right:3px solid ' + (d.is_risk ? 'var(--warn)' : 'var(--primary)') + '">';

      // Header
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
      h += '<div style="flex:1">';
      h += '<div style="font-size:10.5px;color:var(--fg-2);font-weight:800">کد ' + d.code + ' · دامنه ' + (DOMAIN_FA[d.domain] || d.domain) + '</div>';
      h += '<div style="font-weight:900;font-size:13px;margin-top:2px">' + (d.is_risk ? '⚠️ ' : '● ') + N._esc(d.fa) + '</div>';
      h += '<div style="font-size:10.5px;color:var(--fg-3)">' + N._esc(d.en) + '</div>';
      h += '</div>';
      if (canResolve) {
        h += '<button class="btn btn-sm" style="padding:4px 8px;font-size:10px;color:var(--ok);border-color:var(--ok)" onclick="NABZ.ncpUI._resolve(\'' + plan.id + '\',\'' + d.code + '\')">✓ حل شد</button>';
      }
      h += '</div>';

      // NOC outcomes
      h += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">';
      h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin-bottom:6px">📊 NOC — پیامدهای مورد انتظار</div>';
      d.expectedOutcomes.forEach(o => {
        const score = o.latestScore;
        const target = o.target;
        const met = score != null && score >= target;
        const cls = score == null ? 'info' : met ? 'ok' : score < 2 ? 'dng' : 'warn';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--bg-2);border-radius:6px;margin-bottom:4px;font-size:11.5px">';
        h += '<div style="flex:1">';
        h += '<div>' + N._esc(o.fa) + '</div>';
        if (score != null) h += '<div style="font-size:10px;color:var(--fg-2)">آخرین: ' + score + '/5 · هدف: ' + target + '</div>';
        h += '</div>';
        if (plan.status === 'active') {
          h += '<button class="btn btn-sm" style="padding:3px 8px;font-size:10px;background:var(--' + cls + '-soft);color:var(--' + cls + ');border-color:var(--' + cls + ')" onclick="NABZ.ncpUI._openScore(\'' + plan.id + '\',\'' + d.code + '\',\'' + o.code + '\')">';
          h += score != null ? score + '/5' : 'ثبت';
          h += '</button>';
        } else if (score != null) {
          h += '<span class="pill ' + cls + '">' + score + '/5</span>';
        }
        h += '</div>';
      });
      h += '</div>';

      // NIC interventions
      h += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">';
      h += '<div style="font-size:11px;font-weight:900;color:var(--violet);margin-bottom:6px">💡 NIC — مداخلات پیشنهادی (' + d.interventions.length + ')</div>';
      d.interventions.slice(0, 5).forEach(i => {
        h += '<div style="padding:6px 8px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;font-size:11px">';
        h += '<div style="font-weight:800">' + N._esc(i.fa) + '</div>';
        h += '<div style="font-size:10px;color:var(--fg-2);margin-top:2px">' + i.activities.slice(0, 3).map(a => '• ' + a).join(' · ') + '</div>';
        h += '</div>';
      });
      if (d.interventions.length > 5) {
        h += '<div style="font-size:10px;color:var(--fg-3);text-align:center;margin-top:2px">+ ' + (d.interventions.length - 5) + ' مداخله دیگر</div>';
      }
      h += '</div>';

      h += '</div>';
      return h;
    },

    // ═══════════════════════════════════════════════════
    //  ACTIVATE / RESOLVE
    // ═══════════════════════════════════════════════════
    async _activate(planId) {
      if (!confirm('برنامه فعال شود؟')) return;
      try {
        await N._api('/api/ncp/plan/' + planId + '/activate', { method: 'POST', body: '{}' });
        NABZ._toast('✅ برنامه فعال شد');
        N.openPlan(planId);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _resolve(planId, code) {
      const note = prompt('یادداشت حل شدن (اختیاری):') || '';
      try {
        await N._api('/api/ncp/plan/' + planId + '/diagnosis/' + code + '/resolve', {
          method: 'POST', body: JSON.stringify({ note })
        });
        NABZ._toast('✅ تشخیص حل شد');
        N.openPlan(planId);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  NOC SCORING
    // ═══════════════════════════════════════════════════
    async _openScore(planId, diagCode, outcomeCode) {
      try {
        const noc = await N._api('/api/ncp/nanda/' + diagCode);
        const outcomeDef = (noc.noc || []).find(o => o.code === outcomeCode);
        if (!outcomeDef) return alert('NOC تعریف نشده');
        N._openScoreModal(planId, diagCode, outcomeDef);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _openScoreModal(planId, diagCode, outcome) {
      let h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">📊 NOC — ' + N._esc(outcome.fa) + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="hint info" style="margin-bottom:12px">هدف: ' + (outcome.target || 4) + '/5 · هر indicator را از ۱ (وابسته) تا ۵ (کاملاً کافی) ارزیابی کنید</div>';

      outcome.indicators.forEach((ind, i) => {
        h += '<div class="card" style="padding:10px;margin-bottom:8px">';
        h += '<div style="font-weight:800;font-size:12.5px;margin-bottom:6px">' + N._esc(ind) + '</div>';
        h += '<div style="display:flex;gap:4px">';
        for (let s = 1; s <= 5; s++) {
          h += '<button type="button" class="score-btn" data-indicator="' + i + '" data-score="' + s + '" onclick="NABZ.ncpUI._setScore(' + i + ',' + s + ',this)" style="flex:1;padding:8px 4px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;font-family:inherit;font-size:11px;font-weight:800;cursor:pointer">';
          h += s + '<div style="font-size:8.5px;color:var(--fg-2);font-weight:600">' + SCORE_FA[s] + '</div>';
          h += '</button>';
        }
        h += '</div></div>';
      });

      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.ncpUI._submitScore(\'' + planId + '\',\'' + diagCode + '\',\'' + outcome.code + '\')">✅ ثبت ارزیابی</button>';

      N._scores = {};
      N._openSheet(h);
    },

    _setScore(idx, val, btn) {
      N._scores[idx] = val;
      const parent = btn.closest('.card');
      parent.querySelectorAll('.score-btn').forEach(b => {
        b.style.background = 'var(--bg-2)';
        b.style.borderColor = 'var(--border-2)';
        b.style.color = '';
      });
      btn.style.background = 'var(--primary)';
      btn.style.borderColor = 'var(--primary)';
      btn.style.color = '#fff';
    },

    async _submitScore(planId, diagCode, outcomeCode) {
      try {
        const noc = await N._api('/api/ncp/nanda/' + diagCode);
        const outcomeDef = (noc.noc || []).find(o => o.code === outcomeCode);
        const scores = [];
        outcomeDef.indicators.forEach((ind, i) => {
          if (!N._scores[i]) throw new Error('همه indicators باید ارزیابی شوند');
          scores.push({ indicator: ind, score: N._scores[i] });
        });
        const r = await N._api('/api/ncp/plan/' + planId + '/score', {
          method: 'POST',
          body: JSON.stringify({
            diagnosisCode: diagCode,
            outcomeCode: outcomeCode,
            scores: scores
          })
        });
        N._closeAll();
        NABZ._toast('✅ ارزیابی ثبت شد — ' + r.avg + '/5');
        N._scores = {};
        N.openPlan(planId);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  PRINT
    // ═══════════════════════════════════════════════════
    async _printPlan(planId) {
      try {
        const plan = await N._api('/api/ncp/plan/' + planId);
        const active = plan.diagnoses.filter(d => d.status === 'active');
        let html = '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><title>برنامه مراقبت — ' + plan.patientName + '</title>';
        html += '<style>@page{size:A4;margin:12mm}body{font-family:Vazirmatn,Tahoma,sans-serif;font-size:10.5px;line-height:1.55}h1{font-size:16px;color:#0891b2;border-bottom:2px solid #0891b2;padding-bottom:6px;margin-bottom:12px}h2{font-size:13px;color:#0c4a6e;margin:14px 0 6px;border-right:3px solid #0891b2;padding-right:8px}table{width:100%;border-collapse:collapse;margin:6px 0;font-size:9.5px}th,td{border:1px solid #cbd5e1;padding:5px;text-align:right}th{background:#e0f2fe;font-weight:900}.label{font-weight:900;color:#0891b2}.out{background:#f0fdf4;padding:4px 8px;border-radius:4px;display:inline-block;margin:2px}.met{background:#dbeafe}.notmet{background:#fef3c7}.crit{background:#fee2e2}</style>';
        html += '</head><body>';
        html += '<h1>📋 برنامه مراقبت پرستاری — ' + plan.patientName + '</h1>';
        html += '<div class="label">بخش:</div> ' + (plan.wardCode || '—') + ' · <span class="label">تخت:</span> ' + (plan.bedNumber || '—') + '<br>';
        html += '<div class="label">ایجاد:</div> ' + plan.createdByName + ' — ' + new Date(plan.createdAt).toLocaleString('fa-IR') + '<br>';
        html += '<div class="label">وضعیت:</div> ' + (STATUS_FA[plan.status] || plan.status) + '<br>';

        active.forEach((d, idx) => {
          html += '<h2>' + (idx+1) + '. ' + d.fa + ' — ' + d.code + '</h2>';
          html += '<div style="font-size:10px;color:#666;margin-bottom:6px">' + d.en + ' · دامنه ' + (DOMAIN_FA[d.domain] || d.domain) + '</div>';

          // NOC
          html += '<div class="label" style="margin-top:8px">📊 پیامدهای مورد انتظار (NOC):</div>';
          html += '<table><thead><tr><th>پیامد</th><th>هدف</th><th>آخرین نمره</th><th>وضعیت</th></tr></thead><tbody>';
          d.expectedOutcomes.forEach(o => {
            const cls = o.latestScore == null ? '' : o.latestScore >= o.target ? 'met' : o.latestScore < 2 ? 'crit' : 'notmet';
            html += '<tr><td>' + o.fa + '</td><td>' + o.target + '/5</td><td>' + (o.latestScore || '—') + '</td><td class="' + cls + '">' + (o.latestScore != null ? (o.latestScore >= o.target ? 'محقق' : 'زیر هدف') : 'ارزیابی نشده') + '</td></tr>';
          });
          html += '</tbody></table>';

          // NIC
          html += '<div class="label" style="margin-top:8px">💡 مداخلات (NIC):</div>';
          html += '<table><thead><tr><th>مداخله</th><th>فعالیت‌ها</th></tr></thead><tbody>';
          d.interventions.slice(0, 8).forEach(i => {
            html += '<tr><td><b>' + i.fa + '</b></td><td>' + i.activities.slice(0, 4).join(' · ') + '</td></tr>';
          });
          html += '</tbody></table>';
        });

        html += '<div style="margin-top:20px;padding-top:10px;border-top:1px solid #cbd5e1;font-size:9px;color:#64748b;text-align:center">NABZ — Nursing Care Plan · ' + new Date().toISOString() + '</div>';
        html += '</body></html>';

        const w = window.open('', '_blank');
        if (!w) return alert('پاپ‌آپ مسدود است');
        w.document.open(); w.document.write(html); w.document.close();
        setTimeout(() => { try { w.focus(); w.print(); } catch(_) { alert('Ctrl+P'); } }, 500);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  HANDOFF INTEGRATION
    // ═══════════════════════════════════════════════════
    async handoffBlock(patientId) {
      try {
        const s = await N._api('/api/ncp/handoff/' + patientId);
        if (!s.hasPlan) return { hasPlan: false };
        return s;
      } catch (e) { return { hasPlan: false }; }
    }
  };

  // ═══ Bootstrap ═══
  let waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 60) return console.warn('[ncp-ui] timeout');
    setTimeout(() => ready(fn), 100);
  }

  ready(() => {
    NABZ.ncpUI = N;

    if (typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('ncp_main', (p, d) => N.show(p, d));
    }

    // Wrap _docButtonsFor for patients → care plan button
    const prevDocBtns = NABZ._docButtonsFor;
    if (typeof prevDocBtns === 'function') {
      NABZ._docButtonsFor = function(pid, item) {
        const orig = prevDocBtns.apply(NABZ, arguments) || '';
        if (pid === 'clinical.patients' && item && item.id) {
          return orig + '<div style="margin-top:8px"><button class="btn btn-block" style="background:var(--ok-soft);color:var(--ok);border-color:var(--ok);padding:10px;font-size:12px" onclick="NABZ.ncpUI.showForPatient(\'' + item.id + '\')">📋 برنامه مراقبت</button></div>';
        }
        return orig;
      };
    }

    // Helper: show plan for a specific patient
    N.showForPatient = async function(patientId) {
      try {
        const plans = await N._api('/api/ncp/plans?patientId=' + patientId);
        if ((plans.items || []).length) {
          N.openPlan(plans.items[0].id);
        } else {
          N._state.patientId = patientId;
          const s = await N._api('/api/ncp/suggest/' + patientId);
          N._renderSuggestion(s);
        }
      } catch (e) { alert('خطا: ' + e.message); }
    };

    console.log('[ncp-ui] loaded ✓ — NANDA/NIC/NOC');
  });
})();
