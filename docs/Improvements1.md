# План реализации: AI-Психолог «Ника»

## Context

Приложение — мультиагентный ИИ-психолог на FastAPI + React 19. Нужно провести масштабный апдейт по 6 направлениям: полный редизайн по дизайн-доку «Мел и тепло», женский персонаж Ника, приветственное сообщение, сохранение контекста между агентами, долгосрочная память с переключателем, кнопка продолжения сессии. Всё сопровождается точными цветами, анимациями, микрокопи и типографикой из дизайн-документа.

---

## Часть 1: Дизайн-система «Мел и тепло»

### 1.1 Tailwind — полная замена цветовой палитры

**`frontend/tailwind.config.ts`** — удалить текущие холодные blue/gray тона, заменить на тёплую палитру:

```ts
colors: {
  // Terra Cotta — главный акцент (CTA, активные эл-ты)
  primary: {
    50:  '#FDF5F0', 100: '#FAE8DF', 200: '#F4CEBB',
    300: '#EBB090', 400: '#DE8E68', 500: '#CF7250',
    600: '#B8785A',  // ← основной: terra cotta
    700: '#9E6349', 800: '#854F38', 900: '#6C3D28',
  },
  // Caramel — второстепенный акцент, hover
  warm: {
    50:  '#FEF9F3', 100: '#FDF0E0', 200: '#FAE0C0',
    300: '#F5CC98', 400: '#EDB870', 500: '#D4A574',  // ← caramel
    600: '#C08B58', 700: '#A37040', 800: '#875A30', 900: '#6C4520',
  },
  // Sand Chalk — меловой акцент, иллюстрации, инсайт-кнопка
  chalk: {
    50:  '#FAF7F3', 100: '#F4EDE2', 200: '#E9DACC',
    300: '#D9C4B0', 400: '#C9AD93', 500: '#C4A882',  // ← sand chalk
    600: '#B09068', 700: '#9A7852', 800: '#7E6040', 900: '#634B30',
  },
  // Surface — тёплые тёмные/серые тона
  surface: {
    50:  '#FAF6F1',   // ← фон страницы
    100: '#F5EDE4',   // ← фон карточек (alt)
    200: '#E8DDD0',   // ← разделители
    300: '#D8CDC0',   // ← бордеры
    400: '#B8A898',   // ← placeholder, caption
    500: '#8A7A6A',   // ← второстепенный текст
    600: '#7A6A5A',
    700: '#6A5A4A',
    800: '#5A5048',   // ← основной текст
    900: '#4A4038',   // ← заголовки
    950: '#3A3028',
  },
}
fontFamily: {
  sans:  ['Inter', 'Noto Sans', 'system-ui', 'sans-serif'],
  serif: ['Literata', 'Georgia', 'Noto Serif', 'serif'],  // ← для заголовков
}
```

### 1.2 CSS — компонентные классы и анимации

**`frontend/src/index.css`**:

```css
/* Подключить Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Literata:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');

body { background: #FAF6F1; color: #5A5048; }

/* Кнопки — всё pill shape (radius 24px) */
.btn-primary   { bg #B8785A, text white, radius 24px, padding 14px 28px, shadow 0 2px 8px rgba(90,80,72,0.12) }
.btn-secondary { bg #F5EDE4, text #5A5048, radius 24px, padding 14px 28px, no shadow }
.btn-ghost     { bg transparent, text #8A7A6A, radius 24px }
.btn-insight   { bg #C4A882, text white, radius 24px }  /* меловой/инсайт */

/* Hover/Active состояния кнопок */
.btn-primary:hover   { bg lighter (~8%), shadow stronger }
.btn-primary:active  { transform scale(0.97), shadow none }

/* Поля ввода */
.input-field { radius 14px, border 1px #D8CDC0, bg white, text #5A5048, placeholder #B8A898 italic }
.input-field:focus { border #B8785A, box-shadow 0 0 0 3px rgba(184,120,90,0.15) }
.input-field.error { border #C4786A, bg #FDF5F3 }

/* Карточки */
.card { bg white, radius 16px, shadow 0 2px 12px rgba(90,80,72,0.06), padding 20px }
.card-filled { bg #F5EDE4, radius 16px }

/* Анимации (базовые параметры) */
/* standard: 300ms cubic-bezier(0.4, 0, 0.2, 1) */
/* appear:   400ms ease-out */
/* spring:   cubic-bezier(0.34, 1.56, 0.64, 1) */
```

