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

  // ─── Demo staff ───
  if (store.readAll('wf_staff').length === 0) {
    const staff = [
      {fn:'مریم', ln:'موسوی', role:'nurse', ward:'ICU'},
      {fn:'احمد', ln:'رضایی', role:'nurse', ward:'ER'},
      {fn:'زهرا', ln:'کریمی', role:'head_nurse', ward:'ICU'},
      {fn:'محمد', ln:'احمدی', role:'physician', ward:'ER'},
      {fn:'فاطمه', ln:'حسینی', role:'resident', ward:'ICU'},
      {fn:'علی', ln:'نوری', role:'attending', ward:'ICU'},
      {fn:'سارا', ln:'مهدوی', role:'nurse', ward:'GEN'},
      {fn:'رضا', ln:'صادقی', role:'pharmacist', ward:'PHARM'},
      {fn:'نگار', ln:'بهرامی', role:'lab_tech', ward:'LAB'},
      {fn:'حسین', ln:'زمانی', role:'anesthesiologist', ward:'OR'}
    ];
    for (let i = 0; i < staff.length; i++) {
      const s = staff[i];
      store.put('wf_staff', {
        id: 'wf_' + (i+1), userId: null,
        fullName: s.fn + ' ' + s.ln,
        role: s.role, ward: s.ward,
        active: true, oncallEligible: true,
        createdAt: new Date().toISOString()
      });
    }
    console.log('🌱 Seeded: ' + staff.length + ' staff members');
  }
  // ─── OR rooms ───
  if (store.readAll('or_rooms').length === 0) {
    const groups = [['GEN',12],['URO',5],['EMG',5]];
    for (const [g,n] of groups) {
      for (let i = 1; i <= n; i++) {
        store.put('or_rooms', {
          id: 'or_' + g + i,
          code: 'OR-' + g + '-' + String(i).padStart(2,'0'),
          group: g, status: 'available',
          currentCaseId: null, createdAt: new Date().toISOString()
        });
      }
    }
    console.log('🌱 Seeded: 22 OR rooms');
  }

}
console.log('🌱 Seeded: '+pts.length+' patients, '+beds.length+' beds');
}
module.exports={seed};
// Sina real data: use POST /api/bedboard/reseed-sina (admin) to load real wards/staff
