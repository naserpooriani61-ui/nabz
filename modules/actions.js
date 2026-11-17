const { h } = require('../core/mod-helpers');
const perms = require('../core/permissions');

// ═══════════════════════════════════════════════════════════
//  Declarative action catalog — one entry per collection
//  Each action: { from: status|array|'*', to: id, label, perm, method, path, requires }
//  `requires` maps field name → type: text | number | checkbox | select
// ═══════════════════════════════════════════════════════════
const A = {
  patients: [
    { from: ['in_care','admitted'], to: 'discharge', label: '🚪 ترخیص', perm: 'patients.update', method: 'POST', path: '/api/flow/discharge/{id}', requires: { dischargeType: 'select:home,transfer,ama,expired', reason: 'text', followupInstructions: 'text' } },
    { from: ['in_care','admitted'], to: 'transfer', label: '🔄 انتقال', perm: 'patients.transfer', method: 'POST', path: '/api/wf/transfers', requires: { toWard: 'text', reason: 'text' } }
  ],
  orders: [
    { from:'pending',  to:'verify',  label:'✅ تأیید',    perm:'kardex.order.verify',  method:'POST', path:'/api/clinical/orders/{id}/verify' },
    { from:'verified', to:'execute', label:'▶️ اجرا',     perm:'kardex.order.execute', method:'POST', path:'/api/clinical/orders/{id}/execute' },
    { from:['pending','verified'], to:'cancel', label:'❌ لغو', perm:'kardex.order.verify', method:'POST', path:'/api/clinical/orders/{id}/cancel', requires:{ reason:'text' } }
  ],
  mar: [
    { from:['scheduled','due'], to:'administer', label:'✅ توزیع', perm:'kardex.mar.administer', method:'POST', path:'/api/clinical/mar/{id}/administer',
      requires:{ fiveRights:'five_rights', witnessedBy:'text' } },
    { from:['scheduled','due'], to:'refuse', label:'❌ رد', perm:'kardex.mar.administer', method:'POST', path:'/api/clinical/mar/{id}/refuse', requires:{ reason:'text' } }
  ],
  consults: [
    { from:'requested', to:'respond', label:'💬 پاسخ', perm:'consult.respond', method:'POST', path:'/api/wf/consults/{id}/respond', requires:{ answer:'text', recommendations:'text', followup:'text' } },
    { from:'responded', to:'approve', label:'✅ تأیید', perm:'consult.approve', method:'POST', path:'/api/wf/consults/{id}/approve' },
    { from:['requested','responded'], to:'cancel', label:'❌ لغو', perm:'consult.request', method:'POST', path:'/api/wf/consults/{id}/cancel', requires:{ reason:'text' } }
  ],
  transfers: [
    { from:'requested',     to:'approve',   label:'✅ تأیید', perm:'transfer.approve',    method:'POST', path:'/api/wf/transfers/{id}/approve' },
    { from:'approved',      to:'assign_bed', label:'🛏️ تخصیص تخت', perm:'transfer.assign_bed', method:'POST', path:'/api/wf/transfers/{id}/assign_bed', requires:{ bedId:'text' } },
    { from:'bed_assigned',  to:'handover',  label:'📝 تحویل', perm:'transfer.handover',   method:'POST', path:'/api/wf/transfers/{id}/handover' },
    { from:'handover_done', to:'complete',  label:'✅ تکمیل', perm:'transfer.complete',   method:'POST', path:'/api/wf/transfers/{id}/complete' }
  ],
  discharges: [
    { from:'planned',         to:'summary',  label:'📝 خلاصه', perm:'discharge.plan', method:'POST', path:'/api/wf/discharges/{id}/summary', requires:{ finalDiagnosis:'text', medications:'text', followupInstructions:'text' } },
    { from:'summary_drafted', to:'approve',  label:'✅ تأیید', perm:'discharge.plan', method:'POST', path:'/api/wf/discharges/{id}/approve' },
    { from:'approved',        to:'educate',  label:'🎓 آموزش', perm:'discharge.plan', method:'POST', path:'/api/wf/discharges/{id}/educate', requires:{ topics:'text' } },
    { from:'education_done',  to:'complete', label:'🚪 ترخیص', perm:'discharge.plan', method:'POST', path:'/api/wf/discharges/{id}/complete' }
  ],
  handovers: [
    { from:'draft',  to:'sign',    label:'✍️ امضا',  perm:'handover.sign',    method:'POST', path:'/api/wf/handovers/{id}/sign' },
    { from:'signed', to:'receive', label:'✅ دریافت', perm:'handover.receive', method:'POST', path:'/api/wf/handovers/{id}/receive' }
  ],
  labs: [
    { from:'ordered',   to:'collect', label:'🧫 نمونه', perm:'lab.collect', method:'POST', path:'/api/para/labs/{id}/collect' },
    { from:'collected', to:'result',  label:'📊 نتیجه', perm:'lab.result',  method:'POST', path:'/api/para/labs/{id}/result', requires:{ values:'text' } },
    { from:'resulted',  to:'verify',  label:'✅ تأیید', perm:'lab.verify',  method:'POST', path:'/api/para/labs/{id}/verify' }
  ],
  radiology: [
    { from:'ordered',  to:'report', label:'📝 گزارش', perm:'radiology.report', method:'POST', path:'/api/para/radiology/{id}/report', requires:{ findings:'text', impression:'text', criticalFlag:'checkbox' } },
    { from:'reported', to:'verify', label:'✅ تأیید', perm:'radiology.verify', method:'POST', path:'/api/para/radiology/{id}/verify' }
  ],
  blood_requests: [
    { from:'requested',   to:'crossmatch', label:'🧪 کراس‌مچ', perm:'bloodbank.crossmatch', method:'POST', path:'/api/para/blood/{id}/crossmatch', requires:{ donorBloodType:'text' } },
    { from:'crossmatched', to:'issue',     label:'📦 ارسال',   perm:'bloodbank.issue',      method:'POST', path:'/api/para/blood/{id}/issue' },
    { from:'issued',       to:'transfuse', label:'💉 تزریق',   perm:'bloodbank.transfuse',  method:'POST', path:'/api/para/blood/{id}/transfuse', requires:{ secondCheckerId:'text' } }
  ],
  dispenses: [
    { from:'pending_verify', to:'verify',   label:'✅ تأیید', perm:'pharmacy.verify',   method:'POST', path:'/api/para/dispenses/{id}/verify' },
    { from:'verified',       to:'dispense', label:'💊 تحویل', perm:'pharmacy.dispense', method:'POST', path:'/api/para/dispenses/{id}/dispense' }
  ],
  sepsis: [
    { from:['screening','suspected'],       to:'diagnose', label:'🩺 تشخیص', perm:'sepsis.diagnose', method:'POST', path:'/api/safety/sepsis/{id}/diagnose', requires:{ status:'select:confirmed,ruled_out,septic_shock' } },
    { from:['suspected','confirmed','septic_shock'], to:'bundle', label:'⏱️ Bundle', perm:'sepsis.screen', method:'POST', path:'/api/safety/sepsis/{id}/bundle', requires:{ antibiotics:'checkbox', bloodCultures:'checkbox', fluids:'checkbox' } }
  ],
  incidents: [
    { from:'reported', to:'close', label:'✅ بستن', perm:'quality.view', method:'POST', path:'/api/safety/incidents/{id}/close', requires:{ notes:'text' } }
  ],
  risks: [
    { from:'open', to:'mitigate', label:'🛠️ اقدام', perm:'risk.register', method:'POST', path:'/api/safety/risks/{id}/mitigate', requires:{ action:'text', type:'select:corrective,preventive,detective' } }
  ],
  ed_codes: [
    { from:'active', to:'close', label:'🔚 بستن کد', perm:'ed.code.activate', method:'POST', path:'/api/emergency/codes/{id}/close', requires:{ outcome:'text' } }
  ],
  ed_visits: [
    { from:'waiting_triage', to:'triage', label:'🚑 تریاژ', perm:'ed.triage', method:'POST', path:'/api/emergency/visits/{id}/triage', requires:{ esiLevel:'select:1,2,3,4,5' } }
  ],
  crisis_sessions: [
    { from:'active', to:'deactivate', label:'🔚 پایان بحران', perm:'crisis.activate', method:'POST', path:'/api/crisis/{id}/deactivate' }
  ],
  or_schedule: [
    { from:'scheduled',   to:'start', label:'▶️ شروع عمل', perm:'or.checklist', method:'POST', path:'/api/or/schedule/{id}/start' },
    { from:'in_progress', to:'end',   label:'⏹️ پایان',    perm:'or.checklist', method:'POST', path:'/api/or/schedule/{id}/end' }
  ],
  cssd_sets: [
    { from:'sterilized', to:'issue', label:'📤 ارسال', perm:'cssd.manage', method:'POST', path:'/api/cssd/sets/{id}/issue' }
  ],
  cssd_cycles: [
    { from:'running', to:'indicator', label:'🧪 ثبت شاخص', perm:'cssd.manage', method:'POST', path:'/api/cssd/cycles/{id}/indicator', requires:{ type:'select:biological,chemical', result:'select:pass,fail' } }
  ],
  cssd_recalls: [],
  patient_consents: [
    { from:'pending_signature', to:'sign', label:'✍️ امضا', perm:'rights.consent', method:'POST', path:'/api/rights/consents/{id}/sign' }
  ],
  patient_complaints: [
    { from:'open', to:'resolve', label:'✅ حل', perm:'rights.complaint.resolve', method:'POST', path:'/api/rights/complaints/{id}/resolve', requires:{ resolution:'text' } }
  ],
  appeals: [
    { from:'open', to:'review', label:'⚖️ بازبینی', perm:'karanneh.appeal.manage', method:'POST', path:'/api/hr/appeals/{id}/review', requires:{ decision:'select:accept,reject', notes:'text' } }
  ],
  extra_services: [
    { from:'published', to:'claim',    label:'🙋 قبول', perm:'extras.view', method:'POST', path:'/api/hr/extras/{id}/claim' },
    { from:'claimed',   to:'complete', label:'✅ تکمیل', perm:'extras.view', method:'POST', path:'/api/hr/extras/{id}/complete' }
  ],
  coefficients: [
    { from:'draft', to:'approve', label:'✅ تأیید', perm:'karanneh.coefficient.manage', method:'POST', path:'/api/hr/coefficients/{id}/approve' },
    { from:'draft', to:'reject',  label:'❌ رد',   perm:'karanneh.coefficient.manage', method:'POST', path:'/api/hr/coefficients/{id}/reject', requires:{ reason:'text' } }
  ],
  exams: [
    { from:'draft', to:'publish', label:'📢 انتشار', perm:'education.manage', method:'POST', path:'/api/edu/exams/{id}/publish' }
  ],
  kpis: [
    { from:'*', to:'measure', label:'📊 ثبت مقدار', perm:'quality.kpi.manage', method:'POST', path:'/api/q/kpis/{id}/measure', requires:{ value:'text', note:'text' } }
  ],
  pdsa_cycles: [
    { from:'plan',  to:'do',    label:'▶️ اجرا',    perm:'quality.pdsa.manage', method:'POST', path:'/api/q/pdsa/{id}/phase', requires:{ phase:'select:do', notes:'text' } },
    { from:'do',    to:'study', label:'🔬 بررسی',  perm:'quality.pdsa.manage', method:'POST', path:'/api/q/pdsa/{id}/phase', requires:{ phase:'select:study', notes:'text' } },
    { from:'study', to:'act',   label:'⚡ اقدام',  perm:'quality.pdsa.manage', method:'POST', path:'/api/q/pdsa/{id}/phase', requires:{ phase:'select:act', notes:'text' } }
  ],
  rca_reports: [
    { from:'opened', to:'complete', label:'✅ تکمیل RCA', perm:'quality.rca.manage', method:'POST', path:'/api/q/rca/{id}/complete', requires:{ rootCauses:'text', recommendations:'text' } }
  ]
};

