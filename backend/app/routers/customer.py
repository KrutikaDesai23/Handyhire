from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.auth.dependencies import get_current_customer
from app.database.connection import get_db
from app.schemas import CustomerProfileResponse, CustomerProfileUpdate, BookingResponse, BookingWorkerSummary

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
        current_user.full_name = payload.full_name
    if payload.email is not None:
        existing = db.query(models.User).filter(models.User.email == payload.email).first()
        if existing and existing.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        current_user.email = payload.email
    if payload.mobile_number is not None:
        existing = db.query(models.User).filter(models.User.mobile_number == payload.mobile_number).first()
        if existing and existing.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mobile number already registered",
            )
        current_user.mobile_number = payload.mobile_number
    if payload.address is not None:
        current_user.address = payload.address
    if payload.city is not None:
        current_user.city = payload.city
    print("PROFILE IMAGE RECEIVED:", payload.profile_image is not None)
    print("PROFILE IMAGE LENGTH:", len(payload.profile_image) if payload.profile_image else 0)
    if payload.profile_image is not None:
        current_user.profile_image = payload.profile_image

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
    current_customer_id: int,
) -> BookingResponse:
    customer = db.query(models.User).filter(models.User.id == booking.customer_id).first()
    worker = db.query(models.User).filter(models.User.id == booking.worker_id).first()
    service = None
    if booking.service_id:
        service = db.query(models.Service).filter(models.Service.id == booking.service_id).first()
    package_name = None
    package_type = None
    team_workers = []
    if booking.package_id:
        pkg = db.query(models.Package).filter(models.Package.id == booking.package_id).first()
        if pkg:
            package_name = pkg.name
            package_type = pkg.package_type
            if pkg.package_type == "team":
                rows = (
                    db.query(models.BookingWorker, models.User, models.WorkerProfile)
                    .join(models.User, models.User.id == models.BookingWorker.worker_id)
                    .outerjoin(models.WorkerProfile, models.WorkerProfile.user_id == models.User.id)
                    .filter(models.BookingWorker.booking_id == booking.id)
                    .all()
                )
                team_workers = [
                    BookingWorkerSummary(
                        worker_id=user.id,
                        full_name=user.full_name,
                        profession=profile.profession if profile else None,
                        role=bw.role,
                    )
                    for bw, user, profile in rows
                ]
    existing_review = db.query(models.Review).filter(models.Review.booking_id == booking.id).first()
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
        created_at=booking.created_at.isoformat() if booking.created_at else None,
        worker_name=worker.full_name if worker else None,
        service_name=service.name if service else None,
        customer_name=customer.full_name if customer else None,
        package_name=package_name,
        package_type=package_type,
        team_workers=team_workers,
        has_review=has_review,
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
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return _build_customer_booking_response(booking, db, current_user.id)


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
    booking.status = "accepted"
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return _build_customer_booking_response(booking, db, current_user.id)
