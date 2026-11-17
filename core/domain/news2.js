'use strict';
// Canonical NEWS2 (National Early Warning Score 2)
// Duplicates removed from: modules/clinical.js, modules/safety.js, modules/nursing_mode.js
// Adopts clinical.js's correct 0-handling (safety.js treated rr=0/hr=0 as missing — clinical bug)
function _num(x) { const n = Number(x); return isFinite(n) ? n : null; }
function calc(v) {
  if (!v || typeof v !== 'object') v = {};
  let t = 0;
  const rr = _num(v.rr);
  if (rr != null) t += rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3;
  const spo2 = _num(v.spo2);
  if (spo2 != null) t += spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0;
  if (v.onOxygen) t += 2;
  const sbp = _num(v.bp_sys);
  if (sbp != null) t += sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3;
  const hr = _num(v.hr);
  if (hr != null) t += hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3;
  if (v.consciousness && v.consciousness !== 'alert') t += 3;
  const temp = _num(v.temp);
  if (temp != null) t += temp <= 35 ? 3 : temp <= 36 ? 1 : temp <= 38 ? 0 : temp <= 39 ? 1 : 2;
  const risk = t >= 7 ? 'critical' : t >= 5 ? 'high' : t >= 1 ? 'medium' : 'low';
  const action = risk === 'critical' ? 'پاسخ فوری احیا'
                : risk === 'high'     ? 'بازبینی فوری'
                : risk === 'medium'   ? 'ارزیابی پرستار'
                : 'مانیتورینگ روتین';
  return { total: t, risk, action };
}
module.exports = { calc };
