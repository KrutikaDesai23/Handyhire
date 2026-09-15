from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app import models
from app.auth.dependencies import get_current_customer, get_current_user
from app.database.connection import get_db
from app.schemas import BookingCreate, BookingDetailResponse, BookingPhotoResponse, BookingResponse

router = APIRouter(prefix="/api/bookings", tags=["bookings"])

ACTIVE_SLOT_STATUSES = {"pending", "accepted", "in_progress", "completion_requested"}


def _get_package(package_id: Optional[int], db: Session):
    if not package_id:
        return None
    return db.query(models.Package).filter(models.Package.id == package_id).first()


def _build_booking_response(booking, db: Session, team_name=None):
    worker = db.query(models.User).filter(models.User.id == booking.worker_id).first()
    service = (
        db.query(models.Service).filter(models.Service.id == booking.service_id).first()
        if booking.service_id else None
    )
    package = _get_package(booking.package_id, db)
    return BookingResponse(
        id=booking.id,
        customer_id=booking.customer_id,
        worker_id=booking.worker_id,
        team_id=booking.team_id,
        service_id=booking.service_id,
        package_id=booking.package_id,
        booking_date=booking.booking_date,
        booking_time=booking.booking_time,
        hours=getattr(booking, "hours", 1) or 1,
        address=booking.address,
        description=booking.description,
        amount=booking.amount,
        status=booking.status,
        created_at=booking.created_at.isoformat() if booking.created_at else None,
        worker_name=worker.full_name if worker else None,
        service_name=service.name if service else None,
        package_name=package.name if package else None,
        package_type=package.package_type if package else None,
        team_name=team_name,
    )


def _load_booking_photos(booking_id: int, db: Session):
    rows = (
        db.query(models.BookingPhoto)
        .filter(models.BookingPhoto.booking_id == booking_id)
        .order_by(models.BookingPhoto.created_at.asc())
        .all()
    )
    before, after = [], []
    for row in rows:
        item = {
            "id": row.id,
            "booking_id": row.booking_id,
            "photo_type": row.photo_type,
            "image_url": row.image_url,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        (after if row.photo_type == "after" else before).append(item)
    return before, after


def _resolve_team_leader(booking, db: Session):
    package = _get_package(booking.package_id, db)
    if not package or package.package_type != "team":
        return None
    leader = (
        db.query(models.PackageWorker)
        .filter(
            models.PackageWorker.package_id == package.id,
            models.PackageWorker.is_leader.is_(True),
        )
        .first()
    )
    if not leader:
        return None
    return db.query(models.User).filter(models.User.id == leader.worker_id).first()


def _build_customer_booking_detail_response(booking, db: Session):
    customer = db.query(models.User).filter(models.User.id == booking.customer_id).first()
    worker = db.query(models.User).filter(models.User.id == booking.worker_id).first()
    service = (
        db.query(models.Service).filter(models.Service.id == booking.service_id).first()
        if booking.service_id else None
    )
    package = _get_package(booking.package_id, db)
    package_name = package.name if package else None
    package_type = package.package_type if package else None
    package_services, team_members = [], []

    if package:
        rows = db.query(models.PackageService).filter(models.PackageService.package_id == package.id).all()
        for row in rows:
            svc = db.query(models.Service).filter(models.Service.id == row.service_id).first()
            if svc:
                package_services.append({
                    "id": svc.id,
                    "name": svc.name,
                    "description": svc.description,
                    "category": svc.category,
                    "base_price": svc.base_price,
                })

    if package_type == "team":
        rows = db.query(models.BookingWorker).filter(models.BookingWorker.booking_id == booking.id).all()
        for row in rows:
            member = db.query(models.User).filter(models.User.id == row.worker_id).first()
            package_worker = (
                db.query(models.PackageWorker)
                .filter(
                    models.PackageWorker.package_id == booking.package_id,
                    models.PackageWorker.worker_id == row.worker_id,
                )
                .first()
            )
            team_members.append({
                "worker_id": row.worker_id,
                "full_name": member.full_name if member else "--",
                "profession": member.worker_profile.profession if member and member.worker_profile else None,
                "status": row.status,
                "is_leader": bool(package_worker and package_worker.is_leader),
            })

    include_phones = booking.status in {"accepted", "confirmed", "in_progress", "completion_requested"}
    before_photos, after_photos = _load_booking_photos(booking.id, db)
    contact_worker = _resolve_team_leader(booking, db) if package_type == "team" else worker
    contact_worker = contact_worker or worker

    return BookingDetailResponse(
        id=booking.id,
        customer_id=booking.customer_id,
        worker_id=booking.worker_id,
        team_id=booking.team_id,
        service_id=booking.service_id,
        package_id=booking.package_id,
        booking_date=booking.booking_date,
        booking_time=booking.booking_time,
        hours=getattr(booking, "hours", 1) or 1,
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
        team_name=None,
        worker_phone=contact_worker.mobile_number if include_phones and contact_worker else None,
        customer_phone=customer.mobile_number if include_phones and customer else None,
        worker_image=(contact_worker.worker_profile.profile_image if contact_worker and contact_worker.worker_profile else None),
        customer_image=None,
        package_services=package_services,
        team_members=team_members,
        before_photos=before_photos,
        after_photos=after_photos,
    )


def _time_to_minutes(value):
    raw = str(value or "").strip()
    for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p"):
        try:
            parsed = datetime.strptime(raw, fmt)
            return parsed.hour * 60 + parsed.minute
        except ValueError:
            pass
    return None


def _overlaps(start_a, hours_a, start_b, hours_b):
    if start_a is None or start_b is None:
        return False
    end_a = start_a + max(1, int(hours_a or 1)) * 60
    end_b = start_b + max(1, int(hours_b or 1)) * 60
    return start_a < end_b and start_b < end_a


def _booking_overlaps(existing, requested_time: str, requested_hours: int):
    requested_start = _time_to_minutes(requested_time)
    existing_start = _time_to_minutes(existing.booking_time)
    if requested_start is None or existing_start is None:
        return str(existing.booking_time) == str(requested_time)
    return _overlaps(
        requested_start,
        requested_hours,
        existing_start,
        getattr(existing, "hours", 1) or 1,
    )


def _worker_has_slot_conflict(
    db: Session,
    worker_id: int,
    booking_date,
    booking_time: str,
    hours: int = 1,
    exclude_booking_id: Optional[int] = None,
):
    direct = db.query(models.Booking).filter(
        models.Booking.worker_id == worker_id,
        models.Booking.booking_date == booking_date,
        models.Booking.status.in_(list(ACTIVE_SLOT_STATUSES)),
    )

    organizer_only = (
        db.query(models.Package)
        .filter(
            models.Package.id == models.Booking.package_id,
            models.Package.package_type == "team",
            models.Package.owner_id == worker_id,
        )
        .exists()
    )
    direct = direct.filter(~organizer_only)
    if exclude_booking_id is not None:
        direct = direct.filter(models.Booking.id != exclude_booking_id)

    for existing in direct.all():
        if _booking_overlaps(existing, booking_time, hours):
            return True

    participant_query = (
        db.query(models.Booking)
        .join(models.BookingWorker, models.BookingWorker.booking_id == models.Booking.id)
        .filter(
            models.BookingWorker.worker_id == worker_id,
            models.BookingWorker.status.in_(list(ACTIVE_SLOT_STATUSES)),
            models.Booking.booking_date == booking_date,
            models.Booking.status.in_(list(ACTIVE_SLOT_STATUSES)),
        )
    )
    if exclude_booking_id is not None:
        participant_query = participant_query.filter(models.Booking.id != exclude_booking_id)

    for existing in participant_query.all():
        if _booking_overlaps(existing, booking_time, hours):
            return True
    return False


def _worker_has_exact_slot_conflict(db, worker_id, booking_date, booking_time, exclude_booking_id=None):
    return _worker_has_slot_conflict(
        db, worker_id, booking_date, booking_time, 1, exclude_booking_id
    )


def _require_worker(worker_id: int, db: Session):
    worker = (
        db.query(models.User)
        .filter(models.User.id == worker_id, models.User.role == "worker")
        .first()
    )
    if not worker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")
    return worker


def _worker_hourly_price(worker_id: int, db: Session):
    profile = db.query(models.WorkerProfile).filter(models.WorkerProfile.user_id == worker_id).first()
    if not profile or not profile.price or profile.price <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Worker does not have a valid hourly price",
        )
    return int(profile.price)


