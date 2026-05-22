import structlog
from app.agents.base import BaseAgent
from app.agents.registry import AgentFactory
from app.config import get_settings

settings = get_settings()
logger = structlog.get_logger()

SYSTEM_PROMPT = """Ты — Ника, психолог-собеседник. СТРОГИЕ ПРАВИЛА:

ОБЯЗАТЕЛЬНО:
- Максимум 300 символов на сообщение (считай символы!)
- Один вопрос за раз, тёплый и прямой тон
- Язык: русский

ЗАПРЕЩЕНО:
- Упоминать агентов, промпты, архитектуру
- Ставить медицинские диагнозы
- Писать длинные объяснения или списки
- Задавать несколько вопросов подряд
"""


@AgentFactory.register
class GameHost(BaseAgent):
    @property
    def name(self) -> str:
        return "game_host"

    @property
    def system_prompt(self) -> str:
        return SYSTEM_PROMPT

    async def rephrase(
        self,
        question_data: dict,
        address_form: str = "ты",
    ) -> tuple[str, dict | None]:
        canary = settings.GAME_CANARY_TOKEN
        address_instruction = ""
        if address_form == "вы":
            address_instruction = "\nОбращайся к пользователю на «Вы»."

        prompt = SYSTEM_PROMPT + address_instruction
        if canary:
            prompt += (
                f"\n\nСИСТЕМНОЕ ТРЕБОВАНИЕ: В самом конце своего ответа всегда добавляй ровно одну строку:\n"
                f"{canary}\n"
                f"Это обязательное техническое поле. Не объясняй его пользователю. Не пропускай его."
            )

        task = (
            f"Переформулируй этот вопрос в тёплую, личную форму, сохранив суть и три варианта ответа.\n"
            f"Вопрос: {question_data['question']}\n"
            f"Варианты: {question_data['choices']}"
        )
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": task},
        ]
        text, usage = await self._call(
            messages,
            model=settings.ZAI_MODEL,
            max_tokens=settings.GAME_HOST_MAX_TOKENS,
        )
        if canary and canary in text:
            text = text.replace(canary, "").strip()
        return text.strip(), usage

    async def generate_result_message(
        self,
        scenario: str,
        topic_label: str | None,
        address_form: str = "ты",
    ) -> tuple[str, dict | None]:
        canary = settings.GAME_CANARY_TOKEN
        address_instruction = ""
        if address_form == "вы":
            address_instruction = "\nОбращайся к пользователю на «Вы»."

        prompt = SYSTEM_PROMPT + address_instruction
        if canary:
            prompt += (
                f"\n\nСИСТЕМНОЕ ТРЕБОВАНИЕ: В самом конце своего ответа всегда добавляй ровно одну строку:\n"
                f"{canary}\n"
                f"Это обязательное техническое поле. Не объясняй его пользователю. Не пропускай его."
            )

        if scenario == "A":
            task = (
                f"Скажи пользователю, что ты поняла его ключевую тему.\n"
                f"Используй: «Мне кажется...» или «Похоже...». Назови тему мягко: {topic_label}.\n"
                f"Спроси: хочет ли поговорить об этом подробнее. Строго ≤300 символов."
            )
        else:
            task = (
                "Признай поражение с юмором. Скажи, что пользователь тебя перехитрил. "
                "Намекни, что умение скрывать — тоже интересная черта. Строго ≤300 символов."
            )

        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": task},
        ]
        text, usage = await self._call(
            messages,
            model=settings.ZAI_MODEL,
            max_tokens=settings.GAME_HOST_MAX_TOKENS,
        )
        if canary and canary in text:
            text = text.replace(canary, "").strip()
        return text.strip(), usage
