(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  //  NABZ — Drawer v3 (organized into 13 logical sections)
  //  Replaces the 40+ item flat list with clean grouped nav
  // ═══════════════════════════════════════════════════════════

  var HIDDEN_MODULES = [
    'zz_auth_users', 'zz_fixes', 'zz_home_charts', 'zz_extras',
    'seed', 'backend', 'stage14_bootstrap', 'stream',
    'role_dashboards', 'role_dashboards_extra', 'actions',
    'home', 'analytics', 'flow'
  ];

  var SECTIONS = [
    { id: 'clinical', label: 'بالینی', icon: '🩺',
      modules: ['alerts_hub', 'rounds_v2', 'clinical_hub', 'rounds_hub', 'clinical', 'encounters', 'cdss', 'mar_advanced',
                'order_set_intelligence', 'clinical_protocols',
                'clinical_enhancements_v3', 'antimicrobial_stewardship',
                'zz_order_sets_v2'] },
    { id: 'emergency', label: 'اورژانس', icon: '🚨',
      modules: ['emergency', 'emergency_full'] },
    { id: 'workflow', label: 'گردش کار', icon: '🔄',
      modules: ['workflow', 'care_team', 'nursing_handoff_bridge',
                'oncall_handoff_bridge', 'discharge_transition',
                'doc_excellence', 'documents', 'handoff_ai'] },
    { id: 'paraclinical', label: 'پاراکلینیک', icon: '🧪',
      modules: ['paraclinical'] },
    { id: 'surgical', label: 'جراحی و اتاق عمل', icon: '🔪',
      modules: ['surgical'] },
    { id: 'safety', label: 'ایمنی و کیفیت', icon: '⚠️',
      modules: ['safety', 'restraint', 'quality', 'quality_aggregator',
                'integrity_audit'] },
    { id: 'nursing', label: 'پرستاری و شیفت', icon: '📝',
      modules: [ 'nursing_station_v2', 'head_nurse', 'nursing_report', 'nursing_care_plan', 'shift_assistant',
                'roster', 'nurse_coverage', 'requests'] },
    { id: 'education', label: 'آموزش', icon: '🎓',
      modules: [ 'teaching_mode', 'education', 'education_studio', 'competency_framework',
                'adaptive_learning'] },
    { id: 'hr', label: 'منابع انسانی', icon: '💰',
      modules: ['advanced_hr', 'rights'] },
    { id: 'facility', label: 'تخت و تاسیسات', icon: '🛏️',
      modules: ['bedboard', 'hospital_ops'] },
    { id: 'crisis', label: 'بحران', icon: '🔥',
      modules: ['crisis'] },
    { id: 'admin', label: 'مدیریت سیستم', icon: '🔒',
      modules: ['admin', 'permission_admin', 'admin_security_config',
                'backup_manager', 'audit_api', 'sysaudit', 'ops2',
                'code_manager', 'stage15_ops', 'qr_pulse',
                'voice_notes'] }
  ];

  var ROLE_FA = {
    admin:'مدیر', nurse:'پرستار', head_nurse:'سرپرستار',
    matron:'مترون', attending:'استاد', specialist:'متخصص',
    resident:'رزیدنت', intern:'اینترن', physician:'پزشک',
    pharmacist:'داروساز', lab_tech:'تکنسین', radiology_tech:'رادیولوژی',
    receptionist:'پذیرش', supervisor:'سوپروایزر',
    supervisor_clinical:'سوپروایزر بالینی', supervisor_senior:'سوپروایزر ارشد',
    nursing_director:'مدیر پرستاری', medical_director:'مدیر پزشکی',
    hospital_director:'رئیس بیمارستان'
  };

  function ready(fn) {
    if (window.NABZ && NABZ.state && typeof NABZ.showDrawer === 'function') return fn();
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    function buildDrawer() {
      var drawer = document.getElementById('drawer');
      if (!drawer) return;
      var panel = drawer.querySelector('.drawer-panel');
      if (!panel) return;

      var user = NABZ.state.user;
      var panels = NABZ.state.panels || [];

      var byModule = {};
      panels.forEach(function(p) {
        var m = p.module || (p.id ? p.id.split('.')[0] : '');
        if (!m || HIDDEN_MODULES.indexOf(m) >= 0) return;
        if (!byModule[m]) byModule[m] = [];
        byModule[m].push(p);
      });

      var html = '';

      html += '<div class="zz-drawer-hd">';
      html += '<div class="zz-drawer-logo">🫀 <strong>نبض</strong></div>';
      html += '<button class="zz-drawer-close" onclick="NABZ.hideDrawer()" aria-label="بستن">✕</button>';
      html += '</div>';

      if (user) {
        var roleFa = ROLE_FA[user.role] || user.role;
        html += '<div class="zz-drawer-user">';
        html += '<div style="font-size:13px;font-weight:900">' + NABZ._esc(user.fullName || user.username) + '</div>';
        html += '<div style="font-size:10px;color:var(--fg-2)">' + NABZ._esc(roleFa) + (user.ward ? ' · ' + NABZ._esc(user.ward) : '') + '</div>';
        html += '</div>';
      }

      html += '<div class="zz-drawer-search-wrap">';
      html += '<input id="zzDrawerSearch" type="search" placeholder="🔍 جستجوی پنل..." autocomplete="off">';
      html += '</div>';

      var favs = [];
      try { favs = JSON.parse(localStorage.getItem('zz_drawer_favs') || '[]'); } catch (_) {}
      if (favs.length) {
        html += '<div class="zz-drawer-favs">';
        html += '<div class="zz-drawer-fav-hd">⭐ دسترسی سریع</div>';
        favs.slice(0, 5).forEach(function(fav) {
          var p = panels.find(function(x) { return x.id === fav; });
          if (!p) return;
          html += '<button class="zz-fav-item" onclick="NABZ.show(\'' + p.id + '\');NABZ.hideDrawer()">';
          html += '<span class="zz-fav-ico">' + (p.icon || '📄') + '</span>';
          html += '<span class="zz-fav-lbl">' + NABZ._esc(p.title) + '</span>';
          html += '</button>';
        });
        html += '</div>';
      }

      var totalSections = 0;
      html += '<div class="zz-drawer-sections" id="zzDrawerSections">';
      SECTIONS.forEach(function(section) {
        var sectionPanels = [];
        section.modules.forEach(function(m) {
          if (byModule[m]) sectionPanels = sectionPanels.concat(byModule[m]);
        });
        if (!sectionPanels.length) return;
        totalSections++;

        html += '<div class="zz-drawer-sec" data-section="' + section.id + '">';
        html += '<button class="zz-drawer-sec-hd" onclick="zzToggleSectionV3(\'' + section.id + '\')">';
        html += '<span class="zz-sec-ico">' + section.icon + '</span>';
        html += '<span class="zz-sec-lbl">' + section.label + '</span>';
        html += '<span class="zz-sec-count">' + sectionPanels.length + '</span>';
        html += '<span class="zz-sec-arrow">▸</span>';
        html += '</button>';
        html += '<div class="zz-sec-items" style="display:none">';
        sectionPanels.forEach(function(p) {
          html += '<div class="zz-item" onclick="NABZ.show(\'' + p.id + '\');NABZ.hideDrawer()">';
          html += '<span class="zz-item-ico">' + (p.icon || '📄') + '</span>';
          html += '<span class="zz-item-lbl">' + NABZ._esc(p.title) + '</span>';
          html += '</div>';
        });
        html += '</div></div>';
      });
      html += '</div>';

      html += '<div class="zz-drawer-footer">';
      html += '<button class="zz-footer-btn" onclick="NABZ.showNeural();NABZ.hideDrawer()"><span>🧠</span>موتور عصبی</button>';
      html += '<button class="zz-footer-btn dng" onclick="NABZ.logout()"><span>⏻</span>خروج</button>';
      html += '</div>';

      panel.innerHTML = html;

      var inp = document.getElementById('zzDrawerSearch');
      if (inp) {
        inp.addEventListener('input', function() { searchDrawerV3(this.value); });
      }

      console.log('[drawer-v3] ' + totalSections + ' sections, ' + Object.keys(byModule).length + ' modules, ' + panels.length + ' panels');
    }

    function searchDrawerV3(q) {
      q = String(q || '').toLowerCase().trim();
      var sections = document.querySelectorAll('.zz-drawer-sec');
      sections.forEach(function(sec) {
        var items = sec.querySelectorAll('.zz-item');
        var visible = 0;
        items.forEach(function(item) {
          var text = item.textContent.toLowerCase();
          if (!q || text.indexOf(q) >= 0) {
            item.style.display = '';
            visible++;
          } else {
            item.style.display = 'none';
          }
        });
        if (q && visible === 0) {
          sec.style.display = 'none';
        } else {
          sec.style.display = '';
          var itemsDiv = sec.querySelector('.zz-sec-items');
          if (itemsDiv && q) {
            itemsDiv.style.display = 'block';
            var arrow = sec.querySelector('.zz-sec-arrow');
            if (arrow) arrow.textContent = '▼';
          }
        }
      });
    }

    window.zzToggleSectionV3 = function(sectionId) {
      var sec = document.querySelector('.zz-drawer-sec[data-section="' + sectionId + '"]');
      if (!sec) return;
      var items = sec.querySelector('.zz-sec-items');
      var arrow = sec.querySelector('.zz-sec-arrow');
      if (!items) return;
      var isOpen = items.style.display !== 'none';
      items.style.display = isOpen ? 'none' : 'block';
      if (arrow) arrow.textContent = isOpen ? '▸' : '▼';
    };

    var origShow = NABZ.showDrawer;
    NABZ.showDrawer = function() {
      if (origShow) origShow.call(NABZ);
      buildDrawer();
    };

    if (NABZ.boot) {
      var origBoot = NABZ.boot;
      NABZ.boot = async function() {
        var r = await origBoot.call(NABZ);
        setTimeout(buildDrawer, 400);
        return r;
      };
    }

    console.log('[drawer-v3] loaded');
  });
})();
