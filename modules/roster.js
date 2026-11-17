'use strict';
const { h, sd } = require('../core/mod-helpers');
const bus = require('../core/events');

function _div(a,b) { return Math.trunc(a/b); }
const SHIFTS = { M:{label:'صبح',min:420}, E:{label:'عصر',min:420}, N:{label:'شب',min:780}, L:{label:'لانگ',min:780}, EN:{label:'عصر+شب',min:1140}, H24:{label:'۲۴',min:1440}, OFF:{label:'آف',min:0} };
const REQ_SHIFT = { MORNING:'M', EVENING:'E', NIGHT:'N', LONG:'L', EVENING_NIGHT:'EN', H24:'H24' };

// Jalali
function _jalCal(jy) {
  const b = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
  const gy = jy+621; let lJ=-14, jp=b[0], jm, jump=0, n, i;
  for (i=1;i<b.length;i++){jm=b[i];jump=jm-jp;if(jy<jm)break;lJ+=_div(jump,33)*8+_div(jump%33,4);jp=jm;}
  n=jy-jp; lJ+=_div(n,33)*8+_div((n%33)+3,4);
  if((jump%33)===4&&(jump-n)===4)lJ+=1;
  const lG=_div(gy,4)-_div((_div(gy,100)+1)*3,4)-150;
  const march=20+lJ-lG; if((jump-n)<6)n=n-jump+_div(jump+4,33)*33;
  let leap=((n+1)%33-1)%4; if(leap===-1)leap=4;
  return {leap, gy, march};
}
function g2d(gy,gm,gd){let d=_div((gy+_div(gm-8,6)+100100)*1461,4)+_div(153*((gm+9)%12)+2,5)+gd-34840408;return d-_div(_div(gy+100100+_div(gm-8,6),100)*3,4)+752;}
function d2j(jdn){
  let j=4*jdn+139361631;j=j+_div(_div(4*jdn+183187720,146097)*3,4)*4-3908;
  const i=_div(j%1461,4)*5+308;
  const gy=_div(j,1461)-100100+_div(8-_div(i%153,12),6);
  let jy=gy-621; const r=_jalCal(jy); const jdn1f=g2d(gy,3,r.march); let k=jdn-jdn1f;
  if(k>=0){if(k<=185)return {jy,jm:1+_div(k,31),jd:(k%31)+1};k-=186;}
  else{jy-=1;k+=179;if(r.leap===1)k+=1;}
  return {jy,jm:7+_div(k,30),jd:(k%30)+1};
}
function todayJ() { const t = require("../core/time").todayTehranComponents(); return d2j(g2d(t.y, t.m, t.d)); }
function monthLen(jy,jm){if(jm<=6)return 31;if(jm<=11)return 30;return _jalCal(jy).leap===0?30:29;}
function fmtJ(y,m,d){return y+'/'+String(m).padStart(2,'0')+'/'+String(d).padStart(2,'0');}
function weekdayIdx(jy,jm,jd){const r=_jalCal(jy);const jdn=g2d(r.gy,3,r.march)+(jm-1)*31-_div(jm,7)*(jm-7)+jd-1;return ((jdn+2)%7+7)%7;}

function getCurrentPeriod() {
  const t = todayJ();
  return { jy: t.jy, jm: t.jm, id: t.jy+'-'+String(t.jm).padStart(2,'0') };
}

