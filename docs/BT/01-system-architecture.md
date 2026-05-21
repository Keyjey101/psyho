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
    game_orchestrator.py   ← РО: управление игровым циклом
    analyzer.py            ← АА: оценка уверенности
    game_designer.py       ← АГД: генерация игровых ходов
    game_host.py           ← Ника: финальный вывод (≤300 символов)
    fallback_phrases.py    ← статические фразы при недоступности LLM
  routers/
    game.py                ← REST + WS эндпоинты мини-игры
  models/
    game_models.py         ← GameSession, GameAnswer, LeaderboardEntry, UserPseudonym
  services/
    pseudonym_service.py   ← генерация псевдонима
    leaderboard_service.py ← запись и чтение лидерборда
    budget_service.py      ← учёт токенов и переключение на fallback
```

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

```env
# Мини-игра
GAME_MAX_MOVES=12                 # макс. ходов пользователя
GAME_CONFIDENCE_THRESHOLD=0.80   # порог уверенности АА
GAME_LLM_TIMEOUT=5               # таймаут LLM в секундах
GAME_BUDGET_LIMIT_USD=50.0       # лимит бюджета LLM в месяц
GAME_HOST_MAX_CHARS=300          # лимит символов ответа Ники

# Псевдонимы
PSEUDONYM_ADJECTIVES_PATH=data/pseudonym_adj.txt
PSEUDONYM_NOUNS_PATH=data/pseudonym_nouns.txt
```

---

## 1.5 Деплой

Изменения деплоятся стандартным путём:
1. `git pull` на сервере
2. `docker-compose build && docker-compose up -d`
3. `alembic upgrade head` (новые таблицы игры)

Статические файлы псевдонимов (`pseudonym_adj.txt`, `pseudonym_nouns.txt`) монтируются
через volume или копируются в образ backend'а.
