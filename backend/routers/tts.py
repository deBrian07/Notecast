import io
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.tts import synthesize_podcast_audio
from core.config import settings

class TTSRequest(BaseModel):
    voice: str
    text: str

router = APIRouter()

@router.post("/tts", response_class=StreamingResponse)
def tts_endpoint(req: TTSRequest):
    try:
        # we don’t yet have user/doc tracking here, so pass dummy IDs
        filepath, _ = synthesize_podcast_audio(
            user_id=0,             # or pull from token if you like
            doc_id=0,
            script=req.text
        )
        # read the mp3 and stream it
        with open(filepath, "rb") as f:
            data = f.read()
        return StreamingResponse(io.BytesIO(data), media_type="audio/mpeg")
    except Exception as e:
        # full traceback will be in your logs because of WatchFiles + exceptions
        raise HTTPException(500, f"TTS failed: {e}")