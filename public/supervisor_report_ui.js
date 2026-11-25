// public/supervisor_report_ui.js — v3 final (auto-fill + grid tabs + shiftType)
(function() {
  'use strict';
  if (window.__srUIv3) return;
  window.__srUIv3 = true;

  var SECTIONS = [
    { id: 'A', label: 'سربرگ', icon: '📋', fields: [
      { key: 'date', label: 'تاریخ', type: 'date' },
      { key: 'shiftType', label: 'شیفت', type: 'select', options: [['morning','صبح'],['evening','عصر'],['night','شب']] },
      { key: 'supervisorName', label: 'نام سوپروایزر', type: 'text' }
    ]},
    { id: 'B', label: 'نیروی انسانی', icon: '👥', arrays: [
      { key: 'absentStaff', label: 'غیبت', icon: '🚫', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'role', label: 'نقش' }, { key: 'reason', label: 'علت' }, { key: 'replacement', label: 'جانشین' }] },
      { key: 'sickLeave', label: 'استعلاجی', icon: '🤒', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'role', label: 'نقش' }, { key: 'fromDate', label: 'از', type: 'date' }, { key: 'toDate', label: 'تا', type: 'date' }, { key: 'documented', label: 'گواهی', type: 'select', options: ['بله','خیر','در انتظار'] }] },
      { key: 'staffTransfers', label: 'جابجایی', icon: '🔄', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'from', label: 'از بخش' }, { key: 'to', label: 'به بخش' }, { key: 'reason', label: 'علت' }] }
    ]},
    { id: 'C', label: 'بیماران خاص', icon: '🏥', arrays: [
      { key: 'intubated', label: 'اینتوبه', icon: '🫁', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'ward', label: 'بخش' }, { key: 'ventNo', label: 'شماره ونتیلاتور' }, { key: 'intubationDate', label: 'تاریخ', type: 'date' }, { key: 'readyForWeaning', label: 'قائمت‌سازی' }] },
      { key: 'icuWaiting', label: 'منتظر ICU', icon: '⏳', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'ward', label: 'بخش' }, { key: 'since', label: 'از ساعت' }, { key: 'currentBed', label: 'تخت' }] },
      { key: 'needsSpecialCare', label: 'مراقبت‌های موردی', icon: '💧', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'careType', label: 'نوع' }, { key: 'ward', label: 'بخش' }, { key: 'time', label: 'ساعت', type: 'time' }] },
      { key: 'dialysis', label: 'دیالیز', icon: '💧', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'ward', label: 'بخش' }, { key: 'session', label: 'نوبت' }] },
      { key: 'plasmapheresis', label: 'پلاسمافرزیس', icon: '🧬', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'ward', label: 'بخش' }] },
      { key: 'endoscopy', label: 'آندوسکوپی', icon: '🔬', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'ward', label: 'بخش' }] },
      { key: 'sleepTest', label: 'تست خواب', icon: '😴', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'ward', label: 'بخش' }] }
    ]},
    { id: 'D', label: 'کدها', icon: '🚨', fields: [
      { key: 'code99Count', label: 'کد ۹۹ (CPR)', type: 'number', min: 0 },
      { key: 'code247Count', label: 'کد ۲۴۷ (STEMI)', type: 'number', min: 0 },
      { key: 'code724Count', label: 'کد ۷۲۴ (Stroke)', type: 'number', min: 0 }
    ], arrays: [
      { key: 'deaths24h', label: 'فوتی ۲۴ ساعت', icon: '⚰️', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'mrn', label: 'MRN' }, { key: 'ward', label: 'بخش' }, { key: 'cprTime', label: 'ساعت CPR', type: 'time' }, { key: 'deathTime', label: 'ساعت فوت', type: 'time' }, { key: 'cause', label: 'علت' }, { key: 'certIssued', label: 'گواهی' }] }
    ]},
    { id: 'E', label: 'گروه‌های پرخطر', icon: '⚠️', arrays: [
      { key: 'highRiskMothers', label: 'مادر پرخطر', icon: '🤰', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'ward', label: 'بخش' }, { key: 'reason', label: 'علت' }] },
      { key: 'highRiskChildren', label: 'کودک پرخطر', icon: '👶', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'ward', label: 'بخش' }, { key: 'reason', label: 'علت' }] },
      { key: 'fallRisk', label: 'خطر سقوط', icon: '🚶', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'ward', label: 'بخش' }, { key: 'morseScore', label: 'Morse', type: 'number' }] },
      { key: 'suicideRisk', label: 'خودکشی', icon: '🛡', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'ward', label: 'بخش' }, { key: 'assessment', label: 'ارزیابی' }] },
      { key: 'pressureUlcer', label: 'زخم فشاری', icon: '🩹', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'ward', label: 'بخش' }, { key: 'bradenScore', label: 'Braden', type: 'number' }] },
      { key: 'seizure', label: 'تشنج', icon: '🧠', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'ward', label: 'بخش' }] },
      { key: 'malnutrition', label: 'سوءتغذیه', icon: '🍽', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'ward', label: 'بخش' }] },
      { key: 'unknownIdentity', label: 'مجهول‌الهویه', icon: '❓', fields: [{ key: 'name', label: 'شناسه', required: true }, { key: 'ward', label: 'بخش' }] },
      { key: 'homeless', label: 'بی‌خانمان', icon: '🏚', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'ward', label: 'بخش' }] }
    ]},
    { id: 'F', label: 'عفونی', icon: '🦠', fields: [
      { key: 'covidSuspectedCount', label: 'مشکوک کرونا', type: 'number', min: 0 },
      { key: 'nhSuspectedCount', label: 'مشکوک NH', type: 'number', min: 0 }
    ], arrays: [
      { key: 'covidConfirmed', label: 'مثبت کرونا', icon: '🦠', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'ward', label: 'بخش' }, { key: 'swabDate', label: 'تاریخ سواب', type: 'date' }, { key: 'pcrCt', label: 'PCR Ct' }] },
      { key: 'nhConfirmed', label: 'مثبت NH', icon: '🧪', fields: [{ key: 'name', label: 'نام', required: true }, { key: 'ward', label: 'بخش' }, { key: 'swabDate', label: 'تاریخ سواب', type: 'date' }] }
    ]},
    { id: 'G', label: 'وقایع', icon: '📋', arrays: [
      { key: 'unexpectedEvents', label: 'حوادث غیرمترقبه', icon: '⚠️', fields: [{ key: 'type', label: 'نوع', required: true }, { key: 'severity', label: 'شدت', type: 'select', options: ['minor','moderate','major','critical','sentinel'] }, { key: 'ward', label: 'بخش' }, { key: 'description', label: 'شرح' }] },
      { key: 'nearMisses', label: 'ناخواسته', icon: '💭', fields: [{ key: 'type', label: 'نوع' }, { key: 'ward', label: 'بخش' }, { key: 'description', label: 'شرح' }] },
      { key: 'referrals', label: 'اعزام', icon: '🚑', fields: [{ key: 'patientName', label: 'بیمار' }, { key: 'to', label: 'به' }, { key: 'reason', label: 'علت' }, { key: 'time', label: 'ساعت', type: 'time' }] },
      { key: 'internalReferrals', label: 'ارجاع داخلی', icon: '↩️', fields: [{ key: 'patientName', label: 'بیمار' }, { key: 'to', label: 'به بخش' }, { key: 'reason', label: 'علت' }] },
      { key: 'visits', label: 'بازدید', icon: '👥', fields: [{ key: 'visitor', label: 'بازدیدکننده' }, { key: 'purpose', label: 'هدف' }, { key: 'time', label: 'ساعت', type: 'time' }] },
      { key: 'doorOpenings', label: 'باز شدن درب', icon: '🚪', fields: [{ key: 'door', label: 'درب' }, { key: 'time', label: 'ساعت', type: 'time' }, { key: 'reason', label: 'علت' }] }
    ]},
    { id: 'H', label: 'تاسیسات', icon: '🔧', fields: [
      { key: 'availableVentsCount', label: 'ونتیلاتور آزاد', type: 'number', min: 0 }
    ], arrays: [
      { key: 'equipmentFailures', label: 'خرابی دستگاه', icon: '🔧', fields: [{ key: 'device', label: 'دستگاه', required: true }, { key: 'ward', label: 'بخش' }, { key: 'issue', label: 'مشکل' }, { key: 'actionTaken', label: 'اقدام' }] }
    ]},
    { id: 'I', label: 'تجمیعی', icon: '📊', fields: [
      { key: 'totalPatients', label: 'جمع بیماران', type: 'number', min: 0 },
      { key: 'morseSum', label: 'جمع Morse', type: 'number', min: 0 },
      { key: 'bradenSum', label: 'جمع Braden', type: 'number', min: 0 },
      { key: 'medsNarcotics', label: 'مصرف دارو/مخدر', type: 'textarea' }
    ]},
    { id: 'J', label: 'امضا', icon: '✍️', fields: [
      { key: 'nursingOfficeSignature', label: 'دفتر پرستاری', type: 'text' },
      { key: 'supervisorSignature', label: 'امضای سوپروایزر', type: 'text' }
    ]}
  ];

  function injectCSS() {
    if (document.getElementById('sr-style-v3')) return;
    var st = document.createElement('style');
    st.id = 'sr-style-v3';
    st.textContent =
      '.sr-wrap{direction:rtl;background:#eef2f8;min-height:100vh;padding-bottom:90px;font-family:Vazirmatn,Tahoma,sans-serif;color:#0f172a}' +
      '.sr-hd{position:sticky;top:0;z-index:10;background:linear-gradient(135deg,#1e4d8c,#0f172a);color:#fff;padding:12px 14px;box-shadow:0 4px 20px rgba(15,23,42,.2)}' +
      '.sr-hd-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px}' +
      '.sr-hd-t{font-size:15px;font-weight:900;flex:1;min-width:0}' +
      '.sr-hd-btns{display:flex;gap:6px;flex-shrink:0}' +
      '.sr-hd-btn{background:rgba(255,255,255,.15);border:none;color:#fff;padding:7px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer}' +
      '.sr-hd-btn.autofill{background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 2px 8px rgba(16,185,129,.4)}' +
      '.sr-hd-meta{font-size:10.5px;opacity:.85;display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px}' +
      '.sr-progress{height:5px;background:rgba(255,255,255,.15);border-radius:3px;overflow:hidden}' +
      '.sr-progress-in{height:100%;background:linear-gradient(90deg,#10b981,#34d399);transition:width .3s}' +
      '.sr-progress-lbl{font-size:10px;margin-top:3px;opacity:.85}' +
      '.sr-tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:8px 10px;background:#fff;position:sticky;top:92px;z-index:9;border-bottom:1px solid #e2e8f0}' +
      '.sr-tab{padding:8px 4px;border-radius:8px;font-size:10.5px;font-weight:700;color:#475569;cursor:pointer;background:#f8fafc;border:1px solid #e2e8f0;text-align:center;display:flex;flex-direction:column;align-items:center;gap:2px;user-select:none;position:relative}' +
      '.sr-tab.active{background:#1e4d8c;color:#fff;border-color:#1e4d8c}' +
      '.sr-tab .sr-tab-lbl{font-size:9px}' +
      '.sr-tab .sr-badge{position:absolute;top:2px;left:2px;background:#10b981;color:#fff;border-radius:8px;font-size:8px;padding:0 5px;font-weight:800;line-height:1.4}' +
      '.sr-tab .sr-badge.zero{display:none}' +
      '.sr-body{padding:12px;max-width:820px;margin:0 auto}' +
      '.sr-sec{background:#fff;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(15,23,42,.06);overflow:hidden;margin-bottom:10px}' +
      '.sr-sec-h{padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:800;display:flex;align-items:center;gap:6px}' +
      '.sr-sec-b{padding:12px}' +
      '.sr-field{margin-bottom:10px}' +
      '.sr-field label{display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:#475569;margin-bottom:3px}' +
      '.sr-input,.sr-select,.sr-textarea{width:100%;padding:9px 10px;border:1px solid #cbd5e1;border-radius:7px;font-size:13px;font-family:inherit;background:#fff;color:#0f172a;box-sizing:border-box;direction:rtl;outline:none}' +
      '.sr-input:focus,.sr-select:focus,.sr-textarea:focus{border-color:#1e4d8c;box-shadow:0 0 0 3px rgba(30,77,140,.1)}' +
      '.sr-textarea{resize:vertical;min-height:60px;line-height:1.5}' +
      '.sr-array-head{display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:#f1f5f9;border-bottom:1px solid #e2e8f0}' +
      '.sr-array-title{font-size:12px;font-weight:800;display:flex;align-items:center;gap:5px}' +
      '.sr-array-count{background:#1e4d8c;color:#fff;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:800}' +
      '.sr-array-count.zero{background:#cbd5e1;color:#64748b}' +
      '.sr-array-add{padding:5px 10px;background:#1e4d8c;color:#fff;border:none;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit}' +
      '.sr-array-body{padding:8px 12px}' +
      '.sr-array-empty{padding:16px;text-align:center;color:#94a3b8;font-size:11px}' +
      '.sr-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:9px;margin-bottom:6px}' +
      '.sr-item-hd{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#64748b;font-weight:700;margin-bottom:4px}' +
      '.sr-item-del{width:22px;height:22px;border-radius:50%;background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;font-weight:900;cursor:pointer;font-size:12px;line-height:1;padding:0}' +
      '.sr-item-row{font-size:11px;margin-top:2px;line-height:1.4}' +
      '.sr-item-lbl{color:#94a3b8;font-weight:700;margin-left:4px}' +
      '.sr-ft{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e2e8f0;padding:9px 12px;display:flex;gap:6px;box-shadow:0 -4px 12px rgba(0,0,0,.06);z-index:8}' +
      '.sr-btn{flex:1;padding:11px;border:none;border-radius:9px;font-size:12.5px;font-weight:800;font-family:inherit;cursor:pointer}' +
      '.sr-btn.primary{background:#1e4d8c;color:#fff}' +
      '.sr-btn.success{background:#059669;color:#fff}' +
      '.sr-btn.secondary{background:#f1f5f9;color:#475569;flex:.4}' +
      '.sr-btn:disabled{background:#94a3b8;cursor:not-allowed}' +
      '.sr-saved{position:fixed;bottom:78px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:5px 12px;border-radius:16px;font-size:10.5px;font-weight:700;z-index:20;opacity:0;transition:opacity .3s;pointer-events:none}' +
      '.sr-saved.show{opacity:1}' +
      '.sr-empty{background:#fff;border-radius:12px;padding:40px 20px;text-align:center;margin:20px auto;max-width:400px}' +
      '.sr-autofill-banner{background:linear-gradient(135deg,#d1fae5,#a7f3d0);border:1px solid #10b981;border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:11.5px;color:#065f46;font-weight:700;display:flex;align-items:center;gap:8px}' +
      '@media print{.sr-tabs,.sr-ft,.sr-hd-btn,.sr-array-add,.sr-item-del,.sr-saved,.sr-autofill-banner{display:none !important}.sr-body{padding:0}.sr-sec{break-inside:avoid;box-shadow:none;border:1px solid #ccc}.sr-wrap{padding-bottom:0}.sr-hd{position:static;box-shadow:none}}';
    document.head.appendChild(st);
  }

  var state = { report: null, active: 'A', savedTimer: null, saveTimer: null };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function api(u, o) { return NABZ._api(u, o); }
  function post(u, b) { return api(u, { method: 'POST', body: JSON.stringify(b || {}) }); }
  function toast(m) { if (NABZ._toast) NABZ._toast(m); else alert(m); }
  function user() { try { return NABZ.state.user || {}; } catch (e) { return {}; } }
  function today() { return new Date().toISOString().slice(0, 10); }
  function currentShift() { var h = new Date().getHours(); return h >= 7 && h < 15 ? 'morning' : h >= 15 && h < 23 ? 'evening' : 'night'; }
  function shiftFa(s) { return { morning: 'صبح', evening: 'عصر', night: 'شب' }[s] || s; }

  function mount(html) {
    var el = document.getElementById('content') || document.querySelector('main');
    if (el) el.innerHTML = html;
  }

  async function show() {
    injectCSS();
    mount('<div class="sr-wrap"><div class="sr-body"><div class="sr-sec"><div class="sr-sec-b" style="text-align:center;padding:40px;color:#94a3b8">در حال بارگذاری...</div></div></div></div>');
    try {
      var t = await api('/api/supervisor/report/today');
      state.report = (t.items && t.items[0]) || null;
      render();
    } catch (e) {
      mount('<div class="sr-wrap"><div class="sr-body"><div class="sr-sec"><div class="sr-sec-b" style="color:#dc2626;text-align:center;padding:40px">خطا: ' + esc(e.message || e) + '</div></div></div></div>');
    }
  }

  function render() {
    var r = state.report;
    if (!r) { renderEmpty(); return; }
    var filled = progress(r);
    var h = '<div class="sr-wrap">';
    // Header
    h += '<div class="sr-hd">';
    h += '<div class="sr-hd-top"><div class="sr-hd-t">📋 گزارش سوپروایزر</div><div class="sr-hd-btns">';
    if (r.status === 'draft') h += '<button class="sr-hd-btn autofill" onclick="NABZ._srAuto()">🤖 پر کردن</button>';
    h += '<button class="sr-hd-btn" onclick="window.print()">🖨</button>';
    h += '<button class="sr-hd-btn" onclick="NABZ._srReload()">⟳</button>';
    h += '</div></div>';
    h += '<div class="sr-hd-meta"><span>📅 ' + esc(r.date) + '</span><span>🕐 ' + shiftFa(r.shiftType) + '</span><span>👤 ' + esc(r.supervisorName || '') + '</span><span>' + statusFa(r.status) + '</span></div>';
    h += '<div class="sr-progress"><div class="sr-progress-in" style="width:' + filled.pct + '%"></div></div>';
    h += '<div class="sr-progress-lbl">' + filled.filled + '/' + filled.total + ' بخش (' + filled.pct + '%)</div></div>';
    // Tabs grid (5 cols)
    h += '<div class="sr-tabs">';
    SECTIONS.forEach(function(s) {
      var cnt = countSec(r, s);
      h += '<div class="sr-tab' + (state.active === s.id ? ' active' : '') + '" onclick="NABZ._srGo(\'' + s.id + '\')">' + s.icon + '<span class="sr-tab-lbl">' + s.label + '</span><span class="sr-badge' + (cnt > 0 ? '' : ' zero') + '">' + cnt + '</span></div>';
    });
    h += '</div>';
    // Body
    h += '<div class="sr-body">';
    // Auto-fill banner if populated
    if (r._autoPopulatedAt && r.status === 'draft') {
      h += '<div class="sr-autofill-banner">🤖 این گزارش از داده‌های زنده پر شده است · می‌توانید ویرایش کنید</div>';
    }
    var sec = SECTIONS.filter(function(x) { return x.id === state.active; })[0];
    if (sec) h += renderSection(r, sec);
    h += '</div>';
    // Footer
    h += '<div class="sr-ft">';
    if (r.status === 'draft') {
      h += '<button class="sr-btn secondary" onclick="NABZ._srReload()">⟳</button>';
      h += '<button class="sr-btn primary" onclick="NABZ._srSubmit()">📤 ثبت نهایی</button>';
    } else if (r.status === 'submitted') {
      h += '<button class="sr-btn success" onclick="NABZ._srSign()">✍️ امضا</button>';
    } else {
      h += '<button class="sr-btn secondary" disabled>✅ امضا شده</button>';
    }
    h += '</div></div>';
    h += '<div class="sr-saved" id="sr-saved">💾 ذخیره شد</div>';
    mount(h);
  }

  function renderEmpty() {
    var u = user();
    mount('<div class="sr-wrap"><div class="sr-hd"><div class="sr-hd-top"><div class="sr-hd-t">📋 گزارش سوپروایزر</div></div><div class="sr-hd-meta"><span>📅 ' + today() + '</span><span>🕐 شیفت ' + shiftFa(currentShift()) + '</span><span>👤 ' + esc(u.fullName || u.username || '') + '</span></div></div>'
      + '<div class="sr-body"><div class="sr-empty"><div style="font-size:56px;margin-bottom:14px">📋</div><div style="font-size:15px;font-weight:800;margin-bottom:6px">گزارش امروز ثبت نشده</div><div style="font-size:11px;color:#64748b;margin-bottom:20px">گزارش جدید بسازید یا از داده‌های زنده پر کنید</div>'
      + '<button class="sr-btn primary" style="padding:14px;margin-bottom:8px" onclick="NABZ._srCreate(true)">🤖 ساخت + پر کردن خودکار</button>'
      + '<button class="sr-btn secondary" style="padding:12px;width:100%;flex:none" onclick="NABZ._srCreate(false)">+ ساخت خالی</button>'
      + '</div></div></div>');
  }

  function renderSection(r, s) {
    var isLocked = r.status === 'submitted' || r.status === 'signed';
    var h = '';
    if (s.fields && s.fields.length) {
      h += '<div class="sr-sec"><div class="sr-sec-h">' + s.icon + ' ' + s.label + '</div><div class="sr-sec-b">';
      s.fields.forEach(function(f) {
        var val = r[f.key] != null ? r[f.key] : '';
        h += '<div class="sr-field"><label>' + esc(f.label) + '</label>';
        if (isLocked) {
          h += '<div style="padding:7px 10px;background:#f8fafc;border-radius:6px;font-size:12px">' + (val || '—') + '</div>';
        } else if (f.type === 'select') {
          h += '<select class="sr-select" onchange="NABZ._srF(\'' + f.key + '\',this.value)"><option value="">—</option>';
          (f.options || []).forEach(function(o) {
            var v = Array.isArray(o) ? o[0] : o;
            var lbl = Array.isArray(o) ? o[1] : o;
            h += '<option value="' + esc(v) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + esc(lbl) + '</option>';
          });
          h += '</select>';
        } else if (f.type === 'textarea') {
          h += '<textarea class="sr-textarea" onblur="NABZ._srF(\'' + f.key + '\',this.value)">' + esc(val) + '</textarea>';
        } else if (f.type === 'number') {
          h += '<input class="sr-input" type="number" min="' + (f.min || 0) + '" value="' + esc(val) + '" onblur="NABZ._srF(\'' + f.key + '\',this.value===\'\'?null:Number(this.value))">';
        } else if (f.type === 'date') {
          h += '<input class="sr-input" type="date" value="' + esc(val) + '" onblur="NABZ._srF(\'' + f.key + '\',this.value)">';
        } else if (f.type === 'time') {
          h += '<input class="sr-input" type="time" value="' + esc(val) + '" onblur="NABZ._srF(\'' + f.key + '\',this.value)">';
        } else {
          h += '<input class="sr-input" type="text" value="' + esc(val) + '" onblur="NABZ._srF(\'' + f.key + '\',this.value)">';
        }
        h += '</div>';
      });
      h += '</div></div>';
    }
    (s.arrays || []).forEach(function(arr) {
      var items = r[arr.key] || [];
      h += '<div class="sr-sec"><div class="sr-array-head"><div class="sr-array-title">' + arr.icon + ' ' + arr.label + ' <span class="sr-array-count' + (items.length ? '' : ' zero') + '">' + items.length + '</span></div>';
      if (!isLocked) h += '<button class="sr-array-add" onclick="NABZ._srAdd(\'' + arr.key + '\')">+ افزودن</button>';
      h += '</div><div class="sr-array-body">';
      if (!items.length) {
        h += '<div class="sr-array-empty">' + (isLocked ? 'موردی ثبت نشده' : 'موردی نیست — با «+ افزودن» اضافه کنید') + '</div>';
      } else {
        items.forEach(function(it, i) {
          h += '<div class="sr-item"><div class="sr-item-hd"><span>#' + (i+1) + '</span>';
          if (!isLocked) h += '<button class="sr-item-del" onclick="NABZ._srDel(\'' + arr.key + '\',\'' + esc(it._id) + '\')">×</button>';
          h += '</div>';
          arr.fields.forEach(function(f) {
            if (it[f.key] != null && it[f.key] !== '') {
              h += '<div class="sr-item-row"><span class="sr-item-lbl">' + esc(f.label) + ':</span>' + esc(it[f.key]) + '</div>';
            }
          });
          h += '</div>';
        });
      }
      h += '</div></div>';
    });
    return h;
  }

  function countSec(r, s) {
    var c = 0;
    (s.fields || []).forEach(function(f) { if (r[f.key] != null && r[f.key] !== '') c++; });
    (s.arrays || []).forEach(function(a) { c += (r[a.key] || []).length; });
    return c;
  }
  function progress(r) {
    var total = 0, filled = 0;
    SECTIONS.forEach(function(s) {
      if (s.id === 'A' || s.id === 'J') return;
      total++;
      if (countSec(r, s) > 0) filled++;
    });
    return { total: total, filled: filled, pct: Math.round(filled / total * 100) };
  }
  function statusFa(s) { return { draft: '✏️ پیش‌نویس', submitted: '📤 ثبت شده', signed: '✍️ امضا' }[s] || s; }

  async function create(autofill) {
    var u = user();
    try {
      var r = await post('/api/supervisor/report', { date: today(), shiftType: currentShift(), supervisorName: u.fullName || u.username || '' });
      state.report = r;
      if (autofill) {
        try {
          r = await post('/api/supervisor/report/' + r.id + '/apply-auto', {});
          state.report = r;
          toast('🤖 پر شد');
        } catch (e) { toast('⚠️ گزارش ساخت شد ولی auto-fill ناموفق'); }
      } else {
        toast('✅ گزارش ساخته شد');
      }
      render();
    } catch (e) { toast('❌ ' + (e.message || e.error || 'خطا')); }
  }

  async function field(key, val) {
    if (!state.report || state.report.status !== 'draft') return;
    var p = {}; p[key] = val;
    try {
      state.report = await post('/api/supervisor/report/' + state.report.id, p);
      flashSaved();
    } catch (e) { toast('❌ ' + (e.message || e.error)); }
  }

  async function autoFill() {
    if (!state.report || state.report.status !== 'draft') { toast('⚠️ فقط در پیش‌نویس'); return; }
    var ok = await NABZ.dialog.confirm('داده‌های زنده از سیستم خوانده و جایگزین مقادیر فعلی می‌شود. ادامه؟', { icon: '🤖', title: 'پر کردن خودکار' });
    if (!ok) return;
    try {
      state.report = await post('/api/supervisor/report/' + state.report.id + '/apply-auto', {});
      toast('✅ گزارش از داده‌های زنده پر شد');
      render();
    } catch (e) { toast('❌ ' + (e.message || e.error)); }
  }

  async function addItem(key) {
    var arr = findArray(key);
    if (!arr) return;
    var fields = arr.fields.map(function(f) {
      return { key: f.key, label: f.label, required: f.required, type: f.type === 'select' ? 'select' : (f.type === 'date' ? 'date' : (f.type === 'time' ? 'time' : (f.type === 'number' ? 'number' : 'text'))), options: f.options };
    });
    var data = await NABZ.dialog.form({ icon: arr.icon, title: '+ ' + arr.label, fields: fields, submitLabel: 'افزودن' });
    if (!data) return;
    try {
      state.report = await post('/api/supervisor/report/' + state.report.id + '/array/' + key, data);
      flashSaved();
      render();
    } catch (e) { toast('❌ ' + (e.message || e.error)); }
  }

  async function delItem(key, id) {
    if (!(await NABZ.dialog.confirm('حذف این مورد؟', { icon: '🗑' }))) return;
    try {
      state.report = await post('/api/supervisor/report/' + state.report.id + '/array/' + key + '/' + id + '/remove', {});
      flashSaved();
      render();
    } catch (e) { toast('❌ ' + (e.message || e.error)); }
  }

  function findArray(key) {
    for (var i = 0; i < SECTIONS.length; i++) {
      var arrs = SECTIONS[i].arrays || [];
      for (var j = 0; j < arrs.length; j++) if (arrs[j].key === key) return arrs[j];
    }
    return null;
  }

  function flashSaved() {
    var el = document.getElementById('sr-saved');
    if (!el) return;
    el.classList.add('show');
    clearTimeout(state.savedTimer);
    state.savedTimer = setTimeout(function() { el.classList.remove('show'); }, 1400);
  }

  async function submit() {
    if (!(await NABZ.dialog.confirm('ثبت نهایی؟ بعد از ثبت ویرایش ممکن نیست.', { icon: '📤' }))) return;
    try {
      state.report = await post('/api/supervisor/report/' + state.report.id + '/submit', {});
      toast('✅ ثبت شد');
      render();
    } catch (e) { toast('❌ ' + (e.message || e.error)); }
  }

  async function sign() {
    if (!(await NABZ.dialog.confirm('امضای نهایی؟', { icon: '✍️' }))) return;
    try {
      state.report = await post('/api/supervisor/report/' + state.report.id + '/sign', {});
      toast('✍️ امضا شد');
      render();
    } catch (e) { toast('❌ ' + (e.message || e.error)); }
  }

  async function reload() {
    try {
      var t = await api('/api/supervisor/report/today');
      state.report = (t.items && t.items[0]) || null;
      render();
      toast('🔄');
    } catch (e) { toast('❌ ' + e.message); }
  }

  NABZ._srCreate = create;
  NABZ._srReload = reload;
  NABZ._srGo = function(id) { state.active = id; render(); };
  NABZ._srF = field;
  NABZ._srAdd = addItem;
  NABZ._srDel = delItem;
  NABZ._srSubmit = submit;
  NABZ._srSign = sign;
  NABZ._srAuto = autoFill;

  (function reg() {
    if (window.NABZ && typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('supervisor_report', show);
      console.log('[supervisor_report_ui] v3 registered');
    } else setTimeout(reg, 100);
  })();
})();
