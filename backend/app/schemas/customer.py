from pydantic import BaseModel, EmailStr, Field
from pydantic.config import ConfigDict
from typing import Optional


class CustomerProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    mobile_number: Optional[str] = Field(None, min_length=10, max_length=20)
    address: Optional[str] = None
    city: Optional[str] = None


class CustomerProfileResponse(BaseModel):
    id: int
    full_name: str
    email: str
    mobile_number: str
    role: str
    address: Optional[str] = None
    city: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
