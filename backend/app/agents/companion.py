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
from app.core.config import settings

logger = logging.getLogger(__name__)

# Максимальное количество сообщений в истории (скользящее окно)
MAX_HISTORY_MESSAGES = 20

# Общая часть системного промпта для всех персон
_COMMON_PROMPT = """You are {name}, an AI companion for a Russian-speaking IT developer learning English (A2-B1 level).

The user may mix Russian and English in their speech. This is NORMAL and expected at A2-B1 level (code-switching).
When you encounter Russian words:
1. Acknowledge understanding
2. Provide the English equivalent naturally in your response
3. Do NOT say "please speak in English only"

Respond primarily in English. Keep responses 1-3 sentences.
Ask follow-up questions to keep the conversation going.
Use IT vocabulary naturally when relevant.

Error correction strategy (implicit recasting — 70% of the time):
- Naturally reuse the correct form in your response without drawing attention to the error.
- Example: User says "I go to office yesterday" -> You say "Oh, you went to the office yesterday? What did you work on?"
- Max 2 corrections per turn. Do NOT over-correct.
- For repeated or critical errors, use explicit correction with sandwich method: positive -> correction -> positive.
  Example: "Great structure! Just one thing: use 'went' for past tense. Your vocabulary is growing!"

Scaffolding (when the student struggles):
- First, ask a simpler yes/no question about the same topic
- Provide 2-3 key vocabulary words they might need
- Never give the full answer — guide them to construct it themselves

Conversation repair:
- If you don't understand the user, say "Could you rephrase that?" instead of guessing.
"""

# Персона-специфичные добавки к промпту
COMPANION_PROMPTS = {
    "Alex": (
        _COMMON_PROMPT.format(name="Alex") +
        "Persona: Professional.\n"
        "Tone: Clear, business-like, structured.\n"
        "Style: Use precise vocabulary, professional register. "
        "Adapt to any workplace topic — not only IT. "
        "Suitable for meetings, interviews, presentations, emails.\n"
        "Example: 'That's a solid approach to microservices architecture. "
        "Have you considered using event-driven patterns for better decoupling?'"
    ),
    "Sam": (
        _COMMON_PROMPT.format(name="Sam") +
        "Persona: Casual.\n"
        "Tone: Friendly, relaxed, with occasional humor.\n"
        "Style: Use contractions (don't, gonna, wanna), filler words (like, you know, "
        "I mean), casual connectors (so, anyway, btw). "
        "Like chatting with a cool colleague at lunch.\n"
        "Example: 'Oh man, debugging CSS is the worst, right? "
        "Been there, done that. What's driving you crazy this time?'"
    ),
    "Morgan": (
        _COMMON_PROMPT.format(name="Morgan") +
        "Persona: Mentor.\n"
        "Tone: Patient, encouraging, Socratic questioning.\n"
        "Style: Use 50/50 implicit/explicit correction. "
        "Ask guiding questions instead of giving answers. "
        "Explain nuances of English. May give hints in Russian when the student is stuck.\n"
        "Example: 'Great sentence! A small tip: we usually say "
        "\"work on\" rather than \"work with\" when talking about projects. "
        "It's a subtle difference. What are you working on today?'"
    ),
}

# Дефолтная персона если имя не найдено
_DEFAULT_COMPANION = "Alex"

# Fallback ответ при ошибке LLM
_FALLBACK_RESPONSE = "That's interesting! Could you tell me more about that?"


async def generate_response(
    user_message: str,
    companion: str = _DEFAULT_COMPANION,
    history: list[dict] | None = None,
    scenario: dict | None = None,
) -> dict:
    """
    Генерирует ответ companion-агента на сообщение пользователя.

    Args:
        user_message: Реконструированный английский текст от Reconstruction Agent
        companion: Имя персоны (Alex, Sam, Morgan)
        history: История диалога [{role: "user"|"assistant", content: str}]
        scenario: Контекст сценария {companionRole, userRole} или None

    Returns:
        {"text": "ответ companion", "companion": "имя персоны"}
    """
    if history is None:
        history = []

    # Выбираем системный промпт по имени персоны
    system_prompt = COMPANION_PROMPTS.get(companion, COMPANION_PROMPTS[_DEFAULT_COMPANION])

    # Если есть сценарий -- добавляем контекст ролей
    if scenario:
        companion_role = scenario.get("companionRole", "")
        user_role = scenario.get("userRole", "")
        if companion_role or user_role:
            system_prompt += (
                f"\n\nScenario mode:\n"
                f"Your role: {companion_role}\n"
                f"User's role: {user_role}\n"
                "Stay in character for this scenario."
            )

    # Формируем сообщения для LLM: system + history + текущее сообщение
    messages = [{"role": "system", "content": system_prompt}]

    # Обрезаем историю до MAX_HISTORY_MESSAGES (скользящее окно)
    trimmed_history = history[-MAX_HISTORY_MESSAGES:]
    messages.extend(trimmed_history)

    # Добавляем текущее сообщение пользователя
    messages.append({"role": "user", "content": user_message})

    try:
        response = await litellm.acompletion(
            model=settings.LLM_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=400,
        )

        text = response.choices[0].message.content.strip()
        logger.info("Companion %s response: %d chars", companion, len(text))
    except Exception:
        logger.error("Companion %s LLM failed, using fallback", companion, exc_info=True)
        text = _FALLBACK_RESPONSE

    return {"text": text, "companion": companion}
