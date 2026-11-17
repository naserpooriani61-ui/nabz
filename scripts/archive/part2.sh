
# ═══════════════════════════════════════════════════════════════
#  part2.sh — NABZ Part 2
# ═══════════════════════════════════════════════════════════════

# ─── 1) modules/workflow.js ───
cat > modules/workflow.js << 'EOF'
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
ctx.store.put('consults',r);sg(ctx,'consults',r,'request');
ctx.bus.emit('consult.requested',{record:r,actor:ctx.actor});return r};

const consultRespond=(ctx)=>{const c=ctx.store.get('consults',ctx.params.id);
if(!c)throw ctx.E.notFound('not_found');
if(c.status!=='requested')throw ctx.E.conflict('not_awaiting');
const b=ctx.body;if(!b.answer)throw ctx.E.badRequest('answer_required');
c.response={answer:b.answer,recommendations:b.recommendations||[],followup:b.followup||'',
requiresAttendingApproval:['resident','intern'].includes(ctx.actor.role)};
c.respondedBy=ctx.actor.id;c.respondedAt=ctx.now();c.status='responded';
ctx.store.put('consults',c);sg(ctx,'consults',c,'respond');
ctx.bus.emit('consult.responded',{record:c,actor:ctx.actor});return c};

const consultApprove=(ctx)=>{const c=ctx.store.get('consults',ctx.params.id);
if(!c)throw ctx.E.notFound('not_found');
if(c.status!=='responded')throw ctx.E.conflict('not_responded');
if(c.respondedBy===ctx.actor.id)throw ctx.E.conflict('cannot_approve_own');
c.status='approved';c.approvedBy=ctx.actor.id;c.approvedAt=ctx.now();
ctx.store.put('consults',c);sg(ctx,'consults',c,'approve');return c};

const transferCreate=(ctx)=>{const b=ctx.body;
if(!b.patientId||!b.toWard||!b.reason)throw ctx.E.badRequest('missing');
const p=ctx.store.get('patients',b.patientId);if(!p)throw ctx.E.notFound('patient_not_found');
if(p.wardCode===b.toWard)throw ctx.E.badRequest('same_ward');
const r={id:ctx.uid('trf'),patientId:p.id,patientName:p.firstName+' '+p.lastName,
fromWard:p.wardCode,fromBedId:p.bedId,toWard:b.toWard,toBedId:null,
reason:b.reason,urgency:b.urgency||'routine',status:'requested',
requestedBy:ctx.actor.id,requestedAt:ctx.now()};
ctx.store.put('transfers',r);ctx.bus.emit('transfer.requested',{record:r,actor:ctx.actor});return r};

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
ctx.store.put('transfers',t);sg(ctx,'transfers',t,a);return t};

const dischargeCreate=(ctx)=>{const b=ctx.body;
if(!b.patientId)throw ctx.E.badRequest('patient_required');
const p=ctx.store.get('patients',b.patientId);if(!p)throw ctx.E.notFound('patient_not_found');
const r={id:ctx.uid('dsc'),patientId:p.id,patientName:p.firstName+' '+p.lastName,
wardCode:p.wardCode,status:'planned',plannedAt:ctx.now(),plannedBy:ctx.actor.id,
dischargeType:b.dischargeType||'home'};
ctx.store.put('discharges',r);return r};

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
ctx.store.put('discharges',d);sg(ctx,'discharges',d,a);return d};

const handoverCreate=(ctx)=>{const b=ctx.body;
if(!b.wardCode||!b.shiftType||!Array.isArray(b.entries))throw ctx.E.badRequest('missing');
const r={id:ctx.uid('hnd'),wardCode:b.wardCode,shiftType:b.shiftType,shiftDate:ctx.now(),
fromUser:ctx.actor.id,fromUserName:ctx.actor.username,toUser:null,status:'draft',
entries:b.entries,summary:b.summary||''};
ctx.store.put('handovers',r);return r};

const handoverAction=(ctx)=>{const hd=ctx.store.get('handovers',ctx.params.id);
if(!hd)throw ctx.E.notFound('not_found');const a=ctx.params.action;
if(a==='sign'){if(hd.status!=='draft')throw ctx.E.conflict('not_draft');
hd.status='signed';hd.signedAt=ctx.now()}
if(a==='receive'){if(hd.status!=='signed')throw ctx.E.conflict('not_signed');
hd.status='received';hd.receivedAt=ctx.now();hd.toUser=ctx.actor.id;hd.toUserName=ctx.actor.username}
ctx.store.put('handovers',hd);sg(ctx,'handovers',hd,a);
ctx.bus.emit('handover.'+a,{record:hd,actor:ctx.actor});return hd};

