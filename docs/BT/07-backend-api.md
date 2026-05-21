# 07. Backend API

## 7.1 Новые эндпоинты (router: `game.py`)

Все эндпоинты — под префиксом `/api/game`.

### `GET /api/game/session`

Создать или получить анонимную игровую сессию.

**Auth:** необязательна. Если авторизован — привязать `user_id`.  
**Cookie input:** `game_session_id` (если есть — вернуть существующую сессию).  
**Cookie output:** устанавливает `game_session_id` (httpOnly, SameSite=Lax).

**Response 200:**
```json
{
  "session_id": "uuid",
  "status": "pending",
  "move_count": 0,
  "max_moves": 12,
  "pseudonym": null
}
```

**Response 200 (existing active session):**
```json
{
  "session_id": "uuid",
  "status": "active",
  "move_count": 4,
  "max_moves": 12,
  "current_question": {
    "text": "Когда тебя критикуют...",
    "choices": ["А", "Б", "В"],
    "move": 4
  },
  "pseudonym": "Тихо Паникующий Енот 42"
}
```

---

### `POST /api/game/landing-answer`

Записать ответ пользователя в лендинг-тесте и вернуть следующий вопрос.

**Auth:** не требуется.  
**Cookie input:** `game_session_id` (создаётся если нет).

**Request body:**
```json
{
  "question_text": "Когда тебя критикуют...",
  "choice_index": 1,
  "landing_question_num": 1
}
```

**Response 200:**
```json
{
  "next_question": {
    "text": "В воскресенье вечером ты...",
    "choices": ["А", "Б", "В"],
    "question_num": 2
  },
  "redirect_to_game": false,
  "message": null
}
```

**Response 200 (≥5 ответов или триггер перехода):**
```json
{
  "next_question": null,
  "redirect_to_game": true,
  "message": "Ника уже кое-что поняла. Продолжим?"
}
```

---

### `WS /ws/game/{session_id}`

Основной WebSocket канал игры.

**Auth:** query param `?token=` (опционально) или cookie `access_token`.

#### Клиент → сервер

```json
{ "type": "answer", "choice": 2 }
```
- `choice`: индекс 0, 1 или 2.

#### Сервер → клиент

| Тип | Когда | Структура |
|-----|-------|-----------|
| `thinking` | сразу после получения ответа | `{"type":"thinking"}` |
| `question` | следующий ход готов | `{"type":"question","text":"...","choices":["A","B","C"],"move":N}` |
| `result` | игра завершена | `{"type":"result","scenario":"A"\|"B","confidence":0.87,"topic":"anxiety","topic_label":"тревога","moves":N,"time_seconds":T}` |
| `error` | ошибка | `{"type":"error","message":"..."}` |
| `crisis` | кризис | `{"type":"crisis","contacts":[...]}` |
| `fallback` | LLM недоступен, используем статику | `{"type":"fallback","reason":"timeout"}` |

---

### `GET /api/game/leaderboard`

**Auth:** не требуется.  
**Query:** `?limit=20&offset=0`

**Response 200:**
```json
{
  "entries": [
    {
      "rank": 1,
      "pseudonym": "Упрямо Оптимистичный Бобёр 77",
      "moves": 12,
      "score": 170,
      "scenario": "B",
      "time_seconds": 183
    }
  ],
  "total": 1543,
  "my_rank": 47,
  "my_entry": { ... }
}
```

`my_rank` и `my_entry` — только если `game_session_id` cookie присутствует.

---

### `POST /api/game/pseudonym`

Назначить или сменить псевдоним для текущей сессии.

**Request body:**
```json
{
  "type": "generated",         // "generated" | "ironic" | "custom"
  "custom_name": null,         // только при type=custom
  "visible_in_leaderboard": true
}
```

**Response 200:**
```json
{
  "pseudonym": "Тихо Паникующий Енот 42",
  "pseudonym_id": "uuid"
}
```

---

### `POST /api/game/session/{session_id}/reset`

Сбросить сессию (Сценарий A «Нет, сыграем снова!»).

**Auth:** cookie `game_session_id` обязателен.

**Response 200:**
```json
{ "session_id": "uuid", "status": "active", "move_count": 0 }
```

---

## 7.2 Rate Limiting

| Эндпоинт | Лимит |
|----------|-------|
| `POST /api/game/landing-answer` | 30 запросов / минуту / IP |
| `WS /ws/game/{id}` (ответы) | 10 сообщений / минуту / сессия |
| `GET /api/game/leaderboard` | 60 запросов / минуту / IP |
| `POST /api/game/pseudonym` | 5 запросов / минуту / сессия |

Реализуется через существующий механизм slowapi в backend.

---

## 7.3 Обработка ошибок

| HTTP | Ситуация |
|------|---------|
| 404 | session_id не найден |
| 409 | сессия уже завершена, нельзя дать ответ |
| 422 | невалидный choice (не 0,1,2) |
| 429 | превышен rate limit |
| 503 | LLM API недоступен (возвращается вместе с `fallback_question`) |

При 503 — ответ содержит fallback вопрос из статического набора, игра не прерывается.

---

## 7.4 Интеграция с существующими роутерами

- Новый роутер `game.py` подключается в `main.py`: `app.include_router(game_router, prefix="/api/game")`.
- WebSocket регистрируется там же: `app.add_websocket_route("/ws/game/{session_id}", game_ws_handler)`.
- Кризисный детектор — переиспользуется из `orchestrator.py`.
- JWT декодирование — переиспользуется из `services/auth.py`.

---

## 7.5 Фоновые задачи

### Очистка устаревших сессий

Background task в FastAPI (lifespan), запускается раз в 30 минут:
```python
async def cleanup_old_game_sessions():
    cutoff = datetime.utcnow() - timedelta(hours=2)
    await db.execute(
        delete(GameSession)
        .where(GameSession.updated_at < cutoff)
        .where(GameSession.status == "active")
    )
```

### Очистка ответов лендинга

Раз в час удаляет `LandingAnswer` старше 24 часов.

### Сброс бюджетного счётчика

1-е число каждого месяца — `BudgetTracker.monthly_spend = 0.0`.
