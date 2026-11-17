'use strict';
/**
 * NABZ — Clinical Edit Module
 * Adds PATCH/PUT endpoints for vitals & orders (kardex) so the pretty UI can save edits.
 * Tries multiple possible collection names to find where the seed data lives.
 */

const VITALS_COLLS = ['vitals', 'patient_vitals', 'clinical_vitals', 'ed_vitals', 'vital_signs'];
const ORDERS_COLLS = ['orders', 'clinical_orders', 'patient_orders', 'ed_orders', 'kardex', 'medication_orders', 'kardex_orders'];

// ─── NEWS2 (inline, no dependency) ───
function news2(v) {
  if (!v) return 0;
  let s = 0, n = 0;
  if (v.rr != null)   { n++; s += v.rr <= 8 ? 3 : v.rr <= 11 ? 1 : v.rr <= 20 ? 0 : v.rr <= 24 ? 2 : 3; }
  if (v.spo2 != null) { n++; s += v.spo2 <= 91 ? 3 : v.spo2 <= 93 ? 2 : v.spo2 <= 95 ? 1 : 0; }
  if (v.onOxygen)     { n++; s += 2; }
  if (v.sbp != null)  { n++; s += v.sbp <= 90 ? 3 : v.sbp <= 100 ? 2 : v.sbp <= 110 ? 1 : v.sbp <= 219 ? 0 : 3; }
  if (v.hr != null)   { n++; s += v.hr <= 40 ? 3 : v.hr <= 50 ? 1 : v.hr <= 90 ? 0 : v.hr <= 110 ? 1 : v.hr <= 130 ? 2 : 3; }
  if (v.temp != null) { n++; s += v.temp <= 35 ? 3 : v.temp <= 36 ? 1 : v.temp <= 38 ? 0 : v.temp <= 39 ? 1 : 2; }
  if (v.gcs != null)  { n++; s += v.gcs < 15 ? 3 : 0; }
  return n === 0 ? null : s;
}
function newsLevel(score) {
  if (score == null) return 'low';
  if (score >= 7) return 'critical';
  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

function findRecord(ctx, colls, id) {
  for (const coll of colls) {
    try {
      const rec = ctx.store.get(coll, id);
      if (rec) return { coll, rec };
    } catch (_) {}
  }
  return null;
}

function applyPatch(ctx, colls, isVitals) {
  const id = ctx.params.id;
  const updates = ctx.body || {};
  const found = findRecord(ctx, colls, id);
  if (!found) {
    throw ctx.E.notFound('record_not_found: ' + id);
  }
  const { coll, rec } = found;

  // Whitelist — only safe fields
  const vitalsFields = ['hr','sbp','dbp','rr','temp','spo2','gcs','pain','onOxygen','consciousness'];
  const orderFields  = ['item','dose','route','frequency','priority','status','note','category'];
  const fields = isVitals ? vitalsFields : orderFields;

  for (const k of fields) {
    if (updates[k] !== undefined && updates[k] !== null && updates[k] !== '') {
      rec[k] = updates[k];
    }
  }

  // Recompute NEWS2 for vitals
  if (isVitals) {
    const n2 = news2(rec);
    if (n2 != null) {
      rec.news2 = n2;
      rec.newsLevel = newsLevel(n2);
    }
  }

  // Status transition timestamps for orders
  if (!isVitals && updates.status) {
    const now = new Date().toISOString();
    if (updates.status === 'verified' && !rec.verifiedAt) { rec.verifiedAt = now; rec.verifiedBy = ctx.actor.id; }
    if (updates.status === 'completed' && !rec.completedAt) { rec.completedAt = now; rec.completedBy = ctx.actor.id; }
    if (updates.status === 'cancelled' && !rec.cancelledAt) { rec.cancelledAt = now; rec.cancelledBy = ctx.actor.id; }
  }

  rec.updatedAt = new Date().toISOString();
  rec.updatedBy = ctx.actor.id;

  ctx.store.put(coll, rec);
  return { ok: true, record: rec, collection: coll };
}

module.exports = {
  handlers: {
    patchVitals(ctx) { return applyPatch(ctx, VITALS_COLLS, true); },
    patchOrder(ctx)  { return applyPatch(ctx, ORDERS_COLLS, false); },

    // Diagnostic — shows which collection actually holds the data
    probe(ctx) {
      const id = ctx.query.id || '';
      const report = { vitals: {}, orders: {} };
      for (const coll of VITALS_COLLS) {
        try { const r = ctx.store.get(coll, id); report.vitals[coll] = r ? 'FOUND' : 'not_found'; }
        catch (e) { report.vitals[coll] = 'error: ' + e.message; }
      }
      for (const coll of ORDERS_COLLS) {
        try { const r = ctx.store.get(coll, id); report.orders[coll] = r ? 'FOUND' : 'not_found'; }
        catch (e) { report.orders[coll] = 'error: ' + e.message; }
      }
      return report;
    }
  },
  routes: [
    { method: 'PATCH', path: '/api/clinical/vitals/:id', handler: 'patchVitals', perm: 'vitals.view' },
    { method: 'PUT',   path: '/api/clinical/vitals/:id', handler: 'patchVitals', perm: 'vitals.view' },
    { method: 'PATCH', path: '/api/clinical/orders/:id', handler: 'patchOrder',  perm: 'kardex.view' },
    { method: 'PUT',   path: '/api/clinical/orders/:id', handler: 'patchOrder',  perm: 'kardex.view' },
    { method: 'GET',   path: '/api/clinical/_probe',     handler: 'probe',       perm: null }
  ],
  panels: []
};
