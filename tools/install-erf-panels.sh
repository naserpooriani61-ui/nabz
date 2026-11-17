#!/usr/bin/env bash
set -u
[ -f public/index.html ] || { echo "run from NABZ root (public/index.html missing)"; exit 1; }
mkdir -p backups public
[ -f public/zz_erf_panels.js ] && cp public/zz_erf_panels.js "backups/zz_erf_panels.js.$(date +%s)"
cat > public/zz_erf_panels.js <<'EOF'
// NABZ — ER panels (beds / codes / orders / stats) — renderers for emergency_full.js panels
(function () {
  'use strict';
  var P = { _cur: null };
  var BED_FA = { empty: 'خالی', occupied: 'اشغال', cleaning: 'نظافت', blocked: 'مسدود' };
  var BED_COL = { empty: '#10b981', occupied: '#ef4444', cleaning: '#f59e0b', blocked: '#6b7280' };
  var PRI_FA = { stat: 'فوری', urgent: 'اورژانسی', routine: 'عادی' };
  var ORD_FA = { pending: 'در انتظار', acknowledged: 'دیده شد', in_progress: 'در حال انجام', done: 'انجام شد', cancelled: 'لغو' };
  var CAT_FA = { med: 'دارو', lab: 'آزمایش', imaging: 'تصویربرداری', consult: 'مشاوره', nursing: 'پرستاری', procedure: 'پروسیجر' };

  function api(p, o) { return NABZ._api(p, o); }
  function esc(s) { return NABZ._esc(s == null ? '' : String(s)); }
  function box() { return document.getElementById('content'); }
  function toast(m) { try { NABZ._toast(m); } catch (_) {} }
  function post(p, b) { return api(p, { method: 'POST', body: JSON.stringify(b || {}) }); }
  function loading() { box().innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>'; }
  function fail(e) { box().innerHTML = '<div class="empty">خطا: ' + esc(e && e.message ? e.message : e) + '</div>'; }
  function num(n) { return n == null ? '—' : String(n); }
  function mins(iso) { var t = Date.parse(iso); return isNaN(t) ? 0 : Math.max(0, Math.round((Date.now() - t) / 60000)); }
  function hd(t) { return '<div class="sec-hd"><span>' + t + '</span><span class="rd-mini">' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) + '</span></div>'; }
  function act(promise, okMsg) {
    return promise.then(function () { if (okMsg) toast(okMsg); return P.reload(); })
      .catch(function (e) { alert('خطا: ' + (e && e.message ? e.message : e)); });
  }
  P.reload = function () { var k = P._cur; return k && P[k] ? P[k]() : null; };

  // ─── Beds ───
  P.beds = async function (p, d) {
    P._cur = 'beds';
    if (!d || !d.items) { loading(); try { d = await api('/api/erf/beds'); } catch (e) { return fail(e); } }
    var zones = d.zones || [], by = {};
    (d.items || []).forEach(function (b) { (by[b.zone] = by[b.zone] || []).push(b); });
    var h = hd('🛏️ نقشه تخت‌های اورژانس');
    zones.forEach(function (z) {
      var list = by[z.code] || [];
      var occ = list.filter(function (b) { return b.status === 'occupied'; }).length;
      h += '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<b>' + esc(z.icon) + ' ' + esc(z.label) + '</b><span class="badge">' + occ + ' / ' + list.length + '</span></div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">';
      list.forEach(function (b) {
        var n = String(b.code || b.id).split('-').pop();
        var canFree = b.status === 'cleaning' || b.status === 'blocked';
        h += '<button class="btn" style="min-width:44px;padding:8px 6px;border:2px solid ' + (BED_COL[b.status] || '#999') + ';font-size:12px"' +
          ' title="' + esc(BED_FA[b.status] || b.status) + '"' +
          (canFree ? ' onclick="NABZ.erfPanels.bed(\'' + esc(b.id) + '\',\'empty\')"' : ' disabled') + '>' + esc(n) + (canFree ? ' ✓' : '') + '</button>';
      });
      h += '</div></div>';
    });
    h += '<div class="card" style="font-size:12px">' + Object.keys(BED_FA).map(function (k) { return '<span style="color:' + BED_COL[k] + '">●</span> ' + BED_FA[k]; }).join(' &nbsp; ') + ' &nbsp;|&nbsp; برای آزادکردن تخت «نظافت» روی آن بزنید</div>';
    box().innerHTML = h;
  };
  P.bed = function (id, status) { return act(post('/api/erf/beds/' + encodeURIComponent(id) + '/status', { status: status }), 'تخت آماده شد'); };

  // ─── Codes ───
  P.codes = async function (p, d) {
    P._cur = 'codes';
    if (!d || !d.items) { loading(); try { d = await api('/api/erf/codes'); } catch (e) { return fail(e); } }
    var meta = d.meta || {}, items = d.items || [];
    var active = items.filter(function (c) { return c.status === 'active'; });
    var done = items.filter(function (c) { return c.status !== 'active'; }).slice(0, 8);
    var h = hd('🔴 کدهای اورژانس');
    h += '<div class="card"><div style="display:flex;flex-wrap:wrap;gap:6px">';
    Object.keys(meta).forEach(function (k) {
      h += '<button class="btn" onclick="NABZ.erfPanels.activate(\'' + esc(k) + '\')">' + esc(meta[k].label) + '</button>';
    });
    h += '</div></div>';
    if (!active.length) h += '<div class="empty">کد فعالی وجود ندارد</div>';
    active.forEach(function (c) {
      var el = mins(c.activatedAt);
      h += '<div class="card" style="border-right:4px solid #ef4444"><div style="display:flex;justify-content:space-between"><b>' + esc(c.label) + '</b><span class="badge">' + el + ' دقیقه</span></div>';
      if (c.patientName) h += '<div style="font-size:12px;opacity:.8">' + esc(c.patientName) + '</div>';
      (c.steps || []).forEach(function (s) {
        var isDone = s.status === 'done' || s.status === 'skipped';
        var late = !isDone && s.targetMin > 0 && el > s.targetMin;
        h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-top:1px solid rgba(128,128,128,.2)">' +
          '<span>' + (isDone ? '✅' : late ? '⏰' : '⬜') + ' ' + esc(s.name) + ' <small style="opacity:.7">(هدف ' + num(s.targetMin) + ' د)</small></span>' +
          (isDone ? '' : '<button class="btn" onclick="NABZ.erfPanels.step(\'' + esc(c.id) + '\',\'' + esc(s.id) + '\')">انجام شد</button>') + '</div>';
      });
      h += '<div style="margin-top:8px"><button class="btn" onclick="NABZ.erfPanels.resolve(\'' + esc(c.id) + '\')">بستن کد</button></div></div>';
    });
    if (done.length) {
      h += '<div class="card"><b>اخیر</b>';
      done.forEach(function (c) { h += '<div style="font-size:12px;padding:4px 0">' + esc(c.label) + ' — ' + esc(c.status === 'resolved' ? 'بسته شد' : c.status) + '</div>'; });
      h += '</div>';
    }
    box().innerHTML = h;
  };
  P.activate = function (type) {
    if (!confirm('کد فعال شود؟')) return;
    return act(post('/api/erf/codes', { type: type }), 'کد فعال شد');
  };
  P.step = function (id, step) { return act(post('/api/erf/codes/' + encodeURIComponent(id) + '/step', { step: step }), 'ثبت شد'); };
  P.resolve = function (id) { if (!confirm('کد بسته شود؟')) return; return act(post('/api/erf/codes/' + encodeURIComponent(id) + '/resolve', {}), 'کد بسته شد'); };

  // ─── Orders ───
  P._ordFilter = 'open';
  P.orders = async function (p, d) {
    P._cur = 'orders';
    if (!d || !d.items) { loading(); try { d = await api('/api/erf/orders'); } catch (e) { return fail(e); } }
    P._tpl = d.templates || {};
    var open = { pending: 1, acknowledged: 1, in_progress: 1 };
    var items = (d.items || []).filter(function (o) { return P._ordFilter === 'all' || open[o.status]; }).slice(0, 60);
    var h = hd('📋 کاردکس اورژانس');
    h += '<div class="card" style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<button class="btn" onclick="NABZ.erfPanels.filter(\'open\')">باز</button>' +
      '<button class="btn" onclick="NABZ.erfPanels.filter(\'all\')">همه</button>' +
      '<button class="btn" onclick="NABZ.erfPanels.newOrder()">➕ دستور جدید</button></div>';
    if (!items.length) h += '<div class="empty">دستوری وجود ندارد</div>';
    items.forEach(function (o) {
      var bits = [o.dose, o.route, o.frequency].filter(Boolean).map(esc).join(' · ');
      h += '<div class="card"><div style="display:flex;justify-content:space-between"><b>' + esc(o.item) + '</b>' +
        '<span class="badge">' + esc(ORD_FA[o.status] || o.status) + '</span></div>' +
        '<div style="font-size:12px;opacity:.8">' + esc(CAT_FA[o.category] || o.category) + ' · ' + esc(PRI_FA[o.priority] || o.priority) + (bits ? ' · ' + bits : '') + '</div>';
      var btns = [];
      if (o.status === 'pending') btns.push(['acknowledge', 'دیدم']);
      if (o.status === 'pending' || o.status === 'acknowledged') btns.push(['start', 'شروع']);
      if (o.status !== 'done' && o.status !== 'cancelled') { btns.push(['complete', 'انجام شد']); btns.push(['cancel', 'لغو']); }
      if (btns.length) h += '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">' + btns.map(function (b) {
        return '<button class="btn" onclick="NABZ.erfPanels.order(\'' + esc(o.id) + '\',\'' + b[0] + '\')">' + b[1] + '</button>'; }).join('') + '</div>';
      h += '</div>';
    });
    box().innerHTML = h;
  };
  P.filter = function (f) { P._ordFilter = f; return P.orders(); };
  P.order = function (id, action) { return act(post('/api/erf/orders/' + encodeURIComponent(id), { action: action }), 'ثبت شد'); };
  P.newOrder = async function () {
    var visits;
    try { visits = (await api('/api/erf/visits')).items || []; } catch (e) { return alert('خطا: ' + e.message); }
    visits = visits.filter(function (v) { return ['discharged', 'transferred', 'lwbs', 'deceased', 'admitted'].indexOf(v.status) < 0; });
    if (!visits.length) return alert('بیمار فعالی وجود ندارد');
    var h = hd('➕ دستور جدید') + '<div class="card">' +
      '<select id="erfo_v" class="inp">' + visits.map(function (v) { return '<option value="' + esc(v.id) + '">' + esc(v.patientName || v.id) + '</option>'; }).join('') + '</select>' +
      '<select id="erfo_c" class="inp" onchange="NABZ.erfPanels.catChange()">' + Object.keys(CAT_FA).map(function (k) { return '<option value="' + k + '">' + CAT_FA[k] + '</option>'; }).join('') + '</select>' +
      '<select id="erfo_t" class="inp"></select>' +
      '<select id="erfo_p" class="inp"><option value="routine">عادی</option><option value="urgent">اورژانسی</option><option value="stat">فوری</option></select>' +
      '<div style="display:flex;gap:6px;margin-top:8px"><button class="btn" onclick="NABZ.erfPanels.saveOrder()">ثبت</button><button class="btn" onclick="NABZ.erfPanels.orders()">انصراف</button></div></div>';
    box().innerHTML = h; P.catChange();
  };
  P.catChange = function () {
    var c = document.getElementById('erfo_c').value, t = document.getElementById('erfo_t');
    t.innerHTML = ((P._tpl || {})[c] || []).map(function (x) { return '<option value="' + esc(x.item) + '">' + esc(x.item) + '</option>'; }).join('');
  };
  P.saveOrder = function () {
    var g = function (id) { return document.getElementById(id).value; };
    if (!g('erfo_t')) return alert('مورد را انتخاب کنید');
    return post('/api/erf/orders', { visitId: g('erfo_v'), category: g('erfo_c'), template: g('erfo_t'), priority: g('erfo_p') })
      .then(function () { toast('دستور ثبت شد'); return P.orders(); })
      .catch(function (e) { alert('خطا: ' + (e && e.message ? e.message : e)); });
  };

  // ─── Stats ───
  P._days = 1;
  P.stats = async function (p, d) {
    P._cur = 'stats';
    if (!d || d.totalVisits === undefined || d.periodDays !== P._days) { loading(); try { d = await api('/api/erf/stats?days=' + P._days); } catch (e) { return fail(e); } }
    function kpi(l, v, u) { return '<div class="card" style="text-align:center;flex:1;min-width:120px"><div style="font-size:22px;font-weight:700">' + num(v) + '</div><div style="font-size:11px;opacity:.8">' + l + (u ? ' (' + u + ')' : '') + '</div></div>'; }
    var h = hd('📊 آمار و عملکرد اورژانس');
    h += '<div class="card" style="display:flex;gap:6px">' + [[1, 'امروز'], [7, '۷ روز'], [30, '۳۰ روز']].map(function (x) {
      return '<button class="btn" onclick="NABZ.erfPanels.days(' + x[0] + ')">' + x[1] + '</button>'; }).join('') + '</div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:8px">' + kpi('مراجعه', d.totalVisits) + kpi('تا تریاژ', d.doorToTriage && d.doorToTriage.median, 'دقیقه') +
      kpi('تا پزشک', d.doorToDoctor && d.doorToDoctor.median, 'دقیقه') + kpi('ماندگاری', d.lengthOfStay && d.lengthOfStay.median, 'دقیقه') + kpi('دستورات', d.ordersTotal) + '</div>';
    var esi = d.byEsi || {}, mx = Math.max.apply(null, [1].concat([1, 2, 3, 4, 5].map(function (k) { return esi[k] || 0; })));
    h += '<div class="card"><b>توزیع ESI</b>' + [1, 2, 3, 4, 5].map(function (k) {
      return '<div style="display:flex;align-items:center;gap:8px;margin-top:6px"><span style="width:44px">ESI ' + k + '</span><div style="flex:1;background:rgba(128,128,128,.2);border-radius:4px;height:10px"><div style="width:' + Math.round((esi[k] || 0) / mx * 100) + '%;height:10px;border-radius:4px;background:#3b82f6"></div></div><span>' + (esi[k] || 0) + '</span></div>'; }).join('') + '</div>';
    var disp = d.byDisposition || {}, keys = Object.keys(disp);
    h += '<div class="card"><b>نتیجه مراجعه</b>' + (keys.length ? keys.map(function (k) { return '<div style="font-size:13px;margin-top:4px">' + esc(k) + ': ' + disp[k] + '</div>'; }).join('') : '<div class="empty">—</div>') + '</div>';
    box().innerHTML = h;
  };
  P.days = function (n) { P._days = n; return P.stats(); };

  // ─── Registration ───
  var tries = 0;
  (function ready() {
    if (window.NABZ && typeof NABZ.registerKind === 'function') {
      NABZ.erfPanels = P;
      NABZ.registerKind('erf_beds', function (p, d) { return P.beds(p, d); });
      NABZ.registerKind('erf_codes', function (p, d) { return P.codes(p, d); });
      NABZ.registerKind('erf_orders', function (p, d) { return P.orders(p, d); });
      NABZ.registerKind('erf_stats', function (p, d) { return P.stats(p, d); });
      console.log('[erf-panels] registered: beds, codes, orders, stats');
      return;
    }
    if (++tries >= 100) return console.warn('[erf-panels] NABZ.registerKind not found');
    setTimeout(ready, 100);
  })();
})();
EOF
node --check public/zz_erf_panels.js || { echo "SYNTAX ERROR in zz_erf_panels.js"; exit 3; }
echo "zz_erf_panels.js written, syntax OK"
if grep -q 'zz_erf_panels.js' public/index.html; then
  echo "index.html already loads zz_erf_panels.js"
else
  B="backups/index.html.pre-erfpanels.$(date +%s)"; cp public/index.html "$B" && echo "backup: $B"
  node -e "
const fs=require('fs');let s=fs.readFileSync('public/index.html','utf8');
const re=/(<script src=\"\/erf_ui\.js[^\"]*\"><\/script>)/;
if(!re.test(s)){console.log('ANCHOR erf_ui.js script tag NOT FOUND - index.html unchanged');process.exit(2)}
s=s.replace(re,'\$1\n<script src=\"/zz_erf_panels.js?v=erfp1\"></script>');
fs.writeFileSync('public/index.html',s);console.log('index.html updated');"
fi
echo "done — hard-refresh the app (clear cache) and open the ER panels"
