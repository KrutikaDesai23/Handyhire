"""HandyHire Backend API

A FastAPI application providing backend services for the
HandyHire service marketplace platform.
"""

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth.router import router as auth_router
from app.database.connection import test_database_connection
from app.routers.bookings import router as bookings_router
from app.routers.customer import router as customer_router
from app.routers.packages import router as packages_router
from app.routers.reviews import router as reviews_router
from app.routers.services import router as services_router
from app.routers.teams import router as teams_router
from app.routers.worker_bookings import router as worker_bookings_router
from app.routers.worker_dashboard import router as worker_dashboard_router
from app.routers.worker_packages import router as worker_packages_router
from app.routers.worker_profile import router as worker_profile_router
from app.routers.worker_requests import router as worker_requests_router
from app.routers.worker_services import router as worker_services_router
from app.routers.worker_team_members import router as worker_team_members_router
from app.routers.worker_teams import router as worker_teams_router
from app.routers.worker_work_photos import router as worker_work_photos_router
from app.routers.workers import router as workers_router

app = FastAPI(
    title="HandyHire API",
    description="Backend API for HandyHire",
    version="1.0.0",
)

# Keep local development working while allowing production frontends to be
# supplied through ALLOWED_ORIGINS (comma-separated, e.g. a Vercel domain).
local_origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
]
configured_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
allowed_origins = list(dict.fromkeys(local_origins + configured_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(customer_router)
app.include_router(workers_router)
app.include_router(services_router)
app.include_router(packages_router)
app.include_router(bookings_router)
app.include_router(teams_router)
app.include_router(reviews_router)
app.include_router(worker_profile_router)
app.include_router(worker_requests_router)
app.include_router(worker_bookings_router)
app.include_router(worker_dashboard_router)
app.include_router(worker_packages_router)
app.include_router(worker_services_router)
app.include_router(worker_teams_router)
app.include_router(worker_team_members_router)
app.include_router(worker_work_photos_router)

# All existing upload routes write under backend/uploads. In production,
# UPLOADS_DIR can point to a persistent mounted volume (for example /data on
# Railway). A symlink keeps those routes and /static URLs unchanged while the
# actual bytes live on persistent storage.
def _configure_uploads_directory() -> Path:
    default_dir = Path(__file__).resolve().parent.parent / "uploads"
    configured = os.getenv("UPLOADS_DIR", "").strip()

    if not configured:
        default_dir.mkdir(parents=True, exist_ok=True)
        return default_dir

    target_dir = Path(configured).expanduser().resolve()
    target_dir.mkdir(parents=True, exist_ok=True)

    if default_dir.is_symlink():
        if default_dir.resolve() != target_dir:
            default_dir.unlink()
        else:
            return default_dir
    elif default_dir.exists():
        # A configured persistent store must not silently fall back to an
        # ephemeral non-empty directory. Empty local directories are safe to
        # replace with the persistent-volume symlink.
        if any(default_dir.iterdir()):
            raise RuntimeError(
                "UPLOADS_DIR is configured but backend/uploads already contains files"
            )
        default_dir.rmdir()

    default_dir.parent.mkdir(parents=True, exist_ok=True)
    default_dir.symlink_to(target_dir, target_is_directory=True)
    return default_dir


uploads_dir = _configure_uploads_directory()
app.mount("/static", StaticFiles(directory=str(uploads_dir)), name="static")


@app.get("/")
def read_root():
    """Root endpoint - confirms the backend is running."""
    return {"message": "HandyHire backend is running!"}


@app.get("/api/health")
def health_check():
    """Health check endpoint - verifies API and database connectivity."""
    db_connected = test_database_connection()
    return {
        "status": "healthy" if db_connected else "unhealthy",
        "database": "connected" if db_connected else "disconnected",
    }
