from abc import ABC, abstractmethod
from pathlib import Path

from openai import AsyncOpenAI

from app.config import get_settings

settings = get_settings()

client = AsyncOpenAI(
    api_key=settings.ZAI_API_KEY,
    base_url=settings.ZAI_BASE_URL,
)


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
        messages = [{"role": "system", "content": self.system_prompt}]
        messages.extend(history[-10:])
        user_content = user_message
        if focus:
            user_content += f"\n\nФокус анализа: {focus}"

        messages.append({"role": "user", "content": user_content})

        response = await client.chat.completions.create(
            model=settings.ZAI_MODEL,
            max_tokens=1024,
            temperature=0.7,
            messages=messages,
        )
        return response.choices[0].message.content
