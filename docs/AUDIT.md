# PsyHo — Аудит проекта и план развития

> Дата аудита: 2026-04-21  
> Версия плана: PLAN.md  
> Статус реализации: **85–90% от плана**  
> Готовность к проду: ⚠ Требует доработки

---

## 1. Сводная таблица: план vs реализация

| Компонент | План | Реализация | Статус |
|---|---|---|---|
| FastAPI backend | ✓ | ✓ FastAPI 0.115 | ✅ |
| AI-провайдер | Anthropic Claude | **ZAI/GLM** (OpenAI-совместимый) | ℹ Намеренно |
| SQLAlchemy async + aiosqlite | ✓ | ✓ | ✅ |
| JWT + bcrypt | ✓ | ✓ python-jose + passlib | ✅ |
| React 18 + TypeScript + Vite | ✓ | ✓ React 19.2, TS 6.0 | ✅ |
| TailwindCSS + shadcn/ui | ✓ | ✓ Tailwind 3.4 + кастомный UI | ✅ |
| WebSocket стриминг | ✓ | ✓ | ✅ |
| Nginx reverse proxy | ✓ | ✓ nginx:1.25-alpine | ✅ |
| Docker + Docker Compose | ✓ | ✓ (только dev compose) | ⚠ |
| Alembic миграции | ✓ | ✗ Файлы есть, версий нет | ❌ |
| Rate limiting (slowapi) | ✓ | ✗ Зависимость есть, нигде не используется | ❌ |
| Extended Thinking | ✓ | ✗ GLM не поддерживает | ℹ |
| 7 агентов | ✓ | ✓ Все 7 присутствуют | ✅ |
| Crisis detection | ✓ | ✓ | ✅ |
| Context compression | ✓ | ✓ | ✅ |
| Лендинг | ✓ | ✓ Все секции | ✅ |
| Чат + история | ✓ | ✓ | ✅ |
| docker-compose.prod.yml | ✓ | ✗ Отсутствует | ❌ |
| Профиль пользователя (preferred_style) | ✓ | ⚠ Схема есть, в агентах не используется | ⚠ |
| Therapy goals onboarding | ✓ | ✗ Только поле в БД, нет UI | ❌ |

---

## 2. Что реализовано хорошо

### Backend
- Все 21 API-эндпоинт из плана присутствуют и логически корректны
- Полная мультиагентная система: оркестратор классифицирует тему, параллельно запрашивает агентов через `asyncio.gather`, синтезирует единый ответ
- Корректный async/await во всём коде, нет блокирующих вызовов
- Обнаружение кризисных маркеров с немедленным ответом и телефонами доверия
- Context compression при > 40 сообщениях, авто-генерация заголовков сессий
- Lifespan management в FastAPI, WAL-режим SQLite при старте

### Frontend
- Полностью рабочий чат с WebSocket-стримингом токенов
- Лендинг со всеми секциями (Hero, Features, Specialists, HowItWorks, Principles, Disclaimer, CTA, Footer) и Framer Motion анимациями
- Защищённые роуты, Zustand store для auth, React Query для данных
- Компонент AgentBadge — отображает какие специалисты участвовали в ответе
- Mobile-first responsive layout, сайдбар скрывается на мобиле

---

## 3. Критические замечания (блокируют прод)

### 3.1 Отсутствуют Alembic-миграции
**Файлы:** `alembic/env.py` (неполный), нет папки `versions/`  
**Проблема:** Схема создаётся через `Base.metadata.create_all()` при старте. При любом изменении схемы в проде — ручное вмешательство или потеря данных.  
**Исправление:**
```bash
alembic init alembic/versions
alembic revision --autogenerate -m "initial"
alembic upgrade head
```

### 3.2 Rate limiting не подключён
**Файлы:** `pyproject.toml` — slowapi есть в зависимостях, но нигде не импортируется  
**Проблема:** Нет защиты от брутфорса на `/auth/login` и флуда в WebSocket  
**Исправление:** добавить в `main.py`:
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```
И декораторы `@limiter.limit("5/minute")` на auth-роуты, `@limiter.limit("30/minute")` на чат.

### 3.3 Отсутствует docker-compose.prod.yml
**Проблема:** Существующий `docker-compose.yml` — dev-конфигурация без SSL и с открытыми портами бэкенда  
**Нужно:** Отдельный prod-файл с закрытым бэкендом (expose, не ports), certbot volume, `restart: unless-stopped` на всех сервисах

### 3.4 Нет валидации входных данных в WebSocket
**Файл:** `backend/app/routers/messages.py:81`
```python
content = data.get("content", "").strip()
if not content:
    continue
```
**Проблема:** Нет ограничения длины сообщения — можно залить БД гигантским текстом  
**Исправление:** добавить `if len(content) > 10000: continue` и Pydantic-модель для WS-payload

### 3.5 Слабый дефолтный SECRET_KEY
**Файл:** `backend/app/config.py:16`
```python
SECRET_KEY: str = "change-me-to-a-long-random-secret-key-in-production"
```
**Проблема:** Если `.env` не выставлен — токены можно подделать, зная этот ключ  
**Исправление:**
```python
@validator("SECRET_KEY")
def secret_key_must_be_strong(cls, v):
    if v == "change-me-to-a-long-random-secret-key-in-production":
        raise ValueError("SECRET_KEY must be changed in production")
    return v
