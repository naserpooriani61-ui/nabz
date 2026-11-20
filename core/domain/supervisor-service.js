'use strict';
// core/domain/supervisor-service.js — supervisor dashboard aggregation (read-only)
// No writes here. All mutations go through writers.

const news2 = require('./news2');

// ─── helpers ───
function _all(ctx, c) {
  try {
    const r = (ctx.store || require('../store')).readAll(c);
    return Array.isArray(r) ? r : [];
  } catch (_) { return []; }
}
function _get(ctx, c, id) {
  try { return (ctx.store || require('../store')).get(c, id); } catch (_) { return null; }
}
function _ms(x) { if (!x) return null; const t = Date.parse(x); return isFinite(t) ? t : null; }
function _min(a, b) { const x = _ms(a), y = _ms(b); if (x == null || y == null || y < x) return null; return Math.round((y - x) / 60000); }
function _inLast(iso, hours) { const t = _ms(iso); return t != null && Date.now() - t <= hours * 3600000; }

function _wardLabel(bed) {
  return bed.wardLabel || bed.wardCode || '?';
}

// ─── ۱) overview: 8 KPIs + alerts ───
function getOverview(ctx) {
  const beds = _all(ctx, 'beds');
  const patients = _all(ctx, 'patients');
  const isolations = _all(ctx, 'isolations');
  const vents = _all(ctx, 'ventilator_settings');
  const edVisits = _all(ctx, 'ed_visits');
  const edCodes = _all(ctx, 'ed_codes').filter(c => c.status === 'active');
  const incidents = _all(ctx, 'incidents').filter(i => _inLast(i.reportedAt, 24));

  const activePatients = patients.filter(p => p.status !== 'discharged' && p.status !== 'transferred');
  const occupied = beds.filter(b => b.status === 'occupied').length;
  const empty = beds.filter(b => b.status === 'available' || b.status === 'empty').length;
  const icuBeds = beds.filter(b => (b.wardCode || '').startsWith('ICU_'));
  const icuOccupied = icuBeds.filter(b => b.status === 'occupied').length;
  const icuEmpty = icuBeds.filter(b => b.status === 'available' || b.status === 'empty').length;

  // alerts (priority order)
  const alerts = [];

  // ED: waiting ICU too long
  const waitingIcu = edVisits.filter(v => v.status === 'boarding' || v.dispositionType === 'admit');
  if (waitingIcu.length > 0) {
    alerts.push({ severity: 'high', icon: '🛏️', title: waitingIcu.length + ' بیمار منتظر تخت ICU', detail: 'در اورژانس' });
  }

  // active codes
  edCodes.forEach(c => {
    alerts.push({ severity: 'critical', icon: '🚨', title: (c.codeLabel || c.code) + ' فعال', detail: c.patientName || '' });
  });

  // incidents last 24h
  const severeIncidents = incidents.filter(i => i.severity === 'critical' || i.severity === 'major' || i.severityWeight >= 4);
  if (severeIncidents.length > 0) {
    alerts.push({ severity: 'high', icon: '⚠️', title: severeIncidents.length + ' حادثه جدی در ۲۴ ساعت', detail: severeIncidents[0].category || '' });
  }

  // vent high
  const ventOn = vents.filter(v => v.status === 'active' || v.on === true).length;
  if (ventOn > icuEmpty + 2) {
    alerts.push({ severity: 'medium', icon: '🫁', title: ventOn + ' بیمار تحت ونتیلاتور', detail: 'ICU: ' + icuOccupied + '/' + icuBeds.length });
  }

  // isolation
  const isolationActive = isolations.filter(i => i.status === 'active' || i.active).length;
  if (isolationActive > 0) {
    alerts.push({ severity: 'medium', icon: '🔒', title: isolationActive + ' بیمار ایزوله', detail: 'پایش روزانه' });
  }

  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      patientsTotal: activePatients.length,
      bedsTotal: beds.length,
      bedsOccupied: occupied,
      bedsEmpty: empty,
      occupancyPct: beds.length ? Math.round(occupied / beds.length * 100) : 0,
      icuTotal: icuBeds.length,
      icuOccupied: icuOccupied,
      icuEmpty: icuEmpty,
      ventOn: ventOn,
      isolation: isolationActive,
      edVisits: edVisits.filter(v => !['discharged','admitted','transferred','lwbs','lama','absconded','deceased'].includes(v.status)).length,
      edCodes: edCodes.length,
      incidents24h: incidents.length,
      severeIncidents24h: severeIncidents.length
    },
    alerts: alerts.slice(0, 10)
  };
}

