#!/bin/bash
cd /sdcard/Download/nabz || exit 1

echo "── ۱) .gitignore ──"
cp .gitignore .gitignore.bak-$(date +%s)
for d in "data/" "backups/"; do
  grep -qxF "$d" .gitignore || printf '\n# runtime data: never commit\n%s\n' "$d" >> .gitignore
done
grep -nE '^(data|backups)/$' .gitignore

echo "── ۲) قطع ردیابی (فایل‌های محلی می‌مانند) ──"
git rm -r -q --cached data 2>/dev/null
git rm -r -q --cached backups 2>/dev/null
git add .gitignore

echo "── ۳) نگهبان: باید صفر باشد ──"
A=$(git ls-files data | wc -l)
B=$(git ls-files backups | wc -l)
echo "data=$A backups=$B"
[ "$A" = "0" ] && [ "$B" = "0" ] || { echo "❌ هنوز ردیابی می‌شود؛ push انجام نشد"; exit 1; }
[ -d data ] && echo "✅ پوشهٔ data محلی سالم است: $(ls data | wc -l) آیتم"

echo "── ۴) تاریخچهٔ تازه بدون داده ──"
git checkout --orphan clean-main2 || exit 1
git add -A
C=$(git ls-files | grep -cE '^(data|backups)/')
echo "فایل‌های data/backups در commit جدید: $C"
[ "$C" = "0" ] || { echo "❌ نشت در commit جدید؛ متوقف شد"; git checkout -q main 2>/dev/null; exit 1; }
git commit -q -m "NABZ: clean history (code only; data and backups untracked)" || exit 1
git branch -D main 2>/dev/null
git branch -m main

echo "── ۵) push ──"
git push -f origin main && echo "✅ pushed (clean)"
git log --oneline | head -3
git ls-files | wc -l