**CSS-переменные для анимаций:**
```css
--dur-standard: 300ms;
--dur-appear:   400ms;
--dur-fast:     200ms;
--ease-std:     cubic-bezier(0.4, 0, 0.2, 1);
--ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-fade:    ease-in-out;
```

### 1.3 Семантические цвета (функциональные)

| Роль | HEX | Tailwind класс |
|------|-----|---------------|
| Success | #7A9A7A | `text-green-700 bg-green-50` |
| Warning | #D4A574 | `text-warm-500` |
| Error | #C4786A | `text-[#C4786A] bg-[#FDF5F3]` |
| Info | #8A9AB0 | `text-slate-500` |
| Insight | #C4A882 | `text-chalk-500 bg-chalk-50` |

---

## Часть 2: Компоненты чата

### 2.1 Пузыри сообщений

**`frontend/src/components/chat/MessageItem.tsx`** — полная перезапись стилей:

**AI bubble:**
```
bg: #FFFFFF
border: 1px solid #D8CDC0
border-radius: 18px 18px 18px 4px  (нижний-левый 4px — «хвост»)
padding: 14px 18px
text: #5A5048, 15px, line-height 1.6
shadow: 0 1px 4px rgba(90,80,72,0.06)
```
- Аватар: 32×32px круглый, bg `#B8785A`, буква «Н», mr-3
- Курсор стриминга: `inline-block w-0.5 h-4 bg-[#B8785A] animate-pulse`

**User bubble:**
```
bg: #B8785A
border: none
border-radius: 18px 18px 4px 18px  (нижний-правый 4px — «хвост»)
padding: 14px 18px
text: white, 15px
```

**Временная метка:** `text-[11px] text-[#B8A898] mt-1` — для обеих сторон

**Появление сообщения (анимация):**
```css
/* AI message */
@keyframes slideUpFade {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
animation: slideUpFade 400ms ease-out;
```

### 2.2 Agent Badges

**`frontend/src/components/chat/AgentBadge.tsx`** — обновить цвета под новую палитру:
- Все badges: radius 999px (pill), padding 3px 10px, font 12px 500
- Цвета через chalk/warm тона, а не холодные blue/purple

### 2.3 Thinking Indicator

**`frontend/src/components/chat/ThinkingIndicator.tsx`** — три точки:
```css
/* Три круга 8px, цвет #C4A882, анимация появления по очереди */
@keyframes dotPulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40%           { opacity: 1;   transform: scale(1); }
}
/* Задержки: 0ms, 160ms, 320ms */
```

### 2.4 Input Bar

**`frontend/src/components/chat/InputBar.tsx`**:
- Контейнер: bg white, border-top `1px #E8DDD0`, padding 16px
- Обёртка поля: `flex items-end gap-2 bg-white border border-[#D8CDC0] rounded-[24px] px-4 py-2`
- Textarea: без бордера, bg transparent, placeholder «Напиши что угодно...» цвет `#B8A898`
- Send button: круглый 36px, bg `#B8785A`, показывается только если есть текст (иначе `opacity-0 pointer-events-none`)
- Transition отправки: `scale(0.96)` при нажатии, spring-easing обратно
- Voice Input: иконка микрофона слева от textarea, цвет `#8A7A6A`

### 2.5 Панель быстрых действий

**`frontend/src/components/chat/ActionPanel.tsx`** — НОВЫЙ компонент:
- Горизонтальный скролл под input bar
- 4 кнопки (`.btn-insight` / `.btn-secondary`):
  - 💡 «Получить инсайт» — bg `#C4A882`, text white
  - 🌬 «Подышать» — bg `#F5EDE4`, text `#5A5048`
  - 📝 «Написать мысль» — bg `#F5EDE4`
  - 🎯 «Упражнение» — bg `#F5EDE4`
- Показывать под InputBar внутри той же обёртки

---

## Часть 3: Лендинг (стартовый экран)

### 3.1 Общая структура

**`frontend/src/pages/Landing.tsx`** — убрать тяжёлые секции:
- Оставить только: минимальный nav + `<Hero />` + `<Techniques />`
- Удалить импорты: HowItWorks, Specialists, Features, Principles, Disclaimer, CTA, Footer
- Nav: только логотип (текст «Ника») + кнопка «Войти» справа

### 3.2 Hero секция

**`frontend/src/components/landing/Hero.tsx`** — полная перезапись:

**Структура:**
```
Полноэкранный (min-h-screen)
bg: linear-gradient(#FAF6F1, #F3EBE3)
+ лёгкая меловая текстура (5% opacity svg noise overlay)

Контент по центру, max-width 480px:
  [место для иллюстрации — 280×280px placeholder div]
  H1 serif 28px #4A4038: «Поговорим?»
  Body sans 15px #8A7A6A, line-height 1.6, mt-4:
    «Безопасное пространство, где тебя выслушают и поймут»
  .btn-primary mt-8 w-full max-w-xs: «Начать разговор» → /register
  Tertiary link mt-4: «Уже есть аккаунт» → /login
  Caption 12px #B8A898 mt-8:
    «Бесплатно · Без карты · Без обязательств»
```

**Анимация появления:**
```js
// framer-motion
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.4, ease: 'easeOut' }}
```

**Responsive:**
- Mobile (<480px): иллюстрация 200px, заголовок 24px, кнопка full-width
- Desktop: иллюстрация 280px, кнопка 320px ширина

### 3.3 Секция техник

**`frontend/src/components/landing/Techniques.tsx`** — НОВЫЙ файл:

**Структура:**
```
bg white, padding 64px 24px
H2 serif 22px #4A4038 centered: «Какими подходами я владею»
Body 15px #8A7A6A centered mt-2:
  «Я умею работать с тревогой, отношениями, самопознанием
   и многим другим — подберу подход именно под тебя»

Сетка 2 колонки (desktop 3):
  6 карточек:
```

| Карточка | Emoji | Название | Описание |
|---------|-------|----------|----------|
| КПТ | 🧠 | Когнитивно-поведенческая терапия | Работа с мыслями, которые мешают жить |
| Юнг | 🌙 | Юнгианский анализ | Понимание глубинных слоёв личности и снов |
| ACT | 🧭 | Терапия принятия и ответственности | Действовать по ценностям, не убегая от чувств |
| IFS | 🎭 | Системная семейная терапия (IFS) | Примирение внутренних частей личности |
| Нарр | 📖 | Нарративная терапия | Переписать историю о себе по-новому |
| Сомат | 🌿 | Соматическая терапия | Телесное осознание и работа с напряжением |

**Стиль карточки:**
```
bg white, radius 16px, border 1px #E8DDD0
padding 20px, shadow 0 2px 12px rgba(90,80,72,0.06)
emoji: 32px text
name: H4 16px serif #5A5048, mt-3
desc: Body Small 13px #8A7A6A, mt-1
hover: bg #FAF6F1, border #D8CDC0, transition 300ms
```

---

## Часть 4: Страницы аутентификации

### 4.1 Login

**`frontend/src/pages/Login.tsx`** — редизайн формы (левую панель убрать или упростить):

**Структура (centred card layout):**
```
bg #FAF6F1, full screen, flex center
Карточка max-w-sm bg white radius 20px padding 40px shadow:
  [маленькая иллюстрация 80×80px placeholder — чашка]
  H2 serif 22px #4A4038 centered: «Войти тихо»
  Body Small 13px #8A7A6A centered: «Рада тебя видеть снова»
  
  Email input: placeholder «Твой email»
  Password input: placeholder «Пароль», eye icon
  
  .btn-primary w-full: «Войти»
  Tertiary centered mt-3: «Забыла пароль?»
  Footer mt-6: «Нет аккаунта? Создать» (#B8785A link)

Ошибки (supportive tone):
  «Пароль не подошёл, попробуем ещё раз?» (не «Неверный пароль»)
  «Такой email не нашли. Может, опечатка?»
  Стиль ошибки: bg #FDF5F3, border #C4786A, text #C4786A
```

### 4.2 Register

**`frontend/src/pages/Register.tsx`** — аналогичный редизайн:

```
[иллюстрация 80×80px — росток]
H2 serif: «Начнём твой путь»
Sub: «Это займёт меньше минуты»

Name input: placeholder «Как тебя зовут?»
Email input: placeholder «Email»
Password input: placeholder «Придумай пароль», strength indicator

.btn-primary w-full: «Создать аккаунт»
Footer: «Уже есть аккаунт? Войти»
```

---

## Часть 5: Chat screen — хедер и сайдбар

### 5.1 Хедер

**`frontend/src/pages/Chat.tsx`** — перезаписать `<header>` блок:

