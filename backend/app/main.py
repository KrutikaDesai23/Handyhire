"""HandyHire Backend API

A FastAPI application providing backend services for the
HandyHire service marketplace platform.
"""

import os

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

# Serve uploaded profile images from the backend uploads directory.
# Files are exposed under /static/profile-images/<filename>.
app.mount(
    "/static",
    StaticFiles(directory=str(__import__("pathlib").Path(__file__).resolve().parent.parent / "uploads")),
    name="static",
)


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
