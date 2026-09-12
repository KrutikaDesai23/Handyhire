from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import not_
from sqlalchemy.orm import Session

from app import models
from app.auth.dependencies import get_current_customer, get_current_worker
from app.database.connection import get_db
from app.schemas import BookingResponse


router = APIRouter(prefix="/api/activity", tags=["activity"])


def _bulk_booking_responses(
    bookings: list[models.Booking],
    db: Session,
    status_overrides: Optional[dict[int, str]] = None,
) -> list[BookingResponse]:
    """Build activity-list responses with a fixed number of DB queries.

    The legacy activity endpoints queried worker, customer, service and package
    separately for every booking. With a remote PostgreSQL database that turns
    one Activity load into many network round trips. This helper loads each
    related table once and then maps rows in memory.
    """
    if not bookings:
        return []

    status_overrides = status_overrides or {}

    user_ids = {
        user_id
        for booking in bookings
        for user_id in (booking.customer_id, booking.worker_id)
        if user_id is not None
    }
    service_ids = {
        booking.service_id
        for booking in bookings
        if booking.service_id is not None
    }
    package_ids = {
        booking.package_id
        for booking in bookings
        if booking.package_id is not None
    }

    users = {
        row.id: row
        for row in (
            db.query(models.User)
            .filter(models.User.id.in_(user_ids))
            .all()
            if user_ids
            else []
        )
    }
    services = {
        row.id: row
        for row in (
            db.query(models.Service)
            .filter(models.Service.id.in_(service_ids))
            .all()
            if service_ids
            else []
        )
    }
    packages = {
        row.id: row
        for row in (
            db.query(models.Package)
            .filter(models.Package.id.in_(package_ids))
            .all()
            if package_ids
            else []
        )
    }

    responses: list[BookingResponse] = []

    for booking in bookings:
        customer = users.get(booking.customer_id)
        worker = users.get(booking.worker_id)
        service = services.get(booking.service_id)
        package = packages.get(booking.package_id)

        responses.append(
            BookingResponse(
                id=booking.id,
                customer_id=booking.customer_id,
                worker_id=booking.worker_id,
                team_id=booking.team_id,
                service_id=booking.service_id,
                package_id=booking.package_id,
                booking_date=booking.booking_date,
                booking_time=booking.booking_time,
                address=booking.address,
                description=booking.description,
                amount=booking.amount,
                status=status_overrides.get(booking.id, booking.status),
                created_at=(
                    booking.created_at.isoformat()
                    if booking.created_at
                    else None
                ),
                worker_name=worker.full_name if worker else None,
                customer_name=customer.full_name if customer else None,
                service_name=service.name if service else None,
                package_name=package.name if package else None,
                package_type=package.package_type if package else None,
            )
        )

    return responses


@router.get("/customer", response_model=list[BookingResponse])
def customer_activity(
    booking_status: Optional[str] = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    query = db.query(models.Booking).filter(
        models.Booking.customer_id == current_user.id
    )

    if booking_status:
        query = query.filter(models.Booking.status == booking_status)

    bookings = query.order_by(models.Booking.created_at.desc()).all()
    return _bulk_booking_responses(bookings, db)


@router.get("/provider/received", response_model=list[BookingResponse])
def provider_received_activity(
    booking_status: Optional[str] = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    # Preserve the existing provider-activity visibility rule: direct jobs are
    # visible to the booked worker, while team-package owners only see the job
    # when they are also an actual BookingWorker participant.
    direct = db.query(models.Booking).filter(
        models.Booking.worker_id == current_user.id
    )

    owner_is_participant = (
        db.query(models.BookingWorker.booking_id)
        .filter(models.BookingWorker.booking_id == models.Booking.id)
        .filter(models.BookingWorker.worker_id == current_user.id)
        .exists()
    )
    is_team_package = (
        db.query(models.Package.id)
        .filter(models.Package.id == models.Booking.package_id)
        .filter(models.Package.package_type == "team")
        .exists()
    )

    direct = direct.filter(not_(is_team_package & ~owner_is_participant))

    participant = (
        db.query(models.Booking)
        .join(
            models.BookingWorker,
            models.BookingWorker.booking_id == models.Booking.id,
        )
        .filter(models.BookingWorker.worker_id == current_user.id)
    )

    query = direct.union(participant)

    if booking_status:
        query = query.filter(models.Booking.status == booking_status)

    bookings = query.order_by(models.Booking.created_at.desc()).all()

    booking_ids = [booking.id for booking in bookings]
    participant_status = {}
    if booking_ids:
        participant_status = {
            row.booking_id: row.status
            for row in (
                db.query(models.BookingWorker)
                .filter(models.BookingWorker.booking_id.in_(booking_ids))
                .filter(models.BookingWorker.worker_id == current_user.id)
                .all()
            )
        }

    # For team jobs, show the current provider's own progress state rather
    # than making them wait on the overall team's status.
    return _bulk_booking_responses(
        bookings,
        db,
        status_overrides=participant_status,
    )


@router.get("/provider/sent", response_model=list[BookingResponse])
def provider_sent_activity(
    booking_status: Optional[str] = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    query = db.query(models.Booking).filter(
        models.Booking.customer_id == current_user.id
    )

    if booking_status:
        query = query.filter(models.Booking.status == booking_status)

    bookings = query.order_by(models.Booking.created_at.desc()).all()
    return _bulk_booking_responses(bookings, db)
