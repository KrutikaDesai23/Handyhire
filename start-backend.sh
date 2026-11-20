#!/usr/bin/env bash
# Start the HandyHire FastAPI backend on http://127.0.0.1:8000 (macOS/Linux).
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
VENV_DIR="$BACKEND_DIR/.venv"
PYTHON="$VENV_DIR/bin/python"
REQUIREMENTS="$BACKEND_DIR/requirements.txt"
INSTALL_MARKER="$VENV_DIR/.requirements-installed"

if ! command -v python3 >/dev/null 2>&1; then
    echo "ERROR: Python 3 is required. Install Python 3 and try again." >&2
    exit 1
fi

if [ ! -x "$PYTHON" ]; then
    echo "Creating HandyHire Python environment..."
    python3 -m venv "$VENV_DIR"
fi

if [ ! -f "$INSTALL_MARKER" ] || [ "$REQUIREMENTS" -nt "$INSTALL_MARKER" ]; then
    echo "Installing HandyHire backend dependencies..."
    "$PYTHON" -m pip install --disable-pip-version-check -r "$REQUIREMENTS"
    touch "$INSTALL_MARKER"
fi

mkdir -p "$BACKEND_DIR/uploads/profile-images" \
    "$BACKEND_DIR/uploads/worker-work-photos" \
    "$BACKEND_DIR/uploads/booking-photos"

cd "$BACKEND_DIR"
echo "Creating any missing database tables (existing data is preserved)..."
"$PYTHON" -m app.create_tables

echo "Starting HandyHire backend at http://127.0.0.1:8000"
exec "$PYTHON" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
