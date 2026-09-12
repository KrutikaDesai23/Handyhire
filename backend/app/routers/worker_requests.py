from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.auth.dependencies import get_current_worker
from app.database.connection import get_db
from app.schemas import BookingRequestResponse

router = APIRouter(prefix="/api/worker", tags=["worker"])


def _load_before_photos(booking_id, db):
    rows = (
        db.query(models.BookingPhoto)
        .filter(
            models.BookingPhoto.booking_id == booking_id,
            models.BookingPhoto.photo_type == "before",
        )
        .order_by(models.BookingPhoto.created_at.asc())
        .all()
    )
    return [
        {
            "id": row.id,
            "booking_id": row.booking_id,
            "photo_type": row.photo_type,
            "image_url": row.image_url,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


def _load_team_members(booking, db):
    """Return team-package participants for a single booking."""
    if not booking or not booking.package_id:
        return []

    pkg = db.query(models.Package).filter(models.Package.id == booking.package_id).first()
    if not pkg or pkg.package_type != "team":
        return []

    bw_rows = (
        db.query(models.BookingWorker)
        .filter(models.BookingWorker.booking_id == booking.id)
        .all()
    )

    members = []
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
        members.append(
            {
                "worker_id": bw.worker_id,
                "full_name": member_user.full_name if member_user else "--",
                "profession": (
                    member_user.worker_profile.profession
                    if member_user and member_user.worker_profile
                    else None
                ),
                "status": bw.status,
                "is_leader": pw.is_leader if pw else False,
            }
        )

    return members


def _build_list_context(requests, db):
    """Bulk-load request dependencies to avoid N+1 query chains."""
    booking_ids = {row.booking_id for row in requests}
    customer_ids = {row.customer_id for row in requests}

    bookings = (
        db.query(models.Booking)
        .filter(models.Booking.id.in_(booking_ids))
        .all()
        if booking_ids
        else []
    )
    booking_map = {row.id: row for row in bookings}

    service_ids = {row.service_id for row in bookings if row.service_id}
    package_ids = {row.package_id for row in bookings if row.package_id}

    customers = (
        db.query(models.User).filter(models.User.id.in_(customer_ids)).all()
        if customer_ids
        else []
    )
    customer_map = {row.id: row for row in customers}

    services = (
        db.query(models.Service).filter(models.Service.id.in_(service_ids)).all()
        if service_ids
        else []
    )
    service_map = {row.id: row for row in services}

    packages = (
        db.query(models.Package).filter(models.Package.id.in_(package_ids)).all()
        if package_ids
        else []
    )
    package_map = {row.id: row for row in packages}

    photos_by_booking = defaultdict(list)
    if booking_ids:
        photo_rows = (
            db.query(models.BookingPhoto)
            .filter(
                models.BookingPhoto.booking_id.in_(booking_ids),
                models.BookingPhoto.photo_type == "before",
            )
            .order_by(models.BookingPhoto.created_at.asc())
            .all()
        )
        for row in photo_rows:
            photos_by_booking[row.booking_id].append(
                {
                    "id": row.id,
                    "booking_id": row.booking_id,
                    "photo_type": row.photo_type,
                    "image_url": row.image_url,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                }
            )

    booking_workers = (
        db.query(models.BookingWorker)
        .filter(models.BookingWorker.booking_id.in_(booking_ids))
        .all()
        if booking_ids
        else []
    )
    worker_ids = {row.worker_id for row in booking_workers}

    worker_info = {}
    if worker_ids:
        rows = (
            db.query(
                models.User.id,
                models.User.full_name,
                models.WorkerProfile.profession,
            )
            .outerjoin(
                models.WorkerProfile,
                models.WorkerProfile.user_id == models.User.id,
            )
            .filter(models.User.id.in_(worker_ids))
            .all()
        )
        worker_info = {
            row.id: {
                "full_name": row.full_name,
                "profession": row.profession,
            }
            for row in rows
        }

    leader_map = {}
    if package_ids and worker_ids:
        package_worker_rows = (
            db.query(models.PackageWorker)
            .filter(
                models.PackageWorker.package_id.in_(package_ids),
                models.PackageWorker.worker_id.in_(worker_ids),
            )
            .all()
        )
        leader_map = {
            (row.package_id, row.worker_id): bool(row.is_leader)
            for row in package_worker_rows
        }

    team_members_by_booking = defaultdict(list)
    for bw in booking_workers:
        booking = booking_map.get(bw.booking_id)
        if not booking or not booking.package_id:
            continue
        pkg = package_map.get(booking.package_id)
        if not pkg or pkg.package_type != "team":
            continue

        info = worker_info.get(bw.worker_id, {})
        team_members_by_booking[bw.booking_id].append(
            {
                "worker_id": bw.worker_id,
                "full_name": info.get("full_name") or "--",
                "profession": info.get("profession"),
                "status": bw.status,
                "is_leader": leader_map.get((booking.package_id, bw.worker_id), False),
            }
        )

    return {
        "bookings": booking_map,
        "customers": customer_map,
        "services": service_map,
        "packages": package_map,
        "before_photos": photos_by_booking,
        "team_members": team_members_by_booking,
    }


def _build_request_response(
    request: models.BookingRequest,
    db: Session,
    context=None,
) -> BookingRequestResponse:
    if context is None:
        booking = db.query(models.Booking).filter(models.Booking.id == request.booking_id).first()
        customer = db.query(models.User).filter(models.User.id == request.customer_id).first()
        service = (
            db.query(models.Service).filter(models.Service.id == booking.service_id).first()
            if booking and booking.service_id
            else None
        )
        pkg = (
            db.query(models.Package).filter(models.Package.id == booking.package_id).first()
            if booking and booking.package_id
            else None
        )
        before_photos = _load_before_photos(request.booking_id, db) if booking else []
        team_members = _load_team_members(booking, db) if booking else []
    else:
        booking = context["bookings"].get(request.booking_id)
        customer = context["customers"].get(request.customer_id)
        service = context["services"].get(booking.service_id) if booking and booking.service_id else None
        pkg = context["packages"].get(booking.package_id) if booking and booking.package_id else None
        before_photos = context["before_photos"].get(request.booking_id, [])
        team_members = context["team_members"].get(request.booking_id, [])

    return BookingRequestResponse(
        id=request.id,
        booking_id=request.booking_id,
        customer_id=request.customer_id,
        worker_id=request.worker_id,
        message=request.message,
        status=request.status,
        created_at=request.created_at.isoformat() if request.created_at else None,
        customer_name=customer.full_name if customer else None,
        service_name=service.name if service else None,
        booking_date=booking.booking_date.isoformat() if booking and booking.booking_date else None,
        booking_time=booking.booking_time if booking else None,
        address=booking.address if booking else None,
        description=booking.description if booking else None,
        amount=booking.amount if booking else None,
        package_id=booking.package_id if booking else None,
        package_name=pkg.name if pkg else None,
        package_type=pkg.package_type if pkg else None,
        before_photos=before_photos,
        team_members=team_members,
    )


@router.get("/requests", response_model=list[BookingRequestResponse])
def list_worker_requests(
    status: Optional[str] = None,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    query = db.query(models.BookingRequest).filter(
        models.BookingRequest.worker_id == current_user.id
    )
    if status:
        query = query.filter(models.BookingRequest.status == status)

    requests = query.order_by(models.BookingRequest.created_at.desc()).all()
    if not requests:
        return []

    context = _build_list_context(requests, db)
    return [_build_request_response(row, db, context=context) for row in requests]


@router.get("/requests/{request_id}", response_model=BookingRequestResponse)
def get_worker_request(
    request_id: int,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    request = db.query(models.BookingRequest).filter(models.BookingRequest.id == request_id).first()
    if not request or request.worker_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    return _build_request_response(request, db)


@router.put("/requests/{request_id}/accept", response_model=BookingRequestResponse)
def accept_worker_request(
    request_id: int,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    request = db.query(models.BookingRequest).filter(models.BookingRequest.id == request_id).first()
    if not request or request.worker_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    if request.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not pending")

    booking = db.query(models.Booking).filter(models.Booking.id == request.booking_id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    request.status = "accepted"

    booking_workers = (
        db.query(models.BookingWorker)
        .filter(models.BookingWorker.booking_id == booking.id)
        .all()
    )

    if booking_workers:
        for bw in booking_workers:
            if bw.worker_id == current_user.id:
                bw.status = "accepted"
                break

        all_accepted = (
            db.query(models.BookingWorker)
            .filter(models.BookingWorker.booking_id == booking.id)
            .filter(models.BookingWorker.status != "accepted")
            .first()
            is None
        )
        if all_accepted:
            booking.status = "accepted"
    else:
        booking.status = "accepted"

    db.add(request)
    db.add(booking)
    db.commit()
    db.refresh(request)
    db.refresh(booking)

    return _build_request_response(request, db)


@router.put("/requests/{request_id}/reject", response_model=BookingRequestResponse)
def reject_worker_request(
    request_id: int,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    request = db.query(models.BookingRequest).filter(models.BookingRequest.id == request_id).first()
    if not request or request.worker_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    if request.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not pending")

    booking = db.query(models.Booking).filter(models.Booking.id == request.booking_id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking.status in ("completed", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking cannot be rejected in current status",
        )

    request.status = "rejected"

    booking_workers = (
        db.query(models.BookingWorker)
        .filter(models.BookingWorker.booking_id == booking.id)
        .all()
    )

    if booking_workers:
        for bw in booking_workers:
            if bw.worker_id == current_user.id:
                bw.status = "rejected"
                break

    booking.status = "rejected"

    db.add(request)
    db.add(booking)
    db.commit()
    db.refresh(request)
    db.refresh(booking)

    return _build_request_response(request, db)
