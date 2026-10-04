#!/usr/bin/env bash
# Browser tests against the Firebase emulator and a local build of the app.
#   bash e2e/run.sh                 all tests
#   bash e2e/run.sh towns stand-ins only these (file names without .cjs)
# Needs: Node ≥ 20, Java (for the Firestore emulator), Playwright with Chromium.
set -uo pipefail
cd "$(dirname "$0")/.."
OUT=e2e/shots; mkdir -p "$OUT"
FIREBASE="npx --yes firebase-tools@15"
PROJECT=demo-thiscounts
pids=()
# npx starts child processes (vite, java …): stop the whole tree, not just npx
killtree() { local c; for c in $(pgrep -P "$1"); do killtree "$c"; done; kill "$1" 2>/dev/null; }
cleanup() { for p in "${pids[@]}"; do killtree "$p"; done; }
trap cleanup EXIT

wait_for() { for _ in $(seq 1 90); do curl -s -o /dev/null "$1" && return 0; sleep 1; done; echo "Timed out waiting for $1"; exit 1; }

# 1. Firebase emulator (auth + firestore), unless one is already running
if ! curl -s -o /dev/null http://127.0.0.1:8080; then
  echo "Starting the Firebase emulator …"
  $FIREBASE emulators:start --only auth,firestore --project "$PROJECT" > "$OUT/emulator.log" 2>&1 &
  pids+=($!)
  wait_for http://127.0.0.1:8080
  wait_for http://127.0.0.1:9099
fi

# 2. The app, built against the emulator, served on :4173
echo "Building the app for the emulator …"
VITE_USE_EMULATOR=1 VITE_EMULATOR_HOST=127.0.0.1 npx vite build --emptyOutDir --outDir e2e/.dist > "$OUT/build.log" 2>&1 || { cat "$OUT/build.log"; exit 1; }
if curl -s -o /dev/null http://127.0.0.1:4173; then echo "Note: port 4173 is taken – testing whatever runs there"; else
  npx vite preview --outDir e2e/.dist --port 4173 --host 127.0.0.1 > "$OUT/preview.log" 2>&1 &
  pids+=($!)
  wait_for http://127.0.0.1:4173
fi

# 3. Test accounts (the two testers from firestore.rules plus one outsider)
for e in michael@rieplhuber.com annacvetkov@posteo.de fremd@example.com; do
  curl -s -o /dev/null -X POST "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake" \
    -H 'Content-Type: application/json' -d "{\"email\":\"$e\",\"password\":\"test1234\",\"returnSecureToken\":true}"
done

# 4. The tests, one after the other (each resets the database)
if [ $# -gt 0 ]; then tests=("$@"); else tests=(); for f in e2e/*.cjs; do n=$(basename "$f" .cjs); [ "$n" != lib ] && tests+=("$n"); done; fi
failed=0
for t in "${tests[@]}"; do
  out=$(timeout 400 node "e2e/$t.cjs" 2>&1); code=$?
  pass=$(grep -c '^PASS' <<< "$out"); bad=$(grep -E '^FAIL|^ERROR' <<< "$out")
  if [ $code -ne 0 ] || [ -n "$bad" ]; then failed=$((failed + 1)); echo "✗ $t ($pass passed)"; echo "$bad" | sed 's/^/    /'; else echo "✓ $t ($pass checks)"; fi
done
echo; [ $failed -eq 0 ] && echo "All ${#tests[@]} test files passed." || echo "$failed of ${#tests[@]} test files failed. Screenshots: $OUT/"
exit $((failed > 0))