module.exports={handlers:{consults:list('consults'),consultCreate,consultRespond,consultApprove,
transfers:list('transfers'),transferCreate,transferAction,
discharges:list('discharges'),dischargeCreate,dischargeAction,
handovers:list('handovers'),handoverCreate,handoverAction},
routes:[
{method:'GET',path:'/api/wf/consults',handler:'consults',perm:'consult.view'},
{method:'POST',path:'/api/wf/consults',handler:'consultCreate',perm:'consult.request'},
{method:'POST',path:'/api/wf/consults/:id/respond',handler:'consultRespond',perm:'consult.respond'},
{method:'POST',path:'/api/wf/consults/:id/approve',handler:'consultApprove',perm:'consult.approve'},
{method:'GET',path:'/api/wf/transfers',handler:'transfers',perm:'transfer.view'},
{method:'POST',path:'/api/wf/transfers',handler:'transferCreate',perm:'transfer.request'},
{method:'POST',path:'/api/wf/transfers/:id/:action',handler:'transferAction',perm:'transfer.approve'},
{method:'GET',path:'/api/wf/discharges',handler:'discharges',perm:'discharge.view'},
{method:'POST',path:'/api/wf/discharges',handler:'dischargeCreate',perm:'discharge.plan'},
{method:'POST',path:'/api/wf/discharges/:id/:action',handler:'dischargeAction',perm:'discharge.plan'},
{method:'GET',path:'/api/wf/handovers',handler:'handovers',perm:'handover.view'},
{method:'POST',path:'/api/wf/handovers',handler:'handoverCreate',perm:'handover.create'},
{method:'POST',path:'/api/wf/handovers/:id/:action',handler:'handoverAction',perm:'handover.sign'}],
panels:[
{id:'consult',title:'مشاوره',icon:'🩺',perm:'consult.view',kind:'list',api:'/api/wf/consults',fields:['patientName','targetService','consultType','status']},
{id:'transfer',title:'انتقال',icon:'🔄',perm:'transfer.view',kind:'list',api:'/api/wf/transfers',fields:['patientName','fromWard','toWard','status']},
{id:'discharge',title:'ترخیص',icon:'🚪',perm:'discharge.view',kind:'list',api:'/api/wf/discharges',fields:['patientName','dischargeType','status']},
{id:'handover',title:'تحویل',icon:'📝',perm:'handover.view',kind:'list',api:'/api/wf/handovers',fields:['wardCode','shiftType','fromUserName','status']}]};
EOF

# ─── 2) modules/paraclinical.js ───
cat > modules/paraclinical.js << 'EOF'
const sig=require('../core/signature'),perms=require('../core/permissions');
function h(ctx,c){try{const r=ctx.store.readAll(c);return Array.isArray(r)?r:[]}catch(_){return[]}}
function sd(x){if(!x)return 0;const d=new Date(x);return isNaN(d.getTime())?0:d.getTime()}
function sg(ctx,c,r,a){const s=sig.signAction({userId:ctx.actor.id,action:a,collection:c,recordId:r.id,data:r});ctx.store.put('signatures',s);r.lastSignatureId=s.id;return s}
const list=(c)=>(ctx)=>{let i=perms.scope(ctx.actor,h(ctx,c));
if(ctx.query.status)i=i.filter(x=>x.status===ctx.query.status);
i.sort((a,b)=>sd(b.createdAt||b.orderedAt)-sd(a.createdAt||a.orderedAt));
return{items:i,total:i.length}};

// ─── Lab ───
const labOrder=(ctx)=>{const b=ctx.body;
if(!b.patientId||!b.panelCode)throw ctx.E.badRequest('missing');
const p=ctx.store.get('patients',b.patientId);if(!p)throw ctx.E.notFound('not_found');
const r={id:ctx.uid('lab'),patientId:p.id,patientName:p.firstName+' '+p.lastName,
wardCode:p.wardCode,panelCode:b.panelCode,panelName:b.panelName||b.panelCode,
priority:b.priority||'routine',status:'ordered',orderedBy:ctx.actor.id,orderedAt:ctx.now(),
tests:b.tests||[],criticalFlags:[]};
ctx.store.put('labs',r);sg(ctx,'labs',r,'order');
ctx.bus.emit('lab.ordered',{record:r,actor:ctx.actor});return r};
const labCollect=(ctx)=>{const l=ctx.store.get('labs',ctx.params.id);
if(!l)throw ctx.E.notFound('not_found');
if(l.status!=='ordered')throw ctx.E.conflict('already_collected');
l.status='collected';l.collectedBy=ctx.actor.id;l.collectedAt=ctx.now();
ctx.store.put('labs',l);sg(ctx,'labs',l,'collect');return l};
const labResult=(ctx)=>{const l=ctx.store.get('labs',ctx.params.id);
if(!l)throw ctx.E.notFound('not_found');
if(l.status!=='collected')throw ctx.E.conflict('not_collected');
l.status='resulted';l.resultedBy=ctx.actor.id;l.resultedAt=ctx.now();
l.results=ctx.body.values||{};
// Critical detection
const criticals=[];for(const t of l.tests){
const v=l.results[t.code];if(v==null)continue;
if(t.critLow!=null&&v<t.critLow)criticals.push({test:t.code,value:v,type:'low'});
if(t.critHigh!=null&&v>t.critHigh)criticals.push({test:t.code,value:v,type:'high'})}
l.criticalFlags=criticals;ctx.store.put('labs',l);sg(ctx,'labs',l,'result');
if(criticals.length)ctx.bus.emit('lab.critical',{record:l,criticals,actor:ctx.actor});return l};
const labVerify=(ctx)=>{const l=ctx.store.get('labs',ctx.params.id);
if(!l)throw ctx.E.notFound('not_found');
if(l.status!=='resulted')throw ctx.E.conflict('not_resulted');
l.status='verified';l.verifiedBy=ctx.actor.id;l.verifiedAt=ctx.now();
ctx.store.put('labs',l);sg(ctx,'labs',l,'verify');return l};

