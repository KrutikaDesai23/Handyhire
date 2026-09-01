from pydantic import BaseModel, EmailStr, Field
from pydantic.config import ConfigDict
from typing import Optional


class CustomerRegister(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    mobile_number: str = Field(..., min_length=10, max_length=20)
    password: str = Field(..., min_length=6)
    address: Optional[str] = None
    city: Optional[str] = None
    profile_image: Optional[str] = None


class WorkerRegister(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    mobile_number: str = Field(..., min_length=10, max_length=20)
    password: str = Field(..., min_length=6)
    profession: str = Field(..., min_length=2, max_length=100)
    bio: Optional[str] = None
    experience: Optional[str] = None
    qualification: Optional[str] = None
    location: str = Field(..., min_length=2, max_length=255)
    price: int = Field(..., gt=0)
    availability: Optional[str] = None
    profile_image: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    role: str
    full_name: str


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    mobile_number: str
    role: str
    address: Optional[str] = None
    city: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
