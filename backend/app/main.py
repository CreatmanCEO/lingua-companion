import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.api.routes.ws import router as ws_router
from app.api.routes.tts import router as tts_router
from app.api.routes.translate import router as translate_router
from app.api.routes.auth import router as auth_router
from app.api.routes.phrases import router as phrases_router
from app.api.routes.session import router as session_router
from app.api.routes.stats import router as stats_router
from app.api.routes.opengraph import router as opengraph_router
from app.api.routes.push import router as push_router

logger = logging.getLogger(__name__)


async def _initiative_check_loop():
    """Check if companion should send a message (every 30 min)."""
    while True:
        await asyncio.sleep(30 * 60)  # 30 minutes
        try:
            from app.agents.memory import _pool
            if not _pool:
                continue
            # For now, just log — actual push sending requires VAPID keys
            logger.info("Initiative check: would check inactive users")
        except Exception:
            logger.error("Initiative check failed", exc_info=True)


async def _topic_discovery_loop():
    """Fetch topics every 4 hours."""
    from app.agents.topic_discovery import fetch_and_store_topics

    while True:
        try:
            from app.agents.memory import _pool
            if _pool:
                await fetch_and_store_topics(_pool)
        except Exception:
            logger.error("Topic discovery loop failed", exc_info=True)
        await asyncio.sleep(4 * 3600)  # 4 hours


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging(debug=settings.DEBUG)
    print(f"[START] {settings.APP_NAME} v{settings.VERSION} starting...")
    # Start background tasks
    topic_task = asyncio.create_task(_topic_discovery_loop())
    initiative_task = asyncio.create_task(_initiative_check_loop())
    yield
    # Shutdown
    topic_task.cancel()
    initiative_task.cancel()
    from app.agents.memory import close_pool
    await close_pool()
    print("[STOP] Shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "https://lingua.creatman.site"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket routes
app.include_router(ws_router)

# REST routes
app.include_router(auth_router)
app.include_router(tts_router)
app.include_router(translate_router)
app.include_router(phrases_router)
app.include_router(session_router)
app.include_router(stats_router)
app.include_router(opengraph_router)
app.include_router(push_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.VERSION}


# Routers (подключаем по мере реализации)
# from app.api.routes import stt, chat, auth, users
# app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
# app.include_router(stt.router,  prefix="/api/v1/stt",  tags=["stt"])
# app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
