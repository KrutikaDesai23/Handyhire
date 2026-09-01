from sqlalchemy import Column, Integer, String, ForeignKey, PrimaryKeyConstraint
from sqlalchemy.orm import relationship

from app.database.connection import Base


class BookingWorker(Base):
    __tablename__ = "booking_workers"

    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    worker_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    role = Column(String(100), nullable=True)

    booking = relationship("Booking", back_populates="booking_workers")
    worker = relationship("User")

    __table_args__ = (
        PrimaryKeyConstraint(booking_id, worker_id),
    )
