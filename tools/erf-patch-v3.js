// NABZ ER patch v3 — applies safe, idempotent fixes to modules/emergency_full.js
const fs = require('fs');
const f = process.argv[2] || 'modules/emergency_full.js';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('ERF-PATCH-V3')) { console.log('already patched'); process.exit(0); }
const must = (cond, msg) => { if (!cond) { console.log('ABORT: ' + msg); process.exit(2); } };

// 1) unique ids
const idRe = /Date\.now\(\)\.toString\(36\)\.toUpperCase\(\)/g;
const idCount = (s.match(idRe) || []).length;
must(idCount >= 4, 'id pattern not found (' + idCount + ')');
s = s.replace(idRe, 'uid()');

// 2) codeStep: guard empty body
const a2 = "if (c.status !== 'active') throw ctx.E.conflict('code_not_active');";
must(s.split(a2).length === 2, 'codeStep anchor');
s = s.replace(a2, "ctx.body = ctx.body || {};\n  " + a2);

// 3) disposition: refuse double-closing
const a3 = "const action = ctx.params.action; // admit | discharge | transfer | lwbs | deceased";
must(s.split(a3).length === 2, 'disposition anchor');
s = s.replace(a3, a3 + "\n  if (['discharged', 'transferred', 'lwbs', 'deceased', 'admitted'].includes(v.status)) throw ctx.E.conflict('visit_already_closed');");

// 4) assignZone: free the previous bed when a patient is moved
const a4 = "// پیدا کردن تخت خالی";
must(s.split(a4).length === 2, 'assignZone anchor');
s = s.replace(a4, "if (v.bedId) {\n    const old = ctx.store.get('beds', v.bedId);\n    if (old && old.visitId === v.id) { old.status = 'cleaning'; old.patientId = null; old.visitId = null; old.updatedAt = now(); ctx.store.put('beds', old); }\n    v.bedId = null;\n  }\n  " + a4);

// 5) appended block: new handlers/routes + route order
s += `

/* ERF-PATCH-V3 */
let _uidSeq = 0;
function uid() {
  _uidSeq = (_uidSeq + 1) % 46656;
  return Date.now().toString(36).toUpperCase() + _uidSeq.toString(36).toUpperCase().padStart(3, '0') + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function setBedStatus(ctx) {
  const bed = ctx.store.get('beds', ctx.params.id);
  if (!bed) throw ctx.E.notFound('bed_not_found');
  const st = (ctx.body || {}).status;
  if (!['empty', 'cleaning', 'blocked'].includes(st)) throw ctx.E.badRequest('invalid_status');
  if (st === 'empty' && bed.visitId) throw ctx.E.conflict('bed_has_patient');
  bed.status = st;
  bed.updatedAt = now();
  ctx.store.put('beds', bed);
  try { bus.emit('ed.bed.updated', { record: bed, actor: ctx.actor }); } catch (_) {}
  return bed;
}

function markSeen(ctx) {
  const v = ctx.store.get('ed_visits', ctx.params.id);
  if (!v) throw ctx.E.notFound('visit_not_found');
  if (v.seenAt) return v;
  v.seenAt = now();
  v.seenBy = ctx.actor.id;
  if (v.status === 'waiting_doctor') v.status = 'in_treatment';
  ctx.store.put('ed_visits', v);
  try { bus.emit('ed.visit.seen', { record: v, actor: ctx.actor }); } catch (_) {}
  return v;
}

function recordVitals(ctx) {
  const v = ctx.store.get('ed_visits', ctx.params.id);
  if (!v) throw ctx.E.notFound('visit_not_found');
  const b = ctx.body || {};
  const src = b.vitals || b;
  const vit = {};
  for (const k of ['rr', 'spo2', 'sbp', 'dbp', 'hr', 'temp', 'gcs']) {
    if (src[k] !== undefined && src[k] !== null && src[k] !== '') {
      const n = Number(src[k]);
      if (!Number.isFinite(n)) throw ctx.E.badRequest('invalid_' + k);
      vit[k] = n;
    }
  }
  if (src.onOxygen !== undefined) vit.onOxygen = !!src.onOxygen;
  if (!Object.keys(vit).length) throw ctx.E.badRequest('vitals_required');
  const rec = { id: 'VIT-' + uid(), visitId: v.id, patientId: v.patientId, ...vit, news2: news2(vit), recordedBy: ctx.actor.id, recordedAt: now() };
  ctx.store.put('ed_vitals', rec);
  v.lastVitalsId = rec.id;
  v.lastNews2 = rec.news2;
  ctx.store.put('ed_visits', v);
  try { bus.emit('ed.vitals.recorded', { record: rec, visit: v, actor: ctx.actor }); } catch (_) {}
  return { vitals: rec, visit: v };
}

function listVitals(ctx) {
  const items = h(ctx, 'ed_vitals').filter(x => x.visitId === ctx.params.id);
  items.sort((a, b) => sd(a.recordedAt) - sd(b.recordedAt));
  return { items, total: items.length };
}

Object.assign(module.exports.handlers, { setBedStatus, markSeen, recordVitals, listVitals });
module.exports.routes.push(
  { method: 'POST', path: '/api/erf/beds/:id/status',   handler: 'setBedStatus', perm: 'ed.triage' },
  { method: 'POST', path: '/api/erf/visit/:id/seen',     handler: 'markSeen',     perm: 'ed.triage' },
  { method: 'POST', path: '/api/erf/visit/:id/vitals',   handler: 'recordVitals', perm: 'ed.triage' },
  { method: 'GET',  path: '/api/erf/visit/:id/vitals',   handler: 'listVitals',   perm: 'ed.view' }
);
// the generic /visit/:id/:action must come last so it can never shadow the specific routes
(function () {
  const r = module.exports.routes;
  const i = r.findIndex(x => x.method === 'POST' && x.path === '/api/erf/visit/:id/:action');
  if (i > -1) { const g = r.splice(i, 1)[0]; r.push(g); }
})();
`;
fs.writeFileSync(f, s);
console.log('patched (' + idCount + ' ids made unique)');
