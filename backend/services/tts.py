import os
import tempfile
import time
import subprocess
from pydub import AudioSegment
from core.config import settings

def synthesize_podcast_audio(user_id: int, doc_id: int, script: str):
    lines = script.splitlines()
    segments = []
    for line in lines:
        if line.startswith("Host A:"):
            speaker = "female"
            text = line.replace("Host A:", "").strip()
        elif line.startswith("Host B:"):
            speaker = "male"
            text = line.replace("Host B:", "").strip()
        else:
            continue
        segments.append((speaker, text))

    audio_chunks = []
    for speaker, text in segments:
        voice = settings.TTS_VOICE_FEMALE if speaker == "female" else settings.TTS_VOICE_MALE
        tmp_wav = tempfile.mktemp(suffix=".wav")
        # Tortoise-TTS CLI invocation
        subprocess.run([
            "python", "-m", "tortoise",
            "--text", text,
            "--voice", voice,
            "--outfile", tmp_wav
        ], check=True)
        audio = AudioSegment.from_wav(tmp_wav)
        silence = AudioSegment.silent(duration=400)
        audio_chunks.append(audio + silence)
        os.remove(tmp_wav)

    if not audio_chunks:
        raise ValueError("No audio generated")

    podcast = audio_chunks[0]
    for chunk in audio_chunks[1:]:
        podcast += chunk

    user_dir = os.path.join(settings.PODCAST_DIR, str(user_id))
    os.makedirs(user_dir, exist_ok=True)
    filename = f"{doc_id}_{int(time.time())}.mp3"
    filepath = os.path.join(user_dir, filename)
    podcast.export(filepath, format="mp3")
    duration = len(podcast) / 1000.0
    return filepath, duration