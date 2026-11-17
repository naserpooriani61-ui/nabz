#!/data/data/com.termux/files/usr/bin/bash

echo "در حال ذخیره تغییرات..."

git add .

if [ -z "$1" ]; then
  MSG="به‌روزرسانی $(date '+%Y-%m-%d %H:%M')"
else
  MSG="$1"
fi

git commit -m "$MSG"
git push

echo ""
echo "✅ تغییرات با موفقیت ذخیره و به گیت‌هاب فرستاده شد."
