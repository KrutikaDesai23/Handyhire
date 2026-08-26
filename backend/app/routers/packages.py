from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional

from app.database.connection import get_db
from app.models import Package, PackageService, Service
from app.schemas import PackageResponse, ServiceSummary

router = APIRouter(prefix="/api/packages", tags=["packages"])


@router.get("", response_model=list[PackageResponse])
def list_packages(
    package_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Package)
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
            PackageResponse(
                id=package.id,
                name=package.name,
                description=package.description,
                package_type=package.package_type,
                price=package.price,
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


@router.get("/{package_id}", response_model=PackageResponse)
def get_package(package_id: int, db: Session = Depends(get_db)):
    package = db.query(Package).filter(Package.id == package_id).first()
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")

    services = (
        db.query(Service)
        .join(PackageService, PackageService.service_id == Service.id)
        .filter(PackageService.package_id == package.id)
        .all()
    )
    return PackageResponse(
        id=package.id,
        name=package.name,
        description=package.description,
        package_type=package.package_type,
        price=package.price,
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