// ═══ GET ROSTER GRID ═══
// Returns: { ward, period, days[], staff[], assignments{}, preferences{}, stats{} }
function getRoster(ctx) {
  let wardCode = ctx.query.wardCode;
  if (!wardCode) {
    // Auto-detect from actor
    if (ctx.actor.ward) wardCode = ctx.actor.ward;
    else if (ctx.actor.staffId) {
      const sa = h(ctx, 'sa_staff').find(s => s.id === ctx.actor.staffId);
      if (sa) {
        const w = h(ctx, 'sa_wards').find(x => x.id === sa.wardId);
        if (w) wardCode = w.code;
      }
    }
    if (!wardCode) {
      // If admin with no ward, return empty grid + hint
      const wards = h(ctx, 'sa_wards').filter(w => !w.isManagement);
      if (wards.length) wardCode = wards[0].code;
    }
    if (!wardCode) throw ctx.E.badRequest('no_ward_available');
  }
  const periodId = ctx.query.periodId || getCurrentPeriod().id;
  const [py, pm] = periodId.split('-').map(Number);
  
  const ward = h(ctx, 'sa_wards').find(w => w.code === wardCode);
  if (!ward) throw ctx.E.notFound('ward_not_found');
  
  // Days of month
  const days = [];
  const ml = monthLen(py, pm);
  for (let d = 1; d <= ml; d++) {
    const wd = weekdayIdx(py, pm, d);
    days.push({ jd: d, wd, isFri: wd === 6, date: fmtJ(py, pm, d) });
  }
  
  // Staff in ward
  const staff = h(ctx, 'sa_staff').filter(s => s.wardId === ward.id && s.active)
    .map(s => ({ id: s.id, name: s.name, code: s.code, category: s.category, seniority: s.seniorityYears, targetHours: s.targetHours || 168 }));
  
  // Assignments (current)
  const assigns = h(ctx, 'sa_assignments').filter(a => a.periodId === periodId && a.wardId === ward.id);
  const assignGrid = {};
  assigns.forEach(a => {
    const key = a.staffId + '|' + a.date;
    if (!assignGrid[key]) assignGrid[key] = [];
    assignGrid[key].push({ id: a.id, shift: a.shift, locked: !!a.locked, source: a.source || 'manual', actualMinutes: a.actualMinutes || 0 });
  });
  
  // Preferences
  const prefs = h(ctx, 'sa_preferences').filter(p => p.periodId === periodId && p.wardId === ward.id);
  const prefGrid = {};
  prefs.forEach(p => {
    const key = p.staffId + '|' + p.date;
    prefGrid[key] = { requestType: p.requestType, status: p.status, id: p.id };
  });
  
  // Stats per staff
  const stats = {};
  staff.forEach(s => { stats[s.id] = { shifts:0, hours:0, nights:0, fridays:0 }; });
  assigns.forEach(a => {
    const st = stats[a.staffId]; if (!st) return;
    const d = days.find(x => x.date === a.date);
    st.shifts++;
    st.hours += (a.actualMinutes || 0) / 60;
    if (['N','EN','H24'].includes(a.shift)) st.nights++;
    if (d && d.isFri) st.fridays++;
  });
  
  return {
    ward: { id: ward.id, code: ward.code, label: ward.label, headStaffId: ward.headStaffId },
    period: { id: periodId, jy: py, jm: pm, ml },
    days, staff, assignGrid, prefGrid, stats
  };
}

// ═══ SET CELL ═══
// body: { wardCode, periodId, staffId, date, shifts: ['M','E'] }
function setCell(ctx) {
  const b = ctx.body;
  if (!b.wardCode || !b.periodId || !b.staffId || !b.date) throw ctx.E.badRequest('missing');
  const shifts = Array.isArray(b.shifts) ? b.shifts.filter(s => s !== 'OFF' && s !== '') : [];
  const ward = h(ctx, 'sa_wards').find(w => w.code === b.wardCode);
  if (!ward) throw ctx.E.notFound('ward_not_found');
  
  // Remove existing
  const existing = h(ctx, 'sa_assignments').filter(a =>
    a.periodId === b.periodId && a.wardId === ward.id && a.staffId === b.staffId && a.date === b.date);
  for (const e of existing) ctx.store.remove('sa_assignments', e.id);
  
  // If shifts empty → OFF (delete only)
  if (!shifts.length) return { saved: 0, shifts: [] };
  
  // Add new
  let saved = 0;
  for (const shift of shifts) {
    const def = SHIFTS[shift];
    if (!def || !def.min) continue;
    const rec = {
      id: ctx.uid('sas'), periodId: b.periodId, staffId: b.staffId, wardId: ward.id,
      date: b.date, shift, category: 'rn',
      actualMinutes: def.min, state: 'scheduled', locked: false,
      source: 'manual', createdBy: ctx.actor.id, createdAt: ctx.now()
    };
    ctx.store.put('sa_assignments', rec);
    saved++;
  }
  bus.emit('roster.cell.set', { wardId: ward.id, staffId: b.staffId, date: b.date, shifts, actor: ctx.actor });
  return { saved, shifts };
}

