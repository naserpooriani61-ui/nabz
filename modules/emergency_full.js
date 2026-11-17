'use strict';
const { h, sd } = require('../core/mod-helpers');
const bus = require('../core/events');

const ZONES = [
  { code:'CPR',    label:'اتاق CPR',        icon:'💔', beds:5,  group:'resuscitation', critical:true,  color:'#dc2626', description:'احیای قلبی-ریوی' },
  { code:'TRAUMA', label:'تروما',           icon:'🩸', beds:5,  group:'resuscitation', critical:true,  color:'#b91c1c', description:'ترومای متعدد، MVA' },
  { code:'FAST',   label:'FAST Track',      icon:'⚡', beds:25, group:'urgent',        critical:false, color:'#059669', description:'ESI 4-5، سرپایی سریع' },
  { code:'ACUTE1', label:'حاد ۱',           icon:'🏥', beds:15, group:'urgent',        critical:false, color:'#d97706', description:'پایش نزدیک' },
  { code:'ACUTE2', label:'حاد ۲',           icon:'🏥', beds:40, group:'urgent',        critical:false, color:'#2563eb', description:'مراقبت متوسط' },
  { code:'OR_OUT', label:'اتاق عمل سرپایی', icon:'🔪', beds:4,  group:'minor',         critical:false, color:'#7c3aed', description:'پروسیجر سرپایی' }
];
const ZONE_MAP = Object.fromEntries(ZONES.map(z => [z.code, z]));

const ESI = [
  { level:1, label:'احیای فوری', color:'dng',  maxWait:0,   examples:'ایست قلبی، شوک' },
  { level:2, label:'اورژانسی',   color:'dng',  maxWait:10,  examples:'درد قفسه سینه، سکته' },
  { level:3, label:'فوری',       color:'warn', maxWait:30,  examples:'درد شدید، تب بالا' },
  { level:4, label:'غیرفوری',    color:'info', maxWait:60,  examples:'درد خفیف، زخم سطحی' },
  { level:5, label:'سرپایی',     color:'ok',   maxWait:120, examples:'علائم خفیف، نسخه' }
];

const CODE_META = {
  '247': { label:'کد ۲۴۷ — STEMI', color:'red', targetMin:90, description:'سکته حاد قلبی', steps:[
    { id:'ecg', name:'ECG ۱۲ لید', targetMin:10 }, { id:'troponin', name:'تروپونین', targetMin:20 },
    { id:'consult', name:'مشاوره قلب', targetMin:30 }, { id:'cathlab', name:'فعال‌سازی کت‌لب', targetMin:60 },
    { id:'reperfusion', name:'شروع ریپرفیوژن', targetMin:90 }
  ]},
  '724': { label:'کد ۷۲۴ — Stroke', color:'purple', targetMin:60, description:'سکته مغزی حاد', steps:[
    { id:'ct', name:'CT مغز', targetMin:25 }, { id:'neuro', name:'مشاوره نورولوژی', targetMin:30 },
    { id:'labs', name:'آزمایش فوری', targetMin:30 }, { id:'decision', name:'تصمیم ترومبولیز', targetMin:45 },
    { id:'lyse', name:'شروع ترومبولیز', targetMin:60 }
  ]},
  '99': { label:'کد ۹۹ — CPR', color:'rose', targetMin:0, description:'ایست قلبی', steps:[
    { id:'cpr_start', name:'شروع CPR', targetMin:0 }, { id:'airway', name:'مدیریت راه هوایی', targetMin:2 },
    { id:'access', name:'دسترسی وریدی', targetMin:3 }, { id:'rhythm', name:'آنالیز ریتم', targetMin:2 },
    { id:'rosc', name:'ROSC یا اعلام مرگ', targetMin:0 }
  ]},
  'blue': { label:'کد آبی', color:'blue', targetMin:0, description:'احیای پزشکی', steps:[
    { id:'team', name:'فراخوان تیم', targetMin:1 }, { id:'assess', name:'ارزیابی اولیه', targetMin:3 }, { id:'stabilize', name:'تثبیت', targetMin:10 }
  ]},
  'mci': { label:'MCI — بحران', color:'amber', targetMin:0, description:'حوادث جمعی', steps:[
    { id:'activate', name:'فعال‌سازی طرح بحران', targetMin:0 }, { id:'triage_area', name:'راه‌اندازی تریاژ', targetMin:5 },
    { id:'command', name:'استقرار فرماندهی', targetMin:10 }, { id:'surge', name:'تخت‌های مازاد', targetMin:15 }
  ]}
};

