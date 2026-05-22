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
Объём: соразмерно сообщению — 80-120 слов на короткое, до 300 на развёрнутое.
Выполни цепочку рассуждений ПЕРЕД тем как писать анализ.

Пиши анализ связными абзацами, без заголовков и буллетов. Структурируй мысль через логику текста, а не через форматирование. Ника синтезирует твой текст в живой ответ — заголовки и нумерация просочатся в её речь."""


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

    async def _call(
        self,
        messages: list[dict],
        model: str | None = None,
        max_tokens: int | None = None,
        temperature: float = 0.7,
    ) -> tuple[str, dict | None]:
        """Single LLM call point used by analyze() and game agents."""
        _model = model or settings.ZAI_SMALL_MODEL
        _max_tokens = max_tokens or settings.AGENT_MAX_TOKENS
        response = await client.chat.completions.create(
            model=_model,
            max_tokens=_max_tokens,
            temperature=temperature,
            messages=messages,
        )
        usage = None
        if hasattr(response, "usage") and response.usage:
            usage = {
                "prompt_tokens": response.usage.prompt_tokens or 0,
                "completion_tokens": response.usage.completion_tokens or 0,
                "total_tokens": response.usage.total_tokens or 0,
            }
            logger.info(
                "agent_tokens",
                agent=self.__class__.__name__,
                prompt_tokens=usage["prompt_tokens"],
                completion_tokens=usage["completion_tokens"],
            )
        return (response.choices[0].message.content or ""), usage

    async def analyze(
        self,
        user_message: str,
        history: list[dict],
        focus: str = "",
        phase: str = "",
        memory_summary: str = "",
    ) -> tuple[str, dict | None]:
        """Therapeutic interface — builds messages and delegates to _call()."""
        messages = [{"role": "system", "content": AGENT_PREAMBLE + "\n\n" + self.system_prompt}]
        messages.extend(history[-16:])
        user_content = user_message
        if focus:
            user_content += f"\n\nФокус анализа: {focus}"
        if phase:
            user_content += f"\n\nФаза сессии: {phase}"
        if memory_summary:
            user_content += f"\n\nКраткая память о пользователе: {memory_summary}"

        messages.append({"role": "user", "content": user_content})
        return await self._call(messages)
