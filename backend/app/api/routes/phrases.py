"""
Phrase Library routes — CRUD + SM-2 spaced repetition

Endpoints:
  POST   /api/v1/phrases          — save a phrase
  GET    /api/v1/phrases          — list all saved phrases
  GET    /api/v1/phrases/due      — get phrases due for review
  POST   /api/v1/phrases/{id}/review — review with SM-2
  DELETE /api/v1/phrases/{id}     — delete a phrase
"""

import logging
import math
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.api.routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/phrases", tags=["phrases"])


class SavePhraseRequest(BaseModel):
    text: str
    style: Optional[str] = None
    context: Optional[str] = None
    translation: Optional[str] = None
    source_message: Optional[str] = None


class ReviewRequest(BaseModel):
    quality: int  # 0-5 (SM-2 scale)


class PhraseResponse(BaseModel):
    id: int
    text: str
    style: Optional[str]
    context: Optional[str]
    translation: Optional[str]
    ease_factor: float
    interval_days: int
    repetitions: int
    next_review: str
    created_at: str


def sm2_update(quality: int, ease_factor: float, interval: int, repetitions: int) -> tuple[float, int, int]:
    """SM-2 algorithm. Returns (new_ease_factor, new_interval, new_repetitions)."""
    if quality < 3:
        # Failed review — reset
        return max(1.3, ease_factor - 0.2), 1, 0

    # Successful review
    new_ef = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)

    if repetitions == 0:
        new_interval = 1
    elif repetitions == 1:
        new_interval = 6
    else:
        new_interval = math.ceil(interval * new_ef)

    return new_ef, new_interval, repetitions + 1


@router.post("")
async def save_phrase(req: SavePhraseRequest, user: dict = Depends(get_current_user)):
    """Save a phrase to the library."""
    try:
        from app.agents.memory import _pool
        if not _pool:
            raise HTTPException(status_code=503, detail="Database unavailable")

        async with _pool.acquire() as conn:
            row = await conn.fetchrow(
                """INSERT INTO saved_phrases (user_id, text, style, context, translation, source_message)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   RETURNING id, created_at""",
                user["id"], req.text, req.style, req.context, req.translation, req.source_message
            )
        return {"id": row["id"], "created_at": str(row["created_at"])}
    except HTTPException:
        raise
    except Exception:
        logger.error("save_phrase failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save phrase")


@router.get("")
async def list_phrases(user: dict = Depends(get_current_user)):
    """List all saved phrases."""
    try:
        from app.agents.memory import _pool
        if not _pool:
            raise HTTPException(status_code=503, detail="Database unavailable")

        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, text, style, context, translation, ease_factor,
                          interval_days, repetitions, next_review, created_at
                   FROM saved_phrases WHERE user_id = $1
                   ORDER BY created_at DESC""",
                user["id"]
            )
        return {"phrases": [dict(r) for r in rows]}
    except HTTPException:
        raise
    except Exception:
        logger.error("list_phrases failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list phrases")


@router.get("/due")
async def due_phrases(user: dict = Depends(get_current_user)):
    """Get phrases due for review today."""
    try:
        from app.agents.memory import _pool
        if not _pool:
            raise HTTPException(status_code=503, detail="Database unavailable")

        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, text, style, context, translation, ease_factor,
                          interval_days, repetitions, next_review, created_at
                   FROM saved_phrases WHERE user_id = $1 AND next_review <= NOW()
                   ORDER BY next_review ASC""",
                user["id"]
            )
        return {"phrases": [dict(r) for r in rows]}
    except HTTPException:
        raise
    except Exception:
        logger.error("due_phrases failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get due phrases")


@router.post("/{phrase_id}/review")
async def review_phrase(phrase_id: int, req: ReviewRequest, user: dict = Depends(get_current_user)):
    """Review a phrase using SM-2 algorithm."""
    if not 0 <= req.quality <= 5:
        raise HTTPException(status_code=400, detail="Quality must be 0-5")

    try:
        from app.agents.memory import _pool
        if not _pool:
            raise HTTPException(status_code=503, detail="Database unavailable")

        async with _pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT ease_factor, interval_days, repetitions FROM saved_phrases WHERE id = $1 AND user_id = $2",
                phrase_id, user["id"]
            )
            if not row:
                raise HTTPException(status_code=404, detail="Phrase not found")

            new_ef, new_interval, new_reps = sm2_update(
                req.quality, row["ease_factor"], row["interval_days"], row["repetitions"]
            )
            next_review = datetime.now(timezone.utc) + timedelta(days=new_interval)

            await conn.execute(
                """UPDATE saved_phrases SET ease_factor = $1, interval_days = $2,
                   repetitions = $3, next_review = $4 WHERE id = $5""",
                new_ef, new_interval, new_reps, next_review, phrase_id
            )

        return {"ease_factor": new_ef, "interval_days": new_interval, "repetitions": new_reps, "next_review": str(next_review)}
    except HTTPException:
        raise
    except Exception:
        logger.error("review_phrase failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Review failed")


@router.delete("/{phrase_id}")
async def delete_phrase(phrase_id: int, user: dict = Depends(get_current_user)):
    """Delete a saved phrase."""
    try:
        from app.agents.memory import _pool
        if not _pool:
            raise HTTPException(status_code=503, detail="Database unavailable")

        async with _pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM saved_phrases WHERE id = $1 AND user_id = $2",
                phrase_id, user["id"]
            )
        return {"deleted": True}
    except HTTPException:
        raise
    except Exception:
        logger.error("delete_phrase failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Delete failed")
