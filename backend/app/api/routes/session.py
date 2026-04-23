import json
import logging

import litellm
from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/session", tags=["session"])


class SummaryRequest(BaseModel):
    history: list[dict]  # [{role, content}, ...]
    error_history: list[dict]  # [{pattern, type, count}, ...]
    duration_seconds: int
    phrases_saved: int = 0


class SummaryResponse(BaseModel):
    duration_min: int
    message_count: int
    new_words: list[str]
    top_errors: list[dict]  # [{error, count}]
    advice: str


@router.post("/summary", response_model=SummaryResponse)
async def session_summary(req: SummaryRequest):
    message_count = len([m for m in req.history if m.get("role") == "user"])
    duration_min = req.duration_seconds // 60

    # Extract top errors
    top_errors = sorted(
        req.error_history, key=lambda e: e.get("count", 0), reverse=True
    )[:5]
    top_errors_formatted = [
        {"error": e["pattern"], "count": e["count"]}
        for e in top_errors
        if e.get("count", 0) > 0
    ]

    # LLM generates advice and new words
    prompt = f"""Analyze this English learning session:
- Duration: {duration_min} minutes
- Messages: {message_count}
- Errors: {json.dumps(top_errors_formatted)}
- Last 5 exchanges: {json.dumps(req.history[-10:])}

Return JSON:
{{"new_words": ["word1", "word2"], "advice": "One encouraging sentence about what to focus on next."}}"""

    try:
        response = await litellm.acompletion(
            model=settings.MODEL_EXTRACTION,  # cheap model
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=200,
        )
        result = json.loads(response.choices[0].message.content)
        new_words = result.get("new_words", [])
        advice = result.get("advice", "Great practice session! Keep going!")
    except Exception:
        logger.error("Summary LLM failed", exc_info=True)
        new_words = []
        advice = "Great practice session! Keep going!"

    return SummaryResponse(
        duration_min=duration_min,
        message_count=message_count,
        new_words=new_words,
        top_errors=top_errors_formatted,
        advice=advice,
    )
