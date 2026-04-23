"""
Auth routes — LinguaCompanion

Supabase Auth integration:
1. Frontend calls Supabase client directly for login/register
2. Frontend sends Supabase access_token to backend
3. Backend validates token via Supabase /auth/v1/user endpoint
4. Backend extracts user_id from validated token
"""

import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Depends, Header

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


async def validate_supabase_token(token: str) -> dict:
    """Validate Supabase JWT and return user info dict.

    Returns {"id": ..., "email": ...} on success.
    Raises Exception on failure.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise ValueError("Supabase not configured (SUPABASE_URL / SUPABASE_ANON_KEY missing)")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.SUPABASE_ANON_KEY,
            },
            timeout=10.0,
        )

    if resp.status_code != 200:
        raise ValueError(f"Invalid token (status {resp.status_code})")

    user = resp.json()
    return {"id": user["id"], "email": user.get("email", "")}


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """FastAPI dependency: validate Supabase JWT from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        return await validate_supabase_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    """Return current authenticated user info."""
    return user
