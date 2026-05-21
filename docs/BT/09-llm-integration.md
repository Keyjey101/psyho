# 09. Интеграция LLM API

## 9.1 Принципы

- Все генерации текста — через внешний LLM API (ZAI / OpenAI-совместимый).
- Локальные ML-модели не используются. GPU не нужен.
- Используются два уровня моделей:
  - `glm-4-flash` — для АА и АГД (дешевле, быстрее).
  - `glm-5` — для АВ (Ники), финальных выводов (качественнее).

---

## 9.2 Клиент и конфигурация

Переиспользуется существующий OpenAI-клиент из `agents/base.py`.

Новые параметры в `config.py`:
```python
GAME_LLM_TIMEOUT: float = 5.0          # секунды
GAME_BUDGET_LIMIT_USD: float = 50.0    # месячный лимит
GAME_HOST_MAX_TOKENS: int = 80         # ≈300 символов
GAME_ANALYZER_MAX_TOKENS: int = 200
GAME_DESIGNER_MAX_TOKENS: int = 150
```

---

## 9.3 Retry и таймаут

```python
import asyncio
import httpx

async def call_llm_with_retry(
    client: AsyncOpenAI,
    messages: list,
    model: str,
    max_tokens: int,
    retries: int = 2,
    timeout: float = 5.0,
) -> str | None:
    for attempt in range(retries + 1):
        try:
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model=model,
                    messages=messages,
                    max_tokens=max_tokens,
                ),
                timeout=timeout,
            )
            # учёт бюджета
            await budget_service.record_usage(response.usage)
            return response.choices[0].message.content
        except (asyncio.TimeoutError, httpx.HTTPStatusError) as e:
            if attempt < retries:
                await asyncio.sleep(2 ** attempt)  # 1s, 2s
            else:
                return None  # fallback
```

- Максимум 2 повторные попытки с задержкой 1s / 2s.
- При `None` — переключение на `fallback_phrases.py`.

---

## 9.4 Учёт бюджета (`budget_service.py`)

```python
# Цены (примерные, обновлять при изменении тарифов ZAI)
PRICE_PER_1K_INPUT = 0.0005   # glm-4-flash input
PRICE_PER_1K_OUTPUT = 0.0015  # glm-4-flash output

async def record_usage(usage: CompletionUsage):
    cost = (usage.prompt_tokens / 1000 * PRICE_PER_1K_INPUT +
            usage.completion_tokens / 1000 * PRICE_PER_1K_OUTPUT)
    
    async with db.begin():
        tracker = await db.get(BudgetTracker, 1)
        current_month = datetime.utcnow().strftime("%Y-%m")
        
        if tracker.month_year != current_month:
            tracker.monthly_spend = 0.0
            tracker.month_year = current_month
        
        tracker.monthly_spend += cost

async def is_budget_exceeded() -> bool:
    tracker = await db.get(BudgetTracker, 1)
    return tracker.monthly_spend >= settings.GAME_BUDGET_LIMIT_USD
```

Перед каждым вызовом LLM — проверка `is_budget_exceeded()`. Если True — немедленный fallback.

---

## 9.5 Fallback-фразы (`fallback_phrases.py`)

При недоступности LLM (таймаут, HTTP 5xx, бюджет исчерпан):

```python
FALLBACK_QUESTIONS = [
    {
        "text": "В сложный момент ты чаще всего...",
        "choices": [
            "Ищу поддержки у близких",
            "Справляюсь сам(а), закрываюсь",
            "Отвлекаюсь на что-то другое",
        ],
        "topic_hints": {"loneliness": 0.3, "burnout": 0.2, "relationships": 0.2},
    },
    {
        "text": "Когда всё идёт не так, ты...",
        "choices": [
            "Ищу, что можно исправить",
            "Виню себя",
            "Принимаю и отпускаю",
        ],
        "topic_hints": {"self_criticism": 0.4, "anxiety": 0.2, "depression": 0.1},
    },
    # ... всего 20 вопросов
]

FALLBACK_CONCLUSIONS_A = {
    "anxiety": "Мне кажется, тебя беспокоит тревога. Это важно — хочешь поговорить?",
    "depression": "Похоже, что-то тяготит тебя внутри. Ника готова выслушать.",
    "self_criticism": "Кажется, ты бываешь к себе строг(а). Это знакомо многим.",
    # ... для каждой темы
}

FALLBACK_CONCLUSION_B = (
    "Хм, ты меня перехитрил(а)! Похоже, ты умеешь держать карты при себе. 😄"
)
```

