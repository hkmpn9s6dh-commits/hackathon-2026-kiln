#!/usr/bin/env bash
# One command, from a fresh clone to "this is what will be uploaded".
# Exit code is the verdict.

set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

step "node"
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
echo "node $(node -v), npm $(npm -v)"
if [ "$NODE_MAJOR" -lt 24 ]; then
  echo "Devvit Web needs Node >= 24 (the template's engines field says so)." >&2
  exit 1
fi

# This machine has bitten us: parallel workers sharing one temp file make
# vitest exit 0 while a test file never loads. Keep temp inside the repo and
# check the count, not just the exit code.
export TEMP="$PWD/.tmp"
export TMP="$PWD/.tmp"
mkdir -p "$TEMP"

step "type check"
npx tsc --build

step "unit tests"
TEST_LOG="$TEMP/vitest.log"
NO_COLOR=1 FORCE_COLOR=0 npx vitest run 2>&1 | tee "$TEST_LOG"
PASSED=$(sed -E 's/\[[0-9;]*m//g' "$TEST_LOG" | grep -Eo 'Tests +[0-9]+ passed' | grep -Eo '[0-9]+' | tail -1 || true)
if [ -z "${PASSED:-}" ] || [ "$PASSED" -lt 30 ]; then
  echo "expected at least 30 passing tests, counted ${PASSED:-0} — a file probably failed to load" >&2
  exit 1
fi
echo "$PASSED tests passed"

step "build"
npx vite build

step "preflight (devvit.json + bundle)"
node scripts/preflight.mjs

step "end to end in a real browser"
node scripts/e2e.mjs

step "ui measurement"
node scripts/measure-ui.mjs > /dev/null
echo "proof/ui/report.md updated"

step "hygiene"
if grep -rn --include='*.ts' --include='*.tsx' --include='*.mjs' -E 'TODO|FIXME|XXX' src scripts | grep -v 'no TODO'; then
  echo "leftover TODO/FIXME above" >&2
  exit 1
fi
if grep -rIn --include='*.ts' --include='*.tsx' -E 'sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}' src; then
  echo "a secret is in the source" >&2
  exit 1
fi
# sourcemaps are emitted by the devvit plugin on purpose; they are not shipped assets
BIG=$(find dist/client -type f -size +1M ! -name "*.map" | head -5)
if [ -n "$BIG" ]; then
  echo "unexpectedly large client asset(s):" >&2
  echo "$BIG" >&2
  exit 1
fi

printf '\n\033[1;32mverify: all green\033[0m\n'
