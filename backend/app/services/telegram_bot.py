import re
import hashlib
import structlog
from datetime import datetime, timezone

from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, CommandHandler, filters

from app.config import get_settings
from app.database import async_session
from app.models.models import TelegramVerificationCode, User

from sqlalchemy import select


def _sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()

logger = structlog.get_logger()
_settings = get_settings()
_application = None


async def _handle_message(update: Update, _context):
    text = (update.message.text or "").strip()
    tg_user = update.effective_user
    if not tg_user:
        return

    if not re.fullmatch(r"\d{6}", text):
        await update.message.reply_text(
            "Пришли мне 6-значный код, который ты видишь на экране."
        )
        return

    now = datetime.now(timezone.utc)

    async with async_session() as db:
        code_hash = _sha256_hex(text)
        # Try to find by hash first, fall back to plaintext for backward compatibility
        result = await db.execute(
            select(TelegramVerificationCode).where(
                TelegramVerificationCode.code_hash == code_hash,
                TelegramVerificationCode.verified == False,  # noqa: E712
                TelegramVerificationCode.used == False,  # noqa: E712
                TelegramVerificationCode.expires_at > now,
            )
        )
        record = result.scalar_one_or_none()
        if record is None:
            # Backward compatibility: lookup by plaintext code
            result = await db.execute(
                select(TelegramVerificationCode).where(
                    TelegramVerificationCode.code == text,
                    TelegramVerificationCode.code_hash == None,  # noqa: E711
                    TelegramVerificationCode.verified == False,  # noqa: E712
                    TelegramVerificationCode.used == False,  # noqa: E712
                    TelegramVerificationCode.expires_at > now,
                )
            )
            record = result.scalar_one_or_none()

        if record:
            record.verified = True
            record.telegram_id = str(tg_user.id)
            if tg_user.username and not record.telegram_username:
                record.telegram_username = tg_user.username.lower()
            await db.commit()
            await update.message.reply_text(
                "✅ Готово! Вернись на сайт — вход выполнен."
            )
            logger.info("tg_otp_verified", telegram_id=str(tg_user.id), request_id=record.id)
        else:
            await update.message.reply_text(
                "❌ Код не найден или истёк. Запроси новый на сайте."
            )


async def _handle_start(update: Update, _context):
    await update.message.reply_text(
        "Привет! Я бот для входа в Нику 🐻\n\n"
        "На сайте тебе покажут 6-значный код — просто отправь его мне сюда, "
        "и вход произойдёт автоматически."
    )


async def start_bot():
    global _application
    if not _settings.TELEGRAM_BOT_TOKEN:
        logger.warning("telegram_bot_token_not_set")
        return

    _application = (
        ApplicationBuilder()
        .token(_settings.TELEGRAM_BOT_TOKEN)
        .build()
    )

    _application.add_handler(CommandHandler("start", _handle_start))
    _application.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, _handle_message)
    )

    await _application.initialize()
    await _application.start()
    await _application.updater.start_polling(drop_pending_updates=True)
    logger.info("telegram_bot_started", bot_username=_settings.TELEGRAM_BOT_USERNAME)


async def stop_bot():
    global _application
    if _application is None:
        return
    try:
        if _application.updater and _application.updater.running:
            await _application.updater.stop()
        await _application.stop()
        await _application.shutdown()
    except Exception as e:
        logger.error("telegram_bot_stop_error", error=str(e))
    _application = None
