"""
Task management API routes for ARQ
"""

from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
import json

from core.dependencies import (
    get_current_user,
    get_current_business_plan,
    get_arq_client,
    get_redis_client,
)
from schemas.sqlalchemy import User, BusinessPlan
from agents.schemas import DraftFormData
from config import LLM_PROVIDERS
from utils.llm import get_provider_and_model
from arq import ArqRedis
from arq.jobs import Job, JobStatus
import redis.asyncio as redis
from loguru import logger

router = APIRouter(tags=["tasks"])

async def get_active_job_for_business_plan(
    business_plan_id: UUID,
    arq_client: ArqRedis,
    require_active: bool = True,
) -> tuple[Job, JobStatus, str]:
    """
    Get the active job for a business plan.
    
    Args:
        business_plan_id: UUID of the business plan
        arq_client: ARQ Redis client
        require_active: If True, raise 404 if no active task exists
        
    Returns:
        Tuple of (Job, JobStatus, job_id)
        
    Raises:
        HTTPException: If require_active is True and no active task exists
    """
    job_id = f"draft_{business_plan_id}"
    job = Job(job_id, arq_client)
    job_status = await job.status()
    
    if require_active and (not job_status or job_status not in [JobStatus.queued, JobStatus.in_progress]):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active task found for this business plan"
        )
    
    return job, job_status, job_id


@router.post("/business-plans/{business_plan_id}/generate-draft")
async def enqueue_draft_generation(
    form_data: DraftFormData,
    model_type: str,
    business_plan: BusinessPlan = Depends(get_current_business_plan),
    arq_client: ArqRedis = Depends(get_arq_client),
):
    """
    Enqueue a business plan draft generation task.
    
    Returns task ID for status checking.
    """
    business_plan_id = business_plan.id
    
    # Get provider and model from model_type
    try:
        provider, model = get_provider_and_model(model_type)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    # Check for existing task and clean up if finished
    existing_job, job_status, job_id = await get_active_job_for_business_plan(
        business_plan_id, arq_client, require_active=False
    )
    
    if job_status:
        if job_status in [JobStatus.queued, JobStatus.in_progress]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A draft generation task is already active for this business plan. Task ID: {job_id}"
            )
        # If job exists but is finished, remove it from Redis to allow new job with same ID
        elif job_status in [JobStatus.complete, JobStatus.not_found]:
            # Manually delete job keys from Redis to free up the job_id
            # ARQ stores jobs with keys like: arq:job:{job_id} and arq:result:{job_id}
            logger.debug(f"Deleting finished job {job_id} (status: {job_status.value}) to allow new job with same ID")
            await arq_client.delete(f"arq:job:{job_id}")
            await arq_client.delete(f"arq:result:{job_id}")
            await arq_client.delete(f"task:{job_id}:progress")
            logger.debug(f"Successfully deleted job keys for {job_id}")
    
    # Enqueue task with custom job ID
    job = await arq_client.enqueue_job(
        "generate_draft_task",
        business_plan_id=str(business_plan_id),
        form_data_dict=form_data.model_dump(),
        model=model,
        provider=provider,
        _job_id=job_id  # Custom job ID with business plan ID
    )
    
    logger.info(f"Enqueued draft generation task {job.job_id} for business plan {business_plan_id}")
    
    return {
        "task_id": job.job_id,
        "status": "queued",
        "business_plan_id": str(business_plan_id)
    }


@router.delete("/business-plans/{business_plan_id}/cancel")
async def cancel_task(
    business_plan: BusinessPlan = Depends(get_current_business_plan),
    arq_client: ArqRedis = Depends(get_arq_client),
    redis_client: redis.Redis = Depends(get_redis_client),
):
    """
    Cancel the currently active draft generation task for a business plan.
    
    Returns success message if task was cancelled, otherwise 404 if no active task exists.
    """
    business_plan_id = business_plan.id
    
    # Get active job for business plan
    job, job_status, job_id = await get_active_job_for_business_plan(
        business_plan_id, arq_client, require_active=True
    )
    
    # Cancel the job
    try:
        await job.abort()
        logger.info(f"Aborted task {job_id} (status: {job_status.value}) for business plan {business_plan_id}")
    except Exception as e:
        logger.error(f"Failed to cancel job {job_id}",error=e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel task: {str(e)}"
        )
    
    # Update progress with cancellation error
    try:
        await redis_client.hset(
            f"task:{job_id}:progress",
            mapping={
                "error": "Task was cancelled by user"
            }
        )
    except Exception as e:
        logger.warning(f"Failed to update progress for cancelled task {job_id}: {e}")
    
    return {
        "message": "Task cancelled successfully",
        "task_id": job_id,
        "status": "cancelled",
        "business_plan_id": str(business_plan_id)
    }


@router.get("/business-plans/{business_plan_id}/status")
async def get_task_status(
    business_plan: BusinessPlan = Depends(get_current_business_plan),
    arq_client: ArqRedis = Depends(get_arq_client),
    redis_client: redis.Redis = Depends(get_redis_client),
):
    """
    Get the status of a task for a business plan.
    
    Returns progress information including current section and completed sections.
    Returns None if there is no active task.
    """
    business_plan_id = business_plan.id
    
    # Check ARQ for active job (don't require active, we'll check ourselves)
    job, job_status, task_id = await get_active_job_for_business_plan(
        business_plan_id, arq_client, require_active=False
    )

    print(job, job_status, task_id)
    
    # If no active task, return None
    if not job_status or job_status not in [JobStatus.queued, JobStatus.in_progress]:
        return None
    
    # Get additional job info for created_at
    job_info = await job.info()
    created_at = None
    if job_info and hasattr(job_info, 'enqueue_time') and job_info.enqueue_time:
        created_at = job_info.enqueue_time.isoformat()
    
    # Get progress from Redis
    progress = await redis_client.hgetall(f"task:{task_id}:progress")
    
    # Parse progress data (use defaults if not available)
    current_section = 0
    total_sections = 12
    completed_sections = []
    error = None
    estimated_seconds_remaining = 0
    
    if progress:
        current_section = int(progress.get(b"current_section", b"0"))
        total_sections = int(progress.get(b"total_sections", b"12"))
        estimated_seconds_remaining = int(progress.get(b"estimated_seconds_remaining", b"0"))
        
        completed_sections_str = progress.get(b"completed_sections", b"[]")
        try:
            completed_sections = json.loads(completed_sections_str.decode())
        except (json.JSONDecodeError, AttributeError):
            completed_sections = []
        
        if b"error" in progress:
            error = progress[b"error"].decode()
    
    return {
        "task_id": task_id,
        "status": job_status.value,
        "current_section": current_section,
        "completed_sections": completed_sections,
        "total_sections": total_sections,
        "estimated_seconds_remaining": estimated_seconds_remaining,
        "error": error,
        "business_plan_id": str(business_plan_id),
        "created_at": created_at,
    }
