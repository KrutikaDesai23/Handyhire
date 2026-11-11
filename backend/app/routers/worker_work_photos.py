import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app import models
from app.auth.dependencies import get_current_worker
from app.database.connection import get_db
from app.image_uploads import validate_image_upload

router = APIRouter(prefix="/api/worker/work-photos", tags=["worker"])

class WorkPhotoCreate(BaseModel):
    worker_id: Optional[int] = None


class WorkPhotoResponse(BaseModel):
    id: int
    worker_id: int
    image_url: str
    created_at: Optional[str] = None


def _upload_dir():
    return os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "worker-work-photos")
    )


def _serialize(photo):
    return WorkPhotoResponse(
        id=photo.id,
        worker_id=photo.worker_id,
        image_url=photo.image_url,
        created_at=photo.created_at.isoformat() if photo.created_at else None,
    )


@router.post("", response_model=WorkPhotoResponse, status_code=status.HTTP_201_CREATED)
def upload_work_photo(
    request: Request,
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    """Upload a work photo. worker_id ALWAYS comes from the authenticated worker."""
    data, suffix = validate_image_upload(file)
    filename = "work-" + str(current_user.id) + "-" + uuid.uuid4().hex + suffix

    upload_dir = _upload_dir()
    os.makedirs(upload_dir, exist_ok=True)
    destination = os.path.join(upload_dir, filename)
    with open(destination, "wb") as buffer:
        buffer.write(data)

    worker_work_photo = models.WorkerWorkPhoto(
        worker_id=current_user.id,
        image_url=str(
            request.url_for("static", path="worker-work-photos/" + filename)
        ),
    )
    db.add(worker_work_photo)
    db.commit()
    db.refresh(worker_work_photo)

    return _serialize(worker_work_photo)


@router.get("", response_model=list[WorkPhotoResponse])
def list_own_work_photos(
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    """List only the photos belonging to the authenticated worker."""
    rows = (
        db.query(models.WorkerWorkPhoto)
        .filter(models.WorkerWorkPhoto.worker_id == current_user.id)
        .order_by(models.WorkerWorkPhoto.created_at.desc())
        .all()
    )
    return [_serialize(p) for p in rows]


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_own_work_photo(
    photo_id: int,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    """Delete a work photo. Only the owner may delete it."""
    photo = (
        db.query(models.WorkerWorkPhoto)
        .filter(models.WorkerWorkPhoto.id == photo_id)
        .first()
    )
    if not photo or photo.worker_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work photo not found")

    db.delete(photo)
    db.commit()

    # Best-effort: remove the physical file from disk if it is safe to do so.
    try:
        if photo.image_url:
            filename = os.path.basename(photo.image_url)
            candidate = os.path.join(_upload_dir(), filename)
            if os.path.isfile(candidate):
                os.remove(candidate)
    except Exception:
        # Never fail the delete just because the file is missing/unlinkable.
        pass
