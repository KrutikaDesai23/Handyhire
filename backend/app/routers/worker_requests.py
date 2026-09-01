from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app import models
from app.auth.dependencies import get_current_worker
from app.database.connection import get_db
from app.schemas import BookingRequestResponse, BookingWorkerSummary

router = APIRouter(prefix="/api/worker", tags=["worker"])


def _build_request_workers(
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


def _prefetch_request_data(
    requests: list[models.BookingRequest],
    db: Session,
):
    booking_ids = []
    booking_map = {}
    customer_ids = set()
    service_ids = set()
    package_ids = set()

    for req in requests:
        if req.booking_id:
            booking_ids.append(req.booking_id)
        if req.customer_id:
            customer_ids.add(req.customer_id)

    bookings = (
        db.query(models.Booking)
        .filter(models.Booking.id.in_(booking_ids))
        .all()
    )
    for b in bookings:
        booking_map[b.id] = b
        if b.service_id:
            service_ids.add(b.service_id)
        if b.package_id:
            package_ids.add(b.package_id)

    customers = {}
    if customer_ids:
        for u in db.query(models.User).filter(models.User.id.in_(customer_ids)).all():
            customers[u.id] = u

    services = {}
    if service_ids:
        for s in db.query(models.Service).filter(models.Service.id.in_(service_ids)).all():
            services[s.id] = s

    packages = {}
    if package_ids:
        for p in db.query(models.Package).filter(models.Package.id.in_(package_ids)).all():
            packages[p.id] = p

    team_booking_ids = [
        b.id for b in bookings
        if b.package_id and packages.get(b.package_id) and packages[b.package_id].package_type == "team"
    ]

    team_workers_map = {}
    if team_booking_ids:
        rows = (
            db.query(models.BookingWorker, models.User, models.WorkerProfile)
            .join(models.User, models.User.id == models.BookingWorker.worker_id)
            .outerjoin(models.WorkerProfile, models.WorkerProfile.user_id == models.User.id)
            .filter(models.BookingWorker.booking_id.in_(team_booking_ids))
            .all()
        )
        for bw, user, profile in rows:
            team_workers_map.setdefault(bw.booking_id, []).append(
                BookingWorkerSummary(
                    worker_id=user.id,
                    full_name=user.full_name,
                    profession=profile.profession if profile else None,
                    role=bw.role,
                )
            )

    return booking_map, customers, services, packages, team_workers_map


def _build_request_response(
    request: models.BookingRequest,
    db: Session,
    *,
    prefetched: Optional[tuple] = None,
) -> BookingRequestResponse:
    if prefetched:
        booking_map, customers, services, packages, team_workers_map = prefetched
        booking = booking_map.get(request.booking_id)
        customer = customers.get(request.customer_id)
        service = services.get(booking.service_id) if booking and booking.service_id else None
        package = packages.get(booking.package_id) if booking and booking.package_id else None

        package_name = package.name if package else None
        package_type = package.package_type if package else None
        team_workers = team_workers_map.get(booking.id, []) if booking else []
    else:
        booking = db.query(models.Booking).filter(models.Booking.id == request.booking_id).first()
        customer = db.query(models.User).filter(models.User.id == request.customer_id).first()
        service = db.query(models.Service).filter(models.Service.id == booking.service_id).first() if booking and booking.service_id else None

        package_name = None
        package_type = None
        team_workers = []

        if booking and booking.package_id:
            pkg = db.query(models.Package).filter(models.Package.id == booking.package_id).first()
            if pkg:
                package_name = pkg.name
                package_type = pkg.package_type
                if pkg.package_type == "team":
                    team_workers = _build_request_workers(booking.id, db)

    return BookingRequestResponse(
        id=request.id,
        booking_id=request.booking_id,
        customer_id=request.customer_id,
        worker_id=request.worker_id,
        message=request.message,
        status=request.status,
        created_at=request.created_at.isoformat() if request.created_at else None,
        customer_name=customer.full_name if customer else None,
        service_name=service.name if service else None,
        booking_date=booking.booking_date.isoformat() if booking and booking.booking_date else None,
        booking_time=booking.booking_time if booking else None,
        address=booking.address if booking else None,
        description=booking.description if booking else None,
        amount=booking.amount if booking else None,
        package_id=booking.package_id if booking else None,
        package_name=package_name,
        package_type=package_type,
        team_workers=team_workers,
    )


@router.get("/requests", response_model=list[BookingRequestResponse])
def list_worker_requests(
    status: Optional[str] = None,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    query = db.query(models.BookingRequest).filter(models.BookingRequest.worker_id == current_user.id)
    if status:
        query = query.filter(models.BookingRequest.status == status)

    requests = query.order_by(models.BookingRequest.created_at.desc()).all()

    prefetched = _prefetch_request_data(requests, db)

    return [
        _build_request_response(
            r,
            db,
            prefetched=prefetched,
        )
        for r in requests
    ]


@router.get("/requests/{request_id}", response_model=BookingRequestResponse)
def get_worker_request(
    request_id: int,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    request = db.query(models.BookingRequest).filter(models.BookingRequest.id == request_id).first()
    if not request or request.worker_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    prefetched = _prefetch_request_data([request], db)
    return _build_request_response(request, db, prefetched=prefetched)


@router.put("/requests/{request_id}/accept", response_model=BookingRequestResponse)
def accept_worker_request(
    request_id: int,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    request = db.query(models.BookingRequest).filter(models.BookingRequest.id == request_id).first()
    if not request or request.worker_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    if request.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not pending")

    booking = db.query(models.Booking).filter(models.Booking.id == request.booking_id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    request.status = "accepted"
    booking.status = "accepted"

    db.add(request)
    db.add(booking)
    db.commit()
    db.refresh(request)
    db.refresh(booking)

    return _build_request_response(request, db)


@router.put("/requests/{request_id}/reject", response_model=BookingRequestResponse)
def reject_worker_request(
    request_id: int,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    request = db.query(models.BookingRequest).filter(models.BookingRequest.id == request_id).first()
    if not request or request.worker_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    if request.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not pending")

    booking = db.query(models.Booking).filter(models.Booking.id == request.booking_id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking.status in ("completed", "cancelled"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking cannot be rejected in current status")

    request.status = "rejected"
    booking.status = "rejected"

    db.add(request)
    db.add(booking)
    db.commit()
    db.refresh(request)
    db.refresh(booking)

    return _build_request_response(request, db)
