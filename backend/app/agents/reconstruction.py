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
from app.prompts import PromptBuilder

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = {
    "corrected": "",
    "original_intent": "",
    "main_error": None,
    "error_type": "none",
    "explanation": None,
    "changes": [],
}



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
    system_prompt, params = PromptBuilder("reconstruction").build()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Transcript: {transcript}"},
    ]

    for attempt in range(2):
        try:
            response = await litellm.acompletion(
                model=params["model"],
                messages=messages,
                response_format={"type": "json_object"},
                temperature=params["temperature"] if attempt == 0 else 0.1,
                max_tokens=params["max_tokens"],
                num_retries=2,
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
