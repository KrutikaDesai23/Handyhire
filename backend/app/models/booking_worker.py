from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, PrimaryKeyConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.connection import Base


class BookingWorker(Base):
    __tablename__ = "booking_workers"

    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    worker_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        PrimaryKeyConstraint(booking_id, worker_id),
    )

    booking = relationship("Booking", back_populates="booking_workers")
    worker = relationship("User")
