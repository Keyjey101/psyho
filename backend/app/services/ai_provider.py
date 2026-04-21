from abc import ABC, abstractmethod
from typing import AsyncIterator

from app.config import get_settings


class AIProvider(ABC):
    @abstractmethod
    async def chat_completion(
        self,
        messages: list[dict],
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        stream: bool = False,
    ) -> str | AsyncIterator[str]:
        ...


class ZAIGLMProvider(AIProvider):
    def __init__(self):
        from openai import AsyncOpenAI
        settings = get_settings()
        self.client = AsyncOpenAI(
            api_key=settings.ZAI_API_KEY,
            base_url=settings.ZAI_BASE_URL,
        )
        self.default_model = settings.ZAI_MODEL

    async def chat_completion(
        self,
        messages: list[dict],
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        stream: bool = False,
    ) -> str | AsyncIterator[str]:
        model = model or self.default_model
        response = await self.client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=messages,
            stream=stream,
        )
        if stream:
            async def _stream():
                async for chunk in response:
                    if chunk.choices and chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
            return _stream()
        else:
            return response.choices[0].message.content


def get_ai_provider() -> AIProvider:
    settings = get_settings()
    provider = getattr(settings, "AI_PROVIDER", "zai").lower()
    if provider == "zai":
        return ZAIGLMProvider()
    raise ValueError(f"Unknown AI provider: {provider}")