// ─── Radiology ───
const radOrder=(ctx)=>{const b=ctx.body;
if(!b.patientId||!b.modality||!b.bodyPart)throw ctx.E.badRequest('missing');
const p=ctx.store.get('patients',b.patientId);if(!p)throw ctx.E.notFound('not_found');
const r={id:ctx.uid('rad'),patientId:p.id,patientName:p.firstName+' '+p.lastName,
wardCode:p.wardCode,modality:b.modality,bodyPart:b.bodyPart,
indication:b.indication||'',priority:b.priority||'routine',status:'ordered',
orderedBy:ctx.actor.id,orderedAt:ctx.now(),criticalFlag:false};
ctx.store.put('radiology',r);return r};
const radReport=(ctx)=>{const r=ctx.store.get('radiology',ctx.params.id);
if(!r)throw ctx.E.notFound('not_found');const b=ctx.body;
r.findings=b.findings||'';r.impression=b.impression||'';
r.criticalFlag=b.criticalFlag===true;r.criticalType=b.criticalType||null;
r.status='reported';r.reportedBy=ctx.actor.id;r.reportedAt=ctx.now();
ctx.store.put('radiology',r);sg(ctx,'radiology',r,'report');
if(r.criticalFlag)ctx.bus.emit('radiology.critical',{record:r,actor:ctx.actor});return r};
const radVerify=(ctx)=>{const r=ctx.store.get('radiology',ctx.params.id);
if(!r)throw ctx.E.notFound('not_found');
if(r.status!=='reported')throw ctx.E.conflict('not_reported');
r.status='verified';r.verifiedBy=ctx.actor.id;r.verifiedAt=ctx.now();
ctx.store.put('radiology',r);return r};

// ─── Blood Bank ───
const bloodRequest=(ctx)=>{const b=ctx.body;
if(!b.patientId||!b.productType||!b.units)throw ctx.E.badRequest('missing');
const p=ctx.store.get('patients',b.patientId);if(!p)throw ctx.E.notFound('not_found');
const r={id:ctx.uid('bl'),patientId:p.id,patientName:p.firstName+' '+p.lastName,
wardCode:p.wardCode,productType:b.productType,units:b.units,
priority:b.priority||'routine',status:'requested',requestedBy:ctx.actor.id,requestedAt:ctx.now()};
ctx.store.put('blood_requests',r);sg(ctx,'blood_requests',r,'request');return r};
const bloodCrossmatch=(ctx)=>{const r=ctx.store.get('blood_requests',ctx.params.id);
if(!r)throw ctx.E.notFound('not_found');
if(r.status!=='requested')throw ctx.E.conflict('not_requested');
const b=ctx.body;
if(!b.donorBloodType)throw ctx.E.badRequest('donor_required');
// Simplified compatibility
r.status='crossmatched';r.crossmatch={donor:b.donorBloodType,result:'compatible',at:ctx.now()};
r.crossmatchedBy=ctx.actor.id;r.crossmatchedAt=ctx.now();
ctx.store.put('blood_requests',r);sg(ctx,'blood_requests',r,'crossmatch');return r};
const bloodIssue=(ctx)=>{const r=ctx.store.get('blood_requests',ctx.params.id);
if(!r)throw ctx.E.notFound('not_found');
if(r.status!=='crossmatched')throw ctx.E.conflict('not_crossmatched');
r.status='issued';r.issuedBy=ctx.actor.id;r.issuedAt=ctx.now();
ctx.store.put('blood_requests',r);return r};
const bloodTransfuse=(ctx)=>{const r=ctx.store.get('blood_requests',ctx.params.id);
if(!r)throw ctx.E.notFound('not_found');
if(r.status!=='issued')throw ctx.E.conflict('not_issued');
if(!ctx.body.secondCheckerId||ctx.body.secondCheckerId===ctx.actor.id)
throw ctx.E.badRequest('two_person_required');
r.status='transfused';r.transfusedBy=ctx.actor.id;r.transfusedAt=ctx.now();
r.secondChecker=ctx.body.secondCheckerId;
ctx.store.put('blood_requests',r);sg(ctx,'blood_requests',r,'transfuse');return r};

// ─── Pharmacy ───
const dispenseVerify=(ctx)=>{const d=ctx.store.get('dispenses',ctx.params.id);
if(!d)throw ctx.E.notFound('not_found');
if(d.status!=='pending_verify')throw ctx.E.conflict('not_pending');
d.status='verified';d.verifiedBy=ctx.actor.id;d.verifiedAt=ctx.now();
ctx.store.put('dispenses',d);sg(ctx,'dispenses',d,'verify');return d};
const dispenseIssue=(ctx)=>{const d=ctx.store.get('dispenses',ctx.params.id);
if(!d)throw ctx.E.notFound('not_found');
if(d.status!=='verified')throw ctx.E.conflict('not_verified');
d.status='dispensed';d.dispensedBy=ctx.actor.id;d.dispensedAt=ctx.now();
ctx.store.put('dispenses',d);sg(ctx,'dispenses',d,'dispense');return d};

