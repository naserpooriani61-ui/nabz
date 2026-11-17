const sig=require('../core/signature'),perms=require('../core/permissions');
function h(ctx,c){try{const r=ctx.store.readAll(c);return Array.isArray(r)?r:[]}catch(_){return[]}}
function sd(x){if(!x)return 0;const d=new Date(x);return isNaN(d.getTime())?0:d.getTime()}
function sg(ctx,c,r,a){const s=sig.signAction({userId:ctx.actor.id,action:a,collection:c,recordId:r.id,data:r});ctx.store.put('signatures',s);r.lastSignatureId=s.id;return s}
const list=(c)=>(ctx)=>{let i=perms.scope(ctx.actor,h(ctx,c));
if(ctx.query.status)i=i.filter(x=>x.status===ctx.query.status);
i.sort((a,b)=>sd(b.createdAt||b.requestedAt)-sd(a.createdAt||a.requestedAt));
return{items:i,total:i.length}};

const consultCreate=(ctx)=>{const b=ctx.body;
if(!b.patientId||!b.targetService||!b.question)throw ctx.E.badRequest('missing');
const p=ctx.store.get('patients',b.patientId);if(!p)throw ctx.E.notFound('patient_not_found');
const limits={emergency:30,urgent:120,routine:240};const mins=limits[b.consultType||'routine']||240;
const r={id:ctx.uid('cons'),patientId:p.id,patientName:p.firstName+' '+p.lastName,
wardCode:p.wardCode,bedNumber:p.bedNumber,consultType:b.consultType||'routine',
targetService:b.targetService,question:b.question,isbar:b.isbar||{},status:'requested',
requestedBy:ctx.actor.id,requestedAt:ctx.now(),
responseDueAt:new Date(Date.now()+mins*60000).toISOString()};
require('../core/domain/consult-writer').create(ctx,r);
sg(ctx,'consults',r,'request');return r};

const consultRespond=(ctx)=>{const c=ctx.store.get('consults',ctx.params.id);
if(!c)throw ctx.E.notFound('not_found');
if(c.status!=='requested')throw ctx.E.conflict('not_awaiting');
const b=ctx.body;if(!b.answer)throw ctx.E.badRequest('answer_required');
c.response={answer:b.answer,recommendations:b.recommendations||[],followup:b.followup||'',
requiresAttendingApproval:['resident','intern'].includes(ctx.actor.role)};
c.respondedBy=ctx.actor.id;c.respondedAt=ctx.now();c.status='responded';
require('../core/domain/consult-writer').save(ctx,c,{event:'kardex.consult.respond'});
sg(ctx,'consults',c,'respond');return c};

const consultApprove=(ctx)=>{const c=ctx.store.get('consults',ctx.params.id);
if(!c)throw ctx.E.notFound('not_found');
if(c.status!=='responded')throw ctx.E.conflict('not_responded');
if(c.respondedBy===ctx.actor.id)throw ctx.E.conflict('cannot_approve_own');
require('../core/domain/consult-writer').transition(ctx,ctx.params.id,'approve',{
  fields:{approvedBy:ctx.actor.id,approvedAt:ctx.now()},
  event:'kardex.consult.approve'
});
sg(ctx,'consults',c,'approve');return c};

const transferCreate=(ctx)=>{const b=ctx.body;
if(!b.patientId||!b.toWard||!b.reason)throw ctx.E.badRequest('missing');
const p=ctx.store.get('patients',b.patientId);if(!p)throw ctx.E.notFound('patient_not_found');
if(p.wardCode===b.toWard)throw ctx.E.badRequest('same_ward');
const r={id:ctx.uid('trf'),patientId:p.id,patientName:p.firstName+' '+p.lastName,
fromWard:p.wardCode,fromBedId:p.bedId,toWard:b.toWard,toBedId:null,
reason:b.reason,urgency:b.urgency||'routine',status:'requested',
requestedBy:ctx.actor.id,requestedAt:ctx.now()};
require('../core/domain/transfer-writer').create(ctx,r);ctx.bus.emit('transfer.requested',{record:r,actor:ctx.actor});return r};

