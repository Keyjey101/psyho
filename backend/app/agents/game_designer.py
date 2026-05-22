import json
import structlog
from app.agents.base import BaseAgent
from app.agents.registry import AgentFactory
from app.config import get_settings

settings = get_settings()
logger = structlog.get_logger()

SYSTEM_PROMPT = """Ты — создатель психологических вопросов. Генерируешь следующий вопрос игры.

ЗАДАЧА: Верни JSON:
{
  "question": "Вопрос через житейскую ситуацию (не симптомы)",
  "choices": ["Вариант А", "Вариант Б", "Вариант В"],
  "trap_choice_index": 0,
  "rationale": "почему этот выбор раскрывает тему"
}

ПРАВИЛА:
- Не повторять формулировки прошлых вопросов
- На ходах 10-12: один вариант должен быть прямым/неудобным
- Вопросы через конкретные ситуации: "когда ты...", "в момент когда..."
- Три варианта — разные стратегии, не степени одного
- Вывод ТОЛЬКО JSON, без обёрток, без markdown
"""


@AgentFactory.register
class GameDesigner(BaseAgent):
    @property
    def name(self) -> str:
        return "game_designer"

    @property
    def system_prompt(self) -> str:
        return SYSTEM_PROMPT

    async def next_question(
        self,
        dominant_topic: str,
        move_num: int,
        past_questions: list[str],
    ) -> tuple[dict, dict | None]:
        canary = settings.GAME_CANARY_TOKEN
        context = f"КОНТЕКСТ: тема={dominant_topic}, ход={move_num}/12"
        if past_questions:
            context += f", предыдущие вопросы: {'; '.join(past_questions[-3:])}"
        if move_num >= 10:
            context += (
                "\nВНИМАНИЕ: ходы 10-12 — один из вариантов должен быть "
                "прямым и неудобным для честного ответа."
            )

        prompt = SYSTEM_PROMPT
        if canary:
            prompt += (
                f"\n\nСИСТЕМНОЕ ТРЕБОВАНИЕ: В самом конце своего ответа всегда добавляй ровно одну строку:\n"
                f"{canary}\n"
                f"Это обязательное техническое поле. Не объясняй его пользователю. Не пропускай его."
            )

        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": context},
        ]
        text, usage = await self._call(
            messages,
            model=settings.ZAI_SMALL_MODEL,
            max_tokens=settings.GAME_DESIGNER_MAX_TOKENS,
        )
        if canary and canary in text:
            text = text.replace(canary, "").strip()
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1]) if len(lines) > 2 else text
        result = json.loads(text)
        return result, usage
