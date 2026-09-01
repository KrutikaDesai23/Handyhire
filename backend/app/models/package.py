from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.connection import Base


class Package(Base):
    __tablename__ = "packages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    package_type = Column(String(20), nullable=False)
    price = Column(Integer, nullable=False)
    duration = Column(String(100), nullable=True)
    location = Column(String(255), nullable=True)
    availability = Column(String(100), nullable=True)
    status = Column(String(20), nullable=False, default="published")
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    package_services = relationship("PackageService", back_populates="package", cascade="all, delete-orphan")
    package_workers = relationship("PackageWorker", back_populates="package", cascade="all, delete-orphan")
    owner = relationship("User")
