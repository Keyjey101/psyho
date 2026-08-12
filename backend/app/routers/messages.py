import json
import asyncio
import time
import structlog
from collections import deque
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.models.models import ChatSession, Message, User, UserProfile, TreatmentPlan
from app.schemas.message import MessageResponse, MessageListResponse
from app.middleware.auth import get_current_user
from app.services.auth import decode_token
from app.agents.orchestrator import Orchestrator, SessionPhase
from app.agents.base import client as ai_client
from app.services.context import maybe_compress_context, generate_session_title
from app.services.memory_service import extract_and_update_memory
from app.services.personality_service import compute_personality_snapshot, should_compute_snapshot
from app.services.plan_service import (
    get_or_none as get_plan,
    build_initial_plan,
    update_plan,
    compute_agenda,
    maybe_lower_challenge_tolerance,
)
from app.services import billing, events, spend_guard

from app.config import get_settings

router = APIRouter()

orchestrator = Orchestrator()
settings = get_settings()

_ws_rate_limits: dict[str, deque] = {}


def _check_ws_rate_limit(user_id: str, limit: int) -> bool:
    now = time.monotonic()
    window = 60.0
    if user_id not in _ws_rate_limits:
        _ws_rate_limits[user_id] = deque()
    dq = _ws_rate_limits[user_id]
    while dq and dq[0] < now - window:
        dq.popleft()
    if len(dq) >= limit:
        return False
    dq.append(now)
    return True


FAREWELL_KEYWORDS = {
    "пока", "до свидания", "досвидания", "до встречи", "спасибо большое",
    "всё, спасибо", "всё спасибо", "спасибо, всё", "на этом всё",
    "bye", "goodbye", "до следующего раза", "спасибо за сессию",
}

def _is_farewell(message: str, exchange_count: int) -> bool:
    if exchange_count < 5:
        return False
    msg = message.lower().strip()
    return any(kw in msg for kw in FAREWELL_KEYWORDS) and len(msg) < 80

_memory_counters: dict[str, int] = {}
_plan_counters: dict[str, int] = {}

TASK_EXTRACT_PROMPT = """Из ответа терапевта ниже извлеки конкретную домашнюю задачу / практику, которую предложили пользователю.
Верни только текст задачи, 1 предложение. Если задачи нет — верни пустую строку.

Ответ терапевта:
{response}"""


async def _background_memory_update(current_memory: str | None, messages: list[dict], user_id: str):
    try:
        async with async_session() as mem_db:
            await extract_and_update_memory(current_memory, messages, mem_db, user_id)
    except Exception as e:
        structlog.get_logger().error("Background memory update error", error=str(e))


async def _background_personality_update(user_id: str):
    try:
        async with async_session() as p_db:
            if await should_compute_snapshot(user_id, p_db):
                await compute_personality_snapshot(user_id, p_db)
    except Exception as e:
        structlog.get_logger().error("Background personality update error", error=str(e))


async def _background_plan_build(user_id: str, history: list[dict], long_term_memory: str, session_id: str):
    try:
        async with async_session() as p_db:
            await build_initial_plan(user_id, history, long_term_memory, p_db, session_id=session_id)
    except Exception as e:
        structlog.get_logger().error("Background plan build error", error=str(e))


async def _background_plan_update(
    user_id: str,
    history: list[dict],
    long_term_memory: str,
    current_plan_dict: dict,
    session_id: str,
    redirect_signal: bool = False,
    challenge_tolerance_hit: bool = False,
):
    try:
        async with async_session() as p_db:
            await update_plan(
                user_id, history, long_term_memory, current_plan_dict, p_db,
                redirect_signal=redirect_signal, session_id=session_id,
            )
            if challenge_tolerance_hit:
                await maybe_lower_challenge_tolerance(user_id, p_db)
    except Exception as e:
        structlog.get_logger().error("Background plan update error", error=str(e))


async def _extract_and_save_task(user_id: str, session_id: str, response_text: str):
    try:
        settings_local = get_settings()
        prompt = TASK_EXTRACT_PROMPT.format(response=response_text[:1000])
        task_response = await ai_client.chat.completions.create(
            model=settings_local.ZAI_SMALL_MODEL,
            max_tokens=100,
            temperature=0.1,
            messages=[{"role": "user", "content": prompt}],
        )
        task_text = task_response.choices[0].message.content.strip()
        if task_text and len(task_text) > 10:
            from app.models.models import SessionTask
            async with async_session() as t_db:
                existing = await t_db.execute(
                    select(func.count()).select_from(SessionTask).where(
                        SessionTask.session_id == session_id
                    )
                )
                if (existing.scalar() or 0) == 0:
                    task = SessionTask(
                        user_id=user_id,
                        session_id=session_id,
                        text=task_text,
                    )
                    t_db.add(task)
                    await t_db.commit()
    except Exception as e:
        structlog.get_logger().error("Task extraction error", error=str(e))


