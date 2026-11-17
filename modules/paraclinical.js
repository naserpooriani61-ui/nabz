
const sig=require('../core/signature'),perms=require('../core/permissions');
function h(ctx,c){try{const r=ctx.store.readAll(c);return Array.isArray(r)?r:[]}catch(_){return[]}}
function sd(x){if(!x)return 0;const d=new Date(x);return isNaN(d.getTime())?0:d.getTime()}
function sg(ctx,c,r,a){const s=sig.signAction({userId:ctx.actor.id,action:a,collection:c,recordId:r.id,data:r});ctx.store.put('signatures',s);r.lastSignatureId=s.id;return s}
const list=(c)=>(ctx)=>{let i=perms.scope(ctx.actor,h(ctx,c));
if(ctx.query.status)i=i.filter(x=>x.status===ctx.query.status);
i.sort((a,b)=>sd(b.createdAt||b.orderedAt)-sd(a.createdAt||a.orderedAt));
return{items:i,total:i.length}};

function findUser(ctx, idOrUsername) {
  if (!idOrUsername) return null;
  const users = h(ctx, 'users');
  return users.find(u => (u.id === idOrUsername || u.username === idOrUsername) && u.active !== false) || null;
}

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
const criticals=[];for(const t of l.tests){
const v=l.results[t.code];if(v==null)continue;
if(t.critLow!=null&&v<t.critLow)criticals.push({test:t.code,value:v,type:'low'});
if(t.critHigh!=null&&v>t.critHigh)criticals.push({test:t.code,value:v,type:'high'})}
l.criticalFlags=criticals;
if (criticals.length) {
  l.acknowledgment = {
    required: true,
    acknowledged: false,
    acknowledgedAt: null,
    acknowledgedBy: null,
    acknowledgedByName: null,
    readBack: null
  };
}
ctx.store.put('labs',l);sg(ctx,'labs',l,'result');
if(criticals.length)ctx.bus.emit('lab.critical',{record:l,criticals,actor:ctx.actor});return l};

const labAcknowledge = (ctx) => {
  const l = ctx.store.get('labs', ctx.params.id);
  if (!l) throw ctx.E.notFound('not_found');
  if (!l.criticalFlags || !l.criticalFlags.length) throw ctx.E.conflict('no_critical_flags');
  if (!l.acknowledgment) l.acknowledgment = { required: true, acknowledged: false };
  if (l.acknowledgment.acknowledged) throw ctx.E.conflict('already_acknowledged');
  const b = ctx.body;
  if (!b.readBack) throw ctx.E.badRequest('read_back_required');
  l.acknowledgment.acknowledged = true;
  l.acknowledgment.acknowledgedAt = ctx.now();
  l.acknowledgment.acknowledgedBy = ctx.actor.id;
  l.acknowledgment.acknowledgedByName = ctx.actor.fullName || ctx.actor.username;
  l.acknowledgment.readBack = b.readBack;
  l.acknowledgment.note = b.note || '';
  ctx.store.put('labs', l);
  sg(ctx, 'labs', l, 'acknowledge');
  ctx.bus.emit('lab.critical.acknowledged', { record: l, actor: ctx.actor });
  return l;
};

const labVerify=(ctx)=>{const l=ctx.store.get('labs',ctx.params.id);
if(!l)throw ctx.E.notFound('not_found');
if(l.status!=='resulted')throw ctx.E.conflict('not_resulted');
if (l.criticalFlags && l.criticalFlags.length && (!l.acknowledgment || !l.acknowledgment.acknowledged)) {
  throw ctx.E.conflict('critical_must_be_acknowledged_before_verify');
}
l.status='verified';l.verifiedBy=ctx.actor.id;l.verifiedAt=ctx.now();
ctx.store.put('labs',l);sg(ctx,'labs',l,'verify');return l};

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
if (r.criticalFlag) {
  r.acknowledgment = { required: true, acknowledged: false, acknowledgedAt: null, acknowledgedBy: null };
}
ctx.store.put('radiology',r);sg(ctx,'radiology',r,'report');
if(r.criticalFlag)ctx.bus.emit('radiology.critical',{record:r,actor:ctx.actor});return r};
const radVerify=(ctx)=>{const r=ctx.store.get('radiology',ctx.params.id);
if(!r)throw ctx.E.notFound('not_found');
if(r.status!=='reported')throw ctx.E.conflict('not_reported');
if (r.criticalFlag && (!r.acknowledgment || !r.acknowledgment.acknowledged)) {
  throw ctx.E.conflict('critical_must_be_acknowledged');
}
r.status='verified';r.verifiedBy=ctx.actor.id;r.verifiedAt=ctx.now();
ctx.store.put('radiology',r);return r};

