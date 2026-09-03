from pydantic import BaseModel, Field, model_validator
from pydantic.config import ConfigDict
from typing import Optional, List
from datetime import date


class BookingCreate(BaseModel):
    worker_id: Optional[int] = Field(None, gt=0)
    team_id: Optional[int] = Field(None, gt=0)
    service_id: Optional[int] = Field(None, gt=0)
    package_id: Optional[int] = Field(None, gt=0)

    booking_date: date
    booking_time: str = Field(
        ...,
        min_length=1,
        max_length=10
    )

    address: str = Field(
        ...,
        min_length=1,
        max_length=500
    )

    description: Optional[str] = None
    amount: int = Field(..., gt=0)
    hours: Optional[int] = Field(None, ge=1)

    @model_validator(mode="after")
    def validate_worker_or_team(self):
        if not self.worker_id and not self.team_id and not self.package_id:
            raise ValueError(
                "Either worker_id, team_id, or package_id must be provided"
            )
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