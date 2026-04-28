# PsyHo — План исправления багов v4 + новые идеи

## Контекст

Пользователь нашёл 12 багов в реализации v3 и просит их исправить. Дополнительно — список из 10+ новых фич.

---

## Блок A: Исправление 12 багов

### A1. Ника прощается слишком рано (17-й обмен из 20)

**Причина:** `PHASE_INSTRUCTIONS[SessionPhase.CLOSE]` содержит фразу «Это последний обмен», что буквально заставляет LLM прощаться. CLOSE стартует на 90% = обмен 18, но ощущается как финальный уже на 17-м.

**Файл:** `backend/app/agents/orchestrator.py` строки 41–44

**Исправление:** Переписать CLOSE-инструкцию — убрать «последний обмен», добавить явный запрет прощаться:
```python
SessionPhase.CLOSE: (
    "ЗАДАЧА CLOSE: Мы подходим к завершению сессии, но НЕ прощайся и не заканчивай разговор — "
    "пользователь может ответить ещё. Сделай:\n"
    "1. Краткое резюме: что прояснилось в этой сессии\n"
    "2. 1 конкретная домашняя задача / практика\n"
    "3. Оставайся открытой — если человек ответит, продолжи естественно."
),
```

---

### A2. Неверный счётчик при повторном входе (10/20) + чат не блокируется

**Причина A (счётчик):** `initialExchangeCount = messages.filter(m => m.role === "user").length` считает только загруженные сообщения (лимит 50), а не реальное количество обменов в БД.

**Причина B (блокировка):** Нет проверки `exchange_count >= max_exchanges` ни на бэкенде в ответе, ни на фронтенде.

**Файлы:**
- `backend/app/schemas/session.py` — добавить `exchange_count: int = 0` в `SessionDetailResponse`
- `backend/app/routers/sessions.py` — в `GET /{session_id}` добавить COUNT user-сообщений и вернуть в ответе
- `frontend/src/types/index.ts` — добавить `exchange_count?: number` в `SessionDetail`
- `frontend/src/pages/Chat.tsx` — использовать `currentSession.exchange_count` для `initialExchangeCount`; вычислять `isSessionCompleted = displayExchangeCount >= displayMaxExchanges`; передавать `disabled={... || isSessionCompleted}` в InputBar и ActionPanel
- `frontend/src/components/chat/SessionProgress.tsx` — когда `isDone`, показывать текст «Сессия завершена» вместо `return null`

**Backend (sessions.py):**
```python
count_result = await db.execute(
    select(func.count()).where(Message.session_id == session_id, Message.role == "user")
)
exchange_count = count_result.scalar() or 0
return SessionDetailResponse(..., exchange_count=exchange_count, ...)
```

---

### A3. Нижняя секция чата слишком контрастна в тёмной теме

**Причина:** `InputBar.tsx` не имеет ни одного `dark:` класса.

**Файл:** `frontend/src/components/chat/InputBar.tsx`

**Исправление** — добавить dark-варианты:
- Внешний контейнер: `dark:bg-[#2A2420] dark:border-[#4A4038]`
- Внутренний pill (`rounded-[24px]`): `dark:bg-[#352E2A] dark:border-[#4A4038]`
- Textarea: `dark:text-[#F5EDE4] dark:placeholder:text-[#6A5A4A]`
- Кнопки (actions toggle, voice): `dark:border-[#4A4038] dark:bg-[#352E2A] dark:text-[#B8A898] dark:hover:bg-[#4A4038]`

---

### A4. Заменить эмодзи на иллюстрации в ActionPanel

**Доступные файлы:** `/illustrations/opt/action_breathe.webp`, `action_insight.webp`, `action_exercise.webp`, `action_journal.webp`

**Файл:** `frontend/src/components/chat/ActionPanel.tsx`

**Исправление:** Обновить массив CARDS — добавить поле `image` вместо `emoji`. В рендере:
```tsx
<img src={`/illustrations/opt/${card.image}.webp`} alt={card.label} className="h-10 w-10 object-contain" />
```
Маппинг: breathe→action_breathe, insight→action_insight, exercise→action_exercise, distract→action_journal

---

### A5. Главная страница пропала — редирект сразу на /auth

**Причина:** `App.tsx` строка 47: `<Route path="/" element={<Navigate to="/auth" replace />} />`
`Landing.tsx` существует и корректно обрабатывает оба состояния (auth / non-auth).

**Файл:** `frontend/src/App.tsx`

**Исправление:**
```tsx
<Route path="/" element={<Landing />} />
```

---

### A6. Тултипы агентов не центрированы (уходят вправо)

**Причина:** Framer Motion при анимации `y` перезаписывает CSS `transform`, что отменяет Tailwind `-translate-x-1/2` на `<motion.span>`. Итог — тултип не сдвигается влево.

**Файл:** `frontend/src/components/chat/AgentBadge.tsx`

