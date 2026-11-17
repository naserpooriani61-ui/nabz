// ═══════════════════════════════════════════════════════════
//  NABZ — Admission Wizard
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var W = {
    step: 1,
    patient: { firstName:'', lastName:'', nationalId:'', age:'', sex:'male', mrn:'' },
    selectedBed: null,
    wards: [],
    beds: [],

    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },

    start: async function() {
      W.step = 1;
      W.patient = { firstName:'', lastName:'', nationalId:'', age:'', sex:'male', mrn:'' };
      W.selectedBed = null;
      W.beds = [];
      try {
        var w = await W._api('/api/bedboard/wards');
        W.wards = (w.items || []).filter(function(x) { return x.available > 0; });
        if (!W.wards.length) return alert('هیچ تختی آزاد نیست');
      } catch (e) { return alert('خطا: ' + e.message); }
      W.render();
    },

    render: function() {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">👤 پذیرش بیمار</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      // Steps indicator
      var steps = ['مشخصات','تخت','بالینی','تأیید'];
      h += '<div class="adm-steps">';
      steps.forEach(function(lbl, i) {
        var num = i + 1;
        var cls = num < W.step ? 'done' : num === W.step ? 'active' : '';
        h += '<div class="adm-step ' + cls + '">';
        h += '<div class="adm-step-num">' + (num < W.step ? '✓' : num) + '</div>';
        h += '</div>';
      });
      h += '</div>';
      h += '<div style="text-align:center;font-size:12px;font-weight:900;color:var(--primary);margin-bottom:14px">مرحله ' + W.step + ' از 4: ' + steps[W.step-1] + '</div>';

      // Body
      if (W.step === 1) h += W.renderStep1();
      else if (W.step === 2) h += W.renderStep2();
      else if (W.step === 3) h += W.renderStep3();
      else if (W.step === 4) h += W.renderStep4();

      // Nav
      h += '<div class="adm-nav">';
      if (W.step > 1) h += '<button class="btn" onclick="NABZ.adm.prev()">← قبلی</button>';
      if (W.step < 4) h += '<button class="btn btn-primary" onclick="NABZ.adm.next()">بعدی →</button>';
      else h += '<button class="btn btn-ok" style="font-weight:900" onclick="NABZ.adm.submit()">✅ ثبت پذیرش</button>';
      h += '</div>';

      var sheet = document.querySelector('.bs-backdrop');
      if (sheet) sheet.remove();
      var s = document.createElement('div');
      s.className = 'bs-backdrop';
      s.onclick = function(e) { if (e.target === s) s.remove(); };
      var c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '95vh';
      c.innerHTML = h;
      s.appendChild(c);
      document.body.appendChild(s);
      requestAnimationFrame(function() { s.classList.add('show'); });
    },

    renderStep1: function() {
      var p = W.patient;
      var h = '<div class="bs-form">';
      h += '<div class="adm-row-2">';
      h += '<div class="bs-field"><label>نام *</label><input id="admFirst" value="' + W._esc(p.firstName) + '" required></div>';
      h += '<div class="bs-field"><label>نام خانوادگی *</label><input id="admLast" value="' + W._esc(p.lastName) + '" required></div>';
      h += '</div>';
      h += '<div class="adm-row-2">';
      h += '<div class="bs-field"><label>کد ملی</label><input id="admNID" value="' + W._esc(p.nationalId) + '"></div>';
      h += '<div class="bs-field"><label>MRN (اختیاری)</label><input id="admMRN" value="' + W._esc(p.mrn) + '" placeholder="خودکار"></div>';
      h += '</div>';
      h += '<div class="adm-row-2">';
      h += '<div class="bs-field"><label>سن *</label><input type="number" id="admAge" value="' + (p.age || '') + '" min="0" max="130" required></div>';
      h += '<div class="bs-field"><label>جنسیت *</label><select id="admSex">';
      h += '<option value="male"' + (p.sex === 'male' ? ' selected' : '') + '>مرد</option>';
      h += '<option value="female"' + (p.sex === 'female' ? ' selected' : '') + '>زن</option>';
      h += '</select></div>';
      h += '</div>';
      h += '</div>';
      return h;
    },

    renderStep2: function() {
      var h = '';
      // Group by ward group
      var groups = {};
      W.wards.forEach(function(w) {
        if (!groups[w.group]) groups[w.group] = [];
        groups[w.group].push(w);
      });
      var GL = { critical:'💔 ویژه', surgical:'🔪 جراحی', internal:'🏥 داخلی', neuro:'🧠 نورو', emergency:'🚨 اورژانس', special:'✨ ویژه', vip:'⭐ VIP', admin:'🏛' };

      if (W.selectedBed) {
        h += '<div class="card" style="border-color:var(--primary);background:var(--primary-soft);margin-bottom:12px">';
        h += '<div style="font-weight:900">✅ تخت انتخابی</div>';
        h += '<div style="font-size:12px;color:var(--fg-2);margin-top:2px">' + W._esc(W.selectedBed.wardLabel || '') + ' · ' + W._esc(W.selectedBed.bedNumber) + '</div>';
        h += '<button class="btn btn-sm" style="margin-top:6px;padding:4px 10px;font-size:11px" onclick="NABZ.adm.clearBed()">تغییر</button>';
        h += '</div>';
      } else {
        h += '<div style="font-size:11px;color:var(--fg-2);margin-bottom:10px">یک بخش انتخاب کنید</div>';
        Object.keys(groups).forEach(function(grp) {
          h += '<div class="adm-group-hd">' + (GL[grp] || grp) + '</div>';
          groups[grp].forEach(function(w) {
            h += '<button class="adm-ward" onclick="NABZ.adm.pickWard(\'' + w.code + '\',\'' + W._esc(w.label) + '\')">';
            h += '<div style="flex:1"><div style="font-weight:900;font-size:13px">' + W._esc(w.label) + '</div>';
            h += '<div style="font-size:11px;color:var(--fg-2)">' + (w.headNurse || '—') + '</div></div>';
            h += '<span class="pill ok" style="margin-left:8px">' + w.available + ' آزاد</span>';
            h += '</button>';
          });
        });
      }
      return h;
    },

    renderStep3: function() {
      var h = '<div class="bs-form">';
      h += '<div class="bs-field"><label>تشخیص اصلی</label><textarea id="admDx" rows="2" placeholder="مثلاً: پنومونی اکتسابی جامعه"></textarea></div>';
      h += '<div class="bs-field"><label>بیماری‌های همراه (با کاما)</label><input id="admComorb" placeholder="HTN، DM، CKD"></div>';
      h += '<div class="bs-field"><label>آلرژی‌ها (با کاما)</label><input id="admAller" placeholder="Penicillin، Sulfa"></div>';
      h += '<div class="adm-row-2">';
      h += '<div class="bs-field"><label>وضعیت کد</label><select id="admCode">';
      h += '<option value="full">Full Code</option>';
      h += '<option value="dnr">DNR</option>';
      h += '<option value="dni">DNI</option>';
      h += '</select></div>';
      h += '<div class="bs-field"><label>نوع پذیرش</label><select id="admType">';
      h += '<option value="elective">انتخابی</option>';
      h += '<option value="emergency">اورژانسی</option>';
      h += '<option value="transfer">انتقالی</option>';
      h += '</select></div>';
      h += '</div>';
      h += '</div>';
      return h;
    },

    renderStep4: function() {
      var p = W.patient;
      var b = W.selectedBed;
      var h = '<div class="card" style="margin-bottom:12px">';
      h += '<div class="card-title">👤 بیمار</div>';
      h += '<div style="font-size:13px;font-weight:900">' + W._esc(p.firstName + ' ' + p.lastName) + '</div>';
      h += '<div style="font-size:12px;color:var(--fg-2);margin-top:2px">' + (p.age || '—') + ' سال · ' + (p.sex === 'female' ? 'زن' : 'مرد') + '</div>';
      if (p.nationalId) h += '<div style="font-size:12px;color:var(--fg-2)">کد ملی: ' + W._esc(p.nationalId) + '</div>';
      h += '</div>';
      h += '<div class="card" style="margin-bottom:12px">';
      h += '<div class="card-title">🛏️ تخت</div>';
      h += '<div style="font-size:13px;font-weight:900">' + W._esc(b.bedNumber) + '</div>';
      h += '<div style="font-size:12px;color:var(--fg-2)">' + W._esc(b.wardLabel || '') + '</div>';
      h += '</div>';
      h += '<div class="hint info">با تأیید، بیمار به تخت اختصاص می‌یابد</div>';
      return h;
    },

    next: function() {
      if (W.step === 1) {
        W.patient.firstName = (document.getElementById('admFirst').value || '').trim();
        W.patient.lastName = (document.getElementById('admLast').value || '').trim();
        W.patient.nationalId = (document.getElementById('admNID').value || '').trim();
        W.patient.mrn = (document.getElementById('admMRN').value || '').trim();
        W.patient.age = document.getElementById('admAge').value;
        W.patient.sex = document.getElementById('admSex').value;
        if (!W.patient.firstName || !W.patient.lastName) return alert('نام و نام خانوادگی الزامی');
        if (!W.patient.age || +W.patient.age < 0) return alert('سن الزامی');
        W.step = 2;
      } else if (W.step === 2) {
        if (!W.selectedBed) return alert('یک تخت انتخاب کنید');
        W.step = 3;
      } else if (W.step === 3) {
        W.step = 4;
      }
      W.render();
    },

    prev: function() {
      if (W.step > 1) W.step--;
      W.render();
    },

    pickWard: async function(code, label) {
      try {
        var d = await W._api('/api/bedboard/ward/' + code);
        var available = (d.items || []).filter(function(b) { return b.status === 'available'; });
        if (!available.length) return alert('تختی آزاد نیست');
        var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🛏️ ' + W._esc(label) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="adm-bed-grid">';
        available.forEach(function(b) {
          h += '<button class="adm-bed" onclick="NABZ.adm.pickBed(\'' + b.id + '\',\'' + W._esc(b.bedNumber) + '\',\'' + W._esc(label) + '\')">';
          h += '<div style="font-weight:900;color:var(--primary)">' + W._esc(b.bedNumber) + '</div>';
          h += '<div style="font-size:9px;color:var(--fg-2)">' + (b.isCritical ? 'ویژه' : 'عادی') + '</div>';
          h += '</button>';
        });
        h += '</div>';
        var s = document.createElement('div');
        s.className = 'bs-backdrop';
        s.style.zIndex = '400';
        s.onclick = function(e) { if (e.target === s) s.remove(); };
        var c = document.createElement('div');
        c.className = 'bs-sheet';
        c.innerHTML = h;
        s.appendChild(c);
        document.body.appendChild(s);
        requestAnimationFrame(function() { s.classList.add('show'); });
      } catch (e) { alert('خطا: ' + e.message); }
    },

    pickBed: function(id, number, wardLabel) {
      W.selectedBed = { id: id, bedNumber: number, wardLabel: wardLabel };
      var overlays = document.querySelectorAll('.bs-backdrop');
      // Remove the top one (bed picker), keep the wizard
      overlays.forEach(function(o, i) {
        if (i === overlays.length - 1 && o.style.zIndex === '400') o.remove();
      });
      W.render();
    },

    clearBed: function() {
      W.selectedBed = null;
      W.render();
    },

    submit: async function() {
      try {
        var diag = document.getElementById('admDx') ? document.getElementById('admDx').value : '';
        // step 4 re-rendered, need to read from last step 3 (we might not have them)
        var comorb = (window._admComorb || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        var aller = (window._admAller || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        var code = window._admCode || 'full';
        var type = window._admType || 'elective';
        // If we're on step 4, we need to read from cached W.patient
        var body = {
          firstName: W.patient.firstName,
          lastName: W.patient.lastName,
          nationalId: W.patient.nationalId,
          mrn: W.patient.mrn,
          age: +W.patient.age,
          sex: W.patient.sex,
          bedId: W.selectedBed.id,
          diagnosis: diag || W._cachedDx || '',
          comorbidities: comorb.length ? comorb : (W._cachedComorb || []),
          allergies: aller.length ? aller : (W._cachedAller || []),
          codeStatus: code || W._cachedCode || 'full',
          admissionType: type || W._cachedType || 'elective'
        };
        NABZ._toast('در حال ثبت...');
        await W._api('/api/clinical/patients', { method:'POST', body: JSON.stringify(body) });
        document.querySelectorAll('.bs-backdrop').forEach(function(o) { o.remove(); });
        NABZ._toast('✅ پذیرش ثبت شد');
        // Refresh current panel
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
        else NABZ.show('clinical.patients');
      } catch (e) { alert('خطا: ' + e.message); }
    }
  };

  // Capture step-3 fields on next()
  var origNext = W.next;
  W.next = function() {
    if (W.step === 3) {
      window._admComorb = document.getElementById('admComorb') ? document.getElementById('admComorb').value : '';
      window._admAller = document.getElementById('admAller') ? document.getElementById('admAller').value : '';
      window._admCode = document.getElementById('admCode') ? document.getElementById('admCode').value : 'full';
      window._admType = document.getElementById('admType') ? document.getElementById('admType').value : 'elective';
      W._cachedDx = document.getElementById('admDx') ? document.getElementById('admDx').value : '';
      W._cachedComorb = window._admComorb.split(',').map(function(s){return s.trim();}).filter(Boolean);
      W._cachedAller = window._admAller.split(',').map(function(s){return s.trim();}).filter(Boolean);
      W._cachedCode = window._admCode;
      W._cachedType = window._admType;
    }
    return origNext.call(W);
  };

  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 50) return;
    setTimeout(function() { ready(fn); }, 100);
  }
  ready(function() {
    NABZ.adm = W;
    NABZ.openAdmission = function() { W.start(); };
    console.log('[zz-adm] loaded ✓');
  });
})();
// appendix — patch fmtTitle via zz_pretty
(function(){
  function ready(fn){if(window.NABZ&&NABZ.show)return fn();setTimeout(function(){ready(fn)},100);}
  ready(function(){
    var origShow = NABZ.showItem;
    NABZ.showItem = function(pid, iid){
      // zz_pretty is the real renderer; this space left for future patches
      return origShow.apply(NABZ, arguments);
    };
  });
})();
