# 10. Интеграция с Существующей Кодовой Базой

Этот файл описывает, как новые компоненты встраиваются в уже работающий проект.
При расхождении с другими BT-файлами — этот документ имеет приоритет.

---

## 10.1 Backend: точки подключения

### `main.py` — регистрация роутера и WS

В `main.py` добавить после существующих `include_router`:

```python
from app.routers import game as game_router

# ... существующие роутеры ...
app.include_router(game_router.router, prefix="/api/game", tags=["Game"])
```

WebSocket регистрируется **внутри `game.py`** через `APIRouter` с `add_websocket_route`,
а не напрямую в `main.py`. Пример из существующего `messages.py`:
```python
router = APIRouter()

@router.websocket("/{session_id}")
async def game_ws_endpoint(websocket: WebSocket, session_id: str): ...
```
Роутер монтируется с префиксом `/ws/game`:
```python
app.include_router(game_router.ws_router, prefix="/ws/game", tags=["Game WS"])
```

### Slowapi — rate limiting

Лимитер уже создан в `main.py` как `limiter = Limiter(key_func=get_remote_address)`.
В `game.py` использовать его через `request.app.state.limiter` или через dependency:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

# В роутере — не создавать новый limiter, а получать из app.state:
@router.post("/landing-answer")
@request.app.state.limiter.limit("30/minute")
async def landing_answer(request: Request, ...): ...
```

### `database.py` — сессии БД

Использовать существующий `async_session` из `app.database`:
```python
from app.database import async_session

async with async_session() as db:
    ...
```
Не создавать новый engine или sessionmaker.

### `config.py` — добавление новых полей

`Settings` наследует `pydantic BaseSettings`. Добавить поля в конец класса:
```python
# Мини-игра
GAME_MAX_MOVES: int = 12
GAME_CONFIDENCE_THRESHOLD: float = 0.80
GAME_LLM_TIMEOUT: float = 5.0
GAME_BUDGET_LIMIT_USD: float = 50.0
GAME_HOST_MAX_TOKENS: int = 80
GAME_ANALYZER_MAX_TOKENS: int = 200
GAME_DESIGNER_MAX_TOKENS: int = 150
GAME_CANARY_TOKEN: str = ""
GAME_SESSION_TTL_HOURS: int = 2
```
`get_settings()` кэширован через `@lru_cache` — менять не нужно.

### Кризисный детектор

Переиспользовать функцию `_check_crisis` из `agents/orchestrator.py`.
Импортировать напрямую:
```python
from app.agents.orchestrator import _check_crisis
```
Вызывать до передачи ответа в АА.

---

## 10.2 Frontend: точки подключения

### `App.tsx` — новые маршруты

Добавить маршруты в существующий роутер:
```tsx
// Новые маршруты (добавить в App.tsx):
<Route path="/game" element={<GamePage />} />
<Route path="/leaderboard" element={<LeaderboardPage />} />
```

### `Landing.tsx` — встройка блока теста

Лендинг-блок «Акинатор» встраивается как компонент внутрь `Landing.tsx`:
```tsx
// Добавить в нужном месте внутри Landing.tsx:
import { LandingGameBlock } from '@/components/game/LandingGameBlock';
// ...
<LandingGameBlock />
```
`LandingGameBlock` — отдельный компонент в `components/game/`, а не отдельная страница.
Отдельная страница `/game` — это уже основная игра.

### `api/client.ts` — API-вызовы игры

Использовать существующий Axios-instance из `api/client.ts`. Он уже настроен на
авто-рефреш токена, базовый URL и Content-Type:
```typescript
import api from '@/api/client';

// Пример вызова:
const res = await api.post('/game/landing-answer', payload);
```
Не создавать новый Axios-instance.

### `ThinkingIndicator.tsx` vs `ThinkingSpinner.tsx`

В `components/chat/` уже есть `ThinkingIndicator.tsx` — для чат-интерфейса.
Игровой спиннер (`ThinkingSpinner.tsx`) — **отдельный компонент** в `components/game/`
с другим визуалом (SVG-дуга + фразы). Переиспользовать `ThinkingIndicator` нельзя —
другой дизайн и контекст.

### `data/tests.ts` — существующие вопросы тестов

В проекте уже есть `data/tests.ts` с психологическими тестами (TestsPage).
Вопросы для **лендинг-теста и игры** — отдельный набор в `data/gameQuestions.ts`.
Не смешивать с существующими тестами.

### Zustand store

Существующие stores: `store/auth.ts`, `store/theme.ts`.
Новый: `store/game.ts` — изолированный, без пересечения с auth-стором.
Импортировать `useAuthStore` из `store/auth.ts` только для получения `user.id`
при привязке псевдонима к аккаунту.

### WebSocket — отдельный хук

Существующий `hooks/useChat.ts` — для основного чата, потоковая передача токенов.
Игровой WS (`hooks/useGame.ts`) — другой протокол (вопрос/ответ циклы), отдельный хук.
Не расширять `useChat.ts`.

---

## 10.3 Alembic — порядок миграции

Получить последний `revision` перед созданием новой миграции:
```bash
alembic history | head -1
```
В `alembic/versions/XXXX_add_game_tables.py` указать актуальный `Revises:`.

Порядок создания таблиц в `upgrade()` важен из-за FK:
1. `user_pseudonyms` (нет FK на другие новые таблицы)
2. `game_sessions` (FK → `user_pseudonyms`, `users`)
3. `leaderboard_entries` (FK → `user_pseudonyms`)
4. `landing_answers` (нет FK)
5. `budget_tracker` (нет FK)

---

## 10.4 Логирование

Весь проект использует `structlog`. В игровых модулях:
```python
import structlog
logger = structlog.get_logger()

logger.info("game_move_processed", session_id=session.id, move=session.move_count, confidence=confidence)
logger.warning("game_canary_missing", session_id=session.id)
logger.error("game_llm_failed", error=str(e), fallback=True)
```
Не использовать `logging` из stdlib напрямую.

---

## 10.5 Аутентификация в игровом роутере

Игра работает анонимно. Однако если пользователь авторизован — привязать к `user_id`.

```python
from app.services.auth import get_current_user_optional

# Dependency, возвращающий User | None:
async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    try:
        return await get_current_user(request, db)
    except Exception:
        return None
```

Если `get_current_user_optional` ещё не существует — добавить в `services/auth.py`
по образцу существующего `get_current_user`.

---

## 10.6 Переход из игры в основной чат

При сценарии A, если пользователь нажал «Да, это про меня!» и авторизован:
- Создать `ChatSession` через существующий endpoint `POST /api/sessions`.
- Заполнить `continuation_context` данными игровой сессии:
  ```json
  {
    "previous_title": "Игра «Победи Нику»",
    "insights": "Пользователь показал паттерны, связанные с [topic_label]",
    "previous_id": "<game_session_id>"
  }
  ```
- Перенаправить на `/chat/<new_session_id>`.

Формат `continuation_context` уже поддерживается моделью `ChatSession` и роутером сессий
(см. `POST /api/sessions/{id}/continue`). Переиспользовать существующую логику.
