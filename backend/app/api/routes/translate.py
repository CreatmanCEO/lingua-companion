import json
import hashlib
import logging
import litellm
from fastapi import APIRouter
from pydantic import BaseModel
from app.prompts import PromptBuilder

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["translate"])

_translation_cache: dict[str, str] = {}


class TranslateRequest(BaseModel):
    text: str
    to: str  # "ru" or "en"


class TranslateResponse(BaseModel):
    translated: str
    cached: bool = False


@router.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    cache_key = hashlib.md5(f"{req.text}:{req.to}".encode()).hexdigest()

    if cache_key in _translation_cache:
        return TranslateResponse(translated=_translation_cache[cache_key], cached=True)

    system_prompt, params = PromptBuilder("translation").build()
    lang_name = "Russian" if req.to == "ru" else "English"

    try:
        response = await litellm.acompletion(
            model=params["model"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Translate to {lang_name}: {req.text}"},
            ],
            response_format={"type": "json_object"},
            temperature=params["temperature"],
            max_tokens=params["max_tokens"],
        )

        raw = response.choices[0].message.content
        result = json.loads(raw)
        translated = result.get("translated", req.text)
    except Exception:
        logger.error("Translation failed", exc_info=True)
        translated = req.text  # fallback: return original

    _translation_cache[cache_key] = translated
    logger.info("Translated %d chars to %s", len(req.text), req.to)

    return TranslateResponse(translated=translated)
