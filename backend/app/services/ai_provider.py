import asyncio
import structlog
from abc import ABC, abstractmethod
from typing import AsyncIterator

from app.config import get_settings

logger = structlog.get_logger()


class AIProvider(ABC):
    @abstractmethod
    async def chat_completion(
        self,
        messages: list[dict],
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        stream: bool = False,
        retries: int = 2,
        timeout: float = 30.0,
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
        retries: int = 2,
        timeout: float = 30.0,
    ) -> str | AsyncIterator[str]:
        model = model or self.default_model
        last_error = None
        for attempt in range(retries + 1):
            try:
                response = await asyncio.wait_for(
                    self.client.chat.completions.create(
                        model=model,
                        max_tokens=max_tokens,
                        temperature=temperature,
                        messages=messages,
                        stream=stream,
                    ),
                    timeout=timeout,
                )
                if stream:
                    async def _stream():
                        async for chunk in response:
                            if chunk.choices and chunk.choices[0].delta.content:
                                yield chunk.choices[0].delta.content
                    return _stream()
                else:
                    content = response.choices[0].message.content
                    return content if content else ""
            except Exception as e:
                last_error = e
                logger.warning(
                    "LLM call failed",
                    attempt=attempt + 1,
                    model=model,
                    error=str(e),
                )
                if attempt < retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
        raise last_error


_provider_instance: ZAIGLMProvider | None = None


def get_ai_provider() -> AIProvider:
    global _provider_instance
    if _provider_instance is None:
        _provider_instance = ZAIGLMProvider()
    return _provider_instance
