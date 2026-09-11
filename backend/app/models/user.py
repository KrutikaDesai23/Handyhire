from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.connection import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    mobile_number = Column(String(20), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    worker_profile = relationship("WorkerProfile", back_populates="user", uselist=False)
    customer_bookings = relationship("Booking", back_populates="customer", foreign_keys="Booking.customer_id")
    worker_bookings = relationship("Booking", back_populates="worker", foreign_keys="Booking.worker_id")
    customer_booking_requests = relationship("BookingRequest", back_populates="customer", foreign_keys="BookingRequest.customer_id")
    worker_booking_requests = relationship("BookingRequest", back_populates="worker", foreign_keys="BookingRequest.worker_id")
    created_teams = relationship("Team", back_populates="creator", foreign_keys="Team.created_by")
    team_memberships = relationship("TeamMember", back_populates="worker", foreign_keys="TeamMember.worker_id")
    customer_reviews = relationship("Review", back_populates="customer", foreign_keys="Review.customer_id")
    worker_reviews = relationship("Review", back_populates="worker", foreign_keys="Review.worker_id")
    work_photos = relationship("WorkerWorkPhoto", back_populates="worker")