const transferAction=(ctx)=>{const t=ctx.store.get('transfers',ctx.params.id);
if(!t)throw ctx.E.notFound('not_found');const a=ctx.params.action;
const flow={requested:'approved',approved:'bed_assigned',bed_assigned:'handover_done',handover_done:'completed'};
const expected={requested:'approve',approved:'assign_bed',bed_assigned:'handover',handover_done:'complete'};
if(!expected[t.status]||expected[t.status]!==a)throw ctx.E.conflict('wrong_action');
if(a==='approve'&&t.requestedBy===ctx.actor.id)throw ctx.E.conflict('cannot_approve_own');
const from=t.status;t.status=flow[t.status];
if(a==='assign_bed'){const bed=ctx.store.get('beds',ctx.body.bedId);
if(!bed||bed.status!=='available'||bed.wardCode!==t.toWard)throw ctx.E.conflict('bed_unavailable');
t.toBedId=bed.id;t.toBedNumber=bed.bedNumber}
if(a==='complete'){const p=ctx.store.get('patients',t.patientId);
if(t.fromBedId){const ob=ctx.store.get('beds',t.fromBedId);if(ob){ob.status='cleaning';ob.patientId=null;ctx.store.put('beds',ob)}}
const nb=ctx.store.get('beds',t.toBedId);
if(nb){nb.status='occupied';nb.patientId=p.id;ctx.store.put('beds',nb)}
p.wardCode=t.toWard;p.bedId=nb.id;p.bedNumber=nb.bedNumber;ctx.store.put('patients',p);
ctx.bus.emit('patients.transferred',{record:p,actor:ctx.actor})}
require('../core/domain/transfer-writer').put(ctx,t);sg(ctx,'transfers',t,a);return t};

const dischargeCreate=(ctx)=>{const b=ctx.body;
if(!b.patientId)throw ctx.E.badRequest('patient_required');
const p=ctx.store.get('patients',b.patientId);if(!p)throw ctx.E.notFound('patient_not_found');
const r={id:ctx.uid('dsc'),patientId:p.id,patientName:p.firstName+' '+p.lastName,
wardCode:p.wardCode,status:'planned',plannedAt:ctx.now(),plannedBy:ctx.actor.id,
dischargeType:b.dischargeType||'home'};
require('../core/domain/discharge-writer').create(ctx,r);return r};

const dischargeAction=(ctx)=>{const d=ctx.store.get('discharges',ctx.params.id);
if(!d)throw ctx.E.notFound('not_found');const b=ctx.body,a=ctx.params.action;
if(a==='summary'){if(!b.finalDiagnosis||!b.medications||!b.followupInstructions)throw ctx.E.badRequest('missing');
d.summary={finalDiagnosis:b.finalDiagnosis,medications:b.medications,followupInstructions:b.followupInstructions};
d.summaryBy=ctx.actor.id;d.summaryAt=ctx.now();d.status='summary_drafted'}
if(a==='approve'){if(d.status!=='summary_drafted')throw ctx.E.conflict('no_summary');
d.status='approved';d.approvedBy=ctx.actor.id;d.approvedAt=ctx.now()}
if(a==='educate'){d.education={completed:true,topics:b.topics||[],teachBack:b.teachBack===true,at:ctx.now()};d.status='education_done'}
if(a==='complete'){d.status='discharged';d.dischargedAt=ctx.now();
const p=ctx.store.get('patients',d.patientId);
if(p){p.status='discharged';p.dischargedAt=ctx.now();
if(p.bedId){const bed=ctx.store.get('beds',p.bedId);if(bed){bed.status='cleaning';bed.patientId=null;ctx.store.put('beds',bed)}}
ctx.store.put('patients',p);ctx.bus.emit('patients.discharged',{record:p,actor:ctx.actor})}}
require('../core/domain/discharge-writer').put(ctx,d);sg(ctx,'discharges',d,a);return d};

