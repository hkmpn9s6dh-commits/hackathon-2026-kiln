#!/usr/bin/env bash
# KILN — one command that proves the thing works.
#
#   npm ci && bash scripts/verify.sh
#
# Steps: toolchain → types → lint → unit tests → build → preflight → balance
# sweep → hygiene → a real HTTP round trip against the local server.
# Every step fails the script. Nothing is skipped when a step fails silently
# because it was piped into `tail`.

set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

pass=0
fail=0
step_no=0
LOG="$(mktemp)"

say() { printf '\n\033[1m[%02d] %s\033[0m\n' "$((step_no += 1))" "$1"; }
ok() { printf '     \033[32mPASS\033[0m %s\n' "$1"; pass=$((pass + 1)); }
no() {
  printf '     \033[31mFAIL\033[0m %s\n' "$1"
  sed 's/^/         /' "$LOG" | tail -25
  fail=$((fail + 1))
}

run() {
  local label="$1"
  shift
  if "$@" >"$LOG" 2>&1; then ok "$label"; else no "$label"; fi
}

say 'node'
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>=24?0:1)' \
  && ok "node $(node -v)" || no "node $(node -v) is below the Devvit Web floor (24)"

if [[ ! -d node_modules ]]; then
  say 'install'
  echo '     node_modules missing — run `npm ci` first (README, "Run it").'
  fail=$((fail + 1))
else
  say 'types'
  run 'tsc --build' npx tsc --build

  say 'lint'
  run 'eslint' npx eslint "src/**/*.{ts,tsx}" scripts/*.mjs

  say 'unit tests'
  run 'node --test' node --test --experimental-strip-types --no-warnings=ExperimentalWarning "src/**/*.test.ts"

  say 'build'
  run 'vite build' npx vite build

  say 'preflight'
  run 'devvit.json ⇄ artifact' node scripts/preflight.mjs

  say 'balance'
  run '365-day sweep' env DAYS=365 node scripts/sweep.mjs

  say 'hygiene'
  hygiene_fail=0
  if grep -rn "localhost\|127\.0\.0\.1" src/ >"$LOG" 2>&1; then
    echo '     localhost leaked into src/:' >&2
    no 'no localhost in shipped source'
    hygiene_fail=1
  else ok 'no localhost in shipped source'; fi

  if grep -rnF 'C:\Users' src/ >>"$LOG" 2>&1 || grep -rnF '/Users/' src/ >>"$LOG" 2>&1; then
    no 'no absolute local paths'
    hygiene_fail=1
  else ok 'no absolute local paths'; fi

  if grep -rn "TODO\|FIXME\|XXX" src/ >>"$LOG" 2>&1; then
    no 'no TODO/FIXME in src'
    hygiene_fail=1
  else ok 'no TODO/FIXME in src'; fi

  if grep -rn "console\.log" src/ >>"$LOG" 2>&1; then
    no 'no console.log in src (console.error is fine)'
    hygiene_fail=1
  else ok 'no console.log in src'; fi

  [[ $hygiene_fail -eq 0 ]] || true

  say 'http round trip'
  PORT=$((5600 + RANDOM % 300))
  DATA=".verify-$$.json"
  PORT="$PORT" SEED=4 KILN_DATA="$DATA" node scripts/preview.mjs >"$LOG" 2>&1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null; rm -f "$DATA"' EXIT
  up=0
  for _ in $(seq 1 40); do
    if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then up=1; break; fi
    sleep 0.25
  done
  if [[ $up -eq 1 ]]; then
    ok 'server answers /api/health'
    if curl -fsS "http://127.0.0.1:$PORT/api/init" >"$LOG" 2>&1 && grep -q '"type":"init"' "$LOG"; then
      ok 'GET /api/init returns a day'
    else no 'GET /api/init'; fi
    code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$PORT/api/fire" \
      -H 'content-type: application/json' \
      --data '{"x":0.5,"y":0.5,"samples":[{"t":0,"temp":0}]}')
    if [[ "$code" == "400" ]]; then
      ok 'POST /api/fire rejects a firing with no trace'
    else no "POST /api/fire rejects a firing with no trace (got $code)"; fi
  else
    no 'server started'
  fi
  kill "$SERVER" 2>/dev/null
  rm -f "$DATA"
  trap - EXIT
fi

rm -f "$LOG"
printf '\n────────────────────────────────────────\n'
printf ' %d passed, %d failed\n' "$pass" "$fail"
[[ $fail -eq 0 ]] || exit 1
printf ' verify: clean\n'
