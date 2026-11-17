// ═══════════════════════════════════════════════════════════
//  NABZ — Workflow UI (consult, discharge, transfer)
//  ⚠️  فقط frontend — endpoint‌های موجود استفاده می‌شوند
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var WF = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _time: function(iso) {
      if (!iso) return '—';
      try { return new Date(iso).toLocaleString('fa-IR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); }
      catch (_) { return '—'; }
    },
    _closeAll: function() { document.querySelectorAll('.bs-backdrop').forEach(function(e) { e.remove(); }); },
    _openSheet: function(html) {
      var sheet = document.createElement('div');
      sheet.className = 'bs-backdrop';
      sheet.onclick = function(e) { if (e.target === sheet) sheet.remove(); };
      var c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '95vh';
      c.innerHTML = html;
      sheet.appendChild(c);
      document.body.appendChild(sheet);
      requestAnimationFrame(function() { sheet.classList.add('show'); });
      return { sheet: sheet, content: c };
    },
    _pickPatient: async function(title) {
      if (NABZ.enc && NABZ.enc.pickPatient) return NABZ.enc.pickPatient(title);
      // fallback
      var d = await this._api('/api/clinical/patients');
      var items = (d.items || []).filter(function(p) { return ['in_care','admitted'].indexOf(p.status) >= 0; });
      if (!items.length) { alert('بیماری بستری نیست'); return null; }
      return new Promise(function(resolve) {
        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">👤 ' + NABZ._esc(title || 'انتخاب بیمار') + '</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        items.forEach(function(p) {
          html += '<button class="btn" style="width:100%;text-align:right;padding:12px;margin-bottom:4px" onclick="window._wfPick(\'' + p.id + '\')"><b>' + NABZ._esc(p.firstName + ' ' + p.lastName) + '</b><br><small style="color:var(--fg-2)">' + NABZ._esc(p.wardCode || '') + ' · ' + NABZ._esc(p.diagnosis || '') + '</small></button>';
        });
        var s = WF._openSheet(html);
        window._wfPick = function(pid) { s.sheet.remove(); resolve(pid); };
      });
    },
    _flowBar: function(steps, current) {
      var html = '<div class="wf-flow">';
      for (var i = 0; i < steps.length; i++) {
        var s = steps[i];
        var isDone = i < current;
        var isActive = i === current;
        var cls = isDone ? 'done' : isActive ? 'active' : '';
        html += '<div class="wf-flow-step ' + cls + '">' + s + '</div>';
      }
      html += '</div>';
      return html;
    },

    // ═══════════════════════════════════════════════════
    //  CONSULT — مشاوره
    // ═══════════════════════════════════════════════════
    consultRequest: async function(patientId) {
      if (!patientId) {
        patientId = await WF._pickPatient('درخواست مشاوره');
        if (!patientId) return;
      }
      var services = ['قلب و عروق','عفونی','جراحی اعصاب','ریه','نفرولوژی','غدد','گوارش','ارتوپدی','روانپزشکی','پوست','زنان','اورولوژی','خون','انکولوژی'];
      var html = '<div class="bs-handle"></div>';
      html += '<div class="bs-hd"><div class="bs-title">🩺 درخواست مشاوره</div>';
      html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      html += '<div class="wf-field"><label>سرویس مقصد</label><select id="cReqService">';
      services.forEach(function(s) { html += '<option value="' + s + '">' + s + '</option>'; });
      html += '</select></div>';
      html += '<div class="wf-field"><label>نوع مشاوره</label><select id="cReqType">';
      html += '<option value="emergency">اورژانسی (۳۰ دقیقه)</option>';
      html += '<option value="urgent">فوری (۲ ساعت)</option>';
      html += '<option value="routine" selected>روتین (۴ ساعت)</option>';
      html += '</select></div>';
      html += '<div class="wf-field"><label>سؤال بالینی *</label><textarea id="cReqQuestion" rows="3" placeholder="سؤال دقیق شما..."></textarea></div>';
      html += '<div class="wf-section-title">ISBAR (اختیاری)</div>';
      html += '<div class="wf-field"><label>S — وضعیت فعلی</label><input type="text" id="cReqS"></div>';
      html += '<div class="wf-field"><label>B — سابقه</label><input type="text" id="cReqB"></div>';
      html += '<div class="wf-field"><label>A — ارزیابی</label><input type="text" id="cReqA"></div>';
      html += '<div class="wf-field"><label>R — توصیه مورد انتظار</label><input type="text" id="cReqR"></div>';
      html += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.wf._submitConsultRequest(\'' + patientId + '\')">📤 ارسال</button>';
      WF._openSheet(html);
    },

    _submitConsultRequest: async function(patientId) {
      var q = document.getElementById('cReqQuestion').value.trim();
      if (!q) return alert('سؤال الزامی است');
      var body = {
        patientId: patientId,
        targetService: document.getElementById('cReqService').value,
        consultType: document.getElementById('cReqType').value,
        question: q,
        isbar: {
          situation: document.getElementById('cReqS').value,
          background: document.getElementById('cReqB').value,
          assessment: document.getElementById('cReqA').value,
          recommendation: document.getElementById('cReqR').value
        }
      };
      try {
        var r = await WF._api('/api/wf/consults', { method:'POST', body: JSON.stringify(body) });
        NABZ._toast('✅ مشاوره ارسال شد');
        WF._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    viewConsult: async function(id) {
      try {
        var all = await WF._api('/api/wf/consults');
        var c = (all.items || []).find(function(x) { return x.id === id; });
        if (!c) return alert('مشاوره یافت نشد');

        var statusMap = { requested:'در انتظار پاسخ', responded:'پاسخ داده شده', approved:'تأیید شده', cancelled:'لغو' };
        var statusCls = { requested:'warn', responded:'info', approved:'ok', cancelled:'dng' };
        var flow = ['درخواست', 'پاسخ', 'تأیید'];
        var flowIdx = c.status === 'requested' ? 0 : c.status === 'responded' ? 1 : 2;

        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">🩺 مشاوره — ' + WF._esc(c.patientName) + '</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        html += '<div style="margin-bottom:8px"><span class="pill ' + (statusCls[c.status] || 'info') + '">' + (statusMap[c.status] || c.status) + '</span>';
        if (c.consultType === 'emergency') html += ' <span class="pill dng">اورژانسی</span>';
        else if (c.consultType === 'urgent') html += ' <span class="pill warn">فوری</span>';
        html += '</div>';
        html += WF._flowBar(flow, flowIdx);

        html += '<div class="card" style="margin-bottom:12px">';
        html += '<div style="font-size:12px;color:var(--fg-2)">بخش: ' + WF._esc(c.wardCode) + ' · سرویس: <b>' + WF._esc(c.targetService) + '</b></div>';
        html += '<div style="font-size:12px;color:var(--fg-2);margin-top:2px">درخواست: ' + WF._time(c.requestedAt) + '</div>';
        if (c.responseDueAt) html += '<div style="font-size:12px;color:var(--fg-2)">مهلت: ' + WF._time(c.responseDueAt) + '</div>';
        html += '</div>';

        html += '<div class="card" style="margin-bottom:12px"><div class="card-title">❓ سؤال</div>';
        html += '<div style="font-size:13px;white-space:pre-wrap">' + WF._esc(c.question || '—') + '</div></div>';

        if (c.isbar && (c.isbar.situation || c.isbar.background)) {
          html += '<div class="card" style="margin-bottom:12px"><div class="card-title">ISBAR</div>';
          if (c.isbar.situation) html += '<div style="font-size:12px;margin-bottom:3px"><b>S:</b> ' + WF._esc(c.isbar.situation) + '</div>';
          if (c.isbar.background) html += '<div style="font-size:12px;margin-bottom:3px"><b>B:</b> ' + WF._esc(c.isbar.background) + '</div>';
          if (c.isbar.assessment) html += '<div style="font-size:12px;margin-bottom:3px"><b>A:</b> ' + WF._esc(c.isbar.assessment) + '</div>';
          if (c.isbar.recommendation) html += '<div style="font-size:12px"><b>R:</b> ' + WF._esc(c.isbar.recommendation) + '</div>';
          html += '</div>';
        }

        if (c.response) {
          html += '<div class="card" style="margin-bottom:12px;border-color:var(--primary)"><div class="card-title">💬 پاسخ متخصص</div>';
          html += '<div style="font-size:13px;white-space:pre-wrap;margin-bottom:6px">' + WF._esc(c.response.answer) + '</div>';
          if (c.response.recommendations && c.response.recommendations.length) {
            html += '<div style="font-size:12px;margin-bottom:3px"><b>توصیه‌ها:</b></div>';
            c.response.recommendations.forEach(function(r) { html += '<div style="font-size:12px;padding-right:12px">• ' + WF._esc(r) + '</div>'; });
          }
          if (c.response.followup) html += '<div style="font-size:12px;margin-top:6px"><b>پیگیری:</b> ' + WF._esc(c.response.followup) + '</div>';
          html += '<div style="font-size:10.5px;color:var(--fg-3);margin-top:6px">— ' + WF._time(c.respondedAt) + '</div>';
          if (c.response.requiresAttendingApproval) {
            html += '<div class="hint warn" style="margin-top:8px">⚠️ پاسخ توسط رزیدنت/اینترن — نیاز به تأیید استاد</div>';
          }
          html += '</div>';
        }

        if (c.status === 'approved') {
          html += '<div class="hint success">✅ تأیید نهایی توسط استاد — ' + WF._time(c.approvedAt) + '</div>';
        }

        // Actions
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 20px">';
        var isResponder = ['attending','specialist','resident'].indexOf(NABZ.state.user && NABZ.state.user.role) >= 0;
        var isAttending = ['attending','specialist','admin'].indexOf(NABZ.state.user && NABZ.state.user.role) >= 0;
        if (c.status === 'requested' && isResponder) {
          html += '<button class="btn btn-primary" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.wf.consultRespond(\'' + c.id + '\')">💬 پاسخ</button>';
        }
        if (c.status === 'responded' && isAttending && c.respondedBy !== (NABZ.state.user && NABZ.state.user.id)) {
          html += '<button class="btn btn-ok" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.wf._approveConsult(\'' + c.id + '\')">✅ تأیید</button>';
        }
        html += '<button class="btn" style="flex:1;min-width:100px;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        html += '</div>';
        WF._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    consultRespond: function(id) {
      var html = '<div class="bs-handle"></div>';
      html += '<div class="bs-hd"><div class="bs-title">💬 پاسخ مشاوره</div>';
      html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      html += '<div class="wf-field"><label>پاسخ *</label><textarea id="cAnsAnswer" rows="4" placeholder="پاسخ بالینی شما..."></textarea></div>';
      html += '<div class="wf-field"><label>توصیه‌ها (هر خط یک توصیه)</label><textarea id="cAnsRecs" rows="4"></textarea></div>';
      html += '<div class="wf-field"><label>پیگیری</label><input type="text" id="cAnsFollow" placeholder="مثلاً: کنترل ۲۴ ساعته"></div>';
      html += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.wf._submitConsultResponse(\'' + id + '\')">📤 ارسال</button>';
      WF._openSheet(html);
    },

    _submitConsultResponse: async function(id) {
      var answer = document.getElementById('cAnsAnswer').value.trim();
      if (!answer) return alert('پاسخ الزامی است');
      var recs = document.getElementById('cAnsRecs').value.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
      try {
        await WF._api('/api/wf/consults/' + id + '/respond', {
          method:'POST',
          body: JSON.stringify({ answer: answer, recommendations: recs, followup: document.getElementById('cAnsFollow').value })
        });
        NABZ._toast('✅ پاسخ ثبت شد');
        WF._closeAll();
        WF.viewConsult(id);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _approveConsult: async function(id) {
      if (!confirm('تأیید نهایی این مشاوره؟')) return;
      try {
        await WF._api('/api/wf/consults/' + id + '/approve', { method:'POST', body: '{}' });
        NABZ._toast('✅ تأیید شد');
        WF._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  DISCHARGE — ترخیص
    // ═══════════════════════════════════════════════════
    dischargeCreate: async function(patientId) {
      if (!patientId) {
        patientId = await WF._pickPatient('برنامه ترخیص');
        if (!patientId) return;
      }
      var html = '<div class="bs-handle"></div>';
      html += '<div class="bs-hd"><div class="bs-title">🚪 برنامه ترخیص</div>';
      html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      html += '<div class="wf-field"><label>نوع ترخیص</label><select id="dType">';
      html += '<option value="home">خانه</option>';
      html += '<option value="transfer">انتقال به مرکز دیگر</option>';
      html += '<option value="ama">ترخیص با مسئولیت شخصی</option>';
      html += '<option value="expired">فوت</option>';
      html += '</select></div>';
      html += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.wf._submitDischargeCreate(\'' + patientId + '\')">✅ ثبت</button>';
      WF._openSheet(html);
    },

    _submitDischargeCreate: async function(patientId) {
      try {
        var r = await WF._api('/api/wf/discharges', {
          method:'POST',
          body: JSON.stringify({ patientId: patientId, dischargeType: document.getElementById('dType').value })
        });
        NABZ._toast('✅ ثبت شد');
        WF._closeAll();
        WF.viewDischarge(r.id);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    viewDischarge: async function(id) {
      try {
        var all = await WF._api('/api/wf/discharges');
        var d = (all.items || []).find(function(x) { return x.id === id; });
        if (!d) return alert('ترخیص یافت نشد');

        var statusMap = { planned:'برنامه‌ریزی‌شده', summary_drafted:'خلاصه آماده', approved:'تأیید شده', education_done:'آموزش انجام', discharged:'ترخیص شده' };
        var statusCls = { planned:'warn', summary_drafted:'info', approved:'info', education_done:'info', discharged:'ok' };
        var flow = ['برنامه', 'خلاصه', 'تأیید', 'آموزش', 'ترخیص'];
        var flowIdx = { planned:0, summary_drafted:1, approved:2, education_done:3, discharged:4 }[d.status] || 0;

        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">🚪 ترخیص — ' + WF._esc(d.patientName) + '</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        html += '<div style="margin-bottom:8px"><span class="pill ' + (statusCls[d.status] || 'info') + '">' + (statusMap[d.status] || d.status) + '</span></div>';
        html += WF._flowBar(flow, flowIdx);

        html += '<div class="card" style="margin-bottom:12px">';
        html += '<div style="font-size:12px;color:var(--fg-2)">بخش: ' + WF._esc(d.wardCode || '') + ' · نوع: ' + WF._esc(d.dischargeType || 'home') + '</div>';
        html += '<div style="font-size:12px;color:var(--fg-2);margin-top:2px">برنامه: ' + WF._time(d.plannedAt) + '</div>';
        html += '</div>';

        if (d.summary) {
          html += '<div class="card" style="margin-bottom:12px;border-color:var(--primary)"><div class="card-title">📋 خلاصه ترخیص</div>';
          html += '<div style="font-size:12px;margin-bottom:3px"><b>تشخیص نهایی:</b></div>';
          html += '<div style="font-size:12.5px;white-space:pre-wrap">' + WF._esc(d.summary.finalDiagnosis || '') + '</div>';
          html += '<div style="font-size:12px;margin-top:6px"><b>داروها:</b></div>';
          var meds = d.summary.medications;
          if (Array.isArray(meds)) meds = meds.map(function(m) { return typeof m === 'string' ? m : (m.drug || '') + ' ' + (m.dose || ''); }).join(' · ');
          html += '<div style="font-size:12.5px;white-space:pre-wrap">' + WF._esc(meds || '—') + '</div>';
          html += '<div style="font-size:12px;margin-top:6px"><b>پیگیری:</b></div>';
          html += '<div style="font-size:12.5px;white-space:pre-wrap">' + WF._esc(d.summary.followupInstructions || '') + '</div>';
          html += '</div>';
        }

        if (d.education && d.education.completed) {
          html += '<div class="hint success" style="margin-bottom:12px">✅ آموزش بیمار انجام شد' + (d.education.teachBack ? ' (Teach-back موفق)' : '') + '</div>';
        }

        // Actions
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 20px">';
        if (d.status === 'planned') {
          html += '<button class="btn btn-primary" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.wf.dischargeSummary(\'' + d.id + '\')">📝 نوشتن خلاصه</button>';
        }
        if (d.status === 'summary_drafted') {
          html += '<button class="btn btn-ok" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.wf._approveDischarge(\'' + d.id + '\')">✅ تأیید</button>';
        }
        if (d.status === 'approved') {
          html += '<button class="btn btn-primary" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.wf.dischargeEducate(\'' + d.id + '\')">🎓 آموزش بیمار</button>';
        }
        if (d.status === 'education_done') {
          html += '<button class="btn btn-ok" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.wf._completeDischarge(\'' + d.id + '\')">🚪 ترخیص</button>';
        }
        html += '<button class="btn" style="flex:1;min-width:100px;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        html += '</div>';
        WF._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    dischargeSummary: async function(id) {
      // پیش‌پر از تشخیص بیمار
      var all = await WF._api('/api/wf/discharges');
      var d = (all.items || []).find(function(x) { return x.id === id; });
      var html = '<div class="bs-handle"></div>';
      html += '<div class="bs-hd"><div class="bs-title">📝 خلاصه ترخیص</div>';
      html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      html += '<div class="wf-field"><label>تشخیص نهایی *</label><textarea id="dSumDx" rows="2"></textarea></div>';
      html += '<div class="wf-field"><label>داروها (هر خط یک دارو) *</label><textarea id="dSumMeds" rows="4" placeholder="آسپرین ۸۰ - روزی ۱&#10;آتورواستاتین ۴۰ - شب"></textarea></div>';
      html += '<div class="wf-field"><label>توصیه پیگیری *</label><textarea id="dSumFollow" rows="3" placeholder="کنترل ۱ هفته بعد در کلینیک..."></textarea></div>';
      html += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.wf._submitDischargeSummary(\'' + id + '\')">✅ ثبت خلاصه</button>';
      WF._openSheet(html);
    },

    _submitDischargeSummary: async function(id) {
      var dx = document.getElementById('dSumDx').value.trim();
      var meds = document.getElementById('dSumMeds').value.trim();
      var follow = document.getElementById('dSumFollow').value.trim();
      if (!dx || !meds || !follow) return alert('همه فیلدهای ستاره‌دار الزامی است');
      try {
        await WF._api('/api/wf/discharges/' + id + '/summary', {
          method:'POST',
          body: JSON.stringify({ finalDiagnosis: dx, medications: meds, followupInstructions: follow })
        });
        NABZ._toast('✅ خلاصه ثبت شد');
        WF._closeAll();
        WF.viewDischarge(id);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _approveDischarge: async function(id) {
      if (!confirm('تأیید این ترخیص؟')) return;
      try {
        await WF._api('/api/wf/discharges/' + id + '/approve', { method:'POST', body: '{}' });
        NABZ._toast('✅ تأیید شد');
        WF._closeAll();
        WF.viewDischarge(id);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    dischargeEducate: function(id) {
      var html = '<div class="bs-handle"></div>';
      html += '<div class="bs-hd"><div class="bs-title">🎓 آموزش به بیمار</div>';
      html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      html += '<div class="wf-field"><label>موضوعات (با کاما)</label><input type="text" id="dEduTopics" placeholder="دارو، رژیم، فعالیت، علائم هشدار"></div>';
      html += '<div class="wf-field"><label><input type="checkbox" id="dEduTeachback"> Teach-back انجام شد</label></div>';
      html += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.wf._submitDischargeEducate(\'' + id + '\')">✅ ثبت</button>';
      WF._openSheet(html);
    },

    _submitDischargeEducate: async function(id) {
      var topics = document.getElementById('dEduTopics').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      var tb = document.getElementById('dEduTeachback').checked;
      try {
        await WF._api('/api/wf/discharges/' + id + '/educate', {
          method:'POST',
          body: JSON.stringify({ topics: topics, teachBack: tb })
        });
        NABZ._toast('✅ آموزش ثبت شد');
        WF._closeAll();
        WF.viewDischarge(id);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _completeDischarge: async function(id) {
      if (!confirm('ترخیص نهایی شود؟ تخت به‌عنوان cleaning علامت می‌خورد.')) return;
      try {
        await WF._api('/api/wf/discharges/' + id + '/complete', { method:'POST', body: '{}' });
        NABZ._toast('✅ ترخیص شد');
        WF._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  TRANSFER — انتقال
    // ═══════════════════════════════════════════════════
    transferCreate: async function(patientId) {
      if (!patientId) {
        patientId = await WF._pickPatient('درخواست انتقال');
        if (!patientId) return;
      }
      try {
        var wardsResp = await WF._api('/api/bedboard/wards');
        var wards = (wardsResp.items || []).filter(function(w) { return w.available > 0; });
        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">🔄 درخواست انتقال</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        html += '<div class="wf-field"><label>بخش مقصد</label><select id="tToWard">';
        wards.forEach(function(w) {
          html += '<option value="' + w.code + '">' + WF._esc(w.label) + ' — ' + w.available + ' تخت آزاد</option>';
        });
        html += '</select></div>';
        html += '<div class="wf-field"><label>دلیل *</label><textarea id="tReason" rows="3" placeholder="مثلاً: نیاز به مراقبت ویژه قلبی"></textarea></div>';
        html += '<div class="wf-field"><label>فوریت</label><select id="tUrgency">';
        html += '<option value="routine" selected>روتین</option>';
        html += '<option value="urgent">فوری</option>';
        html += '<option value="emergency">اورژانسی</option>';
        html += '</select></div>';
        html += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.wf._submitTransferCreate(\'' + patientId + '\')">📤 ارسال</button>';
        WF._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _submitTransferCreate: async function(patientId) {
      var reason = document.getElementById('tReason').value.trim();
      if (!reason) return alert('دلیل الزامی است');
      try {
        var r = await WF._api('/api/wf/transfers', {
          method:'POST',
          body: JSON.stringify({
            patientId: patientId,
            toWard: document.getElementById('tToWard').value,
            reason: reason,
            urgency: document.getElementById('tUrgency').value
          })
        });
        NABZ._toast('✅ ثبت شد');
        WF._closeAll();
        WF.viewTransfer(r.id);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    viewTransfer: async function(id) {
      try {
        var all = await WF._api('/api/wf/transfers');
        var t = (all.items || []).find(function(x) { return x.id === id; });
        if (!t) return alert('انتقال یافت نشد');

        var statusMap = { requested:'در انتظار تأیید', approved:'تأیید شده', bed_assigned:'تخت تعیین‌شده', handover_done:'تحویل انجام', completed:'منتقل شده' };
        var statusCls = { requested:'warn', approved:'info', bed_assigned:'info', handover_done:'info', completed:'ok' };
        var flow = ['درخواست', 'تأیید', 'تخت', 'تحویل', 'انتقال'];
        var flowIdx = { requested:0, approved:1, bed_assigned:2, handover_done:3, completed:4 }[t.status] || 0;

        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">🔄 انتقال — ' + WF._esc(t.patientName) + '</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        html += '<div style="margin-bottom:8px"><span class="pill ' + (statusCls[t.status] || 'info') + '">' + (statusMap[t.status] || t.status) + '</span>';
        if (t.urgency === 'emergency') html += ' <span class="pill dng">اورژانسی</span>';
        else if (t.urgency === 'urgent') html += ' <span class="pill warn">فوری</span>';
        html += '</div>';
        html += WF._flowBar(flow, flowIdx);

        html += '<div class="card" style="margin-bottom:12px">';
        html += '<div style="font-size:12px;color:var(--fg-2)">از: <b>' + WF._esc(t.fromWard) + '</b> → به: <b>' + WF._esc(t.toWard) + '</b></div>';
        if (t.toBedNumber) html += '<div style="font-size:12px;color:var(--fg-2);margin-top:2px">تخت مقصد: ' + WF._esc(t.toBedNumber) + '</div>';
        html += '<div style="font-size:12px;color:var(--fg-2);margin-top:2px">درخواست: ' + WF._time(t.requestedAt) + '</div>';
        html += '</div>';

        html += '<div class="card" style="margin-bottom:12px"><div class="card-title">📋 دلیل</div>';
        html += '<div style="font-size:13px;white-space:pre-wrap">' + WF._esc(t.reason) + '</div></div>';

        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 20px">';
        var myId = NABZ.state.user && NABZ.state.user.id;
        if (t.status === 'requested' && t.requestedBy !== myId) {
          html += '<button class="btn btn-ok" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.wf._transferAction(\'' + t.id + '\',\'approve\')">✅ تأیید</button>';
        }
        if (t.status === 'approved') {
          html += '<button class="btn btn-primary" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.wf._transferAssignBed(\'' + t.id + '\',\'' + t.toWard + '\')">🛏️ انتخاب تخت</button>';
        }
        if (t.status === 'bed_assigned') {
          html += '<button class="btn btn-primary" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.wf._transferAction(\'' + t.id + '\',\'handover\')">📝 تحویل انجام شد</button>';
        }
        if (t.status === 'handover_done') {
          html += '<button class="btn btn-ok" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.wf._transferAction(\'' + t.id + '\',\'complete\')">✅ انتقال نهایی</button>';
        }
        html += '<button class="btn" style="flex:1;min-width:100px;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        html += '</div>';
        WF._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _transferAction: async function(id, action) {
      if (action === 'complete') {
        if (!confirm('انتقال نهایی شود؟ بیمار به تخت جدید منتقل می‌شود.')) return;
      } else {
        if (!confirm('انجام «' + action + '»؟')) return;
      }
      try {
        await WF._api('/api/wf/transfers/' + id + '/' + action, { method:'POST', body: '{}' });
        NABZ._toast('✅ انجام شد');
        WF._closeAll();
        WF.viewTransfer(id);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _transferAssignBed: async function(id, toWard) {
      try {
        var w = await WF._api('/api/bedboard/ward/' + toWard);
        var beds = (w.items || []).filter(function(b) { return b.status === 'available'; });
        if (!beds.length) return alert('تخت آزاد در ' + toWard + ' نیست');
        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">🛏️ انتخاب تخت در ' + WF._esc(w.ward.label) + '</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">';
        beds.forEach(function(b) {
          html += '<button class="btn" style="padding:14px;display:flex;flex-direction:column;align-items:center;gap:4px" onclick="NABZ.wf._assignThisBed(\'' + id + '\',\'' + b.id + '\')">';
          html += '<span style="font-size:16px;font-weight:900;color:var(--primary)">' + WF._esc(b.bedNumber) + '</span>';
          html += '<span style="font-size:9px;color:var(--fg-2)">' + (b.isCritical ? 'مراقبت ویژه' : 'عادی') + '</span>';
          html += '</button>';
        });
        html += '</div>';
        WF._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _assignThisBed: async function(id, bedId) {
      try {
        await WF._api('/api/wf/transfers/' + id + '/assign_bed', {
          method:'POST', body: JSON.stringify({ bedId: bedId })
        });
        NABZ._toast('✅ تخت تعیین شد');
        WF._closeAll();
        WF.viewTransfer(id);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  Patient quick buttons
    // ═══════════════════════════════════════════════════
    patientButtons: function(patientId) {
      return '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">' +
        '<div style="font-size:12px;font-weight:900;margin-bottom:8px">📤 گردش کار</div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">' +
        '<button class="btn" style="padding:12px 6px;flex-direction:column;display:flex;align-items:center;gap:4px;font-size:10px" onclick="NABZ.wf.consultRequest(\'' + patientId + '\')">' +
          '<span style="font-size:20px">🩺</span><span>مشاوره</span></button>' +
        '<button class="btn" style="padding:12px 6px;flex-direction:column;display:flex;align-items:center;gap:4px;font-size:10px" onclick="NABZ.wf.transferCreate(\'' + patientId + '\')">' +
          '<span style="font-size:20px">🔄</span><span>انتقال</span></button>' +
        '<button class="btn" style="padding:12px 6px;flex-direction:column;display:flex;align-items:center;gap:4px;font-size:10px" onclick="NABZ.wf.dischargeCreate(\'' + patientId + '\')">' +
          '<span style="font-size:20px">🚪</span><span>ترخیص</span></button>' +
        '</div></div>';
    }
  };

  // ═══════════════════════════════════════════════════
  //  Bootstrap
  // ═══════════════════════════════════════════════════
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 50) return console.warn('[wf-ui] timeout');
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.wf = WF;

    // Wrap showItem (chain with previous wraps)
    var prevShowItem = NABZ.showItem;
    NABZ.showItem = function(pid, iid) {
      if (pid === 'workflow.consult') return WF.viewConsult(iid);
      if (pid === 'workflow.discharge') return WF.viewDischarge(iid);
      if (pid === 'workflow.transfer') return WF.viewTransfer(iid);
      return prevShowItem.apply(NABZ, arguments);
    };

    // Wrap _docButtonsFor (chain)
    var prevDocBtns = NABZ._docButtonsFor;
    NABZ._docButtonsFor = function(pid, item) {
      var orig = prevDocBtns.apply(NABZ, arguments) || '';
      if (pid === 'clinical.patients' && item && item.id) {
        return orig + WF.patientButtons(item.id);
      }
      return orig;
    };

    // FAB for workflow panels
    var fab = document.createElement('button');
    fab.id = 'wfFab';
    fab.style.cssText = 'position:fixed;bottom:calc(var(--nav-h,72px) + 20px);left:20px;padding:14px 20px;background:linear-gradient(135deg,#06b6d4,#0891b2);color:#fff;border:none;border-radius:30px;font-family:inherit;font-size:13px;font-weight:900;box-shadow:0 4px 20px rgba(6,182,212,0.5);cursor:pointer;z-index:45;display:none;align-items:center;gap:6px';
    document.body.appendChild(fab);

    var FAB_MAP = {
      'workflow.consult': { label: '➕ مشاوره', fn: function() { WF.consultRequest(); } },
      'workflow.discharge': { label: '➕ ترخیص', fn: function() { WF.dischargeCreate(); } },
      'workflow.transfer': { label: '➕ انتقال', fn: function() { WF.transferCreate(); } }
    };

    function updateFab() {
      var pid = NABZ.state && NABZ.state.current;
      var cfg = pid && FAB_MAP[pid];
      if (!cfg) { fab.style.display = 'none'; return; }
      if (document.querySelector('.bs-backdrop')) { fab.style.display = 'none'; return; }
      fab.style.display = 'flex';
      fab.textContent = cfg.label;
      fab.onclick = cfg.fn;
    }

    var content = document.getElementById('content');
    if (content) new MutationObserver(updateFab).observe(content, { childList:true, subtree:false });
    setInterval(updateFab, 500);

    console.log('[wf-ui] loaded ✓ — consult, discharge, transfer');
  });
})();
