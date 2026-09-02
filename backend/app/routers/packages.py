from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional

from app.database.connection import get_db
from app.models import Package, PackageService, PackageWorker, Service
from app.schemas import PackageSummary, PackageWorkerSummary, ServiceSummary

router = APIRouter(prefix="/api/packages", tags=["packages"])


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
    response = []
    for package in packages:
        services = (
            db.query(Service)
            .join(PackageService, PackageService.service_id == Service.id)
            .filter(PackageService.package_id == package.id)
            .all()
        )
        response.append(
            PackageSummary(
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
            )
        )
    return response


@router.get("/{package_id}", response_model=PackageSummary)
def get_package(package_id: int, db: Session = Depends(get_db)):
    package = db.query(Package).filter(Package.id == package_id).first()
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")

    if package.status != "published":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")

    services = (
        db.query(Service)
        .join(PackageService, PackageService.service_id == Service.id)
        .filter(PackageService.package_id == package.id)
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
