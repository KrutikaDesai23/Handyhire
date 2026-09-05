from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Optional

from app import models
from app.auth.dependencies import get_current_worker
from app.database.connection import get_db
from app.schemas import (
    PackageCreate,
    PackageResponse,
    PackageUpdate,
    PackageWorkerSummary,
    ServiceSummary,
)

router = APIRouter(prefix="/api/worker", tags=["worker-packages"])


# =========================================================
# Helpers
# =========================================================

def _load_owned_package(
    package_id: int,
    owner_id: int,
    db: Session,
) -> models.Package:
    package = (
        db.query(models.Package)
        .filter(models.Package.id == package_id)
        .first()
    )

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found",
        )

    if package.owner_id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized",
        )

    return package


def _validate_package_type(package_type: str):
    if package_type not in ("multitasking", "team"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="package_type must be 'multitasking' or 'team'",
        )


def _validate_status(package_status: str):
    if package_status not in ("draft", "published", "archived"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="status must be 'draft', 'published', or 'archived'",
        )


def _validate_team_workers(
    worker_ids: list[int],
    current_user_id: int,
    db: Session,
) -> list[int]:

    # Remove duplicates while preserving order
    unique_ids = list(dict.fromkeys(worker_ids or []))

    if len(unique_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A team package must include at least 2 different workers",
        )

    # Provider cannot select themselves
    if current_user_id in unique_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot add yourself as a team member",
        )

    workers = (
        db.query(models.User)
        .filter(
            models.User.id.in_(unique_ids),
            models.User.role == "worker",
        )
        .all()
    )

    found_ids = {worker.id for worker in workers}

    missing_ids = [
        worker_id
        for worker_id in unique_ids
        if worker_id not in found_ids
    ]

    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Worker {missing_ids[0]} not found "
                "or is not a registered worker"
            ),
        )

    return unique_ids


def _replace_package_workers(
    package_id: int,
    worker_ids: list[int],
    db: Session,
):
    existing = (
        db.query(models.PackageWorker)
        .filter(models.PackageWorker.package_id == package_id)
        .all()
    )

    for package_worker in existing:
        db.delete(package_worker)

    for worker_id in worker_ids:
        db.add(
            models.PackageWorker(
                package_id=package_id,
                worker_id=worker_id,
            )
        )


def _remove_package_workers(
    package_id: int,
    db: Session,
):
    existing = (
        db.query(models.PackageWorker)
        .filter(models.PackageWorker.package_id == package_id)
        .all()
    )

    for package_worker in existing:
        db.delete(package_worker)


def _validate_service_ids(
    service_ids: list[int],
    db: Session,
) -> list[int]:

    unique_ids = list(dict.fromkeys(service_ids or []))

    for service_id in unique_ids:
        service = (
            db.query(models.Service)
            .filter(models.Service.id == service_id)
            .first()
        )

        if not service:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Service {service_id} not found",
            )

    return unique_ids


def _replace_package_services(
    package_id: int,
    service_ids: list[int],
    db: Session,
):
    existing = (
        db.query(models.PackageService)
        .filter(models.PackageService.package_id == package_id)
        .all()
    )

    for package_service in existing:
        db.delete(package_service)

    for service_id in service_ids:
        db.add(
            models.PackageService(
                package_id=package_id,
                service_id=service_id,
            )
        )


def _build_package_response(
    package: models.Package,
    db: Session,
) -> PackageResponse:

    services = (
        db.query(models.Service)
        .join(
            models.PackageService,
            models.PackageService.service_id == models.Service.id,
        )
        .filter(models.PackageService.package_id == package.id)
        .all()
    )

    workers = (
        db.query(models.User)
        .join(
            models.PackageWorker,
            models.PackageWorker.worker_id == models.User.id,
        )
        .filter(models.PackageWorker.package_id == package.id)
        .all()
    )

    return PackageResponse(
        id=package.id,
        name=package.name,
        description=package.description,
        package_type=package.package_type,
        price=package.price,
        duration=package.duration,
        location=package.location,
        availability=package.availability,
        status=package.status,
        owner_id=package.owner_id,

        services=[
            ServiceSummary(
                id=service.id,
                name=service.name,
                description=service.description,
                category=service.category,
                base_price=service.base_price,
            )
            for service in services
        ],

        workers=[
            PackageWorkerSummary(
                worker_id=worker.id,
                full_name=worker.full_name,
                profession=(
                    worker.worker_profile.profession
                    if worker.worker_profile
                    else None
                ),
            )
            for worker in workers
        ],
    )


# =========================================================
# LIST MY PACKAGES
# =========================================================

