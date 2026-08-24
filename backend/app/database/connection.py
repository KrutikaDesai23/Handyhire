"""HandyHire Backend - Database Connection Module

Loads environment variables, creates the SQLAlchemy engine,
session factory, and declarative base. Provides a reusable
database dependency for FastAPI routes.
"""

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Load environment variables from the backend .env file
# regardless of the current working directory.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(dotenv_path=os.path.join(BACKEND_DIR, ".env"))

# Database URL from environment variables.
# Expected format: postgresql://user:password@host:port/database
# Falls back to a local SQLite file so the backend can run without a
# PostgreSQL server installed (useful for local development).
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./handyhire.db"

IS_SQLITE = DATABASE_URL.startswith("sqlite")

# Create SQLAlchemy engine
if IS_SQLITE:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=5,
        max_overflow=10,
    )

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base for ORM models
Base = declarative_base()


# Dependency for FastAPI routes
def get_db():
    """Yield a database session for FastAPI dependency injection."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_database_connection():
    """Test database connectivity. Returns True if connection succeeds."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