// ═══ BULK FILL FROM PREFERENCES ═══
function bulkFromPrefs(ctx) {
  const b = ctx.body;
  if (!b.wardCode || !b.periodId) throw ctx.E.badRequest('missing');
  const ward = h(ctx, 'sa_wards').find(w => w.code === b.wardCode);
  if (!ward) throw ctx.E.notFound('ward_not_found');
  const prefs = h(ctx, 'sa_preferences').filter(p =>
    p.periodId === b.periodId && p.wardId === ward.id && p.status === 'approved');
  let saved = 0;
  for (const p of prefs) {
    if (['LEAVE','SICK','REST','HALF_M','HALF_E'].includes(p.requestType)) continue;
    const shift = REQ_SHIFT[p.requestType];
    if (!shift) continue;
    const existing = h(ctx, 'sa_assignments').filter(a =>
      a.periodId === b.periodId && a.wardId === ward.id && a.staffId === p.staffId && a.date === p.date);
    for (const e of existing) ctx.store.remove('sa_assignments', e.id);
    const def = SHIFTS[shift];
    ctx.store.put('sa_assignments', {
      id: ctx.uid('sas'), periodId: b.periodId, staffId: p.staffId, wardId: ward.id,
      date: p.date, shift, category: 'rn', actualMinutes: def.min,
      state: 'scheduled', locked: false, source: 'from_pref',
      createdBy: ctx.actor.id, createdAt: ctx.now()
    });
    saved++;
  }
  bus.emit('roster.bulk.prefs', { wardId: ward.id, saved, actor: ctx.actor });
  return { saved, message: saved + ' از ترجیحات پر شد' };
}

// ═══ AUTO-GENERATE (round-robin) ═══
function autoGenerate(ctx) {
  const b = ctx.body;
  if (!b.wardCode || !b.periodId) throw ctx.E.badRequest('missing');
  const ward = h(ctx, 'sa_wards').find(w => w.code === b.wardCode);
  if (!ward) throw ctx.E.notFound('ward_not_found');
  const [py, pm] = b.periodId.split('-').map(Number);
  const ml = monthLen(py, pm);
  const staff = h(ctx, 'sa_staff').filter(s => s.wardId === ward.id && s.active &&
    ['rn','midwife','anesthesia','or_tech','or_specialist'].includes(s.category));
  if (!staff.length) throw ctx.E.badRequest('no_staff');
  
  // Clear existing unlocked
  const existing = h(ctx, 'sa_assignments').filter(a =>
    a.periodId === b.periodId && a.wardId === ward.id && !a.locked);
  for (const e of existing) ctx.store.remove('sa_assignments', e.id);
  
  const shiftsPerDay = { M: Math.max(1, Math.ceil(staff.length / 4)), E: Math.max(1, Math.ceil(staff.length / 5)), N: Math.max(1, Math.ceil(staff.length / 6)) };
  let saved = 0;
  
  for (let d = 1; d <= ml; d++) {
    const date = fmtJ(py, pm, d);
    const wd = weekdayIdx(py, pm, d);
    const isFri = wd === 6;
    const pool = staff.slice(); // copy
    // shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let pi = 0;
    const assigned = {};
    // Assign M, E, N
    for (const shift of ['M','E','N']) {
      const count = shiftsPerDay[shift];
      for (let k = 0; k < count && pi < pool.length; k++) {
        let staffId = null;
        while (pi < pool.length) {
          const s = pool[pi++];
          if (!assigned[s.id]) { staffId = s.id; break; }
        }
        if (!staffId) break;
        assigned[staffId] = shift;
        const def = SHIFTS[shift];
        ctx.store.put('sa_assignments', {
          id: ctx.uid('sas'), periodId: b.periodId, staffId: staffId, wardId: ward.id,
          date, shift, category: 'rn', actualMinutes: def.min,
          state: 'scheduled', locked: false, source: 'auto',
          createdBy: ctx.actor.id, createdAt: ctx.now()
        });
        saved++;
      }
    }
  }
  bus.emit('roster.auto.generate', { wardId: ward.id, saved, actor: ctx.actor });
  return { saved, daysFilled: ml };
}

