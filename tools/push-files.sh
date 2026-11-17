#!/bin/bash
# استفاده: bash tools/push-files.sh "پیام commit" file1 file2 ...
cd /sdcard/Download/nabz || exit 1
MSG="$1"; shift
if [ -z "$MSG" ] || [ $# -eq 0 ]; then echo "usage: bash tools/push-files.sh \"message\" file1 file2 ..."; exit 1; fi
for f in "$@"; do
  case "$f" in data/*|backups/*|*.bak*|*.broken*|.env*|tools/_*) echo "❌ فایل ممنوع: $f"; exit 1;; esac
  [ -f "$f" ] || { echo "❌ فایل وجود ندارد: $f"; exit 1; }
done
node tools/test-all.js 2>&1 | tail -6 | grep -q "ALL TESTS PASSED" || { echo "❌ test-all سبز نیست؛ پوش نشد"; exit 1; }
if [ -f tools/test-ed.js ]; then node tools/test-ed.js >/dev/null 2>&1 || { echo "❌ test-ed سبز نیست؛ پوش نشد"; exit 1; }; fi
if [ -f tools/test-ed-flow.js ]; then node tools/test-ed-flow.js >/dev/null 2>&1 || { echo "❌ test-ed-flow سبز نیست؛ پوش نشد"; exit 1; }; fi
git add -- "$@"
git diff --cached --quiet -- "$@" && { echo "ℹ️ تغییری برای commit نیست"; exit 0; }
git commit -m "$MSG" -- "$@" || exit 1
git push origin "$(git branch --show-current)" && echo "✅ pushed" || echo "❌ push نشد؛ خطا را بفرست"
git log --oneline | head -3
