from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.auth.dependencies import get_current_worker
from app.database.connection import get_db
from app.schemas import DashboardResponse

router = APIRouter(prefix="/api/worker", tags=["worker"])


@router.get("/dashboard", response_model=DashboardResponse)
def get_worker_dashboard(
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    worker_profile = db.query(models.WorkerProfile).filter(models.WorkerProfile.user_id == current_user.id).first()
    if not worker_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker profile not found")

    total_requests = db.query(models.BookingRequest).filter(models.BookingRequest.worker_id == current_user.id).count()
    pending_requests = db.query(models.BookingRequest).filter(
        models.BookingRequest.worker_id == current_user.id,
        models.BookingRequest.status == "pending",
    ).count()
    accepted_bookings = db.query(models.Booking).filter(
        models.Booking.worker_id == current_user.id,
        models.Booking.status == "accepted",
    ).count()
    completed_bookings = db.query(models.Booking).filter(
        models.Booking.worker_id == current_user.id,
        models.Booking.status == "completed",
    ).count()

    reviews = db.query(models.Review).filter(models.Review.worker_id == current_user.id).all()
    average_rating = sum(r.rating for r in reviews) / len(reviews) if reviews else None
    review_count = len(reviews)

    return DashboardResponse(
        worker_name=current_user.full_name,
        profession=worker_profile.profession,
        total_requests=total_requests,
        pending_requests=pending_requests,
        accepted_bookings=accepted_bookings,
        completed_bookings=completed_bookings,
        average_rating=average_rating,
        review_count=review_count,
    )
