from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, func
from sqlalchemy.orm import Session
from typing import Optional

from app import models
from app.database.connection import get_db
from app.schemas import WorkerResponse

router = APIRouter(prefix="/api/workers", tags=["workers"])

VALID_SORTS = {"rating", "price_asc", "price_desc", "name"}


@router.get("", response_model=list[WorkerResponse])
def list_workers(
    profession: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    availability: Optional[str] = Query(None),
    min_price: Optional[int] = Query(None, gt=0),
    max_price: Optional[int] = Query(None, gt=0),
    search: Optional[str] = Query(None),
    min_rating: Optional[float] = Query(None, ge=1, le=5),
    sort: Optional[str] = Query(None),
    limit: Optional[int] = Query(None, ge=1, le=200),
    offset: Optional[int] = Query(None, ge=0),
    db: Session = Depends(get_db),
):
    if sort and sort not in VALID_SORTS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid sort value. Allowed: {', '.join(sorted(VALID_SORTS))}",
        )

    # Aggregate average rating + review count per worker in a single query
    # to avoid the previous N+1 review query inside the loop.
    rating_subq = (
        db.query(
            models.Review.worker_id.label("worker_id"),
            func.avg(models.Review.rating).label("avg_rating"),
            func.count(models.Review.id).label("review_count"),
        )
        .group_by(models.Review.worker_id)
        .subquery()
    )

    query = (
        db.query(
            models.WorkerProfile,
            models.User,
            rating_subq.c.avg_rating,
            rating_subq.c.review_count,
        )
        .join(models.User, models.WorkerProfile.user_id == models.User.id)
        .outerjoin(rating_subq, rating_subq.c.worker_id == models.User.id)
    )

    if profession:
        query = query.filter(models.WorkerProfile.profession.ilike(f"%{profession}%"))
    if location:
        query = query.filter(models.WorkerProfile.location.ilike(f"%{location}%"))
    if availability:
        query = query.filter(models.WorkerProfile.availability.ilike(f"%{availability}%"))
    if min_price is not None:
        query = query.filter(models.WorkerProfile.price >= min_price)
    if max_price is not None:
        query = query.filter(models.WorkerProfile.price <= max_price)
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                models.User.full_name.ilike(like),
                models.WorkerProfile.profession.ilike(like),
                models.WorkerProfile.location.ilike(like),
            )
        )
    if min_rating is not None:
        query = query.filter(rating_subq.c.avg_rating >= min_rating)

    if sort == "rating":
        query = query.order_by(rating_subq.c.avg_rating.desc().nullslast())
    elif sort == "price_asc":
        query = query.order_by(models.WorkerProfile.price.asc())
    elif sort == "price_desc":
        query = query.order_by(models.WorkerProfile.price.desc())
    elif sort == "name":
        query = query.order_by(models.User.full_name.asc())
    else:
        query = query.order_by(models.User.id.asc())

    if offset is not None:
        query = query.offset(offset)
    if limit is not None:
        query = query.limit(limit)

    results = query.all()
    response = []
    for worker_profile, user, avg_rating, review_count in results:
        response.append(
            WorkerResponse(
                id=user.id,
                full_name=user.full_name,
                profession=worker_profile.profession,
                bio=worker_profile.bio,
                experience=worker_profile.experience,
                qualification=worker_profile.qualification,
                location=worker_profile.location,
                price=worker_profile.price,
                availability=worker_profile.availability,
                profile_image=worker_profile.profile_image,
                average_rating=round(avg_rating, 1) if avg_rating is not None else None,
                review_count=review_count or 0,
            )
        )
    return response


@router.get("/{worker_id}", response_model=WorkerResponse)
def get_worker_detail(worker_id: int, db: Session = Depends(get_db)):
    worker_profile = db.query(models.WorkerProfile).filter(models.WorkerProfile.user_id == worker_id).first()
    if not worker_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")

    user = db.query(models.User).filter(models.User.id == worker_id).first()
    if not user or user.role != "worker":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")

    reviews = db.query(models.Review).filter(models.Review.worker_id == worker_id).all()
    avg_rating = sum(r.rating for r in reviews) / len(reviews) if reviews else None

    return WorkerResponse(
        id=user.id,
        full_name=user.full_name,
        profession=worker_profile.profession,
        bio=worker_profile.bio,
        experience=worker_profile.experience,
        qualification=worker_profile.qualification,
        location=worker_profile.location,
        price=worker_profile.price,
        availability=worker_profile.availability,
        profile_image=worker_profile.profile_image,
        average_rating=avg_rating,
        review_count=len(reviews),
    )
