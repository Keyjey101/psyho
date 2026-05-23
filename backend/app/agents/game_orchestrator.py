"""Game Orchestrator — drives one Beat-Nika play-through.

Flow per move:
  1. Receive player's choice (choice_index, choice_text).
  2. Run crisis check on choice_text.
  3. Call GameAnalyzer.analyze_answers() on full answer history.
  4. If confidence >= threshold OR move_count >= MAX_MOVES → finish game.
  5. Otherwise call _generate_question() to get the next question.
"""
from __future__ import annotations

import asyncio
import json
import re
import structlog
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.registry import AgentFactory
from app.config import get_settings

# Import agents to trigger @AgentFactory.register
import app.agents.game_analyzer  # noqa: F401
import app.agents.game_designer   # noqa: F401
import app.agents.game_host       # noqa: F401

from app.models.game_models import GameSession

settings = get_settings()
logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Topic → human-readable Russian label
# ---------------------------------------------------------------------------

TOPIC_LABELS: dict[str, str] = {
    "anxiety":        "тревожность",
    "depression":     "подавленность",
    "self_criticism": "самокритика",
    "relationships":  "отношения",
    "burnout":        "выгорание",
    "identity":       "поиск себя",
    "loneliness":     "одиночество",
    "procrastination": "прокрастинация",
}

# ---------------------------------------------------------------------------
# Crisis detection
# ---------------------------------------------------------------------------

_CRISIS_KEYWORDS: tuple[str, ...] = (
    "хочу умереть",
    "не хочу жить",
    "убить себя",
    "покончить с собой",
    "суицид",
    "суицидальн",
    "самоубийство",
    "конец жизни",
    "нет смысла жить",
    "жить незачем",
)


def _check_crisis(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in _CRISIS_KEYWORDS)


# ---------------------------------------------------------------------------
# Host response validation
# ---------------------------------------------------------------------------

FORBIDDEN_PATTERNS: list[re.Pattern] = [
    re.compile(r"агент", re.IGNORECASE),
    re.compile(r"промпт", re.IGNORECASE),
    re.compile(r"архитектур", re.IGNORECASE),
    re.compile(r"диагноз", re.IGNORECASE),
    re.compile(r"клинич", re.IGNORECASE),
]

_MAX_HOST_CHARS = 400  # strict limit; prompt says 300 but give some slack


def strip_and_validate(raw: str) -> tuple[str, bool]:
    """Strip whitespace and check length. Returns (text, ok)."""
    text = raw.strip()
    ok = len(text) <= _MAX_HOST_CHARS and len(text) > 0
    return text, ok


def validate_host_response(text: str) -> tuple[bool, str]:
    """Return (valid, reason). Valid means safe to show to user."""
    text_stripped, ok = strip_and_validate(text)
    if not ok:
        return False, f"length={len(text_stripped)}"
    for pat in FORBIDDEN_PATTERNS:
        if pat.search(text_stripped):
            return False, f"forbidden_pattern={pat.pattern}"
    return True, ""


# ---------------------------------------------------------------------------
# GameOrchestrator
# ---------------------------------------------------------------------------


