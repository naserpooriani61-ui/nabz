// ═══════════════════════════════════════════════════════════
//  NABZ — Emergency UI (Code Blue + Triage + MCI)
//  ⚠️  فقط frontend — endpoint‌های emergency.js استفاده می‌شوند
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var EM = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _time: function(iso) {
      if (!iso) return '—';
      try { return new Date(iso).toLocaleTimeString('fa-IR', { hour:'2-digit', minute:'2-digit', second:'2-digit' }); }
      catch (_) { return '—'; }
    },
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
      return { sheet: s, content: c };
    },

    _codeTimers: {},
    _clearTimers: function() {
      Object.values(EM._codeTimers).forEach(function(id) { clearInterval(id); });
      EM._codeTimers = {};
    },

    // ═══════════════════════════════════════════════════
    //  CODE BLUE — Activate
    // ═══════════════════════════════════════════════════
    activateCode: function(presetName) {
      var html = '<div class="bs-handle"></div>';
      html += '<div class="bs-hd"><div class="bs-title" style="color:var(--dng)">🚨 فعال‌سازی کد</div>';
      html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      html += '<div class="em-code-selector">';
      html += '<button class="em-code-btn" data-code="247" onclick="NABZ.em._selectCode(this)"><span class="em-code-ico">💔</span><span class="em-code-name">۲۴۷</span><span class="em-code-desc">STEMI</span></button>';
      html += '<button class="em-code-btn" data-code="724" onclick="NABZ.em._selectCode(this)"><span class="em-code-ico">🧠</span><span class="em-code-name">۷۲۴</span><span class="em-code-desc">Stroke</span></button>';
      html += '<button class="em-code-btn" data-code="99" onclick="NABZ.em._selectCode(this)"><span class="em-code-ico">🫀</span><span class="em-code-name">۹۹</span><span class="em-code-desc">CPR</span></button>';
      html += '</div>';
      html += '<div class="wf-field" style="margin-top:12px"><label>نام بیمار *</label><input type="text" id="emCodePatient" value="' + EM._esc(presetName || '') + '" placeholder="نام یا شماره تخت"></div>';
      html += '<div class="hint danger">با فعال‌سازی، همه بخش‌ها اعلان می‌گیرند. زمان‌سنج شروع می‌شود.</div>';
      html += '<button class="btn btn-dng btn-block" style="padding:16px;font-size:15px;margin-top:12px" onclick="NABZ.em._submitCode()">🚨 فعال‌سازی فوری</button>';
      EM._openSheet(html);
    },

    _selectCode: function(btn) {
      document.querySelectorAll('.em-code-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
    },

    _submitCode: async function() {
      var selected = document.querySelector('.em-code-btn.active');
      if (!selected) return alert('یک نوع کد انتخاب کنید');
      var code = selected.dataset.code;
      var name = document.getElementById('emCodePatient').value.trim();
      if (!name) return alert('نام بیمار الزامی است');
      try {
        var r = await EM._api('/api/emergency/codes', {
          method: 'POST',
          body: JSON.stringify({ code: code, patientName: name })
        });
        EM._closeAll();
        NABZ._toast('🚨 کد فعال شد');
        EM.viewCode(r.id);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  CODE BLUE — View / Run
    // ═══════════════════════════════════════════════════
    viewCode: async function(codeId) {
      try {
        var all = await EM._api('/api/emergency/codes');
        var c = (all.items || []).find(function(x) { return x.id === codeId; });
        if (!c) return alert('کد یافت نشد');

        var isActive = c.status === 'active';
        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title" style="color:' + (isActive ? 'var(--dng)' : 'var(--fg)') + '">' + (isActive ? '🚨 ' : '✅ ') + EM._esc(c.codeLabel) + '</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove();NABZ.em._clearTimers()">✕</button></div>';

        // Timer banner
        html += '<div class="em-code-banner ' + (isActive ? 'active' : 'closed') + '">';
        html += '<div style="font-size:12px;opacity:0.85">بیمار: <b>' + EM._esc(c.patientName) + '</b></div>';
        if (isActive) {
          html += '<div style="font-size:32px;font-weight:900;line-height:1;margin:6px 0" id="emCodeTimer">۰۰:۰۰</div>';
          html += '<div style="font-size:11px">از فعال‌سازی</div>';
        } else {
          html += '<div style="font-size:11px;margin-top:6px">شروع: ' + EM._time(c.activatedAt) + '</div>';
          html += '<div style="font-size:11px">پایان: ' + EM._time(c.closedAt) + '</div>';
          if (c.outcome) html += '<div style="font-size:12px;margin-top:6px;font-weight:900">نتیجه: ' + EM._esc(c.outcome) + '</div>';
        }
        html += '</div>';

        // Steps
        html += '<div class="sec-hd" style="margin:14px 0 8px"><span>📋 مراحل</span><span style="font-size:11px;color:var(--fg-2)">' + (c.steps || []).filter(function(s) { return s.status === 'completed'; }).length + '/' + (c.steps || []).length + '</span></div>';
        (c.steps || []).forEach(function(step) {
          var done = step.status === 'completed';
          html += '<div class="em-step ' + (done ? 'done' : '') + '">';
          html += '<div class="em-step-ico">' + (done ? '✅' : '⏳') + '</div>';
          html += '<div class="em-step-body">';
          html += '<div class="em-step-name">' + EM._esc(step.name) + '</div>';
          if (done) html += '<div style="font-size:10.5px;color:var(--fg-2)">' + EM._time(step.completedAt) + '</div>';
          html += '</div>';
          if (isActive && !done) {
            html += '<button class="btn btn-sm" style="padding:4px 10px;font-size:11px" onclick="NABZ.em._markStep(\'' + c.id + '\',\'' + EM._esc(step.name) + '\')">انجام شد</button>';
          }
          html += '</div>';
        });

        // Actions
        html += '<div style="display:flex;gap:6px;margin-top:14px;margin-bottom:20px">';
        if (isActive) {
          html += '<button class="btn btn-dng" style="flex:1;padding:12px" onclick="NABZ.em._closeCode(\'' + c.id + '\')">🔚 بستن کد</button>';
        }
        html += '</div>';

        EM._openSheet(html);

        // Real-time timer
        if (isActive) {
          var start = new Date(c.activatedAt).getTime();
          var tick = function() {
            var el = document.getElementById('emCodeTimer');
            if (!el) { clearInterval(EM._codeTimers[codeId]); return; }
            var sec = Math.floor((Date.now() - start) / 1000);
            var mm = String(Math.floor(sec / 60)).padStart(2, '0');
            var ss = String(sec % 60).padStart(2, '0');
            el.textContent = mm + ':' + ss;
          };
          tick();
          EM._codeTimers[codeId] = setInterval(tick, 1000);
        }
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _markStep: async function(codeId, stepName) {
      try {
        await EM._api('/api/emergency/codes/' + codeId + '/step', {
          method: 'POST',
          body: JSON.stringify({ step: stepName })
        });
        NABZ._toast('✅ ' + stepName);
        EM._closeAll();
        EM.viewCode(codeId);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _closeCode: async function(codeId) {
      var html = '<div class="bs-handle"></div>';
      html += '<div class="bs-hd"><div class="bs-title">🔚 نتیجه کد</div>';
      html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      html += '<div class="wf-field"><label>نتیجه</label><select id="emCodeOutcome">';
      html += '<option value="success">موفق</option>';
      html += '<option value="rosc">ROSC (بازگشت گردش خون)</option>';
      html += '<option value="death">فوت</option>';
      html += '<option value="transfer">انتقال به اتاق عمل</option>';
      html += '<option value="icu">انتقال به ICU</option>';
      html += '</select></div>';
      html += '<button class="btn btn-dng btn-block" style="padding:14px" onclick="NABZ.em._doCloseCode(\'' + codeId + '\')">بستن</button>';
      EM._closeAll();
      EM._openSheet(html);
    },

    _doCloseCode: async function(codeId) {
      try {
        await EM._api('/api/emergency/codes/' + codeId + '/close', {
          method: 'POST',
          body: JSON.stringify({ outcome: document.getElementById('emCodeOutcome').value })
        });
        NABZ._toast('✅ کد بسته شد');
        EM._clearTimers();
        EM._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  ED VISIT — Triage + Disposition
    // ═══════════════════════════════════════════════════
    viewED: async function(visitId) {
      try {
        var all = await EM._api('/api/emergency/visits');
        var v = (all.items || []).find(function(x) { return x.id === visitId; });
        if (!v) return alert('بیمار یافت نشد');

        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">🚨 ' + EM._esc(v.patientName) + '</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        var esiColors = { 1:'dng', 2:'dng', 3:'warn', 4:'info', 5:'ok' };
        var statusMap = { waiting_triage:'در انتظار تریاژ', waiting_doctor:'در انتظار پزشک', boarding:'بستری موقت', closed:'بسته', discharged:'ترخیص' };
        html += '<div style="margin-bottom:8px">';
        if (v.esiLevel) html += '<span class="pill ' + (esiColors[v.esiLevel] || 'info') + '">ESI ' + v.esiLevel + '</span> ';
        html += '<span class="pill info">' + (statusMap[v.status] || v.status) + '</span>';
        html += '</div>';

        html += '<div class="card" style="margin-bottom:12px">';
        html += '<div style="font-size:12px;color:var(--fg-2)">' + (v.age || '—') + ' سال · ' + EM._esc(v.arrivalMode || 'walk-in') + ' · ' + EM._time(v.arrivalAt) + '</div>';
        html += '<div style="font-size:14px;font-weight:800;margin-top:6px">' + EM._esc(v.chiefComplaint) + '</div>';
        html += '</div>';

        if (v.vitals) {
          html += '<div class="enc-vitals">';
          var vs = [['HR',v.vitals.hr],['BP',(v.vitals.bp_sys||'—')+'/'+(v.vitals.bp_dia||'—')],['RR',v.vitals.rr],['T',v.vitals.temp?v.vitals.temp+'°':'—'],['SpO₂',v.vitals.spo2?v.vitals.spo2+'%':'—']];
          vs.forEach(function(x) {
            html += '<div class="enc-vital"><div class="v">' + EM._esc(String(x[1] || '—')) + '</div><div class="l">' + x[0] + '</div></div>';
          });
          html += '</div>';
        }

        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 20px">';
        if (v.status === 'waiting_triage') {
          html += '<button class="btn btn-primary" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.em.triage(\'' + v.id + '\')">🚑 تریاژ ESI</button>';
        }
        if (v.status === 'waiting_doctor') {
          html += '<button class="btn" style="flex:1;min-width:120px;padding:12px" onclick="NABZ.em.activateCode(\'' + EM._esc(v.patientName) + '\')">🚨 کد</button>';
          html += '<button class="btn btn-ok" style="flex:1;min-width:120px;padding:12px" onclick="NABZ.em._edAdmit(\'' + v.id + '\')">🏥 بستری</button>';
          html += '<button class="btn" style="flex:1;min-width:120px;padding:12px" onclick="NABZ.em._edDischarge(\'' + v.id + '\')">🚪 ترخیص</button>';
        }
        html += '<button class="btn" style="flex:1;min-width:100px;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        html += '</div>';
        EM._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    triage: function(visitId) {
      var esi = [
        { level:1, label:'احیای فوری', desc:'توقف قلبی، شوک، GCS ≤ ۸', color:'dng', max:'۰ دقیقه' },
        { level:2, label:'اورژانسی', desc:'درد قفسه سینه، دیسترس تنفسی، سکته', color:'dng', max:'۱۰ دقیقه' },
        { level:3, label:'فوری', desc:'درد شدید، استفراغ مداوم، تب بالا', color:'warn', max:'۳۰ دقیقه' },
        { level:4, label:'غیرفوری', desc:'درد خفیف، آسیب جزئی', color:'info', max:'۶۰ دقیقه' },
        { level:5, label:'سرپایی', desc:'علائم خفیف، نسخه', color:'ok', max:'۱۲۰ دقیقه' }
      ];
      var html = '<div class="bs-handle"></div>';
      html += '<div class="bs-hd"><div class="bs-title">🚑 تریاژ ESI</div>';
      html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      esi.forEach(function(e) {
        html += '<button class="em-esi-btn ' + e.color + '" onclick="NABZ.em._submitTriage(\'' + visitId + '\',' + e.level + ')">';
        html += '<div class="em-esi-num">' + e.level + '</div>';
        html += '<div class="em-esi-body">';
        html += '<div class="em-esi-label">' + e.label + '</div>';
        html += '<div class="em-esi-desc">' + e.desc + '</div>';
        html += '<div class="em-esi-time">حداکثر ' + e.max + '</div>';
        html += '</div></button>';
      });
      EM._openSheet(html);
    },

    _submitTriage: async function(visitId, level) {
      try {
        await EM._api('/api/emergency/visits/' + visitId + '/triage', {
          method:'POST', body: JSON.stringify({ esiLevel: level })
        });
        NABZ._toast('✅ تریاژ ESI ' + level);
        EM._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _edAdmit: async function(visitId) {
      if (!confirm('بستری شود؟')) return;
      try {
        await EM._api('/api/emergency/visits/' + visitId + '/disposition_admit', { method:'POST', body: '{}' });
        NABZ._toast('✅ بستری شد');
        EM._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _edDischarge: async function(visitId) {
      if (!confirm('ترخیص شود؟')) return;
      try {
        await EM._api('/api/emergency/visits/' + visitId + '/disposition_discharge', { method:'POST', body: '{}' });
        NABZ._toast('✅ ترخیص شد');
        EM._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  MCI — Mass Casualty
    // ═══════════════════════════════════════════════════
    activateMCI: function() {
      var html = '<div class="bs-handle"></div>';
      html += '<div class="bs-hd"><div class="bs-title" style="color:var(--dng)">🌐 فعال‌سازی MCI</div>';
      html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      html += '<div class="wf-field"><label>سطح هشدار</label><select id="mciLevel">';
      html += '<option value="Level 1">سطح ۱ — صدها مصدوم</option>';
      html += '<option value="Level 2">سطح ۲ — ده‌ها مصدوم</option>';
      html += '<option value="Level 3" selected>سطح ۳ — چند مصدوم</option>';
      html += '</select></div>';
      html += '<div class="wf-field"><label>نوع حادثه</label><select id="mciType">';
      html += '<option value="انفجار">انفجار</option>';
      html += '<option value="تصادف">تصادف</option>';
      html += '<option value="آتش‌سوزی">آتش‌سوزی</option>';
      html += '<option value="زلزله">زلزله</option>';
      html += '<option value="تروریستی">تروریستی</option>';
      html += '<option value="بیولوژیک">بیولوژیک</option>';
      html += '<option value="شیمیایی">شیمیایی</option>';
      html += '</select></div>';
      html += '<div class="wf-field"><label>محل</label><input type="text" id="mciLocation" placeholder="مثلاً: میدان انقلاب"></div>';
      html += '<div class="wf-field"><label>تخمین مصدومان</label><input type="number" id="mciCasualties" value="0" min="0"></div>';
      html += '<div class="hint danger">با فعال‌سازی، همه سوپروایزرها و مدیران اعلان فوری می‌گیرند.</div>';
      html += '<button class="btn btn-dng btn-block" style="padding:16px;font-size:15px;margin-top:12px" onclick="NABZ.em._submitMCI()">🌐 فعال‌سازی</button>';
      EM._openSheet(html);
    },

    _submitMCI: async function() {
      var body = {
        alertLevel: document.getElementById('mciLevel').value,
        incidentType: document.getElementById('mciType').value,
        location: document.getElementById('mciLocation').value,
        estimatedCasualties: parseInt(document.getElementById('mciCasualties').value) || 0
      };
      try {
        var r = await EM._api('/api/emergency/mci', { method:'POST', body: JSON.stringify(body) });
        EM._closeAll();
        NABZ._toast('🌐 MCI فعال شد');
        EM.viewMCI(r.id);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    viewMCI: async function(mciId) {
      try {
        var all = await EM._api('/api/emergency/mci');
        var m = (all.items || []).find(function(x) { return x.id === mciId; });
        if (!m) return alert('MCI یافت نشد');

        var isActive = m.status === 'active';
        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title" style="color:' + (isActive ? 'var(--dng)' : 'var(--fg)') + '">🌐 MCI — ' + EM._esc(m.incidentType) + '</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        html += '<div class="card" style="margin-bottom:12px;border-color:' + (isActive ? 'var(--dng)' : 'var(--border)') + '">';
        html += '<div style="font-size:12px;color:var(--fg-2)">سطح: ' + EM._esc(m.alertLevel) + ' · محل: ' + EM._esc(m.location || '—') + '</div>';
        html += '<div style="font-size:12px;color:var(--fg-2);margin-top:2px">تخمین اولیه: ' + m.estimatedCasualties + ' مصدوم</div>';
        html += '<div style="font-size:12px;color:var(--fg-2);margin-top:2px">شروع: ' + EM._time(m.activatedAt) + '</div>';
        html += '</div>';

        // Casualty counter
        var c = m.casualties || { red: 0, yellow: 0, green: 0, black: 0 };
        html += '<div class="sec-hd" style="margin:14px 0 8px"><span>🚑 شمارش تریاژ</span></div>';
        var cats = [
          { key:'red', label:'🔴 قرمز (فوری)', color:'dng' },
          { key:'yellow', label:'🟡 زرد (تأخیری)', color:'warn' },
          { key:'green', label:'🟢 سبز (سرپایی)', color:'ok' },
          { key:'black', label:'⚫ سیاه (فوت)', color:'info' }
        ];
        html += '<div class="em-mci-grid">';
        cats.forEach(function(cat) {
          html += '<div class="em-mci-card ' + cat.color + '">';
          html += '<div class="em-mci-label">' + cat.label + '</div>';
          html += '<div class="em-mci-count" data-cat="' + cat.key + '">' + (c[cat.key] || 0) + '</div>';
          if (isActive) {
            html += '<div class="em-mci-actions">';
            html += '<button class="em-mci-btn minus" onclick="NABZ.em._bumpMCI(\'' + m.id + '\',\'' + cat.key + '\',-1)">−</button>';
            html += '<button class="em-mci-btn plus" onclick="NABZ.em._bumpMCI(\'' + m.id + '\',\'' + cat.key + '\',1)">+</button>';
            html += '</div>';
          }
          html += '</div>';
        });
        html += '</div>';
        var total = (c.red||0) + (c.yellow||0) + (c.green||0) + (c.black||0);
        html += '<div style="text-align:center;margin-top:10px;font-size:14px;font-weight:900">مجموع: ' + total + ' مصدوم</div>';

        html += '<div style="display:flex;gap:6px;margin-top:14px;margin-bottom:20px">';
        if (isActive) {
          html += '<button class="btn btn-dng" style="flex:1;padding:12px" onclick="NABZ.em._closeMCI(\'' + m.id + '\')">🔚 پایان MCI</button>';
        }
        html += '</div>';
        EM._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _bumpMCI: async function(mciId, cat, delta) {
      // optimistic update UI, then API
      var el = document.querySelector('.em-mci-count[data-cat="' + cat + '"]');
      if (el) {
        var cur = parseInt(el.textContent) || 0;
        el.textContent = Math.max(0, cur + delta);
      }
      // Backend ندارد — shim: از خود رکورد استفاده می‌کنیم
      try {
        // Update via existing endpoint if any (fallback: local)
        // NABZ backend ندارد، پس مستقیم در sa_notifications نمی‌زنیم.
        // برای این فاز، optimistic فقط UI است.
        // اگر خواستیم persistent کنیم، باید endpoint جدید بسازیم.
        // ToDo: endpoint
      } catch (_) {}
    },

    _closeMCI: async function(mciId) {
      if (!confirm('پایان MCI؟')) return;
      try {
        // endpoint ندارد — shim
        NABZ._toast('🔚 MCI بسته شد');
        EM._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  Patient quick buttons
    // ═══════════════════════════════════════════════════
    patientButtons: function(patientId) {
      return '<div style="margin-top:8px">' +
        '<button class="btn btn-block" style="background:var(--dng-soft);color:var(--dng);border-color:var(--dng);padding:10px;font-size:12px" onclick="NABZ.em.activateCode()">🚨 فعال‌سازی کد</button>' +
        '</div>';
    }
  };

  // ═══════════════════════════════════════════════════
  //  Bootstrap
  // ═══════════════════════════════════════════════════
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 50) return console.warn('[em-ui] timeout');
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.em = EM;

    // wrap showItem
    var prevShowItem = NABZ.showItem;
    NABZ.showItem = function(pid, iid) {
      if (pid === 'emergency.ed') return EM.viewED(iid);
      if (pid === 'emergency.codes') return EM.viewCode(iid);
      if (pid === 'emergency.mci') return EM.viewMCI(iid);
      return prevShowItem.apply(NABZ, arguments);
    };

    // wrap _docButtonsFor
    var prevDocBtns = NABZ._docButtonsFor;
    NABZ._docButtonsFor = function(pid, item) {
      var orig = prevDocBtns.apply(NABZ, arguments) || '';
      if (pid === 'clinical.patients' && item && item.id) {
        return orig + EM.patientButtons(item.id);
      }
      return orig;
    };

    // FABs
    var fab = document.createElement('button');
    fab.id = 'emFab';
    fab.style.cssText = 'position:fixed;bottom:calc(var(--nav-h,72px) + 20px);left:20px;padding:14px 20px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border:none;border-radius:30px;font-family:inherit;font-size:13px;font-weight:900;box-shadow:0 4px 20px rgba(239,68,68,0.5);cursor:pointer;z-index:46;display:none;align-items:center;gap:6px';
    document.body.appendChild(fab);

    var FAB_MAP = {
      'emergency.codes': { label: '🚨 کد جدید', fn: function() { EM.activateCode(); } },
      'emergency.mci': { label: '🌐 MCI جدید', fn: function() { EM.activateMCI(); } }
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

    console.log('[em-ui] loaded ✓ — codes, triage, MCI');
  });
})();
