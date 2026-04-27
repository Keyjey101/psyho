# Plan: Telegram Mini App Integration

## Context

Приложение использует email-OTP авторизацию через httpOnly cookies (SameSite=Lax). В Telegram Mini App:
1. Пользователь уже известен через `window.Telegram.WebApp.initData` — email/OTP не нужны
2. httpOnly cookies ненадёжно работают в TMA webview (SameSite=Lax не отправляется при открытии внутри Telegram)
3. WebSocket читает токен только из cookies — в TMA не работает
4. Картинки на стартовой не загружаются — вероятно WebP не поддерживается конкретной версией Telegram, или требуется `WebApp.expand()` для корректного рендера

**Принцип**: веб-путь (email OTP) не меняется вообще. TMA — параллельный путь через `isTMA()` детектор.

---

## Backend: 3 файла + 1 миграция

### 1. `backend/app/config.py`
Добавить одну строку в класс Settings:
```python
TELEGRAM_BOT_TOKEN: str = ""
```

### 2. `backend/alembic/versions/005_telegram_auth.py` (новый)
```python
def upgrade():
    op.add_column('users', sa.Column('telegram_id', sa.String(20), nullable=True))
    op.create_index('ix_users_telegram_id', 'users', ['telegram_id'], unique=True)

def downgrade():
    op.drop_index('ix_users_telegram_id', 'users')
    op.drop_column('users', 'telegram_id')
```

### 3. `backend/app/models/models.py`
В класс `User` добавить поле:
```python
telegram_id: Mapped[str | None] = mapped_column(String(20), nullable=True, unique=True, index=True)
```

### 4. `backend/app/routers/auth.py`
Добавить новый endpoint `POST /api/auth/telegram`:

**Логика:**
1. Получить `init_data: str` из тела запроса
2. Валидировать подпись через HMAC-SHA256:
   - Разобрать init_data как query string
   - Извлечь `hash=`, остальное отсортировать и соединить `\n`
   - `secret = HMAC-SHA256(key="WebAppData", msg=BOT_TOKEN)`
   - `computed = HMAC-SHA256(key=secret, msg=data_check_string)`
   - Сравнить с `hash`
3. Парсить `user` из `initDataUnsafe` (после url-decode)
4. Найти user по `telegram_id` или создать нового:
   - Синтетический email: `tg_{telegram_id}@tg.local`
   - Синтетический password: `uuid.uuid4().hex` (не нужен для входа)
   - `user.name = first_name` из TG данных
5. Создать UserProfile если новый
6. Выпустить JWT токены через `create_access_token` / `create_refresh_token`
7. **Установить cookies** (как обычно) + **вернуть токены в теле ответа**:
   ```json
   { "access_token": "...", "refresh_token": "...", "is_new_user": true, "tg_name": "Иван" }
   ```

Если `TELEGRAM_BOT_TOKEN` пустой — вернуть 503 (не настроено).

### 5. `backend/app/routers/messages.py` — строка 136
```python
# ДО:
token = websocket.cookies.get("access_token")

# ПОСЛЕ:
token = websocket.cookies.get("access_token") or websocket.query_params.get("token")
```
Это единственное изменение в messages.py.

---

## Frontend: 5 файлов

### 1. `frontend/src/utils/telegram.ts` (новый файл)
```typescript
export const TG_TOKEN_KEY = "tg_access_token"
export const TG_REFRESH_KEY = "tg_refresh_token"

export const isTMA = (): boolean =>
  typeof window !== "undefined" && Boolean(window.Telegram?.WebApp?.initData)

export const getTelegramUser = () =>
  window.Telegram?.WebApp?.initDataUnsafe?.user

export const getInitData = (): string =>
  window.Telegram?.WebApp?.initData ?? ""

export const initTelegramApp = () => {
  if (!isTMA()) return
  window.Telegram.WebApp.ready()
  window.Telegram.WebApp.expand()
}
```

### 2. `frontend/src/store/auth.ts`
Добавить метод `telegramAuth`:
```typescript
telegramAuth: async (initData: string) => {
  const { data } = await api.post("/auth/telegram", { init_data: initData })
  localStorage.setItem(TG_TOKEN_KEY, data.access_token)
  localStorage.setItem(TG_REFRESH_KEY, data.refresh_token)
  set({ isAuthenticated: true, isLoading: false })
  try {
    const { data: userData } = await api.get("/user/me")
    set({ user: userData })
  } catch {}
  return data  // содержит is_new_user и tg_name
},
```