// ═══ COPY PREVIOUS MONTH ═══
function copyPrevious(ctx) {
  const b = ctx.body;
  if (!b.wardCode || !b.periodId) throw ctx.E.badRequest('missing');
  const ward = h(ctx, 'sa_wards').find(w => w.code === b.wardCode);
  if (!ward) throw ctx.E.notFound('ward_not_found');
  const [py, pm] = b.periodId.split('-').map(Number);
  let prevY = py, prevM = pm - 1;
  if (prevM < 1) { prevM = 12; prevY--; }
  const prevId = prevY + '-' + String(prevM).padStart(2, '0');
  const prev = h(ctx, 'sa_assignments').filter(a =>
    a.periodId === prevId && a.wardId === ward.id);
  if (!prev.length) throw ctx.E.badRequest('previous_month_empty');
  
  let saved = 0;
  for (const a of prev) {
    const pDay = parseInt(a.date.split('/')[2]);
    const newMl = monthLen(py, pm);
    if (pDay > newMl) continue;
    const newDate = fmtJ(py, pm, pDay);
    const existing = h(ctx, 'sa_assignments').filter(x =>
      x.periodId === b.periodId && x.wardId === ward.id && x.staffId === a.staffId && x.date === newDate);
    if (existing.length) continue;
    ctx.store.put('sa_assignments', {
      id: ctx.uid('sas'), periodId: b.periodId, staffId: a.staffId, wardId: ward.id,
      date: newDate, shift: a.shift, category: a.category || 'rn',
      actualMinutes: a.actualMinutes, state: 'scheduled', locked: false,
      source: 'copy_prev', createdBy: ctx.actor.id, createdAt: ctx.now()
    });
    saved++;
  }
  return { saved, fromPeriod: prevId };
}

// ═══ CLEAR MONTH ═══
function clearMonth(ctx) {
  const b = ctx.body;
  if (!b.wardCode || !b.periodId) throw ctx.E.badRequest('missing');
  const ward = h(ctx, 'sa_wards').find(w => w.code === b.wardCode);
  if (!ward) throw ctx.E.notFound('ward_not_found');
  const existing = h(ctx, 'sa_assignments').filter(a =>
    a.periodId === b.periodId && a.wardId === ward.id && !a.locked);
  let removed = 0;
  for (const e of existing) { ctx.store.remove('sa_assignments', e.id); removed++; }
  return { removed };
}

// ═══ BULK SET MULTI STAFF ═══
function bulkSet(ctx) {
  const b = ctx.body;
  if (!b.wardCode || !b.periodId || !Array.isArray(b.cells)) throw ctx.E.badRequest('missing');
  const ward = h(ctx, 'sa_wards').find(w => w.code === b.wardCode);
  if (!ward) throw ctx.E.notFound('ward_not_found');
  let saved = 0;
  for (const c of b.cells) {
    if (!c.staffId || !c.date) continue;
    const shifts = Array.isArray(c.shifts) ? c.shifts.filter(s => s !== 'OFF') : [];
    const existing = h(ctx, 'sa_assignments').filter(a =>
      a.periodId === b.periodId && a.wardId === ward.id && a.staffId === c.staffId && a.date === c.date);
    for (const e of existing) ctx.store.remove('sa_assignments', e.id);
    for (const shift of shifts) {
      const def = SHIFTS[shift];
      if (!def || !def.min) continue;
      ctx.store.put('sa_assignments', {
        id: ctx.uid('sas'), periodId: b.periodId, staffId: c.staffId, wardId: ward.id,
        date: c.date, shift, category: 'rn', actualMinutes: def.min,
        state: 'scheduled', locked: false, source: 'manual',
        createdBy: ctx.actor.id, createdAt: ctx.now()
      });
      saved++;
    }
  }
  return { saved };
}

// ═══ LOCK/UNLOCK ═══
function lockMonth(ctx) {
  const b = ctx.body;
  if (!b.wardCode || !b.periodId) throw ctx.E.badRequest('missing');
  const ward = h(ctx, 'sa_wards').find(w => w.code === b.wardCode);
  if (!ward) throw ctx.E.notFound('ward_not_found');
  const all = h(ctx, 'sa_assignments').filter(a =>
    a.periodId === b.periodId && a.wardId === ward.id);
  for (const a of all) {
    a.locked = b.locked !== false;
    ctx.store.put('sa_assignments', a);
  }
  return { locked: b.locked !== false, count: all.length };
}

