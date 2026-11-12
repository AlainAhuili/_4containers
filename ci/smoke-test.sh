#!/usr/bin/env bash
# Smoke test for a running stack (start it first with: docker compose up -d --wait).
# Checks every service answers and does what it is for. Exits non-zero on the first failure.
set -euo pipefail

pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }
get()  { curl -fsS --max-time 10 "$1"; }

echo "Dashboard (8080)"
get http://127.0.0.1:8080/healthz | grep -qx ok && pass "health endpoint" || fail "health endpoint"
status=$(get http://127.0.0.1:8080/api/status)
echo "    status: $status"
python3 - "$status" <<'PY' && pass "reports all 4 services up" || fail "a service is reported down"
import json, sys
s = json.loads(sys.argv[1])
assert set(s) == {"dashboard", "paint", "console", "whiteboard"}, s
assert all(v["up"] for v in s.values()), s
PY
get http://127.0.0.1:8080/ | grep -q 'class="split split-h"' && pass "serves the resizable grid" || fail "dashboard page"

echo "Paint (8081)"
page=$(get http://127.0.0.1:8081/)
grep -q '<title>miniPaint' <<<"$page" && pass "miniPaint loads" || fail "miniPaint page"
grep -q 'wb-sync.js' <<<"$page" && pass "whiteboard sync script included" || fail "wb-sync.js missing"
grep -q 'no-tools.js' <<<"$page" && pass "drawing tools disabled" || fail "no-tools.js missing"
get http://127.0.0.1:8081/dist/bundle.js >/dev/null && pass "app bundle served" || fail "bundle.js"

echo "Whiteboard (8083)"
get http://127.0.0.1:8083/ | grep -q '<title>Whiteboard</title>' && pass "whiteboard loads" || fail "whiteboard page"
curl -fsSI --max-time 10 http://127.0.0.1:8083/ | grep -qi '^cache-control: no-cache' && pass "no-cache header" || fail "cache header"

echo "Console (8082)"
get http://127.0.0.1:8082/ >/dev/null && pass "terminal page served" || fail "ttyd page"
docker compose exec -T console bash -lc 'grep -q "Ubuntu 24.04" /etc/os-release' && pass "Ubuntu 24.04" || fail "OS check"
docker compose exec -T console bash -lc 'test "$(whoami)" = dev && sudo -n true' && pass "user dev with sudo" || fail "user/sudo"
docker compose exec -T console bash -lc 'test -f ~/workspace/compose.yaml' && pass "workspace mounted" || fail "workspace mount"

echo "All smoke tests passed."
