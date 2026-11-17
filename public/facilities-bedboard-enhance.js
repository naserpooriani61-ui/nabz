(function() {
  'use strict';

  var N = null;
  function tryNABZ() {
    try {
      if (typeof NABZ !== 'undefined' && NABZ && typeof NABZ.show === 'function') { N = NABZ; return true; }
    } catch(_) {}
    if (window.NABZ && typeof window.NABZ.show === 'function') { N = window.NABZ; return true; }
    return false;
  }

  function injectButtons() {
    if (!N || !N.fac) return 0;
    var rows = document.querySelectorAll('#content .row[onclick]');
    var injected = 0;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var oc = row.getAttribute('onclick') || '';
      if (oc.indexOf('openWard') < 0) continue;
      if (row.querySelector('.ward-edit-btn')) continue;
      var m = oc.match(/openWard\(['"]([^'"]+)['"]\)/);
      if (!m) continue;
      var code = m[1];
      row.style.position = 'relative';
      var btn = document.createElement('button');
      btn.className = 'ward-edit-btn';
      btn.innerHTML = '\u270E';
      btn.title = 'ویرایش بخش';
      btn.style.cssText = 'position:absolute;top:8px;left:8px;background:var(--bg-3);border:1px solid var(--border-2);border-radius:6px;color:var(--primary);width:28px;height:28px;font-size:14px;cursor:pointer;z-index:10;font-family:inherit;display:flex;align-items:center;justify-content:center;padding:0';
      (function(c) {
        btn.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (N.fac && typeof N.fac._editWard === 'function') N.fac._editWard(c);
          else alert('facilities-ui.js بارگذاری نشده');
        };
      })(code);
      row.appendChild(btn);
      injected++;
    }
    if (injected > 0) console.log('[fac-bedboard] injected ' + injected + ' edit buttons');
    return injected;
  }

  function install() {
    if (!tryNABZ()) { setTimeout(install, 200); return; }
    console.log('[fac-bedboard] NABZ found, installing observer');

    var content = document.getElementById('content');
    if (content) {
      new MutationObserver(function() {
        if (document.querySelector('#content .row[onclick*="openWard"]')) {
          setTimeout(injectButtons, 80);
          setTimeout(injectButtons, 300);
          setTimeout(injectButtons, 800);
        }
      }).observe(content, { childList: true, subtree: false });
      console.log('[fac-bedboard] MutationObserver on #content installed');
    }

    setInterval(function() {
      if (document.querySelector('#content .row[onclick*="openWard"]')) {
        injectButtons();
      }
    }, 1500);

    if (N.show && !N.show._facWrapped) {
      var origShow = N.show;
      N.show = async function(id) {
        var res = await origShow.call(N, id);
        setTimeout(injectButtons, 100);
        setTimeout(injectButtons, 400);
        setTimeout(injectButtons, 1000);
        return res;
      };
      N.show._facWrapped = true;
      console.log('[fac-bedboard] NABZ.show wrapped');
    }

    window.__facInjectNow = function() {
      var n = injectButtons();
      console.log('[fac-bedboard] manual inject:', n, 'buttons');
      return n;
    };

    console.log('[fac-bedboard] ready. Manual test: __facInjectNow()');
  }

  install();
})();
