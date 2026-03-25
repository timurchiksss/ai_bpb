"""
Base Agent Abstract Class

Defines the common interface for agent implementations.
"""

from abc import ABC, abstractmethod
from sqlalchemy.ext.asyncio import AsyncSession
from typing import AsyncGenerator
from uuid import UUID

from agents.schemas import AgentMessageChunk


class BaseAgent(ABC):
    """
    Abstract base class for all agent implementations.

    All agent implementations must inherit from this class and implement
    the required abstract methods.
    """

    def __init__(self, session: AsyncSession):
        """
        Initialize the agent with a database session.

        Args:
            session: AsyncSession for database operations
        """
        self.session = session

    @abstractmethod
    async def astream(self, user_id: UUID, chat_id: UUID) -> AsyncGenerator[AgentMessageChunk, None]:
        """
        Process a user message and generate a response.

        Args:
            user_id: The ID of the user sending the message
            chat_id: The ID of the chat session

        Yields:
            AgentMessageChunk: Message chunks to stream to the client
        """
        yield

    @abstractmethod
    async def process_message(self, user_id: UUID, chat_id: UUID, message: str) -> None:
        """
        Add a user message to the database.

        Args:
            user_id: The ID of the user sending the message
            chat_id: The ID of the chat session
            message: The message to process
        """
        pass