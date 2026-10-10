#!/usr/bin/env bash
# End-to-end smoke test against a deployed API.
#   scripts/smoke.sh [api_base] [clip]
set -euo pipefail
cd "$(dirname "$0")/.."
API="${1:-$(grep -E '^API_BASE=' .env 2>/dev/null | cut -d= -f2-)}"
CLIP="${2:-../clips/FIX01.mp4}"
[ -n "$API" ] || { echo "usage: scripts/smoke.sh <api_base> [clip]"; exit 2; }
pass() { printf '  \033[32mPASS\033[0m %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAILED=1; }
FAILED=0
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"; }

echo "API: $API"
[ "$(curl -s "$API/health" | j 'd["ok"]')" = "True" ] && pass health || fail health
curl -s "$API/config" | j '"flags" in d' | grep -q True && pass config || fail config

code=$(curl -s -o /dev/null -w '%{http_code}' -F "file=@/etc/hostname;type=text/plain" "$API/episodes")
[ "$code" = 415 ] && pass "non-video rejected (415)" || fail "non-video rejected (got $code)"

t0=$(date +%s)
ID=$(curl -s -F "file=@$CLIP;type=video/mp4" "$API/episodes" | j 'd["id"]')
echo "  uploaded $CLIP → $ID"
status=""
for _ in $(seq 1 150); do
  status=$(curl -s "$API/episodes/$ID" | j 'd["status"]')
  [[ "$status" == ready || "$status" == failed ]] && break
  sleep 1
done
[ "$status" = ready ] && pass "processed in $(( $(date +%s) - t0 ))s" || { fail "processing ended as '$status'"; curl -s "$API/episodes/$ID" | j 'd["error"]'; exit 1; }

EP=$(curl -s "$API/episodes/$ID")
echo "$EP" | j 'len(d["episode"]["actions"])>0 and d["episode"]["schema_version"]=="0.2"' | grep -q True && pass "episode has actions (schema 0.2)" || fail "episode content"

code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Range: bytes=0-99' "$API/episodes/$ID/video")
[ "$code" = 206 ] && pass "video range request (206)" || fail "video range (got $code)"

A1=$(echo "$EP" | j 'd["episode"]["actions"][0]["id"]')
OUT=$(curl -s -X PATCH -H 'Content-Type: application/json' \
  -d "{\"changes\":[{\"target\":\"$A1\",\"field\":\"observed_action\",\"value\":\"smoke-test edit\"}]}" "$API/episodes/$ID")
echo "$OUT" | j 'd["episode"]["actions"][0]["observed_action"]=="smoke-test edit" and len(d["episode"]["actions"][0]["human_corrections"])==1' | grep -q True && pass "correction applied + recorded" || fail "correction"

code=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H 'Content-Type: application/json' \
  -d '{"changes":[{"target":"action-99","field":"outcome","value":"success"}]}' "$API/episodes/$ID")
[ "$code" = 422 ] && pass "bad correction rejected (422)" || fail "bad correction (got $code)"

curl -s "$API/episodes/$ID/export?format=json" | j 'd["actions"][0]["observed_action"]' | grep -q "smoke-test edit" && pass "export JSON includes correction" || fail "export json"
TMP=$(mktemp -d)
curl -s -o "$TMP/e.zip" "$API/episodes/$ID/export?format=zip"
python3 -c "import zipfile,sys; n=zipfile.ZipFile(sys.argv[1]).namelist(); sys.exit(0 if set(n)=={'episode.json','episode.mp4'} else 1)" "$TMP/e.zip" && pass "export zip (episode.json + episode.mp4)" || fail "export zip"
rm -rf "$TMP"

exit $FAILED
