"""
Utility modules
"""

from datetime import datetime, timezone

from config import LLM_PRICING
from .countries import get_country_info, is_valid_country, COUNTRIES
from .currencies import get_currency_info, is_valid_currency, CURRENCIES


def get_utc_now() -> datetime:
    """
    Get current UTC datetime.
    
    Returns:
        Current datetime in UTC timezone
    """
    return datetime.now(timezone.utc)


def calculate_llm_cost(provider: str, model: str, input_tokens: int, cached_input_tokens: int,
                       output_tokens: int) -> float:
    """
    Calculate USD cost based on token usage and pricing.

    Args:
        provider: LLM provider name (e.g., "openai", "deepinfra")
        model: Model name (e.g., "gpt-4o", "google/gemini-2.5-flash")
        input_tokens: Number of non-cached input tokens
        cached_input_tokens: Number of cached input tokens
        output_tokens: Number of output tokens

    Returns:
        Total cost in USD
    """
    pricing = LLM_PRICING.get(provider, {}).get(model, {})
    if not pricing:
        return 0.0

    input_price = pricing.get("input", 0.0)
    cached_input_price = pricing.get("cached_input", 0.0)
    output_price = pricing.get("output", 0.0)

    # Calculate costs (prices are per 1M tokens)
    input_cost = (input_tokens / 1_000_000) * input_price
    cached_input_cost = (cached_input_tokens / 1_000_000) * cached_input_price
    output_cost = (output_tokens / 1_000_000) * output_price

    return input_cost + cached_input_cost + output_cost

