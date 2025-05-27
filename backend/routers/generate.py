import os

from pytest import Session
from models.database import get_db
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from typing import List
from sqlalchemy import text
from core.security import get_current_user
from models.user import User
from models.document import get_document_by_id
from models.podcast import Podcast, create_podcast, get_podcasts_for_user, get_podcast_by_id
from models.schemas import PodcastBase
from services.file_service import get_document_text
from services.summarization import generate_podcast_script, generate_summary
from services.tts import synthesize_podcast_audio

router = APIRouter(prefix="/generate", tags=["generate"])

@router.post("/{doc_id}")
def start_podcast_generation(
    doc_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    doc = get_document_by_id(doc_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    background_tasks.add_task(_process_generation, current_user.id, doc)
    return {"detail": "Podcast generation started"}

@router.get("/")
def list_podcasts(db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):
    # Use the updated get_podcasts_for_user function which handles the schema check
    podcasts = get_podcasts_for_user(current_user.id)
    
    # Debugging output
    print(f"Found {len(podcasts)} podcasts for user {current_user.id}")
    
    # Convert to dictionaries for easier debugging and to ensure all fields are serialized
    result = []
    for pod in podcasts:
        if isinstance(pod, Podcast):
            # Handle SQLAlchemy model
            pod_dict = {
                "id": pod.id,
                "title": pod.title,
                "document_id": pod.document_id,
                "audio_filename": pod.audio_filename,
                "duration": pod.duration
            }
            # Add created_at if it exists
            try:
                pod_dict["created_at"] = pod.created_at.isoformat() if pod.created_at else None
            except AttributeError:
                pod_dict["created_at"] = None
        else:
            # Handle raw dict from fallback query
            pod_dict = dict(pod)
            if 'created_at' not in pod_dict:
                 pod_dict["created_at"] = None
            
        print(f"Serialized podcast: {pod_dict}")
        result.append(pod_dict)
        
    return result

@router.get("/{podcast_id}/audio")
def fetch_podcast_audio(podcast_id: int, current_user: User = Depends(get_current_user)):
    print(f"[DEBUG] Fetching audio for podcast_id: {podcast_id}, user_id: {current_user.id}")
    
    pod = get_podcast_by_id(podcast_id)
    print(f"[DEBUG] Found podcast: {pod}")
    
    if not pod:
        print(f"[DEBUG] No podcast found with ID {podcast_id}")
        raise HTTPException(status_code=404, detail="Podcast not found")

    # Handle both SQLAlchemy model objects and Row objects
    user_id = pod.user_id if hasattr(pod, 'user_id') else pod['user_id']
    audio_filename = pod.audio_filename if hasattr(pod, 'audio_filename') else pod['audio_filename']

    print(f"[DEBUG] Podcast user_id: {user_id}, current_user.id: {current_user.id}")
    print(f"[DEBUG] Audio filename: {audio_filename}")

    if user_id != current_user.id:
        print(f"[DEBUG] User ID mismatch: podcast belongs to user {user_id}, current user is {current_user.id}")
        raise HTTPException(status_code=404, detail="Podcast not found")
    
    # Check if the file exists before trying to serve it
    if not os.path.exists(audio_filename):
        print(f"[DEBUG] Audio file does not exist at path: {audio_filename}")
        
        # Try to find a replacement file in the same directory
        try:
            dir_path = os.path.dirname(audio_filename)
            if os.path.exists(dir_path):
                files_in_dir = os.listdir(dir_path)
                mp3_files = [f for f in files_in_dir if f.endswith('.mp3')]
                print(f"[DEBUG] MP3 files in directory {dir_path}: {mp3_files}")
                
                if mp3_files:
                    # Use the most recent MP3 file (highest timestamp)
                    mp3_files.sort(reverse=True)  # Sort by filename (which includes timestamp)
                    replacement_file = os.path.join(dir_path, mp3_files[0])
                    print(f"[DEBUG] Using replacement file: {replacement_file}")
                    
                    # Update the database record with the new filename
                    from models.database import SessionLocal
                    db = SessionLocal()
                    try:
                        db.execute(
                            text("UPDATE podcasts SET audio_filename = :new_filename WHERE id = :podcast_id"),
                            {"new_filename": replacement_file, "podcast_id": podcast_id}
                        )
                        db.commit()
                        print(f"[DEBUG] Updated podcast {podcast_id} audio_filename to {replacement_file}")
                        audio_filename = replacement_file
                    except Exception as e:
                        print(f"[DEBUG] Failed to update database: {e}")
                        db.rollback()
                    finally:
                        db.close()
                else:
                    print(f"[DEBUG] No MP3 files found in directory {dir_path}")
            else:
                print(f"[DEBUG] Directory {dir_path} does not exist")
        except Exception as e:
            print(f"[DEBUG] Error finding replacement file: {e}")
        
        # Check again if we found a replacement
        if not os.path.exists(audio_filename):
            raise HTTPException(status_code=404, 
                               detail=f"Audio file not found. It may have been deleted or moved.")
    
    print(f"[DEBUG] Audio file exists, serving: {audio_filename}")
    return FileResponse(audio_filename, media_type="audio/mpeg", filename=os.path.basename(audio_filename))


def _process_generation(user_id: int, doc):
    print(f"Starting podcast generation for document ID: {doc.id}, user ID: {user_id}")
    
    # 1. Extract text
    text = get_document_text(user_id, doc.stored_filename)
    print(f"Extracted text length: {len(text)} characters")
    
    # 2. Generate script
    summary = generate_summary(text)
    script  = generate_podcast_script(summary)
    print(f"Generated script length: {len(script)} characters")
    
    # 3. Produce audio
    audio_path, duration = synthesize_podcast_audio(user_id, doc.id, script)
    print(f"Generated audio at: {audio_path}, duration: {duration}s")
    
    # 4. Store record
    title = f"Podcast of {doc.orig_filename}"
    print(f"Creating podcast record with title: {title}, document_id: {doc.id}")
    
    # Make sure document_id is an integer
    doc_id = int(doc.id)
    
    podcast = create_podcast(
        user_id=user_id,
        document_id=doc_id,
        title=title,
        script_text=script,
        audio_filename=audio_path,
        duration=duration
    )
    
    print(f"Podcast created successfully with ID: {podcast.id if podcast else 'Unknown'}")