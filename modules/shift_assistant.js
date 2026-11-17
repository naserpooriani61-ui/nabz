'use strict';
const { h, sd } = require('../core/mod-helpers');
const bus = require('../core/events');
const store = require('../core/store');
const auth = require('../core/auth');

const _div = (a,b) => Math.trunc(a/b), _mod = (a,b) => a - _div(a,b)*b;
function _jalCal(jy) {
  const b = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
  const gy = jy+621; let lJ=-14, jp=b[0], jm, jump=0, n, i;
  for (i=1; i<b.length; i++) { jm=b[i]; jump=jm-jp; if (jy<jm) break; lJ+=_div(jump,33)*8+_div(_mod(jump,33),4); jp=jm; }
  n=jy-jp; lJ+=_div(n,33)*8+_div(_mod(n,33)+3,4);
  if (_mod(jump,33)===4 && jump-n===4) lJ+=1;
  const lG=_div(gy,4)-_div((_div(gy,100)+1)*3,4)-150;
  const march=20+lJ-lG; if (jump-n<6) n=n-jump+_div(jump+4,33)*33;
  let leap=_mod(_mod(n+1,33)-1,4); if (leap===-1) leap=4;
  return { leap, gy, march };
}
const _g2d = (gy,gm,gd) => { let d=_div((gy+_div(gm-8,6)+100100)*1461,4)+_div(153*_mod(gm+9,12)+2,5)+gd-34840408; return d-_div(_div(gy+100100+_div(gm-8,6),100)*3,4)+752; };
const _d2g = (jdn) => { let j=4*jdn+139361631; j=j+_div(_div(4*jdn+183187720,146097)*3,4)*4-3908; const i=_div(_mod(j,1461),4)*5+308; return { gy:_div(j,1461)-100100+_div(8-_div(_mod(i,153),12),6), gm:_mod(_div(i,153),12)+1, gd:_div(_mod(i,153),5)+1 }; };
const _j2d = (jy,jm,jd) => { const r=_jalCal(jy); return _g2d(r.gy,3,r.march)+(jm-1)*31-_div(jm,7)*(jm-7)+jd-1; };
const _d2j = (jdn) => { const gy=_d2g(jdn).gy; let jy=gy-621; const r=_jalCal(jy); const jdn1f=_g2d(gy,3,r.march); let k=jdn-jdn1f; if (k>=0) { if (k<=185) return { jy, jm:1+_div(k,31), jd:_mod(k,31)+1 }; k-=186; } else { jy-=1; k+=179; if (r.leap===1) k+=1; } return { jy, jm:7+_div(k,30), jd:_mod(k,30)+1 }; };
const monthLength = (jy,jm) => jm<=6?31:jm<=11?30:(_jalCal(jy).leap===0?30:29);
const fmtJ = (jy,jm,jd) => jy+'/'+String(jm).padStart(2,'0')+'/'+String(jd).padStart(2,'0');
const parseJ = s => { const p=String(s).split(/[\/\-]/); return { jy:+p[0], jm:+p[1], jd:+p[2] }; };
const weekdayIdx = (jy,jm,jd) => _mod(_j2d(jy,jm,jd)+2,7);
function monthDays(jy,jm) { const out=[]; for (let d=1; d<=monthLength(jy,jm); d++) { out.push({ date:fmtJ(jy,jm,d), jy, jm, jd:d, wd:weekdayIdx(jy,jm,d), isFri:weekdayIdx(jy,jm,d)===6 }); } return out; }
function addDaysJ(jy,jm,jd,n) { let y=jy,m=jm,d=jd+n; while (d<1) { m--; if (m<1){m=12;y--;} d+=monthLength(y,m); } while (d>monthLength(y,m)) { d-=monthLength(y,m); m++; if (m>12){m=1;y++;} } return { jy:y, jm:m, jd:d }; }
function todayJ() { const t = require("../core/time").todayTehranComponents(); return _d2j(_g2d(t.y, t.m, t.d)); }

const SHIFTS = {
  M:{code:'M',fa:'صبح',minutes:420,startHour:7,endHour:14},
  E:{code:'E',fa:'عصر',minutes:420,startHour:13,endHour:20},
  N:{code:'N',fa:'شب',minutes:780,startHour:19,endHour:8},
  L:{code:'L',fa:'لانگ',minutes:780,startHour:7,endHour:20},
  EN:{code:'EN',fa:'عصر+شب',minutes:1140,startHour:13,endHour:8},
  H24:{code:'H24',fa:'۲۴ساعته',minutes:1440,startHour:7,endHour:7}
};
const SHIFT_ORDER = ['M','E','N','L','EN','H24'];
const POS_MAP = { M:'matron', S:'supervisor', H:'head_nurse', R:'rn', U:'support', B:'beh_yar', A:'assistant', N:'anesthesia', O:'or_tech', X:'or_specialist', W:'midwife', E:'ecg', C:'secretary', P:'patient_care', Z:'wound_specialist' };
const EMP_MAP = { '1':'رسمی','2':'رسمی آزمایشی','3':'قراردادی','4':'شرکتی','5':'پیمانی','6':'طرحی','7':'تمدید طرح' };
const REQ_FA = { MORNING:'صبح',EVENING:'عصر',NIGHT:'شب',LONG:'لانگ',EVENING_NIGHT:'عصر+شب',H24:'۲۴ساعته',LEAVE:'مرخصی',SICK:'استعلاجی',HALF_M:'مرخصی نیم‌روز صبح',HALF_E:'مرخصی نیم‌روز عصر',REST:'استراحت' };
const SHIFT_TO_REQ = { M:'MORNING',E:'EVENING',N:'NIGHT',L:'LONG',EN:'EVENING_NIGHT',H24:'H24' };