### 3. `frontend/src/api/client.ts`
Добавить **request interceptor** (после создания `api`):
```typescript
api.interceptors.request.use((config) => {
  const tgToken = localStorage.getItem("tg_access_token")
  if (tgToken) {
    config.headers.Authorization = `Bearer ${tgToken}`
  }
  return config
})
```

Модифицировать **response interceptor** (блок 401):
```typescript
// После неудачного refresh:
const tgRefresh = localStorage.getItem("tg_refresh_token")
if (tgRefresh) {
  try {
    const { data } = await api.post("/auth/refresh", { refresh_token: tgRefresh })
    localStorage.setItem("tg_access_token", data.access_token)
    if (data.refresh_token) localStorage.setItem("tg_refresh_token", data.refresh_token)
    error.config.headers.Authorization = `Bearer ${data.access_token}`
    return api(error.config)
  } catch {}
}
// ...затем текущая логика redirect
```

### 4. `frontend/src/App.tsx`
Добавить в `useEffect` (рядом с `checkAuth()`):
```typescript
useEffect(() => {
  if (isTMA()) {
    initTelegramApp()
    const initData = getInitData()
    if (initData) {
      telegramAuth(initData)
        .then((data) => {
          if (data.is_new_user) navigate("/onboarding")
          else navigate("/chat")
        })
        .catch(() => {
          // fallback: показать обычный auth
        })
    }
  } else {
    checkAuth()
  }
}, [])
```
Импортировать `{ isTMA, initTelegramApp, getInitData }` из `@/utils/telegram`.

### 5. `frontend/src/hooks/useChat.ts`
В функции `connect`, при формировании `wsUrl`:
```typescript
// ДО:
const wsUrl = `${wsBase}/api/sessions/${sessionId}/chat`

// ПОСЛЕ:
import { isTMA, TG_TOKEN_KEY } from "@/utils/telegram"
const tgToken = isTMA() ? localStorage.getItem(TG_TOKEN_KEY) : null
const wsUrl = `${wsBase}/api/sessions/${sessionId}/chat${tgToken ? `?token=${tgToken}` : ""}`
```

### 6. `frontend/src/pages/OnboardingFlow.tsx`
В `useEffect` компонента (или при инициализации `name`):
```typescript
useEffect(() => {
  if (!draft?.name && isTMA()) {
    const tgUser = getTelegramUser()
    if (tgUser?.first_name) {
      setName(tgUser.first_name)
    }
  }
}, [])
```

---

## Картинки — исправление

**Причина**: Telegram webview может не поддерживать WebP (старые версии) или изображения не рендерятся до вызова `WebApp.expand()`.

**Исправление 1** — `initTelegramApp()` (уже включено в plan выше) вызывает `expand()` — это фиксит большинство рендер-проблем.

**Исправление 2** — добавить `onError` fallback на PNG во всех `<img>` с WebP-изображениями:

Компоненты с WebP-картинками: `AuthEmail.tsx`, `Chat.tsx` (chat_welcome), компоненты landing (`Hero.tsx`, `Techniques.tsx`, `AgentSystem.tsx`).

Паттерн:
```tsx
<img
  src="/illustrations/opt/ai_avatar.webp"
  onError={(e) => { e.currentTarget.src = "/illustrations/ai_avatar.png" }}
  alt="..."
/>
```
PNG оригиналы находятся в `/public/illustrations/` (без `/opt/`).

---

---

## Связанные аккаунты в профиле

### Проблема
- Пользователь, зашедший через TMA, имеет синтетический email `tg_{id}@tg.local` — email не настоящий
- Пользователь, зашедший через email на сайте, не привязан к TG
- Нужно дать возможность связать аккаунты, чтобы один и тот же человек мог заходить с любого девайса

### Backend: 3 новых endpoint в `auth.py`

#### A. `POST /api/auth/link-telegram` (для email-пользователей)
- Требует авторизации (get_current_user)
- Принимает `{ init_data: str }`
- Валидирует подпись TG (та же логика что в `/auth/telegram`)
- Проверяет что `telegram_id` не занят другим пользователем → 409 если занят
- Записывает `user.telegram_id` и `user.telegram_username`
- Возвращает `{ ok: true }`

