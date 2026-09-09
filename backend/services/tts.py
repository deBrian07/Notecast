from typing import Dict, List, Tuple

from core.config import settings


def synthesize_podcast_audio(user_id: int, doc_id: int, script: str) -> Tuple[str, float, List[Dict]]:
    engine = (settings.tts_engine or "edge").strip().lower()
    if engine == "nemo":
        from services.tts_nemo import synthesize_podcast_audio as impl
    else:
        from services.tts_edge import synthesize_podcast_audio as impl
    return impl(user_id, doc_id, script)
