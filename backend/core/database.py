"""
Database configuration and session management
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from config import DATABASE_URL

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    # echo=True,
    future=True,
)

# Create session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    future=True,
)

# Base class for models
Base = declarative_base()


async def get_db():
    """Dependency for getting database session in FastAPI"""
    async with async_session() as session:
        yield session
