# PsyHo — Психологический ИИ-консультант: Полный план реализации

## 1. Концепция проекта

Веб-приложение для психологического консультирования на базе мультиагентной ИИ-системы. Интерфейс — чат с историей (как ChatGPT), плюс лендинг. Специалисты автоматически подключаются в зависимости от контекста разговора. В основе — модель Claude через Anthropic SDK.

---

## 2. Технологический стек

| Слой | Технология | Обоснование |
|---|---|---|
| Backend | Python 3.12 + FastAPI | Async, WebSockets, отличная интеграция с Anthropic SDK |
| AI | Anthropic Claude API (claude-sonnet-4-6) | Лучшее качество диалога, extended thinking |
| ORM | SQLAlchemy 2.0 (async) + aiosqlite | Нативный async с SQLite |
| Auth | JWT (python-jose) + bcrypt | Stateless, production-ready |
| Frontend | React 18 + TypeScript + Vite | Современный стек, быстрая сборка |
| Стили | TailwindCSS 3 + shadcn/ui | Красивый UI без лишнего кода |
| WS | WebSockets (FastAPI native) | Стриминг ответов агентов |
| Reverse proxy | Nginx | SSL termination, статика |
| Контейнеры | Docker + Docker Compose | Prod-ready деплой |
| DB | SQLite (файл в volume) | Простота, надёжность для MVP |
| Миграции | Alembic | Версионирование схемы |

---

## 3. Мультиагентная архитектура

### 3.1 Агенты-специалисты

```
┌─────────────────────────────────────────────────────┐
│                   ORCHESTRATOR                       │
│  Анализирует контекст → выбирает специалистов       │
│  → синтезирует финальный ответ                      │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┼────────────────┐
        ▼            ▼                ▼
┌──────────┐  ┌──────────┐   ┌──────────────┐
│   CBT    │  │  JUNGIAN │   │     ACT      │
│ Агент    │  │  Агент   │   │   Агент      │
└──────────┘  └──────────┘   └──────────────┘
        ┌────────────┼────────────────┐
        ▼            ▼                ▼
┌──────────┐  ┌──────────┐   ┌──────────────┐
│   IFS    │  │NARRATIVE │   │  SOMATIC /   │
│ Агент    │  │  Агент   │   │ MINDFULNESS  │
└──────────┘  └──────────┘   └──────────────┘
```

### 3.2 Описание специалистов

| Агент | Направление | Когда активируется |
|---|---|---|
| **Orchestrator** | Координатор + дружелюбный слушатель | Всегда, первый контакт |
| **CBT Agent** | Когнитивно-поведенческая терапия | Автоматические мысли, тревога, депрессия, прокрастинация |
| **Jungian Agent** | Аналитическая психология Юнга | Сны, символы, архетипы, поиск смысла, теневая работа |
| **ACT Agent** | Терапия принятия и ответственности | Избегание, борьба с эмоциями, ценности, гибкость |
| **IFS Agent** | Внутренние семейные системы (Шварц) | Внутренние конфликты, части личности, самокритика |
| **Narrative Agent** | Нарративная терапия (Уайт/Эпстон) | Доминирующие истории, идентичность, переосмысление опыта |
| **Somatic Agent** | Соматическая осведомлённость + майндфулнесс | Телесные симптомы, стресс, травматические реакции |

### 3.3 Логика оркестратора (pseudo-code)

```python
class Orchestrator:
    async def process(self, message: str, history: list[Message]) -> AsyncIterator[str]:
        # 1. Классифицировать тему разговора
        topics = await self.classify_topics(message, history)
        
        # 2. Выбрать релевантных агентов (1-2 максимум)
        agents = self.select_agents(topics)
        
        # 3. Если первые 2-3 сообщения — просто слушать, не лезть с техниками
        if len(history) < 3:
            yield from self.empathic_listener(message, history)
            return
        
        # 4. Собрать перспективы от агентов
        perspectives = await asyncio.gather(*[
            agent.analyze(message, history) for agent in agents
        ])
        
        # 5. Синтезировать единый ответ через финальный вызов Claude
        yield from self.synthesize(message, history, perspectives)
```

### 3.4 Системные промпты агентов

Каждый агент получает:
1. **Role prompt** — глубокое описание своей школы
2. **Context** — историю разговора + выжимку из предыдущих сессий
3. **Task** — проанализировать конкретное сообщение через призму своего подхода
4. **Constraints** — не ставить диагнозов, не заменять реального терапевта, при кризисе → кризисные ресурсы

---

## 4. Схема базы данных