// ─── ۲) wards: per-ward breakdown ───
function getWards(ctx) {
  const beds = _all(ctx, 'beds');
  const patients = _all(ctx, 'patients');
  const vents = _all(ctx, 'ventilator_settings');
  const isolations = _all(ctx, 'isolations');

  const byWard = {};
  beds.forEach(b => {
    const w = b.wardCode || '?';
    if (!byWard[w]) byWard[w] = {
      code: w, label: _wardLabel(b),
      total: 0, occupied: 0, empty: 0, cleaning: 0,
      vent: 0, isolation: 0, critical: 0
    };
    byWard[w].total++;
    if (b.status === 'occupied') byWard[w].occupied++;
    else if (b.status === 'available' || b.status === 'empty') byWard[w].empty++;
    else if (b.status === 'cleaning') byWard[w].cleaning++;
    if (b.isCritical) byWard[w].critical++;
  });

  // vent count per ward
  const ventByWard = {};
  vents.forEach(v => {
    if (v.status === 'active' || v.on) {
      const w = v.wardCode || '?';
      ventByWard[w] = (ventByWard[w] || 0) + 1;
    }
  });
  Object.keys(byWard).forEach(w => { byWard[w].vent = ventByWard[w] || 0; });

  // isolation per ward
  const isoByWard = {};
  isolations.forEach(i => {
    if (i.status === 'active' || i.active) {
      const w = i.wardCode || '?';
      isoByWard[w] = (isoByWard[w] || 0) + 1;
    }
  });
  Object.keys(byWard).forEach(w => { byWard[w].isolation = isoByWard[w] || 0; });

  return {
    generatedAt: new Date().toISOString(),
    wards: Object.values(byWard).sort((a, b) => a.code.localeCompare(b.code)),
    totals: {
      beds: beds.length,
      occupied: beds.filter(b => b.status === 'occupied').length,
      empty: beds.filter(b => b.status === 'available' || b.status === 'empty').length
    }
  };
}

// ─── ۳) emergency: ED stats ───
function getEmergency(ctx) {
  let edBoard = null;
  try {
    const B = require('./ed-board');
    edBoard = B.getBoard(ctx);
  } catch (_) {}

  const edVisits = _all(ctx, 'ed_visits');
  const edCodes = _all(ctx, 'ed_codes');
  const activeCodes = edCodes.filter(c => c.status === 'active');
  const codes24h = edCodes.filter(c => _inLast(c.activatedAt, 24));

  const today = new Date().toISOString().slice(0, 10);
  const todayVisits = edVisits.filter(v => (v.arrivalAt || '').startsWith(today));
  const activeVisits = edVisits.filter(v => !['discharged','admitted','transferred','lwbs','lama','absconded','deceased'].includes(v.status || 'waiting_triage'));

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      todayVisits: todayVisits.length,
      activeVisits: activeVisits.length,
      activeCodes: activeCodes.length,
      codes24h: codes24h.length,
      lwbs24h: todayVisits.filter(v => v.status === 'lwbs').length,
      lama24h: todayVisits.filter(v => v.status === 'lama').length,
      deceased24h: todayVisits.filter(v => v.status === 'deceased').length,
      transferred24h: todayVisits.filter(v => v.status === 'transferred').length,
      admitted24h: todayVisits.filter(v => v.status === 'admitted').length
    },
    activeCodes: activeCodes,
    board: edBoard ? { counts: edBoard.counts, rows: edBoard.rows.slice(0, 15) } : null
  };
}

