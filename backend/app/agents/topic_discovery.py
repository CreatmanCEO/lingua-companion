"""
Topic Discovery Agent — LinguaCompanion

Fetches IT topics from HN and Reddit RSS, generates discussion prompts.
Runs as background task every 4 hours.
"""
import json
import logging
import asyncio
from xml.etree import ElementTree
import httpx
import litellm
from app.prompts import PromptBuilder
from app.core.config import settings

logger = logging.getLogger(__name__)

RSS_SOURCES = {
    "hn": "https://hnrss.org/frontpage?count=10",
    "reddit": "https://www.reddit.com/r/programming/.rss?limit=10",
}

MAX_TOPICS_PER_USER = 20


async def fetch_rss(url: str, source: str) -> list[dict]:
    """Fetch and parse RSS feed, return list of {title, url, description}."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers={"User-Agent": "LinguaCompanion/1.0"})
            resp.raise_for_status()

        root = ElementTree.fromstring(resp.text)
        items = []

        # Handle both RSS and Atom feeds
        ns = {"atom": "http://www.w3.org/2005/Atom"}

        # RSS format (HN)
        for item in root.findall(".//item")[:5]:
            title = item.findtext("title", "")
            link = item.findtext("link", "")
            desc = item.findtext("description", "")[:200] if item.findtext("description") else ""
            if title and link:
                items.append({"title": title, "url": link, "description": desc, "source": source})

        # Atom format (Reddit)
        for entry in root.findall(".//atom:entry", ns)[:5]:
            title = entry.findtext("atom:title", "", ns)
            link_el = entry.find("atom:link", ns)
            link = link_el.get("href", "") if link_el is not None else ""
            content = entry.findtext("atom:content", "", ns)[:200] if entry.findtext("atom:content", "", ns) else ""
            if title and link:
                items.append({"title": title, "url": link, "description": content, "source": source})

        logger.info("Fetched %d topics from %s", len(items), source)
        return items
    except Exception:
        logger.error("Failed to fetch RSS from %s", source, exc_info=True)
        return []


async def generate_discussion_prompt(title: str, description: str, level: str = "B1") -> str:
    """Generate a discussion prompt for a topic using LLM."""
    system_prompt, params = PromptBuilder("topic_discovery").build()

    try:
        response = await litellm.acompletion(
            model=params["model"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Topic: {title}\nDescription: {description}\nUser level: {level}"},
            ],
            response_format={"type": "json_object"},
            temperature=params["temperature"],
            max_tokens=params["max_tokens"],
        )
        raw = response.choices[0].message.content
        result = json.loads(raw)
        return result.get("discussion_prompt", f"What do you think about {title}?")
    except Exception:
        logger.error("Discussion prompt generation failed", exc_info=True)
        return f"Hey, I saw this article about {title}. What do you think?"


async def fetch_and_store_topics(pool, user_id: str = "anonymous", level: str = "B1"):
    """Fetch topics from all RSS sources and store in DB."""
    if not pool:
        logger.warning("No DB pool, skipping topic discovery")
        return

    all_items = []
    for source, url in RSS_SOURCES.items():
        items = await fetch_rss(url, source)
        all_items.extend(items)

    if not all_items:
        return

    async with pool.acquire() as conn:
        for item in all_items[:10]:  # max 10 per fetch
            # Check if URL already exists
            exists = await conn.fetchval(
                "SELECT 1 FROM topics WHERE url = $1 AND user_id = $2",
                item["url"], user_id
            )
            if exists:
                continue

            prompt = await generate_discussion_prompt(item["title"], item["description"], level)

            await conn.execute(
                """INSERT INTO topics (user_id, title, url, description, discussion_prompt, source)
                   VALUES ($1, $2, $3, $4, $5, $6)""",
                user_id, item["title"], item["url"], item["description"], prompt, item["source"]
            )

        # Prune old topics
        await conn.execute(
            """DELETE FROM topics WHERE user_id = $1 AND id NOT IN (
                SELECT id FROM topics WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2
            )""",
            user_id, MAX_TOPICS_PER_USER
        )

    logger.info("Topic discovery complete for user %s", user_id)


async def get_next_topic(pool, user_id: str = "anonymous") -> dict | None:
    """Get the next unseen topic for the user."""
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT id, title, url, description, discussion_prompt, source
                   FROM topics WHERE user_id = $1 AND seen = FALSE
                   ORDER BY created_at DESC LIMIT 1""",
                user_id
            )
            if row:
                await conn.execute("UPDATE topics SET seen = TRUE WHERE id = $1", row["id"])
                return dict(row)
    except Exception:
        logger.error("get_next_topic failed", exc_info=True)
    return None
