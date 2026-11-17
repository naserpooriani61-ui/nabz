'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Request System (پرسنل → سرپرستار → مترون)
//  با SLA، escalation، attachments، workflow کامل
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const bus = require('../core/events');

// ═══ TYPES ═══
const TYPES = {
  // پرسنلی
  leave:        { label:'مرخصی',             icon:'🏖️', category:'personnel', route:'head_nurse',          sla:24,  requiresDate:true,  requiresReason:true },
  sick:         { label:'استعلاجی',           icon:'🤒', category:'personnel', route:'head_nurse',          sla:4,   requiresDate:true,  requiresReason:true, requiresDocument:true },
  overtime:     { label:'اضافه‌کاری',         icon:'⏰', category:'personnel', route:'head_nurse',          sla:24,  requiresDate:true },
  shift_swap:   { label:'تعویض شیفت',         icon:'🔄', category:'personnel', route:'head_nurse',          sla:12,  requiresDate:true,  requiresReason:true },
  early_leave:  { label:'مرخصی ساعتی',        icon:'🚪', category:'personnel', route:'head_nurse',          sla:4,   requiresReason:true },
  // آموزشی
  training:     { label:'درخواست آموزش',      icon:'🎓', category:'education', route:'supervisor_education', sla:72,  requiresReason:true },
  conference:   { label:'شرکت در کنفرانس',    icon:'🎤', category:'education', route:'supervisor_education', sla:120, requiresReason:true },
  exam_appeal:  { label:'اعتراض به آزمون',    icon:'📝', category:'education', route:'supervisor_education', sla:48,  requiresReason:true },
  // تجهیزات / IT
  equipment:    { label:'درخواست تجهیزات',    icon:'🔧', category:'logistics', route:'head_nurse',          sla:48,  requiresReason:true },
  uniform:      { label:'لباس/لوازم',         icon:'👔', category:'logistics', route:'admin',               sla:72 },
  maintenance:  { label:'تعمیرات',            icon:'🛠️', category:'logistics', route:'it_staff',            sla:4,   requiresReason:true, urgent:true },
  it:           { label:'درخواست IT',         icon:'💻', category:'logistics', route:'it_staff',            sla:4,   requiresReason:true },
  // ایمنی / کیفیت
  incident:     { label:'گزارش حادثه',        icon:'⚠️', category:'safety',    route:'supervisor_infection', sla:2,  requiresReason:true, urgent:true },
  complaint:    { label:'شکایت',              icon:'📢', category:'quality',   route:'quality_officer',     sla:48,  requiresReason:true },
  suggestion:   { label:'پیشنهاد بهبود',      icon:'💡', category:'quality',   route:'quality_officer',     sla:72,  requiresReason:true },
  // اداری
  document:     { label:'درخواست مدرک',       icon:'📄', category:'admin',     route:'admin',               sla:120 },
  letter:       { label:'گواهی اشتغال',       icon:'📃', category:'admin',     route:'admin',               sla:72 },
  // بالینی
  transfer:     { label:'درخواست انتقال',     icon:'🔄', category:'clinical',  route:'head_nurse',          sla:12,  requiresReason:true },
  medication:   { label:'درخواست دارو',       icon:'💊', category:'clinical',  route:'pharmacist',          sla:2,   requiresReason:true, urgent:true }
};

// ═══ HELPERS ═══
function resolveWard(ctx) {
  if (ctx.actor.ward) return ctx.actor.ward;
  // Try sa_staff
  const staffId = ctx.actor.staffId;
  if (staffId) {
    const sa = h(ctx, 'sa_staff').find(s => s.id === staffId);
    if (sa) {
      const ward = h(ctx, 'sa_wards').find(w => w.id === sa.wardId);
      return ward ? ward.code : null;
    }
    const wf = h(ctx, 'wf_staff').find(s => s.id === staffId);
    if (wf) return wf.ward;
  }
  // Try by fullName
  const sa2 = h(ctx, 'sa_staff').find(s => s.name === ctx.actor.fullName);
  if (sa2) {
    const ward = h(ctx, 'sa_wards').find(w => w.id === sa2.wardId);
    return ward ? ward.code : null;
  }
  return null;
}

