
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Nurse Shift Coverage
//  Real-time coverage per ward · ratio · escalation
// ═══════════════════════════════════════════════════════════
const store = require('../core/store');
const bus = require('../core/events');
const perms = require('../core/permissions');
const { h, sd } = require('../core/mod-helpers');

if (!perms.P['nurse_coverage.view']) {
  perms.P['nurse_coverage.view'] = 'admin,hospital_director,medical_director,nursing_director,supervisor_senior,supervisor_clinical,head_nurse,nurse,nurse_aide';
  perms.P['nurse_coverage.manage'] = 'admin,nursing_director,supervisor_senior,supervisor_clinical';
}

// ═══ Jalali conversion (reliable) ═══
function toJalali(dt) {
  const g_y = dt.getFullYear(), g_m = dt.getMonth()+1, g_d = dt.getDate();
  const g_days_m = [0,31,59,90,120,151,181,212,243,273,304,334];
  let j_y = (g_y <= 1600) ? 0 : 979;
  const gy = (g_y <= 1600) ? g_y - 621 : g_y - 1600;
  const gy2 = (g_m > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + g_d + g_days_m[g_m - 1];
  j_y += 33 * Math.floor(days / 12053);
  days %= 12053;
  j_y += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    j_y += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const j_m = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const j_d = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { jy: j_y, jm: j_m, jd: j_d };
}

function todayJ() {
  const j = toJalali(new Date());
  return j.jy + '/' + String(j.jm).padStart(2, '0') + '/' + String(j.jd).padStart(2, '0');
}

function currentShift() {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 14) return { code:'M', fa:'صبح', hours:'07:00-14:00' };
  if (hour >= 14 && hour < 19) return { code:'E', fa:'عصر', hours:'14:00-19:00' };
  return { code:'N', fa:'شب', hours:'19:00-07:00' };
}

// ═══════════════════════════════════════════════════════════
//  Coverage
// ═══════════════════════════════════════════════════════════
function coverage(ctx) {
  const shift = ctx.query.shift || currentShift().code;
  const date = ctx.query.date || todayJ();
  const shiftInfo = shift === 'M' ? { code:'M', fa:'صبح' } : shift === 'E' ? { code:'E', fa:'عصر' } : { code:'N', fa:'شب' };

  const sa = h(ctx, 'sa_assignments');
  const todayAssignments = sa.filter(a => a.date === date && a.shift === shift);
  const wards = h(ctx, 'sa_wards');
  const wardById = {};
  wards.forEach(w => { if (w.id != null) wardById[w.id] = w; });

  const patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  const byWard = {};
  patients.forEach(p => {
    if (!p.wardCode) return;
    if (!byWard[p.wardCode]) byWard[p.wardCode] = { patients: 0, nurses: 0, headNurse: null };
    byWard[p.wardCode].patients++;
  });

  // Count nurses per ward
  for (const a of todayAssignments) {
    const w = wardById[a.wardId];
    if (!w || !w.code) continue;
    if (!byWard[w.code]) byWard[w.code] = { patients: 0, nurses: 0, headNurse: null };
    byWard[w.code].nurses++;
  }

  // Head nurses
  const staff = h(ctx, 'sa_staff');
  for (const s of staff) {
    if (s.category === 'head_nurse' && s.active) {
      const w = wards.find(x => x.id === s.wardId);
      if (w && w.code && byWard[w.code]) byWard[w.code].headNurse = s.name;
    }
  }

  const services = Object.entries(byWard).map(([code, data]) => {
    const ward = wards.find(w => w.code === code);
    return {
      wardCode: code,
      wardLabel: ward ? ward.label : code,
      patients: data.patients,
      nurses: data.nurses,
      headNurse: data.headNurse,
      covered: data.nurses > 0,
      ratio: data.nurses > 0 ? Math.round(data.patients / data.nurses * 10) / 10 : null,
      ratioFlag: data.nurses > 0 && data.patients / data.nurses > 6 ? 'overloaded' :
                 data.nurses === 0 && data.patients > 0 ? 'uncovered' :
                 data.nurses > 0 && data.patients === 0 ? 'idle' : 'ok'
    };
  });

  services.sort((a, b) => {
    if (a.covered !== b.covered) return a.covered ? 1 : -1;
    return b.patients - a.patients;
  });

  const uncovered = services.filter(s => !s.covered && s.patients > 0);
  const overloaded = services.filter(s => s.ratioFlag === 'overloaded');

  return {
    date, shift: shiftInfo.code, shiftLabel: shiftInfo.fa,
    services,
    total: services.length,
    coveredCount: services.filter(s => s.covered).length,
    uncoveredCount: uncovered.length,
    overloadedCount: overloaded.length,
    uncoveredWards: uncovered.map(s => ({ code: s.wardCode, label: s.wardLabel, patients: s.patients })),
    overloadedWards: overloaded.map(s => ({ code: s.wardCode, label: s.wardLabel, ratio: s.ratio }))
  };
}