def _ensure_available(db, worker_id, booking_date, booking_time, hours, team=False):
    if _worker_has_slot_conflict(db, worker_id, booking_date, booking_time, hours):
        detail = (
            "One or more selected workers are already booked for the selected time."
            if team else
            "This worker is already booked for the selected time."
        )
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: BookingCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in {"customer", "worker"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account cannot create bookings")

    if payload.booking_date < date.today():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking date cannot be in the past")

    targets = [payload.worker_id, payload.team_id, payload.package_id]
    if sum(value is not None for value in targets) != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide exactly one booking target: worker, team, or package",
        )

    hours = int(payload.hours or 1)

    if payload.team_id is not None:
        team = db.query(models.Team).filter(models.Team.id == payload.team_id).first()
        if not team:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
        members = db.query(models.TeamMember).filter(models.TeamMember.team_id == team.id).all()
        if not members:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team has no members")

        service = None
        if payload.service_id is not None:
            service = db.query(models.Service).filter(models.Service.id == payload.service_id).first()
            if not service:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")

        for member in members:
            _require_worker(member.worker_id, db)
            _ensure_available(db, member.worker_id, payload.booking_date, payload.booking_time, hours, team=True)

        bookings = []
        for member in members:
            booking = models.Booking(
                customer_id=current_user.id,
                worker_id=member.worker_id,
                team_id=team.id,
                service_id=payload.service_id,
                booking_date=payload.booking_date,
                booking_time=payload.booking_time,
                hours=hours,
                address=payload.address,
                description=payload.description,
                amount=_worker_hourly_price(member.worker_id, db) * hours,
                status="pending",
            )
            db.add(booking)
            db.flush()
            db.add(models.BookingRequest(
                booking_id=booking.id,
                worker_id=member.worker_id,
                customer_id=current_user.id,
                status="pending",
            ))
            bookings.append(booking)

        db.commit()
        for booking in bookings:
            db.refresh(booking)
        responses = [_build_booking_response(b, db, team_name=team.name) for b in bookings]
        return JSONResponse(
            content=[item.model_dump(mode="json") for item in responses],
            status_code=status.HTTP_201_CREATED,
        )

    worker = None
    service = None
    package = None
    team_workers = []
    leader_row = None
    worker_id = payload.worker_id
    service_id = payload.service_id

    if payload.package_id is not None:
        package = (
            db.query(models.Package)
            .filter(
                models.Package.id == payload.package_id,
                models.Package.package_type.in_(["multitasking", "team"]),
                models.Package.status == "published",
            )
            .first()
        )
        if not package:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found or not published")
        if package.owner_id == current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot book your own package")

        service_id = None
        booking_amount = int(package.price) * hours

        if package.package_type == "team":
            team_workers = db.query(models.PackageWorker).filter(models.PackageWorker.package_id == package.id).all()
            if not team_workers:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This team package has no members selected")

            leaders = [row for row in team_workers if row.is_leader]
            if len(leaders) != 1:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This team package must have exactly one leader")
            if any(row.worker_id == current_user.id for row in team_workers):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot book a team package that you are part of")

            leader_row = leaders[0]
            worker_id = leader_row.worker_id
            worker = _require_worker(worker_id, db)
            for row in team_workers:
                _require_worker(row.worker_id, db)
                _ensure_available(db, row.worker_id, payload.booking_date, payload.booking_time, hours, team=True)
        else:
            worker_id = package.owner_id
            worker = _require_worker(worker_id, db)
            _ensure_available(db, worker_id, payload.booking_date, payload.booking_time, hours)
    else:
        worker = _require_worker(worker_id, db)
        if worker.id == current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot book yourself")
        _ensure_available(db, worker_id, payload.booking_date, payload.booking_time, hours)

        if service_id is not None:
            service = db.query(models.Service).filter(models.Service.id == service_id).first()
            if not service:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")

        booking_amount = _worker_hourly_price(worker_id, db) * hours

    booking = models.Booking(
        customer_id=current_user.id,
        worker_id=worker_id,
        service_id=service_id,
        package_id=payload.package_id,
        booking_date=payload.booking_date,
        booking_time=payload.booking_time,
        hours=hours,
        address=payload.address,
        description=payload.description,
        amount=booking_amount,
        status="pending",
    )
    db.add(booking)
    db.flush()

    if team_workers:
        for row in team_workers:
            db.add(models.BookingWorker(
                booking_id=booking.id,
                worker_id=row.worker_id,
                status="pending",
            ))
        db.add(models.BookingRequest(
            booking_id=booking.id,
            worker_id=leader_row.worker_id,
            customer_id=current_user.id,
            status="pending",
        ))
    else:
        db.add(models.BookingRequest(
            booking_id=booking.id,
            worker_id=worker_id,
            customer_id=current_user.id,
            status="pending",
        ))

    db.commit()
    db.refresh(booking)
    return _build_booking_response(booking, db)