**Исправление:** Разделить позиционирование и анимацию — внешний обычный `<span>` центрирует (с `-translate-x-1/2`), внутренний `<motion.span>` анимирует только `opacity`/`y`:
```tsx
<span className="absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 block">
  <motion.span
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 4 }}
    transition={{ duration: 0.15 }}
    className="relative block whitespace-nowrap rounded-lg bg-[#5A5048] px-2.5 py-1.5 text-[11px] leading-tight text-white shadow-lg"
  >
    {agent.tooltip}
    <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#5A5048]" />
  </motion.span>
</span>
```

---

### A7. Завершать сессию раньше, если пользователь прощается

**Файл:** `backend/app/routers/messages.py`

**Исправление:** Добавить функцию определения прощания и вызвать её после отправки ответа:
```python
FAREWELL_KEYWORDS = {
    "пока", "до свидания", "досвидания", "до встречи", "спасибо большое",
    "всё, спасибо", "всё спасибо", "спасибо, всё", "на этом всё",
    "bye", "goodbye", "до следующего раза", "спасибо за сессию",
}

def _is_farewell(message: str, exchange_count: int) -> bool:
    if exchange_count < 5:
        return False
    msg = message.lower().strip()
    return any(kw in msg for kw in FAREWELL_KEYWORDS) and len(msg) < 80
```

После блока `await websocket.send_json({"type": "done", ...})`:
```python
if _is_farewell(content, exchange_count):
    await websocket.send_json({"type": "session_limit_reached"})
```

---

### A8. Запретить писать в завершённых сессиях

Решается совместно с A2. В `Chat.tsx`:
```tsx
const isSessionCompleted = displayExchangeCount > 0 && displayExchangeCount >= displayMaxExchanges;
```
Передать `disabled={isStreaming || awaitingGreeting || isSessionCompleted}` в InputBar и ActionPanel.

Опционально: в `MessageList.tsx` в пустом состоянии завершённой сессии — убрать welcome-сообщение и показать «Эта сессия завершена. Начни новую или продолжи её».

---

### A9. Текст радарной диаграммы перекрывается белым

**Причина:** SVG 300×300 со стандартным `overflow: hidden`; labels выходят за границы при `textAnchor="middle"`.

**Файл:** `frontend/src/pages/PersonalityPage.tsx`

**Исправление:**
1. Добавить `overflow="visible"` к тегу `<svg>`
2. Обернуть SVG-контейнер в div с `px-10` для горизонтального отступа
3. Использовать сокращённые метки в SVG (полные уже есть в списке ниже):

```tsx
const DIM_SVG_LABEL: Record<string, string> = {
  self_awareness: "Осознан.",
  emotional_regulation: "Эмоц. рег.",
  self_compassion: "Самосостр.",
  acceptance: "Принятие",
  values_clarity: "Ясность цен.",
  resourcefulness: "Ресурсность",
};
// В рендере <text>: {DIM_SVG_LABEL[dim.key]}
```

---

### A10. Баблы сообщений слишком контрастны в тёмной теме

**Причина:** `MessageItem.tsx` — нет `dark:` классов на пузырях.

**Файл:** `frontend/src/components/chat/MessageItem.tsx`

**Исправление:**
- Сообщение пользователя: добавить `dark:bg-[#7A5040]` (приглушённая терракота)
- Сообщение ассистента: добавить `dark:bg-[#352E2A] dark:border-[#4A4038] dark:text-[#F5EDE4]`
- Prose-контент внутри ассистентского бабла: добавить `dark:prose-invert` или явный `dark:text-[#F5EDE4]`

---

### A11. Markdown не рендерится в тултипе истории сессий

**Причина:** Sidebar.tsx выводит `session.summary` как plain text — `**жирное**` отображается буквально со звёздочками.

**Файл:** `frontend/src/components/chat/Sidebar.tsx`

**Исправление:** Добавить утилиту и применить к тексту тултипа:
```tsx
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`(.*?)`/g, '$1');
}
// Использование:
{stripMarkdown(session.summary.slice(0, 200))}
```

---

### A12. Карусель дыхательных упражнений не зацикливается

**Причина:** `prev()` и `next()` проверяют границы (`currentIdx === 0` / `=== EXERCISES.length - 1`) и не переходят дальше.

**Файл:** `frontend/src/components/chat/BreathingExercise.tsx` строки 292–293

**Исправление:**
```tsx
const prev = () => goTo((currentIdx - 1 + EXERCISES.length) % EXERCISES.length);
const next = () => goTo((currentIdx + 1) % EXERCISES.length);
```
Убрать `disabled` пропы с кнопок.

---

## Блок Б: 12 новых идей для продукта

### Б1. «Мои открытия» — коллекция инсайтов из сессий
При CLOSE-фазе LLM извлекает 1 ключевую цитату/наблюдение из сессии. Накапливаются в `/insights`. Пользователь видит хронологию своих открытий — это мощный мотиватор продолжать: видеть как ты менялся.

