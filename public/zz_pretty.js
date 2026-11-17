// ═══════════════════════════════════════════════════════════
//  NABZ — Pretty renderer for order/item details
//  جایگزین نمایش JSON خام با لیبل فارسی
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var TYPE_FA = {
    medication:'دارو', lab:'آزمایش', paraclinical:'پاراکلینیک',
    imaging:'تصویربرداری', radiology:'تصویربرداری', nursing:'پرستاری',
    diet:'رژیم', consult:'مشاوره', procedure:'پروسیجر', transfusion:'تزریق خون'
  };
  var PRIORITY_FA = { routine:'روتین', urgent:'فوری', stat:'فوری STAT', emergency:'اورژانسی', high:'بالا', medium:'متوسط', low:'پایین', elective:'انتخابی' };
  var STATUS_FA = {
    pending:'در انتظار', verified:'تأیید شده', active:'فعال', completed:'تکمیل',
    cancelled:'لغو شده', scheduled:'زمان‌بندی', due:'موعد رسیده', given:'داده شده',
    missed:'از دست رفته', refused:'رد شده', ordered:'سفارش شده',
    collected:'نمونه گرفته', resulted:'نتیجه آماده', reported:'گزارش شده',
    dispensed:'تحویل شده', issued:'ارسال شده', transfused:'تزریق شده',
    crossmatched:'کراس‌مچ', requested:'درخواست', responded:'پاسخ داده', approved:'تأیید شده',
    in_care:'در مراقبت', admitted:'بستری', discharged:'ترخیص',
    open:'باز', closed:'بسته', draft:'پیش‌نویس', signed:'امضا شده', received:'دریافت شده'
  };
  var DETAIL_FA = {
    drug:'دارو', dose:'دوز', route:'مسیر', frequency:'تکرار', durationDays:'مدت (روز)',
    duration:'مدت', panel:'پنل آزمایش', panelCode:'کد پنل', modality:'مودالیتی',
    bodyPart:'ناحیه', indication:'اندیکاسیون', notes:'یادداشت', note:'یادداشت',
    diet:'رژیم', type:'نوع', severity:'شدت', reason:'دلیل', location:'محل',
    unit:'واحد', amount:'مقدار', isHighAlert:'High-Alert', prn:'PRN',
    site:'محل تجویز', quantity:'تعداد', bloodType:'گروه خونی',
    productType:'نوع فرآورده', units:'واحد', secondChecker:'چک‌کننده دوم'
  };
  var ROUTE_FA = { PO:'خوراکی', IV:'وریدی', IM:'عضلانی', SC:'زیرجلدی', SL:'زیرزبانی', PR:'مقعدی', topical:'موضعی', inhalation:'استنشاقی', IV_Infusion:'انفوزیون وریدی', Cont:'مداوم', once:'یک بار' };
  var FREQ_FA = { OD:'روزی ۱ بار', BID:'روزی ۲ بار', TID:'روزی ۳ بار', QID:'روزی ۴ بار', HS:'شب', Q6H:'هر ۶ ساعت', Q8H:'هر ۸ ساعت', Q12H:'هر ۱۲ ساعت', Q24H:'هر ۲۴ ساعت', Q4H:'هر ۴ ساعت', PRN:'در صورت نیاز', Cont:'مداوم', once:'یک بار', Q1H:'هر ۱ ساعت', 'Q6H PRN':'هر ۶ ساعت در صورت نیاز', 'Q8H PRN':'هر ۸ ساعت در صورت نیاز' };

  function val(k, v) {
    if (k === 'route') return ROUTE_FA[v] || v;
    if (k === 'frequency') return FREQ_FA[v] || v;
    if (k === 'isHighAlert') return v ? '⚠️ بله' : 'خیر';
    if (k === 'prn') return v ? 'بله' : 'خیر';
    if (typeof v === 'boolean') return v ? '✓' : '✗';
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
  }

  function prettyDetail(type, details) {
    if (!details || typeof details !== 'object') return '<span style="color:var(--fg-2)">—</span>';
    var h = '<div class="zz-pretty-detail">';
    // Primary field prominent
    if (details.drug) h += '<div class="zz-pretty-primary">' + NABZ._esc(details.drug) + '</div>';
    else if (details.panel) h += '<div class="zz-pretty-primary">' + NABZ._esc(details.panel) + '</div>';
    else if (details.note) h += '<div class="zz-pretty-primary">' + NABZ._esc(details.note) + '</div>';
    // Grid of fields
    var rows = [];
    Object.keys(details).forEach(function(k) {
      if (k === 'drug' || k === 'panel' || k === 'note') return;
      var label = DETAIL_FA[k] || k;
      var v = val(k, details[k]);
      if (v !== '—') rows.push([label, v]);
    });
    if (rows.length) {
      h += '<div class="zz-pretty-grid">';
      rows.forEach(function(r) {
        h += '<div class="zz-pretty-row"><span class="zz-pretty-lbl">' + NABZ._esc(r[0]) + ':</span><span class="zz-pretty-val">' + NABZ._esc(r[1]) + '</span></div>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function prettyField(key, value, item) {
    // Translate well-known fields
    if (key === 'type') return TYPE_FA[value] || value;
    if (key === 'priority') return PRIORITY_FA[value] || value;
    if (key === 'status' || key === 'state') return STATUS_FA[value] || value;
    if (key === 'codeStatus') return { full:'Full Code', dnr:'DNR', dni:'DNI' }[value] || value;
    if (key === 'sex') return { male:'مرد', female:'زن' }[value] || value;
    if (key === 'shiftType' || key === 'shift') return { morning:'صبح', evening:'عصر', night:'شب' }[value] || value;
    if (key === 'admissionType') return { elective:'انتخابی', emergency:'اورژانسی', transfer:'انتقالی' }[value] || value;
    if (key === 'details') return prettyDetail(item && item.type, value);
    if (key === 'recordedAt' || key === 'orderedAt' || key === 'createdAt' || key === 'updatedAt' || key === 'administeredAt' || key === 'scheduledAt' || key === 'verifiedAt' || key === 'signedAt' || key === 'closedAt' || key === 'admittedAt' || key === 'arrivalAt' || key === 'activatedAt' || key === 'submittedAt' || key === 'issuedAt' || key === 'dischargedAt' || key === 'startedAt' || key === 'completedAt' || key === 'reportedAt' || key === 'collectedAt' || key === 'resultedAt' || key === 'requestedAt' || key === 'respondedAt' || key === 'approvedAt' || key === 'filedAt' || key === 'plannedAt' || key === 'dueAt' || key === 'endAt') {
      try { return new Date(value).toLocaleString('fa-IR'); } catch (_) { return value; }
    }
    if (key === 'birthDate') { try { return new Date(value).toLocaleDateString('fa-IR'); } catch(_) { return value; } }
    if (Array.isArray(value)) {
      if (!value.length) return '—';
      return value.map(function(x) {
        if (typeof x === 'object') return JSON.stringify(x);
        return String(x);
      }).join('، ');
    }
    if (typeof value === 'object' && value !== null) return JSON.stringify(value);
    return String(value == null ? '—' : value);
  }

  function esc(s) { return NABZ._esc ? NABZ._esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }

  // ── Wrap showItem ──
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.showItem === 'function') return fn();
    if (++waitCount >= 50) return;
    setTimeout(function() { ready(fn); }, 100);
  }
  ready(function() {
    var origShowItem = NABZ.showItem;
    NABZ.showItem = async function(pid, iid) {
      // Intercept only list-type items (details rendering)
      var p = NABZ.state.panels.find(function(x) { return x.id === pid; });
      if (!p) return origShowItem.apply(NABZ, arguments);
      try {
        var d = await NABZ._api(p.api);
        var item = (d.items || []).find(function(x) { return x.id === iid; }) || d;
        if (!item || typeof item !== 'object') return origShowItem.apply(NABZ, arguments);

        // Build pretty sheet
        var sheet = document.createElement('div');
        sheet.className = 'bs-backdrop';
        sheet.onclick = function(e) { if (e.target === sheet) sheet.remove(); };
        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">' + (p.icon || '📄') + ' ' + esc(p.title) + '</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        html += '<div class="bs-body">';

        if (item && item.id && String(item.id).startsWith('pat_') && (item.firstName || item.mrn) && typeof window._renderClinicalCard === "function") {
          html += window._renderClinicalCard(item);
        } else {

        var ORDER = ['patientName', 'drugName', 'panelName', 'procedure', 'type', 'priority', 'status',
          'details', 'dose', 'route', 'frequency', 'wardCode', 'bedNumber',
          'scheduledAt', 'recordedAt', 'orderedAt', 'administeredAt',
          'firstName', 'lastName', 'age', 'sex', 'diagnosis', 'allergies',
          'news2', 'hr', 'bp_sys', 'bp_dia', 'rr', 'temp', 'spo2', 'gcs'];
        var DONE = { _trans: 1, lastSignatureId: 1 };
        var html2 = '';
        var shown = {};
        ORDER.forEach(function(k) {
          if (!(k in item)) return;
          if (DONE[k]) return;
          var v = item[k];
          if (v === null || v === '' || v === undefined) return;
          shown[k] = 1;
          if (k === 'details') { html2 += '<div class="bs-row"><div class="bs-key">جزئیات</div><div class="bs-val">' + prettyDetail(item.type, v) + '</div></div>'; return; }
          html2 += '<div class="bs-row"><div class="bs-key">' + (DETAIL_FA[k] || ({ patientName:'بیمار', drugName:'دارو', panelName:'پنل آزمایش', procedure:'پروسیجر', type:'نوع', priority:'اولویت', status:'وضعیت', dose:'دوز', route:'مسیر', frequency:'تکرار', wardCode:'بخش', bedNumber:'تخت', firstName:'نام', lastName:'نام خانوادگی', age:'سن', sex:'جنسیت', diagnosis:'تشخیص', allergies:'آلرژی', news2:'NEWS2', hr:'ضربان قلب', bp_sys:'فشار سیستولیک', bp_dia:'فشار دیاستولیک', rr:'تنفس', temp:'دما', spo2:'SpO2', gcs:'GCS' }[k]) || k) + '</div><div class="bs-val">' + esc(prettyField(k, v, item)) + '</div></div>';
        });
        // Remaining fields
        Object.keys(item).forEach(function(k) {
          if (shown[k] || DONE[k]) return;
          var v = item[k];
          if (v === null || v === '' || v === undefined) return;
          if (typeof v === 'object' && k === '_trans') return;
          html2 += '<div class="bs-row"><div class="bs-key">' + esc(DETAIL_FA[k] || k) + '</div><div class="bs-val">' + esc(prettyField(k, v, item)) + '</div></div>';
        });
        }
        if (typeof html2 !== "undefined") html += html2;
        html += '</div>';

        // Doc buttons (existing)
        try {
          var db = NABZ._docButtonsFor && NABZ._docButtonsFor(pid, item);
          if (db) html += db;
        } catch (_) {}

        // Actions
        try {
          var coll = p.api.split('/').filter(Boolean).pop();
          var acts = await NABZ._api('/api/actions/' + coll + '/' + iid);
          if (acts.items && acts.items.length) {
            html += '<div class="bs-hd" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);border-bottom:none;padding-bottom:8px"><div class="bs-title">⚡ اقدامات</div></div>';
            html += '<div id="bsActs" style="display:flex;flex-direction:column;gap:8px;padding:8px 16px;padding-bottom:20px">';
            for (var ai = 0; ai < acts.items.length; ai++) {
              var a = acts.items[ai];
              html += '<button class="btn" data-idx="' + ai + '" style="padding:14px;font-size:13px;background:var(--grad-primary);color:#fff;border:none" onclick="NABZ.runAction(this,\'' + iid + '\',\'' + pid + '\',\'' + coll + '\')">' + esc(a.label) + '</button>';
            }
            html += '</div>';
            window._bsActions = acts.items;
          }
        } catch (_) {}

        var c = document.createElement('div');
        c.className = 'bs-sheet';
        c.innerHTML = html;
        sheet.appendChild(c);
        document.body.appendChild(sheet);
        requestAnimationFrame(function() { sheet.classList.add('show'); });
      } catch (e) {
        return origShowItem.apply(NABZ, arguments);
      }
    };
    console.log('[zz-pretty] showItem rewritten ✓');
  });
})();
