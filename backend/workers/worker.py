"""
ARQ Worker settings and task functions
"""

from typing import Any
from uuid import UUID

from core.database import async_session
from schemas.sqlalchemy import BusinessPlan, Company
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from agents.draft_generator.agent import BusinessPlanDraftGenerator, TOTAL_SECTIONS
from agents.schemas import DraftGenerationState, DraftFormData
from config import LLM_PROVIDERS
from loguru import logger
import redis.asyncio as redis

from .progress import ProgressManager


async def generate_draft_task(
    ctx: dict[str, Any],
    business_plan_id: str,
    form_data_dict: dict,
    model: str,
    provider: str
) -> dict[str, Any]:
    """
    ARQ task to generate business plan draft.
    
    Args:
        ctx: ARQ context (contains Redis connection)
        business_plan_id: UUID of business plan
        form_data_dict: Serialized form data
        model: LLM model name
        provider: LLM provider name
        
    Returns:
        Dict with result information
    """
    task_id = ctx["job_id"]
    redis_client = ctx["redis"]
    business_plan_uuid = UUID(business_plan_id)
    
    # Initialize progress manager
    progress_manager = ProgressManager(redis_client, task_id)
    
    try:
        # Initialize progress
        await progress_manager.update_progress(
            current_section=0,
            completed_sections=[],
            total_sections=TOTAL_SECTIONS,
        )
        
        # Create database session
        async with async_session() as session:
            # Load business plan with company
            print("business_plan_uuid:", business_plan_uuid)
            stmt = select(BusinessPlan).where(BusinessPlan.id == business_plan_uuid).options(
                selectinload(BusinessPlan.company)
            )
            result = await session.execute(stmt)
            business_plan = result.scalar_one_or_none()
            
            if not business_plan:
                await progress_manager.mark_failed("Business plan not found")
                return {"success": False, "error": "Business plan not found"}
            
            # Clear existing business plan content before starting fresh generation
            logger.info(
                f"Clearing business plan content before generation. "
                f"Current llm_content length: {len(business_plan.llm_content)}, "
                f"user_content length: {len(business_plan.user_content)}"
            )
            business_plan.llm_content = ""
            business_plan.user_content = ""
            session.add(business_plan)
            await session.commit()
            
            # Refresh to verify it was cleared
            await session.refresh(business_plan, ["llm_content", "user_content"])
            logger.info(
                f"Business plan content cleared. "
                f"Verified llm_content length: {len(business_plan.llm_content)}, "
                f"user_content length: {len(business_plan.user_content)}"
            )
            
            # Parse form data
            form_data = DraftFormData(**form_data_dict)
            
            # Get LLM config
            if provider not in LLM_PROVIDERS:
                await progress_manager.mark_failed(f"Invalid provider: {provider}")
                return {"success": False, "error": f"Invalid provider: {provider}"}
            
            provider_config = LLM_PROVIDERS[provider]
            if model not in provider_config["models"]:
                await progress_manager.mark_failed(f"Invalid model: {model}")
                return {"success": False, "error": f"Invalid model: {model}"}
            
            # Create agent with progress manager
            agent = BusinessPlanDraftGenerator(
                session=session,
                business_plan=business_plan,
                model=model,
                api_key=provider_config["api_key"],
                base_url=provider_config["base_url"],
                provider=provider,
                progress_manager=progress_manager
            )
            
            # Create initial state
            initial_state = DraftGenerationState(
                business_plan=business_plan,
                form_data=form_data,
                company=business_plan.company,
                accumulated_content="",
                current_section=0,
                completed_sections=[]
            )
            
            # Generate draft - progress is updated via callback in save_section node
            async for _ in agent.astream_draft(initial_state):
                # Progress updates happen in the save_section node via callback
                pass
            
            logger.info(f"Task {task_id} completed successfully")
            return {
                "success": True,
                "business_plan_id": str(business_plan.id)
            }
            
    except Exception as e:
        logger.error(f"Task {task_id} failed",error=e, exc_info=True)
        await progress_manager.mark_failed(str(e))
        return {"success": False, "error": str(e)}
