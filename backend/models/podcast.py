from sqlalchemy import Column, Integer, ForeignKey, String, DateTime, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from models.database import Base, SessionLocal

class Podcast(Base):
    __tablename__ = "podcasts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    title = Column(String, nullable=False)
    script_text = Column(Text, nullable=False)
    audio_filename = Column(String, unique=True, nullable=False)
    duration = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    document = relationship("Document")


def create_podcast(user_id: int, document_id: int, title: str, script_text: str, audio_filename: str, duration: float = None):
    db = SessionLocal()
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


def get_podcasts_for_user(user_id: int):
    db = SessionLocal()
    return db.query(Podcast).filter(Podcast.user_id == user_id).all()


def get_podcast_by_id(podcast_id: int):
    db = SessionLocal()
    return db.query(Podcast).filter(Podcast.id == podcast_id).first()