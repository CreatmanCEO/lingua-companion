"""
Companion Agent -- LinguaCompanion

Ответственность:
- Ведёт контекстный диалог с пользователем на английском языке
- Понимает RU/EN code-switching
- Играет одну из трёх персон: Alex (профессионал), Sam (разговорный), Morgan (ментор)
- Использует историю диалога для контекста
- Поддерживает сценарный режим (companionRole, userRole)

Вызывается ПОСЛЕ Reconstruction Agent -- получает уже исправленный текст.
"""
import logging
import litellm
from app.prompts import PromptBuilder

logger = logging.getLogger(__name__)

# Максимальное количество сообщений в истории (скользящее окно)
MAX_HISTORY_MESSAGES = 20

# Дефолтная персона если имя не найдено
_DEFAULT_COMPANION = "Alex"

# Fallback ответ при ошибке LLM
_FALLBACK_RESPONSE = "That's interesting! Could you tell me more about that?"


def _build_messages(
    user_message: str,
    companion: str = _DEFAULT_COMPANION,
    history: list[dict] | None = None,
    scenario: dict | None = None,
    memory_context: str | None = None,
    user_level: str = "B1",
    repeated_errors: list | None = None,
    topic: dict | None = None,
) -> tuple[list[dict], dict]:
    """Формирует список сообщений для LLM и параметры модели."""
    builder = PromptBuilder("companion/base") \
        .with_persona(companion.lower()) \
        .with_block("level_adaptation", level=user_level) \
        .with_block("error_tracking", errors=repeated_errors or []) \
        .with_block("memory_context", facts=memory_context or "") \
        .with_block("scenario_context", scenario=scenario) \
        .with_block("topic_context", topic=topic)

    system_prompt, params = builder.build()
    # Replace {name} placeholder in base template with companion name
    system_prompt = system_prompt.replace("{name}", companion)

    messages = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history[-MAX_HISTORY_MESSAGES:])
    messages.append({"role": "user", "content": user_message})
    return messages, params


async def generate_response(
    user_message: str,
    companion: str = _DEFAULT_COMPANION,
    history: list[dict] | None = None,
    scenario: dict | None = None,
    memory_context: str | None = None,
    user_level: str = "B1",
    repeated_errors: list | None = None,
    topic: dict | None = None,
) -> dict:
    """
    Генерирует ответ companion-агента (non-streaming).

    Returns:
        {"text": "ответ companion", "companion": "имя персоны"}
    """
    messages, params = _build_messages(
        user_message, companion, history, scenario, memory_context,
        user_level, repeated_errors, topic,
    )

    try:
        response = await litellm.acompletion(
            model=params["model"],
            messages=messages,
            temperature=params["temperature"],
            max_tokens=params["max_tokens"],
            num_retries=2,
        )

        text = response.choices[0].message.content.strip()
        logger.info("Companion %s response: %d chars", companion, len(text))
    except Exception:
        logger.error("Companion %s LLM failed, using fallback", companion, exc_info=True)
        text = _FALLBACK_RESPONSE

    return {"text": text, "companion": companion}


async def generate_response_stream(
    user_message: str,
    companion: str = _DEFAULT_COMPANION,
    history: list[dict] | None = None,
    scenario: dict | None = None,
    memory_context: str | None = None,
    user_level: str = "B1",
    repeated_errors: list | None = None,
    topic: dict | None = None,
):
    """
    Streaming ответ companion-агента. Yields dict events:
      {"type": "token", "delta": "..."}
      {"type": "done", "text": "full text", "companion": "..."}
    """
    messages, params = _build_messages(
        user_message, companion, history, scenario, memory_context,
        user_level, repeated_errors, topic,
    )

    try:
        response = await litellm.acompletion(
            model=params["model"],
            messages=messages,
            temperature=params["temperature"],
            max_tokens=params["max_tokens"],
            stream=True,
        )

        full_text = ""
        async for chunk in response:
            delta = chunk.choices[0].delta.content
            if delta:
                full_text += delta
                yield {"type": "token", "delta": delta}

        full_text = full_text.strip()
        logger.info("Companion %s streamed: %d chars", companion, len(full_text))
        yield {"type": "done", "text": full_text, "companion": companion}

    except Exception:
        logger.error("Companion %s stream failed, using fallback", companion, exc_info=True)
        yield {"type": "done", "text": _FALLBACK_RESPONSE, "companion": companion}
