(function() {
  'use strict';
  var R = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _time: function(iso) { try { return new Date(iso).toLocaleString('fa-IR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); } catch(_) { return '—'; } },
    _open: function(html) {
      var s = document.createElement('div'); s.className = 'bs-backdrop';
      s.onclick = function(e) { if (e.target === s) s.remove(); };
      var c = document.createElement('div'); c.className = 'bs-sheet';
      c.style.maxHeight = '96vh'; c.innerHTML = html;
      s.appendChild(c); document.body.appendChild(s);
      requestAnimationFrame(function() { s.classList.add('show'); });
    },
    _closeAll: function() { document.querySelectorAll('.bs-backdrop').forEach(function(e) { e.remove(); }); },
    _cache: null,
    show: async function(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        var res = await Promise.all([ R._api('/api/restraint/stats'), R._api('/api/restraint/active'), R._api('/api/restraint/overdue') ]);
        R._cache = { stats: res[0], active: res[1], overdue: res[2] };
        R._render(p);
      } catch (e) { m.innerHTML = '<div class="empty">خطا: ' + R._esc(e.message) + '</div>'; }
    },
    _render: function(p) {
      var c = R._cache; if (!c) return;
      var s = c.stats; var m = document.getElementById('content');
      var h = '<div class="sec-hd"><span>🔒 مدیریت محدودیت — JCI COP.5</span></div>';
      if (c.overdue.total > 0) {
        h += '<div style="background:var(--dng-soft);border:2px solid var(--dng);border-radius:12px;padding:12px;margin-bottom:12px">';
        h += '<div style="font-size:14px;font-weight:900;color:var(--dng)">🚨 ' + c.overdue.total + ' سررسید</div>';
        c.overdue.items.slice(0, 5).forEach(function(r) {
          h += '<div style="font-size:12px;margin-top:6px;padding:6px;background:var(--bg-2);border-radius:6px"><b>' + R._esc(r.patientName) + '</b> — ' + r.reasons.join(' · ') + '</div>';
        });
        h += '</div>';
      }
      h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">';
      h += '<div class="rd-stat dng"><div class="v">' + s.active + '</div><div class="l">فعال</div></div>';
      h += '<div class="rd-stat ' + (s.overdue > 0 ? 'warn' : 'ok') + '"><div class="v">' + s.overdue + '</div><div class="l">سررسید</div></div>';
      h += '<div class="rd-stat ok"><div class="v">' + s.released24h + '</div><div class="l">آزاد ۲۴h</div></div>';
      h += '<div class="rd-stat info"><div class="v">' + (s.byType.violent_self + s.byType.violent_other) + '</div><div class="l">خشونت‌آمیز</div></div>';
      h += '</div>';
      h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:12px;font-weight:900" onclick="NABZ.restraintUI.startForm()">➕ شروع محدودیت جدید</button>';
      h += '<div class="sec-hd"><span>🟢 فعال (' + c.active.total + ')</span></div>';
      if (c.active.total === 0) h += '<div class="card" style="text-align:center;padding:20px;color:var(--fg-2);font-size:12px">هیچ محدودیت فعالی نیست</div>';
      else c.active.items.forEach(function(r) { h += R._row(r); });
      m.innerHTML = h;
      NABZ.state.current = p ? p.id : 'restraint.dashboard';
    },
    _row: function(r) {
      var cls = r._orderExpired || r._overdue ? 'hi' : r.typeClass === 'violent' ? 'md' : 'lo';
      var badge = r._orderExpired ? '<span class="pill dng">منقضی</span>' : r._overdue ? '<span class="pill warn">ارزیابی سررسید</span>' : '<span class="pill ok">فعال</span>';
      return '<div class="row ' + cls + '" style="margin-bottom:6px;cursor:pointer" onclick="NABZ.restraintUI.openRecord(\'' + r.id + '\')">' +
        '<div class="row-hd"><div class="row-title">' + R._esc(r.patientName) + '</div>' + badge + '</div>' +
        '<div class="row-meta" style="font-size:11px">' + R._esc(r.wardCode || '') + ' · ' + r.typeClass + ' · ' + r.ageBand + '</div>' +
        '<div class="row-meta" style="font-size:10.5px">شروع: ' + R._time(r.startedAt) + ' · ' + R._esc(r.orderedByName) + '</div></div>';
    },
    startForm: async function() {
      var d = await R._api('/api/clinical/patients');
      var patients = (d.items || []).filter(function(p) { return ['in_care','admitted'].indexOf(p.status) >= 0; });
      if (!patients.length) return alert('بیماری بستری نیست');
      var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🔒 شروع محدودیت</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>بیمار *</label><select id="rsPatient">';
      patients.forEach(function(p) { h += '<option value="' + p.id + '">' + R._esc(p.firstName + ' ' + p.lastName) + ' — ' + R._esc(p.wardCode || '') + '</option>'; });
      h += '</select></div>';
      h += '<div class="wf-field"><label>نوع *</label><select id="rsType"><option value="violent_self">خشونت‌آمیز / خودآسیب</option><option value="violent_other">خشونت‌آمیز / آسیب به دیگران</option><option value="nonviolent_medical">غیرخشونت‌آمیز / پزشکی</option></select></div>';
      h += '<div class="wf-field"><label>روش *</label><select id="rsRtype"><option value="physical">فیزیکی</option><option value="chemical">دارویی</option><option value="seclusion">انزوا</option></select></div>';
      h += '<div class="wf-field"><label>دلیل (≥۱۰ کاراکتر) *</label><textarea id="rsReason" rows="3"></textarea></div>';
      h += '<div class="wf-field"><label>روش‌های جایگزین (با کاما) *</label><input id="rsAlt" placeholder="de_escalation, environment"></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.restraintUI.submitStart()">▶ شروع</button>';
      R._open(h);
    },
    submitStart: async function() {
      var body = {
        patientId: document.getElementById('rsPatient').value,
        type: document.getElementById('rsType').value,
        restraintType: document.getElementById('rsRtype').value,
        reason: document.getElementById('rsReason').value.trim(),
        alternativesTried: document.getElementById('rsAlt').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean)
      };
      if (!body.reason || body.reason.length < 10) return alert('دلیل ≥۱۰ کاراکتر');
      if (!body.alternativesTried.length) return alert('حداقل یک روش جایگزین');
      try {
        var r = await R._api('/api/restraint/start', { method: 'POST', body: JSON.stringify(body) });
        NABZ._toast('✅ شروع شد'); R._closeAll(); R.openRecord(r.id);
      } catch (e) { alert('خطا: ' + e.message); }
    },
    openRecord: async function(id) {
      try {
        var r = await R._api('/api/restraint/' + id);
        var now = Date.now();
        var orderMin = Math.floor((new Date(r.orderExpiresAt).getTime() - now) / 60000);
        var assessMin = Math.floor((new Date(r.nextAssessmentDueAt).getTime() - now) / 60000);
        var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🔒 ' + R._esc(r.patientName) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="card" style="margin-bottom:12px;border-color:var(--' + (orderMin < 0 ? 'dng' : orderMin < 30 ? 'warn' : 'ok') + ')">';
        h += '<div style="font-size:11px;color:var(--fg-2)">دستور تا</div>';
        h += '<div style="font-size:20px;font-weight:900;color:var(--' + (orderMin < 0 ? 'dng' : orderMin < 30 ? 'warn' : 'ok') + ')">' + (orderMin < 0 ? 'منقضی' : orderMin + ' دقیقه') + '</div>';
        h += '<div style="font-size:11px;color:var(--fg-2);margin-top:4px">ارزیابی بعدی: ' + (assessMin < 0 ? 'سررسید' : assessMin + ' دقیقه') + '</div></div>';
        h += '<div class="card" style="margin-bottom:8px"><div class="card-title">👨‍⚕️ Face-to-Face</div>';
        if (r.faceToFace) {
          h += '<div style="font-size:11.5px">✅ ' + R._esc(r.faceToFace.doneByName) + ' — ' + R._time(r.faceToFace.doneAt) + '</div>';
          h += '<div style="font-size:11px;color:var(--fg-2);margin-top:4px">' + R._esc(r.faceToFace.findings) + '</div>';
        } else {
          var f2fMin = Math.floor((new Date(r.faceToFaceDeadline).getTime() - now) / 60000);
          h += '<div style="font-size:11.5px;color:' + (f2fMin < 0 ? 'var(--dng)' : 'var(--warn)') + '">⏳ ' + (f2fMin < 0 ? 'سررسید' : f2fMin + ' دقیقه مانده') + '</div>';
          h += '<button class="btn btn-sm" style="margin-top:6px;padding:6px 12px;font-size:11px" onclick="NABZ.restraintUI.f2fForm(\'' + r.id + '\')">📝 ثبت</button>';
        }
        h += '</div>';
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
        h += '<button class="btn" style="padding:10px;font-size:11px" onclick="NABZ.restraintUI.assessForm(\'' + r.id + '\')">📋 ارزیابی</button>';
        h += '<button class="btn" style="padding:10px;font-size:11px" onclick="NABZ.restraintUI.renewForm(\'' + r.id + '\')">🔄 تمدید</button>';
        h += '</div>';
        h += '<button class="btn btn-ok btn-block" style="padding:12px;font-weight:900;margin-bottom:12px" onclick="NABZ.restraintUI.releaseForm(\'' + r.id + '\')">✅ آزادسازی</button>';
        if (r.assessments.length) {
          h += '<div class="sec-hd" style="margin-top:14px"><span>📋 ارزیابی‌ها (' + r.assessments.length + ')</span></div>';
          r.assessments.slice(-5).reverse().forEach(function(a) {
            h += '<div style="padding:8px;background:var(--bg-2);border-radius:6px;margin-bottom:4px;font-size:11px">';
            h += '<div style="font-weight:800">' + R._time(a.at) + ' — ' + R._esc(a.byName) + '</div>';
            h += '<div style="color:var(--fg-2)">' + a.behavior + ' · ' + a.circulation + ' · ' + a.sensation + '</div></div>';
          });
        }
        R._open(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },
    f2fForm: function(id) {
      var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📝 Face-to-Face</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>یافته‌ها (≥۱۰ کاراکتر) *</label><textarea id="f2fFind" rows="4"></textarea></div>';
      h += '<label style="display:flex;gap:8px;padding:10px;background:var(--bg-2);border-radius:6px;margin:8px 0;font-size:12px;cursor:pointer"><input type="checkbox" id="f2fOk" checked style="width:18px;height:18px"><span>محدودیت برای شرایط فعلی مناسب است</span></label>';
      h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:12px" onclick="NABZ.restraintUI._submitF2F(\'' + id + '\')">✅ ثبت</button>';
      R._open(h);
    },
    _submitF2F: async function(id) {
      var f = document.getElementById('f2fFind').value.trim();
      if (!f || f.length < 10) return alert('یافته‌ها ≥۱۰ کاراکتر');
      try { await R._api('/api/restraint/' + id + '/face-to-face', { method:'POST', body: JSON.stringify({ findings: f, appropriateForRestraint: document.getElementById('f2fOk').checked }) }); NABZ._toast('✅'); R._closeAll(); R.openRecord(id); }
      catch (e) { alert('خطا: ' + e.message); }
    },
    assessForm: function(id) {
      var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📋 ارزیابی</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>رفتار</label><select id="asBeh"><option value="calm">آرام</option><option value="agitated">بی‌قرار</option><option value="combative">پرخاشگر</option></select></div>';
      h += '<div class="wf-field"><label>گردش</label><select id="asCirc"><option value="good">خوب</option><option value="impaired">مختل</option></select></div>';
      h += '<div class="wf-field"><label>حس</label><select id="asSens"><option value="intact">سالم</option><option value="impaired">مختل</option></select></div>';
      h += '<div class="wf-field"><label>پوست</label><select id="asSkin"><option value="intact">سالم</option><option value="redness">قرمزی</option><option value="breakdown">زخم</option></select></div>';
      ['toileting|توالت','hydration|هیدراتاسیون','rangeOfMotion|حرکت','releaseConsidered|معیار آزادسازی'].forEach(function(x) {
        var p = x.split('|');
        h += '<label style="display:flex;gap:8px;padding:6px;font-size:12px"><input type="checkbox" id="as_' + p[0] + '" style="width:18px;height:18px">' + p[1] + '</label>';
      });
      h += '<div class="wf-field"><label>یادداشت</label><textarea id="asNotes" rows="2"></textarea></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:12px" onclick="NABZ.restraintUI._submitAssess(\'' + id + '\')">✅ ثبت</button>';
      R._open(h);
    },
    _submitAssess: async function(id) {
      var body = { behavior: document.getElementById('asBeh').value, circulation: document.getElementById('asCirc').value, sensation: document.getElementById('asSens').value, skinCondition: document.getElementById('asSkin').value, toileting: document.getElementById('as_toileting').checked, hydration: document.getElementById('as_hydration').checked, rangeOfMotion: document.getElementById('as_rangeOfMotion').checked, releaseConsidered: document.getElementById('as_releaseConsidered').checked, notes: document.getElementById('asNotes').value };
      try { await R._api('/api/restraint/' + id + '/assess', { method:'POST', body: JSON.stringify(body) }); NABZ._toast('✅'); R._closeAll(); R.openRecord(id); }
      catch (e) { alert('خطا: ' + e.message); }
    },
    renewForm: function(id) {
      var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🔄 تمدید</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>دلیل (≥۱۰ کاراکتر) *</label><textarea id="rnReason" rows="3"></textarea></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:12px" onclick="NABZ.restraintUI._submitRenew(\'' + id + '\')">✅ تمدید</button>';
      R._open(h);
    },
    _submitRenew: async function(id) {
      var r = document.getElementById('rnReason').value.trim();
      if (!r || r.length < 10) return alert('دلیل ≥۱۰ کاراکتر');
      try { await R._api('/api/restraint/' + id + '/renew', { method:'POST', body: JSON.stringify({ reason: r }) }); NABZ._toast('✅'); R._closeAll(); R.openRecord(id); }
      catch (e) { alert('خطا: ' + e.message); }
    },
    releaseForm: function(id) {
      var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">✅ آزادسازی</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>دلیل (≥۵ کاراکتر) *</label><textarea id="rlReason" rows="3"></textarea></div>';
      h += '<button class="btn btn-ok btn-block" style="padding:12px;margin-top:12px;font-weight:900" onclick="NABZ.restraintUI._submitRelease(\'' + id + '\')">✅ آزادسازی</button>';
      R._open(h);
    },
    _submitRelease: async function(id) {
      var r = document.getElementById('rlReason').value.trim();
      if (!r || r.length < 5) return alert('دلیل ≥۵ کاراکتر');
      try { await R._api('/api/restraint/' + id + '/release', { method:'POST', body: JSON.stringify({ reason: r }) }); NABZ._toast('✅ آزاد شد'); R._closeAll(); R.show(null, null); }
      catch (e) { alert('خطا: ' + e.message); }
    }
  };
  window.NABZ = window.NABZ || {};
  NABZ.restraintUI = R;
  var tries = 0;
  (function tryReg() {
    if (NABZ._dispatchRegistry && typeof NABZ.registerKind === 'function') { NABZ.registerKind('restraint_dashboard', function(p, d) { return R.show(p, d); }); console.log('[restraint-ui] loaded'); return; }
    if (++tries > 60) return console.warn('[restraint-ui] dispatch never loaded');
    setTimeout(tryReg, 100);
  })();
})();
