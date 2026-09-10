from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from fastapi.responses import JSONResponse
from sqlalchemy import not_, exists
from sqlalchemy.orm import Session

from app import models
from app.auth.dependencies import (
    get_current_worker,
)
from app.database.connection import get_db
from app.schemas import (
    BookingResponse,
    BookingDetailResponse,
)


router = APIRouter(
    prefix="/api/worker",
    tags=["worker"],
)


def _build_booking_response(
    booking: models.Booking,
    db: Session,
) -> BookingResponse:
    customer = (
        db.query(models.User)
        .filter(
            models.User.id ==
            booking.customer_id
        )
        .first()
    )

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
    package_type = None

    if booking.package_id:
        pkg = (
            db.query(models.Package)
            .filter(models.Package.id == booking.package_id)
            .first()
        )
        package_name = pkg.name if pkg else None
        package_type = pkg.package_type if pkg else None

    return BookingResponse(
        id=booking.id,
        customer_id=booking.customer_id,
        worker_id=booking.worker_id,
        service_id=booking.service_id,
        package_id=booking.package_id,
        package_type=package_type,
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
        customer_name=(
            customer.full_name
            if customer
            else None
        ),
        package_name=package_name,
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


def _build_worker_booking_detail_response(
    booking: models.Booking,
    db: Session,
) -> BookingDetailResponse:
    customer = (
        db.query(models.User)
        .filter(
            models.User.id ==
            booking.customer_id
        )
        .first()
    )

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
    package_type = None
    team_name = None
    package_services = []
    team_members = []

    if booking.package_id:
        pkg = (
            db.query(models.Package)
            .filter(models.Package.id == booking.package_id)
            .first()
        )
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
        created_at=(
            booking.created_at.isoformat()
            if booking.created_at
            else None
        ),
        worker_name=(
            contact_worker.full_name
            if contact_worker
            else None
        ),
        service_name=(
            service.name
            if service
            else None
        ),
        customer_name=(
            customer.full_name
            if customer
            else None
        ),
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


@router.get(
    "/bookings",
    response_model=list[BookingResponse],
)
def list_worker_bookings(
    booking_status: Optional[str] = Query(
        None,
        alias="status",
    ),
    current_user: models.User = Depends(
        get_current_worker
    ),
    db: Session = Depends(get_db),
):
    direct = db.query(models.Booking).filter(
        models.Booking.worker_id == current_user.id
    )

    owner_only_team_exists = (
        db.query(models.BookingWorker.booking_id)
        .filter(models.BookingWorker.booking_id == models.Booking.id)
        .filter(models.BookingWorker.worker_id == current_user.id)
        .exists()
    )

    team_package_owner_only = (
        db.query(models.Package)
        .filter(models.Package.id == models.Booking.package_id)
        .filter(models.Package.package_type == "team")
        .exists()
    )

    direct = direct.filter(
        not_(team_package_owner_only & ~owner_only_team_exists)
    )

    participant = (
        db.query(models.Booking)
        .join(
            models.BookingWorker,
            models.BookingWorker.booking_id == models.Booking.id
        )
        .filter(models.BookingWorker.worker_id == current_user.id)
    )

    query = direct.union(participant)

    if booking_status:
        query = query.filter(
            models.Booking.status == booking_status
        )

    bookings = (
        query
        .order_by(models.Booking.created_at.desc())
        .all()
    )

    return [
        _build_booking_response(
            booking,
            db,
        )
        for booking in bookings
    ]


# Keep this route above /bookings/{booking_id}.
@router.get(
    "/bookings/sent",
    response_model=list[BookingResponse],
)
def list_sent_worker_bookings(
    booking_status: Optional[str] = Query(
        None,
        alias="status",
    ),
    current_user: models.User = Depends(
        get_current_worker
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

    if booking_status:
        query = query.filter(
            models.Booking.status ==
            booking_status
        )

    bookings = (
        query
        .order_by(
            models.Booking.created_at.desc()
        )
        .all()
    )

    return [
        _build_booking_response(
            booking,
            db,
        )
        for booking in bookings
    ]


@router.get(
    "/bookings/{booking_id}",
    response_model=BookingDetailResponse,
)
def get_worker_booking(
    booking_id: int,
    current_user: models.User = Depends(
        get_current_worker
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

    is_participant = (
        db.query(models.BookingWorker)
        .filter(
            models.BookingWorker.booking_id == booking_id,
            models.BookingWorker.worker_id == current_user.id,
        )
        .first()
        is not None
    )

    if booking.worker_id != current_user.id and not is_participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    return _build_worker_booking_detail_response(
        booking,
        db,
    )


@router.get(
    "/bookings/sent/{booking_id}",
    response_model=BookingDetailResponse,
)
def get_sent_worker_booking(
    booking_id: int,
    current_user: models.User = Depends(
        get_current_worker
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

    return _build_worker_booking_detail_response(
        booking,
        db,
    )


VALID_STATUS_TRANSITIONS = {
    "pending": [
        "accepted",
        "rejected",
    ],
    "accepted": [
        "in_progress",
        "cancelled",
    ],
    "in_progress": [
        "completion_requested",
    ],
}

PARTICIPANT_STATUS_TRANSITIONS = {
    "pending": ["accepted"],
    "accepted": ["in_progress"],
    "in_progress": ["completion_requested"],
}


@router.put(
    "/bookings/{booking_id}/status",
    response_model=BookingResponse,
)
def update_worker_booking_status(
    booking_id: int,
    new_status: str,
    current_user: models.User = Depends(
        get_current_worker
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

    is_participant = (
        db.query(models.BookingWorker)
        .filter(
            models.BookingWorker.booking_id == booking_id,
            models.BookingWorker.worker_id == current_user.id,
        )
        .first()
        is not None
    )

    if booking.worker_id != current_user.id and not is_participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    if is_participant:
        bw = (
            db.query(models.BookingWorker)
            .filter(
                models.BookingWorker.booking_id == booking_id,
                models.BookingWorker.worker_id == current_user.id,
            )
            .first()
        )

        allowed = (
            PARTICIPANT_STATUS_TRANSITIONS.get(
                bw.status,
                [],
            )
        )

        if new_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid status transition from "
                    f"{bw.status} to {new_status}"
                ),
            )

        bw.status = new_status
        db.flush()

        if new_status == "in_progress":
            all_started = (
                db.query(models.BookingWorker)
                .filter(models.BookingWorker.booking_id == booking_id)
                .filter(
                    models.BookingWorker.status.notin_(
                        ["in_progress", "completion_requested", "completed"]
                    )
                )
                .first()
                is None
            )

            if all_started:
                booking.status = "in_progress"

        if new_status == "completion_requested":
            all_done = (
                db.query(models.BookingWorker)
                .filter(models.BookingWorker.booking_id == booking_id)
                .filter(
                    models.BookingWorker.status.notin_(
                        ["completion_requested", "completed"]
                    )
                )
                .first()
                is None
            )

            if all_done:
                booking.status = "completion_requested"
    else:
        allowed = (
            VALID_STATUS_TRANSITIONS.get(
                booking.status,
                [],
            )
        )

        if new_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid status transition from "
                    f"{booking.status} to {new_status}"
                ),
            )

        booking.status = new_status

    db.add(booking)
    if is_participant and bw is not None:
        db.add(bw)
    db.commit()
    db.refresh(booking)

    return _build_booking_response(
        booking,
        db,
    )