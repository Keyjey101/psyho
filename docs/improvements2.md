# PsyHo — Анализ и план улучшений

## Context

Запрос: комплексный анализ приложения и конкретные рекомендации по 9 направлениям — дизайн, производительность загрузки, UX, токены, качество ответов, агентная архитектура (LangGraph?), ограниченные сессии, кризисный детектор (отложен), кнопки действий.

Исследованы: весь frontend (Chat.tsx, ActionPanel.tsx, все chat-компоненты, Tailwind, Vite), весь backend AI-слой (orchestrator.py, base.py, все .txt промпты, messages.py, context.py, memory_service.py), модели данных и конфиг.

---

## 1. Дизайн

**Найденные проблемы:**
- `vite.config.ts` → PWA theme_color = `#818cf8` (индиго), тогда как вся палитра — тёплые терракоты (`#B8785A`). Нужно поменять на `#B8785A`.
- Нет `prefers-reduced-motion` — Framer Motion анимации воспроизводятся у пользователей с вестибулярными нарушениями.
- Низкий контраст у agent-бейджей (warm-700 on warm-50), не проходит WCAG AA.
- `ConversationMode.tsx` и `ExportChat.tsx` существуют, но не подключены к `Chat.tsx`.

**Что сделать:**
1. `vite.config.ts`: поменять `theme_color` на `#B8785A`.
2. `index.css` + все анимированные компоненты: добавить `@media (prefers-reduced-motion: reduce)` — выключить Framer transitions.
3. Agent badge цвета: поднять контраст до AA-уровня (использовать более тёмный фон или текст).
4. Подключить `ExportChat.tsx` в меню сессии (sidebar dropdown).

---

## 2. Быстродействие загрузки

**Найденные проблемы:**
- `chat_welcome.webp` — 373 KB, без LQIP/placeholder, `loading="eager"`.
- Google Fonts (`Inter` + `Literata`) загружаются через `@import` в `index.css` — блокируют рендер.
- Bundle не имеет явных chunk hints (только дефолтный Vite splitting).
- BreathingExercise.tsx пересчитывает SVG-пути на каждый рендер — `useMemo` отсутствует.

**Что сделать:**
1. `index.html`: перенести шрифты в `<link rel="preconnect">` + `<link rel="preload" as="style">` вместо CSS `@import`.
2. Добавить `<link rel="preload">` для welcome-иллюстрации (критический LCP).
3. `BreathingExercise.tsx`: обернуть статические SVG path-вычисления в `useMemo`.
4. `vite.config.ts`: явно выделить `vendor` chunk для `framer-motion` (крупнейшая зависимость ~300 KB) через `build.rollupOptions.output.manualChunks`.

---

## 3. Пользовательский опыт

**Проблемы:**
- На мобильном клавиатура открывается, но нет `scrollIntoView` к полю ввода.
- `context_compressed` WebSocket событие приходит, но в UI нет никакого фидбека.
- Sidebar (список сессий) не виртуализирован — при 100+ сессиях залагает.
- `MoodTracker.tsx` и `TechniquesLibrary.tsx` существуют, но не вшиты в основной чат.

**Что сделать:**
1. `InputBar.tsx`: на focus добавить `inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })`.
2. `useChat.ts`: при получении `context_compressed` показывать недорогой toast «Контекст оптимизирован».
3. `Sidebar.tsx`: заменить рендер списка сессий на `react-window` или `react-virtual` (или просто пагинацию — показывать 20 последних с кнопкой «загрузить ещё»).
4. После завершения сессии (см. п. 7) показать `MoodTracker` — одноразовый post-session check.

---

## 4. Оптимизация токенов

**Текущее потребление:** ~8 000 токенов/сообщение:
- Классификация темы: ~400 токенов (каждый раз)
- 2 агента × 2 500 токенов = ~5 000 токенов
- Извлечение памяти: ~500 токенов (каждый раз)
- Синтез: ~4 000 токенов input + output

**Конкретные оптимизации:**

