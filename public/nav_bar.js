// public/nav_bar.js — top navigation bar with breadcrumb + back + quick-jump
// Injects once into <body>, updates via NABZ_NAV.subscribe().
(function () {
  'use strict';

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(k => {
      if (k === 'style') e.style.cssText = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else if (k.startsWith('on')) e[k] = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    if (children) [].concat(children).forEach(c => { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  function ensureStyle() {
    if (document.getElementById('nabz_nav_style')) return;
    const s = document.createElement('style');
    s.id = 'nabz_nav_style';
    s.textContent = `
      #nabz_navbar {
        position: sticky; top: 0; z-index: 9000;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        color: #fff; direction: rtl;
        padding: 8px 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,.15);
        display: flex; align-items: center; gap: 8px;
        font-family: 'Vazirmatn', Tahoma, sans-serif;
        font-size: 12px;
        min-height: 48px;
      }
      .nabz-nav-back {
        background: rgba(255,255,255,.12); color: #fff;
        border: none; border-radius: 8px;
        padding: 8px 12px; font-weight: 800; font-size: 13px;
        cursor: pointer; display: flex; align-items: center; gap: 4px;
        transition: background .15s;
      }
      .nabz-nav-back:hover:not(:disabled) { background: rgba(255,255,255,.22); }
      .nabz-nav-back:disabled { opacity: .4; cursor: default; }
      .nabz-nav-crumbs {
        flex: 1; display: flex; align-items: center; gap: 4px;
        overflow: hidden; white-space: nowrap;
        font-size: 12px;
      }
      .nabz-nav-crumb {
        background: none; border: none; color: rgba(255,255,255,.75);
        cursor: pointer; padding: 4px 6px; border-radius: 6px;
        font-size: 12px; font-weight: 700;
      }
      .nabz-nav-crumb:hover { color: #fff; background: rgba(255,255,255,.1); }
      .nabz-nav-crumb.active { color: #fff; background: rgba(255,255,255,.15); }
      .nabz-nav-crumb.tag {
        background: #dc2626; color: #fff; font-family: monospace;
        font-size: 11px; cursor: default;
      }
      .nabz-nav-sep { color: rgba(255,255,255,.3); font-size: 10px; }
      .nabz-nav-jump {
        display: flex; gap: 4px;
      }
      .nabz-nav-jump button {
        background: rgba(255,255,255,.1); color: #fff;
        border: none; border-radius: 8px;
        padding: 8px 10px; font-weight: 800; font-size: 12px;
        cursor: pointer; transition: background .15s;
      }
      .nabz-nav-jump button:hover { background: rgba(255,255,255,.22); }
      .nabz-nav-jump button.on { background: #dc2626; }
      @media (max-width: 640px) {
        #nabz_navbar { padding: 6px 8px; min-height: 44px; font-size: 11px; }
        .nabz-nav-back span.lbl { display: none; }
        .nabz-nav-jump button { padding: 6px 8px; font-size: 11px; }
        .nabz-nav-jump button span.lbl { display: none; }
      }
    `;
    document.head.appendChild(s);
  }

  function ensureContainer() {
    let bar = document.getElementById('nabz_navbar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'nabz_navbar';
    document.body.insertBefore(bar, document.body.firstChild);
    return bar;
  }

  function render(snap) {
    ensureStyle();
    const bar = ensureContainer();
    bar.innerHTML = '';

    // Back button
    const backBtn = el('button', {
      class: 'nabz-nav-back',
      title: 'بازگشت (Alt+←)',
      onclick: () => window.NABZ_NAV.back()
    }, ['←', el('span', { class: 'lbl', style: 'margin-right:4px' }, 'بازگشت')]);
    backBtn.disabled = !snap.canBack;
    bar.appendChild(backBtn);

    // Breadcrumb
    const crumbs = el('div', { class: 'nabz-nav-crumbs' });
    const bc = snap.breadcrumb || [];
    bc.forEach((c, i) => {
      if (i > 0) crumbs.appendChild(el('span', { class: 'nabz-nav-sep' }, '›'));
      if (c.tag) {
        crumbs.appendChild(el('span', { class: 'nabz-nav-crumb tag' }, c.label));
      } else {
        const isActive = i === bc.length - 1;
        const b = el('button', {
          class: 'nabz-nav-crumb' + (isActive ? ' active' : ''),
          onclick: () => { if (c.route) window.NABZ_NAV.go(c.route); }
        }, [(c.icon ? c.icon + ' ' : '') + c.label]);
        crumbs.appendChild(b);
      }
    });
    bar.appendChild(crumbs);

    // Quick jumps
    const jumps = el('div', { class: 'nabz-nav-jump' });
    const cur = snap.route || '';
    const jumpDefs = [
      { route: 'ed/cc/board', icon: '🚨', label: 'CC',    cls: cur.startsWith('ed/cc') ? 'on' : '' },
      { route: 'ed/triage',   icon: '🩺', label: 'تریاژ', cls: cur.startsWith('ed/triage') ? 'on' : '' },
      { route: 'ed/nursing',  icon: '💉', label: 'پرستاری', cls: cur.startsWith('ed/nursing') ? 'on' : '' }
    ];
    jumpDefs.forEach(j => {
      const b = el('button', {
        class: j.cls,
        title: j.label,
        onclick: () => {
          // If we have a visit context and going to nursing/triage, preserve it
          const c = window.NABZ_NAV.current();
          if (c.visitId && (j.route === 'ed/nursing' || j.route === 'ed/triage')) {
            window.NABZ_NAV.go(j.route === 'ed/nursing' ? 'ed/nursing/v' : 'ed/triage/v', { visitId: c.visitId });
          } else {
            window.NABZ_NAV.go(j.route);
          }
        }
      }, [j.icon, el('span', { class: 'lbl', style: 'margin-right:2px' }, ' ' + j.label)]);
      jumps.appendChild(b);
    });
    bar.appendChild(jumps);
  }

  // Keyboard shortcuts
  function installKeys() {
    if (window.__NAV_KEYS_INSTALLED) return;
    window.__NAV_KEYS_INSTALLED = true;
    document.addEventListener('keydown', (e) => {
      if (!e.altKey) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); window.NABZ_NAV.back(); }
      else if (e.key === '1') { e.preventDefault(); window.NABZ_NAV.go('ed/cc/board'); }
      else if (e.key === '2') { e.preventDefault(); window.NABZ_NAV.go('ed/triage'); }
      else if (e.key === '3') { e.preventDefault(); window.NABZ_NAV.go('ed/nursing'); }
      else if (e.key === '0') { e.preventDefault(); window.NABZ_NAV.go('home'); }
    });
  }

  // Boot
  function boot() {
    if (!window.NABZ_NAV) { setTimeout(boot, 50); return; }
    window.NABZ_NAV.subscribe(render);
    installKeys();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
