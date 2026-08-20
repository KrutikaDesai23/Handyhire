from sqlalchemy import Column, Integer, ForeignKey, PrimaryKeyConstraint
from sqlalchemy.orm import relationship

from app.database.connection import Base


class PackageService(Base):
    __tablename__ = "package_services"

    package_id = Column(Integer, ForeignKey("packages.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)

    package = relationship("Package", back_populates="package_services")
    service = relationship("Service", back_populates="package_services")

    __table_args__ = (
        PrimaryKeyConstraint(package_id, service_id),
    )
