from datetime import datetime
from xmlrpc.client import DateTime
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base, SessionLocal

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
    # episodes = relationship("Episode", back_populates="podcast")


def create_podcast(user_id: int, document_id: int, title: str, script_text: str, audio_filename: str, duration: float = None):
    db = SessionLocal()
    try:
        # Try with all fields
        pod = Podcast(
            user_id=user_id,
            document_id=document_id,
            title=title,
            script_text=script_text,
            audio_filename=audio_filename,
            duration=duration
        )
        db.add(pod)
        db.commit()
        db.refresh(pod)
        return pod
    except Exception as e:
        db.rollback()
        # Try with just the minimal required fields
        try:
            pod = Podcast(
                user_id=user_id,
                title=title,
                audio_filename=audio_filename
            )
            db.add(pod)
            db.commit()
            db.refresh(pod)
            return pod
        except Exception as inner_e:
            db.rollback()
            print(f"Failed to create podcast: {inner_e}")
            raise


def get_podcasts_for_user(user_id: int):
    db = SessionLocal()
    return db.query(Podcast).filter(Podcast.user_id == user_id).all()


def get_podcast_by_id(podcast_id: int):
    db = SessionLocal()
    return db.query(Podcast).filter(Podcast.id == podcast_id).first()