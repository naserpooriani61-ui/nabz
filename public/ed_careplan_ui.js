// public/ed_careplan_ui.js — Nursing Care Plan (interactive)
(function() {
  'use strict';
  function api(url, opts) {
    if (typeof NABZ !== 'undefined' && typeof NABZ._api === 'function') return NABZ._api(url, opts);
    var t = localStorage.getItem('nabz_tk') || '';
    var h = { 'Content-Type': 'application/json' };
    if (t) h.Authorization = 'Bearer ' + t;
    return fetch(url, Object.assign({ headers: h, credentials: 'include' }, opts || {}))
      .then(function(r) { return r.json().then(function(j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); });
  }
  function data(r) { return (r && r.data) ? r.data : r; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  var S = { visitId: null, visit: null, plans: [] };
  var CATS = ['Airway','Breathing','Circulation','Nutrition','Mobility','Skin','Pain','Psychosocial','Education','Elimination','Safety'];
  function show() {
    var c = document.getElementById('content');
    if (!c) return;
    var u = new URL(window.location.href);
    var m = (window.location.hash || '').match(/#\/ed\/careplan\/v\/([^\/]+)/);
    S.visitId = m ? decodeURIComponent(m[1]) : (u.searchParams.get('visitId') || u.searchParams.get('patientId'));
    if (!S.visitId) { c.innerHTML = '<div style="padding:30px;text-align:center;color:#64748b">ویزیت انتخاب نشده</div>'; return; }
    c.innerHTML = '<div style="padding:30px;text-align:center;color:#64748b">در حال بارگذاری...</div>';
    load();
  }
  async function load() {
    try {
      var r = await api('/api/ed/careplan/' + encodeURIComponent(S.visitId));
      var d = data(r) || {};
      S.visit = d.visit; S.plans = d.plans || [];
      render();
    } catch (e) {
      document.getElementById('content').innerHTML = '<div style="padding:20px;color:#dc2626;text-align:center">خطا: ' + esc(e.message) + '</div>';
    }
  }
  function render() {
    var v = S.visit || {};
    var h = [];
    h.push('<div style="direction:rtl;padding:16px;max-width:900px;margin:0 auto">');
    h.push('<div style="background:linear-gradient(135deg,#581c87,#0f172a);color:#fff;padding:14px;border-radius:14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">');
    h.push('<div><div style="font-size:18px;font-weight:900">📋 برنامه مراقبت پرستاری</div>');
    h.push('<div style="font-size:12px;opacity:.85;margin-top:2px">' + esc(v.name || '—') + ' · ' + esc(v.chiefComplaint || '—') + '</div></div>');
    h.push('<button onclick="NABZ._cpAdd()" style="background:#16a34a;color:#fff;border:none;border-radius:10px;padding:10px 16px;font-weight:900;font-size:13px;cursor:pointer">+ مشکل جدید</button>');
    h.push('</div>');
    if (S.plans.length === 0) {
      h.push('<div style="background:#fff;border:1px dashed #cbd5e1;border-radius:14px;padding:40px;text-align:center">');
      h.push('<div style="font-size:40px;margin-bottom:8px">🩺</div>');
      h.push('<div style="color:#64748b;font-weight:700">برنامه مراقبتی ثبت نشده</div>');
      h.push('<button onclick="NABZ._cpAdd()" style="margin-top:12px;background:#16a34a;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-weight:800;cursor:pointer">+ افزودن اولین مشکل</button>');
      h.push('</div>');
    } else {
      S.plans.forEach(function(p) {
        var statusColor = p.status === 'active' ? '#dc2626' : p.status === 'resolved' ? '#16a34a' : '#f59e0b';
        h.push('<div style="background:#fff;border:1px solid #e2e8f0;border-inline-start:5px solid ' + statusColor + ';border-radius:12px;padding:14px;margin-bottom:10px">');
        h.push('<div style="display:flex;justify-content:space-between;align-items:center">');
        h.push('<div style="font-weight:900;font-size:14px">' + esc(p.category) + '</div>');
        h.push('<div style="font-size:11px;font-weight:900;color:' + statusColor + '">' + esc(p.status) + '</div>');
        h.push('</div>');
        h.push('<div style="font-size:13px;margin-top:6px"><b>مشکل:</b> ' + esc(p.problem) + '</div>');
        if (p.goal) h.push('<div style="font-size:12px;margin-top:4px;color:#475569"><b>هدف:</b> ' + esc(p.goal) + '</div>');
        if (p.interventions && p.interventions.length) {
          h.push('<div style="font-size:12px;margin-top:4px"><b>مداخلات:</b><ul style="margin:4px 0;padding-inline-start:20px">');
          p.interventions.forEach(function(i) { h.push('<li>' + esc(i) + '</li>'); });
          h.push('</ul></div>');
        }
        if (p.evaluation) h.push('<div style="font-size:12px;margin-top:4px;color:#475569"><b>ارزیابی:</b> ' + esc(p.evaluation) + '</div>');
        h.push('<div style="margin-top:8px;display:flex;gap:6px">');
        if (p.status === 'active') {
          h.push('<button onclick="NABZ._cpResolve(\'' + esc(p.id) + '\')" style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:800;cursor:pointer">✓ حل شد</button>');
        }
        h.push('</div>');
        h.push('</div>');
      });
    }
    h.push('</div>');
    document.getElementById('content').innerHTML = h.join('');
  }
  window.NABZ = window.NABZ || {};
  window.NABZ._cpAdd = function() {
    var options = CATS.map(function(c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
    var html = '<div id="cp_add_bg" style="position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:flex-end;justify-content:center">';
    html += '<div style="background:#fff;width:100%;max-width:560px;border-radius:20px 20px 0 0;padding:18px;direction:rtl;max-height:90vh;overflow-y:auto">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">';
    html += '<div style="font-weight:900;font-size:16px">+ مشکل مراقبتی جدید</div>';
    html += '<button onclick="document.getElementById(\'cp_add_bg\').remove()" style="background:#f1f5f9;border:none;border-radius:8px;padding:6px 10px;font-size:14px;cursor:pointer">✕</button></div>';
    html += '<div style="margin-bottom:10px"><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">دسته</label>';
    html += '<select id="cp_category" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box">' + options + '</select></div>';
    html += '<div style="margin-bottom:10px"><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">مشکل <span style="color:#dc2626">*</span></label>';
    html += '<textarea id="cp_problem" placeholder="مثلاً: اختلال در تبادل گاز ریوی" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:50px"></textarea></div>';
    html += '<div style="margin-bottom:10px"><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">هدف</label>';
    html += '<textarea id="cp_goal" placeholder="مثلاً: SpO2 بالای ۹۴٪ در ۲۴ ساعت" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:50px"></textarea></div>';
    html += '<div style="margin-bottom:10px"><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">مداخلات (هر خط یک مداخله)</label>';
    html += '<textarea id="cp_interventions" placeholder="اکسیژن ۲ لیتر&#10;پوزیشن نیمه‌نشسته" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:70px"></textarea></div>';
    html += '<button onclick="NABZ._cpSave()" style="width:100%;padding:14px;border:none;border-radius:12px;background:#16a34a;color:#fff;font-weight:900;font-size:15px;cursor:pointer">ثبت</button>';
    html += '</div></div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
  };
  window.NABZ._cpSave = async function() {
    var g = function(id) { var e = document.getElementById(id); return e ? e.value : ''; };
    var problem = g('cp_problem').trim();
    if (!problem) { alert('مشکل الزامی است'); return; }
    var interventions = g('cp_interventions').split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
    var body = { category: g('cp_category'), problem: problem, goal: g('cp_goal'), interventions: interventions, status: 'active' };
    try {
      await api('/api/ed/careplan/' + encodeURIComponent(S.visitId), { method: 'POST', body: JSON.stringify(body) });
      var bg = document.getElementById('cp_add_bg'); if (bg) bg.remove();
      if (window.NABZ._toast) NABZ._toast('✅ مشکل ثبت شد');
      await load();
    } catch (e) { alert('خطا: ' + e.message); }
  };
  window.NABZ._cpResolve = async function(planId) {
    var evalText = (await NABZ.dialog.form({ icon: '📋', title: 'ارزیابی نهایی (اختیاری)', fields: [{ key: 'v', label: 'ارزیابی نهایی', type: 'textarea' }], submitLabel: 'تأیید' }).then(d => d && d.v)) || '';
    try {
      await api('/api/ed/careplan/' + encodeURIComponent(S.visitId) + '/' + encodeURIComponent(planId), { method: 'POST', body: JSON.stringify({ status: 'resolved', evaluation: evalText }) });
      if (window.NABZ._toast) NABZ._toast('✅ مشکل حل شد');
      await load();
    } catch (e) { alert('خطا: ' + e.message); }
  };
  (function wait() {
    if (typeof NABZ !== 'undefined' && typeof NABZ.registerKind === 'function') { NABZ.registerKind('ed_careplan', show); return; }
    if ((window.__cpR = (window.__cpR || 0) + 1) > 100) return;
    setTimeout(wait, 50);
  })();
})();