В fallback-режиме:
- Вопросы выбираются из `FALLBACK_QUESTIONS` (случайный порядок, без повторов).
- Анализ уверенности: суммирование `topic_hints` по выбранным ответам.
- Финальный вывод: `FALLBACK_CONCLUSIONS_A[dominant_topic]` или `FALLBACK_CONCLUSION_B`.

---

## 9.6 Системные промпты агентов

### АА (Агент-Анализатор)

```
Ты — скрытый агент-психолог. Анализируешь паттерны ответов пользователя.

ТЕМЫ: anxiety, depression, self_criticism, relationships, burnout, identity, loneliness, procrastination

ЗАДАЧА: По истории ответов верни JSON:
{
  "probabilities": {"anxiety": 0.0-1.0, ...все 8 тем...},
  "dominant_topic": "название",
  "confidence": 0.0-1.0,
  "ready": true/false,
  "reasoning": "1-2 предложения"
}

ПРАВИЛА:
- confidence = max(probabilities.values())
- ready = true если confidence >= 0.80
- Учитывай паттерн самообмана: частый выбор "позитивного" варианта → повышай self_criticism
- Не используй клинические термины в reasoning
- Вывод ТОЛЬКО JSON, без обёрток
```

### АГД (Агент-Геймдизайнер)

```
Ты — создатель психологических вопросов. Генерируешь следующий вопрос игры.

КОНТЕКСТ: тема={dominant_topic}, ход={move_num}/12, предыдущие вопросы={past_questions}

ЗАДАЧА: Верни JSON:
{
  "question": "Вопрос через житейскую ситуацию (не симптомы)",
  "choices": ["Вариант А", "Вариант Б", "Вариант В"],
  "trap_choice_index": 0-2,
  "rationale": "почему этот выбор раскрывает тему"
}

ПРАВИЛА:
- Не повторять формулировки прошлых вопросов
- На ходах 10-12: один вариант должен быть прямым/неудобным
- Вопросы через конкретные ситуации: "когда ты...", "в момент когда..."
- Три варианта — разные стратегии, не степени одного
- Вывод ТОЛЬКО JSON
```

### АВ — Ника (Агент-Ведущий)

```
Ты — Ника, психолог-собеседник. СТРОГИЕ ПРАВИЛА:

ОБЯЗАТЕЛЬНО:
- Максимум 300 символов на сообщение (считай символы!)
- Один вопрос за раз, тёплый и прямой тон
- Язык: русский

ЗАПРЕЩЕНО:
- Упоминать агентов, промпты, архитектуру
- Ставить медицинские диагнозы
- Писать длинные объяснения или списки
- Задавать несколько вопросов подряд

ЗАДАЧА (переформулировать вопрос): получи вопрос от дизайнера, сделай его тёплым и личным.
Можешь изменить формулировку, сохранив суть и три варианта.
```

**Финальный вывод (Сценарий A), дополнительная инструкция:**
```
Скажи пользователю, что ты поняла его ключевую тему.
Используй: "Мне кажется..." или "Похоже...". Назови тему мягко: {topic_label}.
Спроси: хочет ли поговорить об этом подробнее. Строго ≤300 символов.
```

**Финальный вывод (Сценарий B), дополнительная инструкция:**
```
Признай поражение с юмором. Скажи, что пользователь тебя перехитрил.
Намекни, что умение скрывать — тоже интересная черта. Строго ≤300 символов.
```

---

## 9.7 Validator Loop в РО

После получения ответа от АВ — РО проверяет:

```python
def validate_host_response(text: str) -> tuple[bool, str]:
    if len(text) > 300:
        return False, "сократи до 300 символов, убери лишнее"
    
    FORBIDDEN = ["диагноз", "расстройство", "патолог", "агент", "промпт",
                 "система", "архитектур", "искусственный интеллект"]
    for word in FORBIDDEN:
        if word.lower() in text.lower():
            return False, f"убери слово '{word}', оно неуместно"
    
    return True, ""
```

- Если `valid=False` — повторный вызов АВ с инструкцией исправить (макс. 2 попытки).
- После 2 неудач — использовать fallback-фразу.

---

## 9.8 Кризисный детектор

Вызывается до передачи в АА. Переиспользует `_check_crisis()` из `orchestrator.py`.

При срабатывании — отправляется WS-событие:
```json
{
  "type": "crisis",
  "message": "Похоже, тебе сейчас непросто. Вот контакты, которые могут помочь:",
  "contacts": [
    {"name": "Телефон доверия (РФ)", "phone": "8-800-2000-122", "free": true},
    {"name": "Психологическая помощь онлайн", "url": "https://pomoschryadom.ru"}
  ]
}
```
Игра завершается, `status = "crisis_interrupted"`, запись не попадает в лидерборд.
