// ═══════════════════════════════════════════════════════════
//  NABZ — Safety UI (Sepsis + Infection + Isolation + Incident + Risk)
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var SF = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _time: function(iso) { try { return new Date(iso).toLocaleString('fa-IR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); } catch(_){ return '—'; } },
    _closeAll: function() { document.querySelectorAll('.bs-backdrop').forEach(function(e) { e.remove(); }); },
    _openSheet: function(html) {
      var s = document.createElement('div');
      s.className = 'bs-backdrop';
      s.onclick = function(e) { if (e.target === s) s.remove(); };
      var c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '95vh';
      c.innerHTML = html;
      s.appendChild(c);
      document.body.appendChild(s);
      requestAnimationFrame(function() { s.classList.add('show'); });
      return { sheet:s, content:c };
    },
    _pickPatient: async function(title) {
      if (NABZ.enc && NABZ.enc.pickPatient) return NABZ.enc.pickPatient(title);
      var d = await SF._api('/api/clinical/patients');
      var items = (d.items||[]).filter(function(p) { return ['in_care','admitted'].indexOf(p.status) >= 0; });
      if (!items.length) return null;
      return new Promise(function(resolve) {
        var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">👤 بیمار</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        items.forEach(function(p) {
          h += '<button class="btn" style="width:100%;text-align:right;padding:12px;margin-bottom:4px" onclick="window._sfp(\'' + p.id + '\')"><b>' + NABZ._esc(p.firstName+' '+p.lastName) + '</b></button>';
        });
        var s = SF._openSheet(h);
        window._sfp = function(pid) { s.sheet.remove(); resolve(pid); };
      });
    },

    // ═══ SEPSIS SCREEN ═══
    sepsisScreen: async function(patientId) {
      if (!patientId) {
        patientId = await SF._pickPatient('غربالگری سپسیس');
        if (!patientId) return;
      }
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title" style="color:var(--dng)">🦠 غربالگری qSOFA</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="hint danger">Singer et al., JAMA 2016 — امتیاز ≥ ۲ = خطر بالا</div>';
      h += '<div class="wf-field"><label>RR (تنفس در دقیقه) *</label><input type="number" id="qsRR" placeholder="≥ 22 = ۱ امتیاز" style="font-size:18px;text-align:center"></div>';
      h += '<div class="wf-field"><label>SBP (فشار سیستولیک) *</label><input type="number" id="qsSBP" placeholder="≤ 100 = ۱ امتیاز" style="font-size:18px;text-align:center"></div>';
      h += '<div class="wf-field"><label>GCS (سطح هوشیاری) *</label><input type="number" id="qsGCS" value="15" min="3" max="15" placeholder="< 15 = ۱ امتیاز" style="font-size:18px;text-align:center"></div>';
      h += '<div class="wf-field"><label>لاکتات (mg/dL)</label><input type="number" id="qsLactate" step="0.1" placeholder="اختیاری"></div>';
      h += '<div class="wf-field"><label>منشأ عفونت</label><input type="text" id="qsSource" placeholder="ریه، ادرار، شکم، ..."></div>';
      h += '<div id="qsScoreBox" style="text-align:center;padding:12px;background:var(--bg-3);border-radius:8px;margin:12px 0">';
      h += '<div style="font-size:36px;font-weight:900;color:var(--fg-2)" id="qsScore">0</div>';
      h += '<div style="font-size:11px;color:var(--fg-2)">امتیاز qSOFA</div>';
      h += '</div>';
      h += '<button class="btn btn-dng btn-block" style="padding:14px;font-weight:900" onclick="NABZ.sf._submitSepsis(\'' + patientId + '\')">🦠 ثبت غربالگری</button>';
      var sheet = SF._openSheet(h);
      var updateScore = function() {
        var rr = parseFloat(document.getElementById('qsRR').value) || 0;
        var sbp = parseFloat(document.getElementById('qsSBP').value) || 999;
        var gcs = parseFloat(document.getElementById('qsGCS').value) || 15;
        var score = 0;
        if (rr >= 22) score++;
        if (sbp > 0 && sbp <= 100) score++;
        if (gcs < 15 && gcs > 0) score++;
        var el = document.getElementById('qsScore');
        if (el) {
          el.textContent = score;
          el.style.color = score >= 2 ? 'var(--dng)' : score === 1 ? 'var(--warn)' : 'var(--ok)';
        }
      };
      ['qsRR','qsSBP','qsGCS'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', updateScore);
      });
      updateScore();
    },

    _submitSepsis: async function(patientId) {
      var rr = parseFloat(document.getElementById('qsRR').value);
      var sbp = parseFloat(document.getElementById('qsSBP').value);
      var gcs = parseFloat(document.getElementById('qsGCS').value) || 15;
      if (isNaN(rr) || isNaN(sbp)) return alert('RR و SBP الزامی است');
      var lact = parseFloat(document.getElementById('qsLactate').value);
      try {
        var r = await SF._api('/api/safety/sepsis', {
          method:'POST',
          body: JSON.stringify({
            patientId: patientId,
            vitals: { rr: rr, bp_sys: sbp, gcs: gcs },
            lactate: isNaN(lact) ? null : lact,
            infectionSource: document.getElementById('qsSource').value
          })
        });
        SF._closeAll();
        NABZ._toast(r.qsofa && r.qsofa.score >= 2 ? '🚨 سپسیس مشکوک — ' + r.qsofa.score : '✅ غربالگری ثبت شد');
        SF.viewSepsis(r.id);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    viewSepsis: async function(id) {
      try {
        var d = await SF._api('/api/safety/sepsis');
        var s = (d.items||[]).find(function(x) { return x.id === id; });
        if (!s) return alert('یافت نشد');
        var statusMap = { screening:'در حال غربالگری', suspected:'مشکوک', confirmed:'تأیید شده', ruled_out:'رد شده', septic_shock:'شوک سپتیک' };
        var statusCls = { screening:'info', suspected:'warn', confirmed:'dng', ruled_out:'ok', septic_shock:'dng' };
        var score = s.qsofa ? s.qsofa.score : 0;

        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title" style="color:' + (score >= 2 ? 'var(--dng)' : 'var(--fg)') + '">🦠 ' + SF._esc(s.patientName) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div style="margin-bottom:8px"><span class="pill ' + (statusCls[s.status]||'info') + '">' + (statusMap[s.status]||s.status) + '</span></div>';

        h += '<div class="card" style="margin-bottom:12px;text-align:center;border-color:var(--' + (score >= 2 ? 'dng' : score === 1 ? 'warn' : 'ok') + ')">';
        h += '<div style="font-size:48px;font-weight:900;color:var(--' + (score >= 2 ? 'dng' : score === 1 ? 'warn' : 'ok') + ')">' + score + '</div>';
        h += '<div style="font-size:11px;color:var(--fg-2)">qSOFA Score</div>';
        if (score >= 2) h += '<div style="font-size:12px;color:var(--dng);font-weight:900;margin-top:6px">⚠️ خطر بالا</div>';
        h += '</div>';

        h += '<div class="card" style="margin-bottom:12px">';
        if (s.lactate) h += '<div style="font-size:12px">لاکتات: <b>' + s.lactate + '</b></div>';
        if (s.infectionSource) h += '<div style="font-size:12px">منشأ: ' + SF._esc(s.infectionSource) + '</div>';
        h += '<div style="font-size:12px;color:var(--fg-2);margin-top:4px">' + SF._time(s.screenedAt) + '</div>';
        h += '</div>';

        h += '<div class="sec-hd" style="margin:14px 0 8px"><span>⏱ 3-hour Bundle</span></div>';
        if (s.bundle) {
          var items = [
            ['lactateMeasured', '📊 لاکتات اندازه‌گیری'],
            ['bloodCultures', '🧪 کشت خون ×۲'],
            ['antibiotics', '💊 آنتی‌بیوتیک وسیع‌الطیف'],
            ['fluids', '💧 مایع ۳۰ ml/kg']
          ];
          items.forEach(function(x) {
            var done = s.bundle[x[0]];
            h += '<div class="em-step ' + (done ? 'done' : '') + '">';
            h += '<div class="em-step-ico">' + (done ? '✅' : '⏳') + '</div>';
            h += '<div class="em-step-body"><div class="em-step-name">' + x[1] + '</div></div>';
            h += '</div>';
          });
          if (s.bundle.completedAt) h += '<div class="hint success">✅ Bundle کامل شد</div>';
        }

        h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 20px">';
        if (['suspected', 'screening'].indexOf(s.status) >= 0) {
          h += '<button class="btn btn-primary" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.sf.sepsisDiagnose(\'' + s.id + '\')">🩺 تشخیص</button>';
        }
        h += '<button class="btn btn-dng" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.sf.sepsisBundle(\'' + s.id + '\')">⏱ Bundle</button>';
        h += '<button class="btn" style="flex:1;min-width:100px;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        h += '</div>';
        SF._openSheet(h);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    sepsisDiagnose: function(id) {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">🩺 تشخیص سپسیس</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>نتیجه *</label><select id="sepsisDx" style="font-size:14px;font-weight:900">';
      h += '<option value="confirmed">تأیید سپسیس</option>';
      h += '<option value="septic_shock">شوک سپتیک</option>';
      h += '<option value="ruled_out">رد شده</option>';
      h += '</select></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px" onclick="NABZ.sf._submitSepsisDx(\'' + id + '\')">✅ ثبت</button>';
      SF._closeAll();
      SF._openSheet(h);
    },

    _submitSepsisDx: async function(id) {
      try {
        await SF._api('/api/safety/sepsis/' + id + '/diagnose', {
          method:'POST',
          body: JSON.stringify({ status: document.getElementById('sepsisDx').value })
        });
        NABZ._toast('✅ تشخیص ثبت شد');
        SF._closeAll();
        SF.viewSepsis(id);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    sepsisBundle: function(id) {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">⏱ Sepsis Bundle</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<label class="bb-check-item"><input type="checkbox" id="bnLact" style="width:20px;height:20px"><span>📊 لاکتات</span></label>';
      h += '<label class="bb-check-item"><input type="checkbox" id="bnCult" style="width:20px;height:20px"><span>🧪 کشت خون</span></label>';
      h += '<label class="bb-check-item"><input type="checkbox" id="bnAbx" style="width:20px;height:20px"><span>💊 آنتی‌بیوتیک</span></label>';
      h += '<label class="bb-check-item"><input type="checkbox" id="bnFl" style="width:20px;height:20px"><span>💧 مایع ۳۰ ml/kg</span></label>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.sf._submitBundle(\'' + id + '\')">✅ ثبت</button>';
      SF._closeAll();
      SF._openSheet(h);
    },

    _submitBundle: async function(id) {
      try {
        await SF._api('/api/safety/sepsis/' + id + '/bundle', {
          method:'POST',
          body: JSON.stringify({
            lactate: document.getElementById('bnLact').checked,
            bloodCultures: document.getElementById('bnCult').checked,
            antibiotics: document.getElementById('bnAbx').checked,
            fluids: document.getElementById('bnFl').checked
          })
        });
        NABZ._toast('✅ Bundle به‌روز شد');
        SF._closeAll();
        SF.viewSepsis(id);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    // ═══ INFECTION ═══
    newInfection: async function(patientId) {
      if (!patientId) {
        patientId = await SF._pickPatient('گزارش عفونت');
        if (!patientId) return;
      }
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">🧫 گزارش عفونت</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>نوع عفونت *</label><select id="infType">';
      ['CLABSI','VAP','CAUTI','SSI','باکتریمی','پنومونی'].forEach(function(t) { h += '<option value="' + t + '">' + t + '</option>'; });
      h += '</select></div>';
      h += '<div class="wf-field"><label>پاتوژن</label><input type="text" id="infPathogen" placeholder="مثلاً: Staph aureus"></div>';
      h += '<label class="bb-check-item"><input type="checkbox" id="infCulture" style="width:20px;height:20px"><span>تأیید با کشت</span></label>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.sf._submitInfection(\'' + patientId + '\')">✅ ثبت</button>';
      SF._openSheet(h);
    },

    _submitInfection: async function(patientId) {
      try {
        await SF._api('/api/safety/infections', {
          method:'POST',
          body: JSON.stringify({
            patientId: patientId,
            type: document.getElementById('infType').value,
            pathogen: document.getElementById('infPathogen').value,
            cultureConfirmed: document.getElementById('infCulture').checked
          })
        });
        NABZ._toast('✅ عفونت ثبت شد');
        SF._closeAll();
        NABZ.show('safety.infections');
      } catch(e) { alert('خطا: ' + e.message); }
    },

    // ═══ ISOLATION ═══
    newIsolation: async function(patientId) {
      if (!patientId) {
        patientId = await SF._pickPatient('ایزولاسیون');
        if (!patientId) return;
      }
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">🧼 ایزولاسیون</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>نوع *</label><select id="isoType" style="font-size:14px;font-weight:900">';
      h += '<option value="contact">تماسی</option>';
      h += '<option value="droplet">قطره‌ای</option>';
      h += '<option value="airborne">هوایی</option>';
      h += '<option value="protective">محافظتی</option>';
      h += '</select></div>';
      h += '<div class="wf-field"><label>دلیل</label><input type="text" id="isoReason" placeholder="مثلاً: MRSA مثبت"></div>';
      h += '<label class="bb-check-item"><input type="checkbox" id="isoNeg" style="width:20px;height:20px"><span>اتاق فشار منفی (برای هوایی)</span></label>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.sf._submitIsolation(\'' + patientId + '\')">✅ ثبت</button>';
      SF._openSheet(h);
    },

    _submitIsolation: async function(patientId) {
      try {
        await SF._api('/api/safety/isolations', {
          method:'POST',
          body: JSON.stringify({
            patientId: patientId,
            type: document.getElementById('isoType').value,
            reason: document.getElementById('isoReason').value,
            negativePressureVerified: document.getElementById('isoNeg').checked
          })
        });
        NABZ._toast('✅ ایزولاسیون فعال شد');
        SF._closeAll();
        NABZ.show('safety.isolations');
      } catch(e) { alert('خطا: ' + e.message); }
    },

    // ═══ INCIDENT ═══
    newIncident: function() {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">⚠️ گزارش حادثه</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>دسته *</label><select id="incCat">';
      h += '<option value="medication">دارویی</option>';
      h += '<option value="fall">سقوط</option>';
      h += '<option value="equipment">تجهیزات</option>';
      h += '<option value="infection">عفونت</option>';
      h += '<option value="procedure">پروسیجر</option>';
      h += '<option value="blood">خون</option>';
      h += '</select></div>';
      h += '<div class="wf-field"><label>شدت *</label><select id="incSev" style="font-size:14px;font-weight:900">';
      h += '<option value="near_miss">Near Miss (بدون آسیب)</option>';
      h += '<option value="no_harm">بدون آسیب</option>';
      h += '<option value="mild_harm">آسیب خفیف</option>';
      h += '<option value="moderate_harm">آسیب متوسط</option>';
      h += '<option value="severe_harm">آسیب شدید</option>';
      h += '<option value="sentinel">Sentinel Event</option>';
      h += '</select></div>';
      h += '<div class="wf-field"><label>شرح *</label><textarea id="incDesc" rows="3" placeholder="چه اتفاقی افتاد؟"></textarea></div>';
      h += '<div class="wf-field"><label>اقدام فوری</label><textarea id="incAction" rows="2"></textarea></div>';
      h += '<button class="btn btn-dng btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.sf._submitIncident()">✅ ثبت</button>';
      SF._openSheet(h);
    },

    _submitIncident: async function() {
      var desc = document.getElementById('incDesc').value.trim();
      if (!desc) return alert('شرح الزامی است');
      try {
        await SF._api('/api/safety/incidents', {
          method:'POST',
          body: JSON.stringify({
            category: document.getElementById('incCat').value,
            severity: document.getElementById('incSev').value,
            description: desc,
            immediateAction: document.getElementById('incAction').value
          })
        });
        NABZ._toast('✅ حادثه ثبت شد');
        SF._closeAll();
        NABZ.show('safety.incidents');
      } catch(e) { alert('خطا: ' + e.message); }
    },

    // ═══ RISK ═══
    newRisk: function() {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">⚠️ ثبت ریسک</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>عنوان *</label><input type="text" id="riskTitle" placeholder="مثلاً: خطر سقوط در سالمندان"></div>';
      h += '<div class="wf-field"><label>دسته</label><select id="riskCat">';
      h += '<option value="clinical">بالینی</option>';
      h += '<option value="equipment">تجهیزات</option>';
      h += '<option value="environment">محیطی</option>';
      h += '<option value="process">فرآیندی</option>';
      h += '</select></div>';
      h += '<div class="wf-field"><label>احتمال (1-5)</label><input type="number" id="riskL" value="3" min="1" max="5" style="text-align:center;font-size:18px"></div>';
      h += '<div class="wf-field"><label>شدت (1-5)</label><input type="number" id="riskS" value="3" min="1" max="5" style="text-align:center;font-size:18px"></div>';
      h += '<div id="riskScoreBox" style="text-align:center;padding:12px;background:var(--bg-3);border-radius:8px;margin:12px 0">';
      h += '<div style="font-size:28px;font-weight:900" id="riskScore">9</div>';
      h += '<div style="font-size:11px;color:var(--fg-2)">Risk Score</div>';
      h += '</div>';
      h += '<button class="btn btn-dng btn-block" style="padding:14px;font-weight:900" onclick="NABZ.sf._submitRisk()">✅ ثبت</button>';
      var sheet = SF._openSheet(h);
      var update = function() {
        var l = parseInt(document.getElementById('riskL').value) || 3;
        var s = parseInt(document.getElementById('riskS').value) || 3;
        var sc = l * s;
        var el = document.getElementById('riskScore');
        if (el) { el.textContent = sc; el.style.color = sc >= 15 ? 'var(--dng)' : sc >= 9 ? 'var(--warn)' : 'var(--ok)'; }
      };
      document.getElementById('riskL').addEventListener('input', update);
      document.getElementById('riskS').addEventListener('input', update);
      update();
    },

    _submitRisk: async function() {
      var t = document.getElementById('riskTitle').value.trim();
      if (!t) return alert('عنوان الزامی است');
      try {
        await SF._api('/api/safety/risks', {
          method:'POST',
          body: JSON.stringify({
            title: t,
            category: document.getElementById('riskCat').value,
            likelihood: parseInt(document.getElementById('riskL').value),
            severity: parseInt(document.getElementById('riskS').value)
          })
        });
        NABZ._toast('✅ ریسک ثبت شد');
        SF._closeAll();
        NABZ.show('safety.risks');
      } catch(e) { alert('خطا: ' + e.message); }
    },

    patientButtons: function(patientId) {
      return '<div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
        '<button class="btn" style="background:var(--dng-soft);color:var(--dng);border-color:var(--dng);padding:10px;font-size:11px" onclick="NABZ.sf.sepsisScreen(\'' + patientId + '\')">🦠 سپسیس</button>' +
        '<button class="btn" style="background:var(--warn-soft);color:var(--warn);border-color:var(--warn);padding:10px;font-size:11px" onclick="NABZ.sf.newInfection(\'' + patientId + '\')">🧫 عفونت</button>' +
        '<button class="btn" style="background:var(--info-soft);color:var(--info);border-color:var(--info);padding:10px;font-size:11px" onclick="NABZ.sf.newIsolation(\'' + patientId + '\')">🧼 ایزوله</button>' +
        '</div>';
    }
  };

  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 50) return console.warn('[sf-ui] timeout');
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.sf = SF;
    var prevShowItem = NABZ.showItem;
    NABZ.showItem = function(pid, iid) {
      if (pid === 'safety.sepsis') return SF.viewSepsis(iid);
      return prevShowItem.apply(NABZ, arguments);
    };
    var prevDocBtns = NABZ._docButtonsFor;
    NABZ._docButtonsFor = function(pid, item) {
      var orig = prevDocBtns.apply(NABZ, arguments) || '';
      if (pid === 'clinical.patients' && item && item.id) return orig + SF.patientButtons(item.id);
      return orig;
    };
    // FABs
    var FABS = {
      'safety.sepsis': { label:'🦠 غربالگری', fn:function() { SF.sepsisScreen(); } },
      'safety.infections': { label:'🧫 عفونت', fn:function() { SF.newInfection(); } },
      'safety.isolations': { label:'🧼 ایزوله', fn:function() { SF.newIsolation(); } },
      'safety.incidents': { label:'⚠️ حادثه', fn:function() { SF.newIncident(); } },
      'safety.risks': { label:'⚠️ ریسک', fn:function() { SF.newRisk(); } }
    };
    var fab = document.createElement('button');
    fab.id = 'sfFab';
    fab.style.cssText = 'position:fixed;bottom:calc(var(--nav-h,72px) + 20px);left:20px;padding:14px 20px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border:none;border-radius:30px;font-family:inherit;font-size:13px;font-weight:900;box-shadow:0 4px 20px rgba(239,68,68,0.5);cursor:pointer;z-index:49;display:none;align-items:center;gap:6px';
    document.body.appendChild(fab);
    function update() {
      if (!NABZ.state) return;
      var cfg = FABS[NABZ.state.current];
      if (!cfg || document.querySelector('.bs-backdrop')) { fab.style.display = 'none'; return; }
      fab.style.display = 'flex';
      fab.textContent = cfg.label;
      fab.onclick = cfg.fn;
    }
    var content = document.getElementById('content');
    if (content) new MutationObserver(update).observe(content, { childList:true, subtree:false });
    setInterval(update, 500);
    console.log('[sf-ui] loaded');
  });
})();
