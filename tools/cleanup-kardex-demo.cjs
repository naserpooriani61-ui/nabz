'use strict';
const path = require('path');
process.chdir(path.resolve(__dirname, '..'));
const store = require('../core/store');
const PID = process.argv[2] || 'pat_001';
const SEEDS = ['kardex-demo-v1', 'kardex-demo-v2'];
let total = 0;
['orders','mar','vitals','consults','io_records'].forEach(coll => {
  const items = store.readAll(coll).filter(r => r.patientId === PID && SEEDS.includes(r._seed));
  items.forEach(r => store.remove(coll, r.id));
  if (items.length) console.log('  ' + coll + ': removed ' + items.length);
  total += items.length;
});
const alerts = store.readAll('cdss_alerts').filter(r => r.patientId === PID && (String(r.type||'').startsWith('demo_') || r._seed));
alerts.forEach(r => store.remove('cdss_alerts', r.id));
if (alerts.length) console.log('  cdss_alerts: removed ' + alerts.length);
total += alerts.length;
console.log('✅ cleanup complete — ' + total + ' records removed');
