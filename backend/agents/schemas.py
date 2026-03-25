import operator
from enum import Enum
from typing import Annotated, Sequence
from typing import Optional
from uuid import UUID

from langchain_core.messages import BaseMessage
from langgraph.managed import RemainingSteps
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from schemas.sqlalchemy import BusinessPlan, Company


class MessageChunkTypes(str, Enum):
    """Types of message chunks streamed to frontend"""
    RESPONSE = "response"
    TOOL_START = "tool_start"
    TOOL_END = "tool_end"
    BUSINESS_PLAN_UPDATE = "business_plan_update"


class AgentMessageChunk(BaseModel):
    """Message chunk for streaming to frontend"""
    type: MessageChunkTypes
    content: Optional[str] = None


class AgentState(BaseModel):
    """State for LangGraph agent with conversation memory and context"""
    model_config = ConfigDict(arbitrary_types_allowed=True)

    # Conversation messages
    messages: Annotated[Sequence[BaseMessage], operator.add]

    # Database session for tool access
    session: AsyncSession

    # Business plan being worked on
    business_plan: BusinessPlan
    
    # Chat ID for naming the chat
    chat_id: UUID
    
    # Recursion limit tracking (handled automatically by LangGraph)
    remaining_steps: RemainingSteps
    
    # Track if we've warned the LLM about approaching the limit
    warned_about_limit: bool = False


class DraftGenerationState(BaseModel):
    """State for draft generation workflow"""
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    # Business plan being generated
    business_plan: BusinessPlan
    
    # Form data (structured input from user)
    form_data: "DraftFormData"  # Forward reference since DraftFormData is defined below
    
    # Company information
    company: Company
    
    # Current accumulated content (all sections generated so far)
    accumulated_content: str = ""
    
    # Current section being generated (1-12)
    current_section: int = 0
    
    # Progress tracking
    completed_sections: list[int] = []


class IPDocument(BaseModel):
    """Intellectual property document"""
    type: str
    number: str
    owner: str


class TeamMember(BaseModel):
    """Team member information"""
    name: str
    position: str
    education: str
    experience: str
    skills: str
    responsibilities: str


class DraftFormData(BaseModel):
    """Form data for business plan draft generation"""
    
    # Section 1: Наименование проекта
    website_url: str
    problem_description: str
    solution_description: str
    project_goals: str
    project_tasks: str
    
    # Section 2: Место реализации проекта
    region: str
    target_market_description: str
    market_volume: str
    market_trends: str
    competitors_info: str
    market_share: str
    
    # Section 3: Права на интеллектуальную собственность
    ip_description: str
    ip_documents: list[IPDocument]
    
    # Section 4: Сведения о команде
    team_members: list[TeamMember]
    
    # Section 5: Стадия готовности проекта
    project_stage: str
    existing_results: str
    completed_work_stages: str
    readiness_degree: str
    
    # Section 8: Смета планируемых расходов
    estimated_salaries: str
    estimated_servers: str
    estimated_marketing: str
    estimated_operations: str
    
    # Section 9: Виды товаров/услуг
    product_service_types: str
    sales_model: str
    revenue_model: str
    sales_strategy: str
    sales_channels: str
    
    # Section 10: Клиенты/потенциальные клиенты
    target_audience: str
    current_clients: str
    client_categories: str
    customer_profile: str
    
    # Section 12: Общественная значимость проекта
    regional_significance: str
    economic_significance: str
    social_significance: str
    planned_jobs: str