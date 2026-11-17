// ═══════════════════════════════════════════════════════════
//  NABZ — Teaching Mode UI (S4)
//  Flat functions · ACGME-aligned
// ═══════════════════════════════════════════════════════════
(function(){
'use strict';
const state = { tab: 'pending', mode: 'attending', data: null, portfolio: null, learnerId: null };
const cache = {};

function _api(p, o) { return NABZ._api(p, o); }
function _esc(s) { return NABZ._esc(s); }
function _close() { document.querySelectorAll('.bs-backdrop').forEach(el => el.remove()); }
function _sheet(html) {
  const s = document.createElement('div'); s.className = 'bs-backdrop';
  s.onclick = e => { if (e.target === s) s.remove(); };
  const c = document.createElement('div'); c.className = 'bs-sheet';
  c.style.maxHeight = '96vh'; c.innerHTML = html;
  s.appendChild(c); document.body.appendChild(s);
  requestAnimationFrame(() => s.classList.add('show'));
  return { sheet: s, content: c };
}
function _time(iso) { if (!iso) return '—'; try { return new Date(iso).toLocaleString('fa-IR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); } catch (_) { return '—'; } }
function _ago(iso) { if (!iso) return '—'; const ms = Date.now() - new Date(iso).getTime(); const m = Math.floor(ms/60000); if (m < 1) return 'الان'; if (m < 60) return m + 'د'; const hr = Math.floor(m/60); if (hr < 24) return hr + 'س'; return Math.floor(hr/24) + ' روز'; }

const RATING_FA = { below:'زیر انتظار', meets:'مطابق انتظار', above:'بالاتر از انتظار', exceeds:'فراتر از انتظار' };
const RATING_CLS = { below:'dng', meets:'info', above:'ok', exceeds:'ok' };
const CASE_FA = { diagnosis:'تشخیص', procedure:'پروسیجر', encounter:'ویزیت', complication:'عارضه', delivery:'زایمان', resuscitation:'احیا' };
const CASE_ICON = { diagnosis:'🔍', procedure:'💉', encounter:'🩺', complication:'⚠️', delivery:'👶', resuscitation:'🚨' };
const ROLE_FA = { primary:'اصلی', assist:'کمک', observer:'مشاهده', supervisor:'ناظر' };

async function show(p, d) {
  const m = document.getElementById('content');
  m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
  const user = NABZ.state.user;
  state.mode = ['resident','intern'].includes(user.role) ? 'learner' : 'attending';
  try {
    if (state.mode === 'learner') {
      const d2 = await _api('/api/teach/portfolio/' + user.id);
      state.portfolio = d2; state.learnerId = user.id;
    } else {
      const d2 = await _api('/api/teach/dashboard');
      state.data = d2;
    }
    _render(p);
    _subscribeLive();
  } catch (e) {
    m.innerHTML = '<div class="empty">خطا: ' + _esc(e.message) + '</div>';
  }
}

function _render(p) {
  if (state.mode === 'learner') _renderLearner(p);
  else _renderAttending(p);
  NABZ.state.current = p ? p.id : 'teaching_mode.hub';
}

function _renderAttending(p) {
  const m = document.getElementById('content');
  const d = state.data || {};
  const pending = d.pendingOrders || { total: 0, items: [] };
  const unverified = d.unverifiedCases || { total: 0, items: [] };
  const learners = d.learners || { total: 0, items: [] };
  const violations = d.dutyViolations || [];
  const st = d.stats || {};

  let h = '<div class="sec-hd"><span>🎓 بیمارستان آموزشی</span><span class="rd-mini">ACGME</span></div>';

  if (pending.total > 0 || violations.length > 0) {
    h += '<div style="background:var(--warn-soft);border:2px solid var(--warn);border-radius:12px;padding:12px;margin-bottom:12px">';
    if (pending.total > 0) h += '<div style="font-size:13px;font-weight:900;color:var(--warn)">📝 ' + pending.total + ' دستور آموزشی منتظر تأیید شما</div>';
    if (violations.length > 0) h += '<div style="font-size:12px;color:var(--dng);font-weight:900;margin-top:4px">⚠️ ' + violations.length + ' نقض ساعت کاری</div>';
    h += '</div>';
  }

  h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">';
  h += '<div class="rd-stat ' + (pending.total > 0 ? 'dng' : 'ok') + '"><div class="v">' + pending.total + '</div><div class="l">منتظر تأیید</div></div>';
  h += '<div class="rd-stat ' + (unverified.total > 0 ? 'warn' : '') + '"><div class="v">' + unverified.total + '</div><div class="l">case تأییدنشده</div></div>';
  h += '<div class="rd-stat info"><div class="v">' + learners.total + '</div><div class="l">پرسنل آموزشی</div></div>';
  h += '<div class="rd-stat ok"><div class="v">' + (st.approved || 0) + '</div><div class="l">تأییدشده</div></div>';
  h += '</div>';

  const tabs = [
    ['pending','📝 دستورها (' + pending.total + ')'],
    ['cases','📋 Case Verification (' + unverified.total + ')'],
    ['learners','👥 پرسنل (' + learners.total + ')'],
    ['violations','⏰ Duty Hours']
  ];
  h += '<div class="crisis-tabs" style="margin-bottom:12px;flex-wrap:wrap">';
  tabs.forEach(([k,l]) => { h += '<button class="crisis-tab' + (state.tab === k ? ' on' : '') + '" onclick="NABZ.teaching._setTab(\'' + k + '\')">' + l + '</button>'; });
  h += '</div>';
  h += '<div id="teachContent"></div>';
  m.innerHTML = h;

  if (state.tab === 'pending') _renderPendingOrders();
  else if (state.tab === 'cases') _renderUnverifiedCases();
  else if (state.tab === 'learners') _renderLearners();
  else if (state.tab === 'violations') _renderViolations();
}

function _setTab(t) { state.tab = t; _render(null); }

function _renderPendingOrders() {
  const el = document.getElementById('teachContent');
  if (!el) return;
  const items = (state.data && state.data.pendingOrders && state.data.pendingOrders.items) || [];
  if (!items.length) { el.innerHTML = '<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">✅</div><div style="font-weight:900;margin-top:8px">هیچ دستوری منتظر تأیید نیست</div></div>'; return; }
  let h = '';
  items.forEach(o => {
    const cls = o.priority === 'stat' ? 'dng' : o.priority === 'urgent' ? 'warn' : 'info';
    const details = o.details || {};
    h += '<div class="card" style="padding:10px;margin-bottom:6px;border-right:3px solid var(--' + cls + ')">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:12.5px;font-weight:900">👨‍⚕️ ' + _esc(o.learnerName) + ' — ' + _esc(o.patientName) + '</div>';
    h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px"><b>' + _esc(o.type) + ':</b> ' + _esc(details.drug || details.panel || details.note || JSON.stringify(details).slice(0,60)) + '</div>';
    if (details.dose) h += '<div style="font-size:10.5px;color:var(--fg-2)">' + _esc(details.dose) + ' · ' + _esc(details.route || '') + ' · ' + _esc(details.frequency || '') + '</div>';
    h += '<div style="font-size:10px;color:var(--fg-3);margin-top:2px">' + _ago(o.createdAt) + ' · ' + _esc(o.priority) + '</div>';
    h += '</div></div>';
    h += '<div style="display:flex;gap:4px;margin-top:8px">';
    h += '<button class="btn btn-ok btn-sm" style="flex:1;padding:8px;font-size:11px;font-weight:900" onclick="NABZ.teaching._approveDialog(\'' + o.id + '\',\'' + _esc(o.learnerName) + '\',\'' + _esc(details.drug || o.type) + '\')">✅ تأیید</button>';
    h += '<button class="btn btn-dng btn-sm" style="flex:1;padding:8px;font-size:11px" onclick="NABZ.teaching._rejectDialog(\'' + o.id + '\',\'' + _esc(o.learnerName) + '\')">❌ رد + بازخورد</button>';
    h += '</div></div>';
  });
  el.innerHTML = h;
}

function _renderUnverifiedCases() {
  const el = document.getElementById('teachContent');
  if (!el) return;
  const items = (state.data && state.data.unverifiedCases && state.data.unverifiedCases.items) || [];
  if (!items.length) { el.innerHTML = '<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">✅</div><div style="font-weight:900;margin-top:8px">همه caseها تأیید شده</div></div>'; return; }
  let h = '';
  items.forEach(c => {
    h += '<div class="card" style="padding:10px;margin-bottom:4px">';
    h += '<div style="font-size:12.5px;font-weight:900">' + (CASE_ICON[c.caseType] || '●') + ' ' + _esc(c.caseName) + '</div>';
    h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">👨‍⚕️ ' + _esc(c.learnerName) + ' · بیمار: ' + _esc(c.patientName) + ' · ' + (CASE_FA[c.caseType] || c.caseType) + '</div>';
    h += '<div style="font-size:10px;color:var(--fg-3)">' + _ago(c.at) + '</div>';
    h += '<button class="btn btn-ok btn-sm" style="width:100%;margin-top:6px;padding:8px;font-size:11px;font-weight:900" onclick="NABZ.teaching._verifyCase(\'' + c.id + '\')">✅ تأیید case</button>';
    h += '</div>';
  });
  el.innerHTML = h;
}

function _renderLearners() {
  const el = document.getElementById('teachContent');
  if (!el) return;
  const items = (state.data && state.data.learners && state.data.learners.items) || [];
  if (!items.length) { el.innerHTML = '<div class="empty">پرسنل آموزشی در محدوده شما نیست</div>'; return; }
  let h = '';
  items.forEach(l => {
    const roleFa = l.role === 'resident' ? 'رزیدنت' : l.role === 'intern' ? 'اینترن' : l.role;
    h += '<div class="card" style="padding:10px;margin-bottom:4px;cursor:pointer" onclick="NABZ.teaching._openPortfolio(\'' + l.id + '\')">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center">';
    h += '<div><div style="font-size:13px;font-weight:900">' + _esc(l.name) + '</div>';
    h += '<div style="font-size:11px;color:var(--fg-2)">' + roleFa + (l.ward ? ' · ' + _esc(l.ward) : '') + '</div></div>';
    h += '<div style="text-align:left;font-size:20px">📊</div>';
    h += '</div></div>';
  });
  el.innerHTML = h;
}

function _renderViolations() {
  const el = document.getElementById('teachContent');
  if (!el) return;
  const items = (state.data && state.data.dutyViolations) || [];
  if (!items.length) { el.innerHTML = '<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">✅</div><div style="font-weight:900;margin-top:8px">هیچ نقض ساعت کاری نیست</div></div>'; return; }
  let h = '';
  items.forEach(v => {
    h += '<div class="card" style="padding:10px;margin-bottom:6px;border-color:var(--dng)">';
    h += '<div style="font-size:12.5px;font-weight:900;color:var(--dng)">🚨 ' + _esc(v.learnerName) + '</div>';
    v.violations.forEach(x => {
      const label = x.type === 'weekly_over' ? 'ساعت هفتگی > ۸۰' : x.type === 'continuous_over' ? 'شیفت پیوسته > ۲۸h' : 'استراحت < ۸h';
      h += '<div style="font-size:11px;margin-top:2px">• ' + label + ' — مقدار: <b>' + x.value + '</b> (حد: ' + x.limit + ')</div>';
    });
    h += '</div>';
  });
  el.innerHTML = h;
}

// ═══ LEARNER PORTAL ═══
function _renderLearner(p) {
  const m = document.getElementById('content');
  const d = state.portfolio || {};
  const learner = d.learner || {};
  const duty = d.duty || {};
  const cases = d.cases || { total: 0, verified: 0, byType: {} };
  const feedback = d.feedback || [];
  const epas = d.epas || [];
  const milestones = d.milestones || [];
  const orders = d.recentOrders || [];

  let h = '<div class="sec-hd"><span>🎓 پورتفولیوی من</span><span class="rd-mini">ACGME</span></div>';
  h += '<div class="card" style="background:linear-gradient(135deg,rgba(6,182,212,.12),rgba(139,92,246,.06));margin-bottom:12px">';
  h += '<div style="font-size:16px;font-weight:900">' + _esc(learner.name || '') + '</div>';
  h += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:2px">' + (learner.role === 'resident' ? 'رزیدنت' : learner.role === 'intern' ? 'اینترن' : learner.role) + (learner.ward ? ' · ' + _esc(learner.ward) : '') + '</div>';
  h += '</div>';

  // Duty hour check-in banner
  if (duty.currentlyOnDuty) {
    h += '<div class="card" style="background:var(--ok-soft);border-color:var(--ok);margin-bottom:10px">';
    h += '<div style="font-size:12px;font-weight:900;color:var(--ok)">✅ در حال انجام شیفت — ' + _ago(duty.openShift && duty.openShift.checkinAt) + '</div>';
    h += '<button class="btn btn-dng btn-block" style="margin-top:6px;padding:8px;font-size:11px" onclick="NABZ.teaching._dutyCheckout()">⏹ پایان شیفت</button>';
    h += '</div>';
  } else {
    h += '<button class="btn btn-ok btn-block" style="padding:10px;margin-bottom:10px;font-weight:900" onclick="NABZ.teaching._dutyCheckin()">▶ شروع شیفت (Duty Hour)</button>';
  }

  if (duty.violations && duty.violations.length > 0) {
    h += '<div style="background:var(--dng-soft);border:2px solid var(--dng);border-radius:10px;padding:10px;margin-bottom:12px">';
    h += '<div style="font-size:12px;font-weight:900;color:var(--dng)">🚨 نقض ساعت کاری</div>';
    duty.violations.forEach(v => {
      const label = v.type === 'weekly_over' ? 'ساعت هفتگی > ۸۰' : v.type === 'continuous_over' ? 'شیفت > ۲۸h' : 'استراحت < ۸h';
      h += '<div style="font-size:11px;margin-top:2px">• ' + label + ' — ' + v.value + '</div>';
    });
    h += '</div>';
  }

  // Stats
  h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">';
  h += '<div class="rd-stat ok"><div class="v">' + cases.verified + '/' + cases.total + '</div><div class="l">case تأییدشده</div></div>';
  h += '<div class="rd-stat ' + (duty.totalHours > 60 ? 'warn' : 'info') + '"><div class="v">' + (duty.totalHours || 0) + 'h</div><div class="l">شیفت هفته</div></div>';
  h += '<div class="rd-stat"><div class="v">' + epas.filter(e => e.currentLevel >= 4).length + '/' + epas.length + '</div><div class="l">EPA سطح ۴+</div></div>';
  h += '<div class="rd-stat"><div class="v">' + milestones.filter(m => m.currentLevel >= 3).length + '/' + milestones.length + '</div><div class="l">Milestone ۳+</div></div>';
  h += '</div>';

  const tabs = [
    ['cases','📋 Case Log'],
    ['epas','🎯 EPA'],
    ['milestones','📊 Milestones'],
    ['duty','⏰ Duty Hours'],
    ['feedback','💬 بازخورد (' + feedback.length + ')']
  ];
  h += '<div class="crisis-tabs" style="margin-bottom:12px;flex-wrap:wrap">';
  tabs.forEach(([k,l]) => { h += '<button class="crisis-tab' + (state.tab === k ? ' on' : '') + '" onclick="NABZ.teaching._setTab(\'' + k + '\')">' + l + '</button>'; });
  h += '</div>';
  h += '<div id="teachContent"></div>';
  m.innerHTML = h;

  if (state.tab === 'pending' || state.tab === 'learners' || state.tab === 'violations') state.tab = 'cases';
  if (state.tab === 'cases') _renderMyCases();
  else if (state.tab === 'epas') _renderMyEPAs();
  else if (state.tab === 'milestones') _renderMyMilestones();
  else if (state.tab === 'duty') _renderMyDuty();
  else if (state.tab === 'feedback') _renderMyFeedback();
}

function _renderMyCases() {
  const el = document.getElementById('teachContent');
  if (!el) return;
  const c = (state.portfolio && state.portfolio.cases) || { list: [] };
  let h = '<button class="btn btn-primary btn-block" style="padding:10px;margin-bottom:8px;font-weight:900" onclick="NABZ.teaching._caseDialog()">➕ ثبت case جدید</button>';
  const items = c.list || [];
  if (!items.length) { h += '<div class="empty">هیچ caseای ثبت نکرده‌اید</div>'; el.innerHTML = h; return; }
  items.forEach(cs => {
    const cls = cs.verified ? 'ok' : 'warn';
    h += '<div class="card" style="padding:8px 10px;margin-bottom:4px;border-right:3px solid var(--' + cls + ')">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:12px;font-weight:900">' + (CASE_ICON[cs.caseType] || '●') + ' ' + _esc(cs.caseName) + '</div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2)">' + _esc(cs.patientName) + ' · ' + (CASE_FA[cs.caseType] || cs.caseType) + ' · ' + (ROLE_FA[cs.role] || cs.role) + '</div>';
    h += '<div style="font-size:10px;color:var(--fg-3)">' + _ago(cs.at) + '</div>';
    h += '</div>';
    h += '<span class="pill ' + cls + '" style="font-size:9px">' + (cs.verified ? '✅' : '⏳') + '</span>';
    h += '</div></div>';
  });
  el.innerHTML = h;
}

function _renderMyEPAs() {
  const el = document.getElementById('teachContent');
  if (!el) return;
  const items = (state.portfolio && state.portfolio.epas) || [];
  let h = '<div style="font-size:11px;color:var(--fg-2);margin-bottom:8px">AAMC Core EPAs — سطح استقلال فعلی (۱ = مشاهده، ۵ = مستقل)</div>';
  items.forEach(e => {
    const level = e.currentLevel || 0;
    const color = level >= 4 ? 'ok' : level >= 3 ? 'warn' : level >= 1 ? 'info' : 'fg-3';
    h += '<div class="card" style="padding:8px 10px;margin-bottom:4px">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
    h += '<div style="flex:1"><div style="font-size:11.5px;font-weight:900">' + e.icon + ' ' + _esc(e.fa) + '</div>';
    h += '<div style="font-size:10px;color:var(--fg-3)">' + _esc(e.en) + '</div></div>';
    h += '<div style="text-align:left"><div style="font-size:18px;font-weight:900;color:var(--' + color + ')">' + (level ? level + '/5' : '—') + '</div>';
    if (e.assessmentsCount) h += '<div style="font-size:9px;color:var(--fg-3)">' + e.assessmentsCount + ' ارزیابی</div>';
    h += '</div></div>';
    h += '</div>';
  });
  el.innerHTML = h;
}

function _renderMyMilestones() {
  const el = document.getElementById('teachContent');
  if (!el) return;
  const items = (state.portfolio && state.portfolio.milestones) || [];
  let h = '<div style="font-size:11px;color:var(--fg-2);margin-bottom:8px">ACGME 6 Core Competencies — سطح فعلی (۱-۵)</div>';
  items.forEach(m => {
    const level = m.currentLevel || 0;
    const color = level >= 4 ? 'ok' : level >= 3 ? 'warn' : level >= 1 ? 'info' : 'fg-3';
    h += '<div class="card" style="padding:10px;margin-bottom:4px">';
    h += '<div style="font-size:12px;font-weight:900">' + m.icon + ' ' + _esc(m.fa) + '</div>';
    h += '<div style="font-size:10px;color:var(--fg-3);margin-top:2px">' + _esc(m.en) + '</div>';
    h += '<div style="display:flex;gap:3px;margin-top:8px">';
    for (let i = 1; i <= 5; i++) {
      const filled = i <= level;
      h += '<div style="flex:1;height:8px;background:' + (filled ? 'var(--' + color + ')' : 'var(--bg-3)') + ';border-radius:2px"></div>';
    }
    h += '</div>';
    h += '<div style="font-size:10.5px;color:var(--' + color + ');font-weight:800;margin-top:4px">' + (level ? 'سطح ' + level + ' · ' + (m.lastBy || '') : 'ارزیابی نشده') + '</div>';
    h += '</div>';
  });
  el.innerHTML = h;
}

function _renderMyDuty() {
  const el = document.getElementById('teachContent');
  if (!el) return;
  const d = (state.portfolio && state.portfolio.duty) || {};
  let h = '<div class="rd-stats" style="grid-template-columns:repeat(2,1fr);margin-bottom:12px">';
  h += '<div class="rd-stat ' + (d.totalHours > 80 ? 'dng' : d.totalHours > 60 ? 'warn' : 'ok') + '"><div class="v">' + (d.totalHours || 0) + 'h</div><div class="l">هفته جاری / ۸۰</div></div>';
  h += '<div class="rd-stat ' + (d.maxContinuousHours > 28 ? 'dng' : 'info') + '"><div class="v">' + (d.maxContinuousHours || 0) + 'h</div><div class="l">طولانی‌ترین شیفت</div></div>';
  h += '</div>';
  h += '<div class="card" style="margin-bottom:10px">';
  h += '<div style="font-size:11.5px;font-weight:900;margin-bottom:6px">قوانین ACGME</div>';
  h += '<div style="font-size:11px;color:var(--fg-2);line-height:1.7">';
  h += '• حداکثر <b>۸۰</b> ساعت در هفته<br>';
  h += '• حداکثر <b>۲۸</b> ساعت شیفت پیوسته (24+4)<br>';
  h += '• حداقل <b>۸</b> ساعت استراحت بین شیفت‌ها<br>';
  h += '</div></div>';
  if (d.violations && d.violations.length) {
    h += '<div style="background:var(--dng-soft);border:2px solid var(--dng);border-radius:10px;padding:10px">';
    h += '<div style="font-size:12px;font-weight:900;color:var(--dng);margin-bottom:4px">🚨 نقض</div>';
    d.violations.forEach(v => { h += '<div style="font-size:11px">• ' + v.type + ' — ' + v.value + '</div>'; });
    h += '</div>';
  }
  el.innerHTML = h;
}

function _renderMyFeedback() {
  const el = document.getElementById('teachContent');
  if (!el) return;
  const items = (state.portfolio && state.portfolio.feedback) || [];
  if (!items.length) { el.innerHTML = '<div class="empty">هنوز بازخوردی دریافت نکرده‌اید</div>'; return; }
  let h = '';
  items.forEach(f => {
    const cls = RATING_CLS[f.rating] || 'info';
    h += '<div class="card" style="padding:10px;margin-bottom:6px;border-right:3px solid var(--' + cls + ')">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:11.5px;font-weight:900">' + _esc(f.by) + ' · ' + _esc(f.context) + '</div>';
    h += '<div style="font-size:10px;color:var(--fg-3)">' + _ago(f.at) + '</div>';
    h += '</div>';
    h += '<span class="pill ' + cls + '" style="font-size:9px">' + (RATING_FA[f.rating] || f.rating) + '</span>';
    h += '</div>';
    h += '<div style="font-size:11.5px;margin-top:6px"><b style="color:var(--ok)">✅ What went well:</b><br>' + _esc(f.whatWentWell) + '</div>';
    h += '<div style="font-size:11.5px;margin-top:4px"><b style="color:var(--warn)">📈 What to improve:</b><br>' + _esc(f.whatToImprove) + '</div>';
    if (f.actionItems) h += '<div style="font-size:11.5px;margin-top:4px"><b style="color:var(--primary)">🎯 Action items:</b><br>' + _esc(f.actionItems) + '</div>';
    h += '</div>';
  });
  el.innerHTML = h;
}

// ═══ MODALS ═══
function _approveDialog(recId, learnerName, what) {
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">✅ تأیید دستور ' + _esc(learnerName) + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="hint info" style="margin-bottom:10px">دستور آموزشی «' + _esc(what) + '»</div>';
  h += '<div class="wf-field"><label>بازخورد (اختیاری)</label><textarea id="tm_fb" rows="3" placeholder="چرا تأیید شد / نکات آموزشی..."></textarea></div>';
  h += '<button class="btn btn-ok btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.teaching._submitApprove(\'' + recId + '\')">✅ تأیید</button>';
  _sheet(h);
}

async function _submitApprove(recId) {
  const fb = (document.getElementById('tm_fb') || {}).value || '';
  try {
    await _api('/api/teach/order/' + recId + '/approve', { method:'POST', body: JSON.stringify({ feedback: fb }) });
    _close(); NABZ._toast('✅ تأیید شد'); show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

function _rejectDialog(recId, learnerName) {
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title" style="color:var(--dng)">❌ رد دستور ' + _esc(learnerName) + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="hint danger" style="margin-bottom:10px">⚠️ JCI — بازخورد آموزشی الزامی است</div>';
  h += '<div class="wf-field"><label>بازخورد (حداقل ۱۰ کاراکتر) *</label><textarea id="tm_rfb" rows="4" placeholder="چرا رد شد؟ چه چیزی را باید تغییر دهد؟"></textarea></div>';
  h += '<button class="btn btn-dng btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.teaching._submitReject(\'' + recId + '\')">❌ رد + بازخورد</button>';
  _sheet(h);
}

async function _submitReject(recId) {
  const fb = (document.getElementById('tm_rfb') || {}).value || '';
  if (fb.trim().length < 10) return alert('بازخورد حداقل ۱۰ کاراکتر');
  try {
    await _api('/api/teach/order/' + recId + '/reject', { method:'POST', body: JSON.stringify({ feedback: fb }) });
    _close(); NABZ._toast('❌ رد شد + بازخورد'); show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

async function _verifyCase(caseId) {
  if (!confirm('تأیید این case؟')) return;
  try {
    await _api('/api/teach/case/' + caseId + '/verify', { method:'POST', body:'{}' });
    NABZ._toast('✅ case تأیید شد'); show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

function _caseDialog() {
  const user = NABZ.state.user;
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📋 ثبت case جدید</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>بیمار *</label><select id="tm_casePatient"><option value="">در حال بارگذاری...</option></select></div>';
  h += '<div class="wf-field"><label>نوع case *</label><select id="tm_caseType">';
  Object.entries(CASE_FA).forEach(([k, v]) => { h += '<option value="' + k + '">' + (CASE_ICON[k] || '') + ' ' + v + '</option>'; });
  h += '</select></div>';
  h += '<div class="wf-field"><label>عنوان/تشخیص *</label><input id="tm_caseName" type="text" placeholder="مثلاً: STEMI anterior"></div>';
  h += '<div class="wf-field"><label>نقش شما</label><select id="tm_caseRole"><option value="primary">اصلی</option><option value="assist">کمک</option><option value="observer">مشاهده</option></select></div>';
  h += '<div class="wf-field"><label>یادداشت</label><textarea id="tm_caseNotes" rows="2"></textarea></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.teaching._submitCase()">✅ ثبت</button>';
  _sheet(h);
  _api('/api/nurse/my-shift').then(r => {
    const sel = document.getElementById('tm_casePatient');
    if (!sel) return;
    const patients = r.patients || [];
    sel.innerHTML = '';
    if (!patients.length) { sel.innerHTML = '<option value="">بیماری نیست</option>'; return; }
    patients.forEach(p => { sel.innerHTML += '<option value="' + p.id + '">' + _esc(p.name) + ' — ' + _esc(p.ward || '') + '</option>'; });
  }).catch(() => {});
}

async function _submitCase() {
  const body = {
    patientId: (document.getElementById('tm_casePatient') || {}).value,
    caseType: (document.getElementById('tm_caseType') || {}).value,
    caseName: (document.getElementById('tm_caseName') || {}).value,
    role: (document.getElementById('tm_caseRole') || {}).value,
    notes: (document.getElementById('tm_caseNotes') || {}).value
  };
  if (!body.patientId) return alert('بیمار الزامی');
  if (!body.caseName) return alert('عنوان الزامی');
  try {
    await _api('/api/teach/case', { method:'POST', body: JSON.stringify(body) });
    _close(); NABZ._toast('✅ case ثبت شد'); show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

async function _dutyCheckin() {
  try { await _api('/api/teach/duty/checkin', { method:'POST', body:'{}' }); NABZ._toast('▶ شیفت شروع شد'); show(null, null); }
  catch (e) { alert('خطا: ' + e.message); }
}

async function _dutyCheckout() {
  try {
    const r = await _api('/api/teach/duty/checkout', { method:'POST', body:'{}' });
    let msg = '⏹ شیفت پایان — ' + r.rec.hours + 'h';
    if (r.violations && r.violations.length) msg += '\n⚠️ ' + r.violations.length + ' نقض';
    NABZ._toast(msg); show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

async function _openPortfolio(learnerId) {
  try {
    const d = await _api('/api/teach/portfolio/' + learnerId);
    state.portfolio = d;
    state.learnerId = learnerId;
    _renderPortfolioModal(d);
  } catch (e) { alert('خطا: ' + e.message); }
}

function _renderPortfolioModal(d) {
  const l = d.learner || {};
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📊 پورتفولیو — ' + _esc(l.name) + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

  h += '<div class="rd-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">';
  h += '<div class="rd-stat ok"><div class="v">' + d.cases.verified + '/' + d.cases.total + '</div><div class="l">case</div></div>';
  h += '<div class="rd-stat ' + (d.duty.totalHours > 60 ? 'warn' : 'info') + '"><div class="v">' + d.duty.totalHours + 'h</div><div class="l">شیفت هفته</div></div>';
  h += '<div class="rd-stat"><div class="v">' + d.duty.maxContinuousHours + 'h</div><div class="l">طولانی‌ترین</div></div>';
  h += '</div>';

  h += '<div class="sec-hd" style="margin:12px 0 6px"><span>🎯 EPA Progress</span></div>';
  h += '<div style="max-height:200px;overflow-y:auto">';
  (d.epas || []).forEach(e => {
    const lvl = e.currentLevel || 0;
    const color = lvl >= 4 ? 'ok' : lvl >= 3 ? 'warn' : lvl >= 1 ? 'info' : 'fg-3';
    h += '<div style="padding:4px 8px;background:var(--bg-2);border-radius:4px;margin-bottom:2px;font-size:11px;display:flex;justify-content:space-between">';
    h += '<span>' + e.icon + ' ' + _esc(e.fa) + '</span><b style="color:var(--' + color + ')">' + (lvl ? lvl + '/5' : '—') + '</b></div>';
  });
  h += '</div>';

  h += '<div class="sec-hd" style="margin:12px 0 6px"><span>📊 Milestones</span></div>';
  (d.milestones || []).forEach(m => {
    const lvl = m.currentLevel || 0;
    const color = lvl >= 4 ? 'ok' : lvl >= 3 ? 'warn' : lvl >= 1 ? 'info' : 'fg-3';
    h += '<div style="padding:6px 8px;background:var(--bg-2);border-radius:4px;margin-bottom:3px;font-size:11px">';
    h += '<div style="display:flex;justify-content:space-between"><span>' + m.icon + ' ' + _esc(m.fa) + '</span><b style="color:var(--' + color + ')">' + (lvl ? lvl + '/5' : '—') + '</b></div>';
    h += '<div style="display:flex;gap:2px;margin-top:4px">';
    for (let i = 1; i <= 5; i++) h += '<div style="flex:1;height:4px;background:' + (i <= lvl ? 'var(--' + color + ')' : 'var(--bg-3)') + ';border-radius:1px"></div>';
    h += '</div></div>';
  });

  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px;margin-bottom:20px">';
  h += '<button class="btn btn-primary" style="padding:10px;font-size:11px" onclick="this.closest(\'.bs-backdrop\').remove();NABZ.teaching._feedbackDialog(\'' + l.id + '\')">💬 بازخورد</button>';
  h += '<button class="btn" style="padding:10px;font-size:11px" onclick="this.closest(\'.bs-backdrop\').remove();NABZ.teaching._epaDialog(\'' + l.id + '\')">🎯 EPA</button>';
  h += '<button class="btn" style="padding:10px;font-size:11px" onclick="this.closest(\'.bs-backdrop\').remove();NABZ.teaching._milestoneDialog(\'' + l.id + '\')">📊 Milestone</button>';
  h += '<button class="btn" style="padding:10px;font-size:11px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
  h += '</div>';
  _sheet(h);
}

function _feedbackDialog(learnerId) {
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">💬 بازخورد (W3)</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<div class="wf-field"><label>موضوع *</label><input id="tm_fbContext" type="text" placeholder="مثلاً: راند صبح — بیمار رضایی"></div>';
  h += '<div class="wf-field"><label>✅ چه چیزی خوب بود؟ *</label><textarea id="tm_fbWell" rows="2"></textarea></div>';
  h += '<div class="wf-field"><label>📈 چه چیزی بهبود یابد؟ *</label><textarea id="tm_fbImprove" rows="2"></textarea></div>';
  h += '<div class="wf-field"><label>🎯 اقدامات بعدی</label><textarea id="tm_fbAction" rows="2"></textarea></div>';
  h += '<div class="wf-field"><label>ارزیابی کلی</label><select id="tm_fbRating"><option value="below">زیر انتظار</option><option value="meets" selected>مطابق</option><option value="above">بالاتر</option><option value="exceeds">فراتر</option></select></div>';
  h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.teaching._submitFeedback(\'' + learnerId + '\')">✅ ثبت</button>';
  _sheet(h);
}

async function _submitFeedback(learnerId) {
  const body = {
    learnerId,
    context: (document.getElementById('tm_fbContext') || {}).value || '',
    whatWentWell: (document.getElementById('tm_fbWell') || {}).value || '',
    whatToImprove: (document.getElementById('tm_fbImprove') || {}).value || '',
    actionItems: (document.getElementById('tm_fbAction') || {}).value || '',
    rating: (document.getElementById('tm_fbRating') || {}).value || 'meets'
  };
  if (!body.context) return alert('موضوع الزامی');
  if (body.whatWentWell.length < 5) return alert('What went well ≥ ۵');
  if (body.whatToImprove.length < 5) return alert('What to improve ≥ ۵');
  try {
    await _api('/api/teach/feedback', { method:'POST', body: JSON.stringify(body) });
    _close(); NABZ._toast('✅ بازخورد ثبت شد'); show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

async function _epaDialog(learnerId) {
  try {
    const d = await _api('/api/teach/epa/' + learnerId);
    let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🎯 ارزیابی EPA</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div class="wf-field"><label>EPA</label><select id="tm_epaCode">';
    (d.items || []).forEach(e => { h += '<option value="' + e.code + '">' + e.icon + ' ' + _esc(e.fa) + ' — current: ' + (e.currentLevel || '—') + '</option>'; });
    h += '</select></div>';
    h += '<div class="wf-field"><label>سطح (۱-۵)</label><select id="tm_epaLevel"><option value="1">۱ — مشاهده</option><option value="2">۲ — نظارت مستقیم</option><option value="3">۳ — غیرمستقیم (اتاق)</option><option value="4">۴ — غیرمستقیم (دسترس)</option><option value="5">۵ — مستقل</option></select></div>';
    h += '<div class="wf-field"><label>شواهد</label><textarea id="tm_epaEvidence" rows="2"></textarea></div>';
    h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.teaching._submitEPA(\'' + learnerId + '\')">✅ ثبت</button>';
    _sheet(h);
  } catch (e) { alert('خطا: ' + e.message); }
}

async function _submitEPA(learnerId) {
  const body = {
    learnerId,
    epaCode: (document.getElementById('tm_epaCode') || {}).value,
    level: Number((document.getElementById('tm_epaLevel') || {}).value),
    evidence: (document.getElementById('tm_epaEvidence') || {}).value || ''
  };
  try {
    await _api('/api/teach/epa/assess', { method:'POST', body: JSON.stringify(body) });
    _close(); NABZ._toast('✅ EPA ثبت شد'); show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

async function _milestoneDialog(learnerId) {
  try {
    const d = await _api('/api/teach/milestone/' + learnerId);
    let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📊 ارزیابی Milestone</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div class="wf-field"><label>Competency</label><select id="tm_msComp">';
    (d.items || []).forEach(m => { h += '<option value="' + m.code + '">' + m.icon + ' ' + _esc(m.fa) + ' — current: ' + (m.currentLevel || '—') + '</option>'; });
    h += '</select></div>';
    h += '<div class="wf-field"><label>سطح (۱-۵)</label><select id="tm_msLevel"><option value="1">۱</option><option value="2">۲</option><option value="3">۳</option><option value="4">۴</option><option value="5">۵</option></select></div>';
    h += '<div class="wf-field"><label>شواهد</label><textarea id="tm_msEvidence" rows="2"></textarea></div>';
    h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.teaching._submitMilestone(\'' + learnerId + '\')">✅ ثبت</button>';
    _sheet(h);
  } catch (e) { alert('خطا: ' + e.message); }
}

async function _submitMilestone(learnerId) {
  const body = {
    learnerId,
    competency: (document.getElementById('tm_msComp') || {}).value,
    level: Number((document.getElementById('tm_msLevel') || {}).value),
    evidence: (document.getElementById('tm_msEvidence') || {}).value || ''
  };
  try {
    await _api('/api/teach/milestone/assess', { method:'POST', body: JSON.stringify(body) });
    _close(); NABZ._toast('✅ Milestone ثبت شد'); show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

let _liveSubscribed = false;
function _subscribeLive() {
  if (_liveSubscribed) return;
  if (!window.Live || typeof Live.on !== 'function') return;
  ['teaching.order.created','teaching.order.approved','teaching.order.rejected','teaching.feedback.created','teaching.case.logged','teaching.epa.assessed','teaching.milestone.assessed','teaching.duty.violation'].forEach(evt => {
    Live.on(evt, () => { if (NABZ.state.current === 'teaching_mode.hub' && !document.querySelector('.bs-backdrop')) show(null, null); });
  });
  _liveSubscribed = true;
}

// ═══ Register ═══
window.NABZ = window.NABZ || {};
NABZ.teaching = {
  show, _setTab,
  _approveDialog, _submitApprove, _rejectDialog, _submitReject,
  _verifyCase, _caseDialog, _submitCase,
  _dutyCheckin, _dutyCheckout,
  _openPortfolio, _feedbackDialog, _submitFeedback,
  _epaDialog, _submitEPA, _milestoneDialog, _submitMilestone
};
let tries = 0;
(function tryReg(){
  if (window.NABZ && typeof NABZ.registerKind === 'function') {
    NABZ.registerKind('teaching_mode', function(p, d){ return show(p, d); });
    console.log('[teaching-mode-ui] loaded ✓');
    return;
  }
  if (++tries > 60) return console.warn('[teaching-mode-ui] timeout');
  setTimeout(tryReg, 100);
})();
})();