```sql
-- Пользователи
CREATE TABLE users (
    id          TEXT PRIMARY KEY,        -- UUID
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,           -- bcrypt hash
    name        TEXT NOT NULL,
    created_at  DATETIME DEFAULT NOW,
    is_active   BOOLEAN DEFAULT TRUE
);

-- Сессии (чаты)
CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,        -- UUID
    user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT,                    -- автогенерируется из первого сообщения
    created_at  DATETIME DEFAULT NOW,
    updated_at  DATETIME DEFAULT NOW,
    summary     TEXT                     -- краткое резюме для context compression
);

-- Сообщения
CREATE TABLE messages (
    id              TEXT PRIMARY KEY,    -- UUID
    session_id      TEXT REFERENCES sessions(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,       -- 'user' | 'assistant'
    content         TEXT NOT NULL,
    agents_used     TEXT,               -- JSON: ["cbt", "jungian"]
    created_at      DATETIME DEFAULT NOW
);

-- Метаданные пользователя (для персонализации)
CREATE TABLE user_profiles (
    user_id         TEXT PRIMARY KEY REFERENCES users(id),
    therapy_goals   TEXT,               -- JSON: цели терапии
    preferred_style TEXT DEFAULT 'balanced',  -- 'direct' | 'gentle' | 'balanced'
    crisis_plan     TEXT,               -- контакты экстренной помощи
    updated_at      DATETIME DEFAULT NOW
);
```

---

## 5. API эндпоинты

### Auth
```
POST /api/auth/register        — регистрация
POST /api/auth/login           — логин → JWT
POST /api/auth/refresh         — обновить токен
POST /api/auth/logout          — инвалидировать токен
```

### Sessions (чаты)
```
GET    /api/sessions           — список чатов пользователя
POST   /api/sessions           — создать новый чат
GET    /api/sessions/{id}      — чат + история сообщений
PATCH  /api/sessions/{id}      — переименовать
DELETE /api/sessions/{id}      — удалить
```

### Messages
```
GET /api/sessions/{id}/messages       — история сообщений
WS  /api/sessions/{id}/chat           — WebSocket чат со стримингом
```

### User
```
GET   /api/user/me             — профиль
PATCH /api/user/me             — обновить профиль
```

---

## 6. Структура проекта

```
psyho/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── nginx/
│   ├── nginx.conf
│   └── ssl/                   ← certbot volume
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic/
│   │   └── versions/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── session.py
│   │   │   └── message.py
│   │   ├── schemas/
│   │   │   ├── auth.py
│   │   │   ├── session.py
│   │   │   └── message.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── sessions.py
│   │   │   ├── messages.py
│   │   │   └── users.py
│   │   ├── agents/
│   │   │   ├── base.py            ← BaseAgent абстракция
│   │   │   ├── orchestrator.py    ← главный агент
│   │   │   ├── cbt.py
│   │   │   ├── jungian.py
│   │   │   ├── act.py
│   │   │   ├── ifs.py
│   │   │   ├── narrative.py
│   │   │   ├── somatic.py
│   │   │   └── prompts/           ← системные промпты .txt
│   │   │       ├── orchestrator.txt
│   │   │       ├── cbt.txt
│   │   │       └── ...
│   │   ├── services/
│   │   │   ├── auth.py
│   │   │   ├── session.py
│   │   │   └── context.py         ← сжатие контекста, summary
│   │   └── middleware/
│   │       └── auth.py
│   └── data/                      ← SQLite файл (volume mount)
│       └── psyho.db
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Landing.tsx        ← лендинг
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   └── Chat.tsx           ← основное приложение
│   │   ├── components/
│   │   │   ├── landing/
│   │   │   │   ├── Hero.tsx
│   │   │   │   ├── Features.tsx
│   │   │   │   ├── Specialists.tsx
│   │   │   │   ├── HowItWorks.tsx
│   │   │   │   └── CTA.tsx
│   │   │   ├── chat/
│   │   │   │   ├── Sidebar.tsx    ← список чатов
│   │   │   │   ├── MessageList.tsx
│   │   │   │   ├── MessageItem.tsx
│   │   │   │   ├── InputBar.tsx
│   │   │   │   ├── AgentBadge.tsx ← показывает кто ответил
│   │   │   │   └── NewChatButton.tsx
│   │   │   └── ui/                ← shadcn/ui компоненты
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useChat.ts         ← WebSocket логика
│   │   │   └── useSessions.ts
│   │   ├── store/
│   │   │   └── auth.ts            ← Zustand store
│   │   ├── api/
│   │   │   └── client.ts          ← axios instance
│   │   └── types/
│   │       └── index.ts
└── docs/
    └── PLAN.md
```

