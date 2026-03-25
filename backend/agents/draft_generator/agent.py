"""
Business Plan Draft Generator Agent Implementation using LangGraph

An agent that generates business plan drafts from form data by sequentially
generating 12 sections. Each section is generated independently and output
is parsed from <content></content> XML tags.
"""

from typing import Any, AsyncGenerator
from uuid import UUID
from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph._internal._typing import TypedDictLikeV1, TypedDictLikeV2, DataclassLike
from langgraph.graph.state import CompiledStateGraph
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from agents.base_agent import BaseAgent
from agents.schemas import DraftGenerationState, AgentMessageChunk
from schemas.sqlalchemy import BusinessPlan
from utils import get_utc_now
from loguru import logger
from workers.progress import ProgressManager

from .prompt import get_section_prompt
from agents.utils import parse_content_tag

# Number of sections in a business plan
TOTAL_SECTIONS = 12


class BusinessPlanDraftGenerator(BaseAgent):
    """
    Business Plan Draft Generator agent implementation using LangGraph.
    
    Generates business plan sections sequentially (1-12) from form data.
    Each section is generated independently and output is parsed from XML tags.
    """
    
    def __init__(
        self,
        session: AsyncSession,
        business_plan: BusinessPlan,
        model: str,
        api_key: str,
        base_url: str,
        provider: str,
        progress_manager: ProgressManager
    ):
        super().__init__(session)
        self.business_plan = business_plan
        self.model = model
        self.provider = provider
        self.api_key = api_key
        self.base_url = base_url
        self.progress_manager = progress_manager
        
        # Initialize LLM (no tools, just text generation)
        self.llm = ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url=base_url,
            streaming=False,  # Non-streaming for batch generation
            temperature=0.7,
        )
        
        # Build and compile the LangGraph
        self.graph = self._build_graph()
    
    def _build_graph(
        self
    ) -> CompiledStateGraph[
        TypedDictLikeV1 | TypedDictLikeV2 | DataclassLike | BaseModel | Any, Any, Any, Any
    ]:
        """Build the LangGraph workflow with generate and save nodes"""
        workflow = StateGraph(DraftGenerationState)
        
        # Add section generation node
        workflow.add_node("generate_section", self._generate_section_node)
        
        # Add save section and update progress node
        workflow.add_node("save_section", self._save_section_node)
        
        # Set entry point
        workflow.set_entry_point("generate_section")
        
        # After generating, always save the section
        workflow.add_edge("generate_section", "save_section")
        
        # After saving, check if we should continue or end
        def _should_continue(state: DraftGenerationState) -> str:
            if len(state.completed_sections) >= TOTAL_SECTIONS:
                return "end"
            return "continue"
        
        workflow.add_conditional_edges(
            "save_section",
            _should_continue,
            {
                "continue": "generate_section",
                "end": END
            }
        )
        
        # Compile the graph
        return workflow.compile()
    
    async def _generate_section_node(
        self,
        state: DraftGenerationState
    ) -> dict[str, Any]:
        """Generate the next section based on current state"""
        # Determine which section to generate next
        section_num = len(state.completed_sections) + 1
        
        if section_num > TOTAL_SECTIONS:
            # All sections done, should not reach here due to conditional edge
            return {}
        
        return await self._generate_section(state, section_num)
    
    async def _generate_section(
        self,
        state: DraftGenerationState,
        section_num: int
    ) -> dict[str, Any]:
        """
        Generate a single section of the business plan.
        
        Args:
            state: Current draft generation state
            section_num: Section number (1-12)
            
        Returns:
            Updated state dictionary
            
        Raises:
            Exception: If generation fails, exception propagates and fails entire generation
        """
        logger.info(
            f"[Section {section_num}] Starting generation for business plan {self.business_plan.id}"
        )
        
        # Ensure company is loaded
        if not state.company:
            await self.session.refresh(state.business_plan, ["company"])
            state.company = state.business_plan.company
        
        # Prepare section-specific prompt
        prompt = get_section_prompt(section_num=section_num, state=state)
        
        # Call LLM
        system_message = SystemMessage(content=prompt)
        response = await self.llm.ainvoke([system_message])
        llm_output = response.content
        
        # Log full raw LLM response
        logger.info(
            f"[Section {section_num}] Raw LLM response (full, {len(llm_output)} chars):\n"
            f"{llm_output}"
        )
        
        # Parse content from XML tag
        section_content = parse_content_tag(llm_output)
        
        if not section_content:
            logger.error(
                f"[Section {section_num}] Failed to parse content from LLM output. "
                f"Full raw response:\n{llm_output}"
            )
            raise ValueError(
                f"Failed to parse content from LLM output for section {section_num}. "
                f"Raw response length: {len(llm_output)}"
            )
        
        # Log full parsed content
        logger.info(
            f"[Section {section_num}] Parsed content (full, {len(section_content)} chars):\n"
            f"{section_content}"
        )
        
        # Format section with header
        section_header = f"# {section_num}. {self._get_section_title(section_num)}"
        formatted_section = f"{section_header}\n\n{section_content}"
        
        # Append to accumulated content
        if state.accumulated_content:
            new_content = state.accumulated_content + "\n\n" + formatted_section
        else:
            new_content = formatted_section
        
        logger.info(
            f"[Section {section_num}] Successfully generated and formatted "
            f"({len(section_content)} chars parsed, {len(formatted_section)} chars total). "
            f"Accumulated content length: {len(new_content)} chars"
        )
        
        # Update completed sections
        new_completed_sections = state.completed_sections + [section_num]
        
        # Determine next section to work on (or 0 if all done)
        next_section = section_num + 1 if section_num < TOTAL_SECTIONS else 0
        
        # Update state (save happens in save_section node)
        return {
            "accumulated_content": new_content,
            "current_section": next_section,  # Next section to work on
            "completed_sections": new_completed_sections,
        }
    
    async def _save_section_node(
        self,
        state: DraftGenerationState
    ) -> dict[str, Any]:
        """
        Save the current accumulated content to database and update progress in Redis.
        This node is called after each section is generated.
        """
        completed_count = len(state.completed_sections)
        current_section = state.current_section
        
        logger.info(
            f"[Save Section] Saving section {completed_count}/{TOTAL_SECTIONS} "
            f"to business plan {self.business_plan.id}. "
            f"Content length: {len(state.accumulated_content)} chars"
        )
        
        # Save accumulated content to database (section by section)
        # Update both llm_content and user_content so the draft is immediately visible
        state.business_plan.llm_content = state.accumulated_content
        state.business_plan.user_content = state.accumulated_content
        self.session.add(state.business_plan)
        await self.session.commit()
        
        logger.info(
            f"[Save Section] Successfully saved section {completed_count}/{TOTAL_SECTIONS} "
            f"to business plan {self.business_plan.id}"
        )
        
        # Update progress in Redis via progress manager
        await self.progress_manager.update_progress(
            current_section=current_section,
            completed_sections=state.completed_sections,
            total_sections=TOTAL_SECTIONS,
        )
        
        # If all sections are done, mark as completed in Redis
        if completed_count >= TOTAL_SECTIONS:
            await self.progress_manager.mark_completed(
                completed_sections=state.completed_sections,
                total_sections=TOTAL_SECTIONS
            )
        
        return {}
    
    def _get_section_title(self, section_num: int) -> str:
        """Get the title for a section number"""
        titles = {
            1: "Наименование проекта",
            2: "Место реализации проекта",
            3: "Права на интеллектуальную собственность",
            4: "Сведения о команде",
            5: "Стадия готовности проекта",
            6: "Ключевые показатели эффективности (KPI)",
            7: "Техническое описание проекта",
            8: "Смета планируемых расходов",
            9: "Виды товаров/услуг",
            10: "Клиенты/потенциальные клиенты",
            11: "План мероприятий",
            12: "Общественная значимость проекта"
        }
        return titles.get(section_num, f"Раздел {section_num}")
    
    async def astream_draft(
        self, initial_state: DraftGenerationState
    ) -> AsyncGenerator[Any, None]:
        """
        Stream draft generation events.
        
        Args:
            initial_state: Initial state with form data and business plan
            
        Yields:
            LangGraph stream events including custom progress events
        """
        # Ensure company is loaded
        if not initial_state.company:
            await self.session.refresh(initial_state.business_plan, ["company"])
            initial_state.company = initial_state.business_plan.company
        
        # Stream events from graph using astream_events to catch custom events
        from langchain_core.runnables import RunnableConfig
        config = RunnableConfig()
        
        async for event in self.graph.astream_events(initial_state, version="v2", config=config):
            yield event
    
    # Required by BaseAgent but not used for draft generation
    async def astream(self, user_id: UUID, chat_id: UUID) -> AsyncGenerator[AgentMessageChunk, None]:
        """Not used for draft generation"""
        raise NotImplementedError("Draft generation doesn't use astream")
    
    async def process_message(self, user_id: UUID, chat_id: UUID, message: str) -> None:
        """Not used for draft generation"""
        raise NotImplementedError("Draft generation doesn't use process_message")

