from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy.orm import Session

from app import models
from app.auth.dependencies import (
    get_current_worker,
)
from app.database.connection import get_db
from app.schemas import BookingResponse


router = APIRouter(
    prefix="/api/worker",
    tags=["worker"],
)


def _build_booking_response(
    booking: models.Booking,
    db: Session,
) -> BookingResponse:
    customer = (
        db.query(models.User)
        .filter(
            models.User.id ==
            booking.customer_id
        )
        .first()
    )

    worker = (
        db.query(models.User)
        .filter(
            models.User.id ==
            booking.worker_id
        )
        .first()
    )

    service = None

    if booking.service_id:
        service = (
            db.query(models.Service)
            .filter(
                models.Service.id ==
                booking.service_id
            )
            .first()
        )

    return BookingResponse(
        id=booking.id,
        customer_id=booking.customer_id,
        worker_id=booking.worker_id,
        service_id=booking.service_id,
        booking_date=booking.booking_date,
        booking_time=booking.booking_time,
        address=booking.address,
        description=booking.description,
        amount=booking.amount,
        status=booking.status,
        created_at=(
            booking.created_at.isoformat()
            if booking.created_at
            else None
        ),
        worker_name=(
            worker.full_name
            if worker
            else None
        ),
        service_name=(
            service.name
            if service
            else None
        ),
        customer_name=(
            customer.full_name
            if customer
            else None
        ),
    )


@router.get(
    "/bookings",
    response_model=list[BookingResponse],
)
def list_worker_bookings(
    booking_status: Optional[str] = Query(
        None,
        alias="status",
    ),
    current_user: models.User = Depends(
        get_current_worker
    ),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.Booking)
        .filter(
            models.Booking.worker_id ==
            current_user.id
        )
    )

    if booking_status:
        query = query.filter(
            models.Booking.status ==
            booking_status
        )

    bookings = (
        query
        .order_by(
            models.Booking.created_at.desc()
        )
        .all()
    )

    return [
        _build_booking_response(
            booking,
            db,
        )
        for booking in bookings
    ]


# Keep this route above /bookings/{booking_id}.
@router.get(
    "/bookings/sent",
    response_model=list[BookingResponse],
)
def list_sent_worker_bookings(
    booking_status: Optional[str] = Query(
        None,
        alias="status",
    ),
    current_user: models.User = Depends(
        get_current_worker
    ),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.Booking)
        .filter(
            models.Booking.customer_id ==
            current_user.id
        )
    )

    if booking_status:
        query = query.filter(
            models.Booking.status ==
            booking_status
        )

    bookings = (
        query
        .order_by(
            models.Booking.created_at.desc()
        )
        .all()
    )

    return [
        _build_booking_response(
            booking,
            db,
        )
        for booking in bookings
    ]


@router.get(
    "/bookings/{booking_id}",
    response_model=BookingResponse,
)
def get_worker_booking(
    booking_id: int,
    current_user: models.User = Depends(
        get_current_worker
    ),
    db: Session = Depends(get_db),
):
    booking = (
        db.query(models.Booking)
        .filter(
            models.Booking.id ==
            booking_id
        )
        .first()
    )

    if (
        not booking or
        booking.worker_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    return _build_booking_response(
        booking,
        db,
    )


VALID_STATUS_TRANSITIONS = {
    "pending": [
        "accepted",
        "rejected",
    ],
    "accepted": [
        "completed",
        "cancelled",
    ],
}


@router.put(
    "/bookings/{booking_id}/status",
    response_model=BookingResponse,
)
def update_worker_booking_status(
    booking_id: int,
    new_status: str,
    current_user: models.User = Depends(
        get_current_worker
    ),
    db: Session = Depends(get_db),
):
    booking = (
        db.query(models.Booking)
        .filter(
            models.Booking.id ==
            booking_id
        )
        .first()
    )

    if (
        not booking or
        booking.worker_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    allowed = (
        VALID_STATUS_TRANSITIONS.get(
            booking.status,
            [],
        )
    )

    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid status transition from "
                f"{booking.status} to {new_status}"
            ),
        )

    booking.status = new_status

    db.add(booking)
    db.commit()
    db.refresh(booking)

    return _build_booking_response(
        booking,
        db,
    )