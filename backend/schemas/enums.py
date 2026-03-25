"""
Enum definitions
"""

import enum


class MessageRole(str, enum.Enum):
    """Message role enumeration"""
    USER = "user"
    ASSISTANT = "assistant"


class CompanyType(str, enum.Enum):
    """Company type enumeration"""
    IP = "ИП"  # Individual Entrepreneur
    TOO = "ТОО"  # Limited Liability Partnership