---

## 7. Детали реализации агентов

### 7.1 BaseAgent

```python
from anthropic import AsyncAnthropic
from abc import ABC, abstractmethod

class BaseAgent(ABC):
    client: AsyncAnthropic
    model: str = "claude-sonnet-4-6"
    
    @property
    @abstractmethod
    def system_prompt(self) -> str: ...
    
    @property
    @abstractmethod
    def name(self) -> str: ...
    
    async def analyze(
        self, 
        user_message: str, 
        history: list[dict],
        focus: str = ""
    ) -> str:
        """Возвращает перспективу данного агента (не стримит)."""
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=self.system_prompt,
            messages=[
                *history[-10:],          # последние 10 сообщений
                {"role": "user", "content": f"{user_message}\n\nFocus: {focus}"}
            ]
        )
        return response.content[0].text
```

### 7.2 Orchestrator с Extended Thinking

```python
async def synthesize(self, message, history, perspectives) -> AsyncIterator[str]:
    perspectives_text = "\n\n".join([
        f"[{name}]\n{text}" 
        for name, text in perspectives.items()
    ])
    
    async with self.client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        thinking={"type": "enabled", "budget_tokens": 5000},  # extended thinking
        system=ORCHESTRATOR_SYSTEM_PROMPT,
        messages=[
            *history,
            {"role": "user", "content": f"""
User message: {message}

Expert perspectives gathered:
{perspectives_text}

Synthesize a warm, coherent therapeutic response.
"""}
        ]
    ) as stream:
        async for text in stream.text_stream:
            yield text
```

### 7.3 Классификатор тем

```python
TOPIC_AGENT_MAP = {
    "anxiety": ["cbt", "somatic"],
    "depression": ["cbt", "act"],
    "relationships": ["ifs", "narrative"],
    "meaning": ["jungian", "act"],
    "dreams": ["jungian"],
    "trauma": ["somatic", "ifs"],
    "self_criticism": ["ifs", "cbt"],
    "identity": ["jungian", "narrative"],
    "procrastination": ["cbt", "act"],
    "anger": ["ifs", "somatic"],
}
```

---

## 8. WebSocket протокол

```
Client → Server:
{
  "type": "message",
  "content": "Я чувствую тревогу перед встречами"
}

Server → Client (streaming):
{ "type": "token", "content": "Я" }
{ "type": "token", "content": " понимаю" }
...
{ "type": "agents_used", "agents": ["cbt", "somatic"] }
{ "type": "done", "message_id": "uuid" }

Server → Client (error):
{ "type": "error", "message": "..." }
```

---

## 9. Context Compression

При превышении 40 сообщений в сессии — автоматически генерируется резюме:

```python
async def compress_context(session_id: str) -> str:
    """Сжимает старые сообщения в резюме, сохраняет последние 20."""
    messages = await get_messages(session_id)
    old_messages = messages[:-20]
    
    summary = await client.messages.create(
        model="claude-haiku-4-5-20251001",  # дешевле для резюме
        system="Сожми историю психологической беседы в краткое резюме...",
        messages=[{"role": "user", "content": format_messages(old_messages)}]
    )
    
    await save_summary(session_id, summary.content[0].text)
    await delete_old_messages(session_id, keep_last=20)
    return summary.content[0].text
```

---

## 10. Лендинг — структура

```
[HERO]
  "Поговори с тем, кто всегда выслушает"
  Subtitle + CTA кнопки [Начать бесплатно] [Узнать больше]

[КАК ЭТО РАБОТАЕТ]
  1. Опиши, что тебя беспокоит
  2. ИИ подберёт подход
  3. Исследуй вместе корни проблемы

[СПЕЦИАЛИСТЫ]
  Карточки агентов: КПТ, Юнг, ACT, IFS, Нарративный, Соматический
  Каждая карточка — иконка, название, 2-3 строки описания

[ПРИНЦИПЫ]
  Конфиденциальность | Без осуждения | Доступно 24/7

[ВАЖНЫЙ ДИСКЛЕЙМЕР]
  "Не заменяет профессиональную помощь. При кризисе — ..."
  + телефоны доверия

[CTA]
  Большая кнопка "Начать разговор"
```

---

## 11. Docker Compose (Production)

```yaml
# docker-compose.prod.yml
version: '3.9'

services:
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - certbot_www:/var/www/certbot:ro
    depends_on: [frontend, backend]
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - SECRET_KEY=${SECRET_KEY}
      - DATABASE_URL=sqlite+aiosqlite:////data/psyho.db
      - ENVIRONMENT=production
    volumes:
      - sqlite_data:/data
    restart: unless-stopped
    expose: ["8000"]

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - VITE_API_URL=/api
        - VITE_WS_URL=/ws
    restart: unless-stopped
    expose: ["80"]

volumes:
  sqlite_data:
  certbot_www:
```

