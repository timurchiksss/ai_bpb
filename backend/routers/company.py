"""
Company API routes

Handles CRUD operations for companies.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from core.database import get_db
from core.dependencies import get_current_user
from schemas.sqlalchemy import User, Company
from schemas.pydantic.company import (
    CompanyCreate,
    CompanyUpdate,
    CompanyResponse,
)
from utils.oked import validate_oked_codes
from config import ASTANA_HUB_PRIORITY_ACTIVITIES

router = APIRouter(tags=["company"])


@router.get("", response_model=CompanyResponse)
async def get_company(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's company"""
    stmt = select(Company).where(Company.user_id == current_user.id)
    result = await db.execute(stmt)
    company = result.scalar_one_or_none()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    return company


@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    company_data: CompanyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new company for the current user"""
    # Check if user already has a company
    stmt = select(Company).where(Company.user_id == current_user.id)
    result = await db.execute(stmt)
    existing_company = result.scalar_one_or_none()
    
    if existing_company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already has a company. Use PUT to update it."
        )
    
    # Validate OKED codes
    invalid_codes = validate_oked_codes(company_data.oked_codes)
    if invalid_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OKED codes: {', '.join(invalid_codes)}"
        )
    
    new_company = Company(
        user_id=current_user.id,
        name=company_data.name,
        type=company_data.type,
        bin=company_data.bin,
        oked_codes=company_data.oked_codes,
    )
    
    try:
        db.add(new_company)
        await db.commit()
        await db.refresh(new_company)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already has a company"
        )
    
    return new_company


@router.put("", response_model=CompanyResponse)
async def update_company(
    company_data: CompanyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's company"""
    stmt = select(Company).where(Company.user_id == current_user.id)
    result = await db.execute(stmt)
    company = result.scalar_one_or_none()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    # Update fields
    if company_data.name is not None:
        company.name = company_data.name
    if company_data.type is not None:
        company.type = company_data.type
    if company_data.bin is not None:
        company.bin = company_data.bin
    if company_data.oked_codes is not None:
        # Validate OKED codes
        invalid_codes = validate_oked_codes(company_data.oked_codes)
        if invalid_codes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid OKED codes: {', '.join(invalid_codes)}"
            )
        company.oked_codes = company_data.oked_codes
    
    await db.commit()
    await db.refresh(company)
    
    return company