### Б2. Таймер медитации / тишины
Страница или ActionPanel: 5 / 10 / 15 / 20 минут → тихий таймер с мягким прогрессом, финальный звук (Web Audio API, 432 Гц). Нет AI, нет запросов — чистый инструмент. Дополняет дыхательные практики.

### Б3. Режим «Сейчас плохо» (Fast Support)
Кнопка на главном экране: «Мне сейчас плохо». Ника открывает экстренный режим без INTAKE — сразу даёт 2-3 техники заземления и слушает. Ценность: человеку в шторм неудобно отвечать на уточняющие вопросы.

### Б4. Поиск по истории переписки
Поле поиска в сайдбаре → `GET /sessions/search?q=` → SQLite FTS5 по содержимому сообщений. Очень полезно: «найди где Ника говорила про границы», «вспомнить технику дыхания».

### Б5. Прогресс-марафоны (7 / 14 / 21 день)
Пользователь выбирает марафон («Снижение тревоги», «Лучше спать»). Каждый день — задание от Ники. Прогресс: `[●●●○○○○]`. Структурирует работу и создаёт ежедневный повод открыть приложение.

### Б6. Экспорт сессии в PDF / Markdown
Кнопка в сайдбаре рядом с уже существующим Download. Красиво оформленный PDF (через `window.print()` + `@media print` стили или `jsPDF`). Архивирование, показ терапевту, личный дневник.

### Б7. Еженедельный дайджест
Каждое воскресенье LLM генерирует итог недели: темы, тренд настроения, выполненные Маяки, изменение психопортрета. Карточка на главной. Опционально — email.

### Б8. Достижения / бейджи
Признание прогресса без игрового давления: «Психопортрет разблокирован», «7 дней подряд», «10 сессий», «Маяк выполнен», «Попробовал 4-7-8». Раздел в профиле. Увеличивает retention.

### Б9. Голосовой ответ Ники (Text-to-Speech)
Кнопка «Прослушать» рядом с сообщением ассистента → Web Speech API `SpeechSynthesis`, голос ru-RU. Бесплатно, без API. Особенно полезно ночью на телефоне — «услышать» Нику перед сном.

### Б10. Утренний мини-чекин (Quick Check-in)
Отдельный режим: 3 вопроса за 30 сек: «Как настроение?» (слайдер), «Что сейчас занимает?» (1 фраза), «Фокус дня?» (5 карточек). Ника даёт 1 короткое напутствие. Без полной сессии — быстрый ритуал.

### Б11. Темы оформления чата
3 дополнительных темы помимо light/dark: «Лес» (зелёная гамма), «Океан» (синяя), «Рассвет» (оранжево-розовая). Хранится в localStorage. Повышает личную привязанность к приложению.

### Б12. Публичный снапшот инсайтов (Share)
Пользователь генерирует ссылку на анонимную страницу с выбранными инсайтами/цитатами из сессий — без полного чата. Помогает поделиться прогрессом с реальным терапевтом или близким человеком.

---

## Критические файлы

**Backend:**
- `backend/app/agents/orchestrator.py` — A1
- `backend/app/schemas/session.py` — A2
- `backend/app/routers/sessions.py` — A2
- `backend/app/routers/messages.py` — A7

**Frontend:**
- `frontend/src/App.tsx` — A5
- `frontend/src/pages/Chat.tsx` — A2, A8
- `frontend/src/types/index.ts` — A2
- `frontend/src/components/chat/InputBar.tsx` — A3
- `frontend/src/components/chat/ActionPanel.tsx` — A4
- `frontend/src/components/chat/AgentBadge.tsx` — A6
- `frontend/src/pages/PersonalityPage.tsx` — A9
- `frontend/src/components/chat/MessageItem.tsx` — A10
- `frontend/src/components/chat/Sidebar.tsx` — A11
- `frontend/src/components/chat/BreathingExercise.tsx` — A12
- `frontend/src/components/chat/SessionProgress.tsx` — A2

---

## Верификация

1. **A1:** Довести до 18-го обмена — Ника не прощается, продолжает тему
2. **A2+A8:** Открыть завершённую сессию — показывает 20/20, InputBar неактивен
3. **A3+A10:** Тёмная тема — InputBar и баблы мягкие, без резкого белого
4. **A4:** Открыть ActionPanel — видны иллюстрации вместо эмодзи
5. **A5:** Перейти на `/` без авторизации — отображается Landing
6. **A6:** Навести на бейдж агента — тултип по центру над бейджем
7. **A7:** Написать «пока, спасибо» после 6-го обмена — SessionEndCard
8. **A9:** Открыть `/personality` — все 6 подписей осей видны полностью
9. **A11:** Навести на сессию с summary — текст без `**звёздочек**`
10. **A12:** Нажать «>» на последнем упражнении — переход к первому
