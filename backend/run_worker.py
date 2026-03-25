#!/usr/bin/env python3
"""
Run script to start the ARQ worker
"""

from arq.worker import Worker
from arq.connections import RedisSettings
from config import ARQ_REDIS_URL
from workers.worker import generate_draft_task


if __name__ == "__main__":
    worker = Worker(
        functions=[generate_draft_task],
        redis_settings=RedisSettings.from_dsn(ARQ_REDIS_URL),
        max_jobs=3,  # Number of simultaneous coroutines
        job_timeout=3600,  # 1 hour timeout per task
        max_tries=1,
        allow_abort_jobs=True
    )
    worker.run()

