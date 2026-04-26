# PsyHo — План улучшений v3


## Блок 1: Психографика — профиль личности

### Концепция

После нескольких сессий в профиле появляется живая «карта» пользователя: 6 психологических измерений, обновляемых LLM-анализом, визуализированных радарной диаграммой + мини-трендами. Это главная новая ценность продукта — пользователь видит свой прогресс.

### 1.1 Шесть измерений

| ID | Название | Что измеряет |
|----|----------|--------------|
| `self_awareness` | Самоосознанность | Понимает ли паттерны, рефлексирует ли |
| `emotional_regulation` | Эмоциональная регуляция | Управление эмоциями, дистресс-толерантность |
| `self_compassion` | Самосострадание | Жёсткий внутренний критик vs бережность |
| `acceptance` | Принятие | Борьба с реальностью vs готовность встретить |
| `values_clarity` | Ясность ценностей | Понимание что важно, курс жизни |
| `resourcefulness` | Ресурсность | Ощущение сил, агентность, не беспомощность |

Каждое: 0–100. Показывается только если ≥ 3 завершённых сессий.

### 1.2 Backend

**Новая модель** (`models/models.py`):
```python
class PersonalitySnapshot(Base):
    __tablename__ = "personality_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    self_awareness: Mapped[int] = mapped_column(Integer, default=50)
    emotional_regulation: Mapped[int] = mapped_column(Integer, default=50)
    self_compassion: Mapped[int] = mapped_column(Integer, default=50)
    acceptance: Mapped[int] = mapped_column(Integer, default=50)
    values_clarity: Mapped[int] = mapped_column(Integer, default=50)
    resourcefulness: Mapped[int] = mapped_column(Integer, default=50)
    dominant_theme: Mapped[str | None] = mapped_column(String(50))
    summary_note: Mapped[str | None] = mapped_column(Text)
```

**Новый сервис** `services/personality_service.py`:
```python
PERSONALITY_PROMPT = """
Проанализируй память о пользователе и историю сессий.
Оцени каждое измерение от 0 до 100.
0 = острая проблема / полное отсутствие, 50 = средний уровень, 100 = высокий ресурс.
Будь реалистичен — большинство людей в терапии в диапазоне 20–65.

Память: {memory}
Темы сессий: {themes}
Настроение (последние записи): {mood_trend}

Верни JSON:
{
  "self_awareness": int,
  "emotional_regulation": int,
  "self_compassion": int,
  "acceptance": int,
  "values_clarity": int,
  "resourcefulness": int,
  "dominant_theme": "anxiety|relationships|self_esteem|...",
  "summary_note": "1-2 предложения о текущем состоянии"
}
"""

async def compute_personality_snapshot(user_id: str, db: AsyncSession) -> PersonalitySnapshot | None:
    # Берёт long_term_memory, последние 10 session titles, последние 5 mood entries
    # Вызывает ZAI_SMALL_MODEL
    # Сохраняет PersonalitySnapshot
    # Возвращает или None если данных мало
```

**Триггер:** фоновая задача после фазы CLOSE (`messages.py` → `asyncio.create_task(compute_personality_snapshot(...))`), но не чаще раз в 3 дня.

**Новый endpoint** `routers/personality.py`:
- `GET /user/me/personality` → последний снапшот + история (последние 5)
- `GET /user/me/personality/history` → все снапшоты (для трендов)

### 1.3 Frontend — `pages/PersonalityPage.tsx`

**Новый маршрут:** `/personality`

**Структура страницы:**

```
┌──────────────────────────────────────────┐
│  ← Назад    Мой психопортрет             │
├──────────────────────────────────────────┤
│                                          │
│         [радар SVG, 300×300]             │
│    6 осей, заполнение до значения/100    │
│                                          │
├──────────────────────────────────────────┤
│  Самоосознанность    ████████░░  74      │
│  Эмоц. регуляция     █████░░░░░  52      │
│  Самосострадание     ███░░░░░░░  31 ↑    │  ← стрелка тренда
│  Принятие            ██████░░░░  61      │
│  Ясность ценностей   ████░░░░░░  43      │
│  Ресурсность         ███████░░░  68      │
├──────────────────────────────────────────┤
│  "Сейчас в фокусе: самосострадание.      │
│   Ты делаешь заметные шаги."            │
└──────────────────────────────────────────┘
```

**Радар SVG** — кастомный, без recharts (не добавляем зависимостей):
- 6 осей, равномерно по кругу
- Полигон заливки с `opacity: 0.25`, обводка `stroke`
- Анимация: polygon `strokeDashoffset` при первом рендере
- Цвет: `#B8785A` (терракота)

