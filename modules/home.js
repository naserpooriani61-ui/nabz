const { h, sd } = require('../core/mod-helpers');
const perms = require('../core/permissions');

const dashboard = (ctx) => {
  const role = ctx.actor.role;
  const ward = ctx.actor.ward;
  const isCross = perms.isCrossWard(role);
  const since = Date.now() - 86400000;

  const scopeWard = (items) => (isCross || !ward) ? items : items.filter(x => x.wardCode === ward);

  const patients = h(ctx, 'patients').filter(p => ['in_care','admitted'].includes(p.status));
  const mar = h(ctx, 'mar');
  const marDue = scopeWard(mar).filter(m => m.status === 'due' ||
    (m.status === 'scheduled' && sd(m.scheduledAt) < Date.now() + 3600000));
  const marMissed = scopeWard(mar).filter(m => m.status === 'missed' && sd(m.scheduledAt) > since);
  const vitals = scopeWard(h(ctx, 'vitals')).filter(v => sd(v.recordedAt) > since);
  const consults = h(ctx, 'consults');
  const pendingConsults = scopeWard(consults).filter(c => c.status === 'requested');
  const orders = h(ctx, 'orders');
  const pendingOrders = scopeWard(orders).filter(o => o.status === 'pending');
  const labs = h(ctx, 'labs').filter(l => l.status === 'resulted');

  const codes = h(ctx, 'ed_codes').filter(c => c.status === 'active');
  const mci = h(ctx, 'ed_mci').filter(m => m.status === 'active');
  const crisis = h(ctx, 'crisis_sessions').filter(c => c.status === 'active');
  const sepsis = h(ctx, 'sepsis').filter(s => ['suspected','confirmed','septic_shock'].includes(s.status));
  const incidents = h(ctx, 'incidents').filter(i => i.status !== 'closed');

  const isManager = ['admin','hospital_director','medical_director','nursing_director',
    'supervisor_senior','supervisor_clinical','head_nurse'].includes(role);
  const isNurse = ['nurse','nurse_aide','assistant_nurse'].includes(role);
  const isPhysician = ['physician','resident','intern','attending','specialist'].includes(role);

  const stats = [];
  if (isNurse) {
    stats.push({ label:'بیماران من', value: scopeWard(patients).length, color:'ok', action:"NABZ.show('clinical.patients')" });
    const bedStats = h(ctx, 'beds');
    const occupied = bedStats.filter(b => b.status === 'occupied').length;
    stats.push({ label:'اشغال تخت', value: occupied + '/' + bedStats.length, color: occupied/Math.max(1,bedStats.length) >= 0.85 ? 'dng' : 'ok', action:"NABZ.show('bedboard.wards')" });
    stats.push({ label:'دوز در انتظار', value: marDue.length, color: marDue.length > 0 ? 'warn' : 'ok', action:"NABZ.show('clinical.mar')" });
    stats.push({ label:'دوز missed', value: marMissed.length, color: marMissed.length > 0 ? 'dng' : 'ok', action:"NABZ.show('clinical.mar')" });
    stats.push({ label:'ویتال امروز', value: vitals.length, color:'ok', action:"NABZ.show('clinical.vitals')" });
  } else if (isPhysician) {
    stats.push({ label:'بیماران', value: scopeWard(patients).length, color:'ok', action:"NABZ.show('clinical.patients')" });
    stats.push({ label:'مشاوره در انتظار', value: pendingConsults.length, color: pendingConsults.length > 0 ? 'warn' : 'ok', action:"NABZ.show('workflow.consult')" });
    stats.push({ label:'دستور تأیید نشده', value: pendingOrders.length, color: pendingOrders.length > 0 ? 'warn' : 'ok', action:"NABZ.show('clinical.kardex')" });
    stats.push({ label:'نتیجه آزمایش', value: labs.length, color:'ok', action:"NABZ.show('paraclinical.labs')" });
  } else if (isManager) {
    stats.push({ label:'بیماران', value: scopeWard(patients).length, color:'ok', action:"NABZ.show('clinical.patients')" });
    stats.push({ label:'حوادث باز', value: incidents.length, color: incidents.length > 0 ? 'dng' : 'ok', action:"NABZ.show('safety.incidents')" });
    stats.push({ label:'بحران فعال', value: crisis.length, color: crisis.length > 0 ? 'dng' : 'ok', action:"NABZ.show('crisis.active')" });
    stats.push({ label:'دوز در انتظار', value: marDue.length, color: marDue.length > 0 ? 'warn' : 'ok', action:"NABZ.show('clinical.mar')" });
  } else {
    stats.push({ label:'بیماران', value: patients.length, color:'ok', action:"NABZ.show('clinical.patients')" });
    stats.push({ label:'کد فعال', value: codes.length, color: codes.length > 0 ? 'dng' : 'ok', action:"NABZ.show('emergency.codes')" });
    stats.push({ label:'بحران', value: crisis.length, color: crisis.length > 0 ? 'dng' : 'ok', action:"NABZ.show('crisis.active')" });
    stats.push({ label:'حوادث', value: incidents.length, color:'ok', action:"NABZ.show('safety.incidents')" });
  }

  const alerts = [];
  for (const c of codes) alerts.push({ severity:'critical', icon:'🚨', title: c.codeLabel || c.code, message: c.patientName, action:"NABZ.show('emergency.codes')" });
  for (const m of mci) alerts.push({ severity:'critical', icon:'🌐', title:'MCI فعال', message: m.incidentType, action:"NABZ.show('emergency.mci')" });
  for (const s of crisis) alerts.push({ severity:'critical', icon: s.icon || '🔥', title:'بحران: ' + s.crisisLabel, message: s.reason, action:"NABZ.show('crisis.active')" });
  for (const s of sepsis.slice(0, 3)) alerts.push({ severity:'high', icon:'🦠', title:'سپسیس مشکوک', message: s.patientName, action:"NABZ.show('safety.sepsis')" });
  for (const m of marDue.slice(0, 3)) alerts.push({ severity:'high', icon:'💊', title:'دوز در انتظار', message: (m.drugName || '') + ' — ' + (m.patientName || ''), action:"NABZ.show('clinical.mar')" });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'صبح بخیر' : hour < 18 ? 'ظهر بخیر' : 'عصر بخیر';

  return {
    greeting,
    user: { name: ctx.actor.username, role, ward },
    stats, alerts,
    quickLinks: [
      { icon:'🩺', label:'بیماران', action:"NABZ.show('clinical.patients')" },
      { icon:'💊', label:'MAR', action:"NABZ.show('clinical.mar')" },
      { icon:'📋', label:'کاردکس', action:"NABZ.show('clinical.kardex')" },
      { icon:'🚨', label:'اورژانس', action:"NABZ.show('emergency.ed')" },
      { icon:'🩺', label:'مشاوره', action:"NABZ.show('workflow.consult')" },
      { icon:'🧪', label:'آزمایشگاه', action:"NABZ.show('paraclinical.labs')" },
      { icon:'🩸', label:'بانک خون', action:"NABZ.show('paraclinical.blood')" },
      { icon:'🎓', label:'آموزش', action:"NABZ.show('education.exams')" }
    ]
  };
};

