"""
Reconstruction Agent — LinguaCompanion

Responsibility:
- Receives mixed RU/EN transcript from STT Agent
- Outputs: corrected English sentence + grammar explanation + error tags + changes
- Runs BEFORE Phrase Variants Agent (variants receives corrected text)

Handles:
- Code-switching: "Yesterday я работал над pipeline" → "Yesterday I was working on a pipeline"
- Grammar errors: tense, articles, prepositions
- Vocabulary gaps: Russian words → English equivalents
"""
import json
import logging
import litellm
from app.core.config import settings

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = {
    "corrected": "",
    "original_intent": "",
    "main_error": None,
    "error_type": "none",
    "explanation": None,
    "changes": [],
}

SYSTEM_PROMPT = """You are an expert English grammar coach for Russian-speaking IT professionals.

The user speaks in mixed Russian-English. Your job:
1. Reconstruct their full intent into correct English
2. Identify the main grammar issue (if any)
3. List specific changes made
4. Return JSON only — no preamble

JSON format:
{
  "corrected": "Full corrected English sentence",
  "original_intent": "What the user meant",
  "main_error": "brief description of the main error (null if none)",
  "error_type": "grammar|vocabulary|code_switching|none",
  "explanation": "Short friendly explanation in Russian (1 sentence, null if no error)",
  "changes": [{"original": "...", "corrected": "...", "type": "grammar|vocabulary|code_switching"}]
}

Rules:
- Be encouraging, not critical
- Preserve the user's meaning exactly
- For IT terms, use standard English technical vocabulary
- If the input is already correct English, return it unchanged with error_type "none" and empty changes
- "changes" lists each specific fix you made (empty array if no changes)

Examples:

User: Transcript: Yesterday я работал над automation pipeline
Response: {"corrected": "Yesterday I was working on an automation pipeline.", "original_intent": "The user was working on an automation pipeline yesterday.", "main_error": "missing verb conjugation and article", "error_type": "code_switching", "explanation": "Нужно добавить глагол 'was working' и артикль 'an' перед pipeline.", "changes": [{"original": "я работал", "corrected": "I was working", "type": "code_switching"}, {"original": "automation pipeline", "corrected": "an automation pipeline", "type": "grammar"}]}

User: Transcript: I go to office yesterday and fix the bug
Response: {"corrected": "I went to the office yesterday and fixed the bug.", "original_intent": "The user went to the office yesterday and fixed a bug.", "main_error": "past tense errors", "error_type": "grammar", "explanation": "Для прошедшего времени используйте 'went' и 'fixed' вместо 'go' и 'fix'.", "changes": [{"original": "go", "corrected": "went", "type": "grammar"}, {"original": "to office", "corrected": "to the office", "type": "grammar"}, {"original": "fix", "corrected": "fixed", "type": "grammar"}]}

User: Transcript: I deployed the new version to production yesterday.
Response: {"corrected": "I deployed the new version to production yesterday.", "original_intent": "I deployed the new version to production yesterday.", "main_error": null, "error_type": "none", "explanation": null, "changes": []}
"""


def _validate_result(result: dict, transcript: str) -> dict:
    """Validate and fill missing required fields with defaults."""
    for field, default in REQUIRED_FIELDS.items():
        if field not in result:
            result[field] = default
    # Ensure corrected is not empty
    if not result["corrected"]:
        result["corrected"] = transcript
    if not result["original_intent"]:
        result["original_intent"] = transcript
    return result


async def reconstruct(transcript: str) -> dict:
    """
    Reconstruct mixed RU/EN speech into correct English.

    Returns dict with: corrected, original_intent, main_error, error_type, explanation, changes.
    On total failure, returns fallback with raw transcript.
    """
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Transcript: {transcript}"},
    ]

    for attempt in range(2):
        try:
            response = await litellm.acompletion(
                model=settings.LLM_MODEL,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.3 if attempt == 0 else 0.1,
                max_tokens=400,
            )

            raw = response.choices[0].message.content
            result = json.loads(raw)
            result = _validate_result(result, transcript)
            logger.info("Reconstruction: input %d chars -> corrected %d chars",
                        len(transcript), len(result.get("corrected", "")))
            return result

        except json.JSONDecodeError:
            if attempt == 0:
                logger.warning("Reconstruction JSON parse failed (attempt 1), retrying. Raw: %.100s", raw)
                continue
            logger.warning("Reconstruction JSON parse failed (attempt 2), using fallback. Raw: %.100s", raw)
        except Exception:
            logger.error("Reconstruction LLM call failed", exc_info=True)
            break

    # Fallback
    return {
        "corrected": transcript,
        "original_intent": transcript,
        "main_error": None,
        "error_type": "none",
        "explanation": None,
        "changes": [],
    }