@router.get(
    "/packages",
    response_model=list[PackageResponse],
)
def list_worker_packages(
    current_user: models.User = Depends(get_current_worker),
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    package_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(models.Package)

    if package_type == "team":
        query = query.filter(
            or_(
                models.Package.owner_id == current_user.id,
                models.Package.id.in_(
                    db.query(models.PackageWorker.package_id)
                    .filter(models.PackageWorker.worker_id == current_user.id)
                ),
            )
        )
    else:
        query = query.filter(
            models.Package.owner_id == current_user.id
        )

    if package_type:
        _validate_package_type(package_type)

        query = query.filter(
            models.Package.package_type == package_type
        )

    if search:
        query = query.filter(
            or_(
                models.Package.name.ilike(f"%{search}%"),
                models.Package.description.ilike(f"%{search}%"),
            )
        )

    if status_filter:
        query = query.filter(
            models.Package.status == status_filter
        )

    packages = (
        query
        .order_by(models.Package.updated_at.desc())
        .all()
    )

    return [
        _build_package_response(package, db)
        for package in packages
    ]


# =========================================================
# CREATE PACKAGE
# =========================================================

@router.post(
    "/packages",
    response_model=PackageResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_package(
    payload: PackageCreate,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    _validate_package_type(payload.package_type)
    _validate_status(payload.status)

    service_ids = _validate_service_ids(
        payload.service_ids,
        db,
    )

    team_worker_ids = []

    if payload.package_type == "team":
        team_worker_ids = _validate_team_workers(
            payload.worker_ids,
            current_user.id,
            db,
        )

    # -----------------------------------------------------
    # Create package FIRST
    # -----------------------------------------------------

    package = models.Package(
        name=payload.name,
        description=payload.description,
        package_type=payload.package_type,
        price=payload.price,
        duration=payload.duration,
        location=payload.location,
        availability=payload.availability,
        status=payload.status,
        owner_id=current_user.id,
    )

    db.add(package)

    # IMPORTANT:
    # This generates the real package.id.
    db.flush()

    # -----------------------------------------------------
    # Save services using the REAL package.id
    # -----------------------------------------------------

    _replace_package_services(
        package.id,
        service_ids,
        db,
    )

    # -----------------------------------------------------
    # Save Team Package workers AFTER package.id exists
    # -----------------------------------------------------

    if payload.package_type == "team":
        _replace_package_workers(
            package.id,
            team_worker_ids,
            db,
        )

    db.commit()
    db.refresh(package)

    return _build_package_response(
        package,
        db,
    )


# =========================================================
# GET ONE PACKAGE
# =========================================================

@router.get(
    "/packages/{package_id}",
    response_model=PackageResponse,
)
def get_worker_package(
    package_id: int,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    package = _load_owned_package(
        package_id,
        current_user.id,
        db,
    )

    return _build_package_response(
        package,
        db,
    )


# =========================================================
# UPDATE PACKAGE
# =========================================================

@router.put(
    "/packages/{package_id}",
    response_model=PackageResponse,
)
def update_package(
    package_id: int,
    payload: PackageUpdate,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    package = _load_owned_package(
        package_id,
        current_user.id,
        db,
    )

    target_type = (
        payload.package_type
        if payload.package_type is not None
        else package.package_type
    )

    _validate_package_type(target_type)

    if payload.status is not None:
        _validate_status(payload.status)

    # -----------------------------------------------------
    # Validate services before changing DB
    # -----------------------------------------------------

    validated_service_ids = None

    if payload.service_ids is not None:
        validated_service_ids = _validate_service_ids(
            payload.service_ids,
            db,
        )

    elif target_type == "team":
        existing_service_count = (
            db.query(models.PackageService)
            .filter(
                models.PackageService.package_id == package.id
            )
            .count()
        )

        if existing_service_count == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A team package must include at least one service",
            )

    # -----------------------------------------------------
    # Validate workers
    # -----------------------------------------------------

    validated_worker_ids = None

    if target_type == "team":

        if payload.worker_ids is not None:
            validated_worker_ids = _validate_team_workers(
                payload.worker_ids,
                current_user.id,
                db,
            )

        else:
            existing_worker_ids = [
                row.worker_id
                for row in (
                    db.query(models.PackageWorker)
                    .filter(
                        models.PackageWorker.package_id
                        == package.id
                    )
                    .all()
                )
            ]

            if len(set(existing_worker_ids)) < 2:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "A team package must include "
                        "at least 2 different workers"
                    ),
                )

    # -----------------------------------------------------
    # Update normal fields
    # -----------------------------------------------------

    if payload.name is not None:
        package.name = payload.name

    if payload.description is not None:
        package.description = payload.description

    package.package_type = target_type

    if payload.price is not None:
        package.price = payload.price

    if payload.duration is not None:
        package.duration = payload.duration

    if payload.location is not None:
        package.location = payload.location

    if payload.availability is not None:
        package.availability = payload.availability

    if payload.status is not None:
        package.status = payload.status

    # -----------------------------------------------------
    # Update services
    # -----------------------------------------------------

    if validated_service_ids is not None:
        _replace_package_services(
            package.id,
            validated_service_ids,
            db,
        )

    # -----------------------------------------------------
    # Update Team Package workers
    # -----------------------------------------------------

    if target_type == "team":

        if validated_worker_ids is not None:
            _replace_package_workers(
                package.id,
                validated_worker_ids,
                db,
            )

    else:
        # Multitasking packages must not retain team workers
        _remove_package_workers(
            package.id,
            db,
        )

    db.commit()
    db.refresh(package)

    return _build_package_response(
        package,
        db,
    )


# =========================================================
# PUBLISH
# =========================================================

@router.patch(
    "/packages/{package_id}/publish",
    response_model=PackageResponse,
)
def publish_package(
    package_id: int,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    package = _load_owned_package(
        package_id,
        current_user.id,
        db,
    )

    package.status = "published"

    db.commit()
    db.refresh(package)

    return _build_package_response(
        package,
        db,
    )


# =========================================================
# UNPUBLISH
# =========================================================

@router.patch(
    "/packages/{package_id}/unpublish",
    response_model=PackageResponse,
)
def unpublish_package(
    package_id: int,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    package = _load_owned_package(
        package_id,
        current_user.id,
        db,
    )

    package.status = "draft"

    db.commit()
    db.refresh(package)

    return _build_package_response(
        package,
        db,
    )


# =========================================================
# ARCHIVE
# =========================================================

@router.delete(
    "/packages/{package_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def archive_package(
    package_id: int,
    current_user: models.User = Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    package = _load_owned_package(
        package_id,
        current_user.id,
        db,
    )

    package.status = "archived"

    db.commit()

    return None