from fastapi import FastAPI
from routers import auth, documents, generate as generate_router
import uvicorn

app = FastAPI(
    title="Notecast API",
    description="Backend for the Notecast application",
    version="1.0.0"
)

# Health check endpoints
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok"}

@app.get("/", tags=["Health"])
async def root():
    return {"message": "Welcome to Notecast API"}

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(documents.router, prefix="/documents", tags=["Documents"])
app.include_router(generate_router.router, prefix="/generate", tags=["Generate"])

if __name__ == "__main__":
    uvicorn.run(
        "app:app", host="0.0.0.0", port=8000, reload=True
    )