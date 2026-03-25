"""
Chat and Message request/response schemas
"""

from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import Optional, List
from schemas.enums import MessageRole


# Chat Schemas
class ChatCreate(BaseModel):
    """Create chat request schema"""
    title: str
    business_plan_id: UUID


class ChatUpdate(BaseModel):
    """Update chat request schema"""
    title: Optional[str] = None


class ChatResponse(BaseModel):
    """Chat response schema"""
    id: UUID
    user_id: UUID
    business_plan_id: UUID
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatListResponse(BaseModel):
    """List of chats response schema"""
    chats: List[ChatResponse]


# Message Schemas
class MessageCreate(BaseModel):
    """Create user message request schema"""
    content: str
    model_type: str  # "standard" or "pro"


class ToolCallResponse(BaseModel):
    """Tool call response schema"""
    id: UUID
    tool_name: str
    created_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    """Message response schema"""
    id: UUID
    chat_id: UUID
    user_id: UUID
    content: str
    role: MessageRole
    created_at: datetime
    tool_calls: List[ToolCallResponse] = []

    class Config:
        from_attributes = True


class MessageListResponse(BaseModel):
    """List of messages response schema with pagination"""
    messages: List[MessageResponse]
    total: int
    limit: int
    offset: int

