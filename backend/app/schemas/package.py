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


class PackageResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    package_type: str
    price: int
    services: List[ServiceSummary] = []

    model_config = ConfigDict(from_attributes=True)
