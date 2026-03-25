"""
Utility functions for agents
"""

import hashlib
import re
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
from uuid import UUID
from loguru import logger

from agents.schemas import AgentState
from schemas.sqlalchemy import Chat, Message
from schemas.enums import MessageRole
from utils import get_utc_now
from config import LLM_PROVIDERS


def encode_tool_call_id(tool_call_id_str: str) -> str:
    """
    Encode a tool_call_id string to a deterministic 22-character alphanumeric ID.
    Uses SHA256 hash + base62 encoding to ensure same input produces same output.
    
    Args:
        tool_call_id_str: The original tool_call_id string from database
        
    Returns:
        A string in format: call_{22_base62_chars}
    """
    # Base62 alphabet: 0-9, a-z, A-Z
    BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    
    # Hash the input string
    hash_bytes = hashlib.sha256(tool_call_id_str.encode()).digest()
    
    # Convert hash bytes to a large integer
    num = int.from_bytes(hash_bytes, byteorder='big')
    
    # Encode to base62, taking exactly 22 characters
    encoded = []
    for _ in range(22):
        num, remainder = divmod(num, 62)
        encoded.append(BASE62_ALPHABET[remainder])
    
    # Reverse to get the correct order (most significant first)
    encoded_str = ''.join(reversed(encoded))
    
    return f"call_{encoded_str}"


async def name_chat(state: AgentState, session: AsyncSession, chat_id: UUID) -> None:
    """
    Name chat node that generates a chat name using GPT-4.1-mini.
    Only renames the chat on the first assistant response.
    
    Args:
        state: The agent state containing messages
        session: Database session to use
        chat_id: The chat ID to name
    """
    logger.info(f"Starting chat naming for chat_id={chat_id}")
    
    if not chat_id:
        logger.warning("Chat ID is None, skipping chat naming")
        return
    
    # Load messages from database to get the actual conversation
    logger.debug(f"Loading messages from database for chat_id={chat_id}")
    stmt = (
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.created_at.asc())
    )
    result = await session.execute(stmt)
    db_messages = result.scalars().all()
    
    # Count assistant messages - only rename on first assistant response
    assistant_message_count = sum(1 for msg in db_messages if msg.role == MessageRole.ASSISTANT)
    logger.debug(f"Found {assistant_message_count} assistant messages in database")
    
    if assistant_message_count > 1:
        logger.info(f"Skipping chat naming: not first message (found {assistant_message_count} assistant messages)")
        return
    
    if assistant_message_count == 0:
        logger.warning("No assistant messages found in database, skipping naming")
        return
    
    # Get the first user message and first assistant response for context
    user_message = None
    assistant_message = None
    
    for msg in db_messages:
        if msg.role == MessageRole.USER and user_message is None:
            user_message = msg.content
            logger.debug(f"Found user message: {user_message[:100]}...")
        elif msg.role == MessageRole.ASSISTANT and assistant_message is None:
            assistant_message = msg.content
            logger.debug(f"Found assistant message: {assistant_message[:100]}...")
        
        # Once we have both, we can stop
        if user_message and assistant_message:
            break
    
    # If we don't have both messages, skip naming
    if not user_message or not assistant_message:
        logger.warning(f"Missing messages for naming: user_message={'present' if user_message else 'missing'}, assistant_message={'present' if assistant_message else 'missing'}")
        return
    
    # Create prompt for naming
    naming_prompt = f"""Based on the following conversation, generate a short, descriptive title for this chat (maximum 50 characters, in the same language as the conversation):

User: {user_message[:200]}
Assistant: {assistant_message[:200]}

Generate only the title, nothing else."""
    
    logger.debug(f"Created naming prompt with user message ({len(user_message)} chars) and assistant message ({len(assistant_message)} chars)")
    
    try:
        # Initialize GPT-4.1-mini for chat naming
        openai_config = LLM_PROVIDERS.get("openai", {})
        logger.debug("Initializing GPT-4.1-mini for chat naming")
        
        name_llm = ChatOpenAI(
            model="gpt-4.1-mini",
            api_key=openai_config.get("api_key"),
            base_url=openai_config.get("base_url"),
            streaming=False,
            temperature=0.7,
        )
        
        # Call GPT-4.1-mini to generate the name
        logger.info("Calling GPT-4.1-mini to generate chat name")
        response = await name_llm.ainvoke([SystemMessage(content=naming_prompt)])
        chat_name = response.content.strip()
        logger.info(f"Received chat name from LLM: {chat_name}")
        
        # Limit to 255 characters (database limit) and clean up
        chat_name = chat_name[:255].strip()
        if not chat_name:
            logger.warning("Generated chat name is empty after stripping")
            return
        
        logger.debug(f"Final chat name (after truncation): {chat_name}")

        # Update chat title in database
        logger.debug(f"Querying chat from database for chat_id={chat_id}")
        stmt = select(Chat).where(Chat.id == chat_id)
        result = await session.execute(stmt)
        chat = result.scalar_one()
        logger.debug(f"Found chat: id={chat.id}, current_title={chat.title}")
        
        old_title = chat.title
        chat.title = chat_name
        session.add(chat)
        logger.info(f"Updating chat title from '{old_title}' to '{chat_name}'")
        
        await session.commit()
        logger.success(f"Successfully updated chat {chat_id} title to '{chat_name}'")
    except Exception as e:
        # If naming fails, just continue without updating the name
        # Log error but don't break the flow
        logger.error(f"Error naming chat {chat_id}: {e}", exc_info=True)


def parse_content_tag(llm_output: str) -> Optional[str]:
    """
    Extract content from <content></content> XML tag.
    
    Handles:
    - Multiple content tags (takes first)
    - Missing tags (returns None)
    - Nested tags
    - Whitespace normalization
    
    Args:
        llm_output: The raw output from LLM
        
    Returns:
        Extracted content string, or None if parsing fails
    """
    if not llm_output:
        return None
    
    # Try to find content tag (case-insensitive, handles whitespace)
    pattern = r'<content>(.*?)</content>'
    match = re.search(pattern, llm_output, re.DOTALL | re.IGNORECASE)
    
    if match:
        content = match.group(1).strip()
        if content:
            return content
    
    return None
