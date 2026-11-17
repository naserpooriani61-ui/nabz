'use strict';
const http = require('http');
function req(method, p, data, token) {
  return new Promise(res => {
    const body = data ? JSON.stringify(data) : null;
    const o = { hostname:'localhost', port:4000, path:p, method, timeout:8000, headers:{} };
    if (body) { o.headers['Content-Type']='application/json'; o.headers['Content-Length']=Buffer.byteLength(body); }
    if (token) o.headers['Authorization'] = 'Bearer ' + token;
    const r = http.request(o, r2 => {
      let b = ''; r2.on('data', x => b += x);
      r2.on('end', () => { let pp = null; try { pp = JSON.parse(b); } catch(_){} res({ status:r2.statusCode, parsed:pp }); });
    });
    r.on('error', e => res({ status:0, error:e.message }));
    if (body) r.write(body); r.end();
  });
}

(async () => {
  console.log('\n═══ تست Encounters ═══\n');

  // 1) login
  const lg = await req('POST', '/api/auth/login', { username:'admin', password:'nabz@2026' });
  if (!lg.parsed || !lg.parsed.ok) { console.error('❌ login'); return; }
  const token = lg.parsed.data.token;
  console.log('✓ login');

  // 2) patient
  const patients = await req('GET', '/api/clinical/patients', null, token);
  const pid = patients.parsed.data.items[0].id;
  console.log('✓ patient:', patients.parsed.data.items[0].firstName, '·', pid);

  // 3) soap data
  const soap = await req('GET', '/api/enc/soap/' + pid, null, token);
  if (!soap.parsed.ok) { console.error('❌ soap', soap.parsed); return; }
  console.log('✓ soap data:', soap.parsed.data.orderSets.length, 'order sets,', soap.parsed.data.pathwayTemplates.length, 'pathways');

  // 4) create round
  const cr = await req('POST', '/api/enc/round', {
    patientId: pid, subtype: 'morning',
    subjective: { chiefComplaint: 'درد قفسه سینه', history: 'HTN، DM' },
    objective: { physicalExam: 'BP ۱۳۰/۸۰، HR ۸۸' },
    assessment: { diagnoses: ['ACS'], severity: 'moderate', clinicalImpression: 'احتمال ACS' },
    plan: { medications: [{ drug:'Aspirin', dose:'325mg' }], diet: 'کم‌نمک' }
  }, token);
  if (!cr.parsed.ok) { console.error('❌ create round', cr.parsed); return; }
  console.log('✓ round created:', cr.parsed.data.id, '· status:', cr.parsed.data.status);

  // 5) sign round
  const sr = await req('POST', '/api/enc/round/' + cr.parsed.data.id + '/sign', {}, token);
  if (!sr.parsed.ok) { console.error('❌ sign', sr.parsed); return; }
  console.log('✓ round signed, status:', sr.parsed.data.status, '· cosignRequired:', sr.parsed.data.cosignRequired);

  // 6) list order sets
  const os = await req('GET', '/api/enc/ordersets', null, token);
  console.log('✓ order sets:', os.parsed.data.total);
  for (const s of os.parsed.data.items) console.log('   ', s.icon, s.name);

  // 7) apply order set
  const apply = await req('POST', '/api/enc/ordersets/stemi/apply', { patientId: pid }, token);
  if (!apply.parsed.ok) { console.error('❌ apply', apply.parsed); return; }
  console.log('✓ STEMI applied:', apply.parsed.data.total, 'items created');
  console.log('   ', JSON.stringify(apply.parsed.data.created));

  // 8) create procedure
  const proc = await req('POST', '/api/enc/procedure', {
    patientId: pid, type: 'central_line',
    indication: 'دسترسی عروقی برای وازوپرسور',
    consentObtained: true
  }, token);
  if (!proc.parsed.ok) { console.error('❌ proc', proc.parsed); return; }
  console.log('✓ procedure created:', proc.parsed.data.typeLabel);

  // 9) update (all checklist done)
  const procId = proc.parsed.data.id;
  await req('PUT', '/api/enc/procedure/' + procId, {
    checklist: proc.parsed.data.checklist.map(c => ({ item: c.item, done: true }))
  }, token);
  const started = await req('PUT', '/api/enc/procedure/' + procId, { start: true }, token);
  console.log('✓ procedure started, timeOut:', !!started.parsed.data.timeOut);

  // 10) complete (needs findings)
  const done = await req('POST', '/api/enc/procedure/' + procId + '/complete', {
    note: { findings: 'Central line در ورید ژوگولار داخلی راست', complications: 'ندارد', technique: 'Sterile، US-guided' }
  }, token);
  if (!done.parsed.ok) { console.error('❌ complete', done.parsed); return; }
  console.log('✓ procedure completed:', done.parsed.data.durationMin, 'min');

  // 11) start pathway
  const pw = await req('POST', '/api/enc/pathways/stemi_pathway/start', { patientId: pid }, token);
  if (!pw.parsed.ok) { console.error('❌ pathway', pw.parsed); return; }
  console.log('✓ STEMI pathway started,', pw.parsed.data.milestones.length, 'milestones');

  // 12) advance milestone
  const adv = await req('POST', '/api/enc/pathway/' + pw.parsed.data.id + '/advance', {
    milestoneLabel: 'ECG ۱۲ لید', note: 'انجام شد'
  }, token);
  if (!adv.parsed.ok) { console.error('❌ advance', adv.parsed); return; }
  console.log('✓ milestone advanced:', adv.parsed.data.milestones[0].done);

  console.log('\n═══════════════════════════════════════════════');
  console.log('✅ همه ۱۲ تست موفق');
  console.log('═══════════════════════════════════════════════\n');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