**Тренды:** маленькие спарклайны (3–5 точек) рядом с каждой метрикой — или просто стрелка ↑↓ если была предыдущая точка.

**Ссылка:** в `Sidebar.tsx` рядом с «Профиль» добавить «Психопортрет» с иконкой `BarChart2`.

**Файлы:**
- новый `backend/app/models/models.py` (PersonalitySnapshot)
- новый `backend/app/services/personality_service.py`
- новый `backend/app/routers/personality.py`
- `backend/app/routers/messages.py` (trigger)
- `backend/app/database.py` (ALTER TABLE)
- новый `frontend/src/pages/PersonalityPage.tsx`
- `frontend/src/components/chat/Sidebar.tsx` (ссылка)
- `frontend/src/App.tsx` (маршрут `/personality`)

---

## Блок 2: Admin Dashboard — аналитика

### 2.1 Текущее состояние
`GET /admin/stats` возвращает только 3 числа: users, sessions, messages. Фронтенд Admin.tsx — неизвестен.

### 2.2 Новые backend endpoint'ы

Расширить `routers/admin.py`:

```
GET /admin/stats/extended
  → {
      users_total, users_last_7d, users_last_30d,
      sessions_last_7d, sessions_last_30d,
      avg_session_length_exchanges,
      avg_mood_last_30d,
      agent_usage: {"cbt": 342, "somatic": 289, ...},
      top_topics: [{"topic": "anxiety", "count": 145}, ...],
      daily_sessions: [{"date": "2026-04-20", "count": 23}, ...]  ← 30 дней
    }
```

Реализация через SQL-агрегации (COUNT, GROUP BY, no ORM magic needed), без новых зависимостей.

### 2.3 Frontend — расширить `pages/Admin.tsx`

**Добавить секции:**

1. **DAU/MAU chart** — sparkline 30 дней, кастомный SVG (те же что для профиля)
2. **Agent usage** — горизонтальные bar charts (flex + width%), 6 агентов
3. **Top topics** — список с цветными пилюлями
4. **Avg mood** — большой emoji + число (если есть данные)
5. **Avg session length** — «12 обменов в среднем»

Всё без recharts — простые кастомные SVG или flex-прогресс-бары. Минимализм в духе приложения.

**Файлы:** `backend/app/routers/admin.py`, `frontend/src/pages/Admin.tsx`

---

## Блок 3: «Маяки» — задачи между сессиями

### Концепция

При CLOSE-фазе Ника предлагает конкретную практику. Это сохраняется как «маяк» — задача до следующей сессии. Перед новой сессией пользователь видит её и отмечает выполнено/нет.

### Backend

**Новая модель** (`models/models.py`):
```python
class SessionTask(Base):
    __tablename__ = "session_tasks"
    id: Mapped[str] = ...
    user_id: Mapped[str] = ...
    session_id: Mapped[str] = ...  # из какой сессии
    text: Mapped[str] = ...        # текст задачи от Ники
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = ...
```

**Эндпоинты** `routers/tasks.py`:
- `GET /tasks/pending` → незавершённые задачи пользователя
- `PATCH /tasks/{task_id}/complete` → отметить выполненной
- `POST /tasks` → создать (вызывается из messages.py при CLOSE-фазе)

**Триггер:** в `orchestrator.py` при `phase == CLOSE`, после завершения синтеза — парсим ответ для поиска домашнего задания и сохраняем через `create_task()`. Или проще: отдельный LLM-вызов на экстракцию задачи из CLOSE-ответа.

### Frontend

**В `MessageList.tsx`:** при старте новой сессии (empty state), если есть pending tasks — показывать карточку:
```
╔══════════════════════════════╗
║  Маяк с прошлой сессии       ║
║                              ║
║  «Попробовать технику 4-7-8  ║
║   перед сном в течение 3     ║
║   дней»                      ║
║                              ║
║  [Выполнено ✓]  [Пропустить] ║
╚══════════════════════════════╝
```

Нет задач → не показывается.

**Файлы:** новый `backend/app/models/models.py`, `backend/app/routers/tasks.py`, `backend/app/routers/messages.py` (экстракция при CLOSE), `frontend/src/components/chat/MessageList.tsx`, новый `frontend/src/components/chat/PendingTaskCard.tsx`

---

## Блок 4: UX-полировка

### 4.1 Dark Mode

**Хранение:** `localStorage` + `class="dark"` на `<html>`.
**Цвета dark mode:**
- Фон: `#2A2420` (тёплый почти-чёрный)
- Поверхности: `#352E2A`
- Текст: `#F5EDE4`
- Акцент: `#C08B68` (светлее текущего)
- Бейджи агентов: чуть темнее + светлый текст

