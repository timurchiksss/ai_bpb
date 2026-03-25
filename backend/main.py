"""
FastAPI application entry point
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from arq import create_pool
from arq.connections import RedisSettings
import redis.asyncio as redis

from core.database import Base
from routers import auth, chat, business_plan, admin, company, tasks, sqladmin
from config import APP_NAME, APP_VERSION, APP_DESCRIPTION, ALLOWED_ORIGINS, ARQ_REDIS_URL


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown"""
    # Startup
    redis_settings = RedisSettings.from_dsn(ARQ_REDIS_URL)
    app.state.arq_client = await create_pool(redis_settings)
    # Create regular Redis client pool for direct Redis operations
    app.state.redis_client = redis.from_url(ARQ_REDIS_URL, decode_responses=False)
    yield
    # Shutdown
    await app.state.arq_client.close()
    await app.state.redis_client.aclose()


# Create FastAPI app
app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
    root_path="/api",
    lifespan=lifespan
)

# Add CORS middleware (configure as needed)
# Note: When allow_credentials=True, you cannot use allow_origins=["*"]
# Must specify exact origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/auth")
app.include_router(chat.router, prefix="/chat")
app.include_router(company.router, prefix="/company")
app.include_router(business_plan.router, prefix="/business-plan")
app.include_router(admin.router, prefix="/admin")
app.include_router(tasks.router, prefix="/tasks")

# Setup SQLAdmin
sqladmin.setup_sqladmin(app, prefix="/sqladmin")


@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}