const ORDER_TEMPLATES = {
  med: [
    { item:'آسپرین', dose:'325 mg', route:'PO', frequency:'یک‌بار' }, { item:'کلوپیدوگرل', dose:'300 mg', route:'PO', frequency:'یک‌بار' },
    { item:'هپارین', dose:'60 U/kg', route:'IV', frequency:'بولوس' }, { item:'مورفین', dose:'4 mg', route:'IV', frequency:'یک‌بار' },
    { item:'فنتانیل', dose:'50 mcg', route:'IV', frequency:'یک‌بار' }, { item:'اندانسترون', dose:'4 mg', route:'IV', frequency:'یک‌بار' },
    { item:'سفتریاکسون', dose:'1 g', route:'IV', frequency:'هر ۱۲ ساعت' }
  ],
  lab: [ { item:'CBC' }, { item:'تروپونین I' }, { item:'BUN/Cr' }, { item:'الکترولیت' }, { item:'ABG' }, { item:'قند خون' }, { item:'PT/INR' }, { item:'کشت خون' }, { item:'لاکتات' } ],
  imaging: [ { item:'گرافی قفسه سینه' }, { item:'CT مغز' }, { item:'CT آنژیو ریه' }, { item:'سونوگرافی شکم' }, { item:'سونوگرافی FAST' }, { item:'اکو Bedside' } ],
  consult: [ { item:'مشاوره قلب' }, { item:'مشاوره نورولوژی' }, { item:'مشاوره جراحی' }, { item:'مشاوره ارتوپدی' }, { item:'مشاوره داخلی' } ],
  nursing: [ { item:'ECG ۱۲ لید' }, { item:'مانیتورینگ مداوم' }, { item:'اکسیژن', dose:'6-10 L/min' }, { item:'دو IV Line' }, { item:'کنترل علائم حیاتی', frequency:'هر ۱۵ دقیقه' } ],
  procedure: [ { item:'بخیه زخم' }, { item:'آتل‌گیری' }, { item:'لوله‌گذاری تراشه' }, { item:'چست‌تیوب' }, { item:'پریکاردیوسنتز' } ]
};

function now() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }
function uid() { return Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,7).toUpperCase(); }

function minutesBetween(a, b) {
  if (!a || !b) return null;
  const ms = sd(b) - sd(a);
  return ms >= 0 ? Math.round(ms / 60000) : null;
}

function news2(v) {
  if (!v) return null;
  let s = 0, n = 0;
  if (v.rr != null) { n++; s += v.rr <= 8 ? 3 : v.rr <= 11 ? 1 : v.rr <= 20 ? 0 : v.rr <= 24 ? 2 : 3; }
  if (v.spo2 != null) { n++; s += v.spo2 <= 91 ? 3 : v.spo2 <= 93 ? 2 : v.spo2 <= 95 ? 1 : 0; }
  if (v.onOxygen) { n++; s += 2; }
  if (v.sbp != null) { n++; s += v.sbp <= 90 ? 3 : v.sbp <= 100 ? 2 : v.sbp <= 110 ? 1 : v.sbp <= 219 ? 0 : 3; }
  if (v.hr != null) { n++; s += v.hr <= 40 ? 3 : v.hr <= 50 ? 1 : v.hr <= 90 ? 0 : v.hr <= 110 ? 1 : v.hr <= 130 ? 2 : 3; }
  if (v.temp != null) { n++; s += v.temp <= 35 ? 3 : v.temp <= 36 ? 1 : v.temp <= 38 ? 0 : v.temp <= 39 ? 1 : 2; }
  if (v.gcs != null) { n++; s += v.gcs < 15 ? 3 : 0; }
  return n === 0 ? null : s;
}

function computeSuggestedESI(cc, vitals) {
  cc = (cc || '').toLowerCase();
  const n2 = news2(vitals);
  let level = 5;
  const reasons = [];
  if (vitals) {
    if (vitals.gcs != null && vitals.gcs <= 8) { level = 1; reasons.push('GCS ≤ 8'); }
    if (vitals.sbp != null && vitals.sbp < 80) { level = 1; reasons.push('شوک (SBP<80)'); }
    if (vitals.spo2 != null && vitals.spo2 < 85) { level = Math.min(level, 1); reasons.push('هیپوکسی شدید'); }
    if (vitals.rr != null && (vitals.rr < 8 || vitals.rr > 35)) { level = Math.min(level, 1); reasons.push('نارسایی تنفسی'); }
  }
  if (/ایست قلب|کد ۹۹|بدون نبض|آپنه/.test(cc)) { level = 1; reasons.push('شکایت بحرانی'); }
  if (level > 2) {
    if (n2 != null && n2 >= 7) { level = 2; reasons.push('NEWS2 ≥ 7'); }
    if (vitals && vitals.sbp != null && vitals.sbp < 100) { level = 2; reasons.push('SBP<100'); }
    if (vitals && vitals.spo2 != null && vitals.spo2 < 92) { level = Math.min(level, 2); reasons.push('SpO2<92'); }
    if (/درد قفسه سینه|تنگی نفس|سکته|همی‌پارزی|تشنج|خونریزی فعال|ترومای متعدد/.test(cc)) { level = Math.min(level, 2); reasons.push('شکایت پرخطر'); }
  }
  if (level > 3) {
    if (n2 != null && n2 >= 5) { level = 3; reasons.push('NEWS2 5-6'); }
    if (/درد شدید|تب بالا|استفراغ|شکستگی|ضربه سر/.test(cc)) { level = Math.min(level, 3); reasons.push('شکایت متوسط'); }
  }
  if (level > 4 && /درد خفیف|زخم سطحی|تهوع|سردرد|عفونت ادراری/.test(cc)) { level = 4; reasons.push('غیرفوری'); }
  return { level, reasons, news2: n2, maxWait: ESI[level-1].maxWait };
}

