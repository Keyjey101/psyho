from openai import AsyncOpenAI
from app.config import get_settings

settings = get_settings()

client = AsyncOpenAI(
    api_key=settings.ZAI_API_KEY,
    base_url=settings.ZAI_BASE_URL,
)

INSIGHT_SYSTEM = """Ты — опытный психолог с глубоким пониманием человеческой психики.
Тебе предоставлен фрагмент разговора пользователя с психологическим ассистентом.

Твоя задача: сформулировать ОДИН глубокий, персональный инсайт.

Требования к инсайту:
- Конкретный для ЭТОГО человека — не общие слова
- Неожиданный, но узнаваемый — «да, именно так»
- Основан на реальных словах и паттернах из разговора
- 2-4 предложения, не длиннее
- Начни с «Я замечаю...», «Похоже, что...» или «В твоих словах чувствуется...»

Нельзя: общие фразы типа «многие люди чувствуют», «это нормально», «ты молодец».
Нельзя: советы, упражнения, вопросы.
Только инсайт — наблюдение, которое помогает увидеть себя яснее."""

EXERCISE_SYSTEM = """Ты — психолог-практик с опытом работы в КПТ, ACT и соматическом подходе.
Тебе предоставлен фрагмент разговора пользователя с психологическим ассистентом.

Твоя задача: предложить ОДНО конкретное упражнение, которое пользователь может выполнить прямо сейчас за 5-10 минут.

Требования к упражнению:
- Конкретное для ЭТОЙ ситуации — объясни связь с тем, о чём говорил человек
- Пошаговое: 3-5 чётких шагов
- Простое — не требует специальной подготовки или оборудования
- Подходит для выполнения дома или в любом спокойном месте

Структура ответа:
1. Одно предложение: почему это упражнение подходит именно сейчас
2. Название упражнения (если есть)
3. Шаги (нумерованный список)
4. Одно предложение: чего ожидать от упражнения

Нельзя: общие советы, длинные объяснения теории, несколько упражнений на выбор."""


def _build_context(messages: list, long_term_memory: str | None, therapy_goals: str | None) -> str:
    parts = []

    if long_term_memory:
        parts.append(f"Информация о пользователе:\n{long_term_memory}")

    if therapy_goals:
        parts.append(f"Цели пользователя:\n{therapy_goals}")

    if messages:
        dialog = []
        for msg in messages[-20:]:
            role_label = "Пользователь" if msg["role"] == "user" else "Ника"
            dialog.append(f"{role_label}: {msg['content']}")
        parts.append("Последний разговор:\n" + "\n\n".join(dialog))

    return "\n\n---\n\n".join(parts)


async def run_action(
    action_type: str,
    messages: list[dict],
    long_term_memory: str | None,
    therapy_goals: str | None,
) -> str:
    if action_type == "insight":
        system = INSIGHT_SYSTEM
        user_prompt = "На основе разговора выше сформулируй один персональный инсайт."
    elif action_type == "exercise":
        system = EXERCISE_SYSTEM
        user_prompt = "На основе разговора выше предложи одно конкретное упражнение."
    else:
        raise ValueError(f"Unknown action type: {action_type}")

    context = _build_context(messages, long_term_memory, therapy_goals)

    llm_messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": context + f"\n\n---\n\n{user_prompt}"},
    ]

    response = await client.chat.completions.create(
        model=settings.ZAI_MODEL,
        max_tokens=600,
        temperature=0.8,
        messages=llm_messages,
    )
    return response.choices[0].message.content
