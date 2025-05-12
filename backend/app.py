from fastapi import FastAPI
from routers import auth, documents, generate as generate_router
from routers.tts import router as tts_router
import uvicorn

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Notecast API",
    description="Backend for the Notecast application",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
      "https://notecast.infinia.chat",
      "https://api.infinia.chat",   # if you ever call from the API domain itself
      "http://localhost:5173"        # for local dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoints
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok"}

@app.get("/", tags=["Health"])
async def root():
    return {"message": "Welcome to Notecast API"}

# Include routers
app.include_router(auth.router)
app.include_router(documents.router)          # router already has prefix
app.include_router(generate_router.router)
app.include_router(tts_router)

if __name__ == "__main__":
    uvicorn.run(
        "app:app", host="0.0.0.0", port=8000, reload=True
    )