### A. Память в фоне, батчами
Файл: `routers/messages.py:252–262`  
Текущее: `await update_memory(...)` после каждого ответа.  
Нужно: переместить в `asyncio.create_task()` + вызывать раз в 3 сообщения (счётчик в сессии).

### B. Кэш классификации темы
Файл: `agents/orchestrator.py:106–138`  
Нужно: хранить `{session_id: (topics, last_message_hash, timestamp)}` в памяти процесса (dict или `TTLCache`). Если последнее сообщение похоже по embedding или хэшу — пропустить повторную классификацию.  
Проще: пропускать классификацию если пришёл ответ на вопрос агента (нет нового user-инициированного топика).

### C. Скользящее окно summary
Файл: `services/context.py:48`  
Текущее: `session.summary += "\n\n" + new_summary` — резюме растёт неограниченно.  
Нужно: хранить только последние 3 000 символов summary (срезать старое при превышении).

### D. Lazy-load истории
Файл: `routers/messages.py:184–190` и `routers/sessions.py:37–47`  
Нужно: вместо загрузки всей истории — брать только `history[-20:]` в SQL запросе (добавить `LIMIT 20 ORDER BY created_at DESC` + reverse).

### E. Сжатие промптов агентов
Каждый .txt файл промпта: ~750–850 токенов. Для 2 агентов это ~1 600 токенов системного промпта.  
Нужно: сократить каждый промпт агента на ~30% убрав повторяющиеся инструкции в `base.py` как единый пре-амбул.

**Итоговая экономия:** ~2 000–3 000 токенов/сообщение (−25–35%).

---

## 5. Качество ответов

**Текущее состояние промптов:** Высокое — все 6 агентных промптов имеют структурированные цепочки рассуждений, конкретный формат вывода, ограничения модальности. Промпт оркестратора зрелый.

**Что улучшить:**

### A. Разрешение противоречий агентов
Файл: `agents/orchestrator.py:_synthesize()`  
Проблема: агенты могут давать противоречивые советы (CBT: «оспорь мысль»; Somatic: «просто подыши»).  
Нужно: добавить в synthesis-промпт инструкцию: *«Если перспективы агентов противоречат — выбери более безопасную или объедини последовательно (сначала телесное заземление, потом когнитивная работа)»*.

### B. Учёт номера сообщения в сессии
Оркестратор не знает, это 1-е или 15-е сообщение. Нужно передавать `message_number` и `session_max` в synthesis-промпт, чтобы он адаптировал глубину ответа (ранние — широкий сбор запроса, поздние — фокус на закреплении).

### C. Контекстное окно агентов
Файл: `agents/base.py:36`  
Текущее: `history[-10:]`. При 20 сохранённых сообщениях агент видит только половину.  
Нужно: увеличить до `history[-16:]` или передавать `session.summary` в agent.analyze() чтобы агент видел сжатую историю + последние сообщения.

---

## 6. LangGraph — переходить или нет?

### Текущая архитектура
```
message → _classify_topics() → _select_agents() → asyncio.gather(agents) → _synthesize() → stream
```
~300 строк, всё в одном файле, без состояния между ходами.

### Аргументы ЗА LangGraph
- Если реализовывать **ограниченные сессии с фазами** (п. 7) — граф делает переходы явными и тестируемыми.
- Retry и fallback логика встроены.
- Легко добавить «человека в петле» (tool call → pause → resume).
- Визуализация графа для отладки.

### Аргументы ПРОТИВ сейчас
- Overhead: +1 зависимость, другая парадигма, сложнее стримить токены через граф в WebSocket.
- Текущий orchestrator прост и работает. Миграция = риск + время.
- LangGraph хорош для сложных **ветвящихся** агентов; у нас пока линейный fan-out.

### Рекомендация: НЕ мигрировать сейчас, ввести StateGraph-паттерн вручную

Вместо LangGraph — добавить концепцию **session state** прямо в существующий orchestrator:

```python
class SessionPhase(Enum):
    INTAKE = "intake"        # 1-3 сообщения: понять запрос
    FOCUS = "focus"          # 4-6: углубиться, уточнить
    WORK = "work"            # 7-14: основная работа агентов
    INTEGRATION = "integration"  # 15-18: закрепление, homework
    CLOSE = "close"          # 19-20: завершение сессии
```

