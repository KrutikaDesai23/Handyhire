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
    get_current_customer,
    get_current_user,
)
from app.database.connection import get_db
from app.schemas import (
    BookingCreate,
    BookingResponse,
    BookingWorkerSummary,
)


router = APIRouter(
    prefix="/api/bookings",
    tags=["bookings"],
)


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


def _build_customer_booking_response(
    booking: models.Booking,
    db: Session,
    current_customer_id: int,
) -> BookingResponse:
    customer = (
        db.query(models.User)
        .filter(models.User.id == booking.customer_id)
        .first()
    )

    worker = (
        db.query(models.User)
        .filter(models.User.id == booking.worker_id)
        .first()
    )

    service = None

    if booking.service_id:
        service = (
            db.query(models.Service)
            .filter(models.Service.id == booking.service_id)
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
                team_workers = _build_booking_workers(
                    booking.id,
                    db,
                )

    has_review = False

    if booking.customer_id == current_customer_id:
        existing_review = (
            db.query(models.Review)
            .filter(models.Review.booking_id == booking.id)
            .first()
        )
        has_review = existing_review is not None

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
       customer_name=current_user.full_name,
        package_name=package_name,
        package_type=package_type,
        team_workers=team_workers,
        has_review=has_review,
    )


def _build_booking_response(
    booking: models.Booking,
    db: Session,
    *,
    current_customer_id: Optional[int] = None,
) -> BookingResponse:
    customer = (
        db.query(models.User)
        .filter(models.User.id == booking.customer_id)
        .first()
    )

    worker = (
        db.query(models.User)
        .filter(models.User.id == booking.worker_id)
        .first()
    )

    service = None

    if booking.service_id:
        service = (
            db.query(models.Service)
            .filter(models.Service.id == booking.service_id)
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
                team_workers = _build_booking_workers(
                    booking.id,
                    db,
                )

    has_review = False

    if (
        current_customer_id is not None
        and booking.customer_id == current_customer_id
    ):
        existing_review = (
            db.query(models.Review)
            .filter(models.Review.booking_id == booking.id)
            .first()
        )

        has_review = existing_review is not None

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
        customer_name=current_user.full_name,
        package_name=package_name,
        package_type=package_type,
        team_workers=team_workers,
        has_review=has_review,
    )


@router.post(
    "",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_booking(
    payload: BookingCreate,
    current_user: models.User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    if current_user.role not in {
        "customer",
        "worker",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account cannot create bookings",
        )

    worker = None
    service = None
    package = None
    package_name = None
    package_type = None
    team_workers = []

    worker_id = payload.worker_id
    service_id = payload.service_id
    booking_amount = payload.amount


    # =====================================================
    # PACKAGE BOOKING (MULTITASKING OR TEAM)
    # =====================================================

    if payload.package_id is not None:

        package = (
            db.query(models.Package)
            .filter(
                models.Package.id ==
                payload.package_id,
                models.Package.status ==
                "published",
            )
            .first()
        )

        if not package:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Package not found",
            )

        package_name = package.name
        package_type = package.package_type

        if package.package_type == "team":

            selected_workers = (
                db.query(models.PackageWorker)
                .filter(
                    models.PackageWorker.package_id ==
                    package.id
                )
                .all()
            )

            unique_worker_ids = list(
                dict.fromkeys(
                    [row.worker_id for row in selected_workers]
                )
            )

            if len(unique_worker_ids) < 2:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "This team package does not have "
                        "enough available members"
                    ),
                )

        # Package owner is the worker who
        # will receive this booking request.
        worker_id = package.owner_id


        worker = (
            db.query(models.User)
            .filter(
                models.User.id == worker_id,
                models.User.role == "worker",
            )
            .first()
        )

        if not worker:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Package provider not found",
            )

        if worker.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot book your own package",
            )

        # A package booking covers the whole
        # package, so one single service_id
        # must not represent it.
        service_id = None
        service = None

        # Never trust the frontend amount.
        # Independently calculate from the stored package per-hour price
        # and the selected booking hours.
        if payload.hours is None or payload.hours <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Number of hours is required for package booking",
            )

        booking_amount = package.price * payload.hours


    # =====================================================
    # NORMAL WORKER BOOKING
    # =====================================================

    else:

        if worker_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Worker is required",
            )


        worker = (
            db.query(models.User)
            .filter(
                models.User.id == worker_id,
                models.User.role == "worker",
            )
            .first()
        )

        if not worker:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Worker not found",
            )


        if worker.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot book yourself",
            )


        if service_id is not None:

            service = (
                db.query(models.Service)
                .filter(
                    models.Service.id ==
                    service_id
                )
                .first()
            )

            if not service:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Service not found",
                )


    # =====================================================
    # CREATE BOOKING
    # =====================================================

    booking = models.Booking(
        customer_id=current_user.id,
        worker_id=worker_id,
        service_id=service_id,
        package_id=payload.package_id,
        booking_date=payload.booking_date,
        booking_time=payload.booking_time,
        address=payload.address,
        description=payload.description,
        amount=booking_amount,
        status="pending",
    )

    db.add(booking)
    db.flush()


    # =====================================================
    # SNAPSHOT TEAM PACKAGE WORKERS
    # =====================================================

    if (
        package is not None
        and package.package_type == "team"
    ):
        snapshot_rows = (
            db.query(models.PackageWorker)
            .filter(
                models.PackageWorker.package_id ==
                package.id
            )
            .all()
        )

        for row in snapshot_rows:
            db.add(
                models.BookingWorker(
                    booking_id=booking.id,
                    worker_id=row.worker_id,
                    role=None,
                )
            )


    # =====================================================
    # CREATE REQUEST FOR PROVIDER
    # =====================================================

    booking_request = models.BookingRequest(
        booking_id=booking.id,
        worker_id=worker_id,
        customer_id=current_user.id,
        status="pending",
    )

    db.add(booking_request)

    db.commit()

    db.refresh(booking)
    db.refresh(booking_request)

    if package_type == "team":
        team_workers = _build_booking_workers(
            booking.id,
            db,
        )


    # =====================================================
    # RESPONSE
    # =====================================================

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
        customer_name=current_user.full_name,
        package_name=package_name,
        package_type=package_type,
        team_workers=team_workers,
        has_review=False,
    )

@router.get(
    "/customer/bookings",
    response_model=list[BookingResponse],
)
def list_customer_bookings(
    status_filter: Optional[str] = Query(
        None,
        alias="status",
    ),
    current_user: models.User = Depends(
        get_current_customer
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

    if status_filter:
        query = query.filter(
            models.Booking.status ==
            status_filter
        )

    bookings = (
        query
        .order_by(
            models.Booking.created_at.desc()
        )
        .all()
    )

    return [
        _build_customer_booking_response(
            booking,
            db,
            current_user.id,
        )
        for booking in bookings
    ]


@router.get(
    "/customer/bookings/{booking_id}",
    response_model=BookingResponse,
)
def get_customer_booking(
    booking_id: int,
    current_user: models.User = Depends(
        get_current_customer
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

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    if booking.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    return _build_customer_booking_response(
        booking,
        db,
        current_user.id,
    )