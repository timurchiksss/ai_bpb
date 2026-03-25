"""
Company request/response schemas
"""

from pydantic import BaseModel, field_validator
from datetime import datetime
from uuid import UUID
from typing import List, Optional
from schemas.enums import CompanyType


class CompanyCreate(BaseModel):
    """Create company request schema"""
    name: str
    type: CompanyType
    bin: str  # 12 digits
    oked_codes: List[str]

    @field_validator('bin')
    @classmethod
    def validate_bin(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 12:
            raise ValueError('БИН must be exactly 12 digits')
        return v

    @field_validator('oked_codes')
    @classmethod
    def validate_oked_codes(cls, v: List[str]) -> List[str]:
        if not v or len(v) == 0:
            raise ValueError('At least one OKED code is required')
        if len(v) != len(set(v)):
            raise ValueError('OKED codes must be unique')
        return v


class CompanyUpdate(BaseModel):
    """Update company request schema"""
    name: Optional[str] = None
    type: Optional[CompanyType] = None
    bin: Optional[str] = None
    oked_codes: Optional[List[str]] = None

    @field_validator('bin')
    @classmethod
    def validate_bin(cls, v: str | None) -> str | None:
        if v is not None:
            if not v.isdigit() or len(v) != 12:
                raise ValueError('БИН must be exactly 12 digits')
        return v

    @field_validator('oked_codes')
    @classmethod
    def validate_oked_codes(cls, v: List[str] | None) -> List[str] | None:
        if v is not None:
            if len(v) == 0:
                raise ValueError('At least one OKED code is required')
            if len(v) != len(set(v)):
                raise ValueError('OKED codes must be unique')
        return v


class CompanyResponse(BaseModel):
    """Company response schema"""
    id: UUID
    user_id: UUID
    name: str
    type: CompanyType
    bin: str
    oked_codes: List[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

