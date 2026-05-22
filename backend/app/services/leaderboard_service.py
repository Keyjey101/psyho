"""Leaderboard queries for the Beat-Nika mini-game."""
from __future__ import annotations
import structlog
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.game_models import LeaderboardEntry, UserPseudonym

logger = structlog.get_logger()


def _compute_score(moves_count: int, time_seconds: int, scenario: str) -> int:
    """Score formula:
    Scenario A (Nika wins): moves_count * 10 - (time_seconds // 10)
    Scenario B (user wins): moves_count * 10 + 50
    """
    if scenario == "B":
        return moves_count * 10 + 50
    return moves_count * 10 - (time_seconds // 10)


async def add_entry(
    db: AsyncSession,
    pseudonym_id: str,
    score: int,
    moves_count: int,
    time_seconds: int,
    scenario: str,
    topic: str | None = None,
) -> LeaderboardEntry:
    entry = LeaderboardEntry(
        pseudonym_id=pseudonym_id,
        score=score,
        moves_count=moves_count,
        time_seconds=time_seconds,
        scenario=scenario,
        topic=topic,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def get_leaderboard(
    db: AsyncSession,
    limit: int = 20,
    offset: int = 0,
) -> list[dict]:
    """Return leaderboard rows sorted by score desc."""
    stmt = (
        select(LeaderboardEntry, UserPseudonym.name)
        .join(UserPseudonym, LeaderboardEntry.pseudonym_id == UserPseudonym.id)
        .order_by(LeaderboardEntry.score.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).all()
    result = []
    for rank_idx, (entry, pseudonym_name) in enumerate(rows, start=offset + 1):
        result.append(
            {
                "rank": rank_idx,
                "pseudonym": pseudonym_name,
                "moves": entry.moves_count,
                "score": entry.score,
                "scenario": entry.scenario,
                "time_seconds": entry.time_seconds,
                "topic": entry.topic,
                "created_at": entry.created_at.isoformat(),
            }
        )
    return result


async def get_my_rank(db: AsyncSession, pseudonym_id: str) -> int | None:
    """Return the rank (1-based) of the highest score for this pseudonym."""
    # Find the best score for this pseudonym
    best_stmt = select(func.max(LeaderboardEntry.score)).where(
        LeaderboardEntry.pseudonym_id == pseudonym_id
    )
    best_score = (await db.execute(best_stmt)).scalar_one_or_none()
    if best_score is None:
        return None

    # Count how many distinct pseudonyms have a higher best score
    subq = (
        select(func.max(LeaderboardEntry.score).label("best"))
        .group_by(LeaderboardEntry.pseudonym_id)
        .subquery()
    )
    count_stmt = select(func.count()).select_from(subq).where(subq.c.best > best_score)
    above = (await db.execute(count_stmt)).scalar_one()
    return int(above) + 1
