#!/usr/bin/env bash
# Runs the CI checks locally, in CI order, stopping at the first failure.
# Usage: npm run verify            (E2E_PORT=3100 npm run verify if :3000 is busy)
#
# Keep in sync with .github/workflows/ci.yml: same steps, same order, same env.
# GitHub Actions is unavailable (billing) until further notice, so this is the
# check that milestone reports cite (docs/testing.md §7).
set -uo pipefail

cd "$(dirname "$0")/.."

# Same env as the CI "checks" job. NEXT_PUBLIC_SITE_URL is inlined at build
# time, so it must match the port the E2E server listens on.
E2E_PORT="${E2E_PORT:-3000}"
export E2E_PORT
export APP_ENV=test
export AI_PROVIDER=mock
export NEXT_PUBLIC_SITE_URL="http://localhost:${E2E_PORT}"
export NEXT_TELEMETRY_DISABLED=1

# gitleaks version pinned in ci.yml (secret-scan job).
GITLEAKS_VERSION=8.30.1

STEPS=(lint format:check typecheck test check:contrast gitleaks test:int build test:e2e)
declare -A RESULT DURATION

now() {
  # EPOCHREALTIME needs bash >= 5; fall back to whole seconds.
  if [[ -n "${EPOCHREALTIME:-}" ]]; then echo "${EPOCHREALTIME/[.,]/}"; else echo "$(($(date +%s) * 1000000))"; fi
}

summary() {
  echo
  echo "verify summary"
  printf '%-16s %-8s %10s\n' "step" "result" "duration"
  printf '%-16s %-8s %10s\n' "----------------" "--------" "----------"
  local step
  for step in "${STEPS[@]}"; do
    printf '%-16s %-8s %10s\n' "$step" "${RESULT[$step]:-skipped}" "${DURATION[$step]:--}"
  done
}

fail() {
  echo
  echo "verify: $1" >&2
  summary
  exit 1
}

preflight_gitleaks() {
  if ! command -v gitleaks >/dev/null 2>&1; then
    cat >&2 <<EOF
gitleaks is not installed (required; it is not skipped).
Install v${GITLEAKS_VERSION}, the version CI pins:
  https://github.com/gitleaks/gitleaks/releases/tag/v${GITLEAKS_VERSION}
  Linux x64: download gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz, check its
  SHA-256 against GITLEAKS_SHA256 in .github/workflows/ci.yml, extract
  "gitleaks" into a directory on PATH (e.g. ~/.local/bin).
  macOS: brew install gitleaks
EOF
    return 1
  fi
  local version
  version="$(gitleaks version 2>/dev/null)"
  if [[ "${version#v}" != "$GITLEAKS_VERSION" ]]; then
    echo "note: gitleaks ${version} installed; CI uses ${GITLEAKS_VERSION}" >&2
  fi
}

preflight_supabase() {
  if ! npx --no-install supabase status >/dev/null 2>&1; then
    cat >&2 <<EOF
The local Supabase stack is not running (needed by test:int and test:e2e).
Start it (Docker required), then write its env once:
  npm run db:start
  npm run db:env >> .env.local   # first time only
EOF
    return 1
  fi
}

preflight_e2e_port() {
  # Same rule as playwright.config.ts (reuseExistingServer: false): never test
  # against a server already on the port. Checked here to fail before Playwright.
  if ! node -e '
    const s = require("node:net").createServer();
    s.once("error", () => process.exit(1));
    s.listen(Number(process.argv[1]), () => s.close());
  ' "$E2E_PORT"; then
    cat >&2 <<EOF
Port ${E2E_PORT} is already in use (E2E never reuses a running server).
Stop that server, or pick another port: E2E_PORT=3100 npm run verify
EOF
    return 1
  fi
}

run_step() {
  local step="$1" start status
  echo
  echo "==> ${step}"
  start="$(now)"
  case "$step" in
    gitleaks) preflight_gitleaks && gitleaks git --redact --no-banner --exit-code 1 . ;;
    test:int) preflight_supabase && npm run --silent test:int ;;
    test:e2e) preflight_e2e_port && npm run --silent test:e2e ;;
    *) npm run --silent "$step" ;;
  esac
  status=$?
  local elapsed=$(($(now) - start))
  DURATION[$step]="$(printf '%d.%01ds' $((elapsed / 1000000)) $((elapsed % 1000000 / 100000)))"
  if [[ $status -ne 0 ]]; then
    RESULT[$step]=FAIL
    fail "${step} failed (exit ${status})"
  fi
  RESULT[$step]=pass
}

for step in "${STEPS[@]}"; do
  run_step "$step"
done

summary
echo
echo "verify: all steps passed"
