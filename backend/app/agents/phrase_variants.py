"""
Phrase Variants Agent — LinguaCompanion

Responsibility:
- Receives reconstructed English sentence
- Returns 5 stylistic variants SIMULTANEOUSLY
- This is the "tutor killer" feature — no tool on market does this

Variants:
1. Simple      — clear, easy vocabulary
2. Professional — formal, workplace-appropriate  
3. Colloquial  — natural native speaker tone
4. Slang       — informal, contemporary
5. Idiom       — with English idioms/phraseological units

Runs PARALLEL to Companion Agent after STT completes.
"""
import json
import logging
import litellm
from app.core.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert English language coach specializing in teaching 
Russian-speaking IT professionals. 

When given an English sentence, return EXACTLY 5 stylistic variants as JSON.
No preamble, no explanation, just the JSON object.

JSON format:
{
  "simple": "...",
  "professional": "...",
  "colloquial": "...",
  "slang": "...",
  "idiom": "..."
}

Rules:
- simple: basic vocabulary, short sentences, easy to understand
- professional: formal register, suitable for workplace/interviews  
- colloquial: how a native speaker would naturally say it
- slang: informal, contemporary, could include mild slang
- idiom: incorporate a relevant English idiom or phraseological expression
- Preserve the original meaning in all variants
- Keep IT context where relevant
"""


async def get_variants(sentence: str) -> dict:
    """
    Generate 5 stylistic variants of the given English sentence.
    
    Example:
        input:  "I fixed that bug yesterday."
        output: {
            "simple":       "I fixed that bug yesterday.",
            "professional": "I resolved the defect yesterday.",
            "colloquial":   "I squashed that bug yesterday.",
            "slang":        "Crushed that bug yesterday, no cap.",
            "idiom":        "I nailed it — that bug is history."
        }
    """
    response = await litellm.acompletion(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Sentence: {sentence}"}
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
        max_tokens=400,
    )
    
    raw = response.choices[0].message.content
    
    try:
        variants = json.loads(raw)
        logger.info("Variants generated for: %.100s", sentence)
    except json.JSONDecodeError:
        logger.warning("Variants JSON parse failed, using fallback. Raw: %.100s", raw)
        variants = {k: sentence for k in ["simple", "professional", "colloquial", "slang", "idiom"]}

    return variants