// ═══════════════════════════════════════════════════════════
//  Resolver: which actions available for this item?
// ═══════════════════════════════════════════════════════════
function resolveActions(ctx) {
  const coll = ctx.params.coll;
  const id = ctx.params.id;
  const defs = A[coll];
  if (!defs) return { items: [] };

  // Find collection name in store (may differ from A key)
  const collName = coll;
  const item = ctx.store.get(collName, id);
  if (!item) throw ctx.E.notFound('item_not_found');

  const status = item.status;
  const available = [];
  for (const d of defs) {
    // Match status
    const matchStatus = d.from === '*' ||
      (Array.isArray(d.from) ? d.from.includes(status) : d.from === status);
    if (!matchStatus) continue;

    // Check permission
    if (d.perm && !perms.can(ctx.actor.role, d.perm)) continue;

    // Build requires spec
    const requires = {};
    if (d.requires) {
      for (const [k, v] of Object.entries(d.requires)) {
        if (typeof v === 'string' && v.startsWith('select:')) {
          requires[k] = { type: 'select', options: v.slice(7).split(',') };
        } else if (v === 'five_rights') {
          requires[k] = { type: 'five_rights' };
        } else {
          requires[k] = { type: v };
        }
      }
    }
    // MAR: add witnessedBy only if high-alert
    if (coll === 'mar' && d.to === 'administer') {
      if (!item.isHighAlert) delete requires.witnessedBy;
    }

    available.push({
      id: d.to,
      label: d.label,
      method: d.method,
      path: d.path.replace('{id}', id),
      requires: Object.keys(requires).length ? requires : null
    });
  }
  return { items: available, status, collection: coll };
}

module.exports = {
  handlers: { resolveActions },
  routes: [
    { method: 'GET', path: '/api/actions/:coll/:id', handler: 'resolveActions', perm: null }
  ],
  panels: []
};
