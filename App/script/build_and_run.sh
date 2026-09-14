#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERIFY=false
if [[ "$#" -gt 0 && "$1" == "--verify" ]]; then
  VERIFY=true
elif [[ "$#" -gt 0 ]]; then
  echo "Usage: $0 [--verify]" >&2
  exit 2
fi

pkill -x LearnedMediaApp 2>/dev/null || true
"$ROOT_DIR/script/build_app.sh" native
/usr/bin/open -n "$ROOT_DIR/Learned Media.app"

if $VERIFY; then
  for _ in {1..20}; do
    if pgrep -x LearnedMediaApp >/dev/null; then
      echo "Learned Media is running."
      exit 0
    fi
    sleep 0.25
  done
  echo "Learned Media did not appear as a running process." >&2
  exit 1
fi
