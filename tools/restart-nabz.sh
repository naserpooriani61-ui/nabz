#!/data/data/com.termux/files/usr/bin/bash
cd /sdcard/Download/nabz
echo "── killing old node ──"
pkill -9 -f "node.*server.js" 2>/dev/null
pkill -9 node 2>/dev/null
sleep 2
echo "── starting server (background) ──"
nohup npm start > /sdcard/nabz.log 2>&1 &
echo "  PID: $!"
sleep 4
echo "── health check ──"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" http://localhost:4000/ 2>/dev/null || echo "  ❌ failed to start"
echo "── recent log ──"
tail -8 /sdcard/nabz.log 2>/dev/null
echo ""
echo "✅ restart complete"
