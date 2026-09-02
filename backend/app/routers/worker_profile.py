from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from starlette.responses import JSONResponse

from app import models
from app.auth.dependencies import get_current_worker
from app.database.connection import get_db
from app.schemas import WorkerProfileResponse, WorkerProfileUpdate

router = APIRouter(prefix="/api/worker", tags=["worker"])


@router.post("/profile-image")
def upload_profile_image(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only image files are allowed.",
        )

    allowed = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Allowed image types: JPG, PNG, WEBP.",
        )

    max_bytes = 5 * 1024 * 1024

    try:
        file.file.seek(0, 2)
        size = file.file.tell()
        file.file.seek(0)
    except Exception:
        size = None

    if size is not None and size > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Maximum image size is 5 MB.",
        )

    ext_map = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }
    suffix = ext_map.get(file.content_type, ".bin")

    filename = (
        "profile-"
        + str(current_user.id)
        + "-"
        + str(abs(hash(file.filename or "")))
        + suffix
    )

    import os
    import uuid

    upload_dir = os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "uploads",
        "profile-images",
    )
    upload_dir = os.path.abspath(upload_dir)
    os.makedirs(upload_dir, exist_ok=True)

    destination = os.path.join(upload_dir, filename)

    with open(destination, "wb") as buffer:
        buffer.write(file.file.read())

    worker_profile = db.query(models.WorkerProfile).filter(models.WorkerProfile.user_id == current_user.id).first()
    if not worker_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker profile not found")

    worker_profile.profile_image = (
        "http://127.0.0.1:8000/static/profile-images/"
        + filename
    )
    db.add(worker_profile)
    db.commit()
    db.refresh(worker_profile)

    return JSONResponse(
        content={"profile_image": worker_profile.profile_image}
    )


@router.get("/profile", response_model=WorkerProfileResponse)
def get_worker_profile(current_user: models.User = Depends(get_current_worker), db: Session = Depends(get_db)):
    worker_profile = db.query(models.WorkerProfile).filter(models.WorkerProfile.user_id == current_user.id).first()
    if not worker_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker profile not found")

    return WorkerProfileResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        mobile_number=current_user.mobile_number,
        role=current_user.role,
        address=current_user.address,
        city=current_user.city,
        profession=worker_profile.profession,
        bio=worker_profile.bio,
        experience=worker_profile.experience,
        qualification=worker_profile.qualification,
        location=worker_profile.location,
        price=worker_profile.price,
        availability=worker_profile.availability,
        profile_image=worker_profile.profile_image,
    )


@router.put("/profile", response_model=WorkerProfileResponse)
def update_worker_profile(
    payload: WorkerProfileUpdate,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    worker_profile = db.query(models.WorkerProfile).filter(models.WorkerProfile.user_id == current_user.id).first()
    if not worker_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker profile not found")

    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.email is not None:
        existing = db.query(models.User).filter(models.User.email == payload.email).first()
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        current_user.email = payload.email
    if payload.mobile_number is not None:
        existing = db.query(models.User).filter(models.User.mobile_number == payload.mobile_number).first()
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mobile number already registered")
        current_user.mobile_number = payload.mobile_number
    if payload.address is not None:
        current_user.address = payload.address
    if payload.city is not None:
        current_user.city = payload.city
    if payload.profession is not None:
        worker_profile.profession = payload.profession
    if payload.bio is not None:
        worker_profile.bio = payload.bio
    if payload.experience is not None:
        worker_profile.experience = payload.experience
    if payload.qualification is not None:
        worker_profile.qualification = payload.qualification
    if payload.location is not None:
        worker_profile.location = payload.location
    if payload.price is not None:
        worker_profile.price = payload.price
    if payload.availability is not None:
        worker_profile.availability = payload.availability
    if payload.profile_image is not None:
        worker_profile.profile_image = payload.profile_image

    db.add(current_user)
    db.add(worker_profile)
    db.commit()
    db.refresh(current_user)
    db.refresh(worker_profile)

    return WorkerProfileResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        mobile_number=current_user.mobile_number,
        role=current_user.role,
        address=current_user.address,
        city=current_user.city,
        profession=worker_profile.profession,
        bio=worker_profile.bio,
        experience=worker_profile.experience,
        qualification=worker_profile.qualification,
        location=worker_profile.location,
        price=worker_profile.price,
        availability=worker_profile.availability,
        profile_image=worker_profile.profile_image,
    )
