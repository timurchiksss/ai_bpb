"""
Admin API request/response schemas
"""

from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import List, Optional


class LLMRequestResponse(BaseModel):
    """LLM request response schema"""
    id: UUID
    user_id: UUID | None
    user_email: str
    provider: str
    model: str
    input_tokens: int
    cached_input_tokens: int
    output_tokens: int
    usd_cost: float
    created_at: datetime

    class Config:
        from_attributes = True


class LLMRequestListResponse(BaseModel):
    """List of LLM requests response schema with pagination"""
    requests: List[LLMRequestResponse]
    total: int
    limit: int
    offset: int


class BusinessPlanAdminResponse(BaseModel):
    """Business plan response schema for admin with user and company info"""
    id: UUID
    company_id: UUID
    title: str
    user_content: str
    llm_content: str
    priority_activities: List[str]
    created_at: datetime
    updated_at: datetime
    user_email: str
    company_name: str

    class Config:
        from_attributes = True


class BusinessPlanAdminListResponse(BaseModel):
    """List of business plans response schema for admin with pagination"""
    business_plans: List[BusinessPlanAdminResponse]
    total: int
    limit: int
    offset: int

