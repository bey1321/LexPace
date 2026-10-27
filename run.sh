#!/usr/bin/env sh
# LexPace in Blackboard: one-command demo (Mac/Linux). Open http://localhost:8000 when it says "Demo ready".
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then exec python3 run.py "$@"; else exec python run.py "$@"; fi
