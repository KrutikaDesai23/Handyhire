from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.auth import security
from app.auth.dependencies import get_current_user
from app.database.connection import get_db
from app.schemas import CustomerRegister, LoginRequest, TokenResponse, UserResponse, WorkerRegister

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register/customer", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_customer(payload: CustomerRegister, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    existing_mobile = db.query(models.User).filter(models.User.mobile_number == payload.mobile_number).first()
    if existing_mobile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number already registered",
        )

    user = models.User(
        full_name=payload.full_name,
        email=payload.email,
        mobile_number=payload.mobile_number,
        password_hash=security.hash_password(payload.password),
        role="customer",
        address=payload.address,
        city=payload.city,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = security.create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
    )


@router.post("/register/worker", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_worker(payload: WorkerRegister, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    existing_mobile = db.query(models.User).filter(models.User.mobile_number == payload.mobile_number).first()
    if existing_mobile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number already registered",
        )

    user = models.User(
        full_name=payload.full_name,
        email=payload.email,
        mobile_number=payload.mobile_number,
        password_hash=security.hash_password(payload.password),
        role="worker",
    )
    db.add(user)
    db.flush()

    worker_profile = models.WorkerProfile(
        user_id=user.id,
        profession=payload.profession,
        bio=payload.bio,
        experience=payload.experience,
        qualification=payload.qualification,
        location=payload.location,
        price=payload.price,
        availability=payload.availability,
        profile_image=payload.profile_image,
    )
    db.add(worker_profile)
    db.commit()
    db.refresh(user)

    token = security.create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not security.verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = security.create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: models.User = Depends(get_current_user)):
    return current_user
