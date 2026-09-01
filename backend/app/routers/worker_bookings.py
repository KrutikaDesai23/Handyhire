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
from app.schemas import (
    BookingResponse,
    BookingWorkerSummary,
)


router = APIRouter(
    prefix="/api/worker",
    tags=["worker"],
)

def _prefetch_team_workers(
    bookings: list[models.Booking],
    db: Session,
) -> dict[int, list[BookingWorkerSummary]]:
    team_booking_ids = [
        b.id for b in bookings
        if b.package_id
    ]

    if not team_booking_ids:
        return {}

    rows = (
        db.query(models.BookingWorker, models.User, models.WorkerProfile)
        .join(models.User, models.User.id == models.BookingWorker.worker_id)
        .outerjoin(models.WorkerProfile, models.WorkerProfile.user_id == models.User.id)
        .filter(models.BookingWorker.booking_id.in_(team_booking_ids))
        .all()
    )

    result: dict[int, list[BookingWorkerSummary]] = {}

    for bw, user, profile in rows:
        result.setdefault(bw.booking_id, []).append(
            BookingWorkerSummary(
                worker_id=user.id,
                full_name=user.full_name,
                profession=(
                    profile.profession
                    if profile
                    else None
                ),
                role=bw.role,
            )
        )

    return result


TEAM_MEMBER_VISIBLE_STATUSES = {
    "accepted",
    "completion_requested",
    "completed",
    "cancelled",
}


def _build_booking_workers(
    booking_id: int,
    db: Session,
) -> list[BookingWorkerSummary]:
    rows = (
        db.query(models.BookingWorker, models.User, models.WorkerProfile)
        .join(models.User, models.User.id == models.BookingWorker.worker_id)
        .outerjoin(models.WorkerProfile, models.WorkerProfile.user_id == models.User.id)
        .filter(models.BookingWorker.booking_id == booking_id)
        .all()
    )

    return [
        BookingWorkerSummary(
            worker_id=user.id,
            full_name=user.full_name,
            profession=(
                profile.profession
                if profile
                else None
            ),
            role=bw.role,
        )
        for bw, user, profile in rows
    ]


def _build_booking_response(
    booking: models.Booking,
    db: Session,
    *,
    prefetched_team_workers: Optional[dict[int, list[BookingWorkerSummary]]] = None,
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

    package_name = None
    package_type = None
    team_workers = []

    if booking.package_id:
        pkg = (
            db.query(models.Package)
            .filter(models.Package.id == booking.package_id)
            .first()
        )

        if pkg:
            package_name = pkg.name
            package_type = pkg.package_type

            if pkg.package_type == "team":
                if prefetched_team_workers is not None:
                    team_workers = prefetched_team_workers.get(booking.id, [])
                else:
                    team_workers = _build_booking_workers(
                        booking.id,
                        db,
                    )

    return BookingResponse(
        id=booking.id,
        customer_id=booking.customer_id,
        worker_id=booking.worker_id,
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
        package_name=package_name,
        package_type=package_type,
        team_workers=team_workers,
        has_review=False,
    )


def _worker_can_view_booking(
    booking: models.Booking,
    worker_id: int,
    db: Session,
) -> bool:
    if booking.worker_id == worker_id:
        return True

    membership = (
        db.query(models.BookingWorker)
        .filter(
            models.BookingWorker.booking_id == booking.id,
            models.BookingWorker.worker_id == worker_id,
        )
        .first()
    )

    if not membership:
        return False

    return booking.status in TEAM_MEMBER_VISIBLE_STATUSES


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
    lead_query = (
        db.query(models.Booking)
        .filter(models.Booking.worker_id == current_user.id)
    )

    member_subquery = (
        db.query(models.Booking)
        .join(
            models.BookingWorker,
            models.BookingWorker.booking_id == models.Booking.id,
        )
        .filter(
            models.BookingWorker.worker_id == current_user.id,
            models.Booking.status.in_(TEAM_MEMBER_VISIBLE_STATUSES),
        )
    )

    query = lead_query.union(member_subquery).distinct()

    if booking_status:
        query = query.filter(
            models.Booking.status == booking_status
        )

    bookings = (
        query
        .order_by(
            models.Booking.created_at.desc()
        )
        .all()
    )

    prefetched_team_workers = _prefetch_team_workers(
        bookings,
        db,
    )

    return [
        _build_booking_response(
            booking,
            db,
            prefetched_team_workers=prefetched_team_workers,
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
            models.Booking.status == booking_status
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
        not booking
        or not _worker_can_view_booking(
            booking,
            current_user.id,
            db,
        )
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
        "completion_requested",
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
        not booking
        or booking.worker_id != current_user.id
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