const DEFAULT_CONFIG = {
  id:'global',
  weights:{coverage:100,pref:50,fair:30,rest:15,random:2},
  rest:{minMinutes:720,sameShiftMinutes:360,nightToMorningForbidden:true},
  limits:{maxConsecutiveNights:2,maxConsecutiveWorkDays:6,maxOvertimePerMonth:40,targetHoursPerMonth:168},
  payroll:{hourlyBaseRate:300000,nightMultiplier:1.5,holidayMultiplier:1.5,overtimeMultiplier:1.5,karanehPerHour:120000,seniorityBonusPerYear:0.02,seniorityCap:0.20,insurance:0.07,tax:0.05,
    positionMult:{matron:1.35,supervisor:1.25,clinical_supervisor:1.25,head_nurse:1.15,rn:1.00,support:0.85,beh_yar:0.90,assistant:0.80,anesthesia:1.10,or_tech:1.05,or_specialist:1.10,midwife:1.05,secretary:0.75,patient_care:0.70,ecg:0.85,wound_specialist:1.10}}
};

// ═══ SEED ═══
(function seed() {
  try {
    if (h({store}, 'sa_wards').length > 0) return;
    const fs = require('fs'), path = require('path');
    const seedFile = path.join(store.DATA, 'sa_seed.json');
    if (!fs.existsSync(seedFile)) { console.log('[sa] no seed file, skipping'); return; }
    const data = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
    let wc=0, sc=0;
    for (const w of data.wards || []) {
      store.put('sa_wards', {
        id:w.id, code:w.code, label:w.label, diff:w.diff, wk:w.wk,
        isManagement: w.code==='NO'||w.code==='EXTRA',
        headStaffId:null, createdAt:new Date().toISOString()
      });
      wc++;
    }
    for (const s of data.staff || []) {
      const cat = POS_MAP[s.posCode] || 'rn';
      const emp = EMP_MAP[s.empCode] || 'قراردادی';
      const rec = {
        id:s.id, code:s.code, name:s.name, wardId:s.wardId,
        category:cat, employment:emp,
        seniorityYears: 3+(s.id*7%15),
        targetHours:168, maxOvertime:40,
        nightEligible:true, active:true,
        phone:'', nationalId:'', headOfWard:null,
        createdAt:new Date().toISOString()
      };
      if (cat === 'head_nurse') {
        rec.headOfWard = s.wardId;
        const w = store.get('sa_wards', s.wardId);
        if (w) { w.headStaffId = s.id; store.put('sa_wards', w); }
      }
      store.put('sa_staff', rec); sc++;
    }
    if (!store.get('sa_config', 'global')) store.put('sa_config', DEFAULT_CONFIG);
    const t = todayJ();
    const pid = t.jy+'-'+String(t.jm).padStart(2,'0');
    if (!store.get('sa_periods', pid)) {
      store.put('sa_periods', { id:pid, jy:t.jy, jm:t.jm, status:'collecting', createdAt:new Date().toISOString() });
    }
    console.log('[sa] ✅ seeded: '+wc+' wards, '+sc+' staff, period '+pid);
  } catch (e) { console.error('[sa] seed failed:', e.message, e.stack); }
})();