```

---

## 4. Замечания средней важности

### 4.1 JWT-токены хранятся в localStorage (XSS-вектор)
**Файлы:** `frontend/src/store/auth.ts:22`, `frontend/src/api/client.ts:11`  
**Проблема:** При XSS-уязвимости атакующий получает токены  
**Рекомендация:** Перейти на httpOnly cookies для access token; refresh token — всегда httpOnly cookie

### 4.2 Минимальная длина пароля — 6 символов
**Файл:** `backend/app/schemas/auth.py:7`  
**Рекомендация:** Поднять до 8, добавить проверку на наличие хотя бы одной цифры

### 4.3 Нет индексов на внешних ключах
**Файл:** `backend/app/models/models.py`  
**Проблема:** При росте данных запросы `SELECT * WHERE user_id = ?` будут медленными  
**Исправление:** добавить `index=True` к полям `user_id` в `ChatSession` и `session_id` в `Message`

### 4.4 Нет пагинации для истории сообщений
**Файл:** `backend/app/routers/messages.py:44` — `limit=100`  
**Проблема:** При длинной истории UI начинает тормозить  
**Рекомендация:** Курсорная пагинация (до 50 сообщений, `before_id` параметр)

### 4.5 Профиль пользователя (preferred_style) нигде не используется
**Файлы:** `backend/app/schemas/user.py` (схема есть), `backend/app/agents/orchestrator.py` (не читается)  
**Проблема:** Фича из плана частично реализована, но не работает  
**Рекомендация:** Передавать `preferred_style` в системный промпт оркестратора

### 4.6 Markdown рендерится без санитизации
**Файл:** `frontend/src/components/chat/MessageItem.tsx:42`
```tsx
<ReactMarkdown>{message.content}</ReactMarkdown>
```
**Рекомендация:** Добавить `rehype-sanitize` плагин

---

## 5. Баги

| # | Серьёзность | Файл | Описание |
|---|---|---|---|
| 1 | High | `useChat.ts:72` | Closure над stale `agentsUsed` при стриминге — если отправить два сообщения быстро, агенты могут перепутаться |
| 2 | Medium | `context.py:87` | Опечатка `_insайты` в промпте компрессии (лишнее подчёркивание) |
| 3 | Medium | `context.py:65` | `except Exception: pass` — ошибки авто-заголовка заглатываются без логирования |
| 4 | Medium | `messages.py:121` | На ошибке оркестратора — `continue` без `break`, что при постоянных ошибках создаёт бесконечный цикл |
| 5 | Low | `Chat.tsx:19` | Если сессия не найдена (404) — страница показывает пустоту без редиректа |
| 6 | Low | `database.py:9` | WAL-режим включается при каждом старте, но не персистируется в файле SQLite корректно при первом запуске |

### Детали бага #1 (useChat.ts)
```typescript
// Проблема: agentsUsed из внешнего closure, не из текущего события
onMessageComplete?.({
  agents_used: agentsUsed.length > 0 ? JSON.stringify(agentsUsed) : null,
  // ^^^^ stale value
});

