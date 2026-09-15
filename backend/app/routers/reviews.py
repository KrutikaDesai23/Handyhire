from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import models
from app.auth.dependencies import get_current_customer
from app.database.connection import get_db
from app.schemas import ReviewCreate, ReviewResponse

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


def _resolve_review_worker_id(booking: models.Booking, db: Session) -> int:
    if booking.package_id:
        package = db.query(models.Package).filter(models.Package.id == booking.package_id).first()
        if package and package.package_type == "team":
            leaders = (
                db.query(models.PackageWorker)
                .filter(
                    models.PackageWorker.package_id == package.id,
                    models.PackageWorker.is_leader.is_(True),
                )
                .all()
            )
            if len(leaders) != 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Team package must have exactly one leader before it can be reviewed",
                )
            return leaders[0].worker_id

    if not booking.worker_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking does not have a reviewable worker",
        )
    return booking.worker_id


@router.post("", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(
    payload: ReviewCreate,
    current_user: models.User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    booking = db.query(models.Booking).filter(models.Booking.id == payload.booking_id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only review your own bookings")

    if booking.status != "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only completed bookings can be reviewed")

    existing = db.query(models.Review).filter(models.Review.booking_id == payload.booking_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This booking has already been reviewed")

    review_worker_id = _resolve_review_worker_id(booking, db)
    review = models.Review(
        booking_id=payload.booking_id,
        customer_id=current_user.id,
        worker_id=review_worker_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    customer = db.query(models.User).filter(models.User.id == review.customer_id).first()
    worker = db.query(models.User).filter(models.User.id == review.worker_id).first()

    return ReviewResponse(
        id=review.id,
        booking_id=review.booking_id,
        customer_id=review.customer_id,
        worker_id=review.worker_id,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at.isoformat() if review.created_at else None,
        customer_name=customer.full_name if customer else None,
        worker_name=worker.full_name if worker else None,
    )


@router.get("/workers/{worker_id}", response_model=list[ReviewResponse])
def list_worker_reviews(worker_id: int, db: Session = Depends(get_db)):
    worker = db.query(models.User).filter(models.User.id == worker_id, models.User.role == "worker").first()
    if not worker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")

    reviews = db.query(models.Review).filter(models.Review.worker_id == worker_id).all()
    response = []
    for review in reviews:
        customer = db.query(models.User).filter(models.User.id == review.customer_id).first()
        response.append(
            ReviewResponse(
                id=review.id,
                booking_id=review.booking_id,
                customer_id=review.customer_id,
                worker_id=review.worker_id,
                rating=review.rating,
                comment=review.comment,
                created_at=review.created_at.isoformat() if review.created_at else None,
                customer_name=customer.full_name if customer else None,
                worker_name=worker.full_name,
            )
        )
    return response


@router.get("/{review_id}", response_model=ReviewResponse)
def get_review(review_id: int, db: Session = Depends(get_db)):
    review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

    customer = db.query(models.User).filter(models.User.id == review.customer_id).first()
    worker = db.query(models.User).filter(models.User.id == review.worker_id).first()

    return ReviewResponse(
        id=review.id,
        booking_id=review.booking_id,
        customer_id=review.customer_id,
        worker_id=review.worker_id,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at.isoformat() if review.created_at else None,
        customer_name=customer.full_name if customer else None,
        worker_name=worker.full_name if worker else None,
    )
