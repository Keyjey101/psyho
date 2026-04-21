from fastapi import Depends, HTTPException, status
from app.middleware.auth import get_current_user
from app.config import get_settings

settings = get_settings()


async def get_admin_user(
    current_user=Depends(get_current_user),
):
    if current_user.email.lower() not in settings.admin_emails_list:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещён",
        )
    return current_user