### Nginx конфиг (ключевые блоки)

```nginx
upstream backend { server backend:8000; }
upstream frontend { server frontend:80; }

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    location /api { proxy_pass http://backend; }
    location /ws  { 
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    location / { proxy_pass http://frontend; }
}
```

---

## 12. Безопасность

| Аспект | Решение |
|---|---|
| Auth | JWT с refresh токенами (access: 15 мин, refresh: 30 дней) |
| Пароли | bcrypt (cost factor 12) |
| Rate limiting | slowapi: 30 req/min на чат, 5 req/min на auth |
| CORS | whitelist только фронтенд домен |
| Input validation | Pydantic v2 на всех эндпоинтах |
| SQL injection | SQLAlchemy ORM (параметризованные запросы) |
| Secrets | .env файл, не в образе |
| HTTPS | Nginx + Let's Encrypt (certbot) |
| Content safety | Проверка на кризисные маркеры → автоматический ответ с ресурсами |

---

## 13. Переменные окружения (.env.example)

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Security
SECRET_KEY=your-secret-key-min-32-chars
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30

# App
ENVIRONMENT=production
ALLOWED_ORIGINS=https://yourdomain.com

# DB
DATABASE_URL=sqlite+aiosqlite:////data/psyho.db
```

---

## 14. Фазы реализации

### Фаза 1 — Ядро (Backend + Agents)
1. Инициализация проекта: FastAPI, SQLAlchemy, Alembic
2. Модели БД + миграции
3. Auth (register/login/JWT)
4. BaseAgent + все 6 агентов с промптами
5. Orchestrator с классификатором
6. WebSocket эндпоинт со стримингом
7. REST эндпоинты сессий и сообщений
8. Context compression сервис

### Фаза 2 — Frontend
1. Vite + React + Tailwind + shadcn/ui scaffolding
2. Auth pages (login/register)
3. Лендинг (все секции)
4. Chat layout (sidebar + основная область)
5. WebSocket хук + стриминг токенов
6. История сессий в сайдбаре
7. AgentBadge компонент

### Фаза 3 — Docker + Prod
1. Dockerfile для backend (multi-stage)
2. Dockerfile для frontend (nginx static)
3. docker-compose.prod.yml
4. Nginx конфиг с SSL
5. .env.example
6. Скрипт деплоя (deploy.sh)

---

## 15. Критические детали для прода

- **SQLite WAL mode**: `PRAGMA journal_mode=WAL` при старте — для concurrent reads
- **Graceful shutdown**: FastAPI lifespan, закрытие DB соединений
- **Health check**: `GET /health` эндпоинт для Docker healthcheck
- **Логирование**: structlog в JSON формате → stdout → собирается Docker
- **Auto-title**: первые 5 слов пользователя → название сессии (через Claude Haiku)
- **Crisis detection**: если в сообщении слова suicide/самоубийство/не хочу жить → немедленный ответ с горячей линией, без передачи агентам
- **Mobile-first**: фронт полностью адаптивен, sidebar скрывается на мобиле

---

## 16. Стек зависимостей

### Backend (pyproject.toml)
```toml
[dependencies]
fastapi = ">=0.115"
uvicorn = {extras = ["standard"], version = ">=0.30"}
anthropic = ">=0.40"
sqlalchemy = {extras = ["asyncio"], version = ">=2.0"}
aiosqlite = ">=0.20"
alembic = ">=1.13"
python-jose = {extras = ["cryptography"], version = ">=3.3"}
passlib = {extras = ["bcrypt"], version = ">=1.7"}
pydantic-settings = ">=2.0"
slowapi = ">=0.1.9"
structlog = ">=24.0"
```

### Frontend (package.json key deps)
```json
{
  "react": "^18.3",
  "react-router-dom": "^6.26",
  "zustand": "^4.5",
  "axios": "^1.7",
  "@tanstack/react-query": "^5.0",
  "tailwindcss": "^3.4",
  "lucide-react": "^0.400",
  "framer-motion": "^11.0",
  "react-markdown": "^9.0"
}
```

---

## Итог

Это полный blueprint production-ready приложения. Агентная система использует Claude для:
1. Классификации психологической темы
2. Параллельного получения перспектив от специалистов
3. Синтеза единого тёплого и профессионального ответа

Архитектура масштабируема (можно добавить новых агентов без рефакторинга), безопасна и полностью контейнеризирована.
