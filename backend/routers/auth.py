"""
Authentication API routes
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from schemas.sqlalchemy import User
from schemas.pydantic.user import UserRegister, UserLogin, UserResponse
from core.auth import hash_password, verify_password, create_access_token
from core.dependencies import get_current_user
from config import COOKIE_SETTINGS
from utils.telegram import send_telegram_notification
from datetime import datetime

router = APIRouter(tags=["authentication"])


@router.post("/register", response_model=UserResponse)
async def register(user_data: UserRegister, response: Response, db: AsyncSession = Depends(get_db)):
    """Register a new user and set JWT token in cookie"""
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Registration is disabled. Please use /register-request endpoint."
    )
    # Check if user already exists
    stmt = select(User).where(User.email == user_data.email)
    result = await db.execute(stmt)
    existing_user = result.scalars().first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create new user
    password_hash = hash_password(user_data.password)
    new_user = User(email=user_data.email, password_hash=password_hash)
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Create JWT token and set in cookie
    access_token = create_access_token(data={"sub": str(new_user.id), "email": new_user.email})
    response.set_cookie(
        key=COOKIE_SETTINGS["key"],
        value=access_token,
        max_age=COOKIE_SETTINGS["max_age"],
        httponly=COOKIE_SETTINGS["httponly"],
        samesite=COOKIE_SETTINGS["samesite"],
    )

    return new_user


@router.post("/login", response_model=UserResponse)
async def login(
    user_data: UserLogin, response: Response, db: AsyncSession = Depends(get_db)
):
    """Login user and set JWT token in cookie"""
    # Find user by email
    stmt = select(User).where(User.email == user_data.email)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Please wait for administrator activation.",
        )

    # Create JWT token and set in cookie
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    response.set_cookie(
        key=COOKIE_SETTINGS["key"],
        value=access_token,
        max_age=COOKIE_SETTINGS["max_age"],
        httponly=COOKIE_SETTINGS["httponly"],
        samesite=COOKIE_SETTINGS["samesite"],
    )

    return user


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user info from JWT token in cookie"""
    return current_user


@router.post("/register-request")
async def register_request(user_data: UserRegister, db: AsyncSession = Depends(get_db)):
    """Request registration - creates inactive account"""
    # Check if user already exists
    stmt = select(User).where(User.email == user_data.email)
    result = await db.execute(stmt)
    existing_user = result.scalars().first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create new user with is_active=False
    password_hash = hash_password(user_data.password)
    new_user = User(
        email=user_data.email,
        password_hash=password_hash,
        phone_number=user_data.phone_number,
        is_active=False
    )
    
    db.add(new_user)
    # Refresh to get the user ID before sending notification
    await db.flush()
    await db.refresh(new_user)

    # Send Telegram notification (must succeed before committing)
    # If this fails, the exception will cause SQLAlchemy to rollback the transaction
    phone_display = f"`+{new_user.phone_number}`" if new_user.phone_number else "Не указан"
    notification_message = f"""🔔 New Registration Request

Email: `{new_user.email}`
Phone: {phone_display}
User ID: `{new_user.id}`
"""
    await send_telegram_notification(notification_message)

    # Only commit if notification was sent successfully
    await db.commit()

    return {"message": "Registration request submitted. Your account will be activated by an administrator."}


@router.post("/logout")
async def logout(response: Response):
    """Logout user by clearing the JWT cookie"""
    response.delete_cookie(key=COOKIE_SETTINGS["key"])
    return {"message": "Logged out successfully"}
