#!/usr/bin/env bash
# Starts the HandyHire FastAPI backend on http://127.0.0.1:8000 (macOS/Linux).
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/backend"

VENV_PYTHON="./venv/bin/python"
if [ ! -x "$VENV_PYTHON" ]; then
    echo "ERROR: Python venv not found at $VENV_PYTHON" >&2
    echo "Create it with: python3 -m venv venv && ./venv/bin/pip install -r requirements.txt" >&2
    exit 1
fi

echo "Starting HandyHire backend on http://127.0.0.1:8000 ..."
exec "$VENV_PYTHON" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
