from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Optional

from app import models
from app.database.connection import get_db
from app.schemas import WorkerResponse

router = APIRouter(prefix="/api/workers", tags=["workers"])


@router.get("", response_model=list[WorkerResponse])
def list_workers(
    profession: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    availability: Optional[str] = Query(None),
    min_price: Optional[int] = Query(None, gt=0),
    max_price: Optional[int] = Query(None, gt=0),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(models.WorkerProfile, models.User).join(models.User, models.WorkerProfile.user_id == models.User.id)

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

    results = query.all()
    response = []
    for worker_profile, user in results:
        reviews = db.query(models.Review).filter(models.Review.worker_id == user.id).all()
        avg_rating = sum(r.rating for r in reviews) / len(reviews) if reviews else None
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
                average_rating=avg_rating,
                review_count=len(reviews),
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
