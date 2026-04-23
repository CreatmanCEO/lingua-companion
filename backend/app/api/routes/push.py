import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/push", tags=["push"])


class SubscribeRequest(BaseModel):
    endpoint: str
    keys: dict  # {p256dh, auth}


@router.post("/subscribe")
async def subscribe(req: SubscribeRequest, user: dict = Depends(get_current_user)):
    try:
        from app.agents.memory import _pool
        if not _pool:
            raise HTTPException(status_code=503, detail="Database unavailable")
        async with _pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4""",
                user["id"], req.endpoint, req.keys.get("p256dh", ""), req.keys.get("auth", "")
            )
        return {"subscribed": True}
    except HTTPException:
        raise
    except Exception:
        logger.error("subscribe failed", exc_info=True)
        raise HTTPException(status_code=500, detail="Subscribe failed")


@router.get("/pending")
async def get_pending(user: dict = Depends(get_current_user)):
    try:
        from app.agents.memory import _pool
        if not _pool:
            return {"messages": []}
        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, text, companion, created_at FROM pending_messages
                   WHERE user_id = $1 AND delivered = FALSE ORDER BY created_at""",
                user["id"]
            )
            if rows:
                ids = [r["id"] for r in rows]
                await conn.execute(
                    "UPDATE pending_messages SET delivered = TRUE WHERE id = ANY($1::int[])", ids
                )
        return {"messages": [dict(r) for r in rows]}
    except Exception:
        logger.error("get_pending failed", exc_info=True)
        return {"messages": []}
