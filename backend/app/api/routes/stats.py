"""
Stats routes — LinguaCompanion

Session statistics recording and aggregation:
- GET /api/v1/stats — user's learning statistics (streak, totals, recent chart data)
- POST /api/v1/stats/record — record a completed session's stats
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from app.api.routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/stats", tags=["stats"])


@router.get("")
async def get_stats(user: dict = Depends(get_current_user)):
    """Get user's learning statistics."""
    try:
        from app.agents.memory import _pool
        if not _pool:
            return _empty_stats()

        async with _pool.acquire() as conn:
            # Streak: consecutive days with sessions
            streak_rows = await conn.fetch(
                """SELECT DISTINCT session_date FROM session_stats
                   WHERE user_id = $1 ORDER BY session_date DESC LIMIT 30""",
                user["id"]
            )
            streak = _calc_streak(streak_rows)

            # Total stats
            totals = await conn.fetchrow(
                """SELECT COALESCE(SUM(message_count), 0) as total_messages,
                          COALESCE(SUM(duration_sec), 0) as total_duration,
                          COALESCE(SUM(error_count), 0) as total_errors,
                          COUNT(*) as total_sessions
                   FROM session_stats WHERE user_id = $1""",
                user["id"]
            )

            # Phrases count
            phrases_count = await conn.fetchval(
                "SELECT COUNT(*) FROM saved_phrases WHERE user_id = $1",
                user["id"]
            ) or 0

            # Last 7 sessions for chart
            recent = await conn.fetch(
                """SELECT session_date, message_count, error_count, duration_sec
                   FROM session_stats WHERE user_id = $1
                   ORDER BY session_date DESC LIMIT 7""",
                user["id"]
            )

        return {
            "streak": streak,
            "total_sessions": totals["total_sessions"],
            "total_messages": totals["total_messages"],
            "total_duration_min": totals["total_duration"] // 60,
            "total_errors": totals["total_errors"],
            "phrases_saved": phrases_count,
            "recent_sessions": [dict(r) for r in recent],
        }
    except Exception:
        logger.error("get_stats failed", exc_info=True)
        return _empty_stats()


@router.post("/record")
async def record_session(data: dict, user: dict = Depends(get_current_user)):
    """Record a completed session's stats."""
    try:
        from app.agents.memory import _pool
        if not _pool:
            raise HTTPException(status_code=503, detail="Database unavailable")

        async with _pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO session_stats (user_id, duration_sec, message_count, error_count, error_breakdown, words_learned)
                   VALUES ($1, $2, $3, $4, $5::jsonb, $6)""",
                user["id"],
                data.get("duration_sec", 0),
                data.get("message_count", 0),
                data.get("error_count", 0),
                json.dumps(data.get("error_breakdown", {})),
                data.get("words_learned", 0),
            )
        return {"recorded": True}
    except HTTPException:
        raise
    except Exception:
        logger.error("record_session failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to record session")


def _calc_streak(rows) -> int:
    if not rows:
        return 0
    from datetime import date, timedelta
    dates = [r["session_date"] for r in rows]
    streak = 1
    for i in range(1, len(dates)):
        if dates[i - 1] - dates[i] == timedelta(days=1):
            streak += 1
        else:
            break
    # Check if streak is current (includes today or yesterday)
    if dates[0] < date.today() - timedelta(days=1):
        return 0
    return streak


def _empty_stats():
    return {
        "streak": 0, "total_sessions": 0, "total_messages": 0,
        "total_duration_min": 0, "total_errors": 0, "phrases_saved": 0,
        "recent_sessions": [],
    }