// ═══ FAIRNESS ═══
function gini(v){const n=v.length;if(!n)return 0;const s=v.reduce((a,b)=>a+b,0);if(!s)return 0;const so=[...v].sort((a,b)=>a-b);let c=0;for(let i=0;i<n;i++)c+=(i+1)*so[i];return Math.max(0,(2*c)/(n*s)-(n+1)/n);}
function cv(v){const n=v.length;if(!n)return 0;const m=v.reduce((a,b)=>a+b,0)/n;if(!m)return 0;const va=v.reduce((s,x)=>s+(x-m)**2,0)/n;return Math.sqrt(va)/m;}
function maxMinGap(v){if(!v.length)return 0;return Math.max(...v)-Math.min(...v);}
function mulberry32(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

// ═══ SOLVER ═══
function advancedSolve(ctx, wardId, periodId, weights, seed) {
  const period = ctx.store.get('sa_periods', periodId);
  if (!period) throw ctx.E.notFound('period_not_found');
  const cfg = ctx.store.get('sa_config', 'global') || DEFAULT_CONFIG;
  const days = monthDays(period.jy, period.jm);
  const dayMap = new Map(days.map(d => [d.date, d]));

  const wardStaff = h(ctx, 'sa_staff').filter(s => s.active && s.wardId === wardId && !['secretary','head_nurse','matron'].includes(s.category));
  const isSupWard = wardStaff.length > 0 && wardStaff.every(s => s.category === 'supervisor');

  const slots = [];
  const demands = h(ctx, 'sa_demands').filter(d => d.periodId === periodId && d.wardId === wardId);
  for (const dm of demands) {
    for (let i=0;i<(dm.minRn||0);i++) slots.push({wardId,date:dm.date,shift:dm.shift,cat:'rn',min:true});
    for (let i=0;i<(dm.minSup||0);i++) slots.push({wardId,date:dm.date,shift:dm.shift,cat:'support',min:true});
    for (let i=(dm.minRn||0);i<(dm.targetRn||0);i++) slots.push({wardId,date:dm.date,shift:dm.shift,cat:'rn',min:false});
    for (let i=(dm.minSup||0);i<(dm.targetSup||0);i++) slots.push({wardId,date:dm.date,shift:dm.shift,cat:'support',min:false});
  }
  if (!slots.length) return { assignments:[], shortages:[], metrics:{coverage:100,totalSlots:0,totalMin:0,totalFilled:0} };

  const leaves = new Map();
  for (const p of h(ctx, 'sa_preferences').filter(p => p.periodId===periodId && p.wardId===wardId && p.status==='approved')) {
    if (['LEAVE','SICK','REST','HALF_M','HALF_E'].includes(p.requestType)) {
      if (!leaves.has(p.staffId)) leaves.set(p.staffId, new Set());
      leaves.get(p.staffId).add(p.date);
    }
  }
  const prefMap = new Map();
  for (const p of h(ctx, 'sa_preferences').filter(p => p.periodId===periodId && p.wardId===wardId && ['submitted','approved'].includes(p.status))) {
    const k = p.staffId+'|'+p.date;
    if (!prefMap.has(k)) prefMap.set(k, []);
    prefMap.get(k).push(p);
  }

  const busy = new Map(), counts = new Map();
  for (const st of wardStaff) {
    busy.set(st.id, new Map());
    counts.set(st.id, {nights:0,holidays:0,weekends:0,minutes:0,consecutiveNights:0,consecutiveWork:0,lastWorkedDate:null});
  }

  const locked = h(ctx, 'sa_assignments').filter(a => a.periodId===periodId && a.wardId===wardId && a.locked).sort((a,b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const assignments = [];
  for (const a of locked) {
    if (!wardStaff.find(s => s.id===a.staffId) || busy.get(a.staffId).has(a.date)) continue;
    busy.get(a.staffId).set(a.date, a.shift);
    const c = counts.get(a.staffId);
    const day = dayMap.get(a.date);
    c.minutes += a.actualMinutes || SHIFTS[a.shift]?.minutes || 0;
    if (['N','EN','H24'].includes(a.shift)) {
      const p = parseJ(a.date); const prev = addDaysJ(p.jy,p.jm,p.jd,-1);
      const prevSh = busy.get(a.staffId).get(fmtJ(prev.jy,prev.jm,prev.jd));
      if (['N','EN','H24'].includes(prevSh)) c.consecutiveNights++;
      else c.consecutiveNights = 1;
      c.nights++;
    } else c.consecutiveNights = 0;
    if (day?.isFri) c.weekends++;
    const p = parseJ(a.date); const prev = addDaysJ(p.jy,p.jm,p.jd,-1);
    c.consecutiveWork = c.lastWorkedDate===fmtJ(prev.jy,prev.jm,prev.jd) ? c.consecutiveWork+1 : 1;
    c.lastWorkedDate = a.date;
    assignments.push({...a, source:'locked'});
  }

  function canAssign(st, slot) {
    if (slot.cat === 'rn') {
      if (isSupWard) { if (st.category !== 'supervisor') return false; }
      else { if (!['rn','anesthesia','midwife','or_tech','or_specialist','wound_specialist','ecg'].includes(st.category)) return false; }
    }
    if (slot.cat === 'support' && !['support','beh_yar','assistant','patient_care'].includes(st.category)) return false;
    if (['N','EN','H24'].includes(slot.shift) && !st.nightEligible) return false;
    const b = busy.get(st.id);
    if (b.has(slot.date)) return false;
    if (leaves.get(st.id)?.has(slot.date)) return false;
    const c = counts.get(st.id);
    const targetMin = (st.targetHours || 168) * 60;
    const allowance = targetMin + (cfg.limits.maxOvertimePerMonth || 40)*60;
    if (c.minutes + SHIFTS[slot.shift].minutes > allowance) return false;

    const p = parseJ(slot.date); const prev = addDaysJ(p.jy,p.jm,p.jd,-1);
    const pvk = fmtJ(prev.jy,prev.jm,prev.jd);
    if (b.has(pvk)) {
      const ps = b.get(pvk);
      if (cfg.rest.nightToMorningForbidden && ['N','EN','H24'].includes(ps) && slot.shift === 'M') return false;
      const psD = SHIFTS[ps], csD = SHIFTS[slot.shift];
      let prevEnd = psD.endHour * 60; if (psD.endHour <= psD.startHour) prevEnd += 24*60;
      const currStart = csD.startHour * 60;
      let rest = (currStart + 24*60) - prevEnd; if (rest < 0) rest += 24*60;
      const minRest = (ps === slot.shift) ? (cfg.rest.sameShiftMinutes || 360) : (cfg.rest.minMinutes || 720);
      if (rest < minRest) return false;
    }

    if (cfg.limits.maxConsecutiveNights && c.consecutiveNights >= cfg.limits.maxConsecutiveNights && ['N','EN','H24'].includes(slot.shift)) return false;
    if (cfg.limits.maxConsecutiveWorkDays && c.lastWorkedDate) {
      const prevStr = fmtJ(prev.jy,prev.jm,prev.jd);
      if (c.lastWorkedDate === prevStr && c.consecutiveWork >= cfg.limits.maxConsecutiveWorkDays) return false;
    }
    return true;
  }

  const order = slots.map(slot => {
    let cnt = 0;
    for (const st of wardStaff) if (canAssign(st, slot)) cnt++;
    return {slot, cnt};
  }).sort((a,b) => {
    if (a.slot.date !== b.slot.date) return a.slot.date < b.slot.date ? -1 : 1;
    if (a.cnt !== b.cnt) return a.cnt - b.cnt;
    return SHIFT_ORDER.indexOf(a.slot.shift) - SHIFT_ORDER.indexOf(b.slot.shift);
  });

  const rng = mulberry32(seed || 42);
  const shortages = [];
  const baseCap = weights.coverage + weights.pref + weights.fair + weights.rest + weights.random || 1;

  for (const {slot} of order) {
    const cands = [];
    for (const st of wardStaff) {
      if (!canAssign(st, slot)) continue;
      const c = counts.get(st.id);
      const day = dayMap.get(slot.date);
      let prefScore = 0;
      for (const p of (prefMap.get(st.id+'|'+slot.date) || [])) {
        if (SHIFT_TO_REQ[slot.shift] === p.requestType) prefScore += 1;
        if (p.requestType === 'LEAVE' || p.requestType === 'REST') prefScore -= 2;
      }
      const nightPenalty = ['N','EN'].includes(slot.shift) ? c.nights*1.5 : 0;
      const holidayPenalty = day?.isFri ? c.weekends*1.0 : 0;
      const hourPenalty = c.minutes / 1200;
      const fairnessScore = -(nightPenalty + holidayPenalty + hourPenalty);
      const coverageScore = slot.min ? 2 : 1;
      const rnd = rng() * (weights.random / 100);
      const total = (weights.coverage * coverageScore + weights.pref * prefScore + weights.fair * fairnessScore + weights.rest * 1 + rnd) / baseCap;
      cands.push({st, score: total});
    }
    if (!cands.length) { if (slot.min) shortages.push({...slot}); continue; }
    cands.sort((a,b) => b.score - a.score);
    const chosen = cands[0].st;
    busy.get(chosen.id).set(slot.date, slot.shift);
    const c = counts.get(chosen.id);
    const day = dayMap.get(slot.date);
    c.minutes += SHIFTS[slot.shift].minutes;
    if (['N','EN','H24'].includes(slot.shift)) {
      const p = parseJ(slot.date); const prev = addDaysJ(p.jy,p.jm,p.jd,-1);
      const prevSh = busy.get(chosen.id).get(fmtJ(prev.jy,prev.jm,prev.jd));
      c.consecutiveNights = ['N','EN','H24'].includes(prevSh) ? c.consecutiveNights+1 : 1;
      c.nights++;
    } else c.consecutiveNights = 0;
    if (day?.isFri) c.weekends++;
    const p = parseJ(slot.date); const prev = addDaysJ(p.jy,p.jm,p.jd,-1);
    c.consecutiveWork = c.lastWorkedDate===fmtJ(prev.jy,prev.jm,prev.jd) ? c.consecutiveWork+1 : 1;
    c.lastWorkedDate = slot.date;
    assignments.push({staffId:chosen.id, wardId, date:slot.date, shift:slot.shift, category:slot.cat, actualMinutes:SHIFTS[slot.shift].minutes, state:'scheduled', locked:false, source:'auto'});
  }

  const minSlots = slots.filter(s=>s.min).length;
  const missingMin = shortages.length;
  return {
    assignments, shortages,
    metrics: {
      coverage: minSlots > 0 ? Math.round((minSlots-missingMin)/minSlots*10000)/100 : 100,
      totalSlots: slots.length, totalMin: minSlots, totalFilled: assignments.length
    }
  };
}

function computeWardStats(ctx, wardId, periodId) {
  const period = ctx.store.get('sa_periods', periodId);
  if (!period) return null;
  const days = monthDays(period.jy, period.jm);
  const dayMap = new Map(days.map(d => [d.date, d]));
  const wardStaff = h(ctx, 'sa_staff').filter(s => s.wardId === wardId && s.active);
  const assigns = h(ctx, 'sa_assignments').filter(a => a.periodId === periodId && a.wardId === wardId);
  const demands = h(ctx, 'sa_demands').filter(d => d.periodId === periodId && d.wardId === wardId);

  const staffStats = {};
  for (const st of wardStaff) {
    staffStats[st.id] = {id:st.id,name:st.name,code:st.code,category:st.category,employment:st.employment,seniority:st.seniorityYears,targetHours:st.targetHours||168,hours:0,nights:0,holidays:0,weekends:0,shifts:0,overtime:0,late:0,absent:0,checkedIn:0,_days:new Set()};
  }
  for (const a of assigns) {
    const s = staffStats[a.staffId]; if (!s) continue;
    const day = dayMap.get(a.date); if (!day) continue;
    s.hours += (a.actualMinutes||0)/60;
    if (['N','EN'].includes(a.shift)) s.nights++;
    if (day.isFri) s.weekends++;
    s.shifts++;
    if (a.state==='late') s.late++;
    if (a.state==='absent') s.absent++;
    if (['checked_in','checked_out'].includes(a.state)) s.checkedIn++;
    s._days.add(a.date);
  }
  for (const st of wardStaff) {
    const s = staffStats[st.id];
    s.overtime = Math.max(0, s.hours - (st.targetHours||168));
    s.workingDays = s._days.size;
    delete s._days;
  }
  const arr = Object.values(staffStats);
  const nightGini = gini(arr.map(s=>s.nights));
  const weekendCV = cv(arr.map(s=>s.weekends));
  const hourCV = cv(arr.map(s=>s.hours));
  const fairnessTotal = Math.max(0,1-nightGini/0.3)*0.4 + Math.max(0,1-weekendCV/0.4)*0.3 + Math.max(0,1-hourCV/0.25)*0.3;

  let totalNeed = 0, totalFilled = 0;
  const shortages = [];
  for (const d of demands) {
    const need = (d.minRn||0)+(d.minSup||0);
    const filled = assigns.filter(a => a.date===d.date && a.shift===d.shift).length;
    totalNeed += need;
    totalFilled += Math.min(filled, need);
    if (filled < need) shortages.push({date:d.date,shift:d.shift,need,filled,missing:need-filled});
  }
  const coverage = totalNeed>0 ? (totalFilled/totalNeed)*100 : 100;
  const prefs = h(ctx, 'sa_preferences').filter(p => p.periodId===periodId && p.wardId===wardId && ['submitted','approved'].includes(p.status));
  let prefTotal = 0, prefHonored = 0;
  for (const p of prefs) {
    prefTotal++;
    const m = assigns.find(a => a.staffId===p.staffId && a.date===p.date);
    if (m && SHIFT_TO_REQ[m.shift] === p.requestType) prefHonored++;
  }
  const prefSat = prefTotal>0 ? (prefHonored/prefTotal)*100 : 100;
  return {staffStats:arr, fairness:{nightGini:Math.round(nightGini*1000)/1000,weekendCV:Math.round(weekendCV*1000)/1000,hourCV:Math.round(hourCV*1000)/1000,total:Math.round(fairnessTotal*100)/100}, coverage:Math.round(coverage*100)/100, totalNeed, totalFilled, shortages, prefSat:Math.round(prefSat*100)/100, prefTotal, prefHonored};
}

function calcPayroll(ctx, staffId, periodId) {
  const st = ctx.store.get('sa_staff', staffId);
  const period = ctx.store.get('sa_periods', periodId);
  if (!st || !period) return null;
  const cfg = ctx.store.get('sa_config', 'global') || DEFAULT_CONFIG;
  const pc = cfg.payroll;
  const days = monthDays(period.jy, period.jm);
  const dayMap = new Map(days.map(d => [d.date, d]));
  const assigns = h(ctx, 'sa_assignments').filter(a => a.periodId===periodId && a.staffId===staffId);
  let totalMin=0, nightMin=0, holidayMin=0;
  for (const a of assigns) {
    const day = dayMap.get(a.date); if (!day) continue;
    totalMin += a.actualMinutes || SHIFTS[a.shift]?.minutes || 0;
    if (['N','EN'].includes(a.shift)) nightMin += a.actualMinutes || 0;
    if (day.isFri) holidayMin += a.actualMinutes || 0;
  }
  const ward = ctx.store.get('sa_wards', st.wardId);
  const wardDiff = ward?.diff || 1.0;
  const baseRate = pc.hourlyBaseRate * wardDiff;
  const posMult = pc.positionMult[st.category] || 1.0;
  const normalPay = (totalMin/60) * baseRate * posMult;
  const nightBonus = (nightMin/60) * baseRate * (pc.nightMultiplier-1) * posMult;
  const holidayBonus = (holidayMin/60) * baseRate * (pc.holidayMultiplier-1) * posMult;
  const targetMin = (st.targetHours||168)*60;
  const overtimeMin = Math.max(0, totalMin-targetMin);
  const overtimePay = (overtimeMin/60) * baseRate * pc.overtimeMultiplier * posMult;
  const karanehBase = (totalMin/60) * pc.karanehPerHour;
  const senBonus = Math.min(pc.seniorityCap, (st.seniorityYears||0)*pc.seniorityBonusPerYear);
  const karaneh = karanehBase * (1+senBonus) * wardDiff * posMult;
  const gross = normalPay + nightBonus + holidayBonus + overtimePay + karaneh;
  const ins = gross * pc.insurance;
  const tax = gross * pc.tax;
  return {staffId, staffName:st.name, wardLabel:ward?.label||'', totalMin, nightMin, holidayMin, overtimeMin, gross:Math.round(gross), net:Math.round(gross-ins-tax)};
}

function audit(ctx, action, entityId, meta) {
  try {
    const prev = h(ctx, 'sa_audit').slice(-1)[0];
    const rec = {id:ctx.uid('saa'), module:'shift_assistant', action, entityId:String(entityId||''), actor:{id:ctx.actor.id,name:ctx.actor.username,role:ctx.actor.role}, meta:meta||{}, prevHash:prev?prev.hash:'genesis', at:ctx.now()};
    const crypto = require('crypto');
    rec.hash = crypto.createHash('sha256').update(JSON.stringify({rec, prevHash:rec.prevHash})).digest('hex').slice(0,16);
    ctx.store.put('sa_audit', rec);
  } catch (e) { console.warn('[sa] audit:', e.message); }
}
function notif(ctx, userId, title, body, type) {
  try {
    ctx.store.put('sa_notifications', {id:ctx.uid('san'), userId, title, body:body||'', type:type||'info', read:false, createdAt:ctx.now()});
  } catch (_) {}
}

function _currentPeriod(ctx) {
  const t = todayJ();
  const pid = t.jy+'-'+String(t.jm).padStart(2,'0');
  let p = ctx.store.get('sa_periods', pid);
  if (!p) { p = {id:pid, jy:t.jy, jm:t.jm, status:'collecting', createdAt:ctx.now()}; ctx.store.put('sa_periods', p); }
  return p;
}

const H = {
  pinLogin(ctx) {
    const code = String(ctx.body.code||'').trim();
    const pin = String(ctx.body.pin||'').trim();
    if (!code || !pin) throw ctx.E.badRequest('code_and_pin_required');
    const staff = h(ctx, 'sa_staff').find(s => s.code === code && s.active);
    if (!staff) throw ctx.E.notFound('staff_not_found');
    const expected = staff.code.length>=4 ? staff.code.slice(-4) : '0000';
    if (pin !== expected) throw ctx.E.forbidden('invalid_pin');
    const token = auth.sign({id:'sa_'+staff.id, username:staff.code, role:'shift_staff', fullName:staff.name, staffId:staff.id, wardId:staff.wardId});
    return {token, staff:{id:staff.id, code:staff.code, name:staff.name, wardId:staff.wardId, category:staff.category}};
  },
  listWards(ctx) {
    const wards = h(ctx, 'sa_wards');
    const period = _currentPeriod(ctx);
    const items = wards.map(w => {
      const staff = h(ctx, 'sa_staff').filter(s => s.wardId===w.id && s.active);
      const stats = period ? computeWardStats(ctx, w.id, period.id) : null;
      return {id:w.id, code:w.code, label:w.label, diff:w.diff, wk:w.wk, isManagement:w.isManagement, headNurse:w.headStaffId?ctx.store.get('sa_staff',w.headStaffId)?.name:null, staffCount:staff.length, coverage:stats?.coverage||0, fairness:stats?.fairness.total||0, shortages:stats?.shortages.length||0};
    });
    return {items, total:items.length};
  },
  listStaff(ctx) {
    let items = h(ctx, 'sa_staff');
    if (ctx.query.wardId) items = items.filter(s => s.wardId===+ctx.query.wardId);
    if (ctx.query.category) items = items.filter(s => s.category===ctx.query.category);
    if (ctx.query.active !== 'false') items = items.filter(s => s.active);
    if (ctx.query.q) { const q=String(ctx.query.q).toLowerCase(); items = items.filter(s => s.name.toLowerCase().includes(q)||s.code.includes(q)); }
    const limit = Math.min(+ctx.query.limit||100, 500);
    const offset = +ctx.query.offset||0;
    return {items:items.slice(offset, offset+limit), total:items.length, offset, limit};
  },
  getStaff(ctx) {
    const s = ctx.store.get('sa_staff', +ctx.params.id);
    if (!s) throw ctx.E.notFound('staff_not_found');
    return s;
  },
  getPeriod(ctx) { return _currentPeriod(ctx); },
  listPeriods(ctx) { return {items:h(ctx, 'sa_periods').sort((a,b)=>b.id.localeCompare(a.id)), total:0}; },
  getDemands(ctx) {
    const periodId = ctx.query.periodId || _currentPeriod(ctx).id;
    const wardId = +ctx.query.wardId;
    if (!wardId) throw ctx.E.badRequest('wardId_required');
    const items = h(ctx, 'sa_demands').filter(d => d.periodId===periodId && d.wardId===wardId);
    return {items, total:items.length, periodId, wardId};
  },
  saveDemands(ctx) {
    const b = ctx.body;
    if (!b.periodId || !b.wardId || !Array.isArray(b.items)) throw ctx.E.badRequest('missing');
    for (const old of h(ctx, 'sa_demands').filter(d => d.periodId===b.periodId && d.wardId===b.wardId)) ctx.store.remove('sa_demands', old.id);
    let saved = 0;
    for (const it of b.items) {
      if (!it.date || !it.shift) continue;
      if (!(it.minRn||it.minSup||it.targetRn||it.targetSup)) continue;
      ctx.store.put('sa_demands', {id:ctx.uid('sadm'), periodId:b.periodId, wardId:b.wardId, date:it.date, shift:it.shift, minRn:Math.max(0,+it.minRn||0), minSup:Math.max(0,+it.minSup||0), targetRn:Math.max(0,+it.targetRn||0), targetSup:Math.max(0,+it.targetSup||0), updatedAt:ctx.now()});
      saved++;
    }
    audit(ctx, 'demands.save', b.periodId+':'+b.wardId, {saved});
    return {saved, periodId:b.periodId, wardId:b.wardId};
  },
  solve(ctx) {
    const b = ctx.body;
    const periodId = b.periodId || _currentPeriod(ctx).id;
    const wardId = +b.wardId;
    if (!wardId) throw ctx.E.badRequest('wardId_required');
    const period = ctx.store.get('sa_periods', periodId);
    if (!period) throw ctx.E.notFound('period_not_found');
    if (period.status === 'locked') throw ctx.E.conflict('period_locked');
    const cfg = ctx.store.get('sa_config', 'global') || DEFAULT_CONFIG;
    const weights = b.weights || cfg.weights;
    const result = advancedSolve(ctx, wardId, periodId, weights, b.seed || (Date.now()%100000));
    for (const a of h(ctx, 'sa_assignments').filter(a => a.periodId===periodId && a.wardId===wardId && !a.locked)) ctx.store.remove('sa_assignments', a.id);
    let saved = 0;
    for (const a of result.assignments) {
      if (a.source === 'locked') continue;
      ctx.store.put('sa_assignments', {id:ctx.uid('sas'), periodId, staffId:a.staffId, wardId, date:a.date, shift:a.shift, category:a.category, actualMinutes:a.actualMinutes, state:'scheduled', locked:false, source:'auto', createdAt:ctx.now()});
      saved++;
    }
    audit(ctx, 'solve', wardId, {periodId, saved, coverage:result.metrics.coverage});
    bus.emit('sa.solve.complete', {wardId, periodId, saved, coverage:result.metrics.coverage, actor:ctx.actor});
    return {saved, coverage:result.metrics.coverage, shortages:result.shortages.length, metrics:result.metrics};
  },
  solveAll(ctx) {
    const b = ctx.body || {};
    const periodId = b.periodId || _currentPeriod(ctx).id;
    const wards = h(ctx, 'sa_wards').filter(w => !w.isManagement);
    const results = [];
    for (const w of wards) {
      try {
        const r = H.solve({...ctx, body:{periodId, wardId:w.id}});
        results.push({wardId:w.id, wardLabel:w.label, ...r});
      } catch (e) { results.push({wardId:w.id, wardLabel:w.label, error:e.message}); }
    }
    return {periods:periodId, wards:results.length, results};
  },
  getAssignments(ctx) {
    const periodId = ctx.query.periodId || _currentPeriod(ctx).id;
    let items = h(ctx, 'sa_assignments').filter(a => a.periodId===periodId);
    if (ctx.query.wardId) items = items.filter(a => a.wardId===+ctx.query.wardId);
    if (ctx.query.staffId) items = items.filter(a => a.staffId===+ctx.query.staffId);
    if (ctx.query.date) items = items.filter(a => a.date===ctx.query.date);
    return {items, total:items.length};
  },
  addAssignment(ctx) {
    const b = ctx.body;
    if (!b.periodId||!b.staffId||!b.wardId||!b.date||!b.shift) throw ctx.E.badRequest('missing');
    if (!SHIFTS[b.shift]) throw ctx.E.badRequest('invalid_shift');
    const existing = h(ctx, 'sa_assignments').filter(a => a.periodId===b.periodId && a.staffId===b.staffId && a.date===b.date);
    if (existing.length) throw ctx.E.conflict('staff_already_assigned');
    const rec = {id:ctx.uid('sas'), periodId:b.periodId, staffId:b.staffId, wardId:b.wardId, date:b.date, shift:b.shift, category:b.category||'rn', actualMinutes:SHIFTS[b.shift].minutes, state:'scheduled', locked:true, source:'manual', createdBy:ctx.actor.id, createdAt:ctx.now()};
    ctx.store.put('sa_assignments', rec);
    audit(ctx, 'assignment.add', rec.id, {staffId:b.staffId, date:b.date, shift:b.shift});
    bus.emit('sa.assignment.added', {record:rec, actor:ctx.actor});
    return rec;
  },
  deleteAssignment(ctx) {
    const a = ctx.store.get('sa_assignments', ctx.params.id);
    if (!a) throw ctx.E.notFound('assignment_not_found');
    ctx.store.remove('sa_assignments', a.id);
    audit(ctx, 'assignment.delete', a.id, {staffId:a.staffId, date:a.date});
    bus.emit('sa.assignment.deleted', {record:a, actor:ctx.actor});
    return {deleted:true, id:a.id};
  },
  toggleLock(ctx) {
    const a = ctx.store.get('sa_assignments', ctx.params.id);
    if (!a) throw ctx.E.notFound('assignment_not_found');
    a.locked = !a.locked; a.updatedAt = ctx.now();
    ctx.store.put('sa_assignments', a);
    return a;
  },
  getPreferences(ctx) {
    const periodId = ctx.query.periodId || _currentPeriod(ctx).id;
    let items = h(ctx, 'sa_preferences').filter(p => p.periodId===periodId);
    if (ctx.query.staffId) items = items.filter(p => p.staffId===+ctx.query.staffId);
    if (ctx.query.wardId) items = items.filter(p => p.wardId===+ctx.query.wardId);
    if (ctx.query.status) items = items.filter(p => p.status===ctx.query.status);
    items.sort((a,b) => a.date < b.date ? -1 : 1);
    return {items, total:items.length};
  },
  submitPreferences(ctx) {
    const b = ctx.body;
    const periodId = b.periodId || _currentPeriod(ctx).id;
    const staffId = b.staffId || ctx.actor.staffId;
    if (!staffId || !Array.isArray(b.items)) throw ctx.E.badRequest('missing');
    const staff = ctx.store.get('sa_staff', staffId);
    if (!staff) throw ctx.E.notFound('staff_not_found');
    let saved = 0;
    for (const it of b.items) {
      if (!it.date || !it.requestType || !REQ_FA[it.requestType]) continue;
      for (const old of h(ctx, 'sa_preferences').filter(p => p.periodId===periodId && p.staffId===staffId && p.date===it.date && p.status==='draft')) ctx.store.remove('sa_preferences', old.id);
      ctx.store.put('sa_preferences', {id:ctx.uid('sap'), periodId, staffId, wardId:staff.wardId, date:it.date, requestType:it.requestType, priority:it.priority||'P4', status:b.status||'submitted', submittedAt:ctx.now()});
      saved++;
    }
    audit(ctx, 'preferences.submit', staffId, {saved, periodId});
    return {saved, periodId, staffId};
  },
  approvePreference(ctx) {
    const p = ctx.store.get('sa_preferences', ctx.params.id);
    if (!p) throw ctx.E.notFound('preference_not_found');
    const ok = ctx.body.approve === true;
    p.status = ok ? 'approved' : 'rejected';
    p.approvedAt = ctx.now(); p.approvedBy = ctx.actor.id;
    ctx.store.put('sa_preferences', p);
    notif(ctx, 'sa_'+p.staffId, ok?'✅ تأیید درخواست':'❌ رد درخواست', p.date+' — '+REQ_FA[p.requestType], ok?'success':'warning');
    audit(ctx, 'preference.'+(ok?'approve':'reject'), p.id, {date:p.date});
    return p;
  },
  listRoutines(ctx) {
    return {items:[{code:'M_SAT_THU',label:'صبح شنبه-پنجشنبه'},{code:'E_SAT_THU',label:'عصر شنبه-پنجشنبه'},{code:'N_SAT_THU',label:'شب شنبه-پنجشنبه'},{code:'N_ODD',label:'شب فرد'},{code:'N_EVEN',label:'شب زوج'}], total:5};
  },
  checkIn(ctx) {
    const a = ctx.store.get('sa_assignments', ctx.params.id);
    if (!a) throw ctx.E.notFound('assignment_not_found');
    a.state='checked_in'; a.checkInAt=ctx.now();
    ctx.store.put('sa_assignments', a);
    const staff = ctx.store.get('sa_staff', a.staffId);
    bus.emit('sa.checkin', {record:a, staff:staff?.name, actor:ctx.actor});
    return a;
  },
  checkOut(ctx) {
    const a = ctx.store.get('sa_assignments', ctx.params.id);
    if (!a) throw ctx.E.notFound('assignment_not_found');
    a.state='checked_out'; a.checkOutAt=ctx.now();
    ctx.store.put('sa_assignments', a);
    return a;
  },
  reportLate(ctx) {
    const a = ctx.store.get('sa_assignments', ctx.params.id);
    if (!a) throw ctx.E.notFound('assignment_not_found');
    a.state='late'; a.lateReportedAt=ctx.now(); a.lateReason=ctx.body.reason||'';
    ctx.store.put('sa_assignments', a);
    bus.emit('sa.attendance.late', {record:a, reason:a.lateReason, actor:ctx.actor});
    return a;
  },
  reportAbsent(ctx) {
    const a = ctx.store.get('sa_assignments', ctx.params.id);
    if (!a) throw ctx.E.notFound('assignment_not_found');
    a.state='absent'; a.absentReportedAt=ctx.now(); a.absentReason=ctx.body.reason||'';
    ctx.store.put('sa_assignments', a);
    bus.emit('sa.attendance.absent', {record:a, reason:a.absentReason, actor:ctx.actor});
    return a;
  },
  todayAttendance(ctx) {
    const t = todayJ();
    const date = fmtJ(t.jy, t.jm, t.jd);
    const assigns = h(ctx, 'sa_assignments').filter(a => a.date===date);
    const byWard = {};
    for (const a of assigns) {
      if (!byWard[a.wardId]) byWard[a.wardId] = {total:0,checked_in:0,checked_out:0,late:0,absent:0,scheduled:0,list:[]};
      const w = byWard[a.wardId];
      w.total++;
      w[a.state||'scheduled']++;
      w.list.push(a);
    }
    return {date, byWard, totalAssignments:assigns.length};
  },
  getFairness(ctx) {
    const periodId = ctx.query.periodId || _currentPeriod(ctx).id;
    const wardId = +ctx.query.wardId;
    if (!wardId) throw ctx.E.badRequest('wardId_required');
    return computeWardStats(ctx, wardId, periodId);
  },
  getPayroll(ctx) {
    const periodId = ctx.query.periodId || _currentPeriod(ctx).id;
    const staffId = +ctx.query.staffId;
    if (staffId) return calcPayroll(ctx, staffId, periodId);
    const items = h(ctx, 'sa_staff').filter(s=>s.active).map(s => calcPayroll(ctx, s.id, periodId)).filter(Boolean);
    return {items, total:items.length};
  },
  getConfig(ctx) {
    let cfg = ctx.store.get('sa_config', 'global');
    if (!cfg) { ctx.store.put('sa_config', DEFAULT_CONFIG); cfg = DEFAULT_CONFIG; }
    return cfg;
  },
  updateConfig(ctx) {
    const cfg = ctx.store.get('sa_config', 'global') || {...DEFAULT_CONFIG};
    const b = ctx.body;
    if (b.weights) cfg.weights = {...cfg.weights, ...b.weights};
    if (b.limits) cfg.limits = {...cfg.limits, ...b.limits};
    if (b.rest) cfg.rest = {...cfg.rest, ...b.rest};
    ctx.store.put('sa_config', cfg);
    return cfg;
  },
  getAudit(ctx) {
    const items = h(ctx, 'sa_audit').slice(-100).reverse();
    const limit = Math.min(+ctx.query.limit||50, 200);
    return {items:items.slice(0, limit), total:items.length};
  },
  verifyAudit(ctx) {
    const chain = h(ctx, 'sa_audit');
    for (let i=1; i<chain.length; i++) if (chain[i].prevHash !== chain[i-1].hash) return {ok:false, brokenAt:i, count:chain.length};
    return {ok:true, count:chain.length};
  },
  wardReport(ctx) {
    const wardId = +ctx.params.wardId;
    const periodId = ctx.query.periodId || _currentPeriod(ctx).id;
    return {ward:ctx.store.get('sa_wards', wardId), stats:computeWardStats(ctx, wardId, periodId), periodId};
  },
  staffReport(ctx) {
    const staffId = +ctx.params.staffId;
    const periodId = ctx.query.periodId || _currentPeriod(ctx).id;
    return {staff:ctx.store.get('sa_staff', staffId), assignments:h(ctx,'sa_assignments').filter(a=>a.periodId===periodId && a.staffId===staffId), payroll:calcPayroll(ctx, staffId, periodId), periodId};
  }
};

module.exports = {
  handlers: H,
  routes: [

    {method:'GET',  path:'/api/sa/wards', handler:'listWards', perm:'sa.view'},
    {method:'GET',  path:'/api/sa/staff', handler:'listStaff', perm:'sa.view'},
    {method:'GET',  path:'/api/sa/period', handler:'getPeriod', perm:'sa.view'},
    {method:'GET',  path:'/api/sa/periods', handler:'listPeriods', perm:'sa.view'},
    {method:'GET',  path:'/api/sa/demands', handler:'getDemands', perm:'sa.view'},
    {method:'POST', path:'/api/sa/demands', handler:'saveDemands', perm:'sa.manage'},
    {method:'POST', path:'/api/sa/solve', handler:'solve', perm:'sa.solve'},
    {method:'POST', path:'/api/sa/solve-all', handler:'solveAll', perm:'sa.solve'},
    {method:'GET',  path:'/api/sa/assignments', handler:'getAssignments', perm:'sa.view'},
    {method:'POST', path:'/api/sa/assignments', handler:'addAssignment', perm:'sa.manage'},
    {method:'GET',  path:'/api/sa/preferences', handler:'getPreferences', perm:'sa.view'},
    {method:'POST', path:'/api/sa/preferences', handler:'submitPreferences', perm:'sa.request'},
    {method:'GET',  path:'/api/sa/routines', handler:'listRoutines', perm:'sa.view'},
    {method:'GET',  path:'/api/sa/attendance/today', handler:'todayAttendance', perm:'sa.view'},
    {method:'GET',  path:'/api/sa/fairness', handler:'getFairness', perm:'sa.view'},
    {method:'GET',  path:'/api/sa/payroll', handler:'getPayroll', perm:'sa.payroll'},
    {method:'GET',  path:'/api/sa/config', handler:'getConfig', perm:'sa.view'},
    {method:'POST', path:'/api/sa/config', handler:'updateConfig', perm:'sa.admin'},
    {method:'GET',  path:'/api/sa/audit', handler:'getAudit', perm:'sa.admin'},
    {method:'GET',  path:'/api/sa/audit/verify', handler:'verifyAudit', perm:'sa.admin'},
    {method:'POST', path:'/api/sa/auth/pin', handler:'pinLogin', perm:null},
    {method:'GET',  path:'/api/sa/staff/:id', handler:'getStaff', perm:'sa.view'},
    {method:'DELETE', path:'/api/sa/assignments/:id', handler:'deleteAssignment', perm:'sa.manage'},
    {method:'POST', path:'/api/sa/assignments/:id/lock', handler:'toggleLock', perm:'sa.manage'},
    {method:'POST', path:'/api/sa/preferences/:id/approve', handler:'approvePreference', perm:'sa.approve'},
    {method:'POST', path:'/api/sa/attendance/:id/checkin', handler:'checkIn', perm:'sa.checkin'},
    {method:'POST', path:'/api/sa/attendance/:id/checkout', handler:'checkOut', perm:'sa.checkin'},
    {method:'POST', path:'/api/sa/attendance/:id/late', handler:'reportLate', perm:'sa.checkin'},
    {method:'POST', path:'/api/sa/attendance/:id/absent', handler:'reportAbsent', perm:'sa.checkin'},
    {method:'GET',  path:'/api/sa/reports/ward/:wardId', handler:'wardReport', perm:'sa.view'},
    {method:'GET',  path:'/api/sa/reports/staff/:staffId', handler:'staffReport', perm:'sa.view'},
  
  ],
  panels: [
    {id:'dashboard', title:'دستیار شیفت', icon:'🏥', perm:'sa.view', kind:'sa_dashboard', api:'/api/sa/wards'}
  ]
};
