const sig = require('./signature'), perms = require('./permissions');
function h(ctx, c) { try { const r = ctx.store.readAll(c); return Array.isArray(r) ? r : []; } catch(_) { return []; } }
function sd(x) { if (!x) return 0; const d = new Date(x); return isNaN(d.getTime()) ? 0 : d.getTime(); }
function num(x) { if (x == null || x === '') return null; const n = Number(x); return isNaN(n) ? null : n; }
function sg(ctx, c, r, a) {
  const s = sig.signAction({ userId: ctx.actor.id, action: a, collection: c, recordId: r.id, data: r });
  ctx.store.put('signatures', s); r.lastSignatureId = s.id; return s;
}
function list(coll, sortField) {
  return (ctx) => {
    let i = perms.scope(ctx.actor, h(ctx, coll));
    if (ctx.query.status) i = i.filter(x => x.status === ctx.query.status);
    const f = sortField || 'createdAt';
    i.sort((a, b) => sd(b[f] || b.requestedAt || b.activatedAt) - sd(a[f] || a.requestedAt || a.activatedAt));
    return { items: i, total: i.length };
  };
}
module.exports = { h, sd, num, sg, list };
