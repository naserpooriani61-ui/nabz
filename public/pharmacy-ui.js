// ═══════════════════════════════════════════════════════════
//  NABZ — Pharmacy UI (verify + dispense + interactions)
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var HIGH_ALERT = ['insulin','heparin','warfarin','morphine','fentanyl','potassium','digoxin','chemotherapy','methotrexate','opioid'];
  var STATUS_MAP = { pending_verify:'منتظر تأیید', verified:'تأیید شده', dispensed:'تحویل شده', returned:'مرجوع' };
  var STATUS_CLS = { pending_verify:'warn', verified:'info', dispensed:'ok', returned:'dng' };

  var PH = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _time: function(iso) { try { return new Date(iso).toLocaleString('fa-IR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); } catch(_){ return '—'; } },
    _closeAll: function() { document.querySelectorAll('.bs-backdrop').forEach(function(e) { e.remove(); }); },
    _openSheet: function(html, opts) {
      opts = opts || {};
      var s = document.createElement('div');
      s.className = 'bs-backdrop';
      s.onclick = function(e) { if (e.target === s && !opts.noClose) s.remove(); };
      var c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '96vh';
      c.innerHTML = html;
      s.appendChild(c);
      document.body.appendChild(s);
      requestAnimationFrame(function() { s.classList.add('show'); });
      return { sheet:s, content:c };
    },
    _isHighAlert: function(drug) {
      var d = String(drug || '').toLowerCase();
      return HIGH_ALERT.some(function(h) { return d.indexOf(h) >= 0; });
    },
    _flowBar: function(steps, cur) {
      var h = '<div class="sur-flow">';
      steps.forEach(function(s, i) {
        var cls = i < cur ? 'done' : i === cur ? 'active' : '';
        h += '<div class="sur-flow-step ' + cls + '">' + s + '</div>';
      });
      h += '</div>';
      return h;
    },

    // ═══════════════════════════════════════════════════
    //  VERIFY DISPENSE
    // ═══════════════════════════════════════════════════
    viewDispense: async function(id) {
      try {
        var d = await PH._api('/api/para/dispenses');
        var x = (d.items || []).find(function(y) { return y.id === id; });
        if (!x) return alert('تحویل یافت نشد');
        var isHigh = PH._isHighAlert(x.drugName);
        var flowIdx = { pending_verify:0, verified:1, dispensed:2 }[x.status] || 0;

        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title" style="color:' + (isHigh ? 'var(--dng)' : 'var(--fg)') + '">💊 ' + PH._esc(x.drugName) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        h += '<div style="margin-bottom:8px">';
        h += '<span class="pill ' + (STATUS_CLS[x.status]||'info') + '">' + (STATUS_MAP[x.status]||x.status) + '</span>';
        if (isHigh) h += ' <span class="pill dng">⚠️ پرخطر</span>';
        h += '</div>';
        h += PH._flowBar(['تأیید', 'تحویل'], Math.min(flowIdx, 1));

        h += '<div class="card" style="margin-bottom:12px">';
        h += '<div style="font-weight:900;font-size:15px">' + PH._esc(x.patientName) + '</div>';
        h += '<div style="font-size:12px;color:var(--fg-2);margin-top:2px">' + PH._esc(x.wardCode || '') + '</div>';
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">';
        h += '<div style="background:var(--bg-3);padding:8px;border-radius:6px;text-align:center"><div style="font-size:16px;font-weight:900;color:var(--primary)">' + PH._esc(x.dose) + '</div><div style="font-size:10px;color:var(--fg-2)">دوز</div></div>';
        h += '<div style="background:var(--bg-3);padding:8px;border-radius:6px;text-align:center"><div style="font-size:16px;font-weight:900;color:var(--primary)">' + (x.quantity || '—') + '</div><div style="font-size:10px;color:var(--fg-2)">تعداد</div></div>';
        h += '</div>';
        h += '</div>';

        if (x.verifiedAt) {
          h += '<div class="hint success">✅ تأیید شده توسط ' + PH._esc(x.verifiedBy || '—') + ' — ' + PH._time(x.verifiedAt) + '</div>';
        }

        // CDSS check
        var interactions = [];
        try {
          var cdss = await PH._api('/api/cdss/patient/' + x.patientId);
          if (cdss && cdss.interactions && cdss.interactions.length) {
            interactions = cdss.interactions.filter(function(ix) {
              var n = String(x.drugName || '').toLowerCase();
              return n.indexOf(ix.drug1.toLowerCase()) >= 0 || n.indexOf(ix.drug2.toLowerCase()) >= 0;
            });
          }
        } catch(_) {}

        if (interactions.length) {
          h += '<div class="card" style="border-color:var(--dng);background:var(--dng-soft);margin-bottom:12px">';
          h += '<div class="card-title" style="color:var(--dng)">⚠️ تداخل دارویی — ' + interactions.length + '</div>';
          interactions.forEach(function(ix) {
            h += '<div style="font-size:12px;padding:4px 0;border-top:1px solid var(--dng-soft)">';
            h += '<b>' + PH._esc(ix.drug1) + ' + ' + PH._esc(ix.drug2) + '</b>';
            h += '<div style="color:var(--fg-2);font-size:11px;margin-top:2px">' + PH._esc(ix.effect) + '</div>';
            h += '<div style="font-size:11px;margin-top:2px">→ ' + PH._esc(ix.action) + '</div>';
            h += '</div>';
          });
          h += '</div>';
        }

        h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 20px">';
        if (x.status === 'pending_verify') {
          h += '<button class="btn btn-primary" style="flex:1;min-width:140px;padding:12px;font-weight:900" onclick="NABZ.ph._verify(\'' + x.id + '\')">✅ تأیید</button>';
        }
        if (x.status === 'verified') {
          h += '<button class="btn btn-ok" style="flex:1;min-width:140px;padding:12px;font-weight:900" onclick="NABZ.ph._dispense(\'' + x.id + '\')">💊 تحویل</button>';
        }
        h += '<button class="btn" style="flex:1;min-width:100px;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        h += '</div>';
        PH._openSheet(h);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    _verify: async function(id) {
      if (!confirm('تأیید این dispense؟')) return;
      try {
        await PH._api('/api/para/dispenses/' + id + '/verify', { method:'POST', body:'{}' });
        NABZ._toast('✅ تأیید شد');
        PH._closeAll();
        PH.viewDispense(id);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    _dispense: function(id) {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">💊 تأیید تحویل</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="hint info">قبل از تحویل، ۶ آیتم ایمنی را تأیید کنید</div>';
      h += '<div class="ph-checklist">';
      var checks = [
        ['patient','هویت بیمار با نسخه مطابقت دارد'],
        ['drug','نام دارو با نسخه مطابقت دارد'],
        ['dose','دوز و تعداد صحیح است'],
        ['route','مسیر تجویز صحیح است'],
        ['interaction','تداخل دارویی بررسی شد'],
        ['expiry','تاریخ انقضا معتبر است']
      ];
      checks.forEach(function(c) {
        h += '<label class="bb-check-item"><input type="checkbox" id="phc_' + c[0] + '" style="width:20px;height:20px;accent-color:var(--ok)"><span>' + c[1] + '</span></label>';
      });
      h += '</div>';
      h += '<button class="btn btn-ok btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.ph._submitDispense(\'' + id + '\')">✅ تحویل به بخش</button>';
      PH._closeAll();
      PH._openSheet(h);
    },

    _submitDispense: async function(id) {
      var checks = ['patient','drug','dose','route','interaction','expiry'];
      var missing = [];
      checks.forEach(function(k) {
        var el = document.getElementById('phc_' + k);
        if (!el || !el.checked) missing.push(k);
      });
      if (missing.length) return alert('همه ۶ آیتم ایمنی باید تأیید شوند');
      try {
        await PH._api('/api/para/dispenses/' + id + '/dispense', { method:'POST', body:'{}' });
        NABZ._toast('✅ دارو تحویل شد');
        PH._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  INTERACTION CALCULATOR
    // ═══════════════════════════════════════════════════
    interactionCalc: function() {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">⚠️ بررسی تداخل</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>داروهای بیمار (با کاما)</label>';
      h += '<textarea id="phDrugs" rows="3" placeholder="warfarin, aspirin, omeprazole" style="font-family:monospace"></textarea></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:12px" onclick="NABZ.ph._checkInteractions()">🔍 بررسی</button>';
      h += '<div id="phIxResult" style="margin-top:12px"></div>';
      PH._openSheet(h);
    },

    _checkInteractions: async function() {
      var drugs = document.getElementById('phDrugs').value.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
      if (drugs.length < 2) return alert('حداقل ۲ دارو');
      var el = document.getElementById('phIxResult');
      el.innerHTML = '<div style="text-align:center;padding:12px"><span class="spinner"></span></div>';
      try {
        var d = await PH._api('/api/cdss/interactions', {
          method:'POST', body: JSON.stringify({ drugs: drugs })
        });
        if (!d.interactions.length) {
          el.innerHTML = '<div class="card" style="border-color:var(--ok);text-align:center;color:var(--ok);font-weight:800;padding:14px">✅ تداخلی یافت نشد</div>';
          return;
        }
        var html = '';
        d.interactions.forEach(function(ix) {
          var cls = ix.severity === 'major' ? 'dng' : 'warn';
          html += '<div class="card" style="border-color:var(--' + cls + ')">';
          html += '<div class="row-hd"><div class="row-title">' + PH._esc(ix.drug1) + ' + ' + PH._esc(ix.drug2) + '</div>';
          html += '<span class="pill ' + cls + '">' + ix.severity + '</span></div>';
          html += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:4px">' + PH._esc(ix.effect) + '</div>';
          html += '<div style="font-size:11.5px;margin-top:6px;padding:6px;background:var(--bg-3);border-radius:6px">' + PH._esc(ix.action) + '</div>';
          html += '</div>';
        });
        el.innerHTML = html;
      } catch(e) { el.innerHTML = '<div class="empty">خطا: ' + PH._esc(e.message) + '</div>'; }
    },

    // ═══════════════════════════════════════════════════
    //  Quick dispense from MAR
    // ═══════════════════════════════════════════════════
    quickNewDispense: async function() {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">💊 ثبت تحویل جدید</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="hint info">اگر از دستور پزشک ساخته شده، از MAR استفاده کنید</div>';
      h += '<button class="btn btn-block" style="padding:12px;margin-top:8px" onclick="this.closest(\'.bs-backdrop\').remove();NABZ.show(\'clinical.mar\')">📋 مشاهده MAR</button>';
      h += '<button class="btn btn-block" style="padding:12px;margin-top:6px" onclick="this.closest(\'.bs-backdrop\').remove();NABZ.show(\'clinical.kardex\')">📝 مشاهده کاردکس</button>';
      PH._openSheet(h);
    },

    patientButtons: function(patientId) {
      return '<div style="margin-top:8px"><button class="btn btn-block" style="background:var(--violet-soft);color:var(--violet);border-color:var(--violet);padding:10px;font-size:12px" onclick="NABZ.ph.showPatientDispenses(\'' + patientId + '\')">💊 داروهای بیمار</button></div>';
    },

    showPatientDispenses: async function(patientId) {
      try {
        var d = await PH._api('/api/para/dispenses');
        var items = (d.items || []).filter(function(x) { return x.patientId === patientId; });
        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">💊 داروهای بیمار</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        if (!items.length) {
          h += '<div class="empty">دارویی برای این بیمار ثبت نشده</div>';
        } else {
          items.forEach(function(x) {
            var isHigh = PH._isHighAlert(x.drugName);
            h += '<div class="row ' + (x.status === 'pending_verify' ? 'md' : 'lo') + '" onclick="NABZ.ph.viewDispense(\'' + x.id + '\')">';
            h += '<div class="row-hd"><div class="row-title">' + PH._esc(x.drugName) + ' — ' + PH._esc(x.dose) + '</div>';
            h += '<span class="pill ' + (STATUS_CLS[x.status]||'info') + '">' + (STATUS_MAP[x.status]||x.status) + '</span></div>';
            if (isHigh) h += '<div class="row-meta" style="color:var(--dng);font-weight:800">⚠️ پرخطر</div>';
            h += '</div>';
          });
        }
        PH._openSheet(h);
      } catch(e) { alert('خطا: ' + e.message); }
    }
  };

  // ═══ Bootstrap ═══
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 50) return console.warn('[ph-ui] timeout');
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.ph = PH;

    // Wrap showItem
    var prevShowItem = NABZ.showItem;
    NABZ.showItem = function(pid, iid) {
      if (pid === 'paraclinical.dispenses') return PH.viewDispense(iid);
      return prevShowItem.apply(NABZ, arguments);
    };

    // Wrap _docButtonsFor
    var prevDocBtns = NABZ._docButtonsFor;
    NABZ._docButtonsFor = function(pid, item) {
      var orig = prevDocBtns.apply(NABZ, arguments) || '';
      if (pid === 'clinical.patients' && item && item.id) return orig + PH.patientButtons(item.id);
      return orig;
    };

    // FAB for dispenses panel
    var fab = document.createElement('button');
    fab.id = 'phFab';
    fab.style.cssText = 'position:fixed;bottom:calc(var(--nav-h,72px) + 20px);left:20px;padding:14px 20px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;border:none;border-radius:30px;font-family:inherit;font-size:13px;font-weight:900;box-shadow:0 4px 20px rgba(139,92,246,0.5);cursor:pointer;z-index:51;display:none;align-items:center;gap:6px';
    document.body.appendChild(fab);

    var FAB_MAP = {
      'paraclinical.dispenses': { label:'⚠️ بررسی تداخل', fn:function() { PH.interactionCalc(); } }
    };
    function update() {
      if (!NABZ.state) return;
      var cfg = FAB_MAP[NABZ.state.current];
      if (!cfg || document.querySelector('.bs-backdrop')) { fab.style.display = 'none'; return; }
      fab.style.display = 'flex';
      fab.textContent = cfg.label;
      fab.onclick = cfg.fn;
    }
    var content = document.getElementById('content');
    if (content) new MutationObserver(update).observe(content, { childList:true, subtree:false });
    setInterval(update, 500);

    console.log('[ph-ui] loaded ✓');
  });
})();
