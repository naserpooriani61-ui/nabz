'use strict';
// core/domain/handover-report.js — SBAR shift handover report
// Generates a printable, Persian-friendly summary per patient.
const store = require('../store');
const news2 = require('./news2');
function _all(c) { try { return store.readAll(c); } catch (_) { return []; } }
function _sd(x) { return x ? new Date(x).getTime() : 0; }
function _pname(p) { return p ? ((p.firstName||'')+' '+(p.lastName||'')).trim() : ''; }
function _age(p) { return p && p.age ? p.age : '—'; }
function _sex(p) { return p && p.sex === 'male' ? 'مرد' : p && p.sex === 'female' ? 'زن' : '—'; }
function _fmtT(iso) { if (!iso) return ''; try { return new Date(iso).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}); } catch(_){ return ''; } }
function _fmtD(iso) { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('fa-IR'); } catch(_){ return ''; } }
function _hoursSince(iso) { if (!iso) return 0; return Math.round((Date.now() - _sd(iso)) / 3600000); }

function generate(ctx, patientId, opts) {
  const p = store.get('patients', patientId);
  if (!p) throw (ctx.E ? ctx.E.notFound('patient_not_found') : new Error('patient_not_found'));
  const now = Date.now(), dayAgo = now - 24*3600*1000;

  // ─── Orders (current, active) ───
  const orders = _all('orders').filter(o => o.patientId === patientId &&
    !['completed','cancelled','discontinued','rejected_teaching'].includes(o.status));

  // ─── MARs (scheduled + due + overdue) ───
  const mar = _all('mar').filter(m => m.patientId === patientId &&
    ['scheduled','due'].includes(m.status));
  const overdueMar = mar.filter(m => _sd(m.scheduledAt) < now)
    .sort((a,b) => _sd(a.scheduledAt) - _sd(b.scheduledAt));
  const upcomingMar = mar.filter(m => _sd(m.scheduledAt) >= now && _sd(m.scheduledAt) < now + 4*3600*1000)
    .sort((a,b) => _sd(a.scheduledAt) - _sd(b.scheduledAt));

  // ─── Vitals (last 3 + trend) ───
  const vitals = _all('vitals').filter(v => v.patientId === patientId)
    .sort((a,b) => _sd(b.recordedAt) - _sd(a.recordedAt)).slice(0, 3);
  const latestVital = vitals[0] || null;
  const newsNow = latestVital ? (latestVital.news2 != null ? latestVital.news2 : news2.calc(latestVital).total) : null;
  const newsRisk = newsNow != null ? (newsNow >= 7 ? 'critical' : newsNow >= 5 ? 'high' : newsNow >= 1 ? 'medium' : 'low') : null;

  // ─── Alerts (recent, unresolved) ───
  const alerts = _all('cdss_alerts').filter(a => a.patientId === patientId &&
    !a.dismissed && _sd(a.createdAt) > dayAgo)
    .sort((a,b) => _sd(b.createdAt) - _sd(a.createdAt)).slice(0, 5);

  // ─── Pending verifies ───
  const pendingVerify = orders.filter(o => o.status === 'pending');

  // ─── Consults awaiting response ───
  const pendingConsults = _all('consults').filter(c => c.patientId === patientId &&
    c.status === 'requested');

  // ─── I&O 24h ───
  const io = _all('io_records').filter(r => r.patientId === patientId && _sd(r.recordedAt) > dayAgo);
  const ioIn = io.filter(r => r.type === 'intake').reduce((s,r) => s + (Number(r.volume)||0), 0);
  const ioOut = io.filter(r => r.type === 'output').reduce((s,r) => s + (Number(r.volume)||0), 0);

  return {
    // ─── Header ───
    header: {
      patientId: p.id,
      name: _pname(p),
      age: _age(p), sex: _sex(p),
      ward: p.wardCode || '—',
      bed: p.bedNumber || '—',
      nationalCode: p.nationalCode || '—',
      admissionDate: p.admittedAt || p.createdAt || null,
      hoursSinceAdmission: _hoursSince(p.admittedAt || p.createdAt)
    },

    // ─── S: Situation ───
    situation: {
      admissionReason: p.admissionReason || p.chiefComplaint || '—',
      currentStatus: p.status || '—',
      allergies: Array.isArray(p.allergies) ? p.allergies : (p.allergies ? [p.allergies] : []),
      isolation: p.isolation || null,
      codeStatus: p.codeStatus || '—',
      attendingPhysician: p.attendingPhysician || p.attending || '—',
      activeOrdersCount: orders.length,
      pendingVerifyCount: pendingVerify.length
    },

    // ─── B: Background ───
    background: {
      comorbidities: p.riskFactors || p.comorbidities || [],
      weight: p.weight || null,
      bloodType: p.bloodType || null,
      activeOrders: orders.slice(0, 20).map(o => ({
        id: o.id, type: o.type, priority: o.priority,
        drug: (o.details&&o.details.drug)||'',
        dose: (o.details&&o.details.dose)||'',
        route: (o.details&&o.details.route)||'',
        frequency: (o.details&&o.details.frequency)||'',
        status: o.status
      })),
      io24h: { intake: ioIn, output: ioOut, balance: ioIn - ioOut }
    },

    // ─── A: Assessment ───
    assessment: {
      latestVitals: latestVital ? {
        at: latestVital.recordedAt,
        hr: latestVital.hr, rr: latestVital.rr,
        bp: latestVital.bp_sys && latestVital.bp_dia ? latestVital.bp_sys+'/'+latestVital.bp_dia : null,
        temp: latestVital.temp, spo2: latestVital.spo2,
        onOxygen: !!latestVital.onOxygen,
        consciousness: latestVital.consciousness || 'alert',
        pain: latestVital.pain
      } : null,
      news2: newsNow,
      newsRisk,
      activeAlerts: alerts.map(a => ({
        severity: a.severity, type: a.type, title: a.title,
        message: a.message, at: a.createdAt
      }))
    },

    // ─── R: Recommendation ───
    recommendation: {
      overdueMar: overdueMar.map(m => ({
        id: m.id, drug: m.drugName, dose: m.dose, route: m.route,
        scheduledAt: m.scheduledAt, minutesLate: Math.round((now - _sd(m.scheduledAt))/60000)
      })),
      upcomingMar: upcomingMar.slice(0, 10).map(m => ({
        id: m.id, drug: m.drugName, dose: m.dose, route: m.route,
        scheduledAt: m.scheduledAt, minutesUntil: Math.round((_sd(m.scheduledAt) - now)/60000)
      })),
      pendingVerify: pendingVerify.map(o => ({
        id: o.id, type: o.type, drug: (o.details&&o.details.drug)||'',
        dose: (o.details&&o.details.dose)||'', priority: o.priority
      })),
      pendingConsults: pendingConsults.map(c => ({
        id: c.id, targetService: c.targetService, question: c.question,
        consultType: c.consultType, requestedAt: c.requestedAt
      }))
    },

    // ─── Meta ───
    _meta: {
      generatedAt: new Date().toISOString(),
      generatedBy: ctx.actor ? { id: ctx.actor.id, name: ctx.actor.fullName || ctx.actor.username, role: ctx.actor.role } : null,
      format: 'SBAR',
      version: '1.0'
    }
  };
}

function _oneLine(r) {
  // Compact single-line SBAR for SMS/WhatsApp
  const s = r.situation, a = r.assessment, rec = r.recommendation;
  const parts = [];
  parts.push('🛏️ ' + r.header.name + ' | ' + r.header.ward + '/' + r.header.bed);
  if (s.allergies.length) parts.push('⚠️ حساسیت: ' + s.allergies.join(','));
  if (a.news2 != null) parts.push('NEWS2=' + a.news2 + '(' + a.newsRisk + ')');
  if (rec.overdueMar.length) parts.push('🔴 ' + rec.overdueMar.length + ' MAR عقب‌افتاده');
  if (a.activeAlerts.filter(x=>x.severity==='critical').length) parts.push('🚨 ' + a.activeAlerts.filter(x=>x.severity==='critical').length + ' هشدار بحرانی');
  return parts.join(' | ');
}

module.exports = { generate, oneLine: _oneLine };
