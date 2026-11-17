'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Backend augmentations (safe, additive)
// ═══════════════════════════════════════════════════════════

// ── Order.execute transition ──
try {
  const sm = require('../core/state-machine');
  if (sm && sm.M && sm.M.order && Array.isArray(sm.M.order.transitions)) {
    const hasExecute = sm.M.order.transitions.some(t => t.action === 'execute');
    if (!hasExecute) {
      sm.M.order.transitions.push({
        from: 'verified', action: 'execute', to: 'completed',
        perm: 'kardex.order.execute'
      });
      console.log('[zz_fixes] ✅ order.execute transition اضافه شد');
    }
    // Also add 'active → execute' (running orders can be executed too)
    const hasActiveExec = sm.M.order.transitions.some(t => t.from === 'active' && t.action === 'execute');
    if (!hasActiveExec) {
      sm.M.order.transitions.push({
        from: 'active', action: 'execute', to: 'completed',
        perm: 'kardex.order.execute'
      });
    }
  }
} catch (e) {
  console.error('[zz_fixes] state-machine:', e.message);
}

module.exports = { handlers: {}, routes: [], panels: [] };
