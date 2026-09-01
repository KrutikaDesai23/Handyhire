from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional

from app.database.connection import get_db
from app.models import Package, PackageService, Service, PackageWorker, User
from app.schemas import PackageSummary, ServiceSummary, PackageWorkerSummary

router = APIRouter(prefix="/api/packages", tags=["packages"])


def _build_package_summary(package: Package, db: Session) -> PackageSummary:
    services = (
        db.query(Service)
        .join(PackageService, PackageService.service_id == Service.id)
        .filter(PackageService.package_id == package.id)
        .all()
    )

    workers = (
        db.query(User)
        .join(PackageWorker, PackageWorker.worker_id == User.id)
        .filter(PackageWorker.package_id == package.id)
        .all()
    )

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
        services=[
            ServiceSummary(
                id=s.id,
                name=s.name,
                description=s.description,
                category=s.category,
                base_price=s.base_price,
            )
            for s in services
        ],
        workers=[
            PackageWorkerSummary(
                worker_id=w.id,
                full_name=w.full_name,
                profession=(
                    w.worker_profile.profession
                    if w.worker_profile
                    else None
                ),
            )
            for w in workers
        ],
    )


@router.get("", response_model=list[PackageSummary])
def list_packages(
    package_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Package).filter(Package.status == "published")
    if package_type:
        query = query.filter(Package.package_type == package_type)

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

    packages = query.all()
    return [
        _build_package_summary(package, db)
        for package in packages
    ]


@router.get("/{package_id}", response_model=PackageSummary)
def get_package(package_id: int, db: Session = Depends(get_db)):
    package = db.query(Package).filter(Package.id == package_id).first()
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")

    if package.status != "published":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")

    return _build_package_summary(package, db)