// ─── ۴) operating rooms ───
function getOperatingRooms(ctx) {
  const rooms = _all(ctx, 'or_rooms');
  const schedule = _all(ctx, 'or_schedule');
  const today = new Date().toISOString().slice(0, 10);
  const todaySchedule = schedule.filter(s => (s.date || s.scheduledAt || '').startsWith(today));

  const byRoom = {};
  rooms.forEach(r => {
    byRoom[r.id] = {
      id: r.id, name: r.name || r.roomName || r.id,
      wardCode: r.wardCode || 'OR',
      status: r.status || 'idle',
      specialty: r.specialty || null,
      scheduled: 0, inProgress: 0, waiting: 0
    };
  });

  todaySchedule.forEach(s => {
    const rid = s.roomId || s.orRoomId;
    if (byRoom[rid]) {
      byRoom[rid].scheduled++;
      const st = (s.status || '').toLowerCase();
      if (st === 'in_progress' || st === 'inprogress') byRoom[rid].inProgress++;
      else if (st === 'scheduled' || st === 'waiting') byRoom[rid].waiting++;
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    rooms: Object.values(byRoom),
    totals: {
      total: rooms.length,
      scheduled: todaySchedule.length,
      inProgress: Object.values(byRoom).reduce((s, r) => s + r.inProgress, 0),
      waiting: Object.values(byRoom).reduce((s, r) => s + r.waiting, 0)
    }
  };
}

// ─── ۵) staff: on-call + assignments ───
function getStaff(ctx) {
  const onCall = _all(ctx, 'on_call');
  const rosters = _all(ctx, 'rosters');
  const nurseAssign = _all(ctx, 'nurse_assignments');
  const users = _all(ctx, 'users');

  const today = new Date().toISOString().slice(0, 10);
  const todayRosters = rosters.filter(r => (r.date || '').startsWith(today));

  const byRole = { physician: 0, nurse: 0, head_nurse: 0, nurse_aide: 0, midwife: 0, resident: 0, attending: 0, other: 0 };
  users.forEach(u => {
    if (u.status === 'active') {
      const r = u.role || 'other';
      byRole[r] = (byRole[r] || 0) + 1;
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    onCallToday: onCall.filter(o => (o.date || o.dutyDate || '').startsWith(today)),
    todayRosters,
    nurseAssignmentsToday: nurseAssign.filter(n => (n.date || n.shiftDate || '').startsWith(today)),
    usersByRole: byRole,
    totals: {
      usersActive: users.filter(u => u.status === 'active').length,
      onCallSlots: onCall.length,
      nurseAssignments: nurseAssign.length
    }
  };
}

// ─── ۶) safety: patient risk groups ───
function getSafety(ctx) {
  const risks = _all(ctx, 'risks');
  const patients = _all(ctx, 'patients');
  const beds = _all(ctx, 'beds');

  // active patients
  const activeIds = new Set(patients.filter(p => p.status !== 'discharged' && p.status !== 'transferred').map(p => p.id));
  const bedByPatient = {};
  beds.forEach(b => { if (b.patientId) bedByPatient[b.patientId] = b; });

  // High-risk patients (from risks collection)
  const highRisk = risks.filter(r => {
    const s = Number(r.riskScore) || 0;
    const lvl = (r.level || '').toLowerCase();
    return s >= 10 || lvl === 'high' || lvl === 'critical';
  }).map(r => ({
    id: r.id, title: r.title, wardCode: r.wardCode,
    level: r.level, riskScore: r.riskScore,
    category: r.category, mitigations: r.mitigations || []
  }));

  // Patients flagged with risk factors
  const riskPatients = [];
  patients.forEach(p => {
    if (!activeIds.has(p.id)) return;
    const flags = [];
    if (p.riskFactors && Array.isArray(p.riskFactors)) {
      p.riskFactors.forEach(f => flags.push(f));
    }
    if (p.fallRisk && p.fallRisk >= 3) flags.push('fall_risk');
    if (p.bradenScore && p.bradenScore <= 12) flags.push('pressure_ulcer');
    if (p.morseScore && p.morseScore >= 45) flags.push('high_fall');
    if (flags.length > 0) {
      riskPatients.push({
        patientId: p.id,
        name: ((p.firstName || '') + ' ' + (p.lastName || '')).trim(),
        wardCode: p.wardCode, bedNumber: p.bedNumber,
        flags: flags
      });
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    highRiskRegister: highRisk,
    patientsWithRisks: riskPatients,
    totals: {
      highRiskRegister: highRisk.length,
      patientsFlagged: riskPatients.length
    }
  };
}

// ─── ۷) incidents ───
function getIncidents(ctx, days) {
  const d = Number(days) > 0 ? Number(days) : 7;
  const since = Date.now() - d * 86400000;
  const all = _all(ctx, 'incidents');
  const inPeriod = all.filter(i => (_ms(i.reportedAt) || 0) >= since);
  const bySeverity = { minor: 0, moderate: 0, major: 0, critical: 0, unknown: 0 };
  const byCategory = {};
  inPeriod.forEach(i => {
    const s = (i.severity || 'unknown').toLowerCase();
    bySeverity[s] = (bySeverity[s] || 0) + 1;
    const c = i.category || 'other';
    byCategory[c] = (byCategory[c] || 0) + 1;
  });

  return {
    generatedAt: new Date().toISOString(),
    periodDays: d,
    incidents: inPeriod.sort((a, b) => (_ms(b.reportedAt) || 0) - (_ms(a.reportedAt) || 0)),
    bySeverity,
    byCategory,
    totals: { count: inPeriod.length, requiresRca: inPeriod.filter(i => i.requiresRca).length }
  };
}

// ─── ۸) analytics ───
function getAnalytics(ctx, days) {
  const d = Number(days) > 0 ? Number(days) : 7;
  const since = Date.now() - d * 86400000;
  const patients = _all(ctx, 'patients');
  const edVisits = _all(ctx, 'ed_visits');
  const incidents = _all(ctx, 'incidents');

  const admissionsPerDay = {};
  patients.forEach(p => {
    const t = _ms(p.admittedAt);
    if (t != null && t >= since) {
      const day = new Date(t).toISOString().slice(0, 10);
      admissionsPerDay[day] = (admissionsPerDay[day] || 0) + 1;
    }
  });

  const edPerDay = {};
  edVisits.forEach(v => {
    const t = _ms(v.arrivalAt);
    if (t != null && t >= since) {
      const day = new Date(t).toISOString().slice(0, 10);
      edPerDay[day] = (edPerDay[day] || 0) + 1;
    }
  });

  const incidentsPerDay = {};
  incidents.forEach(i => {
    const t = _ms(i.reportedAt);
    if (t != null && t >= since) {
      const day = new Date(t).toISOString().slice(0, 10);
      incidentsPerDay[day] = (incidentsPerDay[day] || 0) + 1;
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    periodDays: d,
    admissionsPerDay,
    edVisitsPerDay: edPerDay,
    incidentsPerDay,
    totals: {
      admissions: Object.values(admissionsPerDay).reduce((a, b) => a + b, 0),
      edVisits: Object.values(edPerDay).reduce((a, b) => a + b, 0),
      incidents: Object.values(incidentsPerDay).reduce((a, b) => a + b, 0)
    }
  };
}

// ─── ۹) full board (single call for UI) ───
function getFullBoard(ctx) {
  return {
    generatedAt: new Date().toISOString(),
    overview: getOverview(ctx),
    wards: getWards(ctx),
    emergency: getEmergency(ctx),
    or: getOperatingRooms(ctx),
    staff: getStaff(ctx),
    safety: getSafety(ctx),
    incidents: getIncidents(ctx, 7),
    analytics: getAnalytics(ctx, 7)
  };
}

module.exports = {
  getOverview,
  getWards,
  getEmergency,
  getOperatingRooms,
  getStaff,
  getSafety,
  getIncidents,
  getAnalytics,
  getFullBoard
};
