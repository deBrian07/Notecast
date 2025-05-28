from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from typing import List
import os, uuid
from core.config import settings
from core.security import get_current_user
from models.schemas import DocumentBase
from models.document import create_document, get_documents_for_project, get_document_by_id, delete_document
from models.project import get_project_by_id
from models.user import User

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/upload/{project_id}", response_model=DocumentBase)
def upload_document(
    project_id: int,
    file: UploadFile = File(...), 
    current_user: User = Depends(get_current_user)
):
    """Upload a document to a specific project"""
    # Verify the project exists and belongs to the user
    project = get_project_by_id(project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".pdf", ".docx"]:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    # Create user directory if it doesn't exist
    user_dir = os.path.join(settings.upload_dir, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    
    unique_name = f"{uuid.uuid4()}{ext}"
    path = os.path.join(user_dir, unique_name)
    
    with open(path, "wb") as f:
        f.write(file.file.read())
    
    doc = create_document(
        project_id=project_id,
        orig_filename=file.filename,
        stored_filename=unique_name,
        file_type=ext[1:]
    )
    return doc

@router.get("/project/{project_id}", response_model=List[DocumentBase])
def list_documents_for_project(
    project_id: int,
    current_user: User = Depends(get_current_user)
):
    """Get all documents for a specific project"""
    # Verify the project exists and belongs to the user
    project = get_project_by_id(project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return get_documents_for_project(project_id)

@router.get("", response_model=List[DocumentBase])
def list_all_documents(current_user: User = Depends(get_current_user)):
    """Get all documents for the current user across all projects (for backward compatibility)"""
    from models.document import get_documents_for_user
    return get_documents_for_user(current_user.id)

@router.get("/{doc_id}/download")
def download_document(doc_id: int, current_user: User = Depends(get_current_user)):
    """Download a document"""
    doc = get_document_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Verify the document belongs to a project owned by the user
    project = get_project_by_id(doc.project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    
    path = os.path.join(settings.upload_dir, str(current_user.id), doc.stored_filename)
    return FileResponse(path, media_type="application/octet-stream", filename=doc.orig_filename)

@router.delete("/{doc_id}")
def delete_document_route(doc_id: int, current_user: User = Depends(get_current_user)):
    """Delete a document"""
    doc = get_document_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Verify the document belongs to a project owned by the user
    project = get_project_by_id(doc.project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    
    delete_document(doc_id)
    path = os.path.join(settings.upload_dir, str(current_user.id), doc.stored_filename)
    if os.path.exists(path):
        os.remove(path)
    return {"detail": "Document deleted"}

@router.delete("/{doc_id}/file")
def delete_document_file(doc_id: int, current_user: User = Depends(get_current_user)):
    """Delete only the file of a document (for cleanup purposes)"""
    doc = get_document_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Verify the document belongs to a project owned by the user
    project = get_project_by_id(doc.project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    
    path = os.path.join(settings.upload_dir, str(current_user.id), doc.stored_filename)
    if os.path.exists(path):
        os.remove(path)
    return {"detail": "Document file deleted"}