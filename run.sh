#!/data/data/com.termux/files/usr/bin/bash
# ─── NABZ Stable Runner for Termux ───
cd "$(dirname "$0")"

# ۱) Wake lock: CPU را بیدار نگه دار
command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock

# ۲) پاک‌سازی همه instanceهای قبلی
for pid in $(pgrep -f "core/server.js" 2>/dev/null); do
  echo "🧹 Killing old PID $pid"
  kill -9 "$pid" 2>/dev/null
done
sleep 1

# ۳) محدود کردن heap (خیلی مهم برای Android)
export NODE_OPTIONS="--max-old-space-size=384 --max-semi-space-size=16"

# ۴) اجرا با auto-restart
echo "🫀 Starting NABZ..."
while true; do
  node core/server.js
  code=$?
  if [ $code -eq 0 ]; then
    echo "✅ Server exited cleanly"
    break
  fi
  if [ $code -eq 137 ]; then
    echo "⚠️  OOM killed (137) — restarting in 3s..."
    sleep 3
  else
    echo "❌ Crashed with code $code — restarting in 2s..."
    sleep 2
  fi
done
