"""
SQLAdmin router - provides admin interface for database models
"""
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from starlette.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
import jose

import config
from core.database import async_session, engine
from schemas.sqlalchemy import User
from core.auth import decode_access_token


class AdminAuthBackend(AuthenticationBackend):
    """Authentication backend for SQLAdmin using existing JWT cookie authentication"""

    async def login(self, request: Request) -> bool:
        """Handle login - redirect to root if not authenticated"""
        # No email/password login in SQLAdmin - use existing token
        # If not authenticated, redirect to root
        if not await self.authenticate(request):
            return RedirectResponse(url="/", status_code=302)
        return True

    async def logout(self, request: Request) -> bool:
        """Handle logout - redirect to root"""
        # Redirect to root
        return RedirectResponse(url="/", status_code=302)

    async def authenticate(self, request: Request) -> bool:
        """Check if user is authenticated and is an admin"""
        # Get access token from cookie
        access_token = request.cookies.get("access_token")
        
        if not access_token:
            return False

        try:
            # Decode token
            payload = decode_access_token(access_token)
            user_id = payload.get("sub")
            
            if not user_id:
                return False

            # Convert to UUID
            try:
                user_id = UUID(user_id)
            except (ValueError, TypeError):
                return False

            # Get user from database
            async with async_session() as session:
                stmt = select(User).where(User.id == user_id)
                result = await session.execute(stmt)
                user = result.scalars().first()

                if not user:
                    return False

                # Check if user is active
                if not user.is_active:
                    return False

                # Check if user is admin
                if not user.is_admin:
                    return False

                return True

        except (jose.JWTError, Exception):
            return False


def setup_sqladmin(app, prefix: str = "/sqladmin") -> Admin:
    """
    Setup SQLAdmin and register models.
    
    Args:
        app: FastAPI application instance
        prefix: URL prefix for the admin panel
        
    Returns:
        Admin instance
    """
    # Create authentication backend
    admin_auth = AdminAuthBackend(secret_key=config.SECRET_KEY)
    
    # Create admin instance
    admin = Admin(
        app=app,
        engine=engine,
        authentication_backend=admin_auth,
        base_url=prefix,
        title="Admin Panel",
    )

    # Register models
    class UserAdmin(ModelView, model=User):
        """Admin view for User model"""
        column_list = [User.id, User.email, User.phone_number, User.is_admin, User.is_active, User.created_at]
        column_searchable_list = [User.email, User.phone_number]
        column_sortable_list = [User.email, User.created_at, User.is_active, User.is_admin]
        can_create = False  # Disable creation via admin panel (use registration request)
        can_edit = True
        can_delete = False  # Disable deletion via admin panel
        can_view_details = True
        name = "User"
        name_plural = "Users"
        icon = "fa-solid fa-user"

    admin.add_view(UserAdmin)
    
    return admin

