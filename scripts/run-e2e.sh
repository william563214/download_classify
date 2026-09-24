#!/usr/bin/env bash
# Cross-platform e2e runner: xvfb is optional (Linux headless only).
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root_dir"

npm run build

run_playwright() {
  npx playwright test "$@"
}

os_name="$(uname -s 2>/dev/null || echo unknown)"

if [[ "${E2E_HEADED:-}" == "1" ]]; then
  echo "e2e: E2E_HEADED=1 (headed Chromium)"
  run_playwright "$@"
  exit 0
fi

if [[ -n "${DISPLAY:-}" ]]; then
  echo "e2e: using existing DISPLAY=${DISPLAY}"
  run_playwright "$@"
  exit 0
fi

if [[ "$os_name" == "Linux" ]] && command -v xvfb-run >/dev/null 2>&1; then
  echo "e2e: Linux without DISPLAY — wrapping with xvfb-run"
  xvfb-run -a npx playwright test "$@"
  exit 0
fi

echo "e2e: no DISPLAY / no xvfb-run (os=${os_name}) — trying Playwright headless=new" >&2
echo "e2e: on Linux CI install xvfb (apt install xvfb) if extension load fails" >&2
run_playwright "$@"
