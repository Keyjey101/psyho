# PsyHo — Снимок проекта для агентной системы

## Суть проекта

PsyHo — ИИ-психолог «Ника». Мультиагентная система: оркестратор классифицирует тему сообщения, параллельно вызывает 1–2 специалиста (из 6), синтезирует единый ответ и стримит его токен за токеном через WebSocket. Есть кризисный детектор — при суицидальных ключевых словах немедленно возвращает контакты помощи без вызова агентов.

## Архитектура

```
Интернет → Внешний nginx (SSL/certbot) → localhost:APP_PORT
  └── Docker frontend-контейнер (nginx :80)
        ├── /api/* → proxy → backend:8000 (expose only)
        ├── /ws/*  → proxy → backend:8000 (WebSocket)
        └── /*     → React SPA (статика)
```

**Backend:** FastAPI + SQLAlchemy async + aiosqlite + Alembic  
**Frontend:** React 19 + TypeScript + Vite + TailwindCSS + Zustand + React Query  
**AI:** ZAI API (OpenAI-совместимый), модели `glm-5` (основная) и `glm-4-flash` (вспомогательная)  
**Auth:** JWT (access 15 мин / refresh 30 дней) в httpOnly cookies + OTP через email  
**DB:** SQLite в WAL-режиме, путь `/data/psyho.db` в контейнере  

## Агентная система

### Поток обработки сообщения (`orchestrator.py`)
1. `_check_crisis(message)` — keyword-match → если кризис, сразу стримим `CRISIS_RESPONSE`
2. `_classify_topics(message, history[-6:])` — вызов `glm-4-flash`, JSON-массив тем
3. `_select_agents(topics)` — по `TOPIC_AGENT_MAP` выбираем ≤2 агента
4. Если `len(history) < 4` — агенты не вызываются (оркестратор отвечает сам)
5. `asyncio.gather` — параллельный вызов `.analyze()` у выбранных агентов
6. `_synthesize(...)` — стриминг финального ответа через `glm-5`

### Агенты
| ID | Класс | Промпт |
|---|---|---|
| `cbt` | CBTAgent | `prompts/cbt.txt` |
| `jungian` | JungianAgent | `prompts/jungian.txt` |
| `act` | ACTAgent | `prompts/act.txt` |
| `ifs` | IFSAgent | `prompts/ifs.txt` |
| `narrative` | NarrativeAgent | `prompts/narrative.txt` |
| `somatic` | SomaticAgent | `prompts/somatic.txt` |

`BaseAgent.analyze()` использует `glm-5`, max_tokens=1024. Оркестратор использует `glm-5`, max_tokens=3000, temperature=0.7.

### Маппинг тем → агенты (`TOPIC_AGENT_MAP`)
```
anxiety→[cbt,somatic], depression→[cbt,act], relationships→[ifs,narrative],
meaning→[jungian,act], dreams→[jungian], trauma→[somatic,ifs],
self_criticism→[ifs,cbt], identity→[jungian,narrative], procrastination→[cbt,act],
anger→[ifs,somatic], stress→[somatic,act], emotions→[ifs,act],
fear→[cbt,somatic], loneliness→[narrative,ifs], burnout→[act,somatic],
grief→[narrative,somatic], self_esteem→[cbt,narrative], habits→[cbt,act],
boundaries→[ifs,narrative]
```

### Персонализация в `_synthesize()` (конец system prompt)
- `preferred_style`: `balanced` (по умолчанию), `direct`, `gentle` — разные стилистические инструкции
- `address_form = "вы"` → добавляет жёсткую инструкцию «ИСКЛЮЧИТЕЛЬНО на «вы»» с примерами запрещённых форм и заменами
- `gender = "female"/"male"` → добавляет инструкцию по окончаниям с конкретными примерами
- `therapy_goals`, `long_term_memory` — добавляются отдельными блоками в system prompt

## WebSocket-протокол (`/api/sessions/{id}/chat`)

**Auth:** токен через query param `?token=` или cookie `access_token`

**Клиент → сервер:** `{"type": "message", "content": "..."}` (лимит 4000 символов)