const radAcknowledge = (ctx) => {
  const r = ctx.store.get('radiology', ctx.params.id);
  if (!r) throw ctx.E.notFound('not_found');
  if (!r.criticalFlag) throw ctx.E.conflict('not_critical');
  if (!r.acknowledgment) r.acknowledgment = { required: true, acknowledged: false };
  if (r.acknowledgment.acknowledged) throw ctx.E.conflict('already_acknowledged');
  if (!ctx.body.readBack) throw ctx.E.badRequest('read_back_required');
  r.acknowledgment.acknowledged = true;
  r.acknowledgment.acknowledgedAt = ctx.now();
  r.acknowledgment.acknowledgedBy = ctx.actor.id;
  r.acknowledgment.acknowledgedByName = ctx.actor.fullName || ctx.actor.username;
  r.acknowledgment.readBack = ctx.body.readBack;
  ctx.store.put('radiology', r);
  ctx.bus.emit('radiology.critical.acknowledged', { record: r, actor: ctx.actor });
  return r;
};

const bloodRequest=(ctx)=>{const b=ctx.body;
if(!b.patientId||!b.productType||!b.units)throw ctx.E.badRequest('missing');
const p=ctx.store.get('patients',b.patientId);if(!p)throw ctx.E.notFound('not_found');
const r={id:ctx.uid('bl'),patientId:p.id,patientName:p.firstName+' '+p.lastName,
wardCode:p.wardCode,productType:b.productType,units:b.units,
priority:b.priority||'routine',status:'requested',requestedBy:ctx.actor.id,requestedAt:ctx.now(),
patientBloodType: p.bloodType || null};
ctx.store.put('blood_requests',r);sg(ctx,'blood_requests',r,'request');return r};
const bloodCrossmatch=(ctx)=>{const r=ctx.store.get('blood_requests',ctx.params.id);
if(!r)throw ctx.E.notFound('not_found');
if(r.status!=='requested')throw ctx.E.conflict('not_requested');
const b=ctx.body;
if(!b.donorBloodType)throw ctx.E.badRequest('donor_required');
r.status='crossmatched';r.crossmatch={donor:b.donorBloodType,result:'compatible',at:ctx.now()};
r.crossmatchedBy=ctx.actor.id;r.crossmatchedAt=ctx.now();
ctx.store.put('blood_requests',r);sg(ctx,'blood_requests',r,'crossmatch');return r};
const bloodIssue=(ctx)=>{const r=ctx.store.get('blood_requests',ctx.params.id);
if(!r)throw ctx.E.notFound('not_found');
if(r.status!=='crossmatched')throw ctx.E.conflict('not_crossmatched');
r.status='issued';r.issuedBy=ctx.actor.id;r.issuedAt=ctx.now();
ctx.store.put('blood_requests',r);return r};
const bloodTransfuse=(ctx)=>{
  const r=ctx.store.get('blood_requests',ctx.params.id);
  if(!r)throw ctx.E.notFound('not_found');
  if(r.status!=='issued')throw ctx.E.conflict('not_issued');
  const b = ctx.body;
  if(!b.secondCheckerId) throw ctx.E.badRequest('two_person_required');
  if(b.secondCheckerId === ctx.actor.id || b.secondCheckerId === ctx.actor.username)
    throw ctx.E.badRequest('second_checker_must_differ');
  const witness = findUser(ctx, b.secondCheckerId);
  if (!witness) throw ctx.E.badRequest('second_checker_not_valid_user');
  const safety = b.safety || {};
  const required = ['identity','bloodType','crossmatch','expiry','bag','consent'];
  const missing = required.filter(k => !safety[k]);
  if (missing.length) throw ctx.E.conflict('safety_checklist_incomplete: ' + missing.join(','));
  r.status='transfused';r.transfusedBy=ctx.actor.id;r.transfusedAt=ctx.now();
  r.transfusedByName = ctx.actor.fullName || ctx.actor.username;
  r.secondChecker=witness.id;
  r.secondCheckerName=witness.fullName || witness.username;
  r.safetyChecklist=safety;
  ctx.store.put('blood_requests',r);sg(ctx,'blood_requests',r,'transfuse');
  ctx.bus.emit('bloodbank.transfused',{record:r,actor:ctx.actor});
  return r;
};

