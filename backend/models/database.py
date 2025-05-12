from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.engine import make_url
from core.config import settings

# Parse and ensure an async driver for SQLite if necessary
url = make_url(settings.database_url)
if url.drivername == "sqlite":
    # switch to aiosqlite for async
    url = url.set(drivername="sqlite+aiosqlite")
DATABASE_URL = str(url)

# Create an AsyncEngine
engine: AsyncEngine = create_async_engine(
    DATABASE_URL,
    echo=settings.debug,
    future=True
)

# Async session factory
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=sessionmaker().class_,  # ensure AsyncSession class
    expire_on_commit=False,
    autoflush=False,
    autocommit=False
)

# Base class for ORM models
Base = declarative_base()