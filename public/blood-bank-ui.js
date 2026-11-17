// ═══════════════════════════════════════════════════════════
//  NABZ — Blood Bank UI (transfusion safety)
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var STATUS_MAP = { requested:'درخواست', crossmatched:'کراس‌مچ', issued:'ارسال', transfused:'تزریق', returned:'مرجوع' };
  var STATUS_CLS = { requested:'warn', crossmatched:'info', issued:'info', transfused:'ok', returned:'dng' };
  var PRODUCT_FA = { PRBC:'گلبول قرمز', FFP:'پلاسمای منجمد', Platelet:'پلاکت', Cryo:'کرایو' };
  var PRODUCT_ICON = { PRBC:'🩸', FFP:'💧', Platelet:'🔶', Cryo:'❄️' };

  var BB = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _time: function(iso) { try { return new Date(iso).toLocaleString('fa-IR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); } catch(_) { return '—'; } },
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
    _flow: function(steps, cur) {
      var h = '<div class="sur-flow">';
      steps.forEach(function(s, i) {
        var cls = i < cur ? 'done' : i === cur ? 'active' : '';
        h += '<div class="sur-flow-step ' + cls + '">' + s + '</div>';
      });
      h += '</div>';
      return h;
    },
    _pickPatient: async function(title) {
      if (NABZ.enc && NABZ.enc.pickPatient) return NABZ.enc.pickPatient(title);
      var d = await BB._api('/api/clinical/patients');
      var items = (d.items || []).filter(function(p) { return ['in_care','admitted'].indexOf(p.status) >= 0; });
      if (!items.length) { alert('بیماری بستری نیست'); return null; }
      return new Promise(function(resolve) {
        var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">👤 انتخاب بیمار</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        items.forEach(function(p) {
          h += '<button class="btn" style="width:100%;text-align:right;padding:12px;margin-bottom:4px" onclick="window._bbp(\'' + p.id + '\')"><b>' + NABZ._esc(p.firstName + ' ' + p.lastName) + '</b><br><small style="color:var(--fg-2)">' + NABZ._esc(p.wardCode || '') + ' · ' + NABZ._esc(p.diagnosis || '') + '</small></button>';
        });
        var s = BB._openSheet(h);
        window._bbp = function(pid) { s.sheet.remove(); resolve(pid); };
      });
    },

    // ═══ New request ═══
    newRequest: async function(patientId) {
      if (!patientId) {
        patientId = await BB._pickPatient('درخواست خون');
        if (!patientId) return;
      }
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title" style="color:var(--dng)">🩸 درخواست خون</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="hint danger">⚠️ درخواست خون نیاز به تأیید پزشک دارد</div>';
      h += '<div class="wf-field"><label>نوع فرآورده *</label><select id="bbProduct">';
      for (var k in PRODUCT_FA) h += '<option value="' + k + '">' + PRODUCT_ICON[k] + ' ' + PRODUCT_FA[k] + '</option>';
      h += '</select></div>';
      h += '<div class="wf-field"><label>تعداد واحد *</label><input type="number" id="bbUnits" value="2" min="1" max="10" style="text-align:center;font-size:20px;font-weight:900"></div>';
      h += '<div class="wf-field"><label>اولویت</label><select id="bbPriority">';
      h += '<option value="routine">روتین</option>';
      h += '<option value="urgent">فوری</option>';
      h += '<option value="emergency">اورژانسی (O منفی)</option>';
      h += '</select></div>';
      h += '<button class="btn btn-dng btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.bb._submitRequest(\'' + patientId + '\')">📤 ارسال به بانک خون</button>';
      BB._openSheet(h);
    },

    _submitRequest: async function(patientId) {
      var units = parseInt(document.getElementById('bbUnits').value);
      if (!units || units < 1) return alert('تعداد نامعتبر');
      try {
        var r = await BB._api('/api/para/blood', {
          method:'POST',
          body: JSON.stringify({
            patientId: patientId,
            productType: document.getElementById('bbProduct').value,
            units: units,
            priority: document.getElementById('bbPriority').value
          })
        });
        BB._closeAll();
        NABZ._toast('✅ درخواست ثبت شد');
        BB.viewRequest(r.id);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    // ═══ View request ═══
    viewRequest: async function(id) {
      try {
        var d = await BB._api('/api/para/blood');
        var r = (d.items || []).find(function(x) { return x.id === id; });
        if (!r) return alert('درخواست یافت نشد');
        var flowIdx = { requested:0, crossmatched:1, issued:2, transfused:3 }[r.status] || 0;

        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">' + (PRODUCT_ICON[r.productType]||'🩸') + ' ' + (PRODUCT_FA[r.productType]||r.productType) + ' — ' + BB._esc(r.patientName) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div style="margin-bottom:8px"><span class="pill ' + (STATUS_CLS[r.status]||'info') + '">' + (STATUS_MAP[r.status]||r.status) + '</span>';
        if (r.priority === 'emergency') h += ' <span class="pill dng">اورژانسی</span>';
        else if (r.priority === 'urgent') h += ' <span class="pill warn">فوری</span>';
        h += '</div>';
        h += BB._flow(['درخواست', 'کراس‌مچ', 'ارسال', 'تزریق'], flowIdx);

        h += '<div class="card" style="margin-bottom:12px">';
        h += '<div style="font-size:12px;color:var(--fg-2)">بخش: ' + BB._esc(r.wardCode) + '</div>';
        h += '<div style="font-size:12px;color:var(--fg-2)">تعداد: ' + r.units + ' واحد</div>';
        h += '<div style="font-size:12px;color:var(--fg-2)">درخواست: ' + BB._time(r.requestedAt) + '</div>';
        h += '</div>';

        if (r.crossmatch) {
          h += '<div class="card" style="margin-bottom:12px;border-color:var(--primary)">';
          h += '<div class="card-title">🧪 کراس‌مچ</div>';
          h += '<div style="font-size:12px">گروه خونی دهنده: <b>' + BB._esc(r.crossmatch.donor) + '</b></div>';
          h += '<div style="font-size:12px;margin-top:2px">نتیجه: <span class="pill ' + (r.crossmatch.result === 'compatible' ? 'ok' : 'dng') + '">' + (r.crossmatch.result === 'compatible' ? 'سازگار' : 'ناسازگار') + '</span></div>';
          h += '<div style="font-size:11px;color:var(--fg-2);margin-top:4px">' + BB._time(r.crossmatch.at) + '</div>';
          h += '</div>';
        }

        h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 20px">';
        if (r.status === 'requested') {
          h += '<button class="btn btn-primary" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.bb.crossmatch(\'' + r.id + '\')">🧪 کراس‌مچ</button>';
        }
        if (r.status === 'crossmatched') {
          h += '<button class="btn btn-primary" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.bb._issueBlood(\'' + r.id + '\')">📦 ارسال به بخش</button>';
        }
        if (r.status === 'issued') {
          h += '<button class="btn btn-dng" style="flex:1;min-width:140px;padding:12px;font-weight:900" onclick="NABZ.bb.startTransfusion(\'' + r.id + '\')">🩸 شروع تزریق (چک دو نفره)</button>';
        }
        h += '<button class="btn" style="flex:1;min-width:100px;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        h += '</div>';
        BB._openSheet(h);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    crossmatch: function(id) {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">🧪 کراس‌مچ</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>گروه خونی دهنده *</label><select id="bbDonor" style="font-size:18px;font-weight:900;text-align:center">';
      ['O+','O-','A+','A-','B+','B-','AB+','AB-'].forEach(function(b) {
        h += '<option value="' + b + '">' + b + '</option>';
      });
      h += '</select></div>';
      h += '<div class="hint warn">تطابق ABO/Rh با گیرنده تأیید می‌شود</div>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.bb._submitCrossmatch(\'' + id + '\')">✅ تأیید کراس‌مچ</button>';
      BB._closeAll();
      BB._openSheet(h);
    },

    _submitCrossmatch: async function(id) {
      try {
        await BB._api('/api/para/blood/' + id + '/crossmatch', {
          method:'POST',
          body: JSON.stringify({ donorBloodType: document.getElementById('bbDonor').value })
        });
        NABZ._toast('✅ کراس‌مچ انجام شد');
        BB._closeAll();
        BB.viewRequest(id);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    _issueBlood: async function(id) {
      if (!confirm('ارسال به بخش؟')) return;
      try {
        await BB._api('/api/para/blood/' + id + '/issue', { method:'POST', body:'{}' });
        NABZ._toast('📦 ارسال شد');
        BB._closeAll();
        BB.viewRequest(id);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    // ═══ TRANSFUSION — 2-person check ═══
    startTransfusion: function(id) {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title" style="color:var(--dng)">🩸 چک ایمنی تزریق خون</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="hint danger" style="margin-bottom:14px">⚠️ <b>چک دو نفره اجباری</b> — نفر دوم باید پرسنل دیگر باشد</div>';
      h += '<div class="bb-safety-check">';
      var checks = [
        ['identity','هویت بیمار با برچسب کیسه مطابقت دارد'],
        ['bloodType','گروه خونی گیرنده = دهنده'],
        ['crossmatch','برچسب کراس‌مچ سازگار است'],
        ['expiry','تاریخ انقضا کیسه معتبر است'],
        ['bag','کیسه سالم و بدون نشتی است'],
        ['consent','رضایت‌نامه تزریق امضا شده']
      ];
      checks.forEach(function(c) {
        h += '<label class="bb-check-item"><input type="checkbox" id="tr_' + c[0] + '" style="width:22px;height:22px;accent-color:var(--dng)"><span>' + c[1] + '</span></label>';
      });
      h += '</div>';
      h += '<div class="wf-field" style="margin-top:14px"><label>کد پرسنلی چک‌کننده دوم *</label>';
      h += '<input type="text" id="trWitness" placeholder="مثلاً wf_5" style="font-size:14px;font-weight:900"></div>';
      h += '<div class="hint info">نفر دوم باید با شمارش، هویت را تأیید کند</div>';
      h += '<button class="btn btn-dng btn-block" style="padding:16px;font-size:15px;margin-top:12px;font-weight:900" onclick="NABZ.bb._submitTransfusion(\'' + id + '\')">🩸 شروع تزریق</button>';
      BB._closeAll();
      BB._openSheet(h);
    },

    _submitTransfusion: async function(id) {
      var checks = ['identity','bloodType','crossmatch','expiry','bag','consent'];
      var missing = [];
      checks.forEach(function(k) {
        var el = document.getElementById('tr_' + k);
        if (!el || !el.checked) missing.push(k);
      });
      if (missing.length) return alert('⚠️ همه آیتم‌های ایمنی باید تأیید شوند');
      var witness = document.getElementById('trWitness').value.trim();
      if (!witness) return alert('کد پرسنلی چک‌کننده دوم الزامی است');
      try {
        await BB._api('/api/para/blood/' + id + '/transfuse', {
          method:'POST',
          body: JSON.stringify({ secondCheckerId: witness })
        });
        NABZ._toast('✅ تزریق شروع شد');
        BB._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    patientButtons: function(patientId) {
      return '<div style="margin-top:8px"><button class="btn btn-block" style="background:var(--dng-soft);color:var(--dng);border-color:var(--dng);padding:10px;font-size:12px" onclick="NABZ.bb.newRequest(\'' + patientId + '\')">🩸 درخواست خون</button></div>';
    }
  };

  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 50) return console.warn('[bb-ui] timeout');
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.bb = BB;
    var prevShowItem = NABZ.showItem;
    NABZ.showItem = function(pid, iid) {
      if (pid === 'paraclinical.blood') return BB.viewRequest(iid);
      return prevShowItem.apply(NABZ, arguments);
    };
    var prevDocBtns = NABZ._docButtonsFor;
    NABZ._docButtonsFor = function(pid, item) {
      var orig = prevDocBtns.apply(NABZ, arguments) || '';
      if (pid === 'clinical.patients' && item && item.id) return orig + BB.patientButtons(item.id);
      return orig;
    };
    var fab = document.createElement('button');
    fab.id = 'bbFab';
    fab.style.cssText = 'position:fixed;bottom:calc(var(--nav-h,72px) + 20px);left:20px;padding:14px 20px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border:none;border-radius:30px;font-family:inherit;font-size:13px;font-weight:900;box-shadow:0 4px 20px rgba(239,68,68,0.5);cursor:pointer;z-index:48;display:none;align-items:center;gap:6px';
    document.body.appendChild(fab);
    function update() {
      if (!NABZ.state || NABZ.state.current !== 'paraclinical.blood' || document.querySelector('.bs-backdrop')) { fab.style.display = 'none'; return; }
      fab.style.display = 'flex';
      fab.textContent = '🩸 درخواست جدید';
      fab.onclick = function() { BB.newRequest(); };
    }
    var content = document.getElementById('content');
    if (content) new MutationObserver(update).observe(content, { childList:true, subtree:false });
    setInterval(update, 500);
    console.log('[bb-ui] loaded');
  });
})();
