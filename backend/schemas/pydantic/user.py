"""
User request/response schemas
"""

from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID
from typing import Optional


class UserRegister(BaseModel):
    """User registration request schema"""
    email: EmailStr
    password: str
    phone_number: str


class UserLogin(BaseModel):
    """User login request schema"""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """User response schema"""
    id: UUID
    email: str
    phone_number: Optional[str]
    is_admin: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
