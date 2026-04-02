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
from app.core.config import settings

logger = logging.getLogger(__name__)

ONBOARDING_SYSTEM_PROMPT = """You are a friendly onboarding assistant for LinguaCompanion, an English learning app for Russian-speaking IT developers.

Your task: ask the user 4 questions, ONE AT A TIME. Wait for each answer before asking the next.

Questions (in order):
1. "What's your name?" (or a friendly greeting + name question)
2. "How would you rate your English? A2 (beginner), B1 (intermediate), or B2 (upper-intermediate)?"
3. "What do you work with? (e.g., backend, frontend, DevOps, data science...)"
4. "Pick your preferred conversation style: 1) Professional 2) Casual 3) Mentor"

Rules:
- Ask ONE question at a time
- Be warm and encouraging
- Keep responses short (1-2 sentences + question)
- If the user answers multiple questions at once, acknowledge all answers
- Accept answers in both Russian and English
- After all 4 questions answered, say something like "Great, you're all set! Let's start practicing!"

IMPORTANT: This is onboarding only. Do not teach English yet.
"""

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
    messages = [{"role": "system", "content": ONBOARDING_SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    try:
        response = await litellm.acompletion(
            model=settings.LLM_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=200,
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
        response = await litellm.acompletion(
            model=settings.LLM_MODEL,
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