function initZoneBeds(ctx) {
  const existing = h(ctx, 'beds').filter(b => b.zone);
  const expected = ZONES.reduce((s,z) => s+z.beds, 0);
  if (existing.length >= expected) return { initialized: false, count: existing.length };
  const created = [];
  for (const z of ZONES) {
    for (let i = 1; i <= z.beds; i++) {
      const id = 'ED-' + z.code + '-' + String(i).padStart(2, '0');
      if (existing.find(b => b.id === id)) continue;
      const bed = { id, code: z.code + '-' + i, zone: z.code, area: 'ed', label: z.label + ' #' + i, status: 'empty', patientId: null, visitId: null, group: z.group, critical: z.critical, updatedAt: now() };
      ctx.store.put('beds', bed);
      created.push(bed);
    }
  }
  return { initialized: true, created: created.length, total: existing.length + created.length };
}

function overview(ctx) {
  const visits = h(ctx, 'ed_visits').filter(v => !['discharged','transferred','lwbs','deceased','admitted'].includes(v.status));
  const beds = h(ctx, 'beds').filter(b => b.zone || b.area === 'ed');
  const codes = h(ctx, 'ed_codes').filter(c => c.status === 'active');
  const allVisits = h(ctx, 'ed_visits');

  const byZone = {};
  for (const z of ZONES) {
    const zb = beds.filter(b => b.zone === z.code);
    const occupied = zb.filter(b => b.status === 'occupied').length;
    byZone[z.code] = { code: z.code, label: z.label, icon: z.icon, total: zb.length || z.beds, occupied, empty: (zb.length || z.beds) - occupied };
  }

  const byEsi = { 1:0, 2:0, 3:0, 4:0, 5:0 };
  visits.forEach(v => { if (v.esi) byEsi[v.esi]++; });

  const allToday = allVisits.filter(v => (v.arrivalAt || '').startsWith(today()));
  const d2t = allToday.map(v => minutesBetween(v.arrivalAt, v.triagedAt)).filter(x => x != null);
  const avg = arr => arr.length ? Math.round(arr.reduce((a,b) => a+b, 0)/arr.length) : null;

  return {
    zones: byZone,
    zoneList: ZONES,
    activeVisits: visits.length,
    byEsi,
    activeCodes: codes,
    kpis: {
      arrivalsToday: allToday.length,
      avgDoorToTriage: avg(d2t),
      bedsTotal: beds.length || 94,
      bedsOccupied: beds.filter(b => b.status === 'occupied').length,
      occupancyPct: beds.length ? Math.round(beds.filter(b => b.status === 'occupied').length / beds.length * 100) : 0
    }
  };
}

function listBeds(ctx) {
  let beds = h(ctx, 'beds').filter(b => b.zone || b.area === 'ed');
  return { items: beds, total: beds.length, zones: ZONES };
}

function setBedStatus(ctx) {
  const bed = ctx.store.get('beds', ctx.params.id);
  if (!bed) throw ctx.E.notFound('bed_not_found');
  const st = (ctx.body || {}).status;
  if (!['empty','occupied','cleaning','blocked'].includes(st)) throw ctx.E.badRequest('invalid_status');
  bed.status = st;
  if (st === 'empty') { bed.patientId = null; bed.visitId = null; }
  bed.updatedAt = now();
  ctx.store.put('beds', bed);
  return { bed };
}

function listCodes(ctx) {
  let items = h(ctx, 'ed_codes');
  items.sort((a,b) => sd(b.activatedAt) - sd(a.activatedAt));
  return { items, meta: CODE_META };
}