module.exports={handlers:{labs:list('labs'),labOrder,labCollect,labResult,labVerify,
radiology:list('radiology'),radOrder,radReport,radVerify,
blood:list('blood_requests'),bloodRequest,bloodCrossmatch,bloodIssue,bloodTransfuse,
dispenses:list('dispenses'),dispenseVerify,dispenseIssue},
routes:[
{method:'GET',path:'/api/para/labs',handler:'labs',perm:'lab.view'},
{method:'POST',path:'/api/para/labs',handler:'labOrder',perm:'lab.order'},
{method:'POST',path:'/api/para/labs/:id/collect',handler:'labCollect',perm:'lab.collect'},
{method:'POST',path:'/api/para/labs/:id/result',handler:'labResult',perm:'lab.result'},
{method:'POST',path:'/api/para/labs/:id/verify',handler:'labVerify',perm:'lab.verify'},
{method:'GET',path:'/api/para/radiology',handler:'radiology',perm:'radiology.view'},
{method:'POST',path:'/api/para/radiology',handler:'radOrder',perm:'radiology.order'},
{method:'POST',path:'/api/para/radiology/:id/report',handler:'radReport',perm:'radiology.report'},
{method:'POST',path:'/api/para/radiology/:id/verify',handler:'radVerify',perm:'radiology.verify'},
{method:'GET',path:'/api/para/blood',handler:'blood',perm:'bloodbank.view'},
{method:'POST',path:'/api/para/blood',handler:'bloodRequest',perm:'bloodbank.request'},
{method:'POST',path:'/api/para/blood/:id/crossmatch',handler:'bloodCrossmatch',perm:'bloodbank.crossmatch'},
{method:'POST',path:'/api/para/blood/:id/issue',handler:'bloodIssue',perm:'bloodbank.issue'},
{method:'POST',path:'/api/para/blood/:id/transfuse',handler:'bloodTransfuse',perm:'bloodbank.transfuse'},
{method:'GET',path:'/api/para/dispenses',handler:'dispenses',perm:'pharmacy.view'},
{method:'POST',path:'/api/para/dispenses/:id/verify',handler:'dispenseVerify',perm:'pharmacy.verify'},
{method:'POST',path:'/api/para/dispenses/:id/dispense',handler:'dispenseIssue',perm:'pharmacy.dispense'}],
panels:[
{id:'labs',title:'آزمایشگاه',icon:'🧪',perm:'lab.view',kind:'list',api:'/api/para/labs',fields:['patientName','panelName','priority','status']},
{id:'radiology',title:'تصویربرداری',icon:'🩻',perm:'radiology.view',kind:'list',api:'/api/para/radiology',fields:['patientName','modality','bodyPart','status']},
{id:'blood',title:'بانک خون',icon:'🩸',perm:'bloodbank.view',kind:'list',api:'/api/para/blood',fields:['patientName','productType','units','status']},
{id:'dispenses',title:'داروخانه',icon:'💊',perm:'pharmacy.view',kind:'list',api:'/api/para/dispenses',fields:['drugName','patientName','status']}]};
EOF

# ─── 3) modules/safety.js ───
cat > modules/safety.js << 'EOF'
const sig=require('../core/signature'),perms=require('../core/permissions');
function h(ctx,c){try{const r=ctx.store.readAll(c);return Array.isArray(r)?r:[]}catch(_){return[]}}
function sd(x){if(!x)return 0;const d=new Date(x);return isNaN(d.getTime())?0:d.getTime()}
function sg(ctx,c,r,a){const s=sig.signAction({userId:ctx.actor.id,action:a,collection:c,recordId:r.id,data:r});ctx.store.put('signatures',s);r.lastSignatureId=s.id;return s}
const list=(c)=>(ctx)=>{let i=perms.scope(ctx.actor,h(ctx,c));
if(ctx.query.status)i=i.filter(x=>x.status===ctx.query.status);
i.sort((a,b)=>sd(b.createdAt||b.reportedAt)-sd(a.createdAt||a.reportedAt));
return{items:i,total:i.length}};

// ─── Sepsis ───
const sepsisScreen=(ctx)=>{const b=ctx.body;
if(!b.patientId)throw ctx.E.badRequest('patient_required');
const p=ctx.store.get('patients',b.patientId);if(!p)throw ctx.E.notFound('not_found');
const v=b.vitals||{};
let q=0;if(v.rr>=22)q++;if(v.bp_sys<=100)q++;if(v.gcs!=null&&v.gcs<=13)q++;
const r={id:ctx.uid('sep'),patientId:p.id,patientName:p.firstName+' '+p.lastName,
wardCode:p.wardCode,qsofa:{score:q},lactate:b.lactate||null,
infectionSource:b.infectionSource||null,status:q>=2?'suspected':'screening',
screenedAt:ctx.now(),screenedBy:ctx.actor.id,
bundle:{startAt:ctx.now(),lactateMeasured:!!b.lactate,bloodCultures:false,antibiotics:false,fluids:false}};
ctx.store.put('sepsis',r);sg(ctx,'sepsis',r,'screen');
if(q>=2)ctx.bus.emit('sepsis.suspected',{record:r,actor:ctx.actor});return r};
const sepsisDiagnose=(ctx)=>{const s=ctx.store.get('sepsis',ctx.params.id);
if(!s)throw ctx.E.notFound('not_found');
const st=ctx.body.status||'confirmed';
if(!['confirmed','ruled_out','septic_shock'].includes(st))throw ctx.E.badRequest('invalid');
s.status=st;s.diagnosedBy=ctx.actor.id;s.diagnosedAt=ctx.now();
ctx.store.put('sepsis',s);sg(ctx,'sepsis',s,'diagnose');return s};
const sepsisBundle=(ctx)=>{const s=ctx.store.get('sepsis',ctx.params.id);
if(!s)throw ctx.E.notFound('not_found');const b=ctx.body;
if(b.lactate!=null)s.bundle.lactateMeasured=true;
if(b.bloodCultures)s.bundle.bloodCultures=true;
if(b.antibiotics)s.bundle.antibiotics=true;
if(b.fluids)s.bundle.fluids=true;
if(['lactateMeasured','bloodCultures','antibiotics'].every(k=>s.bundle[k]))s.bundle.completedAt=ctx.now();
ctx.store.put('sepsis',s);sg(ctx,'sepsis',s,'bundle');return s};

