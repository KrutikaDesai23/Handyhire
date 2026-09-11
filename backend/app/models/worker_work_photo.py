from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.connection import Base


class WorkerWorkPhoto(Base):
    __tablename__ = "worker_work_photos"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    image_url = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    worker = relationship("User", back_populates="work_photos")

    __table_args__ = (
        Index("ix_worker_work_photos_worker_id", "worker_id"),
    )
