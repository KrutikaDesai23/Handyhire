from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator
from pydantic.config import ConfigDict


class BookingCreate(BaseModel):
    worker_id: Optional[int] = Field(None, gt=0)
    team_id: Optional[int] = Field(None, gt=0)
    service_id: Optional[int] = Field(None, gt=0)
    package_id: Optional[int] = Field(None, gt=0)

    booking_date: date
    booking_time: str = Field(
        ...,
        min_length=5,
        max_length=5,
        pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$",
    )

    address: str = Field(
        ...,
        min_length=1,
        max_length=500,
    )

    description: Optional[str] = None
    amount: int = Field(..., gt=0)
    hours: Optional[int] = Field(None, ge=1, le=24)

    @model_validator(mode="after")
    def validate_booking_target_and_date(self):
        targets = [self.worker_id, self.team_id, self.package_id]
        if sum(target is not None for target in targets) != 1:
            raise ValueError(
                "Exactly one of worker_id, team_id, or package_id must be provided"
            )
        if self.booking_date < date.today():
            raise ValueError("booking_date cannot be in the past")
        if not self.address.strip():
            raise ValueError("address cannot be blank")
        self.address = self.address.strip()
        if self.description is not None:
            self.description = self.description.strip() or None
        return self


class BookingResponse(BaseModel):
    id: int
    customer_id: int
    worker_id: Optional[int] = None
    team_id: Optional[int] = None
    service_id: Optional[int] = None
    package_id: Optional[int] = None

    booking_date: date
    booking_time: str
    address: str
    description: Optional[str] = None

    amount: int
    status: str

    created_at: Optional[str] = None

    worker_name: Optional[str] = None
    service_name: Optional[str] = None
    customer_name: Optional[str] = None
    package_name: Optional[str] = None
    package_type: Optional[str] = None
    team_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BookingServiceSummary(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    category: str
    base_price: int

    model_config = ConfigDict(from_attributes=True)


class BookingParticipantResponse(BaseModel):
    worker_id: int
    full_name: str
    profession: Optional[str] = None
    status: str
    is_leader: bool = False

    model_config = ConfigDict(from_attributes=True)


class BookingPhotoResponse(BaseModel):
    id: int
    booking_id: int
    photo_type: str
    image_url: str
    created_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BookingDetailResponse(BookingResponse):
    # For received team-package jobs, a participant can be at a different
    # progress step than the overall booking. The UI uses viewer_status for
    # the current provider's actions while status remains the overall booking.
    viewer_status: Optional[str] = None
    worker_phone: Optional[str] = None
    customer_phone: Optional[str] = None
    worker_image: Optional[str] = None
    customer_image: Optional[str] = None
    package_services: List[BookingServiceSummary] = Field(default_factory=list)
    team_members: List[BookingParticipantResponse] = Field(default_factory=list)
    before_photos: List[BookingPhotoResponse] = Field(default_factory=list)
    after_photos: List[BookingPhotoResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
