from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.auth.dependencies import get_current_customer
from app.database.connection import get_db
from app.schemas import CustomerProfileResponse, CustomerProfileUpdate

router = APIRouter(prefix="/api/customer", tags=["customer"])


@router.get("/profile", response_model=CustomerProfileResponse)
def get_customer_profile(current_user: models.User = Depends(get_current_customer)):
    return current_user


@router.put("/profile", response_model=CustomerProfileResponse)
def update_customer_profile(
    payload: CustomerProfileUpdate,
    current_user: models.User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.email is not None:
        existing = db.query(models.User).filter(models.User.email == payload.email).first()
        if existing and existing.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        current_user.email = payload.email
    if payload.mobile_number is not None:
        existing = db.query(models.User).filter(models.User.mobile_number == payload.mobile_number).first()
        if existing and existing.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mobile number already registered",
            )
        current_user.mobile_number = payload.mobile_number
    if payload.address is not None:
        current_user.address = payload.address
    if payload.city is not None:
        current_user.city = payload.city

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user
