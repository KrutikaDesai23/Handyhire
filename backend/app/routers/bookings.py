from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from app import models
from app.auth.dependencies import get_current_customer
from app.database.connection import get_db
from app.schemas import BookingCreate, BookingResponse

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: BookingCreate,
    current_user: models.User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    worker = db.query(models.User).filter(models.User.id == payload.worker_id, models.User.role == "worker").first()
    if not worker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")

    if payload.service_id is not None:
        service = db.query(models.Service).filter(models.Service.id == payload.service_id).first()
        if not service:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")

    booking = models.Booking(
        customer_id=current_user.id,
        worker_id=payload.worker_id,
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
        worker_id=payload.worker_id,
        customer_id=current_user.id,
        status="pending",
    )
    db.add(booking_request)
    db.commit()
    db.refresh(booking)
    db.refresh(booking_request)

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
        worker_name=worker.full_name,
        service_name=service.name if payload.service_id else None,
    )


@router.get("/customer/bookings", response_model=list[BookingResponse])
def list_customer_bookings(
    status: Optional[str] = Query(None),
    current_user: models.User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    query = db.query(models.Booking).filter(models.Booking.customer_id == current_user.id)
    if status:
        query = query.filter(models.Booking.status == status)

    bookings = query.order_by(models.Booking.created_at.desc()).all()
    response = []
    for booking in bookings:
        worker = db.query(models.User).filter(models.User.id == booking.worker_id).first()
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
                worker_name=worker.full_name if worker else None,
                service_name=service.name if service else None,
            )
        )
    return response


@router.get("/customer/bookings/{booking_id}", response_model=BookingResponse)
def get_customer_booking(
    booking_id: int,
    current_user: models.User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    worker = db.query(models.User).filter(models.User.id == booking.worker_id).first()
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
        worker_name=worker.full_name if worker else None,
        service_name=service.name if service else None,
    )
