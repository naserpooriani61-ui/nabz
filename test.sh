#!/data/data/com.termux/files/usr/bin/bash
# ─── NABZ Test Helper ───
BASE="http://localhost:4000"
TOKFILE="$HOME/.nabz_token"

login() {
  echo "🔑 Logging in..."
  curl -s -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"nabz@2026"}' \
    | grep -o '"token":"[^"]*"' | cut -d'"' -f4 > "$TOKFILE"
  local t=$(cat "$TOKFILE")
  if [ -z "$t" ]; then echo "❌ Login failed"; exit 1; fi
  echo "✅ Token: ${t:0:30}..."
}

get_token() {
  if [ ! -f "$TOKFILE" ] || [ ! -s "$TOKFILE" ]; then login; return; fi
  local t=$(cat "$TOKFILE")
  # Verify token still works
  local check=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/auth/me" -H "Authorization: Bearer $t")
  if [ "$check" != "200" ]; then login; fi
}

api() {
  get_token
  local t=$(cat "$TOKFILE")
  curl -s "$@" -H "Authorization: Bearer $t"
}

case "${1:-help}" in
  login) login ;;
  qr) 
    api "$BASE/api/qr/current?ward=ICU" ;;
  scan)
    CODE="$2"
    api -X POST "$BASE/api/qr/scan" -H "Content-Type: application/json" -d "{\"code\":\"$CODE\"}" ;;
  stats)
    api "$BASE/api/neural/stats" ;;
  modules)
    api "$BASE/api/_modules" | grep -o '"modules":\[[^]]*\]' ;;
  audit)
    api "$BASE/api/admin/audit/verify" ;;
  *)
    echo "Usage: ./test.sh [login|qr|scan <code>|stats|modules|audit]" ;;
esac
echo ""
