const { h, sd, num, sg, list } = require('../core/mod-helpers');

const OR_GROUPS = { GEN: 'جنرال', URO: 'اورولوژی', EMG: 'اورژانس' };
const CSSD_METHODS = ['steam', 'eto', 'plasma', 'chemical'];

const rooms = (ctx) => {
  const items = h(ctx, 'or_rooms');
  return { items, total: items.length, groups: OR_GROUPS, methods: CSSD_METHODS };
};

const schedule = list('or_schedule', 'scheduledStart');
const scheduleCreate = (ctx) => {
  const b = ctx.body;
  if (!b.patientId || !b.roomId || !b.procedure) throw ctx.E.badRequest('missing');
  const p = ctx.store.get('patients', b.patientId);
  if (!p) throw ctx.E.notFound('patient_not_found');
  const room = ctx.store.get('or_rooms', b.roomId);
  if (!room) throw ctx.E.notFound('room_not_found');
  const rec = {
    id: ctx.uid('ors'), patientId: p.id,
    patientName: p.firstName + ' ' + p.lastName, wardCode: p.wardCode,
    roomId: room.id, roomCode: room.code,
    procedure: b.procedure, specialty: b.specialty || 'general',
    surgeon: b.surgeon || null, anesthesiologist: b.anesthesiologist || null,
    scheduledDate: b.scheduledDate || new Date().toISOString().slice(0,10),
    scheduledStart: b.scheduledStart || ctx.now(),
    estimatedDurationMin: Number(b.estimatedDurationMin) || 90,
    priority: b.priority || 'elective',
    status: 'scheduled',
    checklist: { signIn: null, timeOut: null, signOut: null },
    createdAt: ctx.now()
  };
  ctx.store.put('or_schedule', rec);
  sg(ctx, 'or_schedule', rec, 'schedule');
  ctx.bus.emit('or.case.scheduled', { record: rec, actor: ctx.actor });
  return rec;
};

