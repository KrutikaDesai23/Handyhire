from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import models
from app.auth.dependencies import get_current_worker
from app.database.connection import get_db
from app.schemas import BookingResponse

router = APIRouter(prefix="/api/worker", tags=["worker"])


@router.get("/bookings", response_model=list[BookingResponse])
def list_worker_bookings(
    status: str | None = Query(None),
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    query = db.query(models.Booking).filter(models.Booking.worker_id == current_user.id)
    if status:
        query = query.filter(models.Booking.status == status)

    bookings = query.order_by(models.Booking.created_at.desc()).all()
    response = []
    for booking in bookings:
        customer = db.query(models.User).filter(models.User.id == booking.customer_id).first()
        service = db.query(models.Service).filter(models.Service.id == booking.service_id).first() if booking.service_id else None
        response.append(
            BookingResponse(
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
                created_at=booking.created_at.isoformat() if booking.created_at else None,
                worker_name=current_user.full_name,
                service_name=service.name if service else None,
                customer_name=customer.full_name if customer else None,
            )
        )
    return response


@router.get("/bookings/{booking_id}", response_model=BookingResponse)
def get_worker_booking(
    booking_id: int,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking or booking.worker_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    customer = db.query(models.User).filter(models.User.id == booking.customer_id).first()
    service = db.query(models.Service).filter(models.Service.id == booking.service_id).first() if booking.service_id else None

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
        created_at=booking.created_at.isoformat() if booking.created_at else None,
        worker_name=current_user.full_name,
        service_name=service.name if service else None,
        customer_name=customer.full_name if customer else None,
    )


VALID_STATUS_TRANSITIONS = {
    "pending": ["accepted", "rejected"],
    "accepted": ["completed", "cancelled"],
}


@router.put("/bookings/{booking_id}/status", response_model=BookingResponse)
def update_worker_booking_status(
    booking_id: int,
    new_status: str,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking or booking.worker_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    allowed = VALID_STATUS_TRANSITIONS.get(booking.status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition from {booking.status} to {new_status}",
        )

    booking.status = new_status
    db.add(booking)
    db.commit()
    db.refresh(booking)

    customer = db.query(models.User).filter(models.User.id == booking.customer_id).first()
    service = db.query(models.Service).filter(models.Service.id == booking.service_id).first() if booking.service_id else None

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
        created_at=booking.created_at.isoformat() if booking.created_at else None,
        worker_name=current_user.full_name,
        service_name=service.name if service else None,
        customer_name=customer.full_name if customer else None,
    )
