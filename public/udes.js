// public/udes.js — Unified Data Entry System (UDES)
// Schema-driven, zero-dep, RTL-first, mobile-perfect
(function() {
  'use strict';
  if (window.__udes) return;
  window.__udes = true;

  // ═══════════════ STATE ═══════════════
  var S = {
    schema: null,
    ctx: {},
    data: {},
    activeGroup: null,
    onSuccess: null,
    draftTimer: null,
    dirty: false
  };

  // ═══════════════ CSS ═══════════════
  function injectCSS() {
    if (document.getElementById('udes-style')) return;
    var st = document.createElement('style');
    st.id = 'udes-style';
    st.textContent =
      '#udes-overlay{position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:99998;display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .25s;direction:rtl}' +
      '#udes-overlay.open{opacity:1}' +
      '#udes-sheet{background:#fff;width:100%;max-width:640px;max-height:95vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;transform:translateY(100%);transition:transform .3s cubic-bezier(.4,0,.2,1);font-family:Vazirmatn,Tahoma,sans-serif;overflow:hidden}' +
      '#udes-sheet.open{transform:translateY(0)}' +
      '@media(min-width:640px){#udes-overlay{align-items:center}#udes-sheet{border-radius:20px;max-height:88vh;transform:translateY(30px) scale(.96)}#udes-sheet.open{transform:translateY(0) scale(1)}}' +
      '.udes-hd{background:linear-gradient(135deg,#1e4d8c,#0f172a);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0}' +
      '.udes-hd-icon{font-size:22px}' +
      '.udes-hd-t{flex:1;min-width:0}' +
      '.udes-hd-title{font-size:15px;font-weight:900;line-height:1.2}' +
      '.udes-hd-sub{font-size:10px;opacity:.8;margin-top:2px}' +
      '.udes-hd-close{background:rgba(255,255,255,.15);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;flex-shrink:0}' +
      '.udes-badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:9px;font-weight:800;margin-right:6px}' +
      '.udes-badge.teach{background:#fbbf24;color:#78350f}' +
      '.udes-tabs{display:flex;gap:4px;padding:8px 12px;background:#f8fafc;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid #e2e8f0;flex-shrink:0}' +
      '.udes-tabs::-webkit-scrollbar{display:none}' +
      '.udes-tab{flex:0 0 auto;padding:7px 12px;border-radius:999px;font-size:11.5px;font-weight:700;color:#475569;cursor:pointer;background:#fff;border:1px solid #e2e8f0;user-select:none;transition:all .15s}' +
      '.udes-tab.active{background:#1e4d8c;color:#fff;border-color:#1e4d8c}' +
      '.udes-tab .udes-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#ef4444;margin-right:4px;vertical-align:middle}' +
      '.udes-body{flex:1;overflow-y:auto;padding:12px 14px;background:#f8fafc}' +
      '.udes-group{display:none}' +
      '.udes-group.active{display:block}' +
      '.udes-field{margin-bottom:14px;background:#fff;padding:10px 12px;border-radius:10px;border:1px solid #e2e8f0;transition:border-color .15s}' +
      '.udes-field.error{border-color:#ef4444;background:#fef2f2}' +
      '.udes-field-label{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:700;color:#0f172a;margin-bottom:6px}' +
      '.udes-field-label .udes-req{color:#ef4444;margin-right:2px}' +
      '.udes-field-label .udes-unit{font-size:10px;color:#94a3b8;font-weight:600}' +
      '.udes-input,.udes-select,.udes-textarea{width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;font-family:inherit;background:#fff;color:#0f172a;box-sizing:border-box;direction:rtl;transition:border-color .15s;outline:none}' +
      '.udes-input:focus,.udes-select:focus,.udes-textarea:focus{border-color:#1e4d8c;box-shadow:0 0 0 3px rgba(30,77,140,.1)}' +
      '.udes-input.num{direction:ltr;text-align:center;font-weight:700;font-variant-numeric:tabular-nums}' +
      '.udes-textarea{resize:vertical;min-height:60px;line-height:1.5}' +
      '.udes-stepper{display:flex;align-items:center;gap:6px}' +
      '.udes-stepper button{width:38px;height:38px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;font-size:18px;font-weight:900;cursor:pointer;color:#1e4d8c;flex-shrink:0}' +
      '.udes-stepper button:active{background:#dbeafe}' +
      '.udes-stepper .udes-input{flex:1;text-align:center}' +
      '.udes-checkbox-wrap{display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer}' +
      '.udes-checkbox{width:22px;height:22px;accent-color:#1e4d8c;cursor:pointer}' +
      '.udes-range-wrap{display:flex;align-items:center;gap:10px}' +
      '.udes-range{flex:1;accent-color:#1e4d8c}' +
      '.udes-range-val{font-size:16px;font-weight:900;color:#1e4d8c;min-width:32px;text-align:center}' +
      '.udes-error-msg{color:#dc2626;font-size:10.5px;margin-top:4px;font-weight:600}' +
      '.udes-news2{margin-top:8px;padding:8px 10px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;font-size:11px}' +
      '.udes-news2.low{background:#d1fae5;color:#065f46}' +
      '.udes-news2.medium{background:#fef3c7;color:#92400e}' +
      '.udes-news2.high{background:#fed7aa;color:#9a3412}' +
      '.udes-news2.critical{background:#fee2e2;color:#991b1b}' +
      '.udes-news2-v{font-size:18px;font-weight:900}' +
      '.udes-ft{padding:10px 14px 14px;background:#fff;border-top:1px solid #e2e8f0;flex-shrink:0}' +
      '.udes-progress{height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;margin-bottom:10px}' +
      '.udes-progress-in{height:100%;background:linear-gradient(90deg,#059669,#10b981);border-radius:3px;transition:width .3s}' +
      '.udes-progress-lbl{font-size:10px;color:#64748b;text-align:center;margin-bottom:8px;font-weight:700}' +
      '.udes-actions{display:flex;gap:8px}' +
      '.udes-btn{flex:1;padding:13px;border:none;border-radius:10px;font-size:13px;font-weight:800;font-family:inherit;cursor:pointer;transition:all .15s}' +
      '.udes-btn.submit{background:#1e4d8c;color:#fff}' +
      '.udes-btn.submit:active{background:#163a6b;transform:scale(.98)}' +
      '.udes-btn.submit:disabled{background:#94a3b8;cursor:not-allowed}' +
      '.udes-btn.cancel{background:#f1f5f9;color:#475569;flex:0.4}' +
      '.udes-toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(20px);background:#0f172a;color:#fff;padding:10px 20px;border-radius:12px;font-size:12px;font-weight:700;z-index:100000;opacity:0;pointer-events:none;transition:all .3s;box-shadow:0 8px 24px rgba(0,0,0,.3);direction:rtl;font-family:Vazirmatn,Tahoma,sans-serif}' +
      '.udes-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}' +
      '.udes-toast.success{background:#059669}' +
      '.udes-toast.error{background:#dc2626}' +
      '.udes-toast.info{background:#1e4d8c}' +
      '.udes-empty{text-align:center;padding:40px;color:#94a3b8;font-size:12px}';
    document.head.appendChild(st);
  }

  // ═══════════════ HELPERS ═══════════════
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function toast(msg, kind) {
    var t = document.getElementById('udes-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'udes-toast';
      t.className = 'udes-toast';
      document.body.appendChild(t);
    }
    t.className = 'udes-toast ' + (kind || '');
    t.textContent = msg;
    setTimeout(function() { t.classList.add('show'); }, 10);
    setTimeout(function() { t.classList.remove('show'); }, 2600);
  }
  function getDraftKey() {
    var k = 'udes_draft_' + (S.schema && S.schema.id || 'x') + '_' + (S.ctx.patientId || 'global');
    return k;
  }
  function setNestedValue(obj, path, val) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    if (val === undefined || val === '' || val === null) {
      delete cur[parts[parts.length - 1]];
    } else {
      cur[parts[parts.length - 1]] = val;
    }
  }
  function getNestedValue(obj, path) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function nowHHMM() {
    var d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function currentShift() {
    var h = new Date().getHours();
    if (h >= 7 && h < 15) return 'morning';
    if (h >= 15 && h < 23) return 'evening';
    return 'night';
  }

  // ═══════════════ DRAFT ═══════════════
  function saveDraft() {
    try {
      localStorage.setItem(getDraftKey(), JSON.stringify({
        data: S.data, at: Date.now()
      }));
      S.dirty = false;
    } catch (e) {}
  }
  function loadDraft() {
    try {
      var raw = localStorage.getItem(getDraftKey());
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (p && p.data && (Date.now() - p.at) < 7 * 86400000) return p.data;
    } catch (e) {}
    return null;
  }
  function clearDraft() {
    try { localStorage.removeItem(getDraftKey()); } catch (e) {}
  }
  function scheduleSave() {
    S.dirty = true;
    if (S.draftTimer) clearTimeout(S.draftTimer);
    S.draftTimer = setTimeout(function() {
      saveDraft();
      toast('💾 پیش‌نویس ذخیره شد', 'info');
    }, 1200);
  }

  // ═══════════════ AUTO-FILL ═══════════════
  function autoFillData() {
    var d = {};
    // context auto-fill
    if (S.ctx.patientId) d.patientId = S.ctx.patientId;
    if (S.ctx.wardCode) d.wardCode = S.ctx.wardCode;
    if (S.ctx.bedNumber) d.bedNumber = S.ctx.bedNumber;
    if (S.ctx.patientName) d.patientName = S.ctx.patientName;
    // generic
    d.date = todayISO();
    d.time = nowHHMM();
    d.shiftType = currentShift();
    // user
    try {
      if (window.NABZ && NABZ.state && NABZ.state.user) {
        d.createdBy = NABZ.state.user.id;
        d.createdByName = NABZ.state.user.fullName || NABZ.state.user.username;
      }
    } catch (e) {}
    return d;
  }

  // ═══════════════ NEWS2 ═══════════════
  function calcNews2(d) {
    if (!d) return null;
    var t = 0, hasAny = false;
    var rr = Number(d.rr);
    if (isFinite(rr) && rr > 0) {
      hasAny = true;
      if (rr <= 8) t += 3; else if (rr <= 11) t += 1; else if (rr <= 20) t += 0;
      else if (rr <= 24) t += 2; else t += 3;
    }
    var spo2 = Number(d.spo2);
    if (isFinite(spo2) && spo2 > 0) {
      hasAny = true;
      if (spo2 <= 91) t += 3; else if (spo2 <= 93) t += 2;
      else if (spo2 <= 95) t += 1; else t += 0;
    }
    if (d.onOxygen) t += 2;
    var sbp = Number(d.bp_sys);
    if (isFinite(sbp) && sbp > 0) {
      hasAny = true;
      if (sbp <= 90) t += 3; else if (sbp <= 100) t += 2;
      else if (sbp <= 110) t += 1; else if (sbp <= 219) t += 0; else t += 3;
    }
    var hr = Number(d.hr);
    if (isFinite(hr) && hr > 0) {
      hasAny = true;
      if (hr <= 40) t += 3; else if (hr <= 50) t += 1; else if (hr <= 90) t += 0;
      else if (hr <= 110) t += 1; else if (hr <= 130) t += 2; else t += 3;
    }
    if (d.consciousness && d.consciousness !== 'alert') t += 3;
    var temp = Number(d.temp);
    if (isFinite(temp) && temp > 0) {
      hasAny = true;
      if (temp <= 35) t += 3; else if (temp <= 36) t += 1;
      else if (temp <= 38) t += 0; else if (temp <= 39) t += 1; else t += 2;
    }
    if (!hasAny) return null;
    var risk = t >= 7 ? 'critical' : t >= 5 ? 'high' : t >= 1 ? 'medium' : 'low';
    return { total: t, risk: risk };
  }

  // ═══════════════ RENDERING ═══════════════
  function buildSheet() {
    var old = document.getElementById('udes-overlay');
    if (old) old.remove();

    var ov = document.createElement('div');
    ov.id = 'udes-overlay';

    var sh = document.createElement('div');
    sh.id = 'udes-sheet';
    sh.innerHTML = renderHeader() + renderTabs() + '<div class="udes-body" id="udes-body">' + renderBody() + '</div>' + renderFooter();
    ov.appendChild(sh);
    document.body.appendChild(ov);

    requestAnimationFrame(function() {
      ov.classList.add('open');
      sh.classList.add('open');
    });
  }

  function renderHeader() {
    var s = S.schema;
    var user = null;
    try { user = NABZ.state && NABZ.state.user; } catch (e) {}
    var teachBadge = (user && ['resident','intern'].indexOf(user.role) >= 0) ?
      '<span class="udes-badge teach">نیاز به تایید استاد</span>' : '';
    return '<div class="udes-hd">' +
      '<div class="udes-hd-icon">' + esc(s.icon || '📝') + '</div>' +
      '<div class="udes-hd-t">' +
        '<div class="udes-hd-title">' + esc(s.title) + teachBadge + '</div>' +
        (s.helpText ? '<div class="udes-hd-sub">' + esc(s.helpText) + '</div>' : '') +
      '</div>' +
      '<button class="udes-hd-close" onclick="NABZ.udes._close()">✕</button>' +
    '</div>';
  }

  function renderTabs() {
    var groups = S.schema.groups || [];
    if (groups.length <= 1) return '';
    var h = '<div class="udes-tabs">';
    groups.forEach(function(g) {
      var cnt = countGroupFilled(g.id);
      var dot = cnt > 0 ? '<span class="udes-dot"></span>' : '';
      h += '<div class="udes-tab' + (S.activeGroup === g.id ? ' active' : '') + '" data-g="' + g.id + '">' +
        dot + (g.icon || '') + ' ' + esc(g.label) + '</div>';
    });
    h += '</div>';
    return h;
  }

  function countGroupFilled(gid) {
    var n = 0;
    (S.schema.fields || []).forEach(function(f) {
      if (f.group !== gid) return;
      var v = getNestedValue(S.data, f.key);
      if (v !== undefined && v !== '' && v !== null && v !== false) n++;
    });
    return n;
  }

  function renderBody() {
    var groups = S.schema.groups || [];
    var h = '';
    groups.forEach(function(g) {
      h += '<div class="udes-group' + (S.activeGroup === g.id ? ' active' : '') + '" data-g="' + g.id + '">';
      (S.schema.fields || []).forEach(function(f) {
        if (f.group !== g.id) return;
        h += renderField(f);
      });
      h += '</div>';
    });
    return h;
  }

  function renderField(f) {
    var val = getNestedValue(S.data, f.key);
    var id = 'udes-f_' + f.key.replace(/\./g, '_');
    var req = f.required ? '<span class="udes-req">*</span>' : '';
    var unit = f.unit ? '<span class="udes-unit">' + esc(f.unit) + '</span>' : '';

    var h = '<div class="udes-field" data-k="' + esc(f.key) + '">';
    h += '<div class="udes-field-label"><span>' + req + ' ' + esc(f.label) + '</span>' + unit + '</div>';

    if (f.type === 'number') {
      h += '<div class="udes-stepper">';
      h += '<button type="button" onclick="NABZ.udes._step(\'' + esc(f.key) + '\',-1)">−</button>';
      h += '<input id="' + id + '" class="udes-input num" type="number" inputmode="decimal"' +
        (f.min != null ? ' min="' + f.min + '"' : '') +
        (f.max != null ? ' max="' + f.max + '"' : '') +
        (f.step != null ? ' step="' + f.step + '"' : '') +
        ' value="' + (val != null ? val : '') + '" placeholder="—">';
      h += '<button type="button" onclick="NABZ.udes._step(\'' + esc(f.key) + '\',1)">+</button>';
      h += '</div>';
    } else if (f.type === 'select') {
      h += '<select id="' + id + '" class="udes-select">';
      h += '<option value="">— انتخاب —</option>';
      (f.options || []).forEach(function(o) {
        var v = (typeof o === 'object') ? o.value : o;
        var lbl = (typeof o === 'object') ? (o.label || v) : o;
        h += '<option value="' + esc(v) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + esc(lbl) + '</option>';
      });
      h += '</select>';
    } else if (f.type === 'textarea') {
      h += '<textarea id="' + id + '" class="udes-textarea" rows="' + (f.rows || 3) + '" placeholder="' + esc(f.placeholder || '') + '">' + esc(val || '') + '</textarea>';
    } else if (f.type === 'checkbox') {
      h += '<label class="udes-checkbox-wrap"><input id="' + id + '" class="udes-checkbox" type="checkbox"' + (val ? ' checked' : '') + '><span>' + esc(f.label) + '</span></label>';
    } else if (f.type === 'range') {
      h += '<div class="udes-range-wrap"><input id="' + id + '" class="udes-range" type="range" min="' + (f.min || 0) + '" max="' + (f.max || 10) + '" value="' + (val || f.min || 0) + '"><span class="udes-range-val" id="' + id + '_v">' + (val || f.min || 0) + '</span></div>';
    } else if (f.type === 'date') {
      h += '<input id="' + id + '" class="udes-input" type="date" value="' + esc(val || '') + '">';
    } else if (f.type === 'time') {
      h += '<input id="' + id + '" class="udes-input" type="time" value="' + esc(val || '') + '">';
    } else {
      h += '<input id="' + id + '" class="udes-input" type="text" value="' + esc(val || '') + '" placeholder="' + esc(f.placeholder || '') + '">';
    }

    // NEWS2 display for vitals
    if (S.schema.id === 'vitals' && f.key === 'notes') {
      var n2 = calcNews2(S.data);
      if (n2) {
        h += '<div class="udes-news2 ' + n2.risk + '"><span>NEWS2: <b>' + n2.total + '</b></span><span class="udes-news2-v">' + (n2.risk === 'critical' ? '🚨 بحرانی' : n2.risk === 'high' ? '⚠️ بالا' : n2.risk === 'medium' ? '· متوسط' : '✓ پایین') + '</span></div>';
      }
    }

    h += '<div class="udes-error-msg" id="' + id + '_err" style="display:none"></div>';
    h += '</div>';
    return h;
  }

  function renderFooter() {
    return '<div class="udes-ft">' +
      '<div class="udes-progress"><div class="udes-progress-in" id="udes-progress" style="width:0%"></div></div>' +
      '<div class="udes-progress-lbl" id="udes-progress-lbl">۰٪ تکمیل</div>' +
      '<div class="udes-actions">' +
        '<button class="udes-btn cancel" onclick="NABZ.udes._close()">انصراف</button>' +
        '<button class="udes-btn submit" id="udes-submit" onclick="NABZ.udes._submit()">ثبت</button>' +
      '</div>' +
    '</div>';
  }

  function updateProgress() {
    var req = (S.schema.fields || []).filter(function(f) { return f.required; });
    if (!req.length) {
      document.getElementById('udes-progress').style.width = '100%';
      document.getElementById('udes-progress-lbl').textContent = 'آماده';
      return;
    }
    var filled = req.filter(function(f) {
      var v = getNestedValue(S.data, f.key);
      return v !== undefined && v !== '' && v !== null;
    }).length;
    var pct = Math.round(filled / req.length * 100);
    document.getElementById('udes-progress').style.width = pct + '%';
    document.getElementById('udes-progress-lbl').textContent = pct + '٪ تکمیل';
  }

  function updateGroupDots() {
    var tabs = document.querySelectorAll('.udes-tab');
    tabs.forEach(function(t) {
      var gid = t.getAttribute('data-g');
      var cnt = countGroupFilled(gid);
      // simple toggle
      var dot = t.querySelector('.udes-dot');
      if (cnt > 0 && !dot) {
        var span = document.createElement('span');
        span.className = 'udes-dot';
        t.insertBefore(span, t.firstChild);
      } else if (cnt === 0 && dot) {
        dot.remove();
      }
    });
  }

  // ═══════════════ EVENTS ═══════════════
  function bindEvents() {
    // input/change on all fields
    var body = document.getElementById('udes-body');
    body.addEventListener('input', function(e) {
      var t = e.target;
      var field = t.closest('.udes-field');
      if (!field) return;
      var key = field.getAttribute('data-k');
      var schema = (S.schema.fields || []).find(function(f) { return f.key === key; });
      if (!schema) return;
      var val;
      if (schema.type === 'checkbox') val = t.checked;
      else if (schema.type === 'number' || schema.type === 'range') val = t.value === '' ? undefined : Number(t.value);
      else val = t.value;
      setNestedValue(S.data, key, val);

      // range display
      if (schema.type === 'range') {
        var d = document.getElementById('udes-f_' + key.replace(/\./g, '_') + '_v');
        if (d) d.textContent = val;
      }

      // conditional visibility
      applyConditionalVisibility();
      // validation
      validateFieldDOM(field, schema);
      // progress
      updateProgress();
      updateGroupDots();
      scheduleSave();

      // special: NEWS2
      if (S.schema.id === 'vitals') {
        var newsEl = body.querySelector('.udes-news2');
        var n2 = calcNews2(S.data);
        if (newsEl) newsEl.remove();
        if (n2) {
          var notesField = body.querySelector('[data-k="notes"]');
          if (notesField) {
            var div = document.createElement('div');
            div.className = 'udes-news2 ' + n2.risk;
            div.innerHTML = '<span>NEWS2: <b>' + n2.total + '</b></span><span class="udes-news2-v">' + (n2.risk === 'critical' ? '🚨 بحرانی' : n2.risk === 'high' ? '⚠️ بالا' : n2.risk === 'medium' ? '· متوسط' : '✓ پایین') + '</span>';
            notesField.insertBefore(div, notesField.querySelector('.udes-error-msg'));
          }
        }
      }
    });

    body.addEventListener('change', function(e) {
      var t = e.target;
      if (t.tagName === 'SELECT' || t.type === 'checkbox' || t.type === 'date' || t.type === 'time') {
        t.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // tab clicks
    document.getElementById('udes-sheet').addEventListener('click', function(e) {
      var tab = e.target.closest('.udes-tab');
      if (tab) {
        S.activeGroup = tab.getAttribute('data-g');
        document.querySelectorAll('.udes-tab').forEach(function(t) { t.classList.toggle('active', t === tab); });
        document.querySelectorAll('.udes-group').forEach(function(g) { g.classList.toggle('active', g.getAttribute('data-g') === S.activeGroup); });
        return;
      }
      var close = e.target.closest('.udes-hd-close');
      if (close) NABZ.udes._close();
    });

    // keyboard
    document.addEventListener('keydown', function handler(e) {
      if (!document.getElementById('udes-overlay')) {
        document.removeEventListener('keydown', handler);
        return;
      }
      if (e.key === 'Escape') NABZ.udes._close();
    });

    applyConditionalVisibility();
    updateProgress();
  }

  function applyConditionalVisibility() {
    (S.schema.fields || []).forEach(function(f) {
      if (!f.visibleIf) return;
      var el = document.querySelector('.udes-field[data-k="' + f.key + '"]');
      if (!el) return;
      var condVal = getNestedValue(S.data, f.visibleIf.field);
      var show = String(condVal) === String(f.visibleIf.equals);
      el.style.display = show ? '' : 'none';
    });
  }

  function validateFieldDOM(fieldEl, schema) {
    var errEl = fieldEl.querySelector('.udes-error-msg');
    var val = getNestedValue(S.data, schema.key);
    var msg = '';
    if (schema.required && (val === undefined || val === '' || val === null)) {
      msg = 'این فیلد اجباری است';
    } else if (schema.type === 'number' && val !== undefined && val !== '' && val !== null) {
      var n = Number(val);
      if (!isFinite(n)) msg = 'عدد معتبر وارد کنید';
      else if (schema.min != null && n < schema.min) msg = 'حداقل ' + schema.min;
      else if (schema.max != null && n > schema.max) msg = 'حداکثر ' + schema.max;
    }
    if (msg) {
      fieldEl.classList.add('error');
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    } else {
      fieldEl.classList.remove('error');
      if (errEl) errEl.style.display = 'none';
    }
  }

  // ═══════════════ VALIDATION ═══════════════
  function validateAll() {
    var errors = [];
    (S.schema.fields || []).forEach(function(f) {
      var el = document.querySelector('.udes-field[data-k="' + f.key + '"]');
      if (el && el.style.display === 'none') return; // skip hidden
      var val = getNestedValue(S.data, f.key);
      var msg = '';
      if (f.required && (val === undefined || val === '' || val === null)) {
        msg = 'این فیلد اجباری است';
      } else if (f.type === 'number' && val !== undefined && val !== '' && val !== null) {
        var n = Number(val);
        if (!isFinite(n)) msg = 'عدد معتبر وارد کنید';
        else if (f.min != null && n < f.min) msg = 'حداقل ' + f.min;
        else if (f.max != null && n > f.max) msg = 'حداکثر ' + f.max;
      }
      if (msg) {
        errors.push({ field: f.key, msg: msg, label: f.label });
        if (el) {
          el.classList.add('error');
          var err = el.querySelector('.udes-error-msg');
          if (err) { err.textContent = msg; err.style.display = 'block'; }
        }
      }
    });
    return errors;
  }

  // ═══════════════ SUBMIT ═══════════════
  function buildPayload() {
    // Start with base payload resolved from ctx
    var payload = {};
    var base = S.schema.basePayload || {};
    Object.keys(base).forEach(function(k) {
      var v = base[k];
      if (typeof v === 'string' && v.charAt(0) === '$') {
        var ctxKey = v.slice(1);
        payload[k] = S.ctx[ctxKey];
      } else {
        payload[k] = v;
      }
    });
    // Deep merge S.data into payload
    function deepMerge(dst, src) {
      Object.keys(src).forEach(function(k) {
        if (src[k] !== null && typeof src[k] === 'object' && !Array.isArray(src[k])) {
          if (!dst[k] || typeof dst[k] !== 'object') dst[k] = {};
          deepMerge(dst[k], src[k]);
        } else if (src[k] !== undefined && src[k] !== '') {
          dst[k] = src[k];
        }
      });
    }
    deepMerge(payload, S.data);
    return payload;
  }

  async function submit() {
    var errs = validateAll();
    if (errs.length) {
      // scroll to first error
      var first = document.querySelector('.udes-field.error');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('❌ ' + errs.length + ' فیلد نیاز به اصلاح دارد', 'error');
      return;
    }
    var btn = document.getElementById('udes-submit');
    btn.disabled = true;
    btn.textContent = 'در حال ثبت...';

    try {
      var payload = buildPayload();
      var url = S.schema.endpoint;
      var method = S.schema.method || 'POST';
      var r;
      if (window.NABZ && typeof NABZ._api === 'function') {
        r = await NABZ._api(url, { method: method, body: JSON.stringify(payload) });
      } else {
        var resp = await fetch(url, {
          method: method,
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        r = await resp.json();
        if (!resp.ok) throw new Error(r.message || r.error || 'HTTP ' + resp.status);
      }
      clearDraft();
      toast('✅ ثبت شد', 'success');
      NABZ.udes._close();
      if (typeof S.onSuccess === 'function') {
        try { S.onSuccess(r); } catch (e) { console.warn('onSuccess error', e); }
      }
    } catch (e) {
      console.error('[udes submit]', e);
      toast('❌ ' + ((e && (e.message || e.error)) || 'خطا در ثبت'), 'error');
      btn.disabled = false;
      btn.textContent = 'ثبت';
    }
  }

  // ═══════════════ CLOSE ═══════════════
  function close() {
    if (S.dirty) {
      if (!confirm('تغییرات ذخیره‌نشده دارید. آیا خارج می‌شوید؟ (پیش‌نویس خودکار ذخیره شده)')) {
        return;
      }
    }
    var ov = document.getElementById('udes-overlay');
    var sh = document.getElementById('udes-sheet');
    if (ov) { ov.classList.remove('open'); }
    if (sh) { sh.classList.remove('open'); }
    setTimeout(function() {
      if (ov) ov.remove();
      if (S.draftTimer) clearTimeout(S.draftTimer);
    }, 300);
    S.schema = null;
    S.ctx = {};
    S.data = {};
    S.activeGroup = null;
    S.onSuccess = null;
  }

  // ═══════════════ PUBLIC API ═══════════════
  async function openForm(schemaId, ctx, onSuccess) {
    injectCSS();
    S.ctx = ctx || {};
    S.onSuccess = onSuccess || null;

    // Load schema
    var schema;
    try {
      schema = await NABZ._api('/api/forms/' + encodeURIComponent(schemaId));
    } catch (e) {
      toast('❌ تعریف فرم پیدا نشد: ' + schemaId, 'error');
      return;
    }
    if (!schema || !schema.fields) {
      toast('❌ فرم نامعتبر', 'error');
      return;
    }
    S.schema = schema;
    S.activeGroup = (schema.groups && schema.groups[0] && schema.groups[0].id) || 'main';

    // Load draft or auto-fill
    var draft = loadDraft();
    if (draft) {
      S.data = draft;
      toast('📋 پیش‌نویس بازیابی شد', 'info');
    } else {
      S.data = autoFillData();
    }

    buildSheet();
    bindEvents();

    // Focus first input
    setTimeout(function() {
      var first = document.querySelector('#udes-body input:not([type=hidden]),#udes-body textarea,#udes-body select');
      if (first) first.focus();
    }, 350);
  }

  // Expose
  if (window.NABZ) {
    NABZ.openForm = openForm;
    NABZ.udes = {
      _close: close,
      _submit: submit,
      _step: function(key, delta) {
        var cur = getNestedValue(S.data, key);
        var n = Number(cur) || 0;
        var schema = (S.schema.fields || []).find(function(f) { return f.key === key; });
        var mn = (schema && schema.min != null) ? schema.min : 0;
        var mx = (schema && schema.max != null) ? schema.max : 999999;
        n = Math.max(mn, Math.min(mx, n + delta));
        setNestedValue(S.data, key, n);
        var el = document.getElementById('udes-f_' + key.replace(/\./g, '_'));
        if (el) el.value = n;
        // trigger input
        if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
      },
      open: openForm,
      list: async function() {
        try { return await NABZ._api('/api/forms/list'); } catch (e) { return { items: [] }; }
      }
    };
  } else {
    // wait for NABZ
    var iv = setInterval(function() {
      if (window.NABZ) {
        clearInterval(iv);
        NABZ.openForm = openForm;
        NABZ.udes = { _close: close, _submit: submit, _step: function(){}, open: openForm, list: async function() { return { items: [] }; } };
      }
    }, 100);
  }

  console.log('[udes] loaded — schema-driven form renderer ready');
})();
