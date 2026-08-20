"""HandyHire Backend API

A FastAPI application providing backend services for the
HandyHire service marketplace platform.
"""

from fastapi import FastAPI

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
from app.routers.worker_profile import router as worker_profile_router
from app.routers.worker_requests import router as worker_requests_router
from app.routers.worker_services import router as worker_services_router
from app.routers.worker_team_members import router as worker_team_members_router
from app.routers.worker_teams import router as worker_teams_router
from app.routers.workers import router as workers_router

app = FastAPI(
    title="HandyHire API",
    description="Backend API for HandyHire",
    version="1.0.0",
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
app.include_router(worker_services_router)
app.include_router(worker_teams_router)
app.include_router(worker_team_members_router)


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
