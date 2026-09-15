import pytest
from datetime import date
from fastapi.testclient import TestClient

from app import models
from app.auth import security
from app.models.user import User


FUTURE_BOOKING_DATE = "2099-08-20"
FUTURE_DATE_OBJECT = date(2099, 8, 20)


def test_customer_profile_get(client, customer_token):
    response = client.get(
        "/api/customer/profile",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "customer"
    assert "email" in data
    assert "password_hash" not in data


def test_customer_profile_update(client, customer_token):
    response = client.put(
        "/api/customer/profile",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={
            "full_name": "  Updated Name  ",
            "email": "  CUSTOMER.NORMALIZED@EXAMPLE.COM  ",
            "city": "New City",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Updated Name"
    assert data["email"] == "customer.normalized@example.com"
    assert data["city"] == "New City"


def test_customer_cannot_update_another_user_profile(client, customer_token, customer, db):
    other = User(
        full_name="Other Customer",
        email="other-customer@example.com",
        mobile_number="5551112222",
        password_hash=security.hash_password("password123"),
        role="customer",
    )
    db.add(other)
    db.commit()
    db.refresh(other)

    response = client.put(
        "/api/customer/profile",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={"email": " OTHER-CUSTOMER@EXAMPLE.COM "},
    )
    assert response.status_code == 400
    assert "email" in response.json()["detail"].lower()


def test_worker_listing(client, worker):
    response = client.get("/api/workers")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_worker_listing_search_filter(client):
    response = client.get("/api/workers?search=Test")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_worker_detail(client, worker):
    response = client.get(f"/api/workers/{worker.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == worker.id
    assert "password_hash" not in data


def test_services_listing(client):
    response = client.get("/api/services")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_packages_listing(client):
    response = client.get("/api/packages")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_packages_filter_multitasking(client):
    response = client.get("/api/packages?package_type=multitasking")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for pkg in data:
        assert pkg["package_type"] == "multitasking"


def test_packages_filter_team(client):
    response = client.get("/api/packages?package_type=team")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for pkg in data:
        assert pkg["package_type"] == "team"


def test_customer_creates_booking(client, customer_token, worker, db):
    service = db.query(models.Service).first()
    service_id = service.id if service else None

    payload = {
        "worker_id": worker.id,
        "service_id": service_id,
        "booking_date": FUTURE_BOOKING_DATE,
        "booking_time": "10:00",
        "hours": 2,
        "address": "123 Customer St",
        "description": "Need help",
        "amount": 1,
    }
    response = client.post(
        "/api/bookings",
        headers={"Authorization": f"Bearer {customer_token}"},
        json=payload,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
    assert data["worker_id"] == worker.id
    assert data["hours"] == 2
    assert data["amount"] == 1000


def test_create_booking_invalid_worker(client, customer_token):
    payload = {
        "worker_id": 99999,
        "booking_date": FUTURE_BOOKING_DATE,
        "booking_time": "10:00",
        "address": "123 Customer St",
        "amount": 500,
    }
    response = client.post(
        "/api/bookings",
        headers={"Authorization": f"Bearer {customer_token}"},
        json=payload,
    )
    assert response.status_code == 404


def test_customer_booking_history(client, customer_token, worker):
    response = client.get(
        "/api/bookings/customer/bookings",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_customer_booking_detail(client, customer_token, customer, worker, db):
    booking = db.query(models.Booking).filter(models.Booking.customer_id == customer.id).first()
    if not booking:
        booking = models.Booking(
            customer_id=customer.id,
            worker_id=worker.id,
            booking_date=FUTURE_DATE_OBJECT,
            booking_time="10:00",
            hours=2,
            address="123 Customer St",
            amount=1000,
            status="pending",
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)

    response = client.get(
        f"/api/bookings/customer/bookings/{booking.id}",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert response.status_code == 200
    assert response.json()["hours"] == booking.hours


def test_customer_cannot_access_another_customer_booking(client, customer_token, customer, worker, db):
    other_booking = db.query(models.Booking).filter(models.Booking.customer_id != customer.id).first()
    if not other_booking:
        other_customer = User(
            full_name="Other Customer",
            email="othercustomer@example.com",
            mobile_number="5555555555",
            password_hash=security.hash_password("password123"),
            role="customer",
        )
        db.add(other_customer)
        db.flush()

        other_booking = models.Booking(
            customer_id=other_customer.id,
            worker_id=worker.id,
            booking_date=FUTURE_DATE_OBJECT,
            booking_time="10:00",
            address="456 Other St",
            amount=500,
            status="pending",
        )
        db.add(other_booking)
        db.commit()

    response = client.get(
        f"/api/bookings/customer/bookings/{other_booking.id}",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert response.status_code == 404


def test_unauthenticated_access_rejected(client):
    response = client.get("/api/customer/profile")
    assert response.status_code == 401

    response = client.get("/api/bookings/customer/bookings")
    assert response.status_code == 401

    response = client.post("/api/bookings", json={})
    assert response.status_code == 401


def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["message"] == "HandyHire backend is running!"


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
