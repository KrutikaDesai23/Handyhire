from typing import Optional
from datetime import date

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    status,
    UploadFile,
    File,
    Form,
)
from fastapi.responses import JSONResponse
from sqlalchemy import exists
from sqlalchemy.orm import Session

from app import models
from app.auth.dependencies import (
    get_current_customer,
    get_current_user,
)
from app.database.connection import get_db
from app.schemas import (
    BookingCreate,
    BookingResponse,
    BookingDetailResponse,
    BookingPhotoResponse,
)


router = APIRouter(
    prefix="/api/bookings",
    tags=["bookings"],
)


def _build_booking_response(booking, db, team_name=None):
    worker = db.query(models.User).filter(models.User.id == booking.worker_id).first()
    service = db.query(models.Service).filter(models.Service.id == booking.service_id).first() if booking.service_id else None
    return BookingResponse(
        id=booking.id,
        customer_id=booking.customer_id,
        worker_id=booking.worker_id,
        team_id=booking.team_id,
        service_id=booking.service_id,
        booking_date=booking.booking_date,
        booking_time=booking.booking_time,
        address=booking.address,
        description=booking.description,
        amount=booking.amount,
        status=booking.status,
        created_at=booking.created_at.isoformat() if booking.created_at else None,
        worker_name=worker.full_name if worker else None,
        service_name=service.name if service else None,
        team_name=team_name,
    )


