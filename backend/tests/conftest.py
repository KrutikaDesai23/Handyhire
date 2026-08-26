import os
import sys

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.auth import security
from app.database.connection import Base, DATABASE_URL, get_db
from app.main import app
from app.models.user import User
from app.models.worker_profile import WorkerProfile
from fastapi.testclient import TestClient

from sqlalchemy.pool import StaticPool

TEST_DATABASE_URL = "sqlite://"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

@pytest.fixture(scope="session")
def db_engine():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield engine


@pytest.fixture(scope="function")
def db(db_engine):
    connection = db_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def customer(db):
    user = User(
        full_name="Test Customer",
        email="customer@example.com",
        mobile_number="1234567890",
        password_hash=security.hash_password("password123"),
        role="customer",
    )
    db.add(user)
    db.flush()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def customer_token(customer):
    token = security.create_access_token({"sub": str(customer.id), "role": customer.role})
    return token


@pytest.fixture(scope="function")
def worker(db):
    worker_user = User(
        full_name="Test Worker",
        email="worker@example.com",
        mobile_number="0987654321",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(worker_user)
    db.flush()

    worker_profile = WorkerProfile(
        user_id=worker_user.id,
        profession="Plumber",
        location="Downtown",
        price=500,
    )
    db.add(worker_profile)
    db.flush()
    db.refresh(worker_user)
    return worker_user
