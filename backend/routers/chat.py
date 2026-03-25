"""
Chat API routes

Handles CRUD operations for chats and CR operations for messages.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import datetime, timezone

from core.database import get_db
from core.dependencies import get_current_user, get_arq_client, ensure_no_active_task_for_business_plan
from schemas.sqlalchemy import User, Chat, Message, BusinessPlan, Company
from schemas.enums import MessageRole
from schemas.pydantic.chat import (
    ChatCreate,
    ChatUpdate,
    ChatResponse,
    ChatListResponse,
    MessageCreate,
    MessageResponse,
    MessageListResponse,
)
from agents.business_plan_constructor.agent import BusinessPlanConstructor
from config import LLM_PROVIDERS
from utils.llm import get_provider_and_model
from arq import ArqRedis

router = APIRouter(tags=["chat"])


# Models endpoint

@router.get("/models", response_model=dict)
async def list_models():
    """Get available model types (standard/pro)"""
    from config import MODEL_TYPES
    return {
        "model_types": list(MODEL_TYPES.keys())
    }


# Chat CRUD endpoints

@router.post("", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
async def create_chat(
    chat_data: ChatCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    arq_client: ArqRedis = Depends(get_arq_client),
):
    """Create a new chat"""
    # Verify business plan exists and belongs to user
    stmt = (
        select(BusinessPlan)
        .join(Company, BusinessPlan.company_id == Company.id)
        .where(
        BusinessPlan.id == chat_data.business_plan_id,
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
    
    # Ensure no active task is running for this business plan
    await ensure_no_active_task_for_business_plan(business_plan, arq_client)
    
    new_chat = Chat(
        user_id=current_user.id,
        business_plan_id=chat_data.business_plan_id,
        title=chat_data.title,
    )
    
    db.add(new_chat)
    await db.commit()
    await db.refresh(new_chat)
    
    return new_chat


@router.get("", response_model=ChatListResponse)
async def list_chats(
    business_plan_id: UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all chats for the current user, optionally filtered by business plan"""
    stmt = select(Chat).where(Chat.user_id == current_user.id)
    if business_plan_id:
        stmt = stmt.where(Chat.business_plan_id == business_plan_id)
    stmt = stmt.order_by(Chat.updated_at.desc())
    result = await db.execute(stmt)
    chats = result.scalars().all()
    
    return ChatListResponse(chats=[ChatResponse.model_validate(chat) for chat in chats])


@router.get("/{chat_id}", response_model=ChatResponse)
async def get_chat(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific chat by ID"""
    stmt = select(Chat).where(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    )
    result = await db.execute(stmt)
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )
    
    return chat


@router.put("/{chat_id}", response_model=ChatResponse)
async def update_chat(
    chat_id: UUID,
    chat_data: ChatUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a chat"""
    stmt = select(Chat).where(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    )
    result = await db.execute(stmt)
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )
    
    # Update fields
    if chat_data.title is not None:
        chat.title = chat_data.title
    
    await db.commit()
    await db.refresh(chat)
    
    return chat


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a chat and all its messages"""
    stmt = select(Chat).where(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    )
    result = await db.execute(stmt)
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )
    
    # Delete the chat (CASCADE will handle messages automatically)
    await db.execute(delete(Chat).where(Chat.id == chat_id))
    await db.commit()
    
    return None


# Message endpoints

@router.post("/{chat_id}/messages")
async def send_message(
    chat_id: UUID,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    arq_client: ArqRedis = Depends(get_arq_client),
):
    """Send a user message in a chat and stream agent response"""
    # Verify chat exists and belongs to user, load business plan
    stmt = select(Chat).where(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    ).options(selectinload(Chat.business_plan).selectinload(BusinessPlan.company))
    result = await db.execute(stmt)
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )
    
    if not chat.business_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business plan not found"
        )
    
    # Ensure no active task is running for this business plan
    await ensure_no_active_task_for_business_plan(chat.business_plan, arq_client)
    
    # Get provider and model from model_type
    try:
        provider, model = get_provider_and_model(message_data.model_type)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    # Get provider config
    provider_config = LLM_PROVIDERS[provider]
    
    # Initialize agent with business plan
    agent = BusinessPlanConstructor(
        session=db,
        business_plan=chat.business_plan,
        model=model,
        api_key=provider_config["api_key"],
        base_url=provider_config["base_url"],
        provider=provider
    )
    
    # Process message (saves user message to database)
    await agent.process_message(current_user.id, chat_id, message_data.content)
    
    
    # Stream response
    async def generate_stream():
        async for chunk in agent.astream(current_user.id, chat_id):
            yield f"data: {chunk.model_dump_json(exclude_unset=True)}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/{chat_id}/messages", response_model=MessageListResponse)
async def list_messages(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
    sort_by: str = "created_at",
    sort_direction: str = "desc",
):
    """Get messages for a specific chat with pagination"""
    # Verify chat exists and belongs to user
    stmt = select(Chat).where(
        Chat.id == chat_id,
        Chat.user_id == current_user.id
    )
    result = await db.execute(stmt)
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found"
        )
    
    # Validate limit
    if limit < 1 or limit > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit must be between 1 and 100"
        )
    
    if offset < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Offset must be >= 0"
        )
    
    # Validate sort_by
    if sort_by not in ["created_at"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sort_by must be 'created_at'"
        )
    
    # Validate sort_direction
    if sort_direction not in ["asc", "desc"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sort_direction must be 'asc' or 'desc'"
        )
    
    # Build query with sorting
    msg_stmt = select(Message).where(Message.chat_id == chat_id)
    
    # Apply sorting
    if sort_by == "created_at":
        if sort_direction == "desc":
            msg_stmt = msg_stmt.order_by(Message.created_at.desc())
        else:
            msg_stmt = msg_stmt.order_by(Message.created_at.asc())
    
    # Get total count
    count_stmt = select(func.count(Message.id)).where(Message.chat_id == chat_id)
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()
    
    # Apply pagination
    msg_stmt = msg_stmt.limit(limit).offset(offset)
    
    msg_result = await db.execute(msg_stmt)
    messages = msg_result.scalars().all()
    
    return MessageListResponse(
        messages=[MessageResponse.model_validate(msg) for msg in messages],
        total=total,
        limit=limit,
        offset=offset
    )
