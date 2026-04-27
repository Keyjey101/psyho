# Plan: Telegram OTP Authentication

## Context
Email OTP auth is blocked because the VPS provider blocked port 25 and requires documentation to unblock SMTP. Telegram OTP replaces email as the primary auth method: user enters their Telegram @username on the site → a 6-digit code appears on screen → user sends that code to the bot → frontend polls for verification → JWT tokens issued. Email remains available as a secondary/legacy path.

## Architecture

```
User → /auth page → types @username → POST /api/auth/tg/request-code
                                       ↓
                                  generates 6-digit code
                                  stores TelegramVerificationCode(request_id, code_plaintext, tg_username, expires_at)
                                       ↓ returns { request_id, code, bot_username }
                                       
User sees code on screen → opens t.me/{bot_username} → sends "123456"
                                       ↓
                              Bot handler (same process, long polling)
                              looks up pending code (plaintext match)
                              marks verified=True, stores telegram_id
                                       ↓
Frontend polls GET /api/auth/tg/check/{request_id} every 2s
  → when verified: issues JWT, marks used=True, creates User if new
  → navigate to /onboarding or /chat
```

## Files to Create/Modify

### Backend

**`backend/pyproject.toml`**
- Add `"python-telegram-bot>=21.0"` to dependencies

**`backend/app/config.py`**
- Add `TELEGRAM_BOT_USERNAME: str = ""` (e.g. "PsyHoBot" — for clickable t.me link)

**`backend/app/models/models.py`**
- Add `TelegramVerificationCode` model:
  ```python
  id (UUID PK = request_id)
  telegram_username: str | None   # what user typed, nullable
  code: str                       # 6-digit plaintext (short-lived, bot does direct match)
  telegram_id: str | None         # numeric Telegram ID, filled by bot on verification
  created_at: datetime
  expires_at: datetime
  verified: bool = False
  used: bool = False              # True after JWT issued (prevents replay)
  ```

**`backend/app/schemas/auth.py`**
- Add:
  - `TgRequestCodeRequest` — `{ telegram_username: str | None }`
  - `TgRequestCodeResponse` — `{ request_id, code, bot_username, expires_in }`
  - `TgCheckResponse` — `{ status: "pending"|"verified"|"expired", access_token?, refresh_token?, is_new_user? }`

**`backend/app/routers/auth.py`**
- Add two new endpoints mounted under the existing auth router:
  - `POST /tg/request-code`:
    - Normalize username (strip @, lowercase, nullable)
    - Rate limit: max 5 requests per IP per 10 min
    - Generate 6-digit code (plaintext)
    - Delete old unused codes for same username if any
    - Create `TelegramVerificationCode` record (10-min TTL)
    - Return `{ request_id, code, bot_username: settings.TELEGRAM_BOT_USERNAME, expires_in: 600 }`
  - `GET /tg/check/{request_id}`:
    - Look up record; 404 if not found
    - If expired and not verified → return `{ status: "expired" }`
    - If not verified → return `{ status: "pending" }`
    - If verified and not used:
      - Mark `used = True`
      - Find User by `telegram_id`; if none → create User (synthetic email `tg_{id}@tg.local`) + UserProfile
      - Issue access + refresh JWT tokens, set cookies
      - Return `{ status: "verified", access_token, refresh_token, is_new_user }`

