import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.security import get_current_user
from models.user import User
from services.tts import synthesize_podcast_audio


class TTSRequest(BaseModel):
    voice: str = "female"
    text: str


router = APIRouter()


@router.post("/tts", response_class=StreamingResponse)
def tts_endpoint(req: TTSRequest, current_user: User = Depends(get_current_user)):
    try:
        prefix = "Host A: " if req.voice.lower().startswith("f") else "Host B: "
        filepath, _duration, _timings = synthesize_podcast_audio(
            user_id=current_user.id,
            doc_id=0,
            script=prefix + req.text,
        )
        with open(filepath, "rb") as handle:
            data = handle.read()
        return StreamingResponse(io.BytesIO(data), media_type="audio/mpeg")
    except Exception as error:
        raise HTTPException(500, f"TTS failed: {error}")
