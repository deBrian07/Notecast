import os

from pytest import Session
from models.database import get_db
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from typing import List
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
    return db.query(Podcast).filter(Podcast.user_id == current_user.id).all()

@router.get("/{podcast_id}/audio")
def fetch_podcast_audio(podcast_id: int, current_user: User = Depends(get_current_user)):
    pod = get_podcast_by_id(podcast_id)
    if not pod or pod.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Podcast not found")
    return FileResponse(pod.audio_filename, media_type="audio/mpeg", filename=os.path.basename(pod.audio_filename))


def _process_generation(user_id: int, doc):
    # 1. Extract text
    text = get_document_text(user_id, doc.stored_filename)
    # 2. Generate script
    summary = generate_summary(text)
    script  = generate_podcast_script(summary)
    # 3. Produce audio
    audio_path, duration = synthesize_podcast_audio(user_id, doc.id, script)
    # 4. Store record
    title = f"Podcast of {doc.orig_filename}"
    create_podcast(
        user_id=user_id,
        document_id=doc.id,
        title=title,
        script_text=script,
        audio_filename=audio_path,
        duration=duration
    )