from sqlalchemy import Column, Integer, ForeignKey, PrimaryKeyConstraint
from sqlalchemy.orm import relationship

from app.database.connection import Base


class PackageWorker(Base):
    __tablename__ = "package_workers"

    package_id = Column(Integer, ForeignKey("packages.id"), nullable=False)
    worker_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    package = relationship("Package", back_populates="package_workers")
    worker = relationship("User")

    __table_args__ = (
        PrimaryKeyConstraint(package_id, worker_id),
    )
