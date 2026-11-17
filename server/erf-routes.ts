// server/erf-routes.ts
// ─── Mount همه‌ی مسیرهای NABZ-compatible که فرانت‌اند انتظار دارد ───
import { createERFBridge, type ERFBridgeDeps } from './erf-bridge';

const wrap = (fn: (req: any, res: any) => any) => (req: any, res: any) => {
  try {
    const out = fn(req, res);
    if (out !== undefined && !res.headersSent) res.json(out);
  } catch (e: any) {
    const status = e?.status ?? 400;
    res.status(status).json({ error: e?.message ?? 'server_error' });
  }
};

export function mountERFRoutes(app: any, deps: ERFBridgeDeps, opts: {
  actorFromReq?: (req: any) => any;
} = {}) {
  const bridge = createERFBridge(deps);
  const actor = opts.actorFromReq ?? ((req: any) => req.user ?? { id: 'system', username: 'system', name: 'سیستم' });

  // ─── GET (NABZ contract) ───
  app.get('/api/overview',    wrap((req) => bridge.overview()));
  app.get('/api/beds',        wrap((req) => bridge.listBeds(req.query)));
  app.get('/api/patients',    wrap((req) => bridge.listPatients(req.query)));
  app.get('/api/orders',      wrap((req) => bridge.listOrders(req.query)));
  app.get('/api/codes',       wrap((req) => bridge.listCodes(req.query)));
  app.get('/api/erf/meta',    wrap(() => bridge.meta()));

  app.get('/api/reports', wrap((req) => {
    const days = Number(req.query?.days) || 1;
    return bridge.statsForDays(days);
  }));

  // ─── ACTIONS ───
  app.patch('/api/beds/:id', wrap((req) => bridge.updateBed(req.params.id, req.body)));

  app.post('/api/patients', wrap((req) => bridge.registerPatient(req.body, actor(req))));

  app.post('/api/patients/:id/bed', wrap((req) =>
    bridge.assignBed(req.params.id, req.body?.bedId, actor(req))
  ));

  app.patch('/api/orders/:id', wrap((req) =>
    bridge.updateOrder(req.params.id, req.body, actor(req))
  ));

  app.post('/api/codes', wrap((req) => bridge.activateCode(req.body, actor(req))));

  app.post('/api/codes/:id/resolve', wrap((req) =>
    bridge.resolveCode(req.params.id, req.body, actor(req))
  ));

  app.post('/api/patients/:id/triage', wrap((req) =>
    bridge.triageVisit(req.params.id, req.body, actor(req))
  ));

  app.post('/api/patients/:id/disposition/:action', wrap((req) =>
    bridge.dispositionVisit(req.params.id, req.params.action, req.body, actor(req))
  ));

  app.post('/api/erf/beds/init', wrap((req) => bridge.initBeds(actor(req))));
  app.post('/api/erf/suggest-esi', wrap((req) => bridge.suggestESI(req.body)));

  console.log('✅ ERF routes mounted (/api/overview, /api/beds, /api/patients, /api/orders, /api/codes, ...)');
}
