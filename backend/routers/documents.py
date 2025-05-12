from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from typing import List
import os, uuid
from core.config import settings
from core.security import get_current_user
from models.schemas import DocumentBase
from models.document import create_document, get_documents_for_user, get_document_by_id, delete_document
from models.user import User

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/upload", response_model=DocumentBase)
def upload_document(
    file: UploadFile = File(...), current_user: User = Depends(get_current_user)
):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".pdf", ".docx"]:
        raise HTTPException(status_code=400, detail="Invalid file type")
    user_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    unique_name = f"{uuid.uuid4()}{ext}"
    path = os.path.join(user_dir, unique_name)
    with open(path, "wb") as f:
        f.write(file.file.read())
    doc = create_document(
        user_id=current_user.id,
        orig_filename=file.filename,
        stored_filename=unique_name,
        file_type=ext[1:]
    )
    return doc

@router.get("", response_model=List[DocumentBase])
def list_documents(current_user: User = Depends(get_current_user)):
    return get_documents_for_user(current_user.id)

@router.get("/{doc_id}/download")
def download_document(doc_id: int, current_user: User = Depends(get_current_user)):
    doc = get_document_by_id(doc_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    path = os.path.join(settings.UPLOAD_DIR, str(current_user.id), doc.stored_filename)
    return FileResponse(path, media_type="application/octet-stream", filename=doc.orig_filename)

@router.delete("/{doc_id}")
def delete_document_route(doc_id: int, current_user: User = Depends(get_current_user)):
    doc = get_document_by_id(doc_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    delete_document(doc_id)
    path = os.path.join(settings.UPLOAD_DIR, str(current_user.id), doc.stored_filename)
    if os.path.exists(path):
        os.remove(path)
    return {"detail": "Document deleted"}