// ─── Infection ───
const infectionReport=(ctx)=>{const b=ctx.body;
if(!b.patientId||!b.type)throw ctx.E.badRequest('missing');
const p=ctx.store.get('patients',b.patientId);if(!p)throw ctx.E.notFound('not_found');
const r={id:ctx.uid('inf'),patientId:p.id,patientName:p.firstName+' '+p.lastName,
wardCode:p.wardCode,type:b.type,pathogen:b.pathogen||null,
cultureConfirmed:b.cultureConfirmed===true,status:'confirmed',
reportedBy:ctx.actor.id,reportedAt:ctx.now()};
ctx.store.put('infections',r);sg(ctx,'infections',r,'report');
ctx.bus.emit('infection.reported',{record:r,actor:ctx.actor});return r};
const isolationCreate=(ctx)=>{const b=ctx.body;
if(!b.patientId||!b.type)throw ctx.E.badRequest('missing');
const p=ctx.store.get('patients',b.patientId);if(!p)throw ctx.E.notFound('not_found');
const r={id:ctx.uid('iso'),patientId:p.id,patientName:p.firstName+' '+p.lastName,
wardCode:p.wardCode,bedNumber:p.bedNumber,type:b.type,reason:b.reason||'',
requiresNegativePressure:b.type==='airborne',
negativePressureVerified:b.negativePressureVerified===true,
status:'active',startedBy:ctx.actor.id,startedAt:ctx.now()};
ctx.store.put('isolations',r);return r};

// ─── Quality Incident ───
const incidentReport=(ctx)=>{const b=ctx.body;
if(!b.category||!b.description||!b.severity)throw ctx.E.badRequest('missing');
const weights={near_miss:1,no_harm:2,mild_harm:3,moderate_harm:4,severe_harm:5,sentinel:6};
const r={id:ctx.uid('inc'),category:b.category,severity:b.severity,
severityWeight:weights[b.severity]||1,
requiresRca:(weights[b.severity]||1)>=4,
description:b.description,patientId:b.patientId||null,patientName:b.patientName||null,
wardCode:b.wardCode||ctx.actor.ward||null,
occurredAt:b.occurredAt||ctx.now(),reportedAt:ctx.now(),
reportedBy:ctx.actor.id,reportedByName:ctx.actor.username,
immediateAction:b.immediateAction||'',status:'reported'};
ctx.store.put('incidents',r);sg(ctx,'incidents',r,'report');
if(r.requiresRca)ctx.bus.emit('quality.rca_required',{record:r,actor:ctx.actor});
return r};
const incidentClose=(ctx)=>{const i=ctx.store.get('incidents',ctx.params.id);
if(!i)throw ctx.E.notFound('not_found');
if(!ctx.body.notes)throw ctx.E.badRequest('notes_required');
i.status='closed';i.closedAt=ctx.now();i.closedBy=ctx.actor.id;i.closureNotes=ctx.body.notes;
ctx.store.put('incidents',i);return i};

// ─── Risk Register ───
const riskRegister=(ctx)=>{const b=ctx.body;
if(!b.title||!b.likelihood||!b.severity)throw ctx.E.badRequest('missing');
const l=Number(b.likelihood),s=Number(b.severity);
const score=l*s;const level=score>=15?'extreme':score>=9?'high':score>=4?'medium':'low';
const r={id:ctx.uid('rsk'),title:b.title,description:b.description||'',
category:b.category||'clinical',wardCode:b.wardCode||ctx.actor.ward||null,
likelihood:l,severity:s,riskScore:score,level,status:'open',
identifiedBy:ctx.actor.id,identifiedAt:ctx.now(),mitigations:[]};
ctx.store.put('risks',r);sg(ctx,'risks',r,'register');return r};
const riskMitigate=(ctx)=>{const r=ctx.store.get('risks',ctx.params.id);
if(!r)throw ctx.E.notFound('not_found');
const b=ctx.body;if(!b.action)throw ctx.E.badRequest('action_required');
r.mitigations.push({action:b.action,owner:ctx.actor.id,
type:b.type||'corrective',status:'open',at:ctx.now()});
ctx.store.put('risks',r);return r};

module.exports={handlers:{sepsis:list('sepsis'),sepsisScreen,sepsisDiagnose,sepsisBundle,
infections:list('infections'),infectionReport,
isolations:list('isolations'),isolationCreate,
incidents:list('incidents'),incidentReport,incidentClose,
risks:list('risks'),riskRegister,riskMitigate},
routes:[
{method:'GET',path:'/api/safety/sepsis',handler:'sepsis',perm:'sepsis.view'},
{method:'POST',path:'/api/safety/sepsis',handler:'sepsisScreen',perm:'sepsis.screen'},
{method:'POST',path:'/api/safety/sepsis/:id/diagnose',handler:'sepsisDiagnose',perm:'sepsis.diagnose'},
{method:'POST',path:'/api/safety/sepsis/:id/bundle',handler:'sepsisBundle',perm:'sepsis.screen'},
{method:'GET',path:'/api/safety/infections',handler:'infections',perm:'infection.view'},
{method:'POST',path:'/api/safety/infections',handler:'infectionReport',perm:'infection.report'},
{method:'GET',path:'/api/safety/isolations',handler:'isolations',perm:'infection.view'},
{method:'POST',path:'/api/safety/isolations',handler:'isolationCreate',perm:'infection.isolation'},
{method:'GET',path:'/api/safety/incidents',handler:'incidents',perm:'quality.view'},
{method:'POST',path:'/api/safety/incidents',handler:'incidentReport',perm:'quality.incident.report'},
{method:'POST',path:'/api/safety/incidents/:id/close',handler:'incidentClose',perm:'quality.view'},
{method:'GET',path:'/api/safety/risks',handler:'risks',perm:'risk.view'},
{method:'POST',path:'/api/safety/risks',handler:'riskRegister',perm:'risk.register'},
{method:'POST',path:'/api/safety/risks/:id/mitigate',handler:'riskMitigate',perm:'risk.register'}],
panels:[
{id:'sepsis',title:'سپسیس',icon:'🦠',perm:'sepsis.view',kind:'list',api:'/api/safety/sepsis',fields:['patientName','status','lactate']},
{id:'infections',title:'عفونت',icon:'🧫',perm:'infection.view',kind:'list',api:'/api/safety/infections',fields:['patientName','type','pathogen','status']},
{id:'incidents',title:'حوادث',icon:'⭐',perm:'quality.view',kind:'list',api:'/api/safety/incidents',fields:['category','severity','description','status']},
{id:'risks',title:'ریسک',icon:'⚠️',perm:'risk.view',kind:'list',api:'/api/safety/risks',fields:['title','category','level','status']}]};
EOF