function findApprover(ctx, routeRole, ward) {
  // For head_nurse: look for head of this ward
  if (routeRole === 'head_nurse') {
    const wardData = h(ctx, 'sa_wards').find(w => w.code === ward);
    if (wardData && wardData.headStaffId) {
      const head = h(ctx, 'sa_staff').find(s => s.id === wardData.headStaffId);
      if (head) return { id: 'sa_' + head.id, userId: 'sa_' + head.id, name: head.name, role:'head_nurse', kind:'sa_staff' };
    }
    // Try users collection
    const hn = h(ctx, 'users').find(u => u.role === 'head_nurse' && (u.ward === ward || !ward));
    if (hn) return { id: hn.id, userId: hn.id, name: hn.fullName, role:'head_nurse', kind:'user' };
    return null;
  }
  // For role-based: find first active user with role
  const user = h(ctx, 'users').find(u => u.role === routeRole && u.active !== false);
  if (user) return { id: user.id, userId: user.id, name: user.fullName || user.username, role: routeRole, kind:'user' };
  // Fallback: sa_staff with matching category
  const saCat = {
    'matron':'matron', 'supervisor_education':'supervisor', 'supervisor_infection':'supervisor',
    'quality_officer':'supervisor', 'pharmacist':'rn', 'it_staff':'rn', 'admin':'admin'
  }[routeRole];
  if (saCat) {
    const s = h(ctx, 'sa_staff').find(x => x.category === saCat && x.active);
    if (s) return { id:'sa_'+s.id, userId:'sa_'+s.id, name:s.name, role: routeRole, kind:'sa_staff' };
  }
  return null;
}

function notify(ctx, userId, title, body, type, requestId) {
  ctx.store.put('sa_notifications', {
    id: ctx.uid('san'), userId: userId,
    title, body, type: type || 'info',
    read: false, createdAt: ctx.now(),
    requestId: requestId || null
  });
}

// ═══ CREATE ═══
function create(ctx) {
  const b = ctx.body;
  if (!b.type || !TYPES[b.type]) throw ctx.E.badRequest('invalid_type');
  const def = TYPES[b.type];
  const ward = resolveWard(ctx);

  // Validate required
  if (def.requiresDate && !b.fromDate && !b.date) throw ctx.E.badRequest('date_required');
  if (def.requiresReason && !b.reason) throw ctx.E.badRequest('reason_required');

  // Find approver
  const approver = findApprover(ctx, def.route, ward);

  const slaHours = def.sla || 24;
  const rec = {
    id: ctx.uid('req'),
    type: b.type, typeLabel: def.label, icon: def.icon, category: def.category,
    subject: b.subject || def.label,
    description: b.description || '',
    reason: b.reason || '',
    priority: b.priority || (def.urgent ? 'urgent' : 'normal'),
    fromDate: b.fromDate || b.date || null,
    toDate: b.toDate || null,
    fromTime: b.fromTime || null,
    toTime: b.toTime || null,
    amount: b.amount != null ? Number(b.amount) : null,
    metadata: b.metadata || {},
    attachments: Array.isArray(b.attachments) ? b.attachments : [],
    requestedBy: ctx.actor.id,
    requestedByName: ctx.actor.fullName || ctx.actor.username,
    requestedByRole: ctx.actor.role,
    requestedByWard: ward,
    approverRole: def.route,
    approverId: approver ? approver.id : null,
    approverName: approver ? approver.name : null,
    status: 'submitted',
    slaHours: slaHours,
    dueAt: new Date(Date.now() + slaHours * 3600000).toISOString(),
    timeline: [{ status:'submitted', at: ctx.now(), by: ctx.actor.id, byName: ctx.actor.fullName || ctx.actor.username }],
    createdAt: ctx.now()
  };
  ctx.store.put('requests', rec);

  // Notify approver
  if (approver && approver.userId) {
    notify(ctx, approver.userId, '📥 ' + def.label, rec.requestedByName + ' — ' + rec.subject, 'info', rec.id);
  }
  bus.emit('request.created', { record: rec, actor: ctx.actor });
  return rec;
}

// ═══ LIST ═══
function listMine(ctx) {
  let items = h(ctx, 'requests').filter(r => r.requestedBy === ctx.actor.id);
  if (ctx.query.status) items = items.filter(r => r.status === ctx.query.status);
  items.sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  return { items, total: items.length };
}

function listInbox(ctx) {
  const me = ctx.actor.id;
  const myRole = ctx.actor.role;
  let items = h(ctx, 'requests').filter(r =>
    (r.approverId === me || r.approverId === ctx.actor.userId) ||
    (r.approverRole === myRole && !r.approverId)
  );
  if (ctx.query.status) items = items.filter(r => r.status === ctx.query.status);
  else items = items.filter(r => ['submitted','escalated'].includes(r.status));
  if (ctx.query.role) items = items.filter(r => r.approverRole === ctx.query.role);
  items.sort((a, b) => {
    // Urgent first, then by date
    if (a.priority !== b.priority) {
      if (a.priority === 'urgent') return -1;
      if (b.priority === 'urgent') return 1;
    }
    return sd(b.createdAt) - sd(a.createdAt);
  });
  // Add overdue flag
  items = items.map(r => {
    const overdue = r.dueAt && new Date(r.dueAt).getTime() < Date.now() && ['submitted','escalated'].includes(r.status);
    return Object.assign({}, r, { overdue: !!overdue });
  });
  return { items, total: items.length };
}

