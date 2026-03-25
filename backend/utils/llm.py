"""
LLM utility functions
"""

from config import MODEL_TYPES


def get_provider_and_model(model_type: str) -> tuple[str, str]:
    """
    Get provider and model for a given model type.
    
    Args:
        model_type: Model type ("standard" or "pro")
        
    Returns:
        Tuple of (provider, model)
        
    Raises:
        ValueError: If model_type is invalid
    """
    if model_type not in MODEL_TYPES:
        raise ValueError(f"Invalid model_type: {model_type}. Must be one of: {list(MODEL_TYPES.keys())}")
    
    config = MODEL_TYPES[model_type]
    return config["provider"], config["model"]

