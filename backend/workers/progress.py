"""
Progress manager for tracking task progress in Redis
"""

import json
import time
from typing import Optional
import redis.asyncio as redis
from loguru import logger


class ProgressManager:
    """Manages progress updates for draft generation tasks in Redis"""
    
    def __init__(self, redis_client: redis.Redis, task_id: str):
        """
        Initialize progress manager.
        
        Args:
            redis_client: Redis client for storing progress
            task_id: Task ID for this progress tracking
        """
        self.redis_client = redis_client
        self.task_id = task_id
        self._start_time: float | None = None
        self._section_durations: list[float] = []
        self._last_section_time: float | None = None
    
    async def update_progress(
        self,
        current_section: int,
        completed_sections: list[int],
        total_sections: int,
    ) -> None:
        """
        Update task progress in Redis.
        
        Args:
            current_section: Current section being worked on (0 if all done)
            completed_sections: List of completed section numbers
            total_sections: Total number of sections
        """
        now = time.monotonic()

        # Initialize timing on first call
        if self._start_time is None:
            self._start_time = now
            self._last_section_time = now

        # Record duration for each newly completed section
        new_completed = len(completed_sections)
        while len(self._section_durations) < new_completed:
            duration = now - self._last_section_time
            self._section_durations.append(duration)
            self._last_section_time = now

        # Estimate remaining time based on average section duration so far
        if self._section_durations:
            avg_seconds = sum(self._section_durations) / len(self._section_durations)
            remaining = total_sections - new_completed
            estimated_seconds_remaining = int(avg_seconds * remaining)
        else:
            estimated_seconds_remaining = 0

        try:
            await self.redis_client.hset(
                f"task:{self.task_id}:progress",
                mapping={
                    "current_section": current_section,
                    "completed_sections": json.dumps(completed_sections),
                    "total_sections": total_sections,
                    "estimated_seconds_remaining": estimated_seconds_remaining,
                }
            )
            logger.debug(
                f"Updated progress for task {self.task_id}: "
                f"section {current_section}/{total_sections}, "
                f"completed: {len(completed_sections)}"
            )
        except Exception as e:
            logger.error(
                f"Failed to update progress for task {self.task_id}: {e}",
                exc_info=True
            )
            raise
    
    async def mark_completed(self, completed_sections: list[int], total_sections: int) -> None:
        """
        Mark task as completed in Redis.
        
        Args:
            completed_sections: List of all completed section numbers
            total_sections: Total number of sections
        """
        await self.update_progress(
            current_section=total_sections,
            completed_sections=completed_sections,
            total_sections=total_sections,
        )
        logger.info(f"Marked task {self.task_id} as completed")
    
    async def mark_failed(self, error: str) -> None:
        """
        Mark task as failed in Redis by storing error message.
        
        Args:
            error: Error message
        """
        try:
            await self.redis_client.hset(
                f"task:{self.task_id}:progress",
                mapping={
                    "error": error
                }
            )
            logger.info(f"Marked task {self.task_id} as failed: {error}")
        except Exception as e:
            logger.error(
                f"Failed to mark task {self.task_id} as failed: {e}",
                exc_info=True
            )

