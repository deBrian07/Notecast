import asyncio
from models.database import Base, engine

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("✅ Database schema created and engine disposed.")

if __name__ == "__main__":
    asyncio.run(init_db())