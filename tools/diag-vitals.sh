#!/bin/bash
cd /sdcard/Download/nabz
echo "════ A) تگ‌های script در index.html ════"
grep -n "<script" public/index.html | tail -40
echo ""
echo "════ B) آیا سرور vitals_ui را در صفحه می‌دهد؟ ════"
curl -s http://localhost:4000/ | grep -n "vitals_ui" || echo "NOT in served HTML"
curl -s -o /dev/null -w "vitals_ui.js HTTP %{http_code}\n" http://localhost:4000/vitals_ui.js
echo ""
echo "════ C) مسیر باز شدن از بیماران ════"
grep -n "vitalsChart\|kind: *'vitals\|show('vitals\|show(\"vitals\|'vitals'" public/*.js | grep -v "vitals_ui.js" | head -30
echo ""
echo "════ D) لودر اسکریپت‌ها (اگر index دینامیک است) ════"
grep -n "mar_advanced_ui" public/*.html public/*.js core/*.js 2>/dev/null | head
