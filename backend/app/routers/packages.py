from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models import Package, PackageService, PackageWorker, Service
import app.models as models
from app.schemas import PackageSummary, PackageWorkerSummary, ServiceSummary

router = APIRouter(prefix="/api/packages", tags=["packages"])


def _service_summary(service):
    return ServiceSummary(
        id=service.id,
        name=service.name,
        description=service.description,
        category=service.category,
        base_price=service.base_price,
    )


def _load_package_children(db: Session, packages):
    """Bulk-load services and team members for a package list.

    This deliberately avoids one query per package, which is noticeably slow
    with a remote PostgreSQL/Neon database.
    """
    package_ids = [package.id for package in packages]
    services_by_package = defaultdict(list)
    workers_by_package = defaultdict(list)

    if not package_ids:
        return services_by_package, workers_by_package

    service_rows = (
        db.query(PackageService.package_id, Service)
        .join(Service, PackageService.service_id == Service.id)
        .filter(PackageService.package_id.in_(package_ids))
        .all()
    )
    for package_id, service in service_rows:
        services_by_package[package_id].append(_service_summary(service))

    worker_rows = (
        db.query(
            PackageWorker.package_id,
            PackageWorker.worker_id,
            PackageWorker.is_leader,
            models.User.full_name,
            models.WorkerProfile.profession,
        )
        .join(models.User, models.User.id == PackageWorker.worker_id)
        .outerjoin(models.WorkerProfile, models.WorkerProfile.user_id == models.User.id)
        .filter(PackageWorker.package_id.in_(package_ids))
        .all()
    )
    for package_id, worker_id, is_leader, full_name, profession in worker_rows:
        workers_by_package[package_id].append(
            PackageWorkerSummary(
                worker_id=worker_id,
                full_name=full_name,
                profession=profession,
                is_leader=bool(is_leader),
            )
        )

    return services_by_package, workers_by_package


def _package_summary(package, services_by_package, workers_by_package):
    return PackageSummary(
        id=package.id,
        name=package.name,
        description=package.description,
        package_type=package.package_type,
        price=package.price,
        duration=package.duration,
        location=package.location,
        availability=package.availability,
        status=package.status,
        services=services_by_package.get(package.id, []),
        workers=workers_by_package.get(package.id, []),
    )


@router.get("", response_model=list[PackageSummary])
def list_packages(
    package_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    exclude_owner_id: Optional[int] = Query(None),
    exclude_member_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Package).filter(Package.status == "published")

    if package_type:
        query = query.filter(Package.package_type == package_type)

    if exclude_owner_id is not None:
        query = query.filter(Package.owner_id != exclude_owner_id)

    if exclude_member_id is not None:
        query = query.filter(
            Package.id.notin_(
                db.query(PackageWorker.package_id).filter(
                    PackageWorker.worker_id == exclude_member_id
                )
            )
        )

    if search:
        query = query.filter(
            or_(
                Package.name.ilike(f"%{search}%"),
                Package.description.ilike(f"%{search}%"),
            )
        )

    if category:
        query = (
            query.join(PackageService)
            .join(Service)
            .filter(Service.category.ilike(f"%{category}%"))
            .distinct()
        )

    packages = query.order_by(Package.created_at.desc()).all()
    services_by_package, workers_by_package = _load_package_children(db, packages)

    return [
        _package_summary(package, services_by_package, workers_by_package)
        for package in packages
    ]


@router.get("/{package_id}", response_model=PackageSummary)
def get_package(package_id: int, db: Session = Depends(get_db)):
    package = db.query(Package).filter(Package.id == package_id).first()
    if not package or package.status != "published":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found",
        )

    services_by_package, workers_by_package = _load_package_children(db, [package])
    return _package_summary(package, services_by_package, workers_by_package)
