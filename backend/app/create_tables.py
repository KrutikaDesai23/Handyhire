"""HandyHire Backend - Initialize Database Tables

Imports all models to register them with SQLAlchemy metadata,
then creates all tables in the PostgreSQL database.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.database.connection import engine, Base
from app.models import (
    User,
    WorkerProfile,
    Service,
    Booking,
    BookingRequest,
    Team,
    TeamMember,
    Package,
    PackageService,
    Review,
)

def create_tables():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")

    tables = list(Base.metadata.tables.keys())
    print(f"Tables in metadata: {tables}")
    print(f"Total tables: {len(tables)}")

if __name__ == "__main__":
    create_tables()
