"""
Business Plan request/response schemas
"""

from pydantic import BaseModel, field_validator
from datetime import datetime
from uuid import UUID
from typing import Optional, List
from config import MAX_PARTICIPATION_PERIOD_YEARS


class BusinessPlanCreate(BaseModel):
    """Create business plan request schema"""
    title: str
    company_id: UUID
    priority_activities: List[str]
    participation_period_years: int  # Срок участия в технопарке в годах
    planned_submission_year: int  # Год планируемой подачи бизнес-плана

    @field_validator('priority_activities')
    @classmethod
    def validate_priority_activities(cls, v: List[str]) -> List[str]:
        if not v or len(v) == 0:
            raise ValueError('At least one priority activity is required')
        if len(v) != len(set(v)):
            raise ValueError('Priority activities must be unique')
        return v

    @field_validator('participation_period_years')
    @classmethod
    def validate_participation_period_years(cls, v: int) -> int:
        if v <= 0:
            raise ValueError('Participation period must be greater than 0')
        if v > MAX_PARTICIPATION_PERIOD_YEARS:
            raise ValueError(f'Participation period cannot exceed {MAX_PARTICIPATION_PERIOD_YEARS} years')
        return v

    @field_validator('planned_submission_year')
    @classmethod
    def validate_planned_submission_year(cls, v: int) -> int:
        current_year = datetime.now().year
        if v < current_year:
            raise ValueError('Planned submission year cannot be in the past')
        if v > current_year + 10:  # Reasonable upper limit
            raise ValueError('Planned submission year cannot be more than 10 years in the future')
        return v


class BusinessPlanUpdate(BaseModel):
    """Update business plan request schema"""
    title: Optional[str] = None
    priority_activities: Optional[List[str]] = None
    participation_period_years: Optional[int] = None
    planned_submission_year: Optional[int] = None
    user_content: Optional[str] = None  # Only user_content can be updated via API

    @field_validator('priority_activities')
    @classmethod
    def validate_priority_activities(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is not None:
            if not v or len(v) == 0:
                raise ValueError('At least one priority activity is required')
            if len(v) != len(set(v)):
                raise ValueError('Priority activities must be unique')
        return v

    @field_validator('participation_period_years')
    @classmethod
    def validate_participation_period_years(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return v
        if v <= 0:
            raise ValueError('Participation period must be greater than 0')
        if v > MAX_PARTICIPATION_PERIOD_YEARS:
            raise ValueError(f'Participation period cannot exceed {MAX_PARTICIPATION_PERIOD_YEARS} years')
        return v

    @field_validator('planned_submission_year')
    @classmethod
    def validate_planned_submission_year(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return v
        current_year = datetime.now().year
        if v < current_year:
            raise ValueError('Planned submission year cannot be in the past')
        if v > current_year + 10:  # Reasonable upper limit
            raise ValueError('Planned submission year cannot be more than 10 years in the future')
        return v


class BusinessPlanResponse(BaseModel):
    """Business plan response schema"""
    id: UUID
    company_id: UUID
    title: str
    user_content: str  # Source of truth - user's accepted version
    llm_content: str  # LLM's version for current run
    priority_activities: List[str]
    participation_period_years: int
    planned_submission_year: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BusinessPlanListResponse(BaseModel):
    """List of business plans response schema"""
    business_plans: List[BusinessPlanResponse]