const handoverCreate=(ctx)=>{const b=ctx.body;
if(!b.wardCode||!b.shiftType||!Array.isArray(b.entries))throw ctx.E.badRequest('missing');
const r={id:ctx.uid('hnd'),wardCode:b.wardCode,shiftType:b.shiftType,shiftDate:ctx.now(),
fromUser:ctx.actor.id,fromUserName:ctx.actor.username,toUser:null,status:'draft',
entries:b.entries,summary:b.summary||''};
require('../core/domain/handover-writer').create(ctx,r);return r};

const handoverAction=(ctx)=>{const hd=ctx.store.get('handovers',ctx.params.id);
if(!hd)throw ctx.E.notFound('not_found');const a=ctx.params.action;
if(a==='sign'){if(hd.status!=='draft')throw ctx.E.conflict('not_draft');
hd.status='signed';hd.signedAt=ctx.now()}
if(a==='receive'){if(hd.status!=='signed')throw ctx.E.conflict('not_signed');
hd.status='received';hd.receivedAt=ctx.now();hd.toUser=ctx.actor.id;hd.toUserName=ctx.actor.username}
require('../core/domain/handover-writer').put(ctx,hd);sg(ctx,'handovers',hd,a);
ctx.bus.emit('handover.'+a,{record:hd,actor:ctx.actor});return hd};

module.exports={handlers:{consults:list('consults'),consultCreate,consultRespond,consultApprove,
transfers:list('transfers'),transferCreate,transferAction,
discharges:list('discharges'),dischargeCreate,dischargeAction,
handovers:list('handovers'),handoverCreate,handoverAction},
routes:[

    {method:'GET',path:'/api/wf/consults',handler:'consults',perm:'consult.view'},
    {method:'POST',path:'/api/wf/consults',handler:'consultCreate',perm:'consult.request'},
    {method:'GET',path:'/api/wf/transfers',handler:'transfers',perm:'transfer.view'},
    {method:'POST',path:'/api/wf/transfers',handler:'transferCreate',perm:'transfer.request'},
    {method:'GET',path:'/api/wf/discharges',handler:'discharges',perm:'discharge.view'},
    {method:'POST',path:'/api/wf/discharges',handler:'dischargeCreate',perm:'discharge.plan'},
    {method:'GET',path:'/api/wf/handovers',handler:'handovers',perm:'handover.view'},
    {method:'POST',path:'/api/wf/handovers',handler:'handoverCreate',perm:'handover.create'},
    {method:'POST',path:'/api/wf/consults/:id/respond',handler:'consultRespond',perm:'consult.respond'},
    {method:'POST',path:'/api/wf/consults/:id/approve',handler:'consultApprove',perm:'consult.approve'},
    {method:'POST',path:'/api/wf/transfers/:id/:action',handler:'transferAction',perm:'transfer.approve'},
    {method:'POST',path:'/api/wf/discharges/:id/:action',handler:'dischargeAction',perm:'discharge.plan'},
  
{method:'POST',path:'/api/wf/handovers/:id/:action',handler:'handoverAction',perm:'handover.sign'}],
panels:[
{id:'consult',title:'مشاوره',icon:'🩺',perm:'consult.view',kind:'list',api:'/api/wf/consults',fields:['patientName','targetService','consultType','status']},
{id:'transfer',title:'انتقال',icon:'🔄',perm:'transfer.view',kind:'list',api:'/api/wf/transfers',fields:['patientName','fromWard','toWard','status']},
{id:'discharge',title:'ترخیص',icon:'🚪',perm:'discharge.view',kind:'list',api:'/api/wf/discharges',fields:['patientName','dischargeType','status']},
{id:'handover',title:'تحویل',icon:'📝',perm:'handover.view',kind:'list',api:'/api/wf/handovers',fields:['wardCode','shiftType','fromUserName','status']}]};
