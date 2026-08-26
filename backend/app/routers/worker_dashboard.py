from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.auth.dependencies import get_current_worker
from app.database.connection import get_db
from app.schemas import DashboardResponse


router = APIRouter(prefix="/api/worker", tags=["worker"])


# =========================================================
# WORKER DASHBOARD
# =========================================================

@router.get("/dashboard", response_model=DashboardResponse)
def get_worker_dashboard(
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    worker_profile = (
        db.query(models.WorkerProfile)
        .filter(models.WorkerProfile.user_id == current_user.id)
        .first()
    )

    if not worker_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Worker profile not found"
        )

    total_requests = (
        db.query(models.BookingRequest)
        .filter(models.BookingRequest.worker_id == current_user.id)
        .count()
    )

    pending_requests = (
        db.query(models.BookingRequest)
        .filter(
            models.BookingRequest.worker_id == current_user.id,
            models.BookingRequest.status == "pending",
        )
        .count()
    )

    accepted_bookings = (
        db.query(models.Booking)
        .filter(
            models.Booking.worker_id == current_user.id,
            models.Booking.status == "accepted",
        )
        .count()
    )

    completed_bookings = (
        db.query(models.Booking)
        .filter(
            models.Booking.worker_id == current_user.id,
            models.Booking.status == "completed",
        )
        .count()
    )

    reviews = (
        db.query(models.Review)
        .filter(models.Review.worker_id == current_user.id)
        .all()
    )

    average_rating = (
        sum(review.rating for review in reviews) / len(reviews)
        if reviews
        else None
    )

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


# =========================================================
# ALL REGISTERED WORKERS
# Used by provider-home.html -> "All"
# =========================================================

@router.get("/directory")
def get_worker_directory(
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    """
    Return all successfully registered worker/provider accounts
    together with their professional profile information.
    """

    workers = (
        db.query(models.User, models.WorkerProfile)
        .join(
            models.WorkerProfile,
            models.WorkerProfile.user_id == models.User.id
        )
        .filter(models.User.role == "worker")
        .order_by(models.User.id.desc())
        .all()
    )

    result = []

    for user, profile in workers:

        reviews = (
            db.query(models.Review)
            .filter(models.Review.worker_id == user.id)
            .all()
        )

        review_count = len(reviews)

        average_rating = (
            round(
                sum(review.rating for review in reviews) / review_count,
                1
            )
            if review_count > 0
            else None
        )

        result.append({
            "id": user.id,
            "full_name": user.full_name,
            "profession": profile.profession,
            "experience": profile.experience,
            "qualification": profile.qualification,
            "location": profile.location,
            "price": profile.price,
            "availability": profile.availability,
            "profile_image": profile.profile_image,
            "average_rating": average_rating,
            "review_count": review_count,
        })

    return result