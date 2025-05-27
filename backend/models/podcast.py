from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, text
from sqlalchemy.orm import relationship, Session
from sqlalchemy.exc import OperationalError
from .database import Base, SessionLocal

# Global flag to track if created_at column exists
_created_at_column_exists = None

def _check_created_at_column_exists(db):
    """Check if the created_at column exists in the podcasts table"""
    global _created_at_column_exists
    if _created_at_column_exists is None:
        try:
            # Try a simple query that would fail if created_at doesn't exist
            db.execute(text("SELECT created_at FROM podcasts LIMIT 1")).fetchone()
            _created_at_column_exists = True
        except OperationalError as e:
            if "no such column" in str(e).lower() and "created_at" in str(e).lower():
                _created_at_column_exists = False
            else:
                raise
    return _created_at_column_exists

class Podcast(Base):
    __tablename__ = "podcasts"
    id   = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    audio_filename = Column(String, nullable=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    script_text = Column(Text, nullable=True)
    duration = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=True)
    # episodes = relationship("Episode", back_populates="podcast")


def create_podcast(user_id: int, document_id: int, title: str, script_text: str, audio_filename: str, duration: float = None):
    db = SessionLocal()
    try:
        # Check if created_at column exists
        if _check_created_at_column_exists(db):
            # Use ORM if column exists
            pod = Podcast(
                user_id=user_id,
                document_id=document_id,
                title=title,
                script_text=script_text,
                audio_filename=audio_filename,
                duration=duration,
                created_at=datetime.utcnow()
            )
            db.add(pod)
            db.commit()
            db.refresh(pod)
            return pod
        else:
            # Use raw SQL if column doesn't exist
            # Ensure document_id is not None
            if document_id is None:
                print(f"Warning: document_id is None, this should not happen")
                raise ValueError("document_id cannot be None")
                
            data = {
                "user_id": user_id,
                "document_id": document_id,
                "title": title,
                "script_text": script_text,
                "audio_filename": audio_filename,
                "duration": duration
            }
            
            # Filter out None values to avoid SQL issues
            filtered_data = {k: v for k, v in data.items() if v is not None}
            
            columns = ", ".join(filtered_data.keys())
            named_placeholders = ", ".join([f":{k}" for k in filtered_data.keys()])
            
            print(f"Creating podcast with data: {filtered_data}")
            
            db.execute(text(f"INSERT INTO podcasts ({columns}) VALUES ({named_placeholders})"), filtered_data)
            db.commit()
            result = db.execute(text("SELECT last_insert_rowid()")).fetchone()
            last_id = result[0]
            # Return raw data instead of trying to load ORM object
            raw_pod_data = db.execute(text("SELECT id, title, description, audio_filename, user_id, document_id, script_text, duration FROM podcasts WHERE id = :id"), {"id": last_id}).fetchone()
            return raw_pod_data
    except Exception as e:
        db.rollback()
        print(f"Error in create_podcast: {e}")
        raise
    finally:
        db.close()


def get_podcasts_for_user(user_id: int):
    db = SessionLocal()
    try:
        if _check_created_at_column_exists(db):
            return db.query(Podcast).filter(Podcast.user_id == user_id).all()
        else:
            # Use raw SQL if column doesn't exist
            result = db.execute(
                text("SELECT id, title, description, audio_filename, user_id, document_id, script_text, duration FROM podcasts WHERE user_id = :user_id"),
                {"user_id": user_id}
            ).fetchall()
            return [dict(row._mapping) for row in result]
    finally:
        db.close()


def get_podcast_by_id(podcast_id: int):
    db = SessionLocal()
    try:
        if _check_created_at_column_exists(db):
            return db.query(Podcast).filter(Podcast.id == podcast_id).first()
        else:
            # Use raw SQL if column doesn't exist
            stmt = text("SELECT id, title, description, audio_filename, user_id, document_id, script_text, duration FROM podcasts WHERE id = :podcast_id")
            result = db.execute(stmt, {"podcast_id": podcast_id}).fetchone()
            return result
    finally:
        db.close()

# Ensure other functions like get_podcasts_for_user also close the session or use a context manager.
# And apply similar fallback if they query the Podcast model directly and might hit this issue.