const search = (ctx) => {
  const q = (ctx.query.q || '').trim().toLowerCase();
  if (!q || q.length < 2) return { items: [], total: 0, query: q };
  const results = [];
  const scan = (module, panel, items, fields) => {
    for (const it of items) {
      if (fields.some(f => String(it[f] || '').toLowerCase().includes(q))) {
        results.push({ module, panel, item: it });
      }
    }
  };
  scan('clinical', 'patients', h(ctx, 'patients'), ['firstName','lastName','mrn','diagnosis']);
  scan('ops', 'staff', h(ctx, 'wf_staff'), ['fullName','role','ward']);
  scan('clinical', 'mar', h(ctx, 'mar'), ['drugName','patientName']);
  scan('workflow', 'consult', h(ctx, 'consults'), ['patientName','targetService','question']);
  scan('paraclinical', 'labs', h(ctx, 'labs'), ['patientName','panelName']);
  scan('safety', 'incidents', h(ctx, 'incidents'), ['description','category']);
  return { items: results.slice(0, 40), total: results.length, query: q };
};

module.exports = {
  handlers: { dashboard, search },
  routes: [
    { method: 'GET', path: '/api/home/dashboard', handler: 'dashboard', perm: null },
    { method: 'GET', path: '/api/home/search', handler: 'search', perm: null }
  ],
  panels: [
    {id:'chart_mar', title:'نمودار MAR', icon:'📊', perm:null, kind:'chart', api:'/api/home/charts/mar'},
    {id:'chart_vitals', title:'روند NEWS2', icon:'📈', perm:null, kind:'chart', api:'/api/home/charts/vitals'},
    {id:'chart_kpi', title:'روند KPI', icon:'📉', perm:'quality.view', kind:'chart', api:'/api/home/charts/kpi'}
  ]
};