Оркестратор получает `phase` как параметр и адаптирует промпт. Это 80% пользы LangGraph без накладных расходов.

**Когда перейти на LangGraph:** если появится потребность в tool use (поиск в базе знаний, назначение заданий) или multi-turn планировании внутри одного ответа.

---

## 7. Ограниченные сессии (20 сообщений)

### Концепция
Сессия = 20 обменов (user+assistant). Агент и пользователь оба знают, сколько осталось. Оркестратор меняет поведение в зависимости от фазы.

### Backend изменения

**`models/models.py`:** добавить в `ChatSession`:
```python
max_exchanges: int = 20  # лимит сессии
```

**`config.py`:** добавить `SESSION_MAX_EXCHANGES: int = 20`.

**`agents/orchestrator.py`:**
```python
def _get_phase(exchange_number: int, max_exchanges: int) -> SessionPhase:
    pct = exchange_number / max_exchanges
    if pct < 0.15: return SessionPhase.INTAKE
    if pct < 0.30: return SessionPhase.FOCUS
    if pct < 0.75: return SessionPhase.WORK
    if pct < 0.90: return SessionPhase.INTEGRATION
    return SessionPhase.CLOSE
```

В synthesis-промпте добавить секцию:
```
[ПРОГРЕСС СЕССИИ: обмен {n} из {max}. Фаза: {phase}]
INTAKE: "Мягко исследуй запрос. Задавай уточняющие вопросы. Не торопись с советами."
FOCUS: "У тебя и пользователя ~{remaining} обменов. Фокусируйся на одной теме."
WORK: "Работай конкретно. Давай практические инструменты."
INTEGRATION: "Начинай подводить итоги. Предложи домашнее задание / практику."
CLOSE: "Это последние обмены. Подведи итоги. Предложи продолжить в новой сессии."
```

**`routers/messages.py`:** при `exchange_number >= max_exchanges` → после ответа отправить WebSocket событие `{"type": "session_limit_reached"}`.

**`routers/sessions.py` `/continue`:** создаёт новую сессию со ссылкой на завершённую (уже есть) + сбрасывает счётчик.

### Frontend изменения

**Новый компонент `SessionProgress.tsx`:**
```
[●●●●●●●●●○○○○○○○○○○○]  8 / 20
```
Прогресс-бар в хедере, тонкая полоска 2px под аватаром Ники. При < 4 оставшихся — меняет цвет на `warm-500`.

**`useChat.ts`:** обрабатывать `session_limit_reached` → показать модал с предложением «Продолжить в новой сессии / Завершить».

**`Chat.tsx`:** передавать `exchangeCount` и `maxExchanges` в Header.

---

## 8. Кризисный детектор и дисклеймер врача

Отложено по запросу пользователя.

---

## 9. Кнопки действий — компактная нижняя панель

### Текущее состояние
`ActionPanel.tsx` — полноэкранный оверлей (fixed inset-0), 4 карточки. Открывается через иконку в `InputBar.tsx`.

### Новая концепция: slide-up bottom strip

**Вместо full-screen overlay** — небольшая панель высотой ~80–100px, которая выдвигается снизу над InputBar при нажатии стрелки ↑. Минималистичные кнопки в 1–2 ряда.

```
┌─────────────────────────────────────────────┐
│  🫁 Подышать  💡 Инсайт  🏋️ Упражнение  🎮 Поп-ит  │  ← 1 строка иконка+текст
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│  [Ника ✨] [📝 ] [меню ···]  |  [поле ввода]  [↑] [➤] │  ← InputBar
└─────────────────────────────────────────────────────┘
```

На мобильном — 2 ряда по 2:
```
[🫁 Подышать]   [💡 Инсайт  ]
[🏋️ Упражнение] [🎮 Поп-ит  ]
```

### Реализация `ActionPanel.tsx`

**Убрать:** `fixed inset-0 z-40` контейнер.

