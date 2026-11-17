// ═══════════════════════════════════════════════════════════
//  NABZ — Clinical Workflow UI
//  Lab entry + view, Imaging report + view, Patient timeline
//  ⚠️  فقط frontend — endpoint‌های موجود را استفاده می‌کند
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var CW = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _time: function(iso) {
      if (!iso) return '—';
      try { return new Date(iso).toLocaleString('fa-IR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); }
      catch (_) { return '—'; }
    },
    _closeAll: function() {
      document.querySelectorAll('.bs-backdrop').forEach(function(e) { e.remove(); });
    },
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

    // ═══════════════════════════════════════════════════
    //  LAB — Entry (تکنسین)
    // ═══════════════════════════════════════════════════
    enterLabResult: async function(labId) {
      try {
        var d = await CW._api('/api/para/labs?status=' + 'collected').catch(function() { return { items: [] }; });
        var lab = (d.items || []).find(function(x) { return x.id === labId; });
        if (!lab) {
          // مستقیم از API پیدا کن
          var all = await CW._api('/api/para/labs');
          lab = (all.items || []).find(function(x) { return x.id === labId; });
        }
        if (!lab) return alert('آزمایش یافت نشد');
        if (lab.status !== 'collected' && lab.status !== 'resulted') {
          return alert('آزمایش در وضعیت ' + lab.status + ' است — فقط collected نتیجه می‌گیرد');
        }

        var tests = lab.tests || [
          { code: 'WBC', critLow: 4, critHigh: 12, unit: '×10³/µL' },
          { code: 'Hgb', critLow: 7, critHigh: 18, unit: 'g/dL' },
          { code: 'Hct', critLow: 21, critHigh: 54, unit: '%' },
          { code: 'Plt', critLow: 50, critHigh: 1000, unit: '×10³/µL' },
          { code: 'BUN', critLow: 5, critHigh: 100, unit: 'mg/dL' },
          { code: 'Cr', critLow: 0.4, critHigh: 4, unit: 'mg/dL' },
          { code: 'Na', critLow: 120, critHigh: 160, unit: 'mEq/L' },
          { code: 'K', critLow: 2.5, critHigh: 6.5, unit: 'mEq/L' },
          { code: 'Glucose', critLow: 40, critHigh: 500, unit: 'mg/dL' }
        ];

        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">🧪 ورود نتیجه — ' + CW._esc(lab.panelName) + '</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        html += '<div class="card" style="margin-bottom:12px;background:var(--primary-soft)">';
        html += '<div style="font-weight:900">' + CW._esc(lab.patientName) + '</div>';
        html += '<div style="font-size:11.5px;color:var(--fg-2)">' + CW._esc(lab.wardCode) + ' · ' + CW._esc(lab.priority) + ' · ' + CW._esc(lab.panelCode) + '</div>';
        html += '</div>';
        html += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">';
        for (var t of tests) {
          var code = t.code;
          var unit = t.unit || '';
          html += '<div class="cw-test-row" data-code="' + code + '" data-low="' + (t.critLow || '') + '" data-high="' + (t.critHigh || '') + '">';
          html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">';
          html += '<label style="font-size:12px;font-weight:900">' + CW._esc(code) + '</label>';
          html += '<span style="font-size:10px;color:var(--fg-2)">' + CW._esc(unit) + (t.critLow ? ' · ' + t.critLow + '-' + t.critHigh : '') + '</span>';
          html += '</div>';
          html += '<input type="number" step="any" class="cw-test-input" data-code="' + code + '" placeholder="مقدار" style="width:100%;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:8px;color:var(--fg);font-size:14px;font-weight:900;outline:none">';
          html += '</div>';
        }
        html += '</div>';
        html += '<button class="btn btn-primary btn-block" style="padding:14px;font-size:14px" onclick="NABZ.cw._submitLabResult(\'' + lab.id + '\')">✅ ثبت نتیجه</button>';
        CW._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _submitLabResult: async function(labId) {
      var inputs = document.querySelectorAll('.cw-test-input');
      var values = {};
      var criticals = [];
      var hasValue = false;
      inputs.forEach(function(inp) {
        var v = parseFloat(inp.value);
        if (isNaN(v)) return;
        hasValue = true;
        values[inp.dataset.code] = v;
        var row = inp.closest('.cw-test-row');
        var low = parseFloat(row.dataset.low);
        var high = parseFloat(row.dataset.high);
        if (!isNaN(low) && v < low) criticals.push(inp.dataset.code + ' ↓ ' + v);
        if (!isNaN(high) && v > high) criticals.push(inp.dataset.code + ' ↑ ' + v);
      });
      if (!hasValue) return alert('حداقل یک مقدار وارد کنید');

      if (criticals.length > 0) {
        var proceed = confirm('⚠️ مقادیر بحرانی:\n' + criticals.join('\n') + '\n\nادامه؟');
        if (!proceed) return;
      }

      try {
        await CW._api('/api/para/labs/' + labId + '/result', {
          method: 'POST',
          body: JSON.stringify({ values: values })
        });
        NABZ._toast('✅ نتیجه ثبت شد' + (criticals.length ? ' — ' + criticals.length + ' بحرانی' : ''));
        CW._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  LAB — View (پزشک)
    // ═══════════════════════════════════════════════════
    viewLab: async function(labId) {
      try {
        var all = await CW._api('/api/para/labs');
        var lab = (all.items || []).find(function(x) { return x.id === labId; });
        if (!lab) return alert('آزمایش یافت نشد');

        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">🧪 ' + CW._esc(lab.panelName) + ' — ' + CW._esc(lab.patientName) + '</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        var statusMap = { ordered:'سفارش‌شده', collected:'نمونه گرفته', resulted:'نتیجه آماده', verified:'تأیید' };
        var statusCls = { ordered:'info', collected:'warn', resulted:'warn', verified:'ok' };
        html += '<div style="margin-bottom:10px"><span class="pill ' + (statusCls[lab.status] || 'info') + '">' + (statusMap[lab.status] || lab.status) + '</span></div>';

        html += '<div class="card" style="margin-bottom:12px">';
        html += '<div style="font-size:12px;color:var(--fg-2)">بخش: ' + CW._esc(lab.wardCode) + ' · اولویت: ' + CW._esc(lab.priority) + '</div>';
        html += '<div style="font-size:12px;color:var(--fg-2);margin-top:2px">سفارش: ' + CW._time(lab.orderedAt) + '</div>';
        if (lab.collectedAt) html += '<div style="font-size:12px;color:var(--fg-2)">نمونه: ' + CW._time(lab.collectedAt) + '</div>';
        if (lab.resultedAt) html += '<div style="font-size:12px;color:var(--fg-2)">نتیجه: ' + CW._time(lab.resultedAt) + '</div>';
        html += '</div>';

        if (lab.results && Object.keys(lab.results).length) {
          html += '<div class="card" style="margin-bottom:12px"><div class="card-title">📊 نتایج</div>';
          var tests = lab.tests || [];
          for (var code in lab.results) {
            var v = lab.results[code];
            var test = tests.find(function(x) { return x.code === code; }) || {};
            var low = test.critLow, high = test.critHigh;
            var isCrit = (low != null && v < low) || (high != null && v > high);
            var cls = isCrit ? 'color:var(--dng);font-weight:900' : '';
            var badge = isCrit ? ' <span class="pill dng" style="font-size:9px">بحرانی</span>' : '';
            html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">';
            html += '<span>' + CW._esc(code) + '</span>';
            html += '<span style="' + cls + '">' + v + badge + '</span>';
            html += '</div>';
          }
          html += '</div>';
        }

        if (lab.criticalFlags && lab.criticalFlags.length) {
          html += '<div class="card" style="border-color:var(--dng);background:var(--dng-soft);margin-bottom:12px">';
          html += '<div class="card-title" style="color:var(--dng)">⚠️ ' + lab.criticalFlags.length + ' مقدار بحرانی</div>';
          for (var cf of lab.criticalFlags) {
            html += '<div style="font-size:12px;padding:2px 0">' + CW._esc(cf.test) + ': ' + cf.value + ' (' + (cf.type === 'low' ? 'کم' : 'زیاد') + ')</div>';
          }
          html += '</div>';
        }

        html += '<div style="display:flex;gap:6px;margin-top:12px;margin-bottom:20px">';
        if (lab.status === 'collected') {
          html += '<button class="btn btn-primary" style="flex:1;padding:12px" onclick="NABZ.cw.enterLabResult(\'' + lab.id + '\')">🧪 ورود نتیجه</button>';
        }
        if (lab.status === 'resulted') {
          html += '<button class="btn btn-ok" style="flex:1;padding:12px" onclick="NABZ.cw._verifyLab(\'' + lab.id + '\')">✅ تأیید</button>';
        }
        html += '<button class="btn" style="flex:1;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        html += '</div>';
        CW._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _verifyLab: async function(labId) {
      try {
        await CW._api('/api/para/labs/' + labId + '/verify', { method:'POST', body: '{}' });
        NABZ._toast('✅ تأیید شد');
        CW._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  IMAGING — Report (رادیولوژیست)
    // ═══════════════════════════════════════════════════
    enterImagingReport: async function(imagingId) {
      try {
        var d = await CW._api('/api/para/radiology');
        var img = (d.items || []).find(function(x) { return x.id === imagingId; });
        if (!img) return alert('تصویربرداری یافت نشد');

        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">🩻 گزارش — ' + CW._esc(img.modality) + ' ' + CW._esc(img.bodyPart) + '</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        html += '<div class="card" style="margin-bottom:12px;background:var(--primary-soft)">';
        html += '<div style="font-weight:900">' + CW._esc(img.patientName) + '</div>';
        html += '<div style="font-size:11.5px;color:var(--fg-2)">' + CW._esc(img.wardCode) + ' · ' + CW._esc(img.indication || '') + '</div>';
        html += '</div>';
        html += '<div class="cw-field" style="margin-bottom:10px"><label style="display:block;font-size:11px;font-weight:700;color:var(--fg-2);margin-bottom:4px">یافته‌ها</label>';
        html += '<textarea id="imgFindings" rows="4" style="width:100%;padding:10px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:8px;color:var(--fg);font-family:inherit;font-size:13px;outline:none"></textarea></div>';
        html += '<div class="cw-field" style="margin-bottom:10px"><label style="display:block;font-size:11px;font-weight:700;color:var(--fg-2);margin-bottom:4px">تفسیر نهایی</label>';
        html += '<textarea id="imgImpression" rows="3" style="width:100%;padding:10px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:8px;color:var(--fg);font-family:inherit;font-size:13px;outline:none"></textarea></div>';
        html += '<label style="display:flex;gap:8px;align-items:center;padding:10px;background:var(--dng-soft);border-radius:8px;font-size:12px;margin-bottom:12px">';
        html += '<input type="checkbox" id="imgCritical" style="width:18px;height:18px">';
        html += '<span><b>یافته بحرانی</b> — نیاز به اطلاع فوری پزشک</span>';
        html += '</label>';
        html += '<button class="btn btn-primary btn-block" style="padding:14px;font-size:14px" onclick="NABZ.cw._submitImagingReport(\'' + img.id + '\')">✅ ثبت گزارش</button>';
        CW._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _submitImagingReport: async function(imgId) {
      var findings = document.getElementById('imgFindings').value;
      var impression = document.getElementById('imgImpression').value;
      var critical = document.getElementById('imgCritical').checked;
      if (!findings) return alert('یافته‌ها الزامی است');
      try {
        await CW._api('/api/para/radiology/' + imgId + '/report', {
          method: 'POST',
          body: JSON.stringify({ findings: findings, impression: impression, criticalFlag: critical })
        });
        NABZ._toast(critical ? '🚨 گزارش بحرانی ثبت شد' : '✅ گزارش ثبت شد');
        CW._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  IMAGING — View (پزشک)
    // ═══════════════════════════════════════════════════
    viewImaging: async function(imagingId) {
      try {
        var d = await CW._api('/api/para/radiology');
        var img = (d.items || []).find(function(x) { return x.id === imagingId; });
        if (!img) return alert('تصویربرداری یافت نشد');

        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">🩻 ' + CW._esc(img.modality) + ' ' + CW._esc(img.bodyPart) + ' — ' + CW._esc(img.patientName) + '</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        var statusMap = { ordered:'سفارش', reported:'گزارش شده', verified:'تأیید' };
        var statusCls = { ordered:'info', reported:'warn', verified:'ok' };
        html += '<div style="margin-bottom:10px"><span class="pill ' + (statusCls[img.status] || 'info') + '">' + (statusMap[img.status] || img.status) + '</span>';
        if (img.criticalFlag) html += ' <span class="pill dng">🚨 بحرانی</span>';
        html += '</div>';

        html += '<div class="card" style="margin-bottom:12px">';
        html += '<div style="font-size:12px;color:var(--fg-2)">اندیکاسیون: ' + CW._esc(img.indication || '—') + '</div>';
        html += '<div style="font-size:12px;color:var(--fg-2)">سفارش: ' + CW._time(img.orderedAt) + '</div>';
        if (img.reportedAt) html += '<div style="font-size:12px;color:var(--fg-2)">گزارش: ' + CW._time(img.reportedAt) + '</div>';
        html += '</div>';

        if (img.findings) {
          html += '<div class="card" style="margin-bottom:12px"><div class="card-title">📋 یافته‌ها</div>';
          html += '<div style="font-size:12.5px;white-space:pre-wrap">' + CW._esc(img.findings) + '</div></div>';
        }
        if (img.impression) {
          html += '<div class="card" style="margin-bottom:12px"><div class="card-title">🎯 تفسیر</div>';
          html += '<div style="font-size:12.5px;white-space:pre-wrap">' + CW._esc(img.impression) + '</div></div>';
        }

        html += '<div style="display:flex;gap:6px;margin-top:12px;margin-bottom:20px">';
        if (img.status === 'ordered') {
          html += '<button class="btn btn-primary" style="flex:1;padding:12px" onclick="NABZ.cw.enterImagingReport(\'' + img.id + '\')">📝 گزارش</button>';
        }
        if (img.status === 'reported') {
          html += '<button class="btn btn-ok" style="flex:1;padding:12px" onclick="NABZ.cw._verifyImaging(\'' + img.id + '\')">✅ تأیید</button>';
        }
        html += '<button class="btn" style="flex:1;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        html += '</div>';
        CW._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _verifyImaging: async function(id) {
      try {
        await CW._api('/api/para/radiology/' + id + '/verify', { method:'POST', body: '{}' });
        NABZ._toast('✅ تأیید شد');
        CW._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  PATIENT TIMELINE
    // ═══════════════════════════════════════════════════
    timeline: async function(patientId) {
      if (!patientId) {
        // pick patient
        var patients = await CW._api('/api/clinical/patients').catch(function() { return { items: [] }; });
        var active = (patients.items || []).filter(function(p) { return ['in_care','admitted'].indexOf(p.status) >= 0; });
        if (!active.length) return alert('بیماری بستری نیست');
        var pick = await new Promise(function(resolve) {
          var html = '<div class="bs-handle"></div>';
          html += '<div class="bs-hd"><div class="bs-title">👤 بیمار</div>';
          html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
          html += '<div class="bs-body">';
          active.forEach(function(p) {
            html += '<button class="btn" style="width:100%;text-align:right;padding:12px;margin-bottom:4px" onclick="window._cwPick(\'' + p.id + '\')">';
            html += '<b>' + NABZ._esc(p.firstName + ' ' + p.lastName) + '</b><br>';
            html += '<small style="color:var(--fg-2)">' + NABZ._esc(p.wardCode) + ' · ' + NABZ._esc(p.diagnosis || '') + '</small></button>';
          });
          html += '</div>';
          CW._openSheet(html);
          window._cwPick = function(pid) { CW._closeAll(); resolve(pid); };
        });
        patientId = pick;
        if (!patientId) return;
      }

      try {
        NABZ._toast('در حال ساخت تایملاین...');
        // جمع‌آوری همه وقایع از collection‌های مختلف
        var results = await Promise.all([
          CW._api('/api/clinical/patients/' + patientId).catch(function() { return null; }),
          CW._api('/api/clinical/vitals?patientId=' + patientId).catch(function() { return { items: [] }; }),
          CW._api('/api/clinical/orders?patientId=' + patientId).catch(function() { return { items: [] }; }),
          CW._api('/api/clinical/mar?patientId=' + patientId).catch(function() { return { items: [] }; }),
          CW._api('/api/para/labs').catch(function() { return { items: [] }; }),
          CW._api('/api/para/radiology').catch(function() { return { items: [] }; }),
          CW._api('/api/wf/consults').catch(function() { return { items: [] }; }),
          CW._api('/api/enc/rounds?patientId=' + patientId).catch(function() { return { items: [] }; }),
          CW._api('/api/enc/procedures?patientId=' + patientId).catch(function() { return { items: [] }; }),
          CW._api('/api/enc/pathway-instances?patientId=' + patientId).catch(function() { return { items: [] }; })
        ]);

        var patient = results[0] && results[0].patient;
        if (!patient) return alert('بیمار یافت نشد');
        var vitals = (results[1].items || []).filter(function(x) { return x.patientId === patientId; });
        var orders = (results[2].items || []).filter(function(x) { return x.patientId === patientId; });
        var mar = (results[3].items || []).filter(function(x) { return x.patientId === patientId; });
        var labs = (results[4].items || []).filter(function(x) { return x.patientId === patientId; });
        var rads = (results[5].items || []).filter(function(x) { return x.patientId === patientId; });
        var consults = (results[6].items || []).filter(function(x) { return x.patientId === patientId; });
        var rounds = (results[7].items || []).filter(function(x) { return x.patientId === patientId; });
        var procs = (results[8].items || []).filter(function(x) { return x.patientId === patientId; });
        var pathways = (results[9].items || []).filter(function(x) { return x.patientId === patientId; });

        // ترکیب و مرتب‌سازی
        var events = [];
        function add(type, icon, title, timeStr, detail, color) {
          if (!timeStr) return;
          events.push({ type:type, icon:icon, title:title, at:timeStr, detail:detail||'', color:color||'' });
        }

        vitals.forEach(function(v) {
          add('vital', '📈', 'ویتال NEWS2=' + (v.news2 || '?'),
            v.recordedAt, 'HR ' + (v.hr||'—') + ' · BP ' + (v.bp_sys||'—') + '/' + (v.bp_dia||'—') + ' · SpO₂ ' + (v.spo2||'—') + '%',
            v.news2 >= 7 ? 'dng' : v.news2 >= 5 ? 'warn' : '');
        });

        orders.forEach(function(o) {
          add('order', '💊', (o.type === 'medication' ? 'دستور دارو: ' + (o.details && o.details.drug || '') : 'دستور: ' + o.type),
            o.orderedAt, 'وضعیت: ' + o.status + (o.priority === 'stat' ? ' · STAT' : ''),
            o.priority === 'stat' ? 'dng' : '');
        });

        mar.forEach(function(m) {
          add('mar', '💉', m.drugName + ' — ' + (m.status === 'given' ? 'توزیع' : m.status === 'missed' ? 'missed' : m.status),
            m.administeredAt || m.scheduledAt, m.dose + ' ' + m.route,
            m.status === 'missed' ? 'dng' : '');
        });

        labs.forEach(function(l) {
          add('lab', '🧪', 'آزمایش ' + l.panelName + ' — ' + l.status,
            l.resultedAt || l.collectedAt || l.orderedAt,
            l.criticalFlags && l.criticalFlags.length ? '⚠️ ' + l.criticalFlags.length + ' بحرانی' : '',
            l.criticalFlags && l.criticalFlags.length ? 'dng' : '');
        });

        rads.forEach(function(r) {
          add('imaging', '🩻', r.modality + ' ' + r.bodyPart + ' — ' + r.status,
            r.reportedAt || r.orderedAt,
            r.criticalFlag ? '🚨 بحرانی' : (r.impression || ''),
            r.criticalFlag ? 'dng' : '');
        });

        consults.forEach(function(c) {
          add('consult', '🩺', 'مشاوره ' + c.targetService + ' — ' + c.status,
            c.respondedAt || c.requestedAt,
            c.question || '',
            c.consultType === 'emergency' ? 'dng' : '');
        });

        rounds.forEach(function(r) {
          add('round', '📝', 'راند (' + r.subtype + ') — ' + r.authorName,
            r.signedAt || r.createdAt,
            (r.subjective && r.subjective.chiefComplaint) || '',
            r.status === 'pending_cosign' ? 'warn' : '');
        });

        procs.forEach(function(p) {
          add('proc', p.icon || '💉', p.typeLabel + ' — ' + p.status,
            p.completedAt || p.startAt || p.createdAt,
            (p.note && p.note.findings) || '',
            p.status === 'completed' ? 'ok' : '');
        });

        pathways.forEach(function(pi) {
          add('pathway', pi.icon || '🛤️', pi.pathwayName + ' — ' + pi.status,
            pi.startAt,
            (pi.milestones || []).filter(function(m) { return m.done; }).length + '/' + (pi.milestones || []).length + ' انجام',
            pi.status === 'completed' ? 'ok' : '');
        });

        // مرتب نزولی
        events.sort(function(a, b) { return new Date(b.at) - new Date(a.at); });
        // حداکثر ۱۰۰
        events = events.slice(0, 100);

        var html = '<div class="bs-handle"></div>';
        html += '<div class="bs-hd"><div class="bs-title">📋 تایملاین — ' + CW._esc(patient.firstName + ' ' + patient.lastName) + '</div>';
        html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        html += '<div style="font-size:11.5px;color:var(--fg-2);margin-bottom:12px">' + CW._esc(patient.wardCode) + ' · تخت ' + CW._esc(patient.bedNumber || '—') + ' · ' + (patient.age || '—') + ' سال · ' + CW._esc(patient.diagnosis || '') + '</div>';

        if (events.length === 0) {
          html += '<div class="empty">واقعه‌ای ثبت نشده</div>';
        } else {
          html += '<div class="cw-timeline">';
          for (var ev of events) {
            var cls = ev.color ? 'color:var(--' + ev.color + ')' : '';
            html += '<div class="cw-tl-item" style="' + cls + '">';
            html += '<div class="cw-tl-dot">' + ev.icon + '</div>';
            html += '<div class="cw-tl-body">';
            html += '<div class="cw-tl-title">' + CW._esc(ev.title) + '</div>';
            if (ev.detail) html += '<div class="cw-tl-detail">' + CW._esc(ev.detail) + '</div>';
            html += '<div class="cw-tl-time">' + CW._time(ev.at) + '</div>';
            html += '</div>';
            html += '</div>';
          }
          html += '</div>';
        }
        CW._openSheet(html);
      } catch (e) { alert('خطا: ' + e.message); }
    }
  };

  // ═══════════════════════════════════════════════════════
  //  Bootstrap
  // ═══════════════════════════════════════════════════════
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 50) return console.warn('[cw-ui] timeout');
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.cw = CW;

    // Wrap showItem
    var origShowItem = NABZ.showItem;
    NABZ.showItem = function(pid, iid) {
      if (pid === 'paraclinical.labs') return CW.viewLab(iid);
      if (pid === 'paraclinical.radiology') return CW.viewImaging(iid);
      return origShowItem.apply(NABZ, arguments);
    };

    // Wrap _docButtonsFor برای دکمه تایملاین
    var origDocBtns = NABZ._docButtonsFor;
    NABZ._docButtonsFor = function(pid, item) {
      var orig = origDocBtns.apply(NABZ, arguments) || '';
      if (pid === 'clinical.patients' && item && item.id) {
        var tl = '<div style="margin-top:8px"><button class="btn btn-block" style="background:var(--violet-soft);color:var(--violet);border-color:var(--violet);padding:10px;font-size:12px" onclick="NABZ.cw.timeline(\'' + item.id + '\')">📋 تایملاین بیمار</button></div>';
        return orig + tl;
      }
      return orig;
    };

    // FAB برای پنل‌های lab/imaging
    var fab = document.createElement('button');
    fab.id = 'cwFab';
    fab.style.cssText = 'position:fixed;bottom:calc(var(--nav-h,72px) + 20px);left:20px;padding:14px 20px;background:linear-gradient(135deg,#06b6d4,#0891b2);color:#fff;border:none;border-radius:30px;font-family:inherit;font-size:13px;font-weight:900;box-shadow:0 4px 20px rgba(6,182,212,0.5);cursor:pointer;z-index:45;display:none;align-items:center;gap:6px';
    document.body.appendChild(fab);

    var FAB_MAP = {
      'clinical.patients': { label: '📋 تایملاین', fn: function() { CW.timeline(); } }
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

    console.log('[cw-ui] loaded ✓ — labs, imaging, timeline');
  });
})();