// Исправление: использовать ref
const agentsUsedRef = useRef<string[]>([]);
// ...обновлять ref синхронно при получении агентов
```

---

## 6. Что отсутствует из плана

| Фича из плана | Статус | Приоритет |
|---|---|---|
| `docker-compose.prod.yml` | Не создан | Критично |
| Alembic migration versions | Не инициализированы | Критично |
| Rate limiting (slowapi) | Зависимость есть, код нет | Критично |
| Preferred style в оркестраторе | Поле в БД есть, не используется | Средний |
| Therapy goals onboarding UI | Только поле в БД | Низкий |
| Session summary в UI | Хранится в БД, не отображается | Низкий |
| Extended Thinking | Не применимо к GLM | n/a |
| `.dockerignore` файлы | Отсутствуют | Низкий |

---

## 7. Замечания по GLM

Использование ZAI/GLM вместо Anthropic Claude — намеренное решение и технически корректно, так как GLM имеет OpenAI-совместимый API. Отличия от плана:

- **Зависимость:** `openai>=1.50` вместо `anthropic>=0.40` — ОК
- **Extended Thinking:** не поддерживается GLM — функция оркестратора работает без неё
- **Качество:** GLM-4 сопоставим по качеству с Claude Sonnet для диалога
- **Стоимость:** значительно дешевле Anthropic для русскоязычных пользователей

**Рекомендация:** Задокументировать этот выбор в README, добавить абстрактный `AI_PROVIDER` в config.py для возможного переключения.

---

## 8. План развития

### Фаза 0 — Критические исправления (1–2 дня, блокируют прод)

- [ ] Инициализировать Alembic миграции и создать initial revision
- [ ] Подключить slowapi rate limiting к auth и WebSocket эндпоинтам
- [ ] Добавить валидацию длины в WebSocket handler
- [ ] Добавить валидатор SECRET_KEY в config.py
- [ ] Создать `docker-compose.prod.yml` с закрытыми портами и SSL-готовностью
- [ ] Исправить опечатку `_insайты` в context.py
- [ ] Исправить `except Exception: pass` в context.py (добавить логирование)
- [ ] Исправить бесконечный `continue` в messages.py при ошибке оркестратора
- [ ] Исправить стale closure в useChat.ts (агенты при стриминге)
- [ ] Добавить `.dockerignore` для backend и frontend

### Фаза 1 — Безопасность и надёжность (3–5 дней)

- [ ] Перевести токены из localStorage в httpOnly cookies (backend: Set-Cookie, frontend: убрать из localStorage)
- [ ] Поднять минимальную длину пароля до 8 символов
- [ ] Добавить `index=True` на FK-поля в моделях
- [ ] Добавить `rehype-sanitize` для Markdown рендеринга
- [ ] Добавить обработку 404 для несуществующих сессий на Chat.tsx
- [ ] Добавить health check в docker-compose для backend (с ожиданием на старт)
- [ ] Добавить environment check (ENVIRONMENT=production) для блокировки слабых секретов

### Фаза 2 — Доработка функциональности из плана (1 неделя)

- [ ] **Использовать preferred_style в оркестраторе** — передавать стиль (direct/gentle/balanced) в системный промпт синтеза
- [ ] **Therapy goals onboarding** — страница настройки профиля после регистрации (3 вопроса о целях)
- [ ] **Отображение summary сессии** — в сайдбаре под названием сессии показывать резюме при hover
- [ ] **Курсорная пагинация** для истории сообщений (параметр `before_id`, limit=50)
- [ ] **Событие компрессии контекста** — отправлять WS-событие `{"type": "context_compressed"}` чтобы фронт обновил список сообщений

### Фаза 3 — Улучшение UX и агентной системы (2 недели)

- [ ] **Индикатор "какой агент думает"** — во время генерации показывать анимацию с именами подключившихся специалистов
- [ ] **Режимы разговора** — кнопка переключения (Свободный разговор / Структурированная сессия / Кризисная поддержка)
- [ ] **Инсайты сессии** — по запросу пользователя выдавать краткую выжимку паттернов из всей истории
- [ ] **Экспорт истории** — скачать историю чата в PDF или TXT
- [ ] **Onboarding tour** — первый раз в чате: короткий интерактивный тур (3 шага)
- [ ] **Голосовой ввод** — Web Speech API для диктовки (никакого внешнего сервиса, только браузерный API)

### Фаза 4 — Продвинутые функции (месяц+)

- [ ] **Трекер настроения** — после каждой сессии короткий emoji-опрос (1–5), график на отдельной странице
- [ ] **Напоминания** — настройка напоминаний о сессии (email или push-уведомления)
- [ ] **Персонализированные техники** — библиотека упражнений (дыхательные, когнитивные, телесные) с рекомендацией после сессии
- [ ] **Анонимный режим** — сессия без регистрации (sessionStorage, 24 часа)
- [ ] **Административная панель** — мониторинг ошибок агентов, статистика использования, управление пользователями
- [ ] **Поддержка нескольких AI-провайдеров** — абстракция над GLM/Anthropic/OpenAI через единый интерфейс

### Фаза 5 — Масштабирование (при росте нагрузки)

- [ ] **Перейти на PostgreSQL** с pgvector для semantic search по истории
- [ ] **Redis для сессий и rate limiting** — заменить in-memory счётчик slowapi
- [ ] **Celery + Redis** — асинхронные задачи (отправка email, генерация резюме в фоне)
- [ ] **Horizontal scaling** — статeless backend, shared PostgreSQL
- [ ] **Мониторинг** — Prometheus метрики + Grafana dashboard (latency агентов, WS соединения, ошибки)
- [ ] **Sentry** — трекинг ошибок на бэке и фронте

---

## 9. Итоговая оценка

| Критерий | Оценка | Комментарий |
|---|---|---|
| Архитектура | 9/10 | Чистое разделение ответственности, правильный async |
| Реализация агентов | 8/10 | Все агенты есть, оркестрация работает, промпты достаточно глубокие |
| Безопасность | 5/10 | JWT корректно, но токены в localStorage, нет rate limiting, слабый дефолт |
| Frontend/UX | 8/10 | Красиво, адаптивно, стриминг работает |
| DevOps | 6/10 | Dev-compose готов, нет prod-compose и SSL-автоматизации |
| Готовность к проду | 6/10 | Функционально почти готово, не хватает Фазы 0 |
| **Итого** | **7.5/10** | Крепкая база, 2–3 дня работы до prod-ready |

**Вывод:** Проект архитектурно зрелый и почти функционально полный. Основные риски — не в коде бизнес-логики, а в инфраструктурных деталях (миграции, rate limiting, секреты, prod-compose). После Фазы 0 (1–2 дня) приложение можно деплоить в прод.
