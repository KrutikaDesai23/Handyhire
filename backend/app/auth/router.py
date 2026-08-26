from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.auth import security
from app.auth.dependencies import get_current_user
from app.database.connection import get_db
from app.schemas import (
    CustomerRegister,
    LoginRequest,
    TokenResponse,
    UserResponse,
    WorkerRegister,
)


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post(
    "/register/customer",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_customer(
    payload: CustomerRegister,
    db: Session = Depends(get_db),
):
    normalized_email = str(payload.email).strip().lower()
    normalized_mobile = payload.mobile_number.strip()

    existing_email = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == normalized_email)
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    existing_mobile = (
        db.query(models.User)
        .filter(models.User.mobile_number == normalized_mobile)
        .first()
    )

    if existing_mobile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number already registered",
        )

    user = models.User(
        full_name=payload.full_name.strip(),
        email=normalized_email,
        mobile_number=normalized_mobile,
        password_hash=security.hash_password(
            payload.password
        ),
        role="customer",
        address=payload.address,
        city=payload.city,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = security.create_access_token(
        {
            "sub": str(user.id),
            "role": user.role,
        }
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
    )


@router.get("/register/worker/availability")
def check_worker_registration_availability(
    email: str = Query(...),
    mobile_number: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Check whether an email address and mobile number can be
    used before moving from registration Step 2 to Step 3.
    """

    normalized_email = email.strip().lower()
    normalized_mobile = mobile_number.strip()

    email_exists = (
        db.query(models.User.id)
        .filter(func.lower(models.User.email) == normalized_email)
        .first()
        is not None
    )

    mobile_exists = (
        db.query(models.User.id)
        .filter(models.User.mobile_number == normalized_mobile)
        .first()
        is not None
    )

    return {
        "email_available": not email_exists,
        "mobile_available": not mobile_exists,
    }


@router.post(
    "/register/worker",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_worker(
    payload: WorkerRegister,
    db: Session = Depends(get_db),
):
    normalized_email = str(payload.email).strip().lower()
    normalized_mobile = payload.mobile_number.strip()

    existing_email = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == normalized_email)
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    existing_mobile = (
        db.query(models.User)
        .filter(models.User.mobile_number == normalized_mobile)
        .first()
    )

    if existing_mobile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number already registered",
        )

    user = models.User(
        full_name=payload.full_name.strip(),
        email=normalized_email,
        mobile_number=normalized_mobile,
        password_hash=security.hash_password(
            payload.password
        ),
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

    token = security.create_access_token(
        {
            "sub": str(user.id),
            "role": user.role,
        }
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    normalized_email = str(payload.email).strip().lower()

    user = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == normalized_email)
        .first()
    )

    if (
        not user
        or not security.verify_password(
            payload.password,
            user.password_hash,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    token = security.create_access_token(
        {
            "sub": str(user.id),
            "role": user.role,
        }
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_current_user_info(
    current_user: models.User = Depends(
        get_current_user
    ),
):
    return current_user