**Сервер → клиент:**
- `{"type": "agents_used", "agents": ["cbt", "somatic"]}` — первым
- `{"type": "token", "content": "..."}` — стриминг
- `{"type": "done", "message_id": "uuid", "exchange_count": N, "max_exchanges": N}` — завершение; `max_exchanges` берётся из `SESSION_MAX_EXCHANGES` env через config
- `{"type": "context_compressed"}` — если сработало сжатие
- `{"type": "error", "message": "..."}` — ошибка
- `{"type": "session_limit_reached"}` — достигнут лимит обменов

При открытии WS на новой сессии с `continuation_context` (и 0 сообщений) — автоматически генерируется и стримится приветствие-продолжение.

## База данных (SQLAlchemy models)

```
User          — id(uuid), email, password(bcrypt), name, is_active,
                telegram_id, telegram_username
ChatSession   — id, user_id, title, summary, continuation_context,
                max_exchanges (int, default SESSION_MAX_EXCHANGES из env)
Message       — id, session_id, role, content, agents_used(JSON-строка)
UserProfile   — user_id(PK), therapy_goals, preferred_style, crisis_plan,
                memory_enabled, long_term_memory, pop_score, address_form, gender
EmailVerificationCode — для OTP-авторизации
TelegramVerificationCode — для Telegram-авторизации
MoodEntry     — user_id, session_id, value(int), note
PersonalitySnapshot — user_id, self_awareness, emotional_regulation, self_compassion,
                      acceptance, values_clarity, resourcefulness,
                      dominant_theme, summary_note, created_at
SessionTask   — user_id, session_id, text, completed(bool)
                Создаётся автоматически при action_type="exercise"
```

`continuation_context` — JSON `{"previous_title", "insights", "previous_id"}`, создаётся при `POST /api/sessions/{id}/continue`.

## Управление контекстом (`services/context.py`)

- **Сжатие:** при `>40` сообщений — старые (кроме последних 20) суммируются через `glm-4-flash` и удаляются из БД. Резюме накапливается в `ChatSession.summary`.
- **Заголовок:** первое сообщение → `glm-4-flash` → авто-название сессии (≤5 слов).

## Долгосрочная память (`services/memory_service.py`)

После каждого ответа (если `profile.memory_enabled`): последние 5 сообщений пользователя + текущая память → `glm-4-flash` → обновлённый текст (≤200 слов) сохраняется в `UserProfile.long_term_memory`. Передаётся оркестратору в system prompt.

## Упражнения и задания (`routers/tasks.py`, `routers/actions.py`)

- Action `"exercise"` через `POST /api/sessions/{id}/action` → генерирует упражнение + автоматически создаёт `SessionTask` с первой строкой текста (`task_id` возвращается в ответе)
- `GET /api/tasks/pending` — невыполненные задания текущего пользователя
- `GET /api/tasks/history` — все задания (включая выполненные, limit=50)
- `PATCH /api/tasks/{id}/complete` — отметить выполненным
- `POST /api/tasks` — создать задание вручную
- Фронтенд при открытии сессии проверяет pending-задания из других сессий и показывает баннер

## Auth (`routers/auth.py`, `services/auth.py`)

- OTP-авторизация: `POST /api/auth/email` → код на почту → `POST /api/auth/verify`
- Telegram-авторизация: `POST /api/auth/telegram/start` → код в бот → `POST /api/auth/telegram/verify`
- Старый парольный логин тоже есть (`/api/auth/login`)
- `TEST_PASSWORD_CODE` в `.env` — мастер-пароль для тестов
- Access token: 15 мин, Refresh: 30 дней
- Rate limit: chat 30/мин, auth 5/мин

## Конфигурация (`config.py`)

Все настройки через `.env` файл в директории запуска (backend/).