```jsx
// bg: #FAF6F1, backdrop-blur-sm
// border-bottom: 1px #E8DDD0, height 56px
<header className="flex items-center gap-3 px-4 py-3
                   bg-[#FAF6F1]/90 backdrop-blur-sm
                   border-b border-[#E8DDD0]">
  <button onClick={openSidebar} className="lg:hidden ...">
    <Menu />
  </button>
  
  {/* Аватар Ники */}
  <div className="h-10 w-10 rounded-full bg-[#B8785A]
                  flex items-center justify-center
                  text-white font-semibold text-sm shrink-0">
    Н
  </div>
  
  <div>
    <p className="text-[15px] font-semibold text-[#5A5048] leading-none">Ника</p>
    <div className="flex items-center gap-1.5 mt-0.5">
      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      <span className="text-[12px] text-[#8A7A6A]">Онлайн</span>
    </div>
  </div>
  
  <div className="ml-auto flex items-center gap-2">
    {/* Memory toggle кнопка — см. Часть 9 */}
  </div>
</header>
```

### 5.2 Сайдбар

**`frontend/src/components/chat/Sidebar.tsx`** — переход с тёмной темы на тёплую светлую:

```
bg: #FFFFFF (не surface-900)
border-right: 1px #E8DDD0
Header: bg #FAF6F1, border-bottom #E8DDD0
  Логотип: «Ника» serif #5A5048
  
«Новый разговор» кнопка:
  border dashed #D8CDC0, text #8A7A6A
  hover: border #B8785A, bg #FAF6F1, text #B8785A

Список сессий:
  text #5A5048 (не surface-400)
  active: bg #F5EDE4, text #B8785A
  hover: bg #FAF6F1

Нижний блок (профиль/выход):
  border-top #E8DDD0
  имя пользователя: #5A5048
  кнопки: text #8A7A6A, hover bg #FAF6F1
  «Выйти»: hover text #C4786A
```

### 5.3 Область сообщений

**`frontend/src/components/chat/MessageList.tsx`** — bg area: `bg-[#FAF6F1]`

---

## Часть 6: Женский персонаж Ника

### 6.1 Системный промпт

**`backend/app/agents/prompts/orchestrator.txt`** — полная перезапись:

```
Ты — Ника, ИИ-психолог и компаньон в заботе о себе.

## Твоя личность
Ты — тёплая, внимательная и профессиональная женщина-терапевт.
Имя — Ника. Говори от первого лица, женский род:
«Я здесь», «Я рада тебя слышать», «Я заметила», «Мне важно понять».

## Стиль общения
- Говори на «ты», мягко и без официоза
- Тёплая, но не слащавая — живой, настоящий разговор
- Простой язык, без жаргона
- Открытые вопросы, не советы
- Сначала validate чувства, потом анализ
- Используй имя пользователя, когда знаешь его

## Принципы
1. Слушай прежде всего — не торопись с техниками
2. Принимай без осуждения — чувства всегда нормальны
3. Не ставь диагнозы — ты не врач
4. Будь гибкой — интегрируй подходы органично
5. Бережность с травмой — не дави, не торопи
6. При серьёзных проблемах рекомендуй живого специалиста

## Формат
- Отвечай как живой терапевт, не список пунктов
- Завершай мягким вопросом или приглашением продолжить
- Метафоры уместны там, где они помогают
- Длина ответа — соразмерна теме, не перегружай

## Язык
Всегда русский. Если пишут на другом языке — мягко предложи продолжить
на русском или спроси, как удобнее.
```

### 6.2 Crisis Response — женский голос

**`backend/app/agents/orchestrator.py`** — `CRISIS_RESPONSE`:
```python
CRISIS_RESPONSE = """Я здесь, и я слышу тебя. То, о чём ты говоришь, очень важно...
```
Остальное содержание (номера телефонов) не меняется, только тональность — от «Ника».

### 6.3 Типы и имена на фронте

**`frontend/src/types/index.ts`** — обновить агент orchestrator:
```ts
{ id: 'orchestrator', name: 'Ника', emoji: '🌸', color: 'text-[#B8785A]', bgColor: 'bg-[#FAF6F1]' }
```

---

## Часть 7: Приветственное сообщение

**`frontend/src/components/chat/MessageList.tsx`** — заменить пустое состояние на тёплый welcome bubble:

```tsx
// Когда messages.length === 0 && !isStreaming
const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  session_id: '',
  role: 'assistant',
  content: 'Привет. Я Ника — твой компаньон в заботе о себе.\n\nЗдесь можно говорить обо всём: тревоге, усталости, отношениях или просто о том, как прошёл день.\n\nЯ здесь. С чего начнём?',
  agents_used: null,
  created_at: new Date().toISOString(),
}

return (
  <div className="flex-1 overflow-y-auto px-4 py-6 bg-[#FAF6F1]">
    <div className="mx-auto max-w-3xl space-y-6">
      <MessageItem message={WELCOME_MESSAGE} />
    </div>
  </div>
)
```

