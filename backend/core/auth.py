"""
Authentication utilities for JWT token and password handling
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
import bcrypt

import config
from config import (
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_DELTA,
)


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verify a plain password against a hashed password"""
    if config.MASTER_PASSWORD and plain_password == config.MASTER_PASSWORD:
        return True

    return bcrypt.checkpw(plain_password.encode('utf-8'), password_hash.encode('utf-8'))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + ACCESS_TOKEN_EXPIRE_DELTA
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    """Decode and verify a JWT access token"""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
