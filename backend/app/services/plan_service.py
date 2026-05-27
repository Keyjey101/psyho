import hashlib
import json
import uuid
from pathlib import Path

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import client
from app.config import get_settings
from app.models.models import TreatmentPlan, UserProfile

logger = structlog.get_logger()

_PLAN_BUILD_PROMPT: str = (Path(__file__).parent.parent / "agents" / "prompts" / "plan_build.txt").read_text(encoding="utf-8")
_PLAN_UPDATE_PROMPT: str = (Path(__file__).parent.parent / "agents" / "prompts" / "plan_update.txt").read_text(encoding="utf-8")


def _plan_fingerprint(formulation: str, focus_areas: str) -> str:
    normalized = " ".join((formulation + focus_areas).lower().split())
    return hashlib.sha1(normalized.encode("utf-8")).hexdigest()


def compute_agenda(plan: TreatmentPlan | None) -> str:
    if not plan:
        return ""
    try:
        areas = json.loads(plan.focus_areas)
    except (json.JSONDecodeError, TypeError):
        return ""
    active = None
    for a in areas:
        if a.get("id") == plan.active_focus_id:
            active = a
            break
    if not active:
        active = next((a for a in areas if a.get("status") == "active"), None)
    if not active:
        return ""
    return (
        f"Текущий фокус работы: «{active.get('title', '')}». "
        f"{active.get('rationale', '')} "
        "Гибко следуй за человеком — не навязывай тему, работай к ней постепенно и незаметно."
    )


async def get_or_none(user_id: str, db: AsyncSession) -> TreatmentPlan | None:
    result = await db.execute(select(TreatmentPlan).where(TreatmentPlan.user_id == user_id))
    return result.scalar_one_or_none()


def _format_dialog(messages: list[dict], limit: int = 10) -> str:
    lines = []
    for m in messages[-limit:]:
        role = "Пользователь" if m.get("role") == "user" else "Ника"
        lines.append(f"{role}: {m.get('content', '')[:300]}")
    return "\n".join(lines)


async def build_initial_plan(
    user_id: str,
    history: list[dict],
    long_term_memory: str,
    db: AsyncSession,
    session_id: str = "",
) -> TreatmentPlan | None:
    settings = get_settings()
    dialog = _format_dialog(history, limit=12)
    prompt = _PLAN_BUILD_PROMPT.format(
        long_term_memory=long_term_memory or "(пока нет данных)",
        session_dialog=dialog,
    )

    try:
        response = await client.chat.completions.create(
            model=settings.ZAI_MODEL,
            max_tokens=1500,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        data = json.loads(raw)

        formulation = data.get("formulation", "")
        focus_areas_raw = data.get("focus_areas", [])
        plan_summary = data.get("plan_summary", "")

        if not formulation or not focus_areas_raw:
            logger.warning("plan_build_empty", user_id=user_id)
            return None

        for fa in focus_areas_raw:
            if "id" not in fa or not fa["id"]:
                fa["id"] = str(uuid.uuid4())

        focus_areas_json = json.dumps(focus_areas_raw, ensure_ascii=False)
        active_focus_id = ""
        active_area = next((a for a in focus_areas_raw if a.get("status") == "active"), None)
        if active_area:
            active_focus_id = active_area["id"]
        elif focus_areas_raw:
            focus_areas_raw[0]["status"] = "active"
            active_focus_id = focus_areas_raw[0]["id"]
            focus_areas_json = json.dumps(focus_areas_raw, ensure_ascii=False)

        plan_hash = _plan_fingerprint(formulation, focus_areas_json)

        plan = TreatmentPlan(
            user_id=user_id,
            formulation=formulation,
            focus_areas=focus_areas_json,
            active_focus_id=active_focus_id,
            plan_summary=plan_summary,
            plan_hash=plan_hash,
            last_session_id=session_id or None,
        )
        db.add(plan)
        await db.commit()
        await db.refresh(plan)
        logger.info("plan_built", user_id=user_id, focus_count=len(focus_areas_raw))
        return plan

    except (json.JSONDecodeError, IndexError, AttributeError) as e:
        logger.error("plan_build_parse_error", user_id=user_id, error=str(e))
        return None
    except Exception as e:
        logger.error("plan_build_error", user_id=user_id, error=str(e))
        return None


async def update_plan(
    user_id: str,
    history: list[dict],
    long_term_memory: str,
    current_plan_dict: dict,
    db: AsyncSession,
    redirect_signal: bool = False,
    session_id: str = "",
) -> TreatmentPlan | None:
    settings = get_settings()
    dialog = _format_dialog(history, limit=12)

    redirect_note = ""
    if redirect_signal:
        redirect_note = "⚠️ Пользователь просил не обсуждать текущий активный фокус. Де-приоритизируй его и подними следующий."

    prompt = _PLAN_UPDATE_PROMPT.format(
        current_formulation=current_plan_dict.get("formulation", ""),
        current_focus_areas=current_plan_dict.get("focus_areas", "[]"),
        long_term_memory=long_term_memory or "(пока нет данных)",
        session_dialog=dialog,
        redirect_note=redirect_note,
    )

    try:
        response = await client.chat.completions.create(
            model=settings.ZAI_MODEL,
            max_tokens=1500,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        data = json.loads(raw)

        formulation = data.get("formulation", "")
        focus_areas_raw = data.get("focus_areas", [])
        plan_summary = data.get("plan_summary", "")

        if not formulation or not focus_areas_raw:
            logger.warning("plan_update_empty", user_id=user_id)
            return None

        focus_areas_json = json.dumps(focus_areas_raw, ensure_ascii=False)

        new_hash = _plan_fingerprint(formulation, focus_areas_json)

        result = await db.execute(select(TreatmentPlan).where(TreatmentPlan.user_id == user_id))
        plan = result.scalar_one_or_none()
        if not plan:
            return None

        if plan.plan_hash == new_hash:
            logger.info("plan_unchanged", user_id=user_id)
            return plan

        active_focus_id = ""
        active_area = next((a for a in focus_areas_raw if a.get("status") == "active"), None)
        if active_area:
            active_focus_id = active_area["id"]

        plan.formulation = formulation
        plan.focus_areas = focus_areas_json
        plan.active_focus_id = active_focus_id
        plan.plan_summary = plan_summary
        plan.plan_hash = new_hash
        plan.version = (plan.version or 0) + 1
        plan.last_session_id = session_id or plan.last_session_id

        await db.commit()
        await db.refresh(plan)
        logger.info("plan_updated", user_id=user_id, version=plan.version)
        return plan

    except (json.JSONDecodeError, IndexError, AttributeError) as e:
        logger.error("plan_update_parse_error", user_id=user_id, error=str(e))
        return None
    except Exception as e:
        logger.error("plan_update_error", user_id=user_id, error=str(e))
        return None


async def maybe_lower_challenge_tolerance(user_id: str, db: AsyncSession) -> None:
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        return
    current = getattr(profile, "challenge_tolerance", "balanced")
    levels = {"direct-ish": "balanced", "balanced": "gentle", "gentle": "gentle"}
    new_val = levels.get(current, "balanced")
    if new_val != current:
        profile.challenge_tolerance = new_val
        await db.commit()
        logger.info("challenge_tolerance_lowered", user_id=user_id, from_val=current, to_val=new_val)
