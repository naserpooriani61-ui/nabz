// public/fab_v3.js — Unified FAB (replaces all legacy FABs)
(function() {
  'use strict';
  if (window.__nabzFabV3) return;
  window.__nabzFabV3 = true;

  if (!document.getElementById('fab-v3-style')) {
    var st = document.createElement('style');
    st.id = 'fab-v3-style';
    st.textContent = `
      button[style*="position:fixed"][style*="left:20px"] { display: none !important; }
      #sup-float-btn { display: none !important; }
      #nabz-main-fab{position:fixed;bottom:24px;left:20px;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#1e4d8c,#0f172a);color:#fff;border:2px solid rgba(255,255,255,.3);font-size:26px;box-shadow:0 6px 20px rgba(30,77,140,.5);cursor:pointer;z-index:9998;display:flex;align-items:center;justify-content:center;transition:transform .2s}
      #nabz-main-fab:active{transform:scale(.92)}
      #nabz-fab-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:9997;opacity:0;pointer-events:none;transition:opacity .3s}
      #nabz-fab-backdrop.open{opacity:1;pointer-events:auto}
      #nabz-fab-menu{position:fixed;bottom:0;left:0;right:0;background:#fff;border-radius:20px 20px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.2);z-index:9999;padding:20px 16px 30px;transform:translateY(100%);transition:transform .3s;direction:rtl;max-height:75vh;overflow-y:auto}
      #nabz-fab-menu.open{transform:translateY(0)}
      #nabz-fab-menu h3{margin:0 0 4px;font-size:16px;color:#0f172a;font-weight:900}
      #nabz-fab-menu .fab-sub{font-size:11px;color:#64748b;margin-bottom:16px}
      .nabz-fab-item{display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;background:#f8fafc;margin-bottom:8px;cursor:pointer;border:1px solid #e2e8f0;font-size:14px;font-weight:700;color:#0f172a;transition:background .15s}
      .nabz-fab-item:active{background:#e2e8f0}
      .nabz-fab-item-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;background:#dbeafe;flex-shrink:0}
      .nabz-fab-item-title{flex:1;min-width:0}
      .nabz-fab-item-sub{font-size:11px;color:#64748b;font-weight:400;margin-top:2px}
      .nabz-fab-group{font-size:11px;color:#64748b;font-weight:800;margin:14px 4px 6px;padding-top:10px;border-top:1px solid #e2e8f0}.nabz-fab-group:first-child{border-top:none;margin-top:0;padding-top:0}.nabz-fab-close{position:absolute;top:12px;left:12px;background:#f1f5f9;border:none;padding:6px 12px;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px}
    `;
    document.head.appendChild(st);
  }

  function getRole() {
    try { return NABZ.state && NABZ.state.user && NABZ.state.user.role; } catch(_) { return null; }
  }

    function buildItems() {
    var role = getRole();
    var isSup = ['admin','hospital_director','medical_director','nursing_director','supervisor_senior','supervisor_clinical','quality_officer','head_nurse','matron'].indexOf(role) >= 0;
    var isNurse = ['nurse','head_nurse','nurse_aide','midwife','supervisor_clinical','supervisor_er'].indexOf(role) >= 0;
    var isDoc = ['physician','resident','attending','specialist','intern','anesthesiologist'].indexOf(role) >= 0;

    var groups = [];
    var nav = [];
    if (isSup) nav.push({ icon: '🏛️', title: 'داشبورد سوپروایزر', sub: 'راند، آمار، گزارش', action: function() { NABZ.show('supervisor.supervisor_dashboard'); } });
    nav.push({ icon: '🚨', title: 'مرکز فرماندهی اورژانس', sub: 'تابلو، ترایاژ، کدها', action: function() { NABZ.show('emergency_full.er_command'); } });
    if (isNurse) nav.push({ icon: '🩺', title: 'فضای کار پرستاری', sub: 'worklist بیماران', action: function() { NABZ.show('emergency.ed_nursing'); } });
    nav.push({ icon: '📊', title: 'کاردکس بیمار', sub: 'با وارد کردن شماره', action: function() { var pid = prompt('شماره بیمار (مثلاً pat_001):'); if (pid) NABZ.show('kardex', { patientId: pid }); }});
    nav.push({ icon: '🔍', title: 'جستجو', sub: 'نام بیمار، تخت', action: function() { if (NABZ.showSearch) NABZ.showSearch(); } });
    nav.push({ icon: '⚙️', title: 'همه ماژول‌ها', sub: 'دراور اصلی', action: function() { if (NABZ.showDrawer) NABZ.showDrawer(); } });
    groups.push({ label: '🧭 ناوبری', items: nav });

    var pf = [];
    if (isNurse || isDoc) {
      pf.push({ icon: '💉', title: 'ثبت علائم حیاتی', sub: 'vitals + NEWS2', action: function() { openForPatient('vitals'); } });
      pf.push({ icon: '💧', title: 'ثبت I&O', sub: 'ورودی/خروجی', action: function() { openForPatient('io'); } });
      pf.push({ icon: '📝', title: 'یادداشت پرستاری', sub: 'observation', action: function() { openForPatient('nursing-note'); } });
    }
    if (isDoc) {
      pf.push({ icon: '📋', title: 'ثبت سفارش', sub: 'دارو، آزمایش', action: function() { openForPatient('order'); } });
      pf.push({ icon: '🩺', title: 'درخواست مشاوره', sub: 'SBAR', action: function() { openForPatient('consult'); } });
      pf.push({ icon: '🔄', title: 'درخواست انتقال', sub: 'بین بخشی', action: function() { openForPatient('transfer'); } });
      pf.push({ icon: '🚪', title: 'برنامه ترخیص', sub: 'با خلاصه', action: function() { openForPatient('discharge'); } });
      pf.push({ icon: '🩸', title: 'درخواست خون', sub: 'فرآورده + واحد', action: function() { openForPatient('blood-request'); } });
    }
    if (pf.length) groups.push({ label: '📋 ثبت برای بیمار', items: pf });

    var gf = [];
    gf.push({ icon: '🚨', title: 'ویزیت اورژانس جدید', sub: 'ثبت بیمار جدید', action: function() { openFormGlobal('ed-visit'); } });
    gf.push({ icon: '🚨', title: 'فعال‌سازی کد', sub: '۲۴۷ / ۷۲۴ / ۹۹', action: function() { openFormGlobal('code'); } });
    if (isNurse || isDoc) gf.push({ icon: '📝', title: 'تحویل شیفت', sub: 'گزارش SBAR', action: function() { openFormGlobal('handover'); } });
    gf.push({ icon: '⚠️', title: 'ثبت حادثه', sub: 'رخداد بالینی', action: function() { openFormGlobal('incident'); } });
    groups.push({ label: '🌐 ثبت عمومی', items: gf });

    return groups;
  }

  function openForPatient(schemaId) {
    var pid = (window.NABZ && NABZ.state && NABZ.state.currentPatient) || null;
    if (!pid) { pid = prompt('شماره بیمار (مثلاً pat_001):'); if (!pid) return; }
    var ctx = { patientId: pid };
    try {
      if (NABZ.state && Array.isArray(NABZ.state.patients)) {
        var pt = NABZ.state.patients.find(function(x) { return x.id === pid; });
        if (pt) { ctx.patientName = ((pt.firstName || '') + ' ' + (pt.lastName || '')).trim(); ctx.wardCode = pt.wardCode; ctx.bedNumber = pt.bedNumber; }
      }
    } catch (e) {}
    if (window.NABZ && typeof NABZ.openForm === 'function') NABZ.openForm(schemaId, ctx, function() { try { if (NABZ.refresh) NABZ.refresh(); } catch (e) {} });
    else alert('UDES بارگذاری نشده');
  }

  function openFormGlobal(schemaId) {
    if (window.NABZ && typeof NABZ.openForm === 'function') NABZ.openForm(schemaId, {}, function() { try { if (NABZ.refresh) NABZ.refresh(); } catch (e) {} });
    else alert('UDES بارگذاری نشده');
  }

    function openMenu() {
    var m = document.getElementById('nabz-fab-menu');
    var b = document.getElementById('nabz-fab-backdrop');
    if (!m) return;
    var groups = buildItems();
    var h = '<button class="nabz-fab-close" onclick="document.getElementById(\'nabz-fab-menu\').classList.remove(\'open\');document.getElementById(\'nabz-fab-backdrop\').classList.remove(\'open\')">✕ بستن</button>';
    h += '<h3 style="margin-top:32px">دسترسی سریع</h3>';
    var total = 0;
    groups.forEach(function(g) { total += g.items.length; });
    h += '<div class="fab-sub">' + total + ' اکشن در دسترس</div>';
    var flat = [];
    groups.forEach(function(g) {
      h += '<div class="nabz-fab-group">' + g.label + '</div>';
      g.items.forEach(function(it) {
        var idx = flat.length;
        flat.push(it);
        h += '<div class="nabz-fab-item" data-i="' + idx + '"><div class="nabz-fab-item-icon">' + it.icon + '</div><div class="nabz-fab-item-title">' + it.title + '<div class="nabz-fab-item-sub">' + it.sub + '</div></div></div>';
      });
    });
    m.innerHTML = h;
    m.querySelectorAll('.nabz-fab-item').forEach(function(el) {
      el.onclick = function() {
        var i = Number(el.getAttribute('data-i'));
        closeMenu();
        setTimeout(function() { try { flat[i].action(); } catch(e) { alert('خطا: ' + e.message); } }, 100);
      };
    });
    m.classList.add('open');
    if (b) b.classList.add('open');
  }

  function closeMenu() {
    var m = document.getElementById('nabz-fab-menu');
    var b = document.getElementById('nabz-fab-backdrop');
    if (m) m.classList.remove('open');
    if (b) b.classList.remove('open');
  }

  function createFab() {
    if (document.getElementById('nabz-main-fab')) return;
    var fab = document.createElement('button');
    fab.id = 'nabz-main-fab';
    fab.title = 'دسترسی سریع';
    fab.innerHTML = '⚡';
    fab.onclick = openMenu;
    document.body.appendChild(fab);
    var bd = document.createElement('div');
    bd.id = 'nabz-fab-backdrop';
    bd.onclick = closeMenu;
    document.body.appendChild(bd);
    var mn = document.createElement('div');
    mn.id = 'nabz-fab-menu';
    document.body.appendChild(mn);
  }

    function killLegacy() {
    var ids = ['sup-float-btn', 'nabz-supervisor-fab'];
    ids.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.setProperty('display', 'none', 'important');
    });
    var all = document.querySelectorAll('button[style*="position:fixed"]');
    all.forEach(function(btn) {
      var st = btn.getAttribute('style') || '';
      if (st.indexOf('bottom:90px') >= 0 || st.indexOf('sup-float') >= 0) {
        btn.style.setProperty('display', 'none', 'important');
      }
    });
  }

  function boot() {
    if (!window.NABZ || typeof NABZ.show !== 'function') { setTimeout(boot, 200); return; }
    createFab();
    setInterval(killLegacy, 800);
    console.log('[fab_v3] unified FAB ready — legacy FABs hidden');
  }
  boot();
})();