Сообщение НЕ хранится в БД — только UI-иллюзия.

---

## Часть 8: Контекст при переключении агентов

### 8.1 Аннотации агентов в истории

**`backend/app/routers/messages.py`** — при формировании `history` dict из DB-сообщений:
```python
history = [
  {
    "role": m.role,
    "content": m.content,
    "agents_used": m.agents_used,  # ← добавить это поле
  }
  for m in messages
]
```
(Проверить, что сейчас `agents_used` не передаётся в dict — скорее всего нет)

### 8.2 Синтез с аннотацией агентов

**`backend/app/agents/orchestrator.py`** — `_synthesize`, при формировании `history_text`:
```python
for m in history[-10:]:
    role = "Пользователь" if m["role"] == "user" else "Ника"
    agents_note = ""
    if m.get("agents_used"):
        try:
            agents_list = json.loads(m["agents_used"]) if isinstance(m["agents_used"], str) else m["agents_used"]
            if agents_list:
                name_map = {"cbt": "КПТ", "jungian": "Юнг", "act": "ACT", "ifs": "IFS",
                            "narrative": "Нарратив", "somatic": "Соматика"}
                readable = [name_map.get(a, a) for a in agents_list]
                agents_note = f" [через {', '.join(readable)}]"
        except Exception:
            pass
    history_text += f"{role}{agents_note}: {m['content']}\n"
```

---

## Часть 9: Долгосрочная память

### 9.1 БД — новые поля

**`backend/app/models/models.py`** — дополнить `UserProfile`:
```python
memory_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default='1')
long_term_memory: Mapped[str | None] = mapped_column(Text)  # компактный текст о пользователе
```

**`backend/alembic/versions/002_memory_and_continuation.py`** — новая миграция:
```python
revision = '002'
down_revision = '001_initial'

def upgrade():
    op.add_column('user_profiles',
        sa.Column('memory_enabled', sa.Boolean, nullable=False, server_default='1'))
    op.add_column('user_profiles',
        sa.Column('long_term_memory', sa.Text, nullable=True))
    op.add_column('sessions',
        sa.Column('continuation_context', sa.Text, nullable=True))

def downgrade():
    op.drop_column('user_profiles', 'memory_enabled')
    op.drop_column('user_profiles', 'long_term_memory')
    op.drop_column('sessions', 'continuation_context')
```

### 9.2 Сервис памяти

**`backend/app/services/memory_service.py`** — НОВЫЙ файл:

```python
MEMORY_EXTRACT_PROMPT = """Из этого диалога извлеки ключевую информацию о пользователе.
Верни компактный текст (не более 200 слов) с фактами:
- Имя пользователя (если назвал)
- Основные темы и проблемы с которыми работали
- Ключевые эмоциональные паттерны
- Прогресс и инсайты
- Важные личные детали (семья, работа, привычки — если упомянуты)

Если текущая память уже есть — обнови и дополни её, не дублируй.
Если новой важной информации нет — верни текущую память без изменений.

Текущая память:
{current_memory}

Диалог (последние сообщения пользователя):
{user_messages}
"""

async def extract_and_update_memory(
    current_memory: str | None,
    messages: list[dict],
    db: AsyncSession,
    user_id: str,
) -> str:
    # Берём только сообщения пользователя из последних 10
    user_msgs = [m["content"] for m in messages[-10:] if m["role"] == "user"]
    if not user_msgs:
        return current_memory or ""
    
    prompt = MEMORY_EXTRACT_PROMPT.format(
        current_memory=current_memory or "(пусто)",
        user_messages="\n".join(user_msgs[-5:])
    )
    # LLM-вызов (ZAI_SMALL_MODEL для экономии)
    # Обновить UserProfile.long_term_memory в БД
    # Вернуть обновлённый текст
```

Вызывать в `routers/messages.py` ПОСЛЕ успешного сохранения assistant-сообщения (асинхронно, не блокировать ответ).

### 9.3 Схемы

**`backend/app/schemas/user.py`**:
```python
class UserProfileResponse(BaseModel):
    user_id: str
    therapy_goals: str | None
    preferred_style: str
    crisis_plan: str | None
    memory_enabled: bool = True        # ← новое
    long_term_memory: str | None = None # ← новое
    updated_at: datetime

class UserProfileUpdate(BaseModel):
    therapy_goals: str | None = None
    preferred_style: str | None = ...
    crisis_plan: str | None = None
    memory_enabled: bool | None = None  # ← новое
```

