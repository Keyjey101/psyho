"""Budget tracking for the Beat-Nika mini-game LLM spend."""
from __future__ import annotations
import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import async_session
from app.models.game_models import BudgetTracker

settings = get_settings()
logger = structlog.get_logger()

# Price per 1 000 tokens (USD)
PRICE_PER_1K_INPUT: float = 0.0005
PRICE_PER_1K_OUTPUT: float = 0.0015


def _compute_cost(usage: dict) -> float:
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)
    cost = (prompt_tokens / 1000) * PRICE_PER_1K_INPUT + (completion_tokens / 1000) * PRICE_PER_1K_OUTPUT
    return cost


async def record_usage(usage: dict, model: str) -> None:
    """Add LLM usage to the running budget total."""
    cost = _compute_cost(usage)
    if cost <= 0:
        return
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)

    async with async_session() as db:
        result = await db.execute(select(BudgetTracker).where(BudgetTracker.id == 1))
        tracker = result.scalar_one_or_none()
        if tracker is None:
            tracker = BudgetTracker(
                id=1,
                total_cost_usd=cost,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
            )
            db.add(tracker)
        else:
            tracker.total_cost_usd = tracker.total_cost_usd + cost
            tracker.prompt_tokens = tracker.prompt_tokens + prompt_tokens
            tracker.completion_tokens = tracker.completion_tokens + completion_tokens
        await db.commit()
    logger.info(
        "game_budget_recorded",
        model=model,
        cost_usd=round(cost, 6),
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
    )


async def is_budget_exceeded() -> bool:
    """Return True if total game LLM spend has exceeded the configured limit."""
    async with async_session() as db:
        result = await db.execute(select(BudgetTracker).where(BudgetTracker.id == 1))
        tracker = result.scalar_one_or_none()
        if tracker is None:
            return False
        return tracker.total_cost_usd >= settings.GAME_BUDGET_LIMIT_USD
