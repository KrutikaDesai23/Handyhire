from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.schemas.booking import BookingCreate


def _booking_payload(**overrides):
    payload = {
        "worker_id": 1,
        "booking_date": date.today() + timedelta(days=1),
        "booking_time": "10:30",
        "address": "  123 Test Street  ",
        "amount": 500,
        "hours": 2,
    }
    payload.update(overrides)
    return payload


def test_booking_requires_exactly_one_target():
    with pytest.raises(ValidationError):
        BookingCreate(**_booking_payload(worker_id=None))

    with pytest.raises(ValidationError):
        BookingCreate(**_booking_payload(team_id=2))


def test_booking_rejects_past_date():
    with pytest.raises(ValidationError):
        BookingCreate(
            **_booking_payload(booking_date=date.today() - timedelta(days=1))
        )


def test_booking_rejects_invalid_time_format():
    with pytest.raises(ValidationError):
        BookingCreate(**_booking_payload(booking_time="25:99"))


def test_booking_normalizes_text_fields():
    booking = BookingCreate(
        **_booking_payload(description="  Bring a ladder  ")
    )

    assert booking.address == "123 Test Street"
    assert booking.description == "Bring a ladder"
