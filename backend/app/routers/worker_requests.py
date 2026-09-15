from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

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
    """Return the team members for a team package booking."""
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
        members.append({
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

    return members


def _get_team_package(booking, db):
    if not booking or not booking.package_id:
        return None
    package = db.query(models.Package).filter(models.Package.id == booking.package_id).first()
    if not package or package.package_type != "team":
        return None
    return package


def _get_team_leader_id(booking, db):
    package = _get_team_package(booking, db)
    if not package:
        return None

    leader = (
        db.query(models.PackageWorker)
        .filter(
            models.PackageWorker.package_id == package.id,
            models.PackageWorker.is_leader.is_(True),
        )
        .first()
    )
    return leader.worker_id if leader else None


def _assert_request_visible_to_worker(request, current_user, db):
    booking = db.query(models.Booking).filter(models.Booking.id == request.booking_id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    leader_id = _get_team_leader_id(booking, db)
    if leader_id is not None and current_user.id != leader_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    return booking


def _build_request_response(request: models.BookingRequest, db: Session) -> BookingRequestResponse:
    booking = db.query(models.Booking).filter(models.Booking.id == request.booking_id).first()
    customer = db.query(models.User).filter(models.User.id == request.customer_id).first()
    service = db.query(models.Service).filter(models.Service.id == booking.service_id).first() if booking and booking.service_id else None

    package_name = None
    package_type = None

    if booking and booking.package_id:
        pkg = db.query(models.Package).filter(models.Package.id == booking.package_id).first()
        package_name = pkg.name if pkg else None
        package_type = pkg.package_type if pkg else None

    before_photos = _load_before_photos(request.booking_id, db) if booking else []
    team_members = _load_team_members(booking, db) if booking else []

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
        package_name=package_name,
        package_type=package_type,
        before_photos=before_photos,
        team_members=team_members,
    )


@router.get("/requests", response_model=list[BookingRequestResponse])
def list_worker_requests(
    status: Optional[str] = None,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    query = db.query(models.BookingRequest).filter(models.BookingRequest.worker_id == current_user.id)
    if status:
        query = query.filter(models.BookingRequest.status == status)

    requests = query.order_by(models.BookingRequest.created_at.desc()).all()
    visible_requests = []
    for request in requests:
        booking = db.query(models.Booking).filter(models.Booking.id == request.booking_id).first()
        if not booking:
            continue
        leader_id = _get_team_leader_id(booking, db)
        if leader_id is not None and current_user.id != leader_id:
            continue
        visible_requests.append(request)

    return [_build_request_response(r, db) for r in visible_requests]


@router.get("/requests/{request_id}", response_model=BookingRequestResponse)
def get_worker_request(
    request_id: int,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    request = db.query(models.BookingRequest).filter(models.BookingRequest.id == request_id).first()
    if not request or request.worker_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    _assert_request_visible_to_worker(request, current_user, db)
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

    booking = _assert_request_visible_to_worker(request, current_user, db)
    leader_id = _get_team_leader_id(booking, db)

    if leader_id is not None:
        db.query(models.BookingWorker).filter(
            models.BookingWorker.booking_id == booking.id
        ).update({"status": "accepted"}, synchronize_session=False)

        db.query(models.BookingRequest).filter(
            models.BookingRequest.booking_id == booking.id
        ).update({"status": "accepted"}, synchronize_session=False)

        booking.status = "accepted"
        request.status = "accepted"
    else:
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

    booking = _assert_request_visible_to_worker(request, current_user, db)

    if booking.status in ("completed", "cancelled"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking cannot be rejected in current status")

    leader_id = _get_team_leader_id(booking, db)
    if leader_id is not None:
        db.query(models.BookingWorker).filter(
            models.BookingWorker.booking_id == booking.id
        ).update({"status": "rejected"}, synchronize_session=False)

        db.query(models.BookingRequest).filter(
            models.BookingRequest.booking_id == booking.id
        ).update({"status": "rejected"}, synchronize_session=False)
    else:
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

    request.status = "rejected"
    booking.status = "rejected"

    db.add(request)
    db.add(booking)
    db.commit()
    db.refresh(request)
    db.refresh(booking)

    return _build_request_response(request, db)
