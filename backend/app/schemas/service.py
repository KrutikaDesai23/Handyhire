from pydantic import BaseModel, Field
from pydantic.config import ConfigDict
from typing import Optional


class ServiceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    category: str
    base_price: int

    model_config = ConfigDict(from_attributes=True)
