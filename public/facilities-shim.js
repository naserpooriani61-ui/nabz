(function() {
  'use strict';
  function ready(fn) {
    if (window.NABZ && typeof NABZ.registerKind === 'function') return fn();
    setTimeout(function() { ready(fn); }, 100);
  }
  ready(function() {
    function redirect(p, d) {
      var fac = (NABZ.state.panels || []).find(function(x) { return x.kind === 'facilities'; });
      if (fac) {
        try { NABZ.show(fac.id); return; } catch(e) {}
      }
      document.getElementById('content').innerHTML =
        '<div class="sec-hd"><span>' + (p.icon || '') + ' ' + (p.title || '') + '</span></div>' +
        '<div class="card" style="text-align:center;padding:30px">' +
        '<div style="font-size:40px">🔄</div>' +
        '<div style="font-weight:900;margin-top:8px">این پنل با «تخت و تاسیسات» جایگزین شده</div>' +
        '<div style="font-size:11.5px;color:var(--fg-2);margin-top:6px">از منو → 🛏️ تخت و تاسیسات استفاده کنید</div>' +
        '</div>';
    }
    NABZ.registerKind('hops_wards', redirect);
    NABZ.registerKind('hops_assignment', redirect);
    console.log('[fac-shim] hops_wards + hops_assignment redirected');
  });
})();
