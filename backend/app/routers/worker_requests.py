from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app import models
from app.auth.dependencies import get_current_worker
from app.database.connection import get_db
from app.schemas import BookingRequestResponse

router = APIRouter(prefix="/api/worker", tags=["worker"])


def _build_request_response(request: models.BookingRequest, db: Session) -> BookingRequestResponse:
    booking = db.query(models.Booking).filter(models.Booking.id == request.booking_id).first()
    customer = db.query(models.User).filter(models.User.id == request.customer_id).first()
    service = db.query(models.Service).filter(models.Service.id == booking.service_id).first() if booking and booking.service_id else None

    package_name = None
    package_type = None

    if booking and booking.package_id:
        pkg = db.query(models.Package).filter(models.Package.id == booking.package_id).first()
        package_name = pkg.name if pkg else None
        package_type = pkg.package_type if pkg else None

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
    return [_build_request_response(r, db) for r in requests]


@router.get("/requests/{request_id}", response_model=BookingRequestResponse)
def get_worker_request(
    request_id: int,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    request = db.query(models.BookingRequest).filter(models.BookingRequest.id == request_id).first()
    if not request or request.worker_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    return _build_request_response(request, db)


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

    booking_workers = (
        db.query(models.BookingWorker)
        .filter(models.BookingWorker.booking_id == booking.id)
        .all()
    )

    if booking_workers:
        for bw in booking_workers:
            if bw.worker_id == current_user.id:
                bw.status = "accepted"
                break

        all_accepted = (
            db.query(models.BookingWorker)
            .filter(models.BookingWorker.booking_id == booking.id)
            .filter(models.BookingWorker.status != "accepted")
            .first()
            is None
        )
        if all_accepted:
            booking.status = "accepted"
    else:
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

    booking_workers = (
        db.query(models.BookingWorker)
        .filter(models.BookingWorker.booking_id == booking.id)
        .all()
    )

    if booking_workers:
        for bw in booking_workers:
            if bw.worker_id == current_user.id:
                bw.status = "rejected"
                break

    booking.status = "rejected"

    db.add(request)
    db.add(booking)
    db.commit()
    db.refresh(request)
    db.refresh(booking)

    return _build_request_response(request, db)