@router.get("/{session_id}/messages", response_model=MessageListResponse)
async def list_messages(
    session_id: str,
    offset: int = 0,
    limit: int = 50,
    before_id: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    count_result = await db.execute(
        select(func.count()).where(Message.session_id == session_id)
    )
    total = count_result.scalar() or 0

    q = (
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.desc())
    )
    if before_id:
        sub = select(Message.created_at).where(Message.id == before_id).limit(1)
        sub_result = await db.execute(sub)
        before_time = sub_result.scalar_one_or_none()
        if before_time:
            q = q.where(Message.created_at < before_time)

    msg_result = await db.execute(q.offset(offset).limit(limit))
    messages = list(reversed(msg_result.scalars().all()))
    return MessageListResponse(messages=messages, total=total)


@router.websocket("/{session_id}/chat")
async def websocket_chat(websocket: WebSocket, session_id: str):
    token = websocket.cookies.get("access_token") or websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = payload.get("sub")

    async with async_session() as db:
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            await websocket.close(code=4004, reason="Session not found")
            return

        user_q = await db.execute(select(User).where(User.id == user_id))
        user_obj = user_q.scalar_one_or_none()
        if not user_obj:
            await websocket.close(code=4001, reason="User not found")
            return
        ws_limit = billing.ws_rate_limit_per_minute(user_obj)
        memory_allowed = billing.memory_enabled_for(user_obj)
        # First-touch campaign, stamped on every event this connection emits.
        campaign_code = user_obj.campaign_code
        # Sticky per session: once set, no paywall is shown for the rest of it.
        crisis_in_session = bool(session.crisis_flagged)

        profile_result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == user_id)
        )
        profile = profile_result.scalar_one_or_none()
        preferred_style = profile.preferred_style if profile else "balanced"
        long_term_memory = (
            profile.long_term_memory
            if (profile and profile.memory_enabled and memory_allowed)
            else ""
        )
        therapy_goals = profile.therapy_goals or "" if profile else ""
        address_form = getattr(profile, "address_form", "ты") if profile else "ты"
        gender = getattr(profile, "gender", "") if profile else ""
        challenge_tolerance = getattr(profile, "challenge_tolerance", "balanced") if profile else "balanced"

        plan_obj = await get_plan(user_id, db)
        agenda = compute_agenda(plan_obj)
        plan_formulation = plan_obj.formulation if plan_obj else ""
        active_focus = ""
        if plan_obj and plan_obj.active_focus_id:
            try:
                import json as _json
                areas = _json.loads(plan_obj.focus_areas)
                for a in areas:
                    if a.get("id") == plan_obj.active_focus_id:
                        active_focus = a.get("title", "")
                        break
            except Exception:
                pass

        continuation_context = session.continuation_context
        existing_msg_result = await db.execute(
            select(func.count()).where(Message.session_id == session_id)
        )
        existing_count = existing_msg_result.scalar() or 0

        plan_dict_for_background = None
        if plan_obj:
            plan_dict_for_background = {
                "formulation": plan_obj.formulation,
                "focus_areas": plan_obj.focus_areas,
            }

    await websocket.accept()

    if continuation_context and existing_count == 0:
        try:
            ctx = json.loads(continuation_context)
            insights = ctx.get("insights", "")
            prev_title = ctx.get("previous_title", "нашу предыдущую сессию")
        except Exception:
            insights = ""
            prev_title = "нашу предыдущую сессию"

        if insights:
            try:
                parsed = json.loads(insights)
                continue_from = parsed.get("continue_from", "")
                main_theme = parsed.get("main_theme", "")
                key_insights = parsed.get("key_insights", [])
                homework = parsed.get("homework", "")
            except Exception:
                continue_from = ""
                main_theme = ""
                key_insights = []
                homework = ""

            focus_hint = ""
            if active_focus:
                focus_hint = f"\nТекущий фокус долгосрочной работы (не озвучивать): «{active_focus}»"

            continuation_prompt = f"""КОНТЕКСТ ДЛЯ НИКА (не показывать пользователю):
Это продолжение предыдущей сессии «{prev_title}».
Главная тема: {main_theme}
Ключевые инсайты: {', '.join(key_insights) if key_insights else 'нет'}
{'Домашняя практика: ' + homework if homework else ''}{focus_hint}

ЗАДАЧА: Начни новую сессию естественно. {continue_from or 'Поприветствуй пользователя и спроси как он/она себя чувствует.'}
Говори как Ника — тепло, без официоза. НЕ перечисляй всё подряд — выбери главное."""

            greeting_content = ""
            try:
                from app.agents.base import client as ai_client

                system_prompt = orchestrator.system_prompt
                if plan_formulation:
                    system_prompt += f"\n\n## Рабочая гипотеза (для тебя, не озвучивать)\n{plan_formulation}"
                if active_focus:
                    system_prompt += f"\n\n## Фокус этой сессии (внутреннее, не озвучивать)\n{active_focus}"

                stream = await ai_client.chat.completions.create(
                    model=settings.ZAI_MODEL,
                    max_tokens=settings.SYNTHESIS_MAX_TOKENS,
                    temperature=0.7,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": continuation_prompt},
                    ],
                    stream=True,
                )
                await websocket.send_json({"type": "agents_used", "agents": ["orchestrator"]})
                async for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta.content:
                        token_content = chunk.choices[0].delta.content
                        greeting_content += token_content
                        await websocket.send_json({"type": "token", "content": token_content})
            except Exception as e:
                structlog.get_logger().error("Continuation greeting error", error=str(e))

            if greeting_content:
                async with async_session() as db:
                    greeting_msg = Message(
                        session_id=session_id,
                        role="assistant",
                        content=greeting_content,
                        agents_used=json.dumps(["orchestrator"]),
                    )
                    db.add(greeting_msg)
                    await db.commit()
                    await db.refresh(greeting_msg)
                    await websocket.send_json({"type": "done", "message_id": greeting_msg.id})

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            if msg_type not in ("message", "regenerate"):
                continue

            is_regenerate = msg_type == "regenerate"

            if not _check_ws_rate_limit(user_id, ws_limit):
                await websocket.send_json({"type": "error", "message": "Слишком много сообщений. Подожди немного."})
                continue

            # Hard daily token ceiling, independent of credits — a single
            # runaway account must not be able to drain the LLM budget.
            allowed, used_tokens, token_limit = await spend_guard.check_user_allowance(user_id)
            if not allowed:
                await websocket.send_json({
                    "type": "error",
                    "message": "На сегодня достаточно — ты исчерпал(а) дневной лимит. Возвращайся завтра, я буду здесь.",
                })
                asyncio.create_task(events.log_event_for_user(
                    user_id, events.EVENT_USER_LIMIT_HIT,
                    payload={"tokens": used_tokens, "session_id": session_id},
                ))
                continue

            if is_regenerate:
                async with async_session() as db:
                    last_msg_q = await db.execute(
                        select(Message)
                        .where(Message.session_id == session_id)
                        .order_by(Message.created_at.desc())
                        .limit(1)
                    )
                    last_msg = last_msg_q.scalar_one_or_none()
                    if not last_msg or last_msg.role != "assistant":
                        await websocket.send_json({
                            "type": "error",
                            "message": "Нечего перегенерировать.",
                        })
                        continue

                    last_user_q = await db.execute(
                        select(Message)
                        .where(
                            Message.session_id == session_id,
                            Message.role == "user",
                        )
                        .order_by(Message.created_at.desc())
                        .limit(1)
                    )
                    last_user = last_user_q.scalar_one_or_none()
                    if not last_user:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Нет сообщения, к которому можно вернуться.",
                        })
                        continue

                    content = last_user.content
                    await db.execute(delete(Message).where(Message.id == last_msg.id))
                    await db.commit()
            else:
                content = data.get("content", "").strip()
                if not content:
                    continue
                if len(content) > settings.MAX_MESSAGE_LENGTH:
                    await websocket.send_json({"type": "error", "message": "Сообщение слишком длинное (максимум 4000 символов)"})
                    continue

            async with async_session() as db:
                if not is_regenerate:
                    user_msg = Message(
                        session_id=session_id,
                        role="user",
                        content=content,
                    )
                    db.add(user_msg)
                    await db.commit()

                count_result = await db.execute(
                    select(func.count()).where(
                        Message.session_id == session_id,
                        Message.role == "user",
                    )
                )
                exchange_count = count_result.scalar() or 0

                msg_result = await db.execute(
                    select(Message)
                    .where(Message.session_id == session_id)
                    .order_by(Message.created_at.desc())
                    .limit(20)
                )
                recent_messages = list(reversed(msg_result.scalars().all()))

                history_dicts = [
                    {"role": m.role, "content": m.content, "agents_used": m.agents_used}
                    for m in recent_messages
                ]

                sess_result = await db.execute(
                    select(ChatSession).where(ChatSession.id == session_id)
                )
                fresh_session = sess_result.scalar_one_or_none()
                summary_text = fresh_session.summary if fresh_session else ""
                max_exchanges = fresh_session.max_exchanges if fresh_session else settings.SESSION_MAX_EXCHANGES

            # Activation funnel. Metadata only — the message text never leaves
            # this function. Fire-and-forget so streaming isn't delayed.
            if not is_regenerate:
                if exchange_count == 1:
                    asyncio.create_task(events.log_event_for_user(
                        user_id, events.EVENT_FIRST_MESSAGE,
                        campaign_code=campaign_code,
                        payload={
                            "session_id": session_id,
                            "message_length": len(content),
                            "message_index": exchange_count,
                        },
                    ))
                elif exchange_count == 3:
                    asyncio.create_task(events.log_event_for_user(
                        user_id, events.EVENT_MESSAGE_3,
                        campaign_code=campaign_code,
                        payload={
                            "session_id": session_id,
                            "message_length": len(content),
                            "message_index": exchange_count,
                        },
                    ))

            agents_used_list = []
            full_response = ""
            token_usage_data = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            turn_redirect_signal = False
            turn_crisis = False

            try:
                async for event in orchestrator.process(
                    content, history_dicts, summary_text, preferred_style, long_term_memory,
                    therapy_goals, address_form, gender,
                    exchange_number=exchange_count,
                    max_exchanges=max_exchanges,
                    session_id=session_id,
                    plan_formulation=plan_formulation,
                    active_focus=active_focus,
                    agenda=agenda,
                    challenge_tolerance=challenge_tolerance,
                ):
                    if event["type"] == "turn_meta":
                        turn_redirect_signal = event.get("redirect_signal", False)
                        turn_crisis = bool(event.get("crisis"))
                        continue
                    if event["type"] == "token":
                        await websocket.send_json({"type": "token", "content": event["content"]})
                        full_response += event["content"]
                    elif event["type"] == "agents_used":
                        agents_used_list = event["agents"]
                        await websocket.send_json({"type": "agents_used", "agents": agents_used_list})
                    elif event["type"] == "token_usage":
                        token_usage_data = {
                            "prompt_tokens": event.get("prompt_tokens", 0),
                            "completion_tokens": event.get("completion_tokens", 0),
                            "total_tokens": event.get("total_tokens", 0),
                        }
                    elif event["type"] == "error":
                        await websocket.send_json({"type": "error", "message": event["message"]})
            except Exception as e:
                structlog.get_logger().error("Orchestrator error", error=str(e))
                await websocket.send_json({"type": "error", "message": "Произошла ошибка. Попробуй ещё раз."})
                break

            async with async_session() as db:
                assistant_msg = Message(
                    session_id=session_id,
                    role="assistant",
                    content=full_response,
                    agents_used=json.dumps(agents_used_list) if agents_used_list else None,
                    prompt_tokens=token_usage_data.get("prompt_tokens"),
                    completion_tokens=token_usage_data.get("completion_tokens"),
                    total_tokens=token_usage_data.get("total_tokens"),
                )
                db.add(assistant_msg)

                result2 = await db.execute(
                    select(ChatSession).where(ChatSession.id == session_id)
                )
                sess = result2.scalar_one_or_none()
                if sess:
                    sess.updated_at = datetime.now(timezone.utc)
                    if not sess.title:
                        title = await generate_session_title(content)
                        sess.title = title
                    if turn_crisis and not sess.crisis_flagged:
                        # Sticky for the rest of the session: a person in an
                        # acute state must never hit a "credits ran out" wall.
                        sess.crisis_flagged = True

                await db.commit()
                await db.refresh(assistant_msg)

                compressed = await maybe_compress_context(db, session_id)
                if compressed:
                    await websocket.send_json({"type": "context_compressed"})

                await websocket.send_json({
                    "type": "done",
                    "message_id": assistant_msg.id,
                    "exchange_count": exchange_count,
                    "max_exchanges": max_exchanges,
                    # The client uses this to suppress the fake-door paywall.
                    "crisis_in_session": crisis_in_session or turn_crisis,
                })

            # Book the spend against today's global + per-user ceilings.
            asyncio.create_task(spend_guard.record_usage(
                user_id,
                token_usage_data.get("prompt_tokens", 0),
                token_usage_data.get("completion_tokens", 0),
            ))

            if turn_crisis:
                if not crisis_in_session:
                    crisis_in_session = True
                # Two separate events: the detector fired, and the resources
                # actually reached the screen (the response was streamed).
                asyncio.create_task(events.log_event_for_user(
                    user_id, events.EVENT_CRISIS_DETECTED,
                    campaign_code=campaign_code,
                    payload={"session_id": session_id, "exchange_count": exchange_count},
                ))
                if full_response:
                    asyncio.create_task(events.log_event_for_user(
                        user_id, events.EVENT_CRISIS_RESOURCES_SHOWN,
                        campaign_code=campaign_code,
                        payload={"session_id": session_id},
                    ))

            if profile and profile.memory_enabled and memory_allowed and full_response:
                _memory_counters[session_id] = _memory_counters.get(session_id, 0) + 1
                if _memory_counters[session_id] % 3 == 0:
                    memory_task_mem = profile.long_term_memory
                    memory_task_history = list(history_dicts)
                    asyncio.create_task(
                        _background_memory_update(memory_task_mem, memory_task_history, user_id)
                    )

            if full_response:
                asyncio.create_task(_background_personality_update(user_id))

            if exchange_count > 0 and max_exchanges > 0:
                phase = SessionPhase.WORK
                pct = exchange_count / max_exchanges
                if pct >= 0.90:
                    phase = SessionPhase.CLOSE
                elif pct >= 0.75:
                    phase = SessionPhase.INTEGRATION
                if phase in (SessionPhase.CLOSE, SessionPhase.INTEGRATION) and full_response:
                    asyncio.create_task(
                        _extract_and_save_task(user_id, session_id, full_response)
                    )

            session_ending = False
            if exchange_count >= max_exchanges:
                session_ending = True
                await websocket.send_json({"type": "session_limit_reached"})

            if _is_farewell(content, exchange_count) and exchange_count < max_exchanges:
                session_ending = True
                await websocket.send_json({"type": "session_limit_reached"})

            if session_ending:
                asyncio.create_task(events.log_event_for_user(
                    user_id, events.EVENT_SESSION_COMPLETED,
                    campaign_code=campaign_code,
                    payload={
                        "session_id": session_id,
                        "exchange_count": exchange_count,
                        "max_exchanges": max_exchanges,
                    },
                ))

            if session_ending and full_response:
                if not plan_dict_for_background:
                    completed_sessions_count = 0
                    try:
                        async with async_session() as cnt_db:
                            cnt_result = await cnt_db.execute(
                                select(func.count()).where(ChatSession.user_id == user_id)
                            )
                            completed_sessions_count = cnt_result.scalar() or 0
                    except Exception:
                        pass
                    if completed_sessions_count >= 1:
                        asyncio.create_task(
                            _background_plan_build(
                                user_id, list(history_dicts), long_term_memory, session_id
                            )
                        )
                else:
                    challenge_hit = turn_redirect_signal
                    asyncio.create_task(
                        _background_plan_update(
                            user_id, list(history_dicts), long_term_memory,
                            plan_dict_for_background, session_id,
                            redirect_signal=turn_redirect_signal,
                            challenge_tolerance_hit=challenge_hit,
                        )
                    )

            if plan_dict_for_background and not session_ending:
                _plan_counters[session_id] = _plan_counters.get(session_id, 0) + 1
                if turn_redirect_signal or (_plan_counters[session_id] % 9 == 0):
                    asyncio.create_task(
                        _background_plan_update(
                            user_id, list(history_dicts), long_term_memory,
                            plan_dict_for_background, session_id,
                            redirect_signal=turn_redirect_signal,
                            challenge_tolerance_hit=turn_redirect_signal,
                        )
                    )

    except WebSocketDisconnect:
        pass