### 9.4 Инжекция памяти в промпт

**`backend/app/agents/orchestrator.py`** — расширить сигнатуру:
```python
async def process(
    self, message, history, session_summary="",
    preferred_style="balanced",
    long_term_memory=""   # ← новый параметр
):
```

В `_synthesize()` добавить секцию в system message:
```python
if long_term_memory:
    messages[0]["content"] += f"\n\n## Что я знаю об этом человеке\n{long_term_memory}"
```

**`backend/app/routers/messages.py`** — передавать при вызове:
```python
profile = await db.execute(select(UserProfile).where(...))
memory = profile.long_term_memory if (profile and profile.memory_enabled) else ""
async for event in orchestrator.process(..., long_term_memory=memory):
    ...
```

### 9.5 API — обновить роутер

**`backend/app/routers/users.py`** — добавить обработку `memory_enabled` в PATCH:
```python
if body.memory_enabled is not None:
    profile.memory_enabled = body.memory_enabled
```

### 9.6 Frontend — переключатель памяти

**`frontend/src/types/index.ts`** — обновить `UserProfile` интерфейс:
```ts
export interface UserProfile {
  user_id: string
  therapy_goals: string | null
  preferred_style: string
  crisis_plan: string | null
  memory_enabled: boolean
  long_term_memory: string | null
  updated_at: string
}
```

**`frontend/src/store/auth.ts`** — убедиться что `user.profile` включает новые поля.

**`frontend/src/pages/Chat.tsx`** — добавить toggle в header:
```tsx
const { user } = useAuth()
const memoryEnabled = user?.profile?.memory_enabled ?? true

const toggleMemory = async () => {
  await api.patch('/user/me', { memory_enabled: !memoryEnabled })
  // invalidate user query
}

// В header (рядом с именем Ники, справа):
<button onClick={toggleMemory} title={memoryEnabled ? 'Память включена' : 'Память выключена'}
  className="rounded-full p-2 hover:bg-[#F5EDE4] transition-colors">
  <Brain className={`h-4 w-4 ${memoryEnabled ? 'text-[#B8785A]' : 'text-[#B8A898]'}`} />
</button>
```
При hover показывать tooltip: «Долгосрочная память» + статус.

---

## Часть 10: Кнопка «Продолжить сессию»

### 10.1 Backend — модель и миграция

`continuation_context` уже включена в миграцию `002` (см. Часть 9.1).

**`backend/app/models/models.py`** — добавить поле в `ChatSession`:
```python
continuation_context: Mapped[str | None] = mapped_column(Text)
```

### 10.2 Backend — эндпоинт продолжения

**`backend/app/routers/sessions.py`** — новый роут:
```python
@router.post("/{session_id}/continue", status_code=201)
async def continue_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Найти session_id и проверить принадлежность
    # 2. Взять последние 10 assistant-сообщений из неё
    # 3. LLM-запрос: сгенерировать компактные инсайты (max 300 слов)
    #    Промпт:
    #    «Ты — Ника, ИИ-психолог. Из этой сессии создай краткую выжимку для продолжения:
    #     - Главная тема работы
    #     - Ключевые инсайты и открытия
    #     - Что было сделано (техники, упражнения)
    #     - С чего стоит продолжить
    #     Пиши от первого лица (я — Ника), как будто готовишься к следующей встрече.»
    # 4. Создать новую сессию с continuation_context = JSON:
    #    { "previous_title": str, "insights": str, "previous_id": session_id }
    # 5. Вернуть: { new_session_id, previous_title, insights_preview (первые 100 символов) }
```

**`backend/app/schemas/session.py`** — добавить в `SessionCreate`:
```python
continuation_of: str | None = None  # ID предыдущей сессии
```
И в `SessionResponse`:
```python
continuation_context: str | None = None
```

### 10.3 Backend — авто-приветствие при продолжении

**`backend/app/routers/messages.py`** — в WebSocket handler после `await websocket.accept()`:

```python
# Если сессия имеет continuation_context И у неё нет сообщений ещё
if session.continuation_context and not existing_messages:
    import json as _json
    try:
        ctx = _json.loads(session.continuation_context)
        insights = ctx.get("insights", "")
        prev_title = ctx.get("previous_title", "нашу предыдущую сессию")
    except Exception:
        insights = ""
        prev_title = "нашу предыдущую сессию"

    if insights:
        continuation_prompt = f"""КОНТЕКСТ ДЛЯ НИКА (не показывать пользователю):
Это продолжение предыдущей сессии «{prev_title}».
Инсайты и итоги прошлой работы:
{insights}

ЗАДАЧА: Начни новую сессию естественно. Поприветствуй пользователя,
кратко напомни о чём говорили (не перечисляй всё — выбери главное),
спроси как он/она себя чувствует после того разговора,
и мягко предложи продолжить работу или попробовать что-то новое.
Говори как Ника — тепло, без официоза."""

        # Сформировать greeting через orchestrator._synthesize с этим промптом
        # Стримить через websocket как обычный ответ
        # Сохранить как assistant-сообщение в БД
```

### 10.4 Frontend — хук

**`frontend/src/hooks/useSessions.ts`** — добавить:
```ts
export function useContinueSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await api.post<{
        new_session_id: string
        previous_title: string
        insights_preview: string
      }>(`/sessions/${sessionId}/continue`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })
}
```

### 10.5 Frontend — кнопка в пустом чате

**`frontend/src/components/chat/MessageList.tsx`** — под welcome bubble:

```tsx
interface MessageListProps {
  // ... существующие
  previousSession?: Session | null    // ← передать последнюю сессию
  onContinueSession?: () => void      // ← callback
  isContinuing?: boolean             // ← loading state
}

// Под WELCOME_MESSAGE MessageItem:
{previousSession && onContinueSession && (
  <div className="flex justify-center mt-2">
    <button
      onClick={onContinueSession}
      disabled={isContinuing}
      className="btn-secondary text-sm gap-2 px-5 py-2.5"
    >
      {isContinuing ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#B8A898] border-t-[#B8785A]" />
      ) : (
        <>
          <ArrowRight className="h-4 w-4" />
          Продолжить сессию
        </>
      )}
    </button>
  </div>
)}
```

**`frontend/src/pages/Chat.tsx`** — логика кнопки:
```ts
const continueSession = useContinueSession()

// Найти последнюю сессию для продолжения
const previousSession = !sessionId && sessions && sessions.length > 0
  ? sessions[0]   // самая последняя по updated_at
  : null

const handleContinueSession = async () => {
  if (!previousSession) return
  const result = await continueSession.mutateAsync(previousSession.id)
  navigate(`/chat/${result.new_session_id}`)
}

// Передать в MessageList:
<MessageList
  ...
  previousSession={previousSession}
  onContinueSession={handleContinueSession}
  isContinuing={continueSession.isPending}
/>
```

---

## Часть 11: Анимации (детали)

Все анимации — согласно дизайн-документу. Использовать framer-motion (уже установлен).

### Глобальные параметры:
```ts
const transitions = {
  standard:  { duration: 0.3,   ease: [0.4, 0, 0.2, 1] },
  appear:    { duration: 0.4,   ease: 'easeOut' },
  disappear: { duration: 0.2,   ease: 'easeIn' },
  spring:    { type: 'spring',  damping: 20, stiffness: 400 },
  modal:     { duration: 0.25,  ease: [0.34, 1.56, 0.64, 1] },
}
```

### Конкретные сценарии:

| Элемент | Анимация | Параметры |
|---------|----------|-----------|
| Появление AI-сообщения | fadeIn + slideUp 12px | 400ms ease-out |
| Отправка user bubble | slideUp 20px + fade | 300ms spring |
| Кнопка нажатие | scale 0.97 | 100ms ease-in |
| Кнопка отпускание | scale 1.0 | 200ms spring |
| Переход между экранами | fade + slide-right 30px | 300ms ease-out |
| Модальное окно | scale 0.95→1 + fade | 250ms spring |
| Typing indicator | 3 точки, sequence delay | 400ms each, infinite |
| Кнопка инсайт | scale 0.95→1 + chalk glow | 400ms spring |
| Сайдбар открытие | x: -288→0 | spring damping 25, stiffness 300 |

### Typing Indicator (детали):
```tsx
// 3 точки 8px, цвет #C4A882
// Анимируются поочерёдно: 0ms, 160ms, 320ms задержка
// pulse: opacity 0.3→1→0.3, scale 0.8→1→0.8
// Длительность: 1200ms, infinite
```

---

## Часть 12: Микрокопи и тон голоса

### Обновить все ошибки валидации — supportive tone:

