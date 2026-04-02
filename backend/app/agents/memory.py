"""
Memory Agent — LinguaCompanion

Ответственность:
- Embeddings через Google Embeddings API (768-dim)
- Семантический поиск по memory_vectors (cosine similarity)
- CRUD для user_facts и vocab_gaps
- Извлечение фактов из текста через LLM

Все операции try/except — не блокируют основной pipeline.
"""
import json
import logging
from typing import Optional

import httpx
import litellm

try:
    import asyncpg
except ImportError:
    asyncpg = None  # type: ignore[assignment]

from app.core.config import settings

logger = logging.getLogger(__name__)

USER_ID = "default"

_pool = None


async def get_pool():
    """Получить или создать пул подключений к БД."""
    global _pool
    if _pool is None:
        if asyncpg is None:
            raise RuntimeError("asyncpg is not installed")
        _pool = await asyncpg.create_pool(
            settings.DATABASE_URL,
            min_size=1,
            max_size=5,
        )
    return _pool


async def close_pool():
    """Закрыть пул подключений при shutdown."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def embed_text(text: str) -> list[float]:
    """
    Получить embedding через Google Embeddings API (768-dim).
    При ошибке возвращает нулевой вектор.
    """
    if not text.strip():
        return [0.0] * 768

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GOOGLE_EMBEDDINGS_MODEL}:embedContent",
                params={"key": settings.GEMINI_API_KEY},
                json={
                    "model": f"models/{settings.GOOGLE_EMBEDDINGS_MODEL}",
                    "content": {"parts": [{"text": text}]},
                },
                timeout=10.0,
            )

            if resp.status_code == 200:
                values = resp.json()["embedding"]["values"]
                return values
            else:
                logger.error("Embeddings API error %d: %s", resp.status_code, resp.text)
                return [0.0] * 768

    except Exception:
        logger.error("embed_text failed", exc_info=True)
        return [0.0] * 768


async def search_memory(
    user_id: str,
    query: str,
    top_k: int = 5,
) -> list[dict]:
    """
    Семантический поиск по memory_vectors (cosine similarity).
    Возвращает top_k записей с text и metadata.
    """
    try:
        embedding = await embed_text(query)
        pool = await get_pool()

        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT text, metadata, 1 - (embedding <=> $1::vector) AS similarity
                FROM memory_vectors
                WHERE user_id = $2
                ORDER BY embedding <=> $1::vector
                LIMIT $3
                """,
                str(embedding),
                user_id,
                top_k,
            )

        return [
            {
                "text": row["text"],
                "metadata": json.loads(row["metadata"]) if isinstance(row["metadata"], str) else row["metadata"],
                "similarity": float(row["similarity"]),
            }
            for row in rows
        ]

    except Exception:
        logger.error("search_memory failed", exc_info=True)
        return []


async def store_memory(
    user_id: str,
    text: str,
    metadata: dict | None = None,
) -> None:
    """Embed + INSERT в memory_vectors."""
    try:
        embedding = await embed_text(text)
        pool = await get_pool()

        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO memory_vectors (user_id, text, embedding, metadata)
                VALUES ($1, $2, $3::vector, $4::jsonb)
                """,
                user_id,
                text,
                str(embedding),
                json.dumps(metadata or {}),
            )

        logger.info("Stored memory for user %s: %d chars", user_id, len(text))

    except Exception:
        logger.error("store_memory failed", exc_info=True)


async def get_user_facts(user_id: str) -> dict:
    """SELECT key, value FROM user_facts WHERE user_id = $1."""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT key, value FROM user_facts WHERE user_id = $1",
                user_id,
            )
        return {row["key"]: row["value"] for row in rows}

    except Exception:
        logger.error("get_user_facts failed", exc_info=True)
        return {}


async def upsert_fact(user_id: str, key: str, value: str) -> None:
    """INSERT ON CONFLICT UPDATE для user_facts."""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO user_facts (user_id, key, value, updated_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (user_id, key)
                DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                """,
                user_id,
                key,
                value,
            )

    except Exception:
        logger.error("upsert_fact failed", exc_info=True)


async def track_vocab_gap(
    user_id: str,
    word: str,
    correct_form: str | None = None,
) -> None:
    """UPSERT error_count++ для vocab_gaps."""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO vocab_gaps (user_id, word, correct_form, error_count, last_seen)
                VALUES ($1, $2, $3, 1, NOW())
                ON CONFLICT (user_id, word)
                DO UPDATE SET
                    error_count = vocab_gaps.error_count + 1,
                    correct_form = COALESCE(EXCLUDED.correct_form, vocab_gaps.correct_form),
                    last_seen = NOW()
                """,
                user_id,
                word,
                correct_form,
            )

    except Exception:
        logger.error("track_vocab_gap failed", exc_info=True)


async def extract_facts(text: str) -> dict:
    """
    Извлечь факты из текста через LLM (~50 tokens).
    Возвращает dict с ключами: name, level, specialty, interests, etc.
    """
    try:
        response = await litellm.acompletion(
            model=settings.LLM_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract user facts from the text. Return JSON with keys: "
                        "name, level, specialty, interests, tech_stack. "
                        "Only include facts that are explicitly stated. "
                        "Return empty {} if no facts found."
                    ),
                },
                {"role": "user", "content": text},
            ],
            temperature=0.0,
            max_tokens=100,
        )

        content = response.choices[0].message.content.strip()
        # Parse JSON — handle markdown code blocks
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        return json.loads(content)

    except Exception:
        logger.error("extract_facts failed", exc_info=True)
        return {}
