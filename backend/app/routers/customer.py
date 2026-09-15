from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app import models
from app.auth.dependencies import get_current_customer
from app.database.connection import get_db
from app.schemas import CustomerProfileResponse, CustomerProfileUpdate, BookingResponse

router = APIRouter(prefix="/api/customer", tags=["customer"])


@router.get("/profile", response_model=CustomerProfileResponse)
def get_customer_profile(current_user: models.User = Depends(get_current_customer)):
    return current_user


@router.put("/profile", response_model=CustomerProfileResponse)
def update_customer_profile(
    payload: CustomerProfileUpdate,
    current_user: models.User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()
    if payload.email is not None:
        normalized_email = str(payload.email).strip().lower()
        existing = (
            db.query(models.User)
            .filter(func.lower(models.User.email) == normalized_email)
            .first()
        )
        if existing and existing.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        current_user.email = normalized_email
    if payload.mobile_number is not None:
        normalized_mobile = payload.mobile_number.strip()
        existing = (
            db.query(models.User)
            .filter(models.User.mobile_number == normalized_mobile)
            .first()
        )
        if existing and existing.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mobile number already registered",
            )
        current_user.mobile_number = normalized_mobile
    if payload.address is not None:
        current_user.address = payload.address.strip()
    if payload.city is not None:
        current_user.city = payload.city.strip()

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


def _load_customer_booking(
    booking_id: int,
    current_user: models.User,
    db: Session,
) -> models.Booking:
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )
    if booking.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to update this booking",
        )
    return booking


def _build_customer_booking_response(
    booking: models.Booking,
    db: Session,
) -> BookingResponse:
    customer = db.query(models.User).filter(models.User.id == booking.customer_id).first()
    worker = db.query(models.User).filter(models.User.id == booking.worker_id).first()
    service = None
    if booking.service_id:
        service = db.query(models.Service).filter(models.Service.id == booking.service_id).first()
    package_name = None
    if booking.package_id:
        pkg = db.query(models.Package).filter(models.Package.id == booking.package_id).first()
        package_name = pkg.name if pkg else None
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
        created_at=booking.created_at.isoformat() if booking.created_at else None,
        worker_name=worker.full_name if worker else None,
        service_name=service.name if service else None,
        customer_name=customer.full_name if customer else None,
        package_name=package_name,
    )


@router.put("/bookings/{booking_id}/confirm-completion", response_model=BookingResponse)
def confirm_booking_completion(
    booking_id: int,
    current_user: models.User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    booking = _load_customer_booking(booking_id, current_user, db)
    if booking.status != "completion_requested":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking is not awaiting completion confirmation",
        )
    booking.status = "completed"
    db.query(models.BookingWorker).filter(
        models.BookingWorker.booking_id == booking_id
    ).update({"status": "completed"}, synchronize_session=False)
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return _build_customer_booking_response(booking, db)


@router.put("/bookings/{booking_id}/reject-completion", response_model=BookingResponse)
def reject_booking_completion(
    booking_id: int,
    current_user: models.User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    booking = _load_customer_booking(booking_id, current_user, db)
    if booking.status != "completion_requested":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking is not awaiting completion confirmation",
        )
    booking.status = "in_progress"
    db.query(models.BookingWorker).filter(
        models.BookingWorker.booking_id == booking_id,
        models.BookingWorker.status == "completion_requested",
    ).update({"status": "in_progress"}, synchronize_session=False)
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return _build_customer_booking_response(booking, db)