Ключевые переменные:
```
ZAI_API_KEY, ZAI_BASE_URL, ZAI_MODEL=glm-5, ZAI_SMALL_MODEL=glm-4-flash
SECRET_KEY, ALGORITHM=HS256
DATABASE_URL=sqlite+aiosqlite:///./data/psyho.db
ALLOWED_ORIGINS=http://localhost:5173,...
ADMIN_EMAILS=email1,email2          # определяет администраторов
APP_PORT=8080                        # порт Docker → внешний мир
CONTEXT_COMPRESSION_THRESHOLD=40
CONTEXT_KEEP_MESSAGES=20
SESSION_MAX_EXCHANGES=20             # лимит обменов в сессии; сохраняется в ChatSession.max_exchanges
                                     # и передаётся фронтенду в done-событии WS
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS  # для OTP-писем
OTP_EXPIRE_MINUTES=10, OTP_MAX_ATTEMPTS=5
VITE_TG_BOT_USERNAME=@botname       # показывается на лендинге в UserGuide
```

## Ключевые файлы

```
backend/app/
  agents/orchestrator.py   — центральная логика, TOPIC_AGENT_MAP, кризисный детектор,
                             персонализация по address_form/gender/preferred_style
  agents/base.py           — BaseAgent + OpenAI client (ZAI)
  agents/prompts/*.txt     — промпты агентов (все на русском)
  routers/messages.py      — WebSocket endpoint + основной поток чата
  routers/sessions.py      — CRUD сессий + /continue + /insights
  routers/tasks.py         — CRUD заданий (pending, history, complete, create)
  routers/actions.py       — action panel (insight, exercise); exercise → создаёт SessionTask
  routers/mood.py          — трекер настроения
  routers/personality.py   — психопортрет (snapshots)
  services/context.py      — сжатие контекста + авто-заголовок
  services/memory_service.py — долгосрочная память
  models/models.py         — все SQLAlchemy модели
  config.py                — Settings (pydantic-settings, lru_cache)

frontend/src/
  hooks/useChat.ts         — WebSocket клиент, авто-реконнект 3с;
                             maxExchanges инициализируется 0 (не 20), берётся из done-события
                             или currentSession.max_exchanges
  hooks/useSessions.ts     — React Query для сессий
  store/auth.ts            — Zustand store авторизации
  types/index.ts           — типы + AGENTS массив с мета-инфой
  pages/Chat.tsx           — главная страница чата; загружает pending tasks,
                             показывает баннер выполнения упражнения
  pages/MoodPage.tsx       — трекер настроения: история по сессиям, задания,
                             streak, корреляция упражнения↔настроение
  pages/PersonalityPage.tsx — психопортрет: radar chart, сильные стороны,
                              зоны роста с советами, мини-график динамики,
                              trend banner (🌱 растёшь / 💫 продолжай)
  components/chat/SessionEndCard.tsx — карточка конца сессии: оценка настроения,
                                      pending task из прошлой сессии, хинт психопортрета
  components/chat/SessionProgress.tsx — прогресс-бар сессии
  components/chat/ActionPanel.tsx   — плитки действий (exercise → creates SessionTask)
  components/landing/UserGuide.tsx  — гайд лендинга (бот + сайт входы)
  components/landing/AgentSystem.tsx — анимированный pipeline + сравнение с ChatGPT +
                                       ссылка обратной связи @keyjey101
```

## Frontend-соглашения

- Псевдоним `@/` → `src/`
- Цветовая система TailwindCSS: `primary-*`, `chalk-*`, `warm-*`, `surface-*`
- Иконки агентов: cbt=🧠, jungian=🌙, act=🧭, ifs=🎭, narrative=📖, somatic=🌿, orchestrator(Ника)=🌸, crisis=🆘
- WebP-иллюстрации в `public/illustrations/opt/`, PNG-оригиналы рядом

## Деплой

Docker Compose: два сервиса — `backend` (expose 8000) и `frontend` (ports APP_PORT:80). Никакого nginx-сервиса в compose — только внутренний nginx в frontend-контейнере, который проксирует `/api/*` и `/ws/*` на `backend:8000`. Внешний nginx на хосте проксирует всё на `localhost:APP_PORT`.

Миграции: `alembic upgrade head` — запускается в `start.sh` перед стартом uvicorn.

## Документы в /docs

- `PLAN.md` — изначальный план
- `AUDIT.md` — аудит реализации
- `AMENDMENTS.md` — уточнения: Docker без nginx, ADMIN_EMAILS, SEO, PWA
- `REVIEW.md` — ревью
- `Improvements1.md` — список улучшений
