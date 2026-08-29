from pydantic import BaseModel, Field
from pydantic.config import ConfigDict
from typing import Optional, List


class ServiceSummary(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    category: str
    base_price: int

    model_config = ConfigDict(from_attributes=True)


class PackageWorkerSummary(BaseModel):
    worker_id: int
    full_name: Optional[str] = None
    profession: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PackageCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    package_type: str = Field(..., min_length=1, max_length=20)
    price: int = Field(..., gt=0)
    duration: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=255)
    availability: Optional[str] = Field(None, max_length=100)
    status: str = Field("draft", min_length=1, max_length=20)
    service_ids: List[int] = []
    worker_ids: List[int] = []


class PackageUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    package_type: Optional[str] = Field(None, min_length=1, max_length=20)
    price: Optional[int] = Field(None, gt=0)
    duration: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=255)
    availability: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, min_length=1, max_length=20)
    service_ids: Optional[List[int]] = None
    worker_ids: Optional[List[int]] = None


class PackageResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    package_type: str
    price: int
    duration: Optional[str] = None
    location: Optional[str] = None
    availability: Optional[str] = None
    status: str
    owner_id: int
    services: List[ServiceSummary] = []
    workers: List[PackageWorkerSummary] = []

    model_config = ConfigDict(from_attributes=True)


class PackageSummary(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    package_type: str
    price: int
    duration: Optional[str] = None
    location: Optional[str] = None
    availability: Optional[str] = None
    status: str
    services: List[ServiceSummary] = []
    workers: List[PackageWorkerSummary] = []

    model_config = ConfigDict(from_attributes=True)
