#!/usr/bin/env node
'use strict';
// tools/test-ed.js — تست‌های مستقل اورژانس (بدون نیاز به store/سرور)
const path = require('path');
const esi = require(path.join(__dirname, '..', 'core', 'domain', 'ed-esi.js'));
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ✅ ' + name); } catch (e) { fail++; console.log('  ❌ ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' expected ' + b + ' got ' + a); }
function ok(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
const base = { lifeSaving: false, highRisk: false, ageYears: 30, vitals: {} };
const mk = (o) => Object.assign({}, base, o);

console.log('ED / ESI engine');
t('بدون منابع → سطح null (هرگز ۵ پیش‌فرض)', () => { const r = esi.suggest(mk({})); eq(r.level, null); ok(r.missing.indexOf('resources') >= 0); });
t('پرسش A/B بی‌پاسخ → ناقص', () => { const r = esi.suggest({ ageYears: 30, resources: 2, vitals: {} }); eq(r.level, null); ok(r.missing.indexOf('lifeSaving') >= 0); });
t('مداخلهٔ نجات‌بخش → ۱', () => eq(esi.suggest(mk({ lifeSaving: true })).level, 1));
t('پرخطر → ۲', () => eq(esi.suggest(mk({ highRisk: true })).level, 2));
t('درد ۸ → ۲', () => eq(esi.suggest(mk({ painScore: 8 })).level, 2));
t('منابع ۰ → ۵', () => eq(esi.suggest(mk({ resources: 0 })).level, 5));
t('منابع ۱ → ۴', () => eq(esi.suggest(mk({ resources: 1 })).level, 4));
t('منابع ۲ → ۳', () => eq(esi.suggest(mk({ resources: 2 })).level, 3));
t('بزرگسال HR=120 + منابع ۲ → ۳ با پیشنهاد ارتقا به ۲', () => { const r = esi.suggest(mk({ resources: 2, vitals: { hr: 120 } })); eq(r.level, 3); eq(r.considerLevel, 2); eq(r.dangerVitals.length, 1); });
t('کودک ۲ ساله HR=150 ناحیهٔ خطر نیست', () => eq(esi.suggest(mk({ ageYears: 2, resources: 2, vitals: { hr: 150 } })).dangerVitals.length, 0));
t('کودک ۲ ساله HR=170 ناحیهٔ خطر است', () => eq(esi.suggest(mk({ ageYears: 2, resources: 2, vitals: { hr: 170 } })).dangerVitals.length, 1));
t('شیرخوار ۲ ماهه با تب ۳۸٫۵ → ۲', () => eq(esi.suggest(mk({ ageYears: null, ageMonths: 2, resources: 0, vitals: { temp: 38.5 } })).level, 2));
t('GCS=7 → ۱', () => eq(esi.suggest(mk({ resources: 0, vitals: { gcs: 7 } })).level, 1));
t('rr=0 (آپنه) یک مقدار معتبر است → ۱', () => eq(esi.suggest(mk({ resources: 0, vitals: { rr: 0 } })).level, 1));
t('فشار با کلید bp_sys خوانده می‌شود', () => eq(esi.suggest(mk({ resources: 0, vitals: { bp_sys: 70 } })).level, 1));
t('SBP=70 در کودک ۵ ساله بحرانی بزرگسال حساب نمی‌شود', () => eq(esi.suggest(mk({ ageYears: 5, resources: 0, vitals: { sbp: 70 } })).criticalFlags.length, 0));
t('compare: انتخاب ۴ در برابر پیشنهاد ۲ → دلیل لازم', () => { const c = esi.compare({ level: 2 }, 4); eq(c.direction, 'under'); eq(c.reasonRequired, true); });
t('compare: انتخاب ۱ در برابر پیشنهاد ۲ → بدون دلیل', () => { const c = esi.compare({ level: 2 }, 1); eq(c.direction, 'over'); eq(c.reasonRequired, false); });
t('compare: قبول ۳ با پیشنهاد ارتقا به ۲ → دلیل لازم', () => eq(esi.compare({ level: 3, considerLevel: 2 }, 3).reasonRequired, true));
t('compare: سطح نامعتبر', () => eq(esi.compare({ level: 2 }, 9).valid, false));

console.log('\n  Results: ' + pass + '/' + (pass + fail) + ' passed');
if (fail) { console.log('  ❌ ED TESTS FAILED'); process.exit(1); }
console.log('  ✅ ALL ED TESTS PASSED');
