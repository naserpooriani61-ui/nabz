// server/erf-bridge.ts
// ─── لایه آداپتور: تبدیل ERF (SinaER) به قرارداد NABZ ───
// این فایل بدون تغییر دادن ERF یا NABZ، بین آن‌ها ترجمه می‌کند.

type ERFVisit = any;
type ERFOrder = any;

export type ERFBridgeDeps = {
  store: {
    get: (coll: string, id: string) => any;
    put: (coll: string, rec: any) => void;
    delete?: (coll: string, id: string) => void;
  };
  getAll: (coll: string) => any[];
  erfHandlers: any;
  getEvents?: () => any[];
};

const nowMs = (v: any): number | null => {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};

const mapVitals = (v: any) => {
  if (!v) return null;
  return {
    id: v.id,
    hr: v.hr ?? null,
    sbp: v.sbp ?? null,
    dbp: v.dbp ?? null,
    rr: v.rr ?? null,
    spo2: v.spo2 ?? null,
    temp: v.temp ?? null,
    gcs: v.gcs ?? null,
    onOxygen: !!v.onOxygen,
    news2: v.news2 ?? null,
    recordedAt: nowMs(v.recordedAt),
    recordedBy: v.recordedBy ?? v.recordedByName ?? '—',
  };
};

const mapStatus = (erfStatus: string, disposition: string | null): string => {
  const m: Record<string, string> = {
    waiting_triage: 'waiting_triage',
    waiting_bed: 'waiting_bed',
    in_treatment: disposition ? 'awaiting_disposition' : 'in_treatment',
    awaiting_disposition: 'awaiting_disposition',
    admitted: 'admitted',
    discharged: 'discharged',
    transferred: 'transferred',
    lwbs: 'lwbs',
    deceased: 'deceased',
  };
  return m[erfStatus] ?? 'waiting_triage';
};

const mapVisitToPatient = (v: ERFVisit, vitals: any | null) => ({
  id: v.id,
  mrn: v.nationalCode ?? v.id,
  name: v.patientName,
  age: v.age ?? null,
  sex: v.sex === 'M' || v.sex === 'F' ? v.sex : null,
  chiefComplaint: v.chiefComplaint ?? '',
  esi: v.esi ?? null,
  status: mapStatus(v.status, v.disposition),
  bedId: v.bedId ?? null,
  zone: v.zone ?? null,
  arrivedAt: nowMs(v.arrivalAt) ?? Date.now(),
  triagedAt: nowMs(v.triagedAt),
  seenAt: nowMs(v.seenAt),
  departedAt: nowMs(v.departedAt),
  disposition: v.disposition ?? null,
  physicianId: v.physicianId ?? null,
  nurseId: v.nurseId ?? null,
  vitals: mapVitals(vitals),
  news: v.lastNews2 ?? vitals?.news2 ?? null,
  arrivalMode: v.arrivalMode ?? 'walk_in',
  allergies: v.allergies ?? '',
  history: v.history ?? '',
});

const mapOrder = (o: ERFOrder) => ({
  id: o.id,
  patientId: o.visitId ?? o.patientId ?? null,
  visitId: o.visitId ?? null,
  category: o.category ?? 'med',
  item: o.item ?? '',
  dose: o.dose ?? null,
  route: o.route ?? null,
  frequency: o.frequency ?? null,
  priority: o.priority ?? 'routine',
  status: o.status ?? 'pending',
  note: o.note ?? '',
  orderedBy: o.orderedByName ?? o.orderedBy ?? '—',
  createdAt: nowMs(o.createdAt) ?? Date.now(),
  acknowledgedAt: nowMs(o.acknowledgedAt),
  completedAt: nowMs(o.completedAt),
  handledBy: o.handledBy ?? null,
});

const mapBed = (b: any) => ({
  id: b.id,
  code: b.code,
  zone: b.zone,
  label: b.label ?? b.code,
  status: b.status,
  patientId: b.patientId ?? null,
  visitId: b.visitId ?? null,
  group: b.group ?? null,
  critical: !!b.critical,
  updatedAt: nowMs(b.updatedAt) ?? Date.now(),
});