const checklist = (ctx) => {
  const s = ctx.store.get('or_schedule', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  const phase = ctx.params.phase;
  if (!['signin', 'timeout', 'signout'].includes(phase)) throw ctx.E.badRequest('invalid_phase');
  const key = phase === 'signin' ? 'signIn' : phase === 'timeout' ? 'timeOut' : 'signOut';
  const required = phase === 'signin' ? ['patientIdentity','siteMarked','consentSigned','allergiesChecked','anesthesiaSafety']
    : phase === 'timeout' ? ['teamIntroduced','procedureConfirmed','antibioticGiven','imagingDisplayed','instrumentSterility']
    : ['procedureRecorded','instrumentCountCorrect','specimenLabeled','equipmentIssuesNoted','recoveryPlan'];
  const b = ctx.body || {};
  for (const r of required) if (b[r] !== true) throw ctx.E.badRequest('missing_' + r);
  s.checklist[key] = { signedBy: ctx.actor.id, signedAt: ctx.now(), items: b };
  ctx.store.put('or_schedule', s);
  sg(ctx, 'or_schedule', s, phase);
  return s;
};

const startCase = (ctx) => {
  const s = ctx.store.get('or_schedule', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  if (s.status !== 'scheduled') throw ctx.E.conflict('not_scheduled');
  if (!s.checklist.signIn || !s.checklist.timeOut) throw ctx.E.badRequest('checklists_incomplete');
  s.status = 'in_progress';
  s.actualStart = ctx.now();
  ctx.store.put('or_schedule', s);
  const room = ctx.store.get('or_rooms', s.roomId);
  if (room) { room.status = 'occupied'; room.currentCaseId = s.id; ctx.store.put('or_rooms', room); }
  ctx.bus.emit('or.case.started', { record: s, actor: ctx.actor });
  return s;
};

const endCase = (ctx) => {
  const s = ctx.store.get('or_schedule', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  if (s.status !== 'in_progress') throw ctx.E.conflict('not_in_progress');
  if (!s.checklist.signOut) throw ctx.E.badRequest('signout_incomplete');
  s.status = 'completed';
  s.actualEnd = ctx.now();
  s.actualDurationMin = Math.round((sd(s.actualEnd) - sd(s.actualStart)) / 60000);
  ctx.store.put('or_schedule', s);
  const room = ctx.store.get('or_rooms', s.roomId);
  if (room) { room.status = 'cleaning'; room.currentCaseId = null; ctx.store.put('or_rooms', room); }
  ctx.bus.emit('or.case.ended', { record: s, actor: ctx.actor });
  return s;
};

const pacu = (ctx) => {
  const items = h(ctx, 'or_pacu').filter(p => p.status === 'active');
  return { items, total: items.length };
};

const pacuAdmit = (ctx) => {
  const s = ctx.store.get('or_schedule', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  if (s.status !== 'completed') throw ctx.E.conflict('case_not_completed');
  const rec = {
    id: ctx.uid('pacu'), caseId: s.id, patientId: s.patientId,
    patientName: s.patientName, admittedAt: ctx.now(),
    aldreteScore: Number(ctx.body.aldreteScore) || 8,
    status: 'active', nurse: ctx.actor.id
  };
  ctx.store.put('or_pacu', rec);
  return rec;
};

const pacuDischarge = (ctx) => {
  const p = ctx.store.get('or_pacu', ctx.params.id);
  if (!p) throw ctx.E.notFound('not_found');
  if (p.status !== 'active') throw ctx.E.conflict('not_active');
  if (p.aldreteScore < 9) throw ctx.E.conflict('aldrete_too_low');
  p.status = 'discharged';
  p.dischargedAt = ctx.now();
  ctx.store.put('or_pacu', p);
  return p;
};

// ─── CSSD ───
const cssdSets = list('cssd_sets', 'sterilizedAt');
const cssdCreate = (ctx) => {
  const b = ctx.body;
  if (!b.setName || !b.department) throw ctx.E.badRequest('missing');
  const itemCount = Number(b.itemCount) || 0;
  const rec = {
    id: ctx.uid('set'), setName: b.setName, department: b.department,
    itemCount, indicatorClass: itemCount > 12 ? 6 : 4,
    method: b.method || 'steam',
    status: 'prepared', cycleId: null, label: null,
    preparedBy: ctx.actor.id, preparedAt: ctx.now(), createdAt: ctx.now()
  };
  ctx.store.put('cssd_sets', rec);
  sg(ctx, 'cssd_sets', rec, 'create');
  return rec;
};

const cssdCycles = list('cssd_cycles', 'startedAt');
const cssdCycleCreate = (ctx) => {
  const b = ctx.body;
  if (!b.sterilizerCode || !b.method || !Array.isArray(b.setIds))
    throw ctx.E.badRequest('missing');
  const rec = {
    id: ctx.uid('cyc'), cycleNumber: 'C-' + Date.now().toString(36).toUpperCase(),
    sterilizerCode: b.sterilizerCode, method: b.method, setIds: b.setIds,
    status: 'running', loadedBy: ctx.actor.id, loadedByName: ctx.actor.username,
    startedAt: ctx.now(), closedAt: null,
    indicators: { biological: 'pending', chemical: 'pending' },
    createdAt: ctx.now()
  };
  ctx.store.put('cssd_cycles', rec);
  // Link sets
  for (const sid of b.setIds) {
    const s = ctx.store.get('cssd_sets', sid);
    if (s) { s.cycleId = rec.id; s.status = 'sterilizing'; ctx.store.put('cssd_sets', s); }
  }
  return rec;
};

const cssdIndicator = (ctx) => {
  const c = ctx.store.get('cssd_cycles', ctx.params.id);
  if (!c) throw ctx.E.notFound('not_found');
  const b = ctx.body;
  if (!['biological', 'chemical'].includes(b.type)) throw ctx.E.badRequest('invalid_type');
  if (!['pass', 'fail'].includes(b.result)) throw ctx.E.badRequest('invalid_result');
  c.indicators[b.type] = b.result;
  if (b.result === 'fail') c.status = 'failed';
  ctx.store.put('cssd_cycles', c);
  if (b.result === 'fail') ctx.bus.emit('cssd.indicator.failed', { record: c, actor: ctx.actor });
  return c;
};

const cssdIssueSet = (ctx) => {
  const s = ctx.store.get('cssd_sets', ctx.params.id);
  if (!s) throw ctx.E.notFound('not_found');
  if (s.status !== 'sterilized') throw ctx.E.conflict('not_sterilized');
  s.status = 'issued'; s.issuedAt = ctx.now(); s.issuedBy = ctx.actor.id;
  ctx.store.put('cssd_sets', s);
  return s;
};

const cssdRecalls = list('cssd_recalls', 'initiatedAt');
const cssdRecallCreate = (ctx) => {
  const b = ctx.body;
  if (!b.cycleId || !b.reason) throw ctx.E.badRequest('missing');
  const cyc = ctx.store.get('cssd_cycles', b.cycleId);
  if (!cyc) throw ctx.E.notFound('cycle_not_found');
  const affected = h(ctx, 'cssd_sets').filter(s => s.cycleId === cyc.id);
  const rec = {
    id: ctx.uid('recall'), cycleId: cyc.id, cycleNumber: cyc.cycleNumber,
    reason: b.reason, affectedSetCount: affected.length,
    status: 'open', initiatedBy: ctx.actor.id, initiatedAt: ctx.now()
  };
  ctx.store.put('cssd_recalls', rec);
  for (const s of affected) { s.status = 'recalled'; ctx.store.put('cssd_sets', s); }
  ctx.bus.emit('cssd.recall.initiated', { record: rec, actor: ctx.actor });
  return rec;
};

module.exports = {
  handlers: {
    rooms, schedule, scheduleCreate, checklist, startCase, endCase,
    pacu, pacuAdmit, pacuDischarge,
    cssdSets, cssdCreate, cssdCycles, cssdCycleCreate,
    cssdIndicator, cssdIssueSet, cssdRecalls, cssdRecallCreate
  },
  routes: [

    {method:'GET', path:'/api/or/rooms', handler:'rooms', perm:'or.view'},
    {method:'GET', path:'/api/or/schedule', handler:'schedule', perm:'or.view'},
    {method:'POST', path:'/api/or/schedule', handler:'scheduleCreate', perm:'or.schedule'},
    {method:'GET', path:'/api/or/pacu', handler:'pacu', perm:'or.view'},
    {method:'GET', path:'/api/cssd/sets', handler:'cssdSets', perm:'cssd.view'},
    {method:'POST', path:'/api/cssd/sets', handler:'cssdCreate', perm:'cssd.manage'},
    {method:'GET', path:'/api/cssd/cycles', handler:'cssdCycles', perm:'cssd.view'},
    {method:'POST', path:'/api/cssd/cycles', handler:'cssdCycleCreate', perm:'cssd.manage'},
    {method:'GET', path:'/api/cssd/recalls', handler:'cssdRecalls', perm:'cssd.view'},
    {method:'POST', path:'/api/cssd/recalls', handler:'cssdRecallCreate', perm:'cssd.manage'},
    {method:'POST', path:'/api/or/schedule/:id/checklist/:phase', handler:'checklist', perm:'or.checklist'},
    {method:'POST', path:'/api/or/schedule/:id/start', handler:'startCase', perm:'or.checklist'},
    {method:'POST', path:'/api/or/schedule/:id/end', handler:'endCase', perm:'or.checklist'},
    {method:'POST', path:'/api/or/pacu/:id/admit', handler:'pacuAdmit', perm:'or.pacu'},
    {method:'POST', path:'/api/or/pacu/:id/discharge', handler:'pacuDischarge', perm:'or.pacu'},
    {method:'POST', path:'/api/cssd/sets/:id/issue', handler:'cssdIssueSet', perm:'cssd.manage'},
    {method:'POST', path:'/api/cssd/cycles/:id/indicator', handler:'cssdIndicator', perm:'cssd.manage'},
  
  ],
  panels: [
    {id:'rooms', title:'اتاق‌های عمل', icon:'🔪', perm:'or.view', kind:'list',
      api:'/api/or/rooms', fields:['code','group','status']},
    {id:'schedule', title:'برنامه جراحی', icon:'📅', perm:'or.view', kind:'list',
      api:'/api/or/schedule', fields:['patientName','procedure','roomCode','status'],
      form:{api:'/api/or/schedule', method:'POST', fields:[
        {name:'patientId', label:'شناسه بیمار', required:true},
        {name:'roomId', label:'شناسه اتاق (or_GEN1...)', required:true},
        {name:'procedure', label:'نوع عمل', required:true},
        {name:'specialty', label:'تخصص'},
        {name:'priority', label:'اولویت (elective/urgent/emergency)'}
      ]}},
    {id:'pacu', title:'PACU', icon:'🛏️', perm:'or.view', kind:'list',
      api:'/api/or/pacu', fields:['patientName','aldreteScore','status']},
    {id:'cssd_sets', title:'ست‌های استریل', icon:'🧼', perm:'cssd.view', kind:'list',
      api:'/api/cssd/sets', fields:['setName','department','status'],
      form:{api:'/api/cssd/sets', method:'POST', fields:[
        {name:'setName', label:'نام ست', required:true},
        {name:'department', label:'بخش', required:true},
        {name:'itemCount', label:'تعداد اقلام', type:'number'},
        {name:'method', label:'روش (steam/eto/plasma/chemical)'}
      ]}},
    {id:'cssd_cycles', title:'چرخه‌های استریل', icon:'🔄', perm:'cssd.view', kind:'list',
      api:'/api/cssd/cycles', fields:['cycleNumber','method','status']},
    {id:'cssd_recalls', title:'فراخوان‌ها', icon:'🚨', perm:'cssd.view', kind:'list',
      api:'/api/cssd/recalls', fields:['cycleNumber','reason','status']}
  ]
};
