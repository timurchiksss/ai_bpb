"""
Admin API routes

Handles admin-only endpoints for monitoring and management.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from datetime import datetime
from typing import Optional
from uuid import UUID

from core.database import get_db
from core.dependencies import get_admin_user
from schemas.sqlalchemy import User, LLMRequest, BusinessPlan, Company
from schemas.pydantic.admin import (
    LLMRequestResponse,
    LLMRequestListResponse,
    BusinessPlanAdminResponse,
    BusinessPlanAdminListResponse,
)

router = APIRouter(tags=["admin"])


@router.get("/llm-requests", response_model=LLMRequestListResponse)
async def list_llm_requests(
    user_email: Optional[str] = Query(None, description="Filter by user email"),
    provider: Optional[str] = Query(None, description="Filter by LLM provider"),
    model: Optional[str] = Query(None, description="Filter by model name"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date (ISO format)"),
    limit: int = Query(50, ge=1, le=100, description="Number of results per page"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all LLM requests with filtering and pagination.
    Only accessible by admin users.
    """
    # Build base query with left join to handle deleted users (user_id = NULL)
    stmt = select(LLMRequest, User.email.label("user_email")).outerjoin(User, LLMRequest.user_id == User.id)
    
    # Apply filters
    conditions = []
    
    if user_email:
        conditions.append(User.email.ilike(f"%{user_email}%"))
    
    if provider:
        conditions.append(LLMRequest.provider == provider)
    
    if model:
        conditions.append(LLMRequest.model == model)
    
    if start_date:
        conditions.append(LLMRequest.created_at >= start_date)
    
    if end_date:
        conditions.append(LLMRequest.created_at <= end_date)
    
    if conditions:
        stmt = stmt.where(and_(*conditions))
    
    # Get total count
    count_stmt = select(func.count(LLMRequest.id)).outerjoin(User, LLMRequest.user_id == User.id)
    if conditions:
        count_stmt = count_stmt.where(and_(*conditions))
    
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()
    
    # Apply ordering (newest first)
    stmt = stmt.order_by(LLMRequest.created_at.desc())
    
    # Apply pagination
    stmt = stmt.limit(limit).offset(offset)
    
    # Execute query
    result = await db.execute(stmt)
    rows = result.all()
    
    # Convert to response format
    requests = []
    for llm_request, user_email in rows:
        requests.append(LLMRequestResponse(
            id=llm_request.id,
            user_id=llm_request.user_id,
            user_email=user_email or "Deleted User",
            provider=llm_request.provider,
            model=llm_request.model,
            input_tokens=llm_request.input_tokens,
            cached_input_tokens=llm_request.cached_input_tokens,
            output_tokens=llm_request.output_tokens,
            usd_cost=llm_request.usd_cost,
            created_at=llm_request.created_at,
        ))
    
    return LLMRequestListResponse(
        requests=requests,
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/business-plans", response_model=BusinessPlanAdminListResponse)
async def list_all_business_plans(
    user_email: Optional[str] = Query(None, description="Filter by user email"),
    limit: int = Query(50, ge=1, le=100, description="Number of results per page"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all business plans from all users with pagination.
    Only accessible by admin users.
    """
    # Build base query - join through Company to get User
    stmt = (
        select(BusinessPlan, User.email.label("user_email"), Company.name.label("company_name"))
        .join(Company, BusinessPlan.company_id == Company.id)
        .join(User, Company.user_id == User.id)
    )
    
    # Apply filters
    conditions = []
    
    if user_email:
        conditions.append(User.email.ilike(f"%{user_email}%"))
    
    if conditions:
        stmt = stmt.where(and_(*conditions))
    
    # Get total count
    count_stmt = (
        select(func.count(BusinessPlan.id))
        .join(Company, BusinessPlan.company_id == Company.id)
        .join(User, Company.user_id == User.id)
    )
    if conditions:
        count_stmt = count_stmt.where(and_(*conditions))
    
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()
    
    # Apply ordering (newest first)
    stmt = stmt.order_by(BusinessPlan.updated_at.desc())
    
    # Apply pagination
    stmt = stmt.limit(limit).offset(offset)
    
    # Execute query
    result = await db.execute(stmt)
    rows = result.all()
    
    # Convert to response format
    plans = []
    for plan, user_email, company_name in rows:
        plans.append(BusinessPlanAdminResponse(
            id=plan.id,
            company_id=plan.company_id,
            title=plan.title,
            user_content=plan.user_content,
            llm_content=plan.llm_content,
            priority_activities=plan.priority_activities,
            created_at=plan.created_at,
            updated_at=plan.updated_at,
            user_email=user_email,
            company_name=company_name,
        ))
    
    return BusinessPlanAdminListResponse(
        business_plans=plans,
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/business-plans/{plan_id}", response_model=BusinessPlanAdminResponse)
async def get_business_plan_admin(
    plan_id: UUID,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get a specific business plan by ID (admin access - no user restriction).
    Only accessible by admin users.
    """
    stmt = (
        select(BusinessPlan, User.email.label("user_email"), Company.name.label("company_name"))
        .join(Company, BusinessPlan.company_id == Company.id)
        .join(User, Company.user_id == User.id)
        .where(BusinessPlan.id == plan_id)
    )
    result = await db.execute(stmt)
    row = result.first()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business plan not found"
        )
    
    plan, user_email, company_name = row
    
    return BusinessPlanAdminResponse(
        id=plan.id,
        company_id=plan.company_id,
        title=plan.title,
        user_content=plan.user_content,
        llm_content=plan.llm_content,
        priority_activities=plan.priority_activities,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
        user_email=user_email,
        company_name=company_name,
    )