// ═══ MY SCHEDULE (for staff) ═══
function mySchedule(ctx) {
  const staffId = ctx.actor.staffId;
  if (!staffId) {
    const periodId0 = ctx.query.periodId || getCurrentPeriod().id;
    const [py0, pm0] = periodId0.split('-').map(Number);
    const days0 = [];
    const ml0 = monthLen(py0, pm0);
    for (let d0 = 1; d0 <= ml0; d0++) {
      const wd0 = weekdayIdx(py0, pm0, d0);
      const date0 = fmtJ(py0, pm0, d0);
      days0.push({ jd: d0, wd: wd0, isFri: wd0 === 6, date: date0, shifts: [] });
    }
    return { period: periodId0, days: days0, assignments: [], isStaff: false, note: 'شما پرسنل شیفتی نیستید — این پنل برای پرسنل با شیفت است' };
  }
  const periodId = ctx.query.periodId || getCurrentPeriod().id;
  const assigns = h(ctx, 'sa_assignments').filter(a =>
    a.periodId === periodId && a.staffId === staffId);
  const [py, pm] = periodId.split('-').map(Number);
  const days = [];
  const ml = monthLen(py, pm);
  for (let d = 1; d <= ml; d++) {
    const wd = weekdayIdx(py, pm, d);
    const date = fmtJ(py, pm, d);
    const a = assigns.filter(x => x.date === date);
    days.push({ jd: d, wd, isFri: wd === 6, date, shifts: a.map(x => x.shift) });
  }
  return { period: periodId, days, assignments: assigns };
}

// ═══ SUBMIT PREFERENCE (for staff) ═══
function submitPref(ctx) {
  const b = ctx.body;
  if (!b.periodId || !b.date || !b.requestType) throw ctx.E.badRequest('missing');
  const staffId = ctx.actor.staffId;
  if (!staffId) throw ctx.E.badRequest('staff_only');
  const staff = h(ctx, 'sa_staff').find(s => s.id === staffId);
  if (!staff) throw ctx.E.notFound('staff_not_found');
  
  // Remove existing draft/submitted for this date
  const existing = h(ctx, 'sa_preferences').filter(p =>
    p.periodId === b.periodId && p.staffId === staffId && p.date === b.date &&
    ['draft','submitted'].includes(p.status));
  for (const e of existing) ctx.store.remove('sa_preferences', e.id);
  
  const rec = {
    id: ctx.uid('sap'), periodId: b.periodId, staffId: staffId, wardId: staff.wardId,
    date: b.date, requestType: b.requestType,
    priority: b.priority || 'P4', status: b.status || 'submitted',
    submittedAt: ctx.now(), createdBy: ctx.actor.id
  };
  ctx.store.put('sa_preferences', rec);
  return rec;
}

// ═══ BULK PREFERENCE ═══
function submitPrefBulk(ctx) {
  const b = ctx.body;
  if (!b.periodId || !Array.isArray(b.items)) throw ctx.E.badRequest('missing');
  const staffId = ctx.actor.staffId;
  if (!staffId) throw ctx.E.badRequest('staff_only');
  const staff = h(ctx, 'sa_staff').find(s => s.id === staffId);
  if (!staff) throw ctx.E.notFound('staff_not_found');
  
  let saved = 0;
  for (const it of b.items) {
    if (!it.date || !it.requestType) continue;
    const existing = h(ctx, 'sa_preferences').filter(p =>
      p.periodId === b.periodId && p.staffId === staffId && p.date === it.date &&
      ['draft','submitted'].includes(p.status));
    for (const e of existing) ctx.store.remove('sa_preferences', e.id);
    ctx.store.put('sa_preferences', {
      id: ctx.uid('sap'), periodId: b.periodId, staffId: staffId, wardId: staff.wardId,
      date: it.date, requestType: it.requestType,
      priority: it.priority || 'P4', status: b.status || 'submitted',
      submittedAt: ctx.now(), createdBy: ctx.actor.id
    });
    saved++;
  }
  return { saved };
}

