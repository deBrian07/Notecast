import os

import requests
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_cors_origins, settings
from create_db import init_db
from routers import auth, chat, documents, generate as generate_router, projects
from routers.tts import router as tts_router

init_db()
os.makedirs(settings.upload_dir, exist_ok=True)
os.makedirs(settings.podcast_dir, exist_ok=True)

app = FastAPI(
    title="Notecast API",
    description="Backend for the Notecast application",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
async def health_check():
    ollama_ok = False
    try:
        response = requests.get(f"{settings.ollama_url.rstrip('/')}/api/tags", timeout=2)
        ollama_ok = response.ok
    except requests.RequestException:
        ollama_ok = False
    return {
        "status": "ok",
        "ollama": ollama_ok,
        "ollama_url": settings.ollama_url,
        "tts_engine": settings.tts_engine,
    }


@app.get("/", tags=["Health"])
async def root():
    return {"message": "Welcome to Notecast API"}


app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(documents.router)
app.include_router(generate_router.router)
app.include_router(chat.router)
app.include_router(tts_router)

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
