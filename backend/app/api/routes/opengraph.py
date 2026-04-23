"""
OpenGraph routes — LinguaCompanion

Fetches OpenGraph metadata from URLs for rich link card previews.
In-memory cache to avoid repeated fetches.
"""

import logging
import hashlib

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["opengraph"])

_og_cache: dict[str, dict] = {}


@router.get("/opengraph")
async def get_opengraph(url: str):
    """Fetch OpenGraph metadata for a given URL."""
    cache_key = hashlib.md5(url.encode()).hexdigest()
    if cache_key in _og_cache:
        return _og_cache[cache_key]

    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "LinguaCompanion/1.0"})

        soup = BeautifulSoup(resp.text, "html.parser")

        title = _og(soup, "og:title")
        if not title:
            title = soup.title.string if soup.title else url

        result = {
            "title": title,
            "description": _og(soup, "og:description") or "",
            "image": _og(soup, "og:image") or "",
            "favicon": f"https://www.google.com/s2/favicons?domain={url.split('/')[2]}&sz=32",
            "url": url,
        }

        _og_cache[cache_key] = result
        return result
    except Exception:
        logger.error("OpenGraph fetch failed for %s", url, exc_info=True)
        return {"title": url, "description": "", "image": "", "favicon": "", "url": url}


def _og(soup, prop: str) -> str:
    """Extract an OpenGraph meta tag value."""
    tag = soup.find("meta", property=prop)
    return tag["content"] if tag and tag.get("content") else ""
