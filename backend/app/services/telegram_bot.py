import re
import hashlib
import structlog
from datetime import datetime, timezone

from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, CommandHandler, filters

from app.config import get_settings
from app.database import async_session
from app.models.models import TelegramVerificationCode, User
from app.services import attribution, events

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


async def _handle_start(update: Update, context):
    args = getattr(context, "args", None) or []
    deep_link = args[0] if args else ""

    if deep_link.startswith("link_"):
        token = deep_link[len("link_"):]
        chat_id = str(update.effective_user.id)
        async with async_session() as db:
            result = await db.execute(select(User).where(User.notify_link_token == token))
            user = result.scalar_one_or_none()
            if user is None:
                await update.message.reply_text(
                    "❌ Эта ссылка устарела. Открой раздел «Подписка» на сайте и попробуй ещё раз."
                )
                return
            user.notify_telegram_id = chat_id
            user.notify_link_token = None
            if not user.telegram_username and update.effective_user.username:
                user.telegram_username = update.effective_user.username.lower()
            await db.commit()
        await update.message.reply_text(
            "✅ Готово — теперь буду писать сюда о статусе подписки."
        )
        return

    await _record_start_attribution(update, deep_link)

    await update.message.reply_text(
        "Привет! Я Ника — ИИ-собеседник для самоанализа и поддержки 🐻\n\n"
        "Сразу честно: с тобой общается искусственный интеллект, а не живой человек. "
        "Это не медицинская помощь и не замена специалисту.\n\n"
        "Нажми кнопку ниже, чтобы открыть приложение 👇\n\n"
        "⬇️ ⬇️ ⬇️"
    )


async def _record_start_attribution(update: Update, deep_link: str) -> None:
    """Resolve the /start payload to a campaign and log bot_start / repeat_start.

    Four cases, per spec:
      1. Payload is a known/new campaign code → resolve it.
      2. User is new (no account yet) → park attribution against telegram_id.
      3. User already exists → attribution is never touched; if they arrived via
         a *different* code, that's a ``repeat_start``.
      4. Payload missing or unparseable → ``organic``.
    """
    tg_user = update.effective_user
    if not tg_user:
        return
    telegram_id = str(tg_user.id)

    code = attribution.normalize_code(deep_link)
    if code is None and deep_link and not deep_link.startswith("link_"):
        logger.info("tg_start_unparseable_payload", telegram_id=telegram_id)

    try:
        async with async_session() as db:
            if code:
                campaign = await attribution.get_or_create_campaign(
                    db, code, channel_name=code, origin="auto_created"
                )
                resolved_code = campaign.code
            else:
                resolved_code = attribution.ORGANIC_CODE
                await attribution.ensure_organic(db)

            user_q = await db.execute(select(User).where(User.telegram_id == telegram_id))
            user = user_q.scalar_one_or_none()

            if user is None:
                # No account yet — park the code so registration can claim it.
                await attribution.stash_pending(db, telegram_id, resolved_code)
                await events.log_event(
                    events.EVENT_BOT_START,
                    anon_id=anon_id_for(telegram_id),
                    campaign_code=resolved_code,
                    db=db,
                )
            else:
                first_touch = user.campaign_code
                if not first_touch:
                    # Pre-existing account from before attribution shipped.
                    attribution.apply_first_touch(user, resolved_code)
                    await events.log_event(
                        events.EVENT_BOT_START,
                        user_id=user.id,
                        campaign_code=resolved_code,
                        db=db,
                    )
                elif code and resolved_code != first_touch:
                    # Attribution stays with the original channel — log only.
                    await events.log_event(
                        events.EVENT_REPEAT_START,
                        user_id=user.id,
                        campaign_code=resolved_code,
                        db=db,
                        payload={"source": first_touch},
                    )
                else:
                    await events.log_event(
                        events.EVENT_REPEAT_START,
                        user_id=user.id,
                        campaign_code=first_touch,
                        db=db,
                    )
            await db.commit()
    except Exception as e:
        logger.warning("tg_start_attribution_failed", error=str(e))


def anon_id_for(telegram_id: str) -> str:
    """Pseudonymous id for pre-registration events.

    Telegram ids never enter the analytics tables in the clear — a salted hash
    keeps the event joinable to the later user row without storing the identifier.
    """
    salt = _settings.SECRET_KEY
    return "tg_" + hashlib.sha256(f"{salt}:{telegram_id}".encode()).hexdigest()[:32]


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
