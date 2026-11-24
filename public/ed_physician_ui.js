// public/ed_physician_ui.js — Physician Workspace (3 columns)
(function () {
  'use strict';

  function apiCall(url, opts) {
    if (typeof NABZ !== 'undefined' && typeof NABZ._api === 'function') return NABZ._api(url, opts);
    return fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' }, credentials: 'include' }, opts || {}))
      .then(r => r.json().then(j => { if (!r.ok) throw new Error(j.error || j.message || r.status); return j; }));
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function apiData(r) { return (r && r.data) ? r.data : r; }
  function apiList(r) { const d = apiData(r); if (Array.isArray(d)) return d; if (d && Array.isArray(d.rows)) return d.rows; return []; }
  function esiColor(l) { return ({1:'#dc2626',2:'#ea580c',3:'#ca8a04',4:'#16a34a',5:'#0284c7'})[l] || '#64748b'; }
  function slaColor(dueAt) {
    if (!dueAt) return '#64748b';
    const m = (new Date(dueAt).getTime() - Date.now()) / 60000;
    if (m < 0) return '#dc2626';
    if (m < 10) return '#dc2626';
    if (m < 30) return '#f59e0b';
    return '#16a34a';
  }
  function slaLabel(dueAt) {
    if (!dueAt) return '—';
    const m = Math.round((new Date(dueAt).getTime() - Date.now()) / 60000);
    if (m < 0) return 'عقب‌افتاده ' + Math.abs(m) + 'د';
    return m + 'د';
  }
  function fmtTime(t) {
    if (!t) return '—';
    try { return new Date(t).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return '—'; }
  }

  const S = {
    role: null, worklist: { rows: [], total: 0, mine: 0 },
    cartable: { pending_cosign: [], pending_attending: [], lab_review: [], consult_accept: [], my_tasks: [] },
    currentVisitId: null, currentPatient: null, activeTab: 'sbar',
    timer: null, autoRefresh: null
  };

  const ROLE_LABEL = {
    intern: 'کارورز', resident_1: 'رزیدنت ۱',
    resident_senior: 'رزیدنت ارشد', attending: 'استاد',
    attending_consultant: 'استاد مشاور', admin: 'مدیر'
  };

  function getUrlVisitId() {
    const hash = window.location.hash || '';
    const m = hash.match(/#\/ed\/physician\/v\/([^\/\?&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function roleOf() {
    const u = (window.NABZ && NABZ.user) || (window.S && window.S.user) || null;
    if (u && u.role) return u.role;
    try { const stored = JSON.parse(localStorage.getItem('nabz_u') || '{}'); if (stored.role) return stored.role; } catch (_) {}
    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: outer shell (3 columns)
  // ─────────────────────────────────────────────────────────────
  function shell() {
    const role = S.role || roleOf();
    const roleLbl = ROLE_LABEL[role] || '—';
    let h = '<div id="ph_root" style="direction:rtl;background:#f1f5f9;min-height:100vh;padding:12px">';
    h += '<div style="background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;border-radius:14px;padding:12px 16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">';
    h += '<div><div style="font-size:16px;font-weight:900">👨‍⚕️ فضای کار پزشک</div>';
    h += '<div style="font-size:11px;opacity:.8;margin-top:2px">' + esc(roleLbl) + ' · کارتابل من</div></div>';
    h += '<div style="display:flex;gap:8px"><button type="button" onclick="NABZ._phRefresh()" style="background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:10px;padding:8px 14px;font-weight:800;font-size:12px;cursor:pointer">⟳ بروزرسانی</button>';
    h += '<button type="button" onclick="(window.NABZ_NAV?NABZ_NAV.go(\'ed/cc/board\'):NABZ.show(\'ed_cc\'))" style="background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:10px;padding:8px 14px;font-weight:800;font-size:12px;cursor:pointer">🚨 CC</button></div>';
    h += '</div>';
    h += '<div id="ph_grid" style="display:grid;grid-template-columns:260px 1fr 300px;gap:12px;align-items:start">';
    h += '<div id="ph_worklist" style="background:#fff;border-radius:14px;padding:10px;border:1px solid #e2e8f0;max-height:calc(100vh - 140px);overflow-y:auto"></div>';
    h += '<div id="ph_workspace" style="background:#fff;border-radius:14px;padding:14px;border:1px solid #e2e8f0;min-height:500px"></div>';
    h += '<div id="ph_cartable" style="background:#fff;border-radius:14px;padding:10px;border:1px solid #e2e8f0;max-height:calc(100vh - 140px);overflow-y:auto"></div>';
    h += '</div></div>';
    h += '<style>@media (max-width:900px){#ph_grid{grid-template-columns:1fr!important}#ph_worklist,#ph_cartable{max-height:none!important}}</style>';
    return h;
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: worklist (left column)
  // ─────────────────────────────────────────────────────────────
  function renderWorklist() {
    const el = document.getElementById('ph_worklist');
    if (!el) return;
    const rows = S.worklist.rows || [];
    let h = '<div style="font-size:12px;font-weight:900;margin-bottom:8px;color:#0f172a">ورک‌لیست (' + rows.length + ')</div>';
    if (rows.length === 0) {
      h += '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">بیمار فعالی نیست</div>';
    } else {
      const byEsi = {1:[],2:[],3:[],4:[],5:[],null:[]};
      rows.forEach(r => { const k = r.esiLevel == null ? 'null' : r.esiLevel; (byEsi[k] || byEsi.null).push(r); });
      [1,2,3,4,5,null].forEach(lvl => {
        const group = byEsi[lvl] || [];
        if (!group.length) return;
        const label = lvl === 'null' ? 'بدون تریاژ' : 'ESI ' + lvl;
        h += '<div style="font-size:10px;font-weight:900;color:' + (lvl==='null'?'#64748b':esiColor(lvl)) + ';margin:6px 0 4px">' + label + ' (' + group.length + ')</div>';
        group.forEach(r => {
          const isActive = r.id === S.currentVisitId;
          h += '<div onclick="NABZ._phOpen(\'' + esc(r.id) + '\')" style="cursor:pointer;padding:8px;border-radius:8px;margin-bottom:4px;border:1px solid ' + (isActive?'#0f172a':'#e2e8f0') + ';background:' + (isActive?'#0f172a':'#f8fafc') + ';color:' + (isActive?'#fff':'inherit') + '">';
          h += '<div style="display:flex;justify-content:space-between;gap:4px"><div style="font-weight:800;font-size:12px">' + esc(r.name) + (r.isMine?' <span style="color:#fbbf24">★</span>':'') + '</div>';
          h += '<div style="font-size:10px;opacity:.7">' + esc(r.ageLabel||'—') + '</div></div>';
          h += '<div style="font-size:10px;opacity:.75;margin-top:2px">' + esc(r.chiefComplaint||'—') + '</div>';
          h += '<div style="font-size:10px;opacity:.6;margin-top:2px">🛏 ' + esc(r.bedCode||'—') + (r.losMin!=null?' · '+r.losMin+'د':'') + '</div>';
          h += '</div>';
        });
      });
    }
    el.innerHTML = h;
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: workspace (center column)
  // ─────────────────────────────────────────────────────────────
  function renderWorkspace() {
    const el = document.getElementById('ph_workspace');
    if (!el) return;
    if (!S.currentPatient) {
      el.innerHTML = '<div style="text-align:center;padding:60px;color:#94a3b8"><div style="font-size:40px;margin-bottom:12px">👤</div><div style="font-weight:700">یک بیمار از ورک‌لیست انتخاب کن</div></div>';
      return;
    }
    const v = S.currentPatient;
    const pCtx = v.patientContext || {};
    let h = '';

    // Patient banner (reuse nursing style)
    h += '<div style="background:linear-gradient(135deg,#0f172a,#334155);color:#fff;padding:14px;border-radius:14px;margin-bottom:12px">';
    h += '<div style="display:flex;justify-content:space-between;gap:10px">';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:18px;font-weight:900">' + esc(pCtx.name||'—') + '</div>';
    h += '<div style="font-size:11px;opacity:.85;margin-top:3px">' + esc(pCtx.sex||'—') + ' · ' + esc(pCtx.ageLabel||'—');
    if (pCtx.mrn && pCtx.mrn !== '—') h += ' · MRN ' + esc(pCtx.mrn);
    h += '</div>';
    h += '<div style="font-size:11px;opacity:.85;margin-top:2px">📋 ' + esc(pCtx.chiefComplaint||'—') + '</div>';
    h += '<div style="font-size:11px;opacity:.75;margin-top:2px">🕒 ورود: ' + fmtTime(pCtx.arrivalAt) + '</div>';
    h += '</div>';
    h += '<div style="text-align:left"><div style="background:' + esiColor(pCtx.esiLevel) + ';color:#fff;padding:8px 14px;border-radius:12px;font-weight:900;font-size:16px">ESI ' + (pCtx.esiLevel||'?') + '</div>';
    h += '<div style="font-size:10px;opacity:.8;margin-top:6px">🛏 ' + esc(pCtx.bedCode||'—') + '</div></div>';
    h += '</div>';
    if (pCtx.hasAllergies) h += '<div style="background:#dc2626;padding:6px 10px;border-radius:8px;margin-top:8px;font-weight:800;font-size:12px">⚠️ حساسیت: ' + pCtx.allergies.map(esc).join('، ') + '</div>';
    h += '</div>';

    // Action bar
    h += '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">';
    const status = (pCtx.status || '').toLowerCase();
    if (status === 'waiting_doctor' || status === 'triaged' || status === 'waiting_see') {
      h += '<button onclick="NABZ._phSeePatient()" style="background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:10px 16px;font-weight:800;font-size:13px;cursor:pointer">👁 ویزیت بیمار</button>';
    }
    h += '<button onclick="NABZ._phNewOrder()" style="background:#059669;color:#fff;border:none;border-radius:10px;padding:10px 16px;font-weight:800;font-size:13px;cursor:pointer">+ دستور جدید</button>';
    h += '<button onclick="NABZ._phConsult()" style="background:#0891b2;color:#fff;border:none;border-radius:10px;padding:10px 16px;font-weight:800;font-size:13px;cursor:pointer">📞 مشاوره</button>';
    h += '<button onclick="NABZ._phVitals()" style="background:#6366f1;color:#fff;border:none;border-radius:10px;padding:10px 16px;font-weight:800;font-size:13px;cursor:pointer">📊 ویتال</button>';
    h += '</div>';

    // Tabs
    const tabs = [
      { id: 'sbar', label: '📋 SBAR' },
      { id: 'vitals', label: '📊 ویتال (' + (v.vitals||[]).length + ')' },
      { id: 'labs', label: '🔬 لَب (' + ((v.labs.resulted||[]).length) + ')' },
      { id: 'orders', label: '💊 دستورات (' + (v.orders.active||[]).length + ')' },
      { id: 'consults', label: '📞 مشاوره (' + (v.consults||[]).length + ')' },
      { id: 'timeline', label: '📜 تایم‌لاین' }
    ];
    h += '<div style="display:flex;gap:4px;overflow-x:auto;margin-bottom:12px;padding-bottom:4px">';
    tabs.forEach(t => {
      const on = t.id === S.activeTab;
      h += '<button onclick="NABZ._phTab(\'' + t.id + '\')" style="flex:0 0 auto;padding:8px 12px;border-radius:10px;border:none;font-weight:800;font-size:12px;background:' + (on?'#0f172a':'#f1f5f9') + ';color:' + (on?'#fff':'#475569') + ';cursor:pointer">' + t.label + '</button>';
    });
    h += '</div>';

    // Tab content
    h += '<div id="ph_tab_content">' + renderTabContent() + '</div>';
    el.innerHTML = h;
  }

  function renderTabContent() {
    const v = S.currentPatient;
    if (!v) return '';
    const tab = S.activeTab;
    const p = v.patientContext || {};

    if (tab === 'sbar') {
      let h = '<div style="display:grid;gap:10px">';

      // S — Situation (rich)
      const sLines = [];
      sLines.push('شکایت: ' + esc(p.chiefComplaint || '—'));
      sLines.push('ESI ' + (p.esiLevel || '?') + ' · وضعیت: ' + esc(p.status || '—'));
      if (p.arrivalAt) sLines.push('ورود: ' + fmtTime(p.arrivalAt) + (v.visit && v.visit.arrivalAt ? ' (' + Math.floor((Date.now() - new Date(v.visit.arrivalAt).getTime()) / 60000) + ' دقیقه در ED)' : ''));
      h += sbarCard('S', 'وضعیت فعلی', sLines.join(' · '));

      // B — Background (rich)
      const bLines = [];
      bLines.push('سن: ' + esc(p.ageLabel || '—') + ' · جنس: ' + esc(p.sex || '—'));
      if (p.mrn && p.mrn !== '—') bLines.push('MRN: ' + esc(p.mrn));
      if (p.bloodType && p.bloodType !== '—') bLines.push('گروه خون: ' + esc(p.bloodType));
      if (p.arrivalMode && p.arrivalMode !== '—') bLines.push('نحوه ورود: ' + esc(p.arrivalMode));
      if (p.codeStatus && p.codeStatus !== '—') bLines.push('Code Status: ' + esc(p.codeStatus));
      if (p.hasComorbidities) bLines.push('بیماری‌های همراه: ' + p.comorbidities.map(esc).join('، '));
      h += sbarCard('B', 'پیشینه', bLines.join(' · '));
      if (p.hasAllergies) {
        h += '<div style="background:#fef2f2;border:2px solid #dc2626;border-radius:10px;padding:10px;color:#991b1b;font-weight:800;font-size:13px">⚠️ حساسیت‌ها: ' + p.allergies.map(esc).join('، ') + '</div>';
      }

      // A — Assessment (rich)
      let aLines = [];
      const lastV = (v.vitals || [])[0];
      if (lastV) {
        const n = lastV.news2 != null ? lastV.news2 : (lastV.newsLevel || '—');
        const tr = v.news2Trend || '';
        aLines.push('آخرین ویتال (' + fmtTime(lastV.at || lastV.createdAt) + '): HR ' + esc(lastV.hr||'—') + ' · BP ' + esc((lastV.bp_sys||lastV.sbp||'—')+'/'+(lastV.bp_dia||lastV.dbp||'—')) + ' · RR ' + esc(lastV.rr||'—') + ' · SpO2 ' + esc(lastV.spo2||'—') + '% · T ' + esc(lastV.temp||'—') + ' · NEWS2 ' + esc(n) + (tr ? ' ' + tr : ''));
      } else {
        aLines.push('ویتال ثبت نشده');
      }
      const critLabs = (v.labs && v.labs.resulted || []).filter(l => l.is_critical);
      if (critLabs.length) aLines.push('⚠️ ' + critLabs.length + ' نتیجه بحرانی');
      const respondedConsults = (v.consults || []).filter(c => c.status === 'responded' || c.response);
      if (respondedConsults.length) aLines.push(respondedConsults.length + ' مشاوره پاسخ داده شد');
      h += sbarCard('A', 'ارزیابی', aLines.join(' · '));

      // R — Recommendation (rich)
      const rLines = [];
      rLines.push('دستورات فعال: ' + ((v.orders && v.orders.active) || []).length);
      if (v.currentMeds && v.currentMeds.length) rLines.push('داروهای فعلی: ' + v.currentMeds.map(m => m.name + (m.dose?' '+m.dose:'')).join('، '));
      rLines.push('لَب باز: ' + ((v.labs && v.labs.pending) || []).length);
      rLines.push('مشاوره باز: ' + (v.consults || []).filter(c => c.status === 'requested').length);
      h += sbarCard('R', 'توصیه و اقدام', rLines.join(' · '));
      h += '</div>';
      return h;
    }

    if (tab === 'vitals') {
      const list = v.vitals || [];
      if (!list.length) return '<div style="padding:30px;text-align:center;color:#94a3b8"><div style="font-size:40px;margin-bottom:8px">📊</div><div>ویتالی ثبت نشده</div><button onclick="NABZ._phVitals()" style="margin-top:12px;background:#6366f1;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-weight:800;cursor:pointer">+ ثبت ویتال</button></div>';
      let h = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
      h += '<thead><tr style="background:#f1f5f9;font-weight:900"><th style="padding:8px;text-align:right">زمان</th><th style="padding:8px">HR</th><th style="padding:8px">BP</th><th style="padding:8px">RR</th><th style="padding:8px">SpO2</th><th style="padding:8px">T</th><th style="padding:8px">GCS</th><th style="padding:8px">NEWS2</th></tr></thead><tbody>';
      list.forEach(x => {
        const n = x.news2 != null ? x.news2 : (x.newsLevel || '—');
        const nc = String(n).toLowerCase() === 'critical' ? '#dc2626' : String(n).toLowerCase() === 'high' ? '#ea580c' : '#16a34a';
        h += '<tr style="border-bottom:1px solid #f1f5f9">';
        h += '<td style="padding:6px;text-align:right;color:#64748b">' + fmtTime(x.at||x.createdAt) + '</td>';
        h += '<td style="padding:6px;text-align:center">' + esc(x.hr||'—') + '</td>';
        h += '<td style="padding:6px;text-align:center">' + esc((x.bp_sys||x.sbp||'—')+'/'+(x.bp_dia||x.dbp||'—')) + '</td>';
        h += '<td style="padding:6px;text-align:center">' + esc(x.rr||'—') + '</td>';
        h += '<td style="padding:6px;text-align:center">' + esc(x.spo2||'—') + '</td>';
        h += '<td style="padding:6px;text-align:center">' + esc(x.temp||'—') + '</td>';
        h += '<td style="padding:6px;text-align:center">' + esc(x.gcs||'—') + '</td>';
        h += '<td style="padding:6px;text-align:center;color:' + nc + ';font-weight:800">' + esc(n) + '</td>';
        h += '</tr>';
      });
      h += '</tbody></table></div>';
      h += '<button onclick="NABZ._phVitals()" style="margin-top:12px;background:#6366f1;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-weight:800;cursor:pointer">+ ثبت ویتال جدید</button>';
      return h;
    }

    if (tab === 'labs') {
      const pending = v.labs.pending || [];
      const resulted = v.labs.resulted || [];
      let h = '';
      if (pending.length) {
        h += '<div style="font-weight:900;font-size:12px;margin-bottom:6px;color:#f59e0b">⏳ در انتظار (' + pending.length + ')</div>';
        pending.forEach(l => {
          h += '<div style="background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:10px;margin-bottom:6px;font-size:12px"><b>' + esc(l.test_type||'—') + '</b></div>';
        });
      }
      if (resulted.length) {
        h += '<div style="font-weight:900;font-size:12px;margin:12px 0 6px;color:#0891b2">✅ نتیجه‌دار (' + resulted.length + ')</div>';
        resulted.forEach(l => {
          const bg = l.is_critical ? '#fef2f2' : '#f0fdf4';
          const bd = l.is_critical ? '#dc2626' : '#16a34a';
          h += '<div style="background:'+bg+';border:1px solid '+bd+';border-radius:8px;padding:10px;margin-bottom:6px;font-size:12px">';
          h += '<div style="display:flex;justify-content:space-between"><b>' + esc(l.test_type||'—') + '</b>';
          if (l.is_critical) h += '<span style="color:#dc2626;font-weight:900">⚠️ بحرانی</span>';
          h += '</div>';
          if (l.result_summary) h += '<div style="margin-top:4px;font-family:monospace">' + esc(l.result_summary) + '</div>';
          h += '<div style="color:#64748b;font-size:10px;margin-top:4px">' + fmtTime(l.resulted_at) + '</div>';
          h += '</div>';
        });
      }
      if (!pending.length && !resulted.length) return '<div style="padding:30px;text-align:center;color:#94a3b8"><div style="font-size:40px;margin-bottom:8px">🔬</div><div>لَبی ثبت نشده</div><button onclick="NABZ._phNewOrder()" style="margin-top:12px;background:#059669;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-weight:800;cursor:pointer">+ درخواست لَب</button></div>';
      return h;
    }

    if (tab === 'orders') {
      const active = v.orders.active || [];
      const history = v.orders.history || [];
      let h = '<div style="font-weight:900;font-size:12px;margin-bottom:6px">فعال (' + active.length + ')</div>';
      if (!active.length) h += '<div style="text-align:center;padding:12px;color:#94a3b8;font-size:12px">دستور فعالی نیست</div>';
      active.forEach(o => {
        const st = o.status;
        const stColor = st==='verified'||st==='active'?'#16a34a':st==='pending_cosign'?'#f59e0b':st==='pending_attending'?'#ea580c':st==='drafted'?'#94a3b8':st==='rejected'?'#dc2626':'#64748b';
        h += '<div style="background:#fff;border:1px solid #e2e8f0;border-inline-start:4px solid '+stColor+';border-radius:8px;padding:10px;margin-bottom:6px;font-size:12px">';
        h += '<div style="display:flex;justify-content:space-between"><div><b>' + esc(o.item||o.drugName||'—') + '</b> ' + esc(o.dose||'') + (o.route?' <span style="color:#64748b">'+esc(o.route)+'</span>':'') + '</div>';
        h += '<div style="font-size:10px;font-weight:900;color:'+stColor+'">' + esc(st) + '</div></div>';
        if (o.author && o.author.name) h += '<div style="font-size:10px;color:#64748b;margin-top:2px">نویسنده: ' + esc(o.author.name) + ' (' + esc(o.author.role||'—') + ')</div>';
        if (o.cosigner && o.cosigner.name) h += '<div style="font-size:10px;color:#0891b2;margin-top:1px">تأیید: ' + esc(o.cosigner.name) + '</div>';
        if (o.attending_cosigner && o.attending_cosigner.name) h += '<div style="font-size:10px;color:#7c3aed;margin-top:1px">تأیید استاد: ' + esc(o.attending_cosigner.name) + '</div>';
        if (o.clinical_reason) h += '<div style="font-size:10px;color:#475569;margin-top:3px;font-style:italic">دلیل: ' + esc(o.clinical_reason) + '</div>';
        if (o.status === 'pending_cosign' && ['resident_1','resident_senior','attending','admin'].includes(S.role)) {
          h += '<div style="margin-top:6px;display:flex;gap:4px">';
          h += '<button onclick="NABZ._phCosign(\'' + esc(o.id) + '\')" style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:10px;font-weight:800;cursor:pointer">✓ تأیید</button>';
          h += '<button onclick="NABZ._phReject(\'' + esc(o.id) + '\')" style="background:#dc2626;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:10px;font-weight:800;cursor:pointer">✗ رد</button>';
          h += '</div>';
        }
        if (o.status === 'pending_attending' && ['attending','attending_consultant','admin'].includes(S.role)) {
          h += '<div style="margin-top:6px;display:flex;gap:4px">';
          h += '<button onclick="NABZ._phAttCosign(\'' + esc(o.id) + '\')" style="background:#7c3aed;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:10px;font-weight:800;cursor:pointer">✓ تأیید استاد</button>';
          h += '<button onclick="NABZ._phReject(\'' + esc(o.id) + '\')" style="background:#dc2626;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:10px;font-weight:800;cursor:pointer">✗ رد</button>';
          h += '</div>';
        }
        h += '</div>';
      });
      if (history.length) {
        h += '<div style="font-weight:900;font-size:12px;margin:12px 0 6px;color:#64748b">تاریخچه (' + history.length + ')</div>';
        history.slice(0, 10).forEach(o => {
          h += '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px;margin-bottom:4px;font-size:11px;opacity:.7"><b>' + esc(o.item||o.drugName||'—') + '</b> · ' + esc(o.status) + ' · ' + esc((o.author&&o.author.name)||'—') + '</div>';
        });
      }
      return h;
    }

    if (tab === 'consults') {
      const list = v.consults || [];
      if (!list.length) return '<div style="padding:30px;text-align:center;color:#94a3b8"><div style="font-size:40px;margin-bottom:8px">📞</div><div>مشاوره‌ای نیست</div><button onclick="NABZ._phConsult()" style="margin-top:12px;background:#0891b2;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-weight:800;cursor:pointer">+ درخواست مشاوره</button></div>';
      let h = '';
      list.forEach(c => {
        const stColor = c.status === 'requested' ? '#f59e0b' : c.status === 'responded' ? '#16a34a' : '#0891b2';
        h += '<div style="background:#fff;border:1px solid #e2e8f0;border-inline-start:4px solid '+stColor+';border-radius:8px;padding:10px;margin-bottom:8px;font-size:12px">';
        h += '<div style="display:flex;justify-content:space-between"><div style="font-weight:800">📞 ' + esc(c.targetService||c.service||'—') + '</div>';
        h += '<span style="color:'+stColor+';font-size:10px;font-weight:900">' + esc(c.status||'—') + '</span></div>';
        if (c.clinicalQuestion || c.question) h += '<div style="color:#475569;margin-top:4px"><b>سوال:</b> ' + esc(c.clinicalQuestion||c.question) + '</div>';
        if (c.response) h += '<div style="background:#f0f9ff;padding:8px;border-radius:6px;margin-top:6px"><b>پاسخ:</b> ' + esc(c.response) + '</div>';
        if (c.respondedBy) h += '<div style="font-size:10px;color:#64748b;margin-top:4px">پاسخ‌دهنده: ' + esc(c.respondedBy) + '</div>';
        h += '</div>';
      });
      return h;
    }

    if (tab === 'timeline') {
      const tl = v.timeline || [];
      if (!tl.length) return '<div style="padding:30px;text-align:center;color:#94a3b8">تایم‌لاینی نیست</div>';
      let h = '<div style="position:relative">';
      const iconMap = { order:'💊', vitals:'📊', consult:'📞', lab:'🔬', task:'📋' };
      const colorMap = { order:'#059669', vitals:'#6366f1', consult:'#0891b2', lab:'#f59e0b', task:'#dc2626' };
      tl.forEach(e => {
        h += '<div style="padding:8px 12px;border-inline-start:3px solid '+(colorMap[e.type]||'#94a3b8')+';margin-bottom:6px;background:#f8fafc;border-radius:6px">';
        h += '<div style="font-size:12px;font-weight:800">' + (iconMap[e.type]||'•') + ' ' + esc(e.label) + '</div>';
        h += '<div style="font-size:10px;color:#94a3b8;margin-top:2px">' + fmtTime(e.at) + (e.status?' · '+esc(e.status):'') + (e.by?' · '+esc(e.by):'') + '</div>';
        h += '</div>';
      });
      h += '</div>';
      return h;
    }

    return '';
  }

  function sbarCard(letter, title, content) {
    const colors = { S:'#dc2626', B:'#ea580c', A:'#ca8a04', R:'#16a34a' };
    return '<div style="background:#fff;border:1px solid #e2e8f0;border-inline-start:4px solid ' + (colors[letter]||'#64748b') + ';border-radius:10px;padding:10px"><div style="font-size:11px;font-weight:900;color:'+(colors[letter]||'#64748b')+'">'+letter+' — '+title+'</div><div style="font-size:12px;margin-top:4px">'+content+'</div></div>';
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER: cartable (right column)
  // ─────────────────────────────────────────────────────────────
  function renderCartable() {
    const el = document.getElementById('ph_cartable');
    if (!el) return;
    const c = S.cartable || {};
    let h = '<div style="font-size:12px;font-weight:900;margin-bottom:8px;color:#0f172a">📋 کارتابل من</div>';
    const section = (title, items, color, renderItem) => {
      if (!items || !items.length) return '';
      let s = '<div style="font-size:10px;font-weight:900;color:'+color+';margin:8px 0 4px">' + title + ' (' + items.length + ')</div>';
      items.forEach(it => { s += renderItem(it); });
      return s;
    };

    h += section('✍️ cosign من', c.pending_cosign, '#0891b2', o => {
      return '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;margin-bottom:4px;font-size:11px"><div style="font-weight:800">' + esc(o.item||'—') + ' ' + esc(o.dose||'') + (o.isHighAlert?' <span style="color:#dc2626">⚠️</span>':'') + '</div><div style="font-size:10px;color:#64748b;margin-top:2px">' + esc((o.author&&o.author.name)||'—') + '</div></div>';
    });

    h += section('👨‍⚕️ High-Alert منتظر استاد', c.pending_attending, '#7c3aed', o => {
      return '<div style="background:#faf5ff;border:1px solid #c4b5fd;border-radius:8px;padding:8px;margin-bottom:4px;font-size:11px"><div style="font-weight:800">' + esc(o.item||'—') + ' ' + esc(o.dose||'') + '</div><div style="font-size:10px;color:#64748b">تأیید رزیدنت: ' + esc((o.cosigner&&o.cosigner.name)||'—') + '</div></div>';
    });

    h += section('🔬 لَب بازبینی', c.lab_review, '#f59e0b', t => {
      const v = S.currentVisitId || (t.related && t.related.visit_id);
      const vid = v ? esc(v) : null;
      return '<div onclick="' + (vid ? 'NABZ._phOpen(\''+vid+'\')' : '') + '" style="cursor:pointer;background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:8px;margin-bottom:4px;font-size:11px"><div style="font-weight:800">' + esc((t.context&&t.context.summary)||t.type) + '</div><div style="font-size:10px;color:#92400e">' + slaLabel(t.due_at) + '</div></div>';
    });

    h += section('📞 مشاوره برای قبول', c.consult_accept, '#0891b2', t => {
      return '<div style="background:#f0f9ff;border:1px solid #7dd3fc;border-radius:8px;padding:8px;margin-bottom:4px;font-size:11px"><div style="font-weight:800">' + esc((t.context&&t.context.summary)||t.type) + '</div></div>';
    });

    h += section('📋 وظایف من', c.my_tasks, '#0f172a', t => {
      const vid = t.related && t.related.visit_id;
      const vidEsc = vid ? esc(vid) : null;
      const v = S.currentVisitId || vid;
      const vEsc = v ? esc(v) : null;
      const onclick = vEsc ? 'NABZ._phOpen(\''+vEsc+'\')' : '';
      return '<div onclick="' + onclick + '" style="cursor:pointer;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:8px;margin-bottom:4px;font-size:11px"><div style="font-weight:800">' + esc((t.context&&t.context.summary)||t.type) + '</div><div style="font-size:10px;color:'+slaColor(t.due_at)+';font-weight:800">' + slaLabel(t.due_at) + '</div></div>';
    });

    if (h.indexOf('border-radius:8px') === -1) h += '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">🎉 کارتابل خالی است</div>';
    el.innerHTML = h;
  }

  // ─────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────
  async function loadAll() {
    try {
      const [w, c] = await Promise.all([
        apiCall('/api/ed/physician/worklist').then(apiData),
        apiCall('/api/ed/physician/cartable').then(apiData)
      ]);
      S.worklist = w || { rows: [], total: 0 };
      S.cartable = c || {};
      renderWorklist();
      renderCartable();
    } catch (e) { console.error('[ph] loadAll', e); }
  }

  async function openVisit(visitId, opts) {
    if (!visitId) return;
    const o = opts || {};

    // No-op if same patient already loaded and not forced
    if (S.currentVisitId === visitId && S.currentPatient && !o.force) {
      if (!o.silent) { renderWorkspace(); renderWorklist(); }
      return;
    }

    S.currentVisitId = visitId;
    try {
      const r = await apiCall('/api/ed/physician/patient/' + encodeURIComponent(visitId)).then(apiData);
      if (r && !r.error) S.currentPatient = r;
      else S.currentPatient = null;
    } catch (e) {
      S.currentPatient = null;
      console.error('[ph] openVisit', e);
    }

    // Update URL WITHOUT triggering NABZ_NAV.go() — breaks the loop
    try {
      const newHash = '#/ed/physician/v/' + encodeURIComponent(visitId);
      if (window.location.hash !== newHash) {
        window.history.replaceState({ route: 'ed/physician/v', visitId }, '', newHash);
      }
    } catch (_) {}

    if (!o.silent) {
      renderWorkspace();
      renderWorklist();
    } else if (S.currentPatient) {
      renderWorkspace();
    }
  }

  async function cosignOrder(id, stage) {
    const url = stage === 'attending' ? '/api/ed/orders/' + id + '/attending-cosign' : '/api/ed/orders/' + id + '/cosign';
    try {
      await apiCall(url, { method: 'POST', body: '{}' });
      if (window.NABZ._toast) NABZ._toast('✅ تأیید شد');
      await loadAll();
      if (S.currentVisitId) await openVisit(S.currentVisitId);
    } catch (e) { alert('خطا: ' + e.message); }
  }

  async function rejectOrder(id) {
    const reason = prompt('دلیل رد (حداقل ۵ کاراکتر):');
    if (!reason || reason.length < 5) { alert('دلیل حداقل ۵ کاراکتر لازم است'); return; }
    try {
      await apiCall('/api/ed/orders/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) });
      if (window.NABZ._toast) NABZ._toast('دستور رد شد');
      await loadAll();
      if (S.currentVisitId) await openVisit(S.currentVisitId);
    } catch (e) { alert('خطا: ' + e.message); }
  }

  function newOrderSheet() {
    const v = S.currentPatient;
    if (!v) { alert('اول یک بیمار انتخاب کن'); return; }
    const pCtx = v.patientContext || {};
    const visitId = v.visit.id;
    const pid = pCtx.patientId || v.visit.patientId || visitId;
    
    const tabs = [
      { id: 'drug', label: '💊 دارو', active: true },
      { id: 'lab', label: '🔬 لَب', active: false },
      { id: 'imaging', label: '🩻 تصویربرداری', active: false },
      { id: 'nursing', label: '💉 پرستاری', active: false }
    ];
    
    let tabBar = '<div style="display:flex;gap:4px;overflow-x:auto;margin-bottom:14px">';
    tabs.forEach(t => {
      tabBar += '<button type="button" onclick="NABZ._phOrderTab(\'' + t.id + '\')" data-ph-order-tab="' + t.id + '" style="flex:0 0 auto;padding:9px 14px;border-radius:10px;border:none;font-weight:800;font-size:12px;cursor:pointer;background:' + (t.active?'#0f172a':'#f1f5f9') + ';color:' + (t.active?'#fff':'#475569') + '">' + t.label + '</button>';
    });
    tabBar += '</div>';
    
    const html = '<div id="ph_order_bg" style="position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center">'
      + '<div style="background:#fff;width:100%;max-width:640px;border-radius:20px 20px 0 0;padding:18px;direction:rtl;max-height:92vh;overflow-y:auto">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
      + '<div style="font-weight:900;font-size:16px">+ دستور جدید برای ' + esc(pCtx.name || 'بیمار') + '</div>'
      + '<button onclick="document.getElementById(\'ph_order_bg\').remove()" style="background:#f1f5f9;border:none;border-radius:8px;padding:6px 10px;font-size:14px;cursor:pointer">✕</button></div>'
      + tabBar
      + '<div id="ph_order_tab_content">' + orderTabDrug() + '</div>'
      + '<div style="margin-top:14px;display:flex;gap:6px">' + orderActionButtons(visitId, pid) + '</div>'
      + '</div></div>';
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
  }

  function orderTabDrug() {
    return '<div style="display:grid;gap:8px">'
      + '<div><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">دارو <span style="color:#dc2626">*</span></label>'
      + '<input id="ph_o_item" type="text" placeholder="مثلاً: مورفین" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + '<div><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">دوز</label><input id="ph_o_dose" type="text" placeholder="10" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"></div>'
      + '<div><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">واحد</label><input id="ph_o_unit" type="text" placeholder="mg" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"></div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + '<div><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">مسیر</label><select id="ph_o_route" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"><option value="">—</option><option value="IV">IV (وریدی)</option><option value="PO">PO (خوراکی)</option><option value="IM">IM (عضلانی)</option><option value="SC">SC (زیرجلدی)</option><option value="SL">SL (زیرزبانی)</option><option value="INH">INH (استنشاقی)</option><option value="PR">PR (رکتال)</option><option value="TOP">TOP (موضعی)</option></select></div>'
      + '<div><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">فرکانس</label><select id="ph_o_frequency" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"><option value="">—</option><option value="stat">Stat (فوری)</option><option value="once">Once (یک‌بار)</option><option value="q1h">q1h</option><option value="q2h">q2h</option><option value="q4h">q4h</option><option value="q6h">q6h</option><option value="q8h">q8h</option><option value="q12h">q12h</option><option value="bid">BID</option><option value="tid">TID</option><option value="qid">QID</option><option value="daily">Daily</option><option value="PRN">PRN (در صورت نیاز)</option></select></div>'
      + '</div>'
      + '<div id="ph_o_highalert_warn" style="display:none;background:#fef2f2;border:2px solid #dc2626;border-radius:10px;padding:10px;font-size:12px;font-weight:800;color:#991b1b">⚠️ داروی پرخطر — نیاز به تأیید استاد</div>'
      + '<div><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">دلیل بالینی <span style="color:#dc2626">*</span></label>'
      + '<textarea id="ph_o_reason" placeholder="چرا این دارو؟ (حداقل ۵ کاراکتر)" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:60px"></textarea></div>'
      + '</div>';
  }

  function orderTabLab() {
    return '<div style="display:grid;gap:8px">'
      + '<div><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">تست / پنل <span style="color:#dc2626">*</span></label>'
      + '<input id="ph_o_item" type="text" placeholder="مثلاً: CBC, BMP, Troponin" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"></div>'
      + '<div><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">فوریت</label>'
      + '<select id="ph_o_frequency" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"><option value="routine">روتین</option><option value="urgent">فوری</option><option value="stat">STAT</option></select></div>'
      + '<div><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">دلیل بالینی <span style="color:#dc2626">*</span></label>'
      + '<textarea id="ph_o_reason" placeholder="چرا این تست؟" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:60px"></textarea></div>'
      + '</div>';
  }

  function orderTabImaging() {
    return '<div style="display:grid;gap:8px">'
      + '<div><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">نوع تصویربرداری <span style="color:#dc2626">*</span></label>'
      + '<select id="ph_o_item" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"><option value="">انتخاب...</option><option value="CXR">CXR (رادیوگرافی قفسه سینه)</option><option value="CT-Brain">CT مغز</option><option value="CT-Chest">CT قفسه سینه</option><option value="CT-Abdomen">CT شکم</option><option value="FAST">FAST (سونوگرافی)</option><option value="Echo">اکوکاردیوگرافی</option><option value="MRI">MRI</option><option value="US-Abdomen">سونوگرافی شکم</option></select></div>'
      + '<div><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">فوریت</label>'
      + '<select id="ph_o_frequency" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"><option value="routine">روتین</option><option value="urgent">فوری</option><option value="stat">STAT</option></select></div>'
      + '<div><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">دلیل بالینی <span style="color:#dc2626">*</span></label>'
      + '<textarea id="ph_o_reason" placeholder="چرا این تصویربرداری؟" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:60px"></textarea></div>'
      + '</div>';
  }

  function orderTabNursing() {
    return '<div style="display:grid;gap:8px">'
      + '<div><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">اقدام پرستاری <span style="color:#dc2626">*</span></label>'
      + '<select id="ph_o_item" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"><option value="">انتخاب...</option><option value="NPO">NPO (ناشتا)</option><option value="Vitals-q15">علائم حیاتی هر ۱۵ دقیقه</option><option value="Vitals-q30">علائم حیاتی هر ۳۰ دقیقه</option><option value="Vitals-q1h">علائم حیاتی هر ۱ ساعت</option><option value="O2-nasal">اکسیژن نازال</option><option value="Foley">سوند ادراری</option><option value="IV-access">دسترسی وریدی</option><option value="Position">پوزیشن</option><option value="Strict-IO">I&O دقیق</option></select></div>'
      + '<div><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">دلیل</label>'
      + '<textarea id="ph_o_reason" placeholder="توضیحات..." style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:60px"></textarea></div>'
      + '</div>';
  }

  window.NABZ._phOrderTab = function(tab) {
    const map = { drug: orderTabDrug, lab: orderTabLab, imaging: orderTabImaging, nursing: orderTabNursing };
    const fn = map[tab] || orderTabDrug;
    const container = document.getElementById('ph_order_tab_content');
    if (container) container.innerHTML = fn();
    document.querySelectorAll('[data-ph-order-tab]').forEach(b => {
      const isActive = b.getAttribute('data-ph-order-tab') === tab;
      b.style.background = isActive ? '#0f172a' : '#f1f5f9';
      b.style.color = isActive ? '#fff' : '#475569';
    });
    if (tab === 'drug') {
      const itemEl = document.getElementById('ph_o_item');
      if (itemEl) itemEl.addEventListener('input', checkHighAlert);
    }
  };

  function checkHighAlert() {
    const el = document.getElementById('ph_o_item');
    const warn = document.getElementById('ph_o_highalert_warn');
    if (!el || !warn) return;
    const v = String(el.value || '');
    const patterns = [/مورفین|morphine/i, /هپارین|heparin/i, /انسولین|insulin/i, /پتاسیم|potassium/i, /وارفارین|warfarin/i, /اپی‌نفرین|epinephrine|آدرنالین/i, /نوراپی‌نفرین/i, /آمیودارون/i, /دیگوکسین/i, /فنتانیل|fentanyl/i, /میدازولام/i];
    warn.style.display = patterns.some(p => p.test(v)) ? 'block' : 'none';
  }

  function orderActionButtons(visitId, pid) {
    const role = S.role || 'intern';
    let h = '';
    if (role === 'intern') {
      h += '<button type="button" onclick="NABZ._phSubmitOrder(\'' + visitId + '\', \'' + pid + '\', \'draft\')" style="flex:1;background:#0f172a;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:800;font-size:13px;cursor:pointer">ارسال برای تأیید رزیدنت</button>';
    } else {
      h += '<button type="button" onclick="NABZ._phSubmitOrder(\'' + visitId + '\', \'' + pid + '\', \'direct\')" style="flex:1;background:#16a34a;color:#fff;border:none;border-radius:10px;padding:12px;font-weight:800;font-size:13px;cursor:pointer">ثبت و فعال‌سازی</button>';
    }
    return h;
  }

  async function submitOrder(visitId, pid, mode) {
    const activeTabBtn = document.querySelector('[data-ph-order-tab]');
    let type = 'drug';
    const allTabs = document.querySelectorAll('[data-ph-order-tab]');
    allTabs.forEach(b => { if (b.style.background === 'rgb(15, 23, 42)' || b.style.background === '#0f172a') type = b.getAttribute('data-ph-order-tab'); });

    const item = (document.getElementById('ph_o_item') || {}).value || '';
    const dose = (document.getElementById('ph_o_dose') || {}).value || '';
    const unit = (document.getElementById('ph_o_unit') || {}).value || '';
    const route = (document.getElementById('ph_o_route') || {}).value || '';
    const frequency = (document.getElementById('ph_o_frequency') || {}).value || '';
    const reason = (document.getElementById('ph_o_reason') || {}).value || '';
    
    if (!item) { alert('نام/اقدام را وارد کن'); return; }
    if (reason.length < 5) { alert('دلیل بالینی حداقل ۵ کاراکتر'); return; }
    
    const doseFull = (dose + ' ' + unit).trim();
    const payload = {
      visitId, patientId: pid,
      item, dose: doseFull, route, frequency,
      type: type === 'lab' ? 'lab' : type === 'imaging' ? 'imaging' : type === 'nursing' ? 'nursing' : 'drug',
      clinical_reason: reason
    };
    
    try {
      const r = await apiCall('/api/ed/orders/draft', { method: 'POST', body: JSON.stringify(payload) }).then(apiData);
      const ordId = r && (r.id || (r.data && r.data.id));
      if (!ordId) { alert('خطا در ثبت دستور — پاسخ نامعتبر'); return; }
      
      if (mode === 'draft') {
        await apiCall('/api/ed/orders/' + ordId + '/submit', { method: 'POST', body: '{}' });
        if (window.NABZ._toast) NABZ._toast('✅ برای تأیید ارسال شد');
      } else {
        await apiCall('/api/ed/orders/' + ordId + '/submit', { method: 'POST', body: '{}' });
        await apiCall('/api/ed/orders/' + ordId + '/cosign', { method: 'POST', body: JSON.stringify({ note: 'direct' }) });
        if (window.NABZ._toast) NABZ._toast('✅ دستور فعال شد — MAR ایجاد شد');
      }
      
      const bg = document.getElementById('ph_order_bg'); if (bg) bg.remove();
      if (S.currentVisitId) await openVisit(S.currentVisitId, { force: true });
      await loadAll();
    } catch (e) { alert('خطا: ' + e.message); }
  }


  async function seePatient() {
    const v = S.currentPatient;
    if (!v) { alert('بیماری انتخاب نشده'); return; }
    const vid = v.visit && v.visit.id;
    if (!vid) { alert('شناسه ویزیت نیست'); return; }
    const btn = document.querySelector('[onclick*="_phSeePatient"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ در حال ثبت...'; }
    try {
      const r = await apiCall('/api/emergency/visits/' + encodeURIComponent(vid) + '/action/see', {
        method: 'POST', body: JSON.stringify({ by: S.role })
      });
      if (r && r.ok === false) throw new Error(r.error || r.message || 'unknown_error');
      if (window.NABZ._toast) NABZ._toast('✅ بیمار ویزیت شد');
      await openVisit(vid, { force: true });
      await loadAll();
      if (btn) { btn.disabled = false; btn.textContent = '👁 ویزیت بیمار'; }
    } catch (e) {
      const msg = String(e.message || e);
      if (/invalid|transition|current_state/.test(msg)) {
        try {
          const r2 = await apiCall('/api/emergency/visits/' + encodeURIComponent(vid) + '/action/observe', { method: 'POST', body: '{}' });
          if (r2 && r2.ok === false) throw new Error(r2.error || r2.message);
          if (window.NABZ._toast) NABZ._toast('✅ وضعیت بیمار در حال درمان');
          await openVisit(vid, { force: true });
          await loadAll();
        } catch (e2) {
          alert('خطا: ' + msg + '\nوضعیت فعلی: ' + ((v.patientContext && v.patientContext.status) || '—'));
        }
      } else {
        alert('خطا: ' + msg);
      }
      if (btn) { btn.disabled = false; btn.textContent = '👁 ویزیت بیمار'; }
    }
  }

  function vitalsSheet() {
    const v = S.currentPatient;
    if (!v) { alert('اول یک بیمار انتخاب کن'); return; }
    const p = v.patientContext || {};
    const pid = p.patientId || (v.visit && v.visit.patientId) || (v.visit && v.visit.id);
    const vid = v.visit && v.visit.id;
    const html = '<div id="ph_vitals_bg" style="position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center">'
      + '<div style="background:#fff;width:100%;max-width:560px;border-radius:20px 20px 0 0;padding:18px;direction:rtl;max-height:90vh;overflow-y:auto">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'
      + '<div style="font-weight:900;font-size:16px">📊 ثبت علائم حیاتی</div>'
      + '<button onclick="document.getElementById(\'ph_vitals_bg\').remove()" style="background:#f1f5f9;border:none;border-radius:8px;padding:6px 10px;font-size:14px;cursor:pointer">✕</button></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">'
      + vfield('ph_v_hr', 'HR (نبض)', 'number', '')
      + vfield('ph_v_sbp', 'SBP (سیستول)', 'number', '')
      + vfield('ph_v_dbp', 'DBP (دیاستول)', 'number', '')
      + vfield('ph_v_rr', 'RR (تنفس)', 'number', '')
      + vfield('ph_v_spo2', 'SpO2 %', 'number', '')
      + vfield('ph_v_temp', 'دما °C', 'number', 'step="0.1"')
      + vfield('ph_v_gcs', 'GCS', 'number', '')
      + vfield('ph_v_pain', 'درد (0-10)', 'number', '')
      + '</div>'
      + '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">سطح هوشیاری</label>'
      + '<select id="ph_v_conscious" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box"><option value="alert">هوشیار (Alert)</option><option value="voice">پاسخ به صدا (Voice)</option><option value="pain">پاسخ به درد (Pain)</option><option value="unresponsive">بدون پاسخ (Unresponsive)</option></select></div>'
      + '<div id="ph_v_preview" style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:10px;font-size:12px;color:#64748b;margin-bottom:12px;text-align:center">NEWS2 محاسبه خواهد شد...</div>'
      + '<button onclick="NABZ._phSubmitVitals(\'' + pid + '\', \'' + (vid || '') + '\')" style="width:100%;padding:14px;border:none;border-radius:12px;background:#6366f1;color:#fff;font-weight:900;font-size:15px;cursor:pointer">ثبت</button>'
      + '</div></div>';
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
    // Live NEWS2 preview
    ['ph_v_hr','ph_v_sbp','ph_v_rr','ph_v_spo2','ph_v_temp','ph_v_gcs'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateNews2Preview);
    });
  }

  function vfield(id, label, type, extra) {
    return '<div><label style="font-size:11px;font-weight:800;display:block;margin-bottom:4px">' + label + '</label>'
      + '<input id="' + id + '" type="' + type + '" ' + (extra||'') + ' style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:16px;box-sizing:border-box;text-align:center"></div>';
  }

  function updateNews2Preview() {
    const g = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };
    const hr = parseFloat(g('ph_v_hr')) || 0;
    const sbp = parseFloat(g('ph_v_sbp')) || 0;
    const rr = parseFloat(g('ph_v_rr')) || 0;
    const spo2 = parseFloat(g('ph_v_spo2')) || 0;
    const temp = parseFloat(g('ph_v_temp')) || 0;
    const gcs = parseFloat(g('ph_v_gcs')) || 15;
    if (!hr && !sbp && !rr && !spo2) { document.getElementById('ph_v_preview').textContent = 'NEWS2 محاسبه خواهد شد...'; return; }
    // Simple inline NEWS2 (approximation; server will recalc officially)
    let s = 0;
    if (hr > 130) s += 3; else if (hr > 110) s += 2; else if (hr > 90) s += 1;
    else if (hr < 40) s += 3; else if (hr < 51) s += 2; else if (hr < 60) s += 1;
    if (sbp < 90) s += 3; else if (sbp < 100) s += 2; else if (sbp < 110) s += 1;
    if (rr > 24) s += 3; else if (rr > 20) s += 2; else if (rr < 9) s += 3;
    if (spo2 < 92) s += 3; else if (spo2 < 94) s += 2; else if (spo2 < 96) s += 1;
    if (temp < 35 || temp > 39) s += 2; else if (temp > 38) s += 1;
    if (gcs < 15) s += 3;
    const risk = s >= 7 ? 'critical' : s >= 5 ? 'high' : s >= 1 ? 'low' : 'low';
    const c = s >= 7 ? '#dc2626' : s >= 5 ? '#ea580c' : '#16a34a';
    const el = document.getElementById('ph_v_preview');
    if (el) el.innerHTML = 'NEWS2: <b style="color:' + c + ';font-size:16px">' + s + '</b> (' + risk + ')';
  }

  async function submitVitals(pid, vid) {
    const g = (id) => { const e = document.getElementById(id); return e ? e.value : null; };
    const body = {
      patientId: pid, visitId: vid || null,
      hr: g('ph_v_hr') || null, bp_sys: g('ph_v_sbp') || null, bp_dia: g('ph_v_dbp') || null,
      rr: g('ph_v_rr') || null, spo2: g('ph_v_spo2') || null, temp: g('ph_v_temp') || null,
      gcs: g('ph_v_gcs') || null, pain: g('ph_v_pain') || null,
      consciousness: g('ph_v_conscious') || 'alert'
    };
    if (!body.hr && !body.rr && !body.spo2 && !body.bp_sys) { alert('حداقل یک مقدار وارد کن'); return; }
    try {
      const r = await apiCall('/api/ed/vitals', { method: 'POST', body: JSON.stringify(body) });
      if (r && r.ok === false) throw new Error(r.error || r.message || 'unknown');
      const bg = document.getElementById('ph_vitals_bg'); if (bg) bg.remove();
      if (window.NABZ._toast) NABZ._toast('✅ ویتال ثبت شد');
      const id = S.currentVisitId;
      await loadAll();
      if (id) await openVisit(id, { force: true });
    } catch (e) {
      alert('❌ خطا در ثبت ویتال: ' + (e.message || e));
    }
  }

  function consultSheet() {
    const v = S.currentPatient;
    if (!v) { alert('اول یک بیمار انتخاب کن'); return; }
    const p = v.patientContext || {};
    const pid = p.patientId || (v.visit && v.visit.patientId) || (v.visit && v.visit.id);
    const vid = v.visit && v.visit.id;
    const services = ['قلب','نورولوژی','جراحی عمومی','ارتوپدی','ریه','گوارش','کلیه','عفونی','خون','غدد','روانپزشکی','پوست','داخلی'];
    const html = '<div id="ph_consult_bg" style="position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center">'
      + '<div style="background:#fff;width:100%;max-width:560px;border-radius:20px 20px 0 0;padding:18px;direction:rtl;max-height:90vh;overflow-y:auto">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'
      + '<div style="font-weight:900;font-size:16px">📞 درخواست مشاوره</div>'
      + '<button onclick="document.getElementById(\'ph_consult_bg\').remove()" style="background:#f1f5f9;border:none;border-radius:8px;padding:6px 10px;font-size:14px;cursor:pointer">✕</button></div>'
      + '<div style="margin-bottom:10px"><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">سرویس</label>'
      + '<select id="ph_c_service" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box">'
      + services.map(s => '<option value="'+s+'">'+s+'</option>').join('')
      + '</select></div>'
      + '<div style="margin-bottom:10px"><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">فوریت</label>'
      + '<select id="ph_c_urgency" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;box-sizing:border-box">'
      + '<option value="routine">روتین (تا ۶۰ دقیقه)</option>'
      + '<option value="urgent">فوری (تا ۱۵ دقیقه)</option>'
      + '<option value="emergency">اورژانسی (فوری)</option>'
      + '</select></div>'
      + '<div style="margin-bottom:12px"><label style="font-size:12px;font-weight:800;display:block;margin-bottom:4px">سوال بالینی <span style="color:#dc2626">*</span></label>'
      + '<textarea id="ph_c_question" placeholder="چه چیزی می‌خواهید بدانید؟ (حداقل ۵ کاراکتر)" style="width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;box-sizing:border-box;min-height:80px"></textarea></div>'
      + '<button onclick="NABZ._phSubmitConsult(\'' + pid + '\', \'' + (vid || '') + '\')" style="width:100%;padding:14px;border:none;border-radius:12px;background:#0891b2;color:#fff;font-weight:900;font-size:15px;cursor:pointer">ثبت درخواست</button>'
      + '</div></div>';
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstChild);
  }

  async function submitConsult(pid, vid) {
    const service = (document.getElementById('ph_c_service') || {}).value;
    const urgency = (document.getElementById('ph_c_urgency') || {}).value;
    const question = (document.getElementById('ph_c_question') || {}).value || '';
    if (!question || question.length < 5) { alert('سوال بالینی حداقل ۵ کاراکتر'); return; }
    try {
      await apiCall('/api/ed/consults', {
        method: 'POST',
        body: JSON.stringify({ patientId: pid, visitId: vid || null, targetService: service, urgency, clinicalQuestion: question })
      });
      const bg = document.getElementById('ph_consult_bg'); if (bg) bg.remove();
      if (window.NABZ._toast) NABZ._toast('✅ درخواست مشاوره ثبت شد');
      const id = S.currentVisitId;
      await loadAll();
      if (id) await openVisit(id, { force: true });
    } catch (e) { alert('خطا: ' + e.message); }
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────
  window.NABZ = window.NABZ || {};
  window.NABZ._phRefresh = () => { loadAll(); if (S.currentVisitId) openVisit(S.currentVisitId); };
  window.NABZ._phOpen = (id) => openVisit(id);
  window.NABZ._phTab = (tab) => { S.activeTab = tab; renderWorkspace(); };
  window.NABZ._phNewOrder = () => newOrderSheet();
  window.NABZ._phSubmitOrder = submitOrder;
  window.NABZ._phCosign = (id) => cosignOrder(id, 'resident');
  window.NABZ._phAttCosign = (id) => cosignOrder(id, 'attending');
  window.NABZ._phReject = rejectOrder;
  window.NABZ._phConsult = () => consultSheet();
  window.NABZ._phVitals = () => vitalsSheet();

  // ─────────────────────────────────────────────────────────────
  // SHOW
  // ─────────────────────────────────────────────────────────────
  function show() {
    S.role = roleOf();
    const c = document.getElementById('content');
    if (!c) return;

    // If physician shell already in DOM, only refresh data — never rebuild
    if (document.getElementById('ph_root')) {
      loadAll().then(() => {
        if (S.currentVisitId) openVisit(S.currentVisitId, { force: true, silent: true });
      });
      return;
    }

    // Full rebuild once
    c.innerHTML = shell();
    const urlVisitId = getUrlVisitId();
    loadAll().then(() => {
      if (urlVisitId) {
        openVisit(urlVisitId, { silent: true });
      } else if (S.worklist.rows && S.worklist.rows.length > 0) {
        // Auto-select highest-ESI patient (rows are pre-sorted)
        openVisit(S.worklist.rows[0].id, { silent: true });
      }
    });

    if (!S.autoRefresh) {
      S.autoRefresh = setInterval(function() {
        if (!document.getElementById('ph_root')) { clearInterval(S.autoRefresh); S.autoRefresh = null; return; }
        if (document.getElementById('ph_vitals_bg') || document.getElementById('ph_consult_bg') || document.getElementById('ph_order_bg')) return;
        loadAll().then(function() { if (S.currentVisitId) openVisit(S.currentVisitId, { force: true, silent: true }); });
      }, 30000);
    }
  }

  (function wait() {
    if (typeof NABZ !== 'undefined' && typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('ed_physician', show);
      return;
    }
    if (window.__ph_retries == null) window.__ph_retries = 0;
    if (++window.__ph_retries > 100) return;
    setTimeout(wait, 50);
  })();
})();
