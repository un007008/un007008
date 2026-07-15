#!/usr/bin/env bash
# PropOS smoke test — run against a dev server (npm run dev) with seeded DB.
# Usage: BASE=http://localhost:3000 bash scripts/smoke.sh
set -u

BASE="${BASE:-http://localhost:3000}"
EMAIL="${SMOKE_EMAIL:-admin@bpp.local}"
PASSWORD="${SMOKE_PASSWORD:-admin1234}"
LINE_SECRET="${LINE_CHANNEL_SECRET:-dummy-dev-secret}"

TMP=$(mktemp -d)
JAR="$TMP/jar.txt"
PASS=0
FAIL=0

check() { # check <name> <expected> <actual>
  if [ "$2" = "$3" ]; then
    PASS=$((PASS + 1)); echo "  ✓ $1"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $1 (expected $2, got $3)"
  fi
}

code() { curl -s -m 60 -o /dev/null -w "%{http_code}" "$@"; }

json() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(eval('(j)=>'+process.argv[1])(JSON.parse(d)))}catch(e){console.log('ERR')}})" "$1"; }

echo "== PropOS smoke test @ $BASE =="

echo "-- public site"
check "/ redirects" "307" "$(code $BASE/)"
check "/th" "200" "$(code $BASE/th)"
check "/en" "200" "$(code $BASE/en)"
check "/zh" "200" "$(code $BASE/zh)"
check "/xx invalid locale" "404" "$(code $BASE/xx)"
check "/th/properties" "200" "$(code "$BASE/th/properties?type=CONDO")"
check "sitemap" "200" "$(code $BASE/sitemap.xml)"

echo "-- auth"
check "admin unauthenticated" "307" "$(code $BASE/admin)"
CSRF=$(curl -s -c "$JAR" $BASE/api/auth/csrf | json 'j.csrfToken')
LOGIN=$(code -b "$JAR" -c "$JAR" -X POST $BASE/api/auth/callback/credentials -d "csrfToken=$CSRF&email=$EMAIL&password=$PASSWORD&json=true")
check "login" "200" "$LOGIN"
ROLE=$(curl -s -b "$JAR" $BASE/api/auth/session | json 'j.user?.role')
check "session has role" "ADMIN" "$ROLE"
check "wrong password" "401" "$(code -X POST $BASE/api/auth/callback/credentials -d "csrfToken=$CSRF&email=$EMAIL&password=wrong&json=true" -b "$JAR")"

echo "-- admin pages"
for p in /admin /admin/inbox /admin/leads /admin/crm /admin/calendar /admin/knowledge /admin/properties /admin/media /admin/blog /admin/settings/homepage; do
  check "$p" "200" "$(code -b "$JAR" $BASE$p)"
done

echo "-- APIs guarded"
check "inbox api no session" "401" "$(code $BASE/api/inbox/conversations)"
check "knowledge api no session" "401" "$(code $BASE/api/knowledge)"
check "sse no session" "401" "$(code $BASE/api/inbox/stream)"

echo "-- LINE webhook"
BODY='{"destination":"x","events":[{"type":"message","mode":"active","timestamp":1752480000000,"source":{"type":"user","userId":"U_smoke_test"},"webhookEventId":"smoke1","deliveryContext":{"isRedelivery":false},"replyToken":"rt","message":{"id":"sm1","type":"text","text":"ค่านายหน้าเท่าไหร่"}}]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$LINE_SECRET" -binary | base64)
check "webhook valid signature" "200" "$(code -X POST $BASE/api/webhook/line -H "Content-Type: application/json" -H "x-line-signature: $SIG" -d "$BODY")"
check "webhook bad signature" "401" "$(code -X POST $BASE/api/webhook/line -H "Content-Type: application/json" -H "x-line-signature: aW52YWxpZA==" -d "$BODY")"

echo "-- knowledge CRUD"
NEW=$(curl -s -b "$JAR" -X POST $BASE/api/knowledge -H "Content-Type: application/json" -d '{"question":"smoke ทดสอบ","answer":"คำตอบ smoke"}')
KID=$(echo "$NEW" | json 'j.id')
[ "$KID" != "ERR" ] && [ -n "$KID" ] && check "create entry" "ok" "ok" || check "create entry" "ok" "fail"
check "delete entry" "200" "$(code -b "$JAR" -X DELETE $BASE/api/knowledge/$KID)"

echo "-- public booking -> lead"
PID=$(curl -s -b "$JAR" "$BASE/api/properties?q=PS-00001" | json 'j[0]?.id')
check "booking form" "201" "$(code -X POST $BASE/api/public/viewing -H "Content-Type: application/json" -d "{\"propertyId\":\"$PID\",\"name\":\"Smoke Test\",\"phone\":\"0800000000\"}")"
check "booking missing fields" "400" "$(code -X POST $BASE/api/public/viewing -H "Content-Type: application/json" -d '{"name":"x"}')"

echo "-- exports"
check "leads csv" "200" "$(code -b "$JAR" $BASE/api/admin/export/leads)"
check "deals csv" "200" "$(code -b "$JAR" $BASE/api/admin/export/deals)"

rm -rf "$TMP"
echo "== done: $PASS passed, $FAIL failed =="
[ "$FAIL" = "0" ]
