import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from core.security import get_current_user
from core.config import settings
from models.user import User
from models.database import get_db
from models.project import get_project_by_id
from services.file_service import get_document_text
from models.document import get_documents_for_project

router = APIRouter(prefix="/chat", tags=["chat"])

OLLAMA_CHAT_URL = f"{settings.ollama_url.rstrip('/')}/api/chat"

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant" 
    content: str
    sources: Optional[List[dict]] = None

class ChatRequest(BaseModel):
    message: str
    project_id: int
    conversation_history: List[ChatMessage] = []

class ChatResponse(BaseModel):
    message: str
    sources: List[dict] = []

def get_project_context(project_id: int, user_id: int) -> str:
    """Get the text content of all documents in a project for context"""
    # Verify project ownership
    project = get_project_by_id(project_id)
    if not project or project.user_id != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all documents in the project
    documents = get_documents_for_project(project_id)
    
    if not documents:
        return ""
    
    # Combine all document texts
    context_parts = []
    source_info = []
    
    for doc in documents:
        try:
            doc_text = get_document_text(user_id, doc.stored_filename)
            context_parts.append(f"Document: {doc.orig_filename}\n{doc_text}")
            source_info.append({
                "id": doc.id,
                "filename": doc.orig_filename,
                "excerpt": doc_text[:200] + "..." if len(doc_text) > 200 else doc_text
            })
        except Exception as e:
            print(f"Error reading document {doc.id}: {e}")
            continue
    
    context = "\n\n---\n\n".join(context_parts)
    return context, source_info

@router.post("/", response_model=ChatResponse)
async def chat_with_documents(
    request: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    """Chat with the documents in a project using the LLM"""
    
    # Get project context
    try:
        context, source_info = get_project_context(request.project_id, current_user.id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading project context: {str(e)}")
    
    if not context:
        raise HTTPException(status_code=400, detail="No documents found in this project")
    
    # Build the conversation for the LLM
    system_prompt = (
        "You are an AI assistant that helps users understand and discuss their documents. "
        "You have access to the full content of the user's uploaded documents. "
        "Answer questions about the documents, explain concepts, and provide insights based on the document content. "
        "Be helpful, accurate, and cite specific information from the documents when relevant. "
        "If a question cannot be answered from the document content, say so clearly. "
        "Keep your responses conversational and engaging, similar to how you would explain things in a podcast. "
        "When referencing specific information, try to mention which document it comes from. "
        f"Here are the documents you have access to:\n\n{context}"
    )
    
    messages = [{"role": "system", "content": system_prompt}]
    
    # Add conversation history
    for msg in request.conversation_history[-10:]:  # Keep last 10 messages for context
        messages.append({
            "role": msg.role,
            "content": msg.content
        })
    
    # Add the current user message
    messages.append({
        "role": "user",
        "content": request.message
    })
    
    # Make the LLM request
    try:
        payload = {
            "model": settings.ollama_model,
            "messages": messages,
            "stream": False
        }
        
        response = requests.post(OLLAMA_CHAT_URL, json=payload, timeout=120)
        response.raise_for_status()
        
        llm_response = response.json()["message"]["content"]
        
        return ChatResponse(
            message=llm_response,
            sources=source_info
        )
        
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error communicating with LLM: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@router.get("/project/{project_id}/info")
async def get_project_info(
    project_id: int,
    current_user: User = Depends(get_current_user)
):
    """Get basic info about a project for the chat interface"""
    
    project = get_project_by_id(project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    documents = get_documents_for_project(project_id)
    
    return {
        "project_name": project.name,
        "project_description": project.description,
        "document_count": len(documents),
        "documents": [
            {
                "id": doc.id,
                "filename": doc.orig_filename,
                "created_at": doc.created_at.isoformat() if doc.created_at else None
            }
            for doc in documents
        ]
    } 