# ─── 4) modules/ops.js ───
cat > modules/ops.js << 'EOF'
const sig=require('../core/signature'),perms=require('../core/permissions');
function h(ctx,c){try{const r=ctx.store.readAll(c);return Array.isArray(r)?r:[]}catch(_){return[]}}
function sd(x){if(!x)return 0;const d=new Date(x);return isNaN(d.getTime())?0:d.getTime()}
const list=(c)=>(ctx)=>{let i=perms.scope(ctx.actor,h(ctx,c));
if(ctx.query.status)i=i.filter(x=>x.status===ctx.query.status);
i.sort((a,b)=>sd(b.createdAt)-sd(a.createdAt));
return{items:i,total:i.length}};

// ─── Shift Roster ───
const rosterCreate=(ctx)=>{const b=ctx.body;
if(!b.wardCode||!b.month)throw ctx.E.badRequest('missing');
const r={id:ctx.uid('ros'),wardCode:b.wardCode,month:b.month,
assignments:b.assignments||{},status:'draft',createdBy:ctx.actor.id,createdAt:ctx.now()};
ctx.store.put('rosters',r);return r};
const rosterApprove=(ctx)=>{const r=ctx.store.get('rosters',ctx.params.id);
if(!r)throw ctx.E.notFound('not_found');
r.status='approved';r.approvedBy=ctx.actor.id;r.approvedAt=ctx.now();
ctx.store.put('rosters',r);ctx.bus.emit('shift.roster.approved',{record:r,actor:ctx.actor});return r};

// ─── Workforce Check-in ───
const checkIn=(ctx)=>{const today=new Date().toISOString().slice(0,10);
const existing=h(ctx,'attendance').find(a=>a.userId===ctx.actor.id&&a.date===today);
if(existing&&existing.checkIn)throw ctx.E.conflict('already_checked_in');
const r=existing||{id:ctx.uid('att'),userId:ctx.actor.id,userName:ctx.actor.username,
wardCode:ctx.actor.ward,date:today,checkIn:null,checkOut:null};
r.checkIn=ctx.now();ctx.store.put('attendance',r);
ctx.bus.emit('workforce.checkin',{record:r,actor:ctx.actor});return r};
const checkOut=(ctx)=>{const today=new Date().toISOString().slice(0,10);
const r=h(ctx,'attendance').find(a=>a.userId===ctx.actor.id&&a.date===today);
if(!r||!r.checkIn)throw ctx.E.badRequest('no_checkin');
if(r.checkOut)throw ctx.E.conflict('already_checked_out');
r.checkOut=ctx.now();r.workedHours=Math.round((sd(r.checkOut)-sd(r.checkIn))/360000)/10;
ctx.store.put('attendance',r);return r};
const attendanceToday=(ctx)=>{const today=new Date().toISOString().slice(0,10);
let i=h(ctx,'attendance').filter(a=>a.date===today);
return{items:i,total:i.length,present:i.filter(a=>a.checkIn&&!a.checkOut).length}};

// ─── Karanneh Period ───
const karannehCreate=(ctx)=>{const b=ctx.body;
if(!b.year||!b.month)throw ctx.E.badRequest('missing');
const r={id:ctx.uid('kper'),year:b.year,month:b.month,status:'open',
totalRevenue:0,totalPoints:0,valuePerPoint:0,createdBy:ctx.actor.id,createdAt:ctx.now()};
ctx.store.put('karanneh_periods',r);return r};
const karannehCalc=(ctx)=>{const p=ctx.store.get('karanneh_periods',ctx.params.id);
if(!p)throw ctx.E.notFound('not_found');
if(p.status==='finalized')throw ctx.E.conflict('finalized');
const staff=h(ctx,'wf_staff');const att=h(ctx,'attendance');
const results=staff.map(s=>{
const myAtt=att.filter(a=>a.userId===s.id);
const hours=myAtt.reduce((sum,a)=>sum+(a.workedHours||0),0);
const points=Math.round(hours*100)/100;
return{staffId:s.id,staffName:s.fullName,wardCode:s.ward,hours,points}});
const totalPoints=results.reduce((s,r)=>s+r.points,0);
p.totalPoints=Math.round(totalPoints*100)/100;
p.valuePerPoint=totalPoints?Math.round(p.totalRevenue/totalPoints*100)/100:0;
p.status='calculated';p.calculatedAt=ctx.now();p.calculatedBy=ctx.actor.id;
ctx.store.put('karanneh_periods',p);
for(const r of results)ctx.store.put('karanneh_calcs',{...r,periodId:p.id});
return{period:p,count:results.length,totalPoints}};
const karannehFinalize=(ctx)=>{const p=ctx.store.get('karanneh_periods',ctx.params.id);
if(!p)throw ctx.E.notFound('not_found');
if(p.status!=='calculated')throw ctx.E.conflict('must_calculate_first');
p.status='finalized';p.finalizedBy=ctx.actor.id;p.finalizedAt=ctx.now();
ctx.store.put('karanneh_periods',p);return p};

