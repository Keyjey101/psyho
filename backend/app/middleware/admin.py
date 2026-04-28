from fastapi import Depends, HTTPException, status
from app.middleware.auth import get_current_user
from app.config import get_settings

settings = get_settings()


def _is_admin(user) -> bool:
    if user.email.lower() in settings.admin_emails_list:
        return True
    if user.telegram_username and user.telegram_username.lower() in settings.admin_telegram_usernames_list:
        return True
    return False


async def get_admin_user(
    current_user=Depends(get_current_user),
):
    if not _is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещён",
        )
    return current_user
