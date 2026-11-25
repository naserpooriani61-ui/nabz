'use strict';
// public/ed_cc_ui.js — مرکز فرماندهی اورژانس v2 (28B). فقط با registerKind و APIهای رسمی.
(function () {
  if (window.__edccLoaded) return;
  window.__edccLoaded = true;

  var S = { tab: 'board', timer: null, board: null, beds: null, codes: null, mci: null, stats: null, days: 1, filter: 'all', patients: null };
  var ESI_COL = { 1: '#dc2626', 2: '#ea580c', 3: '#ca8a04', 4: '#16a34a', 5: '#2563eb' };
  var ST = { waiting_triage: 'منتظر تریاژ', waiting_doctor: 'منتظر پزشک', waiting_bed: 'منتظر تخت', in_treatment: 'در درمان', observation: 'تحت مشاهده', boarding: 'منتظر پذیرش (Boarding)', ready_discharge: 'آمادهٔ ترخیص', transferring: 'در حال انتقال', admitted: 'بستری شد', discharged: 'ترخیص شد', transferred: 'منتقل شد', lwbs: 'ترک بدون ویزیت', lama: 'ترک با رضایت', absconded: 'فرار', deceased: 'فوت' };
  var FLAG = { critical_vitals_untriaged: ['🚨 علائم بحرانی — تریاژ فوری', '#fee2e2', '#991b1b'], sla_breach: ['⏰ نقض زمان انتظار', '#fee2e2', '#991b1b'], reassess_due: ['🔁 بازارزیابی سررسید', '#ffedd5', '#9a3412'], boarding_long: ['🛏️ Boarding طولانی', '#ffedd5', '#9a3412'], cosign_pending: ['✍️ منتظر تأیید استاد', '#fef9c3', '#854d0e'], news2_high: ['📈 NEWS2 بالا', '#fee2e2', '#991b1b'], unlinked_patient: ['🆔 بدون پرونده', '#e2e8f0', '#334155'] };
  var QUICK = { waiting_triage: [['triage', '🚑 تریاژ']], waiting_doctor: [['see', '👨‍⚕️ ویزیت شد'], ['bed', '🛏️ تخت']], waiting_bed: [['bed', '🛏️ تخت'], ['see', '👨‍⚕️ ویزیت شد']], in_treatment: [['dispo', '🏁 تعیین‌تکلیف']], observation: [['dispo', '🏁 تعیین‌تکلیف']], boarding: [['depart', '🚪 خروج']], ready_discharge: [['depart', '🚪 ترخیص']], transferring: [['depart', '🚪 خروج']] };
  var MORE = { waiting_triage: [['leave_unseen', '🚪 ترک بدون ویزیت (LWBS)']], waiting_doctor: [['wait_bed', '⏳ منتظر تخت'], ['leave_unseen', '🚪 ترک بدون ویزیت (LWBS)']], waiting_bed: [['bed_ready', '✅ تخت آماده'], ['leave_unseen', '🚪 ترک بدون ویزیت (LWBS)']], in_treatment: [['observe', '👁️ تحت مشاهده']], observation: [['resume', '▶️ بازگشت به درمان']], boarding: [['resume', '▶️ بازگشت به درمان'], ['dispo', '🏁 تغییر تعیین‌تکلیف']], ready_discharge: [['resume', '▶️ بازگشت به درمان'], ['dispo', '🏁 تغییر تعیین‌تکلیف']], transferring: [['resume', '▶️ بازگشت به درمان'], ['dispo', '🏁 تغییر تعیین‌تکلیف']] };
  var DEPART = { boarding: 'depart_admitted', ready_discharge: 'depart_discharged', transferring: 'depart_transferred' };
  var ERR = { override_reason_required: 'انتخاب سطح کم‌خطرتر از پیشنهاد، دلیل می‌خواهد', attending_cosign_required: 'خروج بیمار منتظر تأیید استاد است', missing_fields: 'نام و شکایت اصلی لازم است', invalid_esi: 'سطح ESI نامعتبر است', reason_required: 'دلیل را بنویسید', same_level: 'سطح تغییری نکرده است', bed_not_available: 'تخت در دسترس نیست', bed_occupied: 'تخت اشغال است', visit_closed: 'ویزیت بسته شده است', patient_not_found: 'پرونده پیدا نشد', visit_not_found: 'ویزیت پیدا نشد', already_linked: 'ویزیت قبلاً به پرونده وصل شده', cosign_not_required: 'نیازی به تأیید استاد نیست', already_cosigned: 'قبلاً تأیید شده', use_triage_first: 'ابتدا تریاژ را انجام دهید', already_in_this_bed: 'بیمار همین حالا در این تخت است', no_bed: 'بیمار تخت ندارد', mci_not_active: 'این MCI فعال نیست' };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fa(n) { return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.charAt(Number(d)); }); }
  function dur(m) { if (m == null) return '—'; m = Math.round(m); if (m < 60) return fa(m) + ' د'; var h = Math.floor(m / 60), r = m % 60; return fa(h) + 'س' + (r ? ' ' + fa(r) + 'د' : ''); }
  function hhmm(x) { try { return x ? new Date(x).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '—'; } catch (_) { return '—'; } }
  function esiCol(l) { return ESI_COL[l] || '#64748b'; }
  function errFa(e) {
    var m = String((e && (e.message || e.error)) || e || 'خطا').replace(/^Error:\s*/, '');
    if (ERR[m]) return ERR[m];
    if (m.indexOf('forbidden') === 0) return 'دسترسی انجام این کار را ندارید';
    if (m.indexOf('invalid:') === 0) return 'این اقدام در وضعیت فعلی مجاز نیست';
    if (m.indexOf('missing:') === 0) return 'فیلد لازم تکمیل نشده: ' + m.slice(8);
    return m;
  }
  function api(url, opts) {
    if (typeof NABZ !== 'undefined' && typeof NABZ._api === 'function') return NABZ._api(url, opts);
    return fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {})).then(function (r) {
      return r.json().then(function (j) { if (!r.ok) throw new Error((j && (j.error || j.message)) || r.status); return j; });
    });
  }
  function post(url, body) { return api(url, { method: 'POST', body: JSON.stringify(body || {}) }); }
  function toast(m) {
    try { if (window.NABZ && NABZ._toast) return NABZ._toast(m); } catch (_) {}
    var t = document.createElement('div'); t.textContent = m;
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 16px;border-radius:12px;z-index:10000;font-size:13px;max-width:90%';
    document.body.appendChild(t); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2800);
  }
  function stopTimer() { if (S.timer) { clearInterval(S.timer); S.timer = null; } }
  function rowOf(id) { var r = (S.board && S.board.rows) || []; for (var i = 0; i < r.length; i++) if (r[i].id === id) return r[i]; return null; }
  function ensureCss() {
    if ($('edcc_css')) return;
    var st = document.createElement('style'); st.id = 'edcc_css';
    st.textContent = '#edcc_root{direction:rtl}.edcc-hd{background:linear-gradient(135deg,#0f172a,#7f1d1d);color:#fff;border-radius:14px;padding:12px 14px;margin:0 0 10px}.edcc-btn{background:#dc2626;color:#fff;border:none;border-radius:10px;padding:9px 12px;font-weight:800;font-size:12px}.edcc-btn2{background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:10px;padding:9px 12px;font-weight:800;font-size:12px}.edcc-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:0 0 10px}.edcc-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:8px 4px;text-align:center}.edcc-kpi b{display:block;font-size:20px;font-weight:900}.edcc-kpi span{font-size:10px;color:#64748b;font-weight:700}.edcc-tabs{display:flex;gap:6px;overflow-x:auto;margin:0 0 10px;padding-bottom:2px}.edcc-tab{flex:0 0 auto;padding:9px 14px;border-radius:10px;border:none;font-weight:800;font-size:12px;background:#f1f5f9;color:#475569}.edcc-tab.on{background:#0f172a;color:#fff}.edcc-card{background:#fff;border:1px solid #e2e8f0;border-inline-start:6px solid #94a3b8;border-radius:12px;padding:10px;margin:0 0 8px}.edcc-esi{width:38px;height:38px;border-radius:50%;color:#fff;font-weight:900;font-size:18px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}.edcc-pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:800;margin:6px 0 0 4px}.edcc-bar{height:6px;background:#e2e8f0;border-radius:99px;overflow:hidden}.edcc-bar i{display:block;height:100%}.edcc-act{background:#0f172a;color:#fff;border:none;border-radius:9px;padding:8px 12px;font-size:12px;font-weight:800;margin:8px 0 0 6px}.edcc-chip{padding:8px 12px;border-radius:10px;border:1.5px solid #e2e8f0;background:#fff;font-weight:800;font-size:12px;color:#475569;margin:0 0 4px}.edcc-chip.on{background:#0f172a;color:#fff;border-color:#0f172a}.edcc-row{display:flex;gap:6px;flex-wrap:wrap}.edcc-q{font-size:12px;font-weight:800;color:#334155;margin:0 0 6px;display:block}.edcc-in{width:100%;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:16px;box-sizing:border-box;margin:0 0 8px}.edcc-x{background:#f1f5f9;border:none;border-radius:8px;padding:6px 10px;font-size:14px}.edcc-sug{border:2px solid #cbd5e1;border-radius:12px;padding:10px;font-size:13px;margin:8px 0}.edcc-sug.warn{border-color:#d97706;background:#fffbeb}.edcc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px}.edcc-tile{border:2px solid #cbd5e1;border-radius:10px;padding:8px 4px;text-align:center;background:#fff;font-size:11px;font-weight:800;color:#334155;min-height:62px}.edcc-big{width:100%;padding:13px;border-radius:12px;border:none;background:#0f172a;color:#fff;font-weight:900;font-size:14px;margin-top:12px}.edcc-sec{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin:0 0 10px}';
    document.head.appendChild(st);
  }

  // ───────── کانتینر و بارگذاری ─────────
  function open(tab) {
    var m = $('content'); if (!m) return;
    S.tab = tab || 'board'; stopTimer(); ensureCss();
    m.innerHTML = '<div id="edcc_root"><div class="edcc-hd"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><div style="font-size:16px;font-weight:900">🚨 مرکز فرماندهی اورژانس</div><div id="edcc_clock" style="font-size:11px;opacity:.8;margin-top:2px"></div></div><div style="display:flex;gap:6px"><button type="button" class="edcc-btn" data-act="reg">＋ ورود بیمار</button><button type="button" class="edcc-btn2" data-act="reload">⟳</button></div></div></div><div id="edcc_kpi" class="edcc-kpis"></div><div id="edcc_tabs" class="edcc-tabs"></div><div id="edcc_body"></div></div>';
    $('edcc_root').addEventListener('click', function (ev) {
      var el = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null; if (!el) return;
      var fn = ACT[el.getAttribute('data-act')]; if (fn) fn(el.getAttribute('data-id'), el);
    });
    refresh(true);
    S.timer = setInterval(function () { if (!$('edcc_root')) return stopTimer(); if ($('edcc_sheet')) return; refresh(false); }, 15000);
  }
  function loadTab() {
    var t = S.tab, jobs = [api('/api/emergency/board').then(function (b) { S.board = b; })];
    if (t === 'beds') jobs.push(api('/api/emergency/beds').then(function (b) { S.beds = b; }));
    if (t === 'codes') jobs.push(api('/api/erf/codes').then(function (c) { S.codes = c; }));
    if (t === 'mci') jobs.push(api('/api/emergency/mci').then(function (x) { S.mci = x; }));
    if (t === 'stats') jobs.push(api('/api/emergency/stats?days=' + S.days).then(function (x) { S.stats = x; }));
    return Promise.all(jobs);
  }
  function refresh(spin) {
    var b = $('edcc_body');
    if (spin && b) b.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
    return loadTab().then(paint).catch(function (e) { var x = $('edcc_body'); if (x) x.innerHTML = '<div class="edcc-sec" style="color:#991b1b">خطا: ' + esc(errFa(e)) + '</div>'; });
  }
  function paint() {
    if (!$('edcc_root')) return;
    $('edcc_clock').textContent = hhmm(new Date().toISOString());
    $('edcc_kpi').innerHTML = kpiHtml();
    var tabs = [['board', '📋 تابلو'], ['beds', '🛏️ تخت‌ها'], ['codes', '🔴 کدها'], ['mci', '🌐 MCI'], ['stats', '📊 آمار']], t = '';
    tabs.forEach(function (x) { t += '<button type="button" class="edcc-tab' + (S.tab === x[0] ? ' on' : '') + '" data-act="tab" data-tab="' + x[0] + '">' + x[1] + '</button>'; });
    $('edcc_tabs').innerHTML = t;
    var h = S.tab === 'beds' ? bedsHtml() : S.tab === 'codes' ? codesHtml() : S.tab === 'mci' ? mciHtml() : S.tab === 'stats' ? statsHtml() : boardHtml();
    $('edcc_body').innerHTML = h;
  }
  function kpiHtml() {
    var c = (S.board && S.board.counts) || {};
    function k(l, v, warn) { v = v == null ? 0 : v; return '<div class="edcc-kpi"><b style="color:' + (warn && v > 0 ? '#dc2626' : '#0f172a') + '">' + fa(v) + '</b><span>' + l + '</span></div>'; }
    return k('فعال', c.active) + k('بدون تریاژ', c.untriaged, true) + k('نقض زمان', c.slaBreaches, true) + k('بازارزیابی', c.reassessDue, true) + k('Boarding', c.boarding) + k('منتظر استاد', c.cosignPending, true);
  }

  // ───────── تابلو ─────────
  function boardFilter(r, f) {
    if (f === 'flag') return r.flags.length > 0;
    if (f === 'untriaged') return r.status === 'waiting_triage';
    if (f === 'waiting') return r.status === 'waiting_doctor' || r.status === 'waiting_bed';
    if (f === 'treat') return r.status === 'in_treatment' || r.status === 'observation';
    if (f === 'dispo') return !!DEPART[r.status];
    return true;
  }
  function boardHtml() {
    var rows = (S.board && S.board.rows) || [], fl = [['all', 'همه'], ['flag', '⚠️ پرچم‌دار'], ['untriaged', 'بدون تریاژ'], ['waiting', 'منتظر'], ['treat', 'در درمان'], ['dispo', 'تعیین‌تکلیف']], h = '<div class="edcc-row" style="margin-bottom:8px">';
    fl.forEach(function (f) { var n = rows.filter(function (r) { return boardFilter(r, f[0]); }).length; h += '<button type="button" class="edcc-chip' + (S.filter === f[0] ? ' on' : '') + '" data-act="filter" data-f="' + f[0] + '">' + f[1] + ' ' + fa(n) + '</button>'; });
    h += '</div>';
    var list = rows.filter(function (r) { return boardFilter(r, S.filter); });
    if (!list.length) return h + '<div class="edcc-sec" style="text-align:center;color:#94a3b8;padding:30px">بیماری در این فیلتر نیست</div>';
    list.forEach(function (r) { h += cardHtml(r); });
    return h;
  }
  function ageText(r) {
    if (r.age === 0 && r.ageMonths != null) return fa(r.ageMonths) + ' ماهه';
    return r.age != null ? fa(r.age) + ' ساله' : '';
  }
  function cardHtml(r) {
    var col = esiCol(r.esiLevel);
    var h = '<div class="edcc-card" data-act="open" data-id="' + esc(r.id) + '" style="border-inline-start-color:' + col + '">';
    h += '<div style="display:flex;gap:10px;align-items:center"><div class="edcc-esi" style="background:' + col + '">' + (r.esiLevel ? fa(r.esiLevel) : '؟') + '</div>';
    h += '<div style="flex:1;min-width:0"><div style="font-weight:900;font-size:14px;color:#0f172a">' + esc(r.patientName) + ' <span style="font-weight:600;color:#64748b;font-size:12px">' + ageText(r) + (r.sex === 'male' ? ' · مرد' : r.sex === 'female' ? ' · زن' : '') + '</span></div>';
    h += '<div style="font-size:12px;color:#475569;margin-top:2px">' + esc(r.chiefComplaint) + '</div></div>';
    h += '<div style="text-align:left;font-size:11px;color:#64748b"><div style="font-weight:800;color:#0f172a">' + esc(ST[r.status] || r.status) + '</div><div>⏱ ' + dur(r.minutesSinceArrival) + '</div></div></div>';
    if (r.sla) {
      var t = r.sla.targetMin, m = r.sla.minutes || 0, pct = t > 0 ? Math.min(100, Math.round(m / t * 100)) : 100, bc = r.sla.breach ? '#dc2626' : pct > 70 ? '#d97706' : '#16a34a';
      h += '<div style="margin-top:8px"><div style="display:flex;justify-content:space-between;font-size:10px;color:#64748b"><span>' + (r.sla.kind === 'door_to_triage' ? 'تا تریاژ' : 'تا ویزیت پزشک') + '</span><span>' + dur(m) + ' / ' + (t > 0 ? dur(t) : 'فوری') + '</span></div><div class="edcc-bar"><i style="width:' + pct + '%;background:' + bc + '"></i></div></div>';
    }
    h += '<div>';
    if (r.bedLabel) h += '<span class="edcc-pill" style="background:#e0f2fe;color:#075985">🛏️ ' + esc(r.bedLabel) + '</span>';
    if (r.news2) h += '<span class="edcc-pill" style="background:' + (r.news2.risk === 'critical' || r.news2.risk === 'high' ? '#fee2e2' : '#f1f5f9') + ';color:' + (r.news2.risk === 'critical' || r.news2.risk === 'high' ? '#991b1b' : '#475569') + '">NEWS2 ' + fa(r.news2.total) + '</span>';
    r.flags.forEach(function (f) { var d = FLAG[f]; if (d) h += '<span class="edcc-pill" style="background:' + d[1] + ';color:' + d[2] + '">' + d[0] + '</span>'; });
    h += '</div><div>';
    (QUICK[r.status] || []).forEach(function (q) { h += '<button type="button" class="edcc-act" data-act="' + q[0] + '" data-id="' + esc(r.id) + '">' + q[1] + '</button>'; });
    return h + '</div></div>';
  }

  // ───────── تخت‌ها ─────────
  function bedsHtml() {
    var d = S.beds || { items: [], zones: [] };
    if (!d.items.length) return '<div class="edcc-sec" style="text-align:center;color:#94a3b8">تختی ثبت نشده (از پنل مدیریت تخت‌های اورژانس را مقداردهی کنید)</div>';
    var h = '';
    d.zones.forEach(function (z) {
      h += '<div class="edcc-sec"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><b style="font-size:14px">' + esc(z.label) + '</b><span style="font-size:11px;color:#64748b">اشغال ' + fa(z.occupied) + ' از ' + fa(z.total) + ' · آزاد ' + fa(z.free) + (z.cleaning ? ' · نظافت ' + fa(z.cleaning) : '') + '</span></div><div class="edcc-grid">';
      d.items.filter(function (b) { return b.zone === z.code; }).forEach(function (b) {
        var bd = '#16a34a', bg = '#f0fdf4', tx = '<div>' + esc(b.code || b.label) + '</div><div style="color:#16a34a">آزاد</div>';
        if (b.status === 'occupied') {
          bd = b.visitId ? esiCol(b.esiLevel) : '#64748b'; bg = '#fff';
          tx = '<div>' + esc(b.code || b.label) + '</div><div style="font-weight:600;color:#0f172a">' + esc(String(b.patientName || (b.orphan ? 'اشغال بدون ویزیت' : '')).slice(0, 12)) + '</div>' + (b.minutesInBed != null ? '<div style="color:#64748b">' + dur(b.minutesInBed) + '</div>' : '');
        } else if (b.status === 'cleaning') { bd = '#d97706'; bg = '#fffbeb'; tx = '<div>' + esc(b.code || b.label) + '</div><div style="color:#b45309">🧹 نظافت</div>'; }
        else if (b.status !== 'empty' && b.status !== 'available') { bd = '#94a3b8'; bg = '#f1f5f9'; tx = '<div>' + esc(b.code || b.label) + '</div><div style="color:#64748b">مسدود</div>'; }
        h += '<button type="button" class="edcc-tile" data-act="bedtile" data-id="' + esc(b.id) + '" data-s="' + esc(b.status) + '" data-v="' + esc(b.visitId || '') + '" style="border-color:' + bd + ';background:' + bg + '">' + tx + '</button>';
      });
      h += '</div></div>';
    });
    return h;
  }
  function onBedTile(el) {
    var id = el.getAttribute('data-id'), s = el.getAttribute('data-s'), v = el.getAttribute('data-v');
    if (v) return openPatient(v);
    if (s === 'empty' || s === 'available') return openVisitPicker(id);
    if (window.confirm(s === 'occupied' ? 'این تخت اشغال شناخته شده ولی ویزیت فعالی ندارد. آزاد شود؟' : 'تخت آمادهٔ استفاده شود؟')) {
      post('/api/emergency/beds/' + encodeURIComponent(id) + '/status', { status: 'empty' }).then(function () { toast('تخت آزاد شد'); refresh(false); }).catch(function (e) { toast('❌ ' + errFa(e)); });
    }
  }

  // ───────── کدها ─────────
  function codeNorm(c) {
    var steps = (c.steps || []).map(function (s) { return { key: s.id || s.name, hasId: !!s.id, name: s.name, target: s.targetMin, done: s.status === 'done' || s.status === 'completed', at: s.completedAt }; });
    return { id: c.id, label: c.label || c.codeLabel || c.type || c.code, patient: c.patientName, at: c.activatedAt, status: c.status, steps: steps, legacy: steps.some(function (s) { return !s.hasId; }) };
  }
  function codesHtml() {
    var d = S.codes || { items: [], meta: {} }, items = (d.items || []).map(codeNorm), act = items.filter(function (c) { return c.status === 'active'; }), done = items.filter(function (c) { return c.status !== 'active'; }).slice(0, 5), now = Date.now(), h = '';
    h += '<div class="edcc-sec"><div class="edcc-q">فعال‌سازی کد</div><div class="edcc-row">';
    Object.keys(d.meta || {}).forEach(function (k) { h += '<button type="button" class="edcc-act" style="background:#991b1b;margin:0" data-act="cnew" data-id="' + esc(k) + '">🔴 ' + esc((d.meta[k] && d.meta[k].label) || k) + '</button>'; });
    h += '</div></div>';
    if (!act.length) h += '<div class="edcc-sec" style="text-align:center;color:#94a3b8">کد فعالی نیست</div>';
    act.forEach(function (c) {
      var el = c.at ? Math.round((now - Date.parse(c.at)) / 60000) : null;
      h += '<div class="edcc-sec" style="border:2px solid #dc2626"><div style="display:flex;justify-content:space-between"><b>' + esc(c.label) + '</b><span style="color:#991b1b;font-weight:900">⏱ ' + dur(el) + '</span></div><div style="font-size:12px;color:#64748b;margin:2px 0 8px">' + esc(c.patient || '') + '</div>';
      c.steps.forEach(function (s) {
        var late = !s.done && s.target != null && el != null && el > s.target, took = s.done && c.at && s.at ? Math.round((Date.parse(s.at) - Date.parse(c.at)) / 60000) : null;
        h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-top:1px solid #f1f5f9"><div style="font-size:13px;font-weight:700;color:' + (s.done ? '#16a34a' : late ? '#dc2626' : '#0f172a') + '">' + (s.done ? '✅ ' : '⬜ ') + esc(s.name) + (s.target != null ? ' <span style="font-size:10px;color:#64748b;font-weight:600">هدف ≤ ' + fa(s.target) + 'د' + (took != null ? ' · انجام ' + fa(took) + 'د' : '') + '</span>' : '') + '</div>' + (s.done ? '' : '<button type="button" class="edcc-act" style="margin:0" data-act="cstep" data-id="' + esc(c.id) + '" data-step="' + esc(s.key) + '" data-legacy="' + (c.legacy ? '1' : '0') + '">ثبت انجام</button>') + '</div>';
      });
      h += '<button type="button" class="edcc-big" style="background:#991b1b" data-act="cres" data-id="' + esc(c.id) + '" data-legacy="' + (c.legacy ? '1' : '0') + '">🔚 پایان کد</button></div>';
    });
    if (done.length) { h += '<div class="edcc-sec"><div class="edcc-q">اخیر</div>'; done.forEach(function (c) { h += '<div style="font-size:12px;color:#475569;padding:4px 0">' + esc(c.label) + ' — ' + esc(c.patient || '') + ' · ' + hhmm(c.at) + '</div>'; }); h += '</div>'; }
    return h;
  }

  // ───────── MCI ─────────
  function mciHtml() {
    var items = (S.mci && S.mci.items) || [], act = items.filter(function (m) { return m.status === 'active'; }), h = '';
    if (!act.length) h += '<div class="edcc-sec" style="text-align:center"><div style="color:#94a3b8;margin-bottom:10px">حادثهٔ دسته‌جمعی فعالی نیست</div><button type="button" class="edcc-big" style="background:#991b1b" data-act="mnew">🌐 فعال‌سازی طرح بحران (MCI)</button></div>';
    var C = [['red', 'قرمز · فوری', '#dc2626'], ['yellow', 'زرد · تأخیری', '#ca8a04'], ['green', 'سبز · سرپایی', '#16a34a'], ['black', 'سیاه · فوت/غیرقابل‌نجات', '#334155']];
    act.forEach(function (m) {
      var c = m.casualties || {};
      h += '<div class="edcc-sec" style="border:2px solid #dc2626"><div style="display:flex;justify-content:space-between"><b>🌐 ' + esc(m.incidentType || 'MCI') + ' · سطح ' + esc(m.alertLevel) + '</b><span style="font-size:11px;color:#64748b">' + hhmm(m.activatedAt) + '</span></div><div style="font-size:12px;color:#64748b;margin:2px 0 10px">' + esc(m.location || '') + (m.estimatedCasualties ? ' · برآورد ' + fa(m.estimatedCasualties) + ' مصدوم' : '') + '</div>';
      C.forEach(function (k) { h += '<div style="display:flex;align-items:center;justify-content:space-between;margin:6px 0"><span style="font-weight:800;color:' + k[2] + '">' + k[1] + '</span><span style="display:flex;align-items:center;gap:8px"><button type="button" class="edcc-chip" data-act="mcount" data-id="' + esc(m.id) + '" data-c="' + k[0] + '" data-d="-1">−</button><b style="font-size:20px;min-width:30px;text-align:center">' + fa(c[k[0]] || 0) + '</b><button type="button" class="edcc-chip" data-act="mcount" data-id="' + esc(m.id) + '" data-c="' + k[0] + '" data-d="1">＋</button></span></div>'; });
      h += '<button type="button" class="edcc-big" data-act="mclose" data-id="' + esc(m.id) + '">🔚 پایان طرح بحران</button></div>';
    });
    return h;
  }

  // ───────── آمار ─────────
  function statsHtml() {
    var s = S.stats || {}, h = '<div class="edcc-row" style="margin-bottom:8px">';
    [[1, 'امروز'], [7, '۷ روز'], [30, '۳۰ روز']].forEach(function (d) { h += '<button type="button" class="edcc-chip' + (S.days === d[0] ? ' on' : '') + '" data-act="days" data-d="' + d[0] + '">' + d[1] + '</button>'; });
    h += '</div><div class="edcc-kpis">';
    function k(l, v, u) { return '<div class="edcc-kpi"><b>' + (v == null ? '—' : fa(v) + (u || '')) + '</b><span>' + l + '</span></div>'; }
    h += k('تا تریاژ (میانه)', s.doorToTriageMedian, 'د') + k('تا پزشک (میانه)', s.doorToProviderMedian, 'د') + k('مدت حضور (میانه)', s.losMedian, 'د') + k('تا تریاژ P90', s.doorToTriageP90, 'د') + k('تا پزشک P90', s.doorToProviderP90, 'د') + k('مدت حضور P90', s.losP90, 'د') + k('ویزیت در دوره', s.visitsInPeriod) + k('LWBS', s.lwbsRatePct, '٪') + k('طولانی‌ترین Boarding', s.boardingLongestMin, 'د');
    h += '</div><div class="edcc-sec"><div class="edcc-q">توزیع ESI بیماران فعال</div>';
    var dist = s.esiDist || {}, mx = 1; for (var i = 1; i <= 5; i++) mx = Math.max(mx, dist[i] || 0);
    for (var j = 1; j <= 5; j++) h += '<div style="display:flex;align-items:center;gap:8px;margin:5px 0"><b style="width:46px;color:' + esiCol(j) + '">ESI ' + fa(j) + '</b><div class="edcc-bar" style="flex:1;height:12px"><i style="width:' + Math.round((dist[j] || 0) / mx * 100) + '%;background:' + esiCol(j) + '"></i></div><span style="width:24px;text-align:left;font-weight:800">' + fa(dist[j] || 0) + '</span></div>';
    return h + '</div>';
  }

  // ───────── Sheet ─────────
  function closeSheet() { var o = $('edcc_sheet'); if (o && o.parentNode) o.parentNode.removeChild(o); }
  function sheet(title, html, H, onMount) {
    closeSheet();
    var o = document.createElement('div'); o.id = 'edcc_sheet';
    o.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center';
    o.innerHTML = '<div style="background:#fff;width:100%;max-width:560px;max-height:92vh;overflow:auto;border-radius:18px 18px 0 0;padding:16px;box-sizing:border-box;direction:rtl"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div style="font-size:15px;font-weight:900;color:#0f172a">' + esc(title) + '</div><button type="button" class="edcc-x" data-sa="close">✕</button></div>' + html + '</div>';
    document.body.appendChild(o);
    o.addEventListener('click', function (ev) {
      if (ev.target === o) return closeSheet();
      var el = ev.target && ev.target.closest ? ev.target.closest('[data-sa]') : null; if (!el) return;
      var a = el.getAttribute('data-sa'); if (a === 'close') return closeSheet();
      if (H && H[a]) H[a](el);
    });
    if (onMount) onMount(o);
    return o;
  }
  function doAct(id, action, body, msg) {
    return post('/api/emergency/visits/' + encodeURIComponent(id) + '/action/' + action, body).then(function () { toast(msg || 'ثبت شد'); closeSheet(); refresh(false); }).catch(function (e) { toast('❌ ' + errFa(e)); });
  }
  function getPatients() {
    if (S.patients) return Promise.resolve(S.patients);
    return api('/api/clinical/patients').then(function (r) { S.patients = Array.isArray(r) ? r : (r.items || r.patients || []); return S.patients; });
  }

  // ───────── ورود بیمار ─────────
  function openRegister() {
    var CC = ['درد قفسه سینه', 'تنگی نفس', 'ترومای حاد', 'تب و لرز', 'درد شکم', 'سردرد', 'ضعف و بیحالی', 'خونریزی', 'تشنج', 'مسمومیت'], h = '';
    h += '<label class="edcc-q">نام و نام خانوادگی</label><input id="edcc_r_name" class="edcc-in" placeholder="اگر ناشناس است خالی بگذارید">';
    h += '<label style="display:flex;gap:8px;align-items:center;margin:0 0 10px;font-size:13px"><input type="checkbox" id="edcc_r_unk"> بیمار ناشناس (شناسهٔ موقت)</label>';
    h += '<div style="display:flex;gap:8px"><div style="flex:1"><label class="edcc-q">سن</label><input id="edcc_r_age" type="number" inputmode="numeric" class="edcc-in"></div><div style="width:110px"><label class="edcc-q">واحد</label><select id="edcc_r_unit" class="edcc-in"><option value="y">سال</option><option value="m">ماه</option></select></div></div>';
    h += '<div style="display:flex;gap:8px"><div style="flex:1"><label class="edcc-q">جنسیت</label><select id="edcc_r_sex" class="edcc-in"><option value="">نامشخص</option><option value="male">مرد</option><option value="female">زن</option></select></div><div style="flex:1"><label class="edcc-q">نحوهٔ ورود</label><select id="edcc_r_mode" class="edcc-in"><option value="walk_in">مراجعهٔ مستقیم</option><option value="ambulance">آمبولانس</option><option value="referral">ارجاع</option><option value="transfer">انتقال بین‌بیمارستانی</option></select></div></div>';
    h += '<label class="edcc-q">شکایت اصلی</label><input id="edcc_r_cc" class="edcc-in" placeholder="شکایت اصلی"><div class="edcc-row">';
    CC.forEach(function (c) { h += '<button type="button" class="edcc-chip" data-sa="cc" data-v="' + esc(c) + '">' + esc(c) + '</button>'; });
    h += '</div><button type="button" class="edcc-big" data-sa="go">ثبت ورود و ادامه به تریاژ</button>';
    sheet('＋ ورود بیمار', h, {
      cc: function (el) { $('edcc_r_cc').value = el.getAttribute('data-v'); },
      go: function () {
        var name = $('edcc_r_name').value.trim(), unk = $('edcc_r_unk').checked, cc = $('edcc_r_cc').value.trim(), ageV = $('edcc_r_age').value, unit = $('edcc_r_unit').value;
        if (!cc) return toast('شکایت اصلی را بنویسید');
        if (!name && !unk) return toast('نام را بنویسید یا «ناشناس» را بزنید');
        var b = { patientName: name, unknown: unk, sex: $('edcc_r_sex').value || undefined, arrivalMode: $('edcc_r_mode').value, chiefComplaint: cc };
        if (ageV !== '') { if (unit === 'm') { b.age = 0; b.ageMonths = Number(ageV); } else b.age = Number(ageV); }
        post('/api/emergency/visits', b).then(function (rec) { toast('ثبت شد'); closeSheet(); return loadTab().then(function () { paint(); openTriage(rec.id, rec.patientName); }); }).catch(function (e) { toast('❌ ' + errFa(e)); });
      }
    });
  }

  // ───────── ویزارد تریاژ ─────────
  function openTriage(id, nameFallback) {
    var r = rowOf(id), T = { life: null, risk: null, conf: null, pain: null, res: null, chosen: null, sug: null }, seq = 0;
    var title = '🚑 تریاژ — ' + ((r && r.patientName) || nameFallback || '');
    function yn(k, label) { return '<div style="margin:0 0 10px"><span class="edcc-q">' + label + '</span><div class="edcc-row"><button type="button" class="edcc-chip' + (T[k] === true ? ' on' : '') + '" data-sa="set" data-k="' + k + '" data-v="true">بله</button><button type="button" class="edcc-chip' + (T[k] === false ? ' on' : '') + '" data-sa="set" data-k="' + k + '" data-v="false">خیر</button></div></div>'; }
    function qHtml() {
      var h = yn('life', 'A — مداخلهٔ نجات‌بخش فوری لازم است؟ (راه هوایی، احیا، شوک، ...)') + yn('risk', 'B — وضعیت پرخطر؟ (درد قفسهٔ سینه مشکوک، علائم سکته، سپسیس مشکوک، ...)') + yn('conf', 'گیجی، خواب‌آلودگی یا بی‌قراری ناگهانی؟');
      h += '<span class="edcc-q">شدت درد (۰–۱۰)</span><div class="edcc-row" style="margin-bottom:10px">';
      for (var i = 0; i <= 10; i++) h += '<button type="button" class="edcc-chip' + (T.pain === i ? ' on' : '') + '" data-sa="set" data-k="pain" data-v="' + i + '">' + fa(i) + '</button>';
      h += '</div><span class="edcc-q">تعداد منابع مورد انتظار (آزمایش، تصویربرداری، IV، دارو تزریقی، مشاوره، پروسیجر)</span><div class="edcc-row">';
      [[0, '۰'], [1, '۱'], [2, '۲ یا بیشتر']].forEach(function (x) { h += '<button type="button" class="edcc-chip' + (T.res === x[0] ? ' on' : '') + '" data-sa="set" data-k="res" data-v="' + x[0] + '">' + x[1] + '</button>'; });
      return h + '</div>';
    }
    function levelsHtml() {
      var h = '<span class="edcc-q">سطح نهایی ESI (انتخاب با شماست)</span><div class="edcc-row">';
      for (var i = 1; i <= 5; i++) { var on = T.chosen === i, sg = T.sug && T.sug.level === i; h += '<button type="button" class="edcc-chip" data-sa="lv" data-v="' + i + '" style="flex:1;font-size:18px;background:' + (on ? esiCol(i) : '#fff') + ';color:' + (on ? '#fff' : esiCol(i)) + ';border-color:' + esiCol(i) + ';' + (sg && !on ? 'box-shadow:0 0 0 3px ' + esiCol(i) + '55' : '') + '">' + fa(i) + '</button>'; }
      return h + '</div>';
    }
    function readVit() {
      var v = {}, any = false;
      ['hr', 'bp_sys', 'bp_dia', 'spo2', 'rr', 'temp', 'gcs'].forEach(function (k) { var el = $('edcc_v_' + k); if (el && el.value !== '') { v[k] = Number(el.value); any = true; } });
      if ($('edcc_v_o2') && $('edcc_v_o2').checked) { v.onOxygen = true; any = true; }
      return any ? v : null;
    }
    function body() {
      var b = {};
      if (T.life !== null) b.lifeSaving = T.life; if (T.risk !== null) b.highRisk = T.risk; if (T.conf !== null) b.confused = T.conf;
      if (T.pain !== null) b.painScore = T.pain; if (T.res !== null) b.resources = T.res;
      var v = readVit(); if (v) b.vitals = v;
      return b;
    }
    function paintSug() {
      var s = T.sug, el = $('edcc_sug'); if (!el) return;
      if (!s) { el.innerHTML = ''; return; }
      var MF = { lifeSaving: 'پرسش A', highRisk: 'پرسش B', resources: 'تعداد منابع' }, h = '';
      if (s.level == null) h += '<div class="edcc-sug warn"><b>پیشنهاد ESI: نیازمند پاسخ</b><div style="font-size:12px;margin-top:4px">' + (s.missing || []).map(function (m) { return MF[m] || m; }).join('، ') + '</div></div>';
      else h += '<div class="edcc-sug" style="border-color:' + esiCol(s.level) + '"><b>پیشنهاد سیستم: <span style="color:' + esiCol(s.level) + '">ESI ' + fa(s.level) + '</span></b>' + (s.considerLevel ? '<div style="color:#b45309;font-weight:800;margin-top:4px">ارتقا به ' + fa(s.considerLevel) + ' را بسنجید</div>' : '') + '</div>';
      var det = (s.reasons || []).concat(s.warnings || []); if (det.length) h += '<ul style="margin:0 0 8px;padding-right:18px;font-size:12px;color:#475569">' + det.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
      h += '<div style="font-size:10px;color:#94a3b8">پیشنهاد فقط کمک تصمیم است؛ تصمیم نهایی با پرستار تریاژ.</div>';
      el.innerHTML = h;
      var need = s.compare && s.compare.reasonRequired; $('edcc_reasonbox').style.display = need ? 'block' : 'none';
    }
    function sug() {
      var my = ++seq, b = body(); b.visitId = id; if (T.chosen != null) b.chosenLevel = T.chosen;
      post('/api/emergency/esi/suggest', b).then(function (s) { if (my !== seq) return; T.sug = s; paintSug(); if ($('edcc_lv')) $('edcc_lv').innerHTML = levelsHtml(); }).catch(function () {});
    }
    var h = '<div id="edcc_vit" class="edcc-sec"><span class="edcc-q">علائم حیاتی (اختیاری؛ اگر خالی باشد آخرین ثبت‌شده به‌کار می‌رود)</span><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">';
    [['hr', 'نبض'], ['bp_sys', 'فشار سیستول'], ['bp_dia', 'فشار دیاستول'], ['spo2', 'SpO2'], ['rr', 'تنفس'], ['temp', 'دما'], ['gcs', 'GCS']].forEach(function (f) { h += '<div><div style="font-size:10px;color:#64748b">' + f[1] + '</div><input id="edcc_v_' + f[0] + '" type="number" inputmode="decimal" class="edcc-in" style="margin:0"></div>'; });
    h += '</div><label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size:13px"><input type="checkbox" id="edcc_v_o2"> اکسیژن دریافت می‌کند</label></div>';
    h += '<div id="edcc_chips">' + qHtml() + '</div><div id="edcc_sug"></div><div id="edcc_lv">' + levelsHtml() + '</div>';
    h += '<div id="edcc_reasonbox" style="display:none;margin-top:10px"><label class="edcc-q">دلیل انتخاب سطحی کم‌خطرتر از پیشنهاد (الزامی)</label><textarea id="edcc_reason" class="edcc-in" rows="2"></textarea></div><button type="button" class="edcc-big" data-sa="submit">ثبت تریاژ</button>';
    sheet(title, h, {
      set: function (el) { var k = el.getAttribute('data-k'), v = el.getAttribute('data-v'), val = (v === 'true') ? true : (v === 'false') ? false : Number(v); T[k] = (T[k] === val) ? null : val; $('edcc_chips').innerHTML = qHtml(); sug(); },
      lv: function (el) { var v = Number(el.getAttribute('data-v')); T.chosen = (T.chosen === v) ? null : v; $('edcc_lv').innerHTML = levelsHtml(); sug(); },
      submit: function () {
        if (T.chosen == null) return toast('سطح ESI را انتخاب کنید');
        var b = body(); b.esiLevel = T.chosen; var rs = $('edcc_reason'); if (rs && rs.value.trim()) b.overrideReason = rs.value.trim();
        post('/api/emergency/visits/' + encodeURIComponent(id) + '/triage', b).then(function () { toast('تریاژ ثبت شد — ESI ' + fa(T.chosen)); closeSheet(); refresh(false); }).catch(function (e) { toast('❌ ' + errFa(e)); });
      }
    }, function (o) { o.addEventListener('change', function (ev) { if (ev.target && ev.target.id && ev.target.id.indexOf('edcc_v_') === 0) sug(); }); });
    sug();
  }

  // ───────── کارت بیمار ─────────
  function openPatient(id) {
    var r = rowOf(id); if (!r) return toast('بیمار در تابلو نیست؛ بروزرسانی کنید');
    var h = '<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px"><div class="edcc-esi" style="background:' + esiCol(r.esiLevel) + '">' + (r.esiLevel ? fa(r.esiLevel) : '؟') + '</div><div><div style="font-weight:900;font-size:15px">' + esc(r.patientName) + '</div><div style="font-size:12px;color:#64748b">' + ageText(r) + ' · ' + esc(ST[r.status] || r.status) + (r.bedLabel ? ' · 🛏️ ' + esc(r.bedLabel) : '') + '</div></div></div>';
    h += '<div style="font-size:13px;color:#334155;margin-bottom:6px">شکایت: ' + esc(r.chiefComplaint) + '</div>';
    r.flags.forEach(function (f) { var d = FLAG[f]; if (d) h += '<span class="edcc-pill" style="background:' + d[1] + ';color:' + d[2] + '">' + d[0] + '</span>'; });
    h += '<div id="edcc_tl" class="edcc-sec" style="margin-top:10px;font-size:12px;color:#475569"><span class="spinner"></span></div><div class="edcc-row">';
    function btn(a, label) { h += '<button type="button" class="edcc-act" data-sa="' + a + '">' + label + '</button>'; }
    if (r.patientId) { btn('kardex', '📋 کاردکس'); btn('mar', '💊 MAR'); btn('vitals', '📈 علائم حیاتی'); }
    else { btn('mkpat', '🆔 ساخت پروندهٔ موقت'); btn('link', '🔗 اتصال به پرونده'); }
    if (r.status !== 'waiting_triage') btn('retri', '🔁 بازتریاژ');
    btn('bed', '🛏️ تخصیص/تغییر تخت');
    if (r.flags.indexOf('cosign_pending') !== -1) btn('cosign', '✍️ تأیید استاد');
    (QUICK[r.status] || []).concat(MORE[r.status] || []).forEach(function (q) { if (q[0] !== 'bed') btn('a_' + q[0], q[1]); });
    h += '</div>';
    var H = {
      kardex: function () { go(function () { NABZ.openKardexInteractive(r.patientId); }, 'openKardexInteractive'); },
      mar: function () { go(function () { NABZ.openMarInteractive(r.patientId); }, 'openMarInteractive'); },
      vitals: function () { go(function () { NABZ.openVitalsInteractive(r.patientId); }, 'openVitalsInteractive'); },
      mkpat: function () {
        post('/api/emergency/visits/' + encodeURIComponent(id) + '/create-patient', {}).then(function () { toast('پروندهٔ موقت ساخته شد — آلرژی‌های دارویی را حتماً از بیمار بپرسید و ثبت کنید'); closeSheet(); return refresh(false); }).catch(function (e) { toast('❌ ' + errFa(e)); });
      },
      link: function () { openLink(id); }, retri: function () { openRetriage(id); }, bed: function () { openBedPicker(id); },
      cosign: function () { post('/api/emergency/visits/' + encodeURIComponent(id) + '/cosign', {}).then(function () { toast('تأیید شد'); closeSheet(); refresh(false); }).catch(function (e) { toast('❌ ' + errFa(e)); }); }
    };
    (QUICK[r.status] || []).concat(MORE[r.status] || []).forEach(function (q) {
      var a = q[0];
      H['a_' + a] = function () {
        if (a === 'triage') return openTriage(id);
        if (a === 'dispo') return openDispo(id);
        if (a === 'leave_unseen' || a.indexOf('depart_') === 0 || a === 'depart') { if (!window.confirm('این اقدام قطعی است. ادامه می‌دهید؟')) return; }
        doAct(id, a === 'depart' ? DEPART[r.status] : a);
      };
    });
    sheet('کارت بیمار', h, H);
    api('/api/emergency/visits/' + encodeURIComponent(id) + '/timeline').then(function (t) {
      var el = $('edcc_tl'); if (!el) return; var iv = t.intervals || {}, x = '';
      x += '<div style="display:flex;gap:10px;flex-wrap:wrap"><span>تا تریاژ: <b>' + dur(iv.doorToTriageMin) + '</b></span><span>تا پزشک: <b>' + dur(iv.doorToProviderMin) + '</b></span><span>تا تعیین‌تکلیف: <b>' + dur(iv.seenToDispositionMin) + '</b></span><span>مدت حضور: <b>' + dur(iv.losMin) + '</b></span></div>';
      (t.esiHistory || []).forEach(function (e) { x += '<div style="margin-top:4px">' + hhmm(e.at) + ' · ' + (e.kind === 'retriage' ? 'بازتریاژ ' + fa(e.from == null ? '؟' : e.from) + ' → ' : 'تریاژ ') + '<b>ESI ' + fa(e.level) + '</b>' + (e.reason ? ' — ' + esc(e.reason) : '') + '</div>'; });
      (t.transitions || []).slice(-6).forEach(function (e) { x += '<div style="margin-top:2px;color:#94a3b8">' + hhmm(e.at) + ' · ' + esc(ST[e.from] || e.from) + ' ← ' + esc(ST[e.to] || e.to) + '</div>'; });
      el.innerHTML = x;
    }).catch(function () { var el = $('edcc_tl'); if (el) el.innerHTML = ''; });
  }
  function go(fn, name) {
    if (!window.NABZ || typeof NABZ[name] !== 'function') return toast('این بخش در دسترس نیست');
    closeSheet(); stopTimer();
    try { fn(); } catch (e) { toast('❌ ' + errFa(e)); }
  }

  function openRetriage(id) {
    var lv = null, h = '<span class="edcc-q">سطح جدید ESI</span><div class="edcc-row" id="edcc_rl"></div><label class="edcc-q" style="margin-top:10px">دلیل بازتریاژ (الزامی)</label><textarea id="edcc_rr" class="edcc-in" rows="2"></textarea><button type="button" class="edcc-big" data-sa="go">ثبت بازتریاژ</button>';
    function paintL() { var x = ''; for (var i = 1; i <= 5; i++) x += '<button type="button" class="edcc-chip" data-sa="lv" data-v="' + i + '" style="flex:1;font-size:18px;background:' + (lv === i ? esiCol(i) : '#fff') + ';color:' + (lv === i ? '#fff' : esiCol(i)) + ';border-color:' + esiCol(i) + '">' + fa(i) + '</button>'; $('edcc_rl').innerHTML = x; }
    sheet('🔁 بازتریاژ', h, {
      lv: function (el) { lv = Number(el.getAttribute('data-v')); paintL(); },
      go: function () { var rs = $('edcc_rr').value.trim(); if (!lv) return toast('سطح را انتخاب کنید'); if (rs.length < 3) return toast('دلیل را بنویسید'); post('/api/emergency/visits/' + encodeURIComponent(id) + '/retriage', { esiLevel: lv, reason: rs }).then(function () { toast('بازتریاژ ثبت شد'); closeSheet(); refresh(false); }).catch(function (e) { toast('❌ ' + errFa(e)); }); }
    }, paintL);
  }

  // ───────── تعیین‌تکلیف ─────────
  function openDispo(id) {
    var OPT = [['disposition_admit', '🏥 بستری در بخش', 'destination', 'بخش مقصد'], ['disposition_discharge', '🏠 ترخیص', '', ''], ['disposition_transfer', '🚑 انتقال به مرکز دیگر', 'destination', 'مرکز مقصد'], ['leave_ama', '✋ ترک با رضایت شخصی', 'reason', 'دلیل'], ['abscond', '🏃 فرار', 'reason', 'توضیح'], ['declare_death', '🕊️ اعلام فوت', 'note', 'شرح']], sel = null;
    var h = '<div id="edcc_do" class="edcc-row" style="flex-direction:column"></div><div id="edcc_dw" class="edcc-row" style="margin:8px 0"></div><input id="edcc_di" class="edcc-in" style="display:none"><button type="button" class="edcc-big" data-sa="go">ثبت</button>';
    function paintO() { var x = ''; OPT.forEach(function (o, i) { x += '<button type="button" class="edcc-chip' + (sel === i ? ' on' : '') + '" style="text-align:right" data-sa="o" data-i="' + i + '">' + o[1] + '</button>'; }); $('edcc_do').innerHTML = x; }
    sheet('🏁 تعیین‌تکلیف', h, {
      o: function (el) {
        sel = Number(el.getAttribute('data-i')); paintO(); var o = OPT[sel], inp = $('edcc_di');
        inp.style.display = o[2] ? 'block' : 'none'; inp.placeholder = o[3]; inp.value = '';
        var w = $('edcc_dw'); w.innerHTML = '';
        if (o[2] === 'destination' && sel === 0) getPatients().then(function (ps) { var seen = {}, x = ''; ps.forEach(function (p) { var c = p.wardCode; if (c && c !== 'ER' && !seen[c]) { seen[c] = 1; x += '<button type="button" class="edcc-chip" data-sa="w" data-v="' + esc(c) + '">' + esc(c) + '</button>'; } }); w.innerHTML = x; }).catch(function () {});
      },
      w: function (el) { $('edcc_di').value = el.getAttribute('data-v'); },
      go: function () {
        if (sel == null) return toast('یک گزینه انتخاب کنید');
        var o = OPT[sel], b = {}, v = $('edcc_di').value.trim();
        if (o[2]) { if (!v) return toast(o[3] + ' را بنویسید'); b[o[2]] = v; }
        if ((o[0] === 'abscond' || o[0] === 'declare_death') && !window.confirm('این اقدام قطعی است. ادامه می‌دهید؟')) return;
        doAct(id, o[0], b, 'تعیین‌تکلیف ثبت شد');
      }
    }, paintO);
  }

  // ───────── تخت: انتخاب تخت برای بیمار / بیمار برای تخت ─────────
  function openBedPicker(visitId) {
    sheet('🛏️ تخصیص تخت', '<div id="edcc_bp"><span class="spinner"></span></div>', {
      pick: function (el) { post('/api/emergency/visits/' + encodeURIComponent(visitId) + '/assign-bed', { bedId: el.getAttribute('data-v') }).then(function () { toast('تخت تخصیص یافت'); closeSheet(); refresh(false); }).catch(function (e) { toast('❌ ' + errFa(e)); }); }
    });
    api('/api/emergency/beds').then(function (d) {
      var el = $('edcc_bp'); if (!el) return; var h = '';
      d.zones.forEach(function (z) {
        var free = d.items.filter(function (b) { return b.zone === z.code && (b.status === 'empty' || b.status === 'available'); });
        if (!free.length) return;
        h += '<div class="edcc-q" style="margin-top:8px">' + esc(z.label) + ' (' + fa(free.length) + ' آزاد)</div><div class="edcc-grid">';
        free.forEach(function (b) { h += '<button type="button" class="edcc-tile" data-sa="pick" data-v="' + esc(b.id) + '" style="border-color:#16a34a;background:#f0fdf4">' + esc(b.code || b.label) + '</button>'; });
        h += '</div>';
      });
      el.innerHTML = h || '<div style="color:#94a3b8;text-align:center;padding:20px">تخت آزاد نیست</div>';
    }).catch(function (e) { var el = $('edcc_bp'); if (el) el.innerHTML = '<div style="color:#991b1b">' + esc(errFa(e)) + '</div>'; });
  }
  function openVisitPicker(bedId) {
    var rows = ((S.board && S.board.rows) || []).filter(function (r) { return !r.bedId; }), h = '';
    if (!rows.length) return toast('بیمار بدون تختی در تابلو نیست');
    rows.forEach(function (r) { h += '<button type="button" class="edcc-chip" style="display:block;width:100%;text-align:right;margin-bottom:6px;border-inline-start:6px solid ' + esiCol(r.esiLevel) + '" data-sa="pick" data-v="' + esc(r.id) + '">' + esc(r.patientName) + ' · ' + esc(ST[r.status] || r.status) + ' · ' + esc(r.chiefComplaint) + '</button>'; });
    sheet('تخصیص بیمار به تخت', h, { pick: function (el) { post('/api/emergency/visits/' + encodeURIComponent(el.getAttribute('data-v')) + '/assign-bed', { bedId: bedId }).then(function () { toast('تخت تخصیص یافت'); closeSheet(); refresh(false); }).catch(function (e) { toast('❌ ' + errFa(e)); }); } });
  }

  // ───────── اتصال به پرونده ─────────
  function openLink(visitId) {
    var h = '<input id="edcc_ls" class="edcc-in" placeholder="جستجوی نام یا شماره پرونده…" type="search"><div id="edcc_ll"><span class="spinner"></span></div>';
    function draw(q) {
      var box = $('edcc_ll'); if (!box) return;
      var list = (S.patients || []).filter(function (p) { var s = ((p.firstName || '') + ' ' + (p.lastName || '') + ' ' + (p.name || '') + ' ' + (p.mrn || '') + ' ' + p.id).toLowerCase(); return !q || s.indexOf(q.toLowerCase()) !== -1; }).slice(0, 40), x = '';
      list.forEach(function (p) { x += '<button type="button" class="edcc-chip" style="display:block;width:100%;text-align:right;margin-bottom:6px" data-sa="pick" data-v="' + esc(p.id) + '">' + esc((p.firstName || '') + ' ' + (p.lastName || p.name || '')) + ' · ' + esc(p.mrn || p.id) + '</button>'; });
      box.innerHTML = x || '<div style="color:#94a3b8;text-align:center;padding:16px">پیدا نشد</div>';
    }
    sheet('🔗 اتصال به پرونده', h, {
      pick: function (el) { post('/api/emergency/visits/' + encodeURIComponent(visitId) + '/link-patient', { patientId: el.getAttribute('data-v') }).then(function () { toast('متصل شد'); closeSheet(); refresh(false); }).catch(function (e) { toast('❌ ' + errFa(e)); }); }
    }, function (o) { o.addEventListener('input', function (ev) { if (ev.target && ev.target.id === 'edcc_ls') draw(ev.target.value.trim()); }); });
    getPatients().then(function () { draw(''); }).catch(function (e) { var b = $('edcc_ll'); if (b) b.innerHTML = '<div style="color:#991b1b">فهرست بیماران بارگذاری نشد: ' + esc(errFa(e)) + '</div>'; });
  }

  // ───────── کد و MCI ─────────
  function openCodeNew(type) {
    var meta = (S.codes && S.codes.meta) || {}, label = (meta[type] && meta[type].label) || type, rows = ((S.board && S.board.rows) || []), h = '<label class="edcc-q">بیمار (از تابلو)</label><select id="edcc_cv" class="edcc-in"><option value="">— انتخاب نشده —</option>';
    rows.forEach(function (r) { h += '<option value="' + esc(r.id) + '">' + esc(r.patientName) + '</option>'; });
    h += '</select><label class="edcc-q">یا نام بیمار</label><input id="edcc_cn" class="edcc-in"><button type="button" class="edcc-big" style="background:#991b1b" data-sa="go">🔴 فعال‌سازی ' + esc(label) + '</button>';
    sheet('فعال‌سازی کد', h, { go: function () {
      var vid = $('edcc_cv').value, nm = $('edcc_cn').value.trim(), r = vid ? rowOf(vid) : null, b = { type: type };
      if (vid) { b.visitId = vid; b.patientName = r ? r.patientName : nm; } else if (nm) b.patientName = nm;
      post('/api/erf/codes', b).then(function () { toast('کد فعال شد'); closeSheet(); refresh(false); }).catch(function (e) { toast('❌ ' + errFa(e)); });
    } });
  }
  function openMciNew() {
    var h = '<label class="edcc-q">سطح هشدار</label><select id="edcc_ml" class="edcc-in"><option value="L1">سطح ۱ — محلی</option><option value="L2">سطح ۲ — بیمارستانی</option><option value="L3">سطح ۳ — گسترده</option></select><label class="edcc-q">نوع حادثه</label><input id="edcc_mt" class="edcc-in" placeholder="تصادف زنجیره‌ای، آتش‌سوزی، ..."><label class="edcc-q">محل</label><input id="edcc_mp" class="edcc-in"><label class="edcc-q">برآورد تعداد مصدوم</label><input id="edcc_me" type="number" inputmode="numeric" class="edcc-in"><button type="button" class="edcc-big" style="background:#991b1b" data-sa="go">🌐 فعال‌سازی طرح بحران</button>';
    sheet('🌐 فعال‌سازی MCI', h, { go: function () {
      if (!window.confirm('طرح بحران فعال شود؟')) return;
      post('/api/emergency/mci', { alertLevel: $('edcc_ml').value, incidentType: $('edcc_mt').value.trim() || 'unknown', location: $('edcc_mp').value.trim(), estimatedCasualties: Number($('edcc_me').value) || 0 }).then(function () { toast('MCI فعال شد'); closeSheet(); refresh(false); }).catch(function (e) { toast('❌ ' + errFa(e)); });
    } });
  }

  var ACT = {
    reload: function () { refresh(true); }, reg: function () { openRegister(); },
    tab: function (id, el) { S.tab = el.getAttribute('data-tab'); refresh(true); },
    filter: function (id, el) { S.filter = el.getAttribute('data-f'); paint(); },
    days: function (id, el) { S.days = Number(el.getAttribute('data-d')); refresh(true); },
    open: function (id) { openPatient(id); }, triage: function (id) { openTriage(id); },
    see: function (id) { doAct(id, 'see'); }, bed: function (id) { openBedPicker(id); }, dispo: function (id) { openDispo(id); },
    depart: function (id) { var r = rowOf(id), a = r && DEPART[r.status]; if (a && window.confirm('خروج بیمار از اورژانس ثبت شود؟')) doAct(id, a); },
    bedtile: function (id, el) { onBedTile(el); },
    cnew: function (id) { openCodeNew(id); },
    cstep: function (id, el) {
      var legacy = el.getAttribute('data-legacy') === '1', step = el.getAttribute('data-step');
      post(legacy ? '/api/emergency/codes/' + encodeURIComponent(id) + '/step' : '/api/erf/codes/' + encodeURIComponent(id) + '/step', { step: step }).then(function () { toast('ثبت شد'); refresh(false); }).catch(function (e) { toast('❌ ' + errFa(e)); });
    },
    cres: function (id, el) {
      var legacy = el.getAttribute('data-legacy') === '1';
      if (legacy) { NABZ.dialog.form({ icon: '🚨', title: 'بستن کد', fields: [{ key: 'outcome', label: 'نتیجهٔ کد', required: true, type: 'select', options: [['ROSC','ROSC — بازگشت گردش خون'],['death','فوت'],['transfer','انتقال به ICU'],['other','سایر']] }], submitLabel: 'بستن' }).then(function (data) { if (!data) return; return post('/api/emergency/codes/' + encodeURIComponent(id) + '/close', { outcome: data.outcome }).then(function () { toast('✅ کد بسته شد'); refresh(false); }).catch(function (e) { toast('❌ ' + errFa(e)); }); }); }
      if (!window.confirm('کد پایان یابد؟')) return;
      post('/api/erf/codes/' + encodeURIComponent(id) + '/resolve', {}).then(function () { toast('کد بسته شد'); refresh(false); }).catch(function (e) { toast('❌ ' + errFa(e)); });
    },
    mnew: function () { openMciNew(); },
    mcount: function (id, el) { post('/api/emergency/mci/' + encodeURIComponent(id) + '/count', { color: el.getAttribute('data-c'), delta: Number(el.getAttribute('data-d')) }).then(function () { refresh(false); }).catch(function (e) { toast('❌ ' + errFa(e)); }); },
    mclose: function (id) { if (!window.confirm('طرح بحران پایان یابد؟')) return; post('/api/emergency/mci/' + encodeURIComponent(id) + '/close', {}).then(function () { toast('MCI بسته شد'); refresh(false); }).catch(function (e) { toast('❌ ' + errFa(e)); }); }
  };

  function register() {
    if (!window.NABZ || typeof NABZ.registerKind !== 'function') return false;
    [['ed_cc', 'board'], ['ed_cc_patients', 'board'], ['ed_cc_beds', 'beds'], ['ed_cc_codes', 'codes'], ['ed_cc_mci', 'mci'], ['ed_cc_stats', 'stats']].forEach(function (p) { NABZ.registerKind(p[0], function () { open(p[1]); }); });
    NABZ.edCC = { open: open };
    return true;
  }
  var tries = 0;
  (function wait() { if (register()) return; if (++tries > 100) return console.warn('[ED-CC] NABZ.registerKind not found'); setTimeout(wait, 50); })();
})();