function listAll(ctx) {
  let items = h(ctx, 'requests');
  if (ctx.query.status) items = items.filter(r => r.status === ctx.query.status);
  if (ctx.query.type) items = items.filter(r => r.type === ctx.query.type);
  if (ctx.query.role) items = items.filter(r => r.approverRole === ctx.query.role);
  if (ctx.query.ward) items = items.filter(r => r.requestedByWard === ctx.query.ward);
  items.sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  return { items, total: items.length };
}

function getById(ctx) {
  const r = ctx.store.get('requests', ctx.params.id);
  if (!r) throw ctx.E.notFound('not_found');
  return r;
}

// ═══ ACTIONS ═══
function addTimeline(r, status, actor, note) {
  r.timeline = r.timeline || [];
  r.timeline.push({ status, at: new Date().toISOString(),
    by: actor.id, byName: actor.fullName || actor.username, note: note || '' });
}

function approve(ctx) {
  const r = ctx.store.get('requests', ctx.params.id);
  if (!r) throw ctx.E.notFound('not_found');
  if (!['submitted','escalated'].includes(r.status)) throw ctx.E.conflict('not_pending');
  r.status = 'approved';
  r.approvedAt = ctx.now();
  r.approvedBy = ctx.actor.id;
  r.approvedByName = ctx.actor.fullName || ctx.actor.username;
  r.approvalNote = ctx.body.note || '';
  addTimeline(r, 'approved', ctx.actor, r.approvalNote);
  ctx.store.put('requests', r);

  // Notify requester
  const requesterId = r.requestedBy.startsWith('sa_') ? r.requestedBy : r.requestedBy;
  notify(ctx, requesterId, '✅ درخواست تأیید شد: ' + r.typeLabel, r.subject, 'success', r.id);

  bus.emit('request.approved', { record: r, actor: ctx.actor });
  return r;
}

function reject(ctx) {
  const r = ctx.store.get('requests', ctx.params.id);
  if (!r) throw ctx.E.notFound('not_found');
  if (!['submitted','escalated'].includes(r.status)) throw ctx.E.conflict('not_pending');
  if (!ctx.body.reason) throw ctx.E.badRequest('reason_required');
  r.status = 'rejected';
  r.rejectedAt = ctx.now();
  r.rejectedBy = ctx.actor.id;
  r.rejectedByName = ctx.actor.fullName || ctx.actor.username;
  r.rejectReason = ctx.body.reason;
  addTimeline(r, 'rejected', ctx.actor, r.rejectReason);
  ctx.store.put('requests', r);

  notify(ctx, r.requestedBy, '❌ درخواست رد شد: ' + r.typeLabel, r.subject + ' — ' + r.rejectReason, 'danger', r.id);
  bus.emit('request.rejected', { record: r, actor: ctx.actor });
  return r;
}

function escalate(ctx) {
  const r = ctx.store.get('requests', ctx.params.id);
  if (!r) throw ctx.E.notFound('not_found');
  if (!['submitted','escalated'].includes(r.status)) throw ctx.E.conflict('not_pending');

  const CHAIN = {
    'head_nurse': 'matron',
    'matron': 'nursing_director',
    'supervisor': 'supervisor_senior',
    'supervisor_clinical': 'supervisor_senior',
    'supervisor_er': 'supervisor_senior',
    'supervisor_education': 'nursing_director',
    'supervisor_infection': 'medical_director',
    'quality_officer': 'medical_director',
    'pharmacist': 'medical_director',
    'it_staff': 'admin',
    'admin': 'hospital_director',
    'nursing_director': 'hospital_director',
    'medical_director': 'hospital_director'
  };
  const nextRole = CHAIN[r.approverRole] || 'hospital_director';
  const newApprover = findApprover(ctx, nextRole, r.requestedByWard);
  r.status = 'escalated';
  r.approverRole = nextRole;
  r.approverId = newApprover ? newApprover.id : null;
  r.approverName = newApprover ? newApprover.name : null;
  r.escalatedAt = ctx.now();
  r.escalationReason = ctx.body.reason || 'SLA exceeded';
  addTimeline(r, 'escalated', ctx.actor, '→ ' + nextRole);
  ctx.store.put('requests', r);

  if (newApprover && newApprover.userId) {
    notify(ctx, newApprover.userId, '⚠️ درخواست escalated', r.typeLabel + ' — ' + r.subject, 'warning', r.id);
  }
  if (r.requestedBy) {
    notify(ctx, r.requestedBy, 'ℹ️ درخواست به سطح بالاتر ارسال شد', r.typeLabel, 'info', r.id);
  }
  bus.emit('request.escalated', { record: r, actor: ctx.actor });
  return r;
}