// ═══ APPROVE PREFERENCE (head nurse) ═══
function approvePref(ctx) {
  const p = ctx.store.get('sa_preferences', ctx.params.id);
  if (!p) throw ctx.E.notFound('not_found');
  p.status = ctx.body.approve === true ? 'approved' : 'rejected';
  p.reviewedBy = ctx.actor.id;
  p.reviewedAt = ctx.now();
  ctx.store.put('sa_preferences', p);
  return p;
}

// ═══ LIST PREFERENCES (for head nurse) ═══
function listPrefs(ctx) {
  const wardCode = ctx.query.wardCode;
  const periodId = ctx.query.periodId || getCurrentPeriod().id;
  const ward = h(ctx, 'sa_wards').find(w => w.code === wardCode);
  if (!ward) throw ctx.E.notFound('ward_not_found');
  let items = h(ctx, 'sa_preferences').filter(p =>
    p.periodId === periodId && p.wardId === ward.id);
  if (ctx.query.status) items = items.filter(p => p.status === ctx.query.status);
  return { items, total: items.length };
}

// ═══ STATS ═══
function stats(ctx) {
  const wardCode = ctx.query.wardCode;
  const periodId = ctx.query.periodId || getCurrentPeriod().id;
  const ward = h(ctx, 'sa_wards').find(w => w.code === wardCode);
  if (!ward) throw ctx.E.notFound('ward_not_found');
  const assigns = h(ctx, 'sa_assignments').filter(a =>
    a.periodId === periodId && a.wardId === ward.id);
  const staff = h(ctx, 'sa_staff').filter(s => s.wardId === ward.id && s.active);
  const byShift = { M:0, E:0, N:0, L:0, EN:0, H24:0 };
  assigns.forEach(a => { if (byShift[a.shift] !== undefined) byShift[a.shift]++; });
  const totalHours = assigns.reduce((s, a) => s + (a.actualMinutes || 0), 0) / 60;
  return { staffCount: staff.length, assignmentCount: assigns.length, byShift, totalHours: Math.round(totalHours) };
}

module.exports = {
  handlers: { getRoster, setCell, bulkFromPrefs, autoGenerate, copyPrevious,
    clearMonth, bulkSet, lockMonth, mySchedule, submitPref, submitPrefBulk,
    approvePref, listPrefs, stats },
  routes: [
    { method:'GET',  path:'/api/roster/grid', handler:'getRoster', perm:'sa.view' },
    { method:'POST', path:'/api/roster/cell', handler:'setCell', perm:'sa.manage' },
    { method:'POST', path:'/api/roster/bulk', handler:'bulkSet', perm:'sa.manage' },
    { method:'POST', path:'/api/roster/from-prefs', handler:'bulkFromPrefs', perm:'sa.manage' },
    { method:'POST', path:'/api/roster/auto-generate', handler:'autoGenerate', perm:'sa.manage' },
    { method:'POST', path:'/api/roster/copy-previous', handler:'copyPrevious', perm:'sa.manage' },
    { method:'POST', path:'/api/roster/clear', handler:'clearMonth', perm:'sa.manage' },
    { method:'POST', path:'/api/roster/lock', handler:'lockMonth', perm:'sa.manage' },
    { method:'GET',  path:'/api/roster/prefs', handler:'listPrefs', perm:'sa.view' },
    { method:'GET',  path:'/api/roster/stats', handler:'stats', perm:'sa.view' },
    { method:'GET',  path:'/api/roster/my', handler:'mySchedule', perm:null },
    { method:'POST', path:'/api/roster/pref', handler:'submitPref', perm:null },
    { method:'POST', path:'/api/roster/pref/bulk', handler:'submitPrefBulk', perm:null },
    { method:'POST', path:'/api/roster/pref/:id/review', handler:'approvePref', perm:'sa.approve' }
  
  ],
  panels: [
    { id:'builder', title:'روستر شیفت', icon:'📅', perm:'sa.manage', kind:'roster_builder', api:'/api/roster/grid' },
    { id:'my', title:'شیفت‌های من', icon:'🗓️', perm:null, kind:'roster_my', api:'/api/roster/my' }
  ]
};
