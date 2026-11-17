// ═══════════════════════════════════════════════════════════
//  NABZ — Missing UI Handlers
//  erf_prehospital + erf_referrals + pipeline (flow)
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && window.NABZ.erfUI) return fn();
    if (++waitCount >= 60) { console.warn('[missing-handlers] timeout'); return; }
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    // ═══ erf_prehospital ═══
    NABZ.erfUI.showPreHospital = async function(p, d) {
      var m = document.getElementById('content');
      if (!d) {
        m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
        try { d = await NABZ._api('/api/erf/prehospital'); }
        catch(e) { m.innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>'; return; }
      }
      var items = d.items || [];
      var h = '<div class="sec-hd"><span>🚑 پیش‌بیمارستانی</span><span class="rd-mini">' + items.length + '</span></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:12px" onclick="NABZ.erfUI.newPreHospital()">➕ ثبت مورد جدید</button>';
      if (!items.length) {
        h += '<div class="empty">موردی در راه نیست</div>';
      } else {
        items.forEach(function(x) {
          h += '<div class="row ' + (x.status === 'incoming' ? 'hi' : 'lo') + '" onclick="NABZ.erfUI._viewPreHospital(\'' + x.id + '\')">';
          h += '<div class="row-hd"><div class="row-title">🚑 ' + NABZ._esc(x.patientName) + '</div>';
          h += '<span class="pill ' + (x.status === 'incoming' ? 'warn' : 'ok') + '">' + (x.status === 'incoming' ? 'در راه' : 'رسید') + '</span></div>';
          if (x.age) h += '<div class="row-meta">' + x.age + ' سال · ' + (x.sex === 'female' ? 'زن' : 'مرد') + '</div>';
          h += '<div class="row-meta">' + NABZ._esc(x.chiefComplaint || '—') + '</div>';
          if (x.ambulanceCode) h += '<div class="row-meta" style="font-size:10.5px">آمبولانس: ' + NABZ._esc(x.ambulanceCode) + ' · ETA: ' + (x.etaMinutes || '?') + ' دقیقه</div>';
          h += '</div>';
        });
      }
      m.innerHTML = h;
    };

    NABZ.erfUI._viewPreHospital = async function(id) {
      var d = await NABZ._api('/api/erf/prehospital');
      var x = (d.items || []).find(function(i) { return i.id === id; });
      if (!x) return alert('یافت نشد');
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">🚑 ' + NABZ._esc(x.patientName) + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="card" style="margin-bottom:12px">';
      if (x.age) h += '<div style="font-size:12px">سن: ' + x.age + ' · ' + (x.sex === 'female' ? 'زن' : 'مرد') + '</div>';
      h += '<div style="font-size:12px">شکایت: ' + NABZ._esc(x.chiefComplaint || '—') + '</div>';
      if (x.mechanism) h += '<div style="font-size:12px">مکانیسم: ' + NABZ._esc(x.mechanism) + '</div>';
      if (x.ambulanceCode) h += '<div style="font-size:12px">آمبولانس: ' + NABZ._esc(x.ambulanceCode) + '</div>';
      if (x.paramedicName) h += '<div style="font-size:12px">تکنسین: ' + NABZ._esc(x.paramedicName) + '</div>';
      if (x.etaMinutes) h += '<div style="font-size:12px">ETA: ' + x.etaMinutes + ' دقیقه</div>';
      h += '</div>';
      if (x.vitals && Object.keys(x.vitals).length) {
        h += '<div class="card" style="margin-bottom:12px"><div class="card-title">📊 ویتال</div><div style="font-size:12px">';
        for (var k in x.vitals) h += '<span style="display:inline-block;margin:2px 4px"><b>' + k + ':</b> ' + x.vitals[k] + '</span>';
        h += '</div></div>';
      }
      if (x.status === 'incoming') {
        h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-bottom:20px;font-weight:900" onclick="NABZ.erfUI._convertPreHospital(\'' + x.id + '\')">🚨 تبدیل به پذیرش اورژانس</button>';
      }
      NABZ.erfUI._openSheet(h);
    };

    NABZ.erfUI._convertPreHospital = async function(id) {
      try {
        await NABZ._api('/api/erf/prehospital/' + id + '/convert', { method:'POST', body:'{}' });
        NABZ._toast('✅ تبدیل به پذیرش شد');
        NABZ.erfUI._closeAll();
        NABZ.erfUI.showPreHospital(null, null);
      } catch(e) { alert('خطا: ' + e.message); }
    };

    // ═══ erf_referrals ═══
    NABZ.erfUI.showReferrals = async function(p, d) {
      var m = document.getElementById('content');
      if (!d) {
        m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
        try { d = await NABZ._api('/api/erf/referral'); }
        catch(e) { m.innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>'; return; }
      }
      var items = d.items || [];
      var inc = items.filter(function(x) { return x.direction === 'incoming'; });
      var out = items.filter(function(x) { return x.direction === 'outgoing'; });

      var h = '<div class="sec-hd"><span>↪️ ارجاع و اعزام</span></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:12px" onclick="NABZ.erfUI.newReferral()">➕ ثبت ارجاع</button>';
      h += '<div class="rd-stats" style="grid-template-columns:1fr 1fr;margin-bottom:14px">';
      h += '<div class="rd-stat info"><div class="v">' + inc.length + '</div><div class="l">ورودی</div></div>';
      h += '<div class="rd-stat warn"><div class="v">' + out.length + '</div><div class="l">خروجی</div></div>';
      h += '</div>';

      if (!items.length) { m.innerHTML = h + '<div class="empty">ارجاعی ثبت نشده</div>'; return; }

      h += '<div style="font-size:12px;font-weight:900;margin:14px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--primary)">📥 ورودی (' + inc.length + ')</div>';
      inc.forEach(function(x) { h += NABZ.erfUI._renderReferralRow(x); });
      h += '<div style="font-size:12px;font-weight:900;margin:14px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--warn)">📤 خروجی (' + out.length + ')</div>';
      out.forEach(function(x) { h += NABZ.erfUI._renderReferralRow(x); });
      m.innerHTML = h;
    };

    NABZ.erfUI._renderReferralRow = function(x) {
      var SC = { pending_arrival:'warn', pending_send:'info', arrived:'ok', sent:'ok', cancelled:'dng' };
      var SF = { pending_arrival:'در انتظار ورود', pending_send:'در انتظار ارسال', arrived:'رسید', sent:'ارسال شد', cancelled:'لغو' };
      var h = '<div class="row ' + (x.priority === 'emergency' ? 'hi' : 'lo') + '" onclick="NABZ.erfUI._viewReferral(\'' + x.id + '\')">';
      h += '<div class="row-hd"><div class="row-title">' + NABZ._esc(x.patientName) + '</div>';
      h += '<span class="pill ' + (SC[x.status] || 'info') + '">' + (SF[x.status] || x.status) + '</span></div>';
      if (x.fromHospital) h += '<div class="row-meta">از: ' + NABZ._esc(x.fromHospital) + '</div>';
      if (x.toHospital) h += '<div class="row-meta">به: ' + NABZ._esc(x.toHospital) + '</div>';
      if (x.reason) h += '<div class="row-meta" style="font-size:11px">' + NABZ._esc(x.reason) + '</div>';
      h += '</div>';
      return h;
    };

    NABZ.erfUI._viewReferral = async function(id) {
      var d = await NABZ._api('/api/erf/referral');
      var x = (d.items || []).find(function(i) { return i.id === id; });
      if (!x) return alert('یافت نشد');
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">↪️ ' + NABZ._esc(x.patientName) + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="card" style="margin-bottom:12px">';
      h += '<div style="font-size:12px">جهت: <b>' + (x.direction === 'incoming' ? 'ورودی' : 'خروجی') + '</b></div>';
      if (x.fromHospital) h += '<div style="font-size:12px">از: ' + NABZ._esc(x.fromHospital) + '</div>';
      if (x.toHospital) h += '<div style="font-size:12px">به: ' + NABZ._esc(x.toHospital) + '</div>';
      if (x.toService) h += '<div style="font-size:12px">سرویس: ' + NABZ._esc(x.toService) + '</div>';
      h += '<div style="font-size:12px">اولویت: ' + NABZ._esc(x.priority) + '</div>';
      if (x.reason) h += '<div style="font-size:12px;margin-top:6px"><b>دلیل:</b> ' + NABZ._esc(x.reason) + '</div>';
      if (x.diagnosis) h += '<div style="font-size:12px"><b>تشخیص:</b> ' + NABZ._esc(x.diagnosis) + '</div>';
      h += '</div>';
      if (x.status === 'pending_arrival' || x.status === 'pending_send') {
        h += '<div style="display:flex;gap:6px;margin-bottom:20px">';
        h += '<button class="btn btn-ok" style="flex:1;padding:12px;font-weight:900" onclick="NABZ.erfUI._updateReferralStatus(\'' + x.id + '\',\'' + (x.direction === 'incoming' ? 'arrived' : 'sent') + '\')">✅ تأیید</button>';
        h += '<button class="btn btn-dng" style="flex:1;padding:12px" onclick="NABZ.erfUI._updateReferralStatus(\'' + x.id + '\',\'cancelled\')">❌ لغو</button>';
        h += '</div>';
      }
      NABZ.erfUI._openSheet(h);
    };

    NABZ.erfUI._updateReferralStatus = async function(id, status) {
      try {
        await NABZ._api('/api/erf/referral/' + id, { method:'PUT', body: JSON.stringify({ status }) });
        NABZ._toast('✅ به‌روز شد');
        NABZ.erfUI._closeAll();
        NABZ.erfUI.showReferrals(null, null);
      } catch(e) { alert('خطا: ' + e.message); }
    };

    // ═══ pipeline (flow module) ═══
    if (NABZ.registerKind) {
      NABZ.registerKind('pipeline', function(p, d) {
        var m = document.getElementById('content');
        var h = '<div class="sec-hd"><span>' + (p.icon || '🔄') + ' ' + NABZ._esc(p.title) + '</span></div>';
        if (!d) { m.innerHTML = h + '<div class="empty">داده‌ای نیست</div>'; return; }
        var stages = [];
        if (Array.isArray(d.stages)) stages = d.stages;
        else if (Array.isArray(d.items)) stages = d.items;
        else if (d.pipeline && Array.isArray(d.pipeline.stages)) stages = d.pipeline.stages;

        if (!stages.length) {
          h += '<div class="card" style="text-align:center;padding:30px">';
          h += '<div style="font-size:36px">🔄</div>';
          h += '<div style="font-weight:900;margin-top:8px">پایپ‌لاین در حال کار است</div>';
          h += '<div style="font-size:12px;color:var(--fg-2);margin-top:6px">گام‌های بیمار در گردش کار درمان</div>';
          h += '</div>';
          h += '<details style="margin-top:12px"><summary style="cursor:pointer;padding:8px;font-size:11px;color:var(--fg-2)">📊 جزئیات</summary>';
          h += '<pre style="font-size:10px;background:var(--bg-2);padding:10px;border-radius:8px;overflow-x:auto;max-height:300px;margin-top:8px">' + NABZ._esc(JSON.stringify(d, null, 2)) + '</pre></details>';
        } else {
          h += '<div class="card"><div class="card-title">📊 مراحل گردش</div>';
          stages.forEach(function(s, i) {
            h += '<div style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg-2);border-radius:8px;margin-bottom:6px">';
            h += '<div style="width:28px;height:28px;background:var(--primary-soft);color:var(--primary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px">' + (i+1) + '</div>';
            h += '<div style="flex:1"><div style="font-size:12.5px;font-weight:800">' + NABZ._esc(s.label || s.name || s.title || ('مرحله ' + (i+1))) + '</div>';
            if (s.count !== undefined) h += '<div style="font-size:10.5px;color:var(--fg-2)">' + s.count + ' بیمار</div>';
            h += '</div></div>';
          });
          h += '</div>';
        }
        m.innerHTML = h;
      });
    }

    console.log('[missing-handlers] ✓ erf_prehospital + erf_referrals + pipeline');
  });
})();
