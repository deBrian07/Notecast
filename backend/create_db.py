from models.database import Base, engine
# Import all models to ensure they are registered with Base.metadata
from models.user import User
from models.document import Document
from models.podcast import Podcast
# Add any other models here...

def init_db():
    # Create database directory if it doesn't exist
    import os
    os.makedirs("data", exist_ok=True)
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("✅ Database schema created.")

if __name__ == "__main__":
    init_db()