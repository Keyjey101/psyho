import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import get_current_user, get_current_user_optional
from app.models.models import TestResult, ChatSession, User
from app.services import attribution, events, spend_guard, test_safety

router = APIRouter()
logger = structlog.get_logger()
settings = get_settings()


class TestResultCreate(BaseModel):
    test_id: str = Field(..., min_length=1, max_length=64)
    score: int = Field(..., ge=0, le=1000)
    level: str = Field(..., min_length=1, max_length=80)


@router.post("/results")
async def create_test_result(
    body: TestResultCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entry = TestResult(
        user_id=user.id,
        test_id=body.test_id,
        score=body.score,
        level=body.level,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return {
        "id": entry.id,
        "test_id": entry.test_id,
        "score": entry.score,
        "level": entry.level,
        "completed_at": entry.completed_at,
    }


@router.get("/results")
async def list_test_results(
    test_id: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(TestResult).where(TestResult.user_id == user.id)
    if test_id:
        query = query.where(TestResult.test_id == test_id)
    query = query.order_by(TestResult.completed_at.desc()).limit(200)
    rows = (await db.execute(query)).scalars().all()
    return [
        {
            "id": r.id,
            "test_id": r.test_id,
            "score": r.score,
            "level": r.level,
            "completed_at": r.completed_at,
        }
        for r in rows
    ]


@router.get("/completed-sessions")
async def get_completed_session_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return how many sessions the user has had so the frontend can decide
    whether the "retake after 2 sessions" rule unlocks a test."""
    result = await db.execute(
        select(func.count(ChatSession.id)).where(ChatSession.user_id == user.id)
    )
    count = result.scalar() or 0
    return {"count": int(count)}


class InterpretRequest(BaseModel):
    test_id: str = Field(..., min_length=1, max_length=64)
    test_title: str = Field("", max_length=200)
    score: int = Field(..., ge=0, le=1000)
    max_score: int = Field(..., ge=1, le=1000)
    level: str = Field("", max_length=120)
    # Per-item scores, used only to check the self-harm item. Never persisted.
    answers: list[int] | None = None
    campaign_code: str | None = Field(None, max_length=32)


@router.post("/interpret")
async def interpret_result(
    body: InterpretRequest,
    user: User | None = Depends(get_current_user_optional),
):
    """Personal, non-diagnostic reading of a test result.

    Public: the tests are the main ad landing, and requiring signup before the
    result would kill the funnel.

    Safety is decided here, not by the caller — ``test_safety.assess`` sees the
    raw answers and its verdict overrides everything: on a heavy result the
    prompt changes, monetisation is switched off, and crisis contacts are
    returned for the client to render above the CTA.
    """
    safety = test_safety.assess(body.test_id, body.score, body.max_score, body.answers)

    text = await _generate_interpretation(body, safety)

    if user:
        import asyncio
        asyncio.create_task(events.log_event_for_user(
            user.id, events.EVENT_TEST_RESULT_VIEWED,
            campaign_code=attribution.normalize_code(body.campaign_code),
            payload={
                "test_id": body.test_id,
                "score_band": body.level[:64],
                "is_severe": safety["is_severe"],
            },
        ))

    return {
        "interpretation": text,
        "is_severe": safety["is_severe"],
        "show_crisis_resources": safety["show_crisis_resources"],
        "allow_monetization": safety["allow_monetization"],
        "crisis": safety["crisis"],
        "disclaimer": (
            "Это результат опросника для самонаблюдения, а не диагноз. "
            "Точную картину может увидеть только специалист."
        ),
    }


_SAFE_TAIL = (
    "\n\nЭто результат опросника, а не диагноз. "
    "Если состояние держится или усиливается — имеет смысл обсудить его со специалистом."
)


async def _generate_interpretation(body: InterpretRequest, safety: dict) -> str:
    """Ask the small model for a short, non-diagnostic reading.

    Falls back to a written-in-advance safe text on any failure or when the
    daily budget is spent — a result screen must never break or hang, and the
    tests are the top of the paid funnel.
    """
    if await spend_guard.is_global_limit_reached():
        return _fallback_text(body, safety)

    pct = round(100 * body.score / body.max_score)
    if safety["show_crisis_resources"]:
        tone = (
            "Результат в тяжёлой зоне. Пиши особенно бережно. "
            "НЕ предлагай никаких упражнений, покупок и продуктов. "
            "Главная мысль: с этим не нужно оставаться одному, и разговор с живым "
            "специалистом сейчас важнее любых приложений."
        )
    else:
        tone = (
            "Дай спокойную, поддерживающую интерпретацию и один небольшой "
            "конкретный шаг, который человек может сделать на этой неделе."
        )

    prompt = f"""Ты — Ника, ИИ-собеседник для самоанализа. Человек прошёл опросник «{body.test_title or body.test_id}».

Результат: {body.score} из {body.max_score} ({pct}%). Зона: «{body.level}».

{tone}

ЖЁСТКИЕ ЗАПРЕТЫ:
- Никаких диагнозов и медицинских терминов в утвердительной форме («у тебя депрессия», «это тревожное расстройство»). Пиши «результат опросника показывает», «по ответам заметно».
- Не используй слова «терапия», «лечение», «диагноз», «пациент».
- Не обещай результатов и не давай гарантий.

Формат: 2–3 коротких абзаца, на «ты», по-русски, живым языком. Без списков и заголовков. Не больше 130 слов."""

    try:
        from app.agents.base import client

        response = await client.chat.completions.create(
            model=settings.ZAI_SMALL_MODEL,
            max_tokens=400,
            temperature=0.7,
            messages=[{"role": "user", "content": prompt}],
        )
        if getattr(response, "usage", None):
            import asyncio
            asyncio.create_task(spend_guard.record_usage(
                None,
                response.usage.prompt_tokens or 0,
                response.usage.completion_tokens or 0,
            ))
        text = (response.choices[0].message.content or "").strip()
        if text:
            return text + _SAFE_TAIL
    except Exception as e:
        logger.warning("test_interpretation_failed", test_id=body.test_id, error=str(e))

    return _fallback_text(body, safety)


def _fallback_text(body: InterpretRequest, safety: dict) -> str:
    if safety["show_crisis_resources"]:
        return (
            "По ответам видно, что сейчас тебе тяжело. Это не диагноз — это сигнал, "
            "что с этим состоянием не стоит оставаться наедине.\n\n"
            "Самое полезное, что можно сделать прямо сейчас, — позвонить на одну из "
            "бесплатных линий выше или связаться с близким человеком, которому доверяешь."
            + _SAFE_TAIL
        )
    return (
        f"Твой результат — «{body.level}» ({body.score} из {body.max_score}). "
        "Это снимок текущего состояния, а не характеристика тебя.\n\n"
        "Попробуй на этой неделе замечать, в какие моменты становится легче, "
        "а в какие — тяжелее. Такие наблюдения дают больше, чем сам балл."
        + _SAFE_TAIL
    )


@router.delete("/results/{result_id}")
async def delete_test_result(
    result_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TestResult).where(
            TestResult.id == result_id,
            TestResult.user_id == user.id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Result not found")
    await db.delete(row)
    await db.commit()
    return {"ok": True}