class GameOrchestrator:
    def __init__(self) -> None:
        self._analyzer = AgentFactory.get("game_analyzer")
        self._designer = AgentFactory.get("game_designer")
        self._host = AgentFactory.get("game_host")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def process_first_move(
        self,
        session: GameSession,
        db: AsyncSession,
    ) -> dict:
        """Generate the very first question for a new session."""
        # Dummy analysis to pick initial topic
        initial_topic = "anxiety"  # safe starter
        question_data = await self._generate_question(session, initial_topic, db)
        return {
            "type": "question",
            "move": 1,
            "text": question_data.get("host_text", ""),
            "choices": question_data.get("choices", []),
        }

    async def process_move(
        self,
        session: GameSession,
        choice_index: int,
        choice_text: str,
        db: AsyncSession,
    ) -> dict:
        """Handle a player's answer; return next question or game result."""
        # --- Crisis check ---
        if _check_crisis(choice_text):
            return {
                "type": "crisis",
                "message": (
                    "Если тебе сейчас тяжело — позвони на линию психологической помощи: "
                    "8-800-2000-122 (бесплатно, РФ). Ты не один."
                ),
            }

        # --- Update session answers ---
        answers: list[dict] = json.loads(session.answers or "[]")
        past_questions: list[str] = json.loads(session.past_questions or "[]")

        # Find current question text from past_questions (last added)
        current_question = past_questions[-1] if past_questions else ""
        answers.append(
            {
                "question": current_question,
                "choice_index": choice_index,
                "choice_text": choice_text,
            }
        )
        session.answers = json.dumps(answers, ensure_ascii=False)
        session.move_count = len(answers)

        # --- Analyze ---
        try:
            from app.services.budget_service import is_budget_exceeded, record_usage
            budget_ok = not await is_budget_exceeded()
        except Exception:
            budget_ok = True

        analysis: dict
        usage: dict | None = None
        if budget_ok:
            try:
                analysis, usage = await asyncio.wait_for(
                    self._analyzer.analyze_answers(answers),  # type: ignore[attr-defined]
                    timeout=settings.GAME_LLM_TIMEOUT,
                )
            except Exception as exc:
                logger.warning("game_analyzer_failed", error=str(exc))
                analysis = _fallback_analysis(answers)
        else:
            logger.warning("game_budget_exceeded_fallback")
            analysis = _fallback_analysis(answers)

        if usage:
            try:
                await record_usage(usage, settings.ZAI_SMALL_MODEL)
            except Exception:
                pass

        dominant_topic: str = analysis.get("dominant_topic", "anxiety")
        confidence: float = float(analysis.get("confidence", 0.0))
        is_ready: bool = bool(analysis.get("ready", False))
        max_moves_reached: bool = session.move_count >= settings.GAME_MAX_MOVES

        await db.commit()

        # --- Finish or continue ---
        if is_ready or max_moves_reached:
            result = await self._finish_game(session, analysis, db)
            await db.commit()
            return result

        # --- Next question ---
        question_data = await self._generate_question(session, dominant_topic, db)
        await db.commit()
        return {
            "type": "question",
            "move": session.move_count + 1,
            "confidence": round(confidence, 2),
            "text": question_data.get("host_text", ""),
            "choices": question_data.get("choices", []),
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _finish_game(
        self,
        session: GameSession,
        analysis: dict,
        db: AsyncSession,
    ) -> dict:
        dominant_topic: str = analysis.get("dominant_topic", "anxiety")
        confidence: float = float(analysis.get("confidence", 0.0))

        # Scenario A: Nika wins (high confidence), B: user wins
        scenario = "A" if confidence >= settings.GAME_CONFIDENCE_THRESHOLD else "B"
        topic_label = TOPIC_LABELS.get(dominant_topic)

        # Generate Nika's result message
        message: str
        try:
            message, usage = await asyncio.wait_for(
                self._host.generate_result_message(  # type: ignore[attr-defined]
                    scenario=scenario,
                    topic_label=topic_label,
                    address_form=session.address_form,
                ),
                timeout=settings.GAME_LLM_TIMEOUT,
            )
        except Exception as exc:
            logger.warning("game_host_result_failed", error=str(exc))
            from app.agents.game_fallback import FALLBACK_CONCLUSIONS_A, FALLBACK_CONCLUSION_B
            import random
            if scenario == "A":
                message = random.choice(FALLBACK_CONCLUSIONS_A)
            else:
                message = FALLBACK_CONCLUSION_B
            usage = None

        # Compute time
        now = datetime.now(timezone.utc)
        started_at = session.started_at
        if started_at and started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        time_seconds = int((now - started_at).total_seconds()) if started_at else 0

        # Persist game result
        session.status = "finished"
        session.scenario = scenario
        session.dominant_topic = dominant_topic
        session.finished_at = now
        session.time_seconds = time_seconds

        # Compute leaderboard score
        from app.services.leaderboard_service import _compute_score
        score = _compute_score(session.move_count, time_seconds, scenario)

        return {
            "type": "result",
            "scenario": scenario,
            "topic": dominant_topic,
            "dominant_topic": dominant_topic,
            "topic_label": topic_label,
            "confidence": round(confidence, 2),
            "message": message,
            "moves": session.move_count,
            "time_seconds": time_seconds,
            "score": score,
            "reasoning": analysis.get("reasoning", ""),
        }

    async def _generate_question(
        self,
        session: GameSession,
        dominant_topic: str,
        db: AsyncSession,
    ) -> dict:
        """Call GameDesigner + GameHost with a retry loop."""
        past_questions: list[str] = json.loads(session.past_questions or "[]")
        move_num = session.move_count + 1

        question_data: dict | None = None
        host_text: str | None = None

        for attempt in range(3):
            try:
                # 1. Designer generates raw question
                raw_q, d_usage = await asyncio.wait_for(
                    self._designer.next_question(  # type: ignore[attr-defined]
                        dominant_topic=dominant_topic,
                        move_num=move_num,
                        past_questions=past_questions,
                    ),
                    timeout=settings.GAME_LLM_TIMEOUT,
                )
                if d_usage:
                    try:
                        from app.services.budget_service import record_usage
                        await record_usage(d_usage, settings.ZAI_SMALL_MODEL)
                    except Exception:
                        pass

                # 2. Host rephrases
                h_text, h_usage = await asyncio.wait_for(
                    self._host.rephrase(  # type: ignore[attr-defined]
                        question_data=raw_q,
                        address_form=session.address_form,
                    ),
                    timeout=settings.GAME_LLM_TIMEOUT,
                )
                if h_usage:
                    try:
                        from app.services.budget_service import record_usage
                        await record_usage(h_usage, settings.ZAI_MODEL)
                    except Exception:
                        pass

                # 3. Validate host response
                valid, reason = validate_host_response(h_text)
                if valid:
                    question_data = raw_q
                    host_text = h_text
                    break
                logger.warning(
                    "game_host_validation_failed",
                    attempt=attempt,
                    reason=reason,
                )
            except Exception as exc:
                logger.warning("game_question_gen_failed", attempt=attempt, error=str(exc))

        if question_data is None or host_text is None:
            # Fallback to static question
            from app.agents.game_fallback import get_fallback_question
            used_indices: list[int] = [
                i for i, q in enumerate(past_questions) if q
            ]
            fb = get_fallback_question(used_indices)
            question_data = fb
            host_text = fb["question"]

        # Store question text for de-duplication
        q_text = question_data.get("question", host_text)
        past_questions.append(q_text)
        session.past_questions = json.dumps(past_questions, ensure_ascii=False)

        return {
            "host_text": host_text,
            "choices": question_data.get("choices", []),
            "raw": question_data,
        }


def _fallback_analysis(answers: list[dict]) -> dict:
    from app.agents.game_fallback import FallbackAnalyzer
    return FallbackAnalyzer().analyze_answers(answers)