function activateCode(ctx) {
  const b = ctx.body || {};
  const type = String(b.type || '').replace('code_', '');
  const def = CODE_META[type];
  if (!def) throw ctx.E.badRequest('invalid_code_type');
  const id = 'CODE-' + type.toUpperCase() + '-' + uid();
  const rec = { id, type, label: def.label, visitId: b.visitId || null, patientName: b.patientName || null, activatedAt: now(), activatedBy: ctx.actor.name || 'سیستم', status: 'active', targetMin: def.targetMin, steps: def.steps.map(s => ({ id: s.id, name: s.name, targetMin: s.targetMin, status: 'pending', completedAt: null })) };
  ctx.store.put('ed_codes', rec);
  return rec;
}

function codeStep(ctx) {
  const c = ctx.store.get('ed_codes', ctx.params.id);
  if (!c) throw ctx.E.notFound('code_not_found');
  const stepId = (ctx.body || {}).step;
  const step = c.steps.find(s => s.id === stepId);
  if (!step) throw ctx.E.notFound('step_not_found');
  step.status = 'done';
  step.completedAt = now();
  if (c.steps.every(s => s.status === 'done')) { c.status = 'resolved'; c.resolvedAt = now(); }
  ctx.store.put('ed_codes', c);
  return c;
}

function resolveCode(ctx) {
  const c = ctx.store.get('ed_codes', ctx.params.id);
  if (!c) throw ctx.E.notFound('code_not_found');
  c.status = 'resolved'; c.resolvedAt = now();
  ctx.store.put('ed_codes', c);
  return c;
}

function listOrders(ctx) {
  let items = h(ctx, 'ed_orders');
  items.sort((a,b) => sd(b.createdAt) - sd(a.createdAt));
  return { items, templates: ORDER_TEMPLATES };
}

function stats(ctx) {
  const days = Number(ctx.query.days) || 1;
  const since = Date.now() - days*86400000;
  const visits = h(ctx, 'ed_visits').filter(v => sd(v.arrivalAt) >= since);
  const d2t = visits.map(v => minutesBetween(v.arrivalAt, v.triagedAt)).filter(x => x != null);
  const d2d = visits.map(v => minutesBetween(v.arrivalAt, v.seenAt)).filter(x => x != null);
  const los = visits.map(v => minutesBetween(v.arrivalAt, v.departedAt)).filter(x => x != null);
  const med = a => { if (!a.length) return null; const s = [...a].sort((x,y) => x-y); return s[Math.floor(s.length/2)]; };
  return {
    periodDays: days, totalVisits: visits.length,
    doorToTriage: { median: med(d2t) }, doorToDoctor: { median: med(d2d) }, lengthOfStay: { median: med(los) }
  };
}

module.exports = {
  handlers: { overview, listBeds, initZoneBeds, setBedStatus, listCodes, activateCode, codeStep, resolveCode, listOrders, stats },
  routes: [
    { method:'GET',  path:'/api/erf/overview',        handler:'overview',       perm:'ed.view' },
    { method:'GET',  path:'/api/erf/beds',            handler:'listBeds',       perm:'ed.view' },
    { method:'POST', path:'/api/erf/beds/init',       handler:'initZoneBeds',   perm:'ed.manage' },
    { method:'POST', path:'/api/erf/beds/:id/status', handler:'setBedStatus',   perm:'ed.triage' },
    { method:'GET',  path:'/api/erf/codes',           handler:'listCodes',      perm:'ed.view' },
    { method:'POST', path:'/api/erf/codes',           handler:'activateCode',   perm:'ed.code' },
    { method:'POST', path:'/api/erf/codes/:id/step',  handler:'codeStep',       perm:'ed.code' },
    { method:'POST', path:'/api/erf/codes/:id/resolve',handler:'resolveCode',   perm:'ed.code' },
    { method:'GET',  path:'/api/erf/orders',          handler:'listOrders',     perm:'ed.view' },
    { method:'GET',  path:'/api/erf/stats',           handler:'stats',          perm:'ed.view' }
  ],
  panels: [
    { id:'er_dashboard', title:'اورژانس — فرماندهی',    icon:'🚨', perm:'ed.view', kind:'erf_dashboard', api:'/api/erf/overview' },
    { id:'er_beds',      title:'نقشه تخت‌های اورژانس',  icon:'🛏️', perm:'ed.view', kind:'erf_beds',      api:'/api/erf/beds' },
    { id:'er_codes',     title:'کدهای اورژانس',         icon:'🔴', perm:'ed.view', kind:'erf_codes',     api:'/api/erf/codes' },
    { id:'er_orders',    title:'کاردکس اورژانس',        icon:'📋', perm:'ed.view', kind:'erf_orders',    api:'/api/erf/orders' },
    { id:'er_stats',     title:'آمار و عملکرد اورژانس', icon:'📊', perm:'ed.view', kind:'erf_stats',     api:'/api/erf/stats' }
  ]
};