def _load_booking_photos(booking_id, db):
    rows = (
        db.query(models.BookingPhoto)
        .filter(models.BookingPhoto.booking_id == booking_id)
        .order_by(models.BookingPhoto.created_at.asc())
        .all()
    )
    before = []
    after = []
    for row in rows:
        item = {
            "id": row.id,
            "booking_id": row.booking_id,
            "photo_type": row.photo_type,
            "image_url": row.image_url,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        if row.photo_type == "after":
            after.append(item)
        else:
            before.append(item)
    return before, after


def _resolve_team_leader(booking, db):
    """Resolve the actual team leader for a team package booking.

    Returns the leader User (or None). Falls back to the booking's
    primary worker (package owner) only if no leader is marked.
    """
    if not booking.package_id:
        return None

    pkg = db.query(models.Package).filter(models.Package.id == booking.package_id).first()
    if not pkg or pkg.package_type != "team":
        return None

    leader_pw = (
        db.query(models.PackageWorker)
        .filter(
            models.PackageWorker.package_id == booking.package_id,
            models.PackageWorker.is_leader.is_(True),
        )
        .first()
    )

    if leader_pw:
        return db.query(models.User).filter(models.User.id == leader_pw.worker_id).first()

    return None


def _build_customer_booking_detail_response(booking, db):
    customer = db.query(models.User).filter(models.User.id == booking.customer_id).first()
    worker = db.query(models.User).filter(models.User.id == booking.worker_id).first()
    service = None
    if booking.service_id:
        service = db.query(models.Service).filter(models.Service.id == booking.service_id).first()
    package_name = None
    package_type = None
    team_name = None
    package_services = []
    team_members = []

    if booking.package_id:
        pkg = db.query(models.Package).filter(models.Package.id == booking.package_id).first()
        package_name = pkg.name if pkg else None
        package_type = pkg.package_type if pkg else None
        if pkg:
            team_name = None
            pkg_services = (
                db.query(models.PackageService)
                .filter(models.PackageService.package_id == pkg.id)
                .all()
            )
            for ps in pkg_services:
                svc = db.query(models.Service).filter(models.Service.id == ps.service_id).first()
                if svc:
                    package_services.append({
                        "id": svc.id,
                        "name": svc.name,
                        "description": svc.description,
                        "category": svc.category,
                        "base_price": svc.base_price,
                    })

    if package_type == "team":
        bw_rows = (
            db.query(models.BookingWorker)
            .filter(models.BookingWorker.booking_id == booking.id)
            .all()
        )
        for bw in bw_rows:
            member_user = db.query(models.User).filter(models.User.id == bw.worker_id).first()
            pw = (
                db.query(models.PackageWorker)
                .filter(
                    models.PackageWorker.package_id == booking.package_id,
                    models.PackageWorker.worker_id == bw.worker_id,
                )
                .first()
            )
            team_members.append({
                "worker_id": bw.worker_id,
                "full_name": member_user.full_name if member_user else "--",
                "profession": (
                    member_user.worker_profile.profession
                    if member_user and member_user.worker_profile
                    else None
                ),
                "status": bw.status,
                "is_leader": pw.is_leader if pw else False,
            })

    active_statuses = {"accepted", "confirmed", "completion_requested"}
    include_phones = booking.status in active_statuses

    before_photos, after_photos = _load_booking_photos(booking.id, db)

    contact_worker = worker
    if package_type == "team":
        leader = _resolve_team_leader(booking, db)
        if leader:
            contact_worker = leader

    return BookingDetailResponse(
        id=booking.id,
        customer_id=booking.customer_id,
        worker_id=booking.worker_id,
        team_id=booking.team_id,
        service_id=booking.service_id,
        package_id=booking.package_id,
        booking_date=booking.booking_date,
        booking_time=booking.booking_time,
        address=booking.address,
        description=booking.description,
        amount=booking.amount,
        status=booking.status,
        created_at=booking.created_at.isoformat() if booking.created_at else None,
        worker_name=contact_worker.full_name if contact_worker else None,
        service_name=service.name if service else None,
        customer_name=customer.full_name if customer else None,
        package_name=package_name,
        package_type=package_type,
        team_name=team_name,
        worker_phone=contact_worker.mobile_number if include_phones and contact_worker else None,
        customer_phone=customer.mobile_number if include_phones and customer else None,
        worker_image=contact_worker.worker_profile.profile_image if contact_worker and contact_worker.worker_profile else None,
        customer_image=customer.worker_profile.profile_image if customer and customer.worker_profile else None,
        package_services=package_services,
        team_members=team_members,
        before_photos=before_photos,
        after_photos=after_photos,
    )


def _worker_has_exact_slot_conflict(
    db,
    worker_id,
    booking_date,
    booking_time,
    exclude_booking_id=None,
):
    active_statuses = [
        "pending",
        "accepted",
        "completion_requested",
    ]

    direct = db.query(models.Booking).filter(
        models.Booking.worker_id == worker_id,
        models.Booking.booking_date == booking_date,
        models.Booking.booking_time == booking_time,
        models.Booking.status.in_(active_statuses),
    )

    team_owner_subq = db.query(models.Package).filter(
        models.Package.id == models.Booking.package_id,
        models.Package.package_type == "team",
        models.Package.owner_id == worker_id,
    ).exists()
    direct = direct.filter(~team_owner_subq)

    if exclude_booking_id is not None:
        direct = direct.filter(models.Booking.id != exclude_booking_id)

    if direct.first():
        return True

    bw = db.query(models.BookingWorker).filter(
        models.BookingWorker.worker_id == worker_id,
        models.BookingWorker.status.in_(active_statuses),
    ).join(
        models.Booking,
        models.BookingWorker.booking_id == models.Booking.id,
    ).filter(
        models.Booking.booking_date == booking_date,
        models.Booking.booking_time == booking_time,
        models.Booking.status.in_(active_statuses),
    )

    if exclude_booking_id is not None:
        bw = bw.filter(models.Booking.id != exclude_booking_id)

    return bw.first() is not None


@router.post(
    "",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_booking(
    payload: BookingCreate,
    current_user: models.User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    if current_user.role not in {
        "customer",
        "worker",
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account cannot create bookings",
        )

    if payload.team_id is not None:
        team = db.query(models.Team).filter(models.Team.id == payload.team_id).first()
        if not team:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

        members = db.query(models.TeamMember).filter(models.TeamMember.team_id == payload.team_id).all()
        if not members:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team has no members")

        if payload.service_id is not None:
            service = db.query(models.Service).filter(models.Service.id == payload.service_id).first()
            if not service:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")

        for member in members:
            if _worker_has_exact_slot_conflict(
                db,
                member.worker_id,
                payload.booking_date,
                payload.booking_time,
            ):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="One or more selected workers are already booked for the selected date and time.",
                )

        created_bookings = []
        for member in members:
            booking = models.Booking(
                customer_id=current_user.id,
                worker_id=member.worker_id,
                team_id=payload.team_id,
                service_id=payload.service_id,
                booking_date=payload.booking_date,
                booking_time=payload.booking_time,
                address=payload.address,
                description=payload.description,
                amount=payload.amount,
                status="pending",
            )
            db.add(booking)
            db.flush()

            booking_request = models.BookingRequest(
                booking_id=booking.id,
                worker_id=member.worker_id,
                customer_id=current_user.id,
                status="pending",
            )
            db.add(booking_request)
            created_bookings.append(booking)

        db.commit()
        for booking in created_bookings:
            db.refresh(booking)

        responses = []
        for booking in created_bookings:
            responses.append(_build_booking_response(booking, db, team_name=team.name))

        return JSONResponse(
            content=[r.model_dump(mode="json") for r in responses],
            status_code=status.HTTP_201_CREATED,
        )

    worker = None
    service = None
    package = None
    package_name = None
    team_package_workers = []

    worker_id = payload.worker_id
    service_id = payload.service_id
    booking_amount = payload.amount


    # =====================================================
    # MULTITASKING PACKAGE BOOKING
    # =====================================================

    if payload.package_id is not None:

        package = (
            db.query(models.Package)
            .filter(
                models.Package.id ==
                payload.package_id,
                models.Package.package_type.in_(
                    ["multitasking", "team"]
                ),
                models.Package.status ==
                "published",
            )
            .first()
        )

        if not package:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Package not found or not published",
            )

        package_name = package.name

        # Package owner is the worker who
        # will receive this booking request.
        worker_id = package.owner_id


        worker = (
            db.query(models.User)
            .filter(
                models.User.id == worker_id,
                models.User.role == "worker",
            )
            .first()
        )

        if not worker:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Package provider not found",
            )

        if worker.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot book your own package",
            )

        # A multitasking package contains
        # multiple services, so one single
        # service_id must not represent it.
        service_id = None
        service = None

        # Never trust the frontend package price.
        # Use the actual price saved in database.
        booking_amount = package.price * (payload.hours or 1)

        if _worker_has_exact_slot_conflict(
            db,
            worker_id,
            payload.booking_date,
            payload.booking_time,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This worker is already booked for the selected date and time.",
            )

        team_package_workers = []

        if package.package_type == "team":
            team_package_workers = (
                db.query(models.PackageWorker)
                .filter(models.PackageWorker.package_id == package.id)
                .all()
            )

            if not team_package_workers:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This team package has no members selected",
                )

            if any(pw.worker_id == current_user.id for pw in team_package_workers):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You cannot book a team package that you are part of.",
                )

            for pw in team_package_workers:
                if _worker_has_exact_slot_conflict(
                    db,
                    pw.worker_id,
                    payload.booking_date,
                    payload.booking_time,
                ):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="One or more selected workers are already booked for the selected date and time.",
                    )


    # =====================================================
    # NORMAL WORKER BOOKING
    # =====================================================

    else:

        if worker_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Worker is required",
            )


        worker = (
            db.query(models.User)
            .filter(
                models.User.id == worker_id,
                models.User.role == "worker",
            )
            .first()
        )

        if not worker:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Worker not found",
            )


        if worker.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot book yourself",
            )

        if _worker_has_exact_slot_conflict(
            db,
            worker_id,
            payload.booking_date,
            payload.booking_time,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This worker is already booked for the selected date and time.",
            )

        if service_id is not None:

            service = (
                db.query(models.Service)
                .filter(
                    models.Service.id ==
                    service_id
                )
                .first()
            )

            if not service:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Service not found",
                )


    # =====================================================
    # CREATE BOOKING
    # =====================================================

    booking = models.Booking(
        customer_id=current_user.id,
        worker_id=worker_id,
        service_id=service_id,
        package_id=payload.package_id,
        booking_date=payload.booking_date,
        booking_time=payload.booking_time,
        address=payload.address,
        description=payload.description,
        amount=booking_amount,
        status="pending",
    )

    db.add(booking)
    db.flush()


    # =====================================================
    # CREATE REQUEST FOR PROVIDER
    # =====================================================

    if team_package_workers:
        for pw in team_package_workers:
            if pw.worker_id == package.owner_id:
                continue

            bw = models.BookingWorker(
                booking_id=booking.id,
                worker_id=pw.worker_id,
                status="pending",
            )
            db.add(bw)

            br = models.BookingRequest(
                booking_id=booking.id,
                worker_id=pw.worker_id,
                customer_id=current_user.id,
                status="pending",
            )
            db.add(br)
    else:
        booking_request = models.BookingRequest(
            booking_id=booking.id,
            worker_id=worker_id,
            customer_id=current_user.id,
            status="pending",
        )
        db.add(booking_request)

    db.commit()

    db.refresh(booking)


    # =====================================================
    # RESPONSE
    # =====================================================

    return BookingResponse(
        id=booking.id,
        customer_id=booking.customer_id,
        worker_id=booking.worker_id,
        team_id=booking.team_id,
        service_id=booking.service_id,
        package_id=booking.package_id,
        booking_date=booking.booking_date,
        booking_time=booking.booking_time,
        address=booking.address,
        description=booking.description,
        amount=booking.amount,
        status=booking.status,
        created_at=(
            booking.created_at.isoformat()
            if booking.created_at
            else None
        ),
        worker_name=(
            worker.full_name
            if worker
            else None
        ),
        service_name=(
            service.name
            if service
            else None
        ),
        package_name=package_name,
    )