function addNote(ctx) {
  const r = ctx.store.get('requests', ctx.params.id);
  if (!r) throw ctx.E.notFound('not_found');
  if (!ctx.body.note) throw ctx.E.badRequest('note_required');
  addTimeline(r, 'note', ctx.actor, ctx.body.note);
  ctx.store.put('requests', r);
  return r;
}

function cancel(ctx) {
  const r = ctx.store.get('requests', ctx.params.id);
  if (!r) throw ctx.E.notFound('not_found');
  if (r.requestedBy !== ctx.actor.id && ctx.actor.role !== 'admin') throw ctx.E.forbidden('not_owner');
  if (!['submitted','escalated'].includes(r.status)) throw ctx.E.conflict('not_pending');
  r.status = 'cancelled';
  r.cancelledAt = ctx.now();
  addTimeline(r, 'cancelled', ctx.actor, ctx.body.reason || '');
  ctx.store.put('requests', r);
  return r;
}

// ═══ STATS ═══
function stats(ctx) {
  const all = h(ctx, 'requests');
  const mine = all.filter(r => r.requestedBy === ctx.actor.id);
  const inbox = all.filter(r =>
    (r.approverId === ctx.actor.id || r.approverRole === ctx.actor.role) &&
    ['submitted','escalated'].includes(r.status)
  );
  const overdue = inbox.filter(r => r.dueAt && new Date(r.dueAt).getTime() < Date.now());
  return {
    mine: {
      total: mine.length,
      submitted: mine.filter(r => r.status === 'submitted').length,
      approved: mine.filter(r => r.status === 'approved').length,
      rejected: mine.filter(r => r.status === 'rejected').length
    },
    inbox: {
      total: inbox.length,
      urgent: inbox.filter(r => r.priority === 'urgent').length,
      overdue: overdue.length
    }
  };
}

function getTypes(ctx) {
  return {
    items: Object.entries(TYPES).map(([k, v]) => ({ code: k, ...v })),
    total: Object.keys(TYPES).length
  };
}

function overdueReport(ctx) {
  const all = h(ctx, 'requests').filter(r => ['submitted','escalated'].includes(r.status));
  const overdue = all.filter(r => r.dueAt && new Date(r.dueAt).getTime() < Date.now());
  return { items: overdue, total: overdue.length };
}

module.exports = {
  handlers: { create, listMine, listInbox, listAll, getById,
    approve, reject, escalate, addNote, cancel, stats, getTypes, overdueReport },
  routes: [
    { method:'GET',  path:'/api/req/all', handler:'listAll', perm:'admin.users.manage' },
    { method:'GET',  path:'/api/req/overdue', handler:'overdueReport', perm:'admin.users.manage' },
    { method:'GET',  path:'/api/req/types', handler:'getTypes', perm:null },
    { method:'GET',  path:'/api/req/mine', handler:'listMine', perm:null },
    { method:'GET',  path:'/api/req/inbox', handler:'listInbox', perm:null },
    { method:'GET',  path:'/api/req/stats', handler:'stats', perm:null },
    { method:'GET',  path:'/api/req/:id', handler:'getById', perm:null },
    { method:'POST', path:'/api/req/create', handler:'create', perm:null },
    { method:'POST', path:'/api/req/:id/approve', handler:'approve', perm:null },
    { method:'POST', path:'/api/req/:id/reject', handler:'reject', perm:null },
    { method:'POST', path:'/api/req/:id/escalate', handler:'escalate', perm:null },
    { method:'POST', path:'/api/req/:id/note', handler:'addNote', perm:null },
    { method:'POST', path:'/api/req/:id/cancel', handler:'cancel', perm:null }
  
  ],
  panels: [
    { id:'inbox', title:'صندوق درخواست‌ها', icon:'📥', perm:null, kind:'requests_inbox', api:'/api/req/inbox' },
    { id:'mine', title:'درخواست‌های من', icon:'📤', perm:null, kind:'requests_mine', api:'/api/req/mine' }
  ]
};
