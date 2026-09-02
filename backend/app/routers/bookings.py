from typing import Optional
from datetime import date

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from fastapi.responses import JSONResponse
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
)


router = APIRouter(
    prefix="/api/bookings",
    tags=["bookings"],
)


def _build_booking_response(booking, db, team_name=None):
    worker = db.query(models.User).filter(models.User.id == booking.worker_id).first()
    service = db.query(models.Service).filter(models.Service.id == booking.service_id).first() if booking.service_id else None
    return BookingResponse(
        id=booking.id,
        customer_id=booking.customer_id,
        worker_id=booking.worker_id,
        team_id=booking.team_id,
        service_id=booking.service_id,
        booking_date=booking.booking_date,
        booking_time=booking.booking_time,
        address=booking.address,
        description=booking.description,
        amount=booking.amount,
        status=booking.status,
        created_at=booking.created_at.isoformat() if booking.created_at else None,
        worker_name=worker.full_name if worker else None,
        service_name=service.name if service else None,
        team_name=team_name,
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

    if payload.team_id is not None:
        team = db.query(models.Team).filter(models.Team.id == payload.team_id).first()
        if not team:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

        members = db.query(models.TeamMember).filter(models.TeamMember.team_id == payload.team_id).all()
        if not members:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team has no members")

        if payload.service_id is not None:
            service = db.query(models.Service).filter(models.Service.id == payload.service_id).first()
            if not service:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")

        created_bookings = []
        for member in members:
            booking = models.Booking(
                customer_id=current_user.id,
                worker_id=member.worker_id,
                team_id=payload.team_id,
                service_id=payload.service_id,
                booking_date=payload.booking_date,
                booking_time=payload.booking_time,
                address=payload.address,
                description=payload.description,
                amount=payload.amount,
                status="pending",
            )
            db.add(booking)
            db.flush()

            booking_request = models.BookingRequest(
                booking_id=booking.id,
                worker_id=member.worker_id,
                customer_id=current_user.id,
                status="pending",
            )
            db.add(booking_request)
            created_bookings.append(booking)

        db.commit()
        for booking in created_bookings:
            db.refresh(booking)

        responses = []
        for booking in created_bookings:
            responses.append(_build_booking_response(booking, db, team_name=team.name))

        return JSONResponse(
            content=[r.model_dump(mode="json") for r in responses],
            status_code=status.HTTP_201_CREATED,
        )

    worker = None
    service = None
    package = None
    package_name = None

    worker_id = payload.worker_id
    service_id = payload.service_id
    booking_amount = payload.amount


    # =====================================================
    # MULTITASKING PACKAGE BOOKING
    # =====================================================

    if payload.package_id is not None:

        package = (
            db.query(models.Package)
            .filter(
                models.Package.id ==
                payload.package_id,
                models.Package.package_type.in_(
                    ["multitasking", "team"]
                ),
                models.Package.status ==
                "published",
            )
            .first()
        )

        if not package:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Package not found or not published",
            )

        package_name = package.name

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

        # A multitasking package contains
        # multiple services, so one single
        # service_id must not represent it.
        service_id = None
        service = None

        # Never trust the frontend package price.
        # Use the actual price saved in database.
        booking_amount = package.price


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


    # =====================================================
    # RESPONSE
    # =====================================================

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
        package_name=package_name,
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

    response = []

    for booking in bookings:
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

        if booking.package_id:
            pkg = (
                db.query(models.Package)
                .filter(models.Package.id == booking.package_id)
                .first()
            )
            package_name = pkg.name if pkg else None

        response.append(
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
                package_name=package_name,
            )
        )

    return response


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

    if booking.package_id:
        pkg = (
            db.query(models.Package)
            .filter(models.Package.id == booking.package_id)
            .first()
        )
        package_name = pkg.name if pkg else None

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
        package_name=package_name,
    )