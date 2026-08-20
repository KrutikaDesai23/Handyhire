from pydantic import BaseModel, EmailStr, Field
from pydantic.config import ConfigDict
from typing import Optional


class WorkerResponse(BaseModel):
    id: int
    full_name: str
    profession: str
    bio: Optional[str] = None
    experience: Optional[str] = None
    qualification: Optional[str] = None
    location: str
    price: int
    availability: Optional[str] = None
    profile_image: Optional[str] = None
    average_rating: Optional[float] = None
    review_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class WorkerProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    mobile_number: Optional[str] = Field(None, min_length=10, max_length=20)
    address: Optional[str] = None
    city: Optional[str] = None
    profession: Optional[str] = Field(None, min_length=2, max_length=100)
    bio: Optional[str] = None
    experience: Optional[str] = None
    qualification: Optional[str] = None
    location: Optional[str] = Field(None, min_length=2, max_length=255)
    price: Optional[int] = Field(None, gt=0)
    availability: Optional[str] = None
    profile_image: Optional[str] = None


class WorkerProfileResponse(BaseModel):
    id: int
    full_name: str
    email: str
    mobile_number: str
    role: str
    address: Optional[str] = None
    city: Optional[str] = None
    profession: str
    bio: Optional[str] = None
    experience: Optional[str] = None
    qualification: Optional[str] = None
    location: str
    price: int
    availability: Optional[str] = None
    profile_image: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BookingRequestResponse(BaseModel):
    id: int
    booking_id: int
    customer_id: int
    worker_id: int
    message: Optional[str] = None
    status: str
    created_at: Optional[str] = None
    customer_name: Optional[str] = None
    service_name: Optional[str] = None
    booking_date: Optional[str] = None
    booking_time: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class DashboardResponse(BaseModel):
    worker_name: str
    profession: str
    total_requests: int
    pending_requests: int
    accepted_bookings: int
    completed_bookings: int
    average_rating: Optional[float] = None
    review_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class TeamResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_by: int
    role: Optional[str] = None
    members: list[dict] = []

    model_config = ConfigDict(from_attributes=True)