// ═══════════════════════════════════════════════════════════
//  My shift
// ═══════════════════════════════════════════════════════════
function myShift(ctx) {
  const shift = currentShift();
  const date = todayJ();

  // Resolve staff
  let staffId = ctx.actor.staffId || null;
  if (!staffId) {
    const staff = h(ctx, 'sa_staff').find(s =>
      s.code === ctx.actor.username || s.name === ctx.actor.fullName
    );
    if (staff) staffId = staff.id;
  }

  if (!staffId) {
    return { isStaff: false, message: 'پروفایل پرسنلی یافت نشد', shift: shift.code, shiftLabel: shift.fa, date };
  }

  const assignment = h(ctx, 'sa_assignments').find(a =>
    a.date === date && a.shift === shift.code && a.staffId === staffId
  );

  const staff = h(ctx, 'sa_staff').find(s => s.id === staffId);
  const ward = staff ? h(ctx, 'sa_wards').find(w => w.id === staff.wardId) : null;

  return {
    isStaff: true,
    staffId, staffName: staff ? staff.name : ctx.actor.fullName,
    shift: shift.code, shiftLabel: shift.fa,
    date,
    isAssigned: !!assignment,
    assignment: assignment ? {
      id: assignment.id,
      wardId: assignment.wardId,
      wardLabel: ward ? ward.label : null,
      state: assignment.state || 'scheduled'
    } : null
  };
}

// ═══════════════════════════════════════════════════════════
//  Escalations
// ═══════════════════════════════════════════════════════════
function escalations(ctx) {
  const cov = coverage(ctx);
  const items = [];
  for (const w of cov.uncoveredWards) {
    items.push({
      type: 'uncovered',
      severity: w.patients >= 10 ? 'critical' : 'warning',
      wardCode: w.code, wardLabel: w.label, patients: w.patients,
      message: w.patients + ' بیمار بدون پرستار',
      recommendation: 'اختصاص فوری پرستار از طریق roster'
    });
  }
  for (const w of cov.overloadedWards) {
    items.push({
      type: 'overloaded',
      severity: w.ratio > 8 ? 'critical' : 'warning',
      wardCode: w.code, wardLabel: w.label, ratio: w.ratio,
      message: 'نسبت بیمار/پرستار ' + w.ratio + ' (بالای استاندارد ۶)',
      recommendation: 'توزیع مجدد پرستار یا درخواست کمک'
    });
  }
  return { items, total: items.length, shift: cov.shift, date: cov.date };
}

// ═══════════════════════════════════════════════════════════
//  Dashboard
// ═══════════════════════════════════════════════════════════
function dashboard(ctx) {
  const cov = coverage(ctx);
  const mine = myShift(ctx);
  const esc = escalations(ctx);
  return {
    coverage: cov,
    myShift: mine,
    escalations: esc,
    generatedAt: ctx.now()
  };
}

// ═══ Background alert (every 15 min) ═══
let _timer = false;
function startTimer() {
  if (_timer) return;
  _timer = true;
  setTimeout(() => {
    const fakeCtx = {
      query: {}, actor: { id: 'system', username: 'nurse_coverage', role: 'admin' }
    };
    try {
      const esc = escalations(fakeCtx);
      if (esc.items.length > 0) {
        const critical = esc.items.filter(e => e.severity === 'critical');
        if (critical.length > 0) {
          bus.emit('nurse_coverage.alert', {
            items: critical,
            total: critical.length,
            shift: esc.shift
          });
          console.log('[nurse-coverage] ' + critical.length + ' critical escalations');
        }
      }
    } catch (e) { /* ignore */ }
    setInterval(() => {
      try {
        const esc = escalations(fakeCtx);
        const critical = esc.items.filter(e => e.severity === 'critical');
        if (critical.length > 0) {
          bus.emit('nurse_coverage.alert', { items: critical, total: critical.length, shift: esc.shift });
        }
      } catch (_) {}
    }, 15 * 60 * 1000);
  }, 90000);
  console.log('[nurse-coverage] escalation timer started (90s initial, then 15-min)');
}
startTimer();

module.exports = {
  handlers: { coverage, myShift, escalations, dashboard },
  routes: [
    { method:'GET', path:'/api/nurse-coverage/dashboard', handler:'dashboard', perm:'nurse_coverage.view' },
    { method:'GET', path:'/api/nurse-coverage/coverage',  handler:'coverage',  perm:'nurse_coverage.view' },
    { method:'GET', path:'/api/nurse-coverage/my',        handler:'myShift',   perm:'nurse_coverage.view' },
    { method:'GET', path:'/api/nurse-coverage/escalations', handler:'escalations', perm:'nurse_coverage.view' }
  ],
  panels: [
    { id:'coverage', title:'پوشش پرستاری', icon:'👩‍⚕️', perm:'nurse_coverage.view',
      kind:'nurse_coverage', api:'/api/nurse-coverage/dashboard' }
  ]
};

console.log('[nurse-coverage] loaded — dashboard + my-shift + escalations');