const mapCode = (c: any) => ({
  id: c.id,
  codeType: c.type,
  status: c.status,
  activatedAt: nowMs(c.activatedAt) ?? Date.now(),
  activatedBy: c.activatedByName ?? c.activatedBy ?? '—',
  location: c.notes ?? null,
  resolvedAt: nowMs(c.resolvedAt),
  steps: c.steps ?? [],
});

function diffMin(a: any, b: any): number | null {
  const ta = nowMs(a), tb = nowMs(b);
  if (ta == null || tb == null) return null;
  return Math.round((tb - ta) / 60000);
}

function median(a: number[]): number | null {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}
function avg(a: number[]): number | null {
  if (!a.length) return null;
  return Math.round(a.reduce((x, y) => x + y, 0) / a.length);
}

export function createERFBridge(deps: ERFBridgeDeps) {
  const { store, getAll, erfHandlers } = deps;

  const buildCtx = (extra: any) => ({
    store,
    actor: extra.actor ?? { id: 'system', username: 'system', name: 'سیستم' },
    body: extra.body ?? {},
    query: extra.query ?? {},
    params: extra.params ?? {},
    E: {
      notFound: (m: string) => Object.assign(new Error(m), { status: 404 }),
      badRequest: (m: string) => Object.assign(new Error(m), { status: 400 }),
      conflict: (m: string) => Object.assign(new Error(m), { status: 409 }),
    },
  });

  const todayStats = () => {
    const visits = getAll('ed_visits');
    const orders = getAll('ed_orders');
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const todayMs = startToday.getTime();

    const todayVisits = visits.filter(v => {
      const t = nowMs(v.arrivalAt);
      return t != null && t >= todayMs;
    });

    const d2t = todayVisits.map(v => diffMin(v.arrivalAt, v.triagedAt)).filter((x): x is number => x != null);
    const d2d = todayVisits.map(v => diffMin(v.arrivalAt, v.seenAt)).filter((x): x is number => x != null);
    const los = todayVisits.map(v => diffMin(v.arrivalAt, v.departedAt)).filter((x): x is number => x != null);

    const esi: Record<string, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const dispo: Record<string, number> = {};
    todayVisits.forEach(v => {
      if (v.esi) esi[v.esi] = (esi[v.esi] ?? 0) + 1;
      if (v.disposition) dispo[v.disposition] = (dispo[v.disposition] ?? 0) + 1;
    });

    const total = todayVisits.length;
    const lwbs = dispo['lwbs'] ?? 0;
    const admitted = dispo['admitted'] ?? 0;

    // hourly
    const hourBuckets: Record<number, number> = {};
    todayVisits.forEach(v => {
      const t = nowMs(v.arrivalAt);
      if (t == null) return;
      const hr = new Date(t).getHours();
      hourBuckets[hr] = (hourBuckets[hr] ?? 0) + 1;
    });
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourBuckets[h] ?? 0 }));

    // orders TAT
    const orderByCat: Record<string, { count: number; tats: number[] }> = {};
    orders.forEach(o => {
      const cat = o.category ?? 'med';
      if (!orderByCat[cat]) orderByCat[cat] = { count: 0, tats: [] };
      orderByCat[cat].count++;
      const tat = diffMin(o.createdAt, o.completedAt);
      if (tat != null) orderByCat[cat].tats.push(tat);
    });
    const ordersReport = Object.entries(orderByCat).map(([c, v]) => ({
      category: c, count: v.count, tat: median(v.tats),
    }));

    return {
      days: 1,
      total,
      doorToTriage: { median: median(d2t), avg: avg(d2t), n: d2t.length },
      doorToDoctor: { median: median(d2d), avg: avg(d2d), n: d2d.length },
      los: { median: median(los), avg: avg(los), n: los.length },
      lwbsRate: total ? lwbs / total : 0,
      admitRate: total ? admitted / total : 0,
      esi,
      dispo,
      hourly,
      daily: [],
      orders: ordersReport,
      losByEsi: [1, 2, 3, 4, 5].map(e => {
        const sub = todayVisits.filter(v => v.esi === e);
        return {
          esi: e,
          d2d: median(sub.map(v => diffMin(v.arrivalAt, v.seenAt)).filter((x): x is number => x != null)),
          los: median(sub.map(v => diffMin(v.arrivalAt, v.departedAt)).filter((x): x is number => x != null)),
        };
      }),
      topComplaints: [],
    };
  };

  const overview = () => {
    const visits = getAll('ed_visits');
    const beds = getAll('beds').filter((b: any) => b.zone || b.area === 'ed');
    const orders = getAll('ed_orders');
    const codes = getAll('ed_codes');
    const vitals = getAll('ed_vitals');
    const staff = getAll('staff');

    const vitalsByVisit = new Map<string, any>();
    for (const v of vitals) vitalsByVisit.set(v.visitId, v);

    const patients = visits.map((v: any) =>
      mapVisitToPatient(v, vitalsByVisit.get(v.id) ?? null)
    );

    const staffList = staff.map((s: any) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      title: s.title ?? '',
      onShift: !!s.onShift,
      username: s.username ?? null,
    }));

    const events = (deps.getEvents?.() ?? getAll('events') ?? []).slice(0, 100);

    return {
      now: Date.now(),
      sim: false,
      beds: beds.map(mapBed),
      staff: staffList,
      patients,
      orders: orders.map(mapOrder),
      events,
      codes: codes.map(mapCode),
      today: todayStats(),
    };
  };

  const listBeds = (query: any = {}) => {
    let beds = getAll('beds').filter((b: any) => b.zone || b.area === 'ed');
    if (query.zone) beds = beds.filter((b: any) => b.zone === query.zone);
    if (query.status) beds = beds.filter((b: any) => b.status === query.status);
    return beds.map(mapBed);
  };

  const listPatients = (query: any = {}) => {
    const visits = getAll('ed_visits');
    const vitals = getAll('ed_vitals');
    const vitalsByVisit = new Map<string, any>();
    for (const v of vitals) vitalsByVisit.set(v.visitId, v);

    let items = visits.map((v: any) => mapVisitToPatient(v, vitalsByVisit.get(v.id) ?? null));

    if (query.scope === 'active') {
      items = items.filter((p: any) => !['discharged', 'transferred', 'lwbs', 'deceased', 'admitted'].includes(p.status));
    } else if (query.scope === 'closed') {
      items = items.filter((p: any) => ['discharged', 'transferred', 'lwbs', 'deceased', 'admitted'].includes(p.status));
    }

    if (query.q) {
      const q = String(query.q).toLowerCase();
      items = items.filter((p: any) =>
        (p.name ?? '').toLowerCase().includes(q) ||
        (p.mrn ?? '').toLowerCase().includes(q) ||
        (p.chiefComplaint ?? '').toLowerCase().includes(q)
      );
    }
    return items;
  };

  const listOrders = (query: any = {}) => {
    let items = getAll('ed_orders').map(mapOrder);
    if (query.status) items = items.filter((o: any) => o.status === query.status);
    if (query.patientId) items = items.filter((o: any) => o.patientId === query.patientId);
    if (query.visitId) items = items.filter((o: any) => o.visitId === query.visitId);
    return items;
  };

  const listCodes = (query: any = {}) => {
    let items = getAll('ed_codes').map(mapCode);
    if (query.status) items = items.filter((c: any) => c.status === query.status);
    items.sort((a: any, b: any) => b.activatedAt - a.activatedAt);
    return items;
  };

  // ─── actions ───
  const updateBed = (id: string, body: any) => {
    const bed = store.get('beds', id);
    if (!bed) throw Object.assign(new Error('bed_not_found'), { status: 404 });
    if (body.status) bed.status = body.status;
    if (body.status === 'empty') { bed.patientId = null; bed.visitId = null; }
    bed.updatedAt = new Date().toISOString();
    store.put('beds', bed);
    return mapBed(bed);
  };

  const registerPatient = (body: any, actor: any) => {
    const ctx = buildCtx({
      body: {
        name: body.name,
        age: body.age,
        sex: body.sex,
        nationalCode: body.nationalCode,
        phone: body.phone,
        chiefComplaint: body.chiefComplaint,
        arrivalMode: body.arrivalMode === 'ems' ? 'ambulance' : (body.arrivalMode ?? 'walk_in'),
        allergies: body.allergies,
        history: body.history,
        esi: body.esi ?? null,
      },
      actor,
    });
    const rec = erfHandlers.registerVisit(ctx);
    return mapVisitToPatient(rec, null);
  };

  const assignBed = (patientId: string, bedId: string, actor: any) => {
    const visit = store.get('ed_visits', patientId);
    if (!visit) throw Object.assign(new Error('visit_not_found'), { status: 404 });
    const bed = store.get('beds', bedId);
    if (!bed) throw Object.assign(new Error('bed_not_found'), { status: 404 });

    // آزادسازی تخت قبلی
    if (visit.bedId && visit.bedId !== bedId) {
      const old = store.get('beds', visit.bedId);
      if (old) {
        old.status = 'cleaning';
        old.patientId = null;
        old.visitId = null;
        old.updatedAt = new Date().toISOString();
        store.put('beds', old);
      }
    }

    bed.status = 'occupied';
    bed.patientId = visit.id;
    bed.visitId = visit.id;
    bed.updatedAt = new Date().toISOString();
    store.put('beds', bed);

    visit.bedId = bedId;
    visit.zone = bed.zone;
    visit.status = 'in_treatment';
    visit.assignedAt = new Date().toISOString();
    visit.assignedBy = actor?.id ?? 'system';
    store.put('ed_visits', visit);

    return mapVisitToPatient(visit, null);
  };

  const updateOrder = (id: string, body: any, actor: any) => {
    const order = store.get('ed_orders', id);
    if (!order) throw Object.assign(new Error('order_not_found'), { status: 404 });
    if (body.status) order.status = body.status;
    if (body.handledBy) order.handledBy = body.handledBy;
    if (body.status === 'done' || body.status === 'completed') {
      order.status = 'done';
      order.completedAt = new Date().toISOString();
    }
    if (body.status === 'acknowledged' && !order.acknowledgedAt) {
      order.acknowledgedAt = new Date().toISOString();
    }
    order.updatedAt = new Date().toISOString();
    store.put('ed_orders', order);
    return mapOrder(order);
  };

  const resolveCode = (id: string, body: any, actor: any) => {
    const ctx = buildCtx({
      params: { id },
      body: { note: body.note ?? '' },
      actor,
    });
    return mapCode(erfHandlers.resolveCode(ctx));
  };

  const activateCode = (body: any, actor: any) => {
    const ctx = buildCtx({ body, actor });
    return mapCode(erfHandlers.activateCode(ctx));
  };

  const triageVisit = (id: string, body: any, actor: any) => {
    const ctx = buildCtx({ params: { id }, body, actor });
    const result = erfHandlers.triage(ctx);
    return {
      visit: mapVisitToPatient(result.visit, null),
      suggestion: result.suggestion,
    };
  };

  const dispositionVisit = (id: string, action: string, body: any, actor: any) => {
    const ctx = buildCtx({ params: { id, action }, body, actor });
    const rec = erfHandlers.disposition(ctx);
    return mapVisitToPatient(rec, null);
  };

  const initBeds = (actor: any) => {
    const ctx = buildCtx({ actor });
    return erfHandlers.initZoneBeds(ctx);
  };

  const suggestESI = (body: any) => {
    const ctx = buildCtx({ body });
    return erfHandlers.suggestESI(ctx);
  };

  const statsForDays = (days: number) => {
    const ctx = buildCtx({ query: { days: String(days) } });
    return erfHandlers.stats(ctx);
  };

  const meta = () => {
    const ctx = buildCtx({});
    return erfHandlers.getMeta(ctx);
  };

  return {
    overview,
    listBeds,
    listPatients,
    listOrders,
    listCodes,
    updateBed,
    registerPatient,
    assignBed,
    updateOrder,
    resolveCode,
    activateCode,
    triageVisit,
    dispositionVisit,
    initBeds,
    suggestESI,
    statsForDays,
    meta,
  };
}
