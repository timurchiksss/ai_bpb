import jose
from fastapi import Depends, HTTPException, status, Cookie, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from uuid import UUID
import redis.asyncio as redis
from arq import ArqRedis
from arq.jobs import Job, JobStatus

from core.database import get_db
from schemas.sqlalchemy import User, BusinessPlan, Company
from core.auth import decode_access_token


async def get_current_user(
    access_token: Optional[str] = Cookie(None), db: AsyncSession = Depends(get_db)
) -> User:
    """Get current user from JWT token in cookie"""
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        payload = decode_access_token(access_token)
    except jose.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    try:
        user_id = UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    return user


async def get_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current user and verify they are an admin"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def get_current_business_plan(
    business_plan_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BusinessPlan:
    """
    Get current business plan and verify it belongs to the current user.
    
    This dependency can be used in route handlers to automatically verify
    business plan access. The business_plan_id should be a path parameter.
    
    Args:
        business_plan_id: UUID of the business plan from path parameter
        current_user: The authenticated user (from get_current_user dependency)
        db: Database session
        
    Returns:
        The BusinessPlan object if found and accessible
        
    Raises:
        HTTPException: If business plan not found or doesn't belong to user
    """
    stmt = (
        select(BusinessPlan)
        .join(Company, BusinessPlan.company_id == Company.id)
        .where(
            BusinessPlan.id == business_plan_id,
            Company.user_id == current_user.id
        )
    )
    result = await db.execute(stmt)
    business_plan = result.scalar_one_or_none()
    
    if not business_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business plan not found"
        )
    
    return business_plan


def get_arq_client(request: Request) -> ArqRedis:
    """Get ARQ Redis client from app state"""
    return request.app.state.arq_client


def get_redis_client(request: Request) -> redis.Redis:
    """Get Redis client from app state"""
    return request.app.state.redis_client


async def ensure_no_active_task_for_business_plan(
    business_plan: BusinessPlan = Depends(get_current_business_plan),
    arq_client: ArqRedis = Depends(get_arq_client),
) -> None:
    """
    Ensure no active task is running for a business plan.
    
    This dependency raises an HTTPException if there's an active task
    (queued or in_progress) for the given business plan.
    
    Uses nested dependencies to get the business plan and ARQ client.
    Use this when business_plan_id is available as a path parameter,
    or when you have a BusinessPlan object already loaded.
    
    Args:
        business_plan: Business plan from get_current_business_plan dependency or already loaded
        arq_client: ARQ Redis client from get_arq_client dependency
        
    Raises:
        HTTPException: If an active task exists for this business plan
    """
    job_id = f"draft_{business_plan.id}"
    job = Job(job_id, arq_client)
    job_status = await job.status()
    
    if job_status and job_status in [JobStatus.queued, JobStatus.in_progress]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot perform this action while a draft generation task is active. Please wait for the task to complete or cancel it first."
        )
