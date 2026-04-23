"""
Onboarding Agent — LinguaCompanion

Ответственность:
- Проводит conversational onboarding нового пользователя
- Задаёт 4 вопроса один за другим (имя, уровень, специальность, стиль)
- Извлекает структурированные данные из ответов
- Определяет когда onboarding завершён
"""
import json
import logging

import litellm
from app.prompts import PromptBuilder

logger = logging.getLogger(__name__)

_REQUIRED_FIELDS = {"name", "level", "specialty", "style"}


async def get_onboarding_response(
    user_message: str,
    history: list[dict],
) -> dict:
    """
    Генерирует ответ onboarding-агента.

    Returns:
        {"text": "ответ", "companion": "Onboarding"}
    """
    system_prompt, params = PromptBuilder("onboarding").build()
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    try:
        response = await litellm.acompletion(
            model=params["model"],
            messages=messages,
            temperature=params["temperature"],
            max_tokens=params["max_tokens"],
        )
        text = response.choices[0].message.content.strip()
    except Exception:
        logger.error("Onboarding LLM failed", exc_info=True)
        text = "Welcome! What's your name?"

    return {"text": text, "companion": "Onboarding"}


async def extract_onboarding_data(history: list[dict]) -> dict:
    """
    Извлекает структурированные данные из истории onboarding.

    Returns:
        {"name": "...", "level": "...", "specialty": "...", "style": "..."} или частично заполненный dict
    """
    if not history:
        return {}

    conversation = "\n".join(
        f"{msg['role']}: {msg['content']}" for msg in history
    )

    try:
        _, params = PromptBuilder("onboarding").build()
        response = await litellm.acompletion(
            model=params["model"],
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract user onboarding data from the conversation. "
                        "Return JSON with keys: name, level (A2/B1/B2), "
                        "specialty (what they work with), style (professional/casual/mentor). "
                        "Only include fields that were explicitly answered. "
                        "Return {} if nothing found."
                    ),
                },
                {"role": "user", "content": conversation},
            ],
            temperature=0.0,
            max_tokens=100,
        )

        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        return json.loads(content)

    except Exception:
        logger.error("extract_onboarding_data failed", exc_info=True)
        return {}


def is_onboarding_complete(data: dict) -> bool:
    """Проверяет что все 4 поля заполнены."""
    return all(data.get(field) for field in _REQUIRED_FIELDS)
