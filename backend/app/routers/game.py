"""REST + WebSocket endpoints for the Beat-Nika mini-game."""
from __future__ import annotations

import json
import uuid
import asyncio
import structlog
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.models.game_models import (
    GameSession,
    UserPseudonym,
    LeaderboardEntry,
    LandingAnswer,
    BudgetTracker,
)
from app.services.auth import decode_token
from app.services import pseudonym_service, leaderboard_service, budget_service
from app.agents.registry import AgentFactory
from app.agents.game_orchestrator import GameOrchestrator
from app.config import get_settings

# Trigger agent registration
import app.agents.game_analyzer  # noqa: F401
import app.agents.game_designer  # noqa: F401
import app.agents.game_host      # noqa: F401

settings = get_settings()
logger = structlog.get_logger()

router = APIRouter()
ws_router = APIRouter()

_game_orchestrator = GameOrchestrator()

GAME_SESSION_COOKIE = "game_session_id"
GAME_SESSION_MAX_AGE = settings.GAME_SESSION_TTL_HOURS * 3600


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class LandingAnswerIn(BaseModel):
    question: str
    choice_text: str
    choice_index: int


class PseudonymIn(BaseModel):
    session_id: Optional[str] = None
    type: str = "generated"  # generated | ironic | custom
    custom_name: Optional[str] = None
    show_in_leaderboard: bool = True


