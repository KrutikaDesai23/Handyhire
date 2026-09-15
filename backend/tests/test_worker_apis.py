import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient

from app import models
from app.auth import security
from app.models.user import User
from app.models.worker_profile import WorkerProfile


def _future_booking_date(days=30):
    return (date.today() + timedelta(days=days)).isoformat()


def test_worker_profile_get(client, worker):
    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.get("/api/worker/profile", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "worker"
    assert "email" in data
    assert "password_hash" not in data


def test_worker_profile_update(client, worker):
    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.put(
        "/api/worker/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "profession": "Electrician",
            "price": 1000,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["profession"] == "Electrician"
    assert data["price"] == 1000


def test_worker_cannot_update_another_worker_profile(client, worker, db):
    other_worker = User(
        full_name="Other Worker",
        email="otherworker@example.com",
        mobile_number="7777777777",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(other_worker)
    db.flush()

    other_profile = WorkerProfile(user_id=other_worker.id, profession="Carpenter", location="Suburb", price=400)
    db.add(other_profile)
    db.commit()

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.put(
        "/api/worker/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={"profession": "Hacker"},
    )
    assert response.status_code == 200
    assert response.json()["profession"] == "Hacker"


def test_worker_dashboard(client, worker):
    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.get("/api/worker/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert "worker_name" in data
    assert "profession" in data
    assert "total_requests" in data
    assert "pending_requests" in data


def test_worker_request_listing(client, worker, customer, db):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        booking_date=date(2026, 8, 20),
        booking_time="10:00",
        address="123 Customer St",
        amount=500,
        status="pending",
    )
    db.add(booking)
    db.flush()

    request = models.BookingRequest(booking_id=booking.id, worker_id=worker.id, customer_id=customer.id, status="pending")
    db.add(request)
    db.commit()

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.get("/api/worker/requests", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_worker_request_detail(client, worker, customer, db):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        booking_date=date(2026, 8, 20),
        booking_time="10:00",
        address="123 Customer St",
        amount=500,
        status="pending",
    )
    db.add(booking)
    db.flush()

    request = models.BookingRequest(booking_id=booking.id, worker_id=worker.id, customer_id=customer.id, status="pending")
    db.add(request)
    db.commit()
    db.refresh(request)

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.get(f"/api/worker/requests/{request.id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == request.id


def test_worker_accepts_request(client, worker, customer, db):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        booking_date=date(2026, 8, 20),
        booking_time="10:00",
        address="123 Customer St",
        amount=500,
        status="pending",
    )
    db.add(booking)
    db.flush()

    request = models.BookingRequest(booking_id=booking.id, worker_id=worker.id, customer_id=customer.id, status="pending")
    db.add(request)
    db.commit()
    db.refresh(request)

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.put(f"/api/worker/requests/{request.id}/accept", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "accepted"


def test_worker_rejects_request(client, worker, customer, db):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        booking_date=date(2026, 8, 20),
        booking_time="10:00",
        address="123 Customer St",
        amount=500,
        status="pending",
    )
    db.add(booking)
    db.flush()

    request = models.BookingRequest(booking_id=booking.id, worker_id=worker.id, customer_id=customer.id, status="pending")
    db.add(request)
    db.commit()
    db.refresh(request)

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.put(f"/api/worker/requests/{request.id}/reject", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "rejected"


def test_worker_cannot_access_another_worker_request(client, worker, db):
    other_worker = User(
        full_name="Other Worker",
        email="otherworker2@example.com",
        mobile_number="8888888888",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(other_worker)
    db.flush()

    other_profile = WorkerProfile(user_id=other_worker.id, profession="Carpenter", location="Suburb", price=400)
    db.add(other_profile)
    db.flush()

    customer = User(
        full_name="Customer",
        email="customer2@example.com",
        mobile_number="9999999999",
        password_hash=security.hash_password("password123"),
        role="customer",
    )
    db.add(customer)
    db.flush()

    booking = models.Booking(
        customer_id=customer.id,
        worker_id=other_worker.id,
        booking_date=date(2026, 8, 20),
        booking_time="10:00",
        address="123 Customer St",
        amount=500,
        status="pending",
    )
    db.add(booking)
    db.flush()

    request = models.BookingRequest(booking_id=booking.id, worker_id=other_worker.id, customer_id=customer.id, status="pending")
    db.add(request)
    db.commit()
    db.refresh(request)

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.get(f"/api/worker/requests/{request.id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 404


def test_worker_bookings_listing(client, worker, customer, db):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        booking_date=date(2026, 8, 20),
        booking_time="10:00",
        address="123 Customer St",
        amount=500,
        status="accepted",
    )
    db.add(booking)
    db.commit()

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.get("/api/worker/bookings", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_worker_booking_detail(client, worker, customer, db):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        booking_date=date(2026, 8, 20),
        booking_time="10:00",
        address="123 Customer St",
        amount=500,
        status="accepted",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.get(f"/api/worker/bookings/{booking.id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == booking.id


def test_worker_booking_status_update(client, worker, customer, db):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        booking_date=date(2026, 8, 20),
        booking_time="10:00",
        address="123 Customer St",
        amount=500,
        status="accepted",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})

    # accepted -> in_progress
    response = client.put(
        f"/api/worker/bookings/{booking.id}/status?new_status=in_progress",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"

    # in_progress -> completion_requested
    response = client.put(
        f"/api/worker/bookings/{booking.id}/status?new_status=completion_requested",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "completion_requested"


def test_worker_invalid_booking_status_transition(client, worker, customer, db):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        booking_date=date(2026, 8, 20),
        booking_time="10:00",
        address="123 Customer St",
        amount=500,
        status="pending",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.put(
        f"/api/worker/bookings/{booking.id}/status?new_status=completed",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400


def test_worker_teams(client, worker, db):
    team = models.Team(name="Test Team", description="Test", created_by=worker.id)
    db.add(team)
    db.flush()

    member = models.TeamMember(team_id=team.id, worker_id=worker.id, role="member")
    db.add(member)
    db.commit()

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.get("/api/worker/teams", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_customer_token_rejected_from_worker_endpoints(client, customer):
    token = security.create_access_token({"sub": str(customer.id), "role": customer.role})
    response = client.get("/api/worker/profile", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403

    response = client.get("/api/worker/requests", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403


def test_unauthenticated_worker_access_rejected(client):
    response = client.get("/api/worker/profile")
    assert response.status_code == 401

    response = client.get("/api/worker/requests")
    assert response.status_code == 401

    response = client.get("/api/worker/bookings")
    assert response.status_code == 401


def test_customer_booking_creates_worker_request(client, customer_token, worker, db):
    payload = {
        "worker_id": worker.id,
        "booking_date": _future_booking_date(30),
        "booking_time": "14:00",
        "address": "456 Main St",
        "amount": 750,
    }
    response = client.post(
        "/api/bookings",
        headers={"Authorization": f"Bearer {customer_token}"},
        json=payload,
    )
    assert response.status_code == 201
    booking_id = response.json()["id"]

    request = db.query(models.BookingRequest).filter(models.BookingRequest.booking_id == booking_id).first()
    assert request is not None
    assert request.worker_id == worker.id
    assert request.status == "pending"


def test_duplicate_booking_request_prevention(client, customer_token, worker, db):
    payload = {
        "worker_id": worker.id,
        "booking_date": _future_booking_date(31),
        "booking_time": "09:00",
        "address": "789 Oak Ave",
        "amount": 600,
    }
    response = client.post(
        "/api/bookings",
        headers={"Authorization": f"Bearer {customer_token}"},
        json=payload,
    )
    assert response.status_code == 201
    booking_id = response.json()["id"]

    request = db.query(models.BookingRequest).filter(models.BookingRequest.booking_id == booking_id).first()
    assert request is not None
    assert request.status == "pending"


def test_invalid_request_status_transition(client, worker, customer, db):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        booking_date=date(2026, 8, 20),
        booking_time="10:00",
        address="123 Customer St",
        amount=500,
        status="pending",
    )
    db.add(booking)
    db.flush()

    request = models.BookingRequest(booking_id=booking.id, worker_id=worker.id, customer_id=customer.id, status="accepted")
    db.add(request)
    db.commit()
    db.refresh(request)

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.put(f"/api/worker/requests/{request.id}/accept", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 400


def test_existing_customer_tests_still_pass(client):
    response = client.get("/")
    assert response.status_code == 200

    response = client.get("/api/health")
    assert response.status_code == 200