const dispenseVerify=(ctx)=>{
  const d=ctx.store.get('dispenses',ctx.params.id);
  if(!d)throw ctx.E.notFound('not_found');
  if(d.status!=='pending_verify')throw ctx.E.conflict('not_pending');
  if (d.patientId && d.drugName) {
    const p = ctx.store.get('patients', d.patientId);
    if (p && p.allergies && p.allergies.length) {
      const dName = String(d.drugName || '').toLowerCase();
      const hasAllergy = p.allergies.some(a => dName.indexOf(String(a).toLowerCase()) >= 0);
      if (hasAllergy) {
        if (!ctx.body.overrideReason) throw ctx.E.conflict('allergy_conflict_pharmacy');
        if (!perms.can(ctx.actor.role, 'pharmacy.override_allergy') && ctx.actor.role !== 'admin') {
          throw ctx.E.forbidden('override_forbidden');
        }
        d.allergyOverride = { reason: ctx.body.overrideReason, by: ctx.actor.id, at: ctx.now() };
      }
    }
  }
  d.status='verified';d.verifiedBy=ctx.actor.id;d.verifiedAt=ctx.now();
  d.verifiedByName = ctx.actor.fullName || ctx.actor.username;
  ctx.store.put('dispenses',d);sg(ctx,'dispenses',d,'verify');
  ctx.bus.emit('pharmacy.verified', { record: d, actor: ctx.actor });
  return d;
};
const dispenseIssue=(ctx)=>{const d=ctx.store.get('dispenses',ctx.params.id);
if(!d)throw ctx.E.notFound('not_found');
if(d.status!=='verified')throw ctx.E.conflict('not_verified');
d.status='dispensed';d.dispensedBy=ctx.actor.id;d.dispensedAt=ctx.now();
d.dispensedByName = ctx.actor.fullName || ctx.actor.username;
ctx.store.put('dispenses',d);sg(ctx,'dispenses',d,'dispense');
ctx.bus.emit('pharmacy.dispensed', { record: d, actor: ctx.actor });
return d};

module.exports={handlers:{labs:list('labs'),labOrder,labCollect,labResult,labVerify,labAcknowledge,
radiology:list('radiology'),radOrder,radReport,radVerify,radAcknowledge,
blood:list('blood_requests'),bloodRequest,bloodCrossmatch,bloodIssue,bloodTransfuse,
dispenses:list('dispenses'),dispenseVerify,dispenseIssue},
routes:[

    {method:'GET',path:'/api/para/labs',handler:'labs',perm:'lab.view'},
    {method:'POST',path:'/api/para/labs',handler:'labOrder',perm:'lab.order'},
    {method:'GET',path:'/api/para/radiology',handler:'radiology',perm:'radiology.view'},
    {method:'POST',path:'/api/para/radiology',handler:'radOrder',perm:'radiology.order'},
    {method:'GET',path:'/api/para/blood',handler:'blood',perm:'bloodbank.view'},
    {method:'POST',path:'/api/para/blood',handler:'bloodRequest',perm:'bloodbank.request'},
    {method:'GET',path:'/api/para/dispenses',handler:'dispenses',perm:'pharmacy.view'},
    {method:'POST',path:'/api/para/labs/:id/collect',handler:'labCollect',perm:'lab.collect'},
    {method:'POST',path:'/api/para/labs/:id/result',handler:'labResult',perm:'lab.result'},
    {method:'POST',path:'/api/para/labs/:id/verify',handler:'labVerify',perm:'lab.verify'},
    {method:'POST',path:'/api/para/labs/:id/acknowledge',handler:'labAcknowledge',perm:'lab.view'},
    {method:'POST',path:'/api/para/radiology/:id/report',handler:'radReport',perm:'radiology.report'},
    {method:'POST',path:'/api/para/radiology/:id/verify',handler:'radVerify',perm:'radiology.verify'},
    {method:'POST',path:'/api/para/radiology/:id/acknowledge',handler:'radAcknowledge',perm:'radiology.view'},
    {method:'POST',path:'/api/para/blood/:id/crossmatch',handler:'bloodCrossmatch',perm:'bloodbank.crossmatch'},
    {method:'POST',path:'/api/para/blood/:id/issue',handler:'bloodIssue',perm:'bloodbank.issue'},
    {method:'POST',path:'/api/para/blood/:id/transfuse',handler:'bloodTransfuse',perm:'bloodbank.transfuse'},
    {method:'POST',path:'/api/para/dispenses/:id/verify',handler:'dispenseVerify',perm:'pharmacy.verify'},
  
{method:'POST',path:'/api/para/dispenses/:id/dispense',handler:'dispenseIssue',perm:'pharmacy.dispense'}],
panels:[
{id:'labs',title:'آزمایشگاه',icon:'🧪',perm:'lab.view',kind:'list',api:'/api/para/labs',fields:['patientName','panelName','priority','status']},
{id:'radiology',title:'تصویربرداری',icon:'🩻',perm:'radiology.view',kind:'list',api:'/api/para/radiology',fields:['patientName','modality','bodyPart','status']},
{id:'blood',title:'بانک خون',icon:'🩸',perm:'bloodbank.view',kind:'list',api:'/api/para/blood',fields:['patientName','productType','units','status']},
{id:'dispenses',title:'داروخانه',icon:'💊',perm:'pharmacy.view',kind:'list',api:'/api/para/dispenses',fields:['drugName','patientName','status']}]};