**Добавить:** AnimatePresence с motion.div:
```tsx
<motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: 'auto', opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
  className="overflow-hidden border-t border-surface-200"
>
  <div className="flex gap-2 px-4 py-3 bg-surface-50">
    {CARDS.map(card => (
      <button key={card.id}
        className="flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl
                   bg-white/60 hover:bg-white active:scale-95 transition-all
                   text-xs text-surface-600 font-medium"
        onClick={() => handleAction(card)}
      >
        <span className="text-lg">{card.emoji}</span>
        <span>{card.shortLabel}</span>
      </button>
    ))}
  </div>
</motion.div>
```

**`InputBar.tsx`:** кнопка переключения панели — маленькая стрелка `ChevronUp/Down` вместо текущей иконки LayoutGrid. Состояние `isActionsOpen` поднять в `Chat.tsx`.

**Breathing/PopIt оверлеи** — оставить как есть (полноэкранный режим при нажатии на кнопку из панели), только появляются они теперь из компактной панели, а не из full-screen grid.

---

## Приоритеты реализации

| # | Задача | Файлы | Усилие | Приоритет |
|---|--------|-------|--------|-----------|
| 1 | Компактная панель действий (п.9) | `ActionPanel.tsx`, `InputBar.tsx`, `Chat.tsx` | S | HIGH |
| 2 | Ограниченные сессии + прогресс (п.7) | `orchestrator.py`, `models.py`, `messages.py`, новый `SessionProgress.tsx` | M | HIGH |
| 3 | Токены: фоновая память + lazy history (п.4 A,D) | `messages.py`, `routers/sessions.py` | S | HIGH |
| 4 | SessionPhase в промпте оркестратора (п.5 B + п.6) | `orchestrator.py`, `orchestrator.txt` | S | HIGH |
| 5 | Google Fonts preload + vendor chunk (п.2) | `index.html`, `vite.config.ts` | XS | MEDIUM |
| 6 | Summary sliding window (п.4 C) | `services/context.py` | XS | MEDIUM |
| 7 | PWA theme color fix (п.1) | `vite.config.ts` | XS | LOW |
| 8 | `prefers-reduced-motion` (п.1) | `index.css` + компоненты | S | LOW |
| 9 | Sidebar виртуализация (п.3) | `Sidebar.tsx` | S | LOW |

---

## Файлы для изменения

**Backend:**
- `backend/app/agents/orchestrator.py` — SessionPhase, synthesis prompt, exchange awareness
- `backend/app/agents/prompts/orchestrator.txt` — добавить секцию прогресса сессии
- `backend/app/models/models.py` — поле `max_exchanges` в ChatSession
- `backend/app/config.py` — `SESSION_MAX_EXCHANGES`
- `backend/app/routers/messages.py` — `session_limit_reached` событие, async memory
- `backend/app/services/context.py` — summary sliding window
- `backend/app/agents/base.py` — расширить history window до 16

**Frontend:**
- `frontend/src/components/chat/ActionPanel.tsx` — redesign → slide-up strip
- `frontend/src/components/chat/InputBar.tsx` — стрелка вместо grid иконки
- `frontend/src/pages/Chat.tsx` — передавать exchange count, подключить SessionProgress
- `frontend/src/components/chat/SessionProgress.tsx` — НОВЫЙ компонент
- `frontend/vite.config.ts` — theme_color fix, manualChunks
- `frontend/index.html` — preconnect/preload для шрифтов
- `frontend/src/index.css` — `prefers-reduced-motion`

---

## Верификация

1. **Компактная панель:** открыть чат → нажать стрелку вверх → панель выдвигается ~80px → кнопки видны → тест Breathing overlay из панели
2. **Ограниченные сессии:** отправить 20 сообщений → получить `session_limit_reached` → появляется предложение продолжить → новая сессия имеет greeting с инсайтами из закрытой
3. **Токены:** включить логирование в base.py → сравнить token counts до/после lazy history и async memory
4. **Прогресс-бар:** хедер показывает «5 / 20» → прогресс обновляется после каждого ответа → при 3 оставшихся цвет меняется
5. **Vite build:** `npm run build` → проверить chunk sizes в output