**`backend/app/services/telegram_bot.py`** (NEW)
- Builds `python-telegram-bot` Application with long polling
- Message handler:
  1. Get `update.effective_user` (username and numeric id)
  2. If message text is 6 digits, look up matching unexpired, unverified `TelegramVerificationCode` by plaintext code (the code is unique since it's UUID-scoped)
  3. If found: set `verified=True`, `telegram_id=str(tg_user.id)`, commit
  4. Reply: "✅ Готово! Вернись на сайт — вход выполнен." or "❌ Код не найден или истёк."
  5. Add `/start` handler: sends greeting explaining the bot's purpose
- Exports `start_bot()` and `stop_bot()` coroutines for lifespan integration
- DB sessions: use `async_session()` from `app.database` inside each handler

**`backend/app/main.py`**
- In the `lifespan` context manager: if `settings.TELEGRAM_BOT_TOKEN` is set, call `start_bot()` before `yield`, `stop_bot()` after `yield`
- Import from `app.services.telegram_bot`

**`backend/alembic/versions/006_telegram_otp.py`** (NEW migration)
- Create table `telegram_verification_codes`:
  - `id VARCHAR(36) PK`
  - `telegram_username VARCHAR(64) nullable, index`
  - `code VARCHAR(6) NOT NULL`
  - `telegram_id VARCHAR(20) nullable`
  - `created_at DATETIME`
  - `expires_at DATETIME`
  - `verified BOOLEAN NOT NULL DEFAULT 0`
  - `used BOOLEAN NOT NULL DEFAULT 0`
- `down_revision = "005_telegram_auth"`

### Frontend

**`frontend/src/store/auth.ts`**
- Add to `AuthState` interface and implementation:
  - `requestTgCode(username: string): Promise<{ request_id: string; code: string; bot_username: string }>`
    - Calls `POST /auth/tg/request-code`
  - `checkTgCode(requestId: string): Promise<{ status: string; is_new_user?: boolean }>`
    - Calls `GET /auth/tg/check/{requestId}`
    - If status is "verified": set `isAuthenticated: true`, fetch user, return data

**`frontend/src/pages/AuthTelegram.tsx`** (NEW)
- Step 1 (input screen):
  - Telegram icon in header, title "Поговорим?", subtitle "Войди через Telegram"
  - Optional @username input (placeholder: "@username")
  - Button "Получить код"
  - Small link at bottom: "Войти по email →" → `/auth/email`
- Step 2 (code display screen):
  - Title "Твой код"
  - Large prominent display of 6 digits (monospace, styled)
  - Clickable CTA button: "Написать боту @{bot_username}" → `https://t.me/{bot_username}` (target="_blank")
  - Instruction text: "Отправь этот код боту — и вход выполнится автоматически"
  - Countdown timer (10 min) + "Получить новый код" after expiry
  - Background polling every 2s via `setInterval` calling `checkTgCode`
  - On verified: navigate to `/onboarding` or `/chat`
  - On expired: show "Код истёк, запроси новый" + back to step 1
  - Back button to step 1

**`frontend/src/App.tsx`**
- Import `AuthTelegram`
- Change `<Route path="/auth" element={<AuthEmail />} />` → `<Route path="/auth" element={<AuthTelegram />} />`
- Add `<Route path="/auth/email" element={<AuthEmail />} />` (keep email as fallback)
- Keep `/auth/verify` → `<AuthVerify />` unchanged

**`frontend/src/components/landing/UserGuide.tsx`**
- Update first card:
  - `title`: `"Вход через Telegram"`
  - `body`: `"Нажми «Войти», укажи свой ник в Telegram — на экране появится 6-значный код. Отправь его боту @{BOT_USERNAME}. Пароль не нужен."`
  - Since bot_username isn't available at build time without a separate API call, hardcode the bot username from `import.meta.env.VITE_TG_BOT_USERNAME` with fallback text or leave as "боту Ника"
  - Keep the same image (`guide_email.webp`) until a Telegram illustration is added

## Environment Variables to Add
```
# backend/.env
TELEGRAM_BOT_TOKEN=<your bot token from @BotFather>
TELEGRAM_BOT_USERNAME=PsyHoBot   # without @

# frontend/.env (for guide text)
VITE_TG_BOT_USERNAME=PsyHoBot
```

## Verification
1. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME` in `.env`
2. Run `alembic upgrade head` — migration 006 creates the table
3. Start backend: bot should log "Telegram bot started, polling"
4. Open frontend `/auth` → see Telegram login (not email)
5. Enter any username → get code displayed on screen
6. Send code to bot in Telegram → bot replies "✅ Готово!"
7. Frontend auto-navigates to `/chat` or `/onboarding`
8. Check `/auth/email` still works as fallback
9. Check landing page guide shows "Вход через Telegram" card with correct bot name