module.exports={handlers:{rosters:list('rosters'),rosterCreate,rosterApprove,
attendanceToday,checkIn,checkOut,
periods:list('karanneh_periods'),karannehCreate,karannehCalc,karannehFinalize,
staff:list('wf_staff')},
routes:[
{method:'GET',path:'/api/ops/rosters',handler:'rosters',perm:'shift.view'},
{method:'POST',path:'/api/ops/rosters',handler:'rosterCreate',perm:'shift.manage'},
{method:'POST',path:'/api/ops/rosters/:id/approve',handler:'rosterApprove',perm:'shift.manage'},
{method:'GET',path:'/api/ops/attendance',handler:'attendanceToday',perm:'workforce.view'},
{method:'POST',path:'/api/ops/attendance/checkin',handler:'checkIn',perm:'workforce.checkin'},
{method:'POST',path:'/api/ops/attendance/checkout',handler:'checkOut',perm:'workforce.checkin'},
{method:'GET',path:'/api/ops/periods',handler:'periods',perm:'karanneh.view'},
{method:'POST',path:'/api/ops/periods',handler:'karannehCreate',perm:'karanneh.manage'},
{method:'POST',path:'/api/ops/periods/:id/calculate',handler:'karannehCalc',perm:'karanneh.manage'},
{method:'POST',path:'/api/ops/periods/:id/finalize',handler:'karannehFinalize',perm:'karanneh.manage'},
{method:'GET',path:'/api/ops/staff',handler:'staff',perm:'workforce.view'}],
panels:[
{id:'rosters',title:'شیفت‌ها',icon:'📅',perm:'shift.view',kind:'list',api:'/api/ops/rosters',fields:['wardCode','month','status']},
{id:'attendance',title:'حضور امروز',icon:'✓',perm:'workforce.view',kind:'stats',api:'/api/ops/attendance'},
{id:'periods',title:'کارانه',icon:'💰',perm:'karanneh.view',kind:'list',api:'/api/ops/periods',fields:['year','month','totalPoints','status']},
{id:'staff',title:'پرسنل',icon:'👥',perm:'workforce.view',kind:'list',api:'/api/ops/staff',fields:['fullName','role','ward']}]};
EOF

# ─── 5) core/seed.js — نمونه داده برای دیدن UI ───
cat > core/seed.js << 'EOF'
const store=require('./store');
function seed(){
if(store.readAll('beds').length>0)return;
const wards=[{code:'ICU',beds:10},{code:'ER',beds:5},{code:'GEN',beds:5}];
for(const w of wards)for(let i=1;i<=w.beds;i++)
store.put('beds',{id:'bed_'+w.code+'_'+i,wardCode:w.code,
bedNumber:w.code+'-'+String(i).padStart(2,'0'),status:'available',patientId:null});
const pts=[
{fn:'علی',ln:'رضایی',age:65,sex:'male',dx:'STEMI',com:['HTN','DM'],al:['Penicillin']},
{fn:'مریم',ln:'احمدی',age:45,sex:'female',dx:'پنومونی',com:['Asthma'],al:[]},
{fn:'حسن',ln:'کریمی',age:72,sex:'male',dx:'سپسیس',com:['CKD'],al:['Sulfa']},
{fn:'زهرا',ln:'موسوی',age:30,sex:'female',dx:'آپاندیسیت',com:[],al:[]},
{fn:'رضا',ln:'نوری',age:55,sex:'male',dx:'CHF',com:['HTN'],al:[]}];
const beds=store.readAll('beds');
for(let i=0;i<pts.length;i++){
const p=pts[i],bed=beds[i];
const rec={id:'pat_'+(i+1),mrn:'MRN-'+(1000+i),
firstName:p.fn,lastName:p.ln,age:p.age,sex:p.sex,
wardCode:bed.wardCode,bedId:bed.id,bedNumber:bed.bedNumber,
diagnosis:p.dx,comorbidities:p.com,allergies:p.al,
codeStatus:'full',status:'in_care',
admittedAt:new Date(Date.now()-(i+1)*86400000).toISOString(),
createdAt:new Date().toISOString()};
store.put('patients',rec);
bed.status='occupied';bed.patientId=rec.id;store.put('beds',bed);
const news=[9,5,8,2,6][i];
store.put('vitals',{id:'vit_'+i,patientId:rec.id,
patientName:p.fn+' '+p.ln,wardCode:bed.wardCode,bedNumber:bed.bedNumber,
recordedAt:new Date().toISOString(),
hr:[110,95,120,78,88][i],bp_sys:[95,115,88,122,100][i],
bp_dia:[60,75,55,80,65][i],rr:[22,20,28,16,18][i],
temp:[38.5,39,38.8,37,37.5][i],spo2:[92,94,89,98,96][i],
news2:news,newsLevel:news>=7?'critical':news>=5?'high':'medium'});
}
console.log('🌱 Seeded: '+pts.length+' patients, '+beds.length+' beds');
}
module.exports={seed};
EOF

# ─── 6) Patch server.js ───
node << 'NODE_PATCH'
const fs = require('fs');
const p = 'core/server.js';
let src = fs.readFileSync(p, 'utf8');

