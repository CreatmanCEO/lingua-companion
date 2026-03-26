"""
Reconstruction Agent — LinguaCompanion

Responsibility:
- Receives mixed RU/EN transcript from STT Agent
- Outputs: corrected English sentence + grammar explanation + error tags
- Runs PARALLEL with Phrase Variants Agent

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

SYSTEM_PROMPT = """You are an expert English grammar coach for Russian-speaking IT professionals.

The user speaks in mixed Russian-English. Your job:
1. Reconstruct their full intent into correct English
2. Identify the main grammar issue (if any)
3. Return JSON only — no preamble

JSON format:
{
  "corrected": "Full corrected English sentence",
  "original_intent": "What the user meant",
  "main_error": "brief description of the main error (null if none)",
  "error_type": "grammar|vocabulary|code_switching|none",
  "explanation": "Short friendly explanation in Russian (1 sentence, null if no error)"
}

Rules:
- Be encouraging, not critical
- Preserve the user's meaning exactly
- For IT terms, use standard English technical vocabulary
- If the input is already correct English, return it unchanged with error_type "none"
"""


async def reconstruct(transcript: str) -> dict:
    """
    Reconstruct mixed RU/EN speech into correct English.
    
    Example:
        input:  "Yesterday я работал над automation pipeline"
        output: {
            "corrected": "Yesterday I was working on an automation pipeline.",
            "original_intent": "The user was working on an automation pipeline yesterday.",
            "main_error": "missing verb conjugation and article",
            "error_type": "grammar",
            "explanation": "Нужно добавить глагол 'was working' и артикль 'an' перед pipeline."
        }
    """
    response = await litellm.acompletion(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Transcript: {transcript}"}
        ],
        response_format={"type": "json_object"},
        temperature=0.3,  # Low temp for accuracy
        max_tokens=300,
    )
    
    raw = response.choices[0].message.content
    
    try:
        result = json.loads(raw)
        logger.info("Reconstruction: input %d chars -> corrected %d chars",
                     len(transcript), len(result.get("corrected", "")))
    except json.JSONDecodeError:
        logger.warning("Reconstruction JSON parse failed, using fallback. Raw: %.100s", raw)
        result = {
            "corrected": transcript,
            "original_intent": transcript,
            "main_error": None,
            "error_type": "none",
            "explanation": None,
        }

    return result