| Текущий текст | Новый текст |
|--------------|-------------|
| «Неверный email или пароль» | «Пароль не подошёл, попробуем ещё раз?» |
| «Ошибка регистрации. Возможно, email уже занят» | «Кажется, этот email уже используется — может, уже есть аккаунт?» |
| «Новый разговор» (сайдбар) | «Новый разговор» (оставить) |
| Placeholder input | «Напиши что угодно...» (вместо «Напиши, что тебя беспокоит...») |

### Обновить плейсхолдеры Auth:
- Email: «Твой email»
- Password (login): «Пароль» (placeholder «••••••» оставить)
- Password (register): «Придумай пароль»
- Name: «Как тебя зовут?»

### Login заголовок:
- H2: «Войти тихо»
- Sub: «Рада тебя видеть снова»

### Register заголовок:
- H2: «Начнём твой путь»
- Sub: «Это займёт меньше минуты»

---

## Полный список файлов

### Backend
| Файл | Тип изменения |
|------|--------------|
| `backend/app/models/models.py` | Добавить поля `memory_enabled`, `long_term_memory`, `continuation_context` |
| `backend/alembic/versions/002_memory_and_continuation.py` | НОВЫЙ — миграция |
| `backend/app/schemas/user.py` | Новые поля профиля |
| `backend/app/schemas/session.py` | `continuation_context`, расширить SessionCreate |
| `backend/app/routers/users.py` | Обработка `memory_enabled` в PATCH |
| `backend/app/routers/sessions.py` | Новый endpoint `POST /{id}/continue` |
| `backend/app/routers/messages.py` | Передавать `agents_used` в history dict, `long_term_memory` в orchestrator, авто-приветствие при continuation |
| `backend/app/agents/orchestrator.py` | Женский голос в crisis_response, аннотации агентов в history, параметр `long_term_memory` |
| `backend/app/agents/prompts/orchestrator.txt` | Полная перезапись — Ника, женский род |
| `backend/app/services/memory_service.py` | НОВЫЙ — сервис памяти |

### Frontend
| Файл | Тип изменения |
|------|--------------|
| `frontend/tailwind.config.ts` | Новая цветовая палитра |
| `frontend/src/index.css` | Шрифты, компонентные классы, анимации |
| `frontend/src/types/index.ts` | UserProfile интерфейс, агент Ника |
| `frontend/src/pages/Landing.tsx` | Упрощённая структура |
| `frontend/src/components/landing/Hero.tsx` | Полная перезапись (минимализм) |
| `frontend/src/components/landing/Techniques.tsx` | НОВЫЙ |
| `frontend/src/pages/Chat.tsx` | Header Ника, memory toggle, handleContinueSession |
| `frontend/src/components/chat/Sidebar.tsx` | Тёплая тема (не тёмная) |
| `frontend/src/components/chat/MessageList.tsx` | Welcome bubble, кнопка продолжения |
| `frontend/src/components/chat/MessageItem.tsx` | Новые стили пузырей + анимации |
| `frontend/src/components/chat/InputBar.tsx` | Pill shape, terra cotta send |
| `frontend/src/components/chat/AgentBadge.tsx` | Новые цвета |
| `frontend/src/components/chat/ThinkingIndicator.tsx` | Три точки в chalk |
| `frontend/src/components/chat/ActionPanel.tsx` | НОВЫЙ — 4 кнопки быстрых действий |
| `frontend/src/hooks/useSessions.ts` | Добавить `useContinueSession` |
| `frontend/src/pages/Login.tsx` | Редизайн + supportive microcopy |
| `frontend/src/pages/Register.tsx` | Редизайн + supportive microcopy |

---

## Проверка

1. **Миграция**: `alembic upgrade head` — без ошибок, поля созданы
2. **Промпт Ники**: отправить «привет» → ответ от женского лица, имя «Ника»
3. **Приветствие**: открыть пустой чат → виден bubble с «Привет. Я Ника...»
4. **Дизайн**: все кнопки pill-shape, bg страницы `#FAF6F1`, user bubble terra cotta
5. **Лендинг**: одна секция Hero + Techniques, минимальный nav
6. **Сайдбар**: светлый (не тёмный), тёплые цвета
7. **Анимации**: сообщения появляются с slideUpFade, кнопки с scale spring
8. **Память**: в сессии 2 агент знает имя из сессии 1 (при memory_enabled)
9. **Toggle памяти**: клик на иконку Brain в header → PATCH → следующий запрос без памяти
10. **Continue session**: кнопка появляется на новом чате → клик → новая сессия → Ника начинает с продолжения
