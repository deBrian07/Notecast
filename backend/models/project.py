from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from models.database import Base, SessionLocal

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="projects")
    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    podcasts = relationship("Podcast", back_populates="project", cascade="all, delete-orphan")


def create_project(user_id: int, name: str, description: str = None):
    """Create a new project for a user"""
    db = SessionLocal()
    try:
        project = Project(
            user_id=user_id,
            name=name,
            description=description
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        return project
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


def get_projects_for_user(user_id: int):
    """Get all projects for a specific user"""
    db = SessionLocal()
    try:
        return db.query(Project).filter(Project.user_id == user_id).order_by(Project.updated_at.desc()).all()
    finally:
        db.close()


def get_project_by_id(project_id: int):
    """Get a specific project by ID"""
    db = SessionLocal()
    try:
        return db.query(Project).filter(Project.id == project_id).first()
    finally:
        db.close()


def update_project(project_id: int, name: str = None, description: str = None):
    """Update a project's details"""
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            if name is not None:
                project.name = name
            if description is not None:
                project.description = description
            project.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(project)
        return project
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


def delete_project(project_id: int):
    """Delete a project and all its associated documents and podcasts"""
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            db.delete(project)
            db.commit()
        return project
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close() 