@router.get(
    "/customer/bookings",
    response_model=list[BookingResponse],
)
def list_customer_bookings(
    status_filter: Optional[str] = Query(
        None,
        alias="status",
    ),
    current_user: models.User = Depends(
        get_current_customer
    ),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.Booking)
        .filter(
            models.Booking.customer_id ==
            current_user.id
        )
    )

    if status_filter:
        query = query.filter(
            models.Booking.status ==
            status_filter
        )

    bookings = (
        query
        .order_by(
            models.Booking.created_at.desc()
        )
        .all()
    )

    response = []

    for booking in bookings:
        worker = (
            db.query(models.User)
            .filter(
                models.User.id ==
                booking.worker_id
            )
            .first()
        )

        service = None

        if booking.service_id:
            service = (
                db.query(models.Service)
                .filter(
                    models.Service.id ==
                    booking.service_id
                )
                .first()
            )

        package_name = None

        if booking.package_id:
            pkg = (
                db.query(models.Package)
                .filter(models.Package.id == booking.package_id)
                .first()
            )
            package_name = pkg.name if pkg else None

        response.append(
            BookingResponse(
                id=booking.id,
                customer_id=booking.customer_id,
                worker_id=booking.worker_id,
                team_id=booking.team_id,
                service_id=booking.service_id,
                package_id=booking.package_id,
                booking_date=booking.booking_date,
                booking_time=booking.booking_time,
                address=booking.address,
                description=booking.description,
                amount=booking.amount,
                status=booking.status,
                created_at=(
                    booking.created_at.isoformat()
                    if booking.created_at
                    else None
                ),
                worker_name=(
                    worker.full_name
                    if worker
                    else None
                ),
                service_name=(
                    service.name
                    if service
                    else None
                ),
                package_name=package_name,
            )
        )

    return response


@router.get(
    "/customer/bookings/{booking_id}",
    response_model=BookingDetailResponse,
)
def get_customer_booking(
    booking_id: int,
    current_user: models.User = Depends(
        get_current_customer
    ),
    db: Session = Depends(get_db),
):
    booking = (
        db.query(models.Booking)
        .filter(
            models.Booking.id ==
            booking_id
        )
        .first()
    )

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    if booking.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    return _build_customer_booking_detail_response(booking, db)


@router.post(
    "/{booking_id}/photos",
    response_model=BookingPhotoResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_booking_photo(
    booking_id: int,
    photo_type: str = Form("before"),
    file: UploadFile = File(...),
    request: Request = None,
    current_user: models.User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    booking = (
        db.query(models.Booking)
        .filter(models.Booking.id == booking_id)
        .first()
    )

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    if booking.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    photo_type = (photo_type or "before").strip().lower()
    if photo_type not in {"before", "after"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="photo_type must be 'before' or 'after'.",
        )

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

    import os
    import uuid

    ext_map = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }
    suffix = ext_map.get(file.content_type, ".bin")

    filename = (
        "booking-"
        + str(booking.id)
        + "-"
        + str(uuid.uuid4().hex)
        + suffix
    )

    upload_dir = os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "uploads",
        "booking-photos",
    )
    upload_dir = os.path.abspath(upload_dir)
    os.makedirs(upload_dir, exist_ok=True)

    destination = os.path.join(upload_dir, filename)

    with open(destination, "wb") as buffer:
        buffer.write(file.file.read())

    photo = models.BookingPhoto(
        booking_id=booking.id,
        photo_type=photo_type,
        image_url=str(request.url_for("static", path="booking-photos/" + filename)),
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)

    return BookingPhotoResponse(
        id=photo.id,
        booking_id=photo.booking_id,
        photo_type=photo.photo_type,
        image_url=photo.image_url,
        created_at=photo.created_at.isoformat() if photo.created_at else None,
    )