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
    {method:'GET',path:'/api/ops/attendance',handler:'attendanceToday',perm:'workforce.view'},
    {method:'POST',path:'/api/ops/attendance/checkin',handler:'checkIn',perm:'workforce.checkin'},
    {method:'POST',path:'/api/ops/attendance/checkout',handler:'checkOut',perm:'workforce.checkin'},
    {method:'GET',path:'/api/ops/periods',handler:'periods',perm:'karanneh.view'},
    {method:'POST',path:'/api/ops/periods',handler:'karannehCreate',perm:'karanneh.manage'},
    {method:'POST',path:'/api/ops/rosters/:id/approve',handler:'rosterApprove',perm:'shift.manage'},
    {method:'POST',path:'/api/ops/periods/:id/calculate',handler:'karannehCalc',perm:'karanneh.manage'},
    {method:'POST',path:'/api/ops/periods/:id/finalize',handler:'karannehFinalize',perm:'karanneh.manage'},
  
{method:'GET',path:'/api/ops/staff',handler:'staff',perm:'workforce.view'}],
panels:[
{id:'rosters',title:'شیفت‌ها',icon:'📅',perm:'shift.view',kind:'list',api:'/api/ops/rosters',fields:['wardCode','month','status']},
{id:'attendance',title:'حضور امروز',icon:'✓',perm:'workforce.view',kind:'stats',api:'/api/ops/attendance'},
{id:'periods',title:'کارانه',icon:'💰',perm:'karanneh.view',kind:'list',api:'/api/ops/periods',fields:['year','month','totalPoints','status']},
{id:'staff',title:'پرسنل',icon:'👥',perm:'workforce.view',kind:'list',api:'/api/ops/staff',fields:['fullName','role','ward']}]};
