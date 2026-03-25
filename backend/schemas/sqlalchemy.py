"""
SQLAlchemy ORM models
"""

from datetime import datetime
from uuid import UUID
from typing import Optional
from sqlalchemy import String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import mapped_column, Mapped, relationship
from sqlalchemy.types import Uuid
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
import uuid_extensions
from core.database import Base
from schemas.enums import MessageRole, CompanyType
from utils import get_utc_now


class User(Base):
    """User ORM model"""
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid(native_uuid=True), primary_key=True, default=uuid_extensions.uuid7)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_admin: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, nullable=False)
    
    # Relationships
    chats: Mapped[list["Chat"]] = relationship("Chat", back_populates="user", cascade="all, delete-orphan")
    company: Mapped[Optional["Company"]] = relationship("Company", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Company(Base):
    """Company model - one per user"""
    __tablename__ = "companies"

    id: Mapped[UUID] = mapped_column(Uuid(native_uuid=True), primary_key=True, default=uuid_extensions.uuid7)
    user_id: Mapped[UUID] = mapped_column(Uuid(native_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[CompanyType] = mapped_column(
        Enum(CompanyType, values_callable=lambda enum: [e.value for e in enum]),
        nullable=False
    )
    bin: Mapped[str] = mapped_column(String(12), nullable=False)  # 12 digits
    oked_codes: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now, nullable=False)
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="company")
    business_plans: Mapped[list["BusinessPlan"]] = relationship("BusinessPlan", back_populates="company", cascade="all, delete-orphan")


class BusinessPlan(Base):
    """Business Plan model"""
    __tablename__ = "business_plans"

    id: Mapped[UUID] = mapped_column(Uuid(native_uuid=True), primary_key=True, default=uuid_extensions.uuid7)
    company_id: Mapped[UUID] = mapped_column(Uuid(native_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    user_content: Mapped[str] = mapped_column(Text, nullable=False, default="")  # Source of truth - user's accepted version
    llm_content: Mapped[str] = mapped_column(Text, nullable=False, default="")  # LLM's version for current run
    priority_activities: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    participation_period_years: Mapped[int] = mapped_column(nullable=False)  # Срок участия в технопарке в годах
    planned_submission_year: Mapped[int] = mapped_column(nullable=False)  # Год планируемой подачи бизнес-плана
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now, nullable=False)
    
    # Relationships
    company: Mapped["Company"] = relationship("Company", back_populates="business_plans")
    chats: Mapped[list["Chat"]] = relationship("Chat", back_populates="business_plan", cascade="all, delete-orphan")


class Chat(Base):
    """Chat conversation model"""
    __tablename__ = "chats"

    id: Mapped[UUID] = mapped_column(Uuid(native_uuid=True), primary_key=True, default=uuid_extensions.uuid7)
    user_id: Mapped[UUID] = mapped_column(Uuid(native_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    business_plan_id: Mapped[UUID] = mapped_column(Uuid(native_uuid=True), ForeignKey("business_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now, nullable=False)
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="chats")
    business_plan: Mapped["BusinessPlan"] = relationship("BusinessPlan", back_populates="chats")
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="chat", cascade="all, delete-orphan")


class Message(Base):
    """Message model - user and assistant text messages only"""
    __tablename__ = "messages"

    id: Mapped[UUID] = mapped_column(Uuid(native_uuid=True), primary_key=True, default=uuid_extensions.uuid7)
    chat_id: Mapped[UUID] = mapped_column(Uuid(native_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[UUID] = mapped_column(Uuid(native_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[MessageRole] = mapped_column(
        Enum(MessageRole, values_callable=lambda enum: [e.value for e in enum]),
        nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, nullable=False)
    
    # Relationships
    chat: Mapped["Chat"] = relationship("Chat", back_populates="messages")
    tool_calls: Mapped[list["ToolCall"]] = relationship("ToolCall", back_populates="message", cascade="all, delete-orphan", lazy="selectin")


class ToolCall(Base):
    """Tool call made by the assistant"""
    __tablename__ = "tool_calls"

    id: Mapped[UUID] = mapped_column(Uuid(native_uuid=True), primary_key=True, default=uuid_extensions.uuid7)
    message_id: Mapped[UUID] = mapped_column(Uuid(native_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    tool_call_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    tool_name: Mapped[str] = mapped_column(String(64), nullable=False)
    tool_arguments: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, nullable=False)
    
    # Relationships
    message: Mapped["Message"] = relationship("Message", back_populates="tool_calls")
    response: Mapped[Optional["ToolResponse"]] = relationship("ToolResponse", back_populates="tool_call", uselist=False, lazy="selectin")


class ToolResponse(Base):
    """Response from tool execution"""
    __tablename__ = "tool_responses"

    id: Mapped[UUID] = mapped_column(Uuid(native_uuid=True), primary_key=True, default=uuid_extensions.uuid7)
    tool_call_ref: Mapped[UUID] = mapped_column(Uuid(native_uuid=True), ForeignKey("tool_calls.id", ondelete="CASCADE"), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, nullable=False)
    
    # Relationships
    tool_call: Mapped["ToolCall"] = relationship("ToolCall", back_populates="response")


class LLMRequest(Base):
    """LLM request tracking for cost and usage monitoring"""
    __tablename__ = "llm_requests"

    id: Mapped[UUID] = mapped_column(Uuid(native_uuid=True), primary_key=True, default=uuid_extensions.uuid7)
    user_id: Mapped[Optional[UUID]] = mapped_column(Uuid(native_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    input_tokens: Mapped[int] = mapped_column(nullable=False, default=0)
    cached_input_tokens: Mapped[int] = mapped_column(nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(nullable=False, default=0)
    usd_cost: Mapped[float] = mapped_column(nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now, nullable=False, index=True)
    
    # Relationships
    user: Mapped[Optional["User"]] = relationship("User")