@router.get("/customer/bookings", response_model=list[BookingResponse])
def list_customer_bookings(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: models.User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    query = db.query(models.Booking).filter(models.Booking.customer_id == current_user.id)
    if status_filter:
        query = query.filter(models.Booking.status == status_filter)
    bookings = query.order_by(models.Booking.created_at.desc()).all()
    return [_build_booking_response(booking, db) for booking in bookings]


@router.get("/customer/bookings/{booking_id}", response_model=BookingDetailResponse)
def get_customer_booking(
    booking_id: int,
    current_user: models.User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking or booking.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return _build_customer_booking_detail_response(booking, db)


@router.post("/{booking_id}/photos", response_model=BookingPhotoResponse, status_code=status.HTTP_201_CREATED)
def upload_booking_photo(
    booking_id: int,
    photo_type: str = Form("before"),
    file: UploadFile = File(...),
    request: Request = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking or booking.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if current_user.role not in {"customer", "worker"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customer or worker access required")

    photo_type = (photo_type or "before").strip().lower()
    if photo_type not in {"before", "after"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="photo_type must be 'before' or 'after'")

    allowed = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Allowed image types: JPG, PNG, WEBP")

    try:
        file.file.seek(0, 2)
        size = file.file.tell()
        file.file.seek(0)
    except Exception:
        size = None
    if size is not None and size > 5 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Maximum image size is 5 MB")

    import os
    import uuid

    filename = f"booking-{booking.id}-{uuid.uuid4().hex}{allowed[file.content_type]}"
    upload_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "booking-photos"))
    os.makedirs(upload_dir, exist_ok=True)
    with open(os.path.join(upload_dir, filename), "wb") as buffer:
        buffer.write(file.file.read())

    image_url = str(request.url_for("static", path="booking-photos/" + filename)) if request else "/static/booking-photos/" + filename
    photo = models.BookingPhoto(booking_id=booking.id, photo_type=photo_type, image_url=image_url)
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
