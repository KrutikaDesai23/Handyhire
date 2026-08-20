from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.auth.dependencies import get_current_worker
from app.database.connection import get_db
from app.schemas import ServiceResponse

router = APIRouter(prefix="/api/worker", tags=["worker"])


@router.get("/services", response_model=list[ServiceResponse])
def list_worker_services(
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    return db.query(models.Service).all()
