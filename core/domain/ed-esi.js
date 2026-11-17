'use strict';
// core/domain/ed-esi.js — پشتیبان تصمیم ESI v4 (فقط پیشنهاد؛ تصمیم نهایی با پرستار تریاژ)
// اصل ایمنی: بدون پاسخ به پرسش‌های A/B و منابع، هرگز سطح پیش‌فرض پیشنهاد نمی‌شود.
const fs = require('fs');
const path = require('path');

let _cfg = null;
function cfg() {
  if (!_cfg) _cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'ed-config.json'), 'utf8'));
  return _cfg;
}
function reloadConfig() { _cfg = null; return cfg(); }
// مقدار 0 معتبر است (مثلاً rr=0)؛ فقط null/undefined/'' یعنی ثبت نشده
function num(x) {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return isFinite(n) ? n : null;
}

function ageMonthsOf(i) {
  const m = num(i.ageMonths);
  if (m != null) return m;
  const y = num(i.ageYears != null ? i.ageYears : i.age);
  return y == null ? null : y * 12;
}

function ageBracket(ageMonths, config) {
  const list = (config || cfg()).dangerZone.brackets;
  if (ageMonths == null) return list[list.length - 1];
  for (const b of list) if (ageMonths < b.maxAgeMonths) return b;
  return list[list.length - 1];
}

function suggest(input, config) {
  const C = config || cfg();
  const i = input || {};
  const v = i.vitals || {};
  const hr = num(v.hr), rr = num(v.rr), spo2 = num(v.spo2), gcs = num(v.gcs), temp = num(v.temp);
  const sbp = num(v.sbp != null ? v.sbp : v.bp_sys);
  const am = ageMonthsOf(i);
  const ageY = am == null ? null : am / 12;
  const reasons = [], warnings = [], missing = [];
  if (am == null) warnings.push('سن ثبت نشده؛ آستانه‌های بزرگسال به‌کار رفت');

  // علائم بحرانی (پیشنهاد سطح ۱)
  const K = C.critical, crit = [];
  if (gcs != null && gcs <= K.gcsAtOrBelow) crit.push('GCS ≤ ' + K.gcsAtOrBelow);
  if (spo2 != null && spo2 < K.spo2Below) crit.push('SpO2 < ' + K.spo2Below);
  if (ageY == null || ageY >= K.fromAgeYears) {
    if (sbp != null && sbp < K.sbpBelow) crit.push('SBP < ' + K.sbpBelow);
    if (rr != null && (rr < K.rrBelow || rr > K.rrAbove)) crit.push('RR خارج از ' + K.rrBelow + '–' + K.rrAbove);
  }

  // ناحیهٔ خطر (نقطهٔ تصمیم D)
  const br = ageBracket(am, C), danger = [];
  if (hr != null && hr > br.hrAbove) danger.push('HR > ' + br.hrAbove);
  if (rr != null && rr > br.rrAbove) danger.push('RR > ' + br.rrAbove);
  if (spo2 != null && spo2 < C.dangerZone.spo2Below) danger.push('SpO2 < ' + C.dangerZone.spo2Below);

  const F = C.febrileInfant;
  const febrileInfant = am != null && am < F.maxAgeMonths && temp != null && temp >= F.tempAtOrAbove;
  const pain = num(i.painScore);
  const res = num(i.resources);

  let level = null, considerLevel = null;
  if (i.lifeSaving === true) {
    level = 1; reasons.push('A: نیاز به مداخلهٔ نجات‌بخش فوری');
  } else if (crit.length) {
    level = 1; reasons.push('علائم حیاتی بحرانی: ' + crit.join('، '));
  } else if (i.highRisk === true || i.confused === true || (pain != null && pain >= C.esi.severePainAtOrAbove)) {
    level = 2; reasons.push('B: وضعیت پرخطر / گیجی / درد شدید');
  } else if (febrileInfant) {
    level = 2; reasons.push('شیرخوار تب‌دار');
  } else {
    if (i.lifeSaving !== false) missing.push('lifeSaving');
    if (i.highRisk !== false) missing.push('highRisk');
    if (res == null || res < 0) missing.push('resources');
    if (!missing.length) {
      level = res === 0 ? 5 : res === 1 ? 4 : 3;
      reasons.push('C: منابع مورد انتظار = ' + (res >= 2 ? '۲ یا بیشتر' : res));
      if (danger.length && level === 3) {
        considerLevel = 2;
        reasons.push('D: علائم ناحیهٔ خطر (' + danger.join('، ') + ') — ارتقا به ۲ را بسنجید');
      } else if (danger.length) {
        warnings.push('علائم ناحیهٔ خطر (' + danger.join('، ') + ') — بازنگری سطح لازم است');
      }
    }
  }

  return {
    level, complete: level != null, missing, reasons, warnings, considerLevel,
    criticalFlags: crit, dangerVitals: danger, febrileInfant,
    ageBracket: br.label,
    maxWaitMin: level != null ? C.esi.maxWaitMin[String(level)] : null,
    reassessMin: level != null ? C.esi.reassessMin[String(level)] : null
  };
}

// مقایسهٔ پیشنهاد با انتخاب پرستار؛ انتخاب کم‌خطرتر از پیشنهاد (یا از سطح ارتقای D) دلیل می‌خواهد
function compare(suggestion, chosenLevel) {
  const ch = num(chosenLevel);
  if (ch == null || ch < 1 || ch > 5) return { valid: false, direction: null, reasonRequired: false };
  const s = suggestion && suggestion.level != null ? suggestion.level : null;
  const k = suggestion && suggestion.considerLevel != null ? suggestion.considerLevel : null;
  let direction = 'unsupported';
  if (s != null) direction = ch === s ? 'same' : ch > s ? 'under' : 'over';
  return { valid: true, direction, reasonRequired: (s != null && ch > s) || (k != null && ch > k) };
}

module.exports = { suggest, compare, ageBracket, reloadConfig, getConfig: cfg };
