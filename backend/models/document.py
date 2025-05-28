from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from models.database import Base, SessionLocal

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    orig_filename = Column(String, nullable=False)
    stored_filename = Column(String, unique=True, nullable=False)
    file_type = Column(String, nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="documents")


def create_document(project_id: int, orig_filename: str, stored_filename: str, file_type: str):
    """Create a new document for a project"""
    db = SessionLocal()
    try:
        doc = Document(
            project_id=project_id,
            orig_filename=orig_filename,
            stored_filename=stored_filename,
            file_type=file_type
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


def get_documents_for_project(project_id: int):
    """Get all documents for a specific project"""
    db = SessionLocal()
    try:
        return db.query(Document).filter(Document.project_id == project_id).all()
    finally:
        db.close()


def get_documents_for_user(user_id: int):
    """Get all documents for a user across all their projects"""
    db = SessionLocal()
    try:
        from models.project import Project
        return db.query(Document).join(Project).filter(Project.user_id == user_id).all()
    finally:
        db.close()


def get_document_by_id(doc_id: int):
    """Get a specific document by ID"""
    db = SessionLocal()
    try:
        return db.query(Document).filter(Document.id == doc_id).first()
    finally:
        db.close()


def delete_document(doc_id: int):
    """Delete a document"""
    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            db.delete(doc)
            db.commit()
        return doc
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()