from pydantic import BaseModel, Field
from pydantic.config import ConfigDict
from typing import Optional, List
from datetime import date


class BookingCreate(BaseModel):
    worker_id: int = Field(..., gt=0)
    service_id: Optional[int] = Field(None, gt=0)
    booking_date: date
    booking_time: str = Field(..., min_length=1, max_length=10)
    address: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    amount: int = Field(..., gt=0)


class BookingResponse(BaseModel):
    id: int
    customer_id: int
    worker_id: int
    service_id: Optional[int] = None
    booking_date: date
    booking_time: str
    address: str
    description: Optional[str] = None
    amount: int
    status: str
    created_at: Optional[str] = None
    worker_name: Optional[str] = None
    service_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
