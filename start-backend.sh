#!/usr/bin/env bash
# HandyHire backend launcher for macOS/Linux.
# Creates a local virtual environment on first run, installs dependencies,
# initializes missing SQLite tables, then starts the FastAPI server.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
cd "$BACKEND_DIR"

if ! command -v python3 >/dev/null 2>&1; then
    echo "ERROR: Python 3 is not installed. Install Python 3.10+ and try again." >&2
    exit 1
fi

VENV_DIR="$BACKEND_DIR/venv"
if [ ! -x "$VENV_DIR/bin/python" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

PYTHON="$VENV_DIR/bin/python"
PIP="$VENV_DIR/bin/pip"

echo "Installing/checking backend dependencies..."
"$PIP" install --disable-pip-version-check -r requirements.txt

# Local development defaults. Existing shell/.env settings are preserved.
export APP_ENV="${APP_ENV:-development}"
export DATABASE_URL="${DATABASE_URL:-sqlite:///./handyhire.db}"
export SECRET_KEY="${SECRET_KEY:-CHANGE_ME_TO_A_STRONG_RANDOM_SECRET}"

mkdir -p uploads/profile-images uploads/worker-work-photos uploads/booking-photos

echo "Initializing database tables (existing data is preserved)..."
"$PYTHON" -m app.create_tables

echo "Checking backend health at http://127.0.0.1:8000 ..."
exec "$PYTHON" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
