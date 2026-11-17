#!/bin/bash
cd /sdcard/Download/nabz
echo "════ A) هندلر vitalsChart ════"
grep -n "vitalsChart" public/*.js modules/*.js core/*.js 2>/dev/null | grep -v "vitals_ui.js" | head -20
echo ""
echo "════ B) app.js اطراف دکمهٔ آیتم (570-595) ════"
sed -n '570,595p' public/app.js
echo ""
echo "════ C) کلیک روی بیمار در لیست: چه چیزی باز می‌شود؟ ════"
grep -n "handover\|openPatient\|showPatient\|patientCard\|kind: *'patient" public/app.js public/zz_drawer_v3.js public/zz_dispatch.js 2>/dev/null | head -25
echo ""
echo "════ D) چه کسی NABZ.show را wrap کرده؟ ════"
grep -n "NABZ.show *=" public/*.js | head
