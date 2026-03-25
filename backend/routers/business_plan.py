"""
Business Plan API routes

Handles CRUD operations for business plans.
"""

import subprocess
import tempfile
import os
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from uuid import UUID

from core.database import get_db
from core.dependencies import get_current_user, get_current_business_plan
from schemas.sqlalchemy import User, BusinessPlan, Company, Chat
from schemas.pydantic.business_plan import (
    BusinessPlanCreate,
    BusinessPlanUpdate,
    BusinessPlanResponse,
    BusinessPlanListResponse,
)
from config import OKED_CLASSIFIER, ASTANA_HUB_PRIORITY_ACTIVITIES
from utils.business_plan import generate_business_plan_template

router = APIRouter(tags=["business-plan"])


@router.get("/config")
async def get_business_plan_config():
    """Get OKED classifier and priority activities for business plan creation"""
    return {
        "oked_classifier": OKED_CLASSIFIER,
        "priority_activities": ASTANA_HUB_PRIORITY_ACTIVITIES,
    }


@router.post("", response_model=BusinessPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_business_plan(
    plan_data: BusinessPlanCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new business plan"""
    # Validate company belongs to user
    stmt = select(Company).where(
        Company.id == plan_data.company_id,
        Company.user_id == current_user.id
    )
    result = await db.execute(stmt)
    company = result.scalar_one_or_none()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found or does not belong to user"
        )
    
    # Validate priority activities
    if len(plan_data.priority_activities) != len(set(plan_data.priority_activities)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Priority activities must be unique"
        )
    
    # Validate all priority activities exist in the list
    invalid_activities = [
        activity for activity in plan_data.priority_activities
        if activity not in ASTANA_HUB_PRIORITY_ACTIVITIES
    ]
    if invalid_activities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid priority activities: {', '.join(invalid_activities[:3])}"
        )
    
    new_plan = BusinessPlan(
        company_id=plan_data.company_id,
        title=plan_data.title,
        user_content="",
        llm_content="",
        priority_activities=plan_data.priority_activities,
        participation_period_years=plan_data.participation_period_years,
        planned_submission_year=plan_data.planned_submission_year,
    )
    
    # Set company relationship for template generation
    new_plan.company = company
    
    # Generate template and set both user_content and llm_content
    template_content = generate_business_plan_template(new_plan)
    new_plan.user_content = template_content
    new_plan.llm_content = template_content
    
    db.add(new_plan)
    await db.commit()
    await db.refresh(new_plan)
    
    # Create first chat automatically
    first_chat = Chat(
        user_id=current_user.id,
        business_plan_id=new_plan.id,
        title="Новый чат",
    )
    db.add(first_chat)
    await db.commit()
    
    return new_plan


@router.get("", response_model=BusinessPlanListResponse)
async def list_business_plans(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all business plans for the current user"""
    stmt = (
        select(BusinessPlan)
        .join(Company, BusinessPlan.company_id == Company.id)
        .where(Company.user_id == current_user.id)
        .order_by(BusinessPlan.updated_at.desc())
    )
    result = await db.execute(stmt)
    plans = result.scalars().all()
    
    return BusinessPlanListResponse(business_plans=[BusinessPlanResponse.model_validate(plan) for plan in plans])


@router.get("/{business_plan_id}", response_model=BusinessPlanResponse)
async def get_business_plan(
    business_plan: BusinessPlan = Depends(get_current_business_plan),
):
    """Get a specific business plan by ID"""
    return business_plan


@router.put("/{business_plan_id}", response_model=BusinessPlanResponse)
async def update_business_plan(
    plan_data: BusinessPlanUpdate,
    business_plan: BusinessPlan = Depends(get_current_business_plan),
    db: AsyncSession = Depends(get_db),
):
    """Update a business plan"""
    # Validate priority activities if provided
    if plan_data.priority_activities is not None:
        # Validate all priority activities exist in the list
        invalid_activities = [
            activity for activity in plan_data.priority_activities
            if activity not in ASTANA_HUB_PRIORITY_ACTIVITIES
        ]
        if invalid_activities:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid priority activities: {', '.join(invalid_activities[:3])}"
        )
    
    # Update fields
    if plan_data.title is not None:
        business_plan.title = plan_data.title
    if plan_data.priority_activities is not None:
        business_plan.priority_activities = plan_data.priority_activities
    if plan_data.participation_period_years is not None:
        business_plan.participation_period_years = plan_data.participation_period_years
    if plan_data.planned_submission_year is not None:
        business_plan.planned_submission_year = plan_data.planned_submission_year
    if plan_data.user_content is not None:
        # Only user_content can be updated via API (when user accepts changes)
        business_plan.user_content = plan_data.user_content
    
    await db.commit()
    await db.refresh(business_plan)
    
    return business_plan


@router.delete("/{business_plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_business_plan(
    business_plan: BusinessPlan = Depends(get_current_business_plan),
    db: AsyncSession = Depends(get_db),
):
    """Delete a business plan and all its chats"""
    # Delete the business plan (CASCADE will handle chats automatically)
    await db.execute(delete(BusinessPlan).where(BusinessPlan.id == business_plan.id))
    await db.commit()
    
    return None


def cleanup_temp_file(path: str):
    """Remove temporary file after response is sent"""
    try:
        os.unlink(path)
    except Exception:
        pass


@router.get("/{business_plan_id}/download/{format}")
async def download_business_plan(
    format: Literal["pdf", "docx"],
    business_plan: BusinessPlan = Depends(get_current_business_plan),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Download business plan as PDF or DOCX using Pandoc"""
    if not business_plan.user_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business plan has no content to export"
        )
    
    # Create temporary files
    with tempfile.TemporaryDirectory() as temp_dir:
        # Write markdown content to temp file
        md_path = os.path.join(temp_dir, "business_plan.md")
        with open(md_path, "w", encoding="utf-8") as f:
            # Add title as header
            f.write(f"# {business_plan.title}\n\n")
            f.write(business_plan.user_content)
        
        # Determine output format and file extension
        if format == "pdf":
            output_path = os.path.join(temp_dir, "business_plan.pdf")
            pandoc_args = [
                "pandoc",
                md_path,
                "-o", output_path,
                "--pdf-engine=xelatex",
                "-V", "geometry:margin=2.5cm",
                "-V", "mainfont=DejaVu Sans",
                "-V", "monofont=DejaVu Sans Mono",
            ]
            media_type = "application/pdf"
            filename = f"{business_plan.title}.pdf"
        else:  # docx
            output_path = os.path.join(temp_dir, "business_plan.docx")
            pandoc_args = [
                "pandoc",
                md_path,
                "-o", output_path,
            ]
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            filename = f"{business_plan.title}.docx"
        
        # Run pandoc
        try:
            result = subprocess.run(
                pandoc_args,
                capture_output=True,
                text=True,
                timeout=60,
            )
            
            if result.returncode != 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Pandoc conversion failed: {result.stderr}"
                )
            
            # Read the output file and return it
            with open(output_path, "rb") as f:
                content = f.read()
            
            # Create a new temp file outside the context manager to return
            final_file = tempfile.NamedTemporaryFile(delete=False, suffix=f".{format}")
            final_file.write(content)
            final_file.close()
            
            # Schedule cleanup after response is sent
            background_tasks.add_task(cleanup_temp_file, final_file.name)
            
            return FileResponse(
                path=final_file.name,
                media_type=media_type,
                filename=filename,
            )
            
        except subprocess.TimeoutExpired:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Pandoc conversion timed out"
            )
        except FileNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Pandoc is not installed on the server"
            )