**Реализация:** добавить `ThemeProvider` или просто `useTheme()` hook в `store/theme.ts`. Все `bg-[#FAF6F1]` конвертировать в Tailwind `dark:bg-[#2A2420]` классы.

Кнопка переключения в `Sidebar.tsx` (иконка Moon/Sun).

**Файлы:** новый `frontend/src/store/theme.ts`, `frontend/src/index.css`, все chat-компоненты (добавить dark: классы), `Sidebar.tsx`

---

### 4.2 Inline редактирование названия сессии

**Проблема:** название сессии нельзя переименовать из sidebar.

**Решение:** в `Sidebar.tsx` при двойном клике на название — inline `<input>` с тем же стилем. Enter/blur → `PATCH /sessions/{id}`.

**Файлы:** `Sidebar.tsx`, `hooks/useSessions.ts` (useUpdateSession mutation уже может быть)

---

### 4.3 Browser Notifications

Когда пользователь переключился на другую вкладку и Ника закончила ответ → `Notification API` уведомление.

**Реализация в `useChat.ts`:**
```typescript
// При получении "done" события:
if (document.hidden && Notification.permission === "granted") {
  new Notification("Ника ответила", { icon: "/icons/pwa-192.svg" });
}
```
Запрос разрешения: один раз при первом открытии чата.

**Файлы:** `hooks/useChat.ts`, `pages/Chat.tsx`

---

### 4.4 Клавиатурные сочетания

| Сочетание | Действие |
|-----------|---------|
| `Cmd/Ctrl + K` | Новый разговор |
| `Escape` | Закрыть открытый оверлей (ActionPanel, breathing, etc.) |
| `Cmd/Ctrl + /` | Открыть/закрыть панель действий |

**Реализация:** глобальный `useKeyboardShortcuts()` hook в `Chat.tsx`.

**Файлы:** новый `frontend/src/hooks/useKeyboardShortcuts.ts`, `Chat.tsx`

---

## Приоритеты

| # | Задача | Усилие | Приоритет |
|---|--------|--------|-----------|
| 1 | Психографика: backend (модель + сервис + endpoints) | L | ВЫСОКИЙ |
| 2 | Психографика: frontend (радар + страница + sidebar) | L | ВЫСОКИЙ |
| 3 | Admin Dashboard расширение | M | ВЫСОКИЙ |
| 4 | Маяки: модель + endpoints + экстракция из CLOSE | M | СРЕДНИЙ |
| 5 | Маяки: frontend (PendingTaskCard в MessageList) | S | СРЕДНИЙ |
| 6 | Dark mode | M | СРЕДНИЙ |
| 7 | Inline rename сессии | XS | СРЕДНИЙ |
| 8 | Browser notifications | XS | НИЗКИЙ |
| 9 | Keyboard shortcuts | XS | НИЗКИЙ |

---

## Ключевые файлы

**Backend:**
- `backend/app/models/models.py` — PersonalitySnapshot, SessionTask
- `backend/app/services/personality_service.py` — НОВЫЙ
- `backend/app/routers/personality.py` — НОВЫЙ
- `backend/app/routers/tasks.py` — НОВЫЙ
- `backend/app/routers/admin.py` — extended stats
- `backend/app/routers/messages.py` — триггер personality + task extraction
- `backend/app/database.py` — ALTER TABLE для новых колонок

**Frontend:**
- `frontend/src/pages/PersonalityPage.tsx` — НОВЫЙ
- `frontend/src/pages/Admin.tsx` — расширить
- `frontend/src/components/chat/PendingTaskCard.tsx` — НОВЫЙ
- `frontend/src/components/chat/MessageList.tsx` — показывать PendingTaskCard
- `frontend/src/components/chat/Sidebar.tsx` — ссылка на психопортрет, dark toggle, inline rename
- `frontend/src/store/theme.ts` — НОВЫЙ
- `frontend/src/hooks/useKeyboardShortcuts.ts` — НОВЫЙ
- `frontend/src/App.tsx` — маршрут /personality

---

## Верификация

1. **Психографика:** провести 3+ сессии → GET /user/me/personality возвращает 6 чисел → `/personality` рендерит радар с анимацией → метрики меняются после новой сессии
2. **Admin:** `/admin/stats/extended` возвращает agent_usage и daily_sessions → Admin.tsx показывает bar chart агентов
3. **Маяки:** довести сессию до CLOSE-фазы → POST /tasks создаётся автоматически → следующий сеанс показывает PendingTaskCard → клик «Выполнено» меняет completed=true
4. **Dark mode:** нажать иконку Moon → вся UI переключается → localStorage сохраняет → обновление страницы сохраняет тему
5. **Inline rename:** двойной клик на название в сайдбаре → input → Enter → PATCH обновляет
