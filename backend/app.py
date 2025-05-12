import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models.database import Base, engine
from routers import auth, documents, generate as generate_router

# Create all database tables
Base.metadata.create_all(bind=engine)

def create_app():
    app = FastAPI(title="Local Podcast Generator", version="0.1")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Register routers
    app.include_router(auth.router)
    app.include_router(documents.router)
    app.include_router(generate_router.router)
    return app

app = create_app()

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)