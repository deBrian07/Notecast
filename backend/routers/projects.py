from fastapi import APIRouter, Depends, HTTPException
from typing import List
from core.security import get_current_user
from models.user import User
from models.project import (
    Project, create_project, get_projects_for_user, 
    get_project_by_id, update_project, delete_project
)
from models.document import get_documents_for_project
from models.podcast import get_podcasts_for_project
from pydantic import BaseModel

router = APIRouter(prefix="/projects", tags=["projects"])

class ProjectCreate(BaseModel):
    name: str
    description: str = None

class ProjectUpdate(BaseModel):
    name: str = None
    description: str = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: str = None
    created_at: str
    updated_at: str
    document_count: int = 0
    podcast_count: int = 0

    class Config:
        from_attributes = True

@router.post("", response_model=ProjectResponse)
def create_new_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new project for the current user"""
    project = create_project(
        user_id=current_user.id,
        name=project_data.name,
        description=project_data.description
    )
    
    # Add counts
    documents = get_documents_for_project(project.id)
    podcasts = get_podcasts_for_project(project.id)
    
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat(),
        document_count=len(documents),
        podcast_count=len(podcasts)
    )

@router.get("", response_model=List[ProjectResponse])
def list_projects(current_user: User = Depends(get_current_user)):
    """Get all projects for the current user"""
    projects = get_projects_for_user(current_user.id)
    
    result = []
    for project in projects:
        documents = get_documents_for_project(project.id)
        podcasts = get_podcasts_for_project(project.id)
        
        result.append(ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            created_at=project.created_at.isoformat(),
            updated_at=project.updated_at.isoformat(),
            document_count=len(documents),
            podcast_count=len(podcasts)
        ))
    
    return result

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user)
):
    """Get a specific project by ID"""
    project = get_project_by_id(project_id)
    
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    documents = get_documents_for_project(project.id)
    podcasts = get_podcasts_for_project(project.id)
    
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat(),
        document_count=len(documents),
        podcast_count=len(podcasts)
    )

@router.put("/{project_id}", response_model=ProjectResponse)
def update_project_route(
    project_id: int,
    project_data: ProjectUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a project"""
    project = get_project_by_id(project_id)
    
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    updated_project = update_project(
        project_id=project_id,
        name=project_data.name,
        description=project_data.description
    )
    
    documents = get_documents_for_project(updated_project.id)
    podcasts = get_podcasts_for_project(updated_project.id)
    
    return ProjectResponse(
        id=updated_project.id,
        name=updated_project.name,
        description=updated_project.description,
        created_at=updated_project.created_at.isoformat(),
        updated_at=updated_project.updated_at.isoformat(),
        document_count=len(documents),
        podcast_count=len(podcasts)
    )

@router.delete("/{project_id}")
def delete_project_route(
    project_id: int,
    current_user: User = Depends(get_current_user)
):
    """Delete a project and all its associated documents and podcasts"""
    project = get_project_by_id(project_id)
    
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Delete associated files before deleting the project
    documents = get_documents_for_project(project_id)
    podcasts = get_podcasts_for_project(project_id)
    
    # Delete document files
    import os
    from core.config import settings
    for doc in documents:
        file_path = os.path.join(settings.upload_dir, str(current_user.id), doc.stored_filename)
        if os.path.exists(file_path):
            os.remove(file_path)
    
    # Delete podcast audio files
    for podcast in podcasts:
        if hasattr(podcast, 'audio_filename'):
            audio_filename = podcast.audio_filename
        else:
            audio_filename = podcast.get('audio_filename')
        
        if audio_filename and os.path.exists(audio_filename):
            os.remove(audio_filename)
    
    # Delete the project (cascade will handle documents and podcasts)
    delete_project(project_id)
    
    return {"detail": "Project deleted successfully"} 