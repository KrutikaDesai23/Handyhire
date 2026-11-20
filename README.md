# HandyHire

HandyHire is a service marketplace web application that connects customers with workers for everyday home and personal services. Customers can discover providers and request work; workers can manage their profiles, services, packages, teams and bookings.

## Main modules

- **Authentication:** separate customer and worker accounts.
- **Worker discovery:** worker profiles, professions, services and packages.
- **Bookings:** booking requests, scheduling, status tracking and booking photos.
- **Teams and packages:** worker teams and team-based service packages.
- **Worker workspace:** dashboard, requests, bookings, services, packages and team management.
- **Reviews:** customer feedback and worker review history.

## Technology

- Frontend: HTML, CSS and JavaScript
- Backend: Python, FastAPI and Uvicorn
- Database: SQLAlchemy ORM; SQLite for local development and PostgreSQL for hosted deployments
- Authentication: JWT bearer tokens and password hashing
- Tests: pytest and FastAPI TestClient

## Run locally

### Requirements

- Python 3.10 or newer
- VS Code (recommended)
- VS Code **Live Server** extension for the static frontend

### 1. Start the backend

From the repository root:

**macOS / Linux**
```bash
./start-backend.sh
```

**Windows PowerShell**
```powershell
.\start-backend.ps1
```

The startup scripts create a local `.venv` when needed, install `backend/requirements.txt`, create any missing database tables without dropping existing data, prepare the upload folders, and start FastAPI on `http://127.0.0.1:8000`. The environment is local to your computer and is not committed to Git.

Open the interactive API documentation at:

- http://127.0.0.1:8000/docs

### 2. Configure the backend (optional)

For local development, the backend falls back to SQLite if `DATABASE_URL` is not set. To configure environment variables, copy:

```text
backend/.env.example
```

to:

```text
backend/.env
```

Set a private random `SECRET_KEY` and your preferred `DATABASE_URL`. Never commit `.env` or production credentials.

### 3. Start the frontend

Open the repository in VS Code, install/enable **Live Server**, then right-click the root `index.html` and choose **Open with Live Server**. The site should open at an address such as `http://127.0.0.1:5500`.

The shared frontend API helper reads the backend URL from the root `api-config.json`. Localhost development uses `http://127.0.0.1:8000`; for a hosted deployment, set `apiBaseUrl` to the deployed backend's public URL.

## Run tests

From the repository root:

```bash
cd backend
python3 -m pip install -r requirements.txt
python3 -m pytest -q
```

On Windows, use `python` instead of `python3` if that is the installed command.

The GitHub Actions workflow also checks Python backend tests, JavaScript syntax and local script references.

## Deployment notes

See [DEPLOYMENT.md](DEPLOYMENT.md) for the hosted backend, database, CORS and persistent-upload configuration. Keep the frontend's `api-config.json` backend URL aligned with the backend deployment you actually use.

## Repository hygiene

Do not commit virtual environments, local databases, `.env` files or runtime uploads. The repository ignore rules cover these local files.
