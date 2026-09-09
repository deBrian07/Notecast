from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import relationship

from models.database import Base, SessionLocal
from models.schemas import UserCreate


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")


def get_user_by_username(username: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if user:
            db.expunge(user)
        return user
    finally:
        db.close()


def create_user(user: UserCreate, hashed_password: str):
    db = SessionLocal()
    try:
        db_user = User(
            username=user.username,
            email=user.email,
            password_hash=hashed_password,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        db.expunge(db_user)
        return db_user
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
