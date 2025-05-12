from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from models.database import Base, SessionLocal

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    orig_filename = Column(String, nullable=False)
    stored_filename = Column(String, unique=True, nullable=False)
    file_type = Column(String, nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="documents")


def create_document(user_id: int, orig_filename: str, stored_filename: str, file_type: str):
    db = SessionLocal()
    doc = Document(
        user_id=user_id,
        orig_filename=orig_filename,
        stored_filename=stored_filename,
        file_type=file_type
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def get_documents_for_user(user_id: int):
    db = SessionLocal()
    return db.query(Document).filter(Document.user_id == user_id).all()


def get_document_by_id(doc_id: int):
    db = SessionLocal()
    return db.query(Document).filter(Document.id == doc_id).first()


def delete_document(doc_id: int):
    db = SessionLocal()
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if doc:
        db.delete(doc)
        db.commit()
    return doc