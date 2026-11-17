#!/bin/bash
cd /sdcard/Download/nabz || exit 1

echo "── ۱) تست ──"
RES=$(node tools/test-all.js 2>&1 | tail -5)
echo "$RES"
echo "$RES" | grep -q "ALL TESTS PASSED" || { echo "❌ تست‌ها سبز نیستند؛ پوش انجام نشد"; exit 1; }

echo "── ۲) syntax ──"
node -c public/vitals_ui.js && node -c public/app.js && node -c public/sw.js || { echo "❌ syntax"; exit 1; }

echo "── ۳) وضعیت git ──"
git remote -v | head -2
git branch --show-current

echo "── ۴) add فقط فایل‌های این کار ──"
git add public/vitals_ui.js public/app.js public/sw.js public/index.html modules/clinical.js tools/diag-vitals.sh tools/diag-patient-route.sh tools/push-vitals.sh
git status --short | grep -v '^??' | head -20

git diff --cached --quiet && { echo "ℹ️ چیزی برای commit نیست"; exit 0; }

echo "── ۵) commit ──"
git commit -m "vitals_v2: load vitals_ui in index, patient picker, interactive vitals button on patients, sw v31" || exit 1

echo "── ۶) push ──"
git push origin "$(git branch --show-current)" && echo "✅ pushed" || echo "❌ push نشد؛ خطای بالا را بفرست"
git log --oneline | head -3