#### B. `POST /api/auth/link-email/send` (для TG-пользователей)
- Требует авторизации
- Принимает `{ email: str }`
- Проверяет что email не занят другим пользователем → 409 если занят
- Шлёт OTP через существующий `send_otp_email()` (тот же код что в `/auth/send-code`)
- Возвращает `{ ok: true }`

#### C. `POST /api/auth/link-email/verify` (для TG-пользователей)
- Требует авторизации
- Принимает `{ email: str, code: str }`
- Проверяет OTP через существующую таблицу `EmailVerificationCode` (та же логика что в `/auth/verify-code`)
- На успех: обновляет `user.email` с синтетического на настоящий, убирает синтетический пароль (ставит реальный или оставляет как есть)
- Возвращает `{ ok: true }`

### Backend: `/api/user/me` response

Добавить поля в ответ (в `routers/user.py` или schema):
- `telegram_username: str | None` — @ник в TG
- `has_real_email: bool` — `not user.email.endswith("@tg.local")`

### Backend: migration `005_telegram_auth.py`
Добавить в migration также `telegram_username`:
```python
op.add_column('users', sa.Column('telegram_username', sa.String(64), nullable=True))
```

### Backend: `models/models.py`
В User добавить ещё одно поле:
```python
telegram_username: Mapped[str | None] = mapped_column(String(64), nullable=True)
```

### Frontend: `Profile.tsx` — новый раздел "Аккаунты"

Разместить после текущих настроек, отдельным блоком:

```
┌─────────────────────────────────────┐
│  Связанные аккаунты                 │
│                                     │
│  📧 Email                           │
│  ✅ keyjey@gmail.com                │
│  — или —                            │
│  ⬜ не указан  [Привязать email]    │
│                                     │
│  ✈️ Telegram                        │
│  ✅ @username                       │
│  — или —                            │
│  ⬜ не привязан  [Привязать]        │
└─────────────────────────────────────┘
```

**Email-linking flow** (для TG-пользователей):
1. Клик "Привязать email" → инлайн-форма с полем email
2. Submit → `POST /api/auth/link-email/send` → показать поле для кода
3. Ввод кода → `POST /api/auth/link-email/verify` → обновить UI

**TG-linking flow** (для email-пользователей):
- Кнопка "Привязать Telegram" видна только если `isTMA()` — т.е. пользователь открыл профиль через TMA
- Клик → автоматически берём `initData` из `window.Telegram.WebApp` и шлём `POST /api/auth/link-telegram`
- Если не в TMA — показать текст "Откройте приложение через Telegram-бота"

---

## Переменные окружения (добавить на сервере)
```
TELEGRAM_BOT_TOKEN=<токен из @BotFather>
```

---

## Verifikation (тестирование)

1. **Веб-путь** — открыть сайт в браузере, войти через email/OTP → должно работать как прежде
2. **TMA-путь** — открыть через Telegram Mini App:
   - Должна сработать автоматическая авторизация без email
   - Новый пользователь → онбординг с предзаполненным именем
   - Существующий пользователь → сразу в чат
   - WebSocket чат должен работать
   - Картинки на стартовой должны загружаться
3. **Миграция** — `alembic upgrade head` без ошибок
4. **Подпись** — попытка передать поддельный `init_data` должна вернуть 401

---

## Критические файлы

| Файл | Изменение |
|------|-----------|
| `backend/app/config.py` | +1 поле |
| `backend/app/models/models.py` | +1 поле в User |
| `backend/alembic/versions/005_telegram_auth.py` | новый |
| `backend/app/routers/auth.py` | новый endpoint |
| `backend/app/routers/messages.py` | 1 строка (WS token) |
| `frontend/src/utils/telegram.ts` | новый |
| `frontend/src/store/auth.ts` | +1 метод |
| `frontend/src/api/client.ts` | +request interceptor, modify 401 handler |
| `frontend/src/App.tsx` | +TMA init в useEffect |
| `frontend/src/hooks/useChat.ts` | +token в WS URL |
| `frontend/src/pages/OnboardingFlow.tsx` | pre-fill name |
| Компоненты с img (3-4 файла) | onError PNG fallback |
