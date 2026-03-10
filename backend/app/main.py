from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"🚀 {settings.APP_NAME} v{settings.VERSION} starting...")
    yield
    # Shutdown
    print("👋 Shutting down...")


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


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.VERSION}


# Routers (подключаем по мере реализации)
# from app.api.routes import stt, chat, auth, users
# app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
# app.include_router(stt.router,  prefix="/api/v1/stt",  tags=["stt"])
# app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
