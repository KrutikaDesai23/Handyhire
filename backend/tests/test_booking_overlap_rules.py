from datetime import date

from app import models


FUTURE_DATE = date(2099, 10, 1)


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_overlapping_booking_is_rejected(client, db, customer_token, worker):
    existing = models.Booking(
        customer_id=1,
        worker_id=worker.id,
        booking_date=FUTURE_DATE,
        booking_time="10:00",
        hours=2,
        address="Existing job",
        amount=1000,
        status="accepted",
    )
    db.add(existing)
    db.commit()

    response = client.post(
        "/api/bookings",
        headers=_headers(customer_token),
        json={
            "worker_id": worker.id,
            "booking_date": FUTURE_DATE.isoformat(),
            "booking_time": "11:00",
            "hours": 1,
            "address": "Overlapping job",
        },
    )
    assert response.status_code == 409


def test_adjacent_booking_is_allowed(client, db, customer_token, worker):
    existing = models.Booking(
        customer_id=1,
        worker_id=worker.id,
        booking_date=FUTURE_DATE,
        booking_time="10:00",
        hours=2,
        address="Existing job",
        amount=1000,
        status="accepted",
    )
    db.add(existing)
    db.commit()

    response = client.post(
        "/api/bookings",
        headers=_headers(customer_token),
        json={
            "worker_id": worker.id,
            "booking_date": FUTURE_DATE.isoformat(),
            "booking_time": "12:00",
            "hours": 1,
            "address": "Adjacent job",
        },
    )
    assert response.status_code == 201


def test_in_progress_booking_blocks_overlap(client, db, customer_token, worker):
    existing = models.Booking(
        customer_id=1,
        worker_id=worker.id,
        booking_date=FUTURE_DATE,
        booking_time="14:00",
        hours=2,
        address="Active job",
        amount=1000,
        status="in_progress",
    )
    db.add(existing)
    db.commit()

    response = client.post(
        "/api/bookings",
        headers=_headers(customer_token),
        json={
            "worker_id": worker.id,
            "booking_date": FUTURE_DATE.isoformat(),
            "booking_time": "15:00",
            "hours": 1,
            "address": "Conflicting job",
        },
    )
    assert response.status_code == 409


def test_booking_requires_exactly_one_target(client, customer_token, worker):
    response = client.post(
        "/api/bookings",
        headers=_headers(customer_token),
        json={
            "worker_id": worker.id,
            "package_id": 99999,
            "booking_date": FUTURE_DATE.isoformat(),
            "booking_time": "09:00",
            "hours": 1,
            "address": "Invalid target",
        },
    )
    assert response.status_code in {400, 422}


def test_booking_rejects_past_date(client, customer_token, worker):
    response = client.post(
        "/api/bookings",
        headers=_headers(customer_token),
        json={
            "worker_id": worker.id,
            "booking_date": "2020-01-01",
            "booking_time": "09:00",
            "hours": 1,
            "address": "Past job",
        },
    )
    assert response.status_code == 400
