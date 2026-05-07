"""Telegram-bot notification helpers.

We deliberately do not send any email — billing communication runs only via
the bot. If the user has neither ``notify_telegram_id`` nor ``telegram_id``,
the message is dropped with a warning; the UI prompts them to bind TG.
"""
from __future__ import annotations

from typing import Optional

import httpx
import structlog

from app.config import get_settings
from app.models.models import User

logger = structlog.get_logger()


def _resolve_chat_id(user: User) -> Optional[str]:
    return user.notify_telegram_id or user.telegram_id


async def send_to_chat(chat_id: str, text: str, *, reply_markup: Optional[dict] = None) -> bool:
    s = get_settings()
    if not s.TELEGRAM_BOT_TOKEN:
        logger.warning("telegram_bot_token_missing")
        return False
    payload: dict = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    url = f"https://api.telegram.org/bot{s.TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code >= 400:
                logger.warning("telegram_send_failed", chat_id=chat_id, status=resp.status_code, body=resp.text)
                return False
            return True
    except Exception as e:
        logger.error("telegram_send_exception", error=str(e))
        return False


async def notify_user(user: User, text: str, *, manage_url: Optional[str] = None) -> bool:
    chat_id = _resolve_chat_id(user)
    if not chat_id:
        logger.info("notify_dropped_no_channel", user_id=user.id)
        return False
    reply_markup = None
    if manage_url:
        reply_markup = {
            "inline_keyboard": [[{"text": "Управлять подпиской", "url": manage_url}]]
        }
    return await send_to_chat(chat_id, text, reply_markup=reply_markup)
