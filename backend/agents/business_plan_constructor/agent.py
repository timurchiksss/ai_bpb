"""
Business Plan Constructor Agent Implementation using LangGraph

An agent that helps users create business plans with tool support.
"""
from langchain_core.runnables.schema import StandardStreamEvent, CustomStreamEvent
from langgraph._internal._typing import TypedDictLikeV1, TypedDictLikeV2, DataclassLike
from langgraph.graph.state import CompiledStateGraph
from pydantic import BaseModel

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import AsyncGenerator, Any
from uuid import UUID
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.runnables import RunnableConfig
from sqlalchemy import select, func

from agents.base_agent import BaseAgent
from agents.schemas import AgentState, AgentMessageChunk, MessageChunkTypes
from agents.utils import name_chat, encode_tool_call_id
from .tools import TOOLS_LIST, handle_tool_errors
from .prompt import get_system_prompt
from schemas.sqlalchemy import Message, BusinessPlan, ToolCall, ToolResponse, LLMRequest
from schemas.enums import MessageRole
from utils import get_utc_now, calculate_llm_cost
from config import LLM_PROVIDERS
from loguru import logger


class BusinessPlanConstructor(BaseAgent):
    """
    Business Plan Constructor agent implementation using LangGraph with tool support.
    """
    
    # Recursion limit for the agent
    RECURSION_LIMIT: int = 50

    def __init__(self, session: AsyncSession, business_plan: BusinessPlan, model: str, api_key: str, base_url: str, provider: str):
        super().__init__(session)
        self.business_plan = business_plan
        self.model = model
        self.provider = provider
        self.api_key = api_key
        self.base_url = base_url
        
        # Track current message ID for linking tool responses
        self._current_message_id: UUID | None = None
        
        # Track which tool calls we've sent TOOL_START for (reset per stream)
        self._sent_tool_starts: set[str] = set()
        
        # Accumulate LLM usage events for saving at end of stream
        self.llm_usage_events: list[dict] = []

        
        # Initialize LLM with tools
        self.llm = ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url=base_url,
            streaming=True,
            temperature=0.7,
        ).bind_tools(TOOLS_LIST)
        
        # Build and compile the LangGraph
        self.graph = self._build_graph()
        
    
    def _build_graph(self) -> CompiledStateGraph[
        TypedDictLikeV1 | TypedDictLikeV2 | DataclassLike | BaseModel | Any, Any, Any, Any]:
        """Build the LangGraph workflow"""
        workflow = StateGraph(AgentState)
        
        # Add nodes
        workflow.add_node("agent", self._call_model)
        workflow.add_node("tools", ToolNode(TOOLS_LIST, handle_tool_errors=handle_tool_errors))
        
        def _should_continue(state: AgentState):
            """Determine if we should call tools or end, with recursion limit warning"""
            messages = state.messages
            last_message = messages[-1]
            logger.debug("remaining steps: ", state.remaining_steps, "warned?:", state.warned_about_limit)
            
            # If we've already warned and there are no tool calls, end
            if state.warned_about_limit:
                logger.debug(
                        f"business plan id: {self.business_plan.id}, chat id: {state.chat_id}: warned about limit, ending")
                return "end"
            
            # Check if we're running out of steps (3 steps left as buffer)
            # RemainingSteps is handled automatically by LangGraph and is an int
            if state.remaining_steps <= 3:
                # Add warning message and return to agent so it can see the warning and respond
                warning_msg = SystemMessage(
                    content="WARNING: You've hit recursion limit. "
                           "Ask user if you're allowed to continue editing business plan and only continue after that."
                )
                logger.debug(
                        f"business plan id: {self.business_plan.id}, chat id: {state.chat_id}: sending warning")
                return {
                    "next": "agent",
                    "update": {
                        "messages": [warning_msg],
                        "warned_about_limit": True
                    }
                }
            
            # Normal flow: check for tool calls
            if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
                logger.debug(f"business plan id: {self.business_plan.id}, chat id: {state.chat_id}: invoking tools: {last_message.tool_calls}")
                return "tools"
            logger.debug(
                f"business plan id: {self.business_plan.id}, chat id: {state.chat_id}: ending invocation")
            return "end"
        
        # Set entry point
        workflow.set_entry_point("agent")
        
        # Add conditional edges
        workflow.add_conditional_edges(
            "agent",
            _should_continue,
            {
                "tools": "tools",
                "agent": "agent",
                "end": END
            }
        )
        
        # Add edge from tools back to agent
        workflow.add_edge("tools", "agent")
        
        # Compile the graph with recursion limit
        return workflow.compile()
    
    async def _call_model(self, state: AgentState) -> dict:
        """Agent node that calls the LLM"""
        # Use the captured llm_content snapshot (set at start of astream)
        # This doesn't update during the run, even if llm_content changes in database
        llm_content_snapshot = getattr(self, '_llm_content_snapshot', state.business_plan.llm_content)
        
        # Add system message with current business plan content
        # Load company relationship if not already loaded
        if not state.business_plan.company:
            await self.session.refresh(state.business_plan, ["company"])
        
        system_message = SystemMessage(content=get_system_prompt(
            business_plan_title=state.business_plan.title,
            business_plan_content=llm_content_snapshot,
            company_name=state.business_plan.company.name,
            company_type=state.business_plan.company.type,
            company_bin=state.business_plan.company.bin,
            company_oked_codes=state.business_plan.company.oked_codes,
            priority_activities=state.business_plan.priority_activities,
            participation_period_years=state.business_plan.participation_period_years,
            planned_submission_year=state.business_plan.planned_submission_year
        ))
        messages = [system_message] + list(state.messages)
        
        response = await self.llm.ainvoke(messages)
        return {"messages": [response]}
    
    async def create_agent_state(self, user_id: UUID, chat_id: UUID) -> AgentState:
        """Create agent state with conversation history, including tool calls and responses"""
        # Load messages with tool_calls and their responses eagerly loaded
        stmt = (
            select(Message)
            .where(Message.chat_id == chat_id)
            .options(selectinload(Message.tool_calls).selectinload(ToolCall.response))
            .order_by(Message.created_at.asc())
        )
        
        result = await self.session.execute(stmt)
        messages = result.scalars().all()
        
        # Convert to LangChain messages
        langchain_messages = []
        for msg in messages:
            if msg.role == MessageRole.USER:
                langchain_messages.append(HumanMessage(content=msg.content))
                
            elif msg.role == MessageRole.ASSISTANT:
                if msg.tool_calls:
                    # Sort tool calls by created_at for consistent ordering
                    sorted_tool_calls = sorted(msg.tool_calls, key=lambda tc: tc.created_at)
                    # Generate deterministic tool_call_id from DB string for LangChain
                    # Assistant message with tool calls
                    langchain_messages.append(AIMessage(
                        content=msg.content,
                        tool_calls=[
                            {
                                "id": encode_tool_call_id(tc.tool_call_id),
                                "name": tc.tool_name,
                                "args": tc.tool_arguments
                            }
                            for tc in sorted_tool_calls
                        ]
                    ))
                    # Add tool responses after - ensure all tool calls have responses
                    for tc in sorted_tool_calls:
                        # Use the same encoded ID to match the tool_call in AIMessage
                        encoded_id = encode_tool_call_id(tc.tool_call_id)
                        if tc.response:
                            langchain_messages.append(ToolMessage(
                                content=tc.response.content,
                                tool_call_id=encoded_id
                            ))
                        else:
                            # If tool call has no response, add a default message
                            langchain_messages.append(ToolMessage(
                                content="tool was not invoked",
                                tool_call_id=encoded_id
                            ))
                else:
                    # Regular assistant message
                    langchain_messages.append(AIMessage(content=msg.content))
        
        return AgentState(
            messages=langchain_messages,
            session=self.session,
            business_plan=self.business_plan,
            chat_id=chat_id,
            remaining_steps=self.RECURSION_LIMIT
        )
    
    async def _process_event(self, event: StandardStreamEvent | CustomStreamEvent, user_id: UUID, chat_id: UUID) -> None:
        """
        Process LangGraph event and save to database.
        This method only handles persistence, not frontend streaming.
        """
        event_type = event["event"]
        # Save assistant message when LLM finishes
        if event_type == "on_chat_model_end":
            ai_message: AIMessage = event["data"]["output"]
            content = ai_message.content
            tool_calls = ai_message.tool_calls

            # Extract usage metadata - it's always present but may be None
            # usage_metadata is a TypedDict, use directly
            usage_metadata_dict = ai_message.usage_metadata if ai_message.usage_metadata is not None else {}

            
            # Save the assistant message (with or without tool calls)
            if content or tool_calls:
                assistant_message = Message(
                    chat_id=chat_id,
                    user_id=user_id,
                    content=content or "",
                    role=MessageRole.ASSISTANT,
                )
                self.session.add(assistant_message)
                await self.session.flush()
                
                # Track current message ID for tool responses
                self._current_message_id = assistant_message.id
                
                # Save tool calls attached to this message
                if tool_calls:
                    logger.info(f"Received {len(tool_calls)} tool call(s) for message_id={assistant_message.id}, chat_id={chat_id}")
                    for tc in tool_calls:
                        tool_call_record = ToolCall(
                            message_id=assistant_message.id,
                            tool_call_id=tc["id"],
                            tool_name=tc["name"],
                            tool_arguments=tc["args"],
                        )
                        self.session.add(tool_call_record)
                        logger.debug(
                            f"Saved tool call: tool_name={tc['name']}, "
                            f"tool_call_id={tc['id']}, "
                            f"args={tc['args']}"
                        )
                print(usage_metadata_dict)
                # Store usage metadata for saving at end of stream
                # Check if we have any meaningful usage data (at least one token count)
                if usage_metadata_dict and (
                    usage_metadata_dict.get("input_tokens") or 
                    usage_metadata_dict.get("output_tokens") or 
                    usage_metadata_dict.get("total_tokens")
                ):
                    logger.debug(f"Extracted usage_metadata: {usage_metadata_dict}")
                    self.llm_usage_events.append({
                        "usage_metadata": usage_metadata_dict,
                        "user_id": user_id,
                    })
                elif usage_metadata_dict:
                    logger.warning(f"Usage metadata found but no token counts: {usage_metadata_dict}")
                else:
                    logger.warning(f"No usage metadata found for message_id={assistant_message.id}, provider={self.provider}")
                
                await self.session.commit()
        
        # Save tool response when tool finishes
        elif event_type == "on_tool_end":
            tool_output: ToolMessage = event["data"]["output"]
            tool_call_id_str = tool_output.tool_call_id
            
            # Find the ToolCall scoped to current message (handles non-unique tool_call_ids)
            stmt = select(ToolCall).where(
                ToolCall.message_id == self._current_message_id,
                ToolCall.tool_call_id == tool_call_id_str
            )
            result = await self.session.execute(stmt)
            tool_call_record = result.scalar_one()
            
            # Save tool response linked to the ToolCall
            response_content = str(tool_output.content)
            tool_response = ToolResponse(
                tool_call_ref=tool_call_record.id,
                content=response_content,
            )
            self.session.add(tool_response)
            await self.session.commit()
            
            logger.info(
                f"Tool execution completed: tool_name={tool_call_record.tool_name}, "
                f"tool_call_id={tool_call_id_str}, "
                f"message_id={self._current_message_id}, "
                f"chat_id={chat_id}"
            )
            logger.debug(
                f"Tool response content (preview): {response_content[:200]}..."
                if len(response_content) > 200
                else f"Tool response content: {response_content}"
            )
        
        # Handle business plan update from custom event
        elif event_type == "on_custom_event" and event["name"] == "business_plan_updated":
            content = event["data"]["content"]
            # Update llm_content (not user_content) - LLM's changes go here
            self.business_plan.llm_content = content
            self.business_plan.updated_at = get_utc_now()
            self.session.add(self.business_plan)
            await self.session.commit()
    
    def _adapt_event_to_frontend(self, event: StandardStreamEvent | CustomStreamEvent) -> list[AgentMessageChunk]:
        """
        Adapt LangGraph event to frontend format for streaming.
        This method only handles frontend streaming, not persistence.
        
        Returns a list of chunks (can be empty, one, or multiple for parallel tool calls).
        """
        event_type = event["event"]
        chunks: list[AgentMessageChunk] = []
        
        if event_type == "on_chat_model_stream":
            chunk = event["data"]["chunk"]
            
            # Text streaming - extract text from chunk
            if chunk.content:
                text_content = ""
                if isinstance(chunk.content, str):
                    text_content = chunk.content
                elif isinstance(chunk.content, list):
                    for text in chunk.content:
                        content = text["text"] if isinstance(text, dict) else text
                        if content:
                            text_content += content
                
                if text_content:
                    chunks.append(AgentMessageChunk(type=MessageChunkTypes.RESPONSE, content=text_content))
            
            # Tool call streaming - detect when tool call generation starts
            if hasattr(chunk, 'tool_call_chunks') and chunk.tool_call_chunks:
                for tc_chunk in chunk.tool_call_chunks:
                    tool_name = tc_chunk.get('name')
                    tool_call_id = tc_chunk.get('id')
                    
                    # Send TOOL_START when we first see a tool call with a name
                    if tool_name and tool_call_id and tool_call_id not in self._sent_tool_starts:
                        self._sent_tool_starts.add(tool_call_id)
                        chunks.append(AgentMessageChunk(type=MessageChunkTypes.TOOL_START, content=tool_name))
        
        # Tool end notification (for UI to hide loading)
        elif event_type == "on_tool_end":
            tool_name = event["name"]
            chunks.append(AgentMessageChunk(type=MessageChunkTypes.TOOL_END, content=tool_name))
        
        # Custom event for business plan update
        elif event_type == "on_custom_event" and event["name"] == "business_plan_updated":
            content = event["data"]["content"]
            # Send llm_content to frontend for diff computation
            chunks.append(AgentMessageChunk(type=MessageChunkTypes.BUSINESS_PLAN_UPDATE, content=content))
        
        return chunks
    
    async def process_message(self, user_id: UUID, chat_id: UUID, message: str):
        """
        Process a user message - save it to database.
        
        Args:
            user_id: The ID of the user sending the message
            chat_id: The ID of the chat session
            message: The user's message content
        """
        user_message = Message(
            chat_id=chat_id,
            user_id=user_id,
            content=message,
            role=MessageRole.USER,
        )
        
        self.session.add(user_message)
        await self.session.commit()
    
    async def astream(self, user_id: UUID, chat_id: UUID) -> AsyncGenerator[AgentMessageChunk, None]:
        """
        Stream agent responses and yield message chunks.
        
        Args:
            user_id: The ID of the user
            chat_id: The ID of the chat session
            
        Yields:
            AgentMessageChunk: Message chunks to stream to the client
        """
        # Reset tracking for this stream session
        self._sent_tool_starts = set()
        self.llm_usage_events = []
        
        # Reset llm_content for new run (clone user_content)
        # This clears any pending changes from previous run
        self.business_plan.llm_content = self.business_plan.user_content
        self.session.add(self.business_plan)
        await self.session.commit()
        
        # Capture llm_content snapshot for system prompt (doesn't update during run)
        self._llm_content_snapshot = self.business_plan.llm_content
        
        # Check if there are existing messages (to determine if this is the first message)
        message_count_stmt = select(func.count(Message.id)).where(
            Message.chat_id == chat_id,
            Message.role == MessageRole.ASSISTANT
        )
        message_count_result = await self.session.execute(message_count_stmt)
        existing_assistant_messages = message_count_result.scalar_one()

        is_first_message = existing_assistant_messages == 0

        
        # Create agent state with session and business plan
        state = await self.create_agent_state(user_id, chat_id)
        config = RunnableConfig(configurable={"thread_id": str(chat_id)}, recursion_limit=self.RECURSION_LIMIT)
        
        # Stream events from the graph
        async for event in self.graph.astream_events(state, config=config, version="v2"):
            # Process event (save to database)
            await self._process_event(event, user_id, chat_id)
            
            # Adapt event to frontend format for streaming
            frontend_chunks = self._adapt_event_to_frontend(event)
            for chunk in frontend_chunks:
                yield chunk
        
        # After streaming completes, save all LLM requests
        if self.llm_usage_events:
            for event_data in self.llm_usage_events:
                usage_metadata = event_data["usage_metadata"]
                user_id_for_request = event_data["user_id"]
                
                input_tokens = usage_metadata.get("input_tokens", 0)
                output_tokens = usage_metadata.get("output_tokens", 0)
                
                # Extract cached input tokens
                cached_input_tokens = 0
                if "input_token_details" in usage_metadata:
                    cached_input_tokens = usage_metadata["input_token_details"].get("cache_read", 0)
                
                # Calculate actual input tokens (non-cached)
                actual_input_tokens = input_tokens - cached_input_tokens
                
                # Calculate cost
                usd_cost = calculate_llm_cost(self.provider, self.model, actual_input_tokens, cached_input_tokens, output_tokens)
                
                llm_request = LLMRequest(
                    user_id=user_id_for_request,
                    provider=self.provider,
                    model=self.model,
                    input_tokens=actual_input_tokens,
                    cached_input_tokens=cached_input_tokens,
                    output_tokens=output_tokens,
                    usd_cost=usd_cost,
                )
                self.session.add(llm_request)
            
            await self.session.commit()
        
        # After streaming completes, name the chat if it's the first message
        if is_first_message:
            await name_chat(state, self.session, chat_id)
