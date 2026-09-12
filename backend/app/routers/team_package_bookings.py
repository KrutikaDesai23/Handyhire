from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.auth.dependencies import get_current_customer
from app.database.connection import get_db
from app.schemas import BookingCreate, BookingResponse


router = APIRouter(
    prefix="/api/bookings",
    tags=["team-package-bookings"],
)


def _worker_has_slot_conflict(
    db: Session,
    worker_id: int,
    booking_date,
    booking_time: str,
) -> bool:
    """Check direct and team-package work for the exact selected slot."""
    active_statuses = [
        "pending",
        "accepted",
        "confirmed",
        "in_progress",
        "completion_requested",
    ]

    direct = (
        db.query(models.Booking)
        .filter(
            models.Booking.worker_id == worker_id,
            models.Booking.booking_date == booking_date,
            models.Booking.booking_time == booking_time,
            models.Booking.status.in_(active_statuses),
        )
        .first()
    )
    if direct:
        return True

    team_assignment = (
        db.query(models.BookingWorker)
        .join(
            models.Booking,
            models.BookingWorker.booking_id == models.Booking.id,
        )
        .filter(
            models.BookingWorker.worker_id == worker_id,
            models.BookingWorker.status.in_(active_statuses),
            models.Booking.booking_date == booking_date,
            models.Booking.booking_time == booking_time,
            models.Booking.status.in_(active_statuses),
        )
        .first()
    )

    return team_assignment is not None


@router.post(
    "/team-package",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_team_package_booking(
    payload: BookingCreate,
    current_user: models.User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Create one coordinated booking for a published Team Package.

    The package creator is not a crew member, so the marked team leader is
    used as the booking's primary worker/contact. All selected package workers
    are snapshotted into BookingWorker and receive the existing request flow.
    """
    if payload.package_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team package is required",
        )

    package = (
        db.query(models.Package)
        .filter(
            models.Package.id == payload.package_id,
            models.Package.package_type == "team",
            models.Package.status == "published",
        )
        .first()
    )

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team package not found or not published",
        )

    package_workers = (
        db.query(models.PackageWorker)
        .filter(models.PackageWorker.package_id == package.id)
        .all()
    )

    if not package_workers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This team package has no members selected",
        )

    leader_row = next(
        (row for row in package_workers if bool(row.is_leader)),
        None,
    )
    if leader_row is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This team package has no leader assigned",
        )

    leader = (
        db.query(models.User)
        .filter(
            models.User.id == leader_row.worker_id,
            models.User.role == "worker",
        )
        .first()
    )
    if not leader:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team leader not found",
        )

    member_ids = [row.worker_id for row in package_workers]
    if current_user.id in member_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot book a team package that you are part of",
        )

    for row in package_workers:
        if _worker_has_slot_conflict(
            db,
            row.worker_id,
            payload.booking_date,
            payload.booking_time,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "One or more team members are already booked for the "
                    "selected date and time. Please choose another slot."
                ),
            )

    hours = payload.hours or 1
    booking_amount = int(package.price) * int(hours)

    booking = models.Booking(
        customer_id=current_user.id,
        worker_id=leader.id,
        service_id=None,
        package_id=package.id,
        booking_date=payload.booking_date,
        booking_time=payload.booking_time,
        address=payload.address,
        description=payload.description,
        amount=booking_amount,
        status="pending",
    )

    db.add(booking)
    db.flush()

    for row in package_workers:
        db.add(
            models.BookingWorker(
                booking_id=booking.id,
                worker_id=row.worker_id,
                status="pending",
            )
        )

        # Keep the current coordinated acceptance flow intact: each member
        # receives the request and the booking becomes accepted once the
        # whole crew has accepted.
        db.add(
            models.BookingRequest(
                booking_id=booking.id,
                worker_id=row.worker_id,
                customer_id=current_user.id,
                status="pending",
            )
        )

    db.commit()
    db.refresh(booking)

    return BookingResponse(
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
        status=booking.status,
        created_at=(
            booking.created_at.isoformat()
            if booking.created_at
            else None
        ),
        worker_name=leader.full_name,
        service_name=None,
        package_name=package.name,
        package_type="team",
        team_name=package.name,
    )