// A) Auto-discover modules (replace hardcoded list)
src = src.replace(
  /for\s*\(\s*const\s+m\s+of\s*\[[^\]]*\]\s*\)\s*\{[\s\S]*?\}\s*\}/,
  `const modDir = path.join(__dirname, '..', 'modules');
const modFiles = fs.readdirSync(modDir).filter(f => f.endsWith('.js'));
for (const f of modFiles) {
  const m = f.replace('.js', '');
  try {
    MODS[m] = require('../modules/' + m);
    console.log('📦 ' + m + ' (' + Object.keys(MODS[m].handlers).length + ')');
  } catch(e) {
    console.error('❌ ' + m + ': ' + e.message);
  }
}`
);

// B) Extend permissions (append after auth.seedAdmin)
const newPerms = `
Object.assign(require('./permissions').P, {
  'consult.view': 'admin,nurse,head_nurse,physician,resident,intern,attending,specialist,supervisor_clinical',
  'consult.request': 'admin,physician,resident,intern,attending,specialist',
  'consult.respond': 'admin,resident,attending,specialist',
  'consult.approve': 'admin,attending,specialist',
  'transfer.view': 'admin,head_nurse,nurse,physician,resident,attending,bed_manager,supervisor_clinical',
  'transfer.request': 'admin,physician,resident,attending,head_nurse,nurse',
  'transfer.approve': 'admin,head_nurse,supervisor_clinical',
  'transfer.assign_bed': 'admin,bed_manager,head_nurse',
  'transfer.handover': 'admin,nurse,head_nurse',
  'transfer.complete': 'admin,nurse,head_nurse,bed_manager',
  'discharge.view': 'admin,nurse,head_nurse,physician,resident,attending,specialist',
  'discharge.plan': 'admin,physician,resident,attending,nurse,head_nurse',
  'handover.view': 'admin,nurse,head_nurse,supervisor_clinical,nursing_director',
  'handover.create': 'admin,nurse,head_nurse',
  'handover.sign': 'admin,nurse,head_nurse',
  'handover.receive': 'admin,nurse,head_nurse',
  'lab.view': 'admin,nurse,head_nurse,physician,resident,intern,attending,specialist,lab_tech',
  'lab.order': 'admin,physician,resident,intern,attending,specialist,nurse',
  'lab.collect': 'admin,nurse,nurse_aide,lab_tech',
  'lab.result': 'admin,lab_tech',
  'lab.verify': 'admin,lab_tech,supervisor_clinical',
  'radiology.view': 'admin,nurse,head_nurse,physician,resident,intern,attending,specialist,radiology_tech',
  'radiology.order': 'admin,physician,resident,intern,attending,specialist,nurse',
  'radiology.report': 'admin,radiology_tech,attending',
  'radiology.verify': 'admin,attending,supervisor_clinical',
  'bloodbank.view': 'admin,nurse,head_nurse,physician,resident,attending,lab_tech',
  'bloodbank.request': 'admin,physician,resident,attending,nurse',
  'bloodbank.crossmatch': 'admin,lab_tech',
  'bloodbank.issue': 'admin,lab_tech',
  'bloodbank.transfuse': 'admin,nurse',
  'pharmacy.view': 'admin,pharmacist,nurse,head_nurse,physician,attending',
  'pharmacy.verify': 'admin,pharmacist',
  'pharmacy.dispense': 'admin,pharmacist',
  'sepsis.view': 'admin,nurse,head_nurse,physician,resident,intern,attending,specialist',
  'sepsis.screen': 'admin,nurse,head_nurse,resident,intern',
  'sepsis.diagnose': 'admin,physician,attending,specialist,resident',
  'infection.view': 'admin,nurse,head_nurse,physician,resident,attending,supervisor_infection',
  'infection.report': 'admin,nurse,physician,resident,attending,lab_tech',
  'infection.isolation': 'admin,supervisor_infection,head_nurse',
  'quality.view': 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,quality_officer,head_nurse,supervisor_clinical',
  'quality.incident.report': 'admin,nurse,head_nurse,physician,resident,intern,attending,specialist,pharmacist,lab_tech,radiology_tech,supervisor_clinical,quality_officer',
  'risk.view': 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,quality_officer,head_nurse,supervisor_clinical',
  'risk.register': 'admin,quality_officer,head_nurse,supervisor_clinical,attending',
  'shift.view': 'admin,nursing_director,supervisor_senior,supervisor_clinical,head_nurse,nurse,nurse_aide',
  'shift.manage': 'admin,head_nurse,supervisor_senior,nursing_director',
  'workforce.view': 'admin,nurse,nurse_aide,head_nurse,physician,resident,intern,attending,specialist,supervisor_clinical',
  'workforce.checkin': 'admin,nurse,nurse_aide,head_nurse,physician,resident,intern,attending',
  'karanneh.view': 'admin,nursing_director,medical_director,supervisor_clinical,supervisor_senior',
  'karanneh.manage': 'admin,nursing_director,medical_director'
});
`;
src = src.replace('auth.seedAdmin();', 'auth.seedAdmin();\n' + newPerms);

// C) Seed demo data
src = src.replace('auth.seedAdmin();', 'require("./seed").seed();\nauth.seedAdmin();');

fs.writeFileSync(p, src);
console.log('✅ server.js patched (auto-discovery + perms + seed)');
NODE_PATCH

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✅ Part 2 complete — 4 modules added    ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Modules:"
echo "  - workflow    (consult, transfer, discharge, handover)"
echo "  - paraclinical (lab, radiology, bloodbank, pharmacy)"
echo "  - safety      (sepsis, infection, quality, risk)"
echo "  - ops         (shift, workforce, karanneh)"
echo ""
echo "Now run: npm start"
