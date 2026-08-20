from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.connection import Base


class WorkerProfile(Base):
    __tablename__ = "worker_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    profession = Column(String(100), nullable=False)
    bio = Column(Text, nullable=True)
    experience = Column(String(50), nullable=True)
    qualification = Column(String(255), nullable=True)
    location = Column(String(255), nullable=False)
    price = Column(Integer, nullable=False)
    availability = Column(String(100), nullable=True)
    profile_image = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="worker_profile")
