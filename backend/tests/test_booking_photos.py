import io
from datetime import date

from fastapi.testclient import TestClient

from app import models
from app.auth import security


def _make_booking(db, customer, worker, status="pending"):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        booking_date=date(2026, 9, 1),
        booking_time="10:00",
        address="123 Test St",
        description="Fix the sink",
        amount=500,
        status=status,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def _png_bytes():
    return b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def test_upload_before_photo_and_view_in_customer_details(client, customer, worker, db):
    booking = _make_booking(db, customer, worker)
    token = security.create_access_token({"sub": str(customer.id), "role": "customer"})
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post(
        f"/api/bookings/{booking.id}/photos",
        headers=headers,
        data={"photo_type": "before"},
        files={"file": ("job.png", io.BytesIO(_png_bytes()), "image/png")},
    )
    assert resp.status_code == 201, resp.text
    photo = resp.json()
    assert photo["photo_type"] == "before"
    assert "/static/booking-photos/" in photo["image_url"]

    detail = client.get(
        f"/api/bookings/customer/bookings/{booking.id}",
        headers=headers,
    )
    assert detail.status_code == 200
    body = detail.json()
    assert len(body["before_photos"]) == 1
    assert body["before_photos"][0]["image_url"] == photo["image_url"]
    assert body["after_photos"] == []


def test_upload_after_photo_and_view(client, customer, worker, db):
    booking = _make_booking(db, customer, worker, status="accepted")
    token = security.create_access_token({"sub": str(customer.id), "role": "customer"})
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post(
        f"/api/bookings/{booking.id}/photos",
        headers=headers,
        data={"photo_type": "after"},
        files={"file": ("after.png", io.BytesIO(_png_bytes()), "image/png")},
    )
    assert resp.status_code == 201, resp.text

    detail = client.get(
        f"/api/bookings/customer/bookings/{booking.id}",
        headers=headers,
    ).json()
    assert len(detail["after_photos"]) == 1


def test_provider_sees_before_photos_in_request(client, customer, worker, db):
    booking = _make_booking(db, customer, worker)
    request = models.BookingRequest(
        booking_id=booking.id,
        worker_id=worker.id,
        customer_id=customer.id,
        status="pending",
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    customer_token = security.create_access_token({"sub": str(customer.id), "role": "customer"})
    client.post(
        f"/api/bookings/{booking.id}/photos",
        headers={"Authorization": f"Bearer {customer_token}"},
        data={"photo_type": "before"},
        files={"file": ("job.png", io.BytesIO(_png_bytes()), "image/png")},
    )

    worker_token = security.create_access_token({"sub": str(worker.id), "role": "worker"})
    resp = client.get(
        f"/api/worker/requests/{request.id}",
        headers={"Authorization": f"Bearer {worker_token}"},
    )
    assert resp.status_code == 200
    assert len(resp.json()["before_photos"]) == 1


def test_other_customer_cannot_upload(client, customer, worker, db):
    booking = _make_booking(db, customer, worker)

    other = models.User(
        full_name="Other Customer",
        email="other@example.com",
        mobile_number="1111111111",
        password_hash=security.hash_password("password123"),
        role="customer",
    )
    db.add(other)
    db.commit()
    db.refresh(other)

    other_token = security.create_access_token({"sub": str(other.id), "role": "customer"})
    resp = client.post(
        f"/api/bookings/{booking.id}/photos",
        headers={"Authorization": f"Bearer {other_token}"},
        data={"photo_type": "before"},
        files={"file": ("job.png", io.BytesIO(_png_bytes()), "image/png")},
    )
    assert resp.status_code == 404


def test_other_customer_cannot_view(client, customer, worker, db):
    booking = _make_booking(db, customer, worker)

    other = models.User(
        full_name="Other Customer",
        email="other2@example.com",
        mobile_number="2222222222",
        password_hash=security.hash_password("password123"),
        role="customer",
    )
    db.add(other)
    db.commit()
    db.refresh(other)

    other_token = security.create_access_token({"sub": str(other.id), "role": "customer"})
    resp = client.get(
        f"/api/bookings/customer/bookings/{booking.id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404


def test_invalid_photo_type_rejected(client, customer, worker, db):
    booking = _make_booking(db, customer, worker)
    token = security.create_access_token({"sub": str(customer.id), "role": "customer"})
    resp = client.post(
        f"/api/bookings/{booking.id}/photos",
        headers={"Authorization": f"Bearer {token}"},
        data={"photo_type": "side"},
        files={"file": ("job.png", io.BytesIO(_png_bytes()), "image/png")},
    )
    assert resp.status_code == 422


def test_non_image_rejected(client, customer, worker, db):
    booking = _make_booking(db, customer, worker)
    token = security.create_access_token({"sub": str(customer.id), "role": "customer"})
    resp = client.post(
        f"/api/bookings/{booking.id}/photos",
        headers={"Authorization": f"Bearer {token}"},
        data={"photo_type": "before"},
        files={"file": ("job.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert resp.status_code == 415
