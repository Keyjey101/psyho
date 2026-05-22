# 01. Системная Архитектура

## 1.1 Контекст

Новая функциональность («Мини-игра Победи Нику» + лендинг-тест) добавляется поверх
существующего стека:

```
Интернет → Внешний nginx (SSL) → localhost:APP_PORT
  └── Docker frontend (nginx :80)
        ├── /api/*  → backend:8000
        ├── /ws/*   → backend:8000
        └── /*      → React SPA
```

**Backend:** FastAPI + SQLAlchemy async + aiosqlite + Alembic  
**Frontend:** React 19 + TypeScript + Vite + TailwindCSS + Zustand  
**LLM:** ZAI API (OpenAI-совместимый), модели `glm-5` и `glm-4-flash`  

Новых сервисов в docker-compose не добавляется. Весь новый код — модули внутри `backend/app/`
и `frontend/src/`.

---

## 1.2 Новые компоненты

### Backend

```
backend/app/
  agents/
    game_orchestrator.py   ← РО: управление игровым циклом (НЕ наследует BaseAgent)
    game_analyzer.py       ← АА: оценка уверенности (НЕ наследует BaseAgent)
    game_designer.py       ← АГД: генерация игровых ходов (НЕ наследует BaseAgent)
    game_host.py           ← Ника: финальный вывод (НЕ наследует BaseAgent)
    game_fallback.py       ← статические фразы при недоступности LLM
  routers/
    game.py                ← REST + WS эндпоинты мини-игры
  models/
    game_models.py         ← GameSession, LeaderboardEntry, UserPseudonym, BudgetTracker
  services/
    pseudonym_service.py   ← генерация псевдонима (встроенные словари, не файлы)
    leaderboard_service.py ← запись и чтение лидерборда
    budget_service.py      ← учёт токенов и переключение на fallback
```

> **Важно:** Игровые агенты — это обычные async-функции/классы, **не** подклассы `BaseAgent`.
> `BaseAgent` и `AGENT_PREAMBLE` из `agents/base.py` предназначены для терапевтических агентов
> (CBT, Jungian и т.д.) с другим интерфейсом и смыслом. Игровые агенты используют тот же
> module-level `client` из `agents/base.py`, но реализуют собственный интерфейс.

### Frontend

```
frontend/src/
  pages/
    LandingGame.tsx         ← лендинг-блок «Акинатор» + вход в игру
    GamePage.tsx            ← основной экран мини-игры
  components/game/
    ThinkingSpinner.tsx     ← анимация «думания»
    CurtainOverlay.tsx      ← занавес при джекпоте
    ConfettiLayer.tsx       ← конфетти при победе/угадывании
    AnswerOptions.tsx       ← 3 варианта ответа
    GameProgress.tsx        ← счётчик ходов + прогресс-бар
    Leaderboard.tsx         ← таблица лидеров
    PseudonymModal.tsx      ← выбор/назначение псевдонима
  store/game.ts             ← Zustand: состояние игры
  hooks/useGame.ts          ← WS-клиент игры
```

---

## 1.3 Потоки данных

### Лендинг-тест → Мини-игра

```
Пользователь открывает лендинг
  → Видит блок с первым вопросом (3 варианта)
  → Выбирает ответ → POST /api/game/landing-answer
  → Если ≥5 ответов или ≥60 сек → редирект на /game
  → Иначе → следующий вопрос
```

### Основная игра

```
GET /api/game/session           ← создать/получить сессию (анонимно, по session_id cookie)
WS  /ws/game/{session_id}       ← основной канал
  ↑ {"type":"answer","choice":2}
  ↓ {"type":"thinking"}
  ↓ {"type":"question","text":"...","choices":["A","B","C"],"move":N}
  ↓ {"type":"result","scenario":"A|B","confidence":0.87,"topic":"anxiety","moves":N}
  ↓ {"type":"error","message":"..."}
```

---

## 1.4 Конфигурация (`.env` / `config.py`)

Добавляются новые переменные:

Новые переменные добавляются в класс `Settings` в `config.py` (pydantic BaseSettings):

```python
# в классе Settings:
GAME_MAX_MOVES: int = 12
GAME_CONFIDENCE_THRESHOLD: float = 0.80
GAME_LLM_TIMEOUT: float = 5.0
GAME_BUDGET_LIMIT_USD: float = 50.0
GAME_HOST_MAX_TOKENS: int = 80        # ≈300 символов
GAME_ANALYZER_MAX_TOKENS: int = 200
GAME_DESIGNER_MAX_TOKENS: int = 150
GAME_CANARY_TOKEN: str = ""           # обязательно заполнить в .env
GAME_SESSION_TTL_HOURS: int = 2
```

Соответствующие строки в `.env`:
```env
GAME_MAX_MOVES=12
GAME_CONFIDENCE_THRESHOLD=0.80
GAME_LLM_TIMEOUT=5.0
GAME_BUDGET_LIMIT_USD=50.0
GAME_CANARY_TOKEN=<secrets.token_hex(24)>
```

> Словари псевдонимов — **встроенные Python-списки** в `pseudonym_service.py`, а не внешние
> файлы. Это проще для Docker-образа и не требует монтирования volume.

---

## 1.5 Деплой

Изменения деплоятся стандартным путём:
1. `git pull` на сервере
2. Добавить `GAME_CANARY_TOKEN` в `.env` (если не было)
3. `docker-compose build && docker-compose up -d`
4. `alembic upgrade head` (новые таблицы игры, запускается в `start.sh` автоматически)

Словари псевдонимов встроены в код — отдельных файлов и volume не требуется.
