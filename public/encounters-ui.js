// ═══════════════════════════════════════════════════════════
//  NABZ — Encounters UI (Phase A)
//  ⚠️  فقط frontend — هیچ backend‌ای لمس نمی‌شود
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var Enc = {
    _cache: {},

    // ═══════════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════════
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _pad: function(n) { return String(n).padStart(2, '0'); },
    _time: function(iso) {
      if (!iso) return '—';
      try { return new Date(iso).toLocaleTimeString('fa-IR', { hour:'2-digit', minute:'2-digit' }); }
      catch (_) { return '—'; }
    },
    _date: function(iso) {
      if (!iso) return '—';
      try { return new Date(iso).toLocaleDateString('fa-IR'); }
      catch (_) { return '—'; }
    },
    _closeAll: function() {
      document.querySelectorAll('.bs-backdrop').forEach(function(e) { e.remove(); });
    },
    _openSheet: function(html, opts) {
      opts = opts || {};
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

    // ═══════════════════════════════════════════════════
    //  Patient picker
    // ═══════════════════════════════════════════════════
    pickPatient: function(title) {
      return new Promise(async function(resolve) {
        try {
          var d = await NABZ._api('/api/clinical/patients');
          var items = (d.items || []).filter(function(p) {
            return ['in_care', 'admitted'].indexOf(p.status) >= 0;
          });
          if (!items.length) {
            alert('بیماری بستری نیست');
            return resolve(null);
          }
          var html = '<div class="bs-handle"></div>';
          html += '<div class="bs-hd"><div class="bs-title">👤 ' + NABZ._esc(title || 'انتخاب بیمار') + '</div>';
          html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
          html += '<div class="bs-body">';
          for (var i = 0; i < items.length; i++) {
            var p = items[i];
            html += '<button class="btn" style="width:100%;text-align:right;padding:14px;margin-bottom:6px;justify-content:space-between;display:flex;flex-direction:column;align-items:stretch;gap:2px" ';
            html += 'onclick="window._encPickPatient(\'' + p.id + '\')">';
            html += '<div style="font-weight:900">' + NABZ._esc(p.firstName + ' ' + p.lastName) + '</div>';
            html += '<div style="font-size:11px;color:var(--fg-2)">' + NABZ._esc(p.wardCode || '') + ' · تخت ' + NABZ._esc(p.bedNumber || '—') + ' · ' + NABZ._esc(p.diagnosis || '') + '</div>';
            html += '</button>';
          }
          html += '</div>';
          var s = Enc._openSheet(html);
          window._encPickPatient = function(pid) {
            s.sheet.remove();
            resolve(pid);
          };
        } catch (e) {
          alert('خطا: ' + e.message);
          resolve(null);
        }
      });
    },

    // ═══════════════════════════════════════════════════
    //  SOAP Round Form
    // ═══════════════════════════════════════════════════
    newRound: async function(patientId, roundId) {
      if (!patientId) {
        patientId = await Enc.pickPatient('شروع راند جدید');
        if (!patientId) return;
      }
      try {
        var d = await Enc._api('/api/enc/soap/' + patientId);
        Enc._cache['soap_' + patientId] = d;
        var r = null;
        if (roundId) r = await Enc._api('/api/enc/round/' + roundId).catch(function() { return null; });
        Enc._openRoundForm(d, r);
      } catch (e) {
        alert('خطا: ' + e.message);
      }
    },

    _openRoundForm: function(d, r) {
      var p = d.patient;
      var isEdit = !!r;
      var isDraft = !r || r.status === 'draft';
      var sub = (r && r.subjective) || {};
      var obj = (r && r.objective) || {};
      var asmt = (r && r.assessment) || {};
      var plan = (r && r.plan) || {};
      var v = d.lastVital || {};

      var html = '<div class="bs-handle"></div>';
      html += '<div class="bs-hd"><div class="bs-title">🩺 ' + (isEdit ? 'ویرایش راند' : 'راند جدید') + ' — ' + Enc._esc(p.name) + '</div>';
      html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      // Header بیمار
      html += '<div class="card" style="margin-bottom:12px;background:linear-gradient(135deg,rgba(6,182,212,0.1),rgba(139,92,246,0.05))">';
      html += '<div style="font-size:15px;font-weight:900">' + Enc._esc(p.name) + '</div>';
      html += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + (p.age || '—') + ' سال · ' + Enc._esc(p.ward) + ' · تخت ' + Enc._esc(p.bed || '—') + '</div>';
      html += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + Enc._esc(p.diagnosis || '') + '</div>';
      if (p.allergies && p.allergies.length) {
        html += '<div style="font-size:11px;color:var(--dng);margin-top:4px;font-weight:700">⚠️ آلرژی: ' + Enc._esc(p.allergies.join('، ')) + '</div>';
      }
      if (d.mlRiskScore) {
        var rlvl = d.mlRiskScore >= 60 ? 'dng' : d.mlRiskScore >= 30 ? 'warn' : 'ok';
        html += '<div style="font-size:11px;color:var(--' + rlvl + ');margin-top:4px;font-weight:700">🧠 ریسک ML: ' + d.mlRiskScore + '%</div>';
      }
      html += '</div>';

      // Subtype
      html += '<div class="enc-section">';
      html += '<div class="enc-field"><label>نوع راند</label>';
      html += '<select id="encSubtype" ' + (isDraft ? '' : 'disabled') + '>';
      for (var s of [['morning','صبح'],['evening','عصر'],['night','شب'],['emergency','اورژانس']]) {
        html += '<option value="' + s[0] + '"' + ((r && r.subtype === s[0]) ? ' selected' : '') + '>' + s[1] + '</option>';
      }
      html += '</select></div></div>';

      // ── S ──
      html += '<div class="enc-section">';
      html += '<div class="enc-section-title">📌 S — ذهنی</div>';
      html += '<div class="enc-field"><label>شکایت اصلی</label>';
      html += '<textarea id="encCC" rows="2" ' + (isDraft ? '' : 'disabled') + '>' + Enc._esc(sub.chiefComplaint || '') + '</textarea></div>';
      html += '<div class="enc-field"><label>تاریخچه</label>';
      html += '<textarea id="encHist" rows="2" ' + (isDraft ? '' : 'disabled') + '>' + Enc._esc(sub.history || '') + '</textarea></div>';
      html += '<div class="enc-field"><label>مرور سیستم‌ها (ROS)</label>';
      html += '<textarea id="encROS" rows="2" ' + (isDraft ? '' : 'disabled') + '>' + Enc._esc(sub.reviewOfSystems || '') + '</textarea></div>';
      html += '</div>';

      // ── O ──
      html += '<div class="enc-section">';
      html += '<div class="enc-section-title">📊 O — عینی</div>';
      if (v.hr || v.bp_sys) {
        html += '<div class="enc-vitals">';
        var vitalsList = [
          ['HR', v.hr], ['BP', (v.bp_sys || '—') + '/' + (v.bp_dia || '—')],
          ['RR', v.rr], ['T', v.temp ? v.temp + '°' : '—'],
          ['SpO₂', v.spo2 ? v.spo2 + '%' : '—'], ['NEWS2', v.news2 || '—']
        ];
        for (var vit of vitalsList) {
          html += '<div class="enc-vital"><div class="v">' + Enc._esc(String(vit[1] || '—')) + '</div><div class="l">' + vit[0] + '</div></div>';
        }
        html += '</div>';
      }
      html += '<div class="enc-field"><label>معاینه فیزیکی</label>';
      html += '<textarea id="encExam" rows="3" ' + (isDraft ? '' : 'disabled') + ' placeholder="HEENT، قلب، ریه، شکم، نورولوژیک...">' + Enc._esc(obj.physicalExam || '') + '</textarea></div>';
      html += '</div>';

      // ── A ──
      html += '<div class="enc-section">';
      html += '<div class="enc-section-title">🔍 A — ارزیابی</div>';
      html += '<div class="enc-field"><label>تشخیص‌های افتراقی (با کاما)</label>';
      html += '<input type="text" id="encDx" value="' + Enc._esc((asmt.diagnoses || []).join(', ')) + '" ' + (isDraft ? '' : 'disabled') + '></div>';
      html += '<div class="enc-field"><label>شروع بالینی</label>';
      html += '<textarea id="encImpression" rows="3" ' + (isDraft ? '' : 'disabled') + '>' + Enc._esc(asmt.clinicalImpression || '') + '</textarea></div>';
      html += '</div>';

      // ── P ──
      html += '<div class="enc-section">';
      html += '<div class="enc-section-title">📋 P — پلن</div>';
      html += '<div class="enc-field"><label>داروها (خلاصه)</label>';
      html += '<textarea id="encPlanMeds" rows="2" ' + (isDraft ? '' : 'disabled') + '>' + Enc._esc((plan.medications || []).map(function(m) { return typeof m === 'string' ? m : (m.drug || '') + ' ' + (m.dose || ''); }).join('\n')) + '</textarea></div>';
      html += '<div class="enc-field"><label>آزمایش‌ها</label>';
      html += '<input type="text" id="encPlanLabs" value="' + Enc._esc((plan.labs || []).join(', ')) + '" ' + (isDraft ? '' : 'disabled') + '></div>';
      html += '<div class="enc-field"><label>تصویربرداری</label>';
      html += '<input type="text" id="encPlanImaging" value="' + Enc._esc((plan.imaging || []).join(', ')) + '" ' + (isDraft ? '' : 'disabled') + '></div>';
      html += '<div class="enc-field"><label>مشاوره</label>';
      html += '<input type="text" id="encPlanConsults" value="' + Enc._esc((plan.consults || []).join(', ')) + '" ' + (isDraft ? '' : 'disabled') + '></div>';
      html += '<div class="enc-field"><label>رژیم غذایی</label>';
      html += '<input type="text" id="encDiet" value="' + Enc._esc(plan.diet || '') + '" ' + (isDraft ? '' : 'disabled') + '></div>';
      html += '<div class="enc-field"><label>فعالیت</label>';
      html += '<input type="text" id="encActivity" value="' + Enc._esc(plan.activity || '') + '" ' + (isDraft ? '' : 'disabled') + '></div>';
      html += '</div>';

      // Actions
      html += '<div style="display:flex;gap:6px;margin-top:16px;margin-bottom:20px">';
      if (isDraft) {
        html += '<button class="btn" style="flex:1;padding:12px" onclick="NABZ.enc._saveRound(\'' + p.id + '\',' + (isEdit ? "'" + r.id + "'" : 'null') + ',false)">💾 ذخیره</button>';
        html += '<button class="btn btn-primary" style="flex:1;padding:12px" onclick="NABZ.enc._saveRound(\'' + p.id + '\',' + (isEdit ? "'" + r.id + "'" : 'null') + ',true)">✍️ امضا</button>';
      } else {
        html += '<div style="flex:1;text-align:center;padding:12px;background:var(--ok-soft);border-radius:8px;color:var(--ok);font-weight:900">✅ امضا شده — ' + Enc._esc(r.signedByName || '') + '</div>';
      }
      html += '</div>';

      // Order sets + pathways quick actions
      if (isDraft) {
        html += '<div style="margin-bottom:20px">';
        html += '<button class="btn btn-block" style="margin-bottom:6px;background:var(--violet-soft);color:var(--violet);border-color:var(--violet)" onclick="NABZ.enc.showOrderSets(\'' + p.id + '\')">💊 اعمال بسته درمانی</button>';
        html += '<button class="btn btn-block" style="background:var(--warn-soft);color:var(--warn);border-color:var(--warn)" onclick="NABZ.enc.startPathway(\'' + p.id + '\')">🛤️ شروع مسیر بالینی</button>';
        html += '</div>';
      }

      Enc._openSheet(html);
    },

    _saveRound: async function(patientId, roundId, sign) {
      var subtype = document.getElementById('encSubtype').value;
      var body = {
        subtype: subtype,
        subjective: {
          chiefComplaint: document.getElementById('encCC').value,
          history: document.getElementById('encHist').value,
          reviewOfSystems: document.getElementById('encROS').value
        },
        objective: {
          physicalExam: document.getElementById('encExam').value
        },
        assessment: {
          diagnoses: document.getElementById('encDx').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean),
          clinicalImpression: document.getElementById('encImpression').value
        },
        plan: {
          medications: document.getElementById('encPlanMeds').value.split('\n').filter(Boolean),
          labs: document.getElementById('encPlanLabs').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean),
          imaging: document.getElementById('encPlanImaging').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean),
          consults: document.getElementById('encPlanConsults').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean),
          diet: document.getElementById('encDiet').value,
          activity: document.getElementById('encActivity').value
        }
      };
      try {
        var r;
        if (roundId) {
          await Enc._api('/api/enc/round/' + roundId, { method:'PUT', body: JSON.stringify(body) });
          r = { id: roundId };
        } else {
          body.patientId = patientId;
          r = await Enc._api('/api/enc/round', { method:'POST', body: JSON.stringify(body) });
        }
        if (sign) {
          var signed = await Enc._api('/api/enc/round/' + r.id + '/sign', { method:'POST', body: '{}' });
          NABZ._toast(signed.status === 'pending_cosign' ? '✅ ارسال برای تأیید استاد' : '✅ راند امضا شد');
        } else {
          NABZ._toast('💾 ذخیره شد');
        }
        Enc._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) {
        alert('خطا: ' + e.message);
      }
    },

    // ═══════════════════════════════════════════════════
    //  Round view
    // ═══════════════════════════════════════════════════
    openRound: async function(roundId) {
      try {
        var r = await Enc._api('/api/enc/round/' + roundId);
        var canEdit = r.status === 'draft' && (r.authorId === (NABZ.state.user && NABZ.state.user.id) || (NABZ.state.user && NABZ.state.user.role === 'admin'));
        var canCosign = r.status === 'pending_cosign' && NABZ.state.user && ['attending','specialist','admin'].indexOf(NABZ.state.user.role) >= 0;
        var body = '<div class="bs-handle"></div>';
        body += '<div class="bs-hd"><div class="bs-title">🩺 ' + Enc._esc(r.patientName) + '</div>';
        body += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        body += '<div style="font-size:11.5px;color:var(--fg-2);margin-bottom:12px">' + Enc._esc(r.wardCode) + ' · تخت ' + Enc._esc(r.bedNumber || '—') + ' · ' + Enc._date(r.createdAt) + ' · ' + Enc._esc(r.authorName) + '</div>';
        var statusMap = { draft:'پیش‌نویس', pending_cosign:'در انتظار تأیید', signed:'امضا شده' };
        var statusCls = { draft:'warn', pending_cosign:'info', signed:'ok' };
        body += '<div style="margin-bottom:12px"><span class="pill ' + (statusCls[r.status] || 'info') + '">' + (statusMap[r.status] || r.status) + '</span></div>';
        body += '<div class="enc-section"><div class="enc-section-title">📌 S</div>';
        body += '<div style="font-size:13px;white-space:pre-wrap">' + Enc._esc(r.subjective.chiefComplaint || '—') + '</div>';
        if (r.subjective.history) body += '<div style="font-size:12px;color:var(--fg-2);margin-top:4px;white-space:pre-wrap">' + Enc._esc(r.subjective.history) + '</div>';
        body += '</div>';
        if (r.objective && r.objective.physicalExam) {
          body += '<div class="enc-section"><div class="enc-section-title">📊 O</div>';
          body += '<div style="font-size:12.5px;white-space:pre-wrap">' + Enc._esc(r.objective.physicalExam) + '</div></div>';
        }
        if (r.assessment && (r.assessment.diagnoses.length || r.assessment.clinicalImpression)) {
          body += '<div class="enc-section"><div class="enc-section-title">🔍 A</div>';
          if (r.assessment.diagnoses.length) body += '<div style="font-size:12.5px;margin-bottom:4px"><b>تشخیص:</b> ' + Enc._esc(r.assessment.diagnoses.join('، ')) + '</div>';
          if (r.assessment.clinicalImpression) body += '<div style="font-size:12.5px;white-space:pre-wrap">' + Enc._esc(r.assessment.clinicalImpression) + '</div>';
          body += '</div>';
        }
        if (r.plan && (r.plan.medications.length || r.plan.labs.length || r.plan.diet)) {
          body += '<div class="enc-section"><div class="enc-section-title">📋 P</div>';
          if (r.plan.medications && r.plan.medications.length) {
            body += '<div style="font-size:12px;margin-bottom:3px"><b>دارو:</b> ' + Enc._esc(r.plan.medications.join(' · ')) + '</div>';
          }
          if (r.plan.labs && r.plan.labs.length) {
            body += '<div style="font-size:12px;margin-bottom:3px"><b>آزمایش:</b> ' + Enc._esc(r.plan.labs.join('، ')) + '</div>';
          }
          if (r.plan.imaging && r.plan.imaging.length) {
            body += '<div style="font-size:12px;margin-bottom:3px"><b>تصویر:</b> ' + Enc._esc(r.plan.imaging.join('، ')) + '</div>';
          }
          if (r.plan.diet) body += '<div style="font-size:12px;margin-bottom:3px"><b>رژیم:</b> ' + Enc._esc(r.plan.diet) + '</div>';
          body += '</div>';
        }
        if (r.cosignRequired && r.status === 'pending_cosign') {
          body += '<div class="hint warn">✍️ این راند توسط رزیدنت نوشته شده — نیاز به تأیید استاد دارد</div>';
        }
        body += '<div style="display:flex;gap:6px;margin-top:14px;margin-bottom:20px">';
        if (canEdit) {
          body += '<button class="btn" style="flex:1;padding:12px" onclick="NABZ.enc.newRound(\'' + r.patientId + '\',\'' + r.id + '\')">✎ ویرایش</button>';
        }
        if (canCosign) {
          body += '<button class="btn btn-primary" style="flex:1;padding:12px" onclick="NABZ.enc._doCosign(\'' + r.id + '\')">✅ تأیید نهایی</button>';
        }
        body += '<button class="btn" style="flex:1;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        body += '</div>';
        Enc._openSheet(body);
      } catch (e) {
        alert('خطا: ' + e.message);
      }
    },

    _doCosign: async function(roundId) {
      if (!confirm('تأیید نهایی این راند؟')) return;
      try {
        await Enc._api('/api/enc/round/' + roundId + '/cosign', { method:'POST', body: '{}' });
        NABZ._toast('✅ تأیید شد');
        Enc._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  Order Sets
    // ═══════════════════════════════════════════════════
    showOrderSets: async function(patientId) {
      if (!patientId) {
        patientId = await Enc.pickPatient('اعمال بسته درمانی');
        if (!patientId) return;
      }
      try {
        var d = await Enc._api('/api/enc/ordersets');
        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">💊 بسته‌های درمانی</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        html += '<div class="enc-ordersets-grid">';
        for (var s of d.items) {
          html += '<button class="enc-orderset-btn" onclick="NABZ.enc._applyOrderSet(\'' + s.id + '\',\'' + patientId + '\')">';
          html += '<span class="icon">' + s.icon + '</span>';
          html += '<span class="name">' + Enc._esc(s.name) + '</span>';
          html += '<span class="desc">' + Enc._esc(s.description) + '</span>';
          html += '</button>';
        }
        html += '</div>';
        html += '<div class="hint info" style="margin-top:12px">با انتخاب، دستورات، آزمایش‌ها، تصویربرداری، مشاوره و دستورات پرستاری به‌صورت خودکار ثبت می‌شوند.</div>';
        Enc._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _applyOrderSet: async function(setId, patientId) {
      if (!confirm('بسته اعمال شود؟')) return;
      try {
        var r = await Enc._api('/api/enc/ordersets/' + setId + '/apply', {
          method:'POST', body: JSON.stringify({ patientId: patientId })
        });
        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">✅ اعمال شد</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        html += '<div class="card" style="text-align:center"><div style="font-size:18px;font-weight:900;margin-bottom:8px">' + Enc._esc(r.orderSet) + '</div>';
        html += '<div style="font-size:13px;color:var(--fg-2);margin-bottom:12px">' + r.total + ' مورد ثبت شد</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;font-size:11.5px">';
        var labels = { orders:'دارو', labs:'آزمایش', imaging:'تصویر', consults:'مشاوره', nursing:'پرستاری' };
        for (var k in r.created) {
          if (r.created[k] > 0) html += '<div style="padding:6px;background:var(--bg-3);border-radius:6px;text-align:center"><div style="font-weight:900;color:var(--primary);font-size:16px">' + r.created[k] + '</div><div>' + (labels[k] || k) + '</div></div>';
        }
        html += '</div></div>';
        html += '<button class="btn btn-primary btn-block" style="margin-top:12px;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove();NABZ.show(NABZ.state.current)">بستن</button>';
        Enc._closeAll();
        Enc._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  Procedures
    // ═══════════════════════════════════════════════════
    newProcedure: async function(patientId) {
      if (!patientId) {
        patientId = await Enc.pickPatient('پروسیجر جدید');
        if (!patientId) return;
      }
      try {
        var t = await Enc._api('/api/enc/proctypes');
        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">💉 پروسیجر جدید</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        html += '<div class="enc-field"><label>نوع پروسیجر</label><select id="procType">';
        for (var tp of t.items) html += '<option value="' + tp.id + '">' + tp.icon + ' ' + Enc._esc(tp.label) + '</option>';
        html += '</select></div>';
        html += '<div class="enc-field"><label>اندیکاسیون</label><textarea id="procInd" rows="2"></textarea></div>';
        html += '<div class="enc-field"><label><input type="checkbox" id="procConsent"> رضایت‌نامه اخذ شد</label></div>';
        html += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:8px" onclick="NABZ.enc._createProc(\'' + patientId + '\')">ثبت و شروع</button>';
        Enc._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _createProc: async function(patientId) {
      var type = document.getElementById('procType').value;
      var indication = document.getElementById('procInd').value;
      var consent = document.getElementById('procConsent').checked;
      try {
        var r = await Enc._api('/api/enc/procedure', {
          method:'POST',
          body: JSON.stringify({ patientId: patientId, type: type, indication: indication, consentObtained: consent })
        });
        Enc._closeAll();
        NABZ._toast('✅ پروسیجر ثبت شد');
        Enc.openProcedure(r.id);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    openProcedure: async function(id) {
      try {
        var r = await Enc._api('/api/enc/procedure/' + id);
        var canEdit = r.status !== 'completed';
        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">' + r.icon + ' ' + Enc._esc(r.typeLabel) + '</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        var statusMap = { planned:'برنامه‌ریزی‌شده', in_progress:'در حال انجام', completed:'تکمیل' };
        var statusCls = { planned:'info', in_progress:'warn', completed:'ok' };
        html += '<div style="margin-bottom:12px"><span class="pill ' + (statusCls[r.status] || 'info') + '">' + (statusMap[r.status] || r.status) + '</span></div>';
        html += '<div style="font-size:12px;color:var(--fg-2);margin-bottom:8px">' + Enc._esc(r.patientName) + ' · ' + Enc._esc(r.wardCode) + '</div>';
        html += '<div class="enc-section"><div class="enc-section-title">📋 چک‌لیست</div>';
        r.checklist.forEach(function(c, idx) {
          var checked = c.done ? 'checked' : '';
          var disabled = (r.status === 'completed') ? 'disabled' : '';
          html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12.5px">';
          html += '<input type="checkbox" ' + checked + ' ' + disabled + ' onchange="NABZ.enc._toggleChecklist(\'' + r.id + '\',' + idx + ',this.checked)" style="width:18px;height:18px">';
          html += '<span>' + Enc._esc(c.item) + '</span>';
          html += '</div>';
        });
        html += '</div>';
        if (r.note && (r.note.findings || r.note.technique)) {
          html += '<div class="enc-section"><div class="enc-section-title">📝 نکته</div>';
          if (r.note.technique) html += '<div style="font-size:12px;margin-bottom:3px"><b>تکنیک:</b> ' + Enc._esc(r.note.technique) + '</div>';
          if (r.note.findings) html += '<div style="font-size:12px;margin-bottom:3px"><b>یافته:</b> ' + Enc._esc(r.note.findings) + '</div>';
          if (r.note.complications) html += '<div style="font-size:12px"><b>عوارض:</b> ' + Enc._esc(r.note.complications) + '</div>';
          html += '</div>';
        }
        html += '<div style="display:flex;gap:6px;margin-top:14px;margin-bottom:20px">';
        if (r.status === 'planned') {
          html += '<button class="btn btn-primary" style="flex:1;padding:12px" onclick="NABZ.enc._startProc(\'' + r.id + '\')">▶️ شروع</button>';
        } else if (r.status === 'in_progress') {
          html += '<button class="btn btn-ok" style="flex:1;padding:12px" onclick="NABZ.enc._completeProc(\'' + r.id + '\')">✅ تکمیل</button>';
        }
        html += '</div>';
        Enc._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _toggleChecklist: async function(procId, idx, checked) {
      try {
        var r = await Enc._api('/api/enc/procedure/' + procId);
        var checklist = r.checklist.map(function(c, i) {
          return { item: c.item, done: i === idx ? checked : c.done };
        });
        await Enc._api('/api/enc/procedure/' + procId, { method:'PUT', body: JSON.stringify({ checklist: checklist }) });
      } catch (e) { console.warn('[enc] toggle checklist:', e.message); }
    },

    _startProc: async function(procId) {
      try {
        await Enc._api('/api/enc/procedure/' + procId, { method:'PUT', body: JSON.stringify({ start: true }) });
        NABZ._toast('▶️ شروع شد');
        Enc._closeAll();
        Enc.openProcedure(procId);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _completeProc: function(procId) {
      var html = '<div class="bs-handle"></div>';
      html += '<div class="bs-hd"><div class="bs-title">📝 ثبت نکته پایانی</div>';
      html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      html += '<div class="enc-field"><label>تکنیک</label><textarea id="procTech" rows="2"></textarea></div>';
      html += '<div class="enc-field"><label>یافته *</label><textarea id="procFindings" rows="2"></textarea></div>';
      html += '<div class="enc-field"><label>عوارض</label><textarea id="procCompl" rows="1"></textarea></div>';
      html += '<button class="btn btn-ok btn-block" style="padding:12px;margin-top:8px" onclick="NABZ.enc._doComplete(\'' + procId + '\')">✅ ثبت و تکمیل</button>';
      Enc._closeAll();
      Enc._openSheet(html);
    },

    _doComplete: async function(procId) {
      var note = {
        technique: document.getElementById('procTech').value,
        findings: document.getElementById('procFindings').value,
        complications: document.getElementById('procCompl').value
      };
      if (!note.findings) { alert('یافته الزامی است'); return; }
      try {
        await Enc._api('/api/enc/procedure/' + procId + '/complete', { method:'POST', body: JSON.stringify({ note: note }) });
        NABZ._toast('✅ تکمیل شد');
        Enc._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  Pathways
    // ═══════════════════════════════════════════════════
    startPathway: async function(patientId) {
      if (!patientId) {
        patientId = await Enc.pickPatient('شروع مسیر بالینی');
        if (!patientId) return;
      }
      try {
        var d = await Enc._api('/api/enc/pathways');
        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">🛤️ مسیرهای بالینی</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        for (var p of d.items) {
          html += '<button class="btn" style="width:100%;text-align:right;padding:14px;margin-bottom:8px;display:flex;flex-direction:column;gap:4px;align-items:stretch" ';
          html += 'onclick="NABZ.enc._doStartPathway(\'' + p.id + '\',\'' + patientId + '\')">';
          html += '<div style="font-weight:900;font-size:14px">' + p.icon + ' ' + Enc._esc(p.name) + '</div>';
          html += '<div style="font-size:11px;color:var(--fg-2)">' + p.milestones.length + ' مرحله · ' + Math.round(p.totalMinutes / 60) + ' ساعت</div>';
          html += '</button>';
        }
        Enc._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _doStartPathway: async function(pathwayId, patientId) {
      try {
        var r = await Enc._api('/api/enc/pathways/' + pathwayId + '/start', {
          method:'POST', body: JSON.stringify({ patientId: patientId })
        });
        Enc._closeAll();
        NABZ._toast('✅ مسیر شروع شد');
        Enc.openPathway(r.id);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    openPathway: async function(instanceId) {
      try {
        var pi = await Enc._api('/api/enc/pathway/' + instanceId);
        var now = Date.now();
        var total = pi.milestones.length;
        var done = pi.milestones.filter(function(m) { return m.done; }).length;
        var pct = Math.round(done / total * 100);
        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">' + pi.icon + ' ' + Enc._esc(pi.pathwayName) + '</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">';
        html += '<div style="flex:1"><div style="font-weight:900">' + Enc._esc(pi.patientName) + '</div>';
        html += '<div style="font-size:11px;color:var(--fg-2)">' + Enc._esc(pi.wardCode) + ' · شروع: ' + Enc._time(pi.startAt) + '</div></div>';
        html += '<div style="text-align:left"><div style="font-size:20px;font-weight:900;color:var(--primary)">' + pct + '%</div>';
        html += '<div style="font-size:10px;color:var(--fg-2)">' + done + '/' + total + '</div></div>';
        html += '</div>';
        html += '<div class="progress" style="margin-bottom:12px"><div class="progress-fill" style="width:' + pct + '%"></div></div>';

        for (var m of pi.milestones) {
          var due = new Date(m.dueAt).getTime();
          var overdue = !m.done && now > due;
          var cls = m.done ? 'done' : overdue ? 'overdue' : 'pending';
          var icon = m.done ? '✅' : overdue ? '⚠️' : '⏳';
          html += '<div class="enc-milestone ' + cls + '">';
          html += '<div class="enc-milestone-icon">' + icon + '</div>';
          html += '<div class="enc-milestone-content">';
          html += '<div style="font-weight:700;font-size:13px">' + Enc._esc(m.label) + '</div>';
          html += '<div style="font-size:10.5px;color:var(--fg-2)">';
          html += 'هدف: ' + m.offset + ' دقیقه';
          if (m.done) html += ' · انجام: ' + Enc._time(m.doneAt);
          else if (overdue) html += ' · <span style="color:var(--dng);font-weight:900">گذشته</span>';
          html += '</div>';
          html += '</div>';
          if (!m.done) {
            html += '<button class="btn btn-xs" style="padding:4px 8px;font-size:11px" onclick="NABZ.enc._advance(\'' + pi.id + '\',\'' + Enc._esc(m.label).replace(/'/g, "\\'") + '\')">انجام شد</button>';
          }
          html += '</div>';
        }
        html += '<div style="margin-top:14px;margin-bottom:20px">';
        if (pi.status === 'active' && done === total) {
          html += '<button class="btn btn-ok btn-block" style="padding:12px" onclick="NABZ.enc._finishPathway(\'' + pi.id + '\')">✅ تکمیل مسیر</button>';
        } else if (pi.status !== 'active') {
          html += '<div class="hint success">✅ مسیر تکمیل شده</div>';
        }
        html += '</div>';
        Enc._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _advance: async function(instanceId, label) {
      try {
        await Enc._api('/api/enc/pathway/' + instanceId + '/advance', {
          method:'POST', body: JSON.stringify({ milestoneLabel: label })
        });
        NABZ._toast('✅ ثبت شد');
        Enc._closeAll();
        Enc.openPathway(instanceId);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _finishPathway: async function(instanceId) {
      if (!confirm('مسیر تکمیل شود؟')) return;
      try {
        await Enc._api('/api/enc/pathway/' + instanceId + '/complete', { method:'POST', body: '{}' });
        NABZ._toast('✅ مسیر تکمیل شد');
        Enc._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  Patient buttons
    // ═══════════════════════════════════════════════════
    patientButtons: function(patientId) {
      return '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">' +
        '<div style="font-size:12px;font-weight:900;margin-bottom:8px">🩺 راند و درمان</div>' +
        '<button class="btn btn-block" style="margin-bottom:4px;background:var(--primary-soft);color:var(--primary);border-color:var(--primary)" onclick="NABZ.enc.newRound(\'' + patientId + '\')">🩺 شروع راند جدید</button>' +
        '<button class="btn btn-block" style="margin-bottom:4px;background:var(--violet-soft);color:var(--violet);border-color:var(--violet)" onclick="NABZ.enc.showOrderSets(\'' + patientId + '\')">💊 اعمال بسته درمانی</button>' +
        '<button class="btn btn-block" style="margin-bottom:4px;background:var(--warn-soft);color:var(--warn);border-color:var(--warn)" onclick="NABZ.enc.newProcedure(\'' + patientId + '\')">💉 پروسیجر جدید</button>' +
        '<button class="btn btn-block" style="background:var(--ok-soft);color:var(--ok);border-color:var(--ok)" onclick="NABZ.enc.startPathway(\'' + patientId + '\')">🛤️ شروع مسیر بالینی</button>' +
        '</div>';
    }
  };

  // ═══════════════════════════════════════════════════════
  //  Bootstrap
  // ═══════════════════════════════════════════════════════
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 50) return console.warn('[enc-ui] timeout');
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.enc = Enc;

    // Wrap showItem
    var origShowItem = NABZ.showItem;
    NABZ.showItem = function(pid, iid) {
      if (pid === 'encounters.rounds' || pid === 'encounters.pending_cosign') {
        return Enc.openRound(iid);
      }
      if (pid === 'encounters.procedures') {
        return Enc.openProcedure(iid);
      }
      if (pid === 'encounters.pathways') {
        return Enc.openPathway(iid);
      }
      return origShowItem.apply(NABZ, arguments);
    };

    // Wrap _docButtonsFor
    var origDocBtns = NABZ._docButtonsFor;
    NABZ._docButtonsFor = function(pid, item) {
      var orig = origDocBtns.apply(NABZ, arguments) || '';
      if (pid === 'clinical.patients' && item && item.id) {
        return orig + Enc.patientButtons(item.id);
      }
      return orig;
    };

    // FAB
    setupFAB();

    console.log('[enc-ui] loaded ✓');
  });

  function setupFAB() {
    var fab = document.createElement('button');
    fab.id = 'encFab';
    fab.className = 'enc-fab';
    fab.style.display = 'none';
    document.body.appendChild(fab);

    var FAB_MAP = {
      'encounters.rounds': { label: '➕ راند جدید', fn: function() { Enc.newRound(); } },
      'encounters.procedures': { label: '➕ پروسیجر', fn: function() { Enc.newProcedure(); } },
      'encounters.pathways': { label: '➕ مسیر', fn: function() { Enc.startPathway(); } }
    };

    function update() {
      var pid = NABZ.state && NABZ.state.current;
      var cfg = pid && FAB_MAP[pid];
      if (!cfg) { fab.style.display = 'none'; return; }
      // اگر sheet باز است، FAB مخفی
      if (document.querySelector('.bs-backdrop')) { fab.style.display = 'none'; return; }
      fab.style.display = 'flex';
      fab.textContent = cfg.label;
      fab.onclick = cfg.fn;
    }

    var content = document.getElementById('content');
    if (content) {
      new MutationObserver(update).observe(content, { childList: true, subtree: false });
    }
    setInterval(update, 500);
  }
})();
