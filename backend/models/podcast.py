from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, text, JSON
from sqlalchemy.orm import relationship, Session
from sqlalchemy.exc import OperationalError
from .database import Base, SessionLocal
import json

# Global flag to track if created_at column exists
_created_at_column_exists = None
_segment_timings_column_exists = None

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

def _check_segment_timings_column_exists(db):
    """Check if the segment_timings column exists in the podcasts table"""
    global _segment_timings_column_exists
    if _segment_timings_column_exists is None:
        try:
            # Try a simple query that would fail if segment_timings doesn't exist
            db.execute(text("SELECT segment_timings FROM podcasts LIMIT 1")).fetchone()
            _segment_timings_column_exists = True
        except OperationalError as e:
            if "no such column" in str(e).lower() and "segment_timings" in str(e).lower():
                _segment_timings_column_exists = False
            else:
                raise
    return _segment_timings_column_exists

class Podcast(Base):
    __tablename__ = "podcasts"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    audio_filename = Column(String, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    script_text = Column(Text, nullable=True)
    duration = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=True)
    segment_timings = Column(Text, nullable=True)  # JSON string of timing data
    
    # Relationships
    project = relationship("Project", back_populates="podcasts")
    # episodes = relationship("Episode", back_populates="podcast")


def create_podcast(project_id: int, document_id: int, title: str, script_text: str, audio_filename: str, duration: float = None, segment_timings: list = None):
    """Create a new podcast for a project"""
    db = SessionLocal()
    try:
        # Serialize segment timings to JSON string
        segment_timings_json = json.dumps(segment_timings) if segment_timings else None
        
        # Check if created_at column exists
        if _check_created_at_column_exists(db):
            # Check if segment_timings column exists
            if _check_segment_timings_column_exists(db):
                # Use ORM with all columns
                pod = Podcast(
                    project_id=project_id,
                    document_id=document_id,
                    title=title,
                    script_text=script_text,
                    audio_filename=audio_filename,
                    duration=duration,
                    created_at=datetime.utcnow(),
                    segment_timings=segment_timings_json
                )
            else:
                # Use ORM without segment_timings column
                pod = Podcast(
                    project_id=project_id,
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
            # Use raw SQL if created_at column doesn't exist
            # Ensure document_id is not None
            if document_id is None:
                print(f"Warning: document_id is None, this should not happen")
                raise ValueError("document_id cannot be None")
                
            data = {
                "project_id": project_id,
                "document_id": document_id,
                "title": title,
                "script_text": script_text,
                "audio_filename": audio_filename,
                "duration": duration
            }
            
            # Add segment_timings if column exists
            if _check_segment_timings_column_exists(db):
                data["segment_timings"] = segment_timings_json
            
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
            if _check_segment_timings_column_exists(db):
                raw_pod_data = db.execute(text("SELECT id, title, description, audio_filename, project_id, document_id, script_text, duration, segment_timings FROM podcasts WHERE id = :id"), {"id": last_id}).fetchone()
            else:
                raw_pod_data = db.execute(text("SELECT id, title, description, audio_filename, project_id, document_id, script_text, duration FROM podcasts WHERE id = :id"), {"id": last_id}).fetchone()
            return raw_pod_data
    except Exception as e:
        db.rollback()
        print(f"Error in create_podcast: {e}")
        raise
    finally:
        db.close()


def get_podcasts_for_project(project_id: int):
    """Get all podcasts for a specific project"""
    db = SessionLocal()
    try:
        if _check_created_at_column_exists(db):
            return db.query(Podcast).filter(Podcast.project_id == project_id).all()
        else:
            # Use raw SQL if column doesn't exist
            result = db.execute(
                text("SELECT id, title, description, audio_filename, project_id, document_id, script_text, duration FROM podcasts WHERE project_id = :project_id"),
                {"project_id": project_id}
            ).fetchall()
            return [dict(row._mapping) for row in result]
    finally:
        db.close()


def get_podcasts_for_user(user_id: int):
    """Get all podcasts for a user across all their projects"""
    db = SessionLocal()
    try:
        if _check_created_at_column_exists(db):
            from models.project import Project
            return db.query(Podcast).join(Project).filter(Project.user_id == user_id).all()
        else:
            # Use raw SQL if column doesn't exist
            result = db.execute(
                text("""
                    SELECT p.id, p.title, p.description, p.audio_filename, p.project_id, p.document_id, p.script_text, p.duration 
                    FROM podcasts p 
                    JOIN projects pr ON p.project_id = pr.id 
                    WHERE pr.user_id = :user_id
                """),
                {"user_id": user_id}
            ).fetchall()
            return [dict(row._mapping) for row in result]
    finally:
        db.close()


def get_podcast_by_id(podcast_id: int):
    """Get a specific podcast by ID"""
    db = SessionLocal()
    try:
        if _check_created_at_column_exists(db):
            return db.query(Podcast).filter(Podcast.id == podcast_id).first()
        else:
            # Use raw SQL if column doesn't exist
            if _check_segment_timings_column_exists(db):
                stmt = text("SELECT id, title, description, audio_filename, project_id, document_id, script_text, duration, segment_timings FROM podcasts WHERE id = :podcast_id")
            else:
                stmt = text("SELECT id, title, description, audio_filename, project_id, document_id, script_text, duration FROM podcasts WHERE id = :podcast_id")
            result = db.execute(stmt, {"podcast_id": podcast_id}).fetchone()
            return result
    finally:
        db.close()


def delete_podcast(podcast_id: int):
    """Delete a podcast"""
    db = SessionLocal()
    try:
        if _check_created_at_column_exists(db):
            podcast = db.query(Podcast).filter(Podcast.id == podcast_id).first()
            if podcast:
                db.delete(podcast)
                db.commit()
            return podcast
        else:
            # Use raw SQL if column doesn't exist
            result = db.execute(
                text("SELECT id, title, description, audio_filename, project_id, document_id, script_text, duration FROM podcasts WHERE id = :podcast_id"),
                {"podcast_id": podcast_id}
            ).fetchone()
            if result:
                db.execute(text("DELETE FROM podcasts WHERE id = :podcast_id"), {"podcast_id": podcast_id})
                db.commit()
            return result
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()

# Ensure other functions like get_podcasts_for_user also close the session or use a context manager.
# And apply similar fallback if they query the Podcast model directly and might hit this issue.