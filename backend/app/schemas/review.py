from pydantic import BaseModel, Field
from pydantic.config import ConfigDict
from typing import Optional


class ReviewCreate(BaseModel):
    booking_id: int = Field(..., gt=0)
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class ReviewResponse(BaseModel):
    id: int
    booking_id: int
    customer_id: int
    worker_id: int
    rating: int
    comment: Optional[str] = None
    created_at: Optional[str] = None
    customer_name: Optional[str] = None
    worker_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