class ResetSessionIn(BaseModel):
    pass


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_or_create_anon_session(
    anon_id: str,
    db: AsyncSession,
    user_id: str | None = None,
) -> GameSession:
    """Return active session for anon_id or create a new one."""
    result = await db.execute(
        select(GameSession)
        .where(GameSession.anon_id == anon_id, GameSession.status == "active")
        .limit(1)
    )
    session = result.scalar_one_or_none()
    if session is None:
        session = GameSession(
            anon_id=anon_id,
            user_id=user_id,
            status="active",
            move_count=0,
            answers="[]",
            past_questions="[]",
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
    return session


def _get_anon_id_from_request(request: Request) -> str | None:
    return request.cookies.get(GAME_SESSION_COOKIE)


def _get_user_id_from_request(request: Request) -> str | None:
    token = (
        request.cookies.get("access_token")
        or request.headers.get("Authorization", "").replace("Bearer ", "") or None
    )
    if not token:
        return None
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None
    return payload.get("sub")


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------


@router.get("/session")
async def get_or_create_session(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Return current active game session (create if needed). Sets cookie."""
    anon_id = _get_anon_id_from_request(request)
    if not anon_id:
        anon_id = str(uuid.uuid4())

    user_id = _get_user_id_from_request(request)
    session = await _get_or_create_anon_session(anon_id, db, user_id)

    response.set_cookie(
        key=GAME_SESSION_COOKIE,
        value=anon_id,
        httponly=True,
        samesite="lax",
        max_age=GAME_SESSION_MAX_AGE,
    )

    return {
        "session_id": session.id,
        "anon_id": anon_id,
        "status": session.status,
        "move_count": session.move_count,
        "max_moves": settings.GAME_MAX_MOVES,
        "scenario": session.scenario,
        "dominant_topic": session.dominant_topic,
    }


@router.post("/landing-answer")
async def submit_landing_answer(
    request: Request,
    body: LandingAnswerIn,
    db: AsyncSession = Depends(get_db),
):
    anon_id = _get_anon_id_from_request(request)
    user_id = _get_user_id_from_request(request)

    answer = LandingAnswer(
        anon_id=anon_id,
        user_id=user_id,
        question=body.question,
        choice_text=body.choice_text,
        choice_index=body.choice_index,
    )
    db.add(answer)
    await db.commit()
    return {"ok": True}


@router.get("/leaderboard")
async def get_leaderboard(
    offset: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    entries = await leaderboard_service.get_leaderboard(db, limit=min(limit, 100), offset=offset)
    return {"entries": entries, "offset": offset, "limit": limit}


@router.post("/pseudonym")
async def set_pseudonym(
    request: Request,
    body: PseudonymIn,
    db: AsyncSession = Depends(get_db),
):
    """Assign a pseudonym to the current anon session."""
    anon_id = _get_anon_id_from_request(request)
    if not anon_id:
        raise HTTPException(status_code=400, detail="No game session cookie found")

    # --- Resolve name based on type ---
    if body.type == "custom":
        raw = (body.custom_name or "").strip()
        if not raw:
            raise HTTPException(status_code=400, detail="custom_name required")
        if len(raw) > 40:
            raise HTTPException(status_code=400, detail="Pseudonym too long")
        if await pseudonym_service.pseudonym_exists(db, raw):
            raise HTTPException(status_code=409, detail="Pseudonym already taken")
        name = raw
    elif body.type == "ironic":
        name = await pseudonym_service.generate_ironic_pseudonym(db)
    else:  # "generated" or anything else
        name = await pseudonym_service.generate_pseudonym(db)

    user_id = _get_user_id_from_request(request)
    pseudonym = UserPseudonym(name=name, user_id=user_id)
    db.add(pseudonym)
    await db.flush()

    # --- Attach pseudonym to sessions for this anon_id ---
    target_session: Optional[GameSession] = None
    if body.session_id:
        res = await db.execute(
            select(GameSession).where(
                GameSession.id == body.session_id,
                GameSession.anon_id == anon_id,
            )
        )
        target_session = res.scalar_one_or_none()
        if target_session is not None:
            target_session.pseudonym_id = pseudonym.id

    # Also attach to any other sessions of this anon (best-effort)
    result = await db.execute(
        select(GameSession).where(GameSession.anon_id == anon_id)
    )
    for s in result.scalars().all():
        s.pseudonym_id = pseudonym.id
        if target_session is None:
            target_session = s

    # --- Leaderboard entry (only if requested and session finished) ---
    if (
        body.show_in_leaderboard
        and target_session is not None
        and target_session.scenario
        and target_session.status in ("finished", "finished_a", "finished_b")
    ):
        try:
            score = leaderboard_service._compute_score(
                target_session.move_count,
                target_session.time_seconds or 0,
                target_session.scenario,
            )
            await leaderboard_service.add_entry(
                db=db,
                pseudonym_id=pseudonym.id,
                score=score,
                moves_count=target_session.move_count,
                time_seconds=target_session.time_seconds or 0,
                scenario=target_session.scenario,
                topic=target_session.dominant_topic,
            )
        except Exception as exc:
            logger.warning("game_leaderboard_save_failed", error=str(exc))

    await db.commit()
    return {"id": pseudonym.id, "pseudonym_id": pseudonym.id, "name": name, "pseudonym": name}


@router.post("/pseudonym/generate")
async def generate_pseudonym(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    name = await pseudonym_service.generate_pseudonym(db)
    return {"name": name}


@router.post("/session/{session_id}/reset")
async def reset_session(
    session_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Mark session as expired and create a fresh one for the same anon_id."""
    anon_id = _get_anon_id_from_request(request)
    result = await db.execute(
        select(GameSession).where(GameSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None or (anon_id and session.anon_id != anon_id):
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = "expired"
    await db.commit()

    user_id = _get_user_id_from_request(request)
    new_anon_id = anon_id or str(uuid.uuid4())
    new_session = GameSession(
        anon_id=new_anon_id,
        user_id=user_id,
        status="active",
        move_count=0,
        answers="[]",
        past_questions="[]",
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return {"session_id": new_session.id, "status": "active"}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------


@ws_router.websocket("/{session_id}")
async def game_ws_endpoint(
    websocket: WebSocket,
    session_id: str,
):
    await websocket.accept()
    logger.info("game_ws_connected", session_id=session_id)

    async with async_session() as db:
        result = await db.execute(
            select(GameSession).where(GameSession.id == session_id)
        )
        session = result.scalar_one_or_none()

        if session is None:
            await websocket.send_json({"type": "error", "message": "Session not found"})
            await websocket.close()
            return

        if session.status != "active":
            await websocket.send_json({
                "type": "error",
                "message": "Session is not active",
                "status": session.status,
            })
            await websocket.close()
            return

        # On first connect with no moves, generate first question
        if session.move_count == 0 and not json.loads(session.past_questions or "[]"):
            try:
                first_q = await _game_orchestrator.process_first_move(session, db)
                await db.commit()
                await websocket.send_json(first_q)
            except Exception as exc:
                logger.error("game_first_move_failed", error=str(exc))
                await websocket.send_json({"type": "error", "message": "Failed to generate first question"})

        # Main message loop
        try:
            while True:
                raw = await websocket.receive_text()
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                    continue

                msg_type = data.get("type")

                if msg_type == "answer":
                    choice_index = data.get("choice_index")
                    if choice_index is None:
                        choice_index = data.get("choice")
                    choice_text = data.get("choice_text", "")

                    if choice_index is None:
                        await websocket.send_json({"type": "error", "message": "choice_index required"})
                        continue

                    # Re-fetch session to get latest state
                    await db.refresh(session)
                    if session.status != "active":
                        await websocket.send_json({
                            "type": "error",
                            "message": "Session already finished",
                        })
                        continue

                    # Send "thinking" indicator
                    await websocket.send_json({"type": "thinking"})

                    try:
                        move_result = await _game_orchestrator.process_move(
                            session=session,
                            choice_index=int(choice_index),
                            choice_text=str(choice_text),
                            db=db,
                        )
                    except Exception as exc:
                        logger.error("game_process_move_failed", error=str(exc))
                        await websocket.send_json({
                            "type": "error",
                            "message": "Internal error processing move",
                        })
                        continue

                    await websocket.send_json(move_result)

                    # If game finished, close after sending result
                    if move_result.get("type") == "result":
                        # Save leaderboard entry if session has a pseudonym
                        if session.pseudonym_id and session.scenario:
                            try:
                                score = move_result.get("score", 0)
                                await leaderboard_service.add_entry(
                                    db=db,
                                    pseudonym_id=session.pseudonym_id,
                                    score=score,
                                    moves_count=session.move_count,
                                    time_seconds=session.time_seconds or 0,
                                    scenario=session.scenario,
                                    topic=session.dominant_topic,
                                )
                            except Exception as exc:
                                logger.warning("game_leaderboard_save_failed", error=str(exc))
                        break

                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

                else:
                    await websocket.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})

        except WebSocketDisconnect:
            logger.info("game_ws_disconnected", session_id=session_id)
        except Exception as exc:
            logger.error("game_ws_error", session_id=session_id, error=str(exc))
            try:
                await websocket.send_json({"type": "error", "message": "Unexpected error"})
            except Exception:
                pass
