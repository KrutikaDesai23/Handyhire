from pydantic import BaseModel, Field
from pydantic.config import ConfigDict
from typing import Optional


class TeamCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    category: Optional[str] = None


class TeamMemberResponse(BaseModel):
    worker_id: int
    full_name: Optional[str] = None
    profession: Optional[str] = None
    role: Optional[str] = None
    joined_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TeamDetailResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    created_by: int
    creator_name: Optional[str] = None
    members: list[TeamMemberResponse] = []

    model_config = ConfigDict(from_attributes=True)


class TeamResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    created_by: int
    creator_name: Optional[str] = None
    role: Optional[str] = None
    members: list[TeamMemberResponse] = []

    model_config = ConfigDict(from_attributes=True)
