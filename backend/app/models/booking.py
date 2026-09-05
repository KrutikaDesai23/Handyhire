from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.connection import Base


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    worker_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=True)
    booking_date = Column(Date, nullable=False)
    booking_time = Column(String(10), nullable=False)
    address = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    amount = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    customer = relationship("User", back_populates="customer_bookings", foreign_keys="Booking.customer_id")
    worker = relationship("User", back_populates="worker_bookings", foreign_keys="Booking.worker_id")
    service = relationship("Service", back_populates="bookings")
    team = relationship("Team", backref="bookings")
    requests = relationship("BookingRequest", back_populates="booking", cascade="all, delete-orphan")
    booking_workers = relationship("BookingWorker", back_populates="booking", cascade="all, delete-orphan")
    review = relationship("Review", backref="booking", uselist=False)
