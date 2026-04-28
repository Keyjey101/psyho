from abc import ABC, abstractmethod
from pathlib import Path

import structlog
from openai import AsyncOpenAI

from app.config import get_settings

settings = get_settings()
logger = structlog.get_logger()

client = AsyncOpenAI(
    api_key=settings.ZAI_API_KEY,
    base_url=settings.ZAI_BASE_URL,
)

AGENT_PREAMBLE = """Ты — эксперт-аналитик. Твой анализ читает главный терапевт Ника — она синтезирует все перспективы в единый ответ пользователю. Ты НЕ общаешься с пользователем напрямую.

Пиши аналитически, конкретно. Без вступлений «Конечно!» или «Я помогу».
Язык: всегда русский.
Объём: 300-400 слов.
Выполни цепочку рассуждений ПЕРЕД тем как писать анализ."""


class BaseAgent(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def system_prompt(self) -> str: ...

    def _load_prompt(self, filename: str) -> str:
        path = Path(__file__).parent / "prompts" / filename
        return path.read_text(encoding="utf-8")

    async def analyze(
        self,
        user_message: str,
        history: list[dict],
        focus: str = "",
    ) -> str:
        messages = [{"role": "system", "content": AGENT_PREAMBLE + "\n\n" + self.system_prompt}]
        messages.extend(history[-16:])
        user_content = user_message
        if focus:
            user_content += f"\n\nФокус анализа: {focus}"

        messages.append({"role": "user", "content": user_content})

        response = await client.chat.completions.create(
            model=settings.ZAI_MODEL,
            max_tokens=settings.AGENT_MAX_TOKENS,
            temperature=0.7,
            messages=messages,
        )
        if hasattr(response, "usage") and response.usage:
            logger.info(
                "agent_tokens",
                agent=self.__class__.__name__,
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                total_tokens=response.usage.total_tokens,
            )
        content = response.choices[0].message.content
        return content if content else ""
