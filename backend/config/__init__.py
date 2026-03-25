"""
Application configuration and constants
"""
import json
import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables from backend directory
load_dotenv()

# Database Configuration
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")

DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DELTA = timedelta(weeks=1)
MASTER_PASSWORD = os.getenv("MASTER_PASSWORD")

# Application Configuration
APP_NAME = "Finance AI Backend"
APP_VERSION = "0.1.0"
APP_DESCRIPTION = "Backend API for Finance AI application"

# CORS Configuration
IS_LOCAL = True
if IS_LOCAL:
    ALLOWED_ORIGINS = [
        "http://localhost:3000",
    ]
else:
    ALLOWED_ORIGINS = [
        "https://storge.agartu.space",
    ]

# Cookie Configuration
COOKIE_SETTINGS = {
    "key": "access_token",
    "httponly": True,
    "secure": not IS_LOCAL,
    "samesite": "lax",
    "max_age": ACCESS_TOKEN_EXPIRE_DELTA.total_seconds(),
}

# LLM Providers Configuration
LLM_PROVIDERS = {
    "openai": {
        "api_key": os.getenv("OPENAI_API_KEY"),
        "base_url": "https://api.openai.com/v1",
        "models": [
            # "gpt-5.2",
            "gpt-5.1",
            # "gpt-5",
            # "gpt-5-mini",
            # "gpt-5-nano",
            # "gpt-4.1",
            # "gpt-4.1-mini",
            # "gpt-4o",
            # "gpt-4o-mini",
        ]
    },
    # "deepinfra": {
    #     "api_key": os.getenv("DEEPINFRA_API_KEY"),
    #     "base_url": "https://api.deepinfra.com/v1/openai",
    #     "models": [
    #         "deepseek-ai/DeepSeek-V3.1-Terminus",
    #         "google/gemma-2-27b-it",
    #         "google/gemini-2.5-flash",
    #         "google/gemini-2.5-pro",
    #         "anthropic/claude-4-sonnet",
    #         "anthropic/claude-4-opus",
    #     ]
    # },
    "z_ai": {
        "api_key": os.getenv("Z_AI_API_KEY"),
        "base_url": "https://api.z.ai/api/coding/paas/v4",
        "models": [
            "GLM-4.7",
            # "GLM-5",
        ]
    },
}

# LLM Pricing Configuration (USD per 1M tokens)
# Format: {provider: {model: {"input": price_per_1M, "output": price_per_1M, "cached_input": price_per_1M}}}
LLM_PRICING = {
    "openai": {
        "gpt-5.2": {"input": 1.75, "output": 14.00, "cached_input": 0.175},
        "gpt-5.1": {"input": 1.25, "output": 10.00, "cached_input": 0.125},
        "gpt-5-mini": {"input": 0.25, "output": 2.00, "cached_input": 0.025},
        "gpt-5-nano": {"input": 0.05, "output": 0.40, "cached_input": 0.005},
        "gpt-4.1": {"input": 2.00, "output": 8.00, "cached_input": 0.50},
        "gpt-4.1-mini": {"input": 0.40, "output": 1.60, "cached_input": 0.10},
        "gpt-4o": {"input": 2.50, "output": 10.00, "cached_input": 1.25},
        "gpt-4o-mini": {"input": 0.15, "output": 0.60, "cached_input": 0.075},
        "gpt-4-turbo": {"input": 10.00, "output": 30.00, "cached_input": 5.00},
        "gpt-4": {"input": 30.00, "output": 60.00, "cached_input": 15.00},
        "gpt-3.5-turbo": {"input": 0.50, "output": 1.50, "cached_input": 0.25},
    },
    "deepinfra": {
        "deepseek-ai/DeepSeek-V3.1-Terminus": {"input": 0.21, "output": 0.79, "cached_input": 0.168},
        "google/gemma-2-27b-it": {"input": 0.10, "output": 0.10, "cached_input": 0.05},
        "google/gemini-2.5-flash": {"input": 0.30, "output": 2.50, "cached_input": 0},
        "google/gemini-2.5-pro": {"input": 1.25, "output": 10.00, "cached_input": 0},
        "anthropic/claude-4-sonnet": {"input": 3.30, "output": 16.50, "cached_input": 0.33},
        "anthropic/claude-4-opus": {"input": 16.50, "output": 82.50, "cached_input": 0},
    },
    "z_ai": {
        "GLM-5": {"input": 1.00, "output": 3.20, "cached_input": 0.20},
        "GLM-4.7": {"input": 0.60, "output": 2.20, "cached_input": 0.11},
    }
}

# Business Plan Configuration
# OKED (Общереспубликанский классификатор видов экономической деятельности) classifier data
with open("config/oked_classifier.json", "r", encoding="utf-8") as f:
    OKED_CLASSIFIER = json.loads(f.read())

# Astana Hub priority ICT activities list (приоритетные виды деятельности в области ИКТ)
with open("config/astana_hub_priority_activities.json", "r", encoding="utf-8") as f:
    ASTANA_HUB_PRIORITY_ACTIVITIES = json.loads(f.read())

# Business Plan Constraints
MAX_PARTICIPATION_PERIOD_YEARS = 4  # Максимальный срок участия в технопарке в годах

# Redis Configuration
REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = int(os.getenv("REDIS_PORT"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
REDIS_DB = int(os.getenv("REDIS_DB"))

# ARQ Configuration
ARQ_REDIS_URL = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"

# Telegram Configuration
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

# Model Type Configuration
# Maps model types (standard/pro) to provider and model
MODEL_TYPES = {
    "standard": {
        "provider": "z_ai",
        "model": "GLM-4.7"
    },
    "pro": {
        "provider": "openai",
        "model": "gpt-5.1"
    }
}