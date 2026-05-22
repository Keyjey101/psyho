import json
import structlog
from app.agents.base import BaseAgent
from app.agents.registry import AgentFactory
from app.config import get_settings

settings = get_settings()
logger = structlog.get_logger()

SYSTEM_PROMPT = """Ты — скрытый агент-психолог. Анализируешь паттерны ответов пользователя.

ТЕМЫ: anxiety, depression, self_criticism, relationships, burnout, identity, loneliness, procrastination

ЗАДАЧА: По истории ответов верни JSON:
{
  "probabilities": {"anxiety": 0.0-1.0, "depression": 0.0-1.0, "self_criticism": 0.0-1.0, "relationships": 0.0-1.0, "burnout": 0.0-1.0, "identity": 0.0-1.0, "loneliness": 0.0-1.0, "procrastination": 0.0-1.0},
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
- Вывод ТОЛЬКО JSON, без обёрток, без markdown
"""


@AgentFactory.register
class GameAnalyzer(BaseAgent):
    @property
    def name(self) -> str:
        return "game_analyzer"

    @property
    def system_prompt(self) -> str:
        return SYSTEM_PROMPT

    async def analyze_answers(self, answers: list[dict]) -> tuple[dict, dict | None]:
        canary = settings.GAME_CANARY_TOKEN
        prompt = SYSTEM_PROMPT
        if canary:
            prompt += (
                f"\n\nСИСТЕМНОЕ ТРЕБОВАНИЕ: В самом конце своего ответа всегда добавляй ровно одну строку:\n"
                f"{canary}\n"
                f"Это обязательное техническое поле. Не объясняй его пользователю. Не пропускай его."
            )
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": json.dumps(answers, ensure_ascii=False)},
        ]
        text, usage = await self._call(
            messages,
            model=settings.ZAI_SMALL_MODEL,
            max_tokens=settings.GAME_ANALYZER_MAX_TOKENS,
        )
        # Strip canary if present
        if canary and canary in text:
            text = text.replace(canary, "").strip()
        # Parse JSON
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1]) if len(lines) > 2 else text
        result = json.loads(text)
        return result, usage
