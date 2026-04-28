import ssl
import structlog
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.config import get_settings

logger = structlog.get_logger()


def _build_otp_email(to_email: str, code: str) -> MIMEMultipart:
    settings = get_settings()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{code} — твой код для входа в Psyho"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email

    text_body = f"Твой код входа: {code}\n\nКод действителен {settings.OTP_EXPIRE_MINUTES} минут.\nЕсли ты не запрашивал(а) код — просто проигнорируй это письмо."
    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Inter, sans-serif; background: #FAF6F1; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 24px; padding: 40px; box-shadow: 0 2px 16px rgba(90,80,72,0.08);">
    <div style="text-align: center; margin-bottom: 32px;">
      <span style="font-size: 32px;">🌸</span>
      <h1 style="color: #5A5048; font-size: 22px; margin: 12px 0 4px;">Psyho</h1>
      <p style="color: #8A7A6A; font-size: 14px; margin: 0;">Твой код для входа</p>
    </div>
    <div style="background: #FAF6F1; border-radius: 16px; padding: 28px; text-align: center; margin-bottom: 28px;">
      <span style="font-size: 42px; font-weight: 700; letter-spacing: 10px; color: #B8785A; font-family: monospace;">{code}</span>
    </div>
    <p style="color: #8A7A6A; font-size: 13px; text-align: center; margin: 0;">
      Код действителен {settings.OTP_EXPIRE_MINUTES} минут.<br>
      Если ты не запрашивал(а) этот код — просто проигнорируй письмо.
    </p>
  </div>
</body>
</html>"""

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    return msg


async def send_otp_email(to_email: str, code: str) -> bool:
    settings = get_settings()

    if not settings.SMTP_HOST:
        logger.warning("SMTP not configured, skipping email", to=to_email, code=code)
        return True

    msg = _build_otp_email(to_email, code)

    try:
        tls_context = ssl.create_default_context() if settings.SMTP_TLS else None
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER or None,
            password=settings.SMTP_PASS or None,
            start_tls=settings.SMTP_TLS,
            tls_context=tls_context,
        )
        return True
    except Exception as e:
        logger.error("Failed to send OTP email", to=to_email, code=code, error=str(e